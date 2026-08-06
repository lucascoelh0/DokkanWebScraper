"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderDatabaseTeamAnalysisDb35Report = void 0;
const rows = (x) => Object.entries(x).map(([k, v]) => `| \`${k}\` | ${v} |`).join("\n");
function renderDatabaseTeamAnalysisDb35Report(d, c) {
    return `# Database Team Analysis experiment — DB35 passive target dispatch

DB35 follows \`passive_skills.target_type\` from the SQLite row into the runtime status getter and the 17-slot \`AbilityEfficacyTarget\` dispatch. It proves all nine values present in projected passive rules without deriving timing, operation, bucket or lifecycle from target selection.

- Supported rules/effects: **${c.supportedRuleCount}/${c.supportedEffectCount}**.
- Passive IDs/states: **${c.passiveSkillCount}/${c.affectedStateCount}**.
- Rules with a nonzero raw SQLite sub-target set ID: **${c.rulesWithNonzeroRawSubTargetSetIdCount}**.
- Unknown current rules: **${c.unknownRuleCount}**.

| Native target | Rules |
|---|---:|
${rows(c.ruleCountsByTarget)}

## Proven selection boundary

Values 1/2/3/4 select the ability owner, player-party indices 0–6, the stored enemy target with owner-target fallback, and every current enemy respectively. Values 12/13 filter player-party candidates by raw awakening-class predicates \`{1,3}\`/\`{2,3}\`; 14/15 apply the same predicates to enemy candidates. Value 16 iterates the player party and excludes the ability owner's deck index under the independently proved projected-passive category-0 precondition. Inclusion here describes the candidate set before the independent sub-target predicate; it does not guarantee that a candidate reaches the efficacy callback.

Each handler calls a native sub-target predicate before the efficacy callback. DB35 proves that control-flow position, but does not yet prove the object-field chain from SQLite \`sub_target_type_set_id\` to that predicate. The 847 nonzero SQLite IDs are therefore retained only as raw values with an unknown runtime association; value-type and boolean-composition semantics are also unknown.

## Unknowns and legacy boundary

Dispatch slot 6 is null. Slots 0, 5 and 7–11 are retained by symbol/address but are absent from projected passive rules and receive no semantic promotion. Duration, recurrence, expiry, reset and calculation bucket remain independent. The legacy dataset has only aggregate target scopes and no first-party rule identity, so DB35 records zero directly comparable rules and no claimed agreement or conflict.
`;
}
exports.renderDatabaseTeamAnalysisDb35Report = renderDatabaseTeamAnalysisDb35Report;
//# sourceMappingURL=team-analysis-db35-report.js.map