"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const fyi_character_catalog_1 = require("./fyi-character-catalog");
describe("dokkan.fyi character catalog", () => {
    it("maps latest-state catalog metadata into stable app-facing references", () => {
        const entry = (0, fyi_character_catalog_1.mapCharacterCatalogEntryFromFyi)({
            id: 1033941,
            canonical_id: 2001,
            character_id: 4001,
            base_character_id: 1033941,
            name: "Turles",
            rarity: 4,
            rarity_text: "UR",
            type: 3,
            type_text: "TEQ",
            awakening_type: 1,
            awakening_type_text: "Super",
            thumbnail_id: 1033940,
            release_dates: {
                initial: "2026-01-01T00:00:00Z",
                latest: "2026-01-01T00:00:00Z",
                latest_type: "initial",
                eza: null,
                seza: null,
            },
            has_eza: false,
            has_seza: false,
            is_reversibly_exchanged: false,
            is_freely_obtainable: false,
            is_stage_drop_reward: false,
            is_world_tournament_reward: false,
            has_battle_motion: true,
        });
        (0, assert_1.equal)(entry.id, "1033941");
        (0, assert_1.equal)(entry.baseCharacterId, "1033941");
        (0, assert_1.equal)(entry.releaseDates?.latestType, "initial");
        (0, assert_1.equal)(entry.sourceUrl, "https://dokkan.fyi/characters/1033941");
        (0, assert_1.equal)(entry.hasBattleMotion, true);
    });
    it("deduplicates repeated page rows by real card id", () => {
        const first = (0, fyi_character_catalog_1.mapCharacterCatalogEntryFromFyi)({ id: 1, base_character_id: 1, name: "A" });
        const duplicate = (0, fyi_character_catalog_1.mapCharacterCatalogEntryFromFyi)({ id: 1, base_character_id: 1, name: "A updated" });
        const second = (0, fyi_character_catalog_1.mapCharacterCatalogEntryFromFyi)({ id: 2, base_character_id: 1, name: "A alternate" });
        const unique = (0, fyi_character_catalog_1.uniqueCatalogEntries)([first, duplicate, second]);
        (0, assert_1.equal)(unique.length, 2);
        (0, assert_1.equal)(unique.find(entry => entry.id === "1")?.name, "A");
    });
    it("reports awakening lines that contain more than one catalog state", () => {
        const entries = [
            (0, fyi_character_catalog_1.mapCharacterCatalogEntryFromFyi)({ id: 10, base_character_id: 10, name: "A" }),
            (0, fyi_character_catalog_1.mapCharacterCatalogEntryFromFyi)({ id: 11, base_character_id: 10, name: "A" }),
            (0, fyi_character_catalog_1.mapCharacterCatalogEntryFromFyi)({ id: 20, base_character_id: 20, name: "B" }),
        ];
        (0, assert_1.deepEqual)((0, fyi_character_catalog_1.duplicateGroupsByAwakeningLine)(entries), [["10", "11"]]);
    });
});
//# sourceMappingURL=fyi-character-catalog.spec.js.map