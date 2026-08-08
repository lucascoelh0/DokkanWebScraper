import { createHash } from "crypto";
import { auditCaptureManifest, readValidatedCaptureSnapshot, sanitizeHarEntryStructure } from "./capture-h0-audit";
import { CaptureH0Dataset, CaptureInputManifest } from "./capture-h0-contract";
import { CaptureProductResponseContext } from "./capture-product-contract";
import { forEachCaptureProductResponse } from "./capture-product-core";
import { CaptureH6AssetObservation, CaptureH6DatabaseDescriptor, CaptureH6DeliveryEvidence, CaptureH6Provenance, CaptureH6ReferenceKind, CaptureH6Validation, CaptureH6Dataset } from "./capture-h6-contract";

type PendingObservation = Omit<CaptureH6AssetObservation, "observationId">;
type PendingDescriptor = Omit<CaptureH6DatabaseDescriptor, "descriptorId">;
const CDN_HOST = "cf.ishin-global.aktsk.com";
const assetPathPattern = /^\/(?:banners\/en\/(?:event|gashasocool|home|news|popup)|images\/en\/(?:event|home|mission|panel_mission)|sqlite\/current\/en)\/[A-Za-z0-9][A-Za-z0-9._/-]{0,1022}\.(png|jpg|db)$/i;
const referenceCoordinates = new Set([
    "/db_stories\0$.db_stories[].areas[].banner_image", "/db_stories\0$.db_stories[].areas[].event_image", "/db_stories\0$.db_stories[].areas[].listbutton_image", "/db_stories\0$.db_stories[].banner_image",
    "/events\0$.events[].banner_image", "/events\0$.events[].event_image", "/events\0$.events[].listbutton_image", "/events\0$.z_battle_stages[].banner_image", "/events\0$.z_battle_stages[].listbutton_image", "/events\0$.z_battle_stages[].super_z_battle_stage.banner_image", "/events\0$.z_battle_stages[].super_z_battle_stage.listbutton_image",
    "/events/eventkagi_events\0$.eventkagi_events[].banner_image", "/events/eventkagi_events\0$.eventkagi_events[].event_image", "/events/eventkagi_events\0$.eventkagi_events[].listbutton_image", "/events/eventkagi_events\0$.eventkagi_z_battle_stages[].banner_image", "/events/eventkagi_events\0$.eventkagi_z_battle_stages[].listbutton_image",
    "/gashas\0$.gashas[].banner_url",
    "/missions/mission_board_campaigns\0$.mission_board_campaigns[].banner_image_path", "/missions/mission_board_campaigns\0$.mission_board_campaigns[].complete_image_path", "/missions/mission_board_campaigns\0$.mission_board_campaigns[].mission_boards[].background_image_path",
    "/missions/mission_board_campaigns/:id/images\0$.mission_board_campaign.banner_image_path", "/missions/mission_board_campaigns/:id/images\0$.mission_board_campaign.complete_image_path", "/missions/mission_board_campaigns/:id/images\0$.mission_board_campaign.mission_boards[].background_image_path",
    "/resources/home\0$.banners[].image", "/resources/home\0$.genkai_battles.genkai_battles[].listbutton_image", "/resources/home\0$.rmbattles.banner_image",
    "/title/banners\0$.banners[].image",
]);
const mixedApiEndpoints = new Set(["/events", "/gashas", "/resources/home"]);
const referenceKinds = new Set(["product_json_reference", "client_database_url", "captured_cdn_request"]);
const deliveryEvidenceKinds = new Set(["reference_only", "http_2xx_response_observed", "http_304_revalidation_observed"]);

