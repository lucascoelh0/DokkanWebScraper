# Integration C3 — structural joins and shadow parity

## Objective and boundary

C3 compares the supported-only C2 sidecar with the current production Team Analysis without changing either contract. It joins states only by `stateKey` and does not use character names, localized text, parser rule IDs, or HTML layout as identity.

Acceptance requires verified source hashes, lossless retention of every C2 rule, deterministic generation, real structural fixtures, zero invented conflicts, and explicit classification of every rule as `agreement`, `representation_gain`, `confirmed_conflict`, `unjoinable`, or `unknown`.

## Comparison semantics

The current production contract does not carry first-party passive-skill, rule, or effect IDs. Consequently:

- an exact kind/value/unit/target representation in the joined state is `agreement`, but only at representation level;
- an absent comparable effect kind is `representation_gain`;
- a differing comparable representation is `unknown`, not a conflict;
- an absent identical `stateKey` is `unjoinable`;
- `confirmed_conflict` is reserved for a future common structural rule/effect identity.

Damage mitigation maps only its proved reduction contribution to production `damage_reduction`; forced guard maps to boolean `guard`; counter resistance has no production representation. Targets with localized category/class labels and no common first-party selector IDs remain non-comparable.

## Real fixtures

Fixtures cover an active-skill transformation, reversible exchange, standby form, finish form, EZA, SEZA, and an auxiliary form. Each fixture is verified against the C2 state identities and current character transformation IDs/source relationships.
