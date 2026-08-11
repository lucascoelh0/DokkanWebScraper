import { createHash } from "crypto";
import { constants } from "fs";
import { lstat, mkdir, open, readFile, realpath, rm, stat } from "fs/promises";
import { basename, join, relative, resolve, sep } from "path";
import { gunzipSync } from "zlib";
import type { Character } from "./character";
import { resolveContainedArtifactPath } from "./artifact-path";
import type { DatasetManifest } from "./dataset-artifacts";
import { DatabaseCharacterArtifactPathError } from "./database-characters/artifact-path";
import { validateCharacterCompactArtifact } from "./database-characters/compact-validator";
import {
    FYI_CHARACTER_CANDIDATE_DIRECTORY,
    FYI_CHARACTER_CANDIDATE_READY_FILE,
    FYI_CHARACTER_K15_DIRECTORY,
    formattedJsonBytes,
    resolveFyiCandidateDirectory,
    resolveFyiK15Directory,
} from "./fyi-character-candidate";
import {
    compareFyiCharacterCandidate,
    FyiCharacterCandidateReadinessReport,
} from "./fyi-character-candidate-readiness";

export const FYI_CHARACTER_RELEASE_ROOT = "releases-k21";
export const FYI_CHARACTER_RELEASE_REPORT = "release-k21.json";
export const FYI_CHARACTER_RELEASE_PLAN = "release-plan-k22.json";
export const FYI_CHARACTER_RELEASE_RECEIPT = "release-receipt-k23.json";
export const FYI_CHARACTER_RELEASE_READY = ".release-k21-ready.json";
export const FYI_CHARACTER_RELEASE_K20 = "candidate-readiness-k20.json";
export const FYI_CHARACTER_RELEASE_SOURCE_MARKER = "candidate-k19-ready.source.json";
export const FYI_CHARACTER_RELEASE_MAX_BYTES = 50_000_000;
export const FYI_CHARACTER_BUCKET_MAX_BYTES = 10_000_000_000;

const sha256 = (value: Buffer | string) => createHash("sha256").update(value).digest("hex");
const JSON_BYTES = (value: unknown) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
const PORTRAIT_KEY = /^images\/v2\/portrait_\d+\.png$/;
const RELEASE_ID = /^[a-f0-9]{64}-[a-f0-9]{64}$/;

export interface FyiCharacterReleasePortrait {
    objectKey: string;
    fileName: string;
    sha256: string;
    sizeBytes: number;
}

export interface FyiCharacterReleaseK21 {
    schemaVersion: 1;
    contract: "dokkan-fyi-character-release-k21";
    contractVersion: "1.0.0";
    generatedAt: string;
    releaseId: string;
    source: {
        candidateDirectory: typeof FYI_CHARACTER_CANDIDATE_DIRECTORY;
        candidateReadyMarkerSha256: string;
        k20Contract: FyiCharacterCandidateReadinessReport["contract"];
        k20ContractVersion: FyiCharacterCandidateReadinessReport["contractVersion"];
        k20ReadinessSha256: string;
    };
    dataset: DatasetManifest & { localFileName: "characters.json.gz" };
    portraits: {
        directory: "portraits";
        count: number;
        totalBytes: number;
        inventorySha256: string;
        entries: FyiCharacterReleasePortrait[];
    };
    safety: {
        contentAddressedRelease: true;
        candidateValidatedByK20: true;
        writesLatest: false;
        importsPublisherOrWrangler: false;
        mutatesAndroid: false;
        mutatesR2: false;
    };
    readiness: {
        materialization: "GO";
        remotePreflight: "NO-GO";
        publication: "NO-GO";
        production: "NO-GO";
        android: "NO-GO";
        r2: "NO-GO";
    };
}

export interface FyiCharacterReleaseObjectPlan {
    kind: "payload" | "manifest" | "portrait";
    localPath: string;
    objectKey: string;
    sha256: string;
    sizeBytes: number;
    cacheControl: "public, max-age=31536000, immutable" | "no-store";
    remoteHashProofRequired: boolean;
}

export interface FyiCharacterReleaseK22 {
    schemaVersion: 1;
    contract: "dokkan-fyi-character-release-plan-k22";
    contractVersion: "1.0.0";
    generatedAt: string;
    releaseId: string;
    releaseReportSha256: string;
    remoteManifest: DatasetManifest;
    objects: FyiCharacterReleaseObjectPlan[];
    budget: {
        namespaceLimitBytes: number;
        bucketLimitBytes: number;
        worstCaseNewBytes: number;
        withinNamespaceLimit: boolean;
        withinBucketLimit: null;
        remoteBucketBytes: null;
    };
    stablePortraitKeys: {
        count: number;
        requireRemoteHashProofBeforeUpload: true;
        immutableCacheRiskAcknowledged: true;
    };
    readiness: {
        localPlan: "GO";
        remoteInventory: "NO-GO";
        publication: "NO-GO";
        production: "NO-GO";
        android: "NO-GO";
        r2: "NO-GO";
    };
}

