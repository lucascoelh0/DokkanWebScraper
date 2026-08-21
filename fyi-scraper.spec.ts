import { deepEqual, equal } from "assert";
import { describe, it } from "mocha";
import {
  buildDokkanFyiContractReferenceSample,
  currentMaxStat,
  exclusiveSkillOrbsFromFyi,
  finishSkillsFromFyi,
  mapDokkanFyiCharacter,
  normalizeTransformationSource,
  obtainabilityDetailsFromFyi,
  passiveDetailsFromSkill,
  preferredSuperAttacks,
  reversibleExchangeDetailsFromFyi,
  selectAwakenedState,
  selectCurrentState,
  selectInitialState,
  standbyDetailsFromFyi,
} from "./fyi-scraper";

describe("passiveDetailsFromSkill enemy-status evidence", function () {
  it("keeps display text unchanged while preserving ordered structural status markers", () => {
    const description = "*When the target enemy is in the following status: {passiveImg:atk_down} or {passiveImg:astute}*\n- ATK 20%{passiveImg:up_g}";
    const details = passiveDetailsFromSkill({
      id: 4112,
      name: "Structural passive",
      description,
      effects: [{ id: 4112, type: 90, target: 1 }],
    } as any, {
      characterId: "1012001",
      formId: "1012001",
      releaseState: "eza",
      sourceVersion: "9b8400b8f2f713f705f9ee5b2c56470d",
      payloadField: "props.character.extreme_z_awakening.passive_skill.description",
    });

    equal(details?.text, "When the target enemy is in the following status:  or\n- ATK 20%");
    deepEqual(details?.conditionEvidence?.[0].statuses, [
      { order: 0, sourceToken: "atk_down", status: "atk_down", resolution: "supported" },
      { order: 1, sourceToken: "astute", status: "super_attack_sealed", resolution: "supported" },
    ]);
    equal(details?.conditionEvidence?.[0].connector, "or");
    equal(details?.conditionEvidence?.[0].resolution, "supported");
    equal(details?.conditionEvidence?.[0].anchor.lineIndex, 0);
    equal(details?.conditionEvidence?.[0].provenance.source, "dokkan_fyi_payload");
    equal(details?.conditionEvidence?.[0].passiveTextSha256.length, 64);
    equal(details?.text?.includes("passiveImg"), false);
  });

  it("marks missing labels unresolved instead of fabricating a status", () => {
    const details = passiveDetailsFromSkill({
      description: "*When the target enemy is in the following status:*\n- ATK 20%",
    } as any, {
      characterId: "1",
      formId: "1",
      releaseState: "initial",
      sourceVersion: "fixture-v1",
      payloadField: "props.character.passive_skill.description",
    });

    deepEqual(details?.conditionEvidence?.[0].statuses, []);
    equal(details?.conditionEvidence?.[0].resolution, "unresolved");
  });
});

