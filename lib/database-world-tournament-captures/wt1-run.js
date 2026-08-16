"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const path_1 = require("path");
const v8_1 = require("v8");
const wt1_catalog_1 = require("./wt1-catalog");
const hash = (value) => (0, crypto_1.createHash)("sha256").update(value).digest("hex"), root = (0, path_1.resolve)(process.cwd());
if ((0, v8_1.getHeapStatistics)().heap_size_limit >= 1024 * 1024 * 1024)
    throw new Error("WT1 requires a Node heap below 1 GiB");
const read = (name) => (0, fs_1.readFileSync)((0, path_1.resolve)(root, "data/database-world-tournament-captures/wt0", name), "utf8"), wt0Text = read("wt0-inventory.json"), wt0ValidationText = read("wt0-validation.json"), wt0Manifest = JSON.parse(read("wt0-manifest.json"));
for (const [name, text] of [["wt0-inventory.json", wt0Text], ["wt0-validation.json", wt0ValidationText]]) {
    const member = wt0Manifest.members?.find(value => value.fileName === name);
    if (!member || member.sizeBytes !== Buffer.byteLength(text) || member.sha256 !== hash(text))
        throw new Error("WT1 WT0 manifest mismatch");
}
if (JSON.parse(wt0ValidationText)?.valid !== true)
    throw new Error("WT1 WT0 validation not green");
const dataset = (0, wt1_catalog_1.buildWt1)(JSON.parse(wt0Text), wt0Text), validation = (0, wt1_catalog_1.validateWt1)(dataset), payload = `${JSON.stringify(dataset, null, 2)}\n`, validationText = `${JSON.stringify(validation, null, 2)}\n`, output = (0, path_1.resolve)(root, "data/database-world-tournament-captures/wt1"), member = (fileName, text) => ({ fileName, sizeBytes: Buffer.byteLength(text), sha256: hash(text) });
(0, fs_1.mkdirSync)(output, { recursive: true });
const payloadPath = (0, path_1.resolve)(output, "wt1-route-catalog.json"), validationPath = (0, path_1.resolve)(output, "wt1-validation.json");
(0, fs_1.writeFileSync)(payloadPath, payload);
(0, fs_1.writeFileSync)(validationPath, validationText);
if (hash((0, fs_1.readFileSync)(payloadPath)) !== hash(payload) || hash((0, fs_1.readFileSync)(validationPath)) !== hash(validationText))
    throw new Error("WT1 post-write mismatch");
(0, fs_1.writeFileSync)((0, path_1.resolve)(output, "wt1-manifest.json"), `${JSON.stringify({ schemaVersion: 1, contractVersion: dataset.contractVersion, members: [member("wt1-route-catalog.json", payload), member("wt1-validation.json", validationText)] }, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(validation)}\n`);
//# sourceMappingURL=wt1-run.js.map