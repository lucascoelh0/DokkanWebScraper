import { deepEqual, equal, throws } from "assert";
import { scanGameDbAcquisitionTargets } from "./game-db-acquisition-staged-scan";

describe("game DB acquisition staged scanner", () => {
    it("accepts bounded source text", () => {
        const result = scanGameDbAcquisitionTargets([{ name: "game-db/helper.ts", bytes: Buffer.from("export const safe = true;\n") }]);
        equal(result.valid, true);
        equal(result.targetCount, 1);
    });

    it("rejects artifacts, account material and sensitive query values", () => {
        const result = scanGameDbAcquisitionTargets([
            { name: "data/database.db", bytes: Buffer.from("SQLite format 3\0") },
            { name: "capture.har", bytes: Buffer.from("{}") },
            { name: "docs/leak.md", bytes: Buffer.from("Authorization: " + "Bearer " + "abcdefghijklmnop") },
            { name: "docs/query.md", bytes: Buffer.from("https://example.test/a?" + "token=" + "secretvalue") },
        ]);
        equal(result.valid, false);
        deepEqual(result.failures.map(value => value.reason), [
            "forbidden_path_or_artifact_type",
            "forbidden_path_or_artifact_type",
            "credential_or_sensitive_query_pattern",
            "credential_or_sensitive_query_pattern",
        ]);
    });

    it("fails closed without staged targets and on binary content", () => {
        throws(() => scanGameDbAcquisitionTargets([]), /at least one/);
        const result = scanGameDbAcquisitionTargets([{ name: "game-db/value.ts", bytes: Buffer.from([1, 0, 2]) }]);
        deepEqual(result.failures, [{ name: "game-db/value.ts", reason: "binary_or_nul_content" }]);
    });
});
