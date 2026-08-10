import { deepStrictEqual, equal, ok, rejects, throws } from "assert";
import { readFile } from "fs/promises";
import * as ModuleApi from "module";
import { basename, dirname, join, resolve } from "path";
import { ModuleKind, ScriptTarget, transpileModule } from "typescript";
import type { CharacterCompactManifest, CharacterCompactProjection } from "./compact-contract";
import {
    parseCharacterCompactPromotionCli,
    runCharacterCompactPromotion,
} from "./compact-promotion";
import * as compactPromotion from "./compact-promotion";

type Evaluate = (projection: CharacterCompactProjection, manifest: CharacterCompactManifest, characters: any[]) => any;
type Index = (characters: any[]) => { selected: Map<string, { sourceRecordPath: string }>; ambiguous: Map<string, string[]> };

async function loadInternals(fileName: "compact-consumer" | "compact-promotion"): Promise<{ evaluate?: Evaluate; index: Index }> {
    const parent = resolve(__dirname, "..");
    const sourceRoot = basename(parent).toLowerCase() === "lib" ? resolve(parent, "..") : parent;
    const sourcePath = join(sourceRoot, "database-characters", `${fileName}.ts`);
    const runtimePath = basename(parent).toLowerCase() === "lib"
        ? join(parent, "database-characters", `${fileName}.js`)
        : sourcePath;
    const source = await readFile(sourcePath, "utf8");
    const names = fileName === "compact-promotion"
        ? "evaluateValidatedInputs as __testEvaluate, indexProductionStates as __testIndex"
        : "indexProductionStates as __testIndex";
    const compiled = transpileModule(`${source}\nexport { ${names} };\n`, {
        compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2022 },
        fileName: sourcePath,
    }).outputText;
    const ModuleConstructor = (ModuleApi as any).default ?? ModuleApi;
    const runtimeModule = new ModuleConstructor(runtimePath, module);
    runtimeModule.filename = runtimePath;
    runtimeModule.paths = ModuleConstructor._nodeModulePaths(dirname(runtimePath));
    runtimeModule._compile(compiled, runtimePath);
    return { evaluate: runtimeModule.exports.__testEvaluate, index: runtimeModule.exports.__testIndex };
}

function projection(records: any[]): CharacterCompactProjection {
    return { records } as CharacterCompactProjection;
}

function manifest(): CharacterCompactManifest {
    return {
        generatedAt: "2026-08-05T00:00:00.000Z",
        datasetVersion: "global-6.4.0-v338-2026-08-05-k15-v1",
        fileName: "database-characters-k15-compact-supported.pin.json.gz",
        sha256: "payload-pin",
    } as CharacterCompactManifest;
}

