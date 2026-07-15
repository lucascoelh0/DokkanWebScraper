import { access, mkdir, readdir, readFile, rename, writeFile } from "fs/promises";
import { relative, resolve } from "path";
import { AcquisitionDataset, AcquisitionItem, AcquisitionSource } from "./acquisition";
import { AcquisitionNavigationDataset, AcquisitionNavigationTarget } from "./acquisition-navigation";
import { AcquisitionSourceEntry, AcquisitionSourceIndexDataset } from "./acquisition-source-index";
import {
    CharacterExclusiveSkillOrb,
    CharacterExclusiveSkillOrbAcquisition,
    Classes,
    Equipment,
    Rarities,
    Types,
} from "./character";
import {
    ExclusiveSkillOrbAcquisitionGroupEntry,
    ExclusiveSkillOrbAcquisitionSourceEntry,
    ExclusiveSkillOrbAcquisitionSummary,
    ExclusiveSkillOrbAssetRef,
    ExclusiveSkillOrbDetailsDataset,
    ExclusiveSkillOrbDetailsEntry,
    ExclusiveSkillOrbOwnerRef,
    ExclusiveSkillOrbPresentationAssets,
} from "./exclusive-skill-orb-details";
import { writeFormattedJson } from "./format-json";
import { MissionCatalogDataset, MissionCatalogGroup } from "./mission-catalog";
import { StageCatalogDataset, StageCatalogGroup } from "./stage-catalog";

const DOKKAN_FYI_BASE_URL = "https://dokkan.fyi";
const DOKKAN_FYI_CDN_URL = "https://cdn.dokkan.fyi";
const EXCLUSIVE_SKILL_ORB_OUTPUT_DIR = "data/exclusive-skill-orbs/latest";
const EXCLUSIVE_SKILL_ORB_ASSET_DIR = "data/exclusive-skill-orbs/assets";
const EXCLUSIVE_SKILL_ORB_ASSET_CONCURRENCY = 8;
const EXCLUSIVE_SKILL_ORB_CACHE_DIR = "data/exclusive-skill-orbs/cache";
const DEFAULT_DOKKAN_FYI_REQUEST_TIMEOUT_MS = 45_000;
const DEFAULT_CHARACTER_CACHE_TTL_HOURS = 24;

interface FyiPaginated<T> {
    data?: T[] | null,
    meta?: {
        current_page?: number | null,
        per_page?: number | null,
        from?: number | null,
        to?: number | null,
        last_page?: number | null,
    } | null,
}

interface FyiCharacterIndexPagePayload {
    version?: string,
    props: {
        characters?: FyiPaginated<FyiOrbCharacterIndexEntry>,
    },
}

interface FyiOrbCharacterPagePayload {
    version?: string,
    props: {
        character?: FyiOrbCharacter | null,
    },
}

interface FyiOrbCharacterIndexEntry {
    id: number,
}

interface FyiOrbCharacter {
    id: number,
    canonical_id?: number | null,
    base_character_id?: number | null,
    character_id?: number | null,
    name?: string | null,
    rarity?: number | null,
    rarity_text?: string | null,
    type?: number | null,
    type_text?: string | null,
    awakening_type?: number | null,
    awakening_type_text?: string | null,
    thumbnail_id?: number | null,
    has_eza?: boolean | null,
    has_seza?: boolean | null,
    is_reversibly_exchanged?: boolean | null,
    is_freely_obtainable?: boolean | null,
    release_dates?: {
        latest_type?: string | null,
    } | null,
    skill_orbs?: FyiSkillOrb[] | null,
}

interface FyiSkillOrb {
    id: number,
    name?: string | null,
    description?: string | null,
    grade?: string | null,
    is_reusable?: boolean | null,
    img_id?: string | null,
    skills?: FyiSkillOrbSkill[] | null,
    mission_reward?: FyiSkillOrbMissionReward | null,
    shop_items?: FyiSkillOrbShopItem[] | null,
}

interface FyiSkillOrbSkill {
    id?: number | null,
    attribute?: string | null,
    level?: number | null,
    hidden_potential_skill_id?: number | null,
}

interface FyiSkillOrbMissionReward {
    mission_id?: number | null,
    mission_category_id?: number | null,
    quantity?: number | null,
    mission_category?: {
        img?: string | null,
    } | null,
}

interface FyiSkillOrbShopItem {
    id?: number | null,
    price?: number | null,
    discounted_price?: number | null,
    treasure_item_id?: number | null,
    starts_at?: string | null,
    ends_at?: string | null,
    is_indefinite?: boolean | null,
    treasure_item?: {
        name?: string | null,
        description?: string | null,
        image_suffix?: number | null,
    } | null,
}

interface ExclusiveSkillOrbCarrier {
    owner: ExclusiveSkillOrbOwnerRef,
    orbs: CharacterExclusiveSkillOrb[],
}

interface ExclusiveSkillOrbDetailsBuildInput {
    scannedCharacterCount: number,
    carriers: ExclusiveSkillOrbCarrier[],
    acquisition: AcquisitionDataset,
    sourceIndex: AcquisitionSourceIndexDataset,
    navigation: AcquisitionNavigationDataset,
    missionCatalog: MissionCatalogDataset,
    stageCatalog: StageCatalogDataset,
    dokkanInfoEquipment?: Equipment[],
    failedCharacterIds?: number[],
}

class DokkanFyiExclusiveSkillOrbClient {
    private version?: string;

    async fetchCharacterIds(limit?: number): Promise<number[]> {
        const explicitIds = requestedCharacterIds();
        const offset = requestedCharacterOffset();
        if (explicitIds) {
            return explicitIds.slice(offset, limit ? offset + limit : undefined);
        }

        const characters: FyiOrbCharacterIndexEntry[] = [];
        const collectionLimit = limit ? offset + limit : undefined;

        for (let page = 1; ; page++) {
            const nextPage = await this.fetchCharacterIndexPage(page);
            this.version = nextPage.version ?? this.version;

            const pageCharacters = nextPage.props.characters?.data ?? [];
            const pageSize = pageCharacters.length;
            const perPage = toOptionalNumber(nextPage.props.characters?.meta?.per_page) ?? pageSize;

            if (pageSize === 0) {
                break;
            }

            characters.push(...pageCharacters);

            if (collectionLimit && characters.length >= collectionLimit) {
                break;
            }

            if (pageSize < perPage) {
                break;
            }
        }

        return (limit ? characters.slice(offset, offset + limit) : characters.slice(offset))
            .map(character => toNumber(character.id))
            .filter(id => id > 0);
    }

