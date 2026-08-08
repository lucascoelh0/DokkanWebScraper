# H6 — Captured asset-reference and delivery evidence

Status: complete; local optional sidecar, disabled and non-production.

## Model and boundary

H6 retains only paths that pass exact official-host, prefix, extension, length and traversal checks. Absolute product URLs are reduced to their sanitized pathname. All query names and values, URL credentials, ports, fragments, CDN response bodies and asset bytes are omitted. No request is issued and no captured request is replayed.

Product JSON references and captured CDN requests remain separate observations. A `2xx` response means only that a response was observed in that capture; a `304` means only that revalidation was observed. Their only join key is the exact sanitized asset path. Neither status proves present availability, immutable content, historical completeness or permanent delivery.

The captured client-database descriptor preserves its numeric version, bounded lowercase algorithm label, bounded opaque upstream hash and sanitized `.db` pathname. The opaque hash is not promoted to a known cryptographic algorithm or a locally verified content digest.

## Result

| Evidence | Count |
|---|---:|
| product JSON asset references | 5,748 |
| client-database URL references | 2 |
| captured CDN requests | 913 |
| database descriptors | 2 |

The 913 CDN observations contain 366 observed `2xx` responses and 547 observed `304` revalidations. Exact path joins found 100 referenced paths with captured `2xx` evidence and 59 referenced paths with captured `304` evidence; these sets are reported independently and are not completeness metrics. Across all observations there are 6,643 `.png`, 16 `.jpg` and 4 `.db` paths. All evidence is `partial`, with zero user-derived authority, and the secret scan passed.

## Verification

- TypeScript `--noEmit`: passing.
- Focused H6 synthetic test: passing; query values, names, invalid traversal and response bytes are excluded, while `2xx` and `304` stay distinct.
- Two real outputs: byte-identical.
- Compiled runner heap cap: 576 MiB.
- Peak measured compiled-runner working set: 994,291,712 bytes, below 1 GiB.

## Decision

**GO** for committing the disabled H6 asset evidence, exact-path parity analysis and sanitized local fixtures.

**NO-GO** for downloads, asset mirroring, asserting current availability or content completeness, production manifests, immutable-cache publication, R2, or Android.
