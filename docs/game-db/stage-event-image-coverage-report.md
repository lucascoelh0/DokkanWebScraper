# SRP-07 Stage event image coverage report

**Status:** deterministic local audit complete; publication remains blocked

**Snapshot:** Global database `1788329250`, asset version `1788327754`

## Deterministic classification

`game-db-stage-event-image-coverage` joins the generated Stage catalog to the
owned asset manifest by normalized `eventImagePath`. It groups quest levels by
exact `areaId`, keeps Z-Battles under their exact IDs, and fails closed when a
single area projects multiple titles or image paths, when catalog and asset
identities differ, or when an official local recovery is not bound to a current
manifest gap.

The real local report contains 924 events: 689 quest areas and 235 Z-Battles.
Its deterministic report SHA-256 is
`e19e56f382a695015ffea2abe56445af38f40ce5310eb9ef9eddece0a5738e12`.

| Event classification | Count | Diagnostic meaning |
| --- | ---: | --- |
| `image-not-applicable` | 1 | The official area type has no image contract. |
| `dataset-path-missing` | 0 | No event that should project an image is missing its path. |
| `owned-asset-available` | 849 | The manifest owns verified bytes; a missing rendered image is a render/cache/network failure. |
| `accepted-missing` | 74 | The projected path is in the snapshot-bound accepted missing set. |
| `official-local-recoverable` | 0 | No exact usable official local byte was found. |
| `manifest-generation-failure` | 0 | No projected path fell outside both manifest inventories. |

The sole pathless event is area `10001`, **The Wheels of Fate Turn**, catalog
entry `quest-level:10`. Its exact official type is `Area::TutorialArea`, and its
`is_listbutton_visible` value is `0`; its header, banner and listbutton fields
are all empty. The path is therefore `image-not-applicable`, not a dataset
defect or manifest gap. It remains one of the 924 audited surfaces so the
exception cannot disappear silently. No path is invented and no other area's
banner is reused.

The current manifest has 69 missing assets: 65 banner paths in the event-image
coverage and four non-banner assets. The latter are the zero-byte `1004310`
card placeholder and three legacy enemy thumbs (`1003490`, `1003491`,
`3001121`). They remain explicitly separate from banner coverage. All 69 are
covered by the exact acceptance SHA-256
`9e05ad1a096da5ba1c7a6479e4f66769160cde8a48c96e554655b4c3e0a2dea9`.

## Deadly Struggle! Menacing Army

The title is not a safe identity key:

| Area | Catalog entry | Projected path | Owned state |
| ---: | --- | --- | --- |
| 238 | `quest-level:2380011` | `banners/en/event/eve_listbutton/myp_banner_event_238.png` | present, 28,131 bytes, SHA-256 `4201d86c2acd0740668a1327e1a690b9203cf7c214ca6be9bc9d41c8ead7f3ff` |
| 1216 | `quest-level:12160011` | `banners/en/event/eve_listbutton/myp_banner_event_1216.png` | accepted missing |

Area 1216 cannot reuse area 238's byte merely because their localized titles
match. In the exact official SQLite, area 238 is category 4, announcement
103083, start script 2238010 and key cost 17; area 1216 is category 6,
announcement 107067, start script 12168010 and key cost 1. Each row owns its
own header, list and my-page banner paths, and neither has a `prev_area_id`.
Their battles and rewards were reused, but there is no first-party alias or
hash equality. A missing render for area 238 diagnoses render/cache/network
handling; a missing render for area 1216 is the accepted source gap.

The currently owned 238 byte retains the pre-existing DokkanStats acquisition
URL in the manifest. That proves owned-mirror availability, not first-party
provenance, and it was not used to fill or infer any missing path.

## Official local recovery attempt

The installed official package
`com.bandainamcogames.dbzdokkanww` on `emulator-5554` was inspected read-only.
The audit pulled and enumerated 37 unique relevant CPKs with the pinned CriFsV2Lib
reader commit `169b001c748dfffc28c9fc14fcec269dd45e6eec`: all 29
`layout/en/image` archives, six `outgame/extension/released_event` archives,
`outgame/extension/event/eve_icon.cpk`, and `mydata/banner.cpk`. Their 3,302
members contain none of the 65 missing event-image identities. The official
`download_caches.db` has 192 current cached URLs and zero basename matches for
the 69 accepted missing assets.

Representative exact source hashes:

