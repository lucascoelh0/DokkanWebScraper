import { createHash } from "crypto";
import { gunzipSync, gzipSync } from "zlib";
import type {
    CharacterLeaderSupportedProjectionArtifactSet,
    CharacterLeaderSupportedProjectionRecord,
} from "./leader-supported-projection-contract";
import {
    assertExactCharacterLeaderSupportedShadowK56Identity,
    characterLeaderSupportedShadowArtifactFingerprint,
    characterLeaderSupportedShadowLineageFingerprint,
} from "./leader-supported-shadow";
import type { CharacterLeaderCompatibilityAndroidSourceIdentity } from "./leader-supported-compatibility-git-source";
import {
    CHARACTER_LEADER_ANDROID_SHADOW_ACCEPTED_PROVENANCE_PIN_SHA256,
    CHARACTER_LEADER_ANDROID_SHADOW_CONTRACT_VERSION,
    CHARACTER_LEADER_ANDROID_SHADOW_FILES,
    CHARACTER_LEADER_ANDROID_SHADOW_GZIP_LIMIT_BYTES,
    CHARACTER_LEADER_ANDROID_SHADOW_MANIFEST_LIMIT_BYTES,
    CHARACTER_LEADER_ANDROID_SHADOW_METADATA_LIMIT_BYTES,
    CHARACTER_LEADER_ANDROID_SHADOW_RAW_LIMIT_BYTES,
    CHARACTER_LEADER_ANDROID_SHADOW_SOURCE_PIN,
    CharacterLeaderAndroidShadowArtifactSet,
    CharacterLeaderAndroidShadowDataset,
    CharacterLeaderAndroidShadowFilter,
    CharacterLeaderAndroidShadowFilterType,
    CharacterLeaderAndroidShadowManifest,
    CharacterLeaderAndroidShadowProvenance,
    CharacterLeaderAndroidShadowProvenancePin,
    CharacterLeaderAndroidShadowRecord,
    CharacterLeaderAndroidShadowValidation,
} from "./leader-android-shadow-contract";

const SHA_256 = /^[a-f0-9]{64}$/;
const ANDROID_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const STRUCTURAL_MASK = /^-?[0-9]+$/;
const MAX_ANDROID_ID_LENGTH = 160;
const MAX_ANDROID_STRING_LENGTH = 512;
const MAX_ANDROID_ABSOLUTE_VALUE = 1_000_000;

const hash = (bytes: Buffer | string): string => createHash("sha256").update(bytes).digest("hex");
const json = (value: unknown): string => JSON.stringify(value);
const jsonBytes = (value: unknown): Buffer => Buffer.from(json(value), "utf8");

function exactKeys(value: unknown, keys: readonly string[]): boolean {
    return !!value && typeof value === "object" && !Array.isArray(value)
        && json(Object.keys(value as Record<string, unknown>).sort()) === json([...keys].sort());
}

function validId(value: unknown): value is string {
    return typeof value === "string" && value.length <= MAX_ANDROID_ID_LENGTH && ANDROID_ID.test(value);
}

function validInteger(value: unknown): value is number {
    return Number.isSafeInteger(value) && Math.abs(value as number) <= MAX_ANDROID_ABSOLUTE_VALUE;
}

function assertSourceRecord(record: CharacterLeaderSupportedProjectionRecord): void {
    if (!validId(record.stateId) || !validId(record.sourceStateKey) || !validId(record.cardId)
        || !validId(record.leaderSetRowId) || !validId(record.effectRowId)
        || !["initial", "eza", "seza"].includes(record.releaseState)
        || !Number.isSafeInteger(record.sourceEffectOccurrenceIndex) || record.sourceEffectOccurrenceIndex < 0
        || record.selector.kind !== "structural_mask" || !Number.isSafeInteger(record.selector.mask)
        || !validInteger(record.commonModifier) || json(record.stats) !== json(["hp", "atk", "def"])
        || !["team_allies", "super_class_allies", "extreme_class_allies"].includes(record.targetScope)
        || record.targetFilterComposition.operator !== "and_sequential"
        || record.targetFilterComposition.emptyBehavior !== "identity"
        || record.targetFilterComposition.duplicateBehavior !== "preserved_and_reapplied") {
        throw new Error("K64 source record cannot be represented by the Android shadow contract");
    }
    const calculationValue = record.calculation.kind === "flat_points"
        ? record.calculation.value
        : record.calculation.numerator;
    if (!validInteger(calculationValue) || calculationValue !== record.commonModifier
        || record.calculation.kind === "flat_points" && record.calculation.integerConversion !== "at_handler"
        || record.calculation.kind === "proportional_percent_divided_by_100" && record.calculation.divisor !== 100) {
        throw new Error("K64 source operation cannot be represented losslessly");
    }
    record.targetFilters.forEach((filter, index) => {
        if (filter.sourceTargetOccurrenceIndex !== index || !["include", "exclude"].includes(filter.operation)
            || filter.selector !== "card_category_id" || !validId(filter.categoryId)) {
            throw new Error("K64 source filter cannot be represented losslessly");
        }
    });
}

