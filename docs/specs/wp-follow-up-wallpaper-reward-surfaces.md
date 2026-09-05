# Wallpaper reward surface follow-up

Status: evidence required; no implementation is part of WP-01.

This follow-up owns the 29 globally audited `WallpaperItem` occurrences that
the current Stage consumer does not deliver. Asset availability alone does not
prove the product semantics or a safe navigation destination.

## Mission category completion rewards

- Current evidence: 25 occurrences in `mission_category_rewards`.
- Current classification: surface missing.
- Required before implementation: prove when each reward is granted, how the
  four item slots relate to category completion, which mission/category screen
  owns the reward, and the correct Android navigation target.

## RMBattle mission rewards

- Current evidence: one occurrence in `rmbattle_mission_rewards`.
- Current classification: contract missing.
- Required before implementation: prove RMBattle mission identity, ownership,
  availability rules, and navigation independently of the normal Stage and
  event-mission model.

## General missions without Stage binding

- Current evidence: three `mission_rewards` rows whose missions have no valid
  area/Stage binding:
  - reward `35497`, mission `21452`, wallpaper `39`;
  - reward `40641`, mission `23880`, wallpaper `45`;
  - reward `51171`, mission `3008110`, wallpaper `68`.
- Current classification: out of scope for the current Stage projection.
- Required before implementation: define and validate a general-mission
  consumer surface and navigation model. Do not attach these rows to a Stage by
  heuristic or by wallpaper identity.

Each surface must be investigated and approved independently. None should be
described as Android-delivered until its contract, semantics, navigation, and
tests exist.
