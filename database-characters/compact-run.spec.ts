import { equal, rejects, throws } from "assert";
import { mkdir, mkdtemp, readFile, readdir, rm, rmdir, symlink, unlink } from "fs/promises";
import * as ModuleApi from "module";
import { tmpdir } from "os";
import { basename, dirname, join, resolve } from "path";
import { ModuleKind, ScriptTarget, transpileModule } from "typescript";
import { CHARACTER_COMPACT_PINNED_RELEASE } from "./compact-contract";
import {
    validateCharacterCompactCliArguments,
    validateCharacterCompactOutputPath,
} from "./compact-run";
import * as compactRun from "./compact-run";

const TEST_HOOK = Symbol.for("dokkan.k15.compact-run.test-hook");

interface TestProductiveFile {
    name: string;
    bytes: Buffer;
    preserveExisting?: boolean;
}

type TestProductiveWriter = (files: TestProductiveFile[]) => Promise<string>;

async function loadTestProductiveWriter(repositoryRoot: string): Promise<TestProductiveWriter> {
    const parent = resolve(__dirname, "..");
    const sourceRoot = basename(parent).toLowerCase() === "lib" ? resolve(parent, "..") : parent;
    const sourcePath = join(sourceRoot, "database-characters", "compact-run.ts");
    const runtimePath = join(sourceRoot, "lib", "database-characters", "compact-run.js");
    const source = await readFile(sourcePath, "utf8");
    const rootFunction = /function characterCompactRepositoryRoot\(\): string \{[\s\S]*?\n\}/;
    const instrumented = source.replace(
        rootFunction,
        `function characterCompactRepositoryRoot(): string { return ${JSON.stringify(repositoryRoot)}; }`,
    );
    if (instrumented === source) throw new Error("K15 test writer instrumentation failed");
    const compiled = transpileModule(`${instrumented}\nexport { writeProductiveFiles as __testWriteProductiveFiles };\n`, {
        compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2022 },
        fileName: sourcePath,
    }).outputText;
    const ModuleConstructor = (ModuleApi as any).default ?? ModuleApi;
    const runtimeModule = new ModuleConstructor(runtimePath, module);
    runtimeModule.filename = runtimePath;
    runtimeModule.paths = ModuleConstructor._nodeModulePaths(dirname(runtimePath));
    runtimeModule._compile(compiled, runtimePath);
    return runtimeModule.exports.__testWriteProductiveFiles as TestProductiveWriter;
}

describe("database character K15 compact CLI output boundary", () => {
    let root: string;
    beforeEach(async () => { root = await mkdtemp(join(tmpdir(), "dokkan-k15-output-")); });
    afterEach(async () => { await rm(root, { recursive: true, force: true }); });

    it("exposes validation without creating or writing the supplied path", async () => {
        const output = join(root, "existing-output");
        await mkdir(output);
        await validateCharacterCompactOutputPath(output);
        equal((await readdir(output)).length, 0);
        await rejects(validateCharacterCompactOutputPath(join(root, "missing")), /ENOENT/);
        equal((compactRun as any).resolveCharacterCompactCliOutputDirectory, undefined);
        equal((compactRun as any).characterCompactRepositoryRoot, undefined);
        equal((compactRun as any).writeProductiveFiles, undefined);
    });

    it("rejects every --output-dir form before productive generation", () => {
        for (const argument of [
            "C:\\outside",
            "../compact",
            "data/database-characters/compact",
            "data\\database-characters\\compact",
        ]) {
            throws(() => validateCharacterCompactCliArguments(["--output-dir", argument]), /not supported/);
            throws(() => validateCharacterCompactCliArguments([`--output-dir=${argument}`]), /not supported/);
        }
        validateCharacterCompactCliArguments(["--shadow-root", "D:/offline-shadow"]);
    });

    it("keeps the manifest absent when any earlier verified promotion fails", async () => {
        const release = CHARACTER_COMPACT_PINNED_RELEASE;
        const reportFile = "database-characters-k15-run-report.json";
        const beforeManifest = [
            release.payloadFile,
            release.coverageFile,
            release.validationFile,
            release.readinessFile,
            reportFile,
        ];
        const unorderedFiles: TestProductiveFile[] = [
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
                const repositoryRoot = join(root, failedName.replace(/[^a-z0-9]/gi, "-"));
                await mkdir(repositoryRoot);
                const writer = await loadTestProductiveWriter(repositoryRoot);
                (global as any)[TEST_HOOK] = (point: string) => {
                    if (point === `after-promote-verify:${failedName}`) throw new Error(`injected failure after ${failedName}`);
                };
                await rejects(writer(unorderedFiles), new RegExp(`injected failure after ${failedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
                const outputFiles = await readdir(join(repositoryRoot, "data", "database-characters", "compact"));
                equal(outputFiles.includes(release.manifestFile), false, `manifest visible after ${failedName}`);
            }
        } finally {
            delete (global as any)[TEST_HOOK];
            if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
            else process.env.NODE_ENV = previousNodeEnv;
        }
    });

    it("rejects a linked output parent without creating through it", async function () {
        const external = await mkdtemp(join(tmpdir(), "dokkan-k15-external-"));
        const linkedParent = join(root, "linked-parent");
        const output = join(linkedParent, "compact");
        try {
            await mkdir(join(external, "compact"));
            const kind = process.platform === "win32" ? "junction" : "dir";
            try { await symlink(external, linkedParent, kind); } catch { this.skip(); return; }
            await rejects(validateCharacterCompactOutputPath(output), /reparse point|non-link/);
            equal((await readdir(join(external, "compact"))).length, 0);
        } finally {
            await rm(external, { recursive: true, force: true });
        }
    });

    it("rejects a linked output root when the environment permits it", async function () {
        const external = await mkdtemp(join(tmpdir(), "dokkan-k15-root-target-"));
        const linkedRoot = join(root, "linked-root");
        const kind = process.platform === "win32" ? "junction" : "dir";
        try {
            try { await symlink(external, linkedRoot, kind); } catch { this.skip(); return; }
            await rejects(validateCharacterCompactOutputPath(linkedRoot), /non-link|reparse point/);
        } finally {
            await rm(external, { recursive: true, force: true });
        }
    });

    it("deterministically detects an output-directory swap at the validation/write checkpoint", async function () {
        const output = join(root, "compact");
        const external = await mkdtemp(join(tmpdir(), "dokkan-k15-swap-target-"));
        const kind = process.platform === "win32" ? "junction" : "dir";
        const previousNodeEnv = process.env.NODE_ENV;
        let swapped = false;
        await mkdir(output);
        process.env.NODE_ENV = "test";
        (global as any)[TEST_HOOK] = async (point: string) => {
            if (point !== "after-output-snapshot" || swapped) return;
            swapped = true;
            await rmdir(output);
            await symlink(external, output, kind);
        };
        try {
            await rejects(validateCharacterCompactOutputPath(output), /identity changed|non-link|reparse point/);
            equal(swapped, true);
            equal((await readdir(external)).length, 0);
        } catch (error: any) {
            if (!swapped && /privilege|permitted|operation not permitted/i.test(String(error))) { this.skip(); return; }
            throw error;
        } finally {
            delete (global as any)[TEST_HOOK];
            if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
            else process.env.NODE_ENV = previousNodeEnv;
            if (swapped) await unlink(output).catch(() => undefined);
            await rm(external, { recursive: true, force: true });
        }
    });
});
