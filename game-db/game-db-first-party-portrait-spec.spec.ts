import { deepEqual, equal, throws } from "assert";
import { describe, it } from "mocha";
import { Classes, Rarities, Types, type Character } from "../character";
import { normalizeOfficialPortraitElement, overlayFirstPartyPortraitSpecs } from "./game-db-first-party-portrait-spec";

function character(): Character {
    return {
        id: "1000010",
        name: "Super Saiyan Goku",
        title: "Test",
        rarity: Rarities.SSR,
        characterClass: Classes.Super,
        type: Types.AGL,
        maxLevel: 80,
        maxSALevel: 10,
        cost: 1,
        portraitURL: "images/v3/portrait_1000010.old.png",
        portraitFilename: "portrait_1000010",
        portraitSpec: { iconId: 1000010, frameColorId: 0, rarity: Rarities.SSR, elementCode: "10" },
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
            characterClass: Classes.Extreme,
            type: Types.INT,
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
            portraitSpec: { iconId: 4000010, frameColorId: 2, rarity: Rarities.UR, elementCode: "12" },
            artURL: "",
            artFilename: "art_4000011",
            finishingMove: [],
        }],
    };
}

describe("first-party portrait spec overlay", function () {
    it("uses exact official element codes for classless, Super and Extreme badge assets", () => {
        equal(normalizeOfficialPortraitElement("0", "1"), "00");
        equal(normalizeOfficialPortraitElement("14", "2"), "14");
        equal(normalizeOfficialPortraitElement("22", "3"), "22");
        throws(() => normalizeOfficialPortraitElement("15", "4"), /unsupported official element/);
    });

    it("repairs nested portrait specs by exact card ID without changing other data", () => {
        const source = character();
        const result = overlayFirstPartyPortraitSpecs([source], [
            { id: "1000010", rarity: "3", element: "0" },
            { id: "4000011", rarity: "4", element: "22" },
        ]);

        deepEqual(result.characters[0].portraitSpec, {
            iconId: 1000010,
            frameColorId: 0,
            rarity: Rarities.SSR,
            elementCode: "00",
        });
        deepEqual(result.characters[0].transformations?.[0].portraitSpec, {
            iconId: 4000010,
            frameColorId: 2,
            rarity: Rarities.UR,
            elementCode: "22",
        });
        equal(result.characters[0].portraitURL, source.portraitURL);
        deepEqual(result.report.visualClassCounts, { classless: 1, super: 0, extreme: 1 });
        equal(result.report.referenceCount, 2);
        equal(result.report.changedReferenceCount, 2);
        equal(result.report.uniqueAssetCount, 2);
        equal(result.report.officialResourceCardCount, 0);
    });

    it("uses typed official resource_id values for shared portrait assets", () => {
        const source = character();
        source.id = "1015830";
        source.portraitFilename = "portrait_1015830";
        source.transformations = [];
        source.portraitSpec = {
            iconId: 1015830,
            frameColorId: 4,
            rarity: Rarities.SSR,
            elementCode: "14",
        };
        const result = overlayFirstPartyPortraitSpecs([source], [
            { id: "1015830", rarity: "3", element: "14", resource_id: "1015820" },
        ]);

        deepEqual(result.characters[0].portraitSpec, {
            iconId: 1015820,
            frameColorId: 4,
            rarity: Rarities.SSR,
            elementCode: "14",
        });
        equal(result.report.uniqueAssetCount, 1);
        equal(result.report.officialResourceCardCount, 1);
    });

    it("fails closed for missing IDs and rarity drift", () => {
        throws(
            () => overlayFirstPartyPortraitSpecs([character()], [{ id: "1000010", rarity: "3", element: "10" }]),
            /4000011 is missing/,
        );
        throws(
            () => overlayFirstPartyPortraitSpecs([character()], [
                { id: "1000010", rarity: "4", element: "10" },
                { id: "4000011", rarity: "4", element: "22" },
            ]),
            /rarity SSR diverges from official UR/,
        );
    });
});