describe("selectCurrentState", function () {
  it("prefers extreme z awakening fields when the latest state is awakened", () => {
    const currentState = selectCurrentState({
      max_level: 120,
      max_super_attack_level: 20,
      leader_skill: { name: "Base leader", description: "Base leader description" },
      passive_skill: { name: "Base passive", description: "Base passive description" },
      super_attacks: [
        {
          name: "Burst Rush",
          description: "Base 12 Ki effect",
          ki: 12,
          level: 0,
          super_attack_type: "Physical",
        },
        {
          name: "Burst Rush",
          description: "EZA 12 Ki effect",
          ki: 12,
          level: 1,
          super_attack_type: "Physical",
        },
      ],
      release_dates: { latest_type: "eza" },
      extreme_z_awakening: {
        max_level: 140,
        max_super_attack_level: 25,
        leader_skill: { name: "EZA leader", description: "EZA leader description" },
        passive_skill: { name: "EZA passive", description: "EZA passive description" },
      },
    } as any);

    equal(currentState.latestType, "eza");
    equal(currentState.maxLevel, 140);
    equal(currentState.maxSuperAttackLevel, 25);
    equal(currentState.leaderSkill?.name, "EZA leader");
    equal(currentState.passiveSkill?.name, "EZA passive");
    equal(currentState.currentSuperAttacks[0]?.description, "EZA 12 Ki effect");
  });

  it("keeps base fields when the latest state is initial", () => {
    const currentState = selectCurrentState({
      max_level: 120,
      max_super_attack_level: 20,
      leader_skill: { name: "Base leader", description: "Base leader description" },
      passive_skill: { name: "Base passive", description: "Base passive description" },
      super_attacks: [
        {
          name: "Burst Rush",
          description: "Base 12 Ki effect",
          ki: 12,
          level: 0,
          super_attack_type: "Physical",
        },
        {
          name: "Burst Rush",
          description: "EZA 12 Ki effect",
          ki: 12,
          level: 1,
          super_attack_type: "Physical",
        },
      ],
      release_dates: { latest_type: "initial" },
      extreme_z_awakening: {
        max_level: 140,
        max_super_attack_level: 25,
        leader_skill: { name: "EZA leader", description: "EZA leader description" },
        passive_skill: { name: "EZA passive", description: "EZA passive description" },
      },
    } as any);

    equal(currentState.latestType, "initial");
    equal(currentState.maxLevel, 120);
    equal(currentState.maxSuperAttackLevel, 20);
    equal(currentState.leaderSkill?.name, "Base leader");
    equal(currentState.passiveSkill?.name, "Base passive");
    equal(currentState.currentSuperAttacks[0]?.description, "Base 12 Ki effect");
  });
});

describe("selectInitialState", function () {
  it("preserves the base combat fields when an awakened state is available", () => {
    const initialState = selectInitialState({
      max_level: 120,
      max_super_attack_level: 10,
      leader_skill: { name: "Base leader", description: "Base leader description" },
      passive_skill: { name: "Base passive", description: "Base passive description" },
      super_attacks: [
        { id: 1, name: "Attack", description: "Base effect", ki: 12, level: 0 },
        { id: 2, name: "Attack (Extreme)", description: "EZA effect", ki: 12, level: 1 },
      ],
      release_dates: { latest_type: "eza" },
      extreme_z_awakening: {
        max_level: 140,
        max_super_attack_level: 15,
        leader_skill: { name: "EZA leader", description: "EZA leader description" },
        passive_skill: { name: "EZA passive", description: "EZA passive description" },
      },
    } as any);

    equal(initialState.latestType, "initial");
    equal(initialState.maxLevel, 120);
    equal(initialState.maxSuperAttackLevel, 10);
    equal(initialState.leaderSkill?.name, "Base leader");
    equal(initialState.passiveSkill?.name, "Base passive");
    equal(initialState.currentSuperAttacks[0]?.description, "Base effect");
  });

  it("does not relabel an awakened-only Super Attack as BASE", () => {
    const initialState = selectInitialState({
      super_attacks: [
        { id: 2, name: "Attack (Extreme)", description: "EZA-only effect", ki: 12, level: 1 },
      ],
    } as any);

    deepEqual(initialState.currentSuperAttacks, []);
  });
});

describe("selectAwakenedState", function () {
  it("fails closed when latest type is unknown or the awakened payload is missing", () => {
    equal(selectAwakenedState({
      release_dates: { latest_type: "future_state" },
      extreme_z_awakening: {
        passive_skill: { name: "Unknown", description: "Must not be labeled EZA" },
      },
    } as any), undefined);

    equal(selectAwakenedState({
      release_dates: { latest_type: "seza" },
      passive_skill: { name: "Base", description: "Base passive" },
      extreme_z_awakening: null,
    } as any), undefined);
  });

  it("does not relabel a base super attack as awakened when no awakened variant exists", () => {
    const state = selectAwakenedState({
      max_level: 120,
      max_super_attack_level: 10,
      release_dates: { latest_type: "eza" },
      super_attacks: [
        { id: 1, name: "Base only", description: "Base effect", ki: 12, level: 0 },
      ],
      extreme_z_awakening: {
        max_level: 140,
        max_super_attack_level: 15,
        passive_skill: { name: "EZA passive", description: "EZA passive" },
      },
    } as any);

    deepEqual(state?.currentSuperAttacks, []);
  });

  it("does not reuse base level caps when the awakened payload omits them", () => {
    const state = selectAwakenedState({
      max_level: 120,
      max_super_attack_level: 10,
      release_dates: { latest_type: "eza" },
      extreme_z_awakening: {
        passive_skill: { name: "EZA passive", description: "EZA passive" },
      },
    } as any);

    equal(state?.maxLevel, 0);
    equal(state?.maxSuperAttackLevel, 0);
  });
});

