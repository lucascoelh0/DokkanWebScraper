"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const mocha_1 = require("mocha");
const game_db_stage_candidate_1 = require("./game-db-stage-candidate");
(0, mocha_1.describe)("Stage candidate pinned source profile", () => {
    function pinnedTables() {
        return {
            sugoroku_maps: Array.from({ length: game_db_stage_candidate_1.PINNED_STAGE_SOURCE_PROFILE.questLevelCount }, (_, index) => ({ id: String(index + 1), quest_id: "1" })),
            z_battle_stages: Array.from({ length: game_db_stage_candidate_1.PINNED_STAGE_SOURCE_PROFILE.zBattleCount }, (_, index) => ({ id: String(index + 1) })),
            equipment_skill_items: Array.from({ length: game_db_stage_candidate_1.PINNED_STAGE_SOURCE_PROFILE.equipmentItemCount }, (_, index) => ({ id: String(index === 0 ? game_db_stage_candidate_1.PINNED_STAGE_SOURCE_PROFILE.equipmentItemMaxId : index + 1) })),
            equipment_skills: Array.from({ length: game_db_stage_candidate_1.PINNED_STAGE_SOURCE_PROFILE.equipmentSkillCount }, (_, index) => ({ id: String(index + 1) })),
            equipment_skill_limitations: Array.from({ length: game_db_stage_candidate_1.PINNED_STAGE_SOURCE_PROFILE.equipmentLimitationCount }, (_, index) => ({ id: String(index + 1) })),
            link_skill_lv_up_items: Array.from({ length: game_db_stage_candidate_1.PINNED_STAGE_SOURCE_PROFILE.linkSkillLvUpItemCount }, (_, index) => ({ id: String(index + 1) })),
        };
    }
    (0, mocha_1.it)("accepts the exact frozen database identity and cardinalities", () => {
        (0, game_db_stage_candidate_1.validatePinnedStageSourceProfile)(game_db_stage_candidate_1.PINNED_STAGE_SOURCE_PROFILE.sourceSnapshotVersion, game_db_stage_candidate_1.PINNED_STAGE_SOURCE_PROFILE.sourceDatabaseSha256, pinnedTables());
    });
    (0, mocha_1.it)("fails generation when a frozen cardinality or SHA differs", () => {
        const changed = pinnedTables();
        changed.equipment_skills.pop();
        (0, assert_1.throws)(() => (0, game_db_stage_candidate_1.validatePinnedStageSourceProfile)(game_db_stage_candidate_1.PINNED_STAGE_SOURCE_PROFILE.sourceSnapshotVersion, game_db_stage_candidate_1.PINNED_STAGE_SOURCE_PROFILE.sourceDatabaseSha256, changed), /equipmentSkillCount/);
        (0, assert_1.throws)(() => (0, game_db_stage_candidate_1.validatePinnedStageSourceProfile)(game_db_stage_candidate_1.PINNED_STAGE_SOURCE_PROFILE.sourceSnapshotVersion, "0".repeat(64), pinnedTables()), /sourceDatabaseSha256/);
    });
    (0, mocha_1.it)("allows a formally changed snapshot to define its own profile", () => {
        (0, game_db_stage_candidate_1.validatePinnedStageSourceProfile)("1788329251", "0".repeat(64), {});
        (0, assert_1.equal)(true, true);
    });
});
//# sourceMappingURL=game-db-stage-candidate.spec.js.map