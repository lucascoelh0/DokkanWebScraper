import { DatabaseTeamAnalysisDb43Coverage, DatabaseTeamAnalysisDb43Dataset } from "./team-analysis-db43-contract";
const rows = (values: Record<string, number>) => Object.entries(values).map(([value, count]) => `| ${value} | ${count} |`).join("\n");
export function renderDatabaseTeamAnalysisDb43Report(dataset: DatabaseTeamAnalysisDb43Dataset, coverage: DatabaseTeamAnalysisDb43Coverage): string {
    const missing = dataset.resolutions.filter(value => value.legacyComparison.currentState === "missing").map(value => `- \`${value.stateKey}\`, rule \`${value.ruleKey}\`, passive \`${value.passiveSkillId}\`.`).join("\n") || "- None.";
    return `# Database Team Analysis experiment — DB43 native guard disable

DB43 maps passive efficacy type \`24\` through its native dispatch handler and three independent guard consumers. The handler registers a no-value efficacy marker. Each consumer queries type 24 on the defender and passes the boolean to \`DPuzzleGameCalcData::checkGuard\`; presence suppresses the normal element-affinity guard result unless the independent efficacy-78 override is present.

- Resolved rules/states/passive IDs: **${coverage.resolutionCount}/${coverage.affectedStateCount}/${coverage.affectedPassiveSkillCount}**.
- Supported effects / partial records: **${coverage.supportedEffectCount}/${coverage.partialResolutionCount}**.
- Supported selected-enemy targets / empty sub-target identities: **${coverage.supportedTargetCount}/${coverage.emptySubTargetIdentityCount}**.
- Supported player-attack-setup timings / unknown timings: **${coverage.supportedTimingCount}/${coverage.unknownTimingCount}**.
- Current states present/missing: **${coverage.currentStatePresentCount}/${coverage.currentStateMissingCount}**.

## Proven native behavior

The guard formula is \`${dataset.resolutions[0]?.effect.nativeFormula}\`. Type 24 is the defender-side \`w2\` input in player intermediary damage, player attack setup and enemy attack setup. Its effect is boolean presence: it does not consume \`eff_value1..3\`, and the DB31 calculation operation is preserved but not applied by this no-value handler or guard consumer. All 34 current raw value triples are zero.

The selected-enemy candidate scope and empty sub-target identity are inherited from DB35/DB36. DB33 supplies timing independently: 33 rules execute during bounded player-attack setup and raw timing 5 remains unknown. DB37 supplies duration and once-only field mechanics; recurrence, reset/expiry and cross-status stacking remain partial or unknown.

## Declared calculation operations (not applied to the guard decision)

| Operation | Rules |
| --- | ---: |
${rows(coverage.calculationOptionCounts)}

## Duration and once-only fields

| Raw turn | Rules |
| ---: | ---: |
${rows(coverage.turnCounts)}

| Raw is_once | Rules |
| ---: | ---: |
${rows(coverage.onceOnlyCounts)}

## Legacy comparison boundary

The legacy dataset has no first-party rule identity and no supported guard-disable effect kind, so no semantic agreement or conflict is claimed. DB43 records 34 representation gains; one first-party state is absent from the older legacy snapshot:

${missing}

## Remaining unknowns

The product names and activation semantics of the independent efficacy-78 and attacker/player-mode overrides are outside this gate. The final damage formula, guard coefficient application order, calculation bucket, timing value 5, recurrence/reset/expiry epoch and cross-status removal/stacking order remain unknown. These boundaries prevent DB43 from claiming a complete damage simulator while still making guard-disable availability usable by Team Analysis.
`;
}
