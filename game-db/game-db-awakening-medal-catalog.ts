import { createHash } from "crypto";
import { gzipSync } from "zlib";
import { PortraitSpec, Rarities } from "../character";
import { portraitSpecFromOfficialCard } from "./portrait-asset-contract";
import { GameDbRow, normalizeDbId } from "./game-db-source";

export const AWAKENING_MEDAL_CONTRACT = "dokkan-awakening-medal-catalog";
export const AWAKENING_MEDAL_CONTRACT_VERSION = "1.1.0";

export type AwakeningMedalRarity = "bronze" | "silver" | "gold" | "rainbow" | "super";

export interface AwakeningMedalCatalogItem {
    id: string,
    name: string,
    description: string,
    rarity: AwakeningMedalRarity,
    rarityRaw: number,
    zeni: number,
    sellingExchangePoint: number,
    eventJumpable: boolean,
    iconAssetPath: string,
}

export type AwakeningRouteKind = "z-awaken" | "dokkan-awaken" | "eza" | "seza";

export interface AwakeningRouteCard {
    id: string,
    characterId: string,
    name: string,
    rarity: Rarities,
    rarityRaw: number,
    elementRaw: number,
    resourceId?: string,
    openAt?: string,
    portraitSpec: PortraitSpec,
}

export interface AwakeningRouteRequirement {
    rowId: string,
    ordinalRaw: number,
    itemId: string,
    quantity: number,
}

export interface AwakeningRoute {
    id: string,
    kind: AwakeningRouteKind,
    routeTypeRaw: string,
    sourceCardId: string,
    targetCardId: string,
    setId: string,
    openAt?: string,
    optimalAwakeningTypeRaw?: number,
    optimalAwakeningStepRaw?: number,
    optimalAwakeningGrowthId?: string,
    requirements: AwakeningRouteRequirement[],
}

export interface AwakeningRouteGraph {
    cards: AwakeningRouteCard[],
    routes: AwakeningRoute[],
}

export interface AwakeningMedalSourceTables {
    awakening_items: GameDbRow[],
    cards: GameDbRow[],
    card_awakening_routes: GameDbRow[],
    card_awakening_sets: GameDbRow[],
    card_awakenings: GameDbRow[],
    optimal_awakening_growths: GameDbRow[],
}

export interface AwakeningMedalCatalog {
    schemaVersion: 1,
    contract: typeof AWAKENING_MEDAL_CONTRACT,
    contractVersion: typeof AWAKENING_MEDAL_CONTRACT_VERSION,
    datasetVersion: string,
    generatedAt: string,
    source: "dokkan-game-db",
    sourceSnapshotVersion: string,
    sourceDatabaseSha256: string,
    assetBaseUrl: string,
    count: number,
    countsByRarity: Record<AwakeningMedalRarity, number>,
    items: AwakeningMedalCatalogItem[],
    routeGraph: AwakeningRouteGraph,
}

export interface AwakeningMedalManifest {
    schemaVersion: 1,
    contract: typeof AWAKENING_MEDAL_CONTRACT,
    contractVersion: typeof AWAKENING_MEDAL_CONTRACT_VERSION,
    datasetVersion: string,
    generatedAt: string,
    source: "dokkan-game-db",
    sourceSnapshotVersion: string,
    sourceDatabaseSha256: string,
    count: number,
    countsByRarity: Record<AwakeningMedalRarity, number>,
    routeCardCount: number,
    routeCount: number,
    payload: {
        objectKey: string,
        sha256: string,
        sizeBytes: number,
        expandedSizeBytes: number,
        contentType: "application/json",
        contentEncoding: "gzip",
    },
}

export interface AwakeningMedalDelivery {
    catalog: AwakeningMedalCatalog,
    bytes: Buffer,
    gzip: Buffer,
    manifest: AwakeningMedalManifest,
}

const RARITIES: AwakeningMedalRarity[] = ["bronze", "silver", "gold", "rainbow", "super"];
const RARITY_BY_RAW: Record<number, AwakeningMedalRarity> = {
    0: "bronze",
    1: "silver",
    2: "gold",
    3: "rainbow",
    4: "super",
};

