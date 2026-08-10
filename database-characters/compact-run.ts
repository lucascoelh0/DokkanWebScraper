import { constants, Dir, Stats } from "fs";
import { lstat, mkdir, open, opendir, realpath, rename, rmdir, unlink } from "fs/promises";
import { randomBytes } from "crypto";
import { basename, join, resolve } from "path";
import { gzipSync } from "zlib";
import { sha256Bytes } from "./artifact";
import { CharacterCompactProjectionBuilder } from "./compact-builder";
import {
    CHARACTER_COMPACT_GZIP_BUDGET_BYTES,
    CHARACTER_COMPACT_PINNED_RELEASE,
    CHARACTER_COMPACT_RAW_BUDGET_BYTES,
    CharacterCompactManifest,
} from "./compact-contract";
import { loadCharacterCompactGenerationSource } from "./compact-source";
import {
    assertPinnedCharacterCompactReleaseManifest,
    buildCharacterCompactReadiness,
    validateCharacterCompactArtifact,
    validateCharacterCompactProjection,
} from "./compact-validator";

const CHARACTER_COMPACT_CLI_OUTPUT_DIRECTORY = "data/database-characters/compact" as const;
const RUN_REPORT_FILE = "database-characters-k15-run-report.json";
const TEST_HOOK = Symbol.for("dokkan.k15.compact-run.test-hook");

interface FileSystemIdentity {
    path: string;
    realPath: string;
    dev: number;
    ino: number;
}

interface ProductiveFile {
    name: string;
    bytes: Buffer;
    preserveExisting?: boolean;
}

type TestHook = (point: string) => void | Promise<void>;

const jsonBytes = (input: unknown) => Buffer.from(`${JSON.stringify(input, null, 2)}\n`, "utf8");
const samePath = (left: string, right: string): boolean => process.platform === "win32"
    ? resolve(left).toLowerCase() === resolve(right).toLowerCase()
    : resolve(left) === resolve(right);
const sameIdentity = (metadata: Stats, expected: FileSystemIdentity): boolean => metadata.dev === expected.dev && metadata.ino === expected.ino;

async function invokeTestHook(point: string): Promise<void> {
    if (process.env.NODE_ENV !== "test") return;
    const hook = (global as any)[TEST_HOOK] as TestHook | undefined;
    if (hook) await hook(point);
}

function argumentValue(args: string[], name: string): string | undefined {
    const matches = args.reduce<number[]>((indexes, item, index) => item === name ? [...indexes, index] : indexes, []);
    if (matches.length > 1) throw new Error(`duplicate ${name}`);
    if (!matches.length) return undefined;
    const result = args[matches[0] + 1];
    if (!result || result.startsWith("--")) throw new Error(`missing value for ${name}`);
    return result;
}

export function validateCharacterCompactCliArguments(args: string[]): void {
    if (args.some(argument => argument === "--output-dir" || argument.startsWith("--output-dir="))) {
        throw new Error("K15 --output-dir is not supported; productive output is repository-controlled");
    }
}

async function inspectDirectory(path: string, label: string): Promise<FileSystemIdentity> {
    const resolvedPath = resolve(path);
    const metadata = await lstat(resolvedPath);
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) throw new Error(`K15 ${label} must be a regular non-link directory`);
    const canonicalPath = await realpath(resolvedPath);
    if (!samePath(canonicalPath, resolvedPath)) throw new Error(`K15 ${label} symlink, junction or reparse point rejected`);
    return { path: resolvedPath, realPath: canonicalPath, dev: metadata.dev, ino: metadata.ino };
}

async function assertDirectoryIdentity(expected: FileSystemIdentity, label: string): Promise<void> {
    const actual = await inspectDirectory(expected.path, label);
    if (!samePath(actual.realPath, expected.realPath) || actual.dev !== expected.dev || actual.ino !== expected.ino) {
        throw new Error(`K15 ${label} identity changed`);
    }
}

async function checkpoint(chain: FileSystemIdentity[], point?: string): Promise<void> {
    for (const identity of chain) await assertDirectoryIdentity(identity, "output path");
    if (point) await invokeTestHook(point);
    for (const identity of chain) await assertDirectoryIdentity(identity, "output path");
}

/** Validation-only API. It never creates or writes the supplied path. */
export async function validateCharacterCompactOutputPath(path: string): Promise<void> {
    const identity = await inspectDirectory(path, "output path");
    await checkpoint([identity], "after-output-snapshot");
}

