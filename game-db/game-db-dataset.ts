import { createHash } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import { resolve } from "path";
import { gzipSync } from "zlib";
import { DatasetManifest } from "../dataset-artifacts";
import {
    GameDbDokkanpanionProjection,
    projectGameDbCharactersToDokkanpanion,
} from "./game-db-app-projection";
import {
    buildGameDbCharacterSnapshots,
    loadRequiredGameDbTables,
    parseCardIds,
} from "./game-db-experiment";
import { readSourceSettings } from "./game-db-source-settings";
import {
    buildSnapshotAuditedCreatedDomainEnrichedCharacters,
    CREATED_DOMAIN_AUDITED_SNAPSHOT_ID,
} from "./game-db-dokkan-field-created-domain";
import { buildGameDbDokkanFieldSidecar, loadGameDbDokkanFieldSidecarTablesIfPresent } from "./game-db-dokkan-field-sidecar";
import { buildGameDbDokkanFieldSidecarArtifact } from "./game-db-dokkan-field-sidecar-artifact";
import { GameDbCharacterSnapshot } from "./game-db-contract";
import { writeFormattedJson } from "../format-json";
import {
    GameDbSourceConfig,
    GameDbRow,
    normalizeDbId,
    parseDbDate,
    parseDbInt,
    resolveGameDbSourceConfig,
} from "./game-db-source";

const PRIMARY_CARD_ID_MAX = 4_000_000;
const MINIMUM_HP_INIT = 300;
const DEFAULT_OUTPUT_DIR = resolve(__dirname, "data", "game-db-dataset", "latest");
export const GAME_DB_DATASET_CONTENT_REVISION = "super-attack-details-v3";

export function resolveCreatedDomainSourceSnapshotId(
    sourceSettings?: GameDbDatasetReport["sourceSettings"],
    sourceSnapshotIdHint?: string,
): string | undefined {
    const settingsSnapshotId = sourceSettings?.glbDbVersion
        ? `glb-db-${sourceSettings.glbDbVersion}`
        : undefined;
    if (sourceSnapshotIdHint && settingsSnapshotId && sourceSnapshotIdHint !== settingsSnapshotId) {
        throw new Error("Created Domain source snapshot hint conflicts with source settings");
    }
    return sourceSnapshotIdHint ?? settingsSnapshotId;
}

export interface GameDbDatasetReport {
    source: "game-db-dataset",
    generatedAt: string,
    sourceRoot: string,
    dataDir: string,
    datasetVersion: string,
    selectedCardCount: number,
    explicitCardIdOverride: boolean,
    cardLimit?: number,
    selectionRules: {
        maxPrimaryCardIdExclusive: number,
        minHpInitExclusive: number,
        groupedBy: "card_unique_info_id",
        selectedVariant: "highest-card-id",
    },
    sourceSettings?: {
        glbAssetVersion?: number,
        glbDbVersion?: number,
        glbApkVersion?: string,
    },
    createdDomainEnrichment: {
        status: "absent" | "snapshot-audited" | "unsupported-snapshot",
        sourceSnapshotId?: string,
        linkCount: number,
    },
}

export async function enrichGameDbDatasetCreatedDomainsIfSupported(options: {
    characters: GameDbCharacterSnapshot[],
    sourceConfig: GameDbSourceConfig,
    sourceSettings?: GameDbDatasetReport["sourceSettings"],
    sourceSnapshotIdHint?: string,
}): Promise<{
    characters: GameDbCharacterSnapshot[],
    report: GameDbDatasetReport["createdDomainEnrichment"],
}> {
    const fieldTables = await loadGameDbDokkanFieldSidecarTablesIfPresent(options.sourceConfig);
    if (!fieldTables) {
        return {
            characters: options.characters,
            report: { status: "absent", linkCount: 0 },
        };
    }

    const sourceSnapshotId = resolveCreatedDomainSourceSnapshotId(
        options.sourceSettings,
        options.sourceSnapshotIdHint,
    );
    if (sourceSnapshotId !== CREATED_DOMAIN_AUDITED_SNAPSHOT_ID) {
        return {
            characters: options.characters,
            report: { status: "unsupported-snapshot", sourceSnapshotId, linkCount: 0 },
        };
    }

    const sidecarArtifact = buildGameDbDokkanFieldSidecarArtifact(
        buildGameDbDokkanFieldSidecar(sourceSnapshotId, fieldTables),
    );
    const activeSkillSetsCsv = await readFile(resolve(options.sourceConfig.dataDir, "active_skill_sets.csv"));
    const enriched = buildSnapshotAuditedCreatedDomainEnrichedCharacters({
        characters: options.characters,
        sidecarPayload: sidecarArtifact.payload,
        sidecarManifest: sidecarArtifact.manifest,
        activeSkillSetsCsv,
    });
    return {
        characters: enriched.characters,
        report: {
            status: "snapshot-audited",
            sourceSnapshotId,
            linkCount: Object.keys(enriched.projection.byActiveSkillSetId).length,
        },
    };
}

