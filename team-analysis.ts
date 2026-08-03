import { Character, PassiveDetails, Transformation } from "./character";
import { FyiCharacterCatalogEntry } from "./fyi-character-catalog";
import {
    ChanceSemantic,
    QualitativeChanceTerm,
    validatedChancePercent,
} from "./team-analysis-chance-lexicon";
import { resolveFirstPartyProbability } from "./team-analysis-first-party-probabilities";

export const TEAM_ANALYSIS_SCHEMA_VERSION = 1;
export const TEAM_ANALYSIS_RULES_VERSION = "1";
export const TEAM_ANALYSIS_PARSER_VERSION = "1.1.2";

export type ParseStatus = "supported" | "partial" | "unknown";
export type ReleaseState = "initial" | "eza" | "seza";
export type SelfInclusion = "included" | "excluded" | "unknown";
export type PassiveEffectClassification = "support";
export type ProbabilitySource =
    | "explicit_text"
    | "first_party_game_db"
    | "qualitative_lexicon"
    | "unresolved";

export type PassivePredicateKind =
    | "ally_category_present"
    | "ally_name_present"
    | "ally_class_present"
    | "ally_type_present"
    | "team_category_count"
    | "team_class_count"
    | "team_type_count"
    | "all_rotation_allies_category"
    | "all_rotation_allies_class"
    | "rotation_partner_category"
    | "rotation_partner_name"
    | "rotation_partner_link_present"
    | "character_is_leader"
    | "character_is_friend"
    | "battle_slot"
    | "rotation_assignment"
    | "rotation_partner_present"
    | "floater_assignment"
    | "hp_percent"
    | "turn_number"
    | "turns_from_entry"
    | "enemy_count"
    | "enemy_category"
    | "enemy_name"
    | "enemy_class"
    | "enemy_type"
    | "enemy_status"
    | "domain_active"
    | "standby_active"
    | "active_skill_used"
    | "revive_triggered"
    | "ki_amount"
    | "ki_spheres_obtained"
    | "ki_sphere_type_obtained"
    | "attacks_performed"
    | "attacks_received"
    | "attacks_evaded"
    | "super_attacks_performed"
    | "super_attack_received"
    | "final_blow_delivered"
    | "chance_roll"
    | "unknown";

export type PassiveEffectKind =
    | "ki"
    | "hp"
    | "atk"
    | "def"
    | "damage_reduction"
    | "guard"
    | "evade_chance"
    | "critical_chance"
    | "additional_attack"
    | "additional_super_attack"
    | "effective_against_all_types"
    | "super_attack_seal"
    | "stun_chance"
    | "enemy_atk_down"
    | "enemy_def_down"
    | "ki_sphere_change"
    | "scouter"
    | "revive"
    | "domain"
    | "unknown";

export interface TeamAnalysisDataset {
    schemaVersion: number,
    rulesVersion: string,
    parserVersion: string,
    generatedAt: string,
    sourceCharacterDatasetVersion: string,
    sourceCharacterPayloadSha256: string,
    stateCount: number,
    supportedRuleCount: number,
    partialRuleCount: number,
    unknownRuleCount: number,
    states: CharacterStateAnalysis[],
}

export interface CharacterStateAnalysis {
    stateKey: string,
    characterId: string,
    canonicalId?: string,
    gameCharacterId?: string,
    baseCharacterId?: string,
    hardDuplicateGroupId: string,
    variantGroupId?: string,
    awakeningFamilyId?: string,
    formId: string,
    releaseState: ReleaseState,
    displayName: string,
    passive?: ParsedPassive,
}

export interface ParsedPassive {
    name?: string,
    rawText: string,
    parseStatus: ParseStatus,
    rules: PassiveRule[],
    unparsedFragments: SourceFragment[],
}

export interface PassiveRule {
    id: string,
    condition: ConditionExpression,
    conditionStatus: ParseStatus,
    effects: PassiveEffect[],
    effectStatus: ParseStatus,
    source: SourceFragment[],
    parseStatus: ParseStatus,
    confidence: "high" | "medium" | "low",
}

export interface SourceFragment {
    lineIndex: number,
    text: string,
    start?: number,
    end?: number,
}

export interface MappedPassiveText {
    text: string,
    source: SourceFragment[],
    mapped: boolean,
}

export interface MappedPassiveSection {
    label?: MappedPassiveText,
    lines: MappedPassiveText[],
}

export interface PassiveSourceMap {
    rawText: string,
    sourceFragments: SourceFragment[],
    lines: MappedPassiveText[],
    sections: MappedPassiveSection[],
    unmappedTexts: string[],
}

export type ConditionExpression =
    | { op: "always" }
    | { op: "all", children: ConditionExpression[] }
    | { op: "any", children: ConditionExpression[] }
    | { op: "not", child: ConditionExpression }
    | { op: "predicate", predicate: PassivePredicate }
    | { op: "unknown", sourceText: string };

export interface PassivePredicate {
    kind: PassivePredicateKind,
    scope: "self" | "rotation" | "team" | "enemy" | "battle",
    selfInclusion?: SelfInclusion,
    comparator?: "eq" | "neq" | "lt" | "lte" | "gt" | "gte" | "between",
    value?: number,
    maxValue?: number,
    count?: number,
    categories?: string[],
    names?: string[],
    classes?: string[],
    types?: string[],
    slots?: number[],
    kiSphereTypes?: string[],
    sourceText: string,
}

export interface PassiveEffect {
    kind: PassiveEffectKind,
    target: PassiveTarget,
    value?: number,
    unit?: "percent" | "flat" | "ki" | "count" | "boolean",
    count?: number,
    activationChancePercent?: number,
    additionalToSuperChancePercent?: number,
    /** @deprecated Compatibility alias for activationChancePercent. */
    chancePercent?: number,
    qualitativeChanceTerm?: QualitativeChanceTerm,
    probabilitySource?: ProbabilitySource,
    additionalToSuperQualitativeChanceTerm?: QualitativeChanceTerm,
    additionalToSuperProbabilitySource?: ProbabilitySource,
    perStack?: number,
    stackCap?: number,
    duration?: PassiveDuration,
    categories?: string[],
    names?: string[],
    classes?: string[],
    types?: string[],
    classifications?: PassiveEffectClassification[],
    sourceText: string,
}

