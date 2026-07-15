import { deepEqual, equal } from "assert";
import { describe, it } from "mocha";
import {
    extractLwfTextureFileNames,
    parseDokkanInfoSupportMemoryRow,
} from "./dokkaninfo-support-memory-enrichment";

describe("dokkaninfo support memory enrichment", function () {
    it("parses support memory rows from the DokkanInfo list markup", () => {
        const entry = parseDokkanInfoSupportMemoryRow("10001", `
            <a href="https://dokkaninfo.com/items/supportmemories/10001" class="row align-items-center border border-top border-1 border-lighter padding-top-bottom-10">
                <div class="col-sm-1 unselectable"><img alt="support_memory_large_10001" height="100" src="/assets/global/en/item/support_memory/large/support_memory_large_10001.png"></div>
                <div class="col-sm-2 font-size-1_5">Oolong&#039;s Wish</div>
                <div class="col-sm-4 font-size-1_2">
                    <div class="row"><div class="col-sm"><b>Level 1:</b> Chance of obtaining bonus rewards +50% in events with the special effect &quot;Bonus Reward Drop Rate Increased&quot; (once only)</div></div>
                    <div class="row padding-top-5"><div class="col-sm"><b>Level 3:</b> Chance of obtaining bonus rewards +85% in events with the special effect &quot;Bonus Reward Drop Rate Increased&quot; (once only)</div></div>
                </div>
                <div class="col-sm-1 unselectable"><img alt="support_memory_large_sepia_10001" height="100" src="/assets/global/en/item/support_memory/large/support_memory_large_sepia_10001.png"><br>x100</div>
                <div class="col-sm-2 unselectable"><img alt="support_memory_film_original" height="100" src="/assets/global/en/item/support_memory/film_icon/support_memory_film_original.png"><br>x70</div>
                <div class="col-sm-2">
                    <div class="row d-flex flex-wrap unselectable">
                        <div class="col"><img alt="100011" height="75" src="/assets/global/en/item/support_memory_enhancement/100011/100011.png"><br>x15</div>
                        <div class="col"><img alt="100012" height="75" src="/assets/global/en/item/support_memory_enhancement/100012/100012.png"><br>x20</div>
                    </div>
                </div>
            </a>
        `);

        equal(entry.id, "10001");
        equal(entry.name, "Oolong's Wish");
        equal(entry.detailUrl, "https://dokkaninfo.com/items/supportmemories/10001");
        equal(entry.largeAsset?.remoteUrl, "https://dokkaninfo.com/assets/global/en/item/support_memory/large/support_memory_large_10001.png");
        equal(entry.completeAsset?.quantity, 100);
        equal(entry.completeAsset?.remoteUrl, "https://dokkaninfo.com/assets/global/en/item/support_memory/large/support_memory_large_sepia_10001.png");
        equal(entry.requiredFilm?.filmCode, "original");
        equal(entry.requiredFilm?.quantity, 70);
        deepEqual(entry.levelDescriptions, [
            {
                level: 1,
                description: "Chance of obtaining bonus rewards +50% in events with the special effect \"Bonus Reward Drop Rate Increased\" (once only)",
            },
            {
                level: 3,
                description: "Chance of obtaining bonus rewards +85% in events with the special effect \"Bonus Reward Drop Rate Increased\" (once only)",
            },
        ]);
        deepEqual(entry.enhancementItems.map(item => ({
            id: item.id,
            quantity: item.quantity,
            remoteUrl: item.asset.remoteUrl,
        })), [
            {
                id: "100011",
                quantity: 15,
                remoteUrl: "https://dokkaninfo.com/assets/global/en/item/support_memory_enhancement/100011/100011.png",
            },
            {
                id: "100012",
                quantity: 20,
                remoteUrl: "https://dokkaninfo.com/assets/global/en/item/support_memory_enhancement/100012/100012.png",
            },
        ]);
        equal(entry.animation?.remoteBaseUrl, "https://glben.dokkaninfo.com/assets/global/en/ingame/battle/effect/support_memory_10001/en/");
        equal(entry.animation?.status, "pending");
    });

    it("extracts texture file names from lwf payloads", () => {
        const buffer = Buffer.from([
            "LWF",
            "support_memory_10001_0.png",
            "Images_bg_01_D.png",
            "support_memory_10001_1.png",
            "ef_001",
            "support_memory_10001_0.png",
        ].join("\u0000"), "latin1");

        deepEqual(extractLwfTextureFileNames(buffer), [
            "Images_bg_01_D.png",
            "support_memory_10001_0.png",
            "support_memory_10001_1.png",
        ]);
    });
});
