# Database Characters K60 - conditional supported leader publisher

Status: implementation and operational prepublication dry-run GO for the exact
K58/K59 plan. No authenticated client was constructed and no R2 object was
created, replaced or deleted. Publication, authority, production and Android
remain NO-GO pending explicit authorization. Contract version `1.0.0`.

## Boundary

K60 is one executable with two mutually exclusive, explicit modes. `--dry-run`
forbids a publication confirmation and never constructs the S3 adapter or reads
credential environment variables. `--publish` requires a caller-supplied
64-hex `publicationId`; the runner compares it before persisting a local report
or constructing the authenticated client.

Every invocation first executes a fresh real K59 read-only preflight, then
reconstructs K58 and K56 through their public source-bound validators. The K59
observation must match all candidate, plan, receipt and marker hashes and sizes,
plus the full-artifact and lineage fingerprints. Observation time and remote
statuses do not contribute to the deterministic `publicationId`.

The persisted K60 report is explicitly an operational prepublication dry-run.
It records `clientConstruction: NOT_EXECUTED`, zero remote writes and RSS
`NOT_EXECUTED`; only the returned run result reports measured per-process peaks
after final enforcement. A productive execution would persist a separate,
content-addressed receipt only after final remote verification. That receipt is
also explicitly not RSS authority.

## Conditional publication protocol

The future publish path is implemented and covered with an instrumented
in-memory adapter, but was not executed against R2.

1. Read all four immutable objects and the mutable manifest.
2. Reuse an immutable only after exact bytes, SHA-256, size, `Content-Type` and
   `Cache-Control` agreement.
3. Create a missing immutable with `If-None-Match: *`; accept a 409/412 race
   only after an exact reread.
4. Revalidate K58/K56 from sources, then reread all four immutable objects.
5. Reread the mutable manifest immediately before mutation. Create it with
   `If-None-Match: *`, replace a different value only with a fresh strong,
   quoted, nonempty ETag through `If-Match`, or perform no write when exact.
6. Reread and verify the final manifest. It is always the last remote mutation.

Unconditional writes, deletes, copies and multipart uploads are forbidden.
The mutable manifest may be conditionally replaced by CAS; only immutable
object overwrite is forbidden. These semantics follow the Cloudflare R2
S3-compatible conditional request model:

- <https://developers.cloudflare.com/r2/objects/upload-objects/>
- <https://developers.cloudflare.com/r2/api/s3/extensions/>
- <https://developers.cloudflare.com/r2/api/s3/api/>

## Invocation

```text
npm run run:database-characters-leader-supported-publisher -- \
  --dry-run \
  --sidecar-root <exact-k0-k7-root> \
  --production-root <exact-k7-production-root> \
  --fyi-root <exact-k7-fyi-root> \
  --k43-root <exact-k43-artifact-root> \
  --k46-root <exact-k46-artifact-root> \
  --k48-root <exact-k48-artifact-root> \
  --k56-root <exact-k56-artifact-root> \
  --k58-root <exact-k58-artifact-root> \
  --k59-output-root <new-existing-empty-stable-local-root> \
  --output-root <different-new-existing-stable-local-root> \
  --native-runtime <exact-libcocos2dcpp.so> \
  --database <exact-first-party-global-sqlite> \
  --checked-at <canonical-UTC-timestamp>
```

The two output roots must be separate from each other and every source. Local
artifacts are create-only with no-follow, single-link and reread checks. The
threat model remains `caller_controlled_stable_during_operation`; protection
against same-user concurrent ancestor replacement is not claimed.

## Real dry-run result

The real dry-run checked at `2026-08-16T10:13:56.648Z` completed with exit 0.
The compiled runner emitted no application error; the npm wrapper wrote only
its two standard command notices to stderr.

- publication ID:
  `a23bda883f00c24ff9732ad3a57fbece890670b6a14f0377725d2b855e99e286`;
- all four immutable objects and the mutable manifest remained `missing`;
- every modeled action remained conditional `If-None-Match: *`;
- projected remote bytes remained 227,309;
- K59 observed 364 MB, conservatively bounded it at 365,000,000 bytes and
  projected 365,227,309 bytes after publication, below 10 GB;
- the 7,575-byte local K60 report has SHA-256
  `04bfece327902c2019941ddca348d34f1f460f2c0466a1c9c20902197a245274`;
- the nested 5,951-byte K59 report has SHA-256
  `d7a27827f510cbcca9fd2ec5388737884797583db6cf1d7f016cacb0d7ffc255`;
- no publication summary or publication receipt was produced;
- client construction was `NOT_EXECUTED`, credential reads were false and
  remote write count was zero.

Per-process peaks were 1,018,941,440 bytes for K59, 1,024,901,120 bytes for the
K58/K55 validation path and 1,022,193,664 bytes for the K60 parent. The maximum
individual-process peak was 1,024,901,120 bytes, below the exclusive 1 GiB
limit. Combined process-tree RSS remains unmeasured and NO-GO.

Focused K58-K60 validation passed 31/31. The compiled `database-characters`
suite passed 321 tests with 9 platform-dependent tests pending. Independent
review found no remaining P0-P2 after correcting four initial
report/provenance/ETag findings and one overclaim that conflated forbidden
unconditional writes with the permitted conditional manifest replacement.

## Readiness

| Scope | Decision |
| --- | --- |
| fresh real K59 read-only preflight | **GO** |
| K59/K58/K56 exact source binding | **GO** |
| deterministic conditional publication plan | **GO** |
| local operational dry-run | **GO** |
| per-process RSS below 1 GiB | **GO (run result only)** |
| combined process-tree RSS below 1 GiB | **NO-GO** |
| authenticated client construction | **NOT_EXECUTED** |
| publication receipt | **NOT_EXECUTED** |
| R2 object create/replace/delete | **NO-GO / NOT EXECUTED** |
| authority, production or Android | **NO-GO** |
| concurrent output ancestor replacement | **NO-GO** |
