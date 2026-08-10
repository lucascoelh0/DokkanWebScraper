"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveContainedArtifactPath = exports.isDirectArtifactName = exports.ContainedArtifactPathError = void 0;
const promises_1 = require("fs/promises");
const path_1 = require("path");
class ContainedArtifactPathError extends Error {
    code;
    artifactType;
    constructor(message, code, artifactType) {
        super(message);
        this.code = code;
        this.artifactType = artifactType;
        this.name = "ContainedArtifactPathError";
    }
}
exports.ContainedArtifactPathError = ContainedArtifactPathError;
function isDirectArtifactName(name) {
    return name.length > 0 && !name.includes("\0") && !/[\\/]/.test(name) && name !== "." && name !== "..";
}
exports.isDirectArtifactName = isDirectArtifactName;
function isContained(root, candidate) {
    const remainder = (0, path_1.relative)(root, candidate);
    return remainder === "" || (!(0, path_1.isAbsolute)(remainder) && remainder !== ".." && !remainder.startsWith(`..${path_1.sep}`));
}
async function resolveContainedArtifactPath(options, createError) {
    const reject = (code, artifactType) => { throw createError(code, artifactType); };
    const { expectedType } = options;
    if (expectedType !== "file" && expectedType !== "directory")
        reject("INVALID_VALUE", "file");
    const value = options.untrustedPath;
    if (typeof value !== "string" || value.length === 0 || value.includes("\0"))
        throw createError("INVALID_VALUE", expectedType);
    if ((0, path_1.isAbsolute)(value) || path_1.posix.isAbsolute(value) || path_1.win32.isAbsolute(value) || /^[A-Za-z]:/.test(value) || /^[/\\]{2}/.test(value))
        reject("INVALID_PATH", expectedType);
    const components = value.split(/[\\/]/);
    if (components.some(component => component.length === 0 || component === "." || component === ".."))
        reject("INVALID_PATH", expectedType);
    const configuredNames = options.exactName === undefined ? options.allowedNames : [options.exactName];
    if (options.exactName !== undefined && options.allowedNames !== undefined)
        reject("INVALID_VALUE", expectedType);
    if (configuredNames !== undefined) {
        if (configuredNames.length === 0 || configuredNames.some(name => !isDirectArtifactName(name)))
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
        if (error instanceof ContainedArtifactPathError)
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
        if (error instanceof ContainedArtifactPathError)
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
        if (error instanceof ContainedArtifactPathError)
            throw error;
        reject("NOT_FOUND", expectedType);
    }
    if (!isContained(rootRealPath, parentRealPath))
        reject("OUTSIDE_ROOT", expectedType);
    return candidate;
}
exports.resolveContainedArtifactPath = resolveContainedArtifactPath;
//# sourceMappingURL=artifact-path.js.map