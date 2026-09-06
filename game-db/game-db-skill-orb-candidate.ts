import { createHash } from "crypto";
import { mkdir, readFile, stat, writeFile } from "fs/promises";
import { dirname, resolve, sep } from "path";
import { gzipSync } from "zlib";
import { writeFormattedJson } from "../format-json";
import { renderEquipmentLevelAsset, EquipmentUiSourceManifest } from "./game-db-equipment-ui-assets";
import { GameDbSourceConfig, readGameDbTable } from "./game-db-source";
import {
    buildSkillOrbCatalog,
    computeAssetInventorySha256,
    PINNED_SKILL_ORB_PROFILE,
    requiredSkillOrbAssetPaths,
    SKILL_ORB_CONTRACT_VERSION,
    SkillOrbAssetEntry,
    SkillOrbAssetInventory,
    SkillOrbSourceTables,
} from "./game-db-skill-orb-catalog";

export const REQUIRED_SKILL_ORB_TABLES: Array<keyof SkillOrbSourceTables> = [
    "cards", "card_card_categories", "card_categories", "card_unique_infos", "card_unique_info_set_relations",
    "equipment_skill_items", "equipment_skill_limitations", "equipment_skills",
];

const PINNED_OFFICIAL_ASSET_ARCHIVES = [
    { path: "item-equipment.cpk", sizeBytes: 2153592, sha256: "a801c1352e3de1c15f65db44f0ed4e020dad486c220666cd53f7b1c87b653c14" },
    { path: "layout-item.cpk", sizeBytes: 2083936, sha256: "d93b462664f77242088618ec47b1f323164e695e405e748e8046b4c32fe53175" },
    { path: "layout-character.cpk", sizeBytes: 3593648, sha256: "8cd3d18c12ad805f1b192f80b7bb8a7d4a4e66dbdc4df33367810726346d457e" },
    { path: "layout-charamenu.cpk", sizeBytes: 4504104, sha256: "c1037dab8d05d97f179fbd8005715f65c79e976862550ef65c96d3c12e8e0ed3" },
] as const;

export const PINNED_SKILL_ORB_ASSET_INVENTORY = {
    assetCount: 196,
    totalBytes: 2153473,
    inventorySha256: "138f90f5203d19cff95eab005ff5d0863e838477234f250a0f6bf4d90d365cbf",
} as const;

export interface SkillOrbCandidateManifest {
    schemaVersion: 1,
    datasetVersion: string,
    parserVersion: string,
    snapshotVersion: string,
    sourceDatabaseSha256: string,
    assetBaseUrl?: string,
    payload: {
        objectKey: string,
        sizeBytes: number,
        sha256: string,
        contentType: "application/json",
        contentEncoding: "gzip",
        uncompressedSizeBytes: number,
        uncompressedSha256: string,
    },
    assets: {
        count: number,
        sizeBytes: number,
        inventorySha256: string,
    },
    counts: {
        items: number,
        effects: number,
        singleEffectItems: number,
        dualEffectItems: number,
        eternalItems: number,
        grades: { bronze: number, silver: number, gold: number },
        limitationSets: number,
        limitationRows: number,
        itemsByLimitationKind: Record<string, number>,
        limitationRowsByKind: Record<string, number>,
        exactCardReferences: number,
        exactUniqueCards: number,
        cardUniqueInfoSetLimitationRows: number,
        exactCardIndexKeys: number,
        familyEligibleCardIndexKeys: number,
        categoryEligibleCardIndexKeys: number,
        categoryEligibleCardReferences: number,
        foregroundIcons: number,
        levelCombinations: number,
        assets: number,
        assetBytes: number,
    },
}

interface CandidateOptions {
    sourceDataDir: string,
    snapshotVersion: string,
    sourceDatabaseSha256: string,
    officialAssetsRoot: string,
    officialCpkRoot: string,
    equipmentUiSourceDir: string,
    equipmentUiSourceManifestPath: string,
    outputDir: string,
    assetBaseUrl?: string,
}

function sha256(bytes: Buffer): string {
    return createHash("sha256").update(bytes).digest("hex");
}

