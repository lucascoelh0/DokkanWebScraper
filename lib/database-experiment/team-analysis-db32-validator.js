"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateDatabaseTeamAnalysisDb32Dataset = void 0;
const team_analysis_db32_builder_1 = require("./team-analysis-db32-builder");
function validateDatabaseTeamAnalysisDb32Dataset(d, db11, db31) { const failures = []; if (d.contractVersion !== "0.31.0" || d.sourceDb11.contractVersion !== "0.10.0" || d.sourceDb31.contractVersion !== "0.30.0")
    failures.push("contract identity"); const source = new Map(); for (const s of db11.states)
    for (const r of s.passive?.rules ?? [])
        source.set(`${s.stateKey}|${r.ruleKey}`, r); const ops = new Map(db31.ruleProjections.map(r => [`${r.stateKey}|${r.ruleKey}`, r])); const seen = new Set(); let lossless = 0; for (const r of d.ruleTimings) {
    const k = `${r.stateKey}|${r.ruleKey}`, x = source.get(k), op = ops.get(k);
    if (seen.has(k))
        failures.push(`duplicate ${k}`);
    seen.add(k);
    if (!x || !op) {
        failures.push(`unexpected ${k}`);
        continue;
    }
    if (r.passiveSkillId !== x.source.passiveSkillId || JSON.stringify(r.rawExecutionTimingType) !== JSON.stringify(x.source.executionTimingType) || r.effectCount !== x.effects.length || JSON.stringify(r.calculationOperation) !== JSON.stringify(op.operation))
        failures.push(`lossless mismatch ${k}`);
    else
        lossless++;
    const known = Number.isSafeInteger((0, team_analysis_db32_builder_1.parseDb32ExecutionTiming)(r.rawExecutionTimingType)) && (0, team_analysis_db32_builder_1.parseDb32ExecutionTiming)(r.rawExecutionTimingType) === 1;
    if ((r.executionTiming.status === "supported") !== known)
        failures.push(`support boundary ${k}`);
    if (known && (r.executionTiming.event !== "turn_start" || r.executionTiming.sequence !== "after_character_appearance_and_reversible_fix_before_support_memory_and_potential_skills" || !r.provenance.runtime))
        failures.push(`supported semantics ${k}`);
    if (!known && r.provenance.runtime)
        failures.push(`unknown runtime provenance ${k}`);
    if (Object.values(r.independentDimensions).some(v => v !== "unknown"))
        failures.push(`independent dimension ${k}`);
    if (r.provenance.database.rowId !== r.passiveSkillId || r.provenance.database.column !== "exec_timing_type")
        failures.push(`provenance ${k}`);
} if (seen.size !== source.size || seen.size !== ops.size)
    failures.push(`cardinality ${seen.size}/${source.size}/${ops.size}`); return { schemaVersion: 1, valid: failures.length === 0, ruleCount: d.ruleTimings.length, losslessReconstructionCount: lossless, failures }; }
exports.validateDatabaseTeamAnalysisDb32Dataset = validateDatabaseTeamAnalysisDb32Dataset;
//# sourceMappingURL=team-analysis-db32-validator.js.map