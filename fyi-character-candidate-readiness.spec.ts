import { deepStrictEqual, equal, throws } from "assert";
import { Character, Classes, Rarities, Types } from "./character";
import { buildCharacterDatasetArtifact, CharacterDatasetArtifact } from "./dataset-artifacts";
import type { CharacterCompactManifest, CharacterCompactProjection } from "./database-characters/compact-contract";
import { createCharacterCompactRarityOverlay } from "./database-characters/compact-overlay";
import {
    buildFyiCharacterCandidateK19Report,
    candidateFiles,
    candidateReadyMarkerBytes,
    formattedJsonBytes,
    scopeCharacterCompactProjectionToTarget,
} from "./fyi-character-candidate";
import {
    compareFyiCharacterCandidate,
    FyiCharacterCandidateReadinessInput,
    parseFyiCharacterCandidateReadinessCli,
} from "./fyi-character-candidate-readiness";

function character(id: string, rarity: Rarities | null, options: Partial<Character> = {}): Character {
    return {
        name: `name-${id}`, title: "", maxLevel: 1, maxSALevel: 1, rarity: rarity as Rarities,
        characterClass: Classes.Super, type: Types.AGL, cost: 1, id,
        portraitURL: `/portraits/${id}.png`, portraitFilename: `${id}.png`,
        leaderSkill: "", superAttack: "", passive: "", domain: "", links: [], categories: [], kiMeter: [],
        artURL: "", artFilename: "", baseHP: 1, maxLevelHP: 1, freeDupeHP: 1, rainbowHP: 1,
        baseAttack: 1, maxLevelAttack: 1, freeDupeAttack: 1, rainbowAttack: 1,
        baseDefence: 1, maxDefence: 1, freeDupeDefence: 1, rainbowDefence: 1,
        kiMultiplier: "", standbySkill: "", ...options,
    };
}

function fixture(): FyiCharacterCandidateReadinessInput {
    const generatedAt = "2026-08-10T00:00:00.000Z";
    const baselineCharacters = [character("1", null), character("2", Rarities.SSR)];
    const projection = {
        schemaVersion: 1,
        contract: "dokkan-database-character-compact-shadow",
        contractVersion: "1.0.0",
        generatedAt: "2026-08-05T00:00:00.000Z",
        datasetVersion: "k15-test",
        records: [
            { cardId: "1", stateId: "10", rarity: Rarities.UR, type: Types.AGL },
            { cardId: "2", stateId: "20", rarity: Rarities.SSR, type: Types.AGL },
            { cardId: "9", stateId: "90", rarity: Rarities.UR, type: Types.AGL },
        ],
    } as CharacterCompactProjection;
    const k15Manifest = {
        datasetVersion: "k15-test", fileName: "k15.json.gz", sha256: "k15-payload",
        recordCount: 3,
    } as CharacterCompactManifest;
    const scope = scopeCharacterCompactProjectionToTarget(projection, baselineCharacters);
    const overlay = createCharacterCompactRarityOverlay(baselineCharacters, scope.projection);
    const baseline = buildCharacterDatasetArtifact(baselineCharacters, {
        generatedAt, datasetVersion: generatedAt, fileName: "baseline-characters.json.gz",
    });
    const candidate = buildCharacterDatasetArtifact(overlay.characters, {
        generatedAt, datasetVersion: generatedAt, fileName: "characters.json.gz",
    });
    const k19Report = buildFyiCharacterCandidateK19Report({
        generatedAt, baseline, candidate, k15Manifest, k15RecordCount: projection.records.length,
        scope, overlay: overlay.decision,
    });
    const runReport = {
        generatedAt, publishable: true, fullCatalog: true,
        failedCharacterIds: [], missingCharacterIds: [], duplicateCharacterIds: [],
    };
    const readyMarker = candidateReadyMarkerBytes(candidateFiles({ baseline, candidate, runReport, candidateReport: k19Report }));
    return {
        baselineGzip: baseline.gzipBuffer,
        baselineManifest: baseline.manifest,
        baselineManifestBytes: formattedJsonBytes(baseline.manifest),
        candidateGzip: candidate.gzipBuffer,
        candidateManifest: candidate.manifest,
        candidateManifestBytes: formattedJsonBytes(candidate.manifest),
        candidateReadyMarkerBytes: readyMarker,
        runReport,
        k19Report,
        k15Projection: projection,
        k15Manifest,
    };
}

function replaceCandidate(input: FyiCharacterCandidateReadinessInput, characters: Character[]): FyiCharacterCandidateReadinessInput {
    const artifact = buildCharacterDatasetArtifact(characters, {
        generatedAt: input.k19Report.generatedAt,
        datasetVersion: input.k19Report.generatedAt,
        fileName: "characters.json.gz",
    });
    return {
        ...input,
        candidateGzip: artifact.gzipBuffer,
        candidateManifest: artifact.manifest,
        candidateManifestBytes: formattedJsonBytes(artifact.manifest),
    };
}

