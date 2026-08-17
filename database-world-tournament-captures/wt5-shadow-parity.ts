import { createHash } from "crypto";
import { Wt2Dataset } from "./wt2-contract";
import { Wt3Dataset } from "./wt3-contract";
import { Wt4Dataset } from "./wt4-contract";
import { Wt5Comparison, Wt5ComparisonStatus, Wt5Dataset, Wt5Sources, Wt5Validation } from "./wt5-contract";

const sha256 = (value: string): string => createHash("sha256").update(value).digest("hex");
const totals = (): Record<Wt5ComparisonStatus, number> => ({ agreement: 0, coverage_gap: 0, unknown: 0, unjoinable: 0 });
const numeric = (value: unknown): number | null => typeof value === "number" && Number.isSafeInteger(value) ? value : typeof value === "string" && /^\d+$/.test(value) ? Number(value) : null;
const hasId = (values: unknown[], id: number): boolean => values.some(value => numeric(value) === id);
export function parentedStructuralMatches(rows: unknown[], idKey: "missionId" | "boxRankingId" | "mapId", ids: number[], budokaiId: number): number { return rows.filter((row: any) => ids.includes(numeric(row?.[idKey]) ?? -1) && numeric(row?.budokaiId) === budokaiId).length; }

function comparison(key: string, left: string, right: string, joinKey: string | null, structuralIds: number[], classification: Wt5Comparison["classification"], status: Wt5ComparisonStatus, matchedCount: number, boundary: string): Wt5Comparison {
    return { key, left, right, joinKey, structuralIds, classification, status, matchedCount, boundary };
}

export function rewardDefinitionBoundary(missionId: number, missionObserved: boolean, boxRankingId: number, boxObserved: boolean): Wt5Dataset["rewards"]["definitions"] {
    const observedCount = Number(missionObserved) + Number(boxObserved);
    return { status: observedCount > 0 ? "observed_definition" : "coverage_gap", coordinates: [{ kind: "budokai_mission", id: missionId }, { kind: "budokai_box_ranking", id: boxRankingId }], observedCount };
}

