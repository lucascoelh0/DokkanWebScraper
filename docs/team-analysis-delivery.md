# Team Analysis delivery

Team Analysis is optional enrichment distributed independently from the
character dataset. Combat Rules are not part of this flow.

## Commands

Generate the bundle from the current local character payload and catalog:

```powershell
npm run run:fyi-team-analysis
```

Validate the gzip, JSON, manifest integrity, parser/rules contract, unique
state identifiers, and exact compatibility with the local character bundle:

```powershell
npm run validate:team-analysis
```

Inspect the plan against Wrangler's local R2 storage without writing:

```powershell
npm run publish:team-analysis-r2 -- --dry-run --local --contract-lane v2
```

Inspect the production channel without writing:

```powershell
npm run publish:team-analysis-r2 -- --dry-run --remote --channel production --contract-lane v1 --v1-projection-report PATH_TO_ANDROID_V1_PROJECTION_REPORT --bucket dokkanpanion-data
```

Inspect staging without writing:

```powershell
npm run publish:team-analysis-r2 -- --dry-run --remote --channel staging --contract-lane v1 --v1-projection-report PATH_TO_ANDROID_V1_PROJECTION_REPORT --bucket dokkanpanion-data
```

Publishing staging still mutates R2 and requires separate authorization, but
it cannot update the production manifest or payload namespace:

```powershell
npm run publish:team-analysis-r2 -- --remote --channel staging --contract-lane v1 --v1-projection-report PATH_TO_ANDROID_V1_PROJECTION_REPORT --bucket dokkanpanion-data
```

The following production command is destructive and requires both separate
authorization and the fail-closed promotion flag:

```powershell
npm run publish:team-analysis-r2 -- --remote --channel production --contract-lane v1 --v1-projection-report PATH_TO_ANDROID_V1_PROJECTION_REPORT --promote-production --bucket dokkanpanion-data
```

The publisher always passes either `--remote` or `--local` to Wrangler object
operations. `--skip-remote-manifest-check` and `--skip-upload-verification` are
explicit recovery flags and are not defaults. Real remote writes also fail
closed when Wrangler cannot report bucket size; bypassing that guard requires
the separate explicit `--allow-unknown-bucket-size` recovery flag.
The default channel remains production for read-only compatibility, but the
contract lane has no default and must be selected explicitly. A real remote
production write fails unless `--promote-production` is present. V1 also
requires the exact projector report and matching paired manifests. Publisher
state is lane-scoped; only the historical production-v1 state keeps its legacy
default path.

Use the lockfile-pinned Wrangler 4.125.0 or newer. Wrangler 4.118.0 was observed
returning a false successful result for a remote Team Analysis payload upload;
the mandatory post-upload read prevented manifest promotion, but the older CLI
must not be used for publication.

## Publication and retention

The immutable gzip is made ready and optionally downloaded for size/SHA-256
verification before the mutable manifest is promoted. The manifest is always
the last public write and is downloaded again to verify its exact content,
size, and SHA-256. Local state is updated only after that verification, and
old-release cleanup runs afterward. A cleanup failure is recorded for a later
retry and does not invalidate the newly active manifest.

The namespace retains the active release and the immediately previous verified
release. Older releases tracked by the local state are deterministic cleanup
candidates. The state lives under the ignored `data/` tree. It is an aid, not
the source of truth: the publisher reads the remote manifest and verifies every
tracked payload it plans to retain or delete. Wrangler's object command does
not provide a namespace listing, so untracked objects cannot be included in the
cleanup plan; the dry-run reports this limitation.

Rollback is operational and non-destructive: select the previous immutable
payload from `retainedReleases`, reconstruct and validate the corresponding
manifest metadata, then promote only `team-analysis-manifest.json`. Do not
delete the currently active payload during rollback.

## Keys, caching, and budget

Payload keys have this form:

```text
production v1: team-analysis/releases/{version-slug}/{payload-sha256}/team-analysis.json.gz
production v2: v2/team-analysis/releases/{version-slug}/{payload-sha256}/team-analysis.json.gz
staging v1: staging/v1/team-analysis/releases/{version-slug}/{payload-sha256}/team-analysis.json.gz
staging v2: staging/v2/team-analysis/releases/{version-slug}/{payload-sha256}/team-analysis.json.gz
```

The payload uses `public, max-age=31536000, immutable`; the manifest uses
`no-store`. The namespace guard defaults to 50,000,000 bytes and the global
guard to 10,000,000,000 bytes. The namespace budget is checked at the peak
before post-promotion cleanup, so it includes the new payload, manifest,
retained releases, and verified cleanup candidates still present. For remote
runs, Wrangler exposes only a human-readable bucket size; the publisher rounds
that upward conservatively for the global guard and explicitly reports that it
is not an exact bucket byte inventory.

Expected public endpoints:

- `https://assets.dkbcompanion.com/team-analysis-manifest.json`
- `https://assets.dkbcompanion.com/team-analysis/releases/{version-slug}/{payload-sha256}/team-analysis.json.gz`

Expected staging endpoints:

- `https://assets.dkbcompanion.com/staging/v1/team-analysis-manifest.json`
- `https://assets.dkbcompanion.com/staging/v1/team-analysis/releases/{version-slug}/{payload-sha256}/team-analysis.json.gz`
- `https://assets.dkbcompanion.com/staging/v2/team-analysis-manifest.json`
- `https://assets.dkbcompanion.com/staging/v2/team-analysis/releases/{version-slug}/{payload-sha256}/team-analysis.json.gz`
