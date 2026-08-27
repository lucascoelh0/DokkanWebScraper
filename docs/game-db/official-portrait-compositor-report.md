# Official Portrait Compositor Report

**Status:** complete deterministic local staging candidate proven; remote and
Android gates remain blocked

**Date:** 2026-08-26

## Scope

This gate answers two questions without changing an R2 lane or Android:

1. Which first-party fields own the portrait's class/type badge?
2. Can the existing 150x150 portrait geometry be reproduced from official
   installed-game bytes rather than a community-hosted image source?

Dokkan.fyi and DokkanInfo supplied no bytes to this proof.

## First-party source

The inspected Global installation is the official package
`com.bandainamcogames.dbzdokkanww`, version `6.5.0` / code `342`. Its pulled
base APK is 70,959,785 bytes with SHA-256
`5a6c9e9d1e7decf9bb6ccf407e4723ac9c29f408598d448f570abf7d317fffe0`.
The downloaded asset store contains:

- `layout/en/image/character.cpk`: 3,593,648 bytes, SHA-256
  `8cd3d18c12ad805f1b192f80b7bb8a7d4a4e66dbdc4df33367810726346d457e`;
- one `character/thumb/card_<asset-id>_thumb.cpk` per downloaded portrait
  resource.

The shared CPK exposes the five frame colors, all rarity marks and the exact 15
visual badge members `cha_type_icon_00.png` through
`cha_type_icon_24.png`. Each sampled thumb CPK exposes one exact 250x250
`card_<normalized-id>_thumb.png` member.

The CPK inventory was read with a locally built, source-pinned CriFsV2Lib
checkout at commit `169b001c748dfffc28c9fc14fcec269dd45e6eec`. This utility
is research tooling only and is not part of the application or release
pipeline.

## Typed identity contract

The authoritative badge field is the raw first-party `cards.element` value:

- `0x`: classless visual badge;
- `1x`: Super visual badge;
- `2x`: Extreme visual badge;
- the ones digit `0..4`: AGL, TEQ, INT, STR or PHY.

Gameplay `characterClass` must not replace this field. Some low-rarity cards
have a gameplay class but intentionally use a classless visual badge. Thumb
identity comes from the official `cards.resource_id` when it is present and
otherwise from the exact card ID; that identity is then normalized to its
final decimal zero. This matters for cards that deliberately share one portrait
across types or special rows. Official rarity selects both the frame variant
and rarity mark. EZA has no distinct portrait frame or decoration. LR and SEZA
motion/effects remain a separate Android gate after the static path.

## Complete staging audit

The public staging/v2 Character payload at version
`2026-08-26T03:51:45.330Z`, SHA-256
`4260712cc058ca06364d38a19de75f1e9280769dbeaebed3d8e35a37f9932643`,
was read without mutation and joined to the official Global first-party export
`glb-db-1787282006` by exact card ID.

| Check | Result |
| --- | ---: |
| Portrait references | 1,627 |
| Exact official ID joins | 1,627 |
| Unique official thumb assets | 1,596 |
| Cards using an explicit `resource_id` | 27 |
| References requiring a corrected spec | 854 |
| Classless visual badges | 372 |
| Super visual badges | 773 |
| Extreme visual badges | 482 |
| Rarity divergences | 0 |
| Non-portrait changes | 0 |

The 854 corrections are the previously observed visual-class defect. Bota
Magetta `1015830` is not a mismatch: its official `resource_id` intentionally
points to the shared `1015820` portrait asset. Special 2xxxxxx and 3xxxxxx rows
use the same typed mechanism; there are no character-name exceptions.

## Static composition proof

The compositor reads four explicit local official members and preserves the
established 150x150 layer geometry:

1. frame background;
2. normalized card thumb;
3. rarity mark;
4. raw-element type/class badge.

Two representative outputs were generated:

| Card | Contract exercised | PNG bytes | SHA-256 |
| --- | --- | ---: | --- |
| Metal Cooler Army `1014471` | Extreme INT LR (`22`) | 12,676 | `a4be08ee3d624c9dea8be1cedeb08f86d2dc8fc820f973a036ddb3b69783e71a` |
| Cell (1st Form) `1000070` | classless AGL SR (`00`) | 10,524 | `674d96c88571578500670386420860399da8ffca387dcce87609236c3d1d4cca` |

Both visually preserve the accepted portrait geometry while selecting the
official badge identity. Composition is deterministic for identical input
bytes.

