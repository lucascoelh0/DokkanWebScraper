import { createHash } from "crypto";
import { equal, ok, rejects, strictEqual, throws } from "assert";
import { link, mkdir, mkdtemp, readFile, readdir, rm, stat, symlink, unlink, writeFile } from "fs/promises";
import * as ModuleApi from "module";
import { tmpdir } from "os";
import { basename, dirname, join, resolve } from "path";
import { ModuleKind, ScriptTarget, transpileModule } from "typescript";
import {
    TAXONOMY_PROJECTION_OBJECT_PLAN_FILE,
    TAXONOMY_PROJECTION_OBJECT_PLAN_MANIFEST_RESERVATION_BYTES,
    TAXONOMY_PROJECTION_OBJECT_PLAN_MARKER,
    TAXONOMY_PROJECTION_OBJECT_PLAN_MAX_ERROR_LENGTH,
    TAXONOMY_PROJECTION_OBJECT_PLAN_NAMESPACE,
    TAXONOMY_PROJECTION_OBJECT_PLAN_NAMESPACE_MAX_BYTES,
    TAXONOMY_PROJECTION_OBJECT_PLAN_RECEIPT,
    TAXONOMY_PROJECTION_OBJECT_PLAN_RSS_LIMIT_BYTES,
    TAXONOMY_PROJECTION_REMOTE_MANIFEST_CANDIDATE_FILE,
    TAXONOMY_PROJECTION_REMOTE_MANIFEST_KEY,
    TAXONOMY_PROJECTION_REMOTE_NAMESPACE,
} from "./taxonomy-projection-object-plan-contract";
import * as objectPlanApi from "./taxonomy-projection-object-plan";
import { parseTaxonomyProjectionObjectPlanCli } from "./taxonomy-projection-object-plan-run";
import { TAXONOMY_PROJECTION_FILES } from "./taxonomy-projection-contract";

const DELIVERY_HOOK = Symbol.for("dokkan.k37.taxonomy-projection-object-plan.delivery-reader");
const K36_RELEASE_ID = "a".repeat(64);
const hash = (bytes: Buffer | string): string => createHash("sha256").update(bytes).digest("hex");
const jsonBytes = (value: unknown): Buffer => Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");

function fakeDelivery(options: {
    payloadSeed?: string;
    lineageProfile?: string;
    sizes?: [number, number, number, number];
    payloadName?: string;
    duplicateInventory?: boolean;
    peakRssBytes?: number;
} = {}) {
    const payloadSha256 = hash(options.payloadSeed ?? "synthetic-k35-payload");
    const hashes = [payloadSha256, hash("coverage"), hash("validation"), hash("manifest")];
    const sizes = options.sizes ?? [101, 102, 103, 104];
    const payloadName = options.payloadName ?? `database-characters-k35-taxonomy-projection.${payloadSha256}.json.gz`;
    const entries = [
        { kind: "payload", fileName: payloadName, sha256: hashes[0], sizeBytes: sizes[0] },
        { kind: "coverage", fileName: TAXONOMY_PROJECTION_FILES.coverage, sha256: hashes[1], sizeBytes: sizes[1] },
        { kind: "validation", fileName: TAXONOMY_PROJECTION_FILES.validation, sha256: hashes[2], sizeBytes: sizes[2] },
        { kind: "manifest", fileName: TAXONOMY_PROJECTION_FILES.manifest, sha256: hashes[3], sizeBytes: sizes[3] },
    ] as any[];
    if (options.duplicateInventory) entries[1] = { ...entries[0], kind: "coverage" };
    const lineage = {
        profileId: options.lineageProfile ?? "synthetic-k37-source-profile",
        k32: { sourceBoundValidation: "GO" },
        k2: { manifestSha256: "1".repeat(64) },
        k34: { inProcessValidation: "GO" },
        sqlite: { sha256: "2".repeat(64), sizeBytes: 1 },
        db1: { sha256: "3".repeat(64), sizeBytes: 1, uncompressedSizeBytes: 1 },
        elf: { sha256: "4".repeat(64), sizeBytes: 1, format: "ELF64" },
        nativeLayout: { sha256: "5".repeat(64), sizeBytes: 1 },
    } as any;
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
    } as any;
    return {
        releaseDirectory: "X:/validated/k36/release",
        releaseId: K36_RELEASE_ID,
        receipt,
        marker: { contract: "synthetic-k36-marker", releaseId: K36_RELEASE_ID, files: {} },
        sourceBoundK35Validation: "GO",
        peakRssBytes: options.peakRssBytes ?? process.memoryUsage().rss,
    } as any;
}

