import { readFile, mkdir } from "fs/promises";
import { resolve } from "path";
import { gunzipSync } from "zlib";
import { CategoryDataset, CategoryEntry } from "./category";
import { CategoryContextDataset, CategoryContextEntry, CharacterCategoryContextEntry, SupportMemoryContextEntry } from "./category-context";
import { Character } from "./character";
import { writeFormattedJson } from "./format-json";
import { SupportMemory, SupportMemoryDataset } from "./support-memory";

interface CategoryContextBuildInput {
    categories: CategoryDataset,
    supportMemories: SupportMemoryDataset,
    characters: Character[],
}

const CHARACTERS_GZIP_RELATIVE_PATH = "data/latest/characters.json.gz";
const CHARACTERS_JSON_FALLBACK_RELATIVE_PATH = "data/characters.json";

export async function getDokkanFyiCategoryContext(): Promise<CategoryContextDataset> {
    const [categories, supportMemories, characters] = await Promise.all([
        readJsonFile<CategoryDataset>("data/categories/latest/categories.json"),
        readJsonFile<SupportMemoryDataset>("data/support-memories/latest/support-memories.json"),
        readCharacterDataset(),
    ]);

    return buildCategoryContextDataset({
        categories,
        supportMemories,
        characters,
    });
}

export async function writeDokkanFyiCategoryContext(): Promise<string> {
    const dataset = await getDokkanFyiCategoryContext();
    const outputDir = resolve(__dirname, "data/category-context/latest");
    const outputPath = resolve(outputDir, "category-context.json");

    await mkdir(outputDir, { recursive: true });
    await writeFormattedJson(outputPath, dataset);

    return outputPath;
}

export function buildCategoryContextDataset(input: CategoryContextBuildInput): CategoryContextDataset {
    const supportMemoryNameToId = new Map(
        input.supportMemories.supportMemories.map(memory => [normalizeKey(memory.name), memory.id]),
    );
    const normalizedCategories = input.categories.categories.map(category => mapCategoryContextEntry(category, supportMemoryNameToId));
    const categoryNameToId = buildCategoryNameIndex(normalizedCategories);

    const supportMemoryContextsById = new Map<string, SupportMemoryContextEntry>();

    for (const memory of input.supportMemories.supportMemories) {
        supportMemoryContextsById.set(memory.id, {
            id: memory.id,
            name: memory.name,
            categoryIds: [],
            categoryNames: [],
            applicableCharacterIds: [],
        });
    }

    for (const category of input.categories.categories) {
        for (const memoryRef of category.supportMemories) {
            const memoryId = supportMemoryNameToId.get(normalizeKey(memoryRef.name)) || memoryRef.id;
            const existing = supportMemoryContextsById.get(memoryId);

            if (!existing) {
                supportMemoryContextsById.set(memoryId, {
                    id: memoryId,
                    name: memoryRef.name,
                    categoryIds: [category.id],
                    categoryNames: [category.name],
                    applicableCharacterIds: [],
                });
                continue;
            }

            pushUnique(existing.categoryIds, category.id);
            pushUnique(existing.categoryNames, category.name);
        }
    }

    const supportMemoryIdsByCategoryId = new Map(
        [...supportMemoryContextsById.values()].flatMap(memory =>
            memory.categoryIds.map(categoryId => [`${categoryId}:${memory.id}`, { categoryId, memoryId: memory.id }] as const),
        ),
    );

    const categorySupportMemoryIndex = new Map<string, string[]>();

    for (const relation of supportMemoryIdsByCategoryId.values()) {
        const current = categorySupportMemoryIndex.get(relation.categoryId) ?? [];
        current.push(relation.memoryId);
        categorySupportMemoryIndex.set(relation.categoryId, current);
    }

    const characters = input.characters
        .map(character => mapCharacterCategoryContextEntry(character, categoryNameToId, input.categories.categories))
        .sort(compareCharacterContext);

    for (const character of characters) {
        const memoryIds = new Set<string>();

        for (const categoryId of character.categoryIds) {
            for (const memoryId of categorySupportMemoryIndex.get(categoryId) ?? []) {
                memoryIds.add(memoryId);
                const memoryContext = supportMemoryContextsById.get(memoryId);

                if (memoryContext) {
                    pushUnique(memoryContext.applicableCharacterIds, character.id);
                }
            }
        }

        character.applicableSupportMemoryIds = [...memoryIds].sort(compareIds);
    }

    const supportMemories = [...supportMemoryContextsById.values()]
        .map(memory => ({
            ...memory,
            categoryIds: [...memory.categoryIds].sort(compareIds),
            categoryNames: [...memory.categoryNames].sort((left, right) => left.localeCompare(right)),
            applicableCharacterIds: [...memory.applicableCharacterIds].sort(compareIds),
        }))
        .sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id));

    return {
        generatedAt: new Date().toISOString(),
        source: "dokkan.fyi",
        categoryCount: normalizedCategories.length,
        supportMemoryCount: supportMemories.length,
        characterCount: characters.length,
        categories: normalizedCategories.sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id)),
        supportMemories,
        characters,
    };
}

