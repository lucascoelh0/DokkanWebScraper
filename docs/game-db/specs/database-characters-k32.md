# Database Characters K32 - compact structural identity sidecar

Status: implemented as an offline, explicit opt-in, default-off generation and
validation boundary. Contract version `1.0.0`. Publication, authority and every
consumer/apply path remain NO-GO.

## Boundary

K32 emits one additive record for each of the 5,759 cards in the exact pinned
K2 taxonomy. `cardId` is the only record and comparison identity. The exact
current productive `Character[]` payload is read only to determine card-ID
coverage; no productive field supplies structural identity, state identity,
value fallback or semantics. Productive comparison remains `card_id_only`.

Each record preserves, without interpretation:

- `characterClass.raw`, `characterClass.value` and its K2 evidence status;
- category assignment source order, `categoryId`, `relationRowId` and status;
- link source order, `slot`, `linkSkillId`, `sourceColumn` and status.

Category and link dictionary labels are optional presentation evidence. A
supported label includes its exact `card_categories.name` or `link_skills.name`
row, column and `global_snapshot_default` locale provenance. Labels never
participate in identity or structural status. Missing dictionary mappings stay
explicitly unknown.

K32 does not sort, canonicalize or deduplicate assignments, compute shared or
active links, claim that collection order is irrelevant, or claim EZA/SEZA
invariance. It creates no `Character` patch. Duplicate K2 card or dictionary
identities and duplicate productive card-ID occurrences fail closed; repeated
assignment IDs remain ordered evidence and are preserved.

Collection state distinguishes:

- non-empty values with row provenance;
- an empty K2 container with container provenance but unproved assignment
  absence;
- an absent source field with no proved container.

Both empty and absent collections remain field-status `unknown`; an empty array
does not become a supported claim that no assignment exists.

## Source gate

The compiled runner requires exactly one `--opt-in-k32` plus explicit
caller-supplied `--k2-root`, `--productive-root` and `--output-root` values.
There are no repository-relative or machine-specific defaults. The package
entry point is:

```text
npm run run:database-characters-structural-sidecar -- --k2-root <root> --productive-root <root> --output-root <existing-controlled-root>
```

Only these fixed source members are allowlisted beneath controlled regular,
non-link roots:

| Source | Member | SHA-256 | Bytes |
| --- | --- | --- | ---: |
| K2 | `database-characters-k2-manifest.json` | `c5b15d2aff4e18d866d42e5036001300daf8db7ae708af179ba9ecf045e88f24` | 927 |
| K2 | `database-characters-k2-taxonomy.json.gz` | `af1c84eb0d030fbf389ea0f1f5590e5f643234e2d6348bcc64fe2ffab4718b37` | 511,837 |
| K2 | `database-characters-k2-coverage.json` | `f82d599b5507fa01cd83c1079779eb504ee739ea892037e279294ba77f65eba9` | 687 |
| K2 | `database-characters-k2-validation.json` | `dc814b9a0a2cde835fcb00e86b3cc4ea9eb486e0a1148d528b6cabf849163fac` | 60 |
| Characters | `characters-manifest.json` | `ae634968dd3349cec2b6ac16d7df2bcdcf9306afaf897cb475011fbd8f22c610` | 445 |
| Characters | local `characters.json.gz` | `de6268219039f0bbafda7b01b473e957e0cd5442682caab361a32470a2a2e899` | 1,460,373 |

The K2 snapshot is `global-6.4.0-v338-2026-08-05`; the productive dataset is
`2026-08-13T03:49:01.219Z`. Manifests, payloads, K2 coverage and K2 validation
are hash/size checked before parsing and byte/identity revalidated after both
generations and after output validation. The runner imports no network,
publisher, R2, Android or `Character` module.

## Artifact contract

The caller must supply an existing regular non-link output root. K32 writes
only a fixed four-file inventory there. Files are staged below that root,
promoted create-only by an atomic same-root link followed immediately by
staging unlink, and the manifest is promoted last as the commit marker. Final
members are single-link files. Existing targets are not reused or replaced. Root identity,
path containment, traversal, absolute member paths, symlinks and junctions are
checked with the existing database-character artifact-path boundary plus
direct file/root identity checks.