export function buildWt5(wt2: Wt2Dataset, wt2Text: string, wt3: Wt3Dataset, wt3Text: string, wt4: Wt4Dataset, wt4Text: string, lockText: string, sources: Wt5Sources): Wt5Dataset {
    const eventId = wt2.budokai.identity.id, mapIds = wt2.budokai.maps.ids, boxIds = wt3.boxRanking.boxRankingIds, scheduleIds = wt3.bonusSchedules.scheduleIds, missionIds = wt4.missionRelations.map(value => value.missionId);
    if (![eventId, ...mapIds, ...boxIds, ...scheduleIds, ...missionIds].every(Number.isSafeInteger) || mapIds.length === 0 || boxIds.length === 0 || scheduleIds.length === 0 || missionIds.length === 0 || [mapIds, boxIds, scheduleIds, missionIds].some(values => new Set(values).size !== values.length)) throw new Error("WT5 structural coordinates invalid");
    const e1 = sources.files.get("e1_payload"), e5 = sources.files.get("e5_payload"), s2 = sources.files.get("s2_payload"), h3 = sources.files.get("h3_payload");
    const e1Event = e1.catalog.some((value: any) => value.identity?.kind === "budokai" && numeric(value.identity.id) === eventId);
    const e1Lifecycle = e1.availabilityHints.some((value: any) => value.identity?.entityKind === "budokai" && numeric(value.identity.entityId) === eventId);
    const s2Family = s2.families.find((value: any) => value.key === "world_tournament"), s2Event = s2Family?.identitySets?.some((set: any) => set.kind === "budokai" && hasId(set.ids ?? [], eventId)) === true;
    const sqliteEvent = hasId(sources.sqlite.budokaiIds, eventId);
    const h3Event = h3.entities.some((value: any) => value.entityType === "budokai" && numeric(value.entityId) === eventId);
    const eventMatches = [e1Event, s2Event, sqliteEvent, h3Event].filter(Boolean).length;
    const e5MissionCount = parentedStructuralMatches(e5.budokai.missions, "missionId", missionIds, eventId), sqliteMissionCount = parentedStructuralMatches(sources.sqlite.missionLinks, "missionId", missionIds, eventId);
    const e5BoxCount = parentedStructuralMatches(e5.budokai.boxRankings, "boxRankingId", boxIds, eventId), sqliteBoxCount = parentedStructuralMatches(sources.sqlite.boxRankingLinks, "boxRankingId", boxIds, eventId), sqliteMapCount = parentedStructuralMatches(sources.sqlite.mapLinks, "mapId", mapIds, eventId);
    const definitions = rewardDefinitionBoundary(missionIds[0], e5MissionCount + sqliteMissionCount > 0, boxIds[0], e5BoxCount + sqliteBoxCount > 0);
    const scheduleMatches = scheduleIds.filter(id => h3.entities.some((value: any) => value.entityType === "bonus_schedule" && numeric(value.entityId) === id)).length;
    const comparisons: Wt5Comparison[] = [
        comparison("event_identity", "WT2 budokai", "E1/S2/H3/SQLite", "budokai.id", [eventId], "global", eventMatches > 0 ? "agreement" : "coverage_gap", eventMatches, "Absence in older pinned sources is a coverage gap, never a conflict; titles and descriptions are not join keys."),
        comparison("event_lifecycle", "WT2 lifecycle schema", "E1/H3 lifecycle coordinates", "budokai.id", [eventId], "partial", e1Lifecycle || h3Event ? "unknown" : "coverage_gap", Number(e1Lifecycle) + Number(h3Event), "WT2 retains field schemas but no timestamp values, so lifecycle value parity cannot be claimed."),
        comparison("budokai_maps", "WT2 runtime map identities", "SQLite structural tables", sources.sqlite.tablePresence.budokai_maps ? "budokai_maps.id" : null, mapIds, "unjoinable", sources.sqlite.tablePresence.budokai_maps ? "unknown" : "unjoinable", sqliteMapCount, "Numeric overlap across structural namespaces is isolated and never joined automatically."),
        comparison("rank_definitions", "WT2 rank definition schema", "E0-E9/S0-S7/SQLite", null, [], "unjoinable", "unjoinable", 0, "No comparable pinned structural rank-definition surface exists."),
        comparison("general_ranking", "WT3 ranking schema/pagination/updated_at", "E/H/S/SQLite", null, [], "account_scoped", "unjoinable", 0, "Ranker rows, personal rank and pagination values are excluded from shadow joins."),
        comparison("ranking_borders_my_ranking", "WT3 borders and my_ranking schema", "E/H/S/SQLite", null, [], "account_scoped", "unjoinable", 0, "Personal ranking state is schema-only and has no structural global join."),
        comparison("ranking_friends", "WT3 friends ranking schema", "E/H/S/SQLite", null, [], "account_scoped", "unjoinable", 0, "Friend identities, names, points and ranks are never retained or joined."),
        comparison("box_ranking", "WT3 box ranking identity", "E5/SQLite", "budokai_box_rankings.id", boxIds, "partial", e5BoxCount + sqliteBoxCount > 0 ? "unknown" : "coverage_gap", e5BoxCount + sqliteBoxCount, "Pinned database snapshot has no matching identity; no runtime status semantics are inferred."),
        comparison("bonus_schedules", "WT3 bonus schedule identity", "H3", "bonus_schedule.id", scheduleIds, "global", scheduleMatches === scheduleIds.length ? "agreement" : "coverage_gap", scheduleMatches, "Agreement is identity-only; temporal and rate values are not imported into the WT fixture."),
        comparison("mission_relation", "WT4 next mission identity", "E5/SQLite", "budokai_missions.id", missionIds, "account_scoped", e5MissionCount + sqliteMissionCount > 0 ? "unknown" : "coverage_gap", e5MissionCount + sqliteMissionCount, "Account observation supplies an ID only; absent definition is a coverage gap and not a granted reward."),
        comparison("briefing_supporters_advantageous", "WT4 briefing schema", "E/H/S/SQLite", null, wt4.briefing.questIds, "unjoinable", "unjoinable", 0, "Supporters, deck and advantageous-card values were intentionally omitted; schema paths alone cannot be joined."),
        comparison("opaque_start", "WT4 POST envelope schema", "E/H/S/SQLite", null, [eventId], "opaque", "unjoinable", 0, "HTTP 200 and temporal order do not decode sign, prove replay, battle result, finish, or crash causality."),
        comparison("global_event_status", "WT2 explicit unknown", "E/H/S/SQLite", null, [eventId], "unknown", "unknown", 0, "Account-scoped budokai_status is not promoted to global lifecycle status."),
    ].sort((left, right) => left.key.localeCompare(right.key));
    const counts = totals(); for (const value of comparisons) counts[value.status]++;
    const upstream = [
        { key: "WT2", value: wt2, text: wt2Text },
        { key: "WT3", value: wt3, text: wt3Text },
        { key: "WT4", value: wt4, text: wt4Text },
    ].map(value => ({ key: value.key, sourceKind: "wt_gate" as const, contractVersion: value.value.contractVersion, sizeBytes: Buffer.byteLength(value.text), sha256: sha256(value.text) }));
    const dataset: Wt5Dataset = {
        schemaVersion: 1,
        contract: "dokkan-world-tournament-shadow-parity",
        contractVersion: "0.6.0",
        collectionMode: "offline_pinned_structural_ids_only_no_requests",
        productionMutation: false,
        defaultEnabled: false,
        identityPolicy: "numeric_structural_ids_only_names_and_texts_never_identity",
        sourceLockSha256: sha256(lockText),
        lineage: [...upstream, ...sources.lineage].sort((left, right) => left.key.localeCompare(right.key)),
        sourceCoverage: [
            { series: "E0-E9", status: "via_pinned_closure", boundary: "E9 closure plus direct E1 and E5 structural projections." },
            { series: "H0-H13", status: "via_pinned_closure", boundary: "H12/H13 closure plus direct H3 schedule identity; account data is never imported." },
            { series: "S0-S7", status: "via_pinned_closure", boundary: "S7 closure plus direct S2 World Tournament root set." },
            { series: "SQLite", status: "direct_and_pinned", boundary: "Read-only URI, query_only, structural numeric columns only, before/after SHA-256 unchanged." },
        ],
        comparisons,
        rewards: {
            definitions,
            granted: { status: "unknown", observed: false, boundary: "no_reward_grant_or_claim_observed" },
        },
        totals: counts,
    };
    const validation = validateWt5(dataset);
    if (!validation.valid) throw new Error(`WT5 validation failed: ${validation.failures.join(", ")}`);
    return dataset;
}

