"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const mocha_1 = require("mocha");
const character_1 = require("../character");
const portrait_asset_contract_1 = require("./portrait-asset-contract");
(0, mocha_1.describe)("portrait asset helpers", function () {
    (0, mocha_1.it)("normalizes asset ids and portrait output urls", () => {
        (0, assert_1.equal)((0, portrait_asset_contract_1.normalizeAssetId)(1025731), 1025730);
        (0, assert_1.equal)((0, portrait_asset_contract_1.portraitOutputUrl)("portrait_1025731"), "images/portrait_1025731.png");
        (0, assert_1.equal)((0, portrait_asset_contract_1.cardArtUrlFromCardId)("1025731"), "https://dokkaninfo.com/assets/global/en/character/card/1025730/1025730.png");
    });
    (0, mocha_1.it)("builds a portrait spec from game-db element codes", () => {
        (0, assert_1.deepEqual)((0, portrait_asset_contract_1.portraitSpecFromElement)("1033061", character_1.Rarities.LR, "24"), {
            iconId: 1033060,
            frameColorId: 4,
            rarity: character_1.Rarities.LR,
            elementCode: "24",
        });
        (0, assert_1.deepEqual)((0, portrait_asset_contract_1.portraitSpecFromElement)("1000070", character_1.Rarities.SR, "0"), {
            iconId: 1000070,
            frameColorId: 0,
            rarity: character_1.Rarities.SR,
            elementCode: "00",
        });
        (0, assert_1.throws)(() => (0, portrait_asset_contract_1.portraitSpecFromElement)("1033061x", character_1.Rarities.LR, "24"), /invalid card ID/);
        (0, assert_1.throws)(() => (0, portrait_asset_contract_1.portraitSpecFromElement)("1033061", character_1.Rarities.LR, "15"), /unsupported element code/);
    });
    (0, mocha_1.it)("uses the official shared portrait resource when cards.csv provides one", () => {
        (0, assert_1.deepEqual)((0, portrait_asset_contract_1.portraitSpecFromOfficialCard)("1015830", character_1.Rarities.SSR, "14", "1015820"), {
            iconId: 1015820,
            frameColorId: 4,
            rarity: character_1.Rarities.SSR,
            elementCode: "14",
        });
        (0, assert_1.deepEqual)((0, portrait_asset_contract_1.portraitSpecFromOfficialCard)("3000210", character_1.Rarities.N, "0", "1000660"), {
            iconId: 1000660,
            frameColorId: 0,
            rarity: character_1.Rarities.N,
            elementCode: "00",
        });
        (0, assert_1.equal)((0, portrait_asset_contract_1.portraitSpecFromOfficialCard)("1015831", character_1.Rarities.UR, "14", "1015821").iconId, 1015820);
        (0, assert_1.throws)(() => (0, portrait_asset_contract_1.portraitSpecFromOfficialCard)("1015830", character_1.Rarities.SSR, "14", "0"), /invalid official resource ID/);
    });
    (0, mocha_1.it)("rejects portrait filenames that could escape the output directory", () => {
        for (const value of ["../portrait_1", "portrait_1/../../latest", "C:\\portrait_1", "portrait_alpha", "portrait_1.png"]) {
            (0, assert_1.throws)(() => (0, portrait_asset_contract_1.assertPortraitFilename)(value), /canonical/);
        }
        (0, portrait_asset_contract_1.assertPortraitFilename)("portrait_1033061");
    });
});
//# sourceMappingURL=portrait-assets.spec.js.map