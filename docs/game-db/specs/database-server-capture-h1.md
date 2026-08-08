# H1 — Deterministic schema-only capture sanitizer

Status: complete; offline-only, optional and non-production.

## Contract

H1 consumes the validated H0 lineage and reopens only the four manifest-selected captures through the same allowlist, path, link, file-identity, size and memory gates. It emits no value fixtures. Headers and cookies are omitted, query values are reduced to key names, unknown and sensitive JSON keys are collapsed, and request bodies for `auth`, `mutation` and `user_state` classifications are never emitted.

The output stays in ignored `data/database-server-captures/h1/`. It is schema evidence only and has no user-derived authority. A product value may enter a later fixture only through a separate exact endpoint/path allowlist and provenance contract.

## Sanitized result

- Four captures and 1,152 target entries produced 147 distinct schema observations.
- Request bodies: 1,132 absent; 20 present but omitted by classification.
- Response bodies: 227 represented as allowlisted schema only; 364 non-JSON or unavailable and omitted; 561 absent.
- Value fixture count: zero.
- Exact captured-secret matches in the H1 output: zero.
- Generic secret-pattern matches in the H1 output: zero.

The scanner obtains sensitive comparison values only in memory from validated local inputs. It reports counts and failing target names, never matching values or excerpts. Synthetic placeholders are recognized only in negative tests and are not treated as production credentials.

## Verification

- TypeScript `--noEmit`: passing.
- H0 + H1 focused tests: 10 passing.
- H0 reconstruction after the shared-reader extension: byte-identical.
- Two H1 runs: schema and scan outputs both byte-identical.
- Peak measured H1 working set: 799,477,760 bytes, below 1 GiB.

## Decision

**GO** for committing the disabled schema-only sanitizer and secret scanner and advancing to H2 provenance.

**NO-GO** for value fixtures, preservation of personal/progress fields, product authority, authenticated automation, request replay, production datasets/manifests, R2, or Android.