    async fetchCharacter(characterId: number, retries = requestedRequestRetries()): Promise<FyiOrbCharacter> {
        const cachedCharacter = await readCachedCharacter(characterId);
        if (cachedCharacter) {
            return cachedCharacter;
        }

        const version = this.version ?? await this.fetchCurrentVersion(characterId);
        const url = `${DOKKAN_FYI_BASE_URL}/characters/${characterId}`;
        let response: FyiTextResponse;

        try {
            response = await fetchDokkanFyiText(url, {
                headers: {
                    ...browserHeaders(),
                    "X-Inertia": "true",
                    "X-Requested-With": "XMLHttpRequest",
                    "X-Inertia-Version": version,
                    "X-Inertia-Partial-Component": "Character/CharacterShow",
                    "X-Inertia-Partial-Data": "character",
                    "Accept": "application/json, text/plain, */*",
                },
            });
        } catch (error) {
            if (retries > 1) {
                await delay(500 + (4 - retries) * 500);
                return this.fetchCharacter(characterId, retries - 1);
            }

            throw new Error(`Could not fetch dokkan.fyi character ${characterId}: ${errorMessage(error)}`);
        }

        if (response.status === 409) {
            if (retries <= 1) {
                throw new Error(`Could not fetch dokkan.fyi character ${characterId}: ${response.status}`);
            }

            this.version = await this.fetchCurrentVersion(characterId);
            await delay(250);
            return this.fetchCharacter(characterId, retries - 1);
        }

        if (!response.ok && retries > 1 && shouldRetryStatus(response.status)) {
            await delay(500 + (4 - retries) * 500);
            return this.fetchCharacter(characterId, retries - 1);
        }

        if (!response.ok) {
            throw new Error(`Could not fetch dokkan.fyi character ${characterId}: ${response.status}`);
        }

        const payload = JSON.parse(response.text) as FyiOrbCharacterPagePayload;
        const character = payload.props.character;
        if (!character) {
            throw new Error(`Could not find character payload for dokkan.fyi character ${characterId}.`);
        }

        this.version = payload.version ?? this.version;
        await writeCachedCharacter(characterId, character);
        return character;
    }

    private async fetchCharacterIndexPage(page: number): Promise<FyiCharacterIndexPagePayload> {
        const cachedPage = await readCachedCharacterIndexPage(page);
        if (cachedPage) {
            return cachedPage;
        }

        const query = new URLSearchParams({
            compact: "true",
            fully_awakened: "true",
            page: page.toString(),
        });
        const html = await fetchDokkanFyiHtml(
            `${DOKKAN_FYI_BASE_URL}/characters?${query.toString()}`,
            `character index page ${page}`,
        );
        const payload = extractPagePayload<FyiCharacterIndexPagePayload>(html);
        await writeCachedCharacterIndexPage(page, payload);
        return payload;
    }

    private async fetchCurrentVersion(characterId: number): Promise<string> {
        const html = await fetchDokkanFyiHtml(
            `${DOKKAN_FYI_BASE_URL}/characters/${characterId}`,
            `character page ${characterId}`,
        );
        const payload = extractPagePayload<{ version?: string }>(html);

        if (!payload.version) {
            throw new Error(`Could not extract dokkan.fyi inertia version for character ${characterId}.`);
        }

        this.version = payload.version;
        return payload.version;
    }
}

export async function getDokkanFyiExclusiveSkillOrbDetails(): Promise<ExclusiveSkillOrbDetailsDataset> {
    const [acquisition, sourceIndex, navigation, missionCatalog, stageCatalog, dokkanInfoEquipment] = await Promise.all([
        readJsonFile<AcquisitionDataset>("data/acquisition/latest/acquisition.json"),
        readJsonFile<AcquisitionSourceIndexDataset>("data/acquisition/latest/acquisition-source-index.json"),
        readJsonFile<AcquisitionNavigationDataset>("data/acquisition/latest/acquisition-navigation.json"),
        readJsonFile<MissionCatalogDataset>("data/mission-catalog/latest/mission-catalog.json"),
        readJsonFile<StageCatalogDataset>("data/stage-catalog/latest/stage-catalog.json"),
        readLatestDokkanInfoEquipment(),
    ]);

    const client = new DokkanFyiExclusiveSkillOrbClient();
    const characterIds = await client.fetchCharacterIds(requestedCharacterLimit());
    let completedCharacterCount = 0;
    const failedCharacterIds: number[] = [];
    const carriers = (
        await mapWithConcurrency(characterIds, requestedCharacterConcurrency(), async characterId => {
            try {
                const character = await client.fetchCharacter(characterId);
                const orbs = mapExclusiveSkillOrbsFromFyi(character.skill_orbs);
                if (orbs.length === 0) {
                    return undefined;
                }

                return {
                    owner: mapOwnerRefFromFyi(character),
                    orbs,
                } as ExclusiveSkillOrbCarrier;
            } catch (error) {
                failedCharacterIds.push(characterId);
                console.error(`[EXCLUSIVE-ORB] Failed character ${characterId}: ${errorMessage(error)}`);
                return undefined;
            } finally {
                completedCharacterCount += 1;
                if (completedCharacterCount === 1 || completedCharacterCount % 50 === 0 || completedCharacterCount === characterIds.length) {
                    console.log(`[EXCLUSIVE-ORB] Characters ${completedCharacterCount}/${characterIds.length}`);
                }
            }
        })
    ).filter((carrier): carrier is ExclusiveSkillOrbCarrier => Boolean(carrier));

    return buildExclusiveSkillOrbDetailsDataset({
        scannedCharacterCount: characterIds.length,
        carriers,
        acquisition,
        sourceIndex,
        navigation,
        missionCatalog,
        stageCatalog,
        dokkanInfoEquipment,
        failedCharacterIds,
    });
}

