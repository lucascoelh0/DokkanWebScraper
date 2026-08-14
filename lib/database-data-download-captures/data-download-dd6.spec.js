"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const fs_1 = require("fs");
const path_1 = require("path");
const data_download_dd6_1 = require("./data-download-dd6");
function validDd2() {
    return {
        schemaVersion: 1, contract: "dokkan-data-download-asset-contracts", contractVersion: "0.1.0", generatedAt: "2026-08-13T00:00:00.000Z",
        collectionMode: "offline_local_har_no_requests_no_replay", productionMutation: false, defaultEnabled: false,
        authority: "observed_delivery_metadata_only_no_catalog_completeness_or_runtime_authority",
        clientAssets: {
            latestVersion: 1786514403, descriptorObservationCount: 1, uniqueFilePathCount: 1, observedResponseCardinalities: [1],
            assets: [{ filePath: "asset/a", urlPathname: "/asset/a" }],
            externalFullManifest: { descriptorCount: 25233, uniqueFilePathCount: 25233, totalSizeBytes: 22349705433, latestVersion: 1786514403, algorithm: "xxhash", urlPolicy: "ephemeral_non_identity_not_persisted", pathFamilySummaries: [{ descriptorCount: 25233, totalSizeBytes: 22349705433 }], mandatoryOndemandRelation: { mandatoryCount: 4868, mandatorySizeBytes: 4152412960, deltaCount: 20365, deltaSizeBytes: 18197292473 } },
            deviceAssetSizeBytesQuery: { captureSpecificProof: { captureId: "download_all", scope: "capture_specific_not_universal", mandatoryAssetSizeBytes: 4152412960, databaseSizeBytes: 97738752, equality: true, queryValuePersisted: false } },
        },
        database: { descriptorObservationCount: 1, uniqueDescriptorCount: 1, descriptors: [{ version: 1, algorithm: "version", upstreamHashOpaque: "1", filePath: "sqlite/current/en/database.db", urlPathname: "/sqlite/current/en/database.db", observedCdnDeclaredSizeBytes: null, patch: { descriptorState: "observed_null", hashState: "observed_null" } }] },
        ondemand: { cardinality: null, assets: [], completeness: "external_body_observed_bound_to_body_absent_har_not_universal_complete_catalog", provenance: [], externalBodyEvidence: { observations: [{ urlPolicy: "ephemeral_non_identity_not_persisted" }, { urlPolicy: "ephemeral_non_identity_not_persisted" }], descriptorCount: 4868, uniqueFilePathCount: 4868, totalSizeBytes: 4152412960, categories: [{}, {}, {}], identityAcrossObservations: "agreement", urlsAcrossObservations: "all_different_ephemeral_non_identity" } },
    };
}
describe("data download DD6", () => {
    it("rejects parity source paths outside the repository and lock drift", async () => {
        const lock = JSON.parse((0, fs_1.readFileSync)((0, path_1.resolve)(process.cwd(), "database-data-download-captures/data-download-dd6-source-lock.json"), "utf8"));
        const changed = JSON.parse(JSON.stringify(lock));
        changed.artifacts[0].fileName = "../outside.md";
        await assert_1.strict.rejects((0, data_download_dd6_1.validateDd6SourceLock)(process.cwd(), changed), /invalid|rejected|mismatch/);
        const changedContract = JSON.parse(JSON.stringify(lock));
        changedContract.contract = "changed";
        await assert_1.strict.rejects((0, data_download_dd6_1.validateDd6SourceLock)(process.cwd(), changedContract), /contract mismatch/);
        const remapped = JSON.parse(JSON.stringify(lock));
        [remapped.artifacts[0].fileName, remapped.artifacts[1].fileName] = [remapped.artifacts[1].fileName, remapped.artifacts[0].fileName];
        await assert_1.strict.rejects((0, data_download_dd6_1.validateDd6SourceLock)(process.cwd(), remapped), /contract mismatch/);
    });
    it("fails closed when any individual canonical Git-blob pin mutates", async function () {
        this.timeout(30000);
        const sourceRoot = process.cwd();
        const lock = JSON.parse((0, fs_1.readFileSync)((0, path_1.resolve)(sourceRoot, "database-data-download-captures/data-download-dd6-source-lock.json"), "utf8"));
        await (0, data_download_dd6_1.validateDd6SourceLock)(sourceRoot, lock);
        for (let index = 0; index < lock.artifacts.length; index += 1) {
            const changed = JSON.parse(JSON.stringify(lock));
            const pin = changed.artifacts[index];
            pin.sha256 = pin.sha256 === "f".repeat(64) ? "e".repeat(64) : "f".repeat(64);
            await assert_1.strict.rejects((0, data_download_dd6_1.validateDd6SourceLock)(sourceRoot, changed), new RegExp(`identity mismatch ${pin.key}`));
        }
    });
    it("reads tracked source identity from HEAD Git blobs, not worktree line endings", async () => {
        const root = process.cwd();
        const bytes = await (0, data_download_dd6_1.readDd6CanonicalGitBlob)(root, "database-data-download-captures/data-download-dd6.ts");
        assert_1.strict.ok(bytes.length > 0);
        await assert_1.strict.rejects((0, data_download_dd6_1.readDd6CanonicalGitBlob)(root, "../outside"), /path is invalid/);
    });
    it("rejects detached lineage, envelope drift and row reclassification", async () => {
        const root = process.cwd();
        const lock = JSON.parse((0, fs_1.readFileSync)((0, path_1.resolve)(root, "database-data-download-captures/data-download-dd6-source-lock.json"), "utf8"));
        const dd2 = validDd2();
        const value = await (0, data_download_dd6_1.buildDd6)(root, lock, dd2);
        assert_1.strict.equal((0, data_download_dd6_1.validateDd6)(value, lock, dd2).valid, true);
        const forgedDd2 = JSON.parse(JSON.stringify(dd2));
        forgedDd2.database.descriptorObservationCount = 2;
        await assert_1.strict.rejects((0, data_download_dd6_1.buildDd6)(root, lock, forgedDd2), /DD2 input validation/);
        const detached = JSON.parse(JSON.stringify(value));
        detached.sourceLineage = [];
        assert_1.strict.equal((0, data_download_dd6_1.validateDd6)(detached, lock, dd2).valid, false);
        const changedVersion = JSON.parse(JSON.stringify(value));
        changedVersion.contractVersion = "forged";
        assert_1.strict.equal((0, data_download_dd6_1.validateDd6)(changedVersion, lock, dd2).valid, false);
        const changedRow = JSON.parse(JSON.stringify(value));
        changedRow.rows[0].classification = "unknown";
        changedRow.totals.agreement -= 1;
        changedRow.totals.unknown += 1;
        assert_1.strict.equal((0, data_download_dd6_1.validateDd6)(changedRow, lock, dd2).valid, false);
        const forgedLineage = JSON.parse(JSON.stringify(value));
        forgedLineage.sourceLineage[0].sha256 = "f".repeat(64);
        assert_1.strict.equal((0, data_download_dd6_1.validateDd6)(forgedLineage, lock, dd2).valid, false);
        const forgedInput = JSON.parse(JSON.stringify(value));
        forgedInput.inputLineage.sha256 = "f".repeat(64);
        assert_1.strict.equal((0, data_download_dd6_1.validateDd6)(forgedInput, lock, dd2).valid, false);
        const forgedReason = JSON.parse(JSON.stringify(value));
        forgedReason.rows[0].reason = "forged observations";
        assert_1.strict.equal((0, data_download_dd6_1.validateDd6)(forgedReason, lock, dd2).valid, false);
    });
    it("rejects false-completeness accounting and identity drift", () => {
        const value = { schemaVersion: 1, contract: "dokkan-data-download-shadow-parity", contractVersion: "0.9.0", generatedAt: "2026-08-13T00:00:00.000Z", collectionMode: "offline_pinned_document_and_code_comparison", defaultEnabled: false, productionMutation: false, identityPolicy: "structural_endpoint_field_and_exact_path_only_no_names_or_localized_text", sourceIdentityPolicy: "git_blob_bytes_v1", sourceLineage: [], inputLineage: { contract: "dokkan-data-download-asset-contracts", contractVersion: "0.1.0", identityPolicy: "recursive_lexicographic_json_v1", sizeBytes: 1, sha256: "a".repeat(64) }, rows: [{ subject: "x", prior: "x", classification: "unknown", units: 1, reason: "x" }], totals: { agreement: 0, representation_gain: 0, representation_mismatch: 0, confirmed_conflict: 0, unknown: 0, unjoinable: 0 }, completenessWarning: "zero_confirmed_conflicts_never_implies_completeness" };
        assert_1.strict.equal((0, data_download_dd6_1.validateDd6)(value).valid, false);
        const changed = { ...value, totals: { ...value.totals, unknown: 1 }, identityPolicy: "names_are_identity" };
        assert_1.strict.equal((0, data_download_dd6_1.validateDd6)(changed).valid, false);
    });
});
//# sourceMappingURL=data-download-dd6.spec.js.map