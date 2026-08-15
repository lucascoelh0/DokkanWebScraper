import { deepStrictEqual, equal, ok, rejects, throws } from "assert";
import type { SourcedRow } from "../database-experiment/contract";
import {
    CHARACTER_LEADER_VALUE_SCOPE_PIN,
    CHARACTER_LEADER_VALUE_SCOPE_REPORT_LIMIT_BYTES,
    CharacterLeaderValueK3Identity,
    CharacterLeaderValueK3Source,
    CharacterLeaderValueK48Identity,
    CharacterLeaderValueK48Source,
    CharacterLeaderValueScopeEvaluation,
} from "./leader-value-scope-contract";
import {
    assertLeaderValueK3Stable,
    assertLeaderValueK48Stable,
    compactLeaderValueRawRows,
} from "./leader-value-scope-source";
import {
    assertPinnedCharacterLeaderValueScope,
    buildCharacterLeaderValueScopeReport,
    evaluateCharacterLeaderValueScope,
} from "./leader-value-scope";
import { parseCharacterLeaderValueScopeCli, runCharacterLeaderValueScopeAudit } from "./leader-value-scope-run";

function k3Identity(): CharacterLeaderValueK3Identity {
    return {
        profileId: "character-refresh-pinned-v1", snapshotVersion: "snapshot-v1",
        manifest: { sha256: "1".repeat(64), sizeBytes: 1 },
        artifact: { sha256: "2".repeat(64), sizeBytes: 2, uncompressedSizeBytes: 3, uncompressedSha256: "3".repeat(64) },
        coverage: { sha256: "4".repeat(64), sizeBytes: 4 }, validation: { sha256: "5".repeat(64), sizeBytes: 5 },
        associationInputFingerprintSha256: "6".repeat(64), valueInputFingerprintSha256: "7".repeat(64),
    };
}
function associationK3Identity() {
    const { valueInputFingerprintSha256: _value, ...base } = k3Identity(); return base;
}
function k48Identity(): CharacterLeaderValueK48Identity {
    const k3 = associationK3Identity();
    return {
        manifestSha256: "8".repeat(64), payloadSha256: "9".repeat(64), rawSha256: "a".repeat(64), stateFingerprintSha256: "b".repeat(64),
        k46: {
            manifestSha256: "c".repeat(64), payloadSha256: "d".repeat(64), rawSha256: "e".repeat(64), stateFingerprintSha256: "f".repeat(64),
            k43: { manifestSha256: "0".repeat(64), payloadSha256: "1".repeat(64), rawSha256: "2".repeat(64), k42SourceFingerprintSha256: "3".repeat(64), stateFingerprintSha256: "4".repeat(64) },
            k3: { ...k3, compactFingerprintSha256: "5".repeat(64) },
        },
        k3,
    };
}
function sources(): { k48: CharacterLeaderValueK48Source; k3: CharacterLeaderValueK3Source } {
    return {
        k48: {
            identity: k48Identity(),
            states: [{
                stateId: "card-state:1:initial", sourceStateKey: "source:1", cardId: "1", releaseState: "initial", leaderSetRowId: "set:1",
                effects: [{ effectRowId: "e82", targetSetId: "targets:9" }, { effectRowId: "e-unknown", targetSetId: null }],
            }],
            policy: { structuralIdsOnly: true, sourceOrderAndMultiplicityPreserved: true, semanticAssociationSelected: false },
            coverage: { states: 1, effectReferences: 2, targetReferences: 0, repeatedTargetReferences: 0 },
        },
        k3: {
            identity: k3Identity(), effects: [
                {
                    rowId: "e82", leaderSkillSetId: "set:1", efficacyType: 82, efficacyVector: [31, 170, 0], calcOption: 2,
                    targetType: 4, subTargetTypeSetId: "targets:9", causalitySerializedShapeSha256: null, execTimingType: 1,
                    descriptionCorrelatedToVectorPosition1: true,
                },
                {
                    rowId: "e-unknown", leaderSkillSetId: "set:1", efficacyType: 1, efficacyVector: [1], calcOption: 0,
                    targetType: 0, subTargetTypeSetId: null, causalitySerializedShapeSha256: "a".repeat(64), execTimingType: 0,
                    descriptionCorrelatedToVectorPosition1: false,
                },
            ],
        },
    };
}
function pinnedEvaluation(): CharacterLeaderValueScopeEvaluation {
    const efficacyTypeDomain = [...Array.from({ length: 22 }, (_, index) => index), 82];
    return {
        includedEffectReferences: CHARACTER_LEADER_VALUE_SCOPE_PIN.includedEffectReferences,
        uniqueEffectRows: CHARACTER_LEADER_VALUE_SCOPE_PIN.uniqueEffectRows, efficacyTypeDomain,
        uniqueType82Rows: CHARACTER_LEADER_VALUE_SCOPE_PIN.uniqueType82Rows,
        includedType82References: CHARACTER_LEADER_VALUE_SCOPE_PIN.includedType82References,
        partialRows: CHARACTER_LEADER_VALUE_SCOPE_PIN.partialRows,
        partialReferences: CHARACTER_LEADER_VALUE_SCOPE_PIN.partialReferences,
        unknownRows: CHARACTER_LEADER_VALUE_SCOPE_PIN.unknownRows,
        unknownReferences: CHARACTER_LEADER_VALUE_SCOPE_PIN.unknownReferences,
        type82InvalidVectorRows: 0, type82NonTiming1Rows: 0, type82NonzeroPosition2Rows: 0,
        type82DescriptionMismatchRows: CHARACTER_LEADER_VALUE_SCOPE_PIN.type82DescriptionMismatchRows,
        setsContainingType82: CHARACTER_LEADER_VALUE_SCOPE_PIN.setsContainingType82, onlyType82Sets: 0,
        calcOptionDomain: [0, 2, 3], targetTypeDomain: [0, 2, 4, 12, 13],
        timingRows: [{ id: 0, rows: 95 }, { id: 1, rows: 16_024 }],
        causalityNullRows: 15_703, causalityNonNullRows: 416, causalitySerializedShapes: 12,
        missingEffectRows: 0, structuralMismatchReferences: 0,
        samples: { partialEffectRowIds: ["1"], unknownEffectRowIds: ["2"], mismatchEffectRowIds: [], limitPerKind: 5 },
    };
}

