import { createHash } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import { resolve } from "path";
import { gunzipSync, gzipSync } from "zlib";
import { Character } from "../character";
import { TeamAnalysisDataset } from "../team-analysis";
import { TeamAnalysisManifest } from "../team-analysis-artifacts";
import { buildIntegrationC3Coverage, buildIntegrationC3Dataset } from "./integration-c3-builder";
import { IntegrationC2Dataset, IntegrationC2Manifest } from "./integration-c2-contract";
import { IntegrationC3Manifest } from "./integration-c3-contract";
import { validateIntegrationC3Dataset } from "./integration-c3-validator";

const DEFAULT_EXPERIMENT = resolve(process.cwd(), "data", "database-experiment");
const DEFAULT_PRODUCTION = resolve("D:/Dokkan/DokkanWebScraper/data/fyi-characters/latest");
const sha256 = (value: Buffer | string) => createHash("sha256").update(value).digest("hex");

interface CharacterManifest { schemaVersion: number; datasetVersion: string; fileName: string; sha256: string; sizeBytes: number; uncompressedSizeBytes: number; characterCount: number }
async function readVerifiedGzip<T>(directory: string, manifest: { fileName: string; sha256: string; sizeBytes: number; uncompressedSizeBytes: number }): Promise<{ value: T; gzip: Buffer }> {
    const gzip = await readFile(resolve(directory, manifest.fileName)); if (sha256(gzip) !== manifest.sha256 || gzip.byteLength !== manifest.sizeBytes) throw Error(`C3 artifact identity ${manifest.fileName}`);
    const json = gunzipSync(gzip); if (json.byteLength !== manifest.uncompressedSizeBytes) throw Error(`C3 artifact size ${manifest.fileName}`); return { value: JSON.parse(json.toString("utf8")) as T, gzip };
}

function report(dataset: ReturnType<typeof buildIntegrationC3Dataset>, coverage: ReturnType<typeof buildIntegrationC3Coverage>): string {
    const examples = (classification: string) => dataset.records.filter(value => value.classification === classification).slice(0, 5).map(value => `- \`${value.identity.effectKey}\` — ${value.reason}`).join("\n") || "- none";
    return `# Integration C3 — structural shadow parity\n\n## Boundary\n\nThe join is exclusively by first-party structural \`stateKey\`. The production parser has no first-party passive-skill, rule, or effect identity, so an effect representation can agree but cannot establish rule identity. The parser is comparison input, never authority.\n\n## Coverage\n\n- rules: ${coverage.ruleCount}\n- sidecar states: ${coverage.sidecarStateCount}\n- joined states: ${coverage.joinedStateCount}\n- unjoinable states: ${coverage.unjoinableStateCount}\n- agreement: ${coverage.classificationCounts.agreement}\n- representation gain: ${coverage.classificationCounts.representation_gain}\n- unknown: ${coverage.classificationCounts.unknown}\n- confirmed conflict: ${coverage.classificationCounts.confirmed_conflict}\n\n## Classification rules\n\n- \`agreement\`: at least one exact kind/value/unit/structurally comparable target representation in the joined state.\n- \`representation_gain\`: joined state, but the production contract has no comparable effect kind.\n- \`unknown\`: comparable kind exists, but structural target or common rule identity is insufficient to prove a conflict.\n- \`unjoinable\`: the production snapshot has no identical state key.\n- \`confirmed_conflict\`: deliberately unavailable until both sources share a first-party rule/effect identity.\n\n## Representative gains\n\n${examples("representation_gain")}\n\n## Unknown comparisons\n\n${examples("unknown")}\n\n## Unjoinable records\n\n${examples("unjoinable")}\n\n## Real structural fixtures\n\n${dataset.goldenFixtures.map(value => `- ${value.kind}: \`${value.stateKey}\`${value.transformationSource ? ` via \`${value.transformationSource}\`` : ""}`).join("\n")}\n`;
}

