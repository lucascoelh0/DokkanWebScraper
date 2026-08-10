"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveCharacterInputDirectory = exports.resolveCharacterInputFile = exports.resolveDatabaseCharacterArtifactPath = exports.DatabaseCharacterArtifactPathError = void 0;
const artifact_path_1 = require("../artifact-path");
class DatabaseCharacterArtifactPathError extends artifact_path_1.ContainedArtifactPathError {
    code;
    artifactType;
    constructor(code, artifactType) {
        super(`Database-character artifact path rejected (${code})`, code, artifactType);
        this.code = code;
        this.artifactType = artifactType;
        this.name = "DatabaseCharacterArtifactPathError";
    }
}
exports.DatabaseCharacterArtifactPathError = DatabaseCharacterArtifactPathError;
function resolveDatabaseCharacterArtifactPath(options) {
    return (0, artifact_path_1.resolveContainedArtifactPath)(options, (code, artifactType) => new DatabaseCharacterArtifactPathError(code, artifactType));
}
exports.resolveDatabaseCharacterArtifactPath = resolveDatabaseCharacterArtifactPath;
function resolveCharacterInputFile(trustedRoot, untrustedPath, exactName) {
    if (typeof exactName !== "string" || !(0, artifact_path_1.isDirectArtifactName)(exactName))
        throw new DatabaseCharacterArtifactPathError("INVALID_VALUE", "file");
    return resolveDatabaseCharacterArtifactPath({ trustedRoot, untrustedPath, expectedType: "file", exactName });
}
exports.resolveCharacterInputFile = resolveCharacterInputFile;
function resolveCharacterInputDirectory(trustedRoot, untrustedPath, exactName) {
    if (typeof exactName !== "string" || !(0, artifact_path_1.isDirectArtifactName)(exactName))
        throw new DatabaseCharacterArtifactPathError("INVALID_VALUE", "directory");
    return resolveDatabaseCharacterArtifactPath({ trustedRoot, untrustedPath, expectedType: "directory", exactName });
}
exports.resolveCharacterInputDirectory = resolveCharacterInputDirectory;
//# sourceMappingURL=artifact-path.js.map