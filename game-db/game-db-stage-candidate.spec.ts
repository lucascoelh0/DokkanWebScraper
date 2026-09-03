import { equal, throws } from "assert";
import { describe, it } from "mocha";
import { StageFirstPartyTables } from "./game-db-stage";
import { PINNED_STAGE_SOURCE_PROFILE, validatePinnedStageSourceProfile } from "./game-db-stage-candidate";

describe("Stage candidate pinned source profile", () => {
    function pinnedTables(): StageFirstPartyTables {
        return {
            sugoroku_maps: Array.from({ length: PINNED_STAGE_SOURCE_PROFILE.questLevelCount }, (_, index) => ({ id: String(index + 1), quest_id: "1" })),
            z_battle_stages: Array.from({ length: PINNED_STAGE_SOURCE_PROFILE.zBattleCount }, (_, index) => ({ id: String(index + 1) })),
            equipment_skill_items: Array.from({ length: PINNED_STAGE_SOURCE_PROFILE.equipmentItemCount }, (_, index) => ({ id: String(index === 0 ? PINNED_STAGE_SOURCE_PROFILE.equipmentItemMaxId : index + 1) })),
            equipment_skills: Array.from({ length: PINNED_STAGE_SOURCE_PROFILE.equipmentSkillCount }, (_, index) => ({ id: String(index + 1) })),
            equipment_skill_limitations: Array.from({ length: PINNED_STAGE_SOURCE_PROFILE.equipmentLimitationCount }, (_, index) => ({ id: String(index + 1) })),
            link_skill_lv_up_items: Array.from({ length: PINNED_STAGE_SOURCE_PROFILE.linkSkillLvUpItemCount }, (_, index) => ({ id: String(index + 1) })),
        } as unknown as StageFirstPartyTables;
    }

    it("accepts the exact frozen database identity and cardinalities", () => {
        validatePinnedStageSourceProfile(PINNED_STAGE_SOURCE_PROFILE.sourceSnapshotVersion, PINNED_STAGE_SOURCE_PROFILE.sourceDatabaseSha256, pinnedTables());
    });

    it("fails generation when a frozen cardinality or SHA differs", () => {
        const changed = pinnedTables();
        changed.equipment_skills.pop();
        throws(() => validatePinnedStageSourceProfile(PINNED_STAGE_SOURCE_PROFILE.sourceSnapshotVersion, PINNED_STAGE_SOURCE_PROFILE.sourceDatabaseSha256, changed), /equipmentSkillCount/);
        throws(() => validatePinnedStageSourceProfile(PINNED_STAGE_SOURCE_PROFILE.sourceSnapshotVersion, "0".repeat(64), pinnedTables()), /sourceDatabaseSha256/);
    });

    it("allows a formally changed snapshot to define its own profile", () => {
        validatePinnedStageSourceProfile("1788329251", "0".repeat(64), {} as StageFirstPartyTables);
        equal(true, true);
    });
});
