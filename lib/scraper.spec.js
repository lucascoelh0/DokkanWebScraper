"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const mocha_1 = require("mocha");
const zlib_1 = require("zlib");
const dataset_artifacts_1 = require("./dataset-artifacts");
const scraper_1 = require("./scraper");
(0, mocha_1.describe)("parseLeaderSkillDetails", function () {
    (0, mocha_1.it)("parses category leaders with additional category boosts", () => {
        const details = (0, scraper_1.parseLeaderSkillDetails)(`"Power Beyond Super Saiyan" or "Movie Heroes" Category Ki +3 and HP, ATK & DEF +170%, plus an additional HP, ATK & DEF +30% for characters who also belong to the "Kamehameha" Category`);
        (0, assert_1.equal)(details?.displayBoost, 200);
        (0, assert_1.equal)(details?.clauses.length, 2);
        (0, assert_1.deepEqual)(details?.clauses[0], {
            rawText: `"Power Beyond Super Saiyan" or "Movie Heroes" Category Ki +3 and HP, ATK & DEF +170%`,
            stackGroup: "primary",
            targetMode: "base",
            categories: ["Power Beyond Super Saiyan", "Movie Heroes"],
            ki: 3,
            hp: 170,
            atk: 170,
            def: 170,
            boostForm: "percentage",
        });
        (0, assert_1.deepEqual)(details?.clauses[1], {
            rawText: `HP, ATK & DEF +30% for characters who also belong to the "Kamehameha" Category`,
            stackGroup: "additional",
            targetMode: "also-belong",
            categories: ["Kamehameha"],
            hp: 30,
            atk: 30,
            def: 30,
            boostForm: "percentage",
        });
    });
    (0, mocha_1.it)("parses mixed percentage boosts and preserves the display boost used by the app", () => {
        const details = (0, scraper_1.parseLeaderSkillDetails)(`"DAIMA", "Battle of Fate" or "Goku's Family" Category Ki +3, HP +200% and ATK & DEF +170%, plus an additional HP, ATK & DEF +50% for characters who also belong to the "Dragon Ball Seekers", "Full Power" or "Kamehameha" Category`);
        (0, assert_1.equal)(details?.displayBoost, 230);
        (0, assert_1.equal)(details?.clauses.length, 2);
        (0, assert_1.deepEqual)(details?.clauses[0], {
            rawText: `"DAIMA", "Battle of Fate" or "Goku's Family" Category Ki +3, HP +200% and ATK & DEF +170%`,
            stackGroup: "primary",
            targetMode: "base",
            categories: ["DAIMA", "Battle of Fate", "Goku's Family"],
            ki: 3,
            hp: 200,
            atk: 170,
            def: 170,
            boostForm: "percentage",
        });
        (0, assert_1.deepEqual)(details?.clauses[1], {
            rawText: `HP, ATK & DEF +50% for characters who also belong to the "Dragon Ball Seekers", "Full Power" or "Kamehameha" Category`,
            stackGroup: "additional",
            targetMode: "also-belong",
            categories: ["Dragon Ball Seekers", "Full Power", "Kamehameha"],
            hp: 50,
            atk: 50,
            def: 50,
            boostForm: "percentage",
        });
    });
    (0, mocha_1.it)("parses super class leader skills", () => {
        const details = (0, scraper_1.parseLeaderSkillDetails)(`Super Class Ki +3 and HP, ATK & DEF +130%`);
        (0, assert_1.equal)(details?.displayBoost, 130);
        (0, assert_1.deepEqual)(details?.clauses, [{
                rawText: `Super Class Ki +3 and HP, ATK & DEF +130%`,
                stackGroup: "primary",
                targetMode: "base",
                classes: ["Super"],
                ki: 3,
                hp: 130,
                atk: 130,
                def: 130,
                boostForm: "percentage",
            }]);
    });
    (0, mocha_1.it)("parses category or all type leaders as separate clauses", () => {
        const details = (0, scraper_1.parseLeaderSkillDetails)(`"Worthy Rivals" Category Ki +4 and HP, ATK & DEF +150%; or Type Ki +4 and HP, ATK & DEF +100%`);
        (0, assert_1.equal)(details?.displayBoost, 150);
        (0, assert_1.equal)(details?.clauses.length, 2);
        (0, assert_1.deepEqual)(details?.clauses[0], {
            rawText: `"Worthy Rivals" Category Ki +4 and HP, ATK & DEF +150%`,
            stackGroup: "primary",
            targetMode: "base",
            categories: ["Worthy Rivals"],
            ki: 4,
            hp: 150,
            atk: 150,
            def: 150,
            boostForm: "percentage",
        });
        (0, assert_1.deepEqual)(details?.clauses[1], {
            rawText: `Type Ki +4 and HP, ATK & DEF +100%`,
            stackGroup: "secondary",
            targetMode: "base",
            types: ["All"],
            ki: 4,
            hp: 100,
            atk: 100,
            def: 100,
            boostForm: "percentage",
        });
    });
    (0, mocha_1.it)("captures team-wide class and type conditions without polluting per-character targets", () => {
        const details = (0, scraper_1.parseLeaderSkillDetails)(`All allies' Ki +2, HP +150% and ATK & DEF +100% when team includes Super & Extreme Classes, plus an additional Ki +1 and HP, ATK & DEF +70% when team includes all five Types`);
        (0, assert_1.equal)(details?.clauses.length, 2);
        (0, assert_1.deepEqual)(details?.clauses[0], {
            rawText: `All allies' Ki +2, HP +150% and ATK & DEF +100% when team includes Super & Extreme Classes`,
            stackGroup: "primary",
            targetMode: "base",
            teamConditions: [{
                    rawText: `when team includes Super & Extreme Classes`,
                    kind: "requires-classes",
                    classes: ["Super", "Extreme"],
                    requiresAll: true,
                    requiredCount: 2,
                }],
            ki: 2,
            hp: 150,
            atk: 100,
            def: 100,
            boostForm: "percentage",
        });
        (0, assert_1.deepEqual)(details?.clauses[1], {
            rawText: `Ki +1 and HP, ATK & DEF +70% when team includes all five Types`,
            stackGroup: "additional",
            targetMode: "base",
            teamConditions: [{
                    rawText: `when team includes all five Types`,
                    kind: "requires-types",
                    types: ["AGL", "TEQ", "INT", "STR", "PHY"],
                    requiresAll: true,
                    requiredCount: 5,
                }],
            ki: 1,
            hp: 70,
            atk: 70,
            def: 70,
            boostForm: "percentage",
        });
    });
    (0, mocha_1.it)("captures class-filtered all-five-types conditions separately from the target clause", () => {
        const details = (0, scraper_1.parseLeaderSkillDetails)(`Super Type allies' HP, ATK & DEF +30% when team includes all five Super Types`);
        (0, assert_1.deepEqual)(details?.clauses, [{
                rawText: `Super Type allies' HP, ATK & DEF +30% when team includes all five Super Types`,
                stackGroup: "primary",
                targetMode: "base",
                types: ["All"],
                classes: ["Super"],
                teamConditions: [{
                        rawText: `when team includes all five Super Types`,
                        kind: "requires-types",
                        types: ["AGL", "TEQ", "INT", "STR", "PHY"],
                        classFilter: "Super",
                        requiresAll: true,
                        requiredCount: 5,
                    }],
                hp: 30,
                atk: 30,
                def: 30,
                boostForm: "percentage",
            }]);
    });
});
(0, mocha_1.describe)("isSellingOnlyLeaderSkill", function () {
    (0, mocha_1.it)("flags DokkanInfo selling-only placeholder cards", () => {
        (0, assert_1.equal)((0, scraper_1.isSellingOnlyLeaderSkill)("A character for selling"), true);
    });
    (0, mocha_1.it)("does not flag normal leader skills", () => {
        (0, assert_1.equal)((0, scraper_1.isSellingOnlyLeaderSkill)(`Super Class Ki +3 and HP, ATK & DEF +130%`), false);
    });
});
(0, mocha_1.describe)("filterBaseAwakeningDuplicates", function () {
    (0, mocha_1.it)("keeps the original rarity stage but preserves the pre-TUR UR and later Dokkan awakenings", () => {
        const filtered = (0, scraper_1.filterBaseAwakeningDuplicates)([
            {
                id: 1033810,
                name: "Super Saiyan God Goku",
                rarity: 3,
                lv_max: 80,
                element: "30",
                asset_id: 1033810,
            },
            {
                id: 1033811,
                name: "Super Saiyan God Goku",
                rarity: 4,
                lv_max: 100,
                element: "30",
                asset_id: 1033810,
            },
            {
                id: 1033821,
                name: "Super Saiyan God Goku",
                rarity: 4,
                lv_max: 120,
                element: "30",
                asset_id: 1033820,
            },
        ]);
        (0, assert_1.deepEqual)(filtered.map(card => card.id), [1033810, 1033821]);
    });
    (0, mocha_1.it)("keeps the original stage for lower rarities too", () => {
        const filtered = (0, scraper_1.filterBaseAwakeningDuplicates)([
            {
                id: 1003840,
                name: "Goku",
                rarity: 1,
                lv_max: 40,
                element: "10",
                asset_id: 1003840,
            },
            {
                id: 1003841,
                name: "Goku",
                rarity: 2,
                lv_max: 60,
                element: "10",
                asset_id: 1003840,
            },
            {
                id: 1005000,
                name: "Other Card",
                rarity: 3,
                lv_max: 80,
                element: "20",
                asset_id: 1005000,
            },
        ]);
        (0, assert_1.deepEqual)(filtered.map(card => card.id), [1003840, 1005000]);
    });
});
(0, mocha_1.describe)("filterZAwakeningStagesFromTransformations", function () {
    (0, mocha_1.it)("removes z-awaken stages from the same awakening track", () => {
        const filtered = (0, scraper_1.filterZAwakeningStagesFromTransformations)({
            id: 1034211,
            name: "Beerus",
            rarity: 4,
            lv_max: 100,
            element: "12",
            asset_id: 1034210,
        }, [
            {
                id: 1034210,
                name: "Beerus",
                rarity: 3,
                lv_max: 80,
                element: "02",
                asset_id: 1034210,
            },
            {
                id: 4035001,
                name: "Beerus (Rage)",
                rarity: 4,
                lv_max: 120,
                element: "12",
                asset_id: 4035000,
            },
        ]);
        (0, assert_1.deepEqual)(filtered.map(card => card.id), [4035001]);
    });
});
(0, mocha_1.describe)("buildCharacterDatasetArtifact", function () {
    (0, mocha_1.it)("generates a gzip payload and manifest for the stable app contract", () => {
        const artifact = (0, dataset_artifacts_1.buildCharacterDatasetArtifact)([
            {
                id: "100",
                name: "Goku",
            },
        ], {
            datasetVersion: "2026-06-07T12:00:00.000Z",
            generatedAt: "2026-06-07T12:00:00.000Z",
        });
        (0, assert_1.equal)(artifact.manifest.schemaVersion, 1);
        (0, assert_1.equal)(artifact.manifest.fileName, "characters.json.gz");
        (0, assert_1.equal)(artifact.manifest.compression, "gzip");
        (0, assert_1.equal)(artifact.manifest.characterCount, 1);
        (0, assert_1.equal)(artifact.manifest.datasetVersion, "2026-06-07T12:00:00.000Z");
        (0, assert_1.equal)((0, zlib_1.gunzipSync)(artifact.gzipBuffer).toString("utf8"), artifact.jsonText);
        (0, assert_1.equal)(artifact.manifest.sizeBytes, artifact.gzipBuffer.byteLength);
    });
});
(0, mocha_1.describe)("hasBattleTransformationCondition", function () {
    (0, mocha_1.it)("returns false when the card has no battle transformation condition", () => {
        (0, assert_1.equal)((0, scraper_1.hasBattleTransformationCondition)(undefined), false);
    });
    (0, mocha_1.it)("returns true when the card has a real transformation condition", () => {
        (0, assert_1.equal)((0, scraper_1.hasBattleTransformationCondition)({
            condition_description: "Transformation: Transforms starting from the 4th turn from the start of battle",
        }), true);
    });
});
(0, mocha_1.describe)("cleanMultilineText", function () {
    (0, mocha_1.it)("removes emphasis asterisks even when DokkanInfo wraps multiple lines", () => {
        const cleaned = (0, scraper_1.cleanMultilineText)(`*Activates the Entrance Animation when there is another
"Space-Traveling Warriors" or "Terrifying Conquerors"
Category ally on the team upon the character's entry*
- Ki +6 and damage reduction rate 10% for 1 turn
Basic effect(s)
- ATK & DEF 250%`);
        (0, assert_1.equal)(cleaned, `Activates the Entrance Animation when there is another
"Space-Traveling Warriors" or "Terrifying Conquerors"
Category ally on the team upon the character's entry
- Ki +6 and damage reduction rate 10% for 1 turn
Basic effect(s)
- ATK & DEF 250%`);
    });
});
(0, mocha_1.describe)("splitPassiveSections", function () {
    (0, mocha_1.it)("keeps entrance animation and basic effects in separate structured sections", () => {
        const sections = (0, scraper_1.splitPassiveSections)([
            `Activates the Entrance Animation`,
            `When there is another`,
            `"Space-Traveling Warriors" or "Terrifying Conquerors"`,
            `Category ally on the team upon the character's entry`,
            `- Ki +6 and damage reduction rate 10% for 1 turn`,
            `- "Space-Traveling Warriors" or "Terrifying Conquerors" Category allies' Ki +1 and ATK 20%`,
            `plus an additional Ki +1 and ATK 30% for characters who also belong to the`,
            `"Planetary Destruction" Category, for 4 turns`,
            `Basic effect(s)`,
            `- ATK & DEF 250%`,
            `- Chance of performing a critical hit and damage reduction rate 50%`,
        ]);
        (0, assert_1.deepEqual)(sections, [
            {
                label: `Activates the Entrance Animation when there is another "Space-Traveling Warriors" or "Terrifying Conquerors" Category ally on the team upon the character's entry`,
                lines: [
                    `Ki +6 and damage reduction rate 10% for 1 turn`,
                    `"Space-Traveling Warriors" or "Terrifying Conquerors" Category allies' Ki +1 and ATK 20% plus an additional Ki +1 and ATK 30% for characters who also belong to the "Planetary Destruction" Category, for 4 turns`,
                ],
            },
            {
                label: `Basic effect(s)`,
                lines: [
                    `ATK & DEF 250%`,
                    `Chance of performing a critical hit and damage reduction rate 50%`,
                ],
            },
        ]);
    });
    (0, mocha_1.it)("keeps unconditional entrance animation labels together", () => {
        const sections = (0, scraper_1.splitPassiveSections)([
            `Activates the Entrance Animation upon the character's entry`,
            `- ATK & DEF 400% and "DAIMA" Category allies' Ki +1, DEF 23% and damage reduction rate 4%`,
            `Basic effect(s)`,
            `- ATK & DEF 400%`,
            `- Guards all attacks`,
        ]);
        (0, assert_1.deepEqual)(sections, [
            {
                label: `Activates the Entrance Animation upon the character's entry`,
                lines: [
                    `ATK & DEF 400% and "DAIMA" Category allies' Ki +1, DEF 23% and damage reduction rate 4%`,
                ],
            },
            {
                label: `Basic effect(s)`,
                lines: [
                    `ATK & DEF 400%`,
                    `Guards all attacks`,
                ],
            },
        ]);
    });
    (0, mocha_1.it)("keeps conditional entrance animation labels together for multi-line category requirements", () => {
        const sections = (0, scraper_1.splitPassiveSections)([
            `Activates the Entrance Animation`,
            `When there is another`,
            `"Artificial Life Forms" or "Super Bosses"`,
            `Category ally`,
            `on the team upon the character's entry`,
            `- ATK & DEF 100%, guards all attacks and launches an additional attack that has a high chance of becoming a Super Attack for 3 turns`,
            `Basic effect(s)`,
            `- Ki +5`,
            `- ATK & DEF 300%`,
        ]);
        (0, assert_1.deepEqual)(sections, [
            {
                label: `Activates the Entrance Animation when there is another "Artificial Life Forms" or "Super Bosses" Category ally on the team upon the character's entry`,
                lines: [
                    `ATK & DEF 100%, guards all attacks and launches an additional attack that has a high chance of becoming a Super Attack for 3 turns`,
                ],
            },
            {
                label: `Basic effect(s)`,
                lines: [
                    `Ki +5`,
                    `ATK & DEF 300%`,
                ],
            },
        ]);
    });
    (0, mocha_1.it)("splits repeated conditional headers into separate sections", () => {
        const sections = (0, scraper_1.splitPassiveSections)([
            `Basic effect(s)`,
            `- Ki +5`,
            `- ATK & DEF 300%`,
            `For every attack performed`,
            `- Ki +1 (up to +5)`,
            `- ATK 20% (up to 100%)`,
            `For every attack received`,
            `- Ki +1 (up to +5)`,
            `- DEF 20% (up to 100%)`,
            `When all allies attacking in the same turn are "Artificial Life Forms",`,
            `"Super Bosses" or "Movie Bosses" Category characters`,
            `- attacks effective against all Types`,
        ]);
        (0, assert_1.deepEqual)(sections, [
            {
                label: `Basic effect(s)`,
                lines: [
                    `Ki +5`,
                    `ATK & DEF 300%`,
                ],
            },
            {
                label: `For every attack performed`,
                lines: [
                    `Ki +1 (up to +5)`,
                    `ATK 20% (up to 100%)`,
                ],
            },
            {
                label: `For every attack received`,
                lines: [
                    `Ki +1 (up to +5)`,
                    `DEF 20% (up to 100%)`,
                ],
            },
            {
                label: `When all allies attacking in the same turn are "Artificial Life Forms", "Super Bosses" or "Movie Bosses" Category characters`,
                lines: [
                    `attacks effective against all Types`,
                ],
            },
        ]);
    });
    (0, mocha_1.it)("keeps hp and attack-received clauses as separate sections after basic effects", () => {
        const sections = (0, scraper_1.splitPassiveSections)([
            `Basic effect(s)`,
            `- ATK & DEF 250%`,
            `- Chance of performing a critical hit and damage reduction rate 50%`,
            `When HP is 50% or more`,
            `- Guards all attacks`,
            `When receiving an attack`,
            `- DEF 300%`,
        ]);
        (0, assert_1.deepEqual)(sections, [
            {
                label: `Basic effect(s)`,
                lines: [
                    `ATK & DEF 250%`,
                    `Chance of performing a critical hit and damage reduction rate 50%`,
                ],
            },
            {
                label: `When HP is 50% or more`,
                lines: [
                    `Guards all attacks`,
                ],
            },
            {
                label: `When receiving an attack`,
                lines: [
                    `DEF 300%`,
                ],
            },
        ]);
    });
});
//# sourceMappingURL=scraper.spec.js.map