function expectedProvenance(): CharacterLeaderAndroidShadowProvenance {
    return {
        sourceContract: "dokkan-database-character-leader-supported-only-projection",
        sourceContractVersion: "1.0.0",
        sourceCheckpoint: "K62.1",
        sourceArtifactSha256: CHARACTER_LEADER_ANDROID_SHADOW_SOURCE_PIN.k56.fullArtifactFingerprintSha256,
        sourceLineageSha256: CHARACTER_LEADER_ANDROID_SHADOW_SOURCE_PIN.k56.lineageFingerprintSha256,
        sourceReceiptSha256: CHARACTER_LEADER_ANDROID_SHADOW_SOURCE_PIN.k60.publicationReceiptSha256,
    };
}

function scopeFilter(
    record: CharacterLeaderSupportedProjectionRecord,
    occurrenceIndex: number,
    filterIndex: number,
): CharacterLeaderAndroidShadowFilter {
    const values = {
        team_allies: ["TARGET_TEAM", "team-allies"],
        super_class_allies: ["TARGET_SUPER_CLASS", "super-class-allies"],
        extreme_class_allies: ["TARGET_EXTREME_CLASS", "extreme-class-allies"],
    } as const;
    const [type, valueId] = values[record.targetScope];
    return { filterIndex, filterId: `scope:${occurrenceIndex}`, type, valueId };
}

export function buildCharacterLeaderAndroidShadowDataset(
    sourceRecords: readonly CharacterLeaderSupportedProjectionRecord[],
    provenance: CharacterLeaderAndroidShadowProvenance,
): CharacterLeaderAndroidShadowDataset {
    const records: CharacterLeaderAndroidShadowRecord[] = [];
    const closedStateIds = new Set<string>();
    let current: CharacterLeaderAndroidShadowRecord | undefined;
    let occurrenceIndex = 0;
    let filterIndex = 0;
    for (const source of sourceRecords) {
        assertSourceRecord(source);
        if (!current || current.stateId !== source.stateId) {
            if (current) closedStateIds.add(current.stateId);
            if (closedStateIds.has(source.stateId)) throw new Error("K64 source state order is non-contiguous");
            current = {
                recordIndex: records.length,
                stateId: source.stateId,
                sourceStateKey: source.sourceStateKey,
                cardId: source.cardId,
                releaseState: source.releaseState.toUpperCase() as CharacterLeaderAndroidShadowRecord["releaseState"],
                leaderSetId: source.leaderSetRowId,
                occurrences: [],
            };
            records.push(current);
        } else if (current.sourceStateKey !== source.sourceStateKey || current.cardId !== source.cardId
            || current.releaseState !== source.releaseState.toUpperCase() || current.leaderSetId !== source.leaderSetRowId) {
            throw new Error("K64 source state identity changed inside its occurrence group");
        }
        const currentOccurrenceIndex = occurrenceIndex++;
        const filters: CharacterLeaderAndroidShadowFilter[] = [scopeFilter(source, currentOccurrenceIndex, filterIndex++)];
        if (source.targetFilters.length === 0) {
            filters.push({
                filterIndex: filterIndex++,
                filterId: `empty:${currentOccurrenceIndex}`,
                type: "EMPTY_IDENTITY",
                valueId: null,
            });
        } else {
            for (const filter of source.targetFilters) {
                filters.push({
                    filterIndex: filterIndex++,
                    filterId: `target:${currentOccurrenceIndex}:${filter.sourceTargetOccurrenceIndex}`,
                    type: filter.operation === "include" ? "CATEGORY_INCLUDE" : "CATEGORY_EXCLUDE",
                    valueId: filter.categoryId,
                });
            }
        }
        const value = source.calculation.kind === "flat_points"
            ? source.calculation.value
            : source.calculation.numerator;
        current.occurrences.push({
            occurrenceIndex: currentOccurrenceIndex,
            occurrenceId: `occurrence:${source.stateId}:${source.sourceEffectOccurrenceIndex}`,
            effectId: source.effectRowId,
            structuralMask: String(source.selector.mask),
            operation: {
                kind: source.calculation.kind === "flat_points" ? "FLAT_POINTS" : "PERCENTAGE",
                commonModifier: source.commonModifier,
                stats: source.stats.map((stat, statIndex) => ({
                    statIndex,
                    stat: stat.toUpperCase() as "HP" | "ATK" | "DEF",
                    value,
                })),
            },
            filters,
        });
    }
    return {
        schemaVersion: 1,
        contract: "dokkan-leader-shadow",
        contractVersion: CHARACTER_LEADER_ANDROID_SHADOW_CONTRACT_VERSION,
        recordCount: records.length,
        occurrenceCount: occurrenceIndex,
        filterCount: filterIndex,
        provenance,
        runtimeUnknowns: {
            lifecycleReevaluationUnknown: true,
            durationUnknown: true,
            removalOutcomeUnknown: true,
            leaderFriendCompositionUnknown: true,
            finalStackingUnknown: true,
            finalRoundingUnknown: true,
            transformationDeathReviveExchangeStandbyUnknown: true,
        },
        semantics: {
            targetFiltersCombinedSequentially: true,
            emptyFilterIdentityIsMatch: true,
            duplicateFiltersPreservedAndReapplied: true,
            recordOrderPreserved: true,
            filterOrderAndMultiplicityPreserved: true,
        },
        records,
    };
}

