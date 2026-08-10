"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const path_1 = require("path");
const v8_1 = require("v8");
const special_m4_lossless_1 = require("./special-m4-lossless");
const root = (0, path_1.resolve)(process.cwd());
if ((0, v8_1.getHeapStatistics)().heap_size_limit >= 1024 * 1024 * 1024)
    throw new Error("M4 requires a Node heap below 1 GiB");
const read = (path) => (0, fs_1.readFileSync)((0, path_1.resolve)(root, path), "utf8"), m1Text = read("data/database-special-modes-captures/m1/special-m1-pettan.json"), m2Text = read("data/database-special-modes-captures/m2/special-m2-burst.json"), m3Text = read("data/database-special-modes-captures/m3/special-m3-database-joins.json"), m1 = JSON.parse(m1Text), m2 = JSON.parse(m2Text), m3 = JSON.parse(m3Text), dataset = (0, special_m4_lossless_1.buildSpecialM4)(m1, m1Text, m2, m2Text, m3, m3Text), validation = (0, special_m4_lossless_1.validateSpecialM4)(dataset, m1, m2, m3), text = `${JSON.stringify(dataset, null, 2)}\n`, manifest = { schemaVersion: 1, contractVersion: dataset.contractVersion, generatedAt: dataset.generatedAt, fileName: "special-m4-lossless-facts.json", sizeBytes: Buffer.byteLength(text), sha256: (0, crypto_1.createHash)("sha256").update(text).digest("hex") }, out = (0, path_1.resolve)(root, "data/database-special-modes-captures/m4");
(0, fs_1.mkdirSync)(out, { recursive: true });
(0, fs_1.writeFileSync)((0, path_1.resolve)(out, manifest.fileName), text);
(0, fs_1.writeFileSync)((0, path_1.resolve)(out, "special-m4-validation.json"), `${JSON.stringify(validation, null, 2)}\n`);
(0, fs_1.writeFileSync)((0, path_1.resolve)(out, "special-m4-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(validation)}\n`);
//# sourceMappingURL=special-m4-run.js.map