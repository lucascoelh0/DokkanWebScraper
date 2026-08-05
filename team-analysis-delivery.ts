import { Character } from "./character";
import { DatasetManifest } from "./dataset-artifacts";
import {
    assertValidTeamAnalysisDatasetForDelivery,
    TEAM_ANALYSIS_PARSER_VERSION,
    TEAM_ANALYSIS_RULES_VERSION,
    TEAM_ANALYSIS_SCHEMA_VERSION,
    TeamAnalysisDataset,
} from "./team-analysis";
import { sha256, TeamAnalysisManifest } from "./team-analysis-artifacts";
import { gunzipSync } from "zlib";

export const TEAM_ANALYSIS_LOCAL_FILE_NAME = "team-analysis.json.gz";

export interface TeamAnalysisDeliveryBuffers {
    datasetBuffer: Buffer,
    manifestBuffer: Buffer,
    characterDatasetBuffer: Buffer,
    characterManifestBuffer: Buffer,
}

export interface ValidatedTeamAnalysisDelivery {
    dataset: TeamAnalysisDataset,
    manifest: TeamAnalysisManifest,
    characters: Character[],
    characterManifest: DatasetManifest,
}

export function validateTeamAnalysisDeliveryBuffers(
    buffers: TeamAnalysisDeliveryBuffers,
): ValidatedTeamAnalysisDelivery {
    const manifest = parseJsonObject<TeamAnalysisManifest>(buffers.manifestBuffer, "Team Analysis manifest");
    const characterManifest = parseJsonObject<DatasetManifest>(
        buffers.characterManifestBuffer,
        "character manifest",
    );
    validateCharacterManifest(characterManifest, buffers.characterDatasetBuffer);
    const charactersText = gunzipUtf8(buffers.characterDatasetBuffer, "character payload");
    const characters = parseJsonArray<Character>(charactersText, "character payload");
    if (characters.length !== characterManifest.characterCount) {
        throw new Error(
            `Character payload count ${characters.length} does not match manifest characterCount ${characterManifest.characterCount}.`,
        );
    }

    validateTeamAnalysisManifest(manifest);
    const datasetText = gunzipUtf8(buffers.datasetBuffer, "Team Analysis payload");
    const dataset = parseJsonObject<TeamAnalysisDataset>(datasetText, "Team Analysis payload");
    validateTeamAnalysisArtifact(manifest, dataset, buffers.datasetBuffer, Buffer.from(datasetText, "utf8"));
    validateUniqueDeliveryIdentifiers(dataset);
    assertValidTeamAnalysisDatasetForDelivery(dataset, characters);

    if (dataset.sourceCharacterDatasetVersion !== characterManifest.datasetVersion) {
        throw new Error(
            `Team Analysis source character version ${dataset.sourceCharacterDatasetVersion} does not match local character version ${characterManifest.datasetVersion}.`,
        );
    }
    if (dataset.sourceCharacterPayloadSha256 !== characterManifest.sha256) {
        throw new Error(
            `Team Analysis source character SHA-256 ${dataset.sourceCharacterPayloadSha256} does not match local character SHA-256 ${characterManifest.sha256}.`,
        );
    }

    return { dataset, manifest, characters, characterManifest };
}

function validateCharacterManifest(manifest: DatasetManifest, gzipBuffer: Buffer): void {
    if (manifest.schemaVersion !== 1 || manifest.compression !== "gzip") {
        throw new Error("Unsupported character manifest schema or compression.");
    }
    assertSafeLocalFileName(manifest.fileName, "character manifest fileName");
    if (manifest.fileName !== "characters.json.gz") {
        throw new Error(`Unexpected character manifest fileName: ${manifest.fileName}`);
    }
    if (typeof manifest.datasetVersion !== "string" || manifest.datasetVersion.trim().length === 0) {
        throw new Error("Character manifest datasetVersion must be a non-empty string.");
    }
    if (typeof manifest.generatedAt !== "string" || !Number.isFinite(Date.parse(manifest.generatedAt))) {
        throw new Error("Character manifest generatedAt must be a valid timestamp.");
    }
    assertSha256(manifest.sha256, "character manifest sha256");
    assertNonNegativeSafeInteger(manifest.sizeBytes, "character manifest sizeBytes");
    assertNonNegativeSafeInteger(manifest.uncompressedSizeBytes, "character manifest uncompressedSizeBytes");
    assertNonNegativeSafeInteger(manifest.characterCount, "character manifest characterCount");
    if (manifest.sizeBytes !== gzipBuffer.byteLength) {
        throw new Error(
            `Character payload size ${gzipBuffer.byteLength} does not match manifest sizeBytes ${manifest.sizeBytes}.`,
        );
    }
    if (sha256(gzipBuffer) !== manifest.sha256.toLowerCase()) {
        throw new Error("Character payload SHA-256 does not match its manifest.");
    }
    const uncompressed = Buffer.from(gunzipUtf8(gzipBuffer, "character payload"), "utf8");
    if (manifest.uncompressedSizeBytes !== uncompressed.byteLength) {
        throw new Error(
            `Character payload uncompressed size ${uncompressed.byteLength} does not match manifest uncompressedSizeBytes ${manifest.uncompressedSizeBytes}.`,
        );
    }
}

