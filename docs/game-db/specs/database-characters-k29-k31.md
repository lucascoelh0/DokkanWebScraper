# Database Characters K29-K31 - structural-field authority audit

Status: implemented and validated as an offline, explicit opt-in audit. Contract
version `1.0.0`. Authority promotion and every write path remain NO-GO.

## Boundary

K29-K31 audits exactly `characterClass`, `categories` and `links` against the
current productive `Character[]`. It does not apply, overlay, merge, write,
publish or expose a consumer. It does not change productive values.

The audit consolidates the K11 `characterClass`, `categoryIds`/`categories`
and `linkIds`/`links` projections, then cross-checks the values and ordered IDs
against K2. K11/K2 evidence is identified by `cardId`, K0/K2-backed `stateId`
and `stateKey`, field name and field-scoped row provenance. Productive
`Character[]` exposes only `cardId`, so productive comparison binding is
explicitly `card_id_only` and productive state binding is `unavailable`.
Names, titles and localized text never participate in identity.

## K29 source gate

The tracked compiled manual runner requires exactly one `--opt-in-k29-k31` and
explicit caller-supplied `--shadow-root`, `--k2-root` and `--productive-root`
arguments. There are no machine-specific or repository-relative root defaults.
The package script executes
`lib/database-characters/structural-authority-run.js`; callers append all three
roots after npm's `--` separator. Each root resolves only fixed allowlisted
filenames beneath it. Roots and members must be regular non-link
directories/files. Absolute member names, alternate filenames and traversal
are rejected.

All three manifests are validated before the corresponding payload is parsed.
Compressed hashes and sizes are checked before decompression, and source bytes
are revalidated after each generation.

This is controlled-root path hardening, not race-free filesystem isolation.
The runner does not retain directory handles while opening members, so a local
actor able to rename entries inside a supplied root can create a namespace
TOCTOU race. Post-generation byte revalidation detects changed content, but it
cannot prove that a same-byte replacement or A-B-A namespace swap did not
occur. Evidence roots must therefore be locally controlled and stable for the
entire run.

| Source | Manifest SHA-256 | Payload SHA-256 | Payload bytes |
| --- | --- | --- | ---: |
| K2 taxonomy | `c5b15d2aff4e18d866d42e5036001300daf8db7ae708af179ba9ecf045e88f24` | `af1c84eb0d030fbf389ea0f1f5590e5f643234e2d6348bcc64fe2ffab4718b37` | 511,837 |
| K11 shadow | `c86d7860ff56a97df3b10894ad69554ff01f64cb5455171fcb55e3548251d86f` | `baa78b0cb06ec404eb6df3b008a27e746b82e0f6601dd6622e8d6cb6ab46b074` | 15,906,227 |
| productive Characters | `ae634968dd3349cec2b6ac16d7df2bcdcf9306afaf897cb475011fbd8f22c610` | `de6268219039f0bbafda7b01b473e957e0cd5442682caab361a32470a2a2e899` | 1,460,373 |

The productive pin is dataset version `2026-08-13T03:49:01.219Z`, 1,436
top-level characters and 1,627 selected card IDs. K11/K2 remain on
snapshot `global-6.4.0-v338-2026-08-05`. The audit reports, but does not infer
through, the four productive IDs outside that snapshot: `1020411`, `1030311`,
`1034411` and `1034431`.

## K30 fact contract

The deterministic report contains 17,277 exclusive facts: three fields for
each of 5,759 database cards. Each fact preserves the raw K2 value, normalized
database value, ordered structural IDs, projected labels, raw productive value,
property-presence bit and exact productive JSON path. The presence bit keeps an
absent property distinct from an explicit JSON `null`, including during
ambiguity detection. Category/link projected-label provenance names
the taxonomy dictionary table, row ID and column (`card_categories.name` or
`link_skills.name`) in addition to assignment/slot provenance. A fact receives
exactly one classification:

- `agreement`;
- `representation_gain`;
- `representation_mismatch`;
- `confirmed_conflict`;
- `unknown`;
- `unjoinable`.

For categories and links, ordered equality and set equality are both recorded.
Set equality is diagnostic only and never selects value authority. Duplicate
IDs or labels, missing/ambiguous mappings, partial/unknown evidence, malformed
field provenance, ambiguous state binding and conflicts are excluded from the
supported-only candidate inventory.

Productive categories and links expose labels, not structural IDs. Therefore a
different productive label set is only a `representation_mismatch`; it cannot
be called a `confirmed_conflict` even when K2 proves its own ID-to-label
projection. `confirmed_conflict` is reserved for values sharing a proved
structural representation, such as opposing supported `Super`/`Extreme` class
values.

Candidates contain only values supported by both K11 and K2 under exact
`cardId`/`stateId`/`stateKey` evidence binding. Collection candidates retain
ordered structural IDs. The same `cardId` in productive `Character[]` permits
comparison only; it does not prove that the productive record is the K11/K2
state. Therefore every candidate is `audit_only_unbound`, has productive state
binding `unavailable`, is authority-ineligible, exposes no projected
`Character` value and is not Character-patchable.

## K31 real audit

The exclusive field totals are:

| Field | Agreement | Gain | Representation mismatch | Conflict | Unknown | Unjoinable | Supported audit candidates | Authority-eligible | Character-patchable |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `characterClass` | 1,250 | 0 | 373 | 0 | 0 | 4,136 | 1,250 | 0 | 0 |
| `categories` | 12 | 191 | 1,406 | 0 | 14 | 4,136 | 203 | 0 | 0 |
| `links` | 46 | 0 | 1,516 | 0 | 61 | 4,136 | 46 | 0 | 0 |

There are 1,623 card-ID-comparable facts per field; none has proved productive
state binding. The 373 class mismatches are the preserved `unawakened`
representation boundary; they are not coerced to `Super` or `Extreme`. The 14
category and 61 link unknowns are empty K2 assignments with no row-level field
provenance, so absence is not promoted.

The following collection totals are explicitly **non-exclusive** diagnostics:

| Field | Ordered equal | Ordered different | Set equal | Set different | Same set, different order | Unavailable |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `categories` | 26 | 1,406 | 1,432 | 0 | 1,406 | 4,327 |
| `links` | 107 | 1,516 | 1,623 | 0 | 1,516 | 4,136 |

No confirmed conflict was found. This does not make either collection ready:
ordered value authority remains blocked by the representation mismatches, and
unknown/unjoinable facts remain excluded.

## Readiness and verification

The complete in-memory report is 87,339,470 canonical bytes with SHA-256
`ffeec955522b415e787b560d1a156c3ea80352aad1535efc9279da930ac39a9e`.
Two independent runner invocations produced the same identity, and both
runner invocations generated twice byte-identically. Serialization is sampled
while its allocation remains live. Peak RSS was 774,496,256 and 775,049,216
bytes, below the fixed 1 GiB ceiling. No report or input payload was copied,
versioned or written; the manual runner emits only a compact stdout summary.

Focused goldens cover mandatory roots and opt-in, duplicate arguments, missing
values, order-only differences, duplicate IDs, missing mappings, ambiguous
state binding, label representation mismatch versus true scalar conflict,
malformed lineage, traversal/absolute member rejection and deterministic
generation. Focused source tests and `tsc --noEmit` pass.

K29-K31 audit execution is **GO**. Full card-ID-comparable scope evidence and
authority promotion are **NO-GO** for all three fields. Apply/overlay/writer/consumer,
production mutation, publisher, R2 and Android remain **NO-GO**. Supported
audit candidates are not authority-eligible or Character-patchable; a future
promotion gate would first need productive state lineage.
