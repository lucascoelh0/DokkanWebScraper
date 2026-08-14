"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateTaxonomyProjectionArtifact = exports.materializeTaxonomyProjection = exports.validateTaxonomyProjection = void 0;
const fs_1 = require("fs");
const crypto_1 = require("crypto");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const stream_1 = require("stream");
const zlib_1 = require("zlib");
const card_scope_run_1 = require("./card-scope-run");
const structural_sidecar_validator_1 = require("./structural-sidecar-validator");
const taxonomy_projection_builder_1 = require("./taxonomy-projection-builder");
const taxonomy_projection_contract_1 = require("./taxonomy-projection-contract");
const hash = (bytes) => (0, crypto_1.createHash)("sha256").update(bytes).digest("hex");
const jsonBytes = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
const numeric = (left, right) => Number(left) - Number(right) || left.localeCompare(right);
const samePath = (left, right) => process.platform === "win32"
    ? (0, path_1.resolve)(left).toLowerCase() === (0, path_1.resolve)(right).toLowerCase()
    : (0, path_1.resolve)(left) === (0, path_1.resolve)(right);
const sameFile = (left, right) => left.dev === right.dev && left.ino === right.ino;
const exactKeys = (value, keys) => Boolean(value) && typeof value === "object"
    && JSON.stringify(Object.keys(value)) === JSON.stringify(keys);
