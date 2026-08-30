import { deepStrictEqual, throws } from "assert";
import { describe, it } from "mocha";
import { AttackTypes, Classes, Rarities, Types } from "../character";
import type { GameDbDokkanpanionProjection } from "./game-db-app-projection";
import { materializeGameDbCharacter } from "./game-db-character-materializer";

function projection(id: string): GameDbDokkanpanionProjection {
    return {
        id,
        source: "game-db-projection",
        name: `Card ${id}`,
        title: "Title",
        rarity: Rarities.UR,
        type: Types.TEQ,
        characterClass: Classes.Super,
        cost: 58,
        portraitURL: "unused",
        portraitFilename: "unused",
        portraitSpec: { iconId: Number(id) - 1, frameColorId: 1, rarity: Rarities.UR, elementCode: "11" },
        artURL: "art",
        artFilename: "art-file",
        maxLevel: 120,
        maxSALevel: 10,
        leaderSkill: "Leader",
        passive: "Passive",
        superAttackDetails: [{
            id: "sa-1",
            name: "Attack",
            description: "Damage",
            variant: "super",
            requiredKi: 12,
            type: AttackTypes.KiBlast,
        }],
        activeSkill: "",
        activeSkillCondition: "",
        domain: "",
        standbySkill: "",
        finishSkills: [],
        obtainability: { type: "unknown", isFreeToPlay: false, hasDirectAcquisitionDetails: false },
        isFreeToPlay: false,
        links: ["Link"],
        categories: ["Category"],
        baseHP: 1,
        maxLevelHP: 2,
        baseAttack: 3,
        maxLevelAttack: 4,
        baseDefence: 5,
        maxDefence: 6,
        hasEza: false,
        hasSeza: false,
        transformations: [],
    };
}

