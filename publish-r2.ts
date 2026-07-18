import { createHash } from "crypto";
import { execFile } from "child_process";
import { existsSync, statSync } from "fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { dirname, resolve } from "path";
import { gunzipSync } from "zlib";
import { Character } from "./character";
import { DatasetManifest } from "./dataset-artifacts";

const DEFAULT_DATA_ROOT = "data";
const DEFAULT_IMAGES_ROOT = "data/images";
const DEFAULT_DATASET_PATH = "data/latest/characters.json.gz";
const DEFAULT_MANIFEST_PATH = "data/latest/characters-manifest.json";
const DEFAULT_STATE_PATH = "data/latest/r2-publish-state.json";
const DEFAULT_CONCURRENCY = 6;
const DEFAULT_MAX_TOTAL_BYTES = 10_000_000_000;

export interface DatasetPublishState {
    schemaVersion: 1,
    bucket: string,
    target: "remote" | "local",
    datasetVersion: string,
    datasetObjectKey: string,
    manifestSha256: string,
    publishedAt: string,
    portraits: Record<string, string>,
}

export interface PortraitPublishEntry {
    objectKey: string,
    filePath: string,
    sha256: string,
}

export interface PortraitPublishPlan {
    toUpload: PortraitPublishEntry[],
    toDelete: string[],
}

interface PublishCliOptions {
    bucket: string,
    dataRoot: string,
    imagesRoot: string,
    datasetPath: string,
    manifestPath: string,
    statePath: string,
    dryRun: boolean,
    forcePortraits: boolean,
    skipPortraits: boolean,
    skipRemoteManifestCheck: boolean,
    target: "remote" | "local",
    concurrency: number,
    maxTotalBytes: number,
}

interface PublishSummary {
    datasetNeedsUpload: boolean,
    portraitUploadCount: number,
    portraitDeleteCount: number,
    skippedBecauseRemoteMatches: boolean,
    projectedTotalBytes: number,
}

function datasetVersionSlug(datasetVersion: string): string {
    return datasetVersion
        .trim()
        .replace(/[:]/g, "-")
        .replace(/[^\w./-]/g, "_");
}

function buildRemoteDatasetObjectKey(manifest: DatasetManifest): string {
    const fileName = manifest.fileName.split("/").pop() ?? "characters.json.gz";
    return `releases/${datasetVersionSlug(manifest.datasetVersion)}/${fileName}`;
}

function sha256(buffer: Buffer): string {
    return createHash("sha256").update(buffer).digest("hex");
}

