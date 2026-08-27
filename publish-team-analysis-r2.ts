import { execFile } from "child_process";
import { existsSync } from "fs";
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { dirname, resolve } from "path";
import {
    assertDatasetPublicationWriteAuthorized,
    contractLaneObjectKey,
    DatasetContractLane,
    DatasetPublicationChannel,
    defaultContractLaneStatePath,
    parseDatasetContractLane,
    parseDatasetPublicationChannel,
} from "./dataset-publication-channel";
import { assertAndroidV1PublicationProof } from "./android-v1-publication-proof";
import { DatasetManifest } from "./dataset-artifacts";
import {
    assertExpectedRemoteManifestBaseline,
    buildCharacterManifestObjectKey,
    buildRemoteDatasetObjectKey,
} from "./publish-r2";
import { TeamAnalysisManifest, sha256 } from "./team-analysis-artifacts";
import {
    TEAM_ANALYSIS_LOCAL_FILE_NAME,
    ValidatedTeamAnalysisDelivery,
    validateTeamAnalysisDeliveryBuffers,
} from "./team-analysis-delivery";

const DEFAULT_BUCKET = "dokkanpanion-data";
const DEFAULT_DATASET_PATH = "data/fyi-characters/latest/team-analysis.json.gz";
const DEFAULT_MANIFEST_PATH = "data/fyi-characters/latest/team-analysis-manifest.json";
const DEFAULT_CHARACTER_DATASET_PATH = "data/fyi-characters/latest/characters.json.gz";
const DEFAULT_CHARACTER_MANIFEST_PATH = "data/fyi-characters/latest/characters-manifest.json";
const DEFAULT_STATE_PATH = "data/fyi-characters/latest/team-analysis-r2-publish-state.json";
const DEFAULT_MAX_TOTAL_BYTES = 10_000_000_000;
const DEFAULT_MAX_NAMESPACE_BYTES = 50_000_000;
const RETAINED_RELEASE_COUNT = 2;
const MAX_TRACKED_RELEASES = 50;
const UPLOAD_VERIFICATION_RETRY_DELAYS_MS = [1_000, 2_000, 4_000, 8_000, 15_000] as const;
export const TEAM_ANALYSIS_MANIFEST_OBJECT_KEY = "team-analysis-manifest.json";
export const TEAM_ANALYSIS_PAYLOAD_CACHE_CONTROL = "public, max-age=31536000, immutable";
export const TEAM_ANALYSIS_MANIFEST_CACHE_CONTROL = "no-store";

export interface TeamAnalysisR2PublishOptions {
    bucket: string,
    datasetPath: string,
    manifestPath: string,
    characterDatasetPath: string,
    characterManifestPath: string,
    statePath: string,
    dryRun: boolean,
    target: "remote" | "local",
    skipRemoteManifestCheck: boolean,
    skipUploadVerification: boolean,
    expectedRemoteBaselineSha256?: string,
    expectRemoteManifestAbsent: boolean,
    retainAllReleases: boolean,
    allowUnknownBucketSize: boolean,
    maxTotalBytes: number,
    maxNamespaceBytes: number,
    channel: DatasetPublicationChannel,
    contractLane: DatasetContractLane,
    v1ProjectionReportPath?: string,
    manifestObjectKey: string,
    promoteProduction: boolean,
}

export interface TeamAnalysisRetainedRelease {
    datasetVersion: string,
    datasetObjectKey: string,
    payloadSha256: string,
    sizeBytes: number,
    publishedAt?: string,
}

export interface TeamAnalysisR2PublishState {
    schemaVersion: 1,
    bucket: string,
    target: "remote" | "local",
    channel?: DatasetPublicationChannel,
    contractLane?: DatasetContractLane,
    datasetVersion: string,
    datasetObjectKey: string,
    payloadSha256: string,
    manifestSha256: string,
    publishedAt: string,
    retainedReleases: TeamAnalysisRetainedRelease[],
    cleanupPendingReleases?: TeamAnalysisRetainedRelease[],
}

export interface CommandResult {
    exitCode: number,
    stdout: string,
    stderr: string,
}

export interface TeamAnalysisCommandRunner {
    run(args: string[]): Promise<CommandResult>,
    delay?(milliseconds: number): Promise<void>,
}

export interface BucketSizeReport {
    reported: string,
    conservativeUpperBoundBytes: number,
}

export interface TeamAnalysisR2PublishPlan {
    options: TeamAnalysisR2PublishOptions,
    localManifest: TeamAnalysisManifest,
    characterManifest: DatasetManifest,
    remoteManifest: TeamAnalysisManifest,
    remoteManifestSha256: string,
    remoteManifestStatus: "matching" | "different" | "missing" | "skipped",
    datasetObjectKey: string,
    payloadUploadNeeded: boolean,
    manifestUpdateNeeded: boolean,
    stateUpdateNeeded: boolean,
    retainedReleases: TeamAnalysisRetainedRelease[],
    cleanupCandidates: TeamAnalysisRetainedRelease[],
    bytesNew: number,
    bytesRetained: number,
    bytesRemovable: number,
    knownManagedBytesBeforeCleanup: number,
    projectedManagedBytes: number,
    bucketSizeReport?: BucketSizeReport,
    projectedBucketUpperBoundBytes?: number,
    bucketTotalVisibility: "conservative-wrangler-upper-bound" | "unavailable",
    inventoryComplete: boolean,
    warnings: string[],
    plannedActions: string[],
}

interface RemoteFacts {
    manifest?: TeamAnalysisManifest,
    manifestBytes?: number,
    manifestSha256?: string,
    verifiedReleases: TeamAnalysisRetainedRelease[],
    plannedPayloadPresent: boolean,
    bucketSizeReport?: BucketSizeReport,
    state?: TeamAnalysisR2PublishState,
    stateStatus: "valid" | "missing" | "old-or-invalid" | "mismatched",
    warnings: string[],
}

export interface TeamAnalysisPublishSummary {
    plan: TeamAnalysisR2PublishPlan,
    cleanupFailures: string[],
}