export async function writeDokkanFyiExclusiveSkillOrbDetails(
    dataset?: ExclusiveSkillOrbDetailsDataset,
): Promise<string> {
    const resolvedDataset = dataset ?? await getDokkanFyiExclusiveSkillOrbDetails();
    const outputDir = resolve(__dirname, EXCLUSIVE_SKILL_ORB_OUTPUT_DIR);
    const outputPath = resolve(outputDir, "exclusive-skill-orb-details.json");

    await mkdir(outputDir, { recursive: true });
    await downloadExclusiveSkillOrbAssets(resolvedDataset.entries);
    await writeFormattedJson(outputPath, resolvedDataset);

    return outputPath;
}

export function buildExclusiveSkillOrbDetailsDataset(
    input: ExclusiveSkillOrbDetailsBuildInput,
): ExclusiveSkillOrbDetailsDataset {
    const acquisitionByKey = new Map(
        input.acquisition.items.map(item => [item.key, item]),
    );
    const sourceIndexByKey = new Map(
        input.sourceIndex.sources.map(source => [source.key, source]),
    );
    const navigationBySourceKey = new Map(
        input.navigation.entries.map(entry => [entry.sourceKey, entry.target]),
    );
    const missionGroupByKey = new Map(
        input.missionCatalog.groups.map(group => [group.key, group]),
    );
    const stageGroupByKey = new Map(
        input.stageCatalog.groups.map(group => [group.key, group]),
    );
    const dokkanInfoEquipmentById = new Map(
        (input.dokkanInfoEquipment ?? [])
            .map(equipment => [equipment.officialId?.toString() ?? equipment.id, equipment] as const),
    );
    const entriesById = new Map<string, ExclusiveSkillOrbDetailsEntry>();

    for (const carrier of input.carriers) {
        for (const orb of carrier.orbs) {
            const existing = entriesById.get(orb.id);

            if (existing) {
                existing.owners = mergeOwners(existing.owners, carrier.owner);
                existing.ownerCount = existing.owners.length;
                existing.acquisition = mergeAcquisitionHints(existing.acquisition, orb.acquisition);
                continue;
            }

            const acquisitionSummary = mapOrbAcquisitionSummary(
                orb,
                acquisitionByKey.get(`EquipmentSkillItem:${orb.id}`),
                sourceIndexByKey,
                navigationBySourceKey,
                missionGroupByKey,
                stageGroupByKey,
            );

            entriesById.set(orb.id, {
                ...orb,
                ownerCount: 1,
                owners: [carrier.owner],
                acquisitionModel: acquisitionSummary?.sourceModel ?? "unknown",
                acquisitionSummary,
                dokkanInfo: dokkanInfoEquipmentById.get(orb.id),
                presentationAssets: buildPresentationAssets(orb),
            });
        }
    }

    const entries = [...entriesById.values()]
        .map(entry => ({
            ...entry,
            owners: [...entry.owners].sort(compareOwners),
            ownerCount: entry.owners.length,
        }))
        .sort(compareOrbEntries);

    return {
        generatedAt: new Date().toISOString(),
        source: "dokkan.fyi",
        scannedCharacterCount: input.scannedCharacterCount,
        ownerCharacterCount: input.carriers.length,
        count: entries.length,
        failedCharacterIds: input.failedCharacterIds?.length ? [...new Set(input.failedCharacterIds)].sort((left, right) => left - right) : undefined,
        entries,
    };
}

function buildPresentationAssets(orb: CharacterExclusiveSkillOrb): ExclusiveSkillOrbPresentationAssets | undefined {
    const icon: ExclusiveSkillOrbAssetRef | undefined = orb.iconURL
        ? { remoteUrl: orb.iconURL }
        : undefined;
    const background: ExclusiveSkillOrbAssetRef | undefined = orb.backgroundURL
        ? { remoteUrl: orb.backgroundURL }
        : undefined;

    if (!icon && !background) {
        return undefined;
    }

    return {
        icon,
        background,
    };
}

function mapOrbAcquisitionSummary(
    orb: CharacterExclusiveSkillOrb,
    acquisitionItem: AcquisitionItem | undefined,
    sourceIndexByKey: Map<string, AcquisitionSourceEntry>,
    navigationBySourceKey: Map<string, AcquisitionNavigationTarget>,
    missionGroupByKey: Map<string, MissionCatalogGroup>,
    stageGroupByKey: Map<string, StageCatalogGroup>,
): ExclusiveSkillOrbAcquisitionSummary | undefined {
    if (acquisitionItem) {
        const sources = acquisitionItem.sources
            .map(source => mapAcquisitionSourceEntry(
                source,
                sourceIndexByKey.get(source.key),
                navigationBySourceKey.get(source.key),
            ))
            .sort(compareAcquisitionSourceEntries);
        const groups = buildAcquisitionGroups(sources, missionGroupByKey, stageGroupByKey);

        return {
            itemKey: acquisitionItem.key,
            itemType: acquisitionItem.itemType,
            itemId: acquisitionItem.itemId,
            sourceModel: "acquisition-item",
            groupCount: groups.length,
            sourceCount: sources.length,
            groups,
            sources,
        };
    }

    const hintSources = mapHintAcquisitionSources(orb.id, orb.acquisition ?? []);
    if (hintSources.length === 0) {
        return undefined;
    }

    const sources = hintSources.sort(compareAcquisitionSourceEntries);
    const groups = buildAcquisitionGroups(sources, missionGroupByKey, stageGroupByKey);

    return {
        itemType: "EquipmentSkillItem",
        itemId: orb.id,
        sourceModel: "character-hint",
        groupCount: groups.length,
        sourceCount: sources.length,
        groups,
        sources,
    };
}

