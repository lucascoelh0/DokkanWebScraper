"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCategoryRosterDataset = exports.writeDokkanFyiCategoryRoster = exports.getDokkanFyiCategoryRoster = void 0;
const promises_1 = require("fs/promises");
const path_1 = require("path");
const zlib_1 = require("zlib");
const format_json_1 = require("./format-json");
const CHARACTERS_GZIP_RELATIVE_PATH = "data/latest/characters.json.gz";
const CHARACTERS_JSON_FALLBACK_RELATIVE_PATH = "data/characters.json";
async function getDokkanFyiCategoryRoster() {
    const [teamContext, categoryContext, characters] = await Promise.all([
        readJsonFile("data/team-context/latest/team-context.json"),
        readJsonFile("data/category-context/latest/category-context.json"),
        readCharacterDataset(),
    ]);
    return buildCategoryRosterDataset({
        teamContext,
        categoryContext,
        characters,
    });
}
exports.getDokkanFyiCategoryRoster = getDokkanFyiCategoryRoster;
async function writeDokkanFyiCategoryRoster() {
    const dataset = await getDokkanFyiCategoryRoster();
    const outputDir = (0, path_1.resolve)(__dirname, "data/category-roster/latest");
    const outputPath = (0, path_1.resolve)(outputDir, "category-roster.json");
    await (0, promises_1.mkdir)(outputDir, { recursive: true });
    await (0, format_json_1.writeFormattedJson)(outputPath, dataset);
    return outputPath;
}
exports.writeDokkanFyiCategoryRoster = writeDokkanFyiCategoryRoster;
function buildCategoryRosterDataset(input) {
    const memberBaseById = new Map(input.characters.map(character => [character.id, mapMemberBase(character)]));
    const memberContextById = new Map(input.categoryContext.characters.map(character => [character.id, character]));
    const memberContextsByCategoryId = buildMemberContextsByCategoryId(input.categoryContext.characters);
    const categories = input.teamContext.categories
        .map(category => mapCategoryRosterEntry(category, memberContextsByCategoryId.get(category.id) ?? [], memberBaseById, memberContextById))
        .sort(compareCategoryRosterEntries);
    return {
        generatedAt: new Date().toISOString(),
        source: "dokkan.fyi",
        categoryCount: categories.length,
        memberCharacterCount: countUniqueCharacterIds(categories.flatMap(category => category.members.map(member => member.id))),
        categories,
    };
}
exports.buildCategoryRosterDataset = buildCategoryRosterDataset;
function mapCategoryRosterEntry(category, members, memberBaseById, memberContextById) {
    const leaderIds = new Set(category.leaders.map(character => character.id));
    const supportIds = new Set(category.supportUnits.map(character => character.id));
    const categoryMembers = members
        .map(member => mapCategoryRosterMember(member, memberBaseById.get(member.id), leaderIds, supportIds))
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
function mergeMissingRoleEntries(members, category, memberBaseById, memberContextById, leaderIds, supportIds) {
    const existingIds = new Set(members.map(member => member.id));
    const merged = [...members];
    for (const roleCharacter of [...category.leaders, ...category.supportUnits]) {
        if (existingIds.has(roleCharacter.id)) {
            continue;
        }
        merged.push(mapCategoryRosterMember(memberContextById.get(roleCharacter.id) ?? {
            id: roleCharacter.id,
            name: roleCharacter.name,
            title: undefined,
            categoryIds: [],
            categoryNames: [],
            leaderOfCategoryIds: [],
            supportOfCategoryIds: [],
            applicableSupportMemoryIds: [],
        }, memberBaseById.get(roleCharacter.id) ?? {
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
        }, leaderIds, supportIds));
    }
    return merged.sort(compareCategoryRosterMembers);
}
function mapCategoryRosterMember(context, base, leaderIds, supportIds) {
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
function mapMemberBase(character) {
    const hasSeza = Boolean(character.sezaReleaseDate || character.sezaPassive);
    const hasEza = hasSeza || Boolean(character.ezaReleaseDate
        || character.ezaLeaderSkill
        || character.ezaSuperAttack
        || character.ezaUltraSuperAttack
        || character.ezaExSuperAttack
        || character.ezaPassive
        || character.ezaActiveSkill);
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
function inferLatestReleaseType(hasEza, hasSeza) {
    if (hasSeza) {
        return "seza";
    }
    if (hasEza) {
        return "eza";
    }
    return "initial";
}
function buildMemberContextsByCategoryId(characters) {
    const index = new Map();
    for (const character of characters) {
        for (const categoryId of character.categoryIds) {
            const values = index.get(categoryId) ?? [];
            values.push(character);
            index.set(categoryId, values);
        }
    }
    return index;
}
function countUniqueCharacterIds(values) {
    return new Set(values).size;
}
function compareCategoryRosterEntries(left, right) {
    return left.name.localeCompare(right.name) || left.id.localeCompare(right.id);
}
function compareCategoryRosterMembers(left, right) {
    return Number(right.isLeader) - Number(left.isLeader)
        || Number(right.isSupportUnit) - Number(left.isSupportUnit)
        || left.name.localeCompare(right.name)
        || (left.title || "").localeCompare(right.title || "")
        || left.id.localeCompare(right.id);
}
function compareCharacterRefs(left, right) {
    return left.name.localeCompare(right.name) || left.id.localeCompare(right.id);
}
function compareSupportMemoryRefs(left, right) {
    return left.name.localeCompare(right.name) || left.id.localeCompare(right.id);
}
async function readCharacterDataset() {
    const gzipPath = (0, path_1.resolve)(__dirname, CHARACTERS_GZIP_RELATIVE_PATH);
    try {
        const gzipBuffer = await (0, promises_1.readFile)(gzipPath);
        return JSON.parse((0, zlib_1.gunzipSync)(gzipBuffer).toString("utf8"));
    }
    catch (error) {
        const fallbackPath = (0, path_1.resolve)(__dirname, CHARACTERS_JSON_FALLBACK_RELATIVE_PATH);
        const raw = await (0, promises_1.readFile)(fallbackPath, { encoding: "utf8" });
        return JSON.parse(raw);
    }
}
async function readJsonFile(relativePath) {
    const filePath = (0, path_1.resolve)(__dirname, relativePath);
    const raw = await (0, promises_1.readFile)(filePath, { encoding: "utf8" });
    return JSON.parse(raw);
}
//# sourceMappingURL=fyi-category-roster.js.map