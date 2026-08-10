import { equal, ok, rejects, throws } from "assert";
import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { CHARACTER_REFRESH_PROFILE } from "./refresh-contract";
import { DatabaseCharacterArtifactPathError, DatabaseCharacterArtifactPathErrorCode, resolveCharacterInputFile, resolveDatabaseCharacterArtifactPath } from "./artifact-path";
import { validateUpstreamSidecarManifest } from "./k7-run";
import { CHARACTER_SOURCE_PROFILE, readCharacterSourceInput } from "./source";

async function expectPathError(promise: Promise<unknown>, code?: DatabaseCharacterArtifactPathErrorCode) {
    await rejects(promise, error => error instanceof DatabaseCharacterArtifactPathError && (code === undefined || error.code === code));
}

describe("database character artifact path containment", () => {
    let temporaryDirectory = "", root = "", outside = "";

    beforeEach(async () => {
        temporaryDirectory = await mkdtemp(join(tmpdir(), "dokkan-character-path-"));
        root = join(temporaryDirectory, "root");
        outside = join(temporaryDirectory, "root-evil");
        await Promise.all([mkdir(root), mkdir(outside)]);
        await Promise.all([writeFile(join(root, "valid.json"), "inside"), writeFile(join(outside, "outside.json"), "outside"), mkdir(join(root, "directory"))]);
    });

    afterEach(async () => { await rm(temporaryDirectory, { recursive: true, force: true }); });

    it("accepts only an allowlisted direct file", async () => {
        equal(await resolveCharacterInputFile(root, "valid.json", "valid.json"), await realpath(join(root, "valid.json")));
        await expectPathError(resolveCharacterInputFile(root, "valid.json", "expected.json"), "NAME_NOT_ALLOWED");
    });

    it("rejects empty, null, non-string and NUL values", async () => {
        for (const value of ["", "bad\0.json", null, 1, {}, []]) await expectPathError(resolveDatabaseCharacterArtifactPath({ trustedRoot: root, untrustedPath: value, expectedType: "file" }), "INVALID_VALUE");
    });

    it("rejects traversal, absolute, drive-relative, UNC, device and mixed-separator paths", async () => {
        const hostile = [
            "../outside.json", "..\\outside.json", "a/b/../../../outside.json", "a\\b\\..\\..\\..\\outside.json",
            "/outside.json", "C:\\outside.json", "C:relative.json", "\\\\server\\share\\outside.json",
            "\\\\?\\C:\\outside.json", "\\\\.\\C:\\outside.json", "a/..\\outside.json", "a\\../outside.json",
        ];
        for (const value of hostile) await expectPathError(resolveDatabaseCharacterArtifactPath({ trustedRoot: root, untrustedPath: value, expectedType: "file" }), "INVALID_PATH");
    });

    it("rejects a root-prefix collision reached through a real junction", async () => {
        await symlink(outside, join(root, "collision"), "junction");
        await expectPathError(resolveDatabaseCharacterArtifactPath({ trustedRoot: root, untrustedPath: "collision/outside.json", expectedType: "file" }), "OUTSIDE_ROOT");
    });

    it("rejects a file symlink that escapes when the environment permits it", async function () {
        try { await symlink(join(outside, "outside.json"), join(root, "external-link.json"), "file"); }
        catch (error: any) { if (["EPERM", "EACCES", "UNKNOWN"].includes(error?.code)) this.skip(); throw error; }
        await expectPathError(resolveCharacterInputFile(root, "external-link.json", "external-link.json"), "OUTSIDE_ROOT");
    });

    it("rejects an escaping directory junction and its missing child", async () => {
        await symlink(outside, join(root, "external"), "junction");
        await expectPathError(resolveDatabaseCharacterArtifactPath({ trustedRoot: root, untrustedPath: "external/outside.json", expectedType: "file" }), "OUTSIDE_ROOT");
        await expectPathError(resolveDatabaseCharacterArtifactPath({ trustedRoot: root, untrustedPath: "external/new.json", expectedType: "file", allowMissing: true }), "OUTSIDE_ROOT");
    });

    it("validates file/directory type and only permits missing files explicitly", async () => {
        await expectPathError(resolveDatabaseCharacterArtifactPath({ trustedRoot: root, untrustedPath: "directory", expectedType: "file" }), "TYPE_MISMATCH");
        await expectPathError(resolveDatabaseCharacterArtifactPath({ trustedRoot: root, untrustedPath: "missing.json", expectedType: "file" }), "NOT_FOUND");
        equal(await resolveDatabaseCharacterArtifactPath({ trustedRoot: root, untrustedPath: "missing.json", expectedType: "file", exactName: "missing.json", allowMissing: true }), join(root, "missing.json"));
    });

    it("rejects an external DB1 manifest artifact before attempting to read it", async () => {
        const outsideArtifact = join(temporaryDirectory, "outside.gz");
        await mkdir(outsideArtifact);
        const manifest = {
            schemaVersion: 1, contractVersion: "1.1.0", datasetVersion: "fixture", generatedAt: "2026-08-05T00:00:00.000Z",
            fileName: "../outside.gz", compression: "gzip", sha256: CHARACTER_SOURCE_PROFILE.db1ArtifactSha256,
            sizeBytes: CHARACTER_SOURCE_PROFILE.db1ArtifactSizeBytes, uncompressedSizeBytes: CHARACTER_SOURCE_PROFILE.db1UncompressedSizeBytes,
            cardCount: CHARACTER_SOURCE_PROFILE.db1CardCount, sourceSha256: CHARACTER_SOURCE_PROFILE.databaseSha256,
            sourceManifestFile: "source-manifest.json",
        };
        const sourceManifest = {
            schemaVersion: 1, sourceKind: "first-party-global-sqlite", snapshotVersion: CHARACTER_SOURCE_PROFILE.snapshotVersion,
            sha256: CHARACTER_SOURCE_PROFILE.databaseSha256, sizeBytes: CHARACTER_SOURCE_PROFILE.databaseSizeBytes,
            tableCount: 232, readOnlyMode: "sqlite-uri-mode-ro+immutable+query-only",
        };
        await Promise.all([
            writeFile(join(root, "manifest.json"), JSON.stringify(manifest)),
            writeFile(join(root, "source-manifest.json"), JSON.stringify(sourceManifest)),
        ]);
        await rejects(readCharacterSourceInput(root), /DB1 manifest file name changed/);
        ok((await realpath(outsideArtifact)).startsWith(temporaryDirectory));
    });

    it("rejects external K7 payload, coverage and validation names during manifest validation", () => {
        const profile = CHARACTER_REFRESH_PROFILE.sidecars.find(sidecar => sidecar.gate === "k1")!;
        const baseline: any = {
            schemaVersion: 1, contractVersion: profile.contractVersion, compression: "gzip",
            fileName: profile.artifact.fileName, sha256: profile.artifact.sha256, sizeBytes: profile.artifact.sizeBytes, uncompressedSizeBytes: profile.artifact.uncompressedSizeBytes,
            coverageFile: profile.coverage.fileName, coverageSha256: profile.coverage.sha256, coverageSizeBytes: profile.coverage.sizeBytes,
            validationFile: profile.validation.fileName, validationSha256: profile.validation.sha256, validationSizeBytes: profile.validation.sizeBytes,
            sourceSnapshotVersion: CHARACTER_REFRESH_PROFILE.snapshotVersion, sourceDb1ArtifactSha256: CHARACTER_REFRESH_PROFILE.db1.sha256,
        };
        for (const [field, value] of [["fileName", "../outside.gz"], ["coverageFile", "..\\outside.json"], ["validationFile", "C:\\outside.json"]]) {
            const manifest = { ...baseline, [field]: value };
            throws(() => validateUpstreamSidecarManifest("k1", manifest), /K1 manifest contract changed/);
        }
    });
});