| File | Role |
| --- | --- |
| `database-characters-k32-structural-identity.json.gz` | canonical compact JSON plus deterministic level-9 gzip |
| `database-characters-k32-coverage.json` | database field/status and productive card-ID coverage |
| `database-characters-k32-validation.json` | budgets, safety counters and readiness gates |
| `database-characters-k32-manifest.json` | lineage and hashes/sizes for the other three files; committed last |

The raw limit is 32 MiB, the gzip limit is 4 MiB and the process RSS ceiling is
strictly below 1 GiB. The authoritative validator requires explicit artifact,
K2 and productive roots. It reloads and revalidates every pinned source member,
rebuilds the sidecar, coverage, validation and manifest, and compares the exact
canonical raw, gzip and pretty-printed metadata bytes. It rereads both source
and artifact members to reject mutation during validation. The separately named
integrity-only helper bounds decompression, checks canonical JSON, reproducible
gzip and self-consistent metadata, but reports `NON_AUTHORITATIVE` and cannot
produce a GO decision. Only the source-bound return value reports `status: GO`
after exact reconstruction and source revalidation.

The output namespace threat model is
`caller_controlled_stable_during_operation`. The caller must keep the supplied
root and its ancestors under its control and stable for the complete write and
validation operation. Portable Node does not expose an `openat`-style API that
can bind every create/link/unlink to one held directory descriptor, so K32 does
not claim confinement against concurrent same-user namespace replacement or a
same-user hardlink attacker. Within that stated model, final targets remain
create-only, staging stays below the supplied root and the manifest remains the
last promoted member.
The four reserved K32 output names must be absent. Unrelated files may coexist
in the caller-controlled root and are neither read nor treated as K32 members.

## Real generation

Two independent real invocations each generated twice byte-identically and
then passed authoritative source-bound validation. All four files were identical
between output roots:

| File | SHA-256 | Bytes |
| --- | --- | ---: |
| payload gzip | `241b135ac88aad2a242a6abb81ab22b099ff25257cb0c8f0f5f7e82f888cb718` | 706,128 |
| manifest | `91c2d76f38fd3a0b5eddd5e0db9651af5f7df852065a0fea7a1fc804dec3ae21` | 2,358 |
| coverage | `9fdee8e1929d42e2e6f6e46ece395800789e52ba0fb0b5ae16776f99a6ff189a` | 1,158 |
| validation | `6b881d06412be466b5f7527fbba12107730583f3739063e63b26a862534fe4e6` | 1,163 |

The canonical raw payload is 24,686,675 bytes with SHA-256
`a910cc5b2363f24326b58174c18ce8dc85669d26e73c54544a101ffecfdfd403`.
Peak RSS was 521,138,176 and 520,015,872 bytes.

K2 contributes 54,072 category assignments and 34,018 link entries. All 5,759
class fields are supported. Categories contain 5,729 supported and 30 unknown
fields; links contain 5,620 supported and 139 unknown fields. The unknowns are
the empty-container cases. There are no absent source containers, partial
fields, missing dictionary mappings, duplicate identities or invalid slots.

The productive payload exposes 1,627 unique card IDs: 1,623 cover K2 database
cards, 4,136 database cards are uncovered, and four productive IDs are outside
the pinned K2 snapshot (`1020411`, `1030311`, `1034411`, `1034431`). No
productive card-ID ambiguity was found.

## Readiness

Offline generation and source-bound artifact validation are **GO**. Publication,
R2, Android, authority promotion, gameplay semantics, consumer creation and
`Character` apply are **NO-GO**. The schema is new and additive; no K15-K31
publisher, overlay, consumer, Team Analysis or Android surface reads it.

Focused goldens cover order/slot preservation, repeated assignment IDs,
fail-closed key/dictionary duplicates, missing dictionary mapping, empty versus
absent evidence, malformed lineage/hash/cardinality, ambiguous productive
card IDs, traversal/absolute members, junction rejection, deterministic
gzip/manifest bytes, integrity metadata mutation rejection and rejection of an
internally consistent artifact whose record bytes differ from the explicit
pinned sources.
