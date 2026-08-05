"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const mocha_1 = require("mocha");
const team_analysis_db5_parity_1 = require("./team-analysis-db5-parity");
function projection(subject, value, length) {
    return {
        projectionKey: `fixture:${subject.kind}`,
        status: "supported",
        effect: {
            kind: "atk", value, unit: "percent", evidence: "first-party-row-join",
            target: { scope: "self", selfInclusion: "included", classes: [], types: [], categories: [], categoryIds: [], excludedCategories: [], excludedCategoryIds: [], subTargets: [], unknownSubTargets: [] },
            scaling: {
                kind: "per_counted_subject", contributionPerSubject: 1, subject,
                observedThresholdValues: Array.from({ length }, (_, index) => index + 1),
                observedSeriesLength: length, observedMaximumContribution: value * length,
                semanticCap: { status: "unknown", value: null, reason: "series_boundary_is_not_a_proven_semantic_cap" },
            },
        },
        source: { causalityType: 34 }, proof: {}, unknowns: [],
    };
}
function database(countedScaling) {
    return {
        states: [{
                stateKey: "1:1:initial", characterId: "1", formId: "1", releaseState: "initial", sourceReleaseState: "initial", displayName: "Fixture",
                passive: { countedScaling },
            }],
    };
}
function siteAudit() {
    return { formProjectionAliases: [] };
}
(0, mocha_1.describe)("database Team Analysis DB5 parity", function () {
    (0, mocha_1.it)("compares an observed contribution with structured current stackCap without promoting a semantic cap", () => {
        const subject = { kind: "category", scope: "team", categoryId: "40", categoryName: "Bond", rawSelector: 40, status: "supported", evidence: "first-party-row-join" };
        const current = {
            states: [{ stateKey: "1:1:initial", passive: { rules: [{
                                condition: { op: "unknown", sourceText: "already parsed elsewhere" },
                                effects: [{ kind: "atk", value: 10, unit: "percent", stackCap: 30, target: { scope: "self" } }],
                            }] } }],
        };
        const parity = (0, team_analysis_db5_parity_1.compareDatabaseTeamAnalysisDb5)(database([projection(subject, 10, 3)]), current, siteAudit());
        (0, assert_1.equal)(parity.currentBaseEffectShapeMatchCount, 1);
        (0, assert_1.equal)(parity.currentUnknownConditionShapeMatchCount, 1);
        (0, assert_1.equal)(parity.capComparisonCounts.exact_observed_contribution, 1);
        (0, assert_1.equal)(parity.currentStructuredSelectorMatchCount, 0);
    });
    (0, mocha_1.it)("matches a structured Ki Sphere selector only from structured current scaling", () => {
        const subject = { kind: "ki_sphere", kiSphereTypes: ["rainbow"], status: "supported", evidence: "first-party-row-join" };
        const current = {
            states: [{ stateKey: "1:1:initial", passive: { rules: [{
                                condition: { op: "always" },
                                effects: [{ kind: "atk", value: 5, unit: "percent", target: { scope: "self" }, scaling: { kind: "per_ki_sphere", kiSphereTypes: ["rainbow"], spheresPerIncrement: 1 } }],
                            }] } }],
        };
        const parity = (0, team_analysis_db5_parity_1.compareDatabaseTeamAnalysisDb5)(database([projection(subject, 5, 5)]), current, siteAudit());
        (0, assert_1.equal)(parity.currentStructuredSelectorMatchCount, 1);
        (0, assert_1.equal)(parity.capComparisonCounts.no_structured_cap, 1);
    });
    (0, mocha_1.it)("does not call a known portion of a partial mask a structured selector match", () => {
        const subject = { kind: "class_type_mask", scope: "team", rawMask: 65, classes: ["Extreme"], types: [], unknownMask: 1, status: "partial", evidence: "audited-first-party-bitfield" };
        const current = {
            states: [{ stateKey: "1:1:initial", passive: { rules: [{
                                condition: { op: "predicate", predicate: { kind: "ally_class_present", scope: "team", classes: ["Extreme"] } },
                                effects: [{ kind: "atk", value: 10, unit: "percent", target: { scope: "self" } }],
                            }] } }],
        };
        const parity = (0, team_analysis_db5_parity_1.compareDatabaseTeamAnalysisDb5)(database([projection(subject, 10, 3)]), current, siteAudit());
        (0, assert_1.equal)(parity.currentBaseEffectShapeMatchCount, 1);
        (0, assert_1.equal)(parity.currentStructuredSelectorMatchCount, 0);
    });
    (0, mocha_1.it)("does not propose a structured base candidate when calculation buckets are absent", () => {
        const subject = { kind: "category", scope: "team", categoryId: "40", categoryName: "Bond", rawSelector: 40, status: "supported", evidence: "first-party-row-join" };
        const current = {
            states: [{ stateKey: "1:1:initial", passive: { rules: [
                            { condition: { op: "unknown" }, effects: [{ kind: "atk", value: 10, unit: "percent", stackCap: 40, target: { scope: "self" } }] },
                            { condition: { op: "always" }, effects: [{ kind: "atk", value: 10, unit: "percent", target: { scope: "self" } }] },
                        ] } }],
        };
        const parity = (0, team_analysis_db5_parity_1.compareDatabaseTeamAnalysisDb5)(database([projection(subject, 10, 3)]), current, siteAudit());
        (0, assert_1.equal)(parity.capComparisonCounts.mismatch, 1);
        (0, assert_1.equal)(parity.capComparisonCounts.candidate_observed_plus_structured_base, 0);
    });
});
//# sourceMappingURL=team-analysis-db5-parity.spec.js.map