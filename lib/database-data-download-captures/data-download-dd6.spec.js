"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const fs_1 = require("fs");
const path_1 = require("path");
const data_download_dd6_1 = require("./data-download-dd6");
describe("data download DD6", () => {
    it("rejects parity source paths outside the repository and lock drift", async () => {
        const lock = JSON.parse((0, fs_1.readFileSync)((0, path_1.resolve)(process.cwd(), "database-data-download-captures/data-download-dd6-source-lock.json"), "utf8"));
        const changed = JSON.parse(JSON.stringify(lock));
        changed.artifacts[0].fileName = "../outside.md";
        await assert_1.strict.rejects((0, data_download_dd6_1.validateDd6SourceLock)(process.cwd(), changed), /rejected|mismatch/);
        const changedContract = JSON.parse(JSON.stringify(lock));
        changedContract.contract = "changed";
        await assert_1.strict.rejects((0, data_download_dd6_1.validateDd6SourceLock)(process.cwd(), changedContract), /contract mismatch/);
    });
    it("rejects false-completeness accounting and identity drift", () => {
        const value = { schemaVersion: 1, contract: "dokkan-data-download-shadow-parity", contractVersion: "0.7.0", generatedAt: "2026-08-13T00:00:00.000Z", collectionMode: "offline_pinned_document_and_code_comparison", defaultEnabled: false, productionMutation: false, identityPolicy: "structural_endpoint_field_and_exact_path_only_no_names_or_localized_text", sourceLineage: [], rows: [{ subject: "x", prior: "x", classification: "unknown", units: 1, reason: "x" }], totals: { agreement: 0, representation_gain: 0, representation_mismatch: 0, confirmed_conflict: 0, unknown: 0, unjoinable: 0 }, completenessWarning: "zero_confirmed_conflicts_never_implies_completeness" };
        assert_1.strict.equal((0, data_download_dd6_1.validateDd6)(value).valid, false);
        const changed = { ...value, totals: { ...value.totals, unknown: 1 }, identityPolicy: "names_are_identity" };
        assert_1.strict.equal((0, data_download_dd6_1.validateDd6)(changed).valid, false);
    });
});
//# sourceMappingURL=data-download-dd6.spec.js.map