describe("database character K17 compact in-memory promotion overlay", () => {
    let evaluate: Evaluate;

    before(async () => {
        const internals = await loadInternals("compact-promotion");
        evaluate = internals.evaluate!;
    });

    it("creates the golden null-fill candidate and proves post-overlay agreement", () => {
        const report = evaluate(
            projection([{ cardId: "2", stateId: "20", rarity: "UR", type: "TEQ" }]),
            manifest(),
            [{ id: "base", rarity: "SSR", type: "AGL", transformations: [{ id: "2", rarity: null, type: "TEQ" }] }],
        );
        equal(report.candidates.count, 1);
        equal(report.candidates.sha256, "cff51add462a6e744df379b527311c4983a405a1c6a7cd3c51a780546db0b393");
        equal(report.evaluation.rarity.nullFillCandidates, 1);
        equal(report.evaluation.type.changes, 0);
        equal(report.evaluation.blockers.total, 0);
        equal(report.overlayProof.candidatesAppliedToClone, 1);
        equal(report.overlayProof.postOverlay.allFieldAgreements, 1);
        equal(report.readiness.experimentalInMemoryOverlay, "GO");
        deepStrictEqual(report.examples, [{
            kind: "null_fill_candidate", cardId: "2", stateId: "20", field: "rarity",
            reason: "productive_null_k15_supported", k15Value: "UR", productionValue: null,
            productionPath: "$[0].transformations[0]",
        }]);
    });

    it("blocks a non-null rarity mismatch without overwriting it", () => {
        const characters = [{ id: "1", rarity: "SSR", type: "AGL" }];
        const before = JSON.stringify(characters);
        const report = evaluate(projection([{ cardId: "1", stateId: "10", rarity: "UR", type: "AGL" }]), manifest(), characters);
        equal(report.candidates.count, 0);
        equal(report.evaluation.rarity.nonNullDifferences, 1);
        equal(report.evaluation.rarity.nonNullOverwrites, 0);
        equal(report.evaluation.blockers.rarityNonNullDifferences, 1);
        equal(report.readiness.experimentalInMemoryOverlay, "NO-GO");
        equal(JSON.stringify(characters), before);
    });

    it("blocks a type mismatch and never proposes a type change", () => {
        const report = evaluate(
            projection([{ cardId: "1", stateId: "10", rarity: "UR", type: "AGL" }]),
            manifest(),
            [{ id: "1", rarity: "UR", type: "STR" }],
        );
        equal(report.evaluation.type.differences, 1);
        equal(report.evaluation.type.changes, 0);
        equal(report.evaluation.blockers.typeDifferences, 1);
        equal(report.overlayProof.postOverlay.typeAgreements, 0);
    });

    it("globally suppresses a valid candidate when any blocker exists", () => {
        const compact = projection([
            { cardId: "1", stateId: "10", rarity: "UR", type: "AGL" },
            { cardId: "2", stateId: "20", rarity: "SSR", type: "TEQ" },
        ]);
        const characters = [
            { id: "1", rarity: null, type: "AGL" },
            { id: "2", rarity: "SSR", type: "STR" },
        ];
        const compactBefore = JSON.stringify(compact);
        const charactersBefore = JSON.stringify(characters);
        const report = evaluate(compact, manifest(), characters);

        equal(report.candidates.count, 1);
        equal(report.evaluation.blockers.total, 1);
        equal(report.evaluation.blockers.typeDifferences, 1);
        equal(report.overlayProof.candidatesAppliedToClone, 0);
        equal(report.overlayProof.postOverlay.rarityAgreements, 1);
        equal(report.overlayProof.postOverlay.allFieldAgreements, 0);
        equal(report.overlayProof.postOverlay.blockers, 2);
        equal(report.readiness.experimentalInMemoryOverlay, "NO-GO");
        equal(JSON.stringify(compact), compactBefore);
        equal(JSON.stringify(characters), charactersBefore);
    });

    it("blocks missing bindings and missing type values", () => {
        const records = projection([
            { cardId: "1", stateId: "10", rarity: "UR", type: "AGL" },
            { cardId: "2", stateId: "20", rarity: "SSR", type: "TEQ" },
        ]);
        const report = evaluate(records, manifest(), [{ id: "1" }]);
        equal(report.evaluation.blockers.missingBindings, 1);
        equal(report.evaluation.blockers.typeMissing, 1);
        equal(report.evaluation.blockers.rarityMissing, 0);
        equal(report.evaluation.blockers.total, 2);
        equal(report.candidates.count, 1);
        equal(report.overlayProof.candidatesAppliedToClone, 0);
    });

    it("uses K16 null normalization for an absent rarity and restores the clone shape", () => {
        const characters = [{ id: "1", type: "AGL" }];
        const before = JSON.stringify(characters);
        const report = evaluate(
            projection([{ cardId: "1", stateId: "10", rarity: "UR", type: "AGL" }]),
            manifest(),
            characters,
        );
        equal(report.candidates.count, 1);
        equal(report.overlayProof.postOverlay.allFieldAgreements, 1);
        equal(JSON.stringify(characters), before);
    });

    it("keeps K16 first-path selection stable after filling an equal nested duplicate", () => {
        const characters = [{ id: "base", rarity: "UR", type: "STR", transformations: [
            { id: "2", type: "TEQ" },
            { id: "2", type: "TEQ" },
        ] }];
        const before = JSON.stringify(characters);
        const report = evaluate(
            projection([{ cardId: "2", stateId: "20", rarity: "SSR", type: "TEQ" }]),
            manifest(),
            characters,
        );
        equal(report.candidates.count, 1);
        equal(report.examples[0].productionPath, "$[0].transformations[0]");
        equal(report.overlayProof.postOverlay.allFieldAgreements, 1);
        equal(report.overlayProof.postOverlay.blockers, 0);
        equal(JSON.stringify(characters), before);
    });

    it("blocks duplicate top-level and divergent nested bindings", () => {
        const records = projection([
            { cardId: "1", stateId: "10", rarity: "UR", type: "AGL" },
            { cardId: "2", stateId: "20", rarity: "SSR", type: "TEQ" },
        ]);
        const report = evaluate(records, manifest(), [
            { id: "1", rarity: "UR", type: "AGL" },
            { id: "1", rarity: "UR", type: "AGL" },
            { id: "base", rarity: "UR", type: "STR", transformations: [
                { id: "2", rarity: "SSR", type: "TEQ" },
                { id: "2", rarity: "UR", type: "TEQ" },
            ] },
        ]);
        equal(report.evaluation.binding.ambiguous, 2);
        equal(report.evaluation.blockers.ambiguousBindings, 2);
        equal(report.evaluation.type.ambiguous, 2);
        equal(report.evaluation.rarity.ambiguous, 2);
    });

    it("matches K16 precedence and first-path selection", async () => {
        const [k16, k17] = await Promise.all([loadInternals("compact-consumer"), loadInternals("compact-promotion")]);
        const characters = [
            { id: "1", rarity: "SSR", type: "AGL", transformations: [{ id: "1", rarity: "UR", type: "AGL" }] },
            { id: "base", rarity: "UR", type: "STR", transformations: [
                { id: "2", rarity: null, type: "TEQ" },
                { id: "2", rarity: null, type: "TEQ" },
                { id: "3", rarity: "UR", type: "PHY" },
                { id: "3", rarity: "SSR", type: "PHY" },
            ] },
        ];
        const oldIndex = k16.index(characters);
        const newIndex = k17.index(characters);
        deepStrictEqual([...newIndex.selected.keys()], [...oldIndex.selected.keys()]);
        deepStrictEqual([...newIndex.ambiguous.keys()], [...oldIndex.ambiguous.keys()]);
        equal(newIndex.selected.get("1")!.sourceRecordPath, oldIndex.selected.get("1")!.sourceRecordPath);
        equal(newIndex.selected.get("2")!.sourceRecordPath, oldIndex.selected.get("2")!.sourceRecordPath);
        equal(newIndex.selected.get("2")!.sourceRecordPath, "$[1].transformations[0]");
    });

    it("does not mutate K15, production, or expose Character/application APIs", async () => {
        const compact = projection([{ cardId: "1", stateId: "10", rarity: "UR", type: "AGL" }]);
        const characters = [{ id: "1", rarity: null, type: "AGL" }];
        const compactBefore = JSON.stringify(compact);
        const charactersBefore = JSON.stringify(characters);
        const report = evaluate(compact, manifest(), characters);
        equal(JSON.stringify(compact), compactBefore);
        equal(JSON.stringify(characters), charactersBefore);
        equal(report.inputIntegrity.originalInputsUnchanged, true);
        equal(report.inputIntegrity.overlayCloneIsolated, true);
        equal(report.overlayProof.originalProductionRecordsMutated, 0);
        equal((compactPromotion as any).apply, undefined);
        equal((compactPromotion as any).merge, undefined);
        equal((compactPromotion as any).write, undefined);
        equal((compactPromotion as any).characters, undefined);

        const parent = resolve(__dirname, "..");
        const sourceRoot = basename(parent).toLowerCase() === "lib" ? resolve(parent, "..") : parent;
        const source = await readFile(join(sourceRoot, "database-characters", "compact-promotion.ts"), "utf8");
        ok(source.includes("validateCharacterCompactArtifact(k15Root)"));
        ok(source.includes("CHARACTER_COMPACT_CONSUMER_PRODUCTION_PIN"));
        ok(!/from ["']\.\/(compact-source|shadow-source|shadow-release)["']/.test(source));
        ok(!/export .*Character\[\]/.test(source));
    });

    it("requires exactly one opt-in and accepts only read-only roots", async () => {
        await rejects(runCharacterCompactPromotion({} as any), /explicit opt-in/);
        throws(() => parseCharacterCompactPromotionCli([]), /exactly one explicit --opt-in-k17/);
        throws(() => parseCharacterCompactPromotionCli(["--opt-in-k17", "--opt-in-k17"]), /exactly one/);
        throws(() => parseCharacterCompactPromotionCli(["--opt-in-k17", "--output", "report.json"]), /unsupported argument/);
        throws(() => parseCharacterCompactPromotionCli(["--opt-in-k17", "position.json"]), /unsupported argument/);
        throws(() => parseCharacterCompactPromotionCli(["--opt-in-k17", "--k15-root"]), /missing value/);
        throws(() => parseCharacterCompactPromotionCli(["--opt-in-k17", "--k15-root", "a", "--k15-root", "b"]), /duplicate/);
        deepStrictEqual(parseCharacterCompactPromotionCli([
            "--opt-in-k17", "--k15-root", "k15", "--production-root", "production",
        ]), { optIn: true, k15Root: "k15", productionRoot: "production" });
    });
});
