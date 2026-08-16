# Database Characters K56 - supported-only leader projection

Status: offline source-bound projection GO for the first-party-supported
unconditional type-82 corpus. The 17 conditional effects remain explicitly
excluded. Contract version `1.0.0`.

## Boundary

K56 turns the K50/K51/K55 structural evidence into a local, default-off
product projection. It emits one source-ordered record per supported state and
effect occurrence with only structural IDs, the element/awakening mask, common
HP/ATK/DEF modifier, calculation shape, target scope and category filters.

The source corpus contains 3,853 type-82 effects and 12,310 references. K56
projects 3,836 unconditional effects and 12,265 references. The following 17
conditional effect rows and their 45 references are excluded exactly as
`runtime_deck_index_unresolved`:

`5266`, `5271`, `5276`, `5281`, `5986`, `5991`, `5996`, `6001`, `8071`,
`10036`, `11861`, `11863`, `10326202`, `10326302`, `10326402`, `10326502`
and `10326602`.

The projection does not include execution timing, causality, ignored vector
position 2, text, descriptions, aggregate/final values, invented
primary/secondary labels, `Character[]`, apply logic or authority.

## Corroborative domain rule

The user-confirmed rule is recorded separately in coverage as
`k56-conditional-domain-rule-v1` with provenance
`user_confirmed_domain_rule`. Reported community corroboration is explicitly
not independently source-bound. It is not first-party evidence for the
runtime `deckIndex`, does not authorize the supported projection and never
appears in the payload.

The rule keeps these dimensions distinct:

- current `elementType`: AGL, TEQ, INT, STR or PHY;
- `battleClass`: Super, Extreme or none;
- `awakeningState`: the selected card state, with pre-Z class `none`;
- condition scope: six owned units plus Friend Leader;
- effect target: only eligible units matching the effect target;
- Friend participation in the condition versus Friend receipt of the effect;
- passive all-five-types scope as corroborative-only;
- separate proofs for Super presence, Extreme presence and all five types in
  dual-class clauses.

This rule does not change the K54 result: the effective runtime collection
branch for the 17 effects remains unknown. No runtime instrumentation was
performed.

## Invocation and safety

```text
npm run run:database-characters-leader-supported-projection -- \
  --sidecar-root <exact-k0-k7-root> \
  --production-root <exact-k7-production-root> \
  --fyi-root <exact-k7-fyi-root> \
  --k43-root <exact-k43-artifact-root> \
  --k46-root <exact-k46-artifact-root> \
  --k48-root <exact-k48-artifact-root> \
  --output-root <new-existing-stable-local-root> \
  --native-runtime <exact-libcocos2dcpp.so> \
  --database <exact-first-party-global-sqlite>
```

The runner requires explicit opt-in and Node `--expose-gc`. It performs a real
K55 audit, materializes twice, writes with create-only members and the manifest
last, then reloads every source and reruns K55 through the source-bound public
validator. Network, R2, Android, apply, authority and production remain
disabled.

The writer's containment guarantee assumes a caller-controlled output root
that remains stable during the operation. Same-user concurrent replacement of
an ancestor is explicitly not protected and remains NO-GO.

## Real result

Two independent real roots produced four byte-identical members:

| Member | Bytes | SHA-256 |
| --- | ---: | --- |
| canonical JSON before gzip | 12,847,768 | `345f7ab587fe893c58971799e220548896f2bf803b667b18a70595f32ac78154` |
| content-addressed gzip | 185,908 | `5579ed50704453cae29e97d770c05b02492c4f5130d2e4075da1e961817f2473` |
| coverage | 21,196 | `e8e7a372d87ee3fc0b7393a15e83a191290cee61f88c303c25178504dffd6a8f` |
| validation | 1,498 | `c24b898cbbd4da324ac4cf83068f2d9ec9603b3276993f48736a40fa99eddf4e` |
| manifest | 7,146 | `e5213cc11b141e585eff1cffdfd3043e790cff718569367e26c5dd581bdd1546` |

Both runs had empty stderr. Peak RSS was 1,067,995,136 and 1,067,003,904
bytes, below the exclusive 1 GiB ceiling by only 5,746,688 and 6,737,920
bytes respectively. This narrow margin is an operational risk and must remain
monitored.

The card-ID-only shadow comparison joined 2,265 of 3,434 projected distinct
card IDs. It found 8,893 structurally joinable references and 3,372 unjoinable
references. Comparable value references remain zero, so zero conflicts are
not a completeness or authority claim.

## Readiness

| Scope | Decision |
| --- | --- |
| offline supported-only projection | **GO** |
| source-bound validation | **GO** |
| 17 conditional effects / effective runtime branch | **NO-GO** |
| combined Leader + Friend value and final combat calculation | **NO-GO** |
| authority, apply or production | **NO-GO** |
| publisher, network, R2 or Android | **NO-GO** |
| concurrent output-ancestor replacement protection | **NO-GO** |
| dynamic runtime instrumentation | **NO-GO** |
