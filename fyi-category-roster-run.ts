import { writeDokkanFyiCategoryRoster } from "./fyi-category-roster";

(async () => {
    const outputPath = await writeDokkanFyiCategoryRoster();
    console.log(`Wrote dokkan.fyi category roster dataset to ${outputPath}`);
})();
