import { createHash } from "crypto";
import { deepStrictEqual, equal, ok, rejects, throws } from "assert";
import { link, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "fs/promises";
import * as ModuleApi from "module";
import { tmpdir } from "os";
import { basename, dirname, join, resolve } from "path";
import { ModuleKind, ScriptTarget, transpileModule } from "typescript";
import type { CharacterStructuralIdentitySidecar } from "./structural-sidecar-contract";
import { evaluateCharacterStructuralRepresentation } from "./structural-shadow-evaluator";
import {
    parseCharacterStructuralShadowCli,
    runCharacterStructuralShadow,
} from "./structural-shadow-run";

function label(value: string): any {
    return {
        status: "supported",
        value,
        sourceLocale: "global_snapshot_default",
        source: { table: "card_categories", rowId: "1", column: "name" },
    };
}

function linkLabel(value: string): any {
    const result = label(value);
    result.source.table = "link_skills";
    return result;
}

function record(
    cardId: string,
    options: {
        characterClass?: string;
        classStatus?: "supported" | "partial" | "unknown";
        categories?: string[];
        links?: string[];
        categoryStatus?: "supported" | "partial" | "unknown";
        linkStatus?: "supported" | "partial" | "unknown";
        unresolvedCategoryLabel?: boolean;
        categoryState?: "present_with_row_provenance" | "empty_with_container_provenance_absence_unproved" | "absent_unproved";
    } = {},
): any {
    const categories = options.categories ?? ["A", "B"];
    const links = options.links ?? ["L1", "L2"];
    const categoryState = options.categoryState ?? (categories.length
        ? "present_with_row_provenance" : "empty_with_container_provenance_absence_unproved");
    return {
        cardId,
        productiveCardIdCoverage: "covered",
        characterClass: { raw: options.characterClass ?? "Super", value: options.characterClass ?? "Super", status: options.classStatus ?? "supported" },
        categories: {
            status: options.categoryStatus ?? (categories.length ? "supported" : "unknown"),
            state: categoryState,
            containerProvenance: categoryState === "absent_unproved" ? null
                : { contract: "dokkan-database-characters-taxonomy", cardId, field: "categoryAssignments" },
            assignments: categories.map((value, index) => ({
                categoryId: String(index + 1),
                relationRowId: String(index + 1),
                status: "supported",
                labelEvidence: options.unresolvedCategoryLabel && index === 0
                    ? { status: "unknown", reason: "dictionary_mapping_missing" }
                    : label(value),
            })),
        },
        links: {
            status: options.linkStatus ?? (links.length ? "supported" : "unknown"),
            state: links.length ? "present_with_row_provenance" : "empty_with_container_provenance_absence_unproved",
            containerProvenance: { contract: "dokkan-database-characters-taxonomy", cardId, field: "links" },
            entries: links.map((value, index) => ({
                slot: index + 1,
                linkSkillId: String(index + 1),
                sourceColumn: `link_skill${index + 1}_id`,
                status: "supported",
                labelEvidence: linkLabel(value),
            })),
        },
    };
}

function sidecar(records: any[]): CharacterStructuralIdentitySidecar {
    return { records } as CharacterStructuralIdentitySidecar;
}

function productive(id: string, overrides: Record<string, unknown> = {}): any {
    return { id, characterClass: "Super", categories: ["A", "B"], links: ["L1", "L2"], ...overrides };
}

interface InstrumentedRunner {
    run: typeof runCharacterStructuralShadow;
    sourceBoundCalls: any[];
    integrityOnlyCalls: number;
    productiveLoads: string[];
    productiveRevalidations(): number;
    productiveDisposals(): number;
}

async function loadInstrumentedSource(): Promise<{
    readSnapshot(root: string, fileName: string): Promise<{ bytes: Buffer }>;
    regularRoot(root: string): Promise<string>;
}> {
    const parent = resolve(__dirname, "..");
    const sourceRoot = basename(parent).toLowerCase() === "lib" ? resolve(parent, "..") : parent;
    const sourcePath = join(sourceRoot, "database-characters", "structural-shadow-source.ts");
    const runtimePath = basename(parent).toLowerCase() === "lib"
        ? join(parent, "database-characters", "structural-shadow-source.js") : sourcePath;
    const source = `${await readFile(sourcePath, "utf8")}\nexport { readSnapshot as __testReadSnapshot, regularRoot as __testRegularRoot };\n`;
    const compiled = transpileModule(source, {
        compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2022 },
        fileName: sourcePath,
    }).outputText;
    const ModuleConstructor = (ModuleApi as any).default ?? ModuleApi;
    const runtimeModule = new ModuleConstructor(runtimePath, module);
    runtimeModule.filename = runtimePath;
    runtimeModule.paths = ModuleConstructor._nodeModulePaths(dirname(runtimePath));
    runtimeModule._compile(compiled, runtimePath);
    return {
        readSnapshot: runtimeModule.exports.__testReadSnapshot,
        regularRoot: runtimeModule.exports.__testRegularRoot,
    };
}

