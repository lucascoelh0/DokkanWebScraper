"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const crypto_1 = require("crypto");
const zlib_1 = require("zlib");
const leader_android_shadow_1 = require("./leader-android-shadow");
const sha256 = (value) => (0, crypto_1.createHash)("sha256").update(value).digest("hex");
function provenance() {
    return {
        sourceContract: "dokkan-database-character-leader-supported-only-projection",
        sourceContractVersion: "1.0.0",
        sourceCheckpoint: "K62.1",
        sourceArtifactSha256: "1".repeat(64),
        sourceLineageSha256: "2".repeat(64),
        sourceReceiptSha256: "3".repeat(64),
    };
}
function androidSource() {
    const body = {
        repositoryUrl: "https://example.invalid/synthetic.git",
        commit: "a".repeat(40),
        access: "git_object_database_only",
        checkoutBytesRead: false,
        files: [{ path: "synthetic/LeaderShadowLoader.kt", blobId: "b".repeat(40), sizeBytes: 123, sha256: "c".repeat(64) }],
    };
    return { ...body, fingerprintSha256: sha256(JSON.stringify(body)) };
}
function sourceRecord(values = {}) {
    return {
        stateId: "state-1",
        sourceStateKey: "source-state-1",
        cardId: "card-1",
        releaseState: "initial",
        leaderSetRowId: "leader-set-1",
        effectRowId: "effect-1",
        sourceEffectOccurrenceIndex: 0,
        selector: { kind: "structural_mask", mask: 7 },
        commonModifier: 170,
        stats: ["hp", "atk", "def"],
        calculation: { kind: "proportional_percent_divided_by_100", numerator: 170, divisor: 100 },
        targetScope: "team_allies",
        targetFilters: [
            { sourceTargetOccurrenceIndex: 0, operation: "include", selector: "card_category_id", categoryId: "category-7" },
            { sourceTargetOccurrenceIndex: 1, operation: "include", selector: "card_category_id", categoryId: "category-7" },
            { sourceTargetOccurrenceIndex: 2, operation: "exclude", selector: "card_category_id", categoryId: "category-9" },
        ],
        targetFilterComposition: {
            operator: "and_sequential",
            emptyBehavior: "identity",
            duplicateBehavior: "preserved_and_reapplied",
        },
        ...values,
    };
}
function syntheticRecords() {
    return [
        sourceRecord(),
        sourceRecord({
            effectRowId: "effect-2",
            sourceEffectOccurrenceIndex: 2,
            selector: { kind: "structural_mask", mask: 11 },
            commonModifier: 3000,
            calculation: { kind: "flat_points", value: 3000, integerConversion: "at_handler" },
            targetScope: "super_class_allies",
            targetFilters: [],
        }),
        sourceRecord({
            stateId: "state-2",
            sourceStateKey: "source-state-2",
            cardId: "card-2",
            releaseState: "eza",
            leaderSetRowId: "leader-set-2",
            effectRowId: "effect-3",
            sourceEffectOccurrenceIndex: 0,
            commonModifier: 150,
            calculation: { kind: "proportional_percent_divided_by_100", numerator: 150, divisor: 100 },
            targetScope: "extreme_class_allies",
            targetFilters: [
                { sourceTargetOccurrenceIndex: 0, operation: "exclude", selector: "card_category_id", categoryId: "category-4" },
            ],
        }),
    ];
}
function clone(value) {
    return JSON.parse(JSON.stringify(value));
}
describe("K64 Android Leader shadow producer", () => {
    it("maps synthetic K56 records losslessly into the exact ordered Android wire shape", () => {
        const dataset = (0, leader_android_shadow_1.buildCharacterLeaderAndroidShadowDataset)(syntheticRecords(), provenance());
        assert_1.strict.equal(dataset.recordCount, 2);
        assert_1.strict.equal(dataset.occurrenceCount, 3);
        assert_1.strict.equal(dataset.filterCount, 8);
        assert_1.strict.deepEqual(dataset.records.map(record => record.stateId), ["state-1", "state-2"]);
        assert_1.strict.deepEqual(dataset.records[0].occurrences.map(value => value.occurrenceId), [
            "occurrence:state-1:0", "occurrence:state-1:2",
        ]);
        assert_1.strict.equal(dataset.records[0].occurrences[0].operation.kind, "PERCENTAGE");
        assert_1.strict.equal(dataset.records[0].occurrences[1].operation.kind, "FLAT_POINTS");
        assert_1.strict.deepEqual(dataset.records[0].occurrences[0].operation.stats.map(value => value.value), [170, 170, 170]);
        assert_1.strict.deepEqual(dataset.records[0].occurrences[0].filters.map(value => [value.type, value.valueId]), [
            ["TARGET_TEAM", "team-allies"],
            ["CATEGORY_INCLUDE", "category-7"],
            ["CATEGORY_INCLUDE", "category-7"],
            ["CATEGORY_EXCLUDE", "category-9"],
        ]);
        assert_1.strict.deepEqual(dataset.records[0].occurrences[1].filters.map(value => [value.type, value.valueId]), [
            ["TARGET_SUPER_CLASS", "super-class-allies"],
            ["EMPTY_IDENTITY", null],
        ]);
        assert_1.strict.equal(dataset.runtimeUnknowns.finalRoundingUnknown, true);
        assert_1.strict.equal(dataset.semantics.duplicateFiltersPreservedAndReapplied, true);
    });
    it("materializes deterministically with Android-compatible gzip manifest and an external pin candidate", () => {
        const dataset = (0, leader_android_shadow_1.buildCharacterLeaderAndroidShadowDataset)(syntheticRecords(), provenance());
        const first = (0, leader_android_shadow_1.materializeCharacterLeaderAndroidShadow)(dataset, androidSource());
        const second = (0, leader_android_shadow_1.materializeCharacterLeaderAndroidShadow)(dataset, androidSource());
        for (const key of ["raw", "gzip", "manifestBytes", "provenancePinBytes", "validationBytes"]) {
            assert_1.strict.equal(first[key].equals(second[key]), true, key);
        }
        assert_1.strict.equal((0, zlib_1.gunzipSync)(first.gzip).equals(first.raw), true);
        assert_1.strict.equal(first.manifest.sha256, sha256(first.gzip));
        assert_1.strict.equal(first.manifest.uncompressedSha256, sha256(first.raw));
        assert_1.strict.equal(first.manifest.fileName, `leader-shadow.${first.manifest.sha256}.json.gz`);
        assert_1.strict.equal(first.provenancePin.manifestSha256, sha256(first.manifestBytes));
        assert_1.strict.deepEqual(first.provenancePin.provenance, dataset.provenance);
        assert_1.strict.equal(first.provenancePin.policy.artifactCannotSelfAuthorize, true);
        assert_1.strict.equal(first.validation.valid, true);
        assert_1.strict.equal(first.validation.readiness.offlineProducer, "NOT_EXECUTED");
    });
    it("rejects source records that would become lossy or violate Android limits", () => {
        assert_1.strict.throws(() => (0, leader_android_shadow_1.buildCharacterLeaderAndroidShadowDataset)([
            sourceRecord({ commonModifier: 170, calculation: { kind: "flat_points", value: 171, integerConversion: "at_handler" } }),
        ], provenance()), /cannot be represented losslessly/);
        assert_1.strict.throws(() => (0, leader_android_shadow_1.buildCharacterLeaderAndroidShadowDataset)([
            sourceRecord(),
            sourceRecord({ stateId: "state-2", sourceStateKey: "source-state-2" }),
            sourceRecord({ effectRowId: "effect-4", sourceEffectOccurrenceIndex: 3 }),
        ], provenance()), /non-contiguous/);
        assert_1.strict.throws(() => (0, leader_android_shadow_1.buildCharacterLeaderAndroidShadowDataset)([
            sourceRecord({ stateId: "bad id" }),
        ], provenance()), /cannot be represented/);
        const badFilter = sourceRecord();
        badFilter.targetFilters[1].sourceTargetOccurrenceIndex = 7;
        assert_1.strict.throws(() => (0, leader_android_shadow_1.buildCharacterLeaderAndroidShadowDataset)([badFilter], provenance()), /filter cannot be represented/);
    });
    it("fails closed when wire semantics, canonical bytes, hashes or the external pin drift", () => {
        const original = (0, leader_android_shadow_1.materializeCharacterLeaderAndroidShadow)((0, leader_android_shadow_1.buildCharacterLeaderAndroidShadowDataset)(syntheticRecords(), provenance()), androidSource());
        const semantics = clone(original.dataset);
        semantics.runtimeUnknowns.finalRoundingUnknown = false;
        assert_1.strict.throws(() => (0, leader_android_shadow_1.materializeCharacterLeaderAndroidShadow)(semantics, androidSource()), /unknown or semantics/);
        const rawDrift = { ...original, raw: Buffer.concat([original.raw, Buffer.from(" ")]) };
        const expectedPin = sha256(original.provenancePinBytes);
        assert_1.strict.throws(() => (0, leader_android_shadow_1.assertCharacterLeaderAndroidShadowArtifactBytes)(rawDrift, expectedPin), /canonical object\/bytes mismatch/);
        const pinDrift = {
            ...original,
            provenancePin: { ...original.provenancePin, payloadSha256: "f".repeat(64) },
            provenancePinBytes: Buffer.from(JSON.stringify({ ...original.provenancePin, payloadSha256: "f".repeat(64) })),
        };
        assert_1.strict.throws(() => (0, leader_android_shadow_1.assertCharacterLeaderAndroidShadowArtifactBytes)(pinDrift, expectedPin), /external provenance pin identity rejected/);
        const foreignDataset = clone(original.dataset);
        foreignDataset.provenance.sourceReceiptSha256 = "9".repeat(64);
        const foreign = (0, leader_android_shadow_1.materializeCharacterLeaderAndroidShadow)(foreignDataset, androidSource());
        assert_1.strict.throws(() => (0, leader_android_shadow_1.assertCharacterLeaderAndroidShadowArtifactBytes)(foreign, expectedPin), /external provenance pin identity rejected/);
        const falseSizes = {
            ...original,
            validation: {
                ...original.validation,
                sizes: { ...original.validation.sizes, rawSizeBytes: original.validation.sizes.rawSizeBytes - 1 },
            },
        };
        falseSizes.validationBytes = Buffer.from(JSON.stringify(falseSizes.validation));
        assert_1.strict.throws(() => (0, leader_android_shadow_1.assertCharacterLeaderAndroidShadowArtifactBytes)(falseSizes, expectedPin), /observed artifact sizes rejected/);
    });
    it("does not expose effective values, authority, network, R2 or runtime consumption", () => {
        const artifacts = (0, leader_android_shadow_1.materializeCharacterLeaderAndroidShadow)((0, leader_android_shadow_1.buildCharacterLeaderAndroidShadowDataset)(syntheticRecords(), provenance()), androidSource());
        const serialized = JSON.stringify(artifacts.dataset);
        assert_1.strict.equal(/receivedBoost|offeredBoost|finalValue|combatCalculation/i.test(serialized), false);
        assert_1.strict.equal(artifacts.dataset.runtimeUnknowns.leaderFriendCompositionUnknown, true);
        assert_1.strict.equal(artifacts.validation.readiness.authority, "NO-GO");
        assert_1.strict.equal(artifacts.validation.readiness.production, "NO-GO");
        assert_1.strict.equal(artifacts.validation.readiness.network, "NO-GO");
        assert_1.strict.equal(artifacts.validation.readiness.r2, "NO-GO");
        assert_1.strict.equal(artifacts.validation.readiness.androidRuntimeConsumption, "NO-GO");
    });
});
//# sourceMappingURL=leader-android-shadow.spec.js.map