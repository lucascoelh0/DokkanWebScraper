"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const jsdom_1 = require("jsdom");
const dokkaninfo_db_stories_1 = require("./dokkaninfo-db-stories");
describe("DokkanInfo DB Stories dataset", () => {
    it("maps unique DB Story links in numeric order", () => {
        const dom = new jsdom_1.JSDOM(`
            <a href="/events/dbstories/933">Story 933</a>
            <a href="https://dokkaninfo.com/events/dbstories/901">Story 901</a>
            <a href="/events/dbstories/901">Duplicate</a>
            <a href="/events/story/901">Wrong type</a>
        `);
        (0, assert_1.deepEqual)((0, dokkaninfo_db_stories_1.mapDbStoryIndex)(dom.window.document), [
            { id: "901", sourcePath: "https://dokkaninfo.com/events/dbstories/901" },
            { id: "933", sourcePath: "https://dokkaninfo.com/events/dbstories/933" },
        ]);
    });
    it("discovers Story events from the server component payload", () => {
        const dom = new jsdom_1.JSDOM(`<events></events>`);
        dom.window.document.querySelector("events").setAttribute("v-bind:eventjson", JSON.stringify([
            { id: 1314, name: "Super Warrior Memorial" },
            { id: 133, name: "Adventure of Gratitude" },
        ]));
        (0, assert_1.deepEqual)((0, dokkaninfo_db_stories_1.mapStoryIndex)(dom.window.document), [
            { id: "133", sourcePath: "https://dokkaninfo.com/events/story/133" },
            { id: "1314", sourcePath: "https://dokkaninfo.com/events/story/1314" },
        ]);
    });
    it("maps stage metadata from labelled cells instead of concatenated text", () => {
        const dom = new jsdom_1.JSDOM(`
            <div class="col-sm">
                <div class="font-size-1_5">Level 1: The Mysterious Alien Warrior</div>
                <a href="/events/dbstories/901/9010012">
                    <div><b>Z-HARD</b></div>
                    <div class="col-sm"><div class="row"><b>STA</b></div><div class="row">15</div></div>
                    <div class="col-sm"><div class="row"><b>User Exp</b></div><div class="row">9,900</div></div>
                    <div class="col-sm"><div class="row"><b>Zeni</b></div><div class="row">6,000</div></div>
                    <div class="col-sm"><div class="row"><b>Link Level Rate</b></div><div class="row">0.75</div></div>
                </a>
            </div>
        `);
        (0, assert_1.deepEqual)((0, dokkaninfo_db_stories_1.mapDbStoryStages)(dom.window.document, {
            id: "901",
            sourcePath: "https://dokkaninfo.com/events/dbstories/901",
        }), [{
                id: "9010012",
                title: "Level 1: The Mysterious Alien Warrior",
                level: 1,
                difficulty: "Z-HARD",
                stamina: 15,
                userExp: 9900,
                zeni: 6000,
                linkLevelRate: 0.75,
                sourcePath: "https://dokkaninfo.com/events/dbstories/901/9010012",
                enemyDataStatus: "not-provided",
                enemies: [],
            }]);
    });
    it("maps quest enemy presentation and leaves unavailable sections optional", () => {
        const dom = new jsdom_1.JSDOM(`
            <div class="row margin-5 border border-1 border-main-box-darker bg-main">
                <div class="row d-flex align-items-center">
                    <div class="col-xl-2">
                        <a href="/cards/1001131"><div class="card-info-thumb"><img src="/portrait.png"></div><div class="card-icon-item-type"><img src="/cha_type_icon_21.png"></div></a>
                        <div class="font-size-1_2"><b>Raditz</b></div>
                    </div>
                    <div class="col-md-2">
                        <div class="row"><b>HP:</b> 200,000</div><div class="row"><b>ATK:</b> 16,000</div>
                        <div class="row"><b>DEF:</b> 1,400</div><div class="row"><b>DR:</b> 0%</div>
                        <div class="row"><b>Max ATK/Turn:</b> 1</div>
                    </div>
                    <div class="col-md">
                        <div class="row"><div><b>Double Sunday</b><div class="row align-items-center">Causes huge damage</div><img alt="01"></div></div>
                        <div class="row"><b>Damage:</b> 32,000</div><div class="row"><b>Percentage:</b> 33%</div><div class="row"><b>Cooldown:</b> 2</div>
                    </div>
                    <div class="col-md"></div>
                </div>
            </div>
        `);
        const stage = {
            id: "9010012",
            title: "Level 1",
            sourcePath: "https://dokkaninfo.com/events/dbstories/901/9010012",
            enemyDataStatus: "not-provided",
            enemies: [],
        };
        const mapped = (0, dokkaninfo_db_stories_1.mapDbStoryStageDetail)(dom.window.document, stage);
        (0, assert_1.equal)(mapped.enemyDataStatus, "available");
        (0, assert_1.equal)(mapped.enemies.length, 1);
        (0, assert_1.deepEqual)(mapped.enemies[0], {
            source: "dokkaninfo",
            sequence: 1,
            group: 1,
            name: "Raditz",
            cardReferenceId: "1001131",
            cardReferencePath: "https://dokkaninfo.com/cards/1001131",
            portraitPath: "https://dokkaninfo.com/portrait.png",
            typeCode: "21",
            typeIconPath: "https://dokkaninfo.com/cha_type_icon_21.png",
            stats: { hp: 200000, atk: 16000, def: 1400, damageReductionPercent: 0, maxAttacksPerTurn: 1 },
            superAttack: {
                name: "Double Sunday",
                description: "Causes huge damage",
                typeCode: "01",
                damage: 32000,
                chancePercent: 33,
                cooldown: 2,
            },
        });
    });
    it("treats a missing enemy block as supported optional absence", () => {
        const stage = {
            id: "9020010",
            title: "Level 1",
            sourcePath: "https://dokkaninfo.com/events/dbstories/902/9020010",
            enemyDataStatus: "not-provided",
            enemies: [],
        };
        const mapped = (0, dokkaninfo_db_stories_1.mapDbStoryStageDetail)(new jsdom_1.JSDOM("<main>No enemy information</main>").window.document, stage);
        (0, assert_1.equal)(mapped.enemyDataStatus, "not-provided");
        (0, assert_1.deepEqual)(mapped.enemies, []);
    });
    it("does not turn an HTTP-200 server error page into missing enemy data", () => {
        const dom = new jsdom_1.JSDOM("<title>General server error</title><main></main>");
        (0, assert_1.throws)(() => (0, dokkaninfo_db_stories_1.mapDbStoryStageDetail)(dom.window.document, {
            id: "1750020",
            title: "Level 2",
            sourcePath: "https://dokkaninfo.com/events/story/175/1750020",
            enemyDataStatus: "not-provided",
            enemies: [],
        }), /returned an error page/);
    });
    it("reads enemy identity from the server-rendered card payload", () => {
        const dom = new jsdom_1.JSDOM(`
            <div class="row margin-5 border border-1 border-main-box-darker bg-main">
                <div class="row d-flex align-items-center">
                    <card-icon class="col-xl-2" v-bind:card='{"id":1001131,"icon_id":1001130,"name":"Raditz","element":"21"}'></card-icon>
                    <div class="col-md-2"><div class="row"><b>HP:</b> 200,000</div></div>
                    <div class="col-md"></div><div class="col-md"></div>
                </div>
            </div>
        `);
        const mapped = (0, dokkaninfo_db_stories_1.mapDbStoryStageDetail)(dom.window.document, {
            id: "9010012",
            title: "Level 1",
            sourcePath: "https://dokkaninfo.com/events/dbstories/901/9010012",
            enemyDataStatus: "not-provided",
            enemies: [],
        });
        (0, assert_1.equal)(mapped.enemies[0].name, "Raditz");
        (0, assert_1.equal)(mapped.enemies[0].cardReferenceId, "1001131");
        (0, assert_1.equal)(mapped.enemies[0].typeCode, "21");
        (0, assert_1.equal)(mapped.enemies[0].portraitPath, "https://dokkaninfo.com/assets/global/en/character/thumb/card_1001130_thumb/card_1001130_thumb.png");
    });
    it("reports failures separately from legitimate missing enemy data", () => {
        const dataset = (0, dokkaninfo_db_stories_1.buildDokkanInfoDbStoryDataset)([{
                id: "901",
                type: "dbstories",
                name: "Story",
                sourcePath: "https://dokkaninfo.com/events/dbstories/901",
                missions: [],
                rewards: [],
                stages: [{
                        id: "9010010",
                        title: "Level 1",
                        sourcePath: "https://dokkaninfo.com/events/dbstories/901/9010010",
                        enemyDataStatus: "not-provided",
                        enemies: [],
                    }],
            }], ["933", "933"], ["9010020", "9010020"]);
        (0, assert_1.equal)(dataset.storyCount, 1);
        (0, assert_1.equal)(dataset.stageCount, 1);
        (0, assert_1.equal)(dataset.stagesWithoutEnemyData, 1);
        (0, assert_1.deepEqual)(dataset.failedStoryIds, ["933"]);
        (0, assert_1.deepEqual)(dataset.failedStageIds, ["9010020"]);
    });
});
//# sourceMappingURL=dokkaninfo-db-stories.spec.js.map