import { readFile } from "fs/promises";
import { resolve } from "path";
import {
    assertValidCombatRulesDataset,
    buildCombatRulesCoverageReport,
    CombatRulesCoverageReport,
    CombatRulesDataset,
} from "./combat-rules";
import {
    CombatRulesManifest,
    validateCombatRulesManifest,
} from "./combat-rules-artifacts";

const DEFAULT_OUTPUT_DIR = "data/combat-rules/latest";

export async function validateCombatRulesBundle(outputDir: string): Promise<string[]> {
    const resolved = resolve(outputDir);
    const [payload, manifestText, coverageText] = await Promise.all([
        readFile(resolve(resolved, "combat-rules.json")),
        readFile(resolve(resolved, "combat-rules-manifest.json"), "utf8"),
        readFile(resolve(resolved, "combat-rules-coverage.json"), "utf8"),
    ]);
    const dataset = JSON.parse(payload.toString("utf8")) as CombatRulesDataset;
    const manifest = JSON.parse(manifestText) as CombatRulesManifest;
    const coverage = JSON.parse(coverageText) as CombatRulesCoverageReport;
    assertValidCombatRulesDataset(dataset);
    const issues: string[] = [];
    issues.push(...validateCombatRulesManifest(manifest, dataset, payload));
    const expectedCoverage = buildCombatRulesCoverageReport(dataset);
    if (JSON.stringify(coverage) !== JSON.stringify(expectedCoverage)) issues.push("Coverage does not match combat-rules.json.");
    return issues;
}

async function main(): Promise<void> {
    const outputDir = process.argv[2] ? resolve(process.argv[2]) : resolve(DEFAULT_OUTPUT_DIR);
    const issues = await validateCombatRulesBundle(outputDir);
    if (issues.length > 0) throw new Error(`Combat rules bundle validation failed:\n${issues.join("\n")}`);
    console.log(JSON.stringify({ outputDir, valid: true }, null, 2));
}

if (require.main === module) {
    main().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
