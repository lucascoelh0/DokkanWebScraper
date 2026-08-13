"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const fs_1 = require("fs");
const os_1 = require("os");
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
    it("fails closed when any pinned source file mutates", async () => {
        const sourceRoot = process.cwd();
        const lock = JSON.parse((0, fs_1.readFileSync)((0, path_1.resolve)(sourceRoot, "database-data-download-captures/data-download-dd6-source-lock.json"), "utf8"));
        const isolatedRoot = (0, fs_1.mkdtempSync)((0, path_1.join)((0, os_1.tmpdir)(), "dd6-source-lock-"));
        try {
            for (const item of lock.artifacts) {
                const target = (0, path_1.resolve)(isolatedRoot, item.fileName);
                (0, fs_1.mkdirSync)((0, path_1.dirname)(target), { recursive: true });
                (0, fs_1.copyFileSync)((0, path_1.resolve)(sourceRoot, item.fileName), target);
            }
            await (0, data_download_dd6_1.validateDd6SourceLock)(isolatedRoot, lock);
            for (const item of lock.artifacts) {
                const target = (0, path_1.resolve)(isolatedRoot, item.fileName);
                const original = (0, fs_1.readFileSync)(target);
                (0, fs_1.writeFileSync)(target, Buffer.concat([original, Buffer.from("\nmutated")]));
                await assert_1.strict.rejects((0, data_download_dd6_1.validateDd6SourceLock)(isolatedRoot, lock), new RegExp(`identity mismatch ${item.key}`));
                (0, fs_1.writeFileSync)(target, original);
            }
        }
        finally {
            (0, fs_1.rmSync)(isolatedRoot, { recursive: true, force: true });
        }
    });
    it("rejects detached lineage, envelope drift and row reclassification", async () => {
        const root = process.cwd();
        const lock = JSON.parse((0, fs_1.readFileSync)((0, path_1.resolve)(root, "database-data-download-captures/data-download-dd6-source-lock.json"), "utf8"));
        const value = await (0, data_download_dd6_1.buildDd6)(root, lock, {
            generatedAt: "2026-08-13T00:00:00.000Z",
            database: { descriptorObservationCount: 3 },
            clientAssets: { descriptorObservationCount: 5 },
        });
        assert_1.strict.equal((0, data_download_dd6_1.validateDd6)(value, lock).valid, true);
        const detached = JSON.parse(JSON.stringify(value));
        detached.sourceLineage = [];
        assert_1.strict.equal((0, data_download_dd6_1.validateDd6)(detached, lock).valid, false);
        const changedVersion = JSON.parse(JSON.stringify(value));
        changedVersion.contractVersion = "forged";
        assert_1.strict.equal((0, data_download_dd6_1.validateDd6)(changedVersion, lock).valid, false);
        const changedRow = JSON.parse(JSON.stringify(value));
        changedRow.rows[0].classification = "unknown";
        changedRow.totals.agreement -= 1;
        changedRow.totals.unknown += 1;
        assert_1.strict.equal((0, data_download_dd6_1.validateDd6)(changedRow, lock).valid, false);
        const forgedLineage = JSON.parse(JSON.stringify(value));
        forgedLineage.sourceLineage[0].sha256 = "f".repeat(64);
        assert_1.strict.equal((0, data_download_dd6_1.validateDd6)(forgedLineage, lock).valid, false);
    });
    it("rejects false-completeness accounting and identity drift", () => {
        const value = { schemaVersion: 1, contract: "dokkan-data-download-shadow-parity", contractVersion: "0.7.0", generatedAt: "2026-08-13T00:00:00.000Z", collectionMode: "offline_pinned_document_and_code_comparison", defaultEnabled: false, productionMutation: false, identityPolicy: "structural_endpoint_field_and_exact_path_only_no_names_or_localized_text", sourceLineage: [], rows: [{ subject: "x", prior: "x", classification: "unknown", units: 1, reason: "x" }], totals: { agreement: 0, representation_gain: 0, representation_mismatch: 0, confirmed_conflict: 0, unknown: 0, unjoinable: 0 }, completenessWarning: "zero_confirmed_conflicts_never_implies_completeness" };
        assert_1.strict.equal((0, data_download_dd6_1.validateDd6)(value).valid, false);
        const changed = { ...value, totals: { ...value.totals, unknown: 1 }, identityPolicy: "names_are_identity" };
        assert_1.strict.equal((0, data_download_dd6_1.validateDd6)(changed).valid, false);
    });
});
//# sourceMappingURL=data-download-dd6.spec.js.map