"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const acquisition_builder_1 = require("./acquisition-builder");
const acquisition_validator_1 = require("./acquisition-validator");
const card = (overrides = {}) => ({ cardId: "1", collectionEntries: [], collectionEventIds: [], stageDrops: [], summonability: "unknown_no_first_party_relation_in_snapshot", f2p: { classification: "unknown", evidence: [] }, awakeningSourceRouteIds: [], trainingPartnerCandidates: [], reversibleExchangePartners: [], exclusiveSkillOrbCompatibility: "raw_only_owned_by_k4", ...overrides });
const dataset = (cards, rawRows = []) => ({ schemaVersion: 1, contract: "dokkan-database-characters-acquisition", contractVersion: "1.0.0", policy: { schedulesExcluded: true, textUsedForF2pClassification: false, stageDropDoesNotProveF2p: true, derivedTrainingNeverFirstParty: true, summonDataAbsent: true }, rawRows, unjoinedCardDropReferences: [], cards });
describe("database character acquisition", () => {
    it("rejects an asserted F2P classification even with forged coverage", () => {
        const value = dataset([card({ f2p: { classification: "f2p", evidence: [] } })]), coverage = { ...(0, acquisition_builder_1.buildDatabaseCharacterAcquisitionCoverage)(value), cardCount: 5759, assertedF2pCount: 0 };
        assert((0, acquisition_validator_1.validateDatabaseCharacterAcquisitionDataset)(value, coverage).failures.some(failure => failure.startsWith("classification/derived candidate")));
    });
    it("rejects a schedule field in the raw audit rows", () => {
        const value = dataset([], [{ values: { id: 1, start_at: "2026-01-01" }, provenance: { table: "quests", rowId: "1", columns: ["id", "start_at"] } }]), coverage = (0, acquisition_builder_1.buildDatabaseCharacterAcquisitionCoverage)(value);
        assert((0, acquisition_validator_1.validateDatabaseCharacterAcquisitionDataset)(value, coverage).failures.includes("schedule field leaked"));
    });
    it("rejects reversible exchange without source provenance", () => {
        const value = dataset([card({ reversibleExchangePartners: [{ targetCardId: "1", source: { table: "", rowId: "", columns: [] } }] })]), coverage = (0, acquisition_builder_1.buildDatabaseCharacterAcquisitionCoverage)(value);
        assert((0, acquisition_validator_1.validateDatabaseCharacterAcquisitionDataset)(value, coverage).failures.some(failure => failure.startsWith("exchange provenance")));
    });
});
//# sourceMappingURL=acquisition-builder.spec.js.map