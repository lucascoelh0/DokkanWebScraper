# Pettan Battle catalog

Pettan Battle is not modeled as an ordinary quest event. Its catalog is a
collection of numbered stickers grouped into series, with separate map/arena
topology elsewhere in the game database.

The collector is deliberately DB-first:

- `sd_characters` supplies sticker/card identity, ATK power, HP, raw element,
  raw rarity, series, sticker number, description and availability date.
- `cards` supplies the displayed character name and its raw element alongside
  the Pettan-specific raw element.
- `leader_skill_sets` supplies the title displayed on the sticker back.
- DokkanInfo supplies the binder image and the visual layers used to construct
  each sticker front and back.

No title or name join is used. Official stickers and community visuals join
only through the exact numeric `card_id`. The generated audit retains
official-only IDs, visual-only IDs and every field mismatch. Official metadata
is never overwritten by community text.

The label printed beside `Type` on the back remains opaque visual provenance.
Pettan Battle has no Super/Extreme sticker classification or mechanic, so
prefixes such as `S.` and `E.` are preserved exactly as printed and are never
interpreted. The dataset keeps both official raw element fields alongside that
printed label without inventing a gameplay rule.

## Refresh

From the repository root:

```powershell
npm run run:pettan-battle
```

The default database is
`D:/Dokkan/database/decrypted/dokkan-global-current.db`. Override it only for a
deliberate local refresh:

```powershell
$env:PETTAN_BATTLE_DATABASE = "D:/path/to/database.db"
npm run run:pettan-battle
```

The SQLite bridge opens the database with `mode=ro`, `immutable=1` and
`query_only`. The runner fingerprints the database before and after collection
and fails if it changes.

DokkanInfo responses are cached for 168 hours under
`data/pettan-battle/cache`. Use `PETTAN_BATTLE_REFRESH=1` to bypass the cache.
`PETTAN_BATTLE_CONCURRENCY`, `PETTAN_BATTLE_DELAY_MS` and
`PETTAN_BATTLE_CACHE_TTL_HOURS` tune collection without changing the contract.

## Output

The local ignored output is:

`data/pettan-battle/latest/pettan-battle.json`

Each sticker retains both official gameplay/catalog data and the visual paths:

- front background, character, optional effect, type frame and rarity frame;
- back background, face artwork and frame;
- displayed power and the opaque label printed beside `Type`, used only to
  audit/reconstruct the rendered sticker.

This command does not download the image bytes, publish to R2 or alter the
Android app. Asset download/delivery is a separate, explicitly authorized
step.
