import {
    StageDetail,
    StageDetailAsset,
    StageDetailCategoryBonus,
    StageDetailEnemy,
    StageDetailEventMission,
    StageDetailSkill,
    StageDetailSuperAttack,
    StageDetailSupportMemoryLink,
    StageDetailSupportMemoryRelation,
    StageDetailZBattle,
    StageDetailsDataset,
    StageEquipmentSkillPresentation,
    StageEquipmentSkillRestrictionCondition,
} from "../stage-detail";
import { AttackTypes } from "../character";
import { createMissionStageResolver, MissionStageRelation } from "./game-db-mission-stage-relations";
import { GameDbRow, normalizeDbId, parseDbDate } from "./game-db-source";

export const STAGE_FIRST_PARTY_CONTRACT = "dokkan-stage-first-party-candidate";
export const STAGE_FIRST_PARTY_CONTRACT_VERSION = "1.0.0";

export interface StageFirstPartyTables {
    areas: GameDbRow[],
    card_awakening_routes: GameDbRow[],
    cards: GameDbRow[],
    card_unique_infos: GameDbRow[],
    card_unique_info_set_relations: GameDbRow[],
    card_specials: GameDbRow[],
    card_categories: GameDbRow[],
    chapters: GameDbRow[],
    db_stories: GameDbRow[],
    enemy_round_skill_set_relations: GameDbRow[],
    enemy_round_skill_sets: GameDbRow[],
    enemy_round_skills: GameDbRow[],
    enemy_skill_cutin_extensions: GameDbRow[],
    enemy_skills: GameDbRow[],
    equipment_skill_items: GameDbRow[],
    equipment_skill_limitations: GameDbRow[],
    equipment_skills: GameDbRow[],
    link_skill_lv_up_items: GameDbRow[],
    link_skills: GameDbRow[],
    mission_rewards: GameDbRow[],
    missions: GameDbRow[],
    passive_skill_sets: GameDbRow[],
    quest_category_bonus_groups: GameDbRow[],
    quest_category_bonus_rarity_tables: GameDbRow[],
    quest_category_bonuses: GameDbRow[],
    quest_drop_item_views: GameDbRow[],
    quests: GameDbRow[],
    related_card_categories: GameDbRow[],
    related_link_skills: GameDbRow[],
    related_optimal_awakenings: GameDbRow[],
    related_passive_skill_sets: GameDbRow[],
    sugoroku_map_boss_drop_items: GameDbRow[],
    sugoroku_map_enemy_informations: GameDbRow[],
    sugoroku_map_puzzle_colors: GameDbRow[],
    sugoroku_maps: GameDbRow[],
    treasure_items: GameDbRow[],
    special_sets: GameDbRow[],
    special_views: GameDbRow[],
    special_categories: GameDbRow[],
    z_battle_check_points: GameDbRow[],
    z_battle_enemies: GameDbRow[],
    z_battle_enemy_card_escalations: GameDbRow[],
    z_battle_enemy_skill_escalations: GameDbRow[],
    z_battle_enemy_status_escalations: GameDbRow[],
    z_battle_first_reward_level_ranges: GameDbRow[],
    z_battle_first_rewards: GameDbRow[],
    z_battle_normal_reward_tables: GameDbRow[],
    z_battle_normal_rewards: GameDbRow[],
    z_battle_powerup_thresholds: GameDbRow[],
    z_battle_stage_views: GameDbRow[],
    z_battle_stages: GameDbRow[],
}

export interface StageFirstPartyAudit {
    schemaVersion: 1,
    contract: typeof STAGE_FIRST_PARTY_CONTRACT,
    contractVersion: typeof STAGE_FIRST_PARTY_CONTRACT_VERSION,
    generatedAt: string,
    sourceSnapshotVersion: string,
    sourceDatabaseSha256: string,
    counts: {
        areas: number,
        quests: number,
        questLevels: number,
        unboundQuestLevels: number,
        encounterLevels: number,
        battles: number,
        rounds: number,
        enemyPositions: number,
        enemySuperAttacks: number,
        referencedEnemySkills: number,
        referencedRoundSkillSets: number,
        questDropViews: number,
        bossDropRows: number,
        zBattles: number,
        zBattleEnemyRanges: number,
        zBattleCheckpoints: number,
        zBattleFirstRewardLevels: number,
        supportMemoryRelations: number,
        eventMissions: number,
        supportMemoryQuestLevelLinks: number,
        supportMemoryAreaLinks: number,
        supportMemoryZBattleLinks: number,
        supportMemoryLinkedIds: number,
        supportMemoryIdsWithoutStageLink: number,
    },
    authority: {
        topology: "first-party",
        enemies: "first-party",
        superAttacks: "first-party",
        skillsAndGimmickPresentation: "first-party-structured-raw",
        linkLevelRate: "first-party",
        rewardsAndCosts: "first-party-structured-raw",
        presentationAndNavigation: "first-party",
        traditionalEnemyStats: "unavailable-in-game-db",
        zBattleStats: "first-party-raw-base-and-curves-formula-unproved",
        supportMemoryStageRelations: "first-party-mission-json-ids",
        eventMissions: "first-party-missions-and-rewards",
    },
    unresolved: {
        unboundQuestLevelIds: string[],
        supportMemoryIdsWithoutStageLink: string[],
    },
}

export interface StageFirstPartyCandidate {
    dataset: StageDetailsDataset,
    audit: StageFirstPartyAudit,
}

interface ParsedEncounter {
    displayType: string,
    battles: Array<{
        rounds: Array<{
            roundNo: number,
            comment?: string,
            enemies: Array<{
                cardId: string,
                enemySkillIds: string[],
                enemyRoundSkillSetId?: string,
            }>,
        }>,
    }>,
}

function numericCompare(left: string, right: string): number {
    return Number(left) - Number(right) || left.localeCompare(right);
}

function text(value?: string | null): string {
    return value?.trim() ?? "";
}

function id(row: GameDbRow, column = "id"): string {
    const value = normalizeDbId(row[column]);
    if (!value || !/^-?\d+$/.test(value)) throw new Error(`Stage row is missing numeric ${column}`);
    return value;
}

function optionalId(row: GameDbRow, column: string): string | undefined {
    const raw = text(row[column]);
    if (!raw) return undefined;
    const value = normalizeDbId(raw);
    if (!value || !/^-?\d+$/.test(value)) throw new Error(`Stage row has invalid ${column}`);
    return value;
}

function numberValue(row: GameDbRow, column: string): number {
    const raw = text(row[column]);
    if (!raw) throw new Error(`Stage row ${id(row)} is missing ${column}`);
    const value = Number(raw);
    if (!Number.isFinite(value)) throw new Error(`Stage row ${id(row)} has invalid ${column}`);
    return value;
}

function integer(row: GameDbRow, column: string): number {
    const value = numberValue(row, column);
    if (!Number.isSafeInteger(value)) throw new Error(`Stage row ${id(row)} has non-integer ${column}`);
    return value;
}

function optionalInteger(row: GameDbRow, column: string): number | undefined {
    if (!text(row[column])) return undefined;
    return integer(row, column);
}

function cardRewardPresentation(
    itemType: string,
    itemId: string,
    cards: ReadonlyMap<string, GameDbRow>,
    canonicalAwakenedCards: ReadonlyMap<string, string>,
): { name?: string, thumbnailId?: string, rarityRaw?: number, elementRaw?: number, detailCharacterId?: string } {
    if (itemType !== "Card") return {};
    const card = cards.get(itemId);
    if (!card) return {};
    return {
        ...(text(card.name) ? { name: text(card.name) } : {}),
        ...(optionalId(card, "resource_id") ? { thumbnailId: optionalId(card, "resource_id") } : {}),
        ...(optionalInteger(card, "rarity") !== undefined ? { rarityRaw: optionalInteger(card, "rarity") } : {}),
        ...(optionalInteger(card, "element") !== undefined ? { elementRaw: optionalInteger(card, "element") } : {}),
        ...(canonicalAwakenedCards.get(itemId) ? { detailCharacterId: canonicalAwakenedCards.get(itemId) } : {}),
    };
}

