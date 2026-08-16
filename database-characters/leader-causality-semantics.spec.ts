import { deepStrictEqual, equal, throws } from "assert";
import type { SourcedRow } from "../database-experiment/contract";
import { CHARACTER_LEADER_CAUSALITY_PIN } from "./leader-causality-semantics-contract";
import { assertLeaderCausalityK48TargetStable, compactLeaderCausalityRawRows, parseLeaderCausalityExpression } from "./leader-causality-semantics-source";
import { parseCharacterLeaderCausalitySemanticsCli } from "./leader-causality-semantics-run";
import { buildCharacterLeaderCausalitySemanticsReport, evaluateCharacterLeaderCausalitySemantics } from "./leader-causality-semantics";

const row = (table: string, rowId: string, values: Record<string, any>): SourcedRow => ({ values, provenance: { table, rowId, columns: Object.keys(values) } });
const args = [
    "--opt-in-k52", "--sidecar-root", "s", "--production-root", "p", "--fyi-root", "f", "--k43-root", "43",
    "--k46-root", "46", "--k48-root", "48", "--native-runtime", "elf", "--database", "db",
];

describe("K52 leader causality semantics", () => {
    it("accepts only positive scalar IDs and exact binary ampersand expressions", () => {
        equal(parseLeaderCausalityExpression(196), 196);
        deepStrictEqual(parseLeaderCausalityExpression(["&", 3591, 3592]), ["&", 3591, 3592]);
        for (const invalid of [0, -1, ["|", 1, 2], ["&", 1, 2, 3], ["&", 1, "2"], { id: 1 }]) {
            throws(() => parseLeaderCausalityExpression(invalid), /unsupported causality expression/);
        }
    });

    it("compacts only structural compiled conditions and discloses missing K3 causality rows", () => {
        const compacted = compactLeaderCausalityRawRows([
            row("leader_skills", "a", { efficacy_type: 82, causality_conditions: JSON.stringify({ source: "ignored text", compiled: 196 }) }),
            row("leader_skills", "b", { efficacy_type: 82, causality_conditions: JSON.stringify({ source: "ignored text", compiled: ["&", 3591, 3592] }) }),
            row("leader_skills", "c", { efficacy_type: 82, causality_conditions: null }),
            row("leader_skills", "d", { efficacy_type: 77, causality_conditions: JSON.stringify({ compiled: 197 }) }),
            row("skill_causalities", "196", {}),
        ]);
        deepStrictEqual(compacted.effects, [{ rowId: "a", expression: 196 }, { rowId: "b", expression: ["&", 3591, 3592] }]);
        deepStrictEqual(compacted.missingReferencedRowIds, ["3591", "3592"]);
        equal(JSON.stringify(compacted).includes("ignored text"), false);
    });

    it("fails closed on malformed serialized conditions and duplicate effect rows", () => {
        throws(() => compactLeaderCausalityRawRows([row("leader_skills", "a", { efficacy_type: 82, causality_conditions: "{" })]), /malformed causality JSON/);
        throws(() => compactLeaderCausalityRawRows([
            row("leader_skills", "a", { efficacy_type: 82, causality_conditions: JSON.stringify({ compiled: 196 }) }),
            row("leader_skills", "a", { efficacy_type: 82, causality_conditions: JSON.stringify({ compiled: 197 }) }),
        ]), /duplicate leader effect/);
    });

    it("joins K48 effect references to separately supplied database tuples", () => {
        const k3: any = {
            identity: { causalityInputFingerprintSha256: "x" },
            effects: [{ rowId: "a", expression: 196 }, { rowId: "b", expression: ["&", 3591, 3592] }],
            missingReferencedRowIds: ["196", "3591", "3592"],
        };
        const k48: any = { states: [{ effects: [{ effectRowId: "a" }, { effectRowId: "a" }, { effectRowId: "b" }] }] };
        const database: any = { rows: [
            { id: "196", causalityType: 35, cauVal1: 126976, cauVal2: 0, cauVal3: 0 },
            { id: "3591", causalityType: 35, cauVal1: 96, cauVal2: 0, cauVal3: 0 },
            { id: "3592", causalityType: 35, cauVal1: 31, cauVal2: 0, cauVal3: 0 },
        ] };
        const scope = evaluateCharacterLeaderCausalitySemantics(k48, k3, database);
        equal(scope.type82NonNullRows, 2); equal(scope.k48References, 3); equal(scope.scalarExpressions, 1);
        equal(scope.conjunctionExpressions, 1); equal(scope.leafOccurrences, 3); equal(scope.missingK48EffectRows, 0);
        deepStrictEqual(scope.idOccurrences, { "196": 1, "3591": 1, "3592": 1 });
    });

    it("detects final K48 target-association drift that value identity omits", () => {
        const before: any = { identity: { same: true }, effects: [{ effectRowId: "a", targetSetId: "7", targetRowIds: ["1", "2"] }] };
        assertLeaderCausalityK48TargetStable(before, JSON.parse(JSON.stringify(before)));
        const changed = JSON.parse(JSON.stringify(before)); changed.effects[0].targetRowIds[1] = "3";
        throws(() => assertLeaderCausalityK48TargetStable(before, changed), /target associations changed/);
    });

    it("keeps direct report construction non-authoritative and bounded", () => {
        const report = buildCharacterLeaderCausalitySemanticsReport({} as any, {} as any, { descriptorBoundReadOnly: true } as any, {
            elfSha256: CHARACTER_LEADER_CAUSALITY_PIN.nativeSha256, elfSizeBytes: CHARACTER_LEADER_CAUSALITY_PIN.nativeSizeBytes,
            evidenceSha256: CHARACTER_LEADER_CAUSALITY_PIN.nativeEvidenceSha256, evidenceSizeBytes: CHARACTER_LEADER_CAUSALITY_PIN.nativeEvidenceSizeBytes,
            codeRegionCount: 7, exactCallCount: 7, executionChainBound: true, type35DispatchBound: true, onlyCauVal1Read: true,
            bitRangeInclusive: [0, 31], humanBitNamesBound: false, partySelectionContextBound: false, lifecycleBound: false, stackingBound: false,
        }, {} as any);
        equal(report.readiness.leaderCausalityStructuralSemantics, "NOT_EXECUTED");
        equal(report.readiness.authority, "NO-GO"); equal(report.policy.sourceTextIncluded, false);
    });

    it("requires one opt-in, all explicit values, and no duplicate or loose arguments", () => {
        equal(parseCharacterLeaderCausalitySemanticsCli(args).database, "db");
        throws(() => parseCharacterLeaderCausalitySemanticsCli(args.slice(1)), /exactly one/);
        throws(() => parseCharacterLeaderCausalitySemanticsCli([...args, "loose"]), /unsupported argument/);
        throws(() => parseCharacterLeaderCausalitySemanticsCli([...args, "--database", "again"]), /duplicate --database/);
        throws(() => parseCharacterLeaderCausalitySemanticsCli(args.slice(0, -1)), /missing value/);
    });
});