function mapAcquisitionSourceEntry(
    source: AcquisitionSource,
    sourceIndex: AcquisitionSourceEntry | undefined,
    navigationTarget: AcquisitionNavigationTarget | undefined,
): ExclusiveSkillOrbAcquisitionSourceEntry {
    return {
        sourceKey: source.key,
        sourceType: "unknown",
        groupKey: sourceIndex?.groupKey ?? `standalone:${source.key}`,
        groupKind: sourceIndex?.groupKind ?? "standalone",
        title: source.title,
        subtitle: source.subtitle,
        description: source.description,
        imageUrl: source.imageUrl,
        sourcePath: source.sourcePath,
        navigationTarget,
        quantity: source.quantity ?? undefined,
        startsAt: source.startsAt,
        endsAt: source.endsAt,
        missionCategoryId: source.missionCategoryId,
        missionId: source.missionId,
        missionType: source.missionType,
        eventType: source.eventType,
        eventId: source.eventId,
        eventStageId: source.eventStageId,
        stageId: source.stageId,
        note: undefined,
    };
}

function mapHintAcquisitionSources(
    orbId: string,
    acquisition: CharacterExclusiveSkillOrbAcquisition[],
): ExclusiveSkillOrbAcquisitionSourceEntry[] {
    return acquisition.map((entry, index) => {
        if (entry.sourceType === "mission-reward") {
            const missionCategoryId = cleanInlineText(entry.missionCategoryId);
            const missionId = cleanInlineText(entry.missionId);
            const sourceKey = `character-mission-reward:${orbId}:${missionCategoryId || "unknown"}:${missionId || index}`;
            return {
                ...entry,
                sourceKey,
                groupKey: missionCategoryId ? `event-mission-category:${missionCategoryId}` : `character-mission-reward:${orbId}`,
                groupKind: missionCategoryId ? "event-mission-category" : "standalone",
                title: entry.sourceName || "Mission Reward",
                subtitle: missionCategoryId ? `Mission Category ${missionCategoryId}` : undefined,
                description: entry.note,
                imageUrl: entry.bannerImageUrl,
                sourcePath: missionCategoryId ? `${DOKKAN_FYI_BASE_URL}/missions/${missionCategoryId}` : undefined,
                navigationTarget: undefined,
                missionType: undefined,
            };
        }

        if (entry.sourceType === "shop-item") {
            const treasureItemId = cleanInlineText(entry.treasureItemId);
            const shopItemId = cleanInlineText(entry.shopItemId);
            const sourceKey = `character-shop-item:${orbId}:${shopItemId || index}`;
            return {
                ...entry,
                sourceKey,
                groupKey: treasureItemId
                    ? `character-shop-treasure:${treasureItemId}`
                    : `character-shop-item:${orbId}`,
                groupKind: "character-shop",
                title: entry.treasureItemName || entry.sourceName || "Shop Item",
                subtitle: "Baba's Shop",
                description: entry.treasureItemDescription || entry.note,
                imageUrl: undefined,
                sourcePath: undefined,
                navigationTarget: undefined,
                missionType: undefined,
            };
        }

        return {
            ...entry,
            sourceKey: `character-acquisition:${orbId}:${index}`,
            groupKey: `character-acquisition:${orbId}`,
            groupKind: "standalone",
            title: entry.sourceName || "Unknown",
            subtitle: undefined,
            description: entry.note,
            imageUrl: entry.bannerImageUrl,
            sourcePath: undefined,
            navigationTarget: undefined,
            missionType: undefined,
        };
    });
}

function buildAcquisitionGroups(
    sources: ExclusiveSkillOrbAcquisitionSourceEntry[],
    missionGroupByKey: Map<string, MissionCatalogGroup>,
    stageGroupByKey: Map<string, StageCatalogGroup>,
): ExclusiveSkillOrbAcquisitionGroupEntry[] {
    const groupsByKey = new Map<string, ExclusiveSkillOrbAcquisitionGroupEntry>();

    for (const source of sources) {
        const quantity = source.quantity;
        const existing = groupsByKey.get(source.groupKey);

        if (existing) {
            existing.sourceCount += 1;
            existing.sourceKeys.push(source.sourceKey);
            existing.priceMin = minNumber(existing.priceMin, source.price);
            existing.priceMax = maxNumber(existing.priceMax, source.price);
            existing.discountedPriceMin = minNumber(existing.discountedPriceMin, source.discountedPrice);
            existing.discountedPriceMax = maxNumber(existing.discountedPriceMax, source.discountedPrice);

            if (quantity !== undefined) {
                existing.totalQuantity = (existing.totalQuantity ?? 0) + quantity;
                existing.maxQuantity = Math.max(existing.maxQuantity ?? 0, quantity);
            }

            if (!existing.imageUrl) {
                existing.imageUrl = source.imageUrl;
            }

            if (!existing.sourcePath) {
                existing.sourcePath = source.sourcePath;
            }

            if (!existing.navigationTarget) {
                existing.navigationTarget = source.navigationTarget;
            }

            if (!existing.treasureItemId) {
                existing.treasureItemId = source.treasureItemId;
            }

            if (!existing.treasureItemName) {
                existing.treasureItemName = source.treasureItemName;
            }

            if (!existing.treasureItemDescription) {
                existing.treasureItemDescription = source.treasureItemDescription;
            }

            if (!existing.treasureItemImageSuffix) {
                existing.treasureItemImageSuffix = source.treasureItemImageSuffix;
            }

            continue;
        }

        const metadata = resolveAcquisitionGroupMetadata(source.groupKey, missionGroupByKey, stageGroupByKey);
        groupsByKey.set(source.groupKey, {
            groupKey: source.groupKey,
            groupKind: source.groupKind,
            title: metadata.title || source.title,
            groupTitle: metadata.groupTitle,
            subtitle: source.subtitle,
            imageUrl: metadata.imageUrl || source.imageUrl,
            sourcePath: metadata.sourcePath || source.sourcePath,
            sourceCount: 1,
            totalQuantity: quantity,
            maxQuantity: quantity,
            navigationTarget: metadata.navigationTarget || source.navigationTarget,
            treasureItemId: source.treasureItemId,
            treasureItemName: source.treasureItemName,
            treasureItemDescription: source.treasureItemDescription,
            treasureItemImageSuffix: source.treasureItemImageSuffix,
            priceMin: source.price,
            priceMax: source.price,
            discountedPriceMin: source.discountedPrice,
            discountedPriceMax: source.discountedPrice,
            sourceKeys: [source.sourceKey],
        });
    }

    return [...groupsByKey.values()]
        .map(group => ({
            ...group,
            sourceKeys: [...group.sourceKeys].sort(compareStrings),
        }))
        .sort(compareAcquisitionGroups);
}

