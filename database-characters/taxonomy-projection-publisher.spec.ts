import { deepStrictEqual, doesNotMatch, equal, match, ok, rejects } from "assert";
import { createHash } from "crypto";
import { link, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "fs/promises";
import * as ModuleApi from "module";
import { tmpdir } from "os";
import { basename, dirname, join, resolve } from "path";
import { ModuleKind, ScriptTarget, transpileModule } from "typescript";
import * as productionApi from "./taxonomy-projection-publisher";
import {
    TAXONOMY_PROJECTION_PUBLISHER_IMMUTABLE_CACHE_CONTROL,
    TAXONOMY_PROJECTION_PUBLISHER_MAX_REPORT_BYTES,
    TAXONOMY_PROJECTION_PUBLISHER_NAMESPACE,
    TAXONOMY_PROJECTION_PUBLISHER_REPORT_FILE,
} from "./taxonomy-projection-publisher-contract";
import { parseTaxonomyProjectionPublisherCli } from "./taxonomy-projection-publisher-run";
import { TAXONOMY_PROJECTION_REMOTE_MANIFEST_KEY, TAXONOMY_PROJECTION_REMOTE_NAMESPACE } from "./taxonomy-projection-object-plan-contract";

const PLAN_ID = "a".repeat(64);
const RELEASE_ID = "b".repeat(64);
const CHECKED_AT = "2026-08-14T18:00:00.000Z";
const jsonBytes = (value: unknown): Buffer => Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
const sha256 = (value: Buffer | string): string => createHash("sha256").update(value).digest("hex");

function repositorySourceRoot(): string {
    const parent = resolve(__dirname, "..");
    return basename(parent).toLowerCase() === "lib" ? resolve(parent, "..") : parent;
}

type InstrumentedApi = typeof productionApi;

async function loadInstrumentedApi(): Promise<InstrumentedApi> {
    const parent = resolve(__dirname, "..");
    const sourceRoot = repositorySourceRoot();
    const sourcePath = join(sourceRoot, "database-characters", "taxonomy-projection-publisher.ts");
    const runtimePath = basename(parent).toLowerCase() === "lib"
        ? join(parent, "database-characters", ".taxonomy-projection-publisher.test-runtime.js")
        : join(sourceRoot, "database-characters", ".taxonomy-projection-publisher.test-runtime.js");
    const source = await readFile(sourcePath, "utf8");
    const instrumented = source
        .replace(/runTaxonomyProjectionPublisherDryRun\(/g, "__testRunK39(")
        .replace(/readValidatedTaxonomyProjectionObjectPlan\(/g, "__testReadK37(")
        .replace(/readValidatedTaxonomyProjectionDelivery\(/g, "__testReadK36(")
        .replace("const adapter = createS3Adapter();", "const adapter = __testCreateS3Adapter();")
        .replace("export interface TaxonomyProjectionPublisherOptions", `
const __testHook = (name: string) => {
    const hook = (globalThis as any)[Symbol.for(name)];
    if (typeof hook !== "function") throw new Error("K40 test hook missing: " + name);
    return hook;
};
const __testRunK39 = (...args: any[]) => __testHook("dokkan.k40.k39")(...args);
const __testReadK37 = (...args: any[]) => __testHook("dokkan.k40.k37")(...args);
const __testReadK36 = (...args: any[]) => __testHook("dokkan.k40.k36")(...args);
const __testCreateS3Adapter = () => __testHook("dokkan.k40.s3")();

export interface TaxonomyProjectionPublisherOptions`);
    if (instrumented === source || !instrumented.includes("__testCreateS3Adapter")) throw new Error("K40 instrumentation failed");
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

const roots = {
    k37OutputRoot: "X:/explicit/k37", k37PlanId: PLAN_ID,
    k36OutputRoot: "X:/explicit/k36", k36ReleaseId: RELEASE_ID,
    k32Root: "X:/explicit/k32", k2Root: "X:/explicit/k2", productiveRoot: "X:/explicit/productive",
    sqliteRoot: "X:/explicit/sqlite", db1Root: "X:/explicit/db1", elfRoot: "X:/explicit/elf",
    nativeEvidenceRoot: "X:/explicit/native",
};

function cliArgs(mode: "dry-run" | "publish", outputRoot = "X:/output", confirmation = "f".repeat(64)): string[] {
    return [
        "--opt-in-k40", "--remote", mode === "dry-run" ? "--dry-run" : "--publish",
        ...(mode === "publish" ? ["--confirm-publication-id", confirmation] : []),
        "--k37-output-root", roots.k37OutputRoot, "--k37-plan-id", PLAN_ID,
        "--k36-output-root", roots.k36OutputRoot, "--k36-release-id", RELEASE_ID,
        "--k32-root", roots.k32Root, "--k2-root", roots.k2Root, "--productive-root", roots.productiveRoot,
        "--sqlite-root", roots.sqliteRoot, "--db1-root", roots.db1Root, "--elf-root", roots.elfRoot,
        "--native-evidence-root", roots.nativeEvidenceRoot, "--output-root", outputRoot, "--checked-at", CHECKED_AT,
    ];
}

interface Fixture {
    releaseDirectory: string;
    bytes: Buffer[];
    names: string[];
    objects: any[];
    manifestCandidateBytes: Buffer;
    k37: any;
    k36: any;
    k39Result: any;
}

async function makeFixture(temporary: string,
    statuses: readonly ("matching" | "missing")[] = ["matching", "missing", "missing", "matching"],
    manifestStatus: "matching" | "missing" | "different" = "different", checkedAt = CHECKED_AT): Promise<Fixture> {
    const releaseDirectory = await mkdtemp(join(temporary, "release-"));
    const bytes = [Buffer.from("payload"), Buffer.from("coverage"), Buffer.from("validation"), Buffer.from("k35-manifest")];
    const hashes = bytes.map(sha256);
    const names = [
        `database-characters-k35-taxonomy-projection.${hashes[0]}.json.gz`,
        "database-characters-k35-taxonomy-projection-coverage.json",
        "database-characters-k35-taxonomy-projection-validation.json",
        "database-characters-k35-taxonomy-projection-manifest.json",
    ];
    for (let index = 0; index < 4; index++) await writeFile(join(releaseDirectory, names[index]), bytes[index]);
    const kinds = ["payload", "coverage", "validation", "manifest"];
    const objects = bytes.map((value, index) => ({
        kind: kinds[index], sourceFileName: names[index],
        objectKey: `${TAXONOMY_PROJECTION_REMOTE_NAMESPACE}/objects/sha256/${hashes[index]}/${names[index]}`,
        sha256: hashes[index], sizeBytes: value.length,
        cacheControl: TAXONOMY_PROJECTION_PUBLISHER_IMMUTABLE_CACHE_CONTROL,
        contentAddressed: true, remoteHashProofRequiredBeforeReuse: true,
    }));
    const receipt = {
        contract: "dokkan-database-character-taxonomy-projection-delivery-k36", contractVersion: "1.0.0",
        releaseId: RELEASE_ID, generatedAt: "2026-08-14T00:00:00.000Z",
        inventory: { closed: true, artifactCount: 4, entries: objects.map((object: any) => ({
            kind: object.kind, fileName: object.sourceFileName, sha256: object.sha256, sizeBytes: object.sizeBytes,
        })) },
    };
    const marker = { contract: "dokkan-database-character-taxonomy-projection-delivery-ready-k36", releaseId: RELEASE_ID };
    const source = {
        k36: {
            releaseId: RELEASE_ID, receiptSha256: sha256(jsonBytes(receipt)), receiptSizeBytes: jsonBytes(receipt).length,
            markerSha256: sha256(jsonBytes(marker)), markerSizeBytes: jsonBytes(marker).length,
        },
        k35: { contract: "synthetic-k35" },
    };
    const manifestCandidate = {
        contract: "dokkan-database-character-taxonomy-projection-remote-manifest-candidate-k37",
        releaseId: RELEASE_ID, inventory: { closed: true, artifactCount: 4, objects }, cacheControl: "no-store",
    };
    const manifestCandidateBytes = jsonBytes(manifestCandidate);
    const plan = {
        contract: "dokkan-database-character-taxonomy-projection-object-plan-k37", planId: PLAN_ID,
        source, objects,
        mutableManifest: {
            objectKey: TAXONOMY_PROJECTION_REMOTE_MANIFEST_KEY, sha256: sha256(manifestCandidateBytes),
            sizeBytes: manifestCandidateBytes.length, cacheControl: "no-store",
        },
    };
    const k37 = {
        planDirectory: "X:/synthetic/k37-plan", planId: PLAN_ID, plan, manifestCandidate,
        receipt: { contract: "synthetic-k37-receipt", planId: PLAN_ID },
        marker: { contract: "synthetic-k37-marker", planId: PLAN_ID },
        sourceBoundK36Validation: "GO", peakRssBytes: 1,
    };
    const k36 = {
        releaseDirectory, releaseId: RELEASE_ID, receipt, marker,
        sourceBoundK35Validation: "GO", peakRssBytes: 1,
    };
    const immutableActions = objects.map((object: any, index: number) => ({
        order: index + 1, kind: object.kind, sourceFileName: object.sourceFileName, objectKey: object.objectKey,
        expectedSha256: object.sha256, expectedSizeBytes: object.sizeBytes,
        contentType: index === 0 ? "application/gzip" : "application/json",
        cacheControl: TAXONOMY_PROJECTION_PUBLISHER_IMMUTABLE_CACHE_CONTROL,
        k38Status: statuses[index], action: statuses[index] === "matching" ? "reuse_verified_remote_bytes" : "create_if_absent",
    }));
    const mutableManifest = {
        objectKey: TAXONOMY_PROJECTION_REMOTE_MANIFEST_KEY,
        expectedSha256: sha256(manifestCandidateBytes), expectedSizeBytes: manifestCandidateBytes.length,
        contentType: "application/json", cacheControl: "no-store", k38Status: manifestStatus,
    };
    const k39Report = {
        checkedAt, planId: PLAN_ID, k36ReleaseId: RELEASE_ID,
        remote: { immutableActions, mutableManifest, mutationExecuted: false },
        k38BucketUsage: { status: "known", reported: "361 MB", conservativeUpperBoundBytes: 361000001 },
        k38Budget: { namespacePlanStrictlyWithinLimit: true, withinBucketCeiling: true, bytesRead: 1234,
            projectedBucketUpperBoundBytes: 361001000 },
        readiness: { dryRun: "GO", publicationAuthorization: "REQUIRED", publication: "NO-GO" },
    };
    return {
        releaseDirectory, bytes, names, objects, manifestCandidateBytes, k37, k36,
        k39Result: { reportSha256: sha256(`${checkedAt}-k39`), report: k39Report },
    };
}

interface StoredObject { bytes: Buffer; etag: string; contentType: string; cacheControl: string }

class FakeAdapter {
    readonly calls: any[] = [];
    readonly objects = new Map<string, StoredObject>();
    raceKeys = new Set<string>();
    manifestFreshOverride?: StoredObject;
    private etagCounter = 10;
    private manifestReads = 0;
    readonly fixture: Fixture;
    constructor(fixture: Fixture) { this.fixture = fixture; }
    async read(key: string): Promise<any> {
        this.calls.push({ op: "read", key });
        if (key === TAXONOMY_PROJECTION_REMOTE_MANIFEST_KEY && ++this.manifestReads === 2 && this.manifestFreshOverride) {
            this.objects.set(key, this.manifestFreshOverride);
            return { status: "present", ...this.manifestFreshOverride };
        }
        const object = this.objects.get(key);
        return object ? { status: "present", ...object, bytes: Buffer.from(object.bytes) } : { status: "missing" };
    }
    async put(key: string, bytes: Buffer, contentType: string, cacheControl: string, condition: any): Promise<any> {
        this.calls.push({ op: "put", key, condition, contentType, cacheControl, bytes: Buffer.from(bytes) });
        if (this.raceKeys.has(key)) {
            this.objects.set(key, { bytes: Buffer.from(bytes), etag: `"race-${++this.etagCounter}"`, contentType, cacheControl });
            return "precondition_failed";
        }
        const existing = this.objects.get(key);
        if ((condition.IfNoneMatch === "*" && existing) || (condition.IfMatch && existing?.etag !== condition.IfMatch)) {
            return "precondition_failed";
        }
        this.objects.set(key, { bytes: Buffer.from(bytes), etag: `"etag-${++this.etagCounter}"`, contentType, cacheControl });
        return "written";
    }
}

function seedAdapter(fixture: Fixture): FakeAdapter {
    const adapter = new FakeAdapter(fixture);
    fixture.objects.forEach((object, index) => {
        const status = fixture.k39Result.report.remote.immutableActions[index].k38Status;
        if (status === "matching") adapter.objects.set(object.objectKey, {
            bytes: fixture.bytes[index], etag: `"immutable-${index}"`,
            contentType: index === 0 ? "application/gzip" : "application/json",
            cacheControl: TAXONOMY_PROJECTION_PUBLISHER_IMMUTABLE_CACHE_CONTROL,
        });
    });
    const manifestStatus = fixture.k39Result.report.remote.mutableManifest.k38Status;
    if (manifestStatus === "matching") adapter.objects.set(TAXONOMY_PROJECTION_REMOTE_MANIFEST_KEY, {
        bytes: fixture.manifestCandidateBytes, etag: "\"manifest-current\"", contentType: "application/json", cacheControl: "no-store",
    });
    if (manifestStatus === "different") adapter.objects.set(TAXONOMY_PROJECTION_REMOTE_MANIFEST_KEY, {
        bytes: Buffer.from("older"), etag: "\"manifest-old\"", contentType: "application/json", cacheControl: "no-store",
    });
    return adapter;
}

interface HarnessOptions { fixture?: Fixture; outputRoot?: string; mode?: "dry-run" | "publish"; confirmation?: string; adapter?: FakeAdapter }

async function runHarness(api: InstrumentedApi, temporary: string, options: HarnessOptions = {}) {
    const fixture = options.fixture ?? await makeFixture(temporary);
    const outputRoot = options.outputRoot ?? await mkdtemp(join(temporary, "output-"));
    const sequence: string[] = [];
    let adapterCalls = 0;
    (globalThis as any)[Symbol.for("dokkan.k40.k39")] = (value: any) => { sequence.push("k39"); return fixture.k39Result; };
    (globalThis as any)[Symbol.for("dokkan.k40.k37")] = () => { sequence.push("k37"); return fixture.k37; };
    (globalThis as any)[Symbol.for("dokkan.k40.k36")] = () => { sequence.push("k36"); return fixture.k36; };
    (globalThis as any)[Symbol.for("dokkan.k40.s3")] = () => { sequence.push("s3"); adapterCalls++; return options.adapter!; };
    const mode = options.mode ?? "dry-run";
    const result = await api.runTaxonomyProjectionPublisher({
        optInK40: true, remote: true, mode,
        ...(mode === "publish" ? { confirmPublicationId: options.confirmation } : {}),
        ...roots, outputRoot, checkedAt: fixture.k39Result.report.checkedAt,
    });
    return { fixture, outputRoot, sequence, adapterCalls, result };
}

describe("K40 conditional taxonomy projection publisher", () => {
    let temporary: string;
    let api: InstrumentedApi;
    before(async () => { temporary = await mkdtemp(join(tmpdir(), "dokkan-k40-")); api = await loadInstrumentedApi(); });
    after(async () => {
        for (const name of ["dokkan.k40.k39", "dokkan.k40.k37", "dokkan.k40.k36", "dokkan.k40.s3"]) {
            delete (globalThis as any)[Symbol.for(name)];
        }
        await rm(temporary, { recursive: true, force: true });
    });

    it("requires exact CLI opt-ins, one mode, confirmation only for publish, and every value", async () => {
        equal(parseTaxonomyProjectionPublisherCli(cliArgs("dry-run")).mode, "dry-run");
        const publish = parseTaxonomyProjectionPublisherCli(cliArgs("publish"));
        equal(publish.mode, "publish"); equal(publish.confirmPublicationId, "f".repeat(64));
        for (const removed of ["--opt-in-k40", "--remote", "--dry-run", "--k37-plan-id", "--sqlite-root", "--checked-at"]) {
            const args = cliArgs("dry-run"); const index = args.indexOf(removed);
            args.splice(index, ["--opt-in-k40", "--remote", "--dry-run"].includes(removed) ? 1 : 2);
            await rejects(async () => parseTaxonomyProjectionPublisherCli(args), /exactly one|missing/);
        }
        await rejects(async () => parseTaxonomyProjectionPublisherCli([...cliArgs("dry-run"), "--publish"]), /exactly one/);
        await rejects(async () => parseTaxonomyProjectionPublisherCli([...cliArgs("dry-run"), "--confirm-publication-id", "f".repeat(64)]), /forbids/);
        const missingConfirm = cliArgs("publish"); missingConfirm.splice(missingConfirm.indexOf("--confirm-publication-id"), 2);
        await rejects(async () => parseTaxonomyProjectionPublisherCli(missingConfirm), /requires exactly one/);
        await rejects(async () => parseTaxonomyProjectionPublisherCli(cliArgs("publish", "X:/output", "not-an-id")), /64-hex/);
    });

    it("exports only the runner and contains no injectable publisher, delete, copy, multipart, or import side effect", async () => {
        deepStrictEqual(Object.keys(productionApi).sort(), ["runTaxonomyProjectionPublisher"]);
        const source = await readFile(join(repositorySourceRoot(), "database-characters", "taxonomy-projection-publisher.ts"), "utf8");
        doesNotMatch(source, /export (?:interface|type|function|const).*?(?:Writer|Adapter|Transport|SavedReport|CurrentState)/i);
        doesNotMatch(source, /(?:DeleteObjectCommand|CopyObjectCommand|UploadPartCommand|createMultipartUpload|\.delete\s*\()/);
        doesNotMatch(source, /process\.env\.(?!CLOUDFLARE_ACCOUNT_ID|R2_ACCESS_KEY_ID|R2_SECRET_ACCESS_KEY)/);
        equal((globalThis as any)[Symbol.for("dokkan.k40.import-side-effect")], undefined);
    });

    it("runs K39 first, revalidates K37/K36 twice, and dry-run never constructs S3", async () => {
        const run = await runHarness(api, temporary);
        deepStrictEqual(run.sequence, ["k39", "k37", "k36", "k37", "k36"]);
        equal(run.adapterCalls, 0);
        equal(run.result.report.readiness.dryRun, "GO");
        equal(run.result.report.readiness.publicationAuthorization, "REQUIRED");
        equal(run.result.report.readiness.publication, "NOT_EXECUTED");
        equal(run.result.publication, undefined);
    });

    it("builds a deterministic publication ID independent of current observations and checkedAt", async () => {
        const firstFixture = await makeFixture(temporary, ["matching", "missing", "missing", "matching"], "different", CHECKED_AT);
        const secondFixture = await makeFixture(temporary, ["missing", "missing", "matching", "matching"], "missing",
            "2026-08-14T19:00:00.000Z");
        const first = await runHarness(api, temporary, { fixture: firstFixture });
        const second = await runHarness(api, temporary, { fixture: secondFixture });
        equal(first.result.publicationId, second.result.publicationId);
        doesNotMatch(JSON.stringify(first.result.report.plan), /2026-08-14|k38Status|immutableObservations|bucketUsage/);
        equal(first.result.report.plan.immutableObjects.length, 4);
        equal(first.result.report.plan.mutableManifest.order, "LAST");
    });

    it("binds exact regular single-link K36 bytes and rejects corruption and hardlinks", async () => {
        const corrupt = await makeFixture(temporary);
        await writeFile(join(corrupt.releaseDirectory, corrupt.names[1]), "corrupt");
        await rejects(() => runHarness(api, temporary, { fixture: corrupt }), /bounded single-link|bytes or identity/);

        const linked = await makeFixture(temporary);
        const outside = join(temporary, "outside-hardlink"); await writeFile(outside, linked.bytes[2]);
        await rm(join(linked.releaseDirectory, linked.names[2]));
        await link(outside, join(linked.releaseDirectory, linked.names[2]));
        await rejects(() => runHarness(api, temporary, { fixture: linked }), /single-link/);
    });

    it("rejects K39 NO-GO/current budget failure and local drift", async () => {
        const noGo = await makeFixture(temporary); noGo.k39Result.report.readiness.dryRun = "NO-GO";
        await rejects(() => runHarness(api, temporary, { fixture: noGo }), /current productively rerun K39/);
        const budget = await makeFixture(temporary); budget.k39Result.report.k38Budget.withinBucketCeiling = false;
        await rejects(() => runHarness(api, temporary, { fixture: budget }), /current productively rerun K39/);

        const drift = await makeFixture(temporary); let reads = 0;
        const outputRoot = await mkdtemp(join(temporary, "drift-output-"));
        (globalThis as any)[Symbol.for("dokkan.k40.k39")] = () => drift.k39Result;
        (globalThis as any)[Symbol.for("dokkan.k40.k37")] = () => {
            reads++; if (reads === 2) return { ...drift.k37, receipt: { changed: true } }; return drift.k37;
        };
        (globalThis as any)[Symbol.for("dokkan.k40.k36")] = () => drift.k36;
        await rejects(() => api.runTaxonomyProjectionPublisher({
            optInK40: true, remote: true, mode: "dry-run", ...roots, outputRoot, checkedAt: CHECKED_AT,
        }), /source drifted during deterministic planning/);
    });

    it("publishes immutables in K37 order with If-None-Match, verifies them, and CASes manifest last", async () => {
        const fixture = await makeFixture(temporary);
        const dry = await runHarness(api, temporary, { fixture });
        const adapter = seedAdapter(fixture);
        const published = await runHarness(api, temporary, {
            fixture, mode: "publish", confirmation: dry.result.publicationId, adapter,
        });
        equal(published.result.publication?.immutableUploaded, 2);
        equal(published.result.publication?.immutableReused, 2);
        equal(published.result.publication?.immutableVerified, 4);
        equal(published.result.publication?.manifestResult, "REPLACED");
        const puts = adapter.calls.filter(call => call.op === "put");
        deepStrictEqual(puts.slice(0, 2).map(call => call.key), [fixture.objects[1].objectKey, fixture.objects[2].objectKey]);
        deepStrictEqual(puts.slice(0, 2).map(call => call.condition), [{ IfNoneMatch: "*" }, { IfNoneMatch: "*" }]);
        equal(puts[2].key, TAXONOMY_PROJECTION_REMOTE_MANIFEST_KEY);
        deepStrictEqual(puts[2].condition, { IfMatch: "\"manifest-old\"" });
        const lastPutIndex = adapter.calls.map(call => call.op).lastIndexOf("put");
        ok(adapter.calls.slice(0, lastPutIndex).filter(call => call.op === "read").length >= 7);
        equal(published.result.publication?.deleteCount, 0);
        equal(published.result.publication?.rollbackAttempted, false);
    });

    it("fails direct metadata conflicts and accepts 409/412 immutable races only after exact reread", async () => {
        const conflictFixture = await makeFixture(temporary);
        const conflictDry = await runHarness(api, temporary, { fixture: conflictFixture });
        const conflictAdapter = seedAdapter(conflictFixture);
        conflictAdapter.objects.get(conflictFixture.objects[0].objectKey)!.cacheControl = "no-store";
        await rejects(() => runHarness(api, temporary, {
            fixture: conflictFixture, mode: "publish", confirmation: conflictDry.result.publicationId, adapter: conflictAdapter,
        }), /immutable bytes or metadata conflict/);

        const hashFixture = await makeFixture(temporary);
        const hashDry = await runHarness(api, temporary, { fixture: hashFixture });
        const hashAdapter = seedAdapter(hashFixture);
        hashAdapter.objects.get(hashFixture.objects[0].objectKey)!.bytes = Buffer.from("wrong");
        await rejects(() => runHarness(api, temporary, {
            fixture: hashFixture, mode: "publish", confirmation: hashDry.result.publicationId, adapter: hashAdapter,
        }), /immutable bytes or metadata conflict/);

        const raceFixture = await makeFixture(temporary);
        const raceDry = await runHarness(api, temporary, { fixture: raceFixture });
        const raceAdapter = seedAdapter(raceFixture); raceAdapter.raceKeys.add(raceFixture.objects[1].objectKey);
        const raced = await runHarness(api, temporary, {
            fixture: raceFixture, mode: "publish", confirmation: raceDry.result.publicationId, adapter: raceAdapter,
        });
        equal(raced.result.publication?.immutableUploaded, 1);
        equal(raced.result.publication?.immutableReused, 3);

        const manifestRaceFixture = await makeFixture(temporary);
        const manifestRaceDry = await runHarness(api, temporary, { fixture: manifestRaceFixture });
        const manifestRaceAdapter = seedAdapter(manifestRaceFixture);
        manifestRaceAdapter.raceKeys.add(TAXONOMY_PROJECTION_REMOTE_MANIFEST_KEY);
        const manifestRace = await runHarness(api, temporary, {
            fixture: manifestRaceFixture, mode: "publish", confirmation: manifestRaceDry.result.publicationId,
            adapter: manifestRaceAdapter,
        });
        equal(manifestRace.result.publication?.manifestPromoted, false);
        equal(manifestRace.result.publication?.manifestResult, "CONCURRENT_IDEMPOTENT_COMPLETION");
    });

    it("revalidates all local source after immutable verification and stops drift before manifest", async () => {
        const fixture = await makeFixture(temporary);
        const dry = await runHarness(api, temporary, { fixture });
        const adapter = seedAdapter(fixture);
        const outputRoot = await mkdtemp(join(temporary, "pre-manifest-drift-"));
        let k37Reads = 0;
        (globalThis as any)[Symbol.for("dokkan.k40.k39")] = () => fixture.k39Result;
        (globalThis as any)[Symbol.for("dokkan.k40.k37")] = () => {
            k37Reads++;
            return k37Reads === 3 ? { ...fixture.k37, receipt: { changedBeforeManifest: true } } : fixture.k37;
        };
        (globalThis as any)[Symbol.for("dokkan.k40.k36")] = () => fixture.k36;
        (globalThis as any)[Symbol.for("dokkan.k40.s3")] = () => adapter;
        await rejects(() => api.runTaxonomyProjectionPublisher({
            optInK40: true, remote: true, mode: "publish", confirmPublicationId: dry.result.publicationId,
            ...roots, outputRoot, checkedAt: CHECKED_AT,
        }), /local source drifted before mutable manifest promotion/);
        equal(adapter.calls.some(call => call.op === "put" && call.key === TAXONOMY_PROJECTION_REMOTE_MANIFEST_KEY), false);
        equal(adapter.calls.some(call => call.op === "delete"), false);
    });

    it("directly reverifies all immutable objects immediately before the mutable manifest", async () => {
        const fixture = await makeFixture(temporary);
        const dry = await runHarness(api, temporary, { fixture });
        const adapter = seedAdapter(fixture);
        const originalRead = adapter.read.bind(adapter);
        let firstObjectReads = 0;
        adapter.read = async (key: string) => {
            const observed = await originalRead(key);
            if (key === fixture.objects[0].objectKey && ++firstObjectReads === 2) {
                return { ...observed, bytes: Buffer.from("changed-after-initial-verification") };
            }
            return observed;
        };
        await rejects(() => runHarness(api, temporary, {
            fixture, mode: "publish", confirmation: dry.result.publicationId, adapter,
        }), /immutable changed before mutable manifest promotion/);
        equal(adapter.calls.some(call => call.op === "put" && call.key === TAXONOMY_PROJECTION_REMOTE_MANIFEST_KEY), false);
    });

    it("rereads manifest after source validation, fails nonexact freshness drift, and accepts exact concurrent completion", async () => {
        const changedFixture = await makeFixture(temporary);
        const changedDry = await runHarness(api, temporary, { fixture: changedFixture });
        const changedAdapter = seedAdapter(changedFixture);
        changedAdapter.manifestFreshOverride = {
            bytes: Buffer.from("someone-else"), etag: "\"new-etag\"", contentType: "application/json", cacheControl: "no-store",
        };
        await rejects(() => runHarness(api, temporary, {
            fixture: changedFixture, mode: "publish", confirmation: changedDry.result.publicationId, adapter: changedAdapter,
        }), /fresh K39 run is required/);

        const exactFixture = await makeFixture(temporary);
        const exactDry = await runHarness(api, temporary, { fixture: exactFixture });
        const exactAdapter = seedAdapter(exactFixture);
        exactAdapter.manifestFreshOverride = {
            bytes: exactFixture.manifestCandidateBytes, etag: "\"concurrent\"", contentType: "application/json", cacheControl: "no-store",
        };
        const exact = await runHarness(api, temporary, {
            fixture: exactFixture, mode: "publish", confirmation: exactDry.result.publicationId, adapter: exactAdapter,
        });
        equal(exact.result.publication?.manifestResult, "CONCURRENT_IDEMPOTENT_COMPLETION");
        equal(exactAdapter.calls.filter(call => call.op === "put" && call.key === TAXONOMY_PROJECTION_REMOTE_MANIFEST_KEY).length, 0);
    });

    it("requires rebuilt publication confirmation before S3 construction", async () => {
        const fixture = await makeFixture(temporary); let adapterCalls = 0;
        const outputRoot = await mkdtemp(join(temporary, "bad-confirm-"));
        (globalThis as any)[Symbol.for("dokkan.k40.k39")] = () => fixture.k39Result;
        (globalThis as any)[Symbol.for("dokkan.k40.k37")] = () => fixture.k37;
        (globalThis as any)[Symbol.for("dokkan.k40.k36")] = () => fixture.k36;
        (globalThis as any)[Symbol.for("dokkan.k40.s3")] = () => { adapterCalls++; return seedAdapter(fixture); };
        await rejects(() => api.runTaxonomyProjectionPublisher({
            optInK40: true, remote: true, mode: "publish", confirmPublicationId: "e".repeat(64),
            ...roots, outputRoot, checkedAt: CHECKED_AT,
        }), /confirmation ID does not match/);
        equal(adapterCalls, 0);
    });

    it("persists one bounded content-addressed create-only report and rejects linked namespaces", async function () {
        const run = await runHarness(api, temporary);
        const stored = await readFile(run.result.reportPath);
        ok(stored.length < TAXONOMY_PROJECTION_PUBLISHER_MAX_REPORT_BYTES);
        equal(sha256(stored), run.result.reportSha256);
        equal(basename(run.result.reportPath), TAXONOMY_PROJECTION_PUBLISHER_REPORT_FILE);
        equal(basename(run.result.reportDirectory), run.result.reportSha256);
        await rejects(() => runHarness(api, temporary, { fixture: run.fixture, outputRoot: run.outputRoot }), /create-only report/);

        const externalReport = join(temporary, "external-k40-report");
        await writeFile(externalReport, "external");
        await rm(run.result.reportPath);
        await link(externalReport, run.result.reportPath);
        await rejects(() => runHarness(api, temporary, { fixture: run.fixture, outputRoot: run.outputRoot }),
            /existing report file identity rejected/);

        const root = await mkdtemp(join(temporary, "junction-root-"));
        const external = await mkdtemp(join(temporary, "junction-external-"));
        try { await symlink(external, join(root, TAXONOMY_PROJECTION_PUBLISHER_NAMESPACE), "junction"); }
        catch (error: any) {
            if (error?.code === "EPERM" || error?.code === "EACCES") { this.skip(); return; }
            throw error;
        }
        let k39Calls = 0;
        (globalThis as any)[Symbol.for("dokkan.k40.k39")] = () => { k39Calls++; return run.fixture.k39Result; };
        await rejects(() => api.runTaxonomyProjectionPublisher({
            optInK40: true, remote: true, mode: "dry-run", ...roots, outputRoot: root, checkedAt: CHECKED_AT,
        }), /link|junction|regular directory/);
        equal(k39Calls, 0);
    });
});
