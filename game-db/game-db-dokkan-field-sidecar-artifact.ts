import { createHash } from "crypto";
import { existsSync } from "fs";
import { mkdir, writeFile } from "fs/promises";
import { dirname, resolve } from "path";
import { gunzipSync, gzipSync } from "zlib";
import {
    buildGameDbDokkanFieldSidecar,
    GameDbDokkanFieldSidecarV1,
    loadGameDbDokkanFieldSidecarTablesIfPresent,
} from "./game-db-dokkan-field-sidecar";
import { GameDbSourceConfig } from "./game-db-source";
import { DOKKAN_FIELD_SIDECAR_TABLES } from "./game-db-table-inventory";

export const DOKKAN_FIELD_SIDECAR_PAYLOAD_FILE = "dokkan-field-sidecar.json.gz";
export const DOKKAN_FIELD_SIDECAR_MANIFEST_FILE = "dokkan-field-sidecar-manifest.json";
const MAX_UNCOMPRESSED_BYTES = 64 * 1024 * 1024;
const MAX_COMPRESSED_BYTES = 16 * 1024 * 1024;

export interface GameDbDokkanFieldSidecarManifestV1 {
    schemaVersion: "game-db-dokkan-field-sidecar-manifest-v1",
    authority: "structural-association-only",
    createdDomainSemantics: "not-established",
    sourceSnapshotId: string,
    payload: {
        fileName: typeof DOKKAN_FIELD_SIDECAR_PAYLOAD_FILE,
        compression: "gzip",
        sha256: string,
        sizeBytes: number,
        uncompressedSha256: string,
        uncompressedSizeBytes: number,
    },
    tableRowCounts: Record<typeof DOKKAN_FIELD_SIDECAR_TABLES[number], number>,
    indexCounts: {
        activeSkillSetEntries: number,
        activeSkillSetFieldReferences: number,
        passiveSkillEntries: number,
        passiveSkillFieldReferences: number,
    },
    includedTableIntegrity: GameDbDokkanFieldSidecarV1["includedTableIntegrity"],
    eligibleForStructuralConsumption: boolean,
}

export interface GameDbDokkanFieldSidecarArtifactV1 {
    sidecar: GameDbDokkanFieldSidecarV1,
    payload: Buffer,
    manifest: GameDbDokkanFieldSidecarManifestV1,
}

function sha256(bytes: Buffer): string {
    return createHash("sha256").update(bytes).digest("hex");
}

function referenceCount(index: Record<string, string[]>): number {
    return Object.values(index).reduce((total, fieldIds) => total + fieldIds.length, 0);
}

function canonicalSidecar(sidecar: GameDbDokkanFieldSidecarV1): GameDbDokkanFieldSidecarV1 {
    if (sidecar.schemaVersion !== "game-db-dokkan-field-sidecar-v1"
        || sidecar.source?.kind !== "first-party-game-db-snapshot"
        || typeof sidecar.source.snapshotId !== "string"
        || sidecar.source.snapshotId.trim().length === 0
        || sidecar.source.snapshotId !== sidecar.source.snapshotId.trim()
        || JSON.stringify(sidecar.source.tables) !== JSON.stringify(DOKKAN_FIELD_SIDECAR_TABLES)) {
        throw new Error("Dokkan field sidecar source contract is invalid");
    }

    const tables = Object.fromEntries(DOKKAN_FIELD_SIDECAR_TABLES.map(table => {
        const rows = sidecar.rows?.[table];
        if (!Array.isArray(rows)) {
            throw new Error(`Dokkan field sidecar is missing raw table ${table}`);
        }
        return [table, rows.map(row => ({ ...row.values }))];
    }));
    const canonical = buildGameDbDokkanFieldSidecar(
        sidecar.source.snapshotId,
        tables as Parameters<typeof buildGameDbDokkanFieldSidecar>[1],
    );
    if (JSON.stringify(canonical) !== JSON.stringify(sidecar)) {
        throw new Error("Dokkan field sidecar payload is not canonical for its raw rows");
    }
    return canonical;
}

