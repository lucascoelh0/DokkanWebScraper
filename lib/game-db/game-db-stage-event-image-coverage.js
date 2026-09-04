"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildStageEventImageCoverageReport = exports.STAGE_EVENT_IMAGE_COVERAGE_CONTRACT_VERSION = exports.STAGE_EVENT_IMAGE_COVERAGE_CONTRACT = void 0;
const crypto_1 = require("crypto");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const zlib_1 = require("zlib");
const format_json_1 = require("../format-json");
const game_db_stage_assets_1 = require("./game-db-stage-assets");
const game_db_stage_assets_publisher_1 = require("./game-db-stage-assets-publisher");
exports.STAGE_EVENT_IMAGE_COVERAGE_CONTRACT = "dokkan-stage-event-image-coverage";
exports.STAGE_EVENT_IMAGE_COVERAGE_CONTRACT_VERSION = "1.0.0";
function buildStageEventImageCoverageReport(catalog, assetManifest, officialLocalRecoveries) {
    validateInputs(catalog, assetManifest, officialLocalRecoveries);
    const ownedByPath = uniqueMap(assetManifest.assets, "owned asset");
    const missingByPath = uniqueMap(assetManifest.missingAssets, "missing asset");
    const recoveryByPath = officialLocalRecoveries
        ? uniqueMap(officialLocalRecoveries.assets, "official local recovery")
        : new Map();
    for (const path of ownedByPath.keys()) {
        if (missingByPath.has(path))
            throw new Error(`Stage asset is both owned and missing: ${path}`);
        if (recoveryByPath.has(path))
            throw new Error(`Stage asset is already owned and cannot be a recovery: ${path}`);
    }
    for (const path of recoveryByPath.keys()) {
        if (!missingByPath.has(path))
            throw new Error(`Official local recovery is not a current manifest gap: ${path}`);
    }
    const groups = groupCatalogEvents(catalog.entries);
    const events = groups.map(group => coverageEntry(group, assetManifest, ownedByPath, missingByPath, recoveryByPath));
    const affectedEvents = new Map();
    for (const event of events) {
        if (!event.projectedEventImagePath)
            continue;
        const values = affectedEvents.get(event.projectedEventImagePath) ?? [];
        values.push(event.eventKey);
        affectedEvents.set(event.projectedEventImagePath, values);
    }
    const accepted = Boolean(assetManifest.missingAcceptance);
    const gaps = assetManifest.missingAssets.map(missing => {
        const recovery = recoveryByPath.get(missing.path) ?? null;
        return {
            path: missing.path,
            scope: isBannerPath(missing.path) ? "banner-coverage" : "non-banner-asset",
            assetKind: affectedEvents.has(missing.path) ? "event-image" : "other-asset",
            affectedEventKeys: (affectedEvents.get(missing.path) ?? []).sort(numericTextCompare),
            classification: recovery
                ? "official-local-recoverable"
                : accepted
                    ? "accepted-missing"
                    : "unaccepted-missing",
            missingAcceptance: accepted,
            officialLocalRecovery: recovery,
        };
    }).sort((left, right) => numericTextCompare(left.path, right.path));
    const withoutHash = {
        schemaVersion: 1,
        contract: exports.STAGE_EVENT_IMAGE_COVERAGE_CONTRACT,
        contractVersion: exports.STAGE_EVENT_IMAGE_COVERAGE_CONTRACT_VERSION,
        datasetVersion: catalog.datasetVersion,
        sourceSnapshotVersion: catalog.sourceSnapshotVersion,
        sourceDatabaseSha256: catalog.sourceDatabaseSha256,
        assetInventorySha256: assetManifest.inventorySha256,
        summary: {
            eventCount: events.length,
            questAreaCount: events.filter(event => event.eventKind === "quest-area").length,
            zBattleCount: events.filter(event => event.eventKind === "z-battle").length,
            imageNotApplicableEventCount: count(events, "image-not-applicable"),
            datasetPathMissingEventCount: count(events, "dataset-path-missing"),
            ownedAssetAvailableEventCount: count(events, "owned-asset-available"),
            acceptedMissingEventCount: count(events, "accepted-missing"),
            officialLocalRecoverableEventCount: count(events, "official-local-recoverable"),
            manifestGenerationFailureEventCount: count(events, "manifest-generation-failure"),
            currentMissingAssetCount: gaps.length,
            acceptedMissingBannerPathCount: gaps.filter(gap => gap.scope === "banner-coverage" && gap.classification === "accepted-missing").length,
            nonBannerMissingAssetCount: gaps.filter(gap => gap.scope === "non-banner-asset").length,
            recoveredGapCount: gaps.filter(gap => gap.classification === "official-local-recoverable").length,
        },
        events,
        gaps,
    };
    return { ...withoutHash, reportSha256: sha256(Buffer.from(JSON.stringify(withoutHash))) };
}
exports.buildStageEventImageCoverageReport = buildStageEventImageCoverageReport;
function groupCatalogEvents(entries) {
    const areaEntries = new Map();
    const zBattles = [];
    for (const entry of entries) {
        if (entry.kind === "z-battle") {
            zBattles.push(entry);
            continue;
        }
        if (!entry.areaId)
            throw new Error(`Quest catalog entry lacks area ID: ${entry.key}`);
        const grouped = areaEntries.get(entry.areaId) ?? [];
        grouped.push(entry);
        areaEntries.set(entry.areaId, grouped);
    }
    const areas = [...areaEntries].map(([areaId, grouped]) => {
        const paths = unique(grouped.flatMap(entry => entry.eventImagePath ? [entry.eventImagePath] : []));
        const titles = unique(grouped.map(entry => entry.areaName ?? `Area ${areaId}`));
        const areaTypes = unique(grouped.flatMap(entry => entry.areaType ? [entry.areaType] : []));
        if (paths.length > 1)
            throw new Error(`Area ${areaId} projects multiple event image paths: ${paths.join(", ")}`);
        if (titles.length > 1)
            throw new Error(`Area ${areaId} projects multiple titles: ${titles.join(", ")}`);
        if (areaTypes.length !== 1)
            throw new Error(`Area ${areaId} must project exactly one area type`);
        return {
            eventKey: `area:${areaId}`,
            eventKind: "quest-area",
            eventId: areaId,
            areaId,
            areaType: areaTypes[0],
            title: titles[0],
            entries: grouped.sort((left, right) => numericTextCompare(left.key, right.key)),
            path: paths[0] ?? null,
        };
    });
    const zBattleGroups = zBattles.map(entry => ({
        eventKey: `z-battle:${entry.id}`,
        eventKind: "z-battle",
        eventId: entry.id,
        areaId: null,
        areaType: null,
        title: entry.title,
        entries: [entry],
        path: entry.eventImagePath ?? null,
    }));
    return [...areas, ...zBattleGroups].sort((left, right) => numericTextCompare(left.eventKey, right.eventKey));
}
function coverageEntry(group, manifest, ownedByPath, missingByPath, recoveryByPath) {
    const owned = group.path ? ownedByPath.get(group.path) : undefined;
    const missing = group.path ? missingByPath.get(group.path) : undefined;
    const recovery = group.path ? recoveryByPath.get(group.path) : undefined;
    const accepted = Boolean(missing && manifest.missingAcceptance);
    const classification = !group.path
        ? group.areaType === "Area::TutorialArea"
            ? "image-not-applicable"
            : "dataset-path-missing"
        : owned
            ? "owned-asset-available"
            : recovery
                ? "official-local-recoverable"
                : accepted
                    ? "accepted-missing"
                    : "manifest-generation-failure";
    return {
        eventKey: group.eventKey,
        eventKind: group.eventKind,
        eventId: group.eventId,
        areaId: group.areaId,
        areaType: group.areaType,
        title: group.title,
        catalogEntryCount: group.entries.length,
        catalogEntryKeys: group.entries.map(entry => entry.key),
        projectedEventImagePath: group.path,
        manifestState: !group.path
            ? "no-path"
            : owned
                ? "present"
                : accepted
                    ? "accepted-missing"
                    : missing
                        ? "missing"
                        : "not-requested",
        classification,
        runtimeFailureDiagnosis: classification === "image-not-applicable"
            ? "not-applicable"
            : classification === "dataset-path-missing"
                ? "dataset-projection"
                : classification === "owned-asset-available"
                    ? "render-or-cache"
                    : classification === "accepted-missing"
                        ? "accepted-source-gap"
                        : classification === "official-local-recoverable"
                            ? "official-local-recovery-pending"
                            : "manifest-generation",
        ownedAsset: owned ? {
            objectKey: owned.objectKey,
            sha256: owned.sha256,
            sizeBytes: owned.sizeBytes,
            sourceUrl: owned.sourceUrl,
        } : null,
        missingAcceptance: accepted ? {
            sourceSnapshotVersion: manifest.missingAcceptance.sourceSnapshotVersion,
            missingPathsSha256: manifest.missingAcceptance.missingPathsSha256,
            reason: manifest.missingAcceptance.reason,
        } : null,
        officialLocalRecovery: recovery ?? null,
    };
}
function validateInputs(catalog, manifest, recoveries) {
    if (catalog.schemaVersion !== 1 || catalog.contract !== "dokkan-stage-delivery"
        || catalog.count !== catalog.entries.length)
        throw new Error("Invalid Stage catalog");
    if (catalog.datasetVersion !== manifest.datasetVersion
        || catalog.sourceSnapshotVersion !== manifest.sourceSnapshotVersion
        || catalog.sourceDatabaseSha256 !== manifest.sourceDatabaseSha256) {
        throw new Error("Stage catalog and asset manifest identities do not match");
    }
    (0, game_db_stage_assets_publisher_1.validateStageAssetManifest)(manifest);
    if (!recoveries)
        return;
    if (recoveries.schemaVersion !== 1
        || recoveries.sourceSnapshotVersion !== catalog.sourceSnapshotVersion
        || !/^\d+$/.test(recoveries.assetVersion)
        || recoveries.packageName !== "com.bandainamcogames.dbzdokkanww"
        || recoveries.cpkReader.repository !== "https://github.com/Sewer56/CriFsV2Lib"
        || !/^[a-f0-9]{40}$/.test(recoveries.cpkReader.commit)) {
        throw new Error("Invalid official local Stage asset recovery manifest");
    }
    for (const asset of recoveries.assets) {
        if ((0, game_db_stage_assets_1.normalizeStageAssetPath)(asset.path) !== asset.path
            || !safeRelativePath(asset.sourceArchivePath)
            || !safeRelativePath(asset.sourceMemberPath)
            || !/^[a-f0-9]{64}$/.test(asset.sourceArchiveSha256)
            || !/^[a-f0-9]{64}$/.test(asset.sha256)
            || !Number.isSafeInteger(asset.sizeBytes) || asset.sizeBytes < 8) {
            throw new Error(`Invalid official local Stage asset recovery: ${asset.path ?? "unknown"}`);
        }
    }
}
function uniqueMap(values, label) {
    const result = new Map();
    for (const value of values) {
        if (result.has(value.path))
            throw new Error(`Duplicate ${label} path: ${value.path}`);
        result.set(value.path, value);
    }
    return result;
}
function unique(values) {
    return [...new Set(values)].sort(numericTextCompare);
}
function isBannerPath(path) {
    return path.startsWith("banners/en/event/");
}
function safeRelativePath(value) {
    return Boolean(value) && !value.startsWith("/") && !/^[A-Za-z]:/.test(value)
        && value.split(/[\\/]/).every(part => Boolean(part) && part !== "." && part !== "..");
}
function count(events, classification) {
    return events.filter(event => event.classification === classification).length;
}
function numericTextCompare(left, right) {
    return left.localeCompare(right, "en", { numeric: true });
}
function sha256(bytes) {
    return (0, crypto_1.createHash)("sha256").update(bytes).digest("hex");
}
async function readJson(path) {
    const bytes = await (0, promises_1.readFile)(path);
    const expanded = path.endsWith(".gz") ? (0, zlib_1.gunzipSync)(bytes) : bytes;
    return JSON.parse(expanded.toString("utf8"));
}
async function main() {
    const values = new Map();
    const supported = new Set(["--catalog", "--asset-manifest", "--official-local-recoveries", "--output"]);
    const args = process.argv.slice(2);
    for (let index = 0; index < args.length; index += 1) {
        const [name, inline] = args[index].split("=", 2);
        if (!supported.has(name))
            throw new Error(`Unexpected Stage event image coverage argument: ${args[index]}`);
        const value = inline ?? args[++index];
        if (!value || values.has(name))
            throw new Error(`Missing or duplicate Stage event image coverage argument: ${name}`);
        values.set(name, value);
    }
    for (const required of ["--catalog", "--asset-manifest", "--output"]) {
        if (!values.has(required))
            throw new Error(`Missing Stage event image coverage argument: ${required}`);
    }
    const catalog = await readJson((0, path_1.resolve)(values.get("--catalog")));
    const manifest = await readJson((0, path_1.resolve)(values.get("--asset-manifest")));
    const recoveries = values.get("--official-local-recoveries")
        ? await readJson((0, path_1.resolve)(values.get("--official-local-recoveries")))
        : undefined;
    const report = buildStageEventImageCoverageReport(catalog, manifest, recoveries);
    const output = (0, path_1.resolve)(values.get("--output"));
    await (0, format_json_1.writeFormattedJson)(output, report);
    console.log(JSON.stringify({ output, ...report.summary, reportSha256: report.reportSha256 }, null, 2));
}
if (require.main === module) {
    main().catch(error => {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
    });
}
//# sourceMappingURL=game-db-stage-event-image-coverage.js.map