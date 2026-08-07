import assert = require("assert");
import { buildDatabaseCharacterAcquisitionCoverage } from "./acquisition-builder";
import { validateDatabaseCharacterAcquisitionDataset } from "./acquisition-validator";

const card = (overrides: Record<string, unknown> = {}) => ({ cardId: "1", collectionEntries: [], collectionEventIds: [], stageDrops: [], summonability: "unknown_no_first_party_relation_in_snapshot", f2p: { classification: "unknown", evidence: [] }, awakeningSourceRouteIds: [], trainingPartnerCandidates: [], reversibleExchangePartners: [], exclusiveSkillOrbCompatibility: "raw_only_owned_by_k4", ...overrides });
const dataset = (cards: unknown[], rawRows: unknown[] = []) => ({ schemaVersion: 1, contract: "dokkan-database-characters-acquisition", contractVersion: "1.0.0", policy: { schedulesExcluded: true, textUsedForF2pClassification: false, stageDropDoesNotProveF2p: true, derivedTrainingNeverFirstParty: true, summonDataAbsent: true }, rawRows, unjoinedCardDropReferences: [], cards } as any);

describe("database character acquisition", () => {
    it("rejects an asserted F2P classification even with forged coverage", () => {
        const value = dataset([card({ f2p: { classification: "f2p", evidence: [] } })]), coverage: any = { ...buildDatabaseCharacterAcquisitionCoverage(value), cardCount: 5759, assertedF2pCount: 0 };
        assert(validateDatabaseCharacterAcquisitionDataset(value, coverage).failures.some(failure => failure.startsWith("classification/derived candidate")));
    });
    it("rejects a schedule field in the raw audit rows", () => {
        const value = dataset([], [{ values: { id: 1, start_at: "2026-01-01" }, provenance: { table: "quests", rowId: "1", columns: ["id", "start_at"] } }]), coverage: any = buildDatabaseCharacterAcquisitionCoverage(value);
        assert(validateDatabaseCharacterAcquisitionDataset(value, coverage).failures.includes("schedule field leaked"));
    });
    it("rejects reversible exchange without source provenance", () => {
        const value = dataset([card({ reversibleExchangePartners: [{ targetCardId: "1", source: { table: "", rowId: "", columns: [] } }] })]), coverage: any = buildDatabaseCharacterAcquisitionCoverage(value);
        assert(validateDatabaseCharacterAcquisitionDataset(value, coverage).failures.some(failure => failure.startsWith("exchange provenance")));
    });
});
