"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const path_1 = require("path");
const v8_1 = require("v8");
const capture_h0_audit_1 = require("../database-server-captures/capture-h0-audit");
const special_m1_pettan_1 = require("./special-m1-pettan");
const root = (0, path_1.resolve)(process.cwd());
if ((0, v8_1.getHeapStatistics)().heap_size_limit >= 1024 * 1024 * 1024)
    throw new Error("M1 requires a Node heap below 1 GiB");
const read = (path) => (0, fs_1.readFileSync)((0, path_1.resolve)(root, path), "utf8"), m0Text = read("data/database-special-modes-captures/m0/special-m0-inventory.json"), m0 = JSON.parse(m0Text), lock = JSON.parse(read("database-special-modes-captures/special-m0-source-lock.json")), source = lock.captures.find(value => value.captureId === "pettan-not-live-2026-08-10");
if (!source)
    throw new Error("M1 source lock missing");
const harText = (0, capture_h0_audit_1.readValidatedCaptureSnapshot)("D:\\Dokkan\\har logs\\08-10", source.fileName, source.captureId).text, dataset = (0, special_m1_pettan_1.buildSpecialM1)(harText, m0, m0Text), validation = (0, special_m1_pettan_1.validateSpecialM1)(dataset, m0, m0Text), text = `${JSON.stringify(dataset, null, 2)}\n`, manifest = { schemaVersion: 1, contractVersion: dataset.contractVersion, generatedAt: dataset.generatedAt, fileName: "special-m1-pettan.json", sizeBytes: Buffer.byteLength(text), sha256: (0, crypto_1.createHash)("sha256").update(text).digest("hex") }, out = (0, path_1.resolve)(root, "data/database-special-modes-captures/m1");
(0, fs_1.mkdirSync)(out, { recursive: true });
(0, fs_1.writeFileSync)((0, path_1.resolve)(out, manifest.fileName), text);
(0, fs_1.writeFileSync)((0, path_1.resolve)(out, "special-m1-validation.json"), `${JSON.stringify(validation, null, 2)}\n`);
(0, fs_1.writeFileSync)((0, path_1.resolve)(out, "special-m1-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(validation)}\n`);
//# sourceMappingURL=special-m1-run.js.map