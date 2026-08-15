# Database Characters K50 - native leader-skill semantics audit

Status: offline, source-bound native audit GO. Type-82 field semantics are
supported as first-party runtime evidence. Target-type names, sub-target domain
meanings, causality behavior, battle lifecycle, stacking/composition, product
projection, authority, production, publisher, network, R2 and Android remain
NO-GO. Contract version `1.0.0`.

## Boundary

K50 validates the exact pinned AArch64 `libcocos2dcpp.so` against a tracked,
content-pinned native evidence descriptor. It verifies eight exact code-region
hashes, seven SQLite column literals and object offsets, the `TeamingPower`
efficacy dispatch initializer and all 15 named GOT bindings. Type 82 is bound
to the native `leaderSkillElementTypeHpAtkDef` handler.

The handler reads vector position 0 as an element-or-awakening bitmask and
position 1 as the common HP/ATK/DEF modifier. It does not read position 2.
`calc_option=0` emits flat points; `calc_option=2` divides the modifier by 100
and emits the same proportional value for HP, ATK and DEF. The `TeamingPower`
calculator filters candidates through the target/sub-target path and adds
matching row contributions. The battle ability factory separately proves that
the runtime fields are transferred into passive-status construction.

Those facts do not name the target enums, interpret any sub-target domain or
causality JSON, or prove battle lifecycle and final stacking/composition.
Consequently K50 is evidence-only and cannot create a product projection.

## Invocation and safety

```text
npm run audit:database-characters-leader-native-semantics -- \
  --sidecar-root <exact-k0-k7-root> \
  --production-root <exact-k7-production-root> \
  --fyi-root <exact-k7-fyi-root> \
  --k43-root <exact-k43-artifact-root> \
  --k46-root <exact-k46-artifact-root> \
  --k48-root <exact-k48-artifact-root> \
  --native-runtime <exact-libcocos2dcpp.so>
```

The runner requires `--expose-gc`, validates K48 source-bound before and after,
recomputes the pinned K49 scope, loads K3 twice, and reads/validates the exact
ELF twice with stable proof identity. It writes no payload or artifact and has
no writer, publisher, network, R2 or Android path. Its deterministic stdout is
timestamp-free, below 64 KiB, and execution is fail-closed below an exclusive
1 GiB RSS ceiling.

## Real result

| Measure | Count |
| --- | ---: |
| type-82 rows / K48 references | 3,853 / 12,310 |
| flat-point rows (`calc_option=0`) | 4 |
| proportional rows (`calc_option=2`) | 3,849 |
| mask / modifier domains | 38 / 36 |
| target raw enum domain | 3 (`2`, `12`, `13`) |
| non-null causality rows retained unresolved | 17 |
| invalid vectors / nonzero ignored position | 0 / 0 |
| native code regions / dispatch entries | 8 / 15 |

Two complete real executions produced byte-identical 8,001-byte reports with
SHA-256
`27b484577e2727805b6b9aeae7861f4f00cf2ee18f357f173ffe613e39595802`
and empty stderr.

## Readiness

| Scope | Decision |
| --- | --- |
| offline native leader audit | **GO** |
| type-82 field semantics | **GO** |
| target/sub-target names and meanings | **NO-GO** |
| causality, lifecycle and stacking/composition | **NO-GO** |
| product projection, consumer or authority | **NO-GO** |
| production, publisher, network or R2 | **NO-GO** |
| Android | **NO-GO** |
