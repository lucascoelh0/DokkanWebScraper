"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderDatabaseTeamAnalysisDb49Report = void 0;
function renderDatabaseTeamAnalysisDb49Report(coverage) {
    return `# DB49 — Forced guard native semantics

DB49 follows passive \`efficacy_type = 78\` from \`passive_skills\` through its exact dispatch slot and no-value registration, the defender-presence queries, \`DPuzzleGameCalcData::checkGuard\`, and the two bounded damage consumers. The handler does not read \`eff_value1..3\` or \`calc_option\`; those values remain raw and do not define this boolean effect.

## Proved semantics

- Presence of efficacy 78 makes \`checkGuard\` return true independently of normal element affinity, efficacy 24, and the two other boolean inputs.
- \`getGuardCoef()\` returns exactly \`0.5\`. Both damage paths multiply the current intermediary integer damage by that coefficient as floating point and convert toward zero to an integer.
- Player-source order: after enemy DEF, before efficacy-13 mitigation.
- Enemy-source order: after efficacy-13 mitigation, counter resistance, player DEF, and critical correction; before increased-damage-received and later clamps.
- The enemy path is ABI-bound: the masked \`checkGuard\` result is stored at caller \`[sp,#0x18]\`, recovered by the callee from the equivalent frame slot, and gates the coefficient call.

## Coverage

| Metric | Count |
|---|---:|
| SQLite efficacy-78 rows | ${coverage.sqliteRowCount} |
| Projected unique SQLite rows | ${coverage.projectedUniqueSqliteRowCount} |
| SQLite rows outside character projection | ${coverage.unprojectedSqliteRowCount} |
| Rules / effects | ${coverage.ruleCount} / ${coverage.sourceEffectCount} |
| Passive IDs / states | ${coverage.passiveSkillCount} / ${coverage.affectedStateCount} |
| Supported effect / target | ${coverage.supportedEffectCount} / ${coverage.supportedTargetCount} |
| Supported / unknown timing | ${coverage.supportedTimingCount} / ${coverage.unknownTimingCount} |
| Once-only enabled | ${coverage.onceOnlyEnabledCount} |
| Legacy representation matches / conflicts | ${coverage.legacyRepresentationMatchCount} / ${coverage.legacyRepresentationConflictCount} |

Targets are self (${coverage.ruleCountsByTarget.self ?? 0}), Super-class allies (${coverage.ruleCountsByTarget.super_class_allies ?? 0}), and team allies (${coverage.ruleCountsByTarget.team_allies ?? 0}). Timing, target, lifecycle, condition, and probability remain independent from the guard operation.

## Deferred candidate and boundaries

The short comparison selected efficacy 78 over the type-28 HP-factor tail because it affects 305 projected rules across 267 states and has a complete SQLite → runtime object → guard decision → damage coefficient chain. Type 28 affects only 21 projected rules and remains deferred.

DB49 does not promote probability application, recurrence/reset/expiry, cross-status removal order, attack-kind partition, final HP application, or the separate use of efficacy 78 as an input to the element-coefficient path. Those remain partial or unknown.
`;
}
exports.renderDatabaseTeamAnalysisDb49Report = renderDatabaseTeamAnalysisDb49Report;
//# sourceMappingURL=team-analysis-db49-report.js.map