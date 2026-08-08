import { CaptureH3Dataset } from "./capture-h3-contract";
import { CaptureH4Dataset } from "./capture-h4-contract";
import { CaptureH5Dataset } from "./capture-h5-contract";
import { CaptureH6Dataset } from "./capture-h6-contract";
import { CaptureH7CompactInputs } from "./capture-h7-inputs";
import { CaptureH7Comparison, CaptureH7Dataset, CaptureH7Decision, CaptureH7MetricClassification, CaptureH7SourceLineage, CaptureH7Validation } from "./capture-h7-contract";

const metricKeys: CaptureH7MetricClassification[] = ["agreement", "representationGain", "confirmedConflict", "unknown", "unjoinable"];
const comparisonKeys = ["capture_asset_reference_vs_captured_cdn", "capture_asset_reference_vs_e6_path", "capture_database_descriptor_vs_s4", "capture_dynamic_schedule_representation", "capture_event_root_vs_e1_identity", "capture_gasha_featured_relation", "capture_gasha_identity_vs_s1", "capture_gasha_period_vs_s1", "capture_genkai_root_vs_s2", "capture_mission_category_vs_e5", "capture_mission_completion_reference_vs_e5", "capture_mission_display_reward_reference", "capture_quest_relation_vs_e2", "capture_rmbattle_root_vs_s2", "capture_z_battle_identity_vs_e1", "prior_database_events_e7", "prior_database_server_s6"];
const decisionKeys = ["android_shadow_mode", "asset_delivery", "future_authenticated_automation", "local_sanitized_fixtures", "merge_disabled_infrastructure", "mission_reward_authority", "r2_publication", "remove_fyi_dokkaninfo", "replace_banners", "replace_schedules"];
const sourceKeys = ["e1", "e2", "e5", "e6", "e7", "e9", "h0", "h3", "h4", "h5", "h6", "s0", "s1", "s2", "s3", "s4", "s5", "s6", "s7"];
const sourceContracts: Record<string, [string, string, "capture_sidecar" | "database_server" | "database_events"]> = {
    e1: ["dokkan-events-database-first-catalog", "0.2.0", "database_events"], e2: ["dokkan-events-database-first-topology", "0.3.0", "database_events"], e5: ["dokkan-events-database-first-rewards", "0.6.0", "database_events"], e6: ["dokkan-events-database-first-assets", "0.7.0", "database_events"], e7: ["dokkan-events-database-first-shadow-parity", "0.8.0", "database_events"], e9: ["dokkan-events-database-first-readiness", "1.0.0", "database_events"],
    h0: ["dokkan-official-capture-structural-inventory", "0.1.1", "capture_sidecar"], h3: ["dokkan-official-capture-schedules-availability", "0.4.0", "capture_sidecar"], h4: ["dokkan-official-capture-gashas", "0.5.0", "capture_sidecar"], h5: ["dokkan-official-capture-mission-boards", "0.6.0", "capture_sidecar"], h6: ["dokkan-official-capture-asset-evidence", "0.7.0", "capture_sidecar"],
    s0: ["dokkan-server-source-catalog", "0.1.0", "database_server"], s1: ["dokkan-server-schedule-and-banners", "0.2.0", "database_server"], s2: ["dokkan-server-root-resolution", "0.3.0", "database_server"], s3: ["dokkan-server-reward-identity", "0.4.0", "database_server"], s4: ["dokkan-server-asset-delivery", "0.5.0", "database_server"], s5: ["dokkan-server-sidecar-registry", "0.6.0", "database_server"], s6: ["dokkan-server-shadow-parity", "0.7.0", "database_server"], s7: ["dokkan-server-readiness", "0.8.0", "database_server"],
};