export function buildAwakeningMedalCatalog(options: {
    tables: AwakeningMedalSourceTables,
    generatedAt: string,
    sourceSnapshotVersion: string,
    sourceDatabaseSha256: string,
    assetBaseUrl: string,
}): AwakeningMedalCatalog {
    requireIsoDate(options.generatedAt);
    requireNonEmpty(options.sourceSnapshotVersion, "source snapshot version");
    if (!/^[a-f0-9]{64}$/.test(options.sourceDatabaseSha256)) {
        throw new Error("Awakening Medal source database SHA-256 is invalid");
    }
    if (!/^https:\/\/[^\s]+$/.test(options.assetBaseUrl)) {
        throw new Error("Awakening Medal asset base URL must be HTTPS");
    }

    const seen = new Set<string>();
    const items = options.tables.awakening_items.map((row, index) => {
        const id = normalizeDbId(row.id);
        if (!id || !/^[1-9]\d*$/.test(id)) throw new Error(`awakening_items[${index}].id must be a canonical positive numeric ID`);
        if (seen.has(id)) throw new Error(`Duplicate Awakening Medal ID ${id}`);
        seen.add(id);
        const rarityRaw = requireInteger(row.rarity, `awakening_items[${index}].rarity`, 0, 4);
        const rarity = RARITY_BY_RAW[rarityRaw];
        return {
            id,
            name: requireNonEmpty(row.name, `awakening_items[${index}].name`),
            description: requireNonEmpty(row.description, `awakening_items[${index}].description`),
            rarity,
            rarityRaw,
            zeni: requireInteger(row.zeni, `awakening_items[${index}].zeni`, 0),
            sellingExchangePoint: requireInteger(
                row.selling_exchange_point,
                `awakening_items[${index}].selling_exchange_point`,
                0,
            ),
            eventJumpable: requireBooleanInteger(row.event_jumpable, `awakening_items[${index}].event_jumpable`),
            iconAssetPath: `item/awaken/en/thumb/thumb_awaken_items_${id.padStart(5, "0")}/thumb_awaken_items_${id.padStart(5, "0")}.png`,
        };
    }).sort((left, right) => Number(left.id) - Number(right.id));

    if (items.length === 0) throw new Error("Awakening Medal catalog must not be empty");
    const countsByRarity = Object.fromEntries(RARITIES.map(rarity => [
        rarity,
        items.filter(item => item.rarity === rarity).length,
    ])) as Record<AwakeningMedalRarity, number>;
    const routeGraph = buildAwakeningRouteGraph(options.tables, items);
    const identity = JSON.stringify({
        sourceSnapshotVersion: options.sourceSnapshotVersion,
        sourceDatabaseSha256: options.sourceDatabaseSha256,
        assetBaseUrl: options.assetBaseUrl.replace(/\/+$/, ""),
        items,
        routeGraph,
    });
    const datasetVersion = `${options.sourceSnapshotVersion}-${createHash("sha256").update(identity).digest("hex").slice(0, 12)}`;
    const catalog: AwakeningMedalCatalog = {
        schemaVersion: 1,
        contract: AWAKENING_MEDAL_CONTRACT,
        contractVersion: AWAKENING_MEDAL_CONTRACT_VERSION,
        datasetVersion,
        generatedAt: options.generatedAt,
        source: "dokkan-game-db",
        sourceSnapshotVersion: options.sourceSnapshotVersion,
        sourceDatabaseSha256: options.sourceDatabaseSha256,
        assetBaseUrl: options.assetBaseUrl.replace(/\/+$/, ""),
        count: items.length,
        countsByRarity,
        items,
        routeGraph,
    };
    validateAwakeningMedalCatalog(catalog);
    return catalog;
}

export function buildAwakeningMedalDelivery(catalog: AwakeningMedalCatalog, compressionLevel = 9): AwakeningMedalDelivery {
    validateAwakeningMedalCatalog(catalog);
    if (!Number.isSafeInteger(compressionLevel) || compressionLevel < 1 || compressionLevel > 9) {
        throw new Error("Awakening Medal compression level must be an integer from 1 to 9");
    }
    const bytes = Buffer.from(JSON.stringify(catalog), "utf8");
    const gzip = gzipSync(bytes, { level: compressionLevel });
    const sha256 = createHash("sha256").update(gzip).digest("hex");
    return {
        catalog,
        bytes,
        gzip,
        manifest: {
            schemaVersion: 1,
            contract: AWAKENING_MEDAL_CONTRACT,
            contractVersion: AWAKENING_MEDAL_CONTRACT_VERSION,
            datasetVersion: catalog.datasetVersion,
            generatedAt: catalog.generatedAt,
            source: "dokkan-game-db",
            sourceSnapshotVersion: catalog.sourceSnapshotVersion,
            sourceDatabaseSha256: catalog.sourceDatabaseSha256,
            count: catalog.count,
            countsByRarity: catalog.countsByRarity,
            routeCardCount: catalog.routeGraph.cards.length,
            routeCount: catalog.routeGraph.routes.length,
            payload: {
                objectKey: `awakening-medals/objects/${sha256}.json.gz`,
                sha256,
                sizeBytes: gzip.byteLength,
                expandedSizeBytes: bytes.byteLength,
                contentType: "application/json",
                contentEncoding: "gzip",
            },
        },
    };
}

