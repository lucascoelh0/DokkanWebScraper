# Database Characters K6 — static asset references

Status: optional, additive, non-production. Contract version `1.0.0`.

## Question, boundary and gate

K6 asks which asset IDs, scripts, motion names and paths are explicitly
referenced by the snapshot. It discovers no endpoints, downloads no catalog and
does not claim delivery. The inspected APK extraction contains only native
libraries, so no asset file is marked local/proved.

## Contract

The sidecar separates four layers: first-party value and provenance; an exact
path/script or a namespaced key derived from a first-party numeric ID; a local
file status; and delivery status. All 21,207 references have delivery unknown
and no local file. Twelve focused SQLite tables contribute 39,034 normalized
raw rows.

The selected corpus yields 8,277 Super view IDs, 86 explicit Super asset IDs,
7,779 joined Super scripts, 3,282 motion keys, 566 action/standby/finish scripts,
494 Active views, 28 Standby views/icons and 46 Finish views. Form transitions
retain their relation provenance and target-card resource reference when one is
explicit.

Only 75 of 5,759 cards expose a nonzero `resource_id`; only 8 of 558 form
targets therefore produce a resource-bundle reference. The remaining 5,684
cards and 550 form targets are explicit source gaps. A resource bundle is not
claimed to be a full portrait, card art or icon. Rarity/type frame mapping,
Entrance grouping and Domain grouping remain unknown. These gaps explain why
K6 cannot replace the current portrait pipeline.

All selected action-set and special-view joins succeed. There are no duplicate
reference or raw-row identities. Two generations were byte-identical.

Artifact: 901,984 bytes gzip / 27,373,521 bytes raw, SHA-256
`743b9128ba3b708a4ead6b436c7f6aa71f6885f29f7336fb91972bf7e09089a1`.
Peak observed RSS was 549,810,176 bytes.
