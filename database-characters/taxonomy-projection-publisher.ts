import { createHash } from "crypto";
import { constants, Stats } from "fs";
import { lstat, mkdir, open, readdir, realpath } from "fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "path";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import {
    TAXONOMY_PROJECTION_DELIVERY_MAX_BYTES,
    TAXONOMY_PROJECTION_DELIVERY_MARKER,
    TAXONOMY_PROJECTION_DELIVERY_NAMESPACE,
    TAXONOMY_PROJECTION_DELIVERY_RECEIPT,
} from "./taxonomy-projection-delivery-contract";
import {
    TaxonomyProjectionDeliveryReadOptions,
    ValidatedTaxonomyProjectionDelivery,
    readValidatedTaxonomyProjectionDelivery,
} from "./taxonomy-projection-delivery";
import { TAXONOMY_PROJECTION_REMOTE_MANIFEST_KEY } from "./taxonomy-projection-object-plan-contract";
import {
    TaxonomyProjectionObjectPlanReadOptions,
    ValidatedTaxonomyProjectionObjectPlan,
    readValidatedTaxonomyProjectionObjectPlan,
} from "./taxonomy-projection-object-plan";
import {
    TaxonomyProjectionPublisherDryRunOptions,
    runTaxonomyProjectionPublisherDryRun,
} from "./taxonomy-projection-publisher-dry-run";
import {
    TAXONOMY_PROJECTION_PUBLISHER_BUCKET,
    TAXONOMY_PROJECTION_PUBLISHER_CONTRACT_VERSION,
    TAXONOMY_PROJECTION_PUBLISHER_ENDPOINT_PATTERN,
    TAXONOMY_PROJECTION_PUBLISHER_IMMUTABLE_CACHE_CONTROL,
    TAXONOMY_PROJECTION_PUBLISHER_MAX_AGGREGATE_READ_BYTES,
    TAXONOMY_PROJECTION_PUBLISHER_MAX_ERROR_LENGTH,
    TAXONOMY_PROJECTION_PUBLISHER_MAX_OBJECT_BYTES,
    TAXONOMY_PROJECTION_PUBLISHER_MAX_REPORT_BYTES,
    TAXONOMY_PROJECTION_PUBLISHER_NAMESPACE,
    TAXONOMY_PROJECTION_PUBLISHER_REGION,
    TAXONOMY_PROJECTION_PUBLISHER_REPORT_FILE,
    TAXONOMY_PROJECTION_PUBLISHER_RSS_LIMIT_BYTES,
    TAXONOMY_PROJECTION_PUBLISHER_RSS_REPORT_RESERVE_BYTES,
    TAXONOMY_PROJECTION_PUBLISHER_SCHEMA_VERSION,
    TaxonomyProjectionPublicationObjectPlan,
    TaxonomyProjectionPublicationPlan,
    TaxonomyProjectionPublicationPlanBody,
    TaxonomyProjectionPublicationSummary,
    TaxonomyProjectionPublisherDryRunOperationalReport,
} from "./taxonomy-projection-publisher-contract";

export interface TaxonomyProjectionPublisherOptions {
    optInK40: true;
    remote: true;
    mode: "dry-run" | "publish";
    confirmPublicationId?: string;
    k37OutputRoot: string;
    k37PlanId: string;
    k36OutputRoot: string;
    k36ReleaseId: string;
    k32Root: string;
    k2Root: string;
    productiveRoot: string;
    sqliteRoot: string;
    db1Root: string;
    elfRoot: string;
    nativeEvidenceRoot: string;
    outputRoot: string;
    checkedAt: string;
}

export interface TaxonomyProjectionPublisherResult {
    reportDirectory: string;
    reportPath: string;
    reportSha256: string;
    publicationId: string;
    report: TaxonomyProjectionPublisherDryRunOperationalReport;
    publication?: TaxonomyProjectionPublicationSummary;
}