export function parseTeamAnalysisR2PublishArgs(argv: string[]): TeamAnalysisR2PublishOptions {
    const valueNames = new Set([
        "--bucket", "--dataset", "--manifest", "--characters", "--character-manifest", "--state",
        "--max-total-bytes", "--max-namespace-bytes", "--channel", "--contract-lane",
        "--v1-projection-report", "--expected-remote-baseline-sha256",
    ]);
    const flagNames = new Set([
        "--dry-run", "--remote", "--local", "--skip-remote-manifest-check", "--skip-upload-verification",
        "--retain-all-releases", "--allow-unknown-bucket-size", "--promote-production",
        "--expect-remote-manifest-absent",
    ]);
    const values = new Map<string, string>();
    const flags = new Set<string>();

    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];
        if (!token.startsWith("--")) {
            throw new Error(`Unexpected argument: ${token}`);
        }
        const separatorIndex = token.indexOf("=");
        const name = separatorIndex >= 0 ? token.slice(0, separatorIndex) : token;
        const inlineValue = separatorIndex >= 0 ? token.slice(separatorIndex + 1) : undefined;
        if (!valueNames.has(name) && !flagNames.has(name)) {
            throw new Error(`Unknown option: ${name}`);
        }
        if (flagNames.has(name)) {
            if (inlineValue !== undefined) {
                throw new Error(`Flag ${name} does not accept a value.`);
            }
            flags.add(name);
            continue;
        }
        const value = inlineValue !== undefined ? inlineValue : argv[index + 1];
        if (!value || (inlineValue === undefined && value.startsWith("--"))) {
            throw new Error(`Missing value for ${name}.`);
        }
        values.set(name, value);
        if (inlineValue === undefined) {
            index += 1;
        }
    }

    if (flags.has("--remote") && flags.has("--local")) {
        throw new Error("Choose only one of --remote or --local.");
    }
    const expectedRemoteBaselineSha256 = values.get("--expected-remote-baseline-sha256")?.toLowerCase();
    if (expectedRemoteBaselineSha256 && !/^[a-f0-9]{64}$/.test(expectedRemoteBaselineSha256)) {
        throw new Error("Invalid --expected-remote-baseline-sha256 value.");
    }
    const expectRemoteManifestAbsent = flags.has("--expect-remote-manifest-absent");
    if (expectedRemoteBaselineSha256 && expectRemoteManifestAbsent) {
        throw new Error(
            "--expected-remote-baseline-sha256 cannot be combined with --expect-remote-manifest-absent.",
        );
    }
    if (
        (expectedRemoteBaselineSha256 || expectRemoteManifestAbsent)
        && flags.has("--skip-remote-manifest-check")
    ) {
        throw new Error("A remote baseline pin cannot be combined with --skip-remote-manifest-check.");
    }
    const bucket = values.get("--bucket") ?? process.env.R2_BUCKET_NAME ?? DEFAULT_BUCKET;
    assertValidBucket(bucket);
    const channel = parseDatasetPublicationChannel(values.get("--channel"));
    const contractLane = parseDatasetContractLane(values.get("--contract-lane"));
    const v1ProjectionReportPath = values.get("--v1-projection-report");
    if (contractLane === "v1" && !v1ProjectionReportPath) {
        throw new Error("The v1 contract lane requires --v1-projection-report.");
    }
    if (contractLane !== "v1" && v1ProjectionReportPath) {
        throw new Error("--v1-projection-report can only be used with --contract-lane v1.");
    }

    const resolvedPaths = {
        datasetPath: resolve(values.get("--dataset") ?? DEFAULT_DATASET_PATH),
        manifestPath: resolve(values.get("--manifest") ?? DEFAULT_MANIFEST_PATH),
        characterDatasetPath: resolve(values.get("--characters") ?? DEFAULT_CHARACTER_DATASET_PATH),
        characterManifestPath: resolve(values.get("--character-manifest") ?? DEFAULT_CHARACTER_MANIFEST_PATH),
        statePath: values.has("--state")
            ? resolve(values.get("--state")!)
            : defaultContractLaneStatePath(DEFAULT_STATE_PATH, channel, contractLane),
    };
    assertDistinctLocalPaths(resolvedPaths);

    return {
        bucket,
        ...resolvedPaths,
        dryRun: flags.has("--dry-run"),
        target: flags.has("--local") ? "local" : "remote",
        skipRemoteManifestCheck: flags.has("--skip-remote-manifest-check"),
        skipUploadVerification: flags.has("--skip-upload-verification"),
        expectedRemoteBaselineSha256,
        expectRemoteManifestAbsent,
        retainAllReleases: flags.has("--retain-all-releases"),
        allowUnknownBucketSize: flags.has("--allow-unknown-bucket-size"),
        maxTotalBytes: parsePositiveSafeInteger(values.get("--max-total-bytes"), DEFAULT_MAX_TOTAL_BYTES),
        maxNamespaceBytes: parsePositiveSafeInteger(
            values.get("--max-namespace-bytes"),
            DEFAULT_MAX_NAMESPACE_BYTES,
        ),
        channel,
        contractLane,
        v1ProjectionReportPath: v1ProjectionReportPath ? resolve(v1ProjectionReportPath) : undefined,
        manifestObjectKey: buildTeamAnalysisManifestObjectKey(channel, contractLane),
        promoteProduction: flags.has("--promote-production"),
    };
}

export function buildTeamAnalysisDatasetObjectKey(
    manifest: TeamAnalysisManifest,
    channel: DatasetPublicationChannel = "production",
    contractLane: DatasetContractLane = "v1",
): string {
    const slug = datasetVersionSlug(manifest.datasetVersion);
    const key = contractLaneObjectKey(
        channel,
        contractLane,
        `team-analysis/releases/${slug}/${manifest.sha256.toLowerCase()}/${TEAM_ANALYSIS_LOCAL_FILE_NAME}`,
    );
    assertValidObjectKey(key, "Team Analysis payload object key");
    return key;
}

export function buildTeamAnalysisManifestObjectKey(
    channel: DatasetPublicationChannel = "production",
    contractLane: DatasetContractLane = "v1",
): string {
    return contractLaneObjectKey(channel, contractLane, TEAM_ANALYSIS_MANIFEST_OBJECT_KEY);
}

export async function readTeamAnalysisR2PublishPlan(
    options: TeamAnalysisR2PublishOptions,
    runner: TeamAnalysisCommandRunner = createWranglerCommandRunner(),
): Promise<TeamAnalysisR2PublishPlan> {
    const requiredFiles: Array<[string, string]> = [
        ["Team Analysis payload", options.datasetPath],
        ["Team Analysis manifest", options.manifestPath],
        ["character payload", options.characterDatasetPath],
        ["character manifest", options.characterManifestPath],
    ];
    for (const [label, filePath] of requiredFiles) {
        if (!existsSync(filePath)) {
            throw new Error(`${label} not found: ${filePath}`);
        }
    }

    const [datasetBuffer, manifestBuffer, characterDatasetBuffer, characterManifestBuffer] = await Promise.all([
        readFile(options.datasetPath),
        readFile(options.manifestPath),
        readFile(options.characterDatasetPath),
        readFile(options.characterManifestPath),
    ]);
    const validated = validateTeamAnalysisDeliveryBuffers({
        datasetBuffer,
        manifestBuffer,
        characterDatasetBuffer,
        characterManifestBuffer,
    }, {
        contract: options.contractLane === "v1" ? "android-v1" : "canonical",
    });
    if (options.contractLane === "v1") {
        await assertAndroidV1PublicationProof(options.v1ProjectionReportPath!, {
            characters: validated.characterManifest,
            teamAnalysis: validated.manifest,
        });
    }
    const stateRead = await readPublishState(options.statePath, options);
    const remoteFacts = await inspectRemoteFacts(options, validated, stateRead, runner);
    assertExpectedRemoteManifestBaseline(
        options.expectedRemoteBaselineSha256,
        options.expectRemoteManifestAbsent,
        remoteFacts.manifest,
    );
    return buildTeamAnalysisR2PublishPlan(options, validated, remoteFacts);
}