export function buildGameDbDokkanFieldSidecarArtifact(
    sidecar: GameDbDokkanFieldSidecarV1,
): GameDbDokkanFieldSidecarArtifactV1 {
    const canonical = canonicalSidecar(sidecar);

    const raw = Buffer.from(`${JSON.stringify(canonical)}\n`, "utf8");
    if (raw.byteLength <= 0 || raw.byteLength > MAX_UNCOMPRESSED_BYTES) {
        throw new Error("Dokkan field sidecar uncompressed size is outside the allowed range");
    }
    const payload = gzipSync(raw, { level: 9 });
    if (payload.byteLength <= 0 || payload.byteLength > MAX_COMPRESSED_BYTES) {
        throw new Error("Dokkan field sidecar compressed size is outside the allowed range");
    }

    const tableRowCounts = Object.fromEntries(DOKKAN_FIELD_SIDECAR_TABLES.map(table => [
        table,
        canonical.rows[table].length,
    ])) as GameDbDokkanFieldSidecarManifestV1["tableRowCounts"];

    return {
        sidecar: canonical,
        payload,
        manifest: {
            schemaVersion: "game-db-dokkan-field-sidecar-manifest-v1",
            authority: "structural-association-only",
            createdDomainSemantics: "not-established",
            sourceSnapshotId: canonical.source.snapshotId,
            payload: {
                fileName: DOKKAN_FIELD_SIDECAR_PAYLOAD_FILE,
                compression: "gzip",
                sha256: sha256(payload),
                sizeBytes: payload.byteLength,
                uncompressedSha256: sha256(raw),
                uncompressedSizeBytes: raw.byteLength,
            },
            tableRowCounts,
            indexCounts: {
                activeSkillSetEntries: Object.keys(canonical.relatedFieldIdsByActiveSkillSet).length,
                activeSkillSetFieldReferences: referenceCount(canonical.relatedFieldIdsByActiveSkillSet),
                passiveSkillEntries: Object.keys(canonical.relatedFieldIdsByPassiveSkill).length,
                passiveSkillFieldReferences: referenceCount(canonical.relatedFieldIdsByPassiveSkill),
            },
            includedTableIntegrity: canonical.includedTableIntegrity,
            eligibleForStructuralConsumption: canonical.includedTableIntegrity.status === "complete",
        },
    };
}

export function validateGameDbDokkanFieldSidecarArtifact(
    payload: Buffer,
    manifest: GameDbDokkanFieldSidecarManifestV1,
): GameDbDokkanFieldSidecarV1 {
    if (manifest.schemaVersion !== "game-db-dokkan-field-sidecar-manifest-v1"
        || manifest.authority !== "structural-association-only"
        || manifest.createdDomainSemantics !== "not-established"
        || manifest.payload.fileName !== DOKKAN_FIELD_SIDECAR_PAYLOAD_FILE
        || manifest.payload.compression !== "gzip"
        || payload.byteLength !== manifest.payload.sizeBytes
        || payload.byteLength <= 0
        || payload.byteLength > MAX_COMPRESSED_BYTES
        || sha256(payload) !== manifest.payload.sha256) {
        throw new Error("Dokkan field sidecar manifest or compressed payload is invalid");
    }

    const raw = gunzipSync(payload, { maxOutputLength: MAX_UNCOMPRESSED_BYTES });
    if (raw.byteLength !== manifest.payload.uncompressedSizeBytes
        || sha256(raw) !== manifest.payload.uncompressedSha256) {
        throw new Error("Dokkan field sidecar uncompressed payload identity drift");
    }
    const parsed = JSON.parse(raw.toString("utf8")) as GameDbDokkanFieldSidecarV1;
    const rebuilt = buildGameDbDokkanFieldSidecarArtifact(parsed);
    if (JSON.stringify(rebuilt.manifest) !== JSON.stringify(manifest)) {
        throw new Error("Dokkan field sidecar manifest facts do not match payload");
    }
    return parsed;
}

export async function writeGameDbDokkanFieldSidecarArtifactIfPresent(options: {
    sourceConfig: GameDbSourceConfig,
    sourceSnapshotId: string,
    outputDir: string,
}): Promise<
    | { status: "absent" }
    | { status: "written", outputDir: string, payloadPath: string, manifestPath: string }
> {
    const tables = await loadGameDbDokkanFieldSidecarTablesIfPresent(options.sourceConfig);
    if (!tables) {
        return { status: "absent" };
    }

    const artifact = buildGameDbDokkanFieldSidecarArtifact(
        buildGameDbDokkanFieldSidecar(options.sourceSnapshotId, tables),
    );
    const outputDir = resolve(options.outputDir);
    if (existsSync(outputDir)) {
        throw new Error(`Refusing to replace an existing Dokkan field sidecar output: ${outputDir}`);
    }
    await mkdir(dirname(outputDir), { recursive: true });
    await mkdir(outputDir);
    const payloadPath = resolve(outputDir, DOKKAN_FIELD_SIDECAR_PAYLOAD_FILE);
    const manifestPath = resolve(outputDir, DOKKAN_FIELD_SIDECAR_MANIFEST_FILE);
    await writeFile(payloadPath, artifact.payload, { flag: "wx" });
    await writeFile(manifestPath, `${JSON.stringify(artifact.manifest, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    return { status: "written", outputDir, payloadPath, manifestPath };
}
