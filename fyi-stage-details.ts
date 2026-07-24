import { existsSync } from "fs";
import { mkdir, readFile, writeFile } from "fs/promises";
import { resolve } from "path";
import { StageDetail, StageDetailAsset, StageDetailEnemy, StageDetailImages, StageDetailSkill, StageDetailsDataset } from "./stage-detail";
import { writeFormattedJson } from "./format-json";

const DOKKAN_FYI_BASE_URL = "https://dokkan.fyi";
const DOKKAN_FYI_CDN_BASE_URL = "https://cdn.dokkan.fyi/assets";
const STAGE_DETAIL_ASSET_ROOT = "data/stage-details/assets";
const DEFAULT_STAGE_IDS = [
    "17380223",
    "17380233",
    "17380243",
    "17380253",
    "17380264",
    "17380274",
];

export interface FyiStageDetailPagePayload {
    component: string,
    props: {
        stage: FyiStageDetail,
    },
}

export interface FyiStageDetail {
    id: number,
    difficulty?: string | null,
    stamina?: number | null,
    required_keys?: number | null,
    rank_exp?: number | null,
    zeni?: number | null,
    link_skill_level_up_rate?: number | null,
    quest_id?: number | null,
    quest?: FyiStageQuestDetail | null,
    enemies?: FyiStageEnemy[] | null,
}

interface FyiStageQuestDetail {
    id: number,
    name?: string | null,
    start_date?: string | null,
    area_id?: number | null,
    area?: FyiStageAreaDetail | null,
}

interface FyiStageAreaDetail {
    id: number,
    name?: string | null,
    type?: string | null,
    images?: FyiStageAreaImages | null,
}

interface FyiStageAreaImages {
    header?: string | null,
    banner?: string | null,
    button?: string | null,
}

interface FyiStageEnemy {
    id: number,
    battle?: number | null,
    tile?: number | null,
    character_id?: number | null,
    character?: FyiStageEnemyCharacter | null,
    hp?: number | null,
    atk?: number | null,
    def?: number | null,
    skills?: FyiStageSkill[] | null,
    turn_attacks?: number | null,
}

interface FyiStageEnemyCharacter {
    name?: string | null,
    rarity_text?: string | null,
    type_text?: string | null,
    thumbnail_id?: number | null,
}

interface FyiStageSkill {
    type?: number | null,
    values?: Array<number | null> | null,
    target?: number | null,
    calculation?: number | null,
    turns?: number | null,
    chance?: number | null,
    name?: string | null,
    description?: string | null,
}

export async function getDokkanFyiStageDetails(stageIds = requestedStageIds()): Promise<StageDetailsDataset> {
    const ids = uniqueStageIds(stageIds);
    const entries = await mapWithConcurrency(ids, requestedStageDetailConcurrency(), async id => {
        const payload = await fetchStageDetailPage(id);
        return mapStageDetailFromFyi(payload.props.stage);
    });

    return {
        generatedAt: new Date().toISOString(),
        source: "dokkan.fyi",
        count: entries.length,
        entries: entries.sort((left, right) => left.id.localeCompare(right.id)),
    };
}

export async function writeDokkanFyiStageDetails(dataset: StageDetailsDataset): Promise<string> {
    const outputDir = resolve(__dirname, "data/stage-details/latest");
    const outputPath = resolve(outputDir, "stage-details.json");
    await mkdir(outputDir, { recursive: true });
    await writeFormattedJson(outputPath, dataset);
    return outputPath;
}

export function localizeStageDetailAssets(dataset: StageDetailsDataset): StageDetailsDataset {
    const assets = collectStageDetailAssets(dataset);
    const byRemoteUrl = new Map(assets.map(asset => [asset.remoteUrl, asset]));
    const localize = (asset: StageDetailAsset | undefined): StageDetailAsset | undefined => {
        if (!asset) return undefined;
        return byRemoteUrl.get(asset.remoteUrl) ?? asset;
    };

    return {
        ...dataset,
        entries: dataset.entries.map(entry => ({
            ...entry,
            images: {
                header: localize(entry.images.header),
                banner: localize(entry.images.banner),
                button: localize(entry.images.button),
            },
            enemies: entry.enemies.map(enemy => ({
                ...enemy,
                portrait: localize(enemy.portrait),
            })),
        })),
    };
}

