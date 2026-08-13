"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const game_db_acquisition_staged_scan_1 = require("./game-db-acquisition-staged-scan");
describe("game DB acquisition staged scanner", () => {
    it("accepts bounded source text", () => {
        const result = (0, game_db_acquisition_staged_scan_1.scanGameDbAcquisitionTargets)([{ name: "game-db/helper.ts", bytes: Buffer.from("export const safe = true;\n") }]);
        (0, assert_1.equal)(result.valid, true);
        (0, assert_1.equal)(result.targetCount, 1);
    });
    it("rejects artifacts, account material and sensitive query values", () => {
        const result = (0, game_db_acquisition_staged_scan_1.scanGameDbAcquisitionTargets)([
            { name: "data/database.db", bytes: Buffer.from("SQLite format 3\0") },
            { name: "capture.har", bytes: Buffer.from("{}") },
            { name: "docs/leak.md", bytes: Buffer.from("Authorization: " + "Bearer " + "abcdefghijklmnop") },
            { name: "docs/query.md", bytes: Buffer.from("https://example.test/a?" + "token=" + "secretvalue") },
        ]);
        (0, assert_1.equal)(result.valid, false);
        (0, assert_1.deepEqual)(result.failures.map(value => value.reason), [
            "forbidden_path_or_artifact_type",
            "forbidden_path_or_artifact_type",
            "credential_or_sensitive_query_pattern",
            "credential_or_sensitive_query_pattern",
        ]);
    });
    it("fails closed without staged targets and on binary content", () => {
        (0, assert_1.throws)(() => (0, game_db_acquisition_staged_scan_1.scanGameDbAcquisitionTargets)([]), /at least one/);
        const result = (0, game_db_acquisition_staged_scan_1.scanGameDbAcquisitionTargets)([{ name: "game-db/value.ts", bytes: Buffer.from([1, 0, 2]) }]);
        (0, assert_1.deepEqual)(result.failures, [{ name: "game-db/value.ts", reason: "binary_or_nul_content" }]);
    });
});
//# sourceMappingURL=game-db-acquisition-staged-scan.spec.js.map