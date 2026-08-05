"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateDatabaseTeamAnalysisDb10Goldens = exports.readDb10NativeSemantics = exports.parseDb10NativeSemantics = exports.resolveDb10NativeSemanticsPath = void 0;
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path_1 = require("path");
function sourcePath(fileName) {
    return (0, fs_1.existsSync)((0, path_1.resolve)(__dirname, fileName)) ? (0, path_1.resolve)(__dirname, fileName) : (0, path_1.resolve)(__dirname, "..", "..", "database-experiment", fileName);
}
function resolveDb10NativeSemanticsPath() { return sourcePath("native-runtime-semantics.json"); }
exports.resolveDb10NativeSemanticsPath = resolveDb10NativeSemanticsPath;
function parseDb10NativeSemantics(value) { return JSON.parse(value.toString()); }
exports.parseDb10NativeSemantics = parseDb10NativeSemantics;
async function readDb10NativeSemantics() { return parseDb10NativeSemantics(await (0, promises_1.readFile)(resolveDb10NativeSemanticsPath())); }
exports.readDb10NativeSemantics = readDb10NativeSemantics;
async function validateDatabaseTeamAnalysisDb10Goldens(dataset) {
    const parsed = JSON.parse(await (0, promises_1.readFile)(sourcePath("team-analysis-db10-golden-fixtures.json"), "utf8"));
    if (parsed.schemaVersion !== 1)
        throw new Error("Unsupported DB10 golden contract");
    const failures = [];
    for (const fixture of parsed.fixtures) {
        const value = dataset.causalityResolutions.find(candidate => candidate.causalityType === fixture.causalityType);
        const fail = (issue) => failures.push({ fixture: fixture.name, issue });
        if (!value) {
            fail("resolution missing");
            continue;
        }
        if (value.status !== fixture.status)
            fail(`expected status ${fixture.status}, got ${value.status}`);
        if (value.comparator !== fixture.comparator)
            fail(`expected comparator ${fixture.comparator}, got ${value.comparator}`);
        if (value.occurrenceCount !== fixture.occurrenceCount)
            fail(`expected ${fixture.occurrenceCount} occurrences, got ${value.occurrenceCount}`);
        if (JSON.stringify(value.parameterReads) !== JSON.stringify(fixture.parameterReads))
            fail("parameter reads differ");
        if (JSON.stringify(value.ignoredParameters) !== JSON.stringify(fixture.ignoredParameters))
            fail("ignored parameters differ");
        if (fixture.requiredUnknown && !value.unknowns.includes(fixture.requiredUnknown))
            fail(`missing unknown ${fixture.requiredUnknown}`);
        if (fixture.gate && value.gate !== fixture.gate)
            fail(`expected gate ${fixture.gate}, got ${value.gate}`);
        if (value.provenance.runtime.codeSha256.length !== 64)
            fail("runtime code hash missing");
    }
    if (dataset.semanticPromotionCount !== 3)
        failures.push({ fixture: "promotion invariant", issue: "semantic promotion count changed" });
    const fixtureCount = parsed.fixtures.length + 1;
    return { fixtureCount, passed: fixtureCount - failures.length, failures };
}
exports.validateDatabaseTeamAnalysisDb10Goldens = validateDatabaseTeamAnalysisDb10Goldens;
//# sourceMappingURL=team-analysis-db10-golden.js.map