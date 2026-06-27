import { deepEqual, equal } from "assert";
import { describe, it } from "mocha";
import {
  buildSupportMemoryDataset,
  enhancementChainFromFyi,
  mapSupportMemoryFromFyi,
  supportMemoryEffectsFromFyi,
} from "./fyi-support-memories";

describe("enhancementChainFromFyi", function () {
  it("maps the enhancement chain steps from the root support memory payload", () => {
    const chain = enhancementChainFromFyi([
      {
        id: 31,
        level: 2,
        support_memory_id: 10002,
        enhanced_support_memory_id: 100022,
        root_support_memory_id: 10002,
      },
      {
        id: 32,
        level: 3,
        support_memory_id: 100022,
        enhanced_support_memory_id: 100023,
        root_support_memory_id: 10002,
      },
    ] as any);

    deepEqual(chain, [
      {
        id: "31",
        level: 2,
        supportMemoryId: "10002",
        enhancedSupportMemoryId: "100022",
        rootSupportMemoryId: "10002",
      },
      {
        id: "32",
        level: 3,
        supportMemoryId: "100022",
        enhancedSupportMemoryId: "100023",
        rootSupportMemoryId: "10002",
      },
    ]);
  });
});

describe("supportMemoryEffectsFromFyi", function () {
  it("maps structured support-memory skill effects for future matching logic", () => {
    const effects = supportMemoryEffectsFromFyi([
      {
        id: 100061,
        type: 3,
        values: [8, 8, 0],
        target: 2,
        calculation: 2,
        turns: 2,
        chance: 100,
        transformation: {
          description: null,
        },
        script_name: null,
      },
      {
        id: 100062,
        type: 90,
        values: [8, 0, 0],
        target: 2,
        calculation: 2,
        turns: 2,
        chance: 100,
        transformation: {
          description: null,
        },
        script_name: null,
      },
    ] as any);

    deepEqual(effects, [
      {
        id: "100061",
        effectType: 3,
        values: [8, 8, 0],
        target: 2,
        calculation: 2,
        turns: 2,
        chance: 100,
        transformationDescription: "",
        scriptName: "",
      },
      {
        id: "100062",
        effectType: 90,
        values: [8, 0, 0],
        target: 2,
        calculation: 2,
        turns: 2,
        chance: 100,
        transformationDescription: "",
        scriptName: "",
      },
    ]);
  });
});

describe("mapSupportMemoryFromFyi", function () {
  it("maps a support memory into the app-facing auxiliary dataset contract", () => {
    const memory = mapSupportMemoryFromFyi({
      id: 10002,
      name: "Goku Gets Married!",
      description: "\"Goku's Family\" Category allies' \nATK & DEF +10% in battle",
      support_film_id: 1,
      support_film: {
        id: 1,
        name: "Film (Red)",
        description: "Required to use \"Support Memory (Red)\".",
      },
      cost: 200,
      lasts_entire_battle: true,
      unlock_quantity: 10,
      released_at: "2020-01-01T00:00:00.000000Z",
      root_enhancement_levels: [
        {
          id: 31,
          level: 2,
          support_memory_id: 10002,
          enhanced_support_memory_id: 100022,
          root_support_memory_id: 10002,
        },
        {
          id: 32,
          level: 3,
          support_memory_id: 100022,
          enhanced_support_memory_id: 100023,
          root_support_memory_id: 10002,
        },
      ],
      support_memory_skills: [
        {
          id: 100021,
          support_memory_id: 10002,
          type: 3,
          values: [10, 10, 0],
          target: 2,
          calculation: 2,
          turns: -1,
          chance: 100,
          transformation: {
            description: null,
          },
          script_name: null,
        },
      ],
    } as any);

    equal(memory.id, "10002");
    equal(memory.name, "Goku Gets Married!");
    equal(memory.description, "\"Goku's Family\" Category allies'\nATK & DEF +10% in battle");
    equal(memory.filmId, "1");
    equal(memory.film?.name, "Film (Red)");
    equal(memory.cost, 200);
    equal(memory.unlockQuantity, 10);
    equal(memory.lastsEntireBattle, true);
    equal(memory.releaseDate, "2020-01-01T00:00:00.000Z");
    equal(memory.maxLevel, 3);
    equal(memory.enhancementChain.length, 2);
    equal(memory.effects.length, 1);
    equal(memory.effects[0].turns, -1);
  });
});

describe("buildSupportMemoryDataset", function () {
  it("collects unique films and dataset metadata around the mapped memories", () => {
    const dataset = buildSupportMemoryDataset([
      {
        id: "10002",
        name: "Goku Gets Married!",
        description: "",
        filmId: "1",
        film: {
          id: "1",
          name: "Film (Red)",
        },
        maxLevel: 3,
        enhancementChain: [],
        effects: [],
      },
      {
        id: "10003",
        name: "Training Complete!",
        description: "",
        filmId: "1",
        film: {
          id: "1",
          name: "Film (Red)",
        },
        maxLevel: 2,
        enhancementChain: [],
        effects: [],
      },
    ] as any);

    equal(dataset.source, "dokkan.fyi");
    equal(dataset.count, 2);
    equal(dataset.films.length, 1);
    equal(dataset.films[0].id, "1");
  });
});