interface DirectoryIdentity { path: string; realPath: string; dev: number; ino: number }
interface BoundArtifact { plan: TaxonomyProjectionPublicationObjectPlan; bytes: Buffer; path: string }
interface LocalSnapshot {
    k37: ValidatedTaxonomyProjectionObjectPlan;
    k36: ValidatedTaxonomyProjectionDelivery;
    artifacts: BoundArtifact[];
    manifestCandidateBytes: Buffer;
    fingerprint: string;
    plan: TaxonomyProjectionPublicationPlan;
}
interface DirectPresentObject {
    status: "present";
    bytes: Buffer;
    etag: string;
    contentType?: string;
    cacheControl?: string;
}
interface DirectMissingObject { status: "missing" }
type DirectObject = DirectPresentObject | DirectMissingObject;
interface AggregateCounter { bytesRead: number; consume(count: number): void }
interface S3Adapter {
    read(objectKey: string, aggregate: AggregateCounter): Promise<DirectObject>;
    put(objectKey: string, bytes: Buffer, contentType: string, cacheControl: string,
        condition: { IfNoneMatch: "*" } | { IfMatch: string }): Promise<"written" | "precondition_failed">;
}

const ID = /^[a-f0-9]{64}$/;
const ACCOUNT_ID = /^[a-f0-9]{32}$/;
const EXPECTED_KINDS = ["payload", "coverage", "validation", "manifest"] as const;
const jsonBytes = (value: unknown): Buffer => Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
const hash = (value: Buffer | string): string => createHash("sha256").update(value).digest("hex");
const samePath = (left: string, right: string): boolean => process.platform === "win32"
    ? resolve(left).toLowerCase() === resolve(right).toLowerCase()
    : resolve(left) === resolve(right);
const sameFile = (left: Stats, right: Stats): boolean => left.dev === right.dev && left.ino === right.ino;

class RssGuard {
    private peak = Math.max(process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024);
    private exceeded = false;
    private readonly timer = setInterval(() => this.observe(), 10);
    constructor() { this.timer.unref(); }
    private observe(): void {
        this.peak = Math.max(this.peak, process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024);
        this.exceeded ||= this.peak >= TAXONOMY_PROJECTION_PUBLISHER_RSS_LIMIT_BYTES;
    }
    sample(nestedPeak = 0, reservedHeadroom = 0): number {
        this.observe();
        this.peak = Math.max(this.peak, nestedPeak);
        this.exceeded ||= this.peak >= TAXONOMY_PROJECTION_PUBLISHER_RSS_LIMIT_BYTES
            || this.peak + reservedHeadroom >= TAXONOMY_PROJECTION_PUBLISHER_RSS_LIMIT_BYTES;
        if (this.exceeded) throw new Error(`K40 RSS limit reached: ${this.peak}`);
        return this.peak;
    }
    stop(): number { clearInterval(this.timer); return this.sample(); }
    dispose(): void { clearInterval(this.timer); }
}

function boundedError(error: unknown): Error {
    const source = error instanceof Error ? error.message : String(error);
    const sanitized = source.replace(/[\u0000-\u001f\u007f]+/g, " ")
        .replace(/https?:\/\/\S+/gi, "[remote-url]")
        .replace(/[A-Za-z]:\\[^\s]+/g, "[local-path]")
        .replace(/\s+/g, " ").trim();
    return new Error(`K40 publisher failed: ${sanitized}`.slice(0, TAXONOMY_PROJECTION_PUBLISHER_MAX_ERROR_LENGTH));
}

function assertContained(parent: string, child: string): void {
    const remainder = relative(resolve(parent), resolve(child));
    if (!remainder || remainder === ".." || remainder.startsWith(`..${sep}`) || isAbsolute(remainder)) {
        throw new Error("K40 path containment rejected");
    }
}

function isSameOrDescendant(parent: string, candidate: string): boolean {
    const remainder = relative(resolve(parent), resolve(candidate));
    return remainder === "" || (!remainder.startsWith(`..${sep}`) && remainder !== ".." && !isAbsolute(remainder));
}

async function inspectDirectory(pathValue: string, label: string): Promise<DirectoryIdentity> {
    const path = resolve(pathValue);
    const before = await lstat(path);
    if (!before.isDirectory() || before.isSymbolicLink()) throw new Error(`K40 ${label} must be a regular directory`);
    const realPath = await realpath(path);
    if (!samePath(realPath, path)) throw new Error(`K40 ${label} link or junction rejected`);
    const after = await lstat(path);
    if (!after.isDirectory() || after.isSymbolicLink() || !sameFile(before, after)) {
        throw new Error(`K40 ${label} identity changed`);
    }
    return { path, realPath, dev: after.dev, ino: after.ino };
}

