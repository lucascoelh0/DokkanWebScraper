"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateDatabaseTeamAnalysisDb31Dataset = void 0;
const team_analysis_db31_builder_1 = require("./team-analysis-db31-builder");
function validateDatabaseTeamAnalysisDb31Dataset(d, source) { const failures = [], expected = new Map(); for (const s of source.states)
    for (const r of s.passive?.rules ?? []) {
        const k = `${s.stateKey}|${r.ruleKey}`;
        if (expected.has(k))
            failures.push(`duplicate source ${k}`);
        expected.set(k, { passiveSkillId: r.source.passiveSkillId, raw: r.source.calculationOption, effectCount: r.effects.length });
    } const seen = new Set(); let lossless = 0; for (const r of d.ruleProjections) {
    const k = `${r.stateKey}|${r.ruleKey}`, x = expected.get(k);
    if (seen.has(k))
        failures.push(`duplicate projection ${k}`);
    seen.add(k);
    if (!x) {
        failures.push(`unexpected projection ${k}`);
        continue;
    }
    if (r.passiveSkillId !== x.passiveSkillId || JSON.stringify(r.rawCalculationOption) !== JSON.stringify(x.raw) || r.effectCount !== x.effectCount)
        failures.push(`lossless mismatch ${k}`);
    else
        lossless++;
    if (r.provenance.database.table !== "passive_skills" || r.provenance.database.rowId !== r.passiveSkillId || r.provenance.database.column !== "calc_option")
        failures.push(`database provenance mismatch ${k}`);
    const n = (0, team_analysis_db31_builder_1.parseDb31CalculationOption)(r.rawCalculationOption);
    const known = Number.isSafeInteger(n) && n >= 0 && n <= 4;
    if ((r.operation.status === "supported") !== known)
        failures.push(`support boundary mismatch ${k}`);
    if (Object.values(r.independentDimensions).some(v => v !== "unknown"))
        failures.push(`independent dimension promoted ${k}`);
} if (seen.size !== expected.size)
    failures.push(`cardinality ${seen.size}/${expected.size}`); if (d.enumValues.map(v => v.raw).join(",") !== "0,1,2,3,4")
    failures.push("enum domain/order mismatch"); return { schemaVersion: 1, valid: failures.length === 0, ruleCount: d.ruleProjections.length, losslessReconstructionCount: lossless, failures }; }
exports.validateDatabaseTeamAnalysisDb31Dataset = validateDatabaseTeamAnalysisDb31Dataset;
//# sourceMappingURL=team-analysis-db31-validator.js.map