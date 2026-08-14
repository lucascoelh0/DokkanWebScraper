import { strict as assert } from "assert";
import { readFileSync } from "fs";
import { resolve } from "path";
import { buildDd6, Dd6Dataset, Dd6SourceLock, readDd6CanonicalGitBlob, validateDd6, validateDd6SourceLock } from "./data-download-dd6";

describe("data download DD6", () => {
    it("rejects parity source paths outside the repository and lock drift", async () => {
        const lock = JSON.parse(readFileSync(resolve(process.cwd(), "database-data-download-captures/data-download-dd6-source-lock.json"), "utf8")) as Dd6SourceLock;
        const changed: any = JSON.parse(JSON.stringify(lock));
        changed.artifacts[0].fileName = "../outside.md";
        await assert.rejects(validateDd6SourceLock(process.cwd(), changed), /rejected|mismatch/);
        const changedContract: any = JSON.parse(JSON.stringify(lock));
        changedContract.contract = "changed";
        await assert.rejects(validateDd6SourceLock(process.cwd(), changedContract), /contract mismatch/);
    });

    it("fails closed when any individual canonical Git-blob pin mutates", async () => {
        const sourceRoot = process.cwd();
        const lock = JSON.parse(readFileSync(resolve(sourceRoot, "database-data-download-captures/data-download-dd6-source-lock.json"), "utf8")) as Dd6SourceLock;
        await validateDd6SourceLock(sourceRoot, lock);
        for (let index = 0; index < lock.artifacts.length; index += 1) {
            const changed: Dd6SourceLock = JSON.parse(JSON.stringify(lock));
            const pin = changed.artifacts[index];
            pin.sha256 = pin.sha256 === "f".repeat(64) ? "e".repeat(64) : "f".repeat(64);
            await assert.rejects(validateDd6SourceLock(sourceRoot, changed), new RegExp(`identity mismatch ${pin.key}`));
        }
    });

    it("reads tracked source identity from HEAD Git blobs, not worktree line endings", async () => {
        const root = process.cwd();
        const bytes = await readDd6CanonicalGitBlob(root, "database-data-download-captures/data-download-dd6.ts");
        assert.ok(bytes.length > 0);
        await assert.rejects(readDd6CanonicalGitBlob(root, "../outside"), /path is invalid/);
    });

    it("rejects detached lineage, envelope drift and row reclassification", async () => {
        const root = process.cwd();
        const lock = JSON.parse(readFileSync(resolve(root, "database-data-download-captures/data-download-dd6-source-lock.json"), "utf8")) as Dd6SourceLock;
        const value = await buildDd6(root, lock, {
            generatedAt: "2026-08-13T00:00:00.000Z",
            database: { descriptorObservationCount: 3 },
            clientAssets: { descriptorObservationCount: 5 },
        } as any);
        assert.equal(validateDd6(value, lock).valid, true);
        const detached: any = JSON.parse(JSON.stringify(value)); detached.sourceLineage = [];
        assert.equal(validateDd6(detached, lock).valid, false);
        const changedVersion: any = JSON.parse(JSON.stringify(value)); changedVersion.contractVersion = "forged";
        assert.equal(validateDd6(changedVersion, lock).valid, false);
        const changedRow: any = JSON.parse(JSON.stringify(value)); changedRow.rows[0].classification = "unknown"; changedRow.totals.agreement -= 1; changedRow.totals.unknown += 1;
        assert.equal(validateDd6(changedRow, lock).valid, false);
        const forgedLineage: any = JSON.parse(JSON.stringify(value)); forgedLineage.sourceLineage[0].sha256 = "f".repeat(64);
        assert.equal(validateDd6(forgedLineage, lock).valid, false);
    });

    it("rejects false-completeness accounting and identity drift", () => {
        const value: Dd6Dataset = { schemaVersion: 1, contract: "dokkan-data-download-shadow-parity", contractVersion: "0.8.0", generatedAt: "2026-08-13T00:00:00.000Z", collectionMode: "offline_pinned_document_and_code_comparison", defaultEnabled: false, productionMutation: false, identityPolicy: "structural_endpoint_field_and_exact_path_only_no_names_or_localized_text", sourceIdentityPolicy: "git_blob_bytes_v1", sourceLineage: [], rows: [{ subject: "x", prior: "x", classification: "unknown", units: 1, reason: "x" }], totals: { agreement: 0, representation_gain: 0, representation_mismatch: 0, confirmed_conflict: 0, unknown: 0, unjoinable: 0 }, completenessWarning: "zero_confirmed_conflicts_never_implies_completeness" };
        assert.equal(validateDd6(value).valid, false);
        const changed: any = { ...value, totals: { ...value.totals, unknown: 1 }, identityPolicy: "names_are_identity" };
        assert.equal(validateDd6(changed).valid, false);
    });
});