export function buildTeamAnalysisR2PublishPlan(
    options: TeamAnalysisR2PublishOptions,
    validated: ValidatedTeamAnalysisDelivery,
    facts: RemoteFacts,
): TeamAnalysisR2PublishPlan {
    const datasetObjectKey = buildTeamAnalysisDatasetObjectKey(
        validated.manifest,
        options.channel,
        options.contractLane,
    );
    const remoteManifest: TeamAnalysisManifest = { ...validated.manifest, fileName: datasetObjectKey };
    const remoteManifestBuffer = serializeManifest(remoteManifest);
    const manifestMatches = facts.manifest ? manifestsExactlyMatch(remoteManifest, facts.manifest) : false;
    const remoteManifestSha256 = manifestMatches && facts.manifestSha256
        ? facts.manifestSha256
        : sha256(remoteManifestBuffer);
    const remoteManifestStatus = options.skipRemoteManifestCheck
        ? "skipped"
        : facts.manifest
            ? manifestMatches ? "matching" : "different"
            : "missing";
    const payloadUploadNeeded = !facts.plannedPayloadPresent;
    const manifestUpdateNeeded = !manifestMatches;

    const currentRelease: TeamAnalysisRetainedRelease = {
        datasetVersion: remoteManifest.datasetVersion,
        datasetObjectKey,
        payloadSha256: remoteManifest.sha256.toLowerCase(),
        sizeBytes: remoteManifest.sizeBytes,
        publishedAt: remoteManifest.generatedAt,
    };
    const activeRemoteObjectKey = facts.manifest?.fileName;
    const existingReleases = dedupeReleases(facts.verifiedReleases)
        .filter(release => release.datasetObjectKey !== datasetObjectKey)
        .sort((left, right) => {
            if (left.datasetObjectKey === activeRemoteObjectKey) return -1;
            if (right.datasetObjectKey === activeRemoteObjectKey) return 1;
            return comparePreviousReleases(left, right);
        });
    if (existingReleases.length + 1 > MAX_TRACKED_RELEASES) {
        throw new Error(
            `Team Analysis has ${existingReleases.length + 1} verified releases, above the bounded tracked-release limit of ${MAX_TRACKED_RELEASES}.`,
        );
    }
    const retainedReleases = options.retainAllReleases
        ? [currentRelease, ...existingReleases]
        : [currentRelease, ...existingReleases].slice(0, RETAINED_RELEASE_COUNT);
    const retainedKeys = new Set(retainedReleases.map(release => release.datasetObjectKey));
    const cleanupCandidates = options.retainAllReleases
        ? []
        : existingReleases
            .filter(release => !retainedKeys.has(release.datasetObjectKey))
            .sort((left, right) => left.datasetObjectKey.localeCompare(right.datasetObjectKey));

    const verifiedIncludingPlanned = dedupeReleases([
        ...facts.verifiedReleases,
        ...(facts.plannedPayloadPresent ? [currentRelease] : []),
    ]);
    const existingPayloadBytes = sumReleaseBytes(verifiedIncludingPlanned);
    const bytesNew = (payloadUploadNeeded ? remoteManifest.sizeBytes : 0)
        + (manifestUpdateNeeded ? remoteManifestBuffer.byteLength : 0);
    const bytesRetained = sumReleaseBytes(retainedReleases);
    const bytesRemovable = sumReleaseBytes(cleanupCandidates);
    const knownManagedBytesBeforeCleanup = existingPayloadBytes
        + (payloadUploadNeeded ? remoteManifest.sizeBytes : 0)
        + remoteManifestBuffer.byteLength;
    const projectedManagedBytes = bytesRetained + remoteManifestBuffer.byteLength;

    if (knownManagedBytesBeforeCleanup > options.maxNamespaceBytes) {
        throw new Error(
            `Team Analysis known managed peak ${knownManagedBytesBeforeCleanup} bytes exceeds namespace limit ${options.maxNamespaceBytes} bytes before cleanup.`,
        );
    }
    if (knownManagedBytesBeforeCleanup > options.maxTotalBytes) {
        throw new Error(
            `Team Analysis known managed peak ${knownManagedBytesBeforeCleanup} bytes exceeds global limit ${options.maxTotalBytes} bytes.`,
        );
    }

    let projectedBucketUpperBoundBytes: number | undefined;
    if (facts.bucketSizeReport) {
        const previousManifestBytes = facts.manifestBytes ?? 0;
        projectedBucketUpperBoundBytes = facts.bucketSizeReport.conservativeUpperBoundBytes
            + (payloadUploadNeeded ? remoteManifest.sizeBytes : 0)
            + (manifestUpdateNeeded ? Math.max(0, remoteManifestBuffer.byteLength - previousManifestBytes) : 0);
        if (projectedBucketUpperBoundBytes > options.maxTotalBytes) {
            throw new Error(
                `Projected conservative bucket upper bound ${projectedBucketUpperBoundBytes} bytes exceeds global limit ${options.maxTotalBytes} bytes.`,
            );
        }
    } else if (options.target === "remote" && !options.dryRun && !options.allowUnknownBucketSize) {
        throw new Error(
            "Wrangler bucket size is unavailable. Refusing remote writes without the explicit --allow-unknown-bucket-size recovery flag.",
        );
    }

    const nextState = buildNextPublishState(
        options,
        remoteManifest,
        remoteManifestSha256,
        retainedReleases,
        cleanupCandidates,
        facts.state?.publishedAt ?? remoteManifest.generatedAt,
    );
    const stateUpdateNeeded = !facts.state || !publishStatesOperationallyEqual(facts.state, nextState);
    const plannedActions: string[] = [];
    plannedActions.push(
        `verify remote Character delivery ${buildCharacterManifestObjectKey(options.channel, options.contractLane)}`,
    );
    if (payloadUploadNeeded) plannedActions.push(`put ${datasetObjectKey}`);
    if (payloadUploadNeeded && !options.skipUploadVerification) plannedActions.push(`verify ${datasetObjectKey}`);
    if (manifestUpdateNeeded) {
        plannedActions.push(`put ${options.manifestObjectKey} last`);
        if (!options.skipUploadVerification) {
            plannedActions.push(`verify ${options.manifestObjectKey}`);
        }
    }
    if (stateUpdateNeeded || manifestUpdateNeeded || payloadUploadNeeded || cleanupCandidates.length > 0) {
        plannedActions.push(`update local state ${options.statePath}`);
    }
    cleanupCandidates.forEach(release => plannedActions.push(`delete ${release.datasetObjectKey} after manifest`));
    if (plannedActions.length === 0) plannedActions.push("no writes; remote manifest, payload, and state are aligned");

    return {
        options,
        localManifest: validated.manifest,
        characterManifest: validated.characterManifest,
        remoteManifest,
        remoteManifestSha256,
        remoteManifestStatus,
        datasetObjectKey,
        payloadUploadNeeded,
        manifestUpdateNeeded,
        stateUpdateNeeded,
        retainedReleases,
        cleanupCandidates,
        bytesNew,
        bytesRetained,
        bytesRemovable,
        knownManagedBytesBeforeCleanup,
        projectedManagedBytes,
        bucketSizeReport: facts.bucketSizeReport,
        projectedBucketUpperBoundBytes,
        bucketTotalVisibility: facts.bucketSizeReport ? "conservative-wrangler-upper-bound" : "unavailable",
        inventoryComplete: false,
        warnings: [
            ...facts.warnings,
            ...(options.retainAllReleases
                ? ["All verified tracked releases are retained; no release cleanup is planned."]
                : []),
            "Wrangler does not expose an object listing in this flow; retention covers the remote manifest and verified state-tracked releases.",
        ],
        plannedActions,
    };
}

