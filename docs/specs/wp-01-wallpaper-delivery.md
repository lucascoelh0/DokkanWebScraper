# WP-01 — first-party Wallpaper rewards

Status: implemented and validated locally against Global snapshot `1788329250`.

## Architecture decision

Wallpaper presentation remains an enrichment of the first-party Stage delivery. It does not enter the shared item catalog because that catalog has a separate, externally sourced lifecycle and would duplicate official `wallpaper_items` metadata. The reusable source is `wallpaper-assets-manifest.json`: it binds each wallpaper ID to official name, description, reward icon, selector thumbnail, and an optional canonical full image. Stage reward projection consumes that manifest for missions, previews, boss drops, and Z-Battle reward models; Android consumes the same optional `wallpaper` object through the shared `StageReward` renderer.

Old Stage payloads remain valid because every wallpaper presentation field is optional on the Android wire/domain contract. A legacy `WallpaperItem` uses item-catalog metadata or the generic Wallpaper fallback and never crashes.

WP-02 is deferred: a standalone wallpaper library/catalog would require a new product flow and navigation surface. It is outside WP-01 and must reuse the same first-party manifest rather than create another metadata authority.

## Current official evidence

- SQLite database SHA-256: `7a6ca01808aea355ef28f9c0190e2c072f43a7c08be41d363f5b052824922495`.
- Global client: package `com.bandainamcogames.dbzdokkanww`, version `6.5.5` (`348`).
- `wallpaper_items`: 88 rows with unique, non-empty official names and descriptions.
- Global reward audit: 53 `WallpaperItem` occurrences and 28 unique IDs.
  - `mission_rewards`: 27.
  - `mission_category_rewards`: 25.
  - `rmbattle_mission_rewards`: 1.
  - No wallpaper occurrences in the other eight audited reward surfaces.
- Stage-deliverable and Stage-delivered coverage: 24 occurrences and 24 unique
  IDs, all projected through `eventMissions` and rendered by Android.
- Outside the current Stage consumer contract: 29 occurrences. These are 25
  mission-category completion rewards (surface missing), one RMBattle mission
  reward (contract missing), and three general mission rewards without an
  area/Stage binding (out of scope for the current Stage projection): reward
  `35497` / mission `21452` / wallpaper `39`; reward `40641` / mission `23880`
  / wallpaper `45`; and reward `51171` / mission `3008110` / wallpaper `68`.
- Required fixture: mission `30050`, area `1203`, stages `12030011` and `12030021`, reward row `51015`, `WallpaperItem:76`, quantity `1`, `Companions on Planet Vampa`.

The official client names wallpaper files as `item/wallpaper/%04d/icon_%04d.png`, `item/wallpaper/%04d/thumb_%04d.png`, and `item/wallpaper/%04d/%04d.lwf`. Every current database row has a matching `%04d.cpk` in the LDPlayer cache. The builder re-extracts every archive with a caller-supplied CriFsV2Lib tool, rejects parser failures, compares the complete re-extracted inventory byte-for-byte by size and SHA-256, and records sorted SHA-256 inventories for the 88 archives, all extracted members, and the extractor binary. The accepted real run used CriFsV2Lib commit `169b001c748dfffc28c9fc14fcec269dd45e6eec`.

The LWF check is deliberately conservative filename evidence, not semantic or
structural parsing of the LWF format. A full static image is eligible only when
the PNG is present in the CPK, its filename string is present in the LWF bytes,
and the resulting eligible set contains exactly the canonical
`Images_%04d.png`. The pipeline does not infer layer order, composition,
animation, or playback from those strings.

## Mirror and gaps

The final local owned mirror contains 248 PNGs and 42,663,289 bytes:

- 88 reward icons;
- 88 selector thumbnails;
- 72 unambiguous canonical full images;
- inventory SHA-256 `1b31ca13dcf89f6faa2149bcf8d46378ac5d86f96b3817de468caf5ab6c2d622`.

Sixteen wallpapers have no unambiguous single texture and therefore omit `fullImageAssetPath`: `0`, `4`, `11`, `24`, `31`, `35`, `53`, `58`, `59`, `64`, `70`, `74`, `75`, `77`, `85`, and `87`. Of the 28 wallpaper IDs currently referenced by reward surfaces, `24`, `70`, and `87` use this safe fallback. The Android tile tries the reward icon and then the selector thumbnail. The detail view tries the full image, selector thumbnail, and reward icon, in that order, always with `ContentScale.Fit`.

For fixture 76:

- reward icon: `item/wallpaper/0076/icon_0076.png`, 20,939 bytes, SHA-256 `13d3ab3e3ce5b8b5716bdf6f98763b2d18220b161e25aef76688e0a2c582d56f`;
- selector thumbnail: `item/wallpaper/0076/thumb_0076.png`, 22,321 bytes, SHA-256 `8efce0297152e4e0adde3c12bb8920f88223598724028f5d77763de22155ed88`;
- canonical full image: `item/wallpaper/0076/full_0076.png`, 539,573 bytes, SHA-256 `55e80ec10f63c240dcaea8cc47ecb9cd0b961a0971a65aa47e4824e1bd5543b1`.

## Reward backlog

`game-db-reward-item-audit` scans 11 reward surfaces, validates all available
catalog joins, reconciles Stage-deliverable wallpaper rewards with the actual
Stage dataset, and emits deterministic coverage dimensions for metadata,
asset, Stage projection, renderer, detail/navigation, and surface coverage.

Wallpaper reconciliation models every reward surface already supported by the
Stage contract:

| Source | Stage delivery | Reconciliation identity |
| --- | --- | --- |
| `mission_rewards` | `eventMissions` | exact `missionId`, `itemId`, and quantity |
| `sugoroku_map_boss_drop_items` | `questLevelBossDrops` | exact map owner, source row, and item |
| `quest_drop_item_views` | `questLevelDropPreviews` | eligible map owner after the Stage `difficulties` filter, source row, and item multiset; the projected item does not preserve its original slot |
| `z_battle_normal_rewards` | `zBattleCheckpointRewards` | Stage/checkpoint/group/item/quantity multiset; the projected item does not preserve its source reward row |
| `z_battle_first_rewards` | `zBattleFirstRewards` | Stage/range/set/item/quantity multiset; the projected item does not preserve its source reward row |

Each surface is reconciled independently. A source/delivery multiplicity or
value mismatch fails closed. A supported source row without a structurally
resolvable Stage owner is reported separately as out of scope instead of being
rejected merely because it is not an event mission. Delivered wallpaper
enrichment is also checked against the exact item-bound icon, thumbnail, and
optional full-image paths.

Drop-preview eligibility uses the same parser and predicate as the Stage
builder: `difficulties` must be a valid JSON array of numeric IDs and must
contain the map difficulty. Missing, blank, malformed, or non-array values fail
closed; an empty array is valid and projects to no map. Reconciliation remains
an exact map/source-row/item multiset because the delivery does not retain the
original item slot.

The summary classification no longer treats an existing typed presenter as
`renderer-missing`: `AwakeningItem` is `detail-missing`, while
`SupportMemory` is partial because its typed presenter and navigation already
exist but global surface coverage is broader than Stage.

`Point::Stone` remains `metadata-missing` only because it has no catalog row.
The semantic `Dragon Stone` fallback and official `stone.png` presentation are
complete, so this classification does not imply a visible placeholder. The
matrix is planning evidence only; WP-01 does not implement other reward
surfaces. Their evidence gates are recorded separately in
[`wp-follow-up-wallpaper-reward-surfaces.md`](wp-follow-up-wallpaper-reward-surfaces.md).