async function loadInstrumentedRunner(
    syntheticSidecar: CharacterStructuralIdentitySidecar,
    characters: unknown[],
): Promise<InstrumentedRunner> {
    const parent = resolve(__dirname, "..");
    const sourceRoot = basename(parent).toLowerCase() === "lib" ? resolve(parent, "..") : parent;
    const sourcePath = join(sourceRoot, "database-characters", "structural-shadow-run.ts");
    const runtimePath = basename(parent).toLowerCase() === "lib"
        ? join(parent, "database-characters", "structural-shadow-run.js") : sourcePath;
    const compiled = transpileModule(await readFile(sourcePath, "utf8"), {
        compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2022 },
        fileName: sourcePath,
    }).outputText;
    const sourceBoundCalls: any[] = [];
    let integrityOnlyCalls = 0;
    const productiveLoads: string[] = [];
    let revalidations = 0;
    let disposals = 0;
    const validated = {
        manifest: {
            schemaVersion: 1,
            contract: "dokkan-database-character-structural-identity-manifest",
            contractVersion: "1.0.0",
            generatedAt: "2026-08-13T03:49:01.219Z",
            datasetVersion: "synthetic-k32",
            sha256: "payload",
            sizeBytes: 1,
            uncompressedSha256: "raw",
            uncompressedSizeBytes: 2,
            recordCount: syntheticSidecar.records.length,
            source: { snapshotVersion: "synthetic-k2", k2: { payloadSha256: "k2" } },
        },
        sidecar: syntheticSidecar,
        coverage: { synthetic: true },
        validation: { valid: true },
        sourceBoundValidation: { status: "GO", sourceRootsRevalidated: true, exactArtifactBytesMatched: true },
    };
    const validatorMock = {
        validateCharacterStructuralSidecarArtifact: async (options: any) => {
            sourceBoundCalls.push(options);
            return validated;
        },
        validateCharacterStructuralSidecarArtifactIntegrityOnly: async () => {
            integrityOnlyCalls++;
            throw new Error("integrity-only must not authorize K33");
        },
    };
    const sourceMock = {
        loadCharacterStructuralShadowProductiveSource: async (root: string) => {
            productiveLoads.push(root);
            return {
                evaluate: (value: CharacterStructuralIdentitySidecar) => evaluateCharacterStructuralRepresentation(value, characters),
                revalidate: async () => { revalidations++; },
                dispose: () => { disposals++; },
            };
        },
    };
    const ModuleConstructor = (ModuleApi as any).default ?? ModuleApi;
    const runtimeModule = new ModuleConstructor(runtimePath, module);
    runtimeModule.filename = runtimePath;
    runtimeModule.paths = ModuleConstructor._nodeModulePaths(dirname(runtimePath));
    const originalRequire = runtimeModule.require.bind(runtimeModule);
    runtimeModule.require = (request: string) => {
        if (request === "./structural-sidecar-validator") return validatorMock;
        if (request === "./structural-shadow-source") return sourceMock;
        return originalRequire(request);
    };
    runtimeModule._compile(compiled, runtimePath);
    return {
        run: runtimeModule.exports.runCharacterStructuralShadow,
        sourceBoundCalls,
        get integrityOnlyCalls() { return integrityOnlyCalls; },
        productiveLoads,
        productiveRevalidations: () => revalidations,
        productiveDisposals: () => disposals,
    };
}

