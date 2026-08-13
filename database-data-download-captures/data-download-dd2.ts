import { Dd0Dataset, Dd0SourceLock, Dd1Dataset, Dd2Dataset, DdAssetDescriptor, DdClientAssetsContract, DdDatabaseContract, DdDatabaseDescriptor, DdManifestSummary, DdOndemandCategorySummary, DdOndemandContract, DdPathFamily, DdPathFamilySummary, DdProvenance, DdValidation } from "./data-download-contract";
import { LoadedDdCapture, LoadedDdExternalSource, sha256 } from "./data-download-core";

const API = "ishin-global.aktsk.com", CDN = "cf.ishin-global.aktsk.com";
function exactKeys(value: any, expected: string[], label: string): void { if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).sort().join("\0") !== [...expected].sort().join("\0")) throw new Error(`${label} exact allowlist mismatch`); }
function safeInteger(value: unknown, label: string): number { if (!Number.isSafeInteger(value) || (value as number) < 0) throw new Error(`${label} invalid integer`); return value as number; }
function safeToken(value: unknown, label: string, max = 256): string { if (typeof value !== "string" || value.length === 0 || value.length > max || !/^[A-Za-z0-9._-]+$/.test(value)) throw new Error(`${label} invalid token`); return value; }

export function sanitizeDdFilePath(value: unknown): string {
    if (typeof value !== "string" || value.length === 0 || value.length > 1024 || /[\u0000-\u001f\\]/.test(value) || value.startsWith("/") || /^[A-Za-z]:/.test(value) || /^[/\\]{2}/.test(value) || /^\\[?.]\\/.test(value) || value.includes("//")) throw new Error("DD2 unsafe file_path");
    const segments = value.split("/");
    if (segments.some(segment => !segment || segment === "." || segment === ".." || segment.includes("%") || !/^[A-Za-z0-9._&()-]+$/.test(segment))) throw new Error("DD2 unsafe file_path");
    return value;
}
export function sanitizeDdUrlPathname(value: unknown): string {
    if (typeof value !== "string" || value.length === 0 || value.length > 8192 || /[\u0000-\u001f\\]/.test(value)) throw new Error("DD2 unsafe URL");
    const rawPath = value.replace(/^[A-Za-z][A-Za-z0-9+.-]*:\/\/[^/]+/, "").split(/[?#]/, 1)[0];
    if (rawPath.includes("%") || rawPath.includes("//") || rawPath.split("/").some(segment => segment === "." || segment === "..")) throw new Error("DD2 unsafe URL");
    let url: URL; try { url = new URL(value); } catch { throw new Error("DD2 malformed URL"); }
    if (url.protocol !== "https:" || url.hostname.toLowerCase() !== CDN || url.port || url.username || url.password || !url.pathname.startsWith("/") || url.pathname.includes("//") || url.pathname.includes("%") || url.pathname.split("/").some(segment => segment === "." || segment === "..")) throw new Error("DD2 unsafe URL");
    return url.pathname;
}
function parseJsonBody(content: any, label: string): any { if (content?.encoding !== undefined) throw new Error(`${label} unknown encoding`); if (typeof content?.text !== "string" || content.text.length === 0) throw new Error(`${label} missing body`); const media = typeof content.mimeType === "string" ? content.mimeType.split(";", 1)[0].trim().toLowerCase() : ""; if (media !== "application/json" && !media.endsWith("+json")) throw new Error(`${label} non-JSON body`); try { return JSON.parse(content.text); } catch { throw new Error(`${label} malformed JSON`); } }
function provenance(source: LoadedDdCapture, entryIndex: number, pathname: DdProvenance["pathname"], status: number, bodyState: DdProvenance["bodyState"]): DdProvenance { const capturedAt = source.har.log.entries[entryIndex]?.startedDateTime, time = typeof capturedAt === "string" ? Date.parse(capturedAt) : NaN; return { captureId: source.lock.captureId, mode: source.lock.mode, entryIndex, capturedAt: Number.isFinite(time) ? new Date(time).toISOString() : null, pathname, status, bodyState }; }

export interface ExternalDescriptor { filePath: string; algorithm: "xxhash"; hash: string; sizeBytes: number; url: string }
interface ParsedOndemand { descriptors: ExternalDescriptor[]; categories: DdOndemandCategorySummary[]; identitySetSha256: string; totalSizeBytes: number }
interface ParsedFull { descriptors: ExternalDescriptor[]; latestVersion: number; identitySetSha256: string; totalSizeBytes: number }
function identityKey(value: ExternalDescriptor): string { return [value.filePath, value.algorithm, value.hash, value.sizeBytes].join("\0"); }
function identitySetSha(values: ExternalDescriptor[]): string { return sha256(values.map(identityKey).sort().join("\n")); }
export function validateUniqueExternalDescriptors(values: ExternalDescriptor[], label: string): void { if (new Set(values.map(value => value.filePath)).size !== values.length) throw new Error(`${label} duplicate file_path`); }
export function verifyExternalOndemandPair(left: ExternalDescriptor[], right: ExternalDescriptor[]): void { const rightByPath = new Map(right.map(value => [value.filePath, value])); if (left.length !== right.length || left.some(value => !rightByPath.has(value.filePath) || identityKey(value) !== identityKey(rightByPath.get(value.filePath)!) || value.url === rightByPath.get(value.filePath)!.url)) throw new Error("DD2 ondemand observations must agree by identity and differ by every URL"); }
export function verifyExactExternalSuperset(mandatory: ExternalDescriptor[], full: ExternalDescriptor[]): void { const fullByPath = new Map(full.map(value => [value.filePath, value])); if (mandatory.some(value => !fullByPath.has(value.filePath) || identityKey(value) !== identityKey(fullByPath.get(value.filePath)!))) throw new Error("DD2 full manifest is not an exact superset of mandatory ondemand assets"); }
export function requireManifestExternalSource(source: LoadedDdExternalSource): void { if (source.lock.classification !== "allowlisted_manifest_body_in_memory_only" || source.lock.endpoint === "/cards") throw new Error("DD2 account body cannot be used as a manifest"); }
function pathFamily(path: string): DdPathFamily {
    if (/^character\/card_bg(?:\/|_)/.test(path)) return "character/card_bg";
    if (/^character\/card(?:\/|_)/.test(path)) return "character/card";
    if (/^ingame\/battle\/character(?:\/|$)/.test(path)) return "ingame/battle/character";
    if (/^character\/thumb(?:\/|_)/.test(path)) return "character/thumb";
    if (/^(?:item|ingame\/item)(?:\/|$)/.test(path)) return "item";
    if (/^(?:gasha|banner|banners)(?:\/|$)/.test(path)) return "gasha/banner";
    if (/^(?:bgm|voice|se|sound)(?:\/|$)/.test(path)) return "bgm/voice/se";
    if (/^(?:movie|movies|packaged_movies)(?:\/|$)/.test(path)) return "movie/packaged_movies";
    if (/^(?:battle|effect|effects|sprite|sprites|ingame\/battle)(?:\/|$)/.test(path)) return "battle/effect/sprites";
    if (/^(?:script|lua|tmx|map)(?:\/|$)/.test(path)) return "structural_script/lua/tmx";
    return "other";
}
export function summarizePathFamilies(values: ExternalDescriptor[]): DdPathFamilySummary[] {
    const groups = new Map<string, DdPathFamilySummary>();
    for (const value of values) { const family = pathFamily(value.filePath), extension = value.filePath.match(/\.([A-Za-z0-9]{1,12})$/)?.[1]?.toLowerCase() ?? "none"; if (!/^[a-z0-9]{1,12}$|^none$/.test(extension)) throw new Error("DD2 unsafe aggregate extension"); const key = `${family}\0${extension}`, current = groups.get(key) ?? { family, extension, descriptorCount: 0, totalSizeBytes: 0 }; current.descriptorCount += 1; current.totalSizeBytes += value.sizeBytes; groups.set(key, current); }
    return [...groups.values()].sort((a, b) => `${a.family}\0${a.extension}`.localeCompare(`${b.family}\0${b.extension}`));
}
function parseExternalDescriptors(value: unknown, expectedCount: number, expectedBytes: number, label: string): ExternalDescriptor[] {
    if (!Array.isArray(value) || value.length !== expectedCount) throw new Error(`${label} cardinality mismatch`);
    const descriptors = value.map((item: any): ExternalDescriptor => { exactKeys(item, ["algorithm", "file_path", "hash", "size", "url"], `${label} descriptor`); if (item.algorithm !== "xxhash") throw new Error(`${label} algorithm mismatch`); const urlPathname = sanitizeDdUrlPathname(item.url), filePath = sanitizeDdFilePath(item.file_path); if (!urlPathname.endsWith(`/${filePath}`)) throw new Error(`${label} URL/file_path mismatch`); return { filePath, algorithm: "xxhash", hash: safeToken(item.hash, `${label} hash`), sizeBytes: safeInteger(item.size, `${label} size`), url: item.url }; });
    validateUniqueExternalDescriptors(descriptors, label);
    if (descriptors.reduce((sum, value) => sum + value.sizeBytes, 0) !== expectedBytes) throw new Error(`${label} byte total mismatch`);
    return descriptors;
}
export function parseExternalOndemandBody(text: string): ParsedOndemand {
    let body: any; try { body = JSON.parse(text); } catch { throw new Error("DD2 malformed external ondemand JSON"); } exactKeys(body, ["cards", "battle_characters", "card_bgs"], "DD2 external ondemand");
    const specs: Array<[DdOndemandCategorySummary["category"], number, number]> = [["cards", 3376, 1716271776], ["battle_characters", 1230, 963445952], ["card_bgs", 262, 1472695232]];
    const descriptors: ExternalDescriptor[] = [], categories: DdOndemandCategorySummary[] = [];
    for (const [category, count, bytes] of specs) { const values = parseExternalDescriptors(body[category], count, bytes, `DD2 ondemand ${category}`); descriptors.push(...values); categories.push({ category, descriptorCount: count, totalSizeBytes: bytes, algorithm: "xxhash", identitySetSha256: identitySetSha(values) }); }
    if (descriptors.length !== 4868 || descriptors.reduce((sum, value) => sum + value.sizeBytes, 0) !== 4152412960 || new Set(descriptors.map(value => value.filePath)).size !== 4868) throw new Error("DD2 ondemand aggregate mismatch");
    return { descriptors, categories, identitySetSha256: identitySetSha(descriptors), totalSizeBytes: 4152412960 };
}
export function parseExternalClientAssetsBody(text: string): ParsedFull {
    let body: any; try { body = JSON.parse(text); } catch { throw new Error("DD2 malformed external client assets JSON"); } exactKeys(body, ["assets", "latest_version"], "DD2 external client assets");
    if (body.latest_version !== 1786514403) throw new Error("DD2 external latest version mismatch");
    const descriptors = parseExternalDescriptors(body.assets, 25233, 22349705433, "DD2 external client assets");
    return { descriptors, latestVersion: body.latest_version, identitySetSha256: identitySetSha(descriptors), totalSizeBytes: 22349705433 };
}
function externalSummary(source: LoadedDdExternalSource, parsed: { descriptors: ExternalDescriptor[]; identitySetSha256: string; totalSizeBytes: number }, transportBinding: DdProvenance): DdManifestSummary { return { sourceId: source.lock.sourceId, descriptorCount: parsed.descriptors.length, uniqueFilePathCount: new Set(parsed.descriptors.map(value => value.filePath)).size, totalSizeBytes: parsed.totalSizeBytes, algorithm: "xxhash", identitySetSha256: parsed.identitySetSha256, urlPolicy: "ephemeral_non_identity_not_persisted", transportBinding }; }

export function parseClientAssetsBody(content: any, sourceProvenance: DdProvenance): { latestVersion: number; assets: DdAssetDescriptor[] } {
    const body = parseJsonBody(content, "DD2 /client_assets"); exactKeys(body, ["assets", "latest_version"], "DD2 /client_assets");
    const latestVersion = safeInteger(body.latest_version, "DD2 latest_version"); if (!Array.isArray(body.assets) || body.assets.length === 0 || body.assets.length > 100_000) throw new Error("DD2 impossible /client_assets cardinality");
    const assets = body.assets.map((item: any): DdAssetDescriptor => { exactKeys(item, ["algorithm", "file_path", "hash", "size", "url"], "DD2 asset"); return { filePath: sanitizeDdFilePath(item.file_path), urlPathname: sanitizeDdUrlPathname(item.url), algorithm: safeToken(item.algorithm, "DD2 asset algorithm", 32), upstreamHashOpaque: safeToken(item.hash, "DD2 asset hash"), sizeBytes: safeInteger(item.size, "DD2 asset size"), state: "observed", provenance: sourceProvenance }; });
    if (new Set(assets.map(value => value.filePath)).size !== assets.length) throw new Error("DD2 duplicate /client_assets file_path");
    return { latestVersion, assets };
}

export function parseDatabaseBody(content: any, sourceProvenance: DdProvenance, observedCdnDeclaredSizeBytes: number | null): DdDatabaseDescriptor {
    const body = parseJsonBody(content, "DD2 /client_assets/database"); exactKeys(body, ["algorithm", "file_path", "hash", "patch", "patch_hash", "url", "version"], "DD2 database");
    if (body.patch !== null || body.patch_hash !== null) throw new Error("DD2 unsupported non-null database patch shape");
    return { version: safeInteger(body.version, "DD2 database version"), algorithm: safeToken(body.algorithm, "DD2 database algorithm", 32), upstreamHashOpaque: safeToken(body.hash, "DD2 database hash"), filePath: sanitizeDdFilePath(body.file_path), urlPathname: sanitizeDdUrlPathname(body.url), patch: { descriptorState: "observed_null", hashState: "observed_null" }, observedCdnDeclaredSizeBytes, state: "observed", provenance: sourceProvenance };
}

export function buildDd2(loaded: LoadedDdCapture[], external: LoadedDdExternalSource[], lock: Dd0SourceLock, dd0: Dd0Dataset, dd1: Dd1Dataset): Dd2Dataset {
    if (dd0.sourceLockSha256 !== sha256(`${JSON.stringify(lock, null, 2)}\n`) || dd1.sources.some((value, index) => value.sha256 !== lock.captures[index]?.sha256)) throw new Error("DD2 exact lineage mismatch");
    if (external.length !== 4 || external.some((value, index) => value.lock.sourceId !== lock.externalConfidentialSources[index]?.sourceId || sha256(value.text) !== value.lock.sha256)) throw new Error("DD2 external source lineage mismatch");
    const clientProvenance: DdProvenance[] = [], assets: DdAssetDescriptor[] = [], clientCardinalities: number[] = []; let latestVersion: number | null = null;
    const databaseProvenance: DdProvenance[] = [], descriptors: DdDatabaseDescriptor[] = [], ondemandProvenance: DdProvenance[] = [];
    for (const source of loaded) source.har.log.entries.forEach((entry: any, entryIndex: number) => {
        let url: URL; try { url = new URL(entry?.request?.url); } catch { throw new Error(`DD2 invalid request URL ${source.lock.captureId}:${entryIndex}`); }
        if (url.hostname.toLowerCase() !== API || !["/client_assets", "/client_assets/database", "/ondemand_assets"].includes(url.pathname)) return;
        const status = Number.isSafeInteger(entry?.response?.status) ? entry.response.status : 0, present = typeof entry?.response?.content?.text === "string" && entry.response.content.text.length > 0, p = provenance(source, entryIndex, url.pathname as DdProvenance["pathname"], status, present ? "observed" : "absent_partial_unknown");
        const expectedMethod = url.pathname === "/ondemand_assets" ? "POST" : "GET", inventory = dd1.entries.find(value => value.captureId === source.lock.captureId && value.entryIndex === entryIndex);
        if (entry?.request?.method !== expectedMethod || status !== 200) throw new Error(`DD2 unexpected endpoint transport ${source.lock.captureId}:${entryIndex}`);
        if (!inventory || inventory.host !== API || inventory.method !== expectedMethod || inventory.pathname !== url.pathname || inventory.status !== status || present !== (inventory.response.disposition === "json_identity")) throw new Error(`DD2/DD1 entry lineage mismatch ${source.lock.captureId}:${entryIndex}`);
        if (url.pathname === "/client_assets") { clientProvenance.push(p); if (present) { const parsed = parseClientAssetsBody(entry.response.content, p); if (latestVersion !== null && latestVersion !== parsed.latestVersion) throw new Error("DD2 inconsistent client asset versions"); latestVersion = parsed.latestVersion; clientCardinalities.push(parsed.assets.length); assets.push(...parsed.assets); } }
        else if (url.pathname === "/client_assets/database") {
            databaseProvenance.push(p); if (!present) return;
            const provisional = parseDatabaseBody(entry.response.content, p, null);
            const matches = dd1.entries.filter(value => value.captureId === source.lock.captureId && value.host === CDN && value.method === "GET" && value.status >= 200 && value.status <= 299 && value.pathname === provisional.urlPathname);
            if (matches.length > 1) throw new Error("DD2 ambiguous exact CDN database pathname");
            provisional.observedCdnDeclaredSizeBytes = matches[0]?.response.declaredSizeBytes ?? null; descriptors.push(provisional);
        } else { ondemandProvenance.push(p); if (present) throw new Error("DD2 /ondemand_assets body requires a separately reviewed allowlist"); }
    });
    if (assets.length === 0 || descriptors.length === 0) throw new Error("DD2 missing required observed contract body");
    const externalById = new Map(external.map(value => [value.lock.sourceId, value]));
    const cleanExternal = externalById.get("clean_install_ondemand_manifest")!, downloadExternal = externalById.get("download_all_ondemand_manifest")!, fullExternal = externalById.get("download_all_client_assets_manifest")!, accountExternal = externalById.get("clean_install_cards_account_body")!;
    if (!cleanExternal || !downloadExternal || !fullExternal || !accountExternal || accountExternal.lock.classification !== "opaque_account_scoped_sensitive_body" || accountExternal.lock.endpoint !== "/cards") throw new Error("DD2 external classification misuse");
    for (const source of [cleanExternal, downloadExternal, fullExternal]) requireManifestExternalSource(source);
    const cleanOndemand = parseExternalOndemandBody(cleanExternal.text), downloadOndemand = parseExternalOndemandBody(downloadExternal.text), full = parseExternalClientAssetsBody(fullExternal.text);
    if (latestVersion === null || full.latestVersion !== latestVersion) throw new Error("DD2 external and HAR latest versions disagree");
    const cleanByPath = new Map(cleanOndemand.descriptors.map(value => [value.filePath, value]));
    if (cleanOndemand.identitySetSha256 !== downloadOndemand.identitySetSha256) throw new Error("DD2 ondemand identity mismatch"); verifyExternalOndemandPair(cleanOndemand.descriptors, downloadOndemand.descriptors); verifyExactExternalSuperset(cleanOndemand.descriptors, full.descriptors);
    const deltaCount = full.descriptors.length - cleanOndemand.descriptors.length, deltaSizeBytes = full.totalSizeBytes - cleanOndemand.totalSizeBytes;
    if (deltaCount !== 20365 || deltaSizeBytes !== 18197292473) throw new Error("DD2 full manifest delta mismatch");
    const bind = (captureId: "clean_install" | "download_all", pathname: "/ondemand_assets" | "/client_assets"): DdProvenance => { const matches = (pathname === "/ondemand_assets" ? ondemandProvenance : clientProvenance).filter(value => value.captureId === captureId && value.pathname === pathname && value.status === 200 && value.bodyState === "absent_partial_unknown"); if (matches.length !== 1) throw new Error(`DD2 external body transport binding mismatch ${captureId}:${pathname}`); return matches[0]; };
    const cleanBinding = bind("clean_install", "/ondemand_assets"), downloadBinding = bind("download_all", "/ondemand_assets"), fullBinding = bind("download_all", "/client_assets");
    const databaseBytes = descriptors.find(value => value.provenance.captureId === "download_all")?.observedCdnDeclaredSizeBytes;
    const queryValue = fullExternal.discoveredQueryValueSecret;
    if (databaseBytes !== 97738752 || queryValue === null || !/^\d+$/.test(queryValue) || BigInt(queryValue) !== BigInt(cleanOndemand.totalSizeBytes) + BigInt(databaseBytes)) throw new Error("DD2 capture-specific device size relation mismatch");
    const clientEntries = dd1.entries.filter(value => value.pathname === "/client_assets" && value.host === API), deviceObserved = clientEntries.filter(value => value.deviceAssetSizeBytesQuery.presence === "present"), deviceRelations = deviceObserved.map(value => value.deviceAssetSizeBytesQuery.relationToPriorObservation).filter(value => value !== "not_comparable");
    const assetShapes = new Map<string, Set<string>>(); for (const value of assets) { const shape = JSON.stringify([value.urlPathname, value.algorithm, value.upstreamHashOpaque, value.sizeBytes]); assetShapes.set(value.filePath, new Set([...(assetShapes.get(value.filePath) ?? []), shape])); }
    const descriptorShapes = new Set(descriptors.map(value => JSON.stringify([value.version, value.algorithm, value.upstreamHashOpaque, value.filePath, value.urlPathname, value.observedCdnDeclaredSizeBytes])));
    const clientConsistency: DdClientAssetsContract["crossObservationConsistency"] = clientCardinalities.length <= 1 ? "single_observation" : [...assetShapes.values()].some(value => value.size > 1) || new Set(clientCardinalities).size > 1 ? "representation_mismatch" : "agreement";
    const databaseConsistency: DdDatabaseContract["crossObservationConsistency"] = descriptors.length <= 1 ? "single_observation" : descriptorShapes.size === 1 ? "agreement" : "representation_mismatch";
    const clientAssets: DdClientAssetsContract = { endpoint: "/client_assets", state: clientConsistency === "representation_mismatch" ? "partial" : "observed", completeness: "captured_response_only_not_complete_catalog", latestVersion, observedResponseCardinalities: clientCardinalities, descriptorObservationCount: assets.length, uniqueFilePathCount: assetShapes.size, crossObservationConsistency: clientConsistency, assets, externalFullManifest: { ...externalSummary(fullExternal, full, fullBinding), latestVersion: full.latestVersion, pathFamilySummaries: summarizePathFamilies(full.descriptors), mandatoryOndemandRelation: { relation: "exact_superset", mandatoryCount: cleanOndemand.descriptors.length, mandatorySizeBytes: cleanOndemand.totalSizeBytes, deltaCount, deltaSizeBytes } }, deviceAssetSizeBytesQuery: { observedCount: deviceObserved.length, absentCount: clientEntries.length - deviceObserved.length, observedType: deviceObserved.every(value => value.deviceAssetSizeBytesQuery.type === "decimal_string") ? "decimal_string" : "unknown", crossObservationRelation: deviceRelations.includes("different") ? "different" : deviceRelations.includes("equal") ? "equal" : "not_comparable", captureSpecificProof: { captureId: "download_all", scope: "capture_specific_not_universal", mandatoryAssetSizeBytes: cleanOndemand.totalSizeBytes, databaseSizeBytes: databaseBytes, equality: true, queryValuePersisted: false } }, provenance: clientProvenance };
    const database: DdDatabaseContract = { endpoint: "/client_assets/database", state: databaseConsistency === "representation_mismatch" ? "partial" : "observed", descriptorObservationCount: descriptors.length, uniqueDescriptorCount: descriptorShapes.size, crossObservationConsistency: databaseConsistency, descriptors, provenance: databaseProvenance };
    const ondemand: DdOndemandContract = { endpoint: "/ondemand_assets", state: "partial", completeness: "external_body_observed_bound_to_body_absent_har_not_universal_complete_catalog", cardinality: null, assets: [], externalBodyEvidence: { observations: [externalSummary(cleanExternal, cleanOndemand, cleanBinding), externalSummary(downloadExternal, downloadOndemand, downloadBinding)], categories: cleanOndemand.categories, descriptorCount: cleanOndemand.descriptors.length, uniqueFilePathCount: cleanByPath.size, totalSizeBytes: cleanOndemand.totalSizeBytes, identityAcrossObservations: "agreement", urlsAcrossObservations: "all_different_ephemeral_non_identity" }, provenance: ondemandProvenance };
    const dataset: Dd2Dataset = { schemaVersion: 1, contract: "dokkan-data-download-asset-contracts", contractVersion: "0.1.0", generatedAt: dd1.generatedAt, collectionMode: "offline_local_har_no_requests_no_replay", productionMutation: false, defaultEnabled: false, authority: "observed_delivery_metadata_only_no_catalog_completeness_or_runtime_authority", clientAssets, database, ondemand };
    const validation = validateDd2(dataset); if (!validation.valid) throw new Error(`DD2 validation failed: ${validation.failures.join(", ")}`); return dataset;
}

export function validateDd2(dataset: Dd2Dataset): DdValidation {
    const failures: string[] = [];
    if (dataset.schemaVersion !== 1 || dataset.contract !== "dokkan-data-download-asset-contracts" || dataset.contractVersion !== "0.1.0" || dataset.productionMutation !== false || dataset.defaultEnabled !== false || dataset.ondemand.cardinality !== null || dataset.ondemand.assets.length !== 0 || dataset.ondemand.completeness !== "external_body_observed_bound_to_body_absent_har_not_universal_complete_catalog") failures.push("dataset contract");
    if (dataset.clientAssets.descriptorObservationCount !== dataset.clientAssets.assets.length || dataset.clientAssets.uniqueFilePathCount !== new Set(dataset.clientAssets.assets.map(value => value.filePath)).size || dataset.clientAssets.assets.length === 0 || dataset.clientAssets.observedResponseCardinalities.reduce((sum, value) => sum + value, 0) !== dataset.clientAssets.assets.length || dataset.database.descriptorObservationCount !== dataset.database.descriptors.length || dataset.database.uniqueDescriptorCount !== new Set(dataset.database.descriptors.map(value => JSON.stringify([value.version, value.algorithm, value.upstreamHashOpaque, value.filePath, value.urlPathname, value.observedCdnDeclaredSizeBytes]))).size || dataset.database.descriptors.length === 0) failures.push("cardinality");
    for (const asset of dataset.clientAssets.assets) { try { if (sanitizeDdFilePath(asset.filePath) !== asset.filePath || !asset.urlPathname.startsWith("/") || asset.urlPathname.includes("?")) failures.push("asset path"); } catch { failures.push("asset path"); } }
    for (const descriptor of dataset.database.descriptors) if (!descriptor.urlPathname.startsWith("/") || descriptor.urlPathname.includes("?") || descriptor.patch.descriptorState !== "observed_null" || descriptor.patch.hashState !== "observed_null" || descriptor.observedCdnDeclaredSizeBytes !== null && (!Number.isSafeInteger(descriptor.observedCdnDeclaredSizeBytes) || descriptor.observedCdnDeclaredSizeBytes < 0)) failures.push("database descriptor");
    const full = dataset.clientAssets.externalFullManifest, mandatory = dataset.ondemand.externalBodyEvidence, proof = dataset.clientAssets.deviceAssetSizeBytesQuery.captureSpecificProof;
    if (!full || full.descriptorCount !== 25233 || full.uniqueFilePathCount !== 25233 || full.totalSizeBytes !== 22349705433 || full.latestVersion !== 1786514403 || full.latestVersion !== dataset.clientAssets.latestVersion || full.algorithm !== "xxhash" || full.urlPolicy !== "ephemeral_non_identity_not_persisted" || full.pathFamilySummaries.reduce((sum, value) => sum + value.descriptorCount, 0) !== 25233 || full.pathFamilySummaries.reduce((sum, value) => sum + value.totalSizeBytes, 0) !== 22349705433 || full.mandatoryOndemandRelation.mandatoryCount !== 4868 || full.mandatoryOndemandRelation.mandatorySizeBytes !== 4152412960 || full.mandatoryOndemandRelation.deltaCount !== 20365 || full.mandatoryOndemandRelation.deltaSizeBytes !== 18197292473) failures.push("external full manifest");
    if (!mandatory || mandatory.observations.length !== 2 || mandatory.descriptorCount !== 4868 || mandatory.uniqueFilePathCount !== 4868 || mandatory.totalSizeBytes !== 4152412960 || mandatory.categories.length !== 3 || mandatory.identityAcrossObservations !== "agreement" || mandatory.urlsAcrossObservations !== "all_different_ephemeral_non_identity" || mandatory.observations.some(value => value.urlPolicy !== "ephemeral_non_identity_not_persisted")) failures.push("external ondemand manifest");
    if (!proof || proof.captureId !== "download_all" || proof.scope !== "capture_specific_not_universal" || proof.mandatoryAssetSizeBytes !== 4152412960 || proof.databaseSizeBytes !== 97738752 || proof.equality !== true || proof.queryValuePersisted !== false) failures.push("capture-specific query relation");
    return { schemaVersion: 1, valid: failures.length === 0, failures: [...new Set(failures)], counts: { clientAssets: dataset.clientAssets.assets.length, externalClientAssets: full?.descriptorCount ?? 0, databaseDescriptors: dataset.database.descriptors.length, externalOndemandAssets: mandatory?.descriptorCount ?? 0, ondemandProvenance: dataset.ondemand.provenance.length } };
}