function inspectDataset(dataset: CharacterLeaderAndroidShadowDataset): CharacterLeaderAndroidShadowValidation["counts"] {
    if (!exactKeys(dataset, [
        "schemaVersion", "contract", "contractVersion", "recordCount", "occurrenceCount", "filterCount",
        "provenance", "runtimeUnknowns", "semantics", "records",
    ]) || dataset.schemaVersion !== 1 || dataset.contract !== "dokkan-leader-shadow"
        || dataset.contractVersion !== CHARACTER_LEADER_ANDROID_SHADOW_CONTRACT_VERSION
        || !Array.isArray(dataset.records)) throw new Error("K64 Android dataset contract rejected");
    if (!exactKeys(dataset.provenance, [
        "sourceContract", "sourceContractVersion", "sourceCheckpoint", "sourceArtifactSha256",
        "sourceLineageSha256", "sourceReceiptSha256",
    ]) || dataset.provenance.sourceContract !== "dokkan-database-character-leader-supported-only-projection"
        || dataset.provenance.sourceContractVersion !== "1.0.0" || dataset.provenance.sourceCheckpoint !== "K62.1"
        || !SHA_256.test(dataset.provenance.sourceArtifactSha256)
        || !SHA_256.test(dataset.provenance.sourceLineageSha256)
        || !SHA_256.test(dataset.provenance.sourceReceiptSha256)) throw new Error("K64 provenance rejected");
    const unknownKeys = [
        "lifecycleReevaluationUnknown", "durationUnknown", "removalOutcomeUnknown", "leaderFriendCompositionUnknown",
        "finalStackingUnknown", "finalRoundingUnknown", "transformationDeathReviveExchangeStandbyUnknown",
    ];
    const semanticsKeys = [
        "targetFiltersCombinedSequentially", "emptyFilterIdentityIsMatch", "duplicateFiltersPreservedAndReapplied",
        "recordOrderPreserved", "filterOrderAndMultiplicityPreserved",
    ];
    if (!exactKeys(dataset.runtimeUnknowns, unknownKeys) || !unknownKeys.every(key => (dataset.runtimeUnknowns as any)[key] === true)
        || !exactKeys(dataset.semantics, semanticsKeys) || !semanticsKeys.every(key => (dataset.semantics as any)[key] === true)) {
        throw new Error("K64 unknown or semantics evidence rejected");
    }

    const filterTypes: Record<CharacterLeaderAndroidShadowFilterType, number> = {
        TARGET_TEAM: 0, TARGET_SUPER_CLASS: 0, TARGET_EXTREME_CLASS: 0,
        CATEGORY_INCLUDE: 0, CATEGORY_EXCLUDE: 0, EMPTY_IDENTITY: 0,
    };
    const operations = { percentage: 0, flatPoints: 0 };
    const stateIds = new Set<string>(), sourceStateKeys = new Set<string>(), occurrenceIds = new Set<string>();
    let occurrences = 0, filters = 0;
    for (let recordIndex = 0; recordIndex < dataset.records.length; recordIndex++) {
        const record = dataset.records[recordIndex];
        if (!exactKeys(record, [
            "recordIndex", "stateId", "sourceStateKey", "cardId", "releaseState", "leaderSetId", "occurrences",
        ]) || record.recordIndex !== recordIndex || !validId(record.stateId) || !validId(record.sourceStateKey)
            || !validId(record.cardId) || !validId(record.leaderSetId)
            || !["INITIAL", "EZA", "SEZA"].includes(record.releaseState) || !Array.isArray(record.occurrences)
            || !stateIds.add(record.stateId) || !sourceStateKeys.add(record.sourceStateKey)) {
            throw new Error("K64 Android state record rejected");
        }
        let priorSourceOccurrence = -1;
        for (const occurrence of record.occurrences) {
            const occurrencePrefix = `occurrence:${record.stateId}:`;
            const sourceOccurrence = occurrence.occurrenceId?.startsWith(occurrencePrefix)
                ? Number(occurrence.occurrenceId.slice(occurrencePrefix.length)) : Number.NaN;
            if (!exactKeys(occurrence, [
                "occurrenceIndex", "occurrenceId", "effectId", "structuralMask", "operation", "filters",
            ]) || occurrence.occurrenceIndex !== occurrences || !validId(occurrence.occurrenceId)
                || !occurrenceIds.add(occurrence.occurrenceId) || !validId(occurrence.effectId)
                || typeof occurrence.structuralMask !== "string" || occurrence.structuralMask.length > MAX_ANDROID_STRING_LENGTH
                || !STRUCTURAL_MASK.test(occurrence.structuralMask) || !Number.isSafeInteger(sourceOccurrence)
                || sourceOccurrence <= priorSourceOccurrence || !Array.isArray(occurrence.filters)) {
                throw new Error("K64 Android occurrence identity/order rejected");
            }
            priorSourceOccurrence = sourceOccurrence;
            const operation = occurrence.operation;
            if (!exactKeys(operation, ["kind", "commonModifier", "stats"]) || !validInteger(operation.commonModifier)
                || !["PERCENTAGE", "FLAT_POINTS"].includes(operation.kind) || !Array.isArray(operation.stats)
                || operation.stats.length !== 3) throw new Error("K64 Android operation rejected");
            if (operation.kind === "PERCENTAGE") operations.percentage++; else operations.flatPoints++;
            const expectedStats = ["HP", "ATK", "DEF"];
            operation.stats.forEach((stat, statIndex) => {
                if (!exactKeys(stat, ["statIndex", "stat", "value"]) || stat.statIndex !== statIndex
                    || stat.stat !== expectedStats[statIndex] || !validInteger(stat.value)
                    || stat.value !== operation.commonModifier) throw new Error("K64 Android ordered stat rejected");
            });
            if (occurrence.filters.length < 2) throw new Error("K64 Android filter identity evidence missing");
            occurrence.filters.forEach((filter, localIndex) => {
                if (!exactKeys(filter, ["filterIndex", "filterId", "type", "valueId"])
                    || filter.filterIndex !== filters || !validId(filter.filterId)
                    || !(filter.type in filterTypes)
                    || (filter.type === "EMPTY_IDENTITY") !== (filter.valueId === null)
                    || filter.valueId !== null && !validId(filter.valueId)) throw new Error("K64 Android filter rejected");
                if (localIndex === 0 && !["TARGET_TEAM", "TARGET_SUPER_CLASS", "TARGET_EXTREME_CLASS"].includes(filter.type)
                    || localIndex > 0 && ["TARGET_TEAM", "TARGET_SUPER_CLASS", "TARGET_EXTREME_CLASS"].includes(filter.type)
                    || filter.type === "EMPTY_IDENTITY" && occurrence.filters.length !== 2
                    || filter.type !== "EMPTY_IDENTITY" && localIndex > 0
                        && !["CATEGORY_INCLUDE", "CATEGORY_EXCLUDE"].includes(filter.type)) {
                    throw new Error("K64 Android sequential filter shape rejected");
                }
                filterTypes[filter.type]++;
                filters++;
            });
            occurrences++;
        }
    }
    if (dataset.recordCount !== dataset.records.length || dataset.occurrenceCount !== occurrences || dataset.filterCount !== filters) {
        throw new Error("K64 Android manifest-level counts rejected");
    }
    return { records: dataset.records.length, occurrences, filters, filterTypes, operations };
}

