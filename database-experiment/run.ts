import { createHash } from "crypto";
import { createReadStream } from "fs";
import { mkdir, stat, writeFile } from "fs/promises";
import { basename, resolve } from "path";
import { gzipSync } from "zlib";
import { buildCoverage, buildDatabaseExperimentDataset, CONSUMED_TABLE_COLUMNS, loadDatabaseExperimentTables } from "./builder";
import { DatabaseExperimentArtifactManifest, DatabaseExperimentSourceManifest } from "./contract";
import { compareWithCurrentDataset, readCurrentCharacters, readSiteAuditFixtures, renderParityReport } from "./parity";
import { ReadOnlySqliteAdapter } from "./sqlite-readonly-adapter";
import { validateGoldenFixtures } from "./golden";
import { buildDatabaseTeamAnalysisCoverage, buildDatabaseTeamAnalysisDataset } from "./team-analysis-builder";
import { DatabaseTeamAnalysisArtifactManifest } from "./team-analysis-contract";
import { validateDatabaseTeamAnalysisGoldens } from "./team-analysis-golden";
import { compareDatabaseTeamAnalysis, readCurrentTeamAnalysis, renderDatabaseTeamAnalysisReport } from "./team-analysis-parity";
import { buildDatabaseTeamAnalysisDb3Coverage, buildDatabaseTeamAnalysisDb3Dataset } from "./team-analysis-db3-builder";
import { DatabaseTeamAnalysisDb3ArtifactManifest } from "./team-analysis-db3-contract";
import { validateDatabaseTeamAnalysisDb3Goldens } from "./team-analysis-db3-golden";
import { compareDatabaseTeamAnalysisDb3, renderDatabaseTeamAnalysisDb3Report } from "./team-analysis-db3-parity";
import { buildDatabaseTeamAnalysisDb4Coverage, buildDatabaseTeamAnalysisDb4Dataset } from "./team-analysis-db4-builder";
import { DatabaseTeamAnalysisDb4ArtifactManifest } from "./team-analysis-db4-contract";
import { validateDatabaseTeamAnalysisDb4Goldens } from "./team-analysis-db4-golden";
import { compareDatabaseTeamAnalysisDb4, renderDatabaseTeamAnalysisDb4Report } from "./team-analysis-db4-parity";

const DEFAULT_DATABASE = "D:\\Dokkan\\database\\decrypted\\dokkan-global-current.db";
const DEFAULT_CURRENT_DATASET = "D:\\Dokkan\\DokkanWebScraper\\data\\fyi-characters\\latest\\characters.json.gz";
const DEFAULT_CURRENT_TEAM_ANALYSIS = "D:\\Dokkan\\DokkanWebScraper\\data\\fyi-characters\\latest\\team-analysis.json.gz";
const DEFAULT_OUTPUT = resolve(process.cwd(), "data", "database-experiment");
const DEFAULT_GENERATED_AT = "2026-08-05T00:00:00.000Z";
const DEFAULT_RELEASE_CUTOFF = "2026-08-05 23:59:59";

interface RunOptions {
    databasePath: string,
    currentDatasetPath: string,
    currentTeamAnalysisPath: string,
    outputDir: string,
    generatedAt: string,
    releaseCutoff: string,
    snapshotVersion: string,
    appVersion: string,
    versionCode: number,
    snapshotDate: string,
}

function parseArgs(argv: string[]): RunOptions {
    const values = new Map<string, string>();
    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];
        if (!token.startsWith("--")) throw new Error(`Unexpected argument: ${token}`);
        const [name, inline] = token.split("=", 2);
        const value = inline ?? argv[++index];
        if (!value) throw new Error(`Missing value for ${name}`);
        values.set(name, value);
    }
    return {
        databasePath: resolve(values.get("--database") ?? DEFAULT_DATABASE),
        currentDatasetPath: resolve(values.get("--current-dataset") ?? DEFAULT_CURRENT_DATASET),
        currentTeamAnalysisPath: resolve(values.get("--current-team-analysis") ?? DEFAULT_CURRENT_TEAM_ANALYSIS),
        outputDir: resolve(values.get("--output-dir") ?? DEFAULT_OUTPUT),
        generatedAt: values.get("--generated-at") ?? DEFAULT_GENERATED_AT,
        releaseCutoff: values.get("--release-cutoff") ?? DEFAULT_RELEASE_CUTOFF,
        snapshotVersion: values.get("--snapshot-version") ?? "global-6.4.0-v338-2026-08-05",
        appVersion: values.get("--app-version") ?? "6.4.0",
        versionCode: Number(values.get("--version-code") ?? "338"),
        snapshotDate: values.get("--snapshot-date") ?? "2026-08-05",
    };
}

