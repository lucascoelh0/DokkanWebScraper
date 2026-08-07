# Database Characters K8 — optional sidecars and focused refresh

Status: optional, additive, disabled and non-production. Contract version
`1.0.0`.

## Question, boundary and gate

K8 asks whether K0–K7 can be finalized as independent, content-addressed
sidecars under one exact refresh profile without enabling any consumer. The
runner does not regenerate DB0–DB50 or K0–K7. It performs focused compatibility
verification and emits only a deterministic registry/refresh receipt after all
inputs pass. Production imports, replacement, R2 publication and Android
consumption remain false.

## Optional contract

The receipt inventories eight independently loadable sidecars. Six expose
explicit supported-only consumer scopes; all eight expose separate audit
scopes. K6 asset references and K7 parity are audit-only. Each entry pins its
schema/contract version, manifest, artifact, coverage, validation, compressed
and raw sizes, hashes and DB1 lineage. Complete absence—or absence of any one
optional sidecar—has the declared behavior `preserve_production`.

The projected K0–K7 payload is 10,166,877 bytes compressed and 278,449,142
bytes raw. This is an inventory only: no upload was attempted.

## Refresh guard

The profile pins the 95,428,608-byte SQLite and its SHA-256, the streamed DB1
artifact, the 95,662,296-byte ELF64 little-endian AArch64 runtime, all twelve
C1/C2/C3 artifact/manifest/coverage/validation files and every K0–K7 output
file. K6 is the pinned asset-reference evidence; it still proves no local asset
file or delivery.

Preflight runs before the output directory is created. After building and
validating two byte-identical receipts, all inputs are fingerprinted again;
only then are K8 files written. A changed snapshot, binary, semantic baseline,
sidecar, contract, lineage or green validation therefore fails before a new
receipt is written. A new app/DB snapshot requires a new reviewed profile.

K8 receipt: 3,158 bytes gzip / 10,950 bytes raw, SHA-256
`f91c894a7ebbd6a48380f73c68282e2f4f12c337367ff3b1de5cf07f01c19798`.
Two generations were byte-identical; peak observed RSS was 103,231,488 bytes.
