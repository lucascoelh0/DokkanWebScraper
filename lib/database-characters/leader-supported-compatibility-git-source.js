"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyCharacterLeaderSupportedCompatibilityAndroidSourceForTest = exports.verifyCharacterLeaderCompatibilityAndroidSourcePin = exports.verifyCharacterLeaderSupportedCompatibilityAndroidSource = exports.characterLeaderSupportedCompatibilityGitEnvironmentForTest = void 0;
const child_process_1 = require("child_process");
const crypto_1 = require("crypto");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const leader_supported_compatibility_golden_1 = require("./leader-supported-compatibility-golden");
const GIT_TIMEOUT_MS = 10000;
const GIT_STDERR_LIMIT_BYTES = 16 * 1024;
const GIT_METADATA_LIMIT_BYTES = 16 * 1024;
const SHA_1 = /^[0-9a-f]{40}$/;
function hash(bytes) {
    return (0, crypto_1.createHash)("sha256").update(bytes).digest("hex");
}
function fingerprint(value) {
    return hash(JSON.stringify(value));
}
function singleLine(bytes, label) {
    const value = bytes.toString("utf8");
    if (!value.endsWith("\n") || value.slice(0, -1).includes("\n") || value.includes("\0")) {
        throw new Error(`K62.1 Android Git ${label} response rejected`);
    }
    return value.slice(0, -1).replace(/\r$/, "");
}
function samePath(left, right) {
    const normalizedLeft = (0, path_1.resolve)(left);
    const normalizedRight = (0, path_1.resolve)(right);
    return process.platform === "win32"
        ? normalizedLeft.toLowerCase() === normalizedRight.toLowerCase()
        : normalizedLeft === normalizedRight;
}
function boundedGitEnvironment(ambient) {
    const environment = {};
    for (const [key, value] of Object.entries(ambient)) {
        if (!key.toUpperCase().startsWith("GIT_"))
            environment[key] = value;
    }
    environment.LC_ALL = "C";
    environment.GIT_NO_LAZY_FETCH = "1";
    environment.GIT_OPTIONAL_LOCKS = "0";
    return environment;
}
function characterLeaderSupportedCompatibilityGitEnvironmentForTest(ambient) {
    return boundedGitEnvironment(ambient);
}
exports.characterLeaderSupportedCompatibilityGitEnvironmentForTest = characterLeaderSupportedCompatibilityGitEnvironmentForTest;
const boundedGitExecutor = {
    run(command) {
        const maximumBuffer = Math.max(command.maximumStdoutBytesExclusive, GIT_STDERR_LIMIT_BYTES);
        return new Promise((resolvePromise, reject) => {
            (0, child_process_1.execFile)("git", ["-C", command.repository, ...command.args], {
                encoding: "buffer",
                maxBuffer: maximumBuffer,
                timeout: GIT_TIMEOUT_MS,
                windowsHide: true,
                shell: false,
                env: boundedGitEnvironment(process.env),
            }, (error, stdout, stderr) => {
                const output = Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout ?? "");
                const errorOutput = Buffer.isBuffer(stderr) ? stderr : Buffer.from(stderr ?? "");
                if (error || errorOutput.length !== 0
                    || output.length >= command.maximumStdoutBytesExclusive) {
                    reject(new Error(`K62.1 bounded Android Git command failed: ${command.label}`));
                    return;
                }
                resolvePromise(output);
            });
        });
    },
};
async function inspectRepository(value) {
    if (!value || !(0, path_1.isAbsolute)(value))
        throw new Error("K62.1 Android repository must be an absolute path");
    const repository = (0, path_1.resolve)(value);
    const [metadata, canonical] = await Promise.all([(0, promises_1.lstat)(repository), (0, promises_1.realpath)(repository)]);
    if (!metadata.isDirectory() || metadata.isSymbolicLink() || !samePath(repository, canonical)) {
        throw new Error("K62.1 Android repository must be a canonical non-link directory");
    }
    return repository;
}
async function runGit(executor, repository, args, maximumStdoutBytesExclusive, label) {
    const output = await executor.run({ repository, args, maximumStdoutBytesExclusive, label });
    if (!Buffer.isBuffer(output) || output.length >= maximumStdoutBytesExclusive) {
        throw new Error(`K62.1 Android Git ${label} output limit reached`);
    }
    return output;
}
async function verifyAndroidSource(repositoryValue, executor, pin) {
    const repository = await inspectRepository(repositoryValue);
    const topLevel = singleLine(await runGit(executor, repository, ["rev-parse", "--show-toplevel"], GIT_METADATA_LIMIT_BYTES, "repository root"), "repository root");
    if (!samePath(topLevel, repository))
        throw new Error("K62.1 Android Git repository root changed");
    const repositoryUrl = singleLine(await runGit(executor, repository, ["config", "--get", "remote.origin.url"], GIT_METADATA_LIMIT_BYTES, "repository URL"), "repository URL");
    if (repositoryUrl !== pin.repositoryUrl)
        throw new Error("K62.1 Android Git repository URL changed");
    const directCommit = singleLine(await runGit(executor, repository, ["rev-parse", "--verify", "--end-of-options", pin.commit], GIT_METADATA_LIMIT_BYTES, "commit"), "commit");
    const peeledCommit = singleLine(await runGit(executor, repository, ["rev-parse", "--verify", "--end-of-options", `${pin.commit}^{commit}`], GIT_METADATA_LIMIT_BYTES, "commit lineage"), "commit lineage");
    if (directCommit !== pin.commit || peeledCommit !== pin.commit || !SHA_1.test(directCommit)) {
        throw new Error("K62.1 Android Git commit lineage changed");
    }
    const files = [];
    for (const source of pin.files) {
        const treeBytes = await runGit(executor, repository, ["ls-tree", "-z", pin.commit, "--", source.path], GIT_METADATA_LIMIT_BYTES, `tree entry ${source.path}`);
        const expectedTreeEntry = `100644 blob ${source.blobId}\t${source.path}\0`;
        if (!treeBytes.equals(Buffer.from(expectedTreeEntry, "utf8"))) {
            throw new Error(`K62.1 Android Git path/blob changed: ${source.path}`);
        }
        const objectType = singleLine(await runGit(executor, repository, ["cat-file", "-t", source.blobId], GIT_METADATA_LIMIT_BYTES, `blob type ${source.path}`), `blob type ${source.path}`);
        if (objectType !== "blob")
            throw new Error(`K62.1 Android Git object type changed: ${source.path}`);
        const objectSize = singleLine(await runGit(executor, repository, ["cat-file", "-s", source.blobId], GIT_METADATA_LIMIT_BYTES, `blob size ${source.path}`), `blob size ${source.path}`);
        if (objectSize !== String(source.sizeBytes))
            throw new Error(`K62.1 Android Git blob size changed: ${source.path}`);
        const bytes = await runGit(executor, repository, ["cat-file", "blob", source.blobId], source.sizeBytes + 1, `blob bytes ${source.path}`);
        if (bytes.length !== source.sizeBytes || hash(bytes) !== source.sha256) {
            throw new Error(`K62.1 Android Git blob bytes changed: ${source.path}`);
        }
        files.push({ ...source });
    }
    const identity = {
        repositoryUrl,
        commit: pin.commit,
        access: "git_object_database_only",
        checkoutBytesRead: false,
        files,
    };
    return { ...identity, fingerprintSha256: fingerprint(identity) };
}
async function verifyCharacterLeaderSupportedCompatibilityAndroidSource(repositoryValue) {
    return verifyCharacterLeaderCompatibilityAndroidSourcePin(repositoryValue, leader_supported_compatibility_golden_1.CHARACTER_LEADER_SUPPORTED_COMPATIBILITY_ANDROID_SOURCE_PIN);
}
exports.verifyCharacterLeaderSupportedCompatibilityAndroidSource = verifyCharacterLeaderSupportedCompatibilityAndroidSource;
async function verifyCharacterLeaderCompatibilityAndroidSourcePin(repositoryValue, pin) {
    return verifyAndroidSource(repositoryValue, boundedGitExecutor, pin);
}
exports.verifyCharacterLeaderCompatibilityAndroidSourcePin = verifyCharacterLeaderCompatibilityAndroidSourcePin;
async function verifyCharacterLeaderSupportedCompatibilityAndroidSourceForTest(repositoryValue, executor, pin) {
    return verifyAndroidSource(repositoryValue, executor, pin);
}
exports.verifyCharacterLeaderSupportedCompatibilityAndroidSourceForTest = verifyCharacterLeaderSupportedCompatibilityAndroidSourceForTest;
//# sourceMappingURL=leader-supported-compatibility-git-source.js.map