export function validateAwakeningMedalCatalog(catalog: AwakeningMedalCatalog): void {
    if (catalog.schemaVersion !== 1 || catalog.contract !== AWAKENING_MEDAL_CONTRACT
        || catalog.contractVersion !== AWAKENING_MEDAL_CONTRACT_VERSION || catalog.source !== "dokkan-game-db") {
        throw new Error("Awakening Medal catalog contract is unsupported");
    }
    requireIsoDate(catalog.generatedAt);
    if (catalog.count !== catalog.items.length) throw new Error("Awakening Medal catalog count mismatch");
    const ids = new Set<string>();
    let previousId = -1;
    for (const item of catalog.items) {
        if (!/^[1-9]\d*$/.test(item.id) || ids.has(item.id)) throw new Error(`Invalid or duplicate Awakening Medal ID ${item.id}`);
        ids.add(item.id);
        const numericId = Number(item.id);
        if (numericId <= previousId) throw new Error("Awakening Medal items must be sorted by numeric ID");
        previousId = numericId;
        if (RARITY_BY_RAW[item.rarityRaw] !== item.rarity) throw new Error(`Awakening Medal ${item.id} rarity mismatch`);
        const expected = `item/awaken/en/thumb/thumb_awaken_items_${item.id.padStart(5, "0")}/thumb_awaken_items_${item.id.padStart(5, "0")}.png`;
        if (item.iconAssetPath !== expected) throw new Error(`Awakening Medal ${item.id} icon path mismatch`);
    }
    for (const rarity of RARITIES) {
        if (catalog.countsByRarity[rarity] !== catalog.items.filter(item => item.rarity === rarity).length) {
            throw new Error(`Awakening Medal ${rarity} count mismatch`);
        }
    }
    validateAwakeningRouteGraph(catalog.routeGraph, catalog.items);
}

