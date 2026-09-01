"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const jsdom_1 = require("jsdom");
const dokkaninfo_z_battles_1 = require("./dokkaninfo-z-battles");
describe("DokkanInfo Z-Battle dataset", () => {
    it("discovers and normalizes Z-Battles from the index payload", () => {
        const dom = new jsdom_1.JSDOM("<events></events>");
        dom.window.document.querySelector("events").setAttribute("v-bind:eventjson", JSON.stringify([
            {
                id: 210,
                type: "ZBattleStage::Normal",
                z_battle_stage_effect_escalation_type: 210,
                banner_image_path: "zbattle_list_banner_210.png",
                listbutton_image_path: "banners/en/event/eve_listbutton/myp_banner_event_zbattle_210.png",
                announcement_id: 300909,
                priority: 2026082101,
                start_at: "2026-08-22 05:00:00",
                end_at: "2026-10-20 07:59:59",
                enable_battle_auto: 1,
                cpu_friend_list_id: 514,
                unlock_conditions: "{}",
            },
            { id: 1, type: "ZBattleStage::Normal" },
        ]));
        const mapped = (0, dokkaninfo_z_battles_1.mapDokkanInfoZBattleIndex)(dom.window.document);
        (0, assert_1.deepEqual)(mapped.map(value => value.id), ["1", "210"]);
        (0, assert_1.equal)(mapped[1].sourcePath, "https://dokkaninfo.com/events/zbattle/210");
        (0, assert_1.equal)(mapped[1].announcementId, "300909");
        (0, assert_1.equal)(mapped[1].enableBattleAuto, true);
        (0, assert_1.equal)(mapped[1].bannerPath, "zbattle_list_banner_210.png");
    });
    it("maps weaknesses, conditions, ranges, enemies, skills and reward columns", () => {
        const dom = new jsdom_1.JSDOM(`
            <title>All-Out Ultimate Battle | Dokkan Info!</title>
            <div class="row font-size-1_5">
                <div><a href="/categories/43">Target: Goku</a></div><div>1</div>
            </div>
            <a href="/events/zbattle/210/stats">Stats</a>
            <div class="row">Level Enemy Skills Damage Reduction Medals Orbs Cards Replay Drops Stones</div>
            <div class="row bg-main"><div class="col-md">
                <div class="row"><div>SSR or lower can only cause limited damage</div></div>
                <div class="row range">
                    <div>11+</div>
                    <div><card-icon v-bind:card='{"id":9028061,"name":"Goku & Vegeta","element":"12","icon_id":1028060,"resource_id":1028061}'></card-icon></div>
                    <div><img src="/assets/global/en/ingame/common/condition/st_1005.png"></div>
                    <div>90%</div>
                    <div><reward v-bind:reward='{"item_id":103104,"item_type":"AwakeningItem","quantity":3,"item":{"name":"Rainbow Medal"}}'></reward></div>
                    <div><reward v-bind:reward='{"item_id":3,"item_type":"PotentialItem","quantity":430,"item":{"name":"INT Orb"}}'></reward></div>
                    <div>x2 <card-icon v-bind:card='{"id":1012250,"name":"Grand Kai [INT]","icon_id":1012250}'></card-icon></div>
                    <div>None</div>
                    <div><reward v-bind:reward='{"item_id":11,"item_type":"Point::Stone","quantity":3,"item":{"type":"Dragon Stone"}}'></reward></div>
                </div>
            </div></div>
        `);
        const shell = (0, dokkaninfo_z_battles_1.mapDokkanInfoZBattleEvent)(dom.window.document, {
            id: "210",
            type: "ZBattleStage::Normal",
            sourcePath: "https://dokkaninfo.com/events/zbattle/210",
            escalationTypeId: "210",
        });
        (0, assert_1.equal)(shell.displayName, "All-Out Ultimate Battle");
        (0, assert_1.equal)(shell.statsPath, "https://dokkaninfo.com/events/zbattle/210/stats");
        (0, assert_1.deepEqual)(shell.weaknesses, [{ kind: "category", id: "43", name: "Target: Goku", startsAtLevel: 1 }]);
        (0, assert_1.deepEqual)(shell.conditions, [{ text: "SSR or lower can only cause limited damage", startsAtLevel: 11 }]);
        (0, assert_1.equal)(shell.ranges.length, 1);
        (0, assert_1.equal)(shell.ranges[0].startLevel, 11);
        (0, assert_1.equal)(shell.ranges[0].endLevel, null);
        (0, assert_1.equal)(shell.ranges[0].enemy?.id, "9028061");
        (0, assert_1.equal)(shell.ranges[0].skillIcons[0].id, "1005");
        (0, assert_1.equal)(shell.ranges[0].damageReductionPercent, 90);
        (0, assert_1.equal)(shell.ranges[0].medalRewards[0].name, "Rainbow Medal");
        (0, assert_1.equal)(shell.ranges[0].cardRewards[0].quantity, 2);
        (0, assert_1.equal)(shell.ranges[0].stoneRewards[0].rewardType, "Dragon Stone");
    });
    it("maps every rendered stats row without retaining the repeated card payload", () => {
        const dom = new jsdom_1.JSDOM(`
            <div>
                <div class="row">Level Enemy HP ATK DEF</div>
                <div class="row"><div>1</div><div><card-icon v-bind:card='{"id":9028041,"name":"Enemy"}'></card-icon></div><div>110,000,000</div><div>970,000</div><div>70,000</div></div>
                <div class="row"><div>2</div><div><card-icon v-bind:card='{"id":9028041,"name":"Enemy"}'></card-icon></div><div>115,500,000</div><div>989,400</div><div>70,000</div></div>
            </div>
        `);
        (0, assert_1.deepEqual)((0, dokkaninfo_z_battles_1.mapDokkanInfoZBattleStats)(dom.window.document), [
            { level: 1, enemyCardId: "9028041", hp: 110000000, atk: 970000, def: 70000 },
            { level: 2, enemyCardId: "9028041", hp: 115500000, atk: 989400, def: 70000 },
        ]);
    });
    it("reports event and stats failures separately", () => {
        const dataset = (0, dokkaninfo_z_battles_1.buildDokkanInfoZBattleDataset)([{
                id: "210",
                type: "ZBattleStage::Normal",
                displayName: "Battle",
                sourcePath: "https://dokkaninfo.com/events/zbattle/210",
                statsPath: "https://dokkaninfo.com/events/zbattle/210/stats",
                images: {},
                availability: {},
                weaknesses: [],
                conditions: [],
                ranges: [],
                statsDataStatus: "fetch-failed",
                levels: [],
            }], ["209", "209"], ["210", "210"]);
        (0, assert_1.equal)(dataset.eventCount, 1);
        (0, assert_1.deepEqual)(dataset.failedEventIds, ["209"]);
        (0, assert_1.deepEqual)(dataset.failedStatsIds, ["210"]);
    });
});
//# sourceMappingURL=dokkaninfo-z-battles.spec.js.map