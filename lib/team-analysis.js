"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertValidTeamAnalysisDataset = exports.validateTeamAnalysisDataset = exports.buildTeamAnalysisCoverageReport = exports.mapPassiveDetailsToSource = exports.parsePassive = exports.buildTeamAnalysisDataset = exports.releaseStateFromForm = exports.buildAwakeningFamilyId = exports.buildVariantGroupId = exports.buildHardDuplicateGroupId = exports.buildStateKey = exports.TEAM_ANALYSIS_PARSER_VERSION = exports.TEAM_ANALYSIS_RULES_VERSION = exports.TEAM_ANALYSIS_SCHEMA_VERSION = void 0;
const team_analysis_chance_lexicon_1 = require("./team-analysis-chance-lexicon");
const team_analysis_first_party_probabilities_1 = require("./team-analysis-first-party-probabilities");
exports.TEAM_ANALYSIS_SCHEMA_VERSION = 1;
exports.TEAM_ANALYSIS_RULES_VERSION = "1";
exports.TEAM_ANALYSIS_PARSER_VERSION = "1.3.0";
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
            ? parsePassive(stateKey, releaseSource.passiveName, releaseSource.passiveText, releaseSource.passiveDetails)
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
                passiveDetails: form.passiveDetails,
            }];
    }
    const releases = [{
            releaseState: "initial",
            passiveText: initialPassiveText,
            passiveName: form.passiveDetails?.name,
            passiveDetails: form.passiveDetails,
        }];
    if (ezaPassiveText) {
        releases.push({
            releaseState: "eza",
            passiveText: ezaPassiveText,
            passiveName: form.ezaPassiveDetails?.name,
            passiveDetails: form.ezaPassiveDetails,
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
function parsePassive(stateKey, name, rawText, passiveDetails) {
    const sourceMap = mapPassiveDetailsToSource(rawText, passiveDetails);
    const blocks = buildLogicalPassiveBlocks(sourceMap.sourceFragments);
    const rules = [];
    const unparsedFragments = [];
    let currentCondition;
    let currentConditionUsed = false;
    const flushUnusedCondition = () => {
        if (!currentCondition || currentConditionUsed) {
            return;
        }
        rules.push(unknownStandaloneRule(stateKey, currentCondition));
        unparsedFragments.push(...currentCondition.source);
    };
    for (const block of blocks) {
        if (block.kind === "condition") {
            flushUnusedCondition();
            currentCondition = block;
            currentConditionUsed = false;
            continue;
        }
        const headerConditionResult = currentCondition
            ? parseCondition(currentCondition.text)
            : { condition: { op: "always" }, status: "supported" };
        const inlineTemporal = splitInlineTemporalCondition(block.text);
        const conditionResult = inlineTemporal
            ? combineConditionResults(headerConditionResult, parseCondition(inlineTemporal.conditionText))
            : headerConditionResult;
        const effectResult = parseEffects(inlineTemporal?.effectText ?? block.text, {
            stateKey,
            rawText,
            ruleLineIndex: block.source[0]?.lineIndex ?? -1,
        });
        const source = uniqueOrderedFragments([
            ...(currentCondition?.source ?? []),
            ...block.source,
        ]);
        const parseStatus = combineParseStatuses(conditionResult.status, effectResult.status);
        rules.push({
            id: ruleIdFromFragment(stateKey, block.source[block.source.length - 1]),
            condition: conditionResult.condition,
            conditionStatus: conditionResult.status,
            effects: effectResult.effects,
            effectStatus: effectResult.status,
            source,
            parseStatus,
            confidence: confidenceFromStatus(parseStatus),
        });
        if (conditionResult.status !== "supported" && currentCondition) {
            unparsedFragments.push(...currentCondition.source);
        }
        if (effectResult.status !== "supported") {
            unparsedFragments.push(...block.source);
        }
        currentConditionUsed = true;
    }
    flushUnusedCondition();
    return {
        ...(name ? { name } : {}),
        rawText,
        parseStatus: aggregatePassiveStatus(rules),
        rules,
        unparsedFragments: uniqueOrderedFragments(unparsedFragments),
    };
}
exports.parsePassive = parsePassive;
function combineConditionResults(left, right) {
    if (left.condition.op === "always") {
        return right;
    }
    if (right.condition.op === "always") {
        return left;
    }
    const condition = { op: "all", children: [left.condition, right.condition] };
    return { condition, status: conditionExpressionStatus(condition) };
}
function splitInlineTemporalCondition(sourceText) {
    const temporalSuffix = /\s+((?:starting from the \d+(?:st|nd|rd|th) turn|for \d+ turn(?:s|\(s\))?) from (?:the start of battle|the character['â€™]s entry turn))$/i.exec(sourceText);
    if (!temporalSuffix || temporalSuffix.index === undefined) {
        return undefined;
    }
    const effectText = sourceText.slice(0, temporalSuffix.index).trim();
    return effectText
        ? { effectText, conditionText: temporalSuffix[1] }
        : undefined;
}
function mapPassiveDetailsToSource(rawText, passiveDetails) {
    const normalizedRawText = rawText.replace(/\r\n/g, "\n");
    const rawLines = normalizedRawText.split("\n");
    const sourceFragments = rawLines
        .map((line, lineIndex) => trimmedFragment(line, lineIndex))
        .filter(fragment => fragment.text.length > 0);
    const lineTexts = passiveDetails?.lines ?? sourceFragments.map(fragment => fragment.text);
    const lines = alignPassiveTexts(rawLines, lineTexts);
    const sectionEntries = (passiveDetails?.sections ?? []).flatMap(section => [
        ...(section.label ? [{ type: "label", text: section.label }] : []),
        ...section.lines.map(text => ({ type: "line", text })),
    ]);
    const mappedSectionEntries = alignPassiveTexts(rawLines, sectionEntries.map(entry => entry.text));
    let mappedIndex = 0;
    const sections = (passiveDetails?.sections ?? []).map(section => ({
        ...(section.label ? { label: mappedSectionEntries[mappedIndex++] } : {}),
        lines: section.lines.map(() => mappedSectionEntries[mappedIndex++]),
    }));
    const unmappedTexts = [
        ...lines.filter(line => !line.mapped).map(line => line.text),
        ...mappedSectionEntries.filter(entry => !entry.mapped).map(entry => entry.text),
    ];
    return {
        rawText,
        sourceFragments,
        lines,
        sections,
        unmappedTexts,
    };
}
exports.mapPassiveDetailsToSource = mapPassiveDetailsToSource;
function alignPassiveTexts(rawLines, texts) {
    const stream = buildAlignmentStream(rawLines);
    let cursor = 0;
    return texts.map(text => {
        const normalizedText = normalizeAlignmentText(text);
        const matchIndex = normalizedText ? stream.text.indexOf(normalizedText, cursor) : -1;
        if (matchIndex < 0) {
            return { text, source: [], mapped: false };
        }
        cursor = matchIndex + normalizedText.length;
        const positions = stream.positions.slice(matchIndex, cursor);
        return {
            text,
            source: fragmentsFromAlignmentPositions(rawLines, positions),
            mapped: true,
        };
    });
}
function buildAlignmentStream(rawLines) {
    let text = "";
    const positions = [];
    rawLines.forEach((line, lineIndex) => {
        const bullet = /^\s*-\s+/.exec(line);
        for (let column = 0; column < line.length; column += 1) {
            const character = line[column];
            const structuralBullet = Boolean(bullet && column >= (bullet.index ?? 0) && column < (bullet[0].length));
            if (/\s/.test(character) || character === "*" || structuralBullet) {
                continue;
            }
            text += character;
            positions.push({ lineIndex, column });
        }
    });
    return { text, positions };
}
function normalizeAlignmentText(text) {
    return text.replace(/^\s*-\s+/, "").replace(/[\s*]/g, "");
}
function fragmentsFromAlignmentPositions(rawLines, positions) {
    const ranges = new Map();
    for (const position of positions) {
        const range = ranges.get(position.lineIndex);
        if (range) {
            range.start = Math.min(range.start, position.column);
            range.end = Math.max(range.end, position.column + 1);
        }
        else {
            ranges.set(position.lineIndex, { start: position.column, end: position.column + 1 });
        }
    }
    return [...ranges.entries()].sort(([left], [right]) => left - right).map(([lineIndex, range]) => ({
        lineIndex,
        text: rawLines[lineIndex].slice(range.start, range.end),
        start: range.start,
        end: range.end,
    }));
}
function buildLogicalPassiveBlocks(sourceFragments) {
    const blocks = [];
    let current;
    const flush = () => {
        if (!current) {
            return;
        }
        blocks.push({
            kind: current.kind,
            text: logicalText(current.kind, current.source),
            source: current.source,
        });
        current = undefined;
    };
    for (const fragment of sourceFragments) {
        const isBullet = /^-\s+/.test(fragment.text);
        if (isBullet) {
            flush();
            current = { kind: "effect", source: [fragment] };
            continue;
        }
        if (!current) {
            current = { kind: "condition", source: [fragment] };
            continue;
        }
        if (current.kind === "effect"
            && isLogicalHeaderStart(fragment.text)
            && !isEffectModifierContinuation(fragment.text)) {
            flush();
            current = { kind: "condition", source: [fragment] };
            continue;
        }
        current.source.push(fragment);
    }
    flush();
    return blocks;
}
function isEffectModifierContinuation(text) {
    return /^for\s+\d+\s+turn(?:s|\(s\))?$/i.test(text.trim());
}
function logicalText(kind, source) {
    return source.map((fragment, index) => {
        const text = fragment.text.replace(/^\*|\*$/g, "").trim();
        return kind === "effect" && index === 0 ? text.replace(/^-\s+/, "") : text;
    }).join(" ").replace(/\s+/g, " ").trim();
}
function isLogicalHeaderStart(text) {
    const trimmed = text.trim();
    return /^(?:Activates the Entrance Animation|Basic effect\(s\)|When\b|If\b|Per\b|As the\b|After\b|Before\b|At the\b|With\b|Without\b|While\b|The less\b|The more\b|Upon\b|Once\b|Every\b|\d+ or more\b)/i.test(trimmed)
        || /^(?:For|Starting)\b/.test(trimmed)
        || /^(?:On the \d+(?:st|nd|rd|th)|Up to the \d+(?:st|nd|rd|th)|From the \d+(?:st|nd|rd|th) (?:through|to) the \d+(?:st|nd|rd|th))\b/.test(trimmed);
}
function isAlwaysHeader(text) {
    return /^\*?Basic effect\(s\)\*?:?$/i.test(text.trim());
}
function parseCondition(sourceText) {
    const text = sourceText.trim();
    if (isAlwaysHeader(text)) {
        return { condition: { op: "always" }, status: "supported" };
    }
    const condition = parseBooleanCondition(text);
    return { condition, status: conditionExpressionStatus(condition) };
}
function parseBooleanCondition(sourceText) {
    const original = sourceText.trim();
    const withoutPrefix = original.replace(/^(?:when|if)\s+/i, "").trim();
    const text = stripOuterConditionParentheses(withoutPrefix);
    const exact = parseExactConditionClause(text, original);
    if (exact) {
        return exact;
    }
    for (const connector of ["or", "and"]) {
        const parts = splitTopLevelCondition(text, connector);
        if (parts.length > 1) {
            return {
                op: connector === "or" ? "any" : "all",
                children: parts.map(parseBooleanCondition),
            };
        }
    }
    const temporalSuffix = parseTemporalSuffixCondition(text);
    if (temporalSuffix) {
        return temporalSuffix;
    }
    return parsePartialSlotCondition(text) ?? { op: "unknown", sourceText: original };
}
function parseExactConditionClause(text, sourceText) {
    const hp = parseExactHpCondition(text, sourceText);
    if (hp) {
        return hp;
    }
    const temporal = parseExactTemporalCondition(text, sourceText);
    if (temporal) {
        return temporal;
    }
    const slot = parseExactSlotCondition(text, sourceText);
    if (slot) {
        return slot;
    }
    const allRotationCategory = /^all allies attacking in the same turn are (.+?) Category characters?$/i.exec(text);
    if (allRotationCategory) {
        const categoryValues = parseQuotedValues(allRotationCategory[1]);
        if (categoryValues) {
            return predicateExpression({
                kind: "all_rotation_allies_category",
                scope: "rotation",
                selfInclusion: "included",
                categories: categoryValues.values,
                sourceText,
            });
        }
    }
    const allRotationClass = /^all allies attacking in the same turn are (Super|Extreme) Class characters?$/i.exec(text);
    if (allRotationClass) {
        return predicateExpression({
            kind: "all_rotation_allies_class",
            scope: "rotation",
            selfInclusion: "included",
            classes: [normalizeClass(allRotationClass[1])],
            sourceText,
        });
    }
    if (/^(?:the team includes all five Types|all five Types are represented on the team)$/i.test(text)) {
        return {
            op: "all",
            children: TEAM_ANALYSIS_TYPES.map(type => predicateExpression({
                kind: "ally_type_present",
                scope: "team",
                selfInclusion: "included",
                types: [type],
                sourceText,
            })),
        };
    }
    const selfClass = /^(?:the|this) character is (Super|Extreme) Class$/i.exec(text);
    if (selfClass) {
        return predicateExpression({
            kind: "character_class",
            scope: "self",
            classes: [normalizeClass(selfClass[1])],
            sourceText,
        });
    }
    const selfType = /^(?:the|this) character is (AGL|TEQ|INT|STR|PHY) Type$/i.exec(text);
    if (selfType) {
        return predicateExpression({
            kind: "character_type",
            scope: "self",
            types: [normalizeType(selfType[1])],
            sourceText,
        });
    }
    const onlyTypeInRotation = /^(?:the|this) character is the only (AGL|TEQ|INT|STR|PHY) Type ally attacking in the (?:same )?turn$/i.exec(text);
    if (onlyTypeInRotation) {
        const type = normalizeType(onlyTypeInRotation[1]);
        return {
            op: "all",
            children: [
                predicateExpression({
                    kind: "character_type",
                    scope: "self",
                    types: [type],
                    sourceText,
                }),
                {
                    op: "not",
                    child: allyPredicate("type", type, "rotation", "excluded", undefined, undefined, sourceText),
                },
            ],
        };
    }
    return parseAllyConditionClause(text, sourceText);
}
function parseExactHpCondition(text, sourceText) {
    let body = text.trim();
    let evaluationMoment;
    const startPrefix = /^at the start of (?:the )?turn,?\s+(?:when\s+)?/i.exec(body);
    if (startPrefix) {
        evaluationMoment = "start_of_turn";
        body = body.slice(startPrefix[0].length).trim();
    }
    const entryAtMatch = /^upon entering the attacking turn with HP at\s+(.+)$/i.exec(body);
    const entryValueMatch = /^upon entering the attacking turn with\s+(\d+)% HP(?:\s+(or more|or less|or above|or below))?$/i.exec(body);
    if (entryAtMatch) {
        evaluationMoment = "entry_turn";
        body = `HP is ${entryAtMatch[1]}`;
    }
    else if (entryValueMatch) {
        evaluationMoment = "entry_turn";
        body = `HP is ${entryValueMatch[1]}%${entryValueMatch[2] ? ` ${entryValueMatch[2]}` : ""}`;
    }
    const momentSuffixes = [
        { pattern: /\s+at the start of the character['â€™]s attacking turn$/i, moment: "start_of_turn" },
        { pattern: /\s+at the start of (?:the )?turn$/i, moment: "start_of_turn" },
        { pattern: /\s+at the end of (?:the )?turn$/i, moment: "end_of_turn" },
    ];
    for (const suffix of momentSuffixes) {
        const match = suffix.pattern.exec(body);
        if (match) {
            evaluationMoment = suffix.moment;
            body = body.slice(0, match.index).trim();
            break;
        }
    }
    const interval = /^HP is between\s+(\d+)%\s+and\s+(\d+)%$/i.exec(body);
    if (interval) {
        const minimum = Number(interval[1]);
        const maximum = Number(interval[2]);
        if (!isHpPercent(minimum) || !isHpPercent(maximum) || minimum > maximum) {
            return undefined;
        }
        return {
            op: "all",
            children: [
                hpPredicate("gte", minimum, sourceText, evaluationMoment),
                hpPredicate("lte", maximum, sourceText, evaluationMoment),
            ],
        };
    }
    const exact = /^HP is exactly\s+(\d+)%$/i.exec(body);
    if (exact) {
        return hpPredicateIfValid("eq", Number(exact[1]), sourceText, evaluationMoment);
    }
    const strict = /^HP is\s+(above|below)\s+(\d+)%$/i.exec(body);
    if (strict) {
        return hpPredicateIfValid(strict[1].toLowerCase() === "above" ? "gt" : "lt", Number(strict[2]), sourceText, evaluationMoment);
    }
    const qualified = /^HP is\s+(\d+)%\s+or\s+(more|less|above|below)$/i.exec(body);
    if (qualified) {
        const qualifier = qualified[2].toLowerCase();
        return hpPredicateIfValid(qualifier === "more" || qualifier === "above" ? "gte" : "lte", Number(qualified[1]), sourceText, evaluationMoment);
    }
    const plain = /^HP is\s+(\d+)%$/i.exec(body);
    return plain
        ? hpPredicateIfValid("eq", Number(plain[1]), sourceText, evaluationMoment)
        : undefined;
}
function hpPredicateIfValid(comparator, value, sourceText, evaluationMoment) {
    return isHpPercent(value) ? hpPredicate(comparator, value, sourceText, evaluationMoment) : undefined;
}
function hpPredicate(comparator, value, sourceText, evaluationMoment) {
    return predicateExpression({
        kind: "hp_percent",
        scope: "team",
        comparator,
        value,
        ...(evaluationMoment ? { evaluationMoment } : {}),
        sourceText,
    });
}
function isHpPercent(value) {
    return Number.isFinite(value) && value >= 0 && value <= 100;
}
function parseExactTemporalCondition(text, sourceText) {
    const starting = /^starting from the (\d+)(?:st|nd|rd|th) turn from (the start of battle|the character['â€™]s entry turn)$/i.exec(text);
    if (starting) {
        return temporalPredicateIfValid(starting[2], "gte", Number(starting[1]), sourceText);
    }
    const point = /^on the (\d+)(?:st|nd|rd|th) turn(?: from (the start of battle|the character['â€™]s entry turn))?$/i.exec(text);
    if (point) {
        return temporalPredicateIfValid(point[2] ?? "the start of battle", "eq", Number(point[1]), sourceText);
    }
    const pointList = /^on the (.+?) turns from (the start of battle|the character['â€™]s entry turn)$/i.exec(text);
    if (pointList) {
        const values = parseOrdinalValues(pointList[1]);
        if (values) {
            return {
                op: "any",
                children: values.map(value => temporalPredicate(pointList[2], "eq", value, sourceText)),
            };
        }
    }
    const upper = /^up to the (\d+)(?:st|nd|rd|th) turn(?: from (the start of battle|the character['â€™]s entry turn))?$/i.exec(text);
    if (upper) {
        return temporalPredicateIfValid(upper[2] ?? "the start of battle", "lte", Number(upper[1]), sourceText);
    }
    const durationWindow = /^for (\d+) turn(?:s|\(s\))? from (the start of battle|the character['â€™]s entry turn)$/i.exec(text);
    if (durationWindow) {
        const end = Number(durationWindow[1]);
        return temporalWindowIfValid(durationWindow[2], 1, end, sourceText);
    }
    const explicitWindow = /^from the (\d+)(?:st|nd|rd|th) (?:through|to) the (\d+)(?:st|nd|rd|th) turn from (the start of battle|the character['â€™]s entry turn)$/i.exec(text);
    if (explicitWindow) {
        return temporalWindowIfValid(explicitWindow[3], Number(explicitWindow[1]), Number(explicitWindow[2]), sourceText);
    }
    return undefined;
}
function temporalWindowIfValid(origin, start, end, sourceText) {
    if (!isTurnIndex(start) || !isTurnIndex(end) || start > end) {
        return undefined;
    }
    return {
        op: "all",
        children: [
            temporalPredicate(origin, "gte", start, sourceText),
            temporalPredicate(origin, "lte", end, sourceText),
        ],
    };
}
function temporalPredicateIfValid(origin, comparator, value, sourceText) {
    return isTurnIndex(value) ? temporalPredicate(origin, comparator, value, sourceText) : undefined;
}
function temporalPredicate(origin, comparator, value, sourceText) {
    const fromEntry = /character['â€™]s entry turn/i.test(origin);
    return predicateExpression({
        kind: fromEntry ? "turn_from_entry" : "battle_turn",
        scope: fromEntry ? "self" : "battle",
        comparator,
        value,
        sourceText,
    });
}
function isTurnIndex(value) {
    return Number.isInteger(value) && value >= 1;
}
function parseOrdinalValues(sourceText) {
    const values = [...sourceText.matchAll(/\b(\d+)(?:st|nd|rd|th)\b/gi)].map(match => Number(match[1]));
    const separators = sourceText.replace(/\b\d+(?:st|nd|rd|th)\b/gi, "#").trim();
    if (values.length === 0
        || values.some(value => !isTurnIndex(value))
        || !/^#(?:\s*(?:,|&|and|or)\s*#)*$/i.test(separators)) {
        return undefined;
    }
    return values;
}
function parseTemporalSuffixCondition(text) {
    const suffix = /^(.*?)\s+(starting from the \d+(?:st|nd|rd|th) turn from (?:the start of battle|the character['â€™]s entry turn))$/i.exec(text);
    if (!suffix || !suffix[1].trim()) {
        return undefined;
    }
    const temporal = parseExactTemporalCondition(suffix[2], suffix[2]);
    if (!temporal) {
        return undefined;
    }
    return {
        op: "all",
        children: [parseBooleanCondition(suffix[1]), temporal],
    };
}
function parseAllyConditionClause(sourceBody, sourceText) {
    let body = sourceBody.trim();
    let selfInclusion = "included";
    if (/\(self excluded\)/i.test(body)) {
        selfInclusion = "excluded";
        body = body.replace(/\s*\(self excluded\)\s*/ig, " ").trim();
    }
    else if (/\(self included\)/i.test(body)) {
        body = body.replace(/\s*\(self included\)\s*/ig, " ").trim();
    }
    let negated = false;
    if (/^without\s+/i.test(body)) {
        negated = true;
        body = body.replace(/^without\s+/i, "");
    }
    if (/^there (?:is|are) no\s+/i.test(body)) {
        negated = true;
        body = body.replace(/^there (?:is|are) no\s+/i, "");
    }
    else {
        body = body.replace(/^there (?:is|are)\s+/i, "");
    }
    const anotherMatch = /^another\s+/i.exec(body);
    if (anotherMatch) {
        selfInclusion = "excluded";
        body = body.slice(anotherMatch[0].length);
    }
    let count;
    let comparator;
    const countMatch = /^(\d+)\s+or more\s+/i.exec(body);
    if (countMatch) {
        count = Number(countMatch[1]);
        comparator = "gte";
        body = body.slice(countMatch[0].length);
    }
    else {
        const exactCountMatch = /^(\d+)\s+/i.exec(body);
        if (exactCountMatch) {
            count = Number(exactCountMatch[1]);
            comparator = "eq";
            body = body.slice(exactCountMatch[0].length);
        }
    }
    body = body.replace(/^an?\s+/i, "");
    let scope;
    const teamMatch = /\s+(?:is\s+|are\s+)?on the team$/i.exec(body);
    const rotationMatch = /\s+(?:is\s+|are\s+)?attacking in the same turn$/i.exec(body);
    if (teamMatch) {
        scope = "team";
        body = body.slice(0, teamMatch.index).trim();
    }
    else if (rotationMatch) {
        scope = "rotation";
        body = body.slice(0, rotationMatch.index).trim();
    }
    else {
        return undefined;
    }
    const classCategoryMatch = /^(?:(Super|Extreme) Class\s+(.+?) Category|(.+?) Category\s+(Super|Extreme) Class) all(?:y|ies)$/i.exec(body);
    if (classCategoryMatch) {
        const className = normalizeClass(classCategoryMatch[1] ?? classCategoryMatch[4]);
        const categoryValues = parseQuotedValues(classCategoryMatch[2] ?? classCategoryMatch[3]);
        if (categoryValues) {
            const children = categoryValues.values.map(category => allyPredicate("category_class", { category, className }, scope, selfInclusion, count, comparator, sourceText));
            const expression = children.length === 1
                ? children[0]
                : { op: categoryValues.connector === "and" ? "all" : "any", children };
            return negated ? { op: "not", child: expression } : expression;
        }
    }
    const categoryAndName = /^(.+?) Category all(?:y|ies) whose name includes (.+)$/i.exec(body);
    if (categoryAndName) {
        const categoryExpression = buildQuotedPredicateExpression(categoryAndName[1], value => allyPredicate("category", value, scope, selfInclusion, count, comparator, sourceText));
        const nameExpression = buildQuotedPredicateExpression(categoryAndName[2], value => allyPredicate("name", value, scope, selfInclusion, count, comparator, sourceText));
        const expression = categoryExpression && nameExpression
            ? { op: "all", children: [categoryExpression, nameExpression] }
            : undefined;
        return expression && negated ? { op: "not", child: expression } : expression;
    }
    const categoryMatch = /^(.+?) Category all(?:y|ies)$/i.exec(body);
    if (categoryMatch) {
        const expression = buildQuotedPredicateExpression(categoryMatch[1], value => allyPredicate("category", value, scope, selfInclusion, count, comparator, sourceText));
        return expression && negated ? { op: "not", child: expression } : expression;
    }
    const nameMatch = /^all(?:y|ies) whose name includes (.+)$/i.exec(body);
    if (nameMatch) {
        const expression = buildQuotedPredicateExpression(nameMatch[1], value => allyPredicate("name", value, scope, selfInclusion, count, comparator, sourceText));
        return expression && negated ? { op: "not", child: expression } : expression;
    }
    const classTypeMatch = /^(Super|Extreme)\s+(AGL|TEQ|INT|STR|PHY) Type all(?:y|ies)$/i.exec(body);
    if (classTypeMatch) {
        const expression = allyPredicate("class_type", { className: normalizeClass(classTypeMatch[1]), typeName: normalizeType(classTypeMatch[2]) }, scope, selfInclusion, count, comparator, sourceText);
        return negated ? { op: "not", child: expression } : expression;
    }
    const classMatch = /^(Super|Extreme) Class all(?:y|ies)$/i.exec(body);
    if (classMatch) {
        const expression = allyPredicate("class", normalizeClass(classMatch[1]), scope, selfInclusion, count, comparator, sourceText);
        return negated ? { op: "not", child: expression } : expression;
    }
    const typeMatch = /^(AGL|TEQ|INT|STR|PHY) Type all(?:y|ies)$/i.exec(body);
    if (typeMatch) {
        const expression = allyPredicate("type", normalizeType(typeMatch[1]), scope, selfInclusion, count, comparator, sourceText);
        return negated ? { op: "not", child: expression } : expression;
    }
    return undefined;
}
function allyPredicate(type, value, scope, selfInclusion, count, comparator, sourceText) {
    const rotationPartner = scope === "rotation" && selfInclusion === "excluded";
    const kind = type === "category"
        ? (rotationPartner ? "rotation_partner_category" : "ally_category_present")
        : type === "name"
            ? (rotationPartner ? "rotation_partner_name" : "ally_name_present")
            : type === "class"
                ? "ally_class_present"
                : type === "type"
                    ? "ally_type_present"
                    : type === "class_type"
                        ? "ally_class_type_present"
                        : "ally_category_class_present";
    return predicateExpression({
        kind,
        scope,
        selfInclusion,
        ...(count !== undefined ? { comparator, count } : {}),
        ...(type === "category" ? { categories: [value] } : {}),
        ...(type === "name" ? { names: [value] } : {}),
        ...(type === "class" ? { classes: [value] } : {}),
        ...(type === "type" ? { types: [value] } : {}),
        ...(type === "class_type" ? {
            classes: [value.className],
            types: [value.typeName],
        } : {}),
        ...(type === "category_class" ? {
            categories: [value.category],
            classes: [value.className],
        } : {}),
        sourceText,
    });
}
function predicateExpression(predicate) {
    return { op: "predicate", predicate };
}
const TEAM_ANALYSIS_TYPES = ["AGL", "TEQ", "INT", "STR", "PHY"];
const TEAM_ANALYSIS_CLASSES = ["Super", "Extreme"];
const SLOT_LIST_PATTERN = "(?:1st|2nd|3rd)(?:\\s*(?:,|and|or)\\s*(?:1st|2nd|3rd))*";
function normalizeClass(value) {
    return /^super$/i.test(value) ? "Super" : "Extreme";
}
function normalizeType(value) {
    return value.toUpperCase();
}
function parseSlotValues(sourceText) {
    return [...sourceText.matchAll(/\b(1st|2nd|3rd)\b/gi)]
        .map(match => Number(match[1][0]));
}
function parseExactSlotCondition(text, sourceText) {
    const attackerPattern = new RegExp(`^(?:As the|attacking as the)\\s+(${SLOT_LIST_PATTERN})\\s+attacker in a turn$`, "i");
    const slotPattern = new RegExp(`^attacking in the\\s+(${SLOT_LIST_PATTERN})\\s+slot$`, "i");
    const match = attackerPattern.exec(text) ?? slotPattern.exec(text);
    if (!match) {
        return undefined;
    }
    return predicateExpression({
        kind: "battle_slot",
        scope: "self",
        slots: parseSlotValues(match[1]),
        sourceText,
    });
}
function parsePartialSlotCondition(text) {
    const pattern = new RegExp(`\\b(?:attacking as the|attacking in the|(?:the|this) character is the|as the)\\s+(${SLOT_LIST_PATTERN})\\s+(?:attacker(?:\\s+in a turn)?|slot)\\b`, "i");
    const match = pattern.exec(text);
    if (!match || match.index === undefined) {
        return undefined;
    }
    const prefix = text.slice(0, match.index).replace(/[\s,]+$/g, "");
    const suffix = text.slice(match.index + match[0].length).replace(/^[\s,]+/g, "");
    const slot = predicateExpression({
        kind: "battle_slot",
        scope: "self",
        slots: parseSlotValues(match[1]),
        sourceText: match[0],
    });
    const children = [
        ...(prefix ? [{ op: "unknown", sourceText: prefix }] : []),
        slot,
        ...(suffix ? [{ op: "unknown", sourceText: suffix }] : []),
    ];
    return children.length === 1 ? children[0] : { op: "all", children };
}
function stripOuterConditionParentheses(sourceText) {
    let text = sourceText.trim();
    while (text.startsWith("(") && matchingOuterParenthesisIndex(text) === text.length - 1) {
        text = text.slice(1, -1).trim();
    }
    return text;
}
function matchingOuterParenthesisIndex(text) {
    let depth = 0;
    let quoted = false;
    for (let index = 0; index < text.length; index += 1) {
        const character = text[index];
        if (character === "\"") {
            quoted = !quoted;
        }
        else if (!quoted && character === "(") {
            depth += 1;
        }
        else if (!quoted && character === ")") {
            depth -= 1;
            if (depth === 0) {
                return index;
            }
        }
    }
    return -1;
}
function splitTopLevelCondition(sourceText, connector) {
    const matches = [...sourceText.matchAll(/\s+,?\s*(and|or)\s+/gi)];
    const parts = [];
    let lastIndex = 0;
    for (const match of matches) {
        const index = match.index ?? -1;
        if (index < 0
            || match[1].toLowerCase() !== connector
            || conditionDepthAt(sourceText, index) !== 0) {
            continue;
        }
        const right = sourceText.slice(index + match[0].length).trim();
        if (!/^(?:when|if|as|attacking|there|all|the\s+(?:team|character)|this\s+character|another|no|for\b|starting\b|on the\b|up to the\b|from the\b|HP\b|facing\b|\()/i.test(right)) {
            continue;
        }
        parts.push(sourceText.slice(lastIndex, index).replace(/[\s,]+$/g, "").trim());
        lastIndex = index + match[0].length;
    }
    if (parts.length === 0) {
        return [sourceText];
    }
    parts.push(sourceText.slice(lastIndex).trim());
    return parts.filter(Boolean);
}
function conditionDepthAt(sourceText, targetIndex) {
    let depth = 0;
    let quoted = false;
    for (let index = 0; index < targetIndex; index += 1) {
        if (sourceText[index] === "\"") {
            quoted = !quoted;
        }
        else if (!quoted && sourceText[index] === "(") {
            depth += 1;
        }
        else if (!quoted && sourceText[index] === ")") {
            depth -= 1;
        }
    }
    return depth;
}
function buildQuotedPredicateExpression(sourceText, build) {
    const parsed = parseQuotedValues(sourceText);
    if (!parsed) {
        return undefined;
    }
    const children = parsed.values.map(build);
    if (children.length === 1) {
        return children[0];
    }
    return {
        op: parsed.connector === "and" ? "all" : "any",
        children,
    };
}
function parseQuotedValues(sourceText) {
    const values = [...sourceText.matchAll(/"([^"]+)"/g)].map(match => match[1].trim()).filter(Boolean);
    if (values.length === 0) {
        return undefined;
    }
    const separators = sourceText.replace(/"[^"]+"/g, "#").trim();
    if (!/^#(?:\s*(?:,\s*)?(?:and|or)?\s*#)*$/i.test(separators)) {
        return undefined;
    }
    const hasAnd = /\band\b/i.test(separators);
    const hasOr = /\bor\b/i.test(separators);
    if (hasAnd && hasOr) {
        return undefined;
    }
    if (values.length > 1 && !hasAnd && !hasOr) {
        return undefined;
    }
    return {
        values,
        connector: hasAnd ? "and" : hasOr ? "or" : "single",
    };
}
function parseTypeValues(sourceText) {
    const parts = sourceText.split(/\s*(?:,|&|\band\b|\bor\b)\s*/i).filter(Boolean);
    if (parts.length === 0 || parts.some(part => !/^(?:AGL|TEQ|INT|STR|PHY)$/i.test(part))) {
        return undefined;
    }
    return [...new Set(parts.map(normalizeType))];
}
function parseEffects(sourceText, context) {
    const resolvedTarget = resolveEffectTarget(sourceText);
    const parsedAtoms = parseEffectAtoms(resolvedTarget.body, context);
    const effects = parsedAtoms.atoms.map(atom => applyEffectTarget(atom, resolvedTarget));
    effects.push(...parsedAtoms.unknownSegments.map(segment => unknownEffect(segment, resolvedTarget.target, resolvedTarget.categories, resolvedTarget.classes, resolvedTarget.types)));
    return {
        effects,
        status: effectListStatus(effects),
    };
}
function resolveEffectTarget(sourceText) {
    let text = sourceText.trim();
    let selfInclusion = "included";
    if (/\(self excluded\)/i.test(text)) {
        selfInclusion = "excluded";
        text = text.replace(/\s*\(self excluded\)\s*/ig, " ").trim();
    }
    else if (/\(self included\)/i.test(text)) {
        text = text.replace(/\s*\(self included\)\s*/ig, " ").trim();
    }
    const allAlliesMatch = /^All allies['’]\s+(.+)$/i.exec(text);
    const categoryAlliesMatch = /^(.+?) Category allies['’]\s+(.+)$/i.exec(text);
    const classTypeAlliesMatch = /^(Super|Extreme)\s+(AGL|TEQ|INT|STR|PHY) Type allies['’]\s+(.+)$/i.exec(text);
    const classAlliesMatch = /^(Super|Extreme) Class allies['’]\s+(.+)$/i.exec(text);
    const typeAlliesMatch = /^(.+?) Type allies['’]\s+(.+)$/i.exec(text);
    if (allAlliesMatch) {
        return {
            body: allAlliesMatch[1],
            target: { scope: "team_allies", selfInclusion },
        };
    }
    if (categoryAlliesMatch) {
        const parsedCategories = parseQuotedValues(categoryAlliesMatch[1]);
        if (!parsedCategories || parsedCategories.connector === "and") {
            return { body: text, target: { scope: "unknown" } };
        }
        return {
            body: categoryAlliesMatch[2],
            target: { scope: "category_allies", selfInclusion },
            categories: parsedCategories.values,
        };
    }
    if (classTypeAlliesMatch) {
        return {
            body: classTypeAlliesMatch[3],
            target: { scope: "class_type_allies", selfInclusion },
            classes: [normalizeClass(classTypeAlliesMatch[1])],
            types: [normalizeType(classTypeAlliesMatch[2])],
        };
    }
    if (classAlliesMatch) {
        return {
            body: classAlliesMatch[2],
            target: { scope: "class_allies", selfInclusion },
            classes: [normalizeClass(classAlliesMatch[1])],
        };
    }
    if (typeAlliesMatch) {
        const parsedTypes = parseTypeValues(typeAlliesMatch[1]);
        if (parsedTypes) {
            return {
                body: typeAlliesMatch[2],
                target: { scope: "type_allies", selfInclusion },
                types: parsedTypes,
            };
        }
    }
    if (/\b(?:stuns?|stunning|seals?|sealing)\s+(?:all enemies|all enemies['’])/i.test(text)) {
        return { body: text, target: { scope: "all_enemies" } };
    }
    if (/\b(?:stuns?|stunning|seals?|sealing)\s+(?:(?:the\s+)?attacked\s+enemy|(?:the\s+)?enemy)(?:['’]s)?/i.test(text)) {
        return { body: text, target: { scope: "enemy" } };
    }
    if (/^(?:.+?\s+allies|.+?\s+characters|All enemies|Attacked enemy|Enemy|Target enemy)['’]\s+/i.test(text)) {
        return { body: text, target: { scope: "unknown" } };
    }
    return { body: sourceText.trim(), target: { scope: "self" } };
}
function activationChanceFields(percent, probabilitySource = "explicit_text", qualitativeChanceTerm) {
    return {
        activationChancePercent: percent,
        chancePercent: percent,
        probabilitySource,
        ...(qualitativeChanceTerm ? { qualitativeChanceTerm } : {}),
    };
}
function explicitAttackCount(sourceCount) {
    return /^an?$/i.test(sourceCount) ? 1 : Number(sourceCount);
}
function normalizeQualitativeChanceTerm(sourceTerm) {
    if (!sourceTerm) {
        return undefined;
    }
    const normalized = sourceTerm.trim().toLowerCase();
    if (normalized === "a" || normalized === "a chance") {
        return "a chance";
    }
    if (["rare", "medium", "high", "great"].includes(normalized)) {
        return normalized;
    }
    return undefined;
}
function resolveProbability(context, semantic, sourceTerm, sourcePercent) {
    const qualitativeChanceTerm = normalizeQualitativeChanceTerm(sourceTerm);
    if (sourcePercent !== undefined) {
        return {
            percent: Number(sourcePercent),
            ...(qualitativeChanceTerm ? { qualitativeChanceTerm } : {}),
            probabilitySource: "explicit_text",
        };
    }
    if (qualitativeChanceTerm) {
        const firstParty = (0, team_analysis_first_party_probabilities_1.resolveFirstPartyProbability)(context.stateKey, context.rawText, context.ruleLineIndex, qualitativeChanceTerm, semantic);
        if (firstParty) {
            return {
                percent: firstParty.percent,
                qualitativeChanceTerm,
                probabilitySource: "first_party_game_db",
            };
        }
        const lexiconPercent = (0, team_analysis_chance_lexicon_1.validatedChancePercent)(qualitativeChanceTerm, semantic);
        if (lexiconPercent !== undefined) {
            return {
                percent: lexiconPercent,
                qualitativeChanceTerm,
                probabilitySource: "qualitative_lexicon",
            };
        }
        return { qualitativeChanceTerm, probabilitySource: "unresolved" };
    }
    return { probabilitySource: "unresolved" };
}
function activationProbabilityFields(probability) {
    return {
        ...(probability.percent !== undefined ? {
            activationChancePercent: probability.percent,
            chancePercent: probability.percent,
        } : {}),
        ...(probability.qualitativeChanceTerm ? { qualitativeChanceTerm: probability.qualitativeChanceTerm } : {}),
        probabilitySource: probability.probabilitySource,
    };
}
function additionalToSuperProbabilityFields(probability) {
    return {
        ...(probability.percent !== undefined ? { additionalToSuperChancePercent: probability.percent } : {}),
        ...(probability.qualitativeChanceTerm
            ? { additionalToSuperQualitativeChanceTerm: probability.qualitativeChanceTerm }
            : {}),
        additionalToSuperProbabilitySource: probability.probabilitySource,
    };
}
function parseEffectAtoms(body, context) {
    const candidates = [];
    const addMatches = (pattern, build, rejectUnknownChancePrefix = false) => {
        for (const match of body.matchAll(pattern)) {
            const start = match.index ?? 0;
            if (rejectUnknownChancePrefix
                && /\bchance of\s+$/i.test(body.slice(Math.max(0, start - 48), start))) {
                continue;
            }
            const atoms = build(match);
            if (atoms.length > 0) {
                candidates.push({ start, end: start + match[0].length, atoms });
            }
        }
    };
    addMatches(/\b(?:(?:(?<activationTerm>rare|medium|high|great)\s+chance(?:\s*\((?<activationParenPercent>\d+(?:\.\d+)?)%\))?|(?<activationPercent>\d+(?:\.\d+)?)%\s+chance|(?<activationArticle>a)\s+chance|(?<activationBare>chance))\s+of\s+)?launch(?:es|ing)\s+(?<attackCount>an?|\d+)\s+additional attack(?:\(s\)|s)?(?:,?\s*each of which|\s+that|\s+which)\s+(?:has|have)\s+(?:(?<conversionArticle>a)\s+chance|(?:a\s+)?(?:(?<conversionTerm>rare|medium|high|great)\s+chance(?:\s*\((?<conversionParenPercent>\d+(?:\.\d+)?)%\))?|(?<conversionPercent>\d+(?:\.\d+)?)%\s+chance)|(?<conversionBare>chance))\s+of becoming a Super Attack(?:\s+(?<conversionTrailingPercent>\d+(?:\.\d+)?)%)?/gi, match => {
        const groups = match.groups ?? {};
        const hasActivationChance = [groups.activationTerm, groups.activationPercent, groups.activationArticle, groups.activationBare].some(Boolean);
        const activation = hasActivationChance
            ? resolveProbability(context, "additional_super_activation", groups.activationTerm ?? groups.activationArticle, groups.activationParenPercent ?? groups.activationPercent)
            : { percent: 100, probabilitySource: "explicit_text" };
        const conversion = resolveProbability(context, "additional_to_super", groups.conversionTerm ?? groups.conversionArticle, groups.conversionTrailingPercent ?? groups.conversionParenPercent ?? groups.conversionPercent);
        return [{
                kind: "additional_attack",
                count: explicitAttackCount(groups.attackCount),
                ...activationProbabilityFields(activation),
                ...additionalToSuperProbabilityFields(conversion),
                sourceText: match[0],
            }];
    });
    addMatches(/\b(?:(?:(rare|medium|high|great)\s+chance(?:\s*\((\d+(?:\.\d+)?)%\))?|(\d+(?:\.\d+)?)%\s+chance|(a)\s+chance|(chance))\s+of\s+)?launch(?:es|ing)\s+(an?|\d+)\s+additional Super Attack(?:\(s\)|s)?(?:\s+(\d+(?:\.\d+)?)%)?/gi, match => {
        const hasActivationChance = match.slice(1, 6).some(Boolean);
        const activation = hasActivationChance
            ? resolveProbability(context, "additional_super_activation", match[1] ?? match[4], match[7] ?? match[2] ?? match[3])
            : { percent: 100, probabilitySource: "explicit_text" };
        return [{
                kind: "additional_super_attack",
                count: explicitAttackCount(match[6]),
                ...activationProbabilityFields(activation),
                sourceText: match[0],
            }];
    });
    addMatches(/\b(?:(?:(rare|medium|high|great)\s+chance(?:\s*\((\d+(?:\.\d+)?)%\))?|(\d+(?:\.\d+)?)%\s+chance|(a)\s+chance|(chance))\s+of\s+)?launch(?:es|ing)\s+(an?|\d+)\s+additional attack(?:\(s\)|s)?/gi, match => {
        const hasActivationChance = match.slice(1, 6).some(Boolean);
        const activation = hasActivationChance
            ? resolveProbability(context, "additional_super_activation", match[1] ?? match[4], match[2] ?? match[3])
            : { percent: 100, probabilitySource: "explicit_text" };
        return [{
                kind: "additional_attack",
                count: explicitAttackCount(match[6]),
                ...activationProbabilityFields(activation),
                sourceText: match[0],
            }];
    });
    addMatches(/\bChance of performing a critical hit\s*(?:&|and|,)\s*damage reduction(?: rate)?\s+(\d+(?:\.\d+)?)%/gi, match => {
        const percent = Number(match[1]);
        return [{
                kind: "critical_chance",
                value: percent,
                unit: "percent",
                ...activationChanceFields(percent),
                sourceText: match[0],
            }, {
                kind: "damage_reduction",
                value: percent,
                unit: "percent",
                sourceText: match[0],
            }];
    });
    addMatches(/\bChance of performing a critical hit\s*(?:&|and|,)\s*(?:chance of\s+)?evading enemy(?:'s|’s) attack\s+(\d+(?:\.\d+)?)%/gi, match => {
        const percent = Number(match[1]);
        return ["critical_chance", "evade_chance"].map(kind => ({
            kind: kind,
            value: percent,
            unit: "percent",
            ...activationChanceFields(percent),
            sourceText: match[0],
        }));
    });
    addMatches(/\b(?:(rare|medium|high|great)\s+chance(?:\s*\((\d+(?:\.\d+)?)%\))?|(a)\s+chance|(chance))\s+of performing a critical hit(?:\s+(\d+(?:\.\d+)?)%)?/gi, match => {
        const probability = resolveProbability(context, "critical_activation", match[1] ?? match[3], match[5] ?? match[2]);
        return [{
                kind: "critical_chance",
                ...(probability.percent !== undefined ? { value: probability.percent } : {}),
                unit: "percent",
                ...activationProbabilityFields(probability),
                sourceText: match[0],
            }];
    });
    addMatches(/\b(\d+(?:\.\d+)?)%\s+chance of performing a critical hit/gi, match => {
        const activationChancePercent = Number(match[1]);
        return [{
                kind: "critical_chance",
                value: activationChancePercent,
                unit: "percent",
                ...activationChanceFields(activationChancePercent),
                sourceText: match[0],
            }];
    });
    addMatches(/\bPerforms a critical hit\b/gi, match => [{
            kind: "critical_chance",
            value: 100,
            unit: "percent",
            ...activationChanceFields(100),
            sourceText: match[0],
        }]);
    addMatches(/\b(?:(rare|medium|high|great)\s+chance(?:\s*\((\d+(?:\.\d+)?)%\))?|(a)\s+chance|(chance))\s+of evading enemy(?:'s|’s) attack(?:\s+(\d+(?:\.\d+)?)%)?/gi, match => {
        const probability = resolveProbability(context, "evade_activation", match[1] ?? match[3], match[5] ?? match[2]);
        return [{
                kind: "evade_chance",
                ...(probability.percent !== undefined ? { value: probability.percent } : {}),
                unit: "percent",
                ...activationProbabilityFields(probability),
                sourceText: match[0],
            }];
    });
    addMatches(/\b(\d+(?:\.\d+)?)%\s+chance of evading enemy(?:'s|’s) attack/gi, match => {
        const activationChancePercent = Number(match[1]);
        return [{
                kind: "evade_chance",
                value: activationChancePercent,
                unit: "percent",
                ...activationChanceFields(activationChancePercent),
                sourceText: match[0],
            }];
    });
    addMatches(/\bEvades enemy(?:'s|’s) attack\b/gi, match => [{
            kind: "evade_chance",
            value: 100,
            unit: "percent",
            ...activationChanceFields(100),
            sourceText: match[0],
        }]);
    addMatches(/\b(?:(?:(rare|medium|high|great)\s+chance(?:\s*\((\d+(?:\.\d+)?)%\))?|(\d+(?:\.\d+)?)%\s+chance|(a)\s+chance|(chance))\s+of\s+)?(?:stunning|stuns?)\s+((?:(?:the\s+)?attacked\s+enemy)|(?:(?:the\s+)?enemy)|all enemies)\b/gi, match => {
        const hasActivationChance = match.slice(1, 6).some(Boolean);
        const probability = hasActivationChance
            ? resolveProbability(context, "stun_activation", match[1] ?? match[4], match[2] ?? match[3])
            : { percent: 100, probabilitySource: "explicit_text" };
        return [{
                kind: "stun_chance",
                value: 1,
                unit: "boolean",
                ...activationProbabilityFields(probability),
                sourceText: match[0],
            }];
    });
    addMatches(/\b(?:(?:(rare|medium|high|great)\s+chance(?:\s*\((\d+(?:\.\d+)?)%\))?|(\d+(?:\.\d+)?)%\s+chance|(a)\s+chance|(chance))\s+of\s+)?(?:sealing|seals?)\s+((?:(?:the\s+)?attacked\s+enemy)|(?:(?:the\s+)?enemy))['’]s\s+Super Attack(?:s)?\b/gi, match => {
        const hasActivationChance = match.slice(1, 6).some(Boolean);
        const probability = hasActivationChance
            ? resolveProbability(context, "seal_activation", match[1] ?? match[4], match[2] ?? match[3])
            : { percent: 100, probabilitySource: "explicit_text" };
        return [{
                kind: "super_attack_seal",
                value: 1,
                unit: "boolean",
                ...activationProbabilityFields(probability),
                sourceText: match[0],
            }];
    });
    addMatches(/\b(?:(?:(rare|medium|high|great)\s+chance(?:\s*\((\d+(?:\.\d+)?)%\))?|(\d+(?:\.\d+)?)%\s+chance|(a)\s+chance|(chance))\s+of\s+)?(?:sealing|seals?)\s+all enemies['’]\s+Super Attacks?\b/gi, match => {
        const hasActivationChance = match.slice(1, 6).some(Boolean);
        const probability = hasActivationChance
            ? resolveProbability(context, "seal_activation", match[1] ?? match[4], match[2] ?? match[3])
            : { percent: 100, probabilitySource: "explicit_text" };
        return [{
                kind: "super_attack_seal",
                value: 1,
                unit: "boolean",
                ...activationProbabilityFields(probability),
                sourceText: match[0],
            }];
    });
    addMatches(/\b(?:(?:Receives|Gains)\s+)?(?:an additional\s+)?Ki\s*\+\s*(\d+(?:\.\d+)?)/gi, match => [{
            kind: "ki",
            value: Number(match[1]),
            unit: "ki",
            sourceText: match[0],
        }]);
    addMatches(/\b(?:(?:Receives|Gains)\s+)?(?:an additional\s+)?((?:HP|ATK|DEF)(?:\s*(?:,|&|and)\s*(?:HP|ATK|DEF))*)\s*\+?\s*(\d+(?:\.\d+)?)(%)?/gi, match => {
        const value = Number(match[2]);
        const unit = match[3] ? "percent" : "flat";
        return (match[1].match(/HP|ATK|DEF/gi) ?? []).map(kind => ({
            kind: kind.toLowerCase(),
            value,
            unit,
            sourceText: match[0],
        }));
    });
    addMatches(/\bRecovers\s+(\d+(?:\.\d+)?)%\s+HP\b/gi, match => [{
            kind: "hp",
            value: Number(match[1]),
            unit: "percent",
            sourceText: match[0],
        }]);
    addMatches(/\bDamage reduction rate\s+(\d+(?:\.\d+)?)%/gi, match => [{
            kind: "damage_reduction",
            value: Number(match[1]),
            unit: "percent",
            sourceText: match[0],
        }]);
    addMatches(/\bChance of evading enemy(?:'s|’s) attack\s+(\d+(?:\.\d+)?)%/gi, match => {
        const chancePercent = Number(match[1]);
        return [{
                kind: "evade_chance",
                value: chancePercent,
                unit: "percent",
                ...activationChanceFields(chancePercent),
                sourceText: match[0],
            }];
    });
    addMatches(/\bChance of performing a critical hit\s+(\d+(?:\.\d+)?)%/gi, match => {
        const chancePercent = Number(match[1]);
        return [{
                kind: "critical_chance",
                value: chancePercent,
                unit: "percent",
                ...activationChanceFields(chancePercent),
                sourceText: match[0],
            }];
    });
    addMatches(/\bGuards all attacks\b/gi, match => [{
            kind: "guard",
            value: 1,
            unit: "boolean",
            sourceText: match[0],
        }]);
    addMatches(/\bAttacks are effective against all Types\b/gi, match => [{
            kind: "effective_against_all_types",
            value: 1,
            unit: "boolean",
            sourceText: match[0],
        }]);
    const selected = [];
    for (const candidate of candidates.sort((left, right) => left.start - right.start || right.end - left.end)) {
        if (!selected.some(existing => candidate.start < existing.end && candidate.end > existing.start)) {
            selected.push(candidate);
        }
    }
    selected.sort((left, right) => left.start - right.start);
    const modifiers = applyEffectModifiers(body, selected);
    return {
        atoms: selected.flatMap(candidate => candidate.atoms),
        unknownSegments: unknownSegmentsBetweenAtoms(body, [...selected, ...modifiers]),
    };
}
function applyEffectModifiers(body, atoms) {
    const candidates = [];
    const addModifiers = (pattern, build) => {
        for (const match of body.matchAll(pattern)) {
            const start = match.index ?? 0;
            candidates.push({
                start,
                end: start + match[0].length,
                apply: build(match),
            });
        }
    };
    addModifiers(/\bwithin the turn\b/gi, () => atom => {
        atom.duration = { kind: "within_turn" };
    });
    addModifiers(/\bfor\s+(\d+)\s+turn(?:s\b|\(s\)(?!\w)|\b)/gi, match => atom => {
        atom.duration = { kind: "turns", turns: Number(match[1]) };
    });
    addModifiers(/\b(?:for the rest of (?:the )?battle|throughout (?:the )?battle|permanently)\b/gi, () => atom => {
        atom.duration = { kind: "battle" };
    });
    addModifiers(/\(\s*up to\s+(\d+(?:\.\d+)?)%\s*\)/gi, match => atom => {
        atom.stackCap = Number(match[1]);
    });
    const applied = [];
    for (const modifier of candidates.sort((left, right) => left.start - right.start || left.end - right.end)) {
        const preceding = [...atoms]
            .reverse()
            .find(atom => atom.end <= modifier.start && !body.slice(atom.end, modifier.start).includes(";"));
        if (!preceding) {
            continue;
        }
        const bridge = stripKnownModifierText(body.slice(preceding.end, modifier.start));
        if (!/^[\s,()]*$/.test(bridge)) {
            continue;
        }
        if (/up to/i.test(modifierText(body, modifier)) && preceding.atoms.some(atom => atom.unit !== "percent")) {
            continue;
        }
        for (const atom of preceding.atoms) {
            modifier.apply(atom);
        }
        applied.push(modifier);
    }
    return applied;
}
function stripKnownModifierText(sourceText) {
    return sourceText
        .replace(/\bwithin the turn\b/gi, "")
        .replace(/\bfor\s+\d+\s+turn(?:s\b|\(s\)(?!\w)|\b)/gi, "")
        .replace(/\b(?:for the rest of (?:the )?battle|throughout (?:the )?battle|permanently)\b/gi, "")
        .replace(/\(\s*up to\s+\d+(?:\.\d+)?%\s*\)/gi, "");
}
function modifierText(body, modifier) {
    return body.slice(modifier.start, modifier.end);
}
function unknownSegmentsBetweenAtoms(body, atoms) {
    if (atoms.length === 0) {
        return body.trim() ? [body.trim()] : [];
    }
    const segments = [];
    let cursor = 0;
    for (const atom of [...atoms].sort((left, right) => left.start - right.start || left.end - right.end)) {
        if (atom.start < cursor) {
            cursor = Math.max(cursor, atom.end);
            continue;
        }
        const segment = cleanUnknownEffectSegment(body.slice(cursor, atom.start));
        if (segment) {
            segments.push(segment);
        }
        cursor = atom.end;
    }
    const finalSegment = cleanUnknownEffectSegment(body.slice(cursor));
    if (finalSegment) {
        segments.push(finalSegment);
    }
    return segments;
}
function cleanUnknownEffectSegment(sourceText) {
    let text = sourceText.trim();
    let previous;
    do {
        previous = text;
        text = text
            .replace(/^(?:and|plus)\b\s*/i, "")
            .replace(/\s*\b(?:and|plus)$/i, "")
            .replace(/^[,;&]+\s*/, "")
            .replace(/\s*[,;&]+$/, "")
            .trim();
    } while (text !== previous);
    return text.replace(/\s+/g, " ");
}
const BENEFICIAL_EFFECT_KINDS = new Set([
    "ki", "hp", "atk", "def", "damage_reduction", "guard", "evade_chance",
    "critical_chance", "additional_attack", "additional_super_attack",
    "effective_against_all_types", "ki_sphere_change", "scouter", "revive", "domain",
]);
function applyEffectTarget(atom, resolvedTarget) {
    const allyTarget = isAllyTarget(resolvedTarget.target);
    return {
        ...atom,
        target: { ...resolvedTarget.target },
        ...(resolvedTarget.categories ? { categories: resolvedTarget.categories } : {}),
        ...(resolvedTarget.classes ? { classes: resolvedTarget.classes } : {}),
        ...(resolvedTarget.types ? { types: resolvedTarget.types } : {}),
        ...(allyTarget && BENEFICIAL_EFFECT_KINDS.has(atom.kind)
            ? { classifications: ["support"] }
            : {}),
    };
}
function combineParseStatuses(conditionStatus, effectStatus) {
    if (conditionStatus === "supported" && effectStatus === "supported") {
        return "supported";
    }
    if (conditionStatus === "unknown" && effectStatus === "unknown") {
        return "unknown";
    }
    return "partial";
}
function confidenceFromStatus(status) {
    return status === "supported" ? "high" : status === "partial" ? "medium" : "low";
}
function unknownEffect(sourceText, target = { scope: "unknown" }, categories, classes, types) {
    return {
        kind: "unknown",
        target: { ...target },
        ...(categories ? { categories } : {}),
        ...(classes ? { classes } : {}),
        ...(types ? { types } : {}),
        sourceText,
    };
}
function unknownStandaloneRule(stateKey, block) {
    const fragment = block.source[block.source.length - 1];
    return {
        id: ruleIdFromFragment(stateKey, fragment),
        condition: { op: "unknown", sourceText: block.text },
        conditionStatus: "unknown",
        effects: [unknownEffect(block.text)],
        effectStatus: "unknown",
        source: block.source,
        parseStatus: "unknown",
        confidence: "low",
    };
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
    const conditionStatusCounts = { supported: 0, partial: 0, unknown: 0 };
    const effectStatusCounts = { supported: 0, partial: 0, unknown: 0 };
    const supportedPredicateCounts = {};
    const supportedEffectCounts = {};
    const probabilitySourceCounts = {
        explicit_text: 0,
        first_party_game_db: 0,
        qualitative_lexicon: 0,
        unresolved: 0,
    };
    const conditionCounts = { always: 0, predicate: 0, unknown: 0, composite: 0 };
    let passiveStateCount = 0;
    let unknownEffectCount = 0;
    let unresolvedProbabilityEffectCount = 0;
    let derivedSupportEffectCount = 0;
    let unknownFragmentCount = 0;
    let teamEvaluableRuleCount = 0;
    let placementEvaluableRuleCount = 0;
    let scenarioRuleCount = 0;
    let scenarioEvaluableRuleCount = 0;
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
            conditionStatusCounts[rule.conditionStatus] += 1;
            effectStatusCounts[rule.effectStatus] += 1;
            const conditionKind = classifyCondition(rule.condition);
            conditionCounts[conditionKind] += 1;
            const hasScenario = hasScenarioPredicate(rule.condition);
            const hasRuntime = hasRuntimePredicate(rule.condition);
            const hasPlacement = hasPlacementPredicate(rule.condition);
            if (hasScenario) {
                scenarioRuleCount += 1;
            }
            if (hasRuntime) {
                runtimeOnlyRuleCount += 1;
            }
            if (rule.conditionStatus === "supported" && !hasRuntime) {
                if (hasScenario) {
                    scenarioEvaluableRuleCount += 1;
                }
                else if (hasPlacement) {
                    placementEvaluableRuleCount += 1;
                }
                else {
                    teamEvaluableRuleCount += 1;
                }
            }
            collectPredicates(rule.condition, supportedPredicateCounts);
            for (const effect of rule.effects) {
                if (effect.kind === "unknown") {
                    unknownEffectCount += 1;
                }
                else {
                    supportedEffectCounts[effect.kind] = (supportedEffectCounts[effect.kind] ?? 0) + 1;
                }
                if (effect.classifications?.includes("support")) {
                    derivedSupportEffectCount += 1;
                }
                const probabilitySources = [effect.probabilitySource, effect.additionalToSuperProbabilitySource]
                    .filter((source) => source !== undefined);
                for (const source of probabilitySources) {
                    probabilitySourceCounts[source] += 1;
                }
                if (probabilitySources.includes("unresolved")) {
                    unresolvedProbabilityEffectCount += 1;
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
        conditionStatusCounts,
        effectStatusCounts,
        conditionCounts,
        supportedPredicateCounts: sortedRecord(supportedPredicateCounts),
        supportedEffectCounts: sortedRecord(supportedEffectCounts),
        derivedSupportEffectCount,
        unknownEffectCount,
        unresolvedProbabilityEffectCount,
        probabilitySourceCounts,
        unknownFragmentCount,
        teamEvaluableRuleCount,
        placementEvaluableRuleCount,
        scenarioRuleCount,
        scenarioEvaluableRuleCount,
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
    "hp_percent", "battle_turn", "turn_from_entry", "turn_number", "turns_from_entry",
    "enemy_count", "enemy_category",
    "enemy_name", "enemy_class", "enemy_type", "enemy_status", "domain_active",
    "standby_active", "active_skill_used", "revive_triggered",
]);
const RUNTIME_PREDICATES = new Set([
    "ki_amount", "ki_spheres_obtained", "ki_sphere_type_obtained", "attacks_performed",
    "attacks_received", "attacks_evaded", "super_attacks_performed", "super_attack_received",
    "final_blow_delivered", "chance_roll",
]);
const PLACEMENT_PREDICATES = new Set([
    "battle_slot", "rotation_assignment", "rotation_partner_present", "floater_assignment",
]);
function hasScenarioPredicate(condition) {
    return conditionHasPredicate(condition, predicate => SCENARIO_PREDICATES.has(predicate.kind));
}
function hasRuntimePredicate(condition) {
    return conditionHasPredicate(condition, predicate => RUNTIME_PREDICATES.has(predicate.kind));
}
function hasPlacementPredicate(condition) {
    return conditionHasPredicate(condition, predicate => PLACEMENT_PREDICATES.has(predicate.kind));
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
                    ...(releaseSource.passiveDetails ? { passiveDetails: releaseSource.passiveDetails } : {}),
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
        if (expected.passiveDetails) {
            const sourceMap = mapPassiveDetailsToSource(expected.passiveText, expected.passiveDetails);
            if (sourceMap.unmappedTexts.length > 0) {
                issues.push({
                    code: "passive-details-source-map",
                    message: `${sourceMap.unmappedTexts.length} PassiveDetails text(s) do not map to rawText offsets.`,
                    stateKey: state.stateKey,
                });
            }
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
        const conditionStatus = conditionExpressionStatus(rule.condition);
        const effectStatus = effectListStatus(rule.effects);
        if (rule.conditionStatus !== conditionStatus) {
            issues.push({ code: "condition-status", message: `Condition status does not match its AST.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        if (rule.effectStatus !== effectStatus) {
            issues.push({ code: "effect-status", message: `Effect status does not match its effects.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        if (rule.parseStatus !== combineParseStatuses(rule.conditionStatus, rule.effectStatus)) {
            issues.push({ code: "rule-status", message: `Rule status does not match condition/effect status.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        validateCondition(rule.condition, 1, state, rule, issues);
        validateFragmentList(rule.source, rawLines, state, rule, issues);
        for (const effect of rule.effects) {
            validateFiniteNumbers(effect, state, rule, issues);
            validateEffectContract(effect, state, rule, issues);
            for (const field of ["activationChancePercent", "additionalToSuperChancePercent", "chancePercent"]) {
                const chance = effect[field];
                if (chance !== undefined && (chance < 0 || chance > 100)) {
                    issues.push({ code: "chance-range", message: `${field} is outside 0..100.`, stateKey: state.stateKey, ruleId: rule.id });
                }
            }
            if (effect.activationChancePercent !== undefined
                && effect.chancePercent !== undefined
                && effect.activationChancePercent !== effect.chancePercent) {
                issues.push({ code: "chance-alias", message: `chancePercent must equal activationChancePercent when both are present.`, stateKey: state.stateKey, ruleId: rule.id });
            }
            if (effect.additionalToSuperChancePercent !== undefined && effect.kind !== "additional_attack") {
                issues.push({ code: "additional-to-super-kind", message: `additionalToSuperChancePercent is valid only for additional_attack.`, stateKey: state.stateKey, ruleId: rule.id });
            }
            validateProbabilityChannel(effect, "activation", state, rule, issues);
            validateProbabilityChannel(effect, "additional_to_super", state, rule, issues);
            if (effect.count !== undefined && (!Number.isInteger(effect.count) || effect.count <= 0)) {
                issues.push({ code: "effect-count", message: `Effect count must be a positive integer.`, stateKey: state.stateKey, ruleId: rule.id });
            }
            if (effect.stackCap !== undefined && effect.stackCap < 0) {
                issues.push({ code: "effect-cap", message: `Effect cap cannot be negative.`, stateKey: state.stateKey, ruleId: rule.id });
            }
            if (effect.duration?.kind === "turns" && (!Number.isInteger(effect.duration.turns) || (effect.duration.turns ?? 0) <= 0)) {
                issues.push({ code: "duration-range", message: `Turn duration must be a positive integer.`, stateKey: state.stateKey, ruleId: rule.id });
            }
            if (effect.duration?.kind !== "turns" && effect.duration?.turns !== undefined) {
                issues.push({ code: "duration-turns-kind", message: `Only a turns duration may declare turns.`, stateKey: state.stateKey, ruleId: rule.id });
            }
        }
    }
    validateSourceTokenCoverage(passive, rawLines, state, issues);
}
function conditionExpressionStatus(condition) {
    if (condition.op === "always") {
        return "supported";
    }
    if (condition.op === "unknown") {
        return "unknown";
    }
    if (condition.op === "predicate") {
        return condition.predicate.kind === "unknown" ? "unknown" : "supported";
    }
    if (condition.op === "not") {
        return conditionExpressionStatus(condition.child);
    }
    return aggregateStatuses(condition.children.map(conditionExpressionStatus));
}
function effectListStatus(effects) {
    return aggregateStatuses(effects.map(effect => {
        if (effect.kind === "unknown") {
            return "unknown";
        }
        if (effect.probabilitySource === "unresolved"
            || effect.additionalToSuperProbabilitySource === "unresolved") {
            return "partial";
        }
        return "supported";
    }));
}
function validateProbabilityChannel(effect, channel, state, rule, issues) {
    const percent = channel === "activation"
        ? effect.activationChancePercent
        : effect.additionalToSuperChancePercent;
    const term = channel === "activation"
        ? effect.qualitativeChanceTerm
        : effect.additionalToSuperQualitativeChanceTerm;
    const source = channel === "activation"
        ? effect.probabilitySource
        : effect.additionalToSuperProbabilitySource;
    const prefix = channel === "activation" ? "probability" : "additional-to-super-probability";
    if ((percent !== undefined || term !== undefined) && source === undefined) {
        issues.push({ code: `${prefix}-source`, message: `Probability metadata requires a source.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (source === "unresolved" && percent !== undefined) {
        issues.push({ code: `${prefix}-unresolved-value`, message: `An unresolved probability cannot declare a numeric value.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (source !== undefined && source !== "unresolved" && percent === undefined) {
        issues.push({ code: `${prefix}-missing-value`, message: `A resolved probability must declare a numeric value.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if ((source === "first_party_game_db" || source === "qualitative_lexicon") && term === undefined) {
        issues.push({ code: `${prefix}-missing-term`, message: `Non-text numeric resolution requires a qualitative term.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (channel === "additional_to_super" && source !== undefined && effect.kind !== "additional_attack") {
        issues.push({ code: "additional-to-super-kind", message: `Additional-to-Super probability metadata is valid only for additional_attack.`, stateKey: state.stateKey, ruleId: rule.id });
    }
}
function aggregateStatuses(statuses) {
    if (statuses.length === 0 || statuses.every(status => status === "unknown")) {
        return "unknown";
    }
    if (statuses.every(status => status === "supported")) {
        return "supported";
    }
    return "partial";
}
const ALLY_PREDICATE_KINDS = new Set([
    "ally_category_present", "ally_name_present", "all_rotation_allies_category",
    "rotation_partner_category", "rotation_partner_name", "ally_class_present",
    "ally_type_present", "ally_class_type_present", "ally_category_class_present",
    "all_rotation_allies_class",
]);
const ALLY_TARGET_SCOPES = new Set([
    "rotation_allies", "team_allies", "category_allies", "class_allies", "type_allies",
    "class_type_allies",
]);
function isAllyTarget(target) {
    return ALLY_TARGET_SCOPES.has(target.scope);
}
function validateEffectContract(effect, state, rule, issues) {
    const allyTarget = isAllyTarget(effect.target);
    if (allyTarget && effect.target.selfInclusion === undefined) {
        issues.push({ code: "target-self-inclusion", message: `Ally target must declare self inclusion.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (effect.target.scope === "category_allies" && (effect.categories?.length ?? 0) === 0) {
        issues.push({ code: "target-categories", message: `Category ally target must name affected categories.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (["class_allies", "class_type_allies"].includes(effect.target.scope) && (effect.classes?.length ?? 0) === 0) {
        issues.push({ code: "target-classes", message: `Class ally target must name an affected class.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (["type_allies", "class_type_allies"].includes(effect.target.scope) && (effect.types?.length ?? 0) === 0) {
        issues.push({ code: "target-types", message: `Type ally target must name an affected type.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    validateClassAndTypeValues(effect.classes, effect.types, state, rule, issues);
    if (effect.kind === "support") {
        issues.push({ code: "standalone-support", message: `Support must be a derived classification, not an isolated effect.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    const isDerivedSupport = effect.classifications?.includes("support") === true;
    if (isDerivedSupport && (!allyTarget || !BENEFICIAL_EFFECT_KINDS.has(effect.kind))) {
        issues.push({ code: "invalid-support-classification", message: `Support classification requires a beneficial typed ally effect.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (allyTarget && BENEFICIAL_EFFECT_KINDS.has(effect.kind) && !isDerivedSupport) {
        issues.push({ code: "missing-support-classification", message: `Beneficial typed ally effect must carry derived support classification.`, stateKey: state.stateKey, ruleId: rule.id });
    }
}
function validateSourceTokenCoverage(passive, rawLines, state, issues) {
    const fragments = uniqueOrderedFragments([
        ...passive.rules.flatMap(rule => rule.source),
        ...passive.unparsedFragments,
    ]);
    const covered = rawLines.map(line => Array.from({ length: line.length }, () => false));
    for (const fragment of fragments) {
        const start = fragment.start ?? rawLines[fragment.lineIndex]?.indexOf(fragment.text) ?? -1;
        const end = fragment.end ?? (start >= 0 ? start + fragment.text.length : -1);
        if (start < 0 || end < start || !covered[fragment.lineIndex]) {
            continue;
        }
        for (let index = start; index < end; index += 1) {
            covered[fragment.lineIndex][index] = true;
        }
    }
    for (let lineIndex = 0; lineIndex < rawLines.length; lineIndex += 1) {
        for (let column = 0; column < rawLines[lineIndex].length; column += 1) {
            if (!/\s/.test(rawLines[lineIndex][column]) && !covered[lineIndex][column]) {
                issues.push({
                    code: "source-token-loss",
                    message: `Source token at line ${lineIndex}, column ${column} is not referenced.`,
                    stateKey: state.stateKey,
                });
                return;
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
        if (condition.op === "all") {
            validateScenarioWindow(condition.children, state, rule, issues);
        }
    }
    else if (condition.op === "not") {
        validateCondition(condition.child, depth + 1, state, rule, issues);
    }
    else if (condition.op === "predicate") {
        validateFiniteNumbers(condition.predicate, state, rule, issues);
        if (ALLY_PREDICATE_KINDS.has(condition.predicate.kind) && condition.predicate.selfInclusion === undefined) {
            issues.push({ code: "condition-self-inclusion", message: `Ally condition must declare self inclusion.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        if (condition.predicate.count !== undefined
            && (!Number.isInteger(condition.predicate.count) || condition.predicate.count <= 0)) {
            issues.push({ code: "condition-count", message: `Ally count must be a positive integer.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        if (["ally_category_present", "ally_category_class_present", "all_rotation_allies_category", "rotation_partner_category"].includes(condition.predicate.kind)
            && (condition.predicate.categories?.length ?? 0) === 0) {
            issues.push({ code: "condition-categories", message: `Category condition must name at least one category.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        if (["ally_name_present", "rotation_partner_name"].includes(condition.predicate.kind)
            && (condition.predicate.names?.length ?? 0) === 0) {
            issues.push({ code: "condition-names", message: `Name condition must name at least one character.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        if (["ally_class_present", "ally_class_type_present", "ally_category_class_present", "all_rotation_allies_class", "character_class"].includes(condition.predicate.kind)
            && (condition.predicate.classes?.length ?? 0) === 0) {
            issues.push({ code: "condition-classes", message: `Class condition must name at least one class.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        if (["ally_type_present", "ally_class_type_present", "character_type"].includes(condition.predicate.kind)
            && (condition.predicate.types?.length ?? 0) === 0) {
            issues.push({ code: "condition-types", message: `Type condition must name at least one type.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        validateClassAndTypeValues(condition.predicate.classes, condition.predicate.types, state, rule, issues);
        validateScenarioPredicate(condition.predicate, state, rule, issues);
        if (condition.predicate.kind === "battle_slot" && condition.predicate.scope !== "self") {
            issues.push({ code: "slot-scope", message: `Battle slot must describe the current character.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        if (condition.predicate.kind === "battle_slot" && (condition.predicate.slots?.length ?? 0) === 0) {
            issues.push({ code: "slot-values", message: `Battle slot must name at least one position.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        for (const slot of condition.predicate.slots ?? []) {
            if (!Number.isInteger(slot) || slot < 1 || slot > 3) {
                issues.push({ code: "slot-range", message: `Battle slot must be 1, 2, or 3.`, stateKey: state.stateKey, ruleId: rule.id });
            }
        }
    }
}
function validateScenarioPredicate(predicate, state, rule, issues) {
    const scenarioKinds = ["hp_percent", "battle_turn", "turn_from_entry"];
    const isScenario = scenarioKinds.includes(predicate.kind);
    const comparatorAllowed = ["lt", "lte", "eq", "gte", "gt"].includes(predicate.comparator ?? "");
    if (isScenario && !comparatorAllowed) {
        issues.push({ code: "scenario-comparator", message: `HP and turn predicates require an explicit scalar comparator.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (isScenario && predicate.value === undefined) {
        issues.push({ code: "scenario-value", message: `HP and turn predicates require a scalar value.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (isScenario && predicate.maxValue !== undefined) {
        issues.push({ code: "scenario-max-value", message: `Scenario intervals must use an all AST of scalar bounds.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (predicate.kind === "hp_percent") {
        if (predicate.scope !== "team") {
            issues.push({ code: "hp-scope", message: `HP is shared team HP and must use team scope.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        if (predicate.value !== undefined && (!Number.isFinite(predicate.value) || predicate.value < 0 || predicate.value > 100)) {
            issues.push({ code: "hp-range", message: `HP percent must be within 0..100.`, stateKey: state.stateKey, ruleId: rule.id });
        }
    }
    if (predicate.kind === "battle_turn" && predicate.scope !== "battle") {
        issues.push({ code: "battle-turn-scope", message: `Battle turn must use battle scope.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (predicate.kind === "turn_from_entry" && predicate.scope !== "self") {
        issues.push({ code: "entry-turn-scope", message: `Turn from entry must use self scope.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (["battle_turn", "turn_from_entry"].includes(predicate.kind)
        && predicate.value !== undefined
        && (!Number.isInteger(predicate.value) || predicate.value < 1)) {
        issues.push({ code: "turn-index", message: `Turn indexes are 1-based positive integers.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    const knownMoments = ["start_of_turn", "entry_turn", "end_of_turn"];
    if (predicate.evaluationMoment !== undefined && !knownMoments.includes(predicate.evaluationMoment)) {
        issues.push({ code: "evaluation-moment", message: `Evaluation moment is not recognized.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (predicate.evaluationMoment !== undefined && !isScenario) {
        issues.push({ code: "evaluation-moment-kind", message: `Evaluation moment is valid only on scenario predicates.`, stateKey: state.stateKey, ruleId: rule.id });
    }
}
function validateScenarioWindow(children, state, rule, issues) {
    for (const kind of ["hp_percent", "battle_turn", "turn_from_entry"]) {
        const predicates = children
            .filter((child) => child.op === "predicate")
            .map(child => child.predicate)
            .filter(predicate => predicate.kind === kind && predicate.value !== undefined);
        const lowerValues = predicates
            .filter(predicate => predicate.comparator === "gte" || predicate.comparator === "gt")
            .map(predicate => predicate.value);
        const upperValues = predicates
            .filter(predicate => predicate.comparator === "lte" || predicate.comparator === "lt")
            .map(predicate => predicate.value);
        const lower = lowerValues.length > 0 ? Math.max(...lowerValues) : undefined;
        const upper = upperValues.length > 0 ? Math.min(...upperValues) : undefined;
        if (lower !== undefined && upper !== undefined && lower > upper) {
            issues.push({ code: "condition-window-range", message: `Scenario window lower bound exceeds its upper bound.`, stateKey: state.stateKey, ruleId: rule.id });
        }
    }
}
function validateClassAndTypeValues(classes, types, state, rule, issues) {
    if ((classes ?? []).some(value => !TEAM_ANALYSIS_CLASSES.includes(value))) {
        issues.push({ code: "class-value", message: `Class must be Super or Extreme.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if ((types ?? []).some(value => !TEAM_ANALYSIS_TYPES.includes(value))) {
        issues.push({ code: "type-value", message: `Type must be AGL, TEQ, INT, STR, or PHY.`, stateKey: state.stateKey, ruleId: rule.id });
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