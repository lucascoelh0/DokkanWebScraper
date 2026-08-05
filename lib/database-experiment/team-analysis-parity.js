"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderDatabaseTeamAnalysisReport = exports.compareDatabaseTeamAnalysis = exports.readCurrentTeamAnalysis = void 0;
const crypto_1 = require("crypto");
const promises_1 = require("fs/promises");
const zlib_1 = require("zlib");
async function readCurrentTeamAnalysis(path) {
    const gzip = await (0, promises_1.readFile)(path);
    const dataset = JSON.parse((0, zlib_1.gunzipSync)(gzip).toString("utf8"));
    if (!Array.isArray(dataset.states) || dataset.stateCount !== dataset.states.length) {
        throw new Error(`Invalid current Team Analysis dataset: ${path}`);
    }
    return { dataset, sha256: (0, crypto_1.createHash)("sha256").update(gzip).digest("hex") };
}
exports.readCurrentTeamAnalysis = readCurrentTeamAnalysis;
function currentKinds(state) {
    return [...new Set((state.passive?.rules ?? [])
            .flatMap(rule => rule.effects ?? [])
            .map(effect => effect.kind)
            .filter((kind) => Boolean(kind) && kind !== "unknown"))].sort();
}
function databaseKinds(state) {
    return [...new Set((state.passive?.rules ?? [])
            .flatMap(rule => rule.effects)
            .map(effect => effect.kind.value)
            .filter(kind => kind !== "unknown"))].sort();
}
function difference(left, right) {
    const rightSet = new Set(right);
    return left.filter(value => !rightSet.has(value));
}
function compareDatabaseTeamAnalysis(database, current, siteAudit) {
    const currentByKey = new Map(current.states.map(state => [state.stateKey, state]));
    const aliases = new Map(siteAudit.formProjectionAliases.map(alias => [alias.databaseCardId, alias.projectedCardId]));
    const projectedKey = (state) => `${state.characterId}:${aliases.get(state.formId) ?? state.formId}:${state.releaseState}`;
    const exactDatabaseByKey = new Map(database.states.map(state => [state.stateKey, state]));
    const projectedDatabaseByKey = new Map(database.states.map(state => [projectedKey(state), state]));
    const exactMatched = database.states.filter(state => currentByKey.has(state.stateKey));
    const aliasMatched = database.states.filter(state => state.stateKey !== projectedKey(state) && currentByKey.has(projectedKey(state)));
    const matchedPairs = current.states.flatMap(currentState => {
        const databaseState = exactDatabaseByKey.get(currentState.stateKey) ?? projectedDatabaseByKey.get(currentState.stateKey);
        return databaseState ? [{ currentState, databaseState }] : [];
    });
    const allKinds = [...new Set([
            ...current.states.flatMap(currentKinds),
            ...database.states.flatMap(databaseKinds),
        ])].sort();
    const effectKindParity = Object.fromEntries(allKinds.map(kind => {
        const currentKeys = new Set(current.states.filter(state => currentKinds(state).includes(kind)).map(state => state.stateKey));
        const databaseKeys = new Set(database.states.filter(state => databaseKinds(state).includes(kind)).map(projectedKey));
        const matchedStateCount = [...currentKeys].filter(key => databaseKeys.has(key)).length;
        return [kind, {
                currentStateCount: currentKeys.size,
                databaseStateCount: databaseKeys.size,
                matchedStateCount,
                currentOnlyStateCount: [...currentKeys].filter(key => !databaseKeys.has(key)).length,
                databaseOnlyStateCount: [...databaseKeys].filter(key => !currentKeys.has(key)).length,
            }];
    }));
    const importantConflicts = matchedPairs.flatMap(({ currentState, databaseState }) => {
        const current = currentKinds(currentState);
        const db = databaseKinds(databaseState);
        const currentOnlyEffectKinds = difference(current, db);
        const databaseOnlyEffectKinds = difference(db, current);
        return currentOnlyEffectKinds.length || databaseOnlyEffectKinds.length ? [{
                stateKey: currentState.stateKey,
                databaseStateKey: databaseState.stateKey === currentState.stateKey ? undefined : databaseState.stateKey,
                currentOnlyEffectKinds,
                databaseOnlyEffectKinds,
            }] : [];
    }).sort((left, right) => (right.currentOnlyEffectKinds.length + right.databaseOnlyEffectKinds.length)
        - (left.currentOnlyEffectKinds.length + left.databaseOnlyEffectKinds.length)
        || left.stateKey.localeCompare(right.stateKey, "en", { numeric: true }))
        .slice(0, 40);
    return {
        schemaVersion: 1,
        currentStateCount: current.states.length,
        databaseStateCount: database.states.length,
        exactMatchedStateCount: exactMatched.length,
        auditedAliasMatchedStateCount: aliasMatched.length,
        currentStateKeysMissingInDatabase: current.states
            .filter(state => !projectedDatabaseByKey.has(state.stateKey))
            .map(state => state.stateKey)
            .sort((left, right) => left.localeCompare(right, "en", { numeric: true })),
        databaseStateKeysMissingInCurrent: database.states
            .filter(state => !currentByKey.has(projectedKey(state)))
            .map(state => state.stateKey)
            .sort((left, right) => left.localeCompare(right, "en", { numeric: true })),
        passiveStateCounts: {
            current: current.states.filter(state => state.passive).length,
            database: database.states.filter(state => state.passive).length,
            matched: matchedPairs.filter(pair => pair.currentState.passive && pair.databaseState.passive).length,
        },
        effectKindParity,
        importantConflicts,
    };
}
exports.compareDatabaseTeamAnalysis = compareDatabaseTeamAnalysis;
function percent(value, total) {
    return total === 0 ? "0.0%" : `${(value * 100 / total).toFixed(1)}%`;
}
function renderDatabaseTeamAnalysisReport(parity, coverage, currentParserVersion) {
    const effectRows = Object.entries(parity.effectKindParity).map(([kind, value]) => `| ${kind} | ${value.databaseStateCount} | ${value.currentStateCount} | ${value.matchedStateCount} | ${value.databaseOnlyStateCount} | ${value.currentOnlyStateCount} |`).join("\n");
    const conflicts = parity.importantConflicts.slice(0, 15).map(conflict => `- \`${conflict.stateKey}\`${conflict.databaseStateKey ? ` (DB raw \`${conflict.databaseStateKey}\`)` : ""}: DB-only [${conflict.databaseOnlyEffectKinds.join(", ") || "none"}]; current-only [${conflict.currentOnlyEffectKinds.join(", ") || "none"}].`).join("\n");
    const currentOnlyStates = parity.currentStateKeysMissingInDatabase.map(key => `- \`${key}\``).join("\n");
    const databaseOnlyStates = parity.databaseStateKeysMissingInCurrent.map(key => `- \`${key}\``).join("\n");
    return `# Database Team Analysis experiment — DB2\n\n` +
        `Generated from the read-only first-party SQLite snapshot. The comparison target is the current Team Analysis parser \`${currentParserVersion}\`.\n\n` +
        `## Outcome\n\n` +
        `- Database states: **${coverage.stateCount}**; current states: **${parity.currentStateCount}**.\n` +
        `- Exact state matches: **${parity.exactMatchedStateCount}**; audited form-alias matches: **${parity.auditedAliasMatchedStateCount}**.\n` +
        `- Passive rows with a confirmed effect mapping: **${coverage.mappedRuleCount}/${coverage.passiveRuleCount} (${percent(coverage.mappedRuleCount, coverage.passiveRuleCount)})**; partial: **${coverage.partialRuleCount}**; unknown: **${coverage.unknownRuleCount}**.\n` +
        `- Structured conditional rows retained without semantic reinterpretation: **${coverage.conditionalRuleCount}**; conditions projected to runtime AST: **0**.\n\n` +
        `DB2 proves that first-party relations can replace text parsing for the mapped effect families. It does not yet prove that first-party causalities can replace the production condition AST.\n\n` +
        `## State parity\n\n` +
        `- Current-only state keys: **${parity.currentStateKeysMissingInDatabase.length}**.\n` +
        `- Database-only state keys: **${parity.databaseStateKeysMissingInCurrent.length}**.\n` +
        `- Passive states (DB/current/matched): **${parity.passiveStateCounts.database}/${parity.passiveStateCounts.current}/${parity.passiveStateCounts.matched}**.\n\n` +
        `Nested forms use the current contract's \`initial\` compatibility label while retaining the actual first-party release state separately as \`sourceReleaseState\`.\n\n` +
        `### Current-only state keys\n\n${currentOnlyStates || "None."}\n\n` +
        `### Database-only state keys\n\n${databaseOnlyStates || "None."}\n\n` +
        `In this snapshot, \`1027621\` and \`1028161\` are a release-state delta: the current corpus still has \`initial\`, while the database exposes \`eza\`. The first-party-only cards \`1009010\`, \`1009020\`, and \`1032710\` also appear here, together with their available forms. Nine current-only base IDs are the already identified placeholder-stat records; remaining form-only differences require an explicit projection policy.\n\n` +
        `## Effect-family parity by state presence\n\n` +
        `| Effect | DB states | Current states | Matched | DB-only | Current-only |\n| --- | ---: | ---: | ---: | ---: | ---: |\n${effectRows}\n\n` +
        `This is state-level presence parity, not rule-count equivalence: one first-party row may encode multiple attempts or multiple stat effects, while the text parser may split the same mechanic into different clauses.\n\n` +
        `## Confirmed numeric enums\n\n` +
        `- Passive efficacy types: ${coverage.efficacyEnum.confirmed.map(String).join(", ") || "none"}.\n` +
        `- Passive target types: ${coverage.targetEnum.confirmed.map(String).join(", ") || "none"}.\n` +
        `- Ki Sphere types: 0=AGL, 1=TEQ, 2=INT, 3=STR, 4=PHY, 5=Rainbow for efficacy 51.\n\n` +
        `## Explicitly unknown\n\n` +
        `- Passive efficacy types still raw-only: ${coverage.efficacyEnum.unknown.map(String).join(", ") || "none"}.\n` +
        `- Passive target types still raw-only: ${coverage.targetEnum.unknown.map(String).join(", ") || "none"}.\n` +
        `- All causality types and execution-timing enums remain uninterpreted in this projector. Calculation options are retained raw; only effect-specific value encodings proven by joined rows are normalized.\n` +
        `- Non-empty sub-target sets remain first-party rows with provenance; category/name predicates are not guessed.\n\n` +
        `## Important conflicts\n\n${conflicts || "No mapped state-level effect conflicts."}\n\n` +
        `## First-party-only structure\n\n` +
        `The DB artifact retains passive set/relation/skill/effect IDs, raw timing/target/efficacy/calculation fields, activation and conversion probabilities, sub-target rows, compiled causality JSON, joined causality rows, and table/row provenance. The current text-derived dataset does not preserve all of these fields.\n\n` +
        `## Still requires site text or assets\n\n` +
        `Localized presentation text remains useful for display and conflict review. Icons, animations, audio, attack presentation assets, and semantics for unconfirmed enums are outside the SQLite projector. No asset was fetched or processed by DB2.\n`;
}
exports.renderDatabaseTeamAnalysisReport = renderDatabaseTeamAnalysisReport;
//# sourceMappingURL=team-analysis-parity.js.map