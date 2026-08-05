"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateDatabaseTeamAnalysisDb9Goldens = exports.readDb9NativeLayout = exports.resolveDb9NativeLayoutPath = void 0;
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path_1 = require("path");
function resolveDb9NativeLayoutPath() {
    return (0, fs_1.existsSync)((0, path_1.resolve)(__dirname, "native-runtime-layout.json")) ? (0, path_1.resolve)(__dirname, "native-runtime-layout.json") : (0, path_1.resolve)(__dirname, "..", "..", "database-experiment", "native-runtime-layout.json");
}
exports.resolveDb9NativeLayoutPath = resolveDb9NativeLayoutPath;
async function readDb9NativeLayout() {
    return JSON.parse(await (0, promises_1.readFile)(resolveDb9NativeLayoutPath(), "utf8"));
}
exports.readDb9NativeLayout = readDb9NativeLayout;
async function validateDatabaseTeamAnalysisDb9Goldens(dataset) {
    const path = (0, fs_1.existsSync)((0, path_1.resolve)(__dirname, "team-analysis-db9-golden-fixtures.json")) ? (0, path_1.resolve)(__dirname, "team-analysis-db9-golden-fixtures.json") : (0, path_1.resolve)(__dirname, "..", "..", "database-experiment", "team-analysis-db9-golden-fixtures.json");
    const parsed = JSON.parse(await (0, promises_1.readFile)(path, "utf8"));
    if (parsed.schemaVersion !== 1)
        throw new Error("Unsupported DB9 golden contract");
    const failures = [];
    const check = (kind, fixture, slots) => {
        const slot = slots[fixture.enumValue];
        const name = `${kind}:${fixture.enumValue}`;
        if (!slot)
            failures.push({ fixture: name, issue: "slot missing" });
        else {
            if (slot.status !== fixture.status)
                failures.push({ fixture: name, issue: `expected ${fixture.status}, got ${slot.status}` });
            if (fixture.label && slot.minimumOperationLabel !== fixture.label)
                failures.push({ fixture: name, issue: `expected label ${fixture.label}, got ${slot.minimumOperationLabel}` });
            if (slot.slotVma % 8 !== 0)
                failures.push({ fixture: name, issue: "slot VMA is not aligned" });
        }
    };
    parsed.efficacy.forEach(value => check("efficacy", value, dataset.efficacyDispatchSlots));
    parsed.causality.forEach(value => check("causality", value, dataset.causalityDispatchSlots));
    const fixtureCount = parsed.efficacy.length + parsed.causality.length;
    return { fixtureCount, passed: fixtureCount - failures.length, failures };
}
exports.validateDatabaseTeamAnalysisDb9Goldens = validateDatabaseTeamAnalysisDb9Goldens;
//# sourceMappingURL=team-analysis-db9-golden.js.map