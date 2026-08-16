import assert = require("assert");
import { describe, it } from "mocha";
import { createEmptyS3ObservationDataset, generateS3Id, S3Observation, S3ObservationDataset, validateS3ObservationDataset } from "./s3-observation-contract";
import { parseS3DatasetBytes } from "./s3-run";

const sessionId = "anon_0123456789abcdef";
const sequenceId = "friendseq_0123456789abcdef";
const rulesEvidenceId = "evidence_0000000000000001";
const triggerEvidenceId = "evidence_0000000000000002";
const sourceEvidenceId = "evidence_0000000000000003";
const banner = (id: string, version: string, rules: "missing" | "pinned" = "pinned") => ({ bannerId: id, bannerVersion: version, region: "global" as const, validFromBucket: "2026-08-01T00:00Z", validUntilBucket: "2026-08-31T23:00Z", officialRulesStatus: rules, officialRulesEvidenceRef: rules === "pinned" ? rulesEvidenceId : null });
const row = (overrides: Partial<S3Observation>): S3Observation => ({ observationId: "obs_0000000000000001", anonymousSessionId: sessionId, temporalBucket: "2026-08-16T12:00Z", bannerId: "friend", bannerVersion: "2026_08", summonType: "friend_single", multiId: "multi_0000000000000001", slotIndex: 1, cardId: 1001, rarity: "R", featuredFlag: false, guaranteedSlotFlag: false, friendSummonSequenceId: sequenceId, friendAttemptIndex: 1, friendTriggerFlag: false, attemptsUntilTrigger: null, friendToNormalIntervalSeconds: null, origin: "manual_screen_recording", quality: "complete_verified", sourceEvidenceRef: sourceEvidenceId, ...overrides });

function valid(): S3ObservationDataset {
    const dataset = createEmptyS3ObservationDataset();
    dataset.datasetId = "dataset_0123456789abcdef";
    dataset.triggerDefinition = { status: "fixed", triggerId: "friend_trigger_v1", observableType: "card_set", observableRule: "At least one card belongs to the preregistered card ID set.", fixedBeforeCollection: true, preregistrationEvidenceRef: triggerEvidenceId };
    dataset.evidenceArtifacts = [
        { evidenceId: rulesEvidenceId, role: "official_rules", sha256: "a".repeat(64), sizeBytes: 10, mediaType: "text/html", sanitized: true },
        { evidenceId: triggerEvidenceId, role: "trigger_preregistration", sha256: "b".repeat(64), sizeBytes: 10, mediaType: "application/json", sanitized: true },
        { evidenceId: sourceEvidenceId, role: "observation_source", sha256: "c".repeat(64), sizeBytes: 10, mediaType: "video/mp4", sanitized: true },
    ];
    dataset.banners = [banner("friend", "2026_08"), banner("ordinary_banner", "v1")];
    dataset.sessions = [{ anonymousSessionId: sessionId, gameBuild: "6.4.0", region: "global", origin: "manual_screen_recording", quality: "complete_verified" }];
    dataset.observations = [
        row({}),
        row({ observationId: "obs_0000000000000002", multiId: "multi_0000000000000002", friendAttemptIndex: 2, friendTriggerFlag: true, attemptsUntilTrigger: 2, cardId: 1002 }),
        row({ observationId: "obs_0000000000000003", multiId: "multi_0000000000000003", bannerId: "ordinary_banner", bannerVersion: "v1", summonType: "banner_multi", slotIndex: 1, cardId: 2001, rarity: "SSR", featuredFlag: true, guaranteedSlotFlag: false, friendAttemptIndex: null, friendTriggerFlag: null, attemptsUntilTrigger: null, friendToNormalIntervalSeconds: 90 }),
        row({ observationId: "obs_0000000000000004", multiId: "multi_0000000000000003", bannerId: "ordinary_banner", bannerVersion: "v1", summonType: "banner_multi", slotIndex: 2, cardId: 2002, rarity: "SSR", featuredFlag: false, guaranteedSlotFlag: true, friendAttemptIndex: null, friendTriggerFlag: null, attemptsUntilTrigger: null, friendToNormalIntervalSeconds: 90 }),
    ];
    return dataset;
}