export interface FyiCharacterReleaseK23 {
    schemaVersion: 1;
    contract: "dokkan-fyi-character-release-receipt-k23";
    contractVersion: "1.0.0";
    generatedAt: string;
    releaseId: string;
    releaseReportSha256: string;
    planSha256: string;
    objectCount: number;
    worstCaseNewBytes: number;
    checks: {
        releaseMarkerValid: true;
        releaseInventoryValid: true;
        localPlanValid: true;
        localNamespaceBudgetWithinLimit: true;
        remoteBucketBudgetAwaitingPreflight: true;
        noNetworkCodeInvoked: true;
        noLatestWritten: true;
        noRemoteMutation: true;
    };
    readiness: {
        localReleaseBundle: "GO";
        remoteDryRun: "NO-GO";
        publication: "NO-GO";
        production: "NO-GO";
        android: "NO-GO";
        r2: "NO-GO";
    };
}

export interface FyiCharacterReleasePipelineResult {
    releaseDirectory: string;
    release: FyiCharacterReleaseK21;
    plan: FyiCharacterReleaseK22;
    receipt: FyiCharacterReleaseK23;
}

export interface ValidatedFyiCharacterRelease {
    releaseDirectory: string;
    release: FyiCharacterReleaseK21;
    plan: FyiCharacterReleaseK22;
    receipt: FyiCharacterReleaseK23;
    payload: Buffer;
}

function assertReleaseId(value: string): void {
    if (!RELEASE_ID.test(value)) throw new Error("K21 release ID rejected");
}

function assertContained(root: string, path: string): void {
    const remainder = relative(root, path);
    if (remainder === "" || remainder === ".." || remainder.startsWith(`..${sep}`)) {
        if (remainder !== "") throw new Error("release path escaped root");
        return;
    }
    if (resolve(root, remainder) !== path) throw new Error("release path escaped root");
}

async function readContainedFile(root: string, untrustedPath: string): Promise<Buffer> {
    const path = await resolveContainedArtifactPath(
        { trustedRoot: root, untrustedPath, expectedType: "file" },
        (code, artifactType) => new DatabaseCharacterArtifactPathError(code, artifactType),
    );
    return readFile(path);
}

function collectPortraitKeys(value: unknown, result = new Set<string>()): Set<string> {
    if (Array.isArray(value)) {
        for (const item of value) collectPortraitKeys(item, result);
        return result;
    }
    if (!value || typeof value !== "object") return result;
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
        if (key === "portraitURL" && typeof nested === "string" && nested.length > 0) {
            if (!PORTRAIT_KEY.test(nested)) throw new Error(`K21 portrait object key rejected: ${nested}`);
            result.add(nested);
        } else {
            collectPortraitKeys(nested, result);
        }
    }
    return result;
}

function decodeCharacters(gzip: Buffer, manifest: DatasetManifest): Character[] {
    if (manifest.schemaVersion !== 1 || manifest.compression !== "gzip" || manifest.fileName !== "characters.json.gz") {
        throw new Error("K21 character manifest contract rejected");
    }
    if (sha256(gzip) !== manifest.sha256 || gzip.length !== manifest.sizeBytes) throw new Error("K21 character payload hash rejected");
    const raw = gunzipSync(gzip);
    if (raw.length !== manifest.uncompressedSizeBytes) throw new Error("K21 character raw size rejected");
    const parsed = JSON.parse(raw.toString("utf8"));
    if (!Array.isArray(parsed) || parsed.length !== manifest.characterCount) throw new Error("K21 character count rejected");
    return parsed as Character[];
}

