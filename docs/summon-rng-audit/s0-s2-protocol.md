# Summon RNG audit S0-S2 protocol

Status: offline checkpoint for Global build 6.4.0 (338). This campaign is independent of the database-first character migration. It changes no Android, R2, publisher or production path.

## Question and hypotheses

The campaign asks whether observed summon results are compatible with the published banner rules and a slot-aware independent null model, with special attention to an alleged Friend Summon trigger and to duplicate cards within or across multis.

- H0: draws follow the published banner, step and slot rules and are independent conditional on those rules.
- H1: Friend and ordinary summons share a seed, counter or session state.
- H2: results depend on undisclosed account, session, time, banner, history or other server state.
- H3: clusters arise naturally from pool weights, guaranteed slots, stopping rules, multiple comparisons or recall bias.
- H4: the client requests and presents results selected elsewhere, so the complete selection algorithm is not recoverable from the APK.

No hypothesis is presumed true. In particular, an unusual cluster is not evidence of manipulation until it is compared with the correct banner-, step- and slot-specific distribution.

## Threat model and safety boundary

The main risks are evidentiary rather than adversarial: mixing versions or banners, silently changing source bytes, leaking user material, treating presentation RNG as card RNG, optional stopping, losing negative attempts, overfitting a trigger after seeing results, and promoting correlation to causation.

The tracked contract is offline-only, default-off and fail-closed. It rejects sensitive field names and fixes these prohibitions:

- no real account identifier, token, cookie, credential, device identifier or raw authenticated payload;
- no spending solely to feed the experiment;
- no draw automation, prediction or attempt to obtain an advantage;
- no hooking, memory changes or instrumented game execution in this checkpoint;
- no Android, R2, publisher or production mutation.

Dynamic instrumentation, authenticated interception or authenticated requests remain separate authorization gates. Raw APK, ELF, SQLite, HAR and observation artifacts stay outside Git; tracked files contain only sanitized identities, structural pins, contracts and reports.

## Provenance ledger

| Evidence plane | Pinned source | Allowed conclusion | Explicit limit |
| --- | --- | --- | --- |
| Client static | Global APK 6.4.0 (338), SHA-256 `a51ba758...159bc0` | Exact package/build identity | Does not expose server logic |
| Client static | AArch64 ELF, SHA-256 `7d6c2c1...7215a`, Build ID `2d363d...3d51` | Exact draw/result/movie code regions | Negative findings apply only to pinned regions/build |
| Client static | Current/backup SQLite, SHA-256 `3654eb7...78265` / `18012e5...7f2c` | No summon-named tables in these content snapshots | Absence is not server-schema evidence |
| Protocol/catalog | Existing H4/H10/H13 offline artifacts | Partial official gasha pool/rate observations | H4 unions lose step association; no draw-result authority |
| Published rules | [Bandai Namco summon-types FAQ](https://bnfaq.channel.or.jp/faq/detail/1625/8602) | Generic Multi GSSR and examples of step benefits | Exact content varies by Summon and must come from in-game News/rates |
| Published rules | [Bandai Namco Friend Points FAQ](https://bnfaq.channel.or.jp/faq/detail/1625/2424) | Friend Points are used for Friend Summons | Does not define a “featured” Friend trigger |
| Statistical observation | None yet | None | Anecdotes have no denominator or controls |
| Community report | User-described legend | Candidate hypothesis only | Trigger and stopping rule remain undefined |
| Server-side inference | Static request/response boundary | Server selection is consistent with the client flow | Server RNG, independence and conditioning remain unknown |

The full exact identities and native region hashes live in `summon-rng-audit/s0-s2-profile.ts`. The executable report preserves the required evidence classifications: `first_party_supported`, `statistically_supported`, `corroborative_only`, `consistent_but_unproven`, `unknown`, `contradicted`.

## Data minimization for later observations

The later S3 contract may retain an experiment-generated anonymous session label, coarse timestamp or bucket, build/region, banner/version, summon type, multi/slot indices, card ID, rarity, featured/guaranteed flags, Friend sequence/trigger fields, attempts until trigger, Friend-to-banner interval and source-quality classification.

It must not retain a real account ID, username, token, cookie, device or advertising ID, authenticated request/response body, purchase receipt, free-form note likely to contain personal data, or a reversible hash of any such identifier. Experiment IDs must be freshly generated and scoped to the dataset.

## Claim gates

| Claim | GO criteria | Current status |
| --- | --- | --- |
| Client receives selected cards | Exact APK/ELF identity plus pinned request, callback, JSON extraction and presentation regions | GO for build 6.4.0 |
| Client selects cards locally | A pinned, reachable selection routine that consumes banner pools and produces `gasha_items` before the response boundary | NO-GO; not found |
| Exact published rate for a slot | First-party banner/rate snapshot with banner ID/version, region, validity window, step/course and guarantee semantics | NO-GO; target banner absent |
| Friend trigger association | Trigger fixed before analysis, complete attempts retained, contemporaneous controls, adequate power, multiplicity correction and confirmatory replication | NO-GO |
| Duplicate dependence | Exact weighted pool and replacement semantics, separate slot distributions, preregistered statistic, Monte Carlo calibration and replication | NO-GO |
| Shared client seed/state | Reachable state carried from Friend draw into ordinary draw request or client selection | NO-GO; not found in pinned path |
| Shared server seed/state | Reproducible protocol/statistical evidence excluding banner, slot, time, session and stopping-rule alternatives | Unknown |
| Manipulation, fraud or false rates | Multiple independent, reproducible and proportionate evidence planes plus a correct first-party null model | NO-GO |

## Next gate inputs

S3-S5 can proceed only after two semantic inputs are fixed:

1. an observable, deterministic definition of the alleged “featured in Friend Summon” trigger, including whether it is a card ID set, rarity/set category, animation, reward or another event;
2. the exact ordinary banner(s), region, validity window and first-party rate/rule snapshots to model.

No new paid pulls are needed or permitted for this purpose. Existing history, future naturally occurring pulls, or consented anonymized records may be used if they preserve every attempt and negative result.
