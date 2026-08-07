"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveEventsOutputFiles = exports.resolveEventsInputFile = exports.resolveEventsArtifactPath = exports.EventsArtifactPathError = void 0;
const promises_1 = require("fs/promises");
const path_1 = require("path");
class EventsArtifactPathError extends Error {
    code;
    artifactType;
    constructor(code, artifactType) {
        super(`Database-events artifact path rejected (${code})`);
        this.code = code;
        this.artifactType = artifactType;
        this.name = "EventsArtifactPathError";
    }
}
exports.EventsArtifactPathError = EventsArtifactPathError;
function reject(code, expectedType) {
    throw new EventsArtifactPathError(code, expectedType);
}
function isContained(root, candidate) {
    const remainder = (0, path_1.relative)(root, candidate);
    return remainder === "" || (!(0, path_1.isAbsolute)(remainder) && remainder !== ".." && !remainder.startsWith(`..${path_1.sep}`));
}
function directName(name) {
    return name.length > 0 && !name.includes("\0") && !/[\\/]/.test(name) && name !== "." && name !== "..";
}
async function resolveEventsArtifactPath(options) {
    const { expectedType } = options;
    if (expectedType !== "file" && expectedType !== "directory")
        reject("INVALID_VALUE", "file");
    if (typeof options.untrustedPath !== "string" || options.untrustedPath.length === 0 || options.untrustedPath.includes("\0"))
        reject("INVALID_VALUE", expectedType);
    const value = options.untrustedPath;
    if ((0, path_1.isAbsolute)(value) || path_1.posix.isAbsolute(value) || path_1.win32.isAbsolute(value) || /^[A-Za-z]:/.test(value) || /^[/\\]{2}/.test(value))
        reject("INVALID_PATH", expectedType);
    const components = value.split(/[\\/]/);
    if (components.some(component => component.length === 0 || component === "." || component === ".."))
        reject("INVALID_PATH", expectedType);
    const configuredNames = options.exactName === undefined ? options.allowedNames : [options.exactName];
    if (options.exactName !== undefined && options.allowedNames !== undefined)
        reject("INVALID_VALUE", expectedType);
    if (configuredNames !== undefined) {
        if (configuredNames.length === 0 || configuredNames.some(name => !directName(name)))
            reject("INVALID_VALUE", expectedType);
        if (components.length !== 1 || !configuredNames.includes(value))
            reject("NAME_NOT_ALLOWED", expectedType);
    }
    let rootRealPath;
    try {
        rootRealPath = await (0, promises_1.realpath)((0, path_1.resolve)(options.trustedRoot));
        if (!(await (0, promises_1.stat)(rootRealPath)).isDirectory())
            reject("INVALID_ROOT", expectedType);
    }
    catch (error) {
        if (error instanceof EventsArtifactPathError)
            throw error;
        reject("INVALID_ROOT", expectedType);
    }
    const candidate = (0, path_1.resolve)(rootRealPath, (0, path_1.join)(...components));
    if (!isContained(rootRealPath, candidate))
        reject("OUTSIDE_ROOT", expectedType);
    try {
        const candidateRealPath = await (0, promises_1.realpath)(candidate);
        if (!isContained(rootRealPath, candidateRealPath))
            reject("OUTSIDE_ROOT", expectedType);
        const metadata = await (0, promises_1.stat)(candidateRealPath);
        if (expectedType === "file" ? !metadata.isFile() : !metadata.isDirectory())
            reject("TYPE_MISMATCH", expectedType);
        return candidateRealPath;
    }
    catch (error) {
        if (error instanceof EventsArtifactPathError)
            throw error;
        if (error?.code !== "ENOENT" || !options.allowMissing)
            reject(error?.code === "ENOENT" ? "NOT_FOUND" : "INVALID_PATH", expectedType);
    }
    let parentRealPath;
    try {
        parentRealPath = await (0, promises_1.realpath)((0, path_1.resolve)(candidate, ".."));
        if (!(await (0, promises_1.stat)(parentRealPath)).isDirectory())
            reject("TYPE_MISMATCH", expectedType);
    }
    catch (error) {
        if (error instanceof EventsArtifactPathError)
            throw error;
        reject("NOT_FOUND", expectedType);
    }
    if (!isContained(rootRealPath, parentRealPath))
        reject("OUTSIDE_ROOT", expectedType);
    return candidate;
}
exports.resolveEventsArtifactPath = resolveEventsArtifactPath;
function resolveEventsInputFile(trustedRoot, untrustedPath, exactName) {
    if (typeof exactName !== "string" || !directName(exactName))
        reject("INVALID_VALUE", "file");
    return resolveEventsArtifactPath({ trustedRoot, untrustedPath, expectedType: "file", exactName });
}
exports.resolveEventsInputFile = resolveEventsInputFile;
async function resolveEventsOutputFiles(trustedRoot, names) {
    if (!Array.isArray(names) || names.length === 0 || names.some(name => typeof name !== "string" || !directName(name)))
        reject("INVALID_VALUE", "file");
    const entries = await Promise.all(names.map(async (name) => [name, await resolveEventsArtifactPath({ trustedRoot, untrustedPath: name, expectedType: "file", exactName: name, allowMissing: true })]));
    return new Map(entries);
}
exports.resolveEventsOutputFiles = resolveEventsOutputFiles;
//# sourceMappingURL=events-artifact-path.js.map