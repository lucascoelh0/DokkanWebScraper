"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateDd4 = exports.buildDd4 = void 0;
function classify(pathname) {
    if (/^\/sqlite\//.test(pathname))
        return { family: "database", utility: "selective_candidate", rationale: "primary DB-first input" };
    if (/^\/banners\//.test(pathname))
        return { family: "event_banner_images", utility: "selective_candidate", rationale: "presentation candidate requiring structural binding" };
    if (/\/cpk\/character\/thumb\//.test(pathname))
        return { family: "character_thumbs", utility: "selective_candidate", rationale: "portrait candidate requiring container extraction and ID proof" };
    if (/\/cpk\/character\/card\//.test(pathname))
        return { family: "card_art", utility: "selective_candidate", rationale: "card-art candidate requiring structural ID proof" };
    if (/\/cpk\/item\//.test(pathname))
        return { family: "item_images", utility: "selective_candidate", rationale: "item/support-memory candidate requiring internal manifest proof" };
    if (/\/cpk\/(?:lua|script)\//.test(pathname) || /^\/html\//.test(pathname))
        return { family: "structural_scripts", utility: "unknown", rationale: "potentially structural but no consumer need or safe extraction contract proved" };
    if (/\/cpk\/bgm\//.test(pathname))
        return { family: "bgm_audio", utility: "do_not_mirror", rationale: "large optional audio outside Dokkanpanion needs" };
    if (/\/cpk\/packaged_movies\//.test(pathname))
        return { family: "videos", utility: "do_not_mirror", rationale: "large presentation media outside scope" };
    if (/\/cpk\/ingame\/battle\//.test(pathname))
        return { family: "battle_sprites_and_packages", utility: "do_not_mirror", rationale: "large battle runtime assets without product use" };
    return { family: "unclassified", utility: "unknown", rationale: "observed path family lacks an allowlisted Dokkanpanion role" };
}
function extension(pathname) { return pathname.match(/\.([a-z0-9]{1,8})$/i)?.[1].toLowerCase() ?? "none"; }
function buildDd4(dd1, dd2) {
    const grouped = new Map();
    for (const entry of dd1.entries.filter(value => value.scope === "cdn")) {
        const classified = classify(entry.pathname), ext = extension(entry.pathname), key = `${entry.captureId}\0${classified.family}\0${ext}`, requirement = entry.captureId === "incremental" ? "incremental_observation" : entry.captureId === "clean_install" ? "clean_install_prefix_partial" : entry.captureId === "download_all" ? "download_all_prefix_partial" : "unknown", current = grouped.get(key) ?? { captureId: entry.captureId, family: classified.family, extension: ext, requestCount: 0, declaredBytes: 0, capturedBodyBytes: 0, requirement, utility: classified.utility, rationale: classified.rationale };
        current.requestCount += 1;
        current.declaredBytes += entry.response.declaredSizeBytes ?? 0;
        current.capturedBodyBytes += entry.response.capturedSizeBytes;
        grouped.set(key, current);
    }
    const harRequestFamilies = [...grouped.values()].sort((a, b) => `${a.captureId}:${a.family}:${a.extension}`.localeCompare(`${b.captureId}:${b.family}:${b.extension}`));
    const full = dd2.clientAssets.externalFullManifest, mandatory = dd2.ondemand.externalBodyEvidence;
    if (!full || !mandatory)
        throw new Error("DD4 requires pinned external manifest summaries");
    const utility = (family) => {
        if (["character/card", "character/card_bg", "character/thumb", "item", "gasha/banner"].includes(family))
            return { utility: "selective_candidate", rationale: "candidate family requiring structural consumer binding and bounded extraction" };
        if (["bgm/voice/se", "movie/packaged_movies", "battle/effect/sprites", "ingame/battle/character"].includes(family))
            return { utility: "do_not_mirror", rationale: "large runtime or presentation family outside proved Dokkanpanion needs" };
        return { utility: "unknown", rationale: "no allowlisted product binding is proved" };
    };
    const inventoryFamilies = full.pathFamilySummaries.map(item => ({ ...item, ...utility(item.family) }));
    const dataset = { schemaVersion: 1, contract: "dokkan-data-download-family-catalog", contractVersion: "0.5.0", generatedAt: dd2.generatedAt, collectionMode: "offline_sanitized_path_statistics_only", defaultEnabled: false, productionMutation: false, pathPolicy: "aggregate_family_only_no_individual_asset_catalog", ui: { cleanInstallFiles: 4868, downloadAllFiles: 25233, arithmeticDifference: 20365, relationToCapturedRequests: "ui_total_matches_external_manifests_har_downloads_remain_prefixes" }, harRequestFamilies, fullInventory: { descriptorCount: full.descriptorCount, totalSizeBytes: full.totalSizeBytes, families: inventoryFamilies }, mandatoryManifest: { descriptorCount: mandatory.descriptorCount, totalSizeBytes: mandatory.totalSizeBytes, categories: mandatory.categories.map(item => ({ category: item.category, descriptorCount: item.descriptorCount, totalSizeBytes: item.totalSizeBytes })) }, usefulCandidates: ["database", "character_thumbs", "card_art", "event_banner_images", "item_images"], excludedFamilies: ["bgm_audio", "voice_audio", "sound_effects", "videos", "battle_sprites_and_packages"], unknownCandidates: ["structural_scripts", "unclassified"] };
    const validation = validateDd4(dataset);
    if (!validation.valid)
        throw new Error(`DD4 validation failed: ${validation.failures.join(", ")}`);
    return dataset;
}
exports.buildDd4 = buildDd4;
function validateDd4(value) { const failures = []; if (value.defaultEnabled || value.productionMutation || value.ui.downloadAllFiles - value.ui.cleanInstallFiles !== value.ui.arithmeticDifference || value.pathPolicy !== "aggregate_family_only_no_individual_asset_catalog" || value.harRequestFamilies.some(item => item.requestCount <= 0 || item.declaredBytes < 0 || item.capturedBodyBytes < 0) || value.fullInventory.descriptorCount !== value.ui.downloadAllFiles || value.mandatoryManifest.descriptorCount !== value.ui.cleanInstallFiles || value.fullInventory.families.reduce((sum, item) => sum + item.descriptorCount, 0) !== value.fullInventory.descriptorCount || value.fullInventory.families.reduce((sum, item) => sum + item.totalSizeBytes, 0) !== value.fullInventory.totalSizeBytes || value.mandatoryManifest.categories.reduce((sum, item) => sum + item.descriptorCount, 0) !== value.mandatoryManifest.descriptorCount || value.mandatoryManifest.categories.reduce((sum, item) => sum + item.totalSizeBytes, 0) !== value.mandatoryManifest.totalSizeBytes || !value.excludedFamilies.includes("bgm_audio") || !value.excludedFamilies.includes("battle_sprites_and_packages"))
    failures.push("DD4 catalog contract"); return { schemaVersion: 1, valid: failures.length === 0, failures, counts: { inventoryFamilies: value.fullInventory.families.length, harRequestFamilies: value.harRequestFamilies.length, harRequests: value.harRequestFamilies.reduce((sum, item) => sum + item.requestCount, 0), harDeclaredBytes: value.harRequestFamilies.reduce((sum, item) => sum + item.declaredBytes, 0), harCapturedBodyBytes: value.harRequestFamilies.reduce((sum, item) => sum + item.capturedBodyBytes, 0), fullDescriptors: value.fullInventory.descriptorCount, fullBytes: value.fullInventory.totalSizeBytes, mandatoryDescriptors: value.mandatoryManifest.descriptorCount, mandatoryBytes: value.mandatoryManifest.totalSizeBytes } }; }
exports.validateDd4 = validateDd4;
//# sourceMappingURL=data-download-dd4.js.map