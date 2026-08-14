"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CHARACTER_STRUCTURAL_SIDECAR_SOURCE_PIN = exports.CHARACTER_STRUCTURAL_SIDECAR_FILES = exports.CHARACTER_STRUCTURAL_SIDECAR_GZIP_BUDGET_BYTES = exports.CHARACTER_STRUCTURAL_SIDECAR_RAW_BUDGET_BYTES = exports.CHARACTER_STRUCTURAL_SIDECAR_CONTRACT_VERSION = exports.CHARACTER_STRUCTURAL_SIDECAR_SCHEMA_VERSION = void 0;
exports.CHARACTER_STRUCTURAL_SIDECAR_SCHEMA_VERSION = 1;
exports.CHARACTER_STRUCTURAL_SIDECAR_CONTRACT_VERSION = "1.0.0";
exports.CHARACTER_STRUCTURAL_SIDECAR_RAW_BUDGET_BYTES = 32 * 1024 * 1024;
exports.CHARACTER_STRUCTURAL_SIDECAR_GZIP_BUDGET_BYTES = 4 * 1024 * 1024;
exports.CHARACTER_STRUCTURAL_SIDECAR_FILES = {
    payload: "database-characters-k32-structural-identity.json.gz",
    manifest: "database-characters-k32-manifest.json",
    coverage: "database-characters-k32-coverage.json",
    validation: "database-characters-k32-validation.json",
};
exports.CHARACTER_STRUCTURAL_SIDECAR_SOURCE_PIN = {
    profileId: "global-6.4.0-v338-2026-08-05-character-sidecars-v1",
    snapshotVersion: "global-6.4.0-v338-2026-08-05",
    k2: {
        contractVersion: "1.0.0",
        generatedAt: "2026-08-05T00:00:00.000Z",
        manifestFile: "database-characters-k2-manifest.json",
        manifestSha256: "c5b15d2aff4e18d866d42e5036001300daf8db7ae708af179ba9ecf045e88f24",
        manifestSizeBytes: 927,
        payloadFile: "database-characters-k2-taxonomy.json.gz",
        payloadSha256: "af1c84eb0d030fbf389ea0f1f5590e5f643234e2d6348bcc64fe2ffab4718b37",
        payloadSizeBytes: 511837,
        uncompressedSizeBytes: 12566626,
        coverageFile: "database-characters-k2-coverage.json",
        coverageSha256: "f82d599b5507fa01cd83c1079779eb504ee739ea892037e279294ba77f65eba9",
        coverageSizeBytes: 687,
        validationFile: "database-characters-k2-validation.json",
        validationSha256: "dc814b9a0a2cde835fcb00e86b3cc4ea9eb486e0a1148d528b6cabf849163fac",
        validationSizeBytes: 60,
        databaseSha256: "3654eb7db9e18dfe4c238abd02bcc06a688ffa6f30aa1ad93fd108dcfeb78265",
        db1ArtifactSha256: "0afae38e1a80e55bc5d8a137f945727149f44403bf1670e830d3ef6f3650e547",
        cardCount: 5759,
        categoryCount: 98,
        linkCount: 133,
        categoryAssignmentCount: 54072,
        linkAssignmentCount: 34018,
    },
    productiveCharacters: {
        contract: "Character[]",
        datasetVersion: "2026-08-13T03:49:01.219Z",
        manifestFile: "characters-manifest.json",
        manifestSha256: "ae634968dd3349cec2b6ac16d7df2bcdcf9306afaf897cb475011fbd8f22c610",
        manifestSizeBytes: 445,
        manifestPayloadFile: "releases/2026-08-13T03-49-01.219Z/de6268219039f0bbafda7b01b473e957e0cd5442682caab361a32470a2a2e899/characters.json.gz",
        localPayloadFile: "characters.json.gz",
        payloadSha256: "de6268219039f0bbafda7b01b473e957e0cd5442682caab361a32470a2a2e899",
        payloadSizeBytes: 1460373,
        uncompressedSizeBytes: 15720450,
        topLevelCount: 1436,
        uniqueCardIdCount: 1627,
        databaseCoveredCardCount: 1623,
        databaseUncoveredCardCount: 4136,
        outsideDatabaseCardIds: ["1020411", "1030311", "1034411", "1034431"],
    },
};
//# sourceMappingURL=structural-sidecar-contract.js.map