import { createHash } from "crypto";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { getHeapStatistics } from "v8";
import { Wt2Dataset } from "./wt2-contract";
import { validateWt2 } from "./wt2-event-entry";
import { Wt3Dataset } from "./wt3-contract";
import { validateWt3 } from "./wt3-rankings";
import { Wt4Dataset } from "./wt4-contract";
import { validateWt4 } from "./wt4-briefing-start";
import { Wt5SourceLock, Wt5StructuralCoordinates } from "./wt5-contract";
import { buildWt5, validateWt5 } from "./wt5-shadow-parity";
import { loadWt5Sources } from "./wt5-sources";

interface Manifest { members: Array<{ fileName: string; sizeBytes: number; sha256: string }> }
const hash = (value: string | Buffer): string => createHash("sha256").update(value).digest("hex"), root = resolve(process.cwd());
if (getHeapStatistics().heap_size_limit >= 1024 * 1024 * 1024) throw new Error("WT5 heap boundary");
function gate(gate: "wt2" | "wt3" | "wt4", payloadName: string): { text: string; value: any } {
    const base = resolve(root, `data/database-world-tournament-captures/${gate}`), validationName = `${gate}-validation.json`, text = readFileSync(resolve(base, payloadName), "utf8"), validationText = readFileSync(resolve(base, validationName), "utf8"), manifest = JSON.parse(readFileSync(resolve(base, `${gate}-manifest.json`), "utf8")) as Manifest;
    for (const [fileName, content] of [[payloadName, text], [validationName, validationText]]) { const member = manifest.members?.find(value => value.fileName === fileName); if (!member || member.sizeBytes !== Buffer.byteLength(content) || member.sha256 !== hash(content)) throw new Error(`WT5 ${gate} manifest mismatch`); }
    if (JSON.parse(validationText).valid !== true) throw new Error(`WT5 ${gate} upstream not green`);
    return { text, value: JSON.parse(text) };
}
const wt2File = gate("wt2", "wt2-event-entry-ranks.json"), wt3File = gate("wt3", "wt3-rankings-box-schedules.json"), wt4File = gate("wt4", "wt4-briefing-missions-start.json"), wt2 = wt2File.value as Wt2Dataset, wt3 = wt3File.value as Wt3Dataset, wt4 = wt4File.value as Wt4Dataset;
if (!validateWt2(wt2).valid || !validateWt3(wt3).valid || !validateWt4(wt4).valid) throw new Error("WT5 upstream contract failed revalidation");
const coordinates: Wt5StructuralCoordinates = { eventId: wt2.budokai.identity.id, missionIds: wt4.missionRelations.map(value => value.missionId), boxRankingIds: wt3.boxRanking.boxRankingIds, mapIds: wt2.budokai.maps.ids };
const lockText = readFileSync(resolve(root, "database-world-tournament-captures/wt5-source-lock.json"), "utf8"), lock = JSON.parse(lockText) as Wt5SourceLock, sources = loadWt5Sources({ main: "D:\\Dokkan\\DokkanWebScraper", capture: "D:\\Dokkan\\DokkanWebScraper-server-captures", database: "D:\\Dokkan\\database\\decrypted" }, lock, coordinates), dataset = buildWt5(wt2, wt2File.text, wt3, wt3File.text, wt4, wt4File.text, lockText, sources), validation = validateWt5(dataset), payloadText = `${JSON.stringify(dataset, null, 2)}\n`, validationText = `${JSON.stringify(validation, null, 2)}\n`, out = resolve(root, "data/database-world-tournament-captures/wt5"), member = (fileName: string, text: string) => ({ fileName, sizeBytes: Buffer.byteLength(text), sha256: hash(text) });
mkdirSync(out, { recursive: true }); const payloadPath = resolve(out, "wt5-shadow-parity.json"), validationPath = resolve(out, "wt5-validation.json"); writeFileSync(payloadPath, payloadText); writeFileSync(validationPath, validationText); if (hash(readFileSync(payloadPath)) !== hash(payloadText) || hash(readFileSync(validationPath)) !== hash(validationText)) throw new Error("WT5 post-write mismatch"); writeFileSync(resolve(out, "wt5-manifest.json"), `${JSON.stringify({ schemaVersion: 1, contractVersion: dataset.contractVersion, members: [member("wt5-shadow-parity.json", payloadText), member("wt5-validation.json", validationText)] }, null, 2)}\n`); process.stdout.write(`${JSON.stringify(validation)}\n`);
