"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const skills_builder_1 = require("./skills-builder");
describe("database character skills", () => {
    it("keeps uncertainty fields out of the supported mechanics channel", () => {
        const dataset = { rawRows: [], stateSkills: [], actionSkills: [], supportedMechanics: [{ stateId: "s", sourceTeamAnalysisStateKey: "a", sourceReleaseState: "initial", identity: { stateKey: "a", passiveSkillId: "p" }, supported: { target: { scope: "self" } } }] };
        assert.strictEqual((0, skills_builder_1.buildDatabaseCharacterSkillsCoverage)(dataset).forbiddenConsumerFieldCount, 0);
        dataset.supportedMechanics[0].supported.raw = 1;
        assert.strictEqual((0, skills_builder_1.buildDatabaseCharacterSkillsCoverage)(dataset).forbiddenConsumerFieldCount, 1);
    });
    it("does not confuse a relation row ID with a passive-skill row ID", () => {
        const state = { passiveSkill: { set: { table: "passive_skill_sets", rowId: "1" }, relations: [{ relation: { table: "passive_skill_set_relations", rowId: "42" }, skill: { table: "passive_skills", rowId: "7" }, causalities: [] }] } };
        assert.strictEqual((0, skills_builder_1.stateContainsPassiveSkill)(state, "42"), false);
        assert.strictEqual((0, skills_builder_1.stateContainsPassiveSkill)(state, "7"), true);
    });
});
//# sourceMappingURL=skills-builder.spec.js.map