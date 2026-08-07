import { deepEqual, equal } from "assert";
import { buildServerS2Coverage, buildServerS2Dataset, validateServerS2Dataset } from "./server-s2-builder";
import { ServerS2Observation } from "./server-s2-contract";

function observation(): ServerS2Observation {
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
        const first = buildServerS2Dataset(observation()), second = buildServerS2Dataset(observation());
        deepEqual(first, second);
        equal(validateServerS2Dataset(first).valid, true);
    });

    it("resolves SBR through area and quest-level IDs", () => {
        const dataset = buildServerS2Dataset(observation()), sbr = dataset.families.find(value => value.key === "super_battle_road")!;
        equal(sbr.resolution, "already_database_rooted");
        equal(sbr.joins.every(value => value.status === "supported"), true);
        equal(buildServerS2Coverage(dataset).structurallyMatchedIdentityCount, 4);
    });

    it("does not equate Pettan series IDs with sd_map IDs", () => {
        const pettan = buildServerS2Dataset(observation()).families.find(value => value.key === "pettan_battle")!;
        equal(pettan.joins[0].joinKey, null);
        equal(pettan.joins[0].status, "unjoinable");
        equal(pettan.joins[0].matchedCount, 0);
    });

    it("keeps Ultimate Clash and Burst Mode unresolved without roots or FKs", () => {
        const families = buildServerS2Dataset(observation()).families;
        equal(families.find(value => value.key === "ultimate_clash")!.rootStatus, "partial");
        equal(families.find(value => value.key === "burst_mode")!.rootStatus, "unknown");
    });

    it("rejects title joins and numeric namespace promotion", () => {
        const dataset = buildServerS2Dataset(observation());
        dataset.families[0].joins[0].joinKey = "event.title == area.title";
        dataset.families.find(value => value.key === "pettan_battle")!.joins[0].joinKey = "series.id == sd_map.id";
        const validation = validateServerS2Dataset(dataset);
        equal(validation.valid, false);
        equal(validation.failures.some(value => value.includes("text join")), true);
        equal(validation.failures.some(value => value.includes("Pettan namespace isolation")), true);
    });

    it("rejects community identity promotion and malformed source lineage", () => {
        const dataset = buildServerS2Dataset(observation());
        dataset.families.find(value => value.key === "pettan_battle")!.identitySets.find(value => value.key === "pettan_shadow_series")!.authority = "sqlite_first_party";
        dataset.sourceLineage[0].sha256 = "not-a-hash";
        const validation = validateServerS2Dataset(dataset);
        equal(validation.valid, false);
        equal(validation.sqliteAuthorityPreserved, false);
        equal(validation.failures.includes("invalid source lineage"), true);
    });

    it("requires every upstream lineage key exactly once", () => {
        const dataset = buildServerS2Dataset(observation());
        dataset.sourceLineage[1] = { ...dataset.sourceLineage[0] };
        const validation = validateServerS2Dataset(dataset);
        equal(validation.valid, false);
        equal(validation.failures.includes("invalid source lineage"), true);
    });
});
