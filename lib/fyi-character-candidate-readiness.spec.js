"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const character_1 = require("./character");
const dataset_artifacts_1 = require("./dataset-artifacts");
const compact_overlay_1 = require("./database-characters/compact-overlay");
const fyi_character_candidate_1 = require("./fyi-character-candidate");
const fyi_character_candidate_readiness_1 = require("./fyi-character-candidate-readiness");
function character(id, rarity, options = {}) {
    return {
        name: `name-${id}`, title: "", maxLevel: 1, maxSALevel: 1, rarity: rarity,
        characterClass: character_1.Classes.Super, type: character_1.Types.AGL, cost: 1, id,
        portraitURL: `/portraits/${id}.png`, portraitFilename: `${id}.png`,
        leaderSkill: "", superAttack: "", passive: "", domain: "", links: [], categories: [], kiMeter: [],
        artURL: "", artFilename: "", baseHP: 1, maxLevelHP: 1, freeDupeHP: 1, rainbowHP: 1,
        baseAttack: 1, maxLevelAttack: 1, freeDupeAttack: 1, rainbowAttack: 1,
        baseDefence: 1, maxDefence: 1, freeDupeDefence: 1, rainbowDefence: 1,
        kiMultiplier: "", standbySkill: "", ...options,
    };
}
function fixture() {
    const generatedAt = "2026-08-10T00:00:00.000Z";
    const baselineCharacters = [character("1", null), character("2", character_1.Rarities.SSR)];
    const projection = {
        schemaVersion: 1,
        contract: "dokkan-database-character-compact-shadow",
        contractVersion: "1.0.0",
        generatedAt: "2026-08-05T00:00:00.000Z",
        datasetVersion: "k15-test",
        records: [
            { cardId: "1", stateId: "10", rarity: character_1.Rarities.UR, type: character_1.Types.AGL },
            { cardId: "2", stateId: "20", rarity: character_1.Rarities.SSR, type: character_1.Types.AGL },
            { cardId: "9", stateId: "90", rarity: character_1.Rarities.UR, type: character_1.Types.AGL },
        ],
    };
    const k15Manifest = {
        datasetVersion: "k15-test", fileName: "k15.json.gz", sha256: "k15-payload",
        recordCount: 3,
    };
    const scope = (0, fyi_character_candidate_1.scopeCharacterCompactProjectionToTarget)(projection, baselineCharacters);
    const overlay = (0, compact_overlay_1.createCharacterCompactRarityOverlay)(baselineCharacters, scope.projection);
    const baseline = (0, dataset_artifacts_1.buildCharacterDatasetArtifact)(baselineCharacters, {
        generatedAt, datasetVersion: generatedAt, fileName: "baseline-characters.json.gz",
    });
    const candidate = (0, dataset_artifacts_1.buildCharacterDatasetArtifact)(overlay.characters, {
        generatedAt, datasetVersion: generatedAt, fileName: "characters.json.gz",
    });
    const k19Report = (0, fyi_character_candidate_1.buildFyiCharacterCandidateK19Report)({
        generatedAt, baseline, candidate, k15Manifest, k15RecordCount: projection.records.length,
        scope, overlay: overlay.decision,
    });
    const runReport = {
        generatedAt, publishable: true, fullCatalog: true,
        failedCharacterIds: [], missingCharacterIds: [], duplicateCharacterIds: [],
    };
    const readyMarker = (0, fyi_character_candidate_1.candidateReadyMarkerBytes)((0, fyi_character_candidate_1.candidateFiles)({ baseline, candidate, runReport, candidateReport: k19Report }));
    return {
        baselineGzip: baseline.gzipBuffer,
        baselineManifest: baseline.manifest,
        baselineManifestBytes: (0, fyi_character_candidate_1.formattedJsonBytes)(baseline.manifest),
        candidateGzip: candidate.gzipBuffer,
        candidateManifest: candidate.manifest,
        candidateManifestBytes: (0, fyi_character_candidate_1.formattedJsonBytes)(candidate.manifest),
        candidateReadyMarkerBytes: readyMarker,
        runReport,
        k19Report,
        k15Projection: projection,
        k15Manifest,
    };
}
function replaceCandidate(input, characters) {
    const artifact = (0, dataset_artifacts_1.buildCharacterDatasetArtifact)(characters, {
        generatedAt: input.k19Report.generatedAt,
        datasetVersion: input.k19Report.generatedAt,
        fileName: "characters.json.gz",
    });
    return {
        ...input,
        candidateGzip: artifact.gzipBuffer,
        candidateManifest: artifact.manifest,
        candidateManifestBytes: (0, fyi_character_candidate_1.formattedJsonBytes)(artifact.manifest),
    };
}
function decodedCandidate(input) {
    const { gunzipSync } = require("zlib");
    return JSON.parse(gunzipSync(input.candidateGzip).toString("utf8"));
}
describe("FYI character K20 candidate readiness", () => {
    it("accepts the golden target-scoped rarity-only candidate", () => {
        const report = (0, fyi_character_candidate_readiness_1.compareFyiCharacterCandidate)(fixture());
        (0, assert_1.equal)(report.readiness.candidateGenerationValidation, "GO");
        (0, assert_1.equal)(report.failures.total, 0);
        (0, assert_1.equal)(report.changes.authorizedRarityPaths, 1);
        (0, assert_1.equal)(report.changes.appliedRarityPaths, 1);
        (0, assert_1.equal)(report.scope.excludedByTargetCatalog, 1);
        (0, assert_1.equal)(report.readiness.promotion, "NO-GO");
        (0, assert_1.equal)(report.readiness.production, "NO-GO");
        (0, assert_1.equal)(report.readiness.publisher, "NO-GO");
        (0, assert_1.equal)(report.readiness.android, "NO-GO");
        (0, assert_1.equal)(report.readiness.r2, "NO-GO");
    });
    it("rejects a type mutation", () => {
        const input = fixture();
        const characters = decodedCandidate(input);
        characters[0].type = character_1.Types.STR;
        const report = (0, fyi_character_candidate_readiness_1.compareFyiCharacterCandidate)(replaceCandidate(input, characters));
        (0, assert_1.equal)(report.readiness.candidateGenerationValidation, "NO-GO");
        (0, assert_1.equal)(report.checks.typeByteSemanticallyEqual, false);
        (0, assert_1.equal)(report.checks.candidateMatchesFreshK18Overlay, false);
    });
    it("rejects a non-rarity mutation", () => {
        const input = fixture();
        const characters = decodedCandidate(input);
        characters[0].name = "changed";
        const report = (0, fyi_character_candidate_readiness_1.compareFyiCharacterCandidate)(replaceCandidate(input, characters));
        (0, assert_1.equal)(report.readiness.candidateGenerationValidation, "NO-GO");
        (0, assert_1.equal)(report.checks.nonRarityByteSemanticallyEqual, false);
    });
    it("rejects order changes while preserving bounded failures", () => {
        const input = fixture();
        const characters = decodedCandidate(input).reverse();
        const report = (0, fyi_character_candidate_readiness_1.compareFyiCharacterCandidate)(replaceCandidate(input, characters));
        (0, assert_1.equal)(report.readiness.candidateGenerationValidation, "NO-GO");
        (0, assert_1.equal)(report.checks.orderPreserved, false);
        (0, assert_1.equal)(report.failures.examples.length <= report.failures.exampleLimit, true);
    });
    it("rejects manifest and hash drift", () => {
        const input = fixture();
        const mutatedManifest = { ...input.candidateManifest, sha256: "0".repeat(64) };
        const report = (0, fyi_character_candidate_readiness_1.compareFyiCharacterCandidate)({
            ...input,
            candidateManifest: mutatedManifest,
            candidateManifestBytes: (0, fyi_character_candidate_1.formattedJsonBytes)(mutatedManifest),
        });
        (0, assert_1.equal)(report.readiness.candidateGenerationValidation, "NO-GO");
        (0, assert_1.equal)(report.checks.candidateManifestMatchesBundle, false);
        (0, assert_1.equal)(report.checks.candidateLineageMatchesK19, false);
    });
    it("rejects an incomplete or stale candidate commit marker", () => {
        const input = fixture();
        const report = (0, fyi_character_candidate_readiness_1.compareFyiCharacterCandidate)({
            ...input,
            candidateReadyMarkerBytes: Buffer.from("{}\n", "utf8"),
        });
        (0, assert_1.equal)(report.readiness.candidateGenerationValidation, "NO-GO");
        (0, assert_1.equal)(report.checks.candidateCommitMarkerValid, false);
    });
    it("rejects incomplete K19 contract, K15 lineage, and safety declarations", () => {
        const input = fixture();
        const report = (0, fyi_character_candidate_readiness_1.compareFyiCharacterCandidate)({
            ...input,
            k19Report: {
                ...input.k19Report,
                contractVersion: "0.0.0",
                sources: {
                    ...input.k19Report.sources,
                    k15: { ...input.k19Report.sources.k15, datasetVersion: "mutated", manifestFile: "wrong.json" },
                },
                safety: { ...input.k19Report.safety, k15ValidatedBeforeAndAfter: false, inMemoryOverlayOnly: false },
            },
        });
        (0, assert_1.equal)(report.readiness.candidateGenerationValidation, "NO-GO");
        (0, assert_1.equal)(report.checks.k19ContractValid, false);
        (0, assert_1.equal)(report.checks.k15LineageMatchesK19, false);
        (0, assert_1.equal)(report.checks.k19SafetyBoundaryPreserved, false);
    });
    it("is deterministic and keeps the report bounded", () => {
        const input = fixture();
        const first = (0, fyi_character_candidate_readiness_1.compareFyiCharacterCandidate)(input);
        const second = (0, fyi_character_candidate_readiness_1.compareFyiCharacterCandidate)(input);
        (0, assert_1.deepStrictEqual)(first, second);
        (0, assert_1.equal)(JSON.stringify(first).length < 10000, true);
    });
    it("requires explicit K20 opt-in and allowlisted paths", () => {
        (0, assert_1.throws)(() => (0, fyi_character_candidate_readiness_1.parseFyiCharacterCandidateReadinessCli)([]), /exactly one/);
        (0, assert_1.throws)(() => (0, fyi_character_candidate_readiness_1.parseFyiCharacterCandidateReadinessCli)(["--opt-in-k20", "--candidate-dir", "../candidate-k19"]), /not allowed/);
        (0, assert_1.throws)(() => (0, fyi_character_candidate_readiness_1.parseFyiCharacterCandidateReadinessCli)(["--opt-in-k20", "--k15-dir", "\\\\server\\compact"]), /not allowed/);
        (0, assert_1.deepStrictEqual)((0, fyi_character_candidate_readiness_1.parseFyiCharacterCandidateReadinessCli)(["--opt-in-k20"]), {
            optInK20: true, candidateDirectoryName: "candidate-k19", k15DirectoryName: "compact",
        });
    });
});
//# sourceMappingURL=fyi-character-candidate-readiness.spec.js.map