import { createHash } from "crypto";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { getHeapStatistics } from "v8";
import { Wt0Dataset } from "./wt0-contract";
import { Wt1Dataset } from "./wt1-contract";
import { buildWt2, validateWt2 } from "./wt2-event-entry";

interface Manifest { members: Array<{ fileName: string; sizeBytes: number; sha256: string }> }
const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex"), root = resolve(process.cwd());
if (getHeapStatistics().heap_size_limit >= 1024 * 1024 * 1024) throw new Error("WT2 requires a Node heap below 1 GiB");
function readGate(gate: "wt0" | "wt1", payloadName: string, validationName: string): string {
    const base = resolve(root, `data/database-world-tournament-captures/${gate}`), payload = readFileSync(resolve(base, payloadName), "utf8"), validation = readFileSync(resolve(base, validationName), "utf8"), manifest = JSON.parse(readFileSync(resolve(base, `${gate}-manifest.json`), "utf8")) as Manifest;
    for (const [fileName, text] of [[payloadName, payload], [validationName, validation]]) { const member = manifest.members?.find(value => value.fileName === fileName); if (!member || member.sizeBytes !== Buffer.byteLength(text) || member.sha256 !== hash(text)) throw new Error(`WT2 ${gate} manifest mismatch`); }
    if (JSON.parse(validation)?.valid !== true) throw new Error(`WT2 ${gate} validation not green`); return payload;
}
const wt0Text = readGate("wt0", "wt0-inventory.json", "wt0-validation.json"), wt1Text = readGate("wt1", "wt1-route-catalog.json", "wt1-validation.json"), dataset = buildWt2(JSON.parse(wt0Text) as Wt0Dataset, wt0Text, JSON.parse(wt1Text) as Wt1Dataset, wt1Text), validation = validateWt2(dataset), payload = `${JSON.stringify(dataset, null, 2)}\n`, validationText = `${JSON.stringify(validation, null, 2)}\n`, out = resolve(root, "data/database-world-tournament-captures/wt2"), member = (fileName: string, text: string) => ({ fileName, sizeBytes: Buffer.byteLength(text), sha256: hash(text) });
mkdirSync(out, { recursive: true }); const payloadPath = resolve(out, "wt2-event-entry-ranks.json"), validationPath = resolve(out, "wt2-validation.json"); writeFileSync(payloadPath, payload); writeFileSync(validationPath, validationText); if (hash(readFileSync(payloadPath)) !== hash(payload) || hash(readFileSync(validationPath)) !== hash(validationText)) throw new Error("WT2 post-write mismatch"); writeFileSync(resolve(out, "wt2-manifest.json"), `${JSON.stringify({ schemaVersion: 1, contractVersion: dataset.contractVersion, members: [member("wt2-event-entry-ranks.json", payload), member("wt2-validation.json", validationText)] }, null, 2)}\n`); process.stdout.write(`${JSON.stringify(validation)}\n`);
