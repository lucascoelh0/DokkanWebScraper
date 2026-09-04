# Stage, Mission and Z-Battle reward polish plan

## Status and scope

This document records the residual defects found during staging validation of
Stages, Event Missions, Support Memories and Z-Battles on 2026-09-03, together
with their final disposition. The SRP-01 through SRP-07 campaign is closed
after pipeline, Android, remote-staging and physical-device validation.

The closing checkpoints are:

- pipeline commits through `65cdb31` (`feat(stages): audit event image
  coverage`);
- Android commits through `939f5a9` (`fix(stages): hide unsupported area
  types`), plus `3b7a91c` (`fix(stages): preserve enemy portrait type`);
- the 3,324-entry item catalog published under `staging/v2`;
- the Stage candidate version `2026-09-03T20:08:38.190Z`, with 5,394 quest
  levels and 235 Z-Battles, published under `staging/v2`; and
- 6,915 owned assets in the staging manifest, including the three official
  Link Skill Orb icons.

This closure does not authorize a production refresh, production R2
publication or Play Store release.

## Classification boundary

The defects do not have one common cache cause:

- **Android presentation defects** occur when complete reward or Support Memory
  presentation is already available but a screen renders only a raw ID, a
  foreground URL or a text link.
- **Stage contract defects** occur when first-party database fields exist but
  the Stage delivery omits their structured meaning or presentation assets.
- **Owned-asset coverage defects** occur when the dataset has the correct asset
  identity but the byte is absent from every configured source mirror.
- **Staging delivery debt** applied to the isolated item catalog before
  SRP-01. It is now closed and did not explain the independent Z-Battle,
  equipment or restriction presentation defects.

Stage and event images normally resolve through the remotely delivered owned
R2 asset root. DokkanStats, DokkanInfo and dokkan.fyi are acquisition sources
for the mirror, not direct runtime dependencies for the current Stage lane.

## Issue catalog

### SRP-01 — Publish the isolated staging item catalog

**Observed:** item presentation that depends on the item catalog can regress
after clearing local state or installing on a clean device.

**Cause:** this was staging delivery debt. It is now closed: the current
circular Awakening Medal background correction and 3,324-entry catalog were
published to `staging/v2/item-catalog.json` and
`staging/v2/item-catalog-manifest.json` on 2026-09-03.

**Classification:** staging delivery debt, not a schema defect. **Status:**
closed after public no-cache verification.

**Verification:** the dry-run projected `2,271,386` bytes. Public verification
matched the manifest: catalog `2,271,060` bytes and SHA-256
`87ce8e8bd7f5390527998d6ec4e30374a898acffd1942ea94859437ad4138a0e`;
manifest `326` bytes. No production object was touched.

### SRP-02 — Use one reward renderer on Event Missions

**Observed:** mission equipment rewards omit their grade background, mission
character rewards show only foreground art instead of the composed card
portrait, and mission Support Memory rewards cannot open their details.

**Cause:** `StageEventMissionBlock` rendered only `reward.iconUrl`. It ignored
the already-present background URL, composed card portrait, reward kind and
detail navigation IDs.

**Classification:** one Android presentation defect with three symptoms.

**Status:** closed in Android commit `f190513`.

**Delivered:** the shared Stage reward tile is used for quest drops, event
drops and mission rewards. Character and Support Memory navigation callbacks
are connected, while old cached datasets retain a foreground/text fallback.

### SRP-03 — Present typed Z-Battle rewards

**Observed:** Z-Battle checkpoint, repeat and first-clear rewards display raw
values such as `Point::Stone 11`, `AwakeningItem 102922` and
`PotentialItem 5`.

**Cause:** the Z-Battle sections rendered `itemType`, `itemId` and quantity
directly instead of calling the shared reward presenter.

**Classification:** Android presentation integration defect. It is not caused
by stale cache or an outdated Stage snapshot.

**Status:** closed in Android commit `4ff1604`.

**Delivered:** every Z-Battle reward uses the shared typed presentation path.
Known currencies such as Dragon Stones have semantic fallbacks, official
quantities are preserved and unknown quantities render without a synthetic
quantity badge.

### SRP-04 — Deliver structured equipment levels and restrictions

**Observed:** equipment drops omit their bottom-left level badge, including
dual values such as `Lv. 7/3`. They also omit the top-right restriction badge
for a character, category, element/type or class. Unrestricted equipment must
not show a restriction badge.

**Cause:** at discovery, the Stage projection enriched `EquipmentSkillItem`
with only its name, icon asset and bronze/silver/gold background. The reward
contract did not carry structured skills, levels, grade or limitation
presentation.

**First-party sources:**

- `equipment_skill_items` owns the item, grade, icon identity and limitation
  set ID;
- `equipment_skills` owns one or more `potential_skill_id`/`status_type` and
  `level` rows, including legitimate dual-level equipment; and
- `equipment_skill_limitations` contains
  `CardCategoryLimitation`, `CardLimitation`,
  `CardUniqueInfoSetLimitation` and `ElementLimitation` rows.

**Classification:** backward-compatible Stage contract expansion followed by
Android presentation work. The database is authoritative; DokkanStats is only
a visual cross-check.

**Status:** closed in pipeline commit `92ab32f` and Android commit `6e1b208`.

**Delivered:** optional structured equipment metadata carries grade, ordered
skills, levels and restrictions. Android renders the official bottom-left
level assets, including dual values, plus the applicable top-right restriction
glyph and the reusable/infinite marker. Old payloads remain compatible. The
published staging candidate contains complete metadata for 5,107 Equipment
Skill Orb reward occurrences.

### SRP-05 — Project Link Skill Orb item presentation

