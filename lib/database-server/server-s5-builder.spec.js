"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const server_s5_builder_1 = require("./server-s5-builder");
const gate = (name, dataset, fetchedAt = null) => ({ gate: name, contractVersion: `0.${Number(name[1]) + 1}.0`, sha256: name[1].repeat(64), sizeBytes: 10, generatedAt: fetchedAt ?? "2026-08-07T00:00:00.000Z", fetchedAt, dataset });
function result() { return (0, server_s5_builder_1.buildServerS5)({ s1: gate("s1", { schedules: [], maintenance: { status: "unknown" }, banners: [{ id: 1 }], authority: {}, boundaries: [] }, "2026-08-07T01:00:00.000Z"), s2: gate("s2", { identityPolicy: {}, families: [], semanticCorrections: [] }), s3: gate("s3", { authorityPolicy: {}, channels: [], assessments: [] }), s4: gate("s4", { versions: [], deliverySources: [], manifestCandidates: [], nativeContainerCandidates: [], baseApkInventory: {}, e6Projection: {}, networkSampleGate: {} }) }); }
describe("server S5 sidecar registry", () => {
    it("builds five independent deterministic content-addressed sidecars", () => {
        const first = result(), second = result();
        (0, assert_1.deepEqual)(first, second);
        (0, assert_1.equal)((0, server_s5_builder_1.validateServerS5)(first).valid, true);
        (0, assert_1.equal)((0, server_s5_builder_1.buildServerS5Coverage)(first).sidecarCount, 5);
        (0, assert_1.equal)(new Set(first.manifests.map(value => value.payloadFileName)).size, 5);
    });
    it("assigns TTL only to schedule and banners", () => {
        const value = result(), byKind = new Map(value.manifests.map(item => [item.kind, item]));
        (0, assert_1.equal)(byKind.get("schedule")?.ttlSeconds, 300);
        (0, assert_1.equal)(byKind.get("banners")?.ttlSeconds, 900);
        (0, assert_1.equal)(byKind.get("server_roots")?.ttlSeconds, null);
        (0, assert_1.equal)(byKind.get("reward_joins")?.cachePolicy, "content_addressed_immutable");
    });
    it("keeps every sidecar disabled, optional and fail-closed", () => {
        const value = result();
        (0, assert_1.equal)(value.registry.defaultEnabled, false);
        (0, assert_1.equal)(value.registry.sidecars.every(item => item.optional && !item.defaultEnabled), true);
        (0, assert_1.equal)(value.manifests.every(item => item.compatibility.unknownSchemaOrContract === "reject_sidecar_continue_database_first"), true);
    });
    it("rejects static TTL, payload hash drift and activation", () => {
        const value = result(), root = value.manifests.find(item => item.kind === "server_roots");
        root.ttlSeconds = 60;
        value.registry.sidecars.find(item => item.kind === "schedule").payloadSha256 = "f".repeat(64);
        value.registry.defaultEnabled = true;
        const validation = (0, server_s5_builder_1.validateServerS5)(value);
        (0, assert_1.equal)(validation.valid, false);
        (0, assert_1.equal)(validation.ttlOnlyDynamic, false);
        (0, assert_1.equal)(validation.contentAddressed, false);
        (0, assert_1.equal)(validation.absentCompatible, false);
    });
    it("rejects missing kinds and permissive unknown-schema behavior", () => {
        const value = result();
        value.payloads.pop();
        value.manifests[0].compatibility.unknownSchemaOrContract = "reject_sidecar_continue_database_first";
        value.manifests[0].compatibility.lineageMismatch = "accept";
        const validation = (0, server_s5_builder_1.validateServerS5)(value);
        (0, assert_1.equal)(validation.independentPayloads, false);
        (0, assert_1.equal)(validation.failClosedCompatibility, false);
    });
    it("rejects source-gate substitution and non-content-addressed manifests", () => {
        const value = result();
        value.payloads.find(item => item.kind === "asset_delivery").source.gate = "s1";
        value.registry.sidecars.find(item => item.kind === "banners").manifestObjectKey = "database-server/banners/current.json";
        const validation = (0, server_s5_builder_1.validateServerS5)(value);
        (0, assert_1.equal)(validation.valid, false);
        (0, assert_1.equal)(validation.contentAddressed, false);
        (0, assert_1.equal)(validation.failures.includes("contract or lineage asset_delivery"), true);
    });
    it("rejects registry payload-size drift", () => {
        const value = result();
        value.registry.sidecars.find(item => item.kind === "schedule").payloadSizeBytes += 1;
        const validation = (0, server_s5_builder_1.validateServerS5)(value);
        (0, assert_1.equal)(validation.valid, false);
        (0, assert_1.equal)(validation.contentAddressed, false);
    });
});
//# sourceMappingURL=server-s5-builder.spec.js.map