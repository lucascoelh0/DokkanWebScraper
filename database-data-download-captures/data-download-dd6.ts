import { createHash } from "crypto"; import { readFile } from "fs/promises"; import { resolve } from "path"; import { resolveContainedArtifactPath, ContainedArtifactPathError } from "../artifact-path"; import { Dd2Dataset, DdValidation } from "./data-download-contract";
type Classification = "agreement" | "representation_gain" | "representation_mismatch" | "confirmed_conflict" | "unknown" | "unjoinable";
export interface Dd6SourceLock { schemaVersion: 1; contract: "dokkan-data-download-shadow-source-lock"; contractVersion: "0.7.0"; artifacts: Array<{ key: string; fileName: string; sizeBytes: number; sha256: string }> }
export interface Dd6Dataset { schemaVersion: 1; contract: "dokkan-data-download-shadow-parity"; contractVersion: "0.7.0"; generatedAt: string; collectionMode: "offline_pinned_document_and_code_comparison"; defaultEnabled: false; productionMutation: false; identityPolicy: "structural_endpoint_field_and_exact_path_only_no_names_or_localized_text"; sourceLineage: Dd6SourceLock["artifacts"]; rows: Array<{ subject: string; prior: string; classification: Classification; units: number; reason: string }>; totals: Record<Classification, number>; completenessWarning: "zero_confirmed_conflicts_never_implies_completeness" }
const expectedKeys = ["project_state","s0_s7","e0_e9","k0_k28","f0_f6","m0_m6","h6","h12","h13","acquisition_contract","manual_sqlite_acquisition_contract","acquisition_playbook","c4_contract","game_db_readme","r2_adr","current_downloader","sqlite_compatibility","current_update_runner","artifact_path"];
const expectedRows: Array<Pick<Dd6Dataset["rows"][number], "subject" | "prior" | "classification" | "units">> = [
    { subject: "official_database_descriptor", prior: "H6", classification: "agreement", units: 1 },
    { subject: "safe_asset_path_boundary", prior: "H6+artifact-path", classification: "agreement", units: 1 },
    { subject: "official_asset_manifest_schema", prior: "S4", classification: "representation_gain", units: 1 },
    { subject: "mandatory_ondemand_manifest", prior: "S0-S7", classification: "representation_gain", units: 1 },
    { subject: "complete_client_asset_inventory", prior: "S0-S7", classification: "representation_gain", units: 1 },
    { subject: "authenticated_refresh_readiness", prior: "H12", classification: "agreement", units: 1 },
    { subject: "offline_default_off_boundary", prior: "F0-F6+M0-M6", classification: "agreement", units: 2 },
    { subject: "event_asset_reference_to_container", prior: "E0-E9", classification: "unjoinable", units: 1 },
    { subject: "character_portrait_to_container", prior: "K0-K28", classification: "unjoinable", units: 1 },
    { subject: "upstream_vs_project_delivery", prior: "K21-K28+ADR-0003", classification: "representation_mismatch", units: 1 },
    { subject: "manual_database_downloader_safety", prior: "current_downloader", classification: "agreement", units: 1 },
    { subject: "acquisition_transform_boundary", prior: "acquisition_contract", classification: "agreement", units: 1 },
    { subject: "update_publication_boundary", prior: "current_update_runner", classification: "representation_mismatch", units: 1 },
    { subject: "gasha_conflict_correction", prior: "H13", classification: "unknown", units: 1 },
];
const sha = (text: string) => createHash("sha256").update(text).digest("hex");
function exactKeys(value: object, expected: string[]): boolean { return Object.keys(value).sort().join("\0") === [...expected].sort().join("\0"); }
export async function validateDd6SourceLock(root: string, lock: Dd6SourceLock): Promise<void> { if (!lock || typeof lock !== "object" || !exactKeys(lock, ["schemaVersion", "contract", "contractVersion", "artifacts"]) || lock.schemaVersion !== 1 || lock.contract !== "dokkan-data-download-shadow-source-lock" || lock.contractVersion !== "0.7.0" || !Array.isArray(lock.artifacts) || JSON.stringify(lock.artifacts.map(value => value.key)) !== JSON.stringify(expectedKeys) || new Set(lock.artifacts.map(value => value.fileName)).size !== lock.artifacts.length || lock.artifacts.some(item => !exactKeys(item, ["key", "fileName", "sizeBytes", "sha256"]) || !Number.isSafeInteger(item.sizeBytes) || item.sizeBytes <= 0 || !/^[a-f0-9]{64}$/.test(item.sha256))) throw new Error("DD6 source lock contract mismatch"); for (const item of lock.artifacts) { const path = await resolveContainedArtifactPath({ trustedRoot: root, untrustedPath: item.fileName, expectedType: "file" }, (code, type) => new ContainedArtifactPathError(`DD6 source rejected (${code})`, code, type)); const text = await readFile(path, "utf8"); if (Buffer.byteLength(text) !== item.sizeBytes || sha(text) !== item.sha256) throw new Error(`DD6 source identity mismatch ${item.key}`); } }
export async function buildDd6(root: string, lock: Dd6SourceLock, dd2: Dd2Dataset): Promise<Dd6Dataset> { await validateDd6SourceLock(root, lock); const rows: Dd6Dataset["rows"] = [
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
]; const totals = Object.fromEntries((["agreement","representation_gain","representation_mismatch","confirmed_conflict","unknown","unjoinable"] as Classification[]).map(key => [key, rows.filter(value => value.classification === key).reduce((sum, value) => sum + value.units, 0)])) as Record<Classification, number>; const dataset: Dd6Dataset = { schemaVersion: 1, contract: "dokkan-data-download-shadow-parity", contractVersion: "0.7.0", generatedAt: dd2.generatedAt, collectionMode: "offline_pinned_document_and_code_comparison", defaultEnabled: false, productionMutation: false, identityPolicy: "structural_endpoint_field_and_exact_path_only_no_names_or_localized_text", sourceLineage: lock.artifacts, rows, totals, completenessWarning: "zero_confirmed_conflicts_never_implies_completeness" }; const validation = validateDd6(dataset, lock); if (!validation.valid) throw new Error(`DD6 validation failed: ${validation.failures.join(", ")}`); return dataset; }
export function validateDd6(value: Dd6Dataset, lock?: Dd6SourceLock): DdValidation {
    const failures: string[] = [];
    const classifications: Classification[] = ["agreement","representation_gain","representation_mismatch","confirmed_conflict","unknown","unjoinable"];
    if (!value || typeof value !== "object" || !exactKeys(value, ["schemaVersion","contract","contractVersion","generatedAt","collectionMode","defaultEnabled","productionMutation","identityPolicy","sourceLineage","rows","totals","completenessWarning"])
        || value.schemaVersion !== 1 || value.contract !== "dokkan-data-download-shadow-parity" || value.contractVersion !== "0.7.0"
        || typeof value.generatedAt !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value.generatedAt)
        || value.collectionMode !== "offline_pinned_document_and_code_comparison" || value.defaultEnabled || value.productionMutation
        || value.identityPolicy !== "structural_endpoint_field_and_exact_path_only_no_names_or_localized_text"
        || value.completenessWarning !== "zero_confirmed_conflicts_never_implies_completeness") failures.push("DD6 parity contract");
    const lockValid = Boolean(lock && exactKeys(lock, ["schemaVersion", "contract", "contractVersion", "artifacts"])
        && lock.schemaVersion === 1 && lock.contract === "dokkan-data-download-shadow-source-lock" && lock.contractVersion === "0.7.0"
        && Array.isArray(lock.artifacts) && JSON.stringify(lock.artifacts.map(item => item.key)) === JSON.stringify(expectedKeys)
        && lock.artifacts.every(item => exactKeys(item, ["key","fileName","sizeBytes","sha256"]) && typeof item.fileName === "string" && item.fileName.length > 0
            && Number.isSafeInteger(item.sizeBytes) && item.sizeBytes > 0 && /^[a-f0-9]{64}$/.test(item.sha256)));
    if (!lockValid || !Array.isArray(value?.sourceLineage) || JSON.stringify(value.sourceLineage) !== JSON.stringify(lock!.artifacts)
        || value.sourceLineage.some(item => !exactKeys(item, ["key","fileName","sizeBytes","sha256"]) || typeof item.fileName !== "string" || !item.fileName
            || !Number.isSafeInteger(item.sizeBytes) || item.sizeBytes <= 0 || !/^[a-f0-9]{64}$/.test(item.sha256))) failures.push("DD6 source lineage");
    if (!Array.isArray(value?.rows) || value.rows.length !== expectedRows.length || value.rows.some((row, index) => !exactKeys(row, ["subject","prior","classification","units","reason"])
        || row.subject !== expectedRows[index].subject || row.prior !== expectedRows[index].prior || row.classification !== expectedRows[index].classification
        || row.units !== expectedRows[index].units || typeof row.reason !== "string" || row.reason.length === 0)) failures.push("DD6 parity rows");
    const totalsValid = value?.totals && typeof value.totals === "object" && exactKeys(value.totals, classifications);
    const recalculated = Object.fromEntries(classifications.map(key => [key, Array.isArray(value?.rows) ? value.rows.filter(row => row.classification === key).reduce((sum, row) => sum + row.units, 0) : 0]));
    if (!totalsValid || JSON.stringify(value.totals) !== JSON.stringify(recalculated)) failures.push("DD6 parity totals");
    return { schemaVersion: 1, valid: failures.length === 0, failures: [...new Set(failures)], counts: { rows: Array.isArray(value?.rows) ? value.rows.length : 0, ...(totalsValid ? value.totals : {}) } };
}
