import { createHash } from "crypto";
import { GameDbRow, normalizeDbId } from "./game-db-source";

export const SKILL_ORB_CONTRACT_VERSION = "1.2.0";
export type SkillOrbContractVersion = "1.0.0" | "1.1.0" | typeof SKILL_ORB_CONTRACT_VERSION;

export const PINNED_SKILL_ORB_PROFILE = {
    snapshotVersion: "1788329250",
    sourceDatabaseSha256: "7a6ca01808aea355ef28f9c0190e2c072f43a7c08be41d363f5b052824922495",
    itemCount: 8751,
    maxItemId: 9069,
    effectRowCount: 14021,
    singleEffectItemCount: 3481,
    dualEffectItemCount: 5270,
    eternalItemCount: 5060,
    gradeCounts: { bronze: 2183, silver: 2786, gold: 3782 },
    limitationSetCount: 310,
    limitationRowCount: 310,
    itemCountsByLimitationKind: {
        category: 4958,
        element: 1852,
        card: 1803,
        "card-unique-info-set": 138,
    },
    limitationRowsByKind: {
        category: 102,
        element: 18,
        card: 183,
        "card-unique-info-set": 7,
    },
    exactCardReferenceCount: 777,
    exactUniqueCardCount: 695,
    foregroundIconCount: 122,
    levelCombinationCount: 50,
} as const;

export type SkillOrbGrade = "bronze" | "silver" | "gold";
export type SkillOrbLimitationKind = "element" | "category" | "card" | "card-unique-info-set";

export interface SkillOrbEffect {
    sourceRowId: string,
    potentialSkillId?: string,
    statusType?: "hp" | "attack" | "defense",
    level: number,
    /** First-party flat stat value. Present only for hp/attack/defense effects in contract 1.1+. */
    value?: number,
    label?: string,
}

export interface ResolvedSkillOrbTarget {
    id: string,
    name: string,
    eligibleCardCount?: number,
}

export interface ResolvedCardUniqueInfoSet {
    id: string,
    names: string[],
    eligibleCardIds: string[],
}

export interface SkillOrbLimitationCondition {
    sourceRowId: string,
    kind: SkillOrbLimitationKind,
    rawType: string,
    rawConditions: Record<string, unknown>,
    isUnrestricted: boolean,
    elementBitPattern?: number,
    elementCodes?: string[],
    cardCategoryIds?: string[],
    resolvedCategories?: ResolvedSkillOrbTarget[],
    cardIds?: string[],
    /** Final awakening owner for each aligned cardIds entry. Added in contract 1.2. */
    canonicalOwnerCardIds?: string[],
    resolvedCards?: ResolvedSkillOrbTarget[],
    cardUniqueInfoSetIds?: string[],
    resolvedCardUniqueInfoSets?: ResolvedCardUniqueInfoSet[],
    presentation: SkillOrbLimitationPresentation,
}

export interface SkillOrbLimitationPresentation {
    badgeLabel: string,
    detailLabel: string,
    badgeAssetPath?: string,
    badgeAssetPaths?: string[],
}

export interface SkillOrbLimitationSet {
    id: string,
    combination: "any",
    conditions: SkillOrbLimitationCondition[],
    isUnrestricted: boolean,
    presentation: SkillOrbLimitationPresentation,
}

export interface SkillOrbItem {
    id: string,
    name: string,
    description: string,
    grade: SkillOrbGrade,
    iconImageId: string,
    iconAssetPath: string,
    backgroundAssetPath: string,
    isEternal: boolean,
    infinityAssetPath?: string,
    effects: SkillOrbEffect[],
    levelAssetPath: string,
    limitationSetId: string,
}

export interface SkillOrbAssetEntry {
    path: string,
    sizeBytes: number,
    sha256: string,
    provenance: "official-cpk" | "official-cpk-derived",
    sourceFiles: string[],
}

export interface SkillOrbAssetInventory {
    assets: SkillOrbAssetEntry[],
    counts: {
        foregroundIcons: number,
        gradeBackgrounds: number,
        levelAssets: number,
        infinityAssets: number,
        restrictionBadges: number,
        total: number,
    },
    totalBytes: number,
    inventorySha256: string,
}

export interface SkillOrbCatalog {
    schemaVersion: 1,
    parserVersion: SkillOrbContractVersion,
    provenance: {
        snapshotVersion: string,
        sourceDatabaseSha256: string,
    },
    items: SkillOrbItem[],
    limitationSets: SkillOrbLimitationSet[],
    indexes: {
        exactCardId: Record<string, string[]>,
        familyEligibleCardId: Record<string, string[]>,
        /** First-party category membership keyed by structural category ID. Added in contract 1.1. */
        categoryEligibleCardId?: Record<string, string[]>,
        /** Orbs whose sole CardLimitation owner is this final awakened card. Added in contract 1.2. */
        exclusiveOwnerCardId?: Record<string, string[]>,
    },
    assetInventory: SkillOrbAssetInventory,
}

export interface SkillOrbSourceTables {
    cards: GameDbRow[],
    card_card_categories: GameDbRow[],
    card_categories: GameDbRow[],
    card_unique_infos: GameDbRow[],
    card_unique_info_set_relations: GameDbRow[],
    card_awakening_routes: GameDbRow[],
    equipment_skill_items: GameDbRow[],
    equipment_skill_limitations: GameDbRow[],
    equipment_skills: GameDbRow[],
}

const UI_ROOT = "layout/en/image/charamenu/potential";

