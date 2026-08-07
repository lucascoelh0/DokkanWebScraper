import { equal, throws } from "assert";
import { readFileSync } from "fs";
import { resolve } from "path";
import { projectDb47Timing, validateDb47Evidence } from "./team-analysis-db47-builder";
import { validateDatabaseTeamAnalysisDb47Dataset } from "./team-analysis-db47-validator";

const evidence = JSON.parse(readFileSync(resolve(__dirname, "..", "..", "database-experiment", "native-puzzle-move-end-timing-semantics.json"), "utf8"));
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

describe("database Team Analysis DB47 puzzle move-end timing", () => {
    it("maps only timing 15", () => {
        equal(projectDb47Timing(15)?.event, "puzzle_attack_move_end_after_controller_callback");
        for (const value of [1, 5, 6, 7, 14, 16, -1, "bad"]) equal(projectDb47Timing(value), null);
    });

    it("rejects evidence, relocation and virtual-dispatch mutations before ELF lookup", () => {
        for (const mutate of [
            (value: any) => value.event.name = "ball_acquired",
            (value: any) => value.regions[1].vma += 4,
            (value: any) => value.event.instructions[7].vma += 4,
            (value: any) => value.directCalls[0].relocation.symbol = "substituted",
            (value: any) => value.virtualCall.relocation.offset += 8,
            (value: any) => value.doesNotImply = [],
        ]) { const mutated = clone(evidence); mutate(mutated); throws(() => validateDb47Evidence({} as any, mutated, evidence.sourceSha256), /identity/); }
    });

    it("rejects invalid payload mutations across raw timing, dimensions and provenance", () => {
        const database = { table: "passive_skills", rowId: "15", column: "exec_timing_type" };
        const sourceRule = { stateKey: "state", ruleKey: "rule", passiveSkillId: "15", rawExecutionTimingType: 15, effectCount: 1, calculationOperation: { status: "supported", raw: 2, operation: "add_percent" }, executionTiming: { status: "unknown", event: "unknown" }, independentDimensions: { calculationBucket: "unknown", unit: "unknown", target: "unknown", duration: "unknown", recurrence: "unknown", stacking: "unknown", isOnceInteraction: "unknown", turnFieldInteraction: "unknown" }, provenance: { database } };
        const source = { generatedAt: "g", sourceSnapshotVersion: "s", sourceDatabaseSha256: "db", ruleTimings: [sourceRule] } as any;
        const runtime = { fileName: "libcocos2dcpp.so", sha256: "native", evidenceFile: "native-puzzle-move-end-timing-semantics.json", evidenceSha256: "evidence", proofRoles: ["execution_filter", "timing_owner", "move_end_caller", "controller_virtual_callback_handler"] };
        const dataset = { schemaVersion: 1, contract: "dokkan-team-analysis-puzzle-move-end-timing-native-semantics-experiment", contractVersion: "0.46.0", generatedAt: "g", sourceSnapshotVersion: "s", sourceDatabaseSha256: "db", sourceDb46: { fileName: "team-analysis-db46-enemy-attack-timing.json.gz", sha256: "6bc13b29197a5fcbca6d52f484377a0bd65cf48d4750a4604461f64f2bd6f837", contractVersion: "0.45.0" }, nativeRuntime: { fileName: "libcocos2dcpp.so", sha256: "native", sizeBytes: 1 }, nativeEvidence: { fileName: "native-puzzle-move-end-timing-semantics.json", sha256: "evidence" }, inheritedSemanticPromotionCount: 60, semanticPromotionCount: 1, ruleTimings: [{ ...sourceRule, executionTiming: projectDb47Timing(15), provenance: { database, runtime } }] } as any;
        equal(validateDatabaseTeamAnalysisDb47Dataset(dataset, source, "native", 1, "evidence").valid, true);
        for (const mutate of [
            (value: any) => value.ruleTimings[0].rawExecutionTimingType = 14,
            (value: any) => value.ruleTimings[0].independentDimensions.calculationBucket = "attack",
            (value: any) => value.ruleTimings[0].provenance.database.rowId = "other",
            (value: any) => value.ruleTimings[0].provenance.runtime.evidenceFile = "substituted.json",
        ]) { const mutated = clone(dataset); mutate(mutated); equal(validateDatabaseTeamAnalysisDb47Dataset(mutated, source, "native", 1, "evidence").valid, false); }
    });
});
