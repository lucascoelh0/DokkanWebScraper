"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateFrontierF1 = exports.buildFrontierF1 = exports.scanFrontierDictionaryArtifacts = void 0;
const child_process_1 = require("child_process");
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const path_1 = require("path");
const buffer_1 = require("buffer");
const frontier_zstd_1 = require("./frontier-zstd");
function sha256(value) { return (0, crypto_1.createHash)("sha256").update(value).digest("hex"); }
function normalizedRoute(pathname) { const parts = pathname.replace(/\/{2,}/g, "/").split("/").filter(Boolean).map(value => /^\d+$/.test(value) ? ":id" : value.toLowerCase()); return `/${parts.join("/")}`; }
function safeArtifactPath(root, path) { if (!/^[A-Za-z0-9_.\/-]+$/.test(path) || path.includes("..") || path.startsWith("/") || /^[A-Za-z]:/.test(path))
    throw new Error("F1 artifact path is unsafe"); const rootReal = (0, fs_1.realpathSync)(root), candidate = (0, path_1.resolve)(rootReal, path), inside = (0, path_1.relative)(rootReal, candidate); if (!inside || inside.startsWith("..") || (0, path_1.resolve)(rootReal, inside) !== candidate)
    throw new Error("F1 artifact escaped root"); let cursor = rootReal; for (const part of inside.split(/[\\/]/)) {
    cursor = (0, path_1.resolve)(cursor, part);
    const metadata = (0, fs_1.lstatSync)(cursor);
    if (metadata.isSymbolicLink())
        throw new Error("F1 artifact path contains a link");
} if (!(0, fs_1.statSync)(candidate).isFile())
    throw new Error("F1 artifact is not a file"); return candidate; }