function countForbiddenRecordFields(value) {
    if (!value || typeof value !== "object")
        return 0;
    let count = 0;
    for (const [key, nested] of Object.entries(value)) {
        if (/label|name|title|presentation/i.test(key))
            count++;
        if (nested && typeof nested === "object")
            count += countForbiddenRecordFields(nested);
    }
    return count;
}
function validateTaxonomyProjectionShape(projection, coverage, sizes, enforcePinnedSnapshot) {
    const failures = [];
    let duplicateCardIdCount = 0;
    let unstableCardOrderCount = 0;
    let invalidCategoryOrderCount = 0;
    let invalidLinkOrderOrSlotCount = 0;
    let unsupportedDimensionIncludedCount = 0;
    let inventedEmptyDimensionCount = 0;
    let labelOrPresentationFieldCount = 0;
    let extraRecordFieldCount = 0;
    try {
        if (!exactKeys(projection, ["schemaVersion", "contract", "contractVersion", "generatedAt", "datasetVersion", "mode", "source", "policy", "records"])
            || projection.schemaVersion !== 1 || projection.contract !== "dokkan-database-character-taxonomy-projection"
            || projection.contractVersion !== taxonomy_projection_contract_1.TAXONOMY_PROJECTION_CONTRACT_VERSION
            || projection.generatedAt !== taxonomy_projection_contract_1.TAXONOMY_PROJECTION_SOURCE_PIN.generatedAt
            || projection.datasetVersion !== taxonomy_projection_contract_1.TAXONOMY_PROJECTION_SOURCE_PIN.datasetVersion
            || projection.mode !== "explicit_opt_in_offline_generation_validation_only" || !Array.isArray(projection.records)) {
            failures.push("projection contract drift");
        }
        const policy = projection.policy;
        if (!exactKeys(policy, ["recordKey", "records", "dimensions", "labelsOrPresentationIncluded", "labelsAsAuthority", "categoryOrder", "linkOrder", "missingRowEvidence", "characterShapeReadOrWritten", "applyOrOverlayApiImplemented", "consumerImplemented", "publisherImplemented", "androidImplemented"])
            || policy.recordKey !== "cardId" || policy.records !== "card_scoped" || policy.dimensions !== "supported_only"
            || policy.labelsOrPresentationIncluded || policy.labelsAsAuthority
            || policy.categoryOrder !== "numeric_category_id_then_relation_row_id" || policy.linkOrder !== "slot"
            || policy.missingRowEvidence !== "omit_dimension_without_empty_invention" || policy.characterShapeReadOrWritten
            || policy.applyOrOverlayApiImplemented || policy.consumerImplemented || policy.publisherImplemented || policy.androidImplemented) {
            failures.push("projection policy drift");
        }
        const seenCardIds = new Set();
        let previousCardId;
        for (const record of projection.records) {
            const allowedKeys = ["cardId", "characterClass", "categories", "links"].filter(key => record[key] !== undefined);
            if (!exactKeys(record, allowedKeys) || allowedKeys[0] !== "cardId")
                extraRecordFieldCount++;
            if (typeof record.cardId !== "string" || !/^\d+$/.test(record.cardId))
                failures.push("invalid cardId");
            if (seenCardIds.has(record.cardId))
                duplicateCardIdCount++;
            seenCardIds.add(record.cardId);
            if (previousCardId !== undefined && numeric(previousCardId, record.cardId) >= 0)
                unstableCardOrderCount++;
            previousCardId = record.cardId;
            labelOrPresentationFieldCount += countForbiddenRecordFields(record);
            if (record.characterClass !== undefined) {
                const raw = record.characterClass.raw;
                if (!exactKeys(record.characterClass, ["raw", "normalized"]) || typeof record.characterClass.normalized !== "string"
                    || raw !== null && !["string", "number", "boolean"].includes(typeof raw))
                    unsupportedDimensionIncludedCount++;
            }
            if (record.categories !== undefined) {
                if (!Array.isArray(record.categories) || record.categories.length === 0)
                    inventedEmptyDimensionCount++;
                const relationRows = new Set();
                for (let index = 0; index < (record.categories ?? []).length; index++) {
                    const item = record.categories[index];
                    if (!exactKeys(item, ["categoryId", "relationRowId"]) || !/^\d+$/.test(item.categoryId) || !/^\d+$/.test(item.relationRowId)
                        || relationRows.has(item.relationRowId))
                        invalidCategoryOrderCount++;
                    relationRows.add(item.relationRowId);
                    if (index > 0) {
                        const previous = record.categories[index - 1];
                        if (numeric(previous.categoryId, item.categoryId) > 0
                            || numeric(previous.categoryId, item.categoryId) === 0 && numeric(previous.relationRowId, item.relationRowId) >= 0) {
                            invalidCategoryOrderCount++;
                        }
                    }
                }
            }
            if (record.links !== undefined) {
                if (!Array.isArray(record.links) || record.links.length === 0)
                    inventedEmptyDimensionCount++;
                const slots = new Set();
                for (let index = 0; index < (record.links ?? []).length; index++) {
                    const item = record.links[index];
                    if (!exactKeys(item, ["slot", "linkSkillId"]) || !Number.isInteger(item.slot) || item.slot < 1 || item.slot > 7
                        || !/^\d+$/.test(item.linkSkillId) || slots.has(item.slot)
                        || index > 0 && record.links[index - 1].slot >= item.slot)
                        invalidLinkOrderOrSlotCount++;
                    slots.add(item.slot);
                }
            }
        }
        if (duplicateCardIdCount)
            failures.push("duplicate cardId");
        if (unstableCardOrderCount)
            failures.push("unstable card order");
        if (invalidCategoryOrderCount)
            failures.push("invalid category identity or order");
        if (invalidLinkOrderOrSlotCount)
            failures.push("invalid link identity, slot or order");
        if (unsupportedDimensionIncludedCount)
            failures.push("unsupported dimension representation included");
        if (inventedEmptyDimensionCount)
            failures.push("empty dimension invented without row evidence");
        if (labelOrPresentationFieldCount)
            failures.push("label or presentation field included");
        if (extraRecordFieldCount)
            failures.push("extra record field included");
        validateCoverage(projection, coverage, failures, enforcePinnedSnapshot);
        if (enforcePinnedSnapshot)
            validatePinnedLineage(projection, failures);
    }
    catch {
        failures.push("projection shape rejected");
    }
    if (sizes.rawSizeBytes > taxonomy_projection_contract_1.TAXONOMY_PROJECTION_RAW_LIMIT_BYTES)
        failures.push("raw byte budget exceeded");
    if (sizes.gzipSizeBytes > taxonomy_projection_contract_1.TAXONOMY_PROJECTION_GZIP_LIMIT_BYTES)
        failures.push("gzip byte budget exceeded");
    const uniqueFailures = [...new Set(failures)].sort();
    return {
        schemaVersion: 1,
        contract: "dokkan-database-character-taxonomy-projection-validation",
        contractVersion: taxonomy_projection_contract_1.TAXONOMY_PROJECTION_CONTRACT_VERSION,
        valid: uniqueFailures.length === 0,
        failureCount: uniqueFailures.length,
        failures: uniqueFailures.slice(0, taxonomy_projection_contract_1.TAXONOMY_PROJECTION_MAX_EXAMPLES),
        failuresTruncated: uniqueFailures.length > taxonomy_projection_contract_1.TAXONOMY_PROJECTION_MAX_EXAMPLES,
        sizes: {
            rawMaximumBytes: taxonomy_projection_contract_1.TAXONOMY_PROJECTION_RAW_LIMIT_BYTES,
            gzipMaximumBytes: taxonomy_projection_contract_1.TAXONOMY_PROJECTION_GZIP_LIMIT_BYTES,
            rawSizeBytes: sizes.rawSizeBytes,
            gzipSizeBytes: sizes.gzipSizeBytes,
        },
        safety: {
            duplicateCardIdCount,
            unstableCardOrderCount,
            invalidCategoryOrderCount,
            invalidLinkOrderOrSlotCount,
            unsupportedDimensionIncludedCount,
            inventedEmptyDimensionCount,
            labelOrPresentationFieldCount,
            extraRecordFieldCount,
            networkRequestCount: 0,
            characterReadOrWriteCount: 0,
            outputNamespaceThreatModel: "caller_controlled_stable_during_operation",
        },
        sourceGates: {
            k32SourceBoundBeforeAndAfter: "REQUIRED",
            k34InProcessAgainstPinnedRoots: "REQUIRED",
            acceptedK34Conclusion: "stable_for_exact_pinned_profile",
            acceptedK34ProductiveGates: "NO-GO_ONLY",
        },
        readiness: {
            offlineGeneration: "GO",
            offlineSourceBoundValidation: "GO",
            consumption: "NO-GO",
            publication: "NO-GO",
            production: "NO-GO",
            authorityPromotion: "NO-GO",
            applyOrOverlay: "NO-GO",
            characterMutation: "NO-GO",
            r2: "NO-GO",
            android: "NO-GO",
            fyiRemoval: "NO-GO",
            dokkanInfoRemoval: "NO-GO",
        },
    };
}
function validateCoverage(projection, coverage, failures, enforcePinnedSnapshot) {
    if (!exactKeys(coverage, ["schemaVersion", "contract", "contractVersion", "sourceCardCount", "projectedCardCount", "dimensions"])
        || coverage.schemaVersion !== 1 || coverage.contract !== "dokkan-database-character-taxonomy-projection-coverage"
        || coverage.contractVersion !== taxonomy_projection_contract_1.TAXONOMY_PROJECTION_CONTRACT_VERSION || coverage.projectedCardCount !== projection.records.length
        || coverage.sourceCardCount !== projection.records.length)
        failures.push("coverage contract or cardinality drift");
    const dimensions = ["characterClass", "categories", "links"];
    for (const dimension of dimensions) {
        const item = coverage.dimensions[dimension];
        if (!exactKeys(item, ["includedCardCount", "includedFactCount", "excludedCardCount", "excludedFactCount", "exclusions", "examples"])
            || item.includedCardCount + item.excludedCardCount !== coverage.sourceCardCount
            || Object.values(item.exclusions).some(value => !Number.isInteger(value) || value < 0)
            || Object.values(item.examples).some(values => !Array.isArray(values) || values.length > taxonomy_projection_contract_1.TAXONOMY_PROJECTION_MAX_EXAMPLES)
            || Object.values(item.exclusions).reduce((sum, value) => sum + value, 0) !== item.excludedCardCount) {
            failures.push(`invalid ${dimension} coverage`);
        }
        const includedCards = projection.records.filter(record => record[dimension] !== undefined);
        const factCount = dimension === "characterClass" ? includedCards.length
            : includedCards.reduce((sum, record) => sum + (record[dimension]?.length ?? 0), 0);
        if (includedCards.length !== item.includedCardCount || factCount !== item.includedFactCount)
            failures.push(`${dimension} included coverage mismatch`);
    }
    if (enforcePinnedSnapshot) {
        const expected = taxonomy_projection_contract_1.TAXONOMY_PROJECTION_SOURCE_PIN.expected;
        if (coverage.sourceCardCount !== expected.cardCount
            || coverage.dimensions.characterClass.includedCardCount !== expected.characterClassIncludedCardCount
            || coverage.dimensions.categories.includedCardCount !== expected.categoryIncludedCardCount
            || coverage.dimensions.categories.exclusions.unknown !== expected.categoryUnknownCardCount
            || coverage.dimensions.categories.includedFactCount !== expected.categoryAssignmentCount
            || coverage.dimensions.links.includedCardCount !== expected.linkIncludedCardCount
            || coverage.dimensions.links.exclusions.unknown !== expected.linkUnknownCardCount
            || coverage.dimensions.links.includedFactCount !== expected.linkEntryCount)
            failures.push("pinned coverage changed");
    }
}
function validatePinnedLineage(projection, failures) {
    const source = projection.source;
    const pin = taxonomy_projection_contract_1.TAXONOMY_PROJECTION_SOURCE_PIN;
    if (source.profileId !== pin.profileId
        || source.k32.manifestSha256 !== pin.k32.manifestSha256 || source.k32.manifestSizeBytes !== pin.k32.manifestSizeBytes
        || source.k32.payloadSha256 !== pin.k32.payloadSha256 || source.k32.payloadSizeBytes !== pin.k32.payloadSizeBytes
        || source.k32.rawSha256 !== pin.k32.rawSha256 || source.k32.rawSizeBytes !== pin.k32.rawSizeBytes
        || source.k32.coverageSha256 !== pin.k32.coverageSha256 || source.k32.coverageSizeBytes !== pin.k32.coverageSizeBytes
        || source.k32.validationSha256 !== pin.k32.validationSha256 || source.k32.validationSizeBytes !== pin.k32.validationSizeBytes
        || source.k32.sourceBoundValidation !== "GO"
        || source.k2.manifestSha256 !== pin.k2.manifestSha256 || source.k2.manifestSizeBytes !== pin.k2.manifestSizeBytes
        || source.k2.payloadSha256 !== pin.k2.payloadSha256 || source.k2.payloadSizeBytes !== pin.k2.payloadSizeBytes
        || source.k2.coverageSha256 !== pin.k2.coverageSha256 || source.k2.coverageSizeBytes !== pin.k2.coverageSizeBytes
        || source.k2.validationSha256 !== pin.k2.validationSha256 || source.k2.validationSizeBytes !== pin.k2.validationSizeBytes
        || source.k34.profileId !== pin.k34.profileId || source.k34.reportSha256 !== pin.k34.reportSha256
        || source.k34.reportSizeBytes !== pin.k34.reportSizeBytes || source.k34.inProcessValidation !== "GO"
        || source.sqlite.sha256 !== pin.sqlite.sha256 || source.sqlite.sizeBytes !== pin.sqlite.sizeBytes
        || source.db1.sha256 !== pin.db1.sha256 || source.db1.sizeBytes !== pin.db1.sizeBytes
        || source.elf.sha256 !== pin.elf.sha256 || source.elf.sizeBytes !== pin.elf.sizeBytes || source.elf.format !== pin.elf.format
        || source.nativeLayout.sha256 !== pin.nativeLayout.sha256 || source.nativeLayout.sizeBytes !== pin.nativeLayout.sizeBytes) {
        failures.push("pinned source lineage changed");
    }
}
function validateTaxonomyProjection(projection, coverage, sizes) {
    return validateTaxonomyProjectionShape(projection, coverage, sizes, true);
}
exports.validateTaxonomyProjection = validateTaxonomyProjection;
function materializeTaxonomyProjection(projection, coverage) {
    const raw = Buffer.from(`${JSON.stringify(projection)}\n`, "utf8");
    if (raw.length > taxonomy_projection_contract_1.TAXONOMY_PROJECTION_RAW_LIMIT_BYTES)
        throw new Error(`K35 raw byte budget exceeded: ${raw.length}`);
    const gzip = (0, zlib_1.gzipSync)(raw, { level: 9 });
    if (gzip.length > taxonomy_projection_contract_1.TAXONOMY_PROJECTION_GZIP_LIMIT_BYTES)
        throw new Error(`K35 gzip byte budget exceeded: ${gzip.length}`);
    const validation = validateTaxonomyProjection(projection, coverage, { rawSizeBytes: raw.length, gzipSizeBytes: gzip.length });
    if (!validation.valid)
        throw new Error(`K35 projection validation failed: ${validation.failures.join("; ")}`);
    const coverageBytes = jsonBytes(coverage);
    const validationBytes = jsonBytes(validation);
    const payloadSha256 = hash(gzip);
    const manifest = {
        schemaVersion: 1,
        contract: "dokkan-database-character-taxonomy-projection-manifest",
        contractVersion: taxonomy_projection_contract_1.TAXONOMY_PROJECTION_CONTRACT_VERSION,
        generatedAt: projection.generatedAt,
        datasetVersion: projection.datasetVersion,
        fileName: `database-characters-k35-taxonomy-projection.${payloadSha256}.json.gz`,
        compression: "gzip",
        sha256: payloadSha256,
        sizeBytes: gzip.length,
        uncompressedSha256: hash(raw),
        uncompressedSizeBytes: raw.length,
        recordCount: projection.records.length,
        source: projection.source,
        coverageFile: taxonomy_projection_contract_1.TAXONOMY_PROJECTION_FILES.coverage,
        coverageSha256: hash(coverageBytes),
        coverageSizeBytes: coverageBytes.length,
        validationFile: taxonomy_projection_contract_1.TAXONOMY_PROJECTION_FILES.validation,
        validationSha256: hash(validationBytes),
        validationSizeBytes: validationBytes.length,
    };
    const manifestBytes = jsonBytes(manifest);
    const release = taxonomy_projection_contract_1.TAXONOMY_PROJECTION_SOURCE_PIN.release;
    if (payloadSha256 !== release.payloadSha256 || gzip.length !== release.payloadSizeBytes
        || manifest.uncompressedSha256 !== release.rawSha256 || raw.length !== release.rawSizeBytes
        || manifest.coverageSha256 !== release.coverageSha256 || coverageBytes.length !== release.coverageSizeBytes
        || manifest.validationSha256 !== release.validationSha256 || validationBytes.length !== release.validationSizeBytes
        || hash(manifestBytes) !== release.manifestSha256 || manifestBytes.length !== release.manifestSizeBytes) {
        throw new Error("K35 pinned release identity changed");
    }
    return { projection, coverage, validation, manifest, raw, gzip, coverageBytes, validationBytes, manifestBytes };
}
exports.materializeTaxonomyProjection = materializeTaxonomyProjection;
async function regularRoot(value) {
    const root = (0, path_1.resolve)(value);
    const metadata = await (0, promises_1.lstat)(root);
    if (!metadata.isDirectory() || metadata.isSymbolicLink())
        throw new Error("K35 artifact root must be an existing regular non-link directory");
    const canonical = await (0, promises_1.realpath)(root);
    if (!samePath(root, canonical))
        throw new Error("K35 artifact root symlink or junction rejected");
    return canonical;
}
async function readSnapshot(root, fileName) {
    if (!/^[a-z0-9][a-z0-9.-]+$/.test(fileName) || fileName.includes("..") || fileName.includes("/") || fileName.includes("\\")) {
        throw new Error("K35 artifact member name rejected");
    }
    const path = (0, path_1.join)(root, fileName);
    if (!samePath(path, (0, path_1.resolve)(root, fileName)))
        throw new Error("K35 artifact path escaped root");
    const before = await (0, promises_1.lstat)(path);
    if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1)
        throw new Error(`K35 ${fileName} must be a single-link regular file`);
    const handle = await (0, promises_1.open)(path, fs_1.constants.O_RDONLY | (fs_1.constants.O_NOFOLLOW ?? 0));
    try {
        const opened = await handle.stat();
        if (!sameFile(before, opened))
            throw new Error(`K35 ${fileName} identity changed while opening`);
        const bytes = await handle.readFile();
        const after = await handle.stat();
        const pathAfter = await (0, promises_1.lstat)(path);
        if (!sameFile(opened, after) || !sameFile(opened, pathAfter) || after.size !== bytes.length
            || after.mtimeMs !== opened.mtimeMs || after.ctimeMs !== opened.ctimeMs)
            throw new Error(`K35 ${fileName} changed while reading`);
        return { path, bytes, metadata: after };
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
        if (size > taxonomy_projection_contract_1.TAXONOMY_PROJECTION_RAW_LIMIT_BYTES) {
            stream.destroy();
            throw new Error("K35 raw byte budget exceeded during decompression");
        }
        chunks.push(value);
    }
    return Buffer.concat(chunks, size);
}
function unchanged(before, after) {
    if (!samePath(before.path, after.path) || !sameFile(before.metadata, after.metadata) || !before.bytes.equals(after.bytes)) {
        throw new Error(`K35 artifact mutated during validation: ${before.path}`);
    }
}
async function loadArtifact(rootValue) {
    const root = await regularRoot(rootValue);
    const manifestSnapshot = await readSnapshot(root, taxonomy_projection_contract_1.TAXONOMY_PROJECTION_FILES.manifest);
    const manifest = JSON.parse(manifestSnapshot.bytes.toString("utf8"));
    const payloadMatch = /^database-characters-k35-taxonomy-projection\.([a-f0-9]{64})\.json\.gz$/.exec(manifest.fileName);
    if (!exactKeys(manifest, ["schemaVersion", "contract", "contractVersion", "generatedAt", "datasetVersion", "fileName", "compression", "sha256", "sizeBytes", "uncompressedSha256", "uncompressedSizeBytes", "recordCount", "source", "coverageFile", "coverageSha256", "coverageSizeBytes", "validationFile", "validationSha256", "validationSizeBytes"])
        || manifest.schemaVersion !== 1 || manifest.contract !== "dokkan-database-character-taxonomy-projection-manifest"
        || manifest.contractVersion !== taxonomy_projection_contract_1.TAXONOMY_PROJECTION_CONTRACT_VERSION || manifest.generatedAt !== taxonomy_projection_contract_1.TAXONOMY_PROJECTION_SOURCE_PIN.generatedAt
        || manifest.datasetVersion !== taxonomy_projection_contract_1.TAXONOMY_PROJECTION_SOURCE_PIN.datasetVersion || manifest.compression !== "gzip"
        || !payloadMatch || payloadMatch[1] !== manifest.sha256 || manifest.coverageFile !== taxonomy_projection_contract_1.TAXONOMY_PROJECTION_FILES.coverage
        || manifest.validationFile !== taxonomy_projection_contract_1.TAXONOMY_PROJECTION_FILES.validation)
        throw new Error("K35 manifest contract rejected");
    const [payloadSnapshot, coverageSnapshot, validationSnapshot] = await Promise.all([
        readSnapshot(root, manifest.fileName),
        readSnapshot(root, manifest.coverageFile),
        readSnapshot(root, manifest.validationFile),
    ]);
    if (payloadSnapshot.bytes.length !== manifest.sizeBytes || hash(payloadSnapshot.bytes) !== manifest.sha256
        || payloadSnapshot.bytes.length > taxonomy_projection_contract_1.TAXONOMY_PROJECTION_GZIP_LIMIT_BYTES)
        throw new Error("K35 payload identity rejected");
    if (coverageSnapshot.bytes.length !== manifest.coverageSizeBytes || hash(coverageSnapshot.bytes) !== manifest.coverageSha256) {
        throw new Error("K35 coverage identity rejected");
    }
    if (validationSnapshot.bytes.length !== manifest.validationSizeBytes || hash(validationSnapshot.bytes) !== manifest.validationSha256) {
        throw new Error("K35 validation identity rejected");
    }
    const raw = await gunzipBounded(payloadSnapshot.bytes);
    if (raw.length !== manifest.uncompressedSizeBytes || hash(raw) !== manifest.uncompressedSha256)
        throw new Error("K35 raw payload identity rejected");
    const projection = JSON.parse(raw.toString("utf8"));
    const canonicalRaw = Buffer.from(`${JSON.stringify(projection)}\n`, "utf8");
    if (!raw.equals(canonicalRaw) || !(0, zlib_1.gzipSync)(canonicalRaw, { level: 9 }).equals(payloadSnapshot.bytes)) {
        throw new Error("K35 canonical JSON or deterministic gzip rejected");
    }
    const coverage = JSON.parse(coverageSnapshot.bytes.toString("utf8"));
    const validation = JSON.parse(validationSnapshot.bytes.toString("utf8"));
    const expectedValidation = validateTaxonomyProjection(projection, coverage, { rawSizeBytes: raw.length, gzipSizeBytes: payloadSnapshot.bytes.length });
    if (!expectedValidation.valid || JSON.stringify(expectedValidation) !== JSON.stringify(validation) || manifest.recordCount !== projection.records.length) {
        throw new Error("K35 validation receipt rejected");
    }
    return {
        artifacts: {
            projection, coverage, validation, manifest, raw, gzip: payloadSnapshot.bytes,
            coverageBytes: coverageSnapshot.bytes, validationBytes: validationSnapshot.bytes, manifestBytes: manifestSnapshot.bytes,
        },
        snapshots: [manifestSnapshot, payloadSnapshot, coverageSnapshot, validationSnapshot],
    };
}
async function validateTaxonomyProjectionArtifact(options) {
    if (!options?.artifactRoot || !options.k32Root || !options.k2Root || !options.productiveRoot || !options.sqliteRoot
        || !options.db1Root || !options.elfRoot || !options.nativeEvidenceRoot) {
        throw new Error("K35 source-bound validation requires artifact, K32, K2, productive, SQLite, DB1, ELF and native-evidence roots");
    }
    const actual = await loadArtifact(options.artifactRoot);
    const k32 = await (0, structural_sidecar_validator_1.validateCharacterStructuralSidecarArtifact)({
        artifactRoot: options.k32Root,
        k2Root: options.k2Root,
        productiveRoot: options.productiveRoot,
    });
    const k34Run = await (0, card_scope_run_1.runCardScopeAudit)({
        optIn: true,
        sqliteRoot: options.sqliteRoot,
        db1Root: options.db1Root,
        k2Root: options.k2Root,
        elfRoot: options.elfRoot,
        nativeEvidenceRoot: options.nativeEvidenceRoot,
    });
    const sources = {
        k32,
        k34Report: JSON.parse(k34Run.stdout),
        k34Stdout: k34Run.stdout,
    };
    const rebuilt = (0, taxonomy_projection_builder_1.buildTaxonomyProjection)(sources);
    const expected = materializeTaxonomyProjection(rebuilt.projection, rebuilt.coverage);
    for (const [label, actualBytes, expectedBytes] of [
        ["raw payload", actual.artifacts.raw, expected.raw],
        ["gzip payload", actual.artifacts.gzip, expected.gzip],
        ["coverage", actual.artifacts.coverageBytes, expected.coverageBytes],
        ["validation", actual.artifacts.validationBytes, expected.validationBytes],
        ["manifest", actual.artifacts.manifestBytes, expected.manifestBytes],
    ]) {
        if (!actualBytes.equals(expectedBytes))
            throw new Error(`K35 source-bound artifact mismatch: ${label}`);
    }
    const root = await regularRoot(options.artifactRoot);
    const after = await Promise.all([
        readSnapshot(root, taxonomy_projection_contract_1.TAXONOMY_PROJECTION_FILES.manifest),
        readSnapshot(root, actual.artifacts.manifest.fileName),
        readSnapshot(root, taxonomy_projection_contract_1.TAXONOMY_PROJECTION_FILES.coverage),
        readSnapshot(root, taxonomy_projection_contract_1.TAXONOMY_PROJECTION_FILES.validation),
    ]);
    actual.snapshots.forEach((snapshot, index) => unchanged(snapshot, after[index]));
    return {
        artifacts: actual.artifacts,
        sourceBoundValidation: { status: "GO", k32Revalidated: true, k34RevalidatedInProcess: true, exactArtifactBytesMatched: true },
        peakNestedRssBytes: k34Run.peakRssBytes,
    };
}
exports.validateTaxonomyProjectionArtifact = validateTaxonomyProjectionArtifact;
//# sourceMappingURL=taxonomy-projection-validator.js.map