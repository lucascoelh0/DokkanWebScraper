import { execFile } from "child_process";
import { createHash } from "crypto";
import { lstat, realpath } from "fs/promises";
import { isAbsolute, resolve } from "path";
import { CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_ANDROID_SOURCE_PIN } from "./leader-supported-compatibility-golden";

const GIT_TIMEOUT_MS = 10_000;
const GIT_STDERR_LIMIT_BYTES = 16 * 1024;
const GIT_METADATA_LIMIT_BYTES = 16 * 1024;
const SHA_1 = /^[0-9a-f]{40}$/;

export interface CharacterLeaderCompatibilityGitCommand {
    repository: string;
    args: readonly string[];
    maximumStdoutBytesExclusive: number;
    label: string;
}

export interface CharacterLeaderCompatibilityGitExecutor {
    run(command: CharacterLeaderCompatibilityGitCommand): Promise<Buffer>;
}

export interface CharacterLeaderCompatibilityAndroidSourceIdentity {
    repositoryUrl: string;
    commit: string;
    access: "git_object_database_only";
    checkoutBytesRead: false;
    files: Array<{ path: string; blobId: string; sizeBytes: number; sha256: string }>;
    fingerprintSha256: string;
}

export interface CharacterLeaderCompatibilityAndroidSourcePin {
    readonly repositoryUrl: string;
    readonly commit: string;
    readonly files: readonly Readonly<{ path: string; blobId: string; sizeBytes: number; sha256: string }>[];
}

function hash(bytes: Buffer | string): string {
    return createHash("sha256").update(bytes).digest("hex");
}

function fingerprint(value: Omit<CharacterLeaderCompatibilityAndroidSourceIdentity, "fingerprintSha256">): string {
    return hash(JSON.stringify(value));
}

function singleLine(bytes: Buffer, label: string): string {
    const value = bytes.toString("utf8");
    if (!value.endsWith("\n") || value.slice(0, -1).includes("\n") || value.includes("\0")) {
        throw new Error(`K62.1 Android Git ${label} response rejected`);
    }
    return value.slice(0, -1).replace(/\r$/, "");
}

function samePath(left: string, right: string): boolean {
    const normalizedLeft = resolve(left);
    const normalizedRight = resolve(right);
    return process.platform === "win32"
        ? normalizedLeft.toLowerCase() === normalizedRight.toLowerCase()
        : normalizedLeft === normalizedRight;
}

function boundedGitEnvironment(ambient: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
    const environment: NodeJS.ProcessEnv = {};
    for (const [key, value] of Object.entries(ambient)) {
        if (!key.toUpperCase().startsWith("GIT_")) environment[key] = value;
    }
    environment.LC_ALL = "C";
    environment.GIT_NO_LAZY_FETCH = "1";
    environment.GIT_OPTIONAL_LOCKS = "0";
    return environment;
}

export function characterLeaderSupportedCompatibilityGitEnvironmentForTest(
    ambient: NodeJS.ProcessEnv,
): NodeJS.ProcessEnv {
    return boundedGitEnvironment(ambient);
}

const boundedGitExecutor: CharacterLeaderCompatibilityGitExecutor = {
    run(command): Promise<Buffer> {
        const maximumBuffer = Math.max(command.maximumStdoutBytesExclusive, GIT_STDERR_LIMIT_BYTES);
        return new Promise((resolvePromise, reject) => {
            execFile(
                "git",
                ["-C", command.repository, ...command.args],
                {
                    encoding: "buffer",
                    maxBuffer: maximumBuffer,
                    timeout: GIT_TIMEOUT_MS,
                    windowsHide: true,
                    shell: false,
                    env: boundedGitEnvironment(process.env),
                },
                (error, stdout, stderr) => {
                    const output = Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout ?? "");
                    const errorOutput = Buffer.isBuffer(stderr) ? stderr : Buffer.from(stderr ?? "");
                    if (error || errorOutput.length !== 0
                        || output.length >= command.maximumStdoutBytesExclusive) {
                        reject(new Error(`K62.1 bounded Android Git command failed: ${command.label}`));
                        return;
                    }
                    resolvePromise(output);
                },
            );
        });
    },
};

async function inspectRepository(value: string): Promise<string> {
    if (!value || !isAbsolute(value)) throw new Error("K62.1 Android repository must be an absolute path");
    const repository = resolve(value);
    const [metadata, canonical] = await Promise.all([lstat(repository), realpath(repository)]);
    if (!metadata.isDirectory() || metadata.isSymbolicLink() || !samePath(repository, canonical)) {
        throw new Error("K62.1 Android repository must be a canonical non-link directory");
    }
    return repository;
}

