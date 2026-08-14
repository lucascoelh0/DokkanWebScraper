"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runTaxonomyProjectionPublisher = void 0;
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const client_s3_1 = require("@aws-sdk/client-s3");
const taxonomy_projection_delivery_1 = require("./taxonomy-projection-delivery");
const taxonomy_projection_object_plan_contract_1 = require("./taxonomy-projection-object-plan-contract");
const taxonomy_projection_object_plan_1 = require("./taxonomy-projection-object-plan");
const taxonomy_projection_publisher_dry_run_1 = require("./taxonomy-projection-publisher-dry-run");
const taxonomy_projection_publisher_contract_1 = require("./taxonomy-projection-publisher-contract");
const ID = /^[a-f0-9]{64}$/;
const ACCOUNT_ID = /^[a-f0-9]{32}$/;
const EXPECTED_KINDS = ["payload", "coverage", "validation", "manifest"];
const jsonBytes = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
const hash = (value) => (0, crypto_1.createHash)("sha256").update(value).digest("hex");
const samePath = (left, right) => process.platform === "win32"
    ? (0, path_1.resolve)(left).toLowerCase() === (0, path_1.resolve)(right).toLowerCase()
    : (0, path_1.resolve)(left) === (0, path_1.resolve)(right);
const sameFile = (left, right) => left.dev === right.dev && left.ino === right.ino;
class RssGuard {
    peak = Math.max(process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024);
    exceeded = false;
    timer = setInterval(() => this.observe(), 10);
    constructor() { this.timer.unref(); }
    observe() {
        this.peak = Math.max(this.peak, process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024);
        this.exceeded ||= this.peak >= taxonomy_projection_publisher_contract_1.TAXONOMY_PROJECTION_PUBLISHER_RSS_LIMIT_BYTES;
    }
    sample(nestedPeak = 0, reservedHeadroom = 0) {
        this.observe();
        this.peak = Math.max(this.peak, nestedPeak);
        this.exceeded ||= this.peak >= taxonomy_projection_publisher_contract_1.TAXONOMY_PROJECTION_PUBLISHER_RSS_LIMIT_BYTES
            || this.peak + reservedHeadroom >= taxonomy_projection_publisher_contract_1.TAXONOMY_PROJECTION_PUBLISHER_RSS_LIMIT_BYTES;
        if (this.exceeded)
            throw new Error(`K40 RSS limit reached: ${this.peak}`);
        return this.peak;
    }
    stop() { clearInterval(this.timer); return this.sample(); }
    dispose() { clearInterval(this.timer); }
}
function boundedError(error) {
    const source = error instanceof Error ? error.message : String(error);
    const sanitized = source.replace(/[\u0000-\u001f\u007f]+/g, " ")
        .replace(/https?:\/\/\S+/gi, "[remote-url]")
        .replace(/[A-Za-z]:\\[^\s]+/g, "[local-path]")
        .replace(/\s+/g, " ").trim();
    return new Error(`K40 publisher failed: ${sanitized}`.slice(0, taxonomy_projection_publisher_contract_1.TAXONOMY_PROJECTION_PUBLISHER_MAX_ERROR_LENGTH));
}
function assertContained(parent, child) {
    const remainder = (0, path_1.relative)((0, path_1.resolve)(parent), (0, path_1.resolve)(child));
    if (!remainder || remainder === ".." || remainder.startsWith(`..${path_1.sep}`) || (0, path_1.isAbsolute)(remainder)) {
        throw new Error("K40 path containment rejected");
    }
}
function isSameOrDescendant(parent, candidate) {
    const remainder = (0, path_1.relative)((0, path_1.resolve)(parent), (0, path_1.resolve)(candidate));
    return remainder === "" || (!remainder.startsWith(`..${path_1.sep}`) && remainder !== ".." && !(0, path_1.isAbsolute)(remainder));
}
async function inspectDirectory(pathValue, label) {
    const path = (0, path_1.resolve)(pathValue);
    const before = await (0, promises_1.lstat)(path);
    if (!before.isDirectory() || before.isSymbolicLink())
        throw new Error(`K40 ${label} must be a regular directory`);
    const realPath = await (0, promises_1.realpath)(path);
    if (!samePath(realPath, path))
        throw new Error(`K40 ${label} link or junction rejected`);
    const after = await (0, promises_1.lstat)(path);
    if (!after.isDirectory() || after.isSymbolicLink() || !sameFile(before, after)) {
        throw new Error(`K40 ${label} identity changed`);
    }
    return { path, realPath, dev: after.dev, ino: after.ino };
}
async function checkpoint(expected, label) {
    const actual = await inspectDirectory(expected.path, label);
    if (!samePath(actual.realPath, expected.realPath) || actual.dev !== expected.dev || actual.ino !== expected.ino) {
        throw new Error(`K40 ${label} identity changed`);
    }
}
function commonRoots(options) {
    const roots = [options.k37OutputRoot, options.k36OutputRoot, options.k32Root, options.k2Root,
        options.productiveRoot, options.sqliteRoot, options.db1Root, options.elfRoot, options.nativeEvidenceRoot];
    if (roots.some(root => typeof root !== "string" || !root) || !ID.test(options.k37PlanId)
        || !ID.test(options.k36ReleaseId) || (0, path_1.isAbsolute)(options.k37PlanId) || (0, path_1.isAbsolute)(options.k36ReleaseId)) {
        throw new Error("K40 requires canonical K37/K36 IDs and every explicit source root");
    }
    return {
        k32Root: options.k32Root, k2Root: options.k2Root, productiveRoot: options.productiveRoot,
        sqliteRoot: options.sqliteRoot, db1Root: options.db1Root, elfRoot: options.elfRoot,
        nativeEvidenceRoot: options.nativeEvidenceRoot,
    };
}
function k39Options(options) {
    return {
        optInK39: true, dryRunOnly: true, remoteReadOnly: true,
        k37OutputRoot: options.k37OutputRoot, k37PlanId: options.k37PlanId,
        k36OutputRoot: options.k36OutputRoot, k36ReleaseId: options.k36ReleaseId,
        ...commonRoots(options), outputRoot: options.outputRoot, checkedAt: options.checkedAt,
    };
}
function k37Options(options) {
    return {
        outputRoot: options.k37OutputRoot, planId: options.k37PlanId,
        k36OutputRoot: options.k36OutputRoot, k36ReleaseId: options.k36ReleaseId,
        ...commonRoots(options),
    };
}
function k36Options(options) {
    return { outputRoot: options.k36OutputRoot, releaseId: options.k36ReleaseId, ...commonRoots(options) };
}
async function readBoundFile(directory, fileName, expectedSize, expectedSha256) {
    if (!fileName || fileName.includes("/") || fileName.includes("\\") || (0, path_1.isAbsolute)(fileName)
        || !Number.isSafeInteger(expectedSize) || expectedSize <= 0 || expectedSize >= taxonomy_projection_publisher_contract_1.TAXONOMY_PROJECTION_PUBLISHER_MAX_OBJECT_BYTES
        || !ID.test(expectedSha256))
        throw new Error("K40 K36 member identity rejected");
    const path = (0, path_1.join)(directory.path, fileName);
    assertContained(directory.path, path);
    await checkpoint(directory, "K36 release directory");
    const before = await (0, promises_1.lstat)(path);
    if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1 || before.size !== expectedSize
        || !samePath(await (0, promises_1.realpath)(path), path))
        throw new Error("K40 K36 member must be a bounded single-link regular file");
    const handle = await (0, promises_1.open)(path, fs_1.constants.O_RDONLY | (fs_1.constants.O_NOFOLLOW ?? 0));
    try {
        const opened = await handle.stat();
        if (!sameFile(before, opened) || opened.nlink !== 1 || opened.size !== expectedSize) {
            throw new Error("K40 K36 member identity changed while opening");
        }
        const bytes = await handle.readFile();
        const after = await handle.stat();
        const pathAfter = await (0, promises_1.lstat)(path);
        if (!sameFile(opened, after) || !sameFile(opened, pathAfter) || after.nlink !== 1
            || after.mtimeMs !== opened.mtimeMs || after.ctimeMs !== opened.ctimeMs
            || bytes.length !== expectedSize || hash(bytes) !== expectedSha256) {
            throw new Error("K40 K36 member bytes or identity changed while reading");
        }
        return { path, bytes };
    }
    finally {
        await handle.close();
    }
}
function artifactPlan(index, object) {
    return {
        order: (index + 1),
        kind: object.kind,
        sourceFileName: object.sourceFileName,
        objectKey: object.objectKey,
        sha256: object.sha256,
        sizeBytes: object.sizeBytes,
        contentType: object.kind === "payload" ? "application/gzip" : "application/json",
        cacheControl: taxonomy_projection_publisher_contract_1.TAXONOMY_PROJECTION_PUBLISHER_IMMUTABLE_CACHE_CONTROL,
        existingPolicy: "REUSE_ONLY_AFTER_EXACT_BYTES_AND_METADATA_VERIFICATION",
        missingPolicy: "PUT_IF_NONE_MATCH_STAR",
        racePolicy: "ACCEPT_409_OR_412_ONLY_AFTER_EXACT_DIRECT_REREAD",
        postCreateVerification: "DIRECT_BYTES_AND_METADATA_REQUIRED",
        overwrite: "FORBIDDEN",
        delete: "FORBIDDEN",
    };
}
function buildPublicationPlan(k37, k36, artifacts, manifestCandidateBytes) {
    const body = {
        schemaVersion: taxonomy_projection_publisher_contract_1.TAXONOMY_PROJECTION_PUBLISHER_SCHEMA_VERSION,
        contract: "dokkan-database-character-taxonomy-projection-publication-plan-k40",
        contractVersion: taxonomy_projection_publisher_contract_1.TAXONOMY_PROJECTION_PUBLISHER_CONTRACT_VERSION,
        remote: {
            bucket: taxonomy_projection_publisher_contract_1.TAXONOMY_PROJECTION_PUBLISHER_BUCKET,
            region: taxonomy_projection_publisher_contract_1.TAXONOMY_PROJECTION_PUBLISHER_REGION,
            endpointPattern: taxonomy_projection_publisher_contract_1.TAXONOMY_PROJECTION_PUBLISHER_ENDPOINT_PATTERN,
        },
        source: {
            k37PlanId: k37.planId,
            k37PlanSha256: hash(jsonBytes(k37.plan)),
            k37ManifestCandidateSha256: hash(manifestCandidateBytes),
            k36ReleaseId: k36.releaseId,
            k36ReceiptSha256: hash(jsonBytes(k36.receipt)),
            k36MarkerSha256: hash(jsonBytes(k36.marker)),
        },
        immutableObjects: artifacts.map(artifact => artifact.plan),
        mutableManifest: {
            order: "LAST",
            source: "CANONICAL_K37_MANIFEST_CANDIDATE_BYTES",
            objectKey: taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_REMOTE_MANIFEST_KEY,
            sha256: hash(manifestCandidateBytes),
            sizeBytes: manifestCandidateBytes.length,
            contentType: "application/json",
            cacheControl: "no-store",
            matchingPolicy: "NO_WRITE_AND_FINAL_DIRECT_VERIFY",
            missingPolicy: "PUT_IF_NONE_MATCH_STAR",
            differentPolicy: "PUT_IF_MATCH_FRESH_DIRECT_ETAG",
            freshnessPolicy: "REREAD_IMMEDIATELY_BEFORE_PROMOTION",
            concurrentCompletionPolicy: "ACCEPT_ONLY_IF_ALREADY_EXACT_BYTES_AND_METADATA",
            racePolicy: "ACCEPT_409_OR_412_ONLY_AFTER_EXACT_FINAL_DIRECT_REREAD",
            finalVerification: "DIRECT_BYTES_AND_METADATA_REQUIRED",
            unconditionalOverwrite: "FORBIDDEN",
            delete: "FORBIDDEN",
        },
        ordering: {
            immutableInK37Order: true,
            revalidateAllLocalSourcesBeforeManifest: true,
            manifestLast: true,
            noRollbackOrDeleteOrphanedImmutableObjects: true,
        },
        limits: {
            objectBytesExclusive: taxonomy_projection_publisher_contract_1.TAXONOMY_PROJECTION_PUBLISHER_MAX_OBJECT_BYTES,
            aggregateDirectReadBytesExclusive: taxonomy_projection_publisher_contract_1.TAXONOMY_PROJECTION_PUBLISHER_MAX_AGGREGATE_READ_BYTES,
            reportBytesExclusive: taxonomy_projection_publisher_contract_1.TAXONOMY_PROJECTION_PUBLISHER_MAX_REPORT_BYTES,
            rssBytesExclusive: taxonomy_projection_publisher_contract_1.TAXONOMY_PROJECTION_PUBLISHER_RSS_LIMIT_BYTES,
        },
        safety: {
            noCopy: true, noMultipart: true, noDelete: true, noProductionSwitch: true,
            noAndroidMutation: true, noAuthorityPromotion: true,
        },
    };
    return { ...body, publicationId: hash(jsonBytes(body)) };
}
async function loadLocalSnapshot(options) {
    const k37 = await (0, taxonomy_projection_object_plan_1.readValidatedTaxonomyProjectionObjectPlan)(k37Options(options));
    const k36 = await (0, taxonomy_projection_delivery_1.readValidatedTaxonomyProjectionDelivery)(k36Options(options));
    if (k37.sourceBoundK36Validation !== "GO" || k36.sourceBoundK35Validation !== "GO"
        || k37.planId !== options.k37PlanId || k36.releaseId !== options.k36ReleaseId
        || k37.plan.source.k36.releaseId !== k36.releaseId || k37.plan.objects.length !== 4
        || k36.receipt.inventory.artifactCount !== 4
        || JSON.stringify(k37.plan.objects.map(object => object.kind)) !== JSON.stringify(EXPECTED_KINDS)
        || JSON.stringify(k36.receipt.inventory.entries.map(entry => entry.kind)) !== JSON.stringify(EXPECTED_KINDS)) {
        throw new Error("K40 source-bound K37/K36 identity or ordered inventory rejected");
    }
    if (k37.plan.source.k36.receiptSha256 !== hash(jsonBytes(k36.receipt))
        || k37.plan.source.k36.markerSha256 !== hash(jsonBytes(k36.marker))) {
        throw new Error("K40 K37/K36 lineage hashes rejected");
    }
    const release = await inspectDirectory(k36.releaseDirectory, "K36 release directory");
    if (isSameOrDescendant(k37.planDirectory, (0, path_1.resolve)(options.outputRoot))
        || isSameOrDescendant(release.path, (0, path_1.resolve)(options.outputRoot))) {
        throw new Error("K40 output root must not alias or descend from closed K37/K36 sources");
    }
    const artifacts = [];
    for (let index = 0; index < 4; index++) {
        const object = k37.plan.objects[index];
        const entry = k36.receipt.inventory.entries[index];
        if (!entry || entry.kind !== object.kind || entry.fileName !== object.sourceFileName
            || entry.sha256 !== object.sha256 || entry.sizeBytes !== object.sizeBytes
            || object.cacheControl !== taxonomy_projection_publisher_contract_1.TAXONOMY_PROJECTION_PUBLISHER_IMMUTABLE_CACHE_CONTROL) {
            throw new Error("K40 K36 members do not match the exact ordered K37 plan");
        }
        const bound = await readBoundFile(release, entry.fileName, entry.sizeBytes, entry.sha256);
        artifacts.push({ plan: artifactPlan(index, object), ...bound });
    }
    if (new Set(artifacts.map(artifact => artifact.path)).size !== 4)
        throw new Error("K40 duplicate K36 member path rejected");
    await checkpoint(release, "K36 release directory");
    const manifestCandidateBytes = jsonBytes(k37.manifestCandidate);
    if (hash(manifestCandidateBytes) !== k37.plan.mutableManifest.sha256
        || manifestCandidateBytes.length !== k37.plan.mutableManifest.sizeBytes
        || k37.plan.mutableManifest.objectKey !== taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_REMOTE_MANIFEST_KEY) {
        throw new Error("K40 canonical K37 mutable candidate bytes rejected");
    }
    const plan = buildPublicationPlan(k37, k36, artifacts, manifestCandidateBytes);
    const fingerprint = hash(Buffer.concat([
        jsonBytes(k37.plan), jsonBytes(k37.manifestCandidate), jsonBytes(k37.receipt), jsonBytes(k37.marker),
        jsonBytes(k36.receipt), jsonBytes(k36.marker), ...artifacts.map(artifact => artifact.bytes),
    ]));
    return { k37, k36, artifacts, manifestCandidateBytes, fingerprint, plan };
}
function validateK39(k39Result, source, options) {
    const report = k39Result?.report;
    if (!report || report.readiness?.dryRun !== "GO" || report.readiness.publicationAuthorization !== "REQUIRED"
        || report.readiness.publication !== "NO-GO" || report.planId !== options.k37PlanId
        || report.k36ReleaseId !== options.k36ReleaseId || report.checkedAt !== options.checkedAt
        || report.k38Budget?.namespacePlanStrictlyWithinLimit !== true || report.k38Budget?.withinBucketCeiling !== true
        || report.k38BucketUsage?.status !== "known" || report.remote?.mutationExecuted !== false
        || report.remote?.immutableActions?.length !== 4 || !ID.test(k39Result.reportSha256)) {
        throw new Error("K40 requires the current productively rerun K39 dry-run and budgets to be GO");
    }
    for (let index = 0; index < 4; index++) {
        const current = report.remote.immutableActions[index];
        const planned = source.plan.immutableObjects[index];
        if (current.order !== planned.order || current.kind !== planned.kind || current.objectKey !== planned.objectKey
            || current.expectedSha256 !== planned.sha256 || current.expectedSizeBytes !== planned.sizeBytes
            || current.contentType !== planned.contentType || current.cacheControl !== planned.cacheControl
            || (current.k38Status !== "matching" && current.k38Status !== "missing")) {
            throw new Error("K40 K39 immutable observation lineage rejected");
        }
    }
    if (report.remote.mutableManifest.objectKey !== source.plan.mutableManifest.objectKey
        || report.remote.mutableManifest.expectedSha256 !== source.plan.mutableManifest.sha256
        || report.remote.mutableManifest.expectedSizeBytes !== source.plan.mutableManifest.sizeBytes) {
        throw new Error("K40 K39 mutable observation lineage rejected");
    }
}
function buildDryRunReport(k39Result, source, options) {
    const k39 = k39Result.report;
    return {
        schemaVersion: taxonomy_projection_publisher_contract_1.TAXONOMY_PROJECTION_PUBLISHER_SCHEMA_VERSION,
        contract: "dokkan-database-character-taxonomy-projection-publisher-dry-run-k40",
        contractVersion: taxonomy_projection_publisher_contract_1.TAXONOMY_PROJECTION_PUBLISHER_CONTRACT_VERSION,
        checkedAt: options.checkedAt,
        mode: "explicit_opt_in_remote_k40_dry_run_operational_report",
        publicationId: source.plan.publicationId,
        plan: source.plan,
        current: {
            k39CheckedAt: k39.checkedAt,
            k39ReportSha256: k39Result.reportSha256,
            k39PlanId: k39.planId,
            k39ReleaseId: k39.k36ReleaseId,
            immutableObservations: k39.remote.immutableActions,
            mutableManifestObservation: k39.remote.mutableManifest,
            bucketUsage: k39.k38BucketUsage,
            budget: k39.k38Budget,
            k39DryRunReadiness: "GO",
        },
        checks: {
            k39ProductivelyRerun: true,
            k39RerunsK38: true,
            currentBudgetsGo: true,
            k37SourceBoundBeforeAndAfterPlan: true,
            k36SourceBoundBeforeAndAfterPlan: true,
            exactFourK36MembersBoundAndRead: true,
            canonicalK37MutableCandidateBytes: true,
            deterministicPublicationIdExcludesOperationalTimeAndObservations: true,
            dryRunReportCreateOnly: true,
            savedReportNotPublicationAuthority: true,
            noRemoteMutationDuringReport: true,
        },
        readiness: {
            dryRun: "GO", publicationAuthorization: "REQUIRED", publication: "NOT_EXECUTED",
            android: "NO-GO", consumer: "NO-GO", authority: "NO-GO", production: "NO-GO",
        },
        state: "OPERATIONAL_DRY_RUN_ONLY_NON_AUTHORITATIVE",
    };
}
async function ensureChildDirectory(parent, name, label) {
    if (!name || name.includes("/") || name.includes("\\") || (0, path_1.isAbsolute)(name))
        throw new Error(`K40 ${label} name rejected`);
    const path = (0, path_1.join)(parent.path, name);
    assertContained(parent.path, path);
    await checkpoint(parent, `${label} parent`);
    try {
        await (0, promises_1.mkdir)(path, { mode: 0o700 });
    }
    catch (error) {
        if (error?.code !== "EEXIST")
            throw error;
    }
    await checkpoint(parent, `${label} parent`);
    return inspectDirectory(path, label);
}
async function assertExistingReportParentsSafe(outputRoot) {
    const namespacePath = (0, path_1.join)(outputRoot.path, taxonomy_projection_publisher_contract_1.TAXONOMY_PROJECTION_PUBLISHER_NAMESPACE);
    assertContained(outputRoot.path, namespacePath);
    try {
        await inspectDirectory(namespacePath, "existing publisher namespace");
    }
    catch (error) {
        if (error?.code !== "ENOENT")
            throw error;
    }
}
async function rejectExistingReport(pathValue) {
    const directory = await inspectDirectory(pathValue, "existing publisher report directory");
    const entries = await (0, promises_1.readdir)(directory.path, { withFileTypes: true });
    if (entries.length !== 1 || entries[0].name !== taxonomy_projection_publisher_contract_1.TAXONOMY_PROJECTION_PUBLISHER_REPORT_FILE
        || !entries[0].isFile() || entries[0].isSymbolicLink())
        throw new Error("K40 existing report inventory rejected");
    const path = (0, path_1.join)(directory.path, taxonomy_projection_publisher_contract_1.TAXONOMY_PROJECTION_PUBLISHER_REPORT_FILE);
    const metadata = await (0, promises_1.lstat)(path);
    if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.nlink !== 1 || !samePath(await (0, promises_1.realpath)(path), path)) {
        throw new Error("K40 existing report file identity rejected");
    }
    throw new Error("K40 create-only report already exists");
}
async function persistReport(outputRoot, report) {
    const bytes = jsonBytes(report);
    if (bytes.length >= taxonomy_projection_publisher_contract_1.TAXONOMY_PROJECTION_PUBLISHER_MAX_REPORT_BYTES)
        throw new Error("K40 report byte limit reached");
    const reportSha256 = hash(bytes);
    const namespace = await ensureChildDirectory(outputRoot, taxonomy_projection_publisher_contract_1.TAXONOMY_PROJECTION_PUBLISHER_NAMESPACE, "publisher namespace");
    const publicationDirectory = await ensureChildDirectory(namespace, report.publicationId, "publication directory");
    const reportDirectoryPath = (0, path_1.join)(publicationDirectory.path, reportSha256);
    assertContained(publicationDirectory.path, reportDirectoryPath);
    await checkpoint(publicationDirectory, "publication directory");
    try {
        await (0, promises_1.mkdir)(reportDirectoryPath, { mode: 0o700 });
    }
    catch (error) {
        if (error?.code === "EEXIST")
            return rejectExistingReport(reportDirectoryPath);
        throw error;
    }
    await checkpoint(publicationDirectory, "publication directory");
    const reportDirectory = await inspectDirectory(reportDirectoryPath, "publisher report directory");
    const reportPath = (0, path_1.join)(reportDirectory.path, taxonomy_projection_publisher_contract_1.TAXONOMY_PROJECTION_PUBLISHER_REPORT_FILE);
    assertContained(reportDirectory.path, reportPath);
    const handle = await (0, promises_1.open)(reportPath, fs_1.constants.O_CREAT | fs_1.constants.O_EXCL | fs_1.constants.O_WRONLY | (fs_1.constants.O_NOFOLLOW ?? 0), 0o600);
    try {
        await handle.writeFile(bytes);
        await handle.sync();
        const metadata = await handle.stat();
        if (!metadata.isFile() || metadata.nlink !== 1 || metadata.size !== bytes.length) {
            throw new Error("K40 created report identity rejected");
        }
    }
    finally {
        await handle.close();
    }
    const before = await (0, promises_1.lstat)(reportPath);
    const readHandle = await (0, promises_1.open)(reportPath, fs_1.constants.O_RDONLY | (fs_1.constants.O_NOFOLLOW ?? 0));
    try {
        const opened = await readHandle.stat();
        const reopened = await readHandle.readFile();
        const after = await readHandle.stat();
        if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1 || !samePath(await (0, promises_1.realpath)(reportPath), reportPath)
            || !sameFile(before, opened) || !sameFile(opened, after) || after.nlink !== 1 || !reopened.equals(bytes)) {
            throw new Error("K40 report changed while reopening");
        }
    }
    finally {
        await readHandle.close();
    }
    const inventory = await (0, promises_1.readdir)(reportDirectory.path, { withFileTypes: true });
    if (inventory.length !== 1 || inventory[0].name !== taxonomy_projection_publisher_contract_1.TAXONOMY_PROJECTION_PUBLISHER_REPORT_FILE
        || !inventory[0].isFile() || inventory[0].isSymbolicLink())
        throw new Error("K40 report inventory rejected");
    await checkpoint(outputRoot, "output root");
    await checkpoint(namespace, "publisher namespace");
    await checkpoint(publicationDirectory, "publication directory");
    await checkpoint(reportDirectory, "publisher report directory");
    return { reportDirectory: reportDirectory.path, reportPath, reportSha256 };
}
function createAggregateCounter() {
    return {
        bytesRead: 0,
        consume(count) {
            if (!Number.isSafeInteger(count) || count < 0
                || this.bytesRead + count >= taxonomy_projection_publisher_contract_1.TAXONOMY_PROJECTION_PUBLISHER_MAX_AGGREGATE_READ_BYTES) {
                throw new Error("K40 aggregate direct-read byte limit reached");
            }
            this.bytesRead += count;
        },
    };
}
function assertObjectKey(key) {
    if (!key || key.startsWith("/") || key.startsWith("\\") || key.includes("\\")
        || key.split("/").some(segment => !segment || segment === "." || segment === "..")
        || /[\u0000-\u001f\u007f]/.test(key))
        throw new Error("K40 object key rejected");
}
function statusCode(error) {
    return error?.$metadata?.httpStatusCode;
}
function isMissing(error) {
    return statusCode(error) === 404 || /^(?:NoSuchKey|NotFound)$/.test(error?.name ?? "");
}
function isPrecondition(error) {
    return statusCode(error) === 409 || statusCode(error) === 412
        || /^(?:ConditionalRequestConflict|PreconditionFailed)$/.test(error?.name ?? "");
}
async function bodyToBuffer(body, aggregate) {
    if (!body || !(Symbol.asyncIterator in Object(body)))
        throw new Error("K40 R2 response body is not streamable");
    const chunks = [];
    let total = 0;
    for await (const chunk of body) {
        const bytes = Buffer.from(chunk);
        total += bytes.length;
        if (total >= taxonomy_projection_publisher_contract_1.TAXONOMY_PROJECTION_PUBLISHER_MAX_OBJECT_BYTES)
            throw new Error("K40 R2 object byte limit reached");
        aggregate.consume(bytes.length);
        chunks.push(bytes);
    }
    return Buffer.concat(chunks, total);
}
function createS3Adapter() {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID ?? "";
    const accessKeyId = process.env.R2_ACCESS_KEY_ID ?? "";
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY ?? "";
    if (!ACCOUNT_ID.test(accountId) || !accessKeyId || !secretAccessKey
        || accessKeyId.length > 512 || secretAccessKey.length > 512
        || /[\r\n]/.test(accessKeyId) || /[\r\n]/.test(secretAccessKey)) {
        throw new Error("K40 publish requires valid fixed R2 environment configuration");
    }
    const client = new client_s3_1.S3Client({
        region: taxonomy_projection_publisher_contract_1.TAXONOMY_PROJECTION_PUBLISHER_REGION,
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId, secretAccessKey },
    });
    return {
        read: async (objectKey, aggregate) => {
            assertObjectKey(objectKey);
            try {
                const output = await client.send(new client_s3_1.GetObjectCommand({ Bucket: taxonomy_projection_publisher_contract_1.TAXONOMY_PROJECTION_PUBLISHER_BUCKET, Key: objectKey }));
                if (output.ContentLength !== undefined && output.ContentLength >= taxonomy_projection_publisher_contract_1.TAXONOMY_PROJECTION_PUBLISHER_MAX_OBJECT_BYTES) {
                    throw new Error("K40 R2 object byte limit reached");
                }
                if (!output.ETag || !/^"[^"\r\n]{1,256}"$/.test(output.ETag))
                    throw new Error("K40 R2 object ETag rejected");
                return {
                    status: "present",
                    bytes: await bodyToBuffer(output.Body, aggregate),
                    etag: output.ETag,
                    contentType: output.ContentType,
                    cacheControl: output.CacheControl,
                };
            }
            catch (error) {
                if (isMissing(error))
                    return { status: "missing" };
                throw error;
            }
        },
        put: async (objectKey, bytes, contentType, cacheControl, condition) => {
            assertObjectKey(objectKey);
            try {
                await client.send(new client_s3_1.PutObjectCommand({
                    Bucket: taxonomy_projection_publisher_contract_1.TAXONOMY_PROJECTION_PUBLISHER_BUCKET, Key: objectKey, Body: bytes,
                    ContentType: contentType, CacheControl: cacheControl, ...condition,
                }));
                return "written";
            }
            catch (error) {
                if (isPrecondition(error))
                    return "precondition_failed";
                throw error;
            }
        },
    };
}
function exact(object, bytes, contentType, cacheControl) {
    return object.status === "present" && object.bytes.length === bytes.length && hash(object.bytes) === hash(bytes)
        && object.contentType === contentType && object.cacheControl === cacheControl;
}
function sameDirectObservation(left, right) {
    if (left.status !== right.status)
        return false;
    return left.status === "missing" || (right.status === "present" && left.etag === right.etag
        && left.contentType === right.contentType && left.cacheControl === right.cacheControl
        && left.bytes.equals(right.bytes));
}
async function executePublication(adapter, source, k39Report, options) {
    const aggregate = createAggregateCounter();
    const initialObjects = [];
    for (let index = 0; index < 4; index++) {
        const direct = await adapter.read(source.plan.immutableObjects[index].objectKey, aggregate);
        const publicStatus = k39Report.remote.immutableActions[index].k38Status;
        if ((publicStatus === "missing") !== (direct.status === "missing")) {
            throw new Error("K40 direct immutable state raced or disagrees with current K39");
        }
        if (direct.status === "present" && !exact(direct, source.artifacts[index].bytes, source.plan.immutableObjects[index].contentType, source.plan.immutableObjects[index].cacheControl)) {
            throw new Error("K40 existing immutable bytes or metadata conflict");
        }
        initialObjects.push(direct);
    }
    const initialManifest = await adapter.read(source.plan.mutableManifest.objectKey, aggregate);
    const publicManifestStatus = k39Report.remote.mutableManifest.k38Status;
    const initialManifestBytesExact = initialManifest.status === "present"
        && initialManifest.bytes.length === source.manifestCandidateBytes.length
        && hash(initialManifest.bytes) === source.plan.mutableManifest.sha256;
    if ((publicManifestStatus === "missing") !== (initialManifest.status === "missing")
        || (publicManifestStatus === "matching") !== initialManifestBytesExact
        || (publicManifestStatus === "different" && (initialManifest.status !== "present" || initialManifestBytesExact))) {
        throw new Error("K40 direct manifest state raced or disagrees with current K39");
    }
    if (publicManifestStatus === "matching" && !exact(initialManifest, source.manifestCandidateBytes, source.plan.mutableManifest.contentType, source.plan.mutableManifest.cacheControl)) {
        throw new Error("K40 existing manifest metadata conflict");
    }
    let immutableUploaded = 0;
    let immutableReused = 0;
    let immutableBytesUploaded = 0;
    for (let index = 0; index < 4; index++) {
        const planned = source.plan.immutableObjects[index];
        const bytes = source.artifacts[index].bytes;
        if (initialObjects[index].status === "present") {
            immutableReused++;
            continue;
        }
        const result = await adapter.put(planned.objectKey, bytes, planned.contentType, planned.cacheControl, { IfNoneMatch: "*" });
        const verified = await adapter.read(planned.objectKey, aggregate);
        if (!exact(verified, bytes, planned.contentType, planned.cacheControl)) {
            throw new Error(result === "precondition_failed"
                ? "K40 immutable precondition race did not resolve to exact bytes and metadata"
                : "K40 immutable post-create direct verification failed");
        }
        if (result === "written") {
            immutableUploaded++;
            immutableBytesUploaded += bytes.length;
        }
        else
            immutableReused++;
    }
    const freshSource = await loadLocalSnapshot(options);
    if (freshSource.fingerprint !== source.fingerprint || freshSource.plan.publicationId !== source.plan.publicationId) {
        throw new Error("K40 local source drifted before mutable manifest promotion");
    }
    for (let index = 0; index < 4; index++) {
        const planned = source.plan.immutableObjects[index];
        const finalImmutable = await adapter.read(planned.objectKey, aggregate);
        if (!exact(finalImmutable, source.artifacts[index].bytes, planned.contentType, planned.cacheControl)) {
            throw new Error("K40 immutable changed before mutable manifest promotion");
        }
    }
    const freshManifest = await adapter.read(source.plan.mutableManifest.objectKey, aggregate);
    let manifestPromoted = false;
    let manifestResult;
    if (exact(freshManifest, source.manifestCandidateBytes, source.plan.mutableManifest.contentType, source.plan.mutableManifest.cacheControl)) {
        manifestResult = sameDirectObservation(initialManifest, freshManifest)
            ? "REUSED" : "CONCURRENT_IDEMPOTENT_COMPLETION";
    }
    else {
        if (!sameDirectObservation(initialManifest, freshManifest)) {
            throw new Error("K40 manifest changed before promotion; a fresh K39 run is required");
        }
        const condition = freshManifest.status === "missing"
            ? { IfNoneMatch: "*" } : { IfMatch: freshManifest.etag };
        const result = await adapter.put(source.plan.mutableManifest.objectKey, source.manifestCandidateBytes, source.plan.mutableManifest.contentType, source.plan.mutableManifest.cacheControl, condition);
        manifestPromoted = result === "written";
        manifestResult = result === "precondition_failed" ? "CONCURRENT_IDEMPOTENT_COMPLETION"
            : freshManifest.status === "missing" ? "CREATED" : "REPLACED";
    }
    const finalManifest = await adapter.read(source.plan.mutableManifest.objectKey, aggregate);
    if (!exact(finalManifest, source.manifestCandidateBytes, source.plan.mutableManifest.contentType, source.plan.mutableManifest.cacheControl)) {
        throw new Error("K40 final mutable manifest direct verification failed");
    }
    return {
        publicationId: source.plan.publicationId,
        immutableUploaded, immutableReused, immutableVerified: 4, immutableBytesUploaded,
        manifestPromoted, manifestResult, finalManifestVerified: true,
        deleteCount: 0, rollbackAttempted: false,
        readiness: {
            publicationExecution: "COMPLETED_CONDITIONALLY", android: "NO-GO", consumer: "NO-GO",
            authority: "NO-GO", production: "NO-GO",
        },
    };
}
async function runTaxonomyProjectionPublisher(options) {
    const rss = new RssGuard();
    try {
        if (options?.optInK40 !== true)
            throw new Error("K40 requires exact --opt-in-k40 authorization");
        if (options.remote !== true)
            throw new Error("K40 requires exact --remote mode");
        if (options.mode !== "dry-run" && options.mode !== "publish")
            throw new Error("K40 requires exactly one execution mode");
        if (options.mode === "dry-run" && options.confirmPublicationId !== undefined) {
            throw new Error("K40 dry-run forbids publication confirmation");
        }
        if (options.mode === "publish" && !ID.test(options.confirmPublicationId ?? "")) {
            throw new Error("K40 publish requires a canonical confirmation ID");
        }
        if (!options.outputRoot)
            throw new Error("K40 requires an explicit output root");
        commonRoots(options);
        const outputRoot = await inspectDirectory(options.outputRoot, "output root");
        await assertExistingReportParentsSafe(outputRoot);
        const k39Result = await (0, taxonomy_projection_publisher_dry_run_1.runTaxonomyProjectionPublisherDryRun)(k39Options(options));
        rss.sample(0, taxonomy_projection_publisher_contract_1.TAXONOMY_PROJECTION_PUBLISHER_RSS_REPORT_RESERVE_BYTES);
        const before = await loadLocalSnapshot(options);
        rss.sample(Math.max(before.k37.peakRssBytes, before.k36.peakRssBytes), taxonomy_projection_publisher_contract_1.TAXONOMY_PROJECTION_PUBLISHER_RSS_REPORT_RESERVE_BYTES);
        validateK39(k39Result, before, options);
        const after = await loadLocalSnapshot(options);
        rss.sample(Math.max(after.k37.peakRssBytes, after.k36.peakRssBytes), taxonomy_projection_publisher_contract_1.TAXONOMY_PROJECTION_PUBLISHER_RSS_REPORT_RESERVE_BYTES);
        if (before.fingerprint !== after.fingerprint || before.plan.publicationId !== after.plan.publicationId) {
            throw new Error("K40 local source drifted during deterministic planning");
        }
        validateK39(k39Result, after, options);
        const report = buildDryRunReport(k39Result, after, options);
        const persisted = await persistReport(outputRoot, report);
        if (options.mode === "dry-run") {
            rss.sample(0, taxonomy_projection_publisher_contract_1.TAXONOMY_PROJECTION_PUBLISHER_RSS_REPORT_RESERVE_BYTES);
            rss.stop();
            return { ...persisted, publicationId: after.plan.publicationId, report };
        }
        if (options.confirmPublicationId !== after.plan.publicationId) {
            throw new Error("K40 confirmation ID does not match the rebuilt deterministic publication plan");
        }
        const adapter = createS3Adapter();
        const publication = await executePublication(adapter, after, k39Result.report, options);
        rss.stop();
        return { ...persisted, publicationId: after.plan.publicationId, report, publication };
    }
    catch (error) {
        throw boundedError(error);
    }
    finally {
        rss.dispose();
    }
}
exports.runTaxonomyProjectionPublisher = runTaxonomyProjectionPublisher;
//# sourceMappingURL=taxonomy-projection-publisher.js.map