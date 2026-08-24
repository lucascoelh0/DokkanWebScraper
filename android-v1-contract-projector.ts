import {
    ActiveSkillDetails,
    Character,
    Transformation,
} from "./character";
import {
    CharacterStateAnalysis,
    CombatEventDescriptor,
    ConditionExpression,
    EffectApplicationTrigger,
    ParseStatus,
    ParsedPassive,
    ParsedSuperAttack,
    PassiveEffect,
    PassiveEffectScaling,
    PassivePredicate,
    PassivePredicateKind,
    PassiveRule,
    SuperAttackEffect,
    TeamAnalysisDataset,
} from "./team-analysis";

export const ANDROID_V1_CONSUMER_COMMIT = "6ac55fe20872d8c3ee1678d4e34fc010243ebb51";
export const ANDROID_V1_PROJECTOR_VERSION = "1.0.0";

const V1_PREDICATE_KINDS = new Set<PassivePredicateKind>([
    "ally_category_present",
    "ally_name_present",
    "ally_class_present",
    "ally_type_present",
    "ally_class_type_present",
    "ally_category_class_present",
    "team_category_count",
    "team_class_count",
    "team_type_count",
    "all_rotation_allies_category",
    "all_rotation_allies_class",
    "rotation_partner_category",
    "rotation_partner_name",
    "character_class",
    "character_type",
    "rotation_partner_link_present",
    "character_is_leader",
    "character_is_friend",
    "battle_slot",
    "rotation_assignment",
    "rotation_partner_present",
    "floater_assignment",
    "hp_percent",
    "battle_turn",
    "turn_from_entry",
    "enemy_count",
    "enemy_category",
    "enemy_name",
    "enemy_class",
    "enemy_type",
    "enemy_class_type",
    "enemy_hp_percent",
    "enemy_status",
    "domain_active",
    "standby_active",
    "active_skill_used",
    "revive_triggered",
    "ki_amount",
    "ki_spheres_obtained",
    "ki_sphere_type_obtained",
    "attacks_performed",
    "incoming_attack",
    "incoming_super_attack",
    "attacks_received",
    "attacks_evaded",
    "super_attacks_performed",
    "super_attack_received",
    "final_blow_delivered",
    "chance_roll",
    "unknown",
]);

const V1_EVALUATION_MOMENTS = new Set([
    "start_of_turn",
    "entry_turn",
    "end_of_turn",
    "before_attack",
    "when_attacking",
]);

const V1_KI_SPHERE_TYPES = new Set([
    "AGL",
    "TEQ",
    "INT",
    "STR",
    "PHY",
    "rainbow",
    "non_rainbow",
    "any",
]);

const V1_COMBAT_EVENT_MODES = new Set([
    "current_event",
    "accumulated_count",
    "per_event",
]);

const V1_COMBAT_EVENT_RELATIVE_TIMINGS = new Set([
    "before_event",
    "during_event",
    "after_event",
    "unknown",
]);

const V1_APPLICATION_TRIGGERS = new Set([
    "per_super_attack",
    "per_combat_event",
    "entry",
    "unknown",
]);

export interface AndroidV1CharacterProjectionReport {
    characterCount: number,
    activeSkillActivationConditionsOmitted: number,
}

export interface AndroidV1TeamAnalysisProjectionReport {
    stateCount: number,
    activeSkillActivationConditionsOmitted: number,
    conditionDowngrades: Record<string, number>,
    scalingDowngrades: Record<string, number>,
    applicationTriggerDowngrades: Record<string, number>,
    supportedRuleCount: number,
    partialRuleCount: number,
    unknownRuleCount: number,
}

export interface AndroidV1CharacterProjection {
    characters: Character[],
    report: AndroidV1CharacterProjectionReport,
}

export interface AndroidV1TeamAnalysisProjection {
    dataset: TeamAnalysisDataset,
    report: AndroidV1TeamAnalysisProjectionReport,
}

