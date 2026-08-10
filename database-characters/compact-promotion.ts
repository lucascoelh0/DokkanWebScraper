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
import {
    CHARACTER_COMPACT_PROMOTION_CONTRACT_VERSION,
    CHARACTER_COMPACT_PROMOTION_EXAMPLE_LIMIT,
    CharacterCompactPromotionExample,
    CharacterCompactPromotionReport,
} from "./compact-promotion-contract";
import { validateCharacterCompactArtifact } from "./compact-validator";

const DEFAULT_PRODUCTION_ROOT = "D:/Dokkan/DokkanWebScraper/data";
const hash = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");
const numeric = (left: string, right: string) => Number(left) - Number(right) || left.localeCompare(right);

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

interface ProductiveState {
    id: string;
    rarity: unknown;
    rarityPresent: boolean;
    type: unknown;
    typePresent: boolean;
    sourceRecordPath: string;
    target: any;
}

interface IndexedProductionStates {
    selected: Map<string, ProductiveState>;
    ambiguous: Map<string, string[]>;
}

interface PromotionCandidate {
    cardId: string;
    stateId: string;
    field: "rarity";
    from: null;
    to: string;
    productionPath: string;
}

interface BlockerCounts {
    total: number;
    missingBindings: number;
    ambiguousBindings: number;
    typeMissing: number;
    typeDifferences: number;
    rarityMissing: number;
    rarityNonNullDifferences: number;
}

function repositoryRoot(): string {
    const parent = resolve(__dirname, "..");
    return basename(parent).toLowerCase() === "lib" ? resolve(parent, "..") : parent;
}

function normalizeComparableValue(value: unknown): string | null {
    if (value === undefined || value === null) return null;
    if (["string", "number", "boolean"].includes(typeof value)) return String(value);
    return "<non-scalar>";
}

function productiveState(value: any, sourceRecordPath: string): ProductiveState {
    return {
        id: String(value.id),
        rarity: value.rarity,
        rarityPresent: Object.prototype.hasOwnProperty.call(value, "rarity") && value.rarity !== undefined,
        type: value.type,
        typePresent: Object.prototype.hasOwnProperty.call(value, "type") && value.type !== undefined,
        sourceRecordPath,
        target: value,
    };
}

function comparableState(value: ProductiveState): string {
    return JSON.stringify([
        value.id,
        normalizeComparableValue(value.rarity),
        normalizeComparableValue(value.type),
    ]);
}

function indexProductionStates(characters: Character[]): IndexedProductionStates {
    const topLevel = new Map<string, ProductiveState[]>();
    const nested = new Map<string, ProductiveState[]>();
    characters.forEach((value: any, index) => {
        if (!value || value.id === undefined || value.id === null) return;
        const state = productiveState(value, `$[${index}]`);
        topLevel.set(state.id, [...(topLevel.get(state.id) ?? []), state]);
    });

    const visitNested = (value: any, path: string): void => {
        const transformations = Array.isArray(value?.transformations) ? value.transformations : [];
        transformations.forEach((item: any, index: number) => {
            const itemPath = `${path}.transformations[${index}]`;
            if (!item || item.id === undefined || item.id === null) return;
            const state = productiveState(item, itemPath);
            nested.set(state.id, [...(nested.get(state.id) ?? []), state]);
            visitNested(item, itemPath);
        });
    };
    characters.forEach((value, index) => visitNested(value, `$[${index}]`));

    const selected = new Map<string, ProductiveState>();
    const ambiguous = new Map<string, string[]>();
    const ids = [...new Set([...topLevel.keys(), ...nested.keys()])].sort(numeric);
    for (const id of ids) {
        const primary = topLevel.get(id) ?? [];
        if (primary.length === 1) {
            selected.set(id, primary[0]);
            continue;
        }
        if (primary.length > 1) {
            ambiguous.set(id, primary.map(item => item.sourceRecordPath).sort());
            continue;
        }
        const alternatives = nested.get(id) ?? [];
        const signatures = new Set(alternatives.map(comparableState));
        if (signatures.size === 1 && alternatives.length) selected.set(id, alternatives[0]);
        else if (alternatives.length) ambiguous.set(id, alternatives.map(item => item.sourceRecordPath).sort());
    }
    return { selected, ambiguous };
}

