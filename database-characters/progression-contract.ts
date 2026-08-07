import { SqliteScalar } from "../database-experiment/contract";

export interface ProgressionRowRef { table: string; rowId: string }
export interface ProgressionRawRow { values: Record<string, SqliteScalar>; provenance: { table: string; rowId: string; columns: string[] } }
export interface CharacterProgressionCard {
    cardId: string;
    playerCardStats: { hpInitial: number | null; hpMax: number | null; atkInitial: number | null; atkMax: number | null; defInitial: number | null; defMax: number | null; source: { table: "cards"; rowId: string; columns: string[] } };
    statDomains: { playerCard: "supported_raw"; enemyRuntime: "not_in_contract"; displayed: "unknown"; calculatedCombat: "not_projected" };
    rarityRaw: SqliteScalar;
    growthProfile: { growTypeRaw: SqliteScalar; cardGrowthStatus: "supported" | "unknown" | "not_applicable"; cardGrowthRows: ProgressionRowRef[]; optimalAwakeningGrowTypeRaw: SqliteScalar; optimalAwakeningGrowthStatus: "supported" | "unknown" | "not_applicable"; optimalAwakeningGrowthRows: ProgressionRowRef[] };
    experienceProfile: { expTypeRaw: SqliteScalar; status: "supported" | "unknown" | "not_applicable"; rows: ProgressionRowRef[] };
    states: Array<{ stateId: string; sourceStateKey: string; releaseState: "initial" | "eza" | "seza" | "unknown"; growthStep?: ProgressionRowRef; growthStepNumber?: number; maxLevel: number | null; maxSuperAttackLevel: number | null; statOverride: "unknown_not_present_in_source_contract" }>;
    potential: { boardId?: string; boardStatus: "supported" | "unknown"; board?: ProgressionRowRef; squareRows: ProgressionRowRef[] };
    awakeningRequirements: Array<{ route: ProgressionRowRef; awakeningSetId?: string; set?: ProgressionRowRef; requirements: Array<{ row: ProgressionRowRef; itemId: string; item?: ProgressionRowRef; quantity: number | null }> }>;
}
export interface EquipmentSkillOrbReference { itemId: string; row: ProgressionRowRef; limitationSetId?: string; limitationRows: ProgressionRowRef[]; skillRows: ProgressionRowRef[]; compatibilitySemantics: "raw_structural_only" }
export interface DatabaseCharacterProgressionDataset {
    schemaVersion: 1; contract: "dokkan-database-characters-progression"; contractVersion: "1.0.0"; generatedAt: string;
    source: { snapshotVersion: string; databaseSha256: string; db1ArtifactSha256: string; lineage: "validated-db1-plus-focused-sqlite-no-combat-calculation" };
    policy: { playerStatsNeverUsedAsEnemyStats: true; combatCalculationImplemented: false; potentialSemanticsPromoted: false; equipmentLimitationSemanticsPromoted: false; saAndLeaderMechanicsOwnedByK3: true };
    rawRows: ProgressionRawRow[]; cards: CharacterProgressionCard[]; equipmentSkillOrbs: EquipmentSkillOrbReference[];
}
export interface DatabaseCharacterProgressionCoverage {
    schemaVersion: 1; rawRowCount: number; cardCount: number; stateCount: number; ezaStateCount: number; sezaStateCount: number; unknownStateCount: number;
    awakeningRouteCount: number; awakeningRequirementCount: number; referencedAwakeningItemCount: number; missingAwakeningSetCount: number; missingAwakeningItemCount: number;
    missingCardGrowthProfileCount: number; missingOptimalAwakeningGrowthProfileCount: number; missingExperienceProfileCount: number;
    potentialBoardCardCount: number; missingPotentialBoardCount: number; potentialBoardWithoutSquaresCount: number; potentialSquareCount: number; potentialSquareRelationCount: number; potentialRootRelationCount: number; danglingPotentialSquareRelationCount: number; danglingPotentialSquareEventCount: number; danglingPotentialSquareConditionSetCount: number; danglingPotentialConditionRelationCount: number;
    equipmentSkillOrbCount: number; equipmentSkillRowCount: number; equipmentLimitationRowCount: number; danglingEquipmentSkillItemCount: number; danglingEquipmentPotentialSkillCount: number; danglingPotentialSkillLevelCount: number; missingEquipmentLimitationSetCount: number; orphanEquipmentLimitationSetCount: number; duplicateRawRowIdentityCount: number; duplicateCardIdentityCount: number;
}
export interface DatabaseCharacterProgressionValidation { schemaVersion: 1; valid: boolean; failures: string[] }
