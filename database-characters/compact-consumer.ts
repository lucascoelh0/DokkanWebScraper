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
import {
    CHARACTER_COMPACT_CONSUMER_CONTRACT_VERSION,
    CHARACTER_COMPACT_CONSUMER_EXAMPLE_LIMIT,
    CHARACTER_COMPACT_CONSUMER_PRODUCTION_PIN,
    CharacterCompactConsumerComparableState,
    CharacterCompactConsumerExample,
    CharacterCompactConsumerField,
    CharacterCompactConsumerFieldReport,
    CharacterCompactConsumerReport,
} from "./compact-consumer-contract";
import { validateCharacterCompactArtifact } from "./compact-validator";

const DEFAULT_PRODUCTION_ROOT = "D:/Dokkan/DokkanWebScraper/data";
const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const numeric = (left: string, right: string) => Number(left) - Number(right) || left.localeCompare(right);

export interface CharacterCompactConsumerOptions {
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

interface IndexedProductionStates {
    selected: Map<string, CharacterCompactConsumerComparableState>;
    ambiguous: Map<string, string[]>;
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

function compactState(value: any, sourceRecordPath: string): CharacterCompactConsumerComparableState {
    return {
        id: String(value.id),
        rarity: normalizeComparableValue(value.rarity),
        type: normalizeComparableValue(value.type),
        sourceRecordPath,
    };
}

function comparableState(value: CharacterCompactConsumerComparableState): string {
    return JSON.stringify([value.id, value.rarity, value.type]);
}

function indexProductionStates(characters: Character[]): IndexedProductionStates {
    const topLevel = new Map<string, CharacterCompactConsumerComparableState[]>();
    const nested = new Map<string, CharacterCompactConsumerComparableState[]>();
    characters.forEach((value: any, index) => {
        if (!value || value.id === undefined || value.id === null) return;
        const state = compactState(value, `$[${index}]`);
        topLevel.set(state.id, [...(topLevel.get(state.id) ?? []), state]);
    });

    const visitNested = (value: any, path: string): void => {
        const transformations = Array.isArray(value?.transformations) ? value.transformations : [];
        transformations.forEach((item: any, index: number) => {
            const itemPath = `${path}.transformations[${index}]`;
            if (!item || item.id === undefined || item.id === null) return;
            const state = compactState(item, itemPath);
            nested.set(state.id, [...(nested.get(state.id) ?? []), state]);
            visitNested(item, itemPath);
        });
    };
    characters.forEach((value, index) => visitNested(value, `$[${index}]`));

    const selected = new Map<string, CharacterCompactConsumerComparableState>();
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

function emptyFieldReport(): CharacterCompactConsumerFieldReport {
    return { agreements: 0, differences: 0, missing: 0, ambiguous: 0, examples: [] };
}

function addExample(report: CharacterCompactConsumerFieldReport, example: CharacterCompactConsumerExample): void {
    if (report.examples.length < CHARACTER_COMPACT_CONSUMER_EXAMPLE_LIMIT) report.examples.push(example);
}

function compareValidatedInputs(
    projection: CharacterCompactProjection,
    manifest: CharacterCompactManifest,
    characters: Character[],
): CharacterCompactConsumerReport {
    const indexed = indexProductionStates(characters);
    const fields = { id: emptyFieldReport(), rarity: emptyFieldReport(), type: emptyFieldReport() };
    for (const record of projection.records) {
        const ambiguousPaths = indexed.ambiguous.get(record.cardId);
        const state = indexed.selected.get(record.cardId);
        for (const field of ["id", "rarity", "type"] as CharacterCompactConsumerField[]) {
            const fieldReport = fields[field];
            const expected = String(field === "id" ? record.cardId : record[field]);
            if (ambiguousPaths) {
                fieldReport.ambiguous++;
                addExample(fieldReport, {
                    cardId: record.cardId, stateId: record.stateId, comparison: "ambiguous", k15Value: expected,
                    productionValue: null, productionPath: null, ambiguousPaths: ambiguousPaths.slice(0, 2),
                });
                continue;
            }
            const actual = state ? normalizeComparableValue(field === "id" ? state.id : state[field]) : null;
            if (!state) {
                fieldReport.missing++;
                addExample(fieldReport, {
                    cardId: record.cardId, stateId: record.stateId, comparison: "missing", k15Value: expected,
                    productionValue: null, productionPath: null,
                });
            } else if (actual === expected) {
                fieldReport.agreements++;
            } else {
                fieldReport.differences++;
                addExample(fieldReport, {
                    cardId: record.cardId, stateId: record.stateId, comparison: "difference", k15Value: expected,
                    productionValue: actual, productionPath: state.sourceRecordPath,
                });
            }
        }
    }
    return {
        schemaVersion: 1,
        contract: "dokkan-database-character-compact-consumer-report",
        contractVersion: CHARACTER_COMPACT_CONSUMER_CONTRACT_VERSION,
        generatedAt: manifest.generatedAt,
        mode: "offline_compare_shadow",
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
            explicitOptIn: true, offlineOnly: true, compareOnly: true, k15Only: true, structuralIdJoinOnly: true,
            recordSelection: "top_level_then_first_equal_nested_structural_id", ambiguousDuplicatesFailClosed: true,
            exampleLimit: CHARACTER_COMPACT_CONSUMER_EXAMPLE_LIMIT, effectiveValuesChanged: false,
            charactersCreated: 0, charactersRemoved: 0, catalogWritten: false, k11Read: false, sidecarsK0K14Read: false,
        },
        inventory: {
            k15Records: projection.records.length, productionTopLevelRecords: characters.length,
            selectedProductiveStates: indexed.selected.size, ambiguousProductiveIds: indexed.ambiguous.size,
        },
        fields,
        inputIntegrity: {
            k15ArtifactsByteRevalidated: true, k15ProjectionDeepEqual: true,
            productionBytesEqual: true, productionCharactersDeepEqual: true,
        },
        readiness: {
            offlineCompareShadow: "GO", authority: "NO-GO", production: "NO-GO", android: "NO-GO",
            r2: "NO-GO", publisher: "NO-GO", fyiRemoval: "NO-GO", dokkanInfoRemoval: "NO-GO",
        },
    };
}

function parseProductionCharacters(
    bytes: Buffer,
    expected: { sha256: string; sizeBytes: number; topLevelCount: number } = CHARACTER_COMPACT_CONSUMER_PRODUCTION_PIN,
): Character[] {
    if (bytes.length !== expected.sizeBytes || hash(bytes) !== expected.sha256) {
        throw new Error("K16 production Character[] identity changed");
    }
    const parsed = JSON.parse(bytes.toString("utf8"));
    if (!Array.isArray(parsed) || parsed.length !== expected.topLevelCount) {
        throw new Error("K16 production Character[] cardinality changed");
    }
    return parsed as Character[];
}

async function loadProductionSnapshot(root: string): Promise<ProductionSnapshot> {
    const path = await resolveCharacterInputFile(resolve(root), CHARACTER_COMPACT_CONSUMER_PRODUCTION_PIN.fileName, CHARACTER_COMPACT_CONSUMER_PRODUCTION_PIN.fileName);
    const bytes = await readFile(path);
    const characters = parseProductionCharacters(bytes);
    return { path, bytes, characters, deepSnapshot: JSON.stringify(characters) };
}

export async function runCharacterCompactConsumer(options: CharacterCompactConsumerOptions): Promise<CharacterCompactConsumerReport> {
    if (options?.optIn !== true) throw new Error("K16 requires explicit opt-in");
    const k15Root = resolve(options.k15Root ?? join(repositoryRoot(), "data", "database-characters", "compact"));
    const productionRoot = resolve(options.productionRoot ?? DEFAULT_PRODUCTION_ROOT);
    const k15Before = await validateCharacterCompactArtifact(k15Root);
    const k15DeepSnapshot = JSON.stringify(k15Before.projection);
    const production = await loadProductionSnapshot(productionRoot);
    const report = compareValidatedInputs(k15Before.projection, k15Before.manifest, production.characters);

    if (JSON.stringify(k15Before.projection) !== k15DeepSnapshot || JSON.stringify(production.characters) !== production.deepSnapshot) {
        throw new Error("K16 input object mutation detected");
    }
    const [k15After, productionPathAfter] = await Promise.all([
        validateCharacterCompactArtifact(k15Root),
        resolveCharacterInputFile(productionRoot, CHARACTER_COMPACT_CONSUMER_PRODUCTION_PIN.fileName, CHARACTER_COMPACT_CONSUMER_PRODUCTION_PIN.fileName),
    ]);
    const productionBytesAfter = await readFile(productionPathAfter);
    if (JSON.stringify(k15After.projection) !== k15DeepSnapshot) throw new Error("K16 K15 input changed during comparison");
    if (production.path !== productionPathAfter || !production.bytes.equals(productionBytesAfter)) {
        throw new Error("K16 production Character[] bytes changed during comparison");
    }
    parseProductionCharacters(productionBytesAfter);
    return report;
}

function argumentValue(args: string[], name: string): string | undefined {
    const indexes = args.flatMap((value, index) => value === name ? [index] : []);
    if (indexes.length > 1) throw new Error(`duplicate ${name}`);
    if (!indexes.length) return undefined;
    const value = args[indexes[0] + 1];
    if (!value || value.startsWith("--")) throw new Error(`missing value for ${name}`);
    return value;
}

export function parseCharacterCompactConsumerCli(args: string[]): CharacterCompactConsumerOptions {
    const allowed = new Set(["--opt-in-k16", "--k15-root", "--production-root"]);
    for (let index = 0; index < args.length; index++) {
        const argument = args[index];
        if (!allowed.has(argument)) throw new Error(`K16 unsupported argument ${argument}`);
        if (argument !== "--opt-in-k16") index++;
    }
    if (args.filter(value => value === "--opt-in-k16").length !== 1) throw new Error("K16 requires one explicit --opt-in-k16");
    return {
        optIn: true,
        k15Root: argumentValue(args, "--k15-root"),
        productionRoot: argumentValue(args, "--production-root"),
    };
}

async function run(): Promise<void> {
    const report = await runCharacterCompactConsumer(parseCharacterCompactConsumerCli(process.argv.slice(2)));
    console.log(JSON.stringify(report, null, 2));
}

if (require.main === module) run().catch(error => { console.error(error); process.exitCode = 1; });
