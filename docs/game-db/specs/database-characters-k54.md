# Database Characters K54 - leader causality deck-index provenance audit

Status: offline native provenance audit GO. The source and propagation of
`AbilityStatus::deckIndex` and its independence from `target_type` in the
audited creation chain are bound. The effective runtime branch for the 17
observed leader causalities cannot be selected from the database and remains
NO-GO, together with lifecycle, stacking, product projection, authority,
production, publisher, network, R2 and Android. Contract version `1.0.0`.

## Boundary

K54 wraps a complete K53 real audit with its exact native proof loaded before
and after. The audited creation chain establishes:

- `AbilityManager::createLeaderSkill(int,int,int)` receives `deckIndex` as its
  first runtime argument;
- the factory writes that argument to `CreateAbilityStatusEfficacy+0x0c`;
- the base status constructor copies it to `AbilityStatus+0x10`;
- `AbilityStatus::getDeckIndex` reads exactly `+0x10`;
- the factory also uses the same argument to select runtime character data and
  apply the `canCreateLeaderSkill` guard.

`target_type` follows a distinct path in the audited chain: `LeaderSkill+0x40`
to the create-status field at `+0x2c`, then `AbilityStatus+0xe0`, which
`getTargetType` reads. Consequently, `target_type` does not select the
`deckIndex` branch in this audited creation chain. K54 does not generalize that
negative statement to all runtime code.

The factory is exposed through the pinned `AbilityManager` vtable. No static
caller or source-row binding supplies its first runtime argument for the 17 K52
rows. Therefore neither `target_type=2` nor a SQLite ID can authorize
`deckIndex=0` or `1`. K53's conditional branch meanings remain valid, but the
effective branch is context-dependent and unavailable from the offline corpus.

## Invocation and safety

```text
npm run audit:database-characters-leader-causality-deck-index -- \
  --sidecar-root <exact-k0-k7-root> \
  --production-root <exact-k7-production-root> \
  --fyi-root <exact-k7-fyi-root> \
  --k43-root <exact-k43-artifact-root> \
  --k46-root <exact-k46-artifact-root> \
  --k48-root <exact-k48-artifact-root> \
  --native-runtime <exact-libcocos2dcpp.so> \
  --database <exact-first-party-global-sqlite>
```

The runner requires `--expose-gc`, executes K53 productively, preserves both
K53 structural GOs and all conservative NO-GOs, and compares K54 native proof
before/after. The public factory remains `NOT_EXECUTED`. The CLI is stdout-only,
timestamp-free and fail-closed below an exclusive 1 GiB RSS ceiling. It has no
writer, publisher, network, R2 or Android path.

## Real result

| Evidence | Count |
| --- | ---: |
| native code regions | 11 |
| exact instruction fragments | 11 |
| exact direct / PLT calls | 1 / 6 |
| complete vtables / ABS64 bindings | 3 / 4 |
| observed DB rows with unresolved runtime argument | 17 |

The native evidence sidecar is 10,521 bytes with SHA-256
`a0fda20b98c3efbc6e3b3fd4ff461dc7744acd0362ea3a70dda5858cca7d054c`.
Two complete real executions produced byte-identical 16,255-byte reports with
SHA-256
`33442f73e3795ded886cfa70371c6f654676aa4a511c59e965fab6f10ab620af`
and empty stderr. Both enforced the exclusive 1 GiB RSS ceiling.

## Readiness

| Scope | Decision |
| --- | --- |
| runtime argument provenance | **GO** |
| field independence in audited creation chain | **GO** |
| effective leader runtime branch | **NO-GO** |
| data-level branch selection | **NO-GO** |
| lifecycle or stacking/composition | **NO-GO** |
| product projection, consumer or authority | **NO-GO** |
| production, publisher, network or R2 | **NO-GO** |
| Android | **NO-GO** |