function exactAndroidSource(identity: CharacterLeaderCompatibilityAndroidSourceIdentity): boolean {
    const pin = CHARACTER_LEADER_ANDROID_SHADOW_SOURCE_PIN.android;
    const { fingerprintSha256, ...body } = identity;
    return identity.repositoryUrl === pin.repositoryUrl && identity.commit === pin.commit
        && identity.access === "git_object_database_only" && identity.checkoutBytesRead === false
        && json(identity.files) === json(pin.files) && fingerprintSha256 === hash(json(body));
}

function buildValidation(
    dataset: CharacterLeaderAndroidShadowDataset,
    manifest: CharacterLeaderAndroidShadowManifest,
    provenancePin: CharacterLeaderAndroidShadowProvenancePin,
    sizes: CharacterLeaderAndroidShadowValidation["sizes"],
    exactRealSource: boolean,
): CharacterLeaderAndroidShadowValidation {
    const failures: string[] = [];
    let counts: CharacterLeaderAndroidShadowValidation["counts"] = {
        records: 0,
        occurrences: 0,
        filters: 0,
        filterTypes: {
            TARGET_TEAM: 0, TARGET_SUPER_CLASS: 0, TARGET_EXTREME_CLASS: 0,
            CATEGORY_INCLUDE: 0, CATEGORY_EXCLUDE: 0, EMPTY_IDENTITY: 0,
        },
        operations: { percentage: 0, flatPoints: 0 },
    };
    try { counts = inspectDataset(dataset); } catch (error) { failures.push((error as Error).message); }
    if (!exactKeys(manifest, [
        "schemaVersion", "contract", "contractVersion", "fileName", "compression", "sha256", "sizeBytes",
        "uncompressedSha256", "uncompressedSizeBytes", "recordCount", "occurrenceCount", "filterCount", "provenance",
    ]) || manifest.schemaVersion !== 1 || manifest.contract !== "dokkan-leader-shadow"
        || manifest.contractVersion !== CHARACTER_LEADER_ANDROID_SHADOW_CONTRACT_VERSION || manifest.compression !== "gzip"
        || !/^leader-shadow\.[a-f0-9]{64}\.json\.gz$/.test(manifest.fileName)
        || manifest.fileName !== `leader-shadow.${manifest.sha256}.json.gz`
        || json(manifest.provenance) !== json(dataset.provenance)
        || manifest.recordCount !== dataset.recordCount || manifest.occurrenceCount !== dataset.occurrenceCount
        || manifest.filterCount !== dataset.filterCount) failures.push("K64 Android manifest rejected");
    if (!exactKeys(provenancePin, [
        "schemaVersion", "contract", "contractVersion", "manifestSha256", "payloadSha256", "provenance",
        "compatibilityAudit", "androidSource", "policy",
    ]) || provenancePin.schemaVersion !== 1 || provenancePin.contract !== "dokkan-leader-shadow-external-provenance-pin"
        || provenancePin.contractVersion !== CHARACTER_LEADER_ANDROID_SHADOW_CONTRACT_VERSION
        || provenancePin.payloadSha256 !== manifest.sha256 || json(provenancePin.provenance) !== json(dataset.provenance)
        || !exactKeys(provenancePin.compatibilityAudit, ["checkpoint", "reportSha256", "decision"])
        || provenancePin.compatibilityAudit.checkpoint !== "K62.1"
        || provenancePin.compatibilityAudit.reportSha256 !== CHARACTER_LEADER_ANDROID_SHADOW_SOURCE_PIN.k62_1.compatibilityAuditSha256
        || provenancePin.compatibilityAudit.decision !== "K63_ADDITIVE_DESIGN_GO"
        || !exactKeys(provenancePin.policy, [
            "distributeOutOfBandFromArtifact", "artifactCannotSelfAuthorize", "authoritySelected", "productionEnabled",
        ]) || provenancePin.policy.distributeOutOfBandFromArtifact !== true
        || provenancePin.policy.artifactCannotSelfAuthorize !== true || provenancePin.policy.authoritySelected !== false
        || provenancePin.policy.productionEnabled !== false) failures.push("K64 external provenance pin rejected");
    if (sizes.rawSizeBytes <= 0 || sizes.rawSizeBytes >= CHARACTER_LEADER_ANDROID_SHADOW_RAW_LIMIT_BYTES) failures.push("K64 raw byte budget reached");
    if (sizes.gzipSizeBytes <= 0 || sizes.gzipSizeBytes >= CHARACTER_LEADER_ANDROID_SHADOW_GZIP_LIMIT_BYTES) failures.push("K64 gzip byte budget reached");
    if (sizes.manifestSizeBytes <= 0 || sizes.manifestSizeBytes >= CHARACTER_LEADER_ANDROID_SHADOW_MANIFEST_LIMIT_BYTES) failures.push("K64 manifest byte budget reached");
    if (sizes.manifestSizeBytes + sizes.provenancePinSizeBytes >= CHARACTER_LEADER_ANDROID_SHADOW_METADATA_LIMIT_BYTES) {
        failures.push("K64 metadata byte budget reached");
    }
    if (exactRealSource) {
        const output = CHARACTER_LEADER_ANDROID_SHADOW_SOURCE_PIN.output;
        if (json(dataset.provenance) !== json(expectedProvenance()) || !exactAndroidSource(provenancePin.androidSource)
            || counts.records !== output.recordCount || counts.occurrences !== output.occurrenceCount || counts.filters !== output.filterCount
            || counts.filterTypes.TARGET_TEAM !== output.scopeFilterCounts.team
            || counts.filterTypes.TARGET_SUPER_CLASS !== output.scopeFilterCounts.superClass
            || counts.filterTypes.TARGET_EXTREME_CLASS !== output.scopeFilterCounts.extremeClass
            || counts.filterTypes.CATEGORY_INCLUDE !== output.categoryFilterCounts.include
            || counts.filterTypes.CATEGORY_EXCLUDE !== output.categoryFilterCounts.exclude
            || counts.filterTypes.EMPTY_IDENTITY !== output.emptyIdentityFilterCount
            || counts.operations.percentage !== output.percentageOccurrenceCount
            || counts.operations.flatPoints !== output.flatOccurrenceCount) failures.push("K64 exact real corpus or source identity rejected");
    }
    const uniqueFailures = [...new Set(failures)].sort();
    return {
        schemaVersion: 1,
        contract: "dokkan-leader-shadow-producer-validation",
        contractVersion: CHARACTER_LEADER_ANDROID_SHADOW_CONTRACT_VERSION,
        valid: uniqueFailures.length === 0,
        failures: uniqueFailures,
        counts,
        sizes,
        checks: {
            exactAndroidWireShape: uniqueFailures.length === 0,
            globalOrderAndMultiplicityPreserved: uniqueFailures.length === 0,
            sourceOccurrenceIdentityPreserved: uniqueFailures.length === 0,
            commonModifierPreserved: uniqueFailures.length === 0,
            sequentialFiltersPreserved: uniqueFailures.length === 0,
            provenancePinnedExternally: uniqueFailures.length === 0,
            androidGitObjectSourcePinned: exactRealSource && exactAndroidSource(provenancePin.androidSource),
            noUnknownMaterializedAsZeroOrFalse: uniqueFailures.length === 0,
            noEffectiveValueOrCombatCalculation: true,
        },
        safety: {
            createOnly: true,
            manifestWrittenLast: true,
            automaticCleanupAttempted: false,
            outputNamespaceThreatModel: "caller_controlled_stable_during_operation",
            concurrentSameUserAncestorReplacementProtected: false,
            networkRequestCount: 0,
            authenticatedRequestCount: 0,
            r2MutationCount: 0,
        },
        readiness: {
            offlineProducer: exactRealSource && uniqueFailures.length === 0 ? "GO" : "NOT_EXECUTED",
            androidWireCompatibility: exactRealSource && uniqueFailures.length === 0 ? "GO" : "NOT_EXECUTED",
            externalProvenancePinCandidate: exactRealSource && uniqueFailures.length === 0 ? "GO" : "NOT_EXECUTED",
            androidRuntimeConsumption: "NO-GO",
            authority: "NO-GO",
            production: "NO-GO",
            publisher: "NO-GO",
            network: "NO-GO",
            r2: "NO-GO",
            ui: "NO-GO",
            combatCalculation: "NO-GO",
            concurrentOutputAncestorReplacement: "NO-GO",
        },
    };
}