export const ELEMENT_LIMITATION_BITS = [
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

const EFFECT_PRIORITY = new Map<string, number>([
    ["potential:2", 10], ["potential:1", 9], ["potential:7", 8], ["potential:4", 7],
    ["potential:5", 6], ["potential:6", 5], ["potential:3", 4],
    ["status:hp", 3], ["status:attack", 2], ["status:defense", 1],
]);

const EFFECT_LABEL = new Map<string, string>([
    ["potential:1", "Combo Attack"], ["potential:2", "Critical Hit"],
    ["potential:3", "Evasion"], ["potential:4", "Type ATK Boost"],
    ["potential:5", "Type DEF Boost"], ["potential:6", "Super Attack Boost"],
    ["potential:7", "Recovery Boost"],
    ["status:hp", "HP"], ["status:attack", "ATK"], ["status:defense", "DEF"],
]);

function text(value: unknown): string {
    return String(value ?? "").trim();
}

function requiredId(row: GameDbRow, field = "id", context = field): string {
    const value = normalizeDbId(row[field]);
    if (!value || !/^\d+$/.test(value) || Number(value) <= 0) throw new Error(`${context} must be a positive structural ID`);
    return value;
}

function optionalId(row: GameDbRow, field: string): string | undefined {
    const raw = text(row[field]);
    if (!raw) return undefined;
    const value = normalizeDbId(raw);
    if (!value || !/^\d+$/.test(value) || Number(value) <= 0) throw new Error(`${field} must be a positive structural ID`);
    return value;
}

function positiveInteger(value: unknown, context: string): number {
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(`${context} must be a positive integer`);
    return parsed;
}

function nonNegativeInteger(value: unknown, context: string): number {
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error(`${context} must be a non-negative integer`);
    return parsed;
}

function numericCompare(left: string, right: string): number {
    return Number(left) - Number(right) || left.localeCompare(right);
}

function uniqueRows(rows: GameDbRow[], context: string, field = "id"): Map<string, GameDbRow> {
    const result = new Map<string, GameDbRow>();
    for (const row of rows) {
        const rowId = requiredId(row, field, `${context}.${field}`);
        if (result.has(rowId)) throw new Error(`Duplicate ${context} ID ${rowId}`);
        result.set(rowId, row);
    }
    return result;
}

function canonicalAwakeningOwners(
    routes: GameDbRow[],
    cards: ReadonlyMap<string, GameDbRow>,
): Map<string, string> {
    const visibleCardId = (cardId: string): string => {
        const numeric = Number(cardId);
        if (!Number.isSafeInteger(numeric) || numeric <= 0) throw new Error(`Invalid card ID ${cardId}`);
        const releaseState = numeric % 10;
        if (releaseState !== 0 && releaseState !== 1) throw new Error(`Unsupported card release-state variant ${cardId}`);
        // Awakening routes and portrait assets use the x0 identity; Characters exposes the available x1 row when present.
        return String(Math.floor(numeric / 10) * 10);
    };
    uniqueRows(routes, "card_awakening_routes");
    const representativeByVisibleId = new Map<string, string>();
    for (const cardId of cards.keys()) {
        const visibleId = visibleCardId(cardId);
        const previous = representativeByVisibleId.get(visibleId);
        if (!previous || numericCompare(previous, cardId) < 0) representativeByVisibleId.set(visibleId, cardId);
    }
    const outgoing = new Map<string, string>();
    for (const row of routes) {
        const routeId = requiredId(row);
        const rawSourceId = requiredId(row, "card_id", `Card awakening route ${routeId}`);
        const rawTargetId = requiredId(row, "awaked_card_id", `Card awakening route ${routeId}`);
        if (!cards.has(rawSourceId) || !cards.has(rawTargetId)) {
            throw new Error(`Invalid card awakening route ${rawSourceId} -> ${rawTargetId}`);
        }
        const sourceId = visibleCardId(rawSourceId);
        const targetId = visibleCardId(rawTargetId);
        if (sourceId === targetId) continue;
        const previous = outgoing.get(sourceId);
        if (previous && previous !== targetId) throw new Error(`Ambiguous card awakening route for ${sourceId}`);
        outgoing.set(sourceId, targetId);
    }
    const owners = new Map<string, string>();
    for (const cardId of cards.keys()) {
        const visited = new Set<string>();
        let current = visibleCardId(cardId);
        while (outgoing.has(current)) {
            if (!visited.add(current)) throw new Error(`Cyclic card awakening route at ${current}`);
            current = outgoing.get(current)!;
        }
        const representative = representativeByVisibleId.get(current);
        if (!representative) throw new Error(`Missing canonical card representative for ${current}`);
        owners.set(cardId, representative);
    }
    return owners;
}

function groupRows(rows: GameDbRow[], field: string, context: string): Map<string, GameDbRow[]> {
    const result = new Map<string, GameDbRow[]>();
    for (const row of rows) {
        const key = requiredId(row, field, `${context}.${field}`);
        const values = result.get(key) ?? [];
        values.push(row);
        result.set(key, values);
    }
    return result;
}

function jsonObject(value: unknown, context: string): Record<string, unknown> {
    let parsed: unknown;
    try { parsed = JSON.parse(text(value)); } catch { throw new Error(`${context} must be valid JSON`); }
    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") throw new Error(`${context} must be a JSON object`);
    return parsed as Record<string, unknown>;
}

function conditionIds(value: unknown, context: string): string[] {
    if (!Array.isArray(value) || value.length === 0) throw new Error(`${context} must be a non-empty array`);
    const ids = value.map((entry, index) => {
        const normalized = normalizeDbId(String(entry ?? ""));
        if (!normalized || !/^\d+$/.test(normalized) || Number(normalized) <= 0) throw new Error(`${context}[${index}] must be a positive ID`);
        return normalized;
    });
    if (new Set(ids).size !== ids.length) throw new Error(`${context} must not contain duplicate IDs`);
    return ids;
}

function exactConditionIds(raw: Record<string, unknown>, key: string, context: string): string[] {
    if (Object.keys(raw).length !== 1 || !(key in raw)) throw new Error(`${context} has unsupported condition fields`);
    return conditionIds(raw[key], `${context}.${key}`).sort(numericCompare);
}

function conciseNames(names: string[]): string {
    const unique = [...new Set(names)];
    if (unique.length <= 2) return unique.join(" / ");
    return `${unique.slice(0, 2).join(" / ")} +${unique.length - 2}`;
}

function levelAssetPath(effects: SkillOrbEffect[]): string {
    const levels = effects.map(effect => effect.level);
    if (levels.length < 1 || levels.length > 2 || levels.some(level => level < 1 || level > 99)) {
        throw new Error(`Unsupported Skill Orb level combination ${levels.join("-")}`);
    }
    return `derived/equipment/levels/lv-${levels.join("-")}.png`;
}

function buildCondition(
    row: GameDbRow,
    cards: ReadonlyMap<string, GameDbRow>,
    categories: ReadonlyMap<string, GameDbRow>,
    uniqueInfos: ReadonlyMap<string, GameDbRow>,
    uniqueInfoRelationsBySet: ReadonlyMap<string, GameDbRow[]>,
    cardsByUniqueInfo: ReadonlyMap<string, GameDbRow[]>,
    categoryRelationsByCategory: ReadonlyMap<string, GameDbRow[]>,
    canonicalOwnerByCardId: ReadonlyMap<string, string>,
): SkillOrbLimitationCondition {
    const sourceRowId = requiredId(row);
    const rawType = text(row.type);
    const rawConditions = jsonObject(row.conditions, `Equipment limitation ${sourceRowId}.conditions`);
    const base = { sourceRowId, rawType, rawConditions };
    if (rawType === "EquipmentSkillLimitation::ElementLimitation") {
        if (Object.keys(rawConditions).length !== 1 || !("element_bitpattern" in rawConditions)) throw new Error(`Equipment limitation ${sourceRowId} has unsupported condition fields`);
        const elementBitPattern = positiveInteger(rawConditions.element_bitpattern, `Equipment limitation ${sourceRowId}.element_bitpattern`);
        const matched = ELEMENT_LIMITATION_BITS.filter(value => (elementBitPattern & value.bit) !== 0);
        const knownMask = matched.reduce((sum, value) => sum + value.bit, 0);
        if (knownMask !== elementBitPattern) throw new Error(`Equipment limitation ${sourceRowId} has unknown element bitpattern ${elementBitPattern}`);
        const isUnrestricted = elementBitPattern === 31;
        const badgeLabel = isUnrestricted ? "ALL" : elementBitPattern === 126976 ? "SUPER" : elementBitPattern === 4063232 ? "EXTREME" : matched.map(value => value.code).join("/");
        const badgeAssetPaths = isUnrestricted ? [] : matched.map(value => `layout/en/image/character/cha_type_icon_${value.assetCode}.png`);
        return {
            ...base, kind: "element", isUnrestricted, elementBitPattern, elementCodes: matched.map(value => value.code),
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
        const resolvedCategories = cardCategoryIds.map(id => {
            const row = categories.get(id);
            const name = text(row?.name);
            if (!row || !name) throw new Error(`Equipment limitation ${sourceRowId} references missing/unnamed category ${id}`);
            const relations = categoryRelationsByCategory.get(id);
            if (!relations?.length) throw new Error(`Equipment limitation ${sourceRowId} category ${id} has no first-party card relations`);
            return { id, name, eligibleCardCount: new Set(relations.map(relation => requiredId(relation, "card_id"))).size };
        });
        const badgeAssetPath = `${UI_ROOT}/equ_icon_category.png`;
        return { ...base, kind: "category", isUnrestricted: false, cardCategoryIds, resolvedCategories, presentation: { badgeLabel: "CAT", detailLabel: conciseNames(resolvedCategories.map(value => value.name)), badgeAssetPath, badgeAssetPaths: [badgeAssetPath] } };
    }
    if (rawType === "EquipmentSkillLimitation::CardLimitation") {
        const cardIds = exactConditionIds(rawConditions, "card_ids", `Equipment limitation ${sourceRowId}`);
        const canonicalOwnerCardIds = cardIds.map(id => {
            const ownerId = canonicalOwnerByCardId.get(id);
            if (!ownerId) throw new Error(`Equipment limitation ${sourceRowId} lacks an awakening owner for card ${id}`);
            return ownerId;
        });
        const resolvedCards = cardIds.map(id => {
            const row = cards.get(id);
            const name = text(row?.name);
            if (!row || !name) throw new Error(`Equipment limitation ${sourceRowId} references missing/unnamed card ${id}`);
            return { id, name };
        });
        const badgeAssetPath = `${UI_ROOT}/equ_icon_specific_chara.png`;
        return { ...base, kind: "card", isUnrestricted: false, cardIds, canonicalOwnerCardIds, resolvedCards, presentation: { badgeLabel: "UNIT", detailLabel: conciseNames(resolvedCards.map(value => value.name)), badgeAssetPath, badgeAssetPaths: [badgeAssetPath] } };
    }
    if (rawType === "EquipmentSkillLimitation::CardUniqueInfoSetLimitation") {
        const cardUniqueInfoSetIds = exactConditionIds(rawConditions, "card_unique_info_set_ids", `Equipment limitation ${sourceRowId}`);
        const resolvedCardUniqueInfoSets = cardUniqueInfoSetIds.map(id => {
            const relations = uniqueInfoRelationsBySet.get(id);
            if (!relations?.length) throw new Error(`Equipment limitation ${sourceRowId} references missing unique-info set ${id}`);
            const uniqueInfoIds = relations.map(relation => requiredId(relation, "card_unique_info_id", `Unique-info set ${id} relation`)).sort(numericCompare);
            if (new Set(uniqueInfoIds).size !== uniqueInfoIds.length) throw new Error(`Unique-info set ${id} repeats an identity`);
            const names = uniqueInfoIds.map(uniqueInfoId => {
                const name = text(uniqueInfos.get(uniqueInfoId)?.name);
                if (!name) throw new Error(`Unique-info set ${id} references missing/unnamed identity ${uniqueInfoId}`);
                return name;
            });
            const eligibleCardIds = [...new Set(uniqueInfoIds.flatMap(uniqueInfoId => (cardsByUniqueInfo.get(uniqueInfoId) ?? []).map(card => requiredId(card))))].sort(numericCompare);
            if (!eligibleCardIds.length) throw new Error(`Unique-info set ${id} expands to no eligible cards`);
            return { id, names, eligibleCardIds };
        });
        const badgeAssetPath = `${UI_ROOT}/equ_icon_same_chara.png`;
        return {
            ...base, kind: "card-unique-info-set", isUnrestricted: false, cardUniqueInfoSetIds, resolvedCardUniqueInfoSets,
            presentation: { badgeLabel: "CHAR", detailLabel: conciseNames(resolvedCardUniqueInfoSets.flatMap(value => value.names)), badgeAssetPath, badgeAssetPaths: [badgeAssetPath] },
        };
    }
    throw new Error(`Equipment limitation ${sourceRowId} has unsupported type ${rawType}`);
}

function addReverse(index: Map<string, Set<string>>, cardId: string, orbId: string): void {
    const values = index.get(cardId) ?? new Set<string>();
    values.add(orbId);
    index.set(cardId, values);
}

function materializeIndex(index: Map<string, Set<string>>): Record<string, string[]> {
    return Object.fromEntries([...index.entries()].sort(([left], [right]) => numericCompare(left, right)).map(([cardId, orbIds]) => [cardId, [...orbIds].sort(numericCompare)]));
}

export function computeAssetInventorySha256(assets: SkillOrbAssetEntry[]): string {
    const canonical = assets.map(asset => `${asset.path}\0${asset.sizeBytes}\0${asset.sha256}\0${asset.provenance}\0${asset.sourceFiles.join("\0")}`).join("\n");
    return createHash("sha256").update(canonical, "utf8").digest("hex");
}

export interface RequiredSkillOrbAssetPaths {
    foregroundIcons: string[],
    gradeBackgrounds: string[],
    levelAssets: string[],
    infinityAssets: string[],
    restrictionBadges: string[],
}

export function requiredSkillOrbAssetPaths(tables: Pick<SkillOrbSourceTables, "equipment_skill_items" | "equipment_skills">): RequiredSkillOrbAssetPaths {
    const effectRowsByItem = groupRows(tables.equipment_skills, "equipment_skill_item_id", "equipment_skills");
    const foregroundIcons = new Set<string>();
    const gradeBackgrounds = new Set<string>();
    const levelAssets = new Set<string>();
    const infinityAssets = new Set<string>();
    for (const item of tables.equipment_skill_items) {
        const itemId = requiredId(item);
        const iconImageId = requiredId(item, "icon_image_id", `Equipment Skill Orb ${itemId}.icon_image_id`);
        const grade = text(item.grade).toLowerCase();
        if (grade !== "bronze" && grade !== "silver" && grade !== "gold") throw new Error(`Equipment Skill Orb ${itemId} has unknown grade ${grade}`);
        foregroundIcons.add(`item/equipment/equ_item_${String(Number(iconImageId)).padStart(5, "0")}.png`);
        gradeBackgrounds.add(`layout/en/image/item/equipment/equipment_thumb_bg/equ_base_${grade}.png`);
        const effects = (effectRowsByItem.get(itemId) ?? []).map(row => {
            const potentialSkillId = optionalId(row, "potential_skill_id");
            const statusType = text(row.status_type).toLowerCase();
            const identity = potentialSkillId ? `potential:${potentialSkillId}` : `status:${statusType}`;
            const priority = EFFECT_PRIORITY.get(identity);
            if (!priority) throw new Error(`Equipment skill ${requiredId(row)} has unknown effect ${identity}`);
            return { level: positiveInteger(row.level, `Equipment skill ${requiredId(row)}.level`), priority, sourceRowId: requiredId(row) };
        }).sort((left, right) => right.priority - left.priority || numericCompare(left.sourceRowId, right.sourceRowId));
        if (!effects.length) throw new Error(`Equipment Skill Orb ${itemId} has no effects`);
        levelAssets.add(`derived/equipment/levels/lv-${effects.map(effect => effect.level).join("-")}.png`);
        const eternal = text(item.is_eternal);
        if (eternal !== "0" && eternal !== "1") throw new Error(`Equipment Skill Orb ${itemId} has unknown is_eternal ${eternal}`);
        if (eternal === "1") infinityAssets.add(`${UI_ROOT}/equ_infinite_icon_${grade}.png`);
    }
    const restrictionBadges = [
        ...ELEMENT_LIMITATION_BITS.map(value => `layout/en/image/character/cha_type_icon_${value.assetCode}.png`),
        `${UI_ROOT}/equ_icon_category.png`, `${UI_ROOT}/equ_icon_same_chara.png`, `${UI_ROOT}/equ_icon_specific_chara.png`,
    ];
    const sort = (values: Iterable<string>) => [...values].sort((left, right) => left.localeCompare(right, "en", { numeric: true }));
    return {
        foregroundIcons: sort(foregroundIcons), gradeBackgrounds: sort(gradeBackgrounds), levelAssets: sort(levelAssets),
        infinityAssets: sort(infinityAssets), restrictionBadges: sort(restrictionBadges),
    };
}

export function buildSkillOrbCatalog(options: {
    snapshotVersion: string,
    sourceDatabaseSha256: string,
    tables: SkillOrbSourceTables,
    assetInventory: SkillOrbAssetInventory,
}): SkillOrbCatalog {
    if (options.snapshotVersion !== PINNED_SKILL_ORB_PROFILE.snapshotVersion) throw new Error(`Unsupported Skill Orb snapshot ${options.snapshotVersion}`);
    if (options.sourceDatabaseSha256.toLowerCase() !== PINNED_SKILL_ORB_PROFILE.sourceDatabaseSha256) throw new Error("Skill Orb SQLite SHA-256 mismatch");
    const cards = uniqueRows(options.tables.cards, "cards");
    const categories = uniqueRows(options.tables.card_categories, "card_categories");
    const uniqueInfos = uniqueRows(options.tables.card_unique_infos, "card_unique_infos");
    const itemsById = uniqueRows(options.tables.equipment_skill_items, "equipment_skill_items");
    uniqueRows(options.tables.equipment_skills, "equipment_skills");
    uniqueRows(options.tables.equipment_skill_limitations, "equipment_skill_limitations");
    uniqueRows(options.tables.card_unique_info_set_relations, "card_unique_info_set_relations");
    const effectsByItem = groupRows(options.tables.equipment_skills, "equipment_skill_item_id", "equipment_skills");
    const limitationsBySet = groupRows(options.tables.equipment_skill_limitations, "equipment_skill_limitation_set_id", "equipment_skill_limitations");
    const uniqueInfoRelationsBySet = groupRows(options.tables.card_unique_info_set_relations, "card_unique_info_set_id", "card_unique_info_set_relations");
    const cardsByUniqueInfo = groupRows(options.tables.cards, "card_unique_info_id", "cards");
    const categoryRelationsByCategory = groupRows(
        options.tables.card_card_categories.filter(row => cards.has(requiredId(row, "card_id"))),
        "card_category_id",
        "card_card_categories",
    );
    const canonicalOwnerByCardId = canonicalAwakeningOwners(options.tables.card_awakening_routes, cards);

    for (const row of options.tables.equipment_skills) if (!itemsById.has(requiredId(row, "equipment_skill_item_id"))) throw new Error(`Equipment skill ${requiredId(row)} references a missing item`);
    for (const row of options.tables.card_unique_info_set_relations) if (!uniqueInfos.has(requiredId(row, "card_unique_info_id"))) throw new Error(`Unique-info relation ${requiredId(row)} references a missing identity`);
    for (const row of options.tables.cards) if (!uniqueInfos.has(requiredId(row, "card_unique_info_id"))) throw new Error(`Card ${requiredId(row)} references a missing unique identity`);
    uniqueRows(options.tables.card_card_categories, "card_card_categories");
    for (const row of options.tables.card_card_categories) {
        if (!categories.has(requiredId(row, "card_category_id"))) throw new Error(`Card-category relation ${requiredId(row)} references a missing category`);
    }

    const limitationSets = [...limitationsBySet.entries()].sort(([left], [right]) => numericCompare(left, right)).map(([setId, rows]): SkillOrbLimitationSet => {
        const conditions = [...rows].sort((left, right) => numericCompare(requiredId(left), requiredId(right)))
            .map(row => buildCondition(
                row,
                cards,
                categories,
                uniqueInfos,
                uniqueInfoRelationsBySet,
                cardsByUniqueInfo,
                categoryRelationsByCategory,
                canonicalOwnerByCardId,
            ));
        const isUnrestricted = conditions.some(condition => condition.isUnrestricted);
        const kinds = [...new Set(conditions.map(condition => condition.kind))];
        const presentation = kinds.length === 1 ? {
            badgeLabel: conditions[0].presentation.badgeLabel,
            detailLabel: conciseNames(conditions.map(condition => condition.presentation.detailLabel)),
            ...(conditions[0].presentation.badgeAssetPath ? { badgeAssetPath: conditions[0].presentation.badgeAssetPath } : {}),
            ...(conditions[0].presentation.badgeAssetPaths ? { badgeAssetPaths: conditions[0].presentation.badgeAssetPaths } : {}),
        } : { badgeLabel: isUnrestricted ? "ALL" : "ANY", detailLabel: conciseNames(conditions.map(condition => condition.presentation.detailLabel)) };
        return { id: setId, combination: "any", conditions, isUnrestricted, presentation };
    });
    const limitationSetById = new Map(limitationSets.map(value => [value.id, value]));

    const items = [...itemsById.values()].sort((left, right) => numericCompare(requiredId(left), requiredId(right))).map((row): SkillOrbItem => {
        const itemId = requiredId(row);
        const name = text(row.name);
        const description = text(row.description);
        if (!name || !description) throw new Error(`Equipment Skill Orb ${itemId} has empty official text`);
        const grade = text(row.grade).toLowerCase() as SkillOrbGrade;
        if (grade !== "bronze" && grade !== "silver" && grade !== "gold") throw new Error(`Equipment Skill Orb ${itemId} has unknown grade ${grade}`);
        const iconImageId = requiredId(row, "icon_image_id", `Equipment Skill Orb ${itemId}.icon_image_id`);
        const limitationSetId = requiredId(row, "equipment_skill_limitation_set_id", `Equipment Skill Orb ${itemId}.limitationSetId`);
        if (!limitationSetById.has(limitationSetId)) throw new Error(`Equipment Skill Orb ${itemId} references missing limitation set ${limitationSetId}`);
        const effectRows = effectsByItem.get(itemId) ?? [];
        if (!effectRows.length) throw new Error(`Equipment Skill Orb ${itemId} has no effects`);
        const effectsWithPriority = effectRows.map(effectRow => {
            const sourceRowId = requiredId(effectRow);
            const potentialSkillId = optionalId(effectRow, "potential_skill_id");
            const statusType = text(effectRow.status_type).toLowerCase();
            if (Boolean(potentialSkillId) === Boolean(statusType)) throw new Error(`Equipment skill ${sourceRowId} must have exactly one typed identity`);
            if (statusType && statusType !== "hp" && statusType !== "attack" && statusType !== "defense") throw new Error(`Equipment skill ${sourceRowId} has unknown status_type ${statusType}`);
            const identity = potentialSkillId ? `potential:${potentialSkillId}` : `status:${statusType}`;
            const priority = EFFECT_PRIORITY.get(identity);
            const label = EFFECT_LABEL.get(identity);
            if (!priority || !label) throw new Error(`Equipment skill ${sourceRowId} has unknown effect ${identity}`);
            const value = statusType ? nonNegativeInteger(row[statusType], `Equipment Skill Orb ${itemId}.${statusType}`) : undefined;
            if (statusType && !value) throw new Error(`Equipment skill ${sourceRowId} has no positive ${statusType} value`);
            const effect: SkillOrbEffect = {
                sourceRowId,
                ...(potentialSkillId ? { potentialSkillId } : {}),
                ...(statusType ? { statusType: statusType as "hp" | "attack" | "defense" } : {}),
                level: positiveInteger(effectRow.level, `Equipment skill ${sourceRowId}.level`),
                ...(value ? { value } : {}),
                label,
            };
            return { effect, priority };
        }).sort((left, right) => right.priority - left.priority || numericCompare(left.effect.sourceRowId, right.effect.sourceRowId));
        const effects = effectsWithPriority.map(value => value.effect);
        for (const effect of effects) {
            if (!effect.label || !`${name}\n${description}`.includes(effect.label)) {
                throw new Error(`Equipment skill ${effect.sourceRowId} label is not corroborated by official item text`);
            }
        }
        const isEternalRaw = text(row.is_eternal);
        if (isEternalRaw !== "0" && isEternalRaw !== "1") throw new Error(`Equipment Skill Orb ${itemId} has unknown is_eternal ${isEternalRaw}`);
        const isEternal = isEternalRaw === "1";
        return {
            id: itemId, name, description, grade, iconImageId,
            iconAssetPath: `item/equipment/equ_item_${String(Number(iconImageId)).padStart(5, "0")}.png`,
            backgroundAssetPath: `layout/en/image/item/equipment/equipment_thumb_bg/equ_base_${grade}.png`,
            isEternal,
            ...(isEternal ? { infinityAssetPath: `${UI_ROOT}/equ_infinite_icon_${grade}.png` } : {}),
            effects,
            levelAssetPath: levelAssetPath(effects),
            limitationSetId,
        };
    });

    const exact = new Map<string, Set<string>>();
    const family = new Map<string, Set<string>>();
    const exclusive = new Map<string, Set<string>>();
    for (const item of items) {
        const limitation = limitationSetById.get(item.limitationSetId)!;
        for (const condition of limitation.conditions) {
            if (condition.kind === "card") for (const cardId of condition.cardIds ?? []) addReverse(exact, cardId, item.id);
            if (condition.kind === "card-unique-info-set") {
                for (const cardId of condition.resolvedCardUniqueInfoSets?.flatMap(value => value.eligibleCardIds) ?? []) addReverse(family, cardId, item.id);
            }
        }
        if (!limitation.isUnrestricted && limitation.conditions.length === 1) {
            const condition = limitation.conditions[0];
            if (condition.kind === "card") {
                const owners = [...new Set(condition.canonicalOwnerCardIds ?? [])];
                if (owners.length === 1) addReverse(exclusive, owners[0], item.id);
            }
        }
    }
    const restrictedCategoryIds = new Set(limitationSets.flatMap(set => set.conditions.flatMap(condition => condition.cardCategoryIds ?? [])));
    const categoryEligibleCardId = Object.fromEntries([...restrictedCategoryIds].sort(numericCompare).map(categoryId => {
        const cardIds = [...new Set((categoryRelationsByCategory.get(categoryId) ?? []).map(row => requiredId(row, "card_id")))].sort(numericCompare);
        if (!cardIds.length) throw new Error(`Restricted category ${categoryId} has no eligible cards`);
        return [categoryId, cardIds];
    }));
    const catalog: SkillOrbCatalog = {
        schemaVersion: 1,
        parserVersion: SKILL_ORB_CONTRACT_VERSION,
        provenance: { snapshotVersion: options.snapshotVersion, sourceDatabaseSha256: options.sourceDatabaseSha256.toLowerCase() },
        items,
        limitationSets,
        indexes: {
            exactCardId: materializeIndex(exact),
            familyEligibleCardId: materializeIndex(family),
            categoryEligibleCardId,
            exclusiveOwnerCardId: materializeIndex(exclusive),
        },
        assetInventory: options.assetInventory,
    };
    validateSkillOrbCatalog(catalog);
    return catalog;
}

function countBy<T extends string>(values: T[]): Record<T, number> {
    const result = {} as Record<T, number>;
    for (const value of values) result[value] = (result[value] ?? 0) + 1;
    return result;
}

function equalCounts(actual: Record<string, number>, expected: Record<string, number>, context: string): void {
    for (const [key, value] of Object.entries(expected)) if (actual[key] !== value) throw new Error(`${context}.${key}: expected ${value}, observed ${actual[key] ?? 0}`);
}

export function validateSkillOrbCatalog(catalog: SkillOrbCatalog): void {
    if (catalog.schemaVersion !== 1 || !["1.0.0", "1.1.0", SKILL_ORB_CONTRACT_VERSION].includes(catalog.parserVersion)) throw new Error("Unsupported Skill Orb contract");
    if (catalog.provenance.snapshotVersion !== PINNED_SKILL_ORB_PROFILE.snapshotVersion || catalog.provenance.sourceDatabaseSha256 !== PINNED_SKILL_ORB_PROFILE.sourceDatabaseSha256) throw new Error("Skill Orb provenance mismatch");
    if (catalog.items.length !== PINNED_SKILL_ORB_PROFILE.itemCount) throw new Error(`Expected ${PINNED_SKILL_ORB_PROFILE.itemCount} Skill Orbs`);
    if (Math.max(...catalog.items.map(item => Number(item.id))) !== PINNED_SKILL_ORB_PROFILE.maxItemId) throw new Error("Unexpected maximum Skill Orb ID");
    if (catalog.items.some(item => !item.name.trim() || !item.description.trim())) throw new Error("Skill Orb official text must not be empty");
    for (const item of catalog.items) {
        for (const effect of item.effects) {
            const isStatus = Boolean(effect.statusType);
            if (catalog.parserVersion === SKILL_ORB_CONTRACT_VERSION && isStatus !== Boolean(effect.value && effect.value > 0)) {
                throw new Error(`Skill Orb ${item.id} effect value mismatch`);
            }
            if (!isStatus && effect.value !== undefined) throw new Error(`Potential effect ${effect.sourceRowId} cannot have a flat value`);
        }
    }
    const effectCount = catalog.items.reduce((sum, item) => sum + item.effects.length, 0);
    if (effectCount !== PINNED_SKILL_ORB_PROFILE.effectRowCount) throw new Error(`Unexpected effect count ${effectCount}`);
    const single = catalog.items.filter(item => item.effects.length === 1).length;
    const dual = catalog.items.filter(item => item.effects.length === 2).length;
    if (single !== PINNED_SKILL_ORB_PROFILE.singleEffectItemCount || dual !== PINNED_SKILL_ORB_PROFILE.dualEffectItemCount || single + dual !== catalog.items.length) throw new Error("Unexpected single/dual effect distribution");
    if (catalog.items.filter(item => item.isEternal).length !== PINNED_SKILL_ORB_PROFILE.eternalItemCount) throw new Error("Unexpected reusable Skill Orb count");
    equalCounts(countBy(catalog.items.map(item => item.grade)), PINNED_SKILL_ORB_PROFILE.gradeCounts, "gradeCounts");
    if (catalog.limitationSets.length !== PINNED_SKILL_ORB_PROFILE.limitationSetCount) throw new Error("Unexpected limitation set count");
    const limitationRows = catalog.limitationSets.flatMap(set => set.conditions);
    if (limitationRows.length !== PINNED_SKILL_ORB_PROFILE.limitationRowCount) throw new Error("Unexpected limitation row count");
    const requireSortedIds = (ids: string[] | undefined, context: string) => {
        if (ids && [...ids].sort(numericCompare).join(",") !== ids.join(",")) throw new Error(`Non-deterministic ${context}`);
    };
    for (const row of limitationRows) {
        requireSortedIds(row.cardCategoryIds, "cardCategoryIds");
        requireSortedIds(row.cardIds, "cardIds");
        requireSortedIds(row.cardUniqueInfoSetIds, "cardUniqueInfoSetIds");
        for (const resolved of row.resolvedCardUniqueInfoSets ?? []) requireSortedIds(resolved.eligibleCardIds, `eligibleCardIds for set ${resolved.id}`);
        if (row.resolvedCards && row.resolvedCards.map(value => value.id).join(",") !== (row.cardIds ?? []).join(",")) throw new Error("Resolved exact-card targets are not aligned");
        if (catalog.parserVersion === SKILL_ORB_CONTRACT_VERSION && row.kind === "card"
            && row.canonicalOwnerCardIds?.length !== row.cardIds?.length) throw new Error("Canonical exact-card owners are not aligned");
        if (row.resolvedCategories && row.resolvedCategories.map(value => value.id).join(",") !== (row.cardCategoryIds ?? []).join(",")) throw new Error("Resolved category targets are not aligned");
        if (row.resolvedCardUniqueInfoSets && row.resolvedCardUniqueInfoSets.map(value => value.id).join(",") !== (row.cardUniqueInfoSetIds ?? []).join(",")) throw new Error("Resolved family targets are not aligned");
    }
    const setById = new Map(catalog.limitationSets.map(set => [set.id, set]));
    if (setById.size !== catalog.limitationSets.length) throw new Error("Duplicate normalized limitation set");
    equalCounts(countBy(limitationRows.map(row => row.kind)), PINNED_SKILL_ORB_PROFILE.limitationRowsByKind, "limitationRowsByKind");
    equalCounts(countBy(catalog.items.map(item => setById.get(item.limitationSetId)!.conditions[0].kind)), PINNED_SKILL_ORB_PROFILE.itemCountsByLimitationKind, "itemCountsByLimitationKind");
    const exactRows = limitationRows.filter(row => row.kind === "card");
    const exactReferences = exactRows.flatMap(row => row.cardIds ?? []);
    if (exactReferences.length !== PINNED_SKILL_ORB_PROFILE.exactCardReferenceCount || new Set(exactReferences).size !== PINNED_SKILL_ORB_PROFILE.exactUniqueCardCount) throw new Error("Unexpected exact-card limitation coverage");
    if (limitationRows.filter(row => row.kind === "card-unique-info-set").length !== 7) throw new Error("Unexpected unique-info set limitation coverage");
    if (new Set(catalog.items.map(item => item.iconImageId)).size !== PINNED_SKILL_ORB_PROFILE.foregroundIconCount) throw new Error("Unexpected foreground icon count");
    if (new Set(catalog.items.map(item => item.levelAssetPath)).size !== PINNED_SKILL_ORB_PROFILE.levelCombinationCount) throw new Error("Unexpected level asset combination count");
    const itemIds = new Set(catalog.items.map(item => item.id));
    const validateIndex = (index: Record<string, string[]>, kind: "card" | "card-unique-info-set") => {
        for (const [cardId, orbIds] of Object.entries(index)) {
            if (!/^\d+$/.test(cardId) || !orbIds.length || new Set(orbIds).size !== orbIds.length) throw new Error(`Invalid ${kind} reverse index entry ${cardId}`);
            if ([...orbIds].sort(numericCompare).join(",") !== orbIds.join(",") || orbIds.some(id => !itemIds.has(id))) throw new Error(`Invalid ${kind} reverse index values ${cardId}`);
        }
    };
    validateIndex(catalog.indexes.exactCardId, "card");
    validateIndex(catalog.indexes.familyEligibleCardId, "card-unique-info-set");
    if (catalog.parserVersion === SKILL_ORB_CONTRACT_VERSION) {
        const categoryIndex = catalog.indexes.categoryEligibleCardId;
        if (!categoryIndex) throw new Error("Missing category eligibility index");
        const expectedCategoryIds = [...new Set(limitationRows.flatMap(row => row.cardCategoryIds ?? []))].sort(numericCompare);
        if (Object.keys(categoryIndex).join(",") !== expectedCategoryIds.join(",")) throw new Error("Category eligibility index keys mismatch");
        for (const [categoryId, cardIds] of Object.entries(categoryIndex)) {
            if (!cardIds.length || new Set(cardIds).size !== cardIds.length || [...cardIds].sort(numericCompare).join(",") !== cardIds.join(",")) {
                throw new Error(`Invalid category eligibility index entry ${categoryId}`);
            }
        }
        const expectedExclusive = new Map<string, Set<string>>();
        for (const item of catalog.items) {
            const set = setById.get(item.limitationSetId)!;
            if (set.isUnrestricted || set.conditions.length !== 1 || set.conditions[0].kind !== "card") continue;
            const owners = [...new Set(set.conditions[0].canonicalOwnerCardIds ?? [])];
            if (owners.length === 1) addReverse(expectedExclusive, owners[0], item.id);
        }
        const exclusiveIndex = catalog.indexes.exclusiveOwnerCardId;
        if (!exclusiveIndex || JSON.stringify(exclusiveIndex) !== JSON.stringify(materializeIndex(expectedExclusive))) {
            throw new Error("Exclusive owner index mismatch");
        }
    }
    const assets = catalog.assetInventory.assets;
    if ([...assets].sort((a, b) => a.path.localeCompare(b.path, "en", { numeric: true })).map(a => a.path).join("\n") !== assets.map(a => a.path).join("\n")) throw new Error("Skill Orb assets are not deterministically ordered");
    if (new Set(assets.map(asset => asset.path)).size !== assets.length || assets.some(asset => !/^[a-f0-9]{64}$/.test(asset.sha256) || asset.sizeBytes <= 0)) throw new Error("Invalid Skill Orb asset inventory");
    if (catalog.assetInventory.inventorySha256 !== computeAssetInventorySha256(assets) || catalog.assetInventory.totalBytes !== assets.reduce((sum, asset) => sum + asset.sizeBytes, 0)) throw new Error("Skill Orb asset inventory digest mismatch");
    const counts = catalog.assetInventory.counts;
    const expectedAssetCounts = { foregroundIcons: 122, gradeBackgrounds: 3, levelAssets: 50, infinityAssets: 3, restrictionBadges: 18, total: 196 };
    equalCounts(counts, expectedAssetCounts, "assetCounts");
}
