import { createHash } from "crypto";
import { equal, ok, rejects } from "assert";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "fs/promises";
import { basename, join, resolve } from "path";
import { tmpdir } from "os";
import { EventsArtifactPathError, EventsArtifactPathErrorCode, resolveEventsArtifactPath, resolveEventsInputFile, resolveEventsOutputFiles } from "./events-artifact-path";
import { runEventsE1 } from "./events-e1-run";
import { runEventsE4 } from "./events-e4-run";
import { runEventsE8 } from "./events-e8-run";
import { runEventsE9 } from "./events-e9-run";
import { runEventsRefresh } from "./events-refresh-run";

async function expectPathError(promise: Promise<unknown>, code?: EventsArtifactPathErrorCode) {
    await rejects(promise, error => error instanceof EventsArtifactPathError && (code === undefined || error.code === code));
}

describe("database-events artifact path containment", () => {
    let temporaryDirectory: string, root: string, outside: string;
    beforeEach(async () => {
        temporaryDirectory = await mkdtemp(join(tmpdir(), "dokkan-events-path-"));
        root = join(temporaryDirectory, "root");
        outside = join(temporaryDirectory, "root-evil");
        await Promise.all([mkdir(root), mkdir(outside)]);
        await Promise.all([writeFile(join(root, "valid.json"), "inside"), writeFile(join(outside, "outside.json"), "outside"), mkdir(join(root, "directory")), mkdir(join(root, "inside-target"))]);
        await writeFile(join(root, "inside-target", "inside.json"), "inside-target");
    });
    afterEach(async () => { await rm(temporaryDirectory, { recursive: true, force: true }); });

    it("accepts an allowlisted file directly in the trusted root", async () => {
        equal(await resolveEventsInputFile(root, "valid.json", "valid.json"), await require("fs/promises").realpath(join(root, "valid.json")));
    });

    it("rejects empty, NUL and non-string values", async () => {
        for (const value of ["", "bad\0.json", null, 1, {}, []]) await expectPathError(resolveEventsArtifactPath({ trustedRoot: root, untrustedPath: value, expectedType: "file" }), "INVALID_VALUE");
        await expectPathError(resolveEventsArtifactPath({ trustedRoot: root, untrustedPath: "valid.json", expectedType: "socket" as any }), "INVALID_VALUE");
    });

    it("rejects traversal, absolute, drive-qualified, UNC, device and mixed-separator paths", async () => {
        const hostile = ["../outside.json", "a/b/../../../outside.json", "C:\\outside.json", "/outside.json", "C:relative.json", "\\\\server\\share\\outside.json", "\\\\?\\C:\\outside.json", "..\\outside.json", "a/./inside.json", "a/../inside.json"];
        for (const value of hostile) await expectPathError(resolveEventsArtifactPath({ trustedRoot: root, untrustedPath: value, expectedType: "file" }));
    });

    it("uses real containment rather than accepting a root prefix collision", async () => {
        await symlink(outside, join(root, "collision"), "junction");
        await expectPathError(resolveEventsArtifactPath({ trustedRoot: root, untrustedPath: "collision/outside.json", expectedType: "file" }), "OUTSIDE_ROOT");
    });

    it("rejects a file symlink that targets outside when the environment permits it", async function () {
        try { await symlink(join(outside, "outside.json"), join(root, "valid.json.link"), "file"); }
        catch (error: any) { if (["EPERM", "EACCES", "UNKNOWN"].includes(error?.code)) this.skip(); throw error; }
        await expectPathError(resolveEventsArtifactPath({ trustedRoot: root, untrustedPath: "valid.json.link", expectedType: "file" }), "OUTSIDE_ROOT");
    });

    it("rejects an external directory junction for reads and missing outputs", async () => {
        await symlink(outside, join(root, "external"), "junction");
        await expectPathError(resolveEventsArtifactPath({ trustedRoot: root, untrustedPath: "external/outside.json", expectedType: "file" }), "OUTSIDE_ROOT");
        await expectPathError(resolveEventsArtifactPath({ trustedRoot: root, untrustedPath: "external/new.json", expectedType: "file", allowMissing: true }), "OUTSIDE_ROOT");
    });

    it("allows a junction whose final target remains inside the trusted root", async () => {
        await symlink(join(root, "inside-target"), join(root, "internal"), "junction");
        equal(await readFile(await resolveEventsArtifactPath({ trustedRoot: root, untrustedPath: "internal/inside.json", expectedType: "file" }), "utf8"), "inside-target");
    });

    it("rejects missing artifacts by default and validates missing output parents", async () => {
        await expectPathError(resolveEventsInputFile(root, "missing.json", "missing.json"), "NOT_FOUND");
        const outputs = await resolveEventsOutputFiles(root, ["missing.json"]);
        equal(outputs.get("missing.json"), resolve(root, "missing.json"));
        await expectPathError(resolveEventsArtifactPath({ trustedRoot: root, untrustedPath: "missing-parent/file.json", expectedType: "file", allowMissing: true }), "NOT_FOUND");
    });

    it("rejects file/directory type mismatches and names outside the allowlist", async () => {
        equal(await resolveEventsArtifactPath({ trustedRoot: root, untrustedPath: "directory", expectedType: "directory", allowedNames: ["directory", "other"] }), await require("fs/promises").realpath(join(root, "directory")));
        await expectPathError(resolveEventsArtifactPath({ trustedRoot: root, untrustedPath: "directory", expectedType: "file" }), "TYPE_MISMATCH");
        await expectPathError(resolveEventsArtifactPath({ trustedRoot: root, untrustedPath: "valid.json", expectedType: "directory" }), "TYPE_MISMATCH");
        await expectPathError(resolveEventsArtifactPath({ trustedRoot: root, untrustedPath: "valid.json", expectedType: "file", allowedNames: ["expected.json"] }), "NAME_NOT_ALLOWED");
        await expectPathError(resolveEventsArtifactPath({ trustedRoot: root, untrustedPath: "sub/valid.json", expectedType: "file", exactName: "valid.json" }), "NAME_NOT_ALLOWED");
    });
});

