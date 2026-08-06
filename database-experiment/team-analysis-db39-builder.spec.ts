import { equal, throws } from "assert";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { db39OperandUnit, projectDb39Bucket, projectDb39Modifier, scaleDb39Modifier, validateDb39NativeEvidence } from "./team-analysis-db39-builder";
const evidencePath = existsSync(resolve(__dirname, "native-energy-ball-proportional-stat-semantics.json")) ? resolve(__dirname, "native-energy-ball-proportional-stat-semantics.json") : resolve(__dirname, "..", "..", "database-experiment", "native-energy-ball-proportional-stat-semantics.json");
const evidence = JSON.parse(readFileSync(evidencePath, "utf8"));
describe("database Team Analysis DB39 proportional ATK/DEF", () => {
    it("narrows the modifier to float32 before multiplying by the signed int32 count", () => { equal(scaleDb39Modifier(0.1, 3), 0.30000000447034836); equal(scaleDb39Modifier(-10, 2), -20); equal(scaleDb39Modifier(25, 0), 0); });
    it("rejects invalid, int32-out-of-range and float32-overflow payloads", () => { equal(scaleDb39Modifier("bad", 1), null); equal(scaleDb39Modifier(1, 1.5), null); equal(scaleDb39Modifier(1, 2147483648), null); equal(scaleDb39Modifier(1e39, 1), null); equal(projectDb39Modifier("attack", "bad").status, "unknown"); equal(projectDb39Modifier("defense", 1e39).status, "unknown"); });
    it("projects only the two evidenced buckets", () => { equal(projectDb39Bucket(1).value, "former_passive_stat"); equal(projectDb39Bucket(4).value, "latter_passive_stat"); equal(projectDb39Bucket(5).value, "unknown"); });
    it("keeps the raw ball-type semantic boundary independent from operation", () => { const operation = { status: "supported" as const, value: "add_percent_of_lhs" as const, formula: "lhs + lhs * rhs / 100", parametersRead: ["lhs", "rhs"], parametersIgnored: [], clamp: "none" }; const unit = db39OperandUnit(operation); equal(unit.status, "partial"); equal(unit.value, "percent_points_of_current_stat_per_raw_ball_type_11_count"); equal(unit.boundary, "raw_ball_type_11_semantic_name_unknown"); });
    it("rejects semantic evidence substitution before trusting ELF self-consistency", () => { const tampered = JSON.parse(JSON.stringify(evidence)); tampered.emittedFields.attack = "substituted"; throws(() => validateDb39NativeEvidence({} as any, tampered, evidence.sourceSha256), /emitted field/); const emptyVtables = JSON.parse(JSON.stringify(evidence)); emptyVtables.vtableRelocations = []; throws(() => validateDb39NativeEvidence({} as any, emptyVtables, evidence.sourceSha256)); });
});
