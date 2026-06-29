import { mkdir, readFile } from "fs/promises";
import { resolve } from "path";
import { gunzipSync } from "zlib";
import { CategoryRosterDataset, CategoryRosterEntry, CategoryRosterMemberEntry } from "./category-roster";
import { CategoryContextDataset, CharacterCategoryContextEntry } from "./category-context";
import { Character } from "./character";
import { writeFormattedJson } from "./format-json";
import { TeamContextCategoryEntry, TeamContextDataset } from "./team-context";

interface CategoryRosterBuildInput {
    teamContext: TeamContextDataset,
    categoryContext: CategoryContextDataset,
    characters: Character[],
}

interface CategoryRosterMemberBase {
    id: string,
    name: string,
    title?: string,
    rarity?: Character["rarity"],
    type?: Character["type"],
    characterClass?: Character["characterClass"],
    portraitUrl?: string,
    portraitFilename?: string,
    latestReleaseType: string,
    hasEza: boolean,
    hasSeza: boolean,
    isReversiblyExchanged: boolean,
    isFreelyObtainable: boolean,
}

const CHARACTERS_GZIP_RELATIVE_PATH = "data/latest/characters.json.gz";
const CHARACTERS_JSON_FALLBACK_RELATIVE_PATH = "data/characters.json";

export async function getDokkanFyiCategoryRoster(): Promise<CategoryRosterDataset> {
    const [teamContext, categoryContext, characters] = await Promise.all([
        readJsonFile<TeamContextDataset>("data/team-context/latest/team-context.json"),
        readJsonFile<CategoryContextDataset>("data/category-context/latest/category-context.json"),
        readCharacterDataset(),
    ]);

    return buildCategoryRosterDataset({
        teamContext,
        categoryContext,
        characters,
    });
}

export async function writeDokkanFyiCategoryRoster(): Promise<string> {
    const dataset = await getDokkanFyiCategoryRoster();
    const outputDir = resolve(__dirname, "data/category-roster/latest");
    const outputPath = resolve(outputDir, "category-roster.json");

    await mkdir(outputDir, { recursive: true });
    await writeFormattedJson(outputPath, dataset);

    return outputPath;
}

export function buildCategoryRosterDataset(input: CategoryRosterBuildInput): CategoryRosterDataset {
    const memberBaseById = new Map(input.characters.map(character => [character.id, mapMemberBase(character)]));
    const memberContextById = new Map(input.categoryContext.characters.map(character => [character.id, character]));
    const memberContextsByCategoryId = buildMemberContextsByCategoryId(input.categoryContext.characters);

    const categories = input.teamContext.categories
        .map(category => mapCategoryRosterEntry(
            category,
            memberContextsByCategoryId.get(category.id) ?? [],
            memberBaseById,
            memberContextById,
        ))
        .sort(compareCategoryRosterEntries);

    return {
        generatedAt: new Date().toISOString(),
        source: "dokkan.fyi",
        categoryCount: categories.length,
        memberCharacterCount: countUniqueCharacterIds(categories.flatMap(category => category.members.map(member => member.id))),
        categories,
    };
}

function mapCategoryRosterEntry(
    category: TeamContextCategoryEntry,
    members: CharacterCategoryContextEntry[],
    memberBaseById: Map<string, CategoryRosterMemberBase>,
    memberContextById: Map<string, CharacterCategoryContextEntry>,
): CategoryRosterEntry {
    const leaderIds = new Set(category.leaders.map(character => character.id));
    const supportIds = new Set(category.supportUnits.map(character => character.id));

    const categoryMembers = members
        .map(member => mapCategoryRosterMember(
            member,
            memberBaseById.get(member.id),
            leaderIds,
            supportIds,
        ))
        .sort(compareCategoryRosterMembers);

    // Keep role lists sourced from team-context so category pages can use a stable, rich ref shape.
    return {
        id: category.id,
        name: category.name,
        memberCount: categoryMembers.length,
        leaderCount: category.leaders.length,
        supportUnitCount: category.supportUnits.length,
        supportMemoryCount: category.supportMemories.length,
        leaders: [...category.leaders].sort(compareCharacterRefs),
        supportUnits: [...category.supportUnits].sort(compareCharacterRefs),
        supportMemories: [...category.supportMemories].sort(compareSupportMemoryRefs),
        members: mergeMissingRoleEntries(categoryMembers, category, memberBaseById, memberContextById, leaderIds, supportIds),
    };
}

