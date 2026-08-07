import { equal, ok } from "assert";
import { buildDatabaseCharacterRefreshCoverage, buildDatabaseCharacterRefreshReceipt } from "./refresh-builder";
import { validateDatabaseCharacterRefreshReceipt } from "./refresh-validator";

describe("database character refresh receipt", () => {
    it("keeps optional consumer and audit channels separate", () => {
        const receipt = buildDatabaseCharacterRefreshReceipt();
        const coverage = buildDatabaseCharacterRefreshCoverage(receipt);
        equal(coverage.sidecarCount, 8);
        equal(coverage.consumerSidecarCount, 6);
        equal(coverage.auditSidecarCount, 8);
        equal(coverage.compressedBytes, 10_166_877);
        equal(coverage.uncompressedBytes, 278_449_142);
        ok(validateDatabaseCharacterRefreshReceipt(receipt, coverage).valid);
    });

    it("fails closed when production activation or a pinned hash changes", () => {
        const receipt = buildDatabaseCharacterRefreshReceipt();
        (receipt.policy as any).enabledByDefault = true;
        receipt.sidecars[0].artifact.sha256 = "changed";
        const validation = validateDatabaseCharacterRefreshReceipt(receipt, buildDatabaseCharacterRefreshCoverage(receipt));
        ok(validation.failures.includes("refresh profile or receipt changed"));
        ok(validation.failures.includes("delivery policy"));
    });
});
