"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const mocha_1 = require("mocha");
const path_1 = require("path");
const zlib_1 = require("zlib");
const team_analysis_1 = require("./team-analysis");
const team_analysis_artifacts_1 = require("./team-analysis-artifacts");
const team_analysis_chance_lexicon_1 = require("./team-analysis-chance-lexicon");
const team_analysis_first_party_probabilities_1 = require("./team-analysis-first-party-probabilities");
const game_db_source_1 = require("./game-db/game-db-source");
const fyi_scraper_1 = require("./fyi-scraper");
const fixtureRelativePath = "fixtures/team-analysis/foundation-golden.json";
const sourceFixturePath = (0, path_1.resolve)(__dirname, fixtureRelativePath);
const fixturePath = (0, fs_1.existsSync)(sourceFixturePath)
    ? sourceFixturePath
    : (0, path_1.resolve)(__dirname, "..", fixtureRelativePath);
const fixture = JSON.parse((0, fs_1.readFileSync)(fixturePath, "utf8"));
const gateA1RelativePath = "fixtures/team-analysis/gate-a1-golden.json";
const sourceGateA1Path = (0, path_1.resolve)(__dirname, gateA1RelativePath);
const gateA1Path = (0, fs_1.existsSync)(sourceGateA1Path)
    ? sourceGateA1Path
    : (0, path_1.resolve)(__dirname, "..", gateA1RelativePath);
const gateA1Fixture = JSON.parse((0, fs_1.readFileSync)(gateA1Path, "utf8"));
const gateA11RelativePath = "fixtures/team-analysis/gate-a11-golden.json";
const sourceGateA11Path = (0, path_1.resolve)(__dirname, gateA11RelativePath);
const gateA11Path = (0, fs_1.existsSync)(sourceGateA11Path)
    ? sourceGateA11Path
    : (0, path_1.resolve)(__dirname, "..", gateA11RelativePath);
const gateA11Fixture = JSON.parse((0, fs_1.readFileSync)(gateA11Path, "utf8"));
const gateA2RelativePath = "fixtures/team-analysis/gate-a2-golden.json";
const sourceGateA2Path = (0, path_1.resolve)(__dirname, gateA2RelativePath);
const gateA2Path = (0, fs_1.existsSync)(sourceGateA2Path)
    ? sourceGateA2Path
    : (0, path_1.resolve)(__dirname, "..", gateA2RelativePath);
const gateA2Fixture = JSON.parse((0, fs_1.readFileSync)(gateA2Path, "utf8"));
const gateA3RelativePath = "fixtures/team-analysis/gate-a3-golden.json";
const sourceGateA3Path = (0, path_1.resolve)(__dirname, gateA3RelativePath);
const gateA3Path = (0, fs_1.existsSync)(sourceGateA3Path)
    ? sourceGateA3Path
    : (0, path_1.resolve)(__dirname, "..", gateA3RelativePath);
const gateA3Fixture = JSON.parse((0, fs_1.readFileSync)(gateA3Path, "utf8"));
const gateA4RelativePath = "fixtures/team-analysis/gate-a4-golden.json";
const sourceGateA4Path = (0, path_1.resolve)(__dirname, gateA4RelativePath);
const gateA4Path = (0, fs_1.existsSync)(sourceGateA4Path)
    ? sourceGateA4Path
    : (0, path_1.resolve)(__dirname, "..", gateA4RelativePath);
const gateA4Fixture = JSON.parse((0, fs_1.readFileSync)(gateA4Path, "utf8"));
const gateA41RelativePath = "fixtures/team-analysis/gate-a41-golden.json";
const sourceGateA41Path = (0, path_1.resolve)(__dirname, gateA41RelativePath);
const gateA41Path = (0, fs_1.existsSync)(sourceGateA41Path)
    ? sourceGateA41Path
    : (0, path_1.resolve)(__dirname, "..", gateA41RelativePath);
const gateA41Fixture = JSON.parse((0, fs_1.readFileSync)(gateA41Path, "utf8"));
const gateA5RelativePath = "fixtures/team-analysis/gate-a5-golden.json";
const sourceGateA5Path = (0, path_1.resolve)(__dirname, gateA5RelativePath);
const gateA5Path = (0, fs_1.existsSync)(sourceGateA5Path)
    ? sourceGateA5Path
    : (0, path_1.resolve)(__dirname, "..", gateA5RelativePath);
const gateA5Fixture = JSON.parse((0, fs_1.readFileSync)(gateA5Path, "utf8"));
const gateA51RelativePath = "fixtures/team-analysis/gate-a51-golden.json";
const sourceGateA51Path = (0, path_1.resolve)(__dirname, gateA51RelativePath);
const gateA51Path = (0, fs_1.existsSync)(sourceGateA51Path)
    ? sourceGateA51Path
    : (0, path_1.resolve)(__dirname, "..", gateA51RelativePath);
const gateA51Fixture = JSON.parse((0, fs_1.readFileSync)(gateA51Path, "utf8"));
const gateA6RelativePath = "fixtures/team-analysis/gate-a6-golden.json";
const sourceGateA6Path = (0, path_1.resolve)(__dirname, gateA6RelativePath);
const gateA6Path = (0, fs_1.existsSync)(sourceGateA6Path)
    ? sourceGateA6Path
    : (0, path_1.resolve)(__dirname, "..", gateA6RelativePath);
const gateA6Fixture = JSON.parse((0, fs_1.readFileSync)(gateA6Path, "utf8"));
const gateA7RelativePath = "fixtures/team-analysis/gate-a7-golden.json";
const sourceGateA7Path = (0, path_1.resolve)(__dirname, gateA7RelativePath);
const gateA7Path = (0, fs_1.existsSync)(sourceGateA7Path)
    ? sourceGateA7Path
    : (0, path_1.resolve)(__dirname, "..", gateA7RelativePath);
const gateA7Fixture = JSON.parse((0, fs_1.readFileSync)(gateA7Path, "utf8"));
const gateA71RelativePath = "fixtures/team-analysis/gate-a71-golden.json";
const sourceGateA71Path = (0, path_1.resolve)(__dirname, gateA71RelativePath);
const gateA71Path = (0, fs_1.existsSync)(sourceGateA71Path)
    ? sourceGateA71Path
    : (0, path_1.resolve)(__dirname, "..", gateA71RelativePath);