export async function publishTeamAnalysisR2(
    options: TeamAnalysisR2PublishOptions,
    runner: TeamAnalysisCommandRunner = createWranglerCommandRunner(),
    now: () => Date = () => new Date(),
): Promise<TeamAnalysisPublishSummary> {
    assertDatasetPublicationWriteAuthorized(options);
    assertRemoteWriteVerificationEnabled(options);
    const plan = await readTeamAnalysisR2PublishPlan(options, runner);
    printTeamAnalysisR2PublishPlan(plan);
    if (options.dryRun) {
        console.log("Dry run complete. No put, delete, manifest, state, or input artifact was changed.");
        return { plan, cleanupFailures: [] };
    }

    await assertRemoteCharacterDeliveryMatches(runner, options, plan.characterManifest);

    if (plan.payloadUploadNeeded) {
        await putObject(
            runner,
            options,
            plan.datasetObjectKey,
            options.datasetPath,
            "application/gzip",
            TEAM_ANALYSIS_PAYLOAD_CACHE_CONTROL,
        );
        if (!options.skipUploadVerification) {
            await assertRemotePayloadMatches(
                runner,
                options,
                plan.datasetObjectKey,
                plan.remoteManifest.sha256,
                plan.remoteManifest.sizeBytes,
            );
        }
    }

    if (plan.manifestUpdateNeeded) {
        await assertRemoteCharacterDeliveryMatches(runner, options, plan.characterManifest);
        const temporaryDirectory = await mkdtemp(resolve(tmpdir(), "dokkan-team-analysis-manifest-"));
        const temporaryManifestPath = resolve(temporaryDirectory, TEAM_ANALYSIS_MANIFEST_OBJECT_KEY);
        const manifestBuffer = serializeManifest(plan.remoteManifest);
        try {
            await writeFile(temporaryManifestPath, manifestBuffer);
            await putObject(
                runner,
                options,
                options.manifestObjectKey,
                temporaryManifestPath,
                "application/json",
                TEAM_ANALYSIS_MANIFEST_CACHE_CONTROL,
            );
            if (!options.skipUploadVerification) {
                await assertRemoteManifestMatches(runner, options, plan.remoteManifest, manifestBuffer);
            }
        } finally {
            await rm(temporaryDirectory, { recursive: true, force: true });
        }
    }

    const publishedAt = now().toISOString();
    const stateWithPendingCleanup = buildNextPublishState(
        options,
        plan.remoteManifest,
        plan.remoteManifestSha256,
        plan.retainedReleases,
        plan.cleanupCandidates,
        publishedAt,
    );
    if (plan.stateUpdateNeeded || plan.manifestUpdateNeeded || plan.payloadUploadNeeded || plan.cleanupCandidates.length > 0) {
        await writePublishState(options.statePath, stateWithPendingCleanup);
    }

    const cleanupFailures: string[] = [];
    const failedCleanupReleases: TeamAnalysisRetainedRelease[] = [];
    for (const release of plan.cleanupCandidates) {
        try {
            await deleteObject(runner, options, release.datasetObjectKey);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            cleanupFailures.push(`${release.datasetObjectKey}: ${message}`);
            failedCleanupReleases.push(release);
            console.warn(`Cleanup failed after manifest promotion for ${release.datasetObjectKey}: ${message}`);
        }
    }
    if (plan.cleanupCandidates.length > 0) {
        const { cleanupPendingReleases: _pendingCleanup, ...publishedState } = stateWithPendingCleanup;
        await writePublishState(options.statePath, {
            ...publishedState,
            ...(failedCleanupReleases.length > 0 ? { cleanupPendingReleases: failedCleanupReleases } : {}),
        });
    }

    if (!plan.payloadUploadNeeded && !plan.manifestUpdateNeeded && !plan.stateUpdateNeeded && plan.cleanupCandidates.length === 0) {
        console.log("Nothing changed. Team Analysis is already aligned.");
    } else {
        console.log("Team Analysis R2 publication completed; the manifest was promoted only after payload readiness.");
    }
    return { plan, cleanupFailures };
}

function assertRemoteWriteVerificationEnabled(options: TeamAnalysisR2PublishOptions): void {
    if (options.target !== "remote" || options.dryRun) return;
    if (options.skipRemoteManifestCheck || options.skipUploadVerification) {
        throw new Error(
            "Remote publication requires the baseline manifest check and post-upload verification; "
            + "skip flags are limited to local or read-only dry-run diagnostics.",
        );
    }
    if (Boolean(options.expectedRemoteBaselineSha256) === options.expectRemoteManifestAbsent) {
        throw new Error(
            "Remote Team Analysis publication requires exactly one baseline pin: "
            + "--expected-remote-baseline-sha256 or --expect-remote-manifest-absent.",
        );
    }
}

