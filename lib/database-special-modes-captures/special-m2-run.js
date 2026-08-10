"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const path_1 = require("path");
const v8_1 = require("v8");
const capture_h0_audit_1 = require("../database-server-captures/capture-h0-audit");
const special_m2_burst_1 = require("./special-m2-burst");
const root = (0, path_1.resolve)(process.cwd());
if ((0, v8_1.getHeapStatistics)().heap_size_limit >= 1024 * 1024 * 1024)
    throw new Error("M2 requires a Node heap below 1 GiB");
const read = (path) => (0, fs_1.readFileSync)((0, path_1.resolve)(root, path), "utf8"), m0Text = read("data/database-special-modes-captures/m0/special-m0-inventory.json"), m0 = JSON.parse(m0Text), lock = JSON.parse(read("database-special-modes-captures/special-m0-source-lock.json")), source = lock.captures.find(value => value.captureId === "burst-mode-2026-08-10");
if (!source)
    throw new Error("M2 source lock missing");
const harText = (0, capture_h0_audit_1.readValidatedCaptureSnapshot)("D:\\Dokkan\\har logs\\08-10", source.fileName, source.captureId).text, dataset = (0, special_m2_burst_1.buildSpecialM2)(harText, m0, m0Text), validation = (0, special_m2_burst_1.validateSpecialM2)(dataset, m0, m0Text), text = `${JSON.stringify(dataset, null, 2)}\n`, manifest = { schemaVersion: 1, contractVersion: dataset.contractVersion, generatedAt: dataset.generatedAt, fileName: "special-m2-burst.json", sizeBytes: Buffer.byteLength(text), sha256: (0, crypto_1.createHash)("sha256").update(text).digest("hex") }, out = (0, path_1.resolve)(root, "data/database-special-modes-captures/m2");
(0, fs_1.mkdirSync)(out, { recursive: true });
(0, fs_1.writeFileSync)((0, path_1.resolve)(out, manifest.fileName), text);
(0, fs_1.writeFileSync)((0, path_1.resolve)(out, "special-m2-validation.json"), `${JSON.stringify(validation, null, 2)}\n`);
(0, fs_1.writeFileSync)((0, path_1.resolve)(out, "special-m2-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(validation)}\n`);
//# sourceMappingURL=special-m2-run.js.map