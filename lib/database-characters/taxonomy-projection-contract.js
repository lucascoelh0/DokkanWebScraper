"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TAXONOMY_PROJECTION_SOURCE_PIN = exports.TAXONOMY_PROJECTION_FILES = exports.TAXONOMY_PROJECTION_MAX_EXAMPLES = exports.TAXONOMY_PROJECTION_RSS_LIMIT_BYTES = exports.TAXONOMY_PROJECTION_GZIP_LIMIT_BYTES = exports.TAXONOMY_PROJECTION_RAW_LIMIT_BYTES = exports.TAXONOMY_PROJECTION_CONTRACT_VERSION = exports.TAXONOMY_PROJECTION_SCHEMA_VERSION = void 0;
const card_scope_contract_1 = require("./card-scope-contract");
const structural_sidecar_contract_1 = require("./structural-sidecar-contract");
exports.TAXONOMY_PROJECTION_SCHEMA_VERSION = 1;
exports.TAXONOMY_PROJECTION_CONTRACT_VERSION = "1.0.0";
exports.TAXONOMY_PROJECTION_RAW_LIMIT_BYTES = 8 * 1024 * 1024;
exports.TAXONOMY_PROJECTION_GZIP_LIMIT_BYTES = 1024 * 1024;
exports.TAXONOMY_PROJECTION_RSS_LIMIT_BYTES = 1024 * 1024 * 1024;
exports.TAXONOMY_PROJECTION_MAX_EXAMPLES = 5;
exports.TAXONOMY_PROJECTION_FILES = {
    manifest: "database-characters-k35-taxonomy-projection-manifest.json",
    coverage: "database-characters-k35-taxonomy-projection-coverage.json",
    validation: "database-characters-k35-taxonomy-projection-validation.json",
};
exports.TAXONOMY_PROJECTION_SOURCE_PIN = {
    profileId: "global-6.4.0-v338-2026-08-05-taxonomy-projection-k35-v1",
    datasetVersion: "global-6.4.0-v338-2026-08-05-k35-taxonomy-projection-v1",
    generatedAt: structural_sidecar_contract_1.CHARACTER_STRUCTURAL_SIDECAR_SOURCE_PIN.k2.generatedAt,
    k32: {
        contractVersion: "1.0.0",
        manifestSha256: "91c2d76f38fd3a0b5eddd5e0db9651af5f7df852065a0fea7a1fc804dec3ae21",
        manifestSizeBytes: 2358,
        payloadSha256: "241b135ac88aad2a242a6abb81ab22b099ff25257cb0c8f0f5f7e82f888cb718",
        payloadSizeBytes: 706128,
        rawSha256: "a910cc5b2363f24326b58174c18ce8dc85669d26e73c54544a101ffecfdfd403",
        rawSizeBytes: 24686675,
        coverageSha256: "9fdee8e1929d42e2e6f6e46ece395800789e52ba0fb0b5ae16776f99a6ff189a",
        coverageSizeBytes: 1158,
        validationSha256: "6b881d06412be466b5f7527fbba12107730583f3739063e63b26a862534fe4e6",
        validationSizeBytes: 1163,
    },
    k2: { ...structural_sidecar_contract_1.CHARACTER_STRUCTURAL_SIDECAR_SOURCE_PIN.k2 },
    k34: {
        contractVersion: "1.0.0",
        profileId: card_scope_contract_1.CARD_SCOPE_SOURCE_PIN.profileId,
        reportSha256: "a34afd7895d40dbdfd085c7c1b5af1304247b4e7476e89bec6c81e17758f638a",
        reportSizeBytes: 7140,
    },
    sqlite: { ...card_scope_contract_1.CARD_SCOPE_SOURCE_PIN.sqlite },
    db1: { ...card_scope_contract_1.CARD_SCOPE_SOURCE_PIN.db1 },
    elf: { ...card_scope_contract_1.CARD_SCOPE_SOURCE_PIN.elf },
    nativeLayout: { ...card_scope_contract_1.CARD_SCOPE_SOURCE_PIN.nativeLayout },
    expected: {
        cardCount: 5759,
        characterClassIncludedCardCount: 5759,
        categoryIncludedCardCount: 5729,
        categoryUnknownCardCount: 30,
        categoryAssignmentCount: 54072,
        linkIncludedCardCount: 5620,
        linkUnknownCardCount: 139,
        linkEntryCount: 34018,
    },
    release: {
        payloadSha256: "7e5c9fa501c8401489e8e6c0a057b1ecf01037d7969091ed88c0df73547f19e8",
        payloadSizeBytes: 247261,
        rawSha256: "c740d4874118c65f94588594f6b745146c506dd78a73fd605bbf40abf28d168a",
        rawSizeBytes: 4228101,
        coverageSha256: "e734cd83c3bcecbc978caac50f5e49f4914a060bf486d9752177c853e4b269ec",
        coverageSizeBytes: 1492,
        validationSha256: "e4719f02dc9f30ae90a97212ef7a5e1d94218e8299311f148b8422caa5fe4664",
        validationSizeBytes: 1424,
        manifestSha256: "a157c322f6d246c817e2af998ef908f17b39978282ced9ccda5a304d6298445c",
        manifestSizeBytes: 3558,
    },
};
//# sourceMappingURL=taxonomy-projection-contract.js.map