"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = require("crypto");
const assert_1 = require("assert");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const os_1 = require("os");
const events_artifact_path_1 = require("./events-artifact-path");
const events_e1_run_1 = require("./events-e1-run");
const events_e4_run_1 = require("./events-e4-run");
const events_e8_run_1 = require("./events-e8-run");
const events_e9_run_1 = require("./events-e9-run");
const events_refresh_run_1 = require("./events-refresh-run");
async function expectPathError(promise, code) {
    await (0, assert_1.rejects)(promise, error => error instanceof events_artifact_path_1.EventsArtifactPathError && (code === undefined || error.code === code));
}
describe("database-events artifact path containment", () => {
    let temporaryDirectory, root, outside;
    beforeEach(async () => {
        temporaryDirectory = await (0, promises_1.mkdtemp)((0, path_1.join)((0, os_1.tmpdir)(), "dokkan-events-path-"));
        root = (0, path_1.join)(temporaryDirectory, "root");
        outside = (0, path_1.join)(temporaryDirectory, "root-evil");
        await Promise.all([(0, promises_1.mkdir)(root), (0, promises_1.mkdir)(outside)]);
        await Promise.all([(0, promises_1.writeFile)((0, path_1.join)(root, "valid.json"), "inside"), (0, promises_1.writeFile)((0, path_1.join)(outside, "outside.json"), "outside"), (0, promises_1.mkdir)((0, path_1.join)(root, "directory")), (0, promises_1.mkdir)((0, path_1.join)(root, "inside-target"))]);
        await (0, promises_1.writeFile)((0, path_1.join)(root, "inside-target", "inside.json"), "inside-target");
    });
    afterEach(async () => { await (0, promises_1.rm)(temporaryDirectory, { recursive: true, force: true }); });
    it("accepts an allowlisted file directly in the trusted root", async () => {
        (0, assert_1.equal)(await (0, events_artifact_path_1.resolveEventsInputFile)(root, "valid.json", "valid.json"), await require("fs/promises").realpath((0, path_1.join)(root, "valid.json")));
    });
    it("rejects empty, NUL and non-string values", async () => {
        for (const value of ["", "bad\0.json", null, 1, {}, []])
            await expectPathError((0, events_artifact_path_1.resolveEventsArtifactPath)({ trustedRoot: root, untrustedPath: value, expectedType: "file" }), "INVALID_VALUE");
        await expectPathError((0, events_artifact_path_1.resolveEventsArtifactPath)({ trustedRoot: root, untrustedPath: "valid.json", expectedType: "socket" }), "INVALID_VALUE");
    });
    it("rejects traversal, absolute, drive-qualified, UNC, device and mixed-separator paths", async () => {
        const hostile = ["../outside.json", "a/b/../../../outside.json", "C:\\outside.json", "/outside.json", "C:relative.json", "\\\\server\\share\\outside.json", "\\\\?\\C:\\outside.json", "..\\outside.json", "a/./inside.json", "a/../inside.json"];
        for (const value of hostile)
            await expectPathError((0, events_artifact_path_1.resolveEventsArtifactPath)({ trustedRoot: root, untrustedPath: value, expectedType: "file" }));
    });
    it("uses real containment rather than accepting a root prefix collision", async () => {
        await (0, promises_1.symlink)(outside, (0, path_1.join)(root, "collision"), "junction");
        await expectPathError((0, events_artifact_path_1.resolveEventsArtifactPath)({ trustedRoot: root, untrustedPath: "collision/outside.json", expectedType: "file" }), "OUTSIDE_ROOT");
    });
    it("rejects a file symlink that targets outside when the environment permits it", async function () {
        try {
            await (0, promises_1.symlink)((0, path_1.join)(outside, "outside.json"), (0, path_1.join)(root, "valid.json.link"), "file");
        }
        catch (error) {
            if (["EPERM", "EACCES", "UNKNOWN"].includes(error?.code))
                this.skip();
            throw error;
        }
        await expectPathError((0, events_artifact_path_1.resolveEventsArtifactPath)({ trustedRoot: root, untrustedPath: "valid.json.link", expectedType: "file" }), "OUTSIDE_ROOT");
    });
    it("rejects an external directory junction for reads and missing outputs", async () => {
        await (0, promises_1.symlink)(outside, (0, path_1.join)(root, "external"), "junction");
        await expectPathError((0, events_artifact_path_1.resolveEventsArtifactPath)({ trustedRoot: root, untrustedPath: "external/outside.json", expectedType: "file" }), "OUTSIDE_ROOT");
        await expectPathError((0, events_artifact_path_1.resolveEventsArtifactPath)({ trustedRoot: root, untrustedPath: "external/new.json", expectedType: "file", allowMissing: true }), "OUTSIDE_ROOT");
    });
    it("allows a junction whose final target remains inside the trusted root", async () => {
        await (0, promises_1.symlink)((0, path_1.join)(root, "inside-target"), (0, path_1.join)(root, "internal"), "junction");
        (0, assert_1.equal)(await (0, promises_1.readFile)(await (0, events_artifact_path_1.resolveEventsArtifactPath)({ trustedRoot: root, untrustedPath: "internal/inside.json", expectedType: "file" }), "utf8"), "inside-target");
    });
    it("rejects missing artifacts by default and validates missing output parents", async () => {
        await expectPathError((0, events_artifact_path_1.resolveEventsInputFile)(root, "missing.json", "missing.json"), "NOT_FOUND");
        const outputs = await (0, events_artifact_path_1.resolveEventsOutputFiles)(root, ["missing.json"]);
        (0, assert_1.equal)(outputs.get("missing.json"), (0, path_1.resolve)(root, "missing.json"));
        await expectPathError((0, events_artifact_path_1.resolveEventsArtifactPath)({ trustedRoot: root, untrustedPath: "missing-parent/file.json", expectedType: "file", allowMissing: true }), "NOT_FOUND");
    });
    it("rejects file/directory type mismatches and names outside the allowlist", async () => {
        (0, assert_1.equal)(await (0, events_artifact_path_1.resolveEventsArtifactPath)({ trustedRoot: root, untrustedPath: "directory", expectedType: "directory", allowedNames: ["directory", "other"] }), await require("fs/promises").realpath((0, path_1.join)(root, "directory")));
        await expectPathError((0, events_artifact_path_1.resolveEventsArtifactPath)({ trustedRoot: root, untrustedPath: "directory", expectedType: "file" }), "TYPE_MISMATCH");
        await expectPathError((0, events_artifact_path_1.resolveEventsArtifactPath)({ trustedRoot: root, untrustedPath: "valid.json", expectedType: "directory" }), "TYPE_MISMATCH");
        await expectPathError((0, events_artifact_path_1.resolveEventsArtifactPath)({ trustedRoot: root, untrustedPath: "valid.json", expectedType: "file", allowedNames: ["expected.json"] }), "NAME_NOT_ALLOWED");
        await expectPathError((0, events_artifact_path_1.resolveEventsArtifactPath)({ trustedRoot: root, untrustedPath: "sub/valid.json", expectedType: "file", exactName: "valid.json" }), "NAME_NOT_ALLOWED");
    });
});
describe("database-events consumer path mutations", () => {
    let temporaryDirectory, inputDir, outsideFile;
    beforeEach(async () => {
        temporaryDirectory = await (0, promises_1.mkdtemp)((0, path_1.join)((0, os_1.tmpdir)(), "dokkan-events-consumer-"));
        inputDir = (0, path_1.join)(temporaryDirectory, "input");
        await (0, promises_1.mkdir)(inputDir);
        outsideFile = (0, path_1.join)(temporaryDirectory, "outside.json");
        await (0, promises_1.writeFile)(outsideFile, "external sentinel must not be parsed");
    });
    afterEach(async () => { await (0, promises_1.rm)(temporaryDirectory, { recursive: true, force: true }); });
    async function writeE0Manifest(changed) {
        const manifest = { fileName: "events-e0-inventory.json", coverage: { fileName: "events-e0-coverage.json" }, validation: { fileName: "events-e0-validation.json" } };
        if (changed === "payload")
            manifest.fileName = "../outside.json";
        else
            manifest[changed].fileName = "../outside.json";
        await Promise.all([(0, promises_1.writeFile)((0, path_1.join)(inputDir, "events-e0-manifest.json"), JSON.stringify(manifest)), (0, promises_1.writeFile)((0, path_1.join)(inputDir, "events-e0-inventory.json"), "{}"), (0, promises_1.writeFile)((0, path_1.join)(inputDir, "events-e0-coverage.json"), "{}"), (0, promises_1.writeFile)((0, path_1.join)(inputDir, "events-e0-validation.json"), "{}")]);
    }
    for (const field of ["payload", "coverage", "validation"])
        it(`rejects an E0 manifest whose ${field} escapes before the external artifact is consumed`, async () => {
            await writeE0Manifest(field);
            await expectPathError((0, events_e1_run_1.runEventsE1)({ e0Dir: inputDir, databasePath: (0, path_1.join)(temporaryDirectory, "missing.db") }), "INVALID_PATH");
        });
    it("rejects an E3 golden outside its manifest root", async () => {
        const e3Manifest = { fileName: "events-e3-encounters.json", coverage: { fileName: "events-e3-coverage.json" }, validation: { fileName: "events-e3-validation.json" }, goldens: { fileName: "../outside.json" } };
        const e2Manifest = { fileName: "events-e2-topology.json" };
        await Promise.all([(0, promises_1.writeFile)((0, path_1.join)(inputDir, "events-e3-manifest.json"), JSON.stringify(e3Manifest)), (0, promises_1.writeFile)((0, path_1.join)(inputDir, "events-e2-manifest.json"), JSON.stringify(e2Manifest)), (0, promises_1.writeFile)((0, path_1.join)(inputDir, "events-e3-encounters.json"), "{}"), (0, promises_1.writeFile)((0, path_1.join)(inputDir, "events-e3-coverage.json"), "{}"), (0, promises_1.writeFile)((0, path_1.join)(inputDir, "events-e3-validation.json"), "{}"), (0, promises_1.writeFile)((0, path_1.join)(inputDir, "events-e2-topology.json"), "{}")]);
        await expectPathError((0, events_e4_run_1.runEventsE4)({ e3Dir: inputDir, e2Dir: inputDir, databasePath: (0, path_1.join)(temporaryDirectory, "missing.db") }), "INVALID_PATH");
    });
    it("rejects an E8 receipt outside its manifest root", async () => {
        const e7Manifest = { fileName: "events-e7-shadow-parity.json", coverage: { fileName: "events-e7-coverage.json" }, validation: { fileName: "events-e7-validation.json" } };
        const e8Manifest = { fileName: "events-sidecars.json", coverage: { fileName: "events-e8-coverage.json" }, validation: { fileName: "events-e8-validation.json" }, refreshReceipt: { fileName: "../outside.json" } };
        await Promise.all([(0, promises_1.writeFile)((0, path_1.join)(inputDir, "events-e7-manifest.json"), JSON.stringify(e7Manifest)), (0, promises_1.writeFile)((0, path_1.join)(inputDir, "events-e8-manifest.json"), JSON.stringify(e8Manifest)), (0, promises_1.writeFile)((0, path_1.join)(inputDir, "events-e7-shadow-parity.json"), "{}"), (0, promises_1.writeFile)((0, path_1.join)(inputDir, "events-e7-coverage.json"), "{}"), (0, promises_1.writeFile)((0, path_1.join)(inputDir, "events-e7-validation.json"), "{}"), (0, promises_1.writeFile)((0, path_1.join)(inputDir, "events-sidecars.json"), "{}"), (0, promises_1.writeFile)((0, path_1.join)(inputDir, "events-e8-coverage.json"), "{}"), (0, promises_1.writeFile)((0, path_1.join)(inputDir, "events-e8-validation.json"), "{}")]);
        await expectPathError((0, events_e9_run_1.runEventsE9)({ inputDir }), "INVALID_PATH");
    });
    it("rejects a refresh profile baseline outside the profile directory in E8 and the refresh runner", async () => {
        const sourceProfile = JSON.parse(await (0, promises_1.readFile)((0, path_1.join)(process.cwd(), "database-events", "events-e8-refresh-profile.json"), "utf8"));
        sourceProfile.baselineFiles[0].fileName = "../outside.json";
        sourceProfile.baselineFiles[0].sha256 = (0, crypto_1.createHash)("sha256").update(await (0, promises_1.readFile)(outsideFile)).digest("hex");
        const profilePath = (0, path_1.join)(inputDir, "profile.json");
        await (0, promises_1.writeFile)(profilePath, JSON.stringify(sourceProfile));
        await expectPathError((0, events_e8_run_1.runEventsE8)({ inputDir, refreshProfilePath: profilePath }), "INVALID_PATH");
        await expectPathError((0, events_refresh_run_1.runEventsRefresh)({ refreshProfilePath: profilePath, outputDir: (0, path_1.join)(temporaryDirectory, "output") }), "INVALID_PATH");
    });
    it("rejects a manifest symlink to an external artifact before parsing it", async () => {
        const manifest = { fileName: "events-e0-inventory.json", coverage: { fileName: "events-e0-coverage.json" }, validation: { fileName: "events-e0-validation.json" } };
        await Promise.all([(0, promises_1.writeFile)((0, path_1.join)(inputDir, "events-e0-manifest.json"), JSON.stringify(manifest)), (0, promises_1.writeFile)((0, path_1.join)(inputDir, "events-e0-coverage.json"), "{}"), (0, promises_1.writeFile)((0, path_1.join)(inputDir, "events-e0-validation.json"), "{}")]);
        const externalDirectory = (0, path_1.join)(temporaryDirectory, "external");
        await (0, promises_1.mkdir)(externalDirectory);
        await (0, promises_1.writeFile)((0, path_1.join)(externalDirectory, "events-e0-inventory.json"), "external sentinel");
        await (0, promises_1.symlink)(externalDirectory, (0, path_1.join)(inputDir, "payload-link"), "junction");
        await (0, promises_1.rm)((0, path_1.join)(inputDir, "events-e0-manifest.json"));
        manifest.fileName = "payload-link/events-e0-inventory.json";
        await (0, promises_1.writeFile)((0, path_1.join)(inputDir, "events-e0-manifest.json"), JSON.stringify(manifest));
        await expectPathError((0, events_e1_run_1.runEventsE1)({ e0Dir: inputDir, databasePath: (0, path_1.join)(temporaryDirectory, "missing.db") }), "NAME_NOT_ALLOWED");
        (0, assert_1.ok)((await (0, promises_1.readFile)((0, path_1.join)(externalDirectory, "events-e0-inventory.json"), "utf8")).startsWith("external"));
    });
});
//# sourceMappingURL=events-artifact-path.spec.js.map