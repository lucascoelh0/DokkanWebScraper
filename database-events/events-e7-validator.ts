import { buildEventsE7Coverage, buildEventsE7Dataset } from "./events-e7-builder";
import { EventsE7Dataset, EventsE7Observation, EventsE7SourceLineage, EventsE7Validation } from "./events-e7-contract";

const classifications = new Set(["agreement", "representation_gain", "confirmed_conflict", "unknown", "unjoinable"]);

export function validateEventsE7Dataset(dataset: EventsE7Dataset, observation: EventsE7Observation, legacySources: EventsE7SourceLineage[], implementationEvidence: Array<{ fileName: string; sha256: string; sizeBytes: number }>, implementationBaselineSha256: string, expected?: { generatedAt: string; sourceSnapshotVersion: string; sourceDatabaseSha256: string; sourceE6Sha256: string }): EventsE7Validation {
    const failures: string[] = [];
    if (dataset.schemaVersion !== 1 || dataset.contract !== "dokkan-events-database-first-shadow-parity" || dataset.contractVersion !== "0.8.0" || dataset.generatedAtPolicy !== "pinned_to_source_snapshot_for_reproducible_bytes") failures.push("contract identity");
    const rebuilt = buildEventsE7Dataset({ observation, legacySources, implementationEvidence, implementationBaselineSha256, generatedAt: dataset.generatedAt, sourceSnapshotVersion: dataset.sourceSnapshotVersion, sourceDatabaseSha256: dataset.sourceDatabaseSha256, sourceE6Sha256: dataset.sourceE6.sha256 });
    const exactProjection = JSON.stringify(dataset) === JSON.stringify(rebuilt); if (!exactProjection) failures.push("exact source projection");
    const exclusiveClassifications = dataset.comparisons.every(value => classifications.has(value.classification)) && new Set(dataset.comparisons.map(value => value.key)).size === dataset.comparisons.length; if (!exclusiveClassifications) failures.push("exclusive comparison classification");
    const lineageValid = dataset.implementationBaselineSha256 === implementationBaselineSha256 && (!expected || (dataset.generatedAt === expected.generatedAt && dataset.sourceSnapshotVersion === expected.sourceSnapshotVersion && dataset.sourceDatabaseSha256 === expected.sourceDatabaseSha256 && dataset.sourceE6.sha256 === expected.sourceE6Sha256)); if (!lineageValid) failures.push("source lineage");
    for (const facet of observation.facets) {
        if (facet.joinedCount + facet.legacyOnlyIds.length !== facet.legacyCount || facet.joinedCount + facet.firstPartyOnlyIds.length !== facet.firstPartyCount) failures.push(`facet set accounting ${facet.key}`);
        if (facet.agreementCount + facet.conflictCount !== facet.joinedCount || facet.conflicts.length !== facet.conflictCount) failures.push(`facet comparison accounting ${facet.key}`);
        if (facet.firstPartyOnlyClassification !== "representation_gain" && facet.firstPartyOnlyClassification !== "unknown") failures.push(`facet gain classification ${facet.key}`);
        if (facet.conflictCount === 0 && facet.legacyProjectionSha256 !== facet.firstPartyProjectionSha256) failures.push(`facet projection mismatch ${facet.key}`);
    }
    const conflictCount = observation.facets.reduce((sum, value) => sum + value.conflictCount, 0); if (dataset.confirmedConflicts.length !== conflictCount) failures.push("confirmed conflict projection");
    if (dataset.comparisons.some(value => value.classification === "confirmed_conflict") !== (conflictCount > 0)) failures.push("confirmed conflict classification");
    if (dataset.authorityBoundary.legacyRole !== "shadow_parity_only" || dataset.authorityBoundary.textJoinAllowed || dataset.authorityBoundary.productionMutation || dataset.authorityBoundary.staticCatalogAvailabilityStatus !== "unknown_server_schedule_required") failures.push("authority boundary");
    if (dataset.eventFamilies.some(value => value.joinedRootCount > value.eventCount || value.joinedStageCount > value.stageCount || (value.rootTarget === null && value.rootClassification !== "unjoinable"))) failures.push("event family accounting");
    const coverage = buildEventsE7Coverage(dataset, observation); if (coverage.comparisonCount !== dataset.comparisons.length || coverage.confirmedConflictCount !== conflictCount) failures.push("coverage accounting");
    const finite = (value: unknown): boolean => typeof value === "number" ? Number.isFinite(value) : Array.isArray(value) ? value.every(finite) : value !== null && typeof value === "object" ? Object.values(value).every(finite) : true; if (!finite(dataset)) failures.push("non-finite numeric value");
    return { schemaVersion: 1, valid: failures.length === 0, exactProjection, exclusiveClassifications, lineageValid, failures };
}
