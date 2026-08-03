import { deepEqual, equal, match, ok } from "assert";
import { existsSync, readFileSync } from "fs";
import { describe, it } from "mocha";
import { resolve } from "path";
import { gunzipSync } from "zlib";
import { Character, PassiveDetails } from "./character";
import { FyiCharacterCatalogEntry } from "./fyi-character-catalog";
import {
  assertValidTeamAnalysisDataset,
  buildTeamAnalysisCoverageReport,
  buildTeamAnalysisDataset,
  CharacterStateAnalysis,
  ConditionExpression,
  mapPassiveDetailsToSource,
  parsePassive,
  PassivePredicate,
  validateTeamAnalysisDataset,
} from "./team-analysis";
import {
  buildTeamAnalysisArtifact,
  validateTeamAnalysisArtifact,
} from "./team-analysis-artifacts";
import { TEAM_ANALYSIS_CHANCE_LEXICON, validatedChancePercent } from "./team-analysis-chance-lexicon";
import {
  FIRST_PARTY_PROBABILITY_EVIDENCE,
  resolveFirstPartyProbability,
} from "./team-analysis-first-party-probabilities";
import { readGameDbTable } from "./game-db/game-db-source";

interface FoundationFixture {
  characters: Character[];
  catalogEntries: FyiCharacterCatalogEntry[];
  expectedStates: Array<{
    stateKey: string;
    hardDuplicateGroupId: string;
    variantGroupId?: string;
    awakeningFamilyId?: string;
    parseStatus?: string;
  }>;
}

interface GateA1Fixture {
  cases: Array<{
    name: string;
    rawText: string;
    passiveDetails?: PassiveDetails;
    expected: {
      parseStatus: string;
      conditionStatus: string;
      effectStatus: string;
      conditionOp: string;
      predicateKinds: string[];
      scopes: string[];
      selfInclusions: string[];
      categories?: string[];
      names?: string[];
      counts?: number[];
      effectKinds: string[];
      effectTarget: string;
      effectSelfInclusion?: string;
    };
  }>;
}

interface GateA11Fixture {
  cases: Array<{
    name: string;
    stateKey?: string;
    ruleIndex?: number;
    rawText: string;
    expected: {
      parseStatus: string;
      effectStatus?: string;
      effects: Array<{
        kind: string;
        target: string;
        value?: number;
        unit?: string;
        count?: number;
        activationChancePercent?: number;
        additionalToSuperChancePercent?: number;
        chancePercent?: number;
        stackCap?: number;
        durationKind?: string;
        durationTurns?: number;
        selfInclusion?: string;
        classifications?: string[];
        sourceText?: string;
        qualitativeChanceTerm?: string;
        probabilitySource?: string;
        additionalToSuperQualitativeChanceTerm?: string;
        additionalToSuperProbabilitySource?: string;
      }>;
    };
  }>;
}

type GoldenConditionShape =
  | { op: "always" }
  | { op: "unknown"; sourceText: string }
  | { op: "not"; child: GoldenConditionShape }
  | { op: "all" | "any"; children: GoldenConditionShape[] }
  | {
    op: "predicate";
    kind: string;
    scope: string;
    selfInclusion?: string;
    comparator?: string;
    value?: number;
    maxValue?: number;
    count?: number;
    categories?: string[];
    names?: string[];
    classes?: string[];
    types?: string[];
    slots?: number[];
    evaluationMoment?: string;
  };

interface GateA2Fixture {
  cases: Array<{
    name: string;
    source: "real" | "synthetic";
    rawText: string;
    expectedStatus: string;
    conditionStatus?: string;
    condition: GoldenConditionShape;
    target?: {
      scope: string;
      selfInclusion?: string;
      classes?: string[];
      types?: string[];
    };
  }>;
}

interface GateA3Fixture {
  cases: Array<{
    name: string;
    source: "real" | "synthetic";
    rawText: string;
    expectedStatus: string;
    conditionStatus?: string;
    condition: GoldenConditionShape;
    effectDuration?: { kind: string; turns?: number };
    expectNoEffectDuration?: boolean;
  }>;
}

const fixtureRelativePath = "fixtures/team-analysis/foundation-golden.json";
const sourceFixturePath = resolve(__dirname, fixtureRelativePath);
const fixturePath = existsSync(sourceFixturePath)
  ? sourceFixturePath
  : resolve(__dirname, "..", fixtureRelativePath);
const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as FoundationFixture;
const gateA1RelativePath = "fixtures/team-analysis/gate-a1-golden.json";
const sourceGateA1Path = resolve(__dirname, gateA1RelativePath);
const gateA1Path = existsSync(sourceGateA1Path)
  ? sourceGateA1Path
  : resolve(__dirname, "..", gateA1RelativePath);
const gateA1Fixture = JSON.parse(readFileSync(gateA1Path, "utf8")) as GateA1Fixture;
const gateA11RelativePath = "fixtures/team-analysis/gate-a11-golden.json";
const sourceGateA11Path = resolve(__dirname, gateA11RelativePath);
const gateA11Path = existsSync(sourceGateA11Path)
  ? sourceGateA11Path
  : resolve(__dirname, "..", gateA11RelativePath);
const gateA11Fixture = JSON.parse(readFileSync(gateA11Path, "utf8")) as GateA11Fixture;
const gateA2RelativePath = "fixtures/team-analysis/gate-a2-golden.json";
const sourceGateA2Path = resolve(__dirname, gateA2RelativePath);
const gateA2Path = existsSync(sourceGateA2Path)
  ? sourceGateA2Path
  : resolve(__dirname, "..", gateA2RelativePath);
const gateA2Fixture = JSON.parse(readFileSync(gateA2Path, "utf8")) as GateA2Fixture;
const gateA3RelativePath = "fixtures/team-analysis/gate-a3-golden.json";
const sourceGateA3Path = resolve(__dirname, gateA3RelativePath);
const gateA3Path = existsSync(sourceGateA3Path)
  ? sourceGateA3Path
  : resolve(__dirname, "..", gateA3RelativePath);
const gateA3Fixture = JSON.parse(readFileSync(gateA3Path, "utf8")) as GateA3Fixture;

