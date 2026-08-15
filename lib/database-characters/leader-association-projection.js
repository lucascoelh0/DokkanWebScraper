"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateCharacterLeaderAssociationProjectionArtifact = exports.readBoundedCharacterLeaderAssociationProjectionMember = exports.materializeCharacterLeaderAssociationProjection = exports.validateCharacterLeaderAssociationProjection = exports.buildCharacterLeaderAssociationProjection = exports.buildCharacterLeaderAssociationProjectionCoverage = exports.projectCharacterLeaderAssociationRecords = void 0;
const fs_1 = require("fs");
const crypto_1 = require("crypto");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const zlib_1 = require("zlib");
const leader_association_scope_contract_1 = require("./leader-association-scope-contract");
const leader_association_scope_source_1 = require("./leader-association-scope-source");
const leader_association_scope_1 = require("./leader-association-scope");
const leader_association_scope_run_1 = require("./leader-association-scope-run");
const leader_projection_1 = require("./leader-projection");
const leader_scope_contract_1 = require("./leader-scope-contract");
const leader_association_projection_contract_1 = require("./leader-association-projection-contract");
const hash = (bytes) => (0, crypto_1.createHash)("sha256").update(bytes).digest("hex");
const jsonBytes = (value) => Buffer.from(`${JSON.stringify(value)}\n`, "utf8");
const structuralOrder = (left, right) => left.localeCompare(right, undefined, { numeric: true });
const exactKeys = (value, keys) => JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
const refKey = (ref) => JSON.stringify([ref.table, ref.rowId]);
function duplicates(values) { return values.length - new Set(values).size; }
function assertK47(report, k46, k3) {
    if (!report || report.contract !== "dokkan-database-character-leader-effect-target-association-scope-audit" || report.contractVersion !== "1.0.0"
        || report.readiness.structuralAssociationScope !== "GO" || report.readiness.nextStructuralIdAssociationProjection !== "GO"
        || report.inputIntegrity.k46SourceBoundBefore !== "GO" || report.inputIntegrity.k46SourceBoundAfter !== "GO"
        || !report.inputIntegrity.k46IdentityAndFingerprintStable || !report.inputIntegrity.k3ExactPinnedBeforeAndAfter
        || !report.inputIntegrity.k3AssociationFingerprintStable || !report.inputIntegrity.k3DecodeBoundedToPinnedRawSize) {
        throw new Error("K48 requires K47 real GO");
    }
    (0, leader_association_scope_1.assertPinnedCharacterLeaderAssociationScope)(report.scope);
    if (JSON.stringify(report.sources.k46) !== JSON.stringify(k46.identity)
        || JSON.stringify(report.sources.k3) !== JSON.stringify(k3.identity))
        throw new Error("K48 K47/source identity mismatch");
}
function projectCharacterLeaderAssociationRecords(k46Artifacts, k3) {
    const k46 = (0, leader_association_scope_source_1.compactK46LeaderAssociationSource)(k46Artifacts);
    const proof = (0, leader_association_scope_1.evaluateCharacterLeaderAssociationScope)(k46, k3);
    const effectRows = new Map(k3.effects.map(row => [row.rowId, row]));
    const targetsBySet = new Map();
    for (const target of k3.targets)
        targetsBySet.set(target.targetSetId, [
            ...(targetsBySet.get(target.targetSetId) ?? []), { table: "sub_target_types", rowId: target.rowId },
        ]);
    const states = k46Artifacts.dataset.states.map(state => ({
        stateId: state.stateId, sourceStateKey: state.sourceStateKey, cardId: state.cardId, releaseState: state.releaseState,
        leader: {
            set: { table: state.leader.set.table, rowId: state.leader.set.rowId },
            effects: state.leader.effects.map(effect => {
                const raw = effectRows.get(effect.rowId);
                if (!raw)
                    throw new Error(`K48 missing leader effect row ${effect.rowId}`);
                const association = {
                    effect: { table: "leader_skills", rowId: effect.rowId },
                    targetSetId: raw.targetSetId,
                    targets: raw.targetSetId === null ? [] : (targetsBySet.get(raw.targetSetId) ?? []).map(target => ({ ...target })),
                };
                return association;
            }),
        },
    }));
    return { states, proof };
}
exports.projectCharacterLeaderAssociationRecords = projectCharacterLeaderAssociationRecords;
function buildCharacterLeaderAssociationProjectionCoverage(states) {
    let effectAssociations = 0, targetReferences = 0, uniqueTargetReferencesWithinState = 0;
    let repeatedTargetReferences = 0, repetitionsFromRepeatedTargetSetExpansion = 0;
    const uniqueSets = new Set();
    for (const state of states) {
        uniqueSets.add(refKey(state.leader.set));
        const flattened = [], seenSets = new Set();
        for (const association of state.leader.effects) {
            effectAssociations++;
            const targets = association.targets.map(target => target.rowId);
            flattened.push(...targets);
            if (association.targetSetId !== null) {
                if (seenSets.has(association.targetSetId))
                    repetitionsFromRepeatedTargetSetExpansion += targets.length;
                seenSets.add(association.targetSetId);
            }
        }
        targetReferences += flattened.length;
        const unique = new Set(flattened).size;
        uniqueTargetReferencesWithinState += unique;
        repeatedTargetReferences += flattened.length - unique;
    }
    return {
        schemaVersion: 1,
        contract: "dokkan-database-character-leader-association-structural-projection-coverage",
        contractVersion: leader_association_projection_contract_1.CHARACTER_LEADER_ASSOCIATION_PROJECTION_CONTRACT_VERSION,
        states: { included: states.length, excluded: leader_scope_contract_1.CHARACTER_LEADER_SCOPE_EXCLUDED_STATE_IDS.length },
        uniqueLeaderSetRows: uniqueSets.size, effectAssociations, targetReferences, uniqueTargetReferencesWithinState,
        repeatedTargetReferences, repetitionsFromRepeatedTargetSetExpansion,
        missingEffectRows: 0, missingTargetRows: 0, flattenedTargetMismatchStates: 0,
        excludedStateIds: [...leader_scope_contract_1.CHARACTER_LEADER_SCOPE_EXCLUDED_STATE_IDS], excludedStateIdLimit: leader_association_projection_contract_1.CHARACTER_LEADER_ASSOCIATION_PROJECTION_SAMPLE_LIMIT,
    };
}
exports.buildCharacterLeaderAssociationProjectionCoverage = buildCharacterLeaderAssociationProjectionCoverage;
function assertCoveragePins(coverage) {
    const association = leader_association_scope_contract_1.CHARACTER_LEADER_ASSOCIATION_SCOPE_PIN;
    if (coverage.states.included !== association.states || coverage.states.excluded !== 3
        || coverage.uniqueLeaderSetRows !== leader_scope_contract_1.CHARACTER_LEADER_SCOPE_PIN.uniqueLeaderSetRows
        || coverage.effectAssociations !== association.effectAssociations || coverage.targetReferences !== association.flattenedTargetReferences
        || coverage.uniqueTargetReferencesWithinState !== association.uniqueTargetReferencesWithinState
        || coverage.repeatedTargetReferences !== association.repeatedFlattenedTargetReferences
        || coverage.repetitionsFromRepeatedTargetSetExpansion !== association.repetitionsFromRepeatedTargetSetExpansion
        || coverage.missingEffectRows !== 0 || coverage.missingTargetRows !== 0 || coverage.flattenedTargetMismatchStates !== 0
        || JSON.stringify(coverage.excludedStateIds) !== JSON.stringify([...leader_scope_contract_1.CHARACTER_LEADER_SCOPE_EXCLUDED_STATE_IDS])) {
        throw new Error("K48 association projection pins changed");
    }
}
function buildCharacterLeaderAssociationProjection(k46Artifacts, k3, k47) {
    const k46 = (0, leader_association_scope_source_1.compactK46LeaderAssociationSource)(k46Artifacts);
    assertK47(k47, k46, k3);
    const projected = projectCharacterLeaderAssociationRecords(k46Artifacts, k3);
    (0, leader_association_scope_1.assertPinnedCharacterLeaderAssociationScope)(projected.proof);
    if (JSON.stringify(projected.proof) !== JSON.stringify(k47.scope))
        throw new Error("K48 K47 proof drift");
    const coverage = buildCharacterLeaderAssociationProjectionCoverage(projected.states);
    assertCoveragePins(coverage);
    const dataset = {
        schemaVersion: 1,
        contract: "dokkan-database-character-leader-association-structural-projection",
        contractVersion: leader_association_projection_contract_1.CHARACTER_LEADER_ASSOCIATION_PROJECTION_CONTRACT_VERSION,
        mode: "explicit_opt_in_offline_local_structural_ids_only",
        source: {
            k47: { contractVersion: "1.0.0", structuralAssociationScope: "GO", nextStructuralIdAssociationProjection: "GO" },
            k46: k46.identity, k3: k3.identity,
        },
        policy: {
            structuralIdsOnly: true, sourceOrderAndMultiplicityPreserved: true, redundantFlatTargetsIncluded: false,
            percentTextRawOrValueIncluded: false, semanticAssociationSelected: false, characterArrayIncluded: false,
            consumerImplemented: false, applyOrOverlayImplemented: false, authoritySelected: false, productionModified: false,
            publisherImplemented: false, networkEnabled: false, r2Enabled: false, androidImplemented: false,
        },
        states: projected.states,
    };
    return { dataset, coverage };
}
exports.buildCharacterLeaderAssociationProjection = buildCharacterLeaderAssociationProjection;
function unstable(values) {
    const sorted = [...values].sort(structuralOrder);
    return values.reduce((count, value, index) => count + (value === sorted[index] ? 0 : 1), 0);
}
function validRef(ref, table) {
    return !!ref && exactKeys(ref, ["table", "rowId"]) && typeof ref.table === "string" && !!ref.table
        && typeof ref.rowId === "string" && !!ref.rowId && (!table || ref.table === table);
}
function validHash(value) { return typeof value === "string" && /^[a-f0-9]{64}$/.test(value); }
function validPinnedFile(value, artifact = false) {
    const keys = artifact ? ["sha256", "sizeBytes", "uncompressedSizeBytes", "uncompressedSha256"] : ["sha256", "sizeBytes"];
    return !!value && exactKeys(value, keys) && validHash(value.sha256) && Number.isSafeInteger(value.sizeBytes) && value.sizeBytes >= 0
        && (!artifact || (Number.isSafeInteger(value.uncompressedSizeBytes) && value.uncompressedSizeBytes >= 0 && validHash(value.uncompressedSha256)));
}
function validK3AssociationIdentity(value) {
    return !!value && exactKeys(value, ["profileId", "snapshotVersion", "manifest", "artifact", "coverage", "validation", "associationInputFingerprintSha256"])
        && typeof value.profileId === "string" && !!value.profileId && typeof value.snapshotVersion === "string" && !!value.snapshotVersion
        && validPinnedFile(value.manifest) && validPinnedFile(value.artifact, true) && validPinnedFile(value.coverage)
        && validPinnedFile(value.validation) && validHash(value.associationInputFingerprintSha256);
}
function validK46Identity(value) {
    if (!value || !exactKeys(value, ["manifestSha256", "payloadSha256", "rawSha256", "stateFingerprintSha256", "k43", "k3"])
        || !validHash(value.manifestSha256) || !validHash(value.payloadSha256) || !validHash(value.rawSha256) || !validHash(value.stateFingerprintSha256)
        || !value.k43 || !exactKeys(value.k43, ["manifestSha256", "payloadSha256", "rawSha256", "k42SourceFingerprintSha256", "stateFingerprintSha256"])
        || !Object.values(value.k43).every(validHash) || !value.k3
        || !exactKeys(value.k3, ["profileId", "snapshotVersion", "manifest", "artifact", "coverage", "validation", "compactFingerprintSha256"]))
        return false;
    return typeof value.k3.profileId === "string" && !!value.k3.profileId && typeof value.k3.snapshotVersion === "string" && !!value.k3.snapshotVersion
        && validPinnedFile(value.k3.manifest) && validPinnedFile(value.k3.artifact, true) && validPinnedFile(value.k3.coverage)
        && validPinnedFile(value.k3.validation) && validHash(value.k3.compactFingerprintSha256);
}
function validateCharacterLeaderAssociationProjection(dataset, coverage, sizes) {
    const failures = [];
    if (!dataset || !exactKeys(dataset, ["schemaVersion", "contract", "contractVersion", "mode", "source", "policy", "states"])
        || dataset.schemaVersion !== 1 || dataset.contract !== "dokkan-database-character-leader-association-structural-projection"
        || dataset.contractVersion !== leader_association_projection_contract_1.CHARACTER_LEADER_ASSOCIATION_PROJECTION_CONTRACT_VERSION
        || dataset.mode !== "explicit_opt_in_offline_local_structural_ids_only")
        failures.push("dataset contract rejected");
    const source = dataset?.source;
    if (!source || !exactKeys(source, ["k47", "k46", "k3"]) || !source.k47
        || !exactKeys(source.k47, ["contractVersion", "structuralAssociationScope", "nextStructuralIdAssociationProjection"])
        || source.k47.contractVersion !== "1.0.0" || source.k47.structuralAssociationScope !== "GO"
        || source.k47.nextStructuralIdAssociationProjection !== "GO" || !validK46Identity(source.k46)
        || !validK3AssociationIdentity(source.k3))
        failures.push("source lineage rejected");
    else {
        const { compactFingerprintSha256: _scopeFingerprint, ...k46K3 } = source.k46.k3;
        const { associationInputFingerprintSha256: _associationFingerprint, ...associationK3 } = source.k3;
        if (JSON.stringify(k46K3) !== JSON.stringify(associationK3))
            failures.push("source lineage rejected");
    }
    const policy = dataset?.policy;
    const policyKeys = ["structuralIdsOnly", "sourceOrderAndMultiplicityPreserved", "redundantFlatTargetsIncluded", "percentTextRawOrValueIncluded", "semanticAssociationSelected", "characterArrayIncluded", "consumerImplemented", "applyOrOverlayImplemented", "authoritySelected", "productionModified", "publisherImplemented", "networkEnabled", "r2Enabled", "androidImplemented"];
    if (!policy || !exactKeys(policy, policyKeys) || !policy.structuralIdsOnly || !policy.sourceOrderAndMultiplicityPreserved
        || Object.entries(policy).some(([key, value]) => !["structuralIdsOnly", "sourceOrderAndMultiplicityPreserved"].includes(key) && value !== false))
        failures.push("dataset policy rejected");
    const stateIds = Array.isArray(dataset?.states) ? dataset.states.map(state => state?.stateId) : [];
    const duplicateStateIdCount = duplicates(stateIds), unstableStateOrderCount = unstable(stateIds);
    let repeatedEffectReferenceCount = 0, extraOrPresentationFieldCount = 0, redundantFlatTargetFieldCount = 0;
    let nullTargetSetWithTargetsCount = 0, percentTextRawOrValueFieldCount = 0;
    if (!Array.isArray(dataset?.states))
        failures.push("states rejected");
    else
        for (const state of dataset.states) {
            if (!state || !exactKeys(state, ["stateId", "sourceStateKey", "cardId", "releaseState", "leader"])
                || typeof state.stateId !== "string" || !state.stateId || typeof state.sourceStateKey !== "string" || !state.sourceStateKey
                || typeof state.cardId !== "string" || !state.cardId || !["initial", "eza", "seza"].includes(state.releaseState))
                extraOrPresentationFieldCount++;
            if (!state?.leader) {
                extraOrPresentationFieldCount++;
                continue;
            }
            if (Object.prototype.hasOwnProperty.call(state.leader, "targets"))
                redundantFlatTargetFieldCount++;
            if (!exactKeys(state.leader, ["set", "effects"]) || !validRef(state.leader.set) || !Array.isArray(state.leader.effects)) {
                extraOrPresentationFieldCount++;
                if (!Array.isArray(state.leader.effects))
                    continue;
            }
            const effectIds = [];
            for (const association of state.leader.effects) {
                if (!association) {
                    extraOrPresentationFieldCount++;
                    continue;
                }
                if (!exactKeys(association, ["effect", "targetSetId", "targets"]))
                    extraOrPresentationFieldCount++;
                if (!validRef(association.effect, "leader_skills")
                    || !(association.targetSetId === null || (typeof association.targetSetId === "string" && !!association.targetSetId))
                    || !Array.isArray(association.targets) || !association.targets.every((target) => validRef(target, "sub_target_types"))) {
                    extraOrPresentationFieldCount++;
                    continue;
                }
                if (association.targetSetId === null && association.targets.length !== 0)
                    nullTargetSetWithTargetsCount++;
                effectIds.push(association.effect.rowId);
                for (const forbidden of ["structuredPercentValues", "rawRows", "target_value", "name", "text", "value"]) {
                    if (Object.prototype.hasOwnProperty.call(association, forbidden))
                        percentTextRawOrValueFieldCount++;
                }
            }
            repeatedEffectReferenceCount += duplicates(effectIds);
        }
    if (duplicateStateIdCount)
        failures.push("duplicate state identity");
    if (repeatedEffectReferenceCount)
        failures.push("repeated effect reference");
    if (unstableStateOrderCount)
        failures.push("unstable state order");
    if (extraOrPresentationFieldCount)
        failures.push("extra or presentation field included");
    if (redundantFlatTargetFieldCount)
        failures.push("redundant flat target field included");
    if (nullTargetSetWithTargetsCount)
        failures.push("null target set with targets");
    if (percentTextRawOrValueFieldCount)
        failures.push("percent text raw or value field included");
    const expectedCoverage = buildCharacterLeaderAssociationProjectionCoverage(Array.isArray(dataset?.states) ? dataset.states : []);
    if (JSON.stringify(coverage) !== JSON.stringify(expectedCoverage))
        failures.push("coverage mismatch");
    try {
        assertCoveragePins(coverage);
    }
    catch {
        failures.push("production pins changed");
    }
    if (sizes.rawSizeBytes >= leader_association_projection_contract_1.CHARACTER_LEADER_ASSOCIATION_PROJECTION_RAW_LIMIT_BYTES)
        failures.push("raw byte budget reached");
    if (sizes.gzipSizeBytes >= leader_association_projection_contract_1.CHARACTER_LEADER_ASSOCIATION_PROJECTION_GZIP_LIMIT_BYTES)
        failures.push("gzip byte budget reached");
    if (sizes.metadataSizeBytes >= leader_association_projection_contract_1.CHARACTER_LEADER_ASSOCIATION_PROJECTION_METADATA_LIMIT_BYTES)
        failures.push("metadata byte budget reached");
    const uniqueFailures = [...new Set(failures)].sort();
    return {
        schemaVersion: 1, contract: "dokkan-database-character-leader-association-structural-projection-validation",
        contractVersion: leader_association_projection_contract_1.CHARACTER_LEADER_ASSOCIATION_PROJECTION_CONTRACT_VERSION, valid: uniqueFailures.length === 0,
        failures: uniqueFailures.slice(0, leader_association_projection_contract_1.CHARACTER_LEADER_ASSOCIATION_PROJECTION_SAMPLE_LIMIT),
        failuresTruncated: uniqueFailures.length > leader_association_projection_contract_1.CHARACTER_LEADER_ASSOCIATION_PROJECTION_SAMPLE_LIMIT,
        sizes: {
            rawMaximumBytesExclusive: leader_association_projection_contract_1.CHARACTER_LEADER_ASSOCIATION_PROJECTION_RAW_LIMIT_BYTES,
            gzipMaximumBytesExclusive: leader_association_projection_contract_1.CHARACTER_LEADER_ASSOCIATION_PROJECTION_GZIP_LIMIT_BYTES,
            metadataMaximumBytesExclusive: leader_association_projection_contract_1.CHARACTER_LEADER_ASSOCIATION_PROJECTION_METADATA_LIMIT_BYTES, ...sizes,
        },
        safety: {
            duplicateStateIdCount, repeatedEffectReferenceCount, unstableStateOrderCount, extraOrPresentationFieldCount,
            redundantFlatTargetFieldCount, nullTargetSetWithTargetsCount, percentTextRawOrValueFieldCount,
            characterArrayRecordCount: 0, networkRequestCount: 0,
            automaticCleanupAttempted: false, outputNamespaceThreatModel: "caller_controlled_stable_during_operation",
        },
        readiness: {
            offlineGeneration: "GO", sourceBoundValidation: "NOT_EXECUTED", semanticAssociation: "NO-GO",
            leaderClauseSemantics: "NO-GO", presentation: "NO-GO", productReplacement: "NO-GO",
            consumer: "NO-GO", applyOrOverlay: "NO-GO", authority: "NO-GO", production: "NO-GO", publisher: "NO-GO",
            network: "NO-GO", r2: "NO-GO", android: "NO-GO",
        },
    };
}
exports.validateCharacterLeaderAssociationProjection = validateCharacterLeaderAssociationProjection;
function materializeCharacterLeaderAssociationProjection(dataset, coverage) {
    const raw = jsonBytes(dataset), gzip = (0, zlib_1.gzipSync)(raw, { level: 9 }), coverageBytes = jsonBytes(coverage), payloadSha256 = hash(gzip);
    let metadataSizeBytes = 0;
    for (let attempt = 0; attempt < 8; attempt++) {
        const validation = validateCharacterLeaderAssociationProjection(dataset, coverage, { rawSizeBytes: raw.length, gzipSizeBytes: gzip.length, metadataSizeBytes });
        if (!validation.valid)
            throw new Error(`K48 projection validation failed: ${validation.failures.join("; ")}`);
        const validationBytes = jsonBytes(validation);
        const manifest = {
            schemaVersion: 1, contract: "dokkan-database-character-leader-association-structural-projection-manifest",
            contractVersion: leader_association_projection_contract_1.CHARACTER_LEADER_ASSOCIATION_PROJECTION_CONTRACT_VERSION,
            fileName: `database-characters-k48-leader-association-projection.${payloadSha256}.json.gz`, compression: "gzip",
            sha256: payloadSha256, sizeBytes: gzip.length, uncompressedSha256: hash(raw), uncompressedSizeBytes: raw.length,
            counts: {
                states: coverage.states.included, effectAssociations: coverage.effectAssociations,
                targetReferences: coverage.targetReferences, repeatedTargetReferences: coverage.repeatedTargetReferences,
            },
            source: dataset.source, coverageFile: leader_association_projection_contract_1.CHARACTER_LEADER_ASSOCIATION_PROJECTION_FILES.coverage,
            coverageSha256: hash(coverageBytes), coverageSizeBytes: coverageBytes.length,
            validationFile: leader_association_projection_contract_1.CHARACTER_LEADER_ASSOCIATION_PROJECTION_FILES.validation,
            validationSha256: hash(validationBytes), validationSizeBytes: validationBytes.length,
        };
        const manifestBytes = jsonBytes(manifest), actualMetadataSizeBytes = coverageBytes.length + validationBytes.length + manifestBytes.length;
        if (actualMetadataSizeBytes >= leader_association_projection_contract_1.CHARACTER_LEADER_ASSOCIATION_PROJECTION_METADATA_LIMIT_BYTES)
            throw new Error(`K48 metadata byte budget reached: ${actualMetadataSizeBytes}`);
        if (actualMetadataSizeBytes === metadataSizeBytes)
            return { dataset, coverage, validation, manifest, raw, gzip, coverageBytes, validationBytes, manifestBytes };
        metadataSizeBytes = actualMetadataSizeBytes;
    }
    throw new Error("K48 metadata size did not converge");
}
exports.materializeCharacterLeaderAssociationProjection = materializeCharacterLeaderAssociationProjection;
function samePath(left, right) {
    return process.platform === "win32" ? (0, path_1.resolve)(left).toLowerCase() === (0, path_1.resolve)(right).toLowerCase() : (0, path_1.resolve)(left) === (0, path_1.resolve)(right);
}
function sameFile(left, right) { return left.dev === right.dev && left.ino === right.ino; }
async function regularRoot(value) {
    const root = (0, path_1.resolve)(value), before = await (0, promises_1.lstat)(root);
    if (!before.isDirectory() || before.isSymbolicLink())
        throw new Error("K48 artifact root must be an existing regular non-link directory");
    const canonical = await (0, promises_1.realpath)(root);
    if (!samePath(root, canonical))
        throw new Error("K48 artifact root symlink or junction rejected");
    return canonical;
}
async function readBoundedCharacterLeaderAssociationProjectionMember(rootValue, fileName, maximumBytesExclusive, expectedSizeBytes) {
    const root = await regularRoot(rootValue);
    if (!/^[a-z0-9][a-z0-9.-]+$/.test(fileName) || fileName.includes("..") || fileName.includes("/") || fileName.includes("\\"))
        throw new Error("K48 artifact member name rejected");
    const path = (0, path_1.join)(root, fileName);
    if (!samePath(path, (0, path_1.resolve)(root, fileName)))
        throw new Error("K48 artifact member escaped root");
    const before = await (0, promises_1.lstat)(path);
    if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1 || !Number.isSafeInteger(maximumBytesExclusive)
        || maximumBytesExclusive <= 0 || !Number.isSafeInteger(before.size) || before.size < 0 || before.size >= maximumBytesExclusive
        || (expectedSizeBytes !== undefined && before.size !== expectedSizeBytes))
        throw new Error("K48 artifact member byte budget or identity rejected");
    const handle = await (0, promises_1.open)(path, fs_1.constants.O_RDONLY | (fs_1.constants.O_NOFOLLOW ?? 0));
    try {
        const opened = await handle.stat();
        if (!sameFile(before, opened) || !opened.isFile() || opened.nlink !== 1 || opened.size !== before.size)
            throw new Error("K48 artifact member identity changed while opening");
        const bytes = Buffer.alloc(opened.size);
        let offset = 0;
        while (offset < bytes.length) {
            const read = await handle.read(bytes, offset, bytes.length - offset, offset);
            if (read.bytesRead <= 0)
                throw new Error("K48 artifact member ended before exact size");
            offset += read.bytesRead;
        }
        if ((await handle.read(Buffer.allocUnsafe(1), 0, 1, offset)).bytesRead !== 0)
            throw new Error("K48 artifact member exceeded exact size");
        const after = await handle.stat(), visible = await (0, promises_1.lstat)(path);
        if (!sameFile(opened, after) || !sameFile(opened, visible) || after.nlink !== 1 || visible.nlink !== 1
            || visible.isSymbolicLink() || after.size !== opened.size || visible.size !== opened.size)
            throw new Error("K48 artifact member changed while reading");
        return bytes;
    }
    finally {
        await handle.close();
    }
}
exports.readBoundedCharacterLeaderAssociationProjectionMember = readBoundedCharacterLeaderAssociationProjectionMember;
async function readArtifactSet(root) {
    const manifestBytes = await readBoundedCharacterLeaderAssociationProjectionMember(root, leader_association_projection_contract_1.CHARACTER_LEADER_ASSOCIATION_PROJECTION_FILES.manifest, leader_association_projection_contract_1.CHARACTER_LEADER_ASSOCIATION_PROJECTION_METADATA_LIMIT_BYTES);
    const manifest = JSON.parse(manifestBytes.toString("utf8"));
    if (!/^database-characters-k48-leader-association-projection\.[a-f0-9]{64}\.json\.gz$/.test(manifest.fileName)
        || manifest.fileName.split(".")[1] !== manifest.sha256 || manifest.coverageFile !== leader_association_projection_contract_1.CHARACTER_LEADER_ASSOCIATION_PROJECTION_FILES.coverage
        || manifest.validationFile !== leader_association_projection_contract_1.CHARACTER_LEADER_ASSOCIATION_PROJECTION_FILES.validation
        || !Number.isSafeInteger(manifest.sizeBytes) || manifest.sizeBytes < 0 || manifest.sizeBytes >= leader_association_projection_contract_1.CHARACTER_LEADER_ASSOCIATION_PROJECTION_GZIP_LIMIT_BYTES
        || !Number.isSafeInteger(manifest.coverageSizeBytes) || manifest.coverageSizeBytes < 0 || manifest.coverageSizeBytes >= leader_association_projection_contract_1.CHARACTER_LEADER_ASSOCIATION_PROJECTION_METADATA_LIMIT_BYTES
        || !Number.isSafeInteger(manifest.validationSizeBytes) || manifest.validationSizeBytes < 0 || manifest.validationSizeBytes >= leader_association_projection_contract_1.CHARACTER_LEADER_ASSOCIATION_PROJECTION_METADATA_LIMIT_BYTES
        || manifestBytes.length + manifest.coverageSizeBytes + manifest.validationSizeBytes >= leader_association_projection_contract_1.CHARACTER_LEADER_ASSOCIATION_PROJECTION_METADATA_LIMIT_BYTES)
        throw new Error("K48 manifest identity or budget rejected");
    const [gzip, coverageBytes, validationBytes] = await Promise.all([
        readBoundedCharacterLeaderAssociationProjectionMember(root, manifest.fileName, leader_association_projection_contract_1.CHARACTER_LEADER_ASSOCIATION_PROJECTION_GZIP_LIMIT_BYTES, manifest.sizeBytes),
        readBoundedCharacterLeaderAssociationProjectionMember(root, manifest.coverageFile, leader_association_projection_contract_1.CHARACTER_LEADER_ASSOCIATION_PROJECTION_METADATA_LIMIT_BYTES, manifest.coverageSizeBytes),
        readBoundedCharacterLeaderAssociationProjectionMember(root, manifest.validationFile, leader_association_projection_contract_1.CHARACTER_LEADER_ASSOCIATION_PROJECTION_METADATA_LIMIT_BYTES, manifest.validationSizeBytes),
    ]);
    if (hash(gzip) !== manifest.sha256 || hash(coverageBytes) !== manifest.coverageSha256 || hash(validationBytes) !== manifest.validationSha256)
        throw new Error("K48 artifact hash rejected");
    const raw = (0, zlib_1.gunzipSync)(gzip, { maxOutputLength: leader_association_projection_contract_1.CHARACTER_LEADER_ASSOCIATION_PROJECTION_RAW_LIMIT_BYTES });
    if (raw.length !== manifest.uncompressedSizeBytes || raw.length >= leader_association_projection_contract_1.CHARACTER_LEADER_ASSOCIATION_PROJECTION_RAW_LIMIT_BYTES
        || hash(raw) !== manifest.uncompressedSha256)
        throw new Error("K48 raw artifact identity rejected");
    const dataset = JSON.parse(raw.toString("utf8"));
    const coverage = JSON.parse(coverageBytes.toString("utf8"));
    const validation = JSON.parse(validationBytes.toString("utf8"));
    if (!raw.equals(jsonBytes(dataset)) || !gzip.equals((0, zlib_1.gzipSync)(raw, { level: 9 })))
        throw new Error("K48 canonical payload rejected");
    const rebuilt = materializeCharacterLeaderAssociationProjection(dataset, coverage);
    if (!rebuilt.raw.equals(raw) || !rebuilt.gzip.equals(gzip) || !rebuilt.coverageBytes.equals(coverageBytes)
        || !rebuilt.validationBytes.equals(validationBytes) || !rebuilt.manifestBytes.equals(manifestBytes)
        || JSON.stringify(validation) !== JSON.stringify(rebuilt.validation))
        throw new Error("K48 artifact reconstruction rejected");
    return rebuilt;
}
async function validateCharacterLeaderAssociationProjectionArtifact(options) {
    const runOptions = { optIn: true, sidecarRoot: options.sidecarRoot, productionRoot: options.productionRoot, fyiRoot: options.fyiRoot, k43Root: options.k43Root, k46Root: options.k46Root };
    const k47 = await (0, leader_association_scope_run_1.runCharacterLeaderAssociationScopeAudit)(runOptions);
    if (global.gc)
        global.gc();
    let validatedK46 = await (0, leader_projection_1.validateCharacterLeaderProjectionArtifact)({ artifactRoot: options.k46Root, sidecarRoot: options.sidecarRoot, productionRoot: options.productionRoot, fyiRoot: options.fyiRoot, k43Root: options.k43Root });
    const k46Identity = (0, leader_association_scope_source_1.compactK46LeaderAssociationSource)(validatedK46.artifacts).identity;
    let k3 = await (0, leader_association_scope_source_1.loadPinnedK3LeaderAssociationSource)(options.sidecarRoot);
    const k3Identity = k3.identity;
    const built = buildCharacterLeaderAssociationProjection(validatedK46.artifacts, k3, k47);
    let expected = materializeCharacterLeaderAssociationProjection(built.dataset, built.coverage);
    validatedK46 = undefined;
    k3 = undefined;
    if (global.gc)
        global.gc();
    let actual = await readArtifactSet(options.artifactRoot);
    for (const [label, actualBytes, expectedBytes] of [
        ["payload", actual.gzip, expected.gzip], ["coverage", actual.coverageBytes, expected.coverageBytes],
        ["validation", actual.validationBytes, expected.validationBytes], ["manifest", actual.manifestBytes, expected.manifestBytes],
    ])
        if (!actualBytes.equals(expectedBytes))
            throw new Error(`K48 source-bound artifact mismatch: ${label}`);
    const reread = await readArtifactSet(options.artifactRoot);
    if (!actual.gzip.equals(reread.gzip) || !actual.coverageBytes.equals(reread.coverageBytes)
        || !actual.validationBytes.equals(reread.validationBytes) || !actual.manifestBytes.equals(reread.manifestBytes))
        throw new Error("K48 artifact changed during source-bound validation");
    actual = undefined;
    expected = undefined;
    if (global.gc)
        global.gc();
    let finalK46 = await (0, leader_projection_1.validateCharacterLeaderProjectionArtifact)({ artifactRoot: options.k46Root, sidecarRoot: options.sidecarRoot, productionRoot: options.productionRoot, fyiRoot: options.fyiRoot, k43Root: options.k43Root });
    (0, leader_association_scope_source_1.assertLeaderAssociationK46Stable)(k46Identity, (0, leader_association_scope_source_1.compactK46LeaderAssociationSource)(finalK46.artifacts).identity);
    finalK46 = undefined;
    let finalK3 = await (0, leader_association_scope_source_1.loadPinnedK3LeaderAssociationSource)(options.sidecarRoot);
    (0, leader_association_scope_source_1.assertLeaderAssociationK3Stable)(k3Identity, finalK3.identity);
    finalK3 = undefined;
    if (global.gc)
        global.gc();
    const finalK47 = await (0, leader_association_scope_run_1.runCharacterLeaderAssociationScopeAudit)(runOptions);
    if (JSON.stringify(k47) !== JSON.stringify(finalK47))
        throw new Error("K48 K47 proof or source fingerprint changed after artifact reread");
    return { artifacts: reread, sourceBoundValidation: "GO" };
}
exports.validateCharacterLeaderAssociationProjectionArtifact = validateCharacterLeaderAssociationProjectionArtifact;
//# sourceMappingURL=leader-association-projection.js.map