function materialize(
    dataset: CharacterLeaderAndroidShadowDataset,
    androidSource: CharacterLeaderCompatibilityAndroidSourceIdentity,
    exactRealSource: boolean,
): CharacterLeaderAndroidShadowArtifactSet {
    const raw = jsonBytes(dataset);
    const gzip = gzipSync(raw, { level: 9 });
    const payloadSha256 = hash(gzip);
    const manifest: CharacterLeaderAndroidShadowManifest = {
        schemaVersion: 1,
        contract: "dokkan-leader-shadow",
        contractVersion: CHARACTER_LEADER_ANDROID_SHADOW_CONTRACT_VERSION,
        fileName: `leader-shadow.${payloadSha256}.json.gz`,
        compression: "gzip",
        sha256: payloadSha256,
        sizeBytes: gzip.length,
        uncompressedSha256: hash(raw),
        uncompressedSizeBytes: raw.length,
        recordCount: dataset.recordCount,
        occurrenceCount: dataset.occurrenceCount,
        filterCount: dataset.filterCount,
        provenance: dataset.provenance,
    };
    const manifestBytes = jsonBytes(manifest);
    const provenancePin: CharacterLeaderAndroidShadowProvenancePin = {
        schemaVersion: 1,
        contract: "dokkan-leader-shadow-external-provenance-pin",
        contractVersion: CHARACTER_LEADER_ANDROID_SHADOW_CONTRACT_VERSION,
        manifestSha256: hash(manifestBytes),
        payloadSha256,
        provenance: dataset.provenance,
        compatibilityAudit: {
            checkpoint: "K62.1",
            reportSha256: CHARACTER_LEADER_ANDROID_SHADOW_SOURCE_PIN.k62_1.compatibilityAuditSha256,
            decision: "K63_ADDITIVE_DESIGN_GO",
        },
        androidSource,
        policy: {
            distributeOutOfBandFromArtifact: true,
            artifactCannotSelfAuthorize: true,
            authoritySelected: false,
            productionEnabled: false,
        },
    };
    const provenancePinBytes = jsonBytes(provenancePin);
    if (exactRealSource && hash(provenancePinBytes) !== CHARACTER_LEADER_ANDROID_SHADOW_ACCEPTED_PROVENANCE_PIN_SHA256) {
        throw new Error("K64 external provenance pin identity rejected");
    }
    const validation = buildValidation(dataset, manifest, provenancePin, {
        rawSizeBytes: raw.length,
        gzipSizeBytes: gzip.length,
        manifestSizeBytes: manifestBytes.length,
        provenancePinSizeBytes: provenancePinBytes.length,
        rawMaximumBytesExclusive: CHARACTER_LEADER_ANDROID_SHADOW_RAW_LIMIT_BYTES,
        gzipMaximumBytesExclusive: CHARACTER_LEADER_ANDROID_SHADOW_GZIP_LIMIT_BYTES,
        manifestMaximumBytesExclusive: CHARACTER_LEADER_ANDROID_SHADOW_MANIFEST_LIMIT_BYTES,
        metadataMaximumBytesExclusive: CHARACTER_LEADER_ANDROID_SHADOW_METADATA_LIMIT_BYTES,
    }, exactRealSource);
    if (!validation.valid) throw new Error(`K64 Android shadow validation failed: ${validation.failures.join("; ")}`);
    const validationBytes = jsonBytes(validation);
    if (manifestBytes.length + provenancePinBytes.length + validationBytes.length >= CHARACTER_LEADER_ANDROID_SHADOW_METADATA_LIMIT_BYTES) {
        throw new Error("K64 complete metadata byte budget reached");
    }
    const artifacts = { dataset, manifest, provenancePin, validation, raw, gzip, manifestBytes, provenancePinBytes, validationBytes };
    assertArtifactBytes(artifacts, exactRealSource);
    return artifacts;
}

