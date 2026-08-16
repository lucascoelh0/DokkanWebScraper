import { deepStrictEqual, equal, rejects, throws } from "assert";
import { createHash } from "crypto";
import { link, mkdir, mkdtemp, readFile, readdir, rm, unlink, writeFile } from "fs/promises";
import * as ModuleApi from "module";
import { tmpdir } from "os";
import { basename, dirname, join, resolve } from "path";
import { ModuleKind, ScriptTarget, transpileModule } from "typescript";
import { gzipSync } from "zlib";
import { CHARACTER_LEADER_SUPPORTED_PROJECTION_FILES, CharacterLeaderSupportedProjectionArtifactSet } from "./leader-supported-projection-contract";
import { buildCharacterLeaderSupportedPublisherDryRun } from "./leader-supported-publisher-dry-run";
import type { CharacterLeaderSupportedPublisherDryRunArtifactSet } from "./leader-supported-publisher-dry-run-contract";
import { CHARACTER_LEADER_SUPPORTED_PUBLISHER_MANIFEST_KEY } from "./leader-supported-publisher-dry-run-contract";
import { CHARACTER_LEADER_SUPPORTED_PUBLISHER_REPORT_FILE } from "./leader-supported-publisher-contract";
import * as productionApi from "./leader-supported-publisher";
import { parseCharacterLeaderSupportedPublisherCli } from "./leader-supported-publisher-run";

const K59 = Symbol.for("dokkan.k60.k59");
const K58 = Symbol.for("dokkan.k60.k58");
const K56 = Symbol.for("dokkan.k60.k56");
const ADAPTER = Symbol.for("dokkan.k60.adapter");
const RSS_STOP = Symbol.for("dokkan.k60.rss-stop");
const sha = (value: Buffer | string): string => createHash("sha256").update(value).digest("hex");
const jsonBytes = (value: unknown): Buffer => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
type Api = typeof productionApi;
let api: Api;

