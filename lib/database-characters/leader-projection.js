"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateCharacterLeaderProjectionArtifact = exports.readBoundedCharacterLeaderProjectionMember = exports.materializeCharacterLeaderProjection = exports.validateCharacterLeaderProjection = exports.buildCharacterLeaderProjection = exports.buildCharacterLeaderProjectionCoverage = exports.projectCharacterLeaderStructuralRecords = void 0;
const fs_1 = require("fs");
const crypto_1 = require("crypto");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const zlib_1 = require("zlib");
const leader_scope_contract_1 = require("./leader-scope-contract");
const leader_scope_1 = require("./leader-scope");
const leader_scope_source_1 = require("./leader-scope-source");
const leader_scope_run_1 = require("./leader-scope-run");
const state_product_projection_1 = require("./state-product-projection");
const leader_projection_contract_1 = require("./leader-projection-contract");
const hash = (bytes) => (0, crypto_1.createHash)("sha256").update(bytes).digest("hex");
const jsonBytes = (value) => Buffer.from(`${JSON.stringify(value)}\n`, "utf8");
const structuralOrder = (left, right) => left.localeCompare(right, undefined, { numeric: true });
const exactKeys = (value, keys) => JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
const refKey = (ref) => JSON.stringify([ref.table, ref.rowId]);
const cloneRefs = (values) => values.map(value => ({ table: value.table, rowId: value.rowId }));
function projectCharacterLeaderStructuralRecords(k43, k3) {
    const evaluation = (0, leader_scope_1.evaluateCharacterLeaderStructuralScope)(k43.states, k3.states);
    const k3ByState = new Map(k3.states.map(state => [state.stateId, state]));
    const states = k43.states.map(state => {
        const leader = k3ByState.get(state.stateId).leader;
        return {
            stateId: state.stateId,
            sourceStateKey: state.sourceStateKey,
            cardId: state.cardId,
            releaseState: state.releaseState,
            leader: {
                set: { table: leader.set.table, rowId: leader.set.rowId },
                effects: cloneRefs(leader.effects),
                targets: cloneRefs(leader.targets),
            },
        };
    }).sort((left, right) => structuralOrder(left.stateId, right.stateId));
    return { states, evaluation };
}
exports.projectCharacterLeaderStructuralRecords = projectCharacterLeaderStructuralRecords;
function buildCharacterLeaderProjectionCoverage(states) {
    const uniqueSets = new Set(states.map(state => refKey(state.leader.set)));
    return {
        schemaVersion: 1,
        contract: "dokkan-database-character-leader-structural-projection-coverage",
        contractVersion: leader_projection_contract_1.CHARACTER_LEADER_PROJECTION_CONTRACT_VERSION,
        states: { included: states.length, excluded: leader_scope_contract_1.CHARACTER_LEADER_SCOPE_EXCLUDED_STATE_IDS.length },
        leaderReferences: {
            uniqueSetRows: uniqueSets.size,
            effectReferences: states.reduce((sum, state) => sum + state.leader.effects.length, 0),
            targetReferences: states.reduce((sum, state) => sum + state.leader.targets.length, 0),
            multiEffectStates: states.filter(state => state.leader.effects.length > 1).length,
            multiTargetStates: states.filter(state => state.leader.targets.length > 1).length,
            maximumEffectsPerState: Math.max(0, ...states.map(state => state.leader.effects.length)),
            maximumTargetsPerState: Math.max(0, ...states.map(state => state.leader.targets.length)),
            emptyEffectStates: states.filter(state => state.leader.effects.length === 0).length,
            emptyTargetStates: states.filter(state => state.leader.targets.length === 0).length,
            repeatedEffectReferences: states.reduce((sum, state) => sum + duplicates(state.leader.effects.map(refKey)), 0),
            repeatedTargetReferences: states.reduce((sum, state) => sum + duplicates(state.leader.targets.map(refKey)), 0),
        },
        excludedStateIds: [...leader_scope_contract_1.CHARACTER_LEADER_SCOPE_EXCLUDED_STATE_IDS],
        excludedStateIdLimit: leader_projection_contract_1.CHARACTER_LEADER_PROJECTION_SAMPLE_LIMIT,
    };
}
exports.buildCharacterLeaderProjectionCoverage = buildCharacterLeaderProjectionCoverage;
function assertK45(report, k43, k3) {
    if (!report || report.contract !== "dokkan-database-character-leader-structural-scope-audit" || report.contractVersion !== "1.0.0"
        || report.readiness.structuralScope !== "GO" || report.readiness.nextStructuralIdOnlyProjection !== "GO"
        || report.inputIntegrity.k43SourceBoundBefore !== "GO" || report.inputIntegrity.k43SourceBoundAfter !== "GO"
        || !report.inputIntegrity.k43IdentityAndFingerprintStable || !report.inputIntegrity.k3ExactPinnedFilesBeforeAndAfter
        || !report.inputIntegrity.k3IdentityAndFingerprintStable || !report.inputIntegrity.k3DecodeBoundedToPinnedRawSize) {
        throw new Error("K46 requires K45 real GO");
    }
    (0, leader_scope_1.assertPinnedCharacterLeaderScope)(report.scope);
    if (JSON.stringify(report.sources.k43) !== JSON.stringify(k43.identity)
        || JSON.stringify(report.sources.k3) !== JSON.stringify(k3.identity))
        throw new Error("K46 K45/source identity mismatch");
}
function assertCoveragePins(coverage) {
    const refs = coverage.leaderReferences, pin = leader_scope_contract_1.CHARACTER_LEADER_SCOPE_PIN;
    const matches = coverage.states.included === pin.includedStates && coverage.states.excluded === pin.excludedStates
        && refs.uniqueSetRows === pin.uniqueLeaderSetRows && refs.effectReferences === pin.effectReferences
        && refs.targetReferences === pin.targetReferences && refs.multiEffectStates === pin.multiEffectStates
        && refs.multiTargetStates === pin.multiTargetStates && refs.maximumEffectsPerState === pin.maximumEffectsPerState
        && refs.maximumTargetsPerState === pin.maximumTargetsPerState && refs.emptyEffectStates === pin.emptyEffectStates
        && refs.emptyTargetStates === pin.emptyTargetStates
        && refs.repeatedEffectReferences === leader_projection_contract_1.CHARACTER_LEADER_PROJECTION_REPEAT_PIN.effectReferences
        && refs.repeatedTargetReferences === leader_projection_contract_1.CHARACTER_LEADER_PROJECTION_REPEAT_PIN.targetReferences
        && JSON.stringify(coverage.excludedStateIds) === JSON.stringify([...leader_scope_contract_1.CHARACTER_LEADER_SCOPE_EXCLUDED_STATE_IDS]);
    if (!matches)
        throw new Error("K46 leader projection pins changed");
}
function lineage(k43, k3) {
    return {
        k45: { contractVersion: "1.0.0", structuralScope: "GO", nextStructuralIdOnlyProjection: "GO", k43SourceBoundBeforeAndAfter: "GO" },
        k43: k43.identity,
        k3: k3.identity,
    };
}
function buildCharacterLeaderProjection(k43, k3, k45) {
    assertK45(k45, k43, k3);
    const projected = projectCharacterLeaderStructuralRecords(k43, k3);
    (0, leader_scope_1.assertPinnedCharacterLeaderScope)(projected.evaluation);
    const coverage = buildCharacterLeaderProjectionCoverage(projected.states);
    assertCoveragePins(coverage);
    const dataset = {
        schemaVersion: 1,
        contract: "dokkan-database-character-leader-structural-projection",
        contractVersion: leader_projection_contract_1.CHARACTER_LEADER_PROJECTION_CONTRACT_VERSION,
        mode: "explicit_opt_in_offline_local_structural_ids_only",
        source: lineage(k43, k3),
        policy: {
            structuralIdsOnly: true, sourceReferenceOrderAndMultiplicityPreserved: true, referencesDeduplicated: false,
            effectTargetAssociationsSelected: false, percentValuesIncluded: false, presentationIncluded: false, semanticsSelected: false,
            rawRowsIncluded: false, characterArrayIncluded: false, consumerImplemented: false, applyOrOverlayImplemented: false,
            authoritySelected: false, productionModified: false, publisherImplemented: false, networkEnabled: false,
            r2Enabled: false, androidImplemented: false,
        },
        states: projected.states,
    };
    return { dataset, coverage };
}
exports.buildCharacterLeaderProjection = buildCharacterLeaderProjection;
function duplicates(values) { return values.length - new Set(values).size; }
function unstableStrings(values) {
    const sorted = [...values].sort(structuralOrder);
    return values.reduce((count, value, index) => count + (value === sorted[index] ? 0 : 1), 0);
}
function validIdentity(value, keys) {
    if (!value || !exactKeys(value, keys))
        return false;
    return Object.entries(value).every(([key, item]) => key.toLowerCase().includes("sha256")
        ? typeof item === "string" && /^[a-f0-9]{64}$/.test(item)
        : key.toLowerCase().includes("sizebytes") ? Number.isInteger(item) && item >= 0 : typeof item === "string");
}
function validateCharacterLeaderProjection(dataset, coverage, sizes) {
    const failures = [];
    const datasetKeys = ["schemaVersion", "contract", "contractVersion", "mode", "source", "policy", "states"];
    if (!dataset || !exactKeys(dataset, datasetKeys) || dataset.schemaVersion !== 1
        || dataset.contract !== "dokkan-database-character-leader-structural-projection"
        || dataset.contractVersion !== leader_projection_contract_1.CHARACTER_LEADER_PROJECTION_CONTRACT_VERSION
        || dataset.mode !== "explicit_opt_in_offline_local_structural_ids_only")
        failures.push("dataset contract rejected");
    const source = dataset?.source;
    if (!source || !exactKeys(source, ["k45", "k43", "k3"])
        || !source.k45 || !exactKeys(source.k45, ["contractVersion", "structuralScope", "nextStructuralIdOnlyProjection", "k43SourceBoundBeforeAndAfter"])
        || source.k45.contractVersion !== "1.0.0" || source.k45.structuralScope !== "GO"
        || source.k45.nextStructuralIdOnlyProjection !== "GO" || source.k45.k43SourceBoundBeforeAndAfter !== "GO"
        || !validIdentity(source.k43, ["manifestSha256", "payloadSha256", "rawSha256", "k42SourceFingerprintSha256", "stateFingerprintSha256"])
        || !source.k3 || !exactKeys(source.k3, ["profileId", "snapshotVersion", "manifest", "artifact", "coverage", "validation", "compactFingerprintSha256"])
        || typeof source.k3.profileId !== "string" || typeof source.k3.snapshotVersion !== "string"
        || !validIdentity(source.k3.manifest, ["sha256", "sizeBytes"])
        || !validIdentity(source.k3.artifact, ["sha256", "sizeBytes", "uncompressedSizeBytes", "uncompressedSha256"])
        || !validIdentity(source.k3.coverage, ["sha256", "sizeBytes"])
        || !validIdentity(source.k3.validation, ["sha256", "sizeBytes"])
        || !/^[a-f0-9]{64}$/.test(source.k3.compactFingerprintSha256))
        failures.push("source lineage rejected");
    const policy = dataset?.policy;
    const policyKeys = ["structuralIdsOnly", "sourceReferenceOrderAndMultiplicityPreserved", "referencesDeduplicated", "effectTargetAssociationsSelected", "percentValuesIncluded", "presentationIncluded", "semanticsSelected", "rawRowsIncluded", "characterArrayIncluded", "consumerImplemented", "applyOrOverlayImplemented", "authoritySelected", "productionModified", "publisherImplemented", "networkEnabled", "r2Enabled", "androidImplemented"];
    if (!policy || !exactKeys(policy, policyKeys) || !policy.structuralIdsOnly || !policy.sourceReferenceOrderAndMultiplicityPreserved
        || Object.entries(policy).some(([key, value]) => !["structuralIdsOnly", "sourceReferenceOrderAndMultiplicityPreserved"].includes(key) && value !== false))
        failures.push("dataset policy rejected");
    const stateIds = Array.isArray(dataset?.states) ? dataset.states.map(state => state?.stateId) : [];
    const duplicateStateIdCount = duplicates(stateIds);
    let repeatedEffectReferenceCount = 0, repeatedTargetReferenceCount = 0;
    const unstableStateOrderCount = unstableStrings(stateIds);
    let extraOrPresentationFieldCount = 0, percentValueFieldCount = 0;
    if (!Array.isArray(dataset?.states))
        failures.push("states rejected");
    else
        for (const state of dataset.states) {
            if (!state || !exactKeys(state, ["stateId", "sourceStateKey", "cardId", "releaseState", "leader"])
                || typeof state.stateId !== "string" || !state.stateId || typeof state.sourceStateKey !== "string" || !state.sourceStateKey
                || typeof state.cardId !== "string" || !state.cardId || !["initial", "eza", "seza"].includes(state.releaseState)
                || !state.leader || !exactKeys(state.leader, ["set", "effects", "targets"]))
                extraOrPresentationFieldCount++;
            if (state?.leader && Object.prototype.hasOwnProperty.call(state.leader, "structuredPercentValues"))
                percentValueFieldCount++;
            const validRef = (ref) => !!ref && exactKeys(ref, ["table", "rowId"])
                && typeof ref.table === "string" && !!ref.table && typeof ref.rowId === "string" && !!ref.rowId;
            if (!validRef(state?.leader?.set) || !Array.isArray(state?.leader?.effects) || !state.leader.effects.every(validRef)
                || !Array.isArray(state?.leader?.targets) || !state.leader.targets.every(validRef)) {
                extraOrPresentationFieldCount++;
                continue;
            }
            repeatedEffectReferenceCount += duplicates(state.leader.effects.map(refKey));
            repeatedTargetReferenceCount += duplicates(state.leader.targets.map(refKey));
        }
    if (duplicateStateIdCount)
        failures.push("duplicate state identity");
    if (unstableStateOrderCount)
        failures.push("unstable structural order");
    if (extraOrPresentationFieldCount)
        failures.push("extra or presentation field included");
    if (percentValueFieldCount)
        failures.push("percent value field included");
    const expectedCoverage = buildCharacterLeaderProjectionCoverage(Array.isArray(dataset?.states) ? dataset.states : []);
    if (JSON.stringify(coverage) !== JSON.stringify(expectedCoverage))
        failures.push("coverage mismatch");
    try {
        assertCoveragePins(coverage);
    }
    catch {
        failures.push("production pins changed");
    }
    if (sizes.rawSizeBytes >= leader_projection_contract_1.CHARACTER_LEADER_PROJECTION_RAW_LIMIT_BYTES)
        failures.push("raw byte budget reached");
    if (sizes.gzipSizeBytes >= leader_projection_contract_1.CHARACTER_LEADER_PROJECTION_GZIP_LIMIT_BYTES)
        failures.push("gzip byte budget reached");
    if (sizes.metadataSizeBytes >= leader_projection_contract_1.CHARACTER_LEADER_PROJECTION_METADATA_LIMIT_BYTES)
        failures.push("metadata byte budget reached");
    const uniqueFailures = [...new Set(failures)].sort();
    return {
        schemaVersion: 1,
        contract: "dokkan-database-character-leader-structural-projection-validation",
        contractVersion: leader_projection_contract_1.CHARACTER_LEADER_PROJECTION_CONTRACT_VERSION,
        valid: uniqueFailures.length === 0,
        failures: uniqueFailures.slice(0, leader_projection_contract_1.CHARACTER_LEADER_PROJECTION_SAMPLE_LIMIT),
        failuresTruncated: uniqueFailures.length > leader_projection_contract_1.CHARACTER_LEADER_PROJECTION_SAMPLE_LIMIT,
        sizes: {
            rawMaximumBytesExclusive: leader_projection_contract_1.CHARACTER_LEADER_PROJECTION_RAW_LIMIT_BYTES,
            gzipMaximumBytesExclusive: leader_projection_contract_1.CHARACTER_LEADER_PROJECTION_GZIP_LIMIT_BYTES,
            metadataMaximumBytesExclusive: leader_projection_contract_1.CHARACTER_LEADER_PROJECTION_METADATA_LIMIT_BYTES,
            ...sizes,
        },
        safety: {
            duplicateStateIdCount, repeatedEffectReferenceCount, repeatedTargetReferenceCount, unstableStateOrderCount, extraOrPresentationFieldCount,
            percentValueFieldCount, characterArrayRecordCount: 0, networkRequestCount: 0, automaticCleanupAttempted: false,
            outputNamespaceThreatModel: "caller_controlled_stable_during_operation",
        },
        readiness: {
            offlineGeneration: "GO", sourceBoundValidation: "NOT_EXECUTED", consumer: "NO-GO", leaderClauseSemantics: "NO-GO",
            presentation: "NO-GO", applyOrOverlay: "NO-GO", authority: "NO-GO", production: "NO-GO", publisher: "NO-GO",
            network: "NO-GO", r2: "NO-GO", android: "NO-GO",
        },
    };
}
exports.validateCharacterLeaderProjection = validateCharacterLeaderProjection;
function materializeCharacterLeaderProjection(dataset, coverage) {
    const raw = jsonBytes(dataset), gzip = (0, zlib_1.gzipSync)(raw, { level: 9 }), coverageBytes = jsonBytes(coverage), payloadSha256 = hash(gzip);
    let metadataSizeBytes = 0;
    for (let attempt = 0; attempt < 8; attempt++) {
        const validation = validateCharacterLeaderProjection(dataset, coverage, { rawSizeBytes: raw.length, gzipSizeBytes: gzip.length, metadataSizeBytes });
        if (!validation.valid)
            throw new Error(`K46 projection validation failed: ${validation.failures.join("; ")}`);
        const validationBytes = jsonBytes(validation);
        const manifest = {
            schemaVersion: 1,
            contract: "dokkan-database-character-leader-structural-projection-manifest",
            contractVersion: leader_projection_contract_1.CHARACTER_LEADER_PROJECTION_CONTRACT_VERSION,
            fileName: `database-characters-k46-leader-projection.${payloadSha256}.json.gz`, compression: "gzip",
            sha256: payloadSha256, sizeBytes: gzip.length, uncompressedSha256: hash(raw), uncompressedSizeBytes: raw.length,
            counts: {
                states: coverage.states.included, uniqueSetRows: coverage.leaderReferences.uniqueSetRows,
                effectReferences: coverage.leaderReferences.effectReferences, targetReferences: coverage.leaderReferences.targetReferences,
            },
            source: dataset.source,
            coverageFile: leader_projection_contract_1.CHARACTER_LEADER_PROJECTION_FILES.coverage, coverageSha256: hash(coverageBytes), coverageSizeBytes: coverageBytes.length,
            validationFile: leader_projection_contract_1.CHARACTER_LEADER_PROJECTION_FILES.validation, validationSha256: hash(validationBytes), validationSizeBytes: validationBytes.length,
        };
        const manifestBytes = jsonBytes(manifest);
        const actualMetadataSizeBytes = coverageBytes.length + validationBytes.length + manifestBytes.length;
        if (actualMetadataSizeBytes >= leader_projection_contract_1.CHARACTER_LEADER_PROJECTION_METADATA_LIMIT_BYTES)
            throw new Error(`K46 metadata byte budget reached: ${actualMetadataSizeBytes}`);
        if (actualMetadataSizeBytes === metadataSizeBytes)
            return { dataset, coverage, validation, manifest, raw, gzip, coverageBytes, validationBytes, manifestBytes };
        metadataSizeBytes = actualMetadataSizeBytes;
    }
    throw new Error("K46 metadata size did not converge");
}
exports.materializeCharacterLeaderProjection = materializeCharacterLeaderProjection;
function samePath(left, right) {
    return process.platform === "win32" ? (0, path_1.resolve)(left).toLowerCase() === (0, path_1.resolve)(right).toLowerCase() : (0, path_1.resolve)(left) === (0, path_1.resolve)(right);
}
function sameFile(left, right) { return left.dev === right.dev && left.ino === right.ino; }
async function regularRoot(value) {
    const root = (0, path_1.resolve)(value), before = await (0, promises_1.lstat)(root);
    if (!before.isDirectory() || before.isSymbolicLink())
        throw new Error("K46 artifact root must be an existing regular non-link directory");
    const canonical = await (0, promises_1.realpath)(root);
    if (!samePath(root, canonical))
        throw new Error("K46 artifact root symlink or junction rejected");
    return canonical;
}
async function readBoundedCharacterLeaderProjectionMember(rootValue, fileName, maximumBytesExclusive, expectedSizeBytes) {
    const root = await regularRoot(rootValue);
    if (!/^[a-z0-9][a-z0-9.-]+$/.test(fileName) || fileName.includes("..") || fileName.includes("/") || fileName.includes("\\"))
        throw new Error("K46 artifact member name rejected");
    const path = (0, path_1.join)(root, fileName);
    if (!samePath(path, (0, path_1.resolve)(root, fileName)))
        throw new Error("K46 artifact member escaped root");
    const before = await (0, promises_1.lstat)(path);
    if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1)
        throw new Error("K46 artifact member must be a single-link regular file");
    if (!Number.isSafeInteger(maximumBytesExclusive) || maximumBytesExclusive <= 0
        || !Number.isSafeInteger(before.size) || before.size < 0 || before.size >= maximumBytesExclusive
        || (expectedSizeBytes !== undefined && before.size !== expectedSizeBytes))
        throw new Error("K46 artifact member byte budget or exact size rejected");
    const handle = await (0, promises_1.open)(path, fs_1.constants.O_RDONLY | (fs_1.constants.O_NOFOLLOW ?? 0));
    try {
        const opened = await handle.stat();
        if (!sameFile(before, opened) || !opened.isFile() || opened.nlink !== 1 || opened.size !== before.size)
            throw new Error("K46 artifact member identity changed while opening");
        const bytes = Buffer.alloc(opened.size);
        let offset = 0;
        while (offset < bytes.length) {
            const result = await handle.read(bytes, offset, bytes.length - offset, offset);
            if (result.bytesRead <= 0)
                throw new Error("K46 artifact member ended before its exact size");
            offset += result.bytesRead;
        }
        const eof = await handle.read(Buffer.allocUnsafe(1), 0, 1, opened.size);
        if (eof.bytesRead !== 0)
            throw new Error("K46 artifact member exceeded its exact size");
        const after = await handle.stat(), visible = await (0, promises_1.lstat)(path);
        if (!after.isFile() || after.nlink !== 1 || after.size !== opened.size || !sameFile(opened, after)
            || !visible.isFile() || visible.isSymbolicLink() || visible.nlink !== 1 || visible.size !== opened.size
            || !sameFile(opened, visible))
            throw new Error("K46 artifact member changed while reading");
        return bytes;
    }
    finally {
        await handle.close();
    }
}
exports.readBoundedCharacterLeaderProjectionMember = readBoundedCharacterLeaderProjectionMember;
async function readArtifactSet(root) {
    const manifestBytes = await readBoundedCharacterLeaderProjectionMember(root, leader_projection_contract_1.CHARACTER_LEADER_PROJECTION_FILES.manifest, leader_projection_contract_1.CHARACTER_LEADER_PROJECTION_METADATA_LIMIT_BYTES);
    const manifest = JSON.parse(manifestBytes.toString("utf8"));
    if (!/^database-characters-k46-leader-projection\.[a-f0-9]{64}\.json\.gz$/.test(manifest.fileName)
        || manifest.fileName.split(".")[1] !== manifest.sha256
        || manifest.coverageFile !== leader_projection_contract_1.CHARACTER_LEADER_PROJECTION_FILES.coverage
        || manifest.validationFile !== leader_projection_contract_1.CHARACTER_LEADER_PROJECTION_FILES.validation
        || !Number.isSafeInteger(manifest.sizeBytes) || manifest.sizeBytes < 0 || manifest.sizeBytes >= leader_projection_contract_1.CHARACTER_LEADER_PROJECTION_GZIP_LIMIT_BYTES
        || !Number.isSafeInteger(manifest.coverageSizeBytes) || manifest.coverageSizeBytes < 0 || manifest.coverageSizeBytes >= leader_projection_contract_1.CHARACTER_LEADER_PROJECTION_METADATA_LIMIT_BYTES
        || !Number.isSafeInteger(manifest.validationSizeBytes) || manifest.validationSizeBytes < 0 || manifest.validationSizeBytes >= leader_projection_contract_1.CHARACTER_LEADER_PROJECTION_METADATA_LIMIT_BYTES
        || manifestBytes.length + manifest.coverageSizeBytes + manifest.validationSizeBytes >= leader_projection_contract_1.CHARACTER_LEADER_PROJECTION_METADATA_LIMIT_BYTES) {
        throw new Error("K46 manifest payload identity or byte budget rejected");
    }
    const [gzip, coverageBytes, validationBytes] = await Promise.all([
        readBoundedCharacterLeaderProjectionMember(root, manifest.fileName, leader_projection_contract_1.CHARACTER_LEADER_PROJECTION_GZIP_LIMIT_BYTES, manifest.sizeBytes),
        readBoundedCharacterLeaderProjectionMember(root, manifest.coverageFile, leader_projection_contract_1.CHARACTER_LEADER_PROJECTION_METADATA_LIMIT_BYTES, manifest.coverageSizeBytes),
        readBoundedCharacterLeaderProjectionMember(root, manifest.validationFile, leader_projection_contract_1.CHARACTER_LEADER_PROJECTION_METADATA_LIMIT_BYTES, manifest.validationSizeBytes),
    ]);
    if (gzip.length !== manifest.sizeBytes || hash(gzip) !== manifest.sha256 || gzip.length >= leader_projection_contract_1.CHARACTER_LEADER_PROJECTION_GZIP_LIMIT_BYTES
        || coverageBytes.length !== manifest.coverageSizeBytes || hash(coverageBytes) !== manifest.coverageSha256
        || validationBytes.length !== manifest.validationSizeBytes || hash(validationBytes) !== manifest.validationSha256
        || coverageBytes.length + validationBytes.length + manifestBytes.length >= leader_projection_contract_1.CHARACTER_LEADER_PROJECTION_METADATA_LIMIT_BYTES)
        throw new Error("K46 artifact identity rejected");
    const raw = (0, zlib_1.gunzipSync)(gzip, { maxOutputLength: leader_projection_contract_1.CHARACTER_LEADER_PROJECTION_RAW_LIMIT_BYTES });
    if (raw.length !== manifest.uncompressedSizeBytes || hash(raw) !== manifest.uncompressedSha256 || raw.length >= leader_projection_contract_1.CHARACTER_LEADER_PROJECTION_RAW_LIMIT_BYTES)
        throw new Error("K46 raw artifact identity rejected");
    const dataset = JSON.parse(raw.toString("utf8"));
    const coverage = JSON.parse(coverageBytes.toString("utf8"));
    const validation = JSON.parse(validationBytes.toString("utf8"));
    if (!raw.equals(jsonBytes(dataset)) || !gzip.equals((0, zlib_1.gzipSync)(raw, { level: 9 })))
        throw new Error("K46 canonical payload rejected");
    const rebuilt = materializeCharacterLeaderProjection(dataset, coverage);
    if (!rebuilt.raw.equals(raw) || !rebuilt.gzip.equals(gzip) || !rebuilt.coverageBytes.equals(coverageBytes)
        || !rebuilt.validationBytes.equals(validationBytes) || !rebuilt.manifestBytes.equals(manifestBytes)
        || JSON.stringify(validation) !== JSON.stringify(rebuilt.validation))
        throw new Error("K46 artifact reconstruction rejected");
    return rebuilt;
}
async function validateCharacterLeaderProjectionArtifact(options) {
    const k45 = await (0, leader_scope_run_1.runCharacterLeaderScopeAudit)({
        optIn: true, sidecarRoot: options.sidecarRoot, productionRoot: options.productionRoot, fyiRoot: options.fyiRoot, k43Root: options.k43Root,
    });
    if (global.gc)
        global.gc();
    let k43Validated = await (0, state_product_projection_1.validateCharacterStateProductProjectionArtifact)({
        artifactRoot: options.k43Root, sidecarRoot: options.sidecarRoot, productionRoot: options.productionRoot, fyiRoot: options.fyiRoot,
    });
    let k43 = (0, leader_scope_source_1.compactK43LeaderScopeSource)(k43Validated.artifacts);
    k43Validated = undefined;
    if (global.gc)
        global.gc();
    let k3 = await (0, leader_scope_source_1.loadPinnedK3LeaderScopeSource)(options.sidecarRoot);
    const built = buildCharacterLeaderProjection(k43, k3, k45);
    let expected = materializeCharacterLeaderProjection(built.dataset, built.coverage);
    const k3Identity = k3.identity, k43Identity = k43.identity;
    k3 = undefined;
    k43 = undefined;
    if (global.gc)
        global.gc();
    let actual = await readArtifactSet(options.artifactRoot);
    for (const [label, actualBytes, expectedBytes] of [
        ["payload", actual.gzip, expected.gzip], ["coverage", actual.coverageBytes, expected.coverageBytes],
        ["validation", actual.validationBytes, expected.validationBytes], ["manifest", actual.manifestBytes, expected.manifestBytes],
    ])
        if (!actualBytes.equals(expectedBytes))
            throw new Error(`K46 source-bound artifact mismatch: ${label}`);
    const reread = await readArtifactSet(options.artifactRoot);
    if (!actual.gzip.equals(reread.gzip) || !actual.coverageBytes.equals(reread.coverageBytes)
        || !actual.validationBytes.equals(reread.validationBytes) || !actual.manifestBytes.equals(reread.manifestBytes))
        throw new Error("K46 artifact changed during source-bound validation");
    actual = undefined;
    expected = undefined;
    if (global.gc)
        global.gc();
    let revalidatedK43 = await (0, state_product_projection_1.validateCharacterStateProductProjectionArtifact)({
        artifactRoot: options.k43Root, sidecarRoot: options.sidecarRoot, productionRoot: options.productionRoot, fyiRoot: options.fyiRoot,
    });
    const compactReloadedK43 = (0, leader_scope_source_1.compactK43LeaderScopeSource)(revalidatedK43.artifacts);
    (0, leader_scope_source_1.assertK43LeaderScopeSourceStable)(k43Identity, compactReloadedK43.identity);
    revalidatedK43 = undefined;
    let reloadedK3 = await (0, leader_scope_source_1.loadPinnedK3LeaderScopeSource)(options.sidecarRoot);
    (0, leader_scope_source_1.assertK3LeaderScopeSourceStable)(k3Identity, reloadedK3.identity);
    reloadedK3 = undefined;
    if (global.gc)
        global.gc();
    return { artifacts: reread, sourceBoundValidation: "GO" };
}
exports.validateCharacterLeaderProjectionArtifact = validateCharacterLeaderProjectionArtifact;
//# sourceMappingURL=leader-projection.js.map