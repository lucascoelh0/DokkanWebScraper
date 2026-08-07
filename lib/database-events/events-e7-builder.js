"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildEventsE7Coverage = exports.buildEventsE7Dataset = void 0;
const crypto_1 = require("crypto");
const canonicalIdHash = (values) => (0, crypto_1.createHash)("sha256").update(JSON.stringify([...values].sort((a, b) => a.length - b.length || a.localeCompare(b)))).digest("hex");
const evidence = (values) => ({ count: values.length, sha256: canonicalIdHash(values), samples: values.slice(0, 20) });
function comparison(key, classification, values) {
    return { key, classification, legacyCount: 0, firstPartyCount: null, joinedCount: null, agreementCount: null, conflictCount: null, legacyProjectionSha256: null, firstPartyProjectionSha256: null, idEvidence: null, boundary: null, ...values };
}
function buildEventsE7Dataset(options) {
    const { observation } = options, comparisons = [];
    for (const facet of observation.facets) {
        const classification = !facet.structuralJoin ? "unjoinable" : !facet.comparable ? "unknown" : facet.conflictCount > 0 ? "confirmed_conflict" : facet.legacyOnlyIds.length > 0 ? "unknown" : "agreement";
        comparisons.push(comparison(facet.key, classification, { legacyCount: facet.legacyCount, firstPartyCount: facet.firstPartyCount, joinedCount: facet.joinedCount, agreementCount: facet.agreementCount, conflictCount: facet.conflictCount, legacyProjectionSha256: facet.legacyProjectionSha256, firstPartyProjectionSha256: facet.firstPartyProjectionSha256, idEvidence: facet.legacyOnlyIds.length ? evidence(facet.legacyOnlyIds) : null, boundary: facet.boundary }));
        if (facet.firstPartyOnlyIds.length)
            comparisons.push(comparison(`${facet.key}.first_party_only`, facet.firstPartyOnlyClassification, { legacyCount: facet.legacyCount, firstPartyCount: facet.firstPartyCount, joinedCount: facet.joinedCount, agreementCount: facet.agreementCount, conflictCount: facet.conflictCount, idEvidence: evidence(facet.firstPartyOnlyIds), boundary: facet.firstPartyOnlyClassification === "representation_gain" ? "first_party_ids_absent_from_the_pinned_shadow_dataset" : "first_party_ids_exist_but_legacy_event_family_scope_is_unproved" }));
    }
    comparisons.push(comparison("event_rewards.cache_artifact_accounting", observation.eventCache.missing.length || observation.eventCache.unexpected.length ? "unknown" : "agreement", { legacyCount: observation.eventCache.expectedCount, firstPartyCount: observation.eventCache.observedCount, joinedCount: observation.eventCache.expectedCount - observation.eventCache.missing.length, agreementCount: observation.eventCache.expectedCount - observation.eventCache.missing.length, conflictCount: 0, legacyProjectionSha256: observation.eventCache.expectedProjectionSha256, firstPartyProjectionSha256: observation.eventCache.observedProjectionSha256, idEvidence: observation.eventCache.missing.length || observation.eventCache.unexpected.length ? evidence([...observation.eventCache.missing, ...observation.eventCache.unexpected]) : null, boundary: "artifact_accounting_only_not_remote_index_completeness" }));
    comparisons.push(comparison("event_missions.structurally_linked_subset", "agreement", { legacyCount: observation.linkedLegacyMissionCount, firstPartyCount: observation.firstPartyLinkedMissionCount, joinedCount: observation.linkedLegacyMissionCount, agreementCount: observation.linkedLegacyMissionCount, conflictCount: 0, boundary: "only_missions_with_explicit_first_party_event_or_stage_targets_are_in_this_subset" }));
    if (observation.firstPartyLinkedMissionOnlyIds.length)
        comparisons.push(comparison("event_missions.structurally_linked_subset.first_party_only", "representation_gain", { legacyCount: observation.linkedLegacyMissionCount, firstPartyCount: observation.firstPartyLinkedMissionCount, joinedCount: observation.linkedLegacyMissionCount, agreementCount: observation.linkedLegacyMissionCount, conflictCount: 0, idEvidence: evidence(observation.firstPartyLinkedMissionOnlyIds), boundary: "first_party_structural_event_targets_absent_from_pinned_event_missions" }));
    for (const value of observation.unknownSurfaces)
        comparisons.push(comparison(value.key, "unknown", { legacyCount: value.legacyCount, boundary: value.reason }));
    for (const value of observation.unjoinableSurfaces)
        comparisons.push(comparison(value.key, "unjoinable", { legacyCount: value.legacyCount, idEvidence: value.key === "event_missions.event_relation" ? evidence(observation.unlinkedLegacyMissionIds) : null, boundary: value.reason }));
    const eventFamilies = observation.eventFamilies.map(value => ({ ...value, rootClassification: (value.rootTarget === null ? "unjoinable" : value.joinedRootCount === value.eventCount ? "agreement" : "unknown"), stageClassification: (value.joinedStageCount === value.stageCount ? "agreement" : "unknown") }));
    const paginationAudits = [
        { dataset: "quest-story-stages", status: "unknown", evidenceFile: "fyi-stages.ts", strategy: "single_quest_story_payload", artifactBoundary: "artifact_has_no_remote_total_or_run_limit_provenance" },
        { dataset: "event-stages", status: "partial", evidenceFile: "fyi-stages.ts", strategy: "last_page_iteration", artifactBoundary: "artifact_does_not_pin_response_pagination_metadata_or_optional_limit" },
        { dataset: "z-battles", status: "partial", evidenceFile: "fyi-z-battles.ts", strategy: "last_page_iteration", artifactBoundary: "artifact_does_not_pin_response_pagination_metadata_or_optional_id_limit" },
        { dataset: "dokkan-frontier", status: "unknown", evidenceFile: "fyi-dokkan-frontier.ts", strategy: "single_series_index", artifactBoundary: "artifact_has_no_remote_total_and_does_not_record_optional_limits" },
        { dataset: "event-missions", status: "partial", evidenceFile: "fyi-event-missions.ts", strategy: "last_page_iteration", artifactBoundary: "artifact_does_not_pin_response_pagination_metadata_or_optional_category_limit" },
        { dataset: "event-rewards", status: "unknown", evidenceFile: "dokkaninfo-event-rewards.ts", strategy: "one_index_request_per_configured_type", artifactBoundary: "remote_indexes_have_no_proven_pagination_total_and_artifact_does_not_record_type_or_limit_configuration" },
        { dataset: "event-rewards-cache", status: "supported", evidenceFile: "dokkaninfo-event-rewards.ts", strategy: "output_event_to_cache_basename_set_equality", artifactBoundary: "local_artifact_accounting_only" },
    ];
    return {
        schemaVersion: 1, contract: "dokkan-events-database-first-shadow-parity", contractVersion: "0.8.0", generatedAt: options.generatedAt, generatedAtPolicy: "pinned_to_source_snapshot_for_reproducible_bytes", sourceSnapshotVersion: options.sourceSnapshotVersion, sourceDatabaseSha256: options.sourceDatabaseSha256, sourceE6: { contractVersion: "0.7.0", sha256: options.sourceE6Sha256 }, implementationBaselineSha256: options.implementationBaselineSha256,
        legacySources: [...options.legacySources].sort((a, b) => a.name.localeCompare(b.name)), implementationEvidence: [...options.implementationEvidence].sort((a, b) => a.fileName.localeCompare(b.fileName)), comparisons: comparisons.sort((a, b) => a.key.localeCompare(b.key)), eventFamilies, paginationAudits,
        confirmedConflicts: observation.facets.flatMap(facet => facet.conflicts.map(value => ({ comparisonKey: facet.key, ...value }))).sort((a, b) => a.comparisonKey.localeCompare(b.comparisonKey) || a.id.localeCompare(b.id)),
        authorityBoundary: { legacyRole: "shadow_parity_only", textJoinAllowed: false, staticCatalogAvailabilityStatus: "unknown_server_schedule_required", productionMutation: false },
    };
}
exports.buildEventsE7Dataset = buildEventsE7Dataset;
function buildEventsE7Coverage(dataset, observation) {
    const byClassification = { agreement: 0, representation_gain: 0, confirmed_conflict: 0, unknown: 0, unjoinable: 0 };
    for (const value of dataset.comparisons)
        byClassification[value.classification] += 1;
    const paginationByStatus = { supported: 0, partial: 0, unknown: 0 };
    for (const value of dataset.paginationAudits)
        paginationByStatus[value.status] += 1;
    return { schemaVersion: 1, comparisonCount: dataset.comparisons.length, byClassification, legacySourceCount: dataset.legacySources.length, eventFamilyCount: dataset.eventFamilies.length, confirmedConflictCount: dataset.confirmedConflicts.length, cacheExpectedCount: observation.eventCache.expectedCount, cacheObservedCount: observation.eventCache.observedCount, cacheMismatchCount: observation.eventCache.missing.length + observation.eventCache.unexpected.length, paginationByStatus };
}
exports.buildEventsE7Coverage = buildEventsE7Coverage;
//# sourceMappingURL=events-e7-builder.js.map