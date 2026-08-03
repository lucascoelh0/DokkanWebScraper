import { Character, PassiveDetails, Transformation } from "./character";
import { FyiCharacterCatalogEntry } from "./fyi-character-catalog";

export const TEAM_ANALYSIS_SCHEMA_VERSION = 1;
export const TEAM_ANALYSIS_RULES_VERSION = "1";
export const TEAM_ANALYSIS_PARSER_VERSION = "1.0.0";

export type ParseStatus = "supported" | "partial" | "unknown";
export type ReleaseState = "initial" | "eza" | "seza";

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
    | "support"
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
    effects: PassiveEffect[],
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
    chancePercent?: number,
    perStack?: number,
    stackCap?: number,
    duration?: PassiveDuration,
    categories?: string[],
    names?: string[],
    classes?: string[],
    types?: string[],
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
    conditionCounts: {
        always: number,
        predicate: number,
        unknown: number,
        composite: number,
    },
    supportedPredicateCounts: Record<string, number>,
    supportedEffectCounts: Record<string, number>,
    unknownEffectCount: number,
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
        }];
    }

    const releases: AnalysisReleaseSource[] = [{
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

function compareAnalysisStates(left: CharacterStateAnalysis, right: CharacterStateAnalysis): number {
    const releaseOrder: Record<ReleaseState, number> = { initial: 0, eza: 1, seza: 2 };
    return left.characterId.localeCompare(right.characterId)
        || left.formId.localeCompare(right.formId)
        || releaseOrder[left.releaseState] - releaseOrder[right.releaseState];
}

export function parsePassive(stateKey: string, name: string | undefined, rawText: string): ParsedPassive {
    const rawLines = rawText.replace(/\r\n/g, "\n").split("\n");
    const rules: PassiveRule[] = [];
    const unparsedFragments: SourceFragment[] = [];
    let currentHeader: SourceFragment | undefined;
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
            } else {
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

function isAlwaysHeader(text: string): boolean {
    return /^\*?Basic effect\(s\)\*?:?$/i.test(text.trim());
}

function parseUnconditionalEffects(sourceText: string): PassiveEffect[] | undefined {
    const text = sourceText.trim();
    const kiMatch = /^Ki\s*\+\s*(\d+(?:\.\d+)?)$/i.exec(text);
    if (kiMatch) {
        return [numericEffect("ki", Number(kiMatch[1]), "ki", text)];
    }

    const statMatch = /^((?:HP|ATK|DEF)(?:\s*(?:,|&|and)\s*(?:HP|ATK|DEF))*)\s*\+?\s*(\d+(?:\.\d+)?)%$/i.exec(text);
    if (statMatch) {
        const value = Number(statMatch[2]);
        const kinds = statMatch[1].match(/HP|ATK|DEF/gi) ?? [];
        return kinds.map(kind => numericEffect(kind.toLowerCase() as "hp" | "atk" | "def", value, "percent", text));
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

function numericEffect(
    kind: "ki" | "hp" | "atk" | "def" | "damage_reduction",
    value: number,
    unit: "percent" | "ki",
    sourceText: string,
): PassiveEffect {
    return {
        kind,
        target: { scope: "self" },
        value,
        unit,
        sourceText,
    };
}

function booleanEffect(
    kind: "guard" | "effective_against_all_types",
    sourceText: string,
): PassiveEffect {
    return {
        kind,
        target: { scope: "self" },
        value: 1,
        unit: "boolean",
        sourceText,
    };
}

function unknownEffect(sourceText: string): PassiveEffect {
    return {
        kind: "unknown",
        target: { scope: "unknown" },
        sourceText,
    };
}

function unknownStandaloneRule(stateKey: string, fragment: SourceFragment): PassiveRule {
    return {
        id: ruleIdFromFragment(stateKey, fragment),
        condition: { op: "unknown", sourceText: fragment.text },
        effects: [unknownEffect(fragment.text)],
        source: [fragment],
        parseStatus: "unknown",
        confidence: "low",
    };
}

function splitSemicolonClauses(
    rawLine: string,
    lineIndex: number,
    bulletText: string,
    bulletStart: number,
): SourceFragment[] {
    const fragments: SourceFragment[] = [];
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
    const supportedPredicateCounts: Record<string, number> = {};
    const supportedEffectCounts: Record<string, number> = {};
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
): Map<string, { displayName: string, passiveText: string }> {
    const expected = new Map<string, { displayName: string, passiveText: string }>();
    for (const character of characters) {
        for (const form of [character, ...(character.transformations ?? [])] as AnalysisFormSource[]) {
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
    expected: { displayName: string, passiveText: string } | undefined,
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
