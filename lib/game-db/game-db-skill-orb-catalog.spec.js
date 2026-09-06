"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const path_1 = require("path");
const game_db_source_1 = require("./game-db-source");
const game_db_skill_orb_catalog_1 = require("./game-db-skill-orb-catalog");
const SOURCE_DATA_DIR = (0, path_1.resolve)(process.cwd(), "game-db", "data", "first-party-complete-source", "1788329250-wp01", "data");
const TABLE_NAMES = [
    "cards", "card_card_categories", "card_categories", "card_unique_infos", "card_unique_info_set_relations",
    "card_awakening_routes",
    "equipment_skill_items", "equipment_skill_limitations", "equipment_skills",
];
async function loadTables() {
    const config = { sourceRoot: SOURCE_DATA_DIR, dataDir: SOURCE_DATA_DIR };
    return Object.fromEntries(await Promise.all(TABLE_NAMES.map(async (table) => [table, await (0, game_db_source_1.readGameDbTable)(config, table)])));
}
function fakeAssetInventory(tables) {
    const paths = (0, game_db_skill_orb_catalog_1.requiredSkillOrbAssetPaths)(tables);
    const assets = Object.values(paths).flat().sort((left, right) => left.localeCompare(right, "en", { numeric: true })).map(path => ({
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
        inventorySha256: (0, game_db_skill_orb_catalog_1.computeAssetInventorySha256)(assets),
    };
}
function build(tables) {
    return (0, game_db_skill_orb_catalog_1.buildSkillOrbCatalog)({
        snapshotVersion: game_db_skill_orb_catalog_1.PINNED_SKILL_ORB_PROFILE.snapshotVersion,
        sourceDatabaseSha256: game_db_skill_orb_catalog_1.PINNED_SKILL_ORB_PROFILE.sourceDatabaseSha256,
        tables,
        assetInventory: fakeAssetInventory(tables),
    });
}
describe("first-party Skill Orb catalog", () => {
    let source;
    let catalog;
    before(async () => {
        source = await loadTables();
        catalog = build(source);
    });
    it("matches the pinned complete corpus and native effect order", () => {
        (0, assert_1.equal)(catalog.items.length, 8751);
        (0, assert_1.equal)(catalog.items.reduce((sum, item) => sum + item.effects.length, 0), 14021);
        (0, assert_1.equal)(catalog.items.filter(item => item.effects.length === 1).length, 3481);
        (0, assert_1.equal)(catalog.items.filter(item => item.effects.length === 2).length, 5270);
        (0, assert_1.equal)(catalog.items.filter(item => item.isEternal).length, 5060);
        (0, assert_1.deepStrictEqual)(Object.fromEntries(["bronze", "silver", "gold"].map(grade => [grade, catalog.items.filter(item => item.grade === grade).length])), { bronze: 2183, silver: 2786, gold: 3782 });
        (0, assert_1.equal)(catalog.limitationSets.length, 310);
        (0, assert_1.equal)(catalog.limitationSets.reduce((sum, set) => sum + set.conditions.length, 0), 310);
        (0, assert_1.equal)(catalog.assetInventory.assets.length, 196);
        (0, assert_1.equal)(catalog.assetInventory.counts.foregroundIcons, 122);
        (0, assert_1.equal)(catalog.assetInventory.counts.levelAssets, 50);
        (0, assert_1.ok)(catalog.items.every(item => item.name.length > 0 && item.description.length > 0));
        const order = new Map([["potential:2", 10], ["potential:1", 9], ["potential:7", 8], ["potential:4", 7], ["potential:5", 6], ["potential:6", 5], ["potential:3", 4], ["status:hp", 3], ["status:attack", 2], ["status:defense", 1]]);
        for (const item of catalog.items) {
            const priorities = item.effects.map(effect => order.get(effect.potentialSkillId ? `potential:${effect.potentialSkillId}` : `status:${effect.statusType}`));
            (0, assert_1.deepStrictEqual)(priorities, [...priorities].sort((left, right) => right - left));
            for (const effect of item.effects) {
                (0, assert_1.equal)(effect.statusType ? Number(effect.value) > 0 : effect.value === undefined, true);
            }
        }
    });
    it("replays byte-for-byte and keeps all collections and indexes deterministic", () => {
        const replay = build(source);
        (0, assert_1.equal)(JSON.stringify(replay), JSON.stringify(catalog));
        const numeric = (left, right) => Number(left) - Number(right);
        (0, assert_1.deepStrictEqual)(catalog.items.map(item => item.id), [...catalog.items.map(item => item.id)].sort(numeric));
        (0, assert_1.deepStrictEqual)(catalog.limitationSets.map(set => set.id), [...catalog.limitationSets.map(set => set.id)].sort(numeric));
        for (const condition of catalog.limitationSets.flatMap(set => set.conditions)) {
            for (const ids of [condition.cardCategoryIds, condition.cardIds, condition.cardUniqueInfoSetIds]) {
                if (ids)
                    (0, assert_1.deepStrictEqual)(ids, [...ids].sort(numeric));
            }
            if (condition.resolvedCards)
                (0, assert_1.deepStrictEqual)(condition.resolvedCards.map(value => value.id), condition.cardIds);
            if (condition.resolvedCategories)
                (0, assert_1.deepStrictEqual)(condition.resolvedCategories.map(value => value.id), condition.cardCategoryIds);
            for (const resolved of condition.resolvedCardUniqueInfoSets ?? [])
                (0, assert_1.deepStrictEqual)(resolved.eligibleCardIds, [...resolved.eligibleCardIds].sort(numeric));
        }
        for (const index of [catalog.indexes.exactCardId, catalog.indexes.familyEligibleCardId, catalog.indexes.categoryEligibleCardId, catalog.indexes.exclusiveOwnerCardId]) {
            (0, assert_1.deepStrictEqual)(Object.keys(index), [...Object.keys(index)].sort(numeric));
            for (const values of Object.values(index))
                (0, assert_1.deepStrictEqual)(values, [...values].sort(numeric));
        }
    });
    it("projects flat stat values and structural category eligibility", () => {
        const attackItem = catalog.items.find(item => item.effects.some(effect => effect.statusType === "attack"));
        const attackEffect = attackItem.effects.find(effect => effect.statusType === "attack");
        const sourceItem = source.equipment_skill_items.find(item => item.id === attackItem.id);
        (0, assert_1.equal)(attackEffect.value, Number(sourceItem.attack));
        const categoryCondition = catalog.limitationSets.flatMap(set => set.conditions)
            .find(condition => condition.kind === "category");
        const categoryId = categoryCondition.cardCategoryIds[0];
        const expected = [...new Set(source.card_card_categories
                .filter(row => row.card_category_id === categoryId)
                .map(row => row.card_id))].sort((left, right) => Number(left) - Number(right));
        (0, assert_1.deepStrictEqual)(catalog.indexes.categoryEligibleCardId[categoryId], expected);
    });
    it("derives exclusive owners from first-party awakening routes and excludes shared sets", () => {
        const borgos = catalog.limitationSets.find(set => set.id === "23");
        (0, assert_1.deepStrictEqual)(borgos.conditions[0].cardIds, ["1019161", "1019170", "1019171"]);
        (0, assert_1.deepStrictEqual)(borgos.conditions[0].canonicalOwnerCardIds, ["1019171", "1019171", "1019171"]);
        const borgosOrbIds = catalog.items.filter(item => item.limitationSetId === "23").map(item => item.id);
        (0, assert_1.deepStrictEqual)(catalog.indexes.exclusiveOwnerCardId["1019171"], borgosOrbIds);
        const shared = catalog.limitationSets.find(set => set.id === "64");
        (0, assert_1.ok)(new Set(shared.conditions[0].canonicalOwnerCardIds).size > 1);
        const sharedOrbIds = new Set(catalog.items.filter(item => item.limitationSetId === "64").map(item => item.id));
        (0, assert_1.ok)(Object.values(catalog.indexes.exclusiveOwnerCardId).every(ids => ids.every(id => !sharedOrbIds.has(id))));
    });
    it("matches exact-card exclusivity by card ID even when official text contains names and titles", () => {
        const exactCondition = catalog.limitationSets.flatMap(set => set.conditions.map(condition => ({ set, condition }))).find(value => value.condition.kind === "card");
        const exactOrbIds = catalog.items.filter(item => item.limitationSetId === exactCondition.set.id).map(item => item.id);
        const targetCardId = exactCondition.condition.cardIds[0];
        const excludedCard = source.cards.find(card => card.id !== targetCardId);
        const fixture = {
            ...source,
            cards: source.cards.map(card => card.id === excludedCard.id ? { ...card, name: `${source.cards.find(value => value.id === targetCardId).name} — misleading title fixture` } : card),
            equipment_skill_items: source.equipment_skill_items.map(item => item.equipment_skill_limitation_set_id === exactCondition.set.id ? { ...item, description: `${item.description}\n${excludedCard.name}` } : item),
        };
        const result = build(fixture);
        for (const orbId of exactOrbIds) {
            (0, assert_1.ok)(result.indexes.exactCardId[targetCardId].includes(orbId));
            (0, assert_1.ok)(!(result.indexes.exactCardId[excludedCard.id] ?? []).includes(orbId));
        }
    });
    it("expands the Goku family structurally and excludes substring-only cards", () => {
        const family = catalog.limitationSets.flatMap(set => set.conditions.map(condition => ({ set, condition })))
            .find(value => value.condition.kind === "card-unique-info-set" && value.condition.resolvedCardUniqueInfoSets.some(set => set.names.some(name => name.includes("Goku"))));
        const familyOrbIds = catalog.items.filter(item => item.limitationSetId === family.set.id).map(item => item.id);
        const eligibleIds = new Set(family.condition.resolvedCardUniqueInfoSets.flatMap(set => set.eligibleCardIds));
        const excludedCard = source.cards.find(card => !eligibleIds.has(card.id));
        const fixture = { ...source, cards: source.cards.map(card => card.id === excludedCard.id ? { ...card, name: "Goku substring-only fixture" } : card) };
        const result = build(fixture);
        const eligibleCardId = [...eligibleIds][0];
        for (const orbId of familyOrbIds) {
            (0, assert_1.ok)(result.indexes.familyEligibleCardId[eligibleCardId].includes(orbId));
            (0, assert_1.ok)(!(result.indexes.familyEligibleCardId[excludedCard.id] ?? []).includes(orbId));
        }
    });
    it("fails closed on unknown bitpatterns, effect identities, and asset inventory drift", () => {
        const elementRow = source.equipment_skill_limitations.find(row => row.type === "EquipmentSkillLimitation::ElementLimitation");
        (0, assert_1.throws)(() => build({ ...source, equipment_skill_limitations: source.equipment_skill_limitations.map(row => row.id === elementRow.id ? { ...row, conditions: "{\"element_bitpattern\":32}" } : row) }), /unknown element bitpattern/);
        const effectRow = source.equipment_skills[0];
        (0, assert_1.throws)(() => build({ ...source, equipment_skills: source.equipment_skills.map(row => row.id === effectRow.id ? { ...row, potential_skill_id: "999", status_type: "" } : row) }), /unknown effect/);
        (0, assert_1.throws)(() => build({ ...source, cards: [...source.cards, { ...source.cards[0], id: "9999992" }] }), /unsupported card release-state variant/i);
        const inventory = fakeAssetInventory(source);
        inventory.assets[0] = { ...inventory.assets[0], sizeBytes: 2 };
        (0, assert_1.throws)(() => (0, game_db_skill_orb_catalog_1.buildSkillOrbCatalog)({ snapshotVersion: game_db_skill_orb_catalog_1.PINNED_SKILL_ORB_PROFILE.snapshotVersion, sourceDatabaseSha256: game_db_skill_orb_catalog_1.PINNED_SKILL_ORB_PROFILE.sourceDatabaseSha256, tables: source, assetInventory: inventory }), /inventory digest mismatch/);
    });
});
//# sourceMappingURL=game-db-skill-orb-catalog.spec.js.map