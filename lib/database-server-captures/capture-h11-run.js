"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const path_1 = require("path");
const v8_1 = require("v8");
const capture_h7_shadow_readiness_1 = require("./capture-h7-shadow-readiness");
const capture_h11_parity_1 = require("./capture-h11-parity");
const capture_secret_scan_1 = require("./capture-secret-scan");
const root = (0, path_1.resolve)(process.cwd());
if ((0, v8_1.getHeapStatistics)().heap_size_limit >= 1024 * 1024 * 1024)
    throw new Error("H11 requires a Node heap below 1 GiB");
const read = (path) => { const text = (0, fs_1.readFileSync)((0, path_1.resolve)(root, path), "utf8"); return { text, value: JSON.parse(text) }; };
const lock = read("database-server-captures/capture-h11-source-lock.json");
const expectedLockPaths = { h7: "data/database-server-captures/h7/capture-h7-shadow-readiness.json", h8: "data/database-server-captures/h8/capture-h8-inventory.json", h9: "data/database-server-captures/h9/capture-h9-observed-schemas.json", h10: "data/database-server-captures/h10/capture-h10-domains.json" };
if (lock.value.schemaVersion !== 1 || lock.value.contract !== "dokkan-official-capture-h11-source-lock" || lock.value.contractVersion !== "0.12.0" || JSON.stringify(lock.value.artifacts.map((value) => value.key).sort()) !== JSON.stringify(Object.keys(expectedLockPaths).sort()))
    throw new Error("invalid H11 source lock contract");
for (const artifact of lock.value.artifacts) {
    if (artifact.path !== expectedLockPaths[artifact.key] || !Number.isSafeInteger(artifact.sizeBytes) || artifact.sizeBytes <= 0 || !/^[a-f0-9]{64}$/.test(artifact.sha256))
        throw new Error(`invalid H11 source lock entry: ${artifact.key}`);
    const file = read(artifact.path);
    if (Buffer.byteLength(file.text) !== artifact.sizeBytes || (0, crypto_1.createHash)("sha256").update(file.text).digest("hex") !== artifact.sha256)
        throw new Error(`H11 source lock mismatch: ${artifact.key}`);
}
const h7 = read("data/database-server-captures/h7/capture-h7-shadow-readiness.json").value;
const h8 = read("data/database-server-captures/h8/capture-h8-inventory.json").value;
const h10 = read("data/database-server-captures/h10/capture-h10-domains.json").value;
const h3 = read("data/database-server-captures/h3/capture-h3-schedules.json").value;
const h4 = read("data/database-server-captures/h4/capture-h4-gashas.json").value;
const h5 = read("data/database-server-captures/h5/capture-h5-mission-boards.json").value;
const h6 = read("data/database-server-captures/h6/capture-h6-assets.json").value;
if (!(0, capture_h7_shadow_readiness_1.validateCaptureH7)(h7).valid)
    throw new Error("H11 requires a valid H7 checkpoint");
for (const [key, path] of [["h3", "data/database-server-captures/h3/capture-h3-schedules.json"], ["h4", "data/database-server-captures/h4/capture-h4-gashas.json"], ["h5", "data/database-server-captures/h5/capture-h5-mission-boards.json"], ["h6", "data/database-server-captures/h6/capture-h6-assets.json"]]) {
    const file = read(path), lineage = h7.sourceLineage.find(value => value.key === key);
    if (!lineage || lineage.artifactPath !== path || lineage.artifactSizeBytes !== Buffer.byteLength(file.text) || lineage.artifactSha256 !== (0, crypto_1.createHash)("sha256").update(file.text).digest("hex"))
        throw new Error(`H11 H7 lineage mismatch: ${key}`);
}
const dataset = (0, capture_h11_parity_1.buildCaptureH11)(lock.text, h7, h10, h3, h4, h5, h6, h8.captures.map(value => value.captureId));
const validation = (0, capture_h11_parity_1.validateCaptureH11)(dataset);
const text = `${JSON.stringify(dataset, null, 2)}\n`;
const manifest = read("database-server-captures/capture-h8-input-manifest.json").value;
const roots = { "dokkan-local-captures-0810": "D:\\Dokkan\\har logs\\08-10" };
const scan = (0, capture_secret_scan_1.scanTextsForSecrets)((0, capture_secret_scan_1.collectCaptureSensitiveValues)(manifest, roots), [{ name: "capture-h11-shadow-parity.json", text }]);
if (!scan.valid)
    throw new Error("H11 secret scan failed");
const output = (0, path_1.resolve)(root, "data/database-server-captures/h11");
(0, fs_1.mkdirSync)(output, { recursive: true });
(0, fs_1.writeFileSync)((0, path_1.resolve)(output, "capture-h11-shadow-parity.json"), text);
(0, fs_1.writeFileSync)((0, path_1.resolve)(output, "capture-h11-validation.json"), `${JSON.stringify(validation, null, 2)}\n`);
(0, fs_1.writeFileSync)((0, path_1.resolve)(output, "capture-h11-secret-scan.json"), `${JSON.stringify(scan, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ ...validation, secretScanValid: scan.valid })}\n`);
//# sourceMappingURL=capture-h11-run.js.map