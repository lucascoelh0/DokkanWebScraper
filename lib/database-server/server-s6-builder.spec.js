"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const server_s6_builder_1 = require("./server-s6-builder");
const source = (key, index) => ({ key, path: `${key}.json`, contractVersion: null, sha256: index.toString(16).repeat(64), sizeBytes: 10, authority: key === "fyi_summons_implementation" ? "repository_implementation" : "existing_community_cache", generatedAt: "2026-08-01T00:00:00.000Z" });
const gate = (name, dataset) => ({ gate: name, contractVersion: `0.${Number(name[1]) + 1}.0`, path: `data/database-server/${name}/payload.json`, sha256: name[1].repeat(64), sizeBytes: 20, generatedAt: `2026-08-0${name[1]}T00:00:00.000Z`, dataset });
function inputs() {
    const s1 = gate("s1", { authority: { role: "community_shadow_only", officialDynamicAuthorityCount: 0 }, schedules: [], banners: [{ identity: { id: "10" }, featuredCharacters: { entries: [{ ordinal: 0, payloadCharacterId: "100" }, { ordinal: 1, payloadCharacterId: "200" }] } }] });
    const family = (key, sets, joins) => ({ key, identitySets: sets, joins });
    const s2 = gate("s2", { identityPolicy: { structuralIdsOnly: true, titleJoinAllowed: false }, families: [family("super_battle_road", [{ key: "sbr_shadow_challenge_roots", ids: ["710"] }, { key: "sbr_shadow_stage_roots", ids: Array.from({ length: 176 }, (_, index) => String(7100000 + index)) }], []), family("ultimate_clash", [{ key: "rmbattle_mission_refs", ids: ["1", "2"] }], []), family("world_tournament", [{ key: "budokai_database_roots", ids: ["1"] }], []), family("burst_mode", [], [{ key: "genkai_score_root_join", unmatchedCount: 3 }]), family("pettan_battle", [{ key: "pettan_shadow_series", ids: ["1", "2"] }], [])] });
    const s3 = gate("s3", { authorityPolicy: { legacyRewardIdentityOrigin: "unknown_payload_id_or_synthetic_index", normalizedRowsLossless: false }, assessments: [{ classification: "partial_candidate" }, { classification: "unjoinable" }] });
    const s4 = gate("s4", { e6Projection: { remoteManifestJoinedReferenceCount: 0, unresolvedDeliveryReferenceCount: 4, status: "unknown" } });
    const s5 = gate("s5", { defaultEnabled: false, productionMutation: false });
    const cache = { existingBannerIds: ["9", "10"], characterIds: ["100"], generatedAt: "2026-08-01T00:00:00.000Z", sourceLineage: [source("fyi_summons_implementation", 10), source("summons_index_cache", 11), source("summons_details_cache", 12), source("characters_manifest", 13), source("characters_payload", 14)] };
    return { s1, s2, s3, s4, s5, cache };
}
describe("server S6 shadow parity", () => {
    it("builds deterministic exclusive parity classifications", () => { const first = (0, server_s6_builder_1.buildServerS6)(inputs()), second = (0, server_s6_builder_1.buildServerS6)(inputs()); (0, assert_1.deepEqual)(first, second); (0, assert_1.equal)((0, server_s6_builder_1.validateServerS6)(first).valid, true); });
    it("treats current-only banners as gain and old-only active banners as unknown", () => { const dataset = (0, server_s6_builder_1.buildServerS6)(inputs()), subject = dataset.subjects.find(value => value.key === "active_banner_cache_delta"); (0, assert_1.deepEqual)(subject.identities.agreement, ["10"]); (0, assert_1.deepEqual)(subject.identities.unknown, ["9"]); (0, assert_1.equal)(subject.counts.confirmedConflict, 0); });
    it("separates card identity from official featured relationship", () => { const dataset = (0, server_s6_builder_1.buildServerS6)(inputs()), cards = dataset.subjects.find(value => value.key === "featured_character_identity"), relations = dataset.subjects.find(value => value.key === "official_featured_relationship"); (0, assert_1.equal)(cards.counts.agreement, 1); (0, assert_1.equal)(cards.counts.representationGain, 1); (0, assert_1.equal)(relations.counts.unknown, 2); (0, assert_1.equal)(relations.counts.agreement, 0); });
    it("maps reward partial candidates to unknown, not agreement or conflict", () => { const subject = (0, server_s6_builder_1.buildServerS6)(inputs()).subjects.find(value => value.key === "reward_row_identity"); (0, assert_1.equal)(subject.counts.unknown, 1); (0, assert_1.equal)(subject.counts.unjoinable, 1); (0, assert_1.equal)(subject.counts.confirmedConflict, 0); });
    it("rejects double-classified identities and false completeness", () => { const dataset = (0, server_s6_builder_1.buildServerS6)(inputs()), subject = dataset.subjects[0]; subject.identities.confirmed_conflict = [subject.identities.agreement[0]]; subject.counts.confirmedConflict = 1; subject.comparedCount++; dataset.completeness.proven = true; const validation = (0, server_s6_builder_1.validateServerS6)(dataset); (0, assert_1.equal)(validation.valid, false); (0, assert_1.equal)(validation.exclusiveClassifications, false); (0, assert_1.equal)(validation.zeroConflictNotCompleteness, false); });
    it("fails before parity when an upstream authority boundary is promoted", () => { const value = inputs(); value.s5.dataset.defaultEnabled = true; (0, assert_1.throws)(() => (0, server_s6_builder_1.buildServerS6)(value), /S6 S5 activation boundary/); });
    it("rejects an unknown upstream lineage contract", () => { const dataset = (0, server_s6_builder_1.buildServerS6)(inputs()); dataset.sourceLineage.find(value => value.key === "server_s3").contractVersion = "9.0.0"; const validation = (0, server_s6_builder_1.validateServerS6)(dataset); (0, assert_1.equal)(validation.valid, false); (0, assert_1.equal)(validation.sourceLineageComplete, false); });
    it("rejects reward or featured-relation promotion while preserving accounting", () => {
        const dataset = (0, server_s6_builder_1.buildServerS6)(inputs()), reward = dataset.subjects.find(value => value.key === "reward_row_identity"), featured = dataset.subjects.find(value => value.key === "official_featured_relationship");
        reward.counts.unknown--;
        reward.counts.agreement++;
        featured.counts.unknown--;
        featured.counts.representationGain++;
        dataset.totals.unknown -= 2;
        dataset.totals.agreement++;
        dataset.totals.representationGain++;
        featured.identities.unknown = featured.identities.unknown.slice(1);
        featured.identities.representation_gain = ["10:0:100"];
        const validation = (0, server_s6_builder_1.validateServerS6)(dataset);
        (0, assert_1.equal)(validation.exactAccounting, true);
        (0, assert_1.equal)(validation.classificationPolicyPreserved, false);
        (0, assert_1.equal)(validation.valid, false);
    });
});
//# sourceMappingURL=server-s6-builder.spec.js.map