import { createHash } from "crypto";
import { execFile } from "child_process";
import { createReadStream, existsSync, statSync } from "fs";
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { dirname, isAbsolute, relative, resolve, sep } from "path";
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
import {
    CharacterObjectStore,
    canonicalCharacterDatasetObjectKey,
    createRemoteCharacterObjectStore,
    DatasetPublishState,
    DatasetPublishStateV2,
    executeVerifiedCharacterPublication,
    PublisherTelemetry,
    VerifiedPortraitEntry,
    VerifiedPublicationPlan,
} from "./publish-r2-verified-inventory";

export { DatasetPublishState, DatasetPublishStateV2 } from "./publish-r2-verified-inventory";

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

export interface PortraitPublishEntry {
    objectKey: string,
    filePath: string,
    sha256: string,
    sizeBytes?: number,
    loadBytes?: () => Promise<Buffer>,
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
    expectRemoteManifestAbsent: boolean,
    target: "remote" | "local",
    concurrency: number,
    maxTotalBytes: number,
    channel: DatasetPublicationChannel,
    contractLane: DatasetContractLane,
    v1ProjectionReportPath?: string,
    manifestObjectKey: string,
    promoteProduction: boolean,
    fullAudit: boolean,
    verificationOnly: boolean,
}

interface PublishSummary {
    datasetNeedsUpload: boolean,
    portraitUploadCount: number,
    portraitDeleteCount: number,
    skippedBecauseRemoteMatches: boolean,
    projectedTotalBytes: number,
    telemetry: PublisherTelemetry,
}

export interface BucketSizeReport {
    reported: string,
    conservativeUpperBoundBytes: number,
}

function canonicalRemoteDatasetObjectKey(
    manifest: Pick<DatasetManifest, "datasetVersion" | "sha256">,
    channel: DatasetPublicationChannel,
    contractLane: DatasetContractLane,
): string {
    return canonicalCharacterDatasetObjectKey(manifest, channel, contractLane);
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

    const expectedObjectKey = canonicalRemoteDatasetObjectKey(manifest, channel, contractLane);
    if (manifest.fileName !== "characters.json.gz" && manifest.fileName !== expectedObjectKey) {
        throw new Error(`Character manifest filename is invalid: ${manifest.fileName}`);
    }

    return expectedObjectKey;
}

export function buildCharacterManifestObjectKey(
    channel: DatasetPublicationChannel = "production",
    contractLane: DatasetContractLane = "v1",
): string {
    return contractLaneObjectKey(channel, contractLane, "characters-manifest.json");
}