function validateTeamAnalysisManifest(manifest: TeamAnalysisManifest): void {
    if (manifest.schemaVersion !== TEAM_ANALYSIS_SCHEMA_VERSION || manifest.compression !== "gzip") {
        throw new Error("Unsupported Team Analysis manifest schema or compression.");
    }
    if (manifest.rulesVersion !== TEAM_ANALYSIS_RULES_VERSION) {
        throw new Error(`Unsupported Team Analysis rulesVersion: ${manifest.rulesVersion}`);
    }
    if (manifest.parserVersion !== TEAM_ANALYSIS_PARSER_VERSION) {
        throw new Error(`Unsupported Team Analysis parserVersion: ${manifest.parserVersion}`);
    }
    assertSafeLocalFileName(manifest.fileName, "Team Analysis manifest fileName");
    if (manifest.fileName !== TEAM_ANALYSIS_LOCAL_FILE_NAME) {
        throw new Error(`Unexpected Team Analysis manifest fileName: ${manifest.fileName}`);
    }
    if (typeof manifest.datasetVersion !== "string" || manifest.datasetVersion.trim().length === 0) {
        throw new Error("Team Analysis manifest datasetVersion must be a non-empty string.");
    }
    if (typeof manifest.generatedAt !== "string" || !Number.isFinite(Date.parse(manifest.generatedAt))) {
        throw new Error("Team Analysis manifest generatedAt must be a valid timestamp.");
    }
    assertSha256(manifest.sha256, "Team Analysis manifest sha256");
    assertSha256(manifest.sourceCharacterPayloadSha256, "Team Analysis source character SHA-256");
    assertNonNegativeSafeInteger(manifest.sizeBytes, "Team Analysis manifest sizeBytes");
    assertNonNegativeSafeInteger(manifest.uncompressedSizeBytes, "Team Analysis manifest uncompressedSizeBytes");
    assertNonNegativeSafeInteger(manifest.stateCount, "Team Analysis manifest stateCount");
}

function validateTeamAnalysisArtifact(
    manifest: TeamAnalysisManifest,
    dataset: TeamAnalysisDataset,
    gzipBuffer: Buffer,
    jsonBuffer: Buffer,
): void {
    if (!Array.isArray(dataset.states)) {
        throw new Error("Team Analysis payload states must be an array.");
    }
    if (dataset.schemaVersion !== TEAM_ANALYSIS_SCHEMA_VERSION) {
        throw new Error(`Unsupported Team Analysis schemaVersion: ${dataset.schemaVersion}`);
    }
    if (dataset.rulesVersion !== TEAM_ANALYSIS_RULES_VERSION) {
        throw new Error(`Unsupported Team Analysis rulesVersion: ${dataset.rulesVersion}`);
    }
    if (dataset.parserVersion !== TEAM_ANALYSIS_PARSER_VERSION) {
        throw new Error(`Unsupported Team Analysis parserVersion: ${dataset.parserVersion}`);
    }
    assertNonNegativeSafeInteger(dataset.stateCount, "Team Analysis stateCount");
    if (dataset.stateCount !== dataset.states.length || manifest.stateCount !== dataset.states.length) {
        throw new Error(
            `Team Analysis stateCount mismatch: manifest=${manifest.stateCount}, payload=${dataset.stateCount}, states=${dataset.states.length}.`,
        );
    }
    if (manifest.sha256.toLowerCase() !== sha256(gzipBuffer)) {
        throw new Error("Team Analysis payload SHA-256 does not match its manifest.");
    }
    if (manifest.sizeBytes !== gzipBuffer.byteLength) {
        throw new Error(
            `Team Analysis payload size ${gzipBuffer.byteLength} does not match manifest sizeBytes ${manifest.sizeBytes}.`,
        );
    }
    if (manifest.uncompressedSizeBytes !== jsonBuffer.byteLength) {
        throw new Error(
            `Team Analysis payload uncompressed size ${jsonBuffer.byteLength} does not match manifest uncompressedSizeBytes ${manifest.uncompressedSizeBytes}.`,
        );
    }
    const matchingFields: Array<[string, unknown, unknown]> = [
        ["schemaVersion", manifest.schemaVersion, dataset.schemaVersion],
        ["generatedAt", manifest.generatedAt, dataset.generatedAt],
        ["stateCount", manifest.stateCount, dataset.stateCount],
        ["rulesVersion", manifest.rulesVersion, dataset.rulesVersion],
        ["parserVersion", manifest.parserVersion, dataset.parserVersion],
        ["sourceCharacterDatasetVersion", manifest.sourceCharacterDatasetVersion, dataset.sourceCharacterDatasetVersion],
        ["sourceCharacterPayloadSha256", manifest.sourceCharacterPayloadSha256, dataset.sourceCharacterPayloadSha256],
    ];
    for (const [field, manifestValue, datasetValue] of matchingFields) {
        if (manifestValue !== datasetValue) {
            throw new Error(
                `Team Analysis manifest ${field} ${String(manifestValue)} does not match payload value ${String(datasetValue)}.`,
            );
        }
    }
}

