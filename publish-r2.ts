import { createHash } from "crypto";
import { execFile } from "child_process";
import { existsSync, statSync } from "fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { basename, dirname, resolve } from "path";
import { gunzipSync } from "zlib";
import { Character } from "./character";
import {
    assertDatasetPublicationWriteAuthorized,
    contractLaneObjectKey,
    DatasetContractLane,
    DatasetPublicationChannel,
    defaultContractLaneStatePath,
    parseDatasetContractLane,
    parseDatasetPublicationChannel,
} from "./dataset-publication-channel";
import { DatasetManifest } from "./dataset-artifacts";
import { assertAndroidV1PublicationProof } from "./android-v1-publication-proof";
import { assertCharactersProjectedForAndroidV1 } from "./android-v1-contract-projector";

const DEFAULT_DATA_ROOT = "data";
const DEFAULT_IMAGES_ROOT = "data/images";
const DEFAULT_DATASET_PATH = "data/latest/characters.json.gz";
const DEFAULT_MANIFEST_PATH = "data/latest/characters-manifest.json";
const DEFAULT_STATE_PATH = "data/latest/r2-publish-state.json";
const DEFAULT_CONCURRENCY = 6;
const DEFAULT_MAX_TOTAL_BYTES = 10_000_000_000;
const PACKAGE_ROOT = existsSync(resolve(__dirname, "package.json"))
    ? __dirname
    : resolve(__dirname, "..");
const WRANGLER_ENTRYPOINT = resolve(PACKAGE_ROOT, "node_modules", "wrangler", "bin", "wrangler.js");

export interface DatasetPublishState {
    schemaVersion: 1,
    bucket: string,
    target: "remote" | "local",
    channel?: DatasetPublicationChannel,
    contractLane?: DatasetContractLane,
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
    expectedRemoteBaselineSha256?: string,
    target: "remote" | "local",
    concurrency: number,
    maxTotalBytes: number,
    channel: DatasetPublicationChannel,
    contractLane: DatasetContractLane,
    v1ProjectionReportPath?: string,
    manifestObjectKey: string,
    promoteProduction: boolean,
}

interface PublishSummary {
    datasetNeedsUpload: boolean,
    portraitUploadCount: number,
    portraitDeleteCount: number,
    skippedBecauseRemoteMatches: boolean,
    projectedTotalBytes: number,
}

export interface BucketSizeReport {
    reported: string,
    conservativeUpperBoundBytes: number,
}

function datasetVersionSlug(datasetVersion: string): string {
    return datasetVersion
        .trim()
        .replace(/[:]/g, "-")
        .replace(/[^\w./-]/g, "_");
}

export function buildRemoteDatasetObjectKey(
    manifest: DatasetManifest,
    channel: DatasetPublicationChannel = "production",
    contractLane: DatasetContractLane = "v1",
): string {
    if (!/^[a-f0-9]{64}$/i.test(manifest.sha256)) {
        throw new Error("Character manifest SHA-256 is invalid.");
    }
    if (!manifest.datasetVersion || manifest.datasetVersion.trim().length === 0) {
        throw new Error("Character manifest dataset version is missing.");
    }

    const fileName = basename(manifest.fileName.replace(/\\/g, "/"));
    if (fileName !== "characters.json.gz") {
        throw new Error(`Character manifest filename is invalid: ${manifest.fileName}`);
    }

    return contractLaneObjectKey(
        channel,
        contractLane,
        `releases/${datasetVersionSlug(manifest.datasetVersion)}/${manifest.sha256.toLowerCase()}/${fileName}`,
    );
}

export function buildCharacterManifestObjectKey(
    channel: DatasetPublicationChannel = "production",
    contractLane: DatasetContractLane = "v1",
): string {
    return contractLaneObjectKey(channel, contractLane, "characters-manifest.json");
}

export function assertExpectedRemoteBaselineSha256(
    expectedSha256: string | undefined,
    remoteManifest: DatasetManifest | undefined,
): void {
    if (!expectedSha256) return;
    if (!/^[a-f0-9]{64}$/.test(expectedSha256)) {
        throw new Error("Expected remote baseline SHA-256 is invalid.");
    }
    if (!remoteManifest) {
        throw new Error("Cannot prove the expected remote baseline without the remote manifest.");
    }
    if (remoteManifest.sha256.toLowerCase() !== expectedSha256) {
        throw new Error(
            `Remote Character baseline changed: expected ${expectedSha256}, found ${remoteManifest.sha256.toLowerCase()}.`,
        );
    }
}

function sha256(buffer: Buffer): string {
    return createHash("sha256").update(buffer).digest("hex");
}

