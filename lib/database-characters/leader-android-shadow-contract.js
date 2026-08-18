"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CHARACTER_LEADER_ANDROID_SHADOW_SOURCE_PIN = exports.CHARACTER_LEADER_ANDROID_SHADOW_ACCEPTED_PROVENANCE_PIN_SHA256 = exports.CHARACTER_LEADER_ANDROID_SHADOW_FILES = exports.CHARACTER_LEADER_ANDROID_SHADOW_RSS_LIMIT_BYTES = exports.CHARACTER_LEADER_ANDROID_SHADOW_METADATA_LIMIT_BYTES = exports.CHARACTER_LEADER_ANDROID_SHADOW_MANIFEST_LIMIT_BYTES = exports.CHARACTER_LEADER_ANDROID_SHADOW_GZIP_LIMIT_BYTES = exports.CHARACTER_LEADER_ANDROID_SHADOW_RAW_LIMIT_BYTES = exports.CHARACTER_LEADER_ANDROID_SHADOW_CONTRACT_VERSION = void 0;
exports.CHARACTER_LEADER_ANDROID_SHADOW_CONTRACT_VERSION = "1.0.0";
exports.CHARACTER_LEADER_ANDROID_SHADOW_RAW_LIMIT_BYTES = 8 * 1024 * 1024;
exports.CHARACTER_LEADER_ANDROID_SHADOW_GZIP_LIMIT_BYTES = 2 * 1024 * 1024;
exports.CHARACTER_LEADER_ANDROID_SHADOW_MANIFEST_LIMIT_BYTES = 64 * 1024;
exports.CHARACTER_LEADER_ANDROID_SHADOW_METADATA_LIMIT_BYTES = 256 * 1024;
exports.CHARACTER_LEADER_ANDROID_SHADOW_RSS_LIMIT_BYTES = 1024 * 1024 * 1024;
exports.CHARACTER_LEADER_ANDROID_SHADOW_FILES = {
    manifest: "leader-shadow-manifest.json",
    validation: "database-characters-k64-leader-android-shadow-validation.json",
    provenancePin: "database-characters-k64-leader-android-shadow-provenance-pin.json",
};
exports.CHARACTER_LEADER_ANDROID_SHADOW_ACCEPTED_PROVENANCE_PIN_SHA256 = "88a62688150ece1f06bc91bfd2832c78780e392be7622cfe560bf1a9148d4e8d";
exports.CHARACTER_LEADER_ANDROID_SHADOW_SOURCE_PIN = {
    k56: {
        fullArtifactFingerprintSha256: "807a98ae37cd17a68a7f3f3544c1f14b4f4bfab9f75c9b627cca23cbab41e3b3",
        lineageFingerprintSha256: "132c1e858ed5fdb6bdc97f3c5e0313c865c7bf0ee7367e1ad1453b89e280fa5f",
    },
    k60: {
        publicationReceiptSha256: "d56dd4bdb6a46570d687709acc687ae67a270908c1666c3f495e5ca29b901a68",
    },
    k62_1: {
        compatibilityAuditSha256: "1ba112d7b4e08ceebeb590976b8d1b7c1d726064cba094ef050db237aadaef4f",
    },
    android: {
        repositoryUrl: "https://github.com/lucascoelh0/Dokkanpanion.git",
        commit: "f148a66d9911c2667caafd47bbd522b5fe00c4e6",
        files: [
            {
                path: "domain/src/main/java/com/luminay/domain/leadershadow/LeaderShadowModels.kt",
                blobId: "4205062ae01667aff812b484a06c77b7f2f70954",
                sizeBytes: 4802,
                sha256: "56b44edf8883d78963effac2e7d80c616fcaeb1fda942b708da0476235180fa8",
            },
            {
                path: "domain/src/main/java/com/luminay/domain/leadershadow/LeaderShadowLoader.kt",
                blobId: "a8198edc7d05044100e13b2e7ab45e7da0e4a833",
                sizeBytes: 32275,
                sha256: "14016508974d223e168bcb2290c0bdef459821e0681894be22667cf11fa61d39",
            },
            {
                path: "domain/src/main/java/com/luminay/domain/leadershadow/LeaderShadowRepository.kt",
                blobId: "f5e54d54f7d8c8d5c1c58e3f61f607474373f985",
                sizeBytes: 1608,
                sha256: "088ca40a60f02bc53d4aa1afb92aa10a26bb0295e2c937a95fa905bc8f3dccba",
            },
        ],
    },
    output: {
        recordCount: 7248,
        occurrenceCount: 12265,
        filterCount: 31478,
        scopeFilterCounts: { team: 11971, superClass: 161, extremeClass: 133 },
        categoryFilterCounts: { include: 9736, exclude: 6250 },
        emptyIdentityFilterCount: 3227,
        percentageOccurrenceCount: 12253,
        flatOccurrenceCount: 12,
    },
};
//# sourceMappingURL=leader-android-shadow-contract.js.map