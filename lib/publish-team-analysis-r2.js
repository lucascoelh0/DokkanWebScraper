"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseWranglerBucketSize = exports.printTeamAnalysisR2PublishPlan = exports.publishTeamAnalysisR2 = exports.buildTeamAnalysisR2PublishPlan = exports.readTeamAnalysisR2PublishPlan = exports.buildTeamAnalysisManifestObjectKey = exports.buildTeamAnalysisDatasetObjectKey = exports.parseTeamAnalysisR2PublishArgs = exports.TEAM_ANALYSIS_MANIFEST_CACHE_CONTROL = exports.TEAM_ANALYSIS_PAYLOAD_CACHE_CONTROL = exports.TEAM_ANALYSIS_MANIFEST_OBJECT_KEY = void 0;
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const os_1 = require("os");
const path_1 = require("path");
const dataset_publication_channel_1 = require("./dataset-publication-channel");
const team_analysis_artifacts_1 = require("./team-analysis-artifacts");
const team_analysis_delivery_1 = require("./team-analysis-delivery");
const DEFAULT_BUCKET = "dokkanpanion-data";
const DEFAULT_DATASET_PATH = "data/fyi-characters/latest/team-analysis.json.gz";
const DEFAULT_MANIFEST_PATH = "data/fyi-characters/latest/team-analysis-manifest.json";
const DEFAULT_CHARACTER_DATASET_PATH = "data/fyi-characters/latest/characters.json.gz";
const DEFAULT_CHARACTER_MANIFEST_PATH = "data/fyi-characters/latest/characters-manifest.json";
const DEFAULT_STATE_PATH = "data/fyi-characters/latest/team-analysis-r2-publish-state.json";
const DEFAULT_MAX_TOTAL_BYTES = 10000000000;
const DEFAULT_MAX_NAMESPACE_BYTES = 50000000;
const RETAINED_RELEASE_COUNT = 2;
const MAX_TRACKED_RELEASES = 50;
exports.TEAM_ANALYSIS_MANIFEST_OBJECT_KEY = "team-analysis-manifest.json";
exports.TEAM_ANALYSIS_PAYLOAD_CACHE_CONTROL = "public, max-age=31536000, immutable";
exports.TEAM_ANALYSIS_MANIFEST_CACHE_CONTROL = "no-store";
function parseTeamAnalysisR2PublishArgs(argv) {
    const valueNames = new Set([
        "--bucket", "--dataset", "--manifest", "--characters", "--character-manifest", "--state",
        "--max-total-bytes", "--max-namespace-bytes", "--channel",
    ]);
    const flagNames = new Set([
        "--dry-run", "--remote", "--local", "--skip-remote-manifest-check", "--skip-upload-verification",
        "--allow-unknown-bucket-size", "--promote-production",
    ]);
    const values = new Map();
    const flags = new Set();
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
    const bucket = values.get("--bucket") ?? process.env.R2_BUCKET_NAME ?? DEFAULT_BUCKET;
    assertValidBucket(bucket);
    const channel = (0, dataset_publication_channel_1.parseDatasetPublicationChannel)(values.get("--channel"));
    const resolvedPaths = {
        datasetPath: (0, path_1.resolve)(values.get("--dataset") ?? DEFAULT_DATASET_PATH),
        manifestPath: (0, path_1.resolve)(values.get("--manifest") ?? DEFAULT_MANIFEST_PATH),
        characterDatasetPath: (0, path_1.resolve)(values.get("--characters") ?? DEFAULT_CHARACTER_DATASET_PATH),
        characterManifestPath: (0, path_1.resolve)(values.get("--character-manifest") ?? DEFAULT_CHARACTER_MANIFEST_PATH),
        statePath: values.has("--state")
            ? (0, path_1.resolve)(values.get("--state"))
            : (0, dataset_publication_channel_1.defaultChannelStatePath)(DEFAULT_STATE_PATH, channel),
    };
    assertDistinctLocalPaths(resolvedPaths);
    return {
        bucket,
        ...resolvedPaths,
        dryRun: flags.has("--dry-run"),
        target: flags.has("--local") ? "local" : "remote",
        skipRemoteManifestCheck: flags.has("--skip-remote-manifest-check"),
        skipUploadVerification: flags.has("--skip-upload-verification"),
        allowUnknownBucketSize: flags.has("--allow-unknown-bucket-size"),
        maxTotalBytes: parsePositiveSafeInteger(values.get("--max-total-bytes"), DEFAULT_MAX_TOTAL_BYTES),
        maxNamespaceBytes: parsePositiveSafeInteger(values.get("--max-namespace-bytes"), DEFAULT_MAX_NAMESPACE_BYTES),
        channel,
        manifestObjectKey: buildTeamAnalysisManifestObjectKey(channel),
        promoteProduction: flags.has("--promote-production"),
    };
}
exports.parseTeamAnalysisR2PublishArgs = parseTeamAnalysisR2PublishArgs;
function buildTeamAnalysisDatasetObjectKey(manifest, channel = "production") {
    const slug = datasetVersionSlug(manifest.datasetVersion);
    const key = (0, dataset_publication_channel_1.channelObjectKey)(channel, `team-analysis/releases/${slug}/${manifest.sha256.toLowerCase()}/${team_analysis_delivery_1.TEAM_ANALYSIS_LOCAL_FILE_NAME}`);
    assertValidObjectKey(key, "Team Analysis payload object key");
    return key;
}
exports.buildTeamAnalysisDatasetObjectKey = buildTeamAnalysisDatasetObjectKey;
function buildTeamAnalysisManifestObjectKey(channel = "production") {
    return (0, dataset_publication_channel_1.channelObjectKey)(channel, exports.TEAM_ANALYSIS_MANIFEST_OBJECT_KEY);
}
exports.buildTeamAnalysisManifestObjectKey = buildTeamAnalysisManifestObjectKey;
async function readTeamAnalysisR2PublishPlan(options, runner = createWranglerCommandRunner()) {
    const requiredFiles = [
        ["Team Analysis payload", options.datasetPath],
        ["Team Analysis manifest", options.manifestPath],
        ["character payload", options.characterDatasetPath],
        ["character manifest", options.characterManifestPath],
    ];
    for (const [label, filePath] of requiredFiles) {
        if (!(0, fs_1.existsSync)(filePath)) {
            throw new Error(`${label} not found: ${filePath}`);
        }
    }
    const [datasetBuffer, manifestBuffer, characterDatasetBuffer, characterManifestBuffer] = await Promise.all([
        (0, promises_1.readFile)(options.datasetPath),
        (0, promises_1.readFile)(options.manifestPath),
        (0, promises_1.readFile)(options.characterDatasetPath),
        (0, promises_1.readFile)(options.characterManifestPath),
    ]);
    const validated = (0, team_analysis_delivery_1.validateTeamAnalysisDeliveryBuffers)({
        datasetBuffer,
        manifestBuffer,
        characterDatasetBuffer,
        characterManifestBuffer,
    });
    const stateRead = await readPublishState(options.statePath, options);
    const remoteFacts = await inspectRemoteFacts(options, validated, stateRead, runner);
    return buildTeamAnalysisR2PublishPlan(options, validated, remoteFacts);
}
exports.readTeamAnalysisR2PublishPlan = readTeamAnalysisR2PublishPlan;
function buildTeamAnalysisR2PublishPlan(options, validated, facts) {
    const datasetObjectKey = buildTeamAnalysisDatasetObjectKey(validated.manifest, options.channel);
    const remoteManifest = { ...validated.manifest, fileName: datasetObjectKey };
    const remoteManifestBuffer = serializeManifest(remoteManifest);
    const manifestMatches = facts.manifest ? manifestsExactlyMatch(remoteManifest, facts.manifest) : false;
    const remoteManifestSha256 = manifestMatches && facts.manifestSha256
        ? facts.manifestSha256
        : (0, team_analysis_artifacts_1.sha256)(remoteManifestBuffer);
    const remoteManifestStatus = options.skipRemoteManifestCheck
        ? "skipped"
        : facts.manifest
            ? manifestMatches ? "matching" : "different"
            : "missing";
    const payloadUploadNeeded = !facts.plannedPayloadPresent;
    const manifestUpdateNeeded = !manifestMatches;
    const currentRelease = {
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
        if (left.datasetObjectKey === activeRemoteObjectKey)
            return -1;
        if (right.datasetObjectKey === activeRemoteObjectKey)
            return 1;
        return comparePreviousReleases(left, right);
    });
    if (existingReleases.length + 1 > MAX_TRACKED_RELEASES) {
        throw new Error(`Team Analysis has ${existingReleases.length + 1} verified releases, above the bounded tracked-release limit of ${MAX_TRACKED_RELEASES}.`);
    }
    const retainedReleases = [currentRelease, ...existingReleases].slice(0, RETAINED_RELEASE_COUNT);
    const retainedKeys = new Set(retainedReleases.map(release => release.datasetObjectKey));
    const cleanupCandidates = existingReleases
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
        throw new Error(`Team Analysis known managed peak ${knownManagedBytesBeforeCleanup} bytes exceeds namespace limit ${options.maxNamespaceBytes} bytes before cleanup.`);
    }
    if (knownManagedBytesBeforeCleanup > options.maxTotalBytes) {
        throw new Error(`Team Analysis known managed peak ${knownManagedBytesBeforeCleanup} bytes exceeds global limit ${options.maxTotalBytes} bytes.`);
    }
    let projectedBucketUpperBoundBytes;
    if (facts.bucketSizeReport) {
        const previousManifestBytes = facts.manifestBytes ?? 0;
        projectedBucketUpperBoundBytes = facts.bucketSizeReport.conservativeUpperBoundBytes
            + (payloadUploadNeeded ? remoteManifest.sizeBytes : 0)
            + (manifestUpdateNeeded ? Math.max(0, remoteManifestBuffer.byteLength - previousManifestBytes) : 0);
        if (projectedBucketUpperBoundBytes > options.maxTotalBytes) {
            throw new Error(`Projected conservative bucket upper bound ${projectedBucketUpperBoundBytes} bytes exceeds global limit ${options.maxTotalBytes} bytes.`);
        }
    }
    else if (options.target === "remote" && !options.dryRun && !options.allowUnknownBucketSize) {
        throw new Error("Wrangler bucket size is unavailable. Refusing remote writes without the explicit --allow-unknown-bucket-size recovery flag.");
    }
    const nextState = buildNextPublishState(options, remoteManifest, remoteManifestSha256, retainedReleases, cleanupCandidates, facts.state?.publishedAt ?? remoteManifest.generatedAt);
    const stateUpdateNeeded = !facts.state || !publishStatesOperationallyEqual(facts.state, nextState);
    const plannedActions = [];
    if (payloadUploadNeeded)
        plannedActions.push(`put ${datasetObjectKey}`);
    if (payloadUploadNeeded && !options.skipUploadVerification)
        plannedActions.push(`verify ${datasetObjectKey}`);
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
    if (plannedActions.length === 0)
        plannedActions.push("no writes; remote manifest, payload, and state are aligned");
    return {
        options,
        localManifest: validated.manifest,
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
            "Wrangler does not expose an object listing in this flow; retention covers the remote manifest and verified state-tracked releases.",
        ],
        plannedActions,
    };
}
exports.buildTeamAnalysisR2PublishPlan = buildTeamAnalysisR2PublishPlan;
async function publishTeamAnalysisR2(options, runner = createWranglerCommandRunner(), now = () => new Date()) {
    (0, dataset_publication_channel_1.assertDatasetPublicationWriteAuthorized)(options);
    const plan = await readTeamAnalysisR2PublishPlan(options, runner);
    printTeamAnalysisR2PublishPlan(plan);
    if (options.dryRun) {
        console.log("Dry run complete. No put, delete, manifest, state, or input artifact was changed.");
        return { plan, cleanupFailures: [] };
    }
    if (plan.payloadUploadNeeded) {
        await putObject(runner, options, plan.datasetObjectKey, options.datasetPath, "application/gzip", exports.TEAM_ANALYSIS_PAYLOAD_CACHE_CONTROL);
        if (!options.skipUploadVerification) {
            await assertRemotePayloadMatches(runner, options, plan.datasetObjectKey, plan.remoteManifest.sha256, plan.remoteManifest.sizeBytes);
        }
    }
    if (plan.manifestUpdateNeeded) {
        const temporaryDirectory = await (0, promises_1.mkdtemp)((0, path_1.resolve)((0, os_1.tmpdir)(), "dokkan-team-analysis-manifest-"));
        const temporaryManifestPath = (0, path_1.resolve)(temporaryDirectory, exports.TEAM_ANALYSIS_MANIFEST_OBJECT_KEY);
        const manifestBuffer = serializeManifest(plan.remoteManifest);
        try {
            await (0, promises_1.writeFile)(temporaryManifestPath, manifestBuffer);
            await putObject(runner, options, options.manifestObjectKey, temporaryManifestPath, "application/json", exports.TEAM_ANALYSIS_MANIFEST_CACHE_CONTROL);
            if (!options.skipUploadVerification) {
                await assertRemoteManifestMatches(runner, options, plan.remoteManifest, manifestBuffer);
            }
        }
        finally {
            await (0, promises_1.rm)(temporaryDirectory, { recursive: true, force: true });
        }
    }
    const publishedAt = now().toISOString();
    const stateWithPendingCleanup = buildNextPublishState(options, plan.remoteManifest, plan.remoteManifestSha256, plan.retainedReleases, plan.cleanupCandidates, publishedAt);
    if (plan.stateUpdateNeeded || plan.manifestUpdateNeeded || plan.payloadUploadNeeded || plan.cleanupCandidates.length > 0) {
        await writePublishState(options.statePath, stateWithPendingCleanup);
    }
    const cleanupFailures = [];
    const failedCleanupReleases = [];
    for (const release of plan.cleanupCandidates) {
        try {
            await deleteObject(runner, options, release.datasetObjectKey);
        }
        catch (error) {
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
    }
    else {
        console.log("Team Analysis R2 publication completed; the manifest was promoted only after payload readiness.");
    }
    return { plan, cleanupFailures };
}
exports.publishTeamAnalysisR2 = publishTeamAnalysisR2;
function printTeamAnalysisR2PublishPlan(plan) {
    console.log(`Target: ${plan.options.target}`);
    console.log(`Bucket: ${plan.options.bucket}`);
    console.log(`Channel: ${plan.options.channel}`);
    console.log(`Manifest object key: ${plan.options.manifestObjectKey}`);
    console.log(`Version: ${plan.remoteManifest.datasetVersion}`);
    console.log(`SHA-256: ${plan.remoteManifest.sha256}`);
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
        console.log(`Wrangler bucket size: ${plan.bucketSizeReport.reported}; conservative projected upper bound: ${plan.projectedBucketUpperBoundBytes} bytes.`);
        console.log("Bucket total visibility: approximate human-readable Wrangler value, not an exact byte inventory.");
    }
    else {
        console.log("Bucket total visibility: unavailable; managed namespace bytes are not the total bucket size.");
    }
    console.log(`Planned actions: ${plan.plannedActions.join(" -> ")}`);
    plan.warnings.forEach(warning => console.log(`Warning: ${warning}`));
}
exports.printTeamAnalysisR2PublishPlan = printTeamAnalysisR2PublishPlan;
async function inspectRemoteFacts(options, validated, stateRead, runner) {
    const warnings = [...stateRead.warnings];
    let manifest;
    let manifestBytes;
    let manifestSha256;
    if (!options.skipRemoteManifestCheck) {
        const remote = await tryGetJsonObject(runner, options, options.manifestObjectKey, "Team Analysis remote manifest");
        if (remote) {
            validateRemoteManifest(remote.value, options.channel);
            manifest = remote.value;
            manifestBytes = remote.bytes;
            manifestSha256 = remote.sha256;
        }
    }
    else {
        warnings.push("Remote manifest check was explicitly skipped; the update plan cannot be idempotence-authoritative.");
    }
    const plannedRelease = {
        datasetVersion: validated.manifest.datasetVersion,
        datasetObjectKey: buildTeamAnalysisDatasetObjectKey(validated.manifest, options.channel),
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
    const verifiedReleases = [];
    let plannedPayloadPresent = false;
    for (const release of releaseCandidates) {
        validateRelease(release, options.channel);
        const matches = await remotePayloadMatches(runner, options, release);
        if (matches) {
            verifiedReleases.push(release);
            if (release.datasetObjectKey === plannedRelease.datasetObjectKey) {
                plannedPayloadPresent = true;
            }
        }
        else if (release.datasetObjectKey !== plannedRelease.datasetObjectKey) {
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
async function tryGetJsonObject(runner, options, objectKey, label) {
    assertValidObjectKey(objectKey, label);
    const temporaryDirectory = await (0, promises_1.mkdtemp)((0, path_1.resolve)((0, os_1.tmpdir)(), "dokkan-team-analysis-get-"));
    const temporaryPath = (0, path_1.resolve)(temporaryDirectory, "object.json");
    try {
        const result = await runner.run(objectGetArgs(options, objectKey, temporaryPath));
        if (result.exitCode !== 0) {
            if (isMissingObjectResult(result))
                return undefined;
            throw commandFailure(`read ${label}`, result);
        }
        const buffer = await (0, promises_1.readFile)(temporaryPath);
        let value;
        try {
            value = JSON.parse(buffer.toString("utf8"));
        }
        catch (error) {
            throw new Error(`${label} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
        }
        if (!value || typeof value !== "object" || Array.isArray(value)) {
            throw new Error(`${label} must be a JSON object.`);
        }
        return { value: value, bytes: buffer.byteLength, sha256: (0, team_analysis_artifacts_1.sha256)(buffer) };
    }
    finally {
        await (0, promises_1.rm)(temporaryDirectory, { recursive: true, force: true });
    }
}
async function remotePayloadMatches(runner, options, release) {
    const temporaryDirectory = await (0, promises_1.mkdtemp)((0, path_1.resolve)((0, os_1.tmpdir)(), "dokkan-team-analysis-payload-"));
    const temporaryPath = (0, path_1.resolve)(temporaryDirectory, team_analysis_delivery_1.TEAM_ANALYSIS_LOCAL_FILE_NAME);
    try {
        const result = await runner.run(objectGetArgs(options, release.datasetObjectKey, temporaryPath));
        if (result.exitCode !== 0) {
            if (isMissingObjectResult(result))
                return false;
            throw commandFailure(`read ${release.datasetObjectKey}`, result);
        }
        const buffer = await (0, promises_1.readFile)(temporaryPath);
        return buffer.byteLength === release.sizeBytes && (0, team_analysis_artifacts_1.sha256)(buffer) === release.payloadSha256.toLowerCase();
    }
    finally {
        await (0, promises_1.rm)(temporaryDirectory, { recursive: true, force: true });
    }
}
async function assertRemotePayloadMatches(runner, options, objectKey, expectedSha256, expectedSizeBytes) {
    const matches = await remotePayloadMatches(runner, options, {
        datasetVersion: "upload-verification",
        datasetObjectKey: objectKey,
        payloadSha256: expectedSha256,
        sizeBytes: expectedSizeBytes,
    });
    if (!matches) {
        throw new Error(`Uploaded Team Analysis payload failed size/SHA-256 verification: ${objectKey}`);
    }
}
async function assertRemoteManifestMatches(runner, options, expectedManifest, expectedBuffer) {
    const remote = await tryGetJsonObject(runner, options, options.manifestObjectKey, "uploaded Team Analysis manifest");
    const matches = remote
        && remote.bytes === expectedBuffer.byteLength
        && remote.sha256 === (0, team_analysis_artifacts_1.sha256)(expectedBuffer)
        && manifestsExactlyMatch(remote.value, expectedManifest);
    if (!matches) {
        throw new Error("Uploaded Team Analysis manifest failed content/size/SHA-256 verification.");
    }
}
async function tryReadBucketSizeReport(runner, bucket, warnings) {
    const result = await runner.run(["r2", "bucket", "info", bucket, "--json"]);
    if (result.exitCode !== 0) {
        warnings.push("Wrangler bucket info was unavailable; the full bucket size cannot be guarded exactly.");
        return undefined;
    }
    try {
        const value = JSON.parse(result.stdout);
        if (typeof value.bucket_size !== "string")
            throw new Error("missing bucket_size");
        return parseWranglerBucketSize(value.bucket_size);
    }
    catch (error) {
        warnings.push(`Wrangler bucket size was not parseable; full bucket visibility is unavailable (${error instanceof Error ? error.message : String(error)}).`);
        return undefined;
    }
}
function parseWranglerBucketSize(reported) {
    const match = /^\s*(\d+(?:\.\d+)?)\s*(B|kB|MB|GB|TB)\s*$/.exec(reported);
    if (!match)
        throw new Error(`Unsupported Wrangler bucket size: ${reported}`);
    const units = { B: 1, kB: 1000, MB: 1000000, GB: 1000000000, TB: 1000000000000 };
    const decimals = match[1].split(".")[1]?.length ?? 0;
    const displayResolution = 10 ** -decimals;
    const upperBound = (Number(match[1]) + displayResolution) * units[match[2]];
    if (!Number.isSafeInteger(Math.ceil(upperBound))) {
        throw new Error(`Wrangler bucket size is outside the safe integer range: ${reported}`);
    }
    return { reported, conservativeUpperBoundBytes: Math.ceil(upperBound) };
}
exports.parseWranglerBucketSize = parseWranglerBucketSize;
async function readPublishState(statePath, options) {
    if (!(0, fs_1.existsSync)(statePath)) {
        return { status: "missing", warnings: ["Local publish state is absent; retention is reconstructed from the remote manifest where possible."] };
    }
    try {
        const state = JSON.parse(await (0, promises_1.readFile)(statePath, "utf8"));
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
        if (state.retainedReleases.length + (state.cleanupPendingReleases?.length ?? 0) > MAX_TRACKED_RELEASES) {
            return { status: "old-or-invalid", warnings: ["Local publish state exceeds the bounded release history and was ignored."] };
        }
        [...state.retainedReleases, ...(state.cleanupPendingReleases ?? [])]
            .forEach(release => validateRelease(release, options.channel));
        return { state, status: "valid", warnings: [] };
    }
    catch (error) {
        return {
            status: "old-or-invalid",
            warnings: [`Local publish state could not be trusted and was ignored: ${error instanceof Error ? error.message : String(error)}`],
        };
    }
}
function validateRemoteManifest(manifest, channel) {
    const stringFields = [
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
        if (!Number.isSafeInteger(value) || value < 0)
            throw new Error("Invalid Team Analysis remote manifest numeric field.");
    });
    assertValidObjectKey(manifest.fileName, "Team Analysis remote manifest fileName");
    const expectedKey = buildTeamAnalysisDatasetObjectKey({ ...manifest, sha256: manifest.sha256.toLowerCase() }, channel);
    if (manifest.fileName !== expectedKey) {
        throw new Error(`Team Analysis remote manifest fileName is not its canonical immutable key: ${manifest.fileName}`);
    }
}
function releaseFromManifest(manifest) {
    return {
        datasetVersion: manifest.datasetVersion,
        datasetObjectKey: manifest.fileName,
        payloadSha256: manifest.sha256.toLowerCase(),
        sizeBytes: manifest.sizeBytes,
        publishedAt: manifest.generatedAt,
    };
}
function validateRelease(release, channel) {
    if (!release || typeof release !== "object")
        throw new Error("Invalid retained Team Analysis release.");
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
    const expectedKey = buildTeamAnalysisDatasetObjectKey({
        datasetVersion: release.datasetVersion,
        sha256: release.payloadSha256,
    }, channel);
    if (release.datasetObjectKey !== expectedKey) {
        throw new Error(`Retained Team Analysis release key is not canonical: ${release.datasetObjectKey}`);
    }
}
function manifestsExactlyMatch(left, right) {
    return canonicalJson(left) === canonicalJson(right);
}
function buildNextPublishState(options, manifest, manifestSha256, retainedReleases, cleanupPendingReleases, publishedAt) {
    return {
        schemaVersion: 1,
        bucket: options.bucket,
        target: options.target,
        channel: options.channel,
        datasetVersion: manifest.datasetVersion,
        datasetObjectKey: manifest.fileName,
        payloadSha256: manifest.sha256.toLowerCase(),
        manifestSha256,
        publishedAt,
        retainedReleases,
        ...(cleanupPendingReleases.length > 0 ? { cleanupPendingReleases } : {}),
    };
}
async function writePublishState(statePath, state) {
    await (0, promises_1.mkdir)((0, path_1.dirname)(statePath), { recursive: true });
    const temporaryPath = `${statePath}.tmp-${process.pid}`;
    await (0, promises_1.writeFile)(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
    await (0, promises_1.rename)(temporaryPath, statePath);
}
function publishStatesOperationallyEqual(left, right) {
    const normalized = (state) => ({
        schemaVersion: state.schemaVersion,
        bucket: state.bucket,
        target: state.target,
        channel: state.channel ?? "production",
        datasetVersion: state.datasetVersion,
        datasetObjectKey: state.datasetObjectKey,
        payloadSha256: state.payloadSha256,
        manifestSha256: state.manifestSha256,
        retainedReleases: state.retainedReleases,
        cleanupPendingReleases: state.cleanupPendingReleases ?? [],
    });
    return JSON.stringify(normalized(left)) === JSON.stringify(normalized(right));
}
async function putObject(runner, options, objectKey, filePath, contentType, cacheControl) {
    assertValidObjectKey(objectKey, "R2 put object key");
    const result = await runner.run([
        "r2", "object", "put", `${options.bucket}/${objectKey}`,
        "--file", filePath,
        "--content-type", contentType,
        "--cache-control", cacheControl,
        targetFlag(options.target),
    ]);
    if (result.exitCode !== 0)
        throw commandFailure(`put ${objectKey}`, result);
}
async function deleteObject(runner, options, objectKey) {
    assertValidObjectKey(objectKey, "R2 delete object key");
    const result = await runner.run([
        "r2", "object", "delete", `${options.bucket}/${objectKey}`, targetFlag(options.target), "--force",
    ]);
    if (result.exitCode !== 0)
        throw commandFailure(`delete ${objectKey}`, result);
}
function objectGetArgs(options, objectKey, filePath) {
    assertValidObjectKey(objectKey, "R2 get object key");
    return [
        "r2", "object", "get", `${options.bucket}/${objectKey}`, "--file", filePath, targetFlag(options.target),
    ];
}
function targetFlag(target) {
    return target === "remote" ? "--remote" : "--local";
}
function createWranglerCommandRunner() {
    const wranglerEntrypoint = resolveWranglerEntrypoint();
    return {
        run: args => new Promise(resolvePromise => {
            (0, child_process_1.execFile)(process.execPath, [wranglerEntrypoint, ...args], { maxBuffer: 16 * 1024 * 1024 }, (error, stdout, stderr) => resolvePromise({
                exitCode: error && typeof error.code === "number" ? error.code : error ? 1 : 0,
                stdout,
                stderr,
            }));
        }),
    };
}
function resolveWranglerEntrypoint() {
    const candidates = [
        (0, path_1.resolve)(__dirname, "node_modules", "wrangler", "bin", "wrangler.js"),
        (0, path_1.resolve)(__dirname, "..", "node_modules", "wrangler", "bin", "wrangler.js"),
    ];
    const found = candidates.find(candidate => (0, fs_1.existsSync)(candidate));
    if (!found)
        throw new Error("Wrangler entrypoint was not found in node_modules.");
    return found;
}
function serializeManifest(manifest) {
    return Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}
function datasetVersionSlug(datasetVersion) {
    const slug = datasetVersion.trim().replace(/:/g, "-").replace(/[^A-Za-z0-9._-]/g, "_");
    if (!slug || slug === "." || slug === ".." || slug.length > 200) {
        throw new Error(`Team Analysis datasetVersion cannot form a safe object-key slug: ${datasetVersion}`);
    }
    return slug;
}
function assertValidBucket(bucket) {
    if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket)) {
        throw new Error(`Invalid R2 bucket name: ${bucket}`);
    }
}
function assertDistinctLocalPaths(paths) {
    const seen = new Map();
    for (const [label, filePath] of Object.entries(paths)) {
        const normalized = process.platform === "win32" ? filePath.toLowerCase() : filePath;
        const previous = seen.get(normalized);
        if (previous) {
            throw new Error(`Local paths for ${previous} and ${label} must be distinct: ${filePath}`);
        }
        seen.set(normalized, label);
    }
}
function assertValidObjectKey(key, label) {
    if (!key
        || key.startsWith("/")
        || key.startsWith("\\")
        || /^[A-Za-z]:[\\/]/.test(key)
        || key.includes("\\")
        || key.split("/").some(segment => segment === "" || segment === "." || segment === "..")
        || /[\u0000-\u001f\u007f]/.test(key)) {
        throw new Error(`${label} must be a relative traversal-free object key: ${key}`);
    }
}
function parsePositiveSafeInteger(value, fallback) {
    if (value === undefined)
        return fallback;
    if (!/^\d+$/.test(value))
        throw new Error(`Invalid positive integer: ${value}`);
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed < 1)
        throw new Error(`Invalid positive integer: ${value}`);
    return parsed;
}
function isMissingObjectResult(result) {
    return /(?:\b404\b|not found|does not exist|nosuchkey)/i.test(`${result.stderr}\n${result.stdout}`);
}
function commandFailure(action, result) {
    const detail = (result.stderr || result.stdout || `exit code ${result.exitCode}`).trim();
    return new Error(`Wrangler failed to ${action}: ${detail}`);
}
function dedupeReleases(releases) {
    const byKey = new Map();
    releases.forEach(release => {
        if (!byKey.has(release.datasetObjectKey))
            byKey.set(release.datasetObjectKey, release);
    });
    return [...byKey.values()];
}
function comparePreviousReleases(left, right) {
    const leftTime = left.publishedAt ? Date.parse(left.publishedAt) : Number.NaN;
    const rightTime = right.publishedAt ? Date.parse(right.publishedAt) : Number.NaN;
    if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime)
        return rightTime - leftTime;
    return right.datasetVersion.localeCompare(left.datasetVersion)
        || left.datasetObjectKey.localeCompare(right.datasetObjectKey);
}
function sumReleaseBytes(releases) {
    return releases.reduce((sum, release) => sum + release.sizeBytes, 0);
}
function canonicalJson(value) {
    if (Array.isArray(value))
        return `[${value.map(canonicalJson).join(",")}]`;
    if (value && typeof value === "object") {
        const record = value;
        return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
    }
    return JSON.stringify(value);
}
async function main() {
    const options = parseTeamAnalysisR2PublishArgs(process.argv.slice(2));
    await publishTeamAnalysisR2(options);
}
if (require.main === module) {
    main().catch(error => {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
    });
}
//# sourceMappingURL=publish-team-analysis-r2.js.map