"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const mocha_1 = require("mocha");
const character_1 = require("../character");
const portrait_assets_1 = require("./portrait-assets");
(0, mocha_1.describe)("portrait asset helpers", function () {
    (0, mocha_1.it)("normalizes asset ids and portrait output urls", () => {
        (0, assert_1.equal)((0, portrait_assets_1.normalizeAssetId)(1025731), 1025730);
        (0, assert_1.equal)((0, portrait_assets_1.portraitOutputUrl)("portrait_1025731"), "images/portrait_1025731.png");
        (0, assert_1.equal)((0, portrait_assets_1.cardArtUrlFromCardId)("1025731"), "https://dokkaninfo.com/assets/global/en/character/card/1025730/1025730.png");
    });
    (0, mocha_1.it)("builds a portrait spec from game-db element codes", () => {
        (0, assert_1.deepEqual)((0, portrait_assets_1.portraitSpecFromElement)("1033061", character_1.Rarities.LR, "24"), {
            iconId: 1033060,
            frameColorId: 4,
            rarity: character_1.Rarities.LR,
            elementCode: "24",
        });
    });
});
//# sourceMappingURL=portrait-assets.spec.js.map