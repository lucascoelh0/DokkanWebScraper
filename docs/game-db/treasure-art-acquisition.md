# Complete Global treasure artwork — 2026-09-11

Status: acquired, verified and published to staging with user authorization on
2026-09-11. No production publication or Android change.

## Coverage and source

The 331 rows in Global snapshot `1788329250`'s `treasure_items.csv` map through
`image_suffix_number` to 303 distinct images. Every image was recovered from the
installed official Global client's cache on LDPlayer (`emulator-5554`), without
login requests, HAR replay, purchases or community image downloads.

- 303 / 303 PNGs; 331 / 331 treasures; no missing images.
- 5,338,397 PNG bytes (5.09 MiB), before any publication deduplication.
- All 31 currencies in the local Treasure Exchange candidate are covered,
  including the 16 whose staging URLs were missing.
- Each PNG was fully decoded with Sharp, not just checked by extension.
- Every pulled CPK's SHA-256 was compared with `sha256sum` on the emulator;
  all 303 matched. Sample images were also inspected visually.

Local output: `game-db/data/treasure-art-20260911-v2/`.
`inventory.json` records treasure IDs/names, exact asset paths, dimensions,
PNG and CPK hashes, source paths, source CSV hash, client version and tool pins.
`game-assets/` contains the files in their existing Android-compatible hierarchy:

`item/other/en/thumb/thumb_trade_jewel_<suffix>/thumb_trade_jewel_<suffix>.png`

The suffix is zero-padded to five digits, not inferred from the treasure ID.
Shared suffixes are extracted once and preserve all associated treasure IDs.

## Repeat safely

Local acquisition helper: `.agent-logs/acquire-treasure-art.cjs`. It uses the
existing source CSV parser and pinned `wp01-tools/CpkVerify/bin/Release/net7.0`
extractor. Its three binary hashes are checked before extraction; the reader
commit is `169b001c748dfffc28c9fc14fcec269dd45e6eec`.

Use a fresh output directory and the intended metadata snapshot. On the selected
root-capable emulator, use root **adbd** and binary `adb pull` for CPKs. Do not pipe
`su` terminal output into binary files: its pseudo-terminal can translate LF to
CRLF and corrupt archive members. The initial `treasure-art-20260911` directory
is an explicitly invalid diagnostic attempt, contains no accepted inventory and
must never be used for publication. Only the `-v2` inventory is accepted.

The acquisition reads only the exact treasure thumbnail archives under
`/data/user/0/com.bandainamcogames.dbzdokkanww/files/assets/item/other/en/thumb/`.
No personal data or authentication material is included in the output.

## Publication boundary

The remote read-only preflight compared existing PNG bytes by SHA-256: 47 identical
objects reused, 256 absent objects, zero conflicts. The publisher dry-run reported
4,405,982 new bytes (4.20 MiB), which were uploaded after the user's authorization.
A repeat dry-run reports zero changed objects and zero upload bytes.

Use `game-db-stage-assets-publisher` with `--assets-only`, the supplemental
`treasure-assets-manifest.json`, explicit `--object-prefix staging/v2`, and a
separate publish state. This keeps `staging/v2/game-assets-manifest.json` intact;
the 303-image supplemental inventory must not replace the shared inventory.
The local preflight report/state are under `.agent-logs/treasure-art-*`.

For future runs, repeat remote byte comparison and the publisher dry-run, report
new/reused/conflicting objects and projected bytes, and obtain explicit staging
authorization. Reuse existing paths; never overwrite conflicting bytes without
review. No exchange dataset or production object was published in this run.
