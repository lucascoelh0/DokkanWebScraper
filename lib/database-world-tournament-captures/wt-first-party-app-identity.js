"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractWtFirstPartyAppIdentity = exports.validateWtFirstPartyAppIdentityProof = exports.validateWtFirstPartyAppIdentityEvidence = exports.WT_FIRST_PARTY_SNAPSHOT_LINEAGE_SHA256 = exports.WT_FIRST_PARTY_SNAPSHOT_CONTRACT = exports.WT_FIRST_PARTY_APP_IDENTITY_SHA256 = exports.WT_FIRST_PARTY_APP_IDENTITY_SIZE_BYTES = exports.WT_FIRST_PARTY_AAPT_VERSION = exports.WT_FIRST_PARTY_AAPT_SHA256 = exports.WT_FIRST_PARTY_AAPT_SIZE_BYTES = exports.WT_FIRST_PARTY_APK_SHA256 = exports.WT_FIRST_PARTY_APK_SIZE_BYTES = exports.WT_FIRST_PARTY_APP_IDENTITY_RULE = void 0;
const child_process_1 = require("child_process");
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path_1 = require("path");
exports.WT_FIRST_PARTY_APP_IDENTITY_RULE = "public_first_party_app_bundle_identity_v1";
exports.WT_FIRST_PARTY_APK_SIZE_BYTES = 98799013;
exports.WT_FIRST_PARTY_APK_SHA256 = "a51ba758e0555e0a756aa4f20278e6bec25ba6b0c7dcdcd0f4372e0fad159bc0";
exports.WT_FIRST_PARTY_AAPT_SIZE_BYTES = 1646688;
exports.WT_FIRST_PARTY_AAPT_SHA256 = "3a79b1b3f6e68d83a0eb5fe82bd557f51c6c02f07355ee0ad293c5ea43e32427";
exports.WT_FIRST_PARTY_AAPT_VERSION = "Android Asset Packaging Tool, v0.2-12874835";
exports.WT_FIRST_PARTY_APP_IDENTITY_SIZE_BYTES = 32;
exports.WT_FIRST_PARTY_APP_IDENTITY_SHA256 = "74d2f87b503e9ff38f27298af6942a1a1898d1aef543b6c85720205e92cd0888";
exports.WT_FIRST_PARTY_SNAPSHOT_CONTRACT = "private-open-filehandle-snapshot-execution-v1";
const APK_SNAPSHOT_NAME = "source.apk";
const AAPT_SNAPSHOT_NAME = "aapt.exe";
const COPY_METHOD = "single_open_filehandle_stream_incremental_sha256";
const EXECUTION_METHOD = "private_snapshots_only_no_shell";
const VALIDATION_METHOD = "identity_size_stable_timestamps_type_sha256_before_after";
const CLEANUP_METHOD = "owned_identity_only_or_quarantine";
const sha256 = (value) => (0, crypto_1.createHash)("sha256").update(value).digest("hex");
const normalizedPath = (value) => process.platform === "win32" ? value.toLowerCase() : value;
const samePath = (left, right) => normalizedPath((0, path_1.resolve)(left)) === normalizedPath((0, path_1.resolve)(right));
const isContained = (root, target) => {
    const candidate = (0, path_1.relative)(root, target);
    return candidate === "" || (!candidate.startsWith(`..${require("path").sep}`) && candidate !== ".." && !(0, path_1.isAbsolute)(candidate));
};
const fileIdentity = (stats) => ({
    dev: stats.dev,
    ino: stats.ino,
    nlink: stats.nlink,
    size: stats.size,
    mode: stats.mode,
    atimeNs: stats.atimeNs,
    mtimeNs: stats.mtimeNs,
    ctimeNs: stats.ctimeNs,
    birthtimeNs: stats.birthtimeNs,
});
const directoryIdentity = (stats) => ({ dev: stats.dev, ino: stats.ino, mode: stats.mode });
const sameMaterialFile = (left, right) => left.dev === right.dev && left.ino === right.ino && left.nlink === right.nlink && left.size === right.size && left.mode === right.mode && left.mtimeNs === right.mtimeNs && left.ctimeNs === right.ctimeNs && left.birthtimeNs === right.birthtimeNs;
const sameDirectory = (left, right) => left.dev === right.dev && left.ino === right.ino && left.mode === right.mode;
const canonicalLineage = (contract) => ({
    contract: exports.WT_FIRST_PARTY_SNAPSHOT_CONTRACT,
    apk: { relativePath: APK_SNAPSHOT_NAME, sizeBytes: contract.apk.sizeBytes, sha256: contract.apk.sha256 },
    tool: { relativePath: AAPT_SNAPSHOT_NAME, sizeBytes: contract.tool.sizeBytes, sha256: contract.tool.sha256 },
    sourceOpenCount: { apk: 1, tool: 1 },
    copy: COPY_METHOD,
    execution: EXECUTION_METHOD,
    validation: VALIDATION_METHOD,
    cleanup: CLEANUP_METHOD,
});
const lineageSha256 = (lineage) => sha256(JSON.stringify(lineage));
async function fsyncDirectory(path) {
    let handle;
    try {
        handle = await (0, promises_1.open)(path, fs_1.constants.O_RDONLY);
        await handle.sync();
    }
    catch (error) {
        if (!["EINVAL", "ENOTSUP", "EISDIR", "EPERM", "EBADF"].includes(error?.code))
            throw error;
    }
    finally {
        await handle?.close().catch(() => undefined);
    }
}
async function validateDirectory(path, expected) {
    const info = await (0, promises_1.lstat)(path, { bigint: true });
    if (!info.isDirectory() || info.isSymbolicLink())
        throw new Error("WT private snapshot directory type rejected");
    const canonical = await (0, promises_1.realpath)(path);
    if (!samePath(canonical, path))
        throw new Error("WT private snapshot directory reparse rejected");
    const identity = directoryIdentity(info);
    if (expected && !sameDirectory(identity, expected))
        throw new Error("WT private snapshot directory identity changed");
    return identity;
}
async function openPinnedSource(path, pin) {
    if (!path || !(0, path_1.isAbsolute)(path))
        throw new Error("WT first-party source path is required");
    const absolute = (0, path_1.resolve)(path), root = (0, path_1.dirname)(absolute), rootIdentity = await validateDirectory(root);
    const before = await (0, promises_1.lstat)(absolute, { bigint: true });
    if (!before.isFile() || before.isSymbolicLink())
        throw new Error("WT first-party source must be a regular non-reparse file");
    const canonical = await (0, promises_1.realpath)(absolute);
    if (!samePath(canonical, absolute) || !isContained(await (0, promises_1.realpath)(root), canonical))
        throw new Error("WT first-party source containment rejected");
    await validateDirectory(root, rootIdentity);
    const noFollow = typeof fs_1.constants.O_NOFOLLOW === "number" ? fs_1.constants.O_NOFOLLOW : 0;
    const handle = await (0, promises_1.open)(absolute, fs_1.constants.O_RDONLY | noFollow);
    try {
        const opened = await handle.stat({ bigint: true });
        const identity = fileIdentity(opened);
        if (!opened.isFile() || opened.isSymbolicLink?.() || identity.nlink !== 1n || identity.size !== BigInt(pin.sizeBytes))
            throw new Error("WT first-party source identity mismatch");
        if (identity.dev !== before.dev || identity.ino !== before.ino || identity.size !== before.size)
            throw new Error("WT first-party source changed before opening");
        return { path: absolute, root, handle, identity };
    }
    catch (error) {
        await handle.close();
        throw error;
    }
}
async function hashOpenFile(handle) {
    const digest = (0, crypto_1.createHash)("sha256"), buffer = Buffer.allocUnsafe(64 * 1024);
    let position = 0;
    while (true) {
        const { bytesRead } = await handle.read(buffer, 0, buffer.length, position);
        if (bytesRead === 0)
            break;
        digest.update(buffer.subarray(0, bytesRead));
        position += bytesRead;
    }
    return { sizeBytes: position, sha256: digest.digest("hex") };
}
async function copyOpenSource(source, destination, pin, executable) {
    const handle = await (0, promises_1.open)(destination, fs_1.constants.O_CREAT | fs_1.constants.O_EXCL | fs_1.constants.O_RDWR, executable ? 0o500 : 0o400);
    try {
        const digest = (0, crypto_1.createHash)("sha256"), buffer = Buffer.allocUnsafe(64 * 1024);
        let position = 0;
        while (true) {
            const { bytesRead } = await source.handle.read(buffer, 0, buffer.length, position);
            if (bytesRead === 0)
                break;
            let written = 0;
            while (written < bytesRead)
                written += (await handle.write(buffer, written, bytesRead - written, position + written)).bytesWritten;
            digest.update(buffer.subarray(0, bytesRead));
            position += bytesRead;
        }
        const copiedSha256 = digest.digest("hex"), sourceAfter = fileIdentity(await source.handle.stat({ bigint: true }));
        if (!sameMaterialFile(source.identity, sourceAfter))
            throw new Error("WT first-party source changed while snapshotting");
        if (position !== pin.sizeBytes || copiedSha256 !== pin.sha256)
            throw new Error("WT first-party source pin mismatch");
        await handle.sync();
        try {
            await (0, promises_1.chmod)(destination, executable ? 0o500 : 0o400);
        }
        catch (error) {
            if (process.platform !== "win32")
                throw error;
        }
        await handle.sync();
        const stats = await handle.stat({ bigint: true }), identity = fileIdentity(stats);
        if (!stats.isFile() || stats.isSymbolicLink?.() || identity.nlink !== 1n || identity.size !== BigInt(pin.sizeBytes))
            throw new Error("WT private snapshot material identity rejected");
        if (process.platform !== "win32" && (Number(identity.mode) & 0o222) !== 0)
            throw new Error("WT private snapshot is writable");
        const pathInfo = await (0, promises_1.lstat)(destination, { bigint: true }), canonical = await (0, promises_1.realpath)(destination);
        if (!pathInfo.isFile() || pathInfo.isSymbolicLink() || !samePath(canonical, destination) || pathInfo.dev !== identity.dev || pathInfo.ino !== identity.ino)
            throw new Error("WT private snapshot pathname identity rejected");
        const copied = await hashOpenFile(handle);
        if (copied.sizeBytes !== pin.sizeBytes || copied.sha256 !== pin.sha256)
            throw new Error("WT private snapshot verification failed");
        const material = { path: destination, relativePath: (0, path_1.basename)(destination), identity: fileIdentity(await handle.stat({ bigint: true })), sha256: copied.sha256 };
        await handle.close();
        return material;
    }
    catch (error) {
        await handle.close().catch(() => undefined);
        throw error;
    }
}
async function validateSnapshot(root, directory, rootIdentity, directoryIdentityValue, material, pin) {
    await validateDirectory(root, rootIdentity);
    await validateDirectory(directory, directoryIdentityValue);
    const canonical = await (0, promises_1.realpath)(material.path), pathInfo = await (0, promises_1.lstat)(material.path, { bigint: true });
    if (!isContained(directory, canonical) || !samePath(canonical, material.path) || !pathInfo.isFile() || pathInfo.isSymbolicLink())
        throw new Error("WT private snapshot containment or type changed");
    const noFollow = typeof fs_1.constants.O_NOFOLLOW === "number" ? fs_1.constants.O_NOFOLLOW : 0, handle = await (0, promises_1.open)(material.path, fs_1.constants.O_RDONLY | noFollow);
    try {
        const currentIdentity = fileIdentity(await handle.stat({ bigint: true }));
        if (!sameMaterialFile(material.identity, currentIdentity) || pathInfo.dev !== currentIdentity.dev || pathInfo.ino !== currentIdentity.ino || currentIdentity.nlink !== 1n || currentIdentity.size !== BigInt(pin.sizeBytes))
            throw new Error("WT private snapshot material changed");
        const current = await hashOpenFile(handle);
        if (current.sizeBytes !== pin.sizeBytes || current.sha256 !== pin.sha256 || current.sha256 !== material.sha256)
            throw new Error("WT private snapshot bytes changed");
        const afterHash = fileIdentity(await handle.stat({ bigint: true }));
        if (!sameMaterialFile(material.identity, afterHash))
            throw new Error("WT private snapshot stable timestamps changed");
    }
    finally {
        await handle.close();
    }
}
async function runBounded(executable, args, timeoutMs, stdoutLimitBytes, stderrLimitBytes) {
    return new Promise((resolveOutput, rejectOutput) => {
        let child;
        const environment = process.platform === "win32"
            ? { SystemRoot: process.env.SystemRoot, WINDIR: process.env.WINDIR, TEMP: process.env.TEMP, TMP: process.env.TMP }
            : { PATH: "" };
        try {
            child = (0, child_process_1.spawn)(executable, args, { cwd: (0, path_1.dirname)(executable), env: environment, shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
        }
        catch {
            rejectOutput(new Error("WT private snapshot process launch failed"));
            return;
        }
        const stdout = [], stderr = [];
        let stdoutBytes = 0, stderrBytes = 0, failure = "", settled = false, forceTimer;
        const terminate = (reason) => {
            if (!failure)
                failure = reason;
            try {
                child.kill("SIGTERM");
            }
            catch { /* process may already be closed */ }
            if (!forceTimer)
                forceTimer = setTimeout(() => { try {
                    child.kill("SIGKILL");
                }
                catch { /* process may already be closed */ } }, 500);
        };
        const timeout = setTimeout(() => terminate("timeout"), timeoutMs);
        child.stdout.on("data", (chunk) => { stdoutBytes += chunk.length; if (stdoutBytes > stdoutLimitBytes)
            terminate("stdout limit");
        else
            stdout.push(chunk); });
        child.stderr.on("data", (chunk) => { stderrBytes += chunk.length; if (stderrBytes > stderrLimitBytes)
            terminate("stderr limit");
        else
            stderr.push(chunk); });
        child.once("error", () => terminate("launch error"));
        child.once("close", code => {
            if (settled)
                return;
            settled = true;
            clearTimeout(timeout);
            if (forceTimer)
                clearTimeout(forceTimer);
            if (failure || code !== 0)
                rejectOutput(new Error("WT private snapshot process rejected"));
            else
                resolveOutput(Buffer.concat(stdout, stdoutBytes).toString("utf8"));
        });
    });
}
async function quarantineOwnedDirectory(root, directory) {
    const quarantined = (0, path_1.join)(root, `.wt-first-party-quarantine-${(0, crypto_1.randomUUID)()}`);
    await (0, promises_1.rename)(directory, quarantined);
    await fsyncDirectory(root);
}
async function cleanupPrivateDirectory(root, directory, rootIdentity, directoryIdentityValue, materials) {
    await validateDirectory(root, rootIdentity);
    let currentDirectory;
    try {
        currentDirectory = await validateDirectory(directory);
    }
    catch {
        throw new Error("WT private snapshot cleanup ownership refused");
    }
    if (!sameDirectory(currentDirectory, directoryIdentityValue))
        throw new Error("WT private snapshot cleanup ownership refused");
    const expected = new Map(materials.map(value => [(0, path_1.basename)(value.path), value]));
    const entries = await (0, promises_1.readdir)(directory, { withFileTypes: true });
    let safe = entries.length === expected.size;
    for (const entry of entries) {
        const material = expected.get(entry.name), path = (0, path_1.join)(directory, entry.name);
        if (!material || !entry.isFile() || entry.isSymbolicLink()) {
            safe = false;
            continue;
        }
        const info = await (0, promises_1.lstat)(path, { bigint: true });
        if (info.dev !== material.identity.dev || info.ino !== material.identity.ino || info.nlink !== 1n)
            safe = false;
    }
    if (!safe) {
        await quarantineOwnedDirectory(root, directory);
        throw new Error("WT private snapshot cleanup quarantined unexpected namespace");
    }
    for (const material of materials)
        await (0, promises_1.unlink)(material.path);
    await (0, promises_1.rmdir)(directory);
    await fsyncDirectory(root);
}
async function extractWithContract(apkPath, toolPath, privateRoot, contract, hooks = {}) {
    if (!apkPath || !toolPath || !privateRoot)
        throw new Error("WT first-party identity evidence paths are required");
    const root = (0, path_1.resolve)(privateRoot), rootIdentity = await validateDirectory(root);
    let apkSource, toolSource, directory;
    let directoryIdentityValue, apkSnapshot, toolSnapshot;
    let operationError;
    try {
        apkSource = await openPinnedSource(apkPath, contract.apk);
        toolSource = await openPinnedSource(toolPath, contract.tool);
        if (isContained(root, apkSource.path) || isContained(root, toolSource.path))
            throw new Error("WT first-party sources must remain outside the private root");
        await hooks.afterSourcesOpened?.({ apkSource: apkSource.path, toolSource: toolSource.path });
        directory = await (0, promises_1.mkdtemp)((0, path_1.join)(root, "wt-first-party-"));
        await (0, promises_1.chmod)(directory, 0o700).catch(error => { if (process.platform !== "win32")
            throw error; });
        directoryIdentityValue = await validateDirectory(directory);
        const apkDestination = (0, path_1.join)(directory, APK_SNAPSHOT_NAME), toolDestination = (0, path_1.join)(directory, AAPT_SNAPSHOT_NAME);
        await hooks.afterPrivateDirectoryCreated?.({ directory, apkSnapshot: apkDestination, toolSnapshot: toolDestination });
        apkSnapshot = await copyOpenSource(apkSource, apkDestination, contract.apk, false);
        toolSnapshot = await copyOpenSource(toolSource, toolDestination, contract.tool, true);
        await fsyncDirectory(directory);
        directoryIdentityValue = await validateDirectory(directory);
        await apkSource.handle.close();
        apkSource = undefined;
        await toolSource.handle.close();
        toolSource = undefined;
        await hooks.afterSnapshotsMaterialized?.({ directory, apkSnapshot: apkDestination, toolSnapshot: toolDestination });
        await validateSnapshot(root, directory, rootIdentity, directoryIdentityValue, apkSnapshot, contract.apk);
        await validateSnapshot(root, directory, rootIdentity, directoryIdentityValue, toolSnapshot, contract.tool);
        const version = (await runBounded(toolSnapshot.path, contract.versionArgs(apkSnapshot.path), contract.versionTimeoutMs, contract.versionOutputLimitBytes, contract.stderrLimitBytes)).trim();
        if (version !== contract.tool.version)
            throw new Error("WT first-party identity tool version mismatch");
        const badging = await runBounded(toolSnapshot.path, contract.badgingArgs(apkSnapshot.path), contract.badgingTimeoutMs, contract.badgingOutputLimitBytes, contract.stderrLimitBytes);
        await hooks.afterExecution?.({ directory, apkSnapshot: apkDestination, toolSnapshot: toolDestination });
        await validateSnapshot(root, directory, rootIdentity, directoryIdentityValue, apkSnapshot, contract.apk);
        await validateSnapshot(root, directory, rootIdentity, directoryIdentityValue, toolSnapshot, contract.tool);
        const packageRows = badging.split(/\r?\n/).filter(line => line.startsWith("package: "));
        if (packageRows.length !== 1)
            throw new Error("WT first-party APK package identity is ambiguous");
        const match = /^package: name='([^']+)'(?:\s|$)/.exec(packageRows[0]);
        if (!match || !match[1])
            throw new Error("WT first-party APK package identity is malformed");
        const packageIdentity = match[1];
        if (Buffer.byteLength(packageIdentity) !== contract.identity.sizeBytes || sha256(packageIdentity) !== contract.identity.sha256)
            throw new Error("WT first-party APK package identity pin mismatch");
        const snapshot = canonicalLineage(contract), evidence = {
            schemaVersion: 2,
            contract: "dokkan-wt-first-party-app-identity",
            rule: exports.WT_FIRST_PARTY_APP_IDENTITY_RULE,
            apk: { sizeBytes: contract.apk.sizeBytes, sha256: contract.apk.sha256 },
            tool: { name: "aapt", sizeBytes: contract.tool.sizeBytes, executableSha256: contract.tool.sha256, version: contract.tool.version, command: "privateSnapshot/aapt.exe dump badging privateSnapshot/source.apk" },
            snapshot: { ...snapshot, materialLineageSha256: lineageSha256(snapshot) },
            identity: { jsonType: "string", sizeBytes: contract.identity.sizeBytes, sha256: contract.identity.sha256 },
        };
        return { packageIdentity, evidence };
    }
    catch (error) {
        operationError = error;
        throw new Error("WT first-party private snapshot extraction failed");
    }
    finally {
        await apkSource?.handle.close().catch(() => undefined);
        await toolSource?.handle.close().catch(() => undefined);
        if (directory && directoryIdentityValue) {
            try {
                await hooks.beforeCleanup?.({ directory });
                await cleanupPrivateDirectory(root, directory, rootIdentity, directoryIdentityValue, [apkSnapshot, toolSnapshot].filter((value) => Boolean(value)));
            }
            catch {
                if (!operationError)
                    throw new Error("WT first-party private snapshot cleanup failed");
            }
        }
    }
}
const productionContract = {
    apk: { sizeBytes: exports.WT_FIRST_PARTY_APK_SIZE_BYTES, sha256: exports.WT_FIRST_PARTY_APK_SHA256 },
    tool: { sizeBytes: exports.WT_FIRST_PARTY_AAPT_SIZE_BYTES, sha256: exports.WT_FIRST_PARTY_AAPT_SHA256, version: exports.WT_FIRST_PARTY_AAPT_VERSION },
    identity: { sizeBytes: exports.WT_FIRST_PARTY_APP_IDENTITY_SIZE_BYTES, sha256: exports.WT_FIRST_PARTY_APP_IDENTITY_SHA256 },
    versionArgs: () => ["version"],
    badgingArgs: privateApk => ["dump", "badging", privateApk],
    versionTimeoutMs: 10000,
    badgingTimeoutMs: 30000,
    versionOutputLimitBytes: 1024 * 1024,
    badgingOutputLimitBytes: 8 * 1024 * 1024,
    stderrLimitBytes: 1024 * 1024,
};
exports.WT_FIRST_PARTY_SNAPSHOT_LINEAGE_SHA256 = lineageSha256(canonicalLineage(productionContract));
function validateWtFirstPartyAppIdentityEvidence(evidence) {
    const expected = canonicalLineage(productionContract), snapshot = evidence?.snapshot;
    return evidence?.schemaVersion === 2
        && evidence.contract === "dokkan-wt-first-party-app-identity"
        && evidence.rule === exports.WT_FIRST_PARTY_APP_IDENTITY_RULE
        && evidence.apk?.sizeBytes === exports.WT_FIRST_PARTY_APK_SIZE_BYTES
        && evidence.apk?.sha256 === exports.WT_FIRST_PARTY_APK_SHA256
        && evidence.tool?.name === "aapt"
        && evidence.tool.sizeBytes === exports.WT_FIRST_PARTY_AAPT_SIZE_BYTES
        && evidence.tool.executableSha256 === exports.WT_FIRST_PARTY_AAPT_SHA256
        && evidence.tool.version === exports.WT_FIRST_PARTY_AAPT_VERSION
        && evidence.tool.command === "privateSnapshot/aapt.exe dump badging privateSnapshot/source.apk"
        && snapshot?.contract === expected.contract
        && snapshot.apk?.relativePath === expected.apk.relativePath
        && snapshot.apk.sizeBytes === expected.apk.sizeBytes
        && snapshot.apk.sha256 === expected.apk.sha256
        && snapshot.tool?.relativePath === expected.tool.relativePath
        && snapshot.tool.sizeBytes === expected.tool.sizeBytes
        && snapshot.tool.sha256 === expected.tool.sha256
        && snapshot.sourceOpenCount?.apk === 1
        && snapshot.sourceOpenCount.tool === 1
        && snapshot.copy === expected.copy
        && snapshot.execution === expected.execution
        && snapshot.validation === expected.validation
        && snapshot.cleanup === expected.cleanup
        && snapshot.materialLineageSha256 === exports.WT_FIRST_PARTY_SNAPSHOT_LINEAGE_SHA256
        && evidence.identity?.jsonType === "string"
        && evidence.identity.sizeBytes === exports.WT_FIRST_PARTY_APP_IDENTITY_SIZE_BYTES
        && evidence.identity.sha256 === exports.WT_FIRST_PARTY_APP_IDENTITY_SHA256;
}
exports.validateWtFirstPartyAppIdentityEvidence = validateWtFirstPartyAppIdentityEvidence;
function validateWtFirstPartyAppIdentityProof(value) {
    if (!value || typeof value.packageIdentity !== "string" || value.packageIdentity.length === 0)
        return false;
    return validateWtFirstPartyAppIdentityEvidence(value.evidence)
        && Buffer.byteLength(value.packageIdentity) === exports.WT_FIRST_PARTY_APP_IDENTITY_SIZE_BYTES
        && sha256(value.packageIdentity) === exports.WT_FIRST_PARTY_APP_IDENTITY_SHA256;
}
exports.validateWtFirstPartyAppIdentityProof = validateWtFirstPartyAppIdentityProof;
async function extractWtFirstPartyAppIdentity(apkPath, aaptPath, privateRoot) {
    const proof = await extractWithContract(apkPath, aaptPath, privateRoot, productionContract);
    if (!validateWtFirstPartyAppIdentityProof(proof))
        throw new Error("WT first-party APK identity proof is invalid");
    return proof;
}
exports.extractWtFirstPartyAppIdentity = extractWtFirstPartyAppIdentity;
//# sourceMappingURL=wt-first-party-app-identity.js.map