function rewardPresentation(
    itemType: string,
    itemId: string,
    cards: ReadonlyMap<string, GameDbRow>,
    canonicalAwakenedCards: ReadonlyMap<string, string>,
    treasureItems: ReadonlyMap<string, GameDbRow>,
    linkSkillLvUpItems: ReadonlyMap<string, GameDbRow>,
    equipmentSkillItems: ReadonlyMap<string, GameDbRow>,
    equipmentSkillPresentations: ReadonlyMap<string, StageEquipmentSkillPresentation>,
): {
    name?: string,
    description?: string,
    thumbnailId?: string,
    rarityRaw?: number,
    elementRaw?: number,
    detailCharacterId?: string,
    iconAssetPath?: string,
    backgroundAssetPath?: string,
    equipmentSkill?: StageEquipmentSkillPresentation,
} {
    if (itemType === "Card") {
        return cardRewardPresentation(itemType, itemId, cards, canonicalAwakenedCards);
    }
    if (itemType === "TreasureItem") {
        const item = treasureItems.get(itemId);
        if (!item) throw new Error(`Stage reward references missing treasure item ${itemId}`);
        return {
            ...(text(item.name) ? { name: text(item.name) } : {}),
            ...(optionalId(item, "image_suffix_number") ? { thumbnailId: optionalId(item, "image_suffix_number") } : {}),
        };
    }
    if (itemType === "LinkSkillLvUpItem") {
        const item = linkSkillLvUpItems.get(itemId);
        if (!item) throw new Error(`Stage reward references missing Link Skill level-up item ${itemId}`);
        const rarity = integer(item, "rarity");
        if (rarity < 0 || rarity > 2) {
            throw new Error(`Link Skill level-up item ${itemId} has unsupported rarity ${rarity}`);
        }
        const name = text(item.name);
        const description = text(item.description);
        if (!name || !description) {
            throw new Error(`Link Skill level-up item ${itemId} is missing official presentation text`);
        }
        const paddedId = itemId.padStart(5, "0");
        return {
            name,
            description,
            rarityRaw: rarity,
            iconAssetPath: `item/other/en/thumb/thumb_linkskill_orb_${paddedId}/thumb_linkskill_orb_${paddedId}.png`,
        };
    }
    if (itemType === "EquipmentSkillItem") {
        const item = equipmentSkillItems.get(itemId);
        if (!item) throw new Error(`Stage reward references missing equipment skill item ${itemId}`);
        const grade = text(item.grade).toLowerCase();
        if (!["bronze", "silver", "gold"].includes(grade)) {
            throw new Error(`Equipment skill item ${itemId} has unsupported grade ${grade}`);
        }
        const iconId = id(item, "icon_image_id").padStart(5, "0");
        const equipmentSkill = equipmentSkillPresentations.get(itemId);
        if (!equipmentSkill) throw new Error(`Stage reward references missing equipment skill presentation ${itemId}`);
        return {
            ...(text(item.name) ? { name: text(item.name) } : {}),
            iconAssetPath: `item/equipment/equ_item_${iconId}.png`,
            backgroundAssetPath: `layout/en/image/item/equipment/equipment_thumb_bg/equ_base_${grade}.png`,
            equipmentSkill,
        };
    }
    return {};
}

function missionDescription(value?: string | null): string | undefined {
    const normalized = text(value)
        .replace(/\{cards:[^{}]+\}/g, " ")
        .replace(/[ \t]+(?=\r?\n)/g, "")
        .replace(/[ \t]{2,}/g, " ")
        .trim();
    return normalized || undefined;
}

function canonicalAwakenedCardIds(
    routes: GameDbRow[],
    cards: ReadonlyMap<string, GameDbRow>,
): Map<string, string> {
    const direct = new Map<string, string>();
    for (const [cardId, rows] of groupBy(routes, "card_id")) {
        const targets = [...new Set(rows.map(row => id(row, "awaked_card_id")).filter(target => target !== cardId))];
        if (targets.length === 1 && cards.has(targets[0])) direct.set(cardId, targets[0]);
    }
    const result = new Map<string, string>();
    for (const cardId of cards.keys()) {
        const visited = new Set([cardId]);
        let current = cardId;
        while (direct.has(current)) {
            const next = direct.get(current)!;
            if (visited.has(next)) break;
            visited.add(next);
            current = next;
        }
        if (current !== cardId) result.set(cardId, current);
    }
    return result;
}

function booleanValue(row: GameDbRow, column: string): boolean {
    const value = integer(row, column);
    if (value !== 0 && value !== 1) throw new Error(`Stage row ${id(row)} has invalid boolean ${column}`);
    return value === 1;
}

function superAttacksForCard(
    cardId: string,
    cardSpecials: Map<string, GameDbRow[]>,
    specialSets: Map<string, GameDbRow>,
    specialViews: Map<string, GameDbRow>,
    specialCategories: Map<string, GameDbRow>,
): StageDetailSuperAttack[] {
    return [...(cardSpecials.get(cardId) ?? [])]
        .sort((left, right) => integer(left, "priority") - integer(right, "priority") || numericCompare(id(left), id(right)))
        .map(relation => {
            const specialSetId = id(relation, "special_set_id");
            const specialSet = specialSets.get(specialSetId);
            if (!specialSet) throw new Error(`Card ${cardId} references missing special set ${specialSetId}`);
            const name = text(specialSet.name);
            if (!name) throw new Error(`Special set ${specialSetId} is missing its official name`);
            const ki = optionalInteger(relation, "eball_num_start");
            const viewId = optionalId(relation, "view_id");
            const view = viewId ? specialViews.get(viewId) : undefined;
            const categoryId = view ? optionalId(view, "special_category_id") : undefined;
            const category = categoryId ? specialCategories.get(categoryId) : undefined;
            const rawAttribute = category ? optionalInteger(category, "raw_attribute") : undefined;
            const attackType = !view
                ? undefined
                : !categoryId
                    ? AttackTypes.Other
                    : rawAttribute === 1
                        ? AttackTypes.KiBlast
                        : rawAttribute === 2
                            ? AttackTypes.Unarmed
                            : rawAttribute === 4
                                ? AttackTypes.Armed
                                : undefined;
            return {
                id: id(relation),
                specialSetId,
                name,
                ...(text(specialSet.description) ? { description: text(specialSet.description) } : {}),
                ...(text(relation.style) ? { style: text(relation.style) } : {}),
                ...(ki !== undefined ? { ki } : {}),
                ...(attackType ? { attackType } : {}),
            };
        });
}

function date(row: GameDbRow, column: string): string | undefined {
    const raw = text(row[column]);
    const parsed = parseDbDate(raw);
    if (raw && !parsed) throw new Error(`Stage row ${id(row)} has invalid ${column}`);
    return parsed;
}

function jsonValue(raw: string | undefined, label: string): unknown {
    if (!text(raw)) return {};
    try {
        return JSON.parse(raw!);
    } catch {
        throw new Error(`Stage ${label} contains invalid JSON`);
    }
}

function jsonObject(raw: string | undefined, label: string): Record<string, unknown> {
    const value = jsonValue(raw, label);
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`Stage ${label} must be a JSON object`);
    return value as Record<string, unknown>;
}

function jsonIds(value: unknown, label: string): string[] {
    if (value === undefined || value === null) return [];
    if (!Array.isArray(value)) throw new Error(`Stage ${label} must be an array`);
    return value.map(item => {
        const normalized = normalizeDbId(item === null || item === undefined ? undefined : String(item));
        if (!normalized || !/^\d+$/.test(normalized)) throw new Error(`Stage ${label} contains an invalid ID`);
        return normalized;
    });
}

function uniqueById(rows: GameDbRow[], label: string, column = "id"): Map<string, GameDbRow> {
    const result = new Map<string, GameDbRow>();
    for (const row of rows) {
        const rowId = id(row, column);
        if (result.has(rowId)) throw new Error(`Duplicate ${label} ${rowId}`);
        result.set(rowId, row);
    }
    return result;
}

function requireRow(rows: ReadonlyMap<string, GameDbRow>, rowId: string, context: string): GameDbRow {
    const row = rows.get(rowId);
    if (!row) throw new Error(`${context} references missing row ${rowId}`);
    return row;
}

function groupBy(rows: GameDbRow[], column: string): Map<string, GameDbRow[]> {
    const result = new Map<string, GameDbRow[]>();
    for (const row of rows) {
        const key = id(row, column);
        result.set(key, [...(result.get(key) ?? []), row]);
    }
    return result;
}

const ELEMENT_LIMITATION_BITS = [
    { bit: 1, code: "AGL", assetCode: "00" },
    { bit: 2, code: "TEQ", assetCode: "01" },
    { bit: 4, code: "INT", assetCode: "02" },
    { bit: 8, code: "STR", assetCode: "03" },
    { bit: 16, code: "PHY", assetCode: "04" },
    { bit: 4096, code: "SUPER_AGL", assetCode: "10" },
    { bit: 8192, code: "SUPER_TEQ", assetCode: "11" },
    { bit: 16384, code: "SUPER_INT", assetCode: "12" },
    { bit: 32768, code: "SUPER_STR", assetCode: "13" },
    { bit: 65536, code: "SUPER_PHY", assetCode: "14" },
    { bit: 131072, code: "EXTREME_AGL", assetCode: "20" },
    { bit: 262144, code: "EXTREME_TEQ", assetCode: "21" },
    { bit: 524288, code: "EXTREME_INT", assetCode: "22" },
    { bit: 1048576, code: "EXTREME_STR", assetCode: "23" },
    { bit: 2097152, code: "EXTREME_PHY", assetCode: "24" },
] as const;

