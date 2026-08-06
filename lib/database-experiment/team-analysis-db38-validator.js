"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateDatabaseTeamAnalysisDb38Dataset = void 0;
const team_analysis_db38_builder_1 = require("./team-analysis-db38-builder");
const id = (v) => v == null ? undefined : String(v), int32 = (v) => typeof v === "number" && Number.isSafeInteger(v) && v >= -2147483648 && v <= 2147483647 ? v : typeof v === "string" && v.trim() !== "" && Number.isSafeInteger(Number(v)) && Number(v) >= -2147483648 && Number(v) <= 2147483647 ? Number(v) : undefined;
const independentDimensions = { condition: "independent", target: "inherited_db36", timing: "independent", calculationOperation: "independent", unit: "output_field_dependent", calculationBucket: "partial", duration: "inherited_db37", onceOnly: "inherited_db37", recurrence: "partial", reset: "unknown" };
const legacyKinds = ["atk", "def", "critical_chance", "evade_chance", "damage_reduction", "ki"];
function validateDatabaseTeamAnalysisDb38Dataset(d, db37, db11, tables, x) { const failures = []; if (d.schemaVersion !== 1 || d.contract !== "dokkan-team-analysis-incremental-status-native-semantics-experiment" || d.contractVersion !== "0.37.0" || d.inheritedSemanticPromotionCount !== 31 || d.semanticPromotionCount !== 8)
    failures.push("contract identity"); if (d.generatedAt !== db37.generatedAt || d.generatedAt !== db11.generatedAt || d.sourceSnapshotVersion !== db37.sourceSnapshotVersion || d.sourceSnapshotVersion !== db11.sourceSnapshotVersion || d.sourceDatabaseSha256 !== db37.sourceDatabaseSha256 || d.sourceDatabaseSha256 !== db11.sourceSha256)
    failures.push("source lineage"); if (JSON.stringify(d.sourceDb37) !== JSON.stringify({ fileName: "team-analysis-db37-passive-lifecycle.json.gz", sha256: x.db37Sha256, contractVersion: "0.36.0" }) || JSON.stringify(d.sourceDb11) !== JSON.stringify({ fileName: "team-analysis-db11-experiment.json.gz", sha256: x.db11Sha256, contractVersion: "0.10.0" }))
    failures.push("artifact lineage"); if (JSON.stringify(d.nativeRuntime) !== JSON.stringify({ fileName: "libcocos2dcpp.so", sha256: x.nativeSha256, sizeBytes: x.nativeSizeBytes }) || JSON.stringify(d.nativeEvidence) !== JSON.stringify({ fileName: "native-incremental-status-semantics.json", sha256: x.evidenceSha256 }))
    failures.push("runtime lineage"); const rows = new Map((tables.passive_skills ?? []).map(r => [id(r.id), r])), source = new Map(db37.ruleLifecycles.map(r => [`${r.stateKey}|${r.ruleKey}`, r])), legacy = new Map(); for (const s of db11.states)
    for (const r of s.passive?.rules ?? [])
        legacy.set(`${s.stateKey}|${r.ruleKey}`, r.effects[0]?.kind ?? null); const roles = x.evidence.codeRegions.map(r => r.role), seen = new Set(); let losslessReconstructionCount = 0; for (const r of d.ruleIncrements) {
    const key = `${r.stateKey}|${r.ruleKey}`, src = source.get(key), row = rows.get(r.passiveSkillId), current = legacy.get(key) ?? null;
    if (seen.has(key))
        failures.push(`duplicate ${key}`);
    seen.add(key);
    if (!src || !row || int32(row.efficacy_type) !== 98 || src.passiveSkillId !== r.passiveSkillId || src.effectCount !== r.effectCount) {
        failures.push(`lossless ${key}`);
        continue;
    }
    losslessReconstructionCount++;
    const p = (0, team_analysis_db38_builder_1.projectDb38Incremental)(row.eff_value1, row.eff_value2, row.eff_value3);
    if (JSON.stringify(r.incremental) !== JSON.stringify(p) || r.rawCalculationOption !== row.calc_option || r.rawExecutionTimingType !== row.exec_timing_type || r.simulationStatus !== (p.status === "supported" ? "partial" : "unknown") || JSON.stringify(r.independentDimensions) !== JSON.stringify(independentDimensions))
        failures.push(`projection ${key}`);
    const selector = int32(row.eff_value3), expectedLegacy = selector !== undefined ? legacyKinds[selector] : undefined, conflict = selector === 5 && current === "ki", legacyStatus = conflict ? "confirmed_conflict" : current !== null && current === expectedLegacy ? "representation_match_not_authority" : "not_comparable";
    if (r.legacyComparison.currentKind !== current || r.legacyComparison.status !== legacyStatus)
        failures.push(`legacy ${key}`);
    const expectedLegacyProvenance = current !== null ? { sourceDb11RuleKey: r.ruleKey, sourceDb11Sha256: x.db11Sha256 } : undefined;
    if (JSON.stringify(r.provenance.database) !== JSON.stringify({ table: "passive_skills", rowId: r.passiveSkillId, columns: ["efficacy_type", "eff_value1", "eff_value2", "eff_value3", "calc_option", "exec_timing_type"] }) || JSON.stringify(r.provenance.runtime) !== JSON.stringify({ fileName: "libcocos2dcpp.so", sha256: x.nativeSha256, evidenceFile: "native-incremental-status-semantics.json", evidenceSha256: x.evidenceSha256, proofRoles: roles }) || JSON.stringify(r.provenance.legacy) !== JSON.stringify(expectedLegacyProvenance))
        failures.push(`provenance ${key}`);
} const expected = [...source.values()].filter(r => int32(rows.get(r.passiveSkillId)?.efficacy_type) === 98).length; if (seen.size !== expected || d.ruleIncrements.length !== expected)
    failures.push(`cardinality ${seen.size}/${expected}`); return { schemaVersion: 1, valid: failures.length === 0, ruleCount: d.ruleIncrements.length, losslessReconstructionCount, failures }; }
exports.validateDatabaseTeamAnalysisDb38Dataset = validateDatabaseTeamAnalysisDb38Dataset;
//# sourceMappingURL=team-analysis-db38-validator.js.map