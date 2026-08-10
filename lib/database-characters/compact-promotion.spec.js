"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const promises_1 = require("fs/promises");
const ModuleApi = require("module");
const path_1 = require("path");
const typescript_1 = require("typescript");
const compact_promotion_1 = require("./compact-promotion");
const compactPromotion = require("./compact-promotion");
async function loadInternals(fileName) {
    const parent = (0, path_1.resolve)(__dirname, "..");
    const sourceRoot = (0, path_1.basename)(parent).toLowerCase() === "lib" ? (0, path_1.resolve)(parent, "..") : parent;
    const sourcePath = (0, path_1.join)(sourceRoot, "database-characters", `${fileName}.ts`);
    const runtimePath = (0, path_1.basename)(parent).toLowerCase() === "lib"
        ? (0, path_1.join)(parent, "database-characters", `${fileName}.js`)
        : sourcePath;
    const source = await (0, promises_1.readFile)(sourcePath, "utf8");
    const names = fileName === "compact-promotion"
        ? "evaluateValidatedInputs as __testEvaluate, indexProductionStates as __testIndex"
        : "indexProductionStates as __testIndex";
    const compiled = (0, typescript_1.transpileModule)(`${source}\nexport { ${names} };\n`, {
        compilerOptions: { module: typescript_1.ModuleKind.CommonJS, target: typescript_1.ScriptTarget.ES2022 },
        fileName: sourcePath,
    }).outputText;
    const ModuleConstructor = ModuleApi.default ?? ModuleApi;
    const runtimeModule = new ModuleConstructor(runtimePath, module);
    runtimeModule.filename = runtimePath;
    runtimeModule.paths = ModuleConstructor._nodeModulePaths((0, path_1.dirname)(runtimePath));
    runtimeModule._compile(compiled, runtimePath);
    return { evaluate: runtimeModule.exports.__testEvaluate, index: runtimeModule.exports.__testIndex };
}
function projection(records) {
    return { records };
}
function manifest() {
    return {
        generatedAt: "2026-08-05T00:00:00.000Z",
        datasetVersion: "global-6.4.0-v338-2026-08-05-k15-v1",
        fileName: "database-characters-k15-compact-supported.pin.json.gz",
        sha256: "payload-pin",
    };
}
describe("database character K17 compact in-memory promotion overlay", () => {
    let evaluate;
    before(async () => {
        const internals = await loadInternals("compact-promotion");
        evaluate = internals.evaluate;
    });
    it("creates the golden null-fill candidate and proves post-overlay agreement", () => {
        const report = evaluate(projection([{ cardId: "2", stateId: "20", rarity: "UR", type: "TEQ" }]), manifest(), [{ id: "base", rarity: "SSR", type: "AGL", transformations: [{ id: "2", rarity: null, type: "TEQ" }] }]);
        (0, assert_1.equal)(report.candidates.count, 1);
        (0, assert_1.equal)(report.candidates.sha256, "cff51add462a6e744df379b527311c4983a405a1c6a7cd3c51a780546db0b393");
        (0, assert_1.equal)(report.evaluation.rarity.nullFillCandidates, 1);
        (0, assert_1.equal)(report.evaluation.type.changes, 0);
        (0, assert_1.equal)(report.evaluation.blockers.total, 0);
        (0, assert_1.equal)(report.overlayProof.candidatesAppliedToClone, 1);
        (0, assert_1.equal)(report.overlayProof.postOverlay.allFieldAgreements, 1);
        (0, assert_1.equal)(report.readiness.experimentalInMemoryOverlay, "GO");
        (0, assert_1.deepStrictEqual)(report.examples, [{
                kind: "null_fill_candidate", cardId: "2", stateId: "20", field: "rarity",
                reason: "productive_null_k15_supported", k15Value: "UR", productionValue: null,
                productionPath: "$[0].transformations[0]",
            }]);
    });
    it("blocks a non-null rarity mismatch without overwriting it", () => {
        const characters = [{ id: "1", rarity: "SSR", type: "AGL" }];
        const before = JSON.stringify(characters);
        const report = evaluate(projection([{ cardId: "1", stateId: "10", rarity: "UR", type: "AGL" }]), manifest(), characters);
        (0, assert_1.equal)(report.candidates.count, 0);
        (0, assert_1.equal)(report.evaluation.rarity.nonNullDifferences, 1);
        (0, assert_1.equal)(report.evaluation.rarity.nonNullOverwrites, 0);
        (0, assert_1.equal)(report.evaluation.blockers.rarityNonNullDifferences, 1);
        (0, assert_1.equal)(report.readiness.experimentalInMemoryOverlay, "NO-GO");
        (0, assert_1.equal)(JSON.stringify(characters), before);
    });
    it("blocks a type mismatch and never proposes a type change", () => {
        const report = evaluate(projection([{ cardId: "1", stateId: "10", rarity: "UR", type: "AGL" }]), manifest(), [{ id: "1", rarity: "UR", type: "STR" }]);
        (0, assert_1.equal)(report.evaluation.type.differences, 1);
        (0, assert_1.equal)(report.evaluation.type.changes, 0);
        (0, assert_1.equal)(report.evaluation.blockers.typeDifferences, 1);
        (0, assert_1.equal)(report.overlayProof.postOverlay.typeAgreements, 0);
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
        (0, assert_1.equal)(report.candidates.count, 1);
        (0, assert_1.equal)(report.evaluation.blockers.total, 1);
        (0, assert_1.equal)(report.evaluation.blockers.typeDifferences, 1);
        (0, assert_1.equal)(report.overlayProof.candidatesAppliedToClone, 0);
        (0, assert_1.equal)(report.overlayProof.postOverlay.rarityAgreements, 1);
        (0, assert_1.equal)(report.overlayProof.postOverlay.allFieldAgreements, 0);
        (0, assert_1.equal)(report.overlayProof.postOverlay.blockers, 2);
        (0, assert_1.equal)(report.readiness.experimentalInMemoryOverlay, "NO-GO");
        (0, assert_1.equal)(JSON.stringify(compact), compactBefore);
        (0, assert_1.equal)(JSON.stringify(characters), charactersBefore);
    });
    it("blocks missing bindings and missing type values", () => {
        const records = projection([
            { cardId: "1", stateId: "10", rarity: "UR", type: "AGL" },
            { cardId: "2", stateId: "20", rarity: "SSR", type: "TEQ" },
        ]);
        const report = evaluate(records, manifest(), [{ id: "1" }]);
        (0, assert_1.equal)(report.evaluation.blockers.missingBindings, 1);
        (0, assert_1.equal)(report.evaluation.blockers.typeMissing, 1);
        (0, assert_1.equal)(report.evaluation.blockers.rarityMissing, 0);
        (0, assert_1.equal)(report.evaluation.blockers.total, 2);
        (0, assert_1.equal)(report.candidates.count, 1);
        (0, assert_1.equal)(report.overlayProof.candidatesAppliedToClone, 0);
    });
    it("uses K16 null normalization for an absent rarity and restores the clone shape", () => {
        const characters = [{ id: "1", type: "AGL" }];
        const before = JSON.stringify(characters);
        const report = evaluate(projection([{ cardId: "1", stateId: "10", rarity: "UR", type: "AGL" }]), manifest(), characters);
        (0, assert_1.equal)(report.candidates.count, 1);
        (0, assert_1.equal)(report.overlayProof.postOverlay.allFieldAgreements, 1);
        (0, assert_1.equal)(JSON.stringify(characters), before);
    });
    it("keeps K16 first-path selection stable after filling an equal nested duplicate", () => {
        const characters = [{ id: "base", rarity: "UR", type: "STR", transformations: [
                    { id: "2", type: "TEQ" },
                    { id: "2", type: "TEQ" },
                ] }];
        const before = JSON.stringify(characters);
        const report = evaluate(projection([{ cardId: "2", stateId: "20", rarity: "SSR", type: "TEQ" }]), manifest(), characters);
        (0, assert_1.equal)(report.candidates.count, 1);
        (0, assert_1.equal)(report.examples[0].productionPath, "$[0].transformations[0]");
        (0, assert_1.equal)(report.overlayProof.postOverlay.allFieldAgreements, 1);
        (0, assert_1.equal)(report.overlayProof.postOverlay.blockers, 0);
        (0, assert_1.equal)(JSON.stringify(characters), before);
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
        (0, assert_1.equal)(report.evaluation.binding.ambiguous, 2);
        (0, assert_1.equal)(report.evaluation.blockers.ambiguousBindings, 2);
        (0, assert_1.equal)(report.evaluation.type.ambiguous, 2);
        (0, assert_1.equal)(report.evaluation.rarity.ambiguous, 2);
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
        (0, assert_1.deepStrictEqual)([...newIndex.selected.keys()], [...oldIndex.selected.keys()]);
        (0, assert_1.deepStrictEqual)([...newIndex.ambiguous.keys()], [...oldIndex.ambiguous.keys()]);
        (0, assert_1.equal)(newIndex.selected.get("1").sourceRecordPath, oldIndex.selected.get("1").sourceRecordPath);
        (0, assert_1.equal)(newIndex.selected.get("2").sourceRecordPath, oldIndex.selected.get("2").sourceRecordPath);
        (0, assert_1.equal)(newIndex.selected.get("2").sourceRecordPath, "$[1].transformations[0]");
    });
    it("does not mutate K15, production, or expose Character/application APIs", async () => {
        const compact = projection([{ cardId: "1", stateId: "10", rarity: "UR", type: "AGL" }]);
        const characters = [{ id: "1", rarity: null, type: "AGL" }];
        const compactBefore = JSON.stringify(compact);
        const charactersBefore = JSON.stringify(characters);
        const report = evaluate(compact, manifest(), characters);
        (0, assert_1.equal)(JSON.stringify(compact), compactBefore);
        (0, assert_1.equal)(JSON.stringify(characters), charactersBefore);
        (0, assert_1.equal)(report.inputIntegrity.originalInputsUnchanged, true);
        (0, assert_1.equal)(report.inputIntegrity.overlayCloneIsolated, true);
        (0, assert_1.equal)(report.overlayProof.originalProductionRecordsMutated, 0);
        (0, assert_1.equal)(compactPromotion.apply, undefined);
        (0, assert_1.equal)(compactPromotion.merge, undefined);
        (0, assert_1.equal)(compactPromotion.write, undefined);
        (0, assert_1.equal)(compactPromotion.characters, undefined);
        const parent = (0, path_1.resolve)(__dirname, "..");
        const sourceRoot = (0, path_1.basename)(parent).toLowerCase() === "lib" ? (0, path_1.resolve)(parent, "..") : parent;
        const source = await (0, promises_1.readFile)((0, path_1.join)(sourceRoot, "database-characters", "compact-promotion.ts"), "utf8");
        (0, assert_1.ok)(source.includes("validateCharacterCompactArtifact(k15Root)"));
        (0, assert_1.ok)(source.includes("CHARACTER_COMPACT_CONSUMER_PRODUCTION_PIN"));
        (0, assert_1.ok)(!/from ["']\.\/(compact-source|shadow-source|shadow-release)["']/.test(source));
        (0, assert_1.ok)(!/export .*Character\[\]/.test(source));
    });
    it("requires exactly one opt-in and accepts only read-only roots", async () => {
        await (0, assert_1.rejects)((0, compact_promotion_1.runCharacterCompactPromotion)({}), /explicit opt-in/);
        (0, assert_1.throws)(() => (0, compact_promotion_1.parseCharacterCompactPromotionCli)([]), /exactly one explicit --opt-in-k17/);
        (0, assert_1.throws)(() => (0, compact_promotion_1.parseCharacterCompactPromotionCli)(["--opt-in-k17", "--opt-in-k17"]), /exactly one/);
        (0, assert_1.throws)(() => (0, compact_promotion_1.parseCharacterCompactPromotionCli)(["--opt-in-k17", "--output", "report.json"]), /unsupported argument/);
        (0, assert_1.throws)(() => (0, compact_promotion_1.parseCharacterCompactPromotionCli)(["--opt-in-k17", "position.json"]), /unsupported argument/);
        (0, assert_1.throws)(() => (0, compact_promotion_1.parseCharacterCompactPromotionCli)(["--opt-in-k17", "--k15-root"]), /missing value/);
        (0, assert_1.throws)(() => (0, compact_promotion_1.parseCharacterCompactPromotionCli)(["--opt-in-k17", "--k15-root", "a", "--k15-root", "b"]), /duplicate/);
        (0, assert_1.deepStrictEqual)((0, compact_promotion_1.parseCharacterCompactPromotionCli)([
            "--opt-in-k17", "--k15-root", "k15", "--production-root", "production",
        ]), { optIn: true, k15Root: "k15", productionRoot: "production" });
    });
});
//# sourceMappingURL=compact-promotion.spec.js.map