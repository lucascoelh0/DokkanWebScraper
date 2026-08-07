"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderDatabaseTeamAnalysisDb48Report = void 0;
const renderDatabaseTeamAnalysisDb48Report = (c) => `# DB48 efficacy 13 damage mitigation

DB48 closes the deferred DB47 mitigation chain without using localized text or the legacy projector as authority. The type-13 handler reads only \`eff_value1\`, converts it to \`float32\` and registers a remaining-damage rate. The native aggregate starts at 100, subtracts \`100 - storedRate\` for each matching deck/category record in efficacy-info order, then clamps to 0–100. Consequently, one record contributes \`100 - eff_value1\` percentage points of damage reduction; this is an aggregate operation, not \`SkillCalcOption\`.

The aggregate is consumed in both action banks. Player-source damage applies it after enemy DEF and optional guard; enemy-source damage applies it before counter resistance, player DEF and guard. The two paths use observably different truncation order, so the contract records separate formulas. Both results remain intermediary values, not final HP application.

- SQLite type-13 rows: **${c.sqliteRowCount}**; projected unique rows: **${c.projectedUniqueSqliteRowCount}**; rows outside current character-state projection: **${c.unprojectedSqliteRowCount}**.
- Projected rules / effects / passive IDs / states: **${c.ruleCount}/${c.sourceEffectCount}/${c.passiveSkillCount}/${c.affectedStateCount}**.
- Supported input / target / timing rules: **${c.supportedInputRuleCount}/${c.supportedTargetRuleCount}/${c.supportedTimingRuleCount}**; timing remains unknown for **${c.unknownTimingRuleCount}**.
- Existing pre-native DB projector representations matching the proved projection: **${c.legacyRepresentationMatchCount}**; conflicts: **${c.legacyRepresentationConflictCount}**. This comparison is non-authoritative and is not a claim of exact HTML-parser rule identity.

## Preserved boundaries

\`calc_option\`, \`eff_value2\` and \`eff_value3\` are preserved but not applied by the type-13 handler. Condition order, probability application, regular/Super/Ultra/Unit/EX partition, final HP application, removal/reapplication order and lifecycle stacking remain unknown. DB48 does not turn a supported timing into a damage bucket or vice versa.
`;
exports.renderDatabaseTeamAnalysisDb48Report = renderDatabaseTeamAnalysisDb48Report;
//# sourceMappingURL=team-analysis-db48-report.js.map