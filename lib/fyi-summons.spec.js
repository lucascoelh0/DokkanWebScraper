"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const mocha_1 = require("mocha");
const fyi_summons_1 = require("./fyi-summons");
(0, mocha_1.describe)("mapSummonSummaryFromFyi", function () {
    (0, mocha_1.it)("maps a summon index row into a plain-text summary contract", () => {
        const summary = (0, fyi_summons_1.mapSummonSummaryFromFyi)({
            id: 12338,
            name: "Dokkan Festival [Gohan (Beast)]",
            description: "<div style=\"text-align: center\"><span style=\"color: #FF7700\">250 hours only!</span> Perform 3 Multi-Summons and <span style=\"color: #FFFF00\">get one FREE</span>!<br />New SSR <span style=\"color: #00CC00\">Gohan (Beast)</span> arrives!</div>",
            category: "Recommended",
            starts_at: "2026-06-27T07:00:00.000000Z",
            ends_at: "2026-07-07T16:59:59.000000Z",
            banner: "https://cdn.dokkan.fyi/assets/en/banners/en/gashasocool/gasha_top_banner_12338.png",
        });
        (0, assert_1.equal)(summary.id, "12338");
        (0, assert_1.equal)(summary.name, "Dokkan Festival [Gohan (Beast)]");
        (0, assert_1.equal)(summary.category, "Recommended");
        (0, assert_1.equal)(summary.startsAt, "2026-06-27T07:00:00.000Z");
        (0, assert_1.equal)(summary.endsAt, "2026-07-07T16:59:59.000Z");
        (0, assert_1.equal)(summary.bannerUrl, "https://cdn.dokkan.fyi/assets/en/banners/en/gashasocool/gasha_top_banner_12338.png");
        (0, assert_1.equal)(summary.description.includes("Perform 3 Multi-Summons"), true);
    });
});
(0, mocha_1.describe)("mapSummonRateFromFyi", function () {
    (0, mocha_1.it)("maps rarity rates into numeric fields for later UI and filtering", () => {
        const rate = (0, fyi_summons_1.mapSummonRateFromFyi)({
            type: "special",
            name: "SSR Guaranteed Summon",
            position: 10,
            amount: 1,
            rarities: [
                {
                    rarity: 3,
                    total_amount: 321,
                    total_rate: "100.000",
                    featured_amount: 7,
                    featured_rate: "5.000",
                    normal_amount: 314,
                    normal_rate: "95.000",
                },
            ],
        });
        (0, assert_1.equal)(rate.type, "special");
        (0, assert_1.equal)(rate.position, 10);
        (0, assert_1.equal)(rate.amount, 1);
        (0, assert_1.deepEqual)(rate.rarities, [
            {
                rarity: "SSR",
                totalAmount: 321,
                totalRate: 100,
                featuredAmount: 7,
                featuredRate: 5,
                normalAmount: 314,
                normalRate: 95,
            },
        ]);
    });
});
(0, mocha_1.describe)("mapSummonDetailFromFyi", function () {
    (0, mocha_1.it)("maps featured characters and steps from the summon detail payload", () => {
        const detail = (0, fyi_summons_1.mapSummonDetailFromFyi)({
            id: 12338,
            name: "Dokkan Festival [Gohan (Beast)]",
            description: "<div>Banner text</div>",
            category: "Recommended",
            starts_at: "2026-06-27T07:00:00.000000Z",
            ends_at: "2026-07-07T16:59:59.000000Z",
            banner: "https://cdn.dokkan.fyi/assets/en/banners/en/gashasocool/gasha_top_banner_12338.png",
            featured_characters: [
                {
                    character_id: 1034320,
                    character: {
                        id: 1034320,
                        canonical_id: 776,
                        base_character_id: 1034320,
                        name: "Gohan (Beast)",
                        rarity_text: "SSR",
                        type_text: "TEQ",
                        awakening_type_text: "Super",
                        thumbnail_id: 1034320,
                    },
                    new: 1,
                    dokkan_fest: 1,
                    carnival: 0,
                    type: "featured",
                },
            ],
            steps: [
                {
                    id: 667,
                    step: 1,
                    name: "Step 1 - 3 [1st Round]",
                    rates: [
                        {
                            type: "normal",
                            name: "Normal Summon",
                            position: null,
                            amount: null,
                            rarities: [
                                {
                                    rarity: 3,
                                    total_amount: 321,
                                    total_rate: "10.000",
                                    featured_amount: 7,
                                    featured_rate: "5.000",
                                    normal_amount: 314,
                                    normal_rate: "5.000",
                                },
                            ],
                        },
                    ],
                },
            ],
        });
        (0, assert_1.equal)(detail.id, "12338");
        (0, assert_1.equal)(detail.featuredCharacters.length, 1);
        (0, assert_1.equal)(detail.featuredCharacters[0].name, "Gohan (Beast)");
        (0, assert_1.equal)(detail.featuredCharacters[0].rarity, "SSR");
        (0, assert_1.equal)(detail.featuredCharacters[0].type, "TEQ");
        (0, assert_1.equal)(detail.featuredCharacters[0].characterClass, "Super");
        (0, assert_1.equal)(detail.featuredCharacters[0].isNew, true);
        (0, assert_1.equal)(detail.featuredCharacters[0].isDokkanFestFeatured, true);
        (0, assert_1.equal)(detail.steps.length, 1);
        (0, assert_1.equal)(detail.steps[0].rates[0].rarities[0].featuredRate, 5);
    });
});
(0, mocha_1.describe)("buildSummonIndexDataset", function () {
    (0, mocha_1.it)("wraps active summon summaries with dataset metadata", () => {
        const dataset = (0, fyi_summons_1.buildSummonIndexDataset)([
            {
                id: "12338",
                name: "Dokkan Festival [Gohan (Beast)]",
                description: "Banner text",
                category: "Recommended",
                isCurrentlyActive: true,
            },
        ], [
            {
                id: 1,
                label: "Recommended",
            },
        ]);
        (0, assert_1.equal)(dataset.activeOnly, true);
        (0, assert_1.equal)(dataset.count, 1);
        (0, assert_1.equal)(dataset.categories.length, 1);
    });
});
(0, mocha_1.describe)("buildSummonDetailsDataset", function () {
    (0, mocha_1.it)("wraps active summon details with dataset metadata", () => {
        const dataset = (0, fyi_summons_1.buildSummonDetailsDataset)([
            {
                id: "12338",
                name: "Dokkan Festival [Gohan (Beast)]",
                description: "Banner text",
                category: "Recommended",
                isCurrentlyActive: true,
                featuredCharacters: [],
                steps: [],
            },
        ]);
        (0, assert_1.equal)(dataset.activeOnly, true);
        (0, assert_1.equal)(dataset.count, 1);
        (0, assert_1.equal)(dataset.summons.length, 1);
    });
});
//# sourceMappingURL=fyi-summons.spec.js.map