"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const server_s2_builder_1 = require("./server-s2-builder");
function observation() {
    return {
        sourceSnapshotVersion: "global-6.4.0-v338-2026-08-05",
        sourceLineage: [
            { key: "events_e1", path: "e1", sha256: "a".repeat(64), sizeBytes: 1, authority: "sqlite_first_party" },
            { key: "events_e2", path: "e2", sha256: "b".repeat(64), sizeBytes: 1, authority: "sqlite_first_party" },
            { key: "events_e7", path: "e7", sha256: "c".repeat(64), sizeBytes: 1, authority: "community_shadow" },
            { key: "dokkaninfo_family_cache", path: "cache", sha256: "d".repeat(64), sizeBytes: 1, authority: "community_shadow" },
        ],
        areaIds: ["710", "720"],
        budokaiIds: ["1", "2"],
        rmbattleCandidateIds: ["1", "2", "3"],
        questLevelsByArea: { "710": ["7100015"], "720": ["7200015"] },
        sdMapIds: ["1", "2", "3"],
        sdbattleRootIds: ["1", "2"],
        challengeRoots: [
            { id: "710", type: "challenge", stageIds: ["7100015"], presentationName: "Super Battle Road" },
            { id: "720", type: "challenge", stageIds: ["7200015"], presentationName: "Extreme Super Battle Road" },
        ],
        e7Families: [
            { family: "challenge", eventCount: 2, joinedRootCount: 2, joinedStageCount: 2, rootTarget: "area", rootClassification: "agreement" },
            { family: "sdbattle", eventCount: 2, joinedRootCount: 0, joinedStageCount: 0, rootTarget: null, rootClassification: "unjoinable" },
        ],
        unrootedTables: [{ table: "genkai_gimmick_sub_categories", rowCount: 22 }, { table: "score_benefits", rowCount: 706 }, { table: "special_bonuses", rowCount: 19 }],
    };
}
describe("server S2 root resolution", () => {
    it("is deterministic and validates structural joins", () => {
        const first = (0, server_s2_builder_1.buildServerS2Dataset)(observation()), second = (0, server_s2_builder_1.buildServerS2Dataset)(observation());
        (0, assert_1.deepEqual)(first, second);
        (0, assert_1.equal)((0, server_s2_builder_1.validateServerS2Dataset)(first).valid, true);
    });
    it("resolves SBR through area and quest-level IDs", () => {
        const dataset = (0, server_s2_builder_1.buildServerS2Dataset)(observation()), sbr = dataset.families.find(value => value.key === "super_battle_road");
        (0, assert_1.equal)(sbr.resolution, "already_database_rooted");
        (0, assert_1.equal)(sbr.joins.every(value => value.status === "supported"), true);
        (0, assert_1.equal)((0, server_s2_builder_1.buildServerS2Coverage)(dataset).structurallyMatchedIdentityCount, 4);
    });
    it("does not equate Pettan series IDs with sd_map IDs", () => {
        const pettan = (0, server_s2_builder_1.buildServerS2Dataset)(observation()).families.find(value => value.key === "pettan_battle");
        (0, assert_1.equal)(pettan.joins[0].joinKey, null);
        (0, assert_1.equal)(pettan.joins[0].status, "unjoinable");
        (0, assert_1.equal)(pettan.joins[0].matchedCount, 0);
    });
    it("keeps Ultimate Clash and Burst Mode unresolved without roots or FKs", () => {
        const families = (0, server_s2_builder_1.buildServerS2Dataset)(observation()).families;
        (0, assert_1.equal)(families.find(value => value.key === "ultimate_clash").rootStatus, "partial");
        (0, assert_1.equal)(families.find(value => value.key === "burst_mode").rootStatus, "unknown");
    });
    it("rejects title joins and numeric namespace promotion", () => {
        const dataset = (0, server_s2_builder_1.buildServerS2Dataset)(observation());
        dataset.families[0].joins[0].joinKey = "event.title == area.title";
        dataset.families.find(value => value.key === "pettan_battle").joins[0].joinKey = "series.id == sd_map.id";
        const validation = (0, server_s2_builder_1.validateServerS2Dataset)(dataset);
        (0, assert_1.equal)(validation.valid, false);
        (0, assert_1.equal)(validation.failures.some(value => value.includes("text join")), true);
        (0, assert_1.equal)(validation.failures.some(value => value.includes("Pettan namespace isolation")), true);
    });
    it("rejects community identity promotion and malformed source lineage", () => {
        const dataset = (0, server_s2_builder_1.buildServerS2Dataset)(observation());
        dataset.families.find(value => value.key === "pettan_battle").identitySets.find(value => value.key === "pettan_shadow_series").authority = "sqlite_first_party";
        dataset.sourceLineage[0].sha256 = "not-a-hash";
        const validation = (0, server_s2_builder_1.validateServerS2Dataset)(dataset);
        (0, assert_1.equal)(validation.valid, false);
        (0, assert_1.equal)(validation.sqliteAuthorityPreserved, false);
        (0, assert_1.equal)(validation.failures.includes("invalid source lineage"), true);
    });
    it("requires every upstream lineage key exactly once", () => {
        const dataset = (0, server_s2_builder_1.buildServerS2Dataset)(observation());
        dataset.sourceLineage[1] = { ...dataset.sourceLineage[0] };
        const validation = (0, server_s2_builder_1.validateServerS2Dataset)(dataset);
        (0, assert_1.equal)(validation.valid, false);
        (0, assert_1.equal)(validation.failures.includes("invalid source lineage"), true);
    });
});
//# sourceMappingURL=server-s2-builder.spec.js.map