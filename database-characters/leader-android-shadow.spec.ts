import { strict as assert } from "assert";
import { createHash } from "crypto";
import { gunzipSync } from "zlib";
import type { CharacterLeaderSupportedProjectionRecord } from "./leader-supported-projection-contract";
import type { CharacterLeaderCompatibilityAndroidSourceIdentity } from "./leader-supported-compatibility-git-source";
import {
    assertCharacterLeaderAndroidShadowArtifactBytes,
    buildCharacterLeaderAndroidShadowDataset,
    materializeCharacterLeaderAndroidShadow,
} from "./leader-android-shadow";
import type {
    CharacterLeaderAndroidShadowDataset,
    CharacterLeaderAndroidShadowProvenance,
} from "./leader-android-shadow-contract";

const sha256 = (value: Buffer | string): string => createHash("sha256").update(value).digest("hex");

function provenance(): CharacterLeaderAndroidShadowProvenance {
    return {
        sourceContract: "dokkan-database-character-leader-supported-only-projection",
        sourceContractVersion: "1.0.0",
        sourceCheckpoint: "K62.1",
        sourceArtifactSha256: "1".repeat(64),
        sourceLineageSha256: "2".repeat(64),
        sourceReceiptSha256: "3".repeat(64),
    };
}

function androidSource(): CharacterLeaderCompatibilityAndroidSourceIdentity {
    const body = {
        repositoryUrl: "https://example.invalid/synthetic.git",
        commit: "a".repeat(40),
        access: "git_object_database_only" as const,
        checkoutBytesRead: false as const,
        files: [{ path: "synthetic/LeaderShadowLoader.kt", blobId: "b".repeat(40), sizeBytes: 123, sha256: "c".repeat(64) }],
    };
    return { ...body, fingerprintSha256: sha256(JSON.stringify(body)) };
}