const EQUIPMENT_UI_ASSET_ROOT = "layout/en/image/charamenu/potential";

function equipmentLevelAssetPath(levels: number[]): string {
    if (levels.length < 1 || levels.length > 2 || levels.some(level => !Number.isSafeInteger(level) || level < 1 || level > 99)) {
        throw new Error(`Unsupported equipment level presentation ${levels.join("/")}`);
    }
    return `derived/equipment/levels/lv-${levels.join("-")}.png`;
}

function conciseNames(names: string[]): string {
    const unique = [...new Set(names.map(text).filter(Boolean))];
    if (unique.length <= 2) return unique.join(" / ");
    return `${unique.slice(0, 2).join(" / ")} +${unique.length - 2}`;
}

function exactConditionIds(
    conditions: Record<string, unknown>,
    key: string,
    context: string,
): string[] {
    if (Object.keys(conditions).length !== 1 || !(key in conditions)) {
        throw new Error(`${context} has unsupported condition fields`);
    }
    const values = jsonIds(conditions[key], `${context} ${key}`);
    if (values.length === 0 || new Set(values).size !== values.length) {
        throw new Error(`${context} must contain distinct ${key}`);
    }
    return values;
}

function equipmentRestriction(
    row: GameDbRow,
    cardCategories: ReadonlyMap<string, GameDbRow>,
    cards: ReadonlyMap<string, GameDbRow>,
    uniqueInfoRelationsBySet: ReadonlyMap<string, GameDbRow[]>,
    uniqueInfos: ReadonlyMap<string, GameDbRow>,
): StageEquipmentSkillRestrictionCondition {
    const sourceRowId = id(row);
    const rawType = text(row.type);
    const rawConditions = jsonObject(row.conditions, `equipment limitation ${sourceRowId}`);
    const base = { sourceRowId, rawType, rawConditions };
    if (rawType === "EquipmentSkillLimitation::ElementLimitation") {
        if (Object.keys(rawConditions).length !== 1 || !("element_bitpattern" in rawConditions)) {
            throw new Error(`Equipment limitation ${sourceRowId} has unsupported condition fields`);
        }
        const elementBitPattern = Number(rawConditions.element_bitpattern);
        if (!Number.isSafeInteger(elementBitPattern) || elementBitPattern <= 0) {
            throw new Error(`Equipment limitation ${sourceRowId} has invalid element_bitpattern`);
        }
        const matched = ELEMENT_LIMITATION_BITS.filter(value => (elementBitPattern & value.bit) !== 0);
        const knownMask = matched.reduce((mask, value) => mask + value.bit, 0);
        if (knownMask !== elementBitPattern) {
            throw new Error(`Equipment limitation ${sourceRowId} has unsupported element_bitpattern ${elementBitPattern}`);
        }
        const isUnrestricted = elementBitPattern === 31;
        const badgeLabel = isUnrestricted ? "ALL" : elementBitPattern === 126976 ? "SUPER" : elementBitPattern === 4063232 ? "EXTREME" : matched.map(value => value.code).join("/");
        const badgeAssetPaths = isUnrestricted
            ? []
            : matched.map(value => `layout/en/image/character/cha_type_icon_${value.assetCode}.png`);
        return {
            ...base,
            kind: "element",
            isUnrestricted,
            elementBitPattern,
            elementCodes: matched.map(value => value.code),
            presentation: {
                badgeLabel,
                detailLabel: isUnrestricted ? "All types" : badgeLabel.replace(/_/g, " "),
                ...(badgeAssetPaths.length === 1 ? { badgeAssetPath: badgeAssetPaths[0] } : {}),
                ...(badgeAssetPaths.length ? { badgeAssetPaths } : {}),
            },
        };
    }
    if (rawType === "EquipmentSkillLimitation::CardCategoryLimitation") {
        const cardCategoryIds = exactConditionIds(rawConditions, "card_category_ids", `Equipment limitation ${sourceRowId}`);
        const names = cardCategoryIds.map(categoryId => text(requireRow(cardCategories, categoryId, `Equipment limitation ${sourceRowId} category`).name));
        if (names.some(name => !name)) throw new Error(`Equipment limitation ${sourceRowId} references an unnamed category`);
        const badgeAssetPath = `${EQUIPMENT_UI_ASSET_ROOT}/equ_icon_category.png`;
        return { ...base, kind: "category", isUnrestricted: false, cardCategoryIds, presentation: { badgeLabel: "CAT", detailLabel: conciseNames(names), badgeAssetPath, badgeAssetPaths: [badgeAssetPath] } };
    }
    if (rawType === "EquipmentSkillLimitation::CardLimitation") {
        const cardIds = exactConditionIds(rawConditions, "card_ids", `Equipment limitation ${sourceRowId}`);
        const names = cardIds.map(cardId => text(requireRow(cards, cardId, `Equipment limitation ${sourceRowId} card`).name));
        if (names.some(name => !name)) throw new Error(`Equipment limitation ${sourceRowId} references an unnamed card`);
        const badgeAssetPath = `${EQUIPMENT_UI_ASSET_ROOT}/equ_icon_specific_chara.png`;
        return { ...base, kind: "card", isUnrestricted: false, cardIds, presentation: { badgeLabel: "UNIT", detailLabel: conciseNames(names), badgeAssetPath, badgeAssetPaths: [badgeAssetPath] } };
    }
    if (rawType === "EquipmentSkillLimitation::CardUniqueInfoSetLimitation") {
        const cardUniqueInfoSetIds = exactConditionIds(rawConditions, "card_unique_info_set_ids", `Equipment limitation ${sourceRowId}`);
        const names = cardUniqueInfoSetIds.flatMap(uniqueSetId => {
            const relations = uniqueInfoRelationsBySet.get(uniqueSetId);
            if (!relations?.length) throw new Error(`Equipment limitation ${sourceRowId} references missing card unique info set ${uniqueSetId}`);
            return relations.map(relation => text(requireRow(uniqueInfos, id(relation, "card_unique_info_id"), `Card unique info set ${uniqueSetId}`).name));
        });
        if (names.some(name => !name)) throw new Error(`Equipment limitation ${sourceRowId} references an unnamed character identity`);
        const badgeAssetPath = `${EQUIPMENT_UI_ASSET_ROOT}/equ_icon_same_chara.png`;
        return { ...base, kind: "card-unique-info-set", isUnrestricted: false, cardUniqueInfoSetIds, presentation: { badgeLabel: "CHAR", detailLabel: conciseNames(names), badgeAssetPath, badgeAssetPaths: [badgeAssetPath] } };
    }
    throw new Error(`Equipment limitation ${sourceRowId} has unsupported type ${rawType}`);
}

