"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateCharacterCompactArtifact = exports.buildCharacterCompactReadiness = exports.validateCharacterCompactProjection = exports.pinnedCharacterCompactLineage = void 0;
const crypto_1 = require("crypto");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const stream_1 = require("stream");
const zlib_1 = require("zlib");
const character_1 = require("../character");
const artifact_path_1 = require("../artifact-path");
const artifact_path_2 = require("./artifact-path");
const compact_contract_1 = require("./compact-contract");
const refresh_contract_1 = require("./refresh-contract");
const shadow_release_1 = require("./shadow-release");
const hash = (bytes) => (0, crypto_1.createHash)("sha256").update(bytes).digest("hex");
const keysEqual = (value, keys) => !!value && typeof value === "object" && !Array.isArray(value)
    && JSON.stringify(Object.keys(value).sort()) === JSON.stringify(keys.slice().sort());
const numeric = (left, right) => Number(left) - Number(right) || left.localeCompare(right);
const rarities = new Set(Object.values(character_1.Rarities));
const types = new Set(Object.values(character_1.Types));
function pinnedCharacterCompactLineage() {
    const gate = (name) => {
        const profile = refresh_contract_1.CHARACTER_REFRESH_PROFILE.sidecars.find(item => item.gate === name);
        return { contractVersion: profile.contractVersion, sha256: profile.artifact.sha256, sizeBytes: profile.artifact.sizeBytes };
    };
    return {
        profileId: refresh_contract_1.CHARACTER_REFRESH_PROFILE.profileId,
        snapshotVersion: refresh_contract_1.CHARACTER_REFRESH_PROFILE.snapshotVersion,
        database: { ...refresh_contract_1.CHARACTER_REFRESH_PROFILE.sqlite },
        db1: { ...refresh_contract_1.CHARACTER_REFRESH_PROFILE.db1 },
        k0: gate("k0"),
        k1: gate("k1"),
        k2: gate("k2"),
        k11: {
            contractVersion: "1.0.0",
            sha256: shadow_release_1.CHARACTER_SHADOW_PINNED_RELEASE.artifactSha256,
            sizeBytes: shadow_release_1.CHARACTER_SHADOW_PINNED_RELEASE.artifactSizeBytes,
            uncompressedSha256: shadow_release_1.CHARACTER_SHADOW_PINNED_RELEASE.uncompressedSha256,
            uncompressedSizeBytes: shadow_release_1.CHARACTER_SHADOW_PINNED_RELEASE.uncompressedSizeBytes,
        },
        k12: { contractVersion: "1.0.0", sha256: shadow_release_1.CHARACTER_SHADOW_PINNED_RELEASE.coverageSha256, sizeBytes: shadow_release_1.CHARACTER_SHADOW_PINNED_RELEASE.coverageSizeBytes },
        k13: { contractVersion: "1.0.0", sha256: "f6db1919c3caac43c54508e3e4022ea70f6e318ddab86c6b2efc1ce9316f2319", sizeBytes: 365 },
        k14: { contractVersion: "1.0.1", sha256: "4773a9f3ae7019b4b5d9b133329aebe15db92ca2b9db242dc226890156344b2f", sizeBytes: 54486 },
        productionCharacters: { sha256: "421c8fec6f7ba22e270af19b2278da4fbba19b6299205a54cc3d1ed570319dbc", sizeBytes: 121390313, characterCount: 4090 },
    };
}
exports.pinnedCharacterCompactLineage = pinnedCharacterCompactLineage;
function validateCharacterCompactProjection(projection, coverage, sizes = { gzipSizeBytes: 0, rawSizeBytes: 0 }, enforcePinnedSnapshot = false) {
    const failures = [];
    let duplicateCardIdCount = 0;
    let unstableOrderCount = 0;
    let invalidEnumCount = 0;
    let extraFieldCount = 0;
    let missingBindingCount = 0;
    try {
        if (!keysEqual(projection, ["schemaVersion", "contract", "contractVersion", "generatedAt", "datasetVersion", "source", "policy", "records"]))
            failures.push("projection fields");
        if (projection?.schemaVersion !== 1 || projection.contract !== "dokkan-database-character-compact-shadow" || projection.contractVersion !== compact_contract_1.CHARACTER_COMPACT_CONTRACT_VERSION)
            failures.push("projection schema");
        if (projection.generatedAt !== refresh_contract_1.CHARACTER_REFRESH_PROFILE.generatedAt || projection.datasetVersion !== `${refresh_contract_1.CHARACTER_REFRESH_PROFILE.snapshotVersion}-k15-v1`)
            failures.push("deterministic version");
        if (JSON.stringify(projection.source) !== JSON.stringify(pinnedCharacterCompactLineage()))
            failures.push("lineage mismatch");
        const canonicalPolicy = {
            id: compact_contract_1.CHARACTER_COMPACT_POLICY_ID,
            version: compact_contract_1.CHARACTER_COMPACT_POLICY_VERSION,
            approvedBy: { contract: "dokkan-database-character-field-shadow-readiness", contractVersion: "1.0.1" },
            records: "supported_only",
            fields: ["id", "rarity", "type"],
            allowedComparisons: ["agreement", "representation_gain"],
            structuralJoinOnly: true,
            externalFallbackIncluded: false,
            auditFieldsIncluded: false,
            productionModified: false,
            consumerImplemented: false,
            publisherEnabled: false,
            androidEnabled: false,
        };
        if (JSON.stringify(projection.policy) !== JSON.stringify(canonicalPolicy))
            failures.push("policy mismatch");
        if (!Array.isArray(projection.records))
            throw new Error("records missing");
        const seen = new Set();
        projection.records.forEach((record, index) => {
            if (!keysEqual(record, ["cardId", "stateId", "rarity", "type"]))
                extraFieldCount++;
            if (typeof record?.cardId !== "string" || !record.cardId || typeof record.stateId !== "string" || !record.stateId)
                missingBindingCount++;
            if (!rarities.has(record?.rarity) || !types.has(record?.type))
                invalidEnumCount++;
            if (seen.has(record?.cardId))
                duplicateCardIdCount++;
            seen.add(record?.cardId);
            if (index > 0 && numeric(projection.records[index - 1].cardId, record.cardId) >= 0)
                unstableOrderCount++;
        });
        if (duplicateCardIdCount)
            failures.push("duplicate cardId");
        if (unstableOrderCount)
            failures.push("unstable record order");
        if (invalidEnumCount)
            failures.push("unknown enum");
        if (extraFieldCount)
            failures.push("extra or audit-only record field");
        if (missingBindingCount)
            failures.push("record without binding");
        if (projection.records.length > compact_contract_1.CHARACTER_COMPACT_EXPECTATIONS.recordCount)
            failures.push("record count exceeds K14 approval");
        if (coverage)
            validateCoverage(projection, coverage, failures, enforcePinnedSnapshot);
        if (enforcePinnedSnapshot && projection.records.length !== compact_contract_1.CHARACTER_COMPACT_EXPECTATIONS.recordCount)
            failures.push("pinned record count");
    }
    catch {
        failures.push("projection shape");
    }
    if (sizes.rawSizeBytes > compact_contract_1.CHARACTER_COMPACT_RAW_BUDGET_BYTES)
        failures.push("raw budget exceeded");
    if (sizes.gzipSizeBytes > compact_contract_1.CHARACTER_COMPACT_GZIP_BUDGET_BYTES)
        failures.push("gzip budget exceeded");
    return {
        schemaVersion: 1,
        contract: "dokkan-database-character-compact-shadow-validation",
        contractVersion: compact_contract_1.CHARACTER_COMPACT_CONTRACT_VERSION,
        valid: failures.length === 0,
        failures: [...new Set(failures)].sort(),
        budgets: {
            gzipMaximumBytes: compact_contract_1.CHARACTER_COMPACT_GZIP_BUDGET_BYTES,
            rawMaximumBytes: compact_contract_1.CHARACTER_COMPACT_RAW_BUDGET_BYTES,
            gzipSizeBytes: sizes.gzipSizeBytes,
            rawSizeBytes: sizes.rawSizeBytes,
        },
        safety: {
            duplicateCardIdCount, unstableOrderCount, invalidEnumCount, extraFieldCount, missingBindingCount,
            externalFallbackCount: 0,
            productionFilesWritten: false,
            characterMergeApiImplemented: false,
            runtimeK11ReadImplemented: false,
        },
    };
}
exports.validateCharacterCompactProjection = validateCharacterCompactProjection;
function validateCoverage(projection, coverage, failures, pinned) {
    if (!keysEqual(coverage, ["schemaVersion", "contract", "contractVersion", "databaseCardCount", "recordCount", "excludedCardCount", "exclusions", "comparisons", "catalogImpact"]))
        failures.push("coverage fields");
    if (coverage.schemaVersion !== 1 || coverage.contract !== "dokkan-database-character-compact-shadow-coverage" || coverage.contractVersion !== "1.0.0")
        failures.push("coverage schema");
    if (coverage.recordCount !== projection.records.length || coverage.excludedCardCount !== coverage.databaseCardCount - coverage.recordCount)
        failures.push("coverage cardinality");
    if (!keysEqual(coverage.exclusions, ["unjoinable", "partial", "unknown", "mismatch", "conflict", "invalidEnum", "ambiguousBinding", "incomplete"]))
        failures.push("coverage exclusion fields");
    if (Object.values(coverage.exclusions).some(value => !Number.isInteger(value) || value < 0))
        failures.push("coverage exclusion values");
    if (coverage.catalogImpact.charactersCreated !== 0 || coverage.catalogImpact.charactersRemoved !== 0 || coverage.catalogImpact.productionModified)
        failures.push("catalog mutation");
    if (pinned) {
        const expected = compact_contract_1.CHARACTER_COMPACT_EXPECTATIONS;
        if (coverage.databaseCardCount !== expected.databaseCardCount || coverage.recordCount !== expected.recordCount || coverage.exclusions.unjoinable !== expected.productionUnjoinableCount)
            failures.push("pinned coverage counts");
        if (Object.entries(coverage.exclusions).some(([key, value]) => key !== "unjoinable" && value !== 0))
            failures.push("unsafe pinned exclusions");
        if (coverage.comparisons.id.agreements !== expected.idAgreements || coverage.comparisons.id.representationGains !== 0
            || coverage.comparisons.rarity.agreements !== expected.rarityAgreements || coverage.comparisons.rarity.representationGains !== expected.rarityRepresentationGains
            || coverage.comparisons.type.agreements !== expected.typeAgreements || coverage.comparisons.type.representationGains !== 0)
            failures.push("pinned comparison counts");
    }
}
function buildCharacterCompactReadiness(generatedAt) {
    return {
        schemaVersion: 1,
        contract: "dokkan-database-character-compact-shadow-readiness",
        contractVersion: "1.0.0",
        generatedAt,
        status: "offline_artifact_ready_consumers_disabled",
        gates: {
            offlineGeneration: "GO", artifactValidation: "GO", inMemoryConsumer: "NO-GO", characterMutation: "NO-GO",
            android: "NO-GO", r2Publication: "NO-GO", production: "NO-GO", authorityPromotion: "NO-GO",
            fyiRemoval: "NO-GO", dokkanInfoRemoval: "NO-GO",
        },
        nextGate: {
            gate: "K16", action: "opt_in_k15_shadow_consumer", constraint: "compare_only_without_changing_effective_character_values",
            k11ConsumerInput: false, k15ConsumerInput: true,
        },
    };
}
exports.buildCharacterCompactReadiness = buildCharacterCompactReadiness;
async function exactRegularFile(root, fileName, exactName) {
    if (typeof fileName !== "string" || !(0, artifact_path_1.isDirectArtifactName)(fileName))
        throw new Error("manifest path rejected");
    if (exactName !== undefined && fileName !== exactName)
        throw new Error("manifest file name changed");
    const rootPath = (0, path_1.resolve)(root);
    const rootMetadata = await (0, promises_1.lstat)(rootPath);
    if (rootMetadata.isSymbolicLink() || !rootMetadata.isDirectory())
        throw new Error("manifest root symlink or junction rejected");
    const candidate = (0, path_1.join)(rootPath, fileName);
    const metadata = await (0, promises_1.lstat)(candidate);
    if (metadata.isSymbolicLink() || !metadata.isFile())
        throw new Error("manifest symlink or junction rejected");
    return (0, artifact_path_2.resolveCharacterInputFile)(rootPath, fileName, fileName);
}
async function gunzipBounded(bytes) {
    const chunks = [];
    let size = 0;
    const stream = stream_1.Readable.from(bytes).pipe((0, zlib_1.createGunzip)());
    for await (const chunk of stream) {
        const value = chunk;
        size += value.length;
        if (size > compact_contract_1.CHARACTER_COMPACT_RAW_BUDGET_BYTES) {
            stream.destroy();
            throw new Error("raw budget exceeded during decompression");
        }
        chunks.push(value);
    }
    return Buffer.concat(chunks, size);
}
async function validateCharacterCompactArtifact(root) {
    const manifestPath = await exactRegularFile(root, "database-characters-k15-manifest.json", "database-characters-k15-manifest.json");
    const manifestBytes = await (0, promises_1.readFile)(manifestPath);
    const manifest = JSON.parse(manifestBytes.toString("utf8"));
    const manifestKeys = ["schemaVersion", "contract", "contractVersion", "generatedAt", "datasetVersion", "fileName", "compression", "sha256", "sizeBytes", "uncompressedSha256", "uncompressedSizeBytes", "recordCount", "lineage", "coverageFile", "coverageSha256", "coverageSizeBytes", "validationFile", "validationSha256", "validationSizeBytes", "readinessFile", "readinessSha256", "readinessSizeBytes"];
    if (!keysEqual(manifest, manifestKeys) || manifest.schemaVersion !== 1 || manifest.contract !== "dokkan-database-character-compact-shadow-manifest" || manifest.contractVersion !== "1.0.0" || manifest.compression !== "gzip")
        throw new Error("K15 manifest contract rejected");
    if (manifest.generatedAt !== refresh_contract_1.CHARACTER_REFRESH_PROFILE.generatedAt || manifest.datasetVersion !== `${refresh_contract_1.CHARACTER_REFRESH_PROFILE.snapshotVersion}-k15-v1` || JSON.stringify(manifest.lineage) !== JSON.stringify(pinnedCharacterCompactLineage()))
        throw new Error("K15 manifest lineage rejected");
    if (manifest.fileName !== `database-characters-k15-compact-supported.${manifest.sha256}.json.gz`)
        throw new Error("K15 content-addressed file name rejected");
    const [payloadPath, coveragePath, validationPath, readinessPath] = await Promise.all([
        exactRegularFile(root, manifest.fileName),
        exactRegularFile(root, manifest.coverageFile, "database-characters-k15-coverage.json"),
        exactRegularFile(root, manifest.validationFile, "database-characters-k15-validation.json"),
        exactRegularFile(root, manifest.readinessFile, "database-characters-k15-readiness.json"),
    ]);
    const [payloadBytes, coverageBytes, validationBytes, readinessBytes] = await Promise.all([
        (0, promises_1.readFile)(payloadPath), (0, promises_1.readFile)(coveragePath), (0, promises_1.readFile)(validationPath), (0, promises_1.readFile)(readinessPath),
    ]);
    if (payloadBytes.length !== manifest.sizeBytes || hash(payloadBytes) !== manifest.sha256 || payloadBytes.length > compact_contract_1.CHARACTER_COMPACT_GZIP_BUDGET_BYTES)
        throw new Error("K15 payload identity or gzip budget rejected");
    for (const [bytes, sha256, size, label] of [
        [coverageBytes, manifest.coverageSha256, manifest.coverageSizeBytes, "coverage"],
        [validationBytes, manifest.validationSha256, manifest.validationSizeBytes, "validation"],
        [readinessBytes, manifest.readinessSha256, manifest.readinessSizeBytes, "readiness"],
    ])
        if (bytes.length !== size || hash(bytes) !== sha256)
            throw new Error(`K15 ${label} identity rejected`);
    const raw = await gunzipBounded(payloadBytes);
    if (raw.length !== manifest.uncompressedSizeBytes || hash(raw) !== manifest.uncompressedSha256)
        throw new Error("K15 raw identity rejected");
    const projection = JSON.parse(raw.toString("utf8"));
    const coverage = JSON.parse(coverageBytes.toString("utf8"));
    const validation = JSON.parse(validationBytes.toString("utf8"));
    const readiness = JSON.parse(readinessBytes.toString("utf8"));
    const expectedValidation = validateCharacterCompactProjection(projection, coverage, { gzipSizeBytes: payloadBytes.length, rawSizeBytes: raw.length }, true);
    if (!expectedValidation.valid || JSON.stringify(validation) !== JSON.stringify(expectedValidation))
        throw new Error(`K15 validation rejected: ${expectedValidation.failures.join("; ")}`);
    if (manifest.recordCount !== projection.records.length || JSON.stringify(readiness) !== JSON.stringify(buildCharacterCompactReadiness(manifest.generatedAt)))
        throw new Error("K15 manifest/readiness cardinality rejected");
    const payloadAfterValidation = await (0, promises_1.readFile)(payloadPath);
    if (!payloadAfterValidation.equals(payloadBytes))
        throw new Error("K15 payload mutated during validation");
    return { manifest, projection, coverage, validation, readiness };
}
exports.validateCharacterCompactArtifact = validateCharacterCompactArtifact;
//# sourceMappingURL=compact-validator.js.map