export function printTeamAnalysisR2PublishPlan(plan: TeamAnalysisR2PublishPlan): void {
    console.log(`Target: ${plan.options.target}`);
    console.log(`Bucket: ${plan.options.bucket}`);
    console.log(`Channel: ${plan.options.channel}`);
    console.log(`Contract lane: ${plan.options.contractLane}`);
    console.log(`Manifest object key: ${plan.options.manifestObjectKey}`);
    console.log(`Version: ${plan.remoteManifest.datasetVersion}`);
    console.log(`SHA-256: ${plan.remoteManifest.sha256}`);
    if (plan.options.expectRemoteManifestAbsent) {
        console.log("Expected remote baseline: manifest absent");
    } else if (plan.options.expectedRemoteBaselineSha256) {
        console.log(`Expected remote baseline SHA-256: ${plan.options.expectedRemoteBaselineSha256}`);
    }
    console.log(`Payload key: ${plan.datasetObjectKey}`);
    console.log(`Payload upload needed: ${plan.payloadUploadNeeded ? "yes" : "no"}`);
    console.log(`Manifest update needed: ${plan.manifestUpdateNeeded ? "yes" : "no"} (${plan.remoteManifestStatus})`);
    console.log(`Retained releases: ${plan.retainedReleases.map(release => release.datasetObjectKey).join(", ") || "none"}`);
    console.log(`Cleanup candidates: ${plan.cleanupCandidates.map(release => release.datasetObjectKey).join(", ") || "none"}`);
    console.log(`New bytes: ${plan.bytesNew}`);
    console.log(`Retained payload bytes: ${plan.bytesRetained}`);
    console.log(`Removable bytes: ${plan.bytesRemovable}`);
    console.log(`Known managed peak before cleanup: ${plan.knownManagedBytesBeforeCleanup}/${plan.options.maxNamespaceBytes} bytes`);
    console.log(`Projected managed size after cleanup: ${plan.projectedManagedBytes} bytes`);
    console.log(`Global limit: ${plan.options.maxTotalBytes} bytes`);
    if (plan.bucketSizeReport && plan.projectedBucketUpperBoundBytes !== undefined) {
        console.log(
            `Wrangler bucket size: ${plan.bucketSizeReport.reported}; conservative projected upper bound: ${plan.projectedBucketUpperBoundBytes} bytes.`,
        );
        console.log("Bucket total visibility: approximate human-readable Wrangler value, not an exact byte inventory.");
    } else {
        console.log("Bucket total visibility: unavailable; managed namespace bytes are not the total bucket size.");
    }
    console.log(`Planned actions: ${plan.plannedActions.join(" -> ")}`);
    plan.warnings.forEach(warning => console.log(`Warning: ${warning}`));
}

async function inspectRemoteFacts(
    options: TeamAnalysisR2PublishOptions,
    validated: ValidatedTeamAnalysisDelivery,
    stateRead: { state?: TeamAnalysisR2PublishState, status: RemoteFacts["stateStatus"], warnings: string[] },
    runner: TeamAnalysisCommandRunner,
): Promise<RemoteFacts> {
    const warnings = [...stateRead.warnings];
    let manifest: TeamAnalysisManifest | undefined;
    let manifestBytes: number | undefined;
    let manifestSha256: string | undefined;
    if (!options.skipRemoteManifestCheck) {
        const remote = await tryGetJsonObject<TeamAnalysisManifest>(
            runner,
            options,
            options.manifestObjectKey,
            "Team Analysis remote manifest",
        );
        if (remote) {
            validateRemoteManifest(remote.value, options.channel, options.contractLane);
            manifest = remote.value;
            manifestBytes = remote.bytes;
            manifestSha256 = remote.sha256;
        }
    } else {
        warnings.push("Remote manifest check was explicitly skipped; the update plan cannot be idempotence-authoritative.");
    }

    const plannedRelease: TeamAnalysisRetainedRelease = {
        datasetVersion: validated.manifest.datasetVersion,
        datasetObjectKey: buildTeamAnalysisDatasetObjectKey(
            validated.manifest,
            options.channel,
            options.contractLane,
        ),
        payloadSha256: validated.manifest.sha256.toLowerCase(),
        sizeBytes: validated.manifest.sizeBytes,
        publishedAt: validated.manifest.generatedAt,
    };
    const releaseCandidates = dedupeReleases([
        plannedRelease,
        ...(manifest ? [releaseFromManifest(manifest)] : []),
        ...(stateRead.state?.retainedReleases ?? []),
        ...(stateRead.state?.cleanupPendingReleases ?? []),
    ]);
    const verifiedReleases: TeamAnalysisRetainedRelease[] = [];
    let plannedPayloadPresent = false;
    for (const release of releaseCandidates) {
        validateRelease(release, options.channel, options.contractLane);
        const matches = await remotePayloadMatches(runner, options, release);
        if (matches) {
            verifiedReleases.push(release);
            if (release.datasetObjectKey === plannedRelease.datasetObjectKey) {
                plannedPayloadPresent = true;
            }
        } else if (release.datasetObjectKey !== plannedRelease.datasetObjectKey) {
            warnings.push(`Tracked release is missing or corrupt and will not be retained or deleted: ${release.datasetObjectKey}`);
        }
    }

    const bucketSizeReport = options.target === "remote"
        ? await tryReadBucketSizeReport(runner, options.bucket, warnings)
        : undefined;
    return {
        manifest,
        manifestBytes,
        manifestSha256,
        verifiedReleases,
        plannedPayloadPresent,
        bucketSizeReport,
        state: stateRead.state,
        stateStatus: stateRead.status,
        warnings,
    };
}

