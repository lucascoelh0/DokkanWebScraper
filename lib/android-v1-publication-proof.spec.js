"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const promises_1 = require("fs/promises");
const os_1 = require("os");
const path_1 = require("path");
const mocha_1 = require("mocha");
const android_v1_contract_projector_1 = require("./android-v1-contract-projector");
const android_v1_publication_proof_1 = require("./android-v1-publication-proof");
(0, mocha_1.describe)("Android v1 publication proof", function () {
    let root;
    let reportPath;
    (0, mocha_1.beforeEach)(async () => {
        root = await (0, promises_1.mkdtemp)((0, path_1.resolve)((0, os_1.tmpdir)(), "dokkan-v1-publication-proof-"));
        reportPath = (0, path_1.resolve)(root, "report.json");
    });
    (0, mocha_1.afterEach)(async () => {
        await (0, promises_1.rm)(root, { recursive: true, force: true });
    });
    (0, mocha_1.it)("accepts only the exact paired projector output manifests", async () => {
        const characters = characterManifest();
        const teamAnalysis = teamManifest(characters.sha256);
        await writeReport(reportPath, characters, teamAnalysis);
        await (0, android_v1_publication_proof_1.assertAndroidV1PublicationProof)(reportPath, { characters, teamAnalysis });
        await (0, assert_1.rejects)((0, android_v1_publication_proof_1.assertAndroidV1PublicationProof)(reportPath, {
            characters: { ...characters, sha256: "b".repeat(64) },
            teamAnalysis,
        }), /Character manifest does not match/);
    });
    (0, mocha_1.it)("rejects a report whose Character and Team Analysis outputs are not bound", async () => {
        const characters = characterManifest();
        const teamAnalysis = teamManifest("c".repeat(64));
        await writeReport(reportPath, characters, teamAnalysis);
        await (0, assert_1.rejects)((0, android_v1_publication_proof_1.assertAndroidV1PublicationProof)(reportPath, { characters }), /exact Character\/Team Analysis pair/);
    });
});
function characterManifest() {
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
function teamManifest(characterSha256) {
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
async function writeReport(reportPath, characters, teamAnalysis) {
    await (0, promises_1.writeFile)(reportPath, `${JSON.stringify({
        schemaVersion: 1,
        contract: "dokkanpanion-android-v1-projection",
        projectorVersion: android_v1_contract_projector_1.ANDROID_V1_PROJECTOR_VERSION,
        consumerCommit: android_v1_contract_projector_1.ANDROID_V1_CONSUMER_COMMIT,
        input: { characters, teamAnalysis },
        output: { characters, teamAnalysis },
        changes: {},
        files: {},
    }, null, 2)}\n`, "utf8");
}
//# sourceMappingURL=android-v1-publication-proof.spec.js.map