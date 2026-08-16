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
const zlib_1 = require("zlib");
const leader_supported_projection_contract_1 = require("./leader-supported-projection-contract");
const leader_supported_publisher_dry_run_contract_1 = require("./leader-supported-publisher-dry-run-contract");
const leader_supported_publisher_dry_run_1 = require("./leader-supported-publisher-dry-run");
const leader_supported_remote_preflight_contract_1 = require("./leader-supported-remote-preflight-contract");
const productionApi = require("./leader-supported-remote-preflight");
const leader_supported_remote_preflight_run_1 = require("./leader-supported-remote-preflight-run");
const SOURCE = Symbol.for("dokkan.k59.k58-validator");
const HTTPS = Symbol.for("dokkan.k59.https-request");
const EXEC = Symbol.for("dokkan.k59.exec-file");
const sha = (bytes) => (0, crypto_1.createHash)("sha256").update(bytes).digest("hex");
const jsonBytes = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
let instrumentedApi;
function repositorySourceRoot() {
    const parent = (0, path_1.resolve)(__dirname, "..");
    return (0, path_1.basename)(parent).toLowerCase() === "lib" ? (0, path_1.resolve)(parent, "..") : parent;
}
async function loadInstrumentedApi() {
    const parent = (0, path_1.resolve)(__dirname, ".."), sourceRoot = repositorySourceRoot();
    const sourcePath = (0, path_1.join)(sourceRoot, "database-characters", "leader-supported-remote-preflight.ts");
    const runtimePath = (0, path_1.join)((0, path_1.basename)(parent).toLowerCase() === "lib" ? parent : sourceRoot, "database-characters", ".leader-supported-remote-preflight.test-runtime.js");
    const source = await (0, promises_1.readFile)(sourcePath, "utf8");
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
    const compiled = (0, typescript_1.transpileModule)(instrumented, {
        compilerOptions: { module: typescript_1.ModuleKind.CommonJS, target: typescript_1.ScriptTarget.ES2022 }, fileName: sourcePath,
    }).outputText;
    const ModuleConstructor = ModuleApi.default ?? ModuleApi;
    const runtimeModule = new ModuleConstructor(runtimePath, module);
    runtimeModule.filename = runtimePath;
    runtimeModule.paths = ModuleConstructor._nodeModulePaths((0, path_1.dirname)(runtimePath));
    runtimeModule._compile(compiled, runtimePath);
    return runtimeModule.exports;
}
function sourceFixture(lineage = {}) {
    const dataset = {
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
    const coverage = {
        schemaVersion: 1, contract: "dokkan-database-character-leader-supported-only-projection-coverage", contractVersion: "1.0.0",
        counts: { totalEffects: 3853, totalReferences: 12310, projectedEffects: 3836, projectedReferences: 12265, excludedEffects: 17, excludedReferences: 45 },
        projected: { effects: 3836, references: 12265, classification: "supported" },
        excluded: Array.from({ length: 17 }, (_, index) => ({
            effectRowId: ["5266", "5271", "5276", "5281", "5986", "5991", "5996", "6001", "8071", "10036", "11861", "11863", "10326202", "10326302", "10326402", "10326502", "10326602"][index],
            affectedReferences: Array.from({ length: index < 11 ? 3 : 2 }, (_, occurrence) => ({ stateId: `${index + 1}`, sourceEffectOccurrenceIndex: occurrence })),
            expression: 196, reason: "runtime_deck_index_unresolved", provenance: {},
            corroborativeRule: { ruleId: "k56-conditional-domain-rule-v1", provenance: "user_confirmed_domain_rule", usedToAuthorizeSupportedProjection: false },
        })),
        corroborativeDomainRules: [], partial: {}, unknown: {}, unjoinable: {}, shadowParity: {}, provenance: {},
    };
    const validation = {
        schemaVersion: 1, contract: "dokkan-database-character-leader-supported-only-projection-validation", contractVersion: "1.0.0",
        valid: true, failures: [], sizes: {}, safety: {}, readiness: {
            offlineSupportedOnlyProjection: "GO", sourceBoundValidation: "NOT_EXECUTED", localShadowAuditDefaultOff: "NOT_EXECUTED",
        },
    };
    const raw = jsonBytes(dataset), gzip = (0, zlib_1.gzipSync)(raw, { level: 9 }), coverageBytes = jsonBytes(coverage), validationBytes = jsonBytes(validation);
    const manifest = {
        schemaVersion: 1, contract: "dokkan-database-character-leader-supported-only-projection-manifest", contractVersion: "1.0.0",
        fileName: `database-characters-k56-leader-supported-projection.${sha(gzip)}.json.gz`, compression: "gzip",
        sha256: sha(gzip), sizeBytes: gzip.length, uncompressedSha256: sha(raw), uncompressedSizeBytes: raw.length,
        counts: coverage.counts, source: lineage, outputNamespaceThreatModel: "caller_controlled_stable_during_operation",
        concurrentSameUserAncestorReplacementProtected: false, coverageFile: leader_supported_projection_contract_1.CHARACTER_LEADER_SUPPORTED_PROJECTION_FILES.coverage,
        coverageSha256: sha(coverageBytes), coverageSizeBytes: coverageBytes.length,
        validationFile: leader_supported_projection_contract_1.CHARACTER_LEADER_SUPPORTED_PROJECTION_FILES.validation,
        validationSha256: sha(validationBytes), validationSizeBytes: validationBytes.length,
    };
    const manifestBytes = jsonBytes(manifest);
    return { dataset, coverage, validation, manifest, raw, gzip, coverageBytes, validationBytes, manifestBytes };
}
function authorizedFixture(lineage = {}) {
    const direct = (0, leader_supported_publisher_dry_run_1.buildCharacterLeaderSupportedPublisherDryRun)(sourceFixture(lineage));
    const plan = JSON.parse(JSON.stringify(direct.plan));
    plan.readiness.dryRun = "GO";
    plan.readiness.sourceBoundValidation = "GO";
    const planBytes = jsonBytes(plan);
    const receipt = { ...direct.receipt, planSha256: sha(planBytes), planSizeBytes: planBytes.length, dryRun: "GO" };
    const receiptBytes = jsonBytes(receipt);
    const marker = { ...direct.marker, planSha256: sha(planBytes), receiptSha256: sha(receiptBytes) };
    const markerBytes = jsonBytes(marker);
    return { ...direct, plan, receipt, marker, planBytes, receiptBytes, markerBytes };
}
class FakeResponse extends events_1.EventEmitter {
    statusCode;
    headers;
    body;
    constructor(statusCode, headers, body) {
        super();
        this.statusCode = statusCode;
        this.headers = headers;
        this.body = body;
    }
    resume() { this.emit("end"); }
    destroy() { this.emit("error", new Error("destroyed")); }
    deliver() { if (this.body.length)
        this.emit("data", this.body); this.emit("end"); }
}
class FakeRequest extends events_1.EventEmitter {
    timeOutImmediately;
    constructor(timeOutImmediately = false) { super(); this.timeOutImmediately = timeOutImmediately; }
    setTimeout(_ms, callback) { if (this.timeOutImmediately)
        queueMicrotask(callback); return this; }
    end() { }
    destroy(error) { this.emit("error", error); }
}
async function harness() {
    const base = await (0, promises_1.mkdtemp)((0, path_1.join)((0, os_1.tmpdir)(), "k59-preflight-"));
    const output = (0, path_1.join)(base, "output"), k56 = (0, path_1.join)(base, "k56"), k58 = (0, path_1.join)(base, "k58");
    const roots = ["sidecar", "production", "fyi", "k43", "k46", "k48"].map(name => (0, path_1.join)(base, name));
    await Promise.all([(0, promises_1.mkdir)(output), (0, promises_1.mkdir)(k56), (0, promises_1.mkdir)(k58), ...roots.map(root => (0, promises_1.mkdir)(root))]);
    const nativeRuntime = (0, path_1.join)(base, "runtime.so"), database = (0, path_1.join)(base, "database.sqlite");
    await Promise.all([(0, promises_1.writeFile)(nativeRuntime, "elf"), (0, promises_1.writeFile)(database, "db")]);
    const artifacts = authorizedFixture();
    const scenarios = artifacts.plan.immutableObjects.map((object, index) => ({
        status: 200, body: [sourceFixture().gzip, sourceFixture().coverageBytes, sourceFixture().validationBytes, sourceFixture().manifestBytes][index],
        headers: { "content-type": object.contentType, "cache-control": object.cacheControl },
    }));
    scenarios.push({ status: 200, body: artifacts.candidateManifestBytes, headers: { "content-type": "application/json", "cache-control": "no-store" } });
    const value = {
        base, output, artifacts, calls: [], execCalls: [], scenarios, sources: [artifacts, artifacts], sequence: [], bucket: "1 MB",
        options: {
            optIn: true, remoteReadOnly: true, sidecarRoot: roots[0], productionRoot: roots[1], fyiRoot: roots[2], k43Root: roots[3],
            k46Root: roots[4], k48Root: roots[5], k56Root: k56, k58Root: k58, outputRoot: output,
            nativeRuntime, database, checkedAt: "2026-08-16T12:00:00.000Z",
        },
    };
    let sourceCall = 0;
    globalThis[SOURCE] = async () => {
        value.sequence.push(sourceCall++ === 0 ? "source-before" : "source-after");
        return { artifacts: value.sources.shift(), sourceBoundValidation: "GO", k55ValidationProcessPeakRssBytes: 1 };
    };
    globalThis[HTTPS] = (url, options, callback) => {
        const key = decodeURI(url.pathname.slice(1));
        value.sequence.push(`get:${key}`);
        value.calls.push({ url: url.toString(), options });
        const scenario = value.scenarios.shift();
        const request = new FakeRequest(scenario.stall === true);
        queueMicrotask(() => { const response = new FakeResponse(scenario.status, scenario.headers, scenario.body); callback(response); if (!scenario.stall)
            response.deliver(); });
        return request;
    };
    globalThis[EXEC] = (file, args, options, callback) => {
        value.sequence.push("bucket");
        value.execCalls.push({ file, args, options });
        queueMicrotask(() => callback(value.bucketError ?? null, JSON.stringify({ bucket_size: value.bucket }), ""));
    };
    return value;
}
function missing(s) { s.status = 404; s.body = Buffer.alloc(0); s.headers = {}; }
function differentManifest(s, etag) {
    s.body = Buffer.from("{}\n");
    s.headers = { "content-type": "application/json", "cache-control": "no-store", ...(etag ? { etag } : {}) };
}
describe("K59 supported leader remote read-only preflight", function () {
    this.timeout(30000);
    const cli = [
        "--opt-in-k59", "--remote-read-only", "--sidecar-root", "s", "--production-root", "p", "--fyi-root", "f",
        "--k43-root", "43", "--k46-root", "46", "--k48-root", "48", "--k56-root", "56", "--k58-root", "58",
        "--output-root", "o", "--native-runtime", "elf", "--database", "db", "--checked-at", "2026-08-16T12:00:00.000Z",
    ];
    before(async () => { instrumentedApi = await loadInstrumentedApi(); });
    afterEach(() => { delete globalThis[SOURCE]; delete globalThis[HTTPS]; delete globalThis[EXEC]; });
    it("parses exact opt-ins and all explicit values with no defaults", () => {
        (0, assert_1.equal)((0, leader_supported_remote_preflight_run_1.parseCharacterLeaderSupportedRemotePreflightCli)(cli).k58Root, "58");
        (0, assert_1.throws)(() => (0, leader_supported_remote_preflight_run_1.parseCharacterLeaderSupportedRemotePreflightCli)(cli.slice(1)), /exactly one/);
        (0, assert_1.throws)(() => (0, leader_supported_remote_preflight_run_1.parseCharacterLeaderSupportedRemotePreflightCli)([...cli, "loose"]), /unsupported/);
        (0, assert_1.throws)(() => (0, leader_supported_remote_preflight_run_1.parseCharacterLeaderSupportedRemotePreflightCli)([...cli, "--database", "again"]), /duplicate/);
    });
    it("performs exactly five ordered public GETs and one fixed read-only Wrangler call", async () => {
        const h = await harness();
        try {
            const result = await instrumentedApi.runCharacterLeaderSupportedRemotePreflight(h.options);
            (0, assert_1.equal)(result.report.readiness.remotePreflight, "GO");
            (0, assert_1.equal)(h.calls.length, 5);
            (0, assert_1.equal)(h.execCalls.length, 1);
            (0, assert_1.deepStrictEqual)(h.calls.map(call => decodeURI(new URL(call.url).pathname.slice(1))), [
                ...h.artifacts.plan.immutableObjects.map(object => object.objectKey), leader_supported_publisher_dry_run_contract_1.CHARACTER_LEADER_SUPPORTED_PUBLISHER_MANIFEST_KEY,
            ]);
            (0, assert_1.equal)(h.calls.every(call => call.options.method === "GET" && call.options.headers["Accept-Encoding"] === "identity"), true);
            (0, assert_1.deepStrictEqual)(h.sequence, [
                "source-before", ...h.artifacts.plan.immutableObjects.map(object => `get:${object.objectKey}`),
                `get:${leader_supported_publisher_dry_run_contract_1.CHARACTER_LEADER_SUPPORTED_PUBLISHER_MANIFEST_KEY}`, "bucket", "source-after",
            ]);
            (0, assert_1.equal)(result.report.checks.exactFiveOrderedGets, true);
            (0, assert_1.deepStrictEqual)(h.execCalls[0].args.slice(-5), ["r2", "bucket", "info", "dokkanpanion-data", "--json"]);
            (0, assert_1.equal)(h.execCalls[0].options.shell, false);
            (0, assert_1.equal)(result.report.checks.noRemoteMutation, true);
            (0, assert_1.equal)(result.report.readiness.processTreeRssUnder1GiB, "NO-GO");
        }
        finally {
            await (0, promises_1.rm)(h.base, { recursive: true, force: true });
        }
    });
    it("models all missing and a different mutable manifest with conditional writes only", async () => {
        const missingHarness = await harness();
        try {
            missingHarness.scenarios.forEach(scenario => { missing(scenario); scenario.body = Buffer.from("bounded CDN 404 body"); });
            const result = await instrumentedApi.runCharacterLeaderSupportedRemotePreflight(missingHarness.options);
            (0, assert_1.equal)(result.report.readiness.remotePreflight, "GO");
            (0, assert_1.equal)(result.report.objects.every(object => object.futurePrecondition === "If-None-Match: *"), true);
            (0, assert_1.equal)(result.report.manifest.futurePrecondition, "If-None-Match: *");
        }
        finally {
            await (0, promises_1.rm)(missingHarness.base, { recursive: true, force: true });
        }
        const replaceHarness = await harness();
        try {
            differentManifest(replaceHarness.scenarios[4], '"fresh"');
            const result = await instrumentedApi.runCharacterLeaderSupportedRemotePreflight(replaceHarness.options);
            (0, assert_1.equal)(result.report.readiness.remotePreflight, "GO");
            (0, assert_1.equal)(result.report.manifest.status, "different");
            (0, assert_1.equal)(result.report.manifest.futurePrecondition, "If-Match: OBSERVED_FRESH_ETAG");
        }
        finally {
            await (0, promises_1.rm)(replaceHarness.base, { recursive: true, force: true });
        }
        for (const etag of ["*", 'W/"weak"', '""']) {
            const invalid = await harness();
            try {
                differentManifest(invalid.scenarios[4], etag);
                const result = await instrumentedApi.runCharacterLeaderSupportedRemotePreflight(invalid.options);
                (0, assert_1.equal)(result.report.manifest.status, "failed");
                (0, assert_1.equal)(result.report.readiness.remotePreflight, "NO-GO");
            }
            finally {
                await (0, promises_1.rm)(invalid.base, { recursive: true, force: true });
            }
        }
    });
    it("fails closed for immutable conflicts, metadata drift and unsafe mutable replacement", async () => {
        for (const mutate of [
            (h) => { h.scenarios[0].body = Buffer.from("drift"); },
            (h) => { h.scenarios[0].headers["cache-control"] = "no-store"; },
            (h) => { differentManifest(h.scenarios[4]); },
        ]) {
            const h = await harness();
            try {
                mutate(h);
                const result = await instrumentedApi.runCharacterLeaderSupportedRemotePreflight(h.options);
                (0, assert_1.equal)(result.report.readiness.remotePreflight, "NO-GO");
            }
            finally {
                await (0, promises_1.rm)(h.base, { recursive: true, force: true });
            }
        }
    });
    it("blocks redirects, encoded/oversized bodies and unexpected status", async () => {
        for (const mutate of [
            (s) => { s.status = 302; },
            (s) => { s.headers["content-encoding"] = "gzip"; },
            (s) => { s.headers["content-length"] = String(leader_supported_remote_preflight_contract_1.CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_RESPONSE_LIMIT_BYTES); },
            (s) => { s.status = 500; },
            (s) => { s.stall = true; },
        ]) {
            const h = await harness();
            try {
                mutate(h.scenarios[0]);
                const result = await instrumentedApi.runCharacterLeaderSupportedRemotePreflight(h.options);
                (0, assert_1.equal)(result.report.readiness.remotePreflight, "NO-GO");
            }
            finally {
                await (0, promises_1.rm)(h.base, { recursive: true, force: true });
            }
        }
    });
    it("treats unknown bucket usage and exact ceiling equality as NO-GO", async () => {
        const unknown = await harness();
        try {
            unknown.bucketError = new Error("fail");
            const result = await instrumentedApi.runCharacterLeaderSupportedRemotePreflight(unknown.options);
            (0, assert_1.equal)(result.report.bucketUsage.status, "failed");
            (0, assert_1.equal)(result.report.readiness.remotePreflight, "NO-GO");
        }
        finally {
            await (0, promises_1.rm)(unknown.base, { recursive: true, force: true });
        }
        const equality = await harness();
        try {
            equality.bucket = leader_supported_remote_preflight_contract_1.CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_BUCKET_CEILING_BYTES
                - equality.artifacts.candidateManifestBytes.length - 1;
            const result = await instrumentedApi.runCharacterLeaderSupportedRemotePreflight(equality.options);
            (0, assert_1.equal)(result.report.budget.projectedBucketUpperBoundBytes, leader_supported_remote_preflight_contract_1.CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_BUCKET_CEILING_BYTES);
            (0, assert_1.equal)(result.report.readiness.remotePreflight, "NO-GO");
        }
        finally {
            await (0, promises_1.rm)(equality.base, { recursive: true, force: true });
        }
    });
    it("rejects source drift and create-only link/hardlink collisions", async () => {
        const drift = await harness();
        try {
            const changed = authorizedFixture({ drift: true });
            drift.sources[1] = changed;
            await (0, assert_1.rejects)(() => instrumentedApi.runCharacterLeaderSupportedRemotePreflight(drift.options), /source drifted/);
        }
        finally {
            await (0, promises_1.rm)(drift.base, { recursive: true, force: true });
        }
        const hardlinkHarness = await harness();
        try {
            const external = (0, path_1.join)(hardlinkHarness.base, "external.json");
            await (0, promises_1.writeFile)(external, "preserve");
            await (0, promises_1.link)(external, (0, path_1.join)(hardlinkHarness.output, leader_supported_remote_preflight_contract_1.CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_REPORT_FILE));
            await (0, assert_1.rejects)(() => instrumentedApi.runCharacterLeaderSupportedRemotePreflight(hardlinkHarness.options), /hardlink|link|already exists/);
        }
        finally {
            await (0, promises_1.rm)(hardlinkHarness.base, { recursive: true, force: true });
        }
        const linkedRootHarness = await harness();
        try {
            const linkedOutput = (0, path_1.join)(linkedRootHarness.base, "linked-output");
            await (0, promises_1.symlink)(linkedRootHarness.output, linkedOutput, process.platform === "win32" ? "junction" : "dir");
            linkedRootHarness.options.outputRoot = linkedOutput;
            await (0, assert_1.rejects)(() => instrumentedApi.runCharacterLeaderSupportedRemotePreflight(linkedRootHarness.options), /link|junction/);
        }
        finally {
            await (0, promises_1.rm)(linkedRootHarness.base, { recursive: true, force: true });
        }
    });
    it("exports no mutation or injection surface and contains no mutating request methods", () => {
        (0, assert_1.deepStrictEqual)(Object.keys(productionApi), ["runCharacterLeaderSupportedRemotePreflight"]);
        const source = require("fs").readFileSync(require("path").join(repositorySourceRoot(), "database-characters", "leader-supported-remote-preflight.ts"), "utf8");
        (0, assert_1.equal)(/method:\s*["'](?:PUT|POST|DELETE|PATCH|HEAD)["']/.test(source), false);
        (0, assert_1.equal)(/S3Client|AwsClient|process\.env|wrangler\s+r2\s+object/i.test(source), false);
        (0, assert_1.equal)(/globalThis|Symbol\.for\(|dokkan\.k59\.(?:k58-validator|https-request|exec-file)/.test(source), false);
    });
});
//# sourceMappingURL=leader-supported-remote-preflight.spec.js.map