const options = {
  generatedAt: "2026-08-03T12:00:00.000Z",
  sourceCharacterDatasetVersion: "characters-v1",
  sourceCharacterPayloadSha256: "a".repeat(64),
};

describe("team-analysis foundation identities", function () {
  it("matches the golden identities for base, transformed, exchange, standby, EZA, and SEZA states", () => {
    const before = JSON.stringify(fixture.characters);
    const dataset = buildTeamAnalysisDataset(fixture.characters, fixture.catalogEntries, options);
    const actual = JSON.parse(JSON.stringify(dataset.states.map(state => ({
      stateKey: state.stateKey,
      hardDuplicateGroupId: state.hardDuplicateGroupId,
      variantGroupId: state.variantGroupId,
      awakeningFamilyId: state.awakeningFamilyId,
      parseStatus: state.passive?.parseStatus,
    }))));

    deepEqual(actual, fixture.expectedStates);
    equal(JSON.stringify(fixture.characters), before, "generation must not mutate passive text or PassiveDetails");
    assertValidTeamAnalysisDataset(dataset, fixture.characters, fixture.catalogEntries);
  });

  it("keeps every form of a recruitable card in one hard group but distinct cards in separate hard groups", () => {
    const states = buildTeamAnalysisDataset(fixture.characters, fixture.catalogEntries, options).states;
    const root = state(states, "1001001:1001001:initial");
    const transformed = state(states, "1001001:4001001:initial");
    const exchangeRoot = state(states, "1002001:1002001:initial");
    const exchangeForm = state(states, "1002001:4002001:initial");
    const standbyRoot = state(states, "1003001:1003001:initial");
    const standbyForm = state(states, "1003001:4003001:initial");
    const variantOne = state(states, "1006001:1006001:initial");
    const variantTwo = state(states, "1006002:1006002:initial");
    const ezaInitial = state(states, "1004001:1004001:initial");
    const eza = state(states, "1004001:1004001:eza");
    const sezaInitial = state(states, "1005001:1005001:initial");
    const sezaEza = state(states, "1005001:1005001:eza");
    const seza = state(states, "1005001:1005001:seza");

    equal(root.hardDuplicateGroupId, transformed.hardDuplicateGroupId);
    equal(exchangeRoot.hardDuplicateGroupId, exchangeForm.hardDuplicateGroupId);
    equal(standbyRoot.hardDuplicateGroupId, standbyForm.hardDuplicateGroupId);
    equal(ezaInitial.hardDuplicateGroupId, eza.hardDuplicateGroupId);
    equal(sezaInitial.hardDuplicateGroupId, sezaEza.hardDuplicateGroupId);
    equal(sezaEza.hardDuplicateGroupId, seza.hardDuplicateGroupId);
    equal(variantOne.variantGroupId, variantTwo.variantGroupId);
    ok(variantOne.hardDuplicateGroupId !== variantTwo.hardDuplicateGroupId);
  });

  it("omits variant groups when canonical source identity is absent, even for equal display names", () => {
    const states = buildTeamAnalysisDataset(fixture.characters, fixture.catalogEntries, options).states;
    const first = state(states, "1007001:1007001:initial");
    const second = state(states, "1007002:1007002:initial");

    equal(first.displayName, second.displayName);
    equal(first.variantGroupId, undefined);
    equal(second.variantGroupId, undefined);
    ok(first.hardDuplicateGroupId !== second.hardDuplicateGroupId);
  });
});

describe("team-analysis passive foundation", function () {
  it("parses only recognized unconditional effects as always", () => {
    const passive = parsePassive(
      "100:100:initial",
      "Simple passive",
      "Basic effect(s)\n- Ki +3\n- ATK & DEF 120%\n- Guards all attacks",
    );

    equal(passive.parseStatus, "supported");
    deepEqual(passive.rules.map(rule => rule.condition), [
      { op: "always" },
      { op: "always" },
      { op: "always" },
    ]);
    deepEqual(passive.rules.flatMap(rule => rule.effects.map(effect => effect.kind)), [
      "ki", "atk", "def", "guard",
    ]);
    deepEqual(passive.unparsedFragments, []);
  });

  it("keeps unsupported clauses explicit and never coerces them to always", () => {
    const passive = parsePassive(
      "101:101:initial",
      undefined,
      "Basic effect(s)\n- Ki +3; performs a mysterious action\nWhen attacking\n- ATK 100%",
    );

    equal(passive.parseStatus, "partial");
    equal(passive.rules[0].condition.op, "always");
    equal(passive.rules[0].conditionStatus, "supported");
    equal(passive.rules[0].effectStatus, "partial");
    deepEqual(passive.rules[0].effects.map(effect => effect.kind), ["ki", "unknown"]);
    equal(passive.rules[0].effects[1].sourceText, "performs a mysterious action");
    equal(passive.rules[1].condition.op, "unknown");
    equal(passive.rules[1].conditionStatus, "unknown");
    equal(passive.rules[1].effectStatus, "supported");
    equal(passive.rules[1].effects[0].kind, "atk");
    deepEqual(passive.unparsedFragments.map(fragment => fragment.text), [
      "- Ki +3; performs a mysterious action",
      "When attacking",
    ]);
  });

  it("keeps source fragments ordered and pointing to exact raw text", () => {
    const rawText = "Basic effect(s)\n- Ki +3; unknown tail";
    const passive = parsePassive("102:102:initial", undefined, rawText);
    const lines = rawText.split("\n");

    for (const rule of passive.rules) {
      for (const fragment of rule.source) {
        equal(lines[fragment.lineIndex].slice(fragment.start, fragment.end), fragment.text);
      }
    }
    for (const fragment of passive.unparsedFragments) {
      equal(lines[fragment.lineIndex].slice(fragment.start, fragment.end), fragment.text);
    }
  });
});

