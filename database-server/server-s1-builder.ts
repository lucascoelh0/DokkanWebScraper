import { ServerHttpReceipt } from "./server-readonly-http";
import {
    ServerS1AvailabilityState,
    ServerS1BannerRecord,
    ServerS1Coverage,
    ServerS1Dataset,
    ServerS1Period,
    ServerS1ScheduleRecord,
    ServerS1TimeValue,
    ServerS1Validation,
} from "./server-s1-contract";

export interface ServerS1RawEvent {
    sourceFamily: string;
    id: string;
    title?: string;
    imagePath?: string;
    startsAt?: string;
    endsAt?: string;
    fetchedAt: string;
    receiptSha256: string;
}

export interface ServerS1RawFeaturedCharacter {
    entryCharacterId?: string;
    payloadCharacterId?: string;
    canonicalId?: string;
    baseCharacterId?: string;
}

export interface ServerS1RawBanner {
    id: string;
    title?: string;
    description?: string;
    bannerUrl?: string;
    startsAt?: string;
    endsAt?: string;
    fetchedAt: string;
    categoryMemberships: Array<{ id: string; label: string }>;
    featuredCharacters?: ServerS1RawFeaturedCharacter[];
    summaryReceiptSha256s: string[];
    detailReceiptSha256?: string;
}

export interface BuildServerS1Options {
    events: ServerS1RawEvent[];
    banners: ServerS1RawBanner[];
    receipts: ServerHttpReceipt[];
    failures: ServerS1Dataset["collection"]["failures"];
    minimumIntervalMs: number;
    maximumResponseBytes: number;
    maximumAggregateBytes: number;
    sourceS0: { contractVersion: "0.1.0"; sha256: string; endpointKeys: ["fyi-active-summons", "fyi-summon-detail"] };
}

function clean(value: string | undefined): string | undefined {
    const normalized = value?.trim();
    return normalized ? normalized : undefined;
}

export function timeValue(rawValue: string | undefined): ServerS1TimeValue | undefined {
    const raw = clean(rawValue);
    if (!raw) return undefined;
    const zulu = /Z$/i.test(raw), offsetMatch = raw.match(/([+-]\d{2}:?\d{2})$/), gmtMatch = raw.match(/GMT([+-]\d{1,2})(?::(\d{2}))?$/i);
    const offset = zulu ? "+00:00" : offsetMatch ? offsetMatch[1].replace(/([+-]\d{2})(\d{2})$/, "$1:$2") : gmtMatch ? `${Number(gmtMatch[1]) >= 0 ? "+" : "-"}${Math.abs(Number(gmtMatch[1])).toString().padStart(2, "0")}:${gmtMatch[2] ?? "00"}` : undefined;
    if (!offset) return { raw, timezone: { status: "unknown", missing: "explicit_timezone" } };
    const parsed = Date.parse(raw);
    return Number.isFinite(parsed)
        ? { raw, normalizedInstant: new Date(parsed).toISOString(), timezone: { status: "supported", kind: "explicit_offset", offset } }
        : { raw, timezone: { status: "unknown", missing: "explicit_timezone" } };
}

function period(startsAt?: string, endsAt?: string): ServerS1Period {
    const start = timeValue(startsAt), end = timeValue(endsAt);
    return { ...(start ? { startsAt: start } : {}), ...(end ? { endsAt: end } : {}) };
}

export function calculateAvailability(value: ServerS1Period, asOf: string): { state: ServerS1AvailabilityState; asOf: string; status: "partial" | "unknown"; basis: string[] } {
    const now = Date.parse(asOf), start = value.startsAt?.normalizedInstant ? Date.parse(value.startsAt.normalizedInstant) : NaN, end = value.endsAt?.normalizedInstant ? Date.parse(value.endsAt.normalizedInstant) : NaN;
    if (!Number.isFinite(now) || !Number.isFinite(start) || !Number.isFinite(end)) return { state: "unknown", asOf, status: "unknown", basis: ["complete_explicit_period_unavailable"] };
    const state: ServerS1AvailabilityState = now < start ? "future" : now > end ? "ended" : "active";
    return { state, asOf, status: "partial", basis: ["community_period", "collector_clock", "not_official_server_state"] };
}