function contained(root: string, relativePath: string): string {
    const normalized = relativePath.replace(/\\/g, "/");
    if (!normalized || normalized.startsWith("/") || normalized.split("/").some(value => !value || value === "." || value === "..")) throw new Error(`Unsafe Skill Orb asset path ${relativePath}`);
    const target = resolve(root, ...normalized.split("/"));
    if (!target.toLowerCase().startsWith(`${resolve(root)}${sep}`.toLowerCase())) throw new Error(`Skill Orb asset escapes root: ${relativePath}`);
    return target;
}

async function requireMissing(path: string): Promise<void> {
    try { await stat(path); throw new Error(`Skill Orb candidate output already exists: ${path}`); } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
}

async function loadTables(sourceDataDir: string): Promise<SkillOrbSourceTables> {
    const config: GameDbSourceConfig = { sourceRoot: sourceDataDir, dataDir: sourceDataDir };
    return Object.fromEntries(await Promise.all(REQUIRED_SKILL_ORB_TABLES.map(async table => [table, await readGameDbTable(config, table)] as const))) as unknown as SkillOrbSourceTables;
}

async function validatePinnedCpkRoot(root: string): Promise<void> {
    for (const expected of PINNED_OFFICIAL_ASSET_ARCHIVES) {
        const bytes = await readFile(contained(root, expected.path));
        if (bytes.byteLength !== expected.sizeBytes || sha256(bytes) !== expected.sha256) throw new Error(`Official Skill Orb CPK drifted: ${expected.path}`);
    }
}

async function validateEquipmentUiSource(sourceDir: string, manifest: EquipmentUiSourceManifest): Promise<Map<string, { bytes: Buffer, sourceFiles: string[] }>> {
    if (manifest.schemaVersion !== 2 || manifest.packageName !== "com.bandainamcogames.dbzdokkanww"
        || manifest.versionName !== "6.5.5" || manifest.databaseSnapshotVersion !== PINNED_SKILL_ORB_PROFILE.snapshotVersion
        || manifest.assetVersion !== "1788327754"
        || manifest.cpkReader.repository !== "https://github.com/Sewer56/CriFsV2Lib"
        || manifest.cpkReader.commit !== "169b001c748dfffc28c9fc14fcec269dd45e6eec") {
        throw new Error("Invalid official equipment UI source manifest identity");
    }
    for (const archive of manifest.archives) {
        const bytes = await readFile(contained(sourceDir, archive.path));
        if (bytes.byteLength !== archive.sizeBytes || sha256(bytes) !== archive.sha256) throw new Error(`Official equipment UI archive drifted: ${archive.path}`);
    }
    const result = new Map<string, { bytes: Buffer, sourceFiles: string[] }>();
    for (const file of manifest.files) {
        const bytes = await readFile(contained(sourceDir, file.path));
        if (bytes.byteLength !== file.sizeBytes || sha256(bytes) !== file.sha256) throw new Error(`Official equipment UI file drifted: ${file.path}`);
        const archive = manifest.archives.find(value => value.role === file.archiveRole);
        if (!archive) throw new Error(`Official equipment UI file ${file.path} references missing archive ${file.archiveRole}`);
        result.set(file.path, { bytes, sourceFiles: [archive.path, file.entryPath] });
    }
    return result;
}

function officialExtractedSource(path: string): { relativePath: string, sourceFiles: string[] } | undefined {
    const foreground = /^item\/equipment\/(equ_item_\d{5}\.png)$/.exec(path);
    if (foreground) return { relativePath: `item-equipment/${foreground[1]}`, sourceFiles: ["item-equipment.cpk", foreground[1]] };
    const background = /^layout\/en\/image\/item\/(equipment\/equipment_thumb_bg\/equ_base_(?:bronze|silver|gold)\.png)$/.exec(path);
    if (background) return { relativePath: `layout-item/${background[1]}`, sourceFiles: ["layout-item.cpk", background[1]] };
    const typeIcon = /^layout\/en\/image\/character\/(cha_type_icon_\d{2}\.png)$/.exec(path);
    if (typeIcon) return { relativePath: `layout-character/${typeIcon[1]}`, sourceFiles: ["layout-character.cpk", typeIcon[1]] };
    return undefined;
}

