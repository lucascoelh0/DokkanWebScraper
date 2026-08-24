"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildGameDbNameIdentityContract = exports.buildGameDbCardIdentityContract = void 0;
const game_db_source_1 = require("./game-db-source");
function compareDbIds(left, right) {
    if (/^\d+$/.test(left) && /^\d+$/.test(right)) {
        const leftId = BigInt(left);
        const rightId = BigInt(right);
        return leftId < rightId ? -1 : leftId > rightId ? 1 : 0;
    }
    return left.localeCompare(right, "en-US");
}
function requiredId(value, context) {
    const id = (0, game_db_source_1.normalizeDbId)(value);
    if (!id || !/^\d+$/.test(id)) {
        throw new Error(`${context} must be a positive numeric ID`);
    }
    return id;
}
function buildGameDbCardIdentityContract(tables) {
    const identities = new Map();
    for (const row of tables.cards ?? []) {
        const cardId = requiredId(row.id, "cards.id");
        const identity = {
            canonicalId: requiredId(row.card_unique_info_id, `cards row ${cardId} canonical ID`),
            gameCharacterId: requiredId(row.character_id, `cards row ${cardId} character ID`),
        };
        if (identities.has(cardId))
            throw new Error(`duplicate cards row ${cardId}`);
        identities.set(cardId, identity);
    }
    return identities;
}
exports.buildGameDbCardIdentityContract = buildGameDbCardIdentityContract;
function collectCompiledCausalityIds(raw) {
    const trimmed = raw?.trim() ?? "";
    if (!trimmed)
        return [];
    let compiled;
    try {
        compiled = JSON.parse(trimmed).compiled;
    }
    catch {
        return [];
    }
    const ids = [];
    const visit = (node) => {
        if (typeof node === "number" && Number.isSafeInteger(node) && node > 0) {
            ids.push(String(node));
            return true;
        }
        if (!Array.isArray(node) || node.length < 2 || (node[0] !== "&" && node[0] !== "|")) {
            return false;
        }
        return node.slice(1).every(visit);
    };
    return visit(compiled) ? [...new Set(ids)] : [];
}
function scopeFromCausality(value) {
    if (value === 0)
        return "team";
    if (value === 1)
        return "enemy";
    if (value === 2)
        return "rotation";
    return undefined;
}
function buildCanonicalGroups(tables) {
    const namesById = new Map();
    for (const row of tables.card_unique_infos ?? []) {
        const id = requiredId(row.id, "card_unique_infos.id");
        const name = row.name?.trim() ?? "";
        if (!name)
            throw new Error(`card_unique_infos row ${id} has no name`);
        if (namesById.has(id))
            throw new Error(`duplicate card_unique_infos row ${id}`);
        namesById.set(id, name);
    }
    const idsBySet = new Map();
    for (const row of tables.card_unique_info_set_relations ?? []) {
        const relationId = requiredId(row.id, "card_unique_info_set_relations.id");
        const setId = requiredId(row.card_unique_info_set_id, `card_unique_info_set_relations row ${relationId} set ID`);
        const canonicalId = requiredId(row.card_unique_info_id, `card_unique_info_set_relations row ${relationId} canonical ID`);
        if (!namesById.has(canonicalId)) {
            throw new Error(`card_unique_info_set_relations row ${relationId} references missing identity ${canonicalId}`);
        }
        const ids = idsBySet.get(setId) ?? new Set();
        ids.add(canonicalId);
        idsBySet.set(setId, ids);
    }
    return new Map([...idsBySet].map(([setId, ids]) => {
        const canonicalIds = [...ids].sort(compareDbIds);
        return [setId, {
                canonicalIds,
                canonicalNames: [...new Set(canonicalIds.map(id => namesById.get(id)))]
                    .sort((left, right) => left.localeCompare(right, "en-US")),
            }];
    }));
}
function buildGameDbNameIdentityContract(tables) {
    const canonicalGroups = buildCanonicalGroups(tables);
    const categoryNamesById = new Map();
    for (const row of tables.card_categories ?? []) {
        const id = requiredId(row.id, "card_categories.id");
        const name = row.name?.trim() ?? "";
        if (!name)
            throw new Error(`card_categories row ${id} has no name`);
        if (categoryNamesById.has(id))
            throw new Error(`duplicate card_categories row ${id}`);
        categoryNamesById.set(id, name);
    }
    const setsByPassiveSkillId = new Map();
    for (const row of tables.passive_skill_set_relations ?? []) {
        const relationId = requiredId(row.id, "passive_skill_set_relations.id");
        const passiveSkillId = requiredId(row.passive_skill_id, `passive_skill_set_relations row ${relationId} passive skill ID`);
        const passiveSkillSetId = requiredId(row.passive_skill_set_id, `passive_skill_set_relations row ${relationId} passive skill set ID`);
        const setIds = setsByPassiveSkillId.get(passiveSkillId) ?? new Set();
        setIds.add(passiveSkillSetId);
        setsByPassiveSkillId.set(passiveSkillId, setIds);
    }
    const causalityById = new Map();
    for (const row of tables.skill_causalities ?? []) {
        const id = requiredId(row.id, "skill_causalities.id");
        if (causalityById.has(id))
            throw new Error(`duplicate skill_causalities row ${id}`);
        causalityById.set(id, row);
    }
    const bindings = new Map();
    for (const passiveSkill of tables.passive_skills ?? []) {
        const passiveSkillId = requiredId(passiveSkill.id, "passive_skills.id");
        const passiveSkillSetIds = setsByPassiveSkillId.get(passiveSkillId);
        if (!passiveSkillSetIds)
            continue;
        for (const causalityId of collectCompiledCausalityIds(passiveSkill.causality_conditions)) {
            const causality = causalityById.get(causalityId);
            if (!causality)
                continue;
            const causalityType = (0, game_db_source_1.parseDbInt)(causality.causality_type);
            if (causalityType !== 41 && causalityType !== 45)
                continue;
            const scope = scopeFromCausality((0, game_db_source_1.parseDbInt)(causality.cau_val1));
            const identitySetId = (0, game_db_source_1.normalizeDbId)(causalityType === 41 ? causality.cau_val2 : causality.cau_val3);
            const count = causalityType === 41 ? (0, game_db_source_1.parseDbInt)(causality.cau_val3) : 1;
            const categoryId = causalityType === 45 ? (0, game_db_source_1.normalizeDbId)(causality.cau_val2) : undefined;
            const categoryName = categoryId ? categoryNamesById.get(categoryId) : undefined;
            if (!scope || !identitySetId || !/^\d+$/.test(identitySetId)
                || !Number.isInteger(count) || (count ?? 0) <= 0
                || (causalityType === 45 && (!categoryId || !categoryName))) {
                throw new Error(`skill_causalities row ${causalityId} has an invalid type-${causalityType} name contract`);
            }
            const group = canonicalGroups.get(identitySetId);
            if (!group || group.canonicalIds.length === 0) {
                throw new Error(`skill_causalities row ${causalityId} references missing identity set ${identitySetId}`);
            }
            for (const passiveSkillSetId of passiveSkillSetIds) {
                const binding = {
                    passiveSkillSetId,
                    scope,
                    count: count,
                    identitySetId,
                    canonicalIds: group.canonicalIds,
                    canonicalNames: group.canonicalNames,
                    ...(categoryName ? { categories: [categoryName] } : {}),
                };
                const key = [passiveSkillSetId, scope, count, identitySetId, categoryId ?? ""].join(":");
                bindings.set(key, binding);
            }
        }
    }
    return {
        source: "first_party_game_db",
        bindings: [...bindings.values()].sort((left, right) => compareDbIds(left.passiveSkillSetId, right.passiveSkillSetId)
            || left.scope.localeCompare(right.scope, "en-US")
            || left.count - right.count
            || compareDbIds(left.identitySetId, right.identitySetId)),
    };
}
exports.buildGameDbNameIdentityContract = buildGameDbNameIdentityContract;
//# sourceMappingURL=game-db-name-identity.js.map