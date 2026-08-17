import * as assert from "assert";
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join, resolve } from "path";
import { isRealpathContained, readWtExternalSource } from "./wt-source-boundary";

describe("world tournament external source containment", () => {
    let base: string, repository: string, external: string;
    beforeEach(() => { base = mkdtempSync(join(tmpdir(), "wt-source-boundary-")); repository = join(base, "repository"); external = join(base, "external"); mkdirSync(repository); mkdirSync(external); writeFileSync(join(external, "capture.bin"), "synthetic-source"); });
    afterEach(() => rmSync(base, { recursive: true, force: true }));
    it("reads a regular external child without persisting its path in identity", () => { const value = readWtExternalSource(repository, external, "capture.bin"); assert.equal(value.text, "synthetic-source"); assert.deepEqual(Object.keys(value.identity).sort(), ["sha256", "sizeBytes", "sourceId"]); });
    it("rejects a relative source root and a source root inside the repository", () => { const inside = join(repository, "captures"); mkdirSync(inside); writeFileSync(join(inside, "capture.bin"), "synthetic-source"); assert.throws(() => readWtExternalSource(repository, "external", "capture.bin"), /source-root must be absolute/); assert.throws(() => readWtExternalSource(repository, inside, "capture.bin"), /source-root must be external/); });
    it("fails closed without disclosing a missing source path", () => { let message = ""; try { readWtExternalSource(repository, external, "missing-private-name.bin"); } catch (error) { message = String((error as Error).message); } assert.match(message, /^WT source/); assert.equal(message.includes("missing-private-name"), false); assert.equal(message.includes(external), false); });
    it("rejects traversal and absolute path forms", () => { for (const value of ["../capture.bin", "/capture.bin", "C:\\capture.bin", "C:capture.bin", "\\\\server\\share\\capture.bin", "\\\\?\\C:\\capture.bin", "a/b\\capture.bin"]) assert.throws(() => readWtExternalSource(repository, external, value), /boundary/); });
    it("uses component containment rather than a string prefix", () => { assert.equal(isRealpathContained(resolve(base, "capture"), resolve(base, "capture-other/file")), false); });
    it("rejects a real directory junction", () => { const outside = join(base, "outside"); mkdirSync(outside); writeFileSync(join(outside, "capture.bin"), "synthetic-source"); symlinkSync(outside, join(external, "junction"), "junction"); assert.throws(() => readWtExternalSource(repository, external, "junction\\capture.bin"), /reparse boundary/); });
    it("rejects a junction used as source root", () => { const junctionRoot = join(base, "external-junction"); symlinkSync(external, junctionRoot, "junction"); assert.throws(() => readWtExternalSource(repository, junctionRoot, "capture.bin"), /reparse boundary/); });
    it("rejects a file symlink when the platform permits creating one", function () { const link = join(external, "linked.bin"); try { symlinkSync(join(external, "capture.bin"), link, "file"); } catch (error: any) { if (error?.code === "EPERM") this.skip(); throw error; } assert.throws(() => readWtExternalSource(repository, external, "linked.bin"), /reparse boundary/); });
});