describe("database-events consumer path mutations", () => {
    let temporaryDirectory: string, inputDir: string, outsideFile: string;
    beforeEach(async () => {
        temporaryDirectory = await mkdtemp(join(tmpdir(), "dokkan-events-consumer-"));
        inputDir = join(temporaryDirectory, "input");
        await mkdir(inputDir);
        outsideFile = join(temporaryDirectory, "outside.json");
        await writeFile(outsideFile, "external sentinel must not be parsed");
    });
    afterEach(async () => { await rm(temporaryDirectory, { recursive: true, force: true }); });

    async function writeE0Manifest(changed: "payload" | "coverage" | "validation") {
        const manifest: any = { fileName: "events-e0-inventory.json", coverage: { fileName: "events-e0-coverage.json" }, validation: { fileName: "events-e0-validation.json" } };
        if (changed === "payload") manifest.fileName = "../outside.json";
        else manifest[changed].fileName = "../outside.json";
        await Promise.all([writeFile(join(inputDir, "events-e0-manifest.json"), JSON.stringify(manifest)), writeFile(join(inputDir, "events-e0-inventory.json"), "{}"), writeFile(join(inputDir, "events-e0-coverage.json"), "{}"), writeFile(join(inputDir, "events-e0-validation.json"), "{}")]);
    }

    for (const field of ["payload", "coverage", "validation"] as const) it(`rejects an E0 manifest whose ${field} escapes before the external artifact is consumed`, async () => {
        await writeE0Manifest(field);
        await expectPathError(runEventsE1({ e0Dir: inputDir, databasePath: join(temporaryDirectory, "missing.db") }), "INVALID_PATH");
    });

    it("rejects an E3 golden outside its manifest root", async () => {
        const e3Manifest = { fileName: "events-e3-encounters.json", coverage: { fileName: "events-e3-coverage.json" }, validation: { fileName: "events-e3-validation.json" }, goldens: { fileName: "../outside.json" } };
        const e2Manifest = { fileName: "events-e2-topology.json" };
        await Promise.all([writeFile(join(inputDir, "events-e3-manifest.json"), JSON.stringify(e3Manifest)), writeFile(join(inputDir, "events-e2-manifest.json"), JSON.stringify(e2Manifest)), writeFile(join(inputDir, "events-e3-encounters.json"), "{}"), writeFile(join(inputDir, "events-e3-coverage.json"), "{}"), writeFile(join(inputDir, "events-e3-validation.json"), "{}"), writeFile(join(inputDir, "events-e2-topology.json"), "{}")]);
        await expectPathError(runEventsE4({ e3Dir: inputDir, e2Dir: inputDir, databasePath: join(temporaryDirectory, "missing.db") }), "INVALID_PATH");
    });

    it("rejects an E8 receipt outside its manifest root", async () => {
        const e7Manifest = { fileName: "events-e7-shadow-parity.json", coverage: { fileName: "events-e7-coverage.json" }, validation: { fileName: "events-e7-validation.json" } };
        const e8Manifest = { fileName: "events-sidecars.json", coverage: { fileName: "events-e8-coverage.json" }, validation: { fileName: "events-e8-validation.json" }, refreshReceipt: { fileName: "../outside.json" } };
        await Promise.all([writeFile(join(inputDir, "events-e7-manifest.json"), JSON.stringify(e7Manifest)), writeFile(join(inputDir, "events-e8-manifest.json"), JSON.stringify(e8Manifest)), writeFile(join(inputDir, "events-e7-shadow-parity.json"), "{}"), writeFile(join(inputDir, "events-e7-coverage.json"), "{}"), writeFile(join(inputDir, "events-e7-validation.json"), "{}"), writeFile(join(inputDir, "events-sidecars.json"), "{}"), writeFile(join(inputDir, "events-e8-coverage.json"), "{}"), writeFile(join(inputDir, "events-e8-validation.json"), "{}")]);
        await expectPathError(runEventsE9({ inputDir }), "INVALID_PATH");
    });

    it("rejects a refresh profile baseline outside the profile directory in E8 and the refresh runner", async () => {
        const sourceProfile = JSON.parse(await readFile(join(process.cwd(), "database-events", "events-e8-refresh-profile.json"), "utf8"));
        sourceProfile.baselineFiles[0].fileName = "../outside.json";
        sourceProfile.baselineFiles[0].sha256 = createHash("sha256").update(await readFile(outsideFile)).digest("hex");
        const profilePath = join(inputDir, "profile.json");
        await writeFile(profilePath, JSON.stringify(sourceProfile));
        await expectPathError(runEventsE8({ inputDir, refreshProfilePath: profilePath }), "INVALID_PATH");
        await expectPathError(runEventsRefresh({ refreshProfilePath: profilePath, outputDir: join(temporaryDirectory, "output") }), "INVALID_PATH");
    });

    it("rejects a manifest symlink to an external artifact before parsing it", async () => {
        const manifest = { fileName: "events-e0-inventory.json", coverage: { fileName: "events-e0-coverage.json" }, validation: { fileName: "events-e0-validation.json" } };
        await Promise.all([writeFile(join(inputDir, "events-e0-manifest.json"), JSON.stringify(manifest)), writeFile(join(inputDir, "events-e0-coverage.json"), "{}"), writeFile(join(inputDir, "events-e0-validation.json"), "{}")]);
        const externalDirectory = join(temporaryDirectory, "external");
        await mkdir(externalDirectory);
        await writeFile(join(externalDirectory, "events-e0-inventory.json"), "external sentinel");
        await symlink(externalDirectory, join(inputDir, "payload-link"), "junction");
        await rm(join(inputDir, "events-e0-manifest.json"));
        manifest.fileName = "payload-link/events-e0-inventory.json";
        await writeFile(join(inputDir, "events-e0-manifest.json"), JSON.stringify(manifest));
        await expectPathError(runEventsE1({ e0Dir: inputDir, databasePath: join(temporaryDirectory, "missing.db") }), "NAME_NOT_ALLOWED");
        ok((await readFile(join(externalDirectory, "events-e0-inventory.json"), "utf8")).startsWith("external"));
    });
});