describe("currentMaxStat", function () {
  it("does not publish a base max stat as an awakened stat when EZA data is absent", () => {
    equal(currentMaxStat({ max: 12345 } as any, "eza"), 0);
    equal(currentMaxStat({ max: 12345, eza: 14000 } as any, "eza"), 14000);
    equal(currentMaxStat({ max: 12345 } as any, "initial"), 12345);
  });
});

describe("mapDokkanFyiCharacter versioned combat fields", function () {
  it("keeps BASE fields distinct from the latest EZA fields", async () => {
    const character = await mapDokkanFyiCharacter({
      version: "fixture-version",
      payload: {
        props: {
          character: {
            id: 1014941,
            canonical_id: 1014941,
            character_id: 101494,
            base_character_id: 1014941,
            name: "Cell (Perfect Form) & Cell Jr.",
            rarity: 4,
            rarity_text: "LR",
            type: 1,
            type_text: "PHY",
            awakening_type: 1,
            awakening_type_text: "Extreme",
            stats: { hp: {}, atk: {}, def: {} },
            max_level: 150,
            max_super_attack_level: 20,
            cost: 77,
            thumbnail_id: 1014941,
            has_images: true,
            release_dates: {
              initial: "2019-07-31T00:00:00Z",
              eza: "2022-12-28T00:00:00Z",
              latest_type: "eza",
            },
            leader_skill: { name: "Base leader", description: "Base allies ATK +100%" },
            passive_skill: { name: "Base passive", description: "Base passive effect" },
            super_attacks: [
              { id: 1, name: "Perfect Attack", description: "Base SA", condition: "Base SA condition", ki: 12, level: 0 },
              { id: 2, name: "Perfect Attack (Extreme)", description: "EZA SA", condition: "EZA SA condition", ki: 12, level: 1 },
              { id: 3, name: "Perfect Ultra", description: "Base Ultra SA", condition: "Base Ultra condition", ki: 18, level: 0 },
              { id: 4, name: "Perfect Ultra (Extreme)", description: "EZA Ultra SA", condition: "EZA Ultra condition", ki: 18, level: 1 },
              { id: 5, name: "Unit Attack", description: "Base Unit effect", condition: "Base Unit condition", ki: 12, level: 0, style: "Unit Super Attack" },
              { id: 6, name: "Unit Attack (Extreme)", description: "EZA Unit effect", condition: "EZA Unit condition", ki: 12, level: 1, style: "Unit Super Attack" },
            ],
            extreme_z_awakening: {
              max_level: 150,
              max_super_attack_level: 25,
              leader_skill: { name: "EZA leader", description: "EZA allies ATK +180%" },
              passive_skill: { name: "EZA passive", description: "EZA passive effect" },
            },
            has_eza: true,
            has_seza: false,
          },
          transformationPath: [],
        },
      },
    } as any, {} as any);

    equal(character.leaderSkill, "Base allies ATK +100%");
    equal(character.ezaLeaderSkill, "EZA allies ATK +180%");
    equal(character.passive, "Base passive effect");
    equal(character.ezaPassive, "EZA passive effect");
    equal(character.superAttack, "Base SA");
    equal(character.ezaSuperAttack, "EZA SA");
    equal(character.superAttackDetails?.condition, "Base SA condition");
    equal(character.ezaSuperAttackDetails?.condition, "EZA SA condition");
    equal(character.ultraSuperAttack, "Base Ultra SA");
    equal(character.ezaUltraSuperAttack, "EZA Ultra SA");
    equal(character.ultraSuperAttackDetails?.condition, "Base Ultra condition");
    equal(character.ezaUltraSuperAttackDetails?.condition, "EZA Ultra condition");
    deepEqual(character.unitSuperAttacks?.map(attack => attack.effect), ["Base Unit effect"]);
    deepEqual(character.ezaUnitSuperAttacks?.map(attack => attack.effect), ["EZA Unit effect"]);
    equal(character.passiveDetails?.text, "Base passive effect");
    equal(character.ezaPassiveDetails?.text, "EZA passive effect");
  });

  it("keeps BASE and applicable EZA fields distinct from the latest SEZA passive", async () => {
    const character = await mapDokkanFyiCharacter({
      version: "9b8400b8f2f713f705f9ee5b2c56470d",
      payload: {
        props: {
          character: {
            id: 1003211,
            canonical_id: 1003211,
            character_id: 100321,
            base_character_id: 1003211,
            name: "Super Saiyan 3 Goku",
            rarity: 3,
            rarity_text: "UR",
            type: 0,
            type_text: "AGL",
            awakening_type: 0,
            awakening_type_text: "Super",
            stats: { hp: {}, atk: {}, def: {} },
            max_level: 120,
            max_super_attack_level: 10,
            cost: 42,
            thumbnail_id: 1003210,
            has_images: true,
            release_dates: {
              initial: "2016-05-05T07:10:00Z",
              eza: "2018-03-16T06:30:00Z",
              seza: "2024-03-21T08:00:00Z",
              latest_type: "seza",
            },
            leader_skill: { name: "Base leader", description: "Base leader effect" },
            passive_skill: { id: 10, name: "Base passive", description: "Base passive effect" },
            super_attacks: [
              { id: 11, name: "Dragon Fist", description: "Base SA", condition: "Base SA condition", ki: 12, level: 0 },
              { id: 12, name: "Dragon Fist (Extreme)", description: "{passiveImg:once}EZA SA", condition: "EZA SA condition", ki: 12, level: 1 },
              { id: 13, name: "Dragon Fist Ultra", description: "Base Ultra SA", condition: "Base Ultra condition", ki: 18, level: 0 },
              { id: 14, name: "Dragon Fist Ultra (Extreme)", description: "EZA Ultra SA", condition: "EZA Ultra condition", ki: 18, level: 1 },
              { id: 15, name: "Unit Attack", description: "Base Unit effect", condition: "Base Unit condition", ki: 12, level: 0, style: "Unit Super Attack" },
              { id: 16, name: "Unit Attack (Extreme)", description: "EZA Unit effect", condition: "EZA Unit condition", ki: 12, level: 1, style: "Unit Super Attack" },
            ],
            extreme_z_awakening: {
              max_level: 140,
              max_super_attack_level: 15,
              leader_skill: { name: "EZA leader", description: "EZA leader effect" },
              passive_skill: {
                id: 20,
                name: "SEZA passive",
                description: "*When the target enemy is in the following status: {passiveImg:atk_down}*\n- ATK 200%",
              },
            },
            has_eza: true,
            has_seza: true,
          },
          transformationPath: [],
        },
      },
    } as any, {} as any);

    equal(character.leaderSkill, "Base leader effect");
    equal(character.ezaLeaderSkill, "EZA leader effect");
    equal(character.passive, "Base passive effect");
    equal(character.ezaPassive, undefined);
    equal(character.sezaPassive, "When the target enemy is in the following status:\n- ATK 200%");
    equal(character.sezaPassiveDetails?.name, "SEZA passive");
    equal(character.sezaPassiveDetails?.conditionEvidence?.[0].stateKey, "1003211:1003211:seza");
    equal(character.sezaPassiveDetails?.conditionEvidence?.[0].releaseState, "seza");
    equal(character.superAttack, "Base SA");
    equal(character.ezaSuperAttack, "EZA SA");
    equal(character.ezaSuperAttackDetails?.condition, "EZA SA condition");
    equal(character.ezaSuperAttackDetails?.structuralSource?.evidence[0].stateKey, "1003211:1003211:seza");
    equal(character.ezaSuperAttackDetails?.structuralSource?.evidence[0].releaseState, "seza");
    equal(character.ultraSuperAttack, "Base Ultra SA");
    equal(character.ezaUltraSuperAttack, "EZA Ultra SA");
    equal(character.ezaUltraSuperAttackDetails?.condition, "EZA Ultra condition");
    deepEqual(character.unitSuperAttacks?.map(attack => attack.effect), ["Base Unit effect"]);
    deepEqual(character.ezaUnitSuperAttacks?.map(attack => attack.effect), ["EZA Unit effect"]);
  });
});

