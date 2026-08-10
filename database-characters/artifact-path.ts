import { ArtifactPathErrorCode, ArtifactPathType, ContainedArtifactPathError, isDirectArtifactName, ResolveContainedArtifactPathOptions, resolveContainedArtifactPath } from "../artifact-path";

export type DatabaseCharacterArtifactType = ArtifactPathType;
export type DatabaseCharacterArtifactPathErrorCode = ArtifactPathErrorCode;

export class DatabaseCharacterArtifactPathError extends ContainedArtifactPathError {
    constructor(readonly code: DatabaseCharacterArtifactPathErrorCode, readonly artifactType: DatabaseCharacterArtifactType) {
        super(`Database-character artifact path rejected (${code})`, code, artifactType);
        this.name = "DatabaseCharacterArtifactPathError";
    }
}

export function resolveDatabaseCharacterArtifactPath(options: ResolveContainedArtifactPathOptions) {
    return resolveContainedArtifactPath(options, (code, artifactType) => new DatabaseCharacterArtifactPathError(code, artifactType));
}

export function resolveCharacterInputFile(trustedRoot: string, untrustedPath: unknown, exactName: string) {
    if (typeof exactName !== "string" || !isDirectArtifactName(exactName)) throw new DatabaseCharacterArtifactPathError("INVALID_VALUE", "file");
    return resolveDatabaseCharacterArtifactPath({ trustedRoot, untrustedPath, expectedType: "file", exactName });
}

export function resolveCharacterInputDirectory(trustedRoot: string, untrustedPath: unknown, exactName: string) {
    if (typeof exactName !== "string" || !isDirectArtifactName(exactName)) throw new DatabaseCharacterArtifactPathError("INVALID_VALUE", "directory");
    return resolveDatabaseCharacterArtifactPath({ trustedRoot, untrustedPath, expectedType: "directory", exactName });
}
