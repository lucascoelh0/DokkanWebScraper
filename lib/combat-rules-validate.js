"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateCombatRulesBundle = void 0;
const promises_1 = require("fs/promises");
const path_1 = require("path");
const combat_rules_1 = require("./combat-rules");
const combat_rules_artifacts_1 = require("./combat-rules-artifacts");
const DEFAULT_OUTPUT_DIR = "data/combat-rules/latest";
async function validateCombatRulesBundle(outputDir) {
    const resolved = (0, path_1.resolve)(outputDir);
    const [payload, manifestText, coverageText] = await Promise.all([
        (0, promises_1.readFile)((0, path_1.resolve)(resolved, "combat-rules.json")),
        (0, promises_1.readFile)((0, path_1.resolve)(resolved, "combat-rules-manifest.json"), "utf8"),
        (0, promises_1.readFile)((0, path_1.resolve)(resolved, "combat-rules-coverage.json"), "utf8"),
    ]);
    const dataset = JSON.parse(payload.toString("utf8"));
    const manifest = JSON.parse(manifestText);
    const coverage = JSON.parse(coverageText);
    (0, combat_rules_1.assertValidCombatRulesDataset)(dataset);
    const issues = [];
    issues.push(...(0, combat_rules_artifacts_1.validateCombatRulesManifest)(manifest, dataset, payload));
    const expectedCoverage = (0, combat_rules_1.buildCombatRulesCoverageReport)(dataset);
    if (JSON.stringify(coverage) !== JSON.stringify(expectedCoverage))
        issues.push("Coverage does not match combat-rules.json.");
    return issues;
}
exports.validateCombatRulesBundle = validateCombatRulesBundle;
async function main() {
    const outputDir = process.argv[2] ? (0, path_1.resolve)(process.argv[2]) : (0, path_1.resolve)(DEFAULT_OUTPUT_DIR);
    const issues = await validateCombatRulesBundle(outputDir);
    if (issues.length > 0)
        throw new Error(`Combat rules bundle validation failed:\n${issues.join("\n")}`);
    console.log(JSON.stringify({ outputDir, valid: true }, null, 2));
}
if (require.main === module) {
    main().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
//# sourceMappingURL=combat-rules-validate.js.map