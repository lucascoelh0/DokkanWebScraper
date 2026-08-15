# Database Characters K47 - leader effect-target association scope

Status: structural association scope and the next structural-ID-only
association projection GO. Semantic association, leader-clause semantics,
presentation, product projection/consumer, apply/overlay, authority,
production, writer, publisher, network, R2 and Android remain NO-GO. Contract
version `1.0.0`.

## Boundary

K47 explains the flattened target multiplicity preserved by K46. It reads the
exact pinned K3 artifact but retains only state/ref row IDs and the two
`sub_target_type_set_id` join columns from `leader_skills` and
`sub_target_types`. Text, percentages and all other values are neither retained
nor emitted.

For every supported state, K47 walks leader effects in source order, resolves
each effect's target-set ID, expands that set's target row IDs and compares the
resulting ID sequence exactly with K46. This proves structural provenance; it
does not decide OR/sum behavior, positional interpretation or any gameplay
meaning.

## Invocation and integrity

The runner has no defaults and requires Node garbage collection support:

```text
npm run audit:database-characters-leader-association-scope -- \
  --opt-in-k47 \
  --sidecar-root <exact-k0-k7-root> \
  --production-root <exact-k7-production-root> \
  --fyi-root <exact-k7-fyi-root> \
  --k43-root <exact-k43-artifact-root> \
  --k46-root <exact-k46-artifact-root>
```

K46 is validated source-bound before and after the audit. K3 is read twice with
the K45 exact-size/no-follow reader, decompressed only to its pinned raw size
and compared by fixed identities plus the association-input fingerprint. The
public report builder remains `NOT_EXECUTED`; only the private runner can
promote GO after every reload check.

## Real result

| Measure | Count |
| --- | ---: |
| supported states | 10,651 |
| effect associations | 49,435 |
| flattened target occurrences | 34,914 |
| unique targets within state | 22,194 |
| repeated flattened targets | 12,720 |
| repetitions explained by repeated target-set expansion | 12,720 |
| missing effect rows | 0 |
| missing target rows | 0 |
| mismatched states | 0 |

Two runs produced the identical canonical 5,304-byte report with SHA-256
`7841d8ad3e82756847a0c2186ed78f6f74d4d75c4b73c8c2765865326352e59b`.
The association-input fingerprint is
`a92f8558fa47bddc244ad229db2ff0bcd56def25a0d00ef6020dfe8e0ff3e62b`.
Measured peak RSS was 916,099,072 bytes, below the exclusive 1 GiB limit.
Specialized contract review found no remaining P0-P2 issue. The final domain
suite passed 222 tests with nine Windows-only symlink fixtures pending.

## Readiness

| Scope | Decision |
| --- | --- |
| leader structural association scope | **GO** |
| next structural-ID-only association projection | **GO** |
| semantic association or leader-clause semantics | **NO-GO** |
| presentation or product consumer | **NO-GO** |
| apply/overlay, authority or production | **NO-GO** |
| writer, publisher, network or R2 | **NO-GO** |
| Android | **NO-GO** |
