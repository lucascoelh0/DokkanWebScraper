import assert = require("assert");
import { buildDatabaseCharacterSkillsCoverage, stateContainsPassiveSkill } from "./skills-builder";
import { CharacterStateSkills, DatabaseCharacterSkillsDataset } from "./skills-contract";

describe("database character skills", () => {
    it("keeps uncertainty fields out of the supported mechanics channel", () => {
        const dataset = { rawRows: [], stateSkills: [], actionSkills: [], supportedMechanics: [{ stateId: "s", sourceTeamAnalysisStateKey: "a", sourceReleaseState: "initial", identity: { stateKey: "a", passiveSkillId: "p" }, supported: { target: { scope: "self" } } }] } as unknown as DatabaseCharacterSkillsDataset;
        assert.strictEqual(buildDatabaseCharacterSkillsCoverage(dataset).forbiddenConsumerFieldCount, 0);
        (dataset.supportedMechanics[0].supported as unknown as Record<string, unknown>).raw = 1;
        assert.strictEqual(buildDatabaseCharacterSkillsCoverage(dataset).forbiddenConsumerFieldCount, 1);
    });
    it("does not confuse a relation row ID with a passive-skill row ID", () => {
        const state = { passiveSkill: { set: { table: "passive_skill_sets", rowId: "1" }, relations: [{ relation: { table: "passive_skill_set_relations", rowId: "42" }, skill: { table: "passive_skills", rowId: "7" }, causalities: [] }] } } as CharacterStateSkills;
        assert.strictEqual(stateContainsPassiveSkill(state, "42"), false);
        assert.strictEqual(stateContainsPassiveSkill(state, "7"), true);
    });
});
