import { createHash } from "crypto";
import { equal, throws } from "assert";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { basename, dirname, join } from "path";
import { loadCaptureH7ExternalInputs } from "./capture-h7-inputs";
import { buildCaptureH7, validateCaptureH7 } from "./capture-h7-shadow-readiness";
import { CaptureH7SourceLock } from "./capture-h7-inputs";

const external = [
    ["database-server/s0/server-s0-manifest.json", "dokkan-server-source-catalog"], ["database-server/s1/server-s1-manifest.json", "dokkan-server-schedule-and-banners"], ["database-server/s2/server-s2-manifest.json", "dokkan-server-root-resolution"], ["database-server/s3/server-s3-manifest.json", "dokkan-server-reward-identity"], ["database-server/s4/server-s4-manifest.json", "dokkan-server-asset-delivery"], ["database-server/s5/server-s5-manifest.json", "dokkan-server-sidecar-registry"], ["database-server/s6/server-s6-manifest.json", "dokkan-server-shadow-parity"], ["database-server/s7/server-s7-manifest.json", "dokkan-server-readiness"],
    ["database-events/events-e1-manifest.json", "dokkan-events-database-first-catalog"], ["database-events/events-e2-manifest.json", "dokkan-events-database-first-topology"], ["database-events/events-e5-manifest.json", "dokkan-events-database-first-rewards"], ["database-events/events-e6-manifest.json", "dokkan-events-database-first-assets"], ["database-events/events-e7-manifest.json", "dokkan-events-database-first-shadow-parity"], ["database-events/events-e9-manifest.json", "dokkan-events-database-first-readiness"],
] as Array<[string, string]>;
const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const versions: Record<string, string> = { "dokkan-server-source-catalog": "0.1.0", "dokkan-server-schedule-and-banners": "0.2.0", "dokkan-server-root-resolution": "0.3.0", "dokkan-server-reward-identity": "0.4.0", "dokkan-server-asset-delivery": "0.5.0", "dokkan-server-sidecar-registry": "0.6.0", "dokkan-server-shadow-parity": "0.7.0", "dokkan-server-readiness": "0.8.0", "dokkan-events-database-first-catalog": "0.2.0", "dokkan-events-database-first-topology": "0.3.0", "dokkan-events-database-first-rewards": "0.6.0", "dokkan-events-database-first-assets": "0.7.0", "dokkan-events-database-first-shadow-parity": "0.8.0", "dokkan-events-database-first-readiness": "1.0.0" };

