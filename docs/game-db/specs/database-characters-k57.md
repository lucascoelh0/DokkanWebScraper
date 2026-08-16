# Database Characters K57 - supported leader shadow consumer

Status: offline source-bound shadow consumption GO for the exact K56
supported-only projection. Persistence, combined Leader + Friend values,
authority, delivery and Android remain NO-GO. Contract version `1.0.0`.

## Boundary

K57 consumes only an exact real K56 artifact set. The runner invokes the
public K56 source-bound validator before creating lookups and again after the
lookup audit. It requires all five K56 member identities, the complete artifact
fingerprint and full lineage to remain stable across those validations.

The direct factory is deliberately non-authoritative: its report leaves
`consumerShadow`, source-bound validation and RSS readiness as
`NOT_EXECUTED`. Only the explicit runner can promote them to GO.

K57 preserves the K56 supported-only boundary:

- 12,265 projected references;
- 7,248 distinct state IDs;
- 3,434 distinct card IDs;
- 3,836 distinct effect-row IDs;
- 17 conditional effects and 45 references excluded as
  `runtime_deck_index_unresolved`;
- `k56-conditional-domain-rule-v1` remains coverage-only, is not first-party
  runtime `deckIndex` evidence and does not authorize any projected record.

No combined Leader + Friend value, final combat calculation, conditional
fallback, `Character[]`, apply/overlay or product authority is introduced.

## Consumer API

Private indexes support lookups by:

- exact `(stateId, sourceEffectOccurrenceIndex)` reference identity;
- `stateId`;
- `cardId`;
- `effectRowId`.

Arrays preserve K56 source order and multiplicity. Duplicate exact reference
identities fail closed. Every returned record, nested value and array is a new
deep-frozen clone, so callers cannot mutate private index state.

The stdout report contains only identities, counts, bounded structural samples,
boundary decisions and RSS measurements. It contains no records, text,
presentation or timestamps and must remain below 64 KiB.

## Invocation

```text
npm run audit:database-characters-leader-supported-shadow -- \
  --sidecar-root <exact-k0-k7-root> \
  --production-root <exact-k7-production-root> \
  --fyi-root <exact-k7-fyi-root> \
  --k43-root <exact-k43-artifact-root> \
  --k46-root <exact-k46-artifact-root> \
  --k48-root <exact-k48-artifact-root> \
  --k56-root <exact-k56-artifact-root> \
  --native-runtime <exact-libcocos2dcpp.so> \
  --database <exact-first-party-global-sqlite>
```

The CLI requires exact explicit arguments and Node `--expose-gc`. It writes no
artifact and has no network, publisher, R2 or Android path.

## Real result

Two complete runs against the two independent hardened K56 roots returned GO
with empty stderr. Each stdout report was 4,291 bytes. The raw report hashes
differ only because RSS measurements are observational:

- run 1 SHA-256:
  `626a35554a48d7d7c55c95452332bfb9b61add8420e5fc14870a43db367e99f4`;
- run 2 SHA-256:
  `9874c450057687c01b271022edba7e2f25ce3ac823e5aa6eef1e295577a8f1c9`.

After replacing only `rssAccounting.measurements` with `null`, both reports are
byte-identical. The compact normalized SHA-256 is
`cc2188a45f78b61f5bc2bcc2cd748417720bf988ec9464661df36377b086db8c`.

Stable identities:

- full K56 artifact fingerprint:
  `807a98ae37cd17a68a7f3f3544c1f14b4f4bfab9f75c9b627cca23cbab41e3b3`;
- full lineage fingerprint:
  `132c1e858ed5fdb6bdc97f3c5e0313c865c7bf0ee7367e1ad1453b89e280fa5f`.

Maximum individual-process RSS was 1,017,950,208 and 1,025,351,680 bytes.
The K57 parent peaks were 993,509,376 and 995,381,248 bytes. Accounting is
strictly `per_process_not_process_tree`; combined process-tree RSS remains
unmeasured and NO-GO.

## Readiness

| Scope | Decision |
| --- | --- |
| local source-bound shadow consumer | **GO** |
| exact reference/state/card/effect lookups | **GO** |
| per-process RSS below 1 GiB | **GO** |
| combined process-tree RSS below 1 GiB | **NO-GO** |
| persisted consumer or output artifact | **NO-GO** |
| combined Leader + Friend/effective value | **NO-GO** |
| final combat calculation | **NO-GO** |
| 17 conditional effects or deck fallback | **NO-GO** |
| authority, apply or production | **NO-GO** |
| publisher, network, R2 or Android | **NO-GO** |
| dynamic runtime instrumentation | **NO-GO** |