describe("team-analysis Gate A1 passive parser", function () {
  for (const fixtureCase of gateA1Fixture.cases) {
    it(`matches golden case: ${fixtureCase.name}`, () => {
      const passive = parsePassive(
        `gate-a1:${fixtureCase.name}:initial`,
        fixtureCase.name,
        fixtureCase.rawText,
        fixtureCase.passiveDetails,
      );
      const rule = passive.rules[0];
      const predicates = flattenPredicates(rule.condition);
      const categories = unique([
        ...predicates.flatMap(predicate => predicate.categories ?? []),
        ...rule.effects.flatMap(effect => effect.categories ?? []),
      ]);

      equal(passive.parseStatus, fixtureCase.expected.parseStatus);
      equal(rule.conditionStatus, fixtureCase.expected.conditionStatus);
      equal(rule.effectStatus, fixtureCase.expected.effectStatus);
      equal(rule.condition.op, fixtureCase.expected.conditionOp);
      deepEqual(predicates.map(predicate => predicate.kind), fixtureCase.expected.predicateKinds);
      deepEqual(predicates.map(predicate => predicate.scope), fixtureCase.expected.scopes);
      deepEqual(
        predicates.map(predicate => predicate.selfInclusion).filter(value => value !== undefined),
        fixtureCase.expected.selfInclusions,
      );
      deepEqual(unique(predicates.flatMap(predicate => predicate.names ?? [])), fixtureCase.expected.names ?? []);
      deepEqual(categories, fixtureCase.expected.categories ?? []);
      deepEqual(predicates.flatMap(predicate => predicate.count ?? []), fixtureCase.expected.counts ?? []);
      deepEqual(rule.effects.map(effect => effect.kind), fixtureCase.expected.effectKinds);
      for (const effect of rule.effects) {
        equal(effect.target.scope, fixtureCase.expected.effectTarget);
      }
      if (fixtureCase.expected.effectSelfInclusion) {
        equal(rule.effects[0].target.selfInclusion, fixtureCase.expected.effectSelfInclusion);
      }
      for (const effect of rule.effects.filter(effect => effect.kind !== "unknown"
        && ["rotation_allies", "team_allies", "category_allies", "class_allies", "type_allies", "class_type_allies"]
          .includes(effect.target.scope))) {
        deepEqual(effect.classifications, ["support"]);
      }
    });
  }

  it("retains exact values for typed ally chance and defensive effects", () => {
    const expectedEffects = [
      { caseName: "known condition fully typed effect", kind: "critical_chance", value: 20, unit: "percent", chancePercent: 20 },
      { caseName: "allies dodge chance", kind: "evade_chance", value: 5, unit: "percent", chancePercent: 5 },
      { caseName: "allies damage reduction", kind: "damage_reduction", value: 11, unit: "percent", chancePercent: undefined },
      { caseName: "allies guard", kind: "guard", value: 1, unit: "boolean", chancePercent: undefined },
    ];

    for (const expected of expectedEffects) {
      const fixtureCase = gateA1Fixture.cases.find(item => item.name === expected.caseName);
      ok(fixtureCase);
      const passive = parsePassive("gate-a1:typed-allies:initial", undefined, fixtureCase.rawText);
      const effect = passive.rules[0].effects.find(item => item.kind === expected.kind);
      ok(effect, expected.caseName);
      equal(effect.value, expected.value);
      equal(effect.unit, expected.unit);
      equal(effect.chancePercent, expected.chancePercent);
      equal(effect.target.selfInclusion, "included");
      deepEqual(effect.classifications, ["support"]);
    }
  });

  it("preserves only an unrecognized qualifier and marks unqualified probabilities unresolved", () => {
    const qualifiedCase = gateA1Fixture.cases.find(item => item.name === "known effect with unknown qualifier");
    const qualitativeCase = gateA1Fixture.cases.find(item => item.name === "unqualified chance remains unresolved");
    ok(qualifiedCase);
    ok(qualitativeCase);

    const qualified = parsePassive("gate-a1:qualifier:initial", undefined, qualifiedCase.rawText);
    const qualitative = parsePassive("gate-a1:qualitative:initial", undefined, qualitativeCase.rawText);
    const wrapped = parsePassive(
      "gate-a1:wrapped-atom:initial",
      undefined,
      "Basic effect(s)\n- Receives an additional Ki +1 per Ki Sphere obtained",
    );
    deepEqual(qualified.rules[0].effects.map(effect => effect.sourceText), [
      "chance of performing a critical hit 10%",
      "while celebrating",
    ]);
    deepEqual(qualified.rules[0].effects[0].duration, { kind: "turns", turns: 2 });
    equal(qualitative.rules[0].effects[0].kind, "critical_chance");
    equal(qualitative.rules[0].effects[0].value, undefined);
    equal(qualitative.rules[0].effects[0].chancePercent, undefined);
    equal(qualitative.rules[0].effects[0].probabilitySource, "unresolved");
    deepEqual(wrapped.rules[0].effects.map(effect => effect.sourceText), [
      "Receives an additional Ki +1",
      "per Ki Sphere obtained",
    ]);
  });

  it("parses Class ally prefixes without assigning them to self", () => {
    const passive = parsePassive(
      "gate-a1:future-target:initial",
      undefined,
      "Basic effect(s)\n- Super Class allies' ATK 30%",
    );

    equal(passive.rules[0].parseStatus, "supported");
    equal(passive.rules[0].effects[0].kind, "atk");
    equal(passive.rules[0].effects[0].target.scope, "class_allies");
    equal(passive.rules[0].effects[0].target.selfInclusion, "included");
    deepEqual(passive.rules[0].effects[0].classes, ["Super"]);
    deepEqual(passive.rules[0].effects[0].classifications, ["support"]);
  });

  it("maps wrapped PassiveDetails lines and sections to exact raw offsets", () => {
    const fixtureCase = gateA1Fixture.cases.find(item => item.name === "another category ally on team");
    ok(fixtureCase?.passiveDetails);
    const sourceMap = mapPassiveDetailsToSource(fixtureCase.rawText, fixtureCase.passiveDetails);

    equal(sourceMap.unmappedTexts.length, 0);
    equal(sourceMap.lines[0].mapped, true);
    deepEqual(sourceMap.lines[0].source.map(fragment => fragment.lineIndex), [0, 1]);
    equal(sourceMap.sections[0].label?.mapped, true);
    deepEqual(sourceMap.sections[0].label?.source.map(fragment => fragment.lineIndex), [0, 1]);
    for (const mappedText of [...sourceMap.lines, ...sourceMap.sections.flatMap(section => [
      ...(section.label ? [section.label] : []),
      ...section.lines,
    ])]) {
      for (const fragment of mappedText.source) {
        const rawLine = fixtureCase.rawText.split("\n")[fragment.lineIndex];
        equal(rawLine.slice(fragment.start, fragment.end), fragment.text);
      }
    }
  });

  it("reconstructs every non-whitespace source token in original order", () => {
    for (const fixtureCase of gateA1Fixture.cases) {
      const passive = parsePassive("gate-a1:tokens:initial", undefined, fixtureCase.rawText, fixtureCase.passiveDetails);
      const fragments = uniqueFragments([
        ...passive.rules.flatMap(rule => rule.source),
        ...passive.unparsedFragments,
      ]);
      const reconstructed = fragments.map(fragment => fragment.text).join("\n").replace(/\s/g, "");
      equal(reconstructed, fixtureCase.rawText.replace(/\s/g, ""), fixtureCase.name);
    }
  });
});

