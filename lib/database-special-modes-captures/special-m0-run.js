"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const path_1 = require("path");
const v8_1 = require("v8");
const capture_h0_audit_1 = require("../database-server-captures/capture-h0-audit");
const special_m0_audit_1 = require("./special-m0-audit");
const root = (0, path_1.resolve)(process.cwd());
if ((0, v8_1.getHeapStatistics)().heap_size_limit >= 1024 * 1024 * 1024)
    throw new Error("M0 requires a Node heap below 1 GiB");
const lock = JSON.parse((0, fs_1.readFileSync)((0, path_1.resolve)(root, "database-special-modes-captures/special-m0-source-lock.json"), "utf8"));
const captureRoot = "D:\\Dokkan\\har logs\\08-10";
const inputs = lock.captures.map(item => ({ lock: item, text: (0, capture_h0_audit_1.readValidatedCaptureSnapshot)(captureRoot, item.fileName, item.captureId).text }));
const dataset = (0, special_m0_audit_1.buildSpecialM0)(inputs, lock), validation = (0, special_m0_audit_1.validateSpecialM0)(dataset, lock), text = `${JSON.stringify(dataset, null, 2)}\n`, validationText = `${JSON.stringify(validation, null, 2)}\n`;
const manifest = { schemaVersion: 1, contractVersion: dataset.contractVersion, generatedAt: dataset.generatedAt, fileName: "special-m0-inventory.json", sizeBytes: Buffer.byteLength(text), sha256: (0, crypto_1.createHash)("sha256").update(text).digest("hex") };
const out = (0, path_1.resolve)(root, "data/database-special-modes-captures/m0");
(0, fs_1.mkdirSync)(out, { recursive: true });
(0, fs_1.writeFileSync)((0, path_1.resolve)(out, manifest.fileName), text);
(0, fs_1.writeFileSync)((0, path_1.resolve)(out, "special-m0-validation.json"), validationText);
(0, fs_1.writeFileSync)((0, path_1.resolve)(out, "special-m0-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(validation)}\n`);
//# sourceMappingURL=special-m0-run.js.map