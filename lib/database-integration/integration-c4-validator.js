"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateIntegrationC4Artifacts = void 0;
function validateIntegrationC4Artifacts(actualReport, expectedReport, actualReceipt, expectation) {
    const expectedReceipt = expectation ? { schemaVersion: 1, contract: "dokkan-database-first-focused-refresh", contractVersion: "1.0.0", generatedAt: expectation.generatedAt, snapshotVersion: expectation.snapshotVersion, mode: "focused_c1_c2_c3_no_db0_db50_replay", compatibilityReportSha256: expectation.compatibilityReportSha256, inputs: { sourceDatabaseSha256: expectation.sourceDatabaseSha256, nativeRuntimeSha256: expectation.nativeRuntimeSha256, schemaSha256: expectation.schemaSha256, semanticArtifacts: expectation.semanticArtifacts }, outputs: { c1Sha256: expectation.c1Sha256, c2Sha256: expectation.c2Sha256, c3Sha256: expectation.c3Sha256 }, readOnlySourceGuarantee: true } : undefined;
    const failures = [], compatibilityExact = JSON.stringify(actualReport) === JSON.stringify(expectedReport), receiptExact = actualReceipt === undefined && expectedReceipt === undefined || actualReceipt !== undefined && expectedReceipt !== undefined && JSON.stringify(actualReceipt) === JSON.stringify(expectedReceipt);
    if (!compatibilityExact)
        failures.push("compatibility report");
    if (!receiptExact)
        failures.push("refresh receipt");
    if (actualReport.status === "incompatible" && actualReceipt !== undefined)
        failures.push("receipt emitted for incompatible inputs");
    if (actualReceipt && (actualReceipt.mode !== "focused_c1_c2_c3_no_db0_db50_replay" || actualReceipt.readOnlySourceGuarantee !== true))
        failures.push("refresh policy");
    return { schemaVersion: 1, valid: failures.length === 0, compatibilityExact, receiptExact, mutationRejectionCount: 0, failures };
}
exports.validateIntegrationC4Artifacts = validateIntegrationC4Artifacts;
//# sourceMappingURL=integration-c4-validator.js.map