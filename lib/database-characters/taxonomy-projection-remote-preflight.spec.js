"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const crypto_1 = require("crypto");
const events_1 = require("events");
const promises_1 = require("fs/promises");
const ModuleApi = require("module");
const os_1 = require("os");
const path_1 = require("path");
const typescript_1 = require("typescript");
const productionApi = require("./taxonomy-projection-remote-preflight");
const taxonomy_projection_remote_preflight_contract_1 = require("./taxonomy-projection-remote-preflight-contract");
const taxonomy_projection_remote_preflight_run_1 = require("./taxonomy-projection-remote-preflight-run");
const taxonomy_projection_object_plan_contract_1 = require("./taxonomy-projection-object-plan-contract");
const PLAN_ID = "a".repeat(64);
const RELEASE_ID = "b".repeat(64);
const CHECKED_AT = "2026-08-14T12:34:56.789Z";
const jsonBytes = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
const sha256 = (value) => (0, crypto_1.createHash)("sha256").update(value).digest("hex");
function makeFixture(sizeOverrides) {
    const bytes = [Buffer.from("payload"), Buffer.from("coverage"), Buffer.from("validation"), Buffer.from("k35-manifest")];
    const hashes = bytes.map(sha256);
    const names = [
        `database-characters-k35-taxonomy-projection.${hashes[0]}.json.gz`,
        "database-characters-k35-taxonomy-projection-coverage.json",
        "database-characters-k35-taxonomy-projection-validation.json",
        "database-characters-k35-taxonomy-projection-manifest.json",
    ];
    const kinds = ["payload", "coverage", "validation", "manifest"];
    const objects = bytes.map((value, index) => ({
        kind: kinds[index],
        sourceFileName: names[index],
        objectKey: `${taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_REMOTE_NAMESPACE}/objects/sha256/${hashes[index]}/${names[index]}`,
        sha256: hashes[index],
        sizeBytes: sizeOverrides?.[index] ?? value.length,
        cacheControl: "public, max-age=31536000, immutable",
        contentAddressed: true,
        remoteHashProofRequiredBeforeReuse: true,
    }));
    const source = { k36: { releaseId: RELEASE_ID }, k35: { contract: "synthetic-k35" } };
    const manifestCandidate = {
        schemaVersion: 1,
        contract: "dokkan-database-character-taxonomy-projection-remote-manifest-candidate-k37",
        contractVersion: "1.0.0",
        generatedAt: "2026-08-14T00:00:00.000Z",
        datasetVersion: "synthetic-k38",
        releaseId: RELEASE_ID,
        source,
        inventory: { closed: true, artifactCount: 4, objects },
        cacheControl: "no-store",
        state: "MUTABLE_REMOTE_MANIFEST_CANDIDATE_ONLY",
        readiness: { consumer: "NO-GO", authority: "NO-GO", publication: "NO-GO", production: "NO-GO" },
    };
    const manifestCandidateBytes = jsonBytes(manifestCandidate);
    const immutableObjectBytes = objects.reduce((total, object) => total + object.sizeBytes, 0);
    const worstCaseNewBytes = immutableObjectBytes + taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_OBJECT_PLAN_MANIFEST_RESERVATION_BYTES;
    const plan = {
        schemaVersion: 1,
        contract: "dokkan-database-character-taxonomy-projection-object-plan-k37",
        contractVersion: "1.0.0",
        generatedAt: "2026-08-14T00:00:00.000Z",
        datasetVersion: "synthetic-k38",
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
            worstCaseNewBytes,
            withinNamespaceLimit: true,
            bucketCeilingBytes: taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_OBJECT_PLAN_BUCKET_CEILING_BYTES,
            remoteBucketBytes: "UNKNOWN",
            projectedBucketBytes: "UNKNOWN",
            withinBucketCeiling: "UNKNOWN",
            remotePreflightRequired: true,
        },
    };
    return {
        validated: {
            planDirectory: "X:/synthetic/k37",
            planId: PLAN_ID,
            plan,
            manifestCandidate,
            receipt: { contract: "synthetic-k37-receipt", planId: PLAN_ID },
            marker: { contract: "synthetic-k37-marker", planId: PLAN_ID },
            sourceBoundK36Validation: "GO",
            peakRssBytes: 1,
        },
        bytesByKey: new Map(objects.map((object, index) => [object.objectKey, bytes[index]])),
        manifestCandidateBytes,
    };
}
function repositorySourceRoot() {
    const parent = (0, path_1.resolve)(__dirname, "..");
    return (0, path_1.basename)(parent).toLowerCase() === "lib" ? (0, path_1.resolve)(parent, "..") : parent;
}
async function loadInstrumentedApi() {
    const parent = (0, path_1.resolve)(__dirname, "..");
    const compiledRun = (0, path_1.basename)(parent).toLowerCase() === "lib";
    const sourceRoot = repositorySourceRoot();
    const sourcePath = (0, path_1.join)(sourceRoot, "database-characters", "taxonomy-projection-remote-preflight.ts");
    const runtimePath = compiledRun
        ? (0, path_1.join)(parent, "database-characters", ".taxonomy-projection-remote-preflight.test-runtime.js")
        : (0, path_1.join)(sourceRoot, "database-characters", ".taxonomy-projection-remote-preflight.test-runtime.js");
    const source = await (0, promises_1.readFile)(sourcePath, "utf8");
    const instrumented = source
        .replace(/readValidatedTaxonomyProjectionObjectPlan\(/g, "__testReadValidatedTaxonomyProjectionObjectPlan(")
        .replace(/httpsRequest\(/g, "__testHttpsRequest(")
        .replace(/execFile\(/g, "__testExecFile(")
        .replace("function createAggregateCounter()", "export function createAggregateCounter()")
        .replace("export interface TaxonomyProjectionRemotePreflightRunOptions", `
const __testReadValidatedTaxonomyProjectionObjectPlan = (...args: any[]) => {
    const hook = (globalThis as any)[Symbol.for("dokkan.k38.source-reader")];
    if (typeof hook !== "function") throw new Error("K38 test source-reader hook missing");
    return hook(...args);
};
const __testHttpsRequest = (...args: any[]) => {
    const hook = (globalThis as any)[Symbol.for("dokkan.k38.https-request")];
    if (typeof hook !== "function") throw new Error("K38 test HTTPS hook missing");
    return hook(...args);
};
const __testExecFile = (...args: any[]) => {
    const hook = (globalThis as any)[Symbol.for("dokkan.k38.exec-file")];
    if (typeof hook !== "function") throw new Error("K38 test exec hook missing");
    return hook(...args);
};

export interface TaxonomyProjectionRemotePreflightRunOptions`);
    if (instrumented === source || !instrumented.includes("__testReadValidatedTaxonomyProjectionObjectPlan")
        || !instrumented.includes("export function createAggregateCounter")) {
        throw new Error("K38 test instrumentation failed");
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
class FakeResponse extends events_1.EventEmitter {
    statusCode;
    headers;
    destroyed = false;
    constructor(statusCode, headers) {
        super();
        this.statusCode = statusCode;
        this.headers = headers;
    }
    resume() { this.destroyed = true; }
    destroy() { this.destroyed = true; }
}
class FakeRequest extends events_1.EventEmitter {
    scenario;
    callback;
    timeoutCallback;
    constructor(scenario, callback) {
        super();
        this.scenario = scenario;
        this.callback = callback;
    }
    setTimeout(_milliseconds, callback) { this.timeoutCallback = callback; return this; }
    destroy(error) { if (error)
        queueMicrotask(() => this.emit("error", error)); return this; }
    end() {
        queueMicrotask(() => {
            if (this.scenario.timeout) {
                this.timeoutCallback?.();
                return;
            }
            const response = new FakeResponse(this.scenario.statusCode ?? 200, this.scenario.headers ?? {});
            this.callback(response);
            for (const chunk of this.scenario.chunks ?? [this.scenario.bytes ?? Buffer.alloc(0)]) {
                if (response.destroyed)
                    break;
                response.emit("data", chunk);
            }
            if (!response.destroyed)
                response.emit("end");
        });
    }
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
function cliArgs(outputRoot = "X:/explicit/k38-output") {
    return [
        "--opt-in-k38", "--remote-read-only",
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
    const httpCalls = [];
    const execCalls = [];
    let sourceCalls = 0;
    globalThis[Symbol.for("dokkan.k38.source-reader")] = (readOptions) => {
        sequence.push(`source-${++sourceCalls}`);
        (0, assert_1.deepStrictEqual)(readOptions, {
            outputRoot: roots.k37OutputRoot, planId: PLAN_ID,
            k36OutputRoot: roots.k36OutputRoot, k36ReleaseId: RELEASE_ID,
            k32Root: roots.k32Root, k2Root: roots.k2Root, productiveRoot: roots.productiveRoot,
            sqliteRoot: roots.sqliteRoot, db1Root: roots.db1Root, elfRoot: roots.elfRoot,
            nativeEvidenceRoot: roots.nativeEvidenceRoot,
        });
        return sourceCalls === 1 ? fixture.validated : (options.afterSource ?? fixture.validated);
    };
    globalThis[Symbol.for("dokkan.k38.https-request")] = (url, requestOptions, callback) => {
        const key = decodeURIComponent(url.pathname.slice(1));
        sequence.push(`get:${key}`);
        httpCalls.push({ key, url, options: requestOptions });
        const scenario = options.scenarioForKey?.(key, fixture)
            ?? (key === taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_REMOTE_MANIFEST_KEY
                ? { statusCode: 200, bytes: fixture.manifestCandidateBytes }
                : { statusCode: 200, bytes: fixture.bytesByKey.get(key) });
        return new FakeRequest(scenario, callback);
    };
    globalThis[Symbol.for("dokkan.k38.exec-file")] = (executable, args, execOptions, callback) => {
        sequence.push("bucket");
        execCalls.push({ executable, args, options: execOptions });
        queueMicrotask(() => callback(options.bucketError ?? null, options.bucketError ? "" : JSON.stringify({ bucket_size: options.bucketSize ?? "1 MB" }), "ignored"));
        return new events_1.EventEmitter();
    };
    const result = await api.runTaxonomyProjectionRemotePreflight({
        optInK38: true,
        remoteReadOnly: true,
        ...roots,
        outputRoot,
        checkedAt: CHECKED_AT,
    });
    return { result, fixture, outputRoot, sequence, httpCalls, execCalls };
}
describe("K38 taxonomy projection remote read-only preflight", () => {
    let temporary;
    let api;
    before(async () => {
        temporary = await (0, promises_1.mkdtemp)((0, path_1.join)((0, os_1.tmpdir)(), "dokkan-k38-"));
        api = await loadInstrumentedApi();
    });
    after(async () => {
        delete globalThis[Symbol.for("dokkan.k38.source-reader")];
        delete globalThis[Symbol.for("dokkan.k38.https-request")];
        delete globalThis[Symbol.for("dokkan.k38.exec-file")];
        await (0, promises_1.rm)(temporary, { recursive: true, force: true });
    });
    it("requires the exact opt-ins, every explicit root, IDs, output root and UTC checkedAt", async () => {
        const parsed = (0, taxonomy_projection_remote_preflight_run_1.parseTaxonomyProjectionRemotePreflightCli)(cliArgs());
        (0, assert_1.equal)(parsed.optInK38, true);
        (0, assert_1.equal)(parsed.remoteReadOnly, true);
        (0, assert_1.equal)(parsed.checkedAt, CHECKED_AT);
        (0, assert_1.deepStrictEqual)({ ...parsed, optInK38: undefined, remoteReadOnly: undefined, checkedAt: undefined, outputRoot: undefined }, { ...roots, optInK38: undefined, remoteReadOnly: undefined, checkedAt: undefined, outputRoot: undefined });
        for (const removed of ["--opt-in-k38", "--remote-read-only", "--k37-output-root", "--k36-release-id", "--output-root", "--checked-at"]) {
            const args = cliArgs();
            const index = args.indexOf(removed);
            args.splice(index, removed.startsWith("--opt") || removed === "--remote-read-only" ? 1 : 2);
            await (0, assert_1.rejects)(async () => (0, taxonomy_projection_remote_preflight_run_1.parseTaxonomyProjectionRemotePreflightCli)(args), /requires exactly|missing/);
        }
        await (0, assert_1.rejects)(async () => (0, taxonomy_projection_remote_preflight_run_1.parseTaxonomyProjectionRemotePreflightCli)([...cliArgs(), "--unknown"]), /unsupported/);
        await (0, assert_1.rejects)(async () => (0, taxonomy_projection_remote_preflight_run_1.parseTaxonomyProjectionRemotePreflightCli)([...cliArgs(), "--opt-in-k38"]), /exactly one/);
        const outputRoot = await (0, promises_1.mkdtemp)((0, path_1.join)(temporary, "invalid-time-"));
        let sourceCalls = 0;
        globalThis[Symbol.for("dokkan.k38.source-reader")] = () => { sourceCalls++; return makeFixture().validated; };
        await (0, assert_1.rejects)(() => api.runTaxonomyProjectionRemotePreflight({
            optInK38: false, remoteReadOnly: true, ...roots, outputRoot, checkedAt: CHECKED_AT,
        }), /opt-in-k38/);
        await (0, assert_1.rejects)(() => api.runTaxonomyProjectionRemotePreflight({
            optInK38: true, remoteReadOnly: false, ...roots, outputRoot, checkedAt: CHECKED_AT,
        }), /remote-read-only/);
        await (0, assert_1.rejects)(() => api.runTaxonomyProjectionRemotePreflight({
            optInK38: true, remoteReadOnly: true, ...roots, outputRoot, checkedAt: "2026-08-14T12:34:56-03:00",
        }), /canonical UTC checkedAt/);
        (0, assert_1.equal)(sourceCalls, 0);
    });
    it("has no import side effects or productive injection/self-attestation surface", async () => {
        (0, assert_1.deepStrictEqual)(Object.keys(productionApi).sort(), ["runTaxonomyProjectionRemotePreflight"]);
        const source = await (0, promises_1.readFile)((0, path_1.join)(repositorySourceRoot(), "database-characters", "taxonomy-projection-remote-preflight.ts"), "utf8");
        (0, assert_1.doesNotMatch)(source, /export (?:interface|type|function|const).*?(?:Reader|Transport|BucketReader|SavedReport)/i);
        (0, assert_1.doesNotMatch)(source, /from\s+["'][^"']*(?:publisher|publish-|s3)[^"']*["']/i);
        (0, assert_1.doesNotMatch)(source, /(?:PutObjectCommand|DeleteObjectCommand|UploadPartCommand|GetObjectCommand)/);
        (0, assert_1.doesNotMatch)(source, /Character\s*\[\s*\]/);
        (0, assert_1.doesNotMatch)(source, /from\s+["'][^"']*(?:credential|authorization|auth-client)[^"']*["']/i);
        (0, assert_1.doesNotMatch)(source, /headers\s*:\s*\{[^}]*Authorization/is);
        (0, assert_1.equal)(globalThis[Symbol.for("dokkan.k38.import-side-effect")], undefined);
    });
    it("returns GO for matching, missing, and different mutable-manifest planning states", async () => {
        for (const mode of ["matching", "missing", "different"]) {
            const run = await runHarness(api, temporary, {
                scenarioForKey: (key, fixture) => {
                    if (mode === "missing")
                        return { statusCode: 404, bytes: Buffer.alloc(0) };
                    if (key === taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_REMOTE_MANIFEST_KEY) {
                        return mode === "different"
                            ? { statusCode: 200, bytes: Buffer.from('{"datasetVersion":"older","releaseId":"old"}') }
                            : { statusCode: 200, bytes: fixture.manifestCandidateBytes };
                    }
                    return { statusCode: 200, bytes: fixture.bytesByKey.get(key) };
                },
            });
            (0, assert_1.equal)(run.result.report.readiness.readOnlyRemotePreflight, "GO");
            (0, assert_1.equal)(run.result.report.manifest.status, mode);
            (0, assert_1.equal)(run.result.report.objects.length, 4);
            (0, assert_1.equal)(run.result.report.checks.savedReportIsNotPublicationAuthority, true);
            (0, assert_1.equal)(run.result.report.checks.futurePublisherMustRerunK38, true);
            (0, assert_1.equal)(run.result.report.checks.callerControlledStableOutputNamespaceRequired, true);
            (0, assert_1.equal)(run.result.report.checks.rssStrictlyWithinLimitWithReservedHeadroom, true);
            (0, assert_1.equal)(run.result.report.readiness.publicationAuthorization, "REQUIRED");
            for (const state of ["publication", "r2Mutation", "android", "consumer", "authority", "production"]) {
                (0, assert_1.equal)(run.result.report.readiness[state], "NO-GO");
            }
            const expectedMissing = mode === "missing"
                ? run.fixture.validated.plan.objects.reduce((sum, object) => sum + object.sizeBytes, 0) : 0;
            (0, assert_1.equal)(run.result.report.budget.bytesNewIfPublished, expectedMissing + run.fixture.manifestCandidateBytes.length);
            (0, assert_1.equal)(run.sequence[0], "source-1");
            (0, assert_1.equal)(run.sequence[run.sequence.length - 1], "source-2");
        }
    });
    it("uses only the five exact GET keys and the one fixed bounded Wrangler command", async () => {
        const run = await runHarness(api, temporary);
        (0, assert_1.deepStrictEqual)(run.httpCalls.map(call => call.key), [
            ...run.fixture.validated.plan.objects.map((object) => object.objectKey),
            taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_REMOTE_MANIFEST_KEY,
        ]);
        for (const call of run.httpCalls) {
            (0, assert_1.equal)(call.url.origin, "https://assets.dkbcompanion.com");
            (0, assert_1.equal)(call.options.method, "GET");
            (0, assert_1.equal)(call.options.headers["Accept-Encoding"], "identity");
        }
        (0, assert_1.equal)(run.execCalls.length, 1);
        (0, assert_1.deepStrictEqual)(run.execCalls[0].args.slice(-5), ["r2", "bucket", "info", "dokkanpanion-data", "--json"]);
        (0, assert_1.equal)(run.execCalls[0].options.timeout, taxonomy_projection_remote_preflight_contract_1.TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_BUCKET_TIMEOUT_MS);
        (0, assert_1.equal)(run.execCalls[0].options.maxBuffer, taxonomy_projection_remote_preflight_contract_1.TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_BUCKET_MAX_BUFFER_BYTES);
        (0, assert_1.equal)(run.execCalls[0].options.killSignal, "SIGKILL");
        (0, assert_1.equal)(run.execCalls[0].options.windowsHide, true);
        const invalid = makeFixture();
        invalid.validated.plan.objects.push({ ...invalid.validated.plan.objects[0], objectKey: "unexpected" });
        const outputRoot = await (0, promises_1.mkdtemp)((0, path_1.join)(temporary, "extra-key-"));
        let transportCalls = 0;
        globalThis[Symbol.for("dokkan.k38.source-reader")] = () => invalid.validated;
        globalThis[Symbol.for("dokkan.k38.https-request")] = () => { transportCalls++; throw new Error("must not run"); };
        await (0, assert_1.rejects)(() => api.runTaxonomyProjectionRemotePreflight({
            optInK38: true, remoteReadOnly: true, ...roots, outputRoot, checkedAt: CHECKED_AT,
        }), /ordered inventory rejected/);
        (0, assert_1.equal)(transportCalls, 0);
    });
    it("turns immutable conflicts, remote failures, and unknown bucket usage into NO-GO", async () => {
        const conflict = await runHarness(api, temporary, {
            scenarioForKey: (key, fixture) => key === fixture.validated.plan.objects[0].objectKey
                ? { statusCode: 200, bytes: Buffer.from("conflict") }
                : key === taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_REMOTE_MANIFEST_KEY
                    ? { statusCode: 200, bytes: fixture.manifestCandidateBytes }
                    : { statusCode: 200, bytes: fixture.bytesByKey.get(key) },
        });
        (0, assert_1.equal)(conflict.result.report.objects[0].status, "conflict");
        (0, assert_1.equal)(conflict.result.report.readiness.readOnlyRemotePreflight, "NO-GO");
        const failed = await runHarness(api, temporary, {
            scenarioForKey: (key, fixture) => key === fixture.validated.plan.objects[1].objectKey
                ? { statusCode: 500 }
                : key === taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_REMOTE_MANIFEST_KEY
                    ? { statusCode: 200, bytes: fixture.manifestCandidateBytes }
                    : { statusCode: 200, bytes: fixture.bytesByKey.get(key) },
        });
        (0, assert_1.equal)(failed.result.report.objects[1].status, "failed");
        (0, assert_1.equal)(failed.result.report.readiness.readOnlyRemotePreflight, "NO-GO");
        const manifestFailed = await runHarness(api, temporary, {
            scenarioForKey: (key, fixture) => key === taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_REMOTE_MANIFEST_KEY
                ? { statusCode: 503 }
                : { statusCode: 200, bytes: fixture.bytesByKey.get(key) },
        });
        (0, assert_1.equal)(manifestFailed.result.report.manifest.status, "failed");
        (0, assert_1.equal)(manifestFailed.result.report.readiness.readOnlyRemotePreflight, "NO-GO");
        const bucket = await runHarness(api, temporary, { bucketError: new Error("secret C:\\private\\token") });
        (0, assert_1.equal)(bucket.result.report.bucketUsage.status, "failed");
        (0, assert_1.equal)(bucket.result.report.budget.bucketConservativeUpperBoundBytes, "UNKNOWN");
        (0, assert_1.equal)(bucket.result.report.readiness.readOnlyRemotePreflight, "NO-GO");
        (0, assert_1.doesNotMatch)(bucket.result.report.bucketUsage.failure, /private|token/i);
    });
    it("blocks redirects, encodings, timeouts, oversized responses, and unexpected statuses", async () => {
        const cases = [
            ["redirect", { statusCode: 302 }, /redirect blocked/],
            ["encoding", { statusCode: 200, headers: { "content-encoding": "gzip" } }, /content encoding blocked/],
            ["timeout", { timeout: true }, /request timeout/],
            ["response-limit", { statusCode: 200, bytes: Buffer.alloc(taxonomy_projection_remote_preflight_contract_1.TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_MAX_RESPONSE_BYTES) }, /byte limit reached/],
            ["status", { statusCode: 429 }, /unexpected HTTP status 429/],
        ];
        for (const [, scenario, expected] of cases) {
            const run = await runHarness(api, temporary, {
                scenarioForKey: (key, fixture) => key === fixture.validated.plan.objects[0].objectKey
                    ? scenario
                    : key === taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_REMOTE_MANIFEST_KEY
                        ? { statusCode: 200, bytes: fixture.manifestCandidateBytes }
                        : { statusCode: 200, bytes: fixture.bytesByKey.get(key) },
            });
            (0, assert_1.equal)(run.result.report.objects[0].status, "failed");
            (0, assert_1.match)(run.result.report.objects[0].failure, expected);
            (0, assert_1.ok)(run.result.report.objects[0].failure.length <= taxonomy_projection_remote_preflight_contract_1.TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_MAX_FAILURE_LENGTH);
            (0, assert_1.equal)(run.result.report.readiness.readOnlyRemotePreflight, "NO-GO");
        }
        const counter = api.createAggregateCounter();
        counter.consume(taxonomy_projection_remote_preflight_contract_1.TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_MAX_AGGREGATE_BYTES - 1);
        await (0, assert_1.rejects)(async () => counter.consume(1), /aggregate response byte limit reached/);
    });
    it("requires strict namespace and bucket headroom, including equality", async () => {
        const baseline = makeFixture();
        const manifestBytes = baseline.manifestCandidateBytes.length;
        for (const delta of [0, 1]) {
            const reportedExactBytes = taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_OBJECT_PLAN_BUCKET_CEILING_BYTES - manifestBytes - 1 + delta;
            const run = await runHarness(api, temporary, { bucketSize: reportedExactBytes });
            (0, assert_1.equal)(run.result.report.budget.projectedBucketUpperBoundBytes, taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_OBJECT_PLAN_BUCKET_CEILING_BYTES + delta);
            (0, assert_1.equal)(run.result.report.budget.withinBucketCeiling, false);
            (0, assert_1.equal)(run.result.report.readiness.readOnlyRemotePreflight, "NO-GO");
        }
        const immutableBytesAtLimit = taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_OBJECT_PLAN_NAMESPACE_MAX_BYTES
            - taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_OBJECT_PLAN_MANIFEST_RESERVATION_BYTES;
        const sizes = [Math.floor(immutableBytesAtLimit / 4), Math.floor(immutableBytesAtLimit / 4),
            Math.floor(immutableBytesAtLimit / 4), 0];
        sizes[3] = immutableBytesAtLimit - sizes[0] - sizes[1] - sizes[2];
        const fixture = makeFixture(sizes);
        const namespace = await runHarness(api, temporary, {
            fixture,
            scenarioForKey: () => ({ statusCode: 404, bytes: Buffer.alloc(0) }),
        });
        (0, assert_1.equal)(namespace.result.report.budget.namespacePlanBytes, taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_OBJECT_PLAN_NAMESPACE_MAX_BYTES);
        (0, assert_1.equal)(namespace.result.report.budget.namespacePlanStrictlyWithinLimit, false);
        (0, assert_1.equal)(namespace.result.report.readiness.readOnlyRemotePreflight, "NO-GO");
    });
    it("revalidates K37 after all reads and rejects source drift before writing a report", async () => {
        const fixture = makeFixture();
        const drifted = JSON.parse(JSON.stringify(fixture.validated));
        drifted.receipt.planId = "c".repeat(64);
        await (0, assert_1.rejects)(() => runHarness(api, temporary, { fixture, afterSource: drifted }), /source drifted during remote reads/);
    });
    it("rejects source-artifact output aliases and reserves RSS before transport", async () => {
        const aliasRoot = await (0, promises_1.mkdtemp)((0, path_1.join)(temporary, "closed-source-alias-"));
        const aliased = makeFixture();
        aliased.validated.planDirectory = aliasRoot;
        let transportCalls = 0;
        globalThis[Symbol.for("dokkan.k38.https-request")] = () => {
            transportCalls++;
            throw new Error("must not run");
        };
        await (0, assert_1.rejects)(() => runHarness(api, temporary, { fixture: aliased, outputRoot: aliasRoot }), /must not alias or descend/);
        const rss = makeFixture();
        rss.validated.peakRssBytes = taxonomy_projection_remote_preflight_contract_1.TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_RSS_LIMIT_BYTES
            - taxonomy_projection_remote_preflight_contract_1.TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_RSS_REMOTE_RESERVE_BYTES;
        const rssOutput = await (0, promises_1.mkdtemp)((0, path_1.join)(temporary, "rss-reserve-"));
        let sourceCalls = 0;
        globalThis[Symbol.for("dokkan.k38.source-reader")] = () => {
            sourceCalls++;
            return rss.validated;
        };
        transportCalls = 0;
        globalThis[Symbol.for("dokkan.k38.https-request")] = () => {
            transportCalls++;
            throw new Error("must not run");
        };
        await (0, assert_1.rejects)(() => api.runTaxonomyProjectionRemotePreflight({
            optInK38: true, remoteReadOnly: true, ...roots, outputRoot: rssOutput, checkedAt: CHECKED_AT,
        }), /RSS limit reached/);
        (0, assert_1.equal)(sourceCalls, 1);
        (0, assert_1.equal)(transportCalls, 0);
        const finalRss = makeFixture();
        const finalRssSource = JSON.parse(JSON.stringify(finalRss.validated));
        finalRssSource.peakRssBytes = taxonomy_projection_remote_preflight_contract_1.TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_RSS_LIMIT_BYTES
            - taxonomy_projection_remote_preflight_contract_1.TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_RSS_REPORT_RESERVE_BYTES;
        const finalOutput = await (0, promises_1.mkdtemp)((0, path_1.join)(temporary, "rss-final-reserve-"));
        let finalSourceCalls = 0;
        globalThis[Symbol.for("dokkan.k38.source-reader")] = () => {
            finalSourceCalls++;
            return finalSourceCalls === 1 ? finalRss.validated : finalRssSource;
        };
        globalThis[Symbol.for("dokkan.k38.https-request")] = (url, requestOptions, callback) => {
            const key = decodeURIComponent(url.pathname.slice(1));
            const bytes = key === taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_REMOTE_MANIFEST_KEY
                ? finalRss.manifestCandidateBytes : finalRss.bytesByKey.get(key);
            return new FakeRequest({ statusCode: 200, bytes }, callback);
        };
        globalThis[Symbol.for("dokkan.k38.exec-file")] = (_executable, _args, _options, callback) => {
            queueMicrotask(() => callback(null, JSON.stringify({ bucket_size: "1 MB" }), ""));
            return new events_1.EventEmitter();
        };
        await (0, assert_1.rejects)(() => api.runTaxonomyProjectionRemotePreflight({
            optInK38: true, remoteReadOnly: true, ...roots, outputRoot: finalOutput, checkedAt: CHECKED_AT,
        }), /RSS limit reached/);
        (0, assert_1.equal)(finalSourceCalls, 2);
    });
    it("writes a bounded create-only non-authoritative report", async () => {
        const run = await runHarness(api, temporary);
        const stored = await (0, promises_1.readFile)(run.result.reportPath);
        (0, assert_1.ok)(stored.length < 64 * 1024);
        (0, assert_1.equal)(sha256(stored), run.result.reportSha256);
        (0, assert_1.deepStrictEqual)(JSON.parse(stored.toString("utf8")), run.result.report);
        (0, assert_1.equal)((0, path_1.dirname)(run.result.reportPath), run.result.reportDirectory);
        (0, assert_1.equal)((0, path_1.basename)(run.result.reportPath), taxonomy_projection_remote_preflight_contract_1.TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_REPORT_FILE);
        await (0, assert_1.rejects)(() => api.runTaxonomyProjectionRemotePreflight({
            optInK38: true, remoteReadOnly: true, ...roots, outputRoot: run.outputRoot, checkedAt: CHECKED_AT,
        }), /create-only report already exists/);
    });
    it("rejects report hard links and output containment links when the platform permits them", async function () {
        const hardlinkRun = await runHarness(api, temporary);
        const externalFile = (0, path_1.join)(temporary, "external-report.json");
        await (0, promises_1.writeFile)(externalFile, "external");
        await (0, promises_1.unlink)(hardlinkRun.result.reportPath);
        await (0, promises_1.link)(externalFile, hardlinkRun.result.reportPath);
        await (0, assert_1.rejects)(() => api.runTaxonomyProjectionRemotePreflight({
            optInK38: true, remoteReadOnly: true, ...roots, outputRoot: hardlinkRun.outputRoot, checkedAt: CHECKED_AT,
        }), /report file identity rejected/);
        const junctionRoot = await (0, promises_1.mkdtemp)((0, path_1.join)(temporary, "junction-root-"));
        const externalDirectory = await (0, promises_1.mkdtemp)((0, path_1.join)(temporary, "junction-external-"));
        try {
            await (0, promises_1.symlink)(externalDirectory, (0, path_1.join)(junctionRoot, taxonomy_projection_remote_preflight_contract_1.TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_NAMESPACE), "junction");
        }
        catch (error) {
            if (error?.code === "EPERM" || error?.code === "EACCES") {
                this.skip();
                return;
            }
            throw error;
        }
        let transportCalls = 0;
        globalThis[Symbol.for("dokkan.k38.source-reader")] = () => makeFixture().validated;
        globalThis[Symbol.for("dokkan.k38.https-request")] = () => { transportCalls++; throw new Error("must not run"); };
        await (0, assert_1.rejects)(() => api.runTaxonomyProjectionRemotePreflight({
            optInK38: true, remoteReadOnly: true, ...roots, outputRoot: junctionRoot, checkedAt: CHECKED_AT,
        }), /link|junction|regular directory/);
        (0, assert_1.equal)(transportCalls, 0);
    });
    it("rejects report file symlinks when the platform permits them", async function () {
        const run = await runHarness(api, temporary);
        const externalFile = (0, path_1.join)(temporary, "external-symlink-report.json");
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
        await (0, assert_1.rejects)(() => api.runTaxonomyProjectionRemotePreflight({
            optInK38: true, remoteReadOnly: true, ...roots, outputRoot: run.outputRoot, checkedAt: CHECKED_AT,
        }), /existing report inventory rejected|report file identity rejected/);
    });
});
//# sourceMappingURL=taxonomy-projection-remote-preflight.spec.js.map