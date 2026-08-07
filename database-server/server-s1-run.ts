import { createHash } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import { dirname, resolve } from "path";
import { JSDOM } from "jsdom";
import { ServerReadonlyHttpClient, ServerHttpResponse } from "./server-readonly-http";
import { buildServerS1Coverage, buildServerS1Dataset, ServerS1RawBanner, ServerS1RawEvent, ServerS1RawFeaturedCharacter, validateServerS1Dataset } from "./server-s1-builder";
import { ServerS1CaptureFailure, ServerS1Manifest } from "./server-s1-contract";

const OUTPUT_DIR = resolve(process.cwd(), "data", "database-server", "s1");
const MINIMUM_INTERVAL_MS = 1000;
const MAXIMUM_RESPONSE_BYTES = 5 * 1024 * 1024;
const MAXIMUM_AGGREGATE_BYTES = 50 * 1024 * 1024;
const MAXIMUM_SUMMON_PAGES_PER_CATEGORY = 3;
const MAXIMUM_SUMMON_DETAILS = 50;
const SUMMON_CATEGORIES = [{ id: 1, label: "Recommended" }, { id: 2, label: "Dragon Stone" }, { id: 3, label: "Ticket" }, { id: 4, label: "Friend Pts." }];

interface FyiSummary { id?: number | string; name?: string | null; description?: string | null; starts_at?: string | null; ends_at?: string | null; banner?: string | null }
interface FyiFeatured { character_id?: number | string | null; character?: { id?: number | string | null; canonical_id?: number | string | null; base_character_id?: number | string | null } | null }
interface FyiDetail extends FyiSummary { featured_characters?: FyiFeatured[] | null }
interface FyiPage { props?: { summons?: { data?: FyiSummary[]; meta?: { last_page?: number | string | null } }; summon?: FyiDetail } }

function jsonText(value: unknown): string { return `${JSON.stringify(value, null, 2)}\n`; }
function sha256(value: string): string { return createHash("sha256").update(value).digest("hex"); }
function clean(value: unknown): string | undefined { const normalized = typeof value === "string" || typeof value === "number" ? String(value).trim() : ""; return normalized || undefined; }
function numericId(value: unknown): string | undefined { const normalized = clean(value); return normalized && /^\d+$/.test(normalized) ? normalized : undefined; }
function errorMessage(error: unknown): string { return (error instanceof Error ? error.message : String(error)).replace(/[\r\n]+/g, " ").slice(0, 500); }

function pagePayload(html: string): FyiPage {
    const document = new JSDOM(html).window.document, script = document.querySelector('script[data-page="app"]');
    if (!script?.textContent) throw new Error("Missing dokkan.fyi structured page payload.");
    const value = JSON.parse(script.textContent) as FyiPage;
    if (!value || typeof value !== "object" || !value.props) throw new Error("Unknown dokkan.fyi page schema.");
    return value;
}

function featured(value: FyiFeatured): ServerS1RawFeaturedCharacter | undefined {
    const entryCharacterId = numericId(value.character_id), payloadCharacterId = numericId(value.character?.id), canonicalId = numericId(value.character?.canonical_id), baseCharacterId = numericId(value.character?.base_character_id);
    return entryCharacterId || payloadCharacterId || canonicalId || baseCharacterId ? { ...(entryCharacterId ? { entryCharacterId } : {}), ...(payloadCharacterId ? { payloadCharacterId } : {}), ...(canonicalId ? { canonicalId } : {}), ...(baseCharacterId ? { baseCharacterId } : {}) } : undefined;
}