export function assertExpectedRemoteBaselineSha256(
    expectedSha256: string | undefined,
    remoteManifest: Pick<DatasetManifest, "sha256"> | undefined,
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

export function assertExpectedRemoteManifestBaseline(
    expectedSha256: string | undefined,
    expectAbsent: boolean,
    remoteManifest: Pick<DatasetManifest, "sha256"> | undefined,
): void {
    if (expectedSha256 && expectAbsent) {
        throw new Error("Choose exactly one remote manifest baseline pin.");
    }
    if (expectAbsent) {
        if (remoteManifest) {
            throw new Error(
                `Character remote manifest was expected to be absent but now points to ${remoteManifest.sha256}.`,
            );
        }
        return;
    }
    assertExpectedRemoteBaselineSha256(expectedSha256, remoteManifest);
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

export function assertBucketSizeCanContainVerifiedObjects(
    report: BucketSizeReport,
    projectedManagedBytes: number,
    prospectiveUploadBytes: number,
): void {
    const verifiedExistingLowerBoundBytes = Math.max(0, projectedManagedBytes - prospectiveUploadBytes);
    if (report.conservativeUpperBoundBytes < verifiedExistingLowerBoundBytes) {
        throw new Error(
            `Wrangler bucket size ${report.reported} is inconsistent with at least `
            + `${verifiedExistingLowerBoundBytes} verified existing bytes; refusing to trust the bucket budget.`,
        );
    }
}

function normalizeObjectKey(value: string): string {
    return value.replace(/\\/g, "/").replace(/^\/+/, "").replace(/^\.\//, "");
}

export type PortraitLayerKind = "background" | "thumb" | "overlay";

export interface ReferencedPortrait {
    objectKey: string,
    layerKind?: PortraitLayerKind,
}

export function collectReferencedPortraitReferences(characters: Character[]): ReferencedPortrait[] {
    const portraits = new Map<string, ReferencedPortrait>();

    const add = (portraitURL?: string, layerKind?: PortraitLayerKind) => {
        if (portraitURL === undefined) {
            return;
        }
        if (typeof portraitURL !== "string" || portraitURL.trim().length === 0) {
            throw new Error(`Portrait ${layerKind ? `${layerKind} layer ` : ""}URL must be a non-empty string.`);
        }

        const objectKey = normalizeObjectKey(portraitURL);
        const previous = portraits.get(objectKey);
        if (previous && previous.layerKind !== layerKind) {
            throw new Error(
                `Portrait object key ${objectKey} is referenced with conflicting static/layer kinds.`,
            );
        }
        portraits.set(objectKey, { objectKey, layerKind: previous?.layerKind ?? layerKind });
    };

    const addLayers = (layers: Character["portraitLayers"]) => {
        if (!layers) return;
        if (typeof layers !== "object"
            || typeof layers.backgroundURL !== "string" || layers.backgroundURL.trim().length === 0
            || typeof layers.thumbURL !== "string" || layers.thumbURL.trim().length === 0
            || typeof layers.overlayURL !== "string" || layers.overlayURL.trim().length === 0) {
            throw new Error("portraitLayers must provide non-empty backgroundURL, thumbURL, and overlayURL values.");
        }
        add(layers.backgroundURL, "background");
        add(layers.thumbURL, "thumb");
        add(layers.overlayURL, "overlay");
    };

    for (const character of characters) {
        add(character.portraitURL);
        addLayers(character.portraitLayers);

        for (const transformation of character.transformations ?? []) {
            add(transformation.portraitURL);
            addLayers(transformation.portraitLayers);
        }

        for (const awakening of [
            ...(character.awakeningCards ?? []),
            ...(character.previousAwakenings ?? []),
            ...(character.nextAwakenings ?? []),
        ]) {
            add(awakening.portraitURL);
            addLayers(awakening.portraitLayers);
        }
    }

    return Array.from(portraits.values()).sort((left, right) => left.objectKey.localeCompare(right.objectKey));
}

export function collectReferencedPortraitKeys(characters: Character[]): string[] {
    return collectReferencedPortraitReferences(characters).map(reference => reference.objectKey);
}

export function assertPortraitPublicationMode(characters: Character[], skipPortraits: boolean): void {
    if (!skipPortraits) return;
    const hasTypedPortraitLayers = collectReferencedPortraitReferences(characters)
        .some(reference => reference.layerKind !== undefined);
    if (hasTypedPortraitLayers) {
        throw new Error(
            "--skip-portraits cannot be used when the Character dataset references typed portraitLayers.",
        );
    }
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
        : currentPortraits.filter(entry => {
            const previous = previousPortraits[entry.objectKey];
            const previousSha256 = typeof previous === "string" ? previous : previous?.sha256;
            return previousSha256 !== entry.sha256;
        });

    return {
        toUpload: toUpload.sort((left, right) => left.objectKey.localeCompare(right.objectKey)),
        // Portrait keys are immutable assets referenced by retained historical
        // bundles. Deletion requires a separate, release-aware GC policy.
        toDelete: [],
    };
}

function resolveContainedObjectPath(dataRoot: string, objectKey: string): string {
    const normalizedKey = objectKey.replace(/\\/g, "/");
    if (!normalizedKey || normalizedKey.startsWith("/") || normalizedKey.split("/").includes("..")) {
        throw new Error(`Unsafe portrait object key: ${objectKey}`);
    }

    const root = resolve(dataRoot);
    const filePath = resolve(root, ...normalizedKey.split("/"));
    const relativePath = relative(root, filePath);
    if (!relativePath || isAbsolute(relativePath) || relativePath === ".." || relativePath.startsWith(`..${sep}`)) {
        throw new Error(`Portrait object key escapes data root: ${objectKey}`);
    }
    return filePath;
}

function parseContentAddressedPortraitKey(
    reference: ReferencedPortrait,
    channel: DatasetPublicationChannel,
    contractLane: DatasetContractLane,
): string | undefined {
    const segments = reference.objectKey.split("/");
    const expectedPrefix = channel === "staging" ? ["staging", contractLane] : [contractLane];
    const isScopedPortrait = segments[0] === "staging" || segments[0] === "v1" || segments[0] === "v2";
    if (!isScopedPortrait) {
        if (reference.layerKind || channel === "staging") {
            throw new Error(`Portrait object key is not channel/lane scoped: ${reference.objectKey}`);
        }
        if (channel === "production" && contractLane === "v1") {
            const contentAddressedV3 = reference.objectKey.match(/^images\/v3\/portrait_[0-9]+\.([a-f0-9]{64})\.png$/);
            if (contentAddressedV3) return contentAddressedV3[1];
        }
        return undefined;
    }

    const prefixMatches = expectedPrefix.every((segment, index) => segments[index] === segment);
    const suffix = segments.slice(expectedPrefix.length);
    if (!prefixMatches || suffix[0] !== "images") {
        throw new Error(
            `Portrait object key does not belong to requested ${channel}/${contractLane}: ${reference.objectKey}`,
        );
    }

    let fileName: string;
    if (reference.layerKind) {
        if (suffix.length !== 4 || suffix[1] !== "v5" || suffix[2] !== "layers") {
            throw new Error(`Malformed ${reference.layerKind} portrait layer key: ${reference.objectKey}`);
        }
        fileName = suffix[3];
        const parts = fileName.split(".");
        if (parts.length !== 3 || parts[0] !== reference.layerKind || parts[2] !== "png") {
            throw new Error(`Malformed ${reference.layerKind} portrait layer key: ${reference.objectKey}`);
        }
    } else {
        if (suffix.length !== 3 || suffix[1] !== "v4") {
            throw new Error(`Malformed content-addressed portrait key: ${reference.objectKey}`);
        }
        fileName = suffix[2];
        const parts = fileName.split(".");
        if (parts.length !== 3 || !/^portrait_[0-9]+$/.test(parts[0]) || parts[2] !== "png") {
            throw new Error(`Malformed content-addressed portrait key: ${reference.objectKey}`);
        }
    }

    const embeddedSha256 = fileName.split(".")[1];
    if (!/^[a-f0-9]{64}$/.test(embeddedSha256)) {
        throw new Error(`Malformed content-addressed portrait SHA-256: ${reference.objectKey}`);
    }
    return embeddedSha256;
}

export async function buildPortraitEntries(
    references: string[] | ReferencedPortrait[],
    dataRoot: string,
    options?: {
        channel?: DatasetPublicationChannel,
        contractLane?: DatasetContractLane,
    },
): Promise<PortraitPublishEntry[]> {
    const entries: PortraitPublishEntry[] = [];
    const normalizedReferences: ReferencedPortrait[] = references.map(reference => typeof reference === "string"
        ? { objectKey: reference }
        : reference);
    const channel = options?.channel ?? "production";
    const contractLane = options?.contractLane ?? "v1";

    for (const reference of normalizedReferences) {
        const { objectKey } = reference;
        const expectedSha256 = parseContentAddressedPortraitKey(reference, channel, contractLane);
        const filePath = resolveContainedObjectPath(dataRoot, objectKey);
        if (!existsSync(filePath)) {
            throw new Error(`Missing portrait file for ${objectKey}: ${filePath}`);
        }

        const sizeBytes = statSync(filePath).size;
        let actualSha256 = expectedSha256;
        if (!actualSha256) {
            const digest = createHash("sha256");
            await new Promise<void>((resolveStream, rejectStream) => {
                const stream = createReadStream(filePath);
                stream.on("data", chunk => digest.update(Buffer.from(chunk)));
                stream.once("error", rejectStream);
                stream.once("end", resolveStream);
            });
            actualSha256 = digest.digest("hex");
        }
        const loadBytes = async () => {
            const bytes = await readFile(filePath);
            const observedSha256 = sha256(bytes);
            if (bytes.byteLength !== sizeBytes || observedSha256 !== actualSha256) {
                throw new Error(
                    `Portrait changed after descriptor creation for ${objectKey}: `
                    + `expected ${sizeBytes}/${actualSha256}, found ${bytes.byteLength}/${observedSha256}.`,
                );
            }
            return bytes;
        };
        entries.push({
            objectKey,
            filePath,
            sha256: actualSha256,
            sizeBytes,
            loadBytes,
        });
    }

    return entries;
}

export function validateLocalCharacterBundle(
    manifest: DatasetManifest,
    gzipBuffer: Buffer,
    options?: {
        channel: DatasetPublicationChannel,
        contractLane: DatasetContractLane,
    },
): Character[] {
    if (manifest.schemaVersion !== 1) {
        throw new Error(`Unsupported Character manifest schema version: ${manifest.schemaVersion}`);
    }
    if (manifest.compression !== "gzip") {
        throw new Error(`Unsupported Character bundle compression: ${manifest.compression}`);
    }
    const expectedFileName = options
        ? canonicalRemoteDatasetObjectKey(manifest, options.channel, options.contractLane)
        : "characters.json.gz";
    if (manifest.fileName !== "characters.json.gz" && manifest.fileName !== expectedFileName) {
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

async function readPublishState(statePath: string): Promise<unknown> {
    if (!existsSync(statePath)) {
        return undefined;
    }
    try {
        return JSON.parse(await readFile(statePath, "utf8")) as unknown;
    } catch {
        // A malformed receipt is never authority. The planner will perform exact
        // body verification and replace it only after a completely successful run.
        return {};
    }
}

async function writePublishState(
    statePath: string,
    state: DatasetPublishStateV2,
): Promise<void> {
    await mkdir(dirname(statePath), { recursive: true });
    const temporaryPath = `${statePath}.${process.pid}.${Date.now()}.tmp`;
    try {
        await writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
        await rename(temporaryPath, statePath);
    } finally {
        await rm(temporaryPath, { force: true });
    }
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

export function isMissingR2ObjectError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return /(?:\b404\b|nosuchkey|specified (?:object )?key does not exist|r2 object [^\r\n]* not found)/i.test(message);
}

export function isRetryableR2ReadError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return /(?:\b429\b|too many requests|rate.?limit|\b50[0234]\b|econnreset|etimedout|fetch failed)/i.test(message);
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

async function tryReadRemoteObject(
    bucket: string,
    target: "remote" | "local",
    objectKey: string,
    label: string,
): Promise<Buffer | undefined> {
    const tempDirectory = await mkdtemp(resolve(tmpdir(), "dokkan-r2-object-"));
    const temporaryPath = resolve(tempDirectory, "object.bin");
    const retryDelaysMilliseconds = [250, 500, 1_000, 2_000];
    try {
        for (let attempt = 0; ; attempt += 1) {
            try {
                await runWranglerCommand([
                    "r2",
                    "object",
                    "get",
                    `${bucket}/${objectKey}`,
                    "--file",
                    temporaryPath,
                    target === "remote" ? "--remote" : "--local",
                ]);
                return await readFile(temporaryPath);
            } catch (error) {
                if (isMissingR2ObjectError(error)) return undefined;
                if (isRetryableR2ReadError(error) && attempt < retryDelaysMilliseconds.length) {
                    await new Promise(resolveDelay => setTimeout(resolveDelay, retryDelaysMilliseconds[attempt]));
                    continue;
                }
                const message = error instanceof Error ? error.message : String(error);
                throw new Error(`Cannot read ${label} ${objectKey}: ${message}`);
            }
        }
    } finally {
        await rm(tempDirectory, { recursive: true, force: true });
    }
}

export function remoteObjectBytesMatch(
    bytes: Buffer | undefined,
    expectedSha256: string,
    expectedSizeBytes: number,
): boolean {
    return Boolean(
        bytes
        && bytes.byteLength === expectedSizeBytes
        && sha256(bytes) === expectedSha256.toLowerCase(),
    );
}

type ReadPublishedPortrait = (entry: PortraitPublishEntry, index: number) => Promise<Buffer | undefined>;

export async function verifyReusablePortraitEntries(
    currentPortraits: PortraitPublishEntry[],
    previousState: DatasetPublishState | undefined,
    readRemote: ReadPublishedPortrait,
    concurrency: number,
): Promise<Record<string, string>> {
    const previousPortraits = previousState?.portraits ?? {};
    const candidates = currentPortraits.filter(entry => {
        const previous = previousPortraits[entry.objectKey];
        return (typeof previous === "string" ? previous : previous?.sha256) === entry.sha256;
    });
    const reusable: Record<string, string> = {};
    await runWithConcurrency(candidates, concurrency, async (entry, index) => {
        const remoteBytes = await readRemote(entry, index);
        if (!remoteBytes || remoteBytes.byteLength !== statSync(entry.filePath).size) return;
        if (sha256(remoteBytes) !== entry.sha256) return;
        reusable[entry.objectKey] = entry.sha256;
    });
    return reusable;
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
    if (!Number.isSafeInteger(concurrency) || concurrency < 1 || concurrency > 64) {
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
    const expectRemoteManifestAbsent = flags.has("--expect-remote-manifest-absent");
    if (expectedRemoteBaselineSha256 && expectRemoteManifestAbsent) {
        throw new Error(
            "--expected-remote-baseline-sha256 cannot be combined with --expect-remote-manifest-absent.",
        );
    }
    if (expectRemoteManifestAbsent && flags.has("--skip-remote-manifest-check")) {
        throw new Error(
            "--expect-remote-manifest-absent cannot be combined with --skip-remote-manifest-check.",
        );
    }
    const channel = parseDatasetPublicationChannel(values.get("--channel"));
    const contractLane = parseDatasetContractLane(values.get("--contract-lane"));
    const verificationOnly = flags.has("--bootstrap-receipt");
    const fullAudit = flags.has("--full-audit") || flags.has("--force-portraits");
    const dryRun = flags.has("--dry-run");
    const promoteProduction = flags.has("--promote-production");
    const target = localFlag ? "local" : "remote";
    if (verificationOnly && (!fullAudit
        || target !== "remote"
        || dryRun
        || flags.has("--skip-remote-manifest-check")
        || promoteProduction
        || Boolean(expectedRemoteBaselineSha256) === expectRemoteManifestAbsent)) {
        throw new Error(
            "--bootstrap-receipt requires remote --full-audit and exactly one baseline pin; "
            + "it cannot use --dry-run, --skip-remote-manifest-check, or --promote-production.",
        );
    }
    const v1ProjectionReportPath = values.get("--v1-projection-report");
    if (contractLane === "v1" && !v1ProjectionReportPath) {
        throw new Error("The v1 contract lane requires --v1-projection-report.");
    }
    if (contractLane !== "v1" && v1ProjectionReportPath) {
        throw new Error("--v1-projection-report can only be used with --contract-lane v1.");
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
        dryRun,
        forcePortraits: flags.has("--force-portraits"),
        skipPortraits: flags.has("--skip-portraits"),
        skipRemoteManifestCheck: flags.has("--skip-remote-manifest-check"),
        expectedRemoteBaselineSha256,
        expectRemoteManifestAbsent,
        target,
        concurrency,
        maxTotalBytes,
        channel,
        contractLane,
        v1ProjectionReportPath: v1ProjectionReportPath ? resolve(v1ProjectionReportPath) : undefined,
        manifestObjectKey: buildCharacterManifestObjectKey(channel, contractLane),
        promoteProduction,
        // --force-portraits is retained as a safe compatibility alias. Immutable
        // portrait keys are never overwritten; forcing now means prove every body.
        fullAudit,
        verificationOnly,
    };
}

function createLocalCharacterObjectStore(bucket: string): CharacterObjectStore {
    const witnesses = new Map<string, { fingerprint: string, etag: string, lastModified: string }>();
    let witnessCounter = 0;
    const read = async (key: string) => {
        const bytes = await tryReadRemoteObject(bucket, "local", key, "local Character object");
        if (!bytes) return undefined;
        const fingerprint = sha256(bytes);
        let witness = witnesses.get(key);
        if (!witness || witness.fingerprint !== fingerprint) {
            witnessCounter += 1;
            witness = {
                fingerprint,
                etag: `local-object-witness-${witnessCounter}`,
                lastModified: new Date(witnessCounter * 1_000).toISOString(),
            };
            witnesses.set(key, witness);
        }
        const isManifest = key.endsWith("characters-manifest.json");
        const isDataset = key.endsWith("characters.json.gz");
        return {
            bytes,
            sizeBytes: bytes.byteLength,
            etag: witness.etag,
            lastModified: witness.lastModified,
            contentType: isManifest ? "application/json" : isDataset ? "application/gzip" : "image/png",
            cacheControl: isManifest ? "no-store" : "public, max-age=31536000, immutable",
        };
    };
    return {
        supportsInventory: false,
        async listPage() {
            throw new Error("Local Wrangler mode does not provide a trusted paginated inventory.");
        },
        get: read,
        async put(key, bytes, contentType, cacheControl, condition) {
            const current = await read(key);
            if ("ifNoneMatch" in condition) {
                if (current) return "precondition-failed";
            } else if (!current || current.etag !== condition.ifMatch) {
                return "precondition-failed";
            }
            const temporaryDirectory = await mkdtemp(resolve(tmpdir(), "dokkan-r2-local-put-"));
            const temporaryPath = resolve(temporaryDirectory, "object.bin");
            try {
                await writeFile(temporaryPath, bytes);
                await uploadObject(bucket, key, temporaryPath, contentType, cacheControl, "local");
                witnesses.delete(key);
                return "written";
            } finally {
                await rm(temporaryDirectory, { recursive: true, force: true });
            }
        },
    };
}

function formatTelemetry(telemetry: PublisherTelemetry): string {
    return `LIST=${telemetry.list} HEAD=${telemetry.head} GET=${telemetry.get} PUT=${telemetry.put} `
        + `retries=${telemetry.retries} bytesRead=${telemetry.bytesRead} bytesPutAttempted=${telemetry.bytesPutAttempted}`;
}

async function publishDataset(options: PublishCliOptions): Promise<PublishSummary> {
    assertDatasetPublicationWriteAuthorized({
        ...options,
        dryRun: options.dryRun || options.verificationOnly,
    });
    if (options.target === "remote" && !options.dryRun && options.skipRemoteManifestCheck) {
        throw new Error(
            "Remote Character publication requires the baseline manifest check; "
            + "--skip-remote-manifest-check is limited to local or read-only dry-run diagnostics.",
        );
    }
    if (
        options.target === "remote"
        && !options.dryRun
        && Boolean(options.expectedRemoteBaselineSha256) === options.expectRemoteManifestAbsent
    ) {
        throw new Error(
            "Remote Character publication requires exactly one baseline pin: "
            + "--expected-remote-baseline-sha256 or --expect-remote-manifest-absent.",
        );
    }
    if (!existsSync(options.manifestPath)) {
        throw new Error(`Manifest not found: ${options.manifestPath}`);
    }

    const localManifest = await readManifest(options.manifestPath);
    const remoteDatasetObjectKey = buildRemoteDatasetObjectKey(
        localManifest,
        options.channel,
        options.contractLane,
    );
    const localDatasetPath = localManifest.fileName === "characters.json.gz"
        ? options.datasetPath
        : resolveContainedObjectPath(options.dataRoot, localManifest.fileName);
    if (!existsSync(localDatasetPath)) {
        throw new Error(`Dataset bundle not found: ${localDatasetPath}`);
    }
    const localGzipBuffer = await readFile(localDatasetPath);
    const characters = validateLocalCharacterBundle(localManifest, localGzipBuffer, {
        channel: options.channel,
        contractLane: options.contractLane,
    });
    if (options.contractLane === "v1") {
        assertCharactersProjectedForAndroidV1(characters);
        await assertAndroidV1PublicationProof(options.v1ProjectionReportPath!, {
            characters: localManifest,
        });
    }
    const remoteManifest: DatasetManifest = {
        ...localManifest,
        fileName: remoteDatasetObjectKey,
    };
    assertPortraitPublicationMode(characters, options.skipPortraits);
    const portraitReferences = collectReferencedPortraitReferences(characters);
    const portraitKeys = portraitReferences.map(reference => reference.objectKey);
    const portraitEntries = options.skipPortraits
        ? []
        : await buildPortraitEntries(portraitReferences, options.dataRoot, {
            channel: options.channel,
            contractLane: options.contractLane,
        });
    const projectedTotalBytes = statSync(localDatasetPath).size
        + manifestByteSize(remoteManifest)
        + portraitEntries.reduce((total, entry) => total + (entry.sizeBytes ?? statSync(entry.filePath).size), 0);

    if (projectedTotalBytes > options.maxTotalBytes) {
        throw new Error(
            `Projected R2 dataset size ${projectedTotalBytes} bytes exceeds the configured limit of ${options.maxTotalBytes} bytes. `
            + "Reduce the dataset or raise the limit explicitly after checking the bucket budget.",
        );
    }

    const verifiedPortraitEntries: VerifiedPortraitEntry[] = portraitEntries.map(entry => {
        if (entry.sizeBytes === undefined || !entry.loadBytes) {
            throw new Error(`Portrait descriptor is incomplete: ${entry.objectKey}`);
        }
        return {
            objectKey: entry.objectKey,
            filePath: entry.filePath,
            sha256: entry.sha256,
            sizeBytes: entry.sizeBytes,
            loadBytes: entry.loadBytes,
        };
    });
    const previousState = await readPublishState(options.statePath);
    const manifestBuffer = Buffer.from(`${JSON.stringify(remoteManifest, null, 2)}\n`, "utf8");
    const store = options.target === "remote"
        ? createRemoteCharacterObjectStore(options.bucket)
        : createLocalCharacterObjectStore(options.bucket);
    let bucketSizeReport: BucketSizeReport | undefined;
    let projectedBucketUpperBoundBytes: number | undefined;
    let planned: VerifiedPublicationPlan | undefined;
    const result = await executeVerifiedCharacterPublication({
        bucket: options.bucket,
        target: options.target,
        channel: options.channel,
        contractLane: options.contractLane,
        manifestObjectKey: options.manifestObjectKey,
        candidateManifest: remoteManifest,
        candidateManifestBytes: manifestBuffer,
        datasetObjectKey: remoteDatasetObjectKey,
        datasetBytes: localGzipBuffer,
        portraits: verifiedPortraitEntries,
        previousState,
        expectedRemoteBaselineSha256: options.expectedRemoteBaselineSha256,
        expectRemoteManifestAbsent: options.expectRemoteManifestAbsent,
        skipRemoteManifestCheck: options.skipRemoteManifestCheck,
        skipPortraits: options.skipPortraits,
        fullAudit: options.fullAudit,
        dryRun: options.dryRun,
        verificationOnly: options.verificationOnly,
        promoteProduction: options.promoteProduction,
        concurrency: options.concurrency,
        writeState: state => writePublishState(options.statePath, state),
        validatePlan: async plan => {
            planned = plan;
            bucketSizeReport = options.target === "remote"
                ? await readRemoteBucketSizeReport(options.bucket)
                : undefined;
            if (bucketSizeReport) {
                assertBucketSizeCanContainVerifiedObjects(
                    bucketSizeReport,
                    projectedTotalBytes,
                    plan.prospectiveUploadBytes,
                );
            }
            projectedBucketUpperBoundBytes = bucketSizeReport
                ? bucketSizeReport.conservativeUpperBoundBytes + plan.prospectiveUploadBytes
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
            console.log(`Receipt trust: ${plan.stateTrust} (${plan.stateReason})`);
            console.log(`Full audit: ${options.fullAudit ? "yes" : "no"}`);
            console.log(`Receipt bootstrap: ${options.verificationOnly ? "yes" : "no"}`);
            console.log(`Dataset upload needed: ${plan.datasetUploadCount ? "yes" : "no"}`);
            console.log(`Manifest upload needed: ${plan.manifestUploadCount ? "yes" : "no"}`);
            console.log(`Portraits referenced: ${plan.portraitReferencedCount}`);
            console.log(`Portraits reused: ${plan.portraitReuseCount}`);
            console.log(`Portrait body GETs: ${plan.portraitFullGetCount}`);
            console.log(`Portraits to upload: ${plan.portraitUploadCount}`);
            console.log(`Portrait conflicts: ${plan.portraitConflictCount}`);
            console.log("Portraits to delete: 0");
            console.log(`Projected managed size: ${projectedTotalBytes}/${options.maxTotalBytes} bytes`);
            if (bucketSizeReport && projectedBucketUpperBoundBytes !== undefined) {
                console.log(
                    `Wrangler bucket size: ${bucketSizeReport.reported}; conservative projected upper bound: `
                    + `${projectedBucketUpperBoundBytes}/${options.maxTotalBytes} bytes`,
                );
            }
            console.log(`Preflight operations: ${formatTelemetry(plan.telemetry)}`);
        },
    }, store);
    const finalPlan = result.plan ?? planned!;
    console.log(`Final operations: ${formatTelemetry(finalPlan.telemetry)}`);
    for (const [reason, count] of Object.entries(finalPlan.telemetry.reasons).sort(([left], [right]) => left.localeCompare(right))) {
        console.log(`Operation reason ${reason}: ${count}`);
    }
    const datasetNeedsUpload = finalPlan.datasetUploadCount > 0;
    return {
        datasetNeedsUpload,
        portraitUploadCount: finalPlan.portraitUploadCount,
        portraitDeleteCount: 0,
        skippedBecauseRemoteMatches: !datasetNeedsUpload && finalPlan.portraitUploadCount === 0,
        projectedTotalBytes,
        telemetry: finalPlan.telemetry,
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
