import { equal, ok } from "assert";
import { buildDatabaseCharacterReadinessCoverage, buildDatabaseCharacterReadinessDataset } from "./readiness-builder";
import { validateDatabaseCharacterReadinessDataset } from "./readiness-validator";

describe("database character readiness", () => {
    it("emits two narrow GOs and twelve prerequisite-backed NO-GOs", () => {
        const dataset = buildDatabaseCharacterReadinessDataset();
        const coverage = buildDatabaseCharacterReadinessCoverage(dataset);
        equal(coverage.goCount, 2);
        equal(coverage.noGoCount, 12);
        equal(coverage.confirmedConflictFieldCount, 4);
        ok(dataset.decisions.filter(decision => decision.decision === "NO-GO").every(decision => decision.prerequisites.length > 0));
        ok(validateDatabaseCharacterReadinessDataset(dataset, coverage).valid);
    });

    it("rejects authority promotion and a forged decision", () => {
        const dataset = buildDatabaseCharacterReadinessDataset();
        (dataset.policy as any).authorityPromoted = true;
        dataset.decisions[2].decision = "GO";
        const validation = validateDatabaseCharacterReadinessDataset(dataset, buildDatabaseCharacterReadinessCoverage(dataset));
        ok(validation.failures.includes("readiness evidence or decision changed"));
        ok(validation.failures.includes("decision inventory"));
        ok(validation.failures.includes("activation policy"));
    });
});
