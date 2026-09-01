import assert = require("assert");
import { readFile } from "fs/promises";
import { DokkanFrontierChaptersDataset, DokkanFrontierSeriesDataset } from "./dokkan-frontier";
import { buildDokkanFrontierCatalog } from "./dokkan-frontier-catalog";
import { DokkanInfoFrontierDataset } from "./dokkaninfo-special-event";
import { Character } from "./character";

describe("Dokkan Frontier catalog", () => {
    it("joins all current nodes and encounter enemies by exact IDs", async () => {
        const inputs = await readInputs();
        const dataset = buildDokkanFrontierCatalog({ ...inputs, generatedAt: "2026-09-01T00:00:00.000Z" });

        assert.equal(dataset.counts.series, 2);
        assert.equal(dataset.counts.chapters, 3);
        assert.equal(dataset.counts.nodes, 55);
        assert.equal(dataset.counts.enemies, 121);
        const node = dataset.series.flatMap(value => value.chapters).flatMap(value => value.pages).flatMap(value => value.nodes)
            .find(value => value.id === "20010101");
        assert(node);
        assert.equal(node.title, "Vs. Frieza Soldiers");
        assert.equal(node.rounds[0].enemies[0].stats.hp, 4_000_000);
        assert.equal(node.rounds[0].enemies[0].skills[0].name, "Damage Reduction");
        assert.equal(node.requiredCharacters[0].id, "1022941");
        assert.equal(node.requiredCharacters[0].portraitSpec?.elementCode, "10");
        assert.equal(node.bonusPassiveCards.length, 2);
        assert(node.bonusPassiveCards.every(value => value.portraitSpec));
        assert(node.rounds.flatMap(value => value.enemies).every(value => value.portraitSpec));
    });

    it("fails closed when one source adds a node without the other", async () => {
        const inputs = await readInputs();
        const chapters = structuredClone(inputs.dokkanFyiChapters);
        chapters.chapters[0].pages[0].nodes.pop();

        assert.throws(
            () => buildDokkanFrontierCatalog({ ...inputs, dokkanFyiChapters: chapters }),
            /differ between sources/,
        );
    });

    it("keeps encounter types from DokkanInfo instead of catalog character types", async () => {
        const inputs = await readInputs();
        const dataset = buildDokkanFrontierCatalog(inputs);
        const enemies = dataset.series.flatMap(value => value.chapters)
            .flatMap(value => value.pages)
            .flatMap(value => value.nodes)
            .flatMap(value => value.rounds)
            .flatMap(value => value.enemies);

        assert(enemies.every(value => value.typeCode !== undefined));
        assert(enemies.every(value => value.portraitUrl?.includes("dokkaninfo.com")));
        assert(enemies.every(value => value.portraitSpec?.elementCode === value.typeCode));
    });

    it("keeps the raw enemy portrait when the encounter type is unavailable", async () => {
        const inputs = await readInputs();
        const dokkanInfo = structuredClone(inputs.dokkanInfo);
        const enemy = dokkanInfo.series[0].episodes[0].battles[0].enemies[0];
        delete enemy.typeCode;
        const dataset = buildDokkanFrontierCatalog({ ...inputs, dokkanInfo });
        const mapped = dataset.series[0].chapters[0].pages[0].nodes[0].rounds[0].enemies[0];

        assert.equal(mapped.portraitSpec, undefined);
        assert(mapped.portraitUrl?.includes("dokkaninfo.com"));
    });

    it("keeps legacy explicit inputs compatible when the character catalog is omitted", async () => {
        const inputs = await readInputs();
        const { characters: _characters, ...legacyInputs } = inputs;
        const dataset = buildDokkanFrontierCatalog(legacyInputs);
        const node = dataset.series.flatMap(value => value.chapters).flatMap(value => value.pages)
            .flatMap(value => value.nodes).find(value => value.id === "20010101");
        assert(node);
        assert.equal(node.requiredCharacters[0].portraitSpec, undefined);
    });
});

async function readInputs(): Promise<{
    dokkanInfo: DokkanInfoFrontierDataset,
    dokkanFyiSeries: DokkanFrontierSeriesDataset,
    dokkanFyiChapters: DokkanFrontierChaptersDataset,
    characters?: Character[],
}> {
    const read = async <T>(path: string) => JSON.parse(await readFile(path, "utf8")) as T;
    const [dokkanInfo, dokkanFyiSeries, dokkanFyiChapters, characters] = await Promise.all([
        read<DokkanInfoFrontierDataset>("data/dokkaninfo-frontier/latest/frontier.json"),
        read<DokkanFrontierSeriesDataset>("data/dokkan-frontier/latest/dokkan-frontier-series.json"),
        read<DokkanFrontierChaptersDataset>("data/dokkan-frontier/latest/dokkan-frontier-chapters.json"),
        read<Character[]>("data/characters.json"),
    ]);
    return { dokkanInfo, dokkanFyiSeries, dokkanFyiChapters, characters };
}