describe("game DB Character materializer", () => {
    it("materializes a complete consumer Character with safe stat fallbacks", () => {
        const source = projection("1034001");
        const result = materializeGameDbCharacter(
            source,
            new Map([[source.id, source]]),
            new Map([[source.id, { portraitURL: "v1/images/v4/portrait.png", portraitFilename: "portrait.png" }]]),
        );
        deepStrictEqual({
            id: result.id,
            superAttack: result.superAttack,
            superAttackType: result.superAttackDetails?.type,
            freeDupeHP: result.freeDupeHP,
            rainbowAttack: result.rainbowAttack,
            transformations: result.transformations,
        }, {
            id: "1034001",
            superAttack: "Damage",
            superAttackType: AttackTypes.KiBlast,
            freeDupeHP: 0,
            rainbowAttack: 0,
            transformations: [],
        });
    });

    it("fails closed when a new first-party card has no Super Attack category", () => {
        const source = projection("1034001");
        if (source.superAttackDetails?.[0]) source.superAttackDetails[0].type = undefined;

        throws(() => materializeGameDbCharacter(
            source,
            new Map([[source.id, source]]),
            new Map([[source.id, { portraitURL: "portrait", portraitFilename: "portrait.png" }]]),
        ), /Super Attack sa-1 has no first-party attack type/);
    });

    it("requires exact projections and portraits for related forms", () => {
        const source = projection("1033971");
        source.transformations = [{
            id: "4033981",
            name: "Powered up",
            source: "active-skill",
            condition: "Condition",
        }];
        throws(() => materializeGameDbCharacter(
            source,
            new Map([[source.id, source]]),
            new Map([[source.id, { portraitURL: "portrait", portraitFilename: "portrait" }]]),
        ), /missing game DB projection for related form 4033981/);
    });

    it("rebinds related-form passive evidence to the owning base character without mutating the projection", () => {
        const source = projection("1033971");
        const related = projection("4033981");
        source.transformations = [{
            id: related.id,
            name: "Powered up",
            source: "active-skill",
            condition: "Condition",
        }];
        related.passiveDetails = {
            structuralSource: {
                rawText: "Passive",
                rawTextSha256: "raw",
                normalizedTextSha256: "normalized",
                evidence: [{
                    kind: "effect_markers",
                    id: "4033981:4033981:initial:passive:skill-1:4",
                    stateKey: "4033981:4033981:initial",
                    characterId: "4033981",
                    formId: "4033981",
                    releaseState: "initial",
                    channel: "passive",
                    passiveSkillId: "skill-1",
                    rawTextSha256: "raw",
                    normalizedTextSha256: "normalized",
                    anchor: {
                        lineIndex: 0,
                        normalizedText: "Passive",
                        structuralText: "Passive",
                        sourceSpan: { start: 4, end: 11 },
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
            conditionEvidence: [{
                kind: "enemy_status",
                stateKey: "4033981:4033981:initial",
                characterId: "4033981",
                formId: "4033981",
                releaseState: "initial",
                passiveSkillId: "skill-1",
                passiveTextSha256: "normalized",
                anchor: {
                    lineIndex: 0,
                    normalizedText: "Passive",
                    structuralText: "Passive",
                },
                statuses: [],
                resolution: "supported",
                provenance: {
                    source: "first_party_game_db",
                    sourceVersion: "1787900894",
                    payloadField: "passive_skill_sets.itemized_description",
                    markerSyntax: "passiveImg",
                },
            }],
        };

        const result = materializeGameDbCharacter(
            source,
            new Map([[source.id, source], [related.id, related]]),
            new Map([
                [source.id, { portraitURL: "base", portraitFilename: "base.png" }],
                [related.id, { portraitURL: "form", portraitFilename: "form.png" }],
            ]),
        );
        const transformed = result.transformations?.[0];
        deepStrictEqual({
            baseCharacterId: transformed?.baseCharacterId,
            structuralCharacterId: transformed?.passiveDetails?.structuralSource?.evidence[0].characterId,
            structuralStateKey: transformed?.passiveDetails?.structuralSource?.evidence[0].stateKey,
            structuralId: transformed?.passiveDetails?.structuralSource?.evidence[0].id,
            conditionCharacterId: transformed?.passiveDetails?.conditionEvidence?.[0].characterId,
            conditionStateKey: transformed?.passiveDetails?.conditionEvidence?.[0].stateKey,
        }, {
            baseCharacterId: "1033971",
            structuralCharacterId: "1033971",
            structuralStateKey: "1033971:4033981:initial",
            structuralId: "1033971:4033981:initial:passive:skill-1:4",
            conditionCharacterId: "1033971",
            conditionStateKey: "1033971:4033981:initial",
        });
        deepStrictEqual(related.passiveDetails?.structuralSource?.evidence[0].characterId, "4033981");
    });

    it("rejects related-form evidence that was already bound to a different identity", () => {
        const source = projection("1033971");
        const related = projection("4033981");
        source.transformations = [{
            id: related.id,
            source: "active-skill",
            condition: "Condition",
        }];
        related.passiveDetails = {
            conditionEvidence: [{
                kind: "enemy_status",
                stateKey: "9999999:4033981:initial",
                characterId: "9999999",
                formId: "4033981",
                releaseState: "initial",
                passiveTextSha256: "normalized",
                anchor: { lineIndex: 0, normalizedText: "Passive", structuralText: "Passive" },
                statuses: [],
                resolution: "supported",
                provenance: {
                    source: "first_party_game_db",
                    sourceVersion: "1787900894",
                    payloadField: "passive_skill_sets.itemized_description",
                    markerSyntax: "passiveImg",
                },
            }],
        };

        throws(() => materializeGameDbCharacter(
            source,
            new Map([[source.id, source], [related.id, related]]),
            new Map([
                [source.id, { portraitURL: "base", portraitFilename: "base.png" }],
                [related.id, { portraitURL: "form", portraitFilename: "form.png" }],
            ]),
        ), /related form 4033981 has mismatched passive condition evidence/);
    });
});
