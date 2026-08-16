import { WtEvidenceClass, WtSchemaNode } from "./wt0-contract";

export interface Wt1SchemaOccurrence extends WtSchemaNode { observedEntryIndexes: number[]; typeOccurrences: Array<{ type: WtSchemaNode["types"][number]; observedEntryIndexes: number[] }> }
export interface Wt1Route {
    method: "GET" | "POST";
    route: string;
    classification: WtEvidenceClass;
    statuses: number[];
    observedEntryIndexes: number[];
    traffic: "read_observed" | "mutation_observed_not_replayable";
    queryKeyNames: string[];
    requestSchema: Wt1SchemaOccurrence[];
    responseSchema: Wt1SchemaOccurrence[];
}
export interface Wt1Dataset {
    schemaVersion: 1;
    contract: "dokkan-world-tournament-route-schema-catalog";
    contractVersion: "0.2.0";
    source: { contractVersion: "0.1.0"; sizeBytes: number; sha256: string };
    valuePolicy: "schema_paths_types_and_structural_route_parameters_only";
    routes: Wt1Route[];
    requiredSurface: Array<{ method: "GET" | "POST"; route: string; status: "observed" | "unknown" }>;
}
export interface Wt1Validation { schemaVersion: 1; valid: boolean; routeCount: number; failures: string[] }
