# Database Characters K34 - optimal-awakening card-scope audit

Status: exact pinned-profile card-scope stability supported; explicitly opt-in
offline report execution GO. Productive authority, apply, Character mutation,
publication, R2, Android and source removal remain NO-GO. Contract version
`1.0.0`.

## Boundary

K34 is one bounded, report-only audit answering whether `characterClass`,
category assignments and link assignments continue to come from the same card
identity while optimal-awakening growth is selected. It does not infer
stability from absent columns alone. It requires schema, DB1/K2 structural
joins and native runtime construction/lookup evidence to support each
dimension independently.

The compiled runner requires exactly one `--opt-in-k34` and five explicit
caller-supplied roots:

```text
npm run audit:database-characters-card-scope -- --sqlite-root <root> --db1-root <root> --k2-root <root> --elf-root <root> --native-evidence-root <root>
```

There are no defaults or output-path options. Unsupported, missing and
duplicate arguments fail closed. The fixed members are the pinned SQLite
`dokkan-global-current.db`, DB1 manifest/source manifest/payload, four K2
members, `libcocos2dcpp.so` and `native-runtime-layout.json`. The implementation
imports no network, Android, publisher, R2, production or Character mutation
surface and emits only deterministic JSON to stdout. Peak RSS is sent to
stderr and excluded from report identity.

## Exact Sources

The profile is
`global-6.4.0-v338-2026-08-05-card-scope-k34-v1` over snapshot
`global-6.4.0-v338-2026-08-05`.

| Source | SHA-256 | Bytes |
| --- | --- | ---: |
| SQLite | `3654eb7db9e18dfe4c238abd02bcc06a688ffa6f30aa1ad93fd108dcfeb78265` | 95,428,608 |
| DB1 gzip | `0afae38e1a80e55bc5d8a137f945727149f44403bf1670e830d3ef6f3650e547` | 11,217,031 |
| K2 manifest | `c5b15d2aff4e18d866d42e5036001300daf8db7ae708af179ba9ecf045e88f24` | 927 |
| K2 gzip | `af1c84eb0d030fbf389ea0f1f5590e5f643234e2d6348bcc64fe2ffab4718b37` | 511,837 |
| ELF | `7d6c2c1e095fc20a71ec4764e88a17b4d4b82f3f12952b9ba8c6eb0405a7215a` | 95,662,296 |
| native layout | `463dc1c5405a14a32efd4d024dfcae01c146801d746b4e2e2ddb9297e677eb68` | 761 |

Every root must be a canonical regular non-link directory. Every member is a
fixed contained regular non-link single-link file opened read-only. Size,
SHA-256, path identity, inode/device identity and metadata are checked around
reads, then all members are reopened and revalidated after evaluation. SQLite
inspection uses the existing descriptor-bound read-only adapter with a 112 MiB
input ceiling, bounded child output and a 120-second timeout. DB1 and K2 retain
their existing exact manifest and contract validators; decompression is bound
to pinned sizes.

## Schema Proof

The SQLite must contain exactly 232 tables. The three relevant table layouts
must match exactly, including column order:

- `cards` contains `element`, `optimal_awakening_grow_type`, and
  `link_skill1_id` through `link_skill7_id` in its pinned 56-column layout.
- `card_card_categories` is exactly `id`, `card_id`, `card_category_id`, `num`,
  `created_at`, `updated_at`; the assignment joins through `card_id`.
- `optimal_awakening_growths` is exactly `id`,
  `optimal_awakening_grow_type`, `step`, `lv_max`, `skill_lv_max`,
  `passive_skill_set_id`, `leader_skill_set_id`.

The optimal-awakening table has no `element`, category relation/card ID, or
link-skill replacement column. This omission is recorded as schema evidence,
not treated as sufficient runtime proof.

## Structural Joins

DB1 and K2 must contain exactly the same unique `cardId` set. K34 compares K2
class raw/value evidence to DB1 `cards.element`; category assignments use only
the unique `card_card_categories.id`, its `card_id`, and
`card_category_id`; links use only card ID, slot, exact
`cards.link_skillN_id`, source column and joined link-skill row ID. Names and
labels are never identity or join material.

DB1 provenance is separately exact: its reviewed 32-column `cards` projection,
the six category-relation columns, seven category dictionary columns, six link
dictionary columns and seven growth columns must match in order. A full SQLite
layout is never incorrectly substituted for the narrower DB1 projection.

