import { deepEqual, equal } from "assert";
import { parseAwakeningItemsComponentProps } from "./dokkaninfo-awakening-medal-enrichment";

describe("dokkaninfo awakening medal enrichment", () => {
    it("parses awakening medal payload from component props", () => {
        const props = parseAwakeningItemsComponentProps(`
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

        equal(props.language, "English");
        equal(props.version, "global");
        equal(props.versionLanguage, "/en/");
        equal(props.awakeningItemsRarities.length, 1);
        equal(props.awakeningItemsRarities[0].rarity, 0);
        deepEqual(props.awakeningItemsRarities[0].awakeningItem?.[0], {
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
