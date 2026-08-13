"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateDd6 = exports.buildDd6 = exports.validateDd6SourceLock = void 0;
const crypto_1 = require("crypto");
const promises_1 = require("fs/promises");
const artifact_path_1 = require("../artifact-path");
const expectedKeys = ["project_state", "s0_s7", "e0_e9", "k0_k28", "f0_f6", "m0_m6", "h6", "h12", "h13", "acquisition_contract", "acquisition_playbook", "r2_adr", "current_downloader", "current_update_runner", "artifact_path"];
const sha = (text) => (0, crypto_1.createHash)("sha256").update(text).digest("hex");
function exactKeys(value, expected) { return Object.keys(value).sort().join("\0") === [...expected].sort().join("\0"); }
async function validateDd6SourceLock(root, lock) { if (!lock || typeof lock !== "object" || !exactKeys(lock, ["schemaVersion", "contract", "contractVersion", "artifacts"]) || lock.schemaVersion !== 1 || lock.contract !== "dokkan-data-download-shadow-source-lock" || lock.contractVersion !== "0.7.0" || !Array.isArray(lock.artifacts) || JSON.stringify(lock.artifacts.map(value => value.key)) !== JSON.stringify(expectedKeys) || new Set(lock.artifacts.map(value => value.fileName)).size !== lock.artifacts.length || lock.artifacts.some(item => !exactKeys(item, ["key", "fileName", "sizeBytes", "sha256"]) || !Number.isSafeInteger(item.sizeBytes) || item.sizeBytes <= 0 || !/^[a-f0-9]{64}$/.test(item.sha256)))
    throw new Error("DD6 source lock contract mismatch"); for (const item of lock.artifacts) {
    const path = await (0, artifact_path_1.resolveContainedArtifactPath)({ trustedRoot: root, untrustedPath: item.fileName, expectedType: "file" }, (code, type) => new artifact_path_1.ContainedArtifactPathError(`DD6 source rejected (${code})`, code, type));
    const text = await (0, promises_1.readFile)(path, "utf8");
    if (Buffer.byteLength(text) !== item.sizeBytes || sha(text) !== item.sha256)
        throw new Error(`DD6 source identity mismatch ${item.key}`);
} }
exports.validateDd6SourceLock = validateDd6SourceLock;
async function buildDd6(root, lock, dd2) {
    await validateDd6SourceLock(root, lock);
    const rows = [
        { subject: "official_database_descriptor", prior: "H6", classification: "agreement", units: 1, reason: `same GET endpoint and version/algorithm/hash/path descriptor shape across ${dd2.database.descriptorObservationCount} observations` },
        { subject: "safe_asset_path_boundary", prior: "H6+artifact-path", classification: "agreement", units: 1, reason: "exact official host, sanitized pathname and realpath containment remain required" },
        { subject: "official_asset_manifest_schema", prior: "S4", classification: "representation_gain", units: 1, reason: `S4 had static discovery only; DD proves ${dd2.clientAssets.descriptorObservationCount} size-bearing descriptor observations` },
        { subject: "mandatory_ondemand_manifest", prior: "S0-S7", classification: "representation_gain", units: 1, reason: "two externally retained response bodies prove the same 4,868 path/hash/size/algorithm identities while delivery URLs differ" },
        { subject: "complete_client_asset_inventory", prior: "S0-S7", classification: "representation_gain", units: 1, reason: "one bounded response proves 25,233 unique descriptors and exact mandatory-manifest inclusion for this snapshot" },
        { subject: "authenticated_refresh_readiness", prior: "H12", classification: "agreement", units: 1, reason: "capture evidence does not prove non-personal credential lifecycle or authorize refresh" },
        { subject: "offline_default_off_boundary", prior: "F0-F6+M0-M6", classification: "agreement", units: 2, reason: "all campaigns are offline, additive, default-off and no-replay" },
        { subject: "event_asset_reference_to_container", prior: "E0-E9", classification: "unjoinable", units: 1, reason: "aggregate CPK families expose no exact internal E6 asset path binding" },
        { subject: "character_portrait_to_container", prior: "K0-K28", classification: "unjoinable", units: 1, reason: "character/thumb CPK names do not prove internal portrait IDs or bytes" },
        { subject: "upstream_vs_project_delivery", prior: "K21-K28+ADR-0003", classification: "representation_mismatch", units: 1, reason: "official CDN acquisition and content-addressed project R2 delivery are different representations" },
        { subject: "manual_database_downloader_safety", prior: "current_downloader", classification: "agreement", units: 1, reason: "AQ accepts only an exact descriptor-bound Global EN URL, blocks redirects, streams bounded bytes into a contained content-addressed marker-last store, emits sanitized receipts and requires separate authorization for transport" },
        { subject: "acquisition_transform_boundary", prior: "acquisition_contract", classification: "agreement", units: 1, reason: "readable SQLite handoff already separates downstream normalized export" },
        { subject: "update_publication_boundary", prior: "current_update_runner", classification: "representation_mismatch", units: 1, reason: "existing runner can publish in the same invocation while DD7 requires separately authorized workflows" },
        { subject: "gasha_conflict_correction", prior: "H13", classification: "unknown", units: 1, reason: "DD asset acquisition does not compare H13 gasha pool semantics" },
    ];
    const totals = Object.fromEntries(["agreement", "representation_gain", "representation_mismatch", "confirmed_conflict", "unknown", "unjoinable"].map(key => [key, rows.filter(value => value.classification === key).reduce((sum, value) => sum + value.units, 0)]));
    const dataset = { schemaVersion: 1, contract: "dokkan-data-download-shadow-parity", contractVersion: "0.7.0", generatedAt: dd2.generatedAt, collectionMode: "offline_pinned_document_and_code_comparison", defaultEnabled: false, productionMutation: false, identityPolicy: "structural_endpoint_field_and_exact_path_only_no_names_or_localized_text", sourceLineage: lock.artifacts, rows, totals, completenessWarning: "zero_confirmed_conflicts_never_implies_completeness" };
    const validation = validateDd6(dataset);
    if (!validation.valid)
        throw new Error(`DD6 validation failed: ${validation.failures.join(", ")}`);
    return dataset;
}
exports.buildDd6 = buildDd6;
function validateDd6(value) { const failures = []; const recalculated = Object.fromEntries(Object.keys(value.totals).map(key => [key, value.rows.filter(row => row.classification === key).reduce((sum, row) => sum + row.units, 0)])); if (value.defaultEnabled || value.productionMutation || value.identityPolicy !== "structural_endpoint_field_and_exact_path_only_no_names_or_localized_text" || JSON.stringify(value.totals) !== JSON.stringify(recalculated) || value.completenessWarning !== "zero_confirmed_conflicts_never_implies_completeness" || value.rows.some(row => row.units <= 0))
    failures.push("DD6 parity contract"); return { schemaVersion: 1, valid: failures.length === 0, failures, counts: { rows: value.rows.length, ...value.totals } }; }
exports.validateDd6 = validateDd6;
//# sourceMappingURL=data-download-dd6.js.map