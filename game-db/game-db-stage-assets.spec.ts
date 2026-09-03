import { equal, throws } from "assert";
import { createHash } from "crypto";
import { describe, it } from "mocha";
import { StageDetailsDataset } from "../stage-detail";
import { collectStageAssetRequests, validateStageAssetMissingAcceptance } from "./game-db-stage-assets";

describe("Stage asset mirror", () => {
    it("collects event, reward, enemy, Quest and Frontier assets under stable paths", () => {
        const dataset: StageDetailsDataset = {
            schemaVersion: 2,
            generatedAt: "2026-09-03T00:00:00.000Z",
            source: "dokkan-game-db",
            sourceSnapshotVersion: "1788329250",
            sourceDatabaseSha256: "a".repeat(64),
            count: 1,
            entries: [{
                id: "1010",
                difficulty: "NORMAL",
                stamina: 8,
                requiredKeys: 0,
                rankExp: 1,
                zeni: 1,
                linkSkillLevelUpRate: 0.4,
                questId: "101",
                questName: "Quest",
                areaId: "1",
                areaName: "Area",
                areaType: "Area::MainArea",
                chapter: { id: "1", name: "Chapter 1" },
                images: { button: { sourcePath: "banners/en/event/eve_listbutton/event.png" } },
                enemies: [{
                    id: "1",
                    battle: 1,
                    tile: 1,
                    characterId: "1",
                    cardId: "1011961",
                    thumbnailId: "1011961",
                    name: "Enemy",
                    rarityRaw: 3,
                    elementRaw: 20,
                    skills: [],
                }],
                bossDrops: [{
                    sourceRowId: "1",
                    itemType: "AwakeningItem",
                    itemId: "9",
                    dropTypeRaw: "boss",
                    quantityStatus: "unknown",
                    chanceStatus: "unknown",
                }],
            }],
        };
        const itemCatalog = {
            categories: [{
                items: [{
                    key: "AwakeningItem:9",
                    icon: { remoteUrl: "https://dokkaninfo.com/assets/global/en/item/awaken/en/thumb/thumb_awaken_items_00009/thumb_awaken_items_00009.png" },
                    background: { remoteUrl: "https://dokkaninfo.com/assets/global/en/layout/en/image/item/awaken/awaken_thumb_bg/thumb_awaken_rainbow.png" },
                }],
            }],
        };
        const frontier = {
            series: [{
                bannerImageUrl: "https://dokkaninfo.com/assets/global/en/origin/series_banner/origin_sr_seriesbanner_02.png",
                portraitSpec: { iconId: 1023770, frameColorId: 0, rarity: "UR", elementCode: "20" },
                step: 1,
            }],
        };

        const requests = collectStageAssetRequests(dataset, itemCatalog, frontier);
        const paths = requests.map(request => request.path);
        equal(paths.includes("banners/en/event/eve_listbutton/event.png"), true);
        equal(paths.includes("outgame/extension/adventure/chapter/1/1001.png"), true);
        equal(paths.includes("character/thumb/card_1011961_thumb/card_1011961_thumb.png"), true);
        equal(paths.includes("character/thumb/card_1023770_thumb/card_1023770_thumb.png"), true);
        equal(paths.includes("origin/series_banner/origin_sr_seriesbanner_02.png"), true);
        equal(paths.includes("item/awaken/en/thumb/thumb_awaken_items_00009/thumb_awaken_items_00009.png"), true);
        equal(paths.some(path => path.includes("awaken_thumb_bg")), false);
        const missingVariant = requests.find(request => request.path.includes("card_1011961_thumb"))!;
        equal(
            missingVariant.sourceUrls.includes(
                "https://assets.dokkanstats.com/assets/global/en/character/thumb/card_1011960_thumb/card_1011960_thumb.png",
            ),
            true,
        );

        const unsafeRequests = collectStageAssetRequests(dataset, {
            categories: [{
                items: [{
                    key: "AwakeningItem:9",
                    icon: {
                        remoteUrl: "https://user:secret@dokkaninfo.com/assets/global/en/item/unsafe.png",
                    },
                }],
            }],
        }, {});
        equal(unsafeRequests.some(request => request.path === "item/unsafe.png"), false);
    });

    it("requires an exact snapshot-bound acceptance for source gaps", () => {
        const missingAssets = [{ path: "banners/en/event/missing.png" }];
        throws(
            () => validateStageAssetMissingAcceptance("123", missingAssets, undefined),
            /unaccepted missing assets/,
        );
        validateStageAssetMissingAcceptance("123", missingAssets, {
            schemaVersion: 1,
            sourceSnapshotVersion: "123",
            missingAssetCount: 1,
            missingPathsSha256: createHash("sha256").update(missingAssets[0].path).digest("hex"),
            reason: "Reviewed historical banner gap with no available source bytes.",
        });
    });
});
