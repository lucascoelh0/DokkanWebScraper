import { realpath, stat } from "fs/promises";
import { isAbsolute, join, posix, relative, resolve, sep, win32 } from "path";

export type EventsArtifactType = "file" | "directory";
export type EventsArtifactPathErrorCode = "INVALID_VALUE" | "INVALID_PATH" | "NAME_NOT_ALLOWED" | "OUTSIDE_ROOT" | "NOT_FOUND" | "TYPE_MISMATCH" | "INVALID_ROOT";

export class EventsArtifactPathError extends Error {
    constructor(readonly code: EventsArtifactPathErrorCode, readonly artifactType: EventsArtifactType) {
        super(`Database-events artifact path rejected (${code})`);
        this.name = "EventsArtifactPathError";
    }
}

export interface ResolveEventsArtifactPathOptions {
    trustedRoot: string;
    untrustedPath: unknown;
    expectedType: EventsArtifactType;
    exactName?: string;
    allowedNames?: readonly string[];
    allowMissing?: boolean;
}

function reject(code: EventsArtifactPathErrorCode, expectedType: EventsArtifactType): never {
    throw new EventsArtifactPathError(code, expectedType);
}

function isContained(root: string, candidate: string) {
    const remainder = relative(root, candidate);
    return remainder === "" || (!isAbsolute(remainder) && remainder !== ".." && !remainder.startsWith(`..${sep}`));
}

function directName(name: string) {
    return name.length > 0 && !name.includes("\0") && !/[\\/]/.test(name) && name !== "." && name !== "..";
}

export async function resolveEventsArtifactPath(options: ResolveEventsArtifactPathOptions): Promise<string> {
    const { expectedType } = options;
    if (expectedType !== "file" && expectedType !== "directory") reject("INVALID_VALUE", "file");
    if (typeof options.untrustedPath !== "string" || options.untrustedPath.length === 0 || options.untrustedPath.includes("\0")) reject("INVALID_VALUE", expectedType);
    const value = options.untrustedPath;
    if (isAbsolute(value) || posix.isAbsolute(value) || win32.isAbsolute(value) || /^[A-Za-z]:/.test(value) || /^[/\\]{2}/.test(value)) reject("INVALID_PATH", expectedType);
    const components = value.split(/[\\/]/);
    if (components.some(component => component.length === 0 || component === "." || component === "..")) reject("INVALID_PATH", expectedType);

    const configuredNames = options.exactName === undefined ? options.allowedNames : [options.exactName];
    if (options.exactName !== undefined && options.allowedNames !== undefined) reject("INVALID_VALUE", expectedType);
    if (configuredNames !== undefined) {
        if (configuredNames.length === 0 || configuredNames.some(name => !directName(name))) reject("INVALID_VALUE", expectedType);
        if (components.length !== 1 || !configuredNames.includes(value)) reject("NAME_NOT_ALLOWED", expectedType);
    }

    let rootRealPath: string;
    try {
        rootRealPath = await realpath(resolve(options.trustedRoot));
        if (!(await stat(rootRealPath)).isDirectory()) reject("INVALID_ROOT", expectedType);
    } catch (error) {
        if (error instanceof EventsArtifactPathError) throw error;
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
        if (error instanceof EventsArtifactPathError) throw error;
        if (error?.code !== "ENOENT" || !options.allowMissing) reject(error?.code === "ENOENT" ? "NOT_FOUND" : "INVALID_PATH", expectedType);
    }

    let parentRealPath: string;
    try {
        parentRealPath = await realpath(resolve(candidate, ".."));
        if (!(await stat(parentRealPath)).isDirectory()) reject("TYPE_MISMATCH", expectedType);
    } catch (error) {
        if (error instanceof EventsArtifactPathError) throw error;
        reject("NOT_FOUND", expectedType);
    }
    if (!isContained(rootRealPath, parentRealPath)) reject("OUTSIDE_ROOT", expectedType);
    return candidate;
}

export function resolveEventsInputFile(trustedRoot: string, untrustedPath: unknown, exactName: string) {
    if (typeof exactName !== "string" || !directName(exactName)) reject("INVALID_VALUE", "file");
    return resolveEventsArtifactPath({ trustedRoot, untrustedPath, expectedType: "file", exactName });
}

export async function resolveEventsOutputFiles(trustedRoot: string, names: readonly string[]) {
    if (!Array.isArray(names) || names.length === 0 || names.some(name => typeof name !== "string" || !directName(name))) reject("INVALID_VALUE", "file");
    const entries = await Promise.all(names.map(async name => [name, await resolveEventsArtifactPath({ trustedRoot, untrustedPath: name, expectedType: "file", exactName: name, allowMissing: true })] as const));
    return new Map(entries);
}
