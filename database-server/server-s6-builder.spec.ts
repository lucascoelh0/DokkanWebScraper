import { deepEqual, equal, throws } from "assert";
import { buildServerS6, validateServerS6 } from "./server-s6-builder";
import { ServerS6CacheInput, ServerS6InputGate, ServerS6SourceLineage } from "./server-s6-contract";

const source = (key: ServerS6SourceLineage["key"], index: number): ServerS6SourceLineage => ({ key, path: `${key}.json`, contractVersion: null, sha256: index.toString(16).repeat(64), sizeBytes: 10, authority: key === "fyi_summons_implementation" ? "repository_implementation" : "existing_community_cache", generatedAt: "2026-08-01T00:00:00.000Z" });
const gate = (name: ServerS6InputGate["gate"], dataset: any): ServerS6InputGate => ({ gate: name, contractVersion: `0.${Number(name[1]) + 1}.0`, path: `data/database-server/${name}/payload.json`, sha256: name[1].repeat(64), sizeBytes: 20, generatedAt: `2026-08-0${name[1]}T00:00:00.000Z`, dataset });
function inputs() {
    const s1 = gate("s1", { authority: { role: "community_shadow_only", officialDynamicAuthorityCount: 0 }, schedules: [], banners: [{ identity: { id: "10" }, featuredCharacters: { entries: [{ ordinal: 0, payloadCharacterId: "100" }, { ordinal: 1, payloadCharacterId: "200" }] } }] });
    const family = (key: string, sets: any[], joins: any[]) => ({ key, identitySets: sets, joins });
    const s2 = gate("s2", { identityPolicy: { structuralIdsOnly: true, titleJoinAllowed: false }, families: [family("super_battle_road", [{ key: "sbr_shadow_challenge_roots", ids: ["710"] }, { key: "sbr_shadow_stage_roots", ids: Array.from({ length: 176 }, (_, index) => String(7100000 + index)) }], []), family("ultimate_clash", [{ key: "rmbattle_mission_refs", ids: ["1", "2"] }], []), family("world_tournament", [{ key: "budokai_database_roots", ids: ["1"] }], []), family("burst_mode", [], [{ key: "genkai_score_root_join", unmatchedCount: 3 }]), family("pettan_battle", [{ key: "pettan_shadow_series", ids: ["1", "2"] }], [])] });
    const s3 = gate("s3", { authorityPolicy: { legacyRewardIdentityOrigin: "unknown_payload_id_or_synthetic_index", normalizedRowsLossless: false }, assessments: [{ classification: "partial_candidate" }, { classification: "unjoinable" }] });
    const s4 = gate("s4", { e6Projection: { remoteManifestJoinedReferenceCount: 0, unresolvedDeliveryReferenceCount: 4, status: "unknown" } });
    const s5 = gate("s5", { defaultEnabled: false, productionMutation: false });
    const cache: ServerS6CacheInput = { existingBannerIds: ["9", "10"], characterIds: ["100"], generatedAt: "2026-08-01T00:00:00.000Z", sourceLineage: [source("fyi_summons_implementation", 10), source("summons_index_cache", 11), source("summons_details_cache", 12), source("characters_manifest", 13), source("characters_payload", 14)] };
    return { s1, s2, s3, s4, s5, cache };
}

describe("server S6 shadow parity", () => {
    it("builds deterministic exclusive parity classifications", () => { const first = buildServerS6(inputs()), second = buildServerS6(inputs()); deepEqual(first, second); equal(validateServerS6(first).valid, true); });
    it("treats current-only banners as gain and old-only active banners as unknown", () => { const dataset = buildServerS6(inputs()), subject = dataset.subjects.find(value => value.key === "active_banner_cache_delta")!; deepEqual(subject.identities.agreement, ["10"]); deepEqual(subject.identities.unknown, ["9"]); equal(subject.counts.confirmedConflict, 0); });
    it("separates card identity from official featured relationship", () => { const dataset = buildServerS6(inputs()), cards = dataset.subjects.find(value => value.key === "featured_character_identity")!, relations = dataset.subjects.find(value => value.key === "official_featured_relationship")!; equal(cards.counts.agreement, 1); equal(cards.counts.representationGain, 1); equal(relations.counts.unknown, 2); equal(relations.counts.agreement, 0); });
    it("maps reward partial candidates to unknown, not agreement or conflict", () => { const subject = buildServerS6(inputs()).subjects.find(value => value.key === "reward_row_identity")!; equal(subject.counts.unknown, 1); equal(subject.counts.unjoinable, 1); equal(subject.counts.confirmedConflict, 0); });
    it("rejects double-classified identities and false completeness", () => { const dataset = buildServerS6(inputs()), subject = dataset.subjects[0]; subject.identities.confirmed_conflict = [subject.identities.agreement![0]]; subject.counts.confirmedConflict = 1; subject.comparedCount++; (dataset.completeness as any).proven = true; const validation = validateServerS6(dataset); equal(validation.valid, false); equal(validation.exclusiveClassifications, false); equal(validation.zeroConflictNotCompleteness, false); });
    it("fails before parity when an upstream authority boundary is promoted", () => { const value = inputs(); value.s5.dataset.defaultEnabled = true; throws(() => buildServerS6(value), /S6 S5 activation boundary/); });
    it("rejects an unknown upstream lineage contract", () => { const dataset = buildServerS6(inputs()); dataset.sourceLineage.find(value => value.key === "server_s3")!.contractVersion = "9.0.0"; const validation = validateServerS6(dataset); equal(validation.valid, false); equal(validation.sourceLineageComplete, false); });
    it("rejects reward or featured-relation promotion while preserving accounting", () => {
        const dataset = buildServerS6(inputs()), reward = dataset.subjects.find(value => value.key === "reward_row_identity")!, featured = dataset.subjects.find(value => value.key === "official_featured_relationship")!;
        reward.counts.unknown--; reward.counts.agreement++; featured.counts.unknown--; featured.counts.representationGain++;
        dataset.totals.unknown -= 2; dataset.totals.agreement++; dataset.totals.representationGain++;
        featured.identities.unknown = featured.identities.unknown!.slice(1); featured.identities.representation_gain = ["10:0:100"];
        const validation = validateServerS6(dataset); equal(validation.exactAccounting, true); equal(validation.classificationPolicyPreserved, false); equal(validation.valid, false);
    });
});
