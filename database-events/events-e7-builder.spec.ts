import { equal, deepEqual } from "assert";
import { buildEventsE7Coverage, buildEventsE7Dataset } from "./events-e7-builder";
import { EventsE7Observation } from "./events-e7-contract";
import { validateEventsE7Dataset } from "./events-e7-validator";

const projection = "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e21b6e59402cf966b5d740b";
const observation: EventsE7Observation = {
    sources: [],
    facets: [{ key: "stages.fields", structuralJoin: true, comparable: true, boundary: null, firstPartyOnlyClassification: "representation_gain", legacyCount: 2, firstPartyCount: 3, joinedCount: 2, agreementCount: 2, conflictCount: 0, legacyProjectionSha256: projection, firstPartyProjectionSha256: projection, legacyOnlyIds: [], firstPartyOnlyIds: ["3"], conflicts: [] }],
    eventFamilies: [{ family: "story", eventCount: 1, joinedRootCount: 1, stageCount: 2, joinedStageCount: 2, rootTarget: "area" }, { family: "sdbattle", eventCount: 1, joinedRootCount: 0, stageCount: 1, joinedStageCount: 1, rootTarget: null }],
    eventRewardRows: 10, eventRewardRowJoinBoundary: "derived_text_key_is_not_a_first_party_row_identifier",
    eventCache: { expectedCount: 2, observedCount: 2, expectedProjectionSha256: projection, observedProjectionSha256: projection, missing: [], unexpected: [] },
    legacyMissionCount: 2, linkedLegacyMissionCount: 1, unlinkedLegacyMissionIds: ["2"], firstPartyLinkedMissionCount: 2, firstPartyLinkedMissionOnlyIds: ["3"],
    unknownSurfaces: [{ key: "runtime.stats", legacyCount: 2, reason: "units_unknown" }],
    unjoinableSurfaces: [{ key: "reward.rows", legacyCount: 10, reason: "no_row_id" }, { key: "event_missions.event_relation", legacyCount: 1, reason: "no_structural_target" }],
};
const sources = [{ name: "legacy", fileName: "legacy.json", sha256: "source", sizeBytes: 1, generatedAt: "legacy-time", source: "shadow", declaredCounts: { count: 2 } }];
const implementations = [{ fileName: "source.ts", sha256: "implementation", sizeBytes: 2 }];
const build = () => buildEventsE7Dataset({ observation, legacySources: sources, implementationEvidence: implementations, implementationBaselineSha256: "baseline", generatedAt: "time", sourceSnapshotVersion: "snapshot", sourceDatabaseSha256: "db", sourceE6Sha256: "e6" });

describe("events E7 shadow parity", () => {
    it("classifies matched and first-party-only evidence separately", () => { const dataset = build(); equal(dataset.comparisons.find(value => value.key === "stages.fields")!.classification, "agreement"); equal(dataset.comparisons.find(value => value.key === "stages.fields.first_party_only")!.classification, "representation_gain"); });
    it("does not promote an unscoped first-party surplus", () => { const changed = { ...observation, facets: [{ ...observation.facets[0], firstPartyOnlyClassification: "unknown" as const }] }; const dataset = buildEventsE7Dataset({ observation: changed, legacySources: sources, implementationEvidence: implementations, implementationBaselineSha256: "baseline", generatedAt: "time", sourceSnapshotVersion: "snapshot", sourceDatabaseSha256: "db", sourceE6Sha256: "e6" }); equal(dataset.comparisons.find(value => value.key === "stages.fields.first_party_only")!.classification, "unknown"); });
    it("keeps unknown and unjoinable surfaces explicit", () => { const dataset = build(); equal(dataset.comparisons.find(value => value.key === "runtime.stats")!.classification, "unknown"); equal(dataset.comparisons.find(value => value.key === "reward.rows")!.classification, "unjoinable"); equal(dataset.authorityBoundary.textJoinAllowed, false); });
    it("does not invent a structural root for sdbattle", () => { const dataset = build(); equal(dataset.eventFamilies.find(value => value.family === "sdbattle")!.rootClassification, "unjoinable"); equal(dataset.eventFamilies.find(value => value.family === "sdbattle")!.stageClassification, "agreement"); });
    it("keeps unlinked missions outside the agreement subset", () => { const dataset = build(), linked = dataset.comparisons.find(value => value.key === "event_missions.structurally_linked_subset")!, unlinked = dataset.comparisons.find(value => value.key === "event_missions.event_relation")!; equal(linked.legacyCount, 1); equal(linked.classification, "agreement"); equal(unlinked.legacyCount, 1); equal(unlinked.classification, "unjoinable"); equal(unlinked.idEvidence?.count, 1); });
    it("rebuilds losslessly and validates exclusive classifications", () => { const dataset = build(), validation = validateEventsE7Dataset(dataset, observation, sources, implementations, "baseline"); equal(validation.valid, true); equal(validation.exactProjection, true); equal(validation.exclusiveClassifications, true); });
    it("rejects projection drift hidden behind zero conflicts", () => { const changed = { ...observation, facets: [{ ...observation.facets[0], firstPartyProjectionSha256: "different" }] }; const dataset = buildEventsE7Dataset({ observation: changed, legacySources: sources, implementationEvidence: implementations, implementationBaselineSha256: "baseline", generatedAt: "time", sourceSnapshotVersion: "snapshot", sourceDatabaseSha256: "db", sourceE6Sha256: "e6" }); equal(validateEventsE7Dataset(dataset, changed, sources, implementations, "baseline").valid, false); });
    it("reports classification coverage deterministically", () => { const coverage = buildEventsE7Coverage(build(), observation); deepEqual(coverage.byClassification, { agreement: 3, representation_gain: 2, confirmed_conflict: 0, unknown: 1, unjoinable: 2 }); });
});
