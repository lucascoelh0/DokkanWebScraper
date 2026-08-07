import { createHash } from "crypto";
import { ServerS6CacheInput, ServerS6Classification, ServerS6Counts, ServerS6Dataset, ServerS6InputGate, ServerS6SourceLineage, ServerS6Subject, ServerS6Validation } from "./server-s6-contract";

const classifications = ["agreement", "representation_gain", "confirmed_conflict", "unknown", "unjoinable"] as const;
const subjectKeys: ServerS6Subject["key"][] = ["active_banner_cache_delta", "featured_character_identity", "official_featured_relationship", "current_schedule_authority", "maintenance_authority", "banner_commercial_semantics", "sbr_root_and_stage_identity", "ultimate_clash_root_identity", "world_tournament_current_schedule", "burst_mode_root_identity", "pettan_series_map_relation", "reward_row_identity", "asset_reference_delivery", "current_asset_manifest_version"];
const sourceKeys: ServerS6SourceLineage["key"][] = ["server_s1", "server_s2", "server_s3", "server_s4", "server_s5", "fyi_summons_implementation", "summons_index_cache", "summons_details_cache", "characters_manifest", "characters_payload"];
const allowedClassifications = new Map<ServerS6Subject["key"], ServerS6Classification[]>([
    ["active_banner_cache_delta", ["agreement", "representation_gain", "unknown"]],
    ["featured_character_identity", ["agreement", "representation_gain"]],
    ["official_featured_relationship", ["unknown"]],
    ["current_schedule_authority", ["unknown"]],
    ["maintenance_authority", ["unknown"]],
    ["banner_commercial_semantics", ["unknown"]],
    ["sbr_root_and_stage_identity", ["agreement"]],
    ["ultimate_clash_root_identity", ["unjoinable"]],
    ["world_tournament_current_schedule", ["unknown"]],
    ["burst_mode_root_identity", ["unjoinable"]],
    ["pettan_series_map_relation", ["unjoinable"]],
    ["reward_row_identity", ["unknown", "unjoinable"]],
    ["asset_reference_delivery", ["unjoinable"]],
    ["current_asset_manifest_version", ["unknown"]],
]);
const emptyCounts = (): ServerS6Counts => ({ agreement: 0, representationGain: 0, confirmedConflict: 0, unknown: 0, unjoinable: 0 });
const sortedUnique = (values: unknown[]) => [...new Set(values.map(String))].sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
const sumCounts = (counts: ServerS6Counts) => counts.agreement + counts.representationGain + counts.confirmedConflict + counts.unknown + counts.unjoinable;
const classificationCountKey = { agreement: "agreement", representation_gain: "representationGain", confirmed_conflict: "confirmedConflict", unknown: "unknown", unjoinable: "unjoinable" } as const;

function completeSubject(value: Omit<ServerS6Subject, "comparedCount" | "counts" | "identityMaterialization"> & { identities: ServerS6Subject["identities"] }): ServerS6Subject {
    const counts = emptyCounts();
    for (const classification of classifications) counts[classificationCountKey[classification]] = value.identities[classification]?.length ?? 0;
    return { ...value, comparedCount: sumCounts(counts), counts, identityMaterialization: "complete" };
}

function countedSubject(value: Omit<ServerS6Subject, "comparedCount" | "identityMaterialization" | "identities"> & { counts: ServerS6Counts }): ServerS6Subject {
    return { ...value, comparedCount: sumCounts(value.counts), identityMaterialization: "source_gate_only", identities: {} };
}

function gateLineage(input: ServerS6InputGate): ServerS6SourceLineage {
    return { key: `server_${input.gate}` as ServerS6SourceLineage["key"], path: input.path, contractVersion: input.contractVersion, sha256: input.sha256, sizeBytes: input.sizeBytes, authority: "validated_server_gate", generatedAt: input.generatedAt };
}