export function buildFyiCharacterReleaseK21(input: {
    candidateGzip: Buffer;
    candidateManifest: DatasetManifest;
    candidateReadyMarker: Buffer;
    k20: FyiCharacterCandidateReadinessReport;
    portraits: FyiCharacterReleasePortrait[];
}): FyiCharacterReleaseK21 {
    if (input.k20.schemaVersion !== 1
        || input.k20.contract !== "dokkan-fyi-character-database-candidate-readiness-k20"
        || input.k20.contractVersion !== "1.0.0"
        || input.k20.generatedAt !== input.candidateManifest.generatedAt
        || input.k20.readiness.candidateGenerationValidation !== "GO"
        || input.k20.failures.total !== 0
        || Object.values(input.k20.checks ?? {}).some(check => check !== true)) {
        throw new Error("K21 requires a clean K20 GO");
    }
    const candidateLineage = input.k20.sources?.candidate as any;
    if (!candidateLineage || candidateLineage.datasetVersion !== input.candidateManifest.datasetVersion
        || candidateLineage.generatedAt !== input.candidateManifest.generatedAt
        || candidateLineage.payloadFile !== "characters.json.gz"
        || candidateLineage.payloadSha256 !== input.candidateManifest.sha256
        || candidateLineage.payloadSizeBytes !== input.candidateManifest.sizeBytes
        || candidateLineage.uncompressedSizeBytes !== input.candidateManifest.uncompressedSizeBytes
        || candidateLineage.characterCount !== input.candidateManifest.characterCount) {
        throw new Error("K21 K20 candidate lineage rejected");
    }
    const characters = decodeCharacters(input.candidateGzip, input.candidateManifest);
    const referenced = [...collectPortraitKeys(characters)].sort();
    const entries = [...input.portraits].sort((left, right) => left.objectKey.localeCompare(right.objectKey));
    if (new Set(entries.map(entry => entry.objectKey)).size !== entries.length) throw new Error("K21 duplicate portrait entry");
    if (JSON.stringify(referenced) !== JSON.stringify(entries.map(entry => entry.objectKey))) throw new Error("K21 portrait inventory mismatch");
    for (const entry of entries) {
        if (!PORTRAIT_KEY.test(entry.objectKey) || entry.fileName !== basename(entry.objectKey)
            || !/^[a-f0-9]{64}$/.test(entry.sha256) || !Number.isSafeInteger(entry.sizeBytes) || entry.sizeBytes <= 0) {
            throw new Error("K21 portrait entry rejected");
        }
    }
    const inventorySha256 = sha256(JSON_BYTES(entries));
    const k20Bytes = JSON_BYTES(input.k20);
    const bundleIdentitySha256 = sha256(JSON_BYTES({
        candidateManifestSha256: sha256(JSON_BYTES(input.candidateManifest)),
        candidateReadyMarkerSha256: sha256(input.candidateReadyMarker),
        k20ReadinessSha256: sha256(k20Bytes),
        portraitInventorySha256: inventorySha256,
    }));
    const releaseId = `${input.candidateManifest.sha256}-${bundleIdentitySha256}`;
    assertReleaseId(releaseId);
    return {
        schemaVersion: 1,
        contract: "dokkan-fyi-character-release-k21",
        contractVersion: "1.0.0",
        generatedAt: input.candidateManifest.generatedAt,
        releaseId,
        source: {
            candidateDirectory: FYI_CHARACTER_CANDIDATE_DIRECTORY,
            candidateReadyMarkerSha256: sha256(input.candidateReadyMarker),
            k20Contract: input.k20.contract,
            k20ContractVersion: input.k20.contractVersion,
            k20ReadinessSha256: sha256(k20Bytes),
        },
        dataset: { ...input.candidateManifest, localFileName: "characters.json.gz" },
        portraits: {
            directory: "portraits",
            count: entries.length,
            totalBytes: entries.reduce((total, entry) => total + entry.sizeBytes, 0),
            inventorySha256,
            entries,
        },
        safety: {
            contentAddressedRelease: true,
            candidateValidatedByK20: true,
            writesLatest: false,
            importsPublisherOrWrangler: false,
            mutatesAndroid: false,
            mutatesR2: false,
        },
        readiness: {
            materialization: "GO", remotePreflight: "NO-GO", publication: "NO-GO",
            production: "NO-GO", android: "NO-GO", r2: "NO-GO",
        },
    };
}

function versionSlug(value: string): string {
    const slug = value.trim().replace(/:/g, "-").replace(/[^\w.-]/g, "_");
    if (!slug || slug.includes("..")) throw new Error("K22 dataset version rejected");
    return slug;
}

