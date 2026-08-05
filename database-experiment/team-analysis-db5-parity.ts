import { SiteAuditFixtures } from "./parity";
import { databaseEffectSignature, currentTeamAnalysisEffectSignature } from "./team-analysis-db3-parity";
import { CurrentTeamAnalysisDataset } from "./team-analysis-parity";
import { DatabaseTeamAnalysisDb5Coverage, DatabaseTeamAnalysisDb5Dataset, DatabaseTeamAnalysisDb5Parity, Db5CapComparison, Db5CountedScalingProjection, Db5CountedSubject } from "./team-analysis-db5-contract";

type JsonObject = Record<string, unknown>;

function object(value: unknown): JsonObject | undefined {
    return value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : undefined;
}

function strings(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").slice().sort() : [];
}

function databaseBaseEffectSignature(projection: Db5CountedScalingProjection): string {
    const { scaling: _scaling, stackCap: _stackCap, ...effect } = projection.effect;
    return databaseEffectSignature(effect);
}

function currentBaseEffectSignature(effect: JsonObject): string {
    const copy = { ...effect };
    delete copy.scaling;
    delete copy.stackCap;
    return currentTeamAnalysisEffectSignature(copy);
}

function sameStrings(left: string[], right: string[]): boolean {
    return JSON.stringify(left.slice().sort()) === JSON.stringify(right.slice().sort());
}

function currentPredicateMatches(subject: Db5CountedSubject, predicate: JsonObject): boolean {
    if (subject.kind === "name_match_token") return false;
    if (subject.status !== "supported") return false;
    if (subject.kind === "ki_sphere") return false;
    const kind = predicate.kind;
    if (subject.kind === "category") {
        const validKind = subject.scope === "team" ? kind === "ally_category_present"
            : subject.scope === "rotation" ? kind === "rotation_partner_category" : kind === "enemy_category";
        return validKind && subject.categoryName !== undefined && strings(predicate.categories).includes(subject.categoryName);
    }
    const classKind = subject.scope === "enemy" ? "enemy_class" : "ally_class_present";
    const typeKind = subject.scope === "enemy" ? "enemy_type" : "ally_type_present";
    const scopeMatches = predicate.scope === subject.scope;
    if (!scopeMatches) return false;
    if (subject.classes.length > 0 && subject.types.length === 0) return kind === classKind && sameStrings(strings(predicate.classes), subject.classes);
    if (subject.types.length > 0 && subject.classes.length === 0) return kind === typeKind && sameStrings(strings(predicate.types), subject.types);
    return false;
}

function walkPredicates(value: unknown, visit: (predicate: JsonObject) => void): void {
    const expression = object(value);
    if (!expression) return;
    if (expression.op === "predicate") {
        const predicate = object(expression.predicate);
        if (predicate) visit(predicate);
    }
    if (Array.isArray(expression.children)) expression.children.forEach(child => walkPredicates(child, visit));
    if (expression.child) walkPredicates(expression.child, visit);
}

function sphereSelectorMatches(subject: Extract<Db5CountedSubject, { kind: "ki_sphere" }>, effect: JsonObject): boolean {
    const scaling = object(effect.scaling);
    return scaling?.kind === "per_ki_sphere" && sameStrings(strings(scaling.kiSphereTypes), subject.kiSphereTypes);
}

function effectScope(effect: JsonObject): unknown {
    return object(effect.target)?.scope;
}

function currentTargetSignature(effect: JsonObject): string {
    const target = object(effect.target);
    return JSON.stringify({
        scope: target?.scope,
        selfInclusion: target?.selfInclusion,
        categories: strings(effect.categories),
        classes: strings(effect.classes),
        types: strings(effect.types),
    });
}

function currentCalculationBucketSignature(effect: JsonObject): string | undefined {
    const bucket = object(effect.calculationBucket);
    return typeof bucket?.bucket === "string" && bucket.bucket !== "unresolved"
        ? JSON.stringify({ bucket: bucket.bucket, source: bucket.source }) : undefined;
}

function capComparison(projection: Db5CountedScalingProjection, currentEffects: JsonObject[], matchingEffects: JsonObject[]): { comparison: Db5CapComparison, caps: number[] } {
    if (matchingEffects.length === 0) return { comparison: "no_base_effect_shape", caps: [] };
    const caps = [...new Set(matchingEffects.map(effect => effect.stackCap).filter((value): value is number => typeof value === "number"))].sort((left, right) => left - right);
    if (caps.length === 0) return { comparison: "no_structured_cap", caps };
    const observed = projection.effect.scaling.observedMaximumContribution;
    if (observed === undefined) return { comparison: "mismatch", caps };
    if (caps.includes(observed)) return { comparison: "exact_observed_contribution", caps };
    const hasStructuredBaseCandidate = matchingEffects.some(matchingEffect => {
        const matchingBucket = currentCalculationBucketSignature(matchingEffect);
        return typeof matchingEffect.stackCap === "number" && matchingBucket !== undefined && currentEffects.some(effect =>
            effect !== matchingEffect
            && effect.kind === projection.effect.kind
            && effect.unit === projection.effect.unit
            && effectScope(effect) === projection.effect.target.scope
            && currentTargetSignature(effect) === currentTargetSignature(matchingEffect)
            && currentCalculationBucketSignature(effect) === matchingBucket
            && typeof effect.value === "number"
            && effect.value === (matchingEffect.stackCap as number) - observed,
        );
    });
    return { comparison: hasStructuredBaseCandidate ? "candidate_observed_plus_structured_base" : "mismatch", caps };
}

