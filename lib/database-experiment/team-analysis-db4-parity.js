"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderDatabaseTeamAnalysisDb4Report = exports.compareDatabaseTeamAnalysisDb4 = void 0;
const team_analysis_db3_parity_1 = require("./team-analysis-db3-parity");
function object(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value) ? value : undefined;
}
function walkDatabaseCondition(expression, visit) {
    if (expression.op === "predicate")
        visit(expression.predicate.kind, (0, team_analysis_db3_parity_1.databasePredicateSignature)(expression));
    else if (expression.op === "all" || expression.op === "any")
        expression.children.forEach(child => walkDatabaseCondition(child, visit));
    else if (expression.op === "not")
        walkDatabaseCondition(expression.child, visit);
}
function walkCurrentCondition(value, visit) {
    const expression = object(value);
    if (!expression)
        return;
    if (expression.op === "predicate") {
        const predicate = object(expression.predicate);
        if (predicate && typeof predicate.kind === "string")
            visit(predicate.kind, (0, team_analysis_db3_parity_1.currentTeamAnalysisPredicateSignature)(predicate));
    }
    else if ((expression.op === "all" || expression.op === "any") && Array.isArray(expression.children)) {
        expression.children.forEach(child => walkCurrentCondition(child, visit));
    }
    else if (expression.op === "not")
        walkCurrentCondition(expression.child, visit);
}
function projectedSphereShape(projection) {
    if (projection.status !== "supported" || projection.effect.scaling.kind !== "per_ki_sphere_threshold_series")
        return undefined;
    const selected = projection.effect.scaling.kiSphereTypes ?? [];
    const semantic = selected.length === 1 && selected[0] === "any" ? "any"
        : selected.length === 1 && selected[0] === "non_rainbow" ? "non_rainbow" : "listed";
    const types = selected.filter((value) => value !== "any" && value !== "non_rainbow");
    const { scaling: _scaling, ...effect } = projection.effect;
    return {
        ...effect,
        scaling: {
            kind: "per_ki_sphere",
            selector: { rawMask: null, types, semantic, unknownMask: 0, evidence: "first-party-row-join" },
            spheresPerIncrement: 1,
        },
    };
}
function compareDatabaseTeamAnalysisDb4(database, current, siteAudit, db3Parity) {
    const aliases = new Map(siteAudit.formProjectionAliases.map(alias => [alias.databaseCardId, alias.projectedCardId]));
    const projectedKey = (state) => `${state.characterId}:${aliases.get(state.formId) ?? state.formId}:${state.releaseState}`;
    const currentByKey = new Map(current.states.map(state => [state.stateKey, state]));
    const normalizedDatabaseSignatures = new Set();
    const currentSignatures = new Set();
    const databasePredicateSignatures = new Set();
    const currentPredicateSignatures = new Set();
    const predicateStates = new Map();
    const projectionShapeMatchesByEffectKind = {};
    const examples = [];
    let matchedStateCount = 0;
    let projectionCount = 0;
    let currentShapeComparableProjectionCount = 0;
    let projectionCurrentShapeMatchCount = 0;
    for (const state of database.states) {
        const stateKey = projectedKey(state);
        const currentState = currentByKey.get(stateKey);
        if (!currentState)
            continue;
        matchedStateCount += 1;
        const currentEffects = currentState.passive?.rules?.flatMap(rule => rule.effects ?? []).filter(effect => effect.kind && effect.kind !== "unknown") ?? [];
        const currentStateSignatures = new Set(currentEffects.map(team_analysis_db3_parity_1.currentTeamAnalysisEffectSignature));
        currentStateSignatures.forEach(value => currentSignatures.add(`${stateKey}|${value}`));
        for (const rule of state.passive?.rules ?? [])
            walkDatabaseCondition(rule.condition, (kind, value) => {
                databasePredicateSignatures.add(`${stateKey}|${value}`);
                const states = predicateStates.get(kind) ?? { database: new Set(), current: new Set() };
                states.database.add(stateKey);
                predicateStates.set(kind, states);
            });
        for (const rule of currentState.passive?.rules ?? [])
            walkCurrentCondition(rule.condition, (kind, value) => {
                currentPredicateSignatures.add(`${stateKey}|${value}`);
                const states = predicateStates.get(kind) ?? { database: new Set(), current: new Set() };
                states.current.add(stateKey);
                predicateStates.set(kind, states);
            });
        for (const rule of state.passive?.rules ?? []) {
            for (const effect of rule.effects)
                if (effect.kind !== "unknown") {
                    normalizedDatabaseSignatures.add(`${stateKey}|${(0, team_analysis_db3_parity_1.databaseEffectSignature)(effect)}`);
                }
        }
        for (const projection of state.passive?.thresholdSeries ?? []) {
            projectionCount += 1;
            const bucket = projectionShapeMatchesByEffectKind[projection.effect.kind] ?? { projections: 0, shapeMatched: 0 };
            bucket.projections += 1;
            const effect = projectedSphereShape(projection);
            if (effect)
                currentShapeComparableProjectionCount += 1;
            const matchedCurrentShape = Boolean(effect && currentStateSignatures.has((0, team_analysis_db3_parity_1.databaseEffectSignature)(effect)));
            if (matchedCurrentShape) {
                bucket.shapeMatched += 1;
                projectionCurrentShapeMatchCount += 1;
            }
            projectionShapeMatchesByEffectKind[projection.effect.kind] = bucket;
            examples.push({
                stateKey,
                projectionKey: projection.projectionKey,
                effectKind: projection.effect.kind,
                thresholdCount: projection.effect.scaling.maxIncrements,
                matchedCurrentShape,
            });
        }
    }
    const normalizedExactEffectSignatures = [...normalizedDatabaseSignatures].filter(value => currentSignatures.has(value)).length;
    return {
        schemaVersion: 1,
        matchedStateCount,
        baselineExactEffectSignatures: db3Parity.exactEffectSignatureCount.matched,
        normalizedExactEffectSignatures,
        exactEffectSignatureDelta: normalizedExactEffectSignatures - db3Parity.exactEffectSignatureCount.matched,
        exactPredicateSignatures: {
            database: databasePredicateSignatures.size,
            current: currentPredicateSignatures.size,
            matched: [...databasePredicateSignatures].filter(value => currentPredicateSignatures.has(value)).length,
        },
        baselineExactPredicateMatches: db3Parity.exactPredicateSignatureCount.matched,
        exactPredicateMatchDelta: [...databasePredicateSignatures].filter(value => currentPredicateSignatures.has(value)).length - db3Parity.exactPredicateSignatureCount.matched,
        predicateKindParity: Object.fromEntries([...predicateStates.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([kind, states]) => [kind, {
                databaseStates: states.database.size,
                currentStates: states.current.size,
                matchedStates: [...states.database].filter(value => states.current.has(value)).length,
            }])),
        projectionCount,
        currentExactComparableProjectionCount: 0,
        projectionCurrentExactMatchCount: 0,
        currentShapeComparableProjectionCount,
        projectionCurrentShapeMatchCount,
        projectionShapeMatchesByEffectKind: Object.fromEntries(Object.entries(projectionShapeMatchesByEffectKind).sort(([left], [right]) => left.localeCompare(right))),
        examples: examples.sort((left, right) => Number(right.matchedCurrentShape) - Number(left.matchedCurrentShape)
            || left.stateKey.localeCompare(right.stateKey, "en", { numeric: true })
            || left.projectionKey.localeCompare(right.projectionKey, "en", { numeric: true })).slice(0, 60),
    };
}
exports.compareDatabaseTeamAnalysisDb4 = compareDatabaseTeamAnalysisDb4;
function percent(value, total) {
    return total === 0 ? "0.0%" : `${(value * 100 / total).toFixed(1)}%`;
}
function renderDatabaseTeamAnalysisDb4Report(coverage, parity, parserVersion) {
    const conditionTotal = Object.values(coverage.conditionStatusCounts).reduce((sum, value) => sum + value, 0);
    const seriesRows = Object.entries(coverage.thresholdSeriesByCausalityType).map(([type, count]) => `| ${type} | ${count} |`).join("\n");
    const effectRows = Object.entries(parity.projectionShapeMatchesByEffectKind).map(([kind, value]) => `| ${kind} | ${value.projections} | ${value.shapeMatched} |`).join("\n");
    const examples = parity.examples.slice(0, 15).map(value => `- \`${value.stateKey}\` / \`${value.projectionKey}\`: ${value.effectKind}, ${value.thresholdCount} thresholds, current ${value.matchedCurrentShape ? "shape match" : "no shape match"}.`).join("\n");
    return `# Database Team Analysis experiment — DB4\n\n` +
        `Compared with current parser \`${parserVersion}\`. DB4 preserves every DB3 rule and adds operator-aware conditions and provenance-backed threshold-series projections.\n\n` +
        `## Outcome\n\n` +
        `- States: **${coverage.stateCount}**; matched current states: **${parity.matchedStateCount}**.\n` +
        `- Conditions supported/partial/unknown: **${coverage.conditionStatusCounts.supported}/${coverage.conditionStatusCounts.partial}/${coverage.conditionStatusCounts.unknown}** (${percent(coverage.conditionStatusCounts.supported, conditionTotal)} supported).\n` +
        `- Parsed composite nodes: **${coverage.compositeConditionCounts.all} AND**, **${coverage.compositeConditionCounts.any} OR**; unknown operators: **${coverage.compositeConditionCounts.unknownOperator}**.\n` +
        `- Threshold series: **${coverage.thresholdSeriesCount}** (${coverage.thresholdSeriesStatusCounts.supported} supported, ${coverage.thresholdSeriesStatusCounts.partial} partial), absorbing **${coverage.absorbedSourceRuleCount}** source rules without deleting them.\n` +
        `- Exact normalized effect signatures: **${parity.normalizedExactEffectSignatures}**, delta **${parity.exactEffectSignatureDelta >= 0 ? "+" : ""}${parity.exactEffectSignatureDelta}** from DB3's ${parity.baselineExactEffectSignatures}.\n` +
        `- Exact predicate signatures DB/current/matched: **${parity.exactPredicateSignatures.database}/${parity.exactPredicateSignatures.current}/${parity.exactPredicateSignatures.matched}**, delta **+${parity.exactPredicateMatchDelta}** from DB3's ${parity.baselineExactPredicateMatches} matches.\n` +
        `- Exact-comparable capped projections: **0** because the current contract cannot represent \`maxIncrements\`. Diagnostic uncapped shape matches: **${parity.projectionCurrentShapeMatchCount}/${parity.currentShapeComparableProjectionCount}**; total structural projections: **${parity.projectionCount}**.\n\n` +
        `## Confirmed condition composition\n\n` +
        `The first-party compiled prefix JSON uses \`&\` for AND and \`|\` for OR, including recursive nesting. No current row contains \`!\`; it remains unknown. Causality 40 is mapped as after the character performs a Super Attack. Causality 34 is mapped only for joined team/rotation category-count rows; enemy scope and unresolved selectors remain unknown.\n\n` +
        `## Threshold series by causality\n\n| Causality | Series |\n| --- | ---: |\n${seriesRows}\n\n` +
        `A series is emitted only for direct siblings with identical set/effect/target/timing/calculation and selector tuple, thresholds exactly \`1..N\`, no duplicates and no competing same-effect threshold rows. Types 3 and 44 are never aggregated. Type 42 becomes capped per-Ki-Sphere scaling. Types 41/46 retain partial selector semantics.\n\n` +
        `## Projection shape parity by effect\n\n| Effect | Projections | Uncapped shape matches |\n| --- | ---: | ---: |\n${effectRows}\n\n` +
        `## Examples\n\n${examples || "None."}\n\n` +
        `## Remaining blockers\n\n` +
        `Causality 3 has non-universal Ki encoding; type 44 mixes event/count semantics; type 41's name-selector domain and type 46's class/type mask remain unresolved. Partial structural projections preserve raw selectors and provenance rather than inventing runtime predicates.\n`;
}
exports.renderDatabaseTeamAnalysisDb4Report = renderDatabaseTeamAnalysisDb4Report;
//# sourceMappingURL=team-analysis-db4-parity.js.map