"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const mocha_1 = require("mocha");
const team_analysis_db5_builder_1 = require("./team-analysis-db5-builder");
function projection(causalityType, rawSelector, status = "partial") {
    return {
        projectionKey: "threshold-series:fixture",
        status,
        absorbedCondition: "contiguous_minimum_threshold_series",
        effect: {
            kind: "atk", value: 10, unit: "percent", evidence: "first-party-row-join",
            target: { scope: "self", selfInclusion: "included", classes: [], types: [], categories: [], categoryIds: [], excludedCategories: [], excludedCategoryIds: [], subTargets: [], unknownSubTargets: [] },
            scaling: {
                kind: "per_qualifying_unit_threshold_series", contributionPerIncrement: 1, maxIncrements: 3, thresholdValues: [1, 2, 3],
                qualifyingUnit: { scope: "team", selectorKind: causalityType === 41 ? "name_selector_unknown" : "class_type_mask_unknown", rawSelector, evidence: "unknown" },
            },
        },
        source: { causalityType, rawScope: 0, rawSelector, rawAuxiliary: null, sourceRuleKeys: [], passiveSkillRelationIds: [], passiveSkillIds: [], causalityIds: [], provenance: [] },
        proof: { directSingleCausalityRules: true, identicalEffectTargetTimingAndCalculation: true, startsAtOne: true, contiguousWithoutDuplicates: true, noCompetingSameEffectThresholdRows: true },
        unknowns: [causalityType === 41 ? "name_selector_domain_unknown" : "class_type_mask_unknown"],
    };
}
(0, mocha_1.describe)("database Team Analysis DB5 counted-scaling normalization", function () {
    (0, mocha_1.it)("decodes only independently confirmed class/type bits", () => {
        const known = (0, team_analysis_db5_builder_1.normalizeDb4ThresholdSeriesProjection)(projection(46, 4 | 32));
        (0, assert_1.equal)(known.status, "supported");
        (0, assert_1.deepEqual)(known.effect.scaling.subject, {
            kind: "class_type_mask", scope: "team", rawMask: 36, classes: ["Super"], types: ["INT"],
            unknownMask: 0, status: "supported", evidence: "audited-first-party-bitfield",
        });
        const unresolved = (0, team_analysis_db5_builder_1.normalizeDb4ThresholdSeriesProjection)(projection(46, 1));
        (0, assert_1.equal)(unresolved.status, "partial");
        if (unresolved.effect.scaling.subject.kind === "class_type_mask") {
            (0, assert_1.equal)(unresolved.effect.scaling.subject.unknownMask, 1);
            (0, assert_1.deepEqual)(unresolved.effect.scaling.subject.types, []);
        }
        (0, assert_1.equal)(unresolved.unknowns.includes("class_type_mask_unknown"), true);
    });
    (0, mocha_1.it)("retains type 41 as a raw token without inventing localized text", () => {
        const normalized = (0, team_analysis_db5_builder_1.normalizeDb4ThresholdSeriesProjection)(projection(41, 126));
        (0, assert_1.equal)(normalized.status, "partial");
        (0, assert_1.deepEqual)(normalized.effect.scaling.subject, {
            kind: "name_match_token", scope: "team", token: 126, localizedName: null,
            matchSemantics: "name_includes", status: "partial", evidence: "audited-first-party-semantics",
        });
        (0, assert_1.equal)(normalized.unknowns.includes("name_token_dictionary_unavailable"), true);
    });
    (0, mocha_1.it)("keeps the observed series boundary separate from an unknown semantic cap", () => {
        const normalized = (0, team_analysis_db5_builder_1.normalizeDb4ThresholdSeriesProjection)(projection(46, 64));
        (0, assert_1.equal)(normalized.effect.scaling.observedSeriesLength, 3);
        (0, assert_1.equal)(normalized.effect.scaling.observedMaximumContribution, 30);
        (0, assert_1.deepEqual)(normalized.effect.scaling.semanticCap, {
            status: "unknown", value: null, reason: "series_boundary_is_not_a_proven_semantic_cap",
        });
    });
});
//# sourceMappingURL=team-analysis-db5-builder.spec.js.map