describe("team-analysis Gate A1.1 combat effects", function () {
  it("uses only source-validated qualitative chance values", () => {
    deepEqual(Object.keys(TEAM_ANALYSIS_CHANCE_LEXICON), ["a chance", "medium", "high", "great"]);
    equal(validatedChancePercent("a chance", "additional_to_super"), 10);
    equal(validatedChancePercent("a chance", "critical_activation"), undefined);
    equal(validatedChancePercent("rare", "critical_activation"), undefined);
    equal(validatedChancePercent("medium", "critical_activation"), 30);
    equal(validatedChancePercent("HIGH", "evade_activation"), 50);
    equal(validatedChancePercent("great", "additional_super_activation"), 70);
    for (const entry of Object.values(TEAM_ANALYSIS_CHANCE_LEXICON)) {
      equal(entry.origin.source, "first-party-game-db");
      if (entry.term === "a chance") {
        deepEqual(new Set(entry.evidence.map(item => item.semantic)), new Set(["additional_to_super"]));
      } else {
        deepEqual(new Set(entry.evidence.map(item => item.semantic)), new Set([
          "critical_activation", "evade_activation", "additional_super_activation", "additional_to_super",
        ]));
      }
    }
  });

  for (const fixtureCase of gateA11Fixture.cases) {
    it(`matches Gate A1.1 golden case: ${fixtureCase.name}`, () => {
      const passive = parsePassive(
        fixtureCase.stateKey ?? `gate-a11:${fixtureCase.name}:initial`,
        fixtureCase.name,
        fixtureCase.rawText,
      );
      const rule = passive.rules[fixtureCase.ruleIndex ?? 0];

      equal(passive.parseStatus, fixtureCase.expected.parseStatus);
      equal(rule.effectStatus, fixtureCase.expected.effectStatus ?? fixtureCase.expected.parseStatus);
      equal(rule.conditionStatus, "supported");
      equal(rule.condition.op, "always");
      equal(rule.effects.length, fixtureCase.expected.effects.length);
      fixtureCase.expected.effects.forEach((expected, index) => {
        const effect = rule.effects[index];
        equal(effect.kind, expected.kind);
        equal(effect.target.scope, expected.target);
        for (const field of [
          "value", "unit", "count", "activationChancePercent", "additionalToSuperChancePercent",
          "chancePercent", "stackCap", "qualitativeChanceTerm", "probabilitySource",
          "additionalToSuperQualitativeChanceTerm", "additionalToSuperProbabilitySource",
        ] as const) {
          equal(effect[field], expected[field], `${fixtureCase.name}: ${field}`);
        }
        if (expected.sourceText !== undefined) {
          equal(effect.sourceText, expected.sourceText, `${fixtureCase.name}: sourceText`);
        }
        equal(effect.duration?.kind, expected.durationKind, `${fixtureCase.name}: duration kind`);
        equal(effect.duration?.turns, expected.durationTurns, `${fixtureCase.name}: duration turns`);
        equal(effect.target.selfInclusion, expected.selfInclusion, `${fixtureCase.name}: self inclusion`);
        deepEqual(effect.classifications, expected.classifications, `${fixtureCase.name}: classifications`);
      });
    });
  }

  it("keeps activation and additional-to-Super chances semantically distinct", () => {
    const passive = parsePassive(
      "gate-a11:distinct-chances:initial",
      undefined,
      "Basic effect(s)\n- High chance of launching an additional attack that has a medium chance of becoming a Super Attack",
    );
    const effect = passive.rules[0].effects[0];

    equal(effect.kind, "additional_attack");
    equal(effect.activationChancePercent, 50);
    equal(effect.chancePercent, 50);
    equal(effect.additionalToSuperChancePercent, 30);
    equal(effect.qualitativeChanceTerm, "high");
    equal(effect.probabilitySource, "qualitative_lexicon");
    equal(effect.additionalToSuperQualitativeChanceTerm, "medium");
    equal(effect.additionalToSuperProbabilitySource, "qualitative_lexicon");
  });

  it("requires structural first-party evidence and never resolves rare by term alone", () => {
    equal(FIRST_PARTY_PROBABILITY_EVIDENCE.length, 10);
    const jacoText = "Basic effect(s)\n- Rare chance of stunning all enemies";
    const jaco = resolveFirstPartyProbability(
      "1002210:1002210:initial", jacoText, 1, "rare", "stun_activation",
    );

    equal(jaco?.percent, 7);
    equal(jaco?.passiveSkillSetId, "198");
    equal(resolveFirstPartyProbability(
      "1002210:1002210:initial", jacoText, 1, "rare", "critical_activation",
    ), undefined);
    equal(resolveFirstPartyProbability(
      "1002210:1002210:initial", `${jacoText}.`, 1, "rare", "stun_activation",
    ), undefined);
  });

  it("matches every checked-in probability association to the audited first-party rows", async () => {
    const dataDir = resolve("game-db/data/game-db-acquisition/first-party/latest/data");
    const config = { sourceRoot: resolve("game-db"), dataDir };
    const [cards, sets, relations, skills] = await Promise.all([
      readGameDbTable(config, "cards"),
      readGameDbTable(config, "passive_skill_sets"),
      readGameDbTable(config, "passive_skill_set_relations"),
      readGameDbTable(config, "passive_skills"),
    ]);
    const setsById = new Map(sets.map(row => [row.id, row]));
    const skillsById = new Map(skills.map(row => [row.id, row]));
    const cardsById = new Map(cards.map(row => [row.id, row]));
    const relationKeys = new Set(relations.map(row => `${row.passive_skill_set_id}:${row.passive_skill_id}`));

    for (const evidence of FIRST_PARTY_PROBABILITY_EVIDENCE) {
      ok(/rare\s+chance/i.test(setsById.get(evidence.passiveSkillSetId)?.itemized_description ?? ""));
      for (const skillId of evidence.passiveSkillIds) {
        ok(relationKeys.has(`${evidence.passiveSkillSetId}:${skillId}`));
        const skill = skillsById.get(skillId);
        equal(Number(skill?.efficacy_type), evidence.efficacyType);
        equal(Number(skill?.[evidence.valueField]), evidence.percent);
      }
    }

    deepEqual(["1000140", "1002210", "1004870"].map(id => cardsById.get(id)?.passive_skill_set_id), ["141", "198", "402"]);
    deepEqual(["141", "198", "402"].map(id => Number(skillsById.get(id)?.probability)), [100, 7, 100]);
    deepEqual(["141", "198", "402"].map(id => Number(skillsById.get(id)?.is_once)), [1, 0, 1]);
  });

  it("keeps conditional dodge, critical, and additional contributions as separate rules", () => {
    const rawText = [
      "Basic effect(s)",
      "- High chance of evading enemy's attack",
      "- Medium chance of performing a critical hit",
      "- Launches an additional attack",
      "When there is another \"Ginyu Force\" Category ally on the team",
      "- Chance of evading enemy's attack 20%",
      "- Chance of performing a critical hit 10%",
      "- 30% chance of launching an additional attack",
    ].join("\n");
    const passive = parsePassive("gate-a11:separate-contributions:initial", undefined, rawText);
    const typed = passive.rules.flatMap(rule => rule.effects
      .filter(effect => ["evade_chance", "critical_chance", "additional_attack"].includes(effect.kind))
      .map(effect => ({ ruleId: rule.id, condition: rule.condition, effect })));

    equal(typed.length, 6);
    equal(new Set(typed.map(item => item.ruleId)).size, 6);
    deepEqual(typed.filter(item => item.effect.kind === "evade_chance")
      .map(item => item.effect.activationChancePercent), [50, 20]);
    deepEqual(typed.filter(item => item.effect.kind === "critical_chance")
      .map(item => item.effect.activationChancePercent), [30, 10]);
    deepEqual(typed.filter(item => item.effect.kind === "additional_attack")
      .map(item => item.effect.activationChancePercent), [100, 30]);
    equal(typed.filter(item => item.condition.op !== "always").length, 3);
  });

  it("preserves Gohan's base and conditional dodge contributions without summing them", () => {
    const rawText = [
      "Basic effect(s)",
      "- Ki +1 and ATK & DEF 120%",
      "- Rare chance of evading enemy's attack",
      "As the 1st attacker in a turn",
      "- Ki +3 and ATK 30%",
      "- Chance of evading enemy's attack 50%",
      "As the 2nd attacker in a turn",
      "- Ki +1 and ATK 10%",
      "- Chance of evading enemy's attack 30%",
      "When HP is 30% or less",
      "- ATK 200%",
      "- Performs a critical hit",
      "- Fully recovers HP",
    ].join("\n");
    const passive = parsePassive("1017511:1017511:initial", undefined, rawText);
    const dodge = passive.rules.flatMap(rule => rule.effects
      .filter(effect => effect.kind === "evade_chance")
      .map(effect => ({ ruleId: rule.id, effect })));

    deepEqual(dodge.map(item => item.effect.activationChancePercent), [15, 50, 30]);
    deepEqual(dodge.map(item => item.effect.probabilitySource), [
      "first_party_game_db", "explicit_text", "explicit_text",
    ]);
    equal(new Set(dodge.map(item => item.ruleId)).size, 3);
  });

  it("preserves explicit 7/15 percentages and never reverse-maps them to rare", () => {
    const critical = parsePassive(
      "gate-a11:explicit-seven:initial",
      undefined,
      "Basic effect(s)\n- 7% chance of performing a critical hit",
    ).rules[0].effects[0];
    const evade = parsePassive(
      "gate-a11:explicit-fifteen:initial",
      undefined,
      "Basic effect(s)\n- 15% chance of evading enemy's attack",
    ).rules[0].effects[0];

    equal(critical.kind, "critical_chance");
    equal(critical.activationChancePercent, 7);
    equal(critical.probabilitySource, "explicit_text");
    equal(evade.kind, "evade_chance");
    equal(evade.activationChancePercent, 15);
    equal(evade.probabilitySource, "explicit_text");
  });

  it("reconstructs every Gate A1.1 source token in original order", () => {
    for (const fixtureCase of gateA11Fixture.cases) {
      const passive = parsePassive("gate-a11:tokens:initial", undefined, fixtureCase.rawText);
      const fragments = uniqueFragments([
        ...passive.rules.flatMap(rule => rule.source),
        ...passive.unparsedFragments,
      ]);
      const reconstructed = fragments.map(fragment => fragment.text).join("\n").replace(/\s/g, "");
      equal(reconstructed, fixtureCase.rawText.replace(/\s/g, ""), fixtureCase.name);
    }
  });
});

