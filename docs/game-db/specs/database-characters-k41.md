# Database Characters K41 - public taxonomy projection shadow consumer

Status: public delivery and remote shadow lookup GO. Persisted consumption,
`Character[]`, apply/overlay, Android, authority, production and source removal
remain NO-GO. Contract version `1.0.0`.

## Boundary

K41 is an explicitly opt-in, unauthenticated and strictly read-only consumer of
the K40-published taxonomy projection. It does not reinterpret the published
K37 manifest's conservative candidate state: that manifest still declares
consumer, authority and production NO-GO. K41 proves only that the fixed public
release can be safely decoded into a memory-only, `cardId`-keyed shadow lookup.

The public API returns a report plus `lookup(cardId)`. Each successful lookup
returns a deep clone, so caller mutation cannot affect later lookups. Invalid or
absent IDs return `undefined`. It exposes no iteration-to-`Character[]`, writer,
apply, merge, overlay, cache persistence, publisher, credential or Android API.
Names, labels and presentation fields remain absent. A missing `categories` or
`links` dimension remains omitted and never becomes an empty list.

## Closed transport

The compiled runner accepts exactly:

```text
npm run audit:database-characters-taxonomy-projection-public-shadow -- \
  --opt-in-k41 \
  --remote-read-only \
  --checked-at <canonical-utc-with-milliseconds>
```

It performs exactly five unauthenticated HTTPS GETs against
`https://assets.dkbcompanion.com/`: the fixed no-store manifest first, followed
by its four ordered content-addressed objects. Redirect responses are not
followed. Requests force identity encoding and have a 30-second timeout.
Individual responses must remain below 1 MiB and total bytes below 5 MiB.
There is no Wrangler, S3 adapter, credential read or remote mutation path.

The mutable manifest itself is pinned to SHA-256
`9f803eb8eba00f2b7f49681b379fb3fe71eb08d551dc69cab03204542ec6e1e8`
and 7,159 bytes. K41 accepts only the fixed K37 contract, release ID
`4a6dcfa4b8818abbd070bad2a1318eec5df9a2b1b306286adfec5fadee8ddfe4`,
closed ordered four-object inventory, content-addressed namespace, immutable
cache policy and explicitly non-authoritative readiness state.

## Byte and semantic validation

Every immutable response must match its manifest hash and size. When present,
HTTP metadata must match `application/gzip` or `application/json` and
`public, max-age=31536000, immutable`. K41 then:

1. decompresses the payload with a strict output bound;
2. verifies the 4,228,101-byte raw SHA-256 pin;
3. parses payload, coverage, validation and K35 manifest;
4. rematerializes the complete pinned K35 artifact set through the existing
   supported-only validator;
5. compares the canonical raw JSON, deterministic level-9 gzip and all four
   exact artifact byte sequences;
6. builds a unique memory-only `cardId` lookup only after all checks pass.

This retains all K35 source lineage and supported-only constraints. K41 does
not rerun K32/K34 from local roots and therefore makes no new source-authority
claim; it consumes only the exact already-pinned K35 release.

## Verification receipt

Focused TypeScript validation passed. The focused K41 suite passed five tests.
Four portable tests always cover CLI closure, byte/hash/size corruption,
mutable-manifest drift before immutable reads, cloned lookup and preserved
omissions. One explicit integration test additionally uses the exact local
K36/K37 bytes through an in-memory transport to cover full artifact
reproduction and bounded non-authoritative reporting; it is marked pending
when those external roots are not supplied rather than silently weakening the
portable integrity coverage.
The final full `database-characters` suite passed 183 tests with eight Windows
symlink fixtures pending. Contract review's initial P2 about conditional test
coverage was fixed by the portable 4+1 split; re-review found no remaining
P0-P2.

The final authorized real read-only run at `2026-08-14T21:23:32.815Z` performed the
five fixed GETs and read 260,894 bytes. It reproduced the exact K35 bytes and
reported 5,759 records, 5,759 supported classes, 54,072 category assignments
on 5,729 cards with 30 category unknowns omitted, and 34,018 links on 5,620
cards with 139 link unknowns omitted. Public delivery and remote shadow lookup
are GO. `Character[]` reads, apply and remote mutations were all zero.

## Readiness

| Scope | Decision |
| --- | --- |
| public K35/K40 delivery | **GO** |
| K41 memory-only `cardId` shadow lookup | **GO** |
| persisted consumer or cache | **NO-GO** |
| `Character[]` or apply/overlay | **NO-GO** |
| Android | **NO-GO** |
| authority or production | **NO-GO** |
| FYI/DokkanInfo removal | **NO-GO** |
