import { CharacterEvidenceStatus } from "./identity-contract";

export interface PresentationLabel { value: string; sourceLocale: "global_snapshot_default"; source: { table: string; rowId: string; column: string } }
export interface CharacterTaxonomyDictionaryEntry { id: string; label: PresentationLabel }
export interface CharacterLinkLevel {
    linkSkillLevelId: string;
    level: number;
    description: PresentationLabel;
    effects: Array<{ rowId: string; raw: Record<string, string | number | null>; status: "supported_structural_raw_semantics_uninterpreted" }>;
}
export interface CharacterLinkDictionaryEntry extends CharacterTaxonomyDictionaryEntry { levels: CharacterLinkLevel[] }
export interface CharacterCardTaxonomy {
    cardId: string;
    labels: { cardTitle: PresentationLabel; characterName?: PresentationLabel; uniqueInfoName?: PresentationLabel };
    rarity: { raw: unknown; value: string; status: CharacterEvidenceStatus };
    originalRarity: { status: CharacterEvidenceStatus; sourceCardIds: string[]; zRouteRowIds: string[]; cycleDetected: boolean; rawValues: unknown[]; values: string[] };
    type: { raw: unknown; value: string; status: CharacterEvidenceStatus };
    characterClass: { raw: unknown; value: string; status: CharacterEvidenceStatus };
    categoryAssignments: Array<{ categoryId: string; relationRowId: string; status: CharacterEvidenceStatus }>;
    links: Array<{ slot: number; linkSkillId: string; status: CharacterEvidenceStatus; sourceColumn: string }>;
}
export interface DatabaseCharacterTaxonomyDataset {
    schemaVersion: 1;
    contract: "dokkan-database-characters-taxonomy";
    contractVersion: "1.0.0";
    generatedAt: string;
    source: { snapshotVersion: string; databaseSha256: string; db1ArtifactSha256: string };
    localeAudit: { provedLocales: ["global_snapshot_default"]; otherLocales: "unknown"; presentationTextAsIdentity: false };
    rarityValues: string[];
    typeValues: string[];
    classValues: string[];
    categories: CharacterTaxonomyDictionaryEntry[];
    links: CharacterLinkDictionaryEntry[];
    cards: CharacterCardTaxonomy[];
    sourceAudit: { linkLevelRowIds: string[]; linkEfficacyRowIds: string[]; unjoinedLinkLevelRowIds: string[]; unjoinedLinkEfficacyRowIds: string[] };
}
export interface DatabaseCharacterTaxonomyCoverage {
    schemaVersion: 1; cardCount: number; categoryCount: number; linkCount: number; linkLevelCount: number; linkEffectRowCount: number;
    categoryAssignmentCount: number; linkAssignmentCount: number; unresolvedCategoryAssignmentCount: number; unresolvedLinkAssignmentCount: number;
    missingCardLabelCount: number; missingCategoryLabelCount: number; missingLinkLabelCount: number; multiRootOriginalRarityCount: number; originalRarityCycleCount: number;
    duplicateCategoryIdentityCount: number; duplicateLinkIdentityCount: number;
    duplicateLinkLevelSourceRowCount: number; duplicateLinkEfficacySourceRowCount: number; unjoinedLinkLevelRowCount: number; unjoinedLinkEfficacyRowCount: number;
}
export interface DatabaseCharacterTaxonomyValidation { schemaVersion: 1; valid: boolean; failures: string[] }