Duplicate card IDs, category relation IDs, link slots or state keys fail the
whole audit. Missing cards, category rows, link-skill rows, source columns, or
dictionary joins also fail. Growth rows must have the exact table and column
provenance and must join the card's `optimal_awakening_grow_type`; reuse of one
growth row ID with different bytes is ambiguous and rejected.

## Native Proof

K34 reuses the ELF inspector's parsed symbols, relocations and virtual-byte
reader. It does not accept symbol names as evidence by themselves. The exact
ELF identity/layout, 16 complete code regions and 10 focused constructor
fragments are hash-pinned. Sixteen branch instructions are decoded to exact PLT
targets whose bytes and dynamic relocation tuples are also pinned; the Card
element virtual dispatch slot is bound by its exact vtable relocation. Column
literals for links and growth type are reached by decoded AArch64 `ADRP`/`ADD`
pairs and checked as exact NUL-terminated bytes. The inline `element` and `id`
column names are independently reconstructed from their pinned AArch64
`MOVZ`/`MOVK` sequences; the surrounding hashed fragments bind their stores and
the corresponding `SQLite3::Row::getInt` calls.

That evidence establishes this path for the pinned runtime:

1. `Card(SQLite3::Row*)` reads `cards.element` and all seven link IDs, reads the
   same card row's `id` for `CardModel::getCardCategories(int)`, and reads
   `optimal_awakening_grow_type` for the separate growth lookup.
2. `UserCard` retains the constructed `Card` shared pointer. Its link path
   forwards to the Card link getter, category consumption calls the Card
   category getter, and element consumption reaches Card's exact `getElement`
   vtable slot.
3. Optimal-awakening construction and `UserCard` growth-step lookup select a
   growth step. The pinned step setter/getter path does not replace the retained
   Card, while the consumers above continue to read class/category/link data
   from that Card.

Each dimension has its own required role set. Any missing role changes only
that dimension to `partial` or `unknown`, produces `not_fully_proved`, and
retains NO-GO. A missing native link can never be replaced by the schema-column
omission.

## Real Result

Repeated executions against the exact local pins produced byte-identical
7,140-byte reports with
SHA-256
`a34afd7895d40dbdfd085c7c1b5af1304247b4e7476e89bec6c81e17758f638a`.
Each runner invocation evaluated twice byte-identically. Measured peak RSS was
at most 566,599,680 bytes, below the exclusive 1 GiB limit.

| Evidence | Count |
| --- | ---: |
| exact DB1/K2 card joins | 5,759 |
| category assignments | 54,072 |
| link assignments | 34,018 |
| optimal-awakening growth states | 4,895 |
| distinct growth rows | 4,874 |
| native hashed regions/fragments | 26 |
| decoded direct calls | 16 |
| pinned relocations | 17 |

`characterClass`, categories and links are each
`stable_for_exact_pinned_profile`. This is a structural scope conclusion, not
productive authority.

## Threat Model And Residuals

The gate protects against ordinary layout/hash drift, malformed or substituted
members observed during a run, missing/duplicate structural joins, symbol-only
inference and accidental writes. It assumes the caller-supplied local namespace
is not being maliciously replaced by the same user in an A-B-A pattern between
checks; portable Node cannot provide `openat`-style root binding for every
reopen. The native conclusion is exact-profile only and must be re-proved after
ELF, SQLite, DB1, K2 or layout drift.

No productive `Character[]` release-state lineage is available. K34 therefore
does not bind an initial/EZA/SEZA state to a productive record, establish
cross-version behavior, authorize values, or prove presentation ordering or
gameplay activation semantics beyond the traced lookup path.

## Readiness

| Scope | Decision |
| --- | --- |
| explicitly opt-in offline report execution | **GO** |
| productive authority or state binding | **NO-GO** |
| apply or Character mutation | **NO-GO** |
| publisher or R2 | **NO-GO** |
| Android | **NO-GO** |
| FYI removal | **NO-GO** |
| DokkanInfo removal | **NO-GO** |

Focused tests cover the positive report golden, exact schema mutations,
duplicate/missing joins, native partial/unknown preservation, validator
anti-promotion behavior and CLI fail-closed behavior.
