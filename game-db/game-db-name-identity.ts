import type {
    TeamAnalysisCardIdentity,
    TeamAnalysisNameIdentityBinding,
    TeamAnalysisNameIdentityContract,
} from "../team-analysis";
import { GameDbRow, normalizeDbId, parseDbInt } from "./game-db-source";

type NameIdentityScope = TeamAnalysisNameIdentityBinding["scope"];

function compareDbIds(left: string, right: string): number {
    if (/^\d+$/.test(left) && /^\d+$/.test(right)) {
        const leftId = BigInt(left);
        const rightId = BigInt(right);
        return leftId < rightId ? -1 : leftId > rightId ? 1 : 0;
    }
    return left.localeCompare(right, "en-US");
}

function requiredId(value: string | undefined, context: string): string {
    const id = normalizeDbId(value);
    if (!id || !/^\d+$/.test(id)) {
        throw new Error(`${context} must be a positive numeric ID`);
    }
    return id;
}

export function buildGameDbCardIdentityContract(
    tables: Record<string, GameDbRow[]>,
): ReadonlyMap<string, TeamAnalysisCardIdentity> {
    const identities = new Map<string, TeamAnalysisCardIdentity>();
    for (const row of tables.cards ?? []) {
        const cardId = requiredId(row.id, "cards.id");
        const identity: TeamAnalysisCardIdentity = {
            canonicalId: requiredId(row.card_unique_info_id, `cards row ${cardId} canonical ID`),
            gameCharacterId: requiredId(row.character_id, `cards row ${cardId} character ID`),
        };
        if (identities.has(cardId)) throw new Error(`duplicate cards row ${cardId}`);
        identities.set(cardId, identity);
    }
    return identities;
}

function collectCompiledCausalityIds(raw: string | undefined): string[] {
    const trimmed = raw?.trim() ?? "";
    if (!trimmed) return [];
    let compiled: unknown;
    try {
        compiled = (JSON.parse(trimmed) as { compiled?: unknown }).compiled;
    } catch {
        return [];
    }

    const ids: string[] = [];
    const visit = (node: unknown): boolean => {
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

function scopeFromCausality(value: number | undefined): NameIdentityScope | undefined {
    if (value === 0) return "team";
    if (value === 1) return "enemy";
    if (value === 2) return "rotation";
    return undefined;
}

function buildCanonicalGroups(tables: Record<string, GameDbRow[]>): Map<string, {
    canonicalIds: string[],
    canonicalNames: string[],
}> {
    const namesById = new Map<string, string>();
    for (const row of tables.card_unique_infos ?? []) {
        const id = requiredId(row.id, "card_unique_infos.id");
        const name = row.name?.trim() ?? "";
        if (!name) throw new Error(`card_unique_infos row ${id} has no name`);
        if (namesById.has(id)) throw new Error(`duplicate card_unique_infos row ${id}`);
        namesById.set(id, name);
    }

    const idsBySet = new Map<string, Set<string>>();
    for (const row of tables.card_unique_info_set_relations ?? []) {
        const relationId = requiredId(row.id, "card_unique_info_set_relations.id");
        const setId = requiredId(
            row.card_unique_info_set_id,
            `card_unique_info_set_relations row ${relationId} set ID`,
        );
        const canonicalId = requiredId(
            row.card_unique_info_id,
            `card_unique_info_set_relations row ${relationId} canonical ID`,
        );
        if (!namesById.has(canonicalId)) {
            throw new Error(`card_unique_info_set_relations row ${relationId} references missing identity ${canonicalId}`);
        }
        const ids = idsBySet.get(setId) ?? new Set<string>();
        ids.add(canonicalId);
        idsBySet.set(setId, ids);
    }

    return new Map([...idsBySet].map(([setId, ids]) => {
        const canonicalIds = [...ids].sort(compareDbIds);
        return [setId, {
            canonicalIds,
            canonicalNames: [...new Set(canonicalIds.map(id => namesById.get(id)!))]
                .sort((left, right) => left.localeCompare(right, "en-US")),
        }];
    }));
}

export function buildGameDbNameIdentityContract(
    tables: Record<string, GameDbRow[]>,
): TeamAnalysisNameIdentityContract {
    const canonicalGroups = buildCanonicalGroups(tables);
    const categoryNamesById = new Map<string, string>();
    for (const row of tables.card_categories ?? []) {
        const id = requiredId(row.id, "card_categories.id");
        const name = row.name?.trim() ?? "";
        if (!name) throw new Error(`card_categories row ${id} has no name`);
        if (categoryNamesById.has(id)) throw new Error(`duplicate card_categories row ${id}`);
        categoryNamesById.set(id, name);
    }
    const setsByPassiveSkillId = new Map<string, Set<string>>();
    for (const row of tables.passive_skill_set_relations ?? []) {
        const relationId = requiredId(row.id, "passive_skill_set_relations.id");
        const passiveSkillId = requiredId(
            row.passive_skill_id,
            `passive_skill_set_relations row ${relationId} passive skill ID`,
        );
        const passiveSkillSetId = requiredId(
            row.passive_skill_set_id,
            `passive_skill_set_relations row ${relationId} passive skill set ID`,
        );
        const setIds = setsByPassiveSkillId.get(passiveSkillId) ?? new Set<string>();
        setIds.add(passiveSkillSetId);
        setsByPassiveSkillId.set(passiveSkillId, setIds);
    }

    const causalityById = new Map<string, GameDbRow>();
    for (const row of tables.skill_causalities ?? []) {
        const id = requiredId(row.id, "skill_causalities.id");
        if (causalityById.has(id)) throw new Error(`duplicate skill_causalities row ${id}`);
        causalityById.set(id, row);
    }

    const bindings = new Map<string, TeamAnalysisNameIdentityBinding>();
    for (const passiveSkill of tables.passive_skills ?? []) {
        const passiveSkillId = requiredId(passiveSkill.id, "passive_skills.id");
        const passiveSkillSetIds = setsByPassiveSkillId.get(passiveSkillId);
        if (!passiveSkillSetIds) continue;
        for (const causalityId of collectCompiledCausalityIds(passiveSkill.causality_conditions)) {
            const causality = causalityById.get(causalityId);
            if (!causality) continue;
            const causalityType = parseDbInt(causality.causality_type);
            if (causalityType !== 41 && causalityType !== 45) continue;
            const scope = scopeFromCausality(parseDbInt(causality.cau_val1));
            const identitySetId = normalizeDbId(
                causalityType === 41 ? causality.cau_val2 : causality.cau_val3,
            );
            const count = causalityType === 41 ? parseDbInt(causality.cau_val3) : 1;
            const categoryId = causalityType === 45 ? normalizeDbId(causality.cau_val2) : undefined;
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
                const binding: TeamAnalysisNameIdentityBinding = {
                    passiveSkillSetId,
                    scope,
                    count: count!,
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
        bindings: [...bindings.values()].sort((left, right) =>
            compareDbIds(left.passiveSkillSetId, right.passiveSkillSetId)
            || left.scope.localeCompare(right.scope, "en-US")
            || left.count - right.count
            || compareDbIds(left.identitySetId, right.identitySetId)),
    };
}