export function compareDatabaseTeamAnalysisDb5(
    database: DatabaseTeamAnalysisDb5Dataset,
    current: CurrentTeamAnalysisDataset,
    siteAudit: SiteAuditFixtures,
): DatabaseTeamAnalysisDb5Parity {
    const aliases = new Map(siteAudit.formProjectionAliases.map(alias => [alias.databaseCardId, alias.projectedCardId]));
    const projectedKey = (state: DatabaseTeamAnalysisDb5Dataset["states"][number]) => `${state.characterId}:${aliases.get(state.formId) ?? state.formId}:${state.releaseState}`;
    const currentByKey = new Map(current.states.map(state => [state.stateKey, state]));
    const capComparisonCounts: Record<Db5CapComparison, number> = {
        exact_observed_contribution: 0,
        candidate_observed_plus_structured_base: 0,
        mismatch: 0,
        no_structured_cap: 0,
        no_base_effect_shape: 0,
    };
    const selectorParityByKind: DatabaseTeamAnalysisDb5Parity["selectorParityByKind"] = {};
    const examples: DatabaseTeamAnalysisDb5Parity["examples"] = [];
    let matchedStateCount = 0; let projectionCount = 0; let currentBaseEffectShapeMatchCount = 0;
    let currentUnknownConditionShapeMatchCount = 0; let currentStructuredSelectorMatchCount = 0;
    for (const state of database.states) {
        const stateKey = projectedKey(state);
        const currentState = currentByKey.get(stateKey);
        if (!currentState) continue;
        matchedStateCount += 1;
        const currentRules = currentState.passive?.rules ?? [];
        const currentEffects = currentRules.flatMap(rule => rule.effects ?? []) as JsonObject[];
        for (const projection of state.passive?.countedScaling ?? []) {
            projectionCount += 1;
            const baseSignature = databaseBaseEffectSignature(projection);
            const matchingRules = currentRules.filter(rule => (rule.effects ?? []).some(effect => currentBaseEffectSignature(effect) === baseSignature));
            const matchingEffects = matchingRules.flatMap(rule => rule.effects ?? []).filter(effect => currentBaseEffectSignature(effect) === baseSignature) as JsonObject[];
            const baseEffectShapeMatched = matchingEffects.length > 0;
            if (baseEffectShapeMatched) currentBaseEffectShapeMatchCount += 1;
            const currentCondition = matchingRules.some(rule => {
                if (projection.effect.scaling.subject.kind === "ki_sphere") {
                    return (rule.effects ?? []).some(effect => sphereSelectorMatches(projection.effect.scaling.subject as Extract<Db5CountedSubject, { kind: "ki_sphere" }>, effect));
                }
                let matched = false;
                walkPredicates(rule.condition, predicate => { if (currentPredicateMatches(projection.effect.scaling.subject, predicate)) matched = true; });
                return matched;
            }) ? "structured_selector_match" as const
                : matchingRules.some(rule => object(rule.condition)?.op === "unknown") ? "unknown" as const : "other_or_missing" as const;
            if (currentCondition === "structured_selector_match") currentStructuredSelectorMatchCount += 1;
            if (currentCondition === "unknown") currentUnknownConditionShapeMatchCount += 1;
            const cap = capComparison(projection, currentEffects, matchingEffects);
            capComparisonCounts[cap.comparison] += 1;
            const selectorKind = projection.effect.scaling.subject.kind;
            const bucket = selectorParityByKind[selectorKind] ?? { projections: 0, baseEffectShapeMatched: 0, structuredSelectorMatched: 0 };
            bucket.projections += 1;
            if (baseEffectShapeMatched) bucket.baseEffectShapeMatched += 1;
            if (currentCondition === "structured_selector_match") bucket.structuredSelectorMatched += 1;
            selectorParityByKind[selectorKind] = bucket;
            examples.push({
                stateKey,
                projectionKey: projection.projectionKey,
                selectorKind,
                effectKind: projection.effect.kind,
                observedSeriesLength: projection.effect.scaling.observedSeriesLength,
                ...(projection.effect.scaling.observedMaximumContribution === undefined ? {} : { observedMaximumContribution: projection.effect.scaling.observedMaximumContribution }),
                currentStackCaps: cap.caps,
                baseEffectShapeMatched,
                currentCondition,
                capComparison: cap.comparison,
            });
        }
    }
    return {
        schemaVersion: 1,
        matchedStateCount,
        projectionCount,
        currentBaseEffectShapeMatchCount,
        currentUnknownConditionShapeMatchCount,
        currentStructuredSelectorMatchCount,
        capComparisonCounts,
        selectorParityByKind: Object.fromEntries(Object.entries(selectorParityByKind).sort(([left], [right]) => left.localeCompare(right))),
        examples: examples.sort((left, right) => Number(right.baseEffectShapeMatched) - Number(left.baseEffectShapeMatched)
            || left.capComparison.localeCompare(right.capComparison)
            || left.stateKey.localeCompare(right.stateKey, "en", { numeric: true })
            || left.projectionKey.localeCompare(right.projectionKey, "en", { numeric: true })).slice(0, 80),
    };
}

