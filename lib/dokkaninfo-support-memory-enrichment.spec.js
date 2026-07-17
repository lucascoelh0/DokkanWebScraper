"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const mocha_1 = require("mocha");
const dokkaninfo_support_memory_enrichment_1 = require("./dokkaninfo-support-memory-enrichment");
(0, mocha_1.describe)("dokkaninfo support memory enrichment", function () {
    (0, mocha_1.it)("parses support memory rows from the DokkanInfo list markup", () => {
        const entry = (0, dokkaninfo_support_memory_enrichment_1.parseDokkanInfoSupportMemoryRow)("10001", `
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
        (0, assert_1.equal)(entry.id, "10001");
        (0, assert_1.equal)(entry.name, "Oolong's Wish");
        (0, assert_1.equal)(entry.detailUrl, "https://dokkaninfo.com/items/supportmemories/10001");
        (0, assert_1.equal)(entry.largeAsset?.remoteUrl, "https://dokkaninfo.com/assets/global/en/item/support_memory/large/support_memory_large_10001.png");
        (0, assert_1.equal)(entry.completeAsset?.quantity, 100);
        (0, assert_1.equal)(entry.completeAsset?.remoteUrl, "https://dokkaninfo.com/assets/global/en/item/support_memory/large/support_memory_large_sepia_10001.png");
        (0, assert_1.equal)(entry.requiredFilm?.filmCode, "original");
        (0, assert_1.equal)(entry.requiredFilm?.quantity, 70);
        (0, assert_1.deepEqual)(entry.levelDescriptions, [
            {
                level: 1,
                description: "Chance of obtaining bonus rewards +50% in events with the special effect \"Bonus Reward Drop Rate Increased\" (once only)",
            },
            {
                level: 3,
                description: "Chance of obtaining bonus rewards +85% in events with the special effect \"Bonus Reward Drop Rate Increased\" (once only)",
            },
        ]);
        (0, assert_1.deepEqual)(entry.enhancementItems.map(item => ({
            itemType: item.itemType,
            itemKey: item.itemKey,
            id: item.id,
            quantity: item.quantity,
            remoteUrl: item.asset.remoteUrl,
        })), [
            {
                itemType: "SupportMemoryEnhancementItem",
                itemKey: "SupportMemoryEnhancementItem:100011",
                id: "100011",
                quantity: 15,
                remoteUrl: "https://dokkaninfo.com/assets/global/en/item/support_memory_enhancement/100011/100011.png",
            },
            {
                itemType: "SupportMemoryEnhancementItem",
                itemKey: "SupportMemoryEnhancementItem:100012",
                id: "100012",
                quantity: 20,
                remoteUrl: "https://dokkaninfo.com/assets/global/en/item/support_memory_enhancement/100012/100012.png",
            },
        ]);
        (0, assert_1.equal)(entry.animation?.remoteBaseUrl, "https://glben.dokkaninfo.com/assets/global/en/ingame/battle/effect/support_memory_10001/en/");
        (0, assert_1.equal)(entry.animation?.status, "pending");
    });
    (0, mocha_1.it)("extracts texture file names from lwf payloads", () => {
        const buffer = Buffer.from([
            "LWF",
            "support_memory_10001_0.png",
            "Images_bg_01_D.png",
            "support_memory_10001_1.png",
            "ef_001",
            "support_memory_10001_0.png",
        ].join("\u0000"), "latin1");
        (0, assert_1.deepEqual)((0, dokkaninfo_support_memory_enrichment_1.extractLwfTextureFileNames)(buffer), [
            "Images_bg_01_D.png",
            "support_memory_10001_0.png",
            "support_memory_10001_1.png",
        ]);
    });
});
//# sourceMappingURL=dokkaninfo-support-memory-enrichment.spec.js.map