describe("preferredSuperAttacks", function () {
  it("keeps all three Pan-style Unit Super Attack slots distinct by release", () => {
    const attacks = [
      ...["Unit A", "Unit B", "Unit C"].map((name, index) => ({ name, description: `Base ${name} effect`, ki: 12 + index, level: 0, style: "Unit Super Attack", condition: "Base condition" })),
      ...["Unit A", "Unit B", "Unit C"].map((name, index) => ({ name, description: `EZA ${name} effect`, ki: 12 + index, level: 1, style: "Unit Super Attack", condition: "EZA condition" })),
    ];
    const base = preferredSuperAttacks(attacks as any, false).filter(item => item.style === "Unit Super Attack");
    const eza = preferredSuperAttacks(attacks as any, true).filter(item => item.style === "Unit Super Attack");
    deepEqual(base.map(item => item.description), ["Base Unit A effect", "Base Unit B effect", "Base Unit C effect"]);
    deepEqual(eza.map(item => item.description), ["EZA Unit A effect", "EZA Unit B effect", "EZA Unit C effect"]);
  });

  it("selects awakened attack slots without leaking a base-only Unit attack", () => {
    const selected = preferredSuperAttacks([
      {
        name: "Burst Rush",
        description: "Base normal",
        ki: 12,
        level: 0,
        super_attack_type: "Physical",
      },
      {
        name: "Burst Rush (Extreme)",
        description: "Awakened normal",
        ki: 12,
        level: 1,
        super_attack_type: "Physical",
      },
      {
        name: "Meteor Burst",
        description: "Base ultra",
        ki: 18,
        level: 0,
        super_attack_type: "Other",
      },
      {
        name: "Meteor Burst (Extreme)",
        description: "Awakened ultra",
        ki: 18,
        level: 1,
        super_attack_type: "Other",
      },
      {
        name: "Unit Combo",
        description: "Unit effect",
        ki: 18,
        level: 0,
        style: "Unit Super Attack",
        condition: "When Krillin is on the team",
      },
    ] as any, true);

    deepEqual(selected.map(attack => attack.name), [
      "Burst Rush (Extreme)",
      "Meteor Burst (Extreme)",
    ]);
    deepEqual(selected.map(attack => attack.description), [
      "Awakened normal",
      "Awakened ultra",
    ]);
  });

  it("prefers base variants when staying on the initial state", () => {
    const selected = preferredSuperAttacks([
      {
        name: "Burst Rush (Extreme)",
        description: "Base normal",
        ki: 12,
        level: 0,
        super_attack_type: "Physical",
      },
      {
        name: "Burst Rush",
        description: "Awakened normal",
        ki: 12,
        level: 1,
        super_attack_type: "Physical",
      },
    ] as any, false);

    equal(selected.length, 1);
    equal(selected[0].description, "Base normal");
  });
});

