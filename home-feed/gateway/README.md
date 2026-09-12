# Home-feed R2 gateway

This Worker exposes the minimum R2 surface required by the home-feed publisher.
It binds only the `dokkanpanion-data` bucket and requires a `GATEWAY_TOKEN`
Worker secret of at least 32 UTF-8 bytes.

- `GET /object?key=...` returns a bounded allowed object and its `ETag`.
- `PUT /object?key=...` requires exactly one of `If-None-Match: *` or a single
  strong `If-Match` ETag. Hash-named objects accept create-only writes; manifest
  and run objects support create followed by ETag compare-and-swap.
- `GET /inventory?cursor=...` returns one page as
  `{ "bytes": number, "truncated": boolean, "cursor": string | null }`.
  It never returns object names.

The gateway chooses content type and cache policy from the validated key. It has
no delete route and does not log request headers, query strings, or exceptions.
It intentionally has no extra rate-limit binding: malformed and unauthorized
requests are rejected before any R2 operation, while volumetric controls remain
an account/route policy concern.