function mergeMissingRoleEntries(
    members: CategoryRosterMemberEntry[],
    category: TeamContextCategoryEntry,
    memberBaseById: Map<string, CategoryRosterMemberBase>,
    memberContextById: Map<string, CharacterCategoryContextEntry>,
    leaderIds: Set<string>,
    supportIds: Set<string>,
): CategoryRosterMemberEntry[] {
    const existingIds = new Set(members.map(member => member.id));
    const merged = [...members];

    for (const roleCharacter of [...category.leaders, ...category.supportUnits]) {
        if (existingIds.has(roleCharacter.id)) {
            continue;
        }

        merged.push(mapCategoryRosterMember(
            memberContextById.get(roleCharacter.id) ?? {
                id: roleCharacter.id,
                name: roleCharacter.name,
                title: undefined,
                categoryIds: [],
                categoryNames: [],
                leaderOfCategoryIds: [],
                supportOfCategoryIds: [],
                applicableSupportMemoryIds: [],
            },
            memberBaseById.get(roleCharacter.id) ?? {
                id: roleCharacter.id,
                name: roleCharacter.name,
                rarity: roleCharacter.rarity,
                type: roleCharacter.type,
                characterClass: roleCharacter.characterClass,
                portraitUrl: roleCharacter.portraitUrl,
                latestReleaseType: roleCharacter.latestReleaseType ?? "initial",
                hasEza: Boolean(roleCharacter.hasEza),
                hasSeza: Boolean(roleCharacter.hasSeza),
                isReversiblyExchanged: Boolean(roleCharacter.isReversiblyExchanged),
                isFreelyObtainable: Boolean(roleCharacter.isFreelyObtainable),
            },
            leaderIds,
            supportIds,
        ));
    }

    return merged.sort(compareCategoryRosterMembers);
}

function mapCategoryRosterMember(
    context: CharacterCategoryContextEntry,
    base: CategoryRosterMemberBase | undefined,
    leaderIds: Set<string>,
    supportIds: Set<string>,
): CategoryRosterMemberEntry {
    return {
        id: context.id,
        name: base?.name || context.name,
        title: base?.title || context.title,
        rarity: base?.rarity,
        type: base?.type,
        characterClass: base?.characterClass,
        portraitUrl: base?.portraitUrl,
        portraitFilename: base?.portraitFilename,
        latestReleaseType: base?.latestReleaseType ?? "initial",
        hasEza: base?.hasEza ?? false,
        hasSeza: base?.hasSeza ?? false,
        isLeader: leaderIds.has(context.id),
        isSupportUnit: supportIds.has(context.id),
        isReversiblyExchanged: base?.isReversiblyExchanged ?? false,
        isFreelyObtainable: base?.isFreelyObtainable ?? false,
    };
}

function mapMemberBase(character: Character): CategoryRosterMemberBase {
    const hasSeza = Boolean(character.sezaReleaseDate || character.sezaPassive);
    const hasEza = hasSeza || Boolean(
        character.ezaReleaseDate
        || character.ezaLeaderSkill
        || character.ezaSuperAttack
        || character.ezaUltraSuperAttack
        || character.ezaExSuperAttack
        || character.ezaPassive
        || character.ezaActiveSkill,
    );

    return {
        id: character.id,
        name: character.name,
        title: character.title,
        rarity: character.rarity,
        type: character.type,
        characterClass: character.characterClass,
        portraitUrl: character.portraitURL,
        portraitFilename: character.portraitFilename,
        latestReleaseType: inferLatestReleaseType(hasEza, hasSeza),
        hasEza,
        hasSeza,
        isReversiblyExchanged: Boolean(character.reversibleExchange),
        isFreelyObtainable: Boolean(character.isFreeToPlay ?? character.obtainability?.isFreeToPlay),
    };
}

function inferLatestReleaseType(hasEza: boolean, hasSeza: boolean): string {
    if (hasSeza) {
        return "seza";
    }

    if (hasEza) {
        return "eza";
    }

    return "initial";
}

function buildMemberContextsByCategoryId(characters: CharacterCategoryContextEntry[]): Map<string, CharacterCategoryContextEntry[]> {
    const index = new Map<string, CharacterCategoryContextEntry[]>();

    for (const character of characters) {
        for (const categoryId of character.categoryIds) {
            const values = index.get(categoryId) ?? [];
            values.push(character);
            index.set(categoryId, values);
        }
    }

    return index;
}

function countUniqueCharacterIds(values: string[]): number {
    return new Set(values).size;
}

function compareCategoryRosterEntries(left: CategoryRosterEntry, right: CategoryRosterEntry): number {
    return left.name.localeCompare(right.name) || left.id.localeCompare(right.id);
}

function compareCategoryRosterMembers(left: CategoryRosterMemberEntry, right: CategoryRosterMemberEntry): number {
    return Number(right.isLeader) - Number(left.isLeader)
        || Number(right.isSupportUnit) - Number(left.isSupportUnit)
        || left.name.localeCompare(right.name)
        || (left.title || "").localeCompare(right.title || "")
        || left.id.localeCompare(right.id);
}

function compareCharacterRefs(left: TeamContextCategoryEntry["leaders"][number], right: TeamContextCategoryEntry["leaders"][number]): number {
    return left.name.localeCompare(right.name) || left.id.localeCompare(right.id);
}

function compareSupportMemoryRefs(left: TeamContextCategoryEntry["supportMemories"][number], right: TeamContextCategoryEntry["supportMemories"][number]): number {
    return left.name.localeCompare(right.name) || left.id.localeCompare(right.id);
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