function candidateOrder(left: PromotionCandidate, right: PromotionCandidate): number {
    return numeric(left.cardId, right.cardId)
        || numeric(left.stateId, right.stateId)
        || left.productionPath.localeCompare(right.productionPath);
}

function addExample(examples: CharacterCompactPromotionExample[], example: CharacterCompactPromotionExample): void {
    if (examples.length < CHARACTER_COMPACT_PROMOTION_EXAMPLE_LIMIT) examples.push(example);
}

function blocker(counts: BlockerCounts, key: Exclude<keyof BlockerCounts, "total">): void {
    counts.total++;
    counts[key]++;
}

function evaluateValidatedInputs(
    projection: CharacterCompactProjection,
    manifest: CharacterCompactManifest,
    characters: Character[],
): CharacterCompactPromotionReport {
    const productionSnapshot = JSON.stringify(characters);
    const indexed = indexProductionStates(characters);
    const candidates: PromotionCandidate[] = [];
    const blockerExamples: CharacterCompactPromotionExample[] = [];
    const candidateExamples: CharacterCompactPromotionExample[] = [];
    const binding = { selected: 0, missing: 0, ambiguous: 0 };
    const type = { agreements: 0, changes: 0 as const, differences: 0, missing: 0, ambiguous: 0 };
    const rarity = {
        agreementsBeforeOverlay: 0, nullFillCandidates: 0, nonNullDifferences: 0,
        missing: 0, ambiguous: 0, nonNullOverwrites: 0 as const,
    };
    const blockers: BlockerCounts = {
        total: 0, missingBindings: 0, ambiguousBindings: 0, typeMissing: 0,
        typeDifferences: 0, rarityMissing: 0, rarityNonNullDifferences: 0,
    };

    for (const record of projection.records) {
        const ambiguousPaths = indexed.ambiguous.get(record.cardId);
        if (ambiguousPaths) {
            binding.ambiguous++;
            type.ambiguous++;
            rarity.ambiguous++;
            blocker(blockers, "ambiguousBindings");
            addExample(blockerExamples, {
                kind: "blocker", cardId: record.cardId, stateId: record.stateId, field: "binding",
                reason: "ambiguous_productive_binding", k15Value: record.cardId, productionValue: null,
                productionPath: null, ambiguousPaths: ambiguousPaths.slice(0, 2),
            });
            continue;
        }
        const state = indexed.selected.get(record.cardId);
        if (!state) {
            binding.missing++;
            type.missing++;
            rarity.missing++;
            blocker(blockers, "missingBindings");
            addExample(blockerExamples, {
                kind: "blocker", cardId: record.cardId, stateId: record.stateId, field: "binding",
                reason: "missing_productive_binding", k15Value: record.cardId, productionValue: null,
                productionPath: null,
            });
            continue;
        }
        binding.selected++;

        const productiveType = normalizeComparableValue(state.type);
        if (!state.typePresent || state.type === null) {
            type.missing++;
            blocker(blockers, "typeMissing");
            addExample(blockerExamples, {
                kind: "blocker", cardId: record.cardId, stateId: record.stateId, field: "type",
                reason: "missing_productive_type", k15Value: String(record.type), productionValue: productiveType,
                productionPath: state.sourceRecordPath,
            });
        } else if (productiveType === String(record.type)) {
            type.agreements++;
        } else {
            type.differences++;
            blocker(blockers, "typeDifferences");
            addExample(blockerExamples, {
                kind: "blocker", cardId: record.cardId, stateId: record.stateId, field: "type",
                reason: "productive_type_difference", k15Value: String(record.type), productionValue: productiveType,
                productionPath: state.sourceRecordPath,
            });
        }

        const productiveRarity = normalizeComparableValue(state.rarity);
        if (state.rarity === undefined || state.rarity === null) {
            rarity.nullFillCandidates++;
            candidates.push({
                cardId: record.cardId, stateId: record.stateId, field: "rarity", from: null,
                to: String(record.rarity), productionPath: state.sourceRecordPath,
            });
            addExample(candidateExamples, {
                kind: "null_fill_candidate", cardId: record.cardId, stateId: record.stateId, field: "rarity",
                reason: "productive_null_k15_supported", k15Value: String(record.rarity), productionValue: null,
                productionPath: state.sourceRecordPath,
            });
        } else if (productiveRarity === String(record.rarity)) {
            rarity.agreementsBeforeOverlay++;
        } else {
            rarity.nonNullDifferences++;
            blocker(blockers, "rarityNonNullDifferences");
            addExample(blockerExamples, {
                kind: "blocker", cardId: record.cardId, stateId: record.stateId, field: "rarity",
                reason: "productive_non_null_rarity_difference", k15Value: String(record.rarity),
                productionValue: productiveRarity, productionPath: state.sourceRecordPath,
            });
        }
    }

    candidates.sort(candidateOrder);
    const canonicalCandidates = JSON.stringify(candidates);
    const clone = JSON.parse(productionSnapshot) as Character[];
    const cloneSnapshot = JSON.stringify(clone);
    const cloneIndex = indexProductionStates(clone);
    const candidatesToApply = blockers.total === 0 ? candidates : [];
    for (const candidate of candidatesToApply) {
        const state = cloneIndex.selected.get(candidate.cardId);
        if (!state || state.sourceRecordPath !== candidate.productionPath || normalizeComparableValue(state.target.rarity) !== null) {
            throw new Error(`K17 candidate target changed for ${candidate.cardId}`);
        }
        state.target.rarity = candidate.to;
    }

    const postOverlay = {
        recordsEvaluated: projection.records.length,
        idAgreements: 0,
        rarityAgreements: 0,
        typeAgreements: 0,
        allFieldAgreements: 0,
        blockers: 0,
    };
    for (const record of projection.records) {
        const state = cloneIndex.selected.get(record.cardId);
        const ambiguousState = cloneIndex.ambiguous.has(record.cardId);
        const idAgreement = !!state && !ambiguousState && String(state.target.id) === record.cardId;
        const rarityAgreement = !!state && !ambiguousState && normalizeComparableValue(state.target.rarity) === String(record.rarity);
        const typeAgreement = !!state && !ambiguousState && normalizeComparableValue(state.target.type) === String(record.type);
        if (idAgreement) postOverlay.idAgreements++;
        if (rarityAgreement) postOverlay.rarityAgreements++;
        if (typeAgreement) postOverlay.typeAgreements++;
        if (idAgreement && rarityAgreement && typeAgreement) postOverlay.allFieldAgreements++;
        else postOverlay.blockers++;
    }

    for (const candidate of candidatesToApply) {
        const state = cloneIndex.selected.get(candidate.cardId);
        if (!state || state.target.rarity !== candidate.to) throw new Error(`K17 overlay proof changed for ${candidate.cardId}`);
        if (state.rarityPresent) state.target.rarity = null;
        else delete state.target.rarity;
    }
    if (JSON.stringify(clone) !== cloneSnapshot) throw new Error("K17 clone changed outside candidate rarity fields");
    if (JSON.stringify(characters) !== productionSnapshot) throw new Error("K17 productive input object mutation detected");

    const examples = [...blockerExamples, ...candidateExamples].slice(0, CHARACTER_COMPACT_PROMOTION_EXAMPLE_LIMIT);
    const ready = blockers.total === 0
        && postOverlay.blockers === 0
        && postOverlay.allFieldAgreements === projection.records.length;
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
        inventory: {
            k15Records: projection.records.length, productionTopLevelRecords: characters.length,
            selectedProductiveStates: indexed.selected.size, ambiguousProductiveIds: indexed.ambiguous.size,
        },
        evaluation: { binding, type, rarity, blockers },
        candidates: { count: candidates.length, canonicalization: "utf8-json-array-v1", sha256: hash(canonicalCandidates) },
        examples,
        overlayProof: {
            candidatesAppliedToClone: candidatesToApply.length, candidateOnlyMutations: true,
            originalProductionRecordsMutated: 0, charactersCreated: 0, charactersRemoved: 0, postOverlay,
        },
        inputIntegrity: {
            k15ArtifactsByteRevalidated: true, k15ProjectionDeepEqual: true, productionBytesEqual: true,
            productionCharactersDeepEqual: true, originalInputsUnchanged: true, overlayCloneIsolated: true,
        },
        readiness: {
            experimentalInMemoryOverlay: ready ? "GO" : "NO-GO", authority: "NO-GO", production: "NO-GO",
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
