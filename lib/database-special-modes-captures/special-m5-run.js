"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const path_1 = require("path");
const v8_1 = require("v8");
const special_m5_parity_1 = require("./special-m5-parity");
const special_m5_sources_1 = require("./special-m5-sources");
const root = (0, path_1.resolve)(process.cwd());
if ((0, v8_1.getHeapStatistics)().heap_size_limit >= 1024 * 1024 * 1024)
    throw new Error("M5 requires a Node heap below 1 GiB");
const read = (path) => (0, fs_1.readFileSync)((0, path_1.resolve)(root, path), "utf8"), m2 = JSON.parse(read("data/database-special-modes-captures/m2/special-m2-burst.json")), m3 = JSON.parse(read("data/database-special-modes-captures/m3/special-m3-database-joins.json")), m4Text = read("data/database-special-modes-captures/m4/special-m4-lossless-facts.json"), m4 = JSON.parse(m4Text), lock = JSON.parse(read("database-special-modes-captures/special-m5-source-lock.json")), sources = (0, special_m5_sources_1.loadSpecialM5Sources)({ main: "D:\\Dokkan\\DokkanWebScraper", capture: "D:\\Dokkan\\DokkanWebScraper-server-captures" }, lock), dataset = (0, special_m5_parity_1.buildSpecialM5)(m2, m3, m4, m4Text, sources), validation = (0, special_m5_parity_1.validateSpecialM5)(dataset, m4, m4Text), text = `${JSON.stringify(dataset, null, 2)}\n`, manifest = { schemaVersion: 1, contractVersion: dataset.contractVersion, generatedAt: dataset.generatedAt, fileName: "special-m5-shadow-parity.json", sizeBytes: Buffer.byteLength(text), sha256: (0, crypto_1.createHash)("sha256").update(text).digest("hex") }, out = (0, path_1.resolve)(root, "data/database-special-modes-captures/m5");
(0, fs_1.mkdirSync)(out, { recursive: true });
(0, fs_1.writeFileSync)((0, path_1.resolve)(out, manifest.fileName), text);
(0, fs_1.writeFileSync)((0, path_1.resolve)(out, "special-m5-validation.json"), `${JSON.stringify(validation, null, 2)}\n`);
(0, fs_1.writeFileSync)((0, path_1.resolve)(out, "special-m5-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(validation)}\n`);
//# sourceMappingURL=special-m5-run.js.map