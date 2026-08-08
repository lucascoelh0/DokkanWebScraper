"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = require("crypto");
const assert_1 = require("assert");
const fs_1 = require("fs");
const os_1 = require("os");
const path_1 = require("path");
const capture_h7_inputs_1 = require("./capture-h7-inputs");
const capture_h7_shadow_readiness_1 = require("./capture-h7-shadow-readiness");
const external = [
    ["database-server/s0/server-s0-manifest.json", "dokkan-server-source-catalog"], ["database-server/s1/server-s1-manifest.json", "dokkan-server-schedule-and-banners"], ["database-server/s2/server-s2-manifest.json", "dokkan-server-root-resolution"], ["database-server/s3/server-s3-manifest.json", "dokkan-server-reward-identity"], ["database-server/s4/server-s4-manifest.json", "dokkan-server-asset-delivery"], ["database-server/s5/server-s5-manifest.json", "dokkan-server-sidecar-registry"], ["database-server/s6/server-s6-manifest.json", "dokkan-server-shadow-parity"], ["database-server/s7/server-s7-manifest.json", "dokkan-server-readiness"],
    ["database-events/events-e1-manifest.json", "dokkan-events-database-first-catalog"], ["database-events/events-e2-manifest.json", "dokkan-events-database-first-topology"], ["database-events/events-e5-manifest.json", "dokkan-events-database-first-rewards"], ["database-events/events-e6-manifest.json", "dokkan-events-database-first-assets"], ["database-events/events-e7-manifest.json", "dokkan-events-database-first-shadow-parity"], ["database-events/events-e9-manifest.json", "dokkan-events-database-first-readiness"],
];
const hash = (text) => (0, crypto_1.createHash)("sha256").update(text).digest("hex");
const versions = { "dokkan-server-source-catalog": "0.1.0", "dokkan-server-schedule-and-banners": "0.2.0", "dokkan-server-root-resolution": "0.3.0", "dokkan-server-reward-identity": "0.4.0", "dokkan-server-asset-delivery": "0.5.0", "dokkan-server-sidecar-registry": "0.6.0", "dokkan-server-shadow-parity": "0.7.0", "dokkan-server-readiness": "0.8.0", "dokkan-events-database-first-catalog": "0.2.0", "dokkan-events-database-first-topology": "0.3.0", "dokkan-events-database-first-rewards": "0.6.0", "dokkan-events-database-first-assets": "0.7.0", "dokkan-events-database-first-shadow-parity": "0.8.0", "dokkan-events-database-first-readiness": "1.0.0" };
describe("capture H7 shadow readiness", () => {
    let root = "";
    afterEach(() => { if (root)
        (0, fs_1.rmSync)(root, { recursive: true, force: true }); });
    it("verifies pinned inputs and keeps every production decision fail-closed", () => {
        root = (0, fs_1.mkdtempSync)((0, path_1.join)((0, os_1.tmpdir)(), "dokkan-capture-h7-"));
        const locked = [];
        for (const [manifestPath, contract] of external) {
            const directory = (0, path_1.join)(root, (0, path_1.dirname)(manifestPath)), stem = (0, path_1.basename)(manifestPath, ".json").replace(/-manifest$/, ""), payloadName = `${stem}-payload.json`, validationName = `${stem}-validation.json`, payload = JSON.stringify({ schemaVersion: 1, contract, contractVersion: versions[contract], banners: [], families: [], e6Projection: { remoteManifestJoinedReferenceCount: 0 }, totals: {}, decisions: [], catalog: [], questStages: [], linkedEventMissions: [], missionCategoryPreviews: [], pathAssets: [], comparisons: [] }), validation = JSON.stringify({ valid: true });
            (0, fs_1.mkdirSync)(directory, { recursive: true });
            (0, fs_1.writeFileSync)((0, path_1.join)(directory, payloadName), payload);
            (0, fs_1.writeFileSync)((0, path_1.join)(directory, validationName), validation);
            const manifest = JSON.stringify({ schemaVersion: 1, contractVersion: versions[contract], fileName: payloadName, sha256: hash(payload), sizeBytes: Buffer.byteLength(payload), validation: { fileName: validationName, sha256: hash(validation), sizeBytes: Buffer.byteLength(validation) } });
            (0, fs_1.writeFileSync)((0, path_1.join)(root, manifestPath), manifest);
            const base = (0, path_1.dirname)(manifestPath).replace(/\\/g, "/");
            locked.push({ key: (0, path_1.basename)(manifestPath).match(/(?:server-|events-)([se]\d)-manifest/)?.[1] ?? "", artifactContract: contract, artifactContractVersion: versions[contract], manifestPath, manifestSizeBytes: Buffer.byteLength(manifest), manifestSha256: hash(manifest), payloadPath: `${base}/${payloadName}`, payloadSizeBytes: Buffer.byteLength(payload), payloadSha256: hash(payload), validationPath: `${base}/${validationName}`, validationSizeBytes: Buffer.byteLength(validation), validationSha256: hash(validation) });
        }
        const lock = { schemaVersion: 1, contract: "dokkan-official-capture-h7-external-source-lock", contractVersion: "1.0.0", artifacts: locked };
        const loaded = (0, capture_h7_inputs_1.loadCaptureH7ExternalInputs)(root, lock);
        (0, assert_1.equal)(loaded.lineage.length, 14);
        loaded.inputs.e6Paths = ["images/en/event/one.png"];
        const changedPayload = JSON.stringify({ schemaVersion: 1, contract: "dokkan-server-source-catalog", contractVersion: "0.1.0", changed: true }), changedValidation = JSON.stringify({ valid: true }), changedManifest = JSON.stringify({ schemaVersion: 1, contractVersion: "0.1.0", fileName: "s0-payload.json", sha256: hash(changedPayload), sizeBytes: Buffer.byteLength(changedPayload), validation: { fileName: "s0-validation.json", sha256: hash(changedValidation), sizeBytes: Buffer.byteLength(changedValidation) } });
        (0, fs_1.writeFileSync)((0, path_1.join)(root, "database-server/s0/s0-payload.json"), changedPayload);
        (0, fs_1.writeFileSync)((0, path_1.join)(root, "database-server/s0/s0-validation.json"), changedValidation);
        (0, fs_1.writeFileSync)((0, path_1.join)(root, "database-server/s0/server-s0-manifest.json"), changedManifest);
        (0, assert_1.throws)(() => (0, capture_h7_inputs_1.loadCaptureH7ExternalInputs)(root, lock), /lock mismatch/);
        const localContracts = { h0: ["dokkan-official-capture-structural-inventory", "0.1.1"], h3: ["dokkan-official-capture-schedules-availability", "0.4.0"], h4: ["dokkan-official-capture-gashas", "0.5.0"], h5: ["dokkan-official-capture-mission-boards", "0.6.0"], h6: ["dokkan-official-capture-asset-evidence", "0.7.0"] };
        const local = ["h0", "h3", "h4", "h5", "h6"].map(key => ({ key, sourceClass: "capture_sidecar", artifactPath: `data/${key}.json`, artifactContract: localContracts[key][0], artifactContractVersion: localContracts[key][1], artifactSizeBytes: 1, artifactSha256: "0".repeat(64), manifestPath: null, manifestSha256: null, validationSha256: null }));
        const h3 = { entities: [{ entityType: "event", entityId: 1, facts: [{ field: "startAt", value: 1 }, { field: "questIds", value: [10] }] }] }, h4 = { entities: [{ entityType: "gasha", entityId: 2, facts: [{ field: "featuredCardIds", value: [3] }] }] }, h5 = { entities: [{ entityType: "mission_board", entityId: 4, facts: [{ field: "completeMissionId", value: 5 }, { field: "missionCategoryId", value: 6 }, { field: "displayRewardId", value: 7 }] }] }, h6 = { observations: [{ referenceKind: "product_json_reference", assetPath: "/images/en/event/one.png" }, { referenceKind: "captured_cdn_request", assetPath: "/images/en/event/one.png" }], databaseDescriptors: [] };
        const lockSha256 = "1".repeat(64), first = (0, capture_h7_shadow_readiness_1.buildCaptureH7)("2026-08-07T20:00:00.000Z", lockSha256, loaded.inputs, [...loaded.lineage, ...local], h3, h4, h5, h6), second = (0, capture_h7_shadow_readiness_1.buildCaptureH7)("2026-08-07T20:00:00.000Z", lockSha256, loaded.inputs, [...loaded.lineage, ...local], h3, h4, h5, h6);
        (0, assert_1.equal)(JSON.stringify(first), JSON.stringify(second));
        (0, assert_1.equal)((0, capture_h7_shadow_readiness_1.validateCaptureH7)(first).valid, true);
        (0, assert_1.equal)(first.comparisons.find(value => value.key === "capture_asset_reference_vs_e6_path")?.counts.agreement, 1);
        (0, assert_1.equal)(first.comparisons.find(value => value.key === "capture_asset_reference_vs_captured_cdn")?.counts.agreement, 1);
        (0, assert_1.equal)(first.decisions.find(value => value.key === "merge_disabled_infrastructure")?.status, "GO");
        (0, assert_1.equal)(first.decisions.find(value => value.key === "future_authenticated_automation")?.status, "UNRESOLVED");
        (0, assert_1.equal)(first.decisions.filter(value => value.status === "NO_GO").length, 7);
        first.decisions.find(value => value.key === "asset_delivery").status = "GO";
        (0, assert_1.equal)((0, capture_h7_shadow_readiness_1.validateCaptureH7)(first).valid, false);
    });
});
//# sourceMappingURL=capture-h7-shadow-readiness.spec.js.map