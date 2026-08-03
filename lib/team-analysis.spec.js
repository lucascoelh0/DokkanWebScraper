"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const fs_1 = require("fs");
const mocha_1 = require("mocha");
const path_1 = require("path");
const zlib_1 = require("zlib");
const team_analysis_1 = require("./team-analysis");
const team_analysis_artifacts_1 = require("./team-analysis-artifacts");
const team_analysis_chance_lexicon_1 = require("./team-analysis-chance-lexicon");
const team_analysis_first_party_probabilities_1 = require("./team-analysis-first-party-probabilities");
const game_db_source_1 = require("./game-db/game-db-source");
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
            "When attacking",
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
            (0, assert_1.deepEqual)(predicates.map(predicate => predicate.selfInclusion), fixtureCase.expected.selfInclusions);
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
                && ["rotation_allies", "team_allies", "category_allies", "class_allies", "type_allies"]
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
            "per Ki Sphere obtained",
        ]);
    });
    (0, mocha_1.it)("does not misassign future class/type ally prefixes to self", () => {
        const passive = (0, team_analysis_1.parsePassive)("gate-a1:future-target:initial", undefined, "Basic effect(s)\n- Super Class allies' ATK 30%");
        (0, assert_1.equal)(passive.rules[0].parseStatus, "partial");
        (0, assert_1.equal)(passive.rules[0].effects[0].kind, "atk");
        (0, assert_1.equal)(passive.rules[0].effects[0].target.scope, "unknown");
        (0, assert_1.equal)(passive.rules[0].effects[0].classifications, undefined);
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
(0, mocha_1.describe)("team-analysis validation and artifacts", function () {
    (0, mocha_1.it)("reports coverage by passive/rule status and supported effect", () => {
        const dataset = (0, team_analysis_1.buildTeamAnalysisDataset)(fixture.characters, fixture.catalogEntries, options);
        const coverage = (0, team_analysis_1.buildTeamAnalysisCoverageReport)(dataset);
        (0, assert_1.deepEqual)(coverage.passiveStatusCounts, { supported: 10, partial: 2, unknown: 1 });
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
        (0, assert_1.match)(first.manifest.datasetVersion, /characters-v1:parser-1\.1\.2/);
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