describe("capture H7 shadow readiness", () => {
    let root = "";
    afterEach(() => { if (root) rmSync(root, { recursive: true, force: true }); });
    it("verifies pinned inputs and keeps every production decision fail-closed", () => {
        root = mkdtempSync(join(tmpdir(), "dokkan-capture-h7-"));
        const locked: CaptureH7SourceLock["artifacts"] = [];
        for (const [manifestPath, contract] of external) {
            const directory = join(root, dirname(manifestPath)), stem = basename(manifestPath, ".json").replace(/-manifest$/, ""), payloadName = `${stem}-payload.json`, validationName = `${stem}-validation.json`, payload = JSON.stringify({ schemaVersion: 1, contract, contractVersion: versions[contract], banners: [], families: [], e6Projection: { remoteManifestJoinedReferenceCount: 0 }, totals: {}, decisions: [], catalog: [], questStages: [], linkedEventMissions: [], missionCategoryPreviews: [], pathAssets: [], comparisons: [] }), validation = JSON.stringify({ valid: true });
            mkdirSync(directory, { recursive: true }); writeFileSync(join(directory, payloadName), payload); writeFileSync(join(directory, validationName), validation);
            const manifest = JSON.stringify({ schemaVersion: 1, contractVersion: versions[contract], fileName: payloadName, sha256: hash(payload), sizeBytes: Buffer.byteLength(payload), validation: { fileName: validationName, sha256: hash(validation), sizeBytes: Buffer.byteLength(validation) } });
            writeFileSync(join(root, manifestPath), manifest);
            const base = dirname(manifestPath).replace(/\\/g, "/");
            locked.push({ key: basename(manifestPath).match(/(?:server-|events-)([se]\d)-manifest/)?.[1] ?? "", artifactContract: contract, artifactContractVersion: versions[contract], manifestPath, manifestSizeBytes: Buffer.byteLength(manifest), manifestSha256: hash(manifest), payloadPath: `${base}/${payloadName}`, payloadSizeBytes: Buffer.byteLength(payload), payloadSha256: hash(payload), validationPath: `${base}/${validationName}`, validationSizeBytes: Buffer.byteLength(validation), validationSha256: hash(validation) });
        }
        const lock: CaptureH7SourceLock = { schemaVersion: 1, contract: "dokkan-official-capture-h7-external-source-lock", contractVersion: "1.0.0", artifacts: locked };
        const loaded = loadCaptureH7ExternalInputs(root, lock); equal(loaded.lineage.length, 14); loaded.inputs.e6Paths = ["images/en/event/one.png"];
        const changedPayload = JSON.stringify({ schemaVersion: 1, contract: "dokkan-server-source-catalog", contractVersion: "0.1.0", changed: true }), changedValidation = JSON.stringify({ valid: true }), changedManifest = JSON.stringify({ schemaVersion: 1, contractVersion: "0.1.0", fileName: "s0-payload.json", sha256: hash(changedPayload), sizeBytes: Buffer.byteLength(changedPayload), validation: { fileName: "s0-validation.json", sha256: hash(changedValidation), sizeBytes: Buffer.byteLength(changedValidation) } });
        writeFileSync(join(root, "database-server/s0/s0-payload.json"), changedPayload); writeFileSync(join(root, "database-server/s0/s0-validation.json"), changedValidation); writeFileSync(join(root, "database-server/s0/server-s0-manifest.json"), changedManifest);
        throws(() => loadCaptureH7ExternalInputs(root, lock), /lock mismatch/);
        const localContracts: Record<string, [string, string]> = { h0: ["dokkan-official-capture-structural-inventory", "0.1.1"], h3: ["dokkan-official-capture-schedules-availability", "0.4.0"], h4: ["dokkan-official-capture-gashas", "0.5.0"], h5: ["dokkan-official-capture-mission-boards", "0.6.0"], h6: ["dokkan-official-capture-asset-evidence", "0.7.0"] };
        const local = ["h0", "h3", "h4", "h5", "h6"].map(key => ({ key, sourceClass: "capture_sidecar" as const, artifactPath: `data/${key}.json`, artifactContract: localContracts[key][0], artifactContractVersion: localContracts[key][1], artifactSizeBytes: 1, artifactSha256: "0".repeat(64), manifestPath: null, manifestSha256: null, validationSha256: null }));
        const h3: any = { entities: [{ entityType: "event", entityId: 1, facts: [{ field: "startAt", value: 1 }, { field: "questIds", value: [10] }] }] }, h4: any = { entities: [{ entityType: "gasha", entityId: 2, facts: [{ field: "featuredCardIds", value: [3] }] }] }, h5: any = { entities: [{ entityType: "mission_board", entityId: 4, facts: [{ field: "completeMissionId", value: 5 }, { field: "missionCategoryId", value: 6 }, { field: "displayRewardId", value: 7 }] }] }, h6: any = { observations: [{ referenceKind: "product_json_reference", assetPath: "/images/en/event/one.png" }, { referenceKind: "captured_cdn_request", assetPath: "/images/en/event/one.png" }], databaseDescriptors: [] };
        const lockSha256 = "1".repeat(64), first = buildCaptureH7("2026-08-07T20:00:00.000Z", lockSha256, loaded.inputs, [...loaded.lineage, ...local], h3, h4, h5, h6), second = buildCaptureH7("2026-08-07T20:00:00.000Z", lockSha256, loaded.inputs, [...loaded.lineage, ...local], h3, h4, h5, h6);
        equal(JSON.stringify(first), JSON.stringify(second)); equal(validateCaptureH7(first).valid, true);
        equal(first.comparisons.find(value => value.key === "capture_asset_reference_vs_e6_path")?.counts.agreement, 1);
        equal(first.comparisons.find(value => value.key === "capture_asset_reference_vs_captured_cdn")?.counts.agreement, 1);
        equal(first.decisions.find(value => value.key === "merge_disabled_infrastructure")?.status, "GO");
        equal(first.decisions.find(value => value.key === "future_authenticated_automation")?.status, "UNRESOLVED");
        equal(first.decisions.filter(value => value.status === "NO_GO").length, 7);
        first.decisions.find(value => value.key === "asset_delivery")!.status = "GO";
        equal(validateCaptureH7(first).valid, false);
    });
});