async function writeAsset(outputDir: string, path: string, bytes: Buffer): Promise<void> {
    const target = contained(outputDir, `game-assets/${path}`);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, bytes, { flag: "wx" });
}

export async function buildSkillOrbAssetInventory(options: {
    tables: SkillOrbSourceTables,
    officialAssetsRoot: string,
    officialCpkRoot: string,
    equipmentUiSourceDir: string,
    equipmentUiSourceManifest: EquipmentUiSourceManifest,
    outputDir: string,
}): Promise<SkillOrbAssetInventory> {
    await validatePinnedCpkRoot(options.officialCpkRoot);
    const uiFiles = await validateEquipmentUiSource(options.equipmentUiSourceDir, options.equipmentUiSourceManifest);
    const paths = requiredSkillOrbAssetPaths(options.tables);
    const categories = new Map<string, keyof typeof paths>();
    for (const [category, values] of Object.entries(paths) as Array<[keyof typeof paths, string[]]>) for (const path of values) {
        if (categories.has(path)) throw new Error(`Skill Orb asset belongs to multiple roles: ${path}`);
        categories.set(path, category);
    }
    const assets: SkillOrbAssetEntry[] = [];
    const fontPath = "fonts/en/black.otf";
    const singleBasePath = "layout/en/image/common/label/com_label_lv_02.png";
    const dualBasePath = "layout/en/image/charamenu/potential/equ_Lv_two.png";
    const font = uiFiles.get(fontPath), singleBase = uiFiles.get(singleBasePath), dualBase = uiFiles.get(dualBasePath);
    if (!font || !singleBase || !dualBase) throw new Error("Official equipment UI source is missing level renderer inputs");
    for (const path of [...categories.keys()].sort((left, right) => left.localeCompare(right, "en", { numeric: true }))) {
        const levelMatch = /^derived\/equipment\/levels\/lv-(\d+)(?:-(\d+))?\.png$/.exec(path);
        let bytes: Buffer;
        let provenance: SkillOrbAssetEntry["provenance"];
        let sourceFiles: string[];
        if (levelMatch) {
            const levels = [Number(levelMatch[1]), ...(levelMatch[2] ? [Number(levelMatch[2])] : [])];
            bytes = await renderEquipmentLevelAsset(contained(options.equipmentUiSourceDir, fontPath), singleBase.bytes, dualBase.bytes, levels);
            provenance = "official-cpk-derived";
            sourceFiles = [fontPath, levels.length === 2 ? dualBasePath : singleBasePath];
        } else {
            const uiFile = uiFiles.get(path);
            if (uiFile) {
                bytes = uiFile.bytes;
                sourceFiles = uiFile.sourceFiles;
            } else {
                const extracted = officialExtractedSource(path);
                if (!extracted) throw new Error(`No first-party Skill Orb asset source for ${path}`);
                bytes = await readFile(contained(options.officialAssetsRoot, extracted.relativePath));
                sourceFiles = extracted.sourceFiles;
            }
            provenance = "official-cpk";
        }
        if (!bytes.byteLength) throw new Error(`Empty first-party Skill Orb asset ${path}`);
        await writeAsset(options.outputDir, path, bytes);
        assets.push({ path, sizeBytes: bytes.byteLength, sha256: sha256(bytes), provenance, sourceFiles });
    }
    const counts = {
        foregroundIcons: paths.foregroundIcons.length,
        gradeBackgrounds: paths.gradeBackgrounds.length,
        levelAssets: paths.levelAssets.length,
        infinityAssets: paths.infinityAssets.length,
        restrictionBadges: paths.restrictionBadges.length,
        total: assets.length,
    };
    const inventory = { assets, counts, totalBytes: assets.reduce((sum, asset) => sum + asset.sizeBytes, 0), inventorySha256: computeAssetInventorySha256(assets) };
    if (inventory.assets.length !== PINNED_SKILL_ORB_ASSET_INVENTORY.assetCount
        || inventory.totalBytes !== PINNED_SKILL_ORB_ASSET_INVENTORY.totalBytes
        || inventory.inventorySha256 !== PINNED_SKILL_ORB_ASSET_INVENTORY.inventorySha256) {
        throw new Error(`Official Skill Orb asset inventory drifted: ${inventory.assets.length}/${inventory.totalBytes}/${inventory.inventorySha256}`);
    }
    return inventory;
}

