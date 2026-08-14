"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const crypto_1 = require("crypto");
const promises_1 = require("fs/promises");
const ModuleApi = require("module");
const os_1 = require("os");
const path_1 = require("path");
const typescript_1 = require("typescript");
const productionApi = require("./taxonomy-projection-publisher-dry-run");
const taxonomy_projection_publisher_dry_run_contract_1 = require("./taxonomy-projection-publisher-dry-run-contract");
const taxonomy_projection_publisher_dry_run_run_1 = require("./taxonomy-projection-publisher-dry-run-run");
const taxonomy_projection_object_plan_contract_1 = require("./taxonomy-projection-object-plan-contract");
const PLAN_ID = "a".repeat(64);
const RELEASE_ID = "b".repeat(64);
const K38_REPORT_SHA256 = "c".repeat(64);
const CHECKED_AT = "2026-08-14T15:00:00.000Z";
const jsonBytes = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
const sha256 = (value) => (0, crypto_1.createHash)("sha256").update(value).digest("hex");
function repositorySourceRoot() {
    const parent = (0, path_1.resolve)(__dirname, "..");
    return (0, path_1.basename)(parent).toLowerCase() === "lib" ? (0, path_1.resolve)(parent, "..") : parent;
}
async function loadInstrumentedApi() {
    const parent = (0, path_1.resolve)(__dirname, "..");
    const sourceRoot = repositorySourceRoot();
    const sourcePath = (0, path_1.join)(sourceRoot, "database-characters", "taxonomy-projection-publisher-dry-run.ts");
    const runtimePath = (0, path_1.basename)(parent).toLowerCase() === "lib"
        ? (0, path_1.join)(parent, "database-characters", ".taxonomy-projection-publisher-dry-run.test-runtime.js")
        : (0, path_1.join)(sourceRoot, "database-characters", ".taxonomy-projection-publisher-dry-run.test-runtime.js");
    const source = await (0, promises_1.readFile)(sourcePath, "utf8");
    const instrumented = source
        .replace(/runTaxonomyProjectionRemotePreflight\(/g, "__testRunTaxonomyProjectionRemotePreflight(")
        .replace(/readValidatedTaxonomyProjectionObjectPlan\(/g, "__testReadValidatedTaxonomyProjectionObjectPlan(")
        .replace("export interface TaxonomyProjectionPublisherDryRunOptions", `
const __testRunTaxonomyProjectionRemotePreflight = (...args: any[]) => {
    const hook = (globalThis as any)[Symbol.for("dokkan.k39.k38-runner")];
    if (typeof hook !== "function") throw new Error("K39 test K38 runner hook missing");
    return hook(...args);
};
const __testReadValidatedTaxonomyProjectionObjectPlan = (...args: any[]) => {
    const hook = (globalThis as any)[Symbol.for("dokkan.k39.k37-reader")];
    if (typeof hook !== "function") throw new Error("K39 test K37 reader hook missing");
    return hook(...args);
};

export interface TaxonomyProjectionPublisherDryRunOptions`);
    if (instrumented === source || !instrumented.includes("__testRunTaxonomyProjectionRemotePreflight")) {
        throw new Error("K39 test instrumentation failed");
    }
    const compiled = (0, typescript_1.transpileModule)(instrumented, {
        compilerOptions: { module: typescript_1.ModuleKind.CommonJS, target: typescript_1.ScriptTarget.ES2022 },
        fileName: sourcePath,
    }).outputText;
    const ModuleConstructor = ModuleApi.default ?? ModuleApi;
    const runtimeModule = new ModuleConstructor(runtimePath, module);
    runtimeModule.filename = runtimePath;
    runtimeModule.paths = ModuleConstructor._nodeModulePaths((0, path_1.dirname)(runtimePath));
    runtimeModule._compile(compiled, runtimePath);
    return runtimeModule.exports;
}
function makeFixture(statuses = ["matching", "missing", "matching", "missing"], manifestStatus = "different") {
    const payloads = [Buffer.from("payload"), Buffer.from("coverage"), Buffer.from("validation"), Buffer.from("manifest")];
    const hashes = payloads.map(sha256);
    const names = [
        `database-characters-k35-taxonomy-projection.${hashes[0]}.json.gz`,
        "database-characters-k35-taxonomy-projection-coverage.json",
        "database-characters-k35-taxonomy-projection-validation.json",
        "database-characters-k35-taxonomy-projection-manifest.json",
    ];
    const kinds = ["payload", "coverage", "validation", "manifest"];
    const objects = payloads.map((bytes, index) => ({
        kind: kinds[index],
        sourceFileName: names[index],
        objectKey: `${taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_REMOTE_NAMESPACE}/objects/sha256/${hashes[index]}/${names[index]}`,
        sha256: hashes[index],
        sizeBytes: bytes.length,
        cacheControl: taxonomy_projection_publisher_dry_run_contract_1.TAXONOMY_PROJECTION_IMMUTABLE_CACHE_CONTROL,
        contentAddressed: true,
        remoteHashProofRequiredBeforeReuse: true,
    }));
    const source = {
        k36: { releaseId: RELEASE_ID },
        k35: { contract: "synthetic-k35", lineage: { synthetic: true } },
    };
    const manifestCandidate = {
        schemaVersion: 1,
        contract: "dokkan-database-character-taxonomy-projection-remote-manifest-candidate-k37",
        contractVersion: "1.0.0",
        generatedAt: "2026-08-14T00:00:00.000Z",
        datasetVersion: "synthetic-k39",
        releaseId: RELEASE_ID,
        source,
        inventory: { closed: true, artifactCount: 4, objects },
        cacheControl: "no-store",
        state: "MUTABLE_REMOTE_MANIFEST_CANDIDATE_ONLY",
        readiness: { consumer: "NO-GO", authority: "NO-GO", publication: "NO-GO", production: "NO-GO" },
    };
    const manifestCandidateBytes = jsonBytes(manifestCandidate);
    const immutableObjectBytes = objects.reduce((total, object) => total + object.sizeBytes, 0);
    const plan = {
        schemaVersion: 1,
        contract: "dokkan-database-character-taxonomy-projection-object-plan-k37",
        contractVersion: "1.0.0",
        generatedAt: "2026-08-14T00:00:00.000Z",
        datasetVersion: "synthetic-k39",
        planId: PLAN_ID,
        mode: "explicit_opt_in_offline_local_only",
        source,
        remoteNamespace: taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_REMOTE_NAMESPACE,
        objects,
        mutableManifest: {
            localFileName: "database-characters-k37-taxonomy-projection-remote-manifest-candidate.json",
            objectKey: taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_REMOTE_MANIFEST_KEY,
            sha256: sha256(manifestCandidateBytes),
            sizeBytes: manifestCandidateBytes.length,
            cacheControl: "no-store",
            state: "CANDIDATE_ONLY",
        },
        budget: {
            namespaceLimitBytes: taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_OBJECT_PLAN_NAMESPACE_MAX_BYTES,
            immutableObjectBytes,
            mutableManifestReservationBytes: taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_OBJECT_PLAN_MANIFEST_RESERVATION_BYTES,
            worstCaseNewBytes: immutableObjectBytes + taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_OBJECT_PLAN_MANIFEST_RESERVATION_BYTES,
            withinNamespaceLimit: true,
            bucketCeilingBytes: taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_OBJECT_PLAN_BUCKET_CEILING_BYTES,
            remoteBucketBytes: "UNKNOWN",
            projectedBucketBytes: "UNKNOWN",
            withinBucketCeiling: "UNKNOWN",
            remotePreflightRequired: true,
        },
    };
    const receipt = { contract: "synthetic-k37-receipt", planId: PLAN_ID, k36ReleaseId: RELEASE_ID };
    const marker = { contract: "synthetic-k37-marker", planId: PLAN_ID };
    const validated = {
        planDirectory: "X:/synthetic/k37-plan",
        planId: PLAN_ID,
        plan,
        manifestCandidate,
        receipt,
        marker,
        sourceBoundK36Validation: "GO",
        peakRssBytes: 1,
    };
    const k38Budget = {
        responseLimitBytesExclusive: 1048576,
        aggregateLimitBytesExclusive: 5242880,
        bytesRead: 12345,
        namespaceLimitBytesExclusive: 50000000,
        namespacePlanBytes: plan.budget.worstCaseNewBytes,
        namespacePlanStrictlyWithinLimit: true,
        missingImmutableBytes: objects.filter((_, index) => statuses[index] === "missing")
            .reduce((total, object) => total + object.sizeBytes, 0),
        manifestCandidateBytes: manifestCandidateBytes.length,
        bytesNewIfPublished: 999,
        bucketCeilingBytesExclusive: 10000000000,
        bucketConservativeUpperBoundBytes: 361000001,
        projectedBucketUpperBoundBytes: 361001000,
        withinBucketCeiling: true,
    };
    const observations = objects.map((object, index) => ({
        kind: object.kind,
        objectKey: object.objectKey,
        status: statuses[index],
        expectedSha256: object.sha256,
        expectedSizeBytes: object.sizeBytes,
        ...(statuses[index] === "matching" ? { actualSha256: object.sha256, actualSizeBytes: object.sizeBytes } : {}),
    }));
    const objectSummary = observations.reduce((summary, object) => {
        summary[object.status]++;
        return summary;
    }, { matching: 0, missing: 0, conflict: 0, failed: 0, total: 4 });
    const k38Report = {
        schemaVersion: 1,
        contract: "dokkan-database-character-taxonomy-projection-remote-preflight-k38",
        contractVersion: "1.0.0",
        checkedAt: CHECKED_AT,
        planId: PLAN_ID,
        k36ReleaseId: RELEASE_ID,
        mode: "explicit_opt_in_remote_read_only",
        remote: { publicBaseUrl: "https://assets.dkbcompanion.com/", bucket: "dokkanpanion-data" },
        source: {
            k37PlanSha256: sha256(jsonBytes(plan)), k37PlanSizeBytes: jsonBytes(plan).length,
            k37ManifestCandidateSha256: sha256(manifestCandidateBytes),
            k37ManifestCandidateSizeBytes: manifestCandidateBytes.length,
            k37ReceiptSha256: sha256(jsonBytes(receipt)), k37ReceiptSizeBytes: jsonBytes(receipt).length,
            k37MarkerSha256: sha256(jsonBytes(marker)), k37MarkerSizeBytes: jsonBytes(marker).length,
            sourceBoundBeforeTransport: "GO", sourceBoundAfterRemoteReads: "GO", sourceUnchanged: true,
        },
        objects: observations,
        objectSummary,
        manifest: {
            objectKey: taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_REMOTE_MANIFEST_KEY,
            status: manifestStatus,
            expectedSha256: sha256(manifestCandidateBytes),
            expectedSizeBytes: manifestCandidateBytes.length,
        },
        bucketUsage: { status: "known", reported: "361 MB", conservativeUpperBoundBytes: 361000001 },
        budget: k38Budget,
        checks: { noRemoteMutation: true, futurePublisherMustRerunK38: true },
        readiness: {
            readOnlyRemotePreflight: "GO", publicationAuthorization: "REQUIRED", publication: "NO-GO",
            r2Mutation: "NO-GO", android: "NO-GO", consumer: "NO-GO", authority: "NO-GO", production: "NO-GO",
        },
        state: "OPERATIONAL_OBSERVATION_ONLY_FUTURE_PUBLISHER_MUST_RERUN_K38",
    };
    return {
        validated,
        k38Report,
        k38Result: {
            reportDirectory: "X:/synthetic/k38/report",
            reportPath: "X:/synthetic/k38/report/report.json",
            reportSha256: K38_REPORT_SHA256,
            report: k38Report,
        },
    };
}
const roots = {
    k37OutputRoot: "X:/explicit/k37-output",
    k37PlanId: PLAN_ID,
    k36OutputRoot: "X:/explicit/k36-output",
    k36ReleaseId: RELEASE_ID,
    k32Root: "X:/explicit/k32",
    k2Root: "X:/explicit/k2",
    productiveRoot: "X:/explicit/productive",
    sqliteRoot: "X:/explicit/sqlite",
    db1Root: "X:/explicit/db1",
    elfRoot: "X:/explicit/elf",
    nativeEvidenceRoot: "X:/explicit/native-evidence",
};
function cliArgs(outputRoot = "X:/explicit/output") {
    return [
        "--opt-in-k39", "--dry-run-only", "--remote-read-only",
        "--k37-output-root", roots.k37OutputRoot,
        "--k37-plan-id", roots.k37PlanId,
        "--k36-output-root", roots.k36OutputRoot,
        "--k36-release-id", roots.k36ReleaseId,
        "--k32-root", roots.k32Root,
        "--k2-root", roots.k2Root,
        "--productive-root", roots.productiveRoot,
        "--sqlite-root", roots.sqliteRoot,
        "--db1-root", roots.db1Root,
        "--elf-root", roots.elfRoot,
        "--native-evidence-root", roots.nativeEvidenceRoot,
        "--output-root", outputRoot,
        "--checked-at", CHECKED_AT,
    ];
}
async function runHarness(api, temporary, options = {}) {
    const fixture = options.fixture ?? makeFixture();
    const outputRoot = options.outputRoot ?? await (0, promises_1.mkdtemp)((0, path_1.join)(temporary, "output-"));
    const sequence = [];
    const k38Calls = [];
    const k37Calls = [];
    let sourceCalls = 0;
    globalThis[Symbol.for("dokkan.k39.k38-runner")] = (runOptions) => {
        sequence.push("k38");
        k38Calls.push(runOptions);
        return fixture.k38Result;
    };
    globalThis[Symbol.for("dokkan.k39.k37-reader")] = (readOptions) => {
        sequence.push(`k37-${++sourceCalls}`);
        k37Calls.push(readOptions);
        return sourceCalls === 1 ? fixture.validated : (options.afterSource ?? fixture.validated);
    };
    const result = await api.runTaxonomyProjectionPublisherDryRun({
        optInK39: true,
        dryRunOnly: true,
        remoteReadOnly: true,
        ...roots,
        outputRoot,
        checkedAt: CHECKED_AT,
    });
    return { fixture, outputRoot, result, sequence, k38Calls, k37Calls };
}
describe("K39 taxonomy projection publisher dry-run-only checkpoint", () => {
    let temporary;
    let api;
    before(async () => {
        temporary = await (0, promises_1.mkdtemp)((0, path_1.join)((0, os_1.tmpdir)(), "dokkan-k39-"));
        api = await loadInstrumentedApi();
    });
    after(async () => {
        delete globalThis[Symbol.for("dokkan.k39.k38-runner")];
        delete globalThis[Symbol.for("dokkan.k39.k37-reader")];
        await (0, promises_1.rm)(temporary, { recursive: true, force: true });
    });
    it("requires every exact CLI switch and every K38 value argument with no defaults", async () => {
        const parsed = (0, taxonomy_projection_publisher_dry_run_run_1.parseTaxonomyProjectionPublisherDryRunCli)(cliArgs());
        (0, assert_1.equal)(parsed.optInK39, true);
        (0, assert_1.equal)(parsed.dryRunOnly, true);
        (0, assert_1.equal)(parsed.remoteReadOnly, true);
        (0, assert_1.equal)(parsed.checkedAt, CHECKED_AT);
        for (const removed of ["--opt-in-k39", "--dry-run-only", "--remote-read-only",
            "--k37-plan-id", "--k36-release-id", "--sqlite-root", "--output-root", "--checked-at"]) {
            const args = cliArgs();
            const index = args.indexOf(removed);
            args.splice(index, removed === "--opt-in-k39" || removed === "--dry-run-only"
                || removed === "--remote-read-only" ? 1 : 2);
            await (0, assert_1.rejects)(async () => (0, taxonomy_projection_publisher_dry_run_run_1.parseTaxonomyProjectionPublisherDryRunCli)(args), /requires exactly|missing/);
        }
        await (0, assert_1.rejects)(async () => (0, taxonomy_projection_publisher_dry_run_run_1.parseTaxonomyProjectionPublisherDryRunCli)([...cliArgs(), "--unknown"]), /unsupported/);
        await (0, assert_1.rejects)(async () => (0, taxonomy_projection_publisher_dry_run_run_1.parseTaxonomyProjectionPublisherDryRunCli)([...cliArgs(), "--dry-run-only"]), /exactly one/);
    });
    it("has no import side effects, injection surface, credentials, writer, or publication capability", async () => {
        (0, assert_1.deepStrictEqual)(Object.keys(productionApi).sort(), ["runTaxonomyProjectionPublisherDryRun"]);
        const source = await (0, promises_1.readFile)((0, path_1.join)(repositorySourceRoot(), "database-characters", "taxonomy-projection-publisher-dry-run.ts"), "utf8");
        (0, assert_1.doesNotMatch)(source, /export (?:interface|type|function|const).*?(?:Transport|Writer|SavedReport|BucketClient|ReportReader)/i);
        (0, assert_1.doesNotMatch)(source, /(?:@aws-sdk|S3Client|PutObjectCommand|DeleteObjectCommand|UploadPartCommand|CopyObjectCommand)/);
        (0, assert_1.doesNotMatch)(source, /(?:accessKeyId|secretAccessKey|credential|\bAuthorization\s*:)/i);
        (0, assert_1.doesNotMatch)(source, /(?:httpsRequest|fetch\s*\(|execFile\s*\()/);
        (0, assert_1.doesNotMatch)(source, /Character\s*\[\s*\]/);
    });
    it("productively reruns K38 first with every explicit input and requires GO", async () => {
        const run = await runHarness(api, temporary);
        (0, assert_1.deepStrictEqual)(run.sequence, ["k38", "k37-1", "k37-2"]);
        (0, assert_1.deepStrictEqual)(run.k38Calls, [{
                optInK38: true,
                remoteReadOnly: true,
                ...roots,
                outputRoot: run.outputRoot,
                checkedAt: CHECKED_AT,
            }]);
        (0, assert_1.deepStrictEqual)(run.k37Calls, Array(2).fill({
            outputRoot: roots.k37OutputRoot,
            planId: roots.k37PlanId,
            k36OutputRoot: roots.k36OutputRoot,
            k36ReleaseId: roots.k36ReleaseId,
            k32Root: roots.k32Root,
            k2Root: roots.k2Root,
            productiveRoot: roots.productiveRoot,
            sqliteRoot: roots.sqliteRoot,
            db1Root: roots.db1Root,
            elfRoot: roots.elfRoot,
            nativeEvidenceRoot: roots.nativeEvidenceRoot,
        }));
        const noGo = makeFixture();
        noGo.k38Report.readiness.readOnlyRemotePreflight = "NO-GO";
        const noGoRoot = await (0, promises_1.mkdtemp)((0, path_1.join)(temporary, "no-go-"));
        let sourceCalls = 0;
        globalThis[Symbol.for("dokkan.k39.k38-runner")] = () => noGo.k38Result;
        globalThis[Symbol.for("dokkan.k39.k37-reader")] = () => { sourceCalls++; return noGo.validated; };
        await (0, assert_1.rejects)(() => api.runTaxonomyProjectionPublisherDryRun({
            optInK39: true, dryRunOnly: true, remoteReadOnly: true, ...roots,
            outputRoot: noGoRoot, checkedAt: CHECKED_AT,
        }), /unless the productively rerun K38 readiness is GO/);
        (0, assert_1.equal)(sourceCalls, 0);
    });
    it("emits four ordered immutable actions with exact cache, content types, and idempotency policy", async () => {
        const run = await runHarness(api, temporary);
        const actions = run.result.report.remote.immutableActions;
        (0, assert_1.equal)(actions.length, 4);
        (0, assert_1.deepStrictEqual)(actions.map(action => action.kind), ["payload", "coverage", "validation", "manifest"]);
        (0, assert_1.deepStrictEqual)(actions.map(action => action.order), [1, 2, 3, 4]);
        (0, assert_1.deepStrictEqual)(actions.map(action => action.action), [
            "reuse_verified_remote_bytes", "create_if_absent", "reuse_verified_remote_bytes", "create_if_absent",
        ]);
        (0, assert_1.deepStrictEqual)(actions.map(action => action.contentType), [
            "application/gzip", "application/json", "application/json", "application/json",
        ]);
        for (const action of actions) {
            (0, assert_1.equal)(action.cacheControl, taxonomy_projection_publisher_dry_run_contract_1.TAXONOMY_PROJECTION_IMMUTABLE_CACHE_CONTROL);
            (0, assert_1.equal)(action.prospectiveCreateSemantics.ifNoneMatch, "*");
            (0, assert_1.equal)(action.postCreateVerification.byteSha256AndSize, "REQUIRED");
            (0, assert_1.equal)(action.postCreateVerification.contentTypeAndCacheControlMetadata, "REQUIRED");
            (0, assert_1.equal)(action.overwrite, "FORBIDDEN");
            (0, assert_1.equal)(action.delete, "FORBIDDEN");
        }
        (0, assert_1.equal)(run.result.report.remote.mutationExecuted, false);
        (0, assert_1.equal)(run.result.report.remote.overwriteCount, 0);
        (0, assert_1.equal)(run.result.report.remote.deleteCount, 0);
    });
    it("puts the mutable manifest last and binds each K38 planning state to a future precondition", async () => {
        const expectations = {
            matching: ["reuse_and_verify", "NO_WRITE_REUSE_AND_VERIFY"],
            missing: ["prospective_create_if_absent", "If-None-Match: *"],
            different: ["prospective_replace_if_match", "If-Match: FRESH_ETAG_REQUIRED"],
        };
        for (const status of ["matching", "missing", "different"]) {
            const run = await runHarness(api, temporary, { fixture: makeFixture(undefined, status) });
            const manifest = run.result.report.remote.mutableManifest;
            (0, assert_1.equal)(manifest.order, "LAST_AFTER_ALL_IMMUTABLE_OBJECTS");
            (0, assert_1.equal)(manifest.action, expectations[status][0]);
            (0, assert_1.equal)(manifest.futureWritePrecondition, expectations[status][1]);
            (0, assert_1.equal)(manifest.contentType, "application/json");
            (0, assert_1.equal)(manifest.cacheControl, "no-store");
            (0, assert_1.equal)(manifest.freshDirectMetadataAndEtagVerificationRequired, true);
            (0, assert_1.equal)(manifest.futureSeparatelyAuthorizedWriteGateRequired, true);
            (0, assert_1.equal)(manifest.unconditionalOverwrite, "FORBIDDEN");
            (0, assert_1.equal)(manifest.delete, "FORBIDDEN");
        }
    });
    it("copies exact K38 bucket/byte/projection budgets and closes all authority readiness", async () => {
        const run = await runHarness(api, temporary);
        (0, assert_1.deepStrictEqual)(run.result.report.k38BucketUsage, run.fixture.k38Report.bucketUsage);
        (0, assert_1.deepStrictEqual)(run.result.report.k38Budget, run.fixture.k38Report.budget);
        (0, assert_1.equal)(run.result.report.source.k38.reportSha256, K38_REPORT_SHA256);
        (0, assert_1.equal)(run.result.report.source.k38.productivelyRerunForThisDryRun, true);
        (0, assert_1.equal)(run.result.report.readiness.dryRun, "GO");
        (0, assert_1.equal)(run.result.report.readiness.publicationAuthorization, "REQUIRED");
        for (const state of ["publication", "r2Mutation", "android", "consumer", "authority", "production"]) {
            (0, assert_1.equal)(run.result.report.readiness[state], "NO-GO");
        }
        (0, assert_1.equal)(run.result.report.checks.savedReportIsNotPublicationAuthority, true);
        (0, assert_1.equal)(run.result.report.checks.futurePublisherMustRerunK38, true);
        (0, assert_1.equal)(run.result.report.checks.futurePublisherMustDirectlyVerifyMetadataAndEtag, true);
    });
    it("rejects K37 drift and K38 lineage mismatch before writing K39", async () => {
        const fixture = makeFixture();
        const drifted = JSON.parse(JSON.stringify(fixture.validated));
        drifted.receipt.planId = "d".repeat(64);
        await (0, assert_1.rejects)(() => runHarness(api, temporary, { fixture, afterSource: drifted }), /source drifted/);
        const mismatch = makeFixture();
        mismatch.k38Report.source.k37PlanSha256 = "e".repeat(64);
        await (0, assert_1.rejects)(() => runHarness(api, temporary, { fixture: mismatch }), /lineage does not match/);
        const incompleteK38 = makeFixture();
        incompleteK38.k38Report.source.sourceBoundAfterRemoteReads = "NO-GO";
        await (0, assert_1.rejects)(() => runHarness(api, temporary, { fixture: incompleteK38 }), /freshly rerun K38 GO report/);
    });
    it("writes one bounded content-addressed create-only report", async () => {
        const run = await runHarness(api, temporary);
        const stored = await (0, promises_1.readFile)(run.result.reportPath);
        (0, assert_1.ok)(stored.length < taxonomy_projection_publisher_dry_run_contract_1.TAXONOMY_PROJECTION_PUBLISHER_DRY_RUN_MAX_REPORT_BYTES);
        (0, assert_1.equal)(sha256(stored), run.result.reportSha256);
        (0, assert_1.equal)((0, path_1.basename)(run.result.reportDirectory), run.result.reportSha256);
        (0, assert_1.equal)((0, path_1.basename)(run.result.reportPath), taxonomy_projection_publisher_dry_run_contract_1.TAXONOMY_PROJECTION_PUBLISHER_DRY_RUN_REPORT_FILE);
        (0, assert_1.deepStrictEqual)(JSON.parse(stored.toString("utf8")), run.result.report);
        await (0, assert_1.rejects)(() => runHarness(api, temporary, { fixture: run.fixture, outputRoot: run.outputRoot }), /create-only report already exists/);
    });
    it("rejects hard-linked reports and linked output containment when the platform permits", async function () {
        const hardlinkRun = await runHarness(api, temporary);
        const externalFile = (0, path_1.join)(temporary, "external-k39-report.json");
        await (0, promises_1.writeFile)(externalFile, "external");
        await (0, promises_1.unlink)(hardlinkRun.result.reportPath);
        await (0, promises_1.link)(externalFile, hardlinkRun.result.reportPath);
        await (0, assert_1.rejects)(() => runHarness(api, temporary, {
            fixture: hardlinkRun.fixture, outputRoot: hardlinkRun.outputRoot,
        }), /existing report file identity rejected/);
        const junctionRoot = await (0, promises_1.mkdtemp)((0, path_1.join)(temporary, "junction-root-"));
        const externalDirectory = await (0, promises_1.mkdtemp)((0, path_1.join)(temporary, "junction-external-"));
        try {
            await (0, promises_1.symlink)(externalDirectory, (0, path_1.join)(junctionRoot, taxonomy_projection_publisher_dry_run_contract_1.TAXONOMY_PROJECTION_PUBLISHER_DRY_RUN_NAMESPACE), "junction");
        }
        catch (error) {
            if (error?.code === "EPERM" || error?.code === "EACCES") {
                this.skip();
                return;
            }
            throw error;
        }
        let k38Calls = 0;
        globalThis[Symbol.for("dokkan.k39.k38-runner")] = () => { k38Calls++; return makeFixture().k38Result; };
        await (0, assert_1.rejects)(() => api.runTaxonomyProjectionPublisherDryRun({
            optInK39: true, dryRunOnly: true, remoteReadOnly: true, ...roots,
            outputRoot: junctionRoot, checkedAt: CHECKED_AT,
        }), /link|junction|regular directory/);
        (0, assert_1.equal)(k38Calls, 0);
    });
    it("rejects report file symlinks when the platform permits", async function () {
        const run = await runHarness(api, temporary);
        const externalFile = (0, path_1.join)(temporary, "external-k39-symlink.json");
        await (0, promises_1.writeFile)(externalFile, "external");
        await (0, promises_1.unlink)(run.result.reportPath);
        try {
            await (0, promises_1.symlink)(externalFile, run.result.reportPath, "file");
        }
        catch (error) {
            if (error?.code === "EPERM" || error?.code === "EACCES") {
                this.skip();
                return;
            }
            throw error;
        }
        await (0, assert_1.rejects)(() => runHarness(api, temporary, { fixture: run.fixture, outputRoot: run.outputRoot }), /existing report inventory rejected|existing report file identity rejected/);
    });
});
//# sourceMappingURL=taxonomy-projection-publisher-dry-run.spec.js.map