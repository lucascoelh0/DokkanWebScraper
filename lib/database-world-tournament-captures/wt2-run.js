"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const path_1 = require("path");
const v8_1 = require("v8");
const wt2_event_entry_1 = require("./wt2-event-entry");
const hash = (value) => (0, crypto_1.createHash)("sha256").update(value).digest("hex"), root = (0, path_1.resolve)(process.cwd());
if ((0, v8_1.getHeapStatistics)().heap_size_limit >= 1024 * 1024 * 1024)
    throw new Error("WT2 requires a Node heap below 1 GiB");
function readGate(gate, payloadName, validationName) {
    const base = (0, path_1.resolve)(root, `data/database-world-tournament-captures/${gate}`), payload = (0, fs_1.readFileSync)((0, path_1.resolve)(base, payloadName), "utf8"), validation = (0, fs_1.readFileSync)((0, path_1.resolve)(base, validationName), "utf8"), manifest = JSON.parse((0, fs_1.readFileSync)((0, path_1.resolve)(base, `${gate}-manifest.json`), "utf8"));
    for (const [fileName, text] of [[payloadName, payload], [validationName, validation]]) {
        const member = manifest.members?.find(value => value.fileName === fileName);
        if (!member || member.sizeBytes !== Buffer.byteLength(text) || member.sha256 !== hash(text))
            throw new Error(`WT2 ${gate} manifest mismatch`);
    }
    if (JSON.parse(validation)?.valid !== true)
        throw new Error(`WT2 ${gate} validation not green`);
    return payload;
}
const wt0Text = readGate("wt0", "wt0-inventory.json", "wt0-validation.json"), wt1Text = readGate("wt1", "wt1-route-catalog.json", "wt1-validation.json"), dataset = (0, wt2_event_entry_1.buildWt2)(JSON.parse(wt0Text), wt0Text, JSON.parse(wt1Text), wt1Text), validation = (0, wt2_event_entry_1.validateWt2)(dataset), payload = `${JSON.stringify(dataset, null, 2)}\n`, validationText = `${JSON.stringify(validation, null, 2)}\n`, out = (0, path_1.resolve)(root, "data/database-world-tournament-captures/wt2"), member = (fileName, text) => ({ fileName, sizeBytes: Buffer.byteLength(text), sha256: hash(text) });
(0, fs_1.mkdirSync)(out, { recursive: true });
const payloadPath = (0, path_1.resolve)(out, "wt2-event-entry-ranks.json"), validationPath = (0, path_1.resolve)(out, "wt2-validation.json");
(0, fs_1.writeFileSync)(payloadPath, payload);
(0, fs_1.writeFileSync)(validationPath, validationText);
if (hash((0, fs_1.readFileSync)(payloadPath)) !== hash(payload) || hash((0, fs_1.readFileSync)(validationPath)) !== hash(validationText))
    throw new Error("WT2 post-write mismatch");
(0, fs_1.writeFileSync)((0, path_1.resolve)(out, "wt2-manifest.json"), `${JSON.stringify({ schemaVersion: 1, contractVersion: dataset.contractVersion, members: [member("wt2-event-entry-ranks.json", payload), member("wt2-validation.json", validationText)] }, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(validation)}\n`);
//# sourceMappingURL=wt2-run.js.map