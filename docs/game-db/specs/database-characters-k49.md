# Database Characters K49 - leader value semantic scope audit

Status: offline, source-bound scope audit GO. Opaque projection, HP/ATK/DEF
semantics, selectors/bitmasks, clause composition, product replacement,
consumer, apply/overlay, authority, production, publisher, network, R2 and
Android remain NO-GO. Contract version `1.0.0`.

## Boundary

K49 audits the eight typed `leader_skills` columns from the exact pinned K3
sidecar and joins all effect references from source-bound K48. Raw values stay
opaque. Description text is reduced immediately to a boolean, is never emitted
or used as identity/join input, and can support only a `partial` audit label.

The one admitted partial family requires efficacy type `82`, a three-position
vector, timing `1`, zero in position 2, and an exact description occurrence of
`HP, ATK (&|AND) DEF +N%` whose `N` equals vector position 1. This does not
derive HP/ATK/DEF behavior: selector meaning, calculation mode, target meaning,
timing meaning, causality, multiple-clause composition and product semantics
all remain unknown.

## Invocation and safety

```text
npm run audit:database-characters-leader-value-scope -- \
  --sidecar-root <exact-k0-k7-root> \
  --production-root <exact-k7-production-root> \
  --fyi-root <exact-k7-fyi-root> \
  --k43-root <exact-k43-artifact-root> \
  --k46-root <exact-k46-artifact-root> \
  --k48-root <exact-k48-artifact-root>
```

The runner requires `--expose-gc`, validates K48 source-bound before and after
the audit, loads the exact bounded K3 sidecar twice, and requires stable source
identities and structural/value fingerprints. It writes no payload or local
artifact; the deterministic report is stdout-only, timestamp-free and smaller
than 64 KiB. RSS is sampled during execution and must remain below the
exclusive 1 GiB limit.

## Real result

| Measure | Count |
| --- | ---: |
| included effect references | 49,435 |
| unique effect rows | 16,119 |
| efficacy-type domain | 23 |
| type 82 rows / references | 3,853 / 12,310 |
| partial rows / references | 3,848 / 12,296 |
| unknown rows / references | 12,271 / 37,139 |
| type 82 description outliers | 5 |
| missing rows / structural mismatches | 0 / 0 |

The first real attempt failed closed because its correlation checked only the
first HP/ATK/DEF occurrence. Local evidence showed 1,046 valid second-clause
matches and five real outliers. The corrected classifier checks every exact
phrase-bound occurrence and keeps all five outliers unknown: four legacy flat
bonuses without `%` and one vector/text disagreement.

Two complete post-correction runs produced byte-identical 7,708-byte reports
with SHA-256
`bf80061b70ac9630cee74b7bffebb34a440e4fabda98fa3e4e69c76a3af31844`.
Both passed K48 source-bound validation before/after, exact K3 reload and the
exclusive RSS bound. The specialized contract reviewer found no remaining
P0-P2.

## Readiness and frontier

| Scope | Decision |
| --- | --- |
| offline leader-value scope audit | **GO** |
| opaque partial projection | **NO-GO** |
| HP/ATK/DEF or selector semantics | **NO-GO** |
| clause composition or calculation/target/timing semantics | **NO-GO** |
| presentation or product consumer | **NO-GO** |
| apply/overlay, authority or production | **NO-GO** |
| publisher, network or R2 | **NO-GO** |
| Android | **NO-GO** |

K49 establishes provenance and the limit of current evidence; it does not
authorize a value projection. Advancing requires first-party evidence for the
opaque fields and a product decision for clause composition. Partial and
unknown data must not be promoted as authority.
