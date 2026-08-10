"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const promises_1 = require("fs/promises");
const os_1 = require("os");
const path_1 = require("path");
const refresh_contract_1 = require("./refresh-contract");
const artifact_path_1 = require("./artifact-path");
const k7_run_1 = require("./k7-run");
const source_1 = require("./source");
async function expectPathError(promise, code) {
    await (0, assert_1.rejects)(promise, error => error instanceof artifact_path_1.DatabaseCharacterArtifactPathError && (code === undefined || error.code === code));
}
describe("database character artifact path containment", () => {
    let temporaryDirectory = "", root = "", outside = "";
    beforeEach(async () => {
        temporaryDirectory = await (0, promises_1.mkdtemp)((0, path_1.join)((0, os_1.tmpdir)(), "dokkan-character-path-"));
        root = (0, path_1.join)(temporaryDirectory, "root");
        outside = (0, path_1.join)(temporaryDirectory, "root-evil");
        await Promise.all([(0, promises_1.mkdir)(root), (0, promises_1.mkdir)(outside)]);
        await Promise.all([(0, promises_1.writeFile)((0, path_1.join)(root, "valid.json"), "inside"), (0, promises_1.writeFile)((0, path_1.join)(outside, "outside.json"), "outside"), (0, promises_1.mkdir)((0, path_1.join)(root, "directory"))]);
    });
    afterEach(async () => { await (0, promises_1.rm)(temporaryDirectory, { recursive: true, force: true }); });
    it("accepts only an allowlisted direct file", async () => {
        (0, assert_1.equal)(await (0, artifact_path_1.resolveCharacterInputFile)(root, "valid.json", "valid.json"), await (0, promises_1.realpath)((0, path_1.join)(root, "valid.json")));
        await expectPathError((0, artifact_path_1.resolveCharacterInputFile)(root, "valid.json", "expected.json"), "NAME_NOT_ALLOWED");
    });
    it("rejects empty, null, non-string and NUL values", async () => {
        for (const value of ["", "bad\0.json", null, 1, {}, []])
            await expectPathError((0, artifact_path_1.resolveDatabaseCharacterArtifactPath)({ trustedRoot: root, untrustedPath: value, expectedType: "file" }), "INVALID_VALUE");
    });
    it("rejects traversal, absolute, drive-relative, UNC, device and mixed-separator paths", async () => {
        const hostile = [
            "../outside.json", "..\\outside.json", "a/b/../../../outside.json", "a\\b\\..\\..\\..\\outside.json",
            "/outside.json", "C:\\outside.json", "C:relative.json", "\\\\server\\share\\outside.json",
            "\\\\?\\C:\\outside.json", "\\\\.\\C:\\outside.json", "a/..\\outside.json", "a\\../outside.json",
        ];
        for (const value of hostile)
            await expectPathError((0, artifact_path_1.resolveDatabaseCharacterArtifactPath)({ trustedRoot: root, untrustedPath: value, expectedType: "file" }), "INVALID_PATH");
    });
    it("rejects a root-prefix collision reached through a real junction", async () => {
        await (0, promises_1.symlink)(outside, (0, path_1.join)(root, "collision"), "junction");
        await expectPathError((0, artifact_path_1.resolveDatabaseCharacterArtifactPath)({ trustedRoot: root, untrustedPath: "collision/outside.json", expectedType: "file" }), "OUTSIDE_ROOT");
    });
    it("rejects a file symlink that escapes when the environment permits it", async function () {
        try {
            await (0, promises_1.symlink)((0, path_1.join)(outside, "outside.json"), (0, path_1.join)(root, "external-link.json"), "file");
        }
        catch (error) {
            if (["EPERM", "EACCES", "UNKNOWN"].includes(error?.code))
                this.skip();
            throw error;
        }
        await expectPathError((0, artifact_path_1.resolveCharacterInputFile)(root, "external-link.json", "external-link.json"), "OUTSIDE_ROOT");
    });
    it("rejects an escaping directory junction and its missing child", async () => {
        await (0, promises_1.symlink)(outside, (0, path_1.join)(root, "external"), "junction");
        await expectPathError((0, artifact_path_1.resolveDatabaseCharacterArtifactPath)({ trustedRoot: root, untrustedPath: "external/outside.json", expectedType: "file" }), "OUTSIDE_ROOT");
        await expectPathError((0, artifact_path_1.resolveDatabaseCharacterArtifactPath)({ trustedRoot: root, untrustedPath: "external/new.json", expectedType: "file", allowMissing: true }), "OUTSIDE_ROOT");
    });
    it("validates file/directory type and only permits missing files explicitly", async () => {
        await expectPathError((0, artifact_path_1.resolveDatabaseCharacterArtifactPath)({ trustedRoot: root, untrustedPath: "directory", expectedType: "file" }), "TYPE_MISMATCH");
        await expectPathError((0, artifact_path_1.resolveDatabaseCharacterArtifactPath)({ trustedRoot: root, untrustedPath: "missing.json", expectedType: "file" }), "NOT_FOUND");
        (0, assert_1.equal)(await (0, artifact_path_1.resolveDatabaseCharacterArtifactPath)({ trustedRoot: root, untrustedPath: "missing.json", expectedType: "file", exactName: "missing.json", allowMissing: true }), (0, path_1.join)(root, "missing.json"));
    });
    it("rejects an external DB1 manifest artifact before attempting to read it", async () => {
        const outsideArtifact = (0, path_1.join)(temporaryDirectory, "outside.gz");
        await (0, promises_1.mkdir)(outsideArtifact);
        const manifest = {
            schemaVersion: 1, contractVersion: "1.1.0", datasetVersion: "fixture", generatedAt: "2026-08-05T00:00:00.000Z",
            fileName: "../outside.gz", compression: "gzip", sha256: source_1.CHARACTER_SOURCE_PROFILE.db1ArtifactSha256,
            sizeBytes: source_1.CHARACTER_SOURCE_PROFILE.db1ArtifactSizeBytes, uncompressedSizeBytes: source_1.CHARACTER_SOURCE_PROFILE.db1UncompressedSizeBytes,
            cardCount: source_1.CHARACTER_SOURCE_PROFILE.db1CardCount, sourceSha256: source_1.CHARACTER_SOURCE_PROFILE.databaseSha256,
            sourceManifestFile: "source-manifest.json",
        };
        const sourceManifest = {
            schemaVersion: 1, sourceKind: "first-party-global-sqlite", snapshotVersion: source_1.CHARACTER_SOURCE_PROFILE.snapshotVersion,
            sha256: source_1.CHARACTER_SOURCE_PROFILE.databaseSha256, sizeBytes: source_1.CHARACTER_SOURCE_PROFILE.databaseSizeBytes,
            tableCount: 232, readOnlyMode: "sqlite-uri-mode-ro+immutable+query-only",
        };
        await Promise.all([
            (0, promises_1.writeFile)((0, path_1.join)(root, "manifest.json"), JSON.stringify(manifest)),
            (0, promises_1.writeFile)((0, path_1.join)(root, "source-manifest.json"), JSON.stringify(sourceManifest)),
        ]);
        await (0, assert_1.rejects)((0, source_1.readCharacterSourceInput)(root), /DB1 manifest file name changed/);
        (0, assert_1.ok)((await (0, promises_1.realpath)(outsideArtifact)).startsWith(temporaryDirectory));
    });
    it("rejects external K7 payload, coverage and validation names during manifest validation", () => {
        const profile = refresh_contract_1.CHARACTER_REFRESH_PROFILE.sidecars.find(sidecar => sidecar.gate === "k1");
        const baseline = {
            schemaVersion: 1, contractVersion: profile.contractVersion, compression: "gzip",
            fileName: profile.artifact.fileName, sha256: profile.artifact.sha256, sizeBytes: profile.artifact.sizeBytes, uncompressedSizeBytes: profile.artifact.uncompressedSizeBytes,
            coverageFile: profile.coverage.fileName, coverageSha256: profile.coverage.sha256, coverageSizeBytes: profile.coverage.sizeBytes,
            validationFile: profile.validation.fileName, validationSha256: profile.validation.sha256, validationSizeBytes: profile.validation.sizeBytes,
            sourceSnapshotVersion: refresh_contract_1.CHARACTER_REFRESH_PROFILE.snapshotVersion, sourceDb1ArtifactSha256: refresh_contract_1.CHARACTER_REFRESH_PROFILE.db1.sha256,
        };
        for (const [field, value] of [["fileName", "../outside.gz"], ["coverageFile", "..\\outside.json"], ["validationFile", "C:\\outside.json"]]) {
            const manifest = { ...baseline, [field]: value };
            (0, assert_1.throws)(() => (0, k7_run_1.validateUpstreamSidecarManifest)("k1", manifest), /K1 manifest contract changed/);
        }
    });
});
//# sourceMappingURL=artifact-path.spec.js.map