# Database Team Analysis experiment v31 (DB32)

DB32 promotes only `passive_skills.exec_timing_type = 1` to the native
`turn_start` execution event. The contract is
`dokkan-team-analysis-execution-timing-native-semantics-experiment` `0.31.0`
and the artifact is `team-analysis-db32-execution-timing.json.gz`.

The proof follows the `exec_timing_type` SQLite literal into `PassiveSkill`
offset `0x38`, copies it into `CreateAbilityStatus` offset `0x14`, then into
`AbilityStatus` offset `0x08`. `AbilityManager::callAbilityStatusExec` reads
that field through the `AbilityStatusPassive` vtable and requires equality
with its timing argument. Two native turn-start paths pass literal value `1`.

The sequence is bounded: after character appearance and reversible-result
fixation, before support-memory and potential-skill execution. It does not
prove a calculation bucket, ATK/DEF phase, unit, target, duration, recurrence,
stacking, `turn`, or `is_once` interaction. All other observed timing values
remain raw `unknown`. Parser timing is aggregate comparison only.