export function validateWt5(dataset: Wt5Dataset): Wt5Validation {
    const failures: string[] = [], counts = totals(), allowedKeys = ["bonus_schedules","box_ranking","briefing_supporters_advantageous","budokai_maps","event_identity","event_lifecycle","general_ranking","global_event_status","mission_relation","opaque_start","rank_definitions","ranking_borders_my_ranking","ranking_friends"];
    if (dataset.schemaVersion !== 1 || dataset.contract !== "dokkan-world-tournament-shadow-parity" || dataset.contractVersion !== "0.6.0" || dataset.collectionMode !== "offline_pinned_structural_ids_only_no_requests" || dataset.productionMutation || dataset.defaultEnabled || dataset.identityPolicy !== "numeric_structural_ids_only_names_and_texts_never_identity" || !/^[a-f0-9]{64}$/.test(dataset.sourceLockSha256)) failures.push("contract");
    if (JSON.stringify(dataset.sourceCoverage.map(value => value.series)) !== JSON.stringify(["E0-E9","H0-H13","S0-S7","SQLite"]) || dataset.sourceCoverage.some(value => !value.boundary || (value.series === "SQLite" ? value.status !== "direct_and_pinned" : value.status !== "via_pinned_closure"))) failures.push("source coverage");
    if (JSON.stringify(dataset.comparisons.map(value => value.key)) !== JSON.stringify(allowedKeys)) failures.push("comparison keys");
    const fixed = new Map<string, Wt5ComparisonStatus>([["briefing_supporters_advantageous","unjoinable"],["general_ranking","unjoinable"],["global_event_status","unknown"],["opaque_start","unjoinable"],["rank_definitions","unjoinable"],["ranking_borders_my_ranking","unjoinable"],["ranking_friends","unjoinable"]]);
    for (const value of dataset.comparisons) {
        counts[value.status]++;
        const expected = value.key === "event_identity" ? (value.matchedCount > 0 ? "agreement" : "coverage_gap") : value.key === "event_lifecycle" || value.key === "box_ranking" || value.key === "mission_relation" ? (value.matchedCount > 0 ? "unknown" : "coverage_gap") : value.key === "budokai_maps" ? (value.joinKey === null ? "unjoinable" : "unknown") : value.key === "bonus_schedules" ? (value.structuralIds.length > 0 && value.matchedCount === value.structuralIds.length ? "agreement" : "coverage_gap") : fixed.get(value.key);
        if (value.status !== expected || !value.boundary || value.structuralIds.some(id => !Number.isSafeInteger(id) || id < 0) || new Set(value.structuralIds).size !== value.structuralIds.length || !Number.isSafeInteger(value.matchedCount) || value.matchedCount < 0) failures.push("comparison policy");
        if ((value.status === "agreement" && value.matchedCount === 0) || (value.status === "coverage_gap" && value.matchedCount !== 0 && value.key !== "bonus_schedules") || (value.status === "unjoinable" && value.matchedCount !== 0) || (fixed.get(value.key) === "unknown" && value.matchedCount !== 0)) failures.push("comparison evidence");
        if (value.joinKey !== null && !/^[a-z_]+\.(?:id)$/.test(value.joinKey)) failures.push("join key policy");
    }
    if (JSON.stringify(counts) !== JSON.stringify(dataset.totals)) failures.push("totals");
    const lineageKeys = dataset.lineage.map(value => value.key);
    if (new Set(lineageKeys).size !== lineageKeys.length || !["WT2","WT3","WT4","e1_payload","e5_payload","e9_payload","s2_payload","s7_payload","h3_payload","h12_payload","h13_payload","sqlite"].every(key => lineageKeys.includes(key)) || dataset.lineage.some(value => !value.contractVersion || !Number.isSafeInteger(value.sizeBytes) || value.sizeBytes <= 0 || !/^[a-f0-9]{64}$/.test(value.sha256))) failures.push("lineage");
    const missionComparison = dataset.comparisons.find(value => value.key === "mission_relation")!, boxComparison = dataset.comparisons.find(value => value.key === "box_ranking")!, missionObserved = missionComparison.matchedCount > 0, boxObserved = boxComparison.matchedCount > 0, expectedDefinitions = missionComparison.structuralIds.length === 1 && boxComparison.structuralIds.length === 1 ? rewardDefinitionBoundary(missionComparison.structuralIds[0], missionObserved, boxComparison.structuralIds[0], boxObserved) : null;
    if (JSON.stringify(dataset.rewards.definitions) !== JSON.stringify(expectedDefinitions) || dataset.rewards.granted.status !== "unknown" || dataset.rewards.granted.observed || dataset.rewards.granted.boundary !== "no_reward_grant_or_claim_observed") failures.push("reward boundary");
    return { schemaVersion: 1, valid: failures.length === 0, failures: [...new Set(failures)], comparisonCount: dataset.comparisons.length, totals: counts };
}
