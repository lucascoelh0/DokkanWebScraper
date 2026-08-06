import { createHash } from "crypto";
import { createReadStream } from "fs";
import { mkdir, readFile, stat, writeFile } from "fs/promises";
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
import { buildDatabaseTeamAnalysisDb5Coverage, buildDatabaseTeamAnalysisDb5Dataset } from "./team-analysis-db5-builder";
import { DatabaseTeamAnalysisDb5ArtifactManifest } from "./team-analysis-db5-contract";
import { validateDatabaseTeamAnalysisDb5Goldens } from "./team-analysis-db5-golden";
import { compareDatabaseTeamAnalysisDb5, renderDatabaseTeamAnalysisDb5Report } from "./team-analysis-db5-parity";
import { buildDatabaseTeamAnalysisDb6Coverage, buildDatabaseTeamAnalysisDb6Dataset } from "./team-analysis-db6-builder";
import { DatabaseTeamAnalysisDb6ArtifactManifest } from "./team-analysis-db6-contract";
import { validateDatabaseTeamAnalysisDb6Goldens } from "./team-analysis-db6-golden";
import { compareDatabaseTeamAnalysisDb6, renderDatabaseTeamAnalysisDb6Report } from "./team-analysis-db6-parity";
import { buildDatabaseTeamAnalysisDb7Coverage, buildDatabaseTeamAnalysisDb7Dataset } from "./team-analysis-db7-builder";
import { DatabaseTeamAnalysisDb7ArtifactManifest } from "./team-analysis-db7-contract";
import { validateDatabaseTeamAnalysisDb7Goldens } from "./team-analysis-db7-golden";
import { compareDatabaseTeamAnalysisDb7, renderDatabaseTeamAnalysisDb7Report } from "./team-analysis-db7-parity";
import { buildDatabaseTeamAnalysisDb8Coverage, buildDatabaseTeamAnalysisDb8Dataset } from "./team-analysis-db8-builder";
import { DatabaseTeamAnalysisDb8ArtifactManifest } from "./team-analysis-db8-contract";
import { validateDatabaseTeamAnalysisDb8Goldens } from "./team-analysis-db8-golden";
import { renderDatabaseTeamAnalysisDb8Report } from "./team-analysis-db8-report";
import { inspectNativeRuntimeElf } from "./native-runtime-elf-adapter";
import { buildDatabaseTeamAnalysisDb9Coverage, buildDatabaseTeamAnalysisDb9Dataset } from "./team-analysis-db9-builder";
import { DatabaseTeamAnalysisDb9ArtifactManifest } from "./team-analysis-db9-contract";
import { readDb9NativeLayout, resolveDb9NativeLayoutPath, validateDatabaseTeamAnalysisDb9Goldens } from "./team-analysis-db9-golden";
import { renderDatabaseTeamAnalysisDb9Report } from "./team-analysis-db9-report";
import { buildDatabaseTeamAnalysisDb10Coverage, buildDatabaseTeamAnalysisDb10Dataset } from "./team-analysis-db10-builder";
import { DatabaseTeamAnalysisDb10ArtifactManifest } from "./team-analysis-db10-contract";
import { parseDb10NativeSemantics, resolveDb10NativeSemanticsPath, validateDatabaseTeamAnalysisDb10Goldens } from "./team-analysis-db10-golden";
import { renderDatabaseTeamAnalysisDb10Report } from "./team-analysis-db10-report";
import { buildDatabaseTeamAnalysisDb11Coverage, buildDatabaseTeamAnalysisDb11Dataset } from "./team-analysis-db11-builder";
import { DatabaseTeamAnalysisDb11ArtifactManifest } from "./team-analysis-db11-contract";
import { validateDatabaseTeamAnalysisDb11Goldens } from "./team-analysis-db11-golden";
import { compareDatabaseTeamAnalysisDb11 } from "./team-analysis-db11-parity";
import { renderDatabaseTeamAnalysisDb11Report } from "./team-analysis-db11-report";
import { buildDatabaseTeamAnalysisDb12Coverage, buildDatabaseTeamAnalysisDb12Dataset } from "./team-analysis-db12-builder";
import { DatabaseTeamAnalysisDb12ArtifactManifest } from "./team-analysis-db12-contract";
import { validateDatabaseTeamAnalysisDb12Goldens } from "./team-analysis-db12-golden";
import { renderDatabaseTeamAnalysisDb12Report } from "./team-analysis-db12-report";
import { buildDatabaseTeamAnalysisDb13Coverage, buildDatabaseTeamAnalysisDb13Dataset } from "./team-analysis-db13-builder";
import { DatabaseTeamAnalysisDb13ArtifactManifest } from "./team-analysis-db13-contract";
import { validateDatabaseTeamAnalysisDb13Goldens } from "./team-analysis-db13-golden";
import { renderDatabaseTeamAnalysisDb13Report } from "./team-analysis-db13-report";
import { buildDatabaseTeamAnalysisDb14Coverage, buildDatabaseTeamAnalysisDb14Dataset } from "./team-analysis-db14-builder";
import { DatabaseTeamAnalysisDb14ArtifactManifest } from "./team-analysis-db14-contract";
import { validateDatabaseTeamAnalysisDb14Goldens } from "./team-analysis-db14-golden";
import { renderDatabaseTeamAnalysisDb14Report } from "./team-analysis-db14-report";
import { buildDatabaseTeamAnalysisDb15Coverage, buildDatabaseTeamAnalysisDb15Dataset } from "./team-analysis-db15-builder";
import { DatabaseTeamAnalysisDb15ArtifactManifest } from "./team-analysis-db15-contract";
import { validateDatabaseTeamAnalysisDb15Goldens } from "./team-analysis-db15-golden";
import { renderDatabaseTeamAnalysisDb15Report } from "./team-analysis-db15-report";
import { buildDatabaseTeamAnalysisDb16Coverage, buildDatabaseTeamAnalysisDb16Dataset } from "./team-analysis-db16-builder";
import { DatabaseTeamAnalysisDb16ArtifactManifest } from "./team-analysis-db16-contract";
import { validateDatabaseTeamAnalysisDb16Goldens } from "./team-analysis-db16-golden";
import { renderDatabaseTeamAnalysisDb16Report } from "./team-analysis-db16-report";
import { buildDatabaseTeamAnalysisDb17Coverage, buildDatabaseTeamAnalysisDb17Dataset, Db17LifecycleEvidence } from "./team-analysis-db17-builder";
import { DatabaseTeamAnalysisDb17ArtifactManifest } from "./team-analysis-db17-contract";
import { validateDatabaseTeamAnalysisDb17Goldens } from "./team-analysis-db17-golden";
import { renderDatabaseTeamAnalysisDb17Report } from "./team-analysis-db17-report";
import { buildDatabaseTeamAnalysisDb18Coverage, buildDatabaseTeamAnalysisDb18Dataset } from "./team-analysis-db18-builder";
import { DatabaseTeamAnalysisDb18ArtifactManifest } from "./team-analysis-db18-contract";
import { validateDatabaseTeamAnalysisDb18Goldens } from "./team-analysis-db18-golden";
import { renderDatabaseTeamAnalysisDb18Report } from "./team-analysis-db18-report";
import { buildDatabaseTeamAnalysisDb19Coverage, buildDatabaseTeamAnalysisDb19Dataset } from "./team-analysis-db19-builder";
import { DatabaseTeamAnalysisDb19ArtifactManifest } from "./team-analysis-db19-contract";
import { validateDatabaseTeamAnalysisDb19Goldens } from "./team-analysis-db19-golden";
import { renderDatabaseTeamAnalysisDb19Report } from "./team-analysis-db19-report";

const DEFAULT_DATABASE = "D:\\Dokkan\\database\\decrypted\\dokkan-global-current.db";
const DEFAULT_CURRENT_DATASET = "D:\\Dokkan\\DokkanWebScraper\\data\\fyi-characters\\latest\\characters.json.gz";
const DEFAULT_CURRENT_TEAM_ANALYSIS = "D:\\Dokkan\\DokkanWebScraper\\data\\fyi-characters\\latest\\team-analysis.json.gz";
const DEFAULT_NATIVE_RUNTIME = "D:\\Dokkan\\database\\apk\\extracted\\lib\\arm64-v8a\\libcocos2dcpp.so";
const DEFAULT_OUTPUT = resolve(process.cwd(), "data", "database-experiment");
const DEFAULT_GENERATED_AT = "2026-08-05T00:00:00.000Z";
const DEFAULT_RELEASE_CUTOFF = "2026-08-05 23:59:59";

