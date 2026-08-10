import { realpath, stat } from "fs/promises";
import { isAbsolute, join, posix, relative, resolve, sep, win32 } from "path";

export type ArtifactPathType = "file" | "directory";
export type ArtifactPathErrorCode = "INVALID_VALUE" | "INVALID_PATH" | "NAME_NOT_ALLOWED" | "OUTSIDE_ROOT" | "NOT_FOUND" | "TYPE_MISMATCH" | "INVALID_ROOT";

export class ContainedArtifactPathError extends Error {
    constructor(message: string, readonly code: ArtifactPathErrorCode, readonly artifactType: ArtifactPathType) {
        super(message);
        this.name = "ContainedArtifactPathError";
    }
}

export interface ResolveContainedArtifactPathOptions {
    trustedRoot: string;
    untrustedPath: unknown;
    expectedType: ArtifactPathType;
    exactName?: string;
    allowedNames?: readonly string[];
    allowMissing?: boolean;
}

export type ArtifactPathErrorFactory = (code: ArtifactPathErrorCode, artifactType: ArtifactPathType) => ContainedArtifactPathError;

export function isDirectArtifactName(name: string) {
    return name.length > 0 && !name.includes("\0") && !/[\\/]/.test(name) && name !== "." && name !== "..";
}

function isContained(root: string, candidate: string) {
    const remainder = relative(root, candidate);
    return remainder === "" || (!isAbsolute(remainder) && remainder !== ".." && !remainder.startsWith(`..${sep}`));
}

export async function resolveContainedArtifactPath(options: ResolveContainedArtifactPathOptions, createError: ArtifactPathErrorFactory): Promise<string> {
    const reject = (code: ArtifactPathErrorCode, artifactType: ArtifactPathType): never => { throw createError(code, artifactType); };
    const { expectedType } = options;
    if (expectedType !== "file" && expectedType !== "directory") reject("INVALID_VALUE", "file");
    const value = options.untrustedPath;
    if (typeof value !== "string" || value.length === 0 || value.includes("\0")) throw createError("INVALID_VALUE", expectedType);
    if (isAbsolute(value) || posix.isAbsolute(value) || win32.isAbsolute(value) || /^[A-Za-z]:/.test(value) || /^[/\\]{2}/.test(value)) reject("INVALID_PATH", expectedType);
    const components = value.split(/[\\/]/);
    if (components.some(component => component.length === 0 || component === "." || component === "..")) reject("INVALID_PATH", expectedType);

    const configuredNames = options.exactName === undefined ? options.allowedNames : [options.exactName];
    if (options.exactName !== undefined && options.allowedNames !== undefined) reject("INVALID_VALUE", expectedType);
    if (configuredNames !== undefined) {
        if (configuredNames.length === 0 || configuredNames.some(name => !isDirectArtifactName(name))) reject("INVALID_VALUE", expectedType);
        if (components.length !== 1 || !configuredNames.includes(value)) reject("NAME_NOT_ALLOWED", expectedType);
    }

    let rootRealPath: string;
    try {
        rootRealPath = await realpath(resolve(options.trustedRoot));
        if (!(await stat(rootRealPath)).isDirectory()) reject("INVALID_ROOT", expectedType);
    } catch (error) {
        if (error instanceof ContainedArtifactPathError) throw error;
        reject("INVALID_ROOT", expectedType);
    }

    const candidate = resolve(rootRealPath, join(...components));
    if (!isContained(rootRealPath, candidate)) reject("OUTSIDE_ROOT", expectedType);
    try {
        const candidateRealPath = await realpath(candidate);
        if (!isContained(rootRealPath, candidateRealPath)) reject("OUTSIDE_ROOT", expectedType);
        const metadata = await stat(candidateRealPath);
        if (expectedType === "file" ? !metadata.isFile() : !metadata.isDirectory()) reject("TYPE_MISMATCH", expectedType);
        return candidateRealPath;
    } catch (error: any) {
        if (error instanceof ContainedArtifactPathError) throw error;
        if (error?.code !== "ENOENT" || !options.allowMissing) reject(error?.code === "ENOENT" ? "NOT_FOUND" : "INVALID_PATH", expectedType);
    }

    let parentRealPath: string;
    try {
        parentRealPath = await realpath(resolve(candidate, ".."));
        if (!(await stat(parentRealPath)).isDirectory()) reject("TYPE_MISMATCH", expectedType);
    } catch (error) {
        if (error instanceof ContainedArtifactPathError) throw error;
        reject("NOT_FOUND", expectedType);
    }
    if (!isContained(rootRealPath, parentRealPath)) reject("OUTSIDE_ROOT", expectedType);
    return candidate;
}
