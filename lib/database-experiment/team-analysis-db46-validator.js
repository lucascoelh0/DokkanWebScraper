"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateDatabaseTeamAnalysisDb46Dataset = void 0;
const team_analysis_db46_builder_1 = require("./team-analysis-db46-builder");
const key = (v) => `${v.stateKey}|${v.ruleKey}`;
function validateDatabaseTeamAnalysisDb46Dataset(d, s, nativeSha, nativeSize, evidenceSha) { const f = [], idx = new Map(s.timingRuleProjections.map(x => [key(x), x])); if (d.schemaVersion !== 1 || d.contract !== "dokkan-team-analysis-enemy-attack-timing-native-semantics-experiment" || d.contractVersion !== "0.45.0" || d.generatedAt !== s.generatedAt || d.sourceSnapshotVersion !== s.sourceSnapshotVersion || d.sourceDatabaseSha256 !== s.sourceDatabaseSha256 || JSON.stringify(d.sourceDb45) !== JSON.stringify({ fileName: "team-analysis-db45-player-attack-post-damage-hp-factor.json.gz", sha256: "250f51aa35d08e33d9eae2c52e46ab055c5681cfd3953f27433ca9693101a643", contractVersion: "0.44.0" }) || JSON.stringify(d.nativeRuntime) !== JSON.stringify({ fileName: "libcocos2dcpp.so", sha256: nativeSha, sizeBytes: nativeSize }) || JSON.stringify(d.nativeEvidence) !== JSON.stringify({ fileName: "native-enemy-attack-timing-semantics.json", sha256: evidenceSha }) || d.inheritedSemanticPromotionCount !== 58 || d.semanticPromotionCount !== 2)
    f.push("identity/lineage"); if (d.ruleTimings.length !== s.timingRuleProjections.length || new Set(d.ruleTimings.map(key)).size !== d.ruleTimings.length)
    f.push("cardinality"); let ok = 0; for (const v of d.ruleTimings) {
    const p = idx.get(key(v));
    if (!p) {
        f.push(`missing ${key(v)}`);
        continue;
    }
    const expected = (0, team_analysis_db46_builder_1.projectDb46Timing)(v.rawExecutionTimingType);
    if (v.passiveSkillId !== p.passiveSkillId || v.rawExecutionTimingType !== p.rawExecutionTimingType || v.effectCount !== p.effectCount || JSON.stringify(v.calculationOperation) !== JSON.stringify(p.calculationOperation) || JSON.stringify(v.independentDimensions) !== JSON.stringify(p.independentDimensions))
        f.push(`reconstruction ${key(v)}`);
    else if (expected) {
        const runtime = { fileName: "libcocos2dcpp.so", sha256: nativeSha, evidenceFile: "native-enemy-attack-timing-semantics.json", evidenceSha256: evidenceSha, proofRoles: ["execution_filter", "enemy_attack_setup"] };
        if (JSON.stringify(v.executionTiming) !== JSON.stringify(expected) || JSON.stringify(v.provenance) !== JSON.stringify({ database: p.provenance.database, runtime }))
            f.push(`promotion ${key(v)}`);
        else
            ok++;
    }
    else if (JSON.stringify(v) !== JSON.stringify(p))
        f.push(`inherited mutation ${key(v)}`);
    else
        ok++;
} return { schemaVersion: 1, valid: f.length === 0, ruleCount: d.ruleTimings.length, losslessReconstructionCount: ok, failures: f }; }
exports.validateDatabaseTeamAnalysisDb46Dataset = validateDatabaseTeamAnalysisDb46Dataset;
//# sourceMappingURL=team-analysis-db46-validator.js.map