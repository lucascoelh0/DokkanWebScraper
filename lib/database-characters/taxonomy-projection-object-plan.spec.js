"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = require("crypto");
const assert_1 = require("assert");
const promises_1 = require("fs/promises");
const ModuleApi = require("module");
const os_1 = require("os");
const path_1 = require("path");
const typescript_1 = require("typescript");
const taxonomy_projection_object_plan_contract_1 = require("./taxonomy-projection-object-plan-contract");
const objectPlanApi = require("./taxonomy-projection-object-plan");
const taxonomy_projection_object_plan_run_1 = require("./taxonomy-projection-object-plan-run");
const taxonomy_projection_contract_1 = require("./taxonomy-projection-contract");
const DELIVERY_HOOK = Symbol.for("dokkan.k37.taxonomy-projection-object-plan.delivery-reader");
const K36_RELEASE_ID = "a".repeat(64);
const hash = (bytes) => (0, crypto_1.createHash)("sha256").update(bytes).digest("hex");
const jsonBytes = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
function fakeDelivery(options = {}) {
    const payloadSha256 = hash(options.payloadSeed ?? "synthetic-k35-payload");
    const hashes = [payloadSha256, hash("coverage"), hash("validation"), hash("manifest")];
    const sizes = options.sizes ?? [101, 102, 103, 104];
    const payloadName = options.payloadName ?? `database-characters-k35-taxonomy-projection.${payloadSha256}.json.gz`;
    const entries = [
        { kind: "payload", fileName: payloadName, sha256: hashes[0], sizeBytes: sizes[0] },
        { kind: "coverage", fileName: taxonomy_projection_contract_1.TAXONOMY_PROJECTION_FILES.coverage, sha256: hashes[1], sizeBytes: sizes[1] },
        { kind: "validation", fileName: taxonomy_projection_contract_1.TAXONOMY_PROJECTION_FILES.validation, sha256: hashes[2], sizeBytes: sizes[2] },
        { kind: "manifest", fileName: taxonomy_projection_contract_1.TAXONOMY_PROJECTION_FILES.manifest, sha256: hashes[3], sizeBytes: sizes[3] },
    ];
    if (options.duplicateInventory)
        entries[1] = { ...entries[0], kind: "coverage" };
    const lineage = {
        profileId: options.lineageProfile ?? "synthetic-k37-source-profile",
        k32: { sourceBoundValidation: "GO" },
        k2: { manifestSha256: "1".repeat(64) },
        k34: { inProcessValidation: "GO" },
        sqlite: { sha256: "2".repeat(64), sizeBytes: 1 },
        db1: { sha256: "3".repeat(64), sizeBytes: 1, uncompressedSizeBytes: 1 },
        elf: { sha256: "4".repeat(64), sizeBytes: 1, format: "ELF64" },
        nativeLayout: { sha256: "5".repeat(64), sizeBytes: 1 },
    };
    const receipt = {
        schemaVersion: 1,
        contract: "dokkan-database-character-taxonomy-projection-delivery-k36",
        contractVersion: "1.0.0",
        releaseId: K36_RELEASE_ID,
        generatedAt: "2026-08-14T00:00:00.000Z",
        datasetVersion: "synthetic-k35-v1",
        source: {
            k35: {
                contract: "dokkan-database-character-taxonomy-projection-manifest",
                contractVersion: "1.0.0",
                manifestSha256: entries[3].sha256, manifestSizeBytes: entries[3].sizeBytes,
                payloadSha256: entries[0].sha256, payloadSizeBytes: entries[0].sizeBytes,
                rawSha256: hash("raw"), rawSizeBytes: 999,
                coverageSha256: entries[1].sha256, coverageSizeBytes: entries[1].sizeBytes,
                validationSha256: entries[2].sha256, validationSizeBytes: entries[2].sizeBytes,
                lineage,
            },
        },
        inventory: { closed: true, artifactCount: 4, entries },
    };
    return {
        releaseDirectory: "X:/validated/k36/release",
        releaseId: K36_RELEASE_ID,
        receipt,
        marker: { contract: "synthetic-k36-marker", releaseId: K36_RELEASE_ID, files: {} },
        sourceBoundK35Validation: "GO",
        peakRssBytes: options.peakRssBytes ?? process.memoryUsage().rss,
    };
}
async function loadInstrumentedObjectPlan() {
    const parent = (0, path_1.resolve)(__dirname, "..");
    const compiledRun = (0, path_1.basename)(parent).toLowerCase() === "lib";
    const sourceRoot = compiledRun ? (0, path_1.resolve)(parent, "..") : parent;
    const sourcePath = (0, path_1.join)(sourceRoot, "database-characters", "taxonomy-projection-object-plan.ts");
    const runtimePath = compiledRun
        ? (0, path_1.join)(parent, "database-characters", "taxonomy-projection-object-plan.js")
        : (0, path_1.join)(sourceRoot, "database-characters", ".taxonomy-projection-object-plan.test-runtime.js");
    const source = await (0, promises_1.readFile)(sourcePath, "utf8");
    const instrumented = source
        .replace(/readValidatedTaxonomyProjectionDelivery\(/g, "__testReadValidatedTaxonomyProjectionDelivery(")
        .replace("export interface TaxonomyProjectionObjectPlanSourceOptions", `
const __testReadValidatedTaxonomyProjectionDelivery = (options: unknown) => {
    const hook = (globalThis as any)[Symbol.for("dokkan.k37.taxonomy-projection-object-plan.delivery-reader")];
    if (typeof hook !== "function") throw new Error("K37 test delivery-reader hook missing");
    return hook(options);
};

export interface TaxonomyProjectionObjectPlanSourceOptions`);
    if (instrumented === source || !instrumented.includes("__testReadValidatedTaxonomyProjectionDelivery")) {
        throw new Error("K37 test instrumentation failed");
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
const sourceRoots = {
    k36OutputRoot: "X:/explicit/k36-output",
    k36ReleaseId: K36_RELEASE_ID,
    k32Root: "X:/explicit/k32",
    k2Root: "X:/explicit/k2",
    productiveRoot: "X:/explicit/productive",
    sqliteRoot: "X:/explicit/sqlite",
    db1Root: "X:/explicit/db1",
    elfRoot: "X:/explicit/elf",
    nativeEvidenceRoot: "X:/explicit/native-evidence",
};
function cliArgs(outputRoot = "X:/explicit/k37-output") {
    return [
        "--opt-in-k37",
        "--k36-output-root", sourceRoots.k36OutputRoot,
        "--k36-release-id", sourceRoots.k36ReleaseId,
        "--k32-root", sourceRoots.k32Root,
        "--k2-root", sourceRoots.k2Root,
        "--productive-root", sourceRoots.productiveRoot,
        "--sqlite-root", sourceRoots.sqliteRoot,
        "--db1-root", sourceRoots.db1Root,
        "--elf-root", sourceRoots.elfRoot,
        "--native-evidence-root", sourceRoots.nativeEvidenceRoot,
        "--output-root", outputRoot,
    ];
}
async function planBytes(outputRoot, planId) {
    const directory = (0, path_1.join)(outputRoot, taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_OBJECT_PLAN_NAMESPACE, planId);
    const names = (await (0, promises_1.readdir)(directory)).sort();
    return new Map(await Promise.all(names.map(async (name) => [name, await (0, promises_1.readFile)((0, path_1.join)(directory, name))])));
}
describe("K37 taxonomy projection object plan", () => {
    let temporary;
    let api;
    let calls;
    before(async () => { api = await loadInstrumentedObjectPlan(); });
    beforeEach(async () => {
        temporary = await (0, promises_1.mkdtemp)((0, path_1.join)((0, os_1.tmpdir)(), "dokkan-k37-object-plan-"));
        calls = [];
        global[DELIVERY_HOOK] = async (options) => { calls.push(options); return fakeDelivery(); };
    });
    afterEach(async () => {
        delete global[DELIVERY_HOOK];
        await (0, promises_1.rm)(temporary, { recursive: true, force: true });
    });
    it("requires the exact opt-in, release ID, output roots, and every lineage root without defaults", async () => {
        const parsed = (0, taxonomy_projection_object_plan_run_1.parseTaxonomyProjectionObjectPlanCli)(cliArgs());
        (0, assert_1.equal)(parsed.optIn, true);
        (0, assert_1.equal)(parsed.k36OutputRoot, sourceRoots.k36OutputRoot);
        (0, assert_1.equal)(parsed.k36ReleaseId, K36_RELEASE_ID);
        (0, assert_1.equal)(parsed.outputRoot, "X:/explicit/k37-output");
        for (const args of [
            cliArgs().filter(value => value !== "--opt-in-k37"),
            [...cliArgs(), "--opt-in-k37"],
            cliArgs().filter((_, index, values) => index !== values.indexOf("--db1-root") && index !== values.indexOf("--db1-root") + 1),
            [...cliArgs(), "--publish"],
            ["--opt-in-k37", "--output-root=implicit"],
        ])
            (0, assert_1.throws)(() => (0, taxonomy_projection_object_plan_run_1.parseTaxonomyProjectionObjectPlanCli)(args), /K37|missing|unsupported|duplicate/);
        await (0, assert_1.rejects)(api.runTaxonomyProjectionObjectPlan({ optIn: false, outputRoot: temporary, ...sourceRoots }), /explicit opt-in/);
        (0, assert_1.equal)(calls.length, 0);
    });
    it("creates deterministic marker-last plans for exactly four immutable objects and one no-store manifest candidate", async () => {
        const firstRoot = (0, path_1.join)(temporary, "first");
        const secondRoot = (0, path_1.join)(temporary, "second");
        await Promise.all([(0, promises_1.mkdir)(firstRoot), (0, promises_1.mkdir)(secondRoot)]);
        const first = await api.runTaxonomyProjectionObjectPlan({ optIn: true, outputRoot: firstRoot, ...sourceRoots });
        const second = await api.runTaxonomyProjectionObjectPlan({ optIn: true, outputRoot: secondRoot, ...sourceRoots });
        (0, assert_1.equal)(first.planId, second.planId);
        (0, assert_1.equal)(first.plan.objects.length, 4);
        (0, assert_1.equal)(first.manifestCandidate.inventory.artifactCount, 4);
        (0, assert_1.equal)(first.plan.remoteNamespace, taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_REMOTE_NAMESPACE);
        (0, assert_1.equal)(first.plan.mutableManifest.objectKey, taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_REMOTE_MANIFEST_KEY);
        (0, assert_1.equal)(first.plan.mutableManifest.cacheControl, "no-store");
        (0, assert_1.equal)(first.manifestCandidate.cacheControl, "no-store");
        (0, assert_1.equal)(first.plan.budget.remoteBucketBytes, "UNKNOWN");
        (0, assert_1.equal)(first.plan.budget.withinBucketCeiling, "UNKNOWN");
        (0, assert_1.equal)(first.receipt.state, "STOPPED_BEFORE_REMOTE_PREFLIGHT");
        (0, assert_1.ok)(first.plan.objects.every(object => object.cacheControl.endsWith("immutable")
            && object.contentAddressed && object.objectKey.includes(`/sha256/${object.sha256}/`)));
        (0, assert_1.equal)(new Set(first.plan.objects.map(object => object.objectKey)).size, 4);
        (0, assert_1.equal)(calls.length, 4);
        for (const call of calls) {
            (0, assert_1.equal)(call.outputRoot, sourceRoots.k36OutputRoot);
            (0, assert_1.equal)(call.releaseId, sourceRoots.k36ReleaseId);
            for (const name of ["k32Root", "k2Root", "productiveRoot", "sqliteRoot", "db1Root", "elfRoot", "nativeEvidenceRoot"]) {
                (0, assert_1.equal)(call[name], sourceRoots[name]);
            }
        }
        const firstFiles = await planBytes(firstRoot, first.planId);
        const secondFiles = await planBytes(secondRoot, second.planId);
        (0, assert_1.equal)(firstFiles.size, 4);
        (0, assert_1.equal)(JSON.stringify([...firstFiles.keys()]), JSON.stringify([...secondFiles.keys()]));
        for (const [name, bytes] of firstFiles)
            (0, assert_1.ok)(bytes.equals(secondFiles.get(name)), name);
        const marker = JSON.parse(firstFiles.get(taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_OBJECT_PLAN_MARKER).toString("utf8"));
        (0, assert_1.equal)(marker.inventory.closed, true);
        (0, assert_1.equal)(marker.inventory.markerWrittenLast, true);
        (0, assert_1.equal)(JSON.stringify(marker.inventory.expectedNames), JSON.stringify([...firstFiles.keys()].sort()));
        const markerStat = await (0, promises_1.stat)((0, path_1.join)(first.planDirectory, taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_OBJECT_PLAN_MARKER));
        for (const name of [...firstFiles.keys()].filter(name => name !== taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_OBJECT_PLAN_MARKER)) {
            (0, assert_1.ok)(markerStat.birthtimeMs >= (await (0, promises_1.stat)((0, path_1.join)(first.planDirectory, name))).birthtimeMs);
        }
    });
    it("rejects K36 artifact-byte or lineage drift before committing the marker", async () => {
        for (const [name, changed] of [
            ["bytes", fakeDelivery({ payloadSeed: "changed-payload" })],
            ["lineage", fakeDelivery({ lineageProfile: "changed-lineage" })],
        ]) {
            const root = (0, path_1.join)(temporary, name);
            await (0, promises_1.mkdir)(root);
            let count = 0;
            global[DELIVERY_HOOK] = async (options) => {
                calls.push(options);
                count++;
                return count === 1 ? fakeDelivery() : changed;
            };
            await (0, assert_1.rejects)(api.runTaxonomyProjectionObjectPlan({ optIn: true, outputRoot: root, ...sourceRoots }), /source bytes or lineage changed/);
            const namespace = (0, path_1.join)(root, taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_OBJECT_PLAN_NAMESPACE);
            (0, assert_1.equal)((await (0, promises_1.readdir)(namespace)).length, 0);
        }
    });
    it("rejects traversal, absolute and mixed-separator identities, malformed inventory, and duplicate keys", async () => {
        for (const planId of ["../escape", (0, path_1.resolve)(temporary, "absolute"), `a${"/b".repeat(40)}`, `a${"\\b".repeat(40)}`]) {
            await (0, assert_1.rejects)(api.readValidatedTaxonomyProjectionObjectPlan({ outputRoot: temporary, planId, ...sourceRoots }), /canonical plan ID/);
        }
        for (const payloadName of ["../payload.json.gz", "folder\\payload.json.gz", "C:\\payload.json.gz"]) {
            global[DELIVERY_HOOK] = async () => fakeDelivery({ payloadName });
            await (0, assert_1.rejects)(api.runTaxonomyProjectionObjectPlan({ optIn: true, outputRoot: temporary, ...sourceRoots }), /inventory name/);
        }
        global[DELIVERY_HOOK] = async () => fakeDelivery({ duplicateInventory: true });
        await (0, assert_1.rejects)(api.runTaxonomyProjectionObjectPlan({ optIn: true, outputRoot: temporary, ...sourceRoots }), /inventory|duplicate/);
    });
    it("accepts the conservative 50 MB boundary and rejects one byte above it", async () => {
        const fixed = [1, 1, 1];
        const atLimit = taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_OBJECT_PLAN_NAMESPACE_MAX_BYTES
            - taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_OBJECT_PLAN_MANIFEST_RESERVATION_BYTES - fixed.reduce((sum, value) => sum + value, 0);
        const exactRoot = (0, path_1.join)(temporary, "exact");
        const overRoot = (0, path_1.join)(temporary, "over");
        await Promise.all([(0, promises_1.mkdir)(exactRoot), (0, promises_1.mkdir)(overRoot)]);
        global[DELIVERY_HOOK] = async () => fakeDelivery({ sizes: [atLimit, ...fixed] });
        const exact = await api.runTaxonomyProjectionObjectPlan({ optIn: true, outputRoot: exactRoot, ...sourceRoots });
        (0, assert_1.equal)(exact.plan.budget.worstCaseNewBytes, taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_OBJECT_PLAN_NAMESPACE_MAX_BYTES);
        (0, assert_1.equal)(exact.plan.budget.withinNamespaceLimit, true);
        global[DELIVERY_HOOK] = async () => fakeDelivery({ sizes: [atLimit + 1, ...fixed] });
        await (0, assert_1.rejects)(api.runTaxonomyProjectionObjectPlan({ optIn: true, outputRoot: overRoot, ...sourceRoots }), /namespace budget exceeded/);
        (0, assert_1.equal)((await (0, promises_1.readdir)(overRoot)).length, 0);
    });
    it("is create-only and preserves existing plan bytes and unrelated output files", async () => {
        const first = await api.runTaxonomyProjectionObjectPlan({ optIn: true, outputRoot: temporary, ...sourceRoots });
        const before = await planBytes(temporary, first.planId);
        const unrelated = (0, path_1.join)(temporary, "caller-owned.txt");
        await (0, promises_1.writeFile)(unrelated, "keep\n");
        await (0, assert_1.rejects)(api.runTaxonomyProjectionObjectPlan({ optIn: true, outputRoot: temporary, ...sourceRoots }), /already exists/);
        const after = await planBytes(temporary, first.planId);
        for (const [name, bytes] of before)
            (0, assert_1.ok)(bytes.equals(after.get(name)), name);
        (0, assert_1.equal)(await (0, promises_1.readFile)(unrelated, "utf8"), "keep\n");
    });
    it("rejects closed-inventory violations and hard-linked members through the source-bound reader", async () => {
        const unexpectedRoot = (0, path_1.join)(temporary, "unexpected");
        const hardlinkRoot = (0, path_1.join)(temporary, "hardlink");
        const byteRoot = (0, path_1.join)(temporary, "byte");
        await Promise.all([(0, promises_1.mkdir)(unexpectedRoot), (0, promises_1.mkdir)(hardlinkRoot), (0, promises_1.mkdir)(byteRoot)]);
        const unexpected = await api.runTaxonomyProjectionObjectPlan({ optIn: true, outputRoot: unexpectedRoot, ...sourceRoots });
        await (0, promises_1.writeFile)((0, path_1.join)(unexpected.planDirectory, "unexpected.txt"), "foreign\n");
        await (0, assert_1.rejects)(api.readValidatedTaxonomyProjectionObjectPlan({
            outputRoot: unexpectedRoot, planId: unexpected.planId, ...sourceRoots,
        }), /closed local inventory/);
        (0, assert_1.equal)(await (0, promises_1.readFile)((0, path_1.join)(unexpected.planDirectory, "unexpected.txt"), "utf8"), "foreign\n");
        const hardlinked = await api.runTaxonomyProjectionObjectPlan({ optIn: true, outputRoot: hardlinkRoot, ...sourceRoots });
        const member = (0, path_1.join)(hardlinked.planDirectory, taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_OBJECT_PLAN_FILE);
        const outside = (0, path_1.join)(temporary, "outside-plan");
        const bytes = await (0, promises_1.readFile)(member);
        await (0, promises_1.unlink)(member);
        await (0, promises_1.writeFile)(outside, bytes);
        await (0, promises_1.link)(outside, member);
        await (0, assert_1.rejects)(api.readValidatedTaxonomyProjectionObjectPlan({
            outputRoot: hardlinkRoot, planId: hardlinked.planId, ...sourceRoots,
        }), /single-link/);
        (0, assert_1.ok)((await (0, promises_1.readFile)(outside)).equals(bytes));
        const changed = await api.runTaxonomyProjectionObjectPlan({ optIn: true, outputRoot: byteRoot, ...sourceRoots });
        await (0, promises_1.writeFile)((0, path_1.join)(changed.planDirectory, taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_REMOTE_MANIFEST_CANDIDATE_FILE), "{}\n");
        await (0, assert_1.rejects)(api.readValidatedTaxonomyProjectionObjectPlan({
            outputRoot: byteRoot, planId: changed.planId, ...sourceRoots,
        }), /bytes or source lineage mismatch/);
    });
    it("rejects a junction output root when the platform permits it", async function () {
        const target = (0, path_1.join)(temporary, "target");
        const linkedRoot = (0, path_1.join)(temporary, "linked-root");
        await (0, promises_1.mkdir)(target);
        try {
            await (0, promises_1.symlink)(target, linkedRoot, process.platform === "win32" ? "junction" : "dir");
        }
        catch (error) {
            if (["EPERM", "EACCES", "UNKNOWN"].includes(error?.code)) {
                this.skip();
                return;
            }
            throw error;
        }
        await (0, assert_1.rejects)(api.runTaxonomyProjectionObjectPlan({ optIn: true, outputRoot: linkedRoot, ...sourceRoots }), /non-link|junction/);
    });
    it("rejects a symlinked member when the platform permits it", async function () {
        const output = (0, path_1.join)(temporary, "symlink-output");
        await (0, promises_1.mkdir)(output);
        const result = await api.runTaxonomyProjectionObjectPlan({ optIn: true, outputRoot: output, ...sourceRoots });
        const member = (0, path_1.join)(result.planDirectory, taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_OBJECT_PLAN_RECEIPT);
        const outside = (0, path_1.join)(temporary, "outside-receipt");
        await (0, promises_1.writeFile)(outside, await (0, promises_1.readFile)(member));
        await (0, promises_1.unlink)(member);
        try {
            await (0, promises_1.symlink)(outside, member, "file");
        }
        catch (error) {
            if (["EPERM", "EACCES", "UNKNOWN"].includes(error?.code)) {
                this.skip();
                return;
            }
            throw error;
        }
        await (0, assert_1.rejects)(api.readValidatedTaxonomyProjectionObjectPlan({
            outputRoot: output, planId: result.planId, ...sourceRoots,
        }), /single-link|realpath/);
    });
    it("enforces the exclusive RSS limit and bounds public errors", async () => {
        global[DELIVERY_HOOK] = async () => fakeDelivery({ peakRssBytes: taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_OBJECT_PLAN_RSS_LIMIT_BYTES });
        await (0, assert_1.rejects)(api.runTaxonomyProjectionObjectPlan({ optIn: true, outputRoot: temporary, ...sourceRoots }), /RSS limit reached/);
        global[DELIVERY_HOOK] = async () => { throw new Error("x".repeat(2048)); };
        try {
            await api.runTaxonomyProjectionObjectPlan({ optIn: true, outputRoot: temporary, ...sourceRoots });
        }
        catch (error) {
            (0, assert_1.ok)(error.message.length <= taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_OBJECT_PLAN_MAX_ERROR_LENGTH);
        }
    });
    it("exports only source-bound planning APIs and contains no network, publisher, consumer, or remote mutation path", async () => {
        (0, assert_1.strictEqual)(objectPlanApi.buildBundle, undefined);
        (0, assert_1.strictEqual)(objectPlanApi.materializeBundle, undefined);
        (0, assert_1.strictEqual)(objectPlanApi.validateLocalBundle, undefined);
        (0, assert_1.strictEqual)(objectPlanApi.writeExclusive, undefined);
        (0, assert_1.strictEqual)(objectPlanApi.readValidatedTaxonomyProjectionDelivery, undefined);
        const sourceDirectory = (0, path_1.resolve)(__dirname, (0, path_1.basename)((0, path_1.resolve)(__dirname, "..")) === "lib" ? "../../database-characters" : ".");
        const sources = await Promise.all([
            "taxonomy-projection-object-plan-contract.ts",
            "taxonomy-projection-object-plan.ts",
            "taxonomy-projection-object-plan-run.ts",
        ].map(name => (0, promises_1.readFile)((0, path_1.join)(sourceDirectory, name), "utf8")));
        const combined = sources.join("\n");
        (0, assert_1.ok)(combined.includes("readValidatedTaxonomyProjectionDelivery"));
        (0, assert_1.ok)(combined.includes("new Set(objects.map(object => object.objectKey)).size !== 4"));
        (0, assert_1.equal)(/from ["'][^"']*(?:publisher|publish|wrangler|s3)[^"']*["']/i.test(combined), false);
        (0, assert_1.equal)(/\bfetch\s*\(|https?:\/\//i.test(combined), false);
        (0, assert_1.equal)(/\bCharacter(?:\[\]|\b)/.test(combined), false);
        (0, assert_1.equal)(/export (?:async )?function (?:build|materialize|write|publish|apply|overlay|validateLocal)/.test(combined), false);
        (0, assert_1.equal)(/PutObject|ListObjects|HeadObject|DeleteObject|axios|node-fetch/.test(combined), false);
        (0, assert_1.equal)(combined.includes(taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_REMOTE_MANIFEST_CANDIDATE_FILE), true);
    });
});
//# sourceMappingURL=taxonomy-projection-object-plan.spec.js.map