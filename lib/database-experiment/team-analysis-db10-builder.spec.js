"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = require("crypto");
const assert_1 = require("assert");
const mocha_1 = require("mocha");
const team_analysis_db10_builder_1 = require("./team-analysis-db10-builder");
const hash = (value) => (0, crypto_1.createHash)("sha256").update(value).digest("hex");
function fixture() {
    const constructorBytes = Buffer.from([9]);
    const rowConstructorBytes = Buffer.from([8]);
    const code = new Map([[90, rowConstructorBytes], [100, constructorBytes], [200, Buffer.from([3])], [300, Buffer.from([43])], [400, Buffer.from([51])], [500, Buffer.from([55])]]);
    const handlers = [
        { causalityType: 3, symbol: "type3", vma: 200, sizeBytes: 1, codeSha256: hash(code.get(200)), status: "partial", operation: "runtime_gauge_ratio_threshold", comparator: "gte", parameterReads: ["cau_val1"], ignoredParameters: ["cau_val2", "cau_val3"], valueExpression: "ratio", gate: null, unknowns: ["threshold_unit"] },
        { causalityType: 43, symbol: "type43", vma: 300, sizeBytes: 1, codeSha256: hash(code.get(300)), status: "supported", operation: "dodge_success", comparator: "eq_true", parameterReads: [], ignoredParameters: ["cau_val1", "cau_val2", "cau_val3"], valueExpression: "flag", gate: null, unknowns: [] },
        { causalityType: 51, symbol: "type51", vma: 400, sizeBytes: 1, codeSha256: hash(code.get(400)), status: "supported", operation: "turns_from_appearance", comparator: "lte", parameterReads: ["cau_val1"], ignoredParameters: ["cau_val2", "cau_val3"], valueExpression: "turns", gate: "appearance_initialized", unknowns: [] },
        { causalityType: 55, symbol: "type55", vma: 500, sizeBytes: 1, codeSha256: hash(code.get(500)), status: "supported", operation: "turns_from_appearance", comparator: "gt", parameterReads: ["cau_val1"], ignoredParameters: ["cau_val2", "cau_val3"], valueExpression: "turns", gate: "appearance_initialized", unknowns: [] },
    ];
    const inspection = { symbols: [{ name: "row-constructor", value: 90, size: 1 }, { name: "constructor", value: 100, size: 1 }, ...handlers.map(value => ({ name: value.symbol, value: value.vma, size: 1 }))], readVirtualBytes: (vma) => code.get(vma) };
    const layout = { schemaVersion: 1, sourceSha256: "native", payloadLayout: { containerOffset: 8, elementSizeBytes: 4, indexColumns: ["cau_val1", "cau_val2", "cau_val3"], constructorSymbol: "constructor", constructorVma: 100, constructorSizeBytes: 1, constructorCodeSha256: hash(constructorBytes), rowConstructorSymbol: "row-constructor", rowConstructorVma: 90, rowConstructorSizeBytes: 1, rowConstructorCodeSha256: hash(rowConstructorBytes) }, handlers };
    const gap = (causalityType, occurrenceCount) => ({ causalityType, occurrenceCount, affectedStateCount: 1, affectedStateKeys: [`state-${causalityType}`], causalityIds: [String(causalityType)], rawValueDomains: { cauVal1: [1], cauVal2: [0], cauVal3: [0] }, samples: [] });
    const db8 = { generatedAt: "x", contractVersion: "0.7.0", sourceSnapshotVersion: "snapshot", sourceSha256: "db", causalityGaps: [gap(3, 10), gap(43, 2), gap(51, 3), gap(55, 4)] };
    const slots = [];
    for (const value of handlers)
        slots[value.causalityType] = { enumValue: value.causalityType, status: "identified", symbol: value.symbol, symbolAddress: value.vma };
    const db9 = { generatedAt: "x", contractVersion: "0.8.0", sourceDb8ContractVersion: "0.7.0", sourceSnapshotVersion: "snapshot", sourceDatabaseSha256: "db", sourceDb8: { sha256: "db8" }, nativeRuntime: { sha256: "native" }, causalityDispatchSlots: slots };
    const options = { db8, db8Sha256: "db8", db9, db9Sha256: "db9", inspection, layout, layoutSha256: "layout", nativeSha256: "native" };
    return { options, db8 };
}
(0, mocha_1.describe)("database Team Analysis DB10 native semantics", function () {
    (0, mocha_1.it)("promotes only complete handler semantics and retains the ambiguous gauge unit", () => {
        const { options, db8 } = fixture();
        const dataset = (0, team_analysis_db10_builder_1.buildDatabaseTeamAnalysisDb10Dataset)(options);
        const coverage = (0, team_analysis_db10_builder_1.buildDatabaseTeamAnalysisDb10Coverage)(dataset, db8);
        (0, assert_1.equal)(dataset.semanticPromotionCount, 3);
        (0, assert_1.equal)(dataset.promotedOccurrenceCount, 9);
        (0, assert_1.equal)(dataset.partialResolutionOccurrenceCount, 10);
        (0, assert_1.equal)(dataset.causalityResolutions.find(value => value.causalityType === 3)?.status, "partial");
        (0, assert_1.equal)(coverage.remainingUnresolvedOccurrenceCount, 10);
        (0, assert_1.equal)(coverage.promotedAffectedStateCount, 3);
    });
    (0, mocha_1.it)("rejects native code that no longer matches the audited bytes", () => {
        const { options } = fixture();
        options.layout.handlers[0].codeSha256 = "0".repeat(64);
        (0, assert_1.throws)(() => (0, team_analysis_db10_builder_1.buildDatabaseTeamAnalysisDb10Dataset)(options), /code hash mismatch/);
    });
    (0, mocha_1.it)("rejects a DB9 identity projection that does not derive from the supplied DB8 artifact", () => {
        const { options } = fixture();
        options.db9.sourceDb8.sha256 = "different-db8";
        (0, assert_1.throws)(() => (0, team_analysis_db10_builder_1.buildDatabaseTeamAnalysisDb10Dataset)(options), /DB8\/DB9 source lineage mismatch/);
    });
});
//# sourceMappingURL=team-analysis-db10-builder.spec.js.map