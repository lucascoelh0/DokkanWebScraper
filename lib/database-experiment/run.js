"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runDatabaseExperiment = void 0;
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const zlib_1 = require("zlib");
const builder_1 = require("./builder");
const parity_1 = require("./parity");
const sqlite_readonly_adapter_1 = require("./sqlite-readonly-adapter");
const golden_1 = require("./golden");
const team_analysis_builder_1 = require("./team-analysis-builder");
const team_analysis_golden_1 = require("./team-analysis-golden");
const team_analysis_parity_1 = require("./team-analysis-parity");
const team_analysis_db3_builder_1 = require("./team-analysis-db3-builder");
const team_analysis_db3_golden_1 = require("./team-analysis-db3-golden");
const team_analysis_db3_parity_1 = require("./team-analysis-db3-parity");
const team_analysis_db4_builder_1 = require("./team-analysis-db4-builder");
const team_analysis_db4_golden_1 = require("./team-analysis-db4-golden");
const team_analysis_db4_parity_1 = require("./team-analysis-db4-parity");
const team_analysis_db5_builder_1 = require("./team-analysis-db5-builder");
const team_analysis_db5_golden_1 = require("./team-analysis-db5-golden");
const team_analysis_db5_parity_1 = require("./team-analysis-db5-parity");
const DEFAULT_DATABASE = "D:\\Dokkan\\database\\decrypted\\dokkan-global-current.db";
const DEFAULT_CURRENT_DATASET = "D:\\Dokkan\\DokkanWebScraper\\data\\fyi-characters\\latest\\characters.json.gz";
const DEFAULT_CURRENT_TEAM_ANALYSIS = "D:\\Dokkan\\DokkanWebScraper\\data\\fyi-characters\\latest\\team-analysis.json.gz";
const DEFAULT_OUTPUT = (0, path_1.resolve)(process.cwd(), "data", "database-experiment");
const DEFAULT_GENERATED_AT = "2026-08-05T00:00:00.000Z";
const DEFAULT_RELEASE_CUTOFF = "2026-08-05 23:59:59";
function parseArgs(argv) {
    const values = new Map();
    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];
        if (!token.startsWith("--"))
            throw new Error(`Unexpected argument: ${token}`);
        const [name, inline] = token.split("=", 2);
        const value = inline ?? argv[++index];
        if (!value)
            throw new Error(`Missing value for ${name}`);
        values.set(name, value);
    }
    return {
        databasePath: (0, path_1.resolve)(values.get("--database") ?? DEFAULT_DATABASE),
        currentDatasetPath: (0, path_1.resolve)(values.get("--current-dataset") ?? DEFAULT_CURRENT_DATASET),
        currentTeamAnalysisPath: (0, path_1.resolve)(values.get("--current-team-analysis") ?? DEFAULT_CURRENT_TEAM_ANALYSIS),
        outputDir: (0, path_1.resolve)(values.get("--output-dir") ?? DEFAULT_OUTPUT),
        generatedAt: values.get("--generated-at") ?? DEFAULT_GENERATED_AT,
        releaseCutoff: values.get("--release-cutoff") ?? DEFAULT_RELEASE_CUTOFF,
        snapshotVersion: values.get("--snapshot-version") ?? "global-6.4.0-v338-2026-08-05",
        appVersion: values.get("--app-version") ?? "6.4.0",
        versionCode: Number(values.get("--version-code") ?? "338"),
        snapshotDate: values.get("--snapshot-date") ?? "2026-08-05",
    };
}
async function sha256File(path) {
    return new Promise((resolvePromise, rejectPromise) => {
        const hash = (0, crypto_1.createHash)("sha256");
        const stream = (0, fs_1.createReadStream)(path);
        stream.on("data", chunk => hash.update(chunk));
        stream.on("error", rejectPromise);
        stream.on("end", () => resolvePromise(hash.digest("hex")));
    });
}
async function fingerprint(path) {
    const fileStat = await (0, promises_1.stat)(path);
    return { sizeBytes: fileStat.size, sha256: await sha256File(path), modifiedAtMs: fileStat.mtimeMs };
}
function sha256(value) {
    return (0, crypto_1.createHash)("sha256").update(value).digest("hex");
}
async function runDatabaseExperiment(options) {
    const before = await fingerprint(options.databasePath);
    const adapter = new sqlite_readonly_adapter_1.ReadOnlySqliteAdapter(options.databasePath);
    const inspection = await adapter.inspect();
    const tableByName = new Map(inspection.tables.map(table => [table.name, table]));
    for (const [table, columns] of Object.entries(builder_1.CONSUMED_TABLE_COLUMNS)) {
        const inspected = tableByName.get(table);
        if (!inspected)
            throw new Error(`Required first-party table is missing: ${table}`);
        const missing = columns.filter(column => !inspected.columns.includes(column));
        if (missing.length > 0)
            throw new Error(`Required columns missing from ${table}: ${missing.join(", ")}`);
    }
    const tables = await (0, builder_1.loadDatabaseExperimentTables)(adapter);
    const build = () => (0, builder_1.buildDatabaseExperimentDataset)({
        tables,
        generatedAt: options.generatedAt,
        sourceSnapshotVersion: options.snapshotVersion,
        sourceSha256: before.sha256,
        releasedAtOrBefore: options.releaseCutoff,
    });
    const dataset = build();
    const firstJson = `${JSON.stringify(dataset)}\n`;
    const secondJson = `${JSON.stringify(build())}\n`;
    if (sha256(firstJson) !== sha256(secondJson))
        throw new Error("Determinism check failed: two builds from identical rows differ");
    const gzip = (0, zlib_1.gzipSync)(Buffer.from(firstJson, "utf8"), { level: 9 });
    const secondGzip = (0, zlib_1.gzipSync)(Buffer.from(secondJson, "utf8"), { level: 9 });
    if (!gzip.equals(secondGzip))
        throw new Error("Determinism check failed: gzip bytes differ");
    const coverage = (0, builder_1.buildCoverage)(dataset);
    const goldenValidation = await (0, golden_1.validateGoldenFixtures)(dataset);
    if (goldenValidation.failures.length > 0) {
        throw new Error(`Golden fixture validation failed: ${JSON.stringify(goldenValidation.failures)}`);
    }
    const currentCharacters = await (0, parity_1.readCurrentCharacters)(options.currentDatasetPath);
    const siteAudit = await (0, parity_1.readSiteAuditFixtures)();
    const parity = (0, parity_1.compareWithCurrentDataset)(dataset, currentCharacters, siteAudit);
    const parityReport = (0, parity_1.renderParityReport)(parity, coverage, siteAudit);
    const compatibilityPrimaryCardIds = siteAudit.entries
        .filter(entry => entry.finding === "collection-cards-omission")
        .map(entry => entry.cardId);
    const buildTeamAnalysis = () => (0, team_analysis_builder_1.buildDatabaseTeamAnalysisDataset)({
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
    const teamAnalysisGzip = (0, zlib_1.gzipSync)(Buffer.from(firstTeamAnalysisJson, "utf8"), { level: 9 });
    const secondTeamAnalysisGzip = (0, zlib_1.gzipSync)(Buffer.from(secondTeamAnalysisJson, "utf8"), { level: 9 });
    if (!teamAnalysisGzip.equals(secondTeamAnalysisGzip))
        throw new Error("DB2 determinism check failed: gzip bytes differ");
    const teamAnalysisCoverage = (0, team_analysis_builder_1.buildDatabaseTeamAnalysisCoverage)(teamAnalysisDataset);
    const teamAnalysisGoldens = await (0, team_analysis_golden_1.validateDatabaseTeamAnalysisGoldens)(tables);
    if (teamAnalysisGoldens.failures.length > 0) {
        throw new Error(`DB2 golden fixture validation failed: ${JSON.stringify(teamAnalysisGoldens.failures)}`);
    }
    const currentTeamAnalysis = await (0, team_analysis_parity_1.readCurrentTeamAnalysis)(options.currentTeamAnalysisPath);
    const teamAnalysisParity = (0, team_analysis_parity_1.compareDatabaseTeamAnalysis)(teamAnalysisDataset, currentTeamAnalysis.dataset, siteAudit);
    const teamAnalysisReport = (0, team_analysis_parity_1.renderDatabaseTeamAnalysisReport)(teamAnalysisParity, teamAnalysisCoverage, currentTeamAnalysis.dataset.parserVersion);
    const buildTeamAnalysisDb3 = () => (0, team_analysis_db3_builder_1.buildDatabaseTeamAnalysisDb3Dataset)({ db2: teamAnalysisDataset, tables });
    const teamAnalysisDb3Dataset = buildTeamAnalysisDb3();
    const firstTeamAnalysisDb3Json = `${JSON.stringify(teamAnalysisDb3Dataset)}\n`;
    const secondTeamAnalysisDb3Json = `${JSON.stringify(buildTeamAnalysisDb3())}\n`;
    if (sha256(firstTeamAnalysisDb3Json) !== sha256(secondTeamAnalysisDb3Json)) {
        throw new Error("DB3 determinism check failed: two Team Analysis projections differ");
    }
    const teamAnalysisDb3Gzip = (0, zlib_1.gzipSync)(Buffer.from(firstTeamAnalysisDb3Json, "utf8"), { level: 9 });
    const secondTeamAnalysisDb3Gzip = (0, zlib_1.gzipSync)(Buffer.from(secondTeamAnalysisDb3Json, "utf8"), { level: 9 });
    if (!teamAnalysisDb3Gzip.equals(secondTeamAnalysisDb3Gzip))
        throw new Error("DB3 determinism check failed: gzip bytes differ");
    const teamAnalysisDb3Coverage = (0, team_analysis_db3_builder_1.buildDatabaseTeamAnalysisDb3Coverage)(teamAnalysisDb3Dataset);
    const teamAnalysisDb3Goldens = await (0, team_analysis_db3_golden_1.validateDatabaseTeamAnalysisDb3Goldens)(tables);
    if (teamAnalysisDb3Goldens.failures.length > 0) {
        throw new Error(`DB3 golden fixture validation failed: ${JSON.stringify(teamAnalysisDb3Goldens.failures)}`);
    }
    const teamAnalysisDb3Parity = (0, team_analysis_db3_parity_1.compareDatabaseTeamAnalysisDb3)(teamAnalysisDb3Dataset, currentTeamAnalysis.dataset, siteAudit);
    const teamAnalysisDb3Report = (0, team_analysis_db3_parity_1.renderDatabaseTeamAnalysisDb3Report)(teamAnalysisDb3Parity, teamAnalysisDb3Coverage, currentTeamAnalysis.dataset.parserVersion);
    const buildTeamAnalysisDb4 = () => (0, team_analysis_db4_builder_1.buildDatabaseTeamAnalysisDb4Dataset)({ db2: teamAnalysisDataset, db3: teamAnalysisDb3Dataset, tables });
    const teamAnalysisDb4Dataset = buildTeamAnalysisDb4();
    const firstTeamAnalysisDb4Json = `${JSON.stringify(teamAnalysisDb4Dataset)}\n`;
    const secondTeamAnalysisDb4Json = `${JSON.stringify(buildTeamAnalysisDb4())}\n`;
    if (sha256(firstTeamAnalysisDb4Json) !== sha256(secondTeamAnalysisDb4Json)) {
        throw new Error("DB4 determinism check failed: two Team Analysis projections differ");
    }
    const teamAnalysisDb4Gzip = (0, zlib_1.gzipSync)(Buffer.from(firstTeamAnalysisDb4Json, "utf8"), { level: 9 });
    const secondTeamAnalysisDb4Gzip = (0, zlib_1.gzipSync)(Buffer.from(secondTeamAnalysisDb4Json, "utf8"), { level: 9 });
    if (!teamAnalysisDb4Gzip.equals(secondTeamAnalysisDb4Gzip))
        throw new Error("DB4 determinism check failed: gzip bytes differ");
    const teamAnalysisDb4Coverage = (0, team_analysis_db4_builder_1.buildDatabaseTeamAnalysisDb4Coverage)(teamAnalysisDb4Dataset);
    const teamAnalysisDb4Goldens = await (0, team_analysis_db4_golden_1.validateDatabaseTeamAnalysisDb4Goldens)(teamAnalysisDb4Dataset);
    if (teamAnalysisDb4Goldens.failures.length > 0) {
        throw new Error(`DB4 golden fixture validation failed: ${JSON.stringify(teamAnalysisDb4Goldens.failures)}`);
    }
    const teamAnalysisDb4Parity = (0, team_analysis_db4_parity_1.compareDatabaseTeamAnalysisDb4)(teamAnalysisDb4Dataset, currentTeamAnalysis.dataset, siteAudit, teamAnalysisDb3Parity);
    const teamAnalysisDb4Report = (0, team_analysis_db4_parity_1.renderDatabaseTeamAnalysisDb4Report)(teamAnalysisDb4Coverage, teamAnalysisDb4Parity, currentTeamAnalysis.dataset.parserVersion);
    const buildTeamAnalysisDb5 = () => (0, team_analysis_db5_builder_1.buildDatabaseTeamAnalysisDb5Dataset)(teamAnalysisDb4Dataset);
    const teamAnalysisDb5Dataset = buildTeamAnalysisDb5();
    const firstTeamAnalysisDb5Json = `${JSON.stringify(teamAnalysisDb5Dataset)}\n`;
    const secondTeamAnalysisDb5Json = `${JSON.stringify(buildTeamAnalysisDb5())}\n`;
    if (sha256(firstTeamAnalysisDb5Json) !== sha256(secondTeamAnalysisDb5Json)) {
        throw new Error("DB5 determinism check failed: two Team Analysis projections differ");
    }
    const teamAnalysisDb5Gzip = (0, zlib_1.gzipSync)(Buffer.from(firstTeamAnalysisDb5Json, "utf8"), { level: 9 });
    const secondTeamAnalysisDb5Gzip = (0, zlib_1.gzipSync)(Buffer.from(secondTeamAnalysisDb5Json, "utf8"), { level: 9 });
    if (!teamAnalysisDb5Gzip.equals(secondTeamAnalysisDb5Gzip))
        throw new Error("DB5 determinism check failed: gzip bytes differ");
    const teamAnalysisDb5Coverage = (0, team_analysis_db5_builder_1.buildDatabaseTeamAnalysisDb5Coverage)(teamAnalysisDb5Dataset);
    const teamAnalysisDb5Goldens = await (0, team_analysis_db5_golden_1.validateDatabaseTeamAnalysisDb5Goldens)(teamAnalysisDb5Dataset);
    if (teamAnalysisDb5Goldens.failures.length > 0) {
        throw new Error(`DB5 golden fixture validation failed: ${JSON.stringify(teamAnalysisDb5Goldens.failures)}`);
    }
    const teamAnalysisDb5Parity = (0, team_analysis_db5_parity_1.compareDatabaseTeamAnalysisDb5)(teamAnalysisDb5Dataset, currentTeamAnalysis.dataset, siteAudit);
    const teamAnalysisDb5Report = (0, team_analysis_db5_parity_1.renderDatabaseTeamAnalysisDb5Report)(teamAnalysisDb5Coverage, teamAnalysisDb5Parity, currentTeamAnalysis.dataset.parserVersion);
    const sourceManifest = {
        schemaVersion: 1,
        sourceKind: "first-party-global-sqlite",
        snapshotVersion: options.snapshotVersion,
        appVersion: options.appVersion,
        versionCode: options.versionCode,
        snapshotDate: options.snapshotDate,
        databaseFile: (0, path_1.basename)(options.databasePath),
        sizeBytes: before.sizeBytes,
        sha256: before.sha256,
        tableCount: inspection.tableCount,
        readOnlyMode: "sqlite-uri-mode-ro+immutable+query-only",
        consumedTables: Object.entries(builder_1.CONSUMED_TABLE_COLUMNS).map(([table, columns]) => ({
            table,
            columns,
            rowCount: tableByName.get(table).rowCount,
        })),
    };
    const manifest = {
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
    const teamAnalysisManifest = {
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
    const teamAnalysisDb3Manifest = {
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
    const teamAnalysisDb4Manifest = {
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
    const teamAnalysisDb5Manifest = {
        schemaVersion: 1,
        contractVersion: "0.4.0",
        generatedAt: options.generatedAt,
        fileName: "team-analysis-db5-experiment.json.gz",
        compression: "gzip",
        sha256: sha256(teamAnalysisDb5Gzip),
        sizeBytes: teamAnalysisDb5Gzip.byteLength,
        uncompressedSizeBytes: Buffer.byteLength(firstTeamAnalysisDb5Json, "utf8"),
        stateCount: teamAnalysisDb5Dataset.states.length,
        sourceSha256: before.sha256,
        currentTeamAnalysisSha256: currentTeamAnalysis.sha256,
        coverageFile: "team-analysis-db5-coverage.json",
        parityFile: "team-analysis-db5-parity.json",
        reportFile: "team-analysis-db5-report.md",
        goldenValidationFile: "team-analysis-db5-golden-validation.json",
    };
    const after = await fingerprint(options.databasePath);
    if (before.sizeBytes !== after.sizeBytes || before.sha256 !== after.sha256 || before.modifiedAtMs !== after.modifiedAtMs) {
        throw new Error("Read-only source guarantee failed: source database fingerprint or mtime changed");
    }
    await (0, promises_1.mkdir)(options.outputDir, { recursive: true });
    await Promise.all([
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, manifest.fileName), gzip),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, "source-manifest.json"), `${JSON.stringify(sourceManifest, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, "coverage.json"), `${JSON.stringify(coverage, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, "parity-summary.json"), `${JSON.stringify(parity, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, "golden-validation.json"), `${JSON.stringify(goldenValidation, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, "parity-report.md"), parityReport, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, "site-audit.json"), `${JSON.stringify(siteAudit, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisManifest.fileName), teamAnalysisGzip),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, "team-analysis-db-manifest.json"), `${JSON.stringify(teamAnalysisManifest, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisManifest.coverageFile), `${JSON.stringify(teamAnalysisCoverage, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisManifest.parityFile), `${JSON.stringify(teamAnalysisParity, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisManifest.reportFile), teamAnalysisReport, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisManifest.goldenValidationFile), `${JSON.stringify(teamAnalysisGoldens, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb3Manifest.fileName), teamAnalysisDb3Gzip),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, "team-analysis-db3-manifest.json"), `${JSON.stringify(teamAnalysisDb3Manifest, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb3Manifest.coverageFile), `${JSON.stringify(teamAnalysisDb3Coverage, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb3Manifest.parityFile), `${JSON.stringify(teamAnalysisDb3Parity, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb3Manifest.reportFile), teamAnalysisDb3Report, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb3Manifest.goldenValidationFile), `${JSON.stringify(teamAnalysisDb3Goldens, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb4Manifest.fileName), teamAnalysisDb4Gzip),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, "team-analysis-db4-manifest.json"), `${JSON.stringify(teamAnalysisDb4Manifest, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb4Manifest.coverageFile), `${JSON.stringify(teamAnalysisDb4Coverage, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb4Manifest.parityFile), `${JSON.stringify(teamAnalysisDb4Parity, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb4Manifest.reportFile), teamAnalysisDb4Report, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb4Manifest.goldenValidationFile), `${JSON.stringify(teamAnalysisDb4Goldens, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb5Manifest.fileName), teamAnalysisDb5Gzip),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, "team-analysis-db5-manifest.json"), `${JSON.stringify(teamAnalysisDb5Manifest, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb5Manifest.coverageFile), `${JSON.stringify(teamAnalysisDb5Coverage, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb5Manifest.parityFile), `${JSON.stringify(teamAnalysisDb5Parity, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb5Manifest.reportFile), teamAnalysisDb5Report, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb5Manifest.goldenValidationFile), `${JSON.stringify(teamAnalysisDb5Goldens, null, 2)}\n`, "utf8"),
    ]);
    return { manifest, sourceManifest, teamAnalysisManifest, teamAnalysisDb3Manifest, teamAnalysisDb4Manifest, teamAnalysisDb5Manifest, outputDir: options.outputDir, deterministicRebuildSha256: sha256(secondGzip) };
}
exports.runDatabaseExperiment = runDatabaseExperiment;
async function main() {
    const result = await runDatabaseExperiment(parseArgs(process.argv.slice(2)));
    console.log(JSON.stringify({
        outputDir: result.outputDir,
        artifact: result.manifest,
        teamAnalysisArtifact: result.teamAnalysisManifest,
        teamAnalysisDb3Artifact: result.teamAnalysisDb3Manifest,
        teamAnalysisDb4Artifact: result.teamAnalysisDb4Manifest,
        teamAnalysisDb5Artifact: result.teamAnalysisDb5Manifest,
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
//# sourceMappingURL=run.js.map