## Complete official asset inventory

The resource-aware corpus requires 1,596 unique thumb CPKs. Every exact file
was checked in the installed official asset store and none was missing. The
selected files plus the shared `character.cpk` were copied into a bounded
temporary directory without altering the game's asset store, archived, pulled
and verified on both sides:

| Artifact | Result |
| --- | ---: |
| Thumb CPKs | 1,596 |
| Shared CPKs | 1 |
| Archive bytes | 39,822,848 |
| Archive SHA-256 | `853bca55395067b8ae3382f1c4a0bfeb9b54d489f2a932f453b05b75c29d74a9` |
| Extracted shared members | 280 |
| Extracted thumb members | 1,596 |

The candidate records sorted SHA-256 inventories for the selected CPKs and
every extracted member it consumes. The official package identity, exact base
APK bytes, exact Global `cards.csv` bytes and DB/asset/APK versions, bounded
archive, extracted-layer inventory and source-pinned CPK reader commit are all
explicit provenance inputs. Canonical real paths are checked before hashing so
a symlink cannot substitute a file outside an admitted asset root. Composition
consumes those same verified in-memory bytes instead of reopening lexical
paths, closing the inventory-to-compositor race window.

## Local staging candidate

The local candidate atomically overlays the official `element`, rarity and
`resource_id`, composes every referenced portrait, rewrites every
`portraitURL` to a channel-scoped content-addressed key under
`staging/v2/images/v4/`, and then generates a content-addressed Character
payload. It never reads or writes R2.

| Check | Result |
| --- | ---: |
| Portrait references generated | 1,627 |
| Unique thumb assets consumed | 1,596 |
| Generated portrait bytes | 17,438,290 |
| Character count | 1,436 |
| Character gzip bytes | 2,346,736 |
| Character gzip SHA-256 | `672b6fc2fe3712c8530a13ef0561a0a44d857e0bc6c48ddfec6b6b0a92c3965f` |
| Two complete generations compared | 1,630 files each, 0 differences |
| Provenance-strengthened replay | 1,628 object files, 0 byte differences |

Representative classless, Super, Extreme and shared-resource portraits were
visually inspected. Every composition was validated as a 150x150 PNG before
write, and all 1,627 outputs were independently reread and matched the hash
embedded in their object key. The derived payload's
manifest name, byte length, gzip contents and SHA-256 were also reread and
validated.

The stronger replay rejects independently substituted APK, DB export and
extracted layers before creating an output directory. Its Character manifest,
payload and all 1,627 portrait objects are byte-identical to the initial local
candidate. Shared official thumbs are intentionally not required to be unique
per card or type: each card still receives its own rarity/frame/type layers
from its typed official row.

TypeScript compilation and the 12 focused portrait/candidate checks passed. A
broader run under the required `--expose-gc` runtime passed 1,851 checks with 13
expected pending cases; only DD6 was omitted because its historical source-lock
test deliberately compares `project-state.md` to the committed `HEAD` blob and
therefore cannot accept this still-uncommitted checkpoint.
Final read-only contract re-review found no remaining P0-P2 issue. The
unavoidable local filesystem race inside the single `realpath`→`readFile`
capture and the absent official asset-manifest lineage remain documented minor
residuals; neither is promoted into publication authority.

## Team Analysis rebind and Android staging consumption

The portrait Character payload was rebound to a Team Analysis candidate using
the complete first-party Global export and all current typed activation/name
identity contracts. The pair is local and ignored; it was not passed to either
publisher.

| Check | Result |
| --- | ---: |
| Character version | `2026-08-26T14:05:24.714Z` |
| Character gzip SHA-256 | `672b6fc2fe3712c8530a13ef0561a0a44d857e0bc6c48ddfec6b6b0a92c3965f` |
| Team Analysis version | `2026-08-26T14:05:24.714Z:parser-1.9.16` |
| Team Analysis gzip bytes | 3,152,060 |
| Team Analysis gzip SHA-256 | `8d39b8d932df4830906fffb7138ba7d6980d844e577cd90f8176fae71e09ed4b` |
| Team Analysis states | 2,288 |
| Supported / partial / unknown rules | 10,003 / 1,688 / 0 |
| Complete replay | payload, manifest and coverage byte-identical |

