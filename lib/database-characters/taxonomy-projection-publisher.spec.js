"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const crypto_1 = require("crypto");
const promises_1 = require("fs/promises");
const ModuleApi = require("module");
const os_1 = require("os");
const path_1 = require("path");
const typescript_1 = require("typescript");
const productionApi = require("./taxonomy-projection-publisher");
const taxonomy_projection_publisher_contract_1 = require("./taxonomy-projection-publisher-contract");
const taxonomy_projection_publisher_run_1 = require("./taxonomy-projection-publisher-run");
const taxonomy_projection_object_plan_contract_1 = require("./taxonomy-projection-object-plan-contract");
const PLAN_ID = "a".repeat(64);
const RELEASE_ID = "b".repeat(64);
const CHECKED_AT = "2026-08-14T18:00:00.000Z";
const jsonBytes = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
const sha256 = (value) => (0, crypto_1.createHash)("sha256").update(value).digest("hex");
function repositorySourceRoot() {
    const parent = (0, path_1.resolve)(__dirname, "..");
    return (0, path_1.basename)(parent).toLowerCase() === "lib" ? (0, path_1.resolve)(parent, "..") : parent;
}
async function loadInstrumentedApi() {
    const parent = (0, path_1.resolve)(__dirname, "..");
    const sourceRoot = repositorySourceRoot();
    const sourcePath = (0, path_1.join)(sourceRoot, "database-characters", "taxonomy-projection-publisher.ts");
    const runtimePath = (0, path_1.basename)(parent).toLowerCase() === "lib"
        ? (0, path_1.join)(parent, "database-characters", ".taxonomy-projection-publisher.test-runtime.js")
        : (0, path_1.join)(sourceRoot, "database-characters", ".taxonomy-projection-publisher.test-runtime.js");
    const source = await (0, promises_1.readFile)(sourcePath, "utf8");
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
    if (instrumented === source || !instrumented.includes("__testCreateS3Adapter"))
        throw new Error("K40 instrumentation failed");
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
const roots = {
    k37OutputRoot: "X:/explicit/k37", k37PlanId: PLAN_ID,
    k36OutputRoot: "X:/explicit/k36", k36ReleaseId: RELEASE_ID,
    k32Root: "X:/explicit/k32", k2Root: "X:/explicit/k2", productiveRoot: "X:/explicit/productive",
    sqliteRoot: "X:/explicit/sqlite", db1Root: "X:/explicit/db1", elfRoot: "X:/explicit/elf",
    nativeEvidenceRoot: "X:/explicit/native",
};
function cliArgs(mode, outputRoot = "X:/output", confirmation = "f".repeat(64)) {
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
async function makeFixture(temporary, statuses = ["matching", "missing", "missing", "matching"], manifestStatus = "different", checkedAt = CHECKED_AT) {
    const releaseDirectory = await (0, promises_1.mkdtemp)((0, path_1.join)(temporary, "release-"));
    const bytes = [Buffer.from("payload"), Buffer.from("coverage"), Buffer.from("validation"), Buffer.from("k35-manifest")];
    const hashes = bytes.map(sha256);
    const names = [
        `database-characters-k35-taxonomy-projection.${hashes[0]}.json.gz`,
        "database-characters-k35-taxonomy-projection-coverage.json",
        "database-characters-k35-taxonomy-projection-validation.json",
        "database-characters-k35-taxonomy-projection-manifest.json",
    ];
    for (let index = 0; index < 4; index++)
        await (0, promises_1.writeFile)((0, path_1.join)(releaseDirectory, names[index]), bytes[index]);
    const kinds = ["payload", "coverage", "validation", "manifest"];
    const objects = bytes.map((value, index) => ({
        kind: kinds[index], sourceFileName: names[index],
        objectKey: `${taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_REMOTE_NAMESPACE}/objects/sha256/${hashes[index]}/${names[index]}`,
        sha256: hashes[index], sizeBytes: value.length,
        cacheControl: taxonomy_projection_publisher_contract_1.TAXONOMY_PROJECTION_PUBLISHER_IMMUTABLE_CACHE_CONTROL,
        contentAddressed: true, remoteHashProofRequiredBeforeReuse: true,
    }));
    const receipt = {
        contract: "dokkan-database-character-taxonomy-projection-delivery-k36", contractVersion: "1.0.0",
        releaseId: RELEASE_ID, generatedAt: "2026-08-14T00:00:00.000Z",
        inventory: { closed: true, artifactCount: 4, entries: objects.map((object) => ({
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
            objectKey: taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_REMOTE_MANIFEST_KEY, sha256: sha256(manifestCandidateBytes),
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
    const immutableActions = objects.map((object, index) => ({
        order: index + 1, kind: object.kind, sourceFileName: object.sourceFileName, objectKey: object.objectKey,
        expectedSha256: object.sha256, expectedSizeBytes: object.sizeBytes,
        contentType: index === 0 ? "application/gzip" : "application/json",
        cacheControl: taxonomy_projection_publisher_contract_1.TAXONOMY_PROJECTION_PUBLISHER_IMMUTABLE_CACHE_CONTROL,
        k38Status: statuses[index], action: statuses[index] === "matching" ? "reuse_verified_remote_bytes" : "create_if_absent",
    }));
    const mutableManifest = {
        objectKey: taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_REMOTE_MANIFEST_KEY,
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
class FakeAdapter {
    calls = [];
    objects = new Map();
    raceKeys = new Set();
    manifestFreshOverride;
    etagCounter = 10;
    manifestReads = 0;
    fixture;
    constructor(fixture) { this.fixture = fixture; }
    async read(key) {
        this.calls.push({ op: "read", key });
        if (key === taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_REMOTE_MANIFEST_KEY && ++this.manifestReads === 2 && this.manifestFreshOverride) {
            this.objects.set(key, this.manifestFreshOverride);
            return { status: "present", ...this.manifestFreshOverride };
        }
        const object = this.objects.get(key);
        return object ? { status: "present", ...object, bytes: Buffer.from(object.bytes) } : { status: "missing" };
    }
    async put(key, bytes, contentType, cacheControl, condition) {
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
function seedAdapter(fixture) {
    const adapter = new FakeAdapter(fixture);
    fixture.objects.forEach((object, index) => {
        const status = fixture.k39Result.report.remote.immutableActions[index].k38Status;
        if (status === "matching")
            adapter.objects.set(object.objectKey, {
                bytes: fixture.bytes[index], etag: `"immutable-${index}"`,
                contentType: index === 0 ? "application/gzip" : "application/json",
                cacheControl: taxonomy_projection_publisher_contract_1.TAXONOMY_PROJECTION_PUBLISHER_IMMUTABLE_CACHE_CONTROL,
            });
    });
    const manifestStatus = fixture.k39Result.report.remote.mutableManifest.k38Status;
    if (manifestStatus === "matching")
        adapter.objects.set(taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_REMOTE_MANIFEST_KEY, {
            bytes: fixture.manifestCandidateBytes, etag: "\"manifest-current\"", contentType: "application/json", cacheControl: "no-store",
        });
    if (manifestStatus === "different")
        adapter.objects.set(taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_REMOTE_MANIFEST_KEY, {
            bytes: Buffer.from("older"), etag: "\"manifest-old\"", contentType: "application/json", cacheControl: "no-store",
        });
    return adapter;
}
async function runHarness(api, temporary, options = {}) {
    const fixture = options.fixture ?? await makeFixture(temporary);
    const outputRoot = options.outputRoot ?? await (0, promises_1.mkdtemp)((0, path_1.join)(temporary, "output-"));
    const sequence = [];
    let adapterCalls = 0;
    globalThis[Symbol.for("dokkan.k40.k39")] = (value) => { sequence.push("k39"); return fixture.k39Result; };
    globalThis[Symbol.for("dokkan.k40.k37")] = () => { sequence.push("k37"); return fixture.k37; };
    globalThis[Symbol.for("dokkan.k40.k36")] = () => { sequence.push("k36"); return fixture.k36; };
    globalThis[Symbol.for("dokkan.k40.s3")] = () => { sequence.push("s3"); adapterCalls++; return options.adapter; };
    const mode = options.mode ?? "dry-run";
    const result = await api.runTaxonomyProjectionPublisher({
        optInK40: true, remote: true, mode,
        ...(mode === "publish" ? { confirmPublicationId: options.confirmation } : {}),
        ...roots, outputRoot, checkedAt: fixture.k39Result.report.checkedAt,
    });
    return { fixture, outputRoot, sequence, adapterCalls, result };
}
describe("K40 conditional taxonomy projection publisher", () => {
    let temporary;
    let api;
    before(async () => { temporary = await (0, promises_1.mkdtemp)((0, path_1.join)((0, os_1.tmpdir)(), "dokkan-k40-")); api = await loadInstrumentedApi(); });
    after(async () => {
        for (const name of ["dokkan.k40.k39", "dokkan.k40.k37", "dokkan.k40.k36", "dokkan.k40.s3"]) {
            delete globalThis[Symbol.for(name)];
        }
        await (0, promises_1.rm)(temporary, { recursive: true, force: true });
    });
    it("requires exact CLI opt-ins, one mode, confirmation only for publish, and every value", async () => {
        (0, assert_1.equal)((0, taxonomy_projection_publisher_run_1.parseTaxonomyProjectionPublisherCli)(cliArgs("dry-run")).mode, "dry-run");
        const publish = (0, taxonomy_projection_publisher_run_1.parseTaxonomyProjectionPublisherCli)(cliArgs("publish"));
        (0, assert_1.equal)(publish.mode, "publish");
        (0, assert_1.equal)(publish.confirmPublicationId, "f".repeat(64));
        for (const removed of ["--opt-in-k40", "--remote", "--dry-run", "--k37-plan-id", "--sqlite-root", "--checked-at"]) {
            const args = cliArgs("dry-run");
            const index = args.indexOf(removed);
            args.splice(index, ["--opt-in-k40", "--remote", "--dry-run"].includes(removed) ? 1 : 2);
            await (0, assert_1.rejects)(async () => (0, taxonomy_projection_publisher_run_1.parseTaxonomyProjectionPublisherCli)(args), /exactly one|missing/);
        }
        await (0, assert_1.rejects)(async () => (0, taxonomy_projection_publisher_run_1.parseTaxonomyProjectionPublisherCli)([...cliArgs("dry-run"), "--publish"]), /exactly one/);
        await (0, assert_1.rejects)(async () => (0, taxonomy_projection_publisher_run_1.parseTaxonomyProjectionPublisherCli)([...cliArgs("dry-run"), "--confirm-publication-id", "f".repeat(64)]), /forbids/);
        const missingConfirm = cliArgs("publish");
        missingConfirm.splice(missingConfirm.indexOf("--confirm-publication-id"), 2);
        await (0, assert_1.rejects)(async () => (0, taxonomy_projection_publisher_run_1.parseTaxonomyProjectionPublisherCli)(missingConfirm), /requires exactly one/);
        await (0, assert_1.rejects)(async () => (0, taxonomy_projection_publisher_run_1.parseTaxonomyProjectionPublisherCli)(cliArgs("publish", "X:/output", "not-an-id")), /64-hex/);
    });
    it("exports only the runner and contains no injectable publisher, delete, copy, multipart, or import side effect", async () => {
        (0, assert_1.deepStrictEqual)(Object.keys(productionApi).sort(), ["runTaxonomyProjectionPublisher"]);
        const source = await (0, promises_1.readFile)((0, path_1.join)(repositorySourceRoot(), "database-characters", "taxonomy-projection-publisher.ts"), "utf8");
        (0, assert_1.doesNotMatch)(source, /export (?:interface|type|function|const).*?(?:Writer|Adapter|Transport|SavedReport|CurrentState)/i);
        (0, assert_1.doesNotMatch)(source, /(?:DeleteObjectCommand|CopyObjectCommand|UploadPartCommand|createMultipartUpload|\.delete\s*\()/);
        (0, assert_1.doesNotMatch)(source, /process\.env\.(?!CLOUDFLARE_ACCOUNT_ID|R2_ACCESS_KEY_ID|R2_SECRET_ACCESS_KEY)/);
        (0, assert_1.equal)(globalThis[Symbol.for("dokkan.k40.import-side-effect")], undefined);
    });
    it("runs K39 first, revalidates K37/K36 twice, and dry-run never constructs S3", async () => {
        const run = await runHarness(api, temporary);
        (0, assert_1.deepStrictEqual)(run.sequence, ["k39", "k37", "k36", "k37", "k36"]);
        (0, assert_1.equal)(run.adapterCalls, 0);
        (0, assert_1.equal)(run.result.report.readiness.dryRun, "GO");
        (0, assert_1.equal)(run.result.report.readiness.publicationAuthorization, "REQUIRED");
        (0, assert_1.equal)(run.result.report.readiness.publication, "NOT_EXECUTED");
        (0, assert_1.equal)(run.result.publication, undefined);
    });
    it("builds a deterministic publication ID independent of current observations and checkedAt", async () => {
        const firstFixture = await makeFixture(temporary, ["matching", "missing", "missing", "matching"], "different", CHECKED_AT);
        const secondFixture = await makeFixture(temporary, ["missing", "missing", "matching", "matching"], "missing", "2026-08-14T19:00:00.000Z");
        const first = await runHarness(api, temporary, { fixture: firstFixture });
        const second = await runHarness(api, temporary, { fixture: secondFixture });
        (0, assert_1.equal)(first.result.publicationId, second.result.publicationId);
        (0, assert_1.doesNotMatch)(JSON.stringify(first.result.report.plan), /2026-08-14|k38Status|immutableObservations|bucketUsage/);
        (0, assert_1.equal)(first.result.report.plan.immutableObjects.length, 4);
        (0, assert_1.equal)(first.result.report.plan.mutableManifest.order, "LAST");
    });
    it("binds exact regular single-link K36 bytes and rejects corruption and hardlinks", async () => {
        const corrupt = await makeFixture(temporary);
        await (0, promises_1.writeFile)((0, path_1.join)(corrupt.releaseDirectory, corrupt.names[1]), "corrupt");
        await (0, assert_1.rejects)(() => runHarness(api, temporary, { fixture: corrupt }), /bounded single-link|bytes or identity/);
        const linked = await makeFixture(temporary);
        const outside = (0, path_1.join)(temporary, "outside-hardlink");
        await (0, promises_1.writeFile)(outside, linked.bytes[2]);
        await (0, promises_1.rm)((0, path_1.join)(linked.releaseDirectory, linked.names[2]));
        await (0, promises_1.link)(outside, (0, path_1.join)(linked.releaseDirectory, linked.names[2]));
        await (0, assert_1.rejects)(() => runHarness(api, temporary, { fixture: linked }), /single-link/);
    });
    it("rejects K39 NO-GO/current budget failure and local drift", async () => {
        const noGo = await makeFixture(temporary);
        noGo.k39Result.report.readiness.dryRun = "NO-GO";
        await (0, assert_1.rejects)(() => runHarness(api, temporary, { fixture: noGo }), /current productively rerun K39/);
        const budget = await makeFixture(temporary);
        budget.k39Result.report.k38Budget.withinBucketCeiling = false;
        await (0, assert_1.rejects)(() => runHarness(api, temporary, { fixture: budget }), /current productively rerun K39/);
        const drift = await makeFixture(temporary);
        let reads = 0;
        const outputRoot = await (0, promises_1.mkdtemp)((0, path_1.join)(temporary, "drift-output-"));
        globalThis[Symbol.for("dokkan.k40.k39")] = () => drift.k39Result;
        globalThis[Symbol.for("dokkan.k40.k37")] = () => {
            reads++;
            if (reads === 2)
                return { ...drift.k37, receipt: { changed: true } };
            return drift.k37;
        };
        globalThis[Symbol.for("dokkan.k40.k36")] = () => drift.k36;
        await (0, assert_1.rejects)(() => api.runTaxonomyProjectionPublisher({
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
        (0, assert_1.equal)(published.result.publication?.immutableUploaded, 2);
        (0, assert_1.equal)(published.result.publication?.immutableReused, 2);
        (0, assert_1.equal)(published.result.publication?.immutableVerified, 4);
        (0, assert_1.equal)(published.result.publication?.manifestResult, "REPLACED");
        const puts = adapter.calls.filter(call => call.op === "put");
        (0, assert_1.deepStrictEqual)(puts.slice(0, 2).map(call => call.key), [fixture.objects[1].objectKey, fixture.objects[2].objectKey]);
        (0, assert_1.deepStrictEqual)(puts.slice(0, 2).map(call => call.condition), [{ IfNoneMatch: "*" }, { IfNoneMatch: "*" }]);
        (0, assert_1.equal)(puts[2].key, taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_REMOTE_MANIFEST_KEY);
        (0, assert_1.deepStrictEqual)(puts[2].condition, { IfMatch: "\"manifest-old\"" });
        const lastPutIndex = adapter.calls.map(call => call.op).lastIndexOf("put");
        (0, assert_1.ok)(adapter.calls.slice(0, lastPutIndex).filter(call => call.op === "read").length >= 7);
        (0, assert_1.equal)(published.result.publication?.deleteCount, 0);
        (0, assert_1.equal)(published.result.publication?.rollbackAttempted, false);
    });
    it("fails direct metadata conflicts and accepts 409/412 immutable races only after exact reread", async () => {
        const conflictFixture = await makeFixture(temporary);
        const conflictDry = await runHarness(api, temporary, { fixture: conflictFixture });
        const conflictAdapter = seedAdapter(conflictFixture);
        conflictAdapter.objects.get(conflictFixture.objects[0].objectKey).cacheControl = "no-store";
        await (0, assert_1.rejects)(() => runHarness(api, temporary, {
            fixture: conflictFixture, mode: "publish", confirmation: conflictDry.result.publicationId, adapter: conflictAdapter,
        }), /immutable bytes or metadata conflict/);
        const hashFixture = await makeFixture(temporary);
        const hashDry = await runHarness(api, temporary, { fixture: hashFixture });
        const hashAdapter = seedAdapter(hashFixture);
        hashAdapter.objects.get(hashFixture.objects[0].objectKey).bytes = Buffer.from("wrong");
        await (0, assert_1.rejects)(() => runHarness(api, temporary, {
            fixture: hashFixture, mode: "publish", confirmation: hashDry.result.publicationId, adapter: hashAdapter,
        }), /immutable bytes or metadata conflict/);
        const raceFixture = await makeFixture(temporary);
        const raceDry = await runHarness(api, temporary, { fixture: raceFixture });
        const raceAdapter = seedAdapter(raceFixture);
        raceAdapter.raceKeys.add(raceFixture.objects[1].objectKey);
        const raced = await runHarness(api, temporary, {
            fixture: raceFixture, mode: "publish", confirmation: raceDry.result.publicationId, adapter: raceAdapter,
        });
        (0, assert_1.equal)(raced.result.publication?.immutableUploaded, 1);
        (0, assert_1.equal)(raced.result.publication?.immutableReused, 3);
        const manifestRaceFixture = await makeFixture(temporary);
        const manifestRaceDry = await runHarness(api, temporary, { fixture: manifestRaceFixture });
        const manifestRaceAdapter = seedAdapter(manifestRaceFixture);
        manifestRaceAdapter.raceKeys.add(taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_REMOTE_MANIFEST_KEY);
        const manifestRace = await runHarness(api, temporary, {
            fixture: manifestRaceFixture, mode: "publish", confirmation: manifestRaceDry.result.publicationId,
            adapter: manifestRaceAdapter,
        });
        (0, assert_1.equal)(manifestRace.result.publication?.manifestPromoted, false);
        (0, assert_1.equal)(manifestRace.result.publication?.manifestResult, "CONCURRENT_IDEMPOTENT_COMPLETION");
    });
    it("revalidates all local source after immutable verification and stops drift before manifest", async () => {
        const fixture = await makeFixture(temporary);
        const dry = await runHarness(api, temporary, { fixture });
        const adapter = seedAdapter(fixture);
        const outputRoot = await (0, promises_1.mkdtemp)((0, path_1.join)(temporary, "pre-manifest-drift-"));
        let k37Reads = 0;
        globalThis[Symbol.for("dokkan.k40.k39")] = () => fixture.k39Result;
        globalThis[Symbol.for("dokkan.k40.k37")] = () => {
            k37Reads++;
            return k37Reads === 3 ? { ...fixture.k37, receipt: { changedBeforeManifest: true } } : fixture.k37;
        };
        globalThis[Symbol.for("dokkan.k40.k36")] = () => fixture.k36;
        globalThis[Symbol.for("dokkan.k40.s3")] = () => adapter;
        await (0, assert_1.rejects)(() => api.runTaxonomyProjectionPublisher({
            optInK40: true, remote: true, mode: "publish", confirmPublicationId: dry.result.publicationId,
            ...roots, outputRoot, checkedAt: CHECKED_AT,
        }), /local source drifted before mutable manifest promotion/);
        (0, assert_1.equal)(adapter.calls.some(call => call.op === "put" && call.key === taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_REMOTE_MANIFEST_KEY), false);
        (0, assert_1.equal)(adapter.calls.some(call => call.op === "delete"), false);
    });
    it("directly reverifies all immutable objects immediately before the mutable manifest", async () => {
        const fixture = await makeFixture(temporary);
        const dry = await runHarness(api, temporary, { fixture });
        const adapter = seedAdapter(fixture);
        const originalRead = adapter.read.bind(adapter);
        let firstObjectReads = 0;
        adapter.read = async (key) => {
            const observed = await originalRead(key);
            if (key === fixture.objects[0].objectKey && ++firstObjectReads === 2) {
                return { ...observed, bytes: Buffer.from("changed-after-initial-verification") };
            }
            return observed;
        };
        await (0, assert_1.rejects)(() => runHarness(api, temporary, {
            fixture, mode: "publish", confirmation: dry.result.publicationId, adapter,
        }), /immutable changed before mutable manifest promotion/);
        (0, assert_1.equal)(adapter.calls.some(call => call.op === "put" && call.key === taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_REMOTE_MANIFEST_KEY), false);
    });
    it("rereads manifest after source validation, fails nonexact freshness drift, and accepts exact concurrent completion", async () => {
        const changedFixture = await makeFixture(temporary);
        const changedDry = await runHarness(api, temporary, { fixture: changedFixture });
        const changedAdapter = seedAdapter(changedFixture);
        changedAdapter.manifestFreshOverride = {
            bytes: Buffer.from("someone-else"), etag: "\"new-etag\"", contentType: "application/json", cacheControl: "no-store",
        };
        await (0, assert_1.rejects)(() => runHarness(api, temporary, {
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
        (0, assert_1.equal)(exact.result.publication?.manifestResult, "CONCURRENT_IDEMPOTENT_COMPLETION");
        (0, assert_1.equal)(exactAdapter.calls.filter(call => call.op === "put" && call.key === taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_REMOTE_MANIFEST_KEY).length, 0);
    });
    it("requires rebuilt publication confirmation before S3 construction", async () => {
        const fixture = await makeFixture(temporary);
        let adapterCalls = 0;
        const outputRoot = await (0, promises_1.mkdtemp)((0, path_1.join)(temporary, "bad-confirm-"));
        globalThis[Symbol.for("dokkan.k40.k39")] = () => fixture.k39Result;
        globalThis[Symbol.for("dokkan.k40.k37")] = () => fixture.k37;
        globalThis[Symbol.for("dokkan.k40.k36")] = () => fixture.k36;
        globalThis[Symbol.for("dokkan.k40.s3")] = () => { adapterCalls++; return seedAdapter(fixture); };
        await (0, assert_1.rejects)(() => api.runTaxonomyProjectionPublisher({
            optInK40: true, remote: true, mode: "publish", confirmPublicationId: "e".repeat(64),
            ...roots, outputRoot, checkedAt: CHECKED_AT,
        }), /confirmation ID does not match/);
        (0, assert_1.equal)(adapterCalls, 0);
    });
    it("persists one bounded content-addressed create-only report and rejects linked namespaces", async function () {
        const run = await runHarness(api, temporary);
        const stored = await (0, promises_1.readFile)(run.result.reportPath);
        (0, assert_1.ok)(stored.length < taxonomy_projection_publisher_contract_1.TAXONOMY_PROJECTION_PUBLISHER_MAX_REPORT_BYTES);
        (0, assert_1.equal)(sha256(stored), run.result.reportSha256);
        (0, assert_1.equal)((0, path_1.basename)(run.result.reportPath), taxonomy_projection_publisher_contract_1.TAXONOMY_PROJECTION_PUBLISHER_REPORT_FILE);
        (0, assert_1.equal)((0, path_1.basename)(run.result.reportDirectory), run.result.reportSha256);
        await (0, assert_1.rejects)(() => runHarness(api, temporary, { fixture: run.fixture, outputRoot: run.outputRoot }), /create-only report/);
        const externalReport = (0, path_1.join)(temporary, "external-k40-report");
        await (0, promises_1.writeFile)(externalReport, "external");
        await (0, promises_1.rm)(run.result.reportPath);
        await (0, promises_1.link)(externalReport, run.result.reportPath);
        await (0, assert_1.rejects)(() => runHarness(api, temporary, { fixture: run.fixture, outputRoot: run.outputRoot }), /existing report file identity rejected/);
        const root = await (0, promises_1.mkdtemp)((0, path_1.join)(temporary, "junction-root-"));
        const external = await (0, promises_1.mkdtemp)((0, path_1.join)(temporary, "junction-external-"));
        try {
            await (0, promises_1.symlink)(external, (0, path_1.join)(root, taxonomy_projection_publisher_contract_1.TAXONOMY_PROJECTION_PUBLISHER_NAMESPACE), "junction");
        }
        catch (error) {
            if (error?.code === "EPERM" || error?.code === "EACCES") {
                this.skip();
                return;
            }
            throw error;
        }
        let k39Calls = 0;
        globalThis[Symbol.for("dokkan.k40.k39")] = () => { k39Calls++; return run.fixture.k39Result; };
        await (0, assert_1.rejects)(() => api.runTaxonomyProjectionPublisher({
            optInK40: true, remote: true, mode: "dry-run", ...roots, outputRoot: root, checkedAt: CHECKED_AT,
        }), /link|junction|regular directory/);
        (0, assert_1.equal)(k39Calls, 0);
    });
});
//# sourceMappingURL=taxonomy-projection-publisher.spec.js.map