"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertValidTeamAnalysisDataset = exports.validateTeamAnalysisDataset = exports.buildTeamAnalysisCoverageReport = exports.parsePassive = exports.buildTeamAnalysisDataset = exports.releaseStateFromForm = exports.buildAwakeningFamilyId = exports.buildVariantGroupId = exports.buildHardDuplicateGroupId = exports.buildStateKey = exports.TEAM_ANALYSIS_PARSER_VERSION = exports.TEAM_ANALYSIS_RULES_VERSION = exports.TEAM_ANALYSIS_SCHEMA_VERSION = void 0;
exports.TEAM_ANALYSIS_SCHEMA_VERSION = 1;
exports.TEAM_ANALYSIS_RULES_VERSION = "1";
exports.TEAM_ANALYSIS_PARSER_VERSION = "1.0.0";
function buildStateKey(characterId, formId, releaseState) {
    return `${characterId}:${formId}:${releaseState}`;
}
exports.buildStateKey = buildStateKey;
function buildHardDuplicateGroupId(characterId) {
    return `card:${characterId}`;
}
exports.buildHardDuplicateGroupId = buildHardDuplicateGroupId;
function buildVariantGroupId(canonicalId) {
    return `canonical:${canonicalId}`;
}
exports.buildVariantGroupId = buildVariantGroupId;
function buildAwakeningFamilyId(baseCharacterId) {
    return `awakening:${baseCharacterId}`;
}
exports.buildAwakeningFamilyId = buildAwakeningFamilyId;
function releaseStateFromForm(form) {
    if (form.sezaReleaseDate) {
        return "seza";
    }
    if (form.ezaReleaseDate) {
        return "eza";
    }
    return "initial";
}
exports.releaseStateFromForm = releaseStateFromForm;
function buildTeamAnalysisDataset(characters, catalogEntries, options) {
    const catalogById = new Map(catalogEntries.map(entry => [entry.id, entry]));
    const states = characters
        .flatMap(character => buildCharacterStates(character, catalogById.get(character.id)))
        .sort(compareAnalysisStates);
    const ruleCounts = countRuleStatuses(states);
    return {
        schemaVersion: exports.TEAM_ANALYSIS_SCHEMA_VERSION,
        rulesVersion: options.rulesVersion ?? exports.TEAM_ANALYSIS_RULES_VERSION,
        parserVersion: options.parserVersion ?? exports.TEAM_ANALYSIS_PARSER_VERSION,
        generatedAt: options.generatedAt,
        sourceCharacterDatasetVersion: options.sourceCharacterDatasetVersion,
        sourceCharacterPayloadSha256: options.sourceCharacterPayloadSha256,
        stateCount: states.length,
        supportedRuleCount: ruleCounts.supported,
        partialRuleCount: ruleCounts.partial,
        unknownRuleCount: ruleCounts.unknown,
        states,
    };
}
exports.buildTeamAnalysisDataset = buildTeamAnalysisDataset;
function buildCharacterStates(character, catalogEntry) {
    const rootForm = character;
    const forms = [rootForm, ...(character.transformations ?? [])];
    return forms.flatMap(form => analysisReleaseSources(form).map(releaseSource => {
        const identity = resolveIdentity(character, form, catalogEntry, releaseSource.releaseState);
        const stateKey = buildStateKey(identity.characterId, identity.formId, identity.releaseState);
        const passive = releaseSource.passiveText
            ? parsePassive(stateKey, releaseSource.passiveName, releaseSource.passiveText)
            : undefined;
        return {
            stateKey,
            characterId: identity.characterId,
            ...(identity.canonicalId ? { canonicalId: identity.canonicalId } : {}),
            ...(identity.gameCharacterId ? { gameCharacterId: identity.gameCharacterId } : {}),
            ...(identity.baseCharacterId ? { baseCharacterId: identity.baseCharacterId } : {}),
            hardDuplicateGroupId: identity.hardDuplicateGroupId,
            ...(identity.variantGroupId ? { variantGroupId: identity.variantGroupId } : {}),
            ...(identity.awakeningFamilyId ? { awakeningFamilyId: identity.awakeningFamilyId } : {}),
            formId: identity.formId,
            releaseState: identity.releaseState,
            displayName: form.name,
            ...(passive ? { passive } : {}),
        };
    }));
}
function resolveIdentity(character, form, catalogEntry, releaseState = releaseStateFromForm(form)) {
    const canonicalId = catalogEntry?.canonicalId;
    const baseCharacterId = catalogEntry?.baseCharacterId;
    return {
        characterId: character.id,
        canonicalId,
        gameCharacterId: catalogEntry?.characterId,
        baseCharacterId,
        hardDuplicateGroupId: buildHardDuplicateGroupId(character.id),
        variantGroupId: canonicalId ? buildVariantGroupId(canonicalId) : undefined,
        awakeningFamilyId: baseCharacterId ? buildAwakeningFamilyId(baseCharacterId) : undefined,
        formId: form.id,
        releaseState,
    };
}
function analysisReleaseSources(form) {
    const initialPassiveText = form.passiveDetails?.text ?? form.passive;
    const ezaPassiveText = form.ezaPassiveDetails?.text ?? form.ezaPassive ?? "";
    const sezaPassiveText = form.sezaPassive ?? "";
    if (!ezaPassiveText && !sezaPassiveText) {
        return [{
                releaseState: releaseStateFromForm(form),
                passiveText: initialPassiveText,
                passiveName: form.passiveDetails?.name,
            }];
    }
    const releases = [{
            releaseState: "initial",
            passiveText: initialPassiveText,
            passiveName: form.passiveDetails?.name,
        }];
    if (ezaPassiveText) {
        releases.push({
            releaseState: "eza",
            passiveText: ezaPassiveText,
            passiveName: form.ezaPassiveDetails?.name,
        });
    }
    if (sezaPassiveText) {
        releases.push({
            releaseState: "seza",
            passiveText: sezaPassiveText,
        });
    }
    return releases;
}
function compareAnalysisStates(left, right) {
    const releaseOrder = { initial: 0, eza: 1, seza: 2 };
    return left.characterId.localeCompare(right.characterId)
        || left.formId.localeCompare(right.formId)
        || releaseOrder[left.releaseState] - releaseOrder[right.releaseState];
}
function parsePassive(stateKey, name, rawText) {
    const rawLines = rawText.replace(/\r\n/g, "\n").split("\n");
    const rules = [];
    const unparsedFragments = [];
    let currentHeader;
    let currentHeaderIsAlways = false;
    let currentHeaderHasRule = false;
    const flushUnusedHeader = () => {
        if (!currentHeader || currentHeaderHasRule || currentHeaderIsAlways) {
            return;
        }
        rules.push(unknownStandaloneRule(stateKey, currentHeader));
        unparsedFragments.push(currentHeader);
    };
    for (let lineIndex = 0; lineIndex < rawLines.length; lineIndex += 1) {
        const rawLine = rawLines[lineIndex];
        const trimmed = rawLine.trim();
        if (!trimmed) {
            continue;
        }
        if (!trimmed.startsWith("- ")) {
            flushUnusedHeader();
            currentHeader = trimmedFragment(rawLine, lineIndex);
            currentHeaderIsAlways = isAlwaysHeader(trimmed);
            currentHeaderHasRule = false;
            continue;
        }
        const bulletOffset = rawLine.indexOf("- ") + 2;
        const bulletText = rawLine.slice(bulletOffset).trim();
        const bulletStart = rawLine.indexOf(bulletText, bulletOffset);
        const clauses = splitSemicolonClauses(rawLine, lineIndex, bulletText, bulletStart);
        for (const clause of clauses) {
            const effects = parseUnconditionalEffects(clause.text);
            if (effects && (currentHeaderIsAlways || !currentHeader)) {
                const source = currentHeader ? [currentHeader, clause] : [clause];
                rules.push({
                    id: ruleIdFromFragment(stateKey, clause),
                    condition: { op: "always" },
                    effects,
                    source,
                    parseStatus: "supported",
                    confidence: "high",
                });
            }
            else {
                const conditionText = currentHeader?.text ?? clause.text;
                const source = currentHeader ? [currentHeader, clause] : [clause];
                rules.push({
                    id: ruleIdFromFragment(stateKey, clause),
                    condition: { op: "unknown", sourceText: conditionText },
                    effects: [unknownEffect(clause.text)],
                    source,
                    parseStatus: "unknown",
                    confidence: "low",
                });
                if (currentHeader && !currentHeaderIsAlways) {
                    unparsedFragments.push(currentHeader);
                }
                unparsedFragments.push(clause);
            }
            currentHeaderHasRule = true;
        }
    }
    flushUnusedHeader();
    const orderedUnparsedFragments = uniqueOrderedFragments(unparsedFragments);
    return {
        ...(name ? { name } : {}),
        rawText,
        parseStatus: aggregatePassiveStatus(rules),
        rules,
        unparsedFragments: orderedUnparsedFragments,
    };
}
exports.parsePassive = parsePassive;
function isAlwaysHeader(text) {
    return /^\*?Basic effect\(s\)\*?:?$/i.test(text.trim());
}
function parseUnconditionalEffects(sourceText) {
    const text = sourceText.trim();
    const kiMatch = /^Ki\s*\+\s*(\d+(?:\.\d+)?)$/i.exec(text);
    if (kiMatch) {
        return [numericEffect("ki", Number(kiMatch[1]), "ki", text)];
    }
    const statMatch = /^((?:HP|ATK|DEF)(?:\s*(?:,|&|and)\s*(?:HP|ATK|DEF))*)\s*\+?\s*(\d+(?:\.\d+)?)%$/i.exec(text);
    if (statMatch) {
        const value = Number(statMatch[2]);
        const kinds = statMatch[1].match(/HP|ATK|DEF/gi) ?? [];
        return kinds.map(kind => numericEffect(kind.toLowerCase(), value, "percent", text));
    }
    const recoveryMatch = /^Recovers\s+(\d+(?:\.\d+)?)%\s+HP$/i.exec(text);
    if (recoveryMatch) {
        return [numericEffect("hp", Number(recoveryMatch[1]), "percent", text)];
    }
    const reductionMatch = /^Damage reduction rate\s+(\d+(?:\.\d+)?)%$/i.exec(text);
    if (reductionMatch) {
        return [numericEffect("damage_reduction", Number(reductionMatch[1]), "percent", text)];
    }
    const evadeMatch = /^Chance of evading enemy(?:'s|’s) attack\s+(\d+(?:\.\d+)?)%$/i.exec(text);
    if (evadeMatch) {
        const chancePercent = Number(evadeMatch[1]);
        return [{
                kind: "evade_chance",
                target: { scope: "self" },
                value: chancePercent,
                unit: "percent",
                chancePercent,
                sourceText: text,
            }];
    }
    const criticalMatch = /^Chance of performing a critical hit\s+(\d+(?:\.\d+)?)%$/i.exec(text);
    if (criticalMatch) {
        const chancePercent = Number(criticalMatch[1]);
        return [{
                kind: "critical_chance",
                target: { scope: "self" },
                value: chancePercent,
                unit: "percent",
                chancePercent,
                sourceText: text,
            }];
    }
    if (/^Guards all attacks$/i.test(text)) {
        return [booleanEffect("guard", text)];
    }
    if (/^Attacks are effective against all Types$/i.test(text)) {
        return [booleanEffect("effective_against_all_types", text)];
    }
    return undefined;
}
function numericEffect(kind, value, unit, sourceText) {
    return {
        kind,
        target: { scope: "self" },
        value,
        unit,
        sourceText,
    };
}
function booleanEffect(kind, sourceText) {
    return {
        kind,
        target: { scope: "self" },
        value: 1,
        unit: "boolean",
        sourceText,
    };
}
function unknownEffect(sourceText) {
    return {
        kind: "unknown",
        target: { scope: "unknown" },
        sourceText,
    };
}
function unknownStandaloneRule(stateKey, fragment) {
    return {
        id: ruleIdFromFragment(stateKey, fragment),
        condition: { op: "unknown", sourceText: fragment.text },
        effects: [unknownEffect(fragment.text)],
        source: [fragment],
        parseStatus: "unknown",
        confidence: "low",
    };
}
function splitSemicolonClauses(rawLine, lineIndex, bulletText, bulletStart) {
    const fragments = [];
    let relativeStart = 0;
    for (const match of bulletText.matchAll(/;|$/g)) {
        const rawClause = bulletText.slice(relativeStart, match.index);
        const text = rawClause.trim();
        if (text) {
            const leadingWhitespace = rawClause.length - rawClause.trimStart().length;
            const start = bulletStart + relativeStart + leadingWhitespace;
            fragments.push({
                lineIndex,
                text,
                start,
                end: start + text.length,
            });
        }
        relativeStart = (match.index ?? bulletText.length) + 1;
        if ((match.index ?? 0) === bulletText.length) {
            break;
        }
    }
    return fragments.length ? fragments : [trimmedFragment(rawLine, lineIndex)];
}
function trimmedFragment(rawLine, lineIndex) {
    const text = rawLine.trim();
    const start = rawLine.indexOf(text);
    return {
        lineIndex,
        text,
        start,
        end: start + text.length,
    };
}
function ruleIdFromFragment(stateKey, fragment) {
    return `${stateKey}:r${fragment.lineIndex}:${fragment.start ?? 0}:${fragment.end ?? fragment.text.length}`;
}
function uniqueOrderedFragments(fragments) {
    const byPosition = new Map();
    for (const fragment of fragments) {
        const key = `${fragment.lineIndex}:${fragment.start ?? ""}:${fragment.end ?? ""}:${fragment.text}`;
        byPosition.set(key, fragment);
    }
    return [...byPosition.values()].sort(compareFragments);
}
function compareFragments(left, right) {
    return left.lineIndex - right.lineIndex
        || (left.start ?? 0) - (right.start ?? 0)
        || (left.end ?? left.text.length) - (right.end ?? right.text.length)
        || left.text.localeCompare(right.text);
}
function aggregatePassiveStatus(rules) {
    if (rules.length === 0 || rules.every(rule => rule.parseStatus === "unknown")) {
        return "unknown";
    }
    if (rules.every(rule => rule.parseStatus === "supported")) {
        return "supported";
    }
    return "partial";
}
function countRuleStatuses(states) {
    const counts = { supported: 0, partial: 0, unknown: 0 };
    for (const state of states) {
        for (const rule of state.passive?.rules ?? []) {
            counts[rule.parseStatus] += 1;
        }
    }
    return counts;
}
function buildTeamAnalysisCoverageReport(dataset) {
    const passiveStatusCounts = { supported: 0, partial: 0, unknown: 0 };
    const ruleStatusCounts = { supported: 0, partial: 0, unknown: 0 };
    const supportedPredicateCounts = {};
    const supportedEffectCounts = {};
    const conditionCounts = { always: 0, predicate: 0, unknown: 0, composite: 0 };
    let passiveStateCount = 0;
    let unknownEffectCount = 0;
    let unknownFragmentCount = 0;
    let teamEvaluableRuleCount = 0;
    let scenarioRuleCount = 0;
    let runtimeOnlyRuleCount = 0;
    for (const state of dataset.states) {
        if (!state.passive) {
            continue;
        }
        passiveStateCount += 1;
        passiveStatusCounts[state.passive.parseStatus] += 1;
        unknownFragmentCount += state.passive.unparsedFragments.length;
        for (const rule of state.passive.rules) {
            ruleStatusCounts[rule.parseStatus] += 1;
            const conditionKind = classifyCondition(rule.condition);
            conditionCounts[conditionKind] += 1;
            if (conditionKind === "always") {
                teamEvaluableRuleCount += 1;
            }
            else if (hasScenarioPredicate(rule.condition)) {
                scenarioRuleCount += 1;
            }
            else if (hasRuntimePredicate(rule.condition)) {
                runtimeOnlyRuleCount += 1;
            }
            collectPredicates(rule.condition, supportedPredicateCounts);
            for (const effect of rule.effects) {
                if (effect.kind === "unknown") {
                    unknownEffectCount += 1;
                }
                else {
                    supportedEffectCounts[effect.kind] = (supportedEffectCounts[effect.kind] ?? 0) + 1;
                }
            }
        }
    }
    return {
        generatedAt: dataset.generatedAt,
        sourceCharacterDatasetVersion: dataset.sourceCharacterDatasetVersion,
        sourceCharacterPayloadSha256: dataset.sourceCharacterPayloadSha256,
        sourceStateCount: dataset.stateCount,
        passiveStateCount,
        passiveStatusCounts,
        parsedRuleCount: dataset.supportedRuleCount + dataset.partialRuleCount + dataset.unknownRuleCount,
        ruleStatusCounts,
        conditionCounts,
        supportedPredicateCounts: sortedRecord(supportedPredicateCounts),
        supportedEffectCounts: sortedRecord(supportedEffectCounts),
        unknownEffectCount,
        unknownFragmentCount,
        teamEvaluableRuleCount,
        scenarioRuleCount,
        runtimeOnlyRuleCount,
        identity: {
            variantGroupAssignedStateCount: dataset.states.filter(state => Boolean(state.variantGroupId)).length,
            variantGroupOmittedStateCount: dataset.states.filter(state => !state.variantGroupId).length,
            awakeningFamilyAssignedStateCount: dataset.states.filter(state => Boolean(state.awakeningFamilyId)).length,
        },
    };
}
exports.buildTeamAnalysisCoverageReport = buildTeamAnalysisCoverageReport;
function classifyCondition(condition) {
    if (condition.op === "always" || condition.op === "predicate" || condition.op === "unknown") {
        return condition.op;
    }
    return "composite";
}
const SCENARIO_PREDICATES = new Set([
    "hp_percent", "turn_number", "turns_from_entry", "enemy_count", "enemy_category",
    "enemy_name", "enemy_class", "enemy_type", "enemy_status", "domain_active",
    "standby_active", "active_skill_used", "revive_triggered",
]);
const RUNTIME_PREDICATES = new Set([
    "ki_amount", "ki_spheres_obtained", "ki_sphere_type_obtained", "attacks_performed",
    "attacks_received", "attacks_evaded", "super_attacks_performed", "super_attack_received",
    "final_blow_delivered", "chance_roll",
]);
function hasScenarioPredicate(condition) {
    return conditionHasPredicate(condition, predicate => SCENARIO_PREDICATES.has(predicate.kind));
}
function hasRuntimePredicate(condition) {
    return conditionHasPredicate(condition, predicate => RUNTIME_PREDICATES.has(predicate.kind));
}
function conditionHasPredicate(condition, predicateMatcher) {
    if (condition.op === "predicate") {
        return predicateMatcher(condition.predicate);
    }
    if (condition.op === "not") {
        return conditionHasPredicate(condition.child, predicateMatcher);
    }
    if (condition.op === "all" || condition.op === "any") {
        return condition.children.some(child => conditionHasPredicate(child, predicateMatcher));
    }
    return false;
}
function collectPredicates(condition, counts) {
    if (condition.op === "predicate") {
        counts[condition.predicate.kind] = (counts[condition.predicate.kind] ?? 0) + 1;
        return;
    }
    if (condition.op === "not") {
        collectPredicates(condition.child, counts);
        return;
    }
    if (condition.op === "all" || condition.op === "any") {
        condition.children.forEach(child => collectPredicates(child, counts));
    }
}
function sortedRecord(record) {
    return Object.fromEntries(Object.entries(record).sort(([left], [right]) => left.localeCompare(right)));
}
function validateTeamAnalysisDataset(dataset, characters, catalogEntries) {
    const issues = [];
    const stateKeys = new Set();
    const ruleIds = new Set();
    const expectedStates = expectedStateIdentities(characters, catalogEntries);
    const expectedSources = expectedStateSources(characters);
    if (dataset.stateCount !== dataset.states.length) {
        issues.push({ code: "state-count", message: `stateCount ${dataset.stateCount} does not match ${dataset.states.length} states.` });
    }
    const actualRuleCounts = countRuleStatuses(dataset.states);
    for (const status of ["supported", "partial", "unknown"]) {
        const field = `${status}RuleCount`;
        if (dataset[field] !== actualRuleCounts[status]) {
            issues.push({ code: "rule-count", message: `${field} ${dataset[field]} does not match ${actualRuleCounts[status]}.` });
        }
    }
    for (const state of dataset.states) {
        if (stateKeys.has(state.stateKey)) {
            issues.push({ code: "duplicate-state-key", message: `Duplicate state key ${state.stateKey}.`, stateKey: state.stateKey });
        }
        stateKeys.add(state.stateKey);
        const expected = expectedStates.get(state.stateKey);
        if (!expected) {
            issues.push({ code: "missing-reference", message: `State does not reference a character/form/release in the character payload.`, stateKey: state.stateKey });
        }
        else {
            validateStableIdentity(state, expected, issues);
            validateStateSource(state, expectedSources.get(state.stateKey), issues);
        }
        validatePassive(state, ruleIds, issues);
    }
    for (const stateKey of expectedStates.keys()) {
        if (!stateKeys.has(stateKey)) {
            issues.push({ code: "missing-state", message: `Character payload state ${stateKey} is absent.`, stateKey });
        }
    }
    return issues;
}
exports.validateTeamAnalysisDataset = validateTeamAnalysisDataset;
function assertValidTeamAnalysisDataset(dataset, characters, catalogEntries) {
    const issues = validateTeamAnalysisDataset(dataset, characters, catalogEntries);
    if (issues.length > 0) {
        const summary = issues.slice(0, 10).map(issue => `${issue.code}: ${issue.message}`).join("\n");
        throw new Error(`Team analysis validation failed with ${issues.length} issue(s):\n${summary}`);
    }
}
exports.assertValidTeamAnalysisDataset = assertValidTeamAnalysisDataset;
function expectedStateIdentities(characters, catalogEntries) {
    const catalogById = new Map(catalogEntries.map(entry => [entry.id, entry]));
    const expected = new Map();
    for (const character of characters) {
        const catalogEntry = catalogById.get(character.id);
        for (const form of [character, ...(character.transformations ?? [])]) {
            for (const releaseSource of analysisReleaseSources(form)) {
                const identity = resolveIdentity(character, form, catalogEntry, releaseSource.releaseState);
                expected.set(buildStateKey(identity.characterId, identity.formId, identity.releaseState), identity);
            }
        }
    }
    return expected;
}
function expectedStateSources(characters) {
    const expected = new Map();
    for (const character of characters) {
        for (const form of [character, ...(character.transformations ?? [])]) {
            for (const releaseSource of analysisReleaseSources(form)) {
                expected.set(buildStateKey(character.id, form.id, releaseSource.releaseState), {
                    displayName: form.name,
                    passiveText: releaseSource.passiveText,
                });
            }
        }
    }
    return expected;
}
function validateStableIdentity(state, expected, issues) {
    const fields = [
        "characterId", "canonicalId", "gameCharacterId", "baseCharacterId", "hardDuplicateGroupId",
        "variantGroupId", "awakeningFamilyId", "formId", "releaseState",
    ];
    for (const field of fields) {
        if (state[field] !== expected[field]) {
            issues.push({
                code: "unstable-identity",
                message: `${field} is ${String(state[field])}; expected ${String(expected[field])} from source IDs.`,
                stateKey: state.stateKey,
            });
        }
    }
    const expectedStateKey = buildStateKey(state.characterId, state.formId, state.releaseState);
    if (state.stateKey !== expectedStateKey) {
        issues.push({ code: "unstable-state-key", message: `Expected ${expectedStateKey}.`, stateKey: state.stateKey });
    }
}
function validateStateSource(state, expected, issues) {
    if (!expected) {
        return;
    }
    if (state.displayName !== expected.displayName) {
        issues.push({ code: "display-name-source", message: `Display name does not match the character form.`, stateKey: state.stateKey });
    }
    if (expected.passiveText) {
        if (state.passive?.rawText !== expected.passiveText) {
            issues.push({ code: "passive-text-source", message: `Passive rawText does not exactly match the character form.`, stateKey: state.stateKey });
        }
    }
    else if (state.passive) {
        issues.push({ code: "unexpected-passive", message: `Analysis contains a passive absent from the character form.`, stateKey: state.stateKey });
    }
}
function validatePassive(state, ruleIds, issues) {
    const passive = state.passive;
    if (!passive) {
        return;
    }
    if (passive.parseStatus !== aggregatePassiveStatus(passive.rules)) {
        issues.push({ code: "passive-status", message: `Passive parse status does not match its rules.`, stateKey: state.stateKey });
    }
    const rawLines = passive.rawText.replace(/\r\n/g, "\n").split("\n");
    validateFragmentList(passive.unparsedFragments, rawLines, state, undefined, issues);
    for (const rule of passive.rules) {
        if (ruleIds.has(rule.id)) {
            issues.push({ code: "duplicate-rule-id", message: `Duplicate rule ID ${rule.id}.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        ruleIds.add(rule.id);
        const positionFragment = rule.source[rule.source.length - 1];
        if (!positionFragment || rule.id !== ruleIdFromFragment(state.stateKey, positionFragment)) {
            issues.push({ code: "unstable-rule-id", message: `Rule ID does not match state key and source position.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        if (rule.effects.length === 0) {
            issues.push({ code: "empty-effects", message: `Rule has no effects.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        validateCondition(rule.condition, 1, state, rule, issues);
        validateFragmentList(rule.source, rawLines, state, rule, issues);
        for (const effect of rule.effects) {
            validateFiniteNumbers(effect, state, rule, issues);
            if (effect.chancePercent !== undefined && (effect.chancePercent < 0 || effect.chancePercent > 100)) {
                issues.push({ code: "chance-range", message: `chancePercent is outside 0..100.`, stateKey: state.stateKey, ruleId: rule.id });
            }
            if (effect.duration?.kind === "turns" && (!Number.isInteger(effect.duration.turns) || (effect.duration.turns ?? 0) <= 0)) {
                issues.push({ code: "duration-range", message: `Turn duration must be a positive integer.`, stateKey: state.stateKey, ruleId: rule.id });
            }
        }
    }
}
function validateFragmentList(fragments, rawLines, state, rule, issues) {
    for (let index = 0; index < fragments.length; index += 1) {
        const fragment = fragments[index];
        if (index > 0 && compareFragments(fragments[index - 1], fragment) > 0) {
            issues.push({ code: "fragment-order", message: `Source fragments are not ordered.`, stateKey: state.stateKey, ruleId: rule?.id });
        }
        const line = rawLines[fragment.lineIndex];
        if (line === undefined) {
            issues.push({ code: "fragment-line", message: `Fragment line ${fragment.lineIndex} is outside raw text.`, stateKey: state.stateKey, ruleId: rule?.id });
            continue;
        }
        if (fragment.start !== undefined || fragment.end !== undefined) {
            if (fragment.start === undefined || fragment.end === undefined || fragment.start < 0 || fragment.end < fragment.start) {
                issues.push({ code: "fragment-range", message: `Fragment has an invalid range.`, stateKey: state.stateKey, ruleId: rule?.id });
            }
            else if (line.slice(fragment.start, fragment.end) !== fragment.text) {
                issues.push({ code: "fragment-text", message: `Fragment does not point to original raw text.`, stateKey: state.stateKey, ruleId: rule?.id });
            }
        }
        else if (!line.includes(fragment.text)) {
            issues.push({ code: "fragment-text", message: `Fragment text is absent from its raw line.`, stateKey: state.stateKey, ruleId: rule?.id });
        }
    }
}
function validateCondition(condition, depth, state, rule, issues) {
    if (depth > 16) {
        issues.push({ code: "ast-depth", message: `Condition AST exceeds depth 16.`, stateKey: state.stateKey, ruleId: rule.id });
        return;
    }
    if (condition.op === "all" || condition.op === "any") {
        if (condition.children.length === 0) {
            issues.push({ code: "empty-ast", message: `${condition.op} condition has no children.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        condition.children.forEach(child => validateCondition(child, depth + 1, state, rule, issues));
    }
    else if (condition.op === "not") {
        validateCondition(condition.child, depth + 1, state, rule, issues);
    }
    else if (condition.op === "predicate") {
        validateFiniteNumbers(condition.predicate, state, rule, issues);
        for (const slot of condition.predicate.slots ?? []) {
            if (!Number.isInteger(slot) || slot < 1 || slot > 3) {
                issues.push({ code: "slot-range", message: `Battle slot must be 1, 2, or 3.`, stateKey: state.stateKey, ruleId: rule.id });
            }
        }
    }
}
function validateFiniteNumbers(value, state, rule, issues) {
    for (const [key, fieldValue] of Object.entries(value)) {
        if (typeof fieldValue === "number" && !Number.isFinite(fieldValue)) {
            issues.push({ code: "non-finite-number", message: `${key} must be finite.`, stateKey: state.stateKey, ruleId: rule.id });
        }
    }
}
//# sourceMappingURL=team-analysis.js.map