import { createHash } from "crypto";
import { deepStrictEqual, equal, ok, rejects, throws } from "assert";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "fs/promises";
import * as ModuleApi from "module";
import { tmpdir } from "os";
import { basename, dirname, join, resolve } from "path";
import { ModuleKind, ScriptTarget, transpileModule } from "typescript";
import type { CharacterCompactManifest, CharacterCompactProjection } from "./compact-contract";
import {
    parseCharacterCompactConsumerCli,
    runCharacterCompactConsumer,
} from "./compact-consumer";
import * as compactConsumer from "./compact-consumer";

type Compare = (projection: CharacterCompactProjection, manifest: CharacterCompactManifest, characters: any[]) => any;
type ParseProduction = (bytes: Buffer, expected?: { sha256: string; sizeBytes: number; topLevelCount: number }) => any[];

async function loadInternals(): Promise<{ compare: Compare; parseProduction: ParseProduction }> {
    const parent = resolve(__dirname, "..");
    const sourceRoot = basename(parent).toLowerCase() === "lib" ? resolve(parent, "..") : parent;
    const sourcePath = join(sourceRoot, "database-characters", "compact-consumer.ts");
    const runtimePath = basename(parent).toLowerCase() === "lib"
        ? join(parent, "database-characters", "compact-consumer.js")
        : sourcePath;
    const source = await readFile(sourcePath, "utf8");
    const instrumented = `${source}\nexport { compareValidatedInputs as __testCompare, parseProductionCharacters as __testParseProduction };\n`;
    const compiled = transpileModule(instrumented, {
        compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2022 },
        fileName: sourcePath,
    }).outputText;
    const ModuleConstructor = (ModuleApi as any).default ?? ModuleApi;
    const runtimeModule = new ModuleConstructor(runtimePath, module);
    runtimeModule.filename = runtimePath;
    runtimeModule.paths = ModuleConstructor._nodeModulePaths(dirname(runtimePath));
    runtimeModule._compile(compiled, runtimePath);
    return { compare: runtimeModule.exports.__testCompare, parseProduction: runtimeModule.exports.__testParseProduction };
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

describe("database character K16 compact compare consumer", () => {
    let root: string;
    beforeEach(async () => { root = await mkdtemp(join(tmpdir(), "dokkan-k16-")); });
    afterEach(async () => { await rm(root, { recursive: true, force: true }); });

    it("requires explicit opt-in and rejects unsupported CLI surfaces", async () => {
        await rejects(runCharacterCompactConsumer({} as any), /explicit opt-in/);
        throws(() => parseCharacterCompactConsumerCli([]), /explicit --opt-in-k16/);
        throws(() => parseCharacterCompactConsumerCli(["--opt-in-k16", "--output", "report.json"]), /unsupported argument/);
        deepStrictEqual(parseCharacterCompactConsumerCli(["--opt-in-k16"]), { optIn: true, k15Root: undefined, productionRoot: undefined });
    });

    it("fails closed for absent, corrupt and future-schema K15 inputs", async () => {
        const options = { optIn: true as const, k15Root: root, productionRoot: root };
        await rejects(runCharacterCompactConsumer(options), /NOT_FOUND|ENOENT/);
        await writeFile(join(root, "database-characters-k15-manifest.json"), "not-json");
        await rejects(runCharacterCompactConsumer(options), /JSON|Unexpected token/i);
        await writeFile(join(root, "database-characters-k15-manifest.json"), JSON.stringify({ schemaVersion: 2 }));
        await rejects(runCharacterCompactConsumer(options), /manifest contract rejected/);
    });

    it("rejects production hash and top-level cardinality drift", async () => {
        const { parseProduction } = await loadInternals();
        throws(() => parseProduction(Buffer.from("[]")), /identity changed/);
        const bytes = Buffer.from("[]");
        const sha256 = createHash("sha256").update(bytes).digest("hex");
        throws(() => parseProduction(bytes, { sha256, sizeBytes: bytes.length, topLevelCount: 1 }), /cardinality changed/);
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
        deepStrictEqual(first, second);
        equal(first.fields.id.agreements, 2);
        equal(first.fields.id.missing, 1);
        equal(first.fields.id.ambiguous, 1);
        equal(first.fields.rarity.agreements, 0);
        equal(first.fields.rarity.differences, 2);
        equal(first.fields.rarity.missing, 1);
        equal(first.fields.rarity.ambiguous, 1);
        equal(first.fields.type.agreements, 2);
        equal(first.fields.rarity.examples[0].productionPath, "$[0]");
        equal(first.fields.id.examples.find((item: any) => item.cardId === "3").ambiguousPaths.length, 2);
        equal(JSON.stringify(compact), beforeCompact);
        equal(JSON.stringify(characters), beforeCharacters);
        deepStrictEqual(first.inputIntegrity, {
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
        equal(report.fields.id.ambiguous, 1);
        equal(report.fields.id.missing, 7);
        equal(report.fields.id.examples.length, 5);
        deepStrictEqual(report.fields.id.examples.map((item: any) => item.cardId), ["1", "2", "3", "4", "5"]);
    });

    it("exports no apply or merge API and has no K11/source-reader import", async () => {
        equal((compactConsumer as any).apply, undefined);
        equal((compactConsumer as any).applyCharacterCompact, undefined);
        equal((compactConsumer as any).merge, undefined);
        equal((compactConsumer as any).mergeCharacters, undefined);
        const parent = resolve(__dirname, "..");
        const sourceRoot = basename(parent).toLowerCase() === "lib" ? resolve(parent, "..") : parent;
        const source = await readFile(join(sourceRoot, "database-characters", "compact-consumer.ts"), "utf8");
        ok(source.includes("validateCharacterCompactArtifact(k15Root)"));
        ok(!/from ["']\.\/(compact-source|shadow-source|shadow-release)["']/.test(source));
        const entry = require.cache[require.resolve("./compact-consumer")];
        const dependencies = new Set<string>();
        const visit = (loaded: NodeModule | undefined): void => {
            if (!loaded || dependencies.has(loaded.filename)) return;
            dependencies.add(loaded.filename);
            loaded.children.forEach(visit);
        };
        visit(entry);
        ok(![...dependencies].some(path => /[\\/](compact-source|shadow-source)\.[jt]s$/.test(path)));
    });
});
