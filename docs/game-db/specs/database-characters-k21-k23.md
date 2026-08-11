# Database Characters K21-K23

Status: implemented as a local-only, default-off delivery checkpoint.

## Purpose

K21-K23 turn a K19 candidate that independently passes K20 into an immutable
local release and a deterministic delivery plan. They do not promote
`data/fyi-characters/latest`, call Wrangler, inspect R2, publish objects, alter
Android, or change production authority.

## K21: content-addressed local release

- Re-runs K20 and requires `candidateGenerationValidation = GO` with zero
  failures.
- Validates the candidate gzip/manifest and recursively enumerates every
  `portraitURL` in the complete character graph.
- Accepts only `images/v2/portrait_<numeric-id>.png` portrait keys.
- Hashes every referenced portrait and rejects missing, duplicated, extra, or
  malformed entries.
- Builds the release ID from the candidate payload SHA-256 and the ordered
  portrait inventory SHA-256.
- Reserves the final directory without replacement, copies the exact payload
  and portraits, and writes the ready marker last.
- An existing release is accepted only after every report, manifest, payload,
  marker, and portrait is revalidated byte-for-byte.

The output is ignored under
`data/fyi-characters/releases-k21/<release-id>/`.

## K22: deterministic local object plan

The plan contains the candidate payload, remote manifest representation, and
all referenced portraits. It computes a worst-case new-byte total and proves
the local namespace guard:

- a 50,000,000-byte character-release namespace limit;
- the user's 10,000,000,000-byte R2 bucket ceiling is recorded as a hard
  future constraint, but remains unknown until remote bucket usage is read.

It performs no network access and therefore records both remote bucket size and
whole-bucket compliance as unknown. Stable portrait keys remain `images/v2/...`
for Android compatibility.
Because these keys historically use immutable caching, every portrait requires
remote hash proof before any upload can be authorized.

## K23: stopped receipt

K23 binds the K21 report and K22 plan by SHA-256, verifies local budget and
safety declarations, and emits a deterministic receipt. Its only GO is the
local release bundle. Remote inventory, publication, production, Android, and
R2 remain NO-GO.

## Operational command

```powershell
npm run prepare:fyi-character-release-k21-k23
```

The command has one hardcoded explicit opt-in and no remote mode. A later gate
may add a read-only R2 preflight. A real upload and mutable manifest promotion
remain separate actions requiring explicit user authorization.

## Next boundary

The next safe gate is a remote read-only inventory/dry-run that proves:

1. exact hashes for stable portrait keys;
2. whether the content-addressed payload already exists;
3. current conservative bucket usage and projected upper bound;
4. no deletion or mutable manifest write is required during preflight.

Until those facts are verified, publication remains NO-GO.