**Observed:** Stage 2, `Reunion with Ba`, displays a generic inventory box for
one drop.

**Cause:** the reward was structurally correct as `LinkSkillLvUpItem:1`, but
the Stage candidate did not join the `link_skill_lv_up_items` presentation row
or request its icon asset.

**Verified identity:** ID `1` is `Link Skill Orb (S)`, described by the current
Global database as usable for Link Skills at levels 1 through 4. IDs 2 and 3
are the M and L variants.

**Classification:** Stage projection and owned-asset coverage defect, not
cache.

**Status:** closed in pipeline commit `c9b7c3c` and Android commit `9f469d2`.

**Delivered:** `link_skill_lv_up_items` is part of the first-party export and
Stage projection. The three official S/M/L icons are owned by the staging
mirror, and Android retains deterministic names and icons for old payloads.
The 23 changed staging resources were publicly verified by size and SHA-256;
the post-publication dry-runs report zero changed bytes.

### SRP-06 — Show related Support Memory cards on Stage details

**Observed:** a Stage such as `Majin Power Combined` displays only a textual
`Open Support Memory A Photo Full of Memories` action.

**Cause:** Stage detail already resolved the related Support Memory object, but
`SupportMemoryLinks` received only IDs and names and rendered a `TextButton`.

**Classification:** Android presentation defect, not missing data.

**Status:** closed in Android commit `9b575b0`.

**Delivered:** Stage details render a compact clickable Support Memory card
using the owned image and title, with the textual fallback retained for old
cached datasets.

### SRP-07 — Classify and close missing event banners

**Observed:** some event entries have a title and stage count but no banner.

**Cause:** mixed until classified per asset. The current owned manifest has 69
explicitly accepted missing paths: 65 retired/historical banners absent from
all configured mirrors, one zero-byte first-party placeholder card and three
legacy enemy thumbs. The four non-banner gaps are tracked separately from
event-image coverage.

The observed title `Deadly Struggle! Menacing Army` belongs to two areas. Area
238 has `myp_banner_event_238.png` in the owned inventory; area 1216 references
`myp_banner_event_1216.png`, which is absent from all configured acquisition
mirrors. A screenshot without the area ID cannot distinguish them. If the
rendered card is area 1216, the failure is a known asset-source gap rather than
a device-cache issue.

**Classification:** owned-asset coverage when a path is in `missingAssets`;
dataset projection when `eventImagePath` is absent; cache/network handling only
when the path is present in the owned manifest and fails to render.

**Status:** closed as a deterministic audit in pipeline commit `65cdb31`; the
consumer follow-up is closed in Android commit `939f5a9`.

**Delivered:** the report covers all 924 surfaces: 849 have an owned asset, 74
events use 65 accepted-missing banner paths, one `Area::TutorialArea` is
explicitly `image-not-applicable`, and there are zero dataset-path gaps,
recoverable official local assets or unknown generation failures. Android
shows only `Area::MainArea`, `Area::DbStory` and `Area::EventArea`; Z-Battles
remain supported. No Stage asset publication followed because the official
LDPlayer/CPK audit recovered zero bytes.

### Post-closure regression — preserve the enemy's Stage type

**Observed:** an enemy portrait initially used the Stage element, then changed
to the collectible card's original element after the character catalog loaded.

**Cause:** asynchronous character enrichment was incorrectly allowed to
replace the complete Stage-native portrait composition.

**Status:** closed in Android commit `3b7a91c` after physical-device
validation. Stage-native rarity and element metadata remain authoritative;
the collectible portrait is only a fallback when that composition is
unavailable. Drop cards continue to use their collectible-card type.

## Completed attack order

1. The isolated item catalog was published and publicly verified.
2. Event Missions adopted the shared reward renderer.
3. Z-Battle rewards adopted typed presentation.
4. Equipment metadata and official overlays were delivered end to end.
5. Link Skill Orb items and owned icons were delivered end to end.
6. Stage-related Support Memories adopted image cards and navigation.
7. Every event image was deterministically classified; no recoverable missing
   bytes were found.
8. Pipeline and Android focused suites, staging unit tests, staging assembly,
   publisher dry-runs and public hashes were verified.
9. The final staging build was installed and approved on the physical device.

## Acceptance checklist

- [x] No Z-Battle reward exposes a raw database item type or unexplained numeric
  ID when a known presentation exists.
- [x] The same reward has the same icon composition, name, quantity and navigation
  whether it appears as a Stage drop or mission reward.
- [x] Equipment shows every database-provided level in stable order and the exact
  applicable restriction badge; unrestricted equipment shows none.
- [x] `LinkSkillLvUpItem:1` renders as Link Skill Orb (S) with a verified owned
  asset.
- [x] Mission and Stage-related Support Memories show an image and open the exact
  memory detail.
- [x] Every event image is classified as present, explicitly accepted missing, or
  a generation failure; there is no silent unknown state.
- [x] Clean-install staging verification does not depend on a manually seeded
  item catalog or direct third-party runtime image URL.

## Next operational step

The next campaign is a production-only dataset refresh for the currently
released 2.0.11 consumer. It is not another SRP fix. It must:

1. export from the current official Global database installed in LDPlayer,
   without reusing the stale `1788329250` export;
2. regenerate fresh production candidates and owned-asset inventories;
3. compare the result against the current production manifests, with explicit
   attention to newly released EZAs and all other changed first-party rows;
4. run the focused pipeline checks, deterministic validation and publisher
   dry-runs, reporting the exact changed objects and projected bytes;
5. build and validate the production 2.0.11 consumer locally; and
6. request separate authorization before any production R2 write.

The 65 accepted-missing banner paths, zero-byte placeholder and three legacy
enemy thumbs remain documented limitations, not blockers for that refresh.
