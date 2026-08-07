"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateServerS0Catalog = exports.buildServerS0Coverage = exports.buildServerS0Catalog = void 0;
function officialEndpoint(key, pathPattern, domains, boundary, sourceLiteral = pathPattern) {
    return {
        key,
        hostKey: "official-global-api",
        pathPattern,
        observedMethod: "UNKNOWN",
        format: "unknown",
        sourceClass: "official_client",
        status: "partial",
        domains,
        collectionGate: "discover_only",
        evidence: [{ evidenceId: "global-elf-6.4.0-v338", locator: `native_string_literal:${sourceLiteral}`, observation: sourceLiteral === pathPattern ? `Exact client path string ${sourceLiteral}` : `Exact client path string ${sourceLiteral}, normalized as ${pathPattern}` }],
        boundary,
    };
}
function buildServerS0Catalog() {
    const endpoints = [
        officialEndpoint("official-client-assets-database", "client_assets/database", ["versions", "asset_delivery"], "Static path and version headers are proven; method, response schema, authentication and current reachability are not."),
        officialEndpoint("official-client-assets-version", "client_assets/new_version_exists", ["versions"], "Static path only; do not probe until a credential-free GET contract is established."),
        officialEndpoint("official-events-ids", "events/ids", ["schedule", "availability", "server_roots"], "Candidate structural event identity surface; response shape and current semantics are unknown."),
        officialEndpoint("official-event-buttons", "events/listbutton_images", ["schedule", "banners", "asset_delivery"], "Candidate presentation/delivery surface; it must not override SQLite identity."),
        officialEndpoint("official-event-keys", "events/eventkagi_events", ["availability", "server_roots"], "Candidate availability surface; authorization and server-time semantics are unknown."),
        officialEndpoint("official-gasha-featured", "gashas/{gasha_id}/featured_cards", ["banners"], "Numeric gasha and card IDs are promising, but method and payload are not yet observed.", "gashas/{0}/featured_cards"),
        officialEndpoint("official-gasha-rates", "gashas/{gasha_id}/rates", ["banners"], "Potential read endpoint; rates are out of authority until response identity and semantics are captured.", "gashas/{0}/rates"),
        officialEndpoint("official-rmbattle-root", "rmbattles/{rmbattle_id}", ["server_roots", "schedule", "availability", "rewards"], "Candidate missing RMBattle root keyed by numeric ID.", "rmbattles/{0}"),
        officialEndpoint("official-rmbattle-cards", "rmbattles/available_user_cards", ["server_roots"], "Likely account-dependent runtime state; never collect with a personal session."),
        officialEndpoint("official-budokai-rankings", "budokais/{budokai_id}/rankings", ["server_roots", "schedule", "rewards"], "Candidate read surface, but rankings may contain user-derived data and need minimization.", "budokais/{0}/rankings"),
        officialEndpoint("official-budokai-borders", "budokais/{budokai_id}/rankings/borders", ["server_roots", "schedule", "rewards"], "Candidate aggregate read surface; schema and authentication are unknown.", "budokais/{0}/rankings/borders"),
        officialEndpoint("official-mission-categories", "missions/categories", ["schedule", "availability", "rewards"], "Candidate mission/reward join surface; structural reward IDs must be preserved."),
        {
            key: "official-known-mutations",
            hostKey: "official-global-api",
            pathPattern: "{gashas/*/draw|budokais/*/entry|budokais/*/rankings/accept|budokais/*/tournaments/*/{start,finish,giveup}|missions/{accept,finish,put_forward}|rmbattles/*/stages/{start,finish,dropout}}",
            observedMethod: "UNKNOWN",
            format: "unknown",
            sourceClass: "official_client",
            status: "supported",
            domains: [],
            collectionGate: "prohibited",
            evidence: [{ evidenceId: "global-elf-6.4.0-v338", locator: "native_string_literals:gashas,budokais,missions,rmbattles action paths", observation: "Exact action-shaped client path strings grouped without claiming a common HTTP method." }],
            boundary: "Action-shaped client paths are categorically outside the read-only campaign even if a transport method were later observed as GET.",
        },
        {
            key: "fyi-active-summons",
            hostKey: "dokkan-fyi",
            pathPattern: "summons?active=true&category={category_id}&page={page}",
            observedMethod: "GET",
            format: "html_with_embedded_json",
            sourceClass: "community_structured",
            status: "partial",
            domains: ["schedule", "banners"],
            collectionGate: "eligible_get_probe",
            evidence: [{ evidenceId: "repository-fyi-summons", locator: "DokkanFyiSummonClient.fetchSummonSummaryPage", observation: "fetch GET plus application/json page-payload extraction" }],
            boundary: "Structured embedded payload is suitable for shadow evidence, never official server authority.",
        },
        {
            key: "fyi-summon-detail",
            hostKey: "dokkan-fyi",
            pathPattern: "summons/{summon_id}",
            observedMethod: "GET",
            format: "html_with_embedded_json",
            sourceClass: "community_structured",
            status: "partial",
            domains: ["schedule", "banners"],
            collectionGate: "eligible_get_probe",
            evidence: [{ evidenceId: "repository-fyi-summons", locator: "DokkanFyiSummonClient.fetchSummonDetailUncached", observation: "fetch GET plus application/json page-payload extraction" }],
            boundary: "Carries numeric featured character IDs; category/currency meaning still needs a contract.",
        },
        {
            key: "dokkaninfo-events",
            hostKey: "dokkaninfo",
            pathPattern: "events/{type}[/{event_id}[/{stage_id}]]",
            observedMethod: "GET",
            format: "html",
            sourceClass: "community_html",
            status: "partial",
            domains: ["schedule", "banners", "rewards", "server_roots"],
            collectionGate: "reference_only",
            evidence: [{ evidenceId: "repository-dokkaninfo-events", locator: "collectEventSummaries,fetchAndMapEvent,mapEventRewards", observation: "HTML GETs with Vue attribute parsing and derived reward keys" }],
            boundary: "HTML and Vue attributes are parity evidence only; event reward row keys are not first-party identity.",
        },
        {
            key: "fyi-cdn-assets",
            hostKey: "dokkan-fyi-cdn",
            pathPattern: "assets/{locale}/{database_path_or_typed_asset_path}",
            observedMethod: "GET",
            format: "binary",
            sourceClass: "community_cdn",
            status: "partial",
            domains: ["asset_delivery"],
            collectionGate: "reference_only",
            evidence: [{ evidenceId: "repository-fyi-summons", locator: "portraitUrl", observation: "Deterministic cdn.dokkan.fyi binary URL builder" }],
            boundary: "A community mirror path does not prove official container, hash, version or completeness.",
        },
    ];
    return {
        schemaVersion: 1,
        contract: "dokkan-server-source-catalog",
        contractVersion: "0.1.0",
        generatedAt: "2026-08-07T00:00:00.000Z",
        generatedAtPolicy: "pinned_to_static_evidence_checkpoint",
        baselineCommit: "d28b3f2f006a6544ff7979c107ff220f899c2088",
        sourceSnapshotVersion: "global-6.4.0-v338-2026-08-05",
        collectionMode: "static_inventory_no_network_capture",
        authorityPolicy: {
            staticIdentity: "sqlite_first_party",
            dynamicState: "official_server_only_when_structurally_proven",
            communitySources: "shadow_and_gap_evidence_only",
            textIdentityAllowed: false,
            absentFieldsDefaulted: false,
        },
        evidence: [
            { id: "global-apk-6.4.0-v338", kind: "apk", path: "D:/Dokkan/database/apk/dokkan-global-base.apk", sha256: "a51ba758e0555e0a756aa4f20278e6bec25ba6b0c7dcdcd0f4372e0fad159bc0", sizeBytes: 98799013, status: "supported", containsSensitiveValues: false, note: "Pinned official Global base APK; ZIP inventory only in S0." },
            { id: "global-elf-6.4.0-v338", kind: "native_elf", path: "D:/Dokkan/database/apk/extracted/lib/arm64-v8a/libcocos2dcpp.so", sha256: "7d6c2c1e095fc20a71ec4764e88a17b4d4b82f3f12952b9ba8c6eb0405a7215a", sizeBytes: 95662296, status: "supported", containsSensitiveValues: false, note: "Static strings only; no runtime interception or native semantic promotion." },
            { id: "repository-fyi-summons", kind: "repository_file", path: "fyi-summons.ts", sha256: "bbc9840adcb76473e47dfa0f0eb43544b25abd398479721c4e0f15c1c6929509", sizeBytes: 15988, status: "supported", containsSensitiveValues: false, note: "Existing GET paths and embedded structured payload parser." },
            { id: "repository-dokkaninfo-events", kind: "repository_file", path: "dokkaninfo-event-rewards.ts", sha256: "eb7639892990aa1255f7592b924bbb10eebfb04aaf43fbb6b8e0b7d0da97aed2", sizeBytes: 18166, status: "supported", containsSensitiveValues: false, note: "Existing HTML/Vue event and reward scraper." },
            { id: "repository-db-download", kind: "repository_file", path: "game-db/game-db-download-database-artifact.ts", sha256: "d86db7494915e45f137216251dc2b06b709f8ab42a407171e756de877e622840", sizeBytes: 9059, status: "supported", containsSensitiveValues: false, note: "Existing bounded binary database download helper; it does not authenticate to the game API." },
            { id: "historical-emulator-network", kind: "historical_observation", path: "docs/game-db/game-db-first-party-acquisition-playbook.md", sha256: "3778d8816f272c8071ab8827ebb1d723adc6d115868d0900edfa03994a0e8ccc", sizeBytes: 13914, status: "partial", containsSensitiveValues: false, note: "Observed host and failed TLS interception are architecture evidence, not a current request contract." },
            { id: "ignored-local-caches", kind: "local_cache", path: "data/** and game-db/data/**", sha256: null, sizeBytes: null, status: "partial", containsSensitiveValues: true, note: "Inspected only for shape and lineage; raw contents remain ignored and are never committed." },
        ],
        hosts: [
            { key: "official-global-api", host: "ishin-global.aktsk.com", sourceClass: "official_client", relationship: "embedded_in_official_client", status: "supported", authority: "candidate_dynamic_authority" },
            { key: "dokkan-fyi", host: "dokkan.fyi", sourceClass: "community_structured", relationship: "used_by_repository", status: "supported", authority: "shadow_only" },
            { key: "dokkan-fyi-cdn", host: "cdn.dokkan.fyi", sourceClass: "community_cdn", relationship: "used_by_repository", status: "supported", authority: "delivery_mirror_only" },
            { key: "dokkaninfo", host: "dokkaninfo.com", sourceClass: "community_html", relationship: "used_by_repository", status: "supported", authority: "shadow_only" },
            { key: "dokkanpanion-assets", host: "assets.dkbcompanion.com", sourceClass: "project_delivery", relationship: "project_owned", status: "supported", authority: "project_sidecar_delivery_only" },
        ],
        endpoints,
        headers: [
            ...["Authorization", "X-APIToken"].map(name => ({ name, classification: "secret", logPolicy: "redact_value", evidenceId: "global-elf-6.4.0-v338", evidenceLocator: `native_string_literal:${name}:`, requiredStatus: "unknown" })),
            ...["X-UserID", "X-UserCountry", "X-UserCurrency"].map(name => ({ name, classification: "pseudonymous", logPolicy: "redact_value", evidenceId: "global-elf-6.4.0-v338", evidenceLocator: `native_string_literal:${name}:`, requiredStatus: "unknown" })),
            ...["X-AssetVersion", "X-DatabaseVersion", "X-ClientVersion", "X-RequestVersion"].map(name => ({ name, classification: "version", logPolicy: "allow_value", evidenceId: "global-elf-6.4.0-v338", evidenceLocator: `native_string_literal:${name}:`, requiredStatus: "unknown" })),
            { name: "X-Language", classification: "locale", logPolicy: "allow_value", evidenceId: "global-elf-6.4.0-v338", evidenceLocator: "native_string_literal:X-Language:", requiredStatus: "unknown" },
            { name: "X-Platform", classification: "transport", logPolicy: "allow_value", evidenceId: "global-elf-6.4.0-v338", evidenceLocator: "native_string_literal:X-Platform:", requiredStatus: "unknown" },
        ],
        boundaries: [
            { key: "official_authentication", status: "unknown", stopCondition: "Any required login, account token, device identifier, attestation, request signature or personal-session traffic stops that endpoint family." },
            { key: "certificate_pinning", status: "unknown", stopCondition: "No pinning bypass, Frida unpinning or TLS interception is permitted." },
            { key: "official_methods_and_schemas", status: "unknown", stopCondition: "Static strings do not authorize a request; only credential-free GET evidence may promote a path to collection." },
            { key: "community_authority", status: "partial", stopCondition: "Community structured data remains shadow evidence and cannot overwrite database-first facts." },
            { key: "asset_volume", status: "unknown", stopCondition: "Stop before any batch whose projected transfer is unavailable or would bring the investigation above 500 MB." },
        ],
    };
}
exports.buildServerS0Catalog = buildServerS0Catalog;
function buildServerS0Coverage(dataset) {
    const gates = ["discover_only", "eligible_get_probe", "prohibited", "reference_only"];
    return {
        schemaVersion: 1,
        evidenceCount: dataset.evidence.length,
        hostCount: dataset.hosts.length,
        endpointCount: dataset.endpoints.length,
        endpointCountsByGate: Object.fromEntries(gates.map(gate => [gate, dataset.endpoints.filter(endpoint => endpoint.collectionGate === gate).length])),
        officialEndpointCount: dataset.endpoints.filter(endpoint => endpoint.sourceClass === "official_client").length,
        sensitiveHeaderCount: dataset.headers.filter(header => header.classification === "secret" || header.classification === "pseudonymous").length,
        dynamicOfficialAuthorityCount: 0,
        networkRequestCount: 0,
    };
}
exports.buildServerS0Coverage = buildServerS0Coverage;
function validateServerS0Catalog(dataset) {
    const failures = [];
    const unique = (values) => new Set(values).size === values.length;
    if (dataset.schemaVersion !== 1 || dataset.contract !== "dokkan-server-source-catalog" || dataset.contractVersion !== "0.1.0")
        failures.push("contract identity");
    if (dataset.collectionMode !== "static_inventory_no_network_capture")
        failures.push("network capture enabled");
    if (!unique(dataset.evidence.map(value => value.id)) || !unique(dataset.hosts.map(value => value.key)) || !unique(dataset.endpoints.map(value => value.key)))
        failures.push("duplicate structural key");
    const hostKeys = new Set(dataset.hosts.map(value => value.key)), evidenceIds = new Set(dataset.evidence.map(value => value.id));
    const mutationSegments = new Set(["draw", "entry", "accept", "start", "finish", "giveup", "dropout", "put_forward"]);
    const isActionShaped = (pathPattern) => pathPattern.toLowerCase().split(/[^a-z_]+/).some(segment => mutationSegments.has(segment));
    for (const endpoint of dataset.endpoints) {
        if (!hostKeys.has(endpoint.hostKey))
            failures.push(`unknown host ${endpoint.key}`);
        if (endpoint.evidence.length === 0 || endpoint.evidence.some(claim => !evidenceIds.has(claim.evidenceId) || !claim.locator.trim() || !claim.observation.trim()))
            failures.push(`invalid evidence claim ${endpoint.key}`);
        if (/^https?:\/\//i.test(endpoint.pathPattern))
            failures.push(`non-relative endpoint ${endpoint.key}`);
        if (endpoint.sourceClass === "official_client" && endpoint.collectionGate === "eligible_get_probe")
            failures.push(`premature official probe ${endpoint.key}`);
        if (endpoint.collectionGate === "eligible_get_probe" && endpoint.observedMethod !== "GET")
            failures.push(`non-GET eligible endpoint ${endpoint.key}`);
        if (isActionShaped(endpoint.pathPattern) && endpoint.collectionGate !== "prohibited")
            failures.push(`action-shaped endpoint not prohibited ${endpoint.key}`);
    }
    for (const header of dataset.headers)
        if (!evidenceIds.has(header.evidenceId) || !header.evidenceLocator.trim())
            failures.push(`invalid header evidence ${header.name}`);
    const sensitiveHeadersRedacted = dataset.headers.filter(value => value.classification === "secret" || value.classification === "pseudonymous").every(value => value.logPolicy === "redact_value");
    if (!sensitiveHeadersRedacted)
        failures.push("sensitive header logging");
    const mutableEndpointsProhibited = dataset.endpoints.some(value => value.key === "official-known-mutations" && value.collectionGate === "prohibited")
        && dataset.endpoints.filter(value => isActionShaped(value.pathPattern)).every(value => value.collectionGate === "prohibited");
    if (!mutableEndpointsProhibited)
        failures.push("mutable endpoints not prohibited");
    return { schemaVersion: 1, valid: failures.length === 0, deterministic: true, staticOnly: dataset.collectionMode === "static_inventory_no_network_capture", sensitiveHeadersRedacted, mutableEndpointsProhibited, failures };
}
exports.validateServerS0Catalog = validateServerS0Catalog;
//# sourceMappingURL=server-s0-builder.js.map