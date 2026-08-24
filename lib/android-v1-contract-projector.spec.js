"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const mocha_1 = require("mocha");
const android_v1_contract_projector_1 = require("./android-v1-contract-projector");
const SHA256 = "a".repeat(64);
(0, mocha_1.describe)("Android v1 contract projector", () => {
    (0, mocha_1.it)("omits typed Active Skill conditions at every Character nesting level without mutating the source", () => {
        const activeSkillDetails = [{
                id: "active-1",
                name: "Active",
                description: "Effect",
                effects: [],
                source: "base",
                activationCondition: activeSkillCondition(),
            }];
        const source = {
            id: "1001",
            activeSkillDetails,
            ezaActiveSkillDetails: activeSkillDetails,
            transformations: [{ id: "2001", activeSkillDetails }],
        };
        const projection = (0, android_v1_contract_projector_1.projectCharactersForAndroidV1)([source]);
        (0, assert_1.equal)(projection.report.characterCount, 1);
        (0, assert_1.equal)(projection.report.activeSkillActivationConditionsOmitted, 3);
        (0, assert_1.equal)(projection.characters[0].activeSkillDetails?.[0].activationCondition, undefined);
        (0, assert_1.equal)(projection.characters[0].ezaActiveSkillDetails?.[0].activationCondition, undefined);
        (0, assert_1.equal)(projection.characters[0].transformations?.[0].activeSkillDetails?.[0].activationCondition, undefined);
        (0, assert_1.ok)(source.activeSkillDetails?.[0].activationCondition);
        (0, android_v1_contract_projector_1.assertCharactersProjectedForAndroidV1)(projection.characters);
    });
    (0, mocha_1.it)("downgrades only v2-only condition, scaling, and trigger discriminators", () => {
        const unsupportedCondition = {
            op: "all",
            children: [
                {
                    op: "predicate",
                    predicate: {
                        kind: "team_category_count",
                        scope: "team",
                        categories: ["Movie Heroes"],
                        comparator: "gte",
                        count: 3,
                        sourceText: "3 Movie Heroes allies",
                    },
                },
                {
                    op: "predicate",
                    predicate: {
                        kind: "guard_activated",
                        scope: "battle",
                        sourceText: "After guard is activated",
                    },
                },
            ],
        };
        const source = datasetWithRule(rule({
            condition: unsupportedCondition,
            effect: {
                kind: "atk",
                target: { scope: "self" },
                value: 100,
                unit: "percent",
                scaling: {
                    kind: "hp_remaining",
                    direction: "more_with_more_hp",
                    minPercent: 0,
                    maxPercent: 100,
                },
                applicationTrigger: {
                    kind: "per_turn",
                    source: "explicit_text",
                    provenance: { source: "explicit_text" },
                },
                sourceText: "ATK +100%",
            },
        }));
        source.states[0].activeSkillActivationCondition = activeSkillCondition();
        const projection = (0, android_v1_contract_projector_1.projectTeamAnalysisForAndroidV1)(source, SHA256);
        const projectedRule = projection.dataset.states[0].passive?.rules[0];
        (0, assert_1.equal)(projection.dataset.sourceCharacterPayloadSha256, SHA256);
        (0, assert_1.equal)(projection.dataset.states[0].activeSkillActivationCondition, undefined);
        (0, assert_1.equal)(projectedRule?.condition.op, "all");
        if (projectedRule?.condition.op === "all") {
            (0, assert_1.equal)(projectedRule.condition.children[0].op, "predicate");
            (0, assert_1.deepEqual)(projectedRule.condition.children[1], {
                op: "unknown",
                sourceText: "After guard is activated",
            });
        }
        (0, assert_1.equal)(projectedRule?.effects[0].scaling.kind, "unknown");
        (0, assert_1.equal)(projectedRule?.effects[0].applicationTrigger?.kind, "unknown");
        (0, assert_1.equal)(projectedRule?.conditionStatus, "unknown");
        (0, assert_1.equal)(projectedRule?.effectStatus, "partial");
        (0, assert_1.equal)(projectedRule?.parseStatus, "partial");
        (0, assert_1.deepEqual)(projection.report.conditionDowngrades, { "predicate:guard_activated": 1 });
        (0, assert_1.deepEqual)(projection.report.scalingDowngrades, { hp_remaining: 1 });
        (0, assert_1.deepEqual)(projection.report.applicationTriggerDowngrades, { per_turn: 1 });
        (0, assert_1.equal)(projection.report.activeSkillActivationConditionsOmitted, 1);
        (0, assert_1.equal)(projection.report.partialRuleCount, 1);
        (0, assert_1.equal)(source.states[0].activeSkillActivationCondition?.status, "supported");
        (0, assert_1.equal)(source.states[0].passive?.rules[0].condition.op, "all");
        (0, assert_1.equal)(source.states[0].passive?.rules[0].effects[0].applicationTrigger?.kind, "per_turn");
        (0, android_v1_contract_projector_1.assertTeamAnalysisProjectedForAndroidV1)(projection.dataset);
    });
    (0, mocha_1.it)("preserves v1-supported structures byte-for-structure at the modeled node", () => {
        const supportedRule = rule({
            condition: {
                op: "predicate",
                predicate: {
                    kind: "ki_spheres_obtained",
                    scope: "battle",
                    comparator: "gte",
                    count: 3,
                    kiSphereTypes: ["rainbow"],
                    sourceText: "3 Rainbow Ki Spheres obtained",
                },
            },
            effect: {
                kind: "atk",
                target: { scope: "self" },
                value: 20,
                unit: "percent",
                scaling: {
                    kind: "per_ki_sphere",
                    kiSphereTypes: ["rainbow"],
                    spheresPerIncrement: 1,
                    kiContext: "collected_ki_spheres",
                },
                sourceText: "ATK +20% per Rainbow Ki Sphere",
            },
        });
        const projection = (0, android_v1_contract_projector_1.projectTeamAnalysisForAndroidV1)(datasetWithRule(supportedRule), SHA256);
        (0, assert_1.deepEqual)(projection.dataset.states[0].passive?.rules[0], supportedRule);
        (0, assert_1.deepEqual)(projection.report.conditionDowngrades, {});
        (0, assert_1.deepEqual)(projection.report.scalingDowngrades, {});
        (0, assert_1.deepEqual)(projection.report.applicationTriggerDowngrades, {});
        (0, assert_1.equal)(projection.report.supportedRuleCount, 1);
    });
    (0, mocha_1.it)("rejects unprojected v2-only values", () => {
        const source = datasetWithRule(rule({
            condition: {
                op: "predicate",
                predicate: {
                    kind: "guard_activated",
                    scope: "battle",
                    sourceText: "After guard is activated",
                },
            },
        }));
        (0, assert_1.throws)(() => (0, android_v1_contract_projector_1.assertTeamAnalysisProjectedForAndroidV1)(source), /retains predicate:guard_activated/);
    });
});
function rule(options) {
    return {
        id: "rule-1",
        condition: options?.condition ?? { op: "always" },
        conditionStatus: "supported",
        effects: options?.effect ? [options.effect] : [],
        effectStatus: "supported",
        source: [{ lineIndex: 0, text: "source" }],
        parseStatus: "supported",
        confidence: "high",
    };
}
function datasetWithRule(passiveRule) {
    const state = {
        stateKey: "1001:initial",
        characterId: "1001",
        hardDuplicateGroupId: "1001",
        formId: "1001",
        releaseState: "initial",
        displayName: "Test Character",
        passive: {
            name: "Test Passive",
            rawText: "source",
            parseStatus: "supported",
            rules: [passiveRule],
            unparsedFragments: [],
        },
    };
    return {
        schemaVersion: 1,
        rulesVersion: "1",
        parserVersion: "1.9.14",
        generatedAt: "2026-08-24T00:00:00.000Z",
        sourceCharacterDatasetVersion: "2026-08-24T00:00:00.000Z",
        sourceCharacterPayloadSha256: "b".repeat(64),
        stateCount: 1,
        supportedRuleCount: 1,
        partialRuleCount: 0,
        unknownRuleCount: 0,
        states: [state],
    };
}
function activeSkillCondition() {
    return {
        status: "supported",
        expression: {
            op: "predicate",
            predicate: {
                kind: "battle_turn",
                comparator: "gte",
                value: 3,
                evidenceStatus: "supported",
                provenance: {
                    table: "skill_causalities",
                    rowId: "1",
                    causalityType: 1,
                    values: [3, 0, 0],
                },
            },
        },
        provenance: {
            activeSkillSet: { table: "active_skill_sets", rowId: "1" },
            causalities: [{ table: "skill_causalities", rowId: "1" }],
        },
    };
}
//# sourceMappingURL=android-v1-contract-projector.spec.js.map