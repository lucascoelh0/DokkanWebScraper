import { createHash } from "crypto";
import { lstat, mkdir, readFile, realpath, writeFile } from "fs/promises";
import { basename, isAbsolute, relative, resolve, sep } from "path";
import { gunzipSync } from "zlib";
import { runAndroidV1ContractProjector } from "../android-v1-contract-projector-run";
import type { Character, PortraitLayers } from "../character";
import {
    buildCharacterDatasetArtifact,
    DatasetManifest,
    writeCharacterDatasetBundle,
} from "../dataset-artifacts";
import { writeFormattedJson } from "../format-json";
import { runFyiTeamAnalysis } from "../fyi-team-analysis-run";
import type { TeamAnalysisManifest } from "../team-analysis-artifacts";
import { buildGameDbActiveSkillActivationContract } from "./game-db-active-skill";
import {
    GameDbDokkanpanionProjection,
    projectGameDbCharactersToDokkanpanion,
} from "./game-db-app-projection";
import { materializeGameDbCharacter, MaterializedPortraitAsset } from "./game-db-character-materializer";
import {
    overlayGameDbCharacterPassiveModes,
    selectDeliveredPassiveModeFormIds,
} from "./game-db-character-passive-mode-overlay";
import {
    assertFreshCandidateOutput,
    assertTeamAnalysisBoundToCharacterArtifact,
} from "./game-db-character-release-candidate";
import { overlayGameDbCharacterReleaseStates } from "./game-db-character-release-overlay";
import {
    applySnapshotAuditedCreatedDomainsToCharacters,
    buildCurrentSnapshotAuditedCreatedDomainProjection,
    GameDbSnapshotAuditedCreatedDomainProjectionV1,
} from "./game-db-dokkan-field-created-domain";
import {
    DOKKAN_FIELD_SIDECAR_TABLES,
    GameDbDokkanFieldSidecarTables,
} from "./game-db-dokkan-field-sidecar";
import { buildGameDbCharacterSnapshots, REQUIRED_GAME_DB_TABLES } from "./game-db-experiment";
import {
    buildGameDbCardIdentityContract,
    buildGameDbNameIdentityContract,
} from "./game-db-name-identity";
import { composeFirstPartyPortraitArtifacts } from "./first-party-portrait-compositor";
import { GameDbRow, normalizeDbId, parseGameDbTableCsvText } from "./game-db-source";
import {
    FIRST_PARTY_EXPORT_GAME_DB_TABLES,
    SUPER_ATTACK_CATEGORY_GAME_DB_TABLES,
    SUPER_ATTACK_EFFECT_GAME_DB_TABLES,
} from "./game-db-table-inventory";
import { buildGameDbTransformationActivationContract } from "./game-db-transformation-activation";

type ContractLane = "v1" | "v2";

interface LaneRefreshOptions {
    contractLane: ContractLane,
    firstPartyDir: string,
    portraitAssetsDir: string,
    newCardIds: string[],
    releaseStateCardIds: string[],
    categoryIds: string[],
    baselineDir: string,
    outputDir: string,
    catalogPath: string,
}

export function mergeReleaseProjections<T extends { id: string }>(
    releaseRoots: T[],
    relatedForms: T[],
): T[] {
    const merged = new Map<string, T>();
    for (const projection of releaseRoots) {
        if (merged.has(projection.id)) throw new Error(`duplicate release-root projection ${projection.id}`);
        merged.set(projection.id, projection);
    }
    for (const projection of relatedForms) {
        if (!merged.has(projection.id)) merged.set(projection.id, projection);
    }
    return [...merged.values()];
}

export function buildCreatedDomainEnrichedLaneCharacterArtifact(
    inputCharacters: Character[],
    projection: GameDbSnapshotAuditedCreatedDomainProjectionV1,
    generatedAt: string,
) {
    const enrichment = applySnapshotAuditedCreatedDomainsToCharacters(inputCharacters, projection);
    if (new Set(enrichment.characters.map(character => character.id)).size !== enrichment.characters.length) {
        throw new Error("lane refresh candidate contains duplicate Character IDs");
    }
    return {
        characters: enrichment.characters,
        patches: enrichment.patches,
        artifact: buildCharacterDatasetArtifact(enrichment.characters, {
            datasetVersion: generatedAt,
            generatedAt,
            fileName: "characters.json.gz",
        }),
    };
}

