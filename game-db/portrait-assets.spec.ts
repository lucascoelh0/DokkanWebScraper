import { deepEqual, equal, throws } from "assert";
import { describe, it } from "mocha";
import { Rarities } from "../character";
import {
    assertPortraitFilename,
    cardArtUrlFromCardId,
    normalizeAssetId,
    portraitOutputUrl,
    portraitSpecFromElement,
} from "./portrait-assets";

describe("portrait asset helpers", function () {
    it("normalizes asset ids and portrait output urls", () => {
        equal(normalizeAssetId(1025731), 1025730);
        equal(portraitOutputUrl("portrait_1025731"), "images/portrait_1025731.png");
        equal(
            cardArtUrlFromCardId("1025731"),
            "https://dokkaninfo.com/assets/global/en/character/card/1025730/1025730.png",
        );
    });

    it("builds a portrait spec from game-db element codes", () => {
        deepEqual(portraitSpecFromElement("1033061", Rarities.LR, "24"), {
            iconId: 1033060,
            frameColorId: 4,
            rarity: Rarities.LR,
            elementCode: "24",
        });
    });

    it("rejects portrait filenames that could escape the output directory", () => {
        for (const value of ["../portrait_1", "portrait_1/../../latest", "C:\\portrait_1", "portrait_alpha", "portrait_1.png"]) {
            throws(() => assertPortraitFilename(value), /canonical/);
        }
        assertPortraitFilename("portrait_1033061");
    });
});