export function buildServerS6(inputs: { s1: ServerS6InputGate; s2: ServerS6InputGate; s3: ServerS6InputGate; s4: ServerS6InputGate; s5: ServerS6InputGate; cache: ServerS6CacheInput }): ServerS6Dataset {
    const { s1, s2, s3, s4, s5, cache } = inputs;
    if (s1.dataset.authority?.role !== "community_shadow_only" || s1.dataset.authority?.officialDynamicAuthorityCount !== 0 || s1.dataset.schedules?.length !== 0) throw new Error("S6 S1 authority boundary");
    if (!s2.dataset.identityPolicy?.structuralIdsOnly || s2.dataset.identityPolicy?.titleJoinAllowed !== false) throw new Error("S6 S2 identity boundary");
    if (s3.dataset.authorityPolicy?.legacyRewardIdentityOrigin !== "unknown_payload_id_or_synthetic_index" || s3.dataset.authorityPolicy?.normalizedRowsLossless !== false) throw new Error("S6 S3 reward boundary");
    if (s4.dataset.e6Projection?.remoteManifestJoinedReferenceCount !== 0 || s4.dataset.e6Projection?.status !== "unknown") throw new Error("S6 S4 delivery boundary");
    if (s5.dataset.defaultEnabled !== false || s5.dataset.productionMutation !== false) throw new Error("S6 S5 activation boundary");

    const currentBannerIds = sortedUnique(s1.dataset.banners.map((value: any) => value.identity.id)), oldBannerIds = sortedUnique(cache.existingBannerIds);
    const oldBannerSet = new Set(oldBannerIds), currentBannerSet = new Set(currentBannerIds);
    const featuredEntries = s1.dataset.banners.flatMap((banner: any) => banner.featuredCharacters.entries.map((entry: any) => ({ bannerId: String(banner.identity.id), ordinal: String(entry.ordinal), cardId: String(entry.payloadCharacterId ?? entry.entryCharacterId) })));
    const featuredCardIds = sortedUnique(featuredEntries.map((value: any) => value.cardId)), characterSet = new Set(cache.characterIds);
    const sbr = s2.dataset.families.find((value: any) => value.key === "super_battle_road"), clash = s2.dataset.families.find((value: any) => value.key === "ultimate_clash"), tournament = s2.dataset.families.find((value: any) => value.key === "world_tournament"), burst = s2.dataset.families.find((value: any) => value.key === "burst_mode"), pettan = s2.dataset.families.find((value: any) => value.key === "pettan_battle");
    const identitySet = (family: any, key: string) => sortedUnique(family.identitySets.find((value: any) => value.key === key)?.ids ?? []);
    const join = (family: any, key: string) => family.joins.find((value: any) => value.key === key);
    const rewardCounts = emptyCounts();
    for (const assessment of s3.dataset.assessments) assessment.classification === "partial_candidate" ? rewardCounts.unknown++ : assessment.classification === "unjoinable" ? rewardCounts.unjoinable++ : assessment.classification === "agreement" ? rewardCounts.agreement++ : rewardCounts.confirmedConflict++;

    const subjects: ServerS6Subject[] = [
        completeSubject({ key: "active_banner_cache_delta", unit: "banner_id", identities: { agreement: currentBannerIds.filter(id => oldBannerSet.has(id)), representation_gain: currentBannerIds.filter(id => !oldBannerSet.has(id)), unknown: oldBannerIds.filter(id => !currentBannerSet.has(id)) }, left: "S1 active FYI capture", right: "existing data/summons/latest cache", basis: "numeric gasha ID", boundary: "Old-only IDs are unknown temporal churn between active-only snapshots, never confirmed conflicts." }),
        completeSubject({ key: "featured_character_identity", unit: "card_id", identities: { agreement: featuredCardIds.filter(id => characterSet.has(id)), representation_gain: featuredCardIds.filter(id => !characterSet.has(id)) }, left: "S1 unique featured payload card IDs", right: "existing character scraper cache", basis: "numeric card ID", boundary: "Representation gain is relative to the cached scraper dataset and does not prove official featured-relation authority." }),
        completeSubject({ key: "official_featured_relationship", unit: "featured_relation", identities: { unknown: featuredEntries.map((value: any) => `${value.bannerId}:${value.ordinal}:${value.cardId}`) }, left: "S1 community banner detail", right: "official gasha relation", basis: "banner ID + ordinal + card ID", boundary: "Card existence does not promote a community featured relation to official authority." }),
        completeSubject({ key: "current_schedule_authority", unit: "dimension", identities: { unknown: ["current_schedule"] }, left: "S1 structured collection", right: "official current server schedule", basis: "authority dimension", boundary: "No credential-free official schedule payload was collected." }),
        completeSubject({ key: "maintenance_authority", unit: "dimension", identities: { unknown: ["maintenance"] }, left: "S1 structured collection", right: "official current maintenance state", basis: "authority dimension", boundary: "No credential-free structured maintenance source was found." }),
        completeSubject({ key: "banner_commercial_semantics", unit: "banner_id", identities: { unknown: currentBannerIds }, left: "S1 category membership", right: "official currency, ticket, step and rate semantics", basis: "numeric gasha ID", boundary: "Query-filter membership is not currency or probability authority." }),
        completeSubject({ key: "sbr_root_and_stage_identity", unit: "root_or_stage_id", identities: { agreement: sortedUnique([...identitySet(sbr, "sbr_shadow_challenge_roots"), ...identitySet(sbr, "sbr_shadow_stage_roots")]) }, left: "DokkanInfo challenge cache", right: "SQLite areas and quest levels", basis: "numeric root and stage IDs", boundary: "Titles are presentation only; all 177 identities join structurally." }),
        completeSubject({ key: "ultimate_clash_root_identity", unit: "root_candidate_id", identities: { unjoinable: identitySet(clash, "rmbattle_mission_refs") }, left: "SQLite rmbattle mission references", right: "missing root records", basis: "numeric rmbattle candidate ID", boundary: "Mission references do not synthesize server root records." }),
        completeSubject({ key: "world_tournament_current_schedule", unit: "root_id", identities: { unknown: identitySet(tournament, "budokai_database_roots") }, left: "SQLite budokai roots", right: "current server schedule", basis: "numeric budokai root ID", boundary: "Static roots exist, but current availability is unknown." }),
        countedSubject({ key: "burst_mode_root_identity", unit: "candidate_row", counts: { ...emptyCounts(), unjoinable: join(burst, "genkai_score_root_join").unmatchedCount }, left: "SQLite score/gimmick candidate tables", right: "missing Burst root FK", basis: "source-gate row accounting", boundary: "Semantic proximity cannot create a root join." }),
        completeSubject({ key: "pettan_series_map_relation", unit: "series_id", identities: { unjoinable: identitySet(pettan, "pettan_shadow_series") }, left: "DokkanInfo Pettan series", right: "SQLite sd_map namespace", basis: "separate numeric namespaces", boundary: "Overlapping numbers do not establish a series-to-map relation." }),
        countedSubject({ key: "reward_row_identity", unit: "reward_row", counts: rewardCounts, left: "normalized DokkanInfo reward rows", right: "SQLite reward rows", basis: "S3 structural candidate policy", boundary: "Partial candidates map to unknown because legacy reward-number origin is not preserved; no apparent mismatch is a confirmed conflict." }),
        countedSubject({ key: "asset_reference_delivery", unit: "asset_reference", counts: { ...emptyCounts(), unjoinable: s4.dataset.e6Projection.unresolvedDeliveryReferenceCount }, left: "E6 asset references", right: "uncaptured delivery manifest", basis: "S4 exact unresolved-reference accounting", boundary: "Filename templates and container literals do not prove delivery joins." }),
        completeSubject({ key: "current_asset_manifest_version", unit: "dimension", identities: { unknown: ["current_asset_manifest_and_version"] }, left: "official static client literals", right: "current delivery manifest/version", basis: "authority dimension", boundary: "No credential-free size-bearing manifest was captured." }),
    ];
    const totals = emptyCounts(); for (const subject of subjects) for (const key of Object.keys(totals) as Array<keyof ServerS6Counts>) totals[key] += subject.counts[key];
    const generatedAt = [s1.generatedAt, s2.generatedAt, s3.generatedAt, s4.generatedAt, s5.generatedAt, cache.generatedAt].sort().at(-1)!;
    return { schemaVersion: 1, contract: "dokkan-server-shadow-parity", contractVersion: "0.7.0", generatedAt, generatedAtPolicy: "latest_input_derivation_time", collectionMode: "validated_local_artifacts_no_network", sourceLineage: [gateLineage(s1), gateLineage(s2), gateLineage(s3), gateLineage(s4), gateLineage(s5), ...cache.sourceLineage], subjects, totals: { ...totals, comparedCount: sumCounts(totals), subjectCount: 14 }, completeness: { proven: false, zeroConfirmedConflictsImpliesCompleteness: false, unknownOrUnjoinableCount: totals.unknown + totals.unjoinable, boundary: "Zero confirmed conflicts is compatible with incomplete, temporally mismatched and unjoinable evidence." } };
}