export function buildFyiCharacterReleaseK22(release: FyiCharacterReleaseK21): FyiCharacterReleaseK22 {
    assertReleaseId(release.releaseId);
    if (release.readiness.materialization !== "GO" || !release.safety.contentAddressedRelease
        || release.portraits.inventorySha256 !== sha256(JSON_BYTES(release.portraits.entries))) {
        throw new Error("K22 release report rejected");
    }
    const payloadObjectKey = `releases/${versionSlug(release.dataset.datasetVersion)}/${release.dataset.sha256}/characters.json.gz`;
    const remoteManifest: DatasetManifest = { ...release.dataset, fileName: payloadObjectKey };
    delete (remoteManifest as any).localFileName;
    const manifestBytes = JSON_BYTES(remoteManifest);
    const objects: FyiCharacterReleaseObjectPlan[] = [
        {
            kind: "payload", localPath: "characters.json.gz", objectKey: payloadObjectKey,
            sha256: release.dataset.sha256, sizeBytes: release.dataset.sizeBytes,
            cacheControl: "public, max-age=31536000, immutable", remoteHashProofRequired: false,
        },
        ...release.portraits.entries.map(entry => ({
            kind: "portrait" as const, localPath: `portraits/${entry.fileName}`, objectKey: entry.objectKey,
            sha256: entry.sha256, sizeBytes: entry.sizeBytes,
            cacheControl: "public, max-age=31536000, immutable" as const, remoteHashProofRequired: true,
        })),
        {
            kind: "manifest", localPath: "characters-manifest.remote.json", objectKey: "characters-manifest.json",
            sha256: sha256(manifestBytes), sizeBytes: manifestBytes.length,
            cacheControl: "no-store", remoteHashProofRequired: false,
        },
    ];
    const worstCaseNewBytes = objects.reduce((total, object) => total + object.sizeBytes, 0);
    if (new Set(objects.map(object => object.objectKey)).size !== objects.length) throw new Error("K22 duplicate object key");
    if (worstCaseNewBytes > FYI_CHARACTER_RELEASE_MAX_BYTES || worstCaseNewBytes > FYI_CHARACTER_BUCKET_MAX_BYTES) {
        throw new Error("K22 release budget exceeded");
    }
    return {
        schemaVersion: 1,
        contract: "dokkan-fyi-character-release-plan-k22",
        contractVersion: "1.0.0",
        generatedAt: release.generatedAt,
        releaseId: release.releaseId,
        releaseReportSha256: sha256(JSON_BYTES(release)),
        remoteManifest,
        objects,
        budget: {
            namespaceLimitBytes: FYI_CHARACTER_RELEASE_MAX_BYTES,
            bucketLimitBytes: FYI_CHARACTER_BUCKET_MAX_BYTES,
            worstCaseNewBytes,
            withinNamespaceLimit: true,
            withinBucketLimit: null,
            remoteBucketBytes: null,
        },
        stablePortraitKeys: {
            count: release.portraits.count,
            requireRemoteHashProofBeforeUpload: true,
            immutableCacheRiskAcknowledged: true,
        },
        readiness: {
            localPlan: "GO", remoteInventory: "NO-GO", publication: "NO-GO",
            production: "NO-GO", android: "NO-GO", r2: "NO-GO",
        },
    };
}

export function buildFyiCharacterReleaseK23(release: FyiCharacterReleaseK21, plan: FyiCharacterReleaseK22): FyiCharacterReleaseK23 {
    const releaseHash = sha256(JSON_BYTES(release));
    if (plan.releaseId !== release.releaseId || plan.releaseReportSha256 !== releaseHash
        || plan.readiness.localPlan !== "GO" || !plan.budget.withinNamespaceLimit || plan.budget.withinBucketLimit !== null
        || plan.stablePortraitKeys.requireRemoteHashProofBeforeUpload !== true
        || plan.readiness.remoteInventory !== "NO-GO"
        || plan.readiness.publication !== "NO-GO" || plan.readiness.r2 !== "NO-GO"
        || JSON.stringify(plan) !== JSON.stringify(buildFyiCharacterReleaseK22(release))) {
        throw new Error("K23 plan rejected");
    }
    return {
        schemaVersion: 1,
        contract: "dokkan-fyi-character-release-receipt-k23",
        contractVersion: "1.0.0",
        generatedAt: release.generatedAt,
        releaseId: release.releaseId,
        releaseReportSha256: releaseHash,
        planSha256: sha256(JSON_BYTES(plan)),
        objectCount: plan.objects.length,
        worstCaseNewBytes: plan.budget.worstCaseNewBytes,
        checks: {
            releaseMarkerValid: true,
            releaseInventoryValid: true,
            localPlanValid: true,
            localNamespaceBudgetWithinLimit: true,
            remoteBucketBudgetAwaitingPreflight: true,
            noNetworkCodeInvoked: true,
            noLatestWritten: true,
            noRemoteMutation: true,
        },
        readiness: {
            localReleaseBundle: "GO", remoteDryRun: "NO-GO", publication: "NO-GO",
            production: "NO-GO", android: "NO-GO", r2: "NO-GO",
        },
    };
}

