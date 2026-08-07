"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const refresh_builder_1 = require("./refresh-builder");
const refresh_validator_1 = require("./refresh-validator");
describe("database character refresh receipt", () => {
    it("keeps optional consumer and audit channels separate", () => {
        const receipt = (0, refresh_builder_1.buildDatabaseCharacterRefreshReceipt)();
        const coverage = (0, refresh_builder_1.buildDatabaseCharacterRefreshCoverage)(receipt);
        (0, assert_1.equal)(coverage.sidecarCount, 8);
        (0, assert_1.equal)(coverage.consumerSidecarCount, 6);
        (0, assert_1.equal)(coverage.auditSidecarCount, 8);
        (0, assert_1.equal)(coverage.compressedBytes, 10166877);
        (0, assert_1.equal)(coverage.uncompressedBytes, 278449142);
        (0, assert_1.ok)((0, refresh_validator_1.validateDatabaseCharacterRefreshReceipt)(receipt, coverage).valid);
    });
    it("fails closed when production activation or a pinned hash changes", () => {
        const receipt = (0, refresh_builder_1.buildDatabaseCharacterRefreshReceipt)();
        receipt.policy.enabledByDefault = true;
        receipt.sidecars[0].artifact.sha256 = "changed";
        const validation = (0, refresh_validator_1.validateDatabaseCharacterRefreshReceipt)(receipt, (0, refresh_builder_1.buildDatabaseCharacterRefreshCoverage)(receipt));
        (0, assert_1.ok)(validation.failures.includes("refresh profile or receipt changed"));
        (0, assert_1.ok)(validation.failures.includes("delivery policy"));
    });
});
//# sourceMappingURL=refresh-builder.spec.js.map