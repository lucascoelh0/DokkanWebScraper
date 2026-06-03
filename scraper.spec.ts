import { deepEqual, equal } from "assert";
import { describe, it } from "mocha";
import { isSellingOnlyLeaderSkill, parseLeaderSkillDetails } from "./scraper";

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
});

describe("isSellingOnlyLeaderSkill", function () {
  it("flags DokkanInfo selling-only placeholder cards", () => {
    equal(isSellingOnlyLeaderSkill("A character for selling"), true);
  });

  it("does not flag normal leader skills", () => {
    equal(isSellingOnlyLeaderSkill(`Super Class Ki +3 and HP, ATK & DEF +130%`), false);
  });
});