async function writeExclusive(path: string, bytes: Buffer): Promise<void> {
    const handle = await open(path, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | (constants.O_NOFOLLOW ?? 0), 0o600);
    try {
        await handle.writeFile(bytes);
        await handle.sync();
        const metadata = await handle.stat();
        if (!metadata.isFile() || metadata.nlink !== 1 || metadata.size !== bytes.length) {
            throw new Error("K21 staged file identity rejected");
        }
    } finally {
        await handle.close();
    }
}

interface OwnedDirectoryIdentity {
    path: string;
    dev: number;
    ino: number;
}

async function captureOwnedDirectory(path: string): Promise<OwnedDirectoryIdentity> {
    const metadata = await lstat(path);
    if (!metadata.isDirectory() || metadata.isSymbolicLink() || await realpath(path) !== path) {
        throw new Error("K21 owned directory rejected");
    }
    return { path, dev: metadata.dev, ino: metadata.ino };
}

async function assertOwnedDirectory(identity: OwnedDirectoryIdentity): Promise<void> {
    const metadata = await lstat(identity.path);
    if (!metadata.isDirectory() || metadata.isSymbolicLink() || metadata.dev !== identity.dev
        || metadata.ino !== identity.ino || await realpath(identity.path) !== identity.path) {
        throw new Error("K21 owned directory identity changed");
    }
}

async function writeOwnedFile(identity: OwnedDirectoryIdentity, fileName: string, bytes: Buffer): Promise<void> {
    if (basename(fileName) !== fileName) throw new Error("K21 owned filename rejected");
    await assertOwnedDirectory(identity);
    await writeExclusive(join(identity.path, fileName), bytes);
    await assertOwnedDirectory(identity);
}

function releaseMarker(release: FyiCharacterReleaseK21, plan: FyiCharacterReleaseK22, receipt: FyiCharacterReleaseK23) {
    return {
        schemaVersion: 1,
        contract: "dokkan-fyi-character-release-ready-k21-k23",
        contractVersion: "1.0.0",
        releaseId: release.releaseId,
        files: {
            [FYI_CHARACTER_RELEASE_REPORT]: sha256(JSON_BYTES(release)),
            [FYI_CHARACTER_RELEASE_PLAN]: sha256(JSON_BYTES(plan)),
            [FYI_CHARACTER_RELEASE_RECEIPT]: sha256(JSON_BYTES(receipt)),
            [FYI_CHARACTER_RELEASE_K20]: release.source.k20ReadinessSha256,
            [FYI_CHARACTER_RELEASE_SOURCE_MARKER]: release.source.candidateReadyMarkerSha256,
            "characters.json.gz": release.dataset.sha256,
            "characters-manifest.json": sha256(localCharacterManifestBytes(release)),
            "characters-manifest.remote.json": sha256(JSON_BYTES(plan.remoteManifest)),
        },
        portraitInventorySha256: release.portraits.inventorySha256,
    };
}

function localCharacterManifestBytes(release: FyiCharacterReleaseK21): Buffer {
    const manifest = { ...release.dataset } as any;
    delete manifest.localFileName;
    return JSON_BYTES(manifest);
}

async function verifyReleaseContents(releaseDirectory: string, expected: FyiCharacterReleasePipelineResult, sourceMarker: Buffer, k20: FyiCharacterCandidateReadinessReport): Promise<void> {
    const [releaseBytes, planBytes, receiptBytes, payloadBytes, localManifestBytes, remoteManifestBytes, k20Bytes, sourceMarkerBytes] = await Promise.all([
        readContainedFile(releaseDirectory, FYI_CHARACTER_RELEASE_REPORT),
        readContainedFile(releaseDirectory, FYI_CHARACTER_RELEASE_PLAN),
        readContainedFile(releaseDirectory, FYI_CHARACTER_RELEASE_RECEIPT),
        readContainedFile(releaseDirectory, "characters.json.gz"),
        readContainedFile(releaseDirectory, "characters-manifest.json"),
        readContainedFile(releaseDirectory, "characters-manifest.remote.json"),
        readContainedFile(releaseDirectory, FYI_CHARACTER_RELEASE_K20),
        readContainedFile(releaseDirectory, FYI_CHARACTER_RELEASE_SOURCE_MARKER),
    ]);
    if (!releaseBytes.equals(JSON_BYTES(expected.release)) || !planBytes.equals(JSON_BYTES(expected.plan))
        || !receiptBytes.equals(JSON_BYTES(expected.receipt)) || sha256(payloadBytes) !== expected.release.dataset.sha256
        || !localManifestBytes.equals(localCharacterManifestBytes(expected.release))
        || !remoteManifestBytes.equals(JSON_BYTES(expected.plan.remoteManifest))
        || !k20Bytes.equals(JSON_BYTES(k20)) || !sourceMarkerBytes.equals(sourceMarker)) {
        throw new Error("K21 existing release differs from requested content");
    }
    for (const portrait of expected.release.portraits.entries) {
        const bytes = await readContainedFile(releaseDirectory, `portraits/${portrait.fileName}`);
        if (bytes.length !== portrait.sizeBytes || sha256(bytes) !== portrait.sha256) {
            throw new Error("K21 existing portrait differs from requested content");
        }
    }
}