function counts(agreement = 0, representationGain = 0, confirmedConflict = 0, unknown = 0, unjoinable = 0): Record<CaptureH7MetricClassification, number> { return { agreement, representationGain, confirmedConflict, unknown, unjoinable }; }
function numberSet(values: unknown[]): Set<number> { return new Set(values.flatMap(value => Array.isArray(value) ? value : [value]).map(Number).filter(value => Number.isSafeInteger(value) && value > 0)); }
function values(dataset: { entities: any[] }, entityTypes: string[], fields: string[]): Set<number> { return numberSet(dataset.entities.filter(entity => entityTypes.includes(entity.entityType)).flatMap(entity => entity.facts.filter((fact: any) => fields.includes(fact.field)).map((fact: any) => fact.value))); }
function entityIds(dataset: { entities: any[] }, entityTypes: string[]): Set<number> { return numberSet(dataset.entities.filter(entity => entityTypes.includes(entity.entityType)).map(entity => entity.entityId)); }
function difference(left: Set<number>, right: Set<number>): number { return [...left].filter(value => !right.has(value)).length; }
function intersection(left: Set<number>, right: Set<number>): number { return [...left].filter(value => right.has(value)).length; }
function compareSets(left: Set<number>, right: Set<number>): Record<CaptureH7MetricClassification, number> { return counts(intersection(left, right), difference(left, right), 0, difference(right, left), 0); }
function comparison(key: string, left: string, right: string, unit: string, basis: string, value: Record<CaptureH7MetricClassification, number>, boundary: string, includedInTotals = true): CaptureH7Comparison { return { key, left, right, unit, basis, includedInTotals, counts: value, boundary }; }
function canonicalDatabasePath(value: string): string | null { if (!value || value.length > 2048 || /[?#\\%]/.test(value) || value.includes("..") || value.includes("//") || value.startsWith("http:" ) || value.startsWith("https:")) return null; return value.startsWith("/") ? value : `/${value}`; }

function priorS6Counts(input: Record<string, number>): Record<CaptureH7MetricClassification, number> { return counts(input.agreement ?? 0, input.representationGain ?? 0, input.confirmedConflict ?? 0, input.unknown ?? 0, input.unjoinable ?? 0); }
function priorE7Counts(values: string[]): Record<CaptureH7MetricClassification, number> {
    const result = counts();
    for (const value of values) {
        if (value === "agreement") result.agreement += 1;
        else if (value === "representation_gain") result.representationGain += 1;
        else if (value === "confirmed_conflict") result.confirmedConflict += 1;
        else if (value === "unknown") result.unknown += 1;
        else if (value === "unjoinable") result.unjoinable += 1;
    }
    return result;
}

function decisions(): CaptureH7Decision[] {
    return [
        { key: "merge_disabled_infrastructure", status: "GO", rationale: "The campaign is additive, optional, disabled by default, independently validated and makes no production mutation; this is readiness only and does not perform a merge.", exitCriteria: [] },
        { key: "local_sanitized_fixtures", status: "GO", rationale: "Validated schema-limited sidecars may be used as ignored local audit and test fixtures while provenance, partial status and secret scanning remain mandatory.", exitCriteria: [] },
        { key: "replace_schedules", status: "NO_GO", rationale: "Captured periods are time-bounded partial observations; total remote coverage, refresh semantics and production consumer parity are unproved.", exitCriteria: ["prove credential-safe refresh and server-time semantics", "measure total coverage across refreshes", "run consumer migration parity"] },
        { key: "replace_banners", status: "NO_GO", rationale: "The official capture and the community banner checkpoint have disjoint observed gasha IDs, and capture coverage and presentation completeness are unproved.", exitCriteria: ["obtain repeatable complete official banner inventory", "prove identity and presentation parity", "validate consumer migration"] },
        { key: "mission_reward_authority", status: "NO_GO", rationale: "H5 preserves board definitions and references only; progress, completion, reward contents, quantities, eligibility and grant semantics remain outside authority.", exitCriteria: ["prove definition-only mission schema", "prove reward identity and grant semantics without account state"] },
        { key: "asset_delivery", status: "NO_GO", rationale: "Observed references and captured 2xx/304 paths do not prove a complete manifest, current availability, byte identity, sizes or immutable caching.", exitCriteria: ["prove credential-safe manifest schema", "validate per-entry size and content hash", "establish cache and version semantics"] },
        { key: "r2_publication", status: "NO_GO", rationale: "Publication is outside this campaign and no publisher dry-run, projected bytes, stable-key plan or cache policy was authorized.", exitCriteria: ["explicit publication request", "publisher dry-run and byte projection", "R2 budget and cache review"] },
        { key: "android_shadow_mode", status: "NO_GO", rationale: "Android is unchanged and optional, missing, stale-cache and schema-compatibility behavior has not been integration tested.", exitCriteria: ["separate Android contract", "old-cache and missing-sidecar tests", "explicit Android authorization"] },
        { key: "remove_fyi_dokkaninfo", status: "NO_GO", rationale: "The captures are bounded audit samples, not a proven complete refresh source; existing community surfaces still cover unmatched or unjoinable data.", exitCriteria: ["prove official total coverage and sustainable collection", "reach structural and consumer parity", "define migration and rollback"] },
        { key: "future_authenticated_automation", status: "UNRESOLVED", rationale: "The captures prove sensitive request structure but do not prove a CI-safe refresh/auth flow; static x-apitoken or access_token use is not assumed appropriate.", exitCriteria: ["prove credential acquisition and refresh without personal state", "use ephemeral access tokens and fail closed", "complete security and legal review"] },
    ].sort((a, b) => a.key.localeCompare(b.key)) as CaptureH7Decision[];
}

export function buildCaptureH7(generatedAt: string, externalSourceLockSha256: string, input: CaptureH7CompactInputs, lineage: CaptureH7SourceLineage[], h3: CaptureH3Dataset, h4: CaptureH4Dataset, h5: CaptureH5Dataset, h6: CaptureH6Dataset): CaptureH7Dataset {
    const comparisons: CaptureH7Comparison[] = [];
    comparisons.push(comparison("prior_database_server_s6", "S0-S5", "database/server contracts", "comparison subject", "pinned S6 checkpoint; context only", priorS6Counts(input.s6Totals), "Preserved unchanged; not added to capture totals.", false));
    comparisons.push(comparison("prior_database_events_e7", "legacy scraper artifacts", "database-events E1-E6", "comparison record", "pinned E7 classification records; context only", priorE7Counts(input.e7Classifications), "Preserved unchanged; not added to capture totals.", false));

    const e1Z = numberSet(input.e1Identities.filter(value => value.kind === "z_battle_stage").map(value => value.id));
    const captureZ = entityIds(h3, ["z_battle", "super_z_battle", "event_key_z_battle"]);
    comparisons.push(comparison("capture_z_battle_identity_vs_e1", "H3 Z-Battle observations", "E1 z_battle_stage identities", "numeric stage identity", "exact numeric ID in the same structural domain", compareSets(captureZ, e1Z), "Unobserved E1 identities are unknown because captures are not a total inventory."));

    const eventKinds = new Set(["area", "chapter", "db_story_group", "origin_episode", "origin_series"]), byId = new Map<number, Set<string>>();
    for (const identity of input.e1Identities.filter(value => eventKinds.has(value.kind))) byId.set(identity.id, new Set([...(byId.get(identity.id) ?? []), identity.kind]));
    const captureEvents = entityIds(h3, ["event", "event_key_event"]); let eventAgreement = 0, eventGain = 0, eventUnjoinable = 0;
    for (const id of captureEvents) { const kinds = byId.get(id); if (!kinds) eventGain += 1; else if (kinds.size === 1) eventAgreement += 1; else eventUnjoinable += 1; }
    const eventUnknown = [...byId].filter(([id]) => !captureEvents.has(id)).reduce((sum, [, kinds]) => sum + kinds.size, 0);
    comparisons.push(comparison("capture_event_root_vs_e1_identity", "H3 event observations", "E1 candidate event-root identities", "numeric root identity", "numeric ID plus a unique E1 structural domain", counts(eventAgreement, eventGain, 0, eventUnknown, eventUnjoinable), "Numeric overlap across multiple E1 domains is unjoinable; titles and names are never used."));

    const captureQuestIds = values(h3, ["event", "event_key_event"], ["questIds"]), e2QuestIds = numberSet(input.e2QuestStageIds);
    comparisons.push(comparison("capture_quest_relation_vs_e2", "H3 event-to-quest references", "E2 quest_stage identities", "numeric quest identity", "exact numeric quest ID", compareSets(captureQuestIds, e2QuestIds), "E2 identities absent from captures remain unknown, not conflicts."));
    const scheduleCoordinates = new Set(h3.entities.flatMap(entity => entity.facts.filter(fact => ["startAt", "endAt", "weekdays", "weekdayStartAt", "weekdayEndAt"].includes(fact.field)).map(fact => `${entity.entityType}:${entity.entityId}:${fact.field}`)));
    comparisons.push(comparison("capture_dynamic_schedule_representation", "H3", "S1/E1 static or community schedule surfaces", "entity-field coordinate", "allowlisted official capture coordinate", counts(0, scheduleCoordinates.size), "Representation gain remains partial capture-time evidence and is not replacement authority."));

    comparisons.push(comparison("capture_rmbattle_root_vs_s2", "H3 rmbattle root", "S2 Ultimate Clash mission-referenced roots", "numeric root identity", "exact numeric ID within Ultimate Clash domain", compareSets(entityIds(h3, ["rmbattle"]), numberSet(input.s2UltimateClashIds)), "S2 roots are partial mission references; identity agreement does not prove runtime topology."));
    comparisons.push(comparison("capture_genkai_root_vs_s2", "H3 genkai root", "S2 Burst Mode root surface", "numeric root identity", "exact numeric ID within Burst Mode domain", compareSets(entityIds(h3, ["genkai_battle"]), numberSet(input.s2BurstModeIds)), "A capture-only root is a partial representation gain, not database identity authority."));

    const h4Gashas = entityIds(h4, ["gasha"]), s1Gashas = numberSet(input.s1GashaIds), commonGashas = new Set([...h4Gashas].filter(value => s1Gashas.has(value)));
    comparisons.push(comparison("capture_gasha_identity_vs_s1", "H4 official capture", "S1 community shadow", "numeric gasha identity", "exact numeric gasha ID", compareSets(h4Gashas, s1Gashas), "Disjoint observations do not prove either source incomplete or conflicting."));
    let periodAgreement = 0, periodConflict = 0, periodUnknown = 0;
    const h4ById = new Map(h4.entities.filter(entity => entity.entityType === "gasha").map(entity => [entity.entityId, entity]));
    for (const period of input.s1GashaPeriods.filter(value => commonGashas.has(value.id))) {
        const entity = h4ById.get(period.id)!;
        for (const [field, expected] of [["openAt", period.startAt], ["endAt", period.endAt]] as Array<[string, number]>) {
            const observed = [...new Set(entity.facts.filter(fact => fact.field === field && typeof fact.value === "number").map(fact => fact.value as number))];
            if (observed.length !== 1) periodUnknown += 1; else if (observed[0] === expected || observed[0] === expected * 1000) periodAgreement += 1; else periodConflict += 1;
        }
    }
    comparisons.push(comparison("capture_gasha_period_vs_s1", "H4 official open/end", "S1 community starts/ends", "gasha period boundary", "common numeric gasha ID plus normalized instant", counts(periodAgreement, 0, periodConflict, periodUnknown), "A conflict would be source-and-capture-time specific; zero conflict does not prove total or current banner coverage."));
    const h4FeaturedParents = new Set(h4.entities.filter(entity => entity.entityType === "gasha" && entity.facts.some(fact => fact.field === "featuredCardIds")).map(entity => entity.entityId));
    comparisons.push(comparison("capture_gasha_featured_relation", "H4 featured card_id relations", "S1 featured character relations", "parent gasha relation", "requires a common numeric gasha parent and a proved card/character ID-domain mapping", counts(0, 0, 0, 0, [...commonGashas].filter(value => h4FeaturedParents.has(value)).length), "Card IDs and community character IDs are not equated without an explicit first-party mapping."));

    const completionMissionIds = values(h5, ["mission_board_campaign", "mission_board"], ["campaignCompleteMissionId", "completeMissionId"]), e5MissionIds = numberSet(input.e5MissionIds);
    comparisons.push(comparison("capture_mission_completion_reference_vs_e5", "H5 completion-mission references", "E5 linked mission identities", "numeric mission identity", "exact numeric mission ID", compareSets(completionMissionIds, e5MissionIds), "Agreement proves identity only, never completion or reward eligibility."));
    comparisons.push(comparison("capture_mission_category_vs_e5", "H5 board category references", "E5 mission category identities", "numeric mission-category identity", "exact numeric category ID", compareSets(values(h5, ["mission_board"], ["missionCategoryId"]), numberSet(input.e5MissionCategoryIds)), "Category identity does not grant mission or reward authority."));
    const displayRewardIds = values(h5, ["mission_board"], ["displayRewardId"]);
    comparisons.push(comparison("capture_mission_display_reward_reference", "H5 display_reward_id", "E5 reward contracts", "numeric display-reward reference", "no proved target domain", counts(0, 0, 0, 0, displayRewardIds.size), "Display reward references are unjoinable to reward rows, contents, quantity or grant state."));

    const h6References = new Set(h6.observations.filter(value => value.referenceKind !== "captured_cdn_request").map(value => value.assetPath)), h6Cdn = new Set(h6.observations.filter(value => value.referenceKind === "captured_cdn_request").map(value => value.assetPath));
    const e6Paths = new Set(input.e6Paths.flatMap(value => { const path = canonicalDatabasePath(value); return path ? [path] : []; }));
    const refE6Agreement = [...h6References].filter(value => e6Paths.has(value)).length;
    comparisons.push(comparison("capture_asset_reference_vs_e6_path", "H6 sanitized references", "E6 database paths", "unique path", "exact bytes after adding one canonical leading slash to a safe E6 relative path", counts(refE6Agreement, h6References.size - refE6Agreement, 0, e6Paths.size - refE6Agreement), "The transparent leading-slash normalization proves reference identity only, not delivery bytes."));
    const deliveryAgreement = [...h6References].filter(value => h6Cdn.has(value)).length;
    comparisons.push(comparison("capture_asset_reference_vs_captured_cdn", "H6 JSON references", "H6 captured CDN requests", "unique sanitized path", "exact sanitized pathname", counts(deliveryAgreement, 0, 0, h6References.size - deliveryAgreement, h6Cdn.size - deliveryAgreement), "2xx and 304 remain capture-time evidence; unmatched paths do not prove absence."));
    const descriptorCount = new Set(h6.databaseDescriptors.map(value => JSON.stringify({ version: value.version, algorithm: value.algorithm, upstreamHashOpaque: value.upstreamHashOpaque, assetPath: value.assetPath }))).size;
    comparisons.push(comparison("capture_database_descriptor_vs_s4", "H6 client database descriptors", "S4 captured manifest evidence", "unique descriptor projection", "exact descriptor values exist only in H6", counts(0, descriptorCount, 0, input.s4CapturedManifestJoinCount), "The opaque upstream hash is not a locally verified content digest or manifest."));

    comparisons.sort((a, b) => a.key.localeCompare(b.key));
    const comparisonCellTotals = counts(); for (const item of comparisons.filter(value => value.includedInTotals)) for (const key of metricKeys) comparisonCellTotals[key] += item.counts[key];
    const dataset: CaptureH7Dataset = { schemaVersion: 1, contract: "dokkan-official-capture-shadow-readiness", contractVersion: "0.8.0", generatedAt, generatedAtPolicy: "latest_capture_timestamp_for_deterministic_bytes", collectionMode: "offline_pinned_artifact_comparison_no_requests", productionMutation: false, defaultEnabled: false, authority: "shadow_parity_only_zero_conflicts_does_not_prove_completeness", aggregationPolicy: "non_exclusive_sum_of_comparison_cells_units_may_overlap", externalSourceLockPath: "database-server-captures/capture-h7-source-lock.json", externalSourceLockSha256, sourceLineage: [...lineage].sort((a, b) => a.key.localeCompare(b.key)), comparisons, comparisonCellTotals, decisions: decisions() };
    const validation = validateCaptureH7(dataset); if (!validation.valid) throw new Error(`H7 validation failed: ${validation.failures.join(", ")}`);
    return dataset;
}

export function validateCaptureH7(dataset: CaptureH7Dataset): CaptureH7Validation {
    const failures: string[] = [];
    if (dataset.schemaVersion !== 1 || dataset.contract !== "dokkan-official-capture-shadow-readiness" || dataset.contractVersion !== "0.8.0" || dataset.generatedAtPolicy !== "latest_capture_timestamp_for_deterministic_bytes" || dataset.collectionMode !== "offline_pinned_artifact_comparison_no_requests" || Number.isNaN(Date.parse(dataset.generatedAt)) || dataset.productionMutation !== false || dataset.defaultEnabled !== false || dataset.authority !== "shadow_parity_only_zero_conflicts_does_not_prove_completeness" || dataset.aggregationPolicy !== "non_exclusive_sum_of_comparison_cells_units_may_overlap" || dataset.externalSourceLockPath !== "database-server-captures/capture-h7-source-lock.json" || !/^[a-f0-9]{64}$/.test(dataset.externalSourceLockSha256)) failures.push("dataset contract");
    if (JSON.stringify(dataset.sourceLineage.map(value => value.key).sort()) !== JSON.stringify(sourceKeys)) failures.push("source set");
    for (const source of dataset.sourceLineage) {
        const expected = sourceContracts[source.key];
        if (!expected || source.artifactContract !== expected[0] || source.artifactContractVersion !== expected[1] || source.sourceClass !== expected[2] || !/^[a-z0-9][a-z0-9_-]{0,31}$/.test(source.key) || !/^[A-Za-z0-9_.\/-]+$/.test(source.artifactPath) || source.artifactPath.includes("..") || !/^[a-f0-9]{64}$/.test(source.artifactSha256) || !Number.isSafeInteger(source.artifactSizeBytes) || source.artifactSizeBytes <= 0 || source.manifestSha256 !== null && !/^[a-f0-9]{64}$/.test(source.manifestSha256) || source.validationSha256 !== null && !/^[a-f0-9]{64}$/.test(source.validationSha256) || source.sourceClass === "capture_sidecar" !== (source.manifestPath === null && source.manifestSha256 === null && source.validationSha256 === null) || source.manifestPath !== null && (!/^[A-Za-z0-9_.\/-]+$/.test(source.manifestPath) || source.manifestPath.includes(".."))) failures.push("source lineage");
    }
    if (JSON.stringify(dataset.comparisons.map(value => value.key).sort()) !== JSON.stringify(comparisonKeys)) failures.push("comparison set");
    const recomputed = counts();
    for (const item of dataset.comparisons) {
        if (!/^[a-z0-9_]{1,80}$/.test(item.key) || typeof item.includedInTotals !== "boolean" || ![item.left, item.right, item.unit, item.basis, item.boundary].every(value => typeof value === "string" && value.length > 0 && value.length <= 512 && !/[\u0000-\u001f]/.test(value))) failures.push("comparison contract");
        for (const key of metricKeys) { if (!Number.isSafeInteger(item.counts[key]) || item.counts[key] < 0) failures.push("comparison count"); else if (item.includedInTotals) recomputed[key] += item.counts[key]; }
    }
    if (JSON.stringify(dataset.comparisonCellTotals) !== JSON.stringify(recomputed)) failures.push("comparison cell totals");
    if (JSON.stringify(dataset.decisions.map(value => value.key).sort()) !== JSON.stringify(decisionKeys)) failures.push("decision set");
    const expectedStatuses: Record<string, string> = { android_shadow_mode: "NO_GO", asset_delivery: "NO_GO", future_authenticated_automation: "UNRESOLVED", local_sanitized_fixtures: "GO", merge_disabled_infrastructure: "GO", mission_reward_authority: "NO_GO", r2_publication: "NO_GO", remove_fyi_dokkaninfo: "NO_GO", replace_banners: "NO_GO", replace_schedules: "NO_GO" };
    for (const decision of dataset.decisions) if (decision.status !== expectedStatuses[decision.key] || typeof decision.rationale !== "string" || decision.rationale.length === 0 || decision.rationale.length > 1024 || /[\u0000-\u001f]/.test(decision.rationale) || !Array.isArray(decision.exitCriteria) || !decision.exitCriteria.every(value => typeof value === "string" && value.length > 0 && value.length <= 256 && !/[\u0000-\u001f]/.test(value))) failures.push("decision policy");
    return { schemaVersion: 1, valid: failures.length === 0, sourceCount: dataset.sourceLineage.length, comparisonCount: dataset.comparisons.length, decisionCount: dataset.decisions.length, comparisonCellTotals: recomputed, failures: [...new Set(failures)] };
}
