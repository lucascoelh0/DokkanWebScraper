"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_PIN = exports.CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_FILES = exports.CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_RSS_LIMIT_BYTES = exports.CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_METADATA_LIMIT_BYTES = exports.CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_GZIP_LIMIT_BYTES = exports.CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_RAW_LIMIT_BYTES = exports.CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_CONTRACT_VERSION = void 0;
exports.CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_CONTRACT_VERSION = "1.2.0";
exports.CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_RAW_LIMIT_BYTES = 4 * 1024 * 1024;
exports.CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_GZIP_LIMIT_BYTES = 1024 * 1024;
exports.CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_METADATA_LIMIT_BYTES = 256 * 1024;
exports.CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_RSS_LIMIT_BYTES = 1024 * 1024 * 1024;
exports.CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_FILES = {
    coverage: "database-characters-k62-leader-supported-compatibility-coverage.json",
    validation: "database-characters-k62-leader-supported-compatibility-validation.json",
    manifest: "database-characters-k62-leader-supported-compatibility-manifest.json",
};
exports.CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_PIN = {
    effects: 3836,
    references: 12265,
    states: 7248,
    cards: 3434,
    publicIndexes: 4,
    excludedEffects: 17,
    excludedReferences: 45,
    publicManifest: {
        sizeBytes: 11561,
        sha256: "370dc7026c4523d509a403a2fbfa91009d1bb9452f7ab277f9c6aaebb8a1441e",
    },
    fullArtifactFingerprintSha256: "807a98ae37cd17a68a7f3f3544c1f14b4f4bfab9f75c9b627cca23cbab41e3b3",
    lineageFingerprintSha256: "132c1e858ed5fdb6bdc97f3c5e0313c865c7bf0ee7367e1ad1453b89e280fa5f",
    productive: {
        sizeBytes: 121390313,
        sha256: "421c8fec6f7ba22e270af19b2278da4fbba19b6299205a54cc3d1ed570319dbc",
        topLevelCount: 4090,
    },
    reports: {
        k57: { sizeBytes: 4291, sha256: "626a35554a48d7d7c55c95452332bfb9b61add8420e5fc14870a43db367e99f4" },
        k59: { sizeBytes: 5951, sha256: "bc8f09d0bc6a75bafe3e77524e0d6e4b838eddd462ac12fb6e7aa95756a9355d" },
        k60: { sizeBytes: 7575, sha256: "ba6a5d86bffc2f7fbfd1076dacff3ec057ec9bd6a1a3fb0abdd8b96d90dfaa29" },
        k60Receipt: { sizeBytes: 1596, sha256: "d56dd4bdb6a46570d687709acc687ae67a270908c1666c3f495e5ca29b901a68" },
        k61: { sizeBytes: 4364, sha256: "4b2a5ed42ab5cf4d73cb40d5a40818a19e3eeab6daef01ab5755cf700bd71838" },
    },
};
//# sourceMappingURL=leader-supported-compatibility-contract.js.map