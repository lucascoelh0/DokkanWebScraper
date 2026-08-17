import * as assert from "assert";
import { createHash } from "crypto";
import { readFileSync } from "fs";
import { resolve } from "path";
import { buildWtSensitiveCatalog, scanWtAuditTargets } from "./wt-campaign-scanner";
import { Wt6Dataset, Wt6MemoryEvidence } from "./wt6-contract";
import { buildWt6, validateWt6 } from "./wt6-readiness";

function dataset(): Wt6Dataset {
    const fixture = JSON.parse(readFileSync(resolve(process.cwd(), "database-world-tournament-captures/fixtures/wt6-readiness-input.json"), "utf8")), names: Record<string, string[]> = { WT0:["wt0-inventory.json","wt0-manifest.json","wt0-validation.json"],WT1:["wt1-manifest.json","wt1-route-catalog.json","wt1-validation.json"],WT2:["wt2-event-entry-ranks.json","wt2-manifest.json","wt2-validation.json"],WT3:["wt3-manifest.json","wt3-rankings-box-schedules.json","wt3-validation.json"],WT4:["wt4-briefing-missions-start.json","wt4-manifest.json","wt4-validation.json"],WT5:["wt5-manifest.json","wt5-shadow-parity.json","wt5-validation.json"] }, lineage: Wt6Dataset["lineage"] = [];
    for (const gate of Object.keys(names)) for (const fileName of names[gate]) lineage.push({ gate: gate as any, fileName, sizeBytes: 1, sha256: "a".repeat(64) });
    const aggregate = createHash("sha256").update(lineage.map(value => `${value.gate}/${value.fileName}\0${value.sizeBytes}\0${value.sha256}\n`).join("")).digest("hex");
    fixture.memory.sourceSha256 = fixture.source.sha256; fixture.memory.artifactAggregateSha256 = aggregate; return buildWt6(fixture.source, lineage, aggregate, fixture.memory.implementationAggregateSha256, fixture.security, fixture.memory as Wt6MemoryEvidence);
}
describe("world tournament WT6", () => {
    it("validates fail-closed readiness", () => assert.equal(validateWt6(dataset()).valid, true));
    it("rejects replay or production promotion", () => { const value = dataset(); value.decisions.find(item => item.key === "request_replay")!.status = "GO"; value.decisions.find(item => item.key === "production")!.status = "GO"; assert.equal(validateWt6(value).valid, false); });
    it("rejects sign decoding or source replacement", () => { const value = dataset(); value.decisions.find(item => item.key === "sign_decode_or_reproduction")!.status = "GO"; value.decisions.find(item => item.key === "replace_current_sources")!.status = "GO"; assert.equal(validateWt6(value).valid, false); });
    it("rejects a peak at the one-GiB boundary", () => { const value = dataset(); value.memory.measurements[6].peakProcessTreeWorkingSetBytes = value.memory.limitBytes; value.memory.observedMaxPeakBytes = value.memory.limitBytes; assert.equal(validateWt6(value).valid, false); });
    it("rejects false determinism and a false execution-integration claim", () => { const value = dataset(); value.determinism.upstreamAggregateSha256 = "b".repeat(64); value.stop.executionIntegrationPerformed = true as false; assert.equal(validateWt6(value).valid, false); });
    it("permits only reviewed offline default-off integration", () => { const value = dataset(); const decision = value.decisions.find(item => item.key === "reviewed_offline_default_off_integration")!; assert.equal(decision.status, "GO"); value.decisions.find(item => item.key === "production")!.status = "GO"; assert.equal(validateWt6(value).valid, false); });
    it("rejects memory evidence from another implementation/source lineage", () => { const value = dataset(); value.memory.artifactAggregateSha256 = "b".repeat(64); value.memory.implementationAggregateSha256 = "c".repeat(64); assert.equal(validateWt6(value).valid, false); });
    it("rejects an additional-HAR requirement for the current campaign", () => { const value = dataset(); value.futureRefresh.currentCampaignNeedsAdditionalHar = true as false; assert.equal(validateWt6(value).valid, false); });
    it("rejects historical HAR identities outside the closed allowlist", () => { const value = dataset(); value.security.historicalHarTargetFingerprints[0] = "f".repeat(64); assert.equal(validateWt6(value).valid, false); });
    it("rejects prohibited, unresolved, or inconsistent classified matches", () => { const value = dataset(); value.security.matchClassCounts.unresolved = 1; value.security.unresolvedMatchCount = 1 as 0; assert.equal(validateWt6(value).valid, false); });
    it("rejects mutated first-party APK provenance", () => { const value = dataset(); value.security.firstPartyAppIdentityEvidence.tool.command = "mutated" as "aapt dump badging <pinned-apk>"; assert.equal(validateWt6(value).valid, false); });
    it("rejects well-formed but unpinned tool or identity hashes", () => { const value = dataset(); value.security.firstPartyAppIdentityEvidence.tool.executableSha256 = "c".repeat(64) as any; value.security.firstPartyAppIdentityEvidence.identity.sha256 = "d".repeat(64) as any; assert.equal(validateWt6(value).valid, false); });
    it("detects a captured value without retaining it", () => { const har = JSON.stringify({log:{entries:[{request:{method:"POST",url:"https://example.invalid/budokais/9007190000000007/tournaments",headers:[],postData:{text:JSON.stringify({sign:"synthetic-private-sign"})}},response:{status:200,headers:[],content:{text:JSON.stringify({sign:"synthetic-private-response"})}}}]}}), catalog = buildWtSensitiveCatalog(har), clean = scanWtAuditTargets(catalog, [{targetId:"clean",category:"fixture",content:Buffer.from("{\"signSemantics\":\"unknown\"}")}]), leaked = scanWtAuditTargets(catalog, [{targetId:"leak",category:"fixture",content:Buffer.from(JSON.stringify({sign:"synthetic-private-sign"}))}]); assert.equal(clean.valid, true); assert.equal(leaked.valid, false); assert.equal(leaked.sensitiveMatchCount > 0, true); assert.equal(JSON.stringify(leaked).includes("synthetic-private-sign"), false); });
});