export function parseWranglerBucketSize(reported: string): BucketSizeReport {
    const match = /^\s*(\d+(?:\.\d+)?)\s*(B|kB|MB|GB|TB)\s*$/.exec(reported);
    if (!match) {
        throw new Error(`Unsupported Wrangler bucket size: ${reported}`);
    }

    const units: Record<string, number> = {
        B: 1,
        kB: 1_000,
        MB: 1_000_000,
        GB: 1_000_000_000,
        TB: 1_000_000_000_000,
    };
    const decimals = match[1].split(".")[1]?.length ?? 0;
    const displayResolution = 10 ** -decimals;
    const upperBound = Math.ceil((Number(match[1]) + displayResolution) * units[match[2]]);
    if (!Number.isSafeInteger(upperBound)) {
        throw new Error(`Wrangler bucket size is outside the safe integer range: ${reported}`);
    }

    return { reported, conservativeUpperBoundBytes: upperBound };
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

    const toUpload = forcePortraits
        ? [...currentPortraits]
        : currentPortraits.filter(entry => previousPortraits[entry.objectKey] !== entry.sha256);

    return {
        toUpload: toUpload.sort((left, right) => left.objectKey.localeCompare(right.objectKey)),
        // Portrait keys are immutable assets referenced by retained historical
        // bundles. Deletion requires a separate, release-aware GC policy.
        toDelete: [],
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

export function validateLocalCharacterBundle(
    manifest: DatasetManifest,
    gzipBuffer: Buffer,
): Character[] {
    if (manifest.schemaVersion !== 1) {
        throw new Error(`Unsupported Character manifest schema version: ${manifest.schemaVersion}`);
    }
    if (manifest.compression !== "gzip") {
        throw new Error(`Unsupported Character bundle compression: ${manifest.compression}`);
    }
    if (manifest.fileName !== "characters.json.gz") {
        throw new Error(`Local Character manifest filename is invalid: ${manifest.fileName}`);
    }
    if (!/^[a-f0-9]{64}$/.test(manifest.sha256)) {
        throw new Error("Local Character manifest SHA-256 is invalid.");
    }
    if (!manifest.datasetVersion || manifest.datasetVersion.trim().length === 0) {
        throw new Error("Local Character manifest dataset version is missing.");
    }
    if (!manifest.generatedAt || manifest.generatedAt.trim().length === 0) {
        throw new Error("Local Character manifest generation time is missing.");
    }
    if (!Number.isSafeInteger(manifest.sizeBytes) || manifest.sizeBytes < 1) {
        throw new Error("Local Character manifest compressed size is invalid.");
    }
    if (!Number.isSafeInteger(manifest.uncompressedSizeBytes) || manifest.uncompressedSizeBytes < 1) {
        throw new Error("Local Character manifest uncompressed size is invalid.");
    }
    if (!Number.isSafeInteger(manifest.characterCount) || manifest.characterCount < 0) {
        throw new Error("Local Character manifest character count is invalid.");
    }
    if (gzipBuffer.byteLength !== manifest.sizeBytes) {
        throw new Error(
            `Local Character bundle size mismatch: expected ${manifest.sizeBytes}, found ${gzipBuffer.byteLength}.`,
        );
    }

    const actualSha256 = sha256(gzipBuffer);
    if (actualSha256 !== manifest.sha256) {
        throw new Error(
            `Local Character bundle SHA-256 mismatch: expected ${manifest.sha256}, found ${actualSha256}.`,
        );
    }

    let uncompressedBuffer: Buffer;
    try {
        uncompressedBuffer = gunzipSync(gzipBuffer);
    } catch (exception) {
        const message = exception instanceof Error ? exception.message : String(exception);
        throw new Error(`Local Character bundle is not valid gzip: ${message}`);
    }
    if (uncompressedBuffer.byteLength !== manifest.uncompressedSizeBytes) {
        throw new Error(
            `Local Character bundle uncompressed size mismatch: expected ${manifest.uncompressedSizeBytes}, found ${uncompressedBuffer.byteLength}.`,
        );
    }

    const parsed = JSON.parse(uncompressedBuffer.toString("utf8")) as unknown;
    if (!Array.isArray(parsed)) {
        throw new Error("Local Character bundle payload must be an array.");
    }
    if (parsed.length !== manifest.characterCount) {
        throw new Error(
            `Local Character bundle count mismatch: expected ${manifest.characterCount}, found ${parsed.length}.`,
        );
    }

    return parsed as Character[];
}

async function readManifest(manifestPath: string): Promise<DatasetManifest> {
    return JSON.parse(await readFile(manifestPath, "utf8")) as DatasetManifest;
}

async function readPublishState(
    statePath: string,
    channel: DatasetPublicationChannel,
    contractLane: DatasetContractLane,
): Promise<DatasetPublishState | undefined> {
    if (!existsSync(statePath)) {
        return undefined;
    }

    const state = JSON.parse(await readFile(statePath, "utf8")) as DatasetPublishState;
    const stateChannel = state.channel ?? "production";
    if (stateChannel !== channel) {
        throw new Error(
            `Character publish state belongs to ${stateChannel}, not requested channel ${channel}.`,
        );
    }
    const stateContractLane = state.contractLane ?? "v1";
    if (stateContractLane !== contractLane) {
        throw new Error(
            `Character publish state belongs to ${stateContractLane}, not requested contract lane ${contractLane}.`,
        );
    }
    return state;
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
    await execFileAsync(process.execPath, [WRANGLER_ENTRYPOINT, ...args]);
}

async function readRemoteBucketSizeReport(bucket: string): Promise<BucketSizeReport> {
    let stdout: string;
    try {
        ({ stdout } = await execFileAsync(process.execPath, [
            WRANGLER_ENTRYPOINT,
            "r2",
            "bucket",
            "info",
            bucket,
            "--json",
        ]));
    } catch (exception) {
        const message = exception instanceof Error ? exception.message : String(exception);
        throw new Error(`Cannot prove the R2 bucket budget: ${message}`);
    }

    try {
        const parsed = JSON.parse(stdout) as { bucket_size?: unknown };
        if (typeof parsed.bucket_size !== "string") {
            throw new Error("missing bucket_size");
        }
        return parseWranglerBucketSize(parsed.bucket_size);
    } catch (exception) {
        const message = exception instanceof Error ? exception.message : String(exception);
        throw new Error(`Cannot prove the R2 bucket budget: ${message}`);
    }
}

async function tryReadRemoteManifest(
    bucket: string,
    target: "remote" | "local",
    manifestObjectKey: string,
): Promise<DatasetManifest | undefined> {
    const tempDirectory = await mkdtemp(resolve(tmpdir(), "dokkan-r2-manifest-"));
    const tempManifestPath = resolve(tempDirectory, "characters-manifest.json");

    try {
        const args = [
            "r2",
            "object",
            "get",
            `${bucket}/${manifestObjectKey}`,
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

export function parsePublishArgs(argv: string[]): PublishCliOptions {
    const values = new Map<string, string>();
    const flags = new Set<string>();
    const valueRequiredOptions = new Set([
        "--expected-remote-baseline-sha256",
        "--channel",
        "--contract-lane",
        "--v1-projection-report",
    ]);

    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];
        if (!token.startsWith("--")) {
            throw new Error(`Unexpected argument: ${token}`);
        }

        const [name, inlineValue] = token.split("=", 2);
        if (inlineValue !== undefined) {
            if (valueRequiredOptions.has(name) && inlineValue.length === 0) {
                throw new Error(`${name} requires a value.`);
            }
            values.set(name, inlineValue);
            continue;
        }

        const nextToken = argv[index + 1];
        if (!nextToken || nextToken.startsWith("--")) {
            if (valueRequiredOptions.has(name)) {
                throw new Error(`${name} requires a value.`);
            }
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

    const expectedRemoteBaselineSha256 = values.get("--expected-remote-baseline-sha256")?.toLowerCase();
    if (expectedRemoteBaselineSha256 && !/^[a-f0-9]{64}$/.test(expectedRemoteBaselineSha256)) {
        throw new Error("Invalid --expected-remote-baseline-sha256 value.");
    }
    if (expectedRemoteBaselineSha256 && flags.has("--skip-remote-manifest-check")) {
        throw new Error(
            "--expected-remote-baseline-sha256 cannot be combined with --skip-remote-manifest-check.",
        );
    }
    const channel = parseDatasetPublicationChannel(values.get("--channel"));
    const contractLane = parseDatasetContractLane(values.get("--contract-lane"));
    const v1ProjectionReportPath = values.get("--v1-projection-report");
    if (contractLane === "v1" && !v1ProjectionReportPath) {
        throw new Error("The v1 contract lane requires --v1-projection-report.");
    }
    if (contractLane !== "v1" && v1ProjectionReportPath) {
        throw new Error("--v1-projection-report can only be used with --contract-lane v1.");
    }
    if (channel === "staging" && !flags.has("--skip-portraits")) {
        throw new Error(
            "Staging publication requires --skip-portraits because portrait keys are not channel-scoped.",
        );
    }

    return {
        bucket,
        dataRoot: resolve(values.get("--data-root") ?? DEFAULT_DATA_ROOT),
        imagesRoot: resolve(values.get("--images-root") ?? DEFAULT_IMAGES_ROOT),
        datasetPath: resolve(values.get("--dataset") ?? DEFAULT_DATASET_PATH),
        manifestPath: resolve(values.get("--manifest") ?? DEFAULT_MANIFEST_PATH),
        statePath: values.has("--state")
            ? resolve(values.get("--state")!)
            : defaultContractLaneStatePath(DEFAULT_STATE_PATH, channel, contractLane),
        dryRun: flags.has("--dry-run"),
        forcePortraits: flags.has("--force-portraits"),
        skipPortraits: flags.has("--skip-portraits"),
        skipRemoteManifestCheck: flags.has("--skip-remote-manifest-check"),
        expectedRemoteBaselineSha256,
        target: localFlag ? "local" : "remote",
        concurrency,
        maxTotalBytes,
        channel,
        contractLane,
        v1ProjectionReportPath: v1ProjectionReportPath ? resolve(v1ProjectionReportPath) : undefined,
        manifestObjectKey: buildCharacterManifestObjectKey(channel, contractLane),
        promoteProduction: flags.has("--promote-production"),
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
    assertDatasetPublicationWriteAuthorized(options);
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
    const localGzipBuffer = await readFile(options.datasetPath);
    const characters = validateLocalCharacterBundle(localManifest, localGzipBuffer);
    if (options.contractLane === "v1") {
        assertCharactersProjectedForAndroidV1(characters);
        await assertAndroidV1PublicationProof(options.v1ProjectionReportPath!, {
            characters: localManifest,
        });
    }
    const remoteDatasetObjectKey = buildRemoteDatasetObjectKey(
        localManifest,
        options.channel,
        options.contractLane,
    );
    const remoteManifest: DatasetManifest = {
        ...localManifest,
        fileName: remoteDatasetObjectKey,
    };
    const portraitKeys = collectReferencedPortraitKeys(characters);
    const previousState = await readPublishState(options.statePath, options.channel, options.contractLane);
    const publishedRemoteManifest = options.skipRemoteManifestCheck
        ? undefined
        : await tryReadRemoteManifest(options.bucket, options.target, options.manifestObjectKey);
    assertExpectedRemoteBaselineSha256(options.expectedRemoteBaselineSha256, publishedRemoteManifest);
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

    const prospectiveUploadBytes = (datasetNeedsUpload
        ? localGzipBuffer.byteLength + manifestByteSize(remoteManifest)
        : 0)
        + portraitPlan.toUpload.reduce((total, entry) => total + statSync(entry.filePath).size, 0);
    const bucketSizeReport = options.target === "remote"
        ? await readRemoteBucketSizeReport(options.bucket)
        : undefined;
    const projectedBucketUpperBoundBytes = bucketSizeReport
        ? bucketSizeReport.conservativeUpperBoundBytes + prospectiveUploadBytes
        : undefined;
    if (projectedBucketUpperBoundBytes !== undefined && projectedBucketUpperBoundBytes >= options.maxTotalBytes) {
        throw new Error(
            `Projected conservative bucket upper bound ${projectedBucketUpperBoundBytes} bytes reaches or exceeds `
            + `the configured limit of ${options.maxTotalBytes} bytes.`,
        );
    }

    console.log(`Channel: ${options.channel}`);
    console.log(`Contract lane: ${options.contractLane}`);
    console.log(`Manifest object key: ${options.manifestObjectKey}`);
    console.log(`Dataset version: ${remoteManifest.datasetVersion}`);
    console.log(`Dataset object key: ${remoteDatasetObjectKey}`);
    console.log(`Dataset upload needed: ${datasetNeedsUpload ? "yes" : "no"}`);
    console.log(`Portraits referenced: ${portraitKeys.length}`);
    console.log(`Portraits to upload: ${portraitPlan.toUpload.length}`);
    console.log(`Portraits to delete: ${portraitPlan.toDelete.length}`);
    console.log(`Projected managed size: ${projectedTotalBytes}/${options.maxTotalBytes} bytes`);
    if (bucketSizeReport && projectedBucketUpperBoundBytes !== undefined) {
        console.log(
            `Wrangler bucket size: ${bucketSizeReport.reported}; conservative projected upper bound: `
            + `${projectedBucketUpperBoundBytes}/${options.maxTotalBytes} bytes`,
        );
    }

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
            options.manifestObjectKey,
            manifestTempPath,
            "application/json",
            "no-store",
            options.target,
        );
        await rm(manifestTempDirectory, { recursive: true, force: true });
    }

    // Character bundles are immutable and intentionally retained. Keeping the
    // prior content-addressed object and its portraits preserves rollback and
    // old-client reads. Every remote run measures the whole bucket and adds
    // prospective uploads conservatively; cleanup still needs a separate,
    // release-aware GC policy.

    const nextState: DatasetPublishState = {
        schemaVersion: 1,
        bucket: options.bucket,
        target: options.target,
        channel: options.channel,
        contractLane: options.contractLane,
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
    const options = parsePublishArgs(process.argv.slice(2));
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
