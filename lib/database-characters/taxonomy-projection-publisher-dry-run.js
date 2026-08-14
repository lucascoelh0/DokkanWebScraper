"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runTaxonomyProjectionPublisherDryRun = void 0;
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const taxonomy_projection_delivery_contract_1 = require("./taxonomy-projection-delivery-contract");
const taxonomy_projection_object_plan_contract_1 = require("./taxonomy-projection-object-plan-contract");
const taxonomy_projection_object_plan_1 = require("./taxonomy-projection-object-plan");
const taxonomy_projection_remote_preflight_contract_1 = require("./taxonomy-projection-remote-preflight-contract");
const taxonomy_projection_remote_preflight_1 = require("./taxonomy-projection-remote-preflight");
const taxonomy_projection_publisher_dry_run_contract_1 = require("./taxonomy-projection-publisher-dry-run-contract");
const ID = /^[a-f0-9]{64}$/;
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
        this.exceeded ||= this.peak >= taxonomy_projection_publisher_dry_run_contract_1.TAXONOMY_PROJECTION_PUBLISHER_DRY_RUN_RSS_LIMIT_BYTES;
    }
    sample(nestedPeak = 0, reservedHeadroom = 0) {
        this.observe();
        this.peak = Math.max(this.peak, nestedPeak);
        this.exceeded ||= this.peak >= taxonomy_projection_publisher_dry_run_contract_1.TAXONOMY_PROJECTION_PUBLISHER_DRY_RUN_RSS_LIMIT_BYTES
            || this.peak + reservedHeadroom >= taxonomy_projection_publisher_dry_run_contract_1.TAXONOMY_PROJECTION_PUBLISHER_DRY_RUN_RSS_LIMIT_BYTES;
        if (this.exceeded)
            throw new Error(`K39 RSS limit reached: ${this.peak}`);
        return this.peak;
    }
    stop() { clearInterval(this.timer); return this.sample(); }
    dispose() { clearInterval(this.timer); }
}
function boundedError(error) {
    const value = error instanceof Error ? error.message : String(error);
    const sanitized = value
        .replace(/[\u0000-\u001f\u007f]+/g, " ")
        .replace(/https?:\/\/\S+/gi, "[remote-url]")
        .replace(/[A-Za-z]:\\[^\s]+/g, "[local-path]")
        .replace(/\s+/g, " ")
        .trim();
    return new Error(`K39 publisher dry run failed: ${sanitized}`.slice(0, taxonomy_projection_publisher_dry_run_contract_1.TAXONOMY_PROJECTION_PUBLISHER_DRY_RUN_MAX_ERROR_LENGTH));
}
function assertContained(parent, child) {
    const remainder = (0, path_1.relative)((0, path_1.resolve)(parent), (0, path_1.resolve)(child));
    if (!remainder || remainder === ".." || remainder.startsWith(`..${path_1.sep}`) || (0, path_1.isAbsolute)(remainder)) {
        throw new Error("K39 report path containment rejected");
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
        throw new Error(`K39 ${label} must be a regular directory`);
    const realPath = await (0, promises_1.realpath)(path);
    if (!samePath(realPath, path))
        throw new Error(`K39 ${label} link or junction rejected`);
    const after = await (0, promises_1.lstat)(path);
    if (!after.isDirectory() || after.isSymbolicLink() || !sameFile(before, after)) {
        throw new Error(`K39 ${label} identity changed`);
    }
    return { path, realPath, dev: after.dev, ino: after.ino };
}
async function checkpoint(expected, label) {
    const actual = await inspectDirectory(expected.path, label);
    if (!samePath(actual.realPath, expected.realPath) || actual.dev !== expected.dev || actual.ino !== expected.ino) {
        throw new Error(`K39 ${label} identity changed`);
    }
}
function k37ReadOptions(options) {
    const roots = [options.k37OutputRoot, options.k36OutputRoot, options.k32Root, options.k2Root,
        options.productiveRoot, options.sqliteRoot, options.db1Root, options.elfRoot, options.nativeEvidenceRoot];
    if (roots.some(root => typeof root !== "string" || !root)
        || !ID.test(options.k37PlanId) || (0, path_1.isAbsolute)(options.k37PlanId)
        || !ID.test(options.k36ReleaseId) || (0, path_1.isAbsolute)(options.k36ReleaseId)) {
        throw new Error("K39 requires canonical K37/K36 IDs and every explicit source root");
    }
    return {
        outputRoot: options.k37OutputRoot,
        planId: options.k37PlanId,
        k36OutputRoot: options.k36OutputRoot,
        k36ReleaseId: options.k36ReleaseId,
        k32Root: options.k32Root,
        k2Root: options.k2Root,
        productiveRoot: options.productiveRoot,
        sqliteRoot: options.sqliteRoot,
        db1Root: options.db1Root,
        elfRoot: options.elfRoot,
        nativeEvidenceRoot: options.nativeEvidenceRoot,
    };
}
function k38RunOptions(options) {
    return {
        optInK38: true,
        remoteReadOnly: true,
        k37OutputRoot: options.k37OutputRoot,
        k37PlanId: options.k37PlanId,
        k36OutputRoot: options.k36OutputRoot,
        k36ReleaseId: options.k36ReleaseId,
        k32Root: options.k32Root,
        k2Root: options.k2Root,
        productiveRoot: options.productiveRoot,
        sqliteRoot: options.sqliteRoot,
        db1Root: options.db1Root,
        elfRoot: options.elfRoot,
        nativeEvidenceRoot: options.nativeEvidenceRoot,
        outputRoot: options.outputRoot,
        checkedAt: options.checkedAt,
    };
}
function captureSource(validated, options) {
    if (validated.sourceBoundK36Validation !== "GO" || validated.planId !== options.k37PlanId
        || validated.plan.planId !== options.k37PlanId
        || validated.plan.source.k36.releaseId !== options.k36ReleaseId
        || validated.plan.objects.length !== 4
        || JSON.stringify(validated.plan.objects.map(object => object.kind)) !== JSON.stringify(EXPECTED_KINDS)) {
        throw new Error("K39 source-bound K37 identity or ordered inventory rejected");
    }
    const planBytes = jsonBytes(validated.plan);
    const manifestCandidateBytes = jsonBytes(validated.manifestCandidate);
    const receiptBytes = jsonBytes(validated.receipt);
    const markerBytes = jsonBytes(validated.marker);
    return {
        validated,
        fingerprint: hash(Buffer.concat([planBytes, manifestCandidateBytes, receiptBytes, markerBytes])),
        planBytes,
        manifestCandidateBytes,
        receiptBytes,
        markerBytes,
    };
}
function assertK38Lineage(report, reportSha256, source, options) {
    if (report.contract !== "dokkan-database-character-taxonomy-projection-remote-preflight-k38"
        || report.contractVersion !== taxonomy_projection_remote_preflight_contract_1.TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_CONTRACT_VERSION
        || report.checkedAt !== options.checkedAt || report.planId !== options.k37PlanId
        || report.k36ReleaseId !== options.k36ReleaseId || report.readiness.readOnlyRemotePreflight !== "GO"
        || report.readiness.publicationAuthorization !== "REQUIRED" || report.readiness.publication !== "NO-GO"
        || report.readiness.r2Mutation !== "NO-GO" || report.objects.length !== 4
        || report.objectSummary.conflict !== 0 || report.objectSummary.failed !== 0
        || report.objectSummary.total !== 4
        || report.objectSummary.matching + report.objectSummary.missing !== 4
        || report.manifest.status === "failed" || report.bucketUsage.status !== "known"
        || report.budget.withinBucketCeiling !== true || report.checks.noRemoteMutation !== true
        || report.checks.futurePublisherMustRerunK38 !== true
        || report.source.sourceBoundBeforeTransport !== "GO"
        || report.source.sourceBoundAfterRemoteReads !== "GO"
        || report.source.sourceUnchanged !== true
        || !ID.test(reportSha256)) {
        throw new Error("K39 requires a freshly rerun K38 GO report with closed read-only readiness");
    }
    const expected = report.source;
    if (expected.k37PlanSha256 !== hash(source.planBytes) || expected.k37PlanSizeBytes !== source.planBytes.length
        || expected.k37ManifestCandidateSha256 !== hash(source.manifestCandidateBytes)
        || expected.k37ManifestCandidateSizeBytes !== source.manifestCandidateBytes.length
        || expected.k37ReceiptSha256 !== hash(source.receiptBytes) || expected.k37ReceiptSizeBytes !== source.receiptBytes.length
        || expected.k37MarkerSha256 !== hash(source.markerBytes) || expected.k37MarkerSizeBytes !== source.markerBytes.length) {
        throw new Error("K39 K38 report lineage does not match source-bound K37 bytes");
    }
}
function contentType(object) {
    return object.kind === "payload" ? "application/gzip" : "application/json";
}
function immutableActions(source, k38) {
    return source.validated.plan.objects.map((object, index) => {
        const observation = k38.objects[index];
        if (!observation || observation.kind !== object.kind || observation.objectKey !== object.objectKey
            || observation.expectedSha256 !== object.sha256 || observation.expectedSizeBytes !== object.sizeBytes
            || (observation.status !== "matching" && observation.status !== "missing")
            || object.cacheControl !== taxonomy_projection_publisher_dry_run_contract_1.TAXONOMY_PROJECTION_IMMUTABLE_CACHE_CONTROL) {
            throw new Error("K39 K38 immutable observation does not match ordered K37 plan");
        }
        return {
            order: (index + 1),
            kind: object.kind,
            sourceFileName: object.sourceFileName,
            objectKey: object.objectKey,
            expectedSha256: object.sha256,
            expectedSizeBytes: object.sizeBytes,
            contentType: contentType(object),
            cacheControl: taxonomy_projection_publisher_dry_run_contract_1.TAXONOMY_PROJECTION_IMMUTABLE_CACHE_CONTROL,
            k38Status: observation.status,
            action: observation.status === "matching" ? "reuse_verified_remote_bytes" : "create_if_absent",
            prospectiveCreateSemantics: {
                authorizationRequired: true,
                ifNoneMatch: "*",
                onlyWhenK38StatusIsMissing: true,
            },
            postCreateVerification: {
                byteSha256AndSize: "REQUIRED",
                contentTypeAndCacheControlMetadata: "REQUIRED",
            },
            overwrite: "FORBIDDEN",
            delete: "FORBIDDEN",
        };
    });
}
function mutableManifestAction(source, k38) {
    const status = k38.manifest.status;
    if (status !== "matching" && status !== "missing" && status !== "different") {
        throw new Error("K39 K38 mutable-manifest observation rejected");
    }
    const expectedSha256 = hash(source.manifestCandidateBytes);
    if (k38.manifest.objectKey !== taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_REMOTE_MANIFEST_KEY
        || k38.manifest.expectedSha256 !== expectedSha256
        || k38.manifest.expectedSizeBytes !== source.manifestCandidateBytes.length) {
        throw new Error("K39 K38 mutable-manifest lineage rejected");
    }
    return {
        order: "LAST_AFTER_ALL_IMMUTABLE_OBJECTS",
        objectKey: taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_REMOTE_MANIFEST_KEY,
        expectedSha256,
        expectedSizeBytes: source.manifestCandidateBytes.length,
        contentType: "application/json",
        cacheControl: "no-store",
        k38Status: status,
        action: status === "matching" ? "reuse_and_verify"
            : status === "missing" ? "prospective_create_if_absent" : "prospective_replace_if_match",
        futureWritePrecondition: status === "matching" ? "NO_WRITE_REUSE_AND_VERIFY"
            : status === "missing" ? "If-None-Match: *" : "If-Match: FRESH_ETAG_REQUIRED",
        freshDirectMetadataAndEtagVerificationRequired: true,
        futureSeparatelyAuthorizedWriteGateRequired: true,
        unconditionalOverwrite: "FORBIDDEN",
        delete: "FORBIDDEN",
        postWriteByteAndMetadataVerification: "REQUIRED",
    };
}
function buildReport(source, k38ReportSha256, k38, options) {
    const actions = immutableActions(source, k38);
    const mutableManifest = mutableManifestAction(source, k38);
    return {
        schemaVersion: taxonomy_projection_publisher_dry_run_contract_1.TAXONOMY_PROJECTION_PUBLISHER_DRY_RUN_SCHEMA_VERSION,
        contract: "dokkan-database-character-taxonomy-projection-publisher-dry-run-k39",
        contractVersion: taxonomy_projection_publisher_dry_run_contract_1.TAXONOMY_PROJECTION_PUBLISHER_DRY_RUN_CONTRACT_VERSION,
        checkedAt: options.checkedAt,
        mode: "explicit_opt_in_remote_read_only_dry_run_only",
        planId: options.k37PlanId,
        k36ReleaseId: options.k36ReleaseId,
        source: {
            k37: {
                planSha256: hash(source.planBytes), planSizeBytes: source.planBytes.length,
                manifestCandidateSha256: hash(source.manifestCandidateBytes),
                manifestCandidateSizeBytes: source.manifestCandidateBytes.length,
                receiptSha256: hash(source.receiptBytes), receiptSizeBytes: source.receiptBytes.length,
                markerSha256: hash(source.markerBytes), markerSizeBytes: source.markerBytes.length,
                sourceBoundBeforeDryRun: "GO", sourceBoundAfterDryRun: "GO", sourceUnchanged: true,
            },
            k38: {
                contract: "dokkan-database-character-taxonomy-projection-remote-preflight-k38",
                contractVersion: k38.contractVersion,
                checkedAt: k38.checkedAt,
                reportSha256: k38ReportSha256,
                readiness: "GO",
                productivelyRerunForThisDryRun: true,
                savedReportNotUsedAsAuthority: true,
            },
        },
        remote: {
            publicBaseUrl: taxonomy_projection_remote_preflight_contract_1.TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_PUBLIC_BASE_URL,
            bucket: taxonomy_projection_remote_preflight_contract_1.TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_BUCKET,
            immutableActions: actions,
            mutableManifest,
            mutationExecuted: false,
            overwriteCount: 0,
            deleteCount: 0,
        },
        k38BucketUsage: k38.bucketUsage,
        k38Budget: k38.budget,
        checks: {
            k38RerunWithEveryExplicitInput: true,
            k38ReadinessGoRequired: true,
            exactFourImmutableActionsInK37Order: true,
            immutableMatchingReused: true,
            immutableMissingCreateIfAbsentOnly: true,
            immutableIfNoneMatchStarRequired: true,
            immutablePostCreateByteAndMetadataVerificationRequired: true,
            mutableManifestLast: true,
            mutableManifestFreshEtagRequiredForReplacement: true,
            noRemoteMutation: true,
            zeroOverwrite: true,
            zeroDelete: true,
            boundedReport: true,
            createOnlyReport: true,
            existingReportReuse: false,
            callerControlledStableOutputNamespaceRequired: true,
            savedReportIsNotPublicationAuthority: true,
            futurePublisherMustRerunK38: true,
            futurePublisherMustDirectlyVerifyMetadataAndEtag: true,
            rssStrictlyWithinLimitWithReservedHeadroom: true,
        },
        readiness: {
            dryRun: "GO",
            publicationAuthorization: "REQUIRED",
            publication: "NO-GO",
            r2Mutation: "NO-GO",
            android: "NO-GO",
            consumer: "NO-GO",
            authority: "NO-GO",
            production: "NO-GO",
        },
        state: "OPERATIONAL_DRY_RUN_ONLY_NON_AUTHORITATIVE_FUTURE_PUBLISHER_MUST_RERUN_K38",
    };
}
async function ensureChildDirectory(parent, name, label) {
    if (!name || name.includes("/") || name.includes("\\") || (0, path_1.isAbsolute)(name))
        throw new Error(`K39 ${label} name rejected`);
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
async function assertExistingReportParentsSafe(outputRoot, planId) {
    const namespacePath = (0, path_1.join)(outputRoot.path, taxonomy_projection_publisher_dry_run_contract_1.TAXONOMY_PROJECTION_PUBLISHER_DRY_RUN_NAMESPACE);
    assertContained(outputRoot.path, namespacePath);
    let namespace;
    try {
        namespace = await inspectDirectory(namespacePath, "existing dry-run namespace");
    }
    catch (error) {
        if (error?.code === "ENOENT")
            return;
        throw error;
    }
    const planPath = (0, path_1.join)(namespace.path, planId);
    assertContained(namespace.path, planPath);
    try {
        await inspectDirectory(planPath, "existing dry-run plan directory");
    }
    catch (error) {
        if (error?.code !== "ENOENT")
            throw error;
    }
    await checkpoint(outputRoot, "output root");
    await checkpoint(namespace, "existing dry-run namespace");
}
async function rejectExistingReport(directoryPath) {
    const directory = await inspectDirectory(directoryPath, "existing dry-run report directory");
    const entries = await (0, promises_1.readdir)(directory.path, { withFileTypes: true });
    if (entries.length !== 1 || entries[0].name !== taxonomy_projection_publisher_dry_run_contract_1.TAXONOMY_PROJECTION_PUBLISHER_DRY_RUN_REPORT_FILE
        || !entries[0].isFile() || entries[0].isSymbolicLink()) {
        throw new Error("K39 existing report inventory rejected");
    }
    const path = (0, path_1.join)(directory.path, taxonomy_projection_publisher_dry_run_contract_1.TAXONOMY_PROJECTION_PUBLISHER_DRY_RUN_REPORT_FILE);
    const metadata = await (0, promises_1.lstat)(path);
    if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.nlink !== 1 || !samePath(await (0, promises_1.realpath)(path), path)) {
        throw new Error("K39 existing report file identity rejected");
    }
    throw new Error("K39 create-only report already exists");
}
async function persistReport(outputRoot, planId, report) {
    const bytes = jsonBytes(report);
    if (bytes.length >= taxonomy_projection_publisher_dry_run_contract_1.TAXONOMY_PROJECTION_PUBLISHER_DRY_RUN_MAX_REPORT_BYTES) {
        throw new Error("K39 report byte limit reached");
    }
    const reportSha256 = hash(bytes);
    const namespace = await ensureChildDirectory(outputRoot, taxonomy_projection_publisher_dry_run_contract_1.TAXONOMY_PROJECTION_PUBLISHER_DRY_RUN_NAMESPACE, "dry-run namespace");
    const planDirectory = await ensureChildDirectory(namespace, planId, "dry-run plan directory");
    const reportDirectoryPath = (0, path_1.join)(planDirectory.path, reportSha256);
    assertContained(planDirectory.path, reportDirectoryPath);
    await checkpoint(planDirectory, "dry-run plan directory");
    try {
        await (0, promises_1.mkdir)(reportDirectoryPath, { mode: 0o700 });
    }
    catch (error) {
        if (error?.code === "EEXIST")
            return rejectExistingReport(reportDirectoryPath);
        throw error;
    }
    await checkpoint(planDirectory, "dry-run plan directory");
    const reportDirectory = await inspectDirectory(reportDirectoryPath, "dry-run report directory");
    const reportPath = (0, path_1.join)(reportDirectory.path, taxonomy_projection_publisher_dry_run_contract_1.TAXONOMY_PROJECTION_PUBLISHER_DRY_RUN_REPORT_FILE);
    assertContained(reportDirectory.path, reportPath);
    const handle = await (0, promises_1.open)(reportPath, fs_1.constants.O_CREAT | fs_1.constants.O_EXCL | fs_1.constants.O_WRONLY | (fs_1.constants.O_NOFOLLOW ?? 0), 0o600);
    try {
        await checkpoint(reportDirectory, "dry-run report directory");
        await handle.writeFile(bytes);
        await handle.sync();
        const metadata = await handle.stat();
        if (!metadata.isFile() || metadata.nlink !== 1 || metadata.size !== bytes.length) {
            throw new Error("K39 created report identity rejected");
        }
    }
    finally {
        await handle.close();
    }
    const before = await (0, promises_1.lstat)(reportPath);
    if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1 || !samePath(await (0, promises_1.realpath)(reportPath), reportPath)) {
        throw new Error("K39 report identity rejected after create");
    }
    const readHandle = await (0, promises_1.open)(reportPath, fs_1.constants.O_RDONLY | (fs_1.constants.O_NOFOLLOW ?? 0));
    try {
        const opened = await readHandle.stat();
        const reopenedBytes = await readHandle.readFile();
        const after = await readHandle.stat();
        if (!sameFile(before, opened) || !sameFile(opened, after) || after.nlink !== 1 || !reopenedBytes.equals(bytes)) {
            throw new Error("K39 report changed while reopening");
        }
    }
    finally {
        await readHandle.close();
    }
    const inventory = await (0, promises_1.readdir)(reportDirectory.path, { withFileTypes: true });
    if (inventory.length !== 1 || inventory[0].name !== taxonomy_projection_publisher_dry_run_contract_1.TAXONOMY_PROJECTION_PUBLISHER_DRY_RUN_REPORT_FILE
        || !inventory[0].isFile() || inventory[0].isSymbolicLink()) {
        throw new Error("K39 created report closed inventory rejected");
    }
    await checkpoint(outputRoot, "output root");
    await checkpoint(namespace, "dry-run namespace");
    await checkpoint(planDirectory, "dry-run plan directory");
    await checkpoint(reportDirectory, "dry-run report directory");
    return { reportDirectory: reportDirectory.path, reportPath, reportSha256 };
}
async function runTaxonomyProjectionPublisherDryRun(options) {
    const rss = new RssGuard();
    try {
        if (options?.optInK39 !== true)
            throw new Error("K39 requires exact --opt-in-k39 authorization");
        if (options.dryRunOnly !== true)
            throw new Error("K39 requires exact --dry-run-only mode");
        if (options.remoteReadOnly !== true)
            throw new Error("K39 requires exact --remote-read-only mode");
        if (!options.outputRoot)
            throw new Error("K39 requires an explicit output root");
        const readOptions = k37ReadOptions(options);
        const outputRoot = await inspectDirectory(options.outputRoot, "output root");
        await assertExistingReportParentsSafe(outputRoot, options.k37PlanId);
        const k38Result = await (0, taxonomy_projection_remote_preflight_1.runTaxonomyProjectionRemotePreflight)(k38RunOptions(options));
        rss.sample(0, taxonomy_projection_publisher_dry_run_contract_1.TAXONOMY_PROJECTION_PUBLISHER_DRY_RUN_RSS_REPORT_RESERVE_BYTES);
        if (k38Result.report.readiness.readOnlyRemotePreflight !== "GO") {
            throw new Error("K39 refuses to plan unless the productively rerun K38 readiness is GO");
        }
        const before = captureSource(await (0, taxonomy_projection_object_plan_1.readValidatedTaxonomyProjectionObjectPlan)(readOptions), options);
        rss.sample(before.validated.peakRssBytes, taxonomy_projection_publisher_dry_run_contract_1.TAXONOMY_PROJECTION_PUBLISHER_DRY_RUN_RSS_REPORT_RESERVE_BYTES);
        if (isSameOrDescendant(before.validated.planDirectory, outputRoot.path)
            || isSameOrDescendant((0, path_1.join)((0, path_1.resolve)(options.k36OutputRoot), taxonomy_projection_delivery_contract_1.TAXONOMY_PROJECTION_DELIVERY_NAMESPACE, options.k36ReleaseId), outputRoot.path)) {
            throw new Error("K39 output root must not alias or descend from a closed K37/K36 source artifact");
        }
        assertK38Lineage(k38Result.report, k38Result.reportSha256, before, options);
        const first = buildReport(before, k38Result.reportSha256, k38Result.report, options);
        const second = buildReport(before, k38Result.reportSha256, k38Result.report, options);
        if (!jsonBytes(first).equals(jsonBytes(second)))
            throw new Error("K39 two-construction byte identity failed");
        const after = captureSource(await (0, taxonomy_projection_object_plan_1.readValidatedTaxonomyProjectionObjectPlan)(readOptions), options);
        rss.sample(after.validated.peakRssBytes, taxonomy_projection_publisher_dry_run_contract_1.TAXONOMY_PROJECTION_PUBLISHER_DRY_RUN_RSS_REPORT_RESERVE_BYTES);
        if (before.fingerprint !== after.fingerprint)
            throw new Error("K39 K37 source drifted during dry-run planning");
        assertK38Lineage(k38Result.report, k38Result.reportSha256, after, options);
        const rebuilt = buildReport(after, k38Result.reportSha256, k38Result.report, options);
        if (!jsonBytes(second).equals(jsonBytes(rebuilt)))
            throw new Error("K39 report drifted after source revalidation");
        const persisted = await persistReport(outputRoot, options.k37PlanId, rebuilt);
        rss.sample(0, taxonomy_projection_publisher_dry_run_contract_1.TAXONOMY_PROJECTION_PUBLISHER_DRY_RUN_RSS_REPORT_RESERVE_BYTES);
        rss.stop();
        return { ...persisted, report: rebuilt };
    }
    catch (error) {
        throw boundedError(error);
    }
    finally {
        rss.dispose();
    }
}
exports.runTaxonomyProjectionPublisherDryRun = runTaxonomyProjectionPublisherDryRun;
//# sourceMappingURL=taxonomy-projection-publisher-dry-run.js.map