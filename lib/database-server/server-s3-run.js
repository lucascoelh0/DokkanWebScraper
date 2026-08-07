"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runServerS3 = void 0;
const crypto_1 = require("crypto");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const server_s3_builder_1 = require("./server-s3-builder");
const MEMORY_LIMIT = 1024 * 1024 * 1024;
let peakWorkingSetBytes = 0;
function memory() { peakWorkingSetBytes = Math.max(peakWorkingSetBytes, process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024); if (peakWorkingSetBytes > MEMORY_LIMIT)
    throw new Error(`S3 memory limit exceeded ${peakWorkingSetBytes}`); }
function sha256(value) { return (0, crypto_1.createHash)("sha256").update(value).digest("hex"); }
function text(value) { return `${JSON.stringify(value, null, 2)}\n`; }
async function readVerified(dir, manifestName, expectedContract) {
    const manifest = JSON.parse(await (0, promises_1.readFile)((0, path_1.resolve)(dir, manifestName), "utf8"));
    if (manifest.schemaVersion !== 1 || manifest.contractVersion !== expectedContract || manifest.generatedAtPolicy !== "pinned_to_source_snapshot_for_reproducible_bytes" || manifest.compression !== "none")
        throw new Error(`S3 unsupported source contract ${manifestName}`);
    const path = (0, path_1.resolve)(dir, manifest.fileName), bytes = await (0, promises_1.readFile)(path), validationBytes = await (0, promises_1.readFile)((0, path_1.resolve)(dir, manifest.validation.fileName));
    memory();
    if (bytes.byteLength !== manifest.sizeBytes || sha256(bytes) !== manifest.sha256 || validationBytes.byteLength !== manifest.validation.sizeBytes || sha256(validationBytes) !== manifest.validation.sha256 || JSON.parse(validationBytes.toString("utf8")).valid !== true)
        throw new Error(`S3 source identity or validation ${manifestName}`);
    return { manifest, path, bytes };
}
async function runServerS3(options = {}) {
    peakWorkingSetBytes = 0;
    const eventsDir = (0, path_1.resolve)(options.eventsDir ?? (0, path_1.resolve)(process.cwd(), "data", "database-events"));
    const legacyPath = (0, path_1.resolve)(options.legacyPath ?? (0, path_1.resolve)(process.cwd(), "data", "dokkaninfo-events", "latest", "event-rewards.json"));
    const parserPath = (0, path_1.resolve)(options.parserPath ?? (0, path_1.resolve)(process.cwd(), "dokkaninfo-event-rewards.ts"));
    const outputDir = (0, path_1.resolve)(options.outputDir ?? (0, path_1.resolve)(process.cwd(), "data", "database-server", "s3"));
    const [e5, e7, legacyBytes, parserBytes] = await Promise.all([readVerified(eventsDir, "events-e5-manifest.json", "0.6.0"), readVerified(eventsDir, "events-e7-manifest.json", "0.8.0"), (0, promises_1.readFile)(legacyPath), (0, promises_1.readFile)(parserPath)]);
    memory();
    if (e5.manifest.sourceSnapshotVersion !== e7.manifest.sourceSnapshotVersion || e5.manifest.sourceDatabaseSha256 !== e7.manifest.sourceDatabaseSha256)
        throw new Error("S3 E5/E7 lineage mismatch");
    const e5Data = JSON.parse(e5.bytes.toString("utf8")), e7Data = JSON.parse(e7.bytes.toString("utf8")), legacy = JSON.parse(legacyBytes.toString("utf8"));
    memory();
    const legacyEvidence = e7Data.legacySources?.find((value) => value.name === "event-rewards"), parserEvidence = e7Data.implementationEvidence?.find((value) => value.fileName === "dokkaninfo-event-rewards.ts");
    if (!legacyEvidence || legacyBytes.byteLength !== legacyEvidence.sizeBytes || sha256(legacyBytes) !== legacyEvidence.sha256 || legacy.rewardCount !== legacyEvidence.declaredCounts?.rewardCount || legacy.events.reduce((sum, event) => sum + event.rewards.length, 0) !== legacy.rewardCount)
        throw new Error("S3 legacy reward lineage");
    if (!parserEvidence || parserBytes.byteLength !== parserEvidence.sizeBytes || sha256(parserBytes) !== parserEvidence.sha256)
        throw new Error("S3 parser lineage");
    const sourceLineage = [
        { key: "events_e5", path: `data/database-events/${(0, path_1.basename)(e5.path)}`, sha256: e5.manifest.sha256, sizeBytes: e5.manifest.sizeBytes, authority: "sqlite_first_party", fetchedAt: null },
        { key: "events_e7", path: `data/database-events/${(0, path_1.basename)(e7.path)}`, sha256: e7.manifest.sha256, sizeBytes: e7.manifest.sizeBytes, authority: "community_shadow", fetchedAt: null },
        { key: "dokkaninfo_event_rewards", path: "data/dokkaninfo-events/latest/event-rewards.json", sha256: legacyEvidence.sha256, sizeBytes: legacyEvidence.sizeBytes, authority: "community_shadow", fetchedAt: legacy.generatedAt },
        { key: "dokkaninfo_reward_parser", path: "dokkaninfo-event-rewards.ts", sha256: parserEvidence.sha256, sizeBytes: parserEvidence.sizeBytes, authority: "repository_implementation", fetchedAt: null },
    ];
    const missionRewards = e5Data.linkedEventMissions.reduce((sum, value) => sum + value.rewards.length, 0) + e5Data.budokai.missions.reduce((sum, value) => sum + value.rewards.length, 0) + e5Data.rmbattleMissions.reduce((sum, value) => sum + value.rewards.length, 0);
    const rankingRewards = e5Data.budokai.rankingGiftSets.reduce((sum, value) => sum + value.rewards.length, 0) + e5Data.budokai.boxRankings.reduce((sum, value) => sum + value.ranges.reduce((inner, range) => inner + range.rewards.length, 0), 0) + e5Data.budokai.orphanBoxRewardRanges.reduce((sum, value) => sum + value.rewards.length, 0);
    const observation = {
        sourceSnapshotVersion: e5.manifest.sourceSnapshotVersion, sourceLineage,
        questBossDrops: e5Data.questBossDrops, questDropPreviewCount: e5Data.questDropPreviews.length,
        zFirstAnchors: e5Data.zBattleFirstRewardAnchors, zFirstSets: e5Data.zBattleFirstRewardSets,
        channelCounts: {
            questBossDrops: e5Data.questBossDrops.length,
            zFirstRewards: e5Data.zBattleFirstRewardSets.reduce((sum, value) => sum + value.rewards.length, 0),
            zNormalRewards: e5Data.zBattleNormalRewardTables.reduce((sum, value) => sum + value.rewards.length, 0),
            missionRewards, rankingRewards,
        },
        remoteEvents: legacy.events, declaredRemoteRewardCount: legacy.rewardCount,
    };
    const dataset = (0, server_s3_builder_1.buildServerS3Dataset)(observation), coverage = (0, server_s3_builder_1.buildServerS3Coverage)(dataset), validation = (0, server_s3_builder_1.validateServerS3Dataset)(dataset, observation.declaredRemoteRewardCount, { ...observation.channelCounts, preview: observation.questDropPreviewCount });
    if (!validation.valid)
        throw new Error(`S3 validation failed: ${validation.failures.slice(0, 20).join(", ")}`);
    const datasetText = text(dataset), coverageText = text(coverage), validationText = text(validation);
    const manifest = {
        schemaVersion: 1, contractVersion: "0.4.0", generatedAt: dataset.generatedAt, generatedAtPolicy: dataset.generatedAtPolicy,
        fileName: "server-s3-reward-joins.json", compression: "none", sha256: sha256(datasetText), sizeBytes: Buffer.byteLength(datasetText), sourceSnapshotVersion: dataset.sourceSnapshotVersion,
        sourceLineageAggregateSha256: sha256(JSON.stringify(sourceLineage.map(value => [value.key, value.sha256, value.sizeBytes]))),
        coverage: { fileName: "server-s3-coverage.json", sha256: sha256(coverageText), sizeBytes: Buffer.byteLength(coverageText) },
        validation: { fileName: "server-s3-validation.json", sha256: sha256(validationText), sizeBytes: Buffer.byteLength(validationText) },
    };
    await (0, promises_1.mkdir)(outputDir, { recursive: true });
    await Promise.all([(0, promises_1.writeFile)((0, path_1.resolve)(outputDir, manifest.fileName), datasetText), (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, manifest.coverage.fileName), coverageText), (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, manifest.validation.fileName), validationText), (0, promises_1.writeFile)((0, path_1.resolve)(outputDir, "server-s3-manifest.json"), text(manifest))]);
    memory();
    return { dataset, coverage, validation, manifest, peakWorkingSetBytes };
}
exports.runServerS3 = runServerS3;
if (require.main === module)
    runServerS3().then(value => console.log(JSON.stringify({ coverage: value.coverage, validation: value.validation, manifest: value.manifest, peakWorkingSetBytes: value.peakWorkingSetBytes }, null, 2))).catch(error => { console.error(error); process.exitCode = 1; });
//# sourceMappingURL=server-s3-run.js.map