async function sha256File(path: string): Promise<string> {
    return new Promise<string>((resolvePromise, rejectPromise) => {
        const hash = createHash("sha256");
        const stream = createReadStream(path);
        stream.on("data", chunk => hash.update(chunk));
        stream.on("error", rejectPromise);
        stream.on("end", () => resolvePromise(hash.digest("hex")));
    });
}

async function fingerprint(path: string) {
    const fileStat = await stat(path);
    return { sizeBytes: fileStat.size, sha256: await sha256File(path), modifiedAtMs: fileStat.mtimeMs };
}

function sha256(value: Buffer | string): string {
    return createHash("sha256").update(value).digest("hex");
}

export async function runDatabaseExperiment(options: RunOptions): Promise<{
    manifest: DatabaseExperimentArtifactManifest,
    sourceManifest: DatabaseExperimentSourceManifest,
    teamAnalysisManifest: DatabaseTeamAnalysisArtifactManifest,
    teamAnalysisDb3Manifest: DatabaseTeamAnalysisDb3ArtifactManifest,
    teamAnalysisDb4Manifest: DatabaseTeamAnalysisDb4ArtifactManifest,
    outputDir: string,
    deterministicRebuildSha256: string,
}> {
    const before = await fingerprint(options.databasePath);
    const adapter = new ReadOnlySqliteAdapter(options.databasePath);
    const inspection = await adapter.inspect();
    const tableByName = new Map(inspection.tables.map(table => [table.name, table]));
    for (const [table, columns] of Object.entries(CONSUMED_TABLE_COLUMNS)) {
        const inspected = tableByName.get(table);
        if (!inspected) throw new Error(`Required first-party table is missing: ${table}`);
        const missing = columns.filter(column => !inspected.columns.includes(column));
        if (missing.length > 0) throw new Error(`Required columns missing from ${table}: ${missing.join(", ")}`);
    }
    const tables = await loadDatabaseExperimentTables(adapter);
    const build = () => buildDatabaseExperimentDataset({
        tables,
        generatedAt: options.generatedAt,
        sourceSnapshotVersion: options.snapshotVersion,
        sourceSha256: before.sha256,
        releasedAtOrBefore: options.releaseCutoff,
    });
    const dataset = build();
    const firstJson = `${JSON.stringify(dataset)}\n`;
    const secondJson = `${JSON.stringify(build())}\n`;
    if (sha256(firstJson) !== sha256(secondJson)) throw new Error("Determinism check failed: two builds from identical rows differ");
    const gzip = gzipSync(Buffer.from(firstJson, "utf8"), { level: 9 });
    const secondGzip = gzipSync(Buffer.from(secondJson, "utf8"), { level: 9 });
    if (!gzip.equals(secondGzip)) throw new Error("Determinism check failed: gzip bytes differ");

    const coverage = buildCoverage(dataset);
    const goldenValidation = await validateGoldenFixtures(dataset);
    if (goldenValidation.failures.length > 0) {
        throw new Error(`Golden fixture validation failed: ${JSON.stringify(goldenValidation.failures)}`);
    }
    const currentCharacters = await readCurrentCharacters(options.currentDatasetPath);
    const siteAudit = await readSiteAuditFixtures();
    const parity = compareWithCurrentDataset(dataset, currentCharacters, siteAudit);
    const parityReport = renderParityReport(parity, coverage, siteAudit);
    const compatibilityPrimaryCardIds = siteAudit.entries
        .filter(entry => entry.finding === "collection-cards-omission")
        .map(entry => entry.cardId);
    const buildTeamAnalysis = () => buildDatabaseTeamAnalysisDataset({
        characterDataset: dataset,
        tables,
        generatedAt: options.generatedAt,
        auditedCompatibilityCardIds: compatibilityPrimaryCardIds,
    });
    const teamAnalysisDataset = buildTeamAnalysis();
    const firstTeamAnalysisJson = `${JSON.stringify(teamAnalysisDataset)}\n`;
    const secondTeamAnalysisJson = `${JSON.stringify(buildTeamAnalysis())}\n`;
    if (sha256(firstTeamAnalysisJson) !== sha256(secondTeamAnalysisJson)) {
        throw new Error("DB2 determinism check failed: two Team Analysis projections differ");
    }
    const teamAnalysisGzip = gzipSync(Buffer.from(firstTeamAnalysisJson, "utf8"), { level: 9 });
    const secondTeamAnalysisGzip = gzipSync(Buffer.from(secondTeamAnalysisJson, "utf8"), { level: 9 });
    if (!teamAnalysisGzip.equals(secondTeamAnalysisGzip)) throw new Error("DB2 determinism check failed: gzip bytes differ");
    const teamAnalysisCoverage = buildDatabaseTeamAnalysisCoverage(teamAnalysisDataset);
    const teamAnalysisGoldens = await validateDatabaseTeamAnalysisGoldens(tables);
    if (teamAnalysisGoldens.failures.length > 0) {
        throw new Error(`DB2 golden fixture validation failed: ${JSON.stringify(teamAnalysisGoldens.failures)}`);
    }
    const currentTeamAnalysis = await readCurrentTeamAnalysis(options.currentTeamAnalysisPath);
    const teamAnalysisParity = compareDatabaseTeamAnalysis(teamAnalysisDataset, currentTeamAnalysis.dataset, siteAudit);
    const teamAnalysisReport = renderDatabaseTeamAnalysisReport(teamAnalysisParity, teamAnalysisCoverage, currentTeamAnalysis.dataset.parserVersion);
    const buildTeamAnalysisDb3 = () => buildDatabaseTeamAnalysisDb3Dataset({ db2: teamAnalysisDataset, tables });
    const teamAnalysisDb3Dataset = buildTeamAnalysisDb3();
    const firstTeamAnalysisDb3Json = `${JSON.stringify(teamAnalysisDb3Dataset)}\n`;
    const secondTeamAnalysisDb3Json = `${JSON.stringify(buildTeamAnalysisDb3())}\n`;
    if (sha256(firstTeamAnalysisDb3Json) !== sha256(secondTeamAnalysisDb3Json)) {
        throw new Error("DB3 determinism check failed: two Team Analysis projections differ");
    }
    const teamAnalysisDb3Gzip = gzipSync(Buffer.from(firstTeamAnalysisDb3Json, "utf8"), { level: 9 });
    const secondTeamAnalysisDb3Gzip = gzipSync(Buffer.from(secondTeamAnalysisDb3Json, "utf8"), { level: 9 });
    if (!teamAnalysisDb3Gzip.equals(secondTeamAnalysisDb3Gzip)) throw new Error("DB3 determinism check failed: gzip bytes differ");
    const teamAnalysisDb3Coverage = buildDatabaseTeamAnalysisDb3Coverage(teamAnalysisDb3Dataset);
    const teamAnalysisDb3Goldens = await validateDatabaseTeamAnalysisDb3Goldens(tables);
    if (teamAnalysisDb3Goldens.failures.length > 0) {
        throw new Error(`DB3 golden fixture validation failed: ${JSON.stringify(teamAnalysisDb3Goldens.failures)}`);
    }
    const teamAnalysisDb3Parity = compareDatabaseTeamAnalysisDb3(teamAnalysisDb3Dataset, currentTeamAnalysis.dataset, siteAudit);
    const teamAnalysisDb3Report = renderDatabaseTeamAnalysisDb3Report(teamAnalysisDb3Parity, teamAnalysisDb3Coverage, currentTeamAnalysis.dataset.parserVersion);
    const buildTeamAnalysisDb4 = () => buildDatabaseTeamAnalysisDb4Dataset({ db2: teamAnalysisDataset, db3: teamAnalysisDb3Dataset, tables });
    const teamAnalysisDb4Dataset = buildTeamAnalysisDb4();
    const firstTeamAnalysisDb4Json = `${JSON.stringify(teamAnalysisDb4Dataset)}\n`;
    const secondTeamAnalysisDb4Json = `${JSON.stringify(buildTeamAnalysisDb4())}\n`;
    if (sha256(firstTeamAnalysisDb4Json) !== sha256(secondTeamAnalysisDb4Json)) {
        throw new Error("DB4 determinism check failed: two Team Analysis projections differ");
    }
    const teamAnalysisDb4Gzip = gzipSync(Buffer.from(firstTeamAnalysisDb4Json, "utf8"), { level: 9 });
    const secondTeamAnalysisDb4Gzip = gzipSync(Buffer.from(secondTeamAnalysisDb4Json, "utf8"), { level: 9 });
    if (!teamAnalysisDb4Gzip.equals(secondTeamAnalysisDb4Gzip)) throw new Error("DB4 determinism check failed: gzip bytes differ");
    const teamAnalysisDb4Coverage = buildDatabaseTeamAnalysisDb4Coverage(teamAnalysisDb4Dataset);
    const teamAnalysisDb4Goldens = await validateDatabaseTeamAnalysisDb4Goldens(teamAnalysisDb4Dataset);
    if (teamAnalysisDb4Goldens.failures.length > 0) {
        throw new Error(`DB4 golden fixture validation failed: ${JSON.stringify(teamAnalysisDb4Goldens.failures)}`);
    }
    const teamAnalysisDb4Parity = compareDatabaseTeamAnalysisDb4(teamAnalysisDb4Dataset, currentTeamAnalysis.dataset, siteAudit, teamAnalysisDb3Parity);
    const teamAnalysisDb4Report = renderDatabaseTeamAnalysisDb4Report(teamAnalysisDb4Coverage, teamAnalysisDb4Parity, currentTeamAnalysis.dataset.parserVersion);
    const sourceManifest: DatabaseExperimentSourceManifest = {
        schemaVersion: 1,
        sourceKind: "first-party-global-sqlite",
        snapshotVersion: options.snapshotVersion,
        appVersion: options.appVersion,
        versionCode: options.versionCode,
        snapshotDate: options.snapshotDate,
        databaseFile: basename(options.databasePath),
        sizeBytes: before.sizeBytes,
        sha256: before.sha256,
        tableCount: inspection.tableCount,
        readOnlyMode: "sqlite-uri-mode-ro+immutable+query-only",
        consumedTables: Object.entries(CONSUMED_TABLE_COLUMNS).map(([table, columns]) => ({
            table,
            columns,
            rowCount: tableByName.get(table)!.rowCount,
        })),
    };
    const manifest: DatabaseExperimentArtifactManifest = {
        schemaVersion: 1,
        contractVersion: "1.1.0",
        datasetVersion: `${options.snapshotVersion}__${before.sha256.slice(0, 16)}`,
        generatedAt: options.generatedAt,
        fileName: "characters-db-experiment.json.gz",
        compression: "gzip",
        sha256: sha256(gzip),
        sizeBytes: gzip.byteLength,
        uncompressedSizeBytes: Buffer.byteLength(firstJson, "utf8"),
        cardCount: dataset.cards.length,
        sourceSha256: before.sha256,
        sourceManifestFile: "source-manifest.json",
        coverageFile: "coverage.json",
        parityReportFile: "parity-report.md",
        siteAuditFile: "site-audit.json",
    };
    const teamAnalysisManifest: DatabaseTeamAnalysisArtifactManifest = {
        schemaVersion: 1,
        contractVersion: "0.1.0",
        generatedAt: options.generatedAt,
        fileName: "team-analysis-db-experiment.json.gz",
        compression: "gzip",
        sha256: sha256(teamAnalysisGzip),
        sizeBytes: teamAnalysisGzip.byteLength,
        uncompressedSizeBytes: Buffer.byteLength(firstTeamAnalysisJson, "utf8"),
        stateCount: teamAnalysisDataset.states.length,
        sourceSha256: before.sha256,
        currentTeamAnalysisSha256: currentTeamAnalysis.sha256,
        coverageFile: "team-analysis-db-coverage.json",
        parityFile: "team-analysis-db-parity.json",
        reportFile: "team-analysis-db-report.md",
        goldenValidationFile: "team-analysis-db-golden-validation.json",
    };
    const teamAnalysisDb3Manifest: DatabaseTeamAnalysisDb3ArtifactManifest = {
        schemaVersion: 1,
        contractVersion: "0.2.0",
        generatedAt: options.generatedAt,
        fileName: "team-analysis-db3-experiment.json.gz",
        compression: "gzip",
        sha256: sha256(teamAnalysisDb3Gzip),
        sizeBytes: teamAnalysisDb3Gzip.byteLength,
        uncompressedSizeBytes: Buffer.byteLength(firstTeamAnalysisDb3Json, "utf8"),
        stateCount: teamAnalysisDb3Dataset.states.length,
        sourceSha256: before.sha256,
        currentTeamAnalysisSha256: currentTeamAnalysis.sha256,
        coverageFile: "team-analysis-db3-coverage.json",
        parityFile: "team-analysis-db3-parity.json",
        reportFile: "team-analysis-db3-report.md",
        goldenValidationFile: "team-analysis-db3-golden-validation.json",
    };
    const teamAnalysisDb4Manifest: DatabaseTeamAnalysisDb4ArtifactManifest = {
        schemaVersion: 1,
        contractVersion: "0.3.0",
        generatedAt: options.generatedAt,
        fileName: "team-analysis-db4-experiment.json.gz",
        compression: "gzip",
        sha256: sha256(teamAnalysisDb4Gzip),
        sizeBytes: teamAnalysisDb4Gzip.byteLength,
        uncompressedSizeBytes: Buffer.byteLength(firstTeamAnalysisDb4Json, "utf8"),
        stateCount: teamAnalysisDb4Dataset.states.length,
        sourceSha256: before.sha256,
        currentTeamAnalysisSha256: currentTeamAnalysis.sha256,
        coverageFile: "team-analysis-db4-coverage.json",
        parityFile: "team-analysis-db4-parity.json",
        reportFile: "team-analysis-db4-report.md",
        goldenValidationFile: "team-analysis-db4-golden-validation.json",
    };

    const after = await fingerprint(options.databasePath);
    if (before.sizeBytes !== after.sizeBytes || before.sha256 !== after.sha256 || before.modifiedAtMs !== after.modifiedAtMs) {
        throw new Error("Read-only source guarantee failed: source database fingerprint or mtime changed");
    }
    await mkdir(options.outputDir, { recursive: true });
    await Promise.all([
        writeFile(resolve(options.outputDir, manifest.fileName), gzip),
        writeFile(resolve(options.outputDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, "source-manifest.json"), `${JSON.stringify(sourceManifest, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, "coverage.json"), `${JSON.stringify(coverage, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, "parity-summary.json"), `${JSON.stringify(parity, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, "golden-validation.json"), `${JSON.stringify(goldenValidation, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, "parity-report.md"), parityReport, "utf8"),
        writeFile(resolve(options.outputDir, "site-audit.json"), `${JSON.stringify(siteAudit, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisManifest.fileName), teamAnalysisGzip),
        writeFile(resolve(options.outputDir, "team-analysis-db-manifest.json"), `${JSON.stringify(teamAnalysisManifest, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisManifest.coverageFile), `${JSON.stringify(teamAnalysisCoverage, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisManifest.parityFile), `${JSON.stringify(teamAnalysisParity, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisManifest.reportFile), teamAnalysisReport, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisManifest.goldenValidationFile), `${JSON.stringify(teamAnalysisGoldens, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb3Manifest.fileName), teamAnalysisDb3Gzip),
        writeFile(resolve(options.outputDir, "team-analysis-db3-manifest.json"), `${JSON.stringify(teamAnalysisDb3Manifest, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb3Manifest.coverageFile), `${JSON.stringify(teamAnalysisDb3Coverage, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb3Manifest.parityFile), `${JSON.stringify(teamAnalysisDb3Parity, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb3Manifest.reportFile), teamAnalysisDb3Report, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb3Manifest.goldenValidationFile), `${JSON.stringify(teamAnalysisDb3Goldens, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb4Manifest.fileName), teamAnalysisDb4Gzip),
        writeFile(resolve(options.outputDir, "team-analysis-db4-manifest.json"), `${JSON.stringify(teamAnalysisDb4Manifest, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb4Manifest.coverageFile), `${JSON.stringify(teamAnalysisDb4Coverage, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb4Manifest.parityFile), `${JSON.stringify(teamAnalysisDb4Parity, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb4Manifest.reportFile), teamAnalysisDb4Report, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb4Manifest.goldenValidationFile), `${JSON.stringify(teamAnalysisDb4Goldens, null, 2)}\n`, "utf8"),
    ]);
    return { manifest, sourceManifest, teamAnalysisManifest, teamAnalysisDb3Manifest, teamAnalysisDb4Manifest, outputDir: options.outputDir, deterministicRebuildSha256: sha256(secondGzip) };
}

async function main() {
    const result = await runDatabaseExperiment(parseArgs(process.argv.slice(2)));
    console.log(JSON.stringify({
        outputDir: result.outputDir,
        artifact: result.manifest,
        teamAnalysisArtifact: result.teamAnalysisManifest,
        teamAnalysisDb3Artifact: result.teamAnalysisDb3Manifest,
        teamAnalysisDb4Artifact: result.teamAnalysisDb4Manifest,
        sourceSha256: result.sourceManifest.sha256,
        deterministicRebuildSha256: result.deterministicRebuildSha256,
    }, null, 2));
}

if (require.main === module) {
    main().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
