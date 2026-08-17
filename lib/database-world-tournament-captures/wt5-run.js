"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const path_1 = require("path");
const v8_1 = require("v8");
const wt2_event_entry_1 = require("./wt2-event-entry");
const wt3_rankings_1 = require("./wt3-rankings");
const wt4_briefing_start_1 = require("./wt4-briefing-start");
const wt5_shadow_parity_1 = require("./wt5-shadow-parity");
const wt5_sources_1 = require("./wt5-sources");
const hash = (value) => (0, crypto_1.createHash)("sha256").update(value).digest("hex"), root = (0, path_1.resolve)(process.cwd());
if ((0, v8_1.getHeapStatistics)().heap_size_limit >= 1024 * 1024 * 1024)
    throw new Error("WT5 heap boundary");
function gate(gate, payloadName) {
    const base = (0, path_1.resolve)(root, `data/database-world-tournament-captures/${gate}`), validationName = `${gate}-validation.json`, text = (0, fs_1.readFileSync)((0, path_1.resolve)(base, payloadName), "utf8"), validationText = (0, fs_1.readFileSync)((0, path_1.resolve)(base, validationName), "utf8"), manifest = JSON.parse((0, fs_1.readFileSync)((0, path_1.resolve)(base, `${gate}-manifest.json`), "utf8"));
    for (const [fileName, content] of [[payloadName, text], [validationName, validationText]]) {
        const member = manifest.members?.find(value => value.fileName === fileName);
        if (!member || member.sizeBytes !== Buffer.byteLength(content) || member.sha256 !== hash(content))
            throw new Error(`WT5 ${gate} manifest mismatch`);
    }
    if (JSON.parse(validationText).valid !== true)
        throw new Error(`WT5 ${gate} upstream not green`);
    return { text, value: JSON.parse(text) };
}
const wt2File = gate("wt2", "wt2-event-entry-ranks.json"), wt3File = gate("wt3", "wt3-rankings-box-schedules.json"), wt4File = gate("wt4", "wt4-briefing-missions-start.json"), wt2 = wt2File.value, wt3 = wt3File.value, wt4 = wt4File.value;
if (!(0, wt2_event_entry_1.validateWt2)(wt2).valid || !(0, wt3_rankings_1.validateWt3)(wt3).valid || !(0, wt4_briefing_start_1.validateWt4)(wt4).valid)
    throw new Error("WT5 upstream contract failed revalidation");
const coordinates = { eventId: wt2.budokai.identity.id, missionIds: wt4.missionRelations.map(value => value.missionId), boxRankingIds: wt3.boxRanking.boxRankingIds, mapIds: wt2.budokai.maps.ids };
const lockText = (0, fs_1.readFileSync)((0, path_1.resolve)(root, "database-world-tournament-captures/wt5-source-lock.json"), "utf8"), lock = JSON.parse(lockText), sources = (0, wt5_sources_1.loadWt5Sources)({ main: "D:\\Dokkan\\DokkanWebScraper", capture: "D:\\Dokkan\\DokkanWebScraper-server-captures", database: "D:\\Dokkan\\database\\decrypted" }, lock, coordinates), dataset = (0, wt5_shadow_parity_1.buildWt5)(wt2, wt2File.text, wt3, wt3File.text, wt4, wt4File.text, lockText, sources), validation = (0, wt5_shadow_parity_1.validateWt5)(dataset), payloadText = `${JSON.stringify(dataset, null, 2)}\n`, validationText = `${JSON.stringify(validation, null, 2)}\n`, out = (0, path_1.resolve)(root, "data/database-world-tournament-captures/wt5"), member = (fileName, text) => ({ fileName, sizeBytes: Buffer.byteLength(text), sha256: hash(text) });
(0, fs_1.mkdirSync)(out, { recursive: true });
const payloadPath = (0, path_1.resolve)(out, "wt5-shadow-parity.json"), validationPath = (0, path_1.resolve)(out, "wt5-validation.json");
(0, fs_1.writeFileSync)(payloadPath, payloadText);
(0, fs_1.writeFileSync)(validationPath, validationText);
if (hash((0, fs_1.readFileSync)(payloadPath)) !== hash(payloadText) || hash((0, fs_1.readFileSync)(validationPath)) !== hash(validationText))
    throw new Error("WT5 post-write mismatch");
(0, fs_1.writeFileSync)((0, path_1.resolve)(out, "wt5-manifest.json"), `${JSON.stringify({ schemaVersion: 1, contractVersion: dataset.contractVersion, members: [member("wt5-shadow-parity.json", payloadText), member("wt5-validation.json", validationText)] }, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(validation)}\n`);
//# sourceMappingURL=wt5-run.js.map