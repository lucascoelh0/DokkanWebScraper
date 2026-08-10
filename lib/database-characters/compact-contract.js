"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CHARACTER_COMPACT_EXPECTATIONS = exports.CHARACTER_COMPACT_GZIP_BUDGET_BYTES = exports.CHARACTER_COMPACT_RAW_BUDGET_BYTES = exports.CHARACTER_COMPACT_POLICY_VERSION = exports.CHARACTER_COMPACT_POLICY_ID = exports.CHARACTER_COMPACT_CONTRACT_VERSION = exports.CHARACTER_COMPACT_SCHEMA_VERSION = void 0;
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
//# sourceMappingURL=compact-contract.js.map