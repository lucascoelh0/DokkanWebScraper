import { equal, throws } from "assert";
import { describe, it } from "mocha";
import { buildDatabaseTeamAnalysisDb13Coverage, buildDatabaseTeamAnalysisDb13Dataset } from "./team-analysis-db13-builder";
import { renderDatabaseTeamAnalysisDb13Report } from "./team-analysis-db13-report";

const target = { scope: "self", selfInclusion: "included", classes: [], types: [], categories: [], categoryIds: [], excludedCategories: [], excludedCategoryIds: [], subTargets: [], unknownSubTargets: [] };
const dbEffect = (kind: string, value: number) => ({ kind, target, value, unit: "percent", evidence: "first-party-row-join" });
const currentEffect = (kind: string, value: number) => ({ kind, target: { scope: "self" }, value, unit: "percent" });
const dbRule = (key: string, effects: unknown[]) => ({ ruleKey: key, effects, source: { passiveSkillRelationId: `${key}-relation`, passiveSkillId: `${key}-skill`, efficacyType: 1 } });
const currentRule = (id: string, effects: unknown[]) => ({ id, effects });
function fixture() {
    const db11 = { contractVersion: "0.10.0", generatedAt: "x", sourceSnapshotVersion: "snapshot", sourceSha256: "database", states: [
        { stateKey: "1:1:initial", characterId: "1", formId: "1", releaseState: "initial", passive: { rules: [dbRule("db-exact", [dbEffect("atk", 100)])] } },
        { stateKey: "2:2:initial", characterId: "2", formId: "2", releaseState: "initial", passive: { rules: [dbRule("db-anchor", [dbEffect("atk", 200), dbEffect("def", 200)])] } },
        { stateKey: "3:3:initial", characterId: "3", formId: "3", releaseState: "initial", passive: { rules: [dbRule("db-ambiguous-a", [dbEffect("atk", 50)]), dbRule("db-ambiguous-b", [dbEffect("atk", 50)])] } },
    ] } as any;
    const current = { parserVersion: "parser", states: [
        { stateKey: "1:1:initial", passive: { rules: [currentRule("current-exact", [currentEffect("atk", 100)])] } },
        { stateKey: "2:2:initial", passive: { rules: [currentRule("current-anchor", [currentEffect("atk", 200)])] } },
        { stateKey: "3:3:initial", passive: { rules: [currentRule("current-ambiguous", [currentEffect("atk", 50)])] } },
    ] } as any;
    const signature = (value: number) => JSON.stringify({ comparator: "eq", kind: "turn_from_entry", logicalContext: "direct", negated: false, scope: "self", value });
    const candidate = (stateKey: string, value: number, databaseRuleKey: string) => ({ stateKey, value, databaseRuleKey, databaseLowerSignature: JSON.stringify({ logicalContext: "all" }), currentExactSignatures: [signature(value)] });
    const db12 = { contractVersion: "0.11.0", generatedAt: "x", sourceDb11: { sha256: "db11" }, sourceCurrentTeamAnalysis: { sha256: "current" }, sourceDatabaseSha256: "database", semanticPromotionCount: 0, matchedStateCount: 3,
        exactTurnEncodingCandidates: [candidate("1:1:initial", 3, "db-exact"), candidate("3:3:initial", 5, "db-ambiguous-a")],
        diagnosticCurrentExactTurnAtoms: [
            { stateKey: "1:1:initial", atom: { value: 3, structuralSignature: signature(3) }, sourceRuleKeys: ["current-exact"] },
            { stateKey: "3:3:initial", atom: { value: 5, structuralSignature: signature(5) }, sourceRuleKeys: ["current-ambiguous"] },
        ] } as any;
    return { db11, current, db12 };
}

describe("database Team Analysis DB13 rule alignment", function () {
    it("emits only unique exact-set or effect-signature anchors", () => {
        const { db11, current, db12 } = fixture(); const dataset = buildDatabaseTeamAnalysisDb13Dataset({ db11, db11Sha256: "db11", db12, db12Sha256: "db12", current, currentSha256: "current", siteAudit: { formProjectionAliases: [] } as any });
        equal(dataset.ruleAlignments.length, 2); equal(dataset.ruleAlignments[0].kind, "exact_effect_set_unique"); equal(dataset.ruleAlignments[1].kind, "unique_effect_signature_anchor");
        equal(dataset.ambiguousEffectSignatures.length, 1); equal(dataset.exactTurnRuleAssessments[0].status, "rule_aligned_unique_effect_shape"); equal(dataset.exactTurnRuleAssessments[1].status, "rule_unaligned");
        const coverage = buildDatabaseTeamAnalysisDb13Coverage(dataset, db11, current, { formProjectionAliases: [] } as any); equal(coverage.alignedDatabaseRuleCount, 2); equal(coverage.ambiguousEffectSignatureCount, 1);
        equal(renderDatabaseTeamAnalysisDb13Report(dataset, coverage).includes("1 exact-turn candidate(s)"), true); equal(renderDatabaseTeamAnalysisDb13Report(dataset, coverage).includes("1 remain unaligned"), true);
    });
    it("rejects a DB12 artifact from another DB11 hash", () => {
        const { db11, current, db12 } = fixture(); db12.sourceDb11.sha256 = "other";
        throws(() => buildDatabaseTeamAnalysisDb13Dataset({ db11, db11Sha256: "db11", db12, db12Sha256: "db12", current, currentSha256: "current", siteAudit: { formProjectionAliases: [] } as any }), /source lineage mismatch/);
    });
});