describe("team-analysis Gate A2 class, type, slot, and boolean parser", function () {
  for (const fixtureCase of gateA2Fixture.cases) {
    it(`matches Gate A2 golden case: ${fixtureCase.name}`, () => {
      const passive = parsePassive(`gate-a2:${fixtureCase.name}:initial`, fixtureCase.name, fixtureCase.rawText);
      const rule = passive.rules[0];

      equal(passive.parseStatus, fixtureCase.expectedStatus);
      equal(rule.conditionStatus, fixtureCase.conditionStatus ?? "supported");
      deepEqual(conditionShape(rule.condition), fixtureCase.condition);
      if (fixtureCase.target) {
        const typedEffects = rule.effects.filter(effect => effect.kind !== "unknown");
        ok(typedEffects.length > 0);
        for (const effect of typedEffects) {
          deepEqual({
            scope: effect.target.scope,
            ...(effect.target.selfInclusion ? { selfInclusion: effect.target.selfInclusion } : {}),
            ...(effect.classes ? { classes: effect.classes } : {}),
            ...(effect.types ? { types: effect.types } : {}),
          }, fixtureCase.target);
          if (["class_allies", "type_allies", "class_type_allies"].includes(effect.target.scope)) {
            deepEqual(effect.classifications, ["support"]);
          } else {
            equal(effect.classifications, undefined);
          }
        }
      }
      equal(rule.effects.some(effect => (effect.kind as string) === "support"), false);
    });
  }

  it("reconstructs every Gate A2 source token in original order", () => {
    for (const fixtureCase of gateA2Fixture.cases) {
      const passive = parsePassive("gate-a2:tokens:initial", undefined, fixtureCase.rawText);
      const fragments = uniqueFragments([
        ...passive.rules.flatMap(rule => rule.source),
        ...passive.unparsedFragments,
      ]);
      const reconstructed = fragments.map(fragment => fragment.text).join("\n").replace(/\s/g, "");
      equal(reconstructed, fixtureCase.rawText.replace(/\s/g, ""), fixtureCase.name);
    }
  });

  it("preserves a resolved Class target on both typed and residual effects", () => {
    const fixtureCase = gateA2Fixture.cases.find(item => item.name === "Class target preserves residual unknown effect");
    ok(fixtureCase);
    const passive = parsePassive("gate-a2:residual-target:initial", undefined, fixtureCase.rawText);
    const effects = passive.rules[0].effects;

    deepEqual(effects.map(effect => effect.kind), ["atk", "unknown"]);
    for (const effect of effects) {
      equal(effect.target.scope, "class_allies");
      equal(effect.target.selfInclusion, "included");
      deepEqual(effect.classes, ["Super"]);
    }
  });
});