const gateA71Fixture = JSON.parse((0, fs_1.readFileSync)(gateA71Path, "utf8"));
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
        const passive = (0, team_analysis_1.parsePassive)("101:101:initial", undefined, "Basic effect(s)\n- Ki +3; performs a mysterious action\nWhen the moon is blue\n- ATK 100%");
        (0, assert_1.equal)(passive.parseStatus, "partial");
        (0, assert_1.equal)(passive.rules[0].condition.op, "always");
        (0, assert_1.equal)(passive.rules[0].conditionStatus, "supported");
        (0, assert_1.equal)(passive.rules[0].effectStatus, "partial");
        (0, assert_1.deepEqual)(passive.rules[0].effects.map(effect => effect.kind), ["ki", "unknown"]);
        (0, assert_1.equal)(passive.rules[0].effects[1].sourceText, "performs a mysterious action");
        (0, assert_1.equal)(passive.rules[1].condition.op, "unknown");
        (0, assert_1.equal)(passive.rules[1].conditionStatus, "unknown");
        (0, assert_1.equal)(passive.rules[1].effectStatus, "supported");
        (0, assert_1.equal)(passive.rules[1].effects[0].kind, "atk");
        (0, assert_1.deepEqual)(passive.unparsedFragments.map(fragment => fragment.text), [
            "- Ki +3; performs a mysterious action",
            "When the moon is blue",
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
(0, mocha_1.describe)("team-analysis Gate A1 passive parser", function () {
    for (const fixtureCase of gateA1Fixture.cases) {
        (0, mocha_1.it)(`matches golden case: ${fixtureCase.name}`, () => {
            const passive = (0, team_analysis_1.parsePassive)(`gate-a1:${fixtureCase.name}:initial`, fixtureCase.name, fixtureCase.rawText, fixtureCase.passiveDetails);
            const rule = passive.rules[0];
            const predicates = flattenPredicates(rule.condition);
            const categories = unique([
                ...predicates.flatMap(predicate => predicate.categories ?? []),
                ...rule.effects.flatMap(effect => effect.categories ?? []),
            ]);
            (0, assert_1.equal)(passive.parseStatus, fixtureCase.expected.parseStatus);
            (0, assert_1.equal)(rule.conditionStatus, fixtureCase.expected.conditionStatus);
            (0, assert_1.equal)(rule.effectStatus, fixtureCase.expected.effectStatus);
            (0, assert_1.equal)(rule.condition.op, fixtureCase.expected.conditionOp);
            (0, assert_1.deepEqual)(predicates.map(predicate => predicate.kind), fixtureCase.expected.predicateKinds);
            (0, assert_1.deepEqual)(predicates.map(predicate => predicate.scope), fixtureCase.expected.scopes);
            (0, assert_1.deepEqual)(predicates.map(predicate => predicate.selfInclusion).filter(value => value !== undefined), fixtureCase.expected.selfInclusions);
            (0, assert_1.deepEqual)(unique(predicates.flatMap(predicate => predicate.names ?? [])), fixtureCase.expected.names ?? []);
            (0, assert_1.deepEqual)(categories, fixtureCase.expected.categories ?? []);
            (0, assert_1.deepEqual)(predicates.flatMap(predicate => predicate.count ?? []), fixtureCase.expected.counts ?? []);
            (0, assert_1.deepEqual)(rule.effects.map(effect => effect.kind), fixtureCase.expected.effectKinds);
            for (const effect of rule.effects) {
                (0, assert_1.equal)(effect.target.scope, fixtureCase.expected.effectTarget);
            }
            if (fixtureCase.expected.effectSelfInclusion) {
                (0, assert_1.equal)(rule.effects[0].target.selfInclusion, fixtureCase.expected.effectSelfInclusion);
            }
            for (const effect of rule.effects.filter(effect => effect.kind !== "unknown"
                && ["rotation_allies", "team_allies", "category_allies", "class_allies", "type_allies", "class_type_allies"]
                    .includes(effect.target.scope))) {
                (0, assert_1.deepEqual)(effect.classifications, ["support"]);
            }
        });
    }
    (0, mocha_1.it)("retains exact values for typed ally chance and defensive effects", () => {
        const expectedEffects = [
            { caseName: "known condition fully typed effect", kind: "critical_chance", value: 20, unit: "percent", chancePercent: 20 },
            { caseName: "allies dodge chance", kind: "evade_chance", value: 5, unit: "percent", chancePercent: 5 },
            { caseName: "allies damage reduction", kind: "damage_reduction", value: 11, unit: "percent", chancePercent: undefined },
            { caseName: "allies guard", kind: "guard", value: 1, unit: "boolean", chancePercent: undefined },
        ];
        for (const expected of expectedEffects) {
            const fixtureCase = gateA1Fixture.cases.find(item => item.name === expected.caseName);
            (0, assert_1.ok)(fixtureCase);
            const passive = (0, team_analysis_1.parsePassive)("gate-a1:typed-allies:initial", undefined, fixtureCase.rawText);
            const effect = passive.rules[0].effects.find(item => item.kind === expected.kind);
            (0, assert_1.ok)(effect, expected.caseName);
            (0, assert_1.equal)(effect.value, expected.value);
            (0, assert_1.equal)(effect.unit, expected.unit);
            (0, assert_1.equal)(effect.chancePercent, expected.chancePercent);
            (0, assert_1.equal)(effect.target.selfInclusion, "included");
            (0, assert_1.deepEqual)(effect.classifications, ["support"]);
        }
    });
    (0, mocha_1.it)("preserves only an unrecognized qualifier and marks unqualified probabilities unresolved", () => {
        const qualifiedCase = gateA1Fixture.cases.find(item => item.name === "known effect with unknown qualifier");
        const qualitativeCase = gateA1Fixture.cases.find(item => item.name === "unqualified chance remains unresolved");
        (0, assert_1.ok)(qualifiedCase);
        (0, assert_1.ok)(qualitativeCase);
        const qualified = (0, team_analysis_1.parsePassive)("gate-a1:qualifier:initial", undefined, qualifiedCase.rawText);
        const qualitative = (0, team_analysis_1.parsePassive)("gate-a1:qualitative:initial", undefined, qualitativeCase.rawText);
        const wrapped = (0, team_analysis_1.parsePassive)("gate-a1:wrapped-atom:initial", undefined, "Basic effect(s)\n- Receives an additional Ki +1 per Ki Sphere obtained");
        (0, assert_1.deepEqual)(qualified.rules[0].effects.map(effect => effect.sourceText), [
            "chance of performing a critical hit 10%",
            "while celebrating",
        ]);
        (0, assert_1.deepEqual)(qualified.rules[0].effects[0].duration, { kind: "turns", turns: 2 });
        (0, assert_1.equal)(qualitative.rules[0].effects[0].kind, "critical_chance");
        (0, assert_1.equal)(qualitative.rules[0].effects[0].value, undefined);
        (0, assert_1.equal)(qualitative.rules[0].effects[0].chancePercent, undefined);
        (0, assert_1.equal)(qualitative.rules[0].effects[0].probabilitySource, "unresolved");
        (0, assert_1.deepEqual)(wrapped.rules[0].effects.map(effect => effect.sourceText), [
            "Receives an additional Ki +1",
        ]);
        (0, assert_1.deepEqual)(wrapped.rules[0].effects[0].scaling, {
            kind: "per_ki_sphere",
            kiSphereTypes: ["any"],
            spheresPerIncrement: 1,
            kiContext: "collected_ki_spheres",
        });
    });
    (0, mocha_1.it)("parses Class ally prefixes without assigning them to self", () => {
        const passive = (0, team_analysis_1.parsePassive)("gate-a1:future-target:initial", undefined, "Basic effect(s)\n- Super Class allies' ATK 30%");
        (0, assert_1.equal)(passive.rules[0].parseStatus, "supported");
        (0, assert_1.equal)(passive.rules[0].effects[0].kind, "atk");
        (0, assert_1.equal)(passive.rules[0].effects[0].target.scope, "class_allies");
        (0, assert_1.equal)(passive.rules[0].effects[0].target.selfInclusion, "included");
        (0, assert_1.deepEqual)(passive.rules[0].effects[0].classes, ["Super"]);
        (0, assert_1.deepEqual)(passive.rules[0].effects[0].classifications, ["support"]);
    });
    (0, mocha_1.it)("maps wrapped PassiveDetails lines and sections to exact raw offsets", () => {
        const fixtureCase = gateA1Fixture.cases.find(item => item.name === "another category ally on team");
        (0, assert_1.ok)(fixtureCase?.passiveDetails);
        const sourceMap = (0, team_analysis_1.mapPassiveDetailsToSource)(fixtureCase.rawText, fixtureCase.passiveDetails);
        (0, assert_1.equal)(sourceMap.unmappedTexts.length, 0);
        (0, assert_1.equal)(sourceMap.lines[0].mapped, true);
        (0, assert_1.deepEqual)(sourceMap.lines[0].source.map(fragment => fragment.lineIndex), [0, 1]);
        (0, assert_1.equal)(sourceMap.sections[0].label?.mapped, true);
        (0, assert_1.deepEqual)(sourceMap.sections[0].label?.source.map(fragment => fragment.lineIndex), [0, 1]);
        for (const mappedText of [...sourceMap.lines, ...sourceMap.sections.flatMap(section => [
                ...(section.label ? [section.label] : []),
                ...section.lines,
            ])]) {
            for (const fragment of mappedText.source) {
                const rawLine = fixtureCase.rawText.split("\n")[fragment.lineIndex];
                (0, assert_1.equal)(rawLine.slice(fragment.start, fragment.end), fragment.text);
            }
        }
    });
    (0, mocha_1.it)("preserves a lowercase effect continuation from structured sections for character 1029471", () => {
        const sampleRelativePath = "docs/specs/examples/dokkan-fyi-character-sample.json";
        const sourceSamplePath = (0, path_1.resolve)(__dirname, sampleRelativePath);
        const samplePath = (0, fs_1.existsSync)(sourceSamplePath)
            ? sourceSamplePath
            : (0, path_1.resolve)(__dirname, "..", sampleRelativePath);
        const sample = JSON.parse((0, fs_1.readFileSync)(samplePath, "utf8"));
        const character = sample.characters.find(item => item.id === "1029471");
        (0, assert_1.ok)(character?.passiveDetails?.sections);
        const passive = (0, team_analysis_1.parsePassive)("1029471:1029471:initial", character.passiveDetails.name, character.passive ?? "", character.passiveDetails);
        const evadeRule = passive.rules.find(rule => rule.source.some(fragment => fragment.text.includes("High chance of evading enemy's attack")));
        (0, assert_1.ok)(evadeRule);
        (0, assert_1.equal)(passive.rules.some(rule => rule.source.length === 1
            && rule.source[0].text === "when receiving an attack"), false);
        (0, assert_1.equal)(evadeRule.source.slice(-2).map((fragment, index) => index === 0
            ? fragment.text.replace(/^-\s+/, "")
            : fragment.text).join(" "), "High chance of evading enemy's attack if HP is 77% or less when receiving an attack");
        (0, assert_1.match)(JSON.stringify(evadeRule.condition), /"kind":"rotation_partner_category"/);
        (0, assert_1.match)(JSON.stringify(evadeRule.condition), /"kind":"incoming_attack"/);
        (0, assert_1.deepEqual)(evadeRule.source.slice(0, 2).map(fragment => fragment.text), [
            "When there is another \"Kamehameha\" or \"Earth-Bred",
            "Fighters\" Category ally attacking in the same turn",
        ]);
    });
    (0, mocha_1.it)("falls back to raw logical headers when a structured effect swallows the next section", () => {
        const rawText = [
            "For every attack performed",
            "- Ki +2 (up to +16)",
            "When receiving a normal attack",
            "- Counters with tremendous power",
        ].join("\n");
        const passive = (0, team_analysis_1.parsePassive)("1034341:1034341:initial", undefined, rawText, {
            text: rawText,
            sections: [{
                    label: "For every attack performed",
                    lines: [
                        "Ki +2 (up to +16) When receiving a normal attack",
                        "Counters with tremendous power",
                    ],
                }],
        });
        const kiRule = passive.rules.find(rule => rule.effects.some(effect => effect.kind === "ki"));
        const counterRule = passive.rules.find(rule => rule.effects.some(effect => effect.sourceText === "Counters with tremendous power"));
        (0, assert_1.ok)(kiRule);
        (0, assert_1.ok)(counterRule);
        (0, assert_1.equal)(kiRule.condition.op, "always");
        (0, assert_1.equal)(kiRule.effects[0].scaling?.kind, "per_combat_event");
        (0, assert_1.match)(JSON.stringify(kiRule.effects[0].scaling), /"eventType":"attack_performed"/);
        (0, assert_1.match)(JSON.stringify(counterRule.condition), /"kind":"incoming_attack"/);
        (0, assert_1.deepEqual)(kiRule.source.map(fragment => fragment.text), [
            "For every attack performed",
            "- Ki +2 (up to +16)",
        ]);
        (0, assert_1.deepEqual)(counterRule.source.map(fragment => fragment.text), [
            "When receiving a normal attack",
            "- Counters with tremendous power",
        ]);
    });
    (0, mocha_1.it)("fails closed when structured sections do not losslessly partition the passive source", () => {
        const rawText = "Basic effect(s)\n- ATK & DEF 100%\nWhen receiving an attack";
        const passive = (0, team_analysis_1.parsePassive)("gate-a1:invalid-sections:initial", undefined, rawText, {
            text: rawText,
            sections: [{ label: "Basic effect(s)", lines: ["ATK & DEF 100%", "missing effect"] }],
        });
        (0, assert_1.equal)(passive.rules.length, 1);
        (0, assert_1.equal)(passive.rules[0].parseStatus, "unknown");
        (0, assert_1.deepEqual)(passive.rules[0].source.map(fragment => fragment.text), rawText.split("\n"));
    });
    (0, mocha_1.it)("fails closed when structured entries share the same raw source line", () => {
        const rawText = "Basic effect(s) ATK & DEF 100%";
        const passiveDetails = {
            text: rawText,
            sections: [{ label: "Basic effect(s)", lines: ["ATK & DEF 100%"] }],
        };
        const sourceMap = (0, team_analysis_1.mapPassiveDetailsToSource)(rawText, passiveDetails);
        (0, assert_1.equal)(sourceMap.sections[0].label?.mapped, true);
        (0, assert_1.equal)(sourceMap.sections[0].lines[0].mapped, true);
        (0, assert_1.deepEqual)(sourceMap.sections[0].label?.source.map(fragment => fragment.lineIndex), [0]);
        (0, assert_1.deepEqual)(sourceMap.sections[0].lines[0].source.map(fragment => fragment.lineIndex), [0]);
        const passive = (0, team_analysis_1.parsePassive)("gate-a1:overlapping-sections:initial", undefined, rawText, passiveDetails);
        (0, assert_1.equal)(passive.parseStatus, "unknown");
        (0, assert_1.equal)(passive.rules.length, 1);
        (0, assert_1.equal)(passive.rules[0].parseStatus, "unknown");
        (0, assert_1.deepEqual)(passive.rules[0].source.map(fragment => fragment.text), rawText.split("\n"));
        (0, assert_1.deepEqual)(passive.unparsedFragments.map(fragment => fragment.text), rawText.split("\n"));
    });
    (0, mocha_1.it)("fails closed when structured sections are reordered relative to the raw source", () => {
        const rawText = [
            "Basic effect(s)",
            "- ATK & DEF 100%",
            "When receiving an attack",
            "- Guards all attacks",
        ].join("\n");
        const passiveDetails = {
            text: rawText,
            sections: [
                { label: "When receiving an attack", lines: ["Guards all attacks"] },
                { label: "Basic effect(s)", lines: ["ATK & DEF 100%"] },
            ],
        };
        const sourceMap = (0, team_analysis_1.mapPassiveDetailsToSource)(rawText, passiveDetails);
        (0, assert_1.equal)(sourceMap.sections[0].label?.mapped, true);
        (0, assert_1.equal)(sourceMap.sections[0].lines[0].mapped, true);
        (0, assert_1.equal)(sourceMap.sections[1].label?.mapped, false);
        (0, assert_1.equal)(sourceMap.sections[1].lines[0].mapped, false);
        const passive = (0, team_analysis_1.parsePassive)("gate-a1:reordered-sections:initial", undefined, rawText, passiveDetails);
        (0, assert_1.equal)(passive.parseStatus, "unknown");
        (0, assert_1.equal)(passive.rules.length, 1);
        (0, assert_1.equal)(passive.rules[0].parseStatus, "unknown");
        (0, assert_1.deepEqual)(passive.rules[0].source.map(fragment => fragment.text), rawText.split("\n"));
        (0, assert_1.deepEqual)(passive.unparsedFragments.map(fragment => fragment.text), rawText.split("\n"));
    });
    (0, mocha_1.it)("reconstructs every non-whitespace source token in original order", () => {
        for (const fixtureCase of gateA1Fixture.cases) {
            const passive = (0, team_analysis_1.parsePassive)("gate-a1:tokens:initial", undefined, fixtureCase.rawText, fixtureCase.passiveDetails);
            const fragments = uniqueFragments([
                ...passive.rules.flatMap(rule => rule.source),
                ...passive.unparsedFragments,
            ]);
            const reconstructed = fragments.map(fragment => fragment.text).join("\n").replace(/\s/g, "");
            (0, assert_1.equal)(reconstructed, fixtureCase.rawText.replace(/\s/g, ""), fixtureCase.name);
        }
    });
});
(0, mocha_1.describe)("team-analysis Gate A1.1 combat effects", function () {
    (0, mocha_1.it)("uses only source-validated qualitative chance values", () => {
        (0, assert_1.deepEqual)(Object.keys(team_analysis_chance_lexicon_1.TEAM_ANALYSIS_CHANCE_LEXICON), ["a chance", "medium", "high", "great"]);
        (0, assert_1.equal)((0, team_analysis_chance_lexicon_1.validatedChancePercent)("a chance", "additional_to_super"), 10);
        (0, assert_1.equal)((0, team_analysis_chance_lexicon_1.validatedChancePercent)("a chance", "critical_activation"), undefined);
        (0, assert_1.equal)((0, team_analysis_chance_lexicon_1.validatedChancePercent)("rare", "critical_activation"), undefined);
        (0, assert_1.equal)((0, team_analysis_chance_lexicon_1.validatedChancePercent)("medium", "critical_activation"), 30);
        (0, assert_1.equal)((0, team_analysis_chance_lexicon_1.validatedChancePercent)("HIGH", "evade_activation"), 50);
        (0, assert_1.equal)((0, team_analysis_chance_lexicon_1.validatedChancePercent)("great", "additional_super_activation"), 70);
        for (const entry of Object.values(team_analysis_chance_lexicon_1.TEAM_ANALYSIS_CHANCE_LEXICON)) {
            (0, assert_1.equal)(entry.origin.source, "first-party-game-db");
            if (entry.term === "a chance") {
                (0, assert_1.deepEqual)(new Set(entry.evidence.map(item => item.semantic)), new Set(["additional_to_super"]));
            }
            else {
                (0, assert_1.deepEqual)(new Set(entry.evidence.map(item => item.semantic)), new Set([
                    "critical_activation", "evade_activation", "additional_super_activation", "additional_to_super",
                ]));
            }
        }
    });
    for (const fixtureCase of gateA11Fixture.cases) {
        (0, mocha_1.it)(`matches Gate A1.1 golden case: ${fixtureCase.name}`, () => {
            const passive = (0, team_analysis_1.parsePassive)(fixtureCase.stateKey ?? `gate-a11:${fixtureCase.name}:initial`, fixtureCase.name, fixtureCase.rawText);
            const rule = passive.rules[fixtureCase.ruleIndex ?? 0];
            (0, assert_1.equal)(passive.parseStatus, fixtureCase.expected.parseStatus);
            (0, assert_1.equal)(rule.effectStatus, fixtureCase.expected.effectStatus ?? fixtureCase.expected.parseStatus);
            (0, assert_1.equal)(rule.conditionStatus, "supported");
            (0, assert_1.equal)(rule.condition.op, "always");
            (0, assert_1.equal)(rule.effects.length, fixtureCase.expected.effects.length);
            fixtureCase.expected.effects.forEach((expected, index) => {
                const effect = rule.effects[index];
                (0, assert_1.equal)(effect.kind, expected.kind);
                (0, assert_1.equal)(effect.target.scope, expected.target);
                for (const field of [
                    "value", "unit", "count", "activationChancePercent", "additionalToSuperChancePercent",
                    "chancePercent", "stackCap", "qualitativeChanceTerm", "probabilitySource",
                    "additionalToSuperQualitativeChanceTerm", "additionalToSuperProbabilitySource",
                ]) {
                    (0, assert_1.equal)(effect[field], expected[field], `${fixtureCase.name}: ${field}`);
                }
                if (expected.sourceText !== undefined) {
                    (0, assert_1.equal)(effect.sourceText, expected.sourceText, `${fixtureCase.name}: sourceText`);
                }
                (0, assert_1.equal)(effect.duration?.kind, expected.durationKind, `${fixtureCase.name}: duration kind`);
                (0, assert_1.equal)(effect.duration?.turns, expected.durationTurns, `${fixtureCase.name}: duration turns`);
                (0, assert_1.equal)(effect.target.selfInclusion, expected.selfInclusion, `${fixtureCase.name}: self inclusion`);
                (0, assert_1.deepEqual)(effect.classifications, expected.classifications, `${fixtureCase.name}: classifications`);
            });
        });
    }
    (0, mocha_1.it)("keeps activation and additional-to-Super chances semantically distinct", () => {
        const passive = (0, team_analysis_1.parsePassive)("gate-a11:distinct-chances:initial", undefined, "Basic effect(s)\n- High chance of launching an additional attack that has a medium chance of becoming a Super Attack");
        const effect = passive.rules[0].effects[0];
        (0, assert_1.equal)(effect.kind, "additional_attack");
        (0, assert_1.equal)(effect.activationChancePercent, 50);
        (0, assert_1.equal)(effect.chancePercent, 50);
        (0, assert_1.equal)(effect.additionalToSuperChancePercent, 30);
        (0, assert_1.equal)(effect.qualitativeChanceTerm, "high");
        (0, assert_1.equal)(effect.probabilitySource, "qualitative_lexicon");
        (0, assert_1.equal)(effect.additionalToSuperQualitativeChanceTerm, "medium");
        (0, assert_1.equal)(effect.additionalToSuperProbabilitySource, "qualitative_lexicon");
    });
    (0, mocha_1.it)("requires structural first-party evidence and never resolves rare by term alone", () => {
        (0, assert_1.equal)(team_analysis_first_party_probabilities_1.FIRST_PARTY_PROBABILITY_EVIDENCE.length, 10);
        const jacoText = "Basic effect(s)\n- Rare chance of stunning all enemies";
        const jaco = (0, team_analysis_first_party_probabilities_1.resolveFirstPartyProbability)("1002210:1002210:initial", jacoText, 1, "rare", "stun_activation");
        (0, assert_1.equal)(jaco?.percent, 7);
        (0, assert_1.equal)(jaco?.passiveSkillSetId, "198");
        (0, assert_1.equal)((0, team_analysis_first_party_probabilities_1.resolveFirstPartyProbability)("1002210:1002210:initial", jacoText, 1, "rare", "critical_activation"), undefined);
        (0, assert_1.equal)((0, team_analysis_first_party_probabilities_1.resolveFirstPartyProbability)("1002210:1002210:initial", `${jacoText}.`, 1, "rare", "stun_activation"), undefined);
    });
    (0, mocha_1.it)("matches every checked-in probability association to the audited first-party rows", async () => {
        const dataDir = (0, path_1.resolve)("game-db/data/game-db-acquisition/first-party/latest/data");
        const config = { sourceRoot: (0, path_1.resolve)("game-db"), dataDir };
        const [cards, sets, relations, skills] = await Promise.all([
            (0, game_db_source_1.readGameDbTable)(config, "cards"),
            (0, game_db_source_1.readGameDbTable)(config, "passive_skill_sets"),
            (0, game_db_source_1.readGameDbTable)(config, "passive_skill_set_relations"),
            (0, game_db_source_1.readGameDbTable)(config, "passive_skills"),
        ]);
        const setsById = new Map(sets.map(row => [row.id, row]));
        const skillsById = new Map(skills.map(row => [row.id, row]));
        const cardsById = new Map(cards.map(row => [row.id, row]));
        const relationKeys = new Set(relations.map(row => `${row.passive_skill_set_id}:${row.passive_skill_id}`));
        for (const evidence of team_analysis_first_party_probabilities_1.FIRST_PARTY_PROBABILITY_EVIDENCE) {
            (0, assert_1.ok)(/rare\s+chance/i.test(setsById.get(evidence.passiveSkillSetId)?.itemized_description ?? ""));
            for (const skillId of evidence.passiveSkillIds) {
                (0, assert_1.ok)(relationKeys.has(`${evidence.passiveSkillSetId}:${skillId}`));
                const skill = skillsById.get(skillId);
                (0, assert_1.equal)(Number(skill?.efficacy_type), evidence.efficacyType);
                (0, assert_1.equal)(Number(skill?.[evidence.valueField]), evidence.percent);
            }
        }
        (0, assert_1.deepEqual)(["1000140", "1002210", "1004870"].map(id => cardsById.get(id)?.passive_skill_set_id), ["141", "198", "402"]);
        (0, assert_1.deepEqual)(["141", "198", "402"].map(id => Number(skillsById.get(id)?.probability)), [100, 7, 100]);
        (0, assert_1.deepEqual)(["141", "198", "402"].map(id => Number(skillsById.get(id)?.is_once)), [1, 0, 1]);
    });
    (0, mocha_1.it)("keeps conditional dodge, critical, and additional contributions as separate rules", () => {
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
        const passive = (0, team_analysis_1.parsePassive)("gate-a11:separate-contributions:initial", undefined, rawText);
        const typed = passive.rules.flatMap(rule => rule.effects
            .filter(effect => ["evade_chance", "critical_chance", "additional_attack"].includes(effect.kind))
            .map(effect => ({ ruleId: rule.id, condition: rule.condition, effect })));
        (0, assert_1.equal)(typed.length, 6);
        (0, assert_1.equal)(new Set(typed.map(item => item.ruleId)).size, 6);
        (0, assert_1.deepEqual)(typed.filter(item => item.effect.kind === "evade_chance")
            .map(item => item.effect.activationChancePercent), [50, 20]);
        (0, assert_1.deepEqual)(typed.filter(item => item.effect.kind === "critical_chance")
            .map(item => item.effect.activationChancePercent), [30, 10]);
        (0, assert_1.deepEqual)(typed.filter(item => item.effect.kind === "additional_attack")
            .map(item => item.effect.activationChancePercent), [100, 30]);
        (0, assert_1.equal)(typed.filter(item => item.condition.op !== "always").length, 3);
    });
    (0, mocha_1.it)("preserves Gohan's base and conditional dodge contributions without summing them", () => {
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
        const passive = (0, team_analysis_1.parsePassive)("1017511:1017511:initial", undefined, rawText);
        const dodge = passive.rules.flatMap(rule => rule.effects
            .filter(effect => effect.kind === "evade_chance")
            .map(effect => ({ ruleId: rule.id, effect })));
        (0, assert_1.deepEqual)(dodge.map(item => item.effect.activationChancePercent), [15, 50, 30]);
        (0, assert_1.deepEqual)(dodge.map(item => item.effect.probabilitySource), [
            "first_party_game_db", "explicit_text", "explicit_text",
        ]);
        (0, assert_1.equal)(new Set(dodge.map(item => item.ruleId)).size, 3);
    });
    (0, mocha_1.it)("preserves explicit 7/15 percentages and never reverse-maps them to rare", () => {
        const critical = (0, team_analysis_1.parsePassive)("gate-a11:explicit-seven:initial", undefined, "Basic effect(s)\n- 7% chance of performing a critical hit").rules[0].effects[0];
        const evade = (0, team_analysis_1.parsePassive)("gate-a11:explicit-fifteen:initial", undefined, "Basic effect(s)\n- 15% chance of evading enemy's attack").rules[0].effects[0];
        (0, assert_1.equal)(critical.kind, "critical_chance");
        (0, assert_1.equal)(critical.activationChancePercent, 7);
        (0, assert_1.equal)(critical.probabilitySource, "explicit_text");
        (0, assert_1.equal)(evade.kind, "evade_chance");
        (0, assert_1.equal)(evade.activationChancePercent, 15);
        (0, assert_1.equal)(evade.probabilitySource, "explicit_text");
    });
    (0, mocha_1.it)("reconstructs every Gate A1.1 source token in original order", () => {
        for (const fixtureCase of gateA11Fixture.cases) {
            const passive = (0, team_analysis_1.parsePassive)("gate-a11:tokens:initial", undefined, fixtureCase.rawText);
            const fragments = uniqueFragments([
                ...passive.rules.flatMap(rule => rule.source),
                ...passive.unparsedFragments,
            ]);
            const reconstructed = fragments.map(fragment => fragment.text).join("\n").replace(/\s/g, "");
            (0, assert_1.equal)(reconstructed, fixtureCase.rawText.replace(/\s/g, ""), fixtureCase.name);
        }
    });
});
(0, mocha_1.describe)("team-analysis Gate A2 class, type, slot, and boolean parser", function () {
    for (const fixtureCase of gateA2Fixture.cases) {
        (0, mocha_1.it)(`matches Gate A2 golden case: ${fixtureCase.name}`, () => {
            const passive = (0, team_analysis_1.parsePassive)(`gate-a2:${fixtureCase.name}:initial`, fixtureCase.name, fixtureCase.rawText);
            const rule = passive.rules[0];
            (0, assert_1.equal)(passive.parseStatus, fixtureCase.expectedStatus);
            (0, assert_1.equal)(rule.conditionStatus, fixtureCase.conditionStatus ?? "supported");
            (0, assert_1.deepEqual)(conditionShape(rule.condition), fixtureCase.condition);
            if (fixtureCase.target) {
                const typedEffects = rule.effects.filter(effect => effect.kind !== "unknown");
                (0, assert_1.ok)(typedEffects.length > 0);
                for (const effect of typedEffects) {
                    (0, assert_1.deepEqual)({
                        scope: effect.target.scope,
                        ...(effect.target.selfInclusion ? { selfInclusion: effect.target.selfInclusion } : {}),
                        ...(effect.classes ? { classes: effect.classes } : {}),
                        ...(effect.types ? { types: effect.types } : {}),
                    }, fixtureCase.target);
                    if (["class_allies", "type_allies", "class_type_allies"].includes(effect.target.scope)) {
                        (0, assert_1.deepEqual)(effect.classifications, ["support"]);
                    }
                    else {
                        (0, assert_1.equal)(effect.classifications, undefined);
                    }
                }
            }
            (0, assert_1.equal)(rule.effects.some(effect => effect.kind === "support"), false);
        });
    }
    (0, mocha_1.it)("reconstructs every Gate A2 source token in original order", () => {
        for (const fixtureCase of gateA2Fixture.cases) {
            const passive = (0, team_analysis_1.parsePassive)("gate-a2:tokens:initial", undefined, fixtureCase.rawText);
            const fragments = uniqueFragments([
                ...passive.rules.flatMap(rule => rule.source),
                ...passive.unparsedFragments,
            ]);
            const reconstructed = fragments.map(fragment => fragment.text).join("\n").replace(/\s/g, "");
            (0, assert_1.equal)(reconstructed, fixtureCase.rawText.replace(/\s/g, ""), fixtureCase.name);
        }
    });
    (0, mocha_1.it)("preserves a resolved Class target on both typed and residual effects", () => {
        const fixtureCase = gateA2Fixture.cases.find(item => item.name === "Class target preserves residual unknown effect");
        (0, assert_1.ok)(fixtureCase);
        const passive = (0, team_analysis_1.parsePassive)("gate-a2:residual-target:initial", undefined, fixtureCase.rawText);
        const effects = passive.rules[0].effects;
        (0, assert_1.deepEqual)(effects.map(effect => effect.kind), ["atk", "unknown"]);
        for (const effect of effects) {
            (0, assert_1.equal)(effect.target.scope, "class_allies");
            (0, assert_1.equal)(effect.target.selfInclusion, "included");
            (0, assert_1.deepEqual)(effect.classes, ["Super"]);
        }
    });
});
(0, mocha_1.describe)("team-analysis Gate A3 HP and battle-time parser", function () {
    for (const fixtureCase of gateA3Fixture.cases) {
        (0, mocha_1.it)(`matches Gate A3 golden case: ${fixtureCase.name}`, () => {
            const passive = (0, team_analysis_1.parsePassive)(`gate-a3:${fixtureCase.name}:initial`, fixtureCase.name, fixtureCase.rawText);
            const rule = passive.rules[0];
            (0, assert_1.equal)(passive.parseStatus, fixtureCase.expectedStatus);
            (0, assert_1.equal)(rule.conditionStatus, fixtureCase.conditionStatus ?? "supported");
            (0, assert_1.deepEqual)(conditionShape(rule.condition), fixtureCase.condition);
            if (fixtureCase.effectDuration) {
                const typedEffect = rule.effects.find(effect => effect.kind !== "unknown");
                (0, assert_1.ok)(typedEffect);
                (0, assert_1.deepEqual)(typedEffect.duration, fixtureCase.effectDuration);
            }
            if (fixtureCase.expectNoEffectDuration) {
                (0, assert_1.equal)(rule.effects.some(effect => effect.duration !== undefined), false);
            }
        });
    }
    (0, mocha_1.it)("reconstructs every Gate A3 source token in original order", () => {
        for (const fixtureCase of gateA3Fixture.cases) {
            const passive = (0, team_analysis_1.parsePassive)("gate-a3:tokens:initial", undefined, fixtureCase.rawText);
            const fragments = uniqueFragments([
                ...passive.rules.flatMap(rule => rule.source),
                ...passive.unparsedFragments,
            ]);
            const reconstructed = fragments.map(fragment => fragment.text).join("\n").replace(/\s/g, "");
            (0, assert_1.equal)(reconstructed, fixtureCase.rawText.replace(/\s/g, ""), fixtureCase.name);
        }
    });
});
(0, mocha_1.describe)("team-analysis Gate A4 enemy scenario parser", function () {
    for (const fixtureCase of gateA4Fixture.cases) {
        (0, mocha_1.it)(`matches Gate A4 golden case: ${fixtureCase.name}`, () => {
            const passive = (0, team_analysis_1.parsePassive)(`gate-a4:${fixtureCase.name}:initial`, fixtureCase.name, fixtureCase.rawText);
            const rule = passive.rules[0];
            (0, assert_1.equal)(passive.parseStatus, fixtureCase.expectedStatus);
            (0, assert_1.equal)(rule.conditionStatus, fixtureCase.conditionStatus ?? "supported");
            (0, assert_1.deepEqual)(conditionShape(rule.condition), fixtureCase.condition);
            (0, assert_1.equal)(rule.effects.some(effect => effect.kind === "support"), false);
        });
    }
    (0, mocha_1.it)("reconstructs every Gate A4 source token in original order", () => {
        for (const fixtureCase of gateA4Fixture.cases) {
            const passive = (0, team_analysis_1.parsePassive)("gate-a4:tokens:initial", undefined, fixtureCase.rawText);
            const fragments = uniqueFragments([
                ...passive.rules.flatMap(rule => rule.source),
                ...passive.unparsedFragments,
            ]);
            const reconstructed = fragments.map(fragment => fragment.text).join("\n").replace(/\s/g, "");
            (0, assert_1.equal)(reconstructed, fixtureCase.rawText.replace(/\s/g, ""), fixtureCase.name);
        }
    });
});
(0, mocha_1.describe)("team-analysis Gate A4.1 structural enemy-status evidence", function () {
    for (const [index, fixtureCase] of gateA41Fixture.cases.entries()) {
        (0, mocha_1.it)(`matches Gate A4.1 golden case: ${fixtureCase.name}`, () => {
            const context = {
                characterId: `a41-${index}`,
                formId: `a41-${index}`,
                releaseState: "initial",
                sourceVersion: "fyi-fixture-v1",
                payloadField: "props.character.passive_skill.description",
            };
            const details = (0, fyi_scraper_1.passiveDetailsFromSkill)({
                id: 4100 + index,
                name: fixtureCase.name,
                description: fixtureCase.description,
            }, context);
            (0, assert_1.ok)(details?.text);
            const stateKey = `${context.characterId}:${context.formId}:${context.releaseState}`;
            const passive = (0, team_analysis_1.parsePassive)(stateKey, fixtureCase.name, details.text, details, context);
            const rule = passive.rules[0];
            (0, assert_1.equal)(passive.rawText, details.text);
            (0, assert_1.equal)(passive.rawText.includes("passiveImg"), false);
            (0, assert_1.equal)(passive.parseStatus, fixtureCase.expectedStatus);
            (0, assert_1.equal)(rule.conditionStatus, fixtureCase.conditionStatus ?? "supported");
            (0, assert_1.deepEqual)(conditionShape(rule.condition), fixtureCase.condition);
            (0, assert_1.equal)(passive.conditionEvidence?.[0]?.stateKey, stateKey);
            (0, assert_1.equal)(passive.conditionEvidence?.[0]?.provenance.sourceVersion, "fyi-fixture-v1");
        });
    }
    (0, mocha_1.it)("ignores evidence when hash, state, release, anchor, or order diverges", () => {
        const context = {
            characterId: "a41-validation",
            formId: "a41-validation",
            releaseState: "eza",
            sourceVersion: "fyi-fixture-v1",
            payloadField: "props.character.extreme_z_awakening.passive_skill.description",
        };
        const details = (0, fyi_scraper_1.passiveDetailsFromSkill)({
            id: 4199,
            name: "validation",
            description: "*When the target enemy is in the following status: {passiveImg:atk_down} or {passiveImg:def_down}*\n- ATK 20%",
        }, context);
        (0, assert_1.ok)(details?.text && details.conditionEvidence?.[0]);
        const stateKey = `${context.characterId}:${context.formId}:${context.releaseState}`;
        const mutations = [
            copy => { copy.conditionEvidence[0].passiveTextSha256 = "0".repeat(64); },
            copy => { copy.conditionEvidence[0].stateKey = "other:other:eza"; },
            copy => { copy.conditionEvidence[0].releaseState = "initial"; },
            copy => { copy.conditionEvidence[0].anchor.lineIndex = 99; },
            copy => { copy.conditionEvidence[0].statuses.reverse(); },
        ];
        for (const mutate of mutations) {
            const copy = JSON.parse(JSON.stringify(details));
            mutate(copy);
            const passive = (0, team_analysis_1.parsePassive)(stateKey, "validation", details.text, copy, context);
            (0, assert_1.equal)(passive.conditionEvidence, undefined);
            (0, assert_1.equal)(passive.rules[0].conditionStatus, "unknown");
        }
    });
    (0, mocha_1.it)("reconstructs enriched rawText losslessly and in source order", () => {
        for (const [index, fixtureCase] of gateA41Fixture.cases.entries()) {
            const context = {
                characterId: `a41-tokens-${index}`,
                formId: `a41-tokens-${index}`,
                releaseState: "initial",
                sourceVersion: "fyi-fixture-v1",
                payloadField: "props.character.passive_skill.description",
            };
            const details = (0, fyi_scraper_1.passiveDetailsFromSkill)({ description: fixtureCase.description }, context);
            (0, assert_1.ok)(details?.text);
            const passive = (0, team_analysis_1.parsePassive)(`${context.characterId}:${context.formId}:initial`, undefined, details.text, details, context);
            const fragments = uniqueFragments([
                ...passive.rules.flatMap(rule => rule.source),
                ...passive.unparsedFragments,
            ]);
            (0, assert_1.equal)(fragments.map(fragment => fragment.text).join("\n").replace(/\s/g, ""), details.text.replace(/\s/g, ""), fixtureCase.name);
        }
    });
    (0, mocha_1.it)("combines a first-party Ki header with its typed enemy-status alternatives", () => {
        const condition = "When attacking with 12 or more Ki if the target enemy is in the following status: , or";
        const rawText = `${condition}\n- DEF 40% and attacks effective against all Types`;
        const structuralText = "When attacking with 12 or more Ki if the target enemy is in the following status: {passiveImg:atk_down}, {passiveImg:def_down} or {passiveImg:astute}";
        const context = {
            characterId: "kyawei",
            formId: "kyawei",
            releaseState: "eza",
            passiveSkillSetId: "4216",
        };
        const details = {
            text: rawText,
            lines: rawText.split("\n"),
            sections: [{ label: condition, lines: ["DEF 40% and attacks effective against all Types"] }],
            sourceSkillId: "4216",
            conditionEvidence: [{
                    kind: "enemy_status",
                    stateKey: "kyawei:kyawei:eza",
                    characterId: "kyawei",
                    formId: "kyawei",
                    releaseState: "eza",
                    passiveSkillId: "4216",
                    passiveTextSha256: (0, crypto_1.createHash)("sha256").update(rawText, "utf8").digest("hex"),
                    anchor: { lineIndex: 0, normalizedText: condition, structuralText },
                    statuses: [
                        { order: 0, sourceToken: "atk_down", status: "atk_down", resolution: "supported" },
                        { order: 1, sourceToken: "def_down", status: "def_down", resolution: "supported" },
                        { order: 2, sourceToken: "astute", status: "super_attack_sealed", resolution: "supported" },
                    ],
                    connector: "or",
                    resolution: "supported",
                    provenance: {
                        source: "first_party_game_db",
                        sourceVersion: "1787282006",
                        payloadField: "passive_skill_sets.itemized_description",
                        markerSyntax: "passiveImg",
                    },
                }],
        };
        const passive = (0, team_analysis_1.parsePassive)("kyawei:kyawei:eza", "Keen Weapon", rawText, details, context);
        const predicates = flattenPredicates(passive.rules[0].condition);
        (0, assert_1.deepEqual)(predicates.map(predicate => predicate.kind), [
            "ki_amount",
            "enemy_status",
            "enemy_status",
            "enemy_status",
        ]);
        (0, assert_1.deepEqual)(predicates.flatMap(predicate => predicate.enemyStatuses ?? []), [
            "atk_down",
            "def_down",
            "super_attack_sealed",
        ]);
        (0, assert_1.equal)(passive.rules[0].conditionStatus, "supported");
    });
    (0, mocha_1.it)("recovers typed enemy statuses from legacy unresolved structural markers", () => {
        const details = (0, fyi_scraper_1.passiveDetailsFromSkill)({
            id: 4764,
            description: "*Basic effect(s)*\n- ATK & DEF 200%{passiveImg:up_g} when the target enemy is in the following status: {passiveImg:atk_down}, {passiveImg:def_down}, {passiveImg:stun} or {passiveImg:astute}",
        }, {
            characterId: "1032391",
            formId: "1032391",
            releaseState: "initial",
            sourceVersion: "a".repeat(32),
            payloadField: "props.character.passive_skill.description",
        });
        (0, assert_1.ok)(details?.text && details.structuralSource);
        details.conditionEvidence = undefined;
        const passive = (0, team_analysis_1.parsePassive)("1032391:1032391:initial", "Mischievous Majin", details.text, details, {
            characterId: "1032391",
            formId: "1032391",
            releaseState: "initial",
            passiveSkillSetId: "4764",
        });
        (0, assert_1.deepEqual)(passive.rules.flatMap(rule => flattenPredicates(rule.condition))
            .flatMap(predicate => predicate.enemyStatuses ?? []), ["atk_down", "def_down", "stunned", "super_attack_sealed"]);
        (0, assert_1.equal)(passive.rules.some(rule => flattenPredicates(rule.condition)
            .some(predicate => predicate.kind === "enemy_status")
            && rule.conditionStatus === "supported"), true);
    });
    (0, mocha_1.it)("splits first-party inline enemy-status requirements from their passive effects", () => {
        const rawText = [
            "Basic effect(s)",
            "- DEF 40% and attacks effective against all Types when the target enemy is in the following status: , or",
            "- All attacks become critical hits when the target enemy is in the following status:",
        ].join("\n");
        const structural = [
            "DEF 40% and attacks effective against all Types when the target enemy is in the following status: {passiveImg:atk_down}, {passiveImg:def_down} or {passiveImg:astute}",
            "All attacks become critical hits when the target enemy is in the following status: {passiveImg:stun}",
        ];
        const statusSets = [
            [
                { order: 0, sourceToken: "atk_down", status: "atk_down", resolution: "supported" },
                { order: 1, sourceToken: "def_down", status: "def_down", resolution: "supported" },
                { order: 2, sourceToken: "astute", status: "super_attack_sealed", resolution: "supported" },
            ],
            [{ order: 0, sourceToken: "stun", status: "stunned", resolution: "supported" }],
        ];
        const details = {
            text: rawText,
            lines: rawText.split("\n"),
            sections: [{
                    label: "Basic effect(s)",
                    lines: rawText.split("\n").slice(1).map(line => line.replace(/^-\s+/, "")),
                }],
            sourceSkillId: "4216",
            conditionEvidence: structural.map((structuralText, index) => ({
                kind: "enemy_status",
                stateKey: "kyawei:kyawei:eza",
                characterId: "kyawei",
                formId: "kyawei",
                releaseState: "eza",
                passiveSkillId: "4216",
                passiveTextSha256: (0, crypto_1.createHash)("sha256").update(rawText, "utf8").digest("hex"),
                anchor: {
                    lineIndex: index + 1,
                    normalizedText: rawText.split("\n")[index + 1].replace(/^-\s+/, ""),
                    structuralText,
                },
                statuses: statusSets[index],
                ...(index === 0 ? { connector: "or" } : {}),
                resolution: "supported",
                provenance: {
                    source: "first_party_game_db",
                    sourceVersion: "1787282006",
                    payloadField: "passive_skill_sets.itemized_description",
                    markerSyntax: "passiveImg",
                },
            })),
        };
        const passive = (0, team_analysis_1.parsePassive)("kyawei:kyawei:eza", "Keen Weapon", rawText, details, {
            characterId: "kyawei",
            formId: "kyawei",
            releaseState: "eza",
            passiveSkillSetId: "4216",
        });
        (0, assert_1.equal)(passive.rules.length, 2);
        (0, assert_1.equal)(passive.rules.every(rule => rule.conditionStatus === "supported"), true);
        (0, assert_1.deepEqual)(passive.rules.map(rule => flattenPredicates(rule.condition).flatMap(predicate => predicate.enemyStatuses ?? [])), [["atk_down", "def_down", "super_attack_sealed"], ["stunned"]]);
        (0, assert_1.equal)(passive.rules[0].effects.some(effect => effect.sourceText.includes("following status")), false);
        (0, assert_1.equal)(passive.rules[1].effects.some(effect => effect.sourceText.includes("following status")), false);
        (0, assert_1.deepEqual)(passive.rules[1].effects.map(effect => effect.kind).sort(), ["critical_chance"]);
    });
});
(0, mocha_1.describe)("team-analysis first-party Entrance Animation conditions", function () {
    (0, mocha_1.it)("recovers a structured effect continuation before the next real condition", () => {
        const rawText = [
            "When attacking with 12 or more Ki",
            "- ATK 100% when facing",
            "2 or more enemies, plus an additional ATK 150%",
            "As the 2nd or 3rd attacker in a turn",
            "- DEF 100%",
        ].join("\n");
        const passive = (0, team_analysis_1.parsePassive)("structured-continuation:initial", undefined, rawText, {
            text: rawText,
            sections: [
                {
                    label: "When attacking with 12 or more Ki",
                    lines: ["ATK 100% when facing"],
                },
                {
                    label: "2 or more enemies, plus an additional ATK 150%",
                    lines: [],
                },
                {
                    label: "As the 2nd or 3rd attacker in a turn",
                    lines: ["DEF 100%"],
                },
            ],
        });
        (0, assert_1.equal)(passive.rules.some(rule => rule.conditionStatus !== "supported"), false);
        (0, assert_1.equal)(passive.rules.some(rule => JSON.stringify(rule.condition).includes("2 or more enemies")), false);
        (0, assert_1.match)(JSON.stringify(passive.rules[0].effects), /"value":150/);
        (0, assert_1.match)(JSON.stringify(passive.rules[passive.rules.length - 1]?.condition), /"kind":"battle_slot"/);
    });
    (0, mocha_1.it)("types counted Category alternatives that share one team or rotation scope", () => {
        const passive = (0, team_analysis_1.parsePassive)("shared-category-alternatives:initial", undefined, [
            'Activates the Entrance Animation when there are 3 "Revenge" Category allies, 3 "GT Bosses" Category allies or 3 "Sworn Enemies" Category allies attacking in the same turn upon the character\'s entry',
            "- ATK & DEF 100%",
        ].join("\n"));
        (0, assert_1.equal)(passive.rules[0].conditionStatus, "supported");
        (0, assert_1.deepEqual)(flattenPredicates(passive.rules[0].condition).map(predicate => ({
            kind: predicate.kind,
            categories: predicate.categories,
            count: predicate.count,
            scope: predicate.scope,
        })), [
            { kind: "ally_category_present", categories: ["Revenge"], count: 3, scope: "rotation" },
            { kind: "ally_category_present", categories: ["GT Bosses"], count: 3, scope: "rotation" },
            { kind: "ally_category_present", categories: ["Sworn Enemies"], count: 3, scope: "rotation" },
        ]);
    });
    (0, mocha_1.it)("keeps Ki Sphere scaling separate from its typed rotation-partner gate", () => {
        const passive = (0, team_analysis_1.parsePassive)("conditional-sphere-scaling:initial", undefined, [
            'For every Ki Sphere obtained when there is another "Super Heroes" or "Movie Heroes" Category ally attacking in the same turn',
            "- ATK & DEF 9% when attacking",
        ].join("\n"));
        (0, assert_1.equal)(passive.rules[0].conditionStatus, "supported");
        (0, assert_1.deepEqual)(flattenPredicates(passive.rules[0].condition)
            .map(predicate => predicate.categories)
            .filter(categories => categories !== undefined), [
            ["Super Heroes"],
            ["Movie Heroes"],
        ]);
        (0, assert_1.deepEqual)(passive.rules[0].effects[0].scaling, {
            kind: "per_ki_sphere",
            kiSphereTypes: ["any"],
            spheresPerIncrement: 1,
            kiContext: "collected_ki_spheres",
        });
    });
    (0, mocha_1.it)("types per-Ki scaling while receiving an attack without treating the scale as a gate", () => {
        const passive = (0, team_analysis_1.parsePassive)("receiving-ki-scaling:initial", undefined, "For every 2 Ki when receiving an attack\n- DEF 20% and damage reduction rate 2%");
        (0, assert_1.equal)(passive.rules[0].conditionStatus, "supported");
        (0, assert_1.match)(JSON.stringify(passive.rules[0].condition), /"kind":"incoming_attack"/);
        (0, assert_1.deepEqual)(passive.rules[0].effects[0].scaling, {
            kind: "per_ki_amount",
            kiPerIncrement: 2,
            kiContext: "final_attack_ki",
            evaluationMoment: "when_targeted_by_attack",
        });
    });
    (0, mocha_1.it)("types HP, named-ally and turn requirements as one conjunction", () => {
        const passive = (0, team_analysis_1.parsePassive)("hp-named-ally:initial", undefined, 'When HP is 58% or more with an ally whose name includes "Trunks" (Kid and GT excluded) on the team starting from the 4th turn from the start of battle\n- Transforms', undefined, {
            characterId: "hp-named-ally",
            formId: "hp-named-ally",
            releaseState: "initial",
            passiveSkillSetId: "hp-named-ally",
            nameIdentityContract: {
                source: "first_party_game_db",
                bindings: [{
                        passiveSkillSetId: "hp-named-ally",
                        scope: "team",
                        count: 1,
                        identitySetId: "trunks",
                        canonicalIds: ["trunks"],
                        canonicalNames: ["Trunks"],
                    }],
            },
        });
        (0, assert_1.equal)(passive.rules[0].conditionStatus, "supported");
        (0, assert_1.deepEqual)(flattenPredicates(passive.rules[0].condition).map(predicate => predicate.kind), [
            "hp_percent",
            "ally_name_present",
            "battle_turn",
        ]);
        (0, assert_1.deepEqual)(flattenPredicates(passive.rules[0].condition)[1].excludedNames, ["Kid", "GT"]);
    });
    (0, mocha_1.it)("keeps shared Category alternatives together before applying their turn gate", () => {
        const passive = (0, team_analysis_1.parsePassive)("category-alternatives-turn:initial", undefined, [
            'When HP is 50% or less, or when there are 3 "Realm of Gods" Category allies, 3 "Universe Survival Saga" Category allies or 3 "Turtle School" Category allies attacking in the same turn starting from the 4th turn from the start of battle',
            "- Awakens",
        ].join("\n"));
        (0, assert_1.equal)(passive.rules[0].conditionStatus, "supported");
        (0, assert_1.deepEqual)(flattenPredicates(passive.rules[0].condition).map(predicate => predicate.kind), [
            "hp_percent",
            "ally_category_present",
            "ally_category_present",
            "ally_category_present",
            "battle_turn",
        ]);
    });
    (0, mocha_1.it)("types a lone enemy HP branch without losing its Category-enemy alternative", () => {
        const passive = (0, team_analysis_1.parsePassive)("single-enemy-hp:initial", undefined, 'When facing only 1 enemy and that enemy\'s HP is 58% or more, or when there is a "Majin Buu Saga" Category enemy\n- Attacks are effective against all Types');
        (0, assert_1.equal)(passive.rules[0].conditionStatus, "supported");
        (0, assert_1.deepEqual)(flattenPredicates(passive.rules[0].condition).map(predicate => ({
            kind: predicate.kind,
            enemySelection: predicate.enemySelection,
        })), [
            { kind: "enemy_count", enemySelection: undefined },
            { kind: "enemy_hp_percent", enemySelection: "only_enemy" },
            { kind: "enemy_category", enemySelection: "any_enemy" },
        ]);
    });
    (0, mocha_1.it)("types a negated other-name rotation condition with per-name exclusions", () => {
        const passive = (0, team_analysis_1.parsePassive)("negative-other-name:initial", undefined, 'When there are no other allies whose names include "Vegeta" (Jr., Baby and Duplicate excluded) attacking in the same turn\n- ATK 200%', undefined, {
            characterId: "negative-other-name",
            formId: "negative-other-name",
            releaseState: "initial",
            passiveSkillSetId: "negative-other-name",
            nameIdentityContract: {
                source: "first_party_game_db",
                bindings: [{
                        passiveSkillSetId: "negative-other-name",
                        scope: "rotation",
                        count: 1,
                        identitySetId: "vegeta",
                        canonicalIds: ["vegeta"],
                        canonicalNames: ["Vegeta"],
                    }],
            },
        });
        (0, assert_1.equal)(passive.rules[0].conditionStatus, "supported");
        (0, assert_1.equal)(passive.rules[0].condition.op, "not");
        const predicate = flattenPredicates(passive.rules[0].condition)[0];
        (0, assert_1.equal)(predicate.kind, "rotation_partner_name");
        (0, assert_1.deepEqual)(predicate.excludedNames, ["Jr.", "Baby", "Duplicate"]);
    });
    (0, mocha_1.it)("keeps received-or-evaded scaling separate from the battle-slot gate", () => {
        const passive = (0, team_analysis_1.parsePassive)("received-evaded-scaling:initial", undefined, "For every attack received or evaded as the 1st or 2nd attacker in a turn\n- ATK 20% (up to 100%)");
        (0, assert_1.equal)(passive.rules[0].conditionStatus, "supported");
        (0, assert_1.match)(JSON.stringify(passive.rules[0].condition), /"kind":"battle_slot"/);
        const scaling = passive.rules[0].effects[0].scaling;
        (0, assert_1.equal)(scaling?.kind, "per_combat_event");
        if (scaling?.kind === "per_combat_event") {
            (0, assert_1.equal)(scaling.connector, "or");
            (0, assert_1.deepEqual)(scaling.events.map(event => event.eventType), ["attack_landed", "attack_evaded"]);
        }
    });
    (0, mocha_1.it)("types the next attacking turn after a counted combat event", () => {
        const passive = (0, team_analysis_1.parsePassive)("next-turn-after-event:initial", undefined, "Starting from the character's next attacking turn after the character evades 5 or more attacks in battle\n- ATK 159%");
        (0, assert_1.equal)(passive.rules[0].conditionStatus, "supported");
        const predicate = flattenPredicates(passive.rules[0].condition)[0];
        (0, assert_1.equal)(predicate.kind, "attacks_evaded");
        (0, assert_1.equal)(predicate.value, 5);
        (0, assert_1.equal)(predicate.combatEvent?.countScope, "battle");
        (0, assert_1.equal)(predicate.combatEvent?.relativeTiming, "starting_next_attacking_turn");
    });
    (0, mocha_1.it)("keeps a next-turn combat branch separate from its delayed team alternative", () => {
        const passive = (0, team_analysis_1.parsePassive)("next-turn-team-alternative:initial", undefined, [
            'On the character\'s next attacking turn after performing 3 or more Super Attacks and receiving 5 or more attacks in battle, or when 3 or more "Movie Heroes" Category allies are on the team starting from the 5th turn from the character\'s entry turn',
            "- Receives a morale boost",
        ].join("\n"));
        (0, assert_1.equal)(passive.rules[0].conditionStatus, "supported", JSON.stringify(passive.rules[0].condition));
        (0, assert_1.deepEqual)(flattenPredicates(passive.rules[0].condition).map(predicate => predicate.kind), [
            "super_attacks_performed",
            "attacks_received",
            "ally_category_present",
            "turn_from_entry",
        ]);
    });
    (0, mocha_1.it)("distinguishes one next attacking turn from a persistent next-turn window", () => {
        const onNext = (0, team_analysis_1.parsePassive)("on-next-turn:initial", undefined, "On the character's next attacking turn\n- Transforms again");
        const startingNext = (0, team_analysis_1.parsePassive)("starting-next-turn:initial", undefined, "Starting from the next attacking turn\n- ATK 100%");
        (0, assert_1.equal)(onNext.rules[0].conditionStatus, "supported");
        (0, assert_1.equal)(startingNext.rules[0].conditionStatus, "supported");
        (0, assert_1.equal)(flattenPredicates(onNext.rules[0].condition)[0].evaluationMoment, "on_next_attacking_turn");
        (0, assert_1.equal)(flattenPredicates(startingNext.rules[0].condition)[0].evaluationMoment, "starting_next_attacking_turn");
    });
    (0, mocha_1.it)("preserves the Ki-Sphere evaluation moment on an enemy gate", () => {
        const passive = (0, team_analysis_1.parsePassive)("enemy-while-sphere:initial", undefined, 'If there is a Super Class enemy when the character obtains a Ki Sphere\n- ATK 120%');
        (0, assert_1.equal)(passive.rules[0].conditionStatus, "supported");
        const predicate = flattenPredicates(passive.rules[0].condition)[0];
        (0, assert_1.equal)(predicate.kind, "enemy_class");
        (0, assert_1.equal)(predicate.evaluationMoment, "when_obtaining_ki_sphere");
    });
    (0, mocha_1.it)("types all-rotation Ki Sphere collection and its attack-Ki conjunction", () => {
        const passive = (0, team_analysis_1.parsePassive)("rotation-spheres:initial", undefined, "If the character's Ki is 7 or more when all allies attacking in the same turn have obtained a Ki Sphere\n- ATK 100%");
        (0, assert_1.equal)(passive.rules[0].conditionStatus, "supported");
        (0, assert_1.deepEqual)(flattenPredicates(passive.rules[0].condition).map(predicate => predicate.kind), [
            "ki_amount",
            "all_rotation_allies_obtained_ki_sphere",
        ]);
    });
    (0, mocha_1.it)("types special Ki Spheres and the two residual Ki Sphere scaling modes", () => {
        const sweetTreat = (0, team_analysis_1.parsePassive)("sweet-treat:initial", undefined, "1 or more sweet treat Ki Spheres obtained\n- ATK 100%");
        const deferred = (0, team_analysis_1.parsePassive)("deferred-spheres:initial", undefined, "For every Ki Sphere obtained with 4 or more Ki Spheres obtained (count starts from the 4th Ki Sphere)\n- ATK 20%");
        const largest = (0, team_analysis_1.parsePassive)("largest-sphere-type:initial", undefined, "For every STR or Rainbow Ki Sphere obtained (whichever Ki Sphere is collected more will be counted)\n- ATK 20%");
        (0, assert_1.equal)(sweetTreat.rules[0].conditionStatus, "supported");
        (0, assert_1.deepEqual)(flattenPredicates(sweetTreat.rules[0].condition)[0].kiSphereTypes, ["sweet_treat"]);
        (0, assert_1.deepEqual)(deferred.rules[0].effects[0].scaling, {
            kind: "per_ki_sphere",
            kiSphereTypes: ["any"],
            spheresPerIncrement: 1,
            kiContext: "collected_ki_spheres",
            countStartsFrom: 4,
            selection: "all_obtained",
        });
        (0, assert_1.deepEqual)(largest.rules[0].effects[0].scaling, {
            kind: "per_ki_sphere",
            kiSphereTypes: ["STR", "rainbow"],
            spheresPerIncrement: 1,
            kiContext: "collected_ki_spheres",
            selection: "largest_type_count",
        });
    });
    (0, mocha_1.it)("keeps a standalone personality switch as an action and types the Giant Ape lifecycle flag", () => {
        const personality = (0, team_analysis_1.parsePassive)("personality-switch:initial", undefined, "Sneezes and switches personalities");
        const giant = (0, team_analysis_1.parsePassive)("giant-form-end:initial", undefined, "When Giant Ape Transformation ends\n- ATK 100%");
        (0, assert_1.equal)(personality.rules[0].conditionStatus, "supported");
        (0, assert_1.equal)(personality.rules[0].condition.op, "always");
        (0, assert_1.equal)(personality.rules[0].effectStatus, "unknown");
        (0, assert_1.equal)(giant.rules[0].conditionStatus, "supported");
        (0, assert_1.equal)(flattenPredicates(giant.rules[0].condition)[0].kind, "giant_form_ended");
    });
    (0, mocha_1.it)("binds Goku name conditions to the official canonical identity set", () => {
        const passive = (0, team_analysis_1.parsePassive)("name-identity:initial", "Official identity", [
            'When there is an ally whose name includes "Goku" (Youth, Captain Ginyu, Jr., etc. excluded) on the team',
            "- ATK & DEF 100%",
        ].join("\n"), undefined, {
            characterId: "name-identity",
            formId: "name-identity",
            releaseState: "initial",
            passiveSkillSetId: "900",
            nameIdentityContract: {
                source: "first_party_game_db",
                bindings: [{
                        passiveSkillSetId: "900",
                        scope: "team",
                        count: 1,
                        identitySetId: "13",
                        canonicalIds: ["1", "3", "66"],
                        canonicalNames: ["Goku", "Super Saiyan Goku"],
                    }],
            },
        });
        (0, assert_1.equal)(passive.rules[0].conditionStatus, "supported");
        const predicate = flattenPredicates(passive.rules[0].condition)[0];
        (0, assert_1.equal)(predicate.nameIdentitySetId, "13");
        (0, assert_1.deepEqual)(predicate.canonicalIds, ["1", "3", "66"]);
        (0, assert_1.deepEqual)(predicate.excludedNames, ["Youth", "Captain Ginyu", "Jr."]);
    });
    (0, mocha_1.it)("keeps name conditions partial without a unique official identity binding", () => {
        const passive = (0, team_analysis_1.parsePassive)("name-identity-missing:initial", undefined, 'When there is an ally whose name includes "Goku" on the team\n- ATK & DEF 100%');
        (0, assert_1.equal)(passive.rules[0].conditionStatus, "partial");
        (0, assert_1.equal)(flattenPredicates(passive.rules[0].condition)[0].nameIdentitySetId, undefined);
    });
    (0, mocha_1.it)("uses the typed includes mode to associate a shorter source name with one official set", () => {
        const passive = (0, team_analysis_1.parsePassive)("name-identity-short:initial", undefined, 'When there is another ally whose name includes "#17" attacking in the same turn\n- ATK 100%', undefined, {
            characterId: "name-identity-short",
            formId: "name-identity-short",
            releaseState: "initial",
            passiveSkillSetId: "901",
            nameIdentityContract: {
                source: "first_party_game_db",
                bindings: [{
                        passiveSkillSetId: "901",
                        scope: "rotation",
                        count: 1,
                        identitySetId: "17",
                        canonicalIds: ["170"],
                        canonicalNames: ["Android #17"],
                    }],
            },
        });
        (0, assert_1.equal)(passive.rules[0].conditionStatus, "supported");
        (0, assert_1.equal)(flattenPredicates(passive.rules[0].condition)[0].nameIdentitySetId, "17");
    });
    (0, mocha_1.it)("reconciles a DB count that includes the excluded passive owner", () => {
        const passive = (0, team_analysis_1.parsePassive)("name-identity-self-count:initial", undefined, 'When there is another ally whose name includes "#17" attacking in the same turn\n- ATK 100%', undefined, {
            characterId: "name-identity-self-count",
            formId: "name-identity-self-count",
            canonicalId: "170",
            releaseState: "initial",
            passiveSkillSetId: "902",
            nameIdentityContract: {
                source: "first_party_game_db",
                bindings: [{
                        passiveSkillSetId: "902",
                        scope: "rotation",
                        count: 2,
                        identitySetId: "60",
                        canonicalIds: ["170", "171"],
                        canonicalNames: ["Android #17", "Hell Fighter #17"],
                    }],
            },
        });
        (0, assert_1.equal)(passive.rules[0].conditionStatus, "supported");
        (0, assert_1.equal)(flattenPredicates(passive.rules[0].condition)[0].nameIdentitySetId, "60");
    });
    (0, mocha_1.it)("uses the unique official DB scope when localized name-condition scope diverges", () => {
        const passive = (0, team_analysis_1.parsePassive)("1019091:1019091:eza", "Glorious Charge", 'When there is an ally whose name includes "Bardock" on the team\n- Changes Ki Spheres: random Type to Rainbow', undefined, {
            characterId: "1019091",
            formId: "1019091",
            canonicalId: "122",
            releaseState: "eza",
            passiveSkillSetId: "2789",
            nameIdentityContract: {
                source: "first_party_game_db",
                bindings: [{
                        passiveSkillSetId: "2789",
                        scope: "rotation",
                        count: 1,
                        identitySetId: "75",
                        canonicalIds: ["4", "122", "455"],
                        canonicalNames: ["Bardock", "Super Saiyan Bardock", "Team Bardock"],
                    }],
            },
        });
        (0, assert_1.equal)(passive.rules[0].conditionStatus, "supported");
        const predicate = flattenPredicates(passive.rules[0].condition)[0];
        (0, assert_1.equal)(predicate.scope, "rotation");
        (0, assert_1.equal)(predicate.nameIdentitySetId, "75");
        (0, assert_1.deepEqual)(predicate.canonicalIds, ["4", "122", "455"]);
        (0, assert_1.equal)(predicate.sourceText, 'When there is an ally whose name includes "Bardock" on the team');
    });
    (0, mocha_1.it)("does not override localized scope when official cross-scope bindings are ambiguous", () => {
        const binding = {
            passiveSkillSetId: "ambiguous",
            count: 1,
            canonicalIds: ["4"],
            canonicalNames: ["Bardock"],
        };
        const passive = (0, team_analysis_1.parsePassive)("name-scope-ambiguous:initial", undefined, 'When there is an ally whose name includes "Bardock" on the team\n- ATK 100%', undefined, {
            characterId: "name-scope-ambiguous",
            formId: "name-scope-ambiguous",
            releaseState: "initial",
            passiveSkillSetId: "ambiguous",
            nameIdentityContract: {
                source: "first_party_game_db",
                bindings: [
                    { ...binding, scope: "rotation", identitySetId: "75" },
                    { ...binding, scope: "rotation", identitySetId: "76" },
                ],
            },
        });
        (0, assert_1.equal)(passive.rules[0].conditionStatus, "partial");
        const predicate = flattenPredicates(passive.rules[0].condition)[0];
        (0, assert_1.equal)(predicate.scope, "team");
        (0, assert_1.equal)(predicate.nameIdentitySetId, undefined);
    });
    (0, mocha_1.it)("binds a same-member category and name condition only to its type-45 category", () => {
        const passive = (0, team_analysis_1.parsePassive)("name-identity-category:initial", undefined, 'When there is a "Future Saga" Category ally whose name includes "Trunks" attacking in the same turn\n- ATK 100%', undefined, {
            characterId: "name-identity-category",
            formId: "name-identity-category",
            releaseState: "initial",
            passiveSkillSetId: "2683",
            nameIdentityContract: {
                source: "first_party_game_db",
                bindings: [{
                        passiveSkillSetId: "2683",
                        scope: "rotation",
                        count: 1,
                        identitySetId: "12",
                        canonicalIds: ["113"],
                        canonicalNames: ["Trunks (Future)"],
                        categories: ["Future Saga"],
                    }],
            },
        });
        (0, assert_1.equal)(passive.rules[0].conditionStatus, "supported");
        (0, assert_1.equal)(flattenPredicates(passive.rules[0].condition)[0].nameIdentitySetId, "12");
    });
    (0, mocha_1.it)("binds an exact name across enemy and team scopes to the narrower official set", () => {
        const broad = {
            passiveSkillSetId: "4714",
            count: 1,
            identitySetId: "13",
            canonicalIds: ["1", "3", "66", "86"],
            canonicalNames: ["Goku", "Super Saiyan Goku"],
        };
        const exact = {
            passiveSkillSetId: "4714",
            count: 1,
            identitySetId: "120",
            canonicalIds: ["3"],
            canonicalNames: ["Goku"],
        };
        const passive = (0, team_analysis_1.parsePassive)("name-identity-dual-scope:initial", undefined, [
            'Activates the Entrance Animation when there is a "World Tournament" Category enemy or another "World Tournament" Category ally on the team at the start of the character\'s attacking turn, or when "Goku" is an enemy or on the team at the start of the character\'s attacking turn',
            "- ATK 100%",
        ].join("\n"), undefined, {
            characterId: "name-identity-dual-scope",
            formId: "name-identity-dual-scope",
            releaseState: "initial",
            passiveSkillSetId: "4714",
            nameIdentityContract: {
                source: "first_party_game_db",
                bindings: [
                    { ...broad, scope: "enemy" },
                    { ...exact, scope: "enemy" },
                    { ...broad, scope: "team" },
                    { ...exact, scope: "team" },
                ],
            },
        });
        (0, assert_1.equal)(passive.rules[0].conditionStatus, "supported");
        const namePredicates = flattenPredicates(passive.rules[0].condition)
            .filter(predicate => predicate.names?.includes("Goku"));
        (0, assert_1.equal)(namePredicates.length, 2);
        (0, assert_1.deepEqual)(namePredicates.map(predicate => predicate.nameIdentitySetId), ["120", "120"]);
    });
    (0, mocha_1.it)("types another category ally on the team without consuming the entry trigger", () => {
        const rawText = [
            "Activates the Entrance Animation when there is another",
            "\"Bond of Parent and Child\" Category ally on the team",
            "upon the character's entry",
            "- Ki +24 for 1 turn",
            "- ATK & DEF 200% and guards all attacks",
        ].join("\n");
        const passive = (0, team_analysis_1.parsePassive)("1025561:1025561:eza", "Beyond Ultimate Power", rawText);
        (0, assert_1.equal)(passive.rules.length, 2);
        passive.rules.forEach(rule => {
            (0, assert_1.equal)(rule.conditionStatus, "supported");
            (0, assert_1.deepEqual)(conditionShape(rule.condition), {
                op: "predicate",
                kind: "ally_category_present",
                scope: "team",
                selfInclusion: "excluded",
                categories: ["Bond of Parent and Child"],
            });
        });
    });
    (0, mocha_1.it)("fails closed for a non-canonical Entrance Animation condition", () => {
        const passive = (0, team_analysis_1.parsePassive)("entrance:unknown:initial", undefined, "Activates the Entrance Animation under an opaque condition\n- ATK 100%");
        (0, assert_1.equal)(passive.rules[0].conditionStatus, "unknown");
    });
    (0, mocha_1.it)("types an unconditional Entrance Animation as always available", () => {
        const passive = (0, team_analysis_1.parsePassive)("1032551:1032551:initial", "Maximum-Power Super Saiyan 4", "Activates the Entrance Animation upon the character's entry\n- ATK & DEF 400%");
        (0, assert_1.equal)(passive.rules[0].conditionStatus, "supported");
        (0, assert_1.deepEqual)(passive.rules[0].condition, { op: "always" });
    });
    (0, mocha_1.it)("keeps both team alternatives under the shared Entrance Animation entry suffix", () => {
        const passive = (0, team_analysis_1.parsePassive)("1032261:1032261:initial", "New Power Awakened in the Demon Realm", [
            "Activates the Entrance Animation when there is another \"Demonic Power\" Category ally on the team or when 5 or more Super Class allies are on the team upon the character's entry",
            "- ATK & DEF 150% and launches an additional Super Attack",
        ].join("\n"));
        (0, assert_1.equal)(passive.rules[0].conditionStatus, "supported");
        (0, assert_1.deepEqual)(flattenPredicates(passive.rules[0].condition).map(predicate => ({
            kind: predicate.kind,
            categories: predicate.categories,
            classes: predicate.classes,
            count: predicate.count,
            selfInclusion: predicate.selfInclusion,
        })), [
            {
                kind: "ally_category_present",
                categories: ["Demonic Power"],
                classes: undefined,
                count: undefined,
                selfInclusion: "excluded",
            },
            {
                kind: "ally_class_present",
                categories: undefined,
                classes: ["Super"],
                count: 5,
                selfInclusion: "included",
            },
        ]);
    });
    (0, mocha_1.it)("types category ally rotation scaling separately from availability", () => {
        const passive = (0, team_analysis_1.parsePassive)("1032281:1032281:initial", "Reliable Support", [
            "Per \"Dragon Ball Seekers\" or \"Demonic Power\" Category ally attacking in the same turn (depending on which Category has more members)",
            "- ATK & DEF 100% when attacking",
            "- All allies' chance of performing a critical hit 7%",
        ].join("\n"));
        (0, assert_1.equal)(passive.rules.length, 2);
        passive.rules.forEach(rule => {
            (0, assert_1.equal)(rule.conditionStatus, "supported");
            (0, assert_1.deepEqual)(rule.effects[0].scaling, {
                kind: "per_category_ally",
                scope: "rotation",
                categories: ["Dragon Ball Seekers", "Demonic Power"],
                selfInclusion: "included",
                membersPerIncrement: 1,
                maximumCount: 3,
                selection: "largest_category_count",
            });
        });
    });
    (0, mocha_1.it)("distinguishes category-union scaling from largest-category scaling", () => {
        const union = (0, team_analysis_1.parsePassive)("category-union:initial", undefined, "Per \"Pure Saiyans\" or \"Hybrid Saiyans\" Category ally on the team (self excluded)\n- ATK & DEF 10%");
        const largest = (0, team_analysis_1.parsePassive)("category-largest:initial", undefined, "Per \"Terrifying Conquerors\" or \"Planetary Destruction\" Category ally on the team (depending on which Category has more members)\n- ATK & DEF 10%");
        (0, assert_1.deepEqual)(union.rules[0].effects[0].scaling, {
            kind: "per_category_ally",
            scope: "team",
            categories: ["Pure Saiyans", "Hybrid Saiyans"],
            selfInclusion: "excluded",
            membersPerIncrement: 1,
            maximumCount: 6,
            selection: "union_category_members",
        });
        (0, assert_1.deepEqual)(largest.rules[0].effects[0].scaling, {
            kind: "per_category_ally",
            scope: "team",
            categories: ["Terrifying Conquerors", "Planetary Destruction"],
            selfInclusion: "included",
            membersPerIncrement: 1,
            maximumCount: 7,
            selection: "largest_category_count",
        });
    });
    (0, mocha_1.it)("types class ally scaling with scope and self-inclusion capacity", () => {
        const passive = (0, team_analysis_1.parsePassive)("class-scaling:initial", "Class Potential", [
            "Per Extreme Class ally attacking in the same turn (self excluded)",
            "- ATK & DEF 60%",
        ].join("\n"));
        (0, assert_1.equal)(passive.rules.length, 1);
        (0, assert_1.equal)(passive.rules[0].conditionStatus, "supported");
        (0, assert_1.deepEqual)(passive.rules[0].condition, { op: "always" });
        passive.rules[0].effects.forEach(effect => (0, assert_1.deepEqual)(effect.scaling, {
            kind: "per_class_ally",
            scope: "rotation",
            classes: ["Extreme"],
            selfInclusion: "excluded",
            membersPerIncrement: 1,
            maximumCount: 2,
        }));
    });
    (0, mocha_1.it)("keeps an inline attack phase attached to an explicitly capped ally scaling effect", () => {
        const passive = (0, team_analysis_1.parsePassive)("class-scaling-cap:initial", "Class Potential", [
            "Per Extreme Class ally on the team",
            "- ATK & DEF 80% when attacking (up to 400%)",
        ].join("\n"));
        (0, assert_1.equal)(passive.rules.length, 1);
        (0, assert_1.equal)(passive.rules[0].parseStatus, "supported");
        passive.rules[0].effects.forEach(effect => {
            (0, assert_1.equal)(effect.stackCap, 400);
            (0, assert_1.equal)(effect.activationTiming?.moment, "when_attacking");
            (0, assert_1.deepEqual)(effect.scaling, {
                kind: "per_class_ally",
                scope: "team",
                classes: ["Extreme"],
                selfInclusion: "included",
                membersPerIncrement: 1,
                maximumCount: 7,
            });
        });
    });
    (0, mocha_1.it)("types category-and-name ally scaling as one same-member filter", () => {
        const passive = (0, team_analysis_1.parsePassive)("category-name-scaling:initial", undefined, "Per \"Future Saga\" Category ally whose name includes \"Clone\" on the team\n- ATK & DEF 30%");
        (0, assert_1.equal)(passive.rules[0].conditionStatus, "supported");
        (0, assert_1.deepEqual)(passive.rules[0].condition, { op: "always" });
        (0, assert_1.deepEqual)(passive.rules[0].effects[0].scaling, {
            kind: "per_category_name_ally",
            scope: "team",
            categories: ["Future Saga"],
            names: ["Clone"],
            selfInclusion: "included",
            membersPerIncrement: 1,
            maximumCount: 7,
        });
    });
    (0, mocha_1.it)("types name-only and category-or-class ally potential without flattening their selection", () => {
        const byName = (0, team_analysis_1.parsePassive)("name-scaling:initial", undefined, "Per ally whose name includes \"Saibaiman\" attacking in the same turn\n- ATK & DEF 30%");
        const largestDimension = (0, team_analysis_1.parsePassive)("category-class-scaling:initial", undefined, "Per Super Class ally or \"Future Saga\" Category ally on the team (depending on which has more members)\n- ATK & DEF 50%");
        (0, assert_1.deepEqual)(byName.rules[0].effects[0].scaling, {
            kind: "per_name_ally",
            scope: "rotation",
            names: ["Saibaiman"],
            selfInclusion: "included",
            membersPerIncrement: 1,
            maximumCount: 3,
        });
        (0, assert_1.deepEqual)(largestDimension.rules[0].effects[0].scaling, {
            kind: "per_category_or_class_ally",
            scope: "team",
            categories: ["Future Saga"],
            classes: ["Super"],
            selfInclusion: "included",
            membersPerIncrement: 1,
            maximumCount: 7,
        });
    });
    (0, mocha_1.it)("types an all-class Entrance Animation without requiring a redundant entry suffix", () => {
        const passive = (0, team_analysis_1.parsePassive)("entrance:all-class:initial", "Unified Force", [
            "Activates the Entrance Animation when all allies are Extreme Class characters",
            "- ATK & DEF 180%",
        ].join("\n"));
        (0, assert_1.equal)(passive.rules[0].conditionStatus, "supported");
        (0, assert_1.deepEqual)(conditionShape(passive.rules[0].condition), {
            op: "predicate",
            kind: "team_class_count",
            scope: "team",
            selfInclusion: "included",
            comparator: "eq",
            count: 7,
            classes: ["Extreme"],
        });
    });
    (0, mocha_1.it)("types the character as the sole member of a team category", () => {
        const passive = (0, team_analysis_1.parsePassive)("sole-category:initial", undefined, 'When the character is the only "Defenders of Justice" Category character on the team\n- ATK & DEF 150%');
        (0, assert_1.equal)(passive.rules[0].conditionStatus, "supported");
        (0, assert_1.deepEqual)(flattenPredicates(passive.rules[0].condition).map(predicate => ({
            kind: predicate.kind,
            scope: predicate.scope,
            selfInclusion: predicate.selfInclusion,
            comparator: predicate.comparator,
            count: predicate.count,
            categories: predicate.categories,
        })), [
            {
                kind: "character_category",
                scope: "self",
                selfInclusion: undefined,
                comparator: undefined,
                count: undefined,
                categories: ["Defenders of Justice"],
            },
            {
                kind: "team_category_count",
                scope: "team",
                selfInclusion: "included",
                comparator: "eq",
                count: 1,
                categories: ["Defenders of Justice"],
            },
        ]);
    });
    (0, mocha_1.it)("types all-team category alternatives as a universal category union", () => {
        const passive = (0, team_analysis_1.parsePassive)("all-category-union:initial", undefined, 'When all allies are "Dragon Ball Heroes" or "Crossover" Category characters\n- ATK & DEF 150%');
        (0, assert_1.equal)(passive.rules[0].conditionStatus, "supported");
        (0, assert_1.deepEqual)(conditionShape(passive.rules[0].condition), {
            op: "predicate",
            kind: "team_category_count",
            scope: "team",
            selfInclusion: "included",
            comparator: "eq",
            count: 7,
            categories: ["Dragon Ball Heroes", "Crossover"],
        });
    });
    (0, mocha_1.it)("types all-team category-or-Class alternatives as a same-member union", () => {
        const passive = (0, team_analysis_1.parsePassive)("all-category-class-union:initial", undefined, 'When all allies are "Space-Traveling Warriors" Category characters or Extreme Class characters\n- ATK & DEF 150%');
        (0, assert_1.equal)(passive.rules[0].conditionStatus, "supported");
        (0, assert_1.deepEqual)(conditionShape(passive.rules[0].condition), {
            op: "predicate",
            kind: "ally_category_or_class_present",
            scope: "team",
            selfInclusion: "included",
            comparator: "eq",
            count: 7,
            categories: ["Space-Traveling Warriors"],
            classes: ["Extreme"],
        });
    });
    (0, mocha_1.it)("types all-team Class-or-category alternatives independent of source order", () => {
        const passive = (0, team_analysis_1.parsePassive)("all-class-category-union:initial", undefined, 'When all allies are Extreme Class characters or "GT Bosses" Category characters\n- ATK & DEF 150%');
        (0, assert_1.equal)(passive.rules[0].conditionStatus, "supported");
        (0, assert_1.deepEqual)(conditionShape(passive.rules[0].condition), {
            op: "predicate",
            kind: "ally_category_or_class_present",
            scope: "team",
            selfInclusion: "included",
            comparator: "eq",
            count: 7,
            categories: ["GT Bosses"],
            classes: ["Extreme"],
        });
    });
    (0, mocha_1.it)("types an Entrance Animation enabled by an enemy or rotation partner category", () => {
        const passive = (0, team_analysis_1.parsePassive)("entrance:enemy-or-rotation-category:initial", undefined, [
            'Activates the Entrance Animation when there is a "Tournament Participants" Category enemy or another "Tournament Participants" Category ally at the start of the character\'s attacking turn',
            "- ATK & DEF 150%",
        ].join("\n"));
        (0, assert_1.equal)(passive.rules[0].conditionStatus, "supported");
        (0, assert_1.deepEqual)(flattenPredicates(passive.rules[0].condition).map(predicate => ({
            kind: predicate.kind,
            scope: predicate.scope,
            selfInclusion: predicate.selfInclusion,
            categories: predicate.categories,
            enemySelection: predicate.enemySelection,
        })), [
            {
                kind: "enemy_category",
                scope: "enemy",
                selfInclusion: undefined,
                categories: ["Tournament Participants"],
                enemySelection: "any_enemy",
            },
            {
                kind: "rotation_partner_category",
                scope: "rotation",
                selfInclusion: "excluded",
                categories: ["Tournament Participants"],
                enemySelection: undefined,
            },
        ]);
    });
    (0, mocha_1.it)("types an incoming attack from an enemy hit by the character's Super Attack", () => {
        const passive = (0, team_analysis_1.parsePassive)("runtime:enemy-hit-by-sa:initial", undefined, "When receiving an attack from an enemy who is hit by the character's Super Attack\n- DEF 250%");
        (0, assert_1.equal)(passive.rules[0].conditionStatus, "supported");
        (0, assert_1.deepEqual)(flattenPredicates(passive.rules[0].condition).map(predicate => predicate.kind), [
            "incoming_attack_from_enemy_hit_by_self_super_attack",
        ]);
    });
    (0, mocha_1.it)("types Ultra, Unit and styled Super Attack variants for a previously marked enemy", () => {
        const cases = [
            "When receiving an attack from an enemy who is hit by the character's Ultra Super Attack",
            "When receiving an attack from an enemy who is hit by the character's Ultra Super Attack or Unit Super Attack",
            "When receiving an Unarmed Super Attack from an enemy who is hit by the character's Ultra Super Attack",
        ];
        cases.forEach((header, index) => {
            const passive = (0, team_analysis_1.parsePassive)(`marked-enemy-${index}:initial`, undefined, `${header}\n- DEF 250%`);
            (0, assert_1.equal)(passive.rules[0].conditionStatus, "supported", header);
            const predicate = flattenPredicates(passive.rules[0].condition)[0];
            (0, assert_1.equal)(predicate.kind, "incoming_attack_from_enemy_hit_by_self_super_attack", header);
            (0, assert_1.equal)(predicate.combatEvent?.attackKind, index === 2 ? "super_attack" : "unknown", header);
            (0, assert_1.equal)(predicate.combatEvent?.attackStyle, index === 2 ? "unarmed" : undefined, header);
        });
    });
    (0, mocha_1.it)("types first, ordinal and parenthesized combat-event counters", () => {
        const cases = [
            { header: "When attacking for the 1st time", kind: "attacks_performed", comparator: "eq", value: 1, countScope: "battle", mode: "accumulated_count" },
            { header: "When receiving an attack for the 1st time within the turn", kind: "attacks_received", comparator: "eq", value: 1, countScope: "current_turn", mode: "accumulated_count" },
            { header: "When the character performs the 6th attack in battle", kind: "attacks_performed", comparator: "eq", value: 6, countScope: "battle", mode: "accumulated_count" },
            { header: "Every time the character receives 5 or more attacks in battle", kind: "attacks_received", comparator: "gte", value: 5, countScope: "battle", mode: "repeated_threshold" },
            { header: "After performing 3 Super Attack(s) in battle", kind: "super_attacks_performed", comparator: "gte", value: 3, countScope: "battle", mode: "accumulated_count" },
        ];
        cases.forEach((fixture, index) => {
            const passive = (0, team_analysis_1.parsePassive)(`combat-counter-${index}:initial`, undefined, `${fixture.header}\n- ATK 100%`);
            (0, assert_1.equal)(passive.rules[0].conditionStatus, "supported", fixture.header);
            const predicate = flattenPredicates(passive.rules[0].condition)[0];
            (0, assert_1.equal)(predicate.kind, fixture.kind, fixture.header);
            (0, assert_1.equal)(predicate.comparator, fixture.comparator, fixture.header);
            (0, assert_1.equal)(predicate.value, fixture.value, fixture.header);
            (0, assert_1.equal)(predicate.combatEvent?.countScope, fixture.countScope, fixture.header);
            (0, assert_1.equal)(predicate.combatEvent?.mode, fixture.mode, fixture.header);
        });
    });
    (0, mocha_1.it)("types final-blow timing, after-attack Ki and joined combat histories", () => {
        const cases = [
            "At the end of the turn in which a final blow is delivered",
            "After attacking with 8 or more Ki",
            "After performing 3 or more Super Attacks and receiving 7 or more attacks in battle",
            "Every time the character receives 3 or more attacks in battle, or every time the character evades 3 or more attacks in battle",
        ];
        cases.forEach((header, index) => {
            const passive = (0, team_analysis_1.parsePassive)(`joined-runtime-${index}:initial`, undefined, `${header}\n- ATK 100%`);
            (0, assert_1.equal)(passive.rules[0].conditionStatus, "supported", header);
        });
        (0, assert_1.deepEqual)(flattenPredicates((0, team_analysis_1.parsePassive)("joined-runtime-combat:initial", undefined, `${cases[2]}\n- ATK 100%`).rules[0].condition).map(predicate => predicate.kind), [
            "super_attacks_performed",
            "attacks_received",
        ]);
    });
    (0, mocha_1.it)("keeps lowercase wrapped inline conditions with their effect and starts the next real header separately", () => {
        const passive = (0, team_analysis_1.parsePassive)("1026731:1026731:initial", "Mad Scientist's Scheme", [
            "When facing only 1 enemy",
            "- ATK 60000 and medium chance of performing a critical hit",
            "when the enemy's HP is 60% or more",
            "When facing 2 or more enemies",
            "- Ki +2",
        ].join("\n"));
        (0, assert_1.equal)(passive.rules.length, 2);
        (0, assert_1.equal)(passive.rules[0].conditionStatus, "supported");
        (0, assert_1.deepEqual)(flattenPredicates(passive.rules[0].condition).map(predicate => predicate.kind), [
            "enemy_count",
            "enemy_hp_percent",
        ]);
        (0, assert_1.equal)(passive.rules[1].conditionStatus, "supported");
        (0, assert_1.deepEqual)(flattenPredicates(passive.rules[1].condition).map(predicate => predicate.kind), [
            "enemy_count",
        ]);
    });
    (0, mocha_1.it)("keeps numeric wrapped Ki requirements attached to the preceding effect", () => {
        const passive = (0, team_analysis_1.parsePassive)("wrapped-ki:initial", undefined, [
            "When attacking with 18 or more Ki",
            "- ATK 100% and disables the enemy's guard with",
            "1 or more STR Ki Spheres obtained",
            "After receiving an attack",
            "- DEF 100%",
        ].join("\n"));
        (0, assert_1.equal)(passive.rules.length, 2);
        (0, assert_1.equal)(passive.rules[0].conditionStatus, "supported");
        (0, assert_1.deepEqual)(flattenPredicates(passive.rules[0].condition).map(predicate => predicate.kind), [
            "ki_amount",
            "ki_spheres_obtained",
        ]);
    });
    (0, mocha_1.it)("types ally-or-enemy name alternatives without losing their distinct scopes", () => {
        const team = (0, team_analysis_1.parsePassive)("name-team-or-enemy:initial", undefined, 'When there is an ally or an enemy whose name includes\n"Goku (Youth)"\n- Ki +3');
        const rotation = (0, team_analysis_1.parsePassive)("name-rotation-or-enemy:initial", undefined, 'When the name of an ally who is attacking in the same turn or\nan enemy includes "Goku" (Captain Ginyu, Jr., etc. excluded)\n- Guards all attacks');
        [team, rotation].forEach(passive => (0, assert_1.equal)(passive.rules[0].conditionStatus, "partial"));
        (0, assert_1.deepEqual)(flattenPredicates(team.rules[0].condition).map(predicate => [predicate.kind, predicate.scope]), [
            ["enemy_name", "enemy"],
            ["ally_name_present", "team"],
        ]);
        (0, assert_1.deepEqual)(flattenPredicates(rotation.rules[0].condition).map(predicate => [predicate.kind, predicate.scope]), [
            ["ally_name_present", "rotation"],
            ["enemy_name", "enemy"],
        ]);
    });
    (0, mocha_1.it)("types repeatable attack progress in battle as an accumulated performed-attack predicate", () => {
        const passive = (0, team_analysis_1.parsePassive)("1032581:1032581:initial", "Steadfast Saiyan Pride", [
            "Every time the character performs 3 or more attacks in battle",
            "- Launches an additional Super Attack (up to once within a turn)",
        ].join("\n"));
        (0, assert_1.equal)(passive.rules[0].conditionStatus, "supported");
        (0, assert_1.deepEqual)(flattenPredicates(passive.rules[0].condition).map(predicate => ({
            kind: predicate.kind,
            comparator: predicate.comparator,
            value: predicate.value,
            combatEvent: predicate.combatEvent,
        })), [{
                kind: "attacks_performed",
                comparator: "gte",
                value: 3,
                combatEvent: {
                    eventType: "attack_performed",
                    actor: "self",
                    attackKind: "unknown",
                    mode: "repeated_threshold",
                    countScope: "battle",
                    relativeTiming: "after_event",
                    provenance: {
                        eventType: "explicit_text",
                        actor: "documented_domain_rule",
                        attackKind: "unresolved",
                        mode: "explicit_text",
                        countScope: "explicit_text",
                        relativeTiming: "explicit_text",
                    },
                },
            }]);
    });
    (0, mocha_1.it)("types start-of-turn attacker position without leaving a false unknown suffix", () => {
        const passive = (0, team_analysis_1.parsePassive)("1032411:1032411:initial", "Divine Support", [
            "When the character is the 2nd attacker at the start of turn",
            "- Changes Ki Spheres: AGL to TEQ",
        ].join("\n"));
        (0, assert_1.equal)(passive.rules[0].conditionStatus, "supported");
        (0, assert_1.deepEqual)(flattenPredicates(passive.rules[0].condition).map(predicate => ({
            kind: predicate.kind,
            slots: predicate.slots,
            evaluationMoment: predicate.evaluationMoment,
        })), [{
                kind: "battle_slot",
                slots: [2],
                evaluationMoment: "start_of_turn",
            }]);
    });
    (0, mocha_1.it)("treats an every-turn application header as available and preserves its trigger", () => {
        const passive = (0, team_analysis_1.parsePassive)("per-turn:stacking:initial", "Growing Power", [
            "At the start of each turn",
            "- Ki +2 (up to +4)",
            "- ATK & DEF 50% (up to 100%)",
        ].join("\n"));
        (0, assert_1.equal)(passive.rules.length, 2);
        passive.rules.forEach(rule => {
            (0, assert_1.equal)(rule.conditionStatus, "supported");
            (0, assert_1.deepEqual)(rule.condition, { op: "always" });
            rule.effects.forEach(effect => {
                (0, assert_1.equal)(effect.applicationTrigger?.kind, "per_turn");
                (0, assert_1.equal)(effect.applicationTrigger?.source, "explicit_text");
                (0, assert_1.equal)(effect.activationTiming?.moment, "start_of_turn");
            });
        });
    });
    (0, mocha_1.it)("types official guard, Revival, Finish, Domain and KO runtime conditions", () => {
        const cases = [
            { header: "After guard is activated", kind: "guard_activated", scope: "self" },
            { header: "After guard is activated 2 times in battle", kind: "guard_activated", scope: "self", comparator: "gte", value: 2 },
            { header: "After the character's Revival Skill is activated", kind: "revive_triggered", scope: "self" },
            { header: "After the character's or an ally's Revival Skill is activated", kind: "revive_triggered", scope: "team" },
            { header: "After an ally's Revival Skill is activated", kind: "revive_triggered", scope: "team" },
            { header: "When the Finish Effect is activated", kind: "finish_effect_activated", scope: "self" },
            { header: "When the Finish Effect is not activated", kind: "finish_effect_activated", scope: "self", negated: true },
            { header: 'When the Domain "Tree of Might" is active', kind: "domain_active", scope: "battle", domainNames: ["Tree of Might"] },
            { header: "When the character is KO'd", kind: "character_ko", scope: "self" },
        ];
        cases.forEach((fixture, index) => {
            const passive = (0, team_analysis_1.parsePassive)(`runtime-flag-${index}:initial`, undefined, `${fixture.header}\n- ATK 100%`);
            (0, assert_1.equal)(passive.rules[0].conditionStatus, "supported", fixture.header);
            const condition = passive.rules[0].condition;
            (0, assert_1.equal)(condition.op, fixture.negated ? "not" : "predicate", fixture.header);
            const predicate = flattenPredicates(condition)[0];
            (0, assert_1.equal)(predicate.kind, fixture.kind, fixture.header);
            (0, assert_1.equal)(predicate.scope, fixture.scope, fixture.header);
            (0, assert_1.equal)(predicate.comparator, fixture.comparator, fixture.header);
            (0, assert_1.equal)(predicate.value, fixture.value, fixture.header);
            (0, assert_1.deepEqual)(predicate.domainNames, fixture.domainNames, fixture.header);
        });
    });
    (0, mocha_1.it)("types an enemy Super Attack launched at the character as a resolved incoming event", () => {
        const passive = (0, team_analysis_1.parsePassive)("incoming-super-after:initial", undefined, "After the enemy launches a Super Attack at the character\n- DEF 100%");
        (0, assert_1.equal)(passive.rules[0].conditionStatus, "supported");
        const predicate = flattenPredicates(passive.rules[0].condition)[0];
        (0, assert_1.equal)(predicate.kind, "incoming_super_attack");
        (0, assert_1.equal)(predicate.combatEvent?.relativeTiming, "during_event");
    });
    (0, mocha_1.it)("types turn and existing-enemy scaling headers without turning them into conditions", () => {
        const passive = (0, team_analysis_1.parsePassive)("runtime-scaling:initial", undefined, [
            "For every 2 turns passed from the start of battle",
            "- ATK 20% (up to 100%)",
            "Per existing Extreme Class enemy (count starts from the 3rd enemy)",
            "- DEF 50%",
        ].join("\n"));
        (0, assert_1.equal)(passive.rules.length, 2);
        passive.rules.forEach(rule => {
            (0, assert_1.equal)(rule.conditionStatus, "supported");
            (0, assert_1.deepEqual)(rule.condition, { op: "always" });
        });
        (0, assert_1.deepEqual)(passive.rules[0].effects[0].scaling, {
            kind: "per_turn_passed",
            turnsPerIncrement: 2,
            turnContext: "battle_turn",
        });
        (0, assert_1.deepEqual)(passive.rules[1].effects[0].scaling, {
            kind: "per_existing_enemy",
            classes: ["Extreme"],
            enemiesPerIncrement: 1,
            countStartsFrom: 3,
        });
    });
    (0, mocha_1.it)("types launched enemy Super Attacks as per-event scaling", () => {
        const passive = (0, team_analysis_1.parsePassive)("incoming-super-scaling:initial", undefined, "For every Super Attack the enemy launches at the character\n- Ki +1");
        (0, assert_1.equal)(passive.rules[0].conditionStatus, "supported");
        (0, assert_1.deepEqual)(passive.rules[0].condition, { op: "always" });
        const scaling = passive.rules[0].effects[0].scaling;
        (0, assert_1.equal)(scaling?.kind, "per_combat_event");
        if (scaling?.kind !== "per_combat_event")
            throw new Error("expected combat scaling");
        (0, assert_1.equal)(scaling.events[0].eventType, "incoming_attack");
        (0, assert_1.equal)(scaling.events[0].attackKind, "super_attack");
        (0, assert_1.equal)(scaling.events[0].mode, "per_event");
    });
    (0, mocha_1.it)("types performed-Super-Attack scaling qualified by attack Ki", () => {
        const passive = (0, team_analysis_1.parsePassive)("super-scaling-with-ki:initial", undefined, "For every Super Attack performed with 18 or more Ki\n- Ki +3 (up to +6)");
        (0, assert_1.equal)(passive.rules[0].conditionStatus, "supported");
        (0, assert_1.equal)(flattenPredicates(passive.rules[0].condition)[0].kind, "ki_amount");
        (0, assert_1.equal)(passive.rules[0].effects[0].scaling?.kind, "per_combat_event");
    });
    (0, mocha_1.it)("types excluded Type Ki Sphere presence and scaling without flattening the exclusion", () => {
        const passive = (0, team_analysis_1.parsePassive)("excluded-type-spheres:initial", undefined, [
            "For every Type Ki Sphere obtained (STR excluded)",
            "- DEF 70%",
            "With a Type Ki Sphere obtained (PHY excluded)",
            "- ATK 100%",
        ].join("\n"));
        (0, assert_1.equal)(passive.rules.length, 2);
        (0, assert_1.equal)(passive.rules[0].conditionStatus, "supported");
        (0, assert_1.deepEqual)(passive.rules[0].condition, { op: "always" });
        (0, assert_1.deepEqual)(passive.rules[0].effects[0].scaling, {
            kind: "per_ki_sphere",
            kiSphereTypes: ["any"],
            excludedKiSphereTypes: ["STR"],
            spheresPerIncrement: 1,
            kiContext: "collected_ki_spheres",
        });
        (0, assert_1.equal)(passive.rules[1].conditionStatus, "supported");
        (0, assert_1.deepEqual)(flattenPredicates(passive.rules[1].condition).flatMap(predicate => predicate.kiSphereTypes ?? []), [
            "AGL", "TEQ", "INT", "STR",
        ]);
    });
    (0, mocha_1.it)("types mixed Type and Rainbow Ki Sphere presence", () => {
        const passive = (0, team_analysis_1.parsePassive)("mixed-sphere-presence:initial", undefined, "With an INT or Rainbow Ki Sphere obtained\n- ATK 100%");
        (0, assert_1.equal)(passive.rules[0].conditionStatus, "supported");
        (0, assert_1.deepEqual)(flattenPredicates(passive.rules[0].condition)[0].kiSphereTypes, ["INT", "rainbow"]);
    });
    (0, mocha_1.it)("types counted rotation characters as name allies", () => {
        const passive = (0, team_analysis_1.parsePassive)("counted-name-rotation:initial", undefined, 'When there are 3 characters whose names include "Metal Cooler" attacking in the same turn\n- ATK 100%');
        (0, assert_1.equal)(passive.rules[0].conditionStatus, "partial");
        const predicate = flattenPredicates(passive.rules[0].condition)[0];
        (0, assert_1.equal)(predicate.kind, "ally_name_present");
        (0, assert_1.equal)(predicate.scope, "rotation");
        (0, assert_1.equal)(predicate.count, 3);
    });
    (0, mocha_1.it)("types HP-at-start availability gated by received attack history", () => {
        const passive = (0, team_analysis_1.parsePassive)("hp-after-hits:initial", undefined, "When HP is 30% or less at the start of the character's attacking turn after the character receives 4 or more attacks in battle\n- ATK 100%");
        (0, assert_1.equal)(passive.rules[0].conditionStatus, "supported");
        (0, assert_1.deepEqual)(flattenPredicates(passive.rules[0].condition).map(predicate => [predicate.kind, predicate.value]), [
            ["hp_percent", 30],
            ["attacks_received", 4],
        ]);
    });
    (0, mocha_1.it)("types an if-qualified team condition together with its attack Ki requirement", () => {
        const passive = (0, team_analysis_1.parsePassive)("ki-if-ally:initial", undefined, [
            'When attacking with 12 or more Ki if there is another "Power of Wishes" Category ally on the team',
            "- ATK 150%",
        ].join("\n"));
        (0, assert_1.equal)(passive.rules[0].conditionStatus, "supported");
        (0, assert_1.deepEqual)(flattenPredicates(passive.rules[0].condition).map(predicate => predicate.kind), [
            "ki_amount",
            "ally_category_present",
        ]);
    });
    (0, mocha_1.it)("types direct quoted team and rotation name clauses for official identity binding", () => {
        const passive = (0, team_analysis_1.parsePassive)("legacy-name:initial", undefined, [
            'When your team has "Android #17 (Future)" attacking in the same turn',
            "- ATK 100%",
            'When "Piccolo" is on the team',
            "- DEF 100%",
        ].join("\n"), undefined, {
            characterId: "legacy-name",
            formId: "legacy-name",
            releaseState: "initial",
            passiveSkillSetId: "legacy",
            nameIdentityContract: {
                source: "first_party_game_db",
                bindings: [
                    { passiveSkillSetId: "legacy", scope: "rotation", count: 1, identitySetId: "17", canonicalIds: ["17"], canonicalNames: ["Android #17 (Future)"] },
                    { passiveSkillSetId: "legacy", scope: "team", count: 1, identitySetId: "30", canonicalIds: ["30"], canonicalNames: ["Piccolo"] },
                ],
            },
        });
        (0, assert_1.equal)(passive.rules.length, 2);
        (0, assert_1.deepEqual)(passive.rules.map(rule => flattenPredicates(rule.condition)[0].nameIdentitySetId), ["17", "30"]);
        (0, assert_1.deepEqual)(passive.rules.map(rule => flattenPredicates(rule.condition)[0].scope), ["rotation", "team"]);
    });
    (0, mocha_1.it)("keeps shared rotation scope across category alternatives", () => {
        const passive = (0, team_analysis_1.parsePassive)("shared-category-scope:initial", undefined, [
            'When there are 3 "GT Heroes" Category allies or',
            '3 "Giant Ape Power" Category allies attacking in the same turn',
            "- Guards all attacks",
        ].join("\n"));
        (0, assert_1.equal)(passive.rules[0].conditionStatus, "supported");
        const predicates = flattenPredicates(passive.rules[0].condition);
        (0, assert_1.deepEqual)(predicates.map(predicate => predicate.scope), ["rotation", "rotation"]);
        (0, assert_1.deepEqual)(predicates.map(predicate => predicate.categories), [["GT Heroes"], ["Giant Ape Power"]]);
        (0, assert_1.deepEqual)(predicates.map(predicate => predicate.count), [3, 3]);
    });
    (0, mocha_1.it)("types composite runtime qualifiers without leaving timing or HP fragments unknown", () => {
        const slot = (0, team_analysis_1.parsePassive)("slot-at-start:initial", undefined, "As the 1st or 3rd attacker in a turn at the start of turn\n- DEF 100%");
        const enemyHp = (0, team_analysis_1.parsePassive)("enemy-status-hp:initial", undefined, "When the target enemy is in the following status: HP is 80% or less\n- ATK 80%");
        const hpAndKi = (0, team_analysis_1.parsePassive)("hp-and-ki:initial", undefined, "If HP is 80% or less when attacking with 12 or more Ki\n- ATK 80%");
        const hpWhenAttacking = (0, team_analysis_1.parsePassive)("hp-when-attacking:initial", undefined, "If HP is 85% or more when attacking\n- ATK 85%");
        (0, assert_1.equal)(slot.rules[0].conditionStatus, "supported");
        (0, assert_1.equal)(flattenPredicates(slot.rules[0].condition)[0].evaluationMoment, "start_of_turn");
        (0, assert_1.equal)(enemyHp.rules[0].conditionStatus, "supported");
        (0, assert_1.equal)(flattenPredicates(enemyHp.rules[0].condition)[0].kind, "enemy_hp_percent");
        (0, assert_1.equal)(hpAndKi.rules[0].conditionStatus, "supported");
        (0, assert_1.deepEqual)(flattenPredicates(hpAndKi.rules[0].condition).map(predicate => predicate.kind), ["hp_percent", "ki_amount"]);
        (0, assert_1.equal)(hpWhenAttacking.rules[0].conditionStatus, "supported");
        (0, assert_1.deepEqual)(flattenPredicates(hpWhenAttacking.rules[0].condition).map(predicate => predicate.kind), ["hp_percent"]);
    });
    (0, mocha_1.it)("preserves attack scaling while evaluating an attached slot condition", () => {
        const passive = (0, team_analysis_1.parsePassive)("scaled-slot:initial", undefined, "For every attack performed as the 2nd or 3rd attacker in a turn\n- ATK 22% (up to 66%)");
        (0, assert_1.equal)(passive.rules[0].conditionStatus, "supported");
        (0, assert_1.equal)(flattenPredicates(passive.rules[0].condition)[0].kind, "battle_slot");
        (0, assert_1.equal)(passive.rules[0].effects[0].scaling?.kind, "per_combat_event");
    });
    (0, mocha_1.it)("types attack-Ki and excluded-Type Ki Sphere scaling", () => {
        const passive = (0, team_analysis_1.parsePassive)("ki-scaling:initial", undefined, [
            "For every Ki when attacking",
            "- ATK 10%",
            "For every non-TEQ Ki Sphere obtained",
            "- DEF 20%",
        ].join("\n"));
        (0, assert_1.deepEqual)(passive.rules[0].effects[0].scaling, {
            kind: "per_ki_amount",
            kiPerIncrement: 1,
            kiContext: "final_attack_ki",
            evaluationMoment: "when_attacking",
        });
        (0, assert_1.deepEqual)(passive.rules[1].effects[0].scaling, {
            kind: "per_ki_sphere",
            kiSphereTypes: ["any"],
            excludedKiSphereTypes: ["TEQ"],
            spheresPerIncrement: 1,
            kiContext: "collected_ki_spheres",
        });
        passive.rules.forEach(rule => (0, assert_1.equal)(rule.conditionStatus, "supported"));
    });
    (0, mocha_1.it)("types exact every-N combat event wording as a repeated threshold", () => {
        for (const [verb, kind] of [
            ["performs", "attacks_performed"],
            ["receives", "attacks_received"],
            ["evades", "attacks_evaded"],
        ]) {
            const passive = (0, team_analysis_1.parsePassive)(`repeated-${verb}:initial`, undefined, `Every time the character ${verb} 3 attack(s) in battle\n- ATK 10%`);
            const predicate = flattenPredicates(passive.rules[0].condition)[0];
            (0, assert_1.equal)(predicate.kind, kind);
            (0, assert_1.equal)(predicate.value, 3);
            (0, assert_1.equal)(predicate.combatEvent?.mode, "repeated_threshold");
            (0, assert_1.equal)(predicate.combatEvent?.countScope, "battle");
        }
    });
    (0, mocha_1.it)("types official bare enemy-name and enemy-or-team name clauses", () => {
        const passive = (0, team_analysis_1.parsePassive)("name-variants:initial", undefined, [
            'When there is an enemy or an ally whose name includes "Goku" (Youth, Captain Ginyu, Jr., etc. excluded)',
            "- ATK 100%",
            'When an enemy includes "Goku" (Captain Ginyu, Jr., etc. excluded)',
            "- DEF 100%",
        ].join("\n"));
        (0, assert_1.equal)(passive.rules.length, 2);
        (0, assert_1.equal)(passive.rules[0].condition.op, "any");
        (0, assert_1.deepEqual)(flattenPredicates(passive.rules[0].condition).map(predicate => predicate.scope), ["enemy", "team"]);
        (0, assert_1.equal)(flattenPredicates(passive.rules[1].condition)[0].scope, "enemy");
    });
    (0, mocha_1.it)("types bounded HP-remaining scaling without misclassifying its maximum as a stack cap", () => {
        const passive = (0, team_analysis_1.parsePassive)("hp-scaling:bounded:initial", "Adaptive Power", [
            "The more HP remaining",
            "- ATK & DEF (up to 100%)",
            "The less HP remaining",
            "- Ki (up to +10)",
        ].join("\n"));
        (0, assert_1.equal)(passive.rules.length, 2);
        const [more, less] = passive.rules;
        (0, assert_1.equal)(more.conditionStatus, "supported");
        (0, assert_1.equal)(more.effectStatus, "supported");
        (0, assert_1.deepEqual)(more.condition, { op: "always" });
        (0, assert_1.deepEqual)(more.effects.map(effect => ({
            kind: effect.kind,
            value: effect.value,
            unit: effect.unit,
            stackCap: effect.stackCap,
            scaling: effect.scaling,
            trigger: effect.applicationTrigger,
            timing: effect.activationTiming,
            bucket: effect.calculationBucket,
        })), ["atk", "def"].map(kind => ({
            kind,
            value: 100,
            unit: "percent",
            stackCap: undefined,
            scaling: {
                kind: "hp_remaining",
                direction: "more",
                hpContext: "team_hp_percent",
            },
            trigger: {
                kind: "per_turn",
                source: "documented_domain_rule",
                provenance: {
                    source: "documented_domain_rule",
                    ruleVersion: "hp-remaining-scaling-v1",
                },
            },
            timing: { moment: "start_of_turn", source: "documented_domain_rule" },
            bucket: { bucket: "passive_start_of_turn", source: "documented_domain_rule" },
        })));
        (0, assert_1.equal)(less.conditionStatus, "supported");
        (0, assert_1.equal)(less.effectStatus, "supported");
        (0, assert_1.equal)(less.effects[0].kind, "ki");
        (0, assert_1.equal)(less.effects[0].value, 10);
        (0, assert_1.equal)(less.effects[0].unit, "ki");
        (0, assert_1.equal)(less.effects[0].stackCap, undefined);
        (0, assert_1.deepEqual)(less.effects[0].scaling, {
            kind: "hp_remaining",
            direction: "less",
            hpContext: "team_hp_percent",
        });
    });
    (0, mocha_1.it)("keeps an unsupported HP-scaled effect conservative without reporting missing condition data", () => {
        const passive = (0, team_analysis_1.parsePassive)("hp-scaling:residual:initial", undefined, "The less HP remaining\n- Damage reduction rate (50% - 90%)");
        (0, assert_1.equal)(passive.rules[0].conditionStatus, "supported");
        (0, assert_1.equal)(passive.rules[0].effectStatus, "unknown");
        (0, assert_1.equal)(passive.rules[0].parseStatus, "partial");
        (0, assert_1.deepEqual)(passive.rules[0].condition, { op: "always" });
        (0, assert_1.equal)(passive.rules[0].effects[0].applicationTrigger?.kind, "per_turn");
    });
    (0, mocha_1.it)("fails closed for near-match HP prose outside the official scaling header", () => {
        const passive = (0, team_analysis_1.parsePassive)("hp-scaling:unknown:initial", undefined, "More HP means more power\n- ATK 100%");
        (0, assert_1.equal)(passive.rules[0].conditionStatus, "unknown");
    });
    (0, mocha_1.it)("types Active Skill activation as battle context inside an alternative", () => {
        const passive = (0, team_analysis_1.parsePassive)("1034341:1034341:initial", undefined, "When activating the Active Skill or when attacking with 18 or more Ki\n- ATK & DEF 350%");
        (0, assert_1.equal)(passive.rules[0].conditionStatus, "supported");
        (0, assert_1.deepEqual)(flattenPredicates(passive.rules[0].condition).map(predicate => predicate.kind), ["active_skill_used", "ki_amount"]);
    });
});
(0, mocha_1.describe)("team-analysis Gate A5 Ki and Ki Sphere parser", function () {
    for (const fixtureCase of gateA5Fixture.cases) {
        (0, mocha_1.it)(`matches Gate A5 golden case: ${fixtureCase.name}`, () => {
            const passive = (0, team_analysis_1.parsePassive)(`gate-a5:${fixtureCase.name}:initial`, fixtureCase.name, fixtureCase.rawText);
            const rule = passive.rules[0];
            (0, assert_1.equal)(passive.parseStatus, fixtureCase.expectedStatus);
            (0, assert_1.equal)(rule.conditionStatus, fixtureCase.conditionStatus ?? "supported");
            (0, assert_1.deepEqual)(conditionShape(rule.condition), fixtureCase.condition);
            if (fixtureCase.effects) {
                (0, assert_1.deepEqual)(rule.effects.map(gateA5EffectShape), fixtureCase.effects);
            }
            (0, assert_1.equal)(rule.effects.some(effect => effect.kind === "support"), false);
        });
    }
    (0, mocha_1.it)("reconstructs every Gate A5 source token in original order", () => {
        for (const fixtureCase of gateA5Fixture.cases) {
            const passive = (0, team_analysis_1.parsePassive)("gate-a5:tokens:initial", undefined, fixtureCase.rawText);
            const fragments = uniqueFragments([
                ...passive.rules.flatMap(rule => rule.source),
                ...passive.unparsedFragments,
            ]);
            const reconstructed = fragments.map(fragment => fragment.text).join("\n").replace(/\s/g, "");
            (0, assert_1.equal)(reconstructed, fixtureCase.rawText.replace(/\s/g, ""), fixtureCase.name);
        }
    });
    (0, mocha_1.it)("types final attack Ki while the character is targeted by an attack", () => {
        for (const value of [10, 12, 15, 18, 20]) {
            const rawText = `When receiving an attack with ${value} or more Ki\n- DEF 200%`;
            const passive = (0, team_analysis_1.parsePassive)(`receiving-attack-ki:${value}:initial`, undefined, rawText);
            const rule = passive.rules[0];
            (0, assert_1.equal)(rule.conditionStatus, "supported");
            (0, assert_1.deepEqual)(conditionShape(rule.condition), {
                op: "all",
                children: [
                    {
                        op: "predicate",
                        kind: "incoming_attack",
                        scope: "self",
                        combatEvent: {
                            eventType: "incoming_attack",
                            actor: "enemy",
                            attackKind: "unknown",
                            mode: "current_event",
                            relativeTiming: "during_event",
                            provenance: {
                                eventType: "explicit_text",
                                actor: "documented_domain_rule",
                                attackKind: "unresolved",
                                mode: "explicit_text",
                                relativeTiming: "explicit_text",
                            },
                        },
                    },
                    {
                        op: "predicate",
                        kind: "ki_amount",
                        scope: "self",
                        comparator: "gte",
                        value,
                        kiContext: "final_attack_ki",
                        evaluationMoment: "when_targeted_by_attack",
                    },
                ],
            });
        }
    });
    (0, mocha_1.it)("types the character's Ki Sphere collection order independently from battle slot", () => {
        const cases = [
            ["1st or 2nd", [1, 2]],
            ["1st or 3rd", [1, 3]],
            ["2nd or 3rd", [2, 3]],
            ["3rd", [3]],
        ];
        for (const [label, slots] of cases) {
            const rawText = `When the character is the ${label} to obtain Ki Spheres in a turn\n- Ki +1`;
            const passive = (0, team_analysis_1.parsePassive)(`ki-sphere-order:${label}:initial`, undefined, rawText);
            const rule = passive.rules[0];
            (0, assert_1.equal)(rule.conditionStatus, "supported");
            (0, assert_1.deepEqual)(conditionShape(rule.condition), {
                op: "predicate",
                kind: "ki_sphere_collection_order",
                scope: "self",
                slots: [...slots],
            });
        }
    });
    (0, mocha_1.it)("types wrapped incoming-attack conditions combined with Ki Sphere and attack-Ki thresholds", () => {
        const receivingWithSpheres = (0, team_analysis_1.parsePassive)("receiving-attack-spheres:initial", undefined, "When receiving an attack 5 or more Ki Spheres obtained\n- Ki +3").rules[0];
        const spheresThenReceivingWithKi = (0, team_analysis_1.parsePassive)("spheres-receiving-attack-ki:initial", undefined, "5 or more Ki Spheres obtained When receiving an attack with 12 or more Ki\n- DEF 200%").rules[0];
        (0, assert_1.equal)(receivingWithSpheres.conditionStatus, "supported");
        (0, assert_1.deepEqual)(flattenPredicates(receivingWithSpheres.condition).map(predicate => predicate.kind), ["incoming_attack", "ki_spheres_obtained"]);
        (0, assert_1.equal)(spheresThenReceivingWithKi.conditionStatus, "supported");
        (0, assert_1.deepEqual)(flattenPredicates(spheresThenReceivingWithKi.condition).map(predicate => predicate.kind), ["ki_spheres_obtained", "incoming_attack", "ki_amount"]);
    });
});
(0, mocha_1.describe)("team-analysis Gate A5.1 calculation-phase foundation", function () {
    for (const fixtureCase of gateA51Fixture.cases) {
        (0, mocha_1.it)(`matches Gate A5.1 golden case: ${fixtureCase.name}`, () => {
            const passive = (0, team_analysis_1.parsePassive)(`gate-a51:${fixtureCase.name}:initial`, fixtureCase.name, fixtureCase.rawText);
            (0, assert_1.equal)(passive.parseStatus, fixtureCase.expectedStatus);
            (0, assert_1.deepEqual)(passive.rules.flatMap(rule => rule.effects)
                .filter(effect => effect.kind !== "unknown")
                .map(gateA51EffectShape), fixtureCase.effects);
        });
    }
    (0, mocha_1.it)("reconstructs every Gate A5.1 source token in original order", () => {
        for (const fixtureCase of gateA51Fixture.cases) {
            const passive = (0, team_analysis_1.parsePassive)("gate-a51:tokens:initial", undefined, fixtureCase.rawText);
            const fragments = uniqueFragments([
                ...passive.rules.flatMap(rule => rule.source),
                ...passive.unparsedFragments,
            ]);
            (0, assert_1.equal)(fragments.map(fragment => fragment.text).join("\n").replace(/\s/g, ""), fixtureCase.rawText.replace(/\s/g, ""), fixtureCase.name);
        }
    });
});
(0, mocha_1.describe)("team-analysis Gate A6 combat-event history and phase parser", function () {
    for (const fixtureCase of gateA6Fixture.cases) {
        (0, mocha_1.it)(`matches Gate A6 golden case: ${fixtureCase.name}`, () => {
            const passive = (0, team_analysis_1.parsePassive)(`gate-a6:${fixtureCase.name}:initial`, fixtureCase.name, fixtureCase.rawText);
            const rule = passive.rules[0];
            (0, assert_1.equal)(passive.parseStatus, fixtureCase.expectedStatus);
            if (fixtureCase.condition) {
                (0, assert_1.deepEqual)(conditionShape(rule.condition), fixtureCase.condition);
            }
            if (fixtureCase.conditionOp) {
                (0, assert_1.equal)(rule.condition.op, fixtureCase.conditionOp);
            }
            if (fixtureCase.conditionKind) {
                const predicates = flattenPredicates(rule.condition);
                (0, assert_1.equal)(predicates[0]?.kind, fixtureCase.conditionKind);
            }
            if (fixtureCase.predicateKinds) {
                (0, assert_1.deepEqual)(flattenPredicates(rule.condition).map(predicate => predicate.kind), fixtureCase.predicateKinds);
            }
            if (fixtureCase.effectDuration) {
                (0, assert_1.deepEqual)(rule.effects.find(effect => effect.kind !== "unknown")?.duration, fixtureCase.effectDuration);
            }
            if (fixtureCase.effectScalingEvents) {
                const scaling = rule.effects.find(effect => effect.scaling?.kind === "per_combat_event")?.scaling;
                (0, assert_1.ok)(scaling?.kind === "per_combat_event");
                (0, assert_1.deepEqual)(scaling.events.map(event => event.eventType), fixtureCase.effectScalingEvents);
                (0, assert_1.equal)(scaling.connector, fixtureCase.effectScalingConnector);
            }
            if (fixtureCase.effects) {
                (0, assert_1.deepEqual)(rule.effects.filter(effect => effect.kind !== "unknown")
                    .map((effect, index) => gateA6EffectShape(effect, fixtureCase.effects?.[index])), fixtureCase.effects);
            }
            if (fixtureCase.outcomeMatches) {
                (0, assert_1.deepEqual)(combatOutcomeShape(rule.condition), fixtureCase.outcomeMatches);
            }
            if (fixtureCase.counterCountsOutcomes) {
                (0, assert_1.deepEqual)(combatOutcomeShape(rule.condition), fixtureCase.counterCountsOutcomes);
            }
            if (fixtureCase.scalingCountsOutcomes) {
                const scaling = rule.effects.find(effect => effect.scaling?.kind === "per_combat_event")?.scaling;
                (0, assert_1.ok)(scaling?.kind === "per_combat_event");
                (0, assert_1.deepEqual)(combatScalingOutcomeShape(scaling), fixtureCase.scalingCountsOutcomes);
            }
            if (fixtureCase.activationMoment) {
                (0, assert_1.equal)(rule.effects.find(effect => effect.kind !== "unknown")?.activationTiming?.moment, fixtureCase.activationMoment);
            }
            if (fixtureCase.expectBeforeDamage) {
                const event = flattenPredicates(rule.condition)[0]?.combatEvent;
                (0, assert_1.equal)(event?.eventType, "incoming_attack");
                (0, assert_1.equal)(event?.relativeTiming, "during_event");
                (0, assert_1.equal)(rule.effects.find(effect => effect.kind !== "unknown")?.activationTiming?.moment, "when_targeted_by_attack");
            }
            if (fixtureCase.allPredicateKinds) {
                (0, assert_1.deepEqual)(passive.rules.flatMap(item => flattenPredicates(item.condition)).map(predicate => predicate.kind), fixtureCase.allPredicateKinds);
            }
            if (fixtureCase.allScalingEvents) {
                (0, assert_1.deepEqual)(passive.rules.flatMap(item => item.effects)
                    .flatMap(effect => effect.scaling?.kind === "per_combat_event" ? effect.scaling.events : [])
                    .map(event => event.eventType), fixtureCase.allScalingEvents);
            }
            if (fixtureCase.allActivationMoments) {
                (0, assert_1.deepEqual)(passive.rules.flatMap(item => item.effects)
                    .filter(effect => effect.kind !== "unknown")
                    .map(effect => effect.activationTiming?.moment), fixtureCase.allActivationMoments);
            }
        });
    }
    (0, mocha_1.it)("never infers normal or Super from generic attack text", () => {
        for (const rawText of [
            "When receiving an attack\n- DEF 30%",
            "When attacking\n- ATK 30%",
            "After evading an attack\n- DEF 30%",
        ]) {
            const descriptors = (0, team_analysis_1.parsePassive)("gate-a6:generic:initial", undefined, rawText).rules
                .flatMap(rule => flattenPredicates(rule.condition))
                .map(predicate => predicate.combatEvent)
                .filter(Boolean);
            (0, assert_1.ok)(descriptors.length > 0);
            descriptors.forEach(descriptor => (0, assert_1.equal)(descriptor?.attackKind, "unknown"));
        }
    });
    (0, mocha_1.it)("keeps targeting, landed hits, and evades as mutually distinct runtime facts", () => {
        const targeted = (0, team_analysis_1.parsePassive)("gate-a6:targeted:initial", undefined, "When receiving an attack\n- DEF 30%").rules[0];
        const landed = (0, team_analysis_1.parsePassive)("gate-a6:landed:initial", undefined, "After being hit by an attack\n- DEF 30%").rules[0];
        const evaded = (0, team_analysis_1.parsePassive)("gate-a6:evaded:initial", undefined, "After evading an attack\n- DEF 30%").rules[0];
        (0, assert_1.deepEqual)(combatOutcomeShape(targeted.condition), { hit: true, dodge: true });
        (0, assert_1.deepEqual)(combatOutcomeShape(landed.condition), { hit: true, dodge: false });
        (0, assert_1.deepEqual)(combatOutcomeShape(evaded.condition), { hit: false, dodge: true });
        (0, assert_1.equal)(flattenPredicates(targeted.condition)[0].combatEvent?.eventType, "incoming_attack");
        (0, assert_1.equal)(flattenPredicates(landed.condition)[0].combatEvent?.eventType, "attack_landed");
        (0, assert_1.equal)(flattenPredicates(evaded.condition)[0].combatEvent?.eventType, "attack_evaded");
    });
    (0, mocha_1.it)("reconstructs every Gate A6 source token in original order", () => {
        for (const fixtureCase of gateA6Fixture.cases) {
            const passive = (0, team_analysis_1.parsePassive)("gate-a6:tokens:initial", undefined, fixtureCase.rawText);
            const fragments = uniqueFragments([
                ...passive.rules.flatMap(rule => rule.source),
                ...passive.unparsedFragments,
            ]);
            (0, assert_1.equal)(fragments.map(fragment => fragment.text).join("\n").replace(/\s/g, ""), fixtureCase.rawText.replace(/\s/g, ""), fixtureCase.name);
        }
    });
});
(0, mocha_1.describe)("team-analysis Gate A7 Super Attack effect channel", function () {
    for (const fixtureCase of gateA7Fixture.cases) {
        (0, mocha_1.it)(fixtureCase.name, () => {
            const attack = (0, team_analysis_1.parseSuperAttack)("gate-a7:fixture:initial", {
                variant: fixtureCase.variant,
                ordinal: 0,
                effectText: fixtureCase.rawText,
                conditionText: fixtureCase.conditionText,
            });
            (0, assert_1.equal)(attack.effectOrigin, "super_attack");
            (0, assert_1.equal)(attack.parseStatus, fixtureCase.expectedStatus);
            (0, assert_1.equal)(attack.effectStatus, fixtureCase.expectedEffectStatus);
            (0, assert_1.equal)(attack.condition.parseStatus, fixtureCase.expectedConditionStatus ?? "supported");
            (0, assert_1.deepEqual)(attack.effects.map(gateA7EffectShape), fixtureCase.effects);
            attack.effects.forEach(effect => {
                (0, assert_1.equal)(effect.origin, "super_attack");
                (0, assert_1.equal)(effect.activationTiming.moment, "when_super_attack_effect_resolves");
                (0, assert_1.equal)(effect.activationTiming.source, "documented_domain_rule");
            });
        });
    }
    (0, mocha_1.it)("preserves raw effect and condition text with exact line offsets", () => {
        for (const fixtureCase of gateA7Fixture.cases) {
            const attack = (0, team_analysis_1.parseSuperAttack)("gate-a7:offsets:initial", {
                variant: fixtureCase.variant,
                ordinal: 0,
                effectText: fixtureCase.rawText,
                conditionText: fixtureCase.conditionText,
            });
            (0, assert_1.equal)(attack.sourceFragments.map(fragment => fragment.text).join("\n"), fixtureCase.rawText.replace(/\r\n/g, "\n"), fixtureCase.name);
            (0, assert_1.equal)(attack.condition.sourceFragments.map(fragment => fragment.text).join("\n"), fixtureCase.conditionText.replace(/\r\n/g, "\n"), `${fixtureCase.name} condition`);
            for (const effect of attack.effects) {
                (0, assert_1.equal)(effect.source.map(fragment => fragment.text).join("\n").replace(/\s/g, ""), effect.sourceText.replace(/\s/g, ""), `${fixtureCase.name} effect`);
            }
        }
    });
    (0, mocha_1.it)("prefers typed payload effects over localized-text inference", () => {
        const attack = (0, team_analysis_1.parseSuperAttack)("gate-a7:structured:initial", {
            variant: "normal",
            ordinal: 0,
            effectText: "Opaque localized description without parseable magnitudes",
            conditionText: "",
            structuredEffects: [
                { id: "1", kind: "atk_raise", target: "self", value: 30, durationTurns: 1, status: "supported", source: { kind: "dokkan_fyi_payload", rowId: "1" } },
                { id: "2", kind: "enemy_def_lowering", target: "current_target", value: 20, durationTurns: 3, status: "supported", source: { kind: "dokkan_fyi_payload", rowId: "2" } },
                { id: "3", kind: "stun", target: "current_target", durationTurns: 2, status: "supported", source: { kind: "dokkan_fyi_payload", rowId: "3" } },
                { id: "4", kind: "super_attack_seal", target: "current_target", durationTurns: 1, status: "supported", source: { kind: "dokkan_fyi_payload", rowId: "4" } },
                { id: "5", kind: "action_break", target: "current_target", durationTurns: 1, status: "partial", source: { kind: "dokkan_fyi_payload", rowId: "5" } },
            ],
        });
        (0, assert_1.deepEqual)(attack.effects.map(gateA7EffectShape), [
            { kind: "atk_raise", target: "self", value: 30, unit: "percent", duration: { kind: "current_turn", source: "dokkan_fyi_payload" }, stacking: { kind: "stackable", source: "documented_domain_rule", scope: "current_turn" }, bucket: "super_attack_raise" },
            { kind: "enemy_def_lowering", target: "current_target", value: 20, unit: "percent", duration: { kind: "turns", turns: 3, source: "dokkan_fyi_payload" }, stacking: { kind: "not_stackable", source: "dokkan_fyi_payload" }, bucket: "super_attack_enemy_stat_lowering" },
            { kind: "stun", target: "current_target", duration: { kind: "turns", turns: 2, source: "dokkan_fyi_payload" } },
            { kind: "super_attack_seal", target: "current_target", duration: { kind: "current_turn", source: "dokkan_fyi_payload" } },
            { kind: "action_break", target: "current_target", duration: { kind: "current_turn", source: "dokkan_fyi_payload" } },
        ]);
        (0, assert_1.equal)(attack.effects[0].magnitude, undefined);
        (0, assert_1.equal)(attack.effects[0].value, 30);
        (0, assert_1.deepEqual)(attack.effects.map(effect => effect.provenance), [
            { source: "dokkan_fyi_payload", evidenceId: "1" },
            { source: "dokkan_fyi_payload", evidenceId: "2" },
            { source: "dokkan_fyi_payload", evidenceId: "3" },
            { source: "dokkan_fyi_payload", evidenceId: "4" },
            { source: "dokkan_fyi_payload", evidenceId: "5" },
        ]);
    });
    (0, mocha_1.it)("retains parsed effects omitted by a selective structured payload", () => {
        const attack = (0, team_analysis_1.parseSuperAttack)("gate-a7:structured-complement:initial", {
            variant: "normal",
            ordinal: 0,
            effectText: "Raises ATK for 1 turn and seals Super Attack",
            conditionText: "",
            structuredEffects: [
                { id: "atk-row", kind: "atk_raise", target: "self", value: 30, durationTurns: 1, status: "supported", source: { kind: "dokkan_fyi_payload", rowId: "atk-row" } },
            ],
        });
        (0, assert_1.deepEqual)(attack.effects.map(effect => effect.kind), ["atk_raise", "super_attack_seal"]);
        (0, assert_1.equal)(attack.effects[0].value, 30);
        (0, assert_1.deepEqual)(attack.effects[0].provenance, {
            source: "dokkan_fyi_payload",
            evidenceId: "atk-row",
        });
        (0, assert_1.equal)(attack.effects[1].provenance, undefined);
    });
    (0, mocha_1.it)("fills missing structured magnitude and duration from explicit text", () => {
        const attack = (0, team_analysis_1.parseSuperAttack)("gate-a7:structured-enrichment:initial", {
            variant: "normal",
            ordinal: 0,
            effectText: "Raises ATK for 3 turns",
            conditionText: "",
            structuredEffects: [
                { id: "incomplete-atk-row", kind: "atk_raise", target: "self", status: "supported", source: { kind: "dokkan_fyi_payload", rowId: "incomplete-atk-row" } },
            ],
        });
        (0, assert_1.equal)(attack.effects.length, 1);
        (0, assert_1.deepEqual)(gateA7EffectShape(attack.effects[0]), {
            kind: "atk_raise",
            target: "self",
            magnitude: "raise",
            duration: { kind: "turns", turns: 3, source: "explicit_text" },
            stacking: { kind: "stackable", source: "documented_domain_rule", scope: "active_windows" },
            bucket: "super_attack_raise",
        });
        (0, assert_1.deepEqual)(attack.effects[0].provenance, {
            source: "dokkan_fyi_payload",
            evidenceId: "incomplete-atk-row",
        });
    });
    (0, mocha_1.it)("keeps base and EZA Super Attack sources on their matching release states", () => {
        const characters = JSON.parse(JSON.stringify(fixture.characters));
        const character = characters.find(item => item.id === "1004001");
        character.superAttack = "Raises DEF for 1 turn";
        character.superAttackDetails = { name: "Base SA", effect: character.superAttack, ki: 12 };
        character.ezaSuperAttack = "Raises ATK & DEF for 3 turns";
        character.ezaSuperAttackDetails = { name: "EZA SA", effect: character.ezaSuperAttack, ki: 12 };
        const dataset = (0, team_analysis_1.buildTeamAnalysisDataset)(characters, fixture.catalogEntries, options);
        const initial = state(dataset.states, "1004001:1004001:initial");
        const eza = state(dataset.states, "1004001:1004001:eza");
        (0, assert_1.equal)(initial.superAttacks?.[0]?.name, "Base SA");
        (0, assert_1.equal)(initial.superAttacks?.[0]?.rawText, character.superAttack);
        (0, assert_1.equal)(eza.superAttacks?.[0]?.name, "EZA SA");
        (0, assert_1.equal)(eza.superAttacks?.[0]?.rawText, character.ezaSuperAttack);
        (0, assert_1.deepEqual)((0, team_analysis_1.validateTeamAnalysisDataset)(dataset, characters, fixture.catalogEntries), []);
    });
    (0, mocha_1.it)("carries the release-specific typed Active Skill activation condition", () => {
        const characters = JSON.parse(JSON.stringify(fixture.characters));
        const character = characters.find(item => item.id === "1004001");
        const condition = (rowId, turn) => ({
            status: "supported",
            expression: {
                op: "predicate",
                predicate: {
                    kind: "battle_turn",
                    comparator: "gte",
                    value: turn,
                    evidenceStatus: "supported",
                    provenance: {
                        table: "skill_causalities",
                        rowId,
                        causalityType: 5,
                        values: [turn - 1, 0, 0],
                    },
                },
            },
            provenance: {
                activeSkillSet: { table: "active_skill_sets", rowId: "42" },
                causalities: [{ table: "skill_causalities", rowId }],
            },
        });
        character.activeSkillDetails = [{
                id: "42",
                name: "Base Active Skill",
                description: "Base effect",
                activationCondition: condition("100", 4),
                effects: [],
                source: {
                    kind: "game_db",
                    relation: { table: "card_active_skills", rowId: "1" },
                    set: { table: "active_skill_sets", rowId: "42" },
                },
            }];
        character.ezaActiveSkillDetails = [{
                ...character.activeSkillDetails[0],
                name: "EZA Active Skill",
                activationCondition: condition("101", 3),
            }];
        const dataset = (0, team_analysis_1.buildTeamAnalysisDataset)(characters, fixture.catalogEntries, options);
        (0, assert_1.deepEqual)(state(dataset.states, "1004001:1004001:initial").activeSkillActivationCondition, condition("100", 4));
        (0, assert_1.deepEqual)(state(dataset.states, "1004001:1004001:eza").activeSkillActivationCondition, condition("101", 3));
        (0, assert_1.deepEqual)((0, team_analysis_1.validateTeamAnalysisDataset)(dataset, characters, fixture.catalogEntries), []);
        state(dataset.states, "1004001:1004001:eza").activeSkillActivationCondition = condition("102", 2);
        (0, assert_1.ok)((0, team_analysis_1.validateTeamAnalysisDataset)(dataset, characters, fixture.catalogEntries)
            .some(issue => issue.code === "active-skill-condition-source"));
    });
    (0, mocha_1.it)("injects an external first-party Active Skill contract without mutating Characters", () => {
        const characters = JSON.parse(JSON.stringify(fixture.characters));
        const character = characters.find(item => item.id === "1004001");
        delete character.activeSkillDetails;
        delete character.ezaActiveSkillDetails;
        const activation = {
            status: "supported",
            expression: {
                op: "predicate",
                predicate: {
                    kind: "attacks_received",
                    comparator: "gte",
                    value: 7,
                    evidenceStatus: "supported",
                    provenance: {
                        table: "skill_causalities",
                        rowId: "803",
                        causalityType: 44,
                        values: [3, 7, 0],
                    },
                },
            },
            provenance: {
                activeSkillSet: { table: "active_skill_sets", rowId: "94" },
                causalities: [{ table: "skill_causalities", rowId: "803" }],
            },
        };
        const contract = new Map([[character.id, activation]]);
        const dataset = (0, team_analysis_1.buildTeamAnalysisDataset)(characters, fixture.catalogEntries, {
            ...options,
            activeSkillActivationContract: contract,
        });
        (0, assert_1.deepEqual)(state(dataset.states, "1004001:1004001:initial").activeSkillActivationCondition, activation);
        (0, assert_1.deepEqual)((0, team_analysis_1.validateTeamAnalysisDataset)(dataset, characters, fixture.catalogEntries, {
            activeSkillActivationContract: contract,
        }), []);
        (0, assert_1.ok)((0, team_analysis_1.validateTeamAnalysisDataset)(dataset, characters, fixture.catalogEntries)
            .some(issue => issue.code === "active-skill-condition-source"));
        (0, assert_1.deepEqual)((0, team_analysis_1.validateTeamAnalysisDatasetForDelivery)(dataset, characters), []);
        const injected = state(dataset.states, "1004001:1004001:initial")
            .activeSkillActivationCondition?.expression;
        if (!injected || injected.op !== "predicate")
            throw new Error("expected injected predicate");
        injected.predicate.value = 0;
        (0, assert_1.ok)((0, team_analysis_1.validateTeamAnalysisDatasetForDelivery)(dataset, characters)
            .some(issue => issue.code === "active-skill-condition-source"));
        (0, assert_1.equal)(character.activeSkillDetails, undefined);
    });
    (0, mocha_1.it)("carries the typed Super Attack level curve on every release state", () => {
        const characters = JSON.parse(JSON.stringify(fixture.characters));
        const character = characters.find(item => item.id === "1004001");
        character.superAttack = "Raises DEF for 1 turn";
        character.superAttackDetails = {
            name: "Base SA",
            effect: character.superAttack,
            ki: 12,
            attackIncrease: { level1Percent: 150, maxLevelPercent: 375, maxLevel: 10 },
        };
        character.ezaSuperAttack = "Raises ATK & DEF for 3 turns";
        character.ezaSuperAttackDetails = {
            name: "EZA SA",
            effect: character.ezaSuperAttack,
            ki: 12,
            attackIncrease: { level1Percent: 150, maxLevelPercent: 500, maxLevel: 15 },
        };
        const dataset = (0, team_analysis_1.buildTeamAnalysisDataset)(characters, fixture.catalogEntries, options);
        (0, assert_1.deepEqual)(state(dataset.states, "1004001:1004001:initial").superAttacks?.[0]?.attackIncrease, { level1Percent: 150, maxLevelPercent: 375, maxLevel: 10 });
        (0, assert_1.deepEqual)(state(dataset.states, "1004001:1004001:eza").superAttacks?.[0]?.attackIncrease, { level1Percent: 150, maxLevelPercent: 500, maxLevel: 15 });
        (0, assert_1.deepEqual)((0, team_analysis_1.validateTeamAnalysisDataset)(dataset, characters, fixture.catalogEntries), []);
    });
    (0, mocha_1.it)("selects release-specific Unit Super Attacks and never leaks base attacks into EZA or SEZA", () => {
        const characters = JSON.parse(JSON.stringify(fixture.characters));
        const character = characters.find(item => item.id === "1005001");
        character.ezaReleaseDate = "2026-01-01T00:00:00.000Z";
        character.sezaReleaseDate = "2027-01-01T00:00:00.000Z";
        character.unitSuperAttacks = ["Base A", "Base B", "Base C"].map(name => ({ name, effect: `${name} effect`, unitSuperAttack: name, unitSuperAttackCondition: "Base condition" }));
        character.ezaUnitSuperAttacks = ["EZA A", "EZA B", "EZA C"].map(name => ({ name, effect: `${name} effect`, unitSuperAttack: name, unitSuperAttackCondition: "EZA condition" }));
        const ezaDataset = (0, team_analysis_1.buildTeamAnalysisDataset)(JSON.parse(JSON.stringify(characters)).map((item) => {
            delete item.sezaReleaseDate;
            return item;
        }), fixture.catalogEntries, options);
        const dataset = (0, team_analysis_1.buildTeamAnalysisDataset)(characters, fixture.catalogEntries, options);
        const eza = state(ezaDataset.states, "1005001:1005001:eza");
        const seza = state(dataset.states, "1005001:1005001:seza");
        (0, assert_1.deepEqual)(eza.superAttacks?.filter(item => item.variant === "unit").map(item => item.name), ["EZA A", "EZA B", "EZA C"]);
        (0, assert_1.deepEqual)(seza.superAttacks?.filter(item => item.variant === "unit").map(item => item.name), ["EZA A", "EZA B", "EZA C"]);
        (0, assert_1.equal)(seza.superAttacks?.some(item => item.name?.startsWith("Base")), false);
    });
    (0, mocha_1.it)("keeps SEZA passive details and the still-applicable EZA Super Attacks on the SEZA state", () => {
        const characters = JSON.parse(JSON.stringify(fixture.characters));
        const character = characters.find(item => item.id === "1005001");
        character.ezaPassive = undefined;
        character.ezaPassiveDetails = undefined;
        character.sezaPassiveDetails = (0, fyi_scraper_1.passiveDetailsFromSkill)({
            id: 5001,
            name: "SEZA passive",
            description: "*When the target enemy is in the following status: {passiveImg:atk_down}*\n- DEF 250%",
        }, {
            characterId: character.id,
            formId: character.id,
            releaseState: "seza",
            sourceVersion: "9b8400b8f2f713f705f9ee5b2c56470d",
            payloadField: "props.character.extreme_z_awakening.passive_skill.description",
        });
        character.sezaPassive = character.sezaPassiveDetails?.text;
        character.superAttack = "Raises DEF for 1 turn";
        character.superAttackDetails = { name: "Base SA", effect: character.superAttack, ki: 12 };
        character.ezaSuperAttackDetails = (0, fyi_scraper_1.mapSuperAttackDetails)({
            id: 5002,
            name: "EZA SA",
            description: "{passiveImg:once}Raises ATK & DEF for 3 turns",
            condition: "When HP is 50% or more",
            ki: 12,
        }, {
            characterId: character.id,
            formId: character.id,
            releaseState: "seza",
            sourceVersion: "9b8400b8f2f713f705f9ee5b2c56470d",
            attackVariant: "normal",
            payloadField: "props.character.super_attacks[].description",
        });
        character.ezaSuperAttack = character.ezaSuperAttackDetails?.effect;
        const dataset = (0, team_analysis_1.buildTeamAnalysisDataset)(characters, fixture.catalogEntries, options);
        const initial = state(dataset.states, "1005001:1005001:initial");
        const seza = state(dataset.states, "1005001:1005001:seza");
        (0, assert_1.equal)(dataset.states.some(item => item.stateKey === "1005001:1005001:eza"), false);
        (0, assert_1.equal)(seza.hardDuplicateGroupId, initial.hardDuplicateGroupId);
        (0, assert_1.equal)(seza.passive?.name, "SEZA passive");
        (0, assert_1.equal)(seza.passive?.rawText, character.sezaPassive);
        (0, assert_1.equal)(seza.passive?.conditionEvidence?.[0].stateKey, seza.stateKey);
        (0, assert_1.equal)(seza.superAttacks?.[0]?.name, "EZA SA");
        (0, assert_1.equal)(seza.superAttacks?.[0]?.rawText, character.ezaSuperAttack);
        (0, assert_1.equal)(seza.superAttacks?.[0]?.condition.rawText, "When HP is 50% or more");
        (0, assert_1.equal)(seza.superAttacks?.[0]?.structuralEvidence?.[0].stateKey, seza.stateKey);
        (0, assert_1.deepEqual)((0, team_analysis_1.validateTeamAnalysisDataset)(dataset, characters, fixture.catalogEntries), []);
    });
    (0, mocha_1.it)("keeps an explicit EZA attack separate when no EZA passive is available", () => {
        const characters = JSON.parse(JSON.stringify(fixture.characters));
        const character = characters[0];
        character.ezaReleaseDate = "2026-01-01T00:00:00.000Z";
        character.superAttack = "Raises DEF for 1 turn";
        character.superAttackDetails = { name: "Generic current fallback", effect: character.superAttack, ki: 12 };
        character.ezaSuperAttack = "Raises ATK for 3 turns";
        character.ezaSuperAttackDetails = { name: "Explicit EZA", effect: character.ezaSuperAttack, ki: 12 };
        const dataset = (0, team_analysis_1.buildTeamAnalysisDataset)(characters, fixture.catalogEntries, options);
        const initial = state(dataset.states, "1001001:1001001:initial");
        const eza = state(dataset.states, "1001001:1001001:eza");
        (0, assert_1.equal)(initial.superAttacks?.[0]?.name, "Generic current fallback");
        (0, assert_1.equal)(eza.passive, undefined);
        (0, assert_1.equal)(eza.superAttacks?.[0]?.name, "Explicit EZA");
        (0, assert_1.equal)(eza.superAttacks?.[0]?.rawText, character.ezaSuperAttack);
        (0, assert_1.deepEqual)((0, team_analysis_1.validateTeamAnalysisDataset)(dataset, characters, fixture.catalogEntries), []);
    });
    (0, mocha_1.it)("does not promote an EZA attack into SEZA without a material SEZA source", () => {
        const characters = JSON.parse(JSON.stringify(fixture.characters));
        const character = characters[0];
        character.ezaReleaseDate = "2026-01-01T00:00:00.000Z";
        character.sezaReleaseDate = "2027-01-01T00:00:00.000Z";
        character.ezaPassive = undefined;
        character.ezaPassiveDetails = undefined;
        character.sezaPassive = undefined;
        character.sezaPassiveDetails = undefined;
        character.ezaSuperAttack = "Raises ATK for 3 turns";
        character.ezaSuperAttackDetails = { name: "Explicit EZA", effect: character.ezaSuperAttack, ki: 12 };
        const dataset = (0, team_analysis_1.buildTeamAnalysisDataset)(characters, fixture.catalogEntries, options);
        (0, assert_1.equal)(state(dataset.states, "1001001:1001001:eza").superAttacks?.[0]?.name, "Explicit EZA");
        (0, assert_1.equal)(dataset.states.some(item => item.stateKey === "1001001:1001001:seza"), false);
        (0, assert_1.deepEqual)((0, team_analysis_1.validateTeamAnalysisDataset)(dataset, characters, fixture.catalogEntries), []);
    });
    (0, mocha_1.it)("ignores empty awakened detail objects as release-state evidence", () => {
        const characters = JSON.parse(JSON.stringify(fixture.characters));
        const character = characters[0];
        character.ezaReleaseDate = "2099-01-01T00:00:00.000Z";
        character.ezaPassive = undefined;
        character.ezaPassiveDetails = undefined;
        character.ezaSuperAttack = undefined;
        character.ezaSuperAttackDetails = { name: "Pending EZA", effect: "", ki: 12 };
        const dataset = (0, team_analysis_1.buildTeamAnalysisDataset)(characters, fixture.catalogEntries, options);
        state(dataset.states, `${character.id}:${character.id}:initial`);
        (0, assert_1.equal)(dataset.states.some(item => item.stateKey === `${character.id}:${character.id}:eza`), false);
        (0, assert_1.deepEqual)((0, team_analysis_1.validateTeamAnalysisDataset)(dataset, characters, fixture.catalogEntries), []);
    });
    (0, mocha_1.it)("uses a material legacy EZA attack when its detail object is empty", () => {
        const characters = JSON.parse(JSON.stringify(fixture.characters));
        const character = characters[0];
        character.ezaReleaseDate = "2026-01-01T00:00:00.000Z";
        character.ezaPassive = undefined;
        character.ezaPassiveDetails = undefined;
        character.ezaSuperAttack = "Raises ATK for 3 turns";
        character.ezaSuperAttackDetails = { name: "Incomplete detail", effect: "   ", ki: 12 };
        const dataset = (0, team_analysis_1.buildTeamAnalysisDataset)(characters, fixture.catalogEntries, options);
        const eza = state(dataset.states, `${character.id}:${character.id}:eza`);
        (0, assert_1.equal)(eza.superAttacks?.[0]?.rawText, character.ezaSuperAttack);
        (0, assert_1.deepEqual)((0, team_analysis_1.validateTeamAnalysisDataset)(dataset, characters, fixture.catalogEntries), []);
    });
    (0, mocha_1.it)("uses a material legacy EZA passive when its detail object is empty", () => {
        const characters = JSON.parse(JSON.stringify(fixture.characters));
        const character = characters[0];
        character.ezaReleaseDate = "2026-01-01T00:00:00.000Z";
        character.ezaPassive = "Basic effect(s)\n- ATK & DEF 180%";
        character.ezaPassiveDetails = { name: "Incomplete detail", text: "   " };
        const dataset = (0, team_analysis_1.buildTeamAnalysisDataset)(characters, fixture.catalogEntries, options);
        const eza = state(dataset.states, `${character.id}:${character.id}:eza`);
        (0, assert_1.equal)(eza.passive?.rawText, character.ezaPassive);
        (0, assert_1.equal)(eza.passive?.name, undefined);
        (0, assert_1.deepEqual)((0, team_analysis_1.validateTeamAnalysisDataset)(dataset, characters, fixture.catalogEntries), []);
    });
    (0, mocha_1.it)("does not promote base combat data to an unreleased EZA state from a date alone", () => {
        const characters = JSON.parse(JSON.stringify(fixture.characters));
        const character = characters[0];
        character.ezaReleaseDate = "2099-01-01T00:00:00.000Z";
        character.ezaPassive = undefined;
        character.ezaPassiveDetails = undefined;
        character.ezaSuperAttack = undefined;
        character.ezaSuperAttackDetails = undefined;
        character.passiveDetails = (0, fyi_scraper_1.passiveDetailsFromSkill)({
            id: 5003,
            name: "Base passive",
            description: "*Basic effect(s)*\n- ATK & DEF 100%{passiveImg:up_g}",
        }, {
            characterId: character.id,
            formId: character.id,
            releaseState: "initial",
            sourceVersion: "9b8400b8f2f713f705f9ee5b2c56470d",
            payloadField: "props.character.passive_skill.description",
        });
        character.passive = character.passiveDetails?.text ?? "";
        const dataset = (0, team_analysis_1.buildTeamAnalysisDataset)(characters, fixture.catalogEntries, options);
        const initial = state(dataset.states, `${character.id}:${character.id}:initial`);
        (0, assert_1.equal)(dataset.states.some(item => item.stateKey === `${character.id}:${character.id}:eza`), false);
        (0, assert_1.equal)(initial.passive?.structuralEvidence?.[0].releaseState, "initial");
        (0, assert_1.deepEqual)((0, team_analysis_1.validateTeamAnalysisDataset)(dataset, characters, fixture.catalogEntries), []);
    });
    (0, mocha_1.it)("rejects cross-channel origin, invented probability, invalid duration/cap, bucket, and offsets", () => {
        const characters = JSON.parse(JSON.stringify(fixture.characters));
        characters[0].superAttack = "Causes damage and 50% chance to stun the enemy";
        characters[0].superAttackDetails = { effect: characters[0].superAttack, ki: 12 };
        const dataset = (0, team_analysis_1.buildTeamAnalysisDataset)(characters, fixture.catalogEntries, options);
        const attack = dataset.states.find(item => item.characterId === characters[0].id)?.superAttacks?.[0];
        (0, assert_1.ok)(attack);
        const effect = attack.effects[0];
        attack.effectOrigin = "active_skill";
        effect.origin = "passive";
        effect.probabilitySource = "unresolved";
        effect.duration = { kind: "turns", turns: 1, source: "explicit_text" };
        effect.stacking = { kind: "stackable", capPercent: -1, source: "explicit_text" };
        effect.calculationBucket = { bucket: "super_attack_raise", source: "documented_domain_rule" };
        effect.source[0].start = 1;
        attack.unparsedFragments = [];
        const codes = (0, team_analysis_1.validateTeamAnalysisDataset)(dataset, characters, fixture.catalogEntries)
            .map(issue => issue.code);
        for (const code of [
            "super-attack-origin",
            "super-attack-effect-origin",
            "super-attack-probability-unresolved-value",
            "super-attack-effect-parse-status",
            "super-attack-duration-turns",
            "super-attack-stacking-kind",
            "super-attack-bucket-kind",
            "fragment-text",
            "super-attack-effect-partition-token-loss",
        ]) {
            (0, assert_1.ok)(codes.includes(code), code);
        }
    });
    (0, mocha_1.it)("reports additive Super Attack coverage without changing passive rule counts", () => {
        const characters = JSON.parse(JSON.stringify(fixture.characters));
        characters[0].superAttack = "Raises ATK & DEF for 1 turn and lowers ATK";
        characters[0].superAttackDetails = { effect: characters[0].superAttack, ki: 12 };
        const baseline = (0, team_analysis_1.buildTeamAnalysisCoverageReport)((0, team_analysis_1.buildTeamAnalysisDataset)(fixture.characters, fixture.catalogEntries, options));
        const coverage = (0, team_analysis_1.buildTeamAnalysisCoverageReport)((0, team_analysis_1.buildTeamAnalysisDataset)(characters, fixture.catalogEntries, options));
        (0, assert_1.equal)(coverage.parsedRuleCount, baseline.parsedRuleCount);
        (0, assert_1.equal)(coverage.superAttacks.attackCount, baseline.superAttacks.attackCount + 1);
        (0, assert_1.equal)(coverage.superAttacks.effectKindCounts.atk_raise, 1);
        (0, assert_1.equal)(coverage.superAttacks.effectKindCounts.def_raise, 1);
        (0, assert_1.equal)(coverage.superAttacks.effectKindCounts.enemy_atk_lowering, 1);
    });
});
(0, mocha_1.describe)("team-analysis Gate A7.1 structural lifecycle evidence", function () {
    const sourceVersion = "a".repeat(32);
    for (const fixtureCase of gateA71Fixture.superAttackCases) {
        (0, mocha_1.it)(fixtureCase.name, () => {
            const details = (0, fyi_scraper_1.mapSuperAttackDetails)({
                id: 7001,
                description: fixtureCase.rawSource,
                ki: fixtureCase.variant === "ultra" ? 18 : 12,
                style: fixtureCase.variant,
            }, {
                characterId: "7000001",
                formId: "7000001",
                releaseState: "initial",
                sourceVersion,
                attackVariant: fixtureCase.variant,
                payloadField: "props.character.super_attacks[].description",
            });
            (0, assert_1.ok)(details);
            (0, assert_1.equal)(details.effect, fixtureCase.displayText, "display text must remain byte-for-byte normalized as before");
            const parse = () => (0, team_analysis_1.parseSuperAttack)("7000001:7000001:initial", {
                variant: fixtureCase.variant,
                ordinal: 0,
                effectText: details.effect ?? "",
                conditionText: "",
                structuralSource: details.structuralSource,
                sourceAttackId: details.sourceAttackId,
            });
            const attack = parse();
            (0, assert_1.equal)(attack.effects.length, fixtureCase.effectCount ?? 1);
            const lifecycleEffects = attack.effects.filter(effect => effect.kind !== fixtureCase.unmarkedEffectKind);
            for (const effect of lifecycleEffects) {
                (0, assert_1.equal)(effect.activationLimit?.kind, fixtureCase.activationLimit);
                (0, assert_1.equal)(effect.duration.kind, fixtureCase.duration);
                (0, assert_1.equal)(effect.duration.turns, fixtureCase.turns);
                (0, assert_1.equal)(effect.applicationTrigger?.kind, fixtureCase.applicationTrigger);
                (0, assert_1.equal)(effect.stacking?.scope, fixtureCase.stackingScope);
                (0, assert_1.equal)(effect.stacking?.capPercent, fixtureCase.capPercent);
                if (fixtureCase.applicationTrigger === "per_super_attack") {
                    (0, assert_1.equal)(effect.applicationTrigger?.provenance.ruleVersion, "sa-stat-raise-lifecycle-v1");
                }
            }
            if (fixtureCase.unmarkedEffectKind) {
                const unmarked = attack.effects.find(effect => effect.kind === fixtureCase.unmarkedEffectKind);
                (0, assert_1.ok)(unmarked);
                (0, assert_1.equal)(unmarked.activationLimit, undefined, "the following clause must not inherit once");
            }
            for (let index = 1; index < (fixtureCase.applicationSamples ?? 1); index += 1) {
                (0, assert_1.deepEqual)(parse().effects.map(gateA71LifecycleShape), attack.effects.map(gateA71LifecycleShape));
            }
            if (details.structuralSource) {
                (0, assert_1.equal)(attack.structuralEvidence?.[0].rawTextSha256, details.structuralSource.rawTextSha256);
                (0, assert_1.equal)(attack.structuralEvidence?.[0].attackVariant, fixtureCase.variant);
            }
        });
    }
    for (const fixtureCase of gateA71Fixture.passiveCases) {
        (0, mocha_1.it)(fixtureCase.name, () => {
            const details = (0, fyi_scraper_1.passiveDetailsFromSkill)({ id: 7101, description: fixtureCase.rawSource }, {
                characterId: "7100001",
                formId: "7100001",
                releaseState: "initial",
                sourceVersion,
                payloadField: "props.character.passive_skill.description",
            });
            (0, assert_1.ok)(details?.structuralSource);
            (0, assert_1.equal)(details.text, fixtureCase.displayText);
            const evidence = details.structuralSource.evidence[0];
            (0, assert_1.deepEqual)(evidence.markers.map(marker => marker.markerKind), fixtureCase.markers);
            (0, assert_1.equal)(evidence.resolution, fixtureCase.evidenceResolution ?? "supported");
            (0, assert_1.equal)(evidence.anchor.endLineIndex, fixtureCase.endLineIndex);
            const passive = (0, team_analysis_1.parsePassive)("7100001:7100001:initial", details.name, details.text ?? "", details, { characterId: "7100001", formId: "7100001", releaseState: "initial" });
            const typedEffects = passive.rules.flatMap(rule => rule.effects).filter(effect => effect.kind !== "unknown");
            if (fixtureCase.minimumEffectCount !== undefined) {
                (0, assert_1.ok)(typedEffects.length >= fixtureCase.minimumEffectCount);
            }
            const markedEffects = typedEffects.filter(effect => effect.activationLimit || effect.duration?.source === "dokkan_fyi_structural_marker");
            for (const effect of markedEffects) {
                (0, assert_1.equal)(effect.activationLimit?.kind, fixtureCase.activationLimit);
                (0, assert_1.equal)(effect.duration?.kind, fixtureCase.duration);
                (0, assert_1.equal)(effect.applicationTrigger?.kind, fixtureCase.applicationTrigger ?? "unknown");
            }
            if (fixtureCase.unmarkedEffectKind) {
                const unmarked = typedEffects.find(effect => effect.kind === fixtureCase.unmarkedEffectKind);
                (0, assert_1.ok)(unmarked);
                (0, assert_1.equal)(unmarked.activationLimit, undefined, "the next bullet must not inherit once");
                (0, assert_1.equal)(unmarked.applicationTrigger, undefined, "display-only markers must not invent lifecycle");
            }
            (0, assert_1.equal)(passive.rawText, fixtureCase.displayText);
            (0, assert_1.equal)(passive.structuralEvidence?.[0].anchor.structuralText.includes("passiveImg"), true);
        });
    }
    for (const invalidCase of gateA71Fixture.invalidEvidenceCases) {
        (0, mocha_1.it)(`ignores invalid structural evidence: ${invalidCase}`, () => {
            const details = (0, fyi_scraper_1.passiveDetailsFromSkill)({
                id: 7201,
                description: "*Basic effect(s)*\n- {passiveImg:once}{passiveImg:forever}ATK 20%{passiveImg:up_g}",
            }, {
                characterId: "7200001",
                formId: "7200001",
                releaseState: "initial",
                sourceVersion,
                payloadField: "props.character.passive_skill.description",
            });
            (0, assert_1.ok)(details?.structuralSource);
            const source = JSON.parse(JSON.stringify(details.structuralSource));
            const evidence = source.evidence[0];
            if (invalidCase === "hash")
                evidence.rawTextSha256 = "f".repeat(64);
            if (invalidCase === "anchor")
                evidence.anchor.normalizedText = "other effect";
            if (invalidCase === "marker-order")
                evidence.markers[0].order = 2;
            if (invalidCase === "source-version")
                evidence.provenance.sourceVersion = "incompatible";
            const sourceSkillId = invalidCase === "source-id" ? "9999" : details.sourceSkillId;
            const passive = (0, team_analysis_1.parsePassive)("7200001:7200001:initial", undefined, details.text ?? "", { ...details, structuralSource: source, sourceSkillId }, { characterId: "7200001", formId: "7200001", releaseState: "initial" });
            (0, assert_1.equal)(passive.structuralEvidence, undefined);
            passive.rules.flatMap(rule => rule.effects).forEach(effect => {
                (0, assert_1.equal)(effect.activationLimit, undefined);
                (0, assert_1.equal)(effect.duration?.source === "dokkan_fyi_structural_marker", false);
            });
        });
    }
    (0, mocha_1.it)("accepts legacy passive evidence with lifecycle markers only", () => {
        const details = (0, fyi_scraper_1.passiveDetailsFromSkill)({
            id: 7251,
            description: "*Basic effect(s)*\n- {passiveImg:once}ATK 20%{passiveImg:up_g}",
        }, {
            characterId: "7250001",
            formId: "7250001",
            releaseState: "initial",
            sourceVersion,
            payloadField: "props.character.passive_skill.description",
        });
        (0, assert_1.ok)(details?.structuralSource);
        const legacySource = JSON.parse(JSON.stringify(details.structuralSource));
        legacySource.evidence[0].markers = legacySource.evidence[0].markers.filter(marker => marker.markerKind === "once");
        const passive = (0, team_analysis_1.parsePassive)("7250001:7250001:initial", details.name, details.text ?? "", { ...details, structuralSource: legacySource }, { characterId: "7250001", formId: "7250001", releaseState: "initial" });
        (0, assert_1.deepEqual)(passive.structuralEvidence?.[0].markers.map(marker => marker.markerKind), ["once"]);
        (0, assert_1.equal)(passive.rules.flatMap(rule => rule.effects)[0].activationLimit?.kind, "once");
    });
    (0, mocha_1.it)("accepts first-party game DB passive markers without relabeling their provenance as FYI", () => {
        const details = (0, fyi_scraper_1.passiveDetailsFromSkill)({
            id: 7253,
            description: "*Basic effect(s)*\n- {passiveImg:once}ATK 20%{passiveImg:up_g} for 3 turns",
        }, {
            characterId: "7250003",
            formId: "7250003",
            releaseState: "eza",
            sourceVersion,
            payloadField: "props.character.extreme_z_awakening.passive_skill.description",
        });
        (0, assert_1.ok)(details?.structuralSource);
        const firstPartySource = JSON.parse(JSON.stringify(details.structuralSource));
        firstPartySource.evidence.forEach(evidence => {
            evidence.provenance = {
                source: "first_party_game_db",
                sourceVersion: "1787282006",
                payloadField: "passive_skill_sets.itemized_description",
                markerSyntax: "passiveImg",
            };
        });
        const passive = (0, team_analysis_1.parsePassive)("7250003:7250003:eza", details.name, details.text ?? "", { ...details, structuralSource: firstPartySource }, { characterId: "7250003", formId: "7250003", releaseState: "eza" });
        (0, assert_1.equal)(passive.structuralEvidence?.length, 1);
        (0, assert_1.equal)(passive.structuralEvidence?.[0].provenance.source, "first_party_game_db");
        const effect = passive.rules.flatMap(rule => rule.effects).find(item => item.kind === "atk");
        (0, assert_1.equal)(effect?.activationLimit?.kind, "once");
        (0, assert_1.equal)(effect?.activationLimit?.source, "first_party_game_db");
        (0, assert_1.equal)(effect?.activationLimit?.provenance.source, "first_party_game_db");
    });
    (0, mocha_1.it)("retains decrease markers as display annotations without inventing lifecycle", () => {
        const details = (0, fyi_scraper_1.passiveDetailsFromSkill)({
            id: 7252,
            description: "*Basic effect(s)*\n- Damage reduction rate 2%{passiveImg:down_r}\n- ATK 30%{passiveImg:down_y}",
        }, {
            characterId: "7250002",
            formId: "7250002",
            releaseState: "initial",
            sourceVersion,
            payloadField: "props.character.passive_skill.description",
        });
        (0, assert_1.ok)(details?.structuralSource);
        const passive = (0, team_analysis_1.parsePassive)("7250002:7250002:initial", details.name, details.text ?? "", details, { characterId: "7250002", formId: "7250002", releaseState: "initial" });
        (0, assert_1.deepEqual)(passive.structuralEvidence?.flatMap(evidence => evidence.markers.map(marker => marker.markerKind)), ["value_down", "value_down"]);
        passive.rules.flatMap(rule => rule.effects).forEach(effect => {
            (0, assert_1.equal)(effect.activationLimit, undefined);
            (0, assert_1.equal)(effect.applicationTrigger, undefined);
            (0, assert_1.equal)(effect.duration?.source === "dokkan_fyi_structural_marker", false);
        });
    });
    (0, mocha_1.it)(gateA71Fixture.divergenceCase.name, () => {
        const details = (0, fyi_scraper_1.passiveDetailsFromSkill)({ id: 7301, description: gateA71Fixture.divergenceCase.rawSource }, {
            characterId: "7300001",
            formId: "7300001",
            releaseState: "initial",
            sourceVersion,
            payloadField: "props.character.passive_skill.description",
        });
        (0, assert_1.ok)(details?.structuralSource);
        details.structuralSource.evidence[0].corroboration = [{
                source: "first_party_game_db",
                resolution: gateA71Fixture.divergenceCase.firstPartyResolution,
                passiveSkillSetId: "7301",
                passiveSkillIds: ["17007301"],
                fields: { is_once: false },
                sourceVersion: "first-party-fixture-v1",
                reason: "No clause-to-row key proves that the isolated row owns the rendered marker.",
            }];
        const passive = (0, team_analysis_1.parsePassive)("7300001:7300001:initial", undefined, details.text ?? "", details, { characterId: "7300001", formId: "7300001", releaseState: "initial" });
        (0, assert_1.equal)(passive.structuralEvidence?.[0].corroboration?.[0].resolution, "divergent");
        (0, assert_1.equal)(passive.rules.flatMap(rule => rule.effects)[0].activationLimit?.kind, "once");
    });
    (0, mocha_1.it)("retains exact raw structural bytes and lossless normalized offsets", () => {
        const rawSource = "*Basic effect(s)*\r\n- {passiveImg:once}{passiveImg:forever}ATK & DEF 20%{passiveImg:up_g}";
        const details = (0, fyi_scraper_1.passiveDetailsFromSkill)({ id: 7401, description: rawSource }, {
            characterId: "7400001",
            formId: "7400001",
            releaseState: "initial",
            sourceVersion,
            payloadField: "props.character.passive_skill.description",
        });
        (0, assert_1.ok)(details?.structuralSource);
        (0, assert_1.equal)(details.structuralSource.rawText, rawSource);
        const evidence = details.structuralSource.evidence[0];
        (0, assert_1.equal)(details.structuralSource.rawText.slice(evidence.anchor.sourceSpan.start, evidence.anchor.sourceSpan.end).trimEnd(), evidence.anchor.structuralText);
        (0, assert_1.deepEqual)(evidence.markers.map(marker => details.structuralSource.rawText.slice(marker.sourceSpan.start, marker.sourceSpan.end)), [
            "{passiveImg:once}", "{passiveImg:forever}", "{passiveImg:up_g}",
        ]);
    });
});
(0, mocha_1.describe)("team-analysis validation and artifacts", function () {
    (0, mocha_1.it)("rejects invalid Gate A7.1 lifecycle payloads and reports ignored source evidence", () => {
        const characters = JSON.parse(JSON.stringify(fixture.characters));
        const details = (0, fyi_scraper_1.passiveDetailsFromSkill)({
            id: 7501,
            description: "*Basic effect(s)*\n- {passiveImg:once}{passiveImg:forever}ATK 20%{passiveImg:up_g}",
        }, {
            characterId: characters[0].id,
            formId: characters[0].id,
            releaseState: "initial",
            sourceVersion: "b".repeat(32),
            payloadField: "props.character.passive_skill.description",
        });
        (0, assert_1.ok)(details?.text && details.structuralSource);
        characters[0].passive = details.text;
        characters[0].passiveDetails = details;
        const valid = (0, team_analysis_1.buildTeamAnalysisDataset)(characters, fixture.catalogEntries, options);
        (0, assert_1.deepEqual)((0, team_analysis_1.validateTeamAnalysisDataset)(valid, characters, fixture.catalogEntries), []);
        const broken = JSON.parse(JSON.stringify(valid));
        const effect = broken.states[0].passive.rules.flatMap(rule => rule.effects)
            .find(item => item.kind === "atk");
        effect.activationLimit = {
            kind: "count",
            count: 0,
            source: "dokkan_fyi_structural_marker",
            provenance: { source: "explicit_text" },
        };
        effect.applicationTrigger = {
            kind: "per_super_attack",
            source: "unresolved",
            provenance: { source: "unresolved" },
        };
        const brokenCodes = (0, team_analysis_1.validateTeamAnalysisDataset)(broken, characters, fixture.catalogEntries)
            .map(issue => issue.code);
        (0, assert_1.ok)(brokenCodes.includes("activation-limit-count"));
        (0, assert_1.ok)(brokenCodes.includes("effect-decision-provenance"));
        (0, assert_1.ok)(brokenCodes.includes("application-trigger"));
        const invalidSourceCharacters = JSON.parse(JSON.stringify(characters));
        invalidSourceCharacters[0].passiveDetails.structuralSource.evidence[0].rawTextSha256 = "0".repeat(64);
        const ignored = (0, team_analysis_1.buildTeamAnalysisDataset)(invalidSourceCharacters, fixture.catalogEntries, options);
        (0, assert_1.equal)(ignored.states[0].passive?.structuralEvidence, undefined);
        const sourceCodes = (0, team_analysis_1.validateTeamAnalysisDataset)(ignored, invalidSourceCharacters, fixture.catalogEntries)
            .map(issue => issue.code);
        (0, assert_1.ok)(sourceCodes.includes("structural-evidence-source"));
    });
    (0, mocha_1.it)("validates structural evidence identity, hash, anchor, release, and serialized order", () => {
        const characters = JSON.parse(JSON.stringify(fixture.characters));
        const evidenceContext = {
            characterId: characters[0].id,
            formId: characters[0].id,
            releaseState: "initial",
            sourceVersion: "fyi-fixture-v1",
            payloadField: "props.character.passive_skill.description",
        };
        const details = (0, fyi_scraper_1.passiveDetailsFromSkill)({
            id: 4123,
            name: "Evidence validation",
            description: "*When the target enemy is in the following status: {passiveImg:stun}*\n- ATK 20%",
        }, evidenceContext);
        (0, assert_1.ok)(details?.text && details.conditionEvidence?.[0]);
        characters[0].passive = details.text;
        characters[0].passiveDetails = details;
        const validDataset = (0, team_analysis_1.buildTeamAnalysisDataset)(characters, fixture.catalogEntries, options);
        (0, assert_1.deepEqual)((0, team_analysis_1.validateTeamAnalysisDataset)(validDataset, characters, fixture.catalogEntries), []);
        const invalidCharacters = JSON.parse(JSON.stringify(characters));
        invalidCharacters[0].passiveDetails.conditionEvidence[0].passiveTextSha256 = "f".repeat(64);
        const invalidDataset = (0, team_analysis_1.buildTeamAnalysisDataset)(invalidCharacters, fixture.catalogEntries, options);
        const invalidCodes = (0, team_analysis_1.validateTeamAnalysisDataset)(invalidDataset, invalidCharacters, fixture.catalogEntries)
            .map(issue => issue.code);
        (0, assert_1.ok)(invalidCodes.includes("condition-evidence-source"));
        const reordered = JSON.parse(JSON.stringify(validDataset));
        reordered.states[0].passive.conditionEvidence[0].statuses[0].order = 3;
        const reorderedCodes = (0, team_analysis_1.validateTeamAnalysisDataset)(reordered, characters, fixture.catalogEntries)
            .map(issue => issue.code);
        (0, assert_1.ok)(reorderedCodes.includes("condition-evidence-output"));
    });
    (0, mocha_1.it)("reports coverage by passive/rule status and supported effect", () => {
        const dataset = (0, team_analysis_1.buildTeamAnalysisDataset)(fixture.characters, fixture.catalogEntries, options);
        const coverage = (0, team_analysis_1.buildTeamAnalysisCoverageReport)(dataset);
        (0, assert_1.deepEqual)(coverage.passiveStatusCounts, { supported: 11, partial: 2, unknown: 0 });
        (0, assert_1.equal)(coverage.identity.variantGroupOmittedStateCount, 2);
        (0, assert_1.ok)(coverage.ruleStatusCounts.supported > 0);
        (0, assert_1.ok)(coverage.ruleStatusCounts.partial > 0);
        (0, assert_1.ok)(coverage.supportedEffectCounts.atk > 0);
        (0, assert_1.ok)(coverage.unknownFragmentCount > 0);
        (0, assert_1.ok)(coverage.calculationPhase.activationEligibleEffectCount > 0);
        (0, assert_1.ok)(coverage.calculationPhase.bucketEligibleEffectCount > 0);
        (0, assert_1.ok)(coverage.calculationPhase.bucketCounts.passive_start_of_turn > 0);
    });
    (0, mocha_1.it)("rejects impossible calculation-phase combinations", () => {
        const dataset = (0, team_analysis_1.buildTeamAnalysisDataset)(fixture.characters, fixture.catalogEntries, options);
        const broken = JSON.parse(JSON.stringify(dataset));
        const typedEffects = broken.states.flatMap(item => item.passive?.rules ?? [])
            .flatMap(rule => rule.effects)
            .filter(effect => effect.kind !== "unknown");
        const statEffect = typedEffects.find(effect => effect.kind === "atk" || effect.kind === "def");
        const nonStatEffect = typedEffects.find(effect => effect.kind !== "atk" && effect.kind !== "def");
        const unknownEffect = broken.states.flatMap(item => item.passive?.rules ?? [])
            .flatMap(rule => rule.effects)
            .find(effect => effect.kind === "unknown");
        (0, assert_1.ok)(statEffect && nonStatEffect && unknownEffect);
        statEffect.activationTiming = JSON.parse(JSON.stringify({
            moment: "after_time_travel",
            source: "unresolved",
        }));
        statEffect.calculationBucket = {
            bucket: "passive_on_attack",
            source: "unresolved",
        };
        nonStatEffect.calculationBucket = {
            bucket: "passive_start_of_turn",
            source: "documented_domain_rule",
        };
        unknownEffect.activationTiming = {
            moment: "start_of_turn",
            source: "explicit_text",
        };
        const codes = (0, team_analysis_1.validateTeamAnalysisDataset)(broken, fixture.characters, fixture.catalogEntries)
            .map(issue => issue.code);
        (0, assert_1.ok)(codes.includes("activation-moment"));
        (0, assert_1.ok)(codes.includes("activation-resolution"));
        (0, assert_1.ok)(codes.includes("calculation-bucket-resolution"));
        (0, assert_1.ok)(codes.includes("calculation-bucket-effect-kind"));
        (0, assert_1.ok)(codes.includes("unknown-effect-calculation-phase"));
    });
    (0, mocha_1.it)("rejects impossible combat-event predicates, provenance, and scaling", () => {
        const broken = (0, team_analysis_1.buildTeamAnalysisDataset)(fixture.characters, fixture.catalogEntries, options);
        const rule = broken.states.flatMap(item => item.passive?.rules ?? [])[0];
        const effect = rule.effects.find(item => item.kind !== "unknown");
        (0, assert_1.ok)(rule && effect);
        rule.condition = {
            op: "predicate",
            predicate: {
                kind: "attacks_received",
                scope: "self",
                comparator: "eq",
                value: -1,
                combatEvent: {
                    eventType: "attack_landed",
                    actor: "enemy",
                    attackKind: "normal_attack",
                    mode: "repeated_threshold",
                    relativeTiming: "after_event",
                    provenance: {
                        eventType: "explicit_text",
                        actor: "documented_domain_rule",
                        attackKind: "unresolved",
                        mode: "explicit_text",
                        relativeTiming: "explicit_text",
                    },
                },
                sourceText: "invalid external payload",
            },
        };
        effect.scaling = {
            kind: "per_combat_event",
            connector: "or",
            eventsPerIncrement: 0,
            events: [
                {
                    eventType: "incoming_attack",
                    actor: "enemy",
                    attackKind: "unknown",
                    mode: "accumulated_count",
                    countScope: "battle",
                    relativeTiming: "after_event",
                    provenance: {
                        eventType: "explicit_text",
                        actor: "documented_domain_rule",
                        attackKind: "unresolved",
                        mode: "explicit_text",
                        countScope: "documented_domain_rule",
                        relativeTiming: "explicit_text",
                    },
                },
                {
                    eventType: "attack_performed",
                    actor: "self",
                    attackKind: "unknown",
                    mode: "current_event",
                    relativeTiming: "after_event",
                    provenance: {
                        eventType: "explicit_text",
                        actor: "documented_domain_rule",
                        attackKind: "unresolved",
                        mode: "explicit_text",
                        relativeTiming: "explicit_text",
                    },
                },
                {
                    eventType: "attack_landed",
                    actor: "enemy",
                    attackKind: "unknown",
                    mode: "current_event",
                    relativeTiming: "before_event",
                    provenance: {
                        eventType: "explicit_text",
                        actor: "documented_domain_rule",
                        attackKind: "unresolved",
                        mode: "explicit_text",
                        relativeTiming: "explicit_text",
                    },
                },
            ],
        };
        const codes = (0, team_analysis_1.validateTeamAnalysisDataset)(broken, fixture.characters, fixture.catalogEntries)
            .map(issue => issue.code);
        (0, assert_1.ok)(codes.includes("combat-event-count"));
        (0, assert_1.ok)(codes.includes("combat-repeated-threshold-comparator"));
        (0, assert_1.ok)(codes.includes("combat-history-count-scope"));
        (0, assert_1.ok)(codes.includes("combat-attack-kind-resolution"));
        (0, assert_1.ok)(codes.includes("combat-scaling-unit"));
        (0, assert_1.ok)(codes.includes("combat-event-mode-channel"));
        (0, assert_1.ok)(codes.includes("combat-targeting-history"));
        (0, assert_1.ok)(codes.includes("combat-targeting-timing"));
        (0, assert_1.ok)(codes.includes("combat-outcome-timing"));
    });
    (0, mocha_1.it)("separates scenario-containing rules from fully scenario-evaluable rules", () => {
        const dataset = (0, team_analysis_1.buildTeamAnalysisDataset)(fixture.characters, fixture.catalogEntries, options);
        const baseline = (0, team_analysis_1.buildTeamAnalysisCoverageReport)(dataset);
        const rule = dataset.states[0].passive?.rules[0];
        (0, assert_1.ok)(rule);
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
        const supported = (0, team_analysis_1.buildTeamAnalysisCoverageReport)(dataset);
        (0, assert_1.equal)(supported.scenarioRuleCount, baseline.scenarioRuleCount + 1);
        (0, assert_1.equal)(supported.scenarioEvaluableRuleCount, baseline.scenarioEvaluableRuleCount + 1);
        (0, assert_1.equal)(supported.placementEvaluableRuleCount, baseline.placementEvaluableRuleCount);
        (0, assert_1.equal)(supported.teamEvaluableRuleCount, baseline.teamEvaluableRuleCount - 1);
        rule.condition = { op: "all", children: [rule.condition, { op: "unknown", sourceText: "enemy state" }] };
        rule.conditionStatus = "partial";
        rule.parseStatus = "partial";
        const partial = (0, team_analysis_1.buildTeamAnalysisCoverageReport)(dataset);
        (0, assert_1.equal)(partial.scenarioRuleCount, baseline.scenarioRuleCount + 1);
        (0, assert_1.equal)(partial.scenarioEvaluableRuleCount, baseline.scenarioEvaluableRuleCount);
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
    (0, mocha_1.it)("rejects ambiguous ally self inclusion, standalone support, and missing derived support", () => {
        const dataset = (0, team_analysis_1.buildTeamAnalysisDataset)(fixture.characters, fixture.catalogEntries, options);
        const broken = JSON.parse(JSON.stringify(dataset));
        const rule = broken.states[0].passive?.rules[0];
        (0, assert_1.ok)(rule);
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
            }]));
        const typedAllyRule = broken.states[0].passive?.rules[1];
        (0, assert_1.ok)(typedAllyRule);
        typedAllyRule.effects = [{
                kind: "critical_chance",
                target: { scope: "team_allies", selfInclusion: "included" },
                value: 20,
                unit: "percent",
                chancePercent: 20,
                sourceText: "chance of performing a critical hit 20%",
            }];
        const codes = (0, team_analysis_1.validateTeamAnalysisDataset)(broken, fixture.characters, fixture.catalogEntries)
            .map(issue => issue.code);
        (0, assert_1.ok)(codes.includes("condition-self-inclusion"));
        (0, assert_1.ok)(codes.includes("target-self-inclusion"));
        (0, assert_1.ok)(codes.includes("standalone-support"));
        (0, assert_1.ok)(codes.includes("missing-support-classification"));
    });
    (0, mocha_1.it)("rejects ambiguous combat chance semantics, invalid counts, caps, and durations", () => {
        const dataset = (0, team_analysis_1.buildTeamAnalysisDataset)(fixture.characters, fixture.catalogEntries, options);
        const broken = JSON.parse(JSON.stringify(dataset));
        const effect = broken.states.flatMap(item => item.passive?.rules ?? [])
            .flatMap(rule => rule.effects)
            .find(item => item.kind !== "unknown");
        (0, assert_1.ok)(effect);
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
        const codes = (0, team_analysis_1.validateTeamAnalysisDataset)(broken, fixture.characters, fixture.catalogEntries)
            .map(issue => issue.code);
        (0, assert_1.ok)(codes.includes("chance-range"));
        (0, assert_1.ok)(codes.includes("chance-alias"));
        (0, assert_1.ok)(codes.includes("additional-to-super-kind"));
        (0, assert_1.ok)(codes.includes("probability-unresolved-value"));
        (0, assert_1.ok)(codes.includes("additional-to-super-probability-unresolved-value"));
        (0, assert_1.ok)(codes.includes("effect-count"));
        (0, assert_1.ok)(codes.includes("effect-cap"));
        (0, assert_1.ok)(codes.includes("duration-turns-kind"));
    });
    (0, mocha_1.it)("rejects invalid Class, Type, and battle-slot payloads", () => {
        const dataset = (0, team_analysis_1.buildTeamAnalysisDataset)(fixture.characters, fixture.catalogEntries, options);
        const broken = JSON.parse(JSON.stringify(dataset));
        const rule = broken.states[0].passive?.rules[0];
        (0, assert_1.ok)(rule);
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
                        evaluationMoment: "entry_turn",
                        sourceText: "Basic effect(s)",
                    },
                },
            ],
        }));
        rule.effects = JSON.parse(JSON.stringify([{
                kind: "atk",
                target: { scope: "class_type_allies", selfInclusion: "included" },
                value: 20,
                unit: "percent",
                classifications: ["support"],
                sourceText: "ATK 20%",
            }]));
        const codes = (0, team_analysis_1.validateTeamAnalysisDataset)(broken, fixture.characters, fixture.catalogEntries)
            .map(issue => issue.code);
        (0, assert_1.ok)(codes.includes("class-value"));
        (0, assert_1.ok)(codes.includes("type-value"));
        (0, assert_1.ok)(codes.includes("slot-scope"));
        (0, assert_1.ok)(codes.includes("slot-range"));
        (0, assert_1.ok)(codes.includes("slot-evaluation-moment"));
        (0, assert_1.ok)(codes.includes("target-classes"));
        (0, assert_1.ok)(codes.includes("target-types"));
    });
    (0, mocha_1.it)("rejects invalid Ki comparators, ranges, contexts, sphere selectors, scaling, and conversions", () => {
        const dataset = (0, team_analysis_1.buildTeamAnalysisDataset)(fixture.characters, fixture.catalogEntries, options);
        const broken = JSON.parse(JSON.stringify(dataset));
        const rule = broken.states[0].passive?.rules[0];
        (0, assert_1.ok)(rule);
        rule.condition = JSON.parse(JSON.stringify({
            op: "all",
            children: [
                {
                    op: "predicate",
                    predicate: {
                        kind: "ki_amount",
                        scope: "team",
                        comparator: "between",
                        value: 25,
                        kiSphereTypes: ["BLUE"],
                        kiContext: "board_state",
                        evaluationMoment: "start_of_turn",
                        sourceText: "Basic effect(s)",
                    },
                },
                {
                    op: "predicate",
                    predicate: {
                        kind: "ki_spheres_obtained",
                        scope: "self",
                        comparator: "gte",
                        value: -1,
                        kiSphereTypes: ["any", "rainbow"],
                        kiContext: "board_state",
                        sourceText: "Basic effect(s)",
                    },
                },
                {
                    op: "predicate",
                    predicate: {
                        kind: "ki_sphere_type_obtained",
                        scope: "self",
                        comparator: "eq",
                        value: 2,
                        kiSphereTypes: ["rainbow"],
                        kiContext: "collected_ki_spheres",
                        sourceText: "Basic effect(s)",
                    },
                },
            ],
        }));
        rule.effects = JSON.parse(JSON.stringify([
            {
                kind: "atk",
                target: { scope: "self" },
                value: 10,
                unit: "percent",
                scaling: {
                    kind: "per_attack",
                    kiSphereTypes: [],
                    spheresPerIncrement: 0,
                    kiContext: "board_state",
                },
                kiSphereChange: {
                    sourceSelection: "all",
                    sourceTypes: ["AGL"],
                    destinationType: "any",
                    kiContext: "collected_ki_spheres",
                },
                sourceText: "Basic effect(s)",
            },
            {
                kind: "ki_sphere_change",
                target: { scope: "team_allies", selfInclusion: "included" },
                sourceText: "Basic effect(s)",
            },
        ]));
        const codes = (0, team_analysis_1.validateTeamAnalysisDataset)(broken, fixture.characters, fixture.catalogEntries)
            .map(issue => issue.code);
        for (const code of [
            "ki-scope", "ki-comparator", "ki-amount-range", "ki-amount-context",
            "ki-amount-moment", "ki-amount-sphere-types", "ki-sphere-count-range",
            "ki-sphere-context", "ki-sphere-types-exclusive", "ki-sphere-presence",
            "effect-scaling-kind", "effect-scaling-context", "effect-scaling-unit",
            "effect-scaling-sphere-types", "ki-sphere-change-kind",
            "ki-sphere-change-fields",
        ]) {
            (0, assert_1.ok)(codes.includes(code), code);
        }
    });
    (0, mocha_1.it)("rejects invalid HP, battle-turn, entry-turn, phase, and window payloads", () => {
        const dataset = (0, team_analysis_1.buildTeamAnalysisDataset)(fixture.characters, fixture.catalogEntries, options);
        const broken = JSON.parse(JSON.stringify(dataset));
        const rule = broken.states[0].passive?.rules[0];
        (0, assert_1.ok)(rule);
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
        }));
        const codes = (0, team_analysis_1.validateTeamAnalysisDataset)(broken, fixture.characters, fixture.catalogEntries)
            .map(issue => issue.code);
        (0, assert_1.ok)(codes.includes("scenario-comparator"));
        (0, assert_1.ok)(codes.includes("scenario-value"));
        (0, assert_1.ok)(codes.includes("scenario-max-value"));
        (0, assert_1.ok)(codes.includes("hp-scope"));
        (0, assert_1.ok)(codes.includes("hp-range"));
        (0, assert_1.ok)(codes.includes("evaluation-moment"));
        (0, assert_1.ok)(codes.includes("battle-turn-scope"));
        (0, assert_1.ok)(codes.includes("entry-turn-scope"));
        (0, assert_1.ok)(codes.includes("turn-index"));
        (0, assert_1.ok)(codes.includes("condition-window-range"));
    });
    (0, mocha_1.it)("rejects invalid enemy scope, selection, HP, count, name, and status payloads", () => {
        const dataset = (0, team_analysis_1.buildTeamAnalysisDataset)(fixture.characters, fixture.catalogEntries, options);
        const broken = JSON.parse(JSON.stringify(dataset));
        const rule = broken.states[0].passive?.rules[0];
        (0, assert_1.ok)(rule);
        rule.condition = JSON.parse(JSON.stringify({
            op: "all",
            children: [
                {
                    op: "predicate",
                    predicate: {
                        kind: "enemy_count",
                        scope: "enemy",
                        comparator: "gte",
                        value: -1,
                        enemySelection: "any_enemy",
                        sourceText: "Basic effect(s)",
                    },
                },
                {
                    op: "predicate",
                    predicate: {
                        kind: "enemy_hp_percent",
                        scope: "team",
                        comparator: "lte",
                        value: 101,
                        enemySelection: "nearest_enemy",
                        sourceText: "Basic effect(s)",
                    },
                },
                {
                    op: "predicate",
                    predicate: {
                        kind: "enemy_status",
                        scope: "enemy",
                        enemyStatuses: ["poisoned"],
                        sourceText: "Basic effect(s)",
                    },
                },
                {
                    op: "predicate",
                    predicate: {
                        kind: "enemy_name",
                        scope: "enemy",
                        enemySelection: "any_enemy",
                        names: ["Goku"],
                        nameMatch: "fuzzy",
                        excludedNameMatch: "includes",
                        sourceText: "Basic effect(s)",
                    },
                },
                {
                    op: "predicate",
                    predicate: {
                        kind: "enemy_hp_percent",
                        scope: "enemy",
                        comparator: "gte",
                        value: 50,
                        enemySelection: "only_enemy",
                        enemyReference: "that_enemy",
                        sourceText: "Basic effect(s)",
                    },
                },
            ],
        }));
        const codes = (0, team_analysis_1.validateTeamAnalysisDataset)(broken, fixture.characters, fixture.catalogEntries)
            .map(issue => issue.code);
        (0, assert_1.ok)(codes.includes("enemy-count-scope"));
        (0, assert_1.ok)(codes.includes("enemy-count-range"));
        (0, assert_1.ok)(codes.includes("enemy-selection-kind"));
        (0, assert_1.ok)(codes.includes("enemy-scope"));
        (0, assert_1.ok)(codes.includes("enemy-selection-value"));
        (0, assert_1.ok)(codes.includes("enemy-selection"));
        (0, assert_1.ok)(codes.includes("enemy-hp-range"));
        (0, assert_1.ok)(codes.includes("enemy-status-value"));
        (0, assert_1.ok)(codes.includes("enemy-name-match"));
        (0, assert_1.ok)(codes.includes("enemy-excluded-names"));
        (0, assert_1.ok)(codes.includes("enemy-reference-binding"));
    });
    (0, mocha_1.it)("rejects a that-enemy binding proved only inside NOT", () => {
        const dataset = (0, team_analysis_1.buildTeamAnalysisDataset)(fixture.characters, fixture.catalogEntries, options);
        const broken = JSON.parse(JSON.stringify(dataset));
        const rule = broken.states[0].passive?.rules[0];
        (0, assert_1.ok)(rule);
        rule.condition = {
            op: "not",
            child: {
                op: "all",
                children: [
                    {
                        op: "predicate",
                        predicate: {
                            kind: "enemy_count",
                            scope: "battle",
                            comparator: "eq",
                            value: 1,
                            sourceText: "Basic effect(s)",
                        },
                    },
                    {
                        op: "predicate",
                        predicate: {
                            kind: "enemy_hp_percent",
                            scope: "enemy",
                            comparator: "gte",
                            value: 50,
                            enemySelection: "only_enemy",
                            enemyReference: "that_enemy",
                            sourceText: "Basic effect(s)",
                        },
                    },
                ],
            },
        };
        const codes = (0, team_analysis_1.validateTeamAnalysisDataset)(broken, fixture.characters, fixture.catalogEntries)
            .map(issue => issue.code);
        (0, assert_1.ok)(codes.includes("enemy-reference-binding"));
    });
    (0, mocha_1.it)("rejects PassiveDetails text that cannot be mapped back to raw offsets", () => {
        const characters = JSON.parse(JSON.stringify(fixture.characters));
        (0, assert_1.ok)(characters[0].passiveDetails?.lines);
        characters[0].passiveDetails.lines[0] = "text absent from raw passive";
        const dataset = (0, team_analysis_1.buildTeamAnalysisDataset)(characters, fixture.catalogEntries, options);
        const codes = (0, team_analysis_1.validateTeamAnalysisDataset)(dataset, characters, fixture.catalogEntries)
            .map(issue => issue.code);
        (0, assert_1.ok)(codes.includes("passive-details-source-map"));
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
        (0, assert_1.match)(first.manifest.datasetVersion, /characters-v1:parser-1\.9\.17/);
    });
});
function state(states, stateKey) {
    const found = states.find(item => item.stateKey === stateKey);
    (0, assert_1.ok)(found, `Missing fixture state ${stateKey}`);
    return found;
}
function flattenPredicates(condition) {
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
function conditionShape(condition) {
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
        ...(predicate.kiSphereTypes ? { kiSphereTypes: predicate.kiSphereTypes } : {}),
        ...(predicate.kiContext ? { kiContext: predicate.kiContext } : {}),
        ...(predicate.evaluationMoment ? { evaluationMoment: predicate.evaluationMoment } : {}),
        ...(predicate.enemySelection ? { enemySelection: predicate.enemySelection } : {}),
        ...(predicate.enemyStatuses ? { enemyStatuses: predicate.enemyStatuses } : {}),
        ...(predicate.nameMatch ? { nameMatch: predicate.nameMatch } : {}),
        ...(predicate.excludedNames ? { excludedNames: predicate.excludedNames } : {}),
        ...(predicate.excludedNameMatch ? { excludedNameMatch: predicate.excludedNameMatch } : {}),
        ...(predicate.enemyReference ? { enemyReference: predicate.enemyReference } : {}),
        ...(predicate.combatEvent ? { combatEvent: predicate.combatEvent } : {}),
    };
}
function gateA5EffectShape(effect) {
    return {
        kind: effect.kind,
        ...(effect.value !== undefined ? { value: effect.value } : {}),
        ...(effect.unit !== undefined ? { unit: effect.unit } : {}),
        ...(effect.count !== undefined ? { count: effect.count } : {}),
        ...(effect.stackCap !== undefined ? { stackCap: effect.stackCap } : {}),
        ...(effect.scaling ? { scaling: effect.scaling } : {}),
        ...(effect.kiSphereChange ? { kiSphereChange: effect.kiSphereChange } : {}),
        ...(effect.kind === "unknown" && effect.sourceText ? { sourceText: effect.sourceText } : {}),
    };
}
function gateA51EffectShape(effect) {
    return {
        kind: effect.kind,
        activationTiming: effect.activationTiming,
        calculationBucket: effect.calculationBucket,
        ...(effect.target.scope !== "self" ? { target: effect.target.scope } : {}),
        ...(effect.classifications ? { classifications: effect.classifications } : {}),
    };
}
function gateA6EffectShape(effect, expected) {
    return {
        kind: effect.kind,
        ...(effect.stackCap !== undefined ? { stackCap: effect.stackCap } : {}),
        ...(effect.duration ? { duration: effect.duration } : {}),
        ...(effect.scaling
            ? expected?.scalingKind
                ? { scalingKind: effect.scaling.kind }
                : { scaling: effect.scaling }
            : {}),
    };
}
function gateA7EffectShape(effect) {
    const duration = {
        kind: effect.duration.kind,
        ...(effect.duration.turns !== undefined ? { turns: effect.duration.turns } : {}),
        source: effect.duration.source,
    };
    const stacking = effect.stacking ? {
        kind: effect.stacking.kind,
        source: effect.stacking.source,
        ...(effect.stacking.capPercent !== undefined ? { capPercent: effect.stacking.capPercent } : {}),
        ...(effect.stacking.capSource !== undefined ? { capSource: effect.stacking.capSource } : {}),
        ...(effect.stacking.scope !== undefined ? { scope: effect.stacking.scope } : {}),
    } : undefined;
    return {
        kind: effect.kind,
        target: effect.target.scope,
        ...(effect.target.selfInclusion ? { selfInclusion: effect.target.selfInclusion } : {}),
        ...(effect.magnitude ? { magnitude: effect.magnitude } : {}),
        ...(effect.value !== undefined ? { value: effect.value } : {}),
        ...(effect.unit ? { unit: effect.unit } : {}),
        duration,
        ...(stacking ? { stacking } : {}),
        ...(effect.activationChancePercent !== undefined
            ? { activationChancePercent: effect.activationChancePercent }
            : {}),
        ...(effect.qualitativeChanceTerm ? { qualitativeChanceTerm: effect.qualitativeChanceTerm } : {}),
        ...(effect.probabilitySource ? { probabilitySource: effect.probabilitySource } : {}),
        ...(effect.calculationBucket ? { bucket: effect.calculationBucket.bucket } : {}),
    };
}
function gateA71LifecycleShape(effect) {
    return {
        kind: effect.kind,
        duration: effect.duration,
        stacking: effect.stacking,
        activationLimit: effect.activationLimit,
        applicationTrigger: effect.applicationTrigger,
    };
}
function combatEventMatchesOutcome(event, outcome) {
    if (event.eventType === "incoming_attack") {
        return true;
    }
    if (event.eventType === "attack_landed") {
        return outcome === "hit";
    }
    if (event.eventType === "attack_evaded") {
        return outcome === "dodge";
    }
    return false;
}
function combatConditionMatchesOutcome(condition, outcome) {
    if (condition.op === "predicate") {
        return condition.predicate.combatEvent
            ? combatEventMatchesOutcome(condition.predicate.combatEvent, outcome)
            : true;
    }
    if (condition.op === "any") {
        return condition.children.some(child => combatConditionMatchesOutcome(child, outcome));
    }
    if (condition.op === "all") {
        return condition.children.every(child => combatConditionMatchesOutcome(child, outcome));
    }
    if (condition.op === "not") {
        return !combatConditionMatchesOutcome(condition.child, outcome);
    }
    return false;
}
function combatOutcomeShape(condition) {
    return {
        hit: combatConditionMatchesOutcome(condition, "hit"),
        dodge: combatConditionMatchesOutcome(condition, "dodge"),
    };
}
function combatScalingOutcomeShape(scaling) {
    const matches = (outcome) => scaling.connector === "and"
        ? scaling.events.every(event => combatEventMatchesOutcome(event, outcome))
        : scaling.events.some(event => combatEventMatchesOutcome(event, outcome));
    return { hit: matches("hit"), dodge: matches("dodge") };
}
function unique(values) {
    return [...new Set(values)];
}
function uniqueFragments(fragments) {
    const seen = new Set();
    return fragments.filter(fragment => {
        const key = `${fragment.lineIndex}:${fragment.start}:${fragment.end}:${fragment.text}`;
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    }).sort((left, right) => left.lineIndex - right.lineIndex || (left.start ?? 0) - (right.start ?? 0));
}
//# sourceMappingURL=team-analysis.spec.js.map