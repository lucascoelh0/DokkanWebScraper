import { spawn } from "child_process";
import { createHash } from "crypto";
import { createReadStream, existsSync } from "fs";
import { mkdir, readFile, stat } from "fs/promises";
import { dirname, resolve } from "path";
import { resolveEventsInputFile } from "./events-artifact-path";
import { EventsE8RefreshProfile } from "./events-e8-contract";

const DEFAULT_DATABASE = "D:/Dokkan/database/decrypted/dokkan-global-current.db", DEFAULT_ELF = "D:/Dokkan/database/apk/extracted/lib/arm64-v8a/libcocos2dcpp.so", DEFAULT_APK = "D:/Dokkan/database/apk/dokkan-global-base.apk", DEFAULT_OUTPUT = resolve(process.cwd(), "data", "database-events-refresh"), MEMORY_LIMIT = 1024 * 1024 * 1024;
let peakWorkingSetBytes = 0;
function memory() { peakWorkingSetBytes = Math.max(peakWorkingSetBytes, process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024); if (peakWorkingSetBytes > MEMORY_LIMIT) throw Error(`Refresh runner memory limit exceeded ${peakWorkingSetBytes}`); }
const sha = (value: Buffer | string) => createHash("sha256").update(value).digest("hex");
const baselineNames: Record<EventsE8RefreshProfile["baselineFiles"][number]["role"], string> = { e0_inventory: "events-e0-baseline.json", e3_goldens: "events-e3-baseline.json", e4_native_evidence: "events-e4-native-enemy-efficacy-map.json", e6_apk: "events-e6-apk-baseline.json" };
async function fingerprint(path: string) { const metadata = await stat(path), hash = createHash("sha256"); await new Promise<void>((done, reject) => { const stream = createReadStream(path); stream.on("data", chunk => { hash.update(chunk); memory(); }); stream.on("error", reject); stream.on("end", done); }); return { sha256: hash.digest("hex"), sizeBytes: metadata.size, modifiedAtMs: metadata.mtimeMs }; }
function sourcePath(name: string) { const adjacent = resolve(__dirname, name); return existsSync(adjacent) ? adjacent : resolve(__dirname, "..", "..", "database-events", name); }
function stepPath() { const adjacent = resolve(__dirname, "events-refresh-step.ts"); return existsSync(adjacent) ? adjacent : resolve(__dirname, "..", "..", "database-events", "events-refresh-step.ts"); }

async function runStep(gate: number, options: { databasePath: string; elfPath: string; apkPath: string; outputDir: string; profilePath: string }) {
    const args = ["-r", "ts-node/register", stepPath(), "--gate", String(gate), "--database", options.databasePath, "--elf", options.elfPath, "--apk", options.apkPath, "--output", options.outputDir, "--profile", options.profilePath];
    return new Promise<{ gate: string; peakWorkingSetBytes: number; manifestSha256: string }>((done, reject) => {
        const child = spawn(process.execPath, args, { shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }), stdout: Buffer[] = [], stderr: Buffer[] = [];
        child.stdout.on("data", chunk => { stdout.push(Buffer.from(chunk)); memory(); }); child.stderr.on("data", chunk => stderr.push(Buffer.from(chunk))); child.on("error", reject); child.on("close", code => code === 0 ? done(JSON.parse(Buffer.concat(stdout).toString("utf8"))) : reject(Error(`Refresh E${gate} failed (${code}): ${Buffer.concat(stderr).toString("utf8")}`)));
    });
}

export async function runEventsRefresh(options: { databasePath?: string; elfPath?: string; apkPath?: string; outputDir?: string; refreshProfilePath?: string } = {}) {
    peakWorkingSetBytes = 0;
    const databasePath = resolve(options.databasePath ?? DEFAULT_DATABASE), elfPath = resolve(options.elfPath ?? DEFAULT_ELF), apkPath = resolve(options.apkPath ?? DEFAULT_APK), outputDir = resolve(options.outputDir ?? DEFAULT_OUTPUT), profilePath = resolve(options.refreshProfilePath ?? sourcePath("events-e8-refresh-profile.json")), profileBytes = await readFile(profilePath), profile = JSON.parse(profileBytes.toString("utf8")) as EventsE8RefreshProfile, profileDirectory = dirname(profilePath);
    const roles = new Set(profile.baselineFiles.map(value => value.role));
    if (profile.schemaVersion !== 1 || profile.contract !== "dokkan-events-database-first-refresh-profile" || profile.contractVersion !== "0.9.0" || profile.baselineFiles.length !== 4 || roles.size !== 4 || !["e0_inventory", "e3_goldens", "e4_native_evidence", "e6_apk"].every(value => roles.has(value as any))) throw Error("Refresh profile contract");
    for (const baseline of profile.baselineFiles) { const baselinePath = await resolveEventsInputFile(profileDirectory, baseline.fileName, baselineNames[baseline.role]), bytes = await readFile(baselinePath); if (sha(bytes) !== baseline.sha256) throw Error(`Refresh baseline identity ${baseline.role}`); }
    const [databaseBefore, elfBefore, apkBefore] = await Promise.all([fingerprint(databasePath), fingerprint(elfPath), fingerprint(apkPath)]); memory();
    if (databaseBefore.sha256 !== profile.requiredSources.database.sha256 || databaseBefore.sizeBytes !== profile.requiredSources.database.sizeBytes || elfBefore.sha256 !== profile.requiredSources.elf.sha256 || elfBefore.sizeBytes !== profile.requiredSources.elf.sizeBytes || apkBefore.sha256 !== profile.requiredSources.apk.sha256 || apkBefore.sizeBytes !== profile.requiredSources.apk.sizeBytes) throw Error("Refresh incompatible external source identity");
    await mkdir(outputDir, { recursive: true });
    const steps = []; for (const gate of [0, 1, 2, 3, 4, 5, 6, 8]) steps.push(await runStep(gate, { databasePath, elfPath, apkPath, outputDir, profilePath }));
    const [databaseAfter, elfAfter, apkAfter] = await Promise.all([fingerprint(databasePath), fingerprint(elfPath), fingerprint(apkPath)]); memory();
    if (JSON.stringify(databaseBefore) !== JSON.stringify(databaseAfter) || JSON.stringify(elfBefore) !== JSON.stringify(elfAfter) || JSON.stringify(apkBefore) !== JSON.stringify(apkAfter)) throw Error("Refresh read-only source guarantee");
    return { profileId: profile.profileId, refreshProfileSha256: sha(profileBytes), outputDir, steps, peakWorkingSetBytes: Math.max(peakWorkingSetBytes, ...steps.map(value => value.peakWorkingSetBytes)) };
}

if (require.main === module) runEventsRefresh().then(value => console.log(JSON.stringify(value, null, 2))).catch(error => { console.error(error); process.exitCode = 1; });