export function removeUnmirroredStageDetailAssets(
    dataset: StageDetailsDataset,
    failedRemoteUrls: string[],
    projectRoot?: string,
): StageDetailsDataset {
    const failed = new Set(failedRemoteUrls);
    const keepAsset = (asset: StageDetailAsset | undefined): StageDetailAsset | undefined => {
        const localFileMissing = projectRoot && asset?.localPath && !existsSync(resolve(projectRoot, asset.localPath));
        if (!asset || failed.has(asset.remoteUrl) || localFileMissing) {
            return asset ? { remoteUrl: asset.remoteUrl } : undefined;
        }
        return asset;
    };

    return {
        ...dataset,
        entries: dataset.entries.map(entry => ({
            ...entry,
            images: {
                header: keepAsset(entry.images.header),
                banner: keepAsset(entry.images.banner),
                button: keepAsset(entry.images.button),
            },
            enemies: entry.enemies.map(enemy => ({
                ...enemy,
                portrait: keepAsset(enemy.portrait),
            })),
        })),
    };
}

export function mapStageDetailFromFyi(stage: FyiStageDetail): StageDetail {
    const quest = stage.quest;
    const area = quest?.area;

    return {
        id: stage.id.toString(),
        difficulty: cleanText(stage.difficulty),
        stamina: toNumber(stage.stamina),
        requiredKeys: toNumber(stage.required_keys),
        rankExp: toNumber(stage.rank_exp),
        zeni: toNumber(stage.zeni),
        linkSkillLevelUpRate: toNumber(stage.link_skill_level_up_rate),
        questId: toNumber(stage.quest_id ?? quest?.id).toString(),
        questName: cleanText(quest?.name),
        areaId: toNumber(quest?.area_id ?? area?.id).toString(),
        areaName: cleanText(area?.name),
        areaType: cleanText(area?.type),
        startDate: normalizeDate(quest?.start_date),
        images: mapStageDetailImages(area),
        enemies: (stage.enemies ?? []).map(mapStageDetailEnemy),
    };
}

export function mapStageDetailImages(area: FyiStageAreaDetail | null | undefined): StageDetailImages {
    return {
        header: imageAsset(area?.images?.header),
        banner: imageAsset(area?.images?.banner),
        button: imageAsset(area?.images?.button),
    };
}

function mapStageDetailEnemy(enemy: FyiStageEnemy): StageDetailEnemy {
    const character = enemy.character;
    const thumbnailId = toOptionalString(character?.thumbnail_id);

    return {
        id: enemy.id.toString(),
        battle: toNumber(enemy.battle),
        tile: toNumber(enemy.tile),
        characterId: toNumber(enemy.character_id).toString(),
        name: cleanText(character?.name),
        rarity: cleanText(character?.rarity_text) || undefined,
        type: cleanText(character?.type_text) || undefined,
        thumbnailId,
        portrait: thumbnailId ? imageAsset(portraitPath(thumbnailId)) : undefined,
        hp: toNumber(enemy.hp),
        atk: toNumber(enemy.atk),
        def: toNumber(enemy.def),
        skills: (enemy.skills ?? []).map(mapStageDetailSkill),
        turnAttacks: toOptionalNumber(enemy.turn_attacks),
    };
}

function mapStageDetailSkill(skill: FyiStageSkill): StageDetailSkill {
    return {
        type: toOptionalNumber(skill.type),
        values: (skill.values ?? []).map(value => value === null ? null : toNumber(value)),
        target: toOptionalNumber(skill.target),
        calculation: toOptionalNumber(skill.calculation),
        turns: toOptionalNumber(skill.turns),
        chance: toOptionalNumber(skill.chance),
        name: cleanText(skill.name) || undefined,
        description: cleanText(skill.description) || undefined,
    };
}

export async function mirrorStageDetailAssets(
    dataset: StageDetailsDataset,
    projectRoot = process.cwd(),
): Promise<{ targetCount: number, downloadedCount: number, failedUrls: string[] }> {
    const assets = collectStageDetailAssets(dataset);
    const failedUrls: string[] = [];
    let downloadedCount = 0;

    await mapWithConcurrency(assets, requestedAssetConcurrency(), async asset => {
        const outputPath = resolve(projectRoot, asset.localPath as string);
        await mkdir(resolve(outputPath, ".."), { recursive: true });
        try {
            const response = await fetch(asset.remoteUrl, { headers: browserHeaders() });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const buffer = Buffer.from(await response.arrayBuffer());
            await writeFileIfMissingOrChanged(outputPath, buffer);
            downloadedCount += 1;
        } catch (error) {
            failedUrls.push(asset.remoteUrl);
        }
    });

    return {
        targetCount: assets.length,
        downloadedCount,
        failedUrls: failedUrls.sort(),
    };
}

export function collectStageDetailAssets(dataset: StageDetailsDataset, localizedOnly = false): StageDetailAsset[] {
    const assets = new Map<string, StageDetailAsset>();
    for (const entry of dataset.entries) {
        addAsset(assets, entry.images.header, `areas/${entry.areaId}/header.png`, localizedOnly);
        addAsset(assets, entry.images.banner, `areas/${entry.areaId}/banner.png`, localizedOnly);
        addAsset(assets, entry.images.button, `areas/${entry.areaId}/button.png`, localizedOnly);
        for (const enemy of entry.enemies) {
            if (enemy.thumbnailId) {
                addAsset(assets, enemy.portrait, `portraits/${enemy.thumbnailId}.png`, localizedOnly);
            }
        }
    }
    return [...assets.values()].sort((left, right) => left.objectKey!.localeCompare(right.objectKey!));
}