function isReleasedAtOrBefore(openAt: string | undefined, now: Date): boolean {
    if (!openAt) {
        return true;
    }

    return new Date(openAt).getTime() <= now.getTime();
}

export function isPrimaryPlayableCardRow(row: GameDbRow, now = new Date()): boolean {
    const cardId = parseDbInt(row.id);
    const rarity = parseDbInt(row.rarity);
    const hpInit = parseDbInt(row.hp_init) ?? 0;
    const cardUniqueInfoId = normalizeDbId(row.card_unique_info_id);
    const openAt = parseDbDate(row.open_at);

    return Boolean(
        cardId
        && cardId > 0
        && cardId < PRIMARY_CARD_ID_MAX
        && rarity !== undefined
        && rarity >= 0
        && rarity <= 5
        && hpInit > MINIMUM_HP_INIT
        && cardUniqueInfoId
        && isReleasedAtOrBefore(openAt, now),
    );
}

function comparePreferredPrimaryCardRow(left: GameDbRow, right: GameDbRow): number {
    return (parseDbInt(left.id) ?? 0) - (parseDbInt(right.id) ?? 0);
}

export function selectPrimaryGameDbCardIds(rows: GameDbRow[], now = new Date()): string[] {
    const selectedByUniqueInfoId = new Map<string, GameDbRow>();

    for (const row of rows) {
        if (!isPrimaryPlayableCardRow(row, now)) {
            continue;
        }

        const cardUniqueInfoId = normalizeDbId(row.card_unique_info_id);
        const cardId = normalizeDbId(row.id);
        if (!cardUniqueInfoId || !cardId) {
            continue;
        }

        const existing = selectedByUniqueInfoId.get(cardUniqueInfoId);
        if (!existing || comparePreferredPrimaryCardRow(existing, row) < 0) {
            selectedByUniqueInfoId.set(cardUniqueInfoId, row);
        }
    }

    return [...selectedByUniqueInfoId.values()]
        .map(row => normalizeDbId(row.id))
        .filter((value): value is string => Boolean(value))
        .sort((left, right) => (parseInt(left, 10) - parseInt(right, 10)));
}