export async function runIntegrationC3(options: { inputDir?: string; productionDir?: string; outputDir?: string } = {}) {
    const inputDir = options.inputDir ?? DEFAULT_EXPERIMENT, productionDir = options.productionDir ?? DEFAULT_PRODUCTION, outputDir = options.outputDir ?? DEFAULT_EXPERIMENT;
    const c2Manifest = JSON.parse(await readFile(resolve(inputDir, "team-analysis-database-first-supported-c2-manifest.json"), "utf8")) as IntegrationC2Manifest;
    const teamManifest = JSON.parse(await readFile(resolve(productionDir, "team-analysis-manifest.json"), "utf8")) as TeamAnalysisManifest;
    const characterManifest = JSON.parse(await readFile(resolve(productionDir, "characters-manifest.json"), "utf8")) as CharacterManifest;
    const c2Artifact = await readVerifiedGzip<IntegrationC2Dataset>(inputDir, c2Manifest), teamArtifact = await readVerifiedGzip<TeamAnalysisDataset>(productionDir, teamManifest), characterArtifact = await readVerifiedGzip<Character[]>(productionDir, characterManifest);
    if (c2Manifest.schemaVersion !== 1 || c2Manifest.contractVersion !== "1.0.0" || c2Artifact.value.contract !== "dokkan-team-analysis-database-first-supported-sidecar" || c2Artifact.value.contractVersion !== "1.0.0" || c2Artifact.value.rules.length !== c2Manifest.ruleCount) throw Error("C3 C2 contract identity");
    if (teamArtifact.value.schemaVersion !== teamManifest.schemaVersion || teamArtifact.value.parserVersion !== teamManifest.parserVersion || teamArtifact.value.rulesVersion !== teamManifest.rulesVersion || teamArtifact.value.states.length !== teamManifest.stateCount || characterArtifact.value.length !== characterManifest.characterCount) throw Error("C3 production contract identity");
    if (teamManifest.sourceCharacterPayloadSha256 !== characterManifest.sha256 || teamArtifact.value.sourceCharacterPayloadSha256 !== characterManifest.sha256) throw Error("C3 production Team Analysis/character join identity");
    const meta = { fileName: teamManifest.fileName, sha256: teamManifest.sha256, datasetVersion: teamManifest.datasetVersion, parserVersion: teamManifest.parserVersion }, characterMeta = { fileName: characterManifest.fileName, sha256: characterManifest.sha256, datasetVersion: characterManifest.datasetVersion };
    const build = () => buildIntegrationC3Dataset(c2Artifact.value, c2Manifest.sha256, teamArtifact.value, meta, characterMeta), dataset = build(), firstJson = `${JSON.stringify(dataset)}\n`, secondJson = `${JSON.stringify(build())}\n`, firstGzip = gzipSync(Buffer.from(firstJson), { level: 9 }), secondGzip = gzipSync(Buffer.from(secondJson), { level: 9 });
    if (sha256(firstJson) !== sha256(secondJson) || !firstGzip.equals(secondGzip)) throw Error("C3 deterministic rebuild failed");
    const metadata = { production: meta, characters: characterMeta };
    const validation = validateIntegrationC3Dataset(dataset, c2Artifact.value, c2Manifest.sha256, teamArtifact.value, characterArtifact.value, metadata); if (!validation.valid) throw Error(`C3 validation failed ${JSON.stringify(validation.failures.slice(0, 10))}`);
    const mutate = (): ReturnType<typeof build> => JSON.parse(JSON.stringify(dataset));
    const mutations = [mutate(), mutate(), mutate(), mutate(), mutate()];
    mutations[0].records[0].classification = "confirmed_conflict";
    (mutations[1].records[0].databaseFirstRule.supported.valueUnit as any).mutation = true;
    mutations[2].goldenFixtures[0].formId = "0";
    mutations[3].sourceProductionTeamAnalysis.sha256 = "0".repeat(64);
    mutations[4].goldenFixtures.pop();
    validation.mutationRejectionCount = mutations.filter(value => !validateIntegrationC3Dataset(value, c2Artifact.value, c2Manifest.sha256, teamArtifact.value, characterArtifact.value, metadata).valid).length;
    if (validation.mutationRejectionCount !== mutations.length) throw Error("C3 mutation evidence validation failed");
    const coverage = buildIntegrationC3Coverage(dataset); if (coverage.classificationCounts.confirmed_conflict !== 0 || coverage.joinedStateCount + coverage.unjoinableStateCount !== coverage.sidecarStateCount) throw Error("C3 conservative coverage invariant");
    const manifest: IntegrationC3Manifest = { schemaVersion: 1, contractVersion: "1.0.0", generatedAt: dataset.generatedAt, fileName: "team-analysis-database-first-shadow-c3.json.gz", compression: "gzip", sha256: sha256(firstGzip), sizeBytes: firstGzip.byteLength, uncompressedSizeBytes: Buffer.byteLength(firstJson), ruleCount: dataset.records.length, stateCount: coverage.sidecarStateCount, sourceSupportedSidecarSha256: c2Manifest.sha256, sourceProductionTeamAnalysisSha256: teamManifest.sha256, coverageFile: "team-analysis-database-first-shadow-c3-coverage.json", validationFile: "team-analysis-database-first-shadow-c3-validation.json", reportFile: "team-analysis-database-first-shadow-c3-report.md" };
    await mkdir(outputDir, { recursive: true }); await Promise.all([writeFile(resolve(outputDir, manifest.fileName), firstGzip), writeFile(resolve(outputDir, "team-analysis-database-first-shadow-c3-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`), writeFile(resolve(outputDir, manifest.coverageFile), `${JSON.stringify(coverage, null, 2)}\n`), writeFile(resolve(outputDir, manifest.validationFile), `${JSON.stringify(validation, null, 2)}\n`), writeFile(resolve(outputDir, manifest.reportFile), report(dataset, coverage))]);
    return { manifest, coverage, validation, deterministicJsonSha256: sha256(secondJson), peakWorkingSetBytes: process.resourceUsage().maxRSS * 1024 };
}
if (require.main === module) runIntegrationC3().then(value => console.log(JSON.stringify(value, null, 2))).catch(error => { console.error(error); process.exitCode = 1; });
