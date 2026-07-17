import { deepEqual, equal } from "assert";
import {
    buildDokkanInfoItemCatalogManifest,
    DEFAULT_ITEM_CATEGORIES,
    parseDokkanInfoItemCategory,
} from "./dokkaninfo-item-catalog-scraper";

describe("DokkanInfo item catalog parser", () => {
    it("builds a versioned manifest from the exact catalog bytes", () => {
        const catalog = {
            generatedAt: "2026-07-17T12:00:00.000Z",
            source: "dokkaninfo" as const,
            categoryCount: 1,
            itemCount: 1,
            failedCategorySlugs: [],
            categories: [],
        };
        const payload = Buffer.from('{"catalog":true}\n', "utf8");

        deepEqual(buildDokkanInfoItemCatalogManifest(catalog, payload), {
            schemaVersion: 1,
            datasetVersion: "2026-07-17T12:00:00.000Z",
            generatedAt: "2026-07-17T12:00:00.000Z",
            fileName: "item-catalog.json",
            compression: "none",
            sha256: "90b988c2b18aa39f9b5d7a0e27cc4311b15cdceb391e7c3791d3686e0dcaff12",
            sizeBytes: payload.byteLength,
            itemCount: 1,
            categoryCount: 1,
        });
    });

    it("maps layered icon rows into stable item keys and localizable assets", () => {
        const category = parseDokkanInfoItemCategory(`
            <div class="row align-items-center">
                <div class="col-sm card-icon">
                    <div class="card-icon-item"><img src="/assets/global/en/item/act/thumb_bg/thumb_bg_act_item_02.png" alt="background"></div>
                    <div class="card-icon-item"><img src="/assets/global/en/item/act/thumb/thumb_act_item_00001.png" alt="thumb_act_item_00001"></div>
                </div>
                <div class="col-sm font-size-1_5">Aged Meat (S)</div>
                <div class="col-sm font-size-1_2">Consume it to restore 20 STA.</div>
            </div>
        `, DEFAULT_ITEM_CATEGORIES[0]);

        equal(category.count, 1);
        deepEqual(category.items[0], {
            key: "ActItem:1",
            id: "1",
            itemType: "ActItem",
            category: "actitems",
            name: "Aged Meat (S)",
            description: "Consume it to restore 20 STA.",
            value: undefined,
            sourcePath: "https://dokkaninfo.com/items/actitems",
            icon: {
                remoteUrl: "https://dokkaninfo.com/assets/global/en/item/act/thumb/thumb_act_item_00001.png",
            },
            background: {
                remoteUrl: "https://dokkaninfo.com/assets/global/en/item/act/thumb_bg/thumb_bg_act_item_02.png",
            },
        });
    });

    it("keeps training item values and training field detail paths", () => {
        const trainingItems = parseDokkanInfoItemCategory(`
            <div class="container">
                <div class="row align-items-center">
                    <div class="col-sm card-icon"><img src="/assets/global/en/item/training_item/thumb_training_items_0000100.png" alt="100"></div>
                    <div class="col-sm font-size-1_5">Turtle Rock [AGL]</div>
                    <div class="col-sm font-size-1_2">Use in training to gain 1000 EXP or more</div>
                    <div class="col-sm font-size-1_2">1,000</div>
                </div>
            </div>
        `, DEFAULT_ITEM_CATEGORIES.find(category => category.slug === "trainingitems")!);

        equal(trainingItems.items[0].key, "TrainingItem:100");
        equal(trainingItems.items[0].value, 1000);

        const fields = parseDokkanInfoItemCategory(`
            <a href="/items/trainingfields/2">
                <div class="font-size-1_2"><b>Korin's Tower</b></div>
                <div class="font-size-1_2">Gain an extra 10,000 EXP per Training Partner.</div>
                <div class="font-size-1_2">10,000</div>
                <img src="/assets/global/en/item/training_field/thumb/thumb_training_field_01002.png" alt="thumb_training_field_01002">
            </a>
        `, DEFAULT_ITEM_CATEGORIES.find(category => category.slug === "trainingfields")!);

        equal(fields.items[0].key, "TrainingField:2");
        equal(fields.items[0].sourcePath, "https://dokkaninfo.com/items/trainingfields/2");
        equal(fields.items[0].name, "Korin's Tower");
        equal(fields.items[0].value, 10000);
    });

    it("maps card-style special items and sticker icons without requiring detail links", () => {
        const special = parseDokkanInfoItemCategory(`
            <div class="col-md bg-main">
                <div class="row"><div class="col-md"><b>World Tournament Ticket</b></div></div>
                <div class="row"><div class="col-md"><img src="/assets/global/en/item/other/en/thumb/thumb_other_00001/thumb_other_00001.png" alt="thumb_other_00001"></div></div>
                <div class="row"><div class="col-md font-size-1">A summon ticket rewarded at the World Tournament.</div></div>
            </div>
        `, DEFAULT_ITEM_CATEGORIES.find(category => category.slug === "specialitems")!);
        equal(special.items[0].key, "SpecialItem:1");
        equal(special.items[0].description, "A summon ticket rewarded at the World Tournament.");

        const sticker = parseDokkanInfoItemCategory(`
            <div class="row align-items-center">
                <div class="col-sm card-icon"><img src="/assets/global/en/item/sticker/sti_icon_001.png" alt="sti_icon_001"></div>
                <div class="col-sm font-size-1_5">Special Sticker</div>
                <div class="col-sm font-size-1_2">Use this Special Sticker to apply an exclusive visual effect.</div>
            </div>
        `, DEFAULT_ITEM_CATEGORIES.find(category => category.slug === "stickers")!);
        equal(sticker.items[0].key, "StickerItem:1");
        equal(sticker.items[0].name, "Special Sticker");
    });
});