function csvList(value: string | undefined, option: string, allowEmpty = false): string[] {
    const values = value?.split(",").map(item => item.trim()).filter(Boolean) ?? [];
    if ((!allowEmpty && values.length === 0) || new Set(values).size !== values.length) {
        throw new Error(`${option} must contain unique comma-separated values`);
    }
    return values;
}

export function parseGameDbLaneRefreshArgs(args: string[]): LaneRefreshOptions {
    const supported = new Set([
        "--contract-lane",
        "--first-party-dir",
        "--portrait-assets-dir",
        "--new-card-ids",
        "--release-state-card-ids",
        "--category-ids",
        "--baseline-dir",
        "--output-dir",
        "--catalog",
    ]);
    const values = new Map<string, string>();
    for (let index = 0; index < args.length; index += 1) {
        const token = args[index];
        if (!supported.has(token)) throw new Error(`unsupported lane refresh argument ${token}`);
        if (values.has(token)) throw new Error(`duplicate lane refresh argument ${token}`);
        const value = args[++index];
        if (!value || value.startsWith("--")) throw new Error(`missing value for ${token}`);
        values.set(token, value);
    }

    const contractLane = values.get("--contract-lane");
    if (contractLane !== "v1" && contractLane !== "v2") {
        throw new Error("--contract-lane must be v1 or v2");
    }
    const firstPartyDir = values.get("--first-party-dir");
    const portraitAssetsDir = values.get("--portrait-assets-dir");
    const baselineDir = values.get("--baseline-dir");
    const outputDir = values.get("--output-dir");
    if (!firstPartyDir || !portraitAssetsDir || !baselineDir || !outputDir) {
        throw new Error("first-party, portrait-assets, baseline and output directories are required");
    }
    const newCardIds = csvList(values.get("--new-card-ids"), "--new-card-ids", true);
    const releaseStateCardIds = csvList(
        values.get("--release-state-card-ids"),
        "--release-state-card-ids",
        true,
    );
    if ([...newCardIds, ...releaseStateCardIds].some(id => !/^\d+$/.test(id))) {
        throw new Error("card IDs must be numeric");
    }
    const overlappingCardIds = newCardIds.filter(id => releaseStateCardIds.includes(id));
    if (overlappingCardIds.length > 0) {
        throw new Error(`card IDs cannot be both new and release-state targets: ${overlappingCardIds.join(", ")}`);
    }
    const categoryIds = csvList(values.get("--category-ids"), "--category-ids", true);
    if (categoryIds.some(id => !/^\d+$/.test(id))) {
        throw new Error("category IDs must be numeric");
    }

    return {
        contractLane,
        firstPartyDir: resolve(firstPartyDir),
        portraitAssetsDir: resolve(portraitAssetsDir),
        newCardIds,
        releaseStateCardIds,
        categoryIds,
        baselineDir: resolve(baselineDir),
        outputDir: resolve(outputDir),
        catalogPath: resolve(values.get("--catalog") ?? "data/fyi-character-catalog/latest/character-catalog.json"),
    };
}

function sha256(bytes: Buffer): string {
    return createHash("sha256").update(bytes).digest("hex");
}

interface SourceInventoryEntry {
    path: string,
    sizeBytes: number,
    sha256: string,
}

interface SourceInventory {
    entries: SourceInventoryEntry[],
    fileCount: number,
    totalBytes: number,
    inventorySha256: string,
    bytesByPath: Map<string, Buffer>,
}

function isStrictlyContained(root: string, target: string): boolean {
    const child = relative(resolve(root), resolve(target));
    return child.length > 0 && child !== ".." && !child.startsWith(`..${sep}`) && !isAbsolute(child);
}

