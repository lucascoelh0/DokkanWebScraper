import { createHash } from "crypto";
import { Wt0Dataset, WtEvidenceClass } from "./wt0-contract";
import { validateWt0 } from "./wt0-audit";
import { Wt1Dataset } from "./wt1-contract";
import { validateWt1 } from "./wt1-catalog";
import { Wt3Dataset, Wt3Field, Wt3Surface, Wt3Validation } from "./wt3-contract";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const ROUTES = ["/budokais/:budokai_id/rankings", "/budokais/:budokai_id/rankings/borders", "/budokais/:budokai_id/rankings/friends", "/budokais/:budokai_id/box_rankings/:box_ranking_id", "/bonus_schedules"];
function scope(route: string, path: string): WtEvidenceClass {
    if (route.endsWith("/rankings")) return path.startsWith("$.rankers") ? "account_scoped" : "global";
    if (route.endsWith("/rankings/borders")) return path.startsWith("$.rankers") || path.startsWith("$.my_ranking") ? "account_scoped" : path === "$.point" ? "partial" : "global";
    if (route.endsWith("/rankings/friends")) return "account_scoped";
    if (route.includes("/box_rankings/")) return "partial";
    return "global";
}
function surface(wt1: Wt1Dataset, path: string): Wt3Surface {
    const route = wt1.routes.find(value => value.method === "GET" && value.route === path); if (!route) throw new Error(`WT3 missing ${path}`);
    const fields: Wt3Field[] = route.responseSchema.map(value => ({ path: value.path, types: value.types, typeOccurrences: value.typeOccurrences, classification: scope(path, value.path), valueRetention: "omitted_schema_only" }));
    return { route: path, classification: scope(path, "$"), fields, sourceSchemaSha256: hash(JSON.stringify(route.responseSchema)) };
}
export function buildWt3(wt0: Wt0Dataset, wt0Text: string, wt1: Wt1Dataset, wt1Text: string): Wt3Dataset {
    const lock = { ...wt0.source, fileName: "world_tournament_until_start_crash.har" as const };
    if (`${JSON.stringify(wt0, null, 2)}\n` !== wt0Text || `${JSON.stringify(wt1, null, 2)}\n` !== wt1Text || !validateWt0(wt0, lock).valid || !validateWt1(wt1).valid || wt1.source.sha256 !== hash(wt0Text) || wt1.source.sizeBytes !== Buffer.byteLength(wt0Text)) throw new Error("WT3 upstream mismatch");
    const general = surface(wt1, ROUTES[0]), borders = surface(wt1, ROUTES[1]), friends = surface(wt1, ROUTES[2]), box = surface(wt1, ROUTES[3]), schedules = surface(wt1, ROUTES[4]);
    const ids = (kind: string) => [...new Set(wt0.structuralIds.filter(value => value.kind === kind).map(value => value.id))].sort((a, b) => a - b);
    const rewardPaths = [...new Set(wt1.routes.filter(value => value.method === "GET" && (ROUTES.includes(value.route) || value.route === "/budokais/:budokai_id/ranks")).flatMap(value => value.responseSchema.map(node => node.path).filter(path => /reward/i.test(path))))].sort();
    const dataset: Wt3Dataset = { schemaVersion: 1, contract: "dokkan-world-tournament-rankings-box-schedules", contractVersion: "0.4.0", lineage: [{ gate: "WT0", contractVersion: wt0.contractVersion, sizeBytes: Buffer.byteLength(wt0Text), sha256: hash(wt0Text) }, { gate: "WT1", contractVersion: wt1.contractVersion, sizeBytes: Buffer.byteLength(wt1Text), sha256: hash(wt1Text) }], generalRanking: { ...general, paginationPaths: ["$.current_page", "$.per_page", "$.total_page"], updatedAtPath: "$.updated_at" }, rankingBorders: { ...borders, myRankingPath: "$.my_ranking", updatedAtPath: "$.updated_at" }, rankingFriends: friends, boxRanking: { ...box, boxRankingIds: ids("box_ranking"), statusSemantics: "partial" }, bonusSchedules: { ...schedules, scheduleIds: ids("bonus_schedule") }, rewards: { observedSchemaPaths: rewardPaths, definitionsObserved: rewardPaths.length > 0, grantedOrClaimedObserved: false, boundary: "no_ranking_reward_definition_or_grant_response_observed" } };
    const validation = validateWt3(dataset); if (!validation.valid) throw new Error(`WT3 validation failed: ${validation.failures.join(", ")}`); return dataset;
}
export function validateWt3(dataset: Wt3Dataset): Wt3Validation {
    const failures: string[] = [], surfaces = [dataset.generalRanking, dataset.rankingBorders, dataset.rankingFriends, dataset.boxRanking, dataset.bonusSchedules], types = new Set(["array", "boolean", "null", "number", "object", "string"]), has = (surface: Wt3Surface, path: string) => surface.fields.some(value => value.path === path);
    if (dataset.schemaVersion !== 1 || dataset.contract !== "dokkan-world-tournament-rankings-box-schedules" || dataset.contractVersion !== "0.4.0" || JSON.stringify(dataset.lineage.map(value => [value.gate, value.contractVersion])) !== JSON.stringify([["WT0", "0.1.0"], ["WT1", "0.2.0"]]) || dataset.lineage.some(value => !Number.isSafeInteger(value.sizeBytes) || value.sizeBytes <= 0 || !/^[a-f0-9]{64}$/.test(value.sha256))) failures.push("contract/lineage");
    const invalidProjection = JSON.stringify(surfaces.map(value => value.route)) !== JSON.stringify(ROUTES) || surfaces.some(value => {
        const reconstructed = value.fields.map(field => ({ path: field.path, types: field.types, observedEntryIndexes: [...new Set(field.typeOccurrences.flatMap(item => item.observedEntryIndexes))].sort((a, b) => a - b), typeOccurrences: field.typeOccurrences }));
        return value.classification !== scope(value.route, "$") || value.fields.length === 0 || value.sourceSchemaSha256 !== hash(JSON.stringify(reconstructed)) || value.fields.some(field => { const occurrenceTypes = field.typeOccurrences.map(item => item.type).sort(); return field.valueRetention !== "omitted_schema_only" || !field.path.startsWith("$") || field.types.length === 0 || new Set(field.types).size !== field.types.length || field.types.some(type => !types.has(type)) || field.classification !== scope(value.route, field.path) || JSON.stringify(occurrenceTypes) !== JSON.stringify([...field.types].sort()) || field.typeOccurrences.some(item => !types.has(item.type) || item.observedEntryIndexes.length === 0 || new Set(item.observedEntryIndexes).size !== item.observedEntryIndexes.length || item.observedEntryIndexes.some(index => !Number.isSafeInteger(index) || index < 0)); });
    });
    if (invalidProjection) failures.push("lossless field projection");
    if (JSON.stringify(dataset.generalRanking.paginationPaths) !== JSON.stringify(["$.current_page", "$.per_page", "$.total_page"]) || dataset.generalRanking.paginationPaths.some(path => !has(dataset.generalRanking, path)) || dataset.generalRanking.updatedAtPath !== "$.updated_at" || !has(dataset.generalRanking, "$.updated_at") || dataset.rankingBorders.myRankingPath !== "$.my_ranking" || !has(dataset.rankingBorders, "$.my_ranking") || dataset.rankingBorders.updatedAtPath !== "$.updated_at" || !has(dataset.rankingBorders, "$.updated_at")) failures.push("ranking metadata");
    if (dataset.boxRanking.statusSemantics !== "partial" || !has(dataset.boxRanking, "$.ranking_status") || dataset.boxRanking.boxRankingIds.length === 0 || dataset.bonusSchedules.scheduleIds.length === 0 || [...dataset.boxRanking.boxRankingIds, ...dataset.bonusSchedules.scheduleIds].some(id => !Number.isSafeInteger(id) || id < 0)) failures.push("structural identities");
    if (dataset.rewards.observedSchemaPaths.length !== 0 || dataset.rewards.definitionsObserved || dataset.rewards.grantedOrClaimedObserved || dataset.rewards.boundary !== "no_ranking_reward_definition_or_grant_response_observed") failures.push("reward boundary");
    return { schemaVersion: 1, valid: failures.length === 0, failures: [...new Set(failures)], surfaceCount: surfaces.length, fieldCount: surfaces.reduce((sum, value) => sum + value.fields.length, 0) };
}
