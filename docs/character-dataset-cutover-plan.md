# Character Dataset Production Cutover Plan

## Objective

Make `dokkan.fyi` the production source for the main Dokkanpanion character
dataset, while keeping the current DokkanInfo pipeline available as a fallback
until the new dataset passes the complete validation gate.

The Android app is temporarily feature-frozen for this work. Existing app
changes remain in place, but new screens and non-blocking UI work should wait
until the character contract is stable.

## Current state

- The paginated `dokkan.fyi` character catalog is now implemented and has been
  verified against the live source: 15 pages, 1,432 candidates, 1,416
  awakening lines and no failed pages in the latest run.
- The `dokkan.fyi` character mapper now has persistent page/result caching,
  bounded concurrency and per-card failure reporting.
- The first complete staging run produced 1,432 mapped cards with no failed,
  missing or duplicate IDs. The gzip bundle is still isolated from production.
- The production `index.ts` still generates the legacy DokkanInfo character
  dataset and its `characters.json.gz` bundle.
- The auxiliary datasets are sufficiently advanced for the first app release:
  support memories, skill orbs, summons, stages, missions, categories,
  Dokkan Frontier, wallpapers, acquisition data, items and awakening data.
- Auxiliary enrichment gaps are not blockers for the character cutover. They
  can continue independently after the core dataset is stable.

## Target invariants

The production character dataset must:

- discover all released playable cards from the `dokkan.fyi` catalog;
- keep the latest relevant awakening state for each card line:
  - initial state when there is no EZA/SEZA;
  - EZA state when an EZA exists;
  - SEZA state when a SEZA exists;
- remove duplicate Z-Awaken-only states from the same card line;
- exclude selling-only and other non-playable catalog entries;
- preserve real alternate gameplay states:
  - normal transformations;
  - standby and post-standby transformations;
  - finish skills and finish-triggered transformations;
  - reversible exchanges;
  - active skills, domains, unit attacks and EX attacks;
- keep stable real card IDs and explicit source/state metadata;
- produce deterministic portraits, manifests and validation reports;
- record unavailable or malformed cards without silently publishing partial
  data as if it were complete.

## Execution phases

### Phase 0: freeze app feature work

Status: **complete**

- Keep existing app changes and build fixes.
- Do not add new app features until the character cutover gate is green.
- Continue only contract-related app changes when a scraper decision requires
  them.

Exit criterion met: app feature work is frozen until the character cutover
gate is green.

### Phase 1: discover the complete character catalog

Status: **complete**

- Inspect the paginated `dokkan.fyi` character index and its structured payload.
- Collect all candidate card IDs, not only the curated mechanic sample.
- Preserve enough catalog metadata to select the correct latest awakening state
  without fetching every duplicate page unnecessarily.
- Add bounded concurrency, retries, timeout handling and resumable caching.
- Emit a catalog report with page count, candidate count, duplicate groups and
  failed pages.

Exit criterion met: the latest run discovered the full released catalog in 15
pages with no failed pages and writes a cached catalog artifact marked
`isComplete: true`.

### Phase 2: harden the character mapper

Status: **complete**

- Apply the latest initial/EZA/SEZA selection per awakening line.
- Preserve transformation-path references and fetch deferred state payloads.
- Validate standby target resolution and attach finish skills to the correct
  standby state.
- Validate reversible exchange, tag plus transformation, domain, active skill,
  unit attack and EX attack mapping.
- Keep structured fields as the source of truth and derive legacy display fields
  only where the Android app still needs them.
- Add tests for empty, partial and unusual payloads instead of relying only on
  happy-path cards.

Exit criterion met: the curated mechanics and the complete catalog map without
losing a mechanic or creating duplicate output IDs. The latest coverage report
includes 14 standby cards, 14 finish-skill cards, 15 reversible exchanges and
191 transformation states.

### Phase 3: build the production character runner

Status: **in progress**

- Add a dedicated full-run entrypoint instead of overloading the 20-card
  experiment runner.
- Write the canonical character JSON, gzip bundle and manifest.
- Include schema version, dataset version, generated time, counts, hashes and
  scrape statistics in the artifacts.
- Generate portraits for base states and all preserved alternate/awakening
  references.
- Make the run fail closed when required coverage thresholds are not met.
- Keep the legacy DokkanInfo output untouched as a rollback source.

Current result: the runner produces a publishable staging bundle and a
machine-readable report. Portrait generation and final publication wiring are
still pending.

### Phase 4: validate the complete dataset

Status: **in progress**

- Run the full catalog scrape.
- Compare card counts, IDs, rarities and latest-state choices against the
  current dataset and known source pages.
- Validate the golden-card matrix:
  - normal transformation;
  - tag;
  - tag plus transformation;
  - standby;
  - standby plus post-standby transformation;
  - active skill;
  - reversible exchange;
  - EX attack;
  - unit attack;
  - EZA;
  - SEZA;
  - free-to-play and summonable cards.
- Check portrait existence and dimensions.
- Review every failed page and every unmapped alternate state.
- Repeat the run to confirm stable counts and hashes where source data has not
  changed.

Current result: full catalog and golden-card validation passed with no missing
or duplicate cards. Remaining gate: compare against the legacy dataset and
validate every referenced portrait before publication.

### Phase 5: cut over publication and Android consumption

Status: **pending**

- Publish the new character bundle to R2 under the existing manifest contract.
- Keep the manifest `no-store` and the immutable data bundle cacheable.
- Update the app's character deserialization and repository only where the new
  contract requires it.
- Validate fresh install, cached install, failed download and retry behavior.
- Compare the app's character search, details, linking partners, leader skills
  and transformations against the validated dataset.
- Mark the `dokkan.fyi` character runner as the production path only after the
  Android smoke tests pass.

Exit criterion: a clean install downloads and renders the new dataset, and an
existing install updates it without losing usable cached data.

### Phase 6: resume app and optional enrichment work

Status: **blocked until Phase 5**

After cutover, resume app work in this order:

1. character detail polish and structured mechanic presentation;
2. category and leader/support workflows;
3. support memory and skill orb workflows;
4. stage, mission and acquisition views;
5. optional DokkanInfo enrichments for banners and event presentation;
6. training partners derived from the shared database.

## Non-blocking backlog

These items are useful but should not delay the character cutover:

- additional DokkanInfo event families such as Burst Mode, Ultimate Clash and
  World Tournament;
- richer acquisition sources for the remaining skill orbs without explicit
  normalized sources;
- training-partner presentation;
- deeper equipment and awakening-medal detail joins;
- future app screens for wallpapers and mission/event catalogs.

## Rollback strategy

The legacy DokkanInfo character artifact remains available until the new
pipeline has passed the complete validation and Android smoke-test gates. A
failed `dokkan.fyi` run must not overwrite the production manifest or delete
the last known-good R2 bundle.

## Definition of done

The migration is complete when:

- the full `dokkan.fyi` catalog is scraped repeatably;
- the canonical dataset contains the correct latest playable state per card
  line;
- all golden mechanics are represented and tested;
- portraits, gzip bundle and manifest validate;
- the bundle is published to R2;
- the Android app consumes it successfully on fresh and cached installs; and
- the production runner no longer depends on the legacy character scraper.
