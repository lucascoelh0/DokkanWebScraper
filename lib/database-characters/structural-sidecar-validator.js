"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateCharacterStructuralSidecarArtifact = exports.validateCharacterStructuralSidecarArtifactIntegrityOnly = exports.materializeCharacterStructuralSidecar = exports.validateCharacterStructuralSidecarIntegrityOnly = exports.pinnedCharacterStructuralSidecarLineage = void 0;
const fs_1 = require("fs");
const crypto_1 = require("crypto");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const stream_1 = require("stream");
const zlib_1 = require("zlib");
const artifact_path_1 = require("./artifact-path");
const structural_sidecar_builder_1 = require("./structural-sidecar-builder");
const structural_sidecar_contract_1 = require("./structural-sidecar-contract");
const structural_sidecar_source_1 = require("./structural-sidecar-source");
const hash = (bytes) => (0, crypto_1.createHash)("sha256").update(bytes).digest("hex");
const jsonBytes = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
const keysEqual = (value, keys) => Boolean(value) && typeof value === "object"
    && JSON.stringify(Object.keys(value)) === JSON.stringify(keys);
const samePath = (left, right) => process.platform === "win32"
    ? (0, path_1.resolve)(left).toLowerCase() === (0, path_1.resolve)(right).toLowerCase()
    : (0, path_1.resolve)(left) === (0, path_1.resolve)(right);
