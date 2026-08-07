import { deepEqual, equal } from "assert";
import { buildServerS5, buildServerS5Coverage, validateServerS5 } from "./server-s5-builder";
import { ServerS5InputGate } from "./server-s5-contract";

const gate = (name: "s1" | "s2" | "s3" | "s4", dataset: any, fetchedAt: string | null = null): ServerS5InputGate => ({ gate: name, contractVersion: `0.${Number(name[1]) + 1}.0`, sha256: name[1].repeat(64), sizeBytes: 10, generatedAt: fetchedAt ?? "2026-08-07T00:00:00.000Z", fetchedAt, dataset });
function result() { return buildServerS5({ s1: gate("s1", { schedules: [], maintenance: { status: "unknown" }, banners: [{ id: 1 }], authority: {}, boundaries: [] }, "2026-08-07T01:00:00.000Z"), s2: gate("s2", { identityPolicy: {}, families: [], semanticCorrections: [] }), s3: gate("s3", { authorityPolicy: {}, channels: [], assessments: [] }), s4: gate("s4", { versions: [], deliverySources: [], manifestCandidates: [], nativeContainerCandidates: [], baseApkInventory: {}, e6Projection: {}, networkSampleGate: {} }) }); }

describe("server S5 sidecar registry", () => {
    it("builds five independent deterministic content-addressed sidecars", () => {
        const first = result(), second = result(); deepEqual(first, second);
        equal(validateServerS5(first).valid, true); equal(buildServerS5Coverage(first).sidecarCount, 5);
        equal(new Set(first.manifests.map(value => value.payloadFileName)).size, 5);
    });
    it("assigns TTL only to schedule and banners", () => {
        const value = result(), byKind = new Map(value.manifests.map(item => [item.kind, item]));
        equal(byKind.get("schedule")?.ttlSeconds, 300); equal(byKind.get("banners")?.ttlSeconds, 900);
        equal(byKind.get("server_roots")?.ttlSeconds, null); equal(byKind.get("reward_joins")?.cachePolicy, "content_addressed_immutable");
    });
    it("keeps every sidecar disabled, optional and fail-closed", () => {
        const value = result(); equal(value.registry.defaultEnabled, false); equal(value.registry.sidecars.every(item => item.optional && !item.defaultEnabled), true);
        equal(value.manifests.every(item => item.compatibility.unknownSchemaOrContract === "reject_sidecar_continue_database_first"), true);
    });
    it("rejects static TTL, payload hash drift and activation", () => {
        const value = result(), root = value.manifests.find(item => item.kind === "server_roots")!;
        root.ttlSeconds = 60; value.registry.sidecars.find(item => item.kind === "schedule")!.payloadSha256 = "f".repeat(64); (value.registry as any).defaultEnabled = true;
        const validation = validateServerS5(value); equal(validation.valid, false); equal(validation.ttlOnlyDynamic, false); equal(validation.contentAddressed, false); equal(validation.absentCompatible, false);
    });
    it("rejects missing kinds and permissive unknown-schema behavior", () => {
        const value = result(); value.payloads.pop(); value.manifests[0].compatibility.unknownSchemaOrContract = "reject_sidecar_continue_database_first"; (value.manifests[0].compatibility as any).lineageMismatch = "accept";
        const validation = validateServerS5(value); equal(validation.independentPayloads, false); equal(validation.failClosedCompatibility, false);
    });
    it("rejects source-gate substitution and non-content-addressed manifests", () => {
        const value = result(); value.payloads.find(item => item.kind === "asset_delivery")!.source.gate = "s1";
        value.registry.sidecars.find(item => item.kind === "banners")!.manifestObjectKey = "database-server/banners/current.json";
        const validation = validateServerS5(value); equal(validation.valid, false); equal(validation.contentAddressed, false); equal(validation.failures.includes("contract or lineage asset_delivery"), true);
    });
    it("rejects registry payload-size drift", () => {
        const value = result(); value.registry.sidecars.find(item => item.kind === "schedule")!.payloadSizeBytes += 1;
        const validation = validateServerS5(value); equal(validation.valid, false); equal(validation.contentAddressed, false);
    });
});
