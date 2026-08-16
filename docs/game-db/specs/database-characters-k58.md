# Database Characters K58 - supported leader publisher dry-run

Status: deterministic offline publication plan GO for the exact K56
supported-only projection. Remote preflight, publication, R2 mutation,
authority, production and Android remain NO-GO. Contract version `1.0.0`.

## Boundary

K58 is a local dry-run, not a publisher. The explicit runner validates the
real K56 artifact source-bound before and after plan construction, requires
the exact pinned K56 identity, and compares the complete artifact and lineage
fingerprints across both validations. The direct builder leaves dry-run and
source-bound readiness `NOT_EXECUTED`; only the runner may promote the local
plan to GO.

No remote client is constructed. The implementation does not read credential
environment variables, make HTTP requests, invoke Wrangler, inspect R2 or
mutate a remote object. Bucket use and headroom remain `UNKNOWN` until a
separate read-only preflight.

## Object plan

The namespace is `database-characters/leader-supported/v1`. Exactly four K56
files are modeled as immutable objects, in this order:

1. the content-addressed gzip payload;
2. coverage JSON;
3. validation JSON;
4. the K56 source manifest JSON.

The 12,847,768-byte canonical raw JSON is not a persisted K56 member and is
therefore not an object action. Its SHA-256 and size remain lineage evidence
only.

Immutable keys use
`database-characters/leader-supported/v1/objects/sha256/<sha256>/<file>`.
They model explicit `Content-Type`, immutable cache control, create-if-absent
with `If-None-Match: *`, verified reuse only, and fail-closed divergence.
Overwrite and delete are forbidden.

The mutable remote manifest candidate targets the fixed key
`database-characters/leader-supported/v1/manifest.json`, has `no-store`, and
is always last. A future publisher must first perform a fresh remote preflight:
create uses `If-None-Match: *`; replacement requires the freshly observed ETag
with `If-Match`. Unconditional replacement is forbidden. Every remote action
in K58 itself remains `NOT_EXECUTED`.

## Local safety

Candidate manifest, plan, receipt and marker are canonical, timestamp-free and
contain no RSS measurements. The writer requires an existing, separated,
caller-controlled stable output root; uses create-only/no-follow/single-link
checks; writes the marker last; and never overwrites, deletes or automatically
cleans up. A failure may leave local partial files without a marker. Protection
against same-user concurrent ancestor replacement is not claimed and remains
NO-GO.

The projected remote inventory is five objects: four immutables plus the
mutable manifest candidate. The immutable bytes total 215,748 and the candidate
is 11,561 bytes, for a conservative projection of 227,309 bytes. This is below
the local 64 MiB namespace budget. It is not a bucket-capacity claim.

## Invocation

```text
npm run dry-run:database-characters-leader-supported-publisher -- \
  --sidecar-root <exact-k0-k7-root> \
  --production-root <exact-k7-production-root> \
  --fyi-root <exact-k7-fyi-root> \
  --k43-root <exact-k43-artifact-root> \
  --k46-root <exact-k46-artifact-root> \
  --k48-root <exact-k48-artifact-root> \
  --k56-root <exact-k56-artifact-root> \
  --output-root <new-existing-stable-local-root> \
  --native-runtime <exact-libcocos2dcpp.so> \
  --database <exact-first-party-global-sqlite>
```

The FYI root must match the K7 binding. A real diagnostic attempt using a newer
FYI `latest` root was rejected before output with `FYI Character[] manifest
changed from K7 binding evidence`, confirming that the source boundary fails
closed.

## Real result

Two complete runs against the same real K56 root returned local dry-run GO.
The second direct-Node run had empty stderr. All four local artifacts were
byte-identical:

- candidate manifest: 11,561 bytes, SHA-256
  `370dc7026c4523d509a403a2fbfa91009d1bb9452f7ab277f9c6aaebb8a1441e`;
- plan: 13,134 bytes, SHA-256
  `49d6d520753f8d4591740ccccc86664fec7e675ac2f8054be1b715c762bcd632`;
- receipt: 499 bytes, SHA-256
  `092298b7ed7396e569f6d764726528c38c43f8cbd58f0f3f10165b7c735fde5c`;
- marker: 538 bytes, SHA-256
  `871be97f5435bad8a123a30b8e51ede4e4cf65feaf8b517dbc57311ee0147bef`.

The full K56 artifact fingerprint remained
`807a98ae37cd17a68a7f3f3544c1f14b4f4bfab9f75c9b627cca23cbab41e3b3`
and the lineage fingerprint remained
`132c1e858ed5fdb6bdc97f3c5e0313c865c7bf0ee7367e1ad1453b89e280fa5f`.

Maximum individual-process RSS was 1,025,556,480 and 1,025,581,056 bytes.
Parent K58 peaks were 989,007,872 and 993,546,240 bytes. Accounting is only
`per_process_not_process_tree`; combined process-tree RSS remains unmeasured
and NO-GO.

Focused K58 validation passed 9/9. The compiled `database-characters` suite
passed 299 tests with 9 platform-dependent tests pending. The repository-wide
loader did not start its tests because the existing local `sharp` native binary
was absent; no dependency or lockfile was modified to mask that environment
problem. Independent contract review found no P0–P2.

## Readiness

| Scope | Decision |
| --- | --- |
| deterministic local publication plan | **GO** |
| exact K56 source-bound stability | **GO** |
| local create-only bundle | **GO** |
| per-process RSS below 1 GiB | **GO** |
| combined process-tree RSS below 1 GiB | **NO-GO** |
| remote inventory and bucket capacity | **NOT_EXECUTED / UNKNOWN** |
| HTTP/Wrangler read-only preflight | **NOT_EXECUTED** |
| publication or R2 mutation | **NO-GO** |
| authority, production or Android | **NO-GO** |
| concurrent output ancestor replacement | **NO-GO** |