function equipmentSkillPresentations(
    tables: StageFirstPartyTables,
    equipmentItems: ReadonlyMap<string, GameDbRow>,
    cards: ReadonlyMap<string, GameDbRow>,
    cardCategories: ReadonlyMap<string, GameDbRow>,
): Map<string, StageEquipmentSkillPresentation> {
    const skillsByItem = groupBy(tables.equipment_skills, "equipment_skill_item_id");
    const limitationsBySet = groupBy(tables.equipment_skill_limitations, "equipment_skill_limitation_set_id");
    const uniqueInfos = uniqueById(tables.card_unique_infos, "card unique info");
    const uniqueInfoRelationsBySet = groupBy(tables.card_unique_info_set_relations, "card_unique_info_set_id");
    // Mirrors EquipmentItem::Efficacy::getDisplayPriority in the official Global client.
    const displayPriority = new Map<string, number>([
        ["potential:2", 10], ["potential:1", 9], ["potential:7", 8], ["potential:4", 7],
        ["potential:5", 6], ["potential:6", 5], ["potential:3", 4],
        ["status:hp", 3], ["status:attack", 2], ["status:defense", 1],
    ]);
    const result = new Map<string, StageEquipmentSkillPresentation>();
    for (const [itemId, item] of equipmentItems) {
        const grade = text(item.grade).toLowerCase();
        if (grade !== "bronze" && grade !== "silver" && grade !== "gold") throw new Error(`Equipment skill item ${itemId} has unsupported grade ${grade}`);
        const skillRows = skillsByItem.get(itemId) ?? [];
        if (skillRows.length === 0) throw new Error(`Equipment skill item ${itemId} has no skill rows`);
        const skills = skillRows.map(skillRow => {
            const potentialSkillId = optionalId(skillRow, "potential_skill_id");
            const statusType = text(skillRow.status_type).toLowerCase();
            if (Boolean(potentialSkillId) === Boolean(statusType)) throw new Error(`Equipment skill ${id(skillRow)} must identify exactly one effect`);
            if (statusType && statusType !== "hp" && statusType !== "attack" && statusType !== "defense") throw new Error(`Equipment skill ${id(skillRow)} has unsupported status_type ${statusType}`);
            const level = integer(skillRow, "level");
            if (level <= 0) throw new Error(`Equipment skill ${id(skillRow)} has invalid level ${level}`);
            const identity = potentialSkillId ? `potential:${potentialSkillId}` : `status:${statusType}`;
            const priority = displayPriority.get(identity);
            if (!priority) throw new Error(`Equipment skill ${id(skillRow)} has no proved native display priority for ${identity}`);
            return {
                sourceRowId: id(skillRow),
                ...(potentialSkillId ? { potentialSkillId } : {}),
                ...(statusType ? { statusType: statusType as "hp" | "attack" | "defense" } : {}),
                level,
                priority,
            };
        }).sort((left, right) => right.priority - left.priority).map(({ priority: _priority, ...skill }) => skill);
        const limitationSetId = optionalId(item, "equipment_skill_limitation_set_id");
        if (!limitationSetId) throw new Error(`Equipment skill item ${itemId} has no limitation set`);
        const limitationRows = limitationsBySet.get(limitationSetId) ?? [];
        if (limitationRows.length === 0) throw new Error(`Equipment skill item ${itemId} limitation set ${limitationSetId} has no rows`);
        const conditions = limitationRows
            .sort((left, right) => numericCompare(id(left), id(right)))
            .map(row => equipmentRestriction(row, cardCategories, cards, uniqueInfoRelationsBySet, uniqueInfos));
        const isUnrestricted = conditions.some(condition => condition.isUnrestricted);
        // EquipmentItem::canEquip accepts any matched limitation entry; repeated rows are set-unioned by type.
        const limitationKinds = [...new Set(conditions.map(condition => condition.kind))];
        // Native getDisplayLimitationType returns no badge for more than one family.
        // Repeated rows in one family retain that family's graphical badge.
        const presentation = limitationKinds.length === 1 ? {
            badgeLabel: conditions[0].presentation.badgeLabel,
            detailLabel: conciseNames(conditions.map(condition => condition.presentation.detailLabel)),
            ...(conditions[0].presentation.badgeAssetPath ? { badgeAssetPath: conditions[0].presentation.badgeAssetPath } : {}),
            ...(conditions[0].presentation.badgeAssetPaths ? { badgeAssetPaths: conditions[0].presentation.badgeAssetPaths } : {}),
        } : {
            badgeLabel: isUnrestricted ? "ALL" : "ANY",
            detailLabel: conciseNames(conditions.map(condition => condition.presentation.detailLabel)),
        };
        const isEternal = booleanValue(item, "is_eternal");
        result.set(itemId, {
            grade,
            skills,
            isEternal,
            levelAssetPath: equipmentLevelAssetPath(skills.map(skill => skill.level)),
            ...(isEternal ? { infinityAssetPath: `${EQUIPMENT_UI_ASSET_ROOT}/equ_infinite_icon_${grade}.png` } : {}),
            restriction: { setId: limitationSetId, combination: "any", conditions, isUnrestricted, presentation },
        });
    }
    for (const skillRow of tables.equipment_skills) if (!equipmentItems.has(id(skillRow, "equipment_skill_item_id"))) throw new Error(`Equipment skill ${id(skillRow)} references missing item`);
    return result;
}

function officialAsset(sourcePath?: string): StageDetailAsset | undefined {
    const normalized = text(sourcePath).replace(/\\/g, "/").replace(/^\/+/, "");
    if (!normalized) return undefined;
    if (normalized.split("/").some(segment => !segment || segment === "." || segment === "..")) {
        throw new Error(`Unsafe official Stage asset path: ${sourcePath}`);
    }
    return { sourcePath: normalized };
}

function parseEncounter(row: GameDbRow): ParsedEncounter {
    const sourceId = id(row, "sugoroku_map_id");
    const raw = jsonObject(row.enemy_info, `encounter ${sourceId}`);
    if (raw.battles !== null && !Array.isArray(raw.battles) || typeof raw.display_type !== "string") throw new Error(`Stage encounter ${sourceId} has an invalid shape`);
    return {
        displayType: raw.display_type,
        battles: (raw.battles ?? [] as unknown[]).map((battle, battleIndex) => {
            if (!battle || typeof battle !== "object" || !Array.isArray((battle as Record<string, unknown>).rounds)) {
                throw new Error(`Stage encounter ${sourceId} battle ${battleIndex} has an invalid shape`);
            }
            return {
                rounds: ((battle as Record<string, unknown>).rounds as unknown[]).map((round, roundIndex) => {
                    if (!round || typeof round !== "object") throw new Error(`Stage encounter ${sourceId} round ${roundIndex} has an invalid shape`);
                    const value = round as Record<string, unknown>;
                    if (!Number.isSafeInteger(value.round_no) || !Array.isArray(value.enemies)) throw new Error(`Stage encounter ${sourceId} round ${roundIndex} has invalid fields`);
                    return {
                        roundNo: value.round_no as number,
                        ...(typeof value.comment === "string" && value.comment.trim() ? { comment: value.comment.trim() } : {}),
                        enemies: value.enemies.map((enemy, enemyIndex) => {
                            if (!enemy || typeof enemy !== "object") throw new Error(`Stage encounter ${sourceId} enemy ${enemyIndex} has an invalid shape`);
                            const fields = enemy as Record<string, unknown>;
                            const cardId = normalizeDbId(String(fields.card_id ?? ""));
                            if (!cardId || !/^\d+$/.test(cardId)) throw new Error(`Stage encounter ${sourceId} enemy ${enemyIndex} has invalid card_id`);
                            return {
                                cardId,
                                enemySkillIds: jsonIds(fields.enemy_skill_ids, `encounter ${sourceId} enemy_skill_ids`),
                                ...(fields.enemy_round_skill_set_id === null || fields.enemy_round_skill_set_id === undefined
                                    ? {}
                                    : { enemyRoundSkillSetId: jsonIds([fields.enemy_round_skill_set_id], `encounter ${sourceId} enemy_round_skill_set_id`)[0] }),
                            };
                        }),
                    };
                }),
            };
        }),
    };
}

function skill(
    row: GameDbRow,
    source: "enemy-skill" | "enemy-round-skill",
    relations: {
        cardCategories: Map<string, GameDbRow[]>,
        linkSkills: Map<string, GameDbRow[]>,
        optimalAwakenings: Map<string, GameDbRow[]>,
        passiveSkillSets: Map<string, GameDbRow[]>,
        cutIns: Map<string, GameDbRow>,
    },
): StageDetailSkill {
    const skillId = id(row);
    const optional = (column: string) => text(row[column]) ? integer(row, column) : undefined;
    const cutIn = source === "enemy-skill" ? relations.cutIns.get(skillId) : undefined;
    return {
        id: skillId,
        source,
        semanticStatus: "structured-raw",
        type: optional("efficacy_type"),
        values: [optional("eff_value1") ?? null, optional("eff_value2") ?? null, optional("eff_value3") ?? null],
        target: optional("target_type"),
        calculation: optional("calc_option"),
        turns: optional("turn"),
        chance: optional("probability"),
        executionTiming: optional("exec_timing_type"),
        ...(source === "enemy-skill" && text(row.is_once) ? { onceOnly: booleanValue(row, "is_once") } : {}),
        causalityConditions: jsonValue(row.causality_conditions, `${source} ${skillId} causality_conditions`),
        rawEfficacyValues: jsonValue(row.efficacy_values, `${source} ${skillId} efficacy_values`),
        name: text(row.name) || undefined,
        description: text(row.description) || undefined,
        relatedCardCategoryIds: (relations.cardCategories.get(skillId) ?? []).map(value => id(value, "card_category_id")).sort(numericCompare),
        relatedLinkSkillIds: (relations.linkSkills.get(skillId) ?? []).map(value => id(value, "link_skill_id")).sort(numericCompare),
        relatedOptimalAwakeningCategoryIds: (relations.optimalAwakenings.get(skillId) ?? []).map(value => id(value, "card_category_id")).sort(numericCompare),
        relatedPassiveSkillSetIds: (relations.passiveSkillSets.get(skillId) ?? []).map(value => id(value, "passive_skill_set_id")).sort(numericCompare),
        ...(cutIn && text(cutIn.phrase) ? { cutInPhrase: text(cutIn.phrase) } : {}),
        ...(cutIn && optionalId(cutIn, "voice_asset_id") ? { cutInVoiceAssetId: optionalId(cutIn, "voice_asset_id") } : {}),
    };
}