function buildAwakeningRouteGraph(
    tables: AwakeningMedalSourceTables,
    items: AwakeningMedalCatalogItem[],
): AwakeningRouteGraph {
    uniqueRows(tables.cards, "cards");
    uniqueRows(tables.card_awakening_routes, "card_awakening_routes");
    uniqueRows(tables.card_awakening_sets, "card_awakening_sets");
    uniqueRows(tables.card_awakenings, "card_awakenings");
    uniqueRows(tables.optimal_awakening_growths, "optimal_awakening_growths");

    const cardsById = new Map(tables.cards.map(row => [requiredId(row.id, "cards.id"), row]));
    const setIds = new Set(tables.card_awakening_sets.map(row => requiredId(row.id, "card_awakening_sets.id")));
    const itemsById = new Map(items.map(item => [item.id, item]));
    const requirementsBySet = new Map<string, GameDbRow[]>();
    for (const row of tables.card_awakenings) {
        const setId = requiredId(row.card_awakening_set_id, "card_awakenings.card_awakening_set_id");
        if (!setIds.has(setId)) throw new Error(`Awakening requirement references missing set ${setId}`);
        requirementsBySet.set(setId, [...(requirementsBySet.get(setId) ?? []), row]);
    }
    const growthByTypeAndStep = new Map<string, string>();
    for (const row of tables.optimal_awakening_growths) {
        const growType = requireInteger(row.optimal_awakening_grow_type, "optimal_awakening_growths.optimal_awakening_grow_type", 1);
        const step = requireInteger(row.step, "optimal_awakening_growths.step", 1);
        const key = `${growType}:${step}`;
        if (growthByTypeAndStep.has(key)) throw new Error(`Duplicate optimal awakening growth ${key}`);
        growthByTypeAndStep.set(key, requiredId(row.id, "optimal_awakening_growths.id"));
    }

    const referencedCardIds = new Set<string>();
    const routes = tables.card_awakening_routes.map((row, index): AwakeningRoute => {
        const id = requiredId(row.id, `card_awakening_routes[${index}].id`);
        const sourceCardId = requiredId(row.card_id, `card_awakening_routes[${index}].card_id`);
        const targetCardId = requiredId(row.awaked_card_id, `card_awakening_routes[${index}].awaked_card_id`);
        if (!cardsById.has(sourceCardId) || !cardsById.has(targetCardId)) {
            throw new Error(`Awakening route ${id} references a missing card`);
        }
        referencedCardIds.add(sourceCardId);
        referencedCardIds.add(targetCardId);
        const setId = requiredId(row.card_awakening_set_id, `card_awakening_routes[${index}].card_awakening_set_id`);
        if (!setIds.has(setId)) throw new Error(`Awakening route ${id} references missing set ${setId}`);
        const requirementRows = requirementsBySet.get(setId);
        if (!requirementRows?.length) throw new Error(`Awakening route ${id} has no requirements`);
        const requirements = requirementRows.map(requirement => {
            const itemId = requiredId(requirement.awakening_item_id, `card_awakenings.${requirement.id}.awakening_item_id`);
            if (!itemsById.has(itemId)) throw new Error(`Awakening route ${id} references missing item ${itemId}`);
            return {
                rowId: requiredId(requirement.id, "card_awakenings.id"),
                ordinalRaw: requireInteger(requirement.num, `card_awakenings.${requirement.id}.num`, 0),
                itemId,
                quantity: requireInteger(requirement.quantity, `card_awakenings.${requirement.id}.quantity`, 1),
            };
        }).sort((left, right) => left.ordinalRaw - right.ordinalRaw || Number(left.rowId) - Number(right.rowId));
        const routeTypeRaw = requireNonEmpty(row.type, `card_awakening_routes[${index}].type`);
        const route = classifyRoute(
            routeTypeRaw,
            row,
            cardsById.get(sourceCardId)!,
            growthByTypeAndStep,
            id,
        );
        return {
            id,
            kind: route.kind,
            routeTypeRaw,
            sourceCardId,
            targetCardId,
            setId,
            ...optionalText(row.open_at, "openAt"),
            ...route.fields,
            requirements,
        };
    }).sort((left, right) => Number(left.id) - Number(right.id));

    const cards = [...referencedCardIds].map(cardId => {
        const row = cardsById.get(cardId)!;
        const rarityRaw = requireInteger(row.rarity, `cards.${cardId}.rarity`, 0, 5);
        const rarity = Object.values(Rarities)[rarityRaw];
        const elementRaw = requireInteger(row.element, `cards.${cardId}.element`, 0, 24);
        if (Math.floor(elementRaw / 10) > 2 || elementRaw % 10 > 4) {
            throw new Error(`cards.${cardId}.element is unsupported`);
        }
        const resourceId = normalizeDbId(row.resource_id);
        return {
            id: cardId,
            characterId: requiredId(row.character_id, `cards.${cardId}.character_id`),
            name: requireNonEmpty(row.name, `cards.${cardId}.name`),
            rarity,
            rarityRaw,
            elementRaw,
            ...(resourceId ? { resourceId } : {}),
            ...optionalText(row.open_at, "openAt"),
            portraitSpec: portraitSpecFromOfficialCard(cardId, rarity, String(elementRaw), resourceId || undefined),
        };
    }).sort((left, right) => Number(left.id) - Number(right.id));
    const graph = { cards, routes };
    validateAwakeningRouteGraph(graph, items);
    return graph;
}

function classifyRoute(
    routeTypeRaw: string,
    row: GameDbRow,
    sourceCard: GameDbRow,
    growthByTypeAndStep: ReadonlyMap<string, string>,
    routeId: string,
): { kind: AwakeningRouteKind, fields: Partial<AwakeningRoute> } {
    if (routeTypeRaw === "CardAwakeningRoute::Zet") return { kind: "z-awaken", fields: {} };
    if (routeTypeRaw === "CardAwakeningRoute::Dokkan") return { kind: "dokkan-awaken", fields: {} };
    if (routeTypeRaw !== "CardAwakeningRoute::Optimal") throw new Error(`Awakening route ${routeId} has unknown type`);
    const optimalAwakeningTypeRaw = requireInteger(row.optimal_awakening_type, `route ${routeId} optimal type`, 1, 2);
    const optimalAwakeningStepRaw = requireInteger(row.optimal_awakening_step, `route ${routeId} optimal step`, 1);
    const growType = requireInteger(sourceCard.optimal_awakening_grow_type, `route ${routeId} card grow type`, 1);
    const growthKey = `${growType}:${optimalAwakeningStepRaw}`;
    const optimalAwakeningGrowthId = growthByTypeAndStep.get(growthKey);
    if (!optimalAwakeningGrowthId) throw new Error(`Awakening route ${routeId} is missing optimal growth ${growthKey}`);
    return {
        kind: optimalAwakeningTypeRaw === 1 ? "eza" : "seza",
        fields: {
            optimalAwakeningTypeRaw,
            optimalAwakeningStepRaw,
            optimalAwakeningGrowthId,
        },
    };
}

