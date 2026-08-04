"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertValidTeamAnalysisDataset = exports.validateTeamAnalysisDataset = exports.buildTeamAnalysisCoverageReport = exports.mapPassiveDetailsToSource = exports.parsePassive = exports.buildTeamAnalysisDataset = exports.releaseStateFromForm = exports.buildAwakeningFamilyId = exports.buildVariantGroupId = exports.buildHardDuplicateGroupId = exports.buildStateKey = exports.TEAM_ANALYSIS_PARSER_VERSION = exports.TEAM_ANALYSIS_RULES_VERSION = exports.TEAM_ANALYSIS_SCHEMA_VERSION = void 0;
const crypto_1 = require("crypto");
const team_analysis_chance_lexicon_1 = require("./team-analysis-chance-lexicon");
const team_analysis_first_party_probabilities_1 = require("./team-analysis-first-party-probabilities");
exports.TEAM_ANALYSIS_SCHEMA_VERSION = 1;
exports.TEAM_ANALYSIS_RULES_VERSION = "1";
exports.TEAM_ANALYSIS_PARSER_VERSION = "1.6.0";
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
            ? parsePassive(stateKey, releaseSource.passiveName, releaseSource.passiveText, releaseSource.passiveDetails, {
                characterId: identity.characterId,
                formId: identity.formId,
                releaseState: identity.releaseState,
            })
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
function parsePassive(stateKey, name, rawText, passiveDetails, context) {
    const sourceMap = mapPassiveDetailsToSource(rawText, passiveDetails);
    const conditionEvidence = validConditionEvidence(stateKey, rawText, sourceMap.sourceFragments, passiveDetails?.conditionEvidence ?? [], context);
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
        const headerScaling = currentCondition
            ? parseKiSphereScalingHeader(currentCondition.text)
                ?? parseCombatEventScalingHeader(currentCondition.text)
            : undefined;
        const headerConditionResult = currentCondition
            ? headerScaling
                ? { condition: { op: "always" }, status: "supported" }
                : parseCondition(currentCondition.text, enrichedConditionText(currentCondition, conditionEvidence))
            : { condition: { op: "always" }, status: "supported" };
        const inlineTemporal = splitInlineTemporalCondition(block.text);
        const conditionResult = inlineTemporal
            ? combineConditionResults(headerConditionResult, parseCondition(inlineTemporal.conditionText))
            : headerConditionResult;
        const effectResult = parseEffects(inlineTemporal?.effectText ?? block.text, {
            stateKey,
            rawText,
            ruleLineIndex: block.source[0]?.lineIndex ?? -1,
            ...((currentCondition || inlineTemporal?.activationContextText) ? {
                phaseContextText: [currentCondition?.text, inlineTemporal?.activationContextText]
                    .filter((value) => Boolean(value))
                    .join(" "),
            } : {}),
            ...(headerScaling ? { headerScaling } : {}),
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
        ...(conditionEvidence.length > 0 ? { conditionEvidence } : {}),
    };
}
exports.parsePassive = parsePassive;
function validConditionEvidence(stateKey, rawText, sourceFragments, evidenceEntries, context) {
    if (!context || evidenceEntries.length === 0) {
        return [];
    }
    const passiveTextSha256 = (0, crypto_1.createHash)("sha256").update(rawText, "utf8").digest("hex");
    const fragmentsByLine = new Map(sourceFragments.map(fragment => [fragment.lineIndex, fragment]));
    const seenLines = new Set();
    return evidenceEntries.filter(evidence => {
        const endLineIndex = evidence.anchor?.endLineIndex ?? evidence.anchor?.lineIndex;
        const anchorLineIndexes = Number.isInteger(evidence.anchor?.lineIndex)
            && Number.isInteger(endLineIndex)
            && endLineIndex >= evidence.anchor.lineIndex
            ? Array.from({ length: endLineIndex - evidence.anchor.lineIndex + 1 }, (_value, index) => evidence.anchor.lineIndex + index)
            : [];
        if (evidence.kind !== "enemy_status"
            || evidence.stateKey !== stateKey
            || evidence.characterId !== context.characterId
            || evidence.formId !== context.formId
            || evidence.releaseState !== context.releaseState
            || evidence.passiveTextSha256 !== passiveTextSha256
            || evidence.provenance?.source !== "dokkan_fyi_payload"
            || evidence.provenance.markerSyntax !== "passiveImg"
            || !evidence.provenance.sourceVersion
            || anchorLineIndexes.length === 0
            || anchorLineIndexes.some(lineIndex => seenLines.has(lineIndex))) {
            return false;
        }
        const expectedPayloadField = context.releaseState === "initial"
            ? "props.character.passive_skill.description"
            : "props.character.extreme_z_awakening.passive_skill.description";
        const anchorFragments = anchorLineIndexes
            .map(lineIndex => fragmentsByLine.get(lineIndex))
            .filter((fragment) => fragment !== undefined);
        const normalizedAnchorText = logicalText("condition", anchorFragments);
        if (anchorFragments.length !== anchorLineIndexes.length
            || evidence.provenance.payloadField !== expectedPayloadField
            || normalizedAnchorText !== evidence.anchor.normalizedText
            || stripPassiveMarkers(evidence.anchor.structuralText).replace(/\s+/g, " ")
                !== evidence.anchor.normalizedText) {
            return false;
        }
        const statusSource = evidence.anchor.structuralText.slice(evidence.anchor.structuralText.toLowerCase().indexOf("following status:")
            + "following status:".length);
        const sourceTokens = [...statusSource.matchAll(/\{passiveImg:([^}]+)\}/g)]
            .map(match => match[1]);
        if (sourceTokens.length !== evidence.statuses.length
            || evidence.statuses.some((status, order) => status.order !== order
                || status.sourceToken !== sourceTokens[order]
                || status.status !== enemyStatusFromEvidenceMarker(status.sourceToken)
                || status.resolution !== (status.status ? "supported" : "unresolved"))) {
            return false;
        }
        const expectedConnector = evidenceConnector(evidence.anchor.structuralText, sourceTokens.length);
        if (evidence.connector !== expectedConnector
            || evidence.resolution !== evidenceResolution(evidence.statuses, expectedConnector)) {
            return false;
        }
        anchorLineIndexes.forEach(lineIndex => seenLines.add(lineIndex));
        return true;
    }).sort((left, right) => left.anchor.lineIndex - right.anchor.lineIndex);
}
function stripPassiveMarkers(sourceText) {
    return sourceText.replace(/\{[^}]+\}/g, "").trim();
}
function evidenceConnector(structuralText, markerCount) {
    if (markerCount < 2) {
        return undefined;
    }
    const statusSource = structuralText.slice(structuralText.toLowerCase().indexOf("following status:") + "following status:".length);
    const firstMarkerIndex = statusSource.search(/\{passiveImg:[^}]+\}/);
    const lastMarkerIndex = statusSource.lastIndexOf("{passiveImg:");
    const lastMarkerEnd = lastMarkerIndex >= 0 ? statusSource.indexOf("}", lastMarkerIndex) + 1 : -1;
    if (firstMarkerIndex < 0 || lastMarkerEnd <= firstMarkerIndex) {
        return undefined;
    }
    const markerList = statusSource.slice(firstMarkerIndex, lastMarkerEnd)
        .replace(/\{passiveImg:[^}]+\}/g, "#");
    const hasAnd = /\band\b/i.test(markerList);
    const hasOr = /\bor\b/i.test(markerList);
    if (hasAnd === hasOr) {
        return undefined;
    }
    return hasAnd ? "and" : "or";
}
function evidenceResolution(statuses, connector) {
    if (statuses.length === 0) {
        return "unresolved";
    }
    return statuses.some(status => !status.status) || (statuses.length > 1 && !connector)
        ? "partial"
        : "supported";
}
function enemyStatusFromEvidenceMarker(sourceToken) {
    if (sourceToken === "atk_down")
        return "atk_down";
    if (sourceToken === "def_down")
        return "def_down";
    if (sourceToken === "stun")
        return "stunned";
    if (sourceToken === "astute")
        return "super_attack_sealed";
    return undefined;
}
function enrichedConditionText(block, evidenceEntries) {
    const evidenceByLine = new Map();
    evidenceEntries.forEach(evidence => {
        const endLineIndex = evidence.anchor.endLineIndex ?? evidence.anchor.lineIndex;
        for (let lineIndex = evidence.anchor.lineIndex; lineIndex <= endLineIndex; lineIndex += 1) {
            evidenceByLine.set(lineIndex, evidence);
        }
    });
    if (!block.source.some(fragment => evidenceByLine.has(fragment.lineIndex))) {
        return block.text;
    }
    const enrichedSource = block.source.map(fragment => {
        const evidence = evidenceByLine.get(fragment.lineIndex);
        if (!evidence) {
            return fragment;
        }
        return {
            ...fragment,
            text: fragment.lineIndex === evidence.anchor.lineIndex
                ? semanticEvidenceText(evidence)
                : "",
        };
    });
    return logicalText(block.kind, enrichedSource);
}
function semanticEvidenceText(evidence) {
    let order = 0;
    const statusOffset = evidence.anchor.structuralText.toLowerCase().indexOf("following status:")
        + "following status:".length;
    return evidence.anchor.structuralText.replace(/\{passiveImg:([^}]+)\}/g, (_match, sourceToken, offset) => {
        if (offset < statusOffset) {
            return "";
        }
        const item = evidence.statuses[order++];
        if (!item || item.sourceToken !== sourceToken || !item.status) {
            return "unresolved enemy status";
        }
        if (item.status === "atk_down")
            return "ATK Down";
        if (item.status === "def_down")
            return "DEF Down";
        if (item.status === "stunned")
            return "stunned";
        return "Super Attack sealed";
    });
}
function combineConditionResults(left, right) {
    if (left.condition.op === "always") {
        return right;
    }
    if (right.condition.op === "always") {
        return left;
    }
    const condition = resolveThatEnemyReferences({
        op: "all",
        children: [left.condition, right.condition],
    });
    return { condition, status: conditionExpressionStatus(condition) };
}
function splitInlineTemporalCondition(sourceText) {
    const temporalSuffix = /\s+((?:starting from the \d+(?:st|nd|rd|th) turn|for \d+ turn(?:s|\(s\))?) from (?:the start of battle|the character['â€™]s entry turn))$/i.exec(sourceText);
    const kiSuffix = /\s+((?:when|if) attacking with (?:(?:between\s+)?\d+\s+(?:and|to)\s+\d+|(?:(?:exactly|at least|at most)\s+)?\d+(?:\s+or\s+(?:more|less))?) Ki)$/i.exec(sourceText)
        ?? /\s+((?:when attacking with\s+|with\s+)(?:(?:between\s+)?\d+\s+(?:and|to)\s+\d+|(?:(?:exactly|at least|at most)\s+)?\d+(?:\s+or\s+(?:more|less))?)\s*(?:AGL|TEQ|INT|STR|PHY|Rainbow|non[- ]Rainbow|Type)?\s*Ki Spheres? obtained)$/i.exec(sourceText);
    const combatSuffix = /\s+((?:before|when|after)\s+(?:(?:performing|receiving|evading)(?:\s+(?:an?|the|\d+(?:\s+or\s+(?:more|less))?)\s+(?:(?:Ki Blast|Unarmed|Physical)\s+)?(?:normal\s+|Super\s+)?attacks?)?|attacking|delivering\s+(?:a\s+|the\s+)?final blow)(?:\s+(?:in battle|within the turn))?)$/i.exec(sourceText);
    const againstNormalAttack = /\s+(against normal attacks?)$/i.exec(sourceText);
    const suffix = temporalSuffix ?? kiSuffix ?? combatSuffix ?? againstNormalAttack;
    if (!suffix || suffix.index === undefined) {
        return undefined;
    }
    const effectText = sourceText.slice(0, suffix.index).trim();
    const conditionText = againstNormalAttack && suffix === againstNormalAttack
        ? "When receiving a normal attack"
        : suffix[1];
    return effectText
        ? {
            effectText,
            conditionText,
            ...(!(againstNormalAttack && suffix === againstNormalAttack)
                ? { activationContextText: suffix[1] }
                : {}),
        }
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
        if (current.kind === "condition"
            && /^When the target enemy is in the following status:/i.test(fragment.text)) {
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
function parseCondition(sourceText, semanticText = sourceText) {
    const text = sourceText.trim();
    if (isAlwaysHeader(text)) {
        return { condition: { op: "always" }, status: "supported" };
    }
    const parsed = parseBooleanCondition(semanticText.trim());
    const condition = resolveThatEnemyReferences(semanticText === sourceText ? parsed : rewriteConditionSourceText(parsed, sourceText));
    return { condition, status: conditionExpressionStatus(condition) };
}
function rewriteConditionSourceText(condition, sourceText) {
    if (condition.op === "predicate") {
        return predicateExpression({ ...condition.predicate, sourceText });
    }
    if (condition.op === "unknown") {
        return { op: "unknown", sourceText };
    }
    if (condition.op === "not") {
        return { op: "not", child: rewriteConditionSourceText(condition.child, sourceText) };
    }
    if (condition.op === "all" || condition.op === "any") {
        return {
            op: condition.op,
            children: condition.children.map(child => rewriteConditionSourceText(child, sourceText)),
        };
    }
    return condition;
}
function resolveThatEnemyReferences(condition) {
    if (condition.op === "not") {
        return condition;
    }
    if (condition.op === "any") {
        return {
            op: "any",
            children: condition.children.map(resolveThatEnemyReferences),
        };
    }
    if (condition.op !== "all") {
        return condition;
    }
    return resolveThatEnemyReferencesInConjunction(condition, conjunctiveComponentProvesSingleEnemy(condition));
}
function conjunctiveComponentProvesSingleEnemy(condition) {
    if (condition.op === "predicate") {
        return condition.predicate.kind === "enemy_count"
            && condition.predicate.comparator === "eq"
            && condition.predicate.value === 1;
    }
    return condition.op === "all" && condition.children.some(conjunctiveComponentProvesSingleEnemy);
}
function resolveThatEnemyReferencesInConjunction(condition, provesSingleEnemy) {
    if (condition.op === "predicate") {
        if (!provesSingleEnemy
            || condition.predicate.enemyReference !== "that_enemy"
            || condition.predicate.enemySelection !== "unknown") {
            return condition;
        }
        return predicateExpression({
            ...condition.predicate,
            enemySelection: "only_enemy",
        });
    }
    if (condition.op === "all") {
        return {
            op: "all",
            children: condition.children.map(child => child.op === "all" || child.op === "predicate"
                ? resolveThatEnemyReferencesInConjunction(child, provesSingleEnemy)
                : resolveThatEnemyReferences(child)),
        };
    }
    return resolveThatEnemyReferences(condition);
}
function parseBooleanCondition(sourceText) {
    const original = sourceText.trim();
    const withoutPrefix = original.replace(/^(?:when|if)\s+/i, "").trim();
    const text = stripOuterConditionParentheses(withoutPrefix);
    const negated = /^not\s+(.+)$/i.exec(text);
    if (negated && isCombatEventLanguage(negated[1])) {
        const child = parseBooleanCondition(negated[1]);
        if (child.op !== "unknown") {
            return { op: "not", child };
        }
    }
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
    const combatEvent = parseExactCombatEventCondition(text, sourceText);
    if (combatEvent) {
        return combatEvent;
    }
    const ki = parseExactKiCondition(text, sourceText);
    if (ki) {
        return ki;
    }
    const enemy = parseExactEnemyCondition(text, sourceText);
    if (enemy) {
        return enemy;
    }
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
function isCombatEventLanguage(sourceText) {
    return /\b(?:attacks?|Super Attacks?|evad(?:e|ed|ing)|final blow)\b/i.test(sourceText);
}
function combatEventIdentity(sourceText, direction) {
    if (direction === "final_blow") {
        return {
            eventType: "final_blow_delivered",
            actor: "self",
            attackKind: "unknown",
            predicateKind: "final_blow_delivered",
            actorSource: "explicit_text",
            attackKindSource: "unresolved",
        };
    }
    const superAttack = /\b(?:Super|Ultra Super) Attacks?\b/i.test(sourceText);
    const normalAttack = /\bnormal attacks?\b/i.test(sourceText);
    const attackStyle = /\bKi Blast Super Attack\b/i.test(sourceText)
        ? "ki_blast"
        : /\bUnarmed Super Attack\b/i.test(sourceText)
            ? "unarmed"
            : /\bPhysical Super Attack\b/i.test(sourceText)
                ? "physical"
                : superAttack
                    ? "unknown"
                    : undefined;
    const eventType = direction === "performed"
        ? "attack_performed"
        : direction === "targeted"
            ? "incoming_attack"
            : direction === "landed"
                ? "attack_landed"
                : "attack_evaded";
    const predicateKind = direction === "performed"
        ? superAttack ? "super_attacks_performed" : "attacks_performed"
        : direction === "targeted"
            ? superAttack ? "incoming_super_attack" : "incoming_attack"
            : direction === "landed"
                ? superAttack ? "super_attack_received" : "attacks_received"
                : "attacks_evaded";
    return {
        eventType,
        actor: direction === "performed" ? "self" : "enemy",
        attackKind: superAttack ? "super_attack" : normalAttack ? "normal_attack" : "unknown",
        ...(attackStyle ? { attackStyle } : {}),
        predicateKind,
        actorSource: "documented_domain_rule",
        attackKindSource: superAttack || normalAttack ? "explicit_text" : "unresolved",
        ...(attackStyle ? { attackStyleSource: attackStyle === "unknown" ? "unresolved" : "explicit_text" } : {}),
    };
}
function combatEventDescriptor(identity, mode, relativeTiming, options) {
    return {
        eventType: identity.eventType,
        actor: identity.actor,
        attackKind: identity.attackKind,
        ...(identity.attackStyle ? { attackStyle: identity.attackStyle } : {}),
        mode,
        ...(options?.countScope ? { countScope: options.countScope } : {}),
        relativeTiming,
        provenance: {
            eventType: "explicit_text",
            actor: identity.actorSource,
            attackKind: identity.attackKindSource,
            ...(identity.attackStyleSource ? { attackStyle: identity.attackStyleSource } : {}),
            mode: options?.modeSource ?? "explicit_text",
            ...(options?.countScopeSource ? { countScope: options.countScopeSource } : {}),
            relativeTiming: options?.relativeTimingSource ?? "explicit_text",
        },
    };
}
function combatPredicate(identity, descriptor, sourceText, comparator, value) {
    return predicateExpression({
        kind: identity.predicateKind,
        scope: "self",
        ...(comparator ? { comparator } : {}),
        ...(value !== undefined ? { value } : {}),
        combatEvent: descriptor,
        sourceText,
    });
}
function parseCombatCountScope(sourceText) {
    if (/\b(?:within|in) (?:the )?(?:current )?turn\b/i.test(sourceText)) {
        return { countScope: "current_turn", source: "explicit_text" };
    }
    if (/\b(?:in|throughout) (?:the )?battle\b/i.test(sourceText)) {
        return { countScope: "battle", source: "explicit_text" };
    }
    return { countScope: "unknown", source: "unresolved" };
}
function parseExactCombatEventCondition(text, sourceText) {
    if (/^Every time\b/i.test(text)) {
        return undefined;
    }
    if (/^after receiving or evading an? attack$/i.test(text)) {
        const received = combatEventIdentity("attack", "landed");
        const evaded = combatEventIdentity("attack", "evaded");
        return {
            op: "any",
            children: [received, evaded].map(identity => combatPredicate(identity, combatEventDescriptor(identity, "current_event", "after_event"), sourceText)),
        };
    }
    const interval = /^(?:after\s+)?(performing|receiving|evading)\s+between\s+(\d+)\s+and\s+(\d+)\s+((?:(?:Ki Blast|Unarmed|Physical)\s+)?(?:Super\s+)?attacks?)\s*((?:(?:in|throughout) (?:the )?battle|(?:within|in) (?:the )?(?:current )?turn)?)$/i.exec(text);
    if (interval) {
        const lower = Number(interval[2]);
        const upper = Number(interval[3]);
        if (!Number.isInteger(lower) || !Number.isInteger(upper) || lower < 0 || lower > upper) {
            return undefined;
        }
        const direction = /^performing$/i.test(interval[1]) ? "performed" : /^receiving$/i.test(interval[1]) ? "landed" : "evaded";
        const identity = combatEventIdentity(interval[4], direction);
        const scope = parseCombatCountScope(interval[5]);
        const descriptor = combatEventDescriptor(identity, "accumulated_count", "after_event", {
            countScope: scope.countScope,
            countScopeSource: scope.source,
        });
        return {
            op: "all",
            children: [
                combatPredicate(identity, descriptor, sourceText, "gte", lower),
                combatPredicate(identity, descriptor, sourceText, "lte", upper),
            ],
        };
    }
    const counted = /^(after|before)\s+(performing|receiving|evading)\s+(?:(exactly|at least|at most)\s+)?(\d+)(?:\s+or\s+(more|less))?\s+((?:(?:Ki Blast|Unarmed|Physical)\s+)?(?:Super\s+)?attacks?)\s*((?:(?:in|throughout) (?:the )?battle|(?:within|in) (?:the )?(?:current )?turn)?)$/i.exec(text);
    if (counted) {
        const value = Number(counted[4]);
        if (!Number.isInteger(value) || value < 0) {
            return undefined;
        }
        const direction = /^performing$/i.test(counted[2]) ? "performed" : /^receiving$/i.test(counted[2]) ? "landed" : "evaded";
        const identity = combatEventIdentity(counted[6], direction);
        const scope = parseCombatCountScope(counted[7]);
        const comparator = counted[5]
            ? /^more$/i.test(counted[5]) ? "gte" : "lte"
            : /^at least$/i.test(counted[3] ?? "") ? "gte"
                : /^at most$/i.test(counted[3] ?? "") ? "lte"
                    : /^exactly$/i.test(counted[3] ?? "") ? "eq"
                        : /^before$/i.test(counted[1]) ? "lt" : "gte";
        // "Before receiving N attacks" is a comparator over already resolved
        // history (count < N), not proof that a landed outcome exists before
        // resolution. Completed event counters therefore remain after-event.
        return combatPredicate(identity, combatEventDescriptor(identity, "accumulated_count", "after_event", {
            countScope: scope.countScope,
            countScopeSource: scope.source,
        }), sourceText, comparator, value);
    }
    const currentPatterns = [
        { pattern: /^(?:attacking|performing an? attack)$/i, direction: "performed", timing: "during_event" },
        { pattern: /^before (?:attacking|performing an? attack)$/i, direction: "performed", timing: "before_event" },
        { pattern: /^after (?:attacking|performing an? attack)$/i, direction: "performed", timing: "after_event" },
        { pattern: /^(?:when )?performing an? ((?:(?:Ki Blast|Unarmed|Physical)\s+)?(?:Super|Ultra Super) Attack)$/i, direction: "performed", timing: "during_event" },
        { pattern: /^after performing an? ((?:(?:Ki Blast|Unarmed|Physical)\s+)?(?:Super|Ultra Super) Attack)$/i, direction: "performed", timing: "after_event" },
        { pattern: /^(?:when )?receiving an? ((?:(?:Ki Blast|Unarmed|Physical)\s+)?(?:normal|Super) attack)$/i, direction: "targeted", timing: "during_event" },
        { pattern: /^(?:receiving|when receiving) an? attack$/i, direction: "targeted", timing: "during_event" },
        { pattern: /^before receiving an? attack(?: within the turn)?$/i, direction: "targeted", timing: "before_event" },
        { pattern: /^after (?:receiving|being hit by) an? attack$/i, direction: "landed", timing: "after_event" },
        { pattern: /^(?:when )?evading an? attack$/i, direction: "evaded", timing: "during_event" },
        { pattern: /^after evading an? attack$/i, direction: "evaded", timing: "after_event" },
        { pattern: /^after delivering (?:a |the )?final blow$/i, direction: "final_blow", timing: "after_event" },
        { pattern: /^(?:when )?delivering (?:a |the )?final blow$/i, direction: "final_blow", timing: "during_event" },
    ];
    for (const candidate of currentPatterns) {
        const match = candidate.pattern.exec(text);
        if (!match) {
            continue;
        }
        const identity = combatEventIdentity(match[1] ?? text, candidate.direction);
        return combatPredicate(identity, combatEventDescriptor(identity, "current_event", candidate.timing), sourceText);
    }
    return undefined;
}
function parseExactKiCondition(text, sourceText) {
    const interval = /^(?:attacking|before attacking) with (?:between\s+)?(\d+)\s+(?:and|to)\s+(\d+) Ki$/i.exec(text);
    if (interval) {
        const lower = Number(interval[1]);
        const upper = Number(interval[2]);
        if (!isKiAmount(lower) || !isKiAmount(upper) || lower > upper) {
            return undefined;
        }
        const evaluationMoment = /^before attacking/i.test(text)
            ? "before_attack"
            : "when_attacking";
        return {
            op: "all",
            children: [
                kiAmountPredicate("gte", lower, evaluationMoment, sourceText),
                kiAmountPredicate("lte", upper, evaluationMoment, sourceText),
            ],
        };
    }
    const amount = /^(attacking|before attacking) with (?:(exactly|at least|at most)\s+)?(\d+)(?:\s+or\s+(more|less))? Ki$/i.exec(text);
    if (amount) {
        const value = Number(amount[3]);
        if (!isKiAmount(value)) {
            return undefined;
        }
        const comparator = /^at least$/i.test(amount[2] ?? "") || /^more$/i.test(amount[4] ?? "")
            ? "gte"
            : /^at most$/i.test(amount[2] ?? "") || /^less$/i.test(amount[4] ?? "")
                ? "lte"
                : "eq";
        return kiAmountPredicate(comparator, value, /^before attacking$/i.test(amount[1]) ? "before_attack" : "when_attacking", sourceText);
    }
    const sphereInterval = /^(?:attacking with\s+|with\s+)?(?:between\s+)?(\d+)\s+(?:and|to)\s+(\d+)\s*(.*?)\s*Ki Spheres? obtained$/i.exec(text);
    if (sphereInterval) {
        const lower = Number(sphereInterval[1]);
        const upper = Number(sphereInterval[2]);
        const kiSphereTypes = parseKiSphereTypes(sphereInterval[3]);
        if (!isKiSphereCount(lower) || !isKiSphereCount(upper) || lower > upper || !kiSphereTypes) {
            return undefined;
        }
        return {
            op: "all",
            children: [
                kiSphereCountPredicate("gte", lower, kiSphereTypes, sourceText),
                kiSphereCountPredicate("lte", upper, kiSphereTypes, sourceText),
            ],
        };
    }
    const sphereCount = /^(?:attacking with\s+|with\s+)?(?:(exactly|at least|at most)\s+)?(\d+)(?:\s+or\s+(more|less))?\s*(.*?)\s*Ki Spheres? obtained$/i.exec(text);
    if (sphereCount) {
        const value = Number(sphereCount[2]);
        const kiSphereTypes = parseKiSphereTypes(sphereCount[4]);
        if (!isKiSphereCount(value) || !kiSphereTypes) {
            return undefined;
        }
        const comparator = /^at least$/i.test(sphereCount[1] ?? "") || /^more$/i.test(sphereCount[3] ?? "")
            ? "gte"
            : /^at most$/i.test(sphereCount[1] ?? "") || /^less$/i.test(sphereCount[3] ?? "")
                ? "lte"
                : "eq";
        return kiSphereCountPredicate(comparator, value, kiSphereTypes, sourceText);
    }
    const spherePresence = /^With\s+an?\s*(.*?)\s*Ki Sphere obtained$/i.exec(text);
    if (spherePresence) {
        const kiSphereTypes = parseKiSphereTypes(spherePresence[1]);
        if (kiSphereTypes) {
            return predicateExpression({
                kind: "ki_sphere_type_obtained",
                scope: "self",
                comparator: "gte",
                value: 1,
                kiSphereTypes,
                kiContext: "collected_ki_spheres",
                sourceText,
            });
        }
    }
    return undefined;
}
function kiAmountPredicate(comparator, value, evaluationMoment, sourceText) {
    return predicateExpression({
        kind: "ki_amount",
        scope: "self",
        comparator,
        value,
        evaluationMoment,
        kiContext: "final_attack_ki",
        sourceText,
    });
}
function kiSphereCountPredicate(comparator, value, kiSphereTypes, sourceText) {
    return predicateExpression({
        kind: "ki_spheres_obtained",
        scope: "self",
        comparator,
        value,
        kiSphereTypes,
        kiContext: "collected_ki_spheres",
        sourceText,
    });
}
function isKiAmount(value) {
    return Number.isInteger(value) && value >= 0 && value <= 24;
}
function isKiSphereCount(value) {
    return Number.isInteger(value) && value >= 0;
}
function parseExactEnemyCondition(text, sourceText) {
    const exact = parseEnemyCountCondition(text, sourceText)
        ?? parseEnemyHpCondition(text, sourceText)
        ?? parseEnemyStatusCondition(text, sourceText)
        ?? parseEnemyNameCondition(text, sourceText)
        ?? parseEnemyAttributeCondition(text, sourceText);
    if (exact) {
        return exact;
    }
    const qualifiedStatus = /^(.*?)\s+if\s+((?:the )?(?:target|attacked|selected) enemy is in the following status:\s*.+)$/i.exec(text);
    if (qualifiedStatus) {
        const status = parseEnemyStatusCondition(qualifiedStatus[2], sourceText);
        if (status) {
            return {
                op: "all",
                children: [
                    { op: "unknown", sourceText: qualifiedStatus[1].trim() },
                    status,
                ],
            };
        }
    }
    const missingStatusWithHp = /^((?:the )?(?:target|attacked|selected) enemy is in the following status:)\s+HP is\s+(.+?)(\s*,.*)?$/i.exec(text);
    if (missingStatusWithHp) {
        const hp = parseEnemyHpComparison(missingStatusWithHp[2], sourceText, "current_target");
        if (hp) {
            return {
                op: "all",
                children: [
                    { op: "unknown", sourceText: missingStatusWithHp[1] },
                    hp,
                    ...(missingStatusWithHp[3]
                        ? [{ op: "unknown", sourceText: missingStatusWithHp[3].trim() }]
                        : []),
                ],
            };
        }
    }
    const excludedQualifier = /^(.*?)\s+(\([^)]*\bexcluded\))$/i.exec(text);
    if (excludedQualifier) {
        const known = parseEnemyNameCondition(excludedQualifier[1], sourceText);
        if (known) {
            return {
                op: "all",
                children: [known, { op: "unknown", sourceText: excludedQualifier[2] }],
            };
        }
    }
    return undefined;
}
function parseEnemyCountCondition(text, sourceText) {
    const matchingClassCount = /^facing\s+(\d+)\s+or more\s+(Super|Extreme) Class enemies$/i.exec(text);
    if (matchingClassCount && Number(matchingClassCount[1]) > 0) {
        return predicateExpression({
            kind: "enemy_class",
            scope: "enemy",
            enemySelection: "any_enemy",
            comparator: "gte",
            count: Number(matchingClassCount[1]),
            classes: [normalizeClass(matchingClassCount[2])],
            sourceText,
        });
    }
    if (/^(?:facing|there (?:is|are))\s+multiple enemies$/i.test(text)) {
        return enemyCountPredicate("gte", 2, sourceText);
    }
    if (/^(?:facing|there (?:is|are))\s+no enemies$/i.test(text)) {
        return enemyCountPredicate("eq", 0, sourceText);
    }
    const only = /^(?:facing|there (?:is|are))\s+only\s+(\d+)\s+enem(?:y|ies)$/i.exec(text);
    if (only) {
        return enemyCountPredicateIfValid("eq", Number(only[1]), sourceText);
    }
    const qualified = /^(?:facing|there (?:is|are))\s+(\d+)\s+or\s+(more|less)\s+enemies$/i.exec(text)
        ?? /^(\d+)\s+or\s+(more|less)\s+enemies$/i.exec(text);
    if (qualified) {
        return enemyCountPredicateIfValid(qualified[2].toLowerCase() === "more" ? "gte" : "lte", Number(qualified[1]), sourceText);
    }
    const exact = /^(?:facing|there (?:is|are))\s+(\d+)\s+enem(?:y|ies)$/i.exec(text);
    return exact ? enemyCountPredicateIfValid("eq", Number(exact[1]), sourceText) : undefined;
}
function enemyCountPredicateIfValid(comparator, value, sourceText) {
    return isEnemyCount(value) ? enemyCountPredicate(comparator, value, sourceText) : undefined;
}
function enemyCountPredicate(comparator, value, sourceText) {
    return predicateExpression({
        kind: "enemy_count",
        scope: "battle",
        comparator,
        value,
        sourceText,
    });
}
function isEnemyCount(value) {
    return Number.isInteger(value) && value >= 0;
}
function parseEnemyHpCondition(text, sourceText) {
    let body = text.trim();
    let evaluationMoment;
    const beforeAttack = /^before attacking\s+/i.exec(body);
    if (beforeAttack) {
        evaluationMoment = "before_attack";
        body = body.slice(beforeAttack[0].length).trim();
    }
    const momentSuffixes = [
        { pattern: /\s+at the start of (?:the )?turn$/i, moment: "start_of_turn" },
        { pattern: /\s+when attacking$/i, moment: "when_attacking" },
    ];
    for (const suffix of momentSuffixes) {
        const match = suffix.pattern.exec(body);
        if (match) {
            evaluationMoment = suffix.moment;
            body = body.slice(0, match.index).trim();
            break;
        }
    }
    let enemySelection;
    let comparisonText;
    const selected = /^(?:(?:the )?(?:target|attacked|selected) enemy|an? enemy being attacked)['’]s HP is\s+(.+)$/i.exec(body);
    const whose = /^an? enemy whose HP is\s+(.+)$/i.exec(body);
    const withHp = /^facing an? enemy with\s+(.+)\s+HP$/i.exec(body);
    const only = /^that enemy['’]s HP is\s+(.+)$/i.exec(body);
    const ambiguous = /^(?:the )?enemy['’]s HP is\s+(.+)$/i.exec(body);
    if (selected) {
        enemySelection = "current_target";
        comparisonText = selected[1];
    }
    else if (whose) {
        enemySelection = evaluationMoment === "before_attack" ? "current_target" : "any_enemy";
        comparisonText = whose[1];
    }
    else if (withHp) {
        enemySelection = "any_enemy";
        comparisonText = withHp[1];
    }
    else if (only) {
        enemySelection = "unknown";
        comparisonText = only[1];
    }
    else if (ambiguous) {
        enemySelection = "unknown";
        comparisonText = ambiguous[1];
    }
    else {
        return undefined;
    }
    const condition = parseEnemyHpComparison(comparisonText, sourceText, enemySelection, evaluationMoment);
    if (!only || !condition) {
        return condition;
    }
    return mapConditionPredicates(condition, predicate => ({
        ...predicate,
        enemyReference: "that_enemy",
    }));
}
function mapConditionPredicates(condition, transform) {
    if (condition.op === "predicate") {
        return predicateExpression(transform(condition.predicate));
    }
    if (condition.op === "all" || condition.op === "any") {
        return { op: condition.op, children: condition.children.map(child => mapConditionPredicates(child, transform)) };
    }
    if (condition.op === "not") {
        return { op: "not", child: mapConditionPredicates(condition.child, transform) };
    }
    return condition;
}
function parseEnemyHpComparison(comparisonText, sourceText, enemySelection, evaluationMoment) {
    const interval = /^between\s+(\d+)%\s+and\s+(\d+)%$/i.exec(comparisonText);
    if (interval) {
        const minimum = Number(interval[1]);
        const maximum = Number(interval[2]);
        if (!isHpPercent(minimum) || !isHpPercent(maximum) || minimum > maximum) {
            return undefined;
        }
        return {
            op: "all",
            children: [
                enemyHpPredicate("gte", minimum, sourceText, enemySelection, evaluationMoment),
                enemyHpPredicate("lte", maximum, sourceText, enemySelection, evaluationMoment),
            ],
        };
    }
    const exact = /^exactly\s+(\d+)%$/i.exec(comparisonText);
    if (exact) {
        return enemyHpPredicateIfValid("eq", Number(exact[1]), sourceText, enemySelection, evaluationMoment);
    }
    const strict = /^(above|below)\s+(\d+)%$/i.exec(comparisonText);
    if (strict) {
        return enemyHpPredicateIfValid(strict[1].toLowerCase() === "above" ? "gt" : "lt", Number(strict[2]), sourceText, enemySelection, evaluationMoment);
    }
    const qualified = /^(\d+)%\s+or\s+(more|less|above|below)$/i.exec(comparisonText);
    if (qualified) {
        const qualifier = qualified[2].toLowerCase();
        return enemyHpPredicateIfValid(qualifier === "more" || qualifier === "above" ? "gte" : "lte", Number(qualified[1]), sourceText, enemySelection, evaluationMoment);
    }
    const plain = /^(\d+)%$/i.exec(comparisonText);
    return plain
        ? enemyHpPredicateIfValid("eq", Number(plain[1]), sourceText, enemySelection, evaluationMoment)
        : undefined;
}
function enemyHpPredicateIfValid(comparator, value, sourceText, enemySelection, evaluationMoment) {
    return isHpPercent(value)
        ? enemyHpPredicate(comparator, value, sourceText, enemySelection, evaluationMoment)
        : undefined;
}
function enemyHpPredicate(comparator, value, sourceText, enemySelection, evaluationMoment) {
    return predicateExpression({
        kind: "enemy_hp_percent",
        scope: "enemy",
        comparator,
        value,
        enemySelection,
        ...(evaluationMoment ? { evaluationMoment } : {}),
        sourceText,
    });
}
function parseEnemyStatusCondition(text, sourceText) {
    const header = /^(?:the )?(target|attacked|selected) enemy is in the following status:\s*(.+)$/i.exec(text);
    if (header) {
        return parseEnemyStatusValues(header[2], "current_target", sourceText);
    }
    const possessiveSeal = /^(?:the )?(target|attacked|selected) enemy['’]s Super Attack is (not )?sealed$/i.exec(text);
    if (possessiveSeal) {
        const predicate = enemyStatusPredicate("super_attack_sealed", "current_target", sourceText);
        return possessiveSeal[2] ? { op: "not", child: predicate } : predicate;
    }
    const forms = [
        { pattern: /^there (?:is|are) an? (.+?) enem(?:y|ies)$/i, selection: "any_enemy" },
        { pattern: /^all enemies are (.+)$/i, selection: "all_enemies" },
        { pattern: /^(?:the )?(?:target|attacked|selected) enemy (?:is|has) (.+)$/i, selection: "current_target" },
        { pattern: /^the only enemy (?:is|has) (.+)$/i, selection: "only_enemy" },
        { pattern: /^the enemy (?:is|has) (.+)$/i, selection: "unknown" },
    ];
    for (const form of forms) {
        const match = form.pattern.exec(text);
        if (!match) {
            continue;
        }
        let value = match[1].trim();
        let negated = false;
        if (/^not\s+/i.test(value)) {
            negated = true;
            value = value.replace(/^not\s+/i, "");
        }
        const status = parseEnemyStatusTerm(value);
        if (status) {
            const predicate = enemyStatusPredicate(status, form.selection, sourceText);
            return negated ? { op: "not", child: predicate } : predicate;
        }
    }
    const noStatus = /^there are no\s+(.+?)\s+enemies$/i.exec(text);
    if (noStatus) {
        const status = parseEnemyStatusTerm(noStatus[1]);
        return status
            ? { op: "not", child: enemyStatusPredicate(status, "any_enemy", sourceText) }
            : undefined;
    }
    return undefined;
}
function parseEnemyStatusValues(sourceText, selection, predicateSourceText) {
    const atomPattern = /ATK Down|DEF Down|stunned|Super Attack sealed|unresolved enemy status|HP is (?:between\s+\d+%\s+and\s+\d+%|exactly\s+\d+%|(?:above|below)\s+\d+%|\d+%(?:\s+or\s+(?:more|less|above|below))?)/gi;
    const matches = [...sourceText.matchAll(atomPattern)];
    const hasStatusAtom = matches.some(match => !/^HP is /i.test(match[0]));
    if (!hasStatusAtom || matches.some(match => match.index === undefined)) {
        return undefined;
    }
    const separators = [];
    let cursor = 0;
    for (const match of matches) {
        const separator = sourceText.slice(cursor, match.index).trim();
        if (cursor === 0) {
            if (separator)
                return undefined;
        }
        else {
            if (!/^(?:,|and|or|,\s*(?:and|or))$/i.test(separator))
                return undefined;
            separators.push(separator.toLowerCase());
        }
        cursor = (match.index ?? 0) + match[0].length;
    }
    const trailing = sourceText.slice(cursor).trim();
    if (trailing && trailing !== ",") {
        return undefined;
    }
    const children = matches.map(match => {
        if (/^unresolved enemy status$/i.test(match[0])) {
            return { op: "unknown", sourceText: predicateSourceText };
        }
        if (/^HP is /i.test(match[0])) {
            return parseEnemyHpComparison(match[0].replace(/^HP is\s+/i, ""), predicateSourceText, selection) ?? { op: "unknown", sourceText: predicateSourceText };
        }
        return enemyStatusPredicate(parseEnemyStatusTerm(match[0]), selection, predicateSourceText);
    });
    if (children.length === 1) {
        return trailing
            ? { op: "all", children: [children[0], { op: "unknown", sourceText: predicateSourceText }] }
            : children[0];
    }
    const hasAnd = separators.some(separator => /\band\b/.test(separator));
    const hasOr = separators.some(separator => /\bor\b/.test(separator));
    if (!hasAnd && !hasOr) {
        return { op: "unknown", sourceText: predicateSourceText };
    }
    if (hasAnd && hasOr) {
        return combineStatusAtomsWithPrecedence(children, separators, predicateSourceText, trailing === ",");
    }
    const condition = {
        op: hasAnd ? "all" : "any",
        children,
    };
    return trailing
        ? { op: "all", children: [condition, { op: "unknown", sourceText: predicateSourceText }] }
        : condition;
}
function combineStatusAtomsWithPrecedence(children, separators, sourceText, hasTrailingResidual) {
    const groups = [[children[0]]];
    separators.forEach((separator, index) => {
        if (/\bor\b/.test(separator)) {
            groups.push([children[index + 1]]);
        }
        else {
            groups[groups.length - 1].push(children[index + 1]);
        }
    });
    const condition = groups.length === 1
        ? { op: "all", children: groups[0] }
        : {
            op: "any",
            children: groups.map(group => group.length === 1 ? group[0] : { op: "all", children: group }),
        };
    return hasTrailingResidual
        ? { op: "all", children: [condition, { op: "unknown", sourceText }] }
        : condition;
}
function parseEnemyStatusTerm(sourceText) {
    const normalized = sourceText.trim().toLowerCase();
    if (normalized === "atk down")
        return "atk_down";
    if (normalized === "def down")
        return "def_down";
    if (normalized === "stunned")
        return "stunned";
    if (normalized === "super attack sealed")
        return "super_attack_sealed";
    return undefined;
}
function enemyStatusPredicate(status, enemySelection, sourceText) {
    return predicateExpression({
        kind: "enemy_status",
        scope: "enemy",
        enemySelection,
        enemyStatuses: [status],
        sourceText,
    });
}
function parseEnemyNameCondition(text, sourceText) {
    const includesForms = [
        { pattern: /^there (?:is|are) an? enem(?:y|ies) whose name includes\s+(.+)$/i, selection: "any_enemy" },
        { pattern: /^attacking an? enemy whose name includes\s+(.+)$/i, selection: "current_target" },
        { pattern: /^(?:the )?(?:target|attacked|selected) enemy['’]s name includes\s+(.+)$/i, selection: "current_target" },
        { pattern: /^the only enemy['’]s name includes\s+(.+)$/i, selection: "only_enemy" },
        { pattern: /^the enemy['’]s name includes\s+(.+)$/i, selection: "unknown" },
    ];
    for (const form of includesForms) {
        const match = form.pattern.exec(text);
        if (match) {
            return buildEnemyNameExpression(match[1], "includes", form.selection, sourceText);
        }
    }
    const noIncludes = /^there (?:is|are) no enem(?:y|ies) whose name includes\s+(.+)$/i.exec(text);
    if (noIncludes) {
        const expression = buildEnemyNameExpression(noIncludes[1], "includes", "any_enemy", sourceText);
        return expression ? { op: "not", child: expression } : undefined;
    }
    const exactForms = [
        { pattern: /^(.+) is an enemy$/i, selection: "any_enemy" },
        { pattern: /^(?:the )?(?:target|attacked|selected) enemy['’]s name is\s+(.+)$/i, selection: "current_target" },
        { pattern: /^the only enemy['’]s name is\s+(.+)$/i, selection: "only_enemy" },
        { pattern: /^the enemy['’]s name is\s+(.+)$/i, selection: "unknown" },
    ];
    for (const form of exactForms) {
        const match = form.pattern.exec(text);
        if (match) {
            return buildEnemyNameExpression(match[1], "exact", form.selection, sourceText);
        }
    }
    return undefined;
}
function buildEnemyNameExpression(sourceValues, nameMatch, enemySelection, sourceText) {
    const exclusion = /^(.*?)\s*,?\s+excluding\s+(.+)$/i.exec(sourceValues);
    const includedText = exclusion?.[1] ?? sourceValues;
    const included = parseQuotedValues(includedText);
    if (!included) {
        return undefined;
    }
    const excluded = exclusion ? parseQuotedValues(exclusion[2]) : undefined;
    if (exclusion && !excluded) {
        return undefined;
    }
    const children = included.values.map(name => predicateExpression({
        kind: "enemy_name",
        scope: "enemy",
        enemySelection,
        names: [name],
        nameMatch,
        ...(excluded ? { excludedNames: excluded.values, excludedNameMatch: nameMatch } : {}),
        sourceText,
    }));
    return children.length === 1
        ? children[0]
        : { op: included.connector === "and" ? "all" : "any", children };
}
function parseEnemyAttributeCondition(text, sourceText) {
    const forms = [
        { pattern: /^there (?:is|are) no\s+(.+?)\s+enemies$/i, selection: "any_enemy", negated: true },
        { pattern: /^there (?:is|are)\s+(?:an?\s+)?(.+?)\s+enem(?:y|ies)$/i, selection: "any_enemy" },
        { pattern: /^an?\s+(.+?)\s+enemy$/i, selection: "any_enemy" },
        { pattern: /^attacking\s+(?:an?\s+)?(.+?)\s+enemy$/i, selection: "current_target" },
        { pattern: /^all enemies are\s+(.+)$/i, selection: "all_enemies" },
        { pattern: /^the only enemy is\s+(.+)$/i, selection: "only_enemy" },
        { pattern: /^(?:the )?(?:target|attacked|selected) enemy is\s+(.+)$/i, selection: "current_target" },
        { pattern: /^the enemy is\s+(.+)$/i, selection: "unknown" },
    ];
    for (const form of forms) {
        const match = form.pattern.exec(text);
        if (!match) {
            continue;
        }
        const expression = parseEnemyAttribute(match[1], form.selection, sourceText);
        if (expression) {
            return form.negated ? { op: "not", child: expression } : expression;
        }
    }
    return undefined;
}
function parseEnemyAttribute(sourceText, enemySelection, predicateSourceText) {
    const classType = /^(Super|Extreme)(?: Class)?\s+(AGL|TEQ|INT|STR|PHY)(?: Type)?$/i.exec(sourceText);
    if (classType) {
        return predicateExpression({
            kind: "enemy_class_type",
            scope: "enemy",
            enemySelection,
            classes: [normalizeClass(classType[1])],
            types: [normalizeType(classType[2])],
            sourceText: predicateSourceText,
        });
    }
    const classMatch = /^(Super|Extreme) Class$/i.exec(sourceText);
    if (classMatch) {
        return predicateExpression({
            kind: "enemy_class",
            scope: "enemy",
            enemySelection,
            classes: [normalizeClass(classMatch[1])],
            sourceText: predicateSourceText,
        });
    }
    const typeMatch = /^(AGL|TEQ|INT|STR|PHY) Type$/i.exec(sourceText);
    if (typeMatch) {
        return predicateExpression({
            kind: "enemy_type",
            scope: "enemy",
            enemySelection,
            types: [normalizeType(typeMatch[1])],
            sourceText: predicateSourceText,
        });
    }
    const categoryMatch = /^(.+?) Category$/i.exec(sourceText);
    if (categoryMatch) {
        const categories = parseQuotedValues(categoryMatch[1]);
        if (!categories) {
            return undefined;
        }
        const children = categories.values.map(category => predicateExpression({
            kind: "enemy_category",
            scope: "enemy",
            enemySelection,
            categories: [category],
            sourceText: predicateSourceText,
        }));
        return children.length === 1
            ? children[0]
            : { op: categories.connector === "and" ? "all" : "any", children };
    }
    const status = parseEnemyStatusTerm(sourceText);
    return status ? enemyStatusPredicate(status, enemySelection, predicateSourceText) : undefined;
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
    if (suffix && suffix[1].trim()) {
        const temporal = parseExactTemporalCondition(suffix[2], suffix[2]);
        if (temporal) {
            return {
                op: "all",
                children: [parseBooleanCondition(suffix[1]), temporal],
            };
        }
    }
    const combatSuffix = /^(.*?)\s+((?:when|before|after)\s+(?:attacking|(?:performing|receiving|evading)(?:\s+(?:an?|the)\s+(?:(?:Ki Blast|Unarmed|Physical)\s+)?(?:normal\s+|Super\s+)?attack)?|delivering\s+(?:a\s+|the\s+)?final blow))$/i.exec(text);
    if (combatSuffix && combatSuffix[1].trim()) {
        const combat = parseExactCombatEventCondition(combatSuffix[2], combatSuffix[2]);
        if (combat) {
            return {
                op: "all",
                children: [parseBooleanCondition(combatSuffix[1]), combat],
            };
        }
    }
    return undefined;
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
const KI_SPHERE_TYPES = [
    ...TEAM_ANALYSIS_TYPES,
    "rainbow",
    "non_rainbow",
    "any",
];
const SLOT_LIST_PATTERN = "(?:1st|2nd|3rd)(?:\\s*(?:,|and|or)\\s*(?:1st|2nd|3rd))*";
function normalizeClass(value) {
    return /^super$/i.test(value) ? "Super" : "Extreme";
}
function normalizeType(value) {
    return value.toUpperCase();
}
function parseKiSphereTypes(sourceText) {
    const text = sourceText.trim();
    if (!text || /^any$/i.test(text)) {
        return ["any"];
    }
    if (/^Rainbow$/i.test(text)) {
        return ["rainbow"];
    }
    if (/^(?:non[- ]Rainbow|Type)$/i.test(text)) {
        return ["non_rainbow"];
    }
    const parts = text.split(/\s*(?:,|&|\band\b|\bor\b)\s*/i).filter(Boolean);
    if (parts.length === 0 || parts.some(part => !/^(?:AGL|TEQ|INT|STR|PHY)$/i.test(part))) {
        return undefined;
    }
    return [...new Set(parts.map(normalizeType))];
}
function parseKiSphereDestination(sourceText) {
    if (/^Rainbow$/i.test(sourceText.trim())) {
        return "rainbow";
    }
    return /^(?:AGL|TEQ|INT|STR|PHY)$/i.test(sourceText.trim())
        ? normalizeType(sourceText.trim())
        : undefined;
}
function parseConcreteKiSphereTypes(sourceText) {
    const types = parseKiSphereTypes(sourceText);
    return types && types.every((type) => type === "rainbow" || TEAM_ANALYSIS_TYPES.includes(type))
        ? types
        : undefined;
}
function parseExcludedKiSphereTypes(sourceText) {
    const text = sourceText.replace(/\s+excluded$/i, "").trim();
    const types = parseKiSphereTypes(text);
    return types && types.every((type) => TEAM_ANALYSIS_TYPES.includes(type))
        ? types
        : undefined;
}
function parseKiSphereScalingHeader(sourceText) {
    const match = /^For every(?:\s+(\d+))?\s*(.*?)\s*Ki Spheres? obtained$/i.exec(sourceText.trim());
    if (!match) {
        return undefined;
    }
    const spheresPerIncrement = Number(match[1] ?? 1);
    const kiSphereTypes = parseKiSphereTypes(match[2]);
    if (!kiSphereTypes || !Number.isInteger(spheresPerIncrement) || spheresPerIncrement < 1) {
        return undefined;
    }
    return {
        kind: "per_ki_sphere",
        kiSphereTypes,
        spheresPerIncrement,
        kiContext: "collected_ki_spheres",
    };
}
function parseCombatEventScalingHeader(sourceText) {
    const match = /^For every(?:\s+(\d+))?\s+(.+)$/i.exec(sourceText.trim());
    if (!match) {
        return undefined;
    }
    const eventsPerIncrement = Number(match[1] ?? 1);
    if (!Number.isInteger(eventsPerIncrement) || eventsPerIncrement < 1) {
        return undefined;
    }
    const body = match[2].trim();
    const connectors = [...body.matchAll(/\s+(and|or)\s+/gi)].map(item => item[1].toLowerCase());
    if (connectors.includes("and") && connectors.includes("or")) {
        return undefined;
    }
    const connector = connectors[0] ?? "single";
    const parts = body.split(/\s+(?:and|or)\s+/i).map(part => part.trim());
    const identities = parts.map((part, index) => {
        const direct = parsePerEventIdentity(part);
        if (direct) {
            return direct;
        }
        if (/^evaded$/i.test(part) && index > 0 && /attack received$/i.test(parts[index - 1])) {
            return combatEventIdentity("attack evaded", "evaded");
        }
        return undefined;
    });
    if (identities.some(identity => !identity)) {
        return undefined;
    }
    return {
        kind: "per_combat_event",
        connector,
        eventsPerIncrement,
        events: identities.map(identity => combatEventDescriptor(identity, "per_event", "after_event", {
            countScope: "battle",
            countScopeSource: "documented_domain_rule",
            relativeTimingSource: "documented_domain_rule",
        })),
    };
}
function parsePerEventIdentity(sourceText) {
    if (/^((?:(?:Ki Blast|Unarmed|Physical)\s+)?(?:Super\s+)?attack) performed$/i.test(sourceText)) {
        return combatEventIdentity(sourceText, "performed");
    }
    if (/^((?:(?:Ki Blast|Unarmed|Physical)\s+)?(?:Super\s+)?attack) received$/i.test(sourceText)) {
        return combatEventIdentity(sourceText, "landed");
    }
    if (/^attack evaded$/i.test(sourceText)) {
        return combatEventIdentity(sourceText, "evaded");
    }
    if (/^final blow delivered$/i.test(sourceText)) {
        return combatEventIdentity(sourceText, "final_blow");
    }
    return undefined;
}
function clonePassiveEffectScaling(scaling) {
    return scaling.kind === "per_ki_sphere"
        ? { ...scaling, kiSphereTypes: [...scaling.kiSphereTypes] }
        : {
            ...scaling,
            events: scaling.events.map(event => ({
                ...event,
                provenance: { ...event.provenance },
            })),
        };
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
        ...(prefix ? [parseBooleanCondition(prefix)] : []),
        slot,
        ...(suffix ? [parseBooleanCondition(suffix)] : []),
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
        if (!/^(?:when|if|not\b|after\b|before\b|as|attacking|with|between|ki\b|\d+\b|there|all|the\s+(?:team|character|enemy|target|attacked|selected|only)|this\s+character|that\s+enemy|an?\s+(?:enemy|["']|(?:Super|Extreme|AGL|TEQ|INT|STR|PHY)\b)|another|no|for\b|starting\b|on the\b|up to the\b|from the\b|HP\b|facing\b|\()/i.test(right)) {
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
    const effects = parsedAtoms.atoms.map(atom => enrichCalculationPhase(applyEffectTarget(context.headerScaling && atom.kind !== "ki_sphere_change" && !atom.scaling
        ? { ...atom, scaling: clonePassiveEffectScaling(context.headerScaling) }
        : atom, resolvedTarget), sourceText, context));
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
    addMatches(/\bChanges Ki Spheres:\s*(All|(?:(?:AGL|TEQ|INT|STR|PHY|Rainbow)(?:\s*(?:,|&|and|or)\s*(?:AGL|TEQ|INT|STR|PHY|Rainbow))*))\s+to\s+(AGL|TEQ|INT|STR|PHY|Rainbow)\b/gi, match => {
        const sourceSelection = /^All$/i.test(match[1]) ? "all" : "listed_types";
        const sourceTypes = sourceSelection === "listed_types" ? parseConcreteKiSphereTypes(match[1]) : undefined;
        const destinationType = parseKiSphereDestination(match[2]);
        if (!destinationType || (sourceSelection === "listed_types" && !sourceTypes)) {
            return [];
        }
        return [{
                kind: "ki_sphere_change",
                kiSphereChange: {
                    sourceSelection,
                    ...(sourceTypes ? { sourceTypes } : {}),
                    destinationType,
                    kiContext: "board_state",
                },
                sourceText: match[0],
            }];
    });
    addMatches(/\bRandomly changes Ki Spheres of a certain Type(?:\s*\(((?:(?:AGL|TEQ|INT|STR|PHY)(?:\s*(?:,|&|and|or)\s*(?:AGL|TEQ|INT|STR|PHY))*)\s+excluded)\))?\s+to\s+(AGL|TEQ|INT|STR|PHY|Rainbow)(?:\s+Ki Spheres?)?\b/gi, match => {
        const destinationType = parseKiSphereDestination(match[2]);
        const excludedSourceTypes = match[1] ? parseExcludedKiSphereTypes(match[1]) : undefined;
        if (!destinationType || (match[1] && !excludedSourceTypes)) {
            return [];
        }
        return [{
                kind: "ki_sphere_change",
                kiSphereChange: {
                    sourceSelection: "random_type",
                    ...(excludedSourceTypes ? { excludedSourceTypes } : {}),
                    destinationType,
                    kiContext: "board_state",
                },
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
    addModifiers(/\(\s*up to\s+\+(\d+(?:\.\d+)?)\s*\)/gi, match => atom => {
        atom.stackCap = Number(match[1]);
    });
    for (const match of body.matchAll(/\bper\s+(?:(\d+)\s+)?(.*?)\s*Ki Spheres? obtained\b/gi)) {
        const start = match.index ?? 0;
        const spheresPerIncrement = Number(match[1] ?? 1);
        const kiSphereTypes = parseKiSphereTypes(match[2]);
        if (!kiSphereTypes || !Number.isInteger(spheresPerIncrement) || spheresPerIncrement < 1) {
            continue;
        }
        candidates.push({
            start,
            end: start + match[0].length,
            apply: atom => {
                atom.scaling = {
                    kind: "per_ki_sphere",
                    kiSphereTypes,
                    spheresPerIncrement,
                    kiContext: "collected_ki_spheres",
                };
            },
        });
    }
    for (const match of body.matchAll(/\b(?:per|with each)\s+((?:(?:Ki Blast|Unarmed|Physical)\s+)?(?:Super\s+)?attack\s+(?:performed|received)|attack\s+evaded|final blow\s+delivered)\b/gi)) {
        const scaling = parseCombatEventScalingHeader(`For every ${match[1]}`);
        if (!scaling || scaling.kind !== "per_combat_event") {
            continue;
        }
        const start = match.index ?? 0;
        candidates.push({
            start,
            end: start + match[0].length,
            apply: atom => {
                atom.scaling = clonePassiveEffectScaling(scaling);
            },
        });
    }
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
        if (/up to/i.test(modifierText(body, modifier))
            && /%/.test(modifierText(body, modifier))
            && preceding.atoms.some(atom => atom.unit !== "percent")) {
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
        .replace(/\(\s*up to\s+\+?\d+(?:\.\d+)?%?\s*\)/gi, "")
        .replace(/\bper\s+(?:\d+\s+)?(?:AGL|TEQ|INT|STR|PHY|Rainbow|non[- ]Rainbow|Type)?\s*Ki Spheres? obtained\b/gi, "")
        .replace(/\b(?:per|with each)\s+(?:(?:Ki Blast|Unarmed|Physical)\s+)?(?:Super\s+)?attack\s+(?:performed|received)\b/gi, "")
        .replace(/\b(?:per|with each)\s+(?:attack\s+evaded|final blow\s+delivered)\b/gi, "");
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
    const target = atom.kind === "ki_sphere_change"
        ? { scope: "self" }
        : { ...resolvedTarget.target };
    const allyTarget = isAllyTarget(target);
    return {
        ...atom,
        target,
        ...(resolvedTarget.categories ? { categories: resolvedTarget.categories } : {}),
        ...(resolvedTarget.classes ? { classes: resolvedTarget.classes } : {}),
        ...(resolvedTarget.types ? { types: resolvedTarget.types } : {}),
        ...(allyTarget && BENEFICIAL_EFFECT_KINDS.has(atom.kind)
            ? { classifications: ["support"] }
            : {}),
    };
}
const CALCULATION_BUCKET_EFFECT_KINDS = new Set(["atk", "def"]);
function enrichCalculationPhase(effect, effectSourceText, context) {
    if (effect.kind === "unknown") {
        return effect;
    }
    const explicitMoment = explicitActivationMoment(effectSourceText)
        ?? explicitActivationMoment(context.phaseContextText ?? "");
    const domainMoment = explicitMoment
        ? undefined
        : domainActivationMoment(context.phaseContextText, effect.scaling ?? context.headerScaling);
    const activationTiming = explicitMoment
        ? { moment: explicitMoment, source: "explicit_text" }
        : domainMoment
            ? { moment: domainMoment, source: "documented_domain_rule" }
            : { moment: "unresolved", source: "unresolved" };
    if (!CALCULATION_BUCKET_EFFECT_KINDS.has(effect.kind)) {
        return { ...effect, activationTiming };
    }
    return {
        ...effect,
        activationTiming,
        calculationBucket: resolveCalculationBucket(effectSourceText, context.phaseContextText, context.headerScaling),
    };
}
function explicitActivationMoment(sourceText) {
    if (/\bwhen performing (?:a|an) (?:Super|Ultra Super) Attack\b/i.test(sourceText)) {
        return "when_performing_super_attack";
    }
    if (/\bafter (?:performing (?:a|an|\d+(?:\s+or\s+more)?) (?:Super |Ultra Super )?Attacks?|attacking)\b/i.test(sourceText)
        || /\bfor every (?:Super )?Attack performed\b/i.test(sourceText)) {
        return "after_attacking";
    }
    if (/\bbefore receiving (?:an?|the) attack\b/i.test(sourceText)) {
        return "before_incoming_attack";
    }
    if (/\bwhen receiving (?:an?|the) (?:(?:Ki Blast|Unarmed|Physical) )?(?:normal |Super )?Attack\b/i.test(sourceText)) {
        return "when_targeted_by_attack";
    }
    if (/\bafter receiving or evading (?:an?|the) attack\b/i.test(sourceText)
        || /\bfor every attack received or evaded\b/i.test(sourceText)) {
        return "after_incoming_attack_resolved";
    }
    if (/\bafter (?:receiving|being hit by) (?:an?|the|\d+(?:\s+or\s+more)?) (?:(?:Ki Blast|Unarmed|Physical) )?(?:normal |Super )?Attacks?\b/i.test(sourceText)
        || /\bfor every attack received(?!\s+or\s+evaded)\b/i.test(sourceText)) {
        return "after_attack_landed";
    }
    if (/\bwhen evading (?:an?|the) attack\b/i.test(sourceText)) {
        return "when_evading";
    }
    if (/\bafter evading (?:an?|the|\d+(?:\s+or\s+more)?) attacks?\b/i.test(sourceText)
        || /\bfor every attack evaded\b/i.test(sourceText)) {
        return "after_evading";
    }
    if (/\bafter (?:delivering (?:a|the)?\s*final blow|a final blow is delivered)\b/i.test(sourceText)
        || /\bfor every final blow delivered\b/i.test(sourceText)) {
        return "after_final_blow";
    }
    if (/\bbefore attacking\b/i.test(sourceText)) {
        return "before_attacking";
    }
    if (/\bwhen attacking\b/i.test(sourceText)) {
        return "when_attacking";
    }
    if (/\bat (?:the )?start of (?:each |the )?(?:attacking )?turn\b/i.test(sourceText)) {
        return "start_of_turn";
    }
    return undefined;
}
function activationMomentFromCombatEvent(event) {
    if (event.eventType === "final_blow_delivered") {
        return event.relativeTiming === "after_event" ? "after_final_blow" : "unresolved";
    }
    if (event.eventType === "attack_evaded") {
        return event.relativeTiming === "after_event" ? "after_evading"
            : event.relativeTiming === "during_event" ? "when_evading"
                : "unresolved";
    }
    if (event.eventType === "incoming_attack") {
        return event.relativeTiming === "before_event" ? "before_incoming_attack"
            : event.relativeTiming === "during_event" ? "when_targeted_by_attack"
                : "unresolved";
    }
    if (event.eventType === "attack_landed") {
        return event.relativeTiming === "during_event" ? "when_attack_landed"
            : event.relativeTiming === "after_event" ? "after_attack_landed"
                : "unresolved";
    }
    if (event.attackKind === "super_attack" && event.relativeTiming === "during_event") {
        return "when_performing_super_attack";
    }
    return event.relativeTiming === "before_event" ? "before_attacking"
        : event.relativeTiming === "during_event" ? "when_attacking"
            : event.relativeTiming === "after_event" ? "after_attacking"
                : "unresolved";
}
function domainActivationMoment(phaseContextText, headerScaling) {
    if (/^Basic effect\(s\)$/i.test(phaseContextText?.trim() ?? "")) {
        return "start_of_turn";
    }
    if (headerScaling?.kind === "per_ki_sphere" && /^For every\b/i.test(phaseContextText?.trim() ?? "")) {
        return "start_of_turn";
    }
    if (headerScaling?.kind === "per_combat_event") {
        const events = headerScaling.events;
        if (events.length > 1
            && events.every(event => event.relativeTiming === "after_event")
            && events.some(event => event.eventType === "attack_landed")
            && events.some(event => event.eventType === "attack_evaded")) {
            return "after_incoming_attack_resolved";
        }
        const moments = [...new Set(events.map(activationMomentFromCombatEvent))];
        return moments.length === 1 && moments[0] !== "unresolved" ? moments[0] : undefined;
    }
    return undefined;
}
function resolveCalculationBucket(effectSourceText, phaseContextText, headerScaling) {
    const inlineMoment = explicitActivationMoment(effectSourceText);
    if (/\b(?:when|after) performing (?:a|an) (?:Super|Ultra Super) Attack\b/i.test(effectSourceText)) {
        return { bucket: "passive_on_attack", source: "documented_domain_rule" };
    }
    if (/\bat (?:the )?start of (?:each |the )?(?:attacking )?turn\b/i.test(effectSourceText)) {
        return { bucket: "passive_start_of_turn", source: "documented_domain_rule" };
    }
    if (inlineMoment) {
        return { bucket: "unresolved", source: "unresolved" };
    }
    if (/\b(?:when|after) performing (?:a|an) (?:Super|Ultra Super) Attack\b/i.test(phaseContextText ?? "")) {
        return { bucket: "passive_on_attack", source: "documented_domain_rule" };
    }
    if (/\bat (?:the )?start of (?:each |the )?(?:attacking )?turn\b/i.test(phaseContextText ?? "")) {
        return { bucket: "passive_start_of_turn", source: "documented_domain_rule" };
    }
    if (/^Basic effect\(s\)$/i.test(phaseContextText?.trim() ?? "")) {
        return { bucket: "passive_start_of_turn", source: "documented_domain_rule" };
    }
    if (headerScaling?.kind === "per_ki_sphere" && /^For every\b/i.test(phaseContextText?.trim() ?? "")) {
        return { bucket: "passive_start_of_turn", source: "documented_domain_rule" };
    }
    return { bucket: "unresolved", source: "unresolved" };
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
    const enemySelectionCounts = {};
    const kiPredicateContextCounts = {};
    const kiSphereTypePredicateCounts = {};
    const scaledEffectSphereTypeCounts = {};
    const combatPredicateKindCounts = {};
    const combatEventTypeCounts = {};
    const combatAttackKindCounts = {};
    const combatAttackStyleCounts = {};
    const combatModeCounts = {};
    const combatCountScopeCounts = {};
    const combatRelativeTimingCounts = {};
    const conversionSourceSelectionCounts = {};
    const conversionDestinationTypeCounts = {};
    const activationMomentCounts = {
        start_of_turn: 0,
        before_attacking: 0,
        when_attacking: 0,
        when_performing_super_attack: 0,
        before_incoming_attack: 0,
        when_targeted_by_attack: 0,
        when_attack_landed: 0,
        after_incoming_attack_resolved: 0,
        after_attacking: 0,
        after_attack_landed: 0,
        when_evading: 0,
        after_evading: 0,
        after_final_blow: 0,
        unresolved: 0,
    };
    const activationSourceCounts = {
        explicit_text: 0,
        first_party_game_db: 0,
        documented_domain_rule: 0,
        unresolved: 0,
    };
    const bucketCounts = {
        passive_start_of_turn: 0,
        passive_on_attack: 0,
        unresolved: 0,
    };
    const bucketSourceCounts = {
        explicit_text: 0,
        first_party_game_db: 0,
        documented_domain_rule: 0,
        unresolved: 0,
    };
    const enemyStatusEvidenceResolutionCounts = { supported: 0, partial: 0, unresolved: 0 };
    const enemyStatusEvidenceStatusCounts = {};
    const enemyStatusEvidenceSourceCounts = {};
    let enemyStatusEvidenceStateCount = 0;
    let fullyRecoveredEnemyStatusStateCount = 0;
    let partialEnemyStatusStateCount = 0;
    let unresolvedEnemyStatusStateCount = 0;
    let enemyStatusEvidenceCount = 0;
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
    let scaledEffectCount = 0;
    let activationEligibleEffectCount = 0;
    let bucketEligibleEffectCount = 0;
    let combatPredicateCount = 0;
    let combatScaledEffectCount = 0;
    let currentEventRuleCount = 0;
    let historyRuleCount = 0;
    for (const state of dataset.states) {
        if (!state.passive) {
            continue;
        }
        passiveStateCount += 1;
        passiveStatusCounts[state.passive.parseStatus] += 1;
        unknownFragmentCount += state.passive.unparsedFragments.length;
        const statusEvidence = state.passive.conditionEvidence ?? [];
        if (statusEvidence.length > 0) {
            enemyStatusEvidenceStateCount += 1;
            enemyStatusEvidenceCount += statusEvidence.length;
            statusEvidence.forEach(evidence => {
                enemyStatusEvidenceResolutionCounts[evidence.resolution] += 1;
                enemyStatusEvidenceSourceCounts[evidence.provenance.source] =
                    (enemyStatusEvidenceSourceCounts[evidence.provenance.source] ?? 0) + 1;
                evidence.statuses.forEach(status => {
                    if (status.status) {
                        enemyStatusEvidenceStatusCounts[status.status] =
                            (enemyStatusEvidenceStatusCounts[status.status] ?? 0) + 1;
                    }
                });
            });
            if (statusEvidence.every(evidence => evidence.resolution === "supported")) {
                fullyRecoveredEnemyStatusStateCount += 1;
            }
            else if (statusEvidence.every(evidence => evidence.resolution === "unresolved")) {
                unresolvedEnemyStatusStateCount += 1;
            }
            else {
                partialEnemyStatusStateCount += 1;
            }
        }
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
            collectEnemySelections(rule.condition, enemySelectionCounts);
            collectKiPredicateMetrics(rule.condition, kiPredicateContextCounts, kiSphereTypePredicateCounts);
            const combatPredicates = collectCombatPredicates(rule.condition);
            let ruleHasCurrentCombatEvent = false;
            let ruleHasCombatHistory = false;
            for (const predicate of combatPredicates) {
                combatPredicateCount += 1;
                combatPredicateKindCounts[predicate.kind] = (combatPredicateKindCounts[predicate.kind] ?? 0) + 1;
                if (predicate.combatEvent) {
                    collectCombatEventMetrics(predicate.combatEvent, combatEventTypeCounts, combatAttackKindCounts, combatAttackStyleCounts, combatModeCounts, combatCountScopeCounts, combatRelativeTimingCounts);
                    ruleHasCurrentCombatEvent ||= predicate.combatEvent.mode === "current_event";
                    ruleHasCombatHistory ||= predicate.combatEvent.mode === "accumulated_count";
                }
            }
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
                if (effect.scaling?.kind === "per_ki_sphere") {
                    scaledEffectCount += 1;
                    for (const type of effect.scaling.kiSphereTypes) {
                        scaledEffectSphereTypeCounts[type] = (scaledEffectSphereTypeCounts[type] ?? 0) + 1;
                    }
                }
                if (effect.scaling?.kind === "per_combat_event") {
                    combatScaledEffectCount += 1;
                    ruleHasCombatHistory = true;
                    effect.scaling.events.forEach(event => collectCombatEventMetrics(event, combatEventTypeCounts, combatAttackKindCounts, combatAttackStyleCounts, combatModeCounts, combatCountScopeCounts, combatRelativeTimingCounts));
                }
                if (effect.kiSphereChange) {
                    const selection = effect.kiSphereChange.sourceSelection;
                    const destination = effect.kiSphereChange.destinationType;
                    conversionSourceSelectionCounts[selection] = (conversionSourceSelectionCounts[selection] ?? 0) + 1;
                    conversionDestinationTypeCounts[destination] = (conversionDestinationTypeCounts[destination] ?? 0) + 1;
                }
                if (effect.kind !== "unknown") {
                    activationEligibleEffectCount += 1;
                    activationMomentCounts[effect.activationTiming?.moment ?? "unresolved"] += 1;
                    activationSourceCounts[effect.activationTiming?.source ?? "unresolved"] += 1;
                }
                if (CALCULATION_BUCKET_EFFECT_KINDS.has(effect.kind)) {
                    bucketEligibleEffectCount += 1;
                    bucketCounts[effect.calculationBucket?.bucket ?? "unresolved"] += 1;
                    bucketSourceCounts[effect.calculationBucket?.source ?? "unresolved"] += 1;
                }
            }
            if (ruleHasCurrentCombatEvent) {
                currentEventRuleCount += 1;
            }
            if (ruleHasCombatHistory) {
                historyRuleCount += 1;
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
        enemySelectionCounts: sortedRecord(enemySelectionCounts),
        enemyStatusEvidence: {
            stateCount: enemyStatusEvidenceStateCount,
            evidenceCount: enemyStatusEvidenceCount,
            fullyRecoveredStateCount: fullyRecoveredEnemyStatusStateCount,
            partialStateCount: partialEnemyStatusStateCount,
            unresolvedStateCount: unresolvedEnemyStatusStateCount,
            resolutionCounts: enemyStatusEvidenceResolutionCounts,
            statusCounts: sortedRecord(enemyStatusEvidenceStatusCounts),
            sourceCounts: sortedRecord(enemyStatusEvidenceSourceCounts),
        },
        kiAnalysis: {
            predicateContextCounts: sortedRecord(kiPredicateContextCounts),
            sphereTypePredicateCounts: sortedRecord(kiSphereTypePredicateCounts),
            scaledEffectCount,
            scaledEffectSphereTypeCounts: sortedRecord(scaledEffectSphereTypeCounts),
            conversionSourceSelectionCounts: sortedRecord(conversionSourceSelectionCounts),
            conversionDestinationTypeCounts: sortedRecord(conversionDestinationTypeCounts),
        },
        calculationPhase: {
            activationEligibleEffectCount,
            activationMomentCounts,
            activationSourceCounts,
            bucketEligibleEffectCount,
            bucketCounts,
            bucketSourceCounts,
        },
        combatEvents: {
            predicateCount: combatPredicateCount,
            scaledEffectCount: combatScaledEffectCount,
            currentEventRuleCount,
            historyRuleCount,
            predicateKindCounts: sortedRecord(combatPredicateKindCounts),
            eventTypeCounts: sortedRecord(combatEventTypeCounts),
            attackKindCounts: sortedRecord(combatAttackKindCounts),
            attackStyleCounts: sortedRecord(combatAttackStyleCounts),
            modeCounts: sortedRecord(combatModeCounts),
            countScopeCounts: sortedRecord(combatCountScopeCounts),
            relativeTimingCounts: sortedRecord(combatRelativeTimingCounts),
        },
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
    "enemy_name", "enemy_class", "enemy_type", "enemy_class_type", "enemy_hp_percent",
    "enemy_status", "domain_active",
    "standby_active", "active_skill_used", "revive_triggered",
]);
const RUNTIME_PREDICATES = new Set([
    "ki_amount", "ki_spheres_obtained", "ki_sphere_type_obtained", "incoming_attack",
    "incoming_super_attack", "attacks_performed",
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
function collectEnemySelections(condition, counts) {
    if (condition.op === "predicate") {
        if (condition.predicate.enemySelection) {
            counts[condition.predicate.enemySelection] = (counts[condition.predicate.enemySelection] ?? 0) + 1;
        }
        return;
    }
    if (condition.op === "not") {
        collectEnemySelections(condition.child, counts);
        return;
    }
    if (condition.op === "all" || condition.op === "any") {
        condition.children.forEach(child => collectEnemySelections(child, counts));
    }
}
function collectKiPredicateMetrics(condition, contextCounts, sphereTypeCounts) {
    if (condition.op === "predicate") {
        if (condition.predicate.kiContext) {
            contextCounts[condition.predicate.kiContext] = (contextCounts[condition.predicate.kiContext] ?? 0) + 1;
        }
        for (const type of condition.predicate.kiSphereTypes ?? []) {
            sphereTypeCounts[type] = (sphereTypeCounts[type] ?? 0) + 1;
        }
        return;
    }
    if (condition.op === "not") {
        collectKiPredicateMetrics(condition.child, contextCounts, sphereTypeCounts);
        return;
    }
    if (condition.op === "all" || condition.op === "any") {
        condition.children.forEach(child => collectKiPredicateMetrics(child, contextCounts, sphereTypeCounts));
    }
}
function collectCombatPredicates(condition) {
    if (condition.op === "predicate") {
        return condition.predicate.combatEvent ? [condition.predicate] : [];
    }
    if (condition.op === "not") {
        return collectCombatPredicates(condition.child);
    }
    if (condition.op === "all" || condition.op === "any") {
        return condition.children.flatMap(collectCombatPredicates);
    }
    return [];
}
function collectCombatEventMetrics(event, eventTypeCounts, attackKindCounts, attackStyleCounts, modeCounts, countScopeCounts, relativeTimingCounts) {
    eventTypeCounts[event.eventType] = (eventTypeCounts[event.eventType] ?? 0) + 1;
    attackKindCounts[event.attackKind] = (attackKindCounts[event.attackKind] ?? 0) + 1;
    if (event.attackStyle) {
        attackStyleCounts[event.attackStyle] = (attackStyleCounts[event.attackStyle] ?? 0) + 1;
    }
    modeCounts[event.mode] = (modeCounts[event.mode] ?? 0) + 1;
    if (event.countScope) {
        countScopeCounts[event.countScope] = (countScopeCounts[event.countScope] ?? 0) + 1;
    }
    relativeTimingCounts[event.relativeTiming] = (relativeTimingCounts[event.relativeTiming] ?? 0) + 1;
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
        const summary = issues.slice(0, 10).map(issue => {
            const location = [issue.stateKey, issue.ruleId].filter(Boolean).join(" / ");
            return `${issue.code}${location ? ` (${location})` : ""}: ${issue.message}`;
        }).join("\n");
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
            const sourceEvidence = expected.passiveDetails.conditionEvidence ?? [];
            const validEvidence = validConditionEvidence(state.stateKey, expected.passiveText, sourceMap.sourceFragments, sourceEvidence, {
                characterId: state.characterId,
                formId: state.formId,
                releaseState: state.releaseState,
            });
            if (validEvidence.length !== sourceEvidence.length) {
                issues.push({
                    code: "condition-evidence-source",
                    message: `${sourceEvidence.length - validEvidence.length} condition evidence record(s) failed source validation.`,
                    stateKey: state.stateKey,
                });
            }
            if (JSON.stringify(state.passive?.conditionEvidence ?? []) !== JSON.stringify(validEvidence)) {
                issues.push({
                    code: "condition-evidence-output",
                    message: `Serialized condition evidence does not match the validated PassiveDetails evidence.`,
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
        if (condition.predicate.kind === "unknown") {
            return "unknown";
        }
        return condition.predicate.enemySelection === "unknown"
            || condition.predicate.combatEvent?.countScope === "unknown"
            || condition.predicate.combatEvent?.relativeTiming === "unknown"
            ? "partial"
            : "supported";
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
const ENEMY_PREDICATE_KINDS = new Set([
    "enemy_category", "enemy_name", "enemy_class", "enemy_type", "enemy_class_type",
    "enemy_hp_percent", "enemy_status",
]);
const ALLY_TARGET_SCOPES = new Set([
    "rotation_allies", "team_allies", "category_allies", "class_allies", "type_allies",
    "class_type_allies",
]);
function isAllyTarget(target) {
    return ALLY_TARGET_SCOPES.has(target.scope);
}
function validateEffectContract(effect, state, rule, issues) {
    validateCalculationPhase(effect, state, rule, issues);
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
    if (effect.scaling) {
        if (effect.scaling.kind === "per_ki_sphere") {
            if (effect.scaling.kiContext !== "collected_ki_spheres") {
                issues.push({ code: "effect-scaling-context", message: `Ki Sphere scaling must use collected_ki_spheres context.`, stateKey: state.stateKey, ruleId: rule.id });
            }
            if (!Number.isInteger(effect.scaling.spheresPerIncrement) || effect.scaling.spheresPerIncrement < 1) {
                issues.push({ code: "effect-scaling-unit", message: `Ki Sphere scaling units must be positive integers.`, stateKey: state.stateKey, ruleId: rule.id });
            }
            validateKiSphereTypes(effect.scaling.kiSphereTypes, "effect-scaling-sphere-types", state, rule, issues);
        }
        else if (effect.scaling.kind === "per_combat_event") {
            if (!["single", "and", "or"].includes(effect.scaling.connector)) {
                issues.push({ code: "combat-scaling-connector", message: `Combat-event scaling connector is not recognized.`, stateKey: state.stateKey, ruleId: rule.id });
            }
            if (!Number.isInteger(effect.scaling.eventsPerIncrement) || effect.scaling.eventsPerIncrement < 1) {
                issues.push({ code: "combat-scaling-unit", message: `Combat-event scaling units must be positive integers.`, stateKey: state.stateKey, ruleId: rule.id });
            }
            if (effect.scaling.events.length === 0) {
                issues.push({ code: "combat-scaling-events", message: `Combat-event scaling requires at least one event.`, stateKey: state.stateKey, ruleId: rule.id });
            }
            if ((effect.scaling.connector === "single") !== (effect.scaling.events.length === 1)) {
                issues.push({ code: "combat-scaling-arity", message: `Single scaling requires one event; logical scaling requires multiple events.`, stateKey: state.stateKey, ruleId: rule.id });
            }
            effect.scaling.events.forEach(event => validateCombatEventDescriptor(event, state, rule, issues, true));
        }
        else {
            issues.push({ code: "effect-scaling-kind", message: `Effect scaling kind is not recognized.`, stateKey: state.stateKey, ruleId: rule.id });
            const external = effect.scaling;
            if (external.kiContext !== "collected_ki_spheres") {
                issues.push({ code: "effect-scaling-context", message: `Ki Sphere scaling must use collected_ki_spheres context.`, stateKey: state.stateKey, ruleId: rule.id });
            }
            if (!Number.isInteger(external.spheresPerIncrement) || (external.spheresPerIncrement ?? 0) < 1) {
                issues.push({ code: "effect-scaling-unit", message: `Ki Sphere scaling units must be positive integers.`, stateKey: state.stateKey, ruleId: rule.id });
            }
            validateKiSphereTypes(external.kiSphereTypes, "effect-scaling-sphere-types", state, rule, issues);
        }
        if (effect.kind === "unknown" || effect.kind === "ki_sphere_change") {
            issues.push({ code: "effect-scaling-effect-kind", message: `Effect scaling requires a scalable typed effect.`, stateKey: state.stateKey, ruleId: rule.id });
        }
    }
    if (effect.kind === "ki_sphere_change" && !effect.kiSphereChange) {
        issues.push({ code: "ki-sphere-change-fields", message: `Ki Sphere change effects require structured conversion fields.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (effect.kind !== "ki_sphere_change" && effect.kiSphereChange) {
        issues.push({ code: "ki-sphere-change-kind", message: `Ki Sphere conversion fields are valid only on ki_sphere_change effects.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (effect.kiSphereChange) {
        validateKiSphereChange(effect.kiSphereChange, effect, state, rule, issues);
    }
}
function validateCalculationPhase(effect, state, rule, issues) {
    const activationMoments = [
        "start_of_turn", "before_attacking", "when_attacking",
        "when_performing_super_attack", "before_incoming_attack", "when_targeted_by_attack",
        "when_attack_landed", "after_incoming_attack_resolved", "after_attacking",
        "after_attack_landed", "when_evading", "after_evading",
        "after_final_blow", "unresolved",
    ];
    const buckets = [
        "passive_start_of_turn", "passive_on_attack", "unresolved",
    ];
    const sources = [
        "explicit_text", "first_party_game_db", "documented_domain_rule", "unresolved",
    ];
    if (effect.kind === "unknown") {
        if (effect.activationTiming || effect.calculationBucket) {
            issues.push({ code: "unknown-effect-calculation-phase", message: `Unknown effects cannot carry calculation-phase claims.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        return;
    }
    if (!effect.activationTiming) {
        issues.push({ code: "activation-timing-required", message: `Typed effects must preserve a resolved or unresolved activation timing.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    else {
        if (!activationMoments.includes(effect.activationTiming.moment)) {
            issues.push({ code: "activation-moment", message: `Activation moment is not recognized.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        if (!sources.includes(effect.activationTiming.source)) {
            issues.push({ code: "activation-source", message: `Activation timing source is not recognized.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        if ((effect.activationTiming.moment === "unresolved") !== (effect.activationTiming.source === "unresolved")) {
            issues.push({ code: "activation-resolution", message: `Unresolved activation moment and source must be paired.`, stateKey: state.stateKey, ruleId: rule.id });
        }
    }
    const bucketEligible = CALCULATION_BUCKET_EFFECT_KINDS.has(effect.kind);
    if (bucketEligible && !effect.calculationBucket) {
        issues.push({ code: "calculation-bucket-required", message: `ATK and DEF effects must preserve a resolved or unresolved passive calculation bucket.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (!bucketEligible && effect.calculationBucket) {
        issues.push({ code: "calculation-bucket-effect-kind", message: `Passive calculation buckets currently apply only to typed ATK and DEF effects.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (effect.calculationBucket) {
        if (!buckets.includes(effect.calculationBucket.bucket)) {
            issues.push({ code: "calculation-bucket", message: `Passive calculation bucket is not recognized.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        if (!sources.includes(effect.calculationBucket.source)) {
            issues.push({ code: "calculation-bucket-source", message: `Calculation bucket source is not recognized.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        if ((effect.calculationBucket.bucket === "unresolved") !== (effect.calculationBucket.source === "unresolved")) {
            issues.push({ code: "calculation-bucket-resolution", message: `Unresolved calculation bucket and source must be paired.`, stateKey: state.stateKey, ruleId: rule.id });
        }
    }
}
function validateKiSphereChange(change, effect, state, rule, issues) {
    const selections = ["listed_types", "all", "random_type"];
    if (!selections.includes(change.sourceSelection)) {
        issues.push({ code: "ki-sphere-change-source-selection", message: `Ki Sphere conversion source selection is not recognized.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (change.kiContext !== "board_state") {
        issues.push({ code: "ki-sphere-change-context", message: `Ki Sphere conversion must use board_state context.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (![...TEAM_ANALYSIS_TYPES, "rainbow"].includes(change.destinationType)) {
        issues.push({ code: "ki-sphere-change-destination", message: `Ki Sphere conversion destination must be a concrete color or rainbow.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (change.sourceSelection === "listed_types") {
        validateKiSphereTypes(change.sourceTypes, "ki-sphere-change-source-types", state, rule, issues);
        if ((change.sourceTypes ?? [])
            .some(type => type === "any" || type === "non_rainbow")) {
            issues.push({ code: "ki-sphere-change-concrete-source", message: `Listed conversion sources must be concrete colors or rainbow.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        if (change.excludedSourceTypes !== undefined) {
            issues.push({ code: "ki-sphere-change-listed-exclusions", message: `Listed conversion sources cannot also declare exclusions.`, stateKey: state.stateKey, ruleId: rule.id });
        }
    }
    else if (change.sourceTypes !== undefined) {
        issues.push({ code: "ki-sphere-change-source-kind", message: `Only listed conversion sources may declare sourceTypes.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (change.sourceSelection !== "random_type" && change.excludedSourceTypes !== undefined) {
        issues.push({ code: "ki-sphere-change-exclusion-kind", message: `Only random Type conversion may declare exclusions.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if ((change.excludedSourceTypes ?? []).some(type => !TEAM_ANALYSIS_TYPES.includes(type))) {
        issues.push({ code: "ki-sphere-change-exclusions", message: `Conversion exclusions must be concrete Type colors.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (effect.target.scope !== "self") {
        issues.push({ code: "ki-sphere-change-target", message: `Ki Sphere board conversion must use the self effect channel.`, stateKey: state.stateKey, ruleId: rule.id });
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
    if (depth === 1) {
        validateEnemyReferenceBindings(condition, state, rule, issues);
    }
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
        if (["ally_category_present", "ally_category_class_present", "all_rotation_allies_category", "rotation_partner_category", "enemy_category"].includes(condition.predicate.kind)
            && (condition.predicate.categories?.length ?? 0) === 0) {
            issues.push({ code: "condition-categories", message: `Category condition must name at least one category.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        if (["ally_name_present", "rotation_partner_name", "enemy_name"].includes(condition.predicate.kind)
            && (condition.predicate.names?.length ?? 0) === 0) {
            issues.push({ code: "condition-names", message: `Name condition must name at least one character.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        if (["ally_class_present", "ally_class_type_present", "ally_category_class_present", "all_rotation_allies_class", "character_class", "enemy_class", "enemy_class_type"].includes(condition.predicate.kind)
            && (condition.predicate.classes?.length ?? 0) === 0) {
            issues.push({ code: "condition-classes", message: `Class condition must name at least one class.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        if (["ally_type_present", "ally_class_type_present", "character_type", "enemy_type", "enemy_class_type"].includes(condition.predicate.kind)
            && (condition.predicate.types?.length ?? 0) === 0) {
            issues.push({ code: "condition-types", message: `Type condition must name at least one type.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        validateEnemyPredicate(condition.predicate, state, rule, issues);
        validateKiPredicate(condition.predicate, state, rule, issues);
        validateCombatEventPredicate(condition.predicate, state, rule, issues);
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
function validateEnemyPredicate(predicate, state, rule, issues) {
    const enemySelections = [
        "any_enemy", "all_enemies", "current_target", "only_enemy", "unknown",
    ];
    const enemyStatuses = ["atk_down", "def_down", "stunned", "super_attack_sealed"];
    const nameMatches = ["exact", "includes"];
    const isEnemyPredicate = ENEMY_PREDICATE_KINDS.has(predicate.kind);
    if (isEnemyPredicate && predicate.scope !== "enemy") {
        issues.push({ code: "enemy-scope", message: `Enemy attribute predicates must use enemy scope.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (isEnemyPredicate && predicate.enemySelection === undefined) {
        issues.push({ code: "enemy-selection", message: `Enemy attribute predicates must declare enemy selection.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (predicate.enemySelection !== undefined && !enemySelections.includes(predicate.enemySelection)) {
        issues.push({ code: "enemy-selection-value", message: `Enemy selection is not recognized.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (!isEnemyPredicate && predicate.enemySelection !== undefined) {
        issues.push({ code: "enemy-selection-kind", message: `Enemy selection is valid only on enemy attribute predicates.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (predicate.enemyReference !== undefined && predicate.enemyReference !== "that_enemy") {
        issues.push({ code: "enemy-reference-value", message: `Enemy reference is not recognized.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (predicate.enemyReference !== undefined && !isEnemyPredicate) {
        issues.push({ code: "enemy-reference-kind", message: `Enemy references are valid only on enemy attribute predicates.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (predicate.enemyReference === "that_enemy"
        && predicate.enemySelection !== "unknown"
        && predicate.enemySelection !== "only_enemy") {
        issues.push({ code: "enemy-reference-selection", message: `That-enemy references must be unresolved or bound to the only enemy.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (predicate.kind === "enemy_status"
        && ((predicate.enemyStatuses?.length ?? 0) === 0
            || (predicate.enemyStatuses ?? []).some(status => !enemyStatuses.includes(status)))) {
        issues.push({ code: "enemy-status-value", message: `Enemy status must use a recognized non-empty value.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (predicate.kind === "enemy_name") {
        if (predicate.nameMatch === undefined || !nameMatches.includes(predicate.nameMatch)) {
            issues.push({ code: "enemy-name-match", message: `Enemy name predicates require a recognized match mode.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        if ((predicate.excludedNames?.length ?? 0) > 0
            && (predicate.excludedNameMatch === undefined || !nameMatches.includes(predicate.excludedNameMatch))) {
            issues.push({ code: "enemy-excluded-name-match", message: `Excluded enemy names require a recognized match mode.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        if (predicate.excludedNameMatch !== undefined && (predicate.excludedNames?.length ?? 0) === 0) {
            issues.push({ code: "enemy-excluded-names", message: `Excluded enemy name match mode requires excluded names.`, stateKey: state.stateKey, ruleId: rule.id });
        }
    }
}
function validateKiPredicate(predicate, state, rule, issues) {
    const kiKinds = ["ki_amount", "ki_spheres_obtained", "ki_sphere_type_obtained"];
    const isKiPredicate = kiKinds.includes(predicate.kind);
    const comparatorAllowed = ["lt", "lte", "eq", "gte", "gt"].includes(predicate.comparator ?? "");
    if (isKiPredicate && predicate.scope !== "self") {
        issues.push({ code: "ki-scope", message: `Ki runtime predicates must describe the current character.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (isKiPredicate && !comparatorAllowed) {
        issues.push({ code: "ki-comparator", message: `Ki runtime predicates require an explicit scalar comparator.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (isKiPredicate && predicate.value === undefined) {
        issues.push({ code: "ki-value", message: `Ki runtime predicates require a scalar value.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (predicate.kind === "ki_amount") {
        if (predicate.value !== undefined && !isKiAmount(predicate.value)) {
            issues.push({ code: "ki-amount-range", message: `Attack Ki must be an integer within 0..24.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        if (predicate.kiContext !== "final_attack_ki") {
            issues.push({ code: "ki-amount-context", message: `Attack Ki must use final_attack_ki context.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        if (predicate.evaluationMoment !== "when_attacking" && predicate.evaluationMoment !== "before_attack") {
            issues.push({ code: "ki-amount-moment", message: `Attack Ki requires an explicit attack evaluation moment.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        if (predicate.kiSphereTypes !== undefined) {
            issues.push({ code: "ki-amount-sphere-types", message: `Attack Ki cannot declare Ki Sphere types.`, stateKey: state.stateKey, ruleId: rule.id });
        }
    }
    if (predicate.kind === "ki_spheres_obtained" || predicate.kind === "ki_sphere_type_obtained") {
        if (predicate.value !== undefined && !isKiSphereCount(predicate.value)) {
            issues.push({ code: "ki-sphere-count-range", message: `Ki Sphere counts must be non-negative integers.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        if (predicate.kiContext !== "collected_ki_spheres") {
            issues.push({ code: "ki-sphere-context", message: `Obtained Ki Sphere predicates must use collected_ki_spheres context.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        validateKiSphereTypes(predicate.kiSphereTypes, "ki-sphere-types", state, rule, issues);
        if (predicate.kind === "ki_sphere_type_obtained"
            && (predicate.comparator !== "gte" || predicate.value !== 1)) {
            issues.push({ code: "ki-sphere-presence", message: `Ki Sphere type presence must mean at least one obtained sphere.`, stateKey: state.stateKey, ruleId: rule.id });
        }
    }
    if (!isKiPredicate && (predicate.kiContext !== undefined || predicate.kiSphereTypes !== undefined)) {
        issues.push({ code: "ki-fields-kind", message: `Ki context and Ki Sphere types are valid only on Ki predicates.`, stateKey: state.stateKey, ruleId: rule.id });
    }
}
const COMBAT_EVENT_PREDICATE_KINDS = new Set([
    "incoming_attack", "incoming_super_attack", "attacks_performed", "attacks_received",
    "attacks_evaded", "super_attacks_performed", "super_attack_received", "final_blow_delivered",
]);
function validateCombatEventPredicate(predicate, state, rule, issues) {
    const isCombatPredicate = COMBAT_EVENT_PREDICATE_KINDS.has(predicate.kind);
    if (isCombatPredicate && !predicate.combatEvent) {
        issues.push({ code: "combat-event-required", message: `Combat-event predicates require a structured event descriptor.`, stateKey: state.stateKey, ruleId: rule.id });
        return;
    }
    if (!isCombatPredicate && predicate.combatEvent) {
        issues.push({ code: "combat-event-kind", message: `Combat-event descriptors are valid only on combat-event predicates.`, stateKey: state.stateKey, ruleId: rule.id });
        return;
    }
    if (!predicate.combatEvent) {
        return;
    }
    if (predicate.scope !== "self") {
        issues.push({ code: "combat-event-scope", message: `Combat-event predicates describe the current character and must use self scope.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    validateCombatEventDescriptor(predicate.combatEvent, state, rule, issues, false);
    const expectedKind = {
        attack_performed: predicate.combatEvent.attackKind === "super_attack" ? ["super_attacks_performed"] : ["attacks_performed"],
        incoming_attack: predicate.combatEvent.attackKind === "super_attack" ? ["incoming_super_attack"] : ["incoming_attack"],
        attack_landed: predicate.combatEvent.attackKind === "super_attack" ? ["super_attack_received"] : ["attacks_received"],
        attack_evaded: ["attacks_evaded"],
        final_blow_delivered: ["final_blow_delivered"],
    };
    if (!(expectedKind[predicate.combatEvent.eventType] ?? []).includes(predicate.kind)) {
        issues.push({ code: "combat-event-predicate-kind", message: `Combat-event descriptor does not match its predicate kind.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (predicate.combatEvent.mode === "accumulated_count") {
        if (!["lt", "lte", "eq", "gte", "gt"].includes(predicate.comparator)) {
            issues.push({ code: "combat-event-comparator", message: `Accumulated combat-event conditions require an explicit scalar comparator.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        if (predicate.value === undefined || !Number.isInteger(predicate.value) || predicate.value < 0) {
            issues.push({ code: "combat-event-count", message: `Accumulated combat-event conditions require a non-negative integer count.`, stateKey: state.stateKey, ruleId: rule.id });
        }
    }
    else if (predicate.comparator !== undefined || predicate.value !== undefined) {
        issues.push({ code: "combat-current-event-count", message: `Current combat events cannot carry an accumulated comparator or count.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (predicate.combatEvent.mode === "per_event") {
        issues.push({ code: "combat-predicate-per-event", message: `Per-event repetition belongs to effect scaling, not a condition predicate.`, stateKey: state.stateKey, ruleId: rule.id });
    }
}
function validateCombatEventDescriptor(event, state, rule, issues, scaling) {
    const eventTypes = ["attack_performed", "incoming_attack", "attack_landed", "attack_evaded", "final_blow_delivered"];
    const actors = ["self", "enemy"];
    const attackKinds = ["normal_attack", "super_attack", "unknown"];
    const attackStyles = ["ki_blast", "unarmed", "physical", "unknown"];
    const modes = ["current_event", "accumulated_count", "per_event"];
    const countScopes = ["current_turn", "battle", "unknown"];
    const relativeTimings = ["before_event", "during_event", "after_event", "unknown"];
    const sources = ["explicit_text", "first_party_game_db", "documented_domain_rule", "unresolved"];
    if (!eventTypes.includes(event.eventType))
        issues.push({ code: "combat-event-type", message: `Combat event type is not recognized.`, stateKey: state.stateKey, ruleId: rule.id });
    if (!actors.includes(event.actor))
        issues.push({ code: "combat-event-actor", message: `Combat event actor is not recognized.`, stateKey: state.stateKey, ruleId: rule.id });
    if (!attackKinds.includes(event.attackKind))
        issues.push({ code: "combat-attack-kind", message: `Combat attack kind is not recognized.`, stateKey: state.stateKey, ruleId: rule.id });
    if (event.attackStyle !== undefined && !attackStyles.includes(event.attackStyle))
        issues.push({ code: "combat-attack-style", message: `Combat attack style is not recognized.`, stateKey: state.stateKey, ruleId: rule.id });
    if (!modes.includes(event.mode))
        issues.push({ code: "combat-event-mode", message: `Combat event mode is not recognized.`, stateKey: state.stateKey, ruleId: rule.id });
    if (event.countScope !== undefined && !countScopes.includes(event.countScope))
        issues.push({ code: "combat-count-scope", message: `Combat count scope is not recognized.`, stateKey: state.stateKey, ruleId: rule.id });
    if (!relativeTimings.includes(event.relativeTiming))
        issues.push({ code: "combat-relative-timing", message: `Combat relative timing is not recognized.`, stateKey: state.stateKey, ruleId: rule.id });
    if (scaling ? event.mode !== "per_event" : event.mode === "per_event") {
        issues.push({ code: "combat-event-mode-channel", message: `Combat event mode does not match its condition or scaling channel.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (event.mode === "current_event" && event.countScope !== undefined) {
        issues.push({ code: "combat-current-count-scope", message: `A current combat event cannot declare a counter scope.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (event.mode !== "current_event" && event.countScope === undefined) {
        issues.push({ code: "combat-history-count-scope", message: `Historical and per-event combat data require an explicit or unknown count scope.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (event.eventType === "incoming_attack" && event.mode !== "current_event") {
        issues.push({ code: "combat-targeting-history", message: `Incoming targeting is a pre-resolution current event and cannot increment hit history or effect scaling.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (event.eventType === "incoming_attack" && event.relativeTiming === "after_event") {
        issues.push({ code: "combat-targeting-timing", message: `Incoming targeting cannot prove a post-resolution outcome.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if ((event.eventType === "attack_landed" || event.eventType === "attack_evaded")
        && event.relativeTiming === "before_event") {
        issues.push({ code: "combat-outcome-timing", message: `A hit or evade outcome cannot be confirmed before resolution.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (event.attackStyle !== undefined && event.attackKind !== "super_attack") {
        issues.push({ code: "combat-style-kind", message: `Attack style is valid only for Super Attacks.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (event.eventType === "final_blow_delivered" && (event.actor !== "self" || event.attackKind !== "unknown")) {
        issues.push({ code: "combat-final-blow-shape", message: `Final-blow events must be self-authored without an invented attack kind.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (event.eventType === "attack_performed" && event.actor !== "self") {
        issues.push({ code: "combat-performed-actor", message: `Performed attacks must use self as actor.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if ((event.eventType === "incoming_attack" || event.eventType === "attack_landed" || event.eventType === "attack_evaded") && event.actor !== "enemy") {
        issues.push({ code: "combat-incoming-actor", message: `Targeted, landed, or evaded attacks must use enemy as actor.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    const provenanceEntries = [
        ["eventType", event.provenance?.eventType], ["actor", event.provenance?.actor],
        ["attackKind", event.provenance?.attackKind], ["mode", event.provenance?.mode],
        ["relativeTiming", event.provenance?.relativeTiming],
        ...(event.attackStyle !== undefined ? [["attackStyle", event.provenance?.attackStyle]] : []),
        ...(event.countScope !== undefined ? [["countScope", event.provenance?.countScope]] : []),
    ];
    for (const [field, source] of provenanceEntries) {
        if (!source || !sources.includes(source)) {
            issues.push({ code: "combat-provenance", message: `Combat ${field} requires recognized provenance.`, stateKey: state.stateKey, ruleId: rule.id });
        }
    }
    if ((event.attackKind === "unknown") !== (event.provenance.attackKind === "unresolved")) {
        issues.push({ code: "combat-attack-kind-resolution", message: `Unknown attack kind and unresolved provenance must be paired.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (event.attackStyle !== undefined && ((event.attackStyle === "unknown") !== (event.provenance.attackStyle === "unresolved"))) {
        issues.push({ code: "combat-attack-style-resolution", message: `Unknown attack style and unresolved provenance must be paired.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (event.countScope !== undefined && ((event.countScope === "unknown") !== (event.provenance.countScope === "unresolved"))) {
        issues.push({ code: "combat-count-scope-resolution", message: `Unknown count scope and unresolved provenance must be paired.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if ((event.relativeTiming === "unknown") !== (event.provenance.relativeTiming === "unresolved")) {
        issues.push({ code: "combat-relative-timing-resolution", message: `Unknown relative timing and unresolved provenance must be paired.`, stateKey: state.stateKey, ruleId: rule.id });
    }
}
function validateEnemyReferenceBindings(condition, state, rule, issues) {
    if (condition.op === "not") {
        rejectBoundEnemyReferences(condition.child, state, rule, issues);
        return;
    }
    if (condition.op === "any") {
        condition.children.forEach(child => validateEnemyReferenceBindings(child, state, rule, issues));
        return;
    }
    if (condition.op === "all") {
        validateEnemyReferencesInConjunction(condition, conjunctiveComponentProvesSingleEnemy(condition), state, rule, issues);
        return;
    }
    rejectBoundEnemyReferences(condition, state, rule, issues);
}
function validateEnemyReferencesInConjunction(condition, provesSingleEnemy, state, rule, issues) {
    if (condition.op === "predicate") {
        if (condition.predicate.enemyReference === "that_enemy"
            && condition.predicate.enemySelection === "only_enemy"
            && !provesSingleEnemy) {
            enemyReferenceBindingIssue(state, rule, issues);
        }
        return;
    }
    if (condition.op === "all") {
        condition.children.forEach(child => {
            if (child.op === "all" || child.op === "predicate") {
                validateEnemyReferencesInConjunction(child, provesSingleEnemy, state, rule, issues);
            }
            else {
                validateEnemyReferenceBindings(child, state, rule, issues);
            }
        });
    }
}
function rejectBoundEnemyReferences(condition, state, rule, issues) {
    if (condition.op === "predicate") {
        if (condition.predicate.enemyReference === "that_enemy"
            && condition.predicate.enemySelection === "only_enemy") {
            enemyReferenceBindingIssue(state, rule, issues);
        }
        return;
    }
    if (condition.op === "not") {
        rejectBoundEnemyReferences(condition.child, state, rule, issues);
    }
    else if (condition.op === "all" || condition.op === "any") {
        condition.children.forEach(child => rejectBoundEnemyReferences(child, state, rule, issues));
    }
}
function enemyReferenceBindingIssue(state, rule, issues) {
    issues.push({
        code: "enemy-reference-binding",
        message: `That-enemy reference is bound without an enemy_count eq 1 proof in the same conjunctive branch.`,
        stateKey: state.stateKey,
        ruleId: rule.id,
    });
}
function validateScenarioPredicate(predicate, state, rule, issues) {
    const scalarScenarioKinds = [
        "hp_percent", "battle_turn", "turn_from_entry", "enemy_count", "enemy_hp_percent",
    ];
    const isScalarScenario = scalarScenarioKinds.includes(predicate.kind);
    const isScenario = SCENARIO_PREDICATES.has(predicate.kind);
    const comparatorAllowed = ["lt", "lte", "eq", "gte", "gt"].includes(predicate.comparator ?? "");
    if (isScalarScenario && !comparatorAllowed) {
        issues.push({ code: "scenario-comparator", message: `HP and turn predicates require an explicit scalar comparator.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (isScalarScenario && predicate.value === undefined) {
        issues.push({ code: "scenario-value", message: `HP and turn predicates require a scalar value.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (isScalarScenario && predicate.maxValue !== undefined) {
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
    if (predicate.kind === "enemy_hp_percent"
        && predicate.value !== undefined
        && (!Number.isFinite(predicate.value) || predicate.value < 0 || predicate.value > 100)) {
        issues.push({ code: "enemy-hp-range", message: `Enemy HP percent must be within 0..100.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (predicate.kind === "enemy_count") {
        if (predicate.scope !== "battle") {
            issues.push({ code: "enemy-count-scope", message: `Enemy count must use battle scope.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        if (predicate.value !== undefined && !isEnemyCount(predicate.value)) {
            issues.push({ code: "enemy-count-range", message: `Enemy count must be a non-negative integer.`, stateKey: state.stateKey, ruleId: rule.id });
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
    const knownMoments = [
        "start_of_turn", "entry_turn", "end_of_turn", "before_attack", "when_attacking",
    ];
    if (predicate.evaluationMoment !== undefined && !knownMoments.includes(predicate.evaluationMoment)) {
        issues.push({ code: "evaluation-moment", message: `Evaluation moment is not recognized.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (predicate.evaluationMoment !== undefined && !isScenario && predicate.kind !== "ki_amount") {
        issues.push({ code: "evaluation-moment-kind", message: `Evaluation moment is valid only on scenario or attack-Ki predicates.`, stateKey: state.stateKey, ruleId: rule.id });
    }
}
function validateScenarioWindow(children, state, rule, issues) {
    for (const kind of ["hp_percent", "enemy_hp_percent", "battle_turn", "turn_from_entry"]) {
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
function validateKiSphereTypes(types, code, state, rule, issues) {
    if (!types || types.length === 0 || types.some(type => !KI_SPHERE_TYPES.includes(type))) {
        issues.push({ code, message: `Ki Sphere types must use a recognized non-empty selector.`, stateKey: state.stateKey, ruleId: rule.id });
        return;
    }
    if ((types.includes("any") || types.includes("non_rainbow")) && types.length !== 1) {
        issues.push({ code: `${code}-exclusive`, message: `any and non_rainbow Ki Sphere selectors cannot be combined with other values.`, stateKey: state.stateKey, ruleId: rule.id });
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