describe("team-analysis Gate A3 HP and battle-time parser", function () {
  for (const fixtureCase of gateA3Fixture.cases) {
    it(`matches Gate A3 golden case: ${fixtureCase.name}`, () => {
      const passive = parsePassive(`gate-a3:${fixtureCase.name}:initial`, fixtureCase.name, fixtureCase.rawText);
      const rule = passive.rules[0];

      equal(passive.parseStatus, fixtureCase.expectedStatus);
      equal(rule.conditionStatus, fixtureCase.conditionStatus ?? "supported");
      deepEqual(conditionShape(rule.condition), fixtureCase.condition);
      if (fixtureCase.effectDuration) {
        const typedEffect = rule.effects.find(effect => effect.kind !== "unknown");
        ok(typedEffect);
        deepEqual(typedEffect.duration, fixtureCase.effectDuration);
      }
      if (fixtureCase.expectNoEffectDuration) {
        equal(rule.effects.some(effect => effect.duration !== undefined), false);
      }
    });
  }

  it("reconstructs every Gate A3 source token in original order", () => {
    for (const fixtureCase of gateA3Fixture.cases) {
      const passive = parsePassive("gate-a3:tokens:initial", undefined, fixtureCase.rawText);
      const fragments = uniqueFragments([
        ...passive.rules.flatMap(rule => rule.source),
        ...passive.unparsedFragments,
      ]);
      const reconstructed = fragments.map(fragment => fragment.text).join("\n").replace(/\s/g, "");
      equal(reconstructed, fixtureCase.rawText.replace(/\s/g, ""), fixtureCase.name);
    }
  });
});