async function tryGetJsonObject<T>(
    runner: TeamAnalysisCommandRunner,
    options: TeamAnalysisR2PublishOptions,
    objectKey: string,
    label: string,
): Promise<{ value: T, bytes: number, sha256: string } | undefined> {
    assertValidObjectKey(objectKey, label);
    const temporaryDirectory = await mkdtemp(resolve(tmpdir(), "dokkan-team-analysis-get-"));
    const temporaryPath = resolve(temporaryDirectory, "object.json");
    try {
        const result = await runner.run(objectGetArgs(options, objectKey, temporaryPath));
        if (result.exitCode !== 0) {
            if (isMissingObjectResult(result)) return undefined;
            throw commandFailure(`read ${label}`, result);
        }
        const buffer = await readFile(temporaryPath);
        let value: unknown;
        try {
            value = JSON.parse(buffer.toString("utf8"));
        } catch (error) {
            throw new Error(`${label} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
        }
        if (!value || typeof value !== "object" || Array.isArray(value)) {
            throw new Error(`${label} must be a JSON object.`);
        }
        return { value: value as unknown as T, bytes: buffer.byteLength, sha256: sha256(buffer) };
    } finally {
        await rm(temporaryDirectory, { recursive: true, force: true });
    }
}

async function remotePayloadMatches(
    runner: TeamAnalysisCommandRunner,
    options: TeamAnalysisR2PublishOptions,
    release: TeamAnalysisRetainedRelease,
): Promise<boolean> {
    const temporaryDirectory = await mkdtemp(resolve(tmpdir(), "dokkan-team-analysis-payload-"));
    const temporaryPath = resolve(temporaryDirectory, TEAM_ANALYSIS_LOCAL_FILE_NAME);
    try {
        const result = await runner.run(objectGetArgs(options, release.datasetObjectKey, temporaryPath));
        if (result.exitCode !== 0) {
            if (isMissingObjectResult(result)) return false;
            throw commandFailure(`read ${release.datasetObjectKey}`, result);
        }
        const buffer = await readFile(temporaryPath);
        return buffer.byteLength === release.sizeBytes && sha256(buffer) === release.payloadSha256.toLowerCase();
    } finally {
        await rm(temporaryDirectory, { recursive: true, force: true });
    }
}

async function assertRemotePayloadMatches(
    runner: TeamAnalysisCommandRunner,
    options: TeamAnalysisR2PublishOptions,
    objectKey: string,
    expectedSha256: string,
    expectedSizeBytes: number,
): Promise<void> {
    const matches = await eventuallyMatches(runner, () => remotePayloadMatches(runner, options, {
        datasetVersion: "upload-verification",
        datasetObjectKey: objectKey,
        payloadSha256: expectedSha256,
        sizeBytes: expectedSizeBytes,
    }));
    if (!matches) {
        throw new Error(`Uploaded Team Analysis payload failed size/SHA-256 verification: ${objectKey}`);
    }
}

async function assertRemoteCharacterDeliveryMatches(
    runner: TeamAnalysisCommandRunner,
    options: TeamAnalysisR2PublishOptions,
    localManifest: DatasetManifest,
): Promise<void> {
    const manifestObjectKey = buildCharacterManifestObjectKey(options.channel, options.contractLane);
    const expectedPayloadKey = buildRemoteDatasetObjectKey(
        localManifest,
        options.channel,
        options.contractLane,
    );
    const expectedManifest: DatasetManifest = {
        ...localManifest,
        fileName: expectedPayloadKey,
    };
    const remote = await tryGetJsonObject<DatasetManifest>(
        runner,
        options,
        manifestObjectKey,
        "required Character remote manifest",
    );
    if (!remote || canonicalJson(remote.value) !== canonicalJson(expectedManifest)) {
        throw new Error(
            `Required Character delivery is not public and identical in ${options.channel}/${options.contractLane}: ${manifestObjectKey}`,
        );
    }
    const payloadMatches = await remotePayloadMatches(runner, options, {
        datasetVersion: expectedManifest.datasetVersion,
        datasetObjectKey: expectedPayloadKey,
        payloadSha256: expectedManifest.sha256,
        sizeBytes: expectedManifest.sizeBytes,
    });
    if (!payloadMatches) {
        throw new Error(
            `Required Character payload is missing or corrupt in ${options.channel}/${options.contractLane}: ${expectedPayloadKey}`,
        );
    }
}

async function assertRemoteManifestMatches(
    runner: TeamAnalysisCommandRunner,
    options: TeamAnalysisR2PublishOptions,
    expectedManifest: TeamAnalysisManifest,
    expectedBuffer: Buffer,
): Promise<void> {
    const expectedSha256 = sha256(expectedBuffer);
    const matches = await eventuallyMatches(runner, async () => {
        const remote = await tryGetJsonObject<TeamAnalysisManifest>(
            runner,
            options,
            options.manifestObjectKey,
            "uploaded Team Analysis manifest",
        );
        return Boolean(
            remote
            && remote.bytes === expectedBuffer.byteLength
            && remote.sha256 === expectedSha256
            && manifestsExactlyMatch(remote.value, expectedManifest),
        );
    });
    if (!matches) {
        throw new Error("Uploaded Team Analysis manifest failed content/size/SHA-256 verification.");
    }
}

async function eventuallyMatches(
    runner: TeamAnalysisCommandRunner,
    check: () => Promise<boolean>,
): Promise<boolean> {
    if (await check()) return true;
    for (const delayMilliseconds of UPLOAD_VERIFICATION_RETRY_DELAYS_MS) {
        await delayRunner(runner, delayMilliseconds);
        if (await check()) return true;
    }
    return false;
}

async function delayRunner(runner: TeamAnalysisCommandRunner, milliseconds: number): Promise<void> {
    if (runner.delay) {
        await runner.delay(milliseconds);
        return;
    }
    await new Promise<void>(resolveDelay => setTimeout(resolveDelay, milliseconds));
}

async function tryReadBucketSizeReport(
    runner: TeamAnalysisCommandRunner,
    bucket: string,
    warnings: string[],
): Promise<BucketSizeReport | undefined> {
    const result = await runner.run(["r2", "bucket", "info", bucket, "--json"]);
    if (result.exitCode !== 0) {
        warnings.push("Wrangler bucket info was unavailable; the full bucket size cannot be guarded exactly.");
        return undefined;
    }
    try {
        const value = JSON.parse(result.stdout) as { bucket_size?: unknown };
        if (typeof value.bucket_size !== "string") throw new Error("missing bucket_size");
        return parseWranglerBucketSize(value.bucket_size);
    } catch (error) {
        warnings.push(`Wrangler bucket size was not parseable; full bucket visibility is unavailable (${error instanceof Error ? error.message : String(error)}).`);
        return undefined;
    }
}

export function parseWranglerBucketSize(reported: string): BucketSizeReport {
    const match = /^\s*(\d+(?:\.\d+)?)\s*(B|kB|MB|GB|TB)\s*$/.exec(reported);
    if (!match) throw new Error(`Unsupported Wrangler bucket size: ${reported}`);
    const units: Record<string, number> = { B: 1, kB: 1_000, MB: 1_000_000, GB: 1_000_000_000, TB: 1_000_000_000_000 };
    const decimals = match[1].split(".")[1]?.length ?? 0;
    const displayResolution = 10 ** -decimals;
    const upperBound = (Number(match[1]) + displayResolution) * units[match[2]];
    if (!Number.isSafeInteger(Math.ceil(upperBound))) {
        throw new Error(`Wrangler bucket size is outside the safe integer range: ${reported}`);
    }
    return { reported, conservativeUpperBoundBytes: Math.ceil(upperBound) };
}

async function readPublishState(
    statePath: string,
    options: TeamAnalysisR2PublishOptions,
): Promise<{ state?: TeamAnalysisR2PublishState, status: RemoteFacts["stateStatus"], warnings: string[] }> {
    if (!existsSync(statePath)) {
        return { status: "missing", warnings: ["Local publish state is absent; retention is reconstructed from the remote manifest where possible."] };
    }
    try {
        const state = JSON.parse(await readFile(statePath, "utf8")) as TeamAnalysisR2PublishState;
        if (state.schemaVersion !== 1 || !Array.isArray(state.retainedReleases)) {
            return { status: "old-or-invalid", warnings: ["Local publish state is old or invalid and was ignored."] };
        }
        if (state.bucket !== options.bucket || state.target !== options.target) {
            return { status: "mismatched", warnings: ["Local publish state belongs to a different bucket or target and was ignored."] };
        }
        const stateChannel = state.channel ?? "production";
        if (stateChannel !== options.channel) {
            return {
                status: "mismatched",
                warnings: [
                    `Local publish state belongs to ${stateChannel}, not requested channel ${options.channel}, and was ignored.`,
                ],
            };
        }
        const stateContractLane = state.contractLane ?? "v1";
        if (stateContractLane !== options.contractLane) {
            return {
                status: "mismatched",
                warnings: [
                    `Local publish state belongs to ${stateContractLane}, not requested contract lane ${options.contractLane}, and was ignored.`,
                ],
            };
        }
        if (state.retainedReleases.length + (state.cleanupPendingReleases?.length ?? 0) > MAX_TRACKED_RELEASES) {
            return { status: "old-or-invalid", warnings: ["Local publish state exceeds the bounded release history and was ignored."] };
        }
        [...state.retainedReleases, ...(state.cleanupPendingReleases ?? [])]
            .forEach(release => validateRelease(release, options.channel, options.contractLane));
        return { state, status: "valid", warnings: [] };
    } catch (error) {
        return {
            status: "old-or-invalid",
            warnings: [`Local publish state could not be trusted and was ignored: ${error instanceof Error ? error.message : String(error)}`],
        };
    }
}

function validateRemoteManifest(
    manifest: TeamAnalysisManifest,
    channel: DatasetPublicationChannel,
    contractLane: DatasetContractLane,
): void {
    const stringFields: Array<keyof TeamAnalysisManifest> = [
        "datasetVersion", "generatedAt", "fileName", "sha256", "rulesVersion", "parserVersion",
        "sourceCharacterDatasetVersion", "sourceCharacterPayloadSha256",
    ];
    if (manifest.schemaVersion !== 1 || manifest.compression !== "gzip") {
        throw new Error("Unsupported Team Analysis remote manifest schema or compression.");
    }
    for (const field of stringFields) {
        if (typeof manifest[field] !== "string" || String(manifest[field]).length === 0) {
            throw new Error(`Invalid Team Analysis remote manifest ${field}.`);
        }
    }
    if (!/^[a-f0-9]{64}$/i.test(manifest.sha256) || !/^[a-f0-9]{64}$/i.test(manifest.sourceCharacterPayloadSha256)) {
        throw new Error("Invalid Team Analysis remote manifest SHA-256 field.");
    }
    [manifest.sizeBytes, manifest.uncompressedSizeBytes, manifest.stateCount].forEach(value => {
        if (!Number.isSafeInteger(value) || value < 0) throw new Error("Invalid Team Analysis remote manifest numeric field.");
    });
    assertValidObjectKey(manifest.fileName, "Team Analysis remote manifest fileName");
    const expectedKey = buildTeamAnalysisDatasetObjectKey(
        { ...manifest, sha256: manifest.sha256.toLowerCase() },
        channel,
        contractLane,
    );
    if (manifest.fileName !== expectedKey) {
        throw new Error(`Team Analysis remote manifest fileName is not its canonical immutable key: ${manifest.fileName}`);
    }
}

function releaseFromManifest(manifest: TeamAnalysisManifest): TeamAnalysisRetainedRelease {
    return {
        datasetVersion: manifest.datasetVersion,
        datasetObjectKey: manifest.fileName,
        payloadSha256: manifest.sha256.toLowerCase(),
        sizeBytes: manifest.sizeBytes,
        publishedAt: manifest.generatedAt,
    };
}

function validateRelease(
    release: TeamAnalysisRetainedRelease,
    channel: DatasetPublicationChannel,
    contractLane: DatasetContractLane,
): void {
    if (!release || typeof release !== "object") throw new Error("Invalid retained Team Analysis release.");
    if (typeof release.datasetVersion !== "string" || release.datasetVersion.length === 0) {
        throw new Error("Retained Team Analysis release has an invalid datasetVersion.");
    }
    if (typeof release.payloadSha256 !== "string" || !/^[a-f0-9]{64}$/i.test(release.payloadSha256)) {
        throw new Error("Retained Team Analysis release has an invalid payloadSha256.");
    }
    if (!Number.isSafeInteger(release.sizeBytes) || release.sizeBytes < 0) {
        throw new Error("Retained Team Analysis release has an invalid sizeBytes.");
    }
    assertValidObjectKey(release.datasetObjectKey, "retained Team Analysis object key");
    const expectedKey = buildTeamAnalysisDatasetObjectKey(
        {
            datasetVersion: release.datasetVersion,
            sha256: release.payloadSha256,
        } as TeamAnalysisManifest,
        channel,
        contractLane,
    );
    if (release.datasetObjectKey !== expectedKey) {
        throw new Error(`Retained Team Analysis release key is not canonical: ${release.datasetObjectKey}`);
    }
}

function manifestsExactlyMatch(left: TeamAnalysisManifest, right: TeamAnalysisManifest): boolean {
    return canonicalJson(left) === canonicalJson(right);
}

function buildNextPublishState(
    options: TeamAnalysisR2PublishOptions,
    manifest: TeamAnalysisManifest,
    manifestSha256: string,
    retainedReleases: TeamAnalysisRetainedRelease[],
    cleanupPendingReleases: TeamAnalysisRetainedRelease[],
    publishedAt: string,
): TeamAnalysisR2PublishState {
    return {
        schemaVersion: 1,
        bucket: options.bucket,
        target: options.target,
        channel: options.channel,
        contractLane: options.contractLane,
        datasetVersion: manifest.datasetVersion,
        datasetObjectKey: manifest.fileName,
        payloadSha256: manifest.sha256.toLowerCase(),
        manifestSha256,
        publishedAt,
        retainedReleases,
        ...(cleanupPendingReleases.length > 0 ? { cleanupPendingReleases } : {}),
    };
}

async function writePublishState(statePath: string, state: TeamAnalysisR2PublishState): Promise<void> {
    await mkdir(dirname(statePath), { recursive: true });
    const temporaryPath = `${statePath}.tmp-${process.pid}`;
    await writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
    await rename(temporaryPath, statePath);
}

function publishStatesOperationallyEqual(left: TeamAnalysisR2PublishState, right: TeamAnalysisR2PublishState): boolean {
    const normalized = (state: TeamAnalysisR2PublishState) => ({
        schemaVersion: state.schemaVersion,
        bucket: state.bucket,
        target: state.target,
        channel: state.channel ?? "production",
        contractLane: state.contractLane ?? "v1",
        datasetVersion: state.datasetVersion,
        datasetObjectKey: state.datasetObjectKey,
        payloadSha256: state.payloadSha256,
        manifestSha256: state.manifestSha256,
        retainedReleases: state.retainedReleases,
        cleanupPendingReleases: state.cleanupPendingReleases ?? [],
    });
    return JSON.stringify(normalized(left)) === JSON.stringify(normalized(right));
}

async function putObject(
    runner: TeamAnalysisCommandRunner,
    options: TeamAnalysisR2PublishOptions,
    objectKey: string,
    filePath: string,
    contentType: string,
    cacheControl: string,
): Promise<void> {
    assertValidObjectKey(objectKey, "R2 put object key");
    const result = await runner.run([
        "r2", "object", "put", `${options.bucket}/${objectKey}`,
        "--file", filePath,
        "--content-type", contentType,
        "--cache-control", cacheControl,
        targetFlag(options.target),
    ]);
    if (result.exitCode !== 0) throw commandFailure(`put ${objectKey}`, result);
}

async function deleteObject(
    runner: TeamAnalysisCommandRunner,
    options: TeamAnalysisR2PublishOptions,
    objectKey: string,
): Promise<void> {
    assertValidObjectKey(objectKey, "R2 delete object key");
    const result = await runner.run([
        "r2", "object", "delete", `${options.bucket}/${objectKey}`, targetFlag(options.target), "--force",
    ]);
    if (result.exitCode !== 0) throw commandFailure(`delete ${objectKey}`, result);
}

function objectGetArgs(options: TeamAnalysisR2PublishOptions, objectKey: string, filePath: string): string[] {
    assertValidObjectKey(objectKey, "R2 get object key");
    return [
        "r2", "object", "get", `${options.bucket}/${objectKey}`, "--file", filePath, targetFlag(options.target),
    ];
}

function targetFlag(target: "remote" | "local"): "--remote" | "--local" {
    return target === "remote" ? "--remote" : "--local";
}

function createWranglerCommandRunner(): TeamAnalysisCommandRunner {
    const wranglerEntrypoint = resolveWranglerEntrypoint();
    return {
        run: args => new Promise(resolvePromise => {
            execFile(
                process.execPath,
                [wranglerEntrypoint, ...args],
                { maxBuffer: 16 * 1024 * 1024 },
                (error, stdout, stderr) => resolvePromise({
                    exitCode: error && typeof error.code === "number" ? error.code : error ? 1 : 0,
                    stdout,
                    stderr,
                }),
            );
        }),
    };
}

function resolveWranglerEntrypoint(): string {
    const candidates = [
        resolve(__dirname, "node_modules", "wrangler", "bin", "wrangler.js"),
        resolve(__dirname, "..", "node_modules", "wrangler", "bin", "wrangler.js"),
    ];
    const found = candidates.find(candidate => existsSync(candidate));
    if (!found) throw new Error("Wrangler entrypoint was not found in node_modules.");
    return found;
}

function serializeManifest(manifest: TeamAnalysisManifest): Buffer {
    return Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

function datasetVersionSlug(datasetVersion: string): string {
    const slug = datasetVersion.trim().replace(/:/g, "-").replace(/[^A-Za-z0-9._-]/g, "_");
    if (!slug || slug === "." || slug === ".." || slug.length > 200) {
        throw new Error(`Team Analysis datasetVersion cannot form a safe object-key slug: ${datasetVersion}`);
    }
    return slug;
}

function assertValidBucket(bucket: string): void {
    if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket)) {
        throw new Error(`Invalid R2 bucket name: ${bucket}`);
    }
}

function assertDistinctLocalPaths(paths: Record<string, string>): void {
    const seen = new Map<string, string>();
    for (const [label, filePath] of Object.entries(paths)) {
        const normalized = process.platform === "win32" ? filePath.toLowerCase() : filePath;
        const previous = seen.get(normalized);
        if (previous) {
            throw new Error(`Local paths for ${previous} and ${label} must be distinct: ${filePath}`);
        }
        seen.set(normalized, label);
    }
}

function assertValidObjectKey(key: string, label: string): void {
    if (
        !key
        || key.startsWith("/")
        || key.startsWith("\\")
        || /^[A-Za-z]:[\\/]/.test(key)
        || key.includes("\\")
        || key.split("/").some(segment => segment === "" || segment === "." || segment === "..")
        || /[\u0000-\u001f\u007f]/.test(key)
    ) {
        throw new Error(`${label} must be a relative traversal-free object key: ${key}`);
    }
}

function parsePositiveSafeInteger(value: string | undefined, fallback: number): number {
    if (value === undefined) return fallback;
    if (!/^\d+$/.test(value)) throw new Error(`Invalid positive integer: ${value}`);
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed < 1) throw new Error(`Invalid positive integer: ${value}`);
    return parsed;
}

function isMissingObjectResult(result: CommandResult): boolean {
    return /(?:\b404\b|not found|does not exist|nosuchkey)/i.test(`${result.stderr}\n${result.stdout}`);
}

function commandFailure(action: string, result: CommandResult): Error {
    const detail = (result.stderr || result.stdout || `exit code ${result.exitCode}`).trim();
    return new Error(`Wrangler failed to ${action}: ${detail}`);
}

function dedupeReleases(releases: TeamAnalysisRetainedRelease[]): TeamAnalysisRetainedRelease[] {
    const byKey = new Map<string, TeamAnalysisRetainedRelease>();
    releases.forEach(release => {
        if (!byKey.has(release.datasetObjectKey)) byKey.set(release.datasetObjectKey, release);
    });
    return [...byKey.values()];
}

function comparePreviousReleases(left: TeamAnalysisRetainedRelease, right: TeamAnalysisRetainedRelease): number {
    const leftTime = left.publishedAt ? Date.parse(left.publishedAt) : Number.NaN;
    const rightTime = right.publishedAt ? Date.parse(right.publishedAt) : Number.NaN;
    if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) return rightTime - leftTime;
    return right.datasetVersion.localeCompare(left.datasetVersion)
        || left.datasetObjectKey.localeCompare(right.datasetObjectKey);
}

function sumReleaseBytes(releases: TeamAnalysisRetainedRelease[]): number {
    return releases.reduce((sum, release) => sum + release.sizeBytes, 0);
}

function canonicalJson(value: unknown): string {
    if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
    if (value && typeof value === "object") {
        const record = value as Record<string, unknown>;
        return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
    }
    return JSON.stringify(value);
}

async function main(): Promise<void> {
    const options = parseTeamAnalysisR2PublishArgs(process.argv.slice(2));
    await publishTeamAnalysisR2(options);
}

if (require.main === module) {
    main().catch(error => {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
    });
}