function normalizeObjectKey(value: string): string {
    return value.replace(/\\/g, "/").replace(/^\/+/, "").replace(/^\.\//, "");
}

export function collectReferencedPortraitKeys(characters: Character[]): string[] {
    const portraitKeys = new Set<string>();

    const add = (portraitURL?: string) => {
        if (!portraitURL) {
            return;
        }

        portraitKeys.add(normalizeObjectKey(portraitURL));
    };

    for (const character of characters) {
        add(character.portraitURL);

        for (const transformation of character.transformations ?? []) {
            add(transformation.portraitURL);
        }

        for (const awakening of [
            ...(character.awakeningCards ?? []),
            ...(character.previousAwakenings ?? []),
            ...(character.nextAwakenings ?? []),
        ]) {
            add(awakening.portraitURL);
        }
    }

    return Array.from(portraitKeys).sort((left, right) => left.localeCompare(right));
}

export function buildPortraitPublishPlan(
    currentPortraits: PortraitPublishEntry[],
    previousState?: DatasetPublishState,
    options?: {
        forcePortraits?: boolean,
    },
): PortraitPublishPlan {
    const previousPortraits = previousState?.portraits ?? {};
    const forcePortraits = options?.forcePortraits === true;
    const currentPortraitMap = new Map(currentPortraits.map(entry => [entry.objectKey, entry]));

    const toUpload = forcePortraits
        ? [...currentPortraits]
        : currentPortraits.filter(entry => previousPortraits[entry.objectKey] !== entry.sha256);

    const toDelete = previousState
        ? Object.keys(previousPortraits)
            .filter(objectKey => !currentPortraitMap.has(objectKey))
            .sort((left, right) => left.localeCompare(right))
        : [];

    return {
        toUpload: toUpload.sort((left, right) => left.objectKey.localeCompare(right.objectKey)),
        toDelete,
    };
}

async function buildPortraitEntries(objectKeys: string[], dataRoot: string): Promise<PortraitPublishEntry[]> {
    const entries: PortraitPublishEntry[] = [];

    for (const objectKey of objectKeys) {
        const filePath = resolve(dataRoot, objectKey);
        if (!existsSync(filePath)) {
            throw new Error(`Missing portrait file for ${objectKey}: ${filePath}`);
        }

        const fileBuffer = await readFile(filePath);
        entries.push({
            objectKey,
            filePath,
            sha256: sha256(fileBuffer),
        });
    }

    return entries;
}

async function readCharactersFromBundle(datasetPath: string): Promise<Character[]> {
    const gzipBuffer = await readFile(datasetPath);
    return JSON.parse(gunzipSync(gzipBuffer).toString("utf8")) as Character[];
}

async function readManifest(manifestPath: string): Promise<DatasetManifest> {
    return JSON.parse(await readFile(manifestPath, "utf8")) as DatasetManifest;
}

async function readPublishState(statePath: string): Promise<DatasetPublishState | undefined> {
    if (!existsSync(statePath)) {
        return undefined;
    }

    return JSON.parse(await readFile(statePath, "utf8")) as DatasetPublishState;
}

async function writePublishState(
    statePath: string,
    state: DatasetPublishState,
): Promise<void> {
    await mkdir(dirname(statePath), { recursive: true });
    await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

async function execFileAsync(command: string, args: string[]): Promise<{ stdout: string, stderr: string }> {
    return new Promise((resolvePromise, rejectPromise) => {
        execFile(command, args, { maxBuffer: 1024 * 1024 * 16 }, (error, stdout, stderr) => {
            if (error) {
                rejectPromise(new Error(stderr || stdout || error.message));
                return;
            }

            resolvePromise({ stdout, stderr });
        });
    });
}

async function runWranglerCommand(args: string[]): Promise<void> {
    if (process.platform === "win32") {
        await execFileAsync("cmd.exe", ["/d", "/s", "/c", "npx", "wrangler", ...args]);
        return;
    }

    await execFileAsync("npx", ["wrangler", ...args]);
}

async function tryReadRemoteManifest(
    bucket: string,
    target: "remote" | "local",
): Promise<DatasetManifest | undefined> {
    const tempDirectory = await mkdtemp(resolve(tmpdir(), "dokkan-r2-manifest-"));
    const tempManifestPath = resolve(tempDirectory, "characters-manifest.json");

    try {
        const args = [
            "r2",
            "object",
            "get",
            `${bucket}/characters-manifest.json`,
            "--file",
            tempManifestPath,
            target === "remote" ? "--remote" : "--local",
        ];

        await runWranglerCommand(args);
        return JSON.parse(await readFile(tempManifestPath, "utf8")) as DatasetManifest;
    } catch (error) {
        return undefined;
    } finally {
        await rm(tempDirectory, { recursive: true, force: true });
    }
}

async function uploadObject(
    bucket: string,
    objectKey: string,
    filePath: string,
    contentType: string,
    cacheControl: string,
    target: "remote" | "local",
): Promise<void> {
    await runWranglerCommand([
        "r2",
        "object",
        "put",
        `${bucket}/${objectKey}`,
        "--file",
        filePath,
        "--content-type",
        contentType,
        "--cache-control",
        cacheControl,
        target === "remote" ? "--remote" : "--local",
    ]);
}

async function deleteObject(
    bucket: string,
    objectKey: string,
    target: "remote" | "local",
): Promise<void> {
    await runWranglerCommand([
        "r2",
        "object",
        "delete",
        `${bucket}/${objectKey}`,
        target === "remote" ? "--remote" : "--local",
    ]);
}

async function runWithConcurrency<T>(
    items: T[],
    concurrency: number,
    task: (item: T, index: number) => Promise<void>,
): Promise<void> {
    if (items.length === 0) {
        return;
    }

    let currentIndex = 0;
    const workerCount = Math.max(1, Math.min(concurrency, items.length));

    const workers = Array.from({ length: workerCount }, async () => {
        while (true) {
            const index = currentIndex;
            if (index >= items.length) {
                return;
            }

            currentIndex += 1;
            await task(items[index], index);
        }
    });

    await Promise.all(workers);
}

function parseArgs(argv: string[]): PublishCliOptions {
    const values = new Map<string, string>();
    const flags = new Set<string>();

    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];
        if (!token.startsWith("--")) {
            throw new Error(`Unexpected argument: ${token}`);
        }

        const [name, inlineValue] = token.split("=", 2);
        if (inlineValue !== undefined) {
            values.set(name, inlineValue);
            continue;
        }

        const nextToken = argv[index + 1];
        if (!nextToken || nextToken.startsWith("--")) {
            flags.add(name);
            continue;
        }

        values.set(name, nextToken);
        index += 1;
    }

    const bucket = values.get("--bucket") ?? process.env.R2_BUCKET_NAME;
    if (!bucket) {
        throw new Error("Missing bucket. Pass --bucket dokkanpanion-data or set R2_BUCKET_NAME.");
    }

    const localFlag = flags.has("--local");
    const remoteFlag = flags.has("--remote");
    if (localFlag && remoteFlag) {
        throw new Error("Choose only one of --local or --remote.");
    }

    const concurrencyRaw = values.get("--concurrency");
    const concurrency = concurrencyRaw ? Number.parseInt(concurrencyRaw, 10) : DEFAULT_CONCURRENCY;
    if (!Number.isFinite(concurrency) || concurrency < 1) {
        throw new Error(`Invalid --concurrency value: ${concurrencyRaw}`);
    }

    const maxTotalBytesRaw = values.get("--max-total-bytes");
    const maxTotalBytes = maxTotalBytesRaw
        ? Number.parseInt(maxTotalBytesRaw, 10)
        : DEFAULT_MAX_TOTAL_BYTES;
    if (!Number.isFinite(maxTotalBytes) || maxTotalBytes < 1) {
        throw new Error(`Invalid --max-total-bytes value: ${maxTotalBytesRaw}`);
    }

    return {
        bucket,
        dataRoot: resolve(values.get("--data-root") ?? DEFAULT_DATA_ROOT),
        imagesRoot: resolve(values.get("--images-root") ?? DEFAULT_IMAGES_ROOT),
        datasetPath: resolve(values.get("--dataset") ?? DEFAULT_DATASET_PATH),
        manifestPath: resolve(values.get("--manifest") ?? DEFAULT_MANIFEST_PATH),
        statePath: resolve(values.get("--state") ?? DEFAULT_STATE_PATH),
        dryRun: flags.has("--dry-run"),
        forcePortraits: flags.has("--force-portraits"),
        skipPortraits: flags.has("--skip-portraits"),
        skipRemoteManifestCheck: flags.has("--skip-remote-manifest-check"),
        target: localFlag ? "local" : "remote",
        concurrency,
        maxTotalBytes,
    };
}

