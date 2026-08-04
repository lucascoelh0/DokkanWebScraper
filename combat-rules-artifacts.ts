import { createHash } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import { resolve } from "path";
import {
    CombatRulesCoverageReport,
    CombatRulesDataset,
    CombatRulesVersionRange,
} from "./combat-rules";

export interface CombatRulesManifest {
    schemaVersion: number;
    combatRulesVersion: string;
    datasetVersion: string;
    generatedAt: string;
    fileName: "combat-rules.json";
    compression: "none";
    sha256: string;
    sizeBytes: number;
    ruleCount: number;
    unresolvedRuleCount: number;
    compatibleTeamAnalysisSchemaVersion: number;
    compatibleTeamAnalysisRulesVersionRange: CombatRulesVersionRange;
    minimumTeamAnalysisParserVersion: string;
    requiredTeamAnalysisCapabilities: string[];
    evidencePolicyVersion: string;
}

export interface CombatRulesArtifact {
    jsonText: string;
    payloadBuffer: Buffer;
    manifest: CombatRulesManifest;
}

export function buildCombatRulesArtifact(dataset: CombatRulesDataset): CombatRulesArtifact {
    const jsonText = `${JSON.stringify(dataset, null, 2)}\n`;
    const payloadBuffer = Buffer.from(jsonText, "utf8");
    return {
        jsonText,
        payloadBuffer,
        manifest: {
            schemaVersion: dataset.schemaVersion,
            combatRulesVersion: dataset.combatRulesVersion,
            datasetVersion: `combat-rules-${dataset.combatRulesVersion}`,
            generatedAt: dataset.generatedAt,
            fileName: "combat-rules.json",
            compression: "none",
            sha256: sha256(payloadBuffer),
            sizeBytes: payloadBuffer.byteLength,
            ruleCount: dataset.rules.length,
            unresolvedRuleCount: dataset.unresolvedRules.length,
            compatibleTeamAnalysisSchemaVersion: dataset.compatibleTeamAnalysisSchemaVersion,
            compatibleTeamAnalysisRulesVersionRange: { ...dataset.compatibleTeamAnalysisRulesVersionRange },
            minimumTeamAnalysisParserVersion: dataset.minimumTeamAnalysisParserVersion,
            requiredTeamAnalysisCapabilities: [...dataset.requiredTeamAnalysisCapabilities],
            evidencePolicyVersion: dataset.evidencePolicyVersion,
        },
    };
}

export function validateCombatRulesArtifact(
    artifact: CombatRulesArtifact,
    dataset: CombatRulesDataset,
): string[] {
    const issues: string[] = [];
    const expectedText = `${JSON.stringify(dataset, null, 2)}\n`;
    if (artifact.jsonText !== expectedText || !artifact.payloadBuffer.equals(Buffer.from(expectedText, "utf8"))) {
        issues.push("Artifact payload bytes do not match the canonical dataset serialization.");
    }
    issues.push(...validateCombatRulesManifest(artifact.manifest, dataset, artifact.payloadBuffer));
    return issues;
}

export function validateCombatRulesManifest(
    manifest: CombatRulesManifest,
    dataset: CombatRulesDataset,
    payloadBuffer: Buffer,
): string[] {
    const issues: string[] = [];
    if (manifest.fileName !== "combat-rules.json" || manifest.compression !== "none") {
        issues.push("Manifest file name or compression is unsupported.");
    }
    if (manifest.datasetVersion !== `combat-rules-${dataset.combatRulesVersion}`
        || manifest.generatedAt !== dataset.generatedAt) {
        issues.push("Manifest dataset identity does not match the dataset.");
    }
    if (manifest.sha256 !== sha256(payloadBuffer)) {
        issues.push("Manifest SHA-256 does not match combat-rules.json.");
    }
    if (manifest.sizeBytes !== payloadBuffer.byteLength) {
        issues.push("Manifest size does not match combat-rules.json.");
    }
    if (manifest.schemaVersion !== dataset.schemaVersion
        || manifest.combatRulesVersion !== dataset.combatRulesVersion
        || manifest.evidencePolicyVersion !== dataset.evidencePolicyVersion) {
        issues.push("Manifest contract versions do not match the dataset.");
    }
    if (manifest.compatibleTeamAnalysisSchemaVersion !== dataset.compatibleTeamAnalysisSchemaVersion
        || manifest.compatibleTeamAnalysisRulesVersionRange.minInclusive !== dataset.compatibleTeamAnalysisRulesVersionRange.minInclusive
        || manifest.compatibleTeamAnalysisRulesVersionRange.maxInclusive !== dataset.compatibleTeamAnalysisRulesVersionRange.maxInclusive
        || manifest.minimumTeamAnalysisParserVersion !== dataset.minimumTeamAnalysisParserVersion
        || JSON.stringify(manifest.requiredTeamAnalysisCapabilities) !== JSON.stringify(dataset.requiredTeamAnalysisCapabilities)) {
        issues.push("Manifest Team Analysis compatibility does not match the dataset.");
    }
    if (manifest.ruleCount !== dataset.rules.length
        || manifest.unresolvedRuleCount !== dataset.unresolvedRules.length) {
        issues.push("Manifest rule counts do not match the dataset.");
    }
    return issues;
}

export async function writeCombatRulesBundle(
    outputDir: string,
    artifact: CombatRulesArtifact,
    coverage: CombatRulesCoverageReport,
): Promise<void> {
    const resolvedOutputDir = resolve(outputDir);
    await mkdir(resolvedOutputDir, { recursive: true });
    await writeFile(resolve(resolvedOutputDir, artifact.manifest.fileName), artifact.payloadBuffer);
    await writeFile(resolve(resolvedOutputDir, "combat-rules-manifest.json"), `${JSON.stringify(artifact.manifest, null, 2)}\n`, "utf8");
    await writeFile(resolve(resolvedOutputDir, "combat-rules-coverage.json"), `${JSON.stringify(coverage, null, 2)}\n`, "utf8");
}

export function sha256(value: Buffer): string {
    return createHash("sha256").update(value).digest("hex");
}
