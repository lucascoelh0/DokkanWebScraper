# Game DB First-Party Acquisition Contract

## Purpose

This document defines the filesystem contract for a future first-party Dokkan Global export.

The goal is to let the rest of the pipeline stay stable while we replace mirror/external exports with our own acquisition step later.

In other words:

- acquisition can change
- the downstream importer should not need to change every time

## Current stance

The update runner now supports:

- `existing-export`
- `mirror-repo`
- `first-party-export`

`first-party-export` is the long-term target mode for Dokkanpanion-owned acquisition.

## Directory contract

The root directory passed to `first-party-export` should contain:

- `metadata.json`
- either:
  - `data/*.csv`
  - or direct `*.csv` files at the root

At minimum, it must be resolvable by the existing game DB source reader, which currently requires `cards.csv` and the other tables used by the importer.

Recommended layout:

```text
first-party-export/
  metadata.json
  data/
    cards.csv
    leader_skill_sets.csv
    leader_skills.csv
    passive_skill_sets.csv
    passive_skill_set_relations.csv
    passive_skills.csv
    card_specials.csv
    special_sets.csv
    link_skills.csv
    card_categories.csv
    card_card_categories.csv
    card_awakening_routes.csv
    optimal_awakening_growths.csv
    active_skill_sets.csv
    active_skills.csv
    card_active_skills.csv
    dokkan_fields.csv
    dokkan_field_efficacy_sets.csv
    dokkan_field_efficacies.csv
    dokkan_field_active_skill_set_relations.csv
    dokkan_field_passive_skill_relations.csv
    standby_skill_sets.csv
    standby_skills.csv
    card_standby_skill_set_relations.csv
    finish_skill_sets.csv
    finish_skills.csv
    card_finish_skill_set_relations.csv
    standby_skill_set_finish_skill_set_relations.csv
```

The five `dokkan_field_*` tables form one additive sidecar inventory. Older
exports that contain none of them remain readable by the character importer.
New first-party exports must contain all five; a partial sidecar fails closed.
Their relations establish structural associations only and do not, by
themselves, prove created-Domain ownership or efficacy semantics.

The legacy character importer intentionally continues to load only its core
table inventory. Sidecar discovery is a separate all-or-none operation and is
not materialized into the character dataset. When present, it may instead be
materialized as `dokkan-field-sidecar.json.gz` plus
`dokkan-field-sidecar-manifest.json`. That additive artifact is source-snapshot
bound, hash/size/count validated and explicitly structural-only. Incomplete
included-table joins remain preserved as evidence but are ineligible for
structural consumption. Absence produces zero output files, and neither the
artifact nor its relation indexes assert created-Domain ownership or effects.

Build and promotion utilities install only into a new output directory. They
stage and validate the closed inventory, claim the destination directory
exclusively, copy members without replacement, and copy `metadata.json` last as
the validity marker. They never replace or delete an existing export; callers
must choose a fresh versioned output directory. A crash before metadata leaves
an invalid incomplete generation, not an authoritative export.

These transitional utilities must run below a private, caller-controlled output
parent. They reject ordinary path replacement, links and concurrent writers
observed at their validation boundaries, but Node does not provide a portable
descriptor-relative `openat`/no-follow copy primitive. They therefore do not
claim confinement against a hostile same-OS-identity process that replaces a
validated parent entry in the check-to-copy interval. That stronger in-operation
race guarantee belongs to the AQ/DQ/C4 controlled acquisition path described
below; shared or adversarial output parents are **NO-GO** for the transitional
utilities.

## Metadata contract

`metadata.json` must exist and should look like this:

```json
{
  "source": "first-party-export",
  "region": "global",
  "exportedAt": "2026-06-27T21:00:00.000Z",
  "dbVersion": "1782367825",
  "assetVersion": "1782367204",
  "apkVersion": "6.2.5",
  "notes": "Exported by local first-party acquisition pipeline"
}
```

Required fields:

- `source`

Recommended fields:

- `region`
- `exportedAt`
- `dbVersion`
- `assetVersion`
- `apkVersion`
- `notes`

## Upstream acquisition is a separate contract

AQ0–AQ6 defines a narrower upstream artifact acquisition contract in
[`game-db-manual-sqlite-acquisition-aq0-aq6.md`](game-db-manual-sqlite-acquisition-aq0-aq6.md).
It can validate and retain an official Global EN database artifact, but it does
not decrypt it, write this CSV export, invoke the update runner or promote any
production data.

AQ0–AQ6 ends at the official acquired artifact, which may still be encrypted.
A loose decrypted SQLite must not be sent directly to C4 or treated as an AQ
commit. DQ0-DQ4 now defines the first bounded derived-artifact contract in
[`game-db-derived-sqlite-artifact-dq0-dq4.md`](game-db-derived-sqlite-artifact-dq0-dq4.md),
and provides only an injected test transformer. DQ5 integrates only local
read-only C4 compatibility inspection of a fully validated DQ commit.
Producing a first-party export remains a later, explicit transformation:

