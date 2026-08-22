# Database Characters K64 - Android Leader shadow producer

Status: the exact offline/default-off K64 producer is GO for the pinned K56
supported-only corpus and the Android K63 wire contract at commit
`f148a66d9911c2667caafd47bbd522b5fe00c4e6`. The resulting sidecar is local,
create-only and non-authoritative. Android runtime consumption, publication,
R2 mutation, UI and combat calculation remain NO-GO. Contract version `1.0.0`.

## Source boundary

K64 reads no network resource and constructs no publisher. The real runner
requires the exact four-member K56 root and verifies the exact K63 Android
source through bounded, no-shell Git object database reads with lazy fetching
disabled. Checkout bytes are not evidence.

The source lineage is fixed to:

- K56 full artifact fingerprint
  `807a98ae37cd17a68a7f3f3544c1f14b4f4bfab9f75c9b627cca23cbab41e3b3`;
- K56 lineage fingerprint
  `132c1e858ed5fdb6bdc97f3c5e0313c865c7bf0ee7367e1ad1453b89e280fa5f`;
- K60 publication receipt SHA-256
  `d56dd4bdb6a46570d687709acc687ae67a270908c1666c3f495e5ca29b901a68`;
- K62.1 compatibility audit SHA-256
  `1ba112d7b4e08ceebeb590976b8d1b7c1d726064cba094ef050db237aadaef4f`;
- Android repository `https://github.com/lucascoelh0/Dokkanpanion.git`, commit
  `f148a66d9911c2667caafd47bbd522b5fe00c4e6`, and exact Git blobs for
  `LeaderShadowModels.kt`, `LeaderShadowLoader.kt` and
  `LeaderShadowRepository.kt`.

The source is checked before materialization and again after create-only write
and persisted reconstruction. This detects persistent checkpoint drift, not a
transient A-B-A change wholly between checkpoints. A-B-A detection and
concurrent same-user ancestor replacement remain explicit NO-GOs.

## Lossless wire mapping

K64 groups the 12,265 source-ordered K56 references into 7,248 state records
without changing state order. It preserves:

- `stateId`, `sourceStateKey`, `cardId`, release state and Leader set ID;
- effect row and source effect occurrence identity;
- the opaque structural mask;
- percentage versus flat-points operation and the common modifier;
- the fixed ordered HP/ATK/DEF stat projection without calculating an
  effective value;
- team, Super Class and Extreme Class target scope;
- ordered category include/exclude occurrences, duplicates and multiplicity;
- sequential AND semantics and an explicit empty-filter identity;
- K56/K60/K62.1 provenance and all K63 runtime/lifecycle unknowns.

Generated scope and empty-identity filter records are typed separately from
source category occurrences. Source target occurrence indices remain encoded
in deterministic filter identities, allowing the K56 filter sequence to be
reconstructed without text or presentation identity.

The producer validates the exact Android JSON shape, IDs, enums, integer
ranges, global indices, counts, order and limits before returning bytes. The
manifest and payload use the exact `dokkan-leader-shadow` `1.0.0` contract
accepted by K63.

## External provenance pin

The artifact root contains a provenance-pin candidate for review and later
out-of-band distribution, but that copy cannot authorize itself. Strict real
materialization, writing and rereading require the separately compiled
accepted pin SHA-256:

`88a62688150ece1f06bc91bfd2832c78780e392be7622cfe560bf1a9148d4e8d`.

The pin binds the payload and manifest hashes, the six-field K63 provenance
value, the K62.1 design decision and exact Android Git-object identity. A
foreign self-consistent bundle is rejected against this external identity.
Android integration must obtain the six-field `LeaderShadowProvenancePin` from
a separately trusted configuration; the artifact-side copy is never that
configuration.

## Real result

The accepted local run completed with exit code 0 and empty stderr. It
performed two byte-identical materializations, wrote all members create-only
with the Android manifest last, reconstructed the persisted bundle byte for
byte and rechecked the exact sources.

| Member | Bytes | SHA-256 |
| --- | ---: | --- |
| canonical raw Android payload | 8,082,196 | `b33a719c7de24965330aa32746a8cbcb93d68d29c7d17aa76ad5bd94945118d7` |
| gzip payload | 416,285 | `0bf70708b14224867546a76c8cd2521ce00489f2eae5cbea0d7693dc6e67e150` |
| Android manifest | 898 | `7aa2b54655c4cc5750269e01d7e63756357b2b10894d0f9bc0ea0da4a9d9062d` |
| external provenance-pin candidate | 1,982 | `88a62688150ece1f06bc91bfd2832c78780e392be7622cfe560bf1a9148d4e8d` |
| validation | 1,612 | `e3d64925a54ef8cfffa9e15f39ac229cc20c380ca9dfe78ede7d19ea805862c6` |

The raw payload remains 306,412 bytes below the exclusive 8 MiB Android
boundary. The gzip payload remains 1,680,867 bytes below 2 MiB. The observed
K64 process peak RSS was 296,194,048 bytes, below the exclusive 1 GiB limit.

Exact inventory:

| Dimension | Count |
| --- | ---: |
| states | 7,248 |
| effect occurrences | 12,265 |
| filters | 31,478 |
| team / Super / Extreme scope filters | 11,971 / 161 / 133 |
| category include / exclude filters | 9,736 / 6,250 |
| explicit empty identities | 3,227 |
| percentage / flat occurrences | 12,253 / 12 |

The actual Android `LeaderShadowLoader` loaded the generated bytes with the
out-of-band six-field pin and reconstructed the exact 7,248 / 12,265 / 31,478
inventory. The temporary cross-repository test was removed after execution;
the Android worktree remained clean and tracked K63 fixtures remain synthetic.

## Readiness

| Scope | Decision |
| --- | --- |
| exact offline K64 producer | **GO** |
| deterministic double generation and persisted reconstruction | **GO** |
| Android K63 wire compatibility | **GO** |
| external provenance-pin candidate | **GO** |
| Android runtime acquisition/consumption | **NO-GO** |
| authority or effective Leader values | **NO-GO** |
| Leader + Friend, stacking, rounding or combat | **NO-GO / unknown** |
| network, publisher or R2 mutation | **0 / NOT_EXECUTED** |
| UI changes | **NO-GO** |
| transient A-B-A and concurrent ancestor replacement protection | **NO-GO** |
