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
const team_analysis_db6_builder_1 = require("./team-analysis-db6-builder");
const team_analysis_db6_golden_1 = require("./team-analysis-db6-golden");
const team_analysis_db6_parity_1 = require("./team-analysis-db6-parity");
const team_analysis_db7_builder_1 = require("./team-analysis-db7-builder");
const team_analysis_db7_golden_1 = require("./team-analysis-db7-golden");
const team_analysis_db7_parity_1 = require("./team-analysis-db7-parity");
const team_analysis_db8_builder_1 = require("./team-analysis-db8-builder");
const team_analysis_db8_golden_1 = require("./team-analysis-db8-golden");
const team_analysis_db8_report_1 = require("./team-analysis-db8-report");
const native_runtime_elf_adapter_1 = require("./native-runtime-elf-adapter");
const team_analysis_db9_builder_1 = require("./team-analysis-db9-builder");
const team_analysis_db9_golden_1 = require("./team-analysis-db9-golden");
const team_analysis_db9_report_1 = require("./team-analysis-db9-report");
const team_analysis_db10_builder_1 = require("./team-analysis-db10-builder");
const team_analysis_db10_golden_1 = require("./team-analysis-db10-golden");
const team_analysis_db10_report_1 = require("./team-analysis-db10-report");
const team_analysis_db11_builder_1 = require("./team-analysis-db11-builder");
const team_analysis_db11_golden_1 = require("./team-analysis-db11-golden");
const team_analysis_db11_parity_1 = require("./team-analysis-db11-parity");
const team_analysis_db11_report_1 = require("./team-analysis-db11-report");
const team_analysis_db12_builder_1 = require("./team-analysis-db12-builder");
const team_analysis_db12_golden_1 = require("./team-analysis-db12-golden");
const team_analysis_db12_report_1 = require("./team-analysis-db12-report");
const team_analysis_db13_builder_1 = require("./team-analysis-db13-builder");
const team_analysis_db13_golden_1 = require("./team-analysis-db13-golden");
const team_analysis_db13_report_1 = require("./team-analysis-db13-report");
const team_analysis_db14_builder_1 = require("./team-analysis-db14-builder");
const team_analysis_db14_golden_1 = require("./team-analysis-db14-golden");
const team_analysis_db14_report_1 = require("./team-analysis-db14-report");
const team_analysis_db15_builder_1 = require("./team-analysis-db15-builder");
const team_analysis_db15_golden_1 = require("./team-analysis-db15-golden");
const team_analysis_db15_report_1 = require("./team-analysis-db15-report");
const team_analysis_db16_builder_1 = require("./team-analysis-db16-builder");
const team_analysis_db16_golden_1 = require("./team-analysis-db16-golden");
const team_analysis_db16_report_1 = require("./team-analysis-db16-report");
const team_analysis_db17_builder_1 = require("./team-analysis-db17-builder");
const team_analysis_db17_golden_1 = require("./team-analysis-db17-golden");
const team_analysis_db17_report_1 = require("./team-analysis-db17-report");
const team_analysis_db18_builder_1 = require("./team-analysis-db18-builder");
const team_analysis_db18_golden_1 = require("./team-analysis-db18-golden");
const team_analysis_db18_report_1 = require("./team-analysis-db18-report");
const team_analysis_db19_builder_1 = require("./team-analysis-db19-builder");
const team_analysis_db19_golden_1 = require("./team-analysis-db19-golden");
const team_analysis_db19_report_1 = require("./team-analysis-db19-report");
const team_analysis_db20_builder_1 = require("./team-analysis-db20-builder");
const team_analysis_db20_golden_1 = require("./team-analysis-db20-golden");
const team_analysis_db20_report_1 = require("./team-analysis-db20-report");
const team_analysis_db21_builder_1 = require("./team-analysis-db21-builder");
const team_analysis_db21_golden_1 = require("./team-analysis-db21-golden");
const team_analysis_db21_report_1 = require("./team-analysis-db21-report");
const team_analysis_db22_builder_1 = require("./team-analysis-db22-builder");
const team_analysis_db22_golden_1 = require("./team-analysis-db22-golden");
const team_analysis_db22_report_1 = require("./team-analysis-db22-report");
const team_analysis_db23_builder_1 = require("./team-analysis-db23-builder");
const team_analysis_db23_golden_1 = require("./team-analysis-db23-golden");
const team_analysis_db23_report_1 = require("./team-analysis-db23-report");
const team_analysis_db24_builder_1 = require("./team-analysis-db24-builder");
const team_analysis_db24_golden_1 = require("./team-analysis-db24-golden");
const team_analysis_db24_report_1 = require("./team-analysis-db24-report");
const team_analysis_db25_builder_1 = require("./team-analysis-db25-builder");
const team_analysis_db25_golden_1 = require("./team-analysis-db25-golden");
const team_analysis_db25_report_1 = require("./team-analysis-db25-report");
const team_analysis_db26_builder_1 = require("./team-analysis-db26-builder");
const team_analysis_db26_golden_1 = require("./team-analysis-db26-golden");
const team_analysis_db26_report_1 = require("./team-analysis-db26-report");
const team_analysis_db27_builder_1 = require("./team-analysis-db27-builder");
const team_analysis_db27_golden_1 = require("./team-analysis-db27-golden");
const team_analysis_db27_report_1 = require("./team-analysis-db27-report");
const team_analysis_db28_builder_1 = require("./team-analysis-db28-builder");
const team_analysis_db28_golden_1 = require("./team-analysis-db28-golden");
const team_analysis_db28_report_1 = require("./team-analysis-db28-report");
const DEFAULT_DATABASE = "D:\\Dokkan\\database\\decrypted\\dokkan-global-current.db";
const DEFAULT_CURRENT_DATASET = "D:\\Dokkan\\DokkanWebScraper\\data\\fyi-characters\\latest\\characters.json.gz";
const DEFAULT_CURRENT_TEAM_ANALYSIS = "D:\\Dokkan\\DokkanWebScraper\\data\\fyi-characters\\latest\\team-analysis.json.gz";
const DEFAULT_NATIVE_RUNTIME = "D:\\Dokkan\\database\\apk\\extracted\\lib\\arm64-v8a\\libcocos2dcpp.so";
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
        nativeRuntimePath: (0, path_1.resolve)(values.get("--native-runtime") ?? DEFAULT_NATIVE_RUNTIME),
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
    const nativeBefore = await fingerprint(options.nativeRuntimePath);
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
    const buildTeamAnalysisDb6 = () => (0, team_analysis_db6_builder_1.buildDatabaseTeamAnalysisDb6Dataset)({ db5: teamAnalysisDb5Dataset, db2: teamAnalysisDataset });
    const teamAnalysisDb6Dataset = buildTeamAnalysisDb6();
    const firstTeamAnalysisDb6Json = `${JSON.stringify(teamAnalysisDb6Dataset)}\n`;
    const secondTeamAnalysisDb6Json = `${JSON.stringify(buildTeamAnalysisDb6())}\n`;
    if (sha256(firstTeamAnalysisDb6Json) !== sha256(secondTeamAnalysisDb6Json)) {
        throw new Error("DB6 determinism check failed: two Team Analysis projections differ");
    }
    const teamAnalysisDb6Gzip = (0, zlib_1.gzipSync)(Buffer.from(firstTeamAnalysisDb6Json, "utf8"), { level: 9 });
    const secondTeamAnalysisDb6Gzip = (0, zlib_1.gzipSync)(Buffer.from(secondTeamAnalysisDb6Json, "utf8"), { level: 9 });
    if (!teamAnalysisDb6Gzip.equals(secondTeamAnalysisDb6Gzip))
        throw new Error("DB6 determinism check failed: gzip bytes differ");
    const teamAnalysisDb6Coverage = (0, team_analysis_db6_builder_1.buildDatabaseTeamAnalysisDb6Coverage)(teamAnalysisDb6Dataset);
    const teamAnalysisDb6Goldens = await (0, team_analysis_db6_golden_1.validateDatabaseTeamAnalysisDb6Goldens)(teamAnalysisDb6Dataset);
    if (teamAnalysisDb6Goldens.failures.length > 0) {
        throw new Error(`DB6 golden fixture validation failed: ${JSON.stringify(teamAnalysisDb6Goldens.failures)}`);
    }
    const teamAnalysisDb6Parity = (0, team_analysis_db6_parity_1.compareDatabaseTeamAnalysisDb6)(teamAnalysisDb6Dataset, currentTeamAnalysis.dataset, siteAudit, teamAnalysisDb4Parity);
    const teamAnalysisDb6Report = (0, team_analysis_db6_parity_1.renderDatabaseTeamAnalysisDb6Report)(teamAnalysisDb6Coverage, teamAnalysisDb6Parity, currentTeamAnalysis.dataset.parserVersion);
    const buildTeamAnalysisDb7 = () => (0, team_analysis_db7_builder_1.buildDatabaseTeamAnalysisDb7Dataset)(teamAnalysisDb6Dataset);
    const teamAnalysisDb7Dataset = buildTeamAnalysisDb7();
    const firstTeamAnalysisDb7Json = `${JSON.stringify(teamAnalysisDb7Dataset)}\n`;
    const secondTeamAnalysisDb7Json = `${JSON.stringify(buildTeamAnalysisDb7())}\n`;
    if (sha256(firstTeamAnalysisDb7Json) !== sha256(secondTeamAnalysisDb7Json))
        throw new Error("DB7 determinism check failed: two Team Analysis projections differ");
    const teamAnalysisDb7Gzip = (0, zlib_1.gzipSync)(Buffer.from(firstTeamAnalysisDb7Json, "utf8"), { level: 9 });
    const secondTeamAnalysisDb7Gzip = (0, zlib_1.gzipSync)(Buffer.from(secondTeamAnalysisDb7Json, "utf8"), { level: 9 });
    if (!teamAnalysisDb7Gzip.equals(secondTeamAnalysisDb7Gzip))
        throw new Error("DB7 determinism check failed: gzip bytes differ");
    const teamAnalysisDb7Coverage = (0, team_analysis_db7_builder_1.buildDatabaseTeamAnalysisDb7Coverage)(teamAnalysisDb7Dataset);
    const teamAnalysisDb7Goldens = await (0, team_analysis_db7_golden_1.validateDatabaseTeamAnalysisDb7Goldens)(teamAnalysisDb7Dataset);
    if (teamAnalysisDb7Goldens.failures.length > 0)
        throw new Error(`DB7 golden fixture validation failed: ${JSON.stringify(teamAnalysisDb7Goldens.failures)}`);
    const teamAnalysisDb7Parity = (0, team_analysis_db7_parity_1.compareDatabaseTeamAnalysisDb7)(teamAnalysisDb7Dataset, currentTeamAnalysis.dataset, siteAudit);
    const teamAnalysisDb7Report = (0, team_analysis_db7_parity_1.renderDatabaseTeamAnalysisDb7Report)(teamAnalysisDb7Coverage, teamAnalysisDb7Parity, currentTeamAnalysis.dataset.parserVersion);
    const buildTeamAnalysisDb8 = () => (0, team_analysis_db8_builder_1.buildDatabaseTeamAnalysisDb8Dataset)({ db7: teamAnalysisDb7Dataset, tables });
    const teamAnalysisDb8Dataset = buildTeamAnalysisDb8();
    const firstTeamAnalysisDb8Json = `${JSON.stringify(teamAnalysisDb8Dataset)}\n`;
    const secondTeamAnalysisDb8Json = `${JSON.stringify(buildTeamAnalysisDb8())}\n`;
    if (sha256(firstTeamAnalysisDb8Json) !== sha256(secondTeamAnalysisDb8Json))
        throw new Error("DB8 determinism check failed: two evidence-gap projections differ");
    const teamAnalysisDb8Gzip = (0, zlib_1.gzipSync)(Buffer.from(firstTeamAnalysisDb8Json, "utf8"), { level: 9 });
    const secondTeamAnalysisDb8Gzip = (0, zlib_1.gzipSync)(Buffer.from(secondTeamAnalysisDb8Json, "utf8"), { level: 9 });
    if (!teamAnalysisDb8Gzip.equals(secondTeamAnalysisDb8Gzip))
        throw new Error("DB8 determinism check failed: gzip bytes differ");
    const teamAnalysisDb8Coverage = (0, team_analysis_db8_builder_1.buildDatabaseTeamAnalysisDb8Coverage)(teamAnalysisDb8Dataset);
    const teamAnalysisDb8Goldens = await (0, team_analysis_db8_golden_1.validateDatabaseTeamAnalysisDb8Goldens)(teamAnalysisDb8Dataset, teamAnalysisDb7Dataset);
    if (teamAnalysisDb8Goldens.failures.length > 0)
        throw new Error(`DB8 golden fixture validation failed: ${JSON.stringify(teamAnalysisDb8Goldens.failures)}`);
    const teamAnalysisDb8Report = (0, team_analysis_db8_report_1.renderDatabaseTeamAnalysisDb8Report)(teamAnalysisDb8Dataset, teamAnalysisDb8Coverage);
    const nativeLayout = await (0, team_analysis_db9_golden_1.readDb9NativeLayout)();
    const nativeLayoutSha256 = sha256(await (0, promises_1.readFile)((0, team_analysis_db9_golden_1.resolveDb9NativeLayoutPath)()));
    if (nativeBefore.sha256 !== nativeLayout.sourceSha256 || nativeBefore.sizeBytes !== nativeLayout.sourceSizeBytes)
        throw new Error("DB9 native runtime does not match the audited layout fingerprint");
    const nativeInspection = await (0, native_runtime_elf_adapter_1.inspectNativeRuntimeElf)(options.nativeRuntimePath);
    const requiredNativeSymbols = [nativeLayout.tables.efficacy.dispatchSymbol, nativeLayout.tables.causality.dispatchSymbol, nativeLayout.tables.causality.tableSymbol];
    for (const symbol of requiredNativeSymbols)
        if (!nativeInspection.symbols.some(value => value.name === symbol))
            throw new Error(`DB9 required native symbol missing: ${symbol}`);
    const causalityTableSymbol = nativeInspection.symbols.find(value => value.name === nativeLayout.tables.causality.tableSymbol);
    if (causalityTableSymbol.value !== nativeLayout.tables.causality.baseVma || causalityTableSymbol.size !== nativeLayout.tables.causality.slotCount * 8)
        throw new Error("DB9 causality dispatch table layout mismatch");
    const buildTeamAnalysisDb9 = () => (0, team_analysis_db9_builder_1.buildDatabaseTeamAnalysisDb9Dataset)({ db8: teamAnalysisDb8Dataset, db8Sha256: sha256(teamAnalysisDb8Gzip), inspection: nativeInspection, layout: nativeLayout, layoutSha256: nativeLayoutSha256, nativePath: options.nativeRuntimePath, nativeSizeBytes: nativeBefore.sizeBytes, nativeSha256: nativeBefore.sha256 });
    const teamAnalysisDb9Dataset = buildTeamAnalysisDb9();
    const firstTeamAnalysisDb9Json = `${JSON.stringify(teamAnalysisDb9Dataset)}\n`;
    const secondTeamAnalysisDb9Json = `${JSON.stringify(buildTeamAnalysisDb9())}\n`;
    if (sha256(firstTeamAnalysisDb9Json) !== sha256(secondTeamAnalysisDb9Json))
        throw new Error("DB9 determinism check failed: two runtime-evidence projections differ");
    const teamAnalysisDb9Gzip = (0, zlib_1.gzipSync)(Buffer.from(firstTeamAnalysisDb9Json, "utf8"), { level: 9 });
    const secondTeamAnalysisDb9Gzip = (0, zlib_1.gzipSync)(Buffer.from(secondTeamAnalysisDb9Json, "utf8"), { level: 9 });
    if (!teamAnalysisDb9Gzip.equals(secondTeamAnalysisDb9Gzip))
        throw new Error("DB9 determinism check failed: gzip bytes differ");
    const teamAnalysisDb9Coverage = (0, team_analysis_db9_builder_1.buildDatabaseTeamAnalysisDb9Coverage)(teamAnalysisDb9Dataset);
    const teamAnalysisDb9Goldens = await (0, team_analysis_db9_golden_1.validateDatabaseTeamAnalysisDb9Goldens)(teamAnalysisDb9Dataset);
    if (teamAnalysisDb9Goldens.failures.length > 0)
        throw new Error(`DB9 golden fixture validation failed: ${JSON.stringify(teamAnalysisDb9Goldens.failures)}`);
    const teamAnalysisDb9Report = (0, team_analysis_db9_report_1.renderDatabaseTeamAnalysisDb9Report)(teamAnalysisDb9Dataset, teamAnalysisDb9Coverage);
    const nativeSemanticsBytes = await (0, promises_1.readFile)((0, team_analysis_db10_golden_1.resolveDb10NativeSemanticsPath)());
    const nativeSemantics = (0, team_analysis_db10_golden_1.parseDb10NativeSemantics)(nativeSemanticsBytes);
    const nativeSemanticsSha256 = sha256(nativeSemanticsBytes);
    const buildTeamAnalysisDb10 = () => (0, team_analysis_db10_builder_1.buildDatabaseTeamAnalysisDb10Dataset)({
        db8: teamAnalysisDb8Dataset, db8Sha256: sha256(teamAnalysisDb8Gzip), db9: teamAnalysisDb9Dataset, db9Sha256: sha256(teamAnalysisDb9Gzip),
        inspection: nativeInspection, layout: nativeSemantics, layoutSha256: nativeSemanticsSha256, nativeSha256: nativeBefore.sha256,
    });
    const teamAnalysisDb10Dataset = buildTeamAnalysisDb10();
    const firstTeamAnalysisDb10Json = `${JSON.stringify(teamAnalysisDb10Dataset)}\n`;
    const secondTeamAnalysisDb10Json = `${JSON.stringify(buildTeamAnalysisDb10())}\n`;
    if (sha256(firstTeamAnalysisDb10Json) !== sha256(secondTeamAnalysisDb10Json))
        throw new Error("DB10 determinism check failed: two native-semantic projections differ");
    const teamAnalysisDb10Gzip = (0, zlib_1.gzipSync)(Buffer.from(firstTeamAnalysisDb10Json, "utf8"), { level: 9 });
    const secondTeamAnalysisDb10Gzip = (0, zlib_1.gzipSync)(Buffer.from(secondTeamAnalysisDb10Json, "utf8"), { level: 9 });
    if (!teamAnalysisDb10Gzip.equals(secondTeamAnalysisDb10Gzip))
        throw new Error("DB10 determinism check failed: gzip bytes differ");
    const teamAnalysisDb10Coverage = (0, team_analysis_db10_builder_1.buildDatabaseTeamAnalysisDb10Coverage)(teamAnalysisDb10Dataset, teamAnalysisDb8Dataset);
    const teamAnalysisDb10Goldens = await (0, team_analysis_db10_golden_1.validateDatabaseTeamAnalysisDb10Goldens)(teamAnalysisDb10Dataset);
    if (teamAnalysisDb10Goldens.failures.length > 0)
        throw new Error(`DB10 golden fixture validation failed: ${JSON.stringify(teamAnalysisDb10Goldens.failures)}`);
    const teamAnalysisDb10Report = (0, team_analysis_db10_report_1.renderDatabaseTeamAnalysisDb10Report)(teamAnalysisDb10Dataset, teamAnalysisDb10Coverage);
    const buildTeamAnalysisDb11 = () => (0, team_analysis_db11_builder_1.buildDatabaseTeamAnalysisDb11Dataset)({
        db7: teamAnalysisDb7Dataset, db7Sha256: sha256(teamAnalysisDb7Gzip), db10: teamAnalysisDb10Dataset, db10Sha256: sha256(teamAnalysisDb10Gzip),
    });
    const teamAnalysisDb11Dataset = buildTeamAnalysisDb11();
    const firstTeamAnalysisDb11Json = `${JSON.stringify(teamAnalysisDb11Dataset)}\n`;
    const secondTeamAnalysisDb11Json = `${JSON.stringify(buildTeamAnalysisDb11())}\n`;
    if (sha256(firstTeamAnalysisDb11Json) !== sha256(secondTeamAnalysisDb11Json))
        throw new Error("DB11 determinism check failed: two runtime predicate projections differ");
    const teamAnalysisDb11Gzip = (0, zlib_1.gzipSync)(Buffer.from(firstTeamAnalysisDb11Json, "utf8"), { level: 9 });
    const secondTeamAnalysisDb11Gzip = (0, zlib_1.gzipSync)(Buffer.from(secondTeamAnalysisDb11Json, "utf8"), { level: 9 });
    if (!teamAnalysisDb11Gzip.equals(secondTeamAnalysisDb11Gzip))
        throw new Error("DB11 determinism check failed: gzip bytes differ");
    const teamAnalysisDb11Coverage = (0, team_analysis_db11_builder_1.buildDatabaseTeamAnalysisDb11Coverage)(teamAnalysisDb11Dataset, teamAnalysisDb7Dataset, teamAnalysisDb10Dataset);
    const teamAnalysisDb11Goldens = await (0, team_analysis_db11_golden_1.validateDatabaseTeamAnalysisDb11Goldens)(teamAnalysisDb11Dataset);
    if (teamAnalysisDb11Goldens.failures.length > 0)
        throw new Error(`DB11 golden fixture validation failed: ${JSON.stringify(teamAnalysisDb11Goldens.failures)}`);
    const teamAnalysisDb11Parity = (0, team_analysis_db11_parity_1.compareDatabaseTeamAnalysisDb11)(teamAnalysisDb11Dataset, currentTeamAnalysis.dataset, siteAudit);
    const teamAnalysisDb11ParityJson = `${JSON.stringify(teamAnalysisDb11Parity, null, 2)}\n`;
    const teamAnalysisDb11Report = (0, team_analysis_db11_report_1.renderDatabaseTeamAnalysisDb11Report)(teamAnalysisDb11Coverage, teamAnalysisDb11Parity, currentTeamAnalysis.dataset.parserVersion, teamAnalysisDb10Coverage);
    const buildTeamAnalysisDb12 = () => (0, team_analysis_db12_builder_1.buildDatabaseTeamAnalysisDb12Dataset)({
        db11: teamAnalysisDb11Dataset, db11Sha256: sha256(teamAnalysisDb11Gzip), db11Parity: teamAnalysisDb11Parity, db11ParitySha256: sha256(teamAnalysisDb11ParityJson),
        current: currentTeamAnalysis.dataset, currentSha256: currentTeamAnalysis.sha256, siteAudit,
    });
    const teamAnalysisDb12Dataset = buildTeamAnalysisDb12();
    const firstTeamAnalysisDb12Json = `${JSON.stringify(teamAnalysisDb12Dataset)}\n`;
    const secondTeamAnalysisDb12Json = `${JSON.stringify(buildTeamAnalysisDb12())}\n`;
    if (sha256(firstTeamAnalysisDb12Json) !== sha256(secondTeamAnalysisDb12Json))
        throw new Error("DB12 determinism check failed: two divergence attributions differ");
    const teamAnalysisDb12Gzip = (0, zlib_1.gzipSync)(Buffer.from(firstTeamAnalysisDb12Json, "utf8"), { level: 9 });
    const secondTeamAnalysisDb12Gzip = (0, zlib_1.gzipSync)(Buffer.from(secondTeamAnalysisDb12Json, "utf8"), { level: 9 });
    if (!teamAnalysisDb12Gzip.equals(secondTeamAnalysisDb12Gzip))
        throw new Error("DB12 determinism check failed: gzip bytes differ");
    const teamAnalysisDb12Coverage = (0, team_analysis_db12_builder_1.buildDatabaseTeamAnalysisDb12Coverage)(teamAnalysisDb12Dataset, teamAnalysisDb11Parity);
    const teamAnalysisDb12Goldens = await (0, team_analysis_db12_golden_1.validateDatabaseTeamAnalysisDb12Goldens)(teamAnalysisDb12Dataset, teamAnalysisDb12Coverage);
    if (teamAnalysisDb12Goldens.failures.length > 0)
        throw new Error(`DB12 golden fixture validation failed: ${JSON.stringify(teamAnalysisDb12Goldens.failures)}`);
    const teamAnalysisDb12Report = (0, team_analysis_db12_report_1.renderDatabaseTeamAnalysisDb12Report)(teamAnalysisDb12Dataset, teamAnalysisDb12Coverage);
    const buildTeamAnalysisDb13 = () => (0, team_analysis_db13_builder_1.buildDatabaseTeamAnalysisDb13Dataset)({ db11: teamAnalysisDb11Dataset, db11Sha256: sha256(teamAnalysisDb11Gzip), db12: teamAnalysisDb12Dataset, db12Sha256: sha256(teamAnalysisDb12Gzip), current: currentTeamAnalysis.dataset, currentSha256: currentTeamAnalysis.sha256, siteAudit });
    const teamAnalysisDb13Dataset = buildTeamAnalysisDb13();
    const firstTeamAnalysisDb13Json = `${JSON.stringify(teamAnalysisDb13Dataset)}\n`;
    const secondTeamAnalysisDb13Json = `${JSON.stringify(buildTeamAnalysisDb13())}\n`;
    if (sha256(firstTeamAnalysisDb13Json) !== sha256(secondTeamAnalysisDb13Json))
        throw new Error("DB13 determinism check failed: two rule alignments differ");
    const teamAnalysisDb13Gzip = (0, zlib_1.gzipSync)(Buffer.from(firstTeamAnalysisDb13Json, "utf8"), { level: 9 });
    const secondTeamAnalysisDb13Gzip = (0, zlib_1.gzipSync)(Buffer.from(secondTeamAnalysisDb13Json, "utf8"), { level: 9 });
    if (!teamAnalysisDb13Gzip.equals(secondTeamAnalysisDb13Gzip))
        throw new Error("DB13 determinism check failed: gzip bytes differ");
    const teamAnalysisDb13Coverage = (0, team_analysis_db13_builder_1.buildDatabaseTeamAnalysisDb13Coverage)(teamAnalysisDb13Dataset, teamAnalysisDb11Dataset, currentTeamAnalysis.dataset, siteAudit);
    const teamAnalysisDb13Goldens = await (0, team_analysis_db13_golden_1.validateDatabaseTeamAnalysisDb13Goldens)(teamAnalysisDb13Dataset, teamAnalysisDb13Coverage);
    if (teamAnalysisDb13Goldens.failures.length > 0)
        throw new Error(`DB13 golden fixture validation failed: ${JSON.stringify(teamAnalysisDb13Goldens.failures)}`);
    const teamAnalysisDb13Report = (0, team_analysis_db13_report_1.renderDatabaseTeamAnalysisDb13Report)(teamAnalysisDb13Dataset, teamAnalysisDb13Coverage);
    const buildTeamAnalysisDb14 = () => (0, team_analysis_db14_builder_1.buildDatabaseTeamAnalysisDb14Dataset)({
        db11: teamAnalysisDb11Dataset, db11Sha256: sha256(teamAnalysisDb11Gzip), db12: teamAnalysisDb12Dataset, db12Sha256: sha256(teamAnalysisDb12Gzip),
        db13: teamAnalysisDb13Dataset, db13Sha256: sha256(teamAnalysisDb13Gzip), currentSha256: currentTeamAnalysis.sha256, siteAudit,
    });
    const teamAnalysisDb14Dataset = buildTeamAnalysisDb14();
    const firstTeamAnalysisDb14Json = `${JSON.stringify(teamAnalysisDb14Dataset)}\n`;
    const secondTeamAnalysisDb14Json = `${JSON.stringify(buildTeamAnalysisDb14())}\n`;
    if (sha256(firstTeamAnalysisDb14Json) !== sha256(secondTeamAnalysisDb14Json))
        throw new Error("DB14 determinism check failed: two exact-turn compatibility projections differ");
    const teamAnalysisDb14Gzip = (0, zlib_1.gzipSync)(Buffer.from(firstTeamAnalysisDb14Json, "utf8"), { level: 9 });
    const secondTeamAnalysisDb14Gzip = (0, zlib_1.gzipSync)(Buffer.from(secondTeamAnalysisDb14Json, "utf8"), { level: 9 });
    if (!teamAnalysisDb14Gzip.equals(secondTeamAnalysisDb14Gzip))
        throw new Error("DB14 determinism check failed: gzip bytes differ");
    const teamAnalysisDb14Coverage = (0, team_analysis_db14_builder_1.buildDatabaseTeamAnalysisDb14Coverage)(teamAnalysisDb14Dataset, teamAnalysisDb13Dataset);
    const teamAnalysisDb14Goldens = await (0, team_analysis_db14_golden_1.validateDatabaseTeamAnalysisDb14Goldens)(teamAnalysisDb14Dataset, teamAnalysisDb14Coverage);
    if (teamAnalysisDb14Goldens.failures.length > 0)
        throw new Error(`DB14 golden fixture validation failed: ${JSON.stringify(teamAnalysisDb14Goldens.failures)}`);
    const teamAnalysisDb14Report = (0, team_analysis_db14_report_1.renderDatabaseTeamAnalysisDb14Report)(teamAnalysisDb14Dataset, teamAnalysisDb14Coverage);
    const buildTeamAnalysisDb15 = () => (0, team_analysis_db15_builder_1.buildDatabaseTeamAnalysisDb15Dataset)({
        db11: teamAnalysisDb11Dataset, db11Sha256: sha256(teamAnalysisDb11Gzip), db13: teamAnalysisDb13Dataset, db13Sha256: sha256(teamAnalysisDb13Gzip),
        db14: teamAnalysisDb14Dataset, db14Sha256: sha256(teamAnalysisDb14Gzip), current: currentTeamAnalysis.dataset, currentSha256: currentTeamAnalysis.sha256, siteAudit,
    });
    const teamAnalysisDb15Dataset = buildTeamAnalysisDb15();
    const firstTeamAnalysisDb15Json = `${JSON.stringify(teamAnalysisDb15Dataset)}\n`;
    const secondTeamAnalysisDb15Json = `${JSON.stringify(buildTeamAnalysisDb15())}\n`;
    if (sha256(firstTeamAnalysisDb15Json) !== sha256(secondTeamAnalysisDb15Json))
        throw new Error("DB15 determinism check failed: two rule-condition parity projections differ");
    const teamAnalysisDb15Gzip = (0, zlib_1.gzipSync)(Buffer.from(firstTeamAnalysisDb15Json, "utf8"), { level: 9 });
    const secondTeamAnalysisDb15Gzip = (0, zlib_1.gzipSync)(Buffer.from(secondTeamAnalysisDb15Json, "utf8"), { level: 9 });
    if (!teamAnalysisDb15Gzip.equals(secondTeamAnalysisDb15Gzip))
        throw new Error("DB15 determinism check failed: gzip bytes differ");
    const teamAnalysisDb15Coverage = (0, team_analysis_db15_builder_1.buildDatabaseTeamAnalysisDb15Coverage)(teamAnalysisDb15Dataset);
    const teamAnalysisDb15Goldens = await (0, team_analysis_db15_golden_1.validateDatabaseTeamAnalysisDb15Goldens)(teamAnalysisDb15Dataset, teamAnalysisDb15Coverage);
    if (teamAnalysisDb15Goldens.failures.length > 0)
        throw new Error(`DB15 golden fixture validation failed: ${JSON.stringify(teamAnalysisDb15Goldens.failures)}`);
    const teamAnalysisDb15Report = (0, team_analysis_db15_report_1.renderDatabaseTeamAnalysisDb15Report)(teamAnalysisDb15Dataset, teamAnalysisDb15Coverage);
    const buildTeamAnalysisDb16 = () => (0, team_analysis_db16_builder_1.buildDatabaseTeamAnalysisDb16Dataset)({ db15: teamAnalysisDb15Dataset, db15Sha256: sha256(teamAnalysisDb15Gzip) });
    const teamAnalysisDb16Dataset = buildTeamAnalysisDb16();
    const firstTeamAnalysisDb16Json = `${JSON.stringify(teamAnalysisDb16Dataset)}\n`;
    const secondTeamAnalysisDb16Json = `${JSON.stringify(buildTeamAnalysisDb16())}\n`;
    if (sha256(firstTeamAnalysisDb16Json) !== sha256(secondTeamAnalysisDb16Json))
        throw new Error("DB16 determinism check failed: two residual attributions differ");
    const teamAnalysisDb16Gzip = (0, zlib_1.gzipSync)(Buffer.from(firstTeamAnalysisDb16Json, "utf8"), { level: 9 });
    const secondTeamAnalysisDb16Gzip = (0, zlib_1.gzipSync)(Buffer.from(secondTeamAnalysisDb16Json, "utf8"), { level: 9 });
    if (!teamAnalysisDb16Gzip.equals(secondTeamAnalysisDb16Gzip))
        throw new Error("DB16 determinism check failed: gzip bytes differ");
    const teamAnalysisDb16Coverage = (0, team_analysis_db16_builder_1.buildDatabaseTeamAnalysisDb16Coverage)(teamAnalysisDb16Dataset);
    const teamAnalysisDb16Goldens = await (0, team_analysis_db16_golden_1.validateDatabaseTeamAnalysisDb16Goldens)(teamAnalysisDb16Dataset, teamAnalysisDb16Coverage);
    if (teamAnalysisDb16Goldens.failures.length > 0)
        throw new Error(`DB16 golden fixture validation failed: ${JSON.stringify(teamAnalysisDb16Goldens.failures)}`);
    const teamAnalysisDb16Report = (0, team_analysis_db16_report_1.renderDatabaseTeamAnalysisDb16Report)(teamAnalysisDb16Dataset, teamAnalysisDb16Coverage);
    const lifecycleEvidencePath = (0, path_1.resolve)(__dirname, "..", "..", "database-experiment", "native-appearance-turn-lifecycle.json");
    const lifecycleEvidenceBytes = await (0, promises_1.readFile)(lifecycleEvidencePath);
    const lifecycleEvidence = JSON.parse(lifecycleEvidenceBytes.toString("utf8"));
    const lifecycleEvidenceSha256 = sha256(lifecycleEvidenceBytes);
    const buildTeamAnalysisDb17 = () => (0, team_analysis_db17_builder_1.buildDatabaseTeamAnalysisDb17Dataset)({ db16: teamAnalysisDb16Dataset, db16Sha256: sha256(teamAnalysisDb16Gzip), inspection: nativeInspection, nativePath: options.nativeRuntimePath, nativeSha256: nativeBefore.sha256, nativeSizeBytes: nativeBefore.sizeBytes, evidence: lifecycleEvidence, evidenceSha256: lifecycleEvidenceSha256 });
    const teamAnalysisDb17Dataset = buildTeamAnalysisDb17();
    const firstTeamAnalysisDb17Json = `${JSON.stringify(teamAnalysisDb17Dataset)}\n`;
    const secondTeamAnalysisDb17Json = `${JSON.stringify(buildTeamAnalysisDb17())}\n`;
    if (sha256(firstTeamAnalysisDb17Json) !== sha256(secondTeamAnalysisDb17Json))
        throw new Error("DB17 determinism check failed: two lifecycle evidence projections differ");
    const teamAnalysisDb17Gzip = (0, zlib_1.gzipSync)(Buffer.from(firstTeamAnalysisDb17Json, "utf8"), { level: 9 });
    const secondTeamAnalysisDb17Gzip = (0, zlib_1.gzipSync)(Buffer.from(secondTeamAnalysisDb17Json, "utf8"), { level: 9 });
    if (!teamAnalysisDb17Gzip.equals(secondTeamAnalysisDb17Gzip))
        throw new Error("DB17 determinism check failed: gzip bytes differ");
    const teamAnalysisDb17Coverage = (0, team_analysis_db17_builder_1.buildDatabaseTeamAnalysisDb17Coverage)(teamAnalysisDb17Dataset, teamAnalysisDb16Dataset);
    const teamAnalysisDb17Goldens = await (0, team_analysis_db17_golden_1.validateDatabaseTeamAnalysisDb17Goldens)(teamAnalysisDb17Dataset, teamAnalysisDb17Coverage);
    if (teamAnalysisDb17Goldens.failures.length > 0)
        throw new Error(`DB17 golden fixture validation failed: ${JSON.stringify(teamAnalysisDb17Goldens.failures)}`);
    const teamAnalysisDb17Report = (0, team_analysis_db17_report_1.renderDatabaseTeamAnalysisDb17Report)(teamAnalysisDb17Dataset, teamAnalysisDb17Coverage);
    const buildTeamAnalysisDb18 = () => (0, team_analysis_db18_builder_1.buildDatabaseTeamAnalysisDb18Dataset)({ db15: teamAnalysisDb15Dataset, db15Sha256: sha256(teamAnalysisDb15Gzip), db16: teamAnalysisDb16Dataset, db16Sha256: sha256(teamAnalysisDb16Gzip), db17: teamAnalysisDb17Dataset, db17Sha256: sha256(teamAnalysisDb17Gzip) });
    const teamAnalysisDb18Dataset = buildTeamAnalysisDb18();
    const firstTeamAnalysisDb18Json = `${JSON.stringify(teamAnalysisDb18Dataset)}\n`;
    const secondTeamAnalysisDb18Json = `${JSON.stringify(buildTeamAnalysisDb18())}\n`;
    if (sha256(firstTeamAnalysisDb18Json) !== sha256(secondTeamAnalysisDb18Json))
        throw new Error("DB18 determinism check failed: two lifecycle compatibility projections differ");
    const teamAnalysisDb18Gzip = (0, zlib_1.gzipSync)(Buffer.from(firstTeamAnalysisDb18Json, "utf8"), { level: 9 });
    const secondTeamAnalysisDb18Gzip = (0, zlib_1.gzipSync)(Buffer.from(secondTeamAnalysisDb18Json, "utf8"), { level: 9 });
    if (!teamAnalysisDb18Gzip.equals(secondTeamAnalysisDb18Gzip))
        throw new Error("DB18 determinism check failed: gzip bytes differ");
    const teamAnalysisDb18Coverage = (0, team_analysis_db18_builder_1.buildDatabaseTeamAnalysisDb18Coverage)(teamAnalysisDb18Dataset, teamAnalysisDb15Dataset);
    const teamAnalysisDb18Goldens = await (0, team_analysis_db18_golden_1.validateDatabaseTeamAnalysisDb18Goldens)(teamAnalysisDb18Dataset, teamAnalysisDb18Coverage);
    if (teamAnalysisDb18Goldens.failures.length > 0)
        throw new Error(`DB18 golden fixture validation failed: ${JSON.stringify(teamAnalysisDb18Goldens.failures)}`);
    const teamAnalysisDb18Report = (0, team_analysis_db18_report_1.renderDatabaseTeamAnalysisDb18Report)(teamAnalysisDb18Dataset, teamAnalysisDb18Coverage);
    const buildTeamAnalysisDb19 = () => (0, team_analysis_db19_builder_1.buildDatabaseTeamAnalysisDb19Dataset)({ db15: teamAnalysisDb15Dataset, db15Sha256: sha256(teamAnalysisDb15Gzip), db18: teamAnalysisDb18Dataset, db18Sha256: sha256(teamAnalysisDb18Gzip) });
    const teamAnalysisDb19Dataset = buildTeamAnalysisDb19();
    const firstTeamAnalysisDb19Json = `${JSON.stringify(teamAnalysisDb19Dataset)}\n`;
    const secondTeamAnalysisDb19Json = `${JSON.stringify(buildTeamAnalysisDb19())}\n`;
    if (sha256(firstTeamAnalysisDb19Json) !== sha256(secondTeamAnalysisDb19Json))
        throw new Error("DB19 determinism check failed: two residual attributions differ");
    const teamAnalysisDb19Gzip = (0, zlib_1.gzipSync)(Buffer.from(firstTeamAnalysisDb19Json, "utf8"), { level: 9 });
    const secondTeamAnalysisDb19Gzip = (0, zlib_1.gzipSync)(Buffer.from(secondTeamAnalysisDb19Json, "utf8"), { level: 9 });
    if (!teamAnalysisDb19Gzip.equals(secondTeamAnalysisDb19Gzip))
        throw new Error("DB19 determinism check failed: gzip bytes differ");
    const teamAnalysisDb19Coverage = (0, team_analysis_db19_builder_1.buildDatabaseTeamAnalysisDb19Coverage)(teamAnalysisDb19Dataset, teamAnalysisDb15Dataset.ruleConditionParity.length);
    const teamAnalysisDb19Goldens = await (0, team_analysis_db19_golden_1.validateDatabaseTeamAnalysisDb19Goldens)(teamAnalysisDb19Dataset, teamAnalysisDb19Coverage);
    if (teamAnalysisDb19Goldens.failures.length > 0)
        throw new Error(`DB19 golden fixture validation failed: ${JSON.stringify(teamAnalysisDb19Goldens.failures)}`);
    const teamAnalysisDb19Report = (0, team_analysis_db19_report_1.renderDatabaseTeamAnalysisDb19Report)(teamAnalysisDb19Dataset, teamAnalysisDb19Coverage);
    const buildTeamAnalysisDb20 = () => (0, team_analysis_db20_builder_1.buildDatabaseTeamAnalysisDb20Dataset)({ db11: teamAnalysisDb11Dataset, db11Sha256: sha256(teamAnalysisDb11Gzip), db19: teamAnalysisDb19Dataset, db19Sha256: sha256(teamAnalysisDb19Gzip), tables });
    const teamAnalysisDb20Dataset = buildTeamAnalysisDb20();
    const firstTeamAnalysisDb20Json = `${JSON.stringify(teamAnalysisDb20Dataset)}\n`;
    const secondTeamAnalysisDb20Json = `${JSON.stringify(buildTeamAnalysisDb20())}\n`;
    if (sha256(firstTeamAnalysisDb20Json) !== sha256(secondTeamAnalysisDb20Json))
        throw new Error("DB20 determinism check failed: two passive turn correlations differ");
    const teamAnalysisDb20Gzip = (0, zlib_1.gzipSync)(Buffer.from(firstTeamAnalysisDb20Json, "utf8"), { level: 9 });
    const secondTeamAnalysisDb20Gzip = (0, zlib_1.gzipSync)(Buffer.from(secondTeamAnalysisDb20Json, "utf8"), { level: 9 });
    if (!teamAnalysisDb20Gzip.equals(secondTeamAnalysisDb20Gzip))
        throw new Error("DB20 determinism check failed: gzip bytes differ");
    const teamAnalysisDb20Coverage = (0, team_analysis_db20_builder_1.buildDatabaseTeamAnalysisDb20Coverage)(teamAnalysisDb20Dataset);
    const teamAnalysisDb20Goldens = await (0, team_analysis_db20_golden_1.validateDatabaseTeamAnalysisDb20Goldens)(teamAnalysisDb20Dataset, teamAnalysisDb20Coverage);
    if (teamAnalysisDb20Goldens.failures.length > 0)
        throw new Error(`DB20 golden fixture validation failed: ${JSON.stringify(teamAnalysisDb20Goldens.failures)}`);
    const teamAnalysisDb20Report = (0, team_analysis_db20_report_1.renderDatabaseTeamAnalysisDb20Report)(teamAnalysisDb20Dataset, teamAnalysisDb20Coverage);
    const nativeLinkageEvidencePath = (0, path_1.resolve)(__dirname, "..", "..", "database-experiment", "native-passive-turn-linkage-audit.json");
    const nativeLinkageEvidenceBytes = await (0, promises_1.readFile)(nativeLinkageEvidencePath);
    const nativeLinkageEvidence = JSON.parse(nativeLinkageEvidenceBytes.toString("utf8"));
    const nativeLinkageEvidenceSha256 = sha256(nativeLinkageEvidenceBytes);
    const buildTeamAnalysisDb21 = () => (0, team_analysis_db21_builder_1.buildDatabaseTeamAnalysisDb21Dataset)({ db20: teamAnalysisDb20Dataset, db20Coverage: teamAnalysisDb20Coverage, db20Sha256: sha256(teamAnalysisDb20Gzip), inspection: nativeInspection, nativePath: options.nativeRuntimePath, nativeSha256: nativeBefore.sha256, nativeSizeBytes: nativeBefore.sizeBytes, evidence: nativeLinkageEvidence, evidenceSha256: nativeLinkageEvidenceSha256 });
    const teamAnalysisDb21Dataset = buildTeamAnalysisDb21();
    const firstTeamAnalysisDb21Json = `${JSON.stringify(teamAnalysisDb21Dataset)}\n`;
    const secondTeamAnalysisDb21Json = `${JSON.stringify(buildTeamAnalysisDb21())}\n`;
    if (sha256(firstTeamAnalysisDb21Json) !== sha256(secondTeamAnalysisDb21Json))
        throw new Error("DB21 determinism check failed: two native linkage audits differ");
    const teamAnalysisDb21Gzip = (0, zlib_1.gzipSync)(Buffer.from(firstTeamAnalysisDb21Json, "utf8"), { level: 9 });
    const secondTeamAnalysisDb21Gzip = (0, zlib_1.gzipSync)(Buffer.from(secondTeamAnalysisDb21Json, "utf8"), { level: 9 });
    if (!teamAnalysisDb21Gzip.equals(secondTeamAnalysisDb21Gzip))
        throw new Error("DB21 determinism check failed: gzip bytes differ");
    const teamAnalysisDb21Coverage = (0, team_analysis_db21_builder_1.buildDatabaseTeamAnalysisDb21Coverage)(teamAnalysisDb21Dataset);
    const teamAnalysisDb21Goldens = await (0, team_analysis_db21_golden_1.validateDatabaseTeamAnalysisDb21Goldens)(teamAnalysisDb21Dataset, teamAnalysisDb21Coverage);
    if (teamAnalysisDb21Goldens.failures.length > 0)
        throw new Error(`DB21 golden fixture validation failed: ${JSON.stringify(teamAnalysisDb21Goldens.failures)}`);
    const teamAnalysisDb21Report = (0, team_analysis_db21_report_1.renderDatabaseTeamAnalysisDb21Report)(teamAnalysisDb21Dataset, teamAnalysisDb21Coverage);
    const buildTeamAnalysisDb22 = () => (0, team_analysis_db22_builder_1.buildDatabaseTeamAnalysisDb22Dataset)({ db15: teamAnalysisDb15Dataset, db15Sha256: sha256(teamAnalysisDb15Gzip), db17: teamAnalysisDb17Dataset, db17Sha256: sha256(teamAnalysisDb17Gzip), db18: teamAnalysisDb18Dataset, db18Sha256: sha256(teamAnalysisDb18Gzip), db21: teamAnalysisDb21Dataset, db21Sha256: sha256(teamAnalysisDb21Gzip), current: currentTeamAnalysis.dataset, currentSha256: currentTeamAnalysis.sha256 });
    const teamAnalysisDb22Dataset = buildTeamAnalysisDb22();
    const firstTeamAnalysisDb22Json = `${JSON.stringify(teamAnalysisDb22Dataset)}\n`;
    const secondTeamAnalysisDb22Json = `${JSON.stringify(buildTeamAnalysisDb22())}\n`;
    if (sha256(firstTeamAnalysisDb22Json) !== sha256(secondTeamAnalysisDb22Json))
        throw new Error("DB22 determinism check failed: two lifecycle AST projections differ");
    const teamAnalysisDb22Gzip = (0, zlib_1.gzipSync)(Buffer.from(firstTeamAnalysisDb22Json, "utf8"), { level: 9 });
    const secondTeamAnalysisDb22Gzip = (0, zlib_1.gzipSync)(Buffer.from(secondTeamAnalysisDb22Json, "utf8"), { level: 9 });
    if (!teamAnalysisDb22Gzip.equals(secondTeamAnalysisDb22Gzip))
        throw new Error("DB22 determinism check failed: gzip bytes differ");
    const teamAnalysisDb22Coverage = (0, team_analysis_db22_builder_1.buildDatabaseTeamAnalysisDb22Coverage)(teamAnalysisDb22Dataset, teamAnalysisDb15Dataset, teamAnalysisDb18Dataset);
    const teamAnalysisDb22Goldens = await (0, team_analysis_db22_golden_1.validateDatabaseTeamAnalysisDb22Goldens)(teamAnalysisDb22Dataset, teamAnalysisDb22Coverage);
    if (teamAnalysisDb22Goldens.failures.length > 0)
        throw new Error(`DB22 golden fixture validation failed: ${JSON.stringify(teamAnalysisDb22Goldens.failures)}`);
    const teamAnalysisDb22Report = (0, team_analysis_db22_report_1.renderDatabaseTeamAnalysisDb22Report)(teamAnalysisDb22Dataset, teamAnalysisDb22Coverage);
    const buildTeamAnalysisDb23 = () => (0, team_analysis_db23_builder_1.buildDatabaseTeamAnalysisDb23Dataset)({ db15: teamAnalysisDb15Dataset, db15Sha256: sha256(teamAnalysisDb15Gzip), db18: teamAnalysisDb18Dataset, db18Sha256: sha256(teamAnalysisDb18Gzip), db22: teamAnalysisDb22Dataset, db22Sha256: sha256(teamAnalysisDb22Gzip) });
    const teamAnalysisDb23Dataset = buildTeamAnalysisDb23();
    const firstTeamAnalysisDb23Json = `${JSON.stringify(teamAnalysisDb23Dataset)}\n`;
    const secondTeamAnalysisDb23Json = `${JSON.stringify(buildTeamAnalysisDb23())}\n`;
    if (sha256(firstTeamAnalysisDb23Json) !== sha256(secondTeamAnalysisDb23Json))
        throw new Error("DB23 determinism check failed: two post-AST residual attributions differ");
    const teamAnalysisDb23Gzip = (0, zlib_1.gzipSync)(Buffer.from(firstTeamAnalysisDb23Json, "utf8"), { level: 9 });
    const secondTeamAnalysisDb23Gzip = (0, zlib_1.gzipSync)(Buffer.from(secondTeamAnalysisDb23Json, "utf8"), { level: 9 });
    if (!teamAnalysisDb23Gzip.equals(secondTeamAnalysisDb23Gzip))
        throw new Error("DB23 determinism check failed: gzip bytes differ");
    const teamAnalysisDb23Coverage = (0, team_analysis_db23_builder_1.buildDatabaseTeamAnalysisDb23Coverage)(teamAnalysisDb23Dataset, teamAnalysisDb15Dataset.ruleConditionParity.length);
    const teamAnalysisDb23Goldens = await (0, team_analysis_db23_golden_1.validateDatabaseTeamAnalysisDb23Goldens)(teamAnalysisDb23Dataset, teamAnalysisDb23Coverage);
    if (teamAnalysisDb23Goldens.failures.length > 0)
        throw new Error(`DB23 golden fixture validation failed: ${JSON.stringify(teamAnalysisDb23Goldens.failures)}`);
    const teamAnalysisDb23Report = (0, team_analysis_db23_report_1.renderDatabaseTeamAnalysisDb23Report)(teamAnalysisDb23Dataset, teamAnalysisDb23Coverage);
    const counterEvidencePath = (0, path_1.resolve)(__dirname, "..", "..", "database-experiment", "native-counter-behavior-semantics.json");
    const counterEvidenceBytes = await (0, promises_1.readFile)(counterEvidencePath);
    const counterEvidence = JSON.parse(counterEvidenceBytes.toString("utf8"));
    const counterEvidenceSha256 = sha256(counterEvidenceBytes);
    const buildTeamAnalysisDb24 = () => (0, team_analysis_db24_builder_1.buildDatabaseTeamAnalysisDb24Dataset)({ db8: teamAnalysisDb8Dataset, db8Sha256: sha256(teamAnalysisDb8Gzip), db9: teamAnalysisDb9Dataset, db9Sha256: sha256(teamAnalysisDb9Gzip), db11: teamAnalysisDb11Dataset, db11Sha256: sha256(teamAnalysisDb11Gzip), tables, inspection: nativeInspection, nativeSha256: nativeBefore.sha256, nativeSizeBytes: nativeBefore.sizeBytes, evidence: counterEvidence, evidenceSha256: counterEvidenceSha256 });
    const teamAnalysisDb24Dataset = buildTeamAnalysisDb24();
    const firstTeamAnalysisDb24Json = `${JSON.stringify(teamAnalysisDb24Dataset)}\n`;
    const secondTeamAnalysisDb24Json = `${JSON.stringify(buildTeamAnalysisDb24())}\n`;
    if (sha256(firstTeamAnalysisDb24Json) !== sha256(secondTeamAnalysisDb24Json))
        throw new Error("DB24 determinism check failed: two counter behavior projections differ");
    const teamAnalysisDb24Gzip = (0, zlib_1.gzipSync)(Buffer.from(firstTeamAnalysisDb24Json, "utf8"), { level: 9 });
    const secondTeamAnalysisDb24Gzip = (0, zlib_1.gzipSync)(Buffer.from(secondTeamAnalysisDb24Json, "utf8"), { level: 9 });
    if (!teamAnalysisDb24Gzip.equals(secondTeamAnalysisDb24Gzip))
        throw new Error("DB24 determinism check failed: gzip bytes differ");
    const teamAnalysisDb24SourceGapRuleCount = teamAnalysisDb8Dataset.efficacyGaps.find(value => Number(value.efficacyType) === 120)?.ruleCount ?? 0;
    const teamAnalysisDb24Coverage = (0, team_analysis_db24_builder_1.buildDatabaseTeamAnalysisDb24Coverage)(teamAnalysisDb24Dataset, teamAnalysisDb24SourceGapRuleCount);
    const teamAnalysisDb24Goldens = await (0, team_analysis_db24_golden_1.validateDatabaseTeamAnalysisDb24Goldens)(teamAnalysisDb24Dataset, teamAnalysisDb24Coverage);
    if (teamAnalysisDb24Goldens.failures.length > 0)
        throw new Error(`DB24 golden fixture validation failed: ${JSON.stringify(teamAnalysisDb24Goldens.failures)}`);
    const teamAnalysisDb24Report = (0, team_analysis_db24_report_1.renderDatabaseTeamAnalysisDb24Report)(teamAnalysisDb24Dataset, teamAnalysisDb24Coverage);
    const attackContextEvidencePath = (0, path_1.resolve)(__dirname, "..", "..", "database-experiment", "native-attack-context-semantics.json");
    const attackContextEvidenceBytes = await (0, promises_1.readFile)(attackContextEvidencePath);
    const attackContextEvidence = JSON.parse(attackContextEvidenceBytes.toString("utf8"));
    const attackContextEvidenceSha256 = sha256(attackContextEvidenceBytes);
    const buildTeamAnalysisDb25 = () => (0, team_analysis_db25_builder_1.buildDatabaseTeamAnalysisDb25Dataset)({ db8: teamAnalysisDb8Dataset, db8Sha256: sha256(teamAnalysisDb8Gzip), db9: teamAnalysisDb9Dataset, db9Sha256: sha256(teamAnalysisDb9Gzip), db11: teamAnalysisDb11Dataset, db11Sha256: sha256(teamAnalysisDb11Gzip), tables, inspection: nativeInspection, nativeSha256: nativeBefore.sha256, nativeSizeBytes: nativeBefore.sizeBytes, evidence: attackContextEvidence, evidenceSha256: attackContextEvidenceSha256 });
    const teamAnalysisDb25Dataset = buildTeamAnalysisDb25();
    const firstTeamAnalysisDb25Json = `${JSON.stringify(teamAnalysisDb25Dataset)}\n`;
    const secondTeamAnalysisDb25Json = `${JSON.stringify(buildTeamAnalysisDb25())}\n`;
    if (sha256(firstTeamAnalysisDb25Json) !== sha256(secondTeamAnalysisDb25Json))
        throw new Error("DB25 determinism check failed: two attack-context corrections differ");
    const teamAnalysisDb25Gzip = (0, zlib_1.gzipSync)(Buffer.from(firstTeamAnalysisDb25Json, "utf8"), { level: 9 });
    const secondTeamAnalysisDb25Gzip = (0, zlib_1.gzipSync)(Buffer.from(secondTeamAnalysisDb25Json, "utf8"), { level: 9 });
    if (!teamAnalysisDb25Gzip.equals(secondTeamAnalysisDb25Gzip))
        throw new Error("DB25 determinism check failed: gzip bytes differ");
    const teamAnalysisDb25Coverage = (0, team_analysis_db25_builder_1.buildDatabaseTeamAnalysisDb25Coverage)(teamAnalysisDb25Dataset);
    const teamAnalysisDb25Goldens = await (0, team_analysis_db25_golden_1.validateDatabaseTeamAnalysisDb25Goldens)(teamAnalysisDb25Dataset, teamAnalysisDb25Coverage);
    if (teamAnalysisDb25Goldens.failures.length > 0)
        throw new Error(`DB25 golden fixture validation failed: ${JSON.stringify(teamAnalysisDb25Goldens.failures)}`);
    const teamAnalysisDb25Report = (0, team_analysis_db25_report_1.renderDatabaseTeamAnalysisDb25Report)(teamAnalysisDb25Dataset, teamAnalysisDb25Coverage);
    const specialCategoryEvidencePath = (0, path_1.resolve)(__dirname, "..", "..", "database-experiment", "native-special-category-semantics.json");
    const specialCategoryEvidenceBytes = await (0, promises_1.readFile)(specialCategoryEvidencePath);
    const specialCategoryEvidence = JSON.parse(specialCategoryEvidenceBytes.toString("utf8"));
    const specialCategoryEvidenceSha256 = sha256(specialCategoryEvidenceBytes);
    const buildTeamAnalysisDb26 = () => (0, team_analysis_db26_builder_1.buildDatabaseTeamAnalysisDb26Dataset)({ db8: teamAnalysisDb8Dataset, db8Sha256: sha256(teamAnalysisDb8Gzip), db9: teamAnalysisDb9Dataset, db9Sha256: sha256(teamAnalysisDb9Gzip), db11: teamAnalysisDb11Dataset, db11Sha256: sha256(teamAnalysisDb11Gzip), tables, inspection: nativeInspection, nativeSha256: nativeBefore.sha256, nativeSizeBytes: nativeBefore.sizeBytes, evidence: specialCategoryEvidence, evidenceSha256: specialCategoryEvidenceSha256 });
    const teamAnalysisDb26Dataset = buildTeamAnalysisDb26();
    const firstTeamAnalysisDb26Json = `${JSON.stringify(teamAnalysisDb26Dataset)}\n`;
    const secondTeamAnalysisDb26Json = `${JSON.stringify(buildTeamAnalysisDb26())}\n`;
    if (sha256(firstTeamAnalysisDb26Json) !== sha256(secondTeamAnalysisDb26Json))
        throw new Error("DB26 determinism check failed: two special-category projections differ");
    const teamAnalysisDb26Gzip = (0, zlib_1.gzipSync)(Buffer.from(firstTeamAnalysisDb26Json, "utf8"), { level: 9 });
    const secondTeamAnalysisDb26Gzip = (0, zlib_1.gzipSync)(Buffer.from(secondTeamAnalysisDb26Json, "utf8"), { level: 9 });
    if (!teamAnalysisDb26Gzip.equals(secondTeamAnalysisDb26Gzip))
        throw new Error("DB26 determinism check failed: gzip bytes differ");
    const teamAnalysisDb26SourceGapOccurrenceCount = teamAnalysisDb8Dataset.causalityGaps.find(value => Number(value.causalityType) === 49)?.occurrenceCount ?? 0;
    const teamAnalysisDb26Coverage = (0, team_analysis_db26_builder_1.buildDatabaseTeamAnalysisDb26Coverage)(teamAnalysisDb26Dataset, teamAnalysisDb26SourceGapOccurrenceCount);
    const teamAnalysisDb26Goldens = await (0, team_analysis_db26_golden_1.validateDatabaseTeamAnalysisDb26Goldens)(teamAnalysisDb26Dataset, teamAnalysisDb26Coverage);
    if (teamAnalysisDb26Goldens.failures.length > 0)
        throw new Error(`DB26 golden fixture validation failed: ${JSON.stringify(teamAnalysisDb26Goldens.failures)}`);
    const teamAnalysisDb26Report = (0, team_analysis_db26_report_1.renderDatabaseTeamAnalysisDb26Report)(teamAnalysisDb26Dataset, teamAnalysisDb26Coverage);
    const targetHpEvidencePath = (0, path_1.resolve)(__dirname, "..", "..", "database-experiment", "native-target-hp-semantics.json");
    const targetHpEvidenceBytes = await (0, promises_1.readFile)(targetHpEvidencePath);
    const targetHpEvidence = JSON.parse(targetHpEvidenceBytes.toString("utf8"));
    const targetHpEvidenceSha256 = sha256(targetHpEvidenceBytes);
    const buildTeamAnalysisDb27 = () => (0, team_analysis_db27_builder_1.buildDatabaseTeamAnalysisDb27Dataset)({ db8: teamAnalysisDb8Dataset, db8Sha256: sha256(teamAnalysisDb8Gzip), db9: teamAnalysisDb9Dataset, db9Sha256: sha256(teamAnalysisDb9Gzip), db11: teamAnalysisDb11Dataset, db11Sha256: sha256(teamAnalysisDb11Gzip), tables, inspection: nativeInspection, nativeSha256: nativeBefore.sha256, nativeSizeBytes: nativeBefore.sizeBytes, evidence: targetHpEvidence, evidenceSha256: targetHpEvidenceSha256 });
    const teamAnalysisDb27Dataset = buildTeamAnalysisDb27();
    const firstTeamAnalysisDb27Json = `${JSON.stringify(teamAnalysisDb27Dataset)}\n`;
    const secondTeamAnalysisDb27Json = `${JSON.stringify(buildTeamAnalysisDb27())}\n`;
    if (sha256(firstTeamAnalysisDb27Json) !== sha256(secondTeamAnalysisDb27Json))
        throw new Error("DB27 determinism check failed: two target-HP projections differ");
    const teamAnalysisDb27Gzip = (0, zlib_1.gzipSync)(Buffer.from(firstTeamAnalysisDb27Json, "utf8"), { level: 9 });
    const secondTeamAnalysisDb27Gzip = (0, zlib_1.gzipSync)(Buffer.from(secondTeamAnalysisDb27Json, "utf8"), { level: 9 });
    if (!teamAnalysisDb27Gzip.equals(secondTeamAnalysisDb27Gzip))
        throw new Error("DB27 determinism check failed: gzip bytes differ");
    const teamAnalysisDb27SourceGapOccurrenceCount = teamAnalysisDb8Dataset.causalityGaps.filter(value => [17, 18, 33].includes(Number(value.causalityType))).reduce((sum, value) => sum + value.occurrenceCount, 0);
    const teamAnalysisDb27Coverage = (0, team_analysis_db27_builder_1.buildDatabaseTeamAnalysisDb27Coverage)(teamAnalysisDb27Dataset, teamAnalysisDb27SourceGapOccurrenceCount);
    const teamAnalysisDb27Goldens = await (0, team_analysis_db27_golden_1.validateDatabaseTeamAnalysisDb27Goldens)(teamAnalysisDb27Dataset, teamAnalysisDb27Coverage);
    if (teamAnalysisDb27Goldens.failures.length > 0)
        throw new Error(`DB27 golden fixture validation failed: ${JSON.stringify(teamAnalysisDb27Goldens.failures)}`);
    const teamAnalysisDb27Report = (0, team_analysis_db27_report_1.renderDatabaseTeamAnalysisDb27Report)(teamAnalysisDb27Coverage);
    const revivalCounterEvidencePath = (0, path_1.resolve)(__dirname, "..", "..", "database-experiment", "native-revival-counter-semantics.json");
    const revivalCounterEvidenceBytes = await (0, promises_1.readFile)(revivalCounterEvidencePath);
    const revivalCounterEvidence = JSON.parse(revivalCounterEvidenceBytes.toString("utf8"));
    const revivalCounterEvidenceSha256 = sha256(revivalCounterEvidenceBytes);
    const buildTeamAnalysisDb28 = () => (0, team_analysis_db28_builder_1.buildDatabaseTeamAnalysisDb28Dataset)({ db8: teamAnalysisDb8Dataset, db8Sha256: sha256(teamAnalysisDb8Gzip), db9: teamAnalysisDb9Dataset, db9Sha256: sha256(teamAnalysisDb9Gzip), db11: teamAnalysisDb11Dataset, db11Sha256: sha256(teamAnalysisDb11Gzip), tables, inspection: nativeInspection, nativeSha256: nativeBefore.sha256, nativeSizeBytes: nativeBefore.sizeBytes, evidence: revivalCounterEvidence, evidenceSha256: revivalCounterEvidenceSha256 });
    const teamAnalysisDb28Dataset = buildTeamAnalysisDb28();
    const firstTeamAnalysisDb28Json = `${JSON.stringify(teamAnalysisDb28Dataset)}\n`;
    const secondTeamAnalysisDb28Json = `${JSON.stringify(buildTeamAnalysisDb28())}\n`;
    if (sha256(firstTeamAnalysisDb28Json) !== sha256(secondTeamAnalysisDb28Json))
        throw new Error("DB28 determinism check failed: two revival-counter projections differ");
    const teamAnalysisDb28Gzip = (0, zlib_1.gzipSync)(Buffer.from(firstTeamAnalysisDb28Json, "utf8"), { level: 9 });
    const secondTeamAnalysisDb28Gzip = (0, zlib_1.gzipSync)(Buffer.from(secondTeamAnalysisDb28Json, "utf8"), { level: 9 });
    if (!teamAnalysisDb28Gzip.equals(secondTeamAnalysisDb28Gzip))
        throw new Error("DB28 determinism check failed: gzip bytes differ");
    const teamAnalysisDb28SourceGapOccurrenceCount = teamAnalysisDb8Dataset.causalityGaps.filter(value => [47, 54].includes(Number(value.causalityType))).reduce((sum, value) => sum + value.occurrenceCount, 0);
    const teamAnalysisDb28Coverage = (0, team_analysis_db28_builder_1.buildDatabaseTeamAnalysisDb28Coverage)(teamAnalysisDb28Dataset, teamAnalysisDb28SourceGapOccurrenceCount);
    const teamAnalysisDb28Goldens = await (0, team_analysis_db28_golden_1.validateDatabaseTeamAnalysisDb28Goldens)(teamAnalysisDb28Dataset, teamAnalysisDb28Coverage);
    if (teamAnalysisDb28Goldens.failures.length > 0)
        throw new Error(`DB28 golden fixture validation failed: ${JSON.stringify(teamAnalysisDb28Goldens.failures)}`);
    const teamAnalysisDb28Report = (0, team_analysis_db28_report_1.renderDatabaseTeamAnalysisDb28Report)(teamAnalysisDb28Coverage);
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
    const teamAnalysisDb6Manifest = {
        schemaVersion: 1,
        contractVersion: "0.5.0",
        generatedAt: options.generatedAt,
        fileName: "team-analysis-db6-experiment.json.gz",
        compression: "gzip",
        sha256: sha256(teamAnalysisDb6Gzip),
        sizeBytes: teamAnalysisDb6Gzip.byteLength,
        uncompressedSizeBytes: Buffer.byteLength(firstTeamAnalysisDb6Json, "utf8"),
        stateCount: teamAnalysisDb6Dataset.states.length,
        sourceSha256: before.sha256,
        currentTeamAnalysisSha256: currentTeamAnalysis.sha256,
        coverageFile: "team-analysis-db6-coverage.json",
        parityFile: "team-analysis-db6-parity.json",
        reportFile: "team-analysis-db6-report.md",
        goldenValidationFile: "team-analysis-db6-golden-validation.json",
    };
    const teamAnalysisDb7Manifest = {
        schemaVersion: 1, contractVersion: "0.6.0", generatedAt: options.generatedAt,
        fileName: "team-analysis-db7-experiment.json.gz", compression: "gzip", sha256: sha256(teamAnalysisDb7Gzip),
        sizeBytes: teamAnalysisDb7Gzip.byteLength, uncompressedSizeBytes: Buffer.byteLength(firstTeamAnalysisDb7Json, "utf8"),
        stateCount: teamAnalysisDb7Dataset.states.length, sourceSha256: before.sha256, currentTeamAnalysisSha256: currentTeamAnalysis.sha256,
        coverageFile: "team-analysis-db7-coverage.json", parityFile: "team-analysis-db7-parity.json", reportFile: "team-analysis-db7-report.md", goldenValidationFile: "team-analysis-db7-golden-validation.json",
    };
    const teamAnalysisDb8Manifest = {
        schemaVersion: 1, contractVersion: "0.7.0", generatedAt: options.generatedAt,
        fileName: "team-analysis-db8-evidence-experiment.json.gz", compression: "gzip", sha256: sha256(teamAnalysisDb8Gzip),
        sizeBytes: teamAnalysisDb8Gzip.byteLength, uncompressedSizeBytes: Buffer.byteLength(firstTeamAnalysisDb8Json, "utf8"),
        sourceStateCount: teamAnalysisDb8Dataset.sourceStateCount, semanticPromotionCount: 0, sourceSha256: before.sha256,
        sourceDb7Sha256: sha256(teamAnalysisDb7Gzip), coverageFile: "team-analysis-db8-coverage.json", reportFile: "team-analysis-db8-report.md",
        goldenValidationFile: "team-analysis-db8-golden-validation.json",
    };
    const teamAnalysisDb9Manifest = { schemaVersion: 1, contractVersion: "0.8.0", generatedAt: options.generatedAt,
        fileName: "team-analysis-db9-runtime-evidence.json.gz", compression: "gzip", sha256: sha256(teamAnalysisDb9Gzip), sizeBytes: teamAnalysisDb9Gzip.byteLength, uncompressedSizeBytes: Buffer.byteLength(firstTeamAnalysisDb9Json, "utf8"),
        semanticPromotionCount: 0, runtimeIdentityResolutionCount: teamAnalysisDb9Dataset.runtimeIdentityResolutionCount, sourceDatabaseSha256: before.sha256, sourceDb8Sha256: sha256(teamAnalysisDb8Gzip), nativeRuntimeSha256: nativeBefore.sha256, nativeRuntimeLayoutSha256: nativeLayoutSha256,
        coverageFile: "team-analysis-db9-coverage.json", reportFile: "team-analysis-db9-report.md", goldenValidationFile: "team-analysis-db9-golden-validation.json" };
    const teamAnalysisDb10Manifest = { schemaVersion: 1, contractVersion: "0.9.0", generatedAt: options.generatedAt,
        fileName: "team-analysis-db10-semantic-evidence.json.gz", compression: "gzip", sha256: sha256(teamAnalysisDb10Gzip), sizeBytes: teamAnalysisDb10Gzip.byteLength, uncompressedSizeBytes: Buffer.byteLength(firstTeamAnalysisDb10Json, "utf8"),
        semanticPromotionCount: 3, promotedOccurrenceCount: teamAnalysisDb10Dataset.promotedOccurrenceCount, sourceDatabaseSha256: before.sha256,
        sourceDb8Sha256: sha256(teamAnalysisDb8Gzip), sourceDb9Sha256: sha256(teamAnalysisDb9Gzip), nativeRuntimeSha256: nativeBefore.sha256, nativeSemanticsLayoutSha256: nativeSemanticsSha256,
        coverageFile: "team-analysis-db10-coverage.json", reportFile: "team-analysis-db10-report.md", goldenValidationFile: "team-analysis-db10-golden-validation.json" };
    const teamAnalysisDb11Manifest = { schemaVersion: 1, contractVersion: "0.10.0", generatedAt: options.generatedAt,
        fileName: "team-analysis-db11-experiment.json.gz", compression: "gzip", sha256: sha256(teamAnalysisDb11Gzip), sizeBytes: teamAnalysisDb11Gzip.byteLength, uncompressedSizeBytes: Buffer.byteLength(firstTeamAnalysisDb11Json, "utf8"),
        stateCount: teamAnalysisDb11Dataset.states.length, runtimePredicateCount: teamAnalysisDb11Coverage.runtimePredicateCount, semanticPromotionCount: 3,
        sourceDatabaseSha256: before.sha256, sourceDb7Sha256: sha256(teamAnalysisDb7Gzip), sourceDb10Sha256: sha256(teamAnalysisDb10Gzip), currentTeamAnalysisSha256: currentTeamAnalysis.sha256,
        coverageFile: "team-analysis-db11-coverage.json", parityFile: "team-analysis-db11-parity.json", reportFile: "team-analysis-db11-report.md", goldenValidationFile: "team-analysis-db11-golden-validation.json" };
    const teamAnalysisDb12Manifest = { schemaVersion: 1, contractVersion: "0.11.0", generatedAt: options.generatedAt,
        fileName: "team-analysis-db12-divergence-attribution.json.gz", compression: "gzip", sha256: sha256(teamAnalysisDb12Gzip), sizeBytes: teamAnalysisDb12Gzip.byteLength, uncompressedSizeBytes: Buffer.byteLength(firstTeamAnalysisDb12Json, "utf8"),
        matchedStateCount: teamAnalysisDb12Dataset.matchedStateCount, divergenceAttributionCount: teamAnalysisDb12Dataset.databaseOnlyAttributions.length + teamAnalysisDb12Dataset.currentOnlyAttributions.length,
        exactTurnEncodingCandidateCount: teamAnalysisDb12Dataset.exactTurnEncodingCandidates.length, semanticPromotionCount: 0, sourceDatabaseSha256: before.sha256,
        sourceDb11Sha256: sha256(teamAnalysisDb11Gzip), sourceDb11ParitySha256: sha256(teamAnalysisDb11ParityJson), currentTeamAnalysisSha256: currentTeamAnalysis.sha256,
        coverageFile: "team-analysis-db12-coverage.json", reportFile: "team-analysis-db12-report.md", goldenValidationFile: "team-analysis-db12-golden-validation.json" };
    const teamAnalysisDb13Manifest = { schemaVersion: 1, contractVersion: "0.12.1", generatedAt: options.generatedAt,
        fileName: "team-analysis-db13-rule-alignment.json.gz", compression: "gzip", sha256: sha256(teamAnalysisDb13Gzip), sizeBytes: teamAnalysisDb13Gzip.byteLength, uncompressedSizeBytes: Buffer.byteLength(firstTeamAnalysisDb13Json, "utf8"),
        matchedStateCount: teamAnalysisDb13Dataset.matchedStateCount, ruleAlignmentCount: teamAnalysisDb13Dataset.ruleAlignments.length, exactTurnRuleAlignedCount: teamAnalysisDb13Coverage.exactTurnRuleAlignedCount, semanticPromotionCount: 0,
        sourceDatabaseSha256: before.sha256, sourceDb11Sha256: sha256(teamAnalysisDb11Gzip), sourceDb12Sha256: sha256(teamAnalysisDb12Gzip), currentTeamAnalysisSha256: currentTeamAnalysis.sha256,
        coverageFile: "team-analysis-db13-coverage.json", reportFile: "team-analysis-db13-report.md", goldenValidationFile: "team-analysis-db13-golden-validation.json" };
    const teamAnalysisDb14Manifest = { schemaVersion: 1, contractVersion: "0.13.0", generatedAt: options.generatedAt,
        fileName: "team-analysis-db14-exact-turn-compatibility.json.gz", compression: "gzip", sha256: sha256(teamAnalysisDb14Gzip), sizeBytes: teamAnalysisDb14Gzip.byteLength, uncompressedSizeBytes: Buffer.byteLength(firstTeamAnalysisDb14Json, "utf8"),
        compatibilityAliasCount: teamAnalysisDb14Dataset.exactTurnCompatibilityAliases.length, semanticPromotionCount: 0, sourceDatabaseSha256: before.sha256,
        sourceDb11Sha256: sha256(teamAnalysisDb11Gzip), sourceDb12Sha256: sha256(teamAnalysisDb12Gzip), sourceDb13Sha256: sha256(teamAnalysisDb13Gzip), currentTeamAnalysisSha256: currentTeamAnalysis.sha256,
        coverageFile: "team-analysis-db14-coverage.json", reportFile: "team-analysis-db14-report.md", goldenValidationFile: "team-analysis-db14-golden-validation.json" };
    const teamAnalysisDb15Manifest = { schemaVersion: 1, contractVersion: "0.14.0", generatedAt: options.generatedAt,
        fileName: "team-analysis-db15-rule-condition-parity.json.gz", compression: "gzip", sha256: sha256(teamAnalysisDb15Gzip), sizeBytes: teamAnalysisDb15Gzip.byteLength, uncompressedSizeBytes: Buffer.byteLength(firstTeamAnalysisDb15Json, "utf8"),
        comparableRulePairCount: teamAnalysisDb15Coverage.comparableRulePairCount, appliedCompatibilityAliasCount: teamAnalysisDb15Coverage.appliedCompatibilityAliasCount, semanticPromotionCount: 0, sourceDatabaseSha256: before.sha256,
        sourceDb11Sha256: sha256(teamAnalysisDb11Gzip), sourceDb13Sha256: sha256(teamAnalysisDb13Gzip), sourceDb14Sha256: sha256(teamAnalysisDb14Gzip), currentTeamAnalysisSha256: currentTeamAnalysis.sha256,
        coverageFile: "team-analysis-db15-coverage.json", reportFile: "team-analysis-db15-report.md", goldenValidationFile: "team-analysis-db15-golden-validation.json" };
    const teamAnalysisDb16Manifest = { schemaVersion: 1, contractVersion: "0.15.0", generatedAt: options.generatedAt,
        fileName: "team-analysis-db16-residual-attribution.json.gz", compression: "gzip", sha256: sha256(teamAnalysisDb16Gzip), sizeBytes: teamAnalysisDb16Gzip.byteLength, uncompressedSizeBytes: Buffer.byteLength(firstTeamAnalysisDb16Json, "utf8"), residualAttributionCount: teamAnalysisDb16Coverage.residualAttributionCount, unprovenCandidateAttributionCount: teamAnalysisDb16Coverage.unprovenCandidateAttributionCount, semanticPromotionCount: 0,
        sourceDatabaseSha256: before.sha256, sourceDb15Sha256: sha256(teamAnalysisDb15Gzip), currentTeamAnalysisSha256: currentTeamAnalysis.sha256, coverageFile: "team-analysis-db16-coverage.json", reportFile: "team-analysis-db16-report.md", goldenValidationFile: "team-analysis-db16-golden-validation.json" };
    const teamAnalysisDb17Manifest = { schemaVersion: 1, contractVersion: "0.16.0", generatedAt: options.generatedAt, fileName: "team-analysis-db17-appearance-turn-evidence.json.gz", compression: "gzip", sha256: sha256(teamAnalysisDb17Gzip), sizeBytes: teamAnalysisDb17Gzip.byteLength, uncompressedSizeBytes: Buffer.byteLength(firstTeamAnalysisDb17Json, "utf8"), conclusionCount: teamAnalysisDb17Coverage.conclusionCount, affectedRulePairCount: teamAnalysisDb17Coverage.affectedRulePairCount, semanticPromotionCount: 3, sourceDatabaseSha256: before.sha256, sourceDb16Sha256: sha256(teamAnalysisDb16Gzip), nativeRuntimeSha256: nativeBefore.sha256, lifecycleEvidenceSha256, coverageFile: "team-analysis-db17-coverage.json", reportFile: "team-analysis-db17-report.md", goldenValidationFile: "team-analysis-db17-golden-validation.json" };
    const teamAnalysisDb18Manifest = { schemaVersion: 1, contractVersion: "0.17.1", generatedAt: options.generatedAt, fileName: "team-analysis-db18-lifecycle-compatibility-parity.json.gz", compression: "gzip", sha256: sha256(teamAnalysisDb18Gzip), sizeBytes: teamAnalysisDb18Gzip.byteLength, uncompressedSizeBytes: Buffer.byteLength(firstTeamAnalysisDb18Json, "utf8"), affectedRulePairCount: teamAnalysisDb18Coverage.affectedRulePairCount, exactPairDelta: teamAnalysisDb18Coverage.exactPairDelta, resolvedDb16AttributionCount: teamAnalysisDb18Coverage.resolvedDb16AttributionCount, inheritedSemanticPromotionCount: 3, semanticPromotionCount: 0, sourceDatabaseSha256: before.sha256, sourceDb15Sha256: sha256(teamAnalysisDb15Gzip), sourceDb16Sha256: sha256(teamAnalysisDb16Gzip), sourceDb17Sha256: sha256(teamAnalysisDb17Gzip), currentTeamAnalysisSha256: currentTeamAnalysis.sha256, coverageFile: "team-analysis-db18-coverage.json", reportFile: "team-analysis-db18-report.md", goldenValidationFile: "team-analysis-db18-golden-validation.json" };
    const teamAnalysisDb19Manifest = { schemaVersion: 1, contractVersion: "0.18.0", generatedAt: options.generatedAt, fileName: "team-analysis-db19-post-lifecycle-residuals.json.gz", compression: "gzip", sha256: sha256(teamAnalysisDb19Gzip), sizeBytes: teamAnalysisDb19Gzip.byteLength, uncompressedSizeBytes: Buffer.byteLength(firstTeamAnalysisDb19Json, "utf8"), residualAttributionCount: teamAnalysisDb19Coverage.residualAttributionCount, residualPatternCount: teamAnalysisDb19Coverage.residualPatternCount, inheritedSemanticPromotionCount: 3, semanticPromotionCount: 0, sourceDatabaseSha256: before.sha256, sourceDb15Sha256: sha256(teamAnalysisDb15Gzip), sourceDb18Sha256: sha256(teamAnalysisDb18Gzip), currentTeamAnalysisSha256: currentTeamAnalysis.sha256, coverageFile: "team-analysis-db19-coverage.json", reportFile: "team-analysis-db19-report.md", goldenValidationFile: "team-analysis-db19-golden-validation.json" };
    const teamAnalysisDb20Manifest = { schemaVersion: 1, contractVersion: "0.19.0", generatedAt: options.generatedAt, fileName: "team-analysis-db20-passive-turn-correlation.json.gz", compression: "gzip", sha256: sha256(teamAnalysisDb20Gzip), sizeBytes: teamAnalysisDb20Gzip.byteLength, uncompressedSizeBytes: Buffer.byteLength(firstTeamAnalysisDb20Json, "utf8"), candidateCount: teamAnalysisDb20Coverage.candidateCount, exactNumericMatchCount: teamAnalysisDb20Coverage.exactNumericMatchCount, inheritedSemanticPromotionCount: 3, semanticPromotionCount: 0, sourceDatabaseSha256: before.sha256, sourceDb11Sha256: sha256(teamAnalysisDb11Gzip), sourceDb19Sha256: sha256(teamAnalysisDb19Gzip), currentTeamAnalysisSha256: currentTeamAnalysis.sha256, coverageFile: "team-analysis-db20-coverage.json", reportFile: "team-analysis-db20-report.md", goldenValidationFile: "team-analysis-db20-golden-validation.json" };
    const teamAnalysisDb21Manifest = { schemaVersion: 1, contractVersion: "0.20.0", generatedAt: options.generatedAt, fileName: "team-analysis-db21-passive-turn-native-audit.json.gz", compression: "gzip", sha256: sha256(teamAnalysisDb21Gzip), sizeBytes: teamAnalysisDb21Gzip.byteLength, uncompressedSizeBytes: Buffer.byteLength(firstTeamAnalysisDb21Json, "utf8"), verifiedSymbolCount: teamAnalysisDb21Coverage.verifiedSymbolCount, unresolvedSemanticCount: teamAnalysisDb21Coverage.unresolvedSemanticCount, inheritedSemanticPromotionCount: 3, semanticPromotionCount: 0, sourceDatabaseSha256: before.sha256, sourceDb20Sha256: sha256(teamAnalysisDb20Gzip), nativeRuntimeSha256: nativeBefore.sha256, nativeLinkageEvidenceSha256, coverageFile: "team-analysis-db21-coverage.json", reportFile: "team-analysis-db21-report.md", goldenValidationFile: "team-analysis-db21-golden-validation.json" };
    const teamAnalysisDb22Manifest = { schemaVersion: 1, contractVersion: "0.21.0", generatedAt: options.generatedAt, fileName: "team-analysis-db22-lifecycle-ast-parity.json.gz", compression: "gzip", sha256: sha256(teamAnalysisDb22Gzip), sizeBytes: teamAnalysisDb22Gzip.byteLength, uncompressedSizeBytes: Buffer.byteLength(firstTeamAnalysisDb22Json, "utf8"), affectedRulePairCount: teamAnalysisDb22Coverage.affectedRulePairCount, exactPairDelta: teamAnalysisDb22Coverage.exactPairDelta, removedTurnOneTautologyOccurrenceCount: teamAnalysisDb22Coverage.removedTurnOneTautologyOccurrenceCount, inheritedSemanticPromotionCount: 3, semanticPromotionCount: 0, sourceDatabaseSha256: before.sha256, sourceDb15Sha256: sha256(teamAnalysisDb15Gzip), sourceDb17Sha256: sha256(teamAnalysisDb17Gzip), sourceDb18Sha256: sha256(teamAnalysisDb18Gzip), sourceDb21Sha256: sha256(teamAnalysisDb21Gzip), currentTeamAnalysisSha256: currentTeamAnalysis.sha256, coverageFile: "team-analysis-db22-coverage.json", reportFile: "team-analysis-db22-report.md", goldenValidationFile: "team-analysis-db22-golden-validation.json" };
    const teamAnalysisDb23Manifest = { schemaVersion: 1, contractVersion: "0.22.0", generatedAt: options.generatedAt, fileName: "team-analysis-db23-post-ast-residuals.json.gz", compression: "gzip", sha256: sha256(teamAnalysisDb23Gzip), sizeBytes: teamAnalysisDb23Gzip.byteLength, uncompressedSizeBytes: Buffer.byteLength(firstTeamAnalysisDb23Json, "utf8"), residualAttributionCount: teamAnalysisDb23Coverage.residualAttributionCount, residualPatternCount: teamAnalysisDb23Coverage.residualPatternCount, inheritedSemanticPromotionCount: 3, semanticPromotionCount: 0, sourceDatabaseSha256: before.sha256, sourceDb15Sha256: sha256(teamAnalysisDb15Gzip), sourceDb18Sha256: sha256(teamAnalysisDb18Gzip), sourceDb22Sha256: sha256(teamAnalysisDb22Gzip), currentTeamAnalysisSha256: currentTeamAnalysis.sha256, coverageFile: "team-analysis-db23-coverage.json", reportFile: "team-analysis-db23-report.md", goldenValidationFile: "team-analysis-db23-golden-validation.json" };
    const teamAnalysisDb24Manifest = { schemaVersion: 1, contractVersion: "0.23.0", generatedAt: options.generatedAt, fileName: "team-analysis-db24-counter-behavior.json.gz", compression: "gzip", sha256: sha256(teamAnalysisDb24Gzip), sizeBytes: teamAnalysisDb24Gzip.byteLength, uncompressedSizeBytes: Buffer.byteLength(firstTeamAnalysisDb24Json, "utf8"), resolutionCount: teamAnalysisDb24Coverage.resolutionCount, affectedStateCount: teamAnalysisDb24Coverage.affectedStateCount, inheritedSemanticPromotionCount: 3, semanticPromotionCount: 1, sourceDatabaseSha256: before.sha256, sourceDb8Sha256: sha256(teamAnalysisDb8Gzip), sourceDb9Sha256: sha256(teamAnalysisDb9Gzip), sourceDb11Sha256: sha256(teamAnalysisDb11Gzip), nativeRuntimeSha256: nativeBefore.sha256, nativeEvidenceSha256: counterEvidenceSha256, coverageFile: "team-analysis-db24-coverage.json", reportFile: "team-analysis-db24-report.md", goldenValidationFile: "team-analysis-db24-golden-validation.json" };
    const teamAnalysisDb25Manifest = { schemaVersion: 1, contractVersion: "0.24.0", generatedAt: options.generatedAt, fileName: "team-analysis-db25-attack-context.json.gz", compression: "gzip", sha256: sha256(teamAnalysisDb25Gzip), sizeBytes: teamAnalysisDb25Gzip.byteLength, uncompressedSizeBytes: Buffer.byteLength(firstTeamAnalysisDb25Json, "utf8"), resolutionCount: teamAnalysisDb25Coverage.resolutionCount, affectedStateCount: teamAnalysisDb25Coverage.affectedStateCount, overclaimCorrectionCount: teamAnalysisDb25Coverage.overclaimCorrectionCount, inheritedSemanticPromotionCount: 3, semanticPromotionCount: 0, sourceDatabaseSha256: before.sha256, sourceDb8Sha256: sha256(teamAnalysisDb8Gzip), sourceDb9Sha256: sha256(teamAnalysisDb9Gzip), sourceDb11Sha256: sha256(teamAnalysisDb11Gzip), nativeRuntimeSha256: nativeBefore.sha256, nativeEvidenceSha256: attackContextEvidenceSha256, coverageFile: "team-analysis-db25-coverage.json", reportFile: "team-analysis-db25-report.md", goldenValidationFile: "team-analysis-db25-golden-validation.json" };
    const teamAnalysisDb26Manifest = { schemaVersion: 1, contractVersion: "0.25.0", generatedAt: options.generatedAt, fileName: "team-analysis-db26-special-category.json.gz", compression: "gzip", sha256: sha256(teamAnalysisDb26Gzip), sizeBytes: teamAnalysisDb26Gzip.byteLength, uncompressedSizeBytes: Buffer.byteLength(firstTeamAnalysisDb26Json, "utf8"), resolutionCount: teamAnalysisDb26Coverage.resolutionCount, affectedStateCount: teamAnalysisDb26Coverage.affectedStateCount, supportedSelectorCount: teamAnalysisDb26Coverage.supportedSelectorCount, inheritedSemanticPromotionCount: 3, semanticPromotionCount: 1, sourceDatabaseSha256: before.sha256, sourceDb8Sha256: sha256(teamAnalysisDb8Gzip), sourceDb9Sha256: sha256(teamAnalysisDb9Gzip), sourceDb11Sha256: sha256(teamAnalysisDb11Gzip), nativeRuntimeSha256: nativeBefore.sha256, nativeEvidenceSha256: specialCategoryEvidenceSha256, coverageFile: "team-analysis-db26-coverage.json", reportFile: "team-analysis-db26-report.md", goldenValidationFile: "team-analysis-db26-golden-validation.json" };
    const teamAnalysisDb27Manifest = { schemaVersion: 1, contractVersion: "0.26.0", generatedAt: options.generatedAt, fileName: "team-analysis-db27-target-hp.json.gz", compression: "gzip", sha256: sha256(teamAnalysisDb27Gzip), sizeBytes: teamAnalysisDb27Gzip.byteLength, uncompressedSizeBytes: Buffer.byteLength(firstTeamAnalysisDb27Json, "utf8"), resolutionCount: teamAnalysisDb27Coverage.resolutionCount, affectedStateCount: teamAnalysisDb27Coverage.affectedStateCount, inheritedSemanticPromotionCount: 3, semanticPromotionCount: 3, sourceDatabaseSha256: before.sha256, sourceDb8Sha256: sha256(teamAnalysisDb8Gzip), sourceDb9Sha256: sha256(teamAnalysisDb9Gzip), sourceDb11Sha256: sha256(teamAnalysisDb11Gzip), nativeRuntimeSha256: nativeBefore.sha256, nativeEvidenceSha256: targetHpEvidenceSha256, coverageFile: "team-analysis-db27-coverage.json", reportFile: "team-analysis-db27-report.md", goldenValidationFile: "team-analysis-db27-golden-validation.json" };
    const teamAnalysisDb28Manifest = { schemaVersion: 1, contractVersion: "0.27.0", generatedAt: options.generatedAt, fileName: "team-analysis-db28-revival-counter.json.gz", compression: "gzip", sha256: sha256(teamAnalysisDb28Gzip), sizeBytes: teamAnalysisDb28Gzip.byteLength, uncompressedSizeBytes: Buffer.byteLength(firstTeamAnalysisDb28Json, "utf8"), resolutionCount: teamAnalysisDb28Coverage.resolutionCount, affectedStateCount: teamAnalysisDb28Coverage.affectedStateCount, inheritedSemanticPromotionCount: 3, semanticPromotionCount: 2, sourceDatabaseSha256: before.sha256, sourceDb8Sha256: sha256(teamAnalysisDb8Gzip), sourceDb9Sha256: sha256(teamAnalysisDb9Gzip), sourceDb11Sha256: sha256(teamAnalysisDb11Gzip), nativeRuntimeSha256: nativeBefore.sha256, nativeEvidenceSha256: revivalCounterEvidenceSha256, coverageFile: "team-analysis-db28-coverage.json", reportFile: "team-analysis-db28-report.md", goldenValidationFile: "team-analysis-db28-golden-validation.json" };
    const after = await fingerprint(options.databasePath);
    const nativeAfter = await fingerprint(options.nativeRuntimePath);
    if (before.sizeBytes !== after.sizeBytes || before.sha256 !== after.sha256 || before.modifiedAtMs !== after.modifiedAtMs) {
        throw new Error("Read-only source guarantee failed: source database fingerprint or mtime changed");
    }
    if (nativeBefore.sizeBytes !== nativeAfter.sizeBytes || nativeBefore.sha256 !== nativeAfter.sha256 || nativeBefore.modifiedAtMs !== nativeAfter.modifiedAtMs)
        throw new Error("Read-only native runtime guarantee failed: fingerprint or mtime changed");
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
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb6Manifest.fileName), teamAnalysisDb6Gzip),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, "team-analysis-db6-manifest.json"), `${JSON.stringify(teamAnalysisDb6Manifest, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb6Manifest.coverageFile), `${JSON.stringify(teamAnalysisDb6Coverage, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb6Manifest.parityFile), `${JSON.stringify(teamAnalysisDb6Parity, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb6Manifest.reportFile), teamAnalysisDb6Report, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb6Manifest.goldenValidationFile), `${JSON.stringify(teamAnalysisDb6Goldens, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb7Manifest.fileName), teamAnalysisDb7Gzip),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, "team-analysis-db7-manifest.json"), `${JSON.stringify(teamAnalysisDb7Manifest, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb7Manifest.coverageFile), `${JSON.stringify(teamAnalysisDb7Coverage, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb7Manifest.parityFile), `${JSON.stringify(teamAnalysisDb7Parity, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb7Manifest.reportFile), teamAnalysisDb7Report, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb7Manifest.goldenValidationFile), `${JSON.stringify(teamAnalysisDb7Goldens, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb8Manifest.fileName), teamAnalysisDb8Gzip),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, "team-analysis-db8-manifest.json"), `${JSON.stringify(teamAnalysisDb8Manifest, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb8Manifest.coverageFile), `${JSON.stringify(teamAnalysisDb8Coverage, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb8Manifest.reportFile), teamAnalysisDb8Report, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb8Manifest.goldenValidationFile), `${JSON.stringify(teamAnalysisDb8Goldens, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb9Manifest.fileName), teamAnalysisDb9Gzip),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, "team-analysis-db9-manifest.json"), `${JSON.stringify(teamAnalysisDb9Manifest, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb9Manifest.coverageFile), `${JSON.stringify(teamAnalysisDb9Coverage, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb9Manifest.reportFile), teamAnalysisDb9Report, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb9Manifest.goldenValidationFile), `${JSON.stringify(teamAnalysisDb9Goldens, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb10Manifest.fileName), teamAnalysisDb10Gzip),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, "team-analysis-db10-manifest.json"), `${JSON.stringify(teamAnalysisDb10Manifest, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb10Manifest.coverageFile), `${JSON.stringify(teamAnalysisDb10Coverage, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb10Manifest.reportFile), teamAnalysisDb10Report, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb10Manifest.goldenValidationFile), `${JSON.stringify(teamAnalysisDb10Goldens, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb11Manifest.fileName), teamAnalysisDb11Gzip),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, "team-analysis-db11-manifest.json"), `${JSON.stringify(teamAnalysisDb11Manifest, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb11Manifest.coverageFile), `${JSON.stringify(teamAnalysisDb11Coverage, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb11Manifest.parityFile), teamAnalysisDb11ParityJson, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb11Manifest.reportFile), teamAnalysisDb11Report, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb11Manifest.goldenValidationFile), `${JSON.stringify(teamAnalysisDb11Goldens, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb12Manifest.fileName), teamAnalysisDb12Gzip),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, "team-analysis-db12-manifest.json"), `${JSON.stringify(teamAnalysisDb12Manifest, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb12Manifest.coverageFile), `${JSON.stringify(teamAnalysisDb12Coverage, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb12Manifest.reportFile), teamAnalysisDb12Report, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb12Manifest.goldenValidationFile), `${JSON.stringify(teamAnalysisDb12Goldens, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb13Manifest.fileName), teamAnalysisDb13Gzip),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, "team-analysis-db13-manifest.json"), `${JSON.stringify(teamAnalysisDb13Manifest, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb13Manifest.coverageFile), `${JSON.stringify(teamAnalysisDb13Coverage, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb13Manifest.reportFile), teamAnalysisDb13Report, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb13Manifest.goldenValidationFile), `${JSON.stringify(teamAnalysisDb13Goldens, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb14Manifest.fileName), teamAnalysisDb14Gzip),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, "team-analysis-db14-manifest.json"), `${JSON.stringify(teamAnalysisDb14Manifest, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb14Manifest.coverageFile), `${JSON.stringify(teamAnalysisDb14Coverage, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb14Manifest.reportFile), teamAnalysisDb14Report, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb14Manifest.goldenValidationFile), `${JSON.stringify(teamAnalysisDb14Goldens, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb15Manifest.fileName), teamAnalysisDb15Gzip),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, "team-analysis-db15-manifest.json"), `${JSON.stringify(teamAnalysisDb15Manifest, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb15Manifest.coverageFile), `${JSON.stringify(teamAnalysisDb15Coverage, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb15Manifest.reportFile), teamAnalysisDb15Report, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb15Manifest.goldenValidationFile), `${JSON.stringify(teamAnalysisDb15Goldens, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb16Manifest.fileName), teamAnalysisDb16Gzip),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, "team-analysis-db16-manifest.json"), `${JSON.stringify(teamAnalysisDb16Manifest, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb16Manifest.coverageFile), `${JSON.stringify(teamAnalysisDb16Coverage, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb16Manifest.reportFile), teamAnalysisDb16Report, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb16Manifest.goldenValidationFile), `${JSON.stringify(teamAnalysisDb16Goldens, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb17Manifest.fileName), teamAnalysisDb17Gzip),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, "team-analysis-db17-manifest.json"), `${JSON.stringify(teamAnalysisDb17Manifest, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb17Manifest.coverageFile), `${JSON.stringify(teamAnalysisDb17Coverage, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb17Manifest.reportFile), teamAnalysisDb17Report, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb17Manifest.goldenValidationFile), `${JSON.stringify(teamAnalysisDb17Goldens, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb18Manifest.fileName), teamAnalysisDb18Gzip),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, "team-analysis-db18-manifest.json"), `${JSON.stringify(teamAnalysisDb18Manifest, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb18Manifest.coverageFile), `${JSON.stringify(teamAnalysisDb18Coverage, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb18Manifest.reportFile), teamAnalysisDb18Report, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb18Manifest.goldenValidationFile), `${JSON.stringify(teamAnalysisDb18Goldens, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb19Manifest.fileName), teamAnalysisDb19Gzip),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, "team-analysis-db19-manifest.json"), `${JSON.stringify(teamAnalysisDb19Manifest, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb19Manifest.coverageFile), `${JSON.stringify(teamAnalysisDb19Coverage, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb19Manifest.reportFile), teamAnalysisDb19Report, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb19Manifest.goldenValidationFile), `${JSON.stringify(teamAnalysisDb19Goldens, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb20Manifest.fileName), teamAnalysisDb20Gzip),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, "team-analysis-db20-manifest.json"), `${JSON.stringify(teamAnalysisDb20Manifest, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb20Manifest.coverageFile), `${JSON.stringify(teamAnalysisDb20Coverage, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb20Manifest.reportFile), teamAnalysisDb20Report, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb20Manifest.goldenValidationFile), `${JSON.stringify(teamAnalysisDb20Goldens, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb21Manifest.fileName), teamAnalysisDb21Gzip),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, "team-analysis-db21-manifest.json"), `${JSON.stringify(teamAnalysisDb21Manifest, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb21Manifest.coverageFile), `${JSON.stringify(teamAnalysisDb21Coverage, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb21Manifest.reportFile), teamAnalysisDb21Report, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb21Manifest.goldenValidationFile), `${JSON.stringify(teamAnalysisDb21Goldens, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb22Manifest.fileName), teamAnalysisDb22Gzip),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, "team-analysis-db22-manifest.json"), `${JSON.stringify(teamAnalysisDb22Manifest, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb22Manifest.coverageFile), `${JSON.stringify(teamAnalysisDb22Coverage, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb22Manifest.reportFile), teamAnalysisDb22Report, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb22Manifest.goldenValidationFile), `${JSON.stringify(teamAnalysisDb22Goldens, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb23Manifest.fileName), teamAnalysisDb23Gzip),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, "team-analysis-db23-manifest.json"), `${JSON.stringify(teamAnalysisDb23Manifest, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb23Manifest.coverageFile), `${JSON.stringify(teamAnalysisDb23Coverage, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb23Manifest.reportFile), teamAnalysisDb23Report, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb23Manifest.goldenValidationFile), `${JSON.stringify(teamAnalysisDb23Goldens, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb24Manifest.fileName), teamAnalysisDb24Gzip),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, "team-analysis-db24-manifest.json"), `${JSON.stringify(teamAnalysisDb24Manifest, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb24Manifest.coverageFile), `${JSON.stringify(teamAnalysisDb24Coverage, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb24Manifest.reportFile), teamAnalysisDb24Report, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb24Manifest.goldenValidationFile), `${JSON.stringify(teamAnalysisDb24Goldens, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb25Manifest.fileName), teamAnalysisDb25Gzip),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, "team-analysis-db25-manifest.json"), `${JSON.stringify(teamAnalysisDb25Manifest, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb25Manifest.coverageFile), `${JSON.stringify(teamAnalysisDb25Coverage, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb25Manifest.reportFile), teamAnalysisDb25Report, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb25Manifest.goldenValidationFile), `${JSON.stringify(teamAnalysisDb25Goldens, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb26Manifest.fileName), teamAnalysisDb26Gzip),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, "team-analysis-db26-manifest.json"), `${JSON.stringify(teamAnalysisDb26Manifest, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb26Manifest.coverageFile), `${JSON.stringify(teamAnalysisDb26Coverage, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb26Manifest.reportFile), teamAnalysisDb26Report, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb26Manifest.goldenValidationFile), `${JSON.stringify(teamAnalysisDb26Goldens, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb27Manifest.fileName), teamAnalysisDb27Gzip),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, "team-analysis-db27-manifest.json"), `${JSON.stringify(teamAnalysisDb27Manifest, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb27Manifest.coverageFile), `${JSON.stringify(teamAnalysisDb27Coverage, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb27Manifest.reportFile), teamAnalysisDb27Report, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb27Manifest.goldenValidationFile), `${JSON.stringify(teamAnalysisDb27Goldens, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb28Manifest.fileName), teamAnalysisDb28Gzip),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, "team-analysis-db28-manifest.json"), `${JSON.stringify(teamAnalysisDb28Manifest, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb28Manifest.coverageFile), `${JSON.stringify(teamAnalysisDb28Coverage, null, 2)}\n`, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb28Manifest.reportFile), teamAnalysisDb28Report, "utf8"),
        (0, promises_1.writeFile)((0, path_1.resolve)(options.outputDir, teamAnalysisDb28Manifest.goldenValidationFile), `${JSON.stringify(teamAnalysisDb28Goldens, null, 2)}\n`, "utf8"),
    ]);
    return { manifest, sourceManifest, teamAnalysisManifest, teamAnalysisDb3Manifest, teamAnalysisDb4Manifest, teamAnalysisDb5Manifest, teamAnalysisDb6Manifest, teamAnalysisDb7Manifest, teamAnalysisDb8Manifest, teamAnalysisDb9Manifest, teamAnalysisDb10Manifest, teamAnalysisDb11Manifest, teamAnalysisDb12Manifest, teamAnalysisDb13Manifest, teamAnalysisDb14Manifest, teamAnalysisDb15Manifest, teamAnalysisDb16Manifest, teamAnalysisDb17Manifest, teamAnalysisDb18Manifest, teamAnalysisDb19Manifest, teamAnalysisDb20Manifest, teamAnalysisDb21Manifest, teamAnalysisDb22Manifest, teamAnalysisDb23Manifest, teamAnalysisDb24Manifest, teamAnalysisDb25Manifest, teamAnalysisDb26Manifest, teamAnalysisDb27Manifest, teamAnalysisDb28Manifest, outputDir: options.outputDir, deterministicRebuildSha256: sha256(secondGzip) };
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
        teamAnalysisDb6Artifact: result.teamAnalysisDb6Manifest,
        teamAnalysisDb7Artifact: result.teamAnalysisDb7Manifest,
        teamAnalysisDb8Artifact: result.teamAnalysisDb8Manifest,
        teamAnalysisDb9Artifact: result.teamAnalysisDb9Manifest,
        teamAnalysisDb10Artifact: result.teamAnalysisDb10Manifest,
        teamAnalysisDb11Artifact: result.teamAnalysisDb11Manifest,
        teamAnalysisDb12Artifact: result.teamAnalysisDb12Manifest,
        teamAnalysisDb13Artifact: result.teamAnalysisDb13Manifest,
        teamAnalysisDb14Artifact: result.teamAnalysisDb14Manifest,
        teamAnalysisDb15Artifact: result.teamAnalysisDb15Manifest,
        teamAnalysisDb16Artifact: result.teamAnalysisDb16Manifest,
        teamAnalysisDb17Artifact: result.teamAnalysisDb17Manifest,
        teamAnalysisDb18Artifact: result.teamAnalysisDb18Manifest,
        teamAnalysisDb19Artifact: result.teamAnalysisDb19Manifest,
        teamAnalysisDb20Artifact: result.teamAnalysisDb20Manifest,
        teamAnalysisDb21Artifact: result.teamAnalysisDb21Manifest,
        teamAnalysisDb22Artifact: result.teamAnalysisDb22Manifest,
        teamAnalysisDb23Artifact: result.teamAnalysisDb23Manifest,
        teamAnalysisDb24Artifact: result.teamAnalysisDb24Manifest,
        teamAnalysisDb25Artifact: result.teamAnalysisDb25Manifest,
        teamAnalysisDb26Artifact: result.teamAnalysisDb26Manifest,
        teamAnalysisDb27Artifact: result.teamAnalysisDb27Manifest,
        teamAnalysisDb28Artifact: result.teamAnalysisDb28Manifest,
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