function percent(value: number, total: number): string {
    return total === 0 ? "0.0%" : `${(value * 100 / total).toFixed(1)}%`;
}

export function renderDatabaseTeamAnalysisDb5Report(coverage: DatabaseTeamAnalysisDb5Coverage, parity: DatabaseTeamAnalysisDb5Parity, parserVersion: string): string {
    const selectorRows = Object.entries(parity.selectorParityByKind).map(([kind, value]) =>
        `| ${kind} | ${value.projections} | ${value.baseEffectShapeMatched} | ${value.structuredSelectorMatched} |`,
    ).join("\n");
    const capRows = Object.entries(parity.capComparisonCounts).map(([kind, count]) => `| ${kind} | ${count} |`).join("\n");
    const examples = parity.examples.filter(value => value.capComparison === "mismatch" || value.currentCondition === "unknown")
        .sort((left, right) => Number(right.capComparison === "mismatch") - Number(left.capComparison === "mismatch")
            || left.stateKey.localeCompare(right.stateKey, "en", { numeric: true }))
        .slice(0, 15).map(value =>
        `- \`${value.stateKey}\` / \`${value.projectionKey}\`: ${value.selectorKind}, ${value.effectKind}, observed ${value.observedSeriesLength} increments${value.observedMaximumContribution === undefined ? "" : ` / ${value.observedMaximumContribution} contribution`}; current caps [${value.currentStackCaps.join(", ") || "none"}], ${value.capComparison}, condition ${value.currentCondition}.`,
    ).join("\n");
    return `# Database Team Analysis experiment — DB5\n\n` +
        `Compared with current parser \`${parserVersion}\`. DB5 preserves DB4 and adds a safer counted-subject projection: the \`1..N\` boundary is observed structure, never asserted as a first-party semantic cap.\n\n` +
        `## Outcome\n\n` +
        `- States: **${coverage.stateCount}**; matched current states: **${parity.matchedStateCount}**.\n` +
        `- Counted projections: **${coverage.projectionCount}**; supported/partial/unknown: **${coverage.projectionStatusCounts.supported}/${coverage.projectionStatusCounts.partial}/${coverage.projectionStatusCounts.unknown}**.\n` +
        `- Base effect-shape matches in current: **${parity.currentBaseEffectShapeMatchCount}/${parity.projectionCount} (${percent(parity.currentBaseEffectShapeMatchCount, parity.projectionCount)})**.\n` +
        `- Matches whose current condition is still unknown: **${parity.currentUnknownConditionShapeMatchCount}**; structured selector matches: **${parity.currentStructuredSelectorMatchCount}**.\n` +
        `- Fully decoded type-46 class/type-mask projections: **${coverage.classTypeMaskCounts.fullyDecoded}**; partial: **${coverage.classTypeMaskCounts.partiallyDecoded}**; unknown: **${coverage.classTypeMaskCounts.unknown}**.\n` +
        `- Proven semantic caps from the first-party series: **0**. Observed maximum contribution is available for **${coverage.projectionsWithObservedMaximumContribution}** projections and is compared diagnostically with current structured \`stackCap\`.\n\n` +
        `## Selector parity\n\n| Selector | Projections | Base effect shape | Structured selector |\n| --- | ---: | ---: | ---: |\n${selectorRows}\n\n` +
        `## Structured cap diagnostics\n\n| Comparison | Count |\n| --- | ---: |\n${capRows}\n\n` +
        `\`candidate_observed_plus_structured_base\` requires the same current kind, unit, complete target shape and calculation bucket, with a second structured value completing the cap. It remains diagnostic parity because separate current rules do not prove one first-party calculation.\n\n` +
        `## Confirmed enums and conservative unknowns\n\n` +
        `- Causality 41: scope 0=team, 1=enemy, 2=rotation; \`cau_val3\` is minimum count; \`cau_val2\` is a name-includes token. The token dictionary/localized name remains unavailable, so tokens stay raw and partial.\n` +
        `- Causality 46: the same scope/count roles; bits 4=INT, 8=STR, 16=PHY, 32=Super Class and 64=Extreme Class are confirmed. Bits 1/2 and 131072..2097152 remain explicitly unknown.\n` +
        `- No raw passive text is parsed or regex-reinterpreted by DB5. Current text-derived fields are read only as already structured comparator input.\n\n` +
        `## Important examples\n\n${examples || "None."}\n\n` +
        `## Gate assessment\n\n` +
        `DB5 strengthens the database-first case for counted class/category/Ki-Sphere mechanics and exposes current parser unknowns. It does not remove the Team Analysis NO-GO: unresolved name tokens, partial type masks, causality 44 and calculation-bucket equivalence still require DB6 evidence.\n`;
}