describe("standbyDetailsFromFyi", function () {
  it("maps standby finish skills from the base card payload and links them to the standby target", () => {
    const standby = standbyDetailsFromFyi({
      id: 24,
      name: "Enters Standby Mode",
      description: "Stands by for 5 turns.",
      condition: "Can be activated starting from the 3rd turn.",
      effects: [
        {
          transformation: {
            character: {
              id: 4029481,
            },
          },
        },
      ],
      finish_skills: [
        {
          id: 20,
          name: "Kamehameha",
          description: "Raises ATK by 15% temporarily per charge count and causes ultimate damage to enemy.",
          condition: "Can be activated when charge count is 34 or less (once only).",
          effects: [],
        },
        {
          id: 22,
          name: "Family Kamehameha",
          description: "Raises ATK by 20% temporarily per charge count, causes super-ultimate damage to enemy and attacks effective against all Types.",
          condition: "Can be activated when charge count is 35 or more with 7 Dragon Balls obtained (once only).",
          effects: [],
        },
      ],
    } as any);

    equal(standby?.targetCharacterId, "4029481");
    equal(standby?.finishSkills.length, 2);
    deepEqual(standby?.finishSkills.map(skill => skill.name), [
      "Kamehameha",
      "Family Kamehameha",
    ]);
    deepEqual(standby?.finishSkills.map(skill => skill.effectKind), [
      "mixed",
      "mixed",
    ]);
  });
});

