"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildStageFirstPartyCandidate = exports.STAGE_FIRST_PARTY_CONTRACT_VERSION = exports.STAGE_FIRST_PARTY_CONTRACT = void 0;
const character_1 = require("../character");
const game_db_mission_stage_relations_1 = require("./game-db-mission-stage-relations");
const game_db_source_1 = require("./game-db-source");
exports.STAGE_FIRST_PARTY_CONTRACT = "dokkan-stage-first-party-candidate";
exports.STAGE_FIRST_PARTY_CONTRACT_VERSION = "1.0.0";
function numericCompare(left, right) {
    return Number(left) - Number(right) || left.localeCompare(right);
}
function text(value) {
    return value?.trim() ?? "";
}
function id(row, column = "id") {
    const value = (0, game_db_source_1.normalizeDbId)(row[column]);
    if (!value || !/^-?\d+$/.test(value))
        throw new Error(`Stage row is missing numeric ${column}`);
    return value;
}
function optionalId(row, column) {
    const raw = text(row[column]);
    if (!raw)
        return undefined;
    const value = (0, game_db_source_1.normalizeDbId)(raw);
    if (!value || !/^-?\d+$/.test(value))
        throw new Error(`Stage row has invalid ${column}`);
    return value;
}
function numberValue(row, column) {
    const raw = text(row[column]);
    if (!raw)
        throw new Error(`Stage row ${id(row)} is missing ${column}`);
    const value = Number(raw);
    if (!Number.isFinite(value))
        throw new Error(`Stage row ${id(row)} has invalid ${column}`);
    return value;
}
function integer(row, column) {
    const value = numberValue(row, column);
    if (!Number.isSafeInteger(value))
        throw new Error(`Stage row ${id(row)} has non-integer ${column}`);
    return value;
}
function optionalInteger(row, column) {
    if (!text(row[column]))
        return undefined;
    return integer(row, column);
}
function cardRewardPresentation(itemType, itemId, cards, canonicalAwakenedCards) {
    if (itemType !== "Card")
        return {};
    const card = cards.get(itemId);
    if (!card)
        return {};
    return {
        ...(text(card.name) ? { name: text(card.name) } : {}),
        ...(optionalId(card, "resource_id") ? { thumbnailId: optionalId(card, "resource_id") } : {}),
        ...(optionalInteger(card, "rarity") !== undefined ? { rarityRaw: optionalInteger(card, "rarity") } : {}),
        ...(optionalInteger(card, "element") !== undefined ? { elementRaw: optionalInteger(card, "element") } : {}),
        ...(canonicalAwakenedCards.get(itemId) ? { detailCharacterId: canonicalAwakenedCards.get(itemId) } : {}),
    };
}
function rewardPresentation(itemType, itemId, cards, canonicalAwakenedCards, treasureItems, equipmentSkillItems) {
    if (itemType === "Card") {
        return cardRewardPresentation(itemType, itemId, cards, canonicalAwakenedCards);
    }
    if (itemType === "TreasureItem") {
        const item = treasureItems.get(itemId);
        if (!item)
            throw new Error(`Stage reward references missing treasure item ${itemId}`);
        return {
            ...(text(item.name) ? { name: text(item.name) } : {}),
            ...(optionalId(item, "image_suffix_number") ? { thumbnailId: optionalId(item, "image_suffix_number") } : {}),
        };
    }
    if (itemType === "EquipmentSkillItem") {
        const item = equipmentSkillItems.get(itemId);
        if (!item)
            throw new Error(`Stage reward references missing equipment skill item ${itemId}`);
        const grade = text(item.grade).toLowerCase();
        if (!["bronze", "silver", "gold"].includes(grade)) {
            throw new Error(`Equipment skill item ${itemId} has unsupported grade ${grade}`);
        }
        const iconId = id(item, "icon_image_id").padStart(5, "0");
        return {
            ...(text(item.name) ? { name: text(item.name) } : {}),
            iconAssetPath: `item/equipment/equ_item_${iconId}.png`,
            backgroundAssetPath: `layout/en/image/item/equipment/equipment_thumb_bg/equ_base_${grade}.png`,
        };
    }
    return {};
}
function missionDescription(value) {
    const normalized = text(value)
        .replace(/\{cards:[^{}]+\}/g, " ")
        .replace(/[ \t]+(?=\r?\n)/g, "")
        .replace(/[ \t]{2,}/g, " ")
        .trim();
    return normalized || undefined;
}
function canonicalAwakenedCardIds(routes, cards) {
    const direct = new Map();
    for (const [cardId, rows] of groupBy(routes, "card_id")) {
        const targets = [...new Set(rows.map(row => id(row, "awaked_card_id")).filter(target => target !== cardId))];
        if (targets.length === 1 && cards.has(targets[0]))
            direct.set(cardId, targets[0]);
    }
    const result = new Map();
    for (const cardId of cards.keys()) {
        const visited = new Set([cardId]);
        let current = cardId;
        while (direct.has(current)) {
            const next = direct.get(current);
            if (visited.has(next))
                break;
            visited.add(next);
            current = next;
        }
        if (current !== cardId)
            result.set(cardId, current);
    }
    return result;
}
function booleanValue(row, column) {
    const value = integer(row, column);
    if (value !== 0 && value !== 1)
        throw new Error(`Stage row ${id(row)} has invalid boolean ${column}`);
    return value === 1;
}
function superAttacksForCard(cardId, cardSpecials, specialSets, specialViews, specialCategories) {
    return [...(cardSpecials.get(cardId) ?? [])]
        .sort((left, right) => integer(left, "priority") - integer(right, "priority") || numericCompare(id(left), id(right)))
        .map(relation => {
        const specialSetId = id(relation, "special_set_id");
        const specialSet = specialSets.get(specialSetId);
        if (!specialSet)
            throw new Error(`Card ${cardId} references missing special set ${specialSetId}`);
        const name = text(specialSet.name);
        if (!name)
            throw new Error(`Special set ${specialSetId} is missing its official name`);
        const ki = optionalInteger(relation, "eball_num_start");
        const viewId = optionalId(relation, "view_id");
        const view = viewId ? specialViews.get(viewId) : undefined;
        const categoryId = view ? optionalId(view, "special_category_id") : undefined;
        const category = categoryId ? specialCategories.get(categoryId) : undefined;
        const rawAttribute = category ? optionalInteger(category, "raw_attribute") : undefined;
        const attackType = !view
            ? undefined
            : !categoryId
                ? character_1.AttackTypes.Other
                : rawAttribute === 1
                    ? character_1.AttackTypes.KiBlast
                    : rawAttribute === 2
                        ? character_1.AttackTypes.Unarmed
                        : rawAttribute === 4
                            ? character_1.AttackTypes.Armed
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
function date(row, column) {
    const raw = text(row[column]);
    const parsed = (0, game_db_source_1.parseDbDate)(raw);
    if (raw && !parsed)
        throw new Error(`Stage row ${id(row)} has invalid ${column}`);
    return parsed;
}
function jsonValue(raw, label) {
    if (!text(raw))
        return {};
    try {
        return JSON.parse(raw);
    }
    catch {
        throw new Error(`Stage ${label} contains invalid JSON`);
    }
}
function jsonObject(raw, label) {
    const value = jsonValue(raw, label);
    if (!value || typeof value !== "object" || Array.isArray(value))
        throw new Error(`Stage ${label} must be a JSON object`);
    return value;
}
function jsonIds(value, label) {
    if (value === undefined || value === null)
        return [];
    if (!Array.isArray(value))
        throw new Error(`Stage ${label} must be an array`);
    return value.map(item => {
        const normalized = (0, game_db_source_1.normalizeDbId)(item === null || item === undefined ? undefined : String(item));
        if (!normalized || !/^\d+$/.test(normalized))
            throw new Error(`Stage ${label} contains an invalid ID`);
        return normalized;
    });
}
function uniqueById(rows, label, column = "id") {
    const result = new Map();
    for (const row of rows) {
        const rowId = id(row, column);
        if (result.has(rowId))
            throw new Error(`Duplicate ${label} ${rowId}`);
        result.set(rowId, row);
    }
    return result;
}
function requireRow(rows, rowId, context) {
    const row = rows.get(rowId);
    if (!row)
        throw new Error(`${context} references missing row ${rowId}`);
    return row;
}
function groupBy(rows, column) {
    const result = new Map();
    for (const row of rows) {
        const key = id(row, column);
        result.set(key, [...(result.get(key) ?? []), row]);
    }
    return result;
}
function officialAsset(sourcePath) {
    const normalized = text(sourcePath).replace(/\\/g, "/").replace(/^\/+/, "");
    if (!normalized)
        return undefined;
    if (normalized.split("/").some(segment => !segment || segment === "." || segment === "..")) {
        throw new Error(`Unsafe official Stage asset path: ${sourcePath}`);
    }
    return { sourcePath: normalized };
}
function parseEncounter(row) {
    const sourceId = id(row, "sugoroku_map_id");
    const raw = jsonObject(row.enemy_info, `encounter ${sourceId}`);
    if (raw.battles !== null && !Array.isArray(raw.battles) || typeof raw.display_type !== "string")
        throw new Error(`Stage encounter ${sourceId} has an invalid shape`);
    return {
        displayType: raw.display_type,
        battles: (raw.battles ?? []).map((battle, battleIndex) => {
            if (!battle || typeof battle !== "object" || !Array.isArray(battle.rounds)) {
                throw new Error(`Stage encounter ${sourceId} battle ${battleIndex} has an invalid shape`);
            }
            return {
                rounds: battle.rounds.map((round, roundIndex) => {
                    if (!round || typeof round !== "object")
                        throw new Error(`Stage encounter ${sourceId} round ${roundIndex} has an invalid shape`);
                    const value = round;
                    if (!Number.isSafeInteger(value.round_no) || !Array.isArray(value.enemies))
                        throw new Error(`Stage encounter ${sourceId} round ${roundIndex} has invalid fields`);
                    return {
                        roundNo: value.round_no,
                        ...(typeof value.comment === "string" && value.comment.trim() ? { comment: value.comment.trim() } : {}),
                        enemies: value.enemies.map((enemy, enemyIndex) => {
                            if (!enemy || typeof enemy !== "object")
                                throw new Error(`Stage encounter ${sourceId} enemy ${enemyIndex} has an invalid shape`);
                            const fields = enemy;
                            const cardId = (0, game_db_source_1.normalizeDbId)(String(fields.card_id ?? ""));
                            if (!cardId || !/^\d+$/.test(cardId))
                                throw new Error(`Stage encounter ${sourceId} enemy ${enemyIndex} has invalid card_id`);
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
function skill(row, source, relations) {
    const skillId = id(row);
    const optional = (column) => text(row[column]) ? integer(row, column) : undefined;
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
function supportMemoryStageLinks(tables, stageIds, areaIds, zBattleIds) {
    const resolveMissionStages = (0, game_db_mission_stage_relations_1.createMissionStageResolver)(tables.missions);
    const links = new Map();
    const relations = new Map();
    const linkedMemoryIds = new Set();
    const allMemoryIds = new Set();
    const addRelation = (memoryId, missionId, targetKind, targetId, relation) => {
        const key = `${memoryId}:${targetKind}:${targetId}`;
        const existing = relations.get(key) ?? { memoryId, targetKind, targetId, missionIds: new Set(), relation };
        existing.missionIds.add(missionId);
        if (existing.relation === "transitive-mission-condition" && relation !== "transitive-mission-condition")
            existing.relation = relation;
        relations.set(key, existing);
        linkedMemoryIds.add(memoryId);
    };
    for (const reward of tables.mission_rewards) {
        if (text(reward.item_type) !== "SupportMemory")
            continue;
        const memoryId = id(reward, "item_id");
        const missionId = id(reward, "mission_id");
        allMemoryIds.add(memoryId);
        const resolution = resolveMissionStages(missionId);
        for (const [resolvedAreaId, relation] of resolution.areaIds) {
            if (!areaIds.has(resolvedAreaId))
                throw new Error(`Support Memory ${memoryId} references missing Stage area ${resolvedAreaId}`);
            addRelation(memoryId, missionId, "area", resolvedAreaId, relation);
        }
        for (const [resolvedZBattleId, relation] of resolution.zBattleIds) {
            if (!zBattleIds.has(resolvedZBattleId))
                throw new Error(`Support Memory ${memoryId} references missing Z-Battle ${resolvedZBattleId}`);
            addRelation(memoryId, missionId, "z-battle", resolvedZBattleId, relation);
        }
        for (const [stageId, relation] of resolution.stageIds) {
            if (!stageIds.has(stageId))
                throw new Error(`Support Memory ${memoryId} references missing Stage ${stageId}`);
            addRelation(memoryId, missionId, "quest-level", stageId, relation);
            const stageLinks = links.get(stageId) ?? new Map();
            const existing = stageLinks.get(memoryId) ?? { missionIds: new Set(), relation };
            existing.missionIds.add(missionId);
            if (relation === "direct-stage-condition")
                existing.relation = relation;
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
function buildStageFirstPartyCandidate(options) {
    if (!/^\d+$/.test(options.sourceSnapshotVersion))
        throw new Error("Stage source snapshot version must be numeric");
    if (!/^[a-f0-9]{64}$/.test(options.sourceDatabaseSha256))
        throw new Error("Stage source database SHA-256 is invalid");
    if (Number.isNaN(Date.parse(options.generatedAt)))
        throw new Error("Stage generatedAt is invalid");
    const areas = uniqueById(options.tables.areas, "area");
    const chapters = uniqueById(options.tables.chapters, "chapter");
    const stories = uniqueById(options.tables.db_stories, "DB story");
    const cards = uniqueById(options.tables.cards, "card");
    const treasureItems = uniqueById(options.tables.treasure_items, "treasure item");
    const equipmentSkillItems = uniqueById(options.tables.equipment_skill_items, "equipment skill item");
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
    const bonusGroups = new Map();
    for (const row of options.tables.quest_category_bonus_groups) {
        const type = text(row.quest_category_bonus_type);
        if (!type || bonusGroups.has(type))
            throw new Error(`Invalid or duplicate quest category bonus group ${type}`);
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
    const cardCategories = uniqueById(options.tables.card_categories, "card category");
    const linkSkills = uniqueById(options.tables.link_skills, "link skill");
    const passiveSkillSets = uniqueById(options.tables.passive_skill_sets, "passive skill set");
    for (const rows of relations.cardCategories.values())
        for (const row of rows)
            if (!cardCategories.has(id(row, "card_category_id")))
                throw new Error(`Enemy skill relation ${id(row)} references missing card category`);
    for (const rows of relations.optimalAwakenings.values())
        for (const row of rows)
            if (!cardCategories.has(id(row, "card_category_id")))
                throw new Error(`Enemy skill relation ${id(row)} references missing optimal awakening category`);
    for (const rows of relations.linkSkills.values())
        for (const row of rows)
            if (!linkSkills.has(id(row, "link_skill_id")))
                throw new Error(`Enemy skill relation ${id(row)} references missing link skill`);
    for (const rows of relations.passiveSkillSets.values())
        for (const row of rows)
            if (!passiveSkillSets.has(id(row, "passive_skill_set_id")))
                throw new Error(`Enemy skill relation ${id(row)} references missing passive skill set`);
    const zStages = uniqueById(options.tables.z_battle_stages, "Z-Battle stage");
    const supportLinks = supportMemoryStageLinks(options.tables, new Set(maps.keys()), new Set(areas.keys()), new Set(zStages.keys()));
    const referencedSkillIds = new Set();
    const referencedRoundSetIds = new Set();
    let battleCount = 0, roundCount = 0, enemyCount = 0, enemySuperAttackCount = 0;
    const entries = [];
    const unboundQuestLevelIds = [];
    for (const mapRow of [...maps.values()].sort((left, right) => numericCompare(id(left), id(right)))) {
        const mapId = id(mapRow);
        const questId = optionalId(mapRow, "quest_id");
        if (!questId) {
            unboundQuestLevelIds.push(mapId);
            continue;
        }
        const quest = quests.get(questId);
        if (!quest)
            throw new Error(`Stage ${mapId} references missing quest ${questId}`);
        const areaId = id(quest, "area_id");
        const area = areas.get(areaId);
        if (!area)
            throw new Error(`Quest ${questId} references missing area ${areaId}`);
        const chapterId = optionalId(area, "chapter_id");
        const chapter = chapterId ? chapters.get(chapterId) : undefined;
        if (chapterId && !chapter)
            throw new Error(`Area ${areaId} references missing chapter ${chapterId}`);
        const storyId = optionalId(area, "db_story_id");
        const story = storyId ? stories.get(storyId) : undefined;
        if (storyId && !story)
            throw new Error(`Area ${areaId} references missing DB story ${storyId}`);
        const difficultyRaw = integer(mapRow, "difficulty");
        const parsedEncounter = encounters.has(mapId) ? parseEncounter(encounters.get(mapId)) : undefined;
        const enemies = [];
        for (const [battleIndex, battle] of (parsedEncounter?.battles ?? []).entries()) {
            battleCount += 1;
            for (const [roundIndex, round] of battle.rounds.entries()) {
                roundCount += 1;
                for (const [enemyIndex, enemy] of round.enemies.entries()) {
                    enemyCount += 1;
                    const card = cards.get(enemy.cardId);
                    if (!card)
                        throw new Error(`Stage ${mapId} references missing enemy card ${enemy.cardId}`);
                    const superAttacks = superAttacksForCard(enemy.cardId, cardSpecials, specialSets, specialViews, specialCategories);
                    enemySuperAttackCount += superAttacks.length;
                    const skills = enemy.enemySkillIds.map(skillId => {
                        referencedSkillIds.add(skillId);
                        const row = enemySkills.get(skillId);
                        if (!row)
                            throw new Error(`Stage ${mapId} references missing enemy skill ${skillId}`);
                        return skill(row, "enemy-skill", relations);
                    });
                    const roundSetId = enemy.enemyRoundSkillSetId;
                    const roundSet = roundSetId ? roundSets.get(roundSetId) : undefined;
                    if (roundSetId && !roundSet)
                        throw new Error(`Stage ${mapId} references missing round skill set ${roundSetId}`);
                    if (roundSetId)
                        referencedRoundSetIds.add(roundSetId);
                    const roundSetSkills = (roundSetId ? roundRelations.get(roundSetId) ?? [] : []).map(relation => {
                        const roundSkillId = id(relation, "enemy_round_skill_id");
                        const row = roundSkills.get(roundSkillId);
                        if (!row)
                            throw new Error(`Round skill set ${roundSetId} references missing round skill ${roundSkillId}`);
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
        const categoryBonuses = (bonusesByQuest.get(questId) ?? []).map(row => {
            const rarityId = id(row, "quest_category_bonus_rarity_table_id");
            const rarity = rarityTables.get(rarityId);
            if (!rarity)
                throw new Error(`Quest category bonus ${id(row)} references missing rarity table ${rarityId}`);
            const categoryId = id(row, "card_category_id");
            if (!cardCategories.has(categoryId))
                throw new Error(`Quest category bonus ${id(row)} references missing category ${categoryId}`);
            const bonusGroup = bonusGroups.get(text(row.type));
            if (!bonusGroup)
                throw new Error(`Quest category bonus ${id(row)} references missing group ${text(row.type)}`);
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
            if (!difficultyValues.includes(difficultyRaw))
                return [];
            const items = Array.from({ length: 6 }, (_, index) => index + 1).flatMap(index => {
                const itemId = optionalId(row, `item${index}_id`);
                const itemType = text(row[`item${index}_type`]);
                if (!itemId && !itemType)
                    return [];
                if (!itemId || !itemType)
                    throw new Error(`Quest drop view ${id(row)} has an incomplete item ${index}`);
                return [{
                        itemId,
                        itemType,
                        ...rewardPresentation(itemType, itemId, cards, canonicalAwakenedCards, treasureItems, equipmentSkillItems),
                    }];
            });
            return [{ sourceRowId: id(row), difficultyValues, items }];
        });
        const rawPuzzleColorId = optionalId(mapRow, "sugoroku_map_puzzle_color_id");
        const puzzleColorId = rawPuzzleColorId === "0" ? undefined : rawPuzzleColorId;
        const puzzleColor = puzzleColorId ? puzzleColors.get(puzzleColorId) : undefined;
        if (puzzleColorId && !puzzleColor)
            throw new Error(`Stage ${mapId} references missing puzzle color ${puzzleColorId}`);
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
            ...(chapter ? { chapter: { id: chapterId, name: text(chapter.name) || `Chapter ${chapterId}`, opensAt: date(chapter, "open_at") } } : {}),
            ...(story ? { story: { id: storyId, name: text(story.name) || `Story ${storyId}`, priority: integer(story, "priority"), banner: officialAsset(story.banner_image_path) } } : {}),
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
                ...rewardPresentation(text(drop.item_type), id(drop, "item_id"), cards, canonicalAwakenedCards, treasureItems, equipmentSkillItems),
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
    const viewsByStage = new Map();
    for (const row of options.tables.z_battle_stage_views) {
        const stageId = id(row, "z_battle_stage_id");
        if (viewsByStage.has(stageId))
            throw new Error(`Duplicate Z-Battle stage view ${stageId}`);
        viewsByStage.set(stageId, row);
    }
    const zRangesByStage = groupBy(options.tables.z_battle_enemies, "z_battle_stage_id");
    const zThresholdByStage = new Map();
    for (const row of options.tables.z_battle_powerup_thresholds) {
        const stageId = id(row, "z_battle_stage_id");
        if (zThresholdByStage.has(stageId))
            throw new Error(`Duplicate Z-Battle threshold ${stageId}`);
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
    const rewardItem = (row) => ({
        itemId: id(row, "item_id"),
        itemType: text(row.item_type),
        quantity: integer(row, "quantity"),
        cardExpInitial: optionalInteger(row, "card_exp_init"),
        ...rewardPresentation(text(row.item_type), id(row, "item_id"), cards, canonicalAwakenedCards, treasureItems, equipmentSkillItems),
    });
    const zBattles = [...zStages.values()].sort((left, right) => numericCompare(id(left), id(right))).map(stage => {
        const stageId = id(stage);
        const relatedZBattleStageId = optionalId(stage, "related_z_battle_stage_id");
        const relatedStage = relatedZBattleStageId ? zStages.get(relatedZBattleStageId) : undefined;
        if (relatedZBattleStageId && !relatedStage) {
            throw new Error(`Z-Battle stage ${stageId} references missing related stage ${relatedZBattleStageId}`);
        }
        const view = viewsByStage.get(stageId);
        const ranges = (zRangesByStage.get(stageId) ?? []).sort((left, right) => integer(left, "ordinal_num") - integer(right, "ordinal_num"));
        const referencedStatusTypes = new Set();
        const referencedCardTypes = new Set();
        const referencedSkillTypes = new Set();
        for (const range of ranges) {
            for (const column of ["hp_escalation_type", "attack_escalation_type", "defence_escalation_type", "special_attack_escalation_type", "performance_escalation_type"])
                referencedStatusTypes.add(id(range, column));
            referencedCardTypes.add(id(range, "card_escalation_type"));
            referencedSkillTypes.add(id(range, "skill_escalation_type"));
        }
        const threshold = zThresholdByStage.get(stageId);
        const checkpoints = (checkpointsByStage.get(stageId) ?? []).map(checkpoint => {
            const rewardGroupId = id(checkpoint, "z_battle_normal_reward_table_group_id");
            const rewardTables = normalTablesByGroup.get(rewardGroupId);
            if (!rewardTables?.length)
                throw new Error(`Z-Battle checkpoint ${id(checkpoint)} references missing normal reward group ${rewardGroupId}`);
            const repeatRewards = rewardTables.flatMap(rewardTable => {
                const rewardTableId = id(rewardTable);
                const rewards = normalRewardsByTable.get(rewardTableId);
                if (!rewards?.length)
                    throw new Error(`Z-Battle normal reward table ${rewardTableId} has no rewards`);
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
            if (!rewards?.length)
                throw new Error(`Z-Battle first reward level ${id(range)} references missing set ${rewardSetId}`);
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
    const resolveMissionStages = (0, game_db_mission_stage_relations_1.createMissionStageResolver)(options.tables.missions);
    const eventMissions = options.tables.missions
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
                ...rewardPresentation(itemType, itemId, cards, canonicalAwakenedCards, treasureItems, equipmentSkillItems),
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
    const dataset = {
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
            contract: exports.STAGE_FIRST_PARTY_CONTRACT,
            contractVersion: exports.STAGE_FIRST_PARTY_CONTRACT_VERSION,
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
exports.buildStageFirstPartyCandidate = buildStageFirstPartyCandidate;
//# sourceMappingURL=game-db-stage.js.map