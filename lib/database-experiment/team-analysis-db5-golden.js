"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateDatabaseTeamAnalysisDb5Goldens = void 0;
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path_1 = require("path");
async function validateDatabaseTeamAnalysisDb5Goldens(dataset) {
    const fixturePath = (0, fs_1.existsSync)((0, path_1.resolve)(__dirname, "team-analysis-db5-golden-fixtures.json"))
        ? (0, path_1.resolve)(__dirname, "team-analysis-db5-golden-fixtures.json")
        : (0, path_1.resolve)(__dirname, "..", "..", "database-experiment", "team-analysis-db5-golden-fixtures.json");
    const parsed = JSON.parse(await (0, promises_1.readFile)(fixturePath, "utf8"));
    if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.projections))
        throw new Error("Unsupported DB5 golden fixture contract");
    const failures = [];
    const check = (fixture, field, actual, expected) => {
        if (JSON.stringify(actual) !== JSON.stringify(expected))
            failures.push({ fixture, issue: `${field}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}` });
    };
    for (const fixture of parsed.projections) {
        const state = dataset.states.find(value => value.stateKey === fixture.stateKey);
        const projection = state?.passive?.countedScaling.find(value => value.projectionKey === fixture.projectionKey);
        if (!projection) {
            failures.push({ fixture: fixture.name, issue: "missing exact state/projection join" });
            continue;
        }
        const scaling = projection.effect.scaling;
        const subject = scaling.subject;
        check(fixture.name, "status", projection.status, fixture.status);
        check(fixture.name, "selectorKind", subject.kind, fixture.selectorKind);
        check(fixture.name, "observedSeriesLength", scaling.observedSeriesLength, fixture.observedSeriesLength);
        check(fixture.name, "observedMaximumContribution", scaling.observedMaximumContribution, fixture.observedMaximumContribution);
        check(fixture.name, "semanticCap", scaling.semanticCap, { status: "unknown", value: null, reason: "series_boundary_is_not_a_proven_semantic_cap" });
        if (fixture.scope)
            check(fixture.name, "scope", "scope" in subject ? subject.scope : undefined, fixture.scope);
        if (fixture.categoryName)
            check(fixture.name, "categoryName", subject.kind === "category" ? subject.categoryName : undefined, fixture.categoryName);
        if (fixture.token !== undefined)
            check(fixture.name, "token", subject.kind === "name_match_token" ? subject.token : undefined, fixture.token);
        if (fixture.rawMask !== undefined)
            check(fixture.name, "rawMask", subject.kind === "class_type_mask" ? subject.rawMask : undefined, fixture.rawMask);
        if (fixture.classes)
            check(fixture.name, "classes", subject.kind === "class_type_mask" ? subject.classes : undefined, fixture.classes);
        if (fixture.types)
            check(fixture.name, "types", subject.kind === "class_type_mask" ? subject.types : undefined, fixture.types);
        if (fixture.unknownMask !== undefined)
            check(fixture.name, "unknownMask", subject.kind === "class_type_mask" ? subject.unknownMask : undefined, fixture.unknownMask);
        if (fixture.unknown)
            check(fixture.name, "unknown", projection.unknowns.includes(fixture.unknown), true);
    }
    return { fixtureCount: parsed.projections.length, passed: parsed.projections.length - failures.length, failures };
}
exports.validateDatabaseTeamAnalysisDb5Goldens = validateDatabaseTeamAnalysisDb5Goldens;
//# sourceMappingURL=team-analysis-db5-golden.js.map