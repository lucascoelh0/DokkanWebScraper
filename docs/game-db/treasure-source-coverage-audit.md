# Treasure source coverage audit — 2026-09-11

Read-only audit of Global snapshot 1788329250. No game login, new capture,
publication or app change. SQLite opened read-only at
`game-db/data/wp01-wallpaper-source-1788329250/database.decrypted.sqlite`;
SHA-256 `7a6ca01808aea355ef28f9c0190e2c072f43a7c08be41d363f5b052824922495`.
Reproducible local query helper/report: `.agent-logs/audit-treasure-sources.cjs`
and `.agent-logs/treasure-source-audit.json`.

## Findings

| Evidence | Rows referencing treasures | Distinct treasure IDs |
| --- | ---: | ---: |
| Official names/descriptions (`treasure_items`) | 331 | 331 |
| Mission rewards (`mission_rewards`) | 2,322 | 67 |
| Boss drop definitions (`sugoroku_map_boss_drop_items`) | 718 | 25 |
| Displayed quest drops (`quest_drop_item_views`, item1) | 22 | 5 |
| World Tournament missions | 143 | 2 |
| World Tournament local ranking rewards | 180 | 1 |
| World Tournament ranking gifts | 78 | 2 |
| Ultimate Clash missions | 323 | 1 |

Primary mission/drop evidence covers 80 unique treasures; adding tournament and
Clash references covers 82. These are historical DB references, not complete
acquisition coverage or a count of currently obtainable treasures. All 2,322
mission reward rows resolve to missions. All 718 boss-drop rows resolve to both
maps and quests with matching quest IDs. Boss definitions do not provide quantity
or probability: do not manufacture drop rates or guaranteed quantities.

Mission category reward slots also reference treasures, but are not added as
independent grants without proving their semantics; this avoids double counting.
`sd_arenas.symbol_item_type` is display metadata, not acquisition proof. The
searched Z-Battle reward tables contain no TreasureItem rewards in this snapshot.
The scan targets typed item-ID columns; it does not claim to exhaust scripts,
encoded map data or server-only deliveries.

The existing sanitized shop projection contains six TreasureItem reward entries
for six distinct treasures. The current card-only exchange publisher excludes
non-card offers deliberately. These can support a later exchange-source adapter,
without another login, but require validating the complete offers/cost semantics.
The DB's `shops` table holds shop definitions, not that complete offer inventory.
Login, gifts and paid packs are not proven complete by this audit.

## Why the screenshot says no missions

Select Character Dragon Stone 11 (1082) has four mission references: 31618,
31621, 31624, 31627. They require clearing seven stages, have no area or specific
stage ownership, and carry weekly intervals in January 2026 (now ended). The
current app searches event-linked missions only. A generic mission must not be
forced into a fake event destination or presented as currently available.

Its official description says it is a limited-time red stone usable at Baba's
Shop. Other descriptions are more helpful: Hercule's Autograph explicitly names
World Tournament; Battlefield Memory explicitly names Ultimate Clash.

## Recommended bounded implementation

1. Deliver official descriptions for all 331 treasures, independently of offers.
2. Add exact-ID sources for boss/quest drops and all normal missions, including
   generic missions without event navigation. Preserve known time windows and
   distinguish ended/unknown availability from current acquisition claims.
3. Add Tournament and Clash adapters, then treasure-for-treasure exchanges from
   the existing sanitized response. Do not build another account client.

Use an optional treasure catalog/index instead of inflating the character-only
exchange payload or requiring all Stage detail shards to download. Preserve old
caches and allow description/artwork even when sources are absent. Keep source
provenance, deduplication and exact navigation targets testable outside Compose.
Any production implementation or publication needs its own approval.