function characterCompactRepositoryRoot(): string {
    const parent = resolve(__dirname, "..");
    return basename(parent).toLowerCase() === "lib" ? resolve(parent, "..") : parent;
}

function productiveOutputPath(): string {
    return join(characterCompactRepositoryRoot(), ...CHARACTER_COMPACT_CLI_OUTPUT_DIRECTORY.split("/"));
}

async function ensureProductiveDirectoryChain(): Promise<FileSystemIdentity[]> {
    const root = characterCompactRepositoryRoot();
    const paths = [root];
    let current = root;
    for (const segment of CHARACTER_COMPACT_CLI_OUTPUT_DIRECTORY.split("/")) {
        current = join(current, segment);
        paths.push(current);
    }

    const chain: FileSystemIdentity[] = [];
    for (let index = 0; index < paths.length; index++) {
        const path = paths[index];
        try {
            chain.push(await inspectDirectory(path, index === 0 ? "repository root" : "output path"));
        } catch (error: any) {
            if (index === 0 || error?.code !== "ENOENT") throw error;
            await checkpoint(chain, "before-output-directory-create");
            await mkdir(path);
            chain.push(await inspectDirectory(path, "output path"));
        }
        await checkpoint(chain, "after-output-directory-check");
    }
    return chain;
}

async function holdDirectories(chain: FileSystemIdentity[]): Promise<Dir[]> {
    const handles: Dir[] = [];
    try {
        for (const identity of chain) {
            handles.push(await opendir(identity.path));
            await checkpoint(chain, "after-directory-handle-open");
        }
        return handles;
    } catch (error) {
        for (const handle of handles.reverse()) await handle.close().catch(() => undefined);
        throw error;
    }
}

async function inspectRegularFile(path: string, expected?: Stats): Promise<Stats> {
    const metadata = await lstat(path);
    if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.nlink !== 1) throw new Error("K15 output file must be a single-link regular file");
    if (expected && !sameIdentity(metadata, { path, realPath: path, dev: expected.dev, ino: expected.ino })) {
        throw new Error("K15 output file identity changed");
    }
    return metadata;
}

async function readExistingFile(path: string): Promise<Buffer | undefined> {
    let before: Stats;
    try {
        before = await inspectRegularFile(path);
    } catch (error: any) {
        if (error?.code === "ENOENT") return undefined;
        throw error;
    }
    const noFollow = constants.O_NOFOLLOW ?? 0;
    const handle = await open(path, constants.O_RDONLY | noFollow);
    try {
        const opened = await handle.stat();
        if (!opened.isFile() || opened.nlink !== 1 || !sameIdentity(opened, { path, realPath: path, dev: before.dev, ino: before.ino })) {
            throw new Error("K15 output file changed while opening");
        }
        await inspectRegularFile(path, opened);
        return await handle.readFile();
    } finally {
        await handle.close();
    }
}

async function createStagedFile(path: string, bytes: Buffer, chain: FileSystemIdentity[]): Promise<void> {
    await checkpoint(chain, "before-staged-file-open");
    const noFollow = constants.O_NOFOLLOW ?? 0;
    const handle = await open(path, constants.O_CREAT | constants.O_EXCL | constants.O_RDWR | noFollow, 0o600);
    try {
        const opened = await handle.stat();
        await checkpoint(chain, "after-staged-file-open");
        await inspectRegularFile(path, opened);
        await handle.writeFile(bytes);
        await handle.sync();
        const written = await handle.stat();
        if (written.size !== bytes.length || written.nlink !== 1 || !sameIdentity(written, { path, realPath: path, dev: opened.dev, ino: opened.ino })) {
            throw new Error("K15 staged file identity or size changed");
        }
        await checkpoint(chain, "after-staged-file-write");
        await inspectRegularFile(path, written);
    } finally {
        await handle.close();
    }
    const verified = await readExistingFile(path);
    if (!verified?.equals(bytes)) throw new Error("K15 staged file bytes changed");
    await checkpoint(chain, "after-staged-file-verify");
}

async function removeStagedFile(path: string, chain: FileSystemIdentity[]): Promise<void> {
    await checkpoint(chain, "before-staged-file-remove");
    await inspectRegularFile(path);
    await unlink(path);
    await checkpoint(chain, "after-staged-file-remove");
}