describe("finishSkillsFromFyi", function () {
  it("detects finish-skill-triggered transformations like Jiren's post-standby state", () => {
    const finishSkills = finishSkillsFromFyi([
      {
        id: 15,
        name: "Resurfaced Trauma",
        description: "Character's Standby Mode ends; Ki +3 and ATK +30% for 3 turns.",
        condition: "Can be activated when charge count is 24 or less (once only).",
        effects: [],
      },
      {
        id: 17,
        name: "Awakened Full Power",
        description: "Awakens into Jiren (Full Power).",
        condition: "Can be activated when charge count is 25 or more (once only).",
        effects: [
          {
            transformation: {
              character: {
                id: 4029111,
              },
            },
          },
        ],
      },
    ] as any);

    equal(finishSkills.length, 2);
    equal(finishSkills[0].effectKind, "buff");
    equal(finishSkills[1].effectKind, "transform");
    equal(finishSkills[1].targetTransformationId, "4029111");
  });
});

describe("normalizeTransformationSource", function () {
  it("normalizes standby, finish and reversible exchange sources", () => {
    equal(normalizeTransformationSource("Standby Skill"), "standby");
    equal(normalizeTransformationSource("Finish Effect"), "finish-skill");
    equal(
      normalizeTransformationSource(undefined, "Meets up with Super Saiyan 2 Goku (Angel) and can perform Reversible Exchange"),
      "reversible-exchange",
    );
  });

  it("keeps active skill transformations as active even when the condition mentions reversible exchange", () => {
    equal(
      normalizeTransformationSource(
        "Active Skill",
        "Can be activated starting from the 5th turn from the start of battle (once only, be it before or after Reversible Exchange).",
      ),
      "active-skill",
    );
  });
});

describe("obtainabilityDetailsFromFyi", function () {
  it("marks freely obtainable characters as free to play", () => {
    const obtainability = obtainabilityDetailsFromFyi({
      is_freely_obtainable: true,
      is_stage_drop_reward: false,
      is_world_tournament_reward: false,
    } as any);

    equal(obtainability.type, "freely-obtainable");
    equal(obtainability.isFreeToPlay, true);
  });

  it("marks summonable characters as not free to play", () => {
    const obtainability = obtainabilityDetailsFromFyi({
      is_freely_obtainable: false,
      is_stage_drop_reward: false,
      is_world_tournament_reward: false,
    } as any);

    equal(obtainability.type, "summonable");
    equal(obtainability.isFreeToPlay, false);
  });
});

describe("reversibleExchangeDetailsFromFyi", function () {
  it("maps the reversible exchange counterpart and condition separately from generic transformations", () => {
    const reversibleExchange = reversibleExchangeDetailsFromFyi({
      reversible_exchange_character_id: 4033561,
      reversible_exchange_character: {
        name: "Nappa + Vegeta",
      },
    } as any, [
      {
        id: "4033561",
        transformationCondition: "Meets up with Nappa and can perform Reversible Exchange when facing 2 or more enemies, or starting from the 3rd turn from the character's entry turn.",
      },
    ] as any);

    equal(reversibleExchange?.targetCharacterId, "4033561");
    equal(reversibleExchange?.targetCharacterName, "Nappa + Vegeta");
    equal(
      reversibleExchange?.condition,
      "Meets up with Nappa and can perform Reversible Exchange when facing 2 or more enemies, or starting from the 3rd turn from the character's entry turn.",
    );
  });
});

