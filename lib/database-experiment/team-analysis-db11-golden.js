"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateDatabaseTeamAnalysisDb11Goldens = void 0;
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path_1 = require("path");
function containsUnknown(expression, id, type) {
    if (expression.op === "unknown")
        return expression.causalityId === id && Number(expression.causalityType) === type;
    if (expression.op === "all" || expression.op === "any")
        return expression.children.some(child => containsUnknown(child, id, type));
    return expression.op === "not" ? containsUnknown(expression.child, id, type) : false;
}
async function validateDatabaseTeamAnalysisDb11Goldens(dataset) {
    const path = (0, fs_1.existsSync)((0, path_1.resolve)(__dirname, "team-analysis-db11-golden-fixtures.json")) ? (0, path_1.resolve)(__dirname, "team-analysis-db11-golden-fixtures.json") : (0, path_1.resolve)(__dirname, "..", "..", "database-experiment", "team-analysis-db11-golden-fixtures.json");
    const parsed = JSON.parse(await (0, promises_1.readFile)(path, "utf8"));
    if (parsed.schemaVersion !== 1)
        throw new Error("Unsupported DB11 golden contract");
    const failures = [];
    const fail = (fixture, issue) => failures.push({ fixture, issue });
    for (const fixture of parsed.projections) {
        const state = dataset.states.find(value => value.stateKey === fixture.stateKey);
        const value = state?.passive?.rules.flatMap(rule => rule.runtimeConditions).find(candidate => candidate.causalityId === fixture.causalityId && candidate.causalityType === fixture.causalityType);
        if (!value) {
            fail(fixture.name, "projection missing");
            continue;
        }
        const predicate = value.predicate;
        for (const key of ["kind", "eventMode", "comparator", "value", "nativeComparator", "nativeThreshold"])
            if (fixture[key] !== undefined && predicate[key] !== fixture[key])
                fail(fixture.name, `expected ${key}=${fixture[key]}, got ${predicate[key]}`);
        if (value.provenance.database.rowId !== fixture.causalityId || value.provenance.runtime.codeSha256.length !== 64)
            fail(fixture.name, "provenance mismatch");
    }
    const unknownState = dataset.states.find(value => value.stateKey === parsed.unknown.stateKey);
    const remainsUnknown = unknownState?.passive?.rules.some(rule => containsUnknown(rule.condition, parsed.unknown.causalityId, parsed.unknown.causalityType)) ?? false;
    if (!remainsUnknown)
        fail(parsed.unknown.name, "type 3 was removed or promoted");
    const runtimeCount = dataset.states.reduce((sum, state) => sum + (state.passive?.rules.reduce((ruleSum, rule) => ruleSum + rule.runtimeConditions.length, 0) ?? 0), 0);
    if (runtimeCount !== 901)
        fail("promotion count", `expected 901 runtime predicates, got ${runtimeCount}`);
    const fixtureCount = parsed.projections.length + 2;
    return { fixtureCount, passed: fixtureCount - failures.length, failures };
}
exports.validateDatabaseTeamAnalysisDb11Goldens = validateDatabaseTeamAnalysisDb11Goldens;
//# sourceMappingURL=team-analysis-db11-golden.js.map