async function checkpoint(expected: DirectoryIdentity, label: string): Promise<void> {
    const actual = await inspectDirectory(expected.path, label);
    if (!samePath(actual.realPath, expected.realPath) || actual.dev !== expected.dev || actual.ino !== expected.ino) {
        throw new Error(`K40 ${label} identity changed`);
    }
}

function commonRoots(options: TaxonomyProjectionPublisherOptions) {
    const roots = [options.k37OutputRoot, options.k36OutputRoot, options.k32Root, options.k2Root,
        options.productiveRoot, options.sqliteRoot, options.db1Root, options.elfRoot, options.nativeEvidenceRoot];
    if (roots.some(root => typeof root !== "string" || !root) || !ID.test(options.k37PlanId)
        || !ID.test(options.k36ReleaseId) || isAbsolute(options.k37PlanId) || isAbsolute(options.k36ReleaseId)) {
        throw new Error("K40 requires canonical K37/K36 IDs and every explicit source root");
    }
    return {
        k32Root: options.k32Root, k2Root: options.k2Root, productiveRoot: options.productiveRoot,
        sqliteRoot: options.sqliteRoot, db1Root: options.db1Root, elfRoot: options.elfRoot,
        nativeEvidenceRoot: options.nativeEvidenceRoot,
    };
}

function k39Options(options: TaxonomyProjectionPublisherOptions): TaxonomyProjectionPublisherDryRunOptions {
    return {
        optInK39: true, dryRunOnly: true, remoteReadOnly: true,
        k37OutputRoot: options.k37OutputRoot, k37PlanId: options.k37PlanId,
        k36OutputRoot: options.k36OutputRoot, k36ReleaseId: options.k36ReleaseId,
        ...commonRoots(options), outputRoot: options.outputRoot, checkedAt: options.checkedAt,
    };
}

function k37Options(options: TaxonomyProjectionPublisherOptions): TaxonomyProjectionObjectPlanReadOptions {
    return {
        outputRoot: options.k37OutputRoot, planId: options.k37PlanId,
        k36OutputRoot: options.k36OutputRoot, k36ReleaseId: options.k36ReleaseId,
        ...commonRoots(options),
    };
}

function k36Options(options: TaxonomyProjectionPublisherOptions): TaxonomyProjectionDeliveryReadOptions {
    return { outputRoot: options.k36OutputRoot, releaseId: options.k36ReleaseId, ...commonRoots(options) };
}

async function readBoundFile(directory: DirectoryIdentity, fileName: string, expectedSize: number,
    expectedSha256: string): Promise<{ path: string; bytes: Buffer }> {
    if (!fileName || fileName.includes("/") || fileName.includes("\\") || isAbsolute(fileName)
        || !Number.isSafeInteger(expectedSize) || expectedSize <= 0 || expectedSize >= TAXONOMY_PROJECTION_PUBLISHER_MAX_OBJECT_BYTES
        || !ID.test(expectedSha256)) throw new Error("K40 K36 member identity rejected");
    const path = join(directory.path, fileName);
    assertContained(directory.path, path);
    await checkpoint(directory, "K36 release directory");
    const before = await lstat(path);
    if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1 || before.size !== expectedSize
        || !samePath(await realpath(path), path)) throw new Error("K40 K36 member must be a bounded single-link regular file");
    const handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    try {
        const opened = await handle.stat();
        if (!sameFile(before, opened) || opened.nlink !== 1 || opened.size !== expectedSize) {
            throw new Error("K40 K36 member identity changed while opening");
        }
        const bytes = await handle.readFile();
        const after = await handle.stat();
        const pathAfter = await lstat(path);
        if (!sameFile(opened, after) || !sameFile(opened, pathAfter) || after.nlink !== 1
            || after.mtimeMs !== opened.mtimeMs || after.ctimeMs !== opened.ctimeMs
            || bytes.length !== expectedSize || hash(bytes) !== expectedSha256) {
            throw new Error("K40 K36 member bytes or identity changed while reading");
        }
        return { path, bytes };
    } finally { await handle.close(); }
}

