import { deepEqual, equal } from "assert";
import { JSDOM } from "jsdom";
import { mapBurstDetail, mapBurstIndexPage } from "./dokkaninfo-burst-mode";
import { mapFrontierEpisode, mapFrontierIndex, mapFrontierSeries } from "./dokkaninfo-frontier";
import { mapUltimateClashDetail, mapUltimateClashIndexPage } from "./dokkaninfo-ultimate-clash";

describe("DokkanInfo special event collectors", () => {
    it("maps Frontier series, episodes, and battle identity without flattening the hierarchy", () => {
        const index = new JSDOM(`
            <a href="/events/dokkanfrontier/99">
                <img src="/assets/global/en/origin/series_banner/99.png">
                <div class="font-size-2_5">EXTRA</div>
            </a>
        `);
        const [series] = mapFrontierIndex(index.window.document);
        equal(series.id, "99");
        equal(series.name, "EXTRA");

        const seriesPage = new JSDOM(`
            <a href="/events/dokkanfrontier/99/99001">
                <img src="/assets/global/en/origin/episode_banner/99001.png">
                <div class="font-size-2_5">Red Ribbon Army Edition</div>
            </a>
        `);
        const [episode] = mapFrontierSeries(seriesPage.window.document, series);
        equal(episode.seriesId, "99");

        const episodePage = new JSDOM(`
            <title>Red Ribbon Army Edition - Dokkan Frontier | Dokkan Info!</title>
            <a href="/events/dokkanfrontier/99/99001/9900101/990010101">
                <div class="col-sm"><div class="row"><b>Number:</b></div><div class="row">1</div></div>
                <div class="col-sm-2"><div class="row"><b>Title:</b></div><div class="row">Vs. Colonel Silver</div></div>
                <div class="col-sm"><div class="row"><b>STA</b></div><div class="row">10</div></div>
                <div class="col-sm"><div class="row"><b>User Exp</b></div><div class="row">10,000</div></div>
                <div class="col-sm"><div class="row"><b>Zeni</b></div><div class="row">100,000</div></div>
                <div class="col-sm"><div class="row"><b>Link Level Rate</b></div><div class="row">0.5</div></div>
                <img src="/assets/global/en/character/thumb/card_1_thumb/card_1_thumb.png">
                <reward v-bind:reward='{"item_type":"Point::Stone","quantity":1}'></reward>
            </a>
        `);
        const mapped = mapFrontierEpisode(episodePage.window.document, episode);
        equal(mapped.battles[0].pageId, "9900101");
        equal(mapped.battles[0].id, "990010101");
        equal(mapped.battles[0].title, "Vs. Colonel Silver");
        equal(mapped.battles[0].userExp, 10000);
        equal(mapped.battles[0].clearRewards[0].quantity, 1);
    });

    it("keeps Burst modifier groups positional when DokkanInfo exposes no modifier IDs", () => {
        const index = new JSDOM(`
            <genkai-battles v-bind:genkai_battles_json='{
                "current_page":1,"last_page":1,"total":1,
                "data":[{"id":48,"sugoroku_map_id":15110023,"area_id":1511,"start_at":100,"end_at":200,"genkai_battle_schedule_id":52,"listbutton_image":"banner.png"}]
            }'></genkai-battles>
        `);
        const page = mapBurstIndexPage(index.window.document);
        equal(page.total, 1);

        const detail = new JSDOM(`
            <title>Battle of Ki | Dokkan Info!</title>
            <unix-to-date timestamp="100"></unix-to-date><unix-to-date timestamp="200"></unix-to-date>
            <img src="/assets/global/en/ingame/genkaibattle/banner.png">
            <div class="row margin-top-5 border-radius-10 bg-main-box margin-3 bg-main">
                <div class="row font-size-1_5 container-text-light padding-top-bottom-5">
                    <div class="col-sm-10">[Selection] Enemy ATK +100%</div><div class="col-sm">200</div>
                </div>
                <div class="row font-size-1_5 container-text-light padding-top-bottom-5">
                    <div class="col-sm-10">Enemy ATK +50%</div><div class="col-sm">100</div>
                </div>
            </div>
        `);
        const mapped = mapBurstDetail(detail.window.document, page.modes[0]);
        equal(mapped.modifierGroups[0].groupIndex, 1);
        equal(mapped.modifierGroups[0].options[0].optionIndex, 1);
        equal(mapped.modifierGroups[0].options[0].selectedInSource, true);
        equal(mapped.modifierGroups[0].options[0].label, "Enemy ATK +100%");
        equal("id" in mapped.modifierGroups[0].options[0], false);
    });

    it("separates Ultimate Clash DOM order from the visual boss label", () => {
        const index = new JSDOM(`
            <rm-battles v-bind:rmbattles_json='{
                "current_page":1,"last_page":1,"total":1,
                "data":[{"id":99,"start_at":100,"end_at":200,"card_count_limit":112,"banner_image":"dummy.png","mission_reward_image":"mission.png","announcement_id":123}]
            }'></rm-battles>
        `);
        const page = mapUltimateClashIndexPage(index.window.document);
        const detail = new JSDOM(`
            <title>Ultimate Clash 99 | Dokkan Info!</title>
            <unix-to-date v-bind:timestamp="100"></unix-to-date><unix-to-date v-bind:timestamp="200"></unix-to-date>
            <img src="/assets/global/en/ingame/news/123/banner.png">
            <img src="/assets/global/en/ingame/rmbattles/mission.png">
            <div class="col-sm bg-main">
                <div class="row border-bottom bg-third"><img alt="Level"><img alt="3" src="/level-3.png"></div>
                <div class="row bg-main-box-text align-items-center">
                    <div class="col-sm-1"><img alt="7" src="/assets/global/en/layout/en/image/dairansen/dai_boss_label.png"></div>
                    <div class="col-sm-10"><div class="row"><div class="row padding-top-bottom-10 align-items-center">
                        <div class="col-2"><card-icon v-bind:card='{"id":52000001,"name":"Boss","element":"23","rarity":4,"icon_id":1000000}'></card-icon></div>
                        <div class="col-sm-2">
                            <div class="row"><b>Health Bars:</b> 10</div><div class="row"><b>HP:</b> 9,000,000</div>
                            <div class="row"><b>ATK:</b> 60,000</div><div class="row"><b>DEF:</b> 15,000</div>
                            <div class="row"><b>DR:</b> 50%</div><div class="row"><b>Super Attack</b></div>
                            <div class="row"><b>Damage:</b> 150,000</div>
                        </div>
                        <div class="col-sm-8"><div class="row"><div class="col-sm-9">Seals Super Attack</div><div class="col-sm-3">100%</div></div></div>
                    </div></div></div>
                    <div class="col-sm-1"><div class="row"><div class="col"><img alt="Reward" src="/reward.png"><div>x5</div></div></div></div>
                </div>
            </div>
            <mission v-bind:mission='{
                "id":99001,"type":"CountMission","name":"Clear once","description":"Clear once","priority":1,"target_value":1,
                "conditions":{"level":3},"mission_rewards":{"1":{"id":1,"item_id":11,"item_type":"Point::Stone","quantity":1}}
            }'></mission>
        `);
        const mapped = mapUltimateClashDetail(detail.window.document, page.clashes[0]);
        const enemy = mapped.levels[0].enemies[0];
        equal(enemy.sequence, 1);
        equal(enemy.displayLabelKind, "boss");
        equal(enemy.displayLabelRaw, "7");
        equal(enemy.hp, 9000000);
        equal(enemy.rewards[0].quantity, 5);
        deepEqual(mapped.missions[0].conditions, { level: 3 });
        equal(mapped.missions[0].rewards[0].itemType, "Point::Stone");
    });
});
