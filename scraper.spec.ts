import { deepEqual, equal } from "assert";
import { describe, it } from "mocha";
import { filterBaseAwakeningDuplicates, filterZAwakeningStagesFromTransformations, hasBattleTransformationCondition, isSellingOnlyLeaderSkill, parseLeaderSkillDetails } from "./scraper";

describe("parseLeaderSkillDetails", function () {
  it("parses category leaders with additional category boosts", () => {
    const details = parseLeaderSkillDetails(`"Power Beyond Super Saiyan" or "Movie Heroes" Category Ki +3 and HP, ATK & DEF +170%, plus an additional HP, ATK & DEF +30% for characters who also belong to the "Kamehameha" Category`);

    equal(details?.displayBoost, 200);
    equal(details?.clauses.length, 2);
    deepEqual(details?.clauses[0], {
      rawText: `"Power Beyond Super Saiyan" or "Movie Heroes" Category Ki +3 and HP, ATK & DEF +170%`,
      stackGroup: "primary",
      targetMode: "base",
      categories: ["Power Beyond Super Saiyan", "Movie Heroes"],
      ki: 3,
      hp: 170,
      atk: 170,
      def: 170,
      boostForm: "percentage",
    });
    deepEqual(details?.clauses[1], {
      rawText: `HP, ATK & DEF +30% for characters who also belong to the "Kamehameha" Category`,
      stackGroup: "additional",
      targetMode: "also-belong",
      categories: ["Kamehameha"],
      hp: 30,
      atk: 30,
      def: 30,
      boostForm: "percentage",
    });
  });

  it("parses mixed percentage boosts and preserves the display boost used by the app", () => {
    const details = parseLeaderSkillDetails(`"DAIMA", "Battle of Fate" or "Goku's Family" Category Ki +3, HP +200% and ATK & DEF +170%, plus an additional HP, ATK & DEF +50% for characters who also belong to the "Dragon Ball Seekers", "Full Power" or "Kamehameha" Category`);

    equal(details?.displayBoost, 230);
    equal(details?.clauses.length, 2);
    deepEqual(details?.clauses[0], {
      rawText: `"DAIMA", "Battle of Fate" or "Goku's Family" Category Ki +3, HP +200% and ATK & DEF +170%`,
      stackGroup: "primary",
      targetMode: "base",
      categories: ["DAIMA", "Battle of Fate", "Goku's Family"],
      ki: 3,
      hp: 200,
      atk: 170,
      def: 170,
      boostForm: "percentage",
    });
    deepEqual(details?.clauses[1], {
      rawText: `HP, ATK & DEF +50% for characters who also belong to the "Dragon Ball Seekers", "Full Power" or "Kamehameha" Category`,
      stackGroup: "additional",
      targetMode: "also-belong",
      categories: ["Dragon Ball Seekers", "Full Power", "Kamehameha"],
      hp: 50,
      atk: 50,
      def: 50,
      boostForm: "percentage",
    });
  });

  it("parses super class leader skills", () => {
    const details = parseLeaderSkillDetails(`Super Class Ki +3 and HP, ATK & DEF +130%`);

    equal(details?.displayBoost, 130);
    deepEqual(details?.clauses, [{
      rawText: `Super Class Ki +3 and HP, ATK & DEF +130%`,
      stackGroup: "primary",
      targetMode: "base",
      classes: ["Super"],
      ki: 3,
      hp: 130,
      atk: 130,
      def: 130,
      boostForm: "percentage",
    }]);
  });

  it("parses category or all type leaders as separate clauses", () => {
    const details = parseLeaderSkillDetails(`"Worthy Rivals" Category Ki +4 and HP, ATK & DEF +150%; or Type Ki +4 and HP, ATK & DEF +100%`);

    equal(details?.displayBoost, 150);
    equal(details?.clauses.length, 2);
    deepEqual(details?.clauses[0], {
      rawText: `"Worthy Rivals" Category Ki +4 and HP, ATK & DEF +150%`,
      stackGroup: "primary",
      targetMode: "base",
      categories: ["Worthy Rivals"],
      ki: 4,
      hp: 150,
      atk: 150,
      def: 150,
      boostForm: "percentage",
    });
    deepEqual(details?.clauses[1], {
      rawText: `Type Ki +4 and HP, ATK & DEF +100%`,
      stackGroup: "secondary",
      targetMode: "base",
      types: ["All"],
      ki: 4,
      hp: 100,
      atk: 100,
      def: 100,
      boostForm: "percentage",
    });
  });

  it("captures team-wide class and type conditions without polluting per-character targets", () => {
    const details = parseLeaderSkillDetails(`All allies' Ki +2, HP +150% and ATK & DEF +100% when team includes Super & Extreme Classes, plus an additional Ki +1 and HP, ATK & DEF +70% when team includes all five Types`);

    equal(details?.clauses.length, 2);
    deepEqual(details?.clauses[0], {
      rawText: `All allies' Ki +2, HP +150% and ATK & DEF +100% when team includes Super & Extreme Classes`,
      stackGroup: "primary",
      targetMode: "base",
      teamConditions: [{
        rawText: `when team includes Super & Extreme Classes`,
        kind: "requires-classes",
        classes: ["Super", "Extreme"],
        requiresAll: true,
        requiredCount: 2,
      }],
      ki: 2,
      hp: 150,
      atk: 100,
      def: 100,
      boostForm: "percentage",
    });
    deepEqual(details?.clauses[1], {
      rawText: `Ki +1 and HP, ATK & DEF +70% when team includes all five Types`,
      stackGroup: "additional",
      targetMode: "base",
      teamConditions: [{
        rawText: `when team includes all five Types`,
        kind: "requires-types",
        types: ["AGL", "TEQ", "INT", "STR", "PHY"],
        requiresAll: true,
        requiredCount: 5,
      }],
      ki: 1,
      hp: 70,
      atk: 70,
      def: 70,
      boostForm: "percentage",
    });
  });

  it("captures class-filtered all-five-types conditions separately from the target clause", () => {
    const details = parseLeaderSkillDetails(`Super Type allies' HP, ATK & DEF +30% when team includes all five Super Types`);

    deepEqual(details?.clauses, [{
      rawText: `Super Type allies' HP, ATK & DEF +30% when team includes all five Super Types`,
      stackGroup: "primary",
      targetMode: "base",
      types: ["All"],
      classes: ["Super"],
      teamConditions: [{
        rawText: `when team includes all five Super Types`,
        kind: "requires-types",
        types: ["AGL", "TEQ", "INT", "STR", "PHY"],
        classFilter: "Super",
        requiresAll: true,
        requiredCount: 5,
      }],
      hp: 30,
      atk: 30,
      def: 30,
      boostForm: "percentage",
    }]);
  });
});

