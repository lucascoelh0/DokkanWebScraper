import { deepEqual, equal, rejects, throws } from "assert";
import { createHash } from "crypto";
import { existsSync } from "fs";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "fs/promises";
import { describe, it } from "mocha";
import { tmpdir } from "os";
import { join } from "path";
import { gzipSync } from "zlib";
import {
    buildGameDbDokkanFieldSidecarArtifact,
    DOKKAN_FIELD_SIDECAR_MANIFEST_FILE,
    DOKKAN_FIELD_SIDECAR_PAYLOAD_FILE,
    GameDbDokkanFieldSidecarManifestV1,
    validateGameDbDokkanFieldSidecarArtifact,
    writeGameDbDokkanFieldSidecarArtifactIfPresent,
} from "./game-db-dokkan-field-sidecar-artifact";
import { buildGameDbDokkanFieldSidecar, DOKKAN_FIELD_SIDECAR_TABLES } from "./game-db-dokkan-field-sidecar";

function sidecar(incomplete = false) {
    return buildGameDbDokkanFieldSidecar("glb-db-123", {
        dokkan_fields: [{ id: "10", dokkan_field_efficacy_set_id: incomplete ? "404" : "20", name: "Field" }],
        dokkan_field_efficacy_sets: [{ id: "20" }],
        dokkan_field_efficacies: [{ id: "30", dokkan_field_efficacy_set_id: "20", eff_value1: "25" }],
        dokkan_field_active_skill_set_relations: [{ id: "40", dokkan_field_id: "10", active_skill_set_id: "50" }],
        dokkan_field_passive_skill_relations: [{ id: "60", dokkan_field_id: "10", passive_skill_id: "70" }],
    });
}

async function writeSyntheticTables(dataDir: string): Promise<void> {
    const rows: Record<string, string> = {
        dokkan_fields: "id,dokkan_field_efficacy_set_id,name\n10,20,Field\n",
        dokkan_field_efficacy_sets: "id\n20\n",
        dokkan_field_efficacies: "id,dokkan_field_efficacy_set_id,eff_value1\n30,20,25\n",
        dokkan_field_active_skill_set_relations: "id,dokkan_field_id,active_skill_set_id\n40,10,50\n",
        dokkan_field_passive_skill_relations: "id,dokkan_field_id,passive_skill_id\n60,10,70\n",
    };
    await Promise.all(DOKKAN_FIELD_SIDECAR_TABLES.map(table =>
        writeFile(join(dataDir, `${table}.csv`), rows[table], "utf8"),
    ));
}

function sha256(bytes: Buffer): string {
    return createHash("sha256").update(bytes).digest("hex");
}