function scanFrontierDictionaryArtifacts(lock, roots) {
    if (lock.schemaVersion !== 1 || lock.contract !== "dokkan-frontier-zstd-dictionary-search-lock" || lock.contractVersion !== "0.2.0" || !Array.isArray(lock.artifacts) || lock.artifacts.length === 0)
        throw new Error("F1 artifact lock mismatch");
    const artifacts = lock.artifacts.map(item => { const root = roots[item.root]; if (!root || !/^[a-z][a-z0-9_-]{0,47}$/.test(item.role) || !Number.isSafeInteger(item.sizeBytes) || item.sizeBytes <= 0 || !/^[a-f0-9]{64}$/.test(item.sha256))
        throw new Error("F1 invalid artifact lock entry"); const path = safeArtifactPath(root, item.relativePath), bytes = (0, fs_1.readFileSync)(path); if (bytes.length !== item.sizeBytes || sha256(bytes) !== item.sha256)
        throw new Error(`F1 artifact identity mismatch ${item.role}`); return { role: item.role, path, scanArchiveEntries: item.scanArchiveEntries }; });
    const bridge = (0, path_1.resolve)(__dirname, "frontier-dictionary-readonly-bridge.py"), sourceBridge = (0, path_1.resolve)(__dirname, "..", "..", "database-frontier-captures", "frontier-dictionary-readonly-bridge.py"), result = (0, child_process_1.spawnSync)(process.platform === "win32" ? "python" : "python3", [require("fs").existsSync(bridge) ? bridge : sourceBridge], { input: JSON.stringify({ artifacts }), encoding: "utf8", maxBuffer: 16 * 1024 * 1024, windowsHide: true });
    if (result.status !== 0)
        throw new Error(`F1 dictionary scan bridge failed: ${result.stderr}`);
    const parsed = JSON.parse(result.stdout);
    for (const item of lock.artifacts) {
        const scan = parsed.scans.find(value => value.artifactRole === item.role);
        if (!scan || scan.sizeBytes !== item.sizeBytes || scan.sha256 !== item.sha256)
            throw new Error(`F1 artifact changed during scan ${item.role}`);
    }
    return { scans: [...parsed.scans].sort((a, b) => a.artifactRole.localeCompare(b.artifactRole)), candidates: [...parsed.candidates].sort((a, b) => `${a.artifactRole}:${a.source}:${a.archiveEntry}:${a.offset}`.localeCompare(`${b.artifactRole}:${b.source}:${b.archiveEntry}:${b.offset}`)) };
}
exports.scanFrontierDictionaryArtifacts = scanFrontierDictionaryArtifacts;
function buildFrontierF1(harText, f0, f0Text, search) {
    if (sha256(buffer_1.Buffer.from(harText)) !== f0.source.sha256 || buffer_1.Buffer.byteLength(harText) !== f0.source.sizeBytes)
        throw new Error("F1/F0 HAR lineage mismatch");
    const entries = JSON.parse(harText)?.log?.entries;
    if (!Array.isArray(entries) || entries.length !== f0.entries.length)
        throw new Error("F1 invalid HAR lineage");
    const bodies = [];
    entries.forEach((entry, entryIndex) => { const content = entry?.response?.content, media = typeof content?.mimeType === "string" ? content.mimeType.split(";", 1)[0].trim().toLowerCase() : ""; if (media !== "application/x-zstd")
        return; if (content.encoding !== "base64" || typeof content.text !== "string")
        throw new Error("F1 Zstd body is not base64"); const compressed = buffer_1.Buffer.from(content.text, "base64"), frame = (0, frontier_zstd_1.parseZstdFrameHeader)(compressed), capturedAt = f0.entries[entryIndex]?.capturedAt; if (!capturedAt)
        throw new Error("F1 body lacks F0 provenance"); let path; try {
        path = normalizedRoute(new URL(entry.request.url).pathname);
    }
    catch {
        throw new Error("F1 body has invalid route");
    } bodies.push({ entryIndex, capturedAt, method: f0.entries[entryIndex].method, normalizedPath: path, status: f0.entries[entryIndex].status, mimeType: "application/x-zstd", contentEncoding: "base64", compressedSizeBytes: compressed.length, compressedSha256: sha256(compressed), frame }); });
    if (bodies.length === 0)
        throw new Error("F1 found no Zstd bodies");
    const dictionaryIds = [...new Set(bodies.map(value => value.frame.dictionaryId))];
    if (dictionaryIds.length !== 1 || dictionaryIds[0] === 0)
        throw new Error("F1 requires one non-zero observed dictionary ID");
    const observedDictionaryId = dictionaryIds[0], proved = search.candidates.filter(value => value.dictionaryId === observedDictionaryId && value.identityStatus !== "embedded_header_length_unknown" && value.sizeBytes !== null && value.sha256 !== null);
    if (proved.length > 1)
        throw new Error("F1 has ambiguous proved dictionary candidates");
    const proof = proved[0] ? { artifactRole: proved[0].artifactRole, source: proved[0].source, archiveEntry: proved[0].archiveEntry, sizeBytes: proved[0].sizeBytes, sha256: proved[0].sha256 } : null;
    const dataset = { schemaVersion: 1, contract: "dokkan-frontier-zstd-frame-and-dictionary-audit", contractVersion: "0.2.0", generatedAt: f0.generatedAt, generatedAtPolicy: "inherits_f0_capture_timestamp", collectionMode: "offline_local_har_no_requests_no_replay", productionMutation: false, defaultEnabled: false, f0ArtifactSha256: sha256(f0Text), f0ArtifactSizeBytes: buffer_1.Buffer.byteLength(f0Text), frameFormat: "zstandard_rfc8878", bodies, dictionary: { observedDictionaryId, identityStatus: proof ? "proved" : "unknown", proof, candidates: search.candidates, search: search.scans, unknownReason: proof ? null : "no_exact_zstd_dictionary_header_and_id_match_in_allowlisted_pinned_local_artifacts" } };
    const validation = validateFrontierF1(dataset, f0, f0Text);
    if (!validation.valid)
        throw new Error(`F1 validation failed: ${validation.failures.join(", ")}`);
    return dataset;
}
exports.buildFrontierF1 = buildFrontierF1;
function validateFrontierF1(dataset, f0, f0Text) { const failures = []; if (dataset.schemaVersion !== 1 || dataset.contract !== "dokkan-frontier-zstd-frame-and-dictionary-audit" || dataset.contractVersion !== "0.2.0" || dataset.generatedAtPolicy !== "inherits_f0_capture_timestamp" || dataset.collectionMode !== "offline_local_har_no_requests_no_replay" || dataset.productionMutation !== false || dataset.defaultEnabled !== false || dataset.frameFormat !== "zstandard_rfc8878" || !/^[a-f0-9]{64}$/.test(dataset.f0ArtifactSha256) || !Number.isSafeInteger(dataset.f0ArtifactSizeBytes) || dataset.f0ArtifactSizeBytes <= 0)
    failures.push("dataset contract"); const ids = [...new Set(dataset.bodies.map(value => value.frame.dictionaryId))]; if (ids.length !== 1 || ids[0] !== dataset.dictionary.observedDictionaryId || dataset.bodies.some(value => value.frame.dictionaryIdFieldBytes !== 4 || value.frame.magic !== "28b52ffd" || !/^[a-f0-9]{64}$/.test(value.compressedSha256) || value.compressedSizeBytes <= 0))
    failures.push("frame evidence"); const matching = dataset.dictionary.candidates.filter(value => value.dictionaryId === dataset.dictionary.observedDictionaryId && value.identityStatus !== "embedded_header_length_unknown" && value.sizeBytes !== null && value.sha256 !== null); if (dataset.dictionary.identityStatus === "proved" ? matching.length !== 1 || dataset.dictionary.proof === null : dataset.dictionary.proof !== null || matching.length !== 0 || dataset.dictionary.unknownReason === null)
    failures.push("dictionary proof"); if (f0 && f0Text && (dataset.generatedAt !== f0.generatedAt || dataset.f0ArtifactSha256 !== sha256(f0Text) || dataset.f0ArtifactSizeBytes !== buffer_1.Buffer.byteLength(f0Text) || dataset.bodies.some(value => f0.entries[value.entryIndex]?.responseMimeType !== "application/x-zstd")))
    failures.push("F0 lineage"); return { schemaVersion: 1, valid: failures.length === 0, bodyCount: dataset.bodies.length, dictionaryId: ids.length === 1 ? ids[0] : null, dictionaryIdentityStatus: dataset.dictionary.identityStatus, candidateCount: dataset.dictionary.candidates.length, failures: [...new Set(failures)] }; }
exports.validateFrontierF1 = validateFrontierF1;
//# sourceMappingURL=frontier-f1-audit.js.map