function validateUniqueDeliveryIdentifiers(dataset: TeamAnalysisDataset): void {
    const stateKeys = new Set<string>();
    for (const state of dataset.states) {
        if (!state || typeof state !== "object" || typeof state.stateKey !== "string" || state.stateKey.length === 0) {
            throw new Error("Every Team Analysis state must have a non-empty stateKey.");
        }
        if (stateKeys.has(state.stateKey)) {
            throw new Error(`Duplicate Team Analysis stateKey: ${state.stateKey}`);
        }
        stateKeys.add(state.stateKey);
    }

    const identifiers = new Set<string>();
    visitIdentifiers(dataset.states, identifiers);
}

function visitIdentifiers(value: unknown, identifiers: Set<string>): void {
    if (Array.isArray(value)) {
        value.forEach(entry => visitIdentifiers(entry, identifiers));
        return;
    }
    if (!value || typeof value !== "object") {
        return;
    }
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
        if (key === "id") {
            if (typeof nested !== "string" || nested.length === 0) {
                throw new Error("Every Team Analysis id must be a non-empty string.");
            }
            if (identifiers.has(nested)) {
                throw new Error(`Duplicate Team Analysis id: ${nested}`);
            }
            identifiers.add(nested);
        }
        visitIdentifiers(nested, identifiers);
    }
}

function parseJsonObject<T>(value: Buffer | string, label: string): T {
    let parsed: unknown;
    try {
        parsed = JSON.parse(Buffer.isBuffer(value) ? value.toString("utf8") : value);
    } catch (error) {
        throw new Error(`${label} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error(`${label} must be a JSON object.`);
    }
    return parsed as unknown as T;
}

function parseJsonArray<T>(value: string, label: string): T[] {
    let parsed: unknown;
    try {
        parsed = JSON.parse(value);
    } catch (error) {
        throw new Error(`${label} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (!Array.isArray(parsed)) {
        throw new Error(`${label} must be a JSON array.`);
    }
    return parsed as T[];
}

function gunzipUtf8(value: Buffer, label: string): string {
    try {
        return gunzipSync(value).toString("utf8");
    } catch (error) {
        throw new Error(`${label} is not valid gzip: ${error instanceof Error ? error.message : String(error)}`);
    }
}

function assertSafeLocalFileName(value: unknown, label: string): asserts value is string {
    if (typeof value !== "string" || value.length === 0) {
        throw new Error(`${label} must be a non-empty string.`);
    }
    if (
        value.startsWith("/")
        || value.startsWith("\\")
        || /^[A-Za-z]:[\\/]/.test(value)
        || value.includes("/")
        || value.includes("\\")
        || value === "."
        || value === ".."
    ) {
        throw new Error(`${label} must not be absolute or contain path traversal: ${value}`);
    }
}

function assertSha256(value: unknown, label: string): asserts value is string {
    if (typeof value !== "string" || !/^[a-f0-9]{64}$/i.test(value)) {
        throw new Error(`${label} must be a 64-character hexadecimal SHA-256.`);
    }
}

function assertNonNegativeSafeInteger(value: unknown, label: string): asserts value is number {
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
        throw new Error(`${label} must be a non-negative safe integer.`);
    }
}
