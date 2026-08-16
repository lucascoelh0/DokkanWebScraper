import { WtEvidenceClass, WtSchemaType } from "./wt0-contract";
export interface Wt2Field { name: string; sourcePath: string; types: WtSchemaType[]; classification: WtEvidenceClass; valueRetention: "omitted_schema_only"; status: "observed" | "unknown" }
export interface Wt2Dataset {
    schemaVersion: 1; contract: "dokkan-world-tournament-event-entry-ranks"; contractVersion: "0.3.0";
    lineage: Array<{ gate: "WT0" | "WT1"; contractVersion: string; sizeBytes: number; sha256: string }>;
    budokai: { identity: { id: number; classification: "global"; status: "observed" }; presentation: Wt2Field[]; lifecycle: Wt2Field[]; globalStatus: { status: "unknown"; classification: "unknown"; boundary: string }; maps: { ids: number[]; identityStatus: "observed"; parentRelation: { status: "partial"; budokaiId: null; boundary: string }; fields: Wt2Field[] } };
    entry: { classification: "account_scoped"; fields: Wt2Field[]; budokaiStatusFields: Wt2Field[] };
    ranks: { classification: "global"; definitionFields: Wt2Field[]; rewardBoundary: "rank_definitions_only_no_reward_grant_or_claim" };
}
export interface Wt2Validation { schemaVersion: 1; valid: boolean; failures: string[]; eventFieldCount: number; entryFieldCount: number; mapCount: number }
