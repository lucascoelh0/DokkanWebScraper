# H2 — Per-fact capture provenance

Status: complete; schema-evidence only, optional and non-production.

## Contract

Every H2 fact records the logical capture ID, H0 structural fingerprint, H1 schema fingerprint, normalized endpoint, HTTP method, capture timestamp, observation interval, HTTP status, JSON path, endpoint classification, confidence and an explicit `userDerivedAuthority: false` marker. Fact IDs hash those capture/schema and structural endpoint/status/path/type coordinates; names and localized text are not identity.

H2 accepts response-schema presence only from `product_catalog` and `mixed_product_and_user_state`. Product schema is `partial`; mixed schema is `unknown`. `auth`, `mutation`, `user_state` and `asset_delivery` do not enter the product-fact set. No H2 fact may be `supported`, and value-origin evidence is rejected by the validator.

## Result

- Provenance facts: 777.
- `supported`: 0.
- `partial`: 341.
- `unknown`: 436.
- User-derived authority facts: 0.
- Exact and generic secret scan: valid with zero matches.

## Verification

- TypeScript `--noEmit`: passing.
- Focused H2 tests: 2 passing, including negative promotion, user-authority and stale-lineage cases.
- Two H2 runs: provenance, validation and secret-scan outputs byte-identical.
- Peak measured H2 working set: 601,088,000 bytes, below 1 GiB.

## Decision

**GO** for committing the reusable disabled provenance contract and advancing to allowlisted H3–H6 product projections.

**NO-GO** for treating official capture origin alone as `supported`, using names/text as entity identity, importing user/auth/mutation state, product replacement, R2, Android, or production activation.