1. acquire and validate the Global EN artifact under AQ0–AQ6;
2. after separate authorization, add a separately reviewed productive secret
   provider and SQLCipher adapter if the artifact is `encrypted_or_packaged`;
3. have DQ consume the parent AQ commit and produce a new deterministic
   derived commit containing the parent AQ identity, pinned tool/version,
   required non-secret parameters, result SHA/size/state, deterministic metadata
   and marker, plus a sanitized operational receipt;
4. run DQ5 commit-bound read-only SQLite/C4 compatibility only on that derived
   commit, using both trust roots;
5. write the normalized CSV tables;
6. write this contract's `metadata.json`;
7. place the export in a stable folder the runner can consume.

The productive C4 contract accepts only AQ `storeRoot + artifactIdentity`, AQ
`storeRoot + useLatest`, or DQ `derivedStoreRoot + sourceStoreRoot +
derivedArtifactIdentity`. These modes are mutually exclusive, and DQ has no
`useLatest`. C4 never accepts an arbitrary SQLite, receipt, metadata or marker
path and derives its path only after validating deterministic metadata, the
commit marker, the content-addressed directory identity, descriptor lineage,
artifact SHA/size/state, containment and the exact member set. It opens the
committed database once, copies bytes from that descriptor into a private
exclusive read-only snapshot, validates snapshot SHA/size before and after the
adapter, and revalidates the source commit before reporting. `latest` explicitly
selects the immutable pointer journal winner and revalidates the materialized
commit; a legacy `latest.json` cache is never authority.
Operational receipts are optional sanitized evidence of an operation; they are
not deterministic identity and cannot authorize bytes or produce
`acquiredArtifactState`.

The DQ validator requires both the derived store root and AQ source-store root.
It materially revalidates the parent identity and its SHA, size and state; a
self-consistent derived commit or derived root alone is not lineage authority.
DQ5 C4 therefore receives both trust roots, snapshots only the validated DQ
output, and revalidates the exact DQ commit and AQ parent after inspection.
Receipt or
clock failure after complete material validation does not revoke the valid
marker-last commit, though the operation still reports failure.

DQ's historical argv-key Python helper is retired and exits without accepting
paths or secret material. Keys must never be passed in argv or environment
contracts; DQ0-DQ4 passes runtime secret bytes only
from an injected provider to an injected transformer that receives an open AQ
input, a controlled bounded output sink and an `AbortSignal` rather than
arbitrary paths or a raw output handle.

DQ5 does not invoke that runner, transformer or provider. It authorizes no real
decryption, SQLCipher process, export, refresh, production, publication, R2 or
Android path.

## Threat model

Descriptors, paths, pointers, receipts and artifacts are untrusted inputs.
Within each operation, AQ and its consumers detect corruption, replacement and
races at their validated handle/path boundaries. Promotion creates independent
read-only files rather than writable aliases. Pointer promotion appends one
immutable create-only journal record and never overwrites a shared pointer
pathname; deterministic selection and rollback use only fully validated commits.
Every consumer revalidates
the complete commit before using bytes; subsequent corruption therefore fails
closed and is never silently accepted. Manual/default-off status grants no
authority to receipts or pointers.

The contract does not claim protection against a malicious process or
administrator operating under the same OS identity after return, a compromised
filesystem or kernel, or permanent physical immutability on writable storage.
These exclusions do not cover reproducible races during the operation; such
races remain inside the threat model and must fail closed.

The rest of the pipeline should then stay unchanged:

1. read export
2. build source snapshot
3. build Dokkanpanion dataset
4. validate
5. publish

## Transitional helper

Until the real first-party downloader/exporter exists, the repo now includes a helper command that promotes a known-good external export into this contract:

```powershell
npm run run:game-db-promote-first-party-export
```

That helper:

1. resolves the current source export
2. copies the required CSV tables
3. writes `metadata.json`

This is not the final acquisition solution, but it lets the rest of the pipeline start consuming the `first-party-export` layout immediately.

There is also a historical, explicitly experimental direct SQLite export helper:

```powershell
npm run experimental:game-db-build-first-party-export-from-sqlite -- --sqlite-path "C:\path\to\database.db"
```

This helper is outside the AQ/C4 productive chain. It accepts a loose development
SQLite under a different contract, emits no C4 report or `acquiredArtifactState`,
and cannot establish acquired or derived artifact lineage.

## Why this matters

This contract gives us a clean handoff between:

- acquisition engineering
- importer/data-model engineering
- publish/ops automation

That separation is what lets us keep shipping progress now while the true downloader/export path is still under construction.