async function safelyCleanStaging(staging: FileSystemIdentity, names: string[], parentChain: FileSystemIdentity[]): Promise<boolean> {
    const chain = [...parentChain, staging];
    try {
        await checkpoint(chain);
        for (const name of names) {
            const path = join(staging.path, name);
            try {
                await inspectRegularFile(path);
                await unlink(path);
                await checkpoint(chain);
            } catch (error: any) {
                if (error?.code !== "ENOENT") return false;
            }
        }
        await assertDirectoryIdentity(staging, "staging directory");
        await rmdir(staging.path);
        await checkpoint(parentChain);
        return true;
    } catch {
        return false;
    }
}

async function writeProductiveFiles(files: ProductiveFile[]): Promise<string> {
    const release = CHARACTER_COMPACT_PINNED_RELEASE;
    const promotionOrder = [
        release.payloadFile,
        release.coverageFile,
        release.validationFile,
        release.readinessFile,
        RUN_REPORT_FILE,
        release.manifestFile,
    ];
    const filesByName = new Map(files.map(file => [file.name, file]));
    if (files.length !== promotionOrder.length || filesByName.size !== files.length
        || promotionOrder.some(name => !filesByName.has(name))) {
        throw new Error("K15 productive output file inventory rejected");
    }
    const orderedFiles = promotionOrder.map(name => filesByName.get(name)!);

    const parentChain = await ensureProductiveDirectoryChain();
    const output = parentChain[parentChain.length - 1];
    const stagingPath = join(output.path, `.k15-staging-${process.pid}-${randomBytes(16).toString("hex")}`);
    await checkpoint(parentChain, "before-staging-directory-create");
    await mkdir(stagingPath, { mode: 0o700 });
    const staging = await inspectDirectory(stagingPath, "staging directory");
    const chain = [...parentChain, staging];
    await checkpoint(chain, "after-staging-directory-create");
    const heldDirectories: Dir[] = [];
    const stagedNames: string[] = [];

    try {
        heldDirectories.push(...await holdDirectories(parentChain));
        for (const file of orderedFiles) {
            stagedNames.push(file.name);
            await createStagedFile(join(staging.path, file.name), file.bytes, chain);
        }

        for (const file of orderedFiles) {
            const stagedPath = join(staging.path, file.name);
            const finalPath = join(output.path, file.name);
            await checkpoint(chain, `before-promote:${file.name}`);
            const existing = await readExistingFile(finalPath);
            await checkpoint(chain, `after-existing-check:${file.name}`);
            if (existing) {
                if (!existing.equals(file.bytes) && !file.preserveExisting) throw new Error(`K15 existing ${file.name} differs from pinned bytes`);
                await removeStagedFile(stagedPath, chain);
                continue;
            }
            await rename(stagedPath, finalPath);
            await checkpoint(chain, `after-promote:${file.name}`);
            const promoted = await readExistingFile(finalPath);
            if (!promoted?.equals(file.bytes)) throw new Error(`K15 promoted ${file.name} identity rejected`);
            await checkpoint(chain, `after-promote-verify:${file.name}`);
        }

        if (!await safelyCleanStaging(staging, stagedNames, parentChain)) throw new Error("K15 staging cleanup could not be proved safe");
        return output.path;
    } catch (error) {
        await safelyCleanStaging(staging, stagedNames, parentChain);
        throw error;
    } finally {
        for (const handle of heldDirectories.reverse()) await handle.close().catch(() => undefined);
    }
}

async function generate(source: Awaited<ReturnType<typeof loadCharacterCompactGenerationSource>>) {
    const builder = new CharacterCompactProjectionBuilder(source.lineage, source.generatedAt, source.datasetVersion);
    await source.streamFields(field => builder.accept(field));
    const { projection, coverage } = builder.finish(true);
    const raw = jsonBytes(projection);
    if (raw.length > CHARACTER_COMPACT_RAW_BUDGET_BYTES) throw new Error(`K15 raw budget exceeded: ${raw.length} > ${CHARACTER_COMPACT_RAW_BUDGET_BYTES}`);
    const gzip = gzipSync(raw, { level: 9 });
    if (gzip.length > CHARACTER_COMPACT_GZIP_BUDGET_BYTES) throw new Error(`K15 gzip budget exceeded: ${gzip.length} > ${CHARACTER_COMPACT_GZIP_BUDGET_BYTES}`);
    const validation = validateCharacterCompactProjection(projection, coverage, { gzipSizeBytes: gzip.length, rawSizeBytes: raw.length }, true);
    if (!validation.valid) throw new Error(`K15 validation failed: ${validation.failures.join("; ")}`);
    return {
        projection,
        coverage,
        validation,
        readiness: buildCharacterCompactReadiness(source.generatedAt),
        raw,
        gzip,
        sha256: sha256Bytes(gzip),
        rawSha256: sha256Bytes(raw),
    };
}