interface RunOptions {
    databasePath: string,
    currentDatasetPath: string,
    currentTeamAnalysisPath: string,
    nativeRuntimePath: string,
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
        nativeRuntimePath: resolve(values.get("--native-runtime") ?? DEFAULT_NATIVE_RUNTIME),
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
    teamAnalysisDb5Manifest: DatabaseTeamAnalysisDb5ArtifactManifest,
    teamAnalysisDb6Manifest: DatabaseTeamAnalysisDb6ArtifactManifest,
    teamAnalysisDb7Manifest: DatabaseTeamAnalysisDb7ArtifactManifest,
    teamAnalysisDb8Manifest: DatabaseTeamAnalysisDb8ArtifactManifest,
    teamAnalysisDb9Manifest: DatabaseTeamAnalysisDb9ArtifactManifest,
    teamAnalysisDb10Manifest: DatabaseTeamAnalysisDb10ArtifactManifest,
    teamAnalysisDb11Manifest: DatabaseTeamAnalysisDb11ArtifactManifest,
    teamAnalysisDb12Manifest: DatabaseTeamAnalysisDb12ArtifactManifest,
    teamAnalysisDb13Manifest: DatabaseTeamAnalysisDb13ArtifactManifest,
    teamAnalysisDb14Manifest: DatabaseTeamAnalysisDb14ArtifactManifest,
    teamAnalysisDb15Manifest: DatabaseTeamAnalysisDb15ArtifactManifest,
    teamAnalysisDb16Manifest: DatabaseTeamAnalysisDb16ArtifactManifest,
    teamAnalysisDb17Manifest: DatabaseTeamAnalysisDb17ArtifactManifest,
    teamAnalysisDb18Manifest: DatabaseTeamAnalysisDb18ArtifactManifest,
    teamAnalysisDb19Manifest: DatabaseTeamAnalysisDb19ArtifactManifest,
    outputDir: string,
    deterministicRebuildSha256: string,
}> {
    const before = await fingerprint(options.databasePath);
    const nativeBefore = await fingerprint(options.nativeRuntimePath);
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
    const buildTeamAnalysisDb5 = () => buildDatabaseTeamAnalysisDb5Dataset(teamAnalysisDb4Dataset);
    const teamAnalysisDb5Dataset = buildTeamAnalysisDb5();
    const firstTeamAnalysisDb5Json = `${JSON.stringify(teamAnalysisDb5Dataset)}\n`;
    const secondTeamAnalysisDb5Json = `${JSON.stringify(buildTeamAnalysisDb5())}\n`;
    if (sha256(firstTeamAnalysisDb5Json) !== sha256(secondTeamAnalysisDb5Json)) {
        throw new Error("DB5 determinism check failed: two Team Analysis projections differ");
    }
    const teamAnalysisDb5Gzip = gzipSync(Buffer.from(firstTeamAnalysisDb5Json, "utf8"), { level: 9 });
    const secondTeamAnalysisDb5Gzip = gzipSync(Buffer.from(secondTeamAnalysisDb5Json, "utf8"), { level: 9 });
    if (!teamAnalysisDb5Gzip.equals(secondTeamAnalysisDb5Gzip)) throw new Error("DB5 determinism check failed: gzip bytes differ");
    const teamAnalysisDb5Coverage = buildDatabaseTeamAnalysisDb5Coverage(teamAnalysisDb5Dataset);
    const teamAnalysisDb5Goldens = await validateDatabaseTeamAnalysisDb5Goldens(teamAnalysisDb5Dataset);
    if (teamAnalysisDb5Goldens.failures.length > 0) {
        throw new Error(`DB5 golden fixture validation failed: ${JSON.stringify(teamAnalysisDb5Goldens.failures)}`);
    }
    const teamAnalysisDb5Parity = compareDatabaseTeamAnalysisDb5(teamAnalysisDb5Dataset, currentTeamAnalysis.dataset, siteAudit);
    const teamAnalysisDb5Report = renderDatabaseTeamAnalysisDb5Report(teamAnalysisDb5Coverage, teamAnalysisDb5Parity, currentTeamAnalysis.dataset.parserVersion);
    const buildTeamAnalysisDb6 = () => buildDatabaseTeamAnalysisDb6Dataset({ db5: teamAnalysisDb5Dataset, db2: teamAnalysisDataset });
    const teamAnalysisDb6Dataset = buildTeamAnalysisDb6();
    const firstTeamAnalysisDb6Json = `${JSON.stringify(teamAnalysisDb6Dataset)}\n`;
    const secondTeamAnalysisDb6Json = `${JSON.stringify(buildTeamAnalysisDb6())}\n`;
    if (sha256(firstTeamAnalysisDb6Json) !== sha256(secondTeamAnalysisDb6Json)) {
        throw new Error("DB6 determinism check failed: two Team Analysis projections differ");
    }
    const teamAnalysisDb6Gzip = gzipSync(Buffer.from(firstTeamAnalysisDb6Json, "utf8"), { level: 9 });
    const secondTeamAnalysisDb6Gzip = gzipSync(Buffer.from(secondTeamAnalysisDb6Json, "utf8"), { level: 9 });
    if (!teamAnalysisDb6Gzip.equals(secondTeamAnalysisDb6Gzip)) throw new Error("DB6 determinism check failed: gzip bytes differ");
    const teamAnalysisDb6Coverage = buildDatabaseTeamAnalysisDb6Coverage(teamAnalysisDb6Dataset);
    const teamAnalysisDb6Goldens = await validateDatabaseTeamAnalysisDb6Goldens(teamAnalysisDb6Dataset);
    if (teamAnalysisDb6Goldens.failures.length > 0) {
        throw new Error(`DB6 golden fixture validation failed: ${JSON.stringify(teamAnalysisDb6Goldens.failures)}`);
    }
    const teamAnalysisDb6Parity = compareDatabaseTeamAnalysisDb6(teamAnalysisDb6Dataset, currentTeamAnalysis.dataset, siteAudit, teamAnalysisDb4Parity);
    const teamAnalysisDb6Report = renderDatabaseTeamAnalysisDb6Report(teamAnalysisDb6Coverage, teamAnalysisDb6Parity, currentTeamAnalysis.dataset.parserVersion);
    const buildTeamAnalysisDb7 = () => buildDatabaseTeamAnalysisDb7Dataset(teamAnalysisDb6Dataset);
    const teamAnalysisDb7Dataset = buildTeamAnalysisDb7();
    const firstTeamAnalysisDb7Json = `${JSON.stringify(teamAnalysisDb7Dataset)}\n`;
    const secondTeamAnalysisDb7Json = `${JSON.stringify(buildTeamAnalysisDb7())}\n`;
    if (sha256(firstTeamAnalysisDb7Json) !== sha256(secondTeamAnalysisDb7Json)) throw new Error("DB7 determinism check failed: two Team Analysis projections differ");
    const teamAnalysisDb7Gzip = gzipSync(Buffer.from(firstTeamAnalysisDb7Json, "utf8"), { level: 9 });
    const secondTeamAnalysisDb7Gzip = gzipSync(Buffer.from(secondTeamAnalysisDb7Json, "utf8"), { level: 9 });
    if (!teamAnalysisDb7Gzip.equals(secondTeamAnalysisDb7Gzip)) throw new Error("DB7 determinism check failed: gzip bytes differ");
    const teamAnalysisDb7Coverage = buildDatabaseTeamAnalysisDb7Coverage(teamAnalysisDb7Dataset);
    const teamAnalysisDb7Goldens = await validateDatabaseTeamAnalysisDb7Goldens(teamAnalysisDb7Dataset);
    if (teamAnalysisDb7Goldens.failures.length > 0) throw new Error(`DB7 golden fixture validation failed: ${JSON.stringify(teamAnalysisDb7Goldens.failures)}`);
    const teamAnalysisDb7Parity = compareDatabaseTeamAnalysisDb7(teamAnalysisDb7Dataset, currentTeamAnalysis.dataset, siteAudit);
    const teamAnalysisDb7Report = renderDatabaseTeamAnalysisDb7Report(teamAnalysisDb7Coverage, teamAnalysisDb7Parity, currentTeamAnalysis.dataset.parserVersion);
    const buildTeamAnalysisDb8 = () => buildDatabaseTeamAnalysisDb8Dataset({ db7: teamAnalysisDb7Dataset, tables });
    const teamAnalysisDb8Dataset = buildTeamAnalysisDb8();
    const firstTeamAnalysisDb8Json = `${JSON.stringify(teamAnalysisDb8Dataset)}\n`;
    const secondTeamAnalysisDb8Json = `${JSON.stringify(buildTeamAnalysisDb8())}\n`;
    if (sha256(firstTeamAnalysisDb8Json) !== sha256(secondTeamAnalysisDb8Json)) throw new Error("DB8 determinism check failed: two evidence-gap projections differ");
    const teamAnalysisDb8Gzip = gzipSync(Buffer.from(firstTeamAnalysisDb8Json, "utf8"), { level: 9 });
    const secondTeamAnalysisDb8Gzip = gzipSync(Buffer.from(secondTeamAnalysisDb8Json, "utf8"), { level: 9 });
    if (!teamAnalysisDb8Gzip.equals(secondTeamAnalysisDb8Gzip)) throw new Error("DB8 determinism check failed: gzip bytes differ");
    const teamAnalysisDb8Coverage = buildDatabaseTeamAnalysisDb8Coverage(teamAnalysisDb8Dataset);
    const teamAnalysisDb8Goldens = await validateDatabaseTeamAnalysisDb8Goldens(teamAnalysisDb8Dataset, teamAnalysisDb7Dataset);
    if (teamAnalysisDb8Goldens.failures.length > 0) throw new Error(`DB8 golden fixture validation failed: ${JSON.stringify(teamAnalysisDb8Goldens.failures)}`);
    const teamAnalysisDb8Report = renderDatabaseTeamAnalysisDb8Report(teamAnalysisDb8Dataset, teamAnalysisDb8Coverage);
    const nativeLayout = await readDb9NativeLayout();
    const nativeLayoutSha256 = sha256(await readFile(resolveDb9NativeLayoutPath()));
    if (nativeBefore.sha256 !== nativeLayout.sourceSha256 || nativeBefore.sizeBytes !== nativeLayout.sourceSizeBytes) throw new Error("DB9 native runtime does not match the audited layout fingerprint");
    const nativeInspection = await inspectNativeRuntimeElf(options.nativeRuntimePath);
    const requiredNativeSymbols = [nativeLayout.tables.efficacy.dispatchSymbol, nativeLayout.tables.causality.dispatchSymbol, nativeLayout.tables.causality.tableSymbol];
    for (const symbol of requiredNativeSymbols) if (!nativeInspection.symbols.some(value => value.name === symbol)) throw new Error(`DB9 required native symbol missing: ${symbol}`);
    const causalityTableSymbol = nativeInspection.symbols.find(value => value.name === nativeLayout.tables.causality.tableSymbol)!;
    if (causalityTableSymbol.value !== nativeLayout.tables.causality.baseVma || causalityTableSymbol.size !== nativeLayout.tables.causality.slotCount * 8) throw new Error("DB9 causality dispatch table layout mismatch");
    const buildTeamAnalysisDb9 = () => buildDatabaseTeamAnalysisDb9Dataset({ db8: teamAnalysisDb8Dataset, db8Sha256: sha256(teamAnalysisDb8Gzip), inspection: nativeInspection, layout: nativeLayout, layoutSha256: nativeLayoutSha256, nativePath: options.nativeRuntimePath, nativeSizeBytes: nativeBefore.sizeBytes, nativeSha256: nativeBefore.sha256 });
    const teamAnalysisDb9Dataset = buildTeamAnalysisDb9(); const firstTeamAnalysisDb9Json = `${JSON.stringify(teamAnalysisDb9Dataset)}\n`; const secondTeamAnalysisDb9Json = `${JSON.stringify(buildTeamAnalysisDb9())}\n`;
    if (sha256(firstTeamAnalysisDb9Json) !== sha256(secondTeamAnalysisDb9Json)) throw new Error("DB9 determinism check failed: two runtime-evidence projections differ");
    const teamAnalysisDb9Gzip = gzipSync(Buffer.from(firstTeamAnalysisDb9Json, "utf8"), { level: 9 }); const secondTeamAnalysisDb9Gzip = gzipSync(Buffer.from(secondTeamAnalysisDb9Json, "utf8"), { level: 9 });
    if (!teamAnalysisDb9Gzip.equals(secondTeamAnalysisDb9Gzip)) throw new Error("DB9 determinism check failed: gzip bytes differ");
    const teamAnalysisDb9Coverage = buildDatabaseTeamAnalysisDb9Coverage(teamAnalysisDb9Dataset); const teamAnalysisDb9Goldens = await validateDatabaseTeamAnalysisDb9Goldens(teamAnalysisDb9Dataset);
    if (teamAnalysisDb9Goldens.failures.length > 0) throw new Error(`DB9 golden fixture validation failed: ${JSON.stringify(teamAnalysisDb9Goldens.failures)}`);
    const teamAnalysisDb9Report = renderDatabaseTeamAnalysisDb9Report(teamAnalysisDb9Dataset, teamAnalysisDb9Coverage);
    const nativeSemanticsBytes = await readFile(resolveDb10NativeSemanticsPath()); const nativeSemantics = parseDb10NativeSemantics(nativeSemanticsBytes); const nativeSemanticsSha256 = sha256(nativeSemanticsBytes);
    const buildTeamAnalysisDb10 = () => buildDatabaseTeamAnalysisDb10Dataset({
        db8: teamAnalysisDb8Dataset, db8Sha256: sha256(teamAnalysisDb8Gzip), db9: teamAnalysisDb9Dataset, db9Sha256: sha256(teamAnalysisDb9Gzip),
        inspection: nativeInspection, layout: nativeSemantics, layoutSha256: nativeSemanticsSha256, nativeSha256: nativeBefore.sha256,
    });
    const teamAnalysisDb10Dataset = buildTeamAnalysisDb10(); const firstTeamAnalysisDb10Json = `${JSON.stringify(teamAnalysisDb10Dataset)}\n`; const secondTeamAnalysisDb10Json = `${JSON.stringify(buildTeamAnalysisDb10())}\n`;
    if (sha256(firstTeamAnalysisDb10Json) !== sha256(secondTeamAnalysisDb10Json)) throw new Error("DB10 determinism check failed: two native-semantic projections differ");
    const teamAnalysisDb10Gzip = gzipSync(Buffer.from(firstTeamAnalysisDb10Json, "utf8"), { level: 9 }); const secondTeamAnalysisDb10Gzip = gzipSync(Buffer.from(secondTeamAnalysisDb10Json, "utf8"), { level: 9 });
    if (!teamAnalysisDb10Gzip.equals(secondTeamAnalysisDb10Gzip)) throw new Error("DB10 determinism check failed: gzip bytes differ");
    const teamAnalysisDb10Coverage = buildDatabaseTeamAnalysisDb10Coverage(teamAnalysisDb10Dataset, teamAnalysisDb8Dataset); const teamAnalysisDb10Goldens = await validateDatabaseTeamAnalysisDb10Goldens(teamAnalysisDb10Dataset);
    if (teamAnalysisDb10Goldens.failures.length > 0) throw new Error(`DB10 golden fixture validation failed: ${JSON.stringify(teamAnalysisDb10Goldens.failures)}`);
    const teamAnalysisDb10Report = renderDatabaseTeamAnalysisDb10Report(teamAnalysisDb10Dataset, teamAnalysisDb10Coverage);
    const buildTeamAnalysisDb11 = () => buildDatabaseTeamAnalysisDb11Dataset({
        db7: teamAnalysisDb7Dataset, db7Sha256: sha256(teamAnalysisDb7Gzip), db10: teamAnalysisDb10Dataset, db10Sha256: sha256(teamAnalysisDb10Gzip),
    });
    const teamAnalysisDb11Dataset = buildTeamAnalysisDb11(); const firstTeamAnalysisDb11Json = `${JSON.stringify(teamAnalysisDb11Dataset)}\n`; const secondTeamAnalysisDb11Json = `${JSON.stringify(buildTeamAnalysisDb11())}\n`;
    if (sha256(firstTeamAnalysisDb11Json) !== sha256(secondTeamAnalysisDb11Json)) throw new Error("DB11 determinism check failed: two runtime predicate projections differ");
    const teamAnalysisDb11Gzip = gzipSync(Buffer.from(firstTeamAnalysisDb11Json, "utf8"), { level: 9 }); const secondTeamAnalysisDb11Gzip = gzipSync(Buffer.from(secondTeamAnalysisDb11Json, "utf8"), { level: 9 });
    if (!teamAnalysisDb11Gzip.equals(secondTeamAnalysisDb11Gzip)) throw new Error("DB11 determinism check failed: gzip bytes differ");
    const teamAnalysisDb11Coverage = buildDatabaseTeamAnalysisDb11Coverage(teamAnalysisDb11Dataset, teamAnalysisDb7Dataset, teamAnalysisDb10Dataset);
    const teamAnalysisDb11Goldens = await validateDatabaseTeamAnalysisDb11Goldens(teamAnalysisDb11Dataset);
    if (teamAnalysisDb11Goldens.failures.length > 0) throw new Error(`DB11 golden fixture validation failed: ${JSON.stringify(teamAnalysisDb11Goldens.failures)}`);
    const teamAnalysisDb11Parity = compareDatabaseTeamAnalysisDb11(teamAnalysisDb11Dataset, currentTeamAnalysis.dataset, siteAudit);
    const teamAnalysisDb11ParityJson = `${JSON.stringify(teamAnalysisDb11Parity, null, 2)}\n`;
    const teamAnalysisDb11Report = renderDatabaseTeamAnalysisDb11Report(teamAnalysisDb11Coverage, teamAnalysisDb11Parity, currentTeamAnalysis.dataset.parserVersion, teamAnalysisDb10Coverage);
    const buildTeamAnalysisDb12 = () => buildDatabaseTeamAnalysisDb12Dataset({
        db11: teamAnalysisDb11Dataset, db11Sha256: sha256(teamAnalysisDb11Gzip), db11Parity: teamAnalysisDb11Parity, db11ParitySha256: sha256(teamAnalysisDb11ParityJson),
        current: currentTeamAnalysis.dataset, currentSha256: currentTeamAnalysis.sha256, siteAudit,
    });
    const teamAnalysisDb12Dataset = buildTeamAnalysisDb12(); const firstTeamAnalysisDb12Json = `${JSON.stringify(teamAnalysisDb12Dataset)}\n`; const secondTeamAnalysisDb12Json = `${JSON.stringify(buildTeamAnalysisDb12())}\n`;
    if (sha256(firstTeamAnalysisDb12Json) !== sha256(secondTeamAnalysisDb12Json)) throw new Error("DB12 determinism check failed: two divergence attributions differ");
    const teamAnalysisDb12Gzip = gzipSync(Buffer.from(firstTeamAnalysisDb12Json, "utf8"), { level: 9 }); const secondTeamAnalysisDb12Gzip = gzipSync(Buffer.from(secondTeamAnalysisDb12Json, "utf8"), { level: 9 });
    if (!teamAnalysisDb12Gzip.equals(secondTeamAnalysisDb12Gzip)) throw new Error("DB12 determinism check failed: gzip bytes differ");
    const teamAnalysisDb12Coverage = buildDatabaseTeamAnalysisDb12Coverage(teamAnalysisDb12Dataset, teamAnalysisDb11Parity);
    const teamAnalysisDb12Goldens = await validateDatabaseTeamAnalysisDb12Goldens(teamAnalysisDb12Dataset, teamAnalysisDb12Coverage);
    if (teamAnalysisDb12Goldens.failures.length > 0) throw new Error(`DB12 golden fixture validation failed: ${JSON.stringify(teamAnalysisDb12Goldens.failures)}`);
    const teamAnalysisDb12Report = renderDatabaseTeamAnalysisDb12Report(teamAnalysisDb12Dataset, teamAnalysisDb12Coverage);
    const buildTeamAnalysisDb13 = () => buildDatabaseTeamAnalysisDb13Dataset({ db11: teamAnalysisDb11Dataset, db11Sha256: sha256(teamAnalysisDb11Gzip), db12: teamAnalysisDb12Dataset, db12Sha256: sha256(teamAnalysisDb12Gzip), current: currentTeamAnalysis.dataset, currentSha256: currentTeamAnalysis.sha256, siteAudit });
    const teamAnalysisDb13Dataset = buildTeamAnalysisDb13(); const firstTeamAnalysisDb13Json = `${JSON.stringify(teamAnalysisDb13Dataset)}\n`; const secondTeamAnalysisDb13Json = `${JSON.stringify(buildTeamAnalysisDb13())}\n`;
    if (sha256(firstTeamAnalysisDb13Json) !== sha256(secondTeamAnalysisDb13Json)) throw new Error("DB13 determinism check failed: two rule alignments differ");
    const teamAnalysisDb13Gzip = gzipSync(Buffer.from(firstTeamAnalysisDb13Json, "utf8"), { level: 9 }); const secondTeamAnalysisDb13Gzip = gzipSync(Buffer.from(secondTeamAnalysisDb13Json, "utf8"), { level: 9 });
    if (!teamAnalysisDb13Gzip.equals(secondTeamAnalysisDb13Gzip)) throw new Error("DB13 determinism check failed: gzip bytes differ");
    const teamAnalysisDb13Coverage = buildDatabaseTeamAnalysisDb13Coverage(teamAnalysisDb13Dataset, teamAnalysisDb11Dataset, currentTeamAnalysis.dataset, siteAudit);
    const teamAnalysisDb13Goldens = await validateDatabaseTeamAnalysisDb13Goldens(teamAnalysisDb13Dataset, teamAnalysisDb13Coverage);
    if (teamAnalysisDb13Goldens.failures.length > 0) throw new Error(`DB13 golden fixture validation failed: ${JSON.stringify(teamAnalysisDb13Goldens.failures)}`);
    const teamAnalysisDb13Report = renderDatabaseTeamAnalysisDb13Report(teamAnalysisDb13Dataset, teamAnalysisDb13Coverage);
    const buildTeamAnalysisDb14 = () => buildDatabaseTeamAnalysisDb14Dataset({
        db11: teamAnalysisDb11Dataset, db11Sha256: sha256(teamAnalysisDb11Gzip), db12: teamAnalysisDb12Dataset, db12Sha256: sha256(teamAnalysisDb12Gzip),
        db13: teamAnalysisDb13Dataset, db13Sha256: sha256(teamAnalysisDb13Gzip), currentSha256: currentTeamAnalysis.sha256, siteAudit,
    });
    const teamAnalysisDb14Dataset = buildTeamAnalysisDb14(); const firstTeamAnalysisDb14Json = `${JSON.stringify(teamAnalysisDb14Dataset)}\n`; const secondTeamAnalysisDb14Json = `${JSON.stringify(buildTeamAnalysisDb14())}\n`;
    if (sha256(firstTeamAnalysisDb14Json) !== sha256(secondTeamAnalysisDb14Json)) throw new Error("DB14 determinism check failed: two exact-turn compatibility projections differ");
    const teamAnalysisDb14Gzip = gzipSync(Buffer.from(firstTeamAnalysisDb14Json, "utf8"), { level: 9 }); const secondTeamAnalysisDb14Gzip = gzipSync(Buffer.from(secondTeamAnalysisDb14Json, "utf8"), { level: 9 });
    if (!teamAnalysisDb14Gzip.equals(secondTeamAnalysisDb14Gzip)) throw new Error("DB14 determinism check failed: gzip bytes differ");
    const teamAnalysisDb14Coverage = buildDatabaseTeamAnalysisDb14Coverage(teamAnalysisDb14Dataset, teamAnalysisDb13Dataset);
    const teamAnalysisDb14Goldens = await validateDatabaseTeamAnalysisDb14Goldens(teamAnalysisDb14Dataset, teamAnalysisDb14Coverage);
    if (teamAnalysisDb14Goldens.failures.length > 0) throw new Error(`DB14 golden fixture validation failed: ${JSON.stringify(teamAnalysisDb14Goldens.failures)}`);
    const teamAnalysisDb14Report = renderDatabaseTeamAnalysisDb14Report(teamAnalysisDb14Dataset, teamAnalysisDb14Coverage);
    const buildTeamAnalysisDb15 = () => buildDatabaseTeamAnalysisDb15Dataset({
        db11: teamAnalysisDb11Dataset, db11Sha256: sha256(teamAnalysisDb11Gzip), db13: teamAnalysisDb13Dataset, db13Sha256: sha256(teamAnalysisDb13Gzip),
        db14: teamAnalysisDb14Dataset, db14Sha256: sha256(teamAnalysisDb14Gzip), current: currentTeamAnalysis.dataset, currentSha256: currentTeamAnalysis.sha256, siteAudit,
    });
    const teamAnalysisDb15Dataset = buildTeamAnalysisDb15(); const firstTeamAnalysisDb15Json = `${JSON.stringify(teamAnalysisDb15Dataset)}\n`; const secondTeamAnalysisDb15Json = `${JSON.stringify(buildTeamAnalysisDb15())}\n`;
    if (sha256(firstTeamAnalysisDb15Json) !== sha256(secondTeamAnalysisDb15Json)) throw new Error("DB15 determinism check failed: two rule-condition parity projections differ");
    const teamAnalysisDb15Gzip = gzipSync(Buffer.from(firstTeamAnalysisDb15Json, "utf8"), { level: 9 }); const secondTeamAnalysisDb15Gzip = gzipSync(Buffer.from(secondTeamAnalysisDb15Json, "utf8"), { level: 9 });
    if (!teamAnalysisDb15Gzip.equals(secondTeamAnalysisDb15Gzip)) throw new Error("DB15 determinism check failed: gzip bytes differ");
    const teamAnalysisDb15Coverage = buildDatabaseTeamAnalysisDb15Coverage(teamAnalysisDb15Dataset);
    const teamAnalysisDb15Goldens = await validateDatabaseTeamAnalysisDb15Goldens(teamAnalysisDb15Dataset, teamAnalysisDb15Coverage);
    if (teamAnalysisDb15Goldens.failures.length > 0) throw new Error(`DB15 golden fixture validation failed: ${JSON.stringify(teamAnalysisDb15Goldens.failures)}`);
    const teamAnalysisDb15Report = renderDatabaseTeamAnalysisDb15Report(teamAnalysisDb15Dataset, teamAnalysisDb15Coverage);
    const buildTeamAnalysisDb16 = () => buildDatabaseTeamAnalysisDb16Dataset({ db15: teamAnalysisDb15Dataset, db15Sha256: sha256(teamAnalysisDb15Gzip) });
    const teamAnalysisDb16Dataset = buildTeamAnalysisDb16(); const firstTeamAnalysisDb16Json = `${JSON.stringify(teamAnalysisDb16Dataset)}\n`; const secondTeamAnalysisDb16Json = `${JSON.stringify(buildTeamAnalysisDb16())}\n`;
    if (sha256(firstTeamAnalysisDb16Json) !== sha256(secondTeamAnalysisDb16Json)) throw new Error("DB16 determinism check failed: two residual attributions differ");
    const teamAnalysisDb16Gzip = gzipSync(Buffer.from(firstTeamAnalysisDb16Json, "utf8"), { level: 9 }); const secondTeamAnalysisDb16Gzip = gzipSync(Buffer.from(secondTeamAnalysisDb16Json, "utf8"), { level: 9 });
    if (!teamAnalysisDb16Gzip.equals(secondTeamAnalysisDb16Gzip)) throw new Error("DB16 determinism check failed: gzip bytes differ");
    const teamAnalysisDb16Coverage = buildDatabaseTeamAnalysisDb16Coverage(teamAnalysisDb16Dataset); const teamAnalysisDb16Goldens = await validateDatabaseTeamAnalysisDb16Goldens(teamAnalysisDb16Dataset, teamAnalysisDb16Coverage);
    if (teamAnalysisDb16Goldens.failures.length > 0) throw new Error(`DB16 golden fixture validation failed: ${JSON.stringify(teamAnalysisDb16Goldens.failures)}`);
    const teamAnalysisDb16Report = renderDatabaseTeamAnalysisDb16Report(teamAnalysisDb16Dataset, teamAnalysisDb16Coverage);
    const lifecycleEvidencePath = resolve(__dirname, "..", "..", "database-experiment", "native-appearance-turn-lifecycle.json"); const lifecycleEvidenceBytes = await readFile(lifecycleEvidencePath); const lifecycleEvidence = JSON.parse(lifecycleEvidenceBytes.toString("utf8")) as Db17LifecycleEvidence; const lifecycleEvidenceSha256 = sha256(lifecycleEvidenceBytes);
    const buildTeamAnalysisDb17 = () => buildDatabaseTeamAnalysisDb17Dataset({ db16: teamAnalysisDb16Dataset, db16Sha256: sha256(teamAnalysisDb16Gzip), inspection: nativeInspection, nativePath: options.nativeRuntimePath, nativeSha256: nativeBefore.sha256, nativeSizeBytes: nativeBefore.sizeBytes, evidence: lifecycleEvidence, evidenceSha256: lifecycleEvidenceSha256 });
    const teamAnalysisDb17Dataset = buildTeamAnalysisDb17(); const firstTeamAnalysisDb17Json = `${JSON.stringify(teamAnalysisDb17Dataset)}\n`; const secondTeamAnalysisDb17Json = `${JSON.stringify(buildTeamAnalysisDb17())}\n`;
    if (sha256(firstTeamAnalysisDb17Json) !== sha256(secondTeamAnalysisDb17Json)) throw new Error("DB17 determinism check failed: two lifecycle evidence projections differ"); const teamAnalysisDb17Gzip = gzipSync(Buffer.from(firstTeamAnalysisDb17Json, "utf8"), { level: 9 }); const secondTeamAnalysisDb17Gzip = gzipSync(Buffer.from(secondTeamAnalysisDb17Json, "utf8"), { level: 9 }); if (!teamAnalysisDb17Gzip.equals(secondTeamAnalysisDb17Gzip)) throw new Error("DB17 determinism check failed: gzip bytes differ");
    const teamAnalysisDb17Coverage = buildDatabaseTeamAnalysisDb17Coverage(teamAnalysisDb17Dataset, teamAnalysisDb16Dataset); const teamAnalysisDb17Goldens = await validateDatabaseTeamAnalysisDb17Goldens(teamAnalysisDb17Dataset, teamAnalysisDb17Coverage); if (teamAnalysisDb17Goldens.failures.length > 0) throw new Error(`DB17 golden fixture validation failed: ${JSON.stringify(teamAnalysisDb17Goldens.failures)}`); const teamAnalysisDb17Report = renderDatabaseTeamAnalysisDb17Report(teamAnalysisDb17Dataset, teamAnalysisDb17Coverage);
    const buildTeamAnalysisDb18 = () => buildDatabaseTeamAnalysisDb18Dataset({ db15: teamAnalysisDb15Dataset, db15Sha256: sha256(teamAnalysisDb15Gzip), db16: teamAnalysisDb16Dataset, db16Sha256: sha256(teamAnalysisDb16Gzip), db17: teamAnalysisDb17Dataset, db17Sha256: sha256(teamAnalysisDb17Gzip) });
    const teamAnalysisDb18Dataset = buildTeamAnalysisDb18(); const firstTeamAnalysisDb18Json = `${JSON.stringify(teamAnalysisDb18Dataset)}\n`; const secondTeamAnalysisDb18Json = `${JSON.stringify(buildTeamAnalysisDb18())}\n`; if (sha256(firstTeamAnalysisDb18Json) !== sha256(secondTeamAnalysisDb18Json)) throw new Error("DB18 determinism check failed: two lifecycle compatibility projections differ"); const teamAnalysisDb18Gzip = gzipSync(Buffer.from(firstTeamAnalysisDb18Json, "utf8"), { level: 9 }); const secondTeamAnalysisDb18Gzip = gzipSync(Buffer.from(secondTeamAnalysisDb18Json, "utf8"), { level: 9 }); if (!teamAnalysisDb18Gzip.equals(secondTeamAnalysisDb18Gzip)) throw new Error("DB18 determinism check failed: gzip bytes differ");
    const teamAnalysisDb18Coverage = buildDatabaseTeamAnalysisDb18Coverage(teamAnalysisDb18Dataset, teamAnalysisDb15Dataset); const teamAnalysisDb18Goldens = await validateDatabaseTeamAnalysisDb18Goldens(teamAnalysisDb18Dataset, teamAnalysisDb18Coverage); if (teamAnalysisDb18Goldens.failures.length > 0) throw new Error(`DB18 golden fixture validation failed: ${JSON.stringify(teamAnalysisDb18Goldens.failures)}`); const teamAnalysisDb18Report = renderDatabaseTeamAnalysisDb18Report(teamAnalysisDb18Dataset, teamAnalysisDb18Coverage);
    const buildTeamAnalysisDb19 = () => buildDatabaseTeamAnalysisDb19Dataset({ db15: teamAnalysisDb15Dataset, db15Sha256: sha256(teamAnalysisDb15Gzip), db18: teamAnalysisDb18Dataset, db18Sha256: sha256(teamAnalysisDb18Gzip) }); const teamAnalysisDb19Dataset = buildTeamAnalysisDb19(); const firstTeamAnalysisDb19Json = `${JSON.stringify(teamAnalysisDb19Dataset)}\n`; const secondTeamAnalysisDb19Json = `${JSON.stringify(buildTeamAnalysisDb19())}\n`; if (sha256(firstTeamAnalysisDb19Json) !== sha256(secondTeamAnalysisDb19Json)) throw new Error("DB19 determinism check failed: two residual attributions differ"); const teamAnalysisDb19Gzip = gzipSync(Buffer.from(firstTeamAnalysisDb19Json, "utf8"), { level: 9 }); const secondTeamAnalysisDb19Gzip = gzipSync(Buffer.from(secondTeamAnalysisDb19Json, "utf8"), { level: 9 }); if (!teamAnalysisDb19Gzip.equals(secondTeamAnalysisDb19Gzip)) throw new Error("DB19 determinism check failed: gzip bytes differ"); const teamAnalysisDb19Coverage = buildDatabaseTeamAnalysisDb19Coverage(teamAnalysisDb19Dataset, teamAnalysisDb15Dataset.ruleConditionParity.length); const teamAnalysisDb19Goldens = await validateDatabaseTeamAnalysisDb19Goldens(teamAnalysisDb19Dataset, teamAnalysisDb19Coverage); if (teamAnalysisDb19Goldens.failures.length > 0) throw new Error(`DB19 golden fixture validation failed: ${JSON.stringify(teamAnalysisDb19Goldens.failures)}`); const teamAnalysisDb19Report = renderDatabaseTeamAnalysisDb19Report(teamAnalysisDb19Dataset, teamAnalysisDb19Coverage);
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
    const teamAnalysisDb5Manifest: DatabaseTeamAnalysisDb5ArtifactManifest = {
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
    const teamAnalysisDb6Manifest: DatabaseTeamAnalysisDb6ArtifactManifest = {
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
    const teamAnalysisDb7Manifest: DatabaseTeamAnalysisDb7ArtifactManifest = {
        schemaVersion: 1, contractVersion: "0.6.0", generatedAt: options.generatedAt,
        fileName: "team-analysis-db7-experiment.json.gz", compression: "gzip", sha256: sha256(teamAnalysisDb7Gzip),
        sizeBytes: teamAnalysisDb7Gzip.byteLength, uncompressedSizeBytes: Buffer.byteLength(firstTeamAnalysisDb7Json, "utf8"),
        stateCount: teamAnalysisDb7Dataset.states.length, sourceSha256: before.sha256, currentTeamAnalysisSha256: currentTeamAnalysis.sha256,
        coverageFile: "team-analysis-db7-coverage.json", parityFile: "team-analysis-db7-parity.json", reportFile: "team-analysis-db7-report.md", goldenValidationFile: "team-analysis-db7-golden-validation.json",
    };
    const teamAnalysisDb8Manifest: DatabaseTeamAnalysisDb8ArtifactManifest = {
        schemaVersion: 1, contractVersion: "0.7.0", generatedAt: options.generatedAt,
        fileName: "team-analysis-db8-evidence-experiment.json.gz", compression: "gzip", sha256: sha256(teamAnalysisDb8Gzip),
        sizeBytes: teamAnalysisDb8Gzip.byteLength, uncompressedSizeBytes: Buffer.byteLength(firstTeamAnalysisDb8Json, "utf8"),
        sourceStateCount: teamAnalysisDb8Dataset.sourceStateCount, semanticPromotionCount: 0, sourceSha256: before.sha256,
        sourceDb7Sha256: sha256(teamAnalysisDb7Gzip), coverageFile: "team-analysis-db8-coverage.json", reportFile: "team-analysis-db8-report.md",
        goldenValidationFile: "team-analysis-db8-golden-validation.json",
    };
    const teamAnalysisDb9Manifest: DatabaseTeamAnalysisDb9ArtifactManifest = { schemaVersion: 1, contractVersion: "0.8.0", generatedAt: options.generatedAt,
        fileName: "team-analysis-db9-runtime-evidence.json.gz", compression: "gzip", sha256: sha256(teamAnalysisDb9Gzip), sizeBytes: teamAnalysisDb9Gzip.byteLength, uncompressedSizeBytes: Buffer.byteLength(firstTeamAnalysisDb9Json, "utf8"),
        semanticPromotionCount: 0, runtimeIdentityResolutionCount: teamAnalysisDb9Dataset.runtimeIdentityResolutionCount, sourceDatabaseSha256: before.sha256, sourceDb8Sha256: sha256(teamAnalysisDb8Gzip), nativeRuntimeSha256: nativeBefore.sha256, nativeRuntimeLayoutSha256: nativeLayoutSha256,
        coverageFile: "team-analysis-db9-coverage.json", reportFile: "team-analysis-db9-report.md", goldenValidationFile: "team-analysis-db9-golden-validation.json" };
    const teamAnalysisDb10Manifest: DatabaseTeamAnalysisDb10ArtifactManifest = { schemaVersion: 1, contractVersion: "0.9.0", generatedAt: options.generatedAt,
        fileName: "team-analysis-db10-semantic-evidence.json.gz", compression: "gzip", sha256: sha256(teamAnalysisDb10Gzip), sizeBytes: teamAnalysisDb10Gzip.byteLength, uncompressedSizeBytes: Buffer.byteLength(firstTeamAnalysisDb10Json, "utf8"),
        semanticPromotionCount: 3, promotedOccurrenceCount: teamAnalysisDb10Dataset.promotedOccurrenceCount, sourceDatabaseSha256: before.sha256,
        sourceDb8Sha256: sha256(teamAnalysisDb8Gzip), sourceDb9Sha256: sha256(teamAnalysisDb9Gzip), nativeRuntimeSha256: nativeBefore.sha256, nativeSemanticsLayoutSha256: nativeSemanticsSha256,
        coverageFile: "team-analysis-db10-coverage.json", reportFile: "team-analysis-db10-report.md", goldenValidationFile: "team-analysis-db10-golden-validation.json" };
    const teamAnalysisDb11Manifest: DatabaseTeamAnalysisDb11ArtifactManifest = { schemaVersion: 1, contractVersion: "0.10.0", generatedAt: options.generatedAt,
        fileName: "team-analysis-db11-experiment.json.gz", compression: "gzip", sha256: sha256(teamAnalysisDb11Gzip), sizeBytes: teamAnalysisDb11Gzip.byteLength, uncompressedSizeBytes: Buffer.byteLength(firstTeamAnalysisDb11Json, "utf8"),
        stateCount: teamAnalysisDb11Dataset.states.length, runtimePredicateCount: teamAnalysisDb11Coverage.runtimePredicateCount, semanticPromotionCount: 3,
        sourceDatabaseSha256: before.sha256, sourceDb7Sha256: sha256(teamAnalysisDb7Gzip), sourceDb10Sha256: sha256(teamAnalysisDb10Gzip), currentTeamAnalysisSha256: currentTeamAnalysis.sha256,
        coverageFile: "team-analysis-db11-coverage.json", parityFile: "team-analysis-db11-parity.json", reportFile: "team-analysis-db11-report.md", goldenValidationFile: "team-analysis-db11-golden-validation.json" };
    const teamAnalysisDb12Manifest: DatabaseTeamAnalysisDb12ArtifactManifest = { schemaVersion: 1, contractVersion: "0.11.0", generatedAt: options.generatedAt,
        fileName: "team-analysis-db12-divergence-attribution.json.gz", compression: "gzip", sha256: sha256(teamAnalysisDb12Gzip), sizeBytes: teamAnalysisDb12Gzip.byteLength, uncompressedSizeBytes: Buffer.byteLength(firstTeamAnalysisDb12Json, "utf8"),
        matchedStateCount: teamAnalysisDb12Dataset.matchedStateCount, divergenceAttributionCount: teamAnalysisDb12Dataset.databaseOnlyAttributions.length + teamAnalysisDb12Dataset.currentOnlyAttributions.length,
        exactTurnEncodingCandidateCount: teamAnalysisDb12Dataset.exactTurnEncodingCandidates.length, semanticPromotionCount: 0, sourceDatabaseSha256: before.sha256,
        sourceDb11Sha256: sha256(teamAnalysisDb11Gzip), sourceDb11ParitySha256: sha256(teamAnalysisDb11ParityJson), currentTeamAnalysisSha256: currentTeamAnalysis.sha256,
        coverageFile: "team-analysis-db12-coverage.json", reportFile: "team-analysis-db12-report.md", goldenValidationFile: "team-analysis-db12-golden-validation.json" };
    const teamAnalysisDb13Manifest: DatabaseTeamAnalysisDb13ArtifactManifest = { schemaVersion: 1, contractVersion: "0.12.1", generatedAt: options.generatedAt,
        fileName: "team-analysis-db13-rule-alignment.json.gz", compression: "gzip", sha256: sha256(teamAnalysisDb13Gzip), sizeBytes: teamAnalysisDb13Gzip.byteLength, uncompressedSizeBytes: Buffer.byteLength(firstTeamAnalysisDb13Json, "utf8"),
        matchedStateCount: teamAnalysisDb13Dataset.matchedStateCount, ruleAlignmentCount: teamAnalysisDb13Dataset.ruleAlignments.length, exactTurnRuleAlignedCount: teamAnalysisDb13Coverage.exactTurnRuleAlignedCount, semanticPromotionCount: 0,
        sourceDatabaseSha256: before.sha256, sourceDb11Sha256: sha256(teamAnalysisDb11Gzip), sourceDb12Sha256: sha256(teamAnalysisDb12Gzip), currentTeamAnalysisSha256: currentTeamAnalysis.sha256,
        coverageFile: "team-analysis-db13-coverage.json", reportFile: "team-analysis-db13-report.md", goldenValidationFile: "team-analysis-db13-golden-validation.json" };
    const teamAnalysisDb14Manifest: DatabaseTeamAnalysisDb14ArtifactManifest = { schemaVersion: 1, contractVersion: "0.13.0", generatedAt: options.generatedAt,
        fileName: "team-analysis-db14-exact-turn-compatibility.json.gz", compression: "gzip", sha256: sha256(teamAnalysisDb14Gzip), sizeBytes: teamAnalysisDb14Gzip.byteLength, uncompressedSizeBytes: Buffer.byteLength(firstTeamAnalysisDb14Json, "utf8"),
        compatibilityAliasCount: teamAnalysisDb14Dataset.exactTurnCompatibilityAliases.length, semanticPromotionCount: 0, sourceDatabaseSha256: before.sha256,
        sourceDb11Sha256: sha256(teamAnalysisDb11Gzip), sourceDb12Sha256: sha256(teamAnalysisDb12Gzip), sourceDb13Sha256: sha256(teamAnalysisDb13Gzip), currentTeamAnalysisSha256: currentTeamAnalysis.sha256,
        coverageFile: "team-analysis-db14-coverage.json", reportFile: "team-analysis-db14-report.md", goldenValidationFile: "team-analysis-db14-golden-validation.json" };
    const teamAnalysisDb15Manifest: DatabaseTeamAnalysisDb15ArtifactManifest = { schemaVersion: 1, contractVersion: "0.14.0", generatedAt: options.generatedAt,
        fileName: "team-analysis-db15-rule-condition-parity.json.gz", compression: "gzip", sha256: sha256(teamAnalysisDb15Gzip), sizeBytes: teamAnalysisDb15Gzip.byteLength, uncompressedSizeBytes: Buffer.byteLength(firstTeamAnalysisDb15Json, "utf8"),
        comparableRulePairCount: teamAnalysisDb15Coverage.comparableRulePairCount, appliedCompatibilityAliasCount: teamAnalysisDb15Coverage.appliedCompatibilityAliasCount, semanticPromotionCount: 0, sourceDatabaseSha256: before.sha256,
        sourceDb11Sha256: sha256(teamAnalysisDb11Gzip), sourceDb13Sha256: sha256(teamAnalysisDb13Gzip), sourceDb14Sha256: sha256(teamAnalysisDb14Gzip), currentTeamAnalysisSha256: currentTeamAnalysis.sha256,
        coverageFile: "team-analysis-db15-coverage.json", reportFile: "team-analysis-db15-report.md", goldenValidationFile: "team-analysis-db15-golden-validation.json" };
    const teamAnalysisDb16Manifest: DatabaseTeamAnalysisDb16ArtifactManifest = { schemaVersion: 1, contractVersion: "0.15.0", generatedAt: options.generatedAt,
        fileName: "team-analysis-db16-residual-attribution.json.gz", compression: "gzip", sha256: sha256(teamAnalysisDb16Gzip), sizeBytes: teamAnalysisDb16Gzip.byteLength, uncompressedSizeBytes: Buffer.byteLength(firstTeamAnalysisDb16Json, "utf8"), residualAttributionCount: teamAnalysisDb16Coverage.residualAttributionCount, unprovenCandidateAttributionCount: teamAnalysisDb16Coverage.unprovenCandidateAttributionCount, semanticPromotionCount: 0,
        sourceDatabaseSha256: before.sha256, sourceDb15Sha256: sha256(teamAnalysisDb15Gzip), currentTeamAnalysisSha256: currentTeamAnalysis.sha256, coverageFile: "team-analysis-db16-coverage.json", reportFile: "team-analysis-db16-report.md", goldenValidationFile: "team-analysis-db16-golden-validation.json" };
    const teamAnalysisDb17Manifest: DatabaseTeamAnalysisDb17ArtifactManifest = { schemaVersion: 1, contractVersion: "0.16.0", generatedAt: options.generatedAt, fileName: "team-analysis-db17-appearance-turn-evidence.json.gz", compression: "gzip", sha256: sha256(teamAnalysisDb17Gzip), sizeBytes: teamAnalysisDb17Gzip.byteLength, uncompressedSizeBytes: Buffer.byteLength(firstTeamAnalysisDb17Json, "utf8"), conclusionCount: teamAnalysisDb17Coverage.conclusionCount, affectedRulePairCount: teamAnalysisDb17Coverage.affectedRulePairCount, semanticPromotionCount: 3, sourceDatabaseSha256: before.sha256, sourceDb16Sha256: sha256(teamAnalysisDb16Gzip), nativeRuntimeSha256: nativeBefore.sha256, lifecycleEvidenceSha256, coverageFile: "team-analysis-db17-coverage.json", reportFile: "team-analysis-db17-report.md", goldenValidationFile: "team-analysis-db17-golden-validation.json" };
    const teamAnalysisDb18Manifest: DatabaseTeamAnalysisDb18ArtifactManifest = { schemaVersion: 1, contractVersion: "0.17.1", generatedAt: options.generatedAt, fileName: "team-analysis-db18-lifecycle-compatibility-parity.json.gz", compression: "gzip", sha256: sha256(teamAnalysisDb18Gzip), sizeBytes: teamAnalysisDb18Gzip.byteLength, uncompressedSizeBytes: Buffer.byteLength(firstTeamAnalysisDb18Json, "utf8"), affectedRulePairCount: teamAnalysisDb18Coverage.affectedRulePairCount, exactPairDelta: teamAnalysisDb18Coverage.exactPairDelta, resolvedDb16AttributionCount: teamAnalysisDb18Coverage.resolvedDb16AttributionCount, inheritedSemanticPromotionCount: 3, semanticPromotionCount: 0, sourceDatabaseSha256: before.sha256, sourceDb15Sha256: sha256(teamAnalysisDb15Gzip), sourceDb16Sha256: sha256(teamAnalysisDb16Gzip), sourceDb17Sha256: sha256(teamAnalysisDb17Gzip), currentTeamAnalysisSha256: currentTeamAnalysis.sha256, coverageFile: "team-analysis-db18-coverage.json", reportFile: "team-analysis-db18-report.md", goldenValidationFile: "team-analysis-db18-golden-validation.json" };
    const teamAnalysisDb19Manifest: DatabaseTeamAnalysisDb19ArtifactManifest = { schemaVersion: 1, contractVersion: "0.18.0", generatedAt: options.generatedAt, fileName: "team-analysis-db19-post-lifecycle-residuals.json.gz", compression: "gzip", sha256: sha256(teamAnalysisDb19Gzip), sizeBytes: teamAnalysisDb19Gzip.byteLength, uncompressedSizeBytes: Buffer.byteLength(firstTeamAnalysisDb19Json, "utf8"), residualAttributionCount: teamAnalysisDb19Coverage.residualAttributionCount, residualPatternCount: teamAnalysisDb19Coverage.residualPatternCount, inheritedSemanticPromotionCount: 3, semanticPromotionCount: 0, sourceDatabaseSha256: before.sha256, sourceDb15Sha256: sha256(teamAnalysisDb15Gzip), sourceDb18Sha256: sha256(teamAnalysisDb18Gzip), currentTeamAnalysisSha256: currentTeamAnalysis.sha256, coverageFile: "team-analysis-db19-coverage.json", reportFile: "team-analysis-db19-report.md", goldenValidationFile: "team-analysis-db19-golden-validation.json" };

    const after = await fingerprint(options.databasePath);
    const nativeAfter = await fingerprint(options.nativeRuntimePath);
    if (before.sizeBytes !== after.sizeBytes || before.sha256 !== after.sha256 || before.modifiedAtMs !== after.modifiedAtMs) {
        throw new Error("Read-only source guarantee failed: source database fingerprint or mtime changed");
    }
    if (nativeBefore.sizeBytes !== nativeAfter.sizeBytes || nativeBefore.sha256 !== nativeAfter.sha256 || nativeBefore.modifiedAtMs !== nativeAfter.modifiedAtMs) throw new Error("Read-only native runtime guarantee failed: fingerprint or mtime changed");
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
        writeFile(resolve(options.outputDir, teamAnalysisDb5Manifest.fileName), teamAnalysisDb5Gzip),
        writeFile(resolve(options.outputDir, "team-analysis-db5-manifest.json"), `${JSON.stringify(teamAnalysisDb5Manifest, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb5Manifest.coverageFile), `${JSON.stringify(teamAnalysisDb5Coverage, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb5Manifest.parityFile), `${JSON.stringify(teamAnalysisDb5Parity, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb5Manifest.reportFile), teamAnalysisDb5Report, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb5Manifest.goldenValidationFile), `${JSON.stringify(teamAnalysisDb5Goldens, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb6Manifest.fileName), teamAnalysisDb6Gzip),
        writeFile(resolve(options.outputDir, "team-analysis-db6-manifest.json"), `${JSON.stringify(teamAnalysisDb6Manifest, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb6Manifest.coverageFile), `${JSON.stringify(teamAnalysisDb6Coverage, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb6Manifest.parityFile), `${JSON.stringify(teamAnalysisDb6Parity, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb6Manifest.reportFile), teamAnalysisDb6Report, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb6Manifest.goldenValidationFile), `${JSON.stringify(teamAnalysisDb6Goldens, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb7Manifest.fileName), teamAnalysisDb7Gzip),
        writeFile(resolve(options.outputDir, "team-analysis-db7-manifest.json"), `${JSON.stringify(teamAnalysisDb7Manifest, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb7Manifest.coverageFile), `${JSON.stringify(teamAnalysisDb7Coverage, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb7Manifest.parityFile), `${JSON.stringify(teamAnalysisDb7Parity, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb7Manifest.reportFile), teamAnalysisDb7Report, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb7Manifest.goldenValidationFile), `${JSON.stringify(teamAnalysisDb7Goldens, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb8Manifest.fileName), teamAnalysisDb8Gzip),
        writeFile(resolve(options.outputDir, "team-analysis-db8-manifest.json"), `${JSON.stringify(teamAnalysisDb8Manifest, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb8Manifest.coverageFile), `${JSON.stringify(teamAnalysisDb8Coverage, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb8Manifest.reportFile), teamAnalysisDb8Report, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb8Manifest.goldenValidationFile), `${JSON.stringify(teamAnalysisDb8Goldens, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb9Manifest.fileName), teamAnalysisDb9Gzip),
        writeFile(resolve(options.outputDir, "team-analysis-db9-manifest.json"), `${JSON.stringify(teamAnalysisDb9Manifest, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb9Manifest.coverageFile), `${JSON.stringify(teamAnalysisDb9Coverage, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb9Manifest.reportFile), teamAnalysisDb9Report, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb9Manifest.goldenValidationFile), `${JSON.stringify(teamAnalysisDb9Goldens, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb10Manifest.fileName), teamAnalysisDb10Gzip),
        writeFile(resolve(options.outputDir, "team-analysis-db10-manifest.json"), `${JSON.stringify(teamAnalysisDb10Manifest, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb10Manifest.coverageFile), `${JSON.stringify(teamAnalysisDb10Coverage, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb10Manifest.reportFile), teamAnalysisDb10Report, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb10Manifest.goldenValidationFile), `${JSON.stringify(teamAnalysisDb10Goldens, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb11Manifest.fileName), teamAnalysisDb11Gzip),
        writeFile(resolve(options.outputDir, "team-analysis-db11-manifest.json"), `${JSON.stringify(teamAnalysisDb11Manifest, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb11Manifest.coverageFile), `${JSON.stringify(teamAnalysisDb11Coverage, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb11Manifest.parityFile), teamAnalysisDb11ParityJson, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb11Manifest.reportFile), teamAnalysisDb11Report, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb11Manifest.goldenValidationFile), `${JSON.stringify(teamAnalysisDb11Goldens, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb12Manifest.fileName), teamAnalysisDb12Gzip),
        writeFile(resolve(options.outputDir, "team-analysis-db12-manifest.json"), `${JSON.stringify(teamAnalysisDb12Manifest, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb12Manifest.coverageFile), `${JSON.stringify(teamAnalysisDb12Coverage, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb12Manifest.reportFile), teamAnalysisDb12Report, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb12Manifest.goldenValidationFile), `${JSON.stringify(teamAnalysisDb12Goldens, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb13Manifest.fileName), teamAnalysisDb13Gzip),
        writeFile(resolve(options.outputDir, "team-analysis-db13-manifest.json"), `${JSON.stringify(teamAnalysisDb13Manifest, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb13Manifest.coverageFile), `${JSON.stringify(teamAnalysisDb13Coverage, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb13Manifest.reportFile), teamAnalysisDb13Report, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb13Manifest.goldenValidationFile), `${JSON.stringify(teamAnalysisDb13Goldens, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb14Manifest.fileName), teamAnalysisDb14Gzip),
        writeFile(resolve(options.outputDir, "team-analysis-db14-manifest.json"), `${JSON.stringify(teamAnalysisDb14Manifest, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb14Manifest.coverageFile), `${JSON.stringify(teamAnalysisDb14Coverage, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb14Manifest.reportFile), teamAnalysisDb14Report, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb14Manifest.goldenValidationFile), `${JSON.stringify(teamAnalysisDb14Goldens, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb15Manifest.fileName), teamAnalysisDb15Gzip),
        writeFile(resolve(options.outputDir, "team-analysis-db15-manifest.json"), `${JSON.stringify(teamAnalysisDb15Manifest, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb15Manifest.coverageFile), `${JSON.stringify(teamAnalysisDb15Coverage, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb15Manifest.reportFile), teamAnalysisDb15Report, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb15Manifest.goldenValidationFile), `${JSON.stringify(teamAnalysisDb15Goldens, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb16Manifest.fileName), teamAnalysisDb16Gzip),
        writeFile(resolve(options.outputDir, "team-analysis-db16-manifest.json"), `${JSON.stringify(teamAnalysisDb16Manifest, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb16Manifest.coverageFile), `${JSON.stringify(teamAnalysisDb16Coverage, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb16Manifest.reportFile), teamAnalysisDb16Report, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb16Manifest.goldenValidationFile), `${JSON.stringify(teamAnalysisDb16Goldens, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb17Manifest.fileName), teamAnalysisDb17Gzip),
        writeFile(resolve(options.outputDir, "team-analysis-db17-manifest.json"), `${JSON.stringify(teamAnalysisDb17Manifest, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb17Manifest.coverageFile), `${JSON.stringify(teamAnalysisDb17Coverage, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb17Manifest.reportFile), teamAnalysisDb17Report, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb17Manifest.goldenValidationFile), `${JSON.stringify(teamAnalysisDb17Goldens, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb18Manifest.fileName), teamAnalysisDb18Gzip),
        writeFile(resolve(options.outputDir, "team-analysis-db18-manifest.json"), `${JSON.stringify(teamAnalysisDb18Manifest, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb18Manifest.coverageFile), `${JSON.stringify(teamAnalysisDb18Coverage, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb18Manifest.reportFile), teamAnalysisDb18Report, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb18Manifest.goldenValidationFile), `${JSON.stringify(teamAnalysisDb18Goldens, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb19Manifest.fileName), teamAnalysisDb19Gzip),
        writeFile(resolve(options.outputDir, "team-analysis-db19-manifest.json"), `${JSON.stringify(teamAnalysisDb19Manifest, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb19Manifest.coverageFile), `${JSON.stringify(teamAnalysisDb19Coverage, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb19Manifest.reportFile), teamAnalysisDb19Report, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb19Manifest.goldenValidationFile), `${JSON.stringify(teamAnalysisDb19Goldens, null, 2)}\n`, "utf8"),
    ]);
    return { manifest, sourceManifest, teamAnalysisManifest, teamAnalysisDb3Manifest, teamAnalysisDb4Manifest, teamAnalysisDb5Manifest, teamAnalysisDb6Manifest, teamAnalysisDb7Manifest, teamAnalysisDb8Manifest, teamAnalysisDb9Manifest, teamAnalysisDb10Manifest, teamAnalysisDb11Manifest, teamAnalysisDb12Manifest, teamAnalysisDb13Manifest, teamAnalysisDb14Manifest, teamAnalysisDb15Manifest, teamAnalysisDb16Manifest, teamAnalysisDb17Manifest, teamAnalysisDb18Manifest, teamAnalysisDb19Manifest, outputDir: options.outputDir, deterministicRebuildSha256: sha256(secondGzip) };
}

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
