# Database Characters K43 - supported-only state product projection

Status: offline generation and source-bound validation GO. Consumer,
`Character[]`, apply/overlay, authority, production, publisher, network, R2,
Android and source removal remain NO-GO. Contract version `1.0.0`.

## Boundary

K43 materializes exactly the structural state/form scope approved by K42. It
includes no presentation fields, never returns or modifies `Character[]`, and
does not select an effective product authority. K7 productive agreement and
unjoinable counts are lineage/coverage only and cannot create or filter a
record.

The included records are limited to K0-supported, K1-known states; supported
known release transitions; supported awakenings with known kind and card
identity policy; and supported form bindings with known kind. Every `partial`
or `unknown` record remains excluded with bounded structural-ID samples.

## Invocation and artifact boundary

The runner has no defaults and requires all five exact arguments:

```text
npm run run:database-characters-state-product-projection -- \
  --opt-in-k43 \
  --sidecar-root <exact-k0-k7-root> \
  --production-root <exact-k7-production-root> \
  --fyi-root <exact-k7-fyi-root> \
  --output-root <existing-empty-local-root>
```

The output root must be a stable regular non-link directory and must neither
alias, contain nor descend from a source root. Members are created with
exclusive create and no-follow semantics, checked for single-link identity,
and cleaned up on a caught failure only when ownership is proven. The write
order is content-addressed gzip payload, fixed coverage, fixed validation, then
the fixed manifest last. No overwrite path exists.

K43 runs K42, fingerprints the sources used to build the projection, reloads
them after the build, materializes twice, and reconstructs the written bytes
from freshly pinned sources. The validator rereads the complete artifact set,
then performs a final source identity and fingerprint check immediately before
returning GO. It requires canonical JSON, deterministic gzip, exact hashes and
sizes. The immutable validation member truthfully records source-bound
validation as `NOT_EXECUTED`; only the post-operation runner receipt can report
that gate GO.
K42's reload comparison uses a compact snapshot of the same byte identities
and complete structural fingerprint so that two full source graphs are not
retained simultaneously.

## Real result

| Scope | Included | Excluded |
| --- | ---: | ---: |
| states | 10,651 | 3 unknown |
| release transitions | 4,892 | 3 unknown |
| awakening transitions | 6,905 | 2 partial |
| form transitions | 374 | 184 partial |

The source fingerprint remains
`6cd56dcaa7bc988ef0d80735c3bcb0ec3345746a84ece507bd19ffb80894cfeb`.
Safety validation reports zero duplicate IDs, unstable ordering, missing state
references, unsupported records, presentation fields, `Character[]` records
and network requests.

| Member | Bytes | SHA-256 |
| --- | ---: | --- |
| canonical JSON | 5,397,155 | `cb059f931ecc0f40e53e3b25ba2fcd10ac347c71c065c63dbca2224ab1f813c8` |
| content-addressed gzip | 332,720 | `a136f631ed0fa1880f6a82af72ab2c429b547165945c09a13514c67f07925179` |
| coverage | 1,803 | `b67f7aa9c9a7cacad8f053cea9aa570ef0aa1ca73b5ffb5ecb8f0d50603c17eb` |
| validation | 912 | `aa26d06c4e28cd795187b5adda0760a9bcc9ab77a7bc3ca4173b2a85e9daf84d` |
| manifest | 1,931 | `8416d7005d2a087897c121da9fd632d2b9be47c0fc6414049429903295ba87a8` |

Metadata totals 4,646 bytes. The exclusive budgets are 16 MiB raw, 2 MiB
gzip, 64 KiB metadata and 1 GiB RSS. Two independent runs produced all four
persisted members byte-identically; their peak RSS values were 1,000,423,424
and 1,005,903,872 bytes.

## Readiness

| Scope | Decision |
| --- | --- |
| offline supported-only projection | **GO** |
| source-bound artifact validation | **GO** |
| consumer or `Character[]` | **NO-GO** |
| apply/overlay, authority or production | **NO-GO** |
| publisher, network or R2 | **NO-GO** |
| Android | **NO-GO** |
| FYI/DokkanInfo removal | **NO-GO** |