async function run(): Promise<void> {
    const args = process.argv.slice(2);
    validateCharacterCompactCliArguments(args);
    const shadowRoot = resolve(argumentValue(args, "--shadow-root") ?? "D:/Dokkan/DokkanWebScraper-character-shadow/data/database-characters/shadow");
    const outputDir = productiveOutputPath();
    let peakRssBytes = process.memoryUsage().rss;
    const monitor = setInterval(() => { peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss); }, 25);
    try {
        const source = await loadCharacterCompactGenerationSource(shadowRoot);
        const first = await generate(source);
        (global as any).gc?.();
        const second = await generate(source);
        peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss);
        for (const [label, left, right] of [
            ["payload", first.gzip, second.gzip],
            ["raw payload", first.raw, second.raw],
            ["coverage", jsonBytes(first.coverage), jsonBytes(second.coverage)],
            ["validation", jsonBytes(first.validation), jsonBytes(second.validation)],
            ["readiness", jsonBytes(first.readiness), jsonBytes(second.readiness)],
        ] as const) if (!left.equals(right)) throw new Error(`K15 two-generation byte identity failed for ${label}`);
        if (peakRssBytes >= 1_073_741_824) throw new Error(`K15 memory limit exceeded: ${peakRssBytes}`);

        const fileName = `database-characters-k15-compact-supported.${first.sha256}.json.gz`;
        const coverageBytes = jsonBytes(first.coverage);
        const validationBytes = jsonBytes(first.validation);
        const readinessBytes = jsonBytes(first.readiness);
        const manifest: CharacterCompactManifest = {
            schemaVersion: 1,
            contract: "dokkan-database-character-compact-shadow-manifest",
            contractVersion: "1.0.0",
            generatedAt: source.generatedAt,
            datasetVersion: source.datasetVersion,
            fileName,
            compression: "gzip",
            sha256: first.sha256,
            sizeBytes: first.gzip.length,
            uncompressedSha256: first.rawSha256,
            uncompressedSizeBytes: first.raw.length,
            recordCount: first.projection.records.length,
            lineage: source.lineage,
            coverageFile: "database-characters-k15-coverage.json",
            coverageSha256: sha256Bytes(coverageBytes),
            coverageSizeBytes: coverageBytes.length,
            validationFile: "database-characters-k15-validation.json",
            validationSha256: sha256Bytes(validationBytes),
            validationSizeBytes: validationBytes.length,
            readinessFile: "database-characters-k15-readiness.json",
            readinessSha256: sha256Bytes(readinessBytes),
            readinessSizeBytes: readinessBytes.length,
        };
        const manifestBytes = jsonBytes(manifest);
        assertPinnedCharacterCompactReleaseManifest(manifest, manifestBytes);
        if (fileName !== CHARACTER_COMPACT_PINNED_RELEASE.payloadFile) throw new Error("K15 generated payload is not the pinned release");
        const report = {
            outputDir,
            manifest,
            manifestSha256: sha256Bytes(manifestBytes),
            manifestSizeBytes: manifestBytes.length,
            coverage: first.coverage,
            twoGenerationByteIdentical: true,
            peakRssBytes,
            budgets: { gzipMaximumBytes: CHARACTER_COMPACT_GZIP_BUDGET_BYTES, rawMaximumBytes: CHARACTER_COMPACT_RAW_BUDGET_BYTES },
            readiness: first.readiness,
        };
        const writtenOutput = await writeProductiveFiles([
            { name: fileName, bytes: first.gzip },
            { name: CHARACTER_COMPACT_PINNED_RELEASE.manifestFile, bytes: manifestBytes },
            { name: manifest.coverageFile, bytes: coverageBytes },
            { name: manifest.validationFile, bytes: validationBytes },
            { name: manifest.readinessFile, bytes: readinessBytes },
            { name: RUN_REPORT_FILE, bytes: jsonBytes(report), preserveExisting: true },
        ]);
        if (!samePath(writtenOutput, outputDir)) throw new Error("K15 productive output path changed");
        await validateCharacterCompactArtifact(outputDir);
        console.log(JSON.stringify(report, null, 2));
    } finally {
        clearInterval(monitor);
    }
}

if (require.main === module) run().catch(error => { console.error(error); process.exitCode = 1; });
