"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const path_1 = require("path");
const v8_1 = require("v8");
const capture_h0_audit_1 = require("./capture-h0-audit");
const capture_h4_gashas_1 = require("./capture-h4-gashas");
const capture_h8_audit_1 = require("./capture-h8-audit");
const capture_h9_schemas_1 = require("./capture-h9-schemas");
const capture_h10_domains_1 = require("./capture-h10-domains");
const capture_h13_gasha_audit_1 = require("./capture-h13-gasha-audit");
const capture_secret_scan_1 = require("./capture-secret-scan");
const root = (0, path_1.resolve)(process.cwd());
if ((0, v8_1.getHeapStatistics)().heap_size_limit >= 1024 * 1024 * 1024)
    throw new Error("H13 requires a Node heap below 1 GiB");
const read = (path) => { const text = (0, fs_1.readFileSync)((0, path_1.resolve)(root, path), "utf8"); return { text, value: JSON.parse(text) }; };
const lock = read("database-server-captures/capture-h13-source-lock.json");
const expectedPaths = {
    h0_manifest: "database-server-captures/capture-input-manifest.json",
    h8_manifest: "database-server-captures/capture-h8-input-manifest.json",
    h0: "data/database-server-captures/h0/capture-h0-inventory.json",
    h4: "data/database-server-captures/h4/capture-h4-gashas.json",
    h8: "data/database-server-captures/h8/capture-h8-inventory.json",
    h9: "data/database-server-captures/h9/capture-h9-observed-schemas.json",
    h10: "data/database-server-captures/h10/capture-h10-domains.json",
};
if (lock.value.schemaVersion !== 1 || lock.value.contract !== "dokkan-official-capture-h13-source-lock" || lock.value.contractVersion !== "0.14.0" || JSON.stringify(lock.value.artifacts.map((value) => value.key).sort()) !== JSON.stringify(Object.keys(expectedPaths).sort()))
    throw new Error("invalid H13 source lock contract");
const files = new Map();
for (const artifact of lock.value.artifacts) {
    if (artifact.path !== expectedPaths[artifact.key] || !Number.isSafeInteger(artifact.sizeBytes) || artifact.sizeBytes <= 0 || !/^[a-f0-9]{64}$/.test(artifact.sha256))
        throw new Error(`invalid H13 source lock entry: ${artifact.key}`);
    const file = read(artifact.path);
    if (Buffer.byteLength(file.text) !== artifact.sizeBytes || (0, crypto_1.createHash)("sha256").update(file.text).digest("hex") !== artifact.sha256)
        throw new Error(`H13 source lock mismatch: ${artifact.key}`);
    files.set(artifact.key, file);
}
const h0Manifest = files.get("h0_manifest").value;
const h8Manifest = files.get("h8_manifest").value;
const h0 = files.get("h0").value;
const h4 = files.get("h4").value;
const h8 = files.get("h8").value;
const h9 = files.get("h9").value;
const h10 = files.get("h10").value;
const roots = { "dokkan-local-captures": "D:\\Dokkan", "dokkan-local-captures-0810": "D:\\Dokkan\\har logs\\08-10" };
if (JSON.stringify((0, capture_h0_audit_1.auditCaptureManifest)(h0Manifest, roots)) !== JSON.stringify(h0))
    throw new Error("H13 H0 validation failed");
if (!(0, capture_h4_gashas_1.validateCaptureH4)(h4, h0).valid || !(0, capture_h8_audit_1.validateCaptureH8)(h8, h8Manifest, roots).valid || !(0, capture_h9_schemas_1.validateCaptureH9)(h9, h8Manifest, roots, h8, files.get("h8").text).valid || !(0, capture_h10_domains_1.validateCaptureH10)(h10, h8Manifest, roots, h9, files.get("h9").text).valid)
    throw new Error("H13 upstream validation failed");
const dataset = (0, capture_h13_gasha_audit_1.buildCaptureH13)(lock.text, h0Manifest, h8Manifest, roots, h0, h4, h8, h10);
const validation = (0, capture_h13_gasha_audit_1.validateCaptureH13)(dataset), text = `${JSON.stringify(dataset, null, 2)}\n`;
const secrets = (0, capture_secret_scan_1.collectCaptureSensitiveValues)(h0Manifest, roots);
for (const value of (0, capture_secret_scan_1.collectCaptureSensitiveValues)(h8Manifest, roots))
    secrets.add(value);
const scan = (0, capture_secret_scan_1.scanTextsForSecrets)(secrets, [{ name: "capture-h13-gasha-audit.json", text }]);
if (!scan.valid)
    throw new Error("H13 secret scan failed");
const output = (0, path_1.resolve)(root, "data/database-server-captures/h13");
(0, fs_1.mkdirSync)(output, { recursive: true });
(0, fs_1.writeFileSync)((0, path_1.resolve)(output, "capture-h13-gasha-audit.json"), text);
(0, fs_1.writeFileSync)((0, path_1.resolve)(output, "capture-h13-validation.json"), `${JSON.stringify(validation, null, 2)}\n`);
(0, fs_1.writeFileSync)((0, path_1.resolve)(output, "capture-h13-secret-scan.json"), `${JSON.stringify(scan, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ ...validation, legacyNonExclusiveConflictCellCount: dataset.legacyNonExclusiveConflictCellCount, secretScanValid: scan.valid })}\n`);
//# sourceMappingURL=capture-h13-run.js.map