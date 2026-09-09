import { deepStrictEqual, rejects, strictEqual, throws } from "assert";
import { createHash } from "crypto";
import { mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { gzipSync } from "zlib";
import { describe, it } from "mocha";
import { parseSaTrainingArgs, readSaSourcePayload } from "./game-db-sa-training-run";

const args = () => [
    "--first-party-dir", "source", "--primary-manifest", "pm", "--primary-payload", "pp",
    "--stage-manifest", "sm", "--stage-catalog", "sc", "--awakening-manifest", "am",
    "--awakening-payload", "ap", "--output-dir", "candidate", "--generated-at", "2026-09-08T18:00:00.000Z",
];

describe("SA training local candidate boundary", () => {
    it("keeps canonical timestamps and accepts equals flags", () => {
        strictEqual(parseSaTrainingArgs(args()).generatedAt, "2026-09-08T18:00:00.000Z");
        const equal = args();
        equal.splice(0, 2, "--first-party-dir=source");
        deepStrictEqual(parseSaTrainingArgs(equal), parseSaTrainingArgs(args()));
    });

    it("rejects unknown, duplicate, absent, malformed and publication arguments", () => {
        throws(() => parseSaTrainingArgs([...args(), "--publish", "yes"]));
        throws(() => parseSaTrainingArgs([...args(), "--output-dir", "second"]));
        throws(() => parseSaTrainingArgs(args().slice(2)));
        const missing = args(); missing.splice(1, 1);
        throws(() => parseSaTrainingArgs(missing));
        const date = args(); date[date.length - 1] = "2026-09-08";
        throws(() => parseSaTrainingArgs(date));
    });

    it("verifies compressed and expanded bytes; rejects forged or excessive descriptors", async () => {
        const root = await mkdtemp(join(tmpdir(), "sa-source-test-"));
        try {
            const raw = Buffer.from('{"version":"with-exact-.000Z"}');
            const gzip = gzipSync(raw);
            const file = join(root, "source.gz");
            await writeFile(file, gzip, { flag: "wx" });
            const descriptor = {
                sha256: createHash("sha256").update(gzip).digest("hex"),
                sizeBytes: gzip.length, expandedSizeBytes: raw.length,
            };
            strictEqual((await readSaSourcePayload(file, descriptor)).value.version, "with-exact-.000Z");
            await rejects(readSaSourcePayload(file, { ...descriptor, sha256: "0".repeat(64) }));
            await rejects(readSaSourcePayload(file, { ...descriptor, sizeBytes: gzip.length + 1 }));
            await rejects(readSaSourcePayload(file, { ...descriptor, expandedSizeBytes: raw.length - 1 }));
            await rejects(readSaSourcePayload(file, { ...descriptor, expandedSizeBytes: raw.length + 1 }));
            await rejects(readSaSourcePayload(file, { ...descriptor, expandedSizeBytes: 129 * 1024 * 1024 }));
        } finally {
            // Only the concrete directory returned by mkdtemp for this test.
            await rm(root, { recursive: true, force: true });
        }
    });
});