function schedule(raw: ServerS1RawEvent): ServerS1ScheduleRecord {
    const value = period(raw.startsAt, raw.endsAt), title = clean(raw.title), imagePath = clean(raw.imagePath);
    return {
        identity: { sourceFamily: raw.sourceFamily, rootId: raw.id },
        source: "dokkaninfo_community_shadow",
        status: "partial",
        ...((title || imagePath) ? { presentation: { ...(title ? { title } : {}), ...(imagePath ? { imagePath } : {}), locale: "source_embedded_unverified" as const } } : {}),
        period: value,
        sourceReportedAvailability: "listed_by_source",
        calculatedAvailability: calculateAvailability(value, raw.fetchedAt),
        staticIdentityJoin: { status: "unknown", boundary: "join_deferred_to_s2" },
        provenance: { receiptSha256: raw.receiptSha256 },
    };
}

function banner(raw: ServerS1RawBanner): ServerS1BannerRecord {
    const value = period(raw.startsAt, raw.endsAt), title = clean(raw.title), description = clean(raw.description), bannerUrl = clean(raw.bannerUrl);
    const entries = raw.featuredCharacters?.map((entry, ordinal) => ({ ordinal, ...entry, boundary: "community_structural_ids_not_official_featured_relation" as const }))
        .filter(entry => entry.entryCharacterId || entry.payloadCharacterId || entry.canonicalId || entry.baseCharacterId);
    return {
        identity: { kind: "gasha", id: raw.id },
        source: "dokkan_fyi_community_shadow",
        status: "partial",
        categoryMemberships: [...raw.categoryMemberships]
            .sort((left, right) => Number(left.id) - Number(right.id))
            .map(value => ({ ...value, status: "partial", boundary: "query_filter_membership_not_official_currency_semantics" })),
        ...((title || description || bannerUrl) ? { presentation: { ...(title ? { title } : {}), ...(description ? { description } : {}), ...(bannerUrl ? { bannerUrl } : {}), locale: "source_embedded_unverified" as const } } : {}),
        period: value,
        sourceReportedAvailability: "active_query_result",
        calculatedAvailability: calculateAvailability(value, raw.fetchedAt),
        featuredCharacters: raw.featuredCharacters === undefined ? { status: "unknown", missing: "detail_fetch_or_featured_field" } : { status: "partial", entries: entries ?? [] },
        currency: { status: "unknown", missing: "official_currency_or_ticket_identity" },
        stepsAndRates: { status: "unknown", missing: "s1_does_not_promote_commercial_or_probability_semantics" },
        provenance: { summaryReceiptSha256s: [...raw.summaryReceiptSha256s].sort(), ...(raw.detailReceiptSha256 ? { detailReceiptSha256: raw.detailReceiptSha256 } : {}) },
    };
}