export interface PassiveTarget {
    scope:
        | "self"
        | "rotation_allies"
        | "team_allies"
        | "category_allies"
        | "class_allies"
        | "type_allies"
        | "enemy"
        | "all_enemies"
        | "unknown",
    selfInclusion?: SelfInclusion,
}

export interface PassiveDuration {
    kind: "instant" | "within_turn" | "turns" | "battle" | "until_trigger" | "unknown",
    turns?: number,
}

export interface TeamAnalysisCoverageReport {
    generatedAt: string,
    sourceCharacterDatasetVersion: string,
    sourceCharacterPayloadSha256: string,
    sourceStateCount: number,
    passiveStateCount: number,
    passiveStatusCounts: Record<ParseStatus, number>,
    parsedRuleCount: number,
    ruleStatusCounts: Record<ParseStatus, number>,
    conditionStatusCounts: Record<ParseStatus, number>,
    effectStatusCounts: Record<ParseStatus, number>,
    conditionCounts: {
        always: number,
        predicate: number,
        unknown: number,
        composite: number,
    },
    supportedPredicateCounts: Record<string, number>,
    supportedEffectCounts: Record<string, number>,
    derivedSupportEffectCount: number,
    unknownEffectCount: number,
    unresolvedProbabilityEffectCount: number,
    probabilitySourceCounts: Record<ProbabilitySource, number>,
    unknownFragmentCount: number,
    teamEvaluableRuleCount: number,
    scenarioRuleCount: number,
    runtimeOnlyRuleCount: number,
    identity: {
        variantGroupAssignedStateCount: number,
        variantGroupOmittedStateCount: number,
        awakeningFamilyAssignedStateCount: number,
    },
}

export interface TeamAnalysisValidationIssue {
    code: string,
    message: string,
    stateKey?: string,
    ruleId?: string,
}

interface AnalysisFormSource {
    id: string,
    name: string,
    passive: string,
    passiveDetails?: PassiveDetails,
    ezaPassive?: string,
    ezaPassiveDetails?: PassiveDetails,
    sezaPassive?: string,
    ezaReleaseDate?: string,
    sezaReleaseDate?: string,
}

interface AnalysisReleaseSource {
    releaseState: ReleaseState,
    passiveText: string,
    passiveName?: string,
    passiveDetails?: PassiveDetails,
}

interface ResolvedIdentity {
    characterId: string,
    canonicalId?: string,
    gameCharacterId?: string,
    baseCharacterId?: string,
    hardDuplicateGroupId: string,
    variantGroupId?: string,
    awakeningFamilyId?: string,
    formId: string,
    releaseState: ReleaseState,
}

export function buildStateKey(characterId: string, formId: string, releaseState: ReleaseState): string {
    return `${characterId}:${formId}:${releaseState}`;
}

export function buildHardDuplicateGroupId(characterId: string): string {
    return `card:${characterId}`;
}

export function buildVariantGroupId(canonicalId: string): string {
    return `canonical:${canonicalId}`;
}

export function buildAwakeningFamilyId(baseCharacterId: string): string {
    return `awakening:${baseCharacterId}`;
}

export function releaseStateFromForm(form: Pick<AnalysisFormSource, "ezaReleaseDate" | "sezaReleaseDate">): ReleaseState {
    if (form.sezaReleaseDate) {
        return "seza";
    }
    if (form.ezaReleaseDate) {
        return "eza";
    }
    return "initial";
}

