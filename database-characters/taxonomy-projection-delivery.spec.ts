import { createHash } from "crypto";
import { equal, ok, rejects, strictEqual, throws } from "assert";
import { link, mkdir, mkdtemp, readFile, readdir, rm, stat, symlink, unlink, writeFile } from "fs/promises";
import * as ModuleApi from "module";
import { tmpdir } from "os";
import { basename, dirname, join, resolve } from "path";
import { ModuleKind, ScriptTarget, transpileModule } from "typescript";
import {
    TAXONOMY_PROJECTION_DELIVERY_MARKER,
    TAXONOMY_PROJECTION_DELIVERY_NAMESPACE,
    TAXONOMY_PROJECTION_DELIVERY_RECEIPT,
    TAXONOMY_PROJECTION_DELIVERY_RSS_LIMIT_BYTES,
} from "./taxonomy-projection-delivery-contract";
import * as deliveryApi from "./taxonomy-projection-delivery";
import { parseTaxonomyProjectionDeliveryCli } from "./taxonomy-projection-delivery-run";
import { TAXONOMY_PROJECTION_FILES } from "./taxonomy-projection-contract";

const VALIDATOR_HOOK = Symbol.for("dokkan.k36.taxonomy-projection-delivery.validator");
const hash = (bytes: Buffer | string): string => createHash("sha256").update(bytes).digest("hex");
const jsonBytes = (value: unknown): Buffer => Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");

function fakeValidatedK35() {
    const gzip = Buffer.from("synthetic-k35-gzip", "utf8");
    const raw = Buffer.from("synthetic-k35-raw\n", "utf8");
    const coverageBytes = jsonBytes({ contract: "synthetic-k35-coverage", covered: 2 });
    const validationBytes = jsonBytes({ contract: "synthetic-k35-validation", valid: true });
    const payloadSha256 = hash(gzip);
    const source = {
        profileId: "synthetic-k36-source-bound-profile",
        k32: { sourceBoundValidation: "GO" },
        k2: { manifestSha256: "1".repeat(64) },
        k34: { inProcessValidation: "GO" },
        sqlite: { sha256: "2".repeat(64), sizeBytes: 1 },
        db1: { sha256: "3".repeat(64), sizeBytes: 1, uncompressedSizeBytes: 1 },
        elf: { sha256: "4".repeat(64), sizeBytes: 1, format: "ELF64" },
        nativeLayout: { sha256: "5".repeat(64), sizeBytes: 1 },
    } as any;
    const manifest = {
        schemaVersion: 1,
        contract: "dokkan-database-character-taxonomy-projection-manifest",
        contractVersion: "1.0.0",
        generatedAt: "2026-08-05T00:00:00.000Z",
        datasetVersion: "synthetic-k35-v1",
        fileName: `database-characters-k35-taxonomy-projection.${payloadSha256}.json.gz`,
        compression: "gzip",
        sha256: payloadSha256,
        sizeBytes: gzip.length,
        uncompressedSha256: hash(raw),
        uncompressedSizeBytes: raw.length,
        recordCount: 2,
        source,
        coverageFile: TAXONOMY_PROJECTION_FILES.coverage,
        coverageSha256: hash(coverageBytes),
        coverageSizeBytes: coverageBytes.length,
        validationFile: TAXONOMY_PROJECTION_FILES.validation,
        validationSha256: hash(validationBytes),
        validationSizeBytes: validationBytes.length,
    };
    const manifestBytes = jsonBytes(manifest);
    return {
        artifacts: {
            projection: { records: [] }, coverage: {}, validation: {}, manifest,
            raw, gzip, coverageBytes, validationBytes, manifestBytes,
        },
        sourceBoundValidation: {
            status: "GO", k32Revalidated: true, k34RevalidatedInProcess: true, exactArtifactBytesMatched: true,
        },
        peakNestedRssBytes: process.memoryUsage().rss,
    } as any;
}

type InstrumentedDelivery = typeof deliveryApi;