function artifactPlan(index: number, object: any): TaxonomyProjectionPublicationObjectPlan {
    return {
        order: (index + 1) as 1 | 2 | 3 | 4,
        kind: object.kind,
        sourceFileName: object.sourceFileName,
        objectKey: object.objectKey,
        sha256: object.sha256,
        sizeBytes: object.sizeBytes,
        contentType: object.kind === "payload" ? "application/gzip" : "application/json",
        cacheControl: TAXONOMY_PROJECTION_PUBLISHER_IMMUTABLE_CACHE_CONTROL,
        existingPolicy: "REUSE_ONLY_AFTER_EXACT_BYTES_AND_METADATA_VERIFICATION",
        missingPolicy: "PUT_IF_NONE_MATCH_STAR",
        racePolicy: "ACCEPT_409_OR_412_ONLY_AFTER_EXACT_DIRECT_REREAD",
        postCreateVerification: "DIRECT_BYTES_AND_METADATA_REQUIRED",
        overwrite: "FORBIDDEN",
        delete: "FORBIDDEN",
    };
}

function buildPublicationPlan(k37: ValidatedTaxonomyProjectionObjectPlan,
    k36: ValidatedTaxonomyProjectionDelivery, artifacts: BoundArtifact[], manifestCandidateBytes: Buffer): TaxonomyProjectionPublicationPlan {
    const body: TaxonomyProjectionPublicationPlanBody = {
        schemaVersion: TAXONOMY_PROJECTION_PUBLISHER_SCHEMA_VERSION,
        contract: "dokkan-database-character-taxonomy-projection-publication-plan-k40",
        contractVersion: TAXONOMY_PROJECTION_PUBLISHER_CONTRACT_VERSION,
        remote: {
            bucket: TAXONOMY_PROJECTION_PUBLISHER_BUCKET,
            region: TAXONOMY_PROJECTION_PUBLISHER_REGION,
            endpointPattern: TAXONOMY_PROJECTION_PUBLISHER_ENDPOINT_PATTERN,
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
            objectKey: TAXONOMY_PROJECTION_REMOTE_MANIFEST_KEY,
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
            objectBytesExclusive: TAXONOMY_PROJECTION_PUBLISHER_MAX_OBJECT_BYTES,
            aggregateDirectReadBytesExclusive: TAXONOMY_PROJECTION_PUBLISHER_MAX_AGGREGATE_READ_BYTES,
            reportBytesExclusive: TAXONOMY_PROJECTION_PUBLISHER_MAX_REPORT_BYTES,
            rssBytesExclusive: TAXONOMY_PROJECTION_PUBLISHER_RSS_LIMIT_BYTES,
        },
        safety: {
            noCopy: true, noMultipart: true, noDelete: true, noProductionSwitch: true,
            noAndroidMutation: true, noAuthorityPromotion: true,
        },
    };
    return { ...body, publicationId: hash(jsonBytes(body)) };
}

async function loadLocalSnapshot(options: TaxonomyProjectionPublisherOptions): Promise<LocalSnapshot> {
    const k37 = await readValidatedTaxonomyProjectionObjectPlan(k37Options(options));
    const k36 = await readValidatedTaxonomyProjectionDelivery(k36Options(options));
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
    if (isSameOrDescendant(k37.planDirectory, resolve(options.outputRoot))
        || isSameOrDescendant(release.path, resolve(options.outputRoot))) {
        throw new Error("K40 output root must not alias or descend from closed K37/K36 sources");
    }
    const artifacts: BoundArtifact[] = [];
    for (let index = 0; index < 4; index++) {
        const object = k37.plan.objects[index];
        const entry = k36.receipt.inventory.entries[index];
        if (!entry || entry.kind !== object.kind || entry.fileName !== object.sourceFileName
            || entry.sha256 !== object.sha256 || entry.sizeBytes !== object.sizeBytes
            || object.cacheControl !== TAXONOMY_PROJECTION_PUBLISHER_IMMUTABLE_CACHE_CONTROL) {
            throw new Error("K40 K36 members do not match the exact ordered K37 plan");
        }
        const bound = await readBoundFile(release, entry.fileName, entry.sizeBytes, entry.sha256);
        artifacts.push({ plan: artifactPlan(index, object), ...bound });
    }
    if (new Set(artifacts.map(artifact => artifact.path)).size !== 4) throw new Error("K40 duplicate K36 member path rejected");
    await checkpoint(release, "K36 release directory");
    const manifestCandidateBytes = jsonBytes(k37.manifestCandidate);
    if (hash(manifestCandidateBytes) !== k37.plan.mutableManifest.sha256
        || manifestCandidateBytes.length !== k37.plan.mutableManifest.sizeBytes
        || k37.plan.mutableManifest.objectKey !== TAXONOMY_PROJECTION_REMOTE_MANIFEST_KEY) {
        throw new Error("K40 canonical K37 mutable candidate bytes rejected");
    }
    const plan = buildPublicationPlan(k37, k36, artifacts, manifestCandidateBytes);
    const fingerprint = hash(Buffer.concat([
        jsonBytes(k37.plan), jsonBytes(k37.manifestCandidate), jsonBytes(k37.receipt), jsonBytes(k37.marker),
        jsonBytes(k36.receipt), jsonBytes(k36.marker), ...artifacts.map(artifact => artifact.bytes),
    ]));
    return { k37, k36, artifacts, manifestCandidateBytes, fingerprint, plan };
}

