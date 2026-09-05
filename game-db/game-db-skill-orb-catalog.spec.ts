import { deepStrictEqual, equal, match, ok, throws } from "assert";
import { resolve } from "path";
import { GameDbSourceConfig, readGameDbTable } from "./game-db-source";
import {
    buildSkillOrbCatalog,
    computeAssetInventorySha256,
    PINNED_SKILL_ORB_PROFILE,
    requiredSkillOrbAssetPaths,
    SkillOrbAssetEntry,
    SkillOrbAssetInventory,
    SkillOrbCatalog,
    SkillOrbSourceTables,
} from "./game-db-skill-orb-catalog";

const SOURCE_DATA_DIR = resolve(process.cwd(), "game-db", "data", "first-party-complete-source", "1788329250-wp01", "data");
const TABLE_NAMES: Array<keyof SkillOrbSourceTables> = [
    "cards", "card_card_categories", "card_categories", "card_unique_infos", "card_unique_info_set_relations",
    "equipment_skill_items", "equipment_skill_limitations", "equipment_skills",
];

async function loadTables(): Promise<SkillOrbSourceTables> {
    const config: GameDbSourceConfig = { sourceRoot: SOURCE_DATA_DIR, dataDir: SOURCE_DATA_DIR };
    return Object.fromEntries(await Promise.all(TABLE_NAMES.map(async table => [table, await readGameDbTable(config, table)] as const))) as unknown as SkillOrbSourceTables;
}

function fakeAssetInventory(tables: SkillOrbSourceTables): SkillOrbAssetInventory {
    const paths = requiredSkillOrbAssetPaths(tables);
    const assets: SkillOrbAssetEntry[] = Object.values(paths).flat().sort((left, right) => left.localeCompare(right, "en", { numeric: true })).map(path => ({
        path, sizeBytes: 1, sha256: "0".repeat(64), provenance: path.startsWith("derived/") ? "official-cpk-derived" : "official-cpk", sourceFiles: ["fixture.cpk"],
    }));
    return {
        assets,
        counts: {
            foregroundIcons: paths.foregroundIcons.length, gradeBackgrounds: paths.gradeBackgrounds.length,
            levelAssets: paths.levelAssets.length, infinityAssets: paths.infinityAssets.length,
            restrictionBadges: paths.restrictionBadges.length, total: assets.length,
        },
        totalBytes: assets.length,
        inventorySha256: computeAssetInventorySha256(assets),
    };
}

function build(tables: SkillOrbSourceTables): SkillOrbCatalog {
    return buildSkillOrbCatalog({
        snapshotVersion: PINNED_SKILL_ORB_PROFILE.snapshotVersion,
        sourceDatabaseSha256: PINNED_SKILL_ORB_PROFILE.sourceDatabaseSha256,
        tables,
        assetInventory: fakeAssetInventory(tables),
    });
}

