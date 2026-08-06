# Database Team Analysis experiment v19 (DB20)

Status: experimental, non-production. Contract version: `0.19.0`.

DB20 investigates the largest DB19 residual cluster: current-only, otherwise absent, non-negated `turn_from_entry <= N` predicates in a conjunctive context. It joins each aligned database rule back to its `passive_skills` row through the DB11 `passiveSkillId` and records the structured `turn`, `is_once`, `exec_timing_type`, and `efficacy_type` fields with row provenance.

The gate distinguishes numeric correlation from semantics. Native evidence confirms that causality type 51 reads its own `cau_val1` payload to implement an inclusive appearance-turn upper bound. It does not read `passive_skills.turn`, `is_once`, or execution timing. Across type-51 joins, `passive_skills.turn` frequently differs from `cau_val1`, so DB20 must not reinterpret `turn` as a universal appearance-turn predicate.

Every DB20 correlation therefore remains semantically `unknown`, including exact numeric matches. The gate inherits three prior semantic promotions, introduces zero new promotions, performs no compatibility rewrite, and preserves mismatches as first-class evidence.

The artifact is `team-analysis-db20-passive-turn-correlation.json.gz`; coverage, a Markdown report, golden validation, deterministic rebuild validation, and the source database read-only fingerprint guard are generated alongside it under the ignored `data/database-experiment/` directory.
