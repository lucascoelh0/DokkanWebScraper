import { mkdir, readFile } from "fs/promises";
import { resolve } from "path";
import { CategoryDataset, CategoryEntry, CategoryCharacterRef } from "./category";
import { CategoryContextDataset, CategoryContextEntry, CharacterCategoryContextEntry, SupportMemoryContextEntry } from "./category-context";
import { writeFormattedJson } from "./format-json";
import { SupportMemory, SupportMemoryDataset } from "./support-memory";
import {
    TeamContextCategoryEntry,
    TeamContextCategoryRef,
    TeamContextCharacterEntry,
    TeamContextCharacterRef,
    TeamContextDataset,
    TeamContextSupportMemoryEntry,
    TeamContextSupportMemoryRef,
} from "./team-context";

interface TeamContextBuildInput {
    categories: CategoryDataset,
    categoryContext: CategoryContextDataset,
    supportMemories: SupportMemoryDataset,
}

export async function getDokkanFyiTeamContext(): Promise<TeamContextDataset> {
    const [categories, categoryContext, supportMemories] = await Promise.all([
        readJsonFile<CategoryDataset>("data/categories/latest/categories.json"),
        readJsonFile<CategoryContextDataset>("data/category-context/latest/category-context.json"),
        readJsonFile<SupportMemoryDataset>("data/support-memories/latest/support-memories.json"),
    ]);

    return buildTeamContextDataset({
        categories,
        categoryContext,
        supportMemories,
    });
}

export async function writeDokkanFyiTeamContext(): Promise<string> {
    const dataset = await getDokkanFyiTeamContext();
    const outputDir = resolve(__dirname, "data/team-context/latest");
    const outputPath = resolve(outputDir, "team-context.json");

    await mkdir(outputDir, { recursive: true });
    await writeFormattedJson(outputPath, dataset);

    return outputPath;
}

export function buildTeamContextDataset(input: TeamContextBuildInput): TeamContextDataset {
    const categoryDetailsById = new Map(input.categories.categories.map(category => [category.id, category]));
    const supportMemoryDetailsById = new Map(input.supportMemories.supportMemories.map(memory => [memory.id, memory]));
    const categoryNameById = new Map(input.categoryContext.categories.map(category => [category.id, category.name]));

    const categories = input.categoryContext.categories
        .map(category => mapTeamContextCategory(category, categoryDetailsById.get(category.id), supportMemoryDetailsById))
        .sort(compareCategoryEntries);

    const characters = input.categoryContext.characters
        .map(character => mapTeamContextCharacter(character, categoryNameById, supportMemoryDetailsById))
        .sort(compareCharacterEntries);

    const supportMemories = input.categoryContext.supportMemories
        .map(memory => mapTeamContextSupportMemory(memory, supportMemoryDetailsById.get(memory.id), categoryNameById))
        .sort(compareSupportMemoryEntries);

    const leaderCount = countUniqueCharacterIds(categories.flatMap(category => category.leaders.map(character => character.id)));
    const supportUnitCount = countUniqueCharacterIds(categories.flatMap(category => category.supportUnits.map(character => character.id)));

    return {
        generatedAt: new Date().toISOString(),
        source: "dokkan.fyi",
        categoryCount: categories.length,
        characterCount: characters.length,
        supportMemoryCount: supportMemories.length,
        leaderCount,
        supportUnitCount,
        categories,
        characters,
        supportMemories,
    };
}

function mapTeamContextCategory(
    context: CategoryContextEntry,
    details: CategoryEntry | undefined,
    supportMemoryDetailsById: Map<string, SupportMemory>,
): TeamContextCategoryEntry {
    return {
        id: context.id,
        name: context.name,
        leaders: (details?.leaders ?? []).map(mapCharacterRef).sort(compareCharacterRefs),
        supportUnits: (details?.support ?? []).map(mapCharacterRef).sort(compareCharacterRefs),
        supportMemories: context.supportMemoryIds
            .map(id => mapSupportMemoryRef(supportMemoryDetailsById.get(id), id))
            .sort(compareSupportMemoryRefs),
    };
}