async function fetchStageDetailPage(stageId: string): Promise<FyiStageDetailPagePayload> {
    const response = await fetch(`${DOKKAN_FYI_BASE_URL}/stages/${stageId}`, { headers: browserHeaders() });
    if (!response.ok) {
        throw new Error(`Could not fetch dokkan.fyi stage ${stageId}: ${response.status}`);
    }
    const html = await response.text();
    const match = html.match(/<script data-page="app" type="application\/json">([\s\S]*?)<\/script>/);
    if (!match?.[1]) {
        throw new Error(`Could not find stage payload for ${stageId}.`);
    }
    return JSON.parse(match[1]) as FyiStageDetailPagePayload;
}

function addAsset(
    assets: Map<string, StageDetailAsset>,
    asset: StageDetailAsset | undefined,
    relativePath: string,
    localizedOnly: boolean,
): void {
    if (!asset || assets.has(asset.remoteUrl) || (localizedOnly && (!asset.localPath || !asset.objectKey))) return;
    const localPath = asset.localPath ?? `${STAGE_DETAIL_ASSET_ROOT}/${relativePath}`;
    assets.set(asset.remoteUrl, {
        ...asset,
        localPath,
        objectKey: asset.objectKey ?? localPath.replace(/^data\//, ""),
    });
}

function imageAsset(path: string | null | undefined): StageDetailAsset | undefined {
    const normalized = cleanText(path);
    if (!normalized) return undefined;
    return {
        remoteUrl: /^https?:\/\//i.test(normalized)
            ? normalized
            : `${DOKKAN_FYI_CDN_BASE_URL}/${normalized.replace(/^\/+/, "")}`,
    };
}

function portraitPath(thumbnailId: string): string {
    return `${DOKKAN_FYI_CDN_BASE_URL}/en/character/thumb/card_${thumbnailId}_thumb/card_${thumbnailId}_thumb.png`;
}

function requestedStageIds(): string[] {
    const configured = process.env.DOKKAN_FYI_STAGE_DETAIL_IDS;
    return configured ? uniqueStageIds(configured.split(/[\s,]+/)) : DEFAULT_STAGE_IDS;
}

function requestedStageDetailConcurrency(): number {
    return positiveInteger(process.env.DOKKAN_FYI_STAGE_DETAIL_CONCURRENCY, 3);
}

function requestedAssetConcurrency(): number {
    return positiveInteger(process.env.DOKKAN_FYI_STAGE_ASSET_CONCURRENCY, 4);
}

function positiveInteger(value: string | undefined, fallback: number): number {
    const parsed = Number.parseInt(value ?? "", 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function uniqueStageIds(ids: string[]): string[] {
    return [...new Set(ids.map(id => id.trim()).filter(id => /^\d+$/.test(id)))];
}

function cleanText(value: string | number | null | undefined): string {
    return value === null || value === undefined
        ? ""
        : value.toString().replace(/\s+/g, " ").trim();
}

function toNumber(value: number | string | null | undefined): number {
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    const parsed = Number.parseInt(value ?? "", 10);
    return Number.isFinite(parsed) ? parsed : 0;
}

function toOptionalNumber(value: number | string | null | undefined): number | undefined {
    if (value === null || value === undefined || value === "") return undefined;
    const parsed = toNumber(value);
    return Number.isFinite(parsed) ? parsed : undefined;
}

function toOptionalString(value: number | string | null | undefined): string | undefined {
    const normalized = cleanText(value);
    return normalized || undefined;
}

function normalizeDate(value: string | null | undefined): string | undefined {
    const normalized = cleanText(value);
    if (!normalized) return undefined;
    const date = new Date(normalized.includes("T") ? normalized : normalized.replace(" ", "T") + "Z");
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function browserHeaders(): Record<string, string> {
    return {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/148.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
    };
}

async function writeFileIfMissingOrChanged(path: string, buffer: Buffer): Promise<void> {
    try {
        const existing = await readFile(path);
        if (existing.equals(buffer)) return;
    } catch {
        // The asset does not exist yet.
    }
    await writeFile(path, buffer);
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, mapper: (item: T) => Promise<R>): Promise<R[]> {
    const results: R[] = [];
    let nextIndex = 0;
    async function worker() {
        while (true) {
            const index = nextIndex++;
            if (index >= items.length) return;
            results[index] = await mapper(items[index]);
        }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
    return results;
}
