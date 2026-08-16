import { deepStrictEqual, equal, rejects, throws } from "assert";
import { createHash } from "crypto";
import { EventEmitter } from "events";
import { link, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "fs/promises";
import * as ModuleApi from "module";
import { tmpdir } from "os";
import { basename, dirname, join, resolve } from "path";
import { ModuleKind, ScriptTarget, transpileModule } from "typescript";
import { gzipSync } from "zlib";
import { CHARACTER_LEADER_SUPPORTED_PROJECTION_FILES, CharacterLeaderSupportedProjectionArtifactSet } from "./leader-supported-projection-contract";
import {
    CharacterLeaderSupportedPublisherDryRunArtifactSet,
    CHARACTER_LEADER_SUPPORTED_PUBLISHER_FILES,
    CHARACTER_LEADER_SUPPORTED_PUBLISHER_IMMUTABLE_CACHE_CONTROL,
    CHARACTER_LEADER_SUPPORTED_PUBLISHER_MANIFEST_KEY,
} from "./leader-supported-publisher-dry-run-contract";
import { buildCharacterLeaderSupportedPublisherDryRun } from "./leader-supported-publisher-dry-run";
import {
    CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_BUCKET_CEILING_BYTES,
    CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_REPORT_FILE,
    CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_RESPONSE_LIMIT_BYTES,
} from "./leader-supported-remote-preflight-contract";
import * as productionApi from "./leader-supported-remote-preflight";
import { parseCharacterLeaderSupportedRemotePreflightCli } from "./leader-supported-remote-preflight-run";

const SOURCE = Symbol.for("dokkan.k59.k58-validator");
const HTTPS = Symbol.for("dokkan.k59.https-request");
const EXEC = Symbol.for("dokkan.k59.exec-file");
const sha = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");
const jsonBytes = (value: unknown): Buffer => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);

type InstrumentedApi = typeof productionApi;
let instrumentedApi: InstrumentedApi;

function repositorySourceRoot(): string {
    const parent = resolve(__dirname, "..");
    return basename(parent).toLowerCase() === "lib" ? resolve(parent, "..") : parent;
}