async function inventorySourceFiles(root: string, relativePaths: string[]): Promise<SourceInventory> {
    const canonicalRoot = await realpath(root);
    const paths = [...new Set(relativePaths)].sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
    const entries: SourceInventoryEntry[] = [];
    const bytesByPath = new Map<string, Buffer>();
    for (const path of paths) {
        const normalized = path.replace(/\\/g, "/");
        if (!normalized || normalized.startsWith("/")
            || normalized.split("/").some(part => !part || part === "." || part === "..")) {
            throw new Error(`source inventory contains an unsafe path: ${path}`);
        }
        const sourcePath = resolve(canonicalRoot, ...normalized.split("/"));
        const [canonicalFile, identity] = await Promise.all([realpath(sourcePath), lstat(sourcePath)]);
        if (!identity.isFile() || identity.isSymbolicLink() || !isStrictlyContained(canonicalRoot, canonicalFile)) {
            throw new Error(`source inventory member is not a contained regular file: ${normalized}`);
        }
        const bytes = await readFile(canonicalFile);
        entries.push({ path: normalized, sizeBytes: bytes.length, sha256: sha256(bytes) });
        bytesByPath.set(normalized, bytes);
    }
    const inventoryBytes = Buffer.from(`${JSON.stringify(entries, null, 2)}\n`, "utf8");
    return {
        entries,
        fileCount: entries.length,
        totalBytes: entries.reduce((total, entry) => total + entry.sizeBytes, 0),
        inventorySha256: sha256(inventoryBytes),
        bytesByPath,
    };
}

function inventoryReport(inventory: SourceInventory): Omit<SourceInventory, "bytesByPath"> {
    const { bytesByPath: _bytesByPath, ...report } = inventory;
    return report;
}

export const LANE_REFRESH_GAME_DB_TABLES = [...new Set([
        ...REQUIRED_GAME_DB_TABLES,
        ...SUPER_ATTACK_EFFECT_GAME_DB_TABLES,
        ...SUPER_ATTACK_CATEGORY_GAME_DB_TABLES,
        ...DOKKAN_FIELD_SIDECAR_TABLES,
    ])];

function loadInventoriedGameDbTables(inventory: SourceInventory): Record<string, GameDbRow[]> {
    return Object.fromEntries(LANE_REFRESH_GAME_DB_TABLES.map(tableName => {
        const path = `${tableName}.csv`;
        const bytes = inventory.bytesByPath.get(path);
        if (!bytes) throw new Error(`inventoried first-party table is missing: ${path}`);
        return [tableName, parseGameDbTableCsvText(bytes.toString("utf8"))];
    }));
}

async function readBaseline(directory: string): Promise<{ characters: Character[], manifest: DatasetManifest }> {
    const manifest = JSON.parse(await readFile(resolve(directory, "characters-manifest.json"), "utf8")) as DatasetManifest;
    const payload = await readFile(resolve(directory, basename(manifest.fileName)));
    if (manifest.schemaVersion !== 1 || manifest.compression !== "gzip"
        || manifest.sizeBytes !== payload.length || manifest.sha256 !== sha256(payload)) {
        throw new Error("baseline Character manifest does not match its payload");
    }
    const raw = gunzipSync(payload);
    const characters = JSON.parse(raw.toString("utf8")) as Character[];
    if (raw.length !== manifest.uncompressedSizeBytes || characters.length !== manifest.characterCount) {
        throw new Error("baseline Character payload does not match its manifest counts");
    }
    return { characters, manifest };
}

export interface OfficialCategoryIdentity {
    categoryId: string,
    name: string,
}

export function resolveOfficialCategoryAssignments(
    tables: Record<string, GameDbRow[]>,
    categoryIds: string[],
): { identities: OfficialCategoryIdentity[], assignments: Map<string, OfficialCategoryIdentity[]> } {
    const requested = new Set(categoryIds);
    const nameById = new Map<string, string>();
    for (const row of tables.card_categories ?? []) {
        const id = normalizeDbId(row.id);
        const name = row.name?.trim();
        if (!id || !requested.has(id)) continue;
        if (!name) throw new Error(`game DB category ID ${id} has no display name`);
        if (nameById.has(id)) throw new Error(`duplicate game DB category ID ${id}`);
        nameById.set(id, name);
    }
    for (const categoryId of requested) {
        if (!nameById.has(categoryId)) throw new Error(`game DB category ID ${categoryId} was not found`);
    }
    const identities = [...nameById].map(([categoryId, name]) => ({ categoryId, name }))
        .sort((left, right) => Number(left.categoryId) - Number(right.categoryId));
    if (new Set(identities.map(identity => identity.name)).size !== identities.length) {
        throw new Error("requested game DB category IDs do not have unique display names");
    }
    const assignments = new Map<string, OfficialCategoryIdentity[]>();
    for (const row of tables.card_card_categories ?? []) {
        const cardId = normalizeDbId(row.card_id);
        const categoryId = normalizeDbId(row.card_category_id);
        const categoryName = categoryId ? nameById.get(categoryId) : undefined;
        if (!cardId || !categoryName) continue;
        const categories = assignments.get(cardId) ?? [];
        if (!categories.some(category => category.categoryId === categoryId)) {
            categories.push({ categoryId: categoryId as string, name: categoryName });
        }
        assignments.set(cardId, categories);
    }
    for (const categories of assignments.values()) {
        categories.sort((left, right) => Number(left.categoryId) - Number(right.categoryId));
    }
    return { identities, assignments };
}