describe("S3 summon observation contract", () => {
    it("accepts an empty pending template as infrastructure only", () => {
        const result = validateS3ObservationDataset(createEmptyS3ObservationDataset());
        assert.equal(result.valid, true);
        assert.equal(result.analysisCandidateObservationCount, 0);
    });
    it("accepts complete negative Friend attempts, one trigger and a linked banner multi", () => {
        const result = validateS3ObservationDataset(valid());
        assert.deepEqual(result.failures, []);
        assert.equal(result.analysisCandidateObservationCount, 4);
        assert.equal(result.friendSequenceCount, 1);
    });
    it("rejects real-looking session IDs and unknown sensitive fields", () => {
        const dataset: any = valid();
        dataset.sessions[0].anonymousSessionId = "real-player-123";
        dataset.sessions[0].accountId = "123";
        const result = validateS3ObservationDataset(dataset);
        assert.equal(result.valid, false);
        assert.equal(result.failures.some(value => value.includes("session contract")), true);
        assert.equal(result.failures.some(value => value.includes("sensitive key")), true);
    });
    it("rejects raw authorization values even in an otherwise allowed text field", () => {
        const dataset = valid();
        dataset.triggerDefinition.observableRule = "Authorization: Bearer abcdefghijklmnop";
        assert.equal(validateS3ObservationDataset(dataset).failures.some(value => value.includes("sensitive value")), true);
    });
    it("rejects a trigger association while the observable trigger is pending", () => {
        const dataset = valid();
        dataset.triggerDefinition = { status: "pending", triggerId: null, observableType: null, observableRule: null, fixedBeforeCollection: false, preregistrationEvidenceRef: null };
        assert.equal(validateS3ObservationDataset(dataset).failures.some(value => value.includes("unfixed trigger used")), true);
    });
    it("rejects missing negative attempts and attempts after a trigger", () => {
        const missing = valid();
        missing.observations = missing.observations.filter(value => value.friendAttemptIndex !== 1);
        assert.equal(validateS3ObservationDataset(missing).failures.some(value => value.includes("missing negative Friend attempt")), true);
        const after = valid();
        after.observations.push(row({ observationId: "obs_0000000000000005", multiId: "multi_0000000000000005", friendAttemptIndex: 3 }));
        assert.equal(validateS3ObservationDataset(after).failures.some(value => value.includes("Friend attempts after trigger")), true);
    });
    it("rejects duplicate Friend invocations for one attempt and reversed attempt time", () => {
        const duplicate = valid();
        duplicate.observations.push(row({ observationId: "obs_0000000000000005", multiId: "multi_0000000000000005", friendAttemptIndex: 1 }));
        assert.equal(validateS3ObservationDataset(duplicate).failures.some(value => value.includes("multiple summons for Friend attempt")), true);
        const reversed = valid();
        reversed.observations[0].temporalBucket = "2026-08-16T13:00Z";
        assert.equal(validateS3ObservationDataset(reversed).failures.some(value => value.includes("Friend attempt time reversal")), true);
    });
    it("rejects non-contiguous or inconsistent multi rows", () => {
        const dataset = valid();
        dataset.observations[3].slotIndex = 3;
        dataset.observations[3].friendToNormalIntervalSeconds = 91;
        const result = validateS3ObservationDataset(dataset);
        assert.equal(result.failures.some(value => value.includes("non-contiguous multi slots")), true);
        assert.equal(result.failures.some(value => value.includes("inconsistent multi")), true);
    });
    it("rejects banner linkage without an observed trigger", () => {
        const dataset = valid();
        dataset.observations[1].friendTriggerFlag = false;
        dataset.observations[1].attemptsUntilTrigger = null;
        assert.equal(validateS3ObservationDataset(dataset).failures.some(value => value.includes("linked banner lacks observed trigger")), true);
    });
    it("rejects a banner before its trigger and an interval inconsistent with hourly buckets", () => {
        const before = valid();
        before.observations[2].temporalBucket = "2026-08-16T11:00Z";
        before.observations[3].temporalBucket = "2026-08-16T11:00Z";
        assert.equal(validateS3ObservationDataset(before).failures.some(value => value.includes("linked banner precedes trigger")), true);
        const inconsistent = valid();
        inconsistent.observations[2].temporalBucket = "2026-08-16T14:00Z";
        inconsistent.observations[3].temporalBucket = "2026-08-16T14:00Z";
        assert.equal(validateS3ObservationDataset(inconsistent).failures.some(value => value.includes("interval inconsistent")), true);
    });
    it("requires role-correct source, rule and preregistration evidence descriptors", () => {
        const dataset = valid();
        dataset.observations[0].sourceEvidenceRef = null;
        dataset.triggerDefinition.preregistrationEvidenceRef = rulesEvidenceId;
        dataset.banners[0].officialRulesEvidenceRef = sourceEvidenceId;
        const result = validateS3ObservationDataset(dataset);
        assert.equal(result.failures.some(value => value.includes("verified observation lacks source evidence")), true);
        assert.equal(result.failures.some(value => value.includes("trigger preregistration evidence")), true);
        assert.equal(result.failures.some(value => value.includes("official rules identity")), true);
    });
    it("keeps incomplete or unpinned observations exploratory", () => {
        const dataset = valid();
        dataset.banners[1] = banner("ordinary_banner", "v1", "missing");
        const result = validateS3ObservationDataset(dataset);
        assert.equal(result.valid, true);
        assert.equal(result.analysisCandidateObservationCount, 2);
        assert.equal(result.exploratoryOnlyObservationCount, 2);
    });
    it("rejects exact timestamp fields instead of silently retaining them", () => {
        const dataset: any = valid();
        dataset.observations[0].timestamp = "2026-08-16T12:34:56Z";
        assert.equal(validateS3ObservationDataset(dataset).failures.some(value => value.includes("unknown field")), true);
    });
    it("rejects impossible civil dates instead of accepting Date normalization", () => {
        const february = valid();
        february.observations[0].temporalBucket = "2026-02-31T12:00Z";
        assert.equal(validateS3ObservationDataset(february).failures.some(value => value.includes("observation contract")), true);
        const april = valid();
        april.banners[0].validFromBucket = "2026-04-31T00:00Z";
        assert.equal(validateS3ObservationDataset(april).failures.some(value => value.includes("banner contract")), true);
    });
    it("generates namespaced CSPRNG IDs and rejects malformed UTF-8", () => {
        assert.match(generateS3Id("anon"), /^anon_[a-f0-9]{16}$/);
        assert.throws(() => parseS3DatasetBytes(Buffer.from([0x7b, 0x22, 0x78, 0x22, 0x3a, 0x22, 0xc3, 0x28, 0x22, 0x7d])), /UTF-8 JSON/);
    });
});