export async function buildSkillOrbCandidate(options: CandidateOptions): Promise<{ manifest: SkillOrbCandidateManifest, outputDir: string }> {
    if (options.snapshotVersion !== PINNED_SKILL_ORB_PROFILE.snapshotVersion || options.sourceDatabaseSha256.toLowerCase() !== PINNED_SKILL_ORB_PROFILE.sourceDatabaseSha256) throw new Error("Skill Orb candidate source identity is not pinned");
    await requireMissing(options.outputDir);
    await mkdir(dirname(options.outputDir), { recursive: true });
    await mkdir(options.outputDir, { recursive: false });
    const tables = await loadTables(options.sourceDataDir);
    const equipmentUiSourceManifest = JSON.parse(await readFile(options.equipmentUiSourceManifestPath, "utf8")) as EquipmentUiSourceManifest;
    const assetInventory = await buildSkillOrbAssetInventory({ ...options, tables, equipmentUiSourceManifest });
    const catalog = buildSkillOrbCatalog({ snapshotVersion: options.snapshotVersion, sourceDatabaseSha256: options.sourceDatabaseSha256, tables, assetInventory });
    const rawBytes = Buffer.from(JSON.stringify(catalog), "utf8");
    const gzipBytes = gzipSync(rawBytes, { level: 9 });
    const payloadSha256 = sha256(gzipBytes);
    const objectKey = `equipment-skill-orbs/objects/${payloadSha256}.json.gz`;
    const objectPath = contained(options.outputDir, objectKey);
    await mkdir(dirname(objectPath), { recursive: true });
    await writeFile(objectPath, gzipBytes, { flag: "wx" });
    await writeFile(resolve(options.outputDir, "equipment-skill-orbs.json"), rawBytes, { flag: "wx" });
    await writeFormattedJson(resolve(options.outputDir, "equipment-skill-orb-assets-manifest.json"), {
        schemaVersion: 1,
        provenance: catalog.provenance,
        cpkReader: equipmentUiSourceManifest.cpkReader,
        archives: PINNED_OFFICIAL_ASSET_ARCHIVES,
        equipmentUiArchives: equipmentUiSourceManifest.archives,
        inventory: assetInventory,
    });
    const manifest: SkillOrbCandidateManifest = {
        schemaVersion: 1,
        datasetVersion: `${options.snapshotVersion}-${SKILL_ORB_CONTRACT_VERSION}-${payloadSha256.slice(0, 16)}`,
        parserVersion: SKILL_ORB_CONTRACT_VERSION,
        snapshotVersion: options.snapshotVersion,
        sourceDatabaseSha256: options.sourceDatabaseSha256.toLowerCase(),
        ...(options.assetBaseUrl ? { assetBaseUrl: options.assetBaseUrl.replace(/\/+$/, "") } : {}),
        payload: {
            objectKey, sizeBytes: gzipBytes.byteLength, sha256: payloadSha256,
            contentType: "application/json", contentEncoding: "gzip",
            uncompressedSizeBytes: rawBytes.byteLength, uncompressedSha256: sha256(rawBytes),
        },
        assets: { count: assetInventory.assets.length, sizeBytes: assetInventory.totalBytes, inventorySha256: assetInventory.inventorySha256 },
        counts: {
            items: catalog.items.length,
            effects: catalog.items.reduce((sum, item) => sum + item.effects.length, 0),
            singleEffectItems: catalog.items.filter(item => item.effects.length === 1).length,
            dualEffectItems: catalog.items.filter(item => item.effects.length === 2).length,
            eternalItems: catalog.items.filter(item => item.isEternal).length,
            grades: {
                bronze: catalog.items.filter(item => item.grade === "bronze").length,
                silver: catalog.items.filter(item => item.grade === "silver").length,
                gold: catalog.items.filter(item => item.grade === "gold").length,
            },
            limitationSets: catalog.limitationSets.length,
            limitationRows: catalog.limitationSets.reduce((sum, set) => sum + set.conditions.length, 0),
            itemsByLimitationKind: Object.fromEntries(["element", "category", "card", "card-unique-info-set"].map(kind => [kind, catalog.items.filter(item => catalog.limitationSets.find(set => set.id === item.limitationSetId)!.conditions[0].kind === kind).length])),
            limitationRowsByKind: Object.fromEntries(["element", "category", "card", "card-unique-info-set"].map(kind => [kind, catalog.limitationSets.flatMap(set => set.conditions).filter(condition => condition.kind === kind).length])),
            exactCardReferences: catalog.limitationSets.flatMap(set => set.conditions).filter(condition => condition.kind === "card").flatMap(condition => condition.cardIds ?? []).length,
            exactUniqueCards: Object.keys(catalog.indexes.exactCardId).length,
            cardUniqueInfoSetLimitationRows: catalog.limitationSets.flatMap(set => set.conditions).filter(condition => condition.kind === "card-unique-info-set").length,
            exactCardIndexKeys: Object.keys(catalog.indexes.exactCardId).length,
            familyEligibleCardIndexKeys: Object.keys(catalog.indexes.familyEligibleCardId).length,
            categoryEligibleCardIndexKeys: Object.keys(catalog.indexes.categoryEligibleCardId ?? {}).length,
            categoryEligibleCardReferences: Object.values(catalog.indexes.categoryEligibleCardId ?? {}).reduce((sum, ids) => sum + ids.length, 0),
            foregroundIcons: new Set(catalog.items.map(item => item.iconImageId)).size,
            levelCombinations: new Set(catalog.items.map(item => item.levelAssetPath)).size,
            assets: assetInventory.assets.length,
            assetBytes: assetInventory.totalBytes,
        },
    };
    await writeFormattedJson(resolve(options.outputDir, "equipment-skill-orbs-manifest.json"), manifest);
    return { manifest, outputDir: options.outputDir };
}

