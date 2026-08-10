"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CHARACTER_COMPACT_PINNED_RELEASE = exports.CHARACTER_COMPACT_EXPECTATIONS = exports.CHARACTER_COMPACT_GZIP_BUDGET_BYTES = exports.CHARACTER_COMPACT_RAW_BUDGET_BYTES = exports.CHARACTER_COMPACT_POLICY_VERSION = exports.CHARACTER_COMPACT_POLICY_ID = exports.CHARACTER_COMPACT_CONTRACT_VERSION = exports.CHARACTER_COMPACT_SCHEMA_VERSION = void 0;
exports.CHARACTER_COMPACT_SCHEMA_VERSION = 1;
exports.CHARACTER_COMPACT_CONTRACT_VERSION = "1.0.0";
exports.CHARACTER_COMPACT_POLICY_ID = "database-character-compact-supported-only";
exports.CHARACTER_COMPACT_POLICY_VERSION = "1.0.0";
exports.CHARACTER_COMPACT_RAW_BUDGET_BYTES = 4 * 1024 * 1024;
exports.CHARACTER_COMPACT_GZIP_BUDGET_BYTES = 1024 * 1024;
exports.CHARACTER_COMPACT_EXPECTATIONS = {
    databaseCardCount: 5759,
    recordCount: 4296,
    productionUnjoinableCount: 1463,
    rarityAgreements: 4085,
    rarityRepresentationGains: 211,
    typeAgreements: 4296,
    idAgreements: 4296,
};
/** Exact K15 release authorized for standalone validation and future K15-only consumers. */
exports.CHARACTER_COMPACT_PINNED_RELEASE = {
    manifestFile: "database-characters-k15-manifest.json",
    manifestSha256: "490573185c487306958c272b1c7b3658f0c38643a64b0d5e146b51f35cb73793",
    manifestSizeBytes: 3115,
    payloadFile: "database-characters-k15-compact-supported.803346fc61a7e659ccb8aeea62c273fcdf24ef3d66d3d03564a6fad29627c81f.json.gz",
    payloadSha256: "803346fc61a7e659ccb8aeea62c273fcdf24ef3d66d3d03564a6fad29627c81f",
    payloadSizeBytes: 29902,
    rawSha256: "5866b075e1cfc2d45eacb6e2055dd975b885accc05379423aac3d7d45b1f793a",
    rawSizeBytes: 558190,
    recordCount: 4296,
    coverageFile: "database-characters-k15-coverage.json",
    coverageSha256: "13eb0e44a0010de3a7a708ec9444b284aec0a0b89ab8e938e6ccff7166166d63",
    coverageSizeBytes: 766,
    validationFile: "database-characters-k15-validation.json",
    validationSha256: "3ff2ec37d9dd3f035a5dfa159d78b7917778b936a41a0d045850d66851d046b0",
    validationSizeBytes: 612,
    readinessFile: "database-characters-k15-readiness.json",
    readinessSha256: "a6481aa20445c56bfd1c3a61defd973d3a2f68fe57feca0ba543974776b00748",
    readinessSizeBytes: 771,
};
//# sourceMappingURL=compact-contract.js.map