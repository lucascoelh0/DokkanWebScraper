import { createHash } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import { dirname, resolve } from "path";
import { gzipSync } from "zlib";
import { Character } from "./character";

export interface DatasetManifest {
    schemaVersion: number,
    datasetVersion: string,
    generatedAt: string,
    fileName: string,
    compression: "gzip",
    sha256: string,
    sizeBytes: number,
    uncompressedSizeBytes: number,
    characterCount: number,
}

export interface CharacterDatasetArtifact {
    jsonText: string,
    gzipBuffer: Buffer,
    manifest: DatasetManifest,
}

export function buildCharacterDatasetArtifact(
    characters: Character[],
    options: {
        datasetVersion: string,
        generatedAt: string,
        fileName?: string,
    },
): CharacterDatasetArtifact {
    const jsonText = `${JSON.stringify(characters, null, 2)}\n`;
    const utf8Buffer = Buffer.from(jsonText, "utf8");
    const gzipBuffer = gzipSync(utf8Buffer, { level: 9 });

    return {
        jsonText,
        gzipBuffer,
        manifest: {
            schemaVersion: 1,
            datasetVersion: options.datasetVersion,
            generatedAt: options.generatedAt,
            fileName: options.fileName ?? "characters.json.gz",
            compression: "gzip",
            sha256: createHash("sha256").update(gzipBuffer).digest("hex"),
            sizeBytes: gzipBuffer.byteLength,
            uncompressedSizeBytes: utf8Buffer.byteLength,
            characterCount: characters.length,
        },
    };
}

export async function writeCharacterDatasetBundle(
    outputDir: string,
    artifact: CharacterDatasetArtifact,
    options?: {
        manifestFileName?: string,
    },
): Promise<void> {
    const resolvedOutputDir = resolve(outputDir);
    const manifestFileName = options?.manifestFileName ?? "characters-manifest.json";
    const datasetPath = resolve(resolvedOutputDir, artifact.manifest.fileName);
    const manifestPath = resolve(resolvedOutputDir, manifestFileName);

    await mkdir(dirname(datasetPath), { recursive: true });
    await mkdir(dirname(manifestPath), { recursive: true });

    await writeFile(datasetPath, artifact.gzipBuffer);
    await writeFile(manifestPath, `${JSON.stringify(artifact.manifest, null, 2)}\n`, { encoding: "utf8" });
}
