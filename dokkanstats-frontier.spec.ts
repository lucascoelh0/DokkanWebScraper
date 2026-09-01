import assert = require("assert");
import {
    buildDokkanStatsFrontierDataset,
    parseDokkanStatsCardSkins,
    parseDokkanStatsMissionCategory,
} from "./dokkanstats-frontier";

describe("DokkanStats Frontier enrichment", () => {
    it("extracts English card-skin identity without executing the inline script", () => {
        const html = `<!doctype html><html><body><script>(function(){
const items = [{"id":75,"card_id":1028721,"step":3,"name":"【前代未聞の強者集団】ギニュー(特戦隊)","description":"Unlock it.","bgm_id":349}];
const category = "card-skins";
const skinCardMap = {"1028721":[null,"INT","Extreme","LR","Captain Ginyu (Ginyu Force)","Unprecedented Elite Team"]};
const equipCardMap = {};
window.__ITEMS_DATA__ = items;
})();</script></body></html>`;

        const skins = parseDokkanStatsCardSkins(html);

        assert.equal(skins.length, 1);
        assert.equal(skins[0].id, "75");
        assert.equal(skins[0].cardId, "1028721");
        assert.equal(skins[0].step, 3);
        assert.equal(skins[0].rawName, "【前代未聞の強者集団】ギニュー(特戦隊)");
        assert.equal(skins[0].displayName, "Unprecedented Elite Team Captain Ginyu (Ginyu Force)");
        assert.equal(skins[0].bgmId, "349");
    });

    it("extracts mission evidence, reward IDs and dates from static HTML", () => {
        const html = `<!doctype html><html><body><div class="detail-heading"><span class="detail-count">1 missions</span></div>
<div class="mission-card-square">
  <p class="mission-name">Clear Node 14 under special conditions.</p>
  <p class="mission-desc-short">Clear Node 14 within 4 turns!</p>
  <div class="reward-icon-wrapper"><div class="drop-icon-wrapper" title="Card Skin ID: 75">
    <img src="https://assets.dokkanstats.com/skin.png" alt="Card Skin"><div class="drop-amount">x1</div>
  </div></div>
  <div class="mission-dates">
    <span class="date-item"><span class="date-label">Start</span><span class="date-value">2026-06-18<span class="date-time">05:00</span></span></span>
    <span class="date-item date-item-end"><span class="date-label">End</span><span class="date-chip">No Expiry</span></span>
  </div>
</div></body></html>`;

        const category = parseDokkanStatsMissionCategory(html, "200101");

        assert.equal(category.missionCount, 1);
        assert.equal(category.missions[0].name, "Clear Node 14 under special conditions.");
        assert.equal(category.missions[0].rewards[0].itemId, "75");
        assert.equal(category.missions[0].rewards[0].quantity, 1);
        assert.equal(category.missions[0].startsAt, "2026-06-18 05:00");
        assert.equal(category.missions[0].endsAt, undefined);
    });

    it("reads the advertised count from its own element when adjacent markup has no whitespace", () => {
        const html = `<!doctype html><html><body><span class="detail-count">1 missions</span><div class="mission-card-square"><p class="mission-name">Mission</p><p class="mission-desc-short">Description</p><div class="reward-icon-wrapper"><a class="drop-icon-wrapper" title="EquipmentSkillItem ID: 8520"><img alt="Equipment Skill"></a></div></div></body></html>`;

        const category = parseDokkanStatsMissionCategory(html, "200101");

        assert.equal(category.advertisedCount, 1);
        assert.equal(category.missionCount, 1);
        assert.equal(category.missions[0].rewards[0].quantity, 1);
    });

    it("fails closed when the advertised mission count differs from the rendered cards", () => {
        assert.throws(
            () => parseDokkanStatsMissionCategory("<html><body>2 missions</body></html>", "200101"),
            /advertised 2 missions but exposed 0/,
        );
    });

    it("builds deterministic source ordering and counts", () => {
        const dataset = buildDokkanStatsFrontierDataset(
            [{
                id: "75",
                cardId: "1028721",
                step: 3,
                displayName: "Unprecedented Elite Team Captain Ginyu (Ginyu Force)",
                cardTitle: "Unprecedented Elite Team",
                characterName: "Captain Ginyu (Ginyu Force)",
                sourceUrl: "https://dokkanstats.com/en/items/card-skins/75/",
            }],
            [{
                categoryId: "200101",
                sourceUrl: "https://dokkanstats.com/en/missions/200101/",
                advertisedCount: 1,
                missionCount: 1,
                missions: [{ sequence: 1, name: "Mission", description: "Description", rewards: [] }],
            }],
            "2026-09-01T00:00:00.000Z",
        );

        assert.equal(dataset.cardSkinCount, 1);
        assert.equal(dataset.missionCategoryCount, 1);
        assert.equal(dataset.missionCount, 1);
    });
});
