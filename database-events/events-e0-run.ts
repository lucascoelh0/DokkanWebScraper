import { spawn } from "child_process";
import { createHash } from "crypto";
import { createReadStream } from "fs";
import { mkdir, readFile, stat, writeFile } from "fs/promises";
import { basename, resolve } from "path";
import { buildEventsE0Coverage, buildEventsE0Dataset } from "./events-e0-builder";
import { EventsE0Baseline, EventsE0Manifest, EventsE0Observation } from "./events-e0-contract";
import { validateEventsE0Dataset } from "./events-e0-validator";

const DEFAULT_DATABASE = "D:/Dokkan/database/decrypted/dokkan-global-current.db";
const DEFAULT_OUTPUT = resolve(process.cwd(), "data", "database-events");
const MEMORY_LIMIT = 1024 * 1024 * 1024;

let peakWorkingSetBytes = 0;
function observeMemory(): void {
    peakWorkingSetBytes = Math.max(peakWorkingSetBytes, process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024);
    if (peakWorkingSetBytes > MEMORY_LIMIT) throw new Error(`E0 memory limit exceeded: ${peakWorkingSetBytes}`);
}

async function fingerprint(path: string): Promise<{ sha256: string; sizeBytes: number; modifiedAtMs: number }> {
    const metadata = await stat(path), hash = createHash("sha256");
    await new Promise<void>((done, reject) => {
        const stream = createReadStream(path);
        stream.on("data", chunk => { hash.update(chunk); observeMemory(); });
        stream.on("error", reject);
        stream.on("end", done);
    });
    return { sha256: hash.digest("hex"), sizeBytes: metadata.size, modifiedAtMs: metadata.mtimeMs };
}

async function observeDatabase(databasePath: string): Promise<EventsE0Observation> {
    const bridge = resolve(__dirname, "events-sqlite-readonly-bridge.py");
    const sourceBridge = resolve(__dirname, "..", "..", "database-events", "events-sqlite-readonly-bridge.py");
    const bridgePath = require("fs").existsSync(bridge) ? bridge : sourceBridge;
    return new Promise((done, reject) => {
        const child = spawn(process.platform === "win32" ? "python" : "python3", [bridgePath, "inventory", "--database", databasePath], { shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
        const stdout: Buffer[] = [], stderr: Buffer[] = [];
        child.stdout.on("data", chunk => { stdout.push(Buffer.from(chunk)); observeMemory(); });
        child.stderr.on("data", chunk => stderr.push(Buffer.from(chunk)));
        child.on("error", reject);
        child.on("close", code => code === 0 ? done(JSON.parse(Buffer.concat(stdout).toString("utf8")) as EventsE0Observation) : reject(new Error(`E0 bridge failed (${code}): ${Buffer.concat(stderr).toString("utf8")}`)));
    });
}

export async function runEventsE0(options: { databasePath?: string; outputDir?: string; baselinePath?: string } = {}) {
    peakWorkingSetBytes = 0;
    const databasePath = resolve(options.databasePath ?? DEFAULT_DATABASE), outputDir = resolve(options.outputDir ?? DEFAULT_OUTPUT);
    const baselinePath = options.baselinePath ?? resolve(__dirname, "events-e0-baseline.json");
    const sourceBaselinePath = resolve(__dirname, "..", "..", "database-events", "events-e0-baseline.json");
    const baseline = JSON.parse(await readFile(require("fs").existsSync(baselinePath) ? baselinePath : sourceBaselinePath, "utf8")) as EventsE0Baseline;
    const before = await fingerprint(databasePath), observation = await observeDatabase(databasePath); observeMemory();
    const dataset = buildEventsE0Dataset({ observation, generatedAt: baseline.generatedAt, sourceSnapshotVersion: baseline.snapshotVersion, sourceDatabase: { fileName: basename(databasePath), sha256: before.sha256, sizeBytes: before.sizeBytes } });
    const coverage = buildEventsE0Coverage(dataset), validation = validateEventsE0Dataset(dataset, observation, baseline);
    if (!validation.valid) throw new Error(`E0 validation failed: ${JSON.stringify(validation.failures)}`);
    const after = await fingerprint(databasePath);
    if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error("E0 read-only source guarantee");
    const inventoryText = `${JSON.stringify(dataset, null, 2)}\n`, coverageText = `${JSON.stringify(coverage, null, 2)}\n`, validationText = `${JSON.stringify(validation, null, 2)}\n`;
    const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
    const manifest: EventsE0Manifest = {
        schemaVersion: 1,
        contractVersion: "0.1.0",
        generatedAt: dataset.generatedAt,
        generatedAtPolicy: dataset.generatedAtPolicy,
        fileName: "events-e0-inventory.json",
        compression: "none",
        sha256: sha256(inventoryText),
        sizeBytes: Buffer.byteLength(inventoryText),
        tableCount: dataset.tables.length,
        sourceSnapshotVersion: dataset.sourceSnapshotVersion,
        sourceDatabaseSha256: dataset.sourceDatabase.sha256,
        coverage: { fileName: "events-e0-coverage.json", sha256: sha256(coverageText), sizeBytes: Buffer.byteLength(coverageText) },
        validation: { fileName: "events-e0-validation.json", sha256: sha256(validationText), sizeBytes: Buffer.byteLength(validationText) },
    };
    await mkdir(outputDir, { recursive: true });
    await Promise.all([
        writeFile(resolve(outputDir, manifest.fileName), inventoryText),
        writeFile(resolve(outputDir, manifest.coverage.fileName), coverageText),
        writeFile(resolve(outputDir, manifest.validation.fileName), validationText),
        writeFile(resolve(outputDir, "events-e0-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`),
    ]);
    observeMemory();
    return { dataset, coverage, validation, manifest, peakWorkingSetBytes };
}

if (require.main === module) runEventsE0().then(value => console.log(JSON.stringify({ coverage: value.coverage, validation: value.validation, peakWorkingSetBytes: value.peakWorkingSetBytes }, null, 2))).catch(error => { console.error(error); process.exitCode = 1; });