async function loadInstrumentedDelivery(): Promise<InstrumentedDelivery> {
    const parent = resolve(__dirname, "..");
    const compiledRun = basename(parent).toLowerCase() === "lib";
    const sourceRoot = compiledRun ? resolve(parent, "..") : parent;
    const sourcePath = join(sourceRoot, "database-characters", "taxonomy-projection-delivery.ts");
    const runtimePath = compiledRun
        ? join(parent, "database-characters", "taxonomy-projection-delivery.js")
        : join(sourceRoot, "database-characters", ".taxonomy-projection-delivery.test-runtime.js");
    const source = await readFile(sourcePath, "utf8");
    const instrumented = source
        .replace(/validateTaxonomyProjectionArtifact\(/g, "__testValidateTaxonomyProjectionArtifact(")
        .replace("export interface TaxonomyProjectionDeliverySourceRoots", `
const __testValidateTaxonomyProjectionArtifact = (options: unknown) => {
    const hook = (globalThis as any)[Symbol.for("dokkan.k36.taxonomy-projection-delivery.validator")];
    if (typeof hook !== "function") throw new Error("K36 test validator hook missing");
    return hook(options);
};

export interface TaxonomyProjectionDeliverySourceRoots`);
    if (instrumented === source || !instrumented.includes("__testValidateTaxonomyProjectionArtifact")) {
        throw new Error("K36 test instrumentation failed");
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
    return runtimeModule.exports as InstrumentedDelivery;
}

const sourceRoots = {
    k32Root: "X:/explicit/k32",
    k2Root: "X:/explicit/k2",
    productiveRoot: "X:/explicit/productive",
    sqliteRoot: "X:/explicit/sqlite",
    db1Root: "X:/explicit/db1",
    elfRoot: "X:/explicit/elf",
    nativeEvidenceRoot: "X:/explicit/native-evidence",
};

function cliArgs(outputRoot = "X:/explicit/output"): string[] {
    return [
        "--opt-in-k36",
        "--k35-root", "X:/explicit/k35",
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

async function releaseBytes(outputRoot: string, releaseId: string): Promise<Map<string, Buffer>> {
    const release = join(outputRoot, TAXONOMY_PROJECTION_DELIVERY_NAMESPACE, releaseId);
    const names = (await readdir(release)).sort();
    return new Map(await Promise.all(names.map(async name => [name, await readFile(join(release, name))] as [string, Buffer])));
}

describe("K36 taxonomy projection local delivery", () => {
    let temporary: string;
    let api: InstrumentedDelivery;
    let calls: any[];

    before(async () => { api = await loadInstrumentedDelivery(); });
    beforeEach(async () => {
        temporary = await mkdtemp(join(tmpdir(), "dokkan-k36-delivery-"));
        calls = [];
        (global as any)[VALIDATOR_HOOK] = async (options: any) => { calls.push(options); return fakeValidatedK35(); };
    });
    afterEach(async () => {
        delete (global as any)[VALIDATOR_HOOK];
        await rm(temporary, { recursive: true, force: true });
    });

    it("requires the exact opt-in and every explicit root without defaults", async () => {
        const parsed = parseTaxonomyProjectionDeliveryCli(cliArgs());
        equal(parsed.optIn, true);
        equal(parsed.k35Root, "X:/explicit/k35");
        equal(parsed.outputRoot, "X:/explicit/output");
        for (const args of [
            cliArgs().filter(value => value !== "--opt-in-k36"),
            [...cliArgs(), "--opt-in-k36"],
            cliArgs().filter((_, index, values) => index !== values.indexOf("--k2-root") && index !== values.indexOf("--k2-root") + 1),
            [...cliArgs(), "--publish"],
            ["--opt-in-k36", "--output-root=implicit"],
        ]) throws(() => parseTaxonomyProjectionDeliveryCli(args), /K36|missing|unsupported|duplicate/);
        await rejects(api.runTaxonomyProjectionDelivery({ outputRoot: temporary, optIn: false, k35Root: "x", ...sourceRoots } as any), /explicit opt-in/);
        equal(calls.length, 0);
    });

    it("fails closed when nested K35 validation reports an RSS peak at the exclusive limit", async () => {
        (global as any)[VALIDATOR_HOOK] = async (options: any) => {
            calls.push(options);
            return { ...fakeValidatedK35(), peakNestedRssBytes: TAXONOMY_PROJECTION_DELIVERY_RSS_LIMIT_BYTES };
        };
        await rejects(api.runTaxonomyProjectionDelivery({
            optIn: true, outputRoot: temporary, k35Root: "k35", ...sourceRoots,
        }), /RSS limit reached/);
        equal((await readdir(temporary)).length, 0);
    });

    it("builds byte-identical content-addressed releases with a closed marker-last inventory", async () => {
        const firstRoot = join(temporary, "first");
        const secondRoot = join(temporary, "second");
        await Promise.all([mkdir(firstRoot), mkdir(secondRoot)]);
        const first = await api.runTaxonomyProjectionDelivery({ optIn: true, outputRoot: firstRoot, k35Root: "X:/explicit/k35", ...sourceRoots });
        const second = await api.runTaxonomyProjectionDelivery({ optIn: true, outputRoot: secondRoot, k35Root: "X:/explicit/k35", ...sourceRoots });
        equal(first.releaseId, second.releaseId);
        equal(first.twoConstructionByteIdentical, true);
        equal(first.receipt.deliveryState, "STOPPED_LOCAL_ONLY");
        ok(Object.entries(first.receipt.readiness).filter(([key]) => !key.startsWith("offline")).every(([, value]) => value === "NO-GO"));
        equal(calls.length, 4);
        for (const call of calls) {
            for (const [name, value] of Object.entries(sourceRoots)) equal(call[name], value);
        }
        equal(calls[0].artifactRoot, "X:/explicit/k35");
        ok(calls[1].artifactRoot.endsWith(first.releaseId));
        equal(calls[2].artifactRoot, "X:/explicit/k35");
        ok(calls[3].artifactRoot.endsWith(second.releaseId));

        const firstFiles = await releaseBytes(firstRoot, first.releaseId);
        const secondFiles = await releaseBytes(secondRoot, second.releaseId);
        equal(firstFiles.size, 6);
        equal(JSON.stringify([...firstFiles.keys()]), JSON.stringify([...secondFiles.keys()]));
        for (const [name, bytes] of firstFiles) ok(bytes.equals(secondFiles.get(name)!), name);
        const marker = JSON.parse(firstFiles.get(TAXONOMY_PROJECTION_DELIVERY_MARKER)!.toString("utf8"));
        equal(marker.inventory.markerWrittenLast, true);
        equal(marker.inventory.closed, true);
        equal(JSON.stringify(marker.inventory.expectedNames), JSON.stringify([...firstFiles.keys()].sort()));
        const releaseDirectory = join(firstRoot, TAXONOMY_PROJECTION_DELIVERY_NAMESPACE, first.releaseId);
        const markerMetadata = await stat(join(releaseDirectory, TAXONOMY_PROJECTION_DELIVERY_MARKER));
        for (const name of [...firstFiles.keys()].filter(name => name !== TAXONOMY_PROJECTION_DELIVERY_MARKER)) {
            const metadata = await stat(join(releaseDirectory, name));
            ok(markerMetadata.birthtimeMs >= metadata.birthtimeMs, `${name} must precede the marker`);
        }
    });

    it("rejects byte/hash and recomputed lineage mutations", async () => {
        const byteRoot = join(temporary, "byte-mutation");
        const lineageRoot = join(temporary, "lineage-mutation");
        await Promise.all([mkdir(byteRoot), mkdir(lineageRoot)]);
        const byteRelease = await api.runTaxonomyProjectionDelivery({ optIn: true, outputRoot: byteRoot, k35Root: "k35", ...sourceRoots });
        const payloadName = byteRelease.receipt.inventory.entries[0].fileName;
        await writeFile(join(byteRelease.releaseDirectory, payloadName), Buffer.from("mutated"));
        await rejects(api.readValidatedTaxonomyProjectionDelivery({ outputRoot: byteRoot, releaseId: byteRelease.releaseId, ...sourceRoots }), /byte identity|validation failed/);

        const lineageRelease = await api.runTaxonomyProjectionDelivery({ optIn: true, outputRoot: lineageRoot, k35Root: "k35", ...sourceRoots });
        const receiptPath = join(lineageRelease.releaseDirectory, TAXONOMY_PROJECTION_DELIVERY_RECEIPT);
        const markerPath = join(lineageRelease.releaseDirectory, TAXONOMY_PROJECTION_DELIVERY_MARKER);
        const receipt = JSON.parse((await readFile(receiptPath)).toString("utf8"));
        receipt.source.k35.lineage.profileId = "forged-but-marker-consistent";
        const forgedReceiptBytes = jsonBytes(receipt);
        await writeFile(receiptPath, forgedReceiptBytes);
        const marker = JSON.parse((await readFile(markerPath)).toString("utf8"));
        marker.files[TAXONOMY_PROJECTION_DELIVERY_RECEIPT] = { sha256: hash(forgedReceiptBytes), sizeBytes: forgedReceiptBytes.length };
        marker.budget.accountedBytesBeforeMarker = receipt.budget.artifactBytes + forgedReceiptBytes.length;
        await writeFile(markerPath, jsonBytes(marker));
        await rejects(api.readValidatedTaxonomyProjectionDelivery({ outputRoot: lineageRoot, releaseId: lineageRelease.releaseId, ...sourceRoots }), /source-bound lineage|validation failed/);
    });

    it("is create-only and preserves an existing release and unrelated output files", async () => {
        const existing = await api.runTaxonomyProjectionDelivery({ optIn: true, outputRoot: temporary, k35Root: "k35", ...sourceRoots });
        const before = await releaseBytes(temporary, existing.releaseId);
        const unrelated = join(temporary, "caller-owned.txt");
        await writeFile(unrelated, "keep\n");
        await rejects(api.runTaxonomyProjectionDelivery({ optIn: true, outputRoot: temporary, k35Root: "k35", ...sourceRoots }), /already exists/);
        const after = await releaseBytes(temporary, existing.releaseId);
        for (const [name, bytes] of before) ok(bytes.equals(after.get(name)!), name);
        equal(await readFile(unrelated, "utf8"), "keep\n");
    });

    it("rejects traversal, absolute release IDs, missing destinations, and unexpected inventory", async () => {
        await rejects(api.validateTaxonomyProjectionDeliveryOutputRoot(join(temporary, "missing")), /existing|ENOENT/);
        for (const releaseId of ["../escape", resolve(temporary, "absolute"), `a${"/b".repeat(40)}`]) {
            await rejects(api.readValidatedTaxonomyProjectionDelivery({ outputRoot: temporary, releaseId, ...sourceRoots }), /canonical content-addressed release ID/);
        }
        const release = await api.runTaxonomyProjectionDelivery({ optIn: true, outputRoot: temporary, k35Root: "k35", ...sourceRoots });
        await writeFile(join(release.releaseDirectory, "unexpected.txt"), "alien\n");
        await rejects(api.readValidatedTaxonomyProjectionDelivery({ outputRoot: temporary, releaseId: release.releaseId, ...sourceRoots }), /closed release inventory/);
        equal(await readFile(join(release.releaseDirectory, "unexpected.txt"), "utf8"), "alien\n");
    });

    it("rejects hard-linked members through nlink validation", async () => {
        const release = await api.runTaxonomyProjectionDelivery({ optIn: true, outputRoot: temporary, k35Root: "k35", ...sourceRoots });
        const payloadName = release.receipt.inventory.entries[0].fileName;
        const payloadPath = join(release.releaseDirectory, payloadName);
        const outside = join(temporary, "outside-copy");
        const bytes = await readFile(payloadPath);
        await unlink(payloadPath);
        await writeFile(outside, bytes);
        await link(outside, payloadPath);
        await rejects(api.readValidatedTaxonomyProjectionDelivery({ outputRoot: temporary, releaseId: release.releaseId, ...sourceRoots }), /single-link|validation failed/);
        equal((await readFile(outside)).equals(bytes), true);
    });

    it("rejects a junction output root when the platform permits it", async function () {
        const target = join(temporary, "target");
        const linkedRoot = join(temporary, "linked-root");
        await mkdir(target);
        const kind = process.platform === "win32" ? "junction" : "dir";
        try { await symlink(target, linkedRoot, kind); }
        catch (error: any) { if (["EPERM", "EACCES", "UNKNOWN"].includes(error?.code)) { this.skip(); return; } throw error; }
        await rejects(api.validateTaxonomyProjectionDeliveryOutputRoot(linkedRoot), /non-link|junction/);
    });

    it("rejects a symlinked member when the platform permits it", async function () {
        const output = join(temporary, "output");
        await mkdir(output);
        const release = await api.runTaxonomyProjectionDelivery({ optIn: true, outputRoot: output, k35Root: "k35", ...sourceRoots });
        const payloadName = release.receipt.inventory.entries[0].fileName;
        const payloadPath = join(release.releaseDirectory, payloadName);
        const outside = join(temporary, "outside-payload");
        await writeFile(outside, await readFile(payloadPath));
        await unlink(payloadPath);
        try { await symlink(outside, payloadPath, "file"); }
        catch (error: any) { if (["EPERM", "EACCES", "UNKNOWN"].includes(error?.code)) { this.skip(); return; } throw error; }
        await rejects(api.readValidatedTaxonomyProjectionDelivery({ outputRoot: output, releaseId: release.releaseId, ...sourceRoots }), /single-link|realpath|validation failed/);
    });

    it("exposes no weak authorization, Character consumer, or publication path", async () => {
        strictEqual((deliveryApi as any).buildBundle, undefined);
        strictEqual((deliveryApi as any).materializeBundle, undefined);
        strictEqual((deliveryApi as any).writeExclusive, undefined);
        strictEqual((deliveryApi as any).validateTaxonomyProjectionArtifact, undefined);
        const sourcePath = resolve(__dirname, basename(resolve(__dirname, "..")) === "lib" ? "../../database-characters/taxonomy-projection-delivery.ts" : "taxonomy-projection-delivery.ts");
        const source = await readFile(sourcePath, "utf8");
        ok(source.includes("validateTaxonomyProjectionArtifact"));
        equal(/from ["']\.\/(?:.*publisher|publish.*|.*wrangler.*)["']/.test(source), false);
        equal(/\bfetch\s*\(|https?:\/\/|\bCharacter(?:\[\]|\b)/.test(source), false);
        equal(/export (?:async )?function (?:build|materialize|write|publish|apply|overlay)/.test(source), false);
    });
});
