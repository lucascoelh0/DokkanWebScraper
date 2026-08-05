# Database Team Analysis experiment v9 (DB10)

Status: experimental, non-production. Contract version: `0.9.0`.

DB10 audits selected native causality handler implementations rather than inferring semantics from handler names or localized descriptions. Each mapping is pinned to the Global 6.4.0 `libcocos2dcpp.so` SHA-256, symbol VMA, symbol size and code SHA-256. The `SkillCausality` payload layout is independently pinned to both constructors: the SQLite-row constructor reads `cau_val1`, `cau_val2` and `cau_val3` in that order, and the integer constructor stores its three payload arguments in the same indexed vector.

Three causality types are semantically promoted:

- `43`: current dodge-success flag; the handler ignores `cau_val1..3`;
- `51`: appearance-turn count is less than or equal to `cau_val1`, gated by initialized appearance state;
- `55`: appearance-turn count is strictly greater than `cau_val1`, with the same gate.

Type `3` receives a partial parameter audit only. It reads `cau_val1`, ignores `cau_val2/3` and evaluates `trunc(runtime_gauge_value / unnamed_virtual_denominator * 100) >= cau_val1`. The runtime metric, denominator and threshold unit are not named by first-party evidence, so DB10 does not label the value as Ki, percentage or fixed-point and does not promote it.

The contract is an evidence projection over DB8 and DB9. It preserves gap counts, affected states, raw value domains, examples and database/runtime provenance without silently rewriting the DB7 state contract. No efficacy type is promoted in this gate.