export async function runServerS1(outputDir = OUTPUT_DIR) {
    const rawDir = resolve(outputDir, "raw");
    const s0Dir = resolve(dirname(outputDir), "s0"), s0Manifest = JSON.parse(await readFile(resolve(s0Dir, "server-s0-manifest.json"), "utf8")) as { contractVersion?: string; fileName?: string; sha256?: string; sizeBytes?: number; sourceSnapshotVersion?: string };
    if (s0Manifest.contractVersion !== "0.1.0" || s0Manifest.fileName !== "server-s0-catalog.json" || s0Manifest.sourceSnapshotVersion !== "global-6.4.0-v338-2026-08-05") throw new Error("S1 rejects unknown S0 manifest identity.");
    const s0Payload = await readFile(resolve(s0Dir, s0Manifest.fileName), "utf8"), s0Sha256 = sha256(s0Payload);
    if (s0Sha256 !== s0Manifest.sha256 || Buffer.byteLength(s0Payload) !== s0Manifest.sizeBytes || s0Sha256 !== "199074a781dd94f64eb425f7965672edd84982041de82ccc8f7ac9211b7603a9") throw new Error("S1 rejects incompatible S0 payload identity.");
    const s0Catalog = JSON.parse(s0Payload) as { endpoints?: Array<{ key?: string; observedMethod?: string; collectionGate?: string }> }, requiredEndpointKeys: ["fyi-active-summons", "fyi-summon-detail"] = ["fyi-active-summons", "fyi-summon-detail"];
    for (const endpointKey of requiredEndpointKeys) {
        const endpoint = s0Catalog.endpoints?.find(value => value.key === endpointKey);
        if (endpoint?.observedMethod !== "GET" || endpoint.collectionGate !== "eligible_get_probe") throw new Error(`S1 endpoint is not authorized by S0: ${endpointKey}`);
    }
    const client = new ServerReadonlyHttpClient({ allowedHosts: ["dokkan.fyi"], minimumIntervalMs: MINIMUM_INTERVAL_MS, maximumResponseBytes: MAXIMUM_RESPONSE_BYTES, maximumAggregateBytes: MAXIMUM_AGGREGATE_BYTES });
    const receipts: ServerHttpResponse["receipt"][] = [], failures: ServerS1CaptureFailure[] = [], summaries = new Map<string, ServerS1RawBanner>(), events = new Map<string, ServerS1RawEvent>();
    const capture = async (source: ServerS1CaptureFailure["source"], key: string, url: string): Promise<ServerHttpResponse | undefined> => {
        try {
            const response = await client.get(url);
            await mkdir(rawDir, { recursive: true });
            await Promise.all([writeFile(resolve(rawDir, `${key}.html`), response.body), writeFile(resolve(rawDir, `${key}.receipt.json`), jsonText(response.receipt))]);
            receipts.push(response.receipt);
            return response;
        } catch (error) {
            failures.push({ source, requestKey: key, attemptedAt: new Date().toISOString(), message: errorMessage(error) });
            return undefined;
        }
    };

    for (const category of SUMMON_CATEGORIES) {
        let lastPage = 1;
        for (let page = 1; page <= Math.min(lastPage, MAXIMUM_SUMMON_PAGES_PER_CATEGORY); page += 1) {
            const key = `fyi-summons-category-${category.id}-page-${page}`, response = await capture("dokkan_fyi", key, `https://dokkan.fyi/summons?active=true&category=${category.id}&page=${page}`);
            if (!response) break;
            try {
                const payload = pagePayload(response.body.toString("utf8")), rows = payload.props?.summons?.data;
                if (!Array.isArray(rows)) throw new Error("Missing dokkan.fyi summons data array.");
                const observedLastPage = Number(payload.props?.summons?.meta?.last_page ?? 1);
                if (!Number.isInteger(observedLastPage) || observedLastPage < 1) throw new Error("Invalid dokkan.fyi summon pagination.");
                lastPage = observedLastPage;
                if (lastPage > MAXIMUM_SUMMON_PAGES_PER_CATEGORY) failures.push({ source: "dokkan_fyi", requestKey: `${key}:pagination`, attemptedAt: response.receipt.fetchedAt, message: `last_page ${lastPage} exceeds bounded cap ${MAXIMUM_SUMMON_PAGES_PER_CATEGORY}` });
                for (const row of rows) {
                    const id = numericId(row.id); if (!id) continue;
                    const existing = summaries.get(id), membership = { id: String(category.id), label: category.label };
                    if (!existing) summaries.set(id, { id, ...(clean(row.name) ? { title: clean(row.name) } : {}), ...(clean(row.description) ? { description: clean(row.description) } : {}), ...(clean(row.banner) ? { bannerUrl: clean(row.banner) } : {}), ...(clean(row.starts_at) ? { startsAt: clean(row.starts_at) } : {}), ...(clean(row.ends_at) ? { endsAt: clean(row.ends_at) } : {}), fetchedAt: response.receipt.fetchedAt, categoryMemberships: [membership], summaryReceiptSha256s: [response.receipt.sha256] });
                    else {
                        if (!existing.categoryMemberships.some(value => value.id === membership.id)) existing.categoryMemberships.push(membership);
                        if (!existing.summaryReceiptSha256s.includes(response.receipt.sha256)) existing.summaryReceiptSha256s.push(response.receipt.sha256);
                    }
                }
            } catch (error) { failures.push({ source: "dokkan_fyi", requestKey: `${key}:parse`, attemptedAt: response.receipt.fetchedAt, message: errorMessage(error) }); break; }
        }
    }

    const bannerIds = [...summaries.keys()].sort((left, right) => Number(left) - Number(right));
    if (bannerIds.length > MAXIMUM_SUMMON_DETAILS) failures.push({ source: "dokkan_fyi", requestKey: "summon-detail-cap", attemptedAt: receipts.map(value => value.fetchedAt).sort().at(-1) ?? new Date().toISOString(), message: `${bannerIds.length} active IDs exceed bounded detail cap ${MAXIMUM_SUMMON_DETAILS}` });
    for (const id of bannerIds.slice(0, MAXIMUM_SUMMON_DETAILS)) {
        const key = `fyi-summon-${id}`, response = await capture("dokkan_fyi", key, `https://dokkan.fyi/summons/${id}`);
        if (!response) continue;
        try {
            const detail = pagePayload(response.body.toString("utf8")).props?.summon;
            if (!detail || numericId(detail.id) !== id) throw new Error("Summon detail identity mismatch.");
            const row = summaries.get(id)!;
            if (Array.isArray(detail.featured_characters)) row.featuredCharacters = detail.featured_characters.map(featured).filter((value): value is ServerS1RawFeaturedCharacter => Boolean(value));
            row.fetchedAt = response.receipt.fetchedAt;
            row.detailReceiptSha256 = response.receipt.sha256;
        } catch (error) { failures.push({ source: "dokkan_fyi", requestKey: `${key}:parse`, attemptedAt: response.receipt.fetchedAt, message: errorMessage(error) }); }
    }

    const dataset = buildServerS1Dataset({ events: [...events.values()], banners: [...summaries.values()], receipts, failures, minimumIntervalMs: MINIMUM_INTERVAL_MS, maximumResponseBytes: MAXIMUM_RESPONSE_BYTES, maximumAggregateBytes: MAXIMUM_AGGREGATE_BYTES, sourceS0: { contractVersion: "0.1.0", sha256: s0Sha256, endpointKeys: requiredEndpointKeys } });
    const coverage = buildServerS1Coverage(dataset), validation = validateServerS1Dataset(dataset);
    if (!validation.valid) throw new Error(`S1 validation failed: ${validation.failures.join(", ")}`);
    const datasetText = jsonText(dataset), coverageText = jsonText(coverage), validationText = jsonText(validation);
    const manifest: ServerS1Manifest = { schemaVersion: 1, contractVersion: "0.2.0", generatedAt: dataset.generatedAt, fileName: "server-s1-schedule-banners.json", compression: "none", sha256: sha256(datasetText), sizeBytes: Buffer.byteLength(datasetText), sourceS0Sha256: dataset.sourceS0.sha256, coverage: { fileName: "server-s1-coverage.json", sha256: sha256(coverageText), sizeBytes: Buffer.byteLength(coverageText) }, validation: { fileName: "server-s1-validation.json", sha256: sha256(validationText), sizeBytes: Buffer.byteLength(validationText) } };
    await mkdir(outputDir, { recursive: true });
    await Promise.all([writeFile(resolve(outputDir, manifest.fileName), datasetText), writeFile(resolve(outputDir, manifest.coverage.fileName), coverageText), writeFile(resolve(outputDir, manifest.validation.fileName), validationText), writeFile(resolve(outputDir, "server-s1-manifest.json"), jsonText(manifest))]);
    return { dataset, coverage, validation, manifest, peakWorkingSetBytes: process.memoryUsage().rss };
}

if (require.main === module) runServerS1().then(value => console.log(JSON.stringify({ coverage: value.coverage, validation: value.validation, manifest: value.manifest, failures: value.dataset.collection.failures, peakWorkingSetBytes: value.peakWorkingSetBytes }, null, 2))).catch(error => { console.error(error); process.exitCode = 1; });