async function verifyReleaseDirectory(releaseDirectory: string, expected: FyiCharacterReleasePipelineResult, sourceMarker: Buffer, k20: FyiCharacterCandidateReadinessReport): Promise<void> {
    await verifyReleaseContents(releaseDirectory, expected, sourceMarker, k20);
    const marker = JSON.parse((await readContainedFile(releaseDirectory, FYI_CHARACTER_RELEASE_READY)).toString("utf8"));
    if (JSON.stringify(marker) !== JSON.stringify(releaseMarker(expected.release, expected.plan, expected.receipt))) {
        throw new Error("K21 existing release marker rejected");
    }
}

export async function readValidatedFyiCharacterRelease(
    fyiRoot: string,
    releaseId: string,
): Promise<ValidatedFyiCharacterRelease> {
    assertReleaseId(releaseId);
    const releaseRoot = resolve(fyiRoot, FYI_CHARACTER_RELEASE_ROOT);
    const releaseDirectory = await resolveContainedArtifactPath(
        { trustedRoot: releaseRoot, untrustedPath: releaseId, expectedType: "directory" },
        (code, artifactType) => new DatabaseCharacterArtifactPathError(code, artifactType),
    );
    const [releaseBytes, planBytes, receiptBytes, sourceMarker, k20Bytes] = await Promise.all([
        readContainedFile(releaseDirectory, FYI_CHARACTER_RELEASE_REPORT),
        readContainedFile(releaseDirectory, FYI_CHARACTER_RELEASE_PLAN),
        readContainedFile(releaseDirectory, FYI_CHARACTER_RELEASE_RECEIPT),
        readContainedFile(releaseDirectory, FYI_CHARACTER_RELEASE_SOURCE_MARKER),
        readContainedFile(releaseDirectory, FYI_CHARACTER_RELEASE_K20),
    ]);
    const release = JSON.parse(releaseBytes.toString("utf8")) as FyiCharacterReleaseK21;
    const plan = JSON.parse(planBytes.toString("utf8")) as FyiCharacterReleaseK22;
    const receipt = JSON.parse(receiptBytes.toString("utf8")) as FyiCharacterReleaseK23;
    const k20 = JSON.parse(k20Bytes.toString("utf8")) as FyiCharacterCandidateReadinessReport;
    if (release.releaseId !== releaseId
        || !releaseBytes.equals(JSON_BYTES(release))
        || !planBytes.equals(JSON_BYTES(plan))
        || !receiptBytes.equals(JSON_BYTES(receipt))
        || !k20Bytes.equals(JSON_BYTES(k20))
        || sha256(k20Bytes) !== release.source.k20ReadinessSha256
        || sha256(sourceMarker) !== release.source.candidateReadyMarkerSha256) {
        throw new Error("K24 release metadata rejected");
    }
    const rebuiltPlan = buildFyiCharacterReleaseK22(release);
    const rebuiltReceipt = buildFyiCharacterReleaseK23(release, rebuiltPlan);
    if (JSON.stringify(plan) !== JSON.stringify(rebuiltPlan)
        || JSON.stringify(receipt) !== JSON.stringify(rebuiltReceipt)) {
        throw new Error("K24 release derivation rejected");
    }
    const expected: FyiCharacterReleasePipelineResult = { releaseDirectory, release, plan, receipt };
    await verifyReleaseDirectory(releaseDirectory, expected, sourceMarker, k20);
    const payload = await readContainedFile(releaseDirectory, "characters.json.gz");
    if (payload.length !== release.dataset.sizeBytes || sha256(payload) !== release.dataset.sha256) {
        throw new Error("K24 release payload changed after validation");
    }
    return { ...expected, payload };
}

