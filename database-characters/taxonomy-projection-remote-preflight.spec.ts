import { deepStrictEqual, doesNotMatch, equal, match, ok, rejects } from "assert";
import { createHash } from "crypto";
import { EventEmitter } from "events";
import { link, mkdir, mkdtemp, readFile, rm, symlink, unlink, writeFile } from "fs/promises";
import * as ModuleApi from "module";
import { tmpdir } from "os";
import { basename, dirname, join, resolve } from "path";
import { ModuleKind, ScriptTarget, transpileModule } from "typescript";
import * as productionApi from "./taxonomy-projection-remote-preflight";
import {
    TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_BUCKET_MAX_BUFFER_BYTES,
    TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_BUCKET_TIMEOUT_MS,
    TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_MAX_AGGREGATE_BYTES,
    TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_MAX_FAILURE_LENGTH,
    TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_MAX_RESPONSE_BYTES,
    TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_NAMESPACE,
    TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_REPORT_FILE,
    TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_RSS_LIMIT_BYTES,
    TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_RSS_REMOTE_RESERVE_BYTES,
    TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_RSS_REPORT_RESERVE_BYTES,
} from "./taxonomy-projection-remote-preflight-contract";
import { parseTaxonomyProjectionRemotePreflightCli } from "./taxonomy-projection-remote-preflight-run";
import {
    TAXONOMY_PROJECTION_OBJECT_PLAN_BUCKET_CEILING_BYTES,
    TAXONOMY_PROJECTION_OBJECT_PLAN_MANIFEST_RESERVATION_BYTES,
    TAXONOMY_PROJECTION_OBJECT_PLAN_NAMESPACE_MAX_BYTES,
    TAXONOMY_PROJECTION_REMOTE_MANIFEST_KEY,
    TAXONOMY_PROJECTION_REMOTE_NAMESPACE,
} from "./taxonomy-projection-object-plan-contract";

const PLAN_ID = "a".repeat(64);
const RELEASE_ID = "b".repeat(64);
const CHECKED_AT = "2026-08-14T12:34:56.789Z";
const jsonBytes = (value: unknown): Buffer => Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
const sha256 = (value: Buffer | string): string => createHash("sha256").update(value).digest("hex");

interface Fixture {
    validated: any;
    bytesByKey: Map<string, Buffer>;
    manifestCandidateBytes: Buffer;
}

