import { deepEqual, equal, throws } from "assert";
import { describe, it } from "mocha";
import type { Character } from "../character";
import { AttackTypes, Classes, Rarities, Types } from "../character";
import type { GameDbDokkanpanionProjection } from "./game-db-app-projection";
import { overlayGameDbCharacterReleaseStates } from "./game-db-character-release-overlay";

function character(id: string): Character {
    return {
        id,
        name: `Card ${id}`,
        title: "",
        maxLevel: 150,
        maxSALevel: 20,
        rarity: Rarities.LR,
        characterClass: Classes.Super,
        type: Types.INT,
        cost: 77,
        portraitURL: `images/v2/portrait_${id}.png`,
        portraitFilename: `portrait_${id}`,
        leaderSkill: "Base leader",
        superAttack: "Base Super Attack",
        ultraSuperAttack: "Base Ultra Super Attack",
        exSuperAttack: "",
        passive: "Base passive",
        domain: "",
        links: [],
        categories: [],
        kiMeter: [],
        artURL: "",
        artFilename: "",
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
    };
}

function projection(id: string): GameDbDokkanpanionProjection {
    return {
        id,
        source: "game-db-projection",
        name: `Card ${id}`,
        title: "",
        rarity: Rarities.LR,
        type: Types.INT,
        characterClass: Classes.Super,
        cost: 77,
        portraitURL: `images/v2/portrait_${id}.png`,
        portraitFilename: `portrait_${id}`,
        portraitSpec: { iconId: Number(id), frameColorId: 2, rarity: Rarities.LR, elementCode: "12" },
        artURL: "",
        artFilename: "",
        maxLevel: 150,
        maxSALevel: 20,
        leaderSkill: "Base leader",
        ezaLeaderSkill: "EZA leader",
        ezaReleaseDate: "2021-02-17T06:00:00.000Z",
        ezaLeaderSkillDetails: { rawText: "EZA leader", displayBoost: 200, clauses: [] },
        passive: "Base passive",
        ezaPassive: "EZA passive",
        ezaPassiveDetails: { name: "EZA passive name", text: "EZA passive", lines: ["EZA passive"] },
        ezaSuperAttackDetails: [
            { id: "20432", name: "EZA Super", description: "EZA Super effect", variant: "super", requiredKi: 12, type: AttackTypes.Unarmed, attackIncrease: { level1Percent: 200, maxLevelPercent: 320, maxLevel: 25 } },
            { id: "20434", name: "EZA Ultra", description: "EZA Ultra effect", variant: "ultra", requiredKi: 18, type: AttackTypes.KiBlast, attackIncrease: { level1Percent: 250, maxLevelPercent: 490, maxLevel: 25 } },
        ],
        activeSkill: "",
        activeSkillCondition: "",
        domain: "",
        standbySkill: "",
        finishSkills: [],
        obtainability: { type: "unknown", isFreeToPlay: false, hasDirectAcquisitionDetails: false },
        isFreeToPlay: false,
        links: [],
        categories: [],
        baseHP: 0,
        maxLevelHP: 0,
        baseAttack: 0,
        maxLevelAttack: 0,
        baseDefence: 0,
        maxDefence: 0,
        hasEza: true,
        hasSeza: false,
        transformations: [],
    };
}

