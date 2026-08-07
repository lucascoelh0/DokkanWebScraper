import { buildDatabaseCharacterRefreshCoverage, buildDatabaseCharacterRefreshReceipt } from "./refresh-builder";
import { DatabaseCharacterRefreshCoverage, DatabaseCharacterRefreshReceipt, DatabaseCharacterRefreshValidation } from "./refresh-contract";

export function validateDatabaseCharacterRefreshReceipt(receipt: DatabaseCharacterRefreshReceipt, coverage: DatabaseCharacterRefreshCoverage): DatabaseCharacterRefreshValidation {
    const failures: string[] = [];
    const expected = buildDatabaseCharacterRefreshReceipt();
    const recomputed = buildDatabaseCharacterRefreshCoverage(receipt);
    if (JSON.stringify(receipt) !== JSON.stringify(expected)) failures.push("refresh profile or receipt changed");
    if (JSON.stringify(coverage) !== JSON.stringify(recomputed)) failures.push("coverage mismatch");
    if (receipt.schemaVersion !== 1 || receipt.contract !== "dokkan-database-character-refresh-receipt" || receipt.contractVersion !== "1.0.0") failures.push("contract identity");
    if (!receipt.policy.optional || receipt.policy.enabledByDefault || receipt.policy.productionImportCount || receipt.policy.productionReplacement || receipt.policy.r2Publication || receipt.policy.androidConsumption || receipt.policy.absenceBehavior !== "preserve_production" || receipt.policy.consumerChannel !== "supported_only_scopes" || !receipt.policy.auditChannelSeparate) failures.push("delivery policy");
    if (receipt.execution.mode !== "focused_profile_verification" || receipt.execution.db0Db50Replay || receipt.execution.sidecarsRegenerated || !receipt.execution.receiptWrittenAfterCompatibility) failures.push("execution boundary");
    if (coverage.sidecarCount !== 8 || coverage.consumerSidecarCount !== 6 || coverage.auditSidecarCount !== 8 || coverage.semanticFileCount !== 12 || coverage.invalidSidecarCount || coverage.productionImportCount) failures.push("cardinality");
    if (coverage.compressedBytes !== receipt.totals.compressedBytes || coverage.uncompressedBytes !== receipt.totals.uncompressedBytes) failures.push("byte totals");
    const gates = receipt.sidecars.map(sidecar => sidecar.gate);
    if (new Set(gates).size !== gates.length || gates.join(",") !== "k0,k1,k2,k3,k4,k5,k6,k7") failures.push("sidecar inventory");
    if (receipt.sidecars.some(sidecar => sidecar.absenceBehavior !== "preserve_production" || !sidecar.validationValid || (sidecar.consumerScopes.length === 0 && sidecar.auditScopes.length === 0))) failures.push("sidecar channel");
    return { schemaVersion: 1, valid: failures.length === 0, failures };
}
