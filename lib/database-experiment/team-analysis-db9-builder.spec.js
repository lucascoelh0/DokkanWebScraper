"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const mocha_1 = require("mocha");
const team_analysis_db9_builder_1 = require("./team-analysis-db9-builder");
(0, mocha_1.describe)("database Team Analysis DB9 runtime evidence", function () {
    (0, mocha_1.it)("separates identified, null and out-of-range enum identities without semantic promotion", () => {
        const base = 0x1000;
        const symbol = "_ZN25AbilityEfficacyRemoveFunc49removeAbilityEfficacyInfoAndInactiveAbilityStatusEPN19AbilityEfficacyCore15CallChangeParamE";
        const inspection = { elfClass: 64, endian: "little", machine: 183, symbols: [], readVirtualUint64: () => 0n, relocations: [{ offset: base + 8, type: 257, symbolName: symbol, symbolValue: 0x2000, addend: 0 }] };
        const layout = { tables: { efficacy: { baseVma: base, slotCount: 3 }, causality: { baseVma: 0x3000, slotCount: 2 } } };
        const db8 = { generatedAt: "x", sourceSnapshotVersion: "s", sourceSha256: "a", efficacyGaps: [
                { efficacyType: 1, ruleCount: 2, affectedStateCount: 1 }, { efficacyType: 2, ruleCount: 3, affectedStateCount: 2 }, { efficacyType: 4, ruleCount: 5, affectedStateCount: 3 },
            ], causalityGaps: [] };
        const dataset = (0, team_analysis_db9_builder_1.buildDatabaseTeamAnalysisDb9Dataset)({ db8, db8Sha256: "c", inspection, layout, layoutSha256: "d", nativePath: "runtime.so", nativeSizeBytes: 10, nativeSha256: "b" });
        const coverage = (0, team_analysis_db9_builder_1.buildDatabaseTeamAnalysisDb9Coverage)(dataset);
        (0, assert_1.equal)(dataset.semanticPromotionCount, 0);
        (0, assert_1.equal)(dataset.efficacyGapEvidence[0].identityStatus, "runtime_identified");
        (0, assert_1.equal)(dataset.efficacyGapEvidence[1].identityStatus, "unsupported_null");
        (0, assert_1.equal)(dataset.efficacyGapEvidence[2].identityStatus, "out_of_range");
        (0, assert_1.equal)(coverage.efficacyGapRules.identified, 2);
        (0, assert_1.equal)(coverage.efficacyGapRules.unresolved, 8);
    });
    (0, mocha_1.it)("preserves and rejects absent or non-integer enum values", () => {
        const inspection = { elfClass: 64, endian: "little", machine: 183, symbols: [], relocations: [], readVirtualUint64: () => 0n };
        const layout = { tables: { efficacy: { baseVma: 0x1000, slotCount: 2 }, causality: { baseVma: 0x2000, slotCount: 2 } } };
        const db8 = { generatedAt: "x", sourceSnapshotVersion: "s", sourceSha256: "a", efficacyGaps: [null, "", "not-a-number", 1.5].map((efficacyType, index) => ({ efficacyType, ruleCount: index + 1, affectedStateCount: 1 })), causalityGaps: [] };
        const dataset = (0, team_analysis_db9_builder_1.buildDatabaseTeamAnalysisDb9Dataset)({ db8, db8Sha256: "c", inspection, layout, layoutSha256: "d", nativePath: "runtime.so", nativeSizeBytes: 10, nativeSha256: "b" });
        (0, assert_1.equal)(dataset.efficacyGapEvidence.every(value => value.identityStatus === "invalid_value"), true);
        (0, assert_1.equal)(dataset.efficacyGapEvidence[0].sourceEnumValue, null);
        (0, assert_1.equal)(dataset.efficacyGapEvidence[1].sourceEnumValue, "");
        const coverage = (0, team_analysis_db9_builder_1.buildDatabaseTeamAnalysisDb9Coverage)(dataset);
        (0, assert_1.equal)(coverage.efficacyGapTypes.invalid, 4);
        (0, assert_1.equal)(coverage.efficacyGapRules.unresolved, 10);
    });
});
//# sourceMappingURL=team-analysis-db9-builder.spec.js.map