# S2 static summon audit — Global 6.4.0

## Result

The pinned client is consistent with H4: it constructs a draw request using a gasha and course, receives JSON containing acquired cards, builds `GashaResult`, then drives movie and result scenes from that object. The audited path does not contain a client card draw over a local banner pool.

This supports only a client/server boundary. It does not recover the server RNG, prove independence, exclude hidden server state or validate any banner's rates.

## Reconstructed path

```text
Gasha UI / GashaModel::drawGasha(gasha, drawType)
    -> GashasDrawAPI::create(to_string(gasha.id), course/draw value)
    -> WebAPIBase request type 1, route gashas/{0}/courses/{1}/draw
    -> success callback(response JSON)
       -> update response-side assets and user_items
       -> GashaResult(gasha, drawType, response JSON)
          -> setGashaCards(response["gasha_items"])
          -> parseMovieInfo(response["movie"])
       -> EVENT_GASHA_MODEL_DRAW_SUCCESS
       -> GashaDrawMovieScene / GashaResultScene
```

The route constructor receives only the formatted gasha identifier and an integer course/draw value. No gasha-specific seed, timestamp or RNG counter argument is present in its signature or pinned body. Generic Web API infrastructure may add ordinary request metadata; the static audit makes no claim about undisclosed server-side state derived from that metadata.

## Card extraction and presentation

`GashaResult::setGashaCards` reads `user_items` and `gasha_items`. `AcquiredItems::each` walks the JSON collection with JsonCpp iterators, and `retrieveAcquiredCharacters` accumulates the resulting `UserCard` objects. The normal result list consumes the `GashaResult` card vector.

No call to a card shuffle, sort, random engine, seed or time source occurs in the pinned extraction and normal-list regions. The supported statement is narrow: these exact regions preserve the retrieved collection without an identified card randomization step. It is not a proof that every UI variant always displays identical ordering, nor is visual ordering itself evidence of server draw order.

## Local RNG is movie-scoped

The ELF does contain summon-related randomness:

- `gashaMovieProc::lotteryProc` calls `std::random_device`;
- `GashaMovieLottery::draw` is instantiated with `std::mersenne_twister_engine`;
- `GashaMovieState::getRandomEngine` exposes a movie-state engine;
- response/local movie metadata includes `movie`, `flags`, `lr_seed_cards`, `limited_cards` and `carnival_only_cards`.

Those routines select movie states or presentation variants after the response has been turned into a `GashaResult`. They are evidence of animation RNG, not evidence that the client selects `gasha_items`. The word “seed” in `lr_seed_cards` is a movie/result classification label and must not be confused with an RNG seed.

## Friend versus ordinary summons

The audited client uses the generic `GashasDrawAPI` route for the ordinary draw path and exposes Friend-point history as a category of `GashaModel`; no separate Friend card-selection engine or shared client seed/counter was identified. This narrows H1 on the client side but does not test a shared server seed, account/session conditioning or timing effect.

The exact alleged Friend trigger is intentionally not guessed. A Friend reward, animation, rarity, card set or user-defined “featured” event would create different tests and different stopping-rule bias.

## SQLite and catalog limits

The current and backup Global SQLite snapshots contain 232 and 137 tables respectively, pass `PRAGMA integrity_check`, and have zero table names matching `gasha`, `summon`, `lottery` or `draw`. The APK also embeds a small `assets/database.db`. Separately, H4/H10 observed gasha pools/rates on captured HTTP endpoints; those partial observations do not establish completeness, permanence or the location of every active banner rule.

Existing H4/H10/H13 captures corroborate `/gashas`, featured-card and rate structures. They do not contain an authorized population of result draws, and H4's pool/rate representation is a per-gasha union without step association. It is therefore invalid as the exact S4 null model.

## Hypothesis matrix at S2

| Hypothesis | Static status | Reason |
| --- | --- | --- |
| H0 published, slot-aware independence | `unknown` | Exact target banner and observations are absent |
| H1 shared client RNG/seed/counter | `contradicted` only for an identified mechanism; otherwise `unknown` | No such mechanism appears in the pinned path, but server sharing remains possible |
| H2 undisclosed conditioning | `unknown` | Server internals are outside the APK |
| H3 natural clusters/bias | `consistent_but_unproven` | Known statistical mechanisms can create clusters, but no exact null simulation has run |
| H4 server-selected/client-presented | `consistent_but_unproven` | Strong static boundary, but no server implementation or authorized result capture |

No current finding supports manipulation, fraud or false published rates.

## Reproduction

After compilation, run the offline verifier with four explicit paths:

```powershell
node lib/summon-rng-audit/s0-s2-run.js `
  --apk <pinned-apk> `
  --elf <pinned-elf> `
  --sqlite-current <pinned-current-sqlite> `
  --sqlite-backup <pinned-backup-sqlite>
```

The verifier accepts only the exact sizes/SHA-256 values, checks APK/SQLite headers, parses ELF64 little-endian AArch64, validates every pinned native symbol/VMA/size/code hash and validates the final S0-S2 report contract. It emits sanitized JSON to stdout and performs no request or mutation.