| Official local source | Bytes | SHA-256 |
| --- | ---: | --- |
| `layout/en/image/mypage.cpk` | 2,075,864 | `3cb39fc2afe97f966e4bbd520368e8a035a0cef8990be69478dd9bd31b7ccdc9` |
| `layout/en/image/quest.cpk` | 4,270,392 | `00e865031e234a832651ffe8e112f2001f698b657efb2e0c22f12d9396eb77b6` |
| `mydata/banner.cpk` | 51,328 | `ef8fe1b470f32277dd2b7d8ba2967c286df176787bfe1a6582c26230f97c7c94` |
| `outgame/extension/event/eve_icon.cpk` | 73,976 | `f6035d18f79c39a76de9207515164a6e6397e574015460aa6abf969e56887b38` |
| `download_caches.db` | 17,645,568 | `098f0e532ec3ee34138b8b4b43908a0bd3d8491bc85dee67aaf0b7ffaa35e2d4` |
| `character/thumb/card_1004310_thumb.cpk` | 4,224 | `cbc295b5322dcc66f20b50ac4cfe211545427566e45afe68bf900557688e179f` |

The last archive does contain the expected member name, but its extracted PNG
is zero bytes (empty-content SHA-256
`e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`).
It is therefore evidence of an invalid first-party placeholder, not a
recoverable image. No alternative banner or same-title asset was substituted.
DokkanStats supplied no recovery bytes.

## Accepted banner gap classification

Every row below is snapshot-bound `accepted-missing`. The 65 event paths affect
74 catalog events because a few official paths are intentionally reused by
multiple area IDs.

| Missing path | Kind | Affected event identities |
| --- | --- | --- |
| `banners/en/event/eve_header/quest_top_banner_803.png` | event image | area 803 |
| `banners/en/event/eve_header/quest_top_banner_806_R2.png` | event image | area 806 |
| `banners/en/event/eve_listbutton/myp_banner_event_130.png` | event image | area 130 |
| `banners/en/event/eve_listbutton/myp_banner_event_134.png` | event image | area 134 |
| `banners/en/event/eve_listbutton/myp_banner_event_150.png` | event image | area 150 |
| `banners/en/event/eve_listbutton/myp_banner_event_153.png` | event image | area 153 |
| `banners/en/event/eve_listbutton/myp_banner_event_154.png` | event image | area 154 |
| `banners/en/event/eve_listbutton/myp_banner_event_155.png` | event image | area 155 |
| `banners/en/event/eve_listbutton/myp_banner_event_156.png` | event image | area 156 |
| `banners/en/event/eve_listbutton/myp_banner_event_157.png` | event image | area 157 |
| `banners/en/event/eve_listbutton/myp_banner_event_158.png` | event image | area 158 |
| `banners/en/event/eve_listbutton/myp_banner_event_191.png` | event image | area 191 |
| `banners/en/event/eve_listbutton/myp_banner_event_192.png` | event image | area 192 |
| `banners/en/event/eve_listbutton/myp_banner_event_193.png` | event image | area 193 |
| `banners/en/event/eve_listbutton/myp_banner_event_194.png` | event image | area 194 |
| `banners/en/event/eve_listbutton/myp_banner_event_195.png` | event image | area 195 |
| `banners/en/event/eve_listbutton/myp_banner_event_196.png` | event image | area 196 |
| `banners/en/event/eve_listbutton/myp_banner_event_197.png` | event image | area 197 |
| `banners/en/event/eve_listbutton/myp_banner_event_198.png` | event image | area 198 |
| `banners/en/event/eve_listbutton/myp_banner_event_199.png` | event image | areas 199, 252 |
| `banners/en/event/eve_listbutton/myp_banner_event_202A.png` | event image | area 202 |
| `banners/en/event/eve_listbutton/myp_banner_event_204.png` | event image | areas 204–208 |
| `banners/en/event/eve_listbutton/myp_banner_event_214.png` | event image | area 214 |
| `banners/en/event/eve_listbutton/myp_banner_event_216.png` | event image | area 216 |
| `banners/en/event/eve_listbutton/myp_banner_event_221.png` | event image | area 221 |
| `banners/en/event/eve_listbutton/myp_banner_event_222.png` | event image | area 222 |
| `banners/en/event/eve_listbutton/myp_banner_event_233.png` | event image | area 233 |
| `banners/en/event/eve_listbutton/myp_banner_event_237.png` | event image | area 237 |
| `banners/en/event/eve_listbutton/myp_banner_event_241.png` | event image | area 241 |
| `banners/en/event/eve_listbutton/myp_banner_event_244.png` | event image | area 244 |
| `banners/en/event/eve_listbutton/myp_banner_event_247.png` | event image | area 247 |
| `banners/en/event/eve_listbutton/myp_banner_event_249.png` | event image | area 249 |
| `banners/en/event/eve_listbutton/myp_banner_event_257.png` | event image | area 257 |
| `banners/en/event/eve_listbutton/myp_banner_event_258.png` | event image | area 258 |
| `banners/en/event/eve_listbutton/myp_banner_event_265.png` | event image | area 265 |
| `banners/en/event/eve_listbutton/myp_banner_event_305.png` | event image | area 305 |
| `banners/en/event/eve_listbutton/myp_banner_event_315.png` | event image | area 315 |
| `banners/en/event/eve_listbutton/myp_banner_event_322.png` | event image | area 322 |
| `banners/en/event/eve_listbutton/myp_banner_event_324.png` | event image | area 324 |
| `banners/en/event/eve_listbutton/myp_banner_event_338_1.png` | event image | area 338 |
| `banners/en/event/eve_listbutton/myp_banner_event_339.png` | event image | area 339 |
| `banners/en/event/eve_listbutton/myp_banner_event_346.png` | event image | area 346 |
| `banners/en/event/eve_listbutton/myp_banner_event_362.png` | event image | area 362 |
| `banners/en/event/eve_listbutton/myp_banner_event_364.png` | event image | area 364 |
| `banners/en/event/eve_listbutton/myp_banner_event_365.png` | event image | area 365 |
| `banners/en/event/eve_listbutton/myp_banner_event_373.png` | event image | area 373 |
| `banners/en/event/eve_listbutton/myp_banner_event_377.png` | event image | area 377 |
| `banners/en/event/eve_listbutton/myp_banner_event_705.png` | event image | area 706 |
| `banners/en/event/eve_listbutton/myp_banner_event_707.png` | event image | area 707 |
| `banners/en/event/eve_listbutton/myp_banner_event_722.png` | event image | area 722 |
| `banners/en/event/eve_listbutton/myp_banner_event_727_1.png` | event image | area 727 |
| `banners/en/event/eve_listbutton/myp_banner_event_730.png` | event image | areas 730–734 |
| `banners/en/event/eve_listbutton/myp_banner_event_740.png` | event image | area 740 |
| `banners/en/event/eve_listbutton/myp_banner_event_743.png` | event image | area 743 |
| `banners/en/event/eve_listbutton/myp_banner_event_746.png` | event image | area 746 |
| `banners/en/event/eve_listbutton/myp_banner_event_763.png` | event image | area 763 |
| `banners/en/event/eve_listbutton/myp_banner_event_778.png` | event image | area 778 |
| `banners/en/event/eve_listbutton/myp_banner_event_802.png` | event image | area 802 |
| `banners/en/event/eve_listbutton/myp_banner_event_1205.png` | event image | area 1205 |
| `banners/en/event/eve_listbutton/myp_banner_event_1206.png` | event image | area 1206 |
| `banners/en/event/eve_listbutton/myp_banner_event_1216.png` | event image | area 1216 |
| `banners/en/event/eve_listbutton/myp_banner_event_1712.png` | event image | area 1712 |
| `banners/en/event/eve_listbutton/myp_banner_event_1735.png` | event image | area 1735 |
| `banners/en/event/eve_listbutton/myp_banner_event_zbattle_008.png` | event image | Z-Battle 8 |
| `banners/en/event/eve_listbutton/myp_banner_event_zbattle_010.png` | event image | Z-Battle 10 |