function encodeTamperedSidecar(
    tampered: ReturnType<typeof sidecar>,
    baseManifest: GameDbDokkanFieldSidecarManifestV1,
): { payload: Buffer, manifest: GameDbDokkanFieldSidecarManifestV1 } {
    const raw = Buffer.from(`${JSON.stringify(tampered)}\n`, "utf8");
    const payload = gzipSync(raw, { level: 9 });
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

describe("GameDbDokkanFieldSidecarArtifact", function () {
    it("builds deterministic structural-only bytes and exact manifest facts", () => {
        const first = buildGameDbDokkanFieldSidecarArtifact(sidecar());
        const second = buildGameDbDokkanFieldSidecarArtifact(sidecar());

        equal(first.payload.equals(second.payload), true);
        deepEqual(first.manifest, second.manifest);
        equal(first.manifest.authority, "structural-association-only");
        equal(first.manifest.createdDomainSemantics, "not-established");
        equal(first.manifest.tableRowCounts.dokkan_fields, 1);
        equal(first.manifest.indexCounts.activeSkillSetFieldReferences, 1);
        equal(first.manifest.indexCounts.passiveSkillFieldReferences, 1);
        equal(first.manifest.eligibleForStructuralConsumption, true);
        deepEqual(validateGameDbDokkanFieldSidecarArtifact(first.payload, first.manifest), first.sidecar);
    });

    it("preserves incomplete structural evidence but marks it ineligible", () => {
        const artifact = buildGameDbDokkanFieldSidecarArtifact(sidecar(true));
        equal(artifact.manifest.includedTableIntegrity.status, "incomplete");
        equal(artifact.manifest.eligibleForStructuralConsumption, false);
        deepEqual(artifact.manifest.includedTableIntegrity.unresolvedFieldEfficacySetIds, ["404"]);
    });

    it("rejects payload and manifest drift", () => {
        const artifact = buildGameDbDokkanFieldSidecarArtifact(sidecar());
        const changedPayload = Buffer.from(artifact.payload);
        changedPayload[changedPayload.length - 1] ^= 1;
        throws(
            () => validateGameDbDokkanFieldSidecarArtifact(changedPayload, artifact.manifest),
            /compressed payload is invalid/,
        );

        const changedManifest: GameDbDokkanFieldSidecarManifestV1 = {
            ...artifact.manifest,
            tableRowCounts: { ...artifact.manifest.tableRowCounts, dokkan_fields: 2 },
        };
        throws(
            () => validateGameDbDokkanFieldSidecarArtifact(artifact.payload, changedManifest),
            /manifest facts do not match payload/,
        );
    });

    it("reconstructs integrity and relation indexes from raw rows", () => {
        const incompleteArtifact = buildGameDbDokkanFieldSidecarArtifact(sidecar(true));
        const falseComplete = JSON.parse(JSON.stringify(incompleteArtifact.sidecar)) as ReturnType<typeof sidecar>;
        falseComplete.includedTableIntegrity.status = "complete";
        falseComplete.includedTableIntegrity.unresolvedFieldEfficacySetIds = [];
        const falseCompleteArtifact = encodeTamperedSidecar(falseComplete, incompleteArtifact.manifest);
        throws(
            () => validateGameDbDokkanFieldSidecarArtifact(
                falseCompleteArtifact.payload,
                falseCompleteArtifact.manifest,
            ),
            /payload is not canonical/,
        );

        const completeArtifact = buildGameDbDokkanFieldSidecarArtifact(sidecar());
        const changedIndex = JSON.parse(JSON.stringify(completeArtifact.sidecar)) as ReturnType<typeof sidecar>;
        changedIndex.relatedFieldIdsByActiveSkillSet["50"] = ["10", "999"];
        const changedIndexArtifact = encodeTamperedSidecar(changedIndex, completeArtifact.manifest);
        throws(
            () => validateGameDbDokkanFieldSidecarArtifact(changedIndexArtifact.payload, changedIndexArtifact.manifest),
            /payload is not canonical/,
        );
    });

    it("performs zero output writes when the optional sidecar is absent", async () => {
        const root = await mkdtemp(join(tmpdir(), "dokkan-field-artifact-absent-"));
        const dataDir = join(root, "data");
        const outputDir = join(root, "output");
        await mkdir(dataDir);
        try {
            const result = await writeGameDbDokkanFieldSidecarArtifactIfPresent({
                sourceConfig: { sourceRoot: root, dataDir },
                sourceSnapshotId: "snapshot",
                outputDir,
            });
            deepEqual(result, { status: "absent" });
            equal(existsSync(outputDir), false);
        } finally {
            await rm(root, { recursive: true, force: true });
        }
    });

    it("writes payload and an exact manifest marker into a fresh output", async () => {
        const root = await mkdtemp(join(tmpdir(), "dokkan-field-artifact-write-"));
        const dataDir = join(root, "data");
        const outputDir = join(root, "output");
        await mkdir(dataDir);
        try {
            await writeSyntheticTables(dataDir);
            const result = await writeGameDbDokkanFieldSidecarArtifactIfPresent({
                sourceConfig: { sourceRoot: root, dataDir },
                sourceSnapshotId: "snapshot",
                outputDir,
            });
            equal(result.status, "written");
            if (result.status !== "written") {
                throw new Error("Expected written sidecar artifact");
            }
            const payload = await readFile(join(outputDir, DOKKAN_FIELD_SIDECAR_PAYLOAD_FILE));
            const manifest = JSON.parse(
                await readFile(join(outputDir, DOKKAN_FIELD_SIDECAR_MANIFEST_FILE), "utf8"),
            ) as GameDbDokkanFieldSidecarManifestV1;
            equal(validateGameDbDokkanFieldSidecarArtifact(payload, manifest).source.snapshotId, "snapshot");
            await rejects(
                () => writeGameDbDokkanFieldSidecarArtifactIfPresent({
                    sourceConfig: { sourceRoot: root, dataDir },
                    sourceSnapshotId: "snapshot",
                    outputDir,
                }),
                /Refusing to replace an existing Dokkan field sidecar output/,
            );
        } finally {
            await rm(root, { recursive: true, force: true });
        }
    });
});
