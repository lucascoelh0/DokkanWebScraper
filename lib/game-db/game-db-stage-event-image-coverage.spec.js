"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const crypto_1 = require("crypto");
const mocha_1 = require("mocha");
const game_db_stage_event_image_coverage_1 = require("./game-db-stage-event-image-coverage");
const CATALOG = {
    schemaVersion: 1,
    contract: "dokkan-stage-delivery",
    contractVersion: "1.1.0",
    datasetVersion: "2026-09-03T20:08:38.190Z",
    generatedAt: "2026-09-03T20:08:38.190Z",
    source: "dokkan-game-db",
    sourceSnapshotVersion: "1788329250",
    sourceDatabaseSha256: "a".repeat(64),
    assetBaseUrl: "https://assets.example.test/game-assets",
    count: 5,
    questLevelCount: 4,
    zBattleCount: 1,
    entries: [
        entry("2380", "238", "Deadly Struggle! Menacing Army", "banners/en/event/eve_listbutton/myp_banner_event_238.png"),
        entry("12160", "1216", "Deadly Struggle! Menacing Army", "banners/en/event/eve_listbutton/myp_banner_event_1216.png"),
        entry("100010", "10001", "The Wheels of Fate Turn", undefined, "Area::TutorialArea"),
        entry("9990", "999", "Broken projected event", undefined),
        {
            key: "z-battle:8", kind: "z-battle", id: "8", title: "Z-Battle 8",
            eventImagePath: "banners/en/event/eve_listbutton/myp_banner_event_zbattle_008.png",
            enemyNames: [], supportMemoryIds: [], hasRewards: true, hasGimmicks: true, detailShardId: "1",
        },
    ],
    supportMemoryRelations: [],
    eventMissionsComplete: true,
    eventMissions: [],
    awakeningMedalSources: [],
};
const missingPaths = [
    "banners/en/event/eve_listbutton/myp_banner_event_1216.png",
    "banners/en/event/eve_listbutton/myp_banner_event_zbattle_008.png",
    "character/thumb/card_1004310_thumb/card_1004310_thumb.png",
    "character/thumb/card_3001121_thumb/card_3001121_thumb.png",
];
const ownedAssets = [{
        path: "banners/en/event/eve_listbutton/myp_banner_event_238.png",
        objectKey: "game-assets/banners/en/event/eve_listbutton/myp_banner_event_238.png",
        sourceUrl: "https://existing.example.test/238.png",
        sha256: "c".repeat(64),
        sizeBytes: 10,
        contentType: "image/png",
    }];
