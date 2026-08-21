"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const mocha_1 = require("mocha");
const os_1 = require("os");
const path_1 = require("path");
const zlib_1 = require("zlib");
const game_db_dokkan_field_sidecar_artifact_1 = require("./game-db-dokkan-field-sidecar-artifact");
const game_db_dokkan_field_sidecar_1 = require("./game-db-dokkan-field-sidecar");
function sidecar(incomplete = false) {
    return (0, game_db_dokkan_field_sidecar_1.buildGameDbDokkanFieldSidecar)("glb-db-123", {
        dokkan_fields: [{ id: "10", dokkan_field_efficacy_set_id: incomplete ? "404" : "20", name: "Field" }],
        dokkan_field_efficacy_sets: [{ id: "20" }],
        dokkan_field_efficacies: [{ id: "30", dokkan_field_efficacy_set_id: "20", eff_value1: "25" }],
        dokkan_field_active_skill_set_relations: [{ id: "40", dokkan_field_id: "10", active_skill_set_id: "50" }],
        dokkan_field_passive_skill_relations: [{ id: "60", dokkan_field_id: "10", passive_skill_id: "70" }],
    });
}
async function writeSyntheticTables(dataDir) {
    const rows = {
        dokkan_fields: "id,dokkan_field_efficacy_set_id,name\n10,20,Field\n",
        dokkan_field_efficacy_sets: "id\n20\n",
        dokkan_field_efficacies: "id,dokkan_field_efficacy_set_id,eff_value1\n30,20,25\n",
        dokkan_field_active_skill_set_relations: "id,dokkan_field_id,active_skill_set_id\n40,10,50\n",
        dokkan_field_passive_skill_relations: "id,dokkan_field_id,passive_skill_id\n60,10,70\n",
    };
    await Promise.all(game_db_dokkan_field_sidecar_1.DOKKAN_FIELD_SIDECAR_TABLES.map(table => (0, promises_1.writeFile)((0, path_1.join)(dataDir, `${table}.csv`), rows[table], "utf8")));
}
function sha256(bytes) {
    return (0, crypto_1.createHash)("sha256").update(bytes).digest("hex");
}
function encodeTamperedSidecar(tampered, baseManifest) {
    const raw = Buffer.from(`${JSON.stringify(tampered)}\n`, "utf8");
    const payload = (0, zlib_1.gzipSync)(raw, { level: 9 });
    return {
        payload,
        manifest: {
            ...baseManifest,
            payload: {
                ...baseManifest.payload,
                sha256: sha256(payload),
                sizeBytes: payload.byteLength,
                uncompressedSha256: sha256(raw),
                uncompressedSizeBytes: raw.byteLength,
            },
            includedTableIntegrity: tampered.includedTableIntegrity,
            eligibleForStructuralConsumption: tampered.includedTableIntegrity.status === "complete",
            indexCounts: {
                activeSkillSetEntries: Object.keys(tampered.relatedFieldIdsByActiveSkillSet).length,
                activeSkillSetFieldReferences: Object.values(tampered.relatedFieldIdsByActiveSkillSet)
                    .reduce((total, ids) => total + ids.length, 0),
                passiveSkillEntries: Object.keys(tampered.relatedFieldIdsByPassiveSkill).length,
                passiveSkillFieldReferences: Object.values(tampered.relatedFieldIdsByPassiveSkill)
                    .reduce((total, ids) => total + ids.length, 0),
            },
        },
    };
}
(0, mocha_1.describe)("GameDbDokkanFieldSidecarArtifact", function () {
    (0, mocha_1.it)("builds deterministic structural-only bytes and exact manifest facts", () => {
        const first = (0, game_db_dokkan_field_sidecar_artifact_1.buildGameDbDokkanFieldSidecarArtifact)(sidecar());
        const second = (0, game_db_dokkan_field_sidecar_artifact_1.buildGameDbDokkanFieldSidecarArtifact)(sidecar());
        (0, assert_1.equal)(first.payload.equals(second.payload), true);
        (0, assert_1.deepEqual)(first.manifest, second.manifest);
        (0, assert_1.equal)(first.manifest.authority, "structural-association-only");
        (0, assert_1.equal)(first.manifest.createdDomainSemantics, "not-established");
        (0, assert_1.equal)(first.manifest.tableRowCounts.dokkan_fields, 1);
        (0, assert_1.equal)(first.manifest.indexCounts.activeSkillSetFieldReferences, 1);
        (0, assert_1.equal)(first.manifest.indexCounts.passiveSkillFieldReferences, 1);
        (0, assert_1.equal)(first.manifest.eligibleForStructuralConsumption, true);
        (0, assert_1.deepEqual)((0, game_db_dokkan_field_sidecar_artifact_1.validateGameDbDokkanFieldSidecarArtifact)(first.payload, first.manifest), first.sidecar);
    });
    (0, mocha_1.it)("preserves incomplete structural evidence but marks it ineligible", () => {
        const artifact = (0, game_db_dokkan_field_sidecar_artifact_1.buildGameDbDokkanFieldSidecarArtifact)(sidecar(true));
        (0, assert_1.equal)(artifact.manifest.includedTableIntegrity.status, "incomplete");
        (0, assert_1.equal)(artifact.manifest.eligibleForStructuralConsumption, false);
        (0, assert_1.deepEqual)(artifact.manifest.includedTableIntegrity.unresolvedFieldEfficacySetIds, ["404"]);
    });
    (0, mocha_1.it)("rejects payload and manifest drift", () => {
        const artifact = (0, game_db_dokkan_field_sidecar_artifact_1.buildGameDbDokkanFieldSidecarArtifact)(sidecar());
        const changedPayload = Buffer.from(artifact.payload);
        changedPayload[changedPayload.length - 1] ^= 1;
        (0, assert_1.throws)(() => (0, game_db_dokkan_field_sidecar_artifact_1.validateGameDbDokkanFieldSidecarArtifact)(changedPayload, artifact.manifest), /compressed payload is invalid/);
        const changedManifest = {
            ...artifact.manifest,
            tableRowCounts: { ...artifact.manifest.tableRowCounts, dokkan_fields: 2 },
        };
        (0, assert_1.throws)(() => (0, game_db_dokkan_field_sidecar_artifact_1.validateGameDbDokkanFieldSidecarArtifact)(artifact.payload, changedManifest), /manifest facts do not match payload/);
    });
    (0, mocha_1.it)("reconstructs integrity and relation indexes from raw rows", () => {
        const incompleteArtifact = (0, game_db_dokkan_field_sidecar_artifact_1.buildGameDbDokkanFieldSidecarArtifact)(sidecar(true));
        const falseComplete = JSON.parse(JSON.stringify(incompleteArtifact.sidecar));
        falseComplete.includedTableIntegrity.status = "complete";
        falseComplete.includedTableIntegrity.unresolvedFieldEfficacySetIds = [];
        const falseCompleteArtifact = encodeTamperedSidecar(falseComplete, incompleteArtifact.manifest);
        (0, assert_1.throws)(() => (0, game_db_dokkan_field_sidecar_artifact_1.validateGameDbDokkanFieldSidecarArtifact)(falseCompleteArtifact.payload, falseCompleteArtifact.manifest), /payload is not canonical/);
        const completeArtifact = (0, game_db_dokkan_field_sidecar_artifact_1.buildGameDbDokkanFieldSidecarArtifact)(sidecar());
        const changedIndex = JSON.parse(JSON.stringify(completeArtifact.sidecar));
        changedIndex.relatedFieldIdsByActiveSkillSet["50"] = ["10", "999"];
        const changedIndexArtifact = encodeTamperedSidecar(changedIndex, completeArtifact.manifest);
        (0, assert_1.throws)(() => (0, game_db_dokkan_field_sidecar_artifact_1.validateGameDbDokkanFieldSidecarArtifact)(changedIndexArtifact.payload, changedIndexArtifact.manifest), /payload is not canonical/);
    });
    (0, mocha_1.it)("performs zero output writes when the optional sidecar is absent", async () => {
        const root = await (0, promises_1.mkdtemp)((0, path_1.join)((0, os_1.tmpdir)(), "dokkan-field-artifact-absent-"));
        const dataDir = (0, path_1.join)(root, "data");
        const outputDir = (0, path_1.join)(root, "output");
        await (0, promises_1.mkdir)(dataDir);
        try {
            const result = await (0, game_db_dokkan_field_sidecar_artifact_1.writeGameDbDokkanFieldSidecarArtifactIfPresent)({
                sourceConfig: { sourceRoot: root, dataDir },
                sourceSnapshotId: "snapshot",
                outputDir,
            });
            (0, assert_1.deepEqual)(result, { status: "absent" });
            (0, assert_1.equal)((0, fs_1.existsSync)(outputDir), false);
        }
        finally {
            await (0, promises_1.rm)(root, { recursive: true, force: true });
        }
    });
    (0, mocha_1.it)("writes payload and an exact manifest marker into a fresh output", async () => {
        const root = await (0, promises_1.mkdtemp)((0, path_1.join)((0, os_1.tmpdir)(), "dokkan-field-artifact-write-"));
        const dataDir = (0, path_1.join)(root, "data");
        const outputDir = (0, path_1.join)(root, "output");
        await (0, promises_1.mkdir)(dataDir);
        try {
            await writeSyntheticTables(dataDir);
            const result = await (0, game_db_dokkan_field_sidecar_artifact_1.writeGameDbDokkanFieldSidecarArtifactIfPresent)({
                sourceConfig: { sourceRoot: root, dataDir },
                sourceSnapshotId: "snapshot",
                outputDir,
            });
            (0, assert_1.equal)(result.status, "written");
            if (result.status !== "written") {
                throw new Error("Expected written sidecar artifact");
            }
            const payload = await (0, promises_1.readFile)((0, path_1.join)(outputDir, game_db_dokkan_field_sidecar_artifact_1.DOKKAN_FIELD_SIDECAR_PAYLOAD_FILE));
            const manifest = JSON.parse(await (0, promises_1.readFile)((0, path_1.join)(outputDir, game_db_dokkan_field_sidecar_artifact_1.DOKKAN_FIELD_SIDECAR_MANIFEST_FILE), "utf8"));
            (0, assert_1.equal)((0, game_db_dokkan_field_sidecar_artifact_1.validateGameDbDokkanFieldSidecarArtifact)(payload, manifest).source.snapshotId, "snapshot");
            await (0, assert_1.rejects)(() => (0, game_db_dokkan_field_sidecar_artifact_1.writeGameDbDokkanFieldSidecarArtifactIfPresent)({
                sourceConfig: { sourceRoot: root, dataDir },
                sourceSnapshotId: "snapshot",
                outputDir,
            }), /Refusing to replace an existing Dokkan field sidecar output/);
        }
        finally {
            await (0, promises_1.rm)(root, { recursive: true, force: true });
        }
    });
});
//# sourceMappingURL=game-db-dokkan-field-sidecar-artifact.spec.js.map