interface MutableProjectionCounters {
    conditionDowngrades: Record<string, number>,
    scalingDowngrades: Record<string, number>,
    applicationTriggerDowngrades: Record<string, number>,
}

interface ConditionProjection {
    expression: ConditionExpression,
    downgraded: boolean,
}

interface EffectProjection<T> {
    effect: T,
    downgraded: boolean,
}

export function projectCharactersForAndroidV1(
    sourceCharacters: readonly Character[],
): AndroidV1CharacterProjection {
    let omitted = 0;
    const projectDetails = (details: ActiveSkillDetails[] | undefined): ActiveSkillDetails[] | undefined => {
        if (!details) return undefined;
        return details.map(detail => {
            const projected = cloneJson(detail);
            if (projected.activationCondition !== undefined) {
                omitted += 1;
                delete projected.activationCondition;
            }
            return projected;
        });
    };
    const projectTransformation = (transformation: Transformation): Transformation => ({
        ...cloneJson(transformation),
        ...(transformation.activeSkillDetails
            ? { activeSkillDetails: projectDetails(transformation.activeSkillDetails) }
            : {}),
    });

    const characters = sourceCharacters.map(character => ({
        ...cloneJson(character),
        ...(character.activeSkillDetails
            ? { activeSkillDetails: projectDetails(character.activeSkillDetails) }
            : {}),
        ...(character.ezaActiveSkillDetails
            ? { ezaActiveSkillDetails: projectDetails(character.ezaActiveSkillDetails) }
            : {}),
        ...(character.transformations
            ? { transformations: character.transformations.map(projectTransformation) }
            : {}),
    }));
    assertCharactersProjectedForAndroidV1(characters);
    return {
        characters,
        report: {
            characterCount: characters.length,
            activeSkillActivationConditionsOmitted: omitted,
        },
    };
}

export function projectTeamAnalysisForAndroidV1(
    sourceDataset: TeamAnalysisDataset,
    projectedCharacterPayloadSha256: string,
): AndroidV1TeamAnalysisProjection {
    if (!/^[a-f0-9]{64}$/.test(projectedCharacterPayloadSha256)) {
        throw new Error("Android v1 projected Character payload SHA-256 is invalid.");
    }
    const counters: MutableProjectionCounters = {
        conditionDowngrades: {},
        scalingDowngrades: {},
        applicationTriggerDowngrades: {},
    };
    let activeSkillActivationConditionsOmitted = 0;
    const states = sourceDataset.states.map(state => {
        const projected = projectState(state, counters);
        if (state.activeSkillActivationCondition !== undefined) {
            activeSkillActivationConditionsOmitted += 1;
        }
        return projected;
    });
    const ruleStatuses = states.flatMap(state => state.passive?.rules.map(rule => rule.parseStatus) ?? []);
    const dataset: TeamAnalysisDataset = {
        ...cloneJson(sourceDataset),
        sourceCharacterPayloadSha256: projectedCharacterPayloadSha256,
        stateCount: states.length,
        supportedRuleCount: ruleStatuses.filter(status => status === "supported").length,
        partialRuleCount: ruleStatuses.filter(status => status === "partial").length,
        unknownRuleCount: ruleStatuses.filter(status => status === "unknown").length,
        states,
    };
    assertTeamAnalysisProjectedForAndroidV1(dataset);
    return {
        dataset,
        report: {
            stateCount: states.length,
            activeSkillActivationConditionsOmitted,
            conditionDowngrades: sortedRecord(counters.conditionDowngrades),
            scalingDowngrades: sortedRecord(counters.scalingDowngrades),
            applicationTriggerDowngrades: sortedRecord(counters.applicationTriggerDowngrades),
            supportedRuleCount: dataset.supportedRuleCount,
            partialRuleCount: dataset.partialRuleCount,
            unknownRuleCount: dataset.unknownRuleCount,
        },
    };
}

