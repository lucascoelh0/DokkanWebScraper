"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = require("crypto");
const assert_1 = require("assert");
const promises_1 = require("fs/promises");
const ModuleApi = require("module");
const os_1 = require("os");
const path_1 = require("path");
const typescript_1 = require("typescript");
const taxonomy_projection_delivery_contract_1 = require("./taxonomy-projection-delivery-contract");
const deliveryApi = require("./taxonomy-projection-delivery");
const taxonomy_projection_delivery_run_1 = require("./taxonomy-projection-delivery-run");
const taxonomy_projection_contract_1 = require("./taxonomy-projection-contract");
const VALIDATOR_HOOK = Symbol.for("dokkan.k36.taxonomy-projection-delivery.validator");
const hash = (bytes) => (0, crypto_1.createHash)("sha256").update(bytes).digest("hex");
const jsonBytes = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
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
    };
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
        coverageFile: taxonomy_projection_contract_1.TAXONOMY_PROJECTION_FILES.coverage,
        coverageSha256: hash(coverageBytes),
        coverageSizeBytes: coverageBytes.length,
        validationFile: taxonomy_projection_contract_1.TAXONOMY_PROJECTION_FILES.validation,
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
    };
}
async function loadInstrumentedDelivery() {
    const parent = (0, path_1.resolve)(__dirname, "..");
    const compiledRun = (0, path_1.basename)(parent).toLowerCase() === "lib";
    const sourceRoot = compiledRun ? (0, path_1.resolve)(parent, "..") : parent;
    const sourcePath = (0, path_1.join)(sourceRoot, "database-characters", "taxonomy-projection-delivery.ts");
    const runtimePath = compiledRun
        ? (0, path_1.join)(parent, "database-characters", "taxonomy-projection-delivery.js")
        : (0, path_1.join)(sourceRoot, "database-characters", ".taxonomy-projection-delivery.test-runtime.js");
    const source = await (0, promises_1.readFile)(sourcePath, "utf8");
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
    k32Root: "X:/explicit/k32",
    k2Root: "X:/explicit/k2",
    productiveRoot: "X:/explicit/productive",
    sqliteRoot: "X:/explicit/sqlite",
    db1Root: "X:/explicit/db1",
    elfRoot: "X:/explicit/elf",
    nativeEvidenceRoot: "X:/explicit/native-evidence",
};
function cliArgs(outputRoot = "X:/explicit/output") {
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
async function releaseBytes(outputRoot, releaseId) {
    const release = (0, path_1.join)(outputRoot, taxonomy_projection_delivery_contract_1.TAXONOMY_PROJECTION_DELIVERY_NAMESPACE, releaseId);
    const names = (await (0, promises_1.readdir)(release)).sort();
    return new Map(await Promise.all(names.map(async (name) => [name, await (0, promises_1.readFile)((0, path_1.join)(release, name))])));
}
describe("K36 taxonomy projection local delivery", () => {
    let temporary;
    let api;
    let calls;
    before(async () => { api = await loadInstrumentedDelivery(); });
    beforeEach(async () => {
        temporary = await (0, promises_1.mkdtemp)((0, path_1.join)((0, os_1.tmpdir)(), "dokkan-k36-delivery-"));
        calls = [];
        global[VALIDATOR_HOOK] = async (options) => { calls.push(options); return fakeValidatedK35(); };
    });
    afterEach(async () => {
        delete global[VALIDATOR_HOOK];
        await (0, promises_1.rm)(temporary, { recursive: true, force: true });
    });
    it("requires the exact opt-in and every explicit root without defaults", async () => {
        const parsed = (0, taxonomy_projection_delivery_run_1.parseTaxonomyProjectionDeliveryCli)(cliArgs());
        (0, assert_1.equal)(parsed.optIn, true);
        (0, assert_1.equal)(parsed.k35Root, "X:/explicit/k35");
        (0, assert_1.equal)(parsed.outputRoot, "X:/explicit/output");
        for (const args of [
            cliArgs().filter(value => value !== "--opt-in-k36"),
            [...cliArgs(), "--opt-in-k36"],
            cliArgs().filter((_, index, values) => index !== values.indexOf("--k2-root") && index !== values.indexOf("--k2-root") + 1),
            [...cliArgs(), "--publish"],
            ["--opt-in-k36", "--output-root=implicit"],
        ])
            (0, assert_1.throws)(() => (0, taxonomy_projection_delivery_run_1.parseTaxonomyProjectionDeliveryCli)(args), /K36|missing|unsupported|duplicate/);
        await (0, assert_1.rejects)(api.runTaxonomyProjectionDelivery({ outputRoot: temporary, optIn: false, k35Root: "x", ...sourceRoots }), /explicit opt-in/);
        (0, assert_1.equal)(calls.length, 0);
    });
    it("fails closed when nested K35 validation reports an RSS peak at the exclusive limit", async () => {
        global[VALIDATOR_HOOK] = async (options) => {
            calls.push(options);
            return { ...fakeValidatedK35(), peakNestedRssBytes: taxonomy_projection_delivery_contract_1.TAXONOMY_PROJECTION_DELIVERY_RSS_LIMIT_BYTES };
        };
        await (0, assert_1.rejects)(api.runTaxonomyProjectionDelivery({
            optIn: true, outputRoot: temporary, k35Root: "k35", ...sourceRoots,
        }), /RSS limit reached/);
        (0, assert_1.equal)((await (0, promises_1.readdir)(temporary)).length, 0);
    });
    it("builds byte-identical content-addressed releases with a closed marker-last inventory", async () => {
        const firstRoot = (0, path_1.join)(temporary, "first");
        const secondRoot = (0, path_1.join)(temporary, "second");
        await Promise.all([(0, promises_1.mkdir)(firstRoot), (0, promises_1.mkdir)(secondRoot)]);
        const first = await api.runTaxonomyProjectionDelivery({ optIn: true, outputRoot: firstRoot, k35Root: "X:/explicit/k35", ...sourceRoots });
        const second = await api.runTaxonomyProjectionDelivery({ optIn: true, outputRoot: secondRoot, k35Root: "X:/explicit/k35", ...sourceRoots });
        (0, assert_1.equal)(first.releaseId, second.releaseId);
        (0, assert_1.equal)(first.twoConstructionByteIdentical, true);
        (0, assert_1.equal)(first.receipt.deliveryState, "STOPPED_LOCAL_ONLY");
        (0, assert_1.ok)(Object.entries(first.receipt.readiness).filter(([key]) => !key.startsWith("offline")).every(([, value]) => value === "NO-GO"));
        (0, assert_1.equal)(calls.length, 4);
        for (const call of calls) {
            for (const [name, value] of Object.entries(sourceRoots))
                (0, assert_1.equal)(call[name], value);
        }
        (0, assert_1.equal)(calls[0].artifactRoot, "X:/explicit/k35");
        (0, assert_1.ok)(calls[1].artifactRoot.endsWith(first.releaseId));
        (0, assert_1.equal)(calls[2].artifactRoot, "X:/explicit/k35");
        (0, assert_1.ok)(calls[3].artifactRoot.endsWith(second.releaseId));
        const firstFiles = await releaseBytes(firstRoot, first.releaseId);
        const secondFiles = await releaseBytes(secondRoot, second.releaseId);
        (0, assert_1.equal)(firstFiles.size, 6);
        (0, assert_1.equal)(JSON.stringify([...firstFiles.keys()]), JSON.stringify([...secondFiles.keys()]));
        for (const [name, bytes] of firstFiles)
            (0, assert_1.ok)(bytes.equals(secondFiles.get(name)), name);
        const marker = JSON.parse(firstFiles.get(taxonomy_projection_delivery_contract_1.TAXONOMY_PROJECTION_DELIVERY_MARKER).toString("utf8"));
        (0, assert_1.equal)(marker.inventory.markerWrittenLast, true);
        (0, assert_1.equal)(marker.inventory.closed, true);
        (0, assert_1.equal)(JSON.stringify(marker.inventory.expectedNames), JSON.stringify([...firstFiles.keys()].sort()));
        const releaseDirectory = (0, path_1.join)(firstRoot, taxonomy_projection_delivery_contract_1.TAXONOMY_PROJECTION_DELIVERY_NAMESPACE, first.releaseId);
        const markerMetadata = await (0, promises_1.stat)((0, path_1.join)(releaseDirectory, taxonomy_projection_delivery_contract_1.TAXONOMY_PROJECTION_DELIVERY_MARKER));
        for (const name of [...firstFiles.keys()].filter(name => name !== taxonomy_projection_delivery_contract_1.TAXONOMY_PROJECTION_DELIVERY_MARKER)) {
            const metadata = await (0, promises_1.stat)((0, path_1.join)(releaseDirectory, name));
            (0, assert_1.ok)(markerMetadata.birthtimeMs >= metadata.birthtimeMs, `${name} must precede the marker`);
        }
    });
    it("rejects byte/hash and recomputed lineage mutations", async () => {
        const byteRoot = (0, path_1.join)(temporary, "byte-mutation");
        const lineageRoot = (0, path_1.join)(temporary, "lineage-mutation");
        await Promise.all([(0, promises_1.mkdir)(byteRoot), (0, promises_1.mkdir)(lineageRoot)]);
        const byteRelease = await api.runTaxonomyProjectionDelivery({ optIn: true, outputRoot: byteRoot, k35Root: "k35", ...sourceRoots });
        const payloadName = byteRelease.receipt.inventory.entries[0].fileName;
        await (0, promises_1.writeFile)((0, path_1.join)(byteRelease.releaseDirectory, payloadName), Buffer.from("mutated"));
        await (0, assert_1.rejects)(api.readValidatedTaxonomyProjectionDelivery({ outputRoot: byteRoot, releaseId: byteRelease.releaseId, ...sourceRoots }), /byte identity|validation failed/);
        const lineageRelease = await api.runTaxonomyProjectionDelivery({ optIn: true, outputRoot: lineageRoot, k35Root: "k35", ...sourceRoots });
        const receiptPath = (0, path_1.join)(lineageRelease.releaseDirectory, taxonomy_projection_delivery_contract_1.TAXONOMY_PROJECTION_DELIVERY_RECEIPT);
        const markerPath = (0, path_1.join)(lineageRelease.releaseDirectory, taxonomy_projection_delivery_contract_1.TAXONOMY_PROJECTION_DELIVERY_MARKER);
        const receipt = JSON.parse((await (0, promises_1.readFile)(receiptPath)).toString("utf8"));
        receipt.source.k35.lineage.profileId = "forged-but-marker-consistent";
        const forgedReceiptBytes = jsonBytes(receipt);
        await (0, promises_1.writeFile)(receiptPath, forgedReceiptBytes);
        const marker = JSON.parse((await (0, promises_1.readFile)(markerPath)).toString("utf8"));
        marker.files[taxonomy_projection_delivery_contract_1.TAXONOMY_PROJECTION_DELIVERY_RECEIPT] = { sha256: hash(forgedReceiptBytes), sizeBytes: forgedReceiptBytes.length };
        marker.budget.accountedBytesBeforeMarker = receipt.budget.artifactBytes + forgedReceiptBytes.length;
        await (0, promises_1.writeFile)(markerPath, jsonBytes(marker));
        await (0, assert_1.rejects)(api.readValidatedTaxonomyProjectionDelivery({ outputRoot: lineageRoot, releaseId: lineageRelease.releaseId, ...sourceRoots }), /source-bound lineage|validation failed/);
    });
    it("is create-only and preserves an existing release and unrelated output files", async () => {
        const existing = await api.runTaxonomyProjectionDelivery({ optIn: true, outputRoot: temporary, k35Root: "k35", ...sourceRoots });
        const before = await releaseBytes(temporary, existing.releaseId);
        const unrelated = (0, path_1.join)(temporary, "caller-owned.txt");
        await (0, promises_1.writeFile)(unrelated, "keep\n");
        await (0, assert_1.rejects)(api.runTaxonomyProjectionDelivery({ optIn: true, outputRoot: temporary, k35Root: "k35", ...sourceRoots }), /already exists/);
        const after = await releaseBytes(temporary, existing.releaseId);
        for (const [name, bytes] of before)
            (0, assert_1.ok)(bytes.equals(after.get(name)), name);
        (0, assert_1.equal)(await (0, promises_1.readFile)(unrelated, "utf8"), "keep\n");
    });
    it("rejects traversal, absolute release IDs, missing destinations, and unexpected inventory", async () => {
        await (0, assert_1.rejects)(api.validateTaxonomyProjectionDeliveryOutputRoot((0, path_1.join)(temporary, "missing")), /existing|ENOENT/);
        for (const releaseId of ["../escape", (0, path_1.resolve)(temporary, "absolute"), `a${"/b".repeat(40)}`]) {
            await (0, assert_1.rejects)(api.readValidatedTaxonomyProjectionDelivery({ outputRoot: temporary, releaseId, ...sourceRoots }), /canonical content-addressed release ID/);
        }
        const release = await api.runTaxonomyProjectionDelivery({ optIn: true, outputRoot: temporary, k35Root: "k35", ...sourceRoots });
        await (0, promises_1.writeFile)((0, path_1.join)(release.releaseDirectory, "unexpected.txt"), "alien\n");
        await (0, assert_1.rejects)(api.readValidatedTaxonomyProjectionDelivery({ outputRoot: temporary, releaseId: release.releaseId, ...sourceRoots }), /closed release inventory/);
        (0, assert_1.equal)(await (0, promises_1.readFile)((0, path_1.join)(release.releaseDirectory, "unexpected.txt"), "utf8"), "alien\n");
    });
    it("rejects hard-linked members through nlink validation", async () => {
        const release = await api.runTaxonomyProjectionDelivery({ optIn: true, outputRoot: temporary, k35Root: "k35", ...sourceRoots });
        const payloadName = release.receipt.inventory.entries[0].fileName;
        const payloadPath = (0, path_1.join)(release.releaseDirectory, payloadName);
        const outside = (0, path_1.join)(temporary, "outside-copy");
        const bytes = await (0, promises_1.readFile)(payloadPath);
        await (0, promises_1.unlink)(payloadPath);
        await (0, promises_1.writeFile)(outside, bytes);
        await (0, promises_1.link)(outside, payloadPath);
        await (0, assert_1.rejects)(api.readValidatedTaxonomyProjectionDelivery({ outputRoot: temporary, releaseId: release.releaseId, ...sourceRoots }), /single-link|validation failed/);
        (0, assert_1.equal)((await (0, promises_1.readFile)(outside)).equals(bytes), true);
    });
    it("rejects a junction output root when the platform permits it", async function () {
        const target = (0, path_1.join)(temporary, "target");
        const linkedRoot = (0, path_1.join)(temporary, "linked-root");
        await (0, promises_1.mkdir)(target);
        const kind = process.platform === "win32" ? "junction" : "dir";
        try {
            await (0, promises_1.symlink)(target, linkedRoot, kind);
        }
        catch (error) {
            if (["EPERM", "EACCES", "UNKNOWN"].includes(error?.code)) {
                this.skip();
                return;
            }
            throw error;
        }
        await (0, assert_1.rejects)(api.validateTaxonomyProjectionDeliveryOutputRoot(linkedRoot), /non-link|junction/);
    });
    it("rejects a symlinked member when the platform permits it", async function () {
        const output = (0, path_1.join)(temporary, "output");
        await (0, promises_1.mkdir)(output);
        const release = await api.runTaxonomyProjectionDelivery({ optIn: true, outputRoot: output, k35Root: "k35", ...sourceRoots });
        const payloadName = release.receipt.inventory.entries[0].fileName;
        const payloadPath = (0, path_1.join)(release.releaseDirectory, payloadName);
        const outside = (0, path_1.join)(temporary, "outside-payload");
        await (0, promises_1.writeFile)(outside, await (0, promises_1.readFile)(payloadPath));
        await (0, promises_1.unlink)(payloadPath);
        try {
            await (0, promises_1.symlink)(outside, payloadPath, "file");
        }
        catch (error) {
            if (["EPERM", "EACCES", "UNKNOWN"].includes(error?.code)) {
                this.skip();
                return;
            }
            throw error;
        }
        await (0, assert_1.rejects)(api.readValidatedTaxonomyProjectionDelivery({ outputRoot: output, releaseId: release.releaseId, ...sourceRoots }), /single-link|realpath|validation failed/);
    });
    it("exposes no weak authorization, Character consumer, or publication path", async () => {
        (0, assert_1.strictEqual)(deliveryApi.buildBundle, undefined);
        (0, assert_1.strictEqual)(deliveryApi.materializeBundle, undefined);
        (0, assert_1.strictEqual)(deliveryApi.writeExclusive, undefined);
        (0, assert_1.strictEqual)(deliveryApi.validateTaxonomyProjectionArtifact, undefined);
        const sourcePath = (0, path_1.resolve)(__dirname, (0, path_1.basename)((0, path_1.resolve)(__dirname, "..")) === "lib" ? "../../database-characters/taxonomy-projection-delivery.ts" : "taxonomy-projection-delivery.ts");
        const source = await (0, promises_1.readFile)(sourcePath, "utf8");
        (0, assert_1.ok)(source.includes("validateTaxonomyProjectionArtifact"));
        (0, assert_1.equal)(/from ["']\.\/(?:.*publisher|publish.*|.*wrangler.*)["']/.test(source), false);
        (0, assert_1.equal)(/\bfetch\s*\(|https?:\/\/|\bCharacter(?:\[\]|\b)/.test(source), false);
        (0, assert_1.equal)(/export (?:async )?function (?:build|materialize|write|publish|apply|overlay)/.test(source), false);
    });
});
//# sourceMappingURL=taxonomy-projection-delivery.spec.js.map