export function buildServerS1Dataset(options: BuildServerS1Options): ServerS1Dataset {
    if (options.receipts.length === 0) throw new Error("S1 requires at least one successful public GET receipt.");
    const generatedAt = [...options.receipts].map(value => value.fetchedAt).sort().at(-1)!;
    return {
        schemaVersion: 1,
        contract: "dokkan-server-schedule-and-banners",
        contractVersion: "0.2.0",
        generatedAt,
        generatedAtPolicy: "derived_from_latest_successful_fetch_time",
        sourceSnapshotVersion: "global-6.4.0-v338-2026-08-05",
        sourceS0: options.sourceS0,
        authority: { role: "community_shadow_only", officialDynamicAuthorityCount: 0, sqliteStaticAuthorityPreserved: true },
        collection: { method: "GET", concurrency: 1, minimumIntervalMs: options.minimumIntervalMs, maximumResponseBytes: options.maximumResponseBytes, maximumAggregateBytes: options.maximumAggregateBytes, fetchedBytes: options.receipts.reduce((sum, value) => sum + value.sizeBytes, 0), receipts: [...options.receipts].sort((left, right) => left.url.localeCompare(right.url)), failures: [...options.failures].sort((left, right) => left.requestKey.localeCompare(right.requestKey)) },
        schedules: options.events.map(schedule).sort((left, right) => left.identity.sourceFamily.localeCompare(right.identity.sourceFamily) || Number(left.identity.rootId) - Number(right.identity.rootId)),
        banners: options.banners.map(banner).sort((left, right) => Number(left.identity.id) - Number(right.identity.id)),
        maintenance: { status: "unknown", missing: "credential_free_structured_current_maintenance_source" },
        boundaries: [
            { key: "official_schedule_authority", status: "unknown", reason: "Official client paths remain discover-only because credential-free GET behavior and schemas are unproved." },
            { key: "community_active_filters", status: "partial", reason: "Source listing and local period calculation are shadow evidence, not official current availability." },
            { key: "banner_currency_and_rates", status: "unknown", reason: "Category labels and community rate presentation are not promoted to official commercial semantics." },
            { key: "maintenance", status: "unknown", reason: "No credential-free structured current maintenance source was identified." },
        ],
    };
}

export function buildServerS1Coverage(dataset: ServerS1Dataset): ServerS1Coverage {
    const periods = [...dataset.schedules.map(value => value.period), ...dataset.banners.map(value => value.period)], times = periods.flatMap(value => [value.startsAt, value.endsAt]).filter((value): value is ServerS1TimeValue => Boolean(value));
    const states: ServerS1AvailabilityState[] = ["active", "future", "ended", "unknown"], availability = [...dataset.schedules.map(value => value.calculatedAvailability.state), ...dataset.banners.map(value => value.calculatedAvailability.state)];
    return {
        schemaVersion: 1,
        attemptedRequestCount: dataset.collection.receipts.length + dataset.collection.failures.filter(value => !value.requestKey.includes(":parse") && !value.requestKey.includes(":pagination") && value.requestKey !== "summon-detail-cap").length,
        successfulRequestCount: dataset.collection.receipts.length,
        failedRequestCount: dataset.collection.failures.length,
        fetchedBytes: dataset.collection.fetchedBytes,
        scheduleCount: dataset.schedules.length,
        bannerCount: dataset.banners.length,
        featuredCharacterReferenceCount: dataset.banners.reduce((sum, value) => sum + (value.featuredCharacters.status === "partial" ? value.featuredCharacters.entries.length : 0), 0),
        explicitTimezoneValueCount: times.filter(value => value.timezone.status === "supported").length,
        unknownTimezoneValueCount: times.filter(value => value.timezone.status === "unknown").length,
        availabilityCounts: Object.fromEntries(states.map(state => [state, availability.filter(value => value === state).length])) as Record<ServerS1AvailabilityState, number>,
        officialDynamicAuthorityCount: 0,
    };
}

