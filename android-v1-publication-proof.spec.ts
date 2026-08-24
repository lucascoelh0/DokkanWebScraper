import { rejects } from "assert";
import { mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { resolve } from "path";
import { afterEach, beforeEach, describe, it } from "mocha";
import {
    ANDROID_V1_CONSUMER_COMMIT,
    ANDROID_V1_PROJECTOR_VERSION,
} from "./android-v1-contract-projector";
import { assertAndroidV1PublicationProof } from "./android-v1-publication-proof";

describe("Android v1 publication proof", function () {
    let root: string;
    let reportPath: string;

    beforeEach(async () => {
        root = await mkdtemp(resolve(tmpdir(), "dokkan-v1-publication-proof-"));
        reportPath = resolve(root, "report.json");
    });

    afterEach(async () => {
        await rm(root, { recursive: true, force: true });
    });

    it("accepts only the exact paired projector output manifests", async () => {
        const characters = characterManifest();
        const teamAnalysis = teamManifest(characters.sha256);
        await writeReport(reportPath, characters, teamAnalysis);

        await assertAndroidV1PublicationProof(reportPath, { characters, teamAnalysis });
        await rejects(
            assertAndroidV1PublicationProof(reportPath, {
                characters: { ...characters, sha256: "b".repeat(64) },
                teamAnalysis,
            }),
            /Character manifest does not match/,
        );
    });

    it("rejects a report whose Character and Team Analysis outputs are not bound", async () => {
        const characters = characterManifest();
        const teamAnalysis = teamManifest("c".repeat(64));
        await writeReport(reportPath, characters, teamAnalysis);

        await rejects(
            assertAndroidV1PublicationProof(reportPath, { characters }),
            /exact Character\/Team Analysis pair/,
        );
    });
});

function characterManifest(): any {
    return {
        schemaVersion: 1,
        datasetVersion: "characters-v1",
        generatedAt: "2026-08-24T00:00:00.000Z",
        fileName: "characters.json.gz",
        compression: "gzip",
        sha256: "a".repeat(64),
        sizeBytes: 1,
        uncompressedSizeBytes: 1,
        characterCount: 1,
    };
}

function teamManifest(characterSha256: string): any {
    return {
        schemaVersion: 1,
        datasetVersion: "characters-v1:parser-1.9.14",
        generatedAt: "2026-08-24T00:00:00.000Z",
        fileName: "team-analysis.json.gz",
        compression: "gzip",
        sha256: "d".repeat(64),
        sizeBytes: 1,
        uncompressedSizeBytes: 1,
        stateCount: 1,
        rulesVersion: "1",
        parserVersion: "1.9.14",
        sourceCharacterDatasetVersion: "characters-v1",
        sourceCharacterPayloadSha256: characterSha256,
    };
}

async function writeReport(reportPath: string, characters: any, teamAnalysis: any): Promise<void> {
    await writeFile(reportPath, `${JSON.stringify({
        schemaVersion: 1,
        contract: "dokkanpanion-android-v1-projection",
        projectorVersion: ANDROID_V1_PROJECTOR_VERSION,
        consumerCommit: ANDROID_V1_CONSUMER_COMMIT,
        input: { characters, teamAnalysis },
        output: { characters, teamAnalysis },
        changes: {},
        files: {},
    }, null, 2)}\n`, "utf8");
}
