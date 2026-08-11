"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseCharacterCompactPromotionCli = exports.runCharacterCompactPromotion = void 0;
const crypto_1 = require("crypto");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const artifact_path_1 = require("./artifact-path");
const compact_contract_1 = require("./compact-contract");
const compact_consumer_contract_1 = require("./compact-consumer-contract");
const compact_overlay_1 = require("./compact-overlay");
const compact_promotion_contract_1 = require("./compact-promotion-contract");
const compact_validator_1 = require("./compact-validator");
const DEFAULT_PRODUCTION_ROOT = "D:/Dokkan/DokkanWebScraper/data";
const hash = (bytes) => (0, crypto_1.createHash)("sha256").update(bytes).digest("hex");
function repositoryRoot() {
    const parent = (0, path_1.resolve)(__dirname, "..");
    return (0, path_1.basename)(parent).toLowerCase() === "lib" ? (0, path_1.resolve)(parent, "..") : parent;
}
function evaluateValidatedInputs(projection, manifest, characters) {
    const overlay = (0, compact_overlay_1.createCharacterCompactRarityOverlay)(characters, projection);
    const decision = overlay.decision;
    return {
        schemaVersion: 1,
        contract: "dokkan-database-character-compact-promotion-report",
        contractVersion: compact_promotion_contract_1.CHARACTER_COMPACT_PROMOTION_CONTRACT_VERSION,
        generatedAt: manifest.generatedAt,
        mode: "offline_in_memory_overlay_proof",
        sources: {
            k15: {
                contract: "dokkan-database-character-compact-shadow", contractVersion: "1.0.0",
                datasetVersion: manifest.datasetVersion, manifestFile: "database-characters-k15-manifest.json",
                manifestSha256: compact_contract_1.CHARACTER_COMPACT_PINNED_RELEASE.manifestSha256,
                payloadFile: manifest.fileName, payloadSha256: manifest.sha256, recordCount: projection.records.length,
            },
            productionCharacters: {
                contract: "Character[]", fileName: compact_consumer_contract_1.CHARACTER_COMPACT_CONSUMER_PRODUCTION_PIN.fileName,
                sha256: compact_consumer_contract_1.CHARACTER_COMPACT_CONSUMER_PRODUCTION_PIN.sha256,
                sizeBytes: compact_consumer_contract_1.CHARACTER_COMPACT_CONSUMER_PRODUCTION_PIN.sizeBytes,
                topLevelCount: characters.length,
            },
        },
        policy: {
            explicitOptIn: true, offlineOnly: true, inMemoryCloneOnly: true, k15Only: true,
            structuralIdJoinOnly: true, recordSelection: "top_level_then_first_equal_nested_structural_id",
            ambiguousDuplicatesFailClosed: true, rarityPolicy: "null_fill_only", typePolicy: "agreement_only",
            exampleLimit: compact_promotion_contract_1.CHARACTER_COMPACT_PROMOTION_EXAMPLE_LIMIT, returnsCharacters: false, catalogWritten: false,
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
function parseProductionCharacters(bytes, expected = compact_consumer_contract_1.CHARACTER_COMPACT_CONSUMER_PRODUCTION_PIN) {
    if (bytes.length !== expected.sizeBytes || hash(bytes) !== expected.sha256) {
        throw new Error("K17 production Character[] identity changed");
    }
    const parsed = JSON.parse(bytes.toString("utf8"));
    if (!Array.isArray(parsed) || parsed.length !== expected.topLevelCount) {
        throw new Error("K17 production Character[] cardinality changed");
    }
    return parsed;
}
async function loadProductionSnapshot(root) {
    const path = await (0, artifact_path_1.resolveCharacterInputFile)((0, path_1.resolve)(root), compact_consumer_contract_1.CHARACTER_COMPACT_CONSUMER_PRODUCTION_PIN.fileName, compact_consumer_contract_1.CHARACTER_COMPACT_CONSUMER_PRODUCTION_PIN.fileName);
    const bytes = await (0, promises_1.readFile)(path);
    const characters = parseProductionCharacters(bytes);
    return { path, bytes, characters, deepSnapshot: JSON.stringify(characters) };
}
async function runCharacterCompactPromotion(options) {
    if (options?.optIn !== true)
        throw new Error("K17 requires explicit opt-in");
    const k15Root = (0, path_1.resolve)(options.k15Root ?? (0, path_1.join)(repositoryRoot(), "data", "database-characters", "compact"));
    const productionRoot = (0, path_1.resolve)(options.productionRoot ?? DEFAULT_PRODUCTION_ROOT);
    const k15Before = await (0, compact_validator_1.validateCharacterCompactArtifact)(k15Root);
    const k15ValidationSnapshot = JSON.stringify(k15Before);
    const k15DeepSnapshot = JSON.stringify(k15Before.projection);
    const production = await loadProductionSnapshot(productionRoot);
    const report = evaluateValidatedInputs(k15Before.projection, k15Before.manifest, production.characters);
    if (JSON.stringify(k15Before.projection) !== k15DeepSnapshot || JSON.stringify(production.characters) !== production.deepSnapshot) {
        throw new Error("K17 input object mutation detected");
    }
    const [k15After, productionPathAfter] = await Promise.all([
        (0, compact_validator_1.validateCharacterCompactArtifact)(k15Root),
        (0, artifact_path_1.resolveCharacterInputFile)(productionRoot, compact_consumer_contract_1.CHARACTER_COMPACT_CONSUMER_PRODUCTION_PIN.fileName, compact_consumer_contract_1.CHARACTER_COMPACT_CONSUMER_PRODUCTION_PIN.fileName),
    ]);
    const productionBytesAfter = await (0, promises_1.readFile)(productionPathAfter);
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
exports.runCharacterCompactPromotion = runCharacterCompactPromotion;
function parseCharacterCompactPromotionCli(args) {
    let optInCount = 0;
    const roots = {};
    const seenRoots = new Set();
    for (let index = 0; index < args.length; index++) {
        const argument = args[index];
        if (argument === "--opt-in-k17") {
            optInCount++;
            continue;
        }
        if (argument !== "--k15-root" && argument !== "--production-root") {
            throw new Error(`K17 unsupported argument ${argument}`);
        }
        if (seenRoots.has(argument))
            throw new Error(`K17 duplicate ${argument}`);
        const value = args[++index];
        if (!value || value.startsWith("--"))
            throw new Error(`K17 missing value for ${argument}`);
        seenRoots.add(argument);
        if (argument === "--k15-root")
            roots.k15Root = value;
        else
            roots.productionRoot = value;
    }
    if (optInCount !== 1)
        throw new Error("K17 requires exactly one explicit --opt-in-k17");
    return { optIn: true, ...roots };
}
exports.parseCharacterCompactPromotionCli = parseCharacterCompactPromotionCli;
async function run() {
    const report = await runCharacterCompactPromotion(parseCharacterCompactPromotionCli(process.argv.slice(2)));
    console.log(JSON.stringify(report, null, 2));
}
if (require.main === module)
    run().catch(error => { console.error(error); process.exitCode = 1; });
//# sourceMappingURL=compact-promotion.js.map