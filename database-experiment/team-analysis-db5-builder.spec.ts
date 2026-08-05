import { deepEqual, equal } from "assert";
import { describe, it } from "mocha";
import { normalizeDb4ThresholdSeriesProjection } from "./team-analysis-db5-builder";

function projection(causalityType: number, rawSelector: number, status: "supported" | "partial" = "partial") {
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
    } as any;
}

describe("database Team Analysis DB5 counted-scaling normalization", function () {
    it("decodes only independently confirmed class/type bits", () => {
        const known = normalizeDb4ThresholdSeriesProjection(projection(46, 4 | 32));
        equal(known.status, "supported");
        deepEqual(known.effect.scaling.subject, {
            kind: "class_type_mask", scope: "team", rawMask: 36, classes: ["Super"], types: ["INT"],
            unknownMask: 0, status: "supported", evidence: "audited-first-party-bitfield",
        });
        const unresolved = normalizeDb4ThresholdSeriesProjection(projection(46, 1));
        equal(unresolved.status, "partial");
        if (unresolved.effect.scaling.subject.kind === "class_type_mask") {
            equal(unresolved.effect.scaling.subject.unknownMask, 1);
            deepEqual(unresolved.effect.scaling.subject.types, []);
        }
        equal(unresolved.unknowns.includes("class_type_mask_unknown"), true);
    });

    it("retains type 41 as a raw token without inventing localized text", () => {
        const normalized = normalizeDb4ThresholdSeriesProjection(projection(41, 126));
        equal(normalized.status, "partial");
        deepEqual(normalized.effect.scaling.subject, {
            kind: "name_match_token", scope: "team", token: 126, localizedName: null,
            matchSemantics: "name_includes", status: "partial", evidence: "audited-first-party-semantics",
        });
        equal(normalized.unknowns.includes("name_token_dictionary_unavailable"), true);
    });

    it("keeps the observed series boundary separate from an unknown semantic cap", () => {
        const normalized = normalizeDb4ThresholdSeriesProjection(projection(46, 64));
        equal(normalized.effect.scaling.observedSeriesLength, 3);
        equal(normalized.effect.scaling.observedMaximumContribution, 30);
        deepEqual(normalized.effect.scaling.semanticCap, {
            status: "unknown", value: null, reason: "series_boundary_is_not_a_proven_semantic_cap",
        });
    });
});