function resolveAcquisitionGroupMetadata(
    groupKey: string,
    missionGroupByKey: Map<string, MissionCatalogGroup>,
    stageGroupByKey: Map<string, StageCatalogGroup>,
): {
    title: string,
    groupTitle?: string,
    imageUrl?: string,
    sourcePath?: string,
    navigationTarget?: AcquisitionNavigationTarget,
} {
    const missionGroup = missionGroupByKey.get(groupKey);
    if (missionGroup) {
        const generic = missionGroup.title.startsWith("MissionCategory::");
        return {
            title: generic ? groupKey : missionGroup.title,
            groupTitle: generic ? missionGroup.title : undefined,
            imageUrl: missionGroup.imageUrl,
            sourcePath: missionGroup.kind === "event-category" ? `${DOKKAN_FYI_BASE_URL}/missions/${missionGroup.id}` : undefined,
            navigationTarget: {
                kind: "mission-catalog-group",
                sourcePath: missionGroup.kind === "event-category" ? `${DOKKAN_FYI_BASE_URL}/missions/${missionGroup.id}` : undefined,
                missionGroupKey: missionGroup.key,
            },
        };
    }

    const stageGroup = stageGroupByKey.get(groupKey);
    if (stageGroup) {
        return {
            title: stageGroup.title,
            imageUrl: stageGroup.imageUrl,
            sourcePath: stageGroup.sourcePath,
            navigationTarget: {
                kind: "stage-catalog-group",
                sourcePath: stageGroup.sourcePath,
                stageGroupKey: stageGroup.key,
                areaId: stageGroup.kind === "event-area" || stageGroup.kind === "quest-story-area" ? stageGroup.id : undefined,
                zBattleId: stageGroup.kind === "z-battle" ? stageGroup.zBattleId : undefined,
            },
        };
    }

    return { title: "" };
}

function mapOwnerRefFromFyi(character: FyiOrbCharacter): ExclusiveSkillOrbOwnerRef {
    return {
        id: toNumber(character.id).toString(),
        canonicalId: toStringOrUndefined(character.canonical_id),
        baseCharacterId: toStringOrUndefined(character.base_character_id),
        characterId: toStringOrUndefined(character.character_id),
        name: cleanInlineText(character.name),
        rarity: rarityFromInput(character.rarity_text, character.rarity),
        type: typeFromInput(character.type_text, character.type),
        characterClass: classFromInput(character.awakening_type_text, character.awakening_type),
        thumbnailId: toStringOrUndefined(character.thumbnail_id),
        portraitUrl: portraitUrl(character.thumbnail_id),
        latestReleaseType: cleanInlineText(character.release_dates?.latest_type),
        hasEza: toOptionalBoolean(character.has_eza),
        hasSeza: toOptionalBoolean(character.has_seza),
        isReversiblyExchanged: toOptionalBoolean(character.is_reversibly_exchanged),
        isFreeToPlay: toOptionalBoolean(character.is_freely_obtainable),
    };
}

function mapExclusiveSkillOrbsFromFyi(orbs: FyiSkillOrb[] | null | undefined): CharacterExclusiveSkillOrb[] {
    return (orbs ?? []).map(orb => ({
        id: orb.id.toString(),
        name: cleanInlineText(orb.name),
        description: cleanMultilineText(orb.description),
        grade: cleanInlineText(orb.grade),
        reusable: Boolean(orb.is_reusable),
        iconImageId: cleanInlineText(orb.img_id),
        iconURL: skillOrbIconUrl(orb.img_id),
        backgroundURL: skillOrbBackgroundUrl(orb.grade),
        skills: (orb.skills ?? []).map(skill => ({
            id: toStringOrUndefined(skill.id),
            attribute: cleanInlineText(skill.attribute),
            level: toOptionalNumber(skill.level),
            hiddenPotentialSkillId: toOptionalNumber(skill.hidden_potential_skill_id) ?? undefined,
        })),
        acquisition: mapSkillOrbAcquisitionHintsFromFyi(orb),
    }));
}

function mapSkillOrbAcquisitionHintsFromFyi(orb: FyiSkillOrb): CharacterExclusiveSkillOrbAcquisition[] {
    const acquisition: CharacterExclusiveSkillOrbAcquisition[] = [];

    if (orb.mission_reward) {
        acquisition.push({
            sourceType: "mission-reward",
            sourceName: "Mission Reward",
            missionId: toStringOrUndefined(orb.mission_reward.mission_id),
            missionCategoryId: toStringOrUndefined(orb.mission_reward.mission_category_id),
            bannerImageUrl: cleanInlineText(orb.mission_reward.mission_category?.img),
            quantity: toOptionalNumber(orb.mission_reward.quantity),
        });
    }

    for (const shopItem of orb.shop_items ?? []) {
        acquisition.push({
            sourceType: "shop-item",
            sourceName: "Shop Item",
            shopItemId: toStringOrUndefined(shopItem.id),
            price: toOptionalNumber(shopItem.price),
            discountedPrice: toOptionalNumber(shopItem.discounted_price),
            treasureItemId: toStringOrUndefined(shopItem.treasure_item_id),
            treasureItemName: cleanInlineText(shopItem.treasure_item?.name),
            treasureItemDescription: cleanMultilineText(shopItem.treasure_item?.description),
            treasureItemImageSuffix: toOptionalNumber(shopItem.treasure_item?.image_suffix),
            startsAt: cleanInlineText(shopItem.starts_at),
            endsAt: cleanInlineText(shopItem.ends_at),
            isIndefinite: toOptionalBoolean(shopItem.is_indefinite),
        });
    }

    return acquisition;
}