async function runGit(
    executor: CharacterLeaderCompatibilityGitExecutor,
    repository: string,
    args: readonly string[],
    maximumStdoutBytesExclusive: number,
    label: string,
): Promise<Buffer> {
    const output = await executor.run({ repository, args, maximumStdoutBytesExclusive, label });
    if (!Buffer.isBuffer(output) || output.length >= maximumStdoutBytesExclusive) {
        throw new Error(`K62.1 Android Git ${label} output limit reached`);
    }
    return output;
}

async function verifyAndroidSource(
    repositoryValue: string,
    executor: CharacterLeaderCompatibilityGitExecutor,
    pin: CharacterLeaderCompatibilityAndroidSourcePin,
): Promise<CharacterLeaderCompatibilityAndroidSourceIdentity> {
    const repository = await inspectRepository(repositoryValue);
    const topLevel = singleLine(await runGit(
        executor, repository, ["rev-parse", "--show-toplevel"], GIT_METADATA_LIMIT_BYTES, "repository root",
    ), "repository root");
    if (!samePath(topLevel, repository)) throw new Error("K62.1 Android Git repository root changed");
    const repositoryUrl = singleLine(await runGit(
        executor, repository, ["config", "--get", "remote.origin.url"], GIT_METADATA_LIMIT_BYTES, "repository URL",
    ), "repository URL");
    if (repositoryUrl !== pin.repositoryUrl) throw new Error("K62.1 Android Git repository URL changed");
    const directCommit = singleLine(await runGit(
        executor, repository, ["rev-parse", "--verify", "--end-of-options", pin.commit],
        GIT_METADATA_LIMIT_BYTES, "commit",
    ), "commit");
    const peeledCommit = singleLine(await runGit(
        executor, repository, ["rev-parse", "--verify", "--end-of-options", `${pin.commit}^{commit}`],
        GIT_METADATA_LIMIT_BYTES, "commit lineage",
    ), "commit lineage");
    if (directCommit !== pin.commit || peeledCommit !== pin.commit || !SHA_1.test(directCommit)) {
        throw new Error("K62.1 Android Git commit lineage changed");
    }

    const files: CharacterLeaderCompatibilityAndroidSourceIdentity["files"] = [];
    for (const source of pin.files) {
        const treeBytes = await runGit(
            executor, repository, ["ls-tree", "-z", pin.commit, "--", source.path],
            GIT_METADATA_LIMIT_BYTES, `tree entry ${source.path}`,
        );
        const expectedTreeEntry = `100644 blob ${source.blobId}\t${source.path}\0`;
        if (!treeBytes.equals(Buffer.from(expectedTreeEntry, "utf8"))) {
            throw new Error(`K62.1 Android Git path/blob changed: ${source.path}`);
        }
        const objectType = singleLine(await runGit(
            executor, repository, ["cat-file", "-t", source.blobId], GIT_METADATA_LIMIT_BYTES,
            `blob type ${source.path}`,
        ), `blob type ${source.path}`);
        if (objectType !== "blob") throw new Error(`K62.1 Android Git object type changed: ${source.path}`);
        const objectSize = singleLine(await runGit(
            executor, repository, ["cat-file", "-s", source.blobId], GIT_METADATA_LIMIT_BYTES,
            `blob size ${source.path}`,
        ), `blob size ${source.path}`);
        if (objectSize !== String(source.sizeBytes)) throw new Error(`K62.1 Android Git blob size changed: ${source.path}`);
        const bytes = await runGit(
            executor, repository, ["cat-file", "blob", source.blobId], source.sizeBytes + 1,
            `blob bytes ${source.path}`,
        );
        if (bytes.length !== source.sizeBytes || hash(bytes) !== source.sha256) {
            throw new Error(`K62.1 Android Git blob bytes changed: ${source.path}`);
        }
        files.push({ ...source });
    }
    const identity = {
        repositoryUrl,
        commit: pin.commit,
        access: "git_object_database_only" as const,
        checkoutBytesRead: false as const,
        files,
    };
    return { ...identity, fingerprintSha256: fingerprint(identity) };
}

export async function verifyCharacterLeaderSupportedCompatibilityAndroidSource(
    repositoryValue: string,
): Promise<CharacterLeaderCompatibilityAndroidSourceIdentity> {
    return verifyAndroidSource(
        repositoryValue,
        boundedGitExecutor,
        CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_ANDROID_SOURCE_PIN,
    );
}

export async function verifyCharacterLeaderSupportedCompatibilityAndroidSourceForTest(
    repositoryValue: string,
    executor: CharacterLeaderCompatibilityGitExecutor,
    pin: CharacterLeaderCompatibilityAndroidSourcePin,
): Promise<CharacterLeaderCompatibilityAndroidSourceIdentity> {
    return verifyAndroidSource(repositoryValue, executor, pin);
}