export function parseSkillOrbCandidateArgs(args: string[]): CandidateOptions {
    const supported = new Set(["--source-data-dir", "--snapshot-version", "--source-database-sha256", "--official-assets-root", "--official-cpk-root", "--equipment-ui-source-dir", "--equipment-ui-source-manifest", "--output-dir", "--asset-base-url"]);
    const values = new Map<string, string>();
    for (let index = 0; index < args.length; index += 1) {
        const token = args[index];
        const separator = token.indexOf("=");
        const key = separator >= 0 ? token.slice(0, separator) : token;
        if (!supported.has(key)) throw new Error(`Unexpected Skill Orb candidate argument: ${token}`);
        const value = separator >= 0 ? token.slice(separator + 1) : args[++index];
        if (!value || values.has(key)) throw new Error(`Missing or duplicate Skill Orb candidate argument: ${key}`);
        values.set(key, value);
    }
    for (const key of [...supported].filter(key => key !== "--asset-base-url")) if (!values.has(key)) throw new Error(`Missing Skill Orb candidate argument: ${key}`);
    const assetBaseUrl = values.get("--asset-base-url");
    if (assetBaseUrl && !/^https:\/\/[^\s]+$/.test(assetBaseUrl)) throw new Error("Skill Orb asset base URL must be HTTPS");
    return {
        sourceDataDir: resolve(values.get("--source-data-dir")!),
        snapshotVersion: values.get("--snapshot-version")!,
        sourceDatabaseSha256: values.get("--source-database-sha256")!,
        officialAssetsRoot: resolve(values.get("--official-assets-root")!),
        officialCpkRoot: resolve(values.get("--official-cpk-root")!),
        equipmentUiSourceDir: resolve(values.get("--equipment-ui-source-dir")!),
        equipmentUiSourceManifestPath: resolve(values.get("--equipment-ui-source-manifest")!),
        outputDir: resolve(values.get("--output-dir")!),
        ...(assetBaseUrl ? { assetBaseUrl } : {}),
    };
}

async function main(): Promise<void> {
    const result = await buildSkillOrbCandidate(parseSkillOrbCandidateArgs(process.argv.slice(2)));
    console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