async function loadInstrumentedApi(): Promise<InstrumentedApi> {
    const parent = resolve(__dirname, ".."), sourceRoot = repositorySourceRoot();
    const sourcePath = join(sourceRoot, "database-characters", "leader-supported-remote-preflight.ts");
    const runtimePath = join(basename(parent).toLowerCase() === "lib" ? parent : sourceRoot,
        "database-characters", ".leader-supported-remote-preflight.test-runtime.js");
    const source = await readFile(sourcePath, "utf8");
    const instrumented = source
        .replace(/validateCharacterLeaderSupportedPublisherDryRunArtifact\(\{/g, "__testValidateK58({")
        .replace(/httpsRequest\(url, \{/g, "__testHttpsRequest(url, {")
        .replace(/execFile\(process\.execPath,/g, "__testExecFile(process.execPath,")
        .replace("export interface CharacterLeaderSupportedRemotePreflightOptions", `
const __testValidateK58 = (...args: any[]) => {
    const hook = (globalThis as any)[Symbol.for("dokkan.k59.k58-validator")];
    if (typeof hook !== "function") throw new Error("K59 test K58 hook missing");
    return hook(...args);
};
const __testHttpsRequest = (...args: any[]) => {
    const hook = (globalThis as any)[Symbol.for("dokkan.k59.https-request")];
    if (typeof hook !== "function") throw new Error("K59 test HTTPS hook missing");
    return hook(...args);
};
const __testExecFile = (...args: any[]) => {
    const hook = (globalThis as any)[Symbol.for("dokkan.k59.exec-file")];
    if (typeof hook !== "function") throw new Error("K59 test exec hook missing");
    return hook(...args);
};

export interface CharacterLeaderSupportedRemotePreflightOptions`);
    if (instrumented === source || !instrumented.includes("__testValidateK58")
        || !instrumented.includes("__testHttpsRequest") || !instrumented.includes("__testExecFile")) {
        throw new Error("K59 test-only instrumentation failed");
    }
    const compiled = transpileModule(instrumented, {
        compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2022 }, fileName: sourcePath,
    }).outputText;
    const ModuleConstructor = (ModuleApi as any).default ?? ModuleApi;
    const runtimeModule = new ModuleConstructor(runtimePath, module);
    runtimeModule.filename = runtimePath;
    runtimeModule.paths = ModuleConstructor._nodeModulePaths(dirname(runtimePath));
    runtimeModule._compile(compiled, runtimePath);
    return runtimeModule.exports as InstrumentedApi;
}

function sourceFixture(lineage: any = {}): CharacterLeaderSupportedProjectionArtifactSet {
    const dataset: any = {
        schemaVersion: 1, contract: "dokkan-database-character-leader-supported-only-projection", contractVersion: "1.0.0",
        mode: "explicit_opt_in_offline_local_supported_only_default_off", source: lineage,
        policy: {
            supportedOnly: true, structuralIdsOnly: true, sourceOrderAndMultiplicityPreserved: true,
            outputNamespaceThreatModel: "caller_controlled_stable_during_operation",
            concurrentSameUserAncestorReplacementProtected: false, conditionalEffectsIncluded: false,
            unknownValuesMaterialized: false, execTimingTypeIncluded: false, causalityIncluded: false,
            ignoredPosition2Included: false, textOrDescriptionIncluded: false, aggregateOrFinalValueIncluded: false,
            primarySecondaryOrHybridInvented: false, characterArrayIncluded: false, patchOrApplyImplemented: false,
            authoritySelected: false, productionModified: false, publisherImplemented: false, networkEnabled: false,
            r2Enabled: false, androidImplemented: false,
        }, records: [],
    };
    const coverage: any = {
        schemaVersion: 1, contract: "dokkan-database-character-leader-supported-only-projection-coverage", contractVersion: "1.0.0",
        counts: { totalEffects: 3853, totalReferences: 12310, projectedEffects: 3836, projectedReferences: 12265, excludedEffects: 17, excludedReferences: 45 },
        projected: { effects: 3836, references: 12265, classification: "supported" },
        excluded: Array.from({ length: 17 }, (_, index) => ({
            effectRowId: ["5266", "5271", "5276", "5281", "5986", "5991", "5996", "6001", "8071", "10036", "11861", "11863", "10326202", "10326302", "10326402", "10326502", "10326602"][index],
            affectedReferences: Array.from({ length: index < 11 ? 3 : 2 }, (_, occurrence) => ({ stateId: `${index + 1}`, sourceEffectOccurrenceIndex: occurrence })),
            expression: 196, reason: "runtime_deck_index_unresolved", provenance: {} as any,
            corroborativeRule: { ruleId: "k56-conditional-domain-rule-v1", provenance: "user_confirmed_domain_rule", usedToAuthorizeSupportedProjection: false },
        })),
        corroborativeDomainRules: [], partial: {}, unknown: {}, unjoinable: {}, shadowParity: {}, provenance: {},
    };
    const validation: any = {
        schemaVersion: 1, contract: "dokkan-database-character-leader-supported-only-projection-validation", contractVersion: "1.0.0",
        valid: true, failures: [], sizes: {}, safety: {}, readiness: {
            offlineSupportedOnlyProjection: "GO", sourceBoundValidation: "NOT_EXECUTED", localShadowAuditDefaultOff: "NOT_EXECUTED",
        },
    };
    const raw = jsonBytes(dataset), gzip = gzipSync(raw, { level: 9 }), coverageBytes = jsonBytes(coverage), validationBytes = jsonBytes(validation);
    const manifest: any = {
        schemaVersion: 1, contract: "dokkan-database-character-leader-supported-only-projection-manifest", contractVersion: "1.0.0",
        fileName: `database-characters-k56-leader-supported-projection.${sha(gzip)}.json.gz`, compression: "gzip",
        sha256: sha(gzip), sizeBytes: gzip.length, uncompressedSha256: sha(raw), uncompressedSizeBytes: raw.length,
        counts: coverage.counts, source: lineage, outputNamespaceThreatModel: "caller_controlled_stable_during_operation",
        concurrentSameUserAncestorReplacementProtected: false, coverageFile: CHARACTER_LEADER_SUPPORTED_PROJECTION_FILES.coverage,
        coverageSha256: sha(coverageBytes), coverageSizeBytes: coverageBytes.length,
        validationFile: CHARACTER_LEADER_SUPPORTED_PROJECTION_FILES.validation,
        validationSha256: sha(validationBytes), validationSizeBytes: validationBytes.length,
    };
    const manifestBytes = jsonBytes(manifest);
    return { dataset, coverage, validation, manifest, raw, gzip, coverageBytes, validationBytes, manifestBytes };
}

function authorizedFixture(lineage: any = {}): CharacterLeaderSupportedPublisherDryRunArtifactSet {
    const direct = buildCharacterLeaderSupportedPublisherDryRun(sourceFixture(lineage));
    const plan: any = JSON.parse(JSON.stringify(direct.plan));
    plan.readiness.dryRun = "GO"; plan.readiness.sourceBoundValidation = "GO";
    const planBytes = jsonBytes(plan);
    const receipt: any = { ...direct.receipt, planSha256: sha(planBytes), planSizeBytes: planBytes.length, dryRun: "GO" };
    const receiptBytes = jsonBytes(receipt);
    const marker: any = { ...direct.marker, planSha256: sha(planBytes), receiptSha256: sha(receiptBytes) };
    const markerBytes = jsonBytes(marker);
    return { ...direct, plan, receipt, marker, planBytes, receiptBytes, markerBytes };
}

class FakeResponse extends EventEmitter {
    readonly statusCode: number;
    readonly headers: Record<string, string>;
    private readonly body: Buffer;
    constructor(statusCode: number, headers: Record<string, string>, body: Buffer) {
        super(); this.statusCode = statusCode; this.headers = headers; this.body = body;
    }
    resume(): void { this.emit("end"); }
    destroy(): void { this.emit("error", new Error("destroyed")); }
    deliver(): void { if (this.body.length) this.emit("data", this.body); this.emit("end"); }
}
class FakeRequest extends EventEmitter {
    private readonly timeOutImmediately: boolean;
    constructor(timeOutImmediately = false) { super(); this.timeOutImmediately = timeOutImmediately; }
    setTimeout(_ms: number, callback: () => void): this { if (this.timeOutImmediately) queueMicrotask(callback); return this; }
    end(): void { /* response is scheduled by harness */ }
    destroy(error: Error): void { this.emit("error", error); }
}

interface RemoteScenario { status: number; body: Buffer; headers: Record<string, string>; stall?: boolean }
interface Harness {
    base: string; output: string; options: any; artifacts: CharacterLeaderSupportedPublisherDryRunArtifactSet;
    calls: Array<{ url: string; options: any }>; execCalls: any[]; scenarios: RemoteScenario[];
    sources: CharacterLeaderSupportedPublisherDryRunArtifactSet[]; sequence: string[]; bucket: unknown; bucketError?: Error;
}

async function harness(): Promise<Harness> {
    const base = await mkdtemp(join(tmpdir(), "k59-preflight-"));
    const output = join(base, "output"), k56 = join(base, "k56"), k58 = join(base, "k58");
    const roots = ["sidecar", "production", "fyi", "k43", "k46", "k48"].map(name => join(base, name));
    await Promise.all([mkdir(output), mkdir(k56), mkdir(k58), ...roots.map(root => mkdir(root))]);
    const nativeRuntime = join(base, "runtime.so"), database = join(base, "database.sqlite");
    await Promise.all([writeFile(nativeRuntime, "elf"), writeFile(database, "db")]);
    const artifacts = authorizedFixture();
    const scenarios: RemoteScenario[] = artifacts.plan.immutableObjects.map((object, index) => ({
        status: 200, body: [sourceFixture().gzip, sourceFixture().coverageBytes, sourceFixture().validationBytes, sourceFixture().manifestBytes][index],
        headers: { "content-type": object.contentType, "cache-control": object.cacheControl },
    }));
    scenarios.push({ status: 200, body: artifacts.candidateManifestBytes, headers: { "content-type": "application/json", "cache-control": "no-store" } });
    const value: Harness = {
        base, output, artifacts, calls: [], execCalls: [], scenarios, sources: [artifacts, artifacts], sequence: [], bucket: "1 MB",
        options: {
            optIn: true, remoteReadOnly: true, sidecarRoot: roots[0], productionRoot: roots[1], fyiRoot: roots[2], k43Root: roots[3],
            k46Root: roots[4], k48Root: roots[5], k56Root: k56, k58Root: k58, outputRoot: output,
            nativeRuntime, database, checkedAt: "2026-08-16T12:00:00.000Z",
        },
    };
    let sourceCall = 0;
    (globalThis as any)[SOURCE] = async () => {
        value.sequence.push(sourceCall++ === 0 ? "source-before" : "source-after");
        return { artifacts: value.sources.shift(), sourceBoundValidation: "GO", k55ValidationProcessPeakRssBytes: 1 };
    };
    (globalThis as any)[HTTPS] = (url: URL, options: any, callback: (response: FakeResponse) => void) => {
        const key = decodeURI(url.pathname.slice(1)); value.sequence.push(`get:${key}`);
        value.calls.push({ url: url.toString(), options }); const scenario = value.scenarios.shift()!; const request = new FakeRequest(scenario.stall === true);
        queueMicrotask(() => { const response = new FakeResponse(scenario.status, scenario.headers, scenario.body); callback(response); if (!scenario.stall) response.deliver(); });
        return request;
    };
    (globalThis as any)[EXEC] = (file: string, args: string[], options: any, callback: Function) => {
        value.sequence.push("bucket"); value.execCalls.push({ file, args, options });
        queueMicrotask(() => callback(value.bucketError ?? null, JSON.stringify({ bucket_size: value.bucket }), ""));
    };
    return value;
}

function missing(s: RemoteScenario): void { s.status = 404; s.body = Buffer.alloc(0); s.headers = {}; }
function differentManifest(s: RemoteScenario, etag?: string): void {
    s.body = Buffer.from("{}\n"); s.headers = { "content-type": "application/json", "cache-control": "no-store", ...(etag ? { etag } : {}) };
}

describe("K59 supported leader remote read-only preflight", function () {
    this.timeout(30_000);
    const cli = [
        "--opt-in-k59", "--remote-read-only", "--sidecar-root", "s", "--production-root", "p", "--fyi-root", "f",
        "--k43-root", "43", "--k46-root", "46", "--k48-root", "48", "--k56-root", "56", "--k58-root", "58",
        "--output-root", "o", "--native-runtime", "elf", "--database", "db", "--checked-at", "2026-08-16T12:00:00.000Z",
    ];
    before(async () => { instrumentedApi = await loadInstrumentedApi(); });
    afterEach(() => { delete (globalThis as any)[SOURCE]; delete (globalThis as any)[HTTPS]; delete (globalThis as any)[EXEC]; });

    it("parses exact opt-ins and all explicit values with no defaults", () => {
        equal(parseCharacterLeaderSupportedRemotePreflightCli(cli).k58Root, "58");
        throws(() => parseCharacterLeaderSupportedRemotePreflightCli(cli.slice(1)), /exactly one/);
        throws(() => parseCharacterLeaderSupportedRemotePreflightCli([...cli, "loose"]), /unsupported/);
        throws(() => parseCharacterLeaderSupportedRemotePreflightCli([...cli, "--database", "again"]), /duplicate/);
    });

    it("performs exactly five ordered public GETs and one fixed read-only Wrangler call", async () => {
        const h = await harness();
        try {
            const result = await instrumentedApi.runCharacterLeaderSupportedRemotePreflight(h.options);
            equal(result.report.readiness.remotePreflight, "GO"); equal(h.calls.length, 5); equal(h.execCalls.length, 1);
            deepStrictEqual(h.calls.map(call => decodeURI(new URL(call.url).pathname.slice(1))), [
                ...h.artifacts.plan.immutableObjects.map(object => object.objectKey), CHARACTER_LEADER_SUPPORTED_PUBLISHER_MANIFEST_KEY,
            ]);
            equal(h.calls.every(call => call.options.method === "GET" && call.options.headers["Accept-Encoding"] === "identity"), true);
            deepStrictEqual(h.sequence, [
                "source-before", ...h.artifacts.plan.immutableObjects.map(object => `get:${object.objectKey}`),
                `get:${CHARACTER_LEADER_SUPPORTED_PUBLISHER_MANIFEST_KEY}`, "bucket", "source-after",
            ]);
            equal(result.report.checks.exactFiveOrderedGets, true);
            deepStrictEqual(h.execCalls[0].args.slice(-5), ["r2", "bucket", "info", "dokkanpanion-data", "--json"]);
            equal(h.execCalls[0].options.shell, false); equal(result.report.checks.noRemoteMutation, true);
            equal(result.report.readiness.processTreeRssUnder1GiB, "NO-GO");
        } finally { await rm(h.base, { recursive: true, force: true }); }
    });

    it("models all missing and a different mutable manifest with conditional writes only", async () => {
        const missingHarness = await harness();
        try {
            missingHarness.scenarios.forEach(scenario => { missing(scenario); scenario.body = Buffer.from("bounded CDN 404 body"); });
            const result = await instrumentedApi.runCharacterLeaderSupportedRemotePreflight(missingHarness.options);
            equal(result.report.readiness.remotePreflight, "GO");
            equal(result.report.objects.every(object => object.futurePrecondition === "If-None-Match: *"), true);
            equal(result.report.manifest.futurePrecondition, "If-None-Match: *");
        } finally { await rm(missingHarness.base, { recursive: true, force: true }); }
        const replaceHarness = await harness();
        try {
            differentManifest(replaceHarness.scenarios[4], '"fresh"');
            const result = await instrumentedApi.runCharacterLeaderSupportedRemotePreflight(replaceHarness.options);
            equal(result.report.readiness.remotePreflight, "GO"); equal(result.report.manifest.status, "different");
            equal(result.report.manifest.futurePrecondition, "If-Match: OBSERVED_FRESH_ETAG");
        } finally { await rm(replaceHarness.base, { recursive: true, force: true }); }

        for (const etag of ["*", 'W/"weak"', '""']) {
            const invalid = await harness();
            try {
                differentManifest(invalid.scenarios[4], etag);
                const result = await instrumentedApi.runCharacterLeaderSupportedRemotePreflight(invalid.options);
                equal(result.report.manifest.status, "failed"); equal(result.report.readiness.remotePreflight, "NO-GO");
            } finally { await rm(invalid.base, { recursive: true, force: true }); }
        }
    });

    it("fails closed for immutable conflicts, metadata drift and unsafe mutable replacement", async () => {
        for (const mutate of [
            (h: Harness) => { h.scenarios[0].body = Buffer.from("drift"); },
            (h: Harness) => { h.scenarios[0].headers["cache-control"] = "no-store"; },
            (h: Harness) => { differentManifest(h.scenarios[4]); },
        ]) {
            const h = await harness();
            try { mutate(h); const result = await instrumentedApi.runCharacterLeaderSupportedRemotePreflight(h.options); equal(result.report.readiness.remotePreflight, "NO-GO"); }
            finally { await rm(h.base, { recursive: true, force: true }); }
        }
    });

    it("blocks redirects, encoded/oversized bodies and unexpected status", async () => {
        for (const mutate of [
            (s: RemoteScenario) => { s.status = 302; },
            (s: RemoteScenario) => { s.headers["content-encoding"] = "gzip"; },
            (s: RemoteScenario) => { s.headers["content-length"] = String(CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_RESPONSE_LIMIT_BYTES); },
            (s: RemoteScenario) => { s.status = 500; },
            (s: RemoteScenario) => { s.stall = true; },
        ]) {
            const h = await harness();
            try { mutate(h.scenarios[0]); const result = await instrumentedApi.runCharacterLeaderSupportedRemotePreflight(h.options); equal(result.report.readiness.remotePreflight, "NO-GO"); }
            finally { await rm(h.base, { recursive: true, force: true }); }
        }
    });

    it("treats unknown bucket usage and exact ceiling equality as NO-GO", async () => {
        const unknown = await harness();
        try { unknown.bucketError = new Error("fail"); const result = await instrumentedApi.runCharacterLeaderSupportedRemotePreflight(unknown.options); equal(result.report.bucketUsage.status, "failed"); equal(result.report.readiness.remotePreflight, "NO-GO"); }
        finally { await rm(unknown.base, { recursive: true, force: true }); }
        const equality = await harness();
        try {
            equality.bucket = CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_BUCKET_CEILING_BYTES
                - equality.artifacts.candidateManifestBytes.length - 1;
            const result = await instrumentedApi.runCharacterLeaderSupportedRemotePreflight(equality.options);
            equal(result.report.budget.projectedBucketUpperBoundBytes, CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_BUCKET_CEILING_BYTES);
            equal(result.report.readiness.remotePreflight, "NO-GO");
        } finally { await rm(equality.base, { recursive: true, force: true }); }
    });

    it("rejects source drift and create-only link/hardlink collisions", async () => {
        const drift = await harness();
        try {
            const changed = authorizedFixture({ drift: true });
            drift.sources[1] = changed;
            await rejects(() => instrumentedApi.runCharacterLeaderSupportedRemotePreflight(drift.options), /source drifted/);
        } finally { await rm(drift.base, { recursive: true, force: true }); }

        const hardlinkHarness = await harness();
        try {
            const external = join(hardlinkHarness.base, "external.json"); await writeFile(external, "preserve");
            await link(external, join(hardlinkHarness.output, CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_REPORT_FILE));
            await rejects(() => instrumentedApi.runCharacterLeaderSupportedRemotePreflight(hardlinkHarness.options), /hardlink|link|already exists/);
        } finally { await rm(hardlinkHarness.base, { recursive: true, force: true }); }

        const linkedRootHarness = await harness();
        try {
            const linkedOutput = join(linkedRootHarness.base, "linked-output");
            await symlink(linkedRootHarness.output, linkedOutput, process.platform === "win32" ? "junction" : "dir");
            linkedRootHarness.options.outputRoot = linkedOutput;
            await rejects(() => instrumentedApi.runCharacterLeaderSupportedRemotePreflight(linkedRootHarness.options), /link|junction/);
        } finally { await rm(linkedRootHarness.base, { recursive: true, force: true }); }
    });

    it("exports no mutation or injection surface and contains no mutating request methods", () => {
        deepStrictEqual(Object.keys(productionApi), ["runCharacterLeaderSupportedRemotePreflight"]);
        const source = require("fs").readFileSync(
            require("path").join(repositorySourceRoot(), "database-characters", "leader-supported-remote-preflight.ts"),
            "utf8",
        );
        equal(/method:\s*["'](?:PUT|POST|DELETE|PATCH|HEAD)["']/.test(source), false);
        equal(/S3Client|AwsClient|process\.env|wrangler\s+r2\s+object/i.test(source), false);
        equal(/globalThis|Symbol\.for\(|dokkan\.k59\.(?:k58-validator|https-request|exec-file)/.test(source), false);
    });
});