async function readJsonFile<T>(relativePath: string): Promise<T> {
    const content = await readFile(resolve(__dirname, relativePath), "utf8");
    return JSON.parse(content) as T;
}

async function readLatestDokkanInfoEquipment(): Promise<Equipment[]> {
    const configuredPath = process.env.DOKKAN_INFO_EQUIPMENT_DATA_PATH;
    if (configuredPath) {
        return readJsonFileAtPath<Equipment>(resolve(process.cwd(), configuredPath));
    }

    const dataDir = resolve(__dirname, "data");
    let filenames: string[];

    try {
        filenames = await readdir(dataDir);
    } catch {
        return [];
    }

    const latestFilename = filenames
        .filter(filename => /^\d{8}DokkanEquipmentData\.json$/.test(filename))
        .sort()
        .pop();

    if (!latestFilename) {
        return [];
    }

    return readJsonFileAtPath<Equipment>(resolve(dataDir, latestFilename));
}

async function readJsonFileAtPath<T>(filePath: string): Promise<T[]> {
    try {
        const content = await readFile(filePath, "utf8");
        const parsed = JSON.parse(content);
        return Array.isArray(parsed) ? parsed as T[] : [];
    } catch {
        return [];
    }
}

interface FyiOrbCharacterCacheEntry {
    fetchedAt: string,
    character: FyiOrbCharacter,
}

interface FyiCharacterIndexPageCacheEntry {
    fetchedAt: string,
    payload: FyiCharacterIndexPagePayload,
}

async function readCachedCharacterIndexPage(page: number): Promise<FyiCharacterIndexPagePayload | undefined> {
    if (shouldRefreshCharacterCache()) {
        return undefined;
    }

    const cachePath = resolve(__dirname, EXCLUSIVE_SKILL_ORB_CACHE_DIR, `index-page-${page}.json`);

    try {
        const content = await readFile(cachePath, "utf8");
        const entry = JSON.parse(content) as FyiCharacterIndexPageCacheEntry;
        const fetchedAt = Date.parse(entry.fetchedAt);

        if (!entry.payload || !Number.isFinite(fetchedAt) || Date.now() - fetchedAt > characterCacheTtlMs()) {
            return undefined;
        }

        return entry.payload;
    } catch {
        return undefined;
    }
}

async function writeCachedCharacterIndexPage(page: number, payload: FyiCharacterIndexPagePayload): Promise<void> {
    const cacheDir = resolve(__dirname, EXCLUSIVE_SKILL_ORB_CACHE_DIR);
    const cachePath = resolve(cacheDir, `index-page-${page}.json`);
    const temporaryPath = `${cachePath}.tmp`;

    await mkdir(cacheDir, { recursive: true });
    const cacheEntry: FyiCharacterIndexPageCacheEntry = {
        fetchedAt: new Date().toISOString(),
        payload,
    };
    await writeFile(temporaryPath, JSON.stringify(cacheEntry));
    await rename(temporaryPath, cachePath);
}

async function readCachedCharacter(characterId: number): Promise<FyiOrbCharacter | undefined> {
    if (shouldRefreshCharacterCache()) {
        return undefined;
    }

    const cachePath = resolve(__dirname, EXCLUSIVE_SKILL_ORB_CACHE_DIR, `${characterId}.json`);

    try {
        const content = await readFile(cachePath, "utf8");
        const entry = JSON.parse(content) as FyiOrbCharacterCacheEntry;
        const fetchedAt = Date.parse(entry.fetchedAt);

        if (!entry.character || !Number.isFinite(fetchedAt)) {
            return undefined;
        }

        if (Date.now() - fetchedAt > characterCacheTtlMs()) {
            return undefined;
        }

        return entry.character;
    } catch {
        return undefined;
    }
}

async function writeCachedCharacter(characterId: number, character: FyiOrbCharacter): Promise<void> {
    const cacheDir = resolve(__dirname, EXCLUSIVE_SKILL_ORB_CACHE_DIR);
    const cachePath = resolve(cacheDir, `${characterId}.json`);
    const temporaryPath = `${cachePath}.tmp`;

    await mkdir(cacheDir, { recursive: true });
    const cacheEntry: FyiOrbCharacterCacheEntry = {
        fetchedAt: new Date().toISOString(),
        character,
    };
    await writeFile(temporaryPath, JSON.stringify(cacheEntry));
    await rename(temporaryPath, cachePath);
}

function shouldRefreshCharacterCache(): boolean {
    return /^(1|true|yes)$/i.test(process.env.DOKKAN_FYI_ORB_REFRESH ?? "");
}

function characterCacheTtlMs(): number {
    const hours = parseFloat(process.env.DOKKAN_FYI_ORB_CACHE_TTL_HOURS ?? "");
    const ttlHours = Number.isFinite(hours) && hours >= 0 ? hours : DEFAULT_CHARACTER_CACHE_TTL_HOURS;
    return ttlHours * 60 * 60 * 1000;
}

async function fetchDokkanFyiHtml(url: string, label: string, retries = requestedRequestRetries()): Promise<string> {
    let response: FyiTextResponse;

    try {
        response = await fetchDokkanFyiText(url, {
            headers: browserHeaders(),
        });
    } catch (error) {
        if (retries > 1) {
            await delay(500 + (3 - retries) * 500);
            return fetchDokkanFyiHtml(url, label, retries - 1);
        }

        throw new Error(`Could not fetch dokkan.fyi ${label}: ${errorMessage(error)}`);
    }

    if (response.ok) {
        return response.text;
    }

    if (retries > 1 && shouldRetryStatus(response.status)) {
        await delay(400);
        return fetchDokkanFyiHtml(url, label, retries - 1);
    }

    throw new Error(`Could not fetch dokkan.fyi ${label}: ${response.status}`);
}

