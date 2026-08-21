"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeGameDbDokkanFieldSidecarArtifactIfPresent = exports.validateGameDbDokkanFieldSidecarArtifact = exports.buildGameDbDokkanFieldSidecarArtifact = exports.DOKKAN_FIELD_SIDECAR_MANIFEST_FILE = exports.DOKKAN_FIELD_SIDECAR_PAYLOAD_FILE = void 0;
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const zlib_1 = require("zlib");
const game_db_dokkan_field_sidecar_1 = require("./game-db-dokkan-field-sidecar");
const game_db_table_inventory_1 = require("./game-db-table-inventory");
exports.DOKKAN_FIELD_SIDECAR_PAYLOAD_FILE = "dokkan-field-sidecar.json.gz";
exports.DOKKAN_FIELD_SIDECAR_MANIFEST_FILE = "dokkan-field-sidecar-manifest.json";
const MAX_UNCOMPRESSED_BYTES = 64 * 1024 * 1024;
const MAX_COMPRESSED_BYTES = 16 * 1024 * 1024;
function sha256(bytes) {
    return (0, crypto_1.createHash)("sha256").update(bytes).digest("hex");
}
function referenceCount(index) {
    return Object.values(index).reduce((total, fieldIds) => total + fieldIds.length, 0);
}
function canonicalSidecar(sidecar) {
    if (sidecar.schemaVersion !== "game-db-dokkan-field-sidecar-v1"
        || sidecar.source?.kind !== "first-party-game-db-snapshot"
        || typeof sidecar.source.snapshotId !== "string"
        || sidecar.source.snapshotId.trim().length === 0
        || sidecar.source.snapshotId !== sidecar.source.snapshotId.trim()
        || JSON.stringify(sidecar.source.tables) !== JSON.stringify(game_db_table_inventory_1.DOKKAN_FIELD_SIDECAR_TABLES)) {
        throw new Error("Dokkan field sidecar source contract is invalid");
    }
    const tables = Object.fromEntries(game_db_table_inventory_1.DOKKAN_FIELD_SIDECAR_TABLES.map(table => {
        const rows = sidecar.rows?.[table];
        if (!Array.isArray(rows)) {
            throw new Error(`Dokkan field sidecar is missing raw table ${table}`);
        }
        return [table, rows.map(row => ({ ...row.values }))];
    }));
    const canonical = (0, game_db_dokkan_field_sidecar_1.buildGameDbDokkanFieldSidecar)(sidecar.source.snapshotId, tables);
    if (JSON.stringify(canonical) !== JSON.stringify(sidecar)) {
        throw new Error("Dokkan field sidecar payload is not canonical for its raw rows");
    }
    return canonical;
}
function buildGameDbDokkanFieldSidecarArtifact(sidecar) {
    const canonical = canonicalSidecar(sidecar);
    const raw = Buffer.from(`${JSON.stringify(canonical)}\n`, "utf8");
    if (raw.byteLength <= 0 || raw.byteLength > MAX_UNCOMPRESSED_BYTES) {
        throw new Error("Dokkan field sidecar uncompressed size is outside the allowed range");
    }
    const payload = (0, zlib_1.gzipSync)(raw, { level: 9 });
    if (payload.byteLength <= 0 || payload.byteLength > MAX_COMPRESSED_BYTES) {
        throw new Error("Dokkan field sidecar compressed size is outside the allowed range");
    }
    const tableRowCounts = Object.fromEntries(game_db_table_inventory_1.DOKKAN_FIELD_SIDECAR_TABLES.map(table => [
        table,
        canonical.rows[table].length,
    ]));
    return {
        sidecar: canonical,
        payload,
        manifest: {
            schemaVersion: "game-db-dokkan-field-sidecar-manifest-v1",
            authority: "structural-association-only",
            createdDomainSemantics: "not-established",
            sourceSnapshotId: canonical.source.snapshotId,
            payload: {
                fileName: exports.DOKKAN_FIELD_SIDECAR_PAYLOAD_FILE,
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
exports.buildGameDbDokkanFieldSidecarArtifact = buildGameDbDokkanFieldSidecarArtifact;
function validateGameDbDokkanFieldSidecarArtifact(payload, manifest) {
    if (manifest.schemaVersion !== "game-db-dokkan-field-sidecar-manifest-v1"
        || manifest.authority !== "structural-association-only"
        || manifest.createdDomainSemantics !== "not-established"
        || manifest.payload.fileName !== exports.DOKKAN_FIELD_SIDECAR_PAYLOAD_FILE
        || manifest.payload.compression !== "gzip"
        || payload.byteLength !== manifest.payload.sizeBytes
        || payload.byteLength <= 0
        || payload.byteLength > MAX_COMPRESSED_BYTES
        || sha256(payload) !== manifest.payload.sha256) {
        throw new Error("Dokkan field sidecar manifest or compressed payload is invalid");
    }
    const raw = (0, zlib_1.gunzipSync)(payload, { maxOutputLength: MAX_UNCOMPRESSED_BYTES });
    if (raw.byteLength !== manifest.payload.uncompressedSizeBytes
        || sha256(raw) !== manifest.payload.uncompressedSha256) {
        throw new Error("Dokkan field sidecar uncompressed payload identity drift");
    }
    const parsed = JSON.parse(raw.toString("utf8"));
    const rebuilt = buildGameDbDokkanFieldSidecarArtifact(parsed);
    if (JSON.stringify(rebuilt.manifest) !== JSON.stringify(manifest)) {
        throw new Error("Dokkan field sidecar manifest facts do not match payload");
    }
    return parsed;
}
exports.validateGameDbDokkanFieldSidecarArtifact = validateGameDbDokkanFieldSidecarArtifact;
async function writeGameDbDokkanFieldSidecarArtifactIfPresent(options) {
    const tables = await (0, game_db_dokkan_field_sidecar_1.loadGameDbDokkanFieldSidecarTablesIfPresent)(options.sourceConfig);
    if (!tables) {
        return { status: "absent" };
    }
    const artifact = buildGameDbDokkanFieldSidecarArtifact((0, game_db_dokkan_field_sidecar_1.buildGameDbDokkanFieldSidecar)(options.sourceSnapshotId, tables));
    const outputDir = (0, path_1.resolve)(options.outputDir);
    if ((0, fs_1.existsSync)(outputDir)) {
        throw new Error(`Refusing to replace an existing Dokkan field sidecar output: ${outputDir}`);
    }
    await (0, promises_1.mkdir)((0, path_1.dirname)(outputDir), { recursive: true });
    await (0, promises_1.mkdir)(outputDir);
    const payloadPath = (0, path_1.resolve)(outputDir, exports.DOKKAN_FIELD_SIDECAR_PAYLOAD_FILE);
    const manifestPath = (0, path_1.resolve)(outputDir, exports.DOKKAN_FIELD_SIDECAR_MANIFEST_FILE);
    await (0, promises_1.writeFile)(payloadPath, artifact.payload, { flag: "wx" });
    await (0, promises_1.writeFile)(manifestPath, `${JSON.stringify(artifact.manifest, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    return { status: "written", outputDir, payloadPath, manifestPath };
}
exports.writeGameDbDokkanFieldSidecarArtifactIfPresent = writeGameDbDokkanFieldSidecarArtifactIfPresent;
//# sourceMappingURL=game-db-dokkan-field-sidecar-artifact.js.map