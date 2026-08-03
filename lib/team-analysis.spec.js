"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const fs_1 = require("fs");
const mocha_1 = require("mocha");
const path_1 = require("path");
const zlib_1 = require("zlib");
const team_analysis_1 = require("./team-analysis");
const team_analysis_artifacts_1 = require("./team-analysis-artifacts");
const fixtureRelativePath = "fixtures/team-analysis/foundation-golden.json";
const sourceFixturePath = (0, path_1.resolve)(__dirname, fixtureRelativePath);
const fixturePath = (0, fs_1.existsSync)(sourceFixturePath)
    ? sourceFixturePath
    : (0, path_1.resolve)(__dirname, "..", fixtureRelativePath);
const fixture = JSON.parse((0, fs_1.readFileSync)(fixturePath, "utf8"));
const options = {
    generatedAt: "2026-08-03T12:00:00.000Z",
    sourceCharacterDatasetVersion: "characters-v1",
    sourceCharacterPayloadSha256: "a".repeat(64),
};
(0, mocha_1.describe)("team-analysis foundation identities", function () {
    (0, mocha_1.it)("matches the golden identities for base, transformed, exchange, standby, EZA, and SEZA states", () => {
        const before = JSON.stringify(fixture.characters);
        const dataset = (0, team_analysis_1.buildTeamAnalysisDataset)(fixture.characters, fixture.catalogEntries, options);
        const actual = JSON.parse(JSON.stringify(dataset.states.map(state => ({
            stateKey: state.stateKey,
            hardDuplicateGroupId: state.hardDuplicateGroupId,
            variantGroupId: state.variantGroupId,
            awakeningFamilyId: state.awakeningFamilyId,
            parseStatus: state.passive?.parseStatus,
        }))));
        (0, assert_1.deepEqual)(actual, fixture.expectedStates);
        (0, assert_1.equal)(JSON.stringify(fixture.characters), before, "generation must not mutate passive text or PassiveDetails");
        (0, team_analysis_1.assertValidTeamAnalysisDataset)(dataset, fixture.characters, fixture.catalogEntries);
    });
    (0, mocha_1.it)("keeps every form of a recruitable card in one hard group but distinct cards in separate hard groups", () => {
        const states = (0, team_analysis_1.buildTeamAnalysisDataset)(fixture.characters, fixture.catalogEntries, options).states;
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
        (0, assert_1.equal)(root.hardDuplicateGroupId, transformed.hardDuplicateGroupId);
        (0, assert_1.equal)(exchangeRoot.hardDuplicateGroupId, exchangeForm.hardDuplicateGroupId);
        (0, assert_1.equal)(standbyRoot.hardDuplicateGroupId, standbyForm.hardDuplicateGroupId);
        (0, assert_1.equal)(ezaInitial.hardDuplicateGroupId, eza.hardDuplicateGroupId);
        (0, assert_1.equal)(sezaInitial.hardDuplicateGroupId, sezaEza.hardDuplicateGroupId);
        (0, assert_1.equal)(sezaEza.hardDuplicateGroupId, seza.hardDuplicateGroupId);
        (0, assert_1.equal)(variantOne.variantGroupId, variantTwo.variantGroupId);
        (0, assert_1.ok)(variantOne.hardDuplicateGroupId !== variantTwo.hardDuplicateGroupId);
    });
    (0, mocha_1.it)("omits variant groups when canonical source identity is absent, even for equal display names", () => {
        const states = (0, team_analysis_1.buildTeamAnalysisDataset)(fixture.characters, fixture.catalogEntries, options).states;
        const first = state(states, "1007001:1007001:initial");
        const second = state(states, "1007002:1007002:initial");
        (0, assert_1.equal)(first.displayName, second.displayName);
        (0, assert_1.equal)(first.variantGroupId, undefined);
        (0, assert_1.equal)(second.variantGroupId, undefined);
        (0, assert_1.ok)(first.hardDuplicateGroupId !== second.hardDuplicateGroupId);
    });
});
(0, mocha_1.describe)("team-analysis passive foundation", function () {
    (0, mocha_1.it)("parses only recognized unconditional effects as always", () => {
        const passive = (0, team_analysis_1.parsePassive)("100:100:initial", "Simple passive", "Basic effect(s)\n- Ki +3\n- ATK & DEF 120%\n- Guards all attacks");
        (0, assert_1.equal)(passive.parseStatus, "supported");
        (0, assert_1.deepEqual)(passive.rules.map(rule => rule.condition), [
            { op: "always" },
            { op: "always" },
            { op: "always" },
        ]);
        (0, assert_1.deepEqual)(passive.rules.flatMap(rule => rule.effects.map(effect => effect.kind)), [
            "ki", "atk", "def", "guard",
        ]);
        (0, assert_1.deepEqual)(passive.unparsedFragments, []);
    });
    (0, mocha_1.it)("keeps unsupported clauses explicit and never coerces them to always", () => {
        const passive = (0, team_analysis_1.parsePassive)("101:101:initial", undefined, "Basic effect(s)\n- Ki +3; performs a mysterious action\nWhen attacking\n- ATK 100%");
        (0, assert_1.equal)(passive.parseStatus, "partial");
        (0, assert_1.equal)(passive.rules[0].condition.op, "always");
        (0, assert_1.equal)(passive.rules[0].effects[0].kind, "ki");
        (0, assert_1.equal)(passive.rules[1].condition.op, "unknown");
        (0, assert_1.equal)(passive.rules[1].effects[0].kind, "unknown");
        (0, assert_1.equal)(passive.rules[2].condition.op, "unknown");
        (0, assert_1.equal)(passive.rules[2].effects[0].kind, "unknown");
        (0, assert_1.deepEqual)(passive.unparsedFragments.map(fragment => fragment.text), [
            "performs a mysterious action",
            "When attacking",
            "ATK 100%",
        ]);
    });
    (0, mocha_1.it)("keeps source fragments ordered and pointing to exact raw text", () => {
        const rawText = "Basic effect(s)\n- Ki +3; unknown tail";
        const passive = (0, team_analysis_1.parsePassive)("102:102:initial", undefined, rawText);
        const lines = rawText.split("\n");
        for (const rule of passive.rules) {
            for (const fragment of rule.source) {
                (0, assert_1.equal)(lines[fragment.lineIndex].slice(fragment.start, fragment.end), fragment.text);
            }
        }
        for (const fragment of passive.unparsedFragments) {
            (0, assert_1.equal)(lines[fragment.lineIndex].slice(fragment.start, fragment.end), fragment.text);
        }
    });
});
(0, mocha_1.describe)("team-analysis validation and artifacts", function () {
    (0, mocha_1.it)("reports coverage by passive/rule status and supported effect", () => {
        const dataset = (0, team_analysis_1.buildTeamAnalysisDataset)(fixture.characters, fixture.catalogEntries, options);
        const coverage = (0, team_analysis_1.buildTeamAnalysisCoverageReport)(dataset);
        (0, assert_1.deepEqual)(coverage.passiveStatusCounts, { supported: 10, partial: 1, unknown: 2 });
        (0, assert_1.equal)(coverage.identity.variantGroupOmittedStateCount, 2);
        (0, assert_1.ok)(coverage.ruleStatusCounts.supported > 0);
        (0, assert_1.ok)(coverage.ruleStatusCounts.unknown > 0);
        (0, assert_1.ok)(coverage.supportedEffectCounts.atk > 0);
        (0, assert_1.ok)(coverage.unknownFragmentCount > 0);
    });
    (0, mocha_1.it)("detects duplicate keys, broken references, unstable IDs, and invalid fragments", () => {
        const dataset = (0, team_analysis_1.buildTeamAnalysisDataset)(fixture.characters, fixture.catalogEntries, options);
        const broken = JSON.parse(JSON.stringify(dataset));
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
        const issues = (0, team_analysis_1.validateTeamAnalysisDataset)(broken, fixture.characters, fixture.catalogEntries);
        const codes = issues.map(issue => issue.code);
        (0, assert_1.ok)(codes.includes("duplicate-state-key"));
        (0, assert_1.ok)(codes.includes("missing-reference"));
        (0, assert_1.ok)(codes.includes("unstable-identity"));
        (0, assert_1.ok)(codes.includes("fragment-text"));
        (0, assert_1.ok)(codes.includes("passive-text-source"));
        (0, assert_1.ok)(codes.includes("duplicate-rule-id"));
    });
    (0, mocha_1.it)("produces byte-stable gzip output and an exact character compatibility manifest", () => {
        const dataset = (0, team_analysis_1.buildTeamAnalysisDataset)(fixture.characters, fixture.catalogEntries, options);
        const first = (0, team_analysis_artifacts_1.buildTeamAnalysisArtifact)(dataset);
        const second = (0, team_analysis_artifacts_1.buildTeamAnalysisArtifact)(dataset);
        (0, assert_1.equal)(first.jsonText, second.jsonText);
        (0, assert_1.equal)(first.gzipBuffer.equals(second.gzipBuffer), true);
        (0, assert_1.equal)(first.manifest.sha256, second.manifest.sha256);
        (0, assert_1.equal)(first.manifest.sourceCharacterDatasetVersion, options.sourceCharacterDatasetVersion);
        (0, assert_1.equal)(first.manifest.sourceCharacterPayloadSha256, options.sourceCharacterPayloadSha256);
        (0, assert_1.equal)(first.manifest.stateCount, dataset.stateCount);
        (0, assert_1.deepEqual)((0, team_analysis_artifacts_1.validateTeamAnalysisArtifact)(first, dataset), []);
        (0, assert_1.deepEqual)(JSON.parse((0, zlib_1.gunzipSync)(first.gzipBuffer).toString("utf8")), dataset);
        (0, assert_1.match)(first.manifest.datasetVersion, /characters-v1:parser-1\.0\.0/);
    });
});
function state(states, stateKey) {
    const found = states.find(item => item.stateKey === stateKey);
    (0, assert_1.ok)(found, `Missing fixture state ${stateKey}`);
    return found;
}
//# sourceMappingURL=team-analysis.spec.js.map