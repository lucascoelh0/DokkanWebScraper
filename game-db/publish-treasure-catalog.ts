import { createHash } from "crypto";
import { execFileSync } from "child_process";
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync } from "fs";
import { resolve, join } from "path";
import { gunzipSync } from "zlib";

const PREFIX = "staging/v2/treasure-catalog";
const ORIGIN = "https://assets.dkbcompanion.com";
const digest = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
async function readRemote(url: string): Promise<Buffer> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw Error(`Remote verification HTTP ${response.status}`);
        return Buffer.from(await response.arrayBuffer());
    } finally { clearTimeout(timeout); }
}

export function planTreasurePublication(manifestBytes: Buffer, payload: Buffer) {
    if (manifestBytes.length > 65536 || payload.length > 2 * 1024 * 1024) throw Error("Oversized artifact");
    const manifest = JSON.parse(manifestBytes.toString("utf8"));
    if (manifest.sha256 !== digest(payload) || manifest.sizeBytes !== payload.length) throw Error("Payload integrity mismatch");
    const expanded = gunzipSync(payload, { maxOutputLength: 8 * 1024 * 1024 });
    const root = JSON.parse(expanded.toString("utf8"));
    if (manifest.expandedSizeBytes !== expanded.length) throw Error("Expanded size mismatch");
    for (const item of [manifest, root]) {
        if (item.schemaVersion !== 1 || item.contract !== "dokkan-treasure-catalog" ||
            !["1.0.0", "1.1.0", "1.2.0"].includes(item.contractVersion) ||
            !/^[0-9]+$/.test(item.sourceSnapshotVersion) || !/^[a-f0-9]{64}$/.test(item.sourceDatabaseSha256)) {
            throw Error("Unsupported treasure contract");
        }
    }
    for (const field of ["datasetVersion", "sourceSnapshotVersion", "sourceDatabaseSha256", "contractVersion"]) {
        if (manifest[field] !== root[field]) throw Error("Provenance mismatch");
    }
    const fileName = `catalog-${manifest.sha256}.payload`;
    const publishedManifest = Buffer.from(JSON.stringify({ ...manifest, fileName }, null, 2) + "\n");
    return { manifest: publishedManifest, payloadKey: `${PREFIX}/${fileName}`,
        manifestKey: `${PREFIX}/manifest.json`, uploadBytes: publishedManifest.length + payload.length };
}

async function main() {
    const args = process.argv.slice(2);
    if (args.length !== 2 || !["--dry-run", "--publish"].includes(args[1])) {
        throw Error("Usage: <candidate-directory> --dry-run|--publish (staging only)");
    }
    const directory = resolve(args[0]);
    const payload = readFileSync(join(directory, "catalog.payload"));
    const plan = planTreasurePublication(readFileSync(join(directory, "manifest.json")), payload);
    console.log(JSON.stringify({ bucket: "dokkanpanion-data", payloadKey: plan.payloadKey,
        manifestKey: plan.manifestKey, uploadBytes: plan.uploadBytes, dryRun: args[1] === "--dry-run" }));
    if (args[1] === "--dry-run") return;
    // A staging-only publisher: no configurable prefix, bucket or deletion operation.
    mkdirSync(".agent-logs", { recursive: true });
    const temporary = mkdtempSync(resolve(".agent-logs/treasure-publication-"));
    const manifestPath = join(temporary, "manifest.json");
    writeFileSync(manifestPath, plan.manifest);
    const wrangler = resolve("node_modules/wrangler/bin/wrangler.js");
    function upload(key: string, path: string, type: string, cache: string) {
        execFileSync(process.execPath, [wrangler, "r2", "object", "put", `dokkanpanion-data/${key}`,
            "--file", path, "--remote", "--content-type", type, "--cache-control", cache], { stdio: "inherit" });
    }
    upload(plan.payloadKey, join(directory, "catalog.payload"), "application/octet-stream", "public, max-age=31536000, immutable");
    if (digest(await readRemote(`${ORIGIN}/${plan.payloadKey}`)) !== digest(payload)) throw Error("Remote payload verification failed; manifest not published");
    upload(plan.manifestKey, manifestPath, "application/json", "no-cache, max-age=0, must-revalidate");
    if (digest(await readRemote(`${ORIGIN}/${plan.manifestKey}?verify=${Date.now()}`)) !== digest(plan.manifest)) throw Error("Remote manifest verification failed");
    console.log("Staging treasure catalog published and verified.");
}
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
