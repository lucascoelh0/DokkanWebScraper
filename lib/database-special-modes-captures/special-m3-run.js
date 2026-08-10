"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const path_1 = require("path");
const v8_1 = require("v8");
const special_m3_joins_1 = require("./special-m3-joins");
const special_m3_sources_1 = require("./special-m3-sources");
const root = (0, path_1.resolve)(process.cwd());
if ((0, v8_1.getHeapStatistics)().heap_size_limit >= 1024 * 1024 * 1024)
    throw new Error("M3 requires a Node heap below 1 GiB");
const read = (path) => (0, fs_1.readFileSync)((0, path_1.resolve)(root, path), "utf8"), m1Text = read("data/database-special-modes-captures/m1/special-m1-pettan.json"), m2Text = read("data/database-special-modes-captures/m2/special-m2-burst.json"), m1 = JSON.parse(m1Text), m2 = JSON.parse(m2Text), lock = JSON.parse(read("database-special-modes-captures/special-m3-source-lock.json")), inputs = (0, special_m3_sources_1.loadSpecialM3Sources)("D:\\Dokkan\\DokkanWebScraper", lock), dataset = (0, special_m3_joins_1.buildSpecialM3)(m1, m1Text, m2, m2Text, inputs), validation = (0, special_m3_joins_1.validateSpecialM3)(dataset, m1, m1Text, m2, m2Text), text = `${JSON.stringify(dataset, null, 2)}\n`, manifest = { schemaVersion: 1, contractVersion: dataset.contractVersion, generatedAt: dataset.generatedAt, fileName: "special-m3-database-joins.json", sizeBytes: Buffer.byteLength(text), sha256: (0, crypto_1.createHash)("sha256").update(text).digest("hex") }, out = (0, path_1.resolve)(root, "data/database-special-modes-captures/m3");
(0, fs_1.mkdirSync)(out, { recursive: true });
(0, fs_1.writeFileSync)((0, path_1.resolve)(out, manifest.fileName), text);
(0, fs_1.writeFileSync)((0, path_1.resolve)(out, "special-m3-validation.json"), `${JSON.stringify(validation, null, 2)}\n`);
(0, fs_1.writeFileSync)((0, path_1.resolve)(out, "special-m3-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(validation)}\n`);
//# sourceMappingURL=special-m3-run.js.map