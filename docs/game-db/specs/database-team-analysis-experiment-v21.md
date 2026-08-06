# Database Team Analysis experiment v21 (DB22)

Status: experimental, non-production. Contract version: `0.21.0`.

DB22 replaces DB18's flattened-signature deletion with a projection from the original current Team Analysis condition AST. It first reproduces every DB15 current signature multiset exactly, then removes only non-negated `turn_from_entry >= 1` predicates under the DB17-confirmed normal appearance lifecycle. Recursive boolean identities remove `always` children and collapse single-child `all` or `any` nodes before signatures are projected again.

This avoids inferring parent structure from flattened logical-context strings. The gate preserves DB18 database-side compatibility aliases, validates the current dataset hash and per-rule identity, inherits three semantic promotions, and introduces none. It does not use or reinterpret passive text and does not assign semantics to `passive_skills.turn`.
