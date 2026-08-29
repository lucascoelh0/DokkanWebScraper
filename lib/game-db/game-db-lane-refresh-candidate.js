"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildGameDbLaneRefreshCandidate = exports.applyAdditiveCategoryAssignments = exports.resolveOfficialCategoryAssignments = exports.parseGameDbLaneRefreshArgs = void 0;
const crypto_1 = require("crypto");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const zlib_1 = require("zlib");
const android_v1_contract_projector_run_1 = require("../android-v1-contract-projector-run");
const dataset_artifacts_1 = require("../dataset-artifacts");
const format_json_1 = require("../format-json");
const fyi_team_analysis_run_1 = require("../fyi-team-analysis-run");
const game_db_active_skill_1 = require("./game-db-active-skill");
const game_db_app_projection_1 = require("./game-db-app-projection");
const game_db_character_materializer_1 = require("./game-db-character-materializer");
const game_db_character_release_candidate_1 = require("./game-db-character-release-candidate");
const game_db_character_release_overlay_1 = require("./game-db-character-release-overlay");
const game_db_experiment_1 = require("./game-db-experiment");
const game_db_name_identity_1 = require("./game-db-name-identity");
const first_party_portrait_compositor_1 = require("./first-party-portrait-compositor");
const game_db_source_1 = require("./game-db-source");
const game_db_table_inventory_1 = require("./game-db-table-inventory");
const game_db_transformation_activation_1 = require("./game-db-transformation-activation");
function csvList(value, option, allowEmpty = false) {
    const values = value?.split(",").map(item => item.trim()).filter(Boolean) ?? [];
    if ((!allowEmpty && values.length === 0) || new Set(values).size !== values.length) {
        throw new Error(`${option} must contain unique comma-separated values`);
    }
    return values;
}
function parseGameDbLaneRefreshArgs(args) {
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
    const values = new Map();
    for (let index = 0; index < args.length; index += 1) {
        const token = args[index];
        if (!supported.has(token))
            throw new Error(`unsupported lane refresh argument ${token}`);
        if (values.has(token))
            throw new Error(`duplicate lane refresh argument ${token}`);
        const value = args[++index];
        if (!value || value.startsWith("--"))
            throw new Error(`missing value for ${token}`);
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
    const newCardIds = csvList(values.get("--new-card-ids"), "--new-card-ids");
    const releaseStateCardIds = csvList(values.get("--release-state-card-ids"), "--release-state-card-ids", true);
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
        firstPartyDir: (0, path_1.resolve)(firstPartyDir),
        portraitAssetsDir: (0, path_1.resolve)(portraitAssetsDir),
        newCardIds,
        releaseStateCardIds,
        categoryIds,
        baselineDir: (0, path_1.resolve)(baselineDir),
        outputDir: (0, path_1.resolve)(outputDir),
        catalogPath: (0, path_1.resolve)(values.get("--catalog") ?? "data/fyi-character-catalog/latest/character-catalog.json"),
    };
}
exports.parseGameDbLaneRefreshArgs = parseGameDbLaneRefreshArgs;
function sha256(bytes) {
    return (0, crypto_1.createHash)("sha256").update(bytes).digest("hex");
}
function isStrictlyContained(root, target) {
    const child = (0, path_1.relative)((0, path_1.resolve)(root), (0, path_1.resolve)(target));
    return child.length > 0 && child !== ".." && !child.startsWith(`..${path_1.sep}`) && !(0, path_1.isAbsolute)(child);
}
async function inventorySourceFiles(root, relativePaths) {
    const canonicalRoot = await (0, promises_1.realpath)(root);
    const paths = [...new Set(relativePaths)].sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
    const entries = [];
    const bytesByPath = new Map();
    for (const path of paths) {
        const normalized = path.replace(/\\/g, "/");
        if (!normalized || normalized.startsWith("/")
            || normalized.split("/").some(part => !part || part === "." || part === "..")) {
            throw new Error(`source inventory contains an unsafe path: ${path}`);
        }
        const sourcePath = (0, path_1.resolve)(canonicalRoot, ...normalized.split("/"));
        const [canonicalFile, identity] = await Promise.all([(0, promises_1.realpath)(sourcePath), (0, promises_1.lstat)(sourcePath)]);
        if (!identity.isFile() || identity.isSymbolicLink() || !isStrictlyContained(canonicalRoot, canonicalFile)) {
            throw new Error(`source inventory member is not a contained regular file: ${normalized}`);
        }
        const bytes = await (0, promises_1.readFile)(canonicalFile);
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
function inventoryReport(inventory) {
    const { bytesByPath: _bytesByPath, ...report } = inventory;
    return report;
}
function loadInventoriedGameDbTables(inventory) {
    const tableNames = [...game_db_experiment_1.REQUIRED_GAME_DB_TABLES, ...game_db_table_inventory_1.SUPER_ATTACK_EFFECT_GAME_DB_TABLES];
    return Object.fromEntries(tableNames.map(tableName => {
        const path = `${tableName}.csv`;
        const bytes = inventory.bytesByPath.get(path);
        if (!bytes)
            throw new Error(`inventoried first-party table is missing: ${path}`);
        return [tableName, (0, game_db_source_1.parseGameDbTableCsvText)(bytes.toString("utf8"))];
    }));
}
async function readBaseline(directory) {
    const manifest = JSON.parse(await (0, promises_1.readFile)((0, path_1.resolve)(directory, "characters-manifest.json"), "utf8"));
    const payload = await (0, promises_1.readFile)((0, path_1.resolve)(directory, (0, path_1.basename)(manifest.fileName)));
    if (manifest.schemaVersion !== 1 || manifest.compression !== "gzip"
        || manifest.sizeBytes !== payload.length || manifest.sha256 !== sha256(payload)) {
        throw new Error("baseline Character manifest does not match its payload");
    }
    const raw = (0, zlib_1.gunzipSync)(payload);
    const characters = JSON.parse(raw.toString("utf8"));
    if (raw.length !== manifest.uncompressedSizeBytes || characters.length !== manifest.characterCount) {
        throw new Error("baseline Character payload does not match its manifest counts");
    }
    return { characters, manifest };
}
function resolveOfficialCategoryAssignments(tables, categoryIds) {
    const requested = new Set(categoryIds);
    const nameById = new Map();
    for (const row of tables.card_categories ?? []) {
        const id = (0, game_db_source_1.normalizeDbId)(row.id);
        const name = row.name?.trim();
        if (!id || !requested.has(id))
            continue;
        if (!name)
            throw new Error(`game DB category ID ${id} has no display name`);
        if (nameById.has(id))
            throw new Error(`duplicate game DB category ID ${id}`);
        nameById.set(id, name);
    }
    for (const categoryId of requested) {
        if (!nameById.has(categoryId))
            throw new Error(`game DB category ID ${categoryId} was not found`);
    }
    const identities = [...nameById].map(([categoryId, name]) => ({ categoryId, name }))
        .sort((left, right) => Number(left.categoryId) - Number(right.categoryId));
    if (new Set(identities.map(identity => identity.name)).size !== identities.length) {
        throw new Error("requested game DB category IDs do not have unique display names");
    }
    const assignments = new Map();
    for (const row of tables.card_card_categories ?? []) {
        const cardId = (0, game_db_source_1.normalizeDbId)(row.card_id);
        const categoryId = (0, game_db_source_1.normalizeDbId)(row.card_category_id);
        const categoryName = categoryId ? nameById.get(categoryId) : undefined;
        if (!cardId || !categoryName)
            continue;
        const categories = assignments.get(cardId) ?? [];
        if (!categories.some(category => category.categoryId === categoryId)) {
            categories.push({ categoryId: categoryId, name: categoryName });
        }
        assignments.set(cardId, categories);
    }
    for (const categories of assignments.values()) {
        categories.sort((left, right) => Number(left.categoryId) - Number(right.categoryId));
    }
    return { identities, assignments };
}
exports.resolveOfficialCategoryAssignments = resolveOfficialCategoryAssignments;
function applyAdditiveCategoryAssignments(characters, assignments) {
    const cloned = JSON.parse(JSON.stringify(characters));
    const patches = [];
    for (const character of cloned) {
        const assigned = assignments.get(character.id);
        if (!assigned?.length)
            continue;
        const current = new Set(character.categories);
        const addedCategories = assigned.filter(category => !current.has(category.name));
        if (addedCategories.length === 0)
            continue;
        character.categories = [...current, ...addedCategories.map(category => category.name)]
            .sort((left, right) => left.localeCompare(right));
        patches.push({ cardId: character.id, addedCategories });
    }
    return {
        characters: cloned,
        patches: patches.sort((left, right) => Number(left.cardId) - Number(right.cardId)),
    };
}
exports.applyAdditiveCategoryAssignments = applyAdditiveCategoryAssignments;
async function writeContentAddressedAsset(outputRoot, objectKey, bytes) {
    const path = (0, path_1.resolve)(outputRoot, ...objectKey.split("/"));
    await (0, promises_1.mkdir)((0, path_1.resolve)(path, ".."), { recursive: true });
    await (0, promises_1.writeFile)(path, bytes, { flag: "wx" }).catch(async (error) => {
        if (error.code !== "EEXIST")
            throw error;
        const existing = await (0, promises_1.readFile)(path);
        if (!existing.equals(bytes))
            throw new Error(`content-addressed asset collision at ${objectKey}`);
    });
}
async function materializePortraits(projections, options) {
    const outputRoot = (0, path_1.resolve)(options.outputDir, "objects");
    const portraitById = new Map();
    const assetsByKey = new Map();
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
        const artifacts = await (0, first_party_portrait_compositor_1.composeFirstPartyPortraitArtifacts)({
            background: sourceInventory.bytesByPath.get(backgroundPath),
            thumb: sourceInventory.bytesByPath.get(thumbPath),
            rarity: sourceInventory.bytesByPath.get(rarityPath),
            type: sourceInventory.bytesByPath.get(typePath),
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
        let portraitLayers;
        if (options.contractLane === "v2") {
            const layerEntries = [
                ["background", artifacts.portraitLayers.background],
                ["thumb", artifacts.portraitLayers.thumb],
                ["overlay", artifacts.portraitLayers.overlay],
            ];
            const layerUrls = new Map();
            for (const [kind, bytes] of layerEntries) {
                const digest = sha256(bytes);
                const objectKey = `${options.contractLane}/images/v5/layers/${kind}.${digest}.png`;
                await writeContentAddressedAsset(outputRoot, objectKey, bytes);
                assetsByKey.set(objectKey, { objectKey, sha256: digest, sizeBytes: bytes.length });
                layerUrls.set(kind, objectKey);
            }
            portraitLayers = {
                backgroundURL: layerUrls.get("background"),
                thumbURL: layerUrls.get("thumb"),
                overlayURL: layerUrls.get("overlay"),
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
async function buildGameDbLaneRefreshCandidate(options) {
    await (0, game_db_character_release_candidate_1.assertFreshCandidateOutput)(options.outputDir, options.baselineDir);
    const baseline = await readBaseline(options.baselineDir);
    const metadataInventory = await inventorySourceFiles(options.firstPartyDir, ["metadata.json"]);
    const metadataBytes = metadataInventory.bytesByPath.get("metadata.json");
    if (!metadataBytes)
        throw new Error("first-party export metadata was not inventoried");
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
    const firstPartyDataDir = (0, path_1.resolve)(options.firstPartyDir, "data");
    const firstPartyInventory = await inventorySourceFiles(firstPartyDataDir, game_db_table_inventory_1.FIRST_PARTY_EXPORT_GAME_DB_TABLES.map(table => `${table}.csv`));
    const tables = loadInventoriedGameDbTables(firstPartyInventory);
    const requestedIds = [...options.newCardIds, ...options.releaseStateCardIds];
    const requestedProjections = (0, game_db_app_projection_1.projectGameDbCharactersToDokkanpanion)((0, game_db_experiment_1.buildGameDbCharacterSnapshots)(requestedIds, tables), { sourceVersion: metadata.dbVersion });
    const newProjections = requestedProjections.filter(projection => options.newCardIds.includes(projection.id));
    const relatedIds = [...new Set(newProjections.flatMap(projection => projection.transformations.map(item => item.id)))];
    const relatedProjections = relatedIds.length > 0
        ? (0, game_db_app_projection_1.projectGameDbCharactersToDokkanpanion)((0, game_db_experiment_1.buildGameDbCharacterSnapshots)(relatedIds, tables), { sourceVersion: metadata.dbVersion })
        : [];
    const allMaterializedProjections = [...newProjections, ...relatedProjections];
    const projectionById = new Map(allMaterializedProjections.map(projection => [projection.id, projection]));
    if (projectionById.size !== allMaterializedProjections.length)
        throw new Error("duplicate new/form projection ID");
    const portraits = await materializePortraits(allMaterializedProjections, options);
    const releaseProjections = requestedProjections.filter(projection => options.releaseStateCardIds.includes(projection.id));
    const releaseOverlay = options.releaseStateCardIds.length > 0
        ? (0, game_db_character_release_overlay_1.overlayGameDbCharacterReleaseStates)(baseline.characters, releaseProjections, options.releaseStateCardIds)
        : { characters: baseline.characters, patches: [], checks: undefined };
    const officialCategories = resolveOfficialCategoryAssignments(tables, options.categoryIds);
    const categories = applyAdditiveCategoryAssignments(releaseOverlay.characters, officialCategories.assignments);
    const existingIds = new Set(categories.characters.map(character => character.id));
    for (const cardId of options.newCardIds) {
        if (existingIds.has(cardId))
            throw new Error(`new card ${cardId} already exists in the baseline`);
    }
    const addedCharacters = newProjections
        .map(projection => (0, game_db_character_materializer_1.materializeGameDbCharacter)(projection, projectionById, portraits.portraitById))
        .map(character => ({
        ...character,
        categories: [...character.categories].sort((left, right) => left.localeCompare(right)),
    }))
        .sort((left, right) => Number(left.id) - Number(right.id));
    const characters = [...categories.characters, ...addedCharacters];
    if (new Set(characters.map(character => character.id)).size !== characters.length) {
        throw new Error("lane refresh candidate contains duplicate Character IDs");
    }
    const generatedAt = new Date().toISOString();
    const artifact = (0, dataset_artifacts_1.buildCharacterDatasetArtifact)(characters, {
        datasetVersion: generatedAt,
        generatedAt,
        fileName: "characters.json.gz",
    });
    await (0, dataset_artifacts_1.writeCharacterDatasetBundle)(options.outputDir, artifact, { manifestFileName: "characters-manifest.json" });
    const nameIdentityContract = (0, game_db_name_identity_1.buildGameDbNameIdentityContract)(tables);
    const cardIdentityContract = (0, game_db_name_identity_1.buildGameDbCardIdentityContract)(tables);
    const activeSkillActivationContract = (0, game_db_active_skill_1.buildGameDbActiveSkillActivationContract)(tables);
    const transformationActivationContract = (0, game_db_transformation_activation_1.buildGameDbTransformationActivationContract)(tables);
    const teamAnalysis = await (0, fyi_team_analysis_run_1.runFyiTeamAnalysis)({
        outputDir: (0, path_1.resolve)(options.outputDir, "team-analysis"),
        characterDatasetPath: (0, path_1.resolve)(options.outputDir, artifact.manifest.fileName),
        characterManifestPath: (0, path_1.resolve)(options.outputDir, "characters-manifest.json"),
        catalogPath: options.catalogPath,
        nameIdentityContract,
        cardIdentityContract,
        activeSkillActivationContract,
        transformationActivationContract,
    });
    const teamManifest = JSON.parse(await (0, promises_1.readFile)(teamAnalysis.manifestPath, "utf8"));
    (0, game_db_character_release_candidate_1.assertTeamAnalysisBoundToCharacterArtifact)(teamManifest, artifact.manifest);
    const androidV1Projection = options.contractLane === "v1"
        ? await (0, android_v1_contract_projector_run_1.runAndroidV1ContractProjector)({
            charactersManifestPath: (0, path_1.resolve)(options.outputDir, "characters-manifest.json"),
            charactersPayloadPath: (0, path_1.resolve)(options.outputDir, artifact.manifest.fileName),
            teamAnalysisManifestPath: teamAnalysis.manifestPath,
            teamAnalysisPayloadPath: teamAnalysis.datasetPath,
            outputDir: (0, path_1.resolve)(options.outputDir, "projected-v1"),
        })
        : undefined;
    const outputManifest = androidV1Projection?.output.characters ?? artifact.manifest;
    const outputTeamManifest = androidV1Projection?.output.teamAnalysis ?? teamManifest;
    const firstPartyInventoryAfter = await inventorySourceFiles(firstPartyDataDir, game_db_table_inventory_1.FIRST_PARTY_EXPORT_GAME_DB_TABLES.map(table => `${table}.csv`));
    if (firstPartyInventory.inventorySha256 !== firstPartyInventoryAfter.inventorySha256
        || JSON.stringify(firstPartyInventory.entries) !== JSON.stringify(firstPartyInventoryAfter.entries)) {
        throw new Error("first-party export inventory changed during lane refresh generation");
    }
    const metadataInventoryAfter = await inventorySourceFiles(options.firstPartyDir, ["metadata.json"]);
    if (metadataInventory.inventorySha256 !== metadataInventoryAfter.inventorySha256) {
        throw new Error("first-party export metadata changed during lane refresh generation");
    }
    await (0, format_json_1.writeFormattedJson)((0, path_1.resolve)(options.outputDir, "lane-refresh-report.json"), {
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
exports.buildGameDbLaneRefreshCandidate = buildGameDbLaneRefreshCandidate;
async function main() {
    await buildGameDbLaneRefreshCandidate(parseGameDbLaneRefreshArgs(process.argv.slice(2)));
    console.log(JSON.stringify({ status: "ok" }, null, 2));
}
if (require.main === module) {
    main().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
//# sourceMappingURL=game-db-lane-refresh-candidate.js.map