export async function readValidatedFyiCharacterReleasePortrait(
    validated: ValidatedFyiCharacterRelease,
    fileName: string,
): Promise<Buffer> {
    if (!/^portrait_\d+\.png$/.test(fileName)) throw new Error("K28 portrait file name rejected");
    const entry = validated.release.portraits.entries.find(portrait => portrait.fileName === fileName);
    if (!entry || entry.objectKey !== `images/v2/${fileName}`) throw new Error("K28 portrait inventory entry rejected");
    const bytes = await readContainedFile(validated.releaseDirectory, `portraits/${fileName}`);
    if (bytes.length !== entry.sizeBytes || sha256(bytes) !== entry.sha256) {
        throw new Error(`K28 portrait changed after validation: ${fileName}`);
    }
    return bytes;
}

async function collectPortraitEntries(candidateDirectory: string, characters: Character[]): Promise<FyiCharacterReleasePortrait[]> {
    const keys = [...collectPortraitKeys(characters)].sort();
    return Promise.all(keys.map(async objectKey => {
        const path = await resolveContainedArtifactPath(
            { trustedRoot: candidateDirectory, untrustedPath: objectKey, expectedType: "file" },
            (code, artifactType) => new DatabaseCharacterArtifactPathError(code, artifactType),
        );
        const bytes = await readFile(path);
        return { objectKey, fileName: basename(objectKey), sha256: sha256(bytes), sizeBytes: bytes.length };
    }));
}

async function materializeRelease(options: {
    fyiRoot: string;
    candidateDirectory: string;
    candidateGzip: Buffer;
    candidateManifestBytes: Buffer;
    candidateReadyMarker: Buffer;
    k20: FyiCharacterCandidateReadinessReport;
    result: FyiCharacterReleasePipelineResult;
}): Promise<string> {
    const releaseRoot = resolve(options.fyiRoot, FYI_CHARACTER_RELEASE_ROOT);
    await mkdir(releaseRoot, { recursive: true });
    const rootRealPath = await realpath(releaseRoot);
    if (rootRealPath !== releaseRoot || !(await stat(rootRealPath)).isDirectory()) throw new Error("K21 release root rejected");
    const releaseDirectory = resolve(rootRealPath, options.result.release.releaseId);
    assertContained(rootRealPath, releaseDirectory);
    try {
        await mkdir(releaseDirectory, { mode: 0o700 });
    } catch (error: any) {
        if (error?.code !== "EEXIST") throw error;
        const existing = await lstat(releaseDirectory);
        if (!existing.isDirectory() || existing.isSymbolicLink() || await realpath(releaseDirectory) !== releaseDirectory) {
            throw new Error("K21 existing release directory rejected");
        }
        await verifyReleaseDirectory(releaseDirectory, options.result, options.candidateReadyMarker, options.k20);
        return releaseDirectory;
    }
    const releaseIdentity = await captureOwnedDirectory(releaseDirectory);
    try {
        const portraitDirectory = join(releaseDirectory, "portraits");
        await mkdir(portraitDirectory, { mode: 0o700 });
        const portraitIdentity = await captureOwnedDirectory(portraitDirectory);
        await writeOwnedFile(releaseIdentity, "characters.json.gz", options.candidateGzip);
        await writeOwnedFile(releaseIdentity, "characters-manifest.json", options.candidateManifestBytes);
        await writeOwnedFile(releaseIdentity, "characters-manifest.remote.json", JSON_BYTES(options.result.plan.remoteManifest));
        await writeOwnedFile(releaseIdentity, FYI_CHARACTER_RELEASE_K20, JSON_BYTES(options.k20));
        await writeOwnedFile(releaseIdentity, FYI_CHARACTER_RELEASE_SOURCE_MARKER, options.candidateReadyMarker);
        for (const portrait of options.result.release.portraits.entries) {
            const source = await resolveContainedArtifactPath(
                { trustedRoot: options.candidateDirectory, untrustedPath: portrait.objectKey, expectedType: "file" },
                (code, artifactType) => new DatabaseCharacterArtifactPathError(code, artifactType),
            );
            const bytes = await readFile(source);
            if (bytes.length !== portrait.sizeBytes || sha256(bytes) !== portrait.sha256) throw new Error("K21 source portrait changed");
            await assertOwnedDirectory(releaseIdentity);
            await writeOwnedFile(portraitIdentity, portrait.fileName, bytes);
        }
        await assertOwnedDirectory(portraitIdentity);
        await writeOwnedFile(releaseIdentity, FYI_CHARACTER_RELEASE_REPORT, JSON_BYTES(options.result.release));
        await writeOwnedFile(releaseIdentity, FYI_CHARACTER_RELEASE_PLAN, JSON_BYTES(options.result.plan));
        await writeOwnedFile(releaseIdentity, FYI_CHARACTER_RELEASE_RECEIPT, JSON_BYTES(options.result.receipt));
        await assertOwnedDirectory(releaseIdentity);
        await assertOwnedDirectory(portraitIdentity);
        await verifyReleaseContents(releaseDirectory, options.result, options.candidateReadyMarker, options.k20);
        await assertOwnedDirectory(releaseIdentity);
        await assertOwnedDirectory(portraitIdentity);
        await writeOwnedFile(releaseIdentity, FYI_CHARACTER_RELEASE_READY, JSON_BYTES(releaseMarker(options.result.release, options.result.plan, options.result.receipt)));
        return releaseDirectory;
    } catch (error) {
        const current = await lstat(releaseDirectory).catch(() => undefined);
        if (current?.isDirectory() && !current.isSymbolicLink()
            && current.dev === releaseIdentity.dev && current.ino === releaseIdentity.ino) {
            await rm(releaseDirectory, { recursive: true, force: true }).catch(() => undefined);
        }
        throw error;
    }
}

