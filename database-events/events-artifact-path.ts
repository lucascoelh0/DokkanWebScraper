import { ArtifactPathErrorCode, ArtifactPathType, ContainedArtifactPathError, isDirectArtifactName, resolveContainedArtifactPath } from "../artifact-path";

export type EventsArtifactType = ArtifactPathType;
export type EventsArtifactPathErrorCode = ArtifactPathErrorCode;

export class EventsArtifactPathError extends ContainedArtifactPathError {
    constructor(readonly code: EventsArtifactPathErrorCode, readonly artifactType: EventsArtifactType) {
        super(`Database-events artifact path rejected (${code})`, code, artifactType);
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

export async function resolveEventsArtifactPath(options: ResolveEventsArtifactPathOptions): Promise<string> {
    return resolveContainedArtifactPath(options, (code, artifactType) => new EventsArtifactPathError(code, artifactType));
}

export function resolveEventsInputFile(trustedRoot: string, untrustedPath: unknown, exactName: string) {
    if (typeof exactName !== "string" || !isDirectArtifactName(exactName)) reject("INVALID_VALUE", "file");
    return resolveEventsArtifactPath({ trustedRoot, untrustedPath, expectedType: "file", exactName });
}

export async function resolveEventsOutputFiles(trustedRoot: string, names: readonly string[]) {
    if (!Array.isArray(names) || names.length === 0 || names.some(name => typeof name !== "string" || !isDirectArtifactName(name))) reject("INVALID_VALUE", "file");
    const entries = await Promise.all(names.map(async name => [name, await resolveEventsArtifactPath({ trustedRoot, untrustedPath: name, expectedType: "file", exactName: name, allowMissing: true })] as const));
    return new Map(entries);
}
