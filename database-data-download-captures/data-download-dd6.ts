import { execFile } from "child_process"; import { createHash } from "crypto"; import { resolve } from "path"; import { Dd2Dataset, DdValidation } from "./data-download-contract"; import { validateDd2 } from "./data-download-dd2";
type Classification = "agreement" | "representation_gain" | "representation_mismatch" | "confirmed_conflict" | "unknown" | "unjoinable";
export interface Dd6SourceLock { schemaVersion: 1; contract: "dokkan-data-download-shadow-source-lock"; contractVersion: "0.8.0"; identityPolicy: "git_blob_bytes_v1"; artifacts: Array<{ key: string; fileName: string; sizeBytes: number; sha256: string }> }
export interface Dd6Dataset { schemaVersion: 1; contract: "dokkan-data-download-shadow-parity"; contractVersion: "0.9.0"; generatedAt: string; collectionMode: "offline_pinned_document_and_code_comparison"; defaultEnabled: false; productionMutation: false; identityPolicy: "structural_endpoint_field_and_exact_path_only_no_names_or_localized_text"; sourceIdentityPolicy: "git_blob_bytes_v1"; sourceLineage: Dd6SourceLock["artifacts"]; inputLineage: { contract: "dokkan-data-download-asset-contracts"; contractVersion: "0.1.0"; identityPolicy: "recursive_lexicographic_json_v1"; sizeBytes: number; sha256: string }; rows: Array<{ subject: string; prior: string; classification: Classification; units: number; reason: string }>; totals: Record<Classification, number>; completenessWarning: "zero_confirmed_conflicts_never_implies_completeness" }
const expectedSources = [
    ["project_state", "docs/project-state.md"], ["s0_s7", "docs/game-db/database-server-catalog-report.md"], ["e0_e9", "docs/game-db/database-events-frontier-report.md"], ["k0_k28", "docs/game-db/database-characters-frontier-report.md"], ["f0_f6", "docs/game-db/specs/database-frontier-capture-f0-f6.md"], ["m0_m6", "docs/game-db/specs/database-special-modes-capture-m0-m6.md"], ["h6", "docs/game-db/specs/database-server-capture-h6.md"], ["h12", "docs/game-db/specs/database-server-capture-h12.md"], ["h13", "docs/game-db/specs/database-server-capture-h13.md"], ["acquisition_contract", "docs/game-db/specs/game-db-first-party-acquisition-contract.md"], ["manual_sqlite_acquisition_contract", "docs/game-db/specs/game-db-manual-sqlite-acquisition-aq0-aq6.md"], ["acquisition_playbook", "docs/game-db/game-db-first-party-acquisition-playbook.md"], ["c4_contract", "docs/game-db/specs/database-first-integration-c4.md"], ["game_db_readme", "game-db/README.md"], ["r2_adr", "docs/adr/0003-distribute-datasets-through-versioned-r2-manifests.md"], ["current_downloader", "game-db/game-db-download-database-artifact.ts"], ["sqlite_compatibility", "game-db/game-db-sqlite-compatibility.ts"], ["current_update_runner", "game-db/game-db-update-runner.ts"], ["artifact_path", "artifact-path.ts"],
] as const;
const expectedKeys = expectedSources.map(([key]) => key);
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
function expectedReasons(dd2: Dd2Dataset): string[] { return [
    `same GET endpoint and version/algorithm/hash/path descriptor shape across ${dd2.database.descriptorObservationCount} observations`,
    "exact official host, sanitized pathname and realpath containment remain required",
    `S4 had static discovery only; DD proves ${dd2.clientAssets.descriptorObservationCount} size-bearing descriptor observations`,
    "two externally retained response bodies prove the same 4,868 path/hash/size/algorithm identities while delivery URLs differ",
    "one bounded response proves 25,233 unique descriptors and exact mandatory-manifest inclusion for this snapshot",
    "capture evidence does not prove non-personal credential lifecycle or authorize refresh",
    "all campaigns are offline, additive, default-off and no-replay",
    "aggregate CPK families expose no exact internal E6 asset path binding",
    "character/thumb CPK names do not prove internal portrait IDs or bytes",
    "official CDN acquisition and content-addressed project R2 delivery are different representations",
    "AQ accepts only an exact descriptor-bound Global EN URL, blocks redirects, streams bounded bytes into a contained content-addressed marker-last store, emits sanitized receipts and requires separate authorization for transport",
    "readable SQLite handoff already separates downstream normalized export",
    "existing runner can publish in the same invocation while DD7 requires separately authorized workflows",
    "DD asset acquisition does not compare H13 gasha pool semantics",
]; }
function exactKeys(value: object, expected: string[]): boolean { return Object.keys(value).sort().join("\0") === [...expected].sort().join("\0"); }
function canonicalJson(value: unknown): string {
    if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
    if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
    if (value && typeof value === "object") return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`).join(",")}}`;
    throw new Error("DD6 input cannot be represented by the canonical JSON policy");
}
function dd2Identity(dd2: Dd2Dataset): Dd6Dataset["inputLineage"] {
    const bytes = Buffer.from(canonicalJson(dd2), "utf8");
    return { contract: "dokkan-data-download-asset-contracts", contractVersion: "0.1.0", identityPolicy: "recursive_lexicographic_json_v1", sizeBytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") };
}
function git(root: string, args: string[]): Promise<Buffer> { return new Promise((done, reject) => execFile("git", ["-C", root, ...args], { encoding: "buffer", maxBuffer: 16 * 1024 * 1024, windowsHide: true }, (error, stdout) => error ? reject(new Error("DD6 canonical Git source is unavailable")) : done(Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout)))); }
function samePath(left: string, right: string): boolean { return process.platform === "win32" ? resolve(left).toLowerCase() === resolve(right).toLowerCase() : resolve(left) === resolve(right); }
export async function readDd6CanonicalGitBlob(root: string, fileName: string): Promise<Buffer> { if (typeof root !== "string" || !root || typeof fileName !== "string" || !/^[A-Za-z0-9._/-]+$/.test(fileName) || fileName.startsWith("/") || fileName.split("/").some(part => !part || part === "." || part === "..")) throw new Error("DD6 canonical Git source path is invalid"); const topLevel = (await git(root, ["rev-parse", "--show-toplevel"])).toString("utf8").trim(); if (!samePath(topLevel, root)) throw new Error("DD6 root must be the canonical Git checkout root"); return git(root, ["cat-file", "blob", `HEAD:${fileName}`]); }
export async function validateDd6SourceLock(root: string, lock: Dd6SourceLock): Promise<void> { if (!lock || typeof lock !== "object" || !exactKeys(lock, ["schemaVersion", "contract", "contractVersion", "identityPolicy", "artifacts"]) || lock.schemaVersion !== 1 || lock.contract !== "dokkan-data-download-shadow-source-lock" || lock.contractVersion !== "0.8.0" || lock.identityPolicy !== "git_blob_bytes_v1" || !Array.isArray(lock.artifacts) || JSON.stringify(lock.artifacts.map(value => [value.key, value.fileName])) !== JSON.stringify(expectedSources) || lock.artifacts.some(item => !exactKeys(item, ["key", "fileName", "sizeBytes", "sha256"]) || !Number.isSafeInteger(item.sizeBytes) || item.sizeBytes <= 0 || !/^[a-f0-9]{64}$/.test(item.sha256))) throw new Error("DD6 source lock contract mismatch"); for (const item of lock.artifacts) { const bytes = await readDd6CanonicalGitBlob(root, item.fileName); if (bytes.byteLength !== item.sizeBytes || createHash("sha256").update(bytes).digest("hex") !== item.sha256) throw new Error(`DD6 source identity mismatch ${item.key}`); } }
export async function buildDd6(root: string, lock: Dd6SourceLock, dd2: Dd2Dataset): Promise<Dd6Dataset> { await validateDd6SourceLock(root, lock); const dd2Validation = validateDd2(dd2); if (!dd2Validation.valid) throw new Error(`DD6 DD2 input validation failed: ${dd2Validation.failures.join(", ")}`); const rows: Dd6Dataset["rows"] = [
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
]; const totals = Object.fromEntries((["agreement","representation_gain","representation_mismatch","confirmed_conflict","unknown","unjoinable"] as Classification[]).map(key => [key, rows.filter(value => value.classification === key).reduce((sum, value) => sum + value.units, 0)])) as Record<Classification, number>; const dataset: Dd6Dataset = { schemaVersion: 1, contract: "dokkan-data-download-shadow-parity", contractVersion: "0.9.0", generatedAt: dd2.generatedAt, collectionMode: "offline_pinned_document_and_code_comparison", defaultEnabled: false, productionMutation: false, identityPolicy: "structural_endpoint_field_and_exact_path_only_no_names_or_localized_text", sourceIdentityPolicy: lock.identityPolicy, sourceLineage: lock.artifacts, inputLineage: dd2Identity(dd2), rows, totals, completenessWarning: "zero_confirmed_conflicts_never_implies_completeness" }; const validation = validateDd6(dataset, lock, dd2); if (!validation.valid) throw new Error(`DD6 validation failed: ${validation.failures.join(", ")}`); return dataset; }
export function validateDd6(value: Dd6Dataset, lock?: Dd6SourceLock, dd2?: Dd2Dataset): DdValidation {
    const failures: string[] = [];
    const classifications: Classification[] = ["agreement","representation_gain","representation_mismatch","confirmed_conflict","unknown","unjoinable"];
    if (!value || typeof value !== "object" || !exactKeys(value, ["schemaVersion","contract","contractVersion","generatedAt","collectionMode","defaultEnabled","productionMutation","identityPolicy","sourceIdentityPolicy","sourceLineage","inputLineage","rows","totals","completenessWarning"])
        || value.schemaVersion !== 1 || value.contract !== "dokkan-data-download-shadow-parity" || value.contractVersion !== "0.9.0"
        || typeof value.generatedAt !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value.generatedAt)
        || value.collectionMode !== "offline_pinned_document_and_code_comparison" || value.defaultEnabled || value.productionMutation
        || value.identityPolicy !== "structural_endpoint_field_and_exact_path_only_no_names_or_localized_text" || value.sourceIdentityPolicy !== "git_blob_bytes_v1"
        || value.completenessWarning !== "zero_confirmed_conflicts_never_implies_completeness") failures.push("DD6 parity contract");
    const lockValid = Boolean(lock && exactKeys(lock, ["schemaVersion", "contract", "contractVersion", "identityPolicy", "artifacts"])
        && lock.schemaVersion === 1 && lock.contract === "dokkan-data-download-shadow-source-lock" && lock.contractVersion === "0.8.0" && lock.identityPolicy === "git_blob_bytes_v1"
        && Array.isArray(lock.artifacts) && JSON.stringify(lock.artifacts.map(item => [item.key, item.fileName])) === JSON.stringify(expectedSources)
        && lock.artifacts.every(item => exactKeys(item, ["key","fileName","sizeBytes","sha256"]) && typeof item.fileName === "string" && item.fileName.length > 0
            && Number.isSafeInteger(item.sizeBytes) && item.sizeBytes > 0 && /^[a-f0-9]{64}$/.test(item.sha256)));
    if (!lockValid || !Array.isArray(value?.sourceLineage) || JSON.stringify(value.sourceLineage) !== JSON.stringify(lock!.artifacts)
        || value.sourceLineage.some(item => !exactKeys(item, ["key","fileName","sizeBytes","sha256"]) || typeof item.fileName !== "string" || !item.fileName
            || !Number.isSafeInteger(item.sizeBytes) || item.sizeBytes <= 0 || !/^[a-f0-9]{64}$/.test(item.sha256))) failures.push("DD6 source lineage");
    const dd2Valid = Boolean(dd2 && validateDd2(dd2).valid);
    if (!dd2Valid || !value?.inputLineage || !exactKeys(value.inputLineage, ["contract","contractVersion","identityPolicy","sizeBytes","sha256"])
        || JSON.stringify(value.inputLineage) !== JSON.stringify(dd2Identity(dd2!)) || value.generatedAt !== dd2!.generatedAt) failures.push("DD6 DD2 input lineage");
    const reasons = dd2 ? expectedReasons(dd2) : [];
    if (!Array.isArray(value?.rows) || value.rows.length !== expectedRows.length || value.rows.some((row, index) => !exactKeys(row, ["subject","prior","classification","units","reason"])
        || row.subject !== expectedRows[index].subject || row.prior !== expectedRows[index].prior || row.classification !== expectedRows[index].classification
        || row.units !== expectedRows[index].units || row.reason !== reasons[index])) failures.push("DD6 parity rows");
    const totalsValid = value?.totals && typeof value.totals === "object" && exactKeys(value.totals, classifications);
    const recalculated = Object.fromEntries(classifications.map(key => [key, Array.isArray(value?.rows) ? value.rows.filter(row => row.classification === key).reduce((sum, row) => sum + row.units, 0) : 0]));
    if (!totalsValid || JSON.stringify(value.totals) !== JSON.stringify(recalculated)) failures.push("DD6 parity totals");
    return { schemaVersion: 1, valid: failures.length === 0, failures: [...new Set(failures)], counts: { rows: Array.isArray(value?.rows) ? value.rows.length : 0, ...(totalsValid ? value.totals : {}) } };
}