export function buildTeamAnalysisDataset(
    characters: Character[],
    catalogEntries: FyiCharacterCatalogEntry[],
    options: {
        generatedAt: string,
        sourceCharacterDatasetVersion: string,
        sourceCharacterPayloadSha256: string,
        rulesVersion?: string,
        parserVersion?: string,
    },
): TeamAnalysisDataset {
    const catalogById = new Map(catalogEntries.map(entry => [entry.id, entry]));
    const states = characters
        .flatMap(character => buildCharacterStates(character, catalogById.get(character.id)))
        .sort(compareAnalysisStates);
    const ruleCounts = countRuleStatuses(states);

    return {
        schemaVersion: TEAM_ANALYSIS_SCHEMA_VERSION,
        rulesVersion: options.rulesVersion ?? TEAM_ANALYSIS_RULES_VERSION,
        parserVersion: options.parserVersion ?? TEAM_ANALYSIS_PARSER_VERSION,
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

function buildCharacterStates(
    character: Character,
    catalogEntry: FyiCharacterCatalogEntry | undefined,
): CharacterStateAnalysis[] {
    const rootForm: AnalysisFormSource = character;
    const forms: AnalysisFormSource[] = [rootForm, ...(character.transformations ?? [])];

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

function resolveIdentity(
    character: Character,
    form: AnalysisFormSource,
    catalogEntry: FyiCharacterCatalogEntry | undefined,
    releaseState = releaseStateFromForm(form),
): ResolvedIdentity {
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

function analysisReleaseSources(form: AnalysisFormSource): AnalysisReleaseSource[] {
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

    const releases: AnalysisReleaseSource[] = [{
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

function compareAnalysisStates(left: CharacterStateAnalysis, right: CharacterStateAnalysis): number {
    const releaseOrder: Record<ReleaseState, number> = { initial: 0, eza: 1, seza: 2 };
    return left.characterId.localeCompare(right.characterId)
        || left.formId.localeCompare(right.formId)
        || releaseOrder[left.releaseState] - releaseOrder[right.releaseState];
}

interface LogicalPassiveBlock {
    kind: "condition" | "effect",
    text: string,
    source: SourceFragment[],
}

interface ParsedConditionResult {
    condition: ConditionExpression,
    status: ParseStatus,
}

interface ParsedEffectResult {
    effects: PassiveEffect[],
    status: ParseStatus,
}

export function parsePassive(
    stateKey: string,
    name: string | undefined,
    rawText: string,
    passiveDetails?: PassiveDetails,
): ParsedPassive {
    const sourceMap = mapPassiveDetailsToSource(rawText, passiveDetails);
    const blocks = buildLogicalPassiveBlocks(sourceMap.sourceFragments);
    const rules: PassiveRule[] = [];
    const unparsedFragments: SourceFragment[] = [];
    let currentCondition: LogicalPassiveBlock | undefined;
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

        const conditionResult = currentCondition
            ? parseCondition(currentCondition.text)
            : { condition: { op: "always" } as ConditionExpression, status: "supported" as ParseStatus };
        const effectResult = parseEffects(block.text, {
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

export function mapPassiveDetailsToSource(
    rawText: string,
    passiveDetails?: PassiveDetails,
): PassiveSourceMap {
    const normalizedRawText = rawText.replace(/\r\n/g, "\n");
    const rawLines = normalizedRawText.split("\n");
    const sourceFragments = rawLines
        .map((line, lineIndex) => trimmedFragment(line, lineIndex))
        .filter(fragment => fragment.text.length > 0);
    const lineTexts = passiveDetails?.lines ?? sourceFragments.map(fragment => fragment.text);
    const lines = alignPassiveTexts(rawLines, lineTexts);
    const sectionEntries = (passiveDetails?.sections ?? []).flatMap(section => [
        ...(section.label ? [{ type: "label" as const, text: section.label }] : []),
        ...section.lines.map(text => ({ type: "line" as const, text })),
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

function alignPassiveTexts(rawLines: string[], texts: string[]): MappedPassiveText[] {
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

function buildAlignmentStream(rawLines: string[]): {
    text: string,
    positions: Array<{ lineIndex: number, column: number }>,
} {
    let text = "";
    const positions: Array<{ lineIndex: number, column: number }> = [];
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

function normalizeAlignmentText(text: string): string {
    return text.replace(/^\s*-\s+/, "").replace(/[\s*]/g, "");
}

function fragmentsFromAlignmentPositions(
    rawLines: string[],
    positions: Array<{ lineIndex: number, column: number }>,
): SourceFragment[] {
    const ranges = new Map<number, { start: number, end: number }>();
    for (const position of positions) {
        const range = ranges.get(position.lineIndex);
        if (range) {
            range.start = Math.min(range.start, position.column);
            range.end = Math.max(range.end, position.column + 1);
        } else {
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

function buildLogicalPassiveBlocks(sourceFragments: SourceFragment[]): LogicalPassiveBlock[] {
    const blocks: LogicalPassiveBlock[] = [];
    let current: { kind: "condition" | "effect", source: SourceFragment[] } | undefined;
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

function isEffectModifierContinuation(text: string): boolean {
    return /^for\s+\d+\s+turn(?:s|\(s\))?$/i.test(text.trim());
}

function logicalText(kind: "condition" | "effect", source: SourceFragment[]): string {
    return source.map((fragment, index) => {
        const text = fragment.text.replace(/^\*|\*$/g, "").trim();
        return kind === "effect" && index === 0 ? text.replace(/^-\s+/, "") : text;
    }).join(" ").replace(/\s+/g, " ").trim();
}

function isLogicalHeaderStart(text: string): boolean {
    return /^(?:Activates the Entrance Animation|Basic effect\(s\)|When\b|If\b|Per\b|For\b|Starting\b|As the\b|After\b|Before\b|At the\b|With\b|Without\b|While\b|The less\b|The more\b|Upon\b|Once\b|Every\b|\d+ or more\b)/i.test(text.trim());
}

function isAlwaysHeader(text: string): boolean {
    return /^\*?Basic effect\(s\)\*?:?$/i.test(text.trim());
}

function parseCondition(sourceText: string): ParsedConditionResult {
    const text = sourceText.trim();
    if (isAlwaysHeader(text)) {
        return { condition: { op: "always" }, status: "supported" };
    }

    const allRotationMatch = /^When all allies attacking in the same turn are (.+?) Category characters?$/i.exec(text);
    if (allRotationMatch) {
        const categoryValues = parseQuotedValues(allRotationMatch[1]);
        if (categoryValues) {
            return {
                condition: {
                    op: "predicate",
                    predicate: {
                        kind: "all_rotation_allies_category",
                        scope: "rotation",
                        selfInclusion: "included",
                        categories: categoryValues.values,
                        sourceText: text,
                    },
                },
                status: "supported",
            };
        }
    }

    const allyCondition = parseAllyCondition(text);
    if (allyCondition) {
        return { condition: allyCondition, status: "supported" };
    }
    return {
        condition: { op: "unknown", sourceText: text },
        status: "unknown",
    };
}

function parseAllyCondition(text: string): ConditionExpression | undefined {
    if (!/^When\b/i.test(text)) {
        return undefined;
    }
    let body = text.replace(/^When\s+/i, "").trim();
    let selfInclusion: SelfInclusion = "included";
    if (/\(self excluded\)/i.test(body)) {
        selfInclusion = "excluded";
        body = body.replace(/\s*\(self excluded\)\s*/ig, " ").trim();
    } else if (/\(self included\)/i.test(body)) {
        body = body.replace(/\s*\(self included\)\s*/ig, " ").trim();
    }
    body = body.replace(/^there (?:is|are)\s+/i, "");
    const anotherMatch = /^another\s+/i.exec(body);
    if (anotherMatch) {
        selfInclusion = "excluded";
        body = body.slice(anotherMatch[0].length);
    }
    let count: number | undefined;
    const countMatch = /^(\d+)\s+or more\s+/i.exec(body);
    if (countMatch) {
        count = Number(countMatch[1]);
        body = body.slice(countMatch[0].length);
    }
    body = body.replace(/^an?\s+/i, "");

    let scope: "team" | "rotation";
    const teamMatch = /\s+(?:is\s+|are\s+)?on the team$/i.exec(body);
    const rotationMatch = /\s+(?:is\s+|are\s+)?attacking in the same turn$/i.exec(body);
    if (teamMatch) {
        scope = "team";
        body = body.slice(0, teamMatch.index).trim();
    } else if (rotationMatch) {
        scope = "rotation";
        body = body.slice(0, rotationMatch.index).trim();
    } else {
        return undefined;
    }

    const categoryAndName = /^(.+?) Category all(?:y|ies) whose name includes (.+)$/i.exec(body);
    if (categoryAndName) {
        const categoryExpression = buildQuotedPredicateExpression(
            categoryAndName[1],
            value => allyPredicate("category", value, scope, selfInclusion, count, text),
        );
        const nameExpression = buildQuotedPredicateExpression(
            categoryAndName[2],
            value => allyPredicate("name", value, scope, selfInclusion, count, text),
        );
        return categoryExpression && nameExpression
            ? { op: "all", children: [categoryExpression, nameExpression] }
            : undefined;
    }

    const categoryMatch = /^(.+?) Category all(?:y|ies)$/i.exec(body);
    if (categoryMatch) {
        return buildQuotedPredicateExpression(
            categoryMatch[1],
            value => allyPredicate("category", value, scope, selfInclusion, count, text),
        );
    }
    const nameMatch = /^all(?:y|ies) whose name includes (.+)$/i.exec(body);
    if (nameMatch) {
        return buildQuotedPredicateExpression(
            nameMatch[1],
            value => allyPredicate("name", value, scope, selfInclusion, count, text),
        );
    }
    return undefined;
}

function allyPredicate(
    type: "category" | "name",
    value: string,
    scope: "team" | "rotation",
    selfInclusion: SelfInclusion,
    count: number | undefined,
    sourceText: string,
): ConditionExpression {
    const rotationPartner = scope === "rotation" && selfInclusion === "excluded";
    const kind: PassivePredicateKind = type === "category"
        ? (rotationPartner ? "rotation_partner_category" : "ally_category_present")
        : (rotationPartner ? "rotation_partner_name" : "ally_name_present");
    return {
        op: "predicate",
        predicate: {
            kind,
            scope,
            selfInclusion,
            ...(count !== undefined ? { comparator: "gte" as const, count } : {}),
            ...(type === "category" ? { categories: [value] } : { names: [value] }),
            sourceText,
        },
    };
}

function buildQuotedPredicateExpression(
    sourceText: string,
    build: (value: string) => ConditionExpression,
): ConditionExpression | undefined {
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

function parseQuotedValues(sourceText: string): {
    values: string[],
    connector: "single" | "and" | "or",
} | undefined {
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

interface EffectParseContext {
    stateKey: string,
    rawText: string,
    ruleLineIndex: number,
}

function parseEffects(sourceText: string, context: EffectParseContext): ParsedEffectResult {
    const resolvedTarget = resolveEffectTarget(sourceText);
    const parsedAtoms = parseEffectAtoms(resolvedTarget.body, context);
    const effects = parsedAtoms.atoms.map(atom => applyEffectTarget(atom, resolvedTarget));
    effects.push(...parsedAtoms.unknownSegments.map(segment => unknownEffect(
        segment,
        resolvedTarget.target,
        resolvedTarget.categories,
    )));
    return {
        effects,
        status: effectListStatus(effects),
    };
}

interface ResolvedEffectTarget {
    body: string,
    target: PassiveTarget,
    categories?: string[],
}

interface PassiveEffectAtom {
    kind:
        | "ki"
        | "hp"
        | "atk"
        | "def"
        | "damage_reduction"
        | "guard"
        | "evade_chance"
        | "critical_chance"
        | "additional_attack"
        | "additional_super_attack"
        | "stun_chance"
        | "super_attack_seal"
        | "effective_against_all_types",
    value?: number,
    unit?: PassiveEffect["unit"],
    count?: number,
    activationChancePercent?: number,
    additionalToSuperChancePercent?: number,
    chancePercent?: number,
    qualitativeChanceTerm?: QualitativeChanceTerm,
    probabilitySource?: ProbabilitySource,
    additionalToSuperQualitativeChanceTerm?: QualitativeChanceTerm,
    additionalToSuperProbabilitySource?: ProbabilitySource,
    stackCap?: number,
    duration?: PassiveDuration,
    sourceText: string,
}

interface EffectAtomCandidate {
    start: number,
    end: number,
    atoms: PassiveEffectAtom[],
}

interface EffectModifierCandidate {
    start: number,
    end: number,
    apply: (atom: PassiveEffectAtom) => void,
}

function resolveEffectTarget(sourceText: string): ResolvedEffectTarget {
    let text = sourceText.trim();
    let selfInclusion: SelfInclusion = "included";
    if (/\(self excluded\)/i.test(text)) {
        selfInclusion = "excluded";
        text = text.replace(/\s*\(self excluded\)\s*/ig, " ").trim();
    } else if (/\(self included\)/i.test(text)) {
        text = text.replace(/\s*\(self included\)\s*/ig, " ").trim();
    }

    const allAlliesMatch = /^All allies['’]\s+(.+)$/i.exec(text);
    const categoryAlliesMatch = /^(.+?) Category allies['’]\s+(.+)$/i.exec(text);
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
    if (/\b(?:stuns?|stunning|seals?|sealing)\s+(?:all enemies|all enemies['’])/i.test(text)) {
        return { body: text, target: { scope: "all_enemies" } };
    }
    if (/\b(?:stuns?|stunning|seals?|sealing)\s+(?:(?:the\s+)?attacked\s+enemy|(?:the\s+)?enemy)(?:['’]s)?/i.test(text)) {
        return { body: text, target: { scope: "enemy" } };
    }
    if (/^(?:.+?\s+allies|All enemies|Attacked enemy|Enemy|Target enemy)['’]\s+/i.test(text)) {
        return { body: text, target: { scope: "unknown" } };
    }
    return { body: sourceText.trim(), target: { scope: "self" } };
}

function activationChanceFields(
    percent: number,
    probabilitySource: ProbabilitySource = "explicit_text",
    qualitativeChanceTerm?: QualitativeChanceTerm,
): Pick<PassiveEffectAtom, "activationChancePercent" | "chancePercent" | "probabilitySource" | "qualitativeChanceTerm"> {
    return {
        activationChancePercent: percent,
        chancePercent: percent,
        probabilitySource,
        ...(qualitativeChanceTerm ? { qualitativeChanceTerm } : {}),
    };
}

function explicitAttackCount(sourceCount: string): number {
    return /^an?$/i.test(sourceCount) ? 1 : Number(sourceCount);
}

interface ResolvedProbability {
    percent?: number,
    qualitativeChanceTerm?: QualitativeChanceTerm,
    probabilitySource: ProbabilitySource,
}

function normalizeQualitativeChanceTerm(sourceTerm: string | undefined): QualitativeChanceTerm | undefined {
    if (!sourceTerm) {
        return undefined;
    }
    const normalized = sourceTerm.trim().toLowerCase();
    if (normalized === "a" || normalized === "a chance") {
        return "a chance";
    }
    if (["rare", "medium", "high", "great"].includes(normalized)) {
        return normalized as QualitativeChanceTerm;
    }
    return undefined;
}

function resolveProbability(
    context: EffectParseContext,
    semantic: ChanceSemantic,
    sourceTerm: string | undefined,
    sourcePercent: string | undefined,
): ResolvedProbability {
    const qualitativeChanceTerm = normalizeQualitativeChanceTerm(sourceTerm);
    if (sourcePercent !== undefined) {
        return {
            percent: Number(sourcePercent),
            ...(qualitativeChanceTerm ? { qualitativeChanceTerm } : {}),
            probabilitySource: "explicit_text",
        };
    }
    if (qualitativeChanceTerm) {
        const firstParty = resolveFirstPartyProbability(
            context.stateKey,
            context.rawText,
            context.ruleLineIndex,
            qualitativeChanceTerm,
            semantic,
        );
        if (firstParty) {
            return {
                percent: firstParty.percent,
                qualitativeChanceTerm,
                probabilitySource: "first_party_game_db",
            };
        }
        const lexiconPercent = validatedChancePercent(qualitativeChanceTerm, semantic);
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

function activationProbabilityFields(probability: ResolvedProbability): Pick<
    PassiveEffectAtom,
    "activationChancePercent" | "chancePercent" | "qualitativeChanceTerm" | "probabilitySource"
> {
    return {
        ...(probability.percent !== undefined ? {
            activationChancePercent: probability.percent,
            chancePercent: probability.percent,
        } : {}),
        ...(probability.qualitativeChanceTerm ? { qualitativeChanceTerm: probability.qualitativeChanceTerm } : {}),
        probabilitySource: probability.probabilitySource,
    };
}

function additionalToSuperProbabilityFields(probability: ResolvedProbability): Pick<
    PassiveEffectAtom,
    "additionalToSuperChancePercent" | "additionalToSuperQualitativeChanceTerm" | "additionalToSuperProbabilitySource"
> {
    return {
        ...(probability.percent !== undefined ? { additionalToSuperChancePercent: probability.percent } : {}),
        ...(probability.qualitativeChanceTerm
            ? { additionalToSuperQualitativeChanceTerm: probability.qualitativeChanceTerm }
            : {}),
        additionalToSuperProbabilitySource: probability.probabilitySource,
    };
}

function parseEffectAtoms(body: string, context: EffectParseContext): {
    atoms: PassiveEffectAtom[],
    unknownSegments: string[],
} {
    const candidates: EffectAtomCandidate[] = [];
    const addMatches = (
        pattern: RegExp,
        build: (match: RegExpMatchArray) => PassiveEffectAtom[],
        rejectUnknownChancePrefix = false,
    ) => {
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
            : { percent: 100, probabilitySource: "explicit_text" as ProbabilitySource };
        const conversion = resolveProbability(
            context,
            "additional_to_super",
            groups.conversionTerm ?? groups.conversionArticle,
            groups.conversionTrailingPercent ?? groups.conversionParenPercent ?? groups.conversionPercent,
        );
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
            : { percent: 100, probabilitySource: "explicit_text" as ProbabilitySource };
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
            : { percent: 100, probabilitySource: "explicit_text" as ProbabilitySource };
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
            kind: kind as "critical_chance" | "evade_chance",
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
            : { percent: 100, probabilitySource: "explicit_text" as ProbabilitySource };
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
            : { percent: 100, probabilitySource: "explicit_text" as ProbabilitySource };
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
            : { percent: 100, probabilitySource: "explicit_text" as ProbabilitySource };
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
        const unit: "percent" | "flat" = match[3] ? "percent" : "flat";
        return (match[1].match(/HP|ATK|DEF/gi) ?? []).map(kind => ({
            kind: kind.toLowerCase() as "hp" | "atk" | "def",
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

    const selected: EffectAtomCandidate[] = [];
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

function applyEffectModifiers(body: string, atoms: EffectAtomCandidate[]): EffectModifierCandidate[] {
    const candidates: EffectModifierCandidate[] = [];
    const addModifiers = (
        pattern: RegExp,
        build: (match: RegExpMatchArray) => (atom: PassiveEffectAtom) => void,
    ) => {
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

    const applied: EffectModifierCandidate[] = [];
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

function stripKnownModifierText(sourceText: string): string {
    return sourceText
        .replace(/\bwithin the turn\b/gi, "")
        .replace(/\bfor\s+\d+\s+turn(?:s\b|\(s\)(?!\w)|\b)/gi, "")
        .replace(/\b(?:for the rest of (?:the )?battle|throughout (?:the )?battle|permanently)\b/gi, "")
        .replace(/\(\s*up to\s+\d+(?:\.\d+)?%\s*\)/gi, "");
}

function modifierText(body: string, modifier: EffectModifierCandidate): string {
    return body.slice(modifier.start, modifier.end);
}

function unknownSegmentsBetweenAtoms(
    body: string,
    atoms: Array<Pick<EffectAtomCandidate, "start" | "end">>,
): string[] {
    if (atoms.length === 0) {
        return body.trim() ? [body.trim()] : [];
    }
    const segments: string[] = [];
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

function cleanUnknownEffectSegment(sourceText: string): string {
    let text = sourceText.trim();
    let previous: string;
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

const BENEFICIAL_EFFECT_KINDS = new Set<PassiveEffectKind>([
    "ki", "hp", "atk", "def", "damage_reduction", "guard", "evade_chance",
    "critical_chance", "additional_attack", "additional_super_attack",
    "effective_against_all_types", "ki_sphere_change", "scouter", "revive", "domain",
]);

function applyEffectTarget(atom: PassiveEffectAtom, resolvedTarget: ResolvedEffectTarget): PassiveEffect {
    const allyTarget = isAllyTarget(resolvedTarget.target);
    return {
        ...atom,
        target: { ...resolvedTarget.target },
        ...(resolvedTarget.categories ? { categories: resolvedTarget.categories } : {}),
        ...(allyTarget && BENEFICIAL_EFFECT_KINDS.has(atom.kind)
            ? { classifications: ["support" as const] }
            : {}),
    };
}

function combineParseStatuses(conditionStatus: ParseStatus, effectStatus: ParseStatus): ParseStatus {
    if (conditionStatus === "supported" && effectStatus === "supported") {
        return "supported";
    }
    if (conditionStatus === "unknown" && effectStatus === "unknown") {
        return "unknown";
    }
    return "partial";
}

function confidenceFromStatus(status: ParseStatus): "high" | "medium" | "low" {
    return status === "supported" ? "high" : status === "partial" ? "medium" : "low";
}

function unknownEffect(
    sourceText: string,
    target: PassiveTarget = { scope: "unknown" },
    categories?: string[],
): PassiveEffect {
    return {
        kind: "unknown",
        target: { ...target },
        ...(categories ? { categories } : {}),
        sourceText,
    };
}

function unknownStandaloneRule(stateKey: string, block: LogicalPassiveBlock): PassiveRule {
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

function trimmedFragment(rawLine: string, lineIndex: number): SourceFragment {
    const text = rawLine.trim();
    const start = rawLine.indexOf(text);
    return {
        lineIndex,
        text,
        start,
        end: start + text.length,
    };
}

function ruleIdFromFragment(stateKey: string, fragment: SourceFragment): string {
    return `${stateKey}:r${fragment.lineIndex}:${fragment.start ?? 0}:${fragment.end ?? fragment.text.length}`;
}

function uniqueOrderedFragments(fragments: SourceFragment[]): SourceFragment[] {
    const byPosition = new Map<string, SourceFragment>();
    for (const fragment of fragments) {
        const key = `${fragment.lineIndex}:${fragment.start ?? ""}:${fragment.end ?? ""}:${fragment.text}`;
        byPosition.set(key, fragment);
    }
    return [...byPosition.values()].sort(compareFragments);
}

function compareFragments(left: SourceFragment, right: SourceFragment): number {
    return left.lineIndex - right.lineIndex
        || (left.start ?? 0) - (right.start ?? 0)
        || (left.end ?? left.text.length) - (right.end ?? right.text.length)
        || left.text.localeCompare(right.text);
}

function aggregatePassiveStatus(rules: PassiveRule[]): ParseStatus {
    if (rules.length === 0 || rules.every(rule => rule.parseStatus === "unknown")) {
        return "unknown";
    }
    if (rules.every(rule => rule.parseStatus === "supported")) {
        return "supported";
    }
    return "partial";
}

function countRuleStatuses(states: CharacterStateAnalysis[]): Record<ParseStatus, number> {
    const counts: Record<ParseStatus, number> = { supported: 0, partial: 0, unknown: 0 };
    for (const state of states) {
        for (const rule of state.passive?.rules ?? []) {
            counts[rule.parseStatus] += 1;
        }
    }
    return counts;
}

export function buildTeamAnalysisCoverageReport(dataset: TeamAnalysisDataset): TeamAnalysisCoverageReport {
    const passiveStatusCounts: Record<ParseStatus, number> = { supported: 0, partial: 0, unknown: 0 };
    const ruleStatusCounts: Record<ParseStatus, number> = { supported: 0, partial: 0, unknown: 0 };
    const conditionStatusCounts: Record<ParseStatus, number> = { supported: 0, partial: 0, unknown: 0 };
    const effectStatusCounts: Record<ParseStatus, number> = { supported: 0, partial: 0, unknown: 0 };
    const supportedPredicateCounts: Record<string, number> = {};
    const supportedEffectCounts: Record<string, number> = {};
    const probabilitySourceCounts: Record<ProbabilitySource, number> = {
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
            conditionStatusCounts[rule.conditionStatus] += 1;
            effectStatusCounts[rule.effectStatus] += 1;
            const conditionKind = classifyCondition(rule.condition);
            conditionCounts[conditionKind] += 1;
            if (
                rule.conditionStatus === "supported"
                && !hasScenarioPredicate(rule.condition)
                && !hasRuntimePredicate(rule.condition)
            ) {
                teamEvaluableRuleCount += 1;
            } else if (hasScenarioPredicate(rule.condition)) {
                scenarioRuleCount += 1;
            } else if (hasRuntimePredicate(rule.condition)) {
                runtimeOnlyRuleCount += 1;
            }
            collectPredicates(rule.condition, supportedPredicateCounts);
            for (const effect of rule.effects) {
                if (effect.kind === "unknown") {
                    unknownEffectCount += 1;
                } else {
                    supportedEffectCounts[effect.kind] = (supportedEffectCounts[effect.kind] ?? 0) + 1;
                }
                if (effect.classifications?.includes("support")) {
                    derivedSupportEffectCount += 1;
                }
                const probabilitySources = [effect.probabilitySource, effect.additionalToSuperProbabilitySource]
                    .filter((source): source is ProbabilitySource => source !== undefined);
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
        scenarioRuleCount,
        runtimeOnlyRuleCount,
        identity: {
            variantGroupAssignedStateCount: dataset.states.filter(state => Boolean(state.variantGroupId)).length,
            variantGroupOmittedStateCount: dataset.states.filter(state => !state.variantGroupId).length,
            awakeningFamilyAssignedStateCount: dataset.states.filter(state => Boolean(state.awakeningFamilyId)).length,
        },
    };
}

function classifyCondition(condition: ConditionExpression): "always" | "predicate" | "unknown" | "composite" {
    if (condition.op === "always" || condition.op === "predicate" || condition.op === "unknown") {
        return condition.op;
    }
    return "composite";
}

const SCENARIO_PREDICATES = new Set<PassivePredicateKind>([
    "hp_percent", "turn_number", "turns_from_entry", "enemy_count", "enemy_category",
    "enemy_name", "enemy_class", "enemy_type", "enemy_status", "domain_active",
    "standby_active", "active_skill_used", "revive_triggered",
]);

const RUNTIME_PREDICATES = new Set<PassivePredicateKind>([
    "ki_amount", "ki_spheres_obtained", "ki_sphere_type_obtained", "attacks_performed",
    "attacks_received", "attacks_evaded", "super_attacks_performed", "super_attack_received",
    "final_blow_delivered", "chance_roll",
]);

function hasScenarioPredicate(condition: ConditionExpression): boolean {
    return conditionHasPredicate(condition, predicate => SCENARIO_PREDICATES.has(predicate.kind));
}

function hasRuntimePredicate(condition: ConditionExpression): boolean {
    return conditionHasPredicate(condition, predicate => RUNTIME_PREDICATES.has(predicate.kind));
}

function conditionHasPredicate(
    condition: ConditionExpression,
    predicateMatcher: (predicate: PassivePredicate) => boolean,
): boolean {
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

function collectPredicates(condition: ConditionExpression, counts: Record<string, number>): void {
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

function sortedRecord(record: Record<string, number>): Record<string, number> {
    return Object.fromEntries(Object.entries(record).sort(([left], [right]) => left.localeCompare(right)));
}

export function validateTeamAnalysisDataset(
    dataset: TeamAnalysisDataset,
    characters: Character[],
    catalogEntries: FyiCharacterCatalogEntry[],
): TeamAnalysisValidationIssue[] {
    const issues: TeamAnalysisValidationIssue[] = [];
    const stateKeys = new Set<string>();
    const ruleIds = new Set<string>();
    const expectedStates = expectedStateIdentities(characters, catalogEntries);
    const expectedSources = expectedStateSources(characters);

    if (dataset.stateCount !== dataset.states.length) {
        issues.push({ code: "state-count", message: `stateCount ${dataset.stateCount} does not match ${dataset.states.length} states.` });
    }
    const actualRuleCounts = countRuleStatuses(dataset.states);
    for (const status of ["supported", "partial", "unknown"] as ParseStatus[]) {
        const field = `${status}RuleCount` as "supportedRuleCount" | "partialRuleCount" | "unknownRuleCount";
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
        } else {
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

export function assertValidTeamAnalysisDataset(
    dataset: TeamAnalysisDataset,
    characters: Character[],
    catalogEntries: FyiCharacterCatalogEntry[],
): void {
    const issues = validateTeamAnalysisDataset(dataset, characters, catalogEntries);
    if (issues.length > 0) {
        const summary = issues.slice(0, 10).map(issue => `${issue.code}: ${issue.message}`).join("\n");
        throw new Error(`Team analysis validation failed with ${issues.length} issue(s):\n${summary}`);
    }
}

function expectedStateIdentities(
    characters: Character[],
    catalogEntries: FyiCharacterCatalogEntry[],
): Map<string, ResolvedIdentity> {
    const catalogById = new Map(catalogEntries.map(entry => [entry.id, entry]));
    const expected = new Map<string, ResolvedIdentity>();
    for (const character of characters) {
        const catalogEntry = catalogById.get(character.id);
        for (const form of [character, ...(character.transformations ?? [])] as AnalysisFormSource[]) {
            for (const releaseSource of analysisReleaseSources(form)) {
                const identity = resolveIdentity(character, form, catalogEntry, releaseSource.releaseState);
                expected.set(buildStateKey(identity.characterId, identity.formId, identity.releaseState), identity);
            }
        }
    }
    return expected;
}

function expectedStateSources(
    characters: Character[],
): Map<string, { displayName: string, passiveText: string, passiveDetails?: PassiveDetails }> {
    const expected = new Map<string, { displayName: string, passiveText: string, passiveDetails?: PassiveDetails }>();
    for (const character of characters) {
        for (const form of [character, ...(character.transformations ?? [])] as AnalysisFormSource[]) {
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

function validateStableIdentity(
    state: CharacterStateAnalysis,
    expected: ResolvedIdentity,
    issues: TeamAnalysisValidationIssue[],
): void {
    const fields: (keyof ResolvedIdentity)[] = [
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

function validateStateSource(
    state: CharacterStateAnalysis,
    expected: { displayName: string, passiveText: string, passiveDetails?: PassiveDetails } | undefined,
    issues: TeamAnalysisValidationIssue[],
): void {
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
    } else if (state.passive) {
        issues.push({ code: "unexpected-passive", message: `Analysis contains a passive absent from the character form.`, stateKey: state.stateKey });
    }
}

function validatePassive(
    state: CharacterStateAnalysis,
    ruleIds: Set<string>,
    issues: TeamAnalysisValidationIssue[],
): void {
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
            for (const field of ["activationChancePercent", "additionalToSuperChancePercent", "chancePercent"] as const) {
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

function conditionExpressionStatus(condition: ConditionExpression): ParseStatus {
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

function effectListStatus(effects: PassiveEffect[]): ParseStatus {
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

function validateProbabilityChannel(
    effect: PassiveEffect,
    channel: "activation" | "additional_to_super",
    state: CharacterStateAnalysis,
    rule: PassiveRule,
    issues: TeamAnalysisValidationIssue[],
): void {
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

function aggregateStatuses(statuses: ParseStatus[]): ParseStatus {
    if (statuses.length === 0 || statuses.every(status => status === "unknown")) {
        return "unknown";
    }
    if (statuses.every(status => status === "supported")) {
        return "supported";
    }
    return "partial";
}

const ALLY_PREDICATE_KINDS = new Set<PassivePredicateKind>([
    "ally_category_present", "ally_name_present", "all_rotation_allies_category",
    "rotation_partner_category", "rotation_partner_name",
]);

const ALLY_TARGET_SCOPES = new Set<PassiveTarget["scope"]>([
    "rotation_allies", "team_allies", "category_allies", "class_allies", "type_allies",
]);

function isAllyTarget(target: PassiveTarget): boolean {
    return ALLY_TARGET_SCOPES.has(target.scope);
}

function validateEffectContract(
    effect: PassiveEffect,
    state: CharacterStateAnalysis,
    rule: PassiveRule,
    issues: TeamAnalysisValidationIssue[],
): void {
    const allyTarget = isAllyTarget(effect.target);
    if (allyTarget && effect.target.selfInclusion === undefined) {
        issues.push({ code: "target-self-inclusion", message: `Ally target must declare self inclusion.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if (effect.target.scope === "category_allies" && (effect.categories?.length ?? 0) === 0) {
        issues.push({ code: "target-categories", message: `Category ally target must name affected categories.`, stateKey: state.stateKey, ruleId: rule.id });
    }
    if ((effect.kind as string) === "support") {
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

function validateSourceTokenCoverage(
    passive: ParsedPassive,
    rawLines: string[],
    state: CharacterStateAnalysis,
    issues: TeamAnalysisValidationIssue[],
): void {
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

function validateFragmentList(
    fragments: SourceFragment[],
    rawLines: string[],
    state: CharacterStateAnalysis,
    rule: PassiveRule | undefined,
    issues: TeamAnalysisValidationIssue[],
): void {
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
            } else if (line.slice(fragment.start, fragment.end) !== fragment.text) {
                issues.push({ code: "fragment-text", message: `Fragment does not point to original raw text.`, stateKey: state.stateKey, ruleId: rule?.id });
            }
        } else if (!line.includes(fragment.text)) {
            issues.push({ code: "fragment-text", message: `Fragment text is absent from its raw line.`, stateKey: state.stateKey, ruleId: rule?.id });
        }
    }
}

function validateCondition(
    condition: ConditionExpression,
    depth: number,
    state: CharacterStateAnalysis,
    rule: PassiveRule,
    issues: TeamAnalysisValidationIssue[],
): void {
    if (depth > 16) {
        issues.push({ code: "ast-depth", message: `Condition AST exceeds depth 16.`, stateKey: state.stateKey, ruleId: rule.id });
        return;
    }
    if (condition.op === "all" || condition.op === "any") {
        if (condition.children.length === 0) {
            issues.push({ code: "empty-ast", message: `${condition.op} condition has no children.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        condition.children.forEach(child => validateCondition(child, depth + 1, state, rule, issues));
    } else if (condition.op === "not") {
        validateCondition(condition.child, depth + 1, state, rule, issues);
    } else if (condition.op === "predicate") {
        validateFiniteNumbers(condition.predicate, state, rule, issues);
        if (ALLY_PREDICATE_KINDS.has(condition.predicate.kind) && condition.predicate.selfInclusion === undefined) {
            issues.push({ code: "condition-self-inclusion", message: `Ally condition must declare self inclusion.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        if (condition.predicate.count !== undefined
            && (!Number.isInteger(condition.predicate.count) || condition.predicate.count <= 0)) {
            issues.push({ code: "condition-count", message: `Ally count must be a positive integer.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        if (["ally_category_present", "all_rotation_allies_category", "rotation_partner_category"].includes(condition.predicate.kind)
            && (condition.predicate.categories?.length ?? 0) === 0) {
            issues.push({ code: "condition-categories", message: `Category condition must name at least one category.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        if (["ally_name_present", "rotation_partner_name"].includes(condition.predicate.kind)
            && (condition.predicate.names?.length ?? 0) === 0) {
            issues.push({ code: "condition-names", message: `Name condition must name at least one character.`, stateKey: state.stateKey, ruleId: rule.id });
        }
        for (const slot of condition.predicate.slots ?? []) {
            if (!Number.isInteger(slot) || slot < 1 || slot > 3) {
                issues.push({ code: "slot-range", message: `Battle slot must be 1, 2, or 3.`, stateKey: state.stateKey, ruleId: rule.id });
            }
        }
    }
}

function validateFiniteNumbers(
    value: object,
    state: CharacterStateAnalysis,
    rule: PassiveRule,
    issues: TeamAnalysisValidationIssue[],
): void {
    for (const [key, fieldValue] of Object.entries(value)) {
        if (typeof fieldValue === "number" && !Number.isFinite(fieldValue)) {
            issues.push({ code: "non-finite-number", message: `${key} must be finite.`, stateKey: state.stateKey, ruleId: rule.id });
        }
    }
}