function validateK39(k39Result: any, source: LocalSnapshot, options: TaxonomyProjectionPublisherOptions): void {
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

function buildDryRunReport(k39Result: any, source: LocalSnapshot,
    options: TaxonomyProjectionPublisherOptions): TaxonomyProjectionPublisherDryRunOperationalReport {
    const k39 = k39Result.report;
    return {
        schemaVersion: TAXONOMY_PROJECTION_PUBLISHER_SCHEMA_VERSION,
        contract: "dokkan-database-character-taxonomy-projection-publisher-dry-run-k40",
        contractVersion: TAXONOMY_PROJECTION_PUBLISHER_CONTRACT_VERSION,
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

async function ensureChildDirectory(parent: DirectoryIdentity, name: string, label: string): Promise<DirectoryIdentity> {
    if (!name || name.includes("/") || name.includes("\\") || isAbsolute(name)) throw new Error(`K40 ${label} name rejected`);
    const path = join(parent.path, name);
    assertContained(parent.path, path);
    await checkpoint(parent, `${label} parent`);
    try { await mkdir(path, { mode: 0o700 }); }
    catch (error: any) { if (error?.code !== "EEXIST") throw error; }
    await checkpoint(parent, `${label} parent`);
    return inspectDirectory(path, label);
}

async function assertExistingReportParentsSafe(outputRoot: DirectoryIdentity): Promise<void> {
    const namespacePath = join(outputRoot.path, TAXONOMY_PROJECTION_PUBLISHER_NAMESPACE);
    assertContained(outputRoot.path, namespacePath);
    try { await inspectDirectory(namespacePath, "existing publisher namespace"); }
    catch (error: any) { if (error?.code !== "ENOENT") throw error; }
}

async function rejectExistingReport(pathValue: string): Promise<never> {
    const directory = await inspectDirectory(pathValue, "existing publisher report directory");
    const entries = await readdir(directory.path, { withFileTypes: true });
    if (entries.length !== 1 || entries[0].name !== TAXONOMY_PROJECTION_PUBLISHER_REPORT_FILE
        || !entries[0].isFile() || entries[0].isSymbolicLink()) throw new Error("K40 existing report inventory rejected");
    const path = join(directory.path, TAXONOMY_PROJECTION_PUBLISHER_REPORT_FILE);
    const metadata = await lstat(path);
    if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.nlink !== 1 || !samePath(await realpath(path), path)) {
        throw new Error("K40 existing report file identity rejected");
    }
    throw new Error("K40 create-only report already exists");
}

async function persistReport(outputRoot: DirectoryIdentity, report: TaxonomyProjectionPublisherDryRunOperationalReport) {
    const bytes = jsonBytes(report);
    if (bytes.length >= TAXONOMY_PROJECTION_PUBLISHER_MAX_REPORT_BYTES) throw new Error("K40 report byte limit reached");
    const reportSha256 = hash(bytes);
    const namespace = await ensureChildDirectory(outputRoot, TAXONOMY_PROJECTION_PUBLISHER_NAMESPACE, "publisher namespace");
    const publicationDirectory = await ensureChildDirectory(namespace, report.publicationId, "publication directory");
    const reportDirectoryPath = join(publicationDirectory.path, reportSha256);
    assertContained(publicationDirectory.path, reportDirectoryPath);
    await checkpoint(publicationDirectory, "publication directory");
    try { await mkdir(reportDirectoryPath, { mode: 0o700 }); }
    catch (error: any) {
        if (error?.code === "EEXIST") return rejectExistingReport(reportDirectoryPath);
        throw error;
    }
    await checkpoint(publicationDirectory, "publication directory");
    const reportDirectory = await inspectDirectory(reportDirectoryPath, "publisher report directory");
    const reportPath = join(reportDirectory.path, TAXONOMY_PROJECTION_PUBLISHER_REPORT_FILE);
    assertContained(reportDirectory.path, reportPath);
    const handle = await open(reportPath,
        constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | (constants.O_NOFOLLOW ?? 0), 0o600);
    try {
        await handle.writeFile(bytes); await handle.sync();
        const metadata = await handle.stat();
        if (!metadata.isFile() || metadata.nlink !== 1 || metadata.size !== bytes.length) {
            throw new Error("K40 created report identity rejected");
        }
    } finally { await handle.close(); }
    const before = await lstat(reportPath);
    const readHandle = await open(reportPath, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    try {
        const opened = await readHandle.stat(); const reopened = await readHandle.readFile(); const after = await readHandle.stat();
        if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1 || !samePath(await realpath(reportPath), reportPath)
            || !sameFile(before, opened) || !sameFile(opened, after) || after.nlink !== 1 || !reopened.equals(bytes)) {
            throw new Error("K40 report changed while reopening");
        }
    } finally { await readHandle.close(); }
    const inventory = await readdir(reportDirectory.path, { withFileTypes: true });
    if (inventory.length !== 1 || inventory[0].name !== TAXONOMY_PROJECTION_PUBLISHER_REPORT_FILE
        || !inventory[0].isFile() || inventory[0].isSymbolicLink()) throw new Error("K40 report inventory rejected");
    await checkpoint(outputRoot, "output root"); await checkpoint(namespace, "publisher namespace");
    await checkpoint(publicationDirectory, "publication directory"); await checkpoint(reportDirectory, "publisher report directory");
    return { reportDirectory: reportDirectory.path, reportPath, reportSha256 };
}

function createAggregateCounter(): AggregateCounter {
    return {
        bytesRead: 0,
        consume(count: number): void {
            if (!Number.isSafeInteger(count) || count < 0
                || this.bytesRead + count >= TAXONOMY_PROJECTION_PUBLISHER_MAX_AGGREGATE_READ_BYTES) {
                throw new Error("K40 aggregate direct-read byte limit reached");
            }
            this.bytesRead += count;
        },
    };
}

function assertObjectKey(key: string): void {
    if (!key || key.startsWith("/") || key.startsWith("\\") || key.includes("\\")
        || key.split("/").some(segment => !segment || segment === "." || segment === "..")
        || /[\u0000-\u001f\u007f]/.test(key)) throw new Error("K40 object key rejected");
}

function statusCode(error: unknown): number | undefined {
    return (error as any)?.$metadata?.httpStatusCode;
}

function isMissing(error: unknown): boolean {
    return statusCode(error) === 404 || /^(?:NoSuchKey|NotFound)$/.test((error as any)?.name ?? "");
}

function isPrecondition(error: unknown): boolean {
    return statusCode(error) === 409 || statusCode(error) === 412
        || /^(?:ConditionalRequestConflict|PreconditionFailed)$/.test((error as any)?.name ?? "");
}

async function bodyToBuffer(body: unknown, aggregate: AggregateCounter): Promise<Buffer> {
    if (!body || !(Symbol.asyncIterator in Object(body))) throw new Error("K40 R2 response body is not streamable");
    const chunks: Buffer[] = [];
    let total = 0;
    for await (const chunk of body as AsyncIterable<Uint8Array>) {
        const bytes = Buffer.from(chunk);
        total += bytes.length;
        if (total >= TAXONOMY_PROJECTION_PUBLISHER_MAX_OBJECT_BYTES) throw new Error("K40 R2 object byte limit reached");
        aggregate.consume(bytes.length);
        chunks.push(bytes);
    }
    return Buffer.concat(chunks, total);
}

function createS3Adapter(): S3Adapter {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID ?? "";
    const accessKeyId = process.env.R2_ACCESS_KEY_ID ?? "";
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY ?? "";
    if (!ACCOUNT_ID.test(accountId) || !accessKeyId || !secretAccessKey
        || accessKeyId.length > 512 || secretAccessKey.length > 512
        || /[\r\n]/.test(accessKeyId) || /[\r\n]/.test(secretAccessKey)) {
        throw new Error("K40 publish requires valid fixed R2 environment configuration");
    }
    const client = new S3Client({
        region: TAXONOMY_PROJECTION_PUBLISHER_REGION,
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId, secretAccessKey },
    });
    return {
        read: async (objectKey, aggregate) => {
            assertObjectKey(objectKey);
            try {
                const output = await client.send(new GetObjectCommand({ Bucket: TAXONOMY_PROJECTION_PUBLISHER_BUCKET, Key: objectKey }));
                if (output.ContentLength !== undefined && output.ContentLength >= TAXONOMY_PROJECTION_PUBLISHER_MAX_OBJECT_BYTES) {
                    throw new Error("K40 R2 object byte limit reached");
                }
                if (!output.ETag || !/^"[^"\r\n]{1,256}"$/.test(output.ETag)) throw new Error("K40 R2 object ETag rejected");
                return {
                    status: "present",
                    bytes: await bodyToBuffer(output.Body, aggregate),
                    etag: output.ETag,
                    contentType: output.ContentType,
                    cacheControl: output.CacheControl,
                };
            } catch (error) {
                if (isMissing(error)) return { status: "missing" };
                throw error;
            }
        },
        put: async (objectKey, bytes, contentType, cacheControl, condition) => {
            assertObjectKey(objectKey);
            try {
                await client.send(new PutObjectCommand({
                    Bucket: TAXONOMY_PROJECTION_PUBLISHER_BUCKET, Key: objectKey, Body: bytes,
                    ContentType: contentType, CacheControl: cacheControl, ...condition,
                }));
                return "written";
            } catch (error) {
                if (isPrecondition(error)) return "precondition_failed";
                throw error;
            }
        },
    };
}

function exact(object: DirectObject, bytes: Buffer, contentType: string, cacheControl: string): boolean {
    return object.status === "present" && object.bytes.length === bytes.length && hash(object.bytes) === hash(bytes)
        && object.contentType === contentType && object.cacheControl === cacheControl;
}

function sameDirectObservation(left: DirectObject, right: DirectObject): boolean {
    if (left.status !== right.status) return false;
    return left.status === "missing" || (right.status === "present" && left.etag === right.etag
        && left.contentType === right.contentType && left.cacheControl === right.cacheControl
        && left.bytes.equals(right.bytes));
}

async function executePublication(adapter: S3Adapter, source: LocalSnapshot, k39Report: any,
    options: TaxonomyProjectionPublisherOptions): Promise<TaxonomyProjectionPublicationSummary> {
    const aggregate = createAggregateCounter();
    const initialObjects: DirectObject[] = [];
    for (let index = 0; index < 4; index++) {
        const direct = await adapter.read(source.plan.immutableObjects[index].objectKey, aggregate);
        const publicStatus = k39Report.remote.immutableActions[index].k38Status;
        if ((publicStatus === "missing") !== (direct.status === "missing")) {
            throw new Error("K40 direct immutable state raced or disagrees with current K39");
        }
        if (direct.status === "present" && !exact(direct, source.artifacts[index].bytes,
            source.plan.immutableObjects[index].contentType, source.plan.immutableObjects[index].cacheControl)) {
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
    if (publicManifestStatus === "matching" && !exact(initialManifest, source.manifestCandidateBytes,
        source.plan.mutableManifest.contentType, source.plan.mutableManifest.cacheControl)) {
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
        const result = await adapter.put(planned.objectKey, bytes, planned.contentType, planned.cacheControl,
            { IfNoneMatch: "*" });
        const verified = await adapter.read(planned.objectKey, aggregate);
        if (!exact(verified, bytes, planned.contentType, planned.cacheControl)) {
            throw new Error(result === "precondition_failed"
                ? "K40 immutable precondition race did not resolve to exact bytes and metadata"
                : "K40 immutable post-create direct verification failed");
        }
        if (result === "written") { immutableUploaded++; immutableBytesUploaded += bytes.length; }
        else immutableReused++;
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
    let manifestResult: TaxonomyProjectionPublicationSummary["manifestResult"];
    if (exact(freshManifest, source.manifestCandidateBytes,
        source.plan.mutableManifest.contentType, source.plan.mutableManifest.cacheControl)) {
        manifestResult = sameDirectObservation(initialManifest, freshManifest)
            ? "REUSED" : "CONCURRENT_IDEMPOTENT_COMPLETION";
    } else {
        if (!sameDirectObservation(initialManifest, freshManifest)) {
            throw new Error("K40 manifest changed before promotion; a fresh K39 run is required");
        }
        const condition = freshManifest.status === "missing"
            ? { IfNoneMatch: "*" as const } : { IfMatch: freshManifest.etag };
        const result = await adapter.put(source.plan.mutableManifest.objectKey, source.manifestCandidateBytes,
            source.plan.mutableManifest.contentType, source.plan.mutableManifest.cacheControl, condition);
        manifestPromoted = result === "written";
        manifestResult = result === "precondition_failed" ? "CONCURRENT_IDEMPOTENT_COMPLETION"
            : freshManifest.status === "missing" ? "CREATED" : "REPLACED";
    }
    const finalManifest = await adapter.read(source.plan.mutableManifest.objectKey, aggregate);
    if (!exact(finalManifest, source.manifestCandidateBytes,
        source.plan.mutableManifest.contentType, source.plan.mutableManifest.cacheControl)) {
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

export async function runTaxonomyProjectionPublisher(
    options: TaxonomyProjectionPublisherOptions,
): Promise<TaxonomyProjectionPublisherResult> {
    const rss = new RssGuard();
    try {
        if (options?.optInK40 !== true) throw new Error("K40 requires exact --opt-in-k40 authorization");
        if (options.remote !== true) throw new Error("K40 requires exact --remote mode");
        if (options.mode !== "dry-run" && options.mode !== "publish") throw new Error("K40 requires exactly one execution mode");
        if (options.mode === "dry-run" && options.confirmPublicationId !== undefined) {
            throw new Error("K40 dry-run forbids publication confirmation");
        }
        if (options.mode === "publish" && !ID.test(options.confirmPublicationId ?? "")) {
            throw new Error("K40 publish requires a canonical confirmation ID");
        }
        if (!options.outputRoot) throw new Error("K40 requires an explicit output root");
        commonRoots(options);
        const outputRoot = await inspectDirectory(options.outputRoot, "output root");
        await assertExistingReportParentsSafe(outputRoot);

        const k39Result = await runTaxonomyProjectionPublisherDryRun(k39Options(options));
        rss.sample(0, TAXONOMY_PROJECTION_PUBLISHER_RSS_REPORT_RESERVE_BYTES);
        const before = await loadLocalSnapshot(options);
        rss.sample(Math.max(before.k37.peakRssBytes, before.k36.peakRssBytes),
            TAXONOMY_PROJECTION_PUBLISHER_RSS_REPORT_RESERVE_BYTES);
        validateK39(k39Result, before, options);
        const after = await loadLocalSnapshot(options);
        rss.sample(Math.max(after.k37.peakRssBytes, after.k36.peakRssBytes),
            TAXONOMY_PROJECTION_PUBLISHER_RSS_REPORT_RESERVE_BYTES);
        if (before.fingerprint !== after.fingerprint || before.plan.publicationId !== after.plan.publicationId) {
            throw new Error("K40 local source drifted during deterministic planning");
        }
        validateK39(k39Result, after, options);
        const report = buildDryRunReport(k39Result, after, options);
        const persisted = await persistReport(outputRoot, report);

        if (options.mode === "dry-run") {
            rss.sample(0, TAXONOMY_PROJECTION_PUBLISHER_RSS_REPORT_RESERVE_BYTES);
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
    } catch (error) {
        throw boundedError(error);
    } finally { rss.dispose(); }
}
