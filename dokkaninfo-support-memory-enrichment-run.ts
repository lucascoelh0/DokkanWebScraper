import {
    getDokkanInfoSupportMemoryEnrichment,
    writeDokkanInfoSupportMemoryEnrichment,
} from "./dokkaninfo-support-memory-enrichment";

void (async function run() {
    const dataset = await getDokkanInfoSupportMemoryEnrichment();
    const outputPath = await writeDokkanInfoSupportMemoryEnrichment(dataset);
    const withAnimationCount = dataset.entries.filter(entry => entry.animation).length;
    const mirroredAnimationCount = dataset.entries.filter(entry => entry.animation?.status === "mirrored").length;
    const partialAnimationCount = dataset.entries.filter(entry => entry.animation?.status === "partial").length;
    const unavailableAnimationCount = dataset.entries.filter(entry => entry.animation?.status === "unavailable").length;
    const withFilmCount = dataset.entries.filter(entry => entry.requiredFilm?.filmCode).length;
    const withEnhancementCount = dataset.entries.filter(entry => entry.enhancementItems.length > 0).length;
    const firstEntry = dataset.entries[0];

    console.log(JSON.stringify({
        outputPath,
        count: dataset.count,
        withAnimationCount,
        mirroredAnimationCount,
        partialAnimationCount,
        unavailableAnimationCount,
        withFilmCount,
        withEnhancementCount,
        firstEntry: firstEntry
            ? {
                id: firstEntry.id,
                name: firstEntry.name,
                levelCount: firstEntry.levelDescriptions.length,
                enhancementCount: firstEntry.enhancementItems.length,
                animationBaseUrl: firstEntry.animation?.remoteBaseUrl,
            }
            : undefined,
    }, null, 2));
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
