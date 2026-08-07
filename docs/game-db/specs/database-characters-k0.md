# Database Characters K0 — inventory and identity

Status: optional, additive, non-production. Contract version `1.0.0`.

## Question, boundary and gate

K0 asks which first-party character identities and joins are already stable.
It consumes the exact validated DB1 artifact for snapshot
`global-6.4.0-v338-2026-08-05` by streaming its `cards` array. It does not run
DB0–DB50, parse presentation text, inspect endpoints, or change production.

The gate is green only when card, character, unique-info, form and state
identities reconstruct losslessly; card and state identities are unique;
supported relations retain structural source IDs while partial provenance is
explicit; dangling targets are enumerated; two
generations are byte-identical; and the source manifest/hash profile is exact.

## Identity decisions

- `characters.id` is character identity.
- `cards.id` is card/release identity and also the form-card identity where a
  structured form relation reaches that row.
- A playable state is the card ID plus either `initial` or the exact
  `optimal_awakening_growths.id`; release labels do not replace row identity.
- `card_unique_infos.id` is a variant/family relation, not card identity.
- hard-duplicate and awakening-family grouping remain separate from UI
  collection grouping.
- names, titles and descriptions are never join keys.

## Pinned result

K0 reconstructs 1,044 character rows, 5,759 cards (5,344 collectable and 415
form cards), and 10,654 states: 5,759 initial, 4,855 EZA, 37 SEZA and three
unknown release states. It retains 1,424 projected primary collection cards.

Supported joins contain 34,018 link assignments over all 133 link IDs, 54,072
category assignments over all 98 category IDs, 558 form relations, 494 Active
Skill card relations, 28 Standby relations and 92 Finish relations. Character,
unique-info, link, category and form joins have no dangling targets.

Two awakening targets, `1010611` and `1010621`, are outside the selected DB1
corpus. Their raw route target IDs remain supported, while the selected-corpus
join is partial; selection absence is not rewritten as a missing database row
or inferred from numeric proximity.

The relation channel contains seven fully supported families and two partial
families. Forty-six card-to-Finish assignments reached through Standby retain
their target set and `standby-derived` identity, but DB1 did not retain the
intermediate relation row; they remain partial instead of receiving invented
provenance. The two out-of-corpus awakening targets are the other partial
assignments. There are no unknown assignments.

The deterministic K0 payload is 32,196,636 bytes uncompressed and 1,526,194
bytes gzip, SHA-256
`c084075d1b8d89814a5c6245097812e7102440670b547b87d8e555d65cf010d9`.
Two complete streaming generations were byte-identical. Peak observed RSS was
497,344,512 bytes, below the 1 GiB gate ceiling. The manifest also pins byte
size and SHA-256 for coverage and validation artifacts.
