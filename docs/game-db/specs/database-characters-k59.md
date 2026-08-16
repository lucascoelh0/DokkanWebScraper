# Database Characters K59 - supported leader remote read-only preflight

Status: source-bound public HTTP and bucket read-only preflight GO for the exact
K58 plan. Publication, R2 mutation, authority, production and Android remain
NO-GO. Contract version `1.0.0`.

## Boundary

K59 is an operational observation, not publication authority. Its productive
runner accepts only explicit roots, the fixed public base
`https://assets.dkbcompanion.com/`, the fixed bucket `dokkanpanion-data`, one
canonical UTC observation time and exact read-only opt-ins.

The runner invokes the public K58 validator before transport and again after
all remote reads. That validator reconstructs the K58 bundle from a real,
source-bound K56 validation and requires candidate, plan, receipt and marker
bytes to match exactly. K59 compares the full K58 bundle fingerprint across
both validations before persisting its report.

Production has no injectable validator, transport, command, URL, bucket or
report. Test fakes exist only in a transient instrumented copy of the TS module;
the production API exports only the fixed runner.

## Read-only transport

Exactly five public, unauthenticated HTTPS GETs run sequentially:

1. payload object key;
2. coverage object key;
3. validation object key;
4. K56 source-manifest object key;
5. fixed mutable manifest key.

Only allowlisted K58 keys can be read. Redirects are blocked, compression is
refused with `Accept-Encoding: identity`, status is limited to 200/404, and
per-response, aggregate and timeout bounds apply. A bounded 404 body counts
toward bytes read but the key remains `missing`.

A 200 immutable object is reusable only when bytes, SHA-256, size,
`Content-Type` and `Cache-Control` all match. A missing immutable models future
create-only `If-None-Match: *`; conflict or read failure blocks the preflight.

The mutable manifest is either already current, missing with future
`If-None-Match: *`, or different with a freshly observed strong, quoted,
nonempty ETag for future `If-Match`. `*`, weak ETags, unconditional writes and
delete are rejected. This observation is a snapshot: any future authorized
publisher must reread and revalidate immediately before mutation.

Bucket usage is read only through the fixed local command:

```text
wrangler r2 bucket info dokkanpanion-data --json
```

It runs through the local Wrangler entrypoint with `shell: false`, bounded
stdout and timeout. Reported human-readable usage is rounded upward before
projecting all missing immutable bytes plus a conservative mutable-manifest
reservation. The projected upper bound must be strictly below 10 GB.

## Invocation

```text
npm run preflight:database-characters-leader-supported-remote -- \
  --sidecar-root <exact-k0-k7-root> \
  --production-root <exact-k7-production-root> \
  --fyi-root <exact-k7-fyi-root> \
  --k43-root <exact-k43-artifact-root> \
  --k46-root <exact-k46-artifact-root> \
  --k48-root <exact-k48-artifact-root> \
  --k56-root <exact-k56-artifact-root> \
  --k58-root <exact-k58-artifact-root> \
  --output-root <new-existing-stable-local-root> \
  --native-runtime <exact-libcocos2dcpp.so> \
  --database <exact-first-party-global-sqlite> \
  --checked-at <canonical-UTC-timestamp>
```

The only write is one bounded local create-only report. Its root must be
separate from every source; no-follow/single-link/reopen checks apply and no
automatic cleanup or overwrite is attempted. Protection against same-user
concurrent ancestor replacement is not claimed.

## Real result

The real preflight checked at `2026-08-16T09:31:14.015Z` completed with exit 0
and empty stderr. All five public keys returned bounded 404 observations:

- immutable summary: 0 matching, 4 missing, 0 conflict, 0 failed;
- mutable manifest: missing;
- total HTTP response bytes read: 135,750;
- every future object action remains conditional create-if-absent;
- no authenticated request or remote mutation was executed.

Wrangler reported `364 MB`. The conservative bucket upper bound is 365,000,000
bytes. The four missing immutables total 215,748 bytes and the mutable candidate
reservation is 11,561 bytes, so projected additional bytes are 227,309 and the
projected bucket upper bound is 365,227,309 bytes, strictly below 10 GB.

The source-bound K58 plan remained SHA-256
`49d6d520753f8d4591740ccccc86664fec7e675ac2f8054be1b715c762bcd632`.
The 5,951-byte local report has SHA-256
`b9455a59fd0983bfeadacadf8b92bc65ecc2f1ab6f0e9f266e23dd0f1c22cf9b`.

Per-process peaks were 1,010,409,472 bytes for the first K55 validation,
1,025,642,496 bytes for the final validation, and 1,000,247,296 bytes for the
K59 parent. Maximum individual-process RSS was 1,025,642,496 bytes. Combined
process-tree RSS remains unmeasured and NO-GO.

Focused K58+K59 validation passed 18/18. The compiled `database-characters`
suite passed 308 tests with 9 platform-dependent tests pending. Independent
review found no remaining P0–P2; an initial productive global-hook injection
surface was removed before any remote execution.

## Readiness

| Scope | Decision |
| --- | --- |
| exact five ordered public GETs | **GO** |
| read-only bucket usage query | **GO** |
| source-bound K58 stability after reads | **GO** |
| no immutable conflict/read failure | **GO** |
| projected bucket upper bound below 10 GB | **GO** |
| per-process RSS below 1 GiB | **GO** |
| combined process-tree RSS below 1 GiB | **NO-GO** |
| future publisher freshness/CAS | **MUST RERUN** |
| publication or R2 mutation | **NO-GO** |
| authority, production or Android | **NO-GO** |
| concurrent output ancestor replacement | **NO-GO** |