function sha256(value: string): string { return createHash("sha256").update(value).digest("hex"); }
function objects(value: unknown): any[] { return Array.isArray(value) ? value.filter(item => item && typeof item === "object") : []; }
function unsafeRawPath(path: string): boolean { return /[\\%]/.test(path) || path.includes("//") || path.split("/").some(segment => segment === "." || segment === ".."); }
function sanitizedAssetPath(raw: unknown): string | null {
    if (typeof raw !== "string" || raw.length === 0 || raw.length > 2048 || /[\u0000-\u001f\\]/.test(raw)) return null;
    let pathname: string;
    try {
        const scheme = raw.match(/^[A-Za-z][A-Za-z0-9+.-]*:\/\//)?.[0];
        if (scheme) {
            const pathStart = raw.indexOf("/", scheme.length), rawPath = pathStart < 0 ? "/" : raw.slice(pathStart).split(/[?#]/, 1)[0];
            if (unsafeRawPath(rawPath)) return null;
        }
        const url = new URL(raw);
        if (url.protocol !== "https:" || url.hostname.toLowerCase() !== CDN_HOST || url.port || url.username || url.password) return null;
        pathname = url.pathname;
    } catch {
        if (/[?#]/.test(raw) || unsafeRawPath(raw)) return null;
        pathname = raw.startsWith("/") ? raw : `/${raw}`;
    }
    if (pathname.includes("..") || pathname.includes("//") || pathname.includes("%") || !assetPathPattern.test(pathname)) return null;
    return pathname;
}
function extension(path: string): "png" | "jpg" | "db" { return path.slice(path.lastIndexOf(".") + 1).toLowerCase() as "png" | "jpg" | "db"; }
function descriptorEvidenceSha256(version: number, algorithm: string, upstreamHashOpaque: string, assetPath: string): string { return sha256(`$.version|$.algorithm|$.hash|$.url\n${JSON.stringify({ version, algorithm, upstreamHashOpaque, assetPath })}`); }
function provenance(context: CaptureProductResponseContext, jsonPath: string, assetPath: string, hostClass: "official_api" | "official_cdn" = "official_api"): CaptureH6Provenance {
    return { captureId: context.captureId, captureFingerprint: context.captureFingerprint, captureSchemaFingerprint: context.captureSchemaFingerprint, captureSourceIdentityFingerprint: context.captureSourceIdentityFingerprint, capturePublicValueFingerprint: "", captureTimestamp: context.captureTimestamp, observedAt: context.observedAt, hostClass, normalizedEndpoint: context.normalizedEndpoint, endpointClassification: context.endpointClassification, method: "GET", httpStatus: context.httpStatus, jsonPath, confidence: "partial", userDerivedAuthority: false, evidenceOrigin: "official_capture_allowlisted_asset_evidence", valueEvidenceSha256: sha256(`${jsonPath}\n${assetPath}`) };
}
function addReference(target: PendingObservation[], context: CaptureProductResponseContext, raw: unknown, jsonPath: string, referenceKind: CaptureH6ReferenceKind = "product_json_reference"): void {
    const path = sanitizedAssetPath(raw);
    if (!path || !referenceCoordinates.has(`${context.normalizedEndpoint}\0${jsonPath}`) && referenceKind !== "client_database_url") return;
    target.push({ assetPath: path, assetPathSha256: sha256(path), extension: extension(path), referenceKind, deliveryEvidence: "reference_only", provenance: provenance(context, jsonPath, path) });
}
function addObjectFields(target: PendingObservation[], context: CaptureProductResponseContext, values: any[], fields: Array<[string, string]>): void { for (const value of values) for (const [key, path] of fields) addReference(target, context, value?.[key], path); }

function collectJsonReferences(target: PendingObservation[], descriptors: PendingDescriptor[], context: CaptureProductResponseContext): void {
    const body = context.body as any;
    if (!body || typeof body !== "object") return;
    if (context.normalizedEndpoint === "/client_assets/database") {
        const assetPath = sanitizedAssetPath(body.url);
        if (!assetPath || !Number.isSafeInteger(body.version) || body.version < 0 || body.version > 10 ** 12 || typeof body.algorithm !== "string" || !/^[a-z0-9_-]{1,16}$/.test(body.algorithm) || typeof body.hash !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(body.hash)) return;
        addReference(target, context, body.url, "$.url", "client_database_url");
        const descriptorProvenance = provenance(context, "$.version|$.algorithm|$.hash|$.url", assetPath);
        descriptorProvenance.valueEvidenceSha256 = descriptorEvidenceSha256(body.version, body.algorithm, body.hash, assetPath);
        descriptors.push({ version: body.version, algorithm: body.algorithm, upstreamHashOpaque: body.hash, assetPath, provenance: descriptorProvenance });
    } else if (context.normalizedEndpoint === "/events") {
        addObjectFields(target, context, objects(body.events), [["banner_image", "$.events[].banner_image"], ["event_image", "$.events[].event_image"], ["listbutton_image", "$.events[].listbutton_image"]]);
        const stages = objects(body.z_battle_stages);
        addObjectFields(target, context, stages, [["banner_image", "$.z_battle_stages[].banner_image"], ["listbutton_image", "$.z_battle_stages[].listbutton_image"]]);
        addObjectFields(target, context, stages.map(value => value.super_z_battle_stage).filter(Boolean), [["banner_image", "$.z_battle_stages[].super_z_battle_stage.banner_image"], ["listbutton_image", "$.z_battle_stages[].super_z_battle_stage.listbutton_image"]]);
    } else if (context.normalizedEndpoint === "/events/eventkagi_events") {
        addObjectFields(target, context, objects(body.eventkagi_events), [["banner_image", "$.eventkagi_events[].banner_image"], ["event_image", "$.eventkagi_events[].event_image"], ["listbutton_image", "$.eventkagi_events[].listbutton_image"]]);
        addObjectFields(target, context, objects(body.eventkagi_z_battle_stages), [["banner_image", "$.eventkagi_z_battle_stages[].banner_image"], ["listbutton_image", "$.eventkagi_z_battle_stages[].listbutton_image"]]);
    } else if (context.normalizedEndpoint === "/db_stories") {
        const stories = objects(body.db_stories);
        addObjectFields(target, context, stories, [["banner_image", "$.db_stories[].banner_image"]]);
        addObjectFields(target, context, stories.flatMap(value => objects(value.areas)), [["banner_image", "$.db_stories[].areas[].banner_image"], ["event_image", "$.db_stories[].areas[].event_image"], ["listbutton_image", "$.db_stories[].areas[].listbutton_image"]]);
    } else if (context.normalizedEndpoint === "/gashas") addObjectFields(target, context, objects(body.gashas), [["banner_url", "$.gashas[].banner_url"]]);
    else if (context.normalizedEndpoint === "/missions/mission_board_campaigns") {
        const campaigns = objects(body.mission_board_campaigns);
        addObjectFields(target, context, campaigns, [["banner_image_path", "$.mission_board_campaigns[].banner_image_path"], ["complete_image_path", "$.mission_board_campaigns[].complete_image_path"]]);
        addObjectFields(target, context, campaigns.flatMap(value => objects(value.mission_boards)), [["background_image_path", "$.mission_board_campaigns[].mission_boards[].background_image_path"]]);
    } else if (context.normalizedEndpoint === "/missions/mission_board_campaigns/:id/images") {
        const campaign = body.mission_board_campaign;
        addObjectFields(target, context, campaign && typeof campaign === "object" ? [campaign] : [], [["banner_image_path", "$.mission_board_campaign.banner_image_path"], ["complete_image_path", "$.mission_board_campaign.complete_image_path"]]);
        addObjectFields(target, context, objects(campaign?.mission_boards), [["background_image_path", "$.mission_board_campaign.mission_boards[].background_image_path"]]);
    } else if (context.normalizedEndpoint === "/resources/home") {
        addObjectFields(target, context, objects(body.banners), [["image", "$.banners[].image"]]);
        addObjectFields(target, context, objects(body.genkai_battles?.genkai_battles), [["listbutton_image", "$.genkai_battles.genkai_battles[].listbutton_image"]]);
        addObjectFields(target, context, body.rmbattles && typeof body.rmbattles === "object" ? [body.rmbattles] : [], [["banner_image", "$.rmbattles.banner_image"]]);
    } else if (context.normalizedEndpoint === "/title/banners") addObjectFields(target, context, objects(body.banners), [["image", "$.banners[].image"]]);
}

function exactH0(expected: CaptureH0Dataset, current: CaptureH0Dataset): void {
    if (expected.contract !== current.contract || expected.contractVersion !== current.contractVersion || expected.captures.length !== current.captures.length) throw new Error("H6 H0 contract drift");
    for (const capture of current.captures) {
        const prior = expected.captures.find(value => value.captureId === capture.captureId);
        if (!prior || prior.sizeBytes !== capture.sizeBytes || prior.entryCount !== capture.entryCount || prior.structuralFingerprint !== capture.structuralFingerprint || prior.schemaFingerprint !== capture.schemaFingerprint || prior.sourceIdentityFingerprint !== capture.sourceIdentityFingerprint) throw new Error(`H6 capture drift for ${capture.captureId}`);
    }
}

function collectCdnRequests(target: PendingObservation[], manifest: CaptureInputManifest, roots: Record<string, string>, h0: CaptureH0Dataset): void {
    const current = auditCaptureManifest(manifest, roots); exactH0(h0, current);
    const root = roots[manifest.inputRoot]; if (!root) throw new Error("H6 root is not allowlisted");
    for (const input of manifest.captures) {
        const lineage = current.captures.find(value => value.captureId === input.captureId)!;
        if (!lineage.capturedAtStart) throw new Error(`H6 capture ${input.captureId} has no timestamp`);
        const snapshot = readValidatedCaptureSnapshot(root, input.path, input.captureId);
        if (snapshot.sourceIdentityFingerprint !== lineage.sourceIdentityFingerprint) throw new Error(`H6 source identity drift for ${input.captureId}`);
        const har = JSON.parse(snapshot.text); if (!Array.isArray(har?.log?.entries)) throw new Error(`H6 invalid HAR ${input.captureId}`);
        for (const raw of har.log.entries) {
            const safe = sanitizeHarEntryStructure(raw); if (!safe || safe.hostClass !== "official_cdn" || safe.method !== "GET" || !safe.capturedAt || safe.classification !== "asset_delivery" || !(safe.status === 304 || safe.status >= 200 && safe.status <= 299)) continue;
            const assetPath = sanitizedAssetPath(raw?.request?.url); if (!assetPath) continue;
            const deliveryEvidence: CaptureH6DeliveryEvidence = safe.status === 304 ? "http_304_revalidation_observed" : "http_2xx_response_observed";
            const context: CaptureProductResponseContext = { captureId: input.captureId, captureFingerprint: lineage.structuralFingerprint, captureSchemaFingerprint: lineage.schemaFingerprint, captureSourceIdentityFingerprint: lineage.sourceIdentityFingerprint, captureTimestamp: lineage.capturedAtStart, normalizedEndpoint: safe.normalizedEndpoint, method: "GET", observedAt: safe.capturedAt, httpStatus: safe.status, endpointClassification: "asset_delivery", hostname: CDN_HOST, pathname: assetPath, body: null };
            target.push({ assetPath, assetPathSha256: sha256(assetPath), extension: extension(assetPath), referenceKind: "captured_cdn_request", deliveryEvidence, provenance: provenance(context, "$request.url.pathname", assetPath, "official_cdn") });
        }
    }
}

function projectionRows(observations: PendingObservation[], descriptors: PendingDescriptor[]): Map<string, string[]> {
    const rows = new Map<string, string[]>();
    const add = (captureId: string, row: unknown) => rows.set(captureId, [...(rows.get(captureId) ?? []), JSON.stringify(row)]);
    for (const value of observations) { const p = value.provenance; add(p.captureId, { assetPath: value.assetPath, extension: value.extension, referenceKind: value.referenceKind, deliveryEvidence: value.deliveryEvidence, endpoint: p.normalizedEndpoint, observedAt: p.observedAt, status: p.httpStatus, jsonPath: p.jsonPath }); }
    for (const value of descriptors) { const p = value.provenance; add(p.captureId, { descriptor: true, version: value.version, algorithm: value.algorithm, upstreamHashOpaque: value.upstreamHashOpaque, assetPath: value.assetPath, observedAt: p.observedAt, status: p.httpStatus }); }
    return rows;
}
function publicFingerprints(observations: PendingObservation[], descriptors: PendingDescriptor[]): Map<string, string> { return new Map([...projectionRows(observations, descriptors)].map(([captureId, rows]) => [captureId, sha256(rows.sort((a, b) => a.localeCompare(b)).join("\n"))])); }
function observationId(value: PendingObservation): string { return sha256(JSON.stringify(value)); }
function descriptorId(value: PendingDescriptor): string { return sha256(JSON.stringify(value)); }

export function buildCaptureH6(manifest: CaptureInputManifest, roots: Record<string, string>, h0: CaptureH0Dataset): CaptureH6Dataset {
    const observations: PendingObservation[] = [], descriptors: PendingDescriptor[] = [];
    forEachCaptureProductResponse(manifest, roots, h0, context => { if (context.hostname === "ishin-global.aktsk.com") collectJsonReferences(observations, descriptors, context); });
    collectCdnRequests(observations, manifest, roots, h0);
    const uniqueObservations = [...new Map(observations.map(value => [JSON.stringify(value), value])).values()];
    const uniqueDescriptors = [...new Map(descriptors.map(value => [JSON.stringify(value), value])).values()];
    const fingerprints = publicFingerprints(uniqueObservations, uniqueDescriptors);
    for (const value of [...uniqueObservations, ...uniqueDescriptors]) value.provenance.capturePublicValueFingerprint = fingerprints.get(value.provenance.captureId)!;
    const finalObservations = uniqueObservations.map(value => ({ observationId: observationId(value), ...value })).sort((a, b) => a.observationId.localeCompare(b.observationId));
    const finalDescriptors = uniqueDescriptors.map(value => ({ descriptorId: descriptorId(value), ...value })).sort((a, b) => a.descriptorId.localeCompare(b.descriptorId));
    const dataset: CaptureH6Dataset = { schemaVersion: 1, contract: "dokkan-official-capture-asset-evidence", contractVersion: "0.7.0", generatedAt: h0.generatedAt, generatedAtPolicy: "latest_capture_timestamp_for_deterministic_bytes", collectionMode: "offline_allowlisted_references_and_captured_requests_no_requests", productionMutation: false, defaultEnabled: false, authority: "capture_observation_partial_no_current_availability_or_content_completeness_authority", queryDisposition: "omitted_all_query_names_and_values", cdnBodyDisposition: "omitted_no_asset_bytes_persisted", joinPolicy: "exact_sanitized_asset_path_only_no_inferred_identity", observations: finalObservations, databaseDescriptors: finalDescriptors };
    const validation = validateCaptureH6(dataset, h0); if (!validation.valid) throw new Error(`H6 validation failed: ${validation.failures.join(", ")}`);
    return dataset;
}

export function validateCaptureH6(dataset: CaptureH6Dataset, h0: CaptureH0Dataset): CaptureH6Validation {
    const failures: string[] = [], ids = new Set<string>(); let userDerivedAuthorityCount = 0, referenceCount = 0, capturedCdnRequestCount = 0;
    const pendingObservations: PendingObservation[] = dataset.observations.map(({ observationId: _id, ...value }) => value), pendingDescriptors: PendingDescriptor[] = dataset.databaseDescriptors.map(({ descriptorId: _id, ...value }) => value);
    const fingerprints = publicFingerprints(pendingObservations, pendingDescriptors), expectedCaptures = new Map(h0.captures.map(value => [value.captureId, value]));
    const validateProvenance = (p: CaptureH6Provenance, assetPath: string, expectedEvidenceSha256 = sha256(`${p.jsonPath}\n${assetPath}`)) => {
        const expected = expectedCaptures.get(p.captureId);
        if (!/^[a-z0-9][a-z0-9_-]{0,47}$/.test(p.captureId) || !expected || p.captureFingerprint !== expected.structuralFingerprint || p.captureSchemaFingerprint !== expected.schemaFingerprint || p.captureSourceIdentityFingerprint !== expected.sourceIdentityFingerprint || p.captureTimestamp !== expected.capturedAtStart || p.capturePublicValueFingerprint !== fingerprints.get(p.captureId) || p.method !== "GET" || !Number.isInteger(p.httpStatus) || Number.isNaN(Date.parse(p.observedAt)) || p.confidence !== "partial" || p.userDerivedAuthority !== false || p.evidenceOrigin !== "official_capture_allowlisted_asset_evidence" || p.valueEvidenceSha256 !== expectedEvidenceSha256) failures.push("provenance boundary");
        if (p.userDerivedAuthority !== false) userDerivedAuthorityCount += 1;
    };
    const captured2xxPaths = new Set(dataset.observations.filter(value => value.referenceKind === "captured_cdn_request" && value.deliveryEvidence === "http_2xx_response_observed").map(value => value.assetPath));
    const captured304Paths = new Set(dataset.observations.filter(value => value.referenceKind === "captured_cdn_request" && value.deliveryEvidence === "http_304_revalidation_observed").map(value => value.assetPath));
    const referencedPaths = new Set<string>();
    for (const value of dataset.observations) {
        const { observationId: _id, ...withoutId } = value; const p = value.provenance, match = value.assetPath.match(assetPathPattern);
        if (ids.has(value.observationId) || value.observationId !== observationId(withoutId)) failures.push("observation identity"); ids.add(value.observationId);
        if (!referenceKinds.has(value.referenceKind) || !deliveryEvidenceKinds.has(value.deliveryEvidence)) failures.push("observation enum");
        if (!match || value.extension !== extension(value.assetPath) || value.assetPathSha256 !== sha256(value.assetPath) || /[?#\\%]/.test(value.assetPath) || value.assetPath.includes("..") || value.assetPath.includes("//")) failures.push("asset path");
        validateProvenance(p, value.assetPath);
        if (value.referenceKind === "captured_cdn_request") {
            capturedCdnRequestCount += 1;
            const validStatusEvidence = p.httpStatus === 304 && value.deliveryEvidence === "http_304_revalidation_observed" || p.httpStatus >= 200 && p.httpStatus <= 299 && value.deliveryEvidence === "http_2xx_response_observed";
            if (p.hostClass !== "official_cdn" || p.endpointClassification !== "asset_delivery" || p.normalizedEndpoint !== `/asset/${value.extension}` || p.jsonPath !== "$request.url.pathname" || !validStatusEvidence) failures.push("CDN evidence boundary");
        } else {
            referenceCount += 1; referencedPaths.add(value.assetPath);
            const expectedClassification = mixedApiEndpoints.has(p.normalizedEndpoint) ? "mixed_product_and_user_state" : "product_catalog";
            if (!(value.referenceKind === "product_json_reference" || value.referenceKind === "client_database_url") || p.hostClass !== "official_api" || p.endpointClassification !== expectedClassification || p.httpStatus < 200 || p.httpStatus > 299 || value.deliveryEvidence !== "reference_only") failures.push("reference evidence boundary");
            if (value.referenceKind === "client_database_url") { if (p.normalizedEndpoint !== "/client_assets/database" || p.jsonPath !== "$.url" || value.extension !== "db") failures.push("database URL coordinate"); }
            else if (!referenceCoordinates.has(`${p.normalizedEndpoint}\0${p.jsonPath}`)) failures.push("reference coordinate allowlist");
        }
    }
    for (const value of dataset.databaseDescriptors) {
        const { descriptorId: _id, ...withoutId } = value, p = value.provenance;
        if (ids.has(value.descriptorId) || value.descriptorId !== descriptorId(withoutId)) failures.push("descriptor identity"); ids.add(value.descriptorId);
        if (!Number.isSafeInteger(value.version) || value.version < 0 || value.version > 10 ** 12 || !/^[a-z0-9_-]{1,16}$/.test(value.algorithm) || !/^[A-Za-z0-9_-]{1,128}$/.test(value.upstreamHashOpaque) || sanitizedAssetPath(value.assetPath) !== value.assetPath || extension(value.assetPath) !== "db") failures.push("descriptor value domain");
        validateProvenance(p, value.assetPath, descriptorEvidenceSha256(value.version, value.algorithm, value.upstreamHashOpaque, value.assetPath));
        if (p.valueEvidenceSha256 !== descriptorEvidenceSha256(value.version, value.algorithm, value.upstreamHashOpaque, value.assetPath)) failures.push("descriptor evidence digest");
        if (p.hostClass !== "official_api" || p.endpointClassification !== "product_catalog" || p.normalizedEndpoint !== "/client_assets/database" || p.jsonPath !== "$.version|$.algorithm|$.hash|$.url" || p.httpStatus < 200 || p.httpStatus > 299) failures.push("descriptor coordinate");
    }
    if (dataset.schemaVersion !== 1 || dataset.contract !== "dokkan-official-capture-asset-evidence" || dataset.contractVersion !== "0.7.0" || dataset.productionMutation !== false || dataset.defaultEnabled !== false || dataset.authority !== "capture_observation_partial_no_current_availability_or_content_completeness_authority" || dataset.queryDisposition !== "omitted_all_query_names_and_values" || dataset.cdnBodyDisposition !== "omitted_no_asset_bytes_persisted" || dataset.joinPolicy !== "exact_sanitized_asset_path_only_no_inferred_identity") failures.push("dataset contract");
    if (dataset.observations.length === 0 || referenceCount === 0 || capturedCdnRequestCount === 0) failures.push("empty evidence class");
    if (userDerivedAuthorityCount !== 0) failures.push("user-derived authority");
    return { schemaVersion: 1, valid: failures.length === 0, observationCount: dataset.observations.length, databaseDescriptorCount: dataset.databaseDescriptors.length, referenceCount, capturedCdnRequestCount, exactReferenceWithCaptured2xxPathCount: [...referencedPaths].filter(path => captured2xxPaths.has(path)).length, exactReferenceWithCaptured304PathCount: [...referencedPaths].filter(path => captured304Paths.has(path)).length, userDerivedAuthorityCount, failures: [...new Set(failures)] };
}
