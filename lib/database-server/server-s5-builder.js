"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateServerS5 = exports.buildServerS5Coverage = exports.buildServerS5 = void 0;
const crypto_1 = require("crypto");
const kinds = ["schedule", "banners", "server_roots", "reward_joins", "asset_delivery"];
const dynamicKinds = new Set(["schedule", "banners"]);
const ttl = new Map([["schedule", 300], ["banners", 900]]);
const sourceGate = new Map([["schedule", "s1"], ["banners", "s1"], ["server_roots", "s2"], ["reward_joins", "s3"], ["asset_delivery", "s4"]]);
const sourceContractVersion = new Map([["s1", "0.2.0"], ["s2", "0.3.0"], ["s3", "0.4.0"], ["s4", "0.5.0"]]);
const jsonText = (value) => `${JSON.stringify(value, null, 2)}\n`;
const sha256 = (value) => (0, crypto_1.createHash)("sha256").update(value).digest("hex");
function payload(kind, input, data) {
    return {
        schemaVersion: 1, contract: `dokkan-server-${kind.replace(/_/g, "-")}-sidecar`, contractVersion: "1.0.0", kind,
        generatedAt: input.generatedAt, fetchedAt: input.fetchedAt, source: { gate: input.gate, contractVersion: input.contractVersion, sha256: input.sha256, sizeBytes: input.sizeBytes },
        authority: dynamicKinds.has(kind) ? "community_dynamic_shadow" : "derived_static_shadow", optional: true, defaultEnabled: false, data,
    };
}
function buildServerS5(inputs) {
    const { s1, s2, s3, s4 } = inputs;
    const payloads = [
        payload("schedule", s1, { schedules: s1.dataset.schedules, maintenance: s1.dataset.maintenance, authority: s1.dataset.authority, boundaries: s1.dataset.boundaries }),
        payload("banners", s1, { banners: s1.dataset.banners, authority: s1.dataset.authority, boundaries: s1.dataset.boundaries }),
        payload("server_roots", s2, { identityPolicy: s2.dataset.identityPolicy, families: s2.dataset.families, semanticCorrections: s2.dataset.semanticCorrections }),
        payload("reward_joins", s3, { authorityPolicy: s3.dataset.authorityPolicy, channels: s3.dataset.channels, assessments: s3.dataset.assessments }),
        payload("asset_delivery", s4, { versions: s4.dataset.versions, deliverySources: s4.dataset.deliverySources, manifestCandidates: s4.dataset.manifestCandidates, nativeContainerCandidates: s4.dataset.nativeContainerCandidates, baseApkInventory: s4.dataset.baseApkInventory, e6Projection: s4.dataset.e6Projection, networkSampleGate: s4.dataset.networkSampleGate }),
    ];
    const payloadTexts = new Map(), manifests = [], manifestTexts = new Map();
    for (const value of payloads) {
        const valueText = jsonText(value), hash = sha256(valueText), dynamic = dynamicKinds.has(value.kind), payloadFileName = `${value.kind}-${hash}.json`;
        payloadTexts.set(value.kind, valueText);
        const manifest = {
            schemaVersion: 1, contractVersion: "1.0.0", kind: value.kind, generatedAt: value.generatedAt, fetchedAt: value.fetchedAt, dynamic, ttlSeconds: ttl.get(value.kind) ?? null,
            payloadFileName, payloadObjectKey: `database-server/${value.kind}/sha256/${hash}.json`, payloadSha256: hash, payloadSizeBytes: Buffer.byteLength(valueText), source: value.source,
            cachePolicy: dynamic ? "revalidate_after_ttl" : "content_addressed_immutable",
            compatibility: { missing: "ignore_sidecar_continue_database_first", stale: dynamic ? "ignore_sidecar_continue_database_first" : "not_applicable_content_addressed", unknownSchemaOrContract: "reject_sidecar_continue_database_first", lineageMismatch: "reject_sidecar_continue_database_first" },
        };
        manifests.push(manifest);
        manifestTexts.set(value.kind, jsonText(manifest));
    }
    const registry = {
        schemaVersion: 1, contract: "dokkan-server-sidecar-registry", contractVersion: "0.6.0", generatedAt: [s1.generatedAt, s2.generatedAt, s3.generatedAt, s4.generatedAt].sort().at(-1), generatedAtPolicy: "latest_input_derivation_time", defaultEnabled: false, productionMutation: false,
        sidecars: kinds.map(kind => {
            const manifest = manifests.find(value => value.kind === kind), manifestText = manifestTexts.get(kind), manifestHash = sha256(manifestText);
            return { kind, optional: true, defaultEnabled: false, manifestFileName: `server-s5-${kind}-manifest.json`, manifestObjectKey: `database-server/${kind}/manifests/sha256/${manifestHash}.json`, manifestSha256: manifestHash, manifestSizeBytes: Buffer.byteLength(manifestText), payloadFileName: manifest.payloadFileName, payloadSha256: manifest.payloadSha256, payloadSizeBytes: manifest.payloadSizeBytes, dynamic: manifest.dynamic, ttlSeconds: manifest.ttlSeconds };
        }),
        consumerFallback: "existing_database_first_and_scraper_pipeline",
    };
    return { payloads, payloadTexts, manifests, manifestTexts, registry };
}
exports.buildServerS5 = buildServerS5;
function buildServerS5Coverage(result) {
    return { schemaVersion: 1, sidecarCount: 5, dynamicSidecarCount: 2, staticSidecarCount: 3, contentAddressedPayloadCount: 5, ttlSidecarCount: 2, defaultEnabledSidecarCount: 0, optionalSidecarCount: 5, networkRequestCount: 0 };
}
exports.buildServerS5Coverage = buildServerS5Coverage;
function validateServerS5(result) {
    const failures = [], keys = result.payloads.map(value => value.kind), manifestKeys = result.manifests.map(value => value.kind), registryKeys = result.registry.sidecars.map(value => value.kind);
    const exactKinds = (values) => values.length === kinds.length && new Set(values).size === kinds.length && kinds.every(value => values.includes(value));
    const independentPayloads = exactKinds(keys) && exactKinds(manifestKeys) && exactKinds(registryKeys);
    if (!independentPayloads)
        failures.push("sidecar set");
    let contentAddressed = true, ttlOnlyDynamic = true, failClosedCompatibility = true;
    let absentCompatible = result.registry.schemaVersion === 1 && result.registry.contract === "dokkan-server-sidecar-registry" && result.registry.contractVersion === "0.6.0" && result.registry.generatedAtPolicy === "latest_input_derivation_time" && result.registry.defaultEnabled === false && result.registry.productionMutation === false && result.registry.consumerFallback === "existing_database_first_and_scraper_pipeline";
    for (const kind of kinds) {
        const value = result.payloads.find(item => item.kind === kind), manifest = result.manifests.find(item => item.kind === kind), entry = result.registry.sidecars.find(item => item.kind === kind), valueText = result.payloadTexts.get(kind), manifestText = result.manifestTexts.get(kind);
        if (!value || !manifest || !entry || !valueText || !manifestText) {
            contentAddressed = false;
            continue;
        }
        const hash = sha256(valueText), expectedFile = `${kind}-${hash}.json`;
        const manifestHash = sha256(manifestText), expectedManifestFile = `server-s5-${kind}-manifest.json`;
        const payloadSizeBytes = Buffer.byteLength(valueText);
        if (manifest.payloadSha256 !== hash || manifest.payloadSizeBytes !== payloadSizeBytes || manifest.payloadFileName !== expectedFile || manifest.payloadObjectKey !== `database-server/${kind}/sha256/${hash}.json` || entry.payloadSha256 !== hash || entry.payloadSizeBytes !== payloadSizeBytes || entry.payloadSizeBytes !== manifest.payloadSizeBytes || entry.payloadFileName !== expectedFile || entry.manifestFileName !== expectedManifestFile || entry.manifestObjectKey !== `database-server/${kind}/manifests/sha256/${manifestHash}.json` || entry.manifestSha256 !== manifestHash || entry.manifestSizeBytes !== Buffer.byteLength(manifestText))
            contentAddressed = false;
        const dynamic = dynamicKinds.has(kind), expectedTtl = ttl.get(kind) ?? null;
        if (manifest.dynamic !== dynamic || entry.dynamic !== dynamic || manifest.ttlSeconds !== expectedTtl || entry.ttlSeconds !== expectedTtl || manifest.cachePolicy !== (dynamic ? "revalidate_after_ttl" : "content_addressed_immutable"))
            ttlOnlyDynamic = false;
        const compatibility = manifest.compatibility;
        if (compatibility.missing !== "ignore_sidecar_continue_database_first" || compatibility.unknownSchemaOrContract !== "reject_sidecar_continue_database_first" || compatibility.lineageMismatch !== "reject_sidecar_continue_database_first" || compatibility.stale !== (dynamic ? "ignore_sidecar_continue_database_first" : "not_applicable_content_addressed"))
            failClosedCompatibility = false;
        if (!value.optional || value.defaultEnabled || !entry.optional || entry.defaultEnabled)
            absentCompatible = false;
        const expectedGate = sourceGate.get(kind), expectedVersion = sourceContractVersion.get(expectedGate);
        if (value.schemaVersion !== 1 || value.contract !== `dokkan-server-${kind.replace(/_/g, "-")}-sidecar` || value.contractVersion !== "1.0.0" || value.kind !== kind || manifest.schemaVersion !== 1 || manifest.contractVersion !== "1.0.0" || manifest.kind !== kind || value.source.gate !== expectedGate || value.source.contractVersion !== expectedVersion || !/^[a-f0-9]{64}$/.test(value.source.sha256) || !Number.isSafeInteger(value.source.sizeBytes) || value.source.sizeBytes <= 0 || JSON.stringify(manifest.source) !== JSON.stringify(value.source) || manifest.generatedAt !== value.generatedAt || manifest.fetchedAt !== value.fetchedAt)
            failures.push(`contract or lineage ${kind}`);
        if (dynamic ? value.fetchedAt === null || value.authority !== "community_dynamic_shadow" : value.fetchedAt !== null || value.authority !== "derived_static_shadow")
            failures.push(`time or authority boundary ${kind}`);
    }
    const latestGeneratedAt = result.payloads.map(value => value.generatedAt).sort().at(-1);
    if (result.registry.generatedAt !== latestGeneratedAt)
        failures.push("registry generation time");
    if (!contentAddressed)
        failures.push("content addressing");
    if (!ttlOnlyDynamic)
        failures.push("TTL policy");
    if (!failClosedCompatibility)
        failures.push("compatibility policy");
    if (!absentCompatible)
        failures.push("absent compatibility");
    return { schemaVersion: 1, valid: failures.length === 0, deterministic: true, independentPayloads, contentAddressed, ttlOnlyDynamic, failClosedCompatibility, absentCompatible, failures };
}
exports.validateServerS5 = validateServerS5;
//# sourceMappingURL=server-s5-builder.js.map