export function assertCharactersProjectedForAndroidV1(characters: readonly Character[]): void {
    characters.forEach(character => {
        assertActiveSkillDetailsProjected(character.activeSkillDetails, `Character ${character.id}`);
        assertActiveSkillDetailsProjected(character.ezaActiveSkillDetails, `Character ${character.id} EZA`);
        character.transformations?.forEach(transformation => {
            assertActiveSkillDetailsProjected(
                transformation.activeSkillDetails,
                `Transformation ${transformation.id}`,
            );
        });
    });
}

export function assertTeamAnalysisProjectedForAndroidV1(dataset: TeamAnalysisDataset): void {
    if (dataset.stateCount !== dataset.states.length) {
        throw new Error("Android v1 Team Analysis state count does not match its states.");
    }
    dataset.states.forEach(state => {
        if (state.activeSkillActivationCondition !== undefined) {
            throw new Error(`Android v1 state ${state.stateKey} retains an Active Skill activation condition.`);
        }
        state.passive?.rules.forEach(rule => {
            assertConditionProjected(rule.condition, `${state.stateKey}/${rule.id}`);
            rule.effects.forEach((effect, index) => {
                assertPassiveEffectProjected(effect, `${state.stateKey}/${rule.id}/effect-${index}`);
            });
        });
        state.superAttacks?.forEach(attack => {
            assertConditionProjected(attack.condition.expression, `${state.stateKey}/${attack.id}`);
            attack.effects.forEach((effect, index) => {
                assertApplicationTriggerProjected(
                    effect.applicationTrigger,
                    `${state.stateKey}/${attack.id}/effect-${index}`,
                );
            });
        });
    });
}

function projectState(
    state: CharacterStateAnalysis,
    counters: MutableProjectionCounters,
): CharacterStateAnalysis {
    const projected = cloneJson(state);
    delete projected.activeSkillActivationCondition;
    return {
        ...projected,
        ...(state.passive ? { passive: projectPassive(state.passive, counters) } : {}),
        ...(state.superAttacks
            ? { superAttacks: state.superAttacks.map(attack => projectSuperAttack(attack, counters)) }
            : {}),
    };
}

function projectPassive(passive: ParsedPassive, counters: MutableProjectionCounters): ParsedPassive {
    const rules = passive.rules.map(rule => projectRule(rule, counters));
    const parseStatus = passive.parseStatus === "unknown"
        ? "unknown"
        : rules.some(rule => rule.parseStatus !== "supported")
            ? "partial"
            : passive.parseStatus;
    return { ...cloneJson(passive), rules, parseStatus };
}

function projectRule(rule: PassiveRule, counters: MutableProjectionCounters): PassiveRule {
    const condition = projectCondition(rule.condition, counters);
    const effects = rule.effects.map(effect => projectPassiveEffect(effect, counters));
    const conditionStatus: ParseStatus = condition.downgraded ? "unknown" : rule.conditionStatus;
    const effectStatus = effects.some(result => result.downgraded)
        ? downgradeStatus(rule.effectStatus)
        : rule.effectStatus;
    return {
        ...cloneJson(rule),
        condition: condition.expression,
        conditionStatus,
        effects: effects.map(result => result.effect),
        effectStatus,
        parseStatus: combinedRuleStatus(rule.parseStatus, conditionStatus, effectStatus),
    };
}

function projectSuperAttack(
    attack: ParsedSuperAttack,
    counters: MutableProjectionCounters,
): ParsedSuperAttack {
    const condition = projectCondition(attack.condition.expression, counters);
    const effects = attack.effects.map(effect => projectSuperAttackEffect(effect, counters));
    const conditionStatus: ParseStatus = condition.downgraded
        ? "unknown"
        : attack.condition.parseStatus;
    const effectStatus = effects.some(result => result.downgraded)
        ? downgradeStatus(attack.effectStatus)
        : attack.effectStatus;
    return {
        ...cloneJson(attack),
        condition: {
            ...cloneJson(attack.condition),
            expression: condition.expression,
            parseStatus: conditionStatus,
        },
        effects: effects.map(result => result.effect),
        effectStatus,
        parseStatus: combinedRuleStatus(attack.parseStatus, conditionStatus, effectStatus),
    };
}