## Non-banner missing asset classification

These four snapshot-bound `accepted-missing` assets are not counted as event
banner coverage and do not alter the 924 audited event surfaces.

| Missing path | Kind |
| --- | --- |
| `character/thumb/card_1004310_thumb/card_1004310_thumb.png` | invalid official placeholder |
| `character/thumb/card_1003490_thumb/card_1003490_thumb.png` | legacy enemy thumb |
| `character/thumb/card_1003491_thumb/card_1003491_thumb.png` | legacy enemy thumb |
| `character/thumb/card_3001121_thumb/card_3001121_thumb.png` | legacy enemy thumb |

## Local dry-runs

Both publishers were invoked with `--local --dry-run`, a fresh state path and
the `staging/v2` prefix. They performed no R2 access and wrote no publish state.

| Candidate | Files | Candidate bytes | Manifest bytes | Projected bytes |
| --- | ---: | ---: | ---: | ---: |
| Owned assets | 6,915 | 144,802,503 | 3,292,465 | 148,094,968 |
| Stage delivery | 18 | 1,836,607 | 124,881 | 1,961,488 |
| **Combined** |  |  |  | **150,056,456** |

These numbers are a full fresh local projection, not an assertion about the
delta against the currently published staging state. No publication is
authorized by this report.

## Product follow-up (not implemented)

`Area::TutorialArea` and other unsupported internal area types should not be
shown in the Android catalog. That consumer-side filtering is intentionally
deferred to a separate change. The audit continues to retain those areas and
classify their image applicability explicitly.