describe("database character K33 structural shadow consumer", () => {
    it("requires exactly one opt-in and all three explicit roots", async () => {
        await rejects(runCharacterStructuralShadow({} as any), /explicit opt-in/);
        throws(() => parseCharacterStructuralShadowCli([]), /exactly one --opt-in-k33/);
        throws(() => parseCharacterStructuralShadowCli(["--opt-in-k33"]), /requires --k32-root/);
        throws(() => parseCharacterStructuralShadowCli([
            "--opt-in-k33", "--opt-in-k33", "--k32-root", "a", "--k2-root", "b", "--productive-root", "c",
        ]), /exactly one --opt-in-k33/);
        throws(() => parseCharacterStructuralShadowCli(["--opt-in-k33", "--output", "x"]), /unsupported argument/);
        deepStrictEqual(parseCharacterStructuralShadowCli([
            "--opt-in-k33", "--k32-root", "a", "--k2-root", "b", "--productive-root", "c",
        ]), { optIn: true, k32Root: "a", k2Root: "b", productiveRoot: "c" });
    });

    it("authorizes only through source-bound K32 validation and revalidates both inputs", async () => {
        const instrumented = await loadInstrumentedRunner(sidecar([record("1")]), [productive("1")]);
        const report = await instrumented.run({ optIn: true, k32Root: "k32", k2Root: "k2", productiveRoot: "productive" });
        equal(instrumented.sourceBoundCalls.length, 2);
        deepStrictEqual(instrumented.sourceBoundCalls[0], { artifactRoot: "k32", k2Root: "k2", productiveRoot: "productive" });
        equal(instrumented.integrityOnlyCalls, 0);
        deepStrictEqual(instrumented.productiveLoads, ["productive"]);
        equal(instrumented.productiveRevalidations(), 1);
        equal(instrumented.productiveDisposals(), 1);
        equal(report.inputIntegrity.k32ValidatedOnlyBySourceBoundApi, true);
        equal(report.inputIntegrity.doubleEvaluationByteIdentical, true);
        equal(report.readiness.offlineShadowConsumer, "GO");
        equal(report.readiness.stateLineage, "NO-GO");
    });

    it("rejects productive hardlinks and junction roots at the loader boundary", async function () {
        const source = await loadInstrumentedSource();
        const root = await mkdtemp(join(tmpdir(), "k33-source-"));
        const outside = await mkdtemp(join(tmpdir(), "k33-outside-"));
        try {
            const member = join(root, "member.json");
            await writeFile(member, "{}\n");
            equal((await source.readSnapshot(root, "member.json")).bytes.toString("utf8"), "{}\n");
            await link(member, join(root, "alias.json"));
            await rejects(source.readSnapshot(root, "member.json"), /single-link regular non-link file/);

            const target = join(outside, "directory");
            await mkdir(target);
            const junction = join(root, "junction");
            try {
                await symlink(target, junction, process.platform === "win32" ? "junction" : "dir");
            } catch (error: any) {
                if (error?.code === "EPERM") this.skip();
                throw error;
            }
            await rejects(source.regularRoot(junction), /regular non-link directory|symlink or junction rejected/);
        } finally {
            await rm(root, { recursive: true, force: true });
            await rm(outside, { recursive: true, force: true });
        }
    });

    it("distinguishes top-level and transformation paths and never binds release state", () => {
        const result = evaluateCharacterStructuralRepresentation(sidecar([
            record("1", { characterClass: "unawakened" }), record("2", { characterClass: "Extreme" }),
        ]), [productive("1", {
            characterClass: "Super",
            ezaPassive: "diagnostic only",
            sezaPassive: "diagnostic only",
            transformations: [productive("2", { characterClass: "Super" })],
        })]);
        equal(result.inventory.comparableCardIds, 2);
        equal(result.nonExclusiveDiagnostics.productiveTopLevelComparableRecords, 1);
        equal(result.nonExclusiveDiagnostics.productiveTransformationComparableRecords, 1);
        equal(result.nonExclusiveDiagnostics.releaseStateBindingUnavailable, 2);
        equal(result.nonExclusiveDiagnostics.productiveComparableRecordsWithEzaPrefixedFields, 1);
        equal(result.nonExclusiveDiagnostics.productiveComparableRecordsWithSezaPrefixedFields, 1);
        deepStrictEqual(result.dimensions.characterClass.examples.map(item => ({
            kind: item.recordKind, path: item.productivePath, state: item.releaseStateBinding,
        })), [
            { kind: "top_level", path: "$[0]", state: "unavailable" },
            { kind: "transformation", path: "$[0].transformations[0]", state: "unavailable" },
        ]);
    });

    it("fails closed for duplicate productive or K32 card IDs", () => {
        throws(() => evaluateCharacterStructuralRepresentation(sidecar([record("1")]), [productive("1"), productive("1")]), /ambiguous duplicate productive cardId/);
        throws(() => evaluateCharacterStructuralRepresentation(sidecar([record("1"), record("1")]), [productive("1")]), /ambiguous duplicate K32 cardId/);
    });

    it("treats Super, Extreme and unawakened divergence as representation mismatch, never conflict", () => {
        const result = evaluateCharacterStructuralRepresentation(sidecar([
            record("1", { characterClass: "Super" }), record("2", { characterClass: "unawakened" }),
        ]), [productive("1", { characterClass: "Extreme" }), productive("2", { characterClass: "Super" })]);
        equal(result.dimensions.characterClass.exclusive.representation_mismatch, 2);
        equal(result.nonExclusiveDiagnostics.confirmedConflictCount, 0);
        equal(result.nonExclusiveDiagnostics.zeroConfirmedConflictEstablishesCompleteness, false);
    });

    it("separates ordered agreement, order-only multiset equality and different representation", () => {
        const result = evaluateCharacterStructuralRepresentation(sidecar([
            record("1"), record("2"), record("3"),
        ]), [
            productive("1"),
            productive("2", { categories: ["B", "A"], links: ["L2", "L1"] }),
            productive("3", { categories: ["A", "C"], links: ["L1", "L3"] }),
        ]);
        for (const field of ["categories", "links"] as const) {
            equal(result.dimensions[field].exclusive.ordered_agreement, 1);
            equal(result.dimensions[field].exclusive.same_multiset_different_order, 1);
            equal(result.dimensions[field].exclusive.different_representation, 1);
        }
    });

    it("keeps empty or absent containers and unresolved presentation mappings unknown", () => {
        const result = evaluateCharacterStructuralRepresentation(sidecar([
            record("1", { categories: [], categoryState: "empty_with_container_provenance_absence_unproved" }),
            record("2", { categories: [], categoryState: "absent_unproved" }),
            record("3", { unresolvedCategoryLabel: true }),
        ]), [productive("1", { categories: [] }), productive("2", { categories: [] }), productive("3")]);
        equal(result.dimensions.categories.exclusive.unknown, 3);
        equal(result.dimensions.categories.nonExclusiveDiagnostics.emptyContainerAbsenceUnproved, 1);
        equal(result.dimensions.categories.nonExclusiveDiagnostics.absentContainerUnproved, 1);
        equal(result.dimensions.categories.nonExclusiveDiagnostics.presentationLabelUnresolved, 1);
    });

    it("bounds examples to five per dimension", () => {
        const records = Array.from({ length: 8 }, (_, index) => record(String(index + 1), { characterClass: "Extreme" }));
        const characters = Array.from({ length: 8 }, (_, index) => productive(String(index + 1), {
            characterClass: "Super", categories: ["X"], links: ["Y"],
        }));
        const result = evaluateCharacterStructuralRepresentation(sidecar(records), characters);
        equal(result.dimensions.characterClass.examples.length, 5);
        equal(result.dimensions.categories.examples.length, 5);
        equal(result.dimensions.links.examples.length, 5);
    });

    it("does not mutate inputs and evaluates deterministically", () => {
        const sourceSidecar = sidecar([record("1"), record("2")]);
        const characters = [productive("1"), productive("2", { categories: ["B", "A"] })];
        const sidecarBefore = JSON.stringify(sourceSidecar);
        const charactersBefore = JSON.stringify(characters);
        const first = evaluateCharacterStructuralRepresentation(sourceSidecar, characters);
        const second = evaluateCharacterStructuralRepresentation(sourceSidecar, characters);
        deepStrictEqual(first, second);
        equal(JSON.stringify(sourceSidecar), sidecarBefore);
        equal(JSON.stringify(characters), charactersBefore);
    });

    it("can run the exact local pins twice when all K33 roots are supplied", async function () {
        this.timeout(30_000);
        const k32Root = process.env.K33_K32_ROOT;
        const k2Root = process.env.K33_K2_ROOT;
        const productiveRoot = process.env.K33_PRODUCTIVE_ROOT;
        if (!k32Root || !k2Root || !productiveRoot) this.skip();
        const options = { optIn: true as const, k32Root: k32Root!, k2Root: k2Root!, productiveRoot: productiveRoot! };
        const first = Buffer.from(`${JSON.stringify(await runCharacterStructuralShadow(options), null, 2)}\n`);
        const second = Buffer.from(`${JSON.stringify(await runCharacterStructuralShadow(options), null, 2)}\n`);
        ok(first.equals(second));
        equal(createHash("sha256").update(first).digest("hex"), createHash("sha256").update(second).digest("hex"));
    });
});
