"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const fs_1 = require("fs");
const os_1 = require("os");
const path_1 = require("path");
const wt_source_boundary_1 = require("./wt-source-boundary");
describe("world tournament external source containment", () => {
    let base, repository, external;
    beforeEach(() => { base = (0, fs_1.mkdtempSync)((0, path_1.join)((0, os_1.tmpdir)(), "wt-source-boundary-")); repository = (0, path_1.join)(base, "repository"); external = (0, path_1.join)(base, "external"); (0, fs_1.mkdirSync)(repository); (0, fs_1.mkdirSync)(external); (0, fs_1.writeFileSync)((0, path_1.join)(external, "capture.bin"), "synthetic-source"); });
    afterEach(() => (0, fs_1.rmSync)(base, { recursive: true, force: true }));
    it("reads a regular external child without persisting its path in identity", () => { const value = (0, wt_source_boundary_1.readWtExternalSource)(repository, external, "capture.bin"); assert.equal(value.text, "synthetic-source"); assert.deepEqual(Object.keys(value.identity).sort(), ["sha256", "sizeBytes", "sourceId"]); });
    it("rejects a relative source root and a source root inside the repository", () => { const inside = (0, path_1.join)(repository, "captures"); (0, fs_1.mkdirSync)(inside); (0, fs_1.writeFileSync)((0, path_1.join)(inside, "capture.bin"), "synthetic-source"); assert.throws(() => (0, wt_source_boundary_1.readWtExternalSource)(repository, "external", "capture.bin"), /source-root must be absolute/); assert.throws(() => (0, wt_source_boundary_1.readWtExternalSource)(repository, inside, "capture.bin"), /source-root must be external/); });
    it("fails closed without disclosing a missing source path", () => { let message = ""; try {
        (0, wt_source_boundary_1.readWtExternalSource)(repository, external, "missing-private-name.bin");
    }
    catch (error) {
        message = String(error.message);
    } assert.match(message, /^WT source/); assert.equal(message.includes("missing-private-name"), false); assert.equal(message.includes(external), false); });
    it("rejects traversal and absolute path forms", () => { for (const value of ["../capture.bin", "/capture.bin", "C:\\capture.bin", "C:capture.bin", "\\\\server\\share\\capture.bin", "\\\\?\\C:\\capture.bin", "a/b\\capture.bin"])
        assert.throws(() => (0, wt_source_boundary_1.readWtExternalSource)(repository, external, value), /boundary/); });
    it("uses component containment rather than a string prefix", () => { assert.equal((0, wt_source_boundary_1.isRealpathContained)((0, path_1.resolve)(base, "capture"), (0, path_1.resolve)(base, "capture-other/file")), false); });
    it("rejects a real directory junction", () => { const outside = (0, path_1.join)(base, "outside"); (0, fs_1.mkdirSync)(outside); (0, fs_1.writeFileSync)((0, path_1.join)(outside, "capture.bin"), "synthetic-source"); (0, fs_1.symlinkSync)(outside, (0, path_1.join)(external, "junction"), "junction"); assert.throws(() => (0, wt_source_boundary_1.readWtExternalSource)(repository, external, "junction\\capture.bin"), /reparse boundary/); });
    it("rejects a junction used as source root", () => { const junctionRoot = (0, path_1.join)(base, "external-junction"); (0, fs_1.symlinkSync)(external, junctionRoot, "junction"); assert.throws(() => (0, wt_source_boundary_1.readWtExternalSource)(repository, junctionRoot, "capture.bin"), /reparse boundary/); });
    it("rejects a file symlink when the platform permits creating one", function () { const link = (0, path_1.join)(external, "linked.bin"); try {
        (0, fs_1.symlinkSync)((0, path_1.join)(external, "capture.bin"), link, "file");
    }
    catch (error) {
        if (error?.code === "EPERM")
            this.skip();
        throw error;
    } assert.throws(() => (0, wt_source_boundary_1.readWtExternalSource)(repository, external, "linked.bin"), /reparse boundary/); });
});
//# sourceMappingURL=wt-source-boundary.spec.js.map