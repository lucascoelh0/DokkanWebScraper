"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const jsdom_1 = require("jsdom");
const pettan_battle_catalog_1 = require("./pettan-battle-catalog");
describe("Pettan Battle catalog", () => {
    it("discovers numbered series and binder artwork", () => {
        const dom = new jsdom_1.JSDOM(`
            <a href="/events/sdbattle/25">
                <div class="sd-binder"><img src="/assets/global/en/sd_battle/binder/binder_00025.png"></div>
                <div class="sd-total">No. of Stickers: 37</div>
                <div class="sd-series-text">Series 25</div>
            </a>
            <a href="/events/sdbattle/2">
                <div class="sd-binder"><img src="/assets/global/en/sd_battle/binder/binder_00002.png"></div>
                <div class="sd-total">No. of Stickers: 1</div>
                <div class="sd-series-text">Series 2</div>
            </a>
        `);
        (0, assert_1.deepEqual)((0, pettan_battle_catalog_1.mapPettanBattleIndex)(dom.window.document), [{
                id: "2",
                name: "Series 2",
                sourcePath: "https://dokkaninfo.com/events/sdbattle/2",
                binderImagePath: "https://dokkaninfo.com/assets/global/en/sd_battle/binder/binder_00002.png",
                advertisedStickerCount: 1,
            }, {
                id: "25",
                name: "Series 25",
                sourcePath: "https://dokkaninfo.com/events/sdbattle/25",
                binderImagePath: "https://dokkaninfo.com/assets/global/en/sd_battle/binder/binder_00025.png",
                advertisedStickerCount: 37,
            }]);
    });
    it("maps the complete front and back visual contract", () => {
        const summary = {
            id: "2",
            name: "Series 2",
            sourcePath: "https://dokkaninfo.com/events/sdbattle/2",
            advertisedStickerCount: 1,
        };
        const dom = new jsdom_1.JSDOM(`
            <div class="col-lg">
                <div class="flip-card">
                    <div class="icon-power-front">7,000</div>
                    <img src="/assets/global/en/sd_battle/sd_card/1000020/sd_card_1000020_bg.png">
                    <img src="/assets/global/en/sd_battle/sd_card/1000020/sd_card_1000020.png">
                    <img src="/assets/global/en/sd_battle/sd_card/1000020/sd_card_1000020_effect.png">
                    <img src="/assets/global/en/sd_battle/sd_card_frame/sd_card_frame_type_01.png">
                    <img src="/assets/global/en/sd_battle/sd_card_frame/sd_card_frame_rarity_02.png">
                    <img src="/assets/global/en/layout/en/image/sd_battle/sdb_seal_back_bg.png">
                    <img src="/assets/global/en/sd_battle/sd_card/1000020/sd_card_1000020_face.png">
                    <img src="/assets/global/en//layout/en/image/sd_battle/sdb_seal_back_face_frame.png">
                    <div class="icon-type-back">E. TEQ</div>
                    <div class="icon-open-date">2021/07/26</div>
                    <div class="icon-character-details">Can be recruited from Summons.</div>
                    <div class="sd-number">044</div>
                    <div class="sd-series">Series 2</div>
                    <div class="sd-card-name">Super Saiyan Vegeta</div>
                    <div class="sd-leader-skill-name">Pride Regained</div>
                </div>
            </div>
        `);
        const [sticker] = (0, pettan_battle_catalog_1.mapPettanBattleSeries)(dom.window.document, summary);
        (0, assert_1.equal)(sticker.cardId, "1000020");
        (0, assert_1.equal)(sticker.series, 2);
        (0, assert_1.equal)(sticker.number, 44);
        (0, assert_1.equal)(sticker.displayedPower, 7000);
        (0, assert_1.equal)(sticker.printedTypeLabel, "E. TEQ");
        (0, assert_1.equal)("typeLabel" in sticker, false);
        (0, assert_1.equal)(sticker.rarityFrameRaw, 2);
        (0, assert_1.equal)(sticker.front.effectPath, "https://dokkaninfo.com/assets/global/en/sd_battle/sd_card/1000020/sd_card_1000020_effect.png");
        (0, assert_1.equal)(sticker.back.facePath, "https://dokkaninfo.com/assets/global/en/sd_battle/sd_card/1000020/sd_card_1000020_face.png");
        (0, assert_1.equal)(sticker.back.framePath, "https://dokkaninfo.com/assets/global/en/layout/en/image/sd_battle/sdb_seal_back_face_frame.png");
    });
    it("keeps official metadata authoritative and audits exact visual parity", () => {
        const summary = {
            id: "2",
            name: "Series 2",
            sourcePath: "https://dokkaninfo.com/events/sdbattle/2",
            advertisedStickerCount: 1,
        };
        const dataset = (0, pettan_battle_catalog_1.buildPettanBattleDataset)([{
                id: 1000020,
                card_id: 1000020,
                attack: 7000,
                hp: 8400,
                element: 21,
                rarity: 2,
                series: 2,
                number: 44,
                description: "Can be recruited from Summons.",
                open_at: "2021-07-26 06:30:00",
                card_name: "Super Saiyan Vegeta",
                card_element: 21,
                leader_skill_name: "Pride Regained",
            }], [{ summary, stickers: [{
                        cardId: "1000020",
                        series: 2,
                        number: 44,
                        displayedPower: 7000,
                        printedTypeLabel: "E. TEQ",
                        description: "Can be recruited from Summons.",
                        availableDate: "2021/07/26",
                        cardName: "Super Saiyan Vegeta",
                        leaderSkillName: "Pride Regained",
                        rarityFrameRaw: 2,
                        sourcePath: summary.sourcePath,
                        front: {
                            backgroundPath: "front-bg",
                            characterPath: "front-character",
                            typeFramePath: "front-type",
                            rarityFramePath: "front-rarity",
                        },
                        back: {
                            backgroundPath: "back-bg",
                            facePath: "back-face",
                            framePath: "back-frame",
                        },
                    }] }], { fileName: "database.db", sha256: "a".repeat(64), sizeBytes: 10 });
        (0, assert_1.equal)(dataset.stickerCount, 1);
        (0, assert_1.equal)(dataset.joinedStickerCount, 1);
        (0, assert_1.equal)(dataset.audit.mismatchCount, 0);
        (0, assert_1.equal)(dataset.series[0].stickers[0].hp, 8400);
        (0, assert_1.equal)("typeLabel" in dataset.series[0].stickers[0], false);
        (0, assert_1.deepEqual)(dataset.audit.observedPrintedTypeLabels, [{ elementRaw: 21, cardElementRaw: 21, printedTypeLabel: "E. TEQ" }]);
    });
});
//# sourceMappingURL=pettan-battle-catalog.spec.js.map