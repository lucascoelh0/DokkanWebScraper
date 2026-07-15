"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
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
});
//# sourceMappingURL=dokkaninfo-event-rewards.spec.js.map