describe("team-analysis validation and artifacts", function () {
  it("reports coverage by passive/rule status and supported effect", () => {
    const dataset = buildTeamAnalysisDataset(fixture.characters, fixture.catalogEntries, options);
    const coverage = buildTeamAnalysisCoverageReport(dataset);

    deepEqual(coverage.passiveStatusCounts, { supported: 10, partial: 2, unknown: 1 });
    equal(coverage.identity.variantGroupOmittedStateCount, 2);
    ok(coverage.ruleStatusCounts.supported > 0);
    ok(coverage.ruleStatusCounts.unknown > 0);
    ok(coverage.supportedEffectCounts.atk > 0);
    ok(coverage.unknownFragmentCount > 0);
  });

  it("separates scenario-containing rules from fully scenario-evaluable rules", () => {
    const dataset = buildTeamAnalysisDataset(fixture.characters, fixture.catalogEntries, options);
    const baseline = buildTeamAnalysisCoverageReport(dataset);
    const rule = dataset.states[0].passive?.rules[0];
    ok(rule);
    rule.condition = {
      op: "all",
      children: [
        {
          op: "predicate",
          predicate: {
            kind: "hp_percent",
            scope: "team",
            comparator: "lte",
            value: 50,
            sourceText: "Basic effect(s)",
          },
        },
        {
          op: "predicate",
          predicate: {
            kind: "battle_slot",
            scope: "self",
            slots: [2],
            sourceText: "Basic effect(s)",
          },
        },
      ],
    };
    rule.conditionStatus = "supported";
    rule.parseStatus = rule.effectStatus === "supported" ? "supported" : "partial";

    const supported = buildTeamAnalysisCoverageReport(dataset);
    equal(supported.scenarioRuleCount, baseline.scenarioRuleCount + 1);
    equal(supported.scenarioEvaluableRuleCount, baseline.scenarioEvaluableRuleCount + 1);
    equal(supported.placementEvaluableRuleCount, baseline.placementEvaluableRuleCount);
    equal(supported.teamEvaluableRuleCount, baseline.teamEvaluableRuleCount - 1);

    rule.condition = { op: "all", children: [rule.condition, { op: "unknown", sourceText: "enemy state" }] };
    rule.conditionStatus = "partial";
    rule.parseStatus = "partial";
    const partial = buildTeamAnalysisCoverageReport(dataset);
    equal(partial.scenarioRuleCount, baseline.scenarioRuleCount + 1);
    equal(partial.scenarioEvaluableRuleCount, baseline.scenarioEvaluableRuleCount);
  });

  it("detects duplicate keys, broken references, unstable IDs, and invalid fragments", () => {
    const dataset = buildTeamAnalysisDataset(fixture.characters, fixture.catalogEntries, options);
    const broken = JSON.parse(JSON.stringify(dataset)) as typeof dataset;
    broken.states.push(JSON.parse(JSON.stringify(broken.states[0])));
    broken.stateCount = broken.states.length;
    broken.states[0].hardDuplicateGroupId = "card:wrong";
    broken.states[1].stateKey = "missing:form:initial";
    const fragment = broken.states[0].passive?.rules[0].source[0];
    if (fragment) {
      fragment.text = "not source text";
    }
    if (broken.states[2].passive) {
      broken.states[2].passive.rawText += " altered";
    }

    const issues = validateTeamAnalysisDataset(broken, fixture.characters, fixture.catalogEntries);
    const codes = issues.map(issue => issue.code);
    ok(codes.includes("duplicate-state-key"));
    ok(codes.includes("missing-reference"));
    ok(codes.includes("unstable-identity"));
    ok(codes.includes("fragment-text"));
    ok(codes.includes("passive-text-source"));
    ok(codes.includes("duplicate-rule-id"));
  });

  it("rejects ambiguous ally self inclusion, standalone support, and missing derived support", () => {
    const dataset = buildTeamAnalysisDataset(fixture.characters, fixture.catalogEntries, options);
    const broken = JSON.parse(JSON.stringify(dataset)) as typeof dataset;
    const rule = broken.states[0].passive?.rules[0];
    ok(rule);
    rule.condition = {
      op: "predicate",
      predicate: {
        kind: "ally_category_present",
        scope: "team",
        categories: ["Test Category"],
        sourceText: "Basic effect(s)",
      },
    };
    rule.effects = JSON.parse(JSON.stringify([{
      kind: "support",
      target: { scope: "team_allies" },
      sourceText: "Ki +3",
    }])) as typeof rule.effects;
    const typedAllyRule = broken.states[0].passive?.rules[1];
    ok(typedAllyRule);
    typedAllyRule.effects = [{
      kind: "critical_chance",
      target: { scope: "team_allies", selfInclusion: "included" },
      value: 20,
      unit: "percent",
      chancePercent: 20,
      sourceText: "chance of performing a critical hit 20%",
    }];

    const codes = validateTeamAnalysisDataset(broken, fixture.characters, fixture.catalogEntries)
      .map(issue => issue.code);
    ok(codes.includes("condition-self-inclusion"));
    ok(codes.includes("target-self-inclusion"));
    ok(codes.includes("standalone-support"));
    ok(codes.includes("missing-support-classification"));
  });

  it("rejects ambiguous combat chance semantics, invalid counts, caps, and durations", () => {
    const dataset = buildTeamAnalysisDataset(fixture.characters, fixture.catalogEntries, options);
    const broken = JSON.parse(JSON.stringify(dataset)) as typeof dataset;
    const effect = broken.states.flatMap(item => item.passive?.rules ?? [])
      .flatMap(rule => rule.effects)
      .find(item => item.kind !== "unknown");
    ok(effect);
    effect.kind = "critical_chance";
    effect.activationChancePercent = 30;
    effect.chancePercent = 50;
    effect.qualitativeChanceTerm = "rare";
    effect.probabilitySource = "unresolved";
    effect.additionalToSuperChancePercent = 120;
    effect.additionalToSuperQualitativeChanceTerm = "rare";
    effect.additionalToSuperProbabilitySource = "unresolved";
    effect.count = 0;
    effect.stackCap = -1;
    effect.duration = { kind: "battle", turns: 2 };

    const codes = validateTeamAnalysisDataset(broken, fixture.characters, fixture.catalogEntries)
      .map(issue => issue.code);
    ok(codes.includes("chance-range"));
    ok(codes.includes("chance-alias"));
    ok(codes.includes("additional-to-super-kind"));
    ok(codes.includes("probability-unresolved-value"));
    ok(codes.includes("additional-to-super-probability-unresolved-value"));
    ok(codes.includes("effect-count"));
    ok(codes.includes("effect-cap"));
    ok(codes.includes("duration-turns-kind"));
  });

  it("rejects invalid Class, Type, and battle-slot payloads", () => {
    const dataset = buildTeamAnalysisDataset(fixture.characters, fixture.catalogEntries, options);
    const broken = JSON.parse(JSON.stringify(dataset)) as typeof dataset;
    const rule = broken.states[0].passive?.rules[0];
    ok(rule);
    rule.condition = JSON.parse(JSON.stringify({
      op: "all",
      children: [
        {
          op: "predicate",
          predicate: {
            kind: "ally_class_type_present",
            scope: "rotation",
            selfInclusion: "included",
            classes: ["Hero"],
            types: ["BLUE"],
            sourceText: "Basic effect(s)",
          },
        },
        {
          op: "predicate",
          predicate: {
            kind: "battle_slot",
            scope: "rotation",
            slots: [0, 4],
            sourceText: "Basic effect(s)",
          },
        },
      ],
    })) as typeof rule.condition;
    rule.effects = JSON.parse(JSON.stringify([{
      kind: "atk",
      target: { scope: "class_type_allies", selfInclusion: "included" },
      value: 20,
      unit: "percent",
      classifications: ["support"],
      sourceText: "ATK 20%",
    }])) as typeof rule.effects;

    const codes = validateTeamAnalysisDataset(broken, fixture.characters, fixture.catalogEntries)
      .map(issue => issue.code);
    ok(codes.includes("class-value"));
    ok(codes.includes("type-value"));
    ok(codes.includes("slot-scope"));
    ok(codes.includes("slot-range"));
    ok(codes.includes("target-classes"));
    ok(codes.includes("target-types"));
  });

  it("rejects invalid HP, battle-turn, entry-turn, phase, and window payloads", () => {
    const dataset = buildTeamAnalysisDataset(fixture.characters, fixture.catalogEntries, options);
    const broken = JSON.parse(JSON.stringify(dataset)) as typeof dataset;
    const rule = broken.states[0].passive?.rules[0];
    ok(rule);
    rule.condition = JSON.parse(JSON.stringify({
      op: "all",
      children: [
        {
          op: "predicate",
          predicate: {
            kind: "hp_percent",
            scope: "self",
            comparator: "between",
            value: 101,
            maxValue: 120,
            evaluationMoment: "mid_turn",
            sourceText: "Basic effect(s)",
          },
        },
        {
          op: "predicate",
          predicate: {
            kind: "battle_turn",
            scope: "self",
            comparator: "gte",
            value: 0,
            sourceText: "Basic effect(s)",
          },
        },
        {
          op: "predicate",
          predicate: {
            kind: "hp_percent",
            scope: "team",
            comparator: "lte",
            sourceText: "Basic effect(s)",
          },
        },
        {
          op: "predicate",
          predicate: {
            kind: "turn_from_entry",
            scope: "battle",
            comparator: "lte",
            value: 0.5,
            sourceText: "Basic effect(s)",
          },
        },
        {
          op: "predicate",
          predicate: {
            kind: "battle_turn",
            scope: "battle",
            comparator: "gte",
            value: 6,
            sourceText: "Basic effect(s)",
          },
        },
        {
          op: "predicate",
          predicate: {
            kind: "battle_turn",
            scope: "battle",
            comparator: "lte",
            value: 3,
            sourceText: "Basic effect(s)",
          },
        },
      ],
    })) as typeof rule.condition;

    const codes = validateTeamAnalysisDataset(broken, fixture.characters, fixture.catalogEntries)
      .map(issue => issue.code);
    ok(codes.includes("scenario-comparator"));
    ok(codes.includes("scenario-value"));
    ok(codes.includes("scenario-max-value"));
    ok(codes.includes("hp-scope"));
    ok(codes.includes("hp-range"));
    ok(codes.includes("evaluation-moment"));
    ok(codes.includes("battle-turn-scope"));
    ok(codes.includes("entry-turn-scope"));
    ok(codes.includes("turn-index"));
    ok(codes.includes("condition-window-range"));
  });

  it("rejects PassiveDetails text that cannot be mapped back to raw offsets", () => {
    const characters = JSON.parse(JSON.stringify(fixture.characters)) as Character[];
    ok(characters[0].passiveDetails?.lines);
    characters[0].passiveDetails.lines[0] = "text absent from raw passive";
    const dataset = buildTeamAnalysisDataset(characters, fixture.catalogEntries, options);

    const codes = validateTeamAnalysisDataset(dataset, characters, fixture.catalogEntries)
      .map(issue => issue.code);
    ok(codes.includes("passive-details-source-map"));
  });

  it("produces byte-stable gzip output and an exact character compatibility manifest", () => {
    const dataset = buildTeamAnalysisDataset(fixture.characters, fixture.catalogEntries, options);
    const first = buildTeamAnalysisArtifact(dataset);
    const second = buildTeamAnalysisArtifact(dataset);

    equal(first.jsonText, second.jsonText);
    equal(first.gzipBuffer.equals(second.gzipBuffer), true);
    equal(first.manifest.sha256, second.manifest.sha256);
    equal(first.manifest.sourceCharacterDatasetVersion, options.sourceCharacterDatasetVersion);
    equal(first.manifest.sourceCharacterPayloadSha256, options.sourceCharacterPayloadSha256);
    equal(first.manifest.stateCount, dataset.stateCount);
    deepEqual(validateTeamAnalysisArtifact(first, dataset), []);
    deepEqual(JSON.parse(gunzipSync(first.gzipBuffer).toString("utf8")), dataset);
    match(first.manifest.datasetVersion, /characters-v1:parser-1\.3\.0/);
  });
});

