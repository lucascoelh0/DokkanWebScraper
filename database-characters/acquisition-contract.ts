import { ProgressionRawRow, ProgressionRowRef } from "./progression-contract";
export interface CharacterDropReference { source: ProgressionRowRef; sourceColumn: string; questId: string; quest?: ProgressionRowRef; cardId: string; itemTypeRaw: unknown; sourceKind: "boss_drop" | "quest_drop_preview" }
export interface CharacterAcquisitionRecord {
    cardId: string;
    collectionEntries: ProgressionRowRef[];
    collectionEventIds: string[];
    stageDrops: CharacterDropReference[];
    summonability: "unknown_no_first_party_relation_in_snapshot";
    f2p: { classification: "unknown"; evidence: Array<{ kind: "first_party_stage_drop"; source: ProgressionRowRef; questId: string }> };
    awakeningSourceRouteIds: string[];
    trainingPartnerCandidates: Array<{ cardId: string; evidence: "derived_same_card_unique_info_id"; cardUniqueInfoId: string }>;
    reversibleExchangePartners: Array<{ targetCardId: string; source: { table: string; rowId: string; columns: string[] } }>;
    exclusiveSkillOrbCompatibility: "raw_only_owned_by_k4";
}
export interface DatabaseCharacterAcquisitionDataset {
    schemaVersion: 1; contract: "dokkan-database-characters-acquisition"; contractVersion: "1.0.0"; generatedAt: string;
    source: { snapshotVersion: string; databaseSha256: string; db1ArtifactSha256: string; itemTypeCardEvidence: "first-party-string-enum-plus-existing-E5-item-catalog-binding" };
    policy: { schedulesExcluded: true; textUsedForF2pClassification: false; stageDropDoesNotProveF2p: true; derivedTrainingNeverFirstParty: true; summonDataAbsent: true };
    rawRows: ProgressionRawRow[]; cards: CharacterAcquisitionRecord[]; unjoinedCardDropReferences: CharacterDropReference[];
}
export interface DatabaseCharacterAcquisitionCoverage {
    schemaVersion: 1; rawRowCount: number; cardCount: number; collectionEntryCount: number; collectionEventIdCount: number; stageDropReferenceCount: number; stageDropCardCount: number; unjoinedCardDropReferenceCount: number; missingQuestJoinCount: number;
    cardsWithStageDropEvidenceCount: number; assertedF2pCount: number; assertedSummonableCount: number; derivedTrainingCandidateCount: number; unmarkedDerivedTrainingCandidateCount: number; reversibleExchangePairCount: number; duplicateDropIdentityCount: number; duplicateRawRowIdentityCount: number; duplicateCardIdentityCount: number;
}
export interface DatabaseCharacterAcquisitionValidation { schemaVersion: 1; valid: boolean; failures: string[] }
