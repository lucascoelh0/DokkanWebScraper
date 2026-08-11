import { createHash } from "crypto";
import { readFile } from "fs/promises";
import { basename, join, resolve } from "path";
import type { Character } from "../character";
import { resolveCharacterInputFile } from "./artifact-path";
import {
    CHARACTER_COMPACT_PINNED_RELEASE,
    type CharacterCompactManifest,
    type CharacterCompactProjection,
} from "./compact-contract";
import { CHARACTER_COMPACT_CONSUMER_PRODUCTION_PIN } from "./compact-consumer-contract";
import { createCharacterCompactRarityOverlay } from "./compact-overlay";
import {
    CHARACTER_COMPACT_PROMOTION_CONTRACT_VERSION,
    CHARACTER_COMPACT_PROMOTION_EXAMPLE_LIMIT,
    CharacterCompactPromotionReport,
} from "./compact-promotion-contract";
import { validateCharacterCompactArtifact } from "./compact-validator";

const DEFAULT_PRODUCTION_ROOT = "D:/Dokkan/DokkanWebScraper/data";
const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

export interface CharacterCompactPromotionOptions {
    optIn: true;
    k15Root?: string;
    productionRoot?: string;
}

interface ProductionSnapshot {
    path: string;
    bytes: Buffer;
    characters: Character[];
    deepSnapshot: string;
}

function repositoryRoot(): string {
    const parent = resolve(__dirname, "..");
    return basename(parent).toLowerCase() === "lib" ? resolve(parent, "..") : parent;
}

function evaluateValidatedInputs(
    projection: CharacterCompactProjection,
    manifest: CharacterCompactManifest,
    characters: Character[],
): CharacterCompactPromotionReport {
    const overlay = createCharacterCompactRarityOverlay(characters, projection);
    const decision = overlay.decision;
    return {
        schemaVersion: 1,
        contract: "dokkan-database-character-compact-promotion-report",
        contractVersion: CHARACTER_COMPACT_PROMOTION_CONTRACT_VERSION,
        generatedAt: manifest.generatedAt,
        mode: "offline_in_memory_overlay_proof",
        sources: {
            k15: {
                contract: "dokkan-database-character-compact-shadow", contractVersion: "1.0.0",
                datasetVersion: manifest.datasetVersion, manifestFile: "database-characters-k15-manifest.json",
                manifestSha256: CHARACTER_COMPACT_PINNED_RELEASE.manifestSha256,
                payloadFile: manifest.fileName, payloadSha256: manifest.sha256, recordCount: projection.records.length,
            },
            productionCharacters: {
                contract: "Character[]", fileName: CHARACTER_COMPACT_CONSUMER_PRODUCTION_PIN.fileName,
                sha256: CHARACTER_COMPACT_CONSUMER_PRODUCTION_PIN.sha256,
                sizeBytes: CHARACTER_COMPACT_CONSUMER_PRODUCTION_PIN.sizeBytes,
                topLevelCount: characters.length,
            },
        },
        policy: {
            explicitOptIn: true, offlineOnly: true, inMemoryCloneOnly: true, k15Only: true,
            structuralIdJoinOnly: true, recordSelection: "top_level_then_first_equal_nested_structural_id",
            ambiguousDuplicatesFailClosed: true, rarityPolicy: "null_fill_only", typePolicy: "agreement_only",
            exampleLimit: CHARACTER_COMPACT_PROMOTION_EXAMPLE_LIMIT, returnsCharacters: false, catalogWritten: false,
            k11Read: false, sidecarsK0K14Read: false,
        },
        inventory: decision.inventory,
        evaluation: decision.evaluation,
        candidates: decision.candidates,
        examples: decision.examples,
        overlayProof: decision.overlayProof,
        inputIntegrity: {
            k15ArtifactsByteRevalidated: true, k15ProjectionDeepEqual: true, productionBytesEqual: true,
            productionCharactersDeepEqual: true, originalInputsUnchanged: decision.inputIntegrity.originalInputsUnchanged,
            overlayCloneIsolated: decision.inputIntegrity.overlayCloneIsolated,
        },
        readiness: {
            experimentalInMemoryOverlay: decision.readiness, authority: "NO-GO", production: "NO-GO",
            android: "NO-GO", r2: "NO-GO", publisher: "NO-GO", fyiRemoval: "NO-GO",
            dokkanInfoRemoval: "NO-GO",
        },
    };
}