function state(states: CharacterStateAnalysis[], stateKey: string): CharacterStateAnalysis {
  const found = states.find(item => item.stateKey === stateKey);
  ok(found, `Missing fixture state ${stateKey}`);
  return found;
}

function flattenPredicates(condition: ConditionExpression): PassivePredicate[] {
  if (condition.op === "predicate") {
    return [condition.predicate];
  }
  if (condition.op === "all" || condition.op === "any") {
    return condition.children.flatMap(flattenPredicates);
  }
  if (condition.op === "not") {
    return flattenPredicates(condition.child);
  }
  return [];
}

function conditionShape(condition: ConditionExpression): GoldenConditionShape {
  if (condition.op === "always") {
    return { op: "always" };
  }
  if (condition.op === "unknown") {
    return { op: "unknown", sourceText: condition.sourceText };
  }
  if (condition.op === "not") {
    return { op: "not", child: conditionShape(condition.child) };
  }
  if (condition.op === "all" || condition.op === "any") {
    return { op: condition.op, children: condition.children.map(conditionShape) };
  }
  const predicate = condition.predicate;
  return {
    op: "predicate",
    kind: predicate.kind,
    scope: predicate.scope,
    ...(predicate.selfInclusion ? { selfInclusion: predicate.selfInclusion } : {}),
    ...(predicate.comparator ? { comparator: predicate.comparator } : {}),
    ...(predicate.value !== undefined ? { value: predicate.value } : {}),
    ...(predicate.maxValue !== undefined ? { maxValue: predicate.maxValue } : {}),
    ...(predicate.count !== undefined ? { count: predicate.count } : {}),
    ...(predicate.categories ? { categories: predicate.categories } : {}),
    ...(predicate.names ? { names: predicate.names } : {}),
    ...(predicate.classes ? { classes: predicate.classes } : {}),
    ...(predicate.types ? { types: predicate.types } : {}),
    ...(predicate.slots ? { slots: predicate.slots } : {}),
    ...(predicate.evaluationMoment ? { evaluationMoment: predicate.evaluationMoment } : {}),
  };
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function uniqueFragments(fragments: Array<{ lineIndex: number; text: string; start?: number; end?: number }>) {
  const seen = new Set<string>();
  return fragments.filter(fragment => {
    const key = `${fragment.lineIndex}:${fragment.start}:${fragment.end}:${fragment.text}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  }).sort((left, right) => left.lineIndex - right.lineIndex || (left.start ?? 0) - (right.start ?? 0));
}
