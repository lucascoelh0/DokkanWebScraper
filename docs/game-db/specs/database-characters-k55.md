# Database Characters K55 - leader lifecycle and composition audit

Status: offline, source-bound native structural audit GO with partial lifecycle
coverage. Per-row status construction, the shared start-turn invocation and
the type-82 calculator operations are supported. Duration, recurrence, removal
outcomes, Leader + Friend composition and final stacking remain NO-GO.
Contract version `1.0.0`.

## Boundary

K55 wraps a complete real K54 audit and validates its own native proof before
and after that execution. It does not reopen the unresolved runtime
`deckIndex`. The exact pinned AArch64 evidence establishes only that:

- the leader factory loop creates and registers one passive status for each
  source row it iterates;
- the start-turn controller invokes the shared status executor twice with the
  exact raw argument tuples `[0, 0, 1, 3]` and `[6, 0, 1, 3]`;
- matching type-82 rows add contributions in the `TeamingPower` calculator;
- `calc_option=0` performs an integer conversion in the type-82 handler;
- `calc_option=2` divides by 100 and retains a floating-point value at that
  handler boundary;
- this post-condition path is shared independently of whether type-35 was
  present before it.

The raw start-turn arguments are not renamed as timing or skill enums by K55.
Calls made by the party/enemy deactivation functions are pinned, but their
result semantics are not. DB37 passive `turn`/`is_once` evidence is not a
LeaderSkill binding and is not used.

Consequently the supported post-condition evidence applies to the 3,836
unconditional type-82 effects and their 12,265 references. The 17 conditional
effects and 45 references remain wholly excluded with reason
`runtime_deck_index_unresolved`.

## Invocation and safety

```text
npm run audit:database-characters-leader-lifecycle-semantics -- \
  --sidecar-root <exact-k0-k7-root> \
  --production-root <exact-k7-production-root> \
  --fyi-root <exact-k7-fyi-root> \
  --k43-root <exact-k43-artifact-root> \
  --k46-root <exact-k46-artifact-root> \
  --k48-root <exact-k48-artifact-root> \
  --native-runtime <exact-libcocos2dcpp.so> \
  --database <exact-first-party-global-sqlite>
```

The runner requires `--expose-gc`, is stdout-only and timestamp-free, and
fails closed below an exclusive 1 GiB RSS ceiling. It has no payload writer,
publisher, network, R2, Android, `Character[]`, apply or authority path. The
public report factory remains `NOT_EXECUTED`; only the runner can authorize
the six structural readiness decisions.

## Real result

| Measure | Count |
| --- | ---: |
| total type-82 effects / references | 3,853 / 12,310 |
| supported unconditional effects / references | 3,836 / 12,265 |
| excluded conditional effects / references | 17 / 45 |
| native code regions / instruction fragments | 9 / 10 |
| exact direct branches / PLT calls | 1 / 12 |
| complete vtables / ABS64 bindings | 1 / 1 |

The native evidence sidecar is 11,356 bytes with SHA-256
`136d7792840ddb716a7d601b561bed56b7dda37297f4029480a605b6c1a95ec8`.
Two complete real executions produced byte-identical 21,674-byte reports with
SHA-256
`c2131742d621c71ce12b9e1a379a4ad4ca7f1e38482445e692fb2bd1444459ab`
and empty stderr. The externally sampled peak working set was 1,012,617,216
bytes, below the exclusive 1 GiB ceiling.

## Readiness

| Scope | Decision |
| --- | --- |
| offline native structural audit | **GO** |
| per-source-row construction and start-turn shared invocation | **GO** |
| type-82 handler/calculator operations | **GO** |
| 17 conditional effects / effective runtime branch | **NO-GO** |
| duration, recurrence, reset or removal outcome | **NO-GO** |
| Leader + Friend and final stacking/composition/order | **NO-GO** |
| transformation, death, revive, exchange or standby effects | **NO-GO** |
| final rounding | **NO-GO** |
| product projection, authority or production | **NO-GO** |
| publisher, network, R2 or Android | **NO-GO** |
