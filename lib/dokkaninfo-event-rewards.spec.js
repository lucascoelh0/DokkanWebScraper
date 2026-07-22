"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const jsdom_1 = require("jsdom");
const dokkaninfo_event_rewards_1 = require("./dokkaninfo-event-rewards");
describe("DokkanInfo event reward dataset", () => {
    it("keeps event rewards grouped and failed event ids stable", () => {
        const dataset = (0, dokkaninfo_event_rewards_1.buildDokkanInfoEventRewardDataset)([
            {
                id: "133",
                type: "story",
                name: "Adventure of Gratitude",
                sourcePath: "https://dokkaninfo.com/events/story/133",
                rewards: [
                    {
                        key: "dokkaninfo-event-reward:story:133:1330010:2618:Card:1005460",
                        itemId: "1005460",
                        itemType: "Card",
                        quantity: 1,
                        name: "Goku (Youth)",
                        eventId: "133",
                        eventType: "story",
                        eventName: "Adventure of Gratitude",
                        eventPath: "https://dokkaninfo.com/events/story/133",
                        stageId: "1330010",
                        stagePath: "https://dokkaninfo.com/events/story/133/1330010",
                    },
                ],
            },
        ], ["story:902", "story:901", "story:902"]);
        (0, assert_1.equal)(dataset.eventCount, 1);
        (0, assert_1.equal)(dataset.rewardCount, 1);
        (0, assert_1.deepEqual)(dataset.failedEventIds, ["story:901", "story:902"]);
        (0, assert_1.equal)(dataset.events[0].rewards[0].stageId, "1330010");
    });
    it("extracts event stages and mission stage ids from DokkanInfo markup", () => {
        const dom = new jsdom_1.JSDOM(`
            <div class="col-sm">
                <div class="font-size-1_5">Level 22: Gathering of Super Warriors Edition Stage 1</div>
                <a href="https://dokkaninfo.com/events/challenge/1738/17380223">
                    <span>SUPER2</span>
                </a>
            </div>
            <mission-category></mission-category>
        `);
        const category = dom.window.document.querySelector("mission-category");
        category.setAttribute("v-bind:missioncategory", JSON.stringify({
            missions: [
                {
                    id: 27667,
                    conditions: JSON.stringify({ sugoroku_map_ids: [17010015, 17380223] }),
                },
            ],
        }));
        (0, assert_1.deepEqual)((0, dokkaninfo_event_rewards_1.mapEventStages)(dom.window.document, {
            id: "1738",
            type: "challenge",
            name: "Supreme Magnificent Battle",
        }), [
            {
                id: "17380223",
                title: "Level 22: Gathering of Super Warriors Edition Stage 1",
                level: 22,
                difficulty: "SUPER2",
                sourcePath: "https://dokkaninfo.com/events/challenge/1738/17380223",
            },
        ]);
        (0, assert_1.deepEqual)((0, dokkaninfo_event_rewards_1.mapEventMissionReferences)(dom.window.document), [
            { id: "27667", stageIds: ["17010015", "17380223"] },
        ]);
    });
});
//# sourceMappingURL=dokkaninfo-event-rewards.spec.js.map