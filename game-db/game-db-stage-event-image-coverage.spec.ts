import { deepEqual, equal, match, throws } from "assert";
import { createHash } from "crypto";
import { describe, it } from "mocha";
import { StageCatalogPayload } from "./game-db-stage-delivery";
import { StageAssetManifest } from "./game-db-stage-assets";
import {
    OfficialLocalStageAssetRecoveryManifest,
    buildStageEventImageCoverageReport,
} from "./game-db-stage-event-image-coverage";

const CATALOG: StageCatalogPayload = {
    schemaVersion: 1,
    contract: "dokkan-stage-delivery",
    contractVersion: "1.0.0",
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
};

const missingPaths = [
    "banners/en/event/eve_listbutton/myp_banner_event_1216.png",
    "banners/en/event/eve_listbutton/myp_banner_event_zbattle_008.png",
    "character/thumb/card_1004310_thumb/card_1004310_thumb.png",
    "character/thumb/card_3001121_thumb/card_3001121_thumb.png",
];

const ownedAssets: StageAssetManifest["assets"] = [{
    path: "banners/en/event/eve_listbutton/myp_banner_event_238.png",
    objectKey: "game-assets/banners/en/event/eve_listbutton/myp_banner_event_238.png",
    sourceUrl: "https://existing.example.test/238.png",
    sha256: "c".repeat(64),
    sizeBytes: 10,
    contentType: "image/png",
}];

const MANIFEST: StageAssetManifest = {
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
    inventorySha256: createHash("sha256").update(JSON.stringify(ownedAssets)).digest("hex"),
    assets: ownedAssets,
    missingAssets: missingPaths.map(path => ({ path, sourceUrls: [] })),
    missingAcceptance: {
        schemaVersion: 1,
        sourceSnapshotVersion: CATALOG.sourceSnapshotVersion,
        missingAssetCount: 4,
        missingPathsSha256: createHash("sha256").update(missingPaths.join("\n")).digest("hex"),
        reason: "Reviewed first-party gaps for the exact source snapshot.",
    },
};

describe("Stage event image coverage", () => {
    it("keeps duplicate-title areas distinct and classifies projection, owned, accepted, runtime and recovery states", () => {
        const recoveries: OfficialLocalStageAssetRecoveryManifest = {
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
        const report = buildStageEventImageCoverageReport(CATALOG, MANIFEST, recoveries);
        const area238 = report.events.find(event => event.eventKey === "area:238")!;
        const area1216 = report.events.find(event => event.eventKey === "area:1216")!;
        const pathless = report.events.find(event => event.eventKey === "area:10001")!;
        const zBattle = report.events.find(event => event.eventKey === "z-battle:8")!;

        equal(area238.title, area1216.title);
        equal(area238.eventKey, "area:238");
        equal(area1216.eventKey, "area:1216");
        equal(area238.projectedEventImagePath, "banners/en/event/eve_listbutton/myp_banner_event_238.png");
        equal(area1216.projectedEventImagePath, "banners/en/event/eve_listbutton/myp_banner_event_1216.png");
        equal(area238.classification, "owned-asset-available");
        equal(area238.runtimeFailureDiagnosis, "render-or-cache");
        equal(area1216.classification, "accepted-missing");
        equal(area1216.runtimeFailureDiagnosis, "accepted-source-gap");
        const brokenProjection = report.events.find(event => event.eventKey === "area:999")!;
        equal(pathless.areaType, "Area::TutorialArea");
        equal(pathless.projectedEventImagePath, null);
        equal(pathless.manifestState, "no-path");
        equal(pathless.classification, "image-not-applicable");
        equal(pathless.runtimeFailureDiagnosis, "not-applicable");
        equal(pathless.ownedAsset, null);
        equal(pathless.missingAcceptance, null);
        equal(pathless.officialLocalRecovery, null);
        equal(report.gaps.some(gap => gap.affectedEventKeys.includes(pathless.eventKey)), false);
        equal(brokenProjection.classification, "dataset-path-missing");
        equal(brokenProjection.runtimeFailureDiagnosis, "dataset-projection");
        equal(zBattle.classification, "official-local-recoverable");
        equal(zBattle.runtimeFailureDiagnosis, "official-local-recovery-pending");
        equal(report.summary.acceptedMissingBannerPathCount, 1);
        equal(report.summary.nonBannerMissingAssetCount, 2);
        const nonBannerGaps = report.gaps.filter(gap => gap.scope === "non-banner-asset");
        deepEqual(nonBannerGaps.map(gap => gap.path), [
            "character/thumb/card_1004310_thumb/card_1004310_thumb.png",
            "character/thumb/card_3001121_thumb/card_3001121_thumb.png",
        ]);
        equal(nonBannerGaps.every(gap => gap.assetKind === "other-asset"), true);
        equal(nonBannerGaps.every(gap => gap.affectedEventKeys.length === 0), true);
        equal(report.summary.recoveredGapCount, 1);
        equal(report.summary.eventCount, 5);
        equal(report.summary.imageNotApplicableEventCount, 1);
        equal(report.summary.datasetPathMissingEventCount, 1);
        match(report.reportSha256, /^[a-f0-9]{64}$/);
        equal(
            report.reportSha256,
            buildStageEventImageCoverageReport(CATALOG, MANIFEST, recoveries).reportSha256,
        );
    });

    it("fails closed on cross-snapshot data and unbound recoveries", () => {
        throws(
            () => buildStageEventImageCoverageReport({ ...CATALOG, sourceSnapshotVersion: "1" }, MANIFEST),
            /identities do not match/,
        );
        const recoveries: OfficialLocalStageAssetRecoveryManifest = {
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
        throws(() => buildStageEventImageCoverageReport(CATALOG, MANIFEST, recoveries), /not a current manifest gap/);
    });
});

function entry(id: string, areaId: string, areaName: string, eventImagePath?: string, areaType = "Area::EventArea") {
    return {
        key: `quest-level:${id}`,
        kind: "quest-level" as const,
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
