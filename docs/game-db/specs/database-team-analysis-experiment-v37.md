# Database Team Analysis experiment v37 (DB38)

Status: experimental, non-production. Contract version: `0.37.0`.

DB38 maps efficacy type `98` through the native incremental-status handler. `eff_value1`, `eff_value2` and `eff_value3` reach `CallChangeParam +0x28/+0x30/+0x38`; the first two are truncated toward zero into a signed int32 increment and cap, while the third dispatches output fields `0..5`:

- `0`: modifier attack;
- `1`: modifier defense;
- `2`: critical probability;
- `3`: dodge probability;
- `4`: resist-damage rate;
- `5`: modifier battle gauge.

The handler starts the aggregate at zero. When a preceding local gate returns bit 0 clear, it first appends the current truncated increment to the history vector. It then copies and traverses the vector from begin to end in stored order, reading the signed increment at offset zero of each 40-byte entry. Every `add w` retains the low 32 bits, so overflow wraps modulo `2^32` before the sign-directed cap is applied. The handler updates its continuation gate, removes the matching previous efficacy-info entry and emits one aggregate field. Selector 4 applies its native resist-rate transformation before emission. The structural append condition is proved, but the event semantics of the local gate, reset/expiry window and cross-status scope remain partial.

The projected corpus contains 720 rules across 329 states and all six selectors are supported at field level. Selector 5 exposes a confirmed parser error in 88 rules/79 states: the legacy projector emits `ki`, while the native generator and consumer use the distinct battle-gauge field. Timing, target, operation, lifecycle and non-ATK/DEF calculation buckets remain independent or partial.