describe("database character K49 leader value scope", () => {
    it("fails closed unless the exact opt-in and six roots are supplied", async () => {
        await rejects(runCharacterLeaderValueScopeAudit({} as any), /explicit opt-in/);
        throws(() => parseCharacterLeaderValueScopeCli([]), /exactly one --opt-in-k49/);
        throws(() => parseCharacterLeaderValueScopeCli(["--opt-in-k49"]), /--sidecar-root/);
        throws(() => parseCharacterLeaderValueScopeCli([
            "--opt-in-k49", "--sidecar-root", "s", "--production-root", "p", "--fyi-root", "f", "--k43-root", "k43", "--k46-root", "k46", "--k48-root", "k48", "--output-root", "o",
        ]), /unsupported argument/);
        deepStrictEqual(parseCharacterLeaderValueScopeCli([
            "--opt-in-k49", "--sidecar-root", "s", "--production-root", "p", "--fyi-root", "f", "--k43-root", "k43", "--k46-root", "k46", "--k48-root", "k48",
        ]), { optIn: true, sidecarRoot: "s", productionRoot: "p", fyiRoot: "f", k43Root: "k43", k46Root: "k46", k48Root: "k48" });
        const savedGc = (global as any).gc;
        try {
            (global as any).gc = undefined;
            await rejects(runCharacterLeaderValueScopeAudit({ optIn: true, sidecarRoot: "s", productionRoot: "p", fyiRoot: "f", k43Root: "k43", k46Root: "k46", k48Root: "k48" }), /--expose-gc/);
        } finally { (global as any).gc = savedGc; }
    });

    it("classifies only the exact text-correlated type82 shape as partial", () => {
        const source = sources(), evaluation = evaluateCharacterLeaderValueScope(source.k48, source.k3);
        equal(evaluation.includedEffectReferences, 2); equal(evaluation.uniqueEffectRows, 2);
        equal(evaluation.uniqueType82Rows, 1); equal(evaluation.includedType82References, 1);
        equal(evaluation.partialRows, 1); equal(evaluation.partialReferences, 1); equal(evaluation.unknownRows, 1); equal(evaluation.unknownReferences, 1);
        equal(evaluation.type82InvalidVectorRows, 0); equal(evaluation.type82DescriptionMismatchRows, 0);
        deepStrictEqual(evaluation.samples.partialEffectRowIds, ["e82"]); deepStrictEqual(evaluation.samples.unknownEffectRowIds, ["e-unknown"]);
        const variants = [
            { efficacyVector: [31, 170] }, { efficacyVector: [31, 170, 1] }, { execTimingType: 0 }, { descriptionCorrelatedToVectorPosition1: false },
        ];
        for (const variant of variants) {
            const changed = sources(); changed.k3.effects[0] = { ...changed.k3.effects[0], ...variant };
            const result = evaluateCharacterLeaderValueScope(changed.k48, changed.k3);
            equal(result.partialRows, 0); equal(result.unknownRows, 2);
        }
    });

    it("uses description only for a boolean correlation and compacts the eight typed raw columns", () => {
        const setRow: SourcedRow = { provenance: { table: "leader_skill_sets", rowId: "1", columns: ["description"] }, values: { description: "HP, ATK and DEF +170%" } };
        const effectRow: SourcedRow = { provenance: { table: "leader_skills", rowId: "e82", columns: [] }, values: {
            leader_skill_set_id: 1, efficacy_type: 82, efficacy_values: "[31,170,0]", calc_option: 2, target_type: 4,
            sub_target_type_set_id: 9, causality_conditions: null, exec_timing_type: 1, name: "must not survive",
        } };
        const compact = compactLeaderValueRawRows([setRow, effectRow]);
        deepStrictEqual(compact, [{
            rowId: "e82", leaderSkillSetId: "1", efficacyType: 82, efficacyVector: [31, 170, 0], calcOption: 2,
            targetType: 4, subTargetTypeSetId: "9", causalitySerializedShapeSha256: null, execTimingType: 1,
            descriptionCorrelatedToVectorPosition1: true,
        }]);
        const encoded = JSON.stringify(compact);
        ok(!encoded.includes("HP, ATK")); ok(!encoded.includes("must not survive")); ok(!encoded.includes('"description":'));
        const mismatched = compactLeaderValueRawRows([{ ...setRow, values: { description: "HP, ATK and DEF +150%" } }, effectRow]);
        equal(mismatched[0].descriptionCorrelatedToVectorPosition1, false);
        const unrelatedNumber = compactLeaderValueRawRows([{ ...setRow, values: { description: "Ki +3 and ATK +170%" } }, effectRow]);
        equal(unrelatedNumber[0].descriptionCorrelatedToVectorPosition1, false);
        const ampersand = compactLeaderValueRawRows([{ ...setRow, values: { description: "Ki +3 and HP, ATK & DEF +170%" } }, effectRow]);
        equal(ampersand[0].descriptionCorrelatedToVectorPosition1, true);
        const secondClause = compactLeaderValueRawRows([{ ...setRow, values: { description: "HP, ATK & DEF +130%, plus HP, ATK & DEF +170%" } }, effectRow]);
        equal(secondClause[0].descriptionCorrelatedToVectorPosition1, true);
        const wrongClauses = compactLeaderValueRawRows([{ ...setRow, values: { description: "HP, ATK & DEF +130%, plus HP, ATK & DEF +150%" } }, effectRow]);
        equal(wrongClauses[0].descriptionCorrelatedToVectorPosition1, false);
        const flatBonus = compactLeaderValueRawRows([{ ...setRow, values: { description: "HP, ATK & DEF +170" } }, effectRow]);
        equal(flatBonus[0].descriptionCorrelatedToVectorPosition1, false);
        throws(() => compactLeaderValueRawRows([{ ...effectRow, values: { ...effectRow.values, calc_option: "opaque" } }]), /malformed calc_option/);
    });

    it("fails structural joins for missing or mismatched K48 effects", () => {
        let source = sources(); source.k3.effects[0] = { ...source.k3.effects[0], leaderSkillSetId: "other" };
        let evaluation = evaluateCharacterLeaderValueScope(source.k48, source.k3);
        equal(evaluation.structuralMismatchReferences, 1);
        source = sources(); source.k3.effects = source.k3.effects.filter(row => row.rowId !== "e82");
        evaluation = evaluateCharacterLeaderValueScope(source.k48, source.k3);
        equal(evaluation.missingEffectRows, 1); deepStrictEqual(evaluation.samples.mismatchEffectRowIds, ["e82"]);
        source = sources(); source.k48.policy.semanticAssociationSelected = true as any;
        throws(() => evaluateCharacterLeaderValueScope(source.k48, source.k3), /structural-only multiplicity boundary/);
    });

    it("pins all hypotheses and builds a deterministic bounded report without direct GO authorization", () => {
        const evaluation = pinnedEvaluation(); assertPinnedCharacterLeaderValueScope(evaluation);
        throws(() => assertPinnedCharacterLeaderValueScope({ ...evaluation, setsContainingType82: 2_295 }), /sets with type82 hypothesis changed/);
        throws(() => assertPinnedCharacterLeaderValueScope({ ...evaluation, calcOptionDomain: [0, 2] }), /calc option domain hypothesis changed/);
        const first = buildCharacterLeaderValueScopeReport(k48Identity(), k3Identity(), evaluation);
        const second = buildCharacterLeaderValueScopeReport(k48Identity(), k3Identity(), evaluation);
        deepStrictEqual(first, second);
        const encoded = `${JSON.stringify(first, null, 2)}\n`;
        ok(Buffer.byteLength(encoded) < CHARACTER_LEADER_VALUE_SCOPE_REPORT_LIMIT_BYTES); ok(!encoded.includes("generatedAt"));
        ok(!encoded.includes('"description":')); ok(!encoded.includes("HP, ATK"));
        equal(first.readiness.leaderValueScope, "NOT_EXECUTED"); equal(first.readiness.nextOpaquePartialProjection, "NO-GO");
        equal(first.readiness.hpAtkDefSemantics, "NO-GO"); equal(first.policy.hpAtkDefDerived, false);
    });

    it("detects K3 value and K48 source fingerprint drift", () => {
        assertLeaderValueK3Stable(k3Identity(), k3Identity()); assertLeaderValueK48Stable(k48Identity(), k48Identity());
        throws(() => assertLeaderValueK3Stable(k3Identity(), { ...k3Identity(), valueInputFingerprintSha256: "f".repeat(64) }), /changed/);
        throws(() => assertLeaderValueK48Stable(k48Identity(), { ...k48Identity(), stateFingerprintSha256: "f".repeat(64) }), /changed/);
    });
});
