"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fyi_support_memory_details_1 = require("./fyi-support-memory-details");
void (async function run() {
    const dataset = await (0, fyi_support_memory_details_1.getDokkanFyiSupportMemoryDetails)();
    const outputPath = await (0, fyi_support_memory_details_1.writeDokkanFyiSupportMemoryDetails)(dataset);
    const withUnlockAcquisitionCount = dataset.entries.filter(memory => memory.unlockAcquisition?.sourceCount).length;
    const withFilmAcquisitionCount = dataset.entries.filter(memory => memory.filmAcquisition?.sourceCount).length;
    const resolvedUnlockCount = dataset.entries.filter(memory => memory.unlockMethod !== "unknown").length;
    const withDokkanInfoCount = dataset.entries.filter(memory => memory.dokkanInfo).length;
    const mirroredAnimationCount = dataset.entries.filter(memory => memory.dokkanInfo?.animation?.status === "mirrored").length;
    const partialAnimationCount = dataset.entries.filter(memory => memory.dokkanInfo?.animation?.status === "partial").length;
    const unavailableAnimationCount = dataset.entries.filter(memory => memory.dokkanInfo?.animation?.status === "unavailable").length;
    const unlockMethodCounts = dataset.entries.reduce((counts, memory) => {
        counts[memory.unlockMethod] = (counts[memory.unlockMethod] ?? 0) + 1;
        return counts;
    }, {});
    const missingUnlockSample = dataset.entries
        .filter(memory => memory.unlockMethod === "unknown")
        .slice(0, 5)
        .map(memory => ({
        id: memory.id,
        name: memory.name,
    }));
    const firstEntry = dataset.entries[0];
    console.log(JSON.stringify({
        outputPath,
        count: dataset.count,
        withUnlockAcquisitionCount,
        withFilmAcquisitionCount,
        resolvedUnlockCount,
        withDokkanInfoCount,
        mirroredAnimationCount,
        partialAnimationCount,
        unavailableAnimationCount,
        unlockMethodCounts,
        missingUnlockSample,
        firstEntry: firstEntry
            ? {
                id: firstEntry.id,
                name: firstEntry.name,
                unlockMethod: firstEntry.unlockMethod,
                categoryCount: firstEntry.categoryIds.length,
                applicableCharacterCount: firstEntry.applicableCharacterIds.length,
                unlockSourceCount: firstEntry.unlockAcquisition?.sourceCount ?? 0,
                filmSourceCount: firstEntry.filmAcquisition?.sourceCount ?? 0,
                hasDokkanInfo: Boolean(firstEntry.dokkanInfo),
                animationStatus: firstEntry.dokkanInfo?.animation?.status,
            }
            : undefined,
    }, null, 2));
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
//# sourceMappingURL=fyi-support-memory-details-run.js.map