export async function runFyiCharacterReleasePipeline(): Promise<FyiCharacterReleasePipelineResult> {
    const fyiRoot = resolve(__dirname, "data/fyi-characters");
    const k15Root = resolve(__dirname, "data/database-characters");
    const candidateDirectory = await resolveFyiCandidateDirectory(fyiRoot, FYI_CHARACTER_CANDIDATE_DIRECTORY, false);
    const k15Directory = await resolveFyiK15Directory(k15Root, FYI_CHARACTER_K15_DIRECTORY);
    const k15Before = await validateCharacterCompactArtifact(k15Directory);
    const k15Snapshot = JSON.stringify(k15Before);
    const [
        baselineGzip, baselineManifestBytes, candidateGzip, candidateManifestBytes,
        candidateReadyMarker, runReportBytes, k19ReportBytes,
    ] = await Promise.all([
        readContainedFile(candidateDirectory, "baseline-characters.json.gz"),
        readContainedFile(candidateDirectory, "baseline-characters-manifest.json"),
        readContainedFile(candidateDirectory, "characters.json.gz"),
        readContainedFile(candidateDirectory, "characters-manifest.json"),
        readContainedFile(candidateDirectory, FYI_CHARACTER_CANDIDATE_READY_FILE),
        readContainedFile(candidateDirectory, "run-report.json"),
        readContainedFile(candidateDirectory, "candidate-k19-report.json"),
    ]);
    const candidateManifest = JSON.parse(candidateManifestBytes.toString("utf8")) as DatasetManifest;
    const k20 = compareFyiCharacterCandidate({
        baselineGzip,
        baselineManifest: JSON.parse(baselineManifestBytes.toString("utf8")),
        baselineManifestBytes,
        candidateGzip,
        candidateManifest,
        candidateManifestBytes,
        candidateReadyMarkerBytes: candidateReadyMarker,
        runReport: JSON.parse(runReportBytes.toString("utf8")),
        k19Report: JSON.parse(k19ReportBytes.toString("utf8")),
        k15Projection: k15Before.projection,
        k15Manifest: k15Before.manifest,
    });
    const characters = decodeCharacters(candidateGzip, candidateManifest);
    const portraits = await collectPortraitEntries(candidateDirectory, characters);
    const k15After = await validateCharacterCompactArtifact(k15Directory);
    if (JSON.stringify(k15After) !== k15Snapshot) throw new Error("K21 K15 input changed during snapshot validation");
    const release = buildFyiCharacterReleaseK21({ candidateGzip, candidateManifest, candidateReadyMarker, k20, portraits });
    const plan = buildFyiCharacterReleaseK22(release);
    const receipt = buildFyiCharacterReleaseK23(release, plan);
    const result = { releaseDirectory: "", release, plan, receipt };
    result.releaseDirectory = await materializeRelease({
        fyiRoot, candidateDirectory, candidateGzip, candidateManifestBytes,
        candidateReadyMarker, k20, result,
    });
    return result;
}

export function parseFyiCharacterReleaseCli(args: string[]): { optIn: true } {
    if (args.length !== 1 || args[0] !== "--opt-in-k21-k23") throw new Error("K21-K23 require exactly one --opt-in-k21-k23");
    return { optIn: true };
}

async function main(): Promise<void> {
    parseFyiCharacterReleaseCli(process.argv.slice(2));
    const result = await runFyiCharacterReleasePipeline();
    console.log(JSON.stringify({
        releaseDirectory: result.releaseDirectory,
        releaseId: result.release.releaseId,
        portraitCount: result.release.portraits.count,
        worstCaseNewBytes: result.plan.budget.worstCaseNewBytes,
        readiness: result.receipt.readiness,
    }, null, 2));
}

if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