function validateAwakeningRouteGraph(graph: AwakeningRouteGraph, items: AwakeningMedalCatalogItem[]): void {
    if (!graph || !Array.isArray(graph.cards) || !Array.isArray(graph.routes) || graph.routes.length === 0) {
        throw new Error("Awakening route graph must not be empty");
    }
    const cardIds = new Set(graph.cards.map(card => card.id));
    const itemsById = new Map(items.map(item => [item.id, item]));
    const routeIds = new Set<string>();
    const outgoing = new Map<string, string>();
    const incoming = new Map<string, string>();
    const optimalSteps = new Set<string>();
    for (const route of graph.routes) {
        if (!/^[1-9]\d*$/.test(route.id) || routeIds.has(route.id)) throw new Error(`Invalid Awakening route ID ${route.id}`);
        routeIds.add(route.id);
        if (!cardIds.has(route.sourceCardId) || !cardIds.has(route.targetCardId)) throw new Error(`Awakening route ${route.id} card mismatch`);
        if (route.requirements.length === 0 || route.requirements.some(requirement => !itemsById.has(requirement.itemId))) {
            throw new Error(`Awakening route ${route.id} requirement mismatch`);
        }
        const sameCard = route.sourceCardId === route.targetCardId;
        if ((route.kind === "eza" || route.kind === "seza") !== sameCard) {
            throw new Error(`Awakening route ${route.id} identity policy mismatch`);
        }
        if (route.kind === "eza" || route.kind === "seza") {
            if (!route.optimalAwakeningGrowthId || route.optimalAwakeningTypeRaw == null || route.optimalAwakeningStepRaw == null) {
                throw new Error(`Awakening route ${route.id} optimal fields are incomplete`);
            }
            const stepKey = `${route.sourceCardId}:${route.kind}:${route.optimalAwakeningStepRaw}`;
            if (optimalSteps.has(stepKey)) throw new Error(`Duplicate Awakening optimal step ${stepKey}`);
            optimalSteps.add(stepKey);
        } else if (route.optimalAwakeningGrowthId || route.optimalAwakeningTypeRaw != null || route.optimalAwakeningStepRaw != null) {
            throw new Error(`Awakening route ${route.id} has unexpected optimal fields`);
        } else {
            if (outgoing.has(route.sourceCardId)) throw new Error(`Awakening route graph branches at ${route.sourceCardId}`);
            if (incoming.has(route.targetCardId)) throw new Error(`Awakening route graph merges at ${route.targetCardId}`);
            outgoing.set(route.sourceCardId, route.targetCardId);
            incoming.set(route.targetCardId, route.sourceCardId);
        }
    }
    for (const start of outgoing.keys()) {
        const visited = new Set<string>();
        let current: string | undefined = start;
        while (current && outgoing.has(current)) {
            if (visited.has(current)) throw new Error(`Awakening route graph cycles at ${current}`);
            visited.add(current);
            current = outgoing.get(current);
        }
    }
}

function uniqueRows(rows: GameDbRow[], label: string): void {
    const ids = new Set<string>();
    for (const row of rows) {
        const id = requiredId(row.id, `${label}.id`);
        if (ids.has(id)) throw new Error(`${label} has duplicate ID ${id}`);
        ids.add(id);
    }
}

function requiredId(value: unknown, label: string): string {
    const id = normalizeDbId(typeof value === "string" ? value : String(value ?? ""));
    if (!id || !/^[1-9]\d*$/.test(id)) throw new Error(`${label} must be a canonical positive numeric ID`);
    return id;
}

function optionalText(value: unknown, key: string): Record<string, string> {
    const text = typeof value === "string" ? value.trim() : String(value ?? "").trim();
    return text ? { [key]: text } : {};
}

function requireNonEmpty(value: unknown, label: string): string {
    const normalized = typeof value === "string" ? value.trim() : String(value ?? "").trim();
    if (!normalized) throw new Error(`${label} must be non-empty`);
    return normalized;
}

function requireInteger(value: unknown, label: string, minimum: number, maximum = Number.MAX_SAFE_INTEGER): number {
    const parsed = typeof value === "number" ? value : Number(value);
    if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) throw new Error(`${label} must be an integer from ${minimum} to ${maximum}`);
    return parsed;
}

function requireBooleanInteger(value: unknown, label: string): boolean {
    const parsed = requireInteger(value, label, 0, 1);
    return parsed === 1;
}

function requireIsoDate(value: string): void {
    if (!value || Number.isNaN(Date.parse(value))) throw new Error("Awakening Medal generatedAt is invalid");
}
