"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertRealCharacterLeaderAndroidShadowArtifactBytes = exports.assertCharacterLeaderAndroidShadowArtifactBytes = exports.buildRealCharacterLeaderAndroidShadow = exports.materializeCharacterLeaderAndroidShadow = exports.buildCharacterLeaderAndroidShadowDataset = void 0;
const crypto_1 = require("crypto");
const zlib_1 = require("zlib");
const leader_supported_shadow_1 = require("./leader-supported-shadow");
const leader_android_shadow_contract_1 = require("./leader-android-shadow-contract");
const SHA_256 = /^[a-f0-9]{64}$/;
const ANDROID_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const STRUCTURAL_MASK = /^-?[0-9]+$/;
const MAX_ANDROID_ID_LENGTH = 160;
const MAX_ANDROID_STRING_LENGTH = 512;
const MAX_ANDROID_ABSOLUTE_VALUE = 1000000;
const hash = (bytes) => (0, crypto_1.createHash)("sha256").update(bytes).digest("hex");
const json = (value) => JSON.stringify(value);
const jsonBytes = (value) => Buffer.from(json(value), "utf8");
function exactKeys(value, keys) {
    return !!value && typeof value === "object" && !Array.isArray(value)
        && json(Object.keys(value).sort()) === json([...keys].sort());
}
function validId(value) {
    return typeof value === "string" && value.length <= MAX_ANDROID_ID_LENGTH && ANDROID_ID.test(value);
}
function validInteger(value) {
    return Number.isSafeInteger(value) && Math.abs(value) <= MAX_ANDROID_ABSOLUTE_VALUE;
}
function assertSourceRecord(record) {
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
function expectedProvenance() {
    return {
        sourceContract: "dokkan-database-character-leader-supported-only-projection",
        sourceContractVersion: "1.0.0",
        sourceCheckpoint: "K62.1",
        sourceArtifactSha256: leader_android_shadow_contract_1.CHARACTER_LEADER_ANDROID_SHADOW_SOURCE_PIN.k56.fullArtifactFingerprintSha256,
        sourceLineageSha256: leader_android_shadow_contract_1.CHARACTER_LEADER_ANDROID_SHADOW_SOURCE_PIN.k56.lineageFingerprintSha256,
        sourceReceiptSha256: leader_android_shadow_contract_1.CHARACTER_LEADER_ANDROID_SHADOW_SOURCE_PIN.k60.publicationReceiptSha256,
    };
}
function scopeFilter(record, occurrenceIndex, filterIndex) {
    const values = {
        team_allies: ["TARGET_TEAM", "team-allies"],
        super_class_allies: ["TARGET_SUPER_CLASS", "super-class-allies"],
        extreme_class_allies: ["TARGET_EXTREME_CLASS", "extreme-class-allies"],
    };
    const [type, valueId] = values[record.targetScope];
    return { filterIndex, filterId: `scope:${occurrenceIndex}`, type, valueId };
}
function buildCharacterLeaderAndroidShadowDataset(sourceRecords, provenance) {
    const records = [];
    const closedStateIds = new Set();
    let current;
    let occurrenceIndex = 0;
    let filterIndex = 0;
    for (const source of sourceRecords) {
        assertSourceRecord(source);
        if (!current || current.stateId !== source.stateId) {
            if (current)
                closedStateIds.add(current.stateId);
            if (closedStateIds.has(source.stateId))
                throw new Error("K64 source state order is non-contiguous");
            current = {
                recordIndex: records.length,
                stateId: source.stateId,
                sourceStateKey: source.sourceStateKey,
                cardId: source.cardId,
                releaseState: source.releaseState.toUpperCase(),
                leaderSetId: source.leaderSetRowId,
                occurrences: [],
            };
            records.push(current);
        }
        else if (current.sourceStateKey !== source.sourceStateKey || current.cardId !== source.cardId
            || current.releaseState !== source.releaseState.toUpperCase() || current.leaderSetId !== source.leaderSetRowId) {
            throw new Error("K64 source state identity changed inside its occurrence group");
        }
        const currentOccurrenceIndex = occurrenceIndex++;
        const filters = [scopeFilter(source, currentOccurrenceIndex, filterIndex++)];
        if (source.targetFilters.length === 0) {
            filters.push({
                filterIndex: filterIndex++,
                filterId: `empty:${currentOccurrenceIndex}`,
                type: "EMPTY_IDENTITY",
                valueId: null,
            });
        }
        else {
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
                    stat: stat.toUpperCase(),
                    value,
                })),
            },
            filters,
        });
    }
    return {
        schemaVersion: 1,
        contract: "dokkan-leader-shadow",
        contractVersion: leader_android_shadow_contract_1.CHARACTER_LEADER_ANDROID_SHADOW_CONTRACT_VERSION,
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
exports.buildCharacterLeaderAndroidShadowDataset = buildCharacterLeaderAndroidShadowDataset;
function inspectDataset(dataset) {
    if (!exactKeys(dataset, [
        "schemaVersion", "contract", "contractVersion", "recordCount", "occurrenceCount", "filterCount",
        "provenance", "runtimeUnknowns", "semantics", "records",
    ]) || dataset.schemaVersion !== 1 || dataset.contract !== "dokkan-leader-shadow"
        || dataset.contractVersion !== leader_android_shadow_contract_1.CHARACTER_LEADER_ANDROID_SHADOW_CONTRACT_VERSION
        || !Array.isArray(dataset.records))
        throw new Error("K64 Android dataset contract rejected");
    if (!exactKeys(dataset.provenance, [
        "sourceContract", "sourceContractVersion", "sourceCheckpoint", "sourceArtifactSha256",
        "sourceLineageSha256", "sourceReceiptSha256",
    ]) || dataset.provenance.sourceContract !== "dokkan-database-character-leader-supported-only-projection"
        || dataset.provenance.sourceContractVersion !== "1.0.0" || dataset.provenance.sourceCheckpoint !== "K62.1"
        || !SHA_256.test(dataset.provenance.sourceArtifactSha256)
        || !SHA_256.test(dataset.provenance.sourceLineageSha256)
        || !SHA_256.test(dataset.provenance.sourceReceiptSha256))
        throw new Error("K64 provenance rejected");
    const unknownKeys = [
        "lifecycleReevaluationUnknown", "durationUnknown", "removalOutcomeUnknown", "leaderFriendCompositionUnknown",
        "finalStackingUnknown", "finalRoundingUnknown", "transformationDeathReviveExchangeStandbyUnknown",
    ];
    const semanticsKeys = [
        "targetFiltersCombinedSequentially", "emptyFilterIdentityIsMatch", "duplicateFiltersPreservedAndReapplied",
        "recordOrderPreserved", "filterOrderAndMultiplicityPreserved",
    ];
    if (!exactKeys(dataset.runtimeUnknowns, unknownKeys) || !unknownKeys.every(key => dataset.runtimeUnknowns[key] === true)
        || !exactKeys(dataset.semantics, semanticsKeys) || !semanticsKeys.every(key => dataset.semantics[key] === true)) {
        throw new Error("K64 unknown or semantics evidence rejected");
    }
    const filterTypes = {
        TARGET_TEAM: 0, TARGET_SUPER_CLASS: 0, TARGET_EXTREME_CLASS: 0,
        CATEGORY_INCLUDE: 0, CATEGORY_EXCLUDE: 0, EMPTY_IDENTITY: 0,
    };
    const operations = { percentage: 0, flatPoints: 0 };
    const stateIds = new Set(), sourceStateKeys = new Set(), occurrenceIds = new Set();
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
                || operation.stats.length !== 3)
                throw new Error("K64 Android operation rejected");
            if (operation.kind === "PERCENTAGE")
                operations.percentage++;
            else
                operations.flatPoints++;
            const expectedStats = ["HP", "ATK", "DEF"];
            operation.stats.forEach((stat, statIndex) => {
                if (!exactKeys(stat, ["statIndex", "stat", "value"]) || stat.statIndex !== statIndex
                    || stat.stat !== expectedStats[statIndex] || !validInteger(stat.value)
                    || stat.value !== operation.commonModifier)
                    throw new Error("K64 Android ordered stat rejected");
            });
            if (occurrence.filters.length < 2)
                throw new Error("K64 Android filter identity evidence missing");
            occurrence.filters.forEach((filter, localIndex) => {
                if (!exactKeys(filter, ["filterIndex", "filterId", "type", "valueId"])
                    || filter.filterIndex !== filters || !validId(filter.filterId)
                    || !(filter.type in filterTypes)
                    || (filter.type === "EMPTY_IDENTITY") !== (filter.valueId === null)
                    || filter.valueId !== null && !validId(filter.valueId))
                    throw new Error("K64 Android filter rejected");
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
function exactAndroidSource(identity) {
    const pin = leader_android_shadow_contract_1.CHARACTER_LEADER_ANDROID_SHADOW_SOURCE_PIN.android;
    const { fingerprintSha256, ...body } = identity;
    return identity.repositoryUrl === pin.repositoryUrl && identity.commit === pin.commit
        && identity.access === "git_object_database_only" && identity.checkoutBytesRead === false
        && json(identity.files) === json(pin.files) && fingerprintSha256 === hash(json(body));
}
function buildValidation(dataset, manifest, provenancePin, sizes, exactRealSource) {
    const failures = [];
    let counts = {
        records: 0,
        occurrences: 0,
        filters: 0,
        filterTypes: {
            TARGET_TEAM: 0, TARGET_SUPER_CLASS: 0, TARGET_EXTREME_CLASS: 0,
            CATEGORY_INCLUDE: 0, CATEGORY_EXCLUDE: 0, EMPTY_IDENTITY: 0,
        },
        operations: { percentage: 0, flatPoints: 0 },
    };
    try {
        counts = inspectDataset(dataset);
    }
    catch (error) {
        failures.push(error.message);
    }
    if (!exactKeys(manifest, [
        "schemaVersion", "contract", "contractVersion", "fileName", "compression", "sha256", "sizeBytes",
        "uncompressedSha256", "uncompressedSizeBytes", "recordCount", "occurrenceCount", "filterCount", "provenance",
    ]) || manifest.schemaVersion !== 1 || manifest.contract !== "dokkan-leader-shadow"
        || manifest.contractVersion !== leader_android_shadow_contract_1.CHARACTER_LEADER_ANDROID_SHADOW_CONTRACT_VERSION || manifest.compression !== "gzip"
        || !/^leader-shadow\.[a-f0-9]{64}\.json\.gz$/.test(manifest.fileName)
        || manifest.fileName !== `leader-shadow.${manifest.sha256}.json.gz`
        || json(manifest.provenance) !== json(dataset.provenance)
        || manifest.recordCount !== dataset.recordCount || manifest.occurrenceCount !== dataset.occurrenceCount
        || manifest.filterCount !== dataset.filterCount)
        failures.push("K64 Android manifest rejected");
    if (!exactKeys(provenancePin, [
        "schemaVersion", "contract", "contractVersion", "manifestSha256", "payloadSha256", "provenance",
        "compatibilityAudit", "androidSource", "policy",
    ]) || provenancePin.schemaVersion !== 1 || provenancePin.contract !== "dokkan-leader-shadow-external-provenance-pin"
        || provenancePin.contractVersion !== leader_android_shadow_contract_1.CHARACTER_LEADER_ANDROID_SHADOW_CONTRACT_VERSION
        || provenancePin.payloadSha256 !== manifest.sha256 || json(provenancePin.provenance) !== json(dataset.provenance)
        || !exactKeys(provenancePin.compatibilityAudit, ["checkpoint", "reportSha256", "decision"])
        || provenancePin.compatibilityAudit.checkpoint !== "K62.1"
        || provenancePin.compatibilityAudit.reportSha256 !== leader_android_shadow_contract_1.CHARACTER_LEADER_ANDROID_SHADOW_SOURCE_PIN.k62_1.compatibilityAuditSha256
        || provenancePin.compatibilityAudit.decision !== "K63_ADDITIVE_DESIGN_GO"
        || !exactKeys(provenancePin.policy, [
            "distributeOutOfBandFromArtifact", "artifactCannotSelfAuthorize", "authoritySelected", "productionEnabled",
        ]) || provenancePin.policy.distributeOutOfBandFromArtifact !== true
        || provenancePin.policy.artifactCannotSelfAuthorize !== true || provenancePin.policy.authoritySelected !== false
        || provenancePin.policy.productionEnabled !== false)
        failures.push("K64 external provenance pin rejected");
    if (sizes.rawSizeBytes <= 0 || sizes.rawSizeBytes >= leader_android_shadow_contract_1.CHARACTER_LEADER_ANDROID_SHADOW_RAW_LIMIT_BYTES)
        failures.push("K64 raw byte budget reached");
    if (sizes.gzipSizeBytes <= 0 || sizes.gzipSizeBytes >= leader_android_shadow_contract_1.CHARACTER_LEADER_ANDROID_SHADOW_GZIP_LIMIT_BYTES)
        failures.push("K64 gzip byte budget reached");
    if (sizes.manifestSizeBytes <= 0 || sizes.manifestSizeBytes >= leader_android_shadow_contract_1.CHARACTER_LEADER_ANDROID_SHADOW_MANIFEST_LIMIT_BYTES)
        failures.push("K64 manifest byte budget reached");
    if (sizes.manifestSizeBytes + sizes.provenancePinSizeBytes >= leader_android_shadow_contract_1.CHARACTER_LEADER_ANDROID_SHADOW_METADATA_LIMIT_BYTES) {
        failures.push("K64 metadata byte budget reached");
    }
    if (exactRealSource) {
        const output = leader_android_shadow_contract_1.CHARACTER_LEADER_ANDROID_SHADOW_SOURCE_PIN.output;
        if (json(dataset.provenance) !== json(expectedProvenance()) || !exactAndroidSource(provenancePin.androidSource)
            || counts.records !== output.recordCount || counts.occurrences !== output.occurrenceCount || counts.filters !== output.filterCount
            || counts.filterTypes.TARGET_TEAM !== output.scopeFilterCounts.team
            || counts.filterTypes.TARGET_SUPER_CLASS !== output.scopeFilterCounts.superClass
            || counts.filterTypes.TARGET_EXTREME_CLASS !== output.scopeFilterCounts.extremeClass
            || counts.filterTypes.CATEGORY_INCLUDE !== output.categoryFilterCounts.include
            || counts.filterTypes.CATEGORY_EXCLUDE !== output.categoryFilterCounts.exclude
            || counts.filterTypes.EMPTY_IDENTITY !== output.emptyIdentityFilterCount
            || counts.operations.percentage !== output.percentageOccurrenceCount
            || counts.operations.flatPoints !== output.flatOccurrenceCount)
            failures.push("K64 exact real corpus or source identity rejected");
    }
    const uniqueFailures = [...new Set(failures)].sort();
    return {
        schemaVersion: 1,
        contract: "dokkan-leader-shadow-producer-validation",
        contractVersion: leader_android_shadow_contract_1.CHARACTER_LEADER_ANDROID_SHADOW_CONTRACT_VERSION,
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
function materialize(dataset, androidSource, exactRealSource) {
    const raw = jsonBytes(dataset);
    const gzip = (0, zlib_1.gzipSync)(raw, { level: 9 });
    const payloadSha256 = hash(gzip);
    const manifest = {
        schemaVersion: 1,
        contract: "dokkan-leader-shadow",
        contractVersion: leader_android_shadow_contract_1.CHARACTER_LEADER_ANDROID_SHADOW_CONTRACT_VERSION,
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
    const provenancePin = {
        schemaVersion: 1,
        contract: "dokkan-leader-shadow-external-provenance-pin",
        contractVersion: leader_android_shadow_contract_1.CHARACTER_LEADER_ANDROID_SHADOW_CONTRACT_VERSION,
        manifestSha256: hash(manifestBytes),
        payloadSha256,
        provenance: dataset.provenance,
        compatibilityAudit: {
            checkpoint: "K62.1",
            reportSha256: leader_android_shadow_contract_1.CHARACTER_LEADER_ANDROID_SHADOW_SOURCE_PIN.k62_1.compatibilityAuditSha256,
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
    if (exactRealSource && hash(provenancePinBytes) !== leader_android_shadow_contract_1.CHARACTER_LEADER_ANDROID_SHADOW_ACCEPTED_PROVENANCE_PIN_SHA256) {
        throw new Error("K64 external provenance pin identity rejected");
    }
    const validation = buildValidation(dataset, manifest, provenancePin, {
        rawSizeBytes: raw.length,
        gzipSizeBytes: gzip.length,
        manifestSizeBytes: manifestBytes.length,
        provenancePinSizeBytes: provenancePinBytes.length,
        rawMaximumBytesExclusive: leader_android_shadow_contract_1.CHARACTER_LEADER_ANDROID_SHADOW_RAW_LIMIT_BYTES,
        gzipMaximumBytesExclusive: leader_android_shadow_contract_1.CHARACTER_LEADER_ANDROID_SHADOW_GZIP_LIMIT_BYTES,
        manifestMaximumBytesExclusive: leader_android_shadow_contract_1.CHARACTER_LEADER_ANDROID_SHADOW_MANIFEST_LIMIT_BYTES,
        metadataMaximumBytesExclusive: leader_android_shadow_contract_1.CHARACTER_LEADER_ANDROID_SHADOW_METADATA_LIMIT_BYTES,
    }, exactRealSource);
    if (!validation.valid)
        throw new Error(`K64 Android shadow validation failed: ${validation.failures.join("; ")}`);
    const validationBytes = jsonBytes(validation);
    if (manifestBytes.length + provenancePinBytes.length + validationBytes.length >= leader_android_shadow_contract_1.CHARACTER_LEADER_ANDROID_SHADOW_METADATA_LIMIT_BYTES) {
        throw new Error("K64 complete metadata byte budget reached");
    }
    const artifacts = { dataset, manifest, provenancePin, validation, raw, gzip, manifestBytes, provenancePinBytes, validationBytes };
    assertArtifactBytes(artifacts, exactRealSource);
    return artifacts;
}
function materializeCharacterLeaderAndroidShadow(dataset, androidSource) {
    return materialize(dataset, androidSource, false);
}
exports.materializeCharacterLeaderAndroidShadow = materializeCharacterLeaderAndroidShadow;
function buildRealCharacterLeaderAndroidShadow(k56, androidSource) {
    (0, leader_supported_shadow_1.assertExactCharacterLeaderSupportedShadowK56Identity)(k56);
    const artifactFingerprint = (0, leader_supported_shadow_1.characterLeaderSupportedShadowArtifactFingerprint)(k56);
    const lineageFingerprint = (0, leader_supported_shadow_1.characterLeaderSupportedShadowLineageFingerprint)(k56);
    if (artifactFingerprint !== leader_android_shadow_contract_1.CHARACTER_LEADER_ANDROID_SHADOW_SOURCE_PIN.k56.fullArtifactFingerprintSha256
        || lineageFingerprint !== leader_android_shadow_contract_1.CHARACTER_LEADER_ANDROID_SHADOW_SOURCE_PIN.k56.lineageFingerprintSha256
        || !exactAndroidSource(androidSource))
        throw new Error("K64 exact source identities rejected");
    const dataset = buildCharacterLeaderAndroidShadowDataset(k56.dataset.records, expectedProvenance());
    return materialize(dataset, androidSource, true);
}
exports.buildRealCharacterLeaderAndroidShadow = buildRealCharacterLeaderAndroidShadow;
function assertArtifactBytes(artifacts, exactRealSource) {
    if (jsonBytes(artifacts.dataset).equals(artifacts.raw) === false
        || jsonBytes(artifacts.manifest).equals(artifacts.manifestBytes) === false
        || jsonBytes(artifacts.provenancePin).equals(artifacts.provenancePinBytes) === false
        || jsonBytes(artifacts.validation).equals(artifacts.validationBytes) === false) {
        throw new Error("K64 canonical object/bytes mismatch");
    }
    const inflated = (0, zlib_1.gunzipSync)(artifacts.gzip, { maxOutputLength: leader_android_shadow_contract_1.CHARACTER_LEADER_ANDROID_SHADOW_RAW_LIMIT_BYTES });
    if (!inflated.equals(artifacts.raw) || hash(artifacts.gzip) !== artifacts.manifest.sha256
        || artifacts.gzip.length !== artifacts.manifest.sizeBytes || hash(artifacts.raw) !== artifacts.manifest.uncompressedSha256
        || artifacts.raw.length !== artifacts.manifest.uncompressedSizeBytes || hash(artifacts.manifestBytes) !== artifacts.provenancePin.manifestSha256
        || artifacts.manifest.sha256 !== artifacts.provenancePin.payloadSha256)
        throw new Error("K64 artifact hash/size binding rejected");
    const observedSizes = {
        rawSizeBytes: artifacts.raw.length,
        gzipSizeBytes: artifacts.gzip.length,
        manifestSizeBytes: artifacts.manifestBytes.length,
        provenancePinSizeBytes: artifacts.provenancePinBytes.length,
        rawMaximumBytesExclusive: leader_android_shadow_contract_1.CHARACTER_LEADER_ANDROID_SHADOW_RAW_LIMIT_BYTES,
        gzipMaximumBytesExclusive: leader_android_shadow_contract_1.CHARACTER_LEADER_ANDROID_SHADOW_GZIP_LIMIT_BYTES,
        manifestMaximumBytesExclusive: leader_android_shadow_contract_1.CHARACTER_LEADER_ANDROID_SHADOW_MANIFEST_LIMIT_BYTES,
        metadataMaximumBytesExclusive: leader_android_shadow_contract_1.CHARACTER_LEADER_ANDROID_SHADOW_METADATA_LIMIT_BYTES,
    };
    if (json(observedSizes) !== json(artifacts.validation.sizes))
        throw new Error("K64 observed artifact sizes rejected");
    const rebuilt = buildValidation(artifacts.dataset, artifacts.manifest, artifacts.provenancePin, observedSizes, exactRealSource);
    if (json(rebuilt) !== json(artifacts.validation))
        throw new Error("K64 validation reconstruction rejected");
    const expectedNames = [
        artifacts.manifest.fileName,
        leader_android_shadow_contract_1.CHARACTER_LEADER_ANDROID_SHADOW_FILES.manifest,
        leader_android_shadow_contract_1.CHARACTER_LEADER_ANDROID_SHADOW_FILES.provenancePin,
        leader_android_shadow_contract_1.CHARACTER_LEADER_ANDROID_SHADOW_FILES.validation,
    ];
    if (new Set(expectedNames).size !== expectedNames.length)
        throw new Error("K64 output member names overlap");
}
function assertCharacterLeaderAndroidShadowArtifactBytes(artifacts, expectedProvenancePinSha256) {
    if (!SHA_256.test(expectedProvenancePinSha256) || hash(artifacts.provenancePinBytes) !== expectedProvenancePinSha256) {
        throw new Error("K64 external provenance pin identity rejected");
    }
    assertArtifactBytes(artifacts, false);
}
exports.assertCharacterLeaderAndroidShadowArtifactBytes = assertCharacterLeaderAndroidShadowArtifactBytes;
function assertRealCharacterLeaderAndroidShadowArtifactBytes(artifacts) {
    if (hash(artifacts.provenancePinBytes) !== leader_android_shadow_contract_1.CHARACTER_LEADER_ANDROID_SHADOW_ACCEPTED_PROVENANCE_PIN_SHA256) {
        throw new Error("K64 accepted external provenance pin identity rejected");
    }
    assertArtifactBytes(artifacts, true);
}
exports.assertRealCharacterLeaderAndroidShadowArtifactBytes = assertRealCharacterLeaderAndroidShadowArtifactBytes;
//# sourceMappingURL=leader-android-shadow.js.map