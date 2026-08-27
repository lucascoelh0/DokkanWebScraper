import { createHash } from "crypto";
import { execFile } from "child_process";
import { existsSync, statSync } from "fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "fs/promises";
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

const DEFAULT_DATA_ROOT = "data";
const DEFAULT_IMAGES_ROOT = "data/images";
const DEFAULT_DATASET_PATH = "data/latest/characters.json.gz";
const DEFAULT_MANIFEST_PATH = "data/latest/characters-manifest.json";
const DEFAULT_STATE_PATH = "data/latest/r2-publish-state.json";
const DEFAULT_CONCURRENCY = 6;
const DEFAULT_MAX_TOTAL_BYTES = 10_000_000_000;
const UPLOAD_VERIFICATION_RETRY_DELAYS_MS = [1_000, 2_000, 4_000, 8_000, 15_000] as const;
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
    expectRemoteManifestAbsent: boolean,
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

function canonicalRemoteDatasetObjectKey(
    manifest: Pick<DatasetManifest, "datasetVersion" | "sha256">,
    channel: DatasetPublicationChannel,
    contractLane: DatasetContractLane,
): string {
    return contractLaneObjectKey(
        channel,
        contractLane,
        `releases/${datasetVersionSlug(manifest.datasetVersion)}/${manifest.sha256.toLowerCase()}/characters.json.gz`,
    );
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
        : currentPortraits.filter(entry => previousPortraits[entry.objectKey] !== entry.sha256);

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

        const fileBuffer = await readFile(filePath);
        const actualSha256 = sha256(fileBuffer);
        if (expectedSha256 && actualSha256 !== expectedSha256) {
            throw new Error(
                `Portrait SHA-256 mismatch for ${objectKey}: expected ${expectedSha256}, found ${actualSha256}.`,
            );
        }
        entries.push({
            objectKey,
            filePath,
            sha256: actualSha256,
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

async function readPublishState(
    statePath: string,
    bucket: string,
    target: "remote" | "local",
    channel: DatasetPublicationChannel,
    contractLane: DatasetContractLane,
): Promise<DatasetPublishState | undefined> {
    if (!existsSync(statePath)) {
        return undefined;
    }

    const state = JSON.parse(await readFile(statePath, "utf8")) as DatasetPublishState;
    if (state.bucket !== bucket || state.target !== target) {
        throw new Error(
            `Character publish state belongs to ${state.bucket}/${state.target}, not requested ${bucket}/${target}.`,
        );
    }
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

async function tryReadRemoteManifest(
    bucket: string,
    target: "remote" | "local",
    manifestObjectKey: string,
): Promise<DatasetManifest | undefined> {
    const bytes = await tryReadRemoteObject(
        bucket,
        target,
        manifestObjectKey,
        "Character remote manifest",
    );
    if (!bytes) return undefined;
    try {
        const value = JSON.parse(bytes.toString("utf8")) as unknown;
        if (!value || typeof value !== "object" || Array.isArray(value)) {
            throw new Error("expected a JSON object");
        }
        return value as DatasetManifest;
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Character remote manifest ${manifestObjectKey} is not valid JSON: ${message}`);
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

async function remoteObjectMatches(
    bucket: string,
    target: "remote" | "local",
    objectKey: string,
    expectedSha256: string,
    expectedSizeBytes: number,
    label: string,
): Promise<boolean> {
    const bytes = await tryReadRemoteObject(bucket, target, objectKey, label);
    return remoteObjectBytesMatch(bytes, expectedSha256, expectedSizeBytes);
}

async function assertRemoteObjectMatches(
    bucket: string,
    target: "remote" | "local",
    objectKey: string,
    expectedSha256: string,
    expectedSizeBytes: number,
    label: string,
): Promise<void> {
    if (await remoteObjectMatches(
        bucket,
        target,
        objectKey,
        expectedSha256,
        expectedSizeBytes,
        label,
    )) return;
    for (const delayMilliseconds of UPLOAD_VERIFICATION_RETRY_DELAYS_MS) {
        await new Promise(resolveDelay => setTimeout(resolveDelay, delayMilliseconds));
        if (await remoteObjectMatches(
            bucket,
            target,
            objectKey,
            expectedSha256,
            expectedSizeBytes,
            label,
        )) return;
    }
    throw new Error(`${label} failed size/SHA-256 verification: ${objectKey}`);
}

type ReadPublishedPortrait = (entry: PortraitPublishEntry, index: number) => Promise<Buffer | undefined>;

async function readPublishedPortrait(
    bucket: string,
    target: "remote" | "local",
    temporaryDirectory: string,
    entry: PortraitPublishEntry,
    index: number,
    retryMissing = false,
): Promise<Buffer | undefined> {
    const temporaryPath = resolve(temporaryDirectory, `${index}.png`);
    const retryDelaysMilliseconds = [250, 500, 1_000, 2_000];
    for (let attempt = 0; ; attempt += 1) {
        try {
            await runWranglerCommand([
                "r2",
                "object",
                "get",
                `${bucket}/${entry.objectKey}`,
                "--file",
                temporaryPath,
                target === "remote" ? "--remote" : "--local",
            ]);
            break;
        } catch (error) {
            if (isMissingR2ObjectError(error)) {
                if (retryMissing && attempt < retryDelaysMilliseconds.length) {
                    await new Promise(resolveDelay => setTimeout(resolveDelay, retryDelaysMilliseconds[attempt]));
                    continue;
                }
                return undefined;
            }
            if (isRetryableR2ReadError(error) && attempt < retryDelaysMilliseconds.length) {
                await new Promise(resolveDelay => setTimeout(resolveDelay, retryDelaysMilliseconds[attempt]));
                continue;
            }
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Cannot verify published portrait ${entry.objectKey}: ${message}`);
        }
    }
    return readFile(temporaryPath);
}

export async function verifyReusablePortraitEntries(
    currentPortraits: PortraitPublishEntry[],
    previousState: DatasetPublishState | undefined,
    readRemote: ReadPublishedPortrait,
    concurrency: number,
): Promise<Record<string, string>> {
    const previousPortraits = previousState?.portraits ?? {};
    const candidates = currentPortraits.filter(entry => previousPortraits[entry.objectKey] === entry.sha256);
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
        dryRun: flags.has("--dry-run"),
        forcePortraits: flags.has("--force-portraits"),
        skipPortraits: flags.has("--skip-portraits"),
        skipRemoteManifestCheck: flags.has("--skip-remote-manifest-check"),
        expectedRemoteBaselineSha256,
        expectRemoteManifestAbsent,
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
    return canonicalJson(left) === canonicalJson(right);
}

function canonicalJson(value: unknown): string {
    if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
    if (value && typeof value === "object") {
        const record = value as Record<string, unknown>;
        return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
    }
    return JSON.stringify(value);
}

async function publishDataset(options: PublishCliOptions): Promise<PublishSummary> {
    assertDatasetPublicationWriteAuthorized(options);
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
    const previousState = await readPublishState(
        options.statePath,
        options.bucket,
        options.target,
        options.channel,
        options.contractLane,
    );
    const publishedRemoteManifest = options.skipRemoteManifestCheck
        ? undefined
        : await tryReadRemoteManifest(options.bucket, options.target, options.manifestObjectKey);
    assertExpectedRemoteManifestBaseline(
        options.expectedRemoteBaselineSha256,
        options.expectRemoteManifestAbsent,
        publishedRemoteManifest,
    );
    const publishedDatasetMatches = manifestsMatch(remoteManifest, publishedRemoteManifest)
        && await remoteObjectMatches(
            options.bucket,
            options.target,
            remoteDatasetObjectKey,
            remoteManifest.sha256,
            remoteManifest.sizeBytes,
            "Character remote payload",
        );
    const datasetNeedsUpload = !publishedDatasetMatches;
    const skippedBecauseRemoteMatches = !datasetNeedsUpload && !options.forcePortraits && !options.skipPortraits;

    const portraitEntries = options.skipPortraits
        ? []
        : await buildPortraitEntries(portraitReferences, options.dataRoot, {
            channel: options.channel,
            contractLane: options.contractLane,
        });
    let verifiedPortraitState = previousState;
    if (!options.skipPortraits && !options.forcePortraits && previousState) {
        const temporaryDirectory = await mkdtemp(resolve(tmpdir(), "dokkan-r2-portrait-verify-"));
        try {
            const reusablePortraits = await verifyReusablePortraitEntries(
                portraitEntries,
                previousState,
                (entry, index) => readPublishedPortrait(
                    options.bucket,
                    options.target,
                    temporaryDirectory,
                    entry,
                    index,
                ),
                options.concurrency,
            );
            verifiedPortraitState = { ...previousState, portraits: reusablePortraits };
        } finally {
            await rm(temporaryDirectory, {
                recursive: true,
                force: true,
                maxRetries: 10,
                retryDelay: 100,
            });
        }
    }
    const portraitPlan = options.skipPortraits
        ? { toUpload: [], toDelete: [] }
        : buildPortraitPublishPlan(portraitEntries, verifiedPortraitState, { forcePortraits: options.forcePortraits });
    const projectedTotalBytes = statSync(localDatasetPath).size
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
    if (options.expectRemoteManifestAbsent) {
        console.log("Expected remote baseline: manifest absent");
    } else if (options.expectedRemoteBaselineSha256) {
        console.log(`Expected remote baseline SHA-256: ${options.expectedRemoteBaselineSha256}`);
    }
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
            localDatasetPath,
            "application/gzip",
            "public, max-age=31536000, immutable",
            options.target,
        );
    }

    if (portraitPlan.toUpload.length > 0) {
        console.log("Uploading and verifying portraits...");
        const temporaryDirectory = await mkdtemp(resolve(tmpdir(), "dokkan-r2-portrait-upload-verify-"));
        try {
            await runWithConcurrency(portraitPlan.toUpload, options.concurrency, async (entry, index) => {
                await uploadObject(
                    options.bucket,
                    entry.objectKey,
                    entry.filePath,
                    "image/png",
                    "public, max-age=31536000, immutable",
                    options.target,
                );
                const remoteBytes = await readPublishedPortrait(
                    options.bucket,
                    options.target,
                    temporaryDirectory,
                    entry,
                    index,
                    true,
                );
                if (!remoteObjectBytesMatch(remoteBytes, entry.sha256, statSync(entry.filePath).size)) {
                    throw new Error(`Uploaded portrait failed size/SHA-256 verification: ${entry.objectKey}`);
                }

                if ((index + 1) % 25 === 0 || index + 1 === portraitPlan.toUpload.length) {
                    console.log(`Uploaded and verified ${index + 1}/${portraitPlan.toUpload.length} portrait(s)`);
                }
            });
        } finally {
            await rm(temporaryDirectory, {
                recursive: true,
                force: true,
                maxRetries: 10,
                retryDelay: 100,
            });
        }
    }

    if (datasetNeedsUpload) {
        console.log("Uploading manifest...");
        await assertRemoteObjectMatches(
            options.bucket,
            options.target,
            remoteDatasetObjectKey,
            remoteManifest.sha256,
            remoteManifest.sizeBytes,
            "Uploaded Character payload",
        );
        const manifestTempDirectory = await mkdtemp(resolve(tmpdir(), "dokkan-r2-publish-manifest-"));
        const manifestTempPath = resolve(manifestTempDirectory, "characters-manifest.json");
        const manifestBuffer = Buffer.from(`${JSON.stringify(remoteManifest, null, 2)}\n`, "utf8");
        try {
            await writeFile(manifestTempPath, manifestBuffer);
            await uploadObject(
                options.bucket,
                options.manifestObjectKey,
                manifestTempPath,
                "application/json",
                "no-store",
                options.target,
            );
            await assertRemoteObjectMatches(
                options.bucket,
                options.target,
                options.manifestObjectKey,
                sha256(manifestBuffer),
                manifestBuffer.byteLength,
                "Uploaded Character manifest",
            );
        } finally {
            await rm(manifestTempDirectory, { recursive: true, force: true });
        }
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
