# Database Characters K53 - leader causality candidate collection audit

Status: offline native structural collection audit GO. The type-35 handler's
two known `deckIndex` collection branches are bound as first-party runtime
evidence. The branch effectively selected for observed leader skills, human
element names, lifecycle, death/removal, stacking, product projection,
authority, production, publisher, network, R2 and Android remain NO-GO.
Contract version `1.0.0`.

## Boundary

K53 wraps a complete real K52 audit with the exact K53 native proof loaded
before and after. It does not reinterpret `target_type=2` as a `deckIndex` and
does not claim that an observed leader selects either branch. It establishes
only the structural behavior inside the pinned type-35 handler and helper:

- `deckIndex=0` scans exactly seven indexed character records in `InGameData`;
- `deckIndex=1` scans the runtime puzzle-enemy vector at `InGameData+0x100` to
  `+0x108`, and an empty vector makes the condition false;
- every other `deckIndex` is unsupported by this contract.

For the player branch, each candidate runtime user-card reference is read at
`candidateIndex * 0x590 + 0xa0`. Both branches resolve the reference through
`CardModel` to the master `Card`, call the pinned `Card::getElement` and
`Card::getAwakeningElementType` vtable methods, and test those structural values
against the selected `cau_val1` bit. The audited handler/helper contains no
explicit alive, active, category or target filter. That negative statement is
strictly local to these pinned regions; it is not a lifecycle claim.

The exact AArch64 evidence binds six code regions, six instruction fragments,
six PLT/GOT calls, two complete vtables and three ABS64 vtable bindings. It also
pins the collection offsets and preserves `cau_val2/3` as unread.

## Invocation and safety

```text
npm run audit:database-characters-leader-causality-collection -- \
  --sidecar-root <exact-k0-k7-root> \
  --production-root <exact-k7-production-root> \
  --fyi-root <exact-k7-fyi-root> \
  --k43-root <exact-k43-artifact-root> \
  --k46-root <exact-k46-artifact-root> \
  --k48-root <exact-k48-artifact-root> \
  --native-runtime <exact-libcocos2dcpp.so> \
  --database <exact-first-party-global-sqlite>
```

The runner requires `--expose-gc`, executes K52 productively, requires both K52
structural GOs and every conservative K52 NO-GO, then reloads and compares the
K53 native proof. The public report factory remains `NOT_EXECUTED`. The CLI is
stdout-only, timestamp-free and fail-closed below an exclusive 1 GiB RSS
ceiling. It has no writer, publisher, network, R2 or Android path.

## Real result

| Evidence | Count |
| --- | ---: |
| native code regions | 6 |
| exact instruction fragments | 6 |
| exact PLT/GOT calls | 6 |
| complete vtables / ABS64 bindings | 2 / 3 |
| supported structural deck indices | 2 |
| fixed player candidate records | 7 |

The native evidence sidecar is 7,745 bytes with SHA-256
`b9ad4b4138ace36ee56595e6308fc7d095fe0502dfa14d16405de9b516843b89`.
Two complete real executions produced byte-identical 11,807-byte reports with
SHA-256
`7458e885f9a8621528042a57ea3719e7c2a7849255842a283e094b4f512399c3`
and empty stderr. Both enforced the exclusive 1 GiB RSS ceiling.

## Readiness

| Scope | Decision |
| --- | --- |
| offline candidate-collection audit | **GO** |
| deck indices 0/1 structural collections | **GO** |
| effective leader runtime branch | **NO-GO** |
| human names, lifecycle or death/removal | **NO-GO** |
| stacking/composition | **NO-GO** |
| product projection, consumer or authority | **NO-GO** |
| production, publisher, network or R2 | **NO-GO** |
| Android | **NO-GO** |
