"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = require("crypto");
const assert_1 = require("assert");
const promises_1 = require("fs/promises");
const ModuleApi = require("module");
const os_1 = require("os");
const path_1 = require("path");
const typescript_1 = require("typescript");
const compact_consumer_1 = require("./compact-consumer");
const compactConsumer = require("./compact-consumer");
async function loadInternals() {
    const parent = (0, path_1.resolve)(__dirname, "..");
    const sourceRoot = (0, path_1.basename)(parent).toLowerCase() === "lib" ? (0, path_1.resolve)(parent, "..") : parent;
    const sourcePath = (0, path_1.join)(sourceRoot, "database-characters", "compact-consumer.ts");
    const runtimePath = (0, path_1.basename)(parent).toLowerCase() === "lib"
        ? (0, path_1.join)(parent, "database-characters", "compact-consumer.js")
        : sourcePath;
    const source = await (0, promises_1.readFile)(sourcePath, "utf8");
    const instrumented = `${source}\nexport { compareValidatedInputs as __testCompare, parseProductionCharacters as __testParseProduction };\n`;
    const compiled = (0, typescript_1.transpileModule)(instrumented, {
        compilerOptions: { module: typescript_1.ModuleKind.CommonJS, target: typescript_1.ScriptTarget.ES2022 },
        fileName: sourcePath,
    }).outputText;
    const ModuleConstructor = ModuleApi.default ?? ModuleApi;
    const runtimeModule = new ModuleConstructor(runtimePath, module);
    runtimeModule.filename = runtimePath;
    runtimeModule.paths = ModuleConstructor._nodeModulePaths((0, path_1.dirname)(runtimePath));
    runtimeModule._compile(compiled, runtimePath);
    return { compare: runtimeModule.exports.__testCompare, parseProduction: runtimeModule.exports.__testParseProduction };
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
describe("database character K16 compact compare consumer", () => {
    let root;
    beforeEach(async () => { root = await (0, promises_1.mkdtemp)((0, path_1.join)((0, os_1.tmpdir)(), "dokkan-k16-")); });
    afterEach(async () => { await (0, promises_1.rm)(root, { recursive: true, force: true }); });
    it("requires explicit opt-in and rejects unsupported CLI surfaces", async () => {
        await (0, assert_1.rejects)((0, compact_consumer_1.runCharacterCompactConsumer)({}), /explicit opt-in/);
        (0, assert_1.throws)(() => (0, compact_consumer_1.parseCharacterCompactConsumerCli)([]), /explicit --opt-in-k16/);
        (0, assert_1.throws)(() => (0, compact_consumer_1.parseCharacterCompactConsumerCli)(["--opt-in-k16", "--output", "report.json"]), /unsupported argument/);
        (0, assert_1.deepStrictEqual)((0, compact_consumer_1.parseCharacterCompactConsumerCli)(["--opt-in-k16"]), { optIn: true, k15Root: undefined, productionRoot: undefined });
    });
    it("fails closed for absent, corrupt and future-schema K15 inputs", async () => {
        const options = { optIn: true, k15Root: root, productionRoot: root };
        await (0, assert_1.rejects)((0, compact_consumer_1.runCharacterCompactConsumer)(options), /NOT_FOUND|ENOENT/);
        await (0, promises_1.writeFile)((0, path_1.join)(root, "database-characters-k15-manifest.json"), "not-json");
        await (0, assert_1.rejects)((0, compact_consumer_1.runCharacterCompactConsumer)(options), /JSON|Unexpected token/i);
        await (0, promises_1.writeFile)((0, path_1.join)(root, "database-characters-k15-manifest.json"), JSON.stringify({ schemaVersion: 2 }));
        await (0, assert_1.rejects)((0, compact_consumer_1.runCharacterCompactConsumer)(options), /manifest contract rejected/);
    });
    it("rejects production hash and top-level cardinality drift", async () => {
        const { parseProduction } = await loadInternals();
        (0, assert_1.throws)(() => parseProduction(Buffer.from("[]")), /identity changed/);
        const bytes = Buffer.from("[]");
        const sha256 = (0, crypto_1.createHash)("sha256").update(bytes).digest("hex");
        (0, assert_1.throws)(() => parseProduction(bytes, { sha256, sizeBytes: bytes.length, topLevelCount: 1 }), /cardinality changed/);
    });
    it("uses top-level precedence, the first equal nested path and fail-closed ambiguity", async () => {
        const { compare } = await loadInternals();
        const compact = projection([
            { cardId: "1", stateId: "s1", rarity: "UR", type: "AGL" },
            { cardId: "2", stateId: "s2", rarity: "SSR", type: "TEQ" },
            { cardId: "3", stateId: "s3", rarity: "UR", type: "PHY" },
            { cardId: "4", stateId: "s4", rarity: "LR", type: "INT" },
        ]);
        const characters = [
            { id: "1", rarity: "SSR", type: "AGL", transformations: [{ id: "1", rarity: "UR", type: "AGL" }] },
            { id: "base", rarity: "UR", type: "STR", transformations: [
                    { id: "2", rarity: null, type: "TEQ" },
                    { id: "2", rarity: null, type: "TEQ" },
                    { id: "3", rarity: "UR", type: "PHY" },
                    { id: "3", rarity: "SSR", type: "PHY" },
                ] },
        ];
        const beforeCompact = JSON.stringify(compact);
        const beforeCharacters = JSON.stringify(characters);
        const first = compare(compact, manifest(), characters);
        const second = compare(compact, manifest(), characters);
        (0, assert_1.deepStrictEqual)(first, second);
        (0, assert_1.equal)(first.fields.id.agreements, 2);
        (0, assert_1.equal)(first.fields.id.missing, 1);
        (0, assert_1.equal)(first.fields.id.ambiguous, 1);
        (0, assert_1.equal)(first.fields.rarity.agreements, 0);
        (0, assert_1.equal)(first.fields.rarity.differences, 2);
        (0, assert_1.equal)(first.fields.rarity.missing, 1);
        (0, assert_1.equal)(first.fields.rarity.ambiguous, 1);
        (0, assert_1.equal)(first.fields.type.agreements, 2);
        (0, assert_1.equal)(first.fields.rarity.examples[0].productionPath, "$[0]");
        (0, assert_1.equal)(first.fields.id.examples.find((item) => item.cardId === "3").ambiguousPaths.length, 2);
        (0, assert_1.equal)(JSON.stringify(compact), beforeCompact);
        (0, assert_1.equal)(JSON.stringify(characters), beforeCharacters);
        (0, assert_1.deepStrictEqual)(first.inputIntegrity, {
            k15ArtifactsByteRevalidated: true, k15ProjectionDeepEqual: true,
            productionBytesEqual: true, productionCharactersDeepEqual: true,
        });
    });
    it("treats duplicate top-level IDs as ambiguous and limits deterministic examples", async () => {
        const { compare } = await loadInternals();
        const records = Array.from({ length: 8 }, (_, index) => ({ cardId: String(index + 1), stateId: `s${index + 1}`, rarity: "UR", type: "AGL" }));
        const characters = [
            { id: "1", rarity: "UR", type: "AGL" },
            { id: "1", rarity: "UR", type: "AGL" },
        ];
        const report = compare(projection(records), manifest(), characters);
        (0, assert_1.equal)(report.fields.id.ambiguous, 1);
        (0, assert_1.equal)(report.fields.id.missing, 7);
        (0, assert_1.equal)(report.fields.id.examples.length, 5);
        (0, assert_1.deepStrictEqual)(report.fields.id.examples.map((item) => item.cardId), ["1", "2", "3", "4", "5"]);
    });
    it("exports no apply or merge API and has no K11/source-reader import", async () => {
        (0, assert_1.equal)(compactConsumer.apply, undefined);
        (0, assert_1.equal)(compactConsumer.applyCharacterCompact, undefined);
        (0, assert_1.equal)(compactConsumer.merge, undefined);
        (0, assert_1.equal)(compactConsumer.mergeCharacters, undefined);
        const parent = (0, path_1.resolve)(__dirname, "..");
        const sourceRoot = (0, path_1.basename)(parent).toLowerCase() === "lib" ? (0, path_1.resolve)(parent, "..") : parent;
        const source = await (0, promises_1.readFile)((0, path_1.join)(sourceRoot, "database-characters", "compact-consumer.ts"), "utf8");
        (0, assert_1.ok)(source.includes("validateCharacterCompactArtifact(k15Root)"));
        (0, assert_1.ok)(!/from ["']\.\/(compact-source|shadow-source|shadow-release)["']/.test(source));
        const entry = require.cache[require.resolve("./compact-consumer")];
        const dependencies = new Set();
        const visit = (loaded) => {
            if (!loaded || dependencies.has(loaded.filename))
                return;
            dependencies.add(loaded.filename);
            loaded.children.forEach(visit);
        };
        visit(entry);
        (0, assert_1.ok)(![...dependencies].some(path => /[\\/](compact-source|shadow-source)\.[jt]s$/.test(path)));
    });
});
//# sourceMappingURL=compact-consumer.spec.js.map