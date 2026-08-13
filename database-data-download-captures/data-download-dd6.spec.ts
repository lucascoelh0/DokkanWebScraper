import { strict as assert } from "assert";
import { readFileSync } from "fs";
import { resolve } from "path";
import { Dd6Dataset, Dd6SourceLock, validateDd6, validateDd6SourceLock } from "./data-download-dd6";

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

    it("rejects false-completeness accounting and identity drift", () => {
        const value: Dd6Dataset = { schemaVersion: 1, contract: "dokkan-data-download-shadow-parity", contractVersion: "0.7.0", generatedAt: "2026-08-13T00:00:00.000Z", collectionMode: "offline_pinned_document_and_code_comparison", defaultEnabled: false, productionMutation: false, identityPolicy: "structural_endpoint_field_and_exact_path_only_no_names_or_localized_text", sourceLineage: [], rows: [{ subject: "x", prior: "x", classification: "unknown", units: 1, reason: "x" }], totals: { agreement: 0, representation_gain: 0, representation_mismatch: 0, confirmed_conflict: 0, unknown: 0, unjoinable: 0 }, completenessWarning: "zero_confirmed_conflicts_never_implies_completeness" };
        assert.equal(validateDd6(value).valid, false);
        const changed: any = { ...value, totals: { ...value.totals, unknown: 1 }, identityPolicy: "names_are_identity" };
        assert.equal(validateDd6(changed).valid, false);
    });
});
