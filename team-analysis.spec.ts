import { deepEqual, equal, match, ok } from "assert";
import { existsSync, readFileSync } from "fs";
import { describe, it } from "mocha";
import { resolve } from "path";
import { gunzipSync } from "zlib";
import { Character } from "./character";
import { FyiCharacterCatalogEntry } from "./fyi-character-catalog";
import {
  assertValidTeamAnalysisDataset,
  buildTeamAnalysisCoverageReport,
  buildTeamAnalysisDataset,
  CharacterStateAnalysis,
  parsePassive,
  validateTeamAnalysisDataset,
} from "./team-analysis";
import {
  buildTeamAnalysisArtifact,
  validateTeamAnalysisArtifact,
} from "./team-analysis-artifacts";

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

const fixtureRelativePath = "fixtures/team-analysis/foundation-golden.json";
const sourceFixturePath = resolve(__dirname, fixtureRelativePath);
const fixturePath = existsSync(sourceFixturePath)
  ? sourceFixturePath
  : resolve(__dirname, "..", fixtureRelativePath);
const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as FoundationFixture;

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
    equal(passive.rules[0].effects[0].kind, "ki");
    equal(passive.rules[1].condition.op, "unknown");
    equal(passive.rules[1].effects[0].kind, "unknown");
    equal(passive.rules[2].condition.op, "unknown");
    equal(passive.rules[2].effects[0].kind, "unknown");
    deepEqual(passive.unparsedFragments.map(fragment => fragment.text), [
      "performs a mysterious action",
      "When attacking",
      "ATK 100%",
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

describe("team-analysis validation and artifacts", function () {
  it("reports coverage by passive/rule status and supported effect", () => {
    const dataset = buildTeamAnalysisDataset(fixture.characters, fixture.catalogEntries, options);
    const coverage = buildTeamAnalysisCoverageReport(dataset);

    deepEqual(coverage.passiveStatusCounts, { supported: 10, partial: 1, unknown: 2 });
    equal(coverage.identity.variantGroupOmittedStateCount, 2);
    ok(coverage.ruleStatusCounts.supported > 0);
    ok(coverage.ruleStatusCounts.unknown > 0);
    ok(coverage.supportedEffectCounts.atk > 0);
    ok(coverage.unknownFragmentCount > 0);
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
    match(first.manifest.datasetVersion, /characters-v1:parser-1\.0\.0/);
  });
});

function state(states: CharacterStateAnalysis[], stateKey: string): CharacterStateAnalysis {
  const found = states.find(item => item.stateKey === stateKey);
  ok(found, `Missing fixture state ${stateKey}`);
  return found;
}