function makeFixture(sizeOverrides?: number[]): Fixture {
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
        objectKey: `${TAXONOMY_PROJECTION_REMOTE_NAMESPACE}/objects/sha256/${hashes[index]}/${names[index]}`,
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
    const worstCaseNewBytes = immutableObjectBytes + TAXONOMY_PROJECTION_OBJECT_PLAN_MANIFEST_RESERVATION_BYTES;
    const plan = {
        schemaVersion: 1,
        contract: "dokkan-database-character-taxonomy-projection-object-plan-k37",
        contractVersion: "1.0.0",
        generatedAt: "2026-08-14T00:00:00.000Z",
        datasetVersion: "synthetic-k38",
        planId: PLAN_ID,
        mode: "explicit_opt_in_offline_local_only",
        source,
        remoteNamespace: TAXONOMY_PROJECTION_REMOTE_NAMESPACE,
        objects,
        mutableManifest: {
            localFileName: "database-characters-k37-taxonomy-projection-remote-manifest-candidate.json",
            objectKey: TAXONOMY_PROJECTION_REMOTE_MANIFEST_KEY,
            sha256: sha256(manifestCandidateBytes),
            sizeBytes: manifestCandidateBytes.length,
            cacheControl: "no-store",
            state: "CANDIDATE_ONLY",
        },
        budget: {
            namespaceLimitBytes: TAXONOMY_PROJECTION_OBJECT_PLAN_NAMESPACE_MAX_BYTES,
            immutableObjectBytes,
            mutableManifestReservationBytes: TAXONOMY_PROJECTION_OBJECT_PLAN_MANIFEST_RESERVATION_BYTES,
            worstCaseNewBytes,
            withinNamespaceLimit: true,
            bucketCeilingBytes: TAXONOMY_PROJECTION_OBJECT_PLAN_BUCKET_CEILING_BYTES,
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

type InstrumentedApi = typeof productionApi & { createAggregateCounter(): { bytesRead: number; consume(count: number): void } };

function repositorySourceRoot(): string {
    const parent = resolve(__dirname, "..");
    return basename(parent).toLowerCase() === "lib" ? resolve(parent, "..") : parent;
}

async function loadInstrumentedApi(): Promise<InstrumentedApi> {
    const parent = resolve(__dirname, "..");
    const compiledRun = basename(parent).toLowerCase() === "lib";
    const sourceRoot = repositorySourceRoot();
    const sourcePath = join(sourceRoot, "database-characters", "taxonomy-projection-remote-preflight.ts");
    const runtimePath = compiledRun
        ? join(parent, "database-characters", ".taxonomy-projection-remote-preflight.test-runtime.js")
        : join(sourceRoot, "database-characters", ".taxonomy-projection-remote-preflight.test-runtime.js");
    const source = await readFile(sourcePath, "utf8");
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
    const compiled = transpileModule(instrumented, {
        compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2022 },
        fileName: sourcePath,
    }).outputText;
    const ModuleConstructor = (ModuleApi as any).default ?? ModuleApi;
    const runtimeModule = new ModuleConstructor(runtimePath, module);
    runtimeModule.filename = runtimePath;
    runtimeModule.paths = ModuleConstructor._nodeModulePaths(dirname(runtimePath));
    runtimeModule._compile(compiled, runtimePath);
    return runtimeModule.exports as InstrumentedApi;
}

class FakeResponse extends EventEmitter {
    destroyed = false;
    constructor(readonly statusCode: number, readonly headers: Record<string, string | string[] | undefined>) { super(); }
    resume(): void { this.destroyed = true; }
    destroy(): void { this.destroyed = true; }
}

interface HttpScenario {
    statusCode?: number;
    bytes?: Buffer;
    headers?: Record<string, string>;
    timeout?: boolean;
    chunks?: Buffer[];
}

class FakeRequest extends EventEmitter {
    private timeoutCallback?: () => void;
    constructor(private readonly scenario: HttpScenario, private readonly callback: (response: FakeResponse) => void) { super(); }
    setTimeout(_milliseconds: number, callback: () => void): this { this.timeoutCallback = callback; return this; }
    destroy(error?: Error): this { if (error) queueMicrotask(() => this.emit("error", error)); return this; }
    end(): void {
        queueMicrotask(() => {
            if (this.scenario.timeout) { this.timeoutCallback?.(); return; }
            const response = new FakeResponse(this.scenario.statusCode ?? 200, this.scenario.headers ?? {});
            this.callback(response);
            for (const chunk of this.scenario.chunks ?? [this.scenario.bytes ?? Buffer.alloc(0)]) {
                if (response.destroyed) break;
                response.emit("data", chunk);
            }
            if (!response.destroyed) response.emit("end");
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

function cliArgs(outputRoot = "X:/explicit/k38-output"): string[] {
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

interface HarnessOptions {
    fixture?: Fixture;
    scenarioForKey?: (key: string, fixture: Fixture) => HttpScenario;
    bucketSize?: unknown;
    bucketError?: Error;
    afterSource?: any;
    outputRoot?: string;
}

async function runHarness(api: InstrumentedApi, temporary: string, options: HarnessOptions = {}) {
    const fixture = options.fixture ?? makeFixture();
    const outputRoot = options.outputRoot ?? await mkdtemp(join(temporary, "output-"));
    const sequence: string[] = [];
    const httpCalls: Array<{ key: string; url: URL; options: any }> = [];
    const execCalls: Array<{ executable: string; args: string[]; options: any }> = [];
    let sourceCalls = 0;
    (globalThis as any)[Symbol.for("dokkan.k38.source-reader")] = (readOptions: any) => {
        sequence.push(`source-${++sourceCalls}`);
        deepStrictEqual(readOptions, {
            outputRoot: roots.k37OutputRoot, planId: PLAN_ID,
            k36OutputRoot: roots.k36OutputRoot, k36ReleaseId: RELEASE_ID,
            k32Root: roots.k32Root, k2Root: roots.k2Root, productiveRoot: roots.productiveRoot,
            sqliteRoot: roots.sqliteRoot, db1Root: roots.db1Root, elfRoot: roots.elfRoot,
            nativeEvidenceRoot: roots.nativeEvidenceRoot,
        });
        return sourceCalls === 1 ? fixture.validated : (options.afterSource ?? fixture.validated);
    };
    (globalThis as any)[Symbol.for("dokkan.k38.https-request")] = (url: URL, requestOptions: any, callback: any) => {
        const key = decodeURIComponent(url.pathname.slice(1));
        sequence.push(`get:${key}`);
        httpCalls.push({ key, url, options: requestOptions });
        const scenario = options.scenarioForKey?.(key, fixture)
            ?? (key === TAXONOMY_PROJECTION_REMOTE_MANIFEST_KEY
                ? { statusCode: 200, bytes: fixture.manifestCandidateBytes }
                : { statusCode: 200, bytes: fixture.bytesByKey.get(key)! });
        return new FakeRequest(scenario, callback);
    };
    (globalThis as any)[Symbol.for("dokkan.k38.exec-file")] = (executable: string, args: string[], execOptions: any, callback: any) => {
        sequence.push("bucket");
        execCalls.push({ executable, args, options: execOptions });
        queueMicrotask(() => callback(options.bucketError ?? null,
            options.bucketError ? "" : JSON.stringify({ bucket_size: options.bucketSize ?? "1 MB" }), "ignored"));
        return new EventEmitter();
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
    let temporary: string;
    let api: InstrumentedApi;

    before(async () => {
        temporary = await mkdtemp(join(tmpdir(), "dokkan-k38-"));
        api = await loadInstrumentedApi();
    });
    after(async () => {
        delete (globalThis as any)[Symbol.for("dokkan.k38.source-reader")];
        delete (globalThis as any)[Symbol.for("dokkan.k38.https-request")];
        delete (globalThis as any)[Symbol.for("dokkan.k38.exec-file")];
        await rm(temporary, { recursive: true, force: true });
    });

    it("requires the exact opt-ins, every explicit root, IDs, output root and UTC checkedAt", async () => {
        const parsed = parseTaxonomyProjectionRemotePreflightCli(cliArgs());
        equal(parsed.optInK38, true);
        equal(parsed.remoteReadOnly, true);
        equal(parsed.checkedAt, CHECKED_AT);
        deepStrictEqual({ ...parsed, optInK38: undefined, remoteReadOnly: undefined, checkedAt: undefined, outputRoot: undefined },
            { ...roots, optInK38: undefined, remoteReadOnly: undefined, checkedAt: undefined, outputRoot: undefined });
        for (const removed of ["--opt-in-k38", "--remote-read-only", "--k37-output-root", "--k36-release-id", "--output-root", "--checked-at"]) {
            const args = cliArgs();
            const index = args.indexOf(removed);
            args.splice(index, removed.startsWith("--opt") || removed === "--remote-read-only" ? 1 : 2);
            await rejects(async () => parseTaxonomyProjectionRemotePreflightCli(args), /requires exactly|missing/);
        }
        await rejects(async () => parseTaxonomyProjectionRemotePreflightCli([...cliArgs(), "--unknown"]), /unsupported/);
        await rejects(async () => parseTaxonomyProjectionRemotePreflightCli([...cliArgs(), "--opt-in-k38"]), /exactly one/);
        const outputRoot = await mkdtemp(join(temporary, "invalid-time-"));
        let sourceCalls = 0;
        (globalThis as any)[Symbol.for("dokkan.k38.source-reader")] = () => { sourceCalls++; return makeFixture().validated; };
        await rejects(() => api.runTaxonomyProjectionRemotePreflight({
            optInK38: false, remoteReadOnly: true, ...roots, outputRoot, checkedAt: CHECKED_AT,
        } as any), /opt-in-k38/);
        await rejects(() => api.runTaxonomyProjectionRemotePreflight({
            optInK38: true, remoteReadOnly: false, ...roots, outputRoot, checkedAt: CHECKED_AT,
        } as any), /remote-read-only/);
        await rejects(() => api.runTaxonomyProjectionRemotePreflight({
            optInK38: true, remoteReadOnly: true, ...roots, outputRoot, checkedAt: "2026-08-14T12:34:56-03:00",
        }), /canonical UTC checkedAt/);
        equal(sourceCalls, 0);
    });

    it("has no import side effects or productive injection/self-attestation surface", async () => {
        deepStrictEqual(Object.keys(productionApi).sort(), ["runTaxonomyProjectionRemotePreflight"]);
        const source = await readFile(join(repositorySourceRoot(), "database-characters", "taxonomy-projection-remote-preflight.ts"), "utf8");
        doesNotMatch(source, /export (?:interface|type|function|const).*?(?:Reader|Transport|BucketReader|SavedReport)/i);
        doesNotMatch(source, /from\s+["'][^"']*(?:publisher|publish-|s3)[^"']*["']/i);
        doesNotMatch(source, /(?:PutObjectCommand|DeleteObjectCommand|UploadPartCommand|GetObjectCommand)/);
        doesNotMatch(source, /Character\s*\[\s*\]/);
        doesNotMatch(source, /from\s+["'][^"']*(?:credential|authorization|auth-client)[^"']*["']/i);
        doesNotMatch(source, /headers\s*:\s*\{[^}]*Authorization/is);
        equal((globalThis as any)[Symbol.for("dokkan.k38.import-side-effect")], undefined);
    });

    it("returns GO for matching, missing, and different mutable-manifest planning states", async () => {
        for (const mode of ["matching", "missing", "different"] as const) {
            const run = await runHarness(api, temporary, {
                scenarioForKey: (key, fixture) => {
                    if (mode === "missing") return { statusCode: 404, bytes: Buffer.alloc(0) };
                    if (key === TAXONOMY_PROJECTION_REMOTE_MANIFEST_KEY) {
                        return mode === "different"
                            ? { statusCode: 200, bytes: Buffer.from('{"datasetVersion":"older","releaseId":"old"}') }
                            : { statusCode: 200, bytes: fixture.manifestCandidateBytes };
                    }
                    return { statusCode: 200, bytes: fixture.bytesByKey.get(key)! };
                },
            });
            equal(run.result.report.readiness.readOnlyRemotePreflight, "GO");
            equal(run.result.report.manifest.status, mode);
            equal(run.result.report.objects.length, 4);
            equal(run.result.report.checks.savedReportIsNotPublicationAuthority, true);
            equal(run.result.report.checks.futurePublisherMustRerunK38, true);
            equal(run.result.report.checks.callerControlledStableOutputNamespaceRequired, true);
            equal(run.result.report.checks.rssStrictlyWithinLimitWithReservedHeadroom, true);
            equal(run.result.report.readiness.publicationAuthorization, "REQUIRED");
            for (const state of ["publication", "r2Mutation", "android", "consumer", "authority", "production"] as const) {
                equal(run.result.report.readiness[state], "NO-GO");
            }
            const expectedMissing = mode === "missing"
                ? run.fixture.validated.plan.objects.reduce((sum: number, object: any) => sum + object.sizeBytes, 0) : 0;
            equal(run.result.report.budget.bytesNewIfPublished,
                expectedMissing + run.fixture.manifestCandidateBytes.length);
            equal(run.sequence[0], "source-1");
            equal(run.sequence[run.sequence.length - 1], "source-2");
        }
    });

    it("uses only the five exact GET keys and the one fixed bounded Wrangler command", async () => {
        const run = await runHarness(api, temporary);
        deepStrictEqual(run.httpCalls.map(call => call.key), [
            ...run.fixture.validated.plan.objects.map((object: any) => object.objectKey),
            TAXONOMY_PROJECTION_REMOTE_MANIFEST_KEY,
        ]);
        for (const call of run.httpCalls) {
            equal(call.url.origin, "https://assets.dkbcompanion.com");
            equal(call.options.method, "GET");
            equal(call.options.headers["Accept-Encoding"], "identity");
        }
        equal(run.execCalls.length, 1);
        deepStrictEqual(run.execCalls[0].args.slice(-5), ["r2", "bucket", "info", "dokkanpanion-data", "--json"]);
        equal(run.execCalls[0].options.timeout, TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_BUCKET_TIMEOUT_MS);
        equal(run.execCalls[0].options.maxBuffer, TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_BUCKET_MAX_BUFFER_BYTES);
        equal(run.execCalls[0].options.killSignal, "SIGKILL");
        equal(run.execCalls[0].options.windowsHide, true);
        const invalid = makeFixture();
        invalid.validated.plan.objects.push({ ...invalid.validated.plan.objects[0], objectKey: "unexpected" });
        const outputRoot = await mkdtemp(join(temporary, "extra-key-"));
        let transportCalls = 0;
        (globalThis as any)[Symbol.for("dokkan.k38.source-reader")] = () => invalid.validated;
        (globalThis as any)[Symbol.for("dokkan.k38.https-request")] = () => { transportCalls++; throw new Error("must not run"); };
        await rejects(() => api.runTaxonomyProjectionRemotePreflight({
            optInK38: true, remoteReadOnly: true, ...roots, outputRoot, checkedAt: CHECKED_AT,
        }), /ordered inventory rejected/);
        equal(transportCalls, 0);
    });

    it("turns immutable conflicts, remote failures, and unknown bucket usage into NO-GO", async () => {
        const conflict = await runHarness(api, temporary, {
            scenarioForKey: (key, fixture) => key === fixture.validated.plan.objects[0].objectKey
                ? { statusCode: 200, bytes: Buffer.from("conflict") }
                : key === TAXONOMY_PROJECTION_REMOTE_MANIFEST_KEY
                    ? { statusCode: 200, bytes: fixture.manifestCandidateBytes }
                    : { statusCode: 200, bytes: fixture.bytesByKey.get(key)! },
        });
        equal(conflict.result.report.objects[0].status, "conflict");
        equal(conflict.result.report.readiness.readOnlyRemotePreflight, "NO-GO");

        const failed = await runHarness(api, temporary, {
            scenarioForKey: (key, fixture) => key === fixture.validated.plan.objects[1].objectKey
                ? { statusCode: 500 }
                : key === TAXONOMY_PROJECTION_REMOTE_MANIFEST_KEY
                    ? { statusCode: 200, bytes: fixture.manifestCandidateBytes }
                    : { statusCode: 200, bytes: fixture.bytesByKey.get(key)! },
        });
        equal(failed.result.report.objects[1].status, "failed");
        equal(failed.result.report.readiness.readOnlyRemotePreflight, "NO-GO");

        const manifestFailed = await runHarness(api, temporary, {
            scenarioForKey: (key, fixture) => key === TAXONOMY_PROJECTION_REMOTE_MANIFEST_KEY
                ? { statusCode: 503 }
                : { statusCode: 200, bytes: fixture.bytesByKey.get(key)! },
        });
        equal(manifestFailed.result.report.manifest.status, "failed");
        equal(manifestFailed.result.report.readiness.readOnlyRemotePreflight, "NO-GO");

        const bucket = await runHarness(api, temporary, { bucketError: new Error("secret C:\\private\\token") });
        equal(bucket.result.report.bucketUsage.status, "failed");
        equal(bucket.result.report.budget.bucketConservativeUpperBoundBytes, "UNKNOWN");
        equal(bucket.result.report.readiness.readOnlyRemotePreflight, "NO-GO");
        doesNotMatch(bucket.result.report.bucketUsage.failure!, /private|token/i);
    });

    it("blocks redirects, encodings, timeouts, oversized responses, and unexpected statuses", async () => {
        const cases: Array<[string, HttpScenario, RegExp]> = [
            ["redirect", { statusCode: 302 }, /redirect blocked/],
            ["encoding", { statusCode: 200, headers: { "content-encoding": "gzip" } }, /content encoding blocked/],
            ["timeout", { timeout: true }, /request timeout/],
            ["response-limit", { statusCode: 200, bytes: Buffer.alloc(TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_MAX_RESPONSE_BYTES) }, /byte limit reached/],
            ["status", { statusCode: 429 }, /unexpected HTTP status 429/],
        ];
        for (const [, scenario, expected] of cases) {
            const run = await runHarness(api, temporary, {
                scenarioForKey: (key, fixture) => key === fixture.validated.plan.objects[0].objectKey
                    ? scenario
                    : key === TAXONOMY_PROJECTION_REMOTE_MANIFEST_KEY
                        ? { statusCode: 200, bytes: fixture.manifestCandidateBytes }
                        : { statusCode: 200, bytes: fixture.bytesByKey.get(key)! },
            });
            equal(run.result.report.objects[0].status, "failed");
            match(run.result.report.objects[0].failure!, expected);
            ok(run.result.report.objects[0].failure!.length <= TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_MAX_FAILURE_LENGTH);
            equal(run.result.report.readiness.readOnlyRemotePreflight, "NO-GO");
        }
        const counter = api.createAggregateCounter();
        counter.consume(TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_MAX_AGGREGATE_BYTES - 1);
        await rejects(async () => counter.consume(1), /aggregate response byte limit reached/);
    });

    it("requires strict namespace and bucket headroom, including equality", async () => {
        const baseline = makeFixture();
        const manifestBytes = baseline.manifestCandidateBytes.length;
        for (const delta of [0, 1]) {
            const reportedExactBytes = TAXONOMY_PROJECTION_OBJECT_PLAN_BUCKET_CEILING_BYTES - manifestBytes - 1 + delta;
            const run = await runHarness(api, temporary, { bucketSize: reportedExactBytes });
            equal(run.result.report.budget.projectedBucketUpperBoundBytes,
                TAXONOMY_PROJECTION_OBJECT_PLAN_BUCKET_CEILING_BYTES + delta);
            equal(run.result.report.budget.withinBucketCeiling, false);
            equal(run.result.report.readiness.readOnlyRemotePreflight, "NO-GO");
        }
        const immutableBytesAtLimit = TAXONOMY_PROJECTION_OBJECT_PLAN_NAMESPACE_MAX_BYTES
            - TAXONOMY_PROJECTION_OBJECT_PLAN_MANIFEST_RESERVATION_BYTES;
        const sizes = [Math.floor(immutableBytesAtLimit / 4), Math.floor(immutableBytesAtLimit / 4),
            Math.floor(immutableBytesAtLimit / 4), 0];
        sizes[3] = immutableBytesAtLimit - sizes[0] - sizes[1] - sizes[2];
        const fixture = makeFixture(sizes);
        const namespace = await runHarness(api, temporary, {
            fixture,
            scenarioForKey: () => ({ statusCode: 404, bytes: Buffer.alloc(0) }),
        });
        equal(namespace.result.report.budget.namespacePlanBytes, TAXONOMY_PROJECTION_OBJECT_PLAN_NAMESPACE_MAX_BYTES);
        equal(namespace.result.report.budget.namespacePlanStrictlyWithinLimit, false);
        equal(namespace.result.report.readiness.readOnlyRemotePreflight, "NO-GO");
    });

    it("revalidates K37 after all reads and rejects source drift before writing a report", async () => {
        const fixture = makeFixture();
        const drifted = JSON.parse(JSON.stringify(fixture.validated));
        drifted.receipt.planId = "c".repeat(64);
        await rejects(() => runHarness(api, temporary, { fixture, afterSource: drifted }), /source drifted during remote reads/);
    });

    it("rejects source-artifact output aliases and reserves RSS before transport", async () => {
        const aliasRoot = await mkdtemp(join(temporary, "closed-source-alias-"));
        const aliased = makeFixture();
        aliased.validated.planDirectory = aliasRoot;
        let transportCalls = 0;
        (globalThis as any)[Symbol.for("dokkan.k38.https-request")] = () => {
            transportCalls++;
            throw new Error("must not run");
        };
        await rejects(() => runHarness(api, temporary, { fixture: aliased, outputRoot: aliasRoot }),
            /must not alias or descend/);

        const rss = makeFixture();
        rss.validated.peakRssBytes = TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_RSS_LIMIT_BYTES
            - TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_RSS_REMOTE_RESERVE_BYTES;
        const rssOutput = await mkdtemp(join(temporary, "rss-reserve-"));
        let sourceCalls = 0;
        (globalThis as any)[Symbol.for("dokkan.k38.source-reader")] = () => {
            sourceCalls++;
            return rss.validated;
        };
        transportCalls = 0;
        (globalThis as any)[Symbol.for("dokkan.k38.https-request")] = () => {
            transportCalls++;
            throw new Error("must not run");
        };
        await rejects(() => api.runTaxonomyProjectionRemotePreflight({
            optInK38: true, remoteReadOnly: true, ...roots, outputRoot: rssOutput, checkedAt: CHECKED_AT,
        }), /RSS limit reached/);
        equal(sourceCalls, 1);
        equal(transportCalls, 0);

        const finalRss = makeFixture();
        const finalRssSource = JSON.parse(JSON.stringify(finalRss.validated));
        finalRssSource.peakRssBytes = TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_RSS_LIMIT_BYTES
            - TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_RSS_REPORT_RESERVE_BYTES;
        const finalOutput = await mkdtemp(join(temporary, "rss-final-reserve-"));
        let finalSourceCalls = 0;
        (globalThis as any)[Symbol.for("dokkan.k38.source-reader")] = () => {
            finalSourceCalls++;
            return finalSourceCalls === 1 ? finalRss.validated : finalRssSource;
        };
        (globalThis as any)[Symbol.for("dokkan.k38.https-request")] = (url: URL, requestOptions: any, callback: any) => {
            const key = decodeURIComponent(url.pathname.slice(1));
            const bytes = key === TAXONOMY_PROJECTION_REMOTE_MANIFEST_KEY
                ? finalRss.manifestCandidateBytes : finalRss.bytesByKey.get(key)!;
            return new FakeRequest({ statusCode: 200, bytes }, callback);
        };
        (globalThis as any)[Symbol.for("dokkan.k38.exec-file")] = (_executable: string, _args: string[], _options: any, callback: any) => {
            queueMicrotask(() => callback(null, JSON.stringify({ bucket_size: "1 MB" }), ""));
            return new EventEmitter();
        };
        await rejects(() => api.runTaxonomyProjectionRemotePreflight({
            optInK38: true, remoteReadOnly: true, ...roots, outputRoot: finalOutput, checkedAt: CHECKED_AT,
        }), /RSS limit reached/);
        equal(finalSourceCalls, 2);
    });

    it("writes a bounded create-only non-authoritative report", async () => {
        const run = await runHarness(api, temporary);
        const stored = await readFile(run.result.reportPath);
        ok(stored.length < 64 * 1024);
        equal(sha256(stored), run.result.reportSha256);
        deepStrictEqual(JSON.parse(stored.toString("utf8")), run.result.report);
        equal(dirname(run.result.reportPath), run.result.reportDirectory);
        equal(basename(run.result.reportPath), TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_REPORT_FILE);
        await rejects(() => api.runTaxonomyProjectionRemotePreflight({
            optInK38: true, remoteReadOnly: true, ...roots, outputRoot: run.outputRoot, checkedAt: CHECKED_AT,
        }), /create-only report already exists/);
    });

    it("rejects report hard links and output containment links when the platform permits them", async function () {
        const hardlinkRun = await runHarness(api, temporary);
        const externalFile = join(temporary, "external-report.json");
        await writeFile(externalFile, "external");
        await unlink(hardlinkRun.result.reportPath);
        await link(externalFile, hardlinkRun.result.reportPath);
        await rejects(() => api.runTaxonomyProjectionRemotePreflight({
            optInK38: true, remoteReadOnly: true, ...roots, outputRoot: hardlinkRun.outputRoot, checkedAt: CHECKED_AT,
        }), /report file identity rejected/);

        const junctionRoot = await mkdtemp(join(temporary, "junction-root-"));
        const externalDirectory = await mkdtemp(join(temporary, "junction-external-"));
        try {
            await symlink(externalDirectory, join(junctionRoot, TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_NAMESPACE), "junction");
        } catch (error: any) {
            if (error?.code === "EPERM" || error?.code === "EACCES") { this.skip(); return; }
            throw error;
        }
        let transportCalls = 0;
        (globalThis as any)[Symbol.for("dokkan.k38.source-reader")] = () => makeFixture().validated;
        (globalThis as any)[Symbol.for("dokkan.k38.https-request")] = () => { transportCalls++; throw new Error("must not run"); };
        await rejects(() => api.runTaxonomyProjectionRemotePreflight({
            optInK38: true, remoteReadOnly: true, ...roots, outputRoot: junctionRoot, checkedAt: CHECKED_AT,
        }), /link|junction|regular directory/);
        equal(transportCalls, 0);
    });

    it("rejects report file symlinks when the platform permits them", async function () {
        const run = await runHarness(api, temporary);
        const externalFile = join(temporary, "external-symlink-report.json");
        await writeFile(externalFile, "external");
        await unlink(run.result.reportPath);
        try {
            await symlink(externalFile, run.result.reportPath, "file");
        } catch (error: any) {
            if (error?.code === "EPERM" || error?.code === "EACCES") { this.skip(); return; }
            throw error;
        }
        await rejects(() => api.runTaxonomyProjectionRemotePreflight({
            optInK38: true, remoteReadOnly: true, ...roots, outputRoot: run.outputRoot, checkedAt: CHECKED_AT,
        }), /existing report inventory rejected|report file identity rejected/);
    });
});