function manifestsMatch(left: DatasetManifest, right?: DatasetManifest): boolean {
    if (!right) {
        return false;
    }

    return left.sha256 === right.sha256
        && left.fileName === right.fileName
        && left.datasetVersion === right.datasetVersion;
}

async function publishDataset(options: PublishCliOptions): Promise<PublishSummary> {
    if (!existsSync(options.manifestPath)) {
        throw new Error(`Manifest not found: ${options.manifestPath}`);
    }
    if (!existsSync(options.datasetPath)) {
        throw new Error(`Dataset bundle not found: ${options.datasetPath}`);
    }
    if (!existsSync(options.imagesRoot)) {
        throw new Error(`Portrait directory not found: ${options.imagesRoot}`);
    }

    const localManifest = await readManifest(options.manifestPath);
    const remoteDatasetObjectKey = buildRemoteDatasetObjectKey(localManifest);
    const remoteManifest: DatasetManifest = {
        ...localManifest,
        fileName: remoteDatasetObjectKey,
    };
    const characters = await readCharactersFromBundle(options.datasetPath);
    const portraitKeys = collectReferencedPortraitKeys(characters);
    const previousState = await readPublishState(options.statePath);
    const publishedRemoteManifest = options.skipRemoteManifestCheck
        ? undefined
        : await tryReadRemoteManifest(options.bucket, options.target);
    const datasetNeedsUpload = !manifestsMatch(remoteManifest, publishedRemoteManifest);
    const skippedBecauseRemoteMatches = !datasetNeedsUpload && !options.forcePortraits && !options.skipPortraits;

    const portraitEntries = options.skipPortraits
        ? []
        : await buildPortraitEntries(portraitKeys, options.dataRoot);
    const portraitPlan = options.skipPortraits
        ? { toUpload: [], toDelete: [] }
        : buildPortraitPublishPlan(portraitEntries, previousState, { forcePortraits: options.forcePortraits });
    const projectedTotalBytes = statSync(options.datasetPath).size
        + manifestByteSize(remoteManifest)
        + portraitEntries.reduce((total, entry) => total + statSync(entry.filePath).size, 0);

    if (projectedTotalBytes > options.maxTotalBytes) {
        throw new Error(
            `Projected R2 dataset size ${projectedTotalBytes} bytes exceeds the configured limit of ${options.maxTotalBytes} bytes. `
            + "Reduce the dataset or raise the limit explicitly after checking the bucket budget.",
        );
    }

    console.log(`Dataset version: ${remoteManifest.datasetVersion}`);
    console.log(`Dataset object key: ${remoteDatasetObjectKey}`);
    console.log(`Dataset upload needed: ${datasetNeedsUpload ? "yes" : "no"}`);
    console.log(`Portraits referenced: ${portraitKeys.length}`);
    console.log(`Portraits to upload: ${portraitPlan.toUpload.length}`);
    console.log(`Portraits to delete: ${portraitPlan.toDelete.length}`);
    console.log(`Projected managed size: ${projectedTotalBytes}/${options.maxTotalBytes} bytes`);

    if (options.dryRun) {
        return {
            datasetNeedsUpload,
            portraitUploadCount: portraitPlan.toUpload.length,
            portraitDeleteCount: portraitPlan.toDelete.length,
            skippedBecauseRemoteMatches,
            projectedTotalBytes,
        };
    }

    if (datasetNeedsUpload) {
        console.log("Uploading dataset bundle...");
        await uploadObject(
            options.bucket,
            remoteDatasetObjectKey,
            options.datasetPath,
            "application/gzip",
            "public, max-age=31536000, immutable",
            options.target,
        );
    }

    if (portraitPlan.toDelete.length > 0) {
        console.log("Deleting stale portraits from R2...");
        await runWithConcurrency(portraitPlan.toDelete, options.concurrency, async (objectKey, index) => {
            await deleteObject(options.bucket, objectKey, options.target);
            if ((index + 1) % 25 === 0 || index + 1 === portraitPlan.toDelete.length) {
                console.log(`Deleted ${index + 1}/${portraitPlan.toDelete.length} stale portrait(s)`);
            }
        });
    }

    if (portraitPlan.toUpload.length > 0) {
        console.log("Uploading portraits...");
        await runWithConcurrency(portraitPlan.toUpload, options.concurrency, async (entry, index) => {
            await uploadObject(
                options.bucket,
                entry.objectKey,
                entry.filePath,
                "image/png",
                "public, max-age=31536000, immutable",
                options.target,
            );

            if ((index + 1) % 25 === 0 || index + 1 === portraitPlan.toUpload.length) {
                console.log(`Uploaded ${index + 1}/${portraitPlan.toUpload.length} portrait(s)`);
            }
        });
    }

    if (datasetNeedsUpload) {
        console.log("Uploading manifest...");
        const manifestTempDirectory = await mkdtemp(resolve(tmpdir(), "dokkan-r2-publish-manifest-"));
        const manifestTempPath = resolve(manifestTempDirectory, "characters-manifest.json");
        await writeFile(manifestTempPath, `${JSON.stringify(remoteManifest, null, 2)}\n`, "utf8");
        await uploadObject(
            options.bucket,
            "characters-manifest.json",
            manifestTempPath,
            "application/json",
            "no-store",
            options.target,
        );
        await rm(manifestTempDirectory, { recursive: true, force: true });
    }

    if (
        datasetNeedsUpload &&
        previousState?.datasetObjectKey &&
        previousState.datasetObjectKey.trim().length > 0 &&
        previousState.datasetObjectKey !== remoteDatasetObjectKey
    ) {
        console.log(`Deleting previous dataset release ${previousState.datasetObjectKey}...`);
        try {
            await deleteObject(options.bucket, previousState.datasetObjectKey, options.target);
        } catch (exception) {
            const message = exception instanceof Error ? exception.message : String(exception);
            console.warn(`Failed to delete previous dataset release: ${message}`);
        }
    }

    const nextState: DatasetPublishState = {
        schemaVersion: 1,
        bucket: options.bucket,
        target: options.target,
        datasetVersion: remoteManifest.datasetVersion,
        datasetObjectKey: remoteDatasetObjectKey,
        manifestSha256: remoteManifest.sha256,
        publishedAt: new Date().toISOString(),
        portraits: Object.fromEntries(portraitEntries.map(entry => [entry.objectKey, entry.sha256])),
    };

    await writePublishState(options.statePath, nextState);

    return {
        datasetNeedsUpload,
        portraitUploadCount: portraitPlan.toUpload.length,
        portraitDeleteCount: portraitPlan.toDelete.length,
        skippedBecauseRemoteMatches,
        projectedTotalBytes,
    };
}

function manifestByteSize(manifest: DatasetManifest): number {
    return Buffer.byteLength(`${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

async function main(): Promise<void> {
    const options = parseArgs(process.argv.slice(2));
    const summary = await publishDataset(options);

    if (options.dryRun) {
        console.log("Dry run complete.");
        return;
    }

    if (!summary.datasetNeedsUpload && summary.portraitUploadCount === 0 && summary.portraitDeleteCount === 0) {
        console.log("Nothing changed. R2 is already aligned with the current local dataset.");
        return;
    }

    console.log("R2 publish complete.");
}

if (require.main === module) {
    main().catch((error) => {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
    });
}
