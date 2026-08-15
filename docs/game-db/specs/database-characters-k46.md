# Database Characters K46 - leader structural projection

Status: offline generation and source-bound validation GO. Effect-target
association, leader-clause semantics, presentation, consumers, apply/overlay,
authority, production, publisher, network, R2 and Android remain NO-GO.
Contract version `1.0.0`.

## Boundary

K46 projects the exact K45-supported states into a local content-addressed
dataset containing only `stateId`, `sourceStateKey`, `cardId`, `releaseState`
and `{table,rowId}` references for leader set, effects and targets. Percent
values, text, raw rows and `Character[]` are absent.

K3 builds its flat target list by expanding the target set of every leader
effect. Consequently, 34,914 target occurrences contain 12,720 repeated refs;
those repetitions are structural provenance, not proven duplicates. K46
preserves their source order and multiplicity and explicitly does not infer a
positional effect-target association. All 49,435 effect refs are distinct
within their state. A future association audit must reconstruct the structural
effect-to-target-set links before any consumer or semantic decision.

## Invocation and artifact safety

The runner has no defaults and requires Node garbage collection support:

```text
npm run run:database-characters-leader-projection -- \
  --opt-in-k46 \
  --sidecar-root <exact-k0-k7-root> \
  --production-root <exact-k7-production-root> \
  --fyi-root <exact-k7-fyi-root> \
  --k43-root <exact-k43-artifact-root> \
  --output-root <existing-empty-local-root>
```

K46 requires a real K45 GO and exact K45 pins, revalidates K43 source-bound,
loads K3 through its exact-size pinned reader and checks both sources again
after the final artifact reread. Payload, coverage and validation are written
create-only before the fixed manifest. Reads reject oversized members before
allocation, use no-follow handles, prove EOF and recheck file identity.

No automatic cleanup or unlink is attempted. A failure can leave a partial
create-only namespace, which must be preserved and retried with a new root
unless a separately authorized operator cleans it up.

## Real result

| Member | Bytes | SHA-256 |
| --- | ---: | --- |
| canonical JSON | 5,817,631 | `98c752e2b15676d1221dfec10e313c01b842c2f197d0e7f99e49885346208500` |
| content-addressed gzip | 204,314 | `7ff068201c07560ead8c392e3e859fbcb889530844d04609701562788bbcf9fd` |
| coverage | 614 | `64bfd6f27c5995ba77bb88b634fb7e0b03d9781619cadd42d67b6ae7e7738773` |
| validation | 1,013 | `cde744d3d6a17294c215b6ddd28a41d51348469aade12044040f6b4a62c2db44` |
| manifest | 2,301 | `079486e41b880206263d9c7f8e1cde7b1fc419f84e31b0b42deef5fde0d41e9b` |

Metadata totals 3,928 bytes. Two independent roots produced identical names,
sizes and SHA-256 values. Peak RSS was 889,372,672 and 896,233,472 bytes, below
the exclusive 1 GiB limit. The exclusive raw, gzip and metadata limits are 16
MiB, 2 MiB and 64 KiB.

The first real attempt failed closed before writing because the initial draft
deduplicated target refs while still requiring K45 raw reference pins. Source
audit traced the repetitions to effect target-set expansion; the final contract
therefore preserves them. Specialized contract review found no remaining
P0-P2 issue. The final domain suite passed 216 tests with nine Windows-only
symlink fixtures pending.

## Readiness

| Scope | Decision |
| --- | --- |
| offline leader structural projection | **GO** |
| source-bound artifact validation | **GO** |
| structural effect-target association audit | **GO** |
| effect-target association product or clause semantics | **NO-GO** |
| presentation or consumer | **NO-GO** |
| apply/overlay, authority or production | **NO-GO** |
| publisher, network or R2 | **NO-GO** |
| Android | **NO-GO** |