function mapCategoryContextEntry(
    category: CategoryEntry,
    supportMemoryNameToId: Map<string, string>,
): CategoryContextEntry {
    return {
        id: category.id,
        name: category.name,
        leaderIds: uniqueSortedIds(category.leaders.map(character => character.id)),
        supportIds: uniqueSortedIds(category.support.map(character => character.id)),
        supportMemoryIds: uniqueSortedIds(
            category.supportMemories.map(memory => supportMemoryNameToId.get(normalizeKey(memory.name)) || memory.id),
        ),
    };
}

function mapCharacterCategoryContextEntry(
    character: Character,
    categoryNameToId: Map<string, string>,
    categories: CategoryEntry[],
): CharacterCategoryContextEntry {
    const categoryIds = uniqueSortedIds(
        (character.categories ?? [])
            .map(name => categoryNameToId.get(normalizeKey(name)))
            .filter(Boolean) as string[],
    );

    const leaderOfCategoryIds = uniqueSortedIds(
        categories
            .filter(category => category.leaders.some(leader => leader.id === character.id))
            .map(category => category.id),
    );

    const supportOfCategoryIds = uniqueSortedIds(
        categories
            .filter(category => category.support.some(support => support.id === character.id))
            .map(category => category.id),
    );

    return {
        id: character.id,
        name: character.name,
        title: character.title,
        categoryIds,
        categoryNames: [...(character.categories ?? [])].sort((left, right) => left.localeCompare(right)),
        leaderOfCategoryIds,
        supportOfCategoryIds,
        applicableSupportMemoryIds: [],
    };
}

function buildCategoryNameIndex(categories: CategoryContextEntry[]): Map<string, string> {
    return new Map(categories.map(category => [normalizeKey(category.name), category.id]));
}

function normalizeKey(value?: string): string {
    return (value ?? "").trim().toLocaleLowerCase();
}

function uniqueSortedIds(values: string[]): string[] {
    return [...new Set(values.filter(Boolean))].sort(compareIds);
}

function compareIds(left: string, right: string): number {
    return left.localeCompare(right);
}

function compareCharacterContext(left: CharacterCategoryContextEntry, right: CharacterCategoryContextEntry): number {
    return left.name.localeCompare(right.name)
        || (left.title || "").localeCompare(right.title || "")
        || left.id.localeCompare(right.id);
}

function pushUnique(values: string[], value?: string) {
    if (!value || values.includes(value)) {
        return;
    }

    values.push(value);
}

async function readCharacterDataset(): Promise<Character[]> {
    const gzipPath = resolve(__dirname, CHARACTERS_GZIP_RELATIVE_PATH);

    try {
        const gzipBuffer = await readFile(gzipPath);
        return JSON.parse(gunzipSync(gzipBuffer).toString("utf8")) as Character[];
    } catch (error) {
        const fallbackPath = resolve(__dirname, CHARACTERS_JSON_FALLBACK_RELATIVE_PATH);
        const raw = await readFile(fallbackPath, { encoding: "utf8" });
        return JSON.parse(raw) as Character[];
    }
}

async function readJsonFile<T>(relativePath: string): Promise<T> {
    const filePath = resolve(__dirname, relativePath);
    const raw = await readFile(filePath, { encoding: "utf8" });
    return JSON.parse(raw) as T;
}
