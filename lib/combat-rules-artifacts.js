"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sha256 = exports.writeCombatRulesBundle = exports.validateCombatRulesManifest = exports.validateCombatRulesArtifact = exports.buildCombatRulesArtifact = void 0;
const crypto_1 = require("crypto");
const promises_1 = require("fs/promises");
const path_1 = require("path");
function buildCombatRulesArtifact(dataset) {
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
exports.buildCombatRulesArtifact = buildCombatRulesArtifact;
function validateCombatRulesArtifact(artifact, dataset) {
    const issues = [];
    const expectedText = `${JSON.stringify(dataset, null, 2)}\n`;
    if (artifact.jsonText !== expectedText || !artifact.payloadBuffer.equals(Buffer.from(expectedText, "utf8"))) {
        issues.push("Artifact payload bytes do not match the canonical dataset serialization.");
    }
    issues.push(...validateCombatRulesManifest(artifact.manifest, dataset, artifact.payloadBuffer));
    return issues;
}
exports.validateCombatRulesArtifact = validateCombatRulesArtifact;
function validateCombatRulesManifest(manifest, dataset, payloadBuffer) {
    const issues = [];
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
exports.validateCombatRulesManifest = validateCombatRulesManifest;
async function writeCombatRulesBundle(outputDir, artifact, coverage) {
    const resolvedOutputDir = (0, path_1.resolve)(outputDir);
    await (0, promises_1.mkdir)(resolvedOutputDir, { recursive: true });
    await (0, promises_1.writeFile)((0, path_1.resolve)(resolvedOutputDir, artifact.manifest.fileName), artifact.payloadBuffer);
    await (0, promises_1.writeFile)((0, path_1.resolve)(resolvedOutputDir, "combat-rules-manifest.json"), `${JSON.stringify(artifact.manifest, null, 2)}\n`, "utf8");
    await (0, promises_1.writeFile)((0, path_1.resolve)(resolvedOutputDir, "combat-rules-coverage.json"), `${JSON.stringify(coverage, null, 2)}\n`, "utf8");
}
exports.writeCombatRulesBundle = writeCombatRulesBundle;
function sha256(value) {
    return (0, crypto_1.createHash)("sha256").update(value).digest("hex");
}
exports.sha256 = sha256;
//# sourceMappingURL=combat-rules-artifacts.js.map