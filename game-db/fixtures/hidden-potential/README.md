# Hidden Potential fixed source fixture

`source.json` is an 86 KB normalized subset of the pinned Global SQLite, SHA-256
`7a6ca01808aea355ef28f9c0190e2c072f43a7c08be41d363f5b052824922495`.
It contains seven exact cards, relevant growth/Optimal rows and routes, and boards
20–24, 30, 31, 33 and 201. No legacy stat field or FYI value supplied expectations.

Node tuples are `[idOffset, routeOrNull, hp, atk, def, requiredSa, choiceCount]`.
Add `boardId * 100000` to offsets, roots and edge endpoints. `same-as-20` uses the
exact normalized common graph verified in the investigation; nodes and bonuses
remain board-specific. Growth rows are limited to the levels exercised here.

The stat goldens are fixed literals in `game-db-hidden-potential-core.spec.ts`,
transcribed from the investigation's tables, not recomputed by the tested engine.
Coordinates are not inferred from these fixtures. Direct layout proof covers only
020 and 201; the production bridge separately pins and checks their JSON files.

The Python tests construct a synthetic in-memory SQLite with this topology to
exercise schema/join rejection. Those tests are distinct from the optional real
source verification. Do not replace this fixture during ordinary test execution.