describe("game DB character release-state overlay", () => {
    it("patches only release-specific fields and preserves the complete catalog", () => {
        const baseline = [character("1"), character("1028061"), character("3")];
        const baselineBytes = JSON.stringify(baseline);

        const result = overlayGameDbCharacterReleaseStates(baseline, [projection("1028061")], ["1028061"]);

        equal(result.characters.length, 3);
        deepEqual(result.characters.map(item => item.id), ["1", "1028061", "3"]);
        equal(result.characters[0].ezaPassive, undefined);
        equal(result.characters[2].ezaPassive, undefined);
        equal(result.characters[1].ezaLeaderSkill, "EZA leader");
        equal(result.characters[1].ezaPassiveDetails?.name, "EZA passive name");
        equal(result.characters[1].ezaSuperAttackDetails?.sourceAttackId, "20432");
        equal(result.characters[1].ezaSuperAttackDetails?.type, AttackTypes.Unarmed);
        equal(result.characters[1].ezaUltraSuperAttackDetails?.attackIncrease?.maxLevelPercent, 490);
        equal(result.characters[1].ezaReleaseDate, "2021-02-17T06:00:00.000Z");
        deepEqual(result.checks, {
            characterCountPreserved: true,
            characterOrderPreserved: true,
            untargetedCharactersUnchanged: true,
            everyTargetFoundInBaseline: true,
            everyTargetFoundInGameDb: true,
        });
        equal(JSON.stringify(baseline), baselineBytes);
    });

    it("adds only the typed Active Skill activation condition to a matching baseline detail", () => {
        const baseline = character("1034341");
        baseline.activeSkillDetails = [{
            id: "378",
            name: "Special Beam Cannon",
            description: "Existing localized effect",
            effects: [],
            source: {
                kind: "dokkan_fyi_payload",
                sourceVersion: "fixture",
                payloadField: "props.character.active_skills",
            },
        }];
        const firstParty = projection("1034341");
        firstParty.ezaLeaderSkill = undefined;
        firstParty.ezaLeaderSkillDetails = undefined;
        firstParty.ezaReleaseDate = undefined;
        firstParty.ezaPassive = undefined;
        firstParty.ezaPassiveDetails = undefined;
        firstParty.ezaSuperAttackDetails = undefined;
        firstParty.activeSkillDetails = [{
            id: "378",
            name: "First-party name",
            description: "First-party effect",
            activationCondition: {
                status: "supported",
                expression: {
                    op: "predicate",
                    predicate: {
                        kind: "battle_turn",
                        comparator: "gte",
                        value: 4,
                        evidenceStatus: "supported",
                        provenance: {
                            table: "skill_causalities",
                            rowId: "3139",
                            causalityType: 5,
                            values: [3, 0, 0],
                        },
                    },
                },
                provenance: {
                    activeSkillSet: { table: "active_skill_sets", rowId: "378" },
                    causalities: [{ table: "skill_causalities", rowId: "3139" }],
                },
            },
            effects: [],
            source: {
                kind: "game_db",
                relation: { table: "card_active_skills", rowId: "378" },
                set: { table: "active_skill_sets", rowId: "378" },
            },
        }];

        const result = overlayGameDbCharacterReleaseStates([baseline], [firstParty], ["1034341"]);
        const detail = result.characters[0].activeSkillDetails?.[0];
        equal(detail?.name, "Special Beam Cannon");
        equal(detail?.description, "Existing localized effect");
        equal(detail?.activationCondition?.status, "supported");
        deepEqual(result.patches, [{ cardId: "1034341", fields: ["activeSkillDetails"] }]);
        equal(baseline.activeSkillDetails?.[0].activationCondition, undefined);
    });

    it("fails closed when the requested card is absent from either source", () => {
        throws(
            () => overlayGameDbCharacterReleaseStates([character("1")], [projection("2")], ["2"]),
            /missing from the baseline catalog/,
        );
        throws(
            () => overlayGameDbCharacterReleaseStates([character("1")], [], ["1"]),
            /missing from the game DB projection/,
        );
    });

    it("fails closed when a first-party EZA Super Attack has no category", () => {
        const firstParty = projection("1028061");
        if (firstParty.ezaSuperAttackDetails?.[0]) firstParty.ezaSuperAttackDetails[0].type = undefined;

        throws(
            () => overlayGameDbCharacterReleaseStates([character("1028061")], [firstParty], ["1028061"]),
            /EZA Super Attack 20432 has no first-party attack type/,
        );
    });
});