type InstrumentedObjectPlan = typeof objectPlanApi;

async function loadInstrumentedObjectPlan(): Promise<InstrumentedObjectPlan> {
    const parent = resolve(__dirname, "..");
    const compiledRun = basename(parent).toLowerCase() === "lib";
    const sourceRoot = compiledRun ? resolve(parent, "..") : parent;
    const sourcePath = join(sourceRoot, "database-characters", "taxonomy-projection-object-plan.ts");
    const runtimePath = compiledRun
        ? join(parent, "database-characters", "taxonomy-projection-object-plan.js")
        : join(sourceRoot, "database-characters", ".taxonomy-projection-object-plan.test-runtime.js");
    const source = await readFile(sourcePath, "utf8");
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
    const compiled = transpileModule(instrumented, {
        compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2022 },
        fileName: sourcePath,
    }).outputText;
    const ModuleConstructor = (ModuleApi as any).default ?? ModuleApi;
    const runtimeModule = new ModuleConstructor(runtimePath, module);
    runtimeModule.filename = runtimePath;
    runtimeModule.paths = ModuleConstructor._nodeModulePaths(dirname(runtimePath));
    runtimeModule._compile(compiled, runtimePath);
    return runtimeModule.exports as InstrumentedObjectPlan;
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

function cliArgs(outputRoot = "X:/explicit/k37-output"): string[] {
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

async function planBytes(outputRoot: string, planId: string): Promise<Map<string, Buffer>> {
    const directory = join(outputRoot, TAXONOMY_PROJECTION_OBJECT_PLAN_NAMESPACE, planId);
    const names = (await readdir(directory)).sort();
    return new Map(await Promise.all(names.map(async name => [name, await readFile(join(directory, name))] as [string, Buffer])));
}

describe("K37 taxonomy projection object plan", () => {
    let temporary: string;
    let api: InstrumentedObjectPlan;
    let calls: any[];

    before(async () => { api = await loadInstrumentedObjectPlan(); });
    beforeEach(async () => {
        temporary = await mkdtemp(join(tmpdir(), "dokkan-k37-object-plan-"));
        calls = [];
        (global as any)[DELIVERY_HOOK] = async (options: any) => { calls.push(options); return fakeDelivery(); };
    });
    afterEach(async () => {
        delete (global as any)[DELIVERY_HOOK];
        await rm(temporary, { recursive: true, force: true });
    });

    it("requires the exact opt-in, release ID, output roots, and every lineage root without defaults", async () => {
        const parsed = parseTaxonomyProjectionObjectPlanCli(cliArgs());
        equal(parsed.optIn, true);
        equal(parsed.k36OutputRoot, sourceRoots.k36OutputRoot);
        equal(parsed.k36ReleaseId, K36_RELEASE_ID);
        equal(parsed.outputRoot, "X:/explicit/k37-output");
        for (const args of [
            cliArgs().filter(value => value !== "--opt-in-k37"),
            [...cliArgs(), "--opt-in-k37"],
            cliArgs().filter((_, index, values) => index !== values.indexOf("--db1-root") && index !== values.indexOf("--db1-root") + 1),
            [...cliArgs(), "--publish"],
            ["--opt-in-k37", "--output-root=implicit"],
        ]) throws(() => parseTaxonomyProjectionObjectPlanCli(args), /K37|missing|unsupported|duplicate/);
        await rejects(api.runTaxonomyProjectionObjectPlan({ optIn: false, outputRoot: temporary, ...sourceRoots } as any), /explicit opt-in/);
        equal(calls.length, 0);
    });

    it("creates deterministic marker-last plans for exactly four immutable objects and one no-store manifest candidate", async () => {
        const firstRoot = join(temporary, "first");
        const secondRoot = join(temporary, "second");
        await Promise.all([mkdir(firstRoot), mkdir(secondRoot)]);
        const first = await api.runTaxonomyProjectionObjectPlan({ optIn: true, outputRoot: firstRoot, ...sourceRoots });
        const second = await api.runTaxonomyProjectionObjectPlan({ optIn: true, outputRoot: secondRoot, ...sourceRoots });
        equal(first.planId, second.planId);
        equal(first.plan.objects.length, 4);
        equal(first.manifestCandidate.inventory.artifactCount, 4);
        equal(first.plan.remoteNamespace, TAXONOMY_PROJECTION_REMOTE_NAMESPACE);
        equal(first.plan.mutableManifest.objectKey, TAXONOMY_PROJECTION_REMOTE_MANIFEST_KEY);
        equal(first.plan.mutableManifest.cacheControl, "no-store");
        equal(first.manifestCandidate.cacheControl, "no-store");
        equal(first.plan.budget.remoteBucketBytes, "UNKNOWN");
        equal(first.plan.budget.withinBucketCeiling, "UNKNOWN");
        equal(first.receipt.state, "STOPPED_BEFORE_REMOTE_PREFLIGHT");
        ok(first.plan.objects.every(object => object.cacheControl.endsWith("immutable")
            && object.contentAddressed && object.objectKey.includes(`/sha256/${object.sha256}/`)));
        equal(new Set(first.plan.objects.map(object => object.objectKey)).size, 4);
        equal(calls.length, 4);
        for (const call of calls) {
            equal(call.outputRoot, sourceRoots.k36OutputRoot);
            equal(call.releaseId, sourceRoots.k36ReleaseId);
            for (const name of ["k32Root", "k2Root", "productiveRoot", "sqliteRoot", "db1Root", "elfRoot", "nativeEvidenceRoot"]) {
                equal(call[name], (sourceRoots as any)[name]);
            }
        }
        const firstFiles = await planBytes(firstRoot, first.planId);
        const secondFiles = await planBytes(secondRoot, second.planId);
        equal(firstFiles.size, 4);
        equal(JSON.stringify([...firstFiles.keys()]), JSON.stringify([...secondFiles.keys()]));
        for (const [name, bytes] of firstFiles) ok(bytes.equals(secondFiles.get(name)!), name);
        const marker = JSON.parse(firstFiles.get(TAXONOMY_PROJECTION_OBJECT_PLAN_MARKER)!.toString("utf8"));
        equal(marker.inventory.closed, true);
        equal(marker.inventory.markerWrittenLast, true);
        equal(JSON.stringify(marker.inventory.expectedNames), JSON.stringify([...firstFiles.keys()].sort()));
        const markerStat = await stat(join(first.planDirectory, TAXONOMY_PROJECTION_OBJECT_PLAN_MARKER));
        for (const name of [...firstFiles.keys()].filter(name => name !== TAXONOMY_PROJECTION_OBJECT_PLAN_MARKER)) {
            ok(markerStat.birthtimeMs >= (await stat(join(first.planDirectory, name))).birthtimeMs);
        }
    });

    it("rejects K36 artifact-byte or lineage drift before committing the marker", async () => {
        for (const [name, changed] of [
            ["bytes", fakeDelivery({ payloadSeed: "changed-payload" })],
            ["lineage", fakeDelivery({ lineageProfile: "changed-lineage" })],
        ] as const) {
            const root = join(temporary, name);
            await mkdir(root);
            let count = 0;
            (global as any)[DELIVERY_HOOK] = async (options: any) => {
                calls.push(options);
                count++;
                return count === 1 ? fakeDelivery() : changed;
            };
            await rejects(api.runTaxonomyProjectionObjectPlan({ optIn: true, outputRoot: root, ...sourceRoots }), /source bytes or lineage changed/);
            const namespace = join(root, TAXONOMY_PROJECTION_OBJECT_PLAN_NAMESPACE);
            equal((await readdir(namespace)).length, 0);
        }
    });

    it("rejects traversal, absolute and mixed-separator identities, malformed inventory, and duplicate keys", async () => {
        for (const planId of ["../escape", resolve(temporary, "absolute"), `a${"/b".repeat(40)}`, `a${"\\b".repeat(40)}`]) {
            await rejects(api.readValidatedTaxonomyProjectionObjectPlan({ outputRoot: temporary, planId, ...sourceRoots }), /canonical plan ID/);
        }
        for (const payloadName of ["../payload.json.gz", "folder\\payload.json.gz", "C:\\payload.json.gz"]) {
            (global as any)[DELIVERY_HOOK] = async () => fakeDelivery({ payloadName });
            await rejects(api.runTaxonomyProjectionObjectPlan({ optIn: true, outputRoot: temporary, ...sourceRoots }), /inventory name/);
        }
        (global as any)[DELIVERY_HOOK] = async () => fakeDelivery({ duplicateInventory: true });
        await rejects(api.runTaxonomyProjectionObjectPlan({ optIn: true, outputRoot: temporary, ...sourceRoots }), /inventory|duplicate/);
    });

    it("accepts the conservative 50 MB boundary and rejects one byte above it", async () => {
        const fixed = [1, 1, 1] as const;
        const atLimit = TAXONOMY_PROJECTION_OBJECT_PLAN_NAMESPACE_MAX_BYTES
            - TAXONOMY_PROJECTION_OBJECT_PLAN_MANIFEST_RESERVATION_BYTES - fixed.reduce((sum, value) => sum + value, 0);
        const exactRoot = join(temporary, "exact");
        const overRoot = join(temporary, "over");
        await Promise.all([mkdir(exactRoot), mkdir(overRoot)]);
        (global as any)[DELIVERY_HOOK] = async () => fakeDelivery({ sizes: [atLimit, ...fixed] });
        const exact = await api.runTaxonomyProjectionObjectPlan({ optIn: true, outputRoot: exactRoot, ...sourceRoots });
        equal(exact.plan.budget.worstCaseNewBytes, TAXONOMY_PROJECTION_OBJECT_PLAN_NAMESPACE_MAX_BYTES);
        equal(exact.plan.budget.withinNamespaceLimit, true);
        (global as any)[DELIVERY_HOOK] = async () => fakeDelivery({ sizes: [atLimit + 1, ...fixed] });
        await rejects(api.runTaxonomyProjectionObjectPlan({ optIn: true, outputRoot: overRoot, ...sourceRoots }), /namespace budget exceeded/);
        equal((await readdir(overRoot)).length, 0);
    });

    it("is create-only and preserves existing plan bytes and unrelated output files", async () => {
        const first = await api.runTaxonomyProjectionObjectPlan({ optIn: true, outputRoot: temporary, ...sourceRoots });
        const before = await planBytes(temporary, first.planId);
        const unrelated = join(temporary, "caller-owned.txt");
        await writeFile(unrelated, "keep\n");
        await rejects(api.runTaxonomyProjectionObjectPlan({ optIn: true, outputRoot: temporary, ...sourceRoots }), /already exists/);
        const after = await planBytes(temporary, first.planId);
        for (const [name, bytes] of before) ok(bytes.equals(after.get(name)!), name);
        equal(await readFile(unrelated, "utf8"), "keep\n");
    });

    it("rejects closed-inventory violations and hard-linked members through the source-bound reader", async () => {
        const unexpectedRoot = join(temporary, "unexpected");
        const hardlinkRoot = join(temporary, "hardlink");
        const byteRoot = join(temporary, "byte");
        await Promise.all([mkdir(unexpectedRoot), mkdir(hardlinkRoot), mkdir(byteRoot)]);
        const unexpected = await api.runTaxonomyProjectionObjectPlan({ optIn: true, outputRoot: unexpectedRoot, ...sourceRoots });
        await writeFile(join(unexpected.planDirectory, "unexpected.txt"), "foreign\n");
        await rejects(api.readValidatedTaxonomyProjectionObjectPlan({
            outputRoot: unexpectedRoot, planId: unexpected.planId, ...sourceRoots,
        }), /closed local inventory/);
        equal(await readFile(join(unexpected.planDirectory, "unexpected.txt"), "utf8"), "foreign\n");

        const hardlinked = await api.runTaxonomyProjectionObjectPlan({ optIn: true, outputRoot: hardlinkRoot, ...sourceRoots });
        const member = join(hardlinked.planDirectory, TAXONOMY_PROJECTION_OBJECT_PLAN_FILE);
        const outside = join(temporary, "outside-plan");
        const bytes = await readFile(member);
        await unlink(member);
        await writeFile(outside, bytes);
        await link(outside, member);
        await rejects(api.readValidatedTaxonomyProjectionObjectPlan({
            outputRoot: hardlinkRoot, planId: hardlinked.planId, ...sourceRoots,
        }), /single-link/);
        ok((await readFile(outside)).equals(bytes));

        const changed = await api.runTaxonomyProjectionObjectPlan({ optIn: true, outputRoot: byteRoot, ...sourceRoots });
        await writeFile(join(changed.planDirectory, TAXONOMY_PROJECTION_REMOTE_MANIFEST_CANDIDATE_FILE), "{}\n");
        await rejects(api.readValidatedTaxonomyProjectionObjectPlan({
            outputRoot: byteRoot, planId: changed.planId, ...sourceRoots,
        }), /bytes or source lineage mismatch/);
    });

    it("rejects a junction output root when the platform permits it", async function () {
        const target = join(temporary, "target");
        const linkedRoot = join(temporary, "linked-root");
        await mkdir(target);
        try { await symlink(target, linkedRoot, process.platform === "win32" ? "junction" : "dir"); }
        catch (error: any) { if (["EPERM", "EACCES", "UNKNOWN"].includes(error?.code)) { this.skip(); return; } throw error; }
        await rejects(api.runTaxonomyProjectionObjectPlan({ optIn: true, outputRoot: linkedRoot, ...sourceRoots }), /non-link|junction/);
    });

    it("rejects a symlinked member when the platform permits it", async function () {
        const output = join(temporary, "symlink-output");
        await mkdir(output);
        const result = await api.runTaxonomyProjectionObjectPlan({ optIn: true, outputRoot: output, ...sourceRoots });
        const member = join(result.planDirectory, TAXONOMY_PROJECTION_OBJECT_PLAN_RECEIPT);
        const outside = join(temporary, "outside-receipt");
        await writeFile(outside, await readFile(member));
        await unlink(member);
        try { await symlink(outside, member, "file"); }
        catch (error: any) { if (["EPERM", "EACCES", "UNKNOWN"].includes(error?.code)) { this.skip(); return; } throw error; }
        await rejects(api.readValidatedTaxonomyProjectionObjectPlan({
            outputRoot: output, planId: result.planId, ...sourceRoots,
        }), /single-link|realpath/);
    });

    it("enforces the exclusive RSS limit and bounds public errors", async () => {
        (global as any)[DELIVERY_HOOK] = async () => fakeDelivery({ peakRssBytes: TAXONOMY_PROJECTION_OBJECT_PLAN_RSS_LIMIT_BYTES });
        await rejects(api.runTaxonomyProjectionObjectPlan({ optIn: true, outputRoot: temporary, ...sourceRoots }), /RSS limit reached/);
        (global as any)[DELIVERY_HOOK] = async () => { throw new Error("x".repeat(2048)); };
        try { await api.runTaxonomyProjectionObjectPlan({ optIn: true, outputRoot: temporary, ...sourceRoots }); }
        catch (error) { ok((error as Error).message.length <= TAXONOMY_PROJECTION_OBJECT_PLAN_MAX_ERROR_LENGTH); }
    });

    it("exports only source-bound planning APIs and contains no network, publisher, consumer, or remote mutation path", async () => {
        strictEqual((objectPlanApi as any).buildBundle, undefined);
        strictEqual((objectPlanApi as any).materializeBundle, undefined);
        strictEqual((objectPlanApi as any).validateLocalBundle, undefined);
        strictEqual((objectPlanApi as any).writeExclusive, undefined);
        strictEqual((objectPlanApi as any).readValidatedTaxonomyProjectionDelivery, undefined);
        const sourceDirectory = resolve(__dirname, basename(resolve(__dirname, "..")) === "lib" ? "../../database-characters" : ".");
        const sources = await Promise.all([
            "taxonomy-projection-object-plan-contract.ts",
            "taxonomy-projection-object-plan.ts",
            "taxonomy-projection-object-plan-run.ts",
        ].map(name => readFile(join(sourceDirectory, name), "utf8")));
        const combined = sources.join("\n");
        ok(combined.includes("readValidatedTaxonomyProjectionDelivery"));
        ok(combined.includes("new Set(objects.map(object => object.objectKey)).size !== 4"));
        equal(/from ["'][^"']*(?:publisher|publish|wrangler|s3)[^"']*["']/i.test(combined), false);
        equal(/\bfetch\s*\(|https?:\/\//i.test(combined), false);
        equal(/\bCharacter(?:\[\]|\b)/.test(combined), false);
        equal(/export (?:async )?function (?:build|materialize|write|publish|apply|overlay|validateLocal)/.test(combined), false);
        equal(/PutObject|ListObjects|HeadObject|DeleteObject|axios|node-fetch/.test(combined), false);
        equal(combined.includes(TAXONOMY_PROJECTION_REMOTE_MANIFEST_CANDIDATE_FILE), true);
    });
});
