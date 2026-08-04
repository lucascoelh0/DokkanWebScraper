"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runCombatRules = void 0;
const path_1 = require("path");
const combat_rules_1 = require("./combat-rules");
const combat_rules_artifacts_1 = require("./combat-rules-artifacts");
const DEFAULT_OUTPUT_DIR = "data/combat-rules/latest";
async function runCombatRules(options) {
    const dataset = (0, combat_rules_1.buildCombatRulesDataset)();
    (0, combat_rules_1.assertValidCombatRulesDataset)(dataset);
    const coverage = (0, combat_rules_1.buildCombatRulesCoverageReport)(dataset);
    const artifact = (0, combat_rules_artifacts_1.buildCombatRulesArtifact)(dataset);
    const issues = (0, combat_rules_artifacts_1.validateCombatRulesArtifact)(artifact, dataset);
    if (issues.length > 0) {
        throw new Error(`Combat rules artifact validation failed:\n${issues.join("\n")}`);
    }
    await (0, combat_rules_artifacts_1.writeCombatRulesBundle)(options.outputDir, artifact, coverage);
    return {
        datasetPath: (0, path_1.resolve)(options.outputDir, artifact.manifest.fileName),
        manifestPath: (0, path_1.resolve)(options.outputDir, "combat-rules-manifest.json"),
        coveragePath: (0, path_1.resolve)(options.outputDir, "combat-rules-coverage.json"),
        sizeBytes: artifact.manifest.sizeBytes,
        sha256: artifact.manifest.sha256,
        ruleCount: artifact.manifest.ruleCount,
        unresolvedRuleCount: artifact.manifest.unresolvedRuleCount,
    };
}
exports.runCombatRules = runCombatRules;
function parseArgs(argv) {
    let outputDir = DEFAULT_OUTPUT_DIR;
    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];
        if (token.startsWith("--output-dir=")) {
            outputDir = token.slice("--output-dir=".length);
            continue;
        }
        if (token === "--output-dir") {
            const value = argv[index + 1];
            if (!value || value.startsWith("--"))
                throw new Error("Missing value for --output-dir.");
            outputDir = value;
            index += 1;
            continue;
        }
        throw new Error(`Unexpected argument: ${token}`);
    }
    return { outputDir: (0, path_1.resolve)(outputDir) };
}
async function main() {
    console.log(JSON.stringify(await runCombatRules(parseArgs(process.argv.slice(2))), null, 2));
}
if (require.main === module) {
    main().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
//# sourceMappingURL=combat-rules-run.js.map