function sourceRecord(
    values: Partial<CharacterLeaderSupportedProjectionRecord> = {},
): CharacterLeaderSupportedProjectionRecord {
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

function syntheticRecords(): CharacterLeaderSupportedProjectionRecord[] {
    return [
        sourceRecord(),
        sourceRecord({
            effectRowId: "effect-2",
            sourceEffectOccurrenceIndex: 2,
            selector: { kind: "structural_mask", mask: 11 },
            commonModifier: 3_000,
            calculation: { kind: "flat_points", value: 3_000, integerConversion: "at_handler" },
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

function clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
}

describe("K64 Android Leader shadow producer", () => {
    it("maps synthetic K56 records losslessly into the exact ordered Android wire shape", () => {
        const dataset = buildCharacterLeaderAndroidShadowDataset(syntheticRecords(), provenance());

        assert.equal(dataset.recordCount, 2);
        assert.equal(dataset.occurrenceCount, 3);
        assert.equal(dataset.filterCount, 8);
        assert.deepEqual(dataset.records.map(record => record.stateId), ["state-1", "state-2"]);
        assert.deepEqual(dataset.records[0].occurrences.map(value => value.occurrenceId), [
            "occurrence:state-1:0", "occurrence:state-1:2",
        ]);
        assert.equal(dataset.records[0].occurrences[0].operation.kind, "PERCENTAGE");
        assert.equal(dataset.records[0].occurrences[1].operation.kind, "FLAT_POINTS");
        assert.deepEqual(dataset.records[0].occurrences[0].operation.stats.map(value => value.value), [170, 170, 170]);
        assert.deepEqual(dataset.records[0].occurrences[0].filters.map(value => [value.type, value.valueId]), [
            ["TARGET_TEAM", "team-allies"],
            ["CATEGORY_INCLUDE", "category-7"],
            ["CATEGORY_INCLUDE", "category-7"],
            ["CATEGORY_EXCLUDE", "category-9"],
        ]);
        assert.deepEqual(dataset.records[0].occurrences[1].filters.map(value => [value.type, value.valueId]), [
            ["TARGET_SUPER_CLASS", "super-class-allies"],
            ["EMPTY_IDENTITY", null],
        ]);
        assert.equal(dataset.runtimeUnknowns.finalRoundingUnknown, true);
        assert.equal(dataset.semantics.duplicateFiltersPreservedAndReapplied, true);
    });

    it("materializes deterministically with Android-compatible gzip manifest and an external pin candidate", () => {
        const dataset = buildCharacterLeaderAndroidShadowDataset(syntheticRecords(), provenance());
        const first = materializeCharacterLeaderAndroidShadow(dataset, androidSource());
        const second = materializeCharacterLeaderAndroidShadow(dataset, androidSource());

        for (const key of ["raw", "gzip", "manifestBytes", "provenancePinBytes", "validationBytes"] as const) {
            assert.equal(first[key].equals(second[key]), true, key);
        }
        assert.equal(gunzipSync(first.gzip).equals(first.raw), true);
        assert.equal(first.manifest.sha256, sha256(first.gzip));
        assert.equal(first.manifest.uncompressedSha256, sha256(first.raw));
        assert.equal(first.manifest.fileName, `leader-shadow.${first.manifest.sha256}.json.gz`);
        assert.equal(first.provenancePin.manifestSha256, sha256(first.manifestBytes));
        assert.deepEqual(first.provenancePin.provenance, dataset.provenance);
        assert.equal(first.provenancePin.policy.artifactCannotSelfAuthorize, true);
        assert.equal(first.validation.valid, true);
        assert.equal(first.validation.readiness.offlineProducer, "NOT_EXECUTED");
    });

    it("rejects source records that would become lossy or violate Android limits", () => {
        assert.throws(() => buildCharacterLeaderAndroidShadowDataset([
            sourceRecord({ commonModifier: 170, calculation: { kind: "flat_points", value: 171, integerConversion: "at_handler" } }),
        ], provenance()), /cannot be represented losslessly/);
        assert.throws(() => buildCharacterLeaderAndroidShadowDataset([
            sourceRecord(),
            sourceRecord({ stateId: "state-2", sourceStateKey: "source-state-2" }),
            sourceRecord({ effectRowId: "effect-4", sourceEffectOccurrenceIndex: 3 }),
        ], provenance()), /non-contiguous/);
        assert.throws(() => buildCharacterLeaderAndroidShadowDataset([
            sourceRecord({ stateId: "bad id" }),
        ], provenance()), /cannot be represented/);
        const badFilter = sourceRecord();
        badFilter.targetFilters[1].sourceTargetOccurrenceIndex = 7;
        assert.throws(() => buildCharacterLeaderAndroidShadowDataset([badFilter], provenance()), /filter cannot be represented/);
    });

    it("fails closed when wire semantics, canonical bytes, hashes or the external pin drift", () => {
        const original = materializeCharacterLeaderAndroidShadow(
            buildCharacterLeaderAndroidShadowDataset(syntheticRecords(), provenance()),
            androidSource(),
        );
        const semantics = clone(original.dataset);
        semantics.runtimeUnknowns.finalRoundingUnknown = false as true;
        assert.throws(() => materializeCharacterLeaderAndroidShadow(semantics, androidSource()), /unknown or semantics/);

        const rawDrift = { ...original, raw: Buffer.concat([original.raw, Buffer.from(" ")]) };
        const expectedPin = sha256(original.provenancePinBytes);
        assert.throws(() => assertCharacterLeaderAndroidShadowArtifactBytes(rawDrift, expectedPin), /canonical object\/bytes mismatch/);
        const pinDrift = {
            ...original,
            provenancePin: { ...original.provenancePin, payloadSha256: "f".repeat(64) },
            provenancePinBytes: Buffer.from(JSON.stringify({ ...original.provenancePin, payloadSha256: "f".repeat(64) })),
        };
        assert.throws(() => assertCharacterLeaderAndroidShadowArtifactBytes(pinDrift, expectedPin), /external provenance pin identity rejected/);

        const foreignDataset = clone(original.dataset);
        foreignDataset.provenance.sourceReceiptSha256 = "9".repeat(64);
        const foreign = materializeCharacterLeaderAndroidShadow(foreignDataset, androidSource());
        assert.throws(
            () => assertCharacterLeaderAndroidShadowArtifactBytes(foreign, expectedPin),
            /external provenance pin identity rejected/,
        );

        const falseSizes = {
            ...original,
            validation: {
                ...original.validation,
                sizes: { ...original.validation.sizes, rawSizeBytes: original.validation.sizes.rawSizeBytes - 1 },
            },
        };
        falseSizes.validationBytes = Buffer.from(JSON.stringify(falseSizes.validation));
        assert.throws(
            () => assertCharacterLeaderAndroidShadowArtifactBytes(falseSizes, expectedPin),
            /observed artifact sizes rejected/,
        );
    });

    it("does not expose effective values, authority, network, R2 or runtime consumption", () => {
        const artifacts = materializeCharacterLeaderAndroidShadow(
            buildCharacterLeaderAndroidShadowDataset(syntheticRecords(), provenance()),
            androidSource(),
        );
        const serialized = JSON.stringify(artifacts.dataset);
        assert.equal(/receivedBoost|offeredBoost|finalValue|combatCalculation/i.test(serialized), false);
        assert.equal(artifacts.dataset.runtimeUnknowns.leaderFriendCompositionUnknown, true);
        assert.equal(artifacts.validation.readiness.authority, "NO-GO");
        assert.equal(artifacts.validation.readiness.production, "NO-GO");
        assert.equal(artifacts.validation.readiness.network, "NO-GO");
        assert.equal(artifacts.validation.readiness.r2, "NO-GO");
        assert.equal(artifacts.validation.readiness.androidRuntimeConsumption, "NO-GO");
    });
});
