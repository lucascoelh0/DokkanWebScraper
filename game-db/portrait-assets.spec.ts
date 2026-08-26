import { deepEqual, equal, throws } from "assert";
import { describe, it } from "mocha";
import { Rarities } from "../character";
import {
    assertPortraitFilename,
    cardArtUrlFromCardId,
    normalizeAssetId,
    portraitOutputUrl,
    portraitSpecFromOfficialCard,
    portraitSpecFromElement,
} from "./portrait-asset-contract";

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
        deepEqual(portraitSpecFromElement("1000070", Rarities.SR, "0"), {
            iconId: 1000070,
            frameColorId: 0,
            rarity: Rarities.SR,
            elementCode: "00",
        });
        throws(() => portraitSpecFromElement("1033061x", Rarities.LR, "24"), /invalid card ID/);
        throws(() => portraitSpecFromElement("1033061", Rarities.LR, "15"), /unsupported element code/);
    });

    it("uses the official shared portrait resource when cards.csv provides one", () => {
        deepEqual(portraitSpecFromOfficialCard("1015830", Rarities.SSR, "14", "1015820"), {
            iconId: 1015820,
            frameColorId: 4,
            rarity: Rarities.SSR,
            elementCode: "14",
        });
        deepEqual(portraitSpecFromOfficialCard("3000210", Rarities.N, "0", "1000660"), {
            iconId: 1000660,
            frameColorId: 0,
            rarity: Rarities.N,
            elementCode: "00",
        });
        equal(portraitSpecFromOfficialCard("1015831", Rarities.UR, "14", "1015821").iconId, 1015820);
        throws(() => portraitSpecFromOfficialCard("1015830", Rarities.SSR, "14", "0"), /invalid official resource ID/);
    });

    it("rejects portrait filenames that could escape the output directory", () => {
        for (const value of ["../portrait_1", "portrait_1/../../latest", "C:\\portrait_1", "portrait_alpha", "portrait_1.png"]) {
            throws(() => assertPortraitFilename(value), /canonical/);
        }
        assertPortraitFilename("portrait_1033061");
    });
});