export function applyAdditiveCategoryAssignments(
    characters: Character[],
    assignments: ReadonlyMap<string, readonly OfficialCategoryIdentity[]>,
): { characters: Character[], patches: Array<{ cardId: string, addedCategories: OfficialCategoryIdentity[] }> } {
    const cloned = JSON.parse(JSON.stringify(characters)) as Character[];
    const patches: Array<{ cardId: string, addedCategories: OfficialCategoryIdentity[] }> = [];
    for (const character of cloned) {
        const assigned = assignments.get(character.id);
        if (!assigned?.length) continue;
        const current = new Set(character.categories);
        const addedCategories = assigned.filter(category => !current.has(category.name));
        if (addedCategories.length === 0) continue;
        character.categories = [...current, ...addedCategories.map(category => category.name)]
            .sort((left, right) => left.localeCompare(right));
        patches.push({ cardId: character.id, addedCategories });
    }
    return {
        characters: cloned,
        patches: patches.sort((left, right) => Number(left.cardId) - Number(right.cardId)),
    };
}

async function writeContentAddressedAsset(
    outputRoot: string,
    objectKey: string,
    bytes: Buffer,
): Promise<void> {
    const path = resolve(outputRoot, ...objectKey.split("/"));
    await mkdir(resolve(path, ".."), { recursive: true });
    await writeFile(path, bytes, { flag: "wx" }).catch(async error => {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        const existing = await readFile(path);
        if (!existing.equals(bytes)) throw new Error(`content-addressed asset collision at ${objectKey}`);
    });
}

async function materializePortraits(
    projections: GameDbDokkanpanionProjection[],
    options: Pick<LaneRefreshOptions, "contractLane" | "portraitAssetsDir" | "outputDir">,
): Promise<{
    portraitById: Map<string, MaterializedPortraitAsset>,
    assets: Array<{ objectKey: string, sha256: string, sizeBytes: number }>,
    sourceInventory: Omit<SourceInventory, "bytesByPath">,
}> {
    const outputRoot = resolve(options.outputDir, "objects");
    const portraitById = new Map<string, MaterializedPortraitAsset>();
    const assetsByKey = new Map<string, { objectKey: string, sha256: string, sizeBytes: number }>();
    const sourcePaths = projections.flatMap(projection => [
        `character_thumb_bg/cha_base_0${projection.portraitSpec.frameColorId}_0${projection.portraitSpec.rarity === "LR" ? 5 : 4}.png`,
        `card_${projection.portraitSpec.iconId}_thumb.png`,
        `cha_rare_sm_${projection.portraitSpec.rarity.toLowerCase()}.png`,
        `cha_type_icon_${projection.portraitSpec.elementCode}.png`,
    ]);
    const sourceInventory = await inventorySourceFiles(options.portraitAssetsDir, sourcePaths);
    for (const projection of projections) {
        const backgroundPath = `character_thumb_bg/cha_base_0${projection.portraitSpec.frameColorId}_0${projection.portraitSpec.rarity === "LR" ? 5 : 4}.png`;
        const thumbPath = `card_${projection.portraitSpec.iconId}_thumb.png`;
        const rarityPath = `cha_rare_sm_${projection.portraitSpec.rarity.toLowerCase()}.png`;
        const typePath = `cha_type_icon_${projection.portraitSpec.elementCode}.png`;
        const artifacts = await composeFirstPartyPortraitArtifacts({
            background: sourceInventory.bytesByPath.get(backgroundPath)!,
            thumb: sourceInventory.bytesByPath.get(thumbPath)!,
            rarity: sourceInventory.bytesByPath.get(rarityPath)!,
            type: sourceInventory.bytesByPath.get(typePath)!,
        });
        const portraitSha = sha256(artifacts.portrait);
        const portraitFilename = `portrait_${projection.id}.${portraitSha}.png`;
        const portraitURL = `${options.contractLane}/images/v4/${portraitFilename}`;
        await writeContentAddressedAsset(outputRoot, portraitURL, artifacts.portrait);
        assetsByKey.set(portraitURL, {
            objectKey: portraitURL,
            sha256: portraitSha,
            sizeBytes: artifacts.portrait.length,
        });

        let portraitLayers: PortraitLayers | undefined;
        if (options.contractLane === "v2") {
            const layerEntries = [
                ["background", artifacts.portraitLayers.background],
                ["thumb", artifacts.portraitLayers.thumb],
                ["overlay", artifacts.portraitLayers.overlay],
            ] as const;
            const layerUrls = new Map<string, string>();
            for (const [kind, bytes] of layerEntries) {
                const digest = sha256(bytes);
                const objectKey = `${options.contractLane}/images/v5/layers/${kind}.${digest}.png`;
                await writeContentAddressedAsset(outputRoot, objectKey, bytes);
                assetsByKey.set(objectKey, { objectKey, sha256: digest, sizeBytes: bytes.length });
                layerUrls.set(kind, objectKey);
            }
            portraitLayers = {
                backgroundURL: layerUrls.get("background")!,
                thumbURL: layerUrls.get("thumb")!,
                overlayURL: layerUrls.get("overlay")!,
            };
        }
        portraitById.set(projection.id, { portraitURL, portraitFilename, portraitLayers });
    }
    return {
        portraitById,
        assets: [...assetsByKey.values()].sort((a, b) => a.objectKey.localeCompare(b.objectKey)),
        sourceInventory: inventoryReport(sourceInventory),
    };
}