function parseProductionCharacters(
    bytes: Buffer,
    expected: { sha256: string; sizeBytes: number; topLevelCount: number } = CHARACTER_COMPACT_CONSUMER_PRODUCTION_PIN,
): Character[] {
    if (bytes.length !== expected.sizeBytes || hash(bytes) !== expected.sha256) {
        throw new Error("K17 production Character[] identity changed");
    }
    const parsed = JSON.parse(bytes.toString("utf8"));
    if (!Array.isArray(parsed) || parsed.length !== expected.topLevelCount) {
        throw new Error("K17 production Character[] cardinality changed");
    }
    return parsed as Character[];
}

async function loadProductionSnapshot(root: string): Promise<ProductionSnapshot> {
    const path = await resolveCharacterInputFile(
        resolve(root),
        CHARACTER_COMPACT_CONSUMER_PRODUCTION_PIN.fileName,
        CHARACTER_COMPACT_CONSUMER_PRODUCTION_PIN.fileName,
    );
    const bytes = await readFile(path);
    const characters = parseProductionCharacters(bytes);
    return { path, bytes, characters, deepSnapshot: JSON.stringify(characters) };
}

export async function runCharacterCompactPromotion(options: CharacterCompactPromotionOptions): Promise<CharacterCompactPromotionReport> {
    if (options?.optIn !== true) throw new Error("K17 requires explicit opt-in");
    const k15Root = resolve(options.k15Root ?? join(repositoryRoot(), "data", "database-characters", "compact"));
    const productionRoot = resolve(options.productionRoot ?? DEFAULT_PRODUCTION_ROOT);
    const k15Before = await validateCharacterCompactArtifact(k15Root);
    const k15ValidationSnapshot = JSON.stringify(k15Before);
    const k15DeepSnapshot = JSON.stringify(k15Before.projection);
    const production = await loadProductionSnapshot(productionRoot);
    const report = evaluateValidatedInputs(k15Before.projection, k15Before.manifest, production.characters);

    if (JSON.stringify(k15Before.projection) !== k15DeepSnapshot || JSON.stringify(production.characters) !== production.deepSnapshot) {
        throw new Error("K17 input object mutation detected");
    }
    const [k15After, productionPathAfter] = await Promise.all([
        validateCharacterCompactArtifact(k15Root),
        resolveCharacterInputFile(
            productionRoot,
            CHARACTER_COMPACT_CONSUMER_PRODUCTION_PIN.fileName,
            CHARACTER_COMPACT_CONSUMER_PRODUCTION_PIN.fileName,
        ),
    ]);
    const productionBytesAfter = await readFile(productionPathAfter);
    if (JSON.stringify(k15After) !== k15ValidationSnapshot || JSON.stringify(k15After.projection) !== k15DeepSnapshot) {
        throw new Error("K17 K15 input changed during overlay proof");
    }
    if (production.path !== productionPathAfter || !production.bytes.equals(productionBytesAfter)) {
        throw new Error("K17 production Character[] bytes changed during overlay proof");
    }
    const productionCharactersAfter = parseProductionCharacters(productionBytesAfter);
    if (JSON.stringify(productionCharactersAfter) !== production.deepSnapshot) {
        throw new Error("K17 production Character[] object changed during overlay proof");
    }
    return report;
}

export function parseCharacterCompactPromotionCli(args: string[]): CharacterCompactPromotionOptions {
    let optInCount = 0;
    const roots: { k15Root?: string; productionRoot?: string } = {};
    const seenRoots = new Set<string>();
    for (let index = 0; index < args.length; index++) {
        const argument = args[index];
        if (argument === "--opt-in-k17") {
            optInCount++;
            continue;
        }
        if (argument !== "--k15-root" && argument !== "--production-root") {
            throw new Error(`K17 unsupported argument ${argument}`);
        }
        if (seenRoots.has(argument)) throw new Error(`K17 duplicate ${argument}`);
        const value = args[++index];
        if (!value || value.startsWith("--")) throw new Error(`K17 missing value for ${argument}`);
        seenRoots.add(argument);
        if (argument === "--k15-root") roots.k15Root = value;
        else roots.productionRoot = value;
    }
    if (optInCount !== 1) throw new Error("K17 requires exactly one explicit --opt-in-k17");
    return { optIn: true, ...roots };
}

async function run(): Promise<void> {
    const report = await runCharacterCompactPromotion(parseCharacterCompactPromotionCli(process.argv.slice(2)));
    console.log(JSON.stringify(report, null, 2));
}

if (require.main === module) run().catch(error => { console.error(error); process.exitCode = 1; });