export function parseOptionalCardLimit(value?: string): number | undefined {
    const parsed = parseInt((value ?? "").trim(), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export function applyOptionalCardLimit(cardIds: string[], limit?: number): string[] {
    return limit ? cardIds.slice(0, limit) : cardIds;
}

export function datasetVersionFromSourceSettings(
    generatedAt: string,
    sourceSettings?: GameDbDatasetReport["sourceSettings"],
    fallbackVersionParts?: string[],
): string {
    if (sourceSettings?.glbDbVersion || sourceSettings?.glbAssetVersion) {
        return [
            sourceSettings.glbDbVersion ? `glb-db-${sourceSettings.glbDbVersion}` : "",
            sourceSettings.glbAssetVersion ? `asset-${sourceSettings.glbAssetVersion}` : "",
            GAME_DB_DATASET_CONTENT_REVISION,
        ].filter(Boolean).join("__");
    }

    if (fallbackVersionParts && fallbackVersionParts.length > 0) {
        return [...fallbackVersionParts.filter(Boolean), GAME_DB_DATASET_CONTENT_REVISION].join("__");
    }

    return `generated-${generatedAt.replace(/[:]/g, "-")}__${GAME_DB_DATASET_CONTENT_REVISION}`;
}

function buildProjectionDatasetArtifact(
    characters: GameDbDokkanpanionProjection[],
    generatedAt: string,
    datasetVersion: string,
): {
    jsonText: string,
    gzipBuffer: Buffer,
    manifest: DatasetManifest,
} {
    const jsonText = `${JSON.stringify(characters, null, 2)}\n`;
    const utf8Buffer = Buffer.from(jsonText, "utf8");
    const gzipBuffer = gzipSync(utf8Buffer, { level: 9 });

    return {
        jsonText,
        gzipBuffer,
        manifest: {
            schemaVersion: 1,
            datasetVersion,
            generatedAt,
            fileName: "characters.json.gz",
            compression: "gzip",
            sha256: createHash("sha256").update(gzipBuffer).digest("hex"),
            sizeBytes: gzipBuffer.byteLength,
            uncompressedSizeBytes: utf8Buffer.byteLength,
            characterCount: characters.length,
        },
    };
}

export async function writeGameDbDataset(options?: {
    outputDir?: string,
    explicitCardIds?: string,
    cardLimit?: number,
    sourceConfig?: GameDbSourceConfig,
    datasetVersionHint?: string[],
    sourceSnapshotIdHint?: string,
}): Promise<{
    outputDir: string,
    projectionPath: string,
    reportPath: string,
    manifestPath: string,
    datasetPath: string,
    selectedCardIds: string[],
    datasetVersion: string,
}> {
    const sourceConfig = options?.sourceConfig ?? resolveGameDbSourceConfig();
    const tables = await loadRequiredGameDbTables(sourceConfig);
    const explicitCardIds = options?.explicitCardIds ?? process.env.DOKKAN_GAME_DB_CARD_IDS;
    const cardLimit = options?.cardLimit ?? parseOptionalCardLimit(process.env.DOKKAN_GAME_DB_CARD_LIMIT);
    const generatedAt = new Date().toISOString();
    const sourceSettings = await readSourceSettings(sourceConfig.settingsPath);

    const selectedCardIds = applyOptionalCardLimit(
        explicitCardIds
            ? parseCardIds(explicitCardIds)
            : selectPrimaryGameDbCardIds(tables.cards),
        cardLimit,
    );

    const rawSourceCharacters = buildGameDbCharacterSnapshots(selectedCardIds, tables);
    const createdDomainEnrichment = await enrichGameDbDatasetCreatedDomainsIfSupported({
        characters: rawSourceCharacters,
        sourceConfig,
        sourceSettings,
        sourceSnapshotIdHint: options?.sourceSnapshotIdHint,
    });
    const sourceCharacters = createdDomainEnrichment.characters;
    const projectionCharacters = projectGameDbCharactersToDokkanpanion(sourceCharacters);
    const datasetVersion = datasetVersionFromSourceSettings(generatedAt, sourceSettings, options?.datasetVersionHint);
    const artifact = buildProjectionDatasetArtifact(projectionCharacters, generatedAt, datasetVersion);
    const outputDir = options?.outputDir ?? DEFAULT_OUTPUT_DIR;
    const datasetPath = resolve(outputDir, artifact.manifest.fileName);
    const manifestPath = resolve(outputDir, "characters-manifest.json");
    const projectionPath = resolve(outputDir, "characters.json");
    const sourceSnapshotPath = resolve(outputDir, "source-characters.json");
    const reportPath = resolve(outputDir, "report.json");

    const report: GameDbDatasetReport = {
        source: "game-db-dataset",
        generatedAt,
        sourceRoot: sourceConfig.sourceRoot,
        dataDir: sourceConfig.dataDir,
        datasetVersion,
        selectedCardCount: projectionCharacters.length,
        explicitCardIdOverride: Boolean(explicitCardIds),
        cardLimit,
        selectionRules: {
            maxPrimaryCardIdExclusive: PRIMARY_CARD_ID_MAX,
            minHpInitExclusive: MINIMUM_HP_INIT,
            groupedBy: "card_unique_info_id",
            selectedVariant: "highest-card-id",
        },
        sourceSettings,
        createdDomainEnrichment: createdDomainEnrichment.report,
    };

    await mkdir(outputDir, { recursive: true });
    await writeFormattedJson(projectionPath, projectionCharacters);
    await writeFormattedJson(sourceSnapshotPath, sourceCharacters);
    await writeFormattedJson(reportPath, report);
    await writeFile(datasetPath, artifact.gzipBuffer);
    await writeFile(manifestPath, `${JSON.stringify(artifact.manifest, null, 2)}\n`, "utf8");

    return {
        outputDir,
        projectionPath,
        reportPath,
        manifestPath,
        datasetPath,
        selectedCardIds,
        datasetVersion,
    };
}

async function main() {
    const result = await writeGameDbDataset();
    console.log(`Wrote game-db dataset to ${result.outputDir}`);
    console.log(`Selected ${result.selectedCardIds.length} primary card(s)`);
}

if (require.main === module) {
    main().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}

