import { resolve } from "path";
import {
    assertValidCombatRulesDataset,
    buildCombatRulesCoverageReport,
    buildCombatRulesDataset,
} from "./combat-rules";
import {
    buildCombatRulesArtifact,
    validateCombatRulesArtifact,
    writeCombatRulesBundle,
} from "./combat-rules-artifacts";

const DEFAULT_OUTPUT_DIR = "data/combat-rules/latest";

export interface CombatRulesRunOptions {
    outputDir: string;
}

export async function runCombatRules(options: CombatRulesRunOptions): Promise<{
    datasetPath: string;
    manifestPath: string;
    coveragePath: string;
    sizeBytes: number;
    sha256: string;
    ruleCount: number;
    unresolvedRuleCount: number;
}> {
    const dataset = buildCombatRulesDataset();
    assertValidCombatRulesDataset(dataset);
    const coverage = buildCombatRulesCoverageReport(dataset);
    const artifact = buildCombatRulesArtifact(dataset);
    const issues = validateCombatRulesArtifact(artifact, dataset);
    if (issues.length > 0) {
        throw new Error(`Combat rules artifact validation failed:\n${issues.join("\n")}`);
    }
    await writeCombatRulesBundle(options.outputDir, artifact, coverage);
    return {
        datasetPath: resolve(options.outputDir, artifact.manifest.fileName),
        manifestPath: resolve(options.outputDir, "combat-rules-manifest.json"),
        coveragePath: resolve(options.outputDir, "combat-rules-coverage.json"),
        sizeBytes: artifact.manifest.sizeBytes,
        sha256: artifact.manifest.sha256,
        ruleCount: artifact.manifest.ruleCount,
        unresolvedRuleCount: artifact.manifest.unresolvedRuleCount,
    };
}

function parseArgs(argv: string[]): CombatRulesRunOptions {
    let outputDir = DEFAULT_OUTPUT_DIR;
    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];
        if (token.startsWith("--output-dir=")) {
            outputDir = token.slice("--output-dir=".length);
            continue;
        }
        if (token === "--output-dir") {
            const value = argv[index + 1];
            if (!value || value.startsWith("--")) throw new Error("Missing value for --output-dir.");
            outputDir = value;
            index += 1;
            continue;
        }
        throw new Error(`Unexpected argument: ${token}`);
    }
    return { outputDir: resolve(outputDir) };
}

async function main(): Promise<void> {
    console.log(JSON.stringify(await runCombatRules(parseArgs(process.argv.slice(2))), null, 2));
}

if (require.main === module) {
    main().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