export function validateServerS1Dataset(dataset: ServerS1Dataset): ServerS1Validation {
    const failures: string[] = [], unique = (values: string[]) => new Set(values).size === values.length;
    if (dataset.schemaVersion !== 1 || dataset.contract !== "dokkan-server-schedule-and-banners" || dataset.contractVersion !== "0.2.0") failures.push("contract identity");
    if (dataset.sourceSnapshotVersion !== "global-6.4.0-v338-2026-08-05" || dataset.sourceS0.contractVersion !== "0.1.0" || dataset.sourceS0.sha256 !== "199074a781dd94f64eb425f7965672edd84982041de82ccc8f7ac9211b7603a9" || JSON.stringify(dataset.sourceS0.endpointKeys) !== JSON.stringify(["fyi-active-summons", "fyi-summon-detail"])) failures.push("S0 lineage");
    const getOnly = dataset.collection.method === "GET" && dataset.collection.concurrency === 1 && dataset.collection.receipts.every(value => {
        try { const url = new URL(value.url); return url.protocol === "https:" && url.hostname === "dokkan.fyi"; } catch { return false; }
    });
    if (!getOnly) failures.push("GET-only collection");
    if (!unique(dataset.schedules.map(value => `${value.identity.sourceFamily}:${value.identity.rootId}`)) || !unique(dataset.banners.map(value => value.identity.id))) failures.push("duplicate structural identity");
    if (dataset.schedules.length !== 0) failures.push("unauthorized schedule source");
    if (dataset.schedules.some(value => !/^\d+$/.test(value.identity.rootId)) || dataset.banners.some(value => !/^\d+$/.test(value.identity.id))) failures.push("non-numeric root identity");
    const allTimes = [...dataset.schedules.map(value => value.period), ...dataset.banners.map(value => value.period)].flatMap(value => [value.startsAt, value.endsAt]).filter((value): value is ServerS1TimeValue => Boolean(value));
    if (allTimes.some(value => value.timezone.status === "unknown" && value.normalizedInstant !== undefined)) failures.push("timezone default");
    if (dataset.banners.some(value => value.currency.status !== "unknown" || value.stepsAndRates.status !== "unknown")) failures.push("commercial semantic promotion");
    const authorityBoundaryPreserved = dataset.authority.role === "community_shadow_only" && dataset.authority.officialDynamicAuthorityCount === 0 && dataset.authority.sqliteStaticAuthorityPreserved && dataset.schedules.every(value => value.staticIdentityJoin.status === "unknown");
    if (!authorityBoundaryPreserved) failures.push("authority boundary");
    if (dataset.collection.fetchedBytes !== dataset.collection.receipts.reduce((sum, value) => sum + value.sizeBytes, 0) || dataset.collection.fetchedBytes > dataset.collection.maximumAggregateBytes) failures.push("byte accounting");
    const matchesReceipt = (value: ServerHttpReceipt, kind: "summary" | "detail") => {
        try { const url = new URL(value.url); return url.protocol === "https:" && url.hostname === "dokkan.fyi" && (kind === "summary" ? url.pathname === "/summons" && url.searchParams.get("active") === "true" && /^\d+$/.test(url.searchParams.get("category") ?? "") && /^\d+$/.test(url.searchParams.get("page") ?? "") : /^\/summons\/\d+$/.test(url.pathname) && url.search === ""); } catch { return false; }
    };
    const summaryHashes = new Set(dataset.collection.receipts.filter(value => matchesReceipt(value, "summary")).map(value => value.sha256));
    const detailHashesByBannerId = new Map<string, Set<string>>();
    for (const receipt of dataset.collection.receipts.filter(value => matchesReceipt(value, "detail"))) {
        const bannerId = new URL(receipt.url).pathname.split("/").at(-1)!;
        const hashes = detailHashesByBannerId.get(bannerId) ?? new Set<string>(); hashes.add(receipt.sha256); detailHashesByBannerId.set(bannerId, hashes);
    }
    if (dataset.banners.some(value =>
        value.provenance.summaryReceiptSha256s.length === 0
        || value.provenance.summaryReceiptSha256s.some(hash => !summaryHashes.has(hash))
        || (value.provenance.detailReceiptSha256 !== undefined && !detailHashesByBannerId.get(value.identity.id)?.has(value.provenance.detailReceiptSha256))
    )) failures.push("record provenance");
    return { schemaVersion: 1, valid: failures.length === 0, exactProjection: failures.length === 0, getOnly, structuralIdentityOnly: !failures.includes("non-numeric root identity"), authorityBoundaryPreserved, failures };
}