const MANIFEST = {
    schemaVersion: 1,
    contract: "dokkan-game-asset-mirror",
    contractVersion: "1.0.0",
    datasetVersion: CATALOG.datasetVersion,
    sourceSnapshotVersion: CATALOG.sourceSnapshotVersion,
    sourceDatabaseSha256: CATALOG.sourceDatabaseSha256,
    sourceBaseUrl: "https://assets.example.test",
    objectPrefix: "game-assets/",
    requestedAssetCount: 5,
    assetCount: 1,
    missingAssetCount: 4,
    assetBytes: 10,
    inventorySha256: (0, crypto_1.createHash)("sha256").update(JSON.stringify(ownedAssets)).digest("hex"),
    assets: ownedAssets,
    missingAssets: missingPaths.map(path => ({ path, sourceUrls: [] })),
    missingAcceptance: {
        schemaVersion: 1,
        sourceSnapshotVersion: CATALOG.sourceSnapshotVersion,
        missingAssetCount: 4,
        missingPathsSha256: (0, crypto_1.createHash)("sha256").update(missingPaths.join("\n")).digest("hex"),
        reason: "Reviewed first-party gaps for the exact source snapshot.",
    },
};
(0, mocha_1.describe)("Stage event image coverage", () => {
    (0, mocha_1.it)("keeps duplicate-title areas distinct and classifies projection, owned, accepted, runtime and recovery states", () => {
        const recoveries = {
            schemaVersion: 1,
            sourceSnapshotVersion: CATALOG.sourceSnapshotVersion,
            assetVersion: "1788327754",
            packageName: "com.bandainamcogames.dbzdokkanww",
            cpkReader: {
                repository: "https://github.com/Sewer56/CriFsV2Lib",
                commit: "d".repeat(40),
            },
            assets: [{
                    path: "banners/en/event/eve_listbutton/myp_banner_event_zbattle_008.png",
                    sourceArchivePath: "outgame/event/008.cpk",
                    sourceArchiveSha256: "e".repeat(64),
                    sourceMemberPath: "myp_banner_event_zbattle_008.png",
                    sha256: "f".repeat(64),
                    sizeBytes: 12,
                }],
        };
        const report = (0, game_db_stage_event_image_coverage_1.buildStageEventImageCoverageReport)(CATALOG, MANIFEST, recoveries);
        const area238 = report.events.find(event => event.eventKey === "area:238");
        const area1216 = report.events.find(event => event.eventKey === "area:1216");
        const pathless = report.events.find(event => event.eventKey === "area:10001");
        const zBattle = report.events.find(event => event.eventKey === "z-battle:8");
        (0, assert_1.equal)(area238.title, area1216.title);
        (0, assert_1.equal)(area238.eventKey, "area:238");
        (0, assert_1.equal)(area1216.eventKey, "area:1216");
        (0, assert_1.equal)(area238.projectedEventImagePath, "banners/en/event/eve_listbutton/myp_banner_event_238.png");
        (0, assert_1.equal)(area1216.projectedEventImagePath, "banners/en/event/eve_listbutton/myp_banner_event_1216.png");
        (0, assert_1.equal)(area238.classification, "owned-asset-available");
        (0, assert_1.equal)(area238.runtimeFailureDiagnosis, "render-or-cache");
        (0, assert_1.equal)(area1216.classification, "accepted-missing");
        (0, assert_1.equal)(area1216.runtimeFailureDiagnosis, "accepted-source-gap");
        const brokenProjection = report.events.find(event => event.eventKey === "area:999");
        (0, assert_1.equal)(pathless.areaType, "Area::TutorialArea");
        (0, assert_1.equal)(pathless.projectedEventImagePath, null);
        (0, assert_1.equal)(pathless.manifestState, "no-path");
        (0, assert_1.equal)(pathless.classification, "image-not-applicable");
        (0, assert_1.equal)(pathless.runtimeFailureDiagnosis, "not-applicable");
        (0, assert_1.equal)(pathless.ownedAsset, null);
        (0, assert_1.equal)(pathless.missingAcceptance, null);
        (0, assert_1.equal)(pathless.officialLocalRecovery, null);
        (0, assert_1.equal)(report.gaps.some(gap => gap.affectedEventKeys.includes(pathless.eventKey)), false);
        (0, assert_1.equal)(brokenProjection.classification, "dataset-path-missing");
        (0, assert_1.equal)(brokenProjection.runtimeFailureDiagnosis, "dataset-projection");
        (0, assert_1.equal)(zBattle.classification, "official-local-recoverable");
        (0, assert_1.equal)(zBattle.runtimeFailureDiagnosis, "official-local-recovery-pending");
        (0, assert_1.equal)(report.summary.acceptedMissingBannerPathCount, 1);
        (0, assert_1.equal)(report.summary.nonBannerMissingAssetCount, 2);
        const nonBannerGaps = report.gaps.filter(gap => gap.scope === "non-banner-asset");
        (0, assert_1.deepEqual)(nonBannerGaps.map(gap => gap.path), [
            "character/thumb/card_1004310_thumb/card_1004310_thumb.png",
            "character/thumb/card_3001121_thumb/card_3001121_thumb.png",
        ]);
        (0, assert_1.equal)(nonBannerGaps.every(gap => gap.assetKind === "other-asset"), true);
        (0, assert_1.equal)(nonBannerGaps.every(gap => gap.affectedEventKeys.length === 0), true);
        (0, assert_1.equal)(report.summary.recoveredGapCount, 1);
        (0, assert_1.equal)(report.summary.eventCount, 5);
        (0, assert_1.equal)(report.summary.imageNotApplicableEventCount, 1);
        (0, assert_1.equal)(report.summary.datasetPathMissingEventCount, 1);
        (0, assert_1.match)(report.reportSha256, /^[a-f0-9]{64}$/);
        (0, assert_1.equal)(report.reportSha256, (0, game_db_stage_event_image_coverage_1.buildStageEventImageCoverageReport)(CATALOG, MANIFEST, recoveries).reportSha256);
    });
    (0, mocha_1.it)("fails closed on cross-snapshot data and unbound recoveries", () => {
        (0, assert_1.throws)(() => (0, game_db_stage_event_image_coverage_1.buildStageEventImageCoverageReport)({ ...CATALOG, sourceSnapshotVersion: "1" }, MANIFEST), /identities do not match/);
        const recoveries = {
            schemaVersion: 1,
            sourceSnapshotVersion: CATALOG.sourceSnapshotVersion,
            assetVersion: "1788327754",
            packageName: "com.bandainamcogames.dbzdokkanww",
            cpkReader: { repository: "https://github.com/Sewer56/CriFsV2Lib", commit: "d".repeat(40) },
            assets: [{
                    path: "banners/en/event/not-missing.png",
                    sourceArchivePath: "event.cpk",
                    sourceArchiveSha256: "e".repeat(64),
                    sourceMemberPath: "not-missing.png",
                    sha256: "f".repeat(64),
                    sizeBytes: 12,
                }],
        };
        (0, assert_1.throws)(() => (0, game_db_stage_event_image_coverage_1.buildStageEventImageCoverageReport)(CATALOG, MANIFEST, recoveries), /not a current manifest gap/);
    });
});
function entry(id, areaId, areaName, eventImagePath, areaType = "Area::EventArea") {
    return {
        key: `quest-level:${id}`,
        kind: "quest-level",
        id,
        title: "Stage",
        areaId,
        areaName,
        areaType,
        eventImagePath,
        questId: id,
        enemyNames: [],
        supportMemoryIds: [],
        hasRewards: false,
        hasGimmicks: false,
        detailShardId: "1",
    };
}
//# sourceMappingURL=game-db-stage-event-image-coverage.spec.js.map