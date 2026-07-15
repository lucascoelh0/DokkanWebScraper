"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const dokkaninfo_awakening_medal_enrichment_1 = require("./dokkaninfo-awakening-medal-enrichment");
describe("dokkaninfo awakening medal enrichment", () => {
    it("parses awakening medal payload from component props", () => {
        const props = (0, dokkaninfo_awakening_medal_enrichment_1.parseAwakeningItemsComponentProps)(`
            <html>
                <body>
                    <awakening-items
                        v-bind:awakening_items_rarities="[{&quot;rarity&quot;:0,&quot;awakeningItem&quot;:[{&quot;id&quot;:1,&quot;name&quot;:&quot;Gregory&quot;,&quot;description&quot;:&quot;A common, easily obtained Awakening Medal.&quot;,&quot;zeni&quot;:500,&quot;rarity&quot;:0,&quot;selling_exchange_point&quot;:1,&quot;event_jumpable&quot;:0,&quot;width&quot;:200,&quot;height&quot;:200}]}]"
                        language="English"
                        version="global"
                        version_language="/en/">
                    </awakening-items>
                </body>
            </html>
        `);
        (0, assert_1.equal)(props.language, "English");
        (0, assert_1.equal)(props.version, "global");
        (0, assert_1.equal)(props.versionLanguage, "/en/");
        (0, assert_1.equal)(props.awakeningItemsRarities.length, 1);
        (0, assert_1.equal)(props.awakeningItemsRarities[0].rarity, 0);
        (0, assert_1.deepEqual)(props.awakeningItemsRarities[0].awakeningItem?.[0], {
            id: 1,
            name: "Gregory",
            description: "A common, easily obtained Awakening Medal.",
            zeni: 500,
            rarity: 0,
            selling_exchange_point: 1,
            event_jumpable: 0,
            width: 200,
            height: 200,
        });
    });
});
//# sourceMappingURL=dokkaninfo-awakening-medal-enrichment.spec.js.map