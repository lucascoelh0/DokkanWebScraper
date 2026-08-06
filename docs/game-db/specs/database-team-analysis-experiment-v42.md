# Database Team Analysis experiment v42 (DB43)

Status: experimental, non-production. Contract version: `0.42.0`.

DB43 resolves passive efficacy type `24` through the native efficacy dispatch and its consumers. The eight-byte handler passes the `CallChangeParam` plus literal type 24 to the generic no-value registration path. It does not read `eff_value1..3` or `calc_option`; raw values and the independently proved DB31 operation remain preserved, but the operation is explicitly not applied to this boolean guard decision.

Three native paths independently query efficacy 24 on the defender: player intermediary damage, player attack setup and enemy attack setup. Each passes the result as `w2` to `DPuzzleGameCalcData::checkGuard`. The function returns the independent efficacy-78 override, or—only when efficacy 24 and two other independent overrides are absent—the normal `elementAffinity == 1` result. The supported product operation is therefore `disable_normal_element_affinity_guard`, with the precise boundary that efficacy 78 can still force guard.

All 34 projected rules across 34 states and 34 passive IDs resolve losslessly. DB35/DB36 prove their selected-enemy candidate scope and empty sub-target identity. DB33 proves 33 player-attack-setup timings; the single raw timing-5 rule remains unknown. DB37 supplies duration and once-only field mechanics, while recurrence/reset/expiry remains partial. The current legacy dataset contains 33 of the 34 states but no directly comparable first-party rule identity or supported guard-disable kind, so DB43 records representation gain without claiming parser agreement or conflict.

The final damage formula, guard coefficient application order, calculation bucket, raw timing 5, independent override product semantics, recurrence/reset/expiry epoch and cross-status stacking/removal order remain unknown.
