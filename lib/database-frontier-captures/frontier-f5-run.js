"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const v8_1 = require("v8");
const frontier_f5_inputs_1 = require("./frontier-f5-inputs");
const frontier_f5_parity_1 = require("./frontier-f5-parity");
const root = (0, path_1.resolve)(process.cwd());
if ((0, v8_1.getHeapStatistics)().heap_size_limit >= 1024 * 1024 * 1024)
    throw new Error("Frontier F5 requires a Node heap below 1 GiB");
const f3Text = (0, fs_1.readFileSync)((0, path_1.resolve)(root, "data/database-frontier-captures/f3/frontier-f3-catalog.json"), "utf8"), f3 = JSON.parse(f3Text), f4Text = (0, fs_1.readFileSync)((0, path_1.resolve)(root, "data/database-frontier-captures/f4/frontier-f4-observational-protocol.json"), "utf8"), f4 = JSON.parse(f4Text), lock = JSON.parse((0, fs_1.readFileSync)((0, path_1.resolve)(root, "database-frontier-captures/frontier-f5-source-lock.json"), "utf8")), external = (0, frontier_f5_inputs_1.loadFrontierF5Inputs)("D:\\Dokkan\\DokkanWebScraper\\data", lock), dataset = (0, frontier_f5_parity_1.buildFrontierF5)(f3, f3Text, f4, f4Text, external.inputs, external.lineage), validation = (0, frontier_f5_parity_1.validateFrontierF5)(dataset, f3, f3Text, f4, f4Text), out = (0, path_1.resolve)(root, "data/database-frontier-captures/f5");
(0, fs_1.mkdirSync)(out, { recursive: true });
(0, fs_1.writeFileSync)((0, path_1.resolve)(out, "frontier-f5-shadow-parity.json"), `${JSON.stringify(dataset, null, 2)}\n`);
(0, fs_1.writeFileSync)((0, path_1.resolve)(out, "frontier-f5-validation.json"), `${JSON.stringify(validation, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(validation)}\n`);
//# sourceMappingURL=frontier-f5-run.js.map