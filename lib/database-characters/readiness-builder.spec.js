"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const readiness_builder_1 = require("./readiness-builder");
const readiness_validator_1 = require("./readiness-validator");
describe("database character readiness", () => {
    it("emits two narrow GOs and twelve prerequisite-backed NO-GOs", () => {
        const dataset = (0, readiness_builder_1.buildDatabaseCharacterReadinessDataset)();
        const coverage = (0, readiness_builder_1.buildDatabaseCharacterReadinessCoverage)(dataset);
        (0, assert_1.equal)(coverage.goCount, 2);
        (0, assert_1.equal)(coverage.noGoCount, 12);
        (0, assert_1.equal)(coverage.confirmedConflictFieldCount, 4);
        (0, assert_1.ok)(dataset.decisions.filter(decision => decision.decision === "NO-GO").every(decision => decision.prerequisites.length > 0));
        (0, assert_1.ok)((0, readiness_validator_1.validateDatabaseCharacterReadinessDataset)(dataset, coverage).valid);
    });
    it("rejects authority promotion and a forged decision", () => {
        const dataset = (0, readiness_builder_1.buildDatabaseCharacterReadinessDataset)();
        dataset.policy.authorityPromoted = true;
        dataset.decisions[2].decision = "GO";
        const validation = (0, readiness_validator_1.validateDatabaseCharacterReadinessDataset)(dataset, (0, readiness_builder_1.buildDatabaseCharacterReadinessCoverage)(dataset));
        (0, assert_1.ok)(validation.failures.includes("readiness evidence or decision changed"));
        (0, assert_1.ok)(validation.failures.includes("decision inventory"));
        (0, assert_1.ok)(validation.failures.includes("activation policy"));
    });
});
//# sourceMappingURL=readiness-builder.spec.js.map