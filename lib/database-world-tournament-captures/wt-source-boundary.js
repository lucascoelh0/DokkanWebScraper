"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readWtExternalSource = exports.isRealpathContained = void 0;
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const path_1 = require("path");
const SOURCE_ID = "world-tournament-until-start-crash-2026-08-16";
const normalized = (value) => process.platform === "win32" ? value.toLowerCase() : value;
const samePath = (left, right) => normalized((0, path_1.resolve)(left)) === normalized((0, path_1.resolve)(right));
function isRealpathContained(root, candidate) {
    const inside = (0, path_1.relative)(root, candidate);
    return inside !== "" && inside !== ".." && !inside.startsWith(`..${path_1.sep}`) && !(0, path_1.isAbsolute)(inside);
}
exports.isRealpathContained = isRealpathContained;
function rejectReparse(path) {
    const info = (0, fs_1.lstatSync)(path);
    if (info.isSymbolicLink() || !samePath(fs_1.realpathSync.native(path), path))
        throw new Error("WT source reparse boundary");
}
function validateRelativePath(value) {
    if (!value || value.includes("\0") || /^[A-Za-z]:/.test(value) || /^[/\\]{2}/.test(value) || /^[\\/]/.test(value) || (0, path_1.isAbsolute)(value))
        throw new Error("WT source relative-path boundary");
    if (value.includes("/") && value.includes("\\"))
        throw new Error("WT source mixed-separator boundary");
    const components = value.split(value.includes("\\") ? "\\" : "/");
    if (components.length === 0 || components.some(component => !component || component === "." || component === ".." || component.includes(":")))
        throw new Error("WT source traversal boundary");
    return components;
}
function validateTree(repositoryRootArgument, sourceRootArgument, sourceRelativePath) {
    if (!(0, path_1.isAbsolute)(sourceRootArgument))
        throw new Error("WT source-root must be absolute");
    const repositoryRoot = fs_1.realpathSync.native(repositoryRootArgument), lexicalRoot = (0, path_1.resolve)(sourceRootArgument);
    rejectReparse(lexicalRoot);
    const rootInfo = (0, fs_1.statSync)(lexicalRoot);
    if (!rootInfo.isDirectory())
        throw new Error("WT source-root must be a directory");
    const sourceRoot = fs_1.realpathSync.native(lexicalRoot);
    const rootInsideRepository = (0, path_1.relative)(repositoryRoot, sourceRoot);
    if (rootInsideRepository === "" || (!rootInsideRepository.startsWith(`..${path_1.sep}`) && rootInsideRepository !== ".." && !(0, path_1.isAbsolute)(rootInsideRepository)))
        throw new Error("WT source-root must be external");
    const components = validateRelativePath(sourceRelativePath);
    let current = sourceRoot;
    for (const component of components) {
        current = (0, path_1.resolve)(current, component);
        rejectReparse(current);
    }
    const sourcePath = fs_1.realpathSync.native(current);
    if (!isRealpathContained(sourceRoot, sourcePath))
        throw new Error("WT source containment boundary");
    const fileInfo = (0, fs_1.statSync)(sourcePath);
    if (!fileInfo.isFile())
        throw new Error("WT source must be a regular file");
    return { sourceRoot, sourcePath };
}
function sameIdentity(left, right) {
    return left.dev === right.dev && left.ino === right.ino && left.size === right.size && left.mtimeMs === right.mtimeMs && left.ctimeMs === right.ctimeMs;
}
function readBoundedSource(repositoryRootArgument, sourceRootArgument, sourceRelativePath) {
    const repositoryRoot = fs_1.realpathSync.native(repositoryRootArgument), first = validateTree(repositoryRoot, sourceRootArgument, sourceRelativePath), before = (0, fs_1.statSync)(first.sourcePath);
    if (before.size <= 0 || before.size > 64 * 1024 * 1024)
        throw new Error("WT source size boundary");
    let bytes;
    try {
        bytes = (0, fs_1.readFileSync)(first.sourcePath);
    }
    catch {
        throw new Error("WT source read failed");
    }
    const second = validateTree(repositoryRoot, sourceRootArgument, sourceRelativePath), after = (0, fs_1.statSync)(second.sourcePath);
    if (!samePath(first.sourceRoot, second.sourceRoot) || !samePath(first.sourcePath, second.sourcePath) || !sameIdentity(before, after) || bytes.length !== after.size)
        throw new Error("WT source identity changed during read");
    return { operationalPath: second.sourcePath, text: bytes.toString("utf8"), identity: { sourceId: SOURCE_ID, sizeBytes: bytes.length, sha256: (0, crypto_1.createHash)("sha256").update(bytes).digest("hex") } };
}
function readWtExternalSource(repositoryRootArgument, sourceRootArgument, sourceRelativePath) {
    try {
        return readBoundedSource(repositoryRootArgument, sourceRootArgument, sourceRelativePath);
    }
    catch (error) {
        if (error instanceof Error && error.message.startsWith("WT source"))
            throw error;
        throw new Error("WT source boundary validation failed");
    }
}
exports.readWtExternalSource = readWtExternalSource;
//# sourceMappingURL=wt-source-boundary.js.map