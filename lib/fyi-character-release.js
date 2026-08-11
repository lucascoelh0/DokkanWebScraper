"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseFyiCharacterReleaseCli = exports.runFyiCharacterReleasePipeline = exports.readValidatedFyiCharacterRelease = exports.buildFyiCharacterReleaseK23 = exports.buildFyiCharacterReleaseK22 = exports.buildFyiCharacterReleaseK21 = exports.FYI_CHARACTER_BUCKET_MAX_BYTES = exports.FYI_CHARACTER_RELEASE_MAX_BYTES = exports.FYI_CHARACTER_RELEASE_SOURCE_MARKER = exports.FYI_CHARACTER_RELEASE_K20 = exports.FYI_CHARACTER_RELEASE_READY = exports.FYI_CHARACTER_RELEASE_RECEIPT = exports.FYI_CHARACTER_RELEASE_PLAN = exports.FYI_CHARACTER_RELEASE_REPORT = exports.FYI_CHARACTER_RELEASE_ROOT = void 0;
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const zlib_1 = require("zlib");
const artifact_path_1 = require("./artifact-path");
const artifact_path_2 = require("./database-characters/artifact-path");
const compact_validator_1 = require("./database-characters/compact-validator");
const fyi_character_candidate_1 = require("./fyi-character-candidate");
const fyi_character_candidate_readiness_1 = require("./fyi-character-candidate-readiness");
exports.FYI_CHARACTER_RELEASE_ROOT = "releases-k21";
exports.FYI_CHARACTER_RELEASE_REPORT = "release-k21.json";
exports.FYI_CHARACTER_RELEASE_PLAN = "release-plan-k22.json";
exports.FYI_CHARACTER_RELEASE_RECEIPT = "release-receipt-k23.json";
exports.FYI_CHARACTER_RELEASE_READY = ".release-k21-ready.json";
exports.FYI_CHARACTER_RELEASE_K20 = "candidate-readiness-k20.json";
exports.FYI_CHARACTER_RELEASE_SOURCE_MARKER = "candidate-k19-ready.source.json";
exports.FYI_CHARACTER_RELEASE_MAX_BYTES = 50000000;
exports.FYI_CHARACTER_BUCKET_MAX_BYTES = 10000000000;
const sha256 = (value) => (0, crypto_1.createHash)("sha256").update(value).digest("hex");
const JSON_BYTES = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
const PORTRAIT_KEY = /^images\/v2\/portrait_\d+\.png$/;
const RELEASE_ID = /^[a-f0-9]{64}-[a-f0-9]{64}$/;
function assertReleaseId(value) {
    if (!RELEASE_ID.test(value))
        throw new Error("K21 release ID rejected");
}
function assertContained(root, path) {
    const remainder = (0, path_1.relative)(root, path);
    if (remainder === "" || remainder === ".." || remainder.startsWith(`..${path_1.sep}`)) {
        if (remainder !== "")
            throw new Error("release path escaped root");
        return;
    }
    if ((0, path_1.resolve)(root, remainder) !== path)
        throw new Error("release path escaped root");
}
async function readContainedFile(root, untrustedPath) {
    const path = await (0, artifact_path_1.resolveContainedArtifactPath)({ trustedRoot: root, untrustedPath, expectedType: "file" }, (code, artifactType) => new artifact_path_2.DatabaseCharacterArtifactPathError(code, artifactType));
    return (0, promises_1.readFile)(path);
}
function collectPortraitKeys(value, result = new Set()) {
    if (Array.isArray(value)) {
        for (const item of value)
            collectPortraitKeys(item, result);
        return result;
    }
    if (!value || typeof value !== "object")
        return result;
    for (const [key, nested] of Object.entries(value)) {
        if (key === "portraitURL" && typeof nested === "string" && nested.length > 0) {
            if (!PORTRAIT_KEY.test(nested))
                throw new Error(`K21 portrait object key rejected: ${nested}`);
            result.add(nested);
        }
        else {
            collectPortraitKeys(nested, result);
        }
    }
    return result;
}
function decodeCharacters(gzip, manifest) {
    if (manifest.schemaVersion !== 1 || manifest.compression !== "gzip" || manifest.fileName !== "characters.json.gz") {
        throw new Error("K21 character manifest contract rejected");
    }
    if (sha256(gzip) !== manifest.sha256 || gzip.length !== manifest.sizeBytes)
        throw new Error("K21 character payload hash rejected");
    const raw = (0, zlib_1.gunzipSync)(gzip);
    if (raw.length !== manifest.uncompressedSizeBytes)
        throw new Error("K21 character raw size rejected");
    const parsed = JSON.parse(raw.toString("utf8"));
    if (!Array.isArray(parsed) || parsed.length !== manifest.characterCount)
        throw new Error("K21 character count rejected");
    return parsed;
}
function buildFyiCharacterReleaseK21(input) {
    if (input.k20.schemaVersion !== 1
        || input.k20.contract !== "dokkan-fyi-character-database-candidate-readiness-k20"
        || input.k20.contractVersion !== "1.0.0"
        || input.k20.generatedAt !== input.candidateManifest.generatedAt
        || input.k20.readiness.candidateGenerationValidation !== "GO"
        || input.k20.failures.total !== 0
        || Object.values(input.k20.checks ?? {}).some(check => check !== true)) {
        throw new Error("K21 requires a clean K20 GO");
    }
    const candidateLineage = input.k20.sources?.candidate;
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
    if (new Set(entries.map(entry => entry.objectKey)).size !== entries.length)
        throw new Error("K21 duplicate portrait entry");
    if (JSON.stringify(referenced) !== JSON.stringify(entries.map(entry => entry.objectKey)))
        throw new Error("K21 portrait inventory mismatch");
    for (const entry of entries) {
        if (!PORTRAIT_KEY.test(entry.objectKey) || entry.fileName !== (0, path_1.basename)(entry.objectKey)
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
            candidateDirectory: fyi_character_candidate_1.FYI_CHARACTER_CANDIDATE_DIRECTORY,
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
exports.buildFyiCharacterReleaseK21 = buildFyiCharacterReleaseK21;
function versionSlug(value) {
    const slug = value.trim().replace(/:/g, "-").replace(/[^\w.-]/g, "_");
    if (!slug || slug.includes(".."))
        throw new Error("K22 dataset version rejected");
    return slug;
}
function buildFyiCharacterReleaseK22(release) {
    assertReleaseId(release.releaseId);
    if (release.readiness.materialization !== "GO" || !release.safety.contentAddressedRelease
        || release.portraits.inventorySha256 !== sha256(JSON_BYTES(release.portraits.entries))) {
        throw new Error("K22 release report rejected");
    }
    const payloadObjectKey = `releases/${versionSlug(release.dataset.datasetVersion)}/${release.dataset.sha256}/characters.json.gz`;
    const remoteManifest = { ...release.dataset, fileName: payloadObjectKey };
    delete remoteManifest.localFileName;
    const manifestBytes = JSON_BYTES(remoteManifest);
    const objects = [
        {
            kind: "payload", localPath: "characters.json.gz", objectKey: payloadObjectKey,
            sha256: release.dataset.sha256, sizeBytes: release.dataset.sizeBytes,
            cacheControl: "public, max-age=31536000, immutable", remoteHashProofRequired: false,
        },
        ...release.portraits.entries.map(entry => ({
            kind: "portrait", localPath: `portraits/${entry.fileName}`, objectKey: entry.objectKey,
            sha256: entry.sha256, sizeBytes: entry.sizeBytes,
            cacheControl: "public, max-age=31536000, immutable", remoteHashProofRequired: true,
        })),
        {
            kind: "manifest", localPath: "characters-manifest.remote.json", objectKey: "characters-manifest.json",
            sha256: sha256(manifestBytes), sizeBytes: manifestBytes.length,
            cacheControl: "no-store", remoteHashProofRequired: false,
        },
    ];
    const worstCaseNewBytes = objects.reduce((total, object) => total + object.sizeBytes, 0);
    if (new Set(objects.map(object => object.objectKey)).size !== objects.length)
        throw new Error("K22 duplicate object key");
    if (worstCaseNewBytes > exports.FYI_CHARACTER_RELEASE_MAX_BYTES || worstCaseNewBytes > exports.FYI_CHARACTER_BUCKET_MAX_BYTES) {
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
            namespaceLimitBytes: exports.FYI_CHARACTER_RELEASE_MAX_BYTES,
            bucketLimitBytes: exports.FYI_CHARACTER_BUCKET_MAX_BYTES,
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
exports.buildFyiCharacterReleaseK22 = buildFyiCharacterReleaseK22;
function buildFyiCharacterReleaseK23(release, plan) {
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
exports.buildFyiCharacterReleaseK23 = buildFyiCharacterReleaseK23;
async function writeExclusive(path, bytes) {
    const handle = await (0, promises_1.open)(path, fs_1.constants.O_CREAT | fs_1.constants.O_EXCL | fs_1.constants.O_WRONLY | (fs_1.constants.O_NOFOLLOW ?? 0), 0o600);
    try {
        await handle.writeFile(bytes);
        await handle.sync();
        const metadata = await handle.stat();
        if (!metadata.isFile() || metadata.nlink !== 1 || metadata.size !== bytes.length) {
            throw new Error("K21 staged file identity rejected");
        }
    }
    finally {
        await handle.close();
    }
}
async function captureOwnedDirectory(path) {
    const metadata = await (0, promises_1.lstat)(path);
    if (!metadata.isDirectory() || metadata.isSymbolicLink() || await (0, promises_1.realpath)(path) !== path) {
        throw new Error("K21 owned directory rejected");
    }
    return { path, dev: metadata.dev, ino: metadata.ino };
}
async function assertOwnedDirectory(identity) {
    const metadata = await (0, promises_1.lstat)(identity.path);
    if (!metadata.isDirectory() || metadata.isSymbolicLink() || metadata.dev !== identity.dev
        || metadata.ino !== identity.ino || await (0, promises_1.realpath)(identity.path) !== identity.path) {
        throw new Error("K21 owned directory identity changed");
    }
}
async function writeOwnedFile(identity, fileName, bytes) {
    if ((0, path_1.basename)(fileName) !== fileName)
        throw new Error("K21 owned filename rejected");
    await assertOwnedDirectory(identity);
    await writeExclusive((0, path_1.join)(identity.path, fileName), bytes);
    await assertOwnedDirectory(identity);
}
function releaseMarker(release, plan, receipt) {
    return {
        schemaVersion: 1,
        contract: "dokkan-fyi-character-release-ready-k21-k23",
        contractVersion: "1.0.0",
        releaseId: release.releaseId,
        files: {
            [exports.FYI_CHARACTER_RELEASE_REPORT]: sha256(JSON_BYTES(release)),
            [exports.FYI_CHARACTER_RELEASE_PLAN]: sha256(JSON_BYTES(plan)),
            [exports.FYI_CHARACTER_RELEASE_RECEIPT]: sha256(JSON_BYTES(receipt)),
            [exports.FYI_CHARACTER_RELEASE_K20]: release.source.k20ReadinessSha256,
            [exports.FYI_CHARACTER_RELEASE_SOURCE_MARKER]: release.source.candidateReadyMarkerSha256,
            "characters.json.gz": release.dataset.sha256,
            "characters-manifest.json": sha256(localCharacterManifestBytes(release)),
            "characters-manifest.remote.json": sha256(JSON_BYTES(plan.remoteManifest)),
        },
        portraitInventorySha256: release.portraits.inventorySha256,
    };
}
function localCharacterManifestBytes(release) {
    const manifest = { ...release.dataset };
    delete manifest.localFileName;
    return JSON_BYTES(manifest);
}
async function verifyReleaseContents(releaseDirectory, expected, sourceMarker, k20) {
    const [releaseBytes, planBytes, receiptBytes, payloadBytes, localManifestBytes, remoteManifestBytes, k20Bytes, sourceMarkerBytes] = await Promise.all([
        readContainedFile(releaseDirectory, exports.FYI_CHARACTER_RELEASE_REPORT),
        readContainedFile(releaseDirectory, exports.FYI_CHARACTER_RELEASE_PLAN),
        readContainedFile(releaseDirectory, exports.FYI_CHARACTER_RELEASE_RECEIPT),
        readContainedFile(releaseDirectory, "characters.json.gz"),
        readContainedFile(releaseDirectory, "characters-manifest.json"),
        readContainedFile(releaseDirectory, "characters-manifest.remote.json"),
        readContainedFile(releaseDirectory, exports.FYI_CHARACTER_RELEASE_K20),
        readContainedFile(releaseDirectory, exports.FYI_CHARACTER_RELEASE_SOURCE_MARKER),
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
async function verifyReleaseDirectory(releaseDirectory, expected, sourceMarker, k20) {
    await verifyReleaseContents(releaseDirectory, expected, sourceMarker, k20);
    const marker = JSON.parse((await readContainedFile(releaseDirectory, exports.FYI_CHARACTER_RELEASE_READY)).toString("utf8"));
    if (JSON.stringify(marker) !== JSON.stringify(releaseMarker(expected.release, expected.plan, expected.receipt))) {
        throw new Error("K21 existing release marker rejected");
    }
}
async function readValidatedFyiCharacterRelease(fyiRoot, releaseId) {
    assertReleaseId(releaseId);
    const releaseRoot = (0, path_1.resolve)(fyiRoot, exports.FYI_CHARACTER_RELEASE_ROOT);
    const releaseDirectory = await (0, artifact_path_1.resolveContainedArtifactPath)({ trustedRoot: releaseRoot, untrustedPath: releaseId, expectedType: "directory" }, (code, artifactType) => new artifact_path_2.DatabaseCharacterArtifactPathError(code, artifactType));
    const [releaseBytes, planBytes, receiptBytes, sourceMarker, k20Bytes] = await Promise.all([
        readContainedFile(releaseDirectory, exports.FYI_CHARACTER_RELEASE_REPORT),
        readContainedFile(releaseDirectory, exports.FYI_CHARACTER_RELEASE_PLAN),
        readContainedFile(releaseDirectory, exports.FYI_CHARACTER_RELEASE_RECEIPT),
        readContainedFile(releaseDirectory, exports.FYI_CHARACTER_RELEASE_SOURCE_MARKER),
        readContainedFile(releaseDirectory, exports.FYI_CHARACTER_RELEASE_K20),
    ]);
    const release = JSON.parse(releaseBytes.toString("utf8"));
    const plan = JSON.parse(planBytes.toString("utf8"));
    const receipt = JSON.parse(receiptBytes.toString("utf8"));
    const k20 = JSON.parse(k20Bytes.toString("utf8"));
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
    const expected = { releaseDirectory, release, plan, receipt };
    await verifyReleaseDirectory(releaseDirectory, expected, sourceMarker, k20);
    return expected;
}
exports.readValidatedFyiCharacterRelease = readValidatedFyiCharacterRelease;
async function collectPortraitEntries(candidateDirectory, characters) {
    const keys = [...collectPortraitKeys(characters)].sort();
    return Promise.all(keys.map(async (objectKey) => {
        const path = await (0, artifact_path_1.resolveContainedArtifactPath)({ trustedRoot: candidateDirectory, untrustedPath: objectKey, expectedType: "file" }, (code, artifactType) => new artifact_path_2.DatabaseCharacterArtifactPathError(code, artifactType));
        const bytes = await (0, promises_1.readFile)(path);
        return { objectKey, fileName: (0, path_1.basename)(objectKey), sha256: sha256(bytes), sizeBytes: bytes.length };
    }));
}
async function materializeRelease(options) {
    const releaseRoot = (0, path_1.resolve)(options.fyiRoot, exports.FYI_CHARACTER_RELEASE_ROOT);
    await (0, promises_1.mkdir)(releaseRoot, { recursive: true });
    const rootRealPath = await (0, promises_1.realpath)(releaseRoot);
    if (rootRealPath !== releaseRoot || !(await (0, promises_1.stat)(rootRealPath)).isDirectory())
        throw new Error("K21 release root rejected");
    const releaseDirectory = (0, path_1.resolve)(rootRealPath, options.result.release.releaseId);
    assertContained(rootRealPath, releaseDirectory);
    try {
        await (0, promises_1.mkdir)(releaseDirectory, { mode: 0o700 });
    }
    catch (error) {
        if (error?.code !== "EEXIST")
            throw error;
        const existing = await (0, promises_1.lstat)(releaseDirectory);
        if (!existing.isDirectory() || existing.isSymbolicLink() || await (0, promises_1.realpath)(releaseDirectory) !== releaseDirectory) {
            throw new Error("K21 existing release directory rejected");
        }
        await verifyReleaseDirectory(releaseDirectory, options.result, options.candidateReadyMarker, options.k20);
        return releaseDirectory;
    }
    const releaseIdentity = await captureOwnedDirectory(releaseDirectory);
    try {
        const portraitDirectory = (0, path_1.join)(releaseDirectory, "portraits");
        await (0, promises_1.mkdir)(portraitDirectory, { mode: 0o700 });
        const portraitIdentity = await captureOwnedDirectory(portraitDirectory);
        await writeOwnedFile(releaseIdentity, "characters.json.gz", options.candidateGzip);
        await writeOwnedFile(releaseIdentity, "characters-manifest.json", options.candidateManifestBytes);
        await writeOwnedFile(releaseIdentity, "characters-manifest.remote.json", JSON_BYTES(options.result.plan.remoteManifest));
        await writeOwnedFile(releaseIdentity, exports.FYI_CHARACTER_RELEASE_K20, JSON_BYTES(options.k20));
        await writeOwnedFile(releaseIdentity, exports.FYI_CHARACTER_RELEASE_SOURCE_MARKER, options.candidateReadyMarker);
        for (const portrait of options.result.release.portraits.entries) {
            const source = await (0, artifact_path_1.resolveContainedArtifactPath)({ trustedRoot: options.candidateDirectory, untrustedPath: portrait.objectKey, expectedType: "file" }, (code, artifactType) => new artifact_path_2.DatabaseCharacterArtifactPathError(code, artifactType));
            const bytes = await (0, promises_1.readFile)(source);
            if (bytes.length !== portrait.sizeBytes || sha256(bytes) !== portrait.sha256)
                throw new Error("K21 source portrait changed");
            await assertOwnedDirectory(releaseIdentity);
            await writeOwnedFile(portraitIdentity, portrait.fileName, bytes);
        }
        await assertOwnedDirectory(portraitIdentity);
        await writeOwnedFile(releaseIdentity, exports.FYI_CHARACTER_RELEASE_REPORT, JSON_BYTES(options.result.release));
        await writeOwnedFile(releaseIdentity, exports.FYI_CHARACTER_RELEASE_PLAN, JSON_BYTES(options.result.plan));
        await writeOwnedFile(releaseIdentity, exports.FYI_CHARACTER_RELEASE_RECEIPT, JSON_BYTES(options.result.receipt));
        await assertOwnedDirectory(releaseIdentity);
        await assertOwnedDirectory(portraitIdentity);
        await verifyReleaseContents(releaseDirectory, options.result, options.candidateReadyMarker, options.k20);
        await assertOwnedDirectory(releaseIdentity);
        await assertOwnedDirectory(portraitIdentity);
        await writeOwnedFile(releaseIdentity, exports.FYI_CHARACTER_RELEASE_READY, JSON_BYTES(releaseMarker(options.result.release, options.result.plan, options.result.receipt)));
        return releaseDirectory;
    }
    catch (error) {
        const current = await (0, promises_1.lstat)(releaseDirectory).catch(() => undefined);
        if (current?.isDirectory() && !current.isSymbolicLink()
            && current.dev === releaseIdentity.dev && current.ino === releaseIdentity.ino) {
            await (0, promises_1.rm)(releaseDirectory, { recursive: true, force: true }).catch(() => undefined);
        }
        throw error;
    }
}
async function runFyiCharacterReleasePipeline() {
    const fyiRoot = (0, path_1.resolve)(__dirname, "data/fyi-characters");
    const k15Root = (0, path_1.resolve)(__dirname, "data/database-characters");
    const candidateDirectory = await (0, fyi_character_candidate_1.resolveFyiCandidateDirectory)(fyiRoot, fyi_character_candidate_1.FYI_CHARACTER_CANDIDATE_DIRECTORY, false);
    const k15Directory = await (0, fyi_character_candidate_1.resolveFyiK15Directory)(k15Root, fyi_character_candidate_1.FYI_CHARACTER_K15_DIRECTORY);
    const k15Before = await (0, compact_validator_1.validateCharacterCompactArtifact)(k15Directory);
    const k15Snapshot = JSON.stringify(k15Before);
    const [baselineGzip, baselineManifestBytes, candidateGzip, candidateManifestBytes, candidateReadyMarker, runReportBytes, k19ReportBytes,] = await Promise.all([
        readContainedFile(candidateDirectory, "baseline-characters.json.gz"),
        readContainedFile(candidateDirectory, "baseline-characters-manifest.json"),
        readContainedFile(candidateDirectory, "characters.json.gz"),
        readContainedFile(candidateDirectory, "characters-manifest.json"),
        readContainedFile(candidateDirectory, fyi_character_candidate_1.FYI_CHARACTER_CANDIDATE_READY_FILE),
        readContainedFile(candidateDirectory, "run-report.json"),
        readContainedFile(candidateDirectory, "candidate-k19-report.json"),
    ]);
    const candidateManifest = JSON.parse(candidateManifestBytes.toString("utf8"));
    const k20 = (0, fyi_character_candidate_readiness_1.compareFyiCharacterCandidate)({
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
    const k15After = await (0, compact_validator_1.validateCharacterCompactArtifact)(k15Directory);
    if (JSON.stringify(k15After) !== k15Snapshot)
        throw new Error("K21 K15 input changed during snapshot validation");
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
exports.runFyiCharacterReleasePipeline = runFyiCharacterReleasePipeline;
function parseFyiCharacterReleaseCli(args) {
    if (args.length !== 1 || args[0] !== "--opt-in-k21-k23")
        throw new Error("K21-K23 require exactly one --opt-in-k21-k23");
    return { optIn: true };
}
exports.parseFyiCharacterReleaseCli = parseFyiCharacterReleaseCli;
async function main() {
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
if (require.main === module)
    main().catch(error => { console.error(error); process.exitCode = 1; });
//# sourceMappingURL=fyi-character-release.js.map