import { execFileSync } from "child_process";
import { createHash, randomUUID } from "crypto";
import { lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync } from "fs";
import { relative, resolve } from "path";
import { getHeapStatistics } from "v8";
import { assertExternalHarPath, scanWtCampaignTexts } from "./wt0-audit";
import { Wt0Dataset } from "./wt0-contract";
import { Wt6Dataset, Wt6MemoryEvidence } from "./wt6-contract";
import { buildWt6, validateWt6 } from "./wt6-readiness";

const sha256 = (value: string | Buffer): string => createHash("sha256").update(value).digest("hex"), root = realpathSync(process.cwd());
if (getHeapStatistics().heap_size_limit >= 1024 * 1024 * 1024) throw new Error("WT6 heap boundary");
function arg(name: string): string { const index = process.argv.indexOf(name); if (index < 0 || !process.argv[index + 1]) throw new Error(`WT6 requires ${name}`); return process.argv[index + 1]; }
const sourceArgument = resolve(arg("--source")); if (lstatSync(sourceArgument).isSymbolicLink()) throw new Error("WT6 source boundary"); const sourcePath = realpathSync(sourceArgument); assertExternalHarPath(root, sourcePath);
const expected = new Map<number, string[]>([[0,["wt0-inventory.json","wt0-manifest.json","wt0-validation.json"]],[1,["wt1-manifest.json","wt1-route-catalog.json","wt1-validation.json"]],[2,["wt2-event-entry-ranks.json","wt2-manifest.json","wt2-validation.json"]],[3,["wt3-manifest.json","wt3-rankings-box-schedules.json","wt3-validation.json"]],[4,["wt4-briefing-missions-start.json","wt4-manifest.json","wt4-validation.json"]],[5,["wt5-manifest.json","wt5-shadow-parity.json","wt5-validation.json"]]]);
function runGate(gate: number): void {
    const args = ["--max-old-space-size=576", resolve(root, `lib/database-world-tournament-captures/wt${gate}-run.js`)];
    if (gate === 0) { const lockDirectory = resolve(root, ".agent-logs/world-tournament"); mkdirSync(lockDirectory, { recursive: true }); args.push("--source", sourcePath, "--external-lock", resolve(lockDirectory, `wt6-double-${randomUUID()}.json`)); }
    execFileSync(process.execPath, args, { cwd: root, encoding: "utf8", maxBuffer: 2 * 1024 * 1024, timeout: 30000, windowsHide: true });
}
function artifacts(): Array<{ gate: "WT0" | "WT1" | "WT2" | "WT3" | "WT4" | "WT5"; fileName: string; sizeBytes: number; sha256: string }> {
    const rows: ReturnType<typeof artifacts> = [];
    for (let gate = 0; gate <= 5; gate++) {
        const directory = resolve(root, `data/database-world-tournament-captures/wt${gate}`), names = readdirSync(directory).filter(name => statSync(resolve(directory, name)).isFile()).sort();
        if (JSON.stringify(names) !== JSON.stringify(expected.get(gate))) throw new Error(`WT6 unexpected WT${gate} artifact set`);
        const manifest = JSON.parse(readFileSync(resolve(directory, `wt${gate}-manifest.json`), "utf8")), validation = JSON.parse(readFileSync(resolve(directory, `wt${gate}-validation.json`), "utf8")); if (validation.valid !== true) throw new Error(`WT6 WT${gate} not green`);
        for (const name of names) { const bytes = readFileSync(resolve(directory, name)), member = manifest.members?.find((value: any) => value.fileName === name); if (name !== `wt${gate}-manifest.json` && (!member || member.sizeBytes !== bytes.length || member.sha256 !== sha256(bytes))) throw new Error(`WT6 WT${gate} manifest mismatch`); rows.push({ gate: `WT${gate}` as any, fileName: name, sizeBytes: bytes.length, sha256: sha256(bytes) }); }
    }
    return rows;
}
let first: ReturnType<typeof artifacts> = []; for (let pass = 0; pass < 2; pass++) { for (let gate = 0; gate <= 5; gate++) runGate(gate); const current = artifacts(); if (pass === 0) first = current; else if (JSON.stringify(first) !== JSON.stringify(current)) throw new Error("WT6 double generation mismatch"); }
const lineage = first, aggregateSha256 = sha256(lineage.map(value => `${value.gate}/${value.fileName}\0${value.sizeBytes}\0${value.sha256}\n`).join("")), before = statSync(sourcePath), harText = readFileSync(sourcePath, "utf8"), after = statSync(sourcePath); if (before.size !== after.size || before.mtimeMs !== after.mtimeMs) throw new Error("WT6 source changed during scan");
const wt0 = JSON.parse(readFileSync(resolve(root, "data/database-world-tournament-captures/wt0/wt0-inventory.json"), "utf8")) as Wt0Dataset; if (wt0.source.sha256 !== sha256(harText) || wt0.source.sizeBytes !== Buffer.byteLength(harText)) throw new Error("WT6 source lineage mismatch");
function scanFiles(directory: string, include: (name: string) => boolean): Array<{ name: string; text: string }> { const rows: Array<{ name: string; text: string }> = []; for (const name of readdirSync(directory).sort()) { const path = resolve(directory, name), info = statSync(path); if (info.isDirectory()) rows.push(...scanFiles(path, include)); else if (include(name)) rows.push({ name: relative(root, path).replace(/\\/g, "/"), text: readFileSync(path, "utf8") }); } return rows; }
const exactScanInputs = [
    ...scanFiles(resolve(root, "database-world-tournament-captures/fixtures"), name => name.endsWith(".json") && !name.endsWith(".har.json")),
    ...scanFiles(resolve(root, "data/database-world-tournament-captures"), name => name.endsWith(".json") && !name.startsWith("wt6-")),
], genericScanInputs = [
    ...scanFiles(resolve(root, "database-world-tournament-captures"), name => /\.(?:ts|json|py)$/.test(name) && !name.endsWith(".spec.ts")),
    ...scanFiles(resolve(root, "lib/database-world-tournament-captures"), name => name.endsWith(".js") && !name.endsWith(".spec.js")),
].filter(value => !value.name.includes("/fixtures/"));
if ([...exactScanInputs, ...genericScanInputs].some(value => value.name.toLowerCase().endsWith(".har")) || execFileSync("git", ["ls-files", "*.har"], { cwd: root, encoding: "utf8", timeout: 5000, windowsHide: true }).trim()) throw new Error("WT6 raw HAR tracked");
const exactScan = scanWtCampaignTexts(harText, wt0.structuralIds.map(value => value.id), exactScanInputs), genericScan = scanWtCampaignTexts(harText, wt0.structuralIds.map(value => value.id), genericScanInputs), exactMatches = exactScan.exactCapturedValueMatches + genericScan.exactCapturedValueMatches, genericMatches = exactScan.genericSecretPatternMatches + genericScan.genericSecretPatternMatches, matchedFiles = [...exactScan.exactMatchedFiles, ...genericScan.exactMatchedFiles]; if (exactMatches !== 0 || genericMatches !== 0) throw new Error(`WT6 captured-value scan failed: exact=${exactMatches}, generic=${genericMatches}, files=${exactScan.scannedFileCount + genericScan.scannedFileCount}, matched=${matchedFiles.join(",")}`);
const implementationInputs = [...scanFiles(resolve(root, "lib/database-world-tournament-captures"), name => name.endsWith(".js") && !name.endsWith(".spec.js")), ...scanFiles(resolve(root, "database-world-tournament-captures"), name => name === "wt5-sqlite-readonly-bridge.py")].sort((left, right) => left.name.localeCompare(right.name)), implementationAggregateSha256 = sha256(implementationInputs.map(value => `${value.name}\0${Buffer.byteLength(value.text)}\0${sha256(value.text)}\n`).join(""));
const memory = JSON.parse(readFileSync(resolve(root, "database-world-tournament-captures/wt6-memory-evidence.json"), "utf8")) as Wt6MemoryEvidence; if (memory.sourceSha256 !== wt0.source.sha256 || memory.artifactAggregateSha256 !== aggregateSha256 || memory.implementationAggregateSha256 !== implementationAggregateSha256) throw new Error("WT6 memory evidence lineage mismatch");
const source: Wt6Dataset["source"] = { sourceId: wt0.source.sourceId, sizeBytes: wt0.source.sizeBytes, sha256: wt0.source.sha256, entryCount: wt0.source.entryCount }, security: Wt6Dataset["security"] = { scannedFileCount: exactScan.scannedFileCount + genericScan.scannedFileCount, capturedSensitiveValueCount: exactScan.capturedSensitiveValueCount, exactCapturedValueMatches: 0, genericSecretPatternMatches: 0, valid: true, rawHarTracked: false, requestReplayImplemented: false, credentialFlowImplemented: false }, member = (fileName: string, text: string) => ({ fileName, sizeBytes: Buffer.byteLength(text), sha256: sha256(text) });
function generateWt6(): { validation: ReturnType<typeof validateWt6>; outputs: ReadonlyArray<readonly [string, string]> } {
    const dataset = buildWt6(source, lineage, aggregateSha256, implementationAggregateSha256, security, memory), validation = validateWt6(dataset), payloadText = `${JSON.stringify(dataset, null, 2)}\n`, validationText = `${JSON.stringify(validation, null, 2)}\n`, manifestText = `${JSON.stringify({ schemaVersion: 1, contractVersion: dataset.contractVersion, members: [member("wt6-readiness.json", payloadText), member("wt6-validation.json", validationText)] }, null, 2)}\n`;
    return { validation, outputs: [["wt6-manifest.json",manifestText],["wt6-readiness.json",payloadText],["wt6-validation.json",validationText]] as const };
}
const out = resolve(root, "data/database-world-tournament-captures/wt6"); mkdirSync(out, { recursive: true });
function writeGeneration(outputs: ReadonlyArray<readonly [string, string]>): string[] { for (const [fileName, text] of outputs) writeFileSync(resolve(out, fileName), text); return outputs.map(([fileName, text]) => { const bytes = readFileSync(resolve(out, fileName)); if (bytes.length !== Buffer.byteLength(text) || sha256(bytes) !== sha256(text)) throw new Error("WT6 post-write mismatch"); return `${fileName}\0${bytes.length}\0${sha256(bytes)}`; }); }
const firstGeneration = generateWt6(), firstOutputPass = writeGeneration(firstGeneration.outputs), secondGeneration = generateWt6(), secondOutputPass = writeGeneration(secondGeneration.outputs); if (JSON.stringify(firstGeneration.outputs) !== JSON.stringify(secondGeneration.outputs) || JSON.stringify(firstOutputPass) !== JSON.stringify(secondOutputPass)) throw new Error("WT6 own-output double generation mismatch"); process.stdout.write(`${JSON.stringify(secondGeneration.validation)}\n`);
