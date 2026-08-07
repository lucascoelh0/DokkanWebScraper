"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const progression_validator_1 = require("./progression-validator");
describe("database character progression", () => {
    it("rejects player-card stats leaking into enemy/display/combat domains", () => {
        const dataset = { schemaVersion: 1, contract: "dokkan-database-characters-progression", contractVersion: "1.0.0", policy: { playerStatsNeverUsedAsEnemyStats: true, combatCalculationImplemented: false, potentialSemanticsPromoted: false, equipmentLimitationSemanticsPromoted: false, saAndLeaderMechanicsOwnedByK3: true }, rawRows: [], equipmentSkillOrbs: [], cards: [{ cardId: "1", statDomains: { enemyRuntime: "supported_raw", displayed: "unknown", calculatedCombat: "not_projected" }, states: [], growthProfile: { cardGrowthRows: [], optimalAwakeningGrowthRows: [] }, experienceProfile: { rows: [] }, potential: { squareRows: [] }, awakeningRequirements: [] }] };
        const coverage = { cardCount: 5759, stateCount: 10654, ezaStateCount: 4855, sezaStateCount: 37, unknownStateCount: 3, missingAwakeningSetCount: 0, missingAwakeningItemCount: 0, missingPotentialBoardCount: 0, danglingPotentialSquareRelationCount: 0, danglingEquipmentSkillItemCount: 0, duplicateRawRowIdentityCount: 0, duplicateCardIdentityCount: 0 };
        assert.strictEqual((0, progression_validator_1.validateDatabaseCharacterProgressionDataset)(dataset, coverage).valid, false);
    });
});
//# sourceMappingURL=progression-builder.spec.js.map