interface FyiTextResponse {
    ok: boolean,
    status: number,
    text: string,
}

async function fetchDokkanFyiText(
    url: string,
    init: RequestInit,
): Promise<FyiTextResponse> {
    const controller = new AbortController();
    const timeoutMs = requestedRequestTimeoutMs();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, {
            ...init,
            signal: controller.signal,
        });

        return {
            ok: response.ok,
            status: response.status,
            text: await response.text(),
        };
    } finally {
        clearTimeout(timeout);
    }
}

function errorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.name === "AbortError"
            ? `request timed out after ${requestedRequestTimeoutMs()}ms`
            : error.message;
    }

    return String(error);
}

async function downloadExclusiveSkillOrbAssets(
    entries: ExclusiveSkillOrbDetailsEntry[],
): Promise<void> {
    await mapWithConcurrency(entries, EXCLUSIVE_SKILL_ORB_ASSET_CONCURRENCY, async entry => {
        if (!entry.presentationAssets?.icon && !entry.presentationAssets?.background) {
            return;
        }

        const orbDir = resolve(__dirname, EXCLUSIVE_SKILL_ORB_ASSET_DIR, entry.id);
        await mkdir(orbDir, { recursive: true });

        if (entry.presentationAssets?.icon) {
            entry.presentationAssets.icon.localPath = await downloadAsset(
                entry.presentationAssets.icon.remoteUrl,
                resolve(orbDir, "icon.png"),
            );
        }

        if (entry.presentationAssets?.background) {
            entry.presentationAssets.background.localPath = await downloadAsset(
                entry.presentationAssets.background.remoteUrl,
                resolve(orbDir, "background.png"),
            );
        }
    });
}