function projectCondition(
    condition: ConditionExpression,
    counters: MutableProjectionCounters,
): ConditionProjection {
    switch (condition.op) {
        case "always":
        case "unknown":
            return { expression: cloneJson(condition), downgraded: false };
        case "not": {
            const child = projectCondition(condition.child, counters);
            return { expression: { op: "not", child: child.expression }, downgraded: child.downgraded };
        }
        case "all":
        case "any": {
            const children = condition.children.map(child => projectCondition(child, counters));
            return {
                expression: { op: condition.op, children: children.map(child => child.expression) },
                downgraded: children.some(child => child.downgraded),
            };
        }
        case "predicate": {
            const reason = unsupportedPredicateReason(condition.predicate);
            if (!reason) return { expression: cloneJson(condition), downgraded: false };
            increment(counters.conditionDowngrades, reason);
            return {
                expression: { op: "unknown", sourceText: condition.predicate.sourceText },
                downgraded: true,
            };
        }
    }
}

function unsupportedPredicateReason(predicate: PassivePredicate): string | undefined {
    if (!V1_PREDICATE_KINDS.has(predicate.kind)) return `predicate:${predicate.kind}`;
    if (predicate.evaluationMoment && !V1_EVALUATION_MOMENTS.has(predicate.evaluationMoment)) {
        return `evaluation_moment:${predicate.evaluationMoment}`;
    }
    const unsupportedSphereType = predicate.kiSphereTypes?.find(type => !V1_KI_SPHERE_TYPES.has(type));
    if (unsupportedSphereType) return `ki_sphere_type:${unsupportedSphereType}`;
    const combatEventReason = predicate.combatEvent
        ? unsupportedCombatEventReason(predicate.combatEvent)
        : undefined;
    return combatEventReason ? `combat_event:${combatEventReason}` : undefined;
}

function projectPassiveEffect(
    effect: PassiveEffect,
    counters: MutableProjectionCounters,
): EffectProjection<PassiveEffect> {
    const scaling = projectScaling(effect.scaling, counters);
    const trigger = projectApplicationTrigger(effect.applicationTrigger, counters);
    return {
        effect: {
            ...cloneJson(effect),
            ...(scaling.value ? { scaling: scaling.value } : {}),
            ...(trigger.value ? { applicationTrigger: trigger.value } : {}),
        },
        downgraded: scaling.downgraded || trigger.downgraded,
    };
}

function projectSuperAttackEffect(
    effect: SuperAttackEffect,
    counters: MutableProjectionCounters,
): EffectProjection<SuperAttackEffect> {
    const trigger = projectApplicationTrigger(effect.applicationTrigger, counters);
    return {
        effect: {
            ...cloneJson(effect),
            ...(trigger.value ? { applicationTrigger: trigger.value } : {}),
        },
        downgraded: trigger.downgraded,
    };
}

function projectScaling(
    scaling: PassiveEffectScaling | undefined,
    counters: MutableProjectionCounters,
): { value?: PassiveEffectScaling, downgraded: boolean } {
    if (!scaling) return { downgraded: false };
    let reason: string | undefined;
    if (scaling.kind === "per_ki_sphere") {
        const unsupportedType = scaling.kiSphereTypes.find(type => !V1_KI_SPHERE_TYPES.has(type));
        if (unsupportedType) reason = `per_ki_sphere:${unsupportedType}`;
    } else if (scaling.kind === "per_combat_event") {
        const eventReason = scaling.events.map(unsupportedCombatEventReason).find(Boolean);
        if (eventReason) reason = `per_combat_event:${eventReason}`;
    } else {
        reason = scaling.kind;
    }
    if (!reason) return { value: cloneJson(scaling), downgraded: false };
    increment(counters.scalingDowngrades, reason);
    return {
        value: { kind: "unknown" } as unknown as PassiveEffectScaling,
        downgraded: true,
    };
}

