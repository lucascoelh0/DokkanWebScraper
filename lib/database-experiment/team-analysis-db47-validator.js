"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateDatabaseTeamAnalysisDb47Dataset = void 0;
const team_analysis_db47_builder_1 = require("./team-analysis-db47-builder");
const key = (x) => `${x.stateKey}|${x.ruleKey}`, SHA = "6bc13b29197a5fcbca6d52f484377a0bd65cf48d4750a4604461f64f2bd6f837", ROLES = ["execution_filter", "timing_owner", "move_end_caller", "controller_virtual_callback_handler"];
function validateDatabaseTeamAnalysisDb47Dataset(d, s, nativeSha, nativeSize, eSha) { const f = [], idx = new Map(s.ruleTimings.map(x => [key(x), x])); if (d.schemaVersion !== 1 || d.contract !== "dokkan-team-analysis-puzzle-move-end-timing-native-semantics-experiment" || d.contractVersion !== "0.46.0" || d.generatedAt !== s.generatedAt || d.sourceSnapshotVersion !== s.sourceSnapshotVersion || d.sourceDatabaseSha256 !== s.sourceDatabaseSha256 || JSON.stringify(d.sourceDb46) !== JSON.stringify({ fileName: "team-analysis-db46-enemy-attack-timing.json.gz", sha256: SHA, contractVersion: "0.45.0" }) || JSON.stringify(d.nativeRuntime) !== JSON.stringify({ fileName: "libcocos2dcpp.so", sha256: nativeSha, sizeBytes: nativeSize }) || JSON.stringify(d.nativeEvidence) !== JSON.stringify({ fileName: "native-puzzle-move-end-timing-semantics.json", sha256: eSha }) || d.inheritedSemanticPromotionCount !== 60 || d.semanticPromotionCount !== 1)
    f.push("identity/lineage"); if (d.ruleTimings.length !== s.ruleTimings.length || new Set(d.ruleTimings.map(key)).size !== d.ruleTimings.length)
    f.push("cardinality"); let ok = 0; for (const v of d.ruleTimings) {
    const p = idx.get(key(v));
    if (!p) {
        f.push(`missing ${key(v)}`);
        continue;
    }
    const expected = (0, team_analysis_db47_builder_1.projectDb47Timing)(v.rawExecutionTimingType);
    if (v.passiveSkillId !== p.passiveSkillId || v.rawExecutionTimingType !== p.rawExecutionTimingType || v.effectCount !== p.effectCount || JSON.stringify(v.calculationOperation) !== JSON.stringify(p.calculationOperation) || JSON.stringify(v.independentDimensions) !== JSON.stringify(p.independentDimensions))
        f.push(`reconstruction ${key(v)}`);
    else if (expected) {
        const runtime = { fileName: "libcocos2dcpp.so", sha256: nativeSha, evidenceFile: "native-puzzle-move-end-timing-semantics.json", evidenceSha256: eSha, proofRoles: ROLES };
        if (JSON.stringify(v.executionTiming) !== JSON.stringify(expected) || JSON.stringify(v.provenance) !== JSON.stringify({ database: p.provenance.database, runtime }))
            f.push(`promotion ${key(v)}`);
        else
            ok++;
    }
    else if (JSON.stringify(v) !== JSON.stringify(p))
        f.push(`mutation ${key(v)}`);
    else
        ok++;
} return { schemaVersion: 1, valid: !f.length, ruleCount: d.ruleTimings.length, losslessReconstructionCount: ok, failures: f }; }
exports.validateDatabaseTeamAnalysisDb47Dataset = validateDatabaseTeamAnalysisDb47Dataset;
//# sourceMappingURL=team-analysis-db47-validator.js.map