"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const path_1 = require("path");
const v8_1 = require("v8");
const capture_h11_parity_1 = require("./capture-h11-parity");
const capture_h13_gasha_audit_1 = require("./capture-h13-gasha-audit");
const capture_h12_readiness_1 = require("./capture-h12-readiness");
const capture_secret_scan_1 = require("./capture-secret-scan");
const root = (0, path_1.resolve)(process.cwd());
if ((0, v8_1.getHeapStatistics)().heap_size_limit >= 1024 * 1024 * 1024)
    throw new Error("H12 requires a Node heap below 1 GiB");
const read = (path) => { const text = (0, fs_1.readFileSync)((0, path_1.resolve)(root, path), "utf8"); return { text, value: JSON.parse(text) }; };
const lock = read("database-server-captures/capture-h12-source-lock.json");
const expectedPaths = { h8: "data/database-server-captures/h8/capture-h8-inventory.json", h9: "data/database-server-captures/h9/capture-h9-observed-schemas.json", h10: "data/database-server-captures/h10/capture-h10-domains.json", h11: "data/database-server-captures/h11/capture-h11-shadow-parity.json", h13: "data/database-server-captures/h13/capture-h13-gasha-audit.json" };
if (lock.value.schemaVersion !== 1 || lock.value.contract !== "dokkan-official-capture-h12-source-lock" || lock.value.contractVersion !== "0.13.1" || JSON.stringify(lock.value.artifacts.map((value) => value.key).sort()) !== JSON.stringify(Object.keys(expectedPaths).sort()))
    throw new Error("H12 source lock contract mismatch");
const files = new Map();
for (const artifact of lock.value.artifacts) {
    const file = read(artifact.path), sha256 = (0, crypto_1.createHash)("sha256").update(file.text).digest("hex"), sizeBytes = Buffer.byteLength(file.text);
    if (artifact.path !== expectedPaths[artifact.key] || artifact.sha256 !== sha256 || artifact.sizeBytes !== sizeBytes)
        throw new Error(`H12 source lock mismatch: ${artifact.key}`);
    files.set(artifact.key, { ...file, sha256, sizeBytes });
}
const h8 = files.get("h8").value, h9 = files.get("h9").value, h10 = files.get("h10").value, h11 = files.get("h11").value, h13 = files.get("h13").value;
if (!(0, capture_h11_parity_1.validateCaptureH11)(h11).valid || !(0, capture_h13_gasha_audit_1.validateCaptureH13)(h13).valid)
    throw new Error("H12 requires valid H11 and H13");
const sourceLockSha256 = (0, crypto_1.createHash)("sha256").update(lock.text).digest("hex"), h11File = files.get("h11"), h13File = files.get("h13");
const dataset = (0, capture_h12_readiness_1.buildCaptureH12)(h8, h9, h10, h11, h13, sourceLockSha256, h11File.sha256, h11File.sizeBytes, h13File.sha256, h13File.sizeBytes), validation = (0, capture_h12_readiness_1.validateCaptureH12)(dataset), text = `${JSON.stringify(dataset, null, 2)}\n`;
const manifest = read("database-server-captures/capture-h8-input-manifest.json").value, roots = { "dokkan-local-captures-0810": "D:\\Dokkan\\har logs\\08-10" };
const scan = (0, capture_secret_scan_1.scanTextsForSecrets)((0, capture_secret_scan_1.collectCaptureSensitiveValues)(manifest, roots), [{ name: "capture-h12-readiness.json", text }]);
if (!scan.valid)
    throw new Error("H12 secret scan failed");
const output = (0, path_1.resolve)(root, "data/database-server-captures/h12");
(0, fs_1.mkdirSync)(output, { recursive: true });
(0, fs_1.writeFileSync)((0, path_1.resolve)(output, "capture-h12-readiness.json"), text);
(0, fs_1.writeFileSync)((0, path_1.resolve)(output, "capture-h12-validation.json"), `${JSON.stringify(validation, null, 2)}\n`);
(0, fs_1.writeFileSync)((0, path_1.resolve)(output, "capture-h12-secret-scan.json"), `${JSON.stringify(scan, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ ...validation, decisions: Object.fromEntries(dataset.decisions.map(value => [value.key, value.status])), secretScanValid: scan.valid })}\n`);
//# sourceMappingURL=capture-h12-run.js.map