export async function buildGameDbLaneRefreshCandidate(options: LaneRefreshOptions): Promise<void> {
    await assertFreshCandidateOutput(options.outputDir, options.baselineDir);
    const baseline = await readBaseline(options.baselineDir);
    const metadataInventory = await inventorySourceFiles(options.firstPartyDir, ["metadata.json"]);
    const metadataBytes = metadataInventory.bytesByPath.get("metadata.json");
    if (!metadataBytes) throw new Error("first-party export metadata was not inventoried");
    const metadata = JSON.parse(metadataBytes.toString("utf8"));
    if (metadata?.source !== "first-party-export"
        || metadata.region !== "global"
        || typeof metadata.dbVersion !== "string"
        || !/^\d+$/.test(metadata.dbVersion)
        || typeof metadata.assetVersion !== "string"
        || !/^\d+$/.test(metadata.assetVersion)
        || typeof metadata.apkVersion !== "string"
        || !/^\d+\.\d+\.\d+$/.test(metadata.apkVersion)) {
        throw new Error("lane refresh requires a versioned first-party export");
    }
    const firstPartyDataDir = resolve(options.firstPartyDir, "data");
    const firstPartyInventory = await inventorySourceFiles(
        firstPartyDataDir,
        FIRST_PARTY_EXPORT_GAME_DB_TABLES.map(table => `${table}.csv`),
    );
    const tables = loadInventoriedGameDbTables(firstPartyInventory);
    const createdDomainProjection = buildCurrentSnapshotAuditedCreatedDomainProjection({
        sourceSnapshotId: `glb-db-${metadata.dbVersion}`,
        fieldTables: Object.fromEntries(DOKKAN_FIELD_SIDECAR_TABLES.map(table => [
            table,
            tables[table],
        ])) as GameDbDokkanFieldSidecarTables,
        activeSkillSetRows: tables.active_skill_sets,
    });
    const requestedIds = [...options.newCardIds, ...options.releaseStateCardIds];
    const requestedProjections = projectGameDbCharactersToDokkanpanion(
        buildGameDbCharacterSnapshots(requestedIds, tables),
        { sourceVersion: metadata.dbVersion },
    );
    const newProjections = requestedProjections.filter(projection => options.newCardIds.includes(projection.id));
    const releaseRootProjections = requestedProjections.filter(projection =>
        options.releaseStateCardIds.includes(projection.id));
    const newRelatedIds = [...new Set(
        newProjections.flatMap(projection => projection.transformations.map(item => item.id)),
    )];
    const releaseRelatedIds = [...new Set(
        releaseRootProjections.flatMap(projection => projection.transformations.map(item => item.id)),
    )];
    const relatedIds = [...new Set([...newRelatedIds, ...releaseRelatedIds])];
    const relatedProjections = relatedIds.length > 0
        ? projectGameDbCharactersToDokkanpanion(
            buildGameDbCharacterSnapshots(relatedIds, tables),
            { sourceVersion: metadata.dbVersion },
        )
        : [];
    const newRelatedIdSet = new Set(newRelatedIds);
    const releaseRelatedIdSet = new Set(releaseRelatedIds);
    const allMaterializedProjections = [
        ...newProjections,
        ...relatedProjections.filter(projection => newRelatedIdSet.has(projection.id)),
    ];
    const projectionById = new Map(allMaterializedProjections.map(projection => [projection.id, projection]));
    if (projectionById.size !== allMaterializedProjections.length) throw new Error("duplicate new/form projection ID");
    const portraits = await materializePortraits(allMaterializedProjections, options);

    const releaseProjections = mergeReleaseProjections(
        releaseRootProjections,
        relatedProjections.filter(projection => releaseRelatedIdSet.has(projection.id)),
    );
    const releaseOverlay = options.releaseStateCardIds.length > 0
        ? overlayGameDbCharacterReleaseStates(
            baseline.characters,
            releaseProjections,
            options.releaseStateCardIds,
        )
        : { characters: baseline.characters, patches: [], checks: undefined };
    const officialCategories = resolveOfficialCategoryAssignments(tables, options.categoryIds);
    const categories = applyAdditiveCategoryAssignments(
        releaseOverlay.characters,
        officialCategories.assignments,
    );
    const existingIds = new Set(categories.characters.map(character => character.id));
    for (const cardId of options.newCardIds) {
        if (existingIds.has(cardId)) throw new Error(`new card ${cardId} already exists in the baseline`);
    }
    const addedCharacters = newProjections
        .map(projection => materializeGameDbCharacter(projection, projectionById, portraits.portraitById))
        .map(character => ({
            ...character,
            categories: [...character.categories].sort((left, right) => left.localeCompare(right)),
        }))
        .sort((left, right) => Number(left.id) - Number(right.id));
    const passiveModeInputCharacters = [...categories.characters, ...addedCharacters];
    const passiveModeFormIds = selectDeliveredPassiveModeFormIds(passiveModeInputCharacters, tables);
    const passiveModeProjections = passiveModeFormIds.length > 0
        ? projectGameDbCharactersToDokkanpanion(
            buildGameDbCharacterSnapshots(passiveModeFormIds, tables),
            { sourceVersion: metadata.dbVersion },
        )
        : [];
    const passiveModes = overlayGameDbCharacterPassiveModes(
        passiveModeInputCharacters,
        passiveModeProjections,
    );
    const generatedAt = new Date().toISOString();
    const laneCharacters = buildCreatedDomainEnrichedLaneCharacterArtifact(
        passiveModes.characters,
        createdDomainProjection,
        generatedAt,
    );
    const characters = laneCharacters.characters;
    const artifact = laneCharacters.artifact;
    await writeCharacterDatasetBundle(options.outputDir, artifact, { manifestFileName: "characters-manifest.json" });

    const nameIdentityContract = buildGameDbNameIdentityContract(tables);
    const cardIdentityContract = buildGameDbCardIdentityContract(tables);
    const activeSkillActivationContract = buildGameDbActiveSkillActivationContract(tables);
    const transformationActivationContract = buildGameDbTransformationActivationContract(tables);
    const teamAnalysis = await runFyiTeamAnalysis({
        outputDir: resolve(options.outputDir, "team-analysis"),
        characterDatasetPath: resolve(options.outputDir, artifact.manifest.fileName),
        characterManifestPath: resolve(options.outputDir, "characters-manifest.json"),
        catalogPath: options.catalogPath,
        nameIdentityContract,
        cardIdentityContract,
        activeSkillActivationContract,
        transformationActivationContract,
    });
    const teamManifest = JSON.parse(await readFile(teamAnalysis.manifestPath, "utf8")) as TeamAnalysisManifest;
    assertTeamAnalysisBoundToCharacterArtifact(teamManifest, artifact.manifest);

    const androidV1Projection = options.contractLane === "v1"
        ? await runAndroidV1ContractProjector({
            charactersManifestPath: resolve(options.outputDir, "characters-manifest.json"),
            charactersPayloadPath: resolve(options.outputDir, artifact.manifest.fileName),
            teamAnalysisManifestPath: teamAnalysis.manifestPath,
            teamAnalysisPayloadPath: teamAnalysis.datasetPath,
            outputDir: resolve(options.outputDir, "projected-v1"),
        })
        : undefined;
    const outputManifest = androidV1Projection?.output.characters ?? artifact.manifest;
    const outputTeamManifest = androidV1Projection?.output.teamAnalysis ?? teamManifest;

    const firstPartyInventoryAfter = await inventorySourceFiles(
        firstPartyDataDir,
        FIRST_PARTY_EXPORT_GAME_DB_TABLES.map(table => `${table}.csv`),
    );
    if (firstPartyInventory.inventorySha256 !== firstPartyInventoryAfter.inventorySha256
        || JSON.stringify(firstPartyInventory.entries) !== JSON.stringify(firstPartyInventoryAfter.entries)) {
        throw new Error("first-party export inventory changed during lane refresh generation");
    }
    const metadataInventoryAfter = await inventorySourceFiles(options.firstPartyDir, ["metadata.json"]);
    if (metadataInventory.inventorySha256 !== metadataInventoryAfter.inventorySha256) {
        throw new Error("first-party export metadata changed during lane refresh generation");
    }

    await writeFormattedJson(resolve(options.outputDir, "lane-refresh-report.json"), {
        schemaVersion: 1,
        contract: "dokkan-game-db-lane-refresh-candidate",
        contractVersion: "1.0.0",
        generatedAt,
        contractLane: options.contractLane,
        source: {
            kind: "first-party-game-db-over-production-lane-baseline",
            noWebsiteScraping: true,
            dbVersion: metadata.dbVersion,
            assetVersion: metadata.assetVersion,
            apkVersion: metadata.apkVersion,
            baselineDatasetVersion: baseline.manifest.datasetVersion,
            baselinePayloadSha256: baseline.manifest.sha256,
            baselineCharacterCount: baseline.manifest.characterCount,
            metadataIdentity: inventoryReport(metadataInventory).entries[0],
            tableInventory: inventoryReport(firstPartyInventory),
            portraitInputInventory: portraits.sourceInventory,
        },
        officialCategoryTargets: officialCategories.identities,
        additions: addedCharacters.map(character => ({
            id: character.id,
            name: character.name,
            title: character.title,
            relatedFormIds: character.transformations?.map(form => form.id) ?? [],
        })),
        releaseStatePatches: releaseOverlay.patches,
        passiveModeCoverage: {
            sourceColumns: [
                "passive_skill_sets.sougou_only_itemized_description",
                "passive_skill_sets.kobetu_only_itemized_description",
            ],
            selectedFormIds: passiveModeFormIds,
            ...passiveModes.coverage,
            patches: passiveModes.patches,
            checks: passiveModes.checks,
        },
        createdDomainEnrichment: {
            status: "snapshot-audited",
            sourceSnapshotId: createdDomainProjection.sourceSnapshotId,
            linkCount: Object.keys(createdDomainProjection.byActiveSkillSetId).length,
            patches: laneCharacters.patches,
        },
        additiveCategoryPatches: categories.patches,
        portraitAssets: portraits.assets,
        canonicalOutput: artifact.manifest,
        canonicalTeamAnalysis: teamManifest,
        output: outputManifest,
        teamAnalysis: outputTeamManifest,
        laneProjection: androidV1Projection
            ? {
                kind: "android-v1-frozen-contract-projector",
                projectorVersion: androidV1Projection.projectorVersion,
                consumerCommit: androidV1Projection.consumerCommit,
                changes: androidV1Projection.changes,
                files: androidV1Projection.files,
            }
            : { kind: "native-v2-contract" },
        readiness: {
            candidateGenerated: "GO",
            pairBound: "GO",
            laneProjection: "GO",
            consumerCompatibility: "NO-GO",
            remoteDryRun: "NO-GO",
            publication: "NO-GO",
        },
    });
}

async function main(): Promise<void> {
    await buildGameDbLaneRefreshCandidate(parseGameDbLaneRefreshArgs(process.argv.slice(2)));
    console.log(JSON.stringify({ status: "ok" }, null, 2));
}

if (require.main === module) {
    main().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