export function validateServerS6(dataset: ServerS6Dataset): ServerS6Validation {
    const failures: string[] = [], exactSubjects = dataset.subjects.length === subjectKeys.length && new Set(dataset.subjects.map(value => value.key)).size === subjectKeys.length && subjectKeys.every(key => dataset.subjects.some(value => value.key === key));
    let exclusiveClassifications = exactSubjects, exactAccounting = exactSubjects;
    for (const subject of dataset.subjects) {
        if (Object.values(subject.counts).some(value => !Number.isSafeInteger(value) || value < 0) || sumCounts(subject.counts) !== subject.comparedCount) exactAccounting = false;
        const materialized = classifications.flatMap(value => subject.identities[value] ?? []), unique = new Set(materialized);
        if (unique.size !== materialized.length) exclusiveClassifications = false;
        if (subject.identityMaterialization === "complete") {
            if (materialized.length !== subject.comparedCount) exactAccounting = false;
            for (const classification of classifications) if ((subject.identities[classification]?.length ?? 0) !== subject.counts[classificationCountKey[classification]]) exactAccounting = false;
        } else if (materialized.length !== 0) exactAccounting = false;
    }
    const recomputed = emptyCounts(); for (const subject of dataset.subjects) for (const key of Object.keys(recomputed) as Array<keyof ServerS6Counts>) recomputed[key] += subject.counts[key];
    if (JSON.stringify(recomputed) !== JSON.stringify({ agreement: dataset.totals.agreement, representationGain: dataset.totals.representationGain, confirmedConflict: dataset.totals.confirmedConflict, unknown: dataset.totals.unknown, unjoinable: dataset.totals.unjoinable }) || sumCounts(recomputed) !== dataset.totals.comparedCount || dataset.totals.subjectCount !== 14) exactAccounting = false;
    const expectedGateVersions = new Map<ServerS6SourceLineage["key"], string>([["server_s1", "0.2.0"], ["server_s2", "0.3.0"], ["server_s3", "0.4.0"], ["server_s4", "0.5.0"], ["server_s5", "0.6.0"]]);
    const sourceLineageComplete = dataset.sourceLineage.length === sourceKeys.length && new Set(dataset.sourceLineage.map(value => value.key)).size === sourceKeys.length && sourceKeys.every(key => dataset.sourceLineage.some(value => value.key === key)) && dataset.sourceLineage.every(value => /^[a-f0-9]{64}$/.test(value.sha256) && Number.isSafeInteger(value.sizeBytes) && value.sizeBytes > 0 && (expectedGateVersions.has(value.key) ? value.authority === "validated_server_gate" && value.contractVersion === expectedGateVersions.get(value.key) : value.key === "fyi_summons_implementation" ? value.authority === "repository_implementation" && value.contractVersion === null : value.authority === "existing_community_cache" && value.contractVersion === null));
    const classificationPolicyPreserved = dataset.subjects.every(subject => classifications.every(classification => allowedClassifications.get(subject.key)?.includes(classification) || subject.counts[classificationCountKey[classification]] === 0));
    const sqliteAuthorityPreserved = dataset.subjects.find(value => value.key === "sbr_root_and_stage_identity")?.counts.agreement === 177 && dataset.subjects.find(value => value.key === "reward_row_identity")?.counts.confirmedConflict === 0 && dataset.subjects.find(value => value.key === "official_featured_relationship")?.counts.agreement === 0 && classificationPolicyPreserved;
    const zeroConflictNotCompleteness = dataset.totals.confirmedConflict === 0 && dataset.completeness.proven === false && dataset.completeness.zeroConfirmedConflictsImpliesCompleteness === false && dataset.completeness.unknownOrUnjoinableCount === dataset.totals.unknown + dataset.totals.unjoinable && dataset.completeness.unknownOrUnjoinableCount > 0;
    if (!exclusiveClassifications) failures.push("exclusive classifications"); if (!exactAccounting) failures.push("exact accounting"); if (!sourceLineageComplete) failures.push("source lineage"); if (!classificationPolicyPreserved) failures.push("classification policy"); if (!sqliteAuthorityPreserved) failures.push("SQLite authority"); if (!zeroConflictNotCompleteness) failures.push("zero-conflict completeness boundary");
    if (dataset.schemaVersion !== 1 || dataset.contract !== "dokkan-server-shadow-parity" || dataset.contractVersion !== "0.7.0" || dataset.generatedAtPolicy !== "latest_input_derivation_time" || dataset.collectionMode !== "validated_local_artifacts_no_network") failures.push("dataset contract");
    return { schemaVersion: 1, valid: failures.length === 0, deterministic: true, exclusiveClassifications, exactAccounting, sourceLineageComplete, sqliteAuthorityPreserved, classificationPolicyPreserved, zeroConflictNotCompleteness, failures };
}

export function sourceLineageAggregateSha256(lineage: ServerS6SourceLineage[]): string {
    return createHash("sha256").update(lineage.map(value => `${value.key}:${value.path}:${value.contractVersion ?? "none"}:${value.sha256}:${value.sizeBytes}:${value.authority}:${value.generatedAt ?? "none"}`).join("\n")).digest("hex");
}
