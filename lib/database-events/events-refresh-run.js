"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runEventsRefresh = void 0;
const child_process_1 = require("child_process");
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const DEFAULT_DATABASE = "D:/Dokkan/database/decrypted/dokkan-global-current.db", DEFAULT_ELF = "D:/Dokkan/database/apk/extracted/lib/arm64-v8a/libcocos2dcpp.so", DEFAULT_APK = "D:/Dokkan/database/apk/dokkan-global-base.apk", DEFAULT_OUTPUT = (0, path_1.resolve)(process.cwd(), "data", "database-events-refresh"), MEMORY_LIMIT = 1024 * 1024 * 1024;
let peakWorkingSetBytes = 0;
function memory() { peakWorkingSetBytes = Math.max(peakWorkingSetBytes, process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024); if (peakWorkingSetBytes > MEMORY_LIMIT)
    throw Error(`Refresh runner memory limit exceeded ${peakWorkingSetBytes}`); }
const sha = (value) => (0, crypto_1.createHash)("sha256").update(value).digest("hex");
async function fingerprint(path) { const metadata = await (0, promises_1.stat)(path), hash = (0, crypto_1.createHash)("sha256"); await new Promise((done, reject) => { const stream = (0, fs_1.createReadStream)(path); stream.on("data", chunk => { hash.update(chunk); memory(); }); stream.on("error", reject); stream.on("end", done); }); return { sha256: hash.digest("hex"), sizeBytes: metadata.size, modifiedAtMs: metadata.mtimeMs }; }
function sourcePath(name) { const adjacent = (0, path_1.resolve)(__dirname, name); return (0, fs_1.existsSync)(adjacent) ? adjacent : (0, path_1.resolve)(__dirname, "..", "..", "database-events", name); }
function stepPath() { const adjacent = (0, path_1.resolve)(__dirname, "events-refresh-step.ts"); return (0, fs_1.existsSync)(adjacent) ? adjacent : (0, path_1.resolve)(__dirname, "..", "..", "database-events", "events-refresh-step.ts"); }
async function runStep(gate, options) {
    const args = ["-r", "ts-node/register", stepPath(), "--gate", String(gate), "--database", options.databasePath, "--elf", options.elfPath, "--apk", options.apkPath, "--output", options.outputDir, "--profile", options.profilePath];
    return new Promise((done, reject) => {
        const child = (0, child_process_1.spawn)(process.execPath, args, { shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }), stdout = [], stderr = [];
        child.stdout.on("data", chunk => { stdout.push(Buffer.from(chunk)); memory(); });
        child.stderr.on("data", chunk => stderr.push(Buffer.from(chunk)));
        child.on("error", reject);
        child.on("close", code => code === 0 ? done(JSON.parse(Buffer.concat(stdout).toString("utf8"))) : reject(Error(`Refresh E${gate} failed (${code}): ${Buffer.concat(stderr).toString("utf8")}`)));
    });
}
async function runEventsRefresh(options = {}) {
    peakWorkingSetBytes = 0;
    const databasePath = (0, path_1.resolve)(options.databasePath ?? DEFAULT_DATABASE), elfPath = (0, path_1.resolve)(options.elfPath ?? DEFAULT_ELF), apkPath = (0, path_1.resolve)(options.apkPath ?? DEFAULT_APK), outputDir = (0, path_1.resolve)(options.outputDir ?? DEFAULT_OUTPUT), profilePath = (0, path_1.resolve)(options.refreshProfilePath ?? sourcePath("events-e8-refresh-profile.json")), profileBytes = await (0, promises_1.readFile)(profilePath), profile = JSON.parse(profileBytes.toString("utf8")), profileDirectory = (0, path_1.dirname)(profilePath);
    const roles = new Set(profile.baselineFiles.map(value => value.role));
    if (profile.schemaVersion !== 1 || profile.contract !== "dokkan-events-database-first-refresh-profile" || profile.contractVersion !== "0.9.0" || profile.baselineFiles.length !== 4 || roles.size !== 4 || !["e0_inventory", "e3_goldens", "e4_native_evidence", "e6_apk"].every(value => roles.has(value)))
        throw Error("Refresh profile contract");
    for (const baseline of profile.baselineFiles) {
        const bytes = await (0, promises_1.readFile)((0, path_1.resolve)(profileDirectory, baseline.fileName));
        if (sha(bytes) !== baseline.sha256)
            throw Error(`Refresh baseline identity ${baseline.role}`);
    }
    const [databaseBefore, elfBefore, apkBefore] = await Promise.all([fingerprint(databasePath), fingerprint(elfPath), fingerprint(apkPath)]);
    memory();
    if (databaseBefore.sha256 !== profile.requiredSources.database.sha256 || databaseBefore.sizeBytes !== profile.requiredSources.database.sizeBytes || elfBefore.sha256 !== profile.requiredSources.elf.sha256 || elfBefore.sizeBytes !== profile.requiredSources.elf.sizeBytes || apkBefore.sha256 !== profile.requiredSources.apk.sha256 || apkBefore.sizeBytes !== profile.requiredSources.apk.sizeBytes)
        throw Error("Refresh incompatible external source identity");
    await (0, promises_1.mkdir)(outputDir, { recursive: true });
    const steps = [];
    for (const gate of [0, 1, 2, 3, 4, 5, 6, 8])
        steps.push(await runStep(gate, { databasePath, elfPath, apkPath, outputDir, profilePath }));
    const [databaseAfter, elfAfter, apkAfter] = await Promise.all([fingerprint(databasePath), fingerprint(elfPath), fingerprint(apkPath)]);
    memory();
    if (JSON.stringify(databaseBefore) !== JSON.stringify(databaseAfter) || JSON.stringify(elfBefore) !== JSON.stringify(elfAfter) || JSON.stringify(apkBefore) !== JSON.stringify(apkAfter))
        throw Error("Refresh read-only source guarantee");
    return { profileId: profile.profileId, refreshProfileSha256: sha(profileBytes), outputDir, steps, peakWorkingSetBytes: Math.max(peakWorkingSetBytes, ...steps.map(value => value.peakWorkingSetBytes)) };
}
exports.runEventsRefresh = runEventsRefresh;
if (require.main === module)
    runEventsRefresh().then(value => console.log(JSON.stringify(value, null, 2))).catch(error => { console.error(error); process.exitCode = 1; });
//# sourceMappingURL=events-refresh-run.js.map