async function downloadAsset(
    remoteUrl: string,
    absolutePath: string,
): Promise<string> {
    if (await fileExists(absolutePath)) {
        return toProjectRelativePath(absolutePath);
    }

    const response = await fetch(remoteUrl, {
        headers: browserHeaders(),
    });

    if (!response.ok) {
        throw new Error(`Could not fetch asset ${remoteUrl}: ${response.status}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    await writeFile(absolutePath, buffer);

    return toProjectRelativePath(absolutePath);
}

function extractPagePayload<T>(html: string): T {
    const match = html.match(/<script data-page="app" type="application\/json">([\s\S]*?)<\/script>/);
    if (!match?.[1]) {
        throw new Error("Could not find dokkan.fyi page payload.");
    }

    return JSON.parse(match[1]) as T;
}

function browserHeaders(): Record<string, string> {
    return {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
    };
}

function requestedCharacterIds(): number[] | undefined {
    const ids = (process.env.DOKKAN_FYI_ORB_CHARACTER_IDS ?? "")
        .split(",")
        .map(value => parseInt(value.trim(), 10))
        .filter(Number.isFinite);

    return ids.length ? ids : undefined;
}

function requestedCharacterLimit(): number | undefined {
    const value = parseInt(process.env.DOKKAN_FYI_ORB_CHARACTER_LIMIT ?? "", 10);
    return Number.isFinite(value) && value > 0 ? value : undefined;
}

function requestedCharacterOffset(): number {
    const value = parseInt(process.env.DOKKAN_FYI_ORB_CHARACTER_OFFSET ?? "", 10);
    return Number.isFinite(value) && value > 0 ? value : 0;
}

function requestedCharacterConcurrency(): number {
    const value = parseInt(process.env.DOKKAN_FYI_ORB_CHARACTER_CONCURRENCY ?? "", 10);
    return Number.isFinite(value) && value > 0 ? value : 4;
}

function requestedRequestTimeoutMs(): number {
    const value = parseInt(process.env.DOKKAN_FYI_ORB_REQUEST_TIMEOUT_MS ?? "", 10);
    return Number.isFinite(value) && value > 0 ? value : DEFAULT_DOKKAN_FYI_REQUEST_TIMEOUT_MS;
}

function requestedRequestRetries(): number {
    const value = parseInt(process.env.DOKKAN_FYI_ORB_REQUEST_RETRIES ?? "", 10);
    return Number.isFinite(value) && value > 0 ? value : 3;
}

async function mapWithConcurrency<TInput, TOutput>(
    input: TInput[],
    concurrency: number,
    mapper: (value: TInput, index: number) => Promise<TOutput>,
): Promise<TOutput[]> {
    const results: TOutput[] = new Array(input.length);
    let cursor = 0;

    async function worker() {
        while (true) {
            const index = cursor++;
            if (index >= input.length) {
                return;
            }

            results[index] = await mapper(input[index], index);
        }
    }

    const workerCount = Math.max(1, Math.min(concurrency, input.length || 1));
    await Promise.all(Array.from({ length: workerCount }, () => worker()));
    return results;
}

function mergeOwners(
    owners: ExclusiveSkillOrbOwnerRef[],
    candidate: ExclusiveSkillOrbOwnerRef,
): ExclusiveSkillOrbOwnerRef[] {
    if (owners.some(owner => owner.id === candidate.id)) {
        return owners;
    }

    return [...owners, candidate];
}

function mergeAcquisitionHints(
    current: CharacterExclusiveSkillOrbAcquisition[] | undefined,
    incoming: CharacterExclusiveSkillOrbAcquisition[] | undefined,
): CharacterExclusiveSkillOrbAcquisition[] | undefined {
    const merged = [...(current ?? [])];

    for (const candidate of incoming ?? []) {
        const key = JSON.stringify(candidate);
        if (!merged.some(entry => JSON.stringify(entry) === key)) {
            merged.push(candidate);
        }
    }

    return merged.length ? merged : undefined;
}

function compareOrbEntries(
    left: ExclusiveSkillOrbDetailsEntry,
    right: ExclusiveSkillOrbDetailsEntry,
): number {
    return compareStrings(left.name, right.name)
        || compareStrings(left.grade ?? "", right.grade ?? "")
        || compareStrings(left.id, right.id);
}

function compareOwners(left: ExclusiveSkillOrbOwnerRef, right: ExclusiveSkillOrbOwnerRef): number {
    return compareStrings(left.name, right.name) || compareStrings(left.id, right.id);
}

function compareAcquisitionGroups(
    left: ExclusiveSkillOrbAcquisitionGroupEntry,
    right: ExclusiveSkillOrbAcquisitionGroupEntry,
): number {
    return compareStrings(left.title, right.title)
        || compareStrings(left.groupKey, right.groupKey);
}

function compareAcquisitionSourceEntries(
    left: ExclusiveSkillOrbAcquisitionSourceEntry,
    right: ExclusiveSkillOrbAcquisitionSourceEntry,
): number {
    return compareStrings(left.title, right.title)
        || compareStrings(left.subtitle ?? "", right.subtitle ?? "")
        || compareStrings(left.sourceKey, right.sourceKey);
}

function compareStrings(left: string, right: string): number {
    return left.localeCompare(right);
}

function cleanInlineText(value: string | null | undefined): string {
    return (value ?? "").replace(/\s+/g, " ").trim();
}

function cleanMultilineText(value: string | null | undefined): string {
    return (value ?? "")
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean)
        .join("\n");
}

function toNumber(value: unknown): number {
    return typeof value === "number" && Number.isFinite(value)
        ? value
        : parseInt(String(value ?? ""), 10) || 0;
}

function toOptionalNumber(value: unknown): number | undefined {
    const numeric = typeof value === "number" && Number.isFinite(value)
        ? value
        : parseInt(String(value ?? ""), 10);
    return Number.isFinite(numeric) ? numeric : undefined;
}

function toStringOrUndefined(value: unknown): string | undefined {
    const normalized = cleanInlineText(value === null || value === undefined ? undefined : String(value));
    return normalized || undefined;
}

function toOptionalBoolean(value: unknown): boolean | undefined {
    return typeof value === "boolean" ? value : undefined;
}

function rarityFromInput(text: string | null | undefined, value: number | null | undefined): Rarities | undefined {
    const normalized = cleanInlineText(text).toUpperCase();
    switch (normalized) {
        case "LR":
            return Rarities.LR;
        case "UR":
            return Rarities.UR;
        case "SSR":
            return Rarities.SSR;
        case "SR":
            return Rarities.SR;
        case "R":
            return Rarities.R;
        case "N":
            return Rarities.N;
        default:
            return rarityFromNumber(value);
    }
}

function rarityFromNumber(value: number | null | undefined): Rarities | undefined {
    switch (toOptionalNumber(value)) {
        case 5:
            return Rarities.LR;
        case 4:
            return Rarities.UR;
        case 3:
            return Rarities.SSR;
        case 2:
            return Rarities.SR;
        case 1:
            return Rarities.R;
        case 0:
            return Rarities.N;
        default:
            return undefined;
    }
}

function typeFromInput(text: string | null | undefined, value: number | null | undefined): Types | undefined {
    const normalized = cleanInlineText(text).toUpperCase();
    switch (normalized) {
        case "AGL":
            return Types.AGL;
        case "TEQ":
            return Types.TEQ;
        case "INT":
            return Types.INT;
        case "STR":
            return Types.STR;
        case "PHY":
            return Types.PHY;
        default:
            return typeFromNumber(value);
    }
}

function typeFromNumber(value: number | null | undefined): Types | undefined {
    switch (toOptionalNumber(value)) {
        case 1:
            return Types.AGL;
        case 2:
            return Types.TEQ;
        case 3:
            return Types.INT;
        case 4:
            return Types.STR;
        case 5:
            return Types.PHY;
        default:
            return undefined;
    }
}

function classFromInput(text: string | null | undefined, value: number | null | undefined): Classes | undefined {
    const normalized = cleanInlineText(text).toLowerCase();
    if (normalized === "super") {
        return Classes.Super;
    }
    if (normalized === "extreme") {
        return Classes.Extreme;
    }
    return classFromNumber(value);
}

function classFromNumber(value: number | null | undefined): Classes | undefined {
    switch (toOptionalNumber(value)) {
        case 1:
            return Classes.Super;
        case 2:
            return Classes.Extreme;
        default:
            return undefined;
    }
}

function portraitUrl(thumbnailId: number | null | undefined): string | undefined {
    const id = toOptionalNumber(thumbnailId);
    return id ? `${DOKKAN_FYI_CDN_URL}/assets/en/character/thumb/card_${id}_thumb.png` : undefined;
}

function skillOrbIconUrl(imgId: string | null | undefined): string | undefined {
    const normalized = cleanInlineText(imgId);
    return normalized ? `${DOKKAN_FYI_CDN_URL}/assets/en/item/equ_item_${normalized}.png` : undefined;
}

function skillOrbBackgroundUrl(grade: string | null | undefined): string | undefined {
    const normalized = cleanInlineText(grade).toLowerCase();
    if (!["bronze", "silver", "gold"].includes(normalized)) {
        return undefined;
    }

    return `${DOKKAN_FYI_CDN_URL}/assets/en/layout/en/image/equipment/equipment_thumb_bg/equ_base_${normalized}.png`;
}

function minNumber(current: number | undefined, next: number | undefined): number | undefined {
    if (next === undefined) {
        return current;
    }
    if (current === undefined) {
        return next;
    }
    return Math.min(current, next);
}

function maxNumber(current: number | undefined, next: number | undefined): number | undefined {
    if (next === undefined) {
        return current;
    }
    if (current === undefined) {
        return next;
    }
    return Math.max(current, next);
}

function shouldRetryStatus(status: number): boolean {
    return status === 429 || status >= 500;
}

function delay(ms: number): Promise<void> {
    return new Promise(resolveDelay => setTimeout(resolveDelay, ms));
}

async function fileExists(absolutePath: string): Promise<boolean> {
    try {
        await access(absolutePath);
        return true;
    } catch (error) {
        return false;
    }
}

function toProjectRelativePath(absolutePath: string): string {
    return relative(resolve(__dirname), absolutePath).replace(/\\/g, "/");
}
