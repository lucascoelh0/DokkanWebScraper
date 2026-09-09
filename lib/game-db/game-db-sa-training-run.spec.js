"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const crypto_1 = require("crypto");
const promises_1 = require("fs/promises");
const os_1 = require("os");
const path_1 = require("path");
const zlib_1 = require("zlib");
const mocha_1 = require("mocha");
const game_db_sa_training_run_1 = require("./game-db-sa-training-run");
const args = () => [
    "--first-party-dir", "source", "--primary-manifest", "pm", "--primary-payload", "pp",
    "--stage-manifest", "sm", "--stage-catalog", "sc", "--awakening-manifest", "am",
    "--awakening-payload", "ap", "--output-dir", "candidate", "--generated-at", "2026-09-08T18:00:00.000Z",
];
(0, mocha_1.describe)("SA training local candidate boundary", () => {
    (0, mocha_1.it)("keeps canonical timestamps and accepts equals flags", () => {
        (0, assert_1.strictEqual)((0, game_db_sa_training_run_1.parseSaTrainingArgs)(args()).generatedAt, "2026-09-08T18:00:00.000Z");
        const equal = args();
        equal.splice(0, 2, "--first-party-dir=source");
        (0, assert_1.deepStrictEqual)((0, game_db_sa_training_run_1.parseSaTrainingArgs)(equal), (0, game_db_sa_training_run_1.parseSaTrainingArgs)(args()));
    });
    (0, mocha_1.it)("rejects unknown, duplicate, absent, malformed and publication arguments", () => {
        (0, assert_1.throws)(() => (0, game_db_sa_training_run_1.parseSaTrainingArgs)([...args(), "--publish", "yes"]));
        (0, assert_1.throws)(() => (0, game_db_sa_training_run_1.parseSaTrainingArgs)([...args(), "--output-dir", "second"]));
        (0, assert_1.throws)(() => (0, game_db_sa_training_run_1.parseSaTrainingArgs)(args().slice(2)));
        const missing = args();
        missing.splice(1, 1);
        (0, assert_1.throws)(() => (0, game_db_sa_training_run_1.parseSaTrainingArgs)(missing));
        const date = args();
        date[date.length - 1] = "2026-09-08";
        (0, assert_1.throws)(() => (0, game_db_sa_training_run_1.parseSaTrainingArgs)(date));
    });
    (0, mocha_1.it)("verifies compressed and expanded bytes; rejects forged or excessive descriptors", async () => {
        const root = await (0, promises_1.mkdtemp)((0, path_1.join)((0, os_1.tmpdir)(), "sa-source-test-"));
        try {
            const raw = Buffer.from('{"version":"with-exact-.000Z"}');
            const gzip = (0, zlib_1.gzipSync)(raw);
            const file = (0, path_1.join)(root, "source.gz");
            await (0, promises_1.writeFile)(file, gzip, { flag: "wx" });
            const descriptor = {
                sha256: (0, crypto_1.createHash)("sha256").update(gzip).digest("hex"),
                sizeBytes: gzip.length, expandedSizeBytes: raw.length,
            };
            (0, assert_1.strictEqual)((await (0, game_db_sa_training_run_1.readSaSourcePayload)(file, descriptor)).value.version, "with-exact-.000Z");
            await (0, assert_1.rejects)((0, game_db_sa_training_run_1.readSaSourcePayload)(file, { ...descriptor, sha256: "0".repeat(64) }));
            await (0, assert_1.rejects)((0, game_db_sa_training_run_1.readSaSourcePayload)(file, { ...descriptor, sizeBytes: gzip.length + 1 }));
            await (0, assert_1.rejects)((0, game_db_sa_training_run_1.readSaSourcePayload)(file, { ...descriptor, expandedSizeBytes: raw.length - 1 }));
            await (0, assert_1.rejects)((0, game_db_sa_training_run_1.readSaSourcePayload)(file, { ...descriptor, expandedSizeBytes: raw.length + 1 }));
            await (0, assert_1.rejects)((0, game_db_sa_training_run_1.readSaSourcePayload)(file, { ...descriptor, expandedSizeBytes: 129 * 1024 * 1024 }));
        }
        finally {
            // Only the concrete directory returned by mkdtemp for this test.
            await (0, promises_1.rm)(root, { recursive: true, force: true });
        }
    });
});
//# sourceMappingURL=game-db-sa-training-run.spec.js.map