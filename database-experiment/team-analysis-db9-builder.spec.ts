import { equal } from "assert";
import { describe, it } from "mocha";
import { buildDatabaseTeamAnalysisDb9Coverage, buildDatabaseTeamAnalysisDb9Dataset } from "./team-analysis-db9-builder";

describe("database Team Analysis DB9 runtime evidence", function () {
    it("separates identified, null and out-of-range enum identities without semantic promotion", () => {
        const base = 0x1000; const symbol = "_ZN25AbilityEfficacyRemoveFunc49removeAbilityEfficacyInfoAndInactiveAbilityStatusEPN19AbilityEfficacyCore15CallChangeParamE";
        const inspection = { elfClass: 64, endian: "little", machine: 183, symbols: [], readVirtualUint64: () => 0n, relocations: [{ offset: base + 8, type: 257, symbolName: symbol, symbolValue: 0x2000, addend: 0 }] } as any;
        const layout = { tables: { efficacy: { baseVma: base, slotCount: 3 }, causality: { baseVma: 0x3000, slotCount: 2 } } } as any;
        const db8 = { generatedAt: "x", sourceSnapshotVersion: "s", sourceSha256: "a", efficacyGaps: [
            { efficacyType: 1, ruleCount: 2, affectedStateCount: 1 }, { efficacyType: 2, ruleCount: 3, affectedStateCount: 2 }, { efficacyType: 4, ruleCount: 5, affectedStateCount: 3 },
        ], causalityGaps: [] } as any;
        const dataset = buildDatabaseTeamAnalysisDb9Dataset({ db8, db8Sha256: "c", inspection, layout, layoutSha256: "d", nativePath: "runtime.so", nativeSizeBytes: 10, nativeSha256: "b" }); const coverage = buildDatabaseTeamAnalysisDb9Coverage(dataset);
        equal(dataset.semanticPromotionCount, 0); equal(dataset.efficacyGapEvidence[0].identityStatus, "runtime_identified"); equal(dataset.efficacyGapEvidence[1].identityStatus, "unsupported_null"); equal(dataset.efficacyGapEvidence[2].identityStatus, "out_of_range");
        equal(coverage.efficacyGapRules.identified, 2); equal(coverage.efficacyGapRules.unresolved, 8);
    });
    it("preserves and rejects absent or non-integer enum values", () => {
        const inspection = { elfClass: 64, endian: "little", machine: 183, symbols: [], relocations: [], readVirtualUint64: () => 0n } as any;
        const layout = { tables: { efficacy: { baseVma: 0x1000, slotCount: 2 }, causality: { baseVma: 0x2000, slotCount: 2 } } } as any;
        const db8 = { generatedAt: "x", sourceSnapshotVersion: "s", sourceSha256: "a", efficacyGaps: [null, "", "not-a-number", 1.5].map((efficacyType, index) => ({ efficacyType, ruleCount: index + 1, affectedStateCount: 1 })), causalityGaps: [] } as any;
        const dataset = buildDatabaseTeamAnalysisDb9Dataset({ db8, db8Sha256: "c", inspection, layout, layoutSha256: "d", nativePath: "runtime.so", nativeSizeBytes: 10, nativeSha256: "b" });
        equal(dataset.efficacyGapEvidence.every(value => value.identityStatus === "invalid_value"), true);
        equal(dataset.efficacyGapEvidence[0].sourceEnumValue, null); equal(dataset.efficacyGapEvidence[1].sourceEnumValue, "");
        const coverage = buildDatabaseTeamAnalysisDb9Coverage(dataset); equal(coverage.efficacyGapTypes.invalid, 4); equal(coverage.efficacyGapRules.unresolved, 10);
    });
});