function supportMemoryStageLinks(
    tables: StageFirstPartyTables,
    stageIds: ReadonlySet<string>,
    areaIds: ReadonlySet<string>,
    zBattleIds: ReadonlySet<string>,
): {
    byStage: Map<string, StageDetailSupportMemoryLink[]>,
    relations: StageDetailSupportMemoryRelation[],
    linkedMemoryIds: Set<string>,
    allMemoryIds: Set<string>,
} {
    const resolveMissionStages = createMissionStageResolver(tables.missions);
    const links = new Map<string, Map<string, { missionIds: Set<string>, relation: StageDetailSupportMemoryLink["relation"] }>>();
    const relations = new Map<string, { memoryId: string, targetKind: StageDetailSupportMemoryRelation["targetKind"], targetId: string, missionIds: Set<string>, relation: MissionStageRelation }>();
    const linkedMemoryIds = new Set<string>();
    const allMemoryIds = new Set<string>();
    const addRelation = (
        memoryId: string,
        missionId: string,
        targetKind: StageDetailSupportMemoryRelation["targetKind"],
        targetId: string,
        relation: MissionStageRelation,
    ) => {
        const key = `${memoryId}:${targetKind}:${targetId}`;
        const existing = relations.get(key) ?? { memoryId, targetKind, targetId, missionIds: new Set<string>(), relation };
        existing.missionIds.add(missionId);
        if (existing.relation === "transitive-mission-condition" && relation !== "transitive-mission-condition") existing.relation = relation;
        relations.set(key, existing);
        linkedMemoryIds.add(memoryId);
    };
    for (const reward of tables.mission_rewards) {
        if (text(reward.item_type) !== "SupportMemory") continue;
        const memoryId = id(reward, "item_id");
        const missionId = id(reward, "mission_id");
        allMemoryIds.add(memoryId);
        const resolution = resolveMissionStages(missionId);
        for (const [resolvedAreaId, relation] of resolution.areaIds) {
            if (!areaIds.has(resolvedAreaId)) throw new Error(`Support Memory ${memoryId} references missing Stage area ${resolvedAreaId}`);
            addRelation(memoryId, missionId, "area", resolvedAreaId, relation);
        }
        for (const [resolvedZBattleId, relation] of resolution.zBattleIds) {
            if (!zBattleIds.has(resolvedZBattleId)) throw new Error(`Support Memory ${memoryId} references missing Z-Battle ${resolvedZBattleId}`);
            addRelation(memoryId, missionId, "z-battle", resolvedZBattleId, relation);
        }
        for (const [stageId, relation] of resolution.stageIds) {
            if (!stageIds.has(stageId)) throw new Error(`Support Memory ${memoryId} references missing Stage ${stageId}`);
            addRelation(memoryId, missionId, "quest-level", stageId, relation);
            const stageLinks = links.get(stageId) ?? new Map();
            const existing = stageLinks.get(memoryId) ?? { missionIds: new Set<string>(), relation };
            existing.missionIds.add(missionId);
            if (relation === "direct-stage-condition") existing.relation = relation;
            stageLinks.set(memoryId, existing);
            links.set(stageId, stageLinks);
        }
    }
    return {
        byStage: new Map([...links].map(([stageId, values]) => [stageId, [...values].map(([memoryId, value]) => ({
            memoryId,
            missionIds: [...value.missionIds].sort(numericCompare),
            relation: value.relation,
        })).sort((left, right) => numericCompare(left.memoryId, right.memoryId))])),
        relations: [...relations.values()].map(value => ({
            memoryId: value.memoryId,
            targetKind: value.targetKind,
            targetId: value.targetId,
            missionIds: [...value.missionIds].sort(numericCompare),
            relation: value.relation,
        })).sort((left, right) => numericCompare(left.memoryId, right.memoryId)
            || left.targetKind.localeCompare(right.targetKind)
            || numericCompare(left.targetId, right.targetId)),
        linkedMemoryIds,
        allMemoryIds,
    };
}

