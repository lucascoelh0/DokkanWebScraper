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

    it("corrects an alternative art variant to the canonical initial release date", () => {
        const baseline = character("1034481");
        baseline.releaseDate = "2026-05-21T06:00:00.000Z";
        const firstParty = projection("1034481");
        firstParty.releaseDate = "2024-04-26T06:00:00.000Z";
        firstParty.hasEza = false;
        firstParty.ezaReleaseDate = undefined;
        firstParty.ezaLeaderSkill = undefined;
        firstParty.ezaLeaderSkillDetails = undefined;
        firstParty.ezaPassive = undefined;
        firstParty.ezaPassiveDetails = undefined;
        firstParty.ezaSuperAttackDetails = undefined;

        const result = overlayGameDbCharacterReleaseStates(
            [baseline],
            [firstParty],
            ["1034481"],
        );

        equal(result.characters[0].releaseDate, "2024-04-26T06:00:00.000Z");
        deepEqual(result.patches[0], {
            cardId: "1034481",
            fields: ["releaseDate"],
        });
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

    it("patches an existing transformed EZA state and rebinds its passive evidence to the base card", () => {
        const baseline = character("1024291");
        baseline.transformations = [{
            id: "4024301",
            baseCharacterId: "1024291",
            name: "Super Saiyan Gohan (Youth)",
            characterClass: Classes.Super,
            type: Types.STR,
            superAttack: "Base transformed Super Attack",
            passive: "Base transformed passive",
            domain: "",
            links: [],
            portraitURL: "portrait",
            portraitFilename: "portrait_4024301",
            artURL: "",
            artFilename: "",
            finishingMove: [],
        }];
        const rootProjection = projection("1024291");
        const transformedProjection = projection("4024301");
        transformedProjection.ezaPassive = "Surpass Your Dad!";
        transformedProjection.ezaPassiveDetails = {
            name: "Surpass Your Dad!",
            text: "EZA transformed passive",
            lines: ["EZA transformed passive"],
            structuralSource: {
                rawText: "EZA transformed passive",
                rawTextSha256: "raw",
                normalizedTextSha256: "normalized",
                evidence: [{
                    kind: "effect_markers",
                    id: "4024301:4024301:eza:passive:4562:4",
                    stateKey: "4024301:4024301:eza",
                    characterId: "4024301",
                    formId: "4024301",
                    releaseState: "eza",
                    channel: "passive",
                    passiveSkillId: "4562",
                    rawTextSha256: "raw",
                    normalizedTextSha256: "normalized",
                    anchor: {
                        lineIndex: 0,
                        normalizedText: "EZA transformed passive",
                        structuralText: "EZA transformed passive",
                        sourceSpan: { start: 4, end: 27 },
                    },
                    markers: [],
                    resolution: "supported",
                    provenance: {
                        source: "first_party_game_db",
                        sourceVersion: "1787900894",
                        payloadField: "passive_skill_sets.itemized_description",
                        markerSyntax: "passiveImg",
                    },
                }],
            },
        };

        const result = overlayGameDbCharacterReleaseStates(
            [baseline],
            [rootProjection, transformedProjection],
            ["1024291"],
        );
        const transformed = result.characters[0].transformations?.[0];

        equal(transformed?.ezaPassive, "Surpass Your Dad!");
        equal(transformed?.ezaReleaseDate, "2021-02-17T06:00:00.000Z");
        equal(transformed?.ezaSuperAttackDetails?.sourceAttackId, "20432");
        equal(transformed?.ezaPassiveDetails?.structuralSource?.evidence[0].characterId, "1024291");
        equal(transformed?.ezaPassiveDetails?.structuralSource?.evidence[0].formId, "4024301");
        equal(transformed?.ezaPassiveDetails?.structuralSource?.evidence[0].stateKey, "1024291:4024301:eza");
        equal(baseline.transformations?.[0].ezaPassive, undefined);
        equal(result.patches[0].fields.includes("transformations.4024301.ezaPassive"), true);
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