export function materializeCharacterLeaderAndroidShadow(
    dataset: CharacterLeaderAndroidShadowDataset,
    androidSource: CharacterLeaderCompatibilityAndroidSourceIdentity,
): CharacterLeaderAndroidShadowArtifactSet {
    return materialize(dataset, androidSource, false);
}

export function buildRealCharacterLeaderAndroidShadow(
    k56: CharacterLeaderSupportedProjectionArtifactSet,
    androidSource: CharacterLeaderCompatibilityAndroidSourceIdentity,
): CharacterLeaderAndroidShadowArtifactSet {
    assertExactCharacterLeaderSupportedShadowK56Identity(k56);
    const artifactFingerprint = characterLeaderSupportedShadowArtifactFingerprint(k56);
    const lineageFingerprint = characterLeaderSupportedShadowLineageFingerprint(k56);
    if (artifactFingerprint !== CHARACTER_LEADER_ANDROID_SHADOW_SOURCE_PIN.k56.fullArtifactFingerprintSha256
        || lineageFingerprint !== CHARACTER_LEADER_ANDROID_SHADOW_SOURCE_PIN.k56.lineageFingerprintSha256
        || !exactAndroidSource(androidSource)) throw new Error("K64 exact source identities rejected");
    const dataset = buildCharacterLeaderAndroidShadowDataset(k56.dataset.records, expectedProvenance());
    return materialize(dataset, androidSource, true);
}