describe("isSellingOnlyLeaderSkill", function () {
  it("flags DokkanInfo selling-only placeholder cards", () => {
    equal(isSellingOnlyLeaderSkill("A character for selling"), true);
  });

  it("does not flag normal leader skills", () => {
    equal(isSellingOnlyLeaderSkill(`Super Class Ki +3 and HP, ATK & DEF +130%`), false);
  });
});

describe("filterBaseAwakeningDuplicates", function () {
  it("keeps the original rarity stage but preserves the pre-TUR UR and later Dokkan awakenings", () => {
    const filtered = filterBaseAwakeningDuplicates([
      {
        id: 1033810,
        name: "Super Saiyan God Goku",
        rarity: 3,
        lv_max: 80,
        element: "30",
        asset_id: 1033810,
      },
      {
        id: 1033811,
        name: "Super Saiyan God Goku",
        rarity: 4,
        lv_max: 100,
        element: "30",
        asset_id: 1033810,
      },
      {
        id: 1033821,
        name: "Super Saiyan God Goku",
        rarity: 4,
        lv_max: 120,
        element: "30",
        asset_id: 1033820,
      },
    ] as any);

    deepEqual(filtered.map(card => card.id), [1033810, 1033821]);
  });

  it("keeps the original stage for lower rarities too", () => {
    const filtered = filterBaseAwakeningDuplicates([
      {
        id: 1003840,
        name: "Goku",
        rarity: 1,
        lv_max: 40,
        element: "10",
        asset_id: 1003840,
      },
      {
        id: 1003841,
        name: "Goku",
        rarity: 2,
        lv_max: 60,
        element: "10",
        asset_id: 1003840,
      },
      {
        id: 1005000,
        name: "Other Card",
        rarity: 3,
        lv_max: 80,
        element: "20",
        asset_id: 1005000,
      },
    ] as any);

    deepEqual(filtered.map(card => card.id), [1003840, 1005000]);
  });
});

describe("filterZAwakeningStagesFromTransformations", function () {
  it("removes z-awaken stages from the same awakening track", () => {
    const filtered = filterZAwakeningStagesFromTransformations(
      {
        id: 1034211,
        name: "Beerus",
        rarity: 4,
        lv_max: 100,
        element: "12",
        asset_id: 1034210,
      } as any,
      [
        {
          id: 1034210,
          name: "Beerus",
          rarity: 3,
          lv_max: 80,
          element: "02",
          asset_id: 1034210,
        },
        {
          id: 4035001,
          name: "Beerus (Rage)",
          rarity: 4,
          lv_max: 120,
          element: "12",
          asset_id: 4035000,
        },
      ] as any,
    );

    deepEqual(filtered.map(card => card.id), [4035001]);
  });
});

describe("hasBattleTransformationCondition", function () {
  it("returns false when the card has no battle transformation condition", () => {
    equal(hasBattleTransformationCondition(undefined), false);
  });

  it("returns true when the card has a real transformation condition", () => {
    equal(hasBattleTransformationCondition({
      condition_description: "Transformation: Transforms starting from the 4th turn from the start of battle",
    } as any), true);
  });
});