function sourceRoot(): string { const parent = resolve(__dirname, ".."); return basename(parent).toLowerCase() === "lib" ? resolve(parent, "..") : parent; }
async function instrumentedApi(): Promise<Api> {
    const parent = resolve(__dirname, ".."), root = sourceRoot(), sourcePath = join(root, "database-characters", "leader-supported-publisher.ts");
    const runtimePath = join(basename(parent).toLowerCase() === "lib" ? parent : root, "database-characters", ".leader-supported-publisher.test-runtime.js");
    const source = await readFile(sourcePath, "utf8");
    const instrumented = source
        .replace(/runCharacterLeaderSupportedRemotePreflight\(\{/g, "__testK59({")
        .replace(/validateCharacterLeaderSupportedPublisherDryRunArtifact\(\{/g, "__testK58({")
        .replace(/validateCharacterLeaderSupportedProjectionArtifact\(\{/g, "__testK56({")
        .replace("publication = await publish(createS3Adapter(), snapshot, options);", "publication = await publish(__testAdapter(), snapshot, options);")
        .replace("const parentPeak = rss.stop(), max =", "const parentPeak = __testRssStop(rss), max =")
        .replace("export interface CharacterLeaderSupportedPublisherOptions", `
const __testHook = (name: string) => {
    const hook = (globalThis as any)[Symbol.for(name)];
    if (typeof hook !== "function") throw new Error("K60 test hook missing");
    return hook;
};
const __testK59 = (...args: any[]) => __testHook("dokkan.k60.k59")(...args);
const __testK58 = (...args: any[]) => __testHook("dokkan.k60.k58")(...args);
const __testK56 = (...args: any[]) => __testHook("dokkan.k60.k56")(...args);
const __testAdapter = () => __testHook("dokkan.k60.adapter")();
const __testRssStop = (rss: any) => {
    const hook = (globalThis as any)[Symbol.for("dokkan.k60.rss-stop")];
    return typeof hook === "function" ? hook(rss) : rss.stop();
};

export interface CharacterLeaderSupportedPublisherOptions`);
    if (instrumented === source || !instrumented.includes("__testAdapter()")) throw new Error("K60 instrumentation failed");
    const compiled = transpileModule(instrumented, { compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2022 }, fileName: sourcePath }).outputText;
    const ModuleConstructor = (ModuleApi as any).default ?? ModuleApi, runtime = new ModuleConstructor(runtimePath, module);
    runtime.filename = runtimePath; runtime.paths = ModuleConstructor._nodeModulePaths(dirname(runtimePath)); runtime._compile(compiled, runtimePath);
    return runtime.exports as Api;
}

function k56Fixture(lineage: any = {}): CharacterLeaderSupportedProjectionArtifactSet {
    const dataset: any = {
        schemaVersion: 1, contract: "dokkan-database-character-leader-supported-only-projection", contractVersion: "1.0.0",
        mode: "explicit_opt_in_offline_local_supported_only_default_off", source: lineage,
        policy: { supportedOnly: true, structuralIdsOnly: true, sourceOrderAndMultiplicityPreserved: true,
            outputNamespaceThreatModel: "caller_controlled_stable_during_operation", concurrentSameUserAncestorReplacementProtected: false,
            conditionalEffectsIncluded: false, unknownValuesMaterialized: false, execTimingTypeIncluded: false, causalityIncluded: false,
            ignoredPosition2Included: false, textOrDescriptionIncluded: false, aggregateOrFinalValueIncluded: false,
            primarySecondaryOrHybridInvented: false, characterArrayIncluded: false, patchOrApplyImplemented: false,
            authoritySelected: false, productionModified: false, publisherImplemented: false, networkEnabled: false, r2Enabled: false, androidImplemented: false }, records: [],
    };
    const ids = ["5266", "5271", "5276", "5281", "5986", "5991", "5996", "6001", "8071", "10036", "11861", "11863", "10326202", "10326302", "10326402", "10326502", "10326602"];
    const coverage: any = { schemaVersion: 1, contract: "dokkan-database-character-leader-supported-only-projection-coverage", contractVersion: "1.0.0",
        counts: { totalEffects: 3853, totalReferences: 12310, projectedEffects: 3836, projectedReferences: 12265, excludedEffects: 17, excludedReferences: 45 },
        projected: { effects: 3836, references: 12265, classification: "supported" },
        excluded: ids.map((effectRowId, index) => ({ effectRowId, affectedReferences: Array.from({ length: index < 11 ? 3 : 2 }, (_, occurrence) => ({ stateId: `${index}`, sourceEffectOccurrenceIndex: occurrence })), expression: 196, reason: "runtime_deck_index_unresolved", provenance: {}, corroborativeRule: { ruleId: "k56-conditional-domain-rule-v1", provenance: "user_confirmed_domain_rule", usedToAuthorizeSupportedProjection: false } })),
        corroborativeDomainRules: [], partial: {}, unknown: {}, unjoinable: {}, shadowParity: {}, provenance: {} };
    const validation: any = { schemaVersion: 1, contract: "dokkan-database-character-leader-supported-only-projection-validation", contractVersion: "1.0.0",
        valid: true, failures: [], sizes: {}, safety: {}, readiness: { offlineSupportedOnlyProjection: "GO", sourceBoundValidation: "NOT_EXECUTED", localShadowAuditDefaultOff: "NOT_EXECUTED" } };
    const raw = jsonBytes(dataset), gzip = gzipSync(raw, { level: 9 }), coverageBytes = jsonBytes(coverage), validationBytes = jsonBytes(validation);
    const manifest: any = { schemaVersion: 1, contract: "dokkan-database-character-leader-supported-only-projection-manifest", contractVersion: "1.0.0",
        fileName: `database-characters-k56-leader-supported-projection.${sha(gzip)}.json.gz`, compression: "gzip", sha256: sha(gzip), sizeBytes: gzip.length,
        uncompressedSha256: sha(raw), uncompressedSizeBytes: raw.length, counts: coverage.counts, source: lineage,
        outputNamespaceThreatModel: "caller_controlled_stable_during_operation", concurrentSameUserAncestorReplacementProtected: false,
        coverageFile: CHARACTER_LEADER_SUPPORTED_PROJECTION_FILES.coverage, coverageSha256: sha(coverageBytes), coverageSizeBytes: coverageBytes.length,
        validationFile: CHARACTER_LEADER_SUPPORTED_PROJECTION_FILES.validation, validationSha256: sha(validationBytes), validationSizeBytes: validationBytes.length };
    const manifestBytes = jsonBytes(manifest); return { dataset, coverage, validation, manifest, raw, gzip, coverageBytes, validationBytes, manifestBytes };
}
function k58Fixture(k56: CharacterLeaderSupportedProjectionArtifactSet): CharacterLeaderSupportedPublisherDryRunArtifactSet {
    const direct = buildCharacterLeaderSupportedPublisherDryRun(k56), plan: any = JSON.parse(JSON.stringify(direct.plan));
    plan.readiness.dryRun = "GO"; plan.readiness.sourceBoundValidation = "GO"; const planBytes = jsonBytes(plan);
    const receipt: any = { ...direct.receipt, planSha256: sha(planBytes), planSizeBytes: planBytes.length, dryRun: "GO" }, receiptBytes = jsonBytes(receipt);
    const marker: any = { ...direct.marker, planSha256: sha(planBytes), receiptSha256: sha(receiptBytes) }, markerBytes = jsonBytes(marker);
    return { ...direct, plan, planBytes, receipt, receiptBytes, marker, markerBytes };
}

type Status = "missing" | "matching" | "different";
interface State { k56: CharacterLeaderSupportedProjectionArtifactSet; k58: CharacterLeaderSupportedPublisherDryRunArtifactSet; k59: any; adapterFactoryCalls: number; sourceCalls: number; sequence: string[]; }
function k59Fixture(k58: CharacterLeaderSupportedPublisherDryRunArtifactSet, checkedAt: string, statuses: Status[] = ["missing", "matching", "missing", "matching", "different"]): any {
    const objects = k58.plan.immutableObjects.map((object, index) => ({ order: object.order, kind: object.kind, objectKey: object.objectKey,
        status: statuses[index], expectedSha256: object.sha256, expectedSizeBytes: object.sizeBytes, expectedContentType: object.contentType,
        expectedCacheControl: object.cacheControl, futureAction: statuses[index] === "missing" ? "create_if_absent" : "verified_reuse",
        futurePrecondition: statuses[index] === "missing" ? "If-None-Match: *" : "NO_WRITE_VERIFIED_REUSE" }));
    const manifestStatus = statuses[4];
    const manifest = { objectKey: CHARACTER_LEADER_SUPPORTED_PUBLISHER_MANIFEST_KEY, status: manifestStatus,
        expectedSha256: sha(k58.candidateManifestBytes), expectedSizeBytes: k58.candidateManifestBytes.length,
        futureAction: manifestStatus === "missing" ? "create_if_absent" : manifestStatus === "matching" ? "no_op_already_current" : "replace_if_match",
        futurePrecondition: manifestStatus === "missing" ? "If-None-Match: *" : manifestStatus === "matching" ? "NO_WRITE_ALREADY_CURRENT" : "If-Match: OBSERVED_FRESH_ETAG",
        unconditionalWrite: "FORBIDDEN", delete: "FORBIDDEN" };
    return { reportSha256: "a".repeat(64), maximumIndividualProcessPeakRssBytes: 1, report: { checkedAt, objects, manifest,
        source: {
            candidateManifestSha256: sha(k58.candidateManifestBytes), candidateManifestSizeBytes: k58.candidateManifestBytes.length,
            planSha256: sha(k58.planBytes), planSizeBytes: k58.planBytes.length,
            receiptSha256: sha(k58.receiptBytes), receiptSizeBytes: k58.receiptBytes.length,
            markerSha256: sha(k58.markerBytes), markerSizeBytes: k58.markerBytes.length,
            fullArtifactFingerprintSha256: k58.plan.source.fullArtifactFingerprintSha256,
            lineageFingerprintSha256: k58.plan.source.lineageFingerprintSha256,
        }, checks: { exactFiveOrderedGets: true }, readiness: { remotePreflight: "GO" } } };
}

async function setup(statuses?: Status[]): Promise<{ base: string; options: any; state: State }> {
    const base = await mkdtemp(join(tmpdir(), "k60-publisher-")), outputRoot = join(base, "k60"), k59OutputRoot = join(base, "k59");
    const roots = ["sidecar", "production", "fyi", "k43", "k46", "k48", "k56", "k58"].map(name => join(base, name));
    await Promise.all([mkdir(outputRoot), mkdir(k59OutputRoot), ...roots.map(root => mkdir(root))]);
    const nativeRuntime = join(base, "runtime.so"), database = join(base, "database.sqlite");
    await Promise.all([writeFile(nativeRuntime, "elf"), writeFile(database, "db")]);
    const k56 = k56Fixture(), k58 = k58Fixture(k56);
    const checkedAt = "2026-08-16T12:00:00.000Z";
    const state: State = { k56, k58, k59: k59Fixture(k58, checkedAt, statuses), adapterFactoryCalls: 0, sourceCalls: 0, sequence: [] };
    (globalThis as any)[K59] = async () => { state.sequence.push("k59"); return state.k59; };
    (globalThis as any)[K58] = async () => { state.sequence.push("k58"); state.sourceCalls++; return { artifacts: state.k58, sourceBoundValidation: "GO", k55ValidationProcessPeakRssBytes: 1 }; };
    (globalThis as any)[K56] = async () => { state.sequence.push("k56"); return { artifacts: state.k56, sourceBoundValidation: "GO", k55ValidationProcessPeakRssBytes: 1 }; };
    return { base, state, options: { optIn: true, mode: "dry-run", sidecarRoot: roots[0], productionRoot: roots[1], fyiRoot: roots[2], k43Root: roots[3], k46Root: roots[4], k48Root: roots[5], k56Root: roots[6], k58Root: roots[7], k59OutputRoot, outputRoot, nativeRuntime, database, checkedAt } };
}

interface Stored { status: "present"; bytes: Buffer; etag: string; contentType: string; cacheControl: string }
function memoryAdapter(state: State, options: { raceKey?: string; mismatchRace?: boolean; manifestEtag?: string } = {}) {
    const objects = new Map<string, Stored>(), calls: any[] = [];
    for (let index = 0; index < 4; index++) if (state.k59.report.objects[index].status === "matching") {
        const plan = state.k58.plan.immutableObjects[index], bytes = [state.k56.gzip, state.k56.coverageBytes, state.k56.validationBytes, state.k56.manifestBytes][index];
        objects.set(plan.objectKey, { status: "present", bytes, etag: `"i${index}"`, contentType: plan.contentType, cacheControl: plan.cacheControl });
    }
    if (state.k59.report.manifest.status !== "missing") objects.set(CHARACTER_LEADER_SUPPORTED_PUBLISHER_MANIFEST_KEY,
        { status: "present", bytes: state.k59.report.manifest.status === "matching" ? state.k58.candidateManifestBytes : Buffer.from("{}\n"), etag: options.manifestEtag ?? '"old"', contentType: "application/json", cacheControl: "no-store" });
    const adapter = {
        read: async (key: string, aggregate: any) => { calls.push({ op: "read", key }); const value = objects.get(key); if (!value) return { status: "missing" }; aggregate.consume(value.bytes.length); return { ...value, bytes: Buffer.from(value.bytes) }; },
        put: async (key: string, bytes: Buffer, contentType: string, cacheControl: string, condition: any) => {
            calls.push({ op: "put", key, contentType, cacheControl, condition });
            if (key === options.raceKey) {
                objects.set(key, { status: "present", bytes: options.mismatchRace ? Buffer.from("wrong") : Buffer.from(bytes), etag: '"race"', contentType, cacheControl });
                return "precondition_failed";
            }
            objects.set(key, { status: "present", bytes: Buffer.from(bytes), etag: '"new"', contentType, cacheControl }); return "written";
        },
    };
    (globalThis as any)[ADAPTER] = () => { state.adapterFactoryCalls++; return adapter; };
    return { objects, calls };
}

describe("K60 conditional leader publisher", function () {
    this.timeout(30_000);
    before(async () => { api = await instrumentedApi(); });
    afterEach(() => { for (const key of [K59, K58, K56, ADAPTER, RSS_STOP]) delete (globalThis as any)[key]; });
    const commonCli = ["--opt-in-k60", "--sidecar-root", "s", "--production-root", "p", "--fyi-root", "f", "--k43-root", "43", "--k46-root", "46", "--k48-root", "48", "--k56-root", "56", "--k58-root", "58", "--k59-output-root", "59", "--output-root", "60", "--native-runtime", "elf", "--database", "db", "--checked-at", "2026-08-16T12:00:00.000Z"];

    it("parses mutually exclusive exact modes and confirmation", () => {
        equal(parseCharacterLeaderSupportedPublisherCli(["--dry-run", ...commonCli]).mode, "dry-run");
        equal(parseCharacterLeaderSupportedPublisherCli(["--publish", "--confirm-publication-id", "a".repeat(64), ...commonCli]).mode, "publish");
        throws(() => parseCharacterLeaderSupportedPublisherCli(["--dry-run", "--publish", ...commonCli]), /exactly one/);
        throws(() => parseCharacterLeaderSupportedPublisherCli(["--publish", ...commonCli]), /requires exactly one/);
        throws(() => parseCharacterLeaderSupportedPublisherCli(["--dry-run", "--confirm-publication-id", "a".repeat(64), ...commonCli]), /forbids/);
    });

    it("runs fresh K59 then K58 and dry-run never constructs adapter or reads credentials", async () => {
        const h = await setup();
        try {
            const result = await api.runCharacterLeaderSupportedPublisher(h.options);
            equal(result.report.readiness.dryRun, "GO"); equal(result.report.readiness.publication, "NOT_EXECUTED");
            equal(h.state.adapterFactoryCalls, 0);
            equal(result.report.checks.clientConstruction, "NOT_EXECUTED"); equal(result.report.checks.remoteWriteCount, 0);
            equal(result.report.readiness.perProcessRssUnder1GiB, "NOT_EXECUTED");
            deepStrictEqual(h.state.sequence, ["k59", "k58", "k56"]);
            deepStrictEqual(result.report.k59.actions.map(action => action.precondition), ["If-None-Match: *", "NO_WRITE_VERIFIED_REUSE", "If-None-Match: *", "NO_WRITE_VERIFIED_REUSE", "If-Match: OBSERVED_FRESH_ETAG"]);
        } finally { await rm(h.base, { recursive: true, force: true }); }
    });

    it("keeps publicationId independent of checkedAt and K59 observations", async () => {
        const first = await setup();
        try {
            const one = await api.runCharacterLeaderSupportedPublisher(first.options);
            delete (globalThis as any)[K59]; delete (globalThis as any)[K58]; delete (globalThis as any)[K56];
            const second = await setup(["matching", "missing", "matching", "missing", "missing"]);
            second.options.checkedAt = "2026-08-16T13:00:00.000Z"; second.state.k59.report.checkedAt = second.options.checkedAt;
            const two = await api.runCharacterLeaderSupportedPublisher(second.options);
            equal(one.publicationId, two.publicationId); equal(one.report.k59.reportSha256, two.report.k59.reportSha256);
            await rm(second.base, { recursive: true, force: true });
        } finally { await rm(first.base, { recursive: true, force: true }); }
    });

    it("checks confirmation before adapter construction", async () => {
        const h = await setup(); memoryAdapter(h.state); h.options.mode = "publish"; h.options.confirmPublicationId = "f".repeat(64);
        try {
            await rejects(() => api.runCharacterLeaderSupportedPublisher(h.options), /confirmation mismatch/);
            equal(h.state.adapterFactoryCalls, 0); deepStrictEqual(await readdir(h.options.outputRoot), []);
        }
        finally { await rm(h.base, { recursive: true, force: true }); }
    });

    it("publishes immutables in order with conditionals/metadata and manifest last", async () => {
        const h = await setup(["missing", "missing", "missing", "missing", "different"]), memory = memoryAdapter(h.state);
        h.options.mode = "publish";
        try {
            const dryPlan = await api.runCharacterLeaderSupportedPublisher({ ...h.options, mode: "dry-run", outputRoot: await (async () => { const p = join(h.base, "dry"); await mkdir(p); return p; })() });
            h.options.confirmPublicationId = dryPlan.publicationId;
            const result = await api.runCharacterLeaderSupportedPublisher(h.options);
            const puts = memory.calls.filter(call => call.op === "put");
            deepStrictEqual(puts.slice(0, 4).map(call => call.condition), Array(4).fill(null).map(() => ({ IfNoneMatch: "*" })));
            equal(puts.every(call => call.contentType === "application/gzip" || call.contentType === "application/json"), true);
            equal(puts[4].key, CHARACTER_LEADER_SUPPORTED_PUBLISHER_MANIFEST_KEY); deepStrictEqual(puts[4].condition, { IfMatch: '"old"' });
            const manifestPutIndex = memory.calls.findIndex(call => call.op === "put" && call.key === CHARACTER_LEADER_SUPPORTED_PUBLISHER_MANIFEST_KEY);
            deepStrictEqual(memory.calls.slice(manifestPutIndex - 5, manifestPutIndex).map(call => [call.op, call.key]), [
                ...h.state.k58.plan.immutableObjects.map(object => ["read", object.objectKey]),
                ["read", CHARACTER_LEADER_SUPPORTED_PUBLISHER_MANIFEST_KEY],
            ]);
            equal(result.publication!.manifestLast, true); equal(result.publication!.finalManifestVerified, true);
            equal(sha(await readFile(result.publicationReceiptPath!)), result.publicationReceiptSha256);
            equal(result.publicationReceipt!.summary.finalManifestVerified, true);
            deepStrictEqual(result.publicationReceipt!.forbiddenOperations, { deleteCount: 0, unconditionalWriteCount: 0, copyCount: 0, multipartCount: 0 });
            equal(result.publicationReceipt!.summary.manifestResult, "REPLACED");
            equal(result.publicationReceipt!.summary.unconditionalWriteCount, 0);
        } finally { await rm(h.base, { recursive: true, force: true }); }
    });

    it("accepts 409/412 only after exact reread and rejects mismatch", async () => {
        for (const mismatchRace of [false, true]) {
            const h = await setup(["missing", "matching", "matching", "matching", "matching"]);
            const raceKey = h.state.k58.plan.immutableObjects[0].objectKey; memoryAdapter(h.state, { raceKey, mismatchRace });
            h.options.mode = "publish";
            const body: any = h.state.k58.plan; const publicationBody = { ...body };
            try {
                const dryRoot = join(h.base, "dry"); await mkdir(dryRoot); const dry = await api.runCharacterLeaderSupportedPublisher({ ...h.options, mode: "dry-run", outputRoot: dryRoot });
                h.options.confirmPublicationId = dry.publicationId;
                if (mismatchRace) await rejects(() => api.runCharacterLeaderSupportedPublisher(h.options), /verification failed/);
                else equal((await api.runCharacterLeaderSupportedPublisher(h.options)).publication!.immutableReused, 4);
            } finally { void publicationBody; await rm(h.base, { recursive: true, force: true }); }
        }
    });

    it("accepts a manifest CAS race only when the immediate final reread is exact", async () => {
        for (const mismatchRace of [false, true]) {
            const h = await setup(["matching", "matching", "matching", "matching", "different"]);
            memoryAdapter(h.state, { raceKey: CHARACTER_LEADER_SUPPORTED_PUBLISHER_MANIFEST_KEY, mismatchRace });
            const dryRoot = join(h.base, "dry"); await mkdir(dryRoot);
            try {
                const dry = await api.runCharacterLeaderSupportedPublisher({ ...h.options, outputRoot: dryRoot });
                h.options.mode = "publish"; h.options.confirmPublicationId = dry.publicationId;
                if (mismatchRace) await rejects(() => api.runCharacterLeaderSupportedPublisher(h.options), /final manifest verification failed/);
                else equal((await api.runCharacterLeaderSupportedPublisher(h.options)).publication!.manifestResult, "CONCURRENT_IDEMPOTENT_COMPLETION");
            } finally { await rm(h.base, { recursive: true, force: true }); }
        }
    });

    it("rejects empty, wildcard, and weak manifest ETags before CAS", async () => {
        for (const etag of ['""', "*", 'W/"weak"']) {
            const h = await setup(["matching", "matching", "matching", "matching", "different"]);
            memoryAdapter(h.state, { manifestEtag: etag }); const dryRoot = join(h.base, "dry"); await mkdir(dryRoot);
            try {
                const dry = await api.runCharacterLeaderSupportedPublisher({ ...h.options, outputRoot: dryRoot });
                h.options.mode = "publish"; h.options.confirmPublicationId = dry.publicationId;
                await rejects(() => api.runCharacterLeaderSupportedPublisher(h.options), /fresh strong ETag/);
            } finally { await rm(h.base, { recursive: true, force: true }); }
        }
    });

    it("rejects K59 receipt, marker, full-fingerprint, and lineage drift", async () => {
        for (const field of ["receiptSha256", "markerSha256", "fullArtifactFingerprintSha256", "lineageFingerprintSha256"] as const) {
            const h = await setup(); h.state.k59.report.source[field] = "f".repeat(64);
            try { await rejects(() => api.runCharacterLeaderSupportedPublisher(h.options), /K59\/K58 source-bound identity/); }
            finally { await rm(h.base, { recursive: true, force: true }); }
        }
    });

    it("stops source drift before mutable manifest and enforces final rereads", async () => {
        const h = await setup(["matching", "matching", "matching", "matching", "different"]), memory = memoryAdapter(h.state);
        h.options.mode = "publish"; const dryRoot = join(h.base, "dry"); await mkdir(dryRoot);
        try {
            const dry = await api.runCharacterLeaderSupportedPublisher({ ...h.options, mode: "dry-run", outputRoot: dryRoot }); h.options.confirmPublicationId = dry.publicationId;
            const originalK58 = (globalThis as any)[K58]; let calls = 0;
            (globalThis as any)[K58] = async () => { const result = await originalK58(); calls++; if (calls >= 2) result.artifacts = { ...result.artifacts, plan: { ...result.artifacts.plan, source: { ...result.artifacts.plan.source, fullArtifactFingerprintSha256: "b".repeat(64) } } }; return result; };
            await rejects(() => api.runCharacterLeaderSupportedPublisher(h.options), /source drifted/);
            equal(memory.calls.some(call => call.op === "put" && call.key === CHARACTER_LEADER_SUPPORTED_PUBLISHER_MANIFEST_KEY), false);
        } finally { await rm(h.base, { recursive: true, force: true }); }
    });

    it("writes one content-addressed create-only report and rejects hardlink reuse", async () => {
        const h = await setup();
        try {
            const result = await api.runCharacterLeaderSupportedPublisher(h.options); equal(sha(await readFile(result.reportPath)), result.reportSha256);
            await unlink(result.reportPath); const external = join(h.base, "external"); await writeFile(external, "preserve"); await link(external, result.reportPath);
            await rejects(() => api.runCharacterLeaderSupportedPublisher(h.options), /create-only|report/);
        } finally { await rm(h.base, { recursive: true, force: true }); }
    });

    it("leaves only a non-authoritative RSS-NOT_EXECUTED report when final RSS enforcement fails", async () => {
        const h = await setup(); (globalThis as any)[RSS_STOP] = () => { throw new Error("synthetic final RSS failure"); };
        try {
            await rejects(() => api.runCharacterLeaderSupportedPublisher(h.options), /synthetic final RSS failure/);
            const namespaceEntries = await readdir(h.options.outputRoot); equal(namespaceEntries.length, 1);
            const namespace = join(h.options.outputRoot, namespaceEntries[0]);
            const publicationEntries = await readdir(namespace); equal(publicationEntries.length, 1);
            const publication = join(namespace, publicationEntries[0]);
            const artifactEntries = await readdir(publication); equal(artifactEntries.length, 1);
            const reportDirectory = join(publication, artifactEntries[0]);
            deepStrictEqual(await readdir(reportDirectory), [CHARACTER_LEADER_SUPPORTED_PUBLISHER_REPORT_FILE]);
            const report = JSON.parse((await readFile(join(reportDirectory, CHARACTER_LEADER_SUPPORTED_PUBLISHER_REPORT_FILE))).toString("utf8"));
            equal(report.readiness.perProcessRssUnder1GiB, "NOT_EXECUTED");
        } finally { await rm(h.base, { recursive: true, force: true }); }
    });

    it("keeps productive API fixed and has no runtime hook surface", () => {
        deepStrictEqual(Object.keys(productionApi), ["runCharacterLeaderSupportedPublisher"]);
        const source = require("fs").readFileSync(join(sourceRoot(), "database-characters", "leader-supported-publisher.ts"), "utf8");
        equal(/globalThis|Symbol\.for\(|dokkan\.k60/.test(source), false);
        equal(/DeleteObjectCommand|CopyObjectCommand|UploadPart|CreateMultipart/i.test(source), false);
    });
});