describe("first-party Skill Orb catalog", () => {
    let source: SkillOrbSourceTables;
    let catalog: SkillOrbCatalog;

    before(async () => {
        source = await loadTables();
        catalog = build(source);
    });

    it("matches the pinned complete corpus and native effect order", () => {
        equal(catalog.items.length, 8751);
        equal(catalog.items.reduce((sum, item) => sum + item.effects.length, 0), 14021);
        equal(catalog.items.filter(item => item.effects.length === 1).length, 3481);
        equal(catalog.items.filter(item => item.effects.length === 2).length, 5270);
        equal(catalog.items.filter(item => item.isEternal).length, 5060);
        deepStrictEqual(Object.fromEntries(["bronze", "silver", "gold"].map(grade => [grade, catalog.items.filter(item => item.grade === grade).length])), { bronze: 2183, silver: 2786, gold: 3782 });
        equal(catalog.limitationSets.length, 310);
        equal(catalog.limitationSets.reduce((sum, set) => sum + set.conditions.length, 0), 310);
        equal(catalog.assetInventory.assets.length, 196);
        equal(catalog.assetInventory.counts.foregroundIcons, 122);
        equal(catalog.assetInventory.counts.levelAssets, 50);
        ok(catalog.items.every(item => item.name.length > 0 && item.description.length > 0));
        const order = new Map([["potential:2", 10], ["potential:1", 9], ["potential:7", 8], ["potential:4", 7], ["potential:5", 6], ["potential:6", 5], ["potential:3", 4], ["status:hp", 3], ["status:attack", 2], ["status:defense", 1]]);
        for (const item of catalog.items) {
            const priorities = item.effects.map(effect => order.get(effect.potentialSkillId ? `potential:${effect.potentialSkillId}` : `status:${effect.statusType}`)!);
            deepStrictEqual(priorities, [...priorities].sort((left, right) => right - left));
        }
    });

    it("replays byte-for-byte and keeps all collections and indexes deterministic", () => {
        const replay = build(source);
        equal(JSON.stringify(replay), JSON.stringify(catalog));
        const numeric = (left: string, right: string) => Number(left) - Number(right);
        deepStrictEqual(catalog.items.map(item => item.id), [...catalog.items.map(item => item.id)].sort(numeric));
        deepStrictEqual(catalog.limitationSets.map(set => set.id), [...catalog.limitationSets.map(set => set.id)].sort(numeric));
        for (const condition of catalog.limitationSets.flatMap(set => set.conditions)) {
            for (const ids of [condition.cardCategoryIds, condition.cardIds, condition.cardUniqueInfoSetIds]) {
                if (ids) deepStrictEqual(ids, [...ids].sort(numeric));
            }
            if (condition.resolvedCards) deepStrictEqual(condition.resolvedCards.map(value => value.id), condition.cardIds);
            if (condition.resolvedCategories) deepStrictEqual(condition.resolvedCategories.map(value => value.id), condition.cardCategoryIds);
            for (const resolved of condition.resolvedCardUniqueInfoSets ?? []) deepStrictEqual(resolved.eligibleCardIds, [...resolved.eligibleCardIds].sort(numeric));
        }
        for (const index of [catalog.indexes.exactCardId, catalog.indexes.familyEligibleCardId]) {
            deepStrictEqual(Object.keys(index), [...Object.keys(index)].sort(numeric));
            for (const values of Object.values(index)) deepStrictEqual(values, [...values].sort(numeric));
        }
    });

    it("matches exact-card exclusivity by card ID even when official text contains names and titles", () => {
        const exactCondition = catalog.limitationSets.flatMap(set => set.conditions.map(condition => ({ set, condition }))).find(value => value.condition.kind === "card")!;
        const exactOrbIds = catalog.items.filter(item => item.limitationSetId === exactCondition.set.id).map(item => item.id);
        const targetCardId = exactCondition.condition.cardIds![0];
        const excludedCard = source.cards.find(card => card.id !== targetCardId)!;
        const fixture: SkillOrbSourceTables = {
            ...source,
            cards: source.cards.map(card => card.id === excludedCard.id ? { ...card, name: `${source.cards.find(value => value.id === targetCardId)!.name} — misleading title fixture` } : card),
            equipment_skill_items: source.equipment_skill_items.map(item => item.equipment_skill_limitation_set_id === exactCondition.set.id ? { ...item, description: `${item.description}\n${excludedCard.name}` } : item),
        };
        const result = build(fixture);
        for (const orbId of exactOrbIds) {
            ok(result.indexes.exactCardId[targetCardId].includes(orbId));
            ok(!(result.indexes.exactCardId[excludedCard.id] ?? []).includes(orbId));
        }
    });

    it("expands the Goku family structurally and excludes substring-only cards", () => {
        const family = catalog.limitationSets.flatMap(set => set.conditions.map(condition => ({ set, condition })))
            .find(value => value.condition.kind === "card-unique-info-set" && value.condition.resolvedCardUniqueInfoSets!.some(set => set.names.some(name => name.includes("Goku"))))!;
        const familyOrbIds = catalog.items.filter(item => item.limitationSetId === family.set.id).map(item => item.id);
        const eligibleIds = new Set(family.condition.resolvedCardUniqueInfoSets!.flatMap(set => set.eligibleCardIds));
        const excludedCard = source.cards.find(card => !eligibleIds.has(card.id))!;
        const fixture: SkillOrbSourceTables = { ...source, cards: source.cards.map(card => card.id === excludedCard.id ? { ...card, name: "Goku substring-only fixture" } : card) };
        const result = build(fixture);
        const eligibleCardId = [...eligibleIds][0];
        for (const orbId of familyOrbIds) {
            ok(result.indexes.familyEligibleCardId[eligibleCardId].includes(orbId));
            ok(!(result.indexes.familyEligibleCardId[excludedCard.id] ?? []).includes(orbId));
        }
    });

    it("fails closed on unknown bitpatterns, effect identities, and asset inventory drift", () => {
        const elementRow = source.equipment_skill_limitations.find(row => row.type === "EquipmentSkillLimitation::ElementLimitation")!;
        throws(() => build({ ...source, equipment_skill_limitations: source.equipment_skill_limitations.map(row => row.id === elementRow.id ? { ...row, conditions: "{\"element_bitpattern\":32}" } : row) }), /unknown element bitpattern/);
        const effectRow = source.equipment_skills[0];
        throws(() => build({ ...source, equipment_skills: source.equipment_skills.map(row => row.id === effectRow.id ? { ...row, potential_skill_id: "999", status_type: "" } : row) }), /unknown effect/);
        const inventory = fakeAssetInventory(source);
        inventory.assets[0] = { ...inventory.assets[0], sizeBytes: 2 };
        throws(() => buildSkillOrbCatalog({ snapshotVersion: PINNED_SKILL_ORB_PROFILE.snapshotVersion, sourceDatabaseSha256: PINNED_SKILL_ORB_PROFILE.sourceDatabaseSha256, tables: source, assetInventory: inventory }), /inventory digest mismatch/);
    });
});