function decodedCandidate(input: FyiCharacterCandidateReadinessInput): Character[] {
    const { gunzipSync } = require("zlib");
    return JSON.parse(gunzipSync(input.candidateGzip).toString("utf8"));
}

describe("FYI character K20 candidate readiness", () => {
    it("accepts the golden target-scoped rarity-only candidate", () => {
        const report = compareFyiCharacterCandidate(fixture());
        equal(report.readiness.candidateGenerationValidation, "GO");
        equal(report.failures.total, 0);
        equal(report.changes.authorizedRarityPaths, 1);
        equal(report.changes.appliedRarityPaths, 1);
        equal(report.scope.excludedByTargetCatalog, 1);
        equal(report.readiness.promotion, "NO-GO");
        equal(report.readiness.production, "NO-GO");
        equal(report.readiness.publisher, "NO-GO");
        equal(report.readiness.android, "NO-GO");
        equal(report.readiness.r2, "NO-GO");
    });

    it("rejects a type mutation", () => {
        const input = fixture();
        const characters = decodedCandidate(input);
        characters[0].type = Types.STR;
        const report = compareFyiCharacterCandidate(replaceCandidate(input, characters));
        equal(report.readiness.candidateGenerationValidation, "NO-GO");
        equal(report.checks.typeByteSemanticallyEqual, false);
        equal(report.checks.candidateMatchesFreshK18Overlay, false);
    });

    it("rejects a non-rarity mutation", () => {
        const input = fixture();
        const characters = decodedCandidate(input);
        characters[0].name = "changed";
        const report = compareFyiCharacterCandidate(replaceCandidate(input, characters));
        equal(report.readiness.candidateGenerationValidation, "NO-GO");
        equal(report.checks.nonRarityByteSemanticallyEqual, false);
    });

    it("rejects order changes while preserving bounded failures", () => {
        const input = fixture();
        const characters = decodedCandidate(input).reverse();
        const report = compareFyiCharacterCandidate(replaceCandidate(input, characters));
        equal(report.readiness.candidateGenerationValidation, "NO-GO");
        equal(report.checks.orderPreserved, false);
        equal(report.failures.examples.length <= report.failures.exampleLimit, true);
    });

    it("rejects manifest and hash drift", () => {
        const input = fixture();
        const mutatedManifest = { ...input.candidateManifest, sha256: "0".repeat(64) };
        const report = compareFyiCharacterCandidate({
            ...input,
            candidateManifest: mutatedManifest,
            candidateManifestBytes: formattedJsonBytes(mutatedManifest),
        });
        equal(report.readiness.candidateGenerationValidation, "NO-GO");
        equal(report.checks.candidateManifestMatchesBundle, false);
        equal(report.checks.candidateLineageMatchesK19, false);
    });

    it("rejects an incomplete or stale candidate commit marker", () => {
        const input = fixture();
        const report = compareFyiCharacterCandidate({
            ...input,
            candidateReadyMarkerBytes: Buffer.from("{}\n", "utf8"),
        });
        equal(report.readiness.candidateGenerationValidation, "NO-GO");
        equal(report.checks.candidateCommitMarkerValid, false);
    });

    it("rejects incomplete K19 contract, K15 lineage, and safety declarations", () => {
        const input = fixture();
        const report = compareFyiCharacterCandidate({
            ...input,
            k19Report: {
                ...input.k19Report,
                contractVersion: "0.0.0" as any,
                sources: {
                    ...input.k19Report.sources,
                    k15: { ...input.k19Report.sources.k15, datasetVersion: "mutated", manifestFile: "wrong.json" as any },
                },
                safety: { ...input.k19Report.safety, k15ValidatedBeforeAndAfter: false as any, inMemoryOverlayOnly: false as any },
            },
        });
        equal(report.readiness.candidateGenerationValidation, "NO-GO");
        equal(report.checks.k19ContractValid, false);
        equal(report.checks.k15LineageMatchesK19, false);
        equal(report.checks.k19SafetyBoundaryPreserved, false);
    });

    it("is deterministic and keeps the report bounded", () => {
        const input = fixture();
        const first = compareFyiCharacterCandidate(input);
        const second = compareFyiCharacterCandidate(input);
        deepStrictEqual(first, second);
        equal(JSON.stringify(first).length < 10_000, true);
    });

    it("requires explicit K20 opt-in and allowlisted paths", () => {
        throws(() => parseFyiCharacterCandidateReadinessCli([]), /exactly one/);
        throws(() => parseFyiCharacterCandidateReadinessCli(["--opt-in-k20", "--candidate-dir", "../candidate-k19"]), /not allowed/);
        throws(() => parseFyiCharacterCandidateReadinessCli(["--opt-in-k20", "--k15-dir", "\\\\server\\compact"]), /not allowed/);
        deepStrictEqual(parseFyiCharacterCandidateReadinessCli(["--opt-in-k20"]), {
            optInK20: true, candidateDirectoryName: "candidate-k19", k15DirectoryName: "compact",
        });
    });
});
