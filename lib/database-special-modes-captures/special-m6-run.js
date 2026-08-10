"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const path_1 = require("path");
const v8_1 = require("v8");
const capture_secret_scan_1 = require("../database-server-captures/capture-secret-scan");
const special_m6_readiness_1 = require("./special-m6-readiness");
const root = (0, path_1.resolve)(process.cwd());
if ((0, v8_1.getHeapStatistics)().heap_size_limit >= 1024 * 1024 * 1024)
    throw new Error("M6 requires a Node heap below 1 GiB");
const read = (path) => (0, fs_1.readFileSync)((0, path_1.resolve)(root, path), "utf8"), artifacts = ["m0", "m1", "m2", "m3", "m4", "m5"].map((gate, index) => { const names = ["special-m0-inventory.json", "special-m1-pettan.json", "special-m2-burst.json", "special-m3-database-joins.json", "special-m4-lossless-facts.json", "special-m5-shadow-parity.json"]; return { gate: gate, fileName: names[index], text: read(`data/database-special-modes-captures/${gate}/${names[index]}`) }; }), validations = ["m0", "m1", "m2", "m3", "m4", "m5"].map((gate, index) => JSON.parse(read(`data/database-special-modes-captures/${gate}/special-${gate}-validation.json`))), models = artifacts.map(value => JSON.parse(value.text)), fixtureText = read("database-special-modes-captures/fixtures/special-modes-synthetic-shapes.json"), memory = JSON.parse(read("database-special-modes-captures/special-m6-memory-evidence.json")), dataset = (0, special_m6_readiness_1.buildSpecialM6)({ m0: models[0], m0Validation: validations[0], m1: models[1], m1Validation: validations[1], m2: models[2], m2Validation: validations[2], m3: models[3], m3Validation: validations[3], m4: models[4], m4Validation: validations[4], m5: models[5], m5Validation: validations[5], artifactTexts: artifacts, fixtureText, memory }), validation = (0, special_m6_readiness_1.validateSpecialM6)(dataset), text = `${JSON.stringify(dataset, null, 2)}\n`, manifest = { schemaVersion: 1, contractVersion: dataset.contractVersion, generatedAt: dataset.generatedAt, fileName: "special-m6-readiness.json", sizeBytes: Buffer.byteLength(text), sha256: (0, crypto_1.createHash)("sha256").update(text).digest("hex") }, sourceManifest = { schemaVersion: 1, inputRoot: "special", captures: [{ captureId: "burst-mode-2026-08-10", path: "burst_mode.har" }, { captureId: "pettan-not-live-2026-08-10", path: "pettan_but_not_live.har" }] }, scan = (0, capture_secret_scan_1.scanTextsForSecrets)((0, capture_secret_scan_1.collectCaptureSensitiveValues)(sourceManifest, { special: "D:\\Dokkan\\har logs\\08-10" }), [...artifacts.map(value => ({ name: value.fileName, text: value.text })), { name: "special-m6-readiness.json", text }, { name: "special-modes-synthetic-shapes.json", text: fixtureText }]);
if (!scan.valid)
    throw new Error("M6 secret scan failed");
const out = (0, path_1.resolve)(root, "data/database-special-modes-captures/m6");
(0, fs_1.mkdirSync)(out, { recursive: true });
(0, fs_1.writeFileSync)((0, path_1.resolve)(out, manifest.fileName), text);
(0, fs_1.writeFileSync)((0, path_1.resolve)(out, "special-m6-validation.json"), `${JSON.stringify(validation, null, 2)}\n`);
(0, fs_1.writeFileSync)((0, path_1.resolve)(out, "special-m6-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
(0, fs_1.writeFileSync)((0, path_1.resolve)(out, "special-m6-secret-scan.json"), `${JSON.stringify(scan, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ ...validation, secretScanValid: scan.valid, exactCapturedSecretMatches: scan.exactCapturedSecretMatches })}\n`);
//# sourceMappingURL=special-m6-run.js.map