# H0 — Official capture safety and structural inventory

Status: complete; offline-only, optional and non-production.

## Scope and authority

H0 reads the four explicitly authorized local HAR files without making a network request. The files remain outside every repository and worktree. The generated inventory stays under ignored `data/database-server-captures/h0/`; no header, cookie, query value, request body, response value, token, account state or user progress is persisted.

Contract `0.1.1` adds a source-identity fingerprint derived only from validated filesystem metadata (`dev`, `ino`, size and timestamps). It binds later value projections to the same local file identity without hashing secret-bearing bytes; the structural and schema fingerprints remain value-free.

The output is structural evidence only. It grants no product authority, does not promote `partial` or `unknown` facts, changes no production dataset or manifest, and is not consumed by R2 or Android.

## Safety contract

- The checked-in manifest selects a logical allowlisted input root and direct relative `.har` filenames only.
- Absolute paths, traversal, nested paths, symlinks, junction roots, non-regular files and files escaping the resolved root are rejected.
- Files are opened by descriptor and revalidated with link, resolved-path and file-identity checks before reading.
- Later value gates must match the H0 source-identity fingerprint on their own validated descriptor read.
- Capture size is capped at 192 MiB; the runner requires a Node heap below 1 GiB and pins it to 768 MiB.
- Official API paths preserve only allowlisted route segments; other segments become `:opaque` and numeric identifiers become `:id`.
- CDN paths preserve only an allowlisted public file extension and never an object name.
- JSON schema fingerprints preserve only explicitly allowlisted public field names. Sensitive and unknown keys are collapsed before hashing.
- Unknown official API GET routes fail closed as `user_state`; non-GET/HEAD traffic is `mutation`.

## Sanitized inventory

| Capture | Entries | API | CDN | Product | Mixed | User state | Mutation | Auth |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| existing-assets | 12 | 8 | 4 | 1 | 0 | 3 | 2 | 2 |
| httptoolkit-2005 | 468 | 95 | 373 | 28 | 11 | 39 | 13 | 4 |
| httptoolkit-2006 | 468 | 95 | 373 | 28 | 11 | 39 | 13 | 4 |
| httptoolkit-2027 | 204 | 41 | 163 | 12 | 7 | 13 | 5 | 4 |

The traffic-structural fingerprint groups `httptoolkit-2005` and `httptoolkit-2006` as duplicates while their separate schema fingerprints differ. This records repeated routing/status/query-key structure without claiming body equivalence. No other duplicate group was observed.

## Gate verification

- Focused H0 tests: 7 passing, including synthetic-secret, dynamic-key, traversal, junction, fail-closed classification and unknown-CDN-suffix cases.
- TypeScript `--noEmit`: passing.
- Two real runs: byte-identical output.
- Peak measured working set: 747,827,200 bytes, below 1 GiB.
- Contract review: approved after closing memory, dynamic-key, CDN-path and TOCTOU findings.

## Decision

**GO** for committing the disabled offline H0 infrastructure and advancing to a schema-only H1 sanitizer.

**NO-GO** for committing local HARs or generated capture output, preserving request/response values, product fixtures, server authority, authenticated automation, network replay, R2, Android, or any production mutation.