The Team manifest binds the exact Character version and SHA above. The normal
pair validator accepted the contents after canonicalizing only the already
channel-scoped Character object name in memory; the stored remote-ready
Character manifest remains unchanged. This distinction is necessary because
the validator accepts canonical `releases/...` names while the local Android
candidate intentionally uses `staging/v2/releases/...`.

An isolated `stagingDebug` Android build consumed the complete pair from a
temporary loopback server. Initial consent resolved all five enabled manifest
entries and reported a 12 MB compressed download. On-device persisted files
matched the exact Character and Team sizes and SHA-256 values above. The Team
Builder then loaded the typed analysis and reported `10/11 available`,
`1 unavailable` and `0 needs info` for the one-member Metal Cooler Army smoke
draft. Catalog and Team Builder screenshots verified Super, Extreme and
classless badges, plus the intentional shared Bota Magetta thumb rendered with
independent STR and PHY layers.

Local cleartext transport is doubly isolated: only `stagingDebug` packages a
network-security overlay for `10.0.2.2`, `127.0.0.1` and `localhost`, and only
the disabled-release `staging` flavor enables Team Analysis HTTP for those
exact hosts. The generated `productionDebug` flag remained false and both
production network-security resources keep cleartext disabled.
Final read-only Android contract review found no P0-P3 issue.

## Remaining release gate

The local Character/portrait bundle, exact Team Analysis rebind and isolated
Android staging consumption are `GO`; publication is not. Before any remote
mutation, the stopped staging publisher must receive its normal explicit
dry-run and byte report under a separate authorization.

The installed-game asset version for these exact copied CPK bytes has not yet
been cryptographically joined to a downloaded manifest entry. The official
package/version, bounded archive and per-file hashes are proven;
manifest-level asset lineage is therefore still an explicit residual gate
rather than an inferred claim. Publisher dry-run, publication, production and
R2 mutation remain `NO-GO`.

## Layered portrait delivery dry-run

A later candidate preserved the same official inputs while adding the three
typed rendering layers consumed by Android motion: background, transparent
character thumb and static badge overlay. All objects remain isolated under
`staging/v2/`; production keys are structurally rejected.

| Check | Result |
| --- | ---: |
| Character version | `2026-08-26T20:58:47.619Z` |
| Character gzip bytes | 2,554,009 |
| Character gzip SHA-256 | `403b40ce911147899986b8c7c618acbc40af8f67973793e63aab58281beb79f4` |
| Portrait references / static objects | 1,627 / 1,627 |
| Deduplicated layer objects | 1,656 |
| Visual objects planned | 3,283 |
| Visual object bytes | 66,929,757 |
| Character managed bytes | 69,484,222 |
| Team Analysis version | `2026-08-26T20:58:47.619Z:parser-1.9.16` |
| Team Analysis gzip bytes | 2,962,029 |
| Team Analysis gzip SHA-256 | `43a01d5efb74241fdd1661b92adb1d8fb961f1c68098b68003e36909265bc550` |
| Team Analysis states | 2,288 |

The Character publisher now accepts only the candidate's exact immutable
payload key, recursively collects base/transformation/awakening portraits and
their typed layers, proves local containment and embedded SHA-256, and refuses
to skip a layered contract. Before a prior state can suppress an upload it
also rereads the remote object and verifies exact size and SHA-256. Remote
manifest failures other than a confirmed missing key fail closed. Payload and
assets remain before the mutable manifest, and immutable historical objects
remain retained pending release-aware GC.

The final remote staging dry-runs were read-only. Characters planned
69,484,222 new managed bytes and a conservative whole-bucket upper bound of
480,484,222/10,000,000,000 bytes. The exact Team pair planned 2,962,743 new
bytes, retained all four tracked Team releases with no cleanup, and reported a
12,270,862/50,000,000-byte namespace peak. If both plans are executed against
the same current bucket, their combined conservative upper bound is
483,446,965/10,000,000,000 bytes.

Focused compiled delivery checks passed 25 cases. The broader suite reached
1,861 passing and 13 expected pending cases; two DD6 source-lock failures are
the known `project-state.md` versus committed-HEAD checkpoint constraint, and
the single two-second WT timeout passed all 43 cases when rerun with its
appropriate bound. Independent re-review found no remaining P0-P2 issue.

Remote staging dry-run and the exact paired candidate are `GO`. Actual staging
upload requires separate authorization and coordinated Character + Team
manifest promotion. Production, Play and all production manifests remain
`NO-GO`; this checkpoint performed no R2 mutation.
