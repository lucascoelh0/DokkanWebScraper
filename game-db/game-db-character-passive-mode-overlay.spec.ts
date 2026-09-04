import { deepStrictEqual, equal, throws } from "assert";
import { describe, it } from "mocha";
import type { Character, PassiveDetails, PassiveModeDetails } from "../character";
import type { GameDbDokkanpanionProjection } from "./game-db-app-projection";
import {
    overlayGameDbCharacterPassiveModes,
    selectDeliveredPassiveModeFormIds,
} from "./game-db-character-passive-mode-overlay";

function mode(
    kind: PassiveModeDetails["mode"],
    text: string,
    evidenceFormId?: string,
): PassiveModeDetails {
    const availability = kind === "survival" ? "dokkan_frontier" : "normal";
    const details: PassiveModeDetails = {
        mode: kind,
        availability,
        label: kind === "survival" ? "Survival" : "Standard",
        text,
        lines: [text],
    };
    if (!evidenceFormId) return details;
    const stateKey = `${evidenceFormId}:${evidenceFormId}:initial`;
    details.structuralSource = {
        rawText: text,
        rawTextSha256: "raw",
        normalizedTextSha256: "normalized",
        evidence: [{
            kind: "effect_markers",
            id: `${stateKey}:passive:77:0`,
            stateKey,
            characterId: evidenceFormId,
            formId: evidenceFormId,
            releaseState: "initial",
            channel: "passive",
            passiveSkillId: "77",
            rawTextSha256: "raw",
            normalizedTextSha256: "normalized",
            anchor: {
                lineIndex: 0,
                normalizedText: text,
                structuralText: text,
                sourceSpan: { start: 0, end: text.length },
            },
            markers: [],
            resolution: "supported",
            provenance: {
                source: "first_party_game_db",
                sourceVersion: "1",
                payloadField: "passive_skill_sets.group_itemized_description",
                markerSyntax: "passiveImg",
            },
        }],
    };
    details.conditionEvidence = [{
        kind: "enemy_status",
        stateKey,
        characterId: evidenceFormId,
        formId: evidenceFormId,
        releaseState: "initial",
        passiveSkillId: "77",
        passiveTextSha256: "normalized",
        anchor: {
            lineIndex: 0,
            normalizedText: text,
            structuralText: text,
        },
        statuses: [],
        resolution: "supported",
        provenance: {
            source: "first_party_game_db",
            sourceVersion: "1",
            payloadField: "passive_skill_sets.group_itemized_description",
            markerSyntax: "passiveImg",
        },
    }];
    return details;
}

function projection(
    id: string,
    states: Partial<Record<"passiveDetails" | "ezaPassiveDetails" | "sezaPassiveDetails", PassiveDetails>>,
): GameDbDokkanpanionProjection {
    return { id, ...states } as GameDbDokkanpanionProjection;
}

describe("game DB character passive-mode overlay", () => {
    it("selects delivered root and transformed forms through exact passive-set and growth joins", () => {
        const characters = [{
            id: "10",
            transformations: [{ id: "20" }, { id: "30" }],
        }, { id: "40" }] as Character[];
        const selected = selectDeliveredPassiveModeFormIds(characters, {
            passive_skill_sets: [
                { id: "100", name: "unrelated", sougou_only_itemized_description: "Standard text" },
                { id: "200", name: "also unrelated", kobetu_only_itemized_description: "Survival text" },
                { id: "300", name: "Standard Survival", sougou_only_itemized_description: "" },
            ],
            optimal_awakening_growths: [
                { id: "1", optimal_awakening_grow_type: "7", passive_skill_set_id: "200" },
                { id: "2", optimal_awakening_grow_type: "8", passive_skill_set_id: "999" },
            ],
            cards: [
                { id: "10", passive_skill_set_id: "100" },
                { id: "20", passive_skill_set_id: "999", optimal_awakening_grow_type: "7" },
                { id: "30", passive_skill_set_id: "300", optimal_awakening_grow_type: "8" },
                { id: "50", passive_skill_set_id: "100" },
            ],
        });

        deepStrictEqual(selected, ["10", "20"]);
    });

    it("adds only missing mode channels across release states and transformed forms", () => {
        const existing = mode("standard", "Existing standard");
        const baseline = [{
            id: "10",
            name: "Root",
            title: "Keep me",
            passiveDetails: { text: "Base passive" },
            ezaPassiveDetails: { text: "EZA passive", modes: [existing] },
            transformations: [{
                id: "20",
                baseCharacterId: "10",
                name: "Form",
                passiveDetails: { text: "Form passive" },
            }],
        }] as Character[];
        const original = JSON.parse(JSON.stringify(baseline));
        const result = overlayGameDbCharacterPassiveModes(baseline, [
            projection("10", {
                passiveDetails: { text: "Different projected base text", modes: [mode("survival", "Root survival")] },
                ezaPassiveDetails: { text: "Different projected EZA text", modes: [existing] },
            }),
            projection("20", {
                passiveDetails: { text: "Different projected form text", modes: [mode("standard", "Form standard", "20")] },
            }),
        ]);

        equal(result.characters[0].passiveDetails?.text, "Base passive");
        equal(result.characters[0].ezaPassiveDetails?.text, "EZA passive");
        equal(result.characters[0].title, "Keep me");
        equal(result.characters[0].passiveDetails?.modes?.[0].text, "Root survival");
        equal(result.characters[0].transformations?.[0].passiveDetails?.modes?.[0].text, "Form standard");
        const transformedMode = result.characters[0].transformations?.[0].passiveDetails?.modes?.[0];
        equal(transformedMode?.structuralSource?.evidence[0].characterId, "10");
        equal(transformedMode?.structuralSource?.evidence[0].stateKey, "10:20:initial");
        equal(transformedMode?.structuralSource?.evidence[0].id, "10:20:initial:passive:77:0");
        equal(transformedMode?.conditionEvidence?.[0].characterId, "10");
        equal(transformedMode?.conditionEvidence?.[0].stateKey, "10:20:initial");
        deepStrictEqual(result.coverage, {
            selectedFormCount: 2,
            expectedStateCount: 3,
            patchedStateCount: 2,
            modeOnlyPatchedStateCount: 2,
            materializedStateCount: 0,
            alreadyPresentStateCount: 1,
            standardStateCount: 2,
            survivalStateCount: 1,
        });
        deepStrictEqual(result.patches.flatMap(patch => patch.fields), [
            "passiveDetails.modes",
            "transformations.20.passiveDetails.modes",
        ]);
        deepStrictEqual(baseline, original);
    });

    it("materializes a missing passive release state only when its first-party text is safe to bind", () => {
        const baseline = [{
            id: "10",
            transformations: [{
                id: "20",
                baseCharacterId: "10",
                passive: "Initial",
                passiveDetails: { text: "Initial" },
            }],
        }] as Character[];
        const result = overlayGameDbCharacterPassiveModes(baseline, [projection("20", {
            ezaPassiveDetails: {
                name: "EZA",
                text: "EZA passive",
                modes: [mode("survival", "EZA survival", "20")],
            },
        })]);
        const form = result.characters[0].transformations?.[0];

        equal(form?.ezaPassive, "EZA passive");
        equal(form?.ezaPassiveDetails?.name, "EZA");
        equal(form?.ezaPassiveDetails?.modes?.[0].structuralSource?.evidence[0].stateKey, "10:20:initial");
        equal(result.coverage.materializedStateCount, 1);
        deepStrictEqual(result.patches[0], {
            characterId: "10",
            formId: "20",
            releaseState: "eza",
            kind: "passive-state",
            fields: ["transformations.20.ezaPassiveDetails", "transformations.20.ezaPassive"],
            modes: ["survival"],
        });
        equal(baseline[0].transformations?.[0].ezaPassive, undefined);
    });

    it("treats a source snapshot version refresh as non-semantic when mode evidence is otherwise identical", () => {
        const baselineMode = mode("standard", "Same passive", "10");
        const projectedMode = JSON.parse(JSON.stringify(baselineMode)) as PassiveModeDetails;
        projectedMode.structuralSource!.evidence[0].provenance.sourceVersion = "2";
        projectedMode.conditionEvidence![0].provenance.sourceVersion = "2";
        const baseline = [{
            id: "10",
            passiveDetails: { text: "Same passive", modes: [baselineMode] },
        }] as Character[];

        const result = overlayGameDbCharacterPassiveModes(baseline, [projection("10", {
            passiveDetails: { text: "Same passive", modes: [projectedMode] },
        })]);

        equal(result.coverage.alreadyPresentStateCount, 1);
        equal(result.coverage.patchedStateCount, 0);
        equal(
            result.characters[0].passiveDetails?.modes?.[0].structuralSource?.evidence[0].provenance.sourceVersion,
            "1",
        );
    });

    it("fails closed when a mode state cannot bind safely", () => {
        const projected = projection("10", {
            passiveDetails: { text: "Projected", modes: [mode("survival", "Survival")] },
        });
        throws(
            () => overlayGameDbCharacterPassiveModes([{
                id: "10",
                passive: "Conflicting legacy text",
            } as Character], [projected]),
            /conflicts with baseline passive/,
        );
        throws(
            () => overlayGameDbCharacterPassiveModes([{ id: "11", passiveDetails: { text: "Base" } } as Character], [projected]),
            /form 10 is missing/,
        );
        throws(
            () => overlayGameDbCharacterPassiveModes([{
                id: "10",
                passiveDetails: { text: "Base", modes: [mode("standard", "Conflict")] },
            } as Character], [projected]),
            /conflicts with the baseline/,
        );
        throws(
            () => overlayGameDbCharacterPassiveModes([{
                id: "10",
                passiveDetails: { text: "Base" },
            } as Character], [projection("10", { passiveDetails: { text: "Projected" } })]),
            /projected no mode states/,
        );
        throws(
            () => overlayGameDbCharacterPassiveModes([{
                id: "10",
                passiveDetails: { text: "Base" },
            } as Character], [projection("10", {
                passiveDetails: {
                    text: "Projected",
                    modes: [{ ...mode("survival", "Survival"), availability: "normal" }],
                },
            })]),
            /invalid survival availability/,
        );
    });
});