function projectApplicationTrigger(
    trigger: EffectApplicationTrigger | undefined,
    counters: MutableProjectionCounters,
): { value?: EffectApplicationTrigger, downgraded: boolean } {
    if (!trigger) return { downgraded: false };
    if (V1_APPLICATION_TRIGGERS.has(trigger.kind)) {
        return { value: cloneJson(trigger), downgraded: false };
    }
    increment(counters.applicationTriggerDowngrades, trigger.kind);
    return {
        value: { ...cloneJson(trigger), kind: "unknown" },
        downgraded: true,
    };
}

function unsupportedCombatEventReason(event: CombatEventDescriptor): string | undefined {
    if (!V1_COMBAT_EVENT_MODES.has(event.mode)) return `mode:${event.mode}`;
    if (!V1_COMBAT_EVENT_RELATIVE_TIMINGS.has(event.relativeTiming)) {
        return `relative_timing:${event.relativeTiming}`;
    }
    return undefined;
}

function assertActiveSkillDetailsProjected(
    details: readonly ActiveSkillDetails[] | undefined,
    label: string,
): void {
    details?.forEach(detail => {
        if (detail.activationCondition !== undefined) {
            throw new Error(`${label} Active Skill ${detail.id} retains a v2 activation condition.`);
        }
    });
}

function assertConditionProjected(condition: ConditionExpression, label: string): void {
    switch (condition.op) {
        case "always":
        case "unknown":
            return;
        case "not":
            assertConditionProjected(condition.child, label);
            return;
        case "all":
        case "any":
            condition.children.forEach(child => assertConditionProjected(child, label));
            return;
        case "predicate": {
            const reason = unsupportedPredicateReason(condition.predicate);
            if (reason) throw new Error(`Android v1 condition ${label} retains ${reason}.`);
        }
    }
}

function assertPassiveEffectProjected(effect: PassiveEffect, label: string): void {
    if (effect.scaling) {
        const kind = (effect.scaling as unknown as { kind: string }).kind;
        if (kind !== "unknown" && kind !== "per_ki_sphere" && kind !== "per_combat_event") {
            throw new Error(`Android v1 effect ${label} retains scaling ${kind}.`);
        }
        if (kind === "per_ki_sphere") {
            const scaling = effect.scaling as Extract<PassiveEffectScaling, { kind: "per_ki_sphere" }>;
            const unsupportedType = scaling.kiSphereTypes.find(type => !V1_KI_SPHERE_TYPES.has(type));
            if (unsupportedType) throw new Error(`Android v1 effect ${label} retains ${unsupportedType}.`);
        }
        if (kind === "per_combat_event") {
            const scaling = effect.scaling as Extract<PassiveEffectScaling, { kind: "per_combat_event" }>;
            const reason = scaling.events.map(unsupportedCombatEventReason).find(Boolean);
            if (reason) throw new Error(`Android v1 effect ${label} retains ${reason}.`);
        }
    }
    assertApplicationTriggerProjected(effect.applicationTrigger, label);
}

function assertApplicationTriggerProjected(
    trigger: EffectApplicationTrigger | undefined,
    label: string,
): void {
    if (trigger && !V1_APPLICATION_TRIGGERS.has(trigger.kind)) {
        throw new Error(`Android v1 effect ${label} retains application trigger ${trigger.kind}.`);
    }
}

function downgradeStatus(status: ParseStatus): ParseStatus {
    return status === "unknown" ? "unknown" : "partial";
}

function combinedRuleStatus(
    original: ParseStatus,
    condition: ParseStatus,
    effect: ParseStatus,
): ParseStatus {
    if (original === "unknown" || (condition === "unknown" && effect === "unknown")) return "unknown";
    if (original === "partial" || condition !== "supported" || effect !== "supported") return "partial";
    return "supported";
}

function increment(record: Record<string, number>, key: string): void {
    record[key] = (record[key] ?? 0) + 1;
}

function sortedRecord(record: Record<string, number>): Record<string, number> {
    return Object.fromEntries(Object.entries(record).sort(([left], [right]) => left.localeCompare(right)));
}

function cloneJson<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
}
