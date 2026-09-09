import { createHash } from "crypto";
import { lstat, mkdir, readFile, realpath, stat, writeFile } from "fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "path";
import { gunzipSync } from "zlib";
import { parseGameDbTableCsvText } from "./game-db-source";
import { buildSaTrainingIndex } from "./game-db-sa-training";
import { validateStageDeliveryRoutes } from "./game-db-stage-delivery";
import { validateAwakeningMedalCatalog } from "./game-db-awakening-medal-catalog";

export const SA_TRAINING_CANDIDATE_ROOT = resolve("game-db/data/sa-training");
const INPUT_MANIFEST_LIMIT = 2 * 1024 * 1024;
const INPUT_COMPRESSED_LIMIT = 32 * 1024 * 1024;
const INPUT_EXPANDED_LIMIT = 128 * 1024 * 1024;
const SOURCE_TABLES = ["cards", "card_awakening_routes", "card_unique_infos"] as const;

export interface SaTrainingRunOptions {
    firstPartyDir: string;
    primaryManifestPath: string;
    primaryPayloadPath: string;
    stageManifestPath: string;
    stageCatalogPath: string;
    awakeningManifestPath: string;
    awakeningPayloadPath: string;
    outputDir: string;
    generatedAt: string;
}

const FLAGS: Record<string, keyof SaTrainingRunOptions> = {
    "--first-party-dir": "firstPartyDir",
    "--primary-manifest": "primaryManifestPath",
    "--primary-payload": "primaryPayloadPath",
    "--stage-manifest": "stageManifestPath",
    "--stage-catalog": "stageCatalogPath",
    "--awakening-manifest": "awakeningManifestPath",
    "--awakening-payload": "awakeningPayloadPath",
    "--output-dir": "outputDir",
    "--generated-at": "generatedAt",
};

export function parseSaTrainingArgs(args: string[]): SaTrainingRunOptions {
    const values: Partial<SaTrainingRunOptions> = {};
    for (let i = 0; i < args.length; i++) {
        const split = args[i].indexOf("=");
        const key = split < 0 ? args[i] : args[i].slice(0, split);
        if (!Object.prototype.hasOwnProperty.call(FLAGS, key)) throw new Error(`Unknown SA argument: ${key}`);
        const value = split < 0 ? args[++i] : args[i].slice(split + 1);
        const field = FLAGS[key];
        if (!value || value.startsWith("--") || values[field] !== undefined) {
            throw new Error(`Missing or duplicate SA argument: ${key}`);
        }
        values[field] = field === "generatedAt" ? value : resolve(value);
    }
    for (const [key, field] of Object.entries(FLAGS)) {
        if (!values[field]) throw new Error(`Missing SA argument: ${key}`);
    }
    if (!Number.isFinite(Date.parse(values.generatedAt!))
        || new Date(values.generatedAt!).toISOString() !== values.generatedAt) {
        throw new Error("Use canonical ISO-8601 --generated-at");
    }
    return values as SaTrainingRunOptions;
}

const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

async function boundedRead(file: string, limit: number): Promise<Buffer> {
    const info = await stat(file);
    if (!info.isFile() || info.size <= 0 || info.size > limit) throw new Error(`Invalid input size: ${file}`);
    const bytes = await readFile(file);
    if (bytes.length !== info.size || bytes.length > limit) throw new Error(`Input changed while reading: ${file}`);
    return bytes;
}

async function json(file: string): Promise<any> {
    return JSON.parse((await boundedRead(file, INPUT_MANIFEST_LIMIT)).toString("utf8"));
}

export async function readSaSourcePayload(file: string, descriptor: {
    sha256: string; sizeBytes: number; expandedSizeBytes: number;
}): Promise<{ value: any; sha256: string }> {
    if (!descriptor || !/^[a-f0-9]{64}$/.test(descriptor.sha256)
        || !Number.isSafeInteger(descriptor.sizeBytes) || descriptor.sizeBytes <= 0
        || descriptor.sizeBytes > INPUT_COMPRESSED_LIMIT
        || !Number.isSafeInteger(descriptor.expandedSizeBytes) || descriptor.expandedSizeBytes <= 0
        || descriptor.expandedSizeBytes > INPUT_EXPANDED_LIMIT) throw new Error("Invalid SA source descriptor");
    const bytes = await boundedRead(file, INPUT_COMPRESSED_LIMIT);
    const digest = sha(bytes);
    if (bytes.length !== descriptor.sizeBytes || digest !== descriptor.sha256) throw new Error("SA source hash/size mismatch");
    const raw = gunzipSync(bytes, { maxOutputLength: descriptor.expandedSizeBytes });
    if (raw.length !== descriptor.expandedSizeBytes) throw new Error("SA source expanded size mismatch");
    return { value: JSON.parse(raw.toString("utf8")), sha256: digest };
}

function contained(root: string, target: string): boolean {
    const sub = relative(root, target);
    return sub !== "" && sub !== ".." && !sub.startsWith(`..${sep}`) && !isAbsolute(sub);
}

async function assertFreshOutput(outputDir: string): Promise<void> {
    await mkdir(SA_TRAINING_CANDIDATE_ROOT, { recursive: true });
    const root = await realpath(SA_TRAINING_CANDIDATE_ROOT);
    const target = resolve(outputDir);
    const parent = await realpath(dirname(target));
    if (!contained(root, target) || (parent !== root && !contained(root, parent))) {
        throw new Error("SA output must stay inside its dedicated candidate root");
    }
    if (await lstat(target).catch(error => {
        if (error.code !== "ENOENT") throw error;
        return undefined;
    })) throw new Error("SA output must be a new directory");
}

