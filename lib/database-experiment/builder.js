"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCoverage = exports.buildDatabaseExperimentDataset = exports.loadDatabaseExperimentTables = exports.CONSUMED_TABLE_COLUMNS = void 0;
exports.CONSUMED_TABLE_COLUMNS = {
    cards: ["id", "name", "character_id", "card_unique_info_id", "cost", "rarity", "hp_init", "hp_max", "atk_init", "atk_max", "def_init", "def_max", "element", "lv_max", "skill_lv_max", "optimal_awakening_grow_type", "passive_skill_set_id", "leader_skill_set_id", "link_skill1_id", "link_skill2_id", "link_skill3_id", "link_skill4_id", "link_skill5_id", "link_skill6_id", "link_skill7_id", "collectable_type", "is_selling_only", "resource_id", "potential_board_id", "open_at", "created_at", "updated_at"],
    characters: ["id", "name", "race", "sex", "size", "created_at", "updated_at"],
    card_unique_infos: ["id", "name", "kana", "created_at", "updated_at"],
    card_unique_info_set_relations: ["id", "card_unique_info_id", "card_unique_info_set_id", "created_at", "updated_at"],
    leader_skill_sets: ["id", "name", "description", "created_at", "updated_at"],
    leader_skills: ["id", "leader_skill_set_id", "exec_timing_type", "target_type", "sub_target_type_set_id", "causality_conditions", "efficacy_type", "efficacy_values", "calc_option", "created_at", "updated_at"],
    sub_target_types: ["id", "sub_target_type_set_id", "target_value_type", "target_value", "created_at", "updated_at"],
    passive_skill_sets: ["id", "name", "itemized_description", "sougou_only_itemized_description", "kobetu_only_itemized_description", "created_at", "updated_at"],
    passive_skill_set_relations: ["id", "passive_skill_set_id", "passive_skill_id", "created_at", "updated_at"],
    passive_skills: ["id", "name", "exec_timing_type", "exec_game_type", "efficacy_type", "target_type", "sub_target_type_set_id", "passive_skill_effect_id", "calc_option", "turn", "is_once", "probability", "causality_conditions", "eff_value1", "eff_value2", "eff_value3", "efficacy_values", "created_at", "updated_at"],
    passive_skill_effects: ["id", "script_name", "lite_flicker_rate", "bgm_id", "created_at", "updated_at"],
    skill_causalities: ["id", "causality_type", "cau_val1", "cau_val2", "cau_val3", "created_at", "updated_at"],
    card_specials: ["id", "card_id", "special_set_id", "priority", "style", "lv_start", "eball_num_start", "view_id", "causality_conditions", "special_asset_id", "detail_view_priority", "created_at", "updated_at"],
    special_sets: ["id", "name", "description", "causality_description", "aim_target", "increase_rate", "lv_bonus", "is_inactive", "created_at", "updated_at"],
    special_categories: ["id", "raw_attribute", "name"],
    specials: ["id", "special_set_id", "type", "efficacy_type", "target_type", "calc_option", "turn", "prob", "causality_conditions", "eff_value1", "eff_value2", "eff_value3", "created_at", "updated_at"],
    extra_special_options: ["id", "card_special_id", "probability", "extra_special_type", "bgm_id", "created_at", "updated_at"],
    card_active_skills: ["id", "card_id", "active_skill_set_id", "created_at", "updated_at"],
    active_skill_sets: ["id", "name", "effect_description", "condition_description", "turn", "exec_limit", "causality_conditions", "ultimate_special_id", "special_view_id", "created_at", "updated_at"],
    active_skills: ["id", "active_skill_set_id", "target_type", "sub_target_type_set_id", "calc_option", "efficacy_type", "eff_val1", "eff_val2", "eff_val3", "efficacy_values", "created_at", "updated_at"],
    card_standby_skill_set_relations: ["id", "card_id", "standby_skill_set_id", "created_at", "updated_at"],
    standby_skill_sets: ["id", "name", "effect_description", "condition_description", "exec_limit", "causality_conditions", "special_view_id", "created_at", "updated_at"],
    standby_skills: ["id", "standby_skill_set_id", "target_type", "target_type_values", "sub_target_type_set_id", "turn", "efficacy_type", "calc_option", "efficacy_values", "created_at", "updated_at"],
    card_finish_skill_set_relations: ["id", "card_id", "finish_skill_set_id", "created_at", "updated_at"],
    finish_skill_sets: ["id", "name", "effect_description", "condition_description", "exec_timing_type", "exec_limit", "causality_conditions", "finish_special_id", "special_view_id", "created_at", "updated_at"],
    finish_skills: ["id", "finish_skill_set_id", "target_type", "target_type_values", "sub_target_type_set_id", "turn", "efficacy_type", "calc_option", "efficacy_values", "created_at", "updated_at"],
    standby_skill_set_finish_skill_set_relations: ["id", "standby_skill_set_id", "finish_skill_set_id", "created_at", "updated_at"],
    card_awakening_routes: ["id", "type", "card_id", "awaked_card_id", "num", "card_awakening_set_id", "optimal_awakening_step", "optimal_awakening_type", "description", "priority", "open_at", "created_at", "updated_at"],
    optimal_awakening_growths: ["id", "optimal_awakening_grow_type", "step", "lv_max", "skill_lv_max", "passive_skill_set_id", "leader_skill_set_id"],
    collection_cards: ["id", "collection_unique_id", "card_id", "event_id", "priority", "created_at", "updated_at"],
    collection_uniques: ["id", "collection_category_id", "name", "priority", "card_id", "background_id", "created_at", "updated_at"],
    card_card_categories: ["id", "card_id", "card_category_id", "num", "created_at", "updated_at"],
    card_categories: ["id", "name", "kana", "priority", "open_at", "created_at", "updated_at"],
    link_skills: ["id", "name", "kana", "description", "created_at", "updated_at"],
    transformation_descriptions: ["id", "skill_type", "skill_id", "description", "created_at", "updated_at"],
    help_bodies: ["id", "help_id", "image_path", "description", "created_at", "updated_at"],
    missions: ["id", "type", "mission_category_id", "name", "description", "target_value", "conditions", "start_at", "end_at", "created_at", "updated_at"],
};
const COLLECTABLE_CARD_ID_MAX_EXCLUSIVE = 4000000;
function id(value) {
    if (value === null || value === undefined || value === "") {
        return undefined;
    }
    return String(value);
}
function numberValue(value) {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === "string" && value.trim()) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
}
function text(value) {
    return typeof value === "string" ? value.replace(/\r\n/g, "\n").trim() : value === null || value === undefined ? "" : String(value);
}
function provenance(table, row) {
    return {
        table,
        rowId: id(row.id) ?? "unknown",
        columns: Object.keys(row),
    };
}
function sourced(table, row) {
    return row ? { values: row, provenance: provenance(table, row) } : undefined;
}
function byId(rows) {
    return new Map(rows.flatMap(row => {
        const rowId = id(row.id);
        return rowId ? [[rowId, row]] : [];
    }));
}
function groupBy(rows, column) {
    const result = new Map();
    for (const row of rows) {
        const key = id(row[column]);
        if (!key)
            continue;
        const values = result.get(key) ?? [];
        values.push(row);
        result.set(key, values);
    }
    return result;
}
function parseJson(value) {
    if (typeof value !== "string" || !value.trim())
        return undefined;
    try {
        return JSON.parse(value);
    }
    catch {
        return undefined;
    }
}
function numericJsonArray(value) {
    const parsed = parseJson(value);
    return Array.isArray(parsed) ? parsed.filter(item => typeof item === "number" && Number.isFinite(item)) : [];
}
function collectExistingCausalityIds(value, known, result = new Set()) {
    if (typeof value === "number" && known.has(String(value)))
        result.add(String(value));
    if (Array.isArray(value))
        value.forEach(item => collectExistingCausalityIds(item, known, result));
    if (value && typeof value === "object")
        Object.values(value).forEach(item => collectExistingCausalityIds(item, known, result));
    return result;
}
function mapRarity(raw) {
    const values = ["N", "R", "SR", "SSR", "UR", "LR"];
    const numeric = numberValue(raw);
    return numeric !== null && values[numeric]
        ? { raw, value: values[numeric], evidence: "current-dataset-exact-id-parity" }
        : { raw, value: "unknown", evidence: "unknown" };
}
function mapType(raw) {
    const values = ["AGL", "TEQ", "INT", "STR", "PHY"];
    const numeric = numberValue(raw);
    const digit = numeric === null ? -1 : numeric % 10;
    return digit >= 0 && values[digit]
        ? { raw, value: values[digit], evidence: "current-dataset-exact-id-parity" }
        : { raw, value: "unknown", evidence: "unknown" };
}
function mapClass(raw) {
    const numeric = numberValue(raw);
    if (numeric !== null && numeric >= 0 && numeric < 5)
        return { raw, value: "unawakened", evidence: "first-party-row-join" };
    if (numeric !== null && numeric >= 10 && numeric < 20)
        return { raw, value: "Super", evidence: "first-party-row-join" };
    if (numeric !== null && numeric >= 20 && numeric < 30)
        return { raw, value: "Extreme", evidence: "first-party-row-join" };
    return { raw, value: "unknown", evidence: "unknown" };
}
function mapAttackVariant(raw) {
    const mapping = { Normal: "super", Hyper: "ultra", Condition: "unit", Extra: "ex" };
    const mapped = typeof raw === "string" ? mapping[raw] : undefined;
    return mapped
        ? { raw, value: mapped, evidence: "first-party-string-enum" }
        : { raw, value: "unknown", evidence: "unknown" };
}
function mapFormKind(channel, raw) {
    const numeric = numberValue(raw);
    if (numeric === 103)
        return { raw, value: "transformation", evidence: "first-party-row-join" };
    if (numeric === 79 && (channel === "passive" || channel === "active"))
        return { raw, value: "giant-or-rage", evidence: "first-party-row-join" };
    if (numeric === 131 && channel === "passive")
        return { raw, value: "reversible-exchange", evidence: "cross-source-golden" };
    return { raw, value: "unknown", evidence: "unknown" };
}
class DisjointSet {
    parent = new Map();
    add(value) { if (!this.parent.has(value))
        this.parent.set(value, value); }
    find(value) {
        this.add(value);
        const parent = this.parent.get(value);
        if (parent === value)
            return value;
        const root = this.find(parent);
        this.parent.set(value, root);
        return root;
    }
    union(left, right) {
        const leftRoot = this.find(left);
        const rightRoot = this.find(right);
        if (leftRoot === rightRoot)
            return;
        const root = Number(leftRoot) <= Number(rightRoot) ? leftRoot : rightRoot;
        this.parent.set(leftRoot === root ? rightRoot : leftRoot, root);
    }
}
async function loadDatabaseExperimentTables(adapter) {
    const tables = {};
    for (const [table, columns] of Object.entries(exports.CONSUMED_TABLE_COLUMNS)) {
        tables[table] = await adapter.readTable(table, columns);
    }
    return tables;
}
exports.loadDatabaseExperimentTables = loadDatabaseExperimentTables;
function buildFormRelations(tables) {
    const result = [];
    const descriptionByKey = new Map();
    for (const row of tables.transformation_descriptions) {
        descriptionByKey.set(`${text(row.skill_type)}:${id(row.skill_id)}`, row);
    }
    const push = (channel, sourceCardId, skill, setId, target) => {
        const skillId = id(skill.id);
        const efficacy = skill.efficacy_type;
        const kind = mapFormKind(channel, efficacy);
        if (kind.value === "unknown")
            return;
        const targetCardId = id(target);
        result.push({
            sourceCardId,
            targetCardId,
            kind,
            channel,
            sourceSkillId: skillId,
            sourceSkillSetId: setId,
            description: sourced("transformation_descriptions", descriptionByKey.get(`${channel === "passive" ? "PassiveSkill" : channel === "active" ? "ActiveSkill" : channel === "standby" ? "StandbySkill" : "FinishSkill"}:${skillId}`)),
            provenance: provenance(`${channel}_skills`, skill),
        });
    };
    const passiveSkills = byId(tables.passive_skills);
    const passiveRelationsBySet = groupBy(tables.passive_skill_set_relations, "passive_skill_set_id");
    const activeBySet = groupBy(tables.active_skills, "active_skill_set_id");
    const activeRelationsByCard = groupBy(tables.card_active_skills, "card_id");
    const standbyBySet = groupBy(tables.standby_skills, "standby_skill_set_id");
    const standbyRelationsByCard = groupBy(tables.card_standby_skill_set_relations, "card_id");
    const finishBySet = groupBy(tables.finish_skills, "finish_skill_set_id");
    const finishRelationsByCard = groupBy(tables.card_finish_skill_set_relations, "card_id");
    const finishByStandby = groupBy(tables.standby_skill_set_finish_skill_set_relations, "standby_skill_set_id");
    const growthByType = groupBy(tables.optimal_awakening_growths, "optimal_awakening_grow_type");
    for (const card of tables.cards) {
        const cardId = id(card.id);
        const passiveSetIds = [...new Set([
                id(card.passive_skill_set_id),
                ...(growthByType.get(id(card.optimal_awakening_grow_type) ?? "") ?? []).map(row => id(row.passive_skill_set_id)),
            ].filter((value) => Boolean(value)))];
        for (const passiveSetId of passiveSetIds) {
            for (const relation of passiveRelationsBySet.get(passiveSetId) ?? []) {
                const skill = passiveSkills.get(id(relation.passive_skill_id) ?? "");
                if (skill)
                    push("passive", cardId, skill, passiveSetId, skill.eff_value1);
            }
        }
        for (const relation of activeRelationsByCard.get(cardId) ?? []) {
            const setId = id(relation.active_skill_set_id);
            for (const skill of activeBySet.get(setId ?? "") ?? [])
                push("active", cardId, skill, setId, skill.eff_val1);
        }
        const standbySetIds = [];
        for (const relation of standbyRelationsByCard.get(cardId) ?? []) {
            const setId = id(relation.standby_skill_set_id);
            if (setId)
                standbySetIds.push(setId);
            for (const skill of standbyBySet.get(setId ?? "") ?? [])
                push("standby", cardId, skill, setId, numericJsonArray(skill.efficacy_values)[0]);
        }
        const finishSetIds = [...new Set([
                ...(finishRelationsByCard.get(cardId) ?? []).map(relation => id(relation.finish_skill_set_id)),
                ...standbySetIds.flatMap(standbySetId => (finishByStandby.get(standbySetId) ?? []).map(relation => id(relation.finish_skill_set_id))),
            ].filter((value) => Boolean(value)))];
        for (const setId of finishSetIds) {
            for (const skill of finishBySet.get(setId ?? "") ?? [])
                push("finish", cardId, skill, setId, numericJsonArray(skill.efficacy_values)[0]);
        }
    }
    return result.sort((a, b) => `${a.sourceCardId}:${a.channel}:${a.sourceSkillId}`.localeCompare(`${b.sourceCardId}:${b.channel}:${b.sourceSkillId}`));
}
function buildAttacks(cardId, tables, lookups) {
    return (lookups.cardSpecialsByCard.get(cardId) ?? []).map(cardSpecial => {
        const setId = id(cardSpecial.special_set_id);
        return {
            cardSpecial: sourced("card_specials", cardSpecial),
            specialSet: sourced("special_sets", lookups.specialSets.get(setId ?? "")),
            effects: (lookups.specialsBySet.get(setId ?? "") ?? []).map(row => sourced("specials", row)),
            extraOption: sourced("extra_special_options", lookups.extraByCardSpecial.get(id(cardSpecial.id) ?? "")),
            variant: mapAttackVariant(cardSpecial.style),
            availableFromSuperAttackLevel: numberValue(cardSpecial.lv_start),
        };
    });
}
function buildLookups(tables) {
    return {
        cards: byId(tables.cards), characters: byId(tables.characters), cardUniqueInfos: byId(tables.card_unique_infos),
        leaderSets: byId(tables.leader_skill_sets), leaderRowsBySet: groupBy(tables.leader_skills, "leader_skill_set_id"), targetRowsBySet: groupBy(tables.sub_target_types, "sub_target_type_set_id"),
        passiveSets: byId(tables.passive_skill_sets), passiveSkills: byId(tables.passive_skills), passiveEffects: byId(tables.passive_skill_effects), passiveRelationsBySet: groupBy(tables.passive_skill_set_relations, "passive_skill_set_id"),
        causalities: byId(tables.skill_causalities), cardSpecialsByCard: groupBy(tables.card_specials, "card_id"), specialSets: byId(tables.special_sets), specialsBySet: groupBy(tables.specials, "special_set_id"), extraByCardSpecial: new Map(tables.extra_special_options.map(row => [id(row.card_special_id), row])),
        activeSets: byId(tables.active_skill_sets), activeBySet: groupBy(tables.active_skills, "active_skill_set_id"), activeRelationsByCard: groupBy(tables.card_active_skills, "card_id"),
        standbySets: byId(tables.standby_skill_sets), standbyBySet: groupBy(tables.standby_skills, "standby_skill_set_id"), standbyRelationsByCard: groupBy(tables.card_standby_skill_set_relations, "card_id"),
        finishSets: byId(tables.finish_skill_sets), finishBySet: groupBy(tables.finish_skills, "finish_skill_set_id"), finishRelationsByCard: groupBy(tables.card_finish_skill_set_relations, "card_id"),
        finishByStandby: groupBy(tables.standby_skill_set_finish_skill_set_relations, "standby_skill_set_id"), standbyByFinish: groupBy(tables.standby_skill_set_finish_skill_set_relations, "finish_skill_set_id"),
        routesBySource: groupBy(tables.card_awakening_routes, "card_id"), routesByTarget: groupBy(tables.card_awakening_routes, "awaked_card_id"), growthByType: groupBy(tables.optimal_awakening_growths, "optimal_awakening_grow_type"),
        collectionEntriesByCard: groupBy(tables.collection_cards, "card_id"), collectionUniques: byId(tables.collection_uniques),
        categoryRelationsByCard: groupBy(tables.card_card_categories, "card_id"), categories: byId(tables.card_categories), links: byId(tables.link_skills),
    };
}
function resolveGrowthRelease(cardId, step, lookups, formSourcesByTarget, releasedAtOrBefore) {
    if (step === null) {
        return { releaseState: "unknown", releaseStateEvidence: "unknown", release: { availableAt: null, availableAtSnapshot: null, routes: [] } };
    }
    const matchingRoutes = (sourceCardId) => (lookups.routesBySource.get(sourceCardId) ?? []).filter(route => text(route.type) === "CardAwakeningRoute::Optimal" && numberValue(route.optimal_awakening_step) === step);
    let routes = matchingRoutes(cardId);
    if (routes.length === 0) {
        const visited = new Set([cardId]);
        const pending = [...(formSourcesByTarget.get(cardId) ?? [])];
        while (pending.length > 0) {
            const sourceCardId = pending.shift();
            if (visited.has(sourceCardId))
                continue;
            visited.add(sourceCardId);
            routes.push(...matchingRoutes(sourceCardId));
            pending.push(...(formSourcesByTarget.get(sourceCardId) ?? []));
        }
    }
    routes = routes.sort((left, right) => Number(left.id) - Number(right.id));
    const routeTypes = [...new Set(routes.map(route => numberValue(route.optimal_awakening_type)))];
    const releaseState = routeTypes.length === 1 && routeTypes[0] === 1 ? "eza"
        : routeTypes.length === 1 && routeTypes[0] === 2 ? "seza"
            : "unknown";
    const availableDates = [...new Set(routes.map(route => text(route.open_at)).filter(Boolean))].sort();
    const availableAt = availableDates[0] ?? null;
    return {
        releaseState,
        releaseStateEvidence: releaseState === "unknown" ? "unknown" : "first-party-labeled-enum",
        release: {
            availableAt,
            availableAtSnapshot: availableAt ? availableAt <= releasedAtOrBefore : null,
            routes: routes.map(route => sourced("card_awakening_routes", route)),
        },
    };
}
function buildState(card, growth, tables, lookups, formSourcesByTarget, releasedAtOrBefore) {
    const cardId = id(card.id);
    const step = growth ? numberValue(growth.step) : null;
    const leaderSetId = id(growth?.leader_skill_set_id) ?? id(card.leader_skill_set_id);
    const passiveSetId = id(growth?.passive_skill_set_id) ?? id(card.passive_skill_set_id);
    const leaderSet = lookups.leaderSets.get(leaderSetId ?? "");
    const leaderEffects = lookups.leaderRowsBySet.get(leaderSetId ?? "") ?? [];
    const targetRows = leaderEffects.flatMap(effect => lookups.targetRowsBySet.get(id(effect.sub_target_type_set_id) ?? "") ?? []);
    const passiveSet = lookups.passiveSets.get(passiveSetId ?? "");
    const passiveRelations = lookups.passiveRelationsBySet.get(passiveSetId ?? "") ?? [];
    const maxSuperAttackLevel = numberValue(growth?.skill_lv_max) ?? numberValue(card.skill_lv_max);
    const attacks = buildAttacks(cardId, tables, lookups).filter(attack => (attack.availableFromSuperAttackLevel ?? 0) <= (maxSuperAttackLevel ?? 0));
    const release = growth
        ? resolveGrowthRelease(cardId, step, lookups, formSourcesByTarget, releasedAtOrBefore)
        : {
            releaseState: "initial",
            releaseStateEvidence: "first-party-row-join",
            release: {
                availableAt: text(card.open_at) || null,
                availableAtSnapshot: !text(card.open_at) || text(card.open_at) <= releasedAtOrBefore,
                routes: [],
            },
        };
    return {
        stateKey: growth ? `${cardId}:growth-${step}` : `${cardId}:initial`,
        ...release,
        growthStep: sourced("optimal_awakening_growths", growth),
        maxLevel: numberValue(growth?.lv_max) ?? numberValue(card.lv_max),
        maxSuperAttackLevel,
        leaderSkill: leaderSet ? {
            set: sourced("leader_skill_sets", leaderSet),
            effects: leaderEffects.map(row => sourced("leader_skills", row)),
            targetRows: targetRows.map(row => sourced("sub_target_types", row)),
            structuredPercentValues: [...new Set(leaderEffects.flatMap(row => numberValue(row.efficacy_type) === 82 ? numericJsonArray(row.efficacy_values).slice(1, 2) : []))].sort((a, b) => a - b),
        } : undefined,
        passiveSkill: passiveSet ? {
            set: sourced("passive_skill_sets", passiveSet),
            relations: passiveRelations.map(relation => {
                const skill = lookups.passiveSkills.get(id(relation.passive_skill_id) ?? "");
                const causalityIds = collectExistingCausalityIds(parseJson(skill?.causality_conditions), lookups.causalities);
                return {
                    relation: sourced("passive_skill_set_relations", relation),
                    skill: sourced("passive_skills", skill),
                    effect: sourced("passive_skill_effects", lookups.passiveEffects.get(id(skill?.passive_skill_effect_id) ?? "")),
                    causalities: [...causalityIds].sort((a, b) => Number(a) - Number(b)).map(causalityId => sourced("skill_causalities", lookups.causalities.get(causalityId))),
                };
            }),
        } : undefined,
        attacks,
    };
}
function buildDatabaseExperimentDataset(options) {
    const { tables } = options;
    const lookups = buildLookups(tables);
    const allFormRelations = buildFormRelations(tables);
    const selectedIds = new Set(tables.cards.filter(card => {
        const cardId = numberValue(card.id) ?? Number.MAX_SAFE_INTEGER;
        const openAt = text(card.open_at);
        return cardId < COLLECTABLE_CARD_ID_MAX_EXCLUSIVE
            && numberValue(card.collectable_type) === 1
            && numberValue(card.is_selling_only) === 0
            && (numberValue(card.hp_init) ?? 0) > 0
            && (!openAt || openAt <= options.releasedAtOrBefore);
    }).map(card => id(card.id)));
    for (const relation of allFormRelations) {
        if (selectedIds.has(relation.sourceCardId) && relation.targetCardId && lookups.cards.has(relation.targetCardId))
            selectedIds.add(relation.targetCardId);
    }
    const formSourcesByTarget = new Map();
    for (const relation of allFormRelations) {
        if (!selectedIds.has(relation.sourceCardId) || !relation.targetCardId || !selectedIds.has(relation.targetCardId))
            continue;
        const sources = formSourcesByTarget.get(relation.targetCardId) ?? [];
        if (!sources.includes(relation.sourceCardId))
            sources.push(relation.sourceCardId);
        formSourcesByTarget.set(relation.targetCardId, sources.sort((left, right) => Number(left) - Number(right)));
    }
    const awakeningTargetsByCard = new Map();
    for (const route of tables.card_awakening_routes) {
        const source = id(route.card_id);
        const target = id(route.awaked_card_id);
        if (!source || !target || source === target || !selectedIds.has(source) || !selectedIds.has(target))
            continue;
        const targets = awakeningTargetsByCard.get(source) ?? [];
        if (!targets.includes(target))
            targets.push(target);
        awakeningTargetsByCard.set(source, targets.sort((left, right) => Number(left) - Number(right)));
    }
    const collectionListedIds = new Set([...selectedIds].filter(cardId => (lookups.collectionEntriesByCard.get(cardId) ?? []).length > 0));
    const downstreamCollectionCardIds = (cardId) => {
        const visited = new Set([cardId]);
        const pending = [...(awakeningTargetsByCard.get(cardId) ?? [])];
        const result = new Set();
        while (pending.length > 0) {
            const targetId = pending.shift();
            if (visited.has(targetId))
                continue;
            visited.add(targetId);
            if (collectionListedIds.has(targetId))
                result.add(targetId);
            pending.push(...(awakeningTargetsByCard.get(targetId) ?? []));
        }
        return [...result].sort((left, right) => Number(left) - Number(right));
    };
    const awakening = new DisjointSet();
    const hardDuplicate = new DisjointSet();
    selectedIds.forEach(cardId => { awakening.add(cardId); hardDuplicate.add(cardId); });
    for (const route of tables.card_awakening_routes) {
        const source = id(route.card_id);
        const target = id(route.awaked_card_id);
        if (!source || !target || source === target || !selectedIds.has(source) || !selectedIds.has(target))
            continue;
        awakening.union(source, target);
        hardDuplicate.union(source, target);
    }
    for (const relation of allFormRelations) {
        if (selectedIds.has(relation.sourceCardId) && relation.targetCardId && selectedIds.has(relation.targetCardId))
            hardDuplicate.union(relation.sourceCardId, relation.targetCardId);
    }
    const cards = [...selectedIds].sort((a, b) => Number(a) - Number(b)).map(cardId => {
        const card = lookups.cards.get(cardId);
        const character = lookups.characters.get(id(card.character_id) ?? "");
        const uniqueInfo = lookups.cardUniqueInfos.get(id(card.card_unique_info_id) ?? "");
        const growthRows = [...(lookups.growthByType.get(id(card.optimal_awakening_grow_type) ?? "") ?? [])].sort((a, b) => (numberValue(a.step) ?? 0) - (numberValue(b.step) ?? 0));
        const activeSkills = (lookups.activeRelationsByCard.get(cardId) ?? []).map(relation => {
            const setId = id(relation.active_skill_set_id);
            return { relation: sourced("card_active_skills", relation), set: sourced("active_skill_sets", lookups.activeSets.get(setId ?? "")), effects: (lookups.activeBySet.get(setId ?? "") ?? []).map(row => sourced("active_skills", row)) };
        });
        const standbySkills = (lookups.standbyRelationsByCard.get(cardId) ?? []).map(relation => {
            const setId = id(relation.standby_skill_set_id);
            return { relation: sourced("card_standby_skill_set_relations", relation), set: sourced("standby_skill_sets", lookups.standbySets.get(setId ?? "")), effects: (lookups.standbyBySet.get(setId ?? "") ?? []).map(row => sourced("standby_skills", row)), finishSkillSetIds: (lookups.finishByStandby.get(setId ?? "") ?? []).flatMap(row => id(row.finish_skill_set_id) ?? []) };
        });
        const directFinish = lookups.finishRelationsByCard.get(cardId) ?? [];
        const finishIds = [...new Set([...directFinish.flatMap(row => id(row.finish_skill_set_id) ?? []), ...standbySkills.flatMap(item => item.finishSkillSetIds)])];
        const finishSkills = finishIds.map(setId => ({ relation: sourced("card_finish_skill_set_relations", directFinish.find(row => id(row.finish_skill_set_id) === setId)), set: sourced("finish_skill_sets", lookups.finishSets.get(setId)), effects: (lookups.finishBySet.get(setId) ?? []).map(row => sourced("finish_skills", row)), standbySkillSetIds: (lookups.standbyByFinish.get(setId) ?? []).flatMap(row => id(row.standby_skill_set_id) ?? []) }));
        const formRelations = allFormRelations.filter(relation => relation.sourceCardId === cardId);
        const unknowns = [];
        const rarity = mapRarity(card.rarity);
        const type = mapType(card.element);
        const characterClass = mapClass(card.element);
        if (rarity.value === "unknown")
            unknowns.push(`rarity:${card.rarity}`);
        if (type.value === "unknown")
            unknowns.push(`element-type:${card.element}`);
        if (characterClass.value === "unknown")
            unknowns.push(`element-class:${card.element}`);
        const collectionEntries = lookups.collectionEntriesByCard.get(cardId) ?? [];
        const downstreamCollectionIds = downstreamCollectionCardIds(cardId);
        const skillStates = [
            buildState(card, undefined, tables, lookups, formSourcesByTarget, options.releasedAtOrBefore),
            ...growthRows.map(growth => buildState(card, growth, tables, lookups, formSourcesByTarget, options.releasedAtOrBefore)),
        ];
        if (skillStates.slice(1).some(state => state.releaseState === "unknown"))
            unknowns.push("growth-step-release-state:EZA/SEZA-unproven");
        return {
            cardId,
            recordKind: Number(cardId) < COLLECTABLE_CARD_ID_MAX_EXCLUSIVE ? "collectable" : "form",
            ids: { characterId: id(card.character_id), cardUniqueInfoId: id(card.card_unique_info_id), resourceId: id(card.resource_id), potentialBoardId: id(card.potential_board_id) },
            localizedText: { name: text(card.name), characterName: character ? text(character.name) : undefined, cardUniqueInfoName: uniqueInfo ? text(uniqueInfo.name) : undefined },
            rarity, type, characterClass,
            stats: { hpInitial: numberValue(card.hp_init), hpMax: numberValue(card.hp_max), atkInitial: numberValue(card.atk_init), atkMax: numberValue(card.atk_max), defInitial: numberValue(card.def_init), defMax: numberValue(card.def_max) },
            dates: { openAt: text(card.open_at) || null, createdAt: text(card.created_at) || null, updatedAt: text(card.updated_at) || null },
            grouping: { hardDuplicateGroupId: `card-group:${hardDuplicate.find(cardId)}`, awakeningFamilyId: `awakening:${awakening.find(cardId)}`, variantGroupId: id(card.card_unique_info_id) ? `card-unique-info:${id(card.card_unique_info_id)}` : undefined },
            catalog: {
                collectionEntries: collectionEntries.map(row => sourced("collection_cards", row)),
                collectionUniques: [...new Set(collectionEntries.flatMap(row => id(row.collection_unique_id) ?? []))]
                    .sort((left, right) => Number(left) - Number(right))
                    .flatMap(uniqueId => sourced("collection_uniques", lookups.collectionUniques.get(uniqueId)) ?? []),
                downstreamCollectionCardIds: downstreamCollectionIds,
                isCollectionListed: collectionEntries.length > 0,
                isProjectedPrimary: Number(cardId) < COLLECTABLE_CARD_ID_MAX_EXCLUSIVE && collectionEntries.length > 0 && downstreamCollectionIds.length === 0,
                projectionEvidence: "first-party-row-join",
            },
            card: sourced("cards", card), character: sourced("characters", character), cardUniqueInfo: sourced("card_unique_infos", uniqueInfo),
            links: [1, 2, 3, 4, 5, 6, 7].flatMap(slot => { const linkId = id(card[`link_skill${slot}_id`]); return linkId ? [{ slot, skill: sourced("link_skills", lookups.links.get(linkId)) }] : []; }),
            categories: (lookups.categoryRelationsByCard.get(cardId) ?? []).map(relation => ({ relation: sourced("card_card_categories", relation), category: sourced("card_categories", lookups.categories.get(id(relation.card_category_id) ?? "")) })),
            awakeningPaths: { incoming: (lookups.routesByTarget.get(cardId) ?? []).map(row => sourced("card_awakening_routes", row)), outgoing: (lookups.routesBySource.get(cardId) ?? []).map(row => sourced("card_awakening_routes", row)) },
            skillStates,
            activeSkills, standbySkills, finishSkills, formRelations, unknowns,
        };
    });
    return {
        schemaVersion: 1,
        contract: "dokkan-character-database-experiment",
        contractVersion: "1.1.0",
        generatedAt: options.generatedAt,
        sourceSnapshotVersion: options.sourceSnapshotVersion,
        sourceSha256: options.sourceSha256,
        releaseStateEnumEvidence: {
            eza: [sourced("help_bodies", byId(tables.help_bodies).get("181")), sourced("missions", byId(tables.missions).get("17293"))].filter((row) => Boolean(row)),
            seza: [sourced("help_bodies", byId(tables.help_bodies).get("403")), sourced("missions", byId(tables.missions).get("25264"))].filter((row) => Boolean(row)),
        },
        selection: { collectableCardIdMaxExclusive: COLLECTABLE_CARD_ID_MAX_EXCLUSIVE, includeReferencedForms: true, releasedAtOrBefore: options.releasedAtOrBefore, collectableTypeRaw: 1, sellingOnlyRaw: 0, catalogProjectionRule: "terminal-first-party-collection-card-by-awakening-reachability" },
        cards,
    };
}
exports.buildDatabaseExperimentDataset = buildDatabaseExperimentDataset;
function buildCoverage(dataset) {
    const attacks = { super: 0, ultra: 0, unit: 0, ex: 0, unknown: 0 };
    const forms = { transformation: 0, "giant-or-rage": 0, "reversible-exchange": 0, unknown: 0 };
    const unknownEnums = {};
    const dangling = { character: 0, cardUniqueInfo: 0, linkSkill: 0, category: 0, formTarget: 0 };
    let leader = 0;
    let passive = 0;
    let growthCards = 0;
    let unknownRelease = 0;
    let eza = 0;
    let seza = 0;
    let futureRelease = 0;
    let projectedUnknownRelease = 0;
    let projectedFutureRelease = 0;
    const enumRaw = new Map();
    const remember = (name, value) => {
        if (value === undefined)
            return;
        const values = enumRaw.get(name) ?? new Set();
        values.add(value);
        enumRaw.set(name, values);
    };
    for (const card of dataset.cards) {
        if (!card.character)
            dangling.character += 1;
        if (!card.cardUniqueInfo)
            dangling.cardUniqueInfo += 1;
        dangling.linkSkill += card.links.filter(item => !item.skill).length;
        dangling.category += card.categories.filter(item => !item.category).length;
        if (card.rarity.value === "unknown")
            unknownEnums.rarity = (unknownEnums.rarity ?? 0) + 1;
        if (card.type.value === "unknown")
            unknownEnums.type = (unknownEnums.type ?? 0) + 1;
        if (card.characterClass.value === "unknown")
            unknownEnums.characterClass = (unknownEnums.characterClass ?? 0) + 1;
        remember("rarity", card.rarity.raw);
        remember("element", card.type.raw);
        if (card.skillStates.length > 1)
            growthCards += 1;
        for (const state of card.skillStates) {
            if (state.leaderSkill)
                leader += 1;
            if (state.passiveSkill)
                passive += 1;
            if (state.releaseState === "unknown")
                unknownRelease += 1;
            if (state.releaseState === "eza")
                eza += 1;
            if (state.releaseState === "seza")
                seza += 1;
            if (state.release.availableAtSnapshot === false)
                futureRelease += 1;
            if (card.catalog.isProjectedPrimary && state.releaseState === "unknown")
                projectedUnknownRelease += 1;
            if (card.catalog.isProjectedPrimary && state.release.availableAtSnapshot === false)
                projectedFutureRelease += 1;
            state.release.routes.forEach(route => remember("optimalAwakeningType", route.values.optimal_awakening_type));
            state.attacks.forEach(attack => { attacks[attack.variant.value] += 1; remember("attackStyle", attack.variant.raw); });
            state.leaderSkill?.effects.forEach(effect => remember("leaderEfficacy", effect.values.efficacy_type));
            state.passiveSkill?.relations.forEach(relation => remember("passiveEfficacy", relation.skill?.values.efficacy_type));
        }
        card.activeSkills.forEach(skill => skill.effects.forEach(effect => remember("activeEfficacy", effect.values.efficacy_type)));
        card.standbySkills.forEach(skill => skill.effects.forEach(effect => remember("standbyEfficacy", effect.values.efficacy_type)));
        card.finishSkills.forEach(skill => skill.effects.forEach(effect => remember("finishEfficacy", effect.values.efficacy_type)));
        card.formRelations.forEach(relation => {
            forms[relation.kind.value] += 1;
            if (relation.targetCardId && !dataset.cards.some(target => target.cardId === relation.targetCardId))
                dangling.formTarget += 1;
        });
    }
    const sortedRaw = (name) => [...(enumRaw.get(name) ?? [])].sort((left, right) => String(left).localeCompare(String(right), undefined, { numeric: true }));
    const split = (name, confirmed, note) => ({ confirmed, unknown: sortedRaw(name).filter(value => !confirmed.includes(value)), note });
    return {
        schemaVersion: 1,
        cardCount: dataset.cards.length,
        collectableCardCount: dataset.cards.filter(card => card.recordKind === "collectable").length,
        formCardCount: dataset.cards.filter(card => card.recordKind === "form").length,
        collectionListedCardCount: dataset.cards.filter(card => card.catalog.isCollectionListed).length,
        projectedPrimaryCardCount: dataset.cards.filter(card => card.catalog.isProjectedPrimary).length,
        nonTerminalCollectionCardCount: dataset.cards.filter(card => card.catalog.isCollectionListed && !card.catalog.isProjectedPrimary).length,
        uniqueCardIds: new Set(dataset.cards.map(card => card.cardId)).size,
        characterRowCoverage: dataset.cards.filter(card => card.character).length,
        cardUniqueInfoRowCoverage: dataset.cards.filter(card => card.cardUniqueInfo).length,
        leaderSkillStateCount: leader,
        passiveSkillStateCount: passive,
        attackCounts: attacks,
        activeSkillCardCount: dataset.cards.filter(card => card.activeSkills.length > 0).length,
        standbySkillCardCount: dataset.cards.filter(card => card.standbySkills.length > 0).length,
        finishSkillCardCount: dataset.cards.filter(card => card.finishSkills.length > 0).length,
        formRelationCounts: forms,
        cardsWithGrowthSteps: growthCards,
        confirmedEzaStateCount: eza,
        confirmedSezaStateCount: seza,
        futureReleaseStateCount: futureRelease,
        unknownReleaseStateCount: unknownRelease,
        projectedPrimaryFutureReleaseStateCount: projectedFutureRelease,
        projectedPrimaryUnknownReleaseStateCount: projectedUnknownRelease,
        unknownEnumCounts: unknownEnums,
        enumEvidence: {
            rarity: split("rarity", [0, 1, 2, 3, 4, 5], "Exact-ID parity confirms N/R/SR/SSR/UR/LR."),
            elementType: split("element", [0, 1, 2, 3, 4, 10, 11, 12, 13, 14, 20, 21, 22, 23, 24], "Ones digit is exact-ID validated as AGL/TEQ/INT/STR/PHY."),
            elementClass: { confirmed: [0, 1, 2, 3, 4, 10, 11, 12, 13, 14, 20, 21, 22, 23, 24], unknown: [], note: "0x=unawakened (no Super/Extreme class), 1x=Super and 2x=Extreme. First-party Z-Awakening routes preserve the type digit while moving 0x cards into the 1x or 2x class band." },
            attackStyle: split("attackStyle", ["Normal", "Hyper", "Condition", "Extra"], "First-party string enum mapped to Super/Ultra/Unit/EX."),
            leaderEfficacy: split("leaderEfficacy", [82], "Only efficacy 82 is confirmed here as the structured percentage family; other meanings remain raw."),
            passiveEfficacy: split("passiveEfficacy", [79, 103, 131], "Form mapping is channel-scoped: 79 giant/rage, 103 transformation, 131 reversible exchange."),
            activeEfficacy: split("activeEfficacy", [79, 103], "Only 79 giant/rage and 103 transformation are confirmed in active skills."),
            standbyEfficacy: split("standbyEfficacy", [103], "Only 103 transformation is confirmed in standby skills."),
            finishEfficacy: split("finishEfficacy", [103], "Only 103 transformation is confirmed in finish skills."),
            optimalAwakeningType: split("optimalAwakeningType", [1, 2], "First-party help and mission rows correlate type 1 with EZA and type 2 with SEZA; the route supplies the release date."),
            optimalAwakeningStep: { confirmed: [...new Set(dataset.cards.flatMap(card => card.skillStates.flatMap(state => state.growthStep ? [state.growthStep.values.step] : [])))].sort((a, b) => Number(a) - Number(b)), unknown: [], note: "First-party missions identify these values as ordinal awakening steps; EZA/SEZA comes from optimal_awakening_type, not the step number." },
        },
        danglingJoinCounts: dangling,
    };
}
exports.buildCoverage = buildCoverage;
//# sourceMappingURL=builder.js.map