const sameFile = (left, right) => left.dev === right.dev && left.ino === right.ino;
const numeric = (left, right) => Number(left) - Number(right) || left.localeCompare(right);
const validStatus = (value) => value === "supported" || value === "partial" || value === "unknown";
function pinnedCharacterStructuralSidecarLineage() {
    const pin = structural_sidecar_contract_1.CHARACTER_STRUCTURAL_SIDECAR_SOURCE_PIN;
    return {
        profileId: pin.profileId,
        snapshotVersion: pin.snapshotVersion,
        k2: {
            contractVersion: pin.k2.contractVersion,
            manifestSha256: pin.k2.manifestSha256,
            manifestSizeBytes: pin.k2.manifestSizeBytes,
            payloadSha256: pin.k2.payloadSha256,
            payloadSizeBytes: pin.k2.payloadSizeBytes,
            uncompressedSizeBytes: pin.k2.uncompressedSizeBytes,
            coverageSha256: pin.k2.coverageSha256,
            coverageSizeBytes: pin.k2.coverageSizeBytes,
            validationSha256: pin.k2.validationSha256,
            validationSizeBytes: pin.k2.validationSizeBytes,
            databaseSha256: pin.k2.databaseSha256,
            db1ArtifactSha256: pin.k2.db1ArtifactSha256,
        },
        productiveCharacters: {
            contract: "Character[]",
            datasetVersion: pin.productiveCharacters.datasetVersion,
            manifestSha256: pin.productiveCharacters.manifestSha256,
            manifestSizeBytes: pin.productiveCharacters.manifestSizeBytes,
            payloadSha256: pin.productiveCharacters.payloadSha256,
            payloadSizeBytes: pin.productiveCharacters.payloadSizeBytes,
            uncompressedSizeBytes: pin.productiveCharacters.uncompressedSizeBytes,
            topLevelCount: pin.productiveCharacters.topLevelCount,
            uniqueCardIdCount: pin.productiveCharacters.uniqueCardIdCount,
        },
    };
}
exports.pinnedCharacterStructuralSidecarLineage = pinnedCharacterStructuralSidecarLineage;
function canonicalPolicy() {
    return {
        recordKey: "cardId",
        productiveComparison: "card_id_only",
        structuralIdentityFrom: "pinned_k2_taxonomy_only",
        productivePayloadUse: "card_id_coverage_only",
        presentationLabelsAreIdentity: false,
        sourceOrderPreserved: true,
        assignmentsDeduplicated: false,
        assignmentsCanonicalized: false,
        sharedLinksComputed: false,
        activeLinksComputed: false,
        collectionOrderIrrelevanceClaimed: false,
        ezaSezaInvariance: "not_claimed",
        characterPatchesCreated: false,
        consumerImplemented: false,
        publisherImplemented: false,
        androidImplemented: false,
    };
}
function addRecordFailures(record, failures) {
    let invalidState = 0;
    let invalidOrder = 0;
    if (!keysEqual(record, ["cardId", "productiveCardIdCoverage", "characterClass", "categories", "links"]) || !/^\d+$/.test(record.cardId)
        || !["covered", "not_covered"].includes(record.productiveCardIdCoverage))
        failures.push(`invalid record contract:${record.cardId}`);
    if (!keysEqual(record.characterClass, ["raw", "value", "status"]) || typeof record.characterClass.value !== "string" || !validStatus(record.characterClass.status)) {
        failures.push(`invalid characterClass:${record.cardId}`);
    }
    const collections = [
        ["categories", record.categories, "assignments", "categoryAssignments"],
        ["links", record.links, "entries", "links"],
    ];
    for (const [label, collection, valuesKey, sourceField] of collections) {
        if (!keysEqual(collection, ["status", "state", "containerProvenance", valuesKey]) || !validStatus(collection.status)
            || !["present_with_row_provenance", "empty_with_container_provenance_absence_unproved", "absent_unproved"].includes(collection.state)) {
            failures.push(`invalid ${label} contract:${record.cardId}`);
            invalidState++;
            continue;
        }
        const values = collection[valuesKey];
        if (!Array.isArray(values)) {
            failures.push(`invalid ${label} values:${record.cardId}`);
            invalidState++;
            continue;
        }
        const expectedState = values.length ? "present_with_row_provenance"
            : collection.containerProvenance ? "empty_with_container_provenance_absence_unproved" : "absent_unproved";
        if (collection.state !== expectedState || (values.length === 0 && collection.status !== "unknown")) {
            failures.push(`invalid ${label} presence semantics:${record.cardId}`);
            invalidState++;
        }
        if (collection.containerProvenance !== null && (!keysEqual(collection.containerProvenance, ["contract", "cardId", "field"])
            || collection.containerProvenance.contract !== "dokkan-database-characters-taxonomy"
            || collection.containerProvenance.cardId !== record.cardId || collection.containerProvenance.field !== sourceField)) {
            failures.push(`invalid ${label} container provenance:${record.cardId}`);
            invalidState++;
        }
    }
    const relationRows = new Set();
    let previousRelation = "";
    for (const item of record.categories.assignments) {
        if (!keysEqual(item, ["categoryId", "relationRowId", "status", "labelEvidence"]) || !/^\d+$/.test(item.categoryId)
            || !/^\d+$/.test(item.relationRowId) || !validStatus(item.status))
            failures.push(`invalid category assignment:${record.cardId}`);
        if (relationRows.has(item.relationRowId) || (previousRelation && numeric(previousRelation, item.relationRowId) >= 0))
            invalidOrder++;
        relationRows.add(item.relationRowId);
        previousRelation = item.relationRowId;
        if (item.labelEvidence.status === "supported") {
            if (!keysEqual(item.labelEvidence, ["status", "value", "sourceLocale", "source"])
                || item.labelEvidence.sourceLocale !== "global_snapshot_default" || typeof item.labelEvidence.value !== "string"
                || !keysEqual(item.labelEvidence.source, ["table", "rowId", "column"]) || item.labelEvidence.source.table !== "card_categories"
                || item.labelEvidence.source.rowId !== item.categoryId || item.labelEvidence.source.column !== "name")
                failures.push(`invalid category label evidence:${record.cardId}`);
        }
        else if (!keysEqual(item.labelEvidence, ["status", "reason"]) || item.labelEvidence.reason !== "dictionary_mapping_missing") {
            failures.push(`invalid category missing-label evidence:${record.cardId}`);
        }
    }
    const slots = new Set();
    let previousSlot = 0;
    for (const item of record.links.entries) {
        if (!keysEqual(item, ["slot", "linkSkillId", "sourceColumn", "status", "labelEvidence"]) || !Number.isInteger(item.slot) || item.slot <= 0
            || !/^\d+$/.test(item.linkSkillId) || item.sourceColumn !== `link_skill${item.slot}_id` || !validStatus(item.status))
            failures.push(`invalid link entry:${record.cardId}`);
        if (slots.has(item.slot) || item.slot <= previousSlot)
            invalidOrder++;
        slots.add(item.slot);
        previousSlot = item.slot;
        if (item.labelEvidence.status === "supported") {
            if (!keysEqual(item.labelEvidence, ["status", "value", "sourceLocale", "source"])
                || item.labelEvidence.sourceLocale !== "global_snapshot_default" || typeof item.labelEvidence.value !== "string"
                || !keysEqual(item.labelEvidence.source, ["table", "rowId", "column"]) || item.labelEvidence.source.table !== "link_skills"
                || item.labelEvidence.source.rowId !== item.linkSkillId || item.labelEvidence.source.column !== "name")
                failures.push(`invalid link label evidence:${record.cardId}`);
        }
        else if (!keysEqual(item.labelEvidence, ["status", "reason"]) || item.labelEvidence.reason !== "dictionary_mapping_missing") {
            failures.push(`invalid link missing-label evidence:${record.cardId}`);
        }
    }
    if (invalidOrder)
        failures.push(`invalid preserved ordering or slot:${record.cardId}`);
    return { invalidState, invalidOrder };
}
function expectedCoverage(sidecar) {
    const records = sidecar.records;
    const statusCounts = (field) => {
        const result = { supported: 0, partial: 0, unknown: 0 };
        records.forEach(item => result[item[field].status]++);
        return result;
    };
    const covered = records.filter(item => item.productiveCardIdCoverage === "covered").length;
    return {
        schemaVersion: 1,
        contract: "dokkan-database-character-structural-identity-coverage",
        contractVersion: structural_sidecar_contract_1.CHARACTER_STRUCTURAL_SIDECAR_CONTRACT_VERSION,
        database: {
            cardCount: records.length,
            categoryAssignmentCount: records.reduce((sum, item) => sum + item.categories.assignments.length, 0),
            linkEntryCount: records.reduce((sum, item) => sum + item.links.entries.length, 0),
            emptyCategoryCollectionCount: records.filter(item => item.categories.state === "empty_with_container_provenance_absence_unproved").length,
            absentCategoryCollectionCount: records.filter(item => item.categories.state === "absent_unproved").length,
            emptyLinkCollectionCount: records.filter(item => item.links.state === "empty_with_container_provenance_absence_unproved").length,
            absentLinkCollectionCount: records.filter(item => item.links.state === "absent_unproved").length,
            missingCategoryLabelMappingCount: records.reduce((sum, item) => sum + item.categories.assignments.filter(value => value.labelEvidence.status === "unknown").length, 0),
            missingLinkLabelMappingCount: records.reduce((sum, item) => sum + item.links.entries.filter(value => value.labelEvidence.status === "unknown").length, 0),
            fieldStatuses: { characterClass: statusCounts("characterClass"), categories: statusCounts("categories"), links: statusCounts("links") },
        },
        productiveCardIdCoverage: {
            comparison: "card_id_only",
            topLevelCharacterCount: structural_sidecar_contract_1.CHARACTER_STRUCTURAL_SIDECAR_SOURCE_PIN.productiveCharacters.topLevelCount,
            uniqueCardIdCount: structural_sidecar_contract_1.CHARACTER_STRUCTURAL_SIDECAR_SOURCE_PIN.productiveCharacters.uniqueCardIdCount,
            ambiguousCardIdCount: 0,
            databaseCoveredCardCount: covered,
            databaseUncoveredCardCount: records.length - covered,
            outsideDatabaseCardIds: [...structural_sidecar_contract_1.CHARACTER_STRUCTURAL_SIDECAR_SOURCE_PIN.productiveCharacters.outsideDatabaseCardIds],
        },
    };
}
// This helper checks only internal consistency. It cannot establish source authority.
function validateCharacterStructuralSidecarIntegrityOnly(sidecar, coverage, sizes) {
    const failures = [];
    if (!keysEqual(sidecar, ["schemaVersion", "contract", "contractVersion", "generatedAt", "datasetVersion", "mode", "source", "policy", "records"])
        || sidecar.schemaVersion !== 1 || sidecar.contract !== "dokkan-database-character-structural-identity-sidecar"
        || sidecar.contractVersion !== structural_sidecar_contract_1.CHARACTER_STRUCTURAL_SIDECAR_CONTRACT_VERSION || sidecar.generatedAt !== structural_sidecar_contract_1.CHARACTER_STRUCTURAL_SIDECAR_SOURCE_PIN.productiveCharacters.datasetVersion
        || sidecar.datasetVersion !== `${structural_sidecar_contract_1.CHARACTER_STRUCTURAL_SIDECAR_SOURCE_PIN.snapshotVersion}-k32-structural-identity-v1` || sidecar.mode !== "offline_default_off")
        failures.push("sidecar header changed");
    if (JSON.stringify(sidecar.source) !== JSON.stringify(pinnedCharacterStructuralSidecarLineage()))
        failures.push("sidecar lineage changed");
    if (JSON.stringify(sidecar.policy) !== JSON.stringify(canonicalPolicy()))
        failures.push("sidecar policy changed");
    if (!Array.isArray(sidecar.records) || sidecar.records.length !== structural_sidecar_contract_1.CHARACTER_STRUCTURAL_SIDECAR_SOURCE_PIN.k2.cardCount)
        failures.push("database card cardinality changed");
    const ids = new Set();
    let duplicateCardIdCount = 0, invalidCollectionStateCount = 0, invalidOrderingOrSlotCount = 0;
    let previousCardId = "";
    for (const record of sidecar.records ?? []) {
        if (ids.has(record.cardId))
            duplicateCardIdCount++;
        ids.add(record.cardId);
        if (previousCardId && numeric(previousCardId, record.cardId) >= 0)
            invalidOrderingOrSlotCount++;
        previousCardId = record.cardId;
        const result = addRecordFailures(record, failures);
        invalidCollectionStateCount += result.invalidState;
        invalidOrderingOrSlotCount += result.invalidOrder;
    }
    if (duplicateCardIdCount)
        failures.push("duplicate cardId");
    if (invalidOrderingOrSlotCount)
        failures.push("source ordering or slots changed");
    const canonicalCoverage = expectedCoverage(sidecar);
    if (JSON.stringify(coverage) !== JSON.stringify(canonicalCoverage))
        failures.push("coverage metadata mismatch");
    const pin = structural_sidecar_contract_1.CHARACTER_STRUCTURAL_SIDECAR_SOURCE_PIN;
    if (canonicalCoverage.database.categoryAssignmentCount !== pin.k2.categoryAssignmentCount || canonicalCoverage.database.linkEntryCount !== pin.k2.linkAssignmentCount
        || canonicalCoverage.productiveCardIdCoverage.databaseCoveredCardCount !== pin.productiveCharacters.databaseCoveredCardCount
        || canonicalCoverage.productiveCardIdCoverage.databaseUncoveredCardCount !== pin.productiveCharacters.databaseUncoveredCardCount)
        failures.push("pinned cardinality changed");
    if (sizes.rawSizeBytes > structural_sidecar_contract_1.CHARACTER_STRUCTURAL_SIDECAR_RAW_BUDGET_BYTES)
        failures.push("raw byte budget exceeded");
    if (sizes.gzipSizeBytes > structural_sidecar_contract_1.CHARACTER_STRUCTURAL_SIDECAR_GZIP_BUDGET_BYTES)
        failures.push("gzip byte budget exceeded");
    return {
        schemaVersion: 1,
        contract: "dokkan-database-character-structural-identity-validation",
        contractVersion: structural_sidecar_contract_1.CHARACTER_STRUCTURAL_SIDECAR_CONTRACT_VERSION,
        valid: failures.length === 0,
        failures,
        sizes: {
            rawMaximumBytes: structural_sidecar_contract_1.CHARACTER_STRUCTURAL_SIDECAR_RAW_BUDGET_BYTES,
            gzipMaximumBytes: structural_sidecar_contract_1.CHARACTER_STRUCTURAL_SIDECAR_GZIP_BUDGET_BYTES,
            rawSizeBytes: sizes.rawSizeBytes,
            gzipSizeBytes: sizes.gzipSizeBytes,
        },
        safety: {
            duplicateCardIdCount,
            duplicateCategoryDictionaryIdCount: 0,
            duplicateLinkDictionaryIdCount: 0,
            invalidCollectionStateCount,
            invalidOrderingOrSlotCount,
            characterPatchCount: 0,
            networkRequestCount: 0,
            outputNamespaceThreatModel: "caller_controlled_stable_during_operation",
            portableOpenatProtection: "unavailable",
            sameUserNamespaceAttackerResistanceClaimed: false,
            hardLinkAttackerResistanceClaimed: false,
        },
        readiness: {
            offlineGeneration: "GO",
            integrityOnlyValidation: "NON_AUTHORITATIVE",
            sourceBoundArtifactValidation: "REQUIRED_FOR_GO",
            publication: "NO-GO",
            r2: "NO-GO",
            android: "NO-GO",
            authorityPromotion: "NO-GO",
            gameplaySemantics: "NO-GO",
            consumer: "NO-GO",
            characterApply: "NO-GO",
        },
    };
}
exports.validateCharacterStructuralSidecarIntegrityOnly = validateCharacterStructuralSidecarIntegrityOnly;
function materializeCharacterStructuralSidecar(sidecar, coverage) {
    const raw = Buffer.from(`${JSON.stringify(sidecar)}\n`, "utf8");
    if (raw.length > structural_sidecar_contract_1.CHARACTER_STRUCTURAL_SIDECAR_RAW_BUDGET_BYTES)
        throw new Error(`K32 raw byte budget exceeded: ${raw.length}`);
    const gzip = (0, zlib_1.gzipSync)(raw, { level: 9 });
    if (gzip.length > structural_sidecar_contract_1.CHARACTER_STRUCTURAL_SIDECAR_GZIP_BUDGET_BYTES)
        throw new Error(`K32 gzip byte budget exceeded: ${gzip.length}`);
    const validation = validateCharacterStructuralSidecarIntegrityOnly(sidecar, coverage, {
        rawSizeBytes: raw.length,
        gzipSizeBytes: gzip.length,
    });
    if (!validation.valid)
        throw new Error(`K32 sidecar integrity validation failed: ${validation.failures.join("; ")}`);
    const coverageBytes = jsonBytes(coverage);
    const validationBytes = jsonBytes(validation);
    const manifest = {
        schemaVersion: 1,
        contract: "dokkan-database-character-structural-identity-manifest",
        contractVersion: structural_sidecar_contract_1.CHARACTER_STRUCTURAL_SIDECAR_CONTRACT_VERSION,
        generatedAt: sidecar.generatedAt,
        datasetVersion: sidecar.datasetVersion,
        fileName: structural_sidecar_contract_1.CHARACTER_STRUCTURAL_SIDECAR_FILES.payload,
        compression: "gzip",
        sha256: hash(gzip),
        sizeBytes: gzip.length,
        uncompressedSha256: hash(raw),
        uncompressedSizeBytes: raw.length,
        recordCount: sidecar.records.length,
        source: sidecar.source,
        coverageFile: structural_sidecar_contract_1.CHARACTER_STRUCTURAL_SIDECAR_FILES.coverage,
        coverageSha256: hash(coverageBytes),
        coverageSizeBytes: coverageBytes.length,
        validationFile: structural_sidecar_contract_1.CHARACTER_STRUCTURAL_SIDECAR_FILES.validation,
        validationSha256: hash(validationBytes),
        validationSizeBytes: validationBytes.length,
    };
    return { sidecar, coverage, validation, manifest, raw, gzip, coverageBytes, validationBytes, manifestBytes: jsonBytes(manifest) };
}
exports.materializeCharacterStructuralSidecar = materializeCharacterStructuralSidecar;
async function regularRoot(root) {
    const path = (0, path_1.resolve)(root);
    const metadata = await (0, promises_1.lstat)(path);
    if (!metadata.isDirectory() || metadata.isSymbolicLink())
        throw new Error("K32 artifact root must be a regular non-link directory");
    const canonical = await (0, promises_1.realpath)(path);
    if (!samePath(path, canonical))
        throw new Error("K32 artifact root symlink or junction rejected");
    return canonical;
}
async function readArtifactSnapshot(root, fileName) {
    const path = await (0, artifact_path_1.resolveCharacterInputFile)(root, fileName, fileName);
    const direct = (0, path_1.join)(root, fileName);
    if (!samePath(path, direct))
        throw new Error(`K32 artifact ${fileName} symlink or junction rejected`);
    const before = await (0, promises_1.lstat)(direct);
    if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1)
        throw new Error(`K32 artifact ${fileName} must be a single-link regular file`);
    const handle = await (0, promises_1.open)(direct, fs_1.constants.O_RDONLY | (fs_1.constants.O_NOFOLLOW ?? 0));
    try {
        const opened = await handle.stat();
        if (!sameFile(before, opened))
            throw new Error(`K32 artifact ${fileName} identity changed while opening`);
        const bytes = await handle.readFile();
        const after = await handle.stat();
        if (!sameFile(opened, after) || after.size !== bytes.length || after.mtimeMs !== opened.mtimeMs || after.ctimeMs !== opened.ctimeMs) {
            throw new Error(`K32 artifact ${fileName} changed while reading`);
        }
        return { path: direct, bytes, metadata: after };
    }
    finally {
        await handle.close();
    }
}
async function gunzipBounded(bytes) {
    const chunks = [];
    let size = 0;
    const stream = stream_1.Readable.from(bytes).pipe((0, zlib_1.createGunzip)());
    for await (const chunk of stream) {
        const value = chunk;
        size += value.length;
        if (size > structural_sidecar_contract_1.CHARACTER_STRUCTURAL_SIDECAR_RAW_BUDGET_BYTES) {
            stream.destroy();
            throw new Error("K32 raw byte budget exceeded during decompression");
        }
        chunks.push(value);
    }
    return Buffer.concat(chunks, size);
}
function assertUnchanged(before, after) {
    if (!samePath(before.path, after.path) || !sameFile(before.metadata, after.metadata) || !before.bytes.equals(after.bytes)) {
        throw new Error(`K32 artifact mutated during validation: ${before.path}`);
    }
}
// This helper rejects corrupt or self-inconsistent bytes, but it does not bind them to K2 or Characters.
async function validateCharacterStructuralSidecarArtifactIntegrityOnly(rootValue) {
    const root = await regularRoot(rootValue);
    const manifestSnapshot = await readArtifactSnapshot(root, structural_sidecar_contract_1.CHARACTER_STRUCTURAL_SIDECAR_FILES.manifest);
    const manifest = JSON.parse(manifestSnapshot.bytes.toString("utf8"));
    if (!keysEqual(manifest, ["schemaVersion", "contract", "contractVersion", "generatedAt", "datasetVersion", "fileName", "compression", "sha256", "sizeBytes", "uncompressedSha256", "uncompressedSizeBytes", "recordCount", "source", "coverageFile", "coverageSha256", "coverageSizeBytes", "validationFile", "validationSha256", "validationSizeBytes"])
        || manifest.schemaVersion !== 1 || manifest.contract !== "dokkan-database-character-structural-identity-manifest"
        || manifest.contractVersion !== structural_sidecar_contract_1.CHARACTER_STRUCTURAL_SIDECAR_CONTRACT_VERSION || manifest.generatedAt !== structural_sidecar_contract_1.CHARACTER_STRUCTURAL_SIDECAR_SOURCE_PIN.productiveCharacters.datasetVersion
        || manifest.datasetVersion !== `${structural_sidecar_contract_1.CHARACTER_STRUCTURAL_SIDECAR_SOURCE_PIN.snapshotVersion}-k32-structural-identity-v1`
        || manifest.fileName !== structural_sidecar_contract_1.CHARACTER_STRUCTURAL_SIDECAR_FILES.payload || manifest.coverageFile !== structural_sidecar_contract_1.CHARACTER_STRUCTURAL_SIDECAR_FILES.coverage
        || manifest.validationFile !== structural_sidecar_contract_1.CHARACTER_STRUCTURAL_SIDECAR_FILES.validation || manifest.compression !== "gzip"
        || JSON.stringify(manifest.source) !== JSON.stringify(pinnedCharacterStructuralSidecarLineage()))
        throw new Error("K32 manifest contract or lineage rejected");
    const [payloadSnapshot, coverageSnapshot, validationSnapshot] = await Promise.all([
        readArtifactSnapshot(root, manifest.fileName), readArtifactSnapshot(root, manifest.coverageFile), readArtifactSnapshot(root, manifest.validationFile),
    ]);
    if (payloadSnapshot.bytes.length !== manifest.sizeBytes || hash(payloadSnapshot.bytes) !== manifest.sha256
        || payloadSnapshot.bytes.length > structural_sidecar_contract_1.CHARACTER_STRUCTURAL_SIDECAR_GZIP_BUDGET_BYTES)
        throw new Error("K32 payload identity rejected");
    if (coverageSnapshot.bytes.length !== manifest.coverageSizeBytes || hash(coverageSnapshot.bytes) !== manifest.coverageSha256)
        throw new Error("K32 coverage identity rejected");
    if (validationSnapshot.bytes.length !== manifest.validationSizeBytes || hash(validationSnapshot.bytes) !== manifest.validationSha256)
        throw new Error("K32 validation identity rejected");
    const raw = await gunzipBounded(payloadSnapshot.bytes);
    if (raw.length !== manifest.uncompressedSizeBytes || hash(raw) !== manifest.uncompressedSha256)
        throw new Error("K32 raw payload identity rejected");
    const sidecar = JSON.parse(raw.toString("utf8"));
    const canonicalRaw = Buffer.from(`${JSON.stringify(sidecar)}\n`, "utf8");
    if (!raw.equals(canonicalRaw) || !(0, zlib_1.gzipSync)(canonicalRaw, { level: 9 }).equals(payloadSnapshot.bytes))
        throw new Error("K32 canonical JSON or deterministic gzip rejected");
    const coverage = JSON.parse(coverageSnapshot.bytes.toString("utf8"));
    const validation = JSON.parse(validationSnapshot.bytes.toString("utf8"));
    const expectedValidation = validateCharacterStructuralSidecarIntegrityOnly(sidecar, coverage, { rawSizeBytes: raw.length, gzipSizeBytes: payloadSnapshot.bytes.length });
    if (!expectedValidation.valid || JSON.stringify(validation) !== JSON.stringify(expectedValidation) || manifest.recordCount !== sidecar.records.length) {
        throw new Error(`K32 validation metadata rejected: ${expectedValidation.failures.join("; ")}`);
    }
    const [manifestAfter, payloadAfter, coverageAfter, validationAfter] = await Promise.all([
        readArtifactSnapshot(root, structural_sidecar_contract_1.CHARACTER_STRUCTURAL_SIDECAR_FILES.manifest), readArtifactSnapshot(root, manifest.fileName),
        readArtifactSnapshot(root, manifest.coverageFile), readArtifactSnapshot(root, manifest.validationFile),
    ]);
    [manifestSnapshot, payloadSnapshot, coverageSnapshot, validationSnapshot].forEach((item, index) => assertUnchanged(item, [manifestAfter, payloadAfter, coverageAfter, validationAfter][index]));
    return { manifest, sidecar, coverage, validation, snapshots: [manifestSnapshot, payloadSnapshot, coverageSnapshot, validationSnapshot] };
}
exports.validateCharacterStructuralSidecarArtifactIntegrityOnly = validateCharacterStructuralSidecarArtifactIntegrityOnly;
async function validateCharacterStructuralSidecarArtifact(options) {
    if (!options?.artifactRoot || !options.k2Root || !options.productiveRoot) {
        throw new Error("K32 source-bound validation requires artifactRoot, k2Root and productiveRoot");
    }
    const source = await (0, structural_sidecar_source_1.loadCharacterStructuralSidecarSource)(options);
    const actual = await validateCharacterStructuralSidecarArtifactIntegrityOnly(options.artifactRoot);
    const rebuilt = (0, structural_sidecar_builder_1.buildCharacterStructuralSidecar)(source.taxonomy, source.productive, source.lineage);
    const expected = materializeCharacterStructuralSidecar(rebuilt.sidecar, rebuilt.coverage);
    const comparisons = [
        ["canonical raw payload", Buffer.from(`${JSON.stringify(actual.sidecar)}\n`, "utf8"), expected.raw],
        ["gzip payload", actual.snapshots[1].bytes, expected.gzip],
        ["coverage metadata", actual.snapshots[2].bytes, expected.coverageBytes],
        ["validation metadata", actual.snapshots[3].bytes, expected.validationBytes],
        ["manifest metadata", actual.snapshots[0].bytes, expected.manifestBytes],
    ];
    for (const [label, actualBytes, expectedBytes] of comparisons) {
        if (!actualBytes.equals(expectedBytes))
            throw new Error(`K32 source-bound artifact mismatch: ${label}`);
    }
    await source.revalidate();
    const root = await regularRoot(options.artifactRoot);
    const after = await Promise.all([
        readArtifactSnapshot(root, structural_sidecar_contract_1.CHARACTER_STRUCTURAL_SIDECAR_FILES.manifest),
        readArtifactSnapshot(root, structural_sidecar_contract_1.CHARACTER_STRUCTURAL_SIDECAR_FILES.payload),
        readArtifactSnapshot(root, structural_sidecar_contract_1.CHARACTER_STRUCTURAL_SIDECAR_FILES.coverage),
        readArtifactSnapshot(root, structural_sidecar_contract_1.CHARACTER_STRUCTURAL_SIDECAR_FILES.validation),
    ]);
    actual.snapshots.forEach((item, index) => assertUnchanged(item, after[index]));
    return {
        manifest: actual.manifest,
        sidecar: actual.sidecar,
        coverage: actual.coverage,
        validation: actual.validation,
        sourceBoundValidation: {
            status: "GO",
            sourceRootsRevalidated: true,
            exactArtifactBytesMatched: true,
        },
    };
}
exports.validateCharacterStructuralSidecarArtifact = validateCharacterStructuralSidecarArtifact;
//# sourceMappingURL=structural-sidecar-validator.js.map