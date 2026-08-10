"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const promises_1 = require("fs/promises");
const ModuleApi = require("module");
const os_1 = require("os");
const path_1 = require("path");
const typescript_1 = require("typescript");
const compact_contract_1 = require("./compact-contract");
const compact_run_1 = require("./compact-run");
const compactRun = require("./compact-run");
const TEST_HOOK = Symbol.for("dokkan.k15.compact-run.test-hook");
async function loadTestProductiveWriter(repositoryRoot) {
    const parent = (0, path_1.resolve)(__dirname, "..");
    const sourceRoot = (0, path_1.basename)(parent).toLowerCase() === "lib" ? (0, path_1.resolve)(parent, "..") : parent;
    const sourcePath = (0, path_1.join)(sourceRoot, "database-characters", "compact-run.ts");
    const runtimePath = (0, path_1.join)(sourceRoot, "lib", "database-characters", "compact-run.js");
    const source = await (0, promises_1.readFile)(sourcePath, "utf8");
    const rootFunction = /function characterCompactRepositoryRoot\(\): string \{[\s\S]*?\n\}/;
    const instrumented = source.replace(rootFunction, `function characterCompactRepositoryRoot(): string { return ${JSON.stringify(repositoryRoot)}; }`);
    if (instrumented === source)
        throw new Error("K15 test writer instrumentation failed");
    const compiled = (0, typescript_1.transpileModule)(`${instrumented}\nexport { writeProductiveFiles as __testWriteProductiveFiles };\n`, {
        compilerOptions: { module: typescript_1.ModuleKind.CommonJS, target: typescript_1.ScriptTarget.ES2022 },
        fileName: sourcePath,
    }).outputText;
    const ModuleConstructor = ModuleApi.default ?? ModuleApi;
    const runtimeModule = new ModuleConstructor(runtimePath, module);
    runtimeModule.filename = runtimePath;
    runtimeModule.paths = ModuleConstructor._nodeModulePaths((0, path_1.dirname)(runtimePath));
    runtimeModule._compile(compiled, runtimePath);
    return runtimeModule.exports.__testWriteProductiveFiles;
}
describe("database character K15 compact CLI output boundary", () => {
    let root;
    beforeEach(async () => { root = await (0, promises_1.mkdtemp)((0, path_1.join)((0, os_1.tmpdir)(), "dokkan-k15-output-")); });
    afterEach(async () => { await (0, promises_1.rm)(root, { recursive: true, force: true }); });
    it("exposes validation without creating or writing the supplied path", async () => {
        const output = (0, path_1.join)(root, "existing-output");
        await (0, promises_1.mkdir)(output);
        await (0, compact_run_1.validateCharacterCompactOutputPath)(output);
        (0, assert_1.equal)((await (0, promises_1.readdir)(output)).length, 0);
        await (0, assert_1.rejects)((0, compact_run_1.validateCharacterCompactOutputPath)((0, path_1.join)(root, "missing")), /ENOENT/);
        (0, assert_1.equal)(compactRun.resolveCharacterCompactCliOutputDirectory, undefined);
        (0, assert_1.equal)(compactRun.characterCompactRepositoryRoot, undefined);
        (0, assert_1.equal)(compactRun.writeProductiveFiles, undefined);
    });
    it("rejects every --output-dir form before productive generation", () => {
        for (const argument of [
            "C:\\outside",
            "../compact",
            "data/database-characters/compact",
            "data\\database-characters\\compact",
        ]) {
            (0, assert_1.throws)(() => (0, compact_run_1.validateCharacterCompactCliArguments)(["--output-dir", argument]), /not supported/);
            (0, assert_1.throws)(() => (0, compact_run_1.validateCharacterCompactCliArguments)([`--output-dir=${argument}`]), /not supported/);
        }
        (0, compact_run_1.validateCharacterCompactCliArguments)(["--shadow-root", "D:/offline-shadow"]);
    });
    it("keeps the manifest absent when any earlier verified promotion fails", async () => {
        const release = compact_contract_1.CHARACTER_COMPACT_PINNED_RELEASE;
        const reportFile = "database-characters-k15-run-report.json";
        const beforeManifest = [
            release.payloadFile,
            release.coverageFile,
            release.validationFile,
            release.readinessFile,
            reportFile,
        ];
        const unorderedFiles = [
            { name: release.manifestFile, bytes: Buffer.from("manifest") },
            { name: reportFile, bytes: Buffer.from("report"), preserveExisting: true },
            { name: release.readinessFile, bytes: Buffer.from("readiness") },
            { name: release.validationFile, bytes: Buffer.from("validation") },
            { name: release.coverageFile, bytes: Buffer.from("coverage") },
            { name: release.payloadFile, bytes: Buffer.from("payload") },
        ];
        const previousNodeEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = "test";
        try {
            for (const failedName of beforeManifest) {
                const repositoryRoot = (0, path_1.join)(root, failedName.replace(/[^a-z0-9]/gi, "-"));
                await (0, promises_1.mkdir)(repositoryRoot);
                const writer = await loadTestProductiveWriter(repositoryRoot);
                global[TEST_HOOK] = (point) => {
                    if (point === `after-promote-verify:${failedName}`)
                        throw new Error(`injected failure after ${failedName}`);
                };
                await (0, assert_1.rejects)(writer(unorderedFiles), new RegExp(`injected failure after ${failedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
                const outputFiles = await (0, promises_1.readdir)((0, path_1.join)(repositoryRoot, "data", "database-characters", "compact"));
                (0, assert_1.equal)(outputFiles.includes(release.manifestFile), false, `manifest visible after ${failedName}`);
            }
        }
        finally {
            delete global[TEST_HOOK];
            if (previousNodeEnv === undefined)
                delete process.env.NODE_ENV;
            else
                process.env.NODE_ENV = previousNodeEnv;
        }
    });
    it("rejects a linked output parent without creating through it", async function () {
        const external = await (0, promises_1.mkdtemp)((0, path_1.join)((0, os_1.tmpdir)(), "dokkan-k15-external-"));
        const linkedParent = (0, path_1.join)(root, "linked-parent");
        const output = (0, path_1.join)(linkedParent, "compact");
        try {
            await (0, promises_1.mkdir)((0, path_1.join)(external, "compact"));
            const kind = process.platform === "win32" ? "junction" : "dir";
            try {
                await (0, promises_1.symlink)(external, linkedParent, kind);
            }
            catch {
                this.skip();
                return;
            }
            await (0, assert_1.rejects)((0, compact_run_1.validateCharacterCompactOutputPath)(output), /reparse point|non-link/);
            (0, assert_1.equal)((await (0, promises_1.readdir)((0, path_1.join)(external, "compact"))).length, 0);
        }
        finally {
            await (0, promises_1.rm)(external, { recursive: true, force: true });
        }
    });
    it("rejects a linked output root when the environment permits it", async function () {
        const external = await (0, promises_1.mkdtemp)((0, path_1.join)((0, os_1.tmpdir)(), "dokkan-k15-root-target-"));
        const linkedRoot = (0, path_1.join)(root, "linked-root");
        const kind = process.platform === "win32" ? "junction" : "dir";
        try {
            try {
                await (0, promises_1.symlink)(external, linkedRoot, kind);
            }
            catch {
                this.skip();
                return;
            }
            await (0, assert_1.rejects)((0, compact_run_1.validateCharacterCompactOutputPath)(linkedRoot), /non-link|reparse point/);
        }
        finally {
            await (0, promises_1.rm)(external, { recursive: true, force: true });
        }
    });
    it("deterministically detects an output-directory swap at the validation/write checkpoint", async function () {
        const output = (0, path_1.join)(root, "compact");
        const external = await (0, promises_1.mkdtemp)((0, path_1.join)((0, os_1.tmpdir)(), "dokkan-k15-swap-target-"));
        const kind = process.platform === "win32" ? "junction" : "dir";
        const previousNodeEnv = process.env.NODE_ENV;
        let swapped = false;
        await (0, promises_1.mkdir)(output);
        process.env.NODE_ENV = "test";
        global[TEST_HOOK] = async (point) => {
            if (point !== "after-output-snapshot" || swapped)
                return;
            swapped = true;
            await (0, promises_1.rmdir)(output);
            await (0, promises_1.symlink)(external, output, kind);
        };
        try {
            await (0, assert_1.rejects)((0, compact_run_1.validateCharacterCompactOutputPath)(output), /identity changed|non-link|reparse point/);
            (0, assert_1.equal)(swapped, true);
            (0, assert_1.equal)((await (0, promises_1.readdir)(external)).length, 0);
        }
        catch (error) {
            if (!swapped && /privilege|permitted|operation not permitted/i.test(String(error))) {
                this.skip();
                return;
            }
            throw error;
        }
        finally {
            delete global[TEST_HOOK];
            if (previousNodeEnv === undefined)
                delete process.env.NODE_ENV;
            else
                process.env.NODE_ENV = previousNodeEnv;
            if (swapped)
                await (0, promises_1.unlink)(output).catch(() => undefined);
            await (0, promises_1.rm)(external, { recursive: true, force: true });
        }
    });
});
//# sourceMappingURL=compact-run.spec.js.map