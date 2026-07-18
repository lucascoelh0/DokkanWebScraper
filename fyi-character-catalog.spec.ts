import { deepEqual, equal } from "assert";
import {
    duplicateGroupsByAwakeningLine,
    mapCharacterCatalogEntryFromFyi,
    uniqueCatalogEntries,
} from "./fyi-character-catalog";

describe("dokkan.fyi character catalog", () => {
    it("maps latest-state catalog metadata into stable app-facing references", () => {
        const entry = mapCharacterCatalogEntryFromFyi({
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

        equal(entry.id, "1033941");
        equal(entry.baseCharacterId, "1033941");
        equal(entry.releaseDates?.latestType, "initial");
        equal(entry.sourceUrl, "https://dokkan.fyi/characters/1033941");
        equal(entry.hasBattleMotion, true);
    });

    it("deduplicates repeated page rows by real card id", () => {
        const first = mapCharacterCatalogEntryFromFyi({ id: 1, base_character_id: 1, name: "A" });
        const duplicate = mapCharacterCatalogEntryFromFyi({ id: 1, base_character_id: 1, name: "A updated" });
        const second = mapCharacterCatalogEntryFromFyi({ id: 2, base_character_id: 1, name: "A alternate" });

        const unique = uniqueCatalogEntries([first, duplicate, second]);

        equal(unique.length, 2);
        equal(unique.find(entry => entry.id === "1")?.name, "A");
    });

    it("reports awakening lines that contain more than one catalog state", () => {
        const entries = [
            mapCharacterCatalogEntryFromFyi({ id: 10, base_character_id: 10, name: "A" }),
            mapCharacterCatalogEntryFromFyi({ id: 11, base_character_id: 10, name: "A" }),
            mapCharacterCatalogEntryFromFyi({ id: 20, base_character_id: 20, name: "B" }),
        ];

        deepEqual(duplicateGroupsByAwakeningLine(entries), [["10", "11"]]);
    });
});
