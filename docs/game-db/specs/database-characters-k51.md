# Database Characters K51 - native leader target semantics audit

Status: offline, source-bound native audit GO. Type-82 target scopes and all
currently referenced category filters are supported as first-party runtime
evidence. Causality, battle lifecycle, battle stacking/composition, product
projection, authority, production, publisher, network, R2 and Android remain
NO-GO. Contract version `1.0.0`.

## Boundary

K51 bridges three exact evidence lines on the same pinned AArch64 ELF:

- K50 proves LeaderSkill construction, type-82 dispatch and runtime-field
  transfer into the generic ability status;
- the pinned target-dispatch evidence proves raw target `2` as team allies,
  `12` as super-class allies and `13` as extreme-class allies;
- the pinned sub-target evidence proves the shared `SkillModel` lookup,
  `SubTargetTypeSet` sequential filter chain and value types `1`/`2` as
  include/exclude by structural card category ID.

The LeaderSkill-to-dispatch bridge is code-bound rather than inferred from
shared helpers. Exact call instructions and PLT/GOT relocations prove
`createLeaderSkill -> AbilityStatusPassive::create`; the manager vtable and
the exact indirect-call block prove registration through
`AbilityManager::addAbilityStatus`; the created passive-status vtable binds
the target/sub-target getters and `AbilityStatusCausality::exec`; and exact
calls then prove `exec -> process -> AbilityEfficacyCore::callEfficacyFunc`.
The bridge pins five code regions, four vtable bindings and four call sites.

The chain uses logical `AND`; an empty set is identity and a duplicate filter
is reapplied. K51 does not claim a stable physical SQLite row order because the
native query has no `ORDER BY`. No localized category name is read or emitted.

## Invocation and safety

```text
npm run audit:database-characters-leader-target-semantics -- \
  --sidecar-root <exact-k0-k7-root> \
  --production-root <exact-k7-production-root> \
  --fyi-root <exact-k7-fyi-root> \
  --k43-root <exact-k43-artifact-root> \
  --k46-root <exact-k46-artifact-root> \
  --k48-root <exact-k48-artifact-root> \
  --native-runtime <exact-libcocos2dcpp.so>
```

The runner requires `--expose-gc`, recomputes the K49/K50 pins, validates K48
source-bound before and after, loads K3 values twice, loads a separate bounded
target-only K3 view twice, and validates all native evidence twice. It is
stdout-only, timestamp-free and fail-closed below an exclusive 1 GiB RSS
ceiling. It has no writer, publisher, network, R2 or Android path.

## Real result

| Measure | Count |
| --- | ---: |
| type-82 rows / K48 references | 3,853 / 12,310 |
| refs with filter set / empty identity | 9,040 / 3,270 |
| distinct nonzero sets | 625 |
| joined target rows / expanded occurrences | 1,588 / 15,988 |
| category include / exclude rows | 883 / 705 |
| partial or unsupported target rows | 0 |
| raw target 2 / 12 / 13 rows | 3,788 / 37 / 28 |
| target / sub-target native code regions | 20 / 19 |
| runtime bridge code regions / vtable bindings / call sites | 5 / 4 / 4 |

Two complete real executions produced byte-identical 7,875-byte reports with
SHA-256
`f14fb07fa68ca36dcae121c741281d58e335658a9daf1c3392b2681c742da063`
and empty stderr.

## Readiness

| Scope | Decision |
| --- | --- |
| offline leader target audit | **GO** |
| type-82 target scopes and category filters | **GO** |
| causality, lifecycle and stacking/composition | **NO-GO** |
| product projection, consumer or authority | **NO-GO** |
| production, publisher, network or R2 | **NO-GO** |
| Android | **NO-GO** |
