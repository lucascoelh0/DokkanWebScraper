"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const mocha_1 = require("mocha");
const character_1 = require("../character");
const game_db_first_party_portrait_spec_1 = require("./game-db-first-party-portrait-spec");
function character() {
    return {
        id: "1000010",
        name: "Super Saiyan Goku",
        title: "Test",
        rarity: character_1.Rarities.SSR,
        characterClass: character_1.Classes.Super,
        type: character_1.Types.AGL,
        maxLevel: 80,
        maxSALevel: 10,
        cost: 1,
        portraitURL: "images/v3/portrait_1000010.old.png",
        portraitFilename: "portrait_1000010",
        portraitSpec: { iconId: 1000010, frameColorId: 0, rarity: character_1.Rarities.SSR, elementCode: "10" },
        leaderSkill: "",
        superAttack: "",
        ultraSuperAttack: "",
        exSuperAttack: "",
        passive: "",
        domain: "",
        links: [],
        categories: [],
        kiMeter: [],
        artURL: "",
        artFilename: "art_1000010",
        baseHP: 0,
        maxLevelHP: 0,
        freeDupeHP: 0,
        rainbowHP: 0,
        baseAttack: 0,
        maxLevelAttack: 0,
        freeDupeAttack: 0,
        rainbowAttack: 0,
        baseDefence: 0,
        maxDefence: 0,
        freeDupeDefence: 0,
        rainbowDefence: 0,
        kiMultiplier: "",
        standbySkill: "",
        transformations: [{
                id: "4000011",
                baseCharacterId: "1000010",
                name: "Transformed",
                characterClass: character_1.Classes.Extreme,
                type: character_1.Types.INT,
                superAttack: "",
                ultraSuperAttack: "",
                exSuperAttack: "",
                passive: "",
                activeSkill: "",
                activeSkillCondition: "",
                domain: "",
                links: [],
                portraitURL: "images/v3/portrait_4000011.old.png",
                portraitFilename: "portrait_4000011",
                portraitSpec: { iconId: 4000010, frameColorId: 2, rarity: character_1.Rarities.UR, elementCode: "12" },
                artURL: "",
                artFilename: "art_4000011",
                finishingMove: [],
            }],
    };
}
(0, mocha_1.describe)("first-party portrait spec overlay", function () {
    (0, mocha_1.it)("uses exact official element codes for classless, Super and Extreme badge assets", () => {
        (0, assert_1.equal)((0, game_db_first_party_portrait_spec_1.normalizeOfficialPortraitElement)("0", "1"), "00");
        (0, assert_1.equal)((0, game_db_first_party_portrait_spec_1.normalizeOfficialPortraitElement)("14", "2"), "14");
        (0, assert_1.equal)((0, game_db_first_party_portrait_spec_1.normalizeOfficialPortraitElement)("22", "3"), "22");
        (0, assert_1.throws)(() => (0, game_db_first_party_portrait_spec_1.normalizeOfficialPortraitElement)("15", "4"), /unsupported official element/);
    });
    (0, mocha_1.it)("repairs nested portrait specs by exact card ID without changing other data", () => {
        const source = character();
        const result = (0, game_db_first_party_portrait_spec_1.overlayFirstPartyPortraitSpecs)([source], [
            { id: "1000010", rarity: "3", element: "0" },
            { id: "4000011", rarity: "4", element: "22" },
        ]);
        (0, assert_1.deepEqual)(result.characters[0].portraitSpec, {
            iconId: 1000010,
            frameColorId: 0,
            rarity: character_1.Rarities.SSR,
            elementCode: "00",
        });
        (0, assert_1.deepEqual)(result.characters[0].transformations?.[0].portraitSpec, {
            iconId: 4000010,
            frameColorId: 2,
            rarity: character_1.Rarities.UR,
            elementCode: "22",
        });
        (0, assert_1.equal)(result.characters[0].portraitURL, source.portraitURL);
        (0, assert_1.deepEqual)(result.report.visualClassCounts, { classless: 1, super: 0, extreme: 1 });
        (0, assert_1.equal)(result.report.referenceCount, 2);
        (0, assert_1.equal)(result.report.changedReferenceCount, 2);
        (0, assert_1.equal)(result.report.uniqueAssetCount, 2);
        (0, assert_1.equal)(result.report.officialResourceCardCount, 0);
    });
    (0, mocha_1.it)("uses typed official resource_id values for shared portrait assets", () => {
        const source = character();
        source.id = "1015830";
        source.portraitFilename = "portrait_1015830";
        source.transformations = [];
        source.portraitSpec = {
            iconId: 1015830,
            frameColorId: 4,
            rarity: character_1.Rarities.SSR,
            elementCode: "14",
        };
        const result = (0, game_db_first_party_portrait_spec_1.overlayFirstPartyPortraitSpecs)([source], [
            { id: "1015830", rarity: "3", element: "14", resource_id: "1015820" },
        ]);
        (0, assert_1.deepEqual)(result.characters[0].portraitSpec, {
            iconId: 1015820,
            frameColorId: 4,
            rarity: character_1.Rarities.SSR,
            elementCode: "14",
        });
        (0, assert_1.equal)(result.report.uniqueAssetCount, 1);
        (0, assert_1.equal)(result.report.officialResourceCardCount, 1);
    });
    (0, mocha_1.it)("fails closed for missing IDs and rarity drift", () => {
        (0, assert_1.throws)(() => (0, game_db_first_party_portrait_spec_1.overlayFirstPartyPortraitSpecs)([character()], [{ id: "1000010", rarity: "3", element: "10" }]), /4000011 is missing/);
        (0, assert_1.throws)(() => (0, game_db_first_party_portrait_spec_1.overlayFirstPartyPortraitSpecs)([character()], [
            { id: "1000010", rarity: "4", element: "10" },
            { id: "4000011", rarity: "4", element: "22" },
        ]), /rarity SSR diverges from official UR/);
    });
});
//# sourceMappingURL=game-db-first-party-portrait-spec.spec.js.map