/** Local-only candidate. Never invokes a publisher or modifies source artifacts. */
export async function buildSaTrainingCandidate(options: SaTrainingRunOptions) {
    await assertFreshOutput(options.outputDir);
    if (!Number.isFinite(Date.parse(options.generatedAt))
        || new Date(options.generatedAt).toISOString() !== options.generatedAt) throw new Error("Invalid generatedAt");
    const metadata = await json(resolve(options.firstPartyDir, "metadata.json"));
    if (metadata.source !== "first-party-export" || metadata.region !== "global"
        || !/^\d+$/.test(metadata.dbVersion ?? "")) throw new Error("Expected versioned Global first-party export");
    const primaryManifest = await json(options.primaryManifestPath);
    const stageManifest = await json(options.stageManifestPath);
    const awakeningManifest = await json(options.awakeningManifestPath);
    if (primaryManifest.schemaVersion !== 1 || primaryManifest.compression !== "gzip"
        || stageManifest.catalog?.contentEncoding !== "gzip"
        || stageManifest.catalog?.contentType !== "application/json"
        || awakeningManifest.payload?.contentEncoding !== "gzip"
        || awakeningManifest.payload?.contentType !== "application/json") throw new Error("Unsupported source encoding");
    const primary = await readSaSourcePayload(options.primaryPayloadPath, {
        sha256: primaryManifest.sha256, sizeBytes: primaryManifest.sizeBytes,
        expandedSizeBytes: primaryManifest.uncompressedSizeBytes,
    });
    const stage = await readSaSourcePayload(options.stageCatalogPath, stageManifest.catalog);
    const awakening = await readSaSourcePayload(options.awakeningPayloadPath, awakeningManifest.payload);
    validateStageDeliveryRoutes(stage.value, stageManifest);
    validateAwakeningMedalCatalog(awakening.value);
    if (!Array.isArray(primary.value) || primary.value.length !== primaryManifest.characterCount) {
        throw new Error("Primary roster count mismatch");
    }
    for (const [manifest, payload] of [[stageManifest, stage.value], [awakeningManifest, awakening.value]]) {
        if (manifest.sourceSnapshotVersion !== metadata.dbVersion
            || payload.sourceSnapshotVersion !== metadata.dbVersion
            || manifest.sourceDatabaseSha256 !== stageManifest.sourceDatabaseSha256
            || payload.sourceDatabaseSha256 !== stageManifest.sourceDatabaseSha256
            || payload.datasetVersion !== manifest.datasetVersion) throw new Error("Incoherent SA source snapshot");
    }
    const tables: Record<string, ReturnType<typeof parseGameDbTableCsvText>> = {};
    const inventory: { path: string; sizeBytes: number; sha256: string }[] = [];
    for (const table of [...SOURCE_TABLES].sort()) {
        const bytes = await boundedRead(resolve(options.firstPartyDir, "data", `${table}.csv`), INPUT_EXPANDED_LIMIT);
        inventory.push({ path: `data/${table}.csv`, sizeBytes: bytes.length, sha256: sha(bytes) });
        tables[table] = parseGameDbTableCsvText(bytes.toString("utf8"));
    }
    const build = buildSaTrainingIndex({
        generatedAt: options.generatedAt,
        sourceSnapshotVersion: metadata.dbVersion,
        sourceDatabaseSha256: stageManifest.sourceDatabaseSha256,
        firstPartyTableInventorySha256: sha(Buffer.from(JSON.stringify(inventory))),
        tables, primaryCharacters: primary.value, primaryManifest,
        stageCatalog: stage.value, stageManifest, stagePayloadSha256: stage.sha256,
        awakeningCatalog: awakening.value, awakeningManifest, awakeningPayloadSha256: awakening.sha256,
    });
    const object = build.manifest.catalog;
    if (!/^sa-training\/objects\/[a-f0-9]{64}\.json\.gz$/.test(object.objectKey)) throw new Error("Invalid candidate object key");
    const payloadPath = resolve(options.outputDir, ...object.objectKey.split("/"));
    if (!contained(resolve(options.outputDir), payloadPath)) throw new Error("Candidate object escaped output");
    await mkdir(options.outputDir);
    await mkdir(dirname(payloadPath), { recursive: true });
    await writeFile(payloadPath, build.catalogGzip, { flag: "wx" });
    await readSaSourcePayload(payloadPath, object);
    const reportPath = resolve(options.outputDir, "sa-training-audit.json");
    await writeFile(reportPath, JSON.stringify({
        ...build.audit, sourceInventory: inventory, firstPartyMetadata: metadata,
        localOnly: true, primaryRosterUnchanged: true, publicationPerformed: false,
    }, null, 2) + "\n", { flag: "wx" });
    // Manifest last, including for local candidates.
    const manifestPath = resolve(options.outputDir, "sa-training-manifest.json");
    await writeFile(manifestPath, JSON.stringify(build.manifest) + "\n", { flag: "wx" });
    return { manifestPath, reportPath, build };
}

if (require.main === module) {
    buildSaTrainingCandidate(parseSaTrainingArgs(process.argv.slice(2)))
        .then(result => console.log(JSON.stringify({ manifestPath: result.manifestPath, reportPath: result.reportPath })))
        .catch(error => { console.error(error.message); process.exitCode = 1; });
}
