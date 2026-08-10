"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveEventsOutputFiles = exports.resolveEventsInputFile = exports.resolveEventsArtifactPath = exports.EventsArtifactPathError = void 0;
const artifact_path_1 = require("../artifact-path");
class EventsArtifactPathError extends artifact_path_1.ContainedArtifactPathError {
    code;
    artifactType;
    constructor(code, artifactType) {
        super(`Database-events artifact path rejected (${code})`, code, artifactType);
        this.code = code;
        this.artifactType = artifactType;
        this.name = "EventsArtifactPathError";
    }
}
exports.EventsArtifactPathError = EventsArtifactPathError;
function reject(code, expectedType) {
    throw new EventsArtifactPathError(code, expectedType);
}
async function resolveEventsArtifactPath(options) {
    return (0, artifact_path_1.resolveContainedArtifactPath)(options, (code, artifactType) => new EventsArtifactPathError(code, artifactType));
}
exports.resolveEventsArtifactPath = resolveEventsArtifactPath;
function resolveEventsInputFile(trustedRoot, untrustedPath, exactName) {
    if (typeof exactName !== "string" || !(0, artifact_path_1.isDirectArtifactName)(exactName))
        reject("INVALID_VALUE", "file");
    return resolveEventsArtifactPath({ trustedRoot, untrustedPath, expectedType: "file", exactName });
}
exports.resolveEventsInputFile = resolveEventsInputFile;
async function resolveEventsOutputFiles(trustedRoot, names) {
    if (!Array.isArray(names) || names.length === 0 || names.some(name => typeof name !== "string" || !(0, artifact_path_1.isDirectArtifactName)(name)))
        reject("INVALID_VALUE", "file");
    const entries = await Promise.all(names.map(async (name) => [name, await resolveEventsArtifactPath({ trustedRoot, untrustedPath: name, expectedType: "file", exactName: name, allowMissing: true })]));
    return new Map(entries);
}
exports.resolveEventsOutputFiles = resolveEventsOutputFiles;
//# sourceMappingURL=events-artifact-path.js.map