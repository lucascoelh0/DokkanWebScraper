"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const mocha_1 = require("mocha");
const game_db_character_passive_mode_overlay_1 = require("./game-db-character-passive-mode-overlay");
function mode(kind, text, evidenceFormId) {
    const availability = kind === "survival" ? "dokkan_frontier" : "normal";
    const details = {
        mode: kind,
        availability,
        label: kind === "survival" ? "Survival" : "Standard",
        text,
        lines: [text],
    };
    if (!evidenceFormId)
        return details;
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
function projection(id, states) {
    return { id, ...states };
}
(0, mocha_1.describe)("game DB character passive-mode overlay", () => {
    (0, mocha_1.it)("selects delivered root and transformed forms through exact passive-set and growth joins", () => {
        const characters = [{
                id: "10",
                transformations: [{ id: "20" }, { id: "30" }],
            }, { id: "40" }];
        const selected = (0, game_db_character_passive_mode_overlay_1.selectDeliveredPassiveModeFormIds)(characters, {
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
        (0, assert_1.deepStrictEqual)(selected, ["10", "20"]);
    });
    (0, mocha_1.it)("adds only missing mode channels across release states and transformed forms", () => {
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
            }];
        const original = JSON.parse(JSON.stringify(baseline));
        const result = (0, game_db_character_passive_mode_overlay_1.overlayGameDbCharacterPassiveModes)(baseline, [
            projection("10", {
                passiveDetails: { text: "Different projected base text", modes: [mode("survival", "Root survival")] },
                ezaPassiveDetails: { text: "Different projected EZA text", modes: [existing] },
            }),
            projection("20", {
                passiveDetails: { text: "Different projected form text", modes: [mode("standard", "Form standard", "20")] },
            }),
        ]);
        (0, assert_1.equal)(result.characters[0].passiveDetails?.text, "Base passive");
        (0, assert_1.equal)(result.characters[0].ezaPassiveDetails?.text, "EZA passive");
        (0, assert_1.equal)(result.characters[0].title, "Keep me");
        (0, assert_1.equal)(result.characters[0].passiveDetails?.modes?.[0].text, "Root survival");
        (0, assert_1.equal)(result.characters[0].transformations?.[0].passiveDetails?.modes?.[0].text, "Form standard");
        const transformedMode = result.characters[0].transformations?.[0].passiveDetails?.modes?.[0];
        (0, assert_1.equal)(transformedMode?.structuralSource?.evidence[0].characterId, "10");
        (0, assert_1.equal)(transformedMode?.structuralSource?.evidence[0].stateKey, "10:20:initial");
        (0, assert_1.equal)(transformedMode?.structuralSource?.evidence[0].id, "10:20:initial:passive:77:0");
        (0, assert_1.equal)(transformedMode?.conditionEvidence?.[0].characterId, "10");
        (0, assert_1.equal)(transformedMode?.conditionEvidence?.[0].stateKey, "10:20:initial");
        (0, assert_1.deepStrictEqual)(result.coverage, {
            selectedFormCount: 2,
            expectedStateCount: 3,
            patchedStateCount: 2,
            modeOnlyPatchedStateCount: 2,
            materializedStateCount: 0,
            alreadyPresentStateCount: 1,
            standardStateCount: 2,
            survivalStateCount: 1,
        });
        (0, assert_1.deepStrictEqual)(result.patches.flatMap(patch => patch.fields), [
            "passiveDetails.modes",
            "transformations.20.passiveDetails.modes",
        ]);
        (0, assert_1.deepStrictEqual)(baseline, original);
    });
    (0, mocha_1.it)("materializes a missing passive release state only when its first-party text is safe to bind", () => {
        const baseline = [{
                id: "10",
                transformations: [{
                        id: "20",
                        baseCharacterId: "10",
                        passive: "Initial",
                        passiveDetails: { text: "Initial" },
                    }],
            }];
        const result = (0, game_db_character_passive_mode_overlay_1.overlayGameDbCharacterPassiveModes)(baseline, [projection("20", {
                ezaPassiveDetails: {
                    name: "EZA",
                    text: "EZA passive",
                    modes: [mode("survival", "EZA survival", "20")],
                },
            })]);
        const form = result.characters[0].transformations?.[0];
        (0, assert_1.equal)(form?.ezaPassive, "EZA passive");
        (0, assert_1.equal)(form?.ezaPassiveDetails?.name, "EZA");
        (0, assert_1.equal)(form?.ezaPassiveDetails?.modes?.[0].structuralSource?.evidence[0].stateKey, "10:20:initial");
        (0, assert_1.equal)(result.coverage.materializedStateCount, 1);
        (0, assert_1.deepStrictEqual)(result.patches[0], {
            characterId: "10",
            formId: "20",
            releaseState: "eza",
            kind: "passive-state",
            fields: ["transformations.20.ezaPassiveDetails", "transformations.20.ezaPassive"],
            modes: ["survival"],
        });
        (0, assert_1.equal)(baseline[0].transformations?.[0].ezaPassive, undefined);
    });
    (0, mocha_1.it)("fails closed when a mode state cannot bind safely", () => {
        const projected = projection("10", {
            passiveDetails: { text: "Projected", modes: [mode("survival", "Survival")] },
        });
        (0, assert_1.throws)(() => (0, game_db_character_passive_mode_overlay_1.overlayGameDbCharacterPassiveModes)([{
                id: "10",
                passive: "Conflicting legacy text",
            }], [projected]), /conflicts with baseline passive/);
        (0, assert_1.throws)(() => (0, game_db_character_passive_mode_overlay_1.overlayGameDbCharacterPassiveModes)([{ id: "11", passiveDetails: { text: "Base" } }], [projected]), /form 10 is missing/);
        (0, assert_1.throws)(() => (0, game_db_character_passive_mode_overlay_1.overlayGameDbCharacterPassiveModes)([{
                id: "10",
                passiveDetails: { text: "Base", modes: [mode("standard", "Conflict")] },
            }], [projected]), /conflicts with the baseline/);
        (0, assert_1.throws)(() => (0, game_db_character_passive_mode_overlay_1.overlayGameDbCharacterPassiveModes)([{
                id: "10",
                passiveDetails: { text: "Base" },
            }], [projection("10", { passiveDetails: { text: "Projected" } })]), /projected no mode states/);
        (0, assert_1.throws)(() => (0, game_db_character_passive_mode_overlay_1.overlayGameDbCharacterPassiveModes)([{
                id: "10",
                passiveDetails: { text: "Base" },
            }], [projection("10", {
                passiveDetails: {
                    text: "Projected",
                    modes: [{ ...mode("survival", "Survival"), availability: "normal" }],
                },
            })]), /invalid survival availability/);
    });
});
//# sourceMappingURL=game-db-character-passive-mode-overlay.spec.js.map