export function buildStageFirstPartyCandidate(options: {
    generatedAt: string,
    sourceSnapshotVersion: string,
    sourceDatabaseSha256: string,
    tables: StageFirstPartyTables,
}): StageFirstPartyCandidate {
    if (!/^\d+$/.test(options.sourceSnapshotVersion)) throw new Error("Stage source snapshot version must be numeric");
    if (!/^[a-f0-9]{64}$/.test(options.sourceDatabaseSha256)) throw new Error("Stage source database SHA-256 is invalid");
    if (Number.isNaN(Date.parse(options.generatedAt))) throw new Error("Stage generatedAt is invalid");

    const areas = uniqueById(options.tables.areas, "area");
    const chapters = uniqueById(options.tables.chapters, "chapter");
    const stories = uniqueById(options.tables.db_stories, "DB story");
    const cards = uniqueById(options.tables.cards, "card");
    const cardCategories = uniqueById(options.tables.card_categories, "card category");
    const treasureItems = uniqueById(options.tables.treasure_items, "treasure item");
    const linkSkillLvUpItems = uniqueById(options.tables.link_skill_lv_up_items, "Link Skill level-up item");
    const equipmentSkillItems = uniqueById(options.tables.equipment_skill_items, "equipment skill item");
    const equipmentPresentations = equipmentSkillPresentations(options.tables, equipmentSkillItems, cards, cardCategories);
    const canonicalAwakenedCards = canonicalAwakenedCardIds(options.tables.card_awakening_routes, cards);
    const cardSpecials = groupBy(options.tables.card_specials, "card_id");
    const specialSets = uniqueById(options.tables.special_sets, "special set");
    const specialViews = uniqueById(options.tables.special_views, "special view");
    const specialCategories = uniqueById(options.tables.special_categories, "special category");
    const quests = uniqueById(options.tables.quests, "quest");
    const maps = uniqueById(options.tables.sugoroku_maps, "quest level");
    const encounters = uniqueById(options.tables.sugoroku_map_enemy_informations, "encounter", "sugoroku_map_id");
    const enemySkills = uniqueById(options.tables.enemy_skills, "enemy skill");
    const roundSets = uniqueById(options.tables.enemy_round_skill_sets, "enemy round skill set");
    const roundSkills = uniqueById(options.tables.enemy_round_skills, "enemy round skill");
    const roundRelations = groupBy(options.tables.enemy_round_skill_set_relations, "enemy_round_skill_set_id");
    const dropsByMap = groupBy(options.tables.sugoroku_map_boss_drop_items, "sugoroku_map_id");
    const dropViewsByQuest = groupBy(options.tables.quest_drop_item_views, "quest_id");
    const bonusesByQuest = groupBy(options.tables.quest_category_bonuses, "quest_id");
    const rarityTables = uniqueById(options.tables.quest_category_bonus_rarity_tables, "quest category bonus rarity table");
    const bonusGroups = new Map<string, GameDbRow>();
    for (const row of options.tables.quest_category_bonus_groups) {
        const type = text(row.quest_category_bonus_type);
        if (!type || bonusGroups.has(type)) throw new Error(`Invalid or duplicate quest category bonus group ${type}`);
        bonusGroups.set(type, row);
    }
    const puzzleColors = uniqueById(options.tables.sugoroku_map_puzzle_colors, "puzzle color");
    const relations = {
        cardCategories: groupBy(options.tables.related_card_categories, "enemy_skill_id"),
        linkSkills: groupBy(options.tables.related_link_skills, "enemy_skill_id"),
        optimalAwakenings: groupBy(options.tables.related_optimal_awakenings, "enemy_skill_id"),
        passiveSkillSets: groupBy(options.tables.related_passive_skill_sets, "enemy_skill_id"),
        cutIns: uniqueById(options.tables.enemy_skill_cutin_extensions, "enemy skill cut-in", "enemy_skill_id"),
    };
    const linkSkills = uniqueById(options.tables.link_skills, "link skill");
    const passiveSkillSets = uniqueById(options.tables.passive_skill_sets, "passive skill set");
    for (const rows of relations.cardCategories.values()) for (const row of rows) if (!cardCategories.has(id(row, "card_category_id"))) throw new Error(`Enemy skill relation ${id(row)} references missing card category`);
    for (const rows of relations.optimalAwakenings.values()) for (const row of rows) if (!cardCategories.has(id(row, "card_category_id"))) throw new Error(`Enemy skill relation ${id(row)} references missing optimal awakening category`);
    for (const rows of relations.linkSkills.values()) for (const row of rows) if (!linkSkills.has(id(row, "link_skill_id"))) throw new Error(`Enemy skill relation ${id(row)} references missing link skill`);
    for (const rows of relations.passiveSkillSets.values()) for (const row of rows) if (!passiveSkillSets.has(id(row, "passive_skill_set_id"))) throw new Error(`Enemy skill relation ${id(row)} references missing passive skill set`);

    const zStages = uniqueById(options.tables.z_battle_stages, "Z-Battle stage");
    const supportLinks = supportMemoryStageLinks(options.tables, new Set(maps.keys()), new Set(areas.keys()), new Set(zStages.keys()));
    const referencedSkillIds = new Set<string>();
    const referencedRoundSetIds = new Set<string>();
    let battleCount = 0, roundCount = 0, enemyCount = 0, enemySuperAttackCount = 0;

    const entries: StageDetail[] = [];
    const unboundQuestLevelIds: string[] = [];
    for (const mapRow of [...maps.values()].sort((left, right) => numericCompare(id(left), id(right)))) {
        const mapId = id(mapRow);
        const questId = optionalId(mapRow, "quest_id");
        if (!questId) {
            unboundQuestLevelIds.push(mapId);
            continue;
        }
        const quest = quests.get(questId);
        if (!quest) throw new Error(`Stage ${mapId} references missing quest ${questId}`);
        const areaId = id(quest, "area_id");
        const area = areas.get(areaId);
        if (!area) throw new Error(`Quest ${questId} references missing area ${areaId}`);
        const chapterId = optionalId(area, "chapter_id");
        const chapter = chapterId ? chapters.get(chapterId) : undefined;
        if (chapterId && !chapter) throw new Error(`Area ${areaId} references missing chapter ${chapterId}`);
        const storyId = optionalId(area, "db_story_id");
        const story = storyId ? stories.get(storyId) : undefined;
        if (storyId && !story) throw new Error(`Area ${areaId} references missing DB story ${storyId}`);
        const difficultyRaw = integer(mapRow, "difficulty");
        const parsedEncounter = encounters.has(mapId) ? parseEncounter(encounters.get(mapId)!) : undefined;
        const enemies: StageDetailEnemy[] = [];
        for (const [battleIndex, battle] of (parsedEncounter?.battles ?? []).entries()) {
            battleCount += 1;
            for (const [roundIndex, round] of battle.rounds.entries()) {
                roundCount += 1;
                for (const [enemyIndex, enemy] of round.enemies.entries()) {
                    enemyCount += 1;
                    const card = cards.get(enemy.cardId);
                    if (!card) throw new Error(`Stage ${mapId} references missing enemy card ${enemy.cardId}`);
                    const superAttacks = superAttacksForCard(
                        enemy.cardId,
                        cardSpecials,
                        specialSets,
                        specialViews,
                        specialCategories,
                    );
                    enemySuperAttackCount += superAttacks.length;
                    const skills = enemy.enemySkillIds.map(skillId => {
                        referencedSkillIds.add(skillId);
                        const row = enemySkills.get(skillId);
                        if (!row) throw new Error(`Stage ${mapId} references missing enemy skill ${skillId}`);
                        return skill(row, "enemy-skill", relations);
                    });
                    const roundSetId = enemy.enemyRoundSkillSetId;
                    const roundSet = roundSetId ? roundSets.get(roundSetId) : undefined;
                    if (roundSetId && !roundSet) throw new Error(`Stage ${mapId} references missing round skill set ${roundSetId}`);
                    if (roundSetId) referencedRoundSetIds.add(roundSetId);
                    const roundSetSkills = (roundSetId ? roundRelations.get(roundSetId) ?? [] : []).map(relation => {
                        const roundSkillId = id(relation, "enemy_round_skill_id");
                        const row = roundSkills.get(roundSkillId);
                        if (!row) throw new Error(`Round skill set ${roundSetId} references missing round skill ${roundSkillId}`);
                        return skill(row, "enemy-round-skill", relations);
                    });
                    enemies.push({
                        id: `${mapId}:${battleIndex + 1}:${roundIndex + 1}:${enemyIndex + 1}`,
                        battle: battleIndex + 1,
                        tile: round.roundNo,
                        characterId: enemy.cardId,
                        cardId: enemy.cardId,
                        masterCharacterId: id(card, "character_id"),
                        name: text(card.name) || `Card ${enemy.cardId}`,
                        thumbnailId: optionalId(card, "resource_id"),
                        rarityRaw: integer(card, "rarity"),
                        elementRaw: integer(card, "element"),
                        stats: {
                            status: "unavailable-in-game-db",
                            source: "game-db",
                            unknowns: ["hp", "atk", "def", "attacks_per_turn", "runtime_scaling"],
                        },
                        superAttacks,
                        skills,
                        ...(roundSetId && roundSet ? {
                            roundSkillSet: {
                                id: roundSetId,
                                effectDescription: text(roundSet.effect_description) || undefined,
                                cancelDescription: text(roundSet.cancel_description) || undefined,
                                skills: roundSetSkills,
                            },
                        } : {}),
                    });
                }
            }
        }
        const categoryBonuses: StageDetailCategoryBonus[] = (bonusesByQuest.get(questId) ?? []).map(row => {
            const rarityId = id(row, "quest_category_bonus_rarity_table_id");
            const rarity = rarityTables.get(rarityId);
            if (!rarity) throw new Error(`Quest category bonus ${id(row)} references missing rarity table ${rarityId}`);
            const categoryId = id(row, "card_category_id");
            if (!cardCategories.has(categoryId)) throw new Error(`Quest category bonus ${id(row)} references missing category ${categoryId}`);
            const bonusGroup = bonusGroups.get(text(row.type));
            if (!bonusGroup) throw new Error(`Quest category bonus ${id(row)} references missing group ${text(row.type)}`);
            return {
                sourceRowId: id(row),
                typeRaw: text(row.type),
                cardCategoryId: categoryId,
                rarityTableId: rarityId,
                rarityValues: Object.fromEntries(["n", "r", "sr", "ssr", "ur", "lr"].map(key => [key, integer(rarity, `rarity_${key}`)])),
                semanticStatus: "partial",
                groupName: text(bonusGroup.name) || undefined,
                groupDescription: text(bonusGroup.description) || undefined,
            };
        });
        const dropPreviews = (dropViewsByQuest.get(questId) ?? []).flatMap(row => {
            const difficultyValues = jsonIds(jsonValue(row.difficulties, `drop view ${id(row)} difficulties`), `drop view ${id(row)} difficulties`).map(Number);
            if (!difficultyValues.includes(difficultyRaw)) return [];
            const items = Array.from({ length: 6 }, (_, index) => index + 1).flatMap(index => {
                const itemId = optionalId(row, `item${index}_id`);
                const itemType = text(row[`item${index}_type`]);
                if (!itemId && !itemType) return [];
                if (!itemId || !itemType) throw new Error(`Quest drop view ${id(row)} has an incomplete item ${index}`);
                return [{
                    itemId,
                    itemType,
                    ...rewardPresentation(itemType, itemId, cards, canonicalAwakenedCards, treasureItems, linkSkillLvUpItems, equipmentSkillItems, equipmentPresentations),
                }];
            });
            return [{ sourceRowId: id(row), difficultyValues, items }];
        });
        const rawPuzzleColorId = optionalId(mapRow, "sugoroku_map_puzzle_color_id");
        const puzzleColorId = rawPuzzleColorId === "0" ? undefined : rawPuzzleColorId;
        const puzzleColor = puzzleColorId ? puzzleColors.get(puzzleColorId) : undefined;
        if (puzzleColorId && !puzzleColor) throw new Error(`Stage ${mapId} references missing puzzle color ${puzzleColorId}`);
        entries.push({
            id: mapId,
            stageKind: "quest-level",
            difficultyRaw,
            difficulty: `Raw ${difficultyRaw}`,
            stamina: integer(mapRow, "act"),
            requiredKeys: integer(mapRow, "eventkagi_num"),
            rankExp: integer(mapRow, "user_exp"),
            zeni: integer(mapRow, "zeni"),
            linkSkillLevelUpRate: numberValue(mapRow, "link_skill_lv_up_prob_rate"),
            questId,
            questName: text(quest.name) || `Quest ${questId}`,
            areaId,
            areaName: text(area.name) || `Area ${areaId}`,
            areaType: text(area.type),
            areaCategoryRaw: integer(area, "category"),
            ...(chapter ? { chapter: { id: chapterId!, name: text(chapter.name) || `Chapter ${chapterId}`, opensAt: date(chapter, "open_at") } } : {}),
            ...(story ? { story: { id: storyId!, name: text(story.name) || `Story ${storyId}`, priority: integer(story, "priority"), banner: officialAsset(story.banner_image_path) } } : {}),
            startDate: date(quest, "start_at"),
            areaFirstReleasedAt: date(area, "first_released_at"),
            images: {
                header: officialAsset(area.event_image_path),
                banner: officialAsset(area.banner_image_path),
                button: officialAsset(area.listbutton_image_path),
            },
            enemies,
            bossDrops: (dropsByMap.get(mapId) ?? []).map(drop => ({
                sourceRowId: id(drop),
                itemType: text(drop.item_type),
                itemId: id(drop, "item_id"),
                dropTypeRaw: text(drop.drop_type),
                cardExpInitial: optionalInteger(drop, "card_exp_init"),
                quantityStatus: "unknown",
                chanceStatus: "unknown",
                ...rewardPresentation(
                    text(drop.item_type),
                    id(drop, "item_id"),
                    cards,
                    canonicalAwakenedCards,
                    treasureItems,
                    linkSkillLvUpItems,
                    equipmentSkillItems,
                    equipmentPresentations,
                ),
            })),
            dropPreviews,
            categoryBonuses,
            supportMemories: supportLinks.byStage.get(mapId) ?? [],
            rules: {
                boostable: booleanValue(quest, "boostable"),
                sugorokuAuto: booleanValue(quest, "enable_sugoroku_auto"),
                battleAuto: booleanValue(quest, "enable_battle_auto"),
                cpuOnly: booleanValue(mapRow, "is_cpu_only"),
                maxVisits: optionalInteger(quest, "visit_count_max"),
                resetIntervalDays: optionalInteger(quest, "interval_reset_visited_days"),
                canIgnoreDifficultyOrder: booleanValue(quest, "can_ignore_difficulty_order"),
                areaListButtonVisible: booleanValue(area, "is_listbutton_visible"),
                questEnemyInfoDisplayTypeRaw: integer(quest, "enemy_info_display_type"),
            },
            rewards: {
                questAnyClearStones: optionalInteger(quest, "any_clear_bonus_stones"),
                questAllClearStones: optionalInteger(quest, "all_clear_bonus_stones"),
                areaAllClearStones: optionalInteger(area, "all_clear_bonus_stones"),
            },
            mapPresentation: {
                sugorokuBgmId: optionalId(mapRow, "sugoroku_bgm_id"),
                battleBgmId: optionalId(mapRow, "battle_bgm_id"),
                bossBgmId: optionalId(mapRow, "boss_bgm_id"),
                battleBackgroundId: optionalId(mapRow, "battle_background_id"),
                startScriptId: optionalId(mapRow, "start_script_id"),
                finishScriptId: optionalId(mapRow, "finish_script_id"),
                diceId: optionalId(mapRow, "dice_id"),
                puzzleColorId,
                ...(puzzleColor ? { puzzleColorWeights: {
                    blue: integer(puzzleColor, "weight_blue"),
                    green: integer(puzzleColor, "weight_green"),
                    purple: integer(puzzleColor, "weight_purple"),
                    red: integer(puzzleColor, "weight_red"),
                    yellow: integer(puzzleColor, "weight_yellow"),
                    rainbow: integer(puzzleColor, "weight_rainbow"),
                } } : {}),
            },
        });
    }

    const viewsByStage = new Map<string, GameDbRow>();
    for (const row of options.tables.z_battle_stage_views) {
        const stageId = id(row, "z_battle_stage_id");
        if (viewsByStage.has(stageId)) throw new Error(`Duplicate Z-Battle stage view ${stageId}`);
        viewsByStage.set(stageId, row);
    }
    const zRangesByStage = groupBy(options.tables.z_battle_enemies, "z_battle_stage_id");
    const zThresholdByStage = new Map<string, GameDbRow>();
    for (const row of options.tables.z_battle_powerup_thresholds) {
        const stageId = id(row, "z_battle_stage_id");
        if (zThresholdByStage.has(stageId)) throw new Error(`Duplicate Z-Battle threshold ${stageId}`);
        zThresholdByStage.set(stageId, row);
    }
    const statusByType = groupBy(options.tables.z_battle_enemy_status_escalations, "escalation_type");
    const cardsByType = groupBy(options.tables.z_battle_enemy_card_escalations, "escalation_type");
    const skillsByType = groupBy(options.tables.z_battle_enemy_skill_escalations, "escalation_type");
    const checkpointsByStage = groupBy(options.tables.z_battle_check_points, "z_battle_stage_id");
    const firstRewardLevelsByStage = groupBy(options.tables.z_battle_first_reward_level_ranges, "z_battle_stage_id");
    const firstRewardsBySet = groupBy(options.tables.z_battle_first_rewards, "z_battle_first_reward_set_id");
    const normalTablesByGroup = groupBy(options.tables.z_battle_normal_reward_tables, "z_battle_normal_reward_table_group_id");
    const normalRewardsByTable = groupBy(options.tables.z_battle_normal_rewards, "z_battle_normal_reward_table_id");
    const rewardItem = (row: GameDbRow) => ({
        itemId: id(row, "item_id"),
        itemType: text(row.item_type),
        quantity: integer(row, "quantity"),
        cardExpInitial: optionalInteger(row, "card_exp_init"),
        ...rewardPresentation(
            text(row.item_type),
            id(row, "item_id"),
            cards,
            canonicalAwakenedCards,
            treasureItems,
            linkSkillLvUpItems,
            equipmentSkillItems,
            equipmentPresentations,
        ),
    });
    const zBattles: StageDetailZBattle[] = [...zStages.values()].sort((left, right) => numericCompare(id(left), id(right))).map(stage => {
        const stageId = id(stage);
        const relatedZBattleStageId = optionalId(stage, "related_z_battle_stage_id");
        const relatedStage = relatedZBattleStageId ? zStages.get(relatedZBattleStageId) : undefined;
        if (relatedZBattleStageId && !relatedStage) {
            throw new Error(`Z-Battle stage ${stageId} references missing related stage ${relatedZBattleStageId}`);
        }
        const view = viewsByStage.get(stageId);
        const ranges = (zRangesByStage.get(stageId) ?? []).sort((left, right) => integer(left, "ordinal_num") - integer(right, "ordinal_num"));
        const referencedStatusTypes = new Set<string>();
        const referencedCardTypes = new Set<string>();
        const referencedSkillTypes = new Set<string>();
        for (const range of ranges) {
            for (const column of ["hp_escalation_type", "attack_escalation_type", "defence_escalation_type", "special_attack_escalation_type", "performance_escalation_type"]) referencedStatusTypes.add(id(range, column));
            referencedCardTypes.add(id(range, "card_escalation_type"));
            referencedSkillTypes.add(id(range, "skill_escalation_type"));
        }
        const threshold = zThresholdByStage.get(stageId);
        const checkpoints = (checkpointsByStage.get(stageId) ?? []).map(checkpoint => {
            const rewardGroupId = id(checkpoint, "z_battle_normal_reward_table_group_id");
            const rewardTables = normalTablesByGroup.get(rewardGroupId);
            if (!rewardTables?.length) throw new Error(`Z-Battle checkpoint ${id(checkpoint)} references missing normal reward group ${rewardGroupId}`);
            const repeatRewards = rewardTables.flatMap(rewardTable => {
                const rewardTableId = id(rewardTable);
                const rewards = normalRewardsByTable.get(rewardTableId);
                if (!rewards?.length) throw new Error(`Z-Battle normal reward table ${rewardTableId} has no rewards`);
                return rewards.map(rewardItem);
            });
            return {
                id: id(checkpoint),
                level: integer(checkpoint, "level"),
                stamina: integer(checkpoint, "act"),
                requiredKeys: integer(checkpoint, "eventkagi_num"),
                normalRewardTableGroupId: rewardGroupId,
                mainRewardId: optionalId(checkpoint, "main_reward_id"),
                repeatRewards,
            };
        }).sort((left, right) => left.level - right.level);
        const firstRewards = (firstRewardLevelsByStage.get(stageId) ?? []).map(range => {
            const rewardSetId = id(range, "z_battle_first_reward_set_id");
            const rewards = firstRewardsBySet.get(rewardSetId);
            if (!rewards?.length) throw new Error(`Z-Battle first reward level ${id(range)} references missing set ${rewardSetId}`);
            return {
                id: id(range),
                level: integer(range, "level"),
                rewardSetId,
                mainRewardId: optionalId(range, "main_reward_id"),
                rewards: rewards.map(rewardItem),
            };
        }).sort((left, right) => left.level - right.level);
        return {
            id: stageId,
            typeRaw: text(stage.type),
            title: text(view?.enemy_name) || undefined,
            subtitle: text(view?.enemy_nickname) || undefined,
            startDate: date(stage, "start_at"),
            endDate: date(stage, "end_at"),
            enableBattleAuto: booleanValue(stage, "enable_battle_auto"),
            effectEscalationTypeId: id(stage, "z_battle_stage_effect_escalation_type"),
            priority: integer(stage, "priority"),
            banner: officialAsset(stage.banner_image_path) ?? officialAsset(relatedStage?.banner_image_path),
            listButton: officialAsset(stage.listbutton_image_path) ?? officialAsset(relatedStage?.listbutton_image_path),
            enemyResourceId: view ? optionalId(view, "enemy_resource_id") : undefined,
            eventKeyStartsAt: date(stage, "eventkagi_start_at"),
            eventKeyEndsAt: date(stage, "eventkagi_end_at"),
            relatedZBattleStageId,
            ...(text(stage.unlock_conditions) ? { unlockConditions: jsonValue(stage.unlock_conditions, `Z-Battle ${stageId} unlock_conditions`) } : {}),
            enemyRanges: ranges.map(range => ({
                id: id(range),
                ordinal: integer(range, "ordinal_num"),
                startLevel: integer(range, "start_level"),
                endLevel: optionalInteger(range, "end_level"),
                stats: {
                    status: "raw-z-battle-base",
                    source: "game-db-z-battle",
                    hp: integer(range, "base_hp"),
                    atk: integer(range, "base_attack"),
                    def: integer(range, "base_defence"),
                    unknowns: ["application_formula", "curve_precedence", "runtime_modifiers"],
                },
                escalationTypeIds: {
                    hp: id(range, "hp_escalation_type"),
                    atk: id(range, "attack_escalation_type"),
                    def: id(range, "defence_escalation_type"),
                    specialAttack: id(range, "special_attack_escalation_type"),
                    card: id(range, "card_escalation_type"),
                    performance: id(range, "performance_escalation_type"),
                    skill: id(range, "skill_escalation_type"),
                },
            })),
            statusCurves: [...referencedStatusTypes].sort(numericCompare).map(typeId => ({
                escalationTypeId: typeId,
                points: (statusByType.get(typeId) ?? []).map(point => ({ level: integer(point, "level"), value: integer(point, "escalation_value") })).sort((left, right) => left.level - right.level),
            })),
            cardEscalations: [...referencedCardTypes].flatMap(typeId => (cardsByType.get(typeId) ?? []).map(row => ({
                escalationTypeId: typeId,
                level: integer(row, "level"),
                cardId: id(row, "card_id"),
                cardName: text(requireRow(cards, id(row, "card_id"), `Z-Battle card escalation ${id(row)}`).name) || undefined,
            }))).sort((left, right) => numericCompare(left.escalationTypeId, right.escalationTypeId) || left.level - right.level),
            skillEscalations: [...referencedSkillTypes].flatMap(typeId => (skillsByType.get(typeId) ?? []).map(row => {
                const enemySkillId = id(row, "enemy_skill_id");
                const enemySkill = requireRow(enemySkills, enemySkillId, `Z-Battle skill escalation ${id(row)}`);
                return {
                    escalationTypeId: typeId,
                    level: integer(row, "level"),
                    enemySkillId,
                    name: text(enemySkill.name) || undefined,
                    description: text(enemySkill.description) || undefined,
                    effectTypeRaw: text(enemySkill.efficacy_type) ? integer(enemySkill, "efficacy_type") : undefined,
                    effectValues: ["eff_value1", "eff_value2", "eff_value3"].map(column => text(enemySkill[column]) ? integer(enemySkill, column) : null),
                };
            })).sort((left, right) => numericCompare(left.escalationTypeId, right.escalationTypeId) || left.level - right.level),
            ...(threshold ? { powerupThreshold: { hp: integer(threshold, "hp"), atk: integer(threshold, "atk"), def: integer(threshold, "def"), specialAtk: integer(threshold, "special_atk") } } : {}),
            checkpoints,
            firstRewards,
        };
    });

    const stageIds = new Set(entries.map(entry => entry.id));
    const missionRewardsByMission = groupBy(options.tables.mission_rewards, "mission_id");
    const resolveMissionStages = createMissionStageResolver(options.tables.missions);
    const eventMissions: StageDetailEventMission[] = options.tables.missions
        .filter(mission => {
            const areaId = optionalId(mission, "area_id");
            return areaId !== undefined && areas.has(areaId);
        })
        .map(mission => {
            const missionId = id(mission);
            const areaId = id(mission, "area_id");
            const resolution = resolveMissionStages(missionId);
            const description = missionDescription(mission.description);
            const rewards = (missionRewardsByMission.get(missionId) ?? []).map(reward => {
                const itemType = text(reward.item_type);
                const itemId = id(reward, "item_id");
                const cardExpInitial = optionalInteger(reward, "card_exp_init");
                return {
                    itemId,
                    itemType,
                    quantity: integer(reward, "quantity"),
                    ...(cardExpInitial !== undefined ? { cardExpInitial } : {}),
                    ...rewardPresentation(itemType, itemId, cards, canonicalAwakenedCards, treasureItems, linkSkillLvUpItems, equipmentSkillItems, equipmentPresentations),
                };
            });
            return {
                id: missionId,
                areaId,
                categoryId: id(mission, "mission_category_id"),
                type: text(mission.type),
                name: text(mission.name),
                ...(description ? { description } : {}),
                priority: integer(mission, "priority"),
                ordererId: integer(mission, "orderer_id"),
                ...(date(mission, "start_at") ? { startsAt: date(mission, "start_at") } : {}),
                ...(date(mission, "end_at") ? { endsAt: date(mission, "end_at") } : {}),
                stageIds: [...resolution.stageIds.keys()].filter(stageId => stageIds.has(stageId)).sort(numericCompare),
                rewards,
            };
        })
        .sort((left, right) => numericCompare(left.areaId, right.areaId)
            || right.priority - left.priority
            || left.ordererId - right.ordererId
            || numericCompare(left.id, right.id));

    const dataset: StageDetailsDataset = {
        schemaVersion: 2,
        generatedAt: options.generatedAt,
        source: "dokkan-game-db",
        sourceSnapshotVersion: options.sourceSnapshotVersion,
        sourceDatabaseSha256: options.sourceDatabaseSha256,
        count: entries.length,
        entries,
        zBattles,
        supportMemoryRelations: supportLinks.relations,
        eventMissions,
    };
    const unresolvedMemoryIds = [...supportLinks.allMemoryIds].filter(memoryId => !supportLinks.linkedMemoryIds.has(memoryId)).sort(numericCompare);
    return {
        dataset,
        audit: {
            schemaVersion: 1,
            contract: STAGE_FIRST_PARTY_CONTRACT,
            contractVersion: STAGE_FIRST_PARTY_CONTRACT_VERSION,
            generatedAt: options.generatedAt,
            sourceSnapshotVersion: options.sourceSnapshotVersion,
            sourceDatabaseSha256: options.sourceDatabaseSha256,
            counts: {
                areas: areas.size,
                quests: quests.size,
                questLevels: entries.length,
                unboundQuestLevels: unboundQuestLevelIds.length,
                encounterLevels: encounters.size,
                battles: battleCount,
                rounds: roundCount,
                enemyPositions: enemyCount,
                enemySuperAttacks: enemySuperAttackCount,
                referencedEnemySkills: referencedSkillIds.size,
                referencedRoundSkillSets: referencedRoundSetIds.size,
                questDropViews: options.tables.quest_drop_item_views.length,
                bossDropRows: options.tables.sugoroku_map_boss_drop_items.length,
                zBattles: zBattles.length,
                zBattleEnemyRanges: zBattles.reduce((sum, stage) => sum + stage.enemyRanges.length, 0),
                zBattleCheckpoints: zBattles.reduce((sum, stage) => sum + (stage.checkpoints?.length ?? 0), 0),
                zBattleFirstRewardLevels: zBattles.reduce((sum, stage) => sum + (stage.firstRewards?.length ?? 0), 0),
                supportMemoryRelations: supportLinks.relations.length,
                eventMissions: eventMissions.length,
                supportMemoryQuestLevelLinks: supportLinks.relations.filter(relation => relation.targetKind === "quest-level").length,
                supportMemoryAreaLinks: supportLinks.relations.filter(relation => relation.targetKind === "area").length,
                supportMemoryZBattleLinks: supportLinks.relations.filter(relation => relation.targetKind === "z-battle").length,
                supportMemoryLinkedIds: supportLinks.linkedMemoryIds.size,
                supportMemoryIdsWithoutStageLink: unresolvedMemoryIds.length,
            },
            authority: {
                topology: "first-party",
                enemies: "first-party",
                superAttacks: "first-party",
                skillsAndGimmickPresentation: "first-party-structured-raw",
                linkLevelRate: "first-party",
                rewardsAndCosts: "first-party-structured-raw",
                presentationAndNavigation: "first-party",
                traditionalEnemyStats: "unavailable-in-game-db",
                zBattleStats: "first-party-raw-base-and-curves-formula-unproved",
                supportMemoryStageRelations: "first-party-mission-json-ids",
                eventMissions: "first-party-missions-and-rewards",
            },
            unresolved: {
                unboundQuestLevelIds: unboundQuestLevelIds.sort(numericCompare),
                supportMemoryIdsWithoutStageLink: unresolvedMemoryIds,
            },
        },
    };
}
