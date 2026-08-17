import { createHash } from "crypto";
import { lstatSync, readFileSync, realpathSync, statSync } from "fs";
import { isAbsolute, relative, resolve, sep } from "path";

export interface WtExternalSourceRead {
    operationalPath: string;
    text: string;
    identity: { sourceId: "world-tournament-until-start-crash-2026-08-16"; sizeBytes: number; sha256: string };
}

const SOURCE_ID = "world-tournament-until-start-crash-2026-08-16" as const;
const normalized = (value: string): string => process.platform === "win32" ? value.toLowerCase() : value;
const samePath = (left: string, right: string): boolean => normalized(resolve(left)) === normalized(resolve(right));

export function isRealpathContained(root: string, candidate: string): boolean {
    const inside = relative(root, candidate);
    return inside !== "" && inside !== ".." && !inside.startsWith(`..${sep}`) && !isAbsolute(inside);
}

function rejectReparse(path: string): void {
    const info = lstatSync(path);
    if (info.isSymbolicLink() || !samePath(realpathSync.native(path), path)) throw new Error("WT source reparse boundary");
}

function validateRelativePath(value: string): string[] {
    if (!value || value.includes("\0") || /^[A-Za-z]:/.test(value) || /^[/\\]{2}/.test(value) || /^[\\/]/.test(value) || isAbsolute(value)) throw new Error("WT source relative-path boundary");
    if (value.includes("/") && value.includes("\\")) throw new Error("WT source mixed-separator boundary");
    const components = value.split(value.includes("\\") ? "\\" : "/");
    if (components.length === 0 || components.some(component => !component || component === "." || component === ".." || component.includes(":"))) throw new Error("WT source traversal boundary");
    return components;
}

function validateTree(repositoryRootArgument: string, sourceRootArgument: string, sourceRelativePath: string): { sourceRoot: string; sourcePath: string } {
    if (!isAbsolute(sourceRootArgument)) throw new Error("WT source-root must be absolute");
    const repositoryRoot = realpathSync.native(repositoryRootArgument), lexicalRoot = resolve(sourceRootArgument);
    rejectReparse(lexicalRoot);
    const rootInfo = statSync(lexicalRoot); if (!rootInfo.isDirectory()) throw new Error("WT source-root must be a directory");
    const sourceRoot = realpathSync.native(lexicalRoot);
    const rootInsideRepository = relative(repositoryRoot, sourceRoot); if (rootInsideRepository === "" || (!rootInsideRepository.startsWith(`..${sep}`) && rootInsideRepository !== ".." && !isAbsolute(rootInsideRepository))) throw new Error("WT source-root must be external");
    const components = validateRelativePath(sourceRelativePath); let current = sourceRoot;
    for (const component of components) { current = resolve(current, component); rejectReparse(current); }
    const sourcePath = realpathSync.native(current); if (!isRealpathContained(sourceRoot, sourcePath)) throw new Error("WT source containment boundary");
    const fileInfo = statSync(sourcePath); if (!fileInfo.isFile()) throw new Error("WT source must be a regular file");
    return { sourceRoot, sourcePath };
}

function sameIdentity(left: ReturnType<typeof statSync>, right: ReturnType<typeof statSync>): boolean {
    return left.dev === right.dev && left.ino === right.ino && left.size === right.size && left.mtimeMs === right.mtimeMs && left.ctimeMs === right.ctimeMs;
}

function readBoundedSource(repositoryRootArgument: string, sourceRootArgument: string, sourceRelativePath: string): WtExternalSourceRead {
    const repositoryRoot = realpathSync.native(repositoryRootArgument), first = validateTree(repositoryRoot, sourceRootArgument, sourceRelativePath), before = statSync(first.sourcePath);
    if (before.size <= 0 || before.size > 64 * 1024 * 1024) throw new Error("WT source size boundary");
    let bytes: Buffer; try { bytes = readFileSync(first.sourcePath); } catch { throw new Error("WT source read failed"); }
    const second = validateTree(repositoryRoot, sourceRootArgument, sourceRelativePath), after = statSync(second.sourcePath);
    if (!samePath(first.sourceRoot, second.sourceRoot) || !samePath(first.sourcePath, second.sourcePath) || !sameIdentity(before, after) || bytes.length !== after.size) throw new Error("WT source identity changed during read");
    return { operationalPath: second.sourcePath, text: bytes.toString("utf8"), identity: { sourceId: SOURCE_ID, sizeBytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") } };
}

export function readWtExternalSource(repositoryRootArgument: string, sourceRootArgument: string, sourceRelativePath: string): WtExternalSourceRead {
    try { return readBoundedSource(repositoryRootArgument, sourceRootArgument, sourceRelativePath); }
    catch (error) { if (error instanceof Error && error.message.startsWith("WT source")) throw error; throw new Error("WT source boundary validation failed"); }
}