function assertArtifactBytes(
    artifacts: CharacterLeaderAndroidShadowArtifactSet,
    exactRealSource: boolean,
): void {
    if (jsonBytes(artifacts.dataset).equals(artifacts.raw) === false
        || jsonBytes(artifacts.manifest).equals(artifacts.manifestBytes) === false
        || jsonBytes(artifacts.provenancePin).equals(artifacts.provenancePinBytes) === false
        || jsonBytes(artifacts.validation).equals(artifacts.validationBytes) === false) {
        throw new Error("K64 canonical object/bytes mismatch");
    }
    const inflated = gunzipSync(artifacts.gzip, { maxOutputLength: CHARACTER_LEADER_ANDROID_SHADOW_RAW_LIMIT_BYTES });
    if (!inflated.equals(artifacts.raw) || hash(artifacts.gzip) !== artifacts.manifest.sha256
        || artifacts.gzip.length !== artifacts.manifest.sizeBytes || hash(artifacts.raw) !== artifacts.manifest.uncompressedSha256
        || artifacts.raw.length !== artifacts.manifest.uncompressedSizeBytes || hash(artifacts.manifestBytes) !== artifacts.provenancePin.manifestSha256
        || artifacts.manifest.sha256 !== artifacts.provenancePin.payloadSha256) throw new Error("K64 artifact hash/size binding rejected");
    const observedSizes: CharacterLeaderAndroidShadowValidation["sizes"] = {
        rawSizeBytes: artifacts.raw.length,
        gzipSizeBytes: artifacts.gzip.length,
        manifestSizeBytes: artifacts.manifestBytes.length,
        provenancePinSizeBytes: artifacts.provenancePinBytes.length,
        rawMaximumBytesExclusive: CHARACTER_LEADER_ANDROID_SHADOW_RAW_LIMIT_BYTES,
        gzipMaximumBytesExclusive: CHARACTER_LEADER_ANDROID_SHADOW_GZIP_LIMIT_BYTES,
        manifestMaximumBytesExclusive: CHARACTER_LEADER_ANDROID_SHADOW_MANIFEST_LIMIT_BYTES,
        metadataMaximumBytesExclusive: CHARACTER_LEADER_ANDROID_SHADOW_METADATA_LIMIT_BYTES,
    };
    if (json(observedSizes) !== json(artifacts.validation.sizes)) throw new Error("K64 observed artifact sizes rejected");
    const rebuilt = buildValidation(artifacts.dataset, artifacts.manifest, artifacts.provenancePin, observedSizes, exactRealSource);
    if (json(rebuilt) !== json(artifacts.validation)) throw new Error("K64 validation reconstruction rejected");
    const expectedNames = [
        artifacts.manifest.fileName,
        CHARACTER_LEADER_ANDROID_SHADOW_FILES.manifest,
        CHARACTER_LEADER_ANDROID_SHADOW_FILES.provenancePin,
        CHARACTER_LEADER_ANDROID_SHADOW_FILES.validation,
    ];
    if (new Set(expectedNames).size !== expectedNames.length) throw new Error("K64 output member names overlap");
}

export function assertCharacterLeaderAndroidShadowArtifactBytes(
    artifacts: CharacterLeaderAndroidShadowArtifactSet,
    expectedProvenancePinSha256: string,
): void {
    if (!SHA_256.test(expectedProvenancePinSha256) || hash(artifacts.provenancePinBytes) !== expectedProvenancePinSha256) {
        throw new Error("K64 external provenance pin identity rejected");
    }
    assertArtifactBytes(artifacts, false);
}

export function assertRealCharacterLeaderAndroidShadowArtifactBytes(
    artifacts: CharacterLeaderAndroidShadowArtifactSet,
): void {
    if (hash(artifacts.provenancePinBytes) !== CHARACTER_LEADER_ANDROID_SHADOW_ACCEPTED_PROVENANCE_PIN_SHA256) {
        throw new Error("K64 accepted external provenance pin identity rejected");
    }
    assertArtifactBytes(artifacts, true);
}
