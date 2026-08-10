# Database/server capture H10 — domain audit

H10 separates events/schedules, gashas, mission boards/rewards, profile/account, assets/descriptors and miscellaneous flows. It performs no request and cannot replay a mutation.

Product facts are limited to allowlisted numeric IDs, schedule instants, rates, quantities and version/asset numbers observed in successful official GET JSON on explicit definition-only subendpoints. Mixed roots such as `/events`, `/gashas` and `/missions` never emit scalar facts. The retained facts remain partial authenticated observations, never public refresh authority. Numeric parent/child relations require a route parent and an allowlisted child ID. Names and text are not identities.

Profile, account, progress, gifts, shop and other personal-state surfaces retain schema paths and structural flow only. No personal or account scalar value is emitted. Mission accept and other mutations are counted structurally, without request or response values.

The crash capture contains successful mission-accept mutations and ends after a successful official API observation. Temporal order does not prove causation. The current external hypothesis remains instrumentation/interception combined with x86_64/ARM64 libhoudini GLThread incompatibility; the HAR neither proves nor disproves it.
