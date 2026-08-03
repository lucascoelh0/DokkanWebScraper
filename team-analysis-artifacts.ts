import { createHash } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import { dirname, resolve } from "path";
import { gzipSync } from "zlib";
import { TeamAnalysisCoverageReport, TeamAnalysisDataset } from "./team-analysis";

export interface TeamAnalysisManifest {
    schemaVersion: number,
    datasetVersion: string,
    generatedAt: string,
    fileName: string,
    compression: "gzip",
    sha256: string,
    sizeBytes: number,
    uncompressedSizeBytes: number,
    stateCount: number,
    rulesVersion: string,
    parserVersion: string,
    sourceCharacterDatasetVersion: string,
    sourceCharacterPayloadSha256: string,
}

export interface TeamAnalysisArtifact {
    jsonText: string,
    gzipBuffer: Buffer,
    manifest: TeamAnalysisManifest,
}

export function buildTeamAnalysisArtifact(
    dataset: TeamAnalysisDataset,
    options?: {
        fileName?: string,
        datasetVersion?: string,
    },
): TeamAnalysisArtifact {
    const jsonText = `${JSON.stringify(dataset, null, 2)}\n`;
    const utf8Buffer = Buffer.from(jsonText, "utf8");
    const gzipBuffer = gzipSync(utf8Buffer, { level: 9 });
    const datasetVersion = options?.datasetVersion
        ?? `${dataset.sourceCharacterDatasetVersion}:parser-${dataset.parserVersion}`;

    return {
        jsonText,
        gzipBuffer,
        manifest: {
            schemaVersion: dataset.schemaVersion,
            datasetVersion,
            generatedAt: dataset.generatedAt,
            fileName: options?.fileName ?? "team-analysis.json.gz",
            compression: "gzip",
            sha256: sha256(gzipBuffer),
            sizeBytes: gzipBuffer.byteLength,
            uncompressedSizeBytes: utf8Buffer.byteLength,
            stateCount: dataset.stateCount,
            rulesVersion: dataset.rulesVersion,
            parserVersion: dataset.parserVersion,
            sourceCharacterDatasetVersion: dataset.sourceCharacterDatasetVersion,
            sourceCharacterPayloadSha256: dataset.sourceCharacterPayloadSha256,
        },
    };
}

export function validateTeamAnalysisArtifact(
    artifact: TeamAnalysisArtifact,
    dataset: TeamAnalysisDataset,
): string[] {
    const issues: string[] = [];
    const uncompressedSize = Buffer.byteLength(artifact.jsonText, "utf8");
    if (artifact.manifest.sha256 !== sha256(artifact.gzipBuffer)) {
        issues.push("Manifest SHA-256 does not match the gzip payload.");
    }
    if (artifact.manifest.sizeBytes !== artifact.gzipBuffer.byteLength) {
        issues.push("Manifest compressed size does not match the gzip payload.");
    }
    if (artifact.manifest.uncompressedSizeBytes !== uncompressedSize) {
        issues.push("Manifest uncompressed size does not match the JSON payload.");
    }
    if (artifact.manifest.stateCount !== dataset.states.length) {
        issues.push("Manifest state count does not match the dataset.");
    }
    if (artifact.manifest.sourceCharacterDatasetVersion !== dataset.sourceCharacterDatasetVersion) {
        issues.push("Manifest character dataset version does not match the dataset.");
    }
    if (artifact.manifest.sourceCharacterPayloadSha256 !== dataset.sourceCharacterPayloadSha256) {
        issues.push("Manifest character payload SHA-256 does not match the dataset.");
    }
    return issues;
}

export async function writeTeamAnalysisBundle(
    outputDir: string,
    artifact: TeamAnalysisArtifact,
    coverage: TeamAnalysisCoverageReport,
    options?: {
        manifestFileName?: string,
        coverageFileName?: string,
    },
): Promise<void> {
    const resolvedOutputDir = resolve(outputDir);
    const datasetPath = resolve(resolvedOutputDir, artifact.manifest.fileName);
    const manifestPath = resolve(resolvedOutputDir, options?.manifestFileName ?? "team-analysis-manifest.json");
    const coveragePath = resolve(resolvedOutputDir, options?.coverageFileName ?? "team-analysis-coverage.json");
    await mkdir(dirname(datasetPath), { recursive: true });
    await writeFile(datasetPath, artifact.gzipBuffer);
    await writeFile(manifestPath, `${JSON.stringify(artifact.manifest, null, 2)}\n`, "utf8");
    await writeFile(coveragePath, `${JSON.stringify(coverage, null, 2)}\n`, "utf8");
}

export function sha256(value: Buffer): string {
    return createHash("sha256").update(value).digest("hex");
}