describe("exclusiveSkillOrbsFromFyi", function () {
  it("maps mission-reward skill orbs with icon and banner metadata", () => {
    const orbs = exclusiveSkillOrbsFromFyi([
      {
        id: 4409,
        name: "[Character-Exclusive] EX Skill Orb DEF + Lv. 8",
        description: "Can be equipped to Super Saiyan Gohan (Teen).",
        grade: "bronze",
        is_reusable: true,
        img_id: "00009",
        skills: [
          {
            id: 440900,
            attribute: "defense",
            level: 8,
            hidden_potential_skill_id: null,
          },
        ],
        mission_reward: {
          mission_id: 25160,
          mission_category_id: 796,
          quantity: 1,
          mission_category: {
            img: "https://cdn.dokkan.fyi/assets/en/mission/mission_banner_event_796_3.png",
          },
        },
        shop_items: [],
      },
    ] as any);

    equal(orbs.length, 1);
    equal(orbs[0].iconURL, "https://cdn.dokkan.fyi/assets/en/item/equ_item_00009.png");
    equal(
      orbs[0].backgroundURL,
      "https://cdn.dokkan.fyi/assets/en/layout/en/image/equipment/equipment_thumb_bg/equ_base_bronze.png",
    );
    equal(orbs[0].acquisition?.[0].sourceType, "mission-reward");
    equal(orbs[0].acquisition?.[0].missionId, "25160");
    equal(orbs[0].acquisition?.[0].missionCategoryId, "796");
  });

  it("maps shop-item skill orbs with treasure and pricing metadata", () => {
    const orbs = exclusiveSkillOrbsFromFyi([
      {
        id: 3085,
        name: "[Character-Exclusive] EX Skill Orb HP + Lv. 8",
        description: "Can be equipped to Piccolo (Power Awakening).",
        grade: "bronze",
        is_reusable: true,
        img_id: "00008",
        skills: [],
        mission_reward: null,
        shop_items: [
          {
            id: 26903020,
            price: 2,
            discounted_price: 2,
            treasure_item_id: 32,
            treasure_item: {
              name: "Super Mineral Water",
              description: "Can be used at Baba's Shop.",
              image_suffix: 47,
            },
            starts_at: "2025-12-29 01:00:00",
            ends_at: "2026-01-29 14:59:59",
            is_indefinite: false,
          },
        ],
      },
    ] as any);

    equal(orbs.length, 1);
    equal(orbs[0].acquisition?.[0].sourceType, "shop-item");
    equal(orbs[0].acquisition?.[0].shopItemId, "26903020");
    equal(orbs[0].acquisition?.[0].price, 2);
    equal(orbs[0].acquisition?.[0].treasureItemId, "32");
    equal(orbs[0].acquisition?.[0].treasureItemName, "Super Mineral Water");
    equal(orbs[0].acquisition?.[0].startsAt, "2025-12-29 01:00:00");
  });
});

describe("buildDokkanFyiContractReferenceSample", function () {
  it("wraps curated characters with contract metadata for human review", () => {
    const sample = buildDokkanFyiContractReferenceSample([
      {
        id: "1029471",
        name: "Super Saiyan Gohan (Teen)",
      },
      {
        id: "1030431",
        name: "Super Saiyan Goku (Angel) + Super Saiyan Vegeta (Angel)",
      },
    ] as any);

    equal(sample.schemaName, "dokkan-fyi-character-contract");
    equal(sample.schemaVersion, 1);
    equal(sample.specPath, "docs/specs/dokkan-fyi-character-contract.md");
    deepEqual(sample.sampleCharacterIds, ["1029471", "1030431"]);
    equal(sample.characters.length, 2);
  });
});