function mapTeamContextCharacter(
    context: CharacterCategoryContextEntry,
    categoryNameById: Map<string, string>,
    supportMemoryDetailsById: Map<string, SupportMemory>,
): TeamContextCharacterEntry {
    return {
        id: context.id,
        name: context.name,
        title: context.title,
        categories: context.categoryIds.map(id => mapCategoryRef(id, categoryNameById)).sort(compareCategoryRefs),
        leaderOfCategories: context.leaderOfCategoryIds.map(id => mapCategoryRef(id, categoryNameById)).sort(compareCategoryRefs),
        supportOfCategories: context.supportOfCategoryIds.map(id => mapCategoryRef(id, categoryNameById)).sort(compareCategoryRefs),
        applicableSupportMemories: context.applicableSupportMemoryIds
            .map(id => mapSupportMemoryRef(supportMemoryDetailsById.get(id), id))
            .sort(compareSupportMemoryRefs),
    };
}

function mapTeamContextSupportMemory(
    context: SupportMemoryContextEntry,
    details: SupportMemory | undefined,
    categoryNameById: Map<string, string>,
): TeamContextSupportMemoryEntry {
    return {
        id: context.id,
        name: details?.name || context.name,
        description: details?.description || "",
        filmId: details?.filmId,
        filmName: details?.film?.name,
        cost: details?.cost,
        unlockQuantity: details?.unlockQuantity,
        lastsEntireBattle: details?.lastsEntireBattle,
        maxLevel: details?.maxLevel ?? 1,
        categories: context.categoryIds.map(id => mapCategoryRef(id, categoryNameById)).sort(compareCategoryRefs),
        applicableCharacterIds: [...context.applicableCharacterIds].sort(compareStrings),
    };
}

function mapCategoryRef(id: string, categoryNameById: Map<string, string>): TeamContextCategoryRef {
    return {
        id,
        name: categoryNameById.get(id) || id,
    };
}

function mapCharacterRef(character: CategoryCharacterRef): TeamContextCharacterRef {
    return {
        id: character.id,
        canonicalId: character.canonicalId,
        baseCharacterId: character.baseCharacterId,
        characterId: character.characterId,
        name: character.name,
        rarity: character.rarity,
        type: character.type,
        characterClass: character.characterClass,
        thumbnailId: character.thumbnailId,
        portraitUrl: character.portraitUrl,
        latestReleaseType: character.latestReleaseType,
        hasEza: character.hasEza,
        hasSeza: character.hasSeza,
        isReversiblyExchanged: character.isReversiblyExchanged,
        isFreelyObtainable: character.isFreelyObtainable,
        leaderSkillId: character.leaderSkillId,
        leaderSkillName: character.leaderSkillName,
        leaderSkillDescription: character.leaderSkillDescription,
    };
}

function mapSupportMemoryRef(memory: SupportMemory | undefined, fallbackId: string): TeamContextSupportMemoryRef {
    return {
        id: memory?.id || fallbackId,
        name: memory?.name || fallbackId,
        description: memory?.description || "",
        filmId: memory?.filmId,
        filmName: memory?.film?.name,
        cost: memory?.cost,
        unlockQuantity: memory?.unlockQuantity,
        lastsEntireBattle: memory?.lastsEntireBattle,
        maxLevel: memory?.maxLevel,
    };
}

function countUniqueCharacterIds(values: string[]): number {
    return new Set(values).size;
}

function compareStrings(left: string, right: string): number {
    return left.localeCompare(right);
}

function compareCategoryRefs(left: TeamContextCategoryRef, right: TeamContextCategoryRef): number {
    return left.name.localeCompare(right.name) || left.id.localeCompare(right.id);
}

function compareCharacterRefs(left: TeamContextCharacterRef, right: TeamContextCharacterRef): number {
    return left.name.localeCompare(right.name) || left.id.localeCompare(right.id);
}

function compareSupportMemoryRefs(left: TeamContextSupportMemoryRef, right: TeamContextSupportMemoryRef): number {
    return left.name.localeCompare(right.name) || left.id.localeCompare(right.id);
}

function compareCategoryEntries(left: TeamContextCategoryEntry, right: TeamContextCategoryEntry): number {
    return left.name.localeCompare(right.name) || left.id.localeCompare(right.id);
}

function compareCharacterEntries(left: TeamContextCharacterEntry, right: TeamContextCharacterEntry): number {
    return left.name.localeCompare(right.name)
        || (left.title || "").localeCompare(right.title || "")
        || left.id.localeCompare(right.id);
}

function compareSupportMemoryEntries(left: TeamContextSupportMemoryEntry, right: TeamContextSupportMemoryEntry): number {
    return left.name.localeCompare(right.name) || left.id.localeCompare(right.id);
}

async function readJsonFile<T>(relativePath: string): Promise<T> {
    const filePath = resolve(__dirname, relativePath);
    const raw = await readFile(filePath, { encoding: "utf8" });
    return JSON.parse(raw) as T;
}
