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
import { buildDatabaseTeamAnalysisDb20Coverage, buildDatabaseTeamAnalysisDb20Dataset } from "./team-analysis-db20-builder";
import { DatabaseTeamAnalysisDb20ArtifactManifest } from "./team-analysis-db20-contract";
import { validateDatabaseTeamAnalysisDb20Goldens } from "./team-analysis-db20-golden";
import { renderDatabaseTeamAnalysisDb20Report } from "./team-analysis-db20-report";
import { buildDatabaseTeamAnalysisDb21Coverage, buildDatabaseTeamAnalysisDb21Dataset, Db21NativeLinkageEvidence } from "./team-analysis-db21-builder";
import { DatabaseTeamAnalysisDb21ArtifactManifest } from "./team-analysis-db21-contract";
import { validateDatabaseTeamAnalysisDb21Goldens } from "./team-analysis-db21-golden";
import { renderDatabaseTeamAnalysisDb21Report } from "./team-analysis-db21-report";
import { buildDatabaseTeamAnalysisDb22Coverage, buildDatabaseTeamAnalysisDb22Dataset } from "./team-analysis-db22-builder";
import { DatabaseTeamAnalysisDb22ArtifactManifest } from "./team-analysis-db22-contract";
import { validateDatabaseTeamAnalysisDb22Goldens } from "./team-analysis-db22-golden";
import { renderDatabaseTeamAnalysisDb22Report } from "./team-analysis-db22-report";
import { buildDatabaseTeamAnalysisDb23Coverage, buildDatabaseTeamAnalysisDb23Dataset } from "./team-analysis-db23-builder";
import { DatabaseTeamAnalysisDb23ArtifactManifest } from "./team-analysis-db23-contract";
import { validateDatabaseTeamAnalysisDb23Goldens } from "./team-analysis-db23-golden";
import { renderDatabaseTeamAnalysisDb23Report } from "./team-analysis-db23-report";
import { buildDatabaseTeamAnalysisDb24Coverage, buildDatabaseTeamAnalysisDb24Dataset } from "./team-analysis-db24-builder";
import { DatabaseTeamAnalysisDb24ArtifactManifest, Db24NativeCounterEvidence } from "./team-analysis-db24-contract";
import { validateDatabaseTeamAnalysisDb24Goldens } from "./team-analysis-db24-golden";
import { renderDatabaseTeamAnalysisDb24Report } from "./team-analysis-db24-report";
import { buildDatabaseTeamAnalysisDb25Coverage, buildDatabaseTeamAnalysisDb25Dataset } from "./team-analysis-db25-builder";
import { DatabaseTeamAnalysisDb25ArtifactManifest, Db25NativeAttackContextEvidence } from "./team-analysis-db25-contract";
import { validateDatabaseTeamAnalysisDb25Goldens } from "./team-analysis-db25-golden";
import { renderDatabaseTeamAnalysisDb25Report } from "./team-analysis-db25-report";
import { buildDatabaseTeamAnalysisDb26Coverage, buildDatabaseTeamAnalysisDb26Dataset } from "./team-analysis-db26-builder";
import { DatabaseTeamAnalysisDb26ArtifactManifest, Db26NativeSpecialCategoryEvidence } from "./team-analysis-db26-contract";
import { validateDatabaseTeamAnalysisDb26Goldens } from "./team-analysis-db26-golden";
import { renderDatabaseTeamAnalysisDb26Report } from "./team-analysis-db26-report";
import { buildDatabaseTeamAnalysisDb27Coverage, buildDatabaseTeamAnalysisDb27Dataset } from "./team-analysis-db27-builder";
import { DatabaseTeamAnalysisDb27ArtifactManifest, Db27NativeTargetHpEvidence } from "./team-analysis-db27-contract";
import { validateDatabaseTeamAnalysisDb27Goldens } from "./team-analysis-db27-golden";
import { renderDatabaseTeamAnalysisDb27Report } from "./team-analysis-db27-report";
import { buildDatabaseTeamAnalysisDb28Coverage, buildDatabaseTeamAnalysisDb28Dataset } from "./team-analysis-db28-builder";
import { DatabaseTeamAnalysisDb28ArtifactManifest, Db28NativeRevivalEvidence } from "./team-analysis-db28-contract";
import { validateDatabaseTeamAnalysisDb28Goldens } from "./team-analysis-db28-golden";
import { renderDatabaseTeamAnalysisDb28Report } from "./team-analysis-db28-report";
import { buildDatabaseTeamAnalysisDb29Coverage, buildDatabaseTeamAnalysisDb29Dataset } from "./team-analysis-db29-builder";
import { DatabaseTeamAnalysisDb29ArtifactManifest, Db29NativeAttackBreakEvidence } from "./team-analysis-db29-contract";
import { validateDatabaseTeamAnalysisDb29Goldens } from "./team-analysis-db29-golden";
import { renderDatabaseTeamAnalysisDb29Report } from "./team-analysis-db29-report";
import { buildDatabaseTeamAnalysisDb30Coverage, buildDatabaseTeamAnalysisDb30Dataset } from "./team-analysis-db30-builder";
import { DatabaseTeamAnalysisDb30ArtifactManifest, Db30NativeRemovalEvidence } from "./team-analysis-db30-contract";
import { validateDatabaseTeamAnalysisDb30Goldens } from "./team-analysis-db30-golden";
import { renderDatabaseTeamAnalysisDb30Report } from "./team-analysis-db30-report";
import { buildDatabaseTeamAnalysisDb31Coverage, buildDatabaseTeamAnalysisDb31Dataset } from "./team-analysis-db31-builder";
import { DatabaseTeamAnalysisDb31ArtifactManifest, Db31NativeEvidence } from "./team-analysis-db31-contract";
import { validateDatabaseTeamAnalysisDb31Goldens } from "./team-analysis-db31-golden";
import { renderDatabaseTeamAnalysisDb31Report } from "./team-analysis-db31-report";
import { validateDatabaseTeamAnalysisDb31Dataset } from "./team-analysis-db31-validator";
import { buildDatabaseTeamAnalysisDb32Coverage, buildDatabaseTeamAnalysisDb32Dataset } from "./team-analysis-db32-builder";
import { DatabaseTeamAnalysisDb32ArtifactManifest, Db32NativeEvidence } from "./team-analysis-db32-contract";
import { validateDatabaseTeamAnalysisDb32Goldens } from "./team-analysis-db32-golden";
import { renderDatabaseTeamAnalysisDb32Report } from "./team-analysis-db32-report";
import { validateDatabaseTeamAnalysisDb32Dataset } from "./team-analysis-db32-validator";
import { buildDatabaseTeamAnalysisDb33Coverage, buildDatabaseTeamAnalysisDb33Dataset } from "./team-analysis-db33-builder";
import { DatabaseTeamAnalysisDb33ArtifactManifest, Db33NativeEvidence } from "./team-analysis-db33-contract";
import { validateDatabaseTeamAnalysisDb33Goldens } from "./team-analysis-db33-golden";
import { renderDatabaseTeamAnalysisDb33Report } from "./team-analysis-db33-report";
import { validateDatabaseTeamAnalysisDb33Dataset } from "./team-analysis-db33-validator";
import { buildDatabaseTeamAnalysisDb34Coverage, buildDatabaseTeamAnalysisDb34Dataset } from "./team-analysis-db34-builder";
import { DatabaseTeamAnalysisDb34ArtifactManifest, Db34NativeEvidence } from "./team-analysis-db34-contract";
import { validateDatabaseTeamAnalysisDb34Goldens } from "./team-analysis-db34-golden";
import { renderDatabaseTeamAnalysisDb34Report } from "./team-analysis-db34-report";
import { validateDatabaseTeamAnalysisDb34Dataset } from "./team-analysis-db34-validator";
import { buildDatabaseTeamAnalysisDb35Coverage, buildDatabaseTeamAnalysisDb35Dataset } from "./team-analysis-db35-builder";
import { DatabaseTeamAnalysisDb35ArtifactManifest, Db35NativeEvidence } from "./team-analysis-db35-contract";
import { validateDatabaseTeamAnalysisDb35Goldens } from "./team-analysis-db35-golden";
import { renderDatabaseTeamAnalysisDb35Report } from "./team-analysis-db35-report";
import { validateDatabaseTeamAnalysisDb35Dataset } from "./team-analysis-db35-validator";
import { buildDatabaseTeamAnalysisDb36Coverage, buildDatabaseTeamAnalysisDb36Dataset } from "./team-analysis-db36-builder";
import { DatabaseTeamAnalysisDb36ArtifactManifest, Db36NativeEvidence } from "./team-analysis-db36-contract";
import { validateDatabaseTeamAnalysisDb36Goldens } from "./team-analysis-db36-golden";
import { renderDatabaseTeamAnalysisDb36Report } from "./team-analysis-db36-report";
import { validateDatabaseTeamAnalysisDb36Dataset } from "./team-analysis-db36-validator";
import { buildDatabaseTeamAnalysisDb37Coverage, buildDatabaseTeamAnalysisDb37Dataset } from "./team-analysis-db37-builder";
import { DatabaseTeamAnalysisDb37ArtifactManifest, Db37NativeEvidence } from "./team-analysis-db37-contract";
import { validateDatabaseTeamAnalysisDb37Goldens } from "./team-analysis-db37-golden";
import { renderDatabaseTeamAnalysisDb37Report } from "./team-analysis-db37-report";
import { validateDatabaseTeamAnalysisDb37Dataset } from "./team-analysis-db37-validator";
import { buildDatabaseTeamAnalysisDb38Coverage, buildDatabaseTeamAnalysisDb38Dataset } from "./team-analysis-db38-builder";
import { DatabaseTeamAnalysisDb38ArtifactManifest, Db38NativeEvidence } from "./team-analysis-db38-contract";
import { validateDatabaseTeamAnalysisDb38Goldens } from "./team-analysis-db38-golden";
import { renderDatabaseTeamAnalysisDb38Report } from "./team-analysis-db38-report";
import { validateDatabaseTeamAnalysisDb38Dataset } from "./team-analysis-db38-validator";
import { buildDatabaseTeamAnalysisDb39Coverage, buildDatabaseTeamAnalysisDb39Dataset } from "./team-analysis-db39-builder";
import { DatabaseTeamAnalysisDb39ArtifactManifest, Db39NativeEvidence } from "./team-analysis-db39-contract";
import { validateDatabaseTeamAnalysisDb39Goldens } from "./team-analysis-db39-golden";
import { renderDatabaseTeamAnalysisDb39Report } from "./team-analysis-db39-report";
import { validateDatabaseTeamAnalysisDb39Dataset } from "./team-analysis-db39-validator";
import { buildDatabaseTeamAnalysisDb40Coverage, buildDatabaseTeamAnalysisDb40Dataset } from "./team-analysis-db40-builder";
import { DatabaseTeamAnalysisDb40ArtifactManifest, Db40NativeEvidence } from "./team-analysis-db40-contract";
import { validateDatabaseTeamAnalysisDb40Goldens } from "./team-analysis-db40-golden";
import { renderDatabaseTeamAnalysisDb40Report } from "./team-analysis-db40-report";
import { validateDatabaseTeamAnalysisDb40Dataset } from "./team-analysis-db40-validator";
import { buildDatabaseTeamAnalysisDb41Coverage, buildDatabaseTeamAnalysisDb41Dataset } from "./team-analysis-db41-builder";
import { DatabaseTeamAnalysisDb41ArtifactManifest, Db41NativeEvidence } from "./team-analysis-db41-contract";
import { validateDatabaseTeamAnalysisDb41Goldens } from "./team-analysis-db41-golden";
import { renderDatabaseTeamAnalysisDb41Report } from "./team-analysis-db41-report";
import { validateDatabaseTeamAnalysisDb41Dataset } from "./team-analysis-db41-validator";
import { buildDatabaseTeamAnalysisDb42Coverage, buildDatabaseTeamAnalysisDb42Dataset } from "./team-analysis-db42-builder";
import { DatabaseTeamAnalysisDb42ArtifactManifest, Db42NativeEvidence } from "./team-analysis-db42-contract";
import { validateDatabaseTeamAnalysisDb42Goldens } from "./team-analysis-db42-golden";
import { renderDatabaseTeamAnalysisDb42Report } from "./team-analysis-db42-report";
import { validateDatabaseTeamAnalysisDb42Dataset } from "./team-analysis-db42-validator";
import { buildDatabaseTeamAnalysisDb43Coverage, buildDatabaseTeamAnalysisDb43Dataset } from "./team-analysis-db43-builder";
import { DatabaseTeamAnalysisDb43ArtifactManifest, Db43NativeEvidence } from "./team-analysis-db43-contract";
import { validateDatabaseTeamAnalysisDb43Goldens } from "./team-analysis-db43-golden";
import { renderDatabaseTeamAnalysisDb43Report } from "./team-analysis-db43-report";
import { validateDatabaseTeamAnalysisDb43Dataset } from "./team-analysis-db43-validator";

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
    teamAnalysisDb20Manifest: DatabaseTeamAnalysisDb20ArtifactManifest,
    teamAnalysisDb21Manifest: DatabaseTeamAnalysisDb21ArtifactManifest,
    teamAnalysisDb22Manifest: DatabaseTeamAnalysisDb22ArtifactManifest,
    teamAnalysisDb23Manifest: DatabaseTeamAnalysisDb23ArtifactManifest,
    teamAnalysisDb24Manifest: DatabaseTeamAnalysisDb24ArtifactManifest,
    teamAnalysisDb25Manifest: DatabaseTeamAnalysisDb25ArtifactManifest,
    teamAnalysisDb26Manifest: DatabaseTeamAnalysisDb26ArtifactManifest,
    teamAnalysisDb27Manifest: DatabaseTeamAnalysisDb27ArtifactManifest,
    teamAnalysisDb28Manifest: DatabaseTeamAnalysisDb28ArtifactManifest,
    teamAnalysisDb29Manifest: DatabaseTeamAnalysisDb29ArtifactManifest,
    teamAnalysisDb30Manifest: DatabaseTeamAnalysisDb30ArtifactManifest,
    teamAnalysisDb31Manifest: DatabaseTeamAnalysisDb31ArtifactManifest,
    teamAnalysisDb32Manifest: DatabaseTeamAnalysisDb32ArtifactManifest,
    teamAnalysisDb33Manifest: DatabaseTeamAnalysisDb33ArtifactManifest,
    teamAnalysisDb34Manifest: DatabaseTeamAnalysisDb34ArtifactManifest,
    teamAnalysisDb35Manifest: DatabaseTeamAnalysisDb35ArtifactManifest,
    teamAnalysisDb36Manifest: DatabaseTeamAnalysisDb36ArtifactManifest,
    teamAnalysisDb37Manifest: DatabaseTeamAnalysisDb37ArtifactManifest,
    teamAnalysisDb38Manifest: DatabaseTeamAnalysisDb38ArtifactManifest,
    teamAnalysisDb39Manifest: DatabaseTeamAnalysisDb39ArtifactManifest,
    teamAnalysisDb40Manifest: DatabaseTeamAnalysisDb40ArtifactManifest,
    teamAnalysisDb41Manifest: DatabaseTeamAnalysisDb41ArtifactManifest,
    teamAnalysisDb42Manifest: DatabaseTeamAnalysisDb42ArtifactManifest,
    teamAnalysisDb43Manifest: DatabaseTeamAnalysisDb43ArtifactManifest,
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
    const lifecycleEvidencePath = resolve(__dirname, "native-appearance-turn-lifecycle.json"); const lifecycleEvidenceBytes = await readFile(lifecycleEvidencePath); const lifecycleEvidence = JSON.parse(lifecycleEvidenceBytes.toString("utf8")) as Db17LifecycleEvidence; const lifecycleEvidenceSha256 = sha256(lifecycleEvidenceBytes);
    const buildTeamAnalysisDb17 = () => buildDatabaseTeamAnalysisDb17Dataset({ db16: teamAnalysisDb16Dataset, db16Sha256: sha256(teamAnalysisDb16Gzip), inspection: nativeInspection, nativePath: options.nativeRuntimePath, nativeSha256: nativeBefore.sha256, nativeSizeBytes: nativeBefore.sizeBytes, evidence: lifecycleEvidence, evidenceSha256: lifecycleEvidenceSha256 });
    const teamAnalysisDb17Dataset = buildTeamAnalysisDb17(); const firstTeamAnalysisDb17Json = `${JSON.stringify(teamAnalysisDb17Dataset)}\n`; const secondTeamAnalysisDb17Json = `${JSON.stringify(buildTeamAnalysisDb17())}\n`;
    if (sha256(firstTeamAnalysisDb17Json) !== sha256(secondTeamAnalysisDb17Json)) throw new Error("DB17 determinism check failed: two lifecycle evidence projections differ"); const teamAnalysisDb17Gzip = gzipSync(Buffer.from(firstTeamAnalysisDb17Json, "utf8"), { level: 9 }); const secondTeamAnalysisDb17Gzip = gzipSync(Buffer.from(secondTeamAnalysisDb17Json, "utf8"), { level: 9 }); if (!teamAnalysisDb17Gzip.equals(secondTeamAnalysisDb17Gzip)) throw new Error("DB17 determinism check failed: gzip bytes differ");
    const teamAnalysisDb17Coverage = buildDatabaseTeamAnalysisDb17Coverage(teamAnalysisDb17Dataset, teamAnalysisDb16Dataset); const teamAnalysisDb17Goldens = await validateDatabaseTeamAnalysisDb17Goldens(teamAnalysisDb17Dataset, teamAnalysisDb17Coverage); if (teamAnalysisDb17Goldens.failures.length > 0) throw new Error(`DB17 golden fixture validation failed: ${JSON.stringify(teamAnalysisDb17Goldens.failures)}`); const teamAnalysisDb17Report = renderDatabaseTeamAnalysisDb17Report(teamAnalysisDb17Dataset, teamAnalysisDb17Coverage);
    const buildTeamAnalysisDb18 = () => buildDatabaseTeamAnalysisDb18Dataset({ db15: teamAnalysisDb15Dataset, db15Sha256: sha256(teamAnalysisDb15Gzip), db16: teamAnalysisDb16Dataset, db16Sha256: sha256(teamAnalysisDb16Gzip), db17: teamAnalysisDb17Dataset, db17Sha256: sha256(teamAnalysisDb17Gzip) });
    const teamAnalysisDb18Dataset = buildTeamAnalysisDb18(); const firstTeamAnalysisDb18Json = `${JSON.stringify(teamAnalysisDb18Dataset)}\n`; const secondTeamAnalysisDb18Json = `${JSON.stringify(buildTeamAnalysisDb18())}\n`; if (sha256(firstTeamAnalysisDb18Json) !== sha256(secondTeamAnalysisDb18Json)) throw new Error("DB18 determinism check failed: two lifecycle compatibility projections differ"); const teamAnalysisDb18Gzip = gzipSync(Buffer.from(firstTeamAnalysisDb18Json, "utf8"), { level: 9 }); const secondTeamAnalysisDb18Gzip = gzipSync(Buffer.from(secondTeamAnalysisDb18Json, "utf8"), { level: 9 }); if (!teamAnalysisDb18Gzip.equals(secondTeamAnalysisDb18Gzip)) throw new Error("DB18 determinism check failed: gzip bytes differ");
    const teamAnalysisDb18Coverage = buildDatabaseTeamAnalysisDb18Coverage(teamAnalysisDb18Dataset, teamAnalysisDb15Dataset); const teamAnalysisDb18Goldens = await validateDatabaseTeamAnalysisDb18Goldens(teamAnalysisDb18Dataset, teamAnalysisDb18Coverage); if (teamAnalysisDb18Goldens.failures.length > 0) throw new Error(`DB18 golden fixture validation failed: ${JSON.stringify(teamAnalysisDb18Goldens.failures)}`); const teamAnalysisDb18Report = renderDatabaseTeamAnalysisDb18Report(teamAnalysisDb18Dataset, teamAnalysisDb18Coverage);
    const buildTeamAnalysisDb19 = () => buildDatabaseTeamAnalysisDb19Dataset({ db15: teamAnalysisDb15Dataset, db15Sha256: sha256(teamAnalysisDb15Gzip), db18: teamAnalysisDb18Dataset, db18Sha256: sha256(teamAnalysisDb18Gzip) }); const teamAnalysisDb19Dataset = buildTeamAnalysisDb19(); const firstTeamAnalysisDb19Json = `${JSON.stringify(teamAnalysisDb19Dataset)}\n`; const secondTeamAnalysisDb19Json = `${JSON.stringify(buildTeamAnalysisDb19())}\n`; if (sha256(firstTeamAnalysisDb19Json) !== sha256(secondTeamAnalysisDb19Json)) throw new Error("DB19 determinism check failed: two residual attributions differ"); const teamAnalysisDb19Gzip = gzipSync(Buffer.from(firstTeamAnalysisDb19Json, "utf8"), { level: 9 }); const secondTeamAnalysisDb19Gzip = gzipSync(Buffer.from(secondTeamAnalysisDb19Json, "utf8"), { level: 9 }); if (!teamAnalysisDb19Gzip.equals(secondTeamAnalysisDb19Gzip)) throw new Error("DB19 determinism check failed: gzip bytes differ"); const teamAnalysisDb19Coverage = buildDatabaseTeamAnalysisDb19Coverage(teamAnalysisDb19Dataset, teamAnalysisDb15Dataset.ruleConditionParity.length); const teamAnalysisDb19Goldens = await validateDatabaseTeamAnalysisDb19Goldens(teamAnalysisDb19Dataset, teamAnalysisDb19Coverage); if (teamAnalysisDb19Goldens.failures.length > 0) throw new Error(`DB19 golden fixture validation failed: ${JSON.stringify(teamAnalysisDb19Goldens.failures)}`); const teamAnalysisDb19Report = renderDatabaseTeamAnalysisDb19Report(teamAnalysisDb19Dataset, teamAnalysisDb19Coverage);
    const buildTeamAnalysisDb20 = () => buildDatabaseTeamAnalysisDb20Dataset({ db11: teamAnalysisDb11Dataset, db11Sha256: sha256(teamAnalysisDb11Gzip), db19: teamAnalysisDb19Dataset, db19Sha256: sha256(teamAnalysisDb19Gzip), tables }); const teamAnalysisDb20Dataset = buildTeamAnalysisDb20(); const firstTeamAnalysisDb20Json = `${JSON.stringify(teamAnalysisDb20Dataset)}\n`; const secondTeamAnalysisDb20Json = `${JSON.stringify(buildTeamAnalysisDb20())}\n`; if (sha256(firstTeamAnalysisDb20Json) !== sha256(secondTeamAnalysisDb20Json)) throw new Error("DB20 determinism check failed: two passive turn correlations differ"); const teamAnalysisDb20Gzip = gzipSync(Buffer.from(firstTeamAnalysisDb20Json, "utf8"), { level: 9 }); const secondTeamAnalysisDb20Gzip = gzipSync(Buffer.from(secondTeamAnalysisDb20Json, "utf8"), { level: 9 }); if (!teamAnalysisDb20Gzip.equals(secondTeamAnalysisDb20Gzip)) throw new Error("DB20 determinism check failed: gzip bytes differ"); const teamAnalysisDb20Coverage = buildDatabaseTeamAnalysisDb20Coverage(teamAnalysisDb20Dataset); const teamAnalysisDb20Goldens = await validateDatabaseTeamAnalysisDb20Goldens(teamAnalysisDb20Dataset, teamAnalysisDb20Coverage); if (teamAnalysisDb20Goldens.failures.length > 0) throw new Error(`DB20 golden fixture validation failed: ${JSON.stringify(teamAnalysisDb20Goldens.failures)}`); const teamAnalysisDb20Report = renderDatabaseTeamAnalysisDb20Report(teamAnalysisDb20Dataset, teamAnalysisDb20Coverage);
    const nativeLinkageEvidencePath = resolve(__dirname, "native-passive-turn-linkage-audit.json"); const nativeLinkageEvidenceBytes = await readFile(nativeLinkageEvidencePath); const nativeLinkageEvidence = JSON.parse(nativeLinkageEvidenceBytes.toString("utf8")) as Db21NativeLinkageEvidence; const nativeLinkageEvidenceSha256 = sha256(nativeLinkageEvidenceBytes);
    const buildTeamAnalysisDb21 = () => buildDatabaseTeamAnalysisDb21Dataset({ db20: teamAnalysisDb20Dataset, db20Coverage: teamAnalysisDb20Coverage, db20Sha256: sha256(teamAnalysisDb20Gzip), inspection: nativeInspection, nativePath: options.nativeRuntimePath, nativeSha256: nativeBefore.sha256, nativeSizeBytes: nativeBefore.sizeBytes, evidence: nativeLinkageEvidence, evidenceSha256: nativeLinkageEvidenceSha256 }); const teamAnalysisDb21Dataset = buildTeamAnalysisDb21(); const firstTeamAnalysisDb21Json = `${JSON.stringify(teamAnalysisDb21Dataset)}\n`; const secondTeamAnalysisDb21Json = `${JSON.stringify(buildTeamAnalysisDb21())}\n`; if (sha256(firstTeamAnalysisDb21Json) !== sha256(secondTeamAnalysisDb21Json)) throw new Error("DB21 determinism check failed: two native linkage audits differ"); const teamAnalysisDb21Gzip = gzipSync(Buffer.from(firstTeamAnalysisDb21Json, "utf8"), { level: 9 }); const secondTeamAnalysisDb21Gzip = gzipSync(Buffer.from(secondTeamAnalysisDb21Json, "utf8"), { level: 9 }); if (!teamAnalysisDb21Gzip.equals(secondTeamAnalysisDb21Gzip)) throw new Error("DB21 determinism check failed: gzip bytes differ"); const teamAnalysisDb21Coverage = buildDatabaseTeamAnalysisDb21Coverage(teamAnalysisDb21Dataset); const teamAnalysisDb21Goldens = await validateDatabaseTeamAnalysisDb21Goldens(teamAnalysisDb21Dataset, teamAnalysisDb21Coverage); if (teamAnalysisDb21Goldens.failures.length > 0) throw new Error(`DB21 golden fixture validation failed: ${JSON.stringify(teamAnalysisDb21Goldens.failures)}`); const teamAnalysisDb21Report = renderDatabaseTeamAnalysisDb21Report(teamAnalysisDb21Dataset, teamAnalysisDb21Coverage);
    const buildTeamAnalysisDb22 = () => buildDatabaseTeamAnalysisDb22Dataset({ db15: teamAnalysisDb15Dataset, db15Sha256: sha256(teamAnalysisDb15Gzip), db17: teamAnalysisDb17Dataset, db17Sha256: sha256(teamAnalysisDb17Gzip), db18: teamAnalysisDb18Dataset, db18Sha256: sha256(teamAnalysisDb18Gzip), db21: teamAnalysisDb21Dataset, db21Sha256: sha256(teamAnalysisDb21Gzip), current: currentTeamAnalysis.dataset, currentSha256: currentTeamAnalysis.sha256 }); const teamAnalysisDb22Dataset = buildTeamAnalysisDb22(); const firstTeamAnalysisDb22Json = `${JSON.stringify(teamAnalysisDb22Dataset)}\n`; const secondTeamAnalysisDb22Json = `${JSON.stringify(buildTeamAnalysisDb22())}\n`; if (sha256(firstTeamAnalysisDb22Json) !== sha256(secondTeamAnalysisDb22Json)) throw new Error("DB22 determinism check failed: two lifecycle AST projections differ"); const teamAnalysisDb22Gzip = gzipSync(Buffer.from(firstTeamAnalysisDb22Json, "utf8"), { level: 9 }); const secondTeamAnalysisDb22Gzip = gzipSync(Buffer.from(secondTeamAnalysisDb22Json, "utf8"), { level: 9 }); if (!teamAnalysisDb22Gzip.equals(secondTeamAnalysisDb22Gzip)) throw new Error("DB22 determinism check failed: gzip bytes differ"); const teamAnalysisDb22Coverage = buildDatabaseTeamAnalysisDb22Coverage(teamAnalysisDb22Dataset, teamAnalysisDb15Dataset, teamAnalysisDb18Dataset); const teamAnalysisDb22Goldens = await validateDatabaseTeamAnalysisDb22Goldens(teamAnalysisDb22Dataset, teamAnalysisDb22Coverage); if (teamAnalysisDb22Goldens.failures.length > 0) throw new Error(`DB22 golden fixture validation failed: ${JSON.stringify(teamAnalysisDb22Goldens.failures)}`); const teamAnalysisDb22Report = renderDatabaseTeamAnalysisDb22Report(teamAnalysisDb22Dataset, teamAnalysisDb22Coverage);
    const buildTeamAnalysisDb23 = () => buildDatabaseTeamAnalysisDb23Dataset({ db15: teamAnalysisDb15Dataset, db15Sha256: sha256(teamAnalysisDb15Gzip), db18: teamAnalysisDb18Dataset, db18Sha256: sha256(teamAnalysisDb18Gzip), db22: teamAnalysisDb22Dataset, db22Sha256: sha256(teamAnalysisDb22Gzip) }); const teamAnalysisDb23Dataset = buildTeamAnalysisDb23(); const firstTeamAnalysisDb23Json = `${JSON.stringify(teamAnalysisDb23Dataset)}\n`; const secondTeamAnalysisDb23Json = `${JSON.stringify(buildTeamAnalysisDb23())}\n`; if (sha256(firstTeamAnalysisDb23Json) !== sha256(secondTeamAnalysisDb23Json)) throw new Error("DB23 determinism check failed: two post-AST residual attributions differ"); const teamAnalysisDb23Gzip = gzipSync(Buffer.from(firstTeamAnalysisDb23Json, "utf8"), { level: 9 }); const secondTeamAnalysisDb23Gzip = gzipSync(Buffer.from(secondTeamAnalysisDb23Json, "utf8"), { level: 9 }); if (!teamAnalysisDb23Gzip.equals(secondTeamAnalysisDb23Gzip)) throw new Error("DB23 determinism check failed: gzip bytes differ"); const teamAnalysisDb23Coverage = buildDatabaseTeamAnalysisDb23Coverage(teamAnalysisDb23Dataset, teamAnalysisDb15Dataset.ruleConditionParity.length); const teamAnalysisDb23Goldens = await validateDatabaseTeamAnalysisDb23Goldens(teamAnalysisDb23Dataset, teamAnalysisDb23Coverage); if (teamAnalysisDb23Goldens.failures.length > 0) throw new Error(`DB23 golden fixture validation failed: ${JSON.stringify(teamAnalysisDb23Goldens.failures)}`); const teamAnalysisDb23Report = renderDatabaseTeamAnalysisDb23Report(teamAnalysisDb23Dataset, teamAnalysisDb23Coverage);
    const counterEvidencePath = resolve(__dirname, "native-counter-behavior-semantics.json"); const counterEvidenceBytes = await readFile(counterEvidencePath); const counterEvidence = JSON.parse(counterEvidenceBytes.toString("utf8")) as Db24NativeCounterEvidence; const counterEvidenceSha256 = sha256(counterEvidenceBytes);
    const buildTeamAnalysisDb24 = () => buildDatabaseTeamAnalysisDb24Dataset({ db8: teamAnalysisDb8Dataset, db8Sha256: sha256(teamAnalysisDb8Gzip), db9: teamAnalysisDb9Dataset, db9Sha256: sha256(teamAnalysisDb9Gzip), db11: teamAnalysisDb11Dataset, db11Sha256: sha256(teamAnalysisDb11Gzip), tables, inspection: nativeInspection, nativeSha256: nativeBefore.sha256, nativeSizeBytes: nativeBefore.sizeBytes, evidence: counterEvidence, evidenceSha256: counterEvidenceSha256 }); const teamAnalysisDb24Dataset = buildTeamAnalysisDb24(); const firstTeamAnalysisDb24Json = `${JSON.stringify(teamAnalysisDb24Dataset)}\n`; const secondTeamAnalysisDb24Json = `${JSON.stringify(buildTeamAnalysisDb24())}\n`; if (sha256(firstTeamAnalysisDb24Json) !== sha256(secondTeamAnalysisDb24Json)) throw new Error("DB24 determinism check failed: two counter behavior projections differ"); const teamAnalysisDb24Gzip = gzipSync(Buffer.from(firstTeamAnalysisDb24Json, "utf8"), { level: 9 }); const secondTeamAnalysisDb24Gzip = gzipSync(Buffer.from(secondTeamAnalysisDb24Json, "utf8"), { level: 9 }); if (!teamAnalysisDb24Gzip.equals(secondTeamAnalysisDb24Gzip)) throw new Error("DB24 determinism check failed: gzip bytes differ"); const teamAnalysisDb24SourceGapRuleCount = teamAnalysisDb8Dataset.efficacyGaps.find(value => Number(value.efficacyType) === 120)?.ruleCount ?? 0; const teamAnalysisDb24Coverage = buildDatabaseTeamAnalysisDb24Coverage(teamAnalysisDb24Dataset, teamAnalysisDb24SourceGapRuleCount); const teamAnalysisDb24Goldens = await validateDatabaseTeamAnalysisDb24Goldens(teamAnalysisDb24Dataset, teamAnalysisDb24Coverage); if (teamAnalysisDb24Goldens.failures.length > 0) throw new Error(`DB24 golden fixture validation failed: ${JSON.stringify(teamAnalysisDb24Goldens.failures)}`); const teamAnalysisDb24Report = renderDatabaseTeamAnalysisDb24Report(teamAnalysisDb24Dataset, teamAnalysisDb24Coverage);
    const attackContextEvidencePath = resolve(__dirname, "native-attack-context-semantics.json"); const attackContextEvidenceBytes = await readFile(attackContextEvidencePath); const attackContextEvidence = JSON.parse(attackContextEvidenceBytes.toString("utf8")) as Db25NativeAttackContextEvidence; const attackContextEvidenceSha256 = sha256(attackContextEvidenceBytes);
    const buildTeamAnalysisDb25 = () => buildDatabaseTeamAnalysisDb25Dataset({ db8: teamAnalysisDb8Dataset, db8Sha256: sha256(teamAnalysisDb8Gzip), db9: teamAnalysisDb9Dataset, db9Sha256: sha256(teamAnalysisDb9Gzip), db11: teamAnalysisDb11Dataset, db11Sha256: sha256(teamAnalysisDb11Gzip), tables, inspection: nativeInspection, nativeSha256: nativeBefore.sha256, nativeSizeBytes: nativeBefore.sizeBytes, evidence: attackContextEvidence, evidenceSha256: attackContextEvidenceSha256 }); const teamAnalysisDb25Dataset = buildTeamAnalysisDb25(); const firstTeamAnalysisDb25Json = `${JSON.stringify(teamAnalysisDb25Dataset)}\n`; const secondTeamAnalysisDb25Json = `${JSON.stringify(buildTeamAnalysisDb25())}\n`; if (sha256(firstTeamAnalysisDb25Json) !== sha256(secondTeamAnalysisDb25Json)) throw new Error("DB25 determinism check failed: two attack-context corrections differ"); const teamAnalysisDb25Gzip = gzipSync(Buffer.from(firstTeamAnalysisDb25Json, "utf8"), { level: 9 }); const secondTeamAnalysisDb25Gzip = gzipSync(Buffer.from(secondTeamAnalysisDb25Json, "utf8"), { level: 9 }); if (!teamAnalysisDb25Gzip.equals(secondTeamAnalysisDb25Gzip)) throw new Error("DB25 determinism check failed: gzip bytes differ"); const teamAnalysisDb25Coverage = buildDatabaseTeamAnalysisDb25Coverage(teamAnalysisDb25Dataset); const teamAnalysisDb25Goldens = await validateDatabaseTeamAnalysisDb25Goldens(teamAnalysisDb25Dataset, teamAnalysisDb25Coverage); if (teamAnalysisDb25Goldens.failures.length > 0) throw new Error(`DB25 golden fixture validation failed: ${JSON.stringify(teamAnalysisDb25Goldens.failures)}`); const teamAnalysisDb25Report = renderDatabaseTeamAnalysisDb25Report(teamAnalysisDb25Dataset, teamAnalysisDb25Coverage);
    const specialCategoryEvidencePath = resolve(__dirname, "native-special-category-semantics.json"); const specialCategoryEvidenceBytes = await readFile(specialCategoryEvidencePath); const specialCategoryEvidence = JSON.parse(specialCategoryEvidenceBytes.toString("utf8")) as Db26NativeSpecialCategoryEvidence; const specialCategoryEvidenceSha256 = sha256(specialCategoryEvidenceBytes);
    const buildTeamAnalysisDb26 = () => buildDatabaseTeamAnalysisDb26Dataset({ db8: teamAnalysisDb8Dataset, db8Sha256: sha256(teamAnalysisDb8Gzip), db9: teamAnalysisDb9Dataset, db9Sha256: sha256(teamAnalysisDb9Gzip), db11: teamAnalysisDb11Dataset, db11Sha256: sha256(teamAnalysisDb11Gzip), tables, inspection: nativeInspection, nativeSha256: nativeBefore.sha256, nativeSizeBytes: nativeBefore.sizeBytes, evidence: specialCategoryEvidence, evidenceSha256: specialCategoryEvidenceSha256 }); const teamAnalysisDb26Dataset = buildTeamAnalysisDb26(); const firstTeamAnalysisDb26Json = `${JSON.stringify(teamAnalysisDb26Dataset)}\n`; const secondTeamAnalysisDb26Json = `${JSON.stringify(buildTeamAnalysisDb26())}\n`; if (sha256(firstTeamAnalysisDb26Json) !== sha256(secondTeamAnalysisDb26Json)) throw new Error("DB26 determinism check failed: two special-category projections differ"); const teamAnalysisDb26Gzip = gzipSync(Buffer.from(firstTeamAnalysisDb26Json, "utf8"), { level: 9 }); const secondTeamAnalysisDb26Gzip = gzipSync(Buffer.from(secondTeamAnalysisDb26Json, "utf8"), { level: 9 }); if (!teamAnalysisDb26Gzip.equals(secondTeamAnalysisDb26Gzip)) throw new Error("DB26 determinism check failed: gzip bytes differ"); const teamAnalysisDb26SourceGapOccurrenceCount = teamAnalysisDb8Dataset.causalityGaps.find(value => Number(value.causalityType) === 49)?.occurrenceCount ?? 0; const teamAnalysisDb26Coverage = buildDatabaseTeamAnalysisDb26Coverage(teamAnalysisDb26Dataset, teamAnalysisDb26SourceGapOccurrenceCount); const teamAnalysisDb26Goldens = await validateDatabaseTeamAnalysisDb26Goldens(teamAnalysisDb26Dataset, teamAnalysisDb26Coverage); if (teamAnalysisDb26Goldens.failures.length > 0) throw new Error(`DB26 golden fixture validation failed: ${JSON.stringify(teamAnalysisDb26Goldens.failures)}`); const teamAnalysisDb26Report = renderDatabaseTeamAnalysisDb26Report(teamAnalysisDb26Dataset, teamAnalysisDb26Coverage);
    const targetHpEvidencePath = resolve(__dirname, "native-target-hp-semantics.json"); const targetHpEvidenceBytes = await readFile(targetHpEvidencePath); const targetHpEvidence = JSON.parse(targetHpEvidenceBytes.toString("utf8")) as Db27NativeTargetHpEvidence; const targetHpEvidenceSha256 = sha256(targetHpEvidenceBytes);
    const buildTeamAnalysisDb27 = () => buildDatabaseTeamAnalysisDb27Dataset({ db8: teamAnalysisDb8Dataset, db8Sha256: sha256(teamAnalysisDb8Gzip), db9: teamAnalysisDb9Dataset, db9Sha256: sha256(teamAnalysisDb9Gzip), db11: teamAnalysisDb11Dataset, db11Sha256: sha256(teamAnalysisDb11Gzip), tables, inspection: nativeInspection, nativeSha256: nativeBefore.sha256, nativeSizeBytes: nativeBefore.sizeBytes, evidence: targetHpEvidence, evidenceSha256: targetHpEvidenceSha256 }); const teamAnalysisDb27Dataset = buildTeamAnalysisDb27(); const firstTeamAnalysisDb27Json = `${JSON.stringify(teamAnalysisDb27Dataset)}\n`; const secondTeamAnalysisDb27Json = `${JSON.stringify(buildTeamAnalysisDb27())}\n`; if (sha256(firstTeamAnalysisDb27Json) !== sha256(secondTeamAnalysisDb27Json)) throw new Error("DB27 determinism check failed: two target-HP projections differ"); const teamAnalysisDb27Gzip = gzipSync(Buffer.from(firstTeamAnalysisDb27Json, "utf8"), { level: 9 }); const secondTeamAnalysisDb27Gzip = gzipSync(Buffer.from(secondTeamAnalysisDb27Json, "utf8"), { level: 9 }); if (!teamAnalysisDb27Gzip.equals(secondTeamAnalysisDb27Gzip)) throw new Error("DB27 determinism check failed: gzip bytes differ"); const teamAnalysisDb27SourceGapOccurrenceCount = teamAnalysisDb8Dataset.causalityGaps.filter(value => [17, 18, 33].includes(Number(value.causalityType))).reduce((sum, value) => sum + value.occurrenceCount, 0); const teamAnalysisDb27Coverage = buildDatabaseTeamAnalysisDb27Coverage(teamAnalysisDb27Dataset, teamAnalysisDb27SourceGapOccurrenceCount); const teamAnalysisDb27Goldens = await validateDatabaseTeamAnalysisDb27Goldens(teamAnalysisDb27Dataset, teamAnalysisDb27Coverage); if (teamAnalysisDb27Goldens.failures.length > 0) throw new Error(`DB27 golden fixture validation failed: ${JSON.stringify(teamAnalysisDb27Goldens.failures)}`); const teamAnalysisDb27Report = renderDatabaseTeamAnalysisDb27Report(teamAnalysisDb27Coverage);
    const revivalCounterEvidencePath = resolve(__dirname, "native-revival-counter-semantics.json"); const revivalCounterEvidenceBytes = await readFile(revivalCounterEvidencePath); const revivalCounterEvidence = JSON.parse(revivalCounterEvidenceBytes.toString("utf8")) as Db28NativeRevivalEvidence; const revivalCounterEvidenceSha256 = sha256(revivalCounterEvidenceBytes);
    const buildTeamAnalysisDb28 = () => buildDatabaseTeamAnalysisDb28Dataset({ db8: teamAnalysisDb8Dataset, db8Sha256: sha256(teamAnalysisDb8Gzip), db9: teamAnalysisDb9Dataset, db9Sha256: sha256(teamAnalysisDb9Gzip), db11: teamAnalysisDb11Dataset, db11Sha256: sha256(teamAnalysisDb11Gzip), tables, inspection: nativeInspection, nativeSha256: nativeBefore.sha256, nativeSizeBytes: nativeBefore.sizeBytes, evidence: revivalCounterEvidence, evidenceSha256: revivalCounterEvidenceSha256 }); const teamAnalysisDb28Dataset = buildTeamAnalysisDb28(); const firstTeamAnalysisDb28Json = `${JSON.stringify(teamAnalysisDb28Dataset)}\n`; const secondTeamAnalysisDb28Json = `${JSON.stringify(buildTeamAnalysisDb28())}\n`; if (sha256(firstTeamAnalysisDb28Json) !== sha256(secondTeamAnalysisDb28Json)) throw new Error("DB28 determinism check failed: two revival-counter projections differ"); const teamAnalysisDb28Gzip = gzipSync(Buffer.from(firstTeamAnalysisDb28Json, "utf8"), { level: 9 }); const secondTeamAnalysisDb28Gzip = gzipSync(Buffer.from(secondTeamAnalysisDb28Json, "utf8"), { level: 9 }); if (!teamAnalysisDb28Gzip.equals(secondTeamAnalysisDb28Gzip)) throw new Error("DB28 determinism check failed: gzip bytes differ"); const teamAnalysisDb28SourceGapOccurrenceCount = teamAnalysisDb8Dataset.causalityGaps.filter(value => [47, 54].includes(Number(value.causalityType))).reduce((sum, value) => sum + value.occurrenceCount, 0); const teamAnalysisDb28Coverage = buildDatabaseTeamAnalysisDb28Coverage(teamAnalysisDb28Dataset, teamAnalysisDb28SourceGapOccurrenceCount); const teamAnalysisDb28Goldens = await validateDatabaseTeamAnalysisDb28Goldens(teamAnalysisDb28Dataset, teamAnalysisDb28Coverage); if (teamAnalysisDb28Goldens.failures.length > 0) throw new Error(`DB28 golden fixture validation failed: ${JSON.stringify(teamAnalysisDb28Goldens.failures)}`); const teamAnalysisDb28Report = renderDatabaseTeamAnalysisDb28Report(teamAnalysisDb28Coverage);
    const attackBreakEvidencePath = resolve(__dirname, "native-attack-break-semantics.json"); const attackBreakEvidenceBytes = await readFile(attackBreakEvidencePath); const attackBreakEvidence = JSON.parse(attackBreakEvidenceBytes.toString("utf8")) as Db29NativeAttackBreakEvidence; const attackBreakEvidenceSha256 = sha256(attackBreakEvidenceBytes);
    const buildTeamAnalysisDb29 = () => buildDatabaseTeamAnalysisDb29Dataset({ db8: teamAnalysisDb8Dataset, db8Sha256: sha256(teamAnalysisDb8Gzip), db9: teamAnalysisDb9Dataset, db9Sha256: sha256(teamAnalysisDb9Gzip), db11: teamAnalysisDb11Dataset, db11Sha256: sha256(teamAnalysisDb11Gzip), tables, inspection: nativeInspection, nativeSha256: nativeBefore.sha256, nativeSizeBytes: nativeBefore.sizeBytes, evidence: attackBreakEvidence, evidenceSha256: attackBreakEvidenceSha256 }); const teamAnalysisDb29Dataset = buildTeamAnalysisDb29(); const firstTeamAnalysisDb29Json = `${JSON.stringify(teamAnalysisDb29Dataset)}\n`; const secondTeamAnalysisDb29Json = `${JSON.stringify(buildTeamAnalysisDb29())}\n`; if (sha256(firstTeamAnalysisDb29Json) !== sha256(secondTeamAnalysisDb29Json)) throw new Error("DB29 determinism check failed: two attack-break projections differ"); const teamAnalysisDb29Gzip = gzipSync(Buffer.from(firstTeamAnalysisDb29Json, "utf8"), { level: 9 }); const secondTeamAnalysisDb29Gzip = gzipSync(Buffer.from(secondTeamAnalysisDb29Json, "utf8"), { level: 9 }); if (!teamAnalysisDb29Gzip.equals(secondTeamAnalysisDb29Gzip)) throw new Error("DB29 determinism check failed: gzip bytes differ"); const teamAnalysisDb29SourceGapRuleCount = teamAnalysisDb8Dataset.efficacyGaps.find(value => Number(value.efficacyType) === 111)?.ruleCount ?? 0; const teamAnalysisDb29Coverage = buildDatabaseTeamAnalysisDb29Coverage(teamAnalysisDb29Dataset, teamAnalysisDb29SourceGapRuleCount); const teamAnalysisDb29Goldens = await validateDatabaseTeamAnalysisDb29Goldens(teamAnalysisDb29Dataset, teamAnalysisDb29Coverage); if (teamAnalysisDb29Goldens.failures.length > 0) throw new Error(`DB29 golden fixture validation failed: ${JSON.stringify(teamAnalysisDb29Goldens.failures)}`); const teamAnalysisDb29Report = renderDatabaseTeamAnalysisDb29Report(teamAnalysisDb29Dataset, teamAnalysisDb29Coverage);
    const removalEvidencePath = resolve(__dirname, "native-efficacy-removal-semantics.json"); const removalEvidenceBytes = await readFile(removalEvidencePath); const removalEvidence = JSON.parse(removalEvidenceBytes.toString("utf8")) as Db30NativeRemovalEvidence; const removalEvidenceSha256 = sha256(removalEvidenceBytes);
    const buildTeamAnalysisDb30 = () => buildDatabaseTeamAnalysisDb30Dataset({ db8: teamAnalysisDb8Dataset, db8Sha256: sha256(teamAnalysisDb8Gzip), db9: teamAnalysisDb9Dataset, db9Sha256: sha256(teamAnalysisDb9Gzip), db11: teamAnalysisDb11Dataset, db11Sha256: sha256(teamAnalysisDb11Gzip), tables, inspection: nativeInspection, nativeSha256: nativeBefore.sha256, nativeSizeBytes: nativeBefore.sizeBytes, evidence: removalEvidence, evidenceSha256: removalEvidenceSha256 }); const teamAnalysisDb30Dataset = buildTeamAnalysisDb30(); const firstTeamAnalysisDb30Json = `${JSON.stringify(teamAnalysisDb30Dataset)}\n`; const secondTeamAnalysisDb30Json = `${JSON.stringify(buildTeamAnalysisDb30())}\n`; if (sha256(firstTeamAnalysisDb30Json) !== sha256(secondTeamAnalysisDb30Json)) throw new Error("DB30 determinism check failed: two efficacy-removal projections differ"); const teamAnalysisDb30Gzip = gzipSync(Buffer.from(firstTeamAnalysisDb30Json, "utf8"), { level: 9 }); const secondTeamAnalysisDb30Gzip = gzipSync(Buffer.from(secondTeamAnalysisDb30Json, "utf8"), { level: 9 }); if (!teamAnalysisDb30Gzip.equals(secondTeamAnalysisDb30Gzip)) throw new Error("DB30 determinism check failed: gzip bytes differ"); const teamAnalysisDb30SourceGapRuleCount = teamAnalysisDb8Dataset.efficacyGaps.find(value => Number(value.efficacyType) === 110)?.ruleCount ?? 0; const teamAnalysisDb30Coverage = buildDatabaseTeamAnalysisDb30Coverage(teamAnalysisDb30Dataset, teamAnalysisDb30SourceGapRuleCount); const teamAnalysisDb30Goldens = await validateDatabaseTeamAnalysisDb30Goldens(teamAnalysisDb30Dataset, teamAnalysisDb30Coverage); if (teamAnalysisDb30Goldens.failures.length > 0) throw new Error(`DB30 golden fixture validation failed: ${JSON.stringify(teamAnalysisDb30Goldens.failures)}`); const teamAnalysisDb30Report = renderDatabaseTeamAnalysisDb30Report(teamAnalysisDb30Coverage);
    const calcOptionEvidencePath = resolve(__dirname, "native-skill-calc-option-semantics.json"); const calcOptionEvidenceBytes = await readFile(calcOptionEvidencePath); const calcOptionEvidence = JSON.parse(calcOptionEvidenceBytes.toString("utf8")) as Db31NativeEvidence; const calcOptionEvidenceSha256 = sha256(calcOptionEvidenceBytes);
    const buildTeamAnalysisDb31 = () => buildDatabaseTeamAnalysisDb31Dataset({ db11: teamAnalysisDb11Dataset, db11Sha256: sha256(teamAnalysisDb11Gzip), current: currentTeamAnalysis.dataset, currentSha256: currentTeamAnalysis.sha256, inspection: nativeInspection, nativeSha256: nativeBefore.sha256, nativeSizeBytes: nativeBefore.sizeBytes, evidence: calcOptionEvidence, evidenceSha256: calcOptionEvidenceSha256 }); const teamAnalysisDb31Dataset = buildTeamAnalysisDb31(); const firstTeamAnalysisDb31Json = `${JSON.stringify(teamAnalysisDb31Dataset)}\n`; const secondTeamAnalysisDb31Json = `${JSON.stringify(buildTeamAnalysisDb31())}\n`; if (sha256(firstTeamAnalysisDb31Json) !== sha256(secondTeamAnalysisDb31Json)) throw new Error("DB31 determinism check failed: two SkillCalcOption projections differ"); const teamAnalysisDb31Gzip = gzipSync(Buffer.from(firstTeamAnalysisDb31Json, "utf8"), { level: 9 }); const secondTeamAnalysisDb31Gzip = gzipSync(Buffer.from(secondTeamAnalysisDb31Json, "utf8"), { level: 9 }); if (!teamAnalysisDb31Gzip.equals(secondTeamAnalysisDb31Gzip)) throw new Error("DB31 determinism check failed: gzip bytes differ"); const teamAnalysisDb31Validation = validateDatabaseTeamAnalysisDb31Dataset(teamAnalysisDb31Dataset, teamAnalysisDb11Dataset); if (!teamAnalysisDb31Validation.valid) throw new Error(`DB31 payload validation failed: ${JSON.stringify(teamAnalysisDb31Validation.failures.slice(0, 10))}`); const teamAnalysisDb31Coverage = buildDatabaseTeamAnalysisDb31Coverage(teamAnalysisDb31Dataset); const teamAnalysisDb31Goldens = await validateDatabaseTeamAnalysisDb31Goldens(teamAnalysisDb31Dataset, teamAnalysisDb31Coverage); if (teamAnalysisDb31Goldens.failures.length > 0) throw new Error(`DB31 golden fixture validation failed: ${JSON.stringify(teamAnalysisDb31Goldens.failures)}`); const teamAnalysisDb31Report = renderDatabaseTeamAnalysisDb31Report(teamAnalysisDb31Coverage);
    const executionTimingEvidencePath = resolve(__dirname, "native-execution-timing-semantics.json"); const executionTimingEvidenceBytes = await readFile(executionTimingEvidencePath); const executionTimingEvidence = JSON.parse(executionTimingEvidenceBytes.toString("utf8")) as Db32NativeEvidence; const executionTimingEvidenceSha256 = sha256(executionTimingEvidenceBytes);
    const buildTeamAnalysisDb32 = () => buildDatabaseTeamAnalysisDb32Dataset({ db11: teamAnalysisDb11Dataset, db11Sha256: sha256(teamAnalysisDb11Gzip), db31: teamAnalysisDb31Dataset, db31Sha256: sha256(teamAnalysisDb31Gzip), current: currentTeamAnalysis.dataset, currentSha256: currentTeamAnalysis.sha256, inspection: nativeInspection, nativeSha256: nativeBefore.sha256, nativeSizeBytes: nativeBefore.sizeBytes, evidence: executionTimingEvidence, evidenceSha256: executionTimingEvidenceSha256 }); const teamAnalysisDb32Dataset = buildTeamAnalysisDb32(); const firstTeamAnalysisDb32Json = `${JSON.stringify(teamAnalysisDb32Dataset)}\n`; const secondTeamAnalysisDb32Json = `${JSON.stringify(buildTeamAnalysisDb32())}\n`; if (sha256(firstTeamAnalysisDb32Json) !== sha256(secondTeamAnalysisDb32Json)) throw new Error("DB32 determinism check failed: two execution-timing projections differ"); const teamAnalysisDb32Gzip = gzipSync(Buffer.from(firstTeamAnalysisDb32Json, "utf8"), { level: 9 }); const secondTeamAnalysisDb32Gzip = gzipSync(Buffer.from(secondTeamAnalysisDb32Json, "utf8"), { level: 9 }); if (!teamAnalysisDb32Gzip.equals(secondTeamAnalysisDb32Gzip)) throw new Error("DB32 determinism check failed: gzip bytes differ"); const teamAnalysisDb32Validation = validateDatabaseTeamAnalysisDb32Dataset(teamAnalysisDb32Dataset, teamAnalysisDb11Dataset, teamAnalysisDb31Dataset); if (!teamAnalysisDb32Validation.valid) throw new Error(`DB32 payload validation failed: ${JSON.stringify(teamAnalysisDb32Validation.failures.slice(0, 10))}`); const teamAnalysisDb32Coverage = buildDatabaseTeamAnalysisDb32Coverage(teamAnalysisDb32Dataset); const teamAnalysisDb32Goldens = await validateDatabaseTeamAnalysisDb32Goldens(teamAnalysisDb32Dataset, teamAnalysisDb32Coverage); if (teamAnalysisDb32Goldens.failures.length > 0) throw new Error(`DB32 golden fixture validation failed: ${JSON.stringify(teamAnalysisDb32Goldens.failures)}`); const teamAnalysisDb32Report = renderDatabaseTeamAnalysisDb32Report(teamAnalysisDb32Coverage);
    const attackSetupTimingEvidencePath = resolve(__dirname, "native-execution-timing-value-4-semantics.json"); const attackSetupTimingEvidenceBytes = await readFile(attackSetupTimingEvidencePath); const attackSetupTimingEvidence = JSON.parse(attackSetupTimingEvidenceBytes.toString("utf8")) as Db33NativeEvidence; const attackSetupTimingEvidenceSha256 = sha256(attackSetupTimingEvidenceBytes);
    const buildTeamAnalysisDb33 = () => buildDatabaseTeamAnalysisDb33Dataset({ db32: teamAnalysisDb32Dataset, db32Sha256: sha256(teamAnalysisDb32Gzip), sourceDatabaseSha256: before.sha256, current: currentTeamAnalysis.dataset, currentSha256: currentTeamAnalysis.sha256, inspection: nativeInspection, nativeSha256: nativeBefore.sha256, nativeSizeBytes: nativeBefore.sizeBytes, evidence: attackSetupTimingEvidence, evidenceSha256: attackSetupTimingEvidenceSha256 }); const teamAnalysisDb33Dataset = buildTeamAnalysisDb33(); const firstTeamAnalysisDb33Json = `${JSON.stringify(teamAnalysisDb33Dataset)}\n`; const secondTeamAnalysisDb33Json = `${JSON.stringify(buildTeamAnalysisDb33())}\n`; if (sha256(firstTeamAnalysisDb33Json) !== sha256(secondTeamAnalysisDb33Json)) throw new Error("DB33 determinism check failed: two player-attack-setup timing projections differ"); const teamAnalysisDb33Gzip = gzipSync(Buffer.from(firstTeamAnalysisDb33Json, "utf8"), { level: 9 }); const secondTeamAnalysisDb33Gzip = gzipSync(Buffer.from(secondTeamAnalysisDb33Json, "utf8"), { level: 9 }); if (!teamAnalysisDb33Gzip.equals(secondTeamAnalysisDb33Gzip)) throw new Error("DB33 determinism check failed: gzip bytes differ"); const teamAnalysisDb33Validation = validateDatabaseTeamAnalysisDb33Dataset(teamAnalysisDb33Dataset, teamAnalysisDb32Dataset); if (!teamAnalysisDb33Validation.valid) throw new Error(`DB33 payload validation failed: ${JSON.stringify(teamAnalysisDb33Validation.failures.slice(0, 10))}`); const teamAnalysisDb33Coverage = buildDatabaseTeamAnalysisDb33Coverage(teamAnalysisDb33Dataset); const teamAnalysisDb33Goldens = await validateDatabaseTeamAnalysisDb33Goldens(teamAnalysisDb33Dataset, teamAnalysisDb33Coverage); if (teamAnalysisDb33Goldens.failures.length > 0) throw new Error(`DB33 golden fixture validation failed: ${JSON.stringify(teamAnalysisDb33Goldens.failures)}`); const teamAnalysisDb33Report = renderDatabaseTeamAnalysisDb33Report(teamAnalysisDb33Coverage);
    const basicStatBucketEvidencePath = resolve(__dirname, "native-basic-stat-bucket-semantics.json"); const basicStatBucketEvidenceBytes = await readFile(basicStatBucketEvidencePath); const basicStatBucketEvidence = JSON.parse(basicStatBucketEvidenceBytes.toString("utf8")) as Db34NativeEvidence; const basicStatBucketEvidenceSha256 = sha256(basicStatBucketEvidenceBytes);
    const buildTeamAnalysisDb34 = () => buildDatabaseTeamAnalysisDb34Dataset({ db11: teamAnalysisDb11Dataset, db11Sha256: sha256(teamAnalysisDb11Gzip), db13: teamAnalysisDb13Dataset, db13Sha256: sha256(teamAnalysisDb13Gzip), db31: teamAnalysisDb31Dataset, db31Sha256: sha256(teamAnalysisDb31Gzip), db33: teamAnalysisDb33Dataset, db33Sha256: sha256(teamAnalysisDb33Gzip), tables, current: currentTeamAnalysis.dataset, currentSha256: currentTeamAnalysis.sha256, inspection: nativeInspection, nativeSha256: nativeBefore.sha256, nativeSizeBytes: nativeBefore.sizeBytes, evidence: basicStatBucketEvidence, evidenceSha256: basicStatBucketEvidenceSha256 }); const teamAnalysisDb34Dataset = buildTeamAnalysisDb34(); const firstTeamAnalysisDb34Json = `${JSON.stringify(teamAnalysisDb34Dataset)}\n`; const secondTeamAnalysisDb34Json = `${JSON.stringify(buildTeamAnalysisDb34())}\n`; if (sha256(firstTeamAnalysisDb34Json) !== sha256(secondTeamAnalysisDb34Json)) throw new Error("DB34 determinism check failed: two basic-stat bucket projections differ"); const teamAnalysisDb34Gzip = gzipSync(Buffer.from(firstTeamAnalysisDb34Json, "utf8"), { level: 9 }); const secondTeamAnalysisDb34Gzip = gzipSync(Buffer.from(secondTeamAnalysisDb34Json, "utf8"), { level: 9 }); if (!teamAnalysisDb34Gzip.equals(secondTeamAnalysisDb34Gzip)) throw new Error("DB34 determinism check failed: gzip bytes differ"); const teamAnalysisDb34Validation = validateDatabaseTeamAnalysisDb34Dataset(teamAnalysisDb34Dataset, teamAnalysisDb11Dataset, teamAnalysisDb31Dataset, teamAnalysisDb33Dataset, tables); if (!teamAnalysisDb34Validation.valid) throw new Error(`DB34 payload validation failed: ${JSON.stringify(teamAnalysisDb34Validation.failures.slice(0, 10))}`); const teamAnalysisDb34Coverage = buildDatabaseTeamAnalysisDb34Coverage(teamAnalysisDb34Dataset); const teamAnalysisDb34Goldens = await validateDatabaseTeamAnalysisDb34Goldens(teamAnalysisDb34Dataset, teamAnalysisDb34Coverage); if (teamAnalysisDb34Goldens.failures.length > 0) throw new Error(`DB34 golden fixture validation failed: ${JSON.stringify(teamAnalysisDb34Goldens.failures)}`); const teamAnalysisDb34Report = renderDatabaseTeamAnalysisDb34Report(teamAnalysisDb34Dataset, teamAnalysisDb34Coverage);
    const passiveTargetEvidencePath = resolve(__dirname, "native-passive-target-dispatch-semantics.json"); const passiveTargetEvidenceBytes = await readFile(passiveTargetEvidencePath); const passiveTargetEvidence = JSON.parse(passiveTargetEvidenceBytes.toString("utf8")) as Db35NativeEvidence; const passiveTargetEvidenceSha256 = sha256(passiveTargetEvidenceBytes);
    const buildTeamAnalysisDb35 = () => buildDatabaseTeamAnalysisDb35Dataset({ db11: teamAnalysisDb11Dataset, db11Sha256: sha256(teamAnalysisDb11Gzip), db33: teamAnalysisDb33Dataset, db33Sha256: sha256(teamAnalysisDb33Gzip), tables, current: currentTeamAnalysis.dataset, currentSha256: currentTeamAnalysis.sha256, inspection: nativeInspection, nativeSha256: nativeBefore.sha256, nativeSizeBytes: nativeBefore.sizeBytes, evidence: passiveTargetEvidence, evidenceSha256: passiveTargetEvidenceSha256 }); const teamAnalysisDb35Dataset = buildTeamAnalysisDb35(); const firstTeamAnalysisDb35Json = `${JSON.stringify(teamAnalysisDb35Dataset)}\n`; const secondTeamAnalysisDb35Json = `${JSON.stringify(buildTeamAnalysisDb35())}\n`; if (sha256(firstTeamAnalysisDb35Json) !== sha256(secondTeamAnalysisDb35Json)) throw new Error("DB35 determinism check failed: two target projections differ"); const teamAnalysisDb35Gzip = gzipSync(Buffer.from(firstTeamAnalysisDb35Json, "utf8"), { level: 9 }); const secondTeamAnalysisDb35Gzip = gzipSync(Buffer.from(secondTeamAnalysisDb35Json, "utf8"), { level: 9 }); if (!teamAnalysisDb35Gzip.equals(secondTeamAnalysisDb35Gzip)) throw new Error("DB35 determinism check failed: gzip bytes differ"); const teamAnalysisDb35Validation = validateDatabaseTeamAnalysisDb35Dataset(teamAnalysisDb35Dataset, teamAnalysisDb11Dataset, tables, { db11Sha256: sha256(teamAnalysisDb11Gzip), db33: teamAnalysisDb33Dataset, db33Sha256: sha256(teamAnalysisDb33Gzip), current: currentTeamAnalysis.dataset, currentSha256: currentTeamAnalysis.sha256, nativeSha256: nativeBefore.sha256, nativeSizeBytes: nativeBefore.sizeBytes, evidence: passiveTargetEvidence, evidenceSha256: passiveTargetEvidenceSha256 }); if (!teamAnalysisDb35Validation.valid) throw new Error(`DB35 payload validation failed: ${JSON.stringify(teamAnalysisDb35Validation.failures.slice(0, 10))}`); const teamAnalysisDb35Coverage = buildDatabaseTeamAnalysisDb35Coverage(teamAnalysisDb35Dataset); const teamAnalysisDb35Goldens = await validateDatabaseTeamAnalysisDb35Goldens(teamAnalysisDb35Dataset, teamAnalysisDb35Coverage); if (teamAnalysisDb35Goldens.failures.length > 0) throw new Error(`DB35 golden fixture validation failed: ${JSON.stringify(teamAnalysisDb35Goldens.failures)}`); const teamAnalysisDb35Report = renderDatabaseTeamAnalysisDb35Report(teamAnalysisDb35Dataset, teamAnalysisDb35Coverage);
    const subTargetEvidencePath = resolve(__dirname, "native-sub-target-type-semantics.json"); const subTargetEvidenceBytes = await readFile(subTargetEvidencePath); const subTargetEvidence = JSON.parse(subTargetEvidenceBytes.toString("utf8")) as Db36NativeEvidence; const subTargetEvidenceSha256 = sha256(subTargetEvidenceBytes);
    const buildTeamAnalysisDb36 = () => buildDatabaseTeamAnalysisDb36Dataset({ db35: teamAnalysisDb35Dataset, db35Sha256: sha256(teamAnalysisDb35Gzip), tables, inspection: nativeInspection, nativeSha256: nativeBefore.sha256, nativeSizeBytes: nativeBefore.sizeBytes, evidence: subTargetEvidence, evidenceSha256: subTargetEvidenceSha256 }); const teamAnalysisDb36Dataset = buildTeamAnalysisDb36(); const firstTeamAnalysisDb36Json = `${JSON.stringify(teamAnalysisDb36Dataset)}\n`; const secondTeamAnalysisDb36Json = `${JSON.stringify(buildTeamAnalysisDb36())}\n`; if (sha256(firstTeamAnalysisDb36Json) !== sha256(secondTeamAnalysisDb36Json)) throw new Error("DB36 determinism check failed: two sub-target projections differ"); const teamAnalysisDb36Gzip = gzipSync(Buffer.from(firstTeamAnalysisDb36Json, "utf8"), { level: 9 }); const secondTeamAnalysisDb36Gzip = gzipSync(Buffer.from(secondTeamAnalysisDb36Json, "utf8"), { level: 9 }); if (!teamAnalysisDb36Gzip.equals(secondTeamAnalysisDb36Gzip)) throw new Error("DB36 determinism check failed: gzip bytes differ"); const teamAnalysisDb36Validation = validateDatabaseTeamAnalysisDb36Dataset(teamAnalysisDb36Dataset, teamAnalysisDb35Dataset, tables, { db35Sha256: sha256(teamAnalysisDb35Gzip), nativeSha256: nativeBefore.sha256, nativeSizeBytes: nativeBefore.sizeBytes, evidence: subTargetEvidence, evidenceSha256: subTargetEvidenceSha256 }); if (!teamAnalysisDb36Validation.valid) throw new Error(`DB36 payload validation failed: ${JSON.stringify(teamAnalysisDb36Validation.failures.slice(0, 10))}`); const teamAnalysisDb36Coverage = buildDatabaseTeamAnalysisDb36Coverage(teamAnalysisDb36Dataset); const teamAnalysisDb36Goldens = await validateDatabaseTeamAnalysisDb36Goldens(teamAnalysisDb36Dataset, teamAnalysisDb36Coverage); if (teamAnalysisDb36Goldens.failures.length > 0) throw new Error(`DB36 golden fixture validation failed: ${JSON.stringify(teamAnalysisDb36Goldens.failures)}`); const teamAnalysisDb36Report = renderDatabaseTeamAnalysisDb36Report(teamAnalysisDb36Coverage);
    const passiveLifecycleEvidencePath = resolve(__dirname, "native-passive-lifecycle-semantics.json"); const passiveLifecycleEvidenceBytes = await readFile(passiveLifecycleEvidencePath); const passiveLifecycleEvidence = JSON.parse(passiveLifecycleEvidenceBytes.toString("utf8")) as Db37NativeEvidence; const passiveLifecycleEvidenceSha256 = sha256(passiveLifecycleEvidenceBytes);
    const buildTeamAnalysisDb37 = () => buildDatabaseTeamAnalysisDb37Dataset({ db36: teamAnalysisDb36Dataset, db36Sha256: sha256(teamAnalysisDb36Gzip), db20: teamAnalysisDb20Dataset, db20Sha256: sha256(teamAnalysisDb20Gzip), tables, inspection: nativeInspection, nativeSha256: nativeBefore.sha256, nativeSizeBytes: nativeBefore.sizeBytes, evidence: passiveLifecycleEvidence, evidenceSha256: passiveLifecycleEvidenceSha256 }); const teamAnalysisDb37Dataset = buildTeamAnalysisDb37(); const firstTeamAnalysisDb37Json = `${JSON.stringify(teamAnalysisDb37Dataset)}\n`; const secondTeamAnalysisDb37Json = `${JSON.stringify(buildTeamAnalysisDb37())}\n`; if (sha256(firstTeamAnalysisDb37Json) !== sha256(secondTeamAnalysisDb37Json)) throw new Error("DB37 determinism check failed: two passive lifecycle projections differ"); const teamAnalysisDb37Gzip = gzipSync(Buffer.from(firstTeamAnalysisDb37Json, "utf8"), { level: 9 }); const secondTeamAnalysisDb37Gzip = gzipSync(Buffer.from(secondTeamAnalysisDb37Json, "utf8"), { level: 9 }); if (!teamAnalysisDb37Gzip.equals(secondTeamAnalysisDb37Gzip)) throw new Error("DB37 determinism check failed: gzip bytes differ"); const teamAnalysisDb37Validation = validateDatabaseTeamAnalysisDb37Dataset(teamAnalysisDb37Dataset, teamAnalysisDb36Dataset, teamAnalysisDb20Dataset, tables, { db36Sha256: sha256(teamAnalysisDb36Gzip), db20Sha256: sha256(teamAnalysisDb20Gzip), nativeSha256: nativeBefore.sha256, nativeSizeBytes: nativeBefore.sizeBytes, evidence: passiveLifecycleEvidence, evidenceSha256: passiveLifecycleEvidenceSha256 }); if (!teamAnalysisDb37Validation.valid) throw new Error(`DB37 payload validation failed: ${JSON.stringify(teamAnalysisDb37Validation.failures.slice(0, 10))}`); const teamAnalysisDb37Coverage = buildDatabaseTeamAnalysisDb37Coverage(teamAnalysisDb37Dataset); const teamAnalysisDb37Goldens = await validateDatabaseTeamAnalysisDb37Goldens(teamAnalysisDb37Dataset, teamAnalysisDb37Coverage); if (teamAnalysisDb37Goldens.failures.length > 0) throw new Error(`DB37 golden fixture validation failed: ${JSON.stringify(teamAnalysisDb37Goldens.failures)}`); const teamAnalysisDb37Report = renderDatabaseTeamAnalysisDb37Report(teamAnalysisDb37Coverage);
    const incrementalStatusEvidencePath = resolve(__dirname, "native-incremental-status-semantics.json"); const incrementalStatusEvidenceBytes = await readFile(incrementalStatusEvidencePath); const incrementalStatusEvidence = JSON.parse(incrementalStatusEvidenceBytes.toString("utf8")) as Db38NativeEvidence; const incrementalStatusEvidenceSha256 = sha256(incrementalStatusEvidenceBytes);
    const buildTeamAnalysisDb38 = () => buildDatabaseTeamAnalysisDb38Dataset({ db37: teamAnalysisDb37Dataset, db37Sha256: sha256(teamAnalysisDb37Gzip), db11: teamAnalysisDb11Dataset, db11Sha256: sha256(teamAnalysisDb11Gzip), tables, inspection: nativeInspection, nativeSha256: nativeBefore.sha256, nativeSizeBytes: nativeBefore.sizeBytes, evidence: incrementalStatusEvidence, evidenceSha256: incrementalStatusEvidenceSha256 }); const teamAnalysisDb38Dataset = buildTeamAnalysisDb38(); const firstTeamAnalysisDb38Json = `${JSON.stringify(teamAnalysisDb38Dataset)}\n`; const secondTeamAnalysisDb38Json = `${JSON.stringify(buildTeamAnalysisDb38())}\n`; if (sha256(firstTeamAnalysisDb38Json) !== sha256(secondTeamAnalysisDb38Json)) throw new Error("DB38 determinism check failed: two incremental-status projections differ"); const teamAnalysisDb38Gzip = gzipSync(Buffer.from(firstTeamAnalysisDb38Json, "utf8"), { level: 9 }); const secondTeamAnalysisDb38Gzip = gzipSync(Buffer.from(secondTeamAnalysisDb38Json, "utf8"), { level: 9 }); if (!teamAnalysisDb38Gzip.equals(secondTeamAnalysisDb38Gzip)) throw new Error("DB38 determinism check failed: gzip bytes differ"); const teamAnalysisDb38Validation = validateDatabaseTeamAnalysisDb38Dataset(teamAnalysisDb38Dataset, teamAnalysisDb37Dataset, teamAnalysisDb11Dataset, tables, { db37Sha256: sha256(teamAnalysisDb37Gzip), db11Sha256: sha256(teamAnalysisDb11Gzip), nativeSha256: nativeBefore.sha256, nativeSizeBytes: nativeBefore.sizeBytes, evidence: incrementalStatusEvidence, evidenceSha256: incrementalStatusEvidenceSha256 }); if (!teamAnalysisDb38Validation.valid) throw new Error(`DB38 payload validation failed: ${JSON.stringify(teamAnalysisDb38Validation.failures.slice(0, 10))}`); const teamAnalysisDb38Coverage = buildDatabaseTeamAnalysisDb38Coverage(teamAnalysisDb38Dataset); const teamAnalysisDb38Goldens = await validateDatabaseTeamAnalysisDb38Goldens(teamAnalysisDb38Dataset, teamAnalysisDb38Coverage); if (teamAnalysisDb38Goldens.failures.length > 0) throw new Error(`DB38 golden fixture validation failed: ${JSON.stringify(teamAnalysisDb38Goldens.failures)}`); const teamAnalysisDb38Report = renderDatabaseTeamAnalysisDb38Report(teamAnalysisDb38Dataset, teamAnalysisDb38Coverage);
    const proportionalStatEvidencePath = resolve(__dirname, "native-energy-ball-proportional-stat-semantics.json"); const proportionalStatEvidenceBytes = await readFile(proportionalStatEvidencePath); const proportionalStatEvidence = JSON.parse(proportionalStatEvidenceBytes.toString("utf8")) as Db39NativeEvidence; const proportionalStatEvidenceSha256 = sha256(proportionalStatEvidenceBytes);
    const buildTeamAnalysisDb39 = () => buildDatabaseTeamAnalysisDb39Dataset({ db11: teamAnalysisDb11Dataset, db11Sha256: sha256(teamAnalysisDb11Gzip), db31: teamAnalysisDb31Dataset, db31Sha256: sha256(teamAnalysisDb31Gzip), db34: teamAnalysisDb34Dataset, db34Sha256: sha256(teamAnalysisDb34Gzip), db37: teamAnalysisDb37Dataset, db37Sha256: sha256(teamAnalysisDb37Gzip), tables, inspection: nativeInspection, nativeSha256: nativeBefore.sha256, nativeSizeBytes: nativeBefore.sizeBytes, evidence: proportionalStatEvidence, evidenceSha256: proportionalStatEvidenceSha256 }); const teamAnalysisDb39Dataset = buildTeamAnalysisDb39(); const firstTeamAnalysisDb39Json = `${JSON.stringify(teamAnalysisDb39Dataset)}\n`; const secondTeamAnalysisDb39Json = `${JSON.stringify(buildTeamAnalysisDb39())}\n`; if (sha256(firstTeamAnalysisDb39Json) !== sha256(secondTeamAnalysisDb39Json)) throw new Error("DB39 determinism check failed: two proportional-stat projections differ"); const teamAnalysisDb39Gzip = gzipSync(Buffer.from(firstTeamAnalysisDb39Json, "utf8"), { level: 9 }); const secondTeamAnalysisDb39Gzip = gzipSync(Buffer.from(secondTeamAnalysisDb39Json, "utf8"), { level: 9 }); if (!teamAnalysisDb39Gzip.equals(secondTeamAnalysisDb39Gzip)) throw new Error("DB39 determinism check failed: gzip bytes differ"); const teamAnalysisDb39Validation = validateDatabaseTeamAnalysisDb39Dataset(teamAnalysisDb39Dataset, teamAnalysisDb11Dataset, teamAnalysisDb31Dataset, teamAnalysisDb37Dataset, tables, { db11Sha256: sha256(teamAnalysisDb11Gzip), db31Sha256: sha256(teamAnalysisDb31Gzip), db34Sha256: sha256(teamAnalysisDb34Gzip), db37Sha256: sha256(teamAnalysisDb37Gzip), nativeSha256: nativeBefore.sha256, nativeSizeBytes: nativeBefore.sizeBytes, evidence: proportionalStatEvidence, evidenceSha256: proportionalStatEvidenceSha256 }); if (!teamAnalysisDb39Validation.valid) throw new Error(`DB39 payload validation failed: ${JSON.stringify(teamAnalysisDb39Validation.failures.slice(0, 10))}`); const teamAnalysisDb39Coverage = buildDatabaseTeamAnalysisDb39Coverage(teamAnalysisDb39Dataset); const teamAnalysisDb39Goldens = await validateDatabaseTeamAnalysisDb39Goldens(teamAnalysisDb39Dataset, teamAnalysisDb39Coverage); if (teamAnalysisDb39Goldens.failures.length > 0) throw new Error(`DB39 golden fixture validation failed: ${JSON.stringify(teamAnalysisDb39Goldens.failures)}`); const teamAnalysisDb39Report = renderDatabaseTeamAnalysisDb39Report(teamAnalysisDb39Dataset, teamAnalysisDb39Coverage);
    const battleGaugeThresholdEvidencePath = resolve(__dirname, "native-battle-gauge-threshold-semantics.json"); const battleGaugeThresholdEvidenceBytes = await readFile(battleGaugeThresholdEvidencePath); const battleGaugeThresholdEvidence = JSON.parse(battleGaugeThresholdEvidenceBytes.toString("utf8")) as Db40NativeEvidence; const battleGaugeThresholdEvidenceSha256 = sha256(battleGaugeThresholdEvidenceBytes);
    const buildTeamAnalysisDb40 = () => buildDatabaseTeamAnalysisDb40Dataset({ db8: teamAnalysisDb8Dataset, db8Sha256: sha256(teamAnalysisDb8Gzip), db9: teamAnalysisDb9Dataset, db9Sha256: sha256(teamAnalysisDb9Gzip), db10: teamAnalysisDb10Dataset, db10Sha256: sha256(teamAnalysisDb10Gzip), db11: teamAnalysisDb11Dataset, db11Sha256: sha256(teamAnalysisDb11Gzip), tables, inspection: nativeInspection, nativeSha256: nativeBefore.sha256, nativeSizeBytes: nativeBefore.sizeBytes, evidence: battleGaugeThresholdEvidence, evidenceSha256: battleGaugeThresholdEvidenceSha256 }); const teamAnalysisDb40Dataset = buildTeamAnalysisDb40(); const firstTeamAnalysisDb40Json = `${JSON.stringify(teamAnalysisDb40Dataset)}\n`; const secondTeamAnalysisDb40Json = `${JSON.stringify(buildTeamAnalysisDb40())}\n`; if (sha256(firstTeamAnalysisDb40Json) !== sha256(secondTeamAnalysisDb40Json)) throw new Error("DB40 determinism check failed: two battle-gauge threshold projections differ"); const teamAnalysisDb40Gzip = gzipSync(Buffer.from(firstTeamAnalysisDb40Json, "utf8"), { level: 9 }); const secondTeamAnalysisDb40Gzip = gzipSync(Buffer.from(secondTeamAnalysisDb40Json, "utf8"), { level: 9 }); if (!teamAnalysisDb40Gzip.equals(secondTeamAnalysisDb40Gzip)) throw new Error("DB40 determinism check failed: gzip bytes differ"); const teamAnalysisDb40Validation = validateDatabaseTeamAnalysisDb40Dataset(teamAnalysisDb40Dataset, teamAnalysisDb11Dataset, tables, { db8Sha256: sha256(teamAnalysisDb8Gzip), db9Sha256: sha256(teamAnalysisDb9Gzip), db10Sha256: sha256(teamAnalysisDb10Gzip), db11Sha256: sha256(teamAnalysisDb11Gzip), nativeSha256: nativeBefore.sha256, nativeSizeBytes: nativeBefore.sizeBytes, evidence: battleGaugeThresholdEvidence, evidenceSha256: battleGaugeThresholdEvidenceSha256 }); if (!teamAnalysisDb40Validation.valid) throw new Error(`DB40 payload validation failed: ${JSON.stringify(teamAnalysisDb40Validation.failures.slice(0, 10))}`); const teamAnalysisDb40Coverage = buildDatabaseTeamAnalysisDb40Coverage(teamAnalysisDb40Dataset); const teamAnalysisDb40Goldens = await validateDatabaseTeamAnalysisDb40Goldens(teamAnalysisDb40Dataset, teamAnalysisDb40Coverage); if (teamAnalysisDb40Goldens.failures.length > 0) throw new Error(`DB40 golden fixture validation failed: ${JSON.stringify(teamAnalysisDb40Goldens.failures)}`); const teamAnalysisDb40Report = renderDatabaseTeamAnalysisDb40Report(teamAnalysisDb40Dataset, teamAnalysisDb40Coverage);
    const enemyCategoryCountEvidencePath = resolve(__dirname, "native-enemy-category-count-threshold-semantics.json"); const enemyCategoryCountEvidenceBytes = await readFile(enemyCategoryCountEvidencePath); const enemyCategoryCountEvidence = JSON.parse(enemyCategoryCountEvidenceBytes.toString("utf8")) as Db41NativeEvidence; const enemyCategoryCountEvidenceSha256 = sha256(enemyCategoryCountEvidenceBytes);
    const buildTeamAnalysisDb41 = () => buildDatabaseTeamAnalysisDb41Dataset({ db8: teamAnalysisDb8Dataset, db8Sha256: sha256(teamAnalysisDb8Gzip), db9: teamAnalysisDb9Dataset, db9Sha256: sha256(teamAnalysisDb9Gzip), db10: teamAnalysisDb10Dataset, db10Sha256: sha256(teamAnalysisDb10Gzip), db11: teamAnalysisDb11Dataset, db11Sha256: sha256(teamAnalysisDb11Gzip), tables, inspection: nativeInspection, nativeSha256: nativeBefore.sha256, nativeSizeBytes: nativeBefore.sizeBytes, evidence: enemyCategoryCountEvidence, evidenceSha256: enemyCategoryCountEvidenceSha256 }); const teamAnalysisDb41Dataset = buildTeamAnalysisDb41(); const firstTeamAnalysisDb41Json = `${JSON.stringify(teamAnalysisDb41Dataset)}\n`; const secondTeamAnalysisDb41Json = `${JSON.stringify(buildTeamAnalysisDb41())}\n`; if (sha256(firstTeamAnalysisDb41Json) !== sha256(secondTeamAnalysisDb41Json)) throw new Error("DB41 determinism check failed: two enemy-category count projections differ"); const teamAnalysisDb41Gzip = gzipSync(Buffer.from(firstTeamAnalysisDb41Json, "utf8"), { level: 9 }); const secondTeamAnalysisDb41Gzip = gzipSync(Buffer.from(secondTeamAnalysisDb41Json, "utf8"), { level: 9 }); if (!teamAnalysisDb41Gzip.equals(secondTeamAnalysisDb41Gzip)) throw new Error("DB41 determinism check failed: gzip bytes differ"); const teamAnalysisDb41Validation = validateDatabaseTeamAnalysisDb41Dataset(teamAnalysisDb41Dataset, teamAnalysisDb11Dataset, tables, { db8Sha256: sha256(teamAnalysisDb8Gzip), db9Sha256: sha256(teamAnalysisDb9Gzip), db10Sha256: sha256(teamAnalysisDb10Gzip), db11Sha256: sha256(teamAnalysisDb11Gzip), nativeSha256: nativeBefore.sha256, nativeSizeBytes: nativeBefore.sizeBytes, evidence: enemyCategoryCountEvidence, evidenceSha256: enemyCategoryCountEvidenceSha256 }); if (!teamAnalysisDb41Validation.valid) throw new Error(`DB41 payload validation failed: ${JSON.stringify(teamAnalysisDb41Validation.failures.slice(0, 10))}`); const teamAnalysisDb41Coverage = buildDatabaseTeamAnalysisDb41Coverage(teamAnalysisDb41Dataset); const teamAnalysisDb41Goldens = await validateDatabaseTeamAnalysisDb41Goldens(teamAnalysisDb41Dataset, teamAnalysisDb41Coverage); if (teamAnalysisDb41Goldens.failures.length > 0) throw new Error(`DB41 golden fixture validation failed: ${JSON.stringify(teamAnalysisDb41Goldens.failures)}`); const teamAnalysisDb41Report = renderDatabaseTeamAnalysisDb41Report(teamAnalysisDb41Dataset, teamAnalysisDb41Coverage);
    const allTeamMemberEvidencePath = resolve(__dirname, "native-all-team-member-condition-semantics.json"); const allTeamMemberEvidenceBytes = await readFile(allTeamMemberEvidencePath); const allTeamMemberEvidence = JSON.parse(allTeamMemberEvidenceBytes.toString("utf8")) as Db42NativeEvidence; const allTeamMemberEvidenceSha256 = sha256(allTeamMemberEvidenceBytes);
    const buildTeamAnalysisDb42 = () => buildDatabaseTeamAnalysisDb42Dataset({ db8: teamAnalysisDb8Dataset, db8Sha256: sha256(teamAnalysisDb8Gzip), db9: teamAnalysisDb9Dataset, db9Sha256: sha256(teamAnalysisDb9Gzip), db10: teamAnalysisDb10Dataset, db10Sha256: sha256(teamAnalysisDb10Gzip), db11: teamAnalysisDb11Dataset, db11Sha256: sha256(teamAnalysisDb11Gzip), tables, inspection: nativeInspection, nativeSha256: nativeBefore.sha256, nativeSizeBytes: nativeBefore.sizeBytes, evidence: allTeamMemberEvidence, evidenceSha256: allTeamMemberEvidenceSha256, classEvidenceSha256: passiveTargetEvidenceSha256 }); const teamAnalysisDb42Dataset = buildTeamAnalysisDb42(); const firstTeamAnalysisDb42Json = `${JSON.stringify(teamAnalysisDb42Dataset)}\n`; const secondTeamAnalysisDb42Json = `${JSON.stringify(buildTeamAnalysisDb42())}\n`; if (sha256(firstTeamAnalysisDb42Json) !== sha256(secondTeamAnalysisDb42Json)) throw new Error("DB42 determinism check failed: two all-team-member projections differ"); const teamAnalysisDb42Gzip = gzipSync(Buffer.from(firstTeamAnalysisDb42Json, "utf8"), { level: 9 }); const secondTeamAnalysisDb42Gzip = gzipSync(Buffer.from(secondTeamAnalysisDb42Json, "utf8"), { level: 9 }); if (!teamAnalysisDb42Gzip.equals(secondTeamAnalysisDb42Gzip)) throw new Error("DB42 determinism check failed: gzip bytes differ"); const teamAnalysisDb42Validation = validateDatabaseTeamAnalysisDb42Dataset(teamAnalysisDb42Dataset, teamAnalysisDb11Dataset, tables, { db8Sha256: sha256(teamAnalysisDb8Gzip), db9Sha256: sha256(teamAnalysisDb9Gzip), db10Sha256: sha256(teamAnalysisDb10Gzip), db11Sha256: sha256(teamAnalysisDb11Gzip), nativeSha256: nativeBefore.sha256, nativeSizeBytes: nativeBefore.sizeBytes, evidence: allTeamMemberEvidence, evidenceSha256: allTeamMemberEvidenceSha256, classEvidenceSha256: passiveTargetEvidenceSha256 }); if (!teamAnalysisDb42Validation.valid) throw new Error(`DB42 payload validation failed: ${JSON.stringify(teamAnalysisDb42Validation.failures.slice(0, 10))}`); const teamAnalysisDb42Coverage = buildDatabaseTeamAnalysisDb42Coverage(teamAnalysisDb42Dataset); const teamAnalysisDb42Goldens = await validateDatabaseTeamAnalysisDb42Goldens(teamAnalysisDb42Dataset, teamAnalysisDb42Coverage); if (teamAnalysisDb42Goldens.failures.length > 0) throw new Error(`DB42 golden fixture validation failed: ${JSON.stringify(teamAnalysisDb42Goldens.failures)}`); const teamAnalysisDb42Report = renderDatabaseTeamAnalysisDb42Report(teamAnalysisDb42Dataset, teamAnalysisDb42Coverage);
    const guardDisableEvidencePath = resolve(__dirname, "native-guard-disable-semantics.json"); const guardDisableEvidenceBytes = await readFile(guardDisableEvidencePath); const guardDisableEvidence = JSON.parse(guardDisableEvidenceBytes.toString("utf8")) as Db43NativeEvidence; const guardDisableEvidenceSha256 = sha256(guardDisableEvidenceBytes);
    const buildTeamAnalysisDb43 = () => buildDatabaseTeamAnalysisDb43Dataset({ db8: teamAnalysisDb8Dataset, db8Sha256: sha256(teamAnalysisDb8Gzip), db9: teamAnalysisDb9Dataset, db9Sha256: sha256(teamAnalysisDb9Gzip), db11: teamAnalysisDb11Dataset, db11Sha256: sha256(teamAnalysisDb11Gzip), db33: teamAnalysisDb33Dataset, db33Sha256: sha256(teamAnalysisDb33Gzip), db35: teamAnalysisDb35Dataset, db35Sha256: sha256(teamAnalysisDb35Gzip), db36: teamAnalysisDb36Dataset, db36Sha256: sha256(teamAnalysisDb36Gzip), db37: teamAnalysisDb37Dataset, db37Sha256: sha256(teamAnalysisDb37Gzip), tables, current: currentTeamAnalysis.dataset, currentSha256: currentTeamAnalysis.sha256, inspection: nativeInspection, nativeSha256: nativeBefore.sha256, nativeSizeBytes: nativeBefore.sizeBytes, evidence: guardDisableEvidence, evidenceSha256: guardDisableEvidenceSha256 }); const teamAnalysisDb43Dataset = buildTeamAnalysisDb43(); const firstTeamAnalysisDb43Json = `${JSON.stringify(teamAnalysisDb43Dataset)}\n`; const secondTeamAnalysisDb43Json = `${JSON.stringify(buildTeamAnalysisDb43())}\n`; if (sha256(firstTeamAnalysisDb43Json) !== sha256(secondTeamAnalysisDb43Json)) throw new Error("DB43 determinism check failed: two guard-disable projections differ"); const teamAnalysisDb43Gzip = gzipSync(Buffer.from(firstTeamAnalysisDb43Json, "utf8"), { level: 9 }); const secondTeamAnalysisDb43Gzip = gzipSync(Buffer.from(secondTeamAnalysisDb43Json, "utf8"), { level: 9 }); if (!teamAnalysisDb43Gzip.equals(secondTeamAnalysisDb43Gzip)) throw new Error("DB43 determinism check failed: gzip bytes differ"); const teamAnalysisDb43Validation = validateDatabaseTeamAnalysisDb43Dataset(teamAnalysisDb43Dataset, teamAnalysisDb11Dataset, teamAnalysisDb33Dataset, teamAnalysisDb35Dataset, teamAnalysisDb36Dataset, teamAnalysisDb37Dataset, tables, { db8Sha256: sha256(teamAnalysisDb8Gzip), db9Sha256: sha256(teamAnalysisDb9Gzip), db11Sha256: sha256(teamAnalysisDb11Gzip), db33Sha256: sha256(teamAnalysisDb33Gzip), db35Sha256: sha256(teamAnalysisDb35Gzip), db36Sha256: sha256(teamAnalysisDb36Gzip), db37Sha256: sha256(teamAnalysisDb37Gzip), currentTeamAnalysisSha256: currentTeamAnalysis.sha256, nativeSha256: nativeBefore.sha256, nativeSizeBytes: nativeBefore.sizeBytes, evidence: guardDisableEvidence, evidenceSha256: guardDisableEvidenceSha256 }); if (!teamAnalysisDb43Validation.valid) throw new Error(`DB43 payload validation failed: ${JSON.stringify(teamAnalysisDb43Validation.failures.slice(0, 10))}`); const teamAnalysisDb43Coverage = buildDatabaseTeamAnalysisDb43Coverage(teamAnalysisDb43Dataset); const teamAnalysisDb43Goldens = await validateDatabaseTeamAnalysisDb43Goldens(teamAnalysisDb43Dataset, teamAnalysisDb43Coverage); if (teamAnalysisDb43Goldens.failures.length > 0) throw new Error(`DB43 golden fixture validation failed: ${JSON.stringify(teamAnalysisDb43Goldens.failures)}`); const teamAnalysisDb43Report = renderDatabaseTeamAnalysisDb43Report(teamAnalysisDb43Dataset, teamAnalysisDb43Coverage);
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
    const teamAnalysisDb20Manifest: DatabaseTeamAnalysisDb20ArtifactManifest = { schemaVersion: 1, contractVersion: "0.19.0", generatedAt: options.generatedAt, fileName: "team-analysis-db20-passive-turn-correlation.json.gz", compression: "gzip", sha256: sha256(teamAnalysisDb20Gzip), sizeBytes: teamAnalysisDb20Gzip.byteLength, uncompressedSizeBytes: Buffer.byteLength(firstTeamAnalysisDb20Json, "utf8"), candidateCount: teamAnalysisDb20Coverage.candidateCount, exactNumericMatchCount: teamAnalysisDb20Coverage.exactNumericMatchCount, inheritedSemanticPromotionCount: 3, semanticPromotionCount: 0, sourceDatabaseSha256: before.sha256, sourceDb11Sha256: sha256(teamAnalysisDb11Gzip), sourceDb19Sha256: sha256(teamAnalysisDb19Gzip), currentTeamAnalysisSha256: currentTeamAnalysis.sha256, coverageFile: "team-analysis-db20-coverage.json", reportFile: "team-analysis-db20-report.md", goldenValidationFile: "team-analysis-db20-golden-validation.json" };
    const teamAnalysisDb21Manifest: DatabaseTeamAnalysisDb21ArtifactManifest = { schemaVersion: 1, contractVersion: "0.20.0", generatedAt: options.generatedAt, fileName: "team-analysis-db21-passive-turn-native-audit.json.gz", compression: "gzip", sha256: sha256(teamAnalysisDb21Gzip), sizeBytes: teamAnalysisDb21Gzip.byteLength, uncompressedSizeBytes: Buffer.byteLength(firstTeamAnalysisDb21Json, "utf8"), verifiedSymbolCount: teamAnalysisDb21Coverage.verifiedSymbolCount, unresolvedSemanticCount: teamAnalysisDb21Coverage.unresolvedSemanticCount, inheritedSemanticPromotionCount: 3, semanticPromotionCount: 0, sourceDatabaseSha256: before.sha256, sourceDb20Sha256: sha256(teamAnalysisDb20Gzip), nativeRuntimeSha256: nativeBefore.sha256, nativeLinkageEvidenceSha256, coverageFile: "team-analysis-db21-coverage.json", reportFile: "team-analysis-db21-report.md", goldenValidationFile: "team-analysis-db21-golden-validation.json" };
    const teamAnalysisDb22Manifest: DatabaseTeamAnalysisDb22ArtifactManifest = { schemaVersion: 1, contractVersion: "0.21.0", generatedAt: options.generatedAt, fileName: "team-analysis-db22-lifecycle-ast-parity.json.gz", compression: "gzip", sha256: sha256(teamAnalysisDb22Gzip), sizeBytes: teamAnalysisDb22Gzip.byteLength, uncompressedSizeBytes: Buffer.byteLength(firstTeamAnalysisDb22Json, "utf8"), affectedRulePairCount: teamAnalysisDb22Coverage.affectedRulePairCount, exactPairDelta: teamAnalysisDb22Coverage.exactPairDelta, removedTurnOneTautologyOccurrenceCount: teamAnalysisDb22Coverage.removedTurnOneTautologyOccurrenceCount, inheritedSemanticPromotionCount: 3, semanticPromotionCount: 0, sourceDatabaseSha256: before.sha256, sourceDb15Sha256: sha256(teamAnalysisDb15Gzip), sourceDb17Sha256: sha256(teamAnalysisDb17Gzip), sourceDb18Sha256: sha256(teamAnalysisDb18Gzip), sourceDb21Sha256: sha256(teamAnalysisDb21Gzip), currentTeamAnalysisSha256: currentTeamAnalysis.sha256, coverageFile: "team-analysis-db22-coverage.json", reportFile: "team-analysis-db22-report.md", goldenValidationFile: "team-analysis-db22-golden-validation.json" };
    const teamAnalysisDb23Manifest: DatabaseTeamAnalysisDb23ArtifactManifest = { schemaVersion: 1, contractVersion: "0.22.0", generatedAt: options.generatedAt, fileName: "team-analysis-db23-post-ast-residuals.json.gz", compression: "gzip", sha256: sha256(teamAnalysisDb23Gzip), sizeBytes: teamAnalysisDb23Gzip.byteLength, uncompressedSizeBytes: Buffer.byteLength(firstTeamAnalysisDb23Json, "utf8"), residualAttributionCount: teamAnalysisDb23Coverage.residualAttributionCount, residualPatternCount: teamAnalysisDb23Coverage.residualPatternCount, inheritedSemanticPromotionCount: 3, semanticPromotionCount: 0, sourceDatabaseSha256: before.sha256, sourceDb15Sha256: sha256(teamAnalysisDb15Gzip), sourceDb18Sha256: sha256(teamAnalysisDb18Gzip), sourceDb22Sha256: sha256(teamAnalysisDb22Gzip), currentTeamAnalysisSha256: currentTeamAnalysis.sha256, coverageFile: "team-analysis-db23-coverage.json", reportFile: "team-analysis-db23-report.md", goldenValidationFile: "team-analysis-db23-golden-validation.json" };
    const teamAnalysisDb24Manifest: DatabaseTeamAnalysisDb24ArtifactManifest = { schemaVersion: 1, contractVersion: "0.23.0", generatedAt: options.generatedAt, fileName: "team-analysis-db24-counter-behavior.json.gz", compression: "gzip", sha256: sha256(teamAnalysisDb24Gzip), sizeBytes: teamAnalysisDb24Gzip.byteLength, uncompressedSizeBytes: Buffer.byteLength(firstTeamAnalysisDb24Json, "utf8"), resolutionCount: teamAnalysisDb24Coverage.resolutionCount, affectedStateCount: teamAnalysisDb24Coverage.affectedStateCount, inheritedSemanticPromotionCount: 3, semanticPromotionCount: 1, sourceDatabaseSha256: before.sha256, sourceDb8Sha256: sha256(teamAnalysisDb8Gzip), sourceDb9Sha256: sha256(teamAnalysisDb9Gzip), sourceDb11Sha256: sha256(teamAnalysisDb11Gzip), nativeRuntimeSha256: nativeBefore.sha256, nativeEvidenceSha256: counterEvidenceSha256, coverageFile: "team-analysis-db24-coverage.json", reportFile: "team-analysis-db24-report.md", goldenValidationFile: "team-analysis-db24-golden-validation.json" };
    const teamAnalysisDb25Manifest: DatabaseTeamAnalysisDb25ArtifactManifest = { schemaVersion: 1, contractVersion: "0.24.0", generatedAt: options.generatedAt, fileName: "team-analysis-db25-attack-context.json.gz", compression: "gzip", sha256: sha256(teamAnalysisDb25Gzip), sizeBytes: teamAnalysisDb25Gzip.byteLength, uncompressedSizeBytes: Buffer.byteLength(firstTeamAnalysisDb25Json, "utf8"), resolutionCount: teamAnalysisDb25Coverage.resolutionCount, affectedStateCount: teamAnalysisDb25Coverage.affectedStateCount, overclaimCorrectionCount: teamAnalysisDb25Coverage.overclaimCorrectionCount, inheritedSemanticPromotionCount: 3, semanticPromotionCount: 0, sourceDatabaseSha256: before.sha256, sourceDb8Sha256: sha256(teamAnalysisDb8Gzip), sourceDb9Sha256: sha256(teamAnalysisDb9Gzip), sourceDb11Sha256: sha256(teamAnalysisDb11Gzip), nativeRuntimeSha256: nativeBefore.sha256, nativeEvidenceSha256: attackContextEvidenceSha256, coverageFile: "team-analysis-db25-coverage.json", reportFile: "team-analysis-db25-report.md", goldenValidationFile: "team-analysis-db25-golden-validation.json" };
    const teamAnalysisDb26Manifest: DatabaseTeamAnalysisDb26ArtifactManifest = { schemaVersion: 1, contractVersion: "0.25.0", generatedAt: options.generatedAt, fileName: "team-analysis-db26-special-category.json.gz", compression: "gzip", sha256: sha256(teamAnalysisDb26Gzip), sizeBytes: teamAnalysisDb26Gzip.byteLength, uncompressedSizeBytes: Buffer.byteLength(firstTeamAnalysisDb26Json, "utf8"), resolutionCount: teamAnalysisDb26Coverage.resolutionCount, affectedStateCount: teamAnalysisDb26Coverage.affectedStateCount, supportedSelectorCount: teamAnalysisDb26Coverage.supportedSelectorCount, inheritedSemanticPromotionCount: 3, semanticPromotionCount: 1, sourceDatabaseSha256: before.sha256, sourceDb8Sha256: sha256(teamAnalysisDb8Gzip), sourceDb9Sha256: sha256(teamAnalysisDb9Gzip), sourceDb11Sha256: sha256(teamAnalysisDb11Gzip), nativeRuntimeSha256: nativeBefore.sha256, nativeEvidenceSha256: specialCategoryEvidenceSha256, coverageFile: "team-analysis-db26-coverage.json", reportFile: "team-analysis-db26-report.md", goldenValidationFile: "team-analysis-db26-golden-validation.json" };
    const teamAnalysisDb27Manifest: DatabaseTeamAnalysisDb27ArtifactManifest = { schemaVersion: 1, contractVersion: "0.26.0", generatedAt: options.generatedAt, fileName: "team-analysis-db27-target-hp.json.gz", compression: "gzip", sha256: sha256(teamAnalysisDb27Gzip), sizeBytes: teamAnalysisDb27Gzip.byteLength, uncompressedSizeBytes: Buffer.byteLength(firstTeamAnalysisDb27Json, "utf8"), resolutionCount: teamAnalysisDb27Coverage.resolutionCount, affectedStateCount: teamAnalysisDb27Coverage.affectedStateCount, inheritedSemanticPromotionCount: 3, semanticPromotionCount: 3, sourceDatabaseSha256: before.sha256, sourceDb8Sha256: sha256(teamAnalysisDb8Gzip), sourceDb9Sha256: sha256(teamAnalysisDb9Gzip), sourceDb11Sha256: sha256(teamAnalysisDb11Gzip), nativeRuntimeSha256: nativeBefore.sha256, nativeEvidenceSha256: targetHpEvidenceSha256, coverageFile: "team-analysis-db27-coverage.json", reportFile: "team-analysis-db27-report.md", goldenValidationFile: "team-analysis-db27-golden-validation.json" };
    const teamAnalysisDb28Manifest: DatabaseTeamAnalysisDb28ArtifactManifest = { schemaVersion: 1, contractVersion: "0.27.0", generatedAt: options.generatedAt, fileName: "team-analysis-db28-revival-counter.json.gz", compression: "gzip", sha256: sha256(teamAnalysisDb28Gzip), sizeBytes: teamAnalysisDb28Gzip.byteLength, uncompressedSizeBytes: Buffer.byteLength(firstTeamAnalysisDb28Json, "utf8"), resolutionCount: teamAnalysisDb28Coverage.resolutionCount, affectedStateCount: teamAnalysisDb28Coverage.affectedStateCount, inheritedSemanticPromotionCount: 3, semanticPromotionCount: 2, sourceDatabaseSha256: before.sha256, sourceDb8Sha256: sha256(teamAnalysisDb8Gzip), sourceDb9Sha256: sha256(teamAnalysisDb9Gzip), sourceDb11Sha256: sha256(teamAnalysisDb11Gzip), nativeRuntimeSha256: nativeBefore.sha256, nativeEvidenceSha256: revivalCounterEvidenceSha256, coverageFile: "team-analysis-db28-coverage.json", reportFile: "team-analysis-db28-report.md", goldenValidationFile: "team-analysis-db28-golden-validation.json" };
    const teamAnalysisDb29Manifest: DatabaseTeamAnalysisDb29ArtifactManifest = { schemaVersion: 1, contractVersion: "0.28.0", generatedAt: options.generatedAt, fileName: "team-analysis-db29-attack-break.json.gz", compression: "gzip", sha256: sha256(teamAnalysisDb29Gzip), sizeBytes: teamAnalysisDb29Gzip.byteLength, uncompressedSizeBytes: Buffer.byteLength(firstTeamAnalysisDb29Json, "utf8"), resolutionCount: teamAnalysisDb29Coverage.resolutionCount, affectedStateCount: teamAnalysisDb29Coverage.affectedStateCount, inheritedSemanticPromotionCount: 3, semanticPromotionCount: 1, sourceDatabaseSha256: before.sha256, sourceDb8Sha256: sha256(teamAnalysisDb8Gzip), sourceDb9Sha256: sha256(teamAnalysisDb9Gzip), sourceDb11Sha256: sha256(teamAnalysisDb11Gzip), nativeRuntimeSha256: nativeBefore.sha256, nativeEvidenceSha256: attackBreakEvidenceSha256, coverageFile: "team-analysis-db29-coverage.json", reportFile: "team-analysis-db29-report.md", goldenValidationFile: "team-analysis-db29-golden-validation.json" };
    const teamAnalysisDb30Manifest: DatabaseTeamAnalysisDb30ArtifactManifest = { schemaVersion: 1, contractVersion: "0.29.0", generatedAt: options.generatedAt, fileName: "team-analysis-db30-efficacy-removal.json.gz", compression: "gzip", sha256: sha256(teamAnalysisDb30Gzip), sizeBytes: teamAnalysisDb30Gzip.byteLength, uncompressedSizeBytes: Buffer.byteLength(firstTeamAnalysisDb30Json, "utf8"), resolutionCount: teamAnalysisDb30Coverage.resolutionCount, affectedStateCount: teamAnalysisDb30Coverage.affectedStateCount, inheritedSemanticPromotionCount: 3, semanticPromotionCount: 1, sourceDatabaseSha256: before.sha256, sourceDb8Sha256: sha256(teamAnalysisDb8Gzip), sourceDb9Sha256: sha256(teamAnalysisDb9Gzip), sourceDb11Sha256: sha256(teamAnalysisDb11Gzip), nativeRuntimeSha256: nativeBefore.sha256, nativeEvidenceSha256: removalEvidenceSha256, coverageFile: "team-analysis-db30-coverage.json", reportFile: "team-analysis-db30-report.md", goldenValidationFile: "team-analysis-db30-golden-validation.json" };
    const teamAnalysisDb31Manifest: DatabaseTeamAnalysisDb31ArtifactManifest = { schemaVersion: 1, contractVersion: "0.30.0", generatedAt: options.generatedAt, fileName: "team-analysis-db31-skill-calc-option.json.gz", compression: "gzip", sha256: sha256(teamAnalysisDb31Gzip), sizeBytes: teamAnalysisDb31Gzip.byteLength, uncompressedSizeBytes: Buffer.byteLength(firstTeamAnalysisDb31Json, "utf8"), ruleCount: teamAnalysisDb31Coverage.ruleCount, affectedStateCount: teamAnalysisDb31Coverage.affectedStateCount, inheritedSemanticPromotionCount: 3, semanticPromotionCount: 5, sourceDatabaseSha256: before.sha256, sourceDb11Sha256: sha256(teamAnalysisDb11Gzip), currentTeamAnalysisSha256: currentTeamAnalysis.sha256, nativeRuntimeSha256: nativeBefore.sha256, nativeEvidenceSha256: calcOptionEvidenceSha256, coverageFile: "team-analysis-db31-coverage.json", reportFile: "team-analysis-db31-report.md", validationFile: "team-analysis-db31-validation.json", goldenValidationFile: "team-analysis-db31-golden-validation.json" };
    const teamAnalysisDb32Manifest: DatabaseTeamAnalysisDb32ArtifactManifest = { schemaVersion: 1, contractVersion: "0.31.0", generatedAt: options.generatedAt, fileName: "team-analysis-db32-execution-timing.json.gz", compression: "gzip", sha256: sha256(teamAnalysisDb32Gzip), sizeBytes: teamAnalysisDb32Gzip.byteLength, uncompressedSizeBytes: Buffer.byteLength(firstTeamAnalysisDb32Json, "utf8"), ruleCount: teamAnalysisDb32Coverage.ruleCount, supportedRuleCount: teamAnalysisDb32Coverage.supportedRuleCount, affectedStateCount: teamAnalysisDb32Coverage.affectedStateCount, inheritedSemanticPromotionCount: 8, semanticPromotionCount: 1, sourceDatabaseSha256: before.sha256, sourceDb11Sha256: sha256(teamAnalysisDb11Gzip), sourceDb31Sha256: sha256(teamAnalysisDb31Gzip), currentTeamAnalysisSha256: currentTeamAnalysis.sha256, nativeRuntimeSha256: nativeBefore.sha256, nativeEvidenceSha256: executionTimingEvidenceSha256, coverageFile: "team-analysis-db32-coverage.json", reportFile: "team-analysis-db32-report.md", validationFile: "team-analysis-db32-validation.json", goldenValidationFile: "team-analysis-db32-golden-validation.json" };
    const teamAnalysisDb33Manifest: DatabaseTeamAnalysisDb33ArtifactManifest = { schemaVersion: 1, contractVersion: "0.32.0", generatedAt: options.generatedAt, fileName: "team-analysis-db33-player-attack-setup-timing.json.gz", compression: "gzip", sha256: sha256(teamAnalysisDb33Gzip), sizeBytes: teamAnalysisDb33Gzip.byteLength, uncompressedSizeBytes: Buffer.byteLength(firstTeamAnalysisDb33Json, "utf8"), ruleCount: teamAnalysisDb33Coverage.ruleCount, supportedRuleCount: teamAnalysisDb33Coverage.supportedRuleCount, newlySupportedRuleCount: teamAnalysisDb33Coverage.newlySupportedRuleCount, affectedStateCount: teamAnalysisDb33Coverage.affectedStateCount, inheritedSemanticPromotionCount: 9, semanticPromotionCount: 1, sourceDatabaseSha256: before.sha256, sourceDb32Sha256: sha256(teamAnalysisDb32Gzip), currentTeamAnalysisSha256: currentTeamAnalysis.sha256, nativeRuntimeSha256: nativeBefore.sha256, nativeEvidenceSha256: attackSetupTimingEvidenceSha256, coverageFile: "team-analysis-db33-coverage.json", reportFile: "team-analysis-db33-report.md", validationFile: "team-analysis-db33-validation.json", goldenValidationFile: "team-analysis-db33-golden-validation.json" };
    const teamAnalysisDb34Manifest: DatabaseTeamAnalysisDb34ArtifactManifest = { schemaVersion: 1, contractVersion: "0.33.0", generatedAt: options.generatedAt, fileName: "team-analysis-db34-basic-stat-buckets.json.gz", compression: "gzip", sha256: sha256(teamAnalysisDb34Gzip), sizeBytes: teamAnalysisDb34Gzip.byteLength, uncompressedSizeBytes: Buffer.byteLength(firstTeamAnalysisDb34Json, "utf8"), basicStatRuleCount: teamAnalysisDb34Coverage.basicStatRuleCount, statApplicationCount: teamAnalysisDb34Coverage.statApplicationCount, affectedStateCount: teamAnalysisDb34Coverage.affectedStateCount, inheritedSemanticPromotionCount: 10, semanticPromotionCount: 5, sourceDatabaseSha256: before.sha256, sourceDb11Sha256: sha256(teamAnalysisDb11Gzip), sourceDb13Sha256: sha256(teamAnalysisDb13Gzip), sourceDb31Sha256: sha256(teamAnalysisDb31Gzip), sourceDb33Sha256: sha256(teamAnalysisDb33Gzip), currentTeamAnalysisSha256: currentTeamAnalysis.sha256, nativeRuntimeSha256: nativeBefore.sha256, nativeEvidenceSha256: basicStatBucketEvidenceSha256, coverageFile: "team-analysis-db34-coverage.json", reportFile: "team-analysis-db34-report.md", validationFile: "team-analysis-db34-validation.json", goldenValidationFile: "team-analysis-db34-golden-validation.json" };
    const teamAnalysisDb35Manifest: DatabaseTeamAnalysisDb35ArtifactManifest = { schemaVersion: 1, contractVersion: "0.34.0", generatedAt: options.generatedAt, fileName: "team-analysis-db35-target-dispatch.json.gz", compression: "gzip", sha256: sha256(teamAnalysisDb35Gzip), sizeBytes: teamAnalysisDb35Gzip.byteLength, uncompressedSizeBytes: Buffer.byteLength(firstTeamAnalysisDb35Json, "utf8"), ruleCount: teamAnalysisDb35Coverage.ruleCount, supportedRuleCount: teamAnalysisDb35Coverage.supportedRuleCount, affectedStateCount: teamAnalysisDb35Coverage.affectedStateCount, inheritedSemanticPromotionCount: 15, semanticPromotionCount: 9, sourceDatabaseSha256: before.sha256, sourceDb11Sha256: sha256(teamAnalysisDb11Gzip), sourceDb33Sha256: sha256(teamAnalysisDb33Gzip), currentTeamAnalysisSha256: currentTeamAnalysis.sha256, nativeRuntimeSha256: nativeBefore.sha256, nativeEvidenceSha256: passiveTargetEvidenceSha256, coverageFile: "team-analysis-db35-coverage.json", reportFile: "team-analysis-db35-report.md", validationFile: "team-analysis-db35-validation.json", goldenValidationFile: "team-analysis-db35-golden-validation.json" };
    const teamAnalysisDb36Manifest: DatabaseTeamAnalysisDb36ArtifactManifest = { schemaVersion: 1, contractVersion: "0.35.0", generatedAt: options.generatedAt, fileName: "team-analysis-db36-sub-target-semantics.json.gz", compression: "gzip", sha256: sha256(teamAnalysisDb36Gzip), sizeBytes: teamAnalysisDb36Gzip.byteLength, uncompressedSizeBytes: Buffer.byteLength(firstTeamAnalysisDb36Json, "utf8"), ruleCount: teamAnalysisDb36Coverage.ruleCount, supportedRuleCount: teamAnalysisDb36Coverage.supportedRuleCount, affectedStateCount: teamAnalysisDb36Coverage.affectedStateCount, inheritedSemanticPromotionCount: 24, semanticPromotionCount: 5, sourceDatabaseSha256: before.sha256, sourceDb35Sha256: sha256(teamAnalysisDb35Gzip), nativeRuntimeSha256: nativeBefore.sha256, nativeEvidenceSha256: subTargetEvidenceSha256, coverageFile: "team-analysis-db36-coverage.json", reportFile: "team-analysis-db36-report.md", validationFile: "team-analysis-db36-validation.json", goldenValidationFile: "team-analysis-db36-golden-validation.json" };
    const teamAnalysisDb37Manifest: DatabaseTeamAnalysisDb37ArtifactManifest = { schemaVersion: 1, contractVersion: "0.36.0", generatedAt: options.generatedAt, fileName: "team-analysis-db37-passive-lifecycle.json.gz", compression: "gzip", sha256: sha256(teamAnalysisDb37Gzip), sizeBytes: teamAnalysisDb37Gzip.byteLength, uncompressedSizeBytes: Buffer.byteLength(firstTeamAnalysisDb37Json, "utf8"), ruleCount: teamAnalysisDb37Coverage.ruleCount, onceOnlyEnabledRuleCount: teamAnalysisDb37Coverage.onceOnlyEnabledRuleCount, affectedStateCount: teamAnalysisDb37Coverage.affectedStateCount, inheritedSemanticPromotionCount: 29, semanticPromotionCount: 2, sourceDatabaseSha256: before.sha256, sourceDb36Sha256: sha256(teamAnalysisDb36Gzip), sourceDb20Sha256: sha256(teamAnalysisDb20Gzip), nativeRuntimeSha256: nativeBefore.sha256, nativeEvidenceSha256: passiveLifecycleEvidenceSha256, coverageFile: "team-analysis-db37-coverage.json", reportFile: "team-analysis-db37-report.md", validationFile: "team-analysis-db37-validation.json", goldenValidationFile: "team-analysis-db37-golden-validation.json" };
    const teamAnalysisDb38Manifest: DatabaseTeamAnalysisDb38ArtifactManifest = { schemaVersion: 1, contractVersion: "0.37.0", generatedAt: options.generatedAt, fileName: "team-analysis-db38-incremental-status.json.gz", compression: "gzip", sha256: sha256(teamAnalysisDb38Gzip), sizeBytes: teamAnalysisDb38Gzip.byteLength, uncompressedSizeBytes: Buffer.byteLength(firstTeamAnalysisDb38Json, "utf8"), ruleCount: teamAnalysisDb38Coverage.ruleCount, affectedStateCount: teamAnalysisDb38Coverage.affectedStateCount, confirmedLegacyConflictCount: teamAnalysisDb38Coverage.confirmedLegacyConflictCount, inheritedSemanticPromotionCount: 31, semanticPromotionCount: 8, sourceDatabaseSha256: before.sha256, sourceDb37Sha256: sha256(teamAnalysisDb37Gzip), sourceDb11Sha256: sha256(teamAnalysisDb11Gzip), nativeRuntimeSha256: nativeBefore.sha256, nativeEvidenceSha256: incrementalStatusEvidenceSha256, coverageFile: "team-analysis-db38-coverage.json", reportFile: "team-analysis-db38-report.md", validationFile: "team-analysis-db38-validation.json", goldenValidationFile: "team-analysis-db38-golden-validation.json" };
    const teamAnalysisDb39Manifest: DatabaseTeamAnalysisDb39ArtifactManifest = { schemaVersion: 1, contractVersion: "0.38.0", generatedAt: options.generatedAt, fileName: "team-analysis-db39-energy-ball-proportional-stats.json.gz", compression: "gzip", sha256: sha256(teamAnalysisDb39Gzip), sizeBytes: teamAnalysisDb39Gzip.byteLength, uncompressedSizeBytes: Buffer.byteLength(firstTeamAnalysisDb39Json, "utf8"), ruleCount: teamAnalysisDb39Coverage.ruleCount, statApplicationCount: teamAnalysisDb39Coverage.statApplicationCount, affectedStateCount: teamAnalysisDb39Coverage.affectedStateCount, inheritedSemanticPromotionCount: 39, semanticPromotionCount: 6, sourceDatabaseSha256: before.sha256, sourceDb11Sha256: sha256(teamAnalysisDb11Gzip), sourceDb31Sha256: sha256(teamAnalysisDb31Gzip), sourceDb34Sha256: sha256(teamAnalysisDb34Gzip), sourceDb37Sha256: sha256(teamAnalysisDb37Gzip), nativeRuntimeSha256: nativeBefore.sha256, nativeEvidenceSha256: proportionalStatEvidenceSha256, coverageFile: "team-analysis-db39-coverage.json", reportFile: "team-analysis-db39-report.md", validationFile: "team-analysis-db39-validation.json", goldenValidationFile: "team-analysis-db39-golden-validation.json" };
    const teamAnalysisDb40Manifest: DatabaseTeamAnalysisDb40ArtifactManifest = { schemaVersion: 1, contractVersion: "0.39.0", generatedAt: options.generatedAt, fileName: "team-analysis-db40-battle-gauge-thresholds.json.gz", compression: "gzip", sha256: sha256(teamAnalysisDb40Gzip), sizeBytes: teamAnalysisDb40Gzip.byteLength, uncompressedSizeBytes: Buffer.byteLength(firstTeamAnalysisDb40Json, "utf8"), resolutionCount: teamAnalysisDb40Coverage.resolutionCount, affectedStateCount: teamAnalysisDb40Coverage.affectedStateCount, inheritedSemanticPromotionCount: 45, semanticPromotionCount: 2, sourceDatabaseSha256: before.sha256, sourceDb8Sha256: sha256(teamAnalysisDb8Gzip), sourceDb9Sha256: sha256(teamAnalysisDb9Gzip), sourceDb10Sha256: sha256(teamAnalysisDb10Gzip), sourceDb11Sha256: sha256(teamAnalysisDb11Gzip), nativeRuntimeSha256: nativeBefore.sha256, nativeEvidenceSha256: battleGaugeThresholdEvidenceSha256, coverageFile: "team-analysis-db40-coverage.json", reportFile: "team-analysis-db40-report.md", validationFile: "team-analysis-db40-validation.json", goldenValidationFile: "team-analysis-db40-golden-validation.json" };
    const teamAnalysisDb41Manifest: DatabaseTeamAnalysisDb41ArtifactManifest = { schemaVersion: 1, contractVersion: "0.40.0", generatedAt: options.generatedAt, fileName: "team-analysis-db41-enemy-category-count-thresholds.json.gz", compression: "gzip", sha256: sha256(teamAnalysisDb41Gzip), sizeBytes: teamAnalysisDb41Gzip.byteLength, uncompressedSizeBytes: Buffer.byteLength(firstTeamAnalysisDb41Json, "utf8"), resolutionCount: teamAnalysisDb41Coverage.resolutionCount, affectedStateCount: teamAnalysisDb41Coverage.affectedStateCount, inheritedSemanticPromotionCount: 47, semanticPromotionCount: 1, sourceDatabaseSha256: before.sha256, sourceDb8Sha256: sha256(teamAnalysisDb8Gzip), sourceDb9Sha256: sha256(teamAnalysisDb9Gzip), sourceDb10Sha256: sha256(teamAnalysisDb10Gzip), sourceDb11Sha256: sha256(teamAnalysisDb11Gzip), nativeRuntimeSha256: nativeBefore.sha256, nativeEvidenceSha256: enemyCategoryCountEvidenceSha256, coverageFile: "team-analysis-db41-coverage.json", reportFile: "team-analysis-db41-report.md", validationFile: "team-analysis-db41-validation.json", goldenValidationFile: "team-analysis-db41-golden-validation.json" };
    const teamAnalysisDb42Manifest: DatabaseTeamAnalysisDb42ArtifactManifest = { schemaVersion: 1, contractVersion: "0.41.0", generatedAt: options.generatedAt, fileName: "team-analysis-db42-all-team-member-conditions.json.gz", compression: "gzip", sha256: sha256(teamAnalysisDb42Gzip), sizeBytes: teamAnalysisDb42Gzip.byteLength, uncompressedSizeBytes: Buffer.byteLength(firstTeamAnalysisDb42Json, "utf8"), resolutionCount: teamAnalysisDb42Coverage.resolutionCount, affectedStateCount: teamAnalysisDb42Coverage.affectedStateCount, inheritedSemanticPromotionCount: 48, semanticPromotionCount: 2, sourceDatabaseSha256: before.sha256, sourceDb8Sha256: sha256(teamAnalysisDb8Gzip), sourceDb9Sha256: sha256(teamAnalysisDb9Gzip), sourceDb10Sha256: sha256(teamAnalysisDb10Gzip), sourceDb11Sha256: sha256(teamAnalysisDb11Gzip), nativeRuntimeSha256: nativeBefore.sha256, nativeEvidenceSha256: allTeamMemberEvidenceSha256, classEvidenceSha256: passiveTargetEvidenceSha256, coverageFile: "team-analysis-db42-coverage.json", reportFile: "team-analysis-db42-report.md", validationFile: "team-analysis-db42-validation.json", goldenValidationFile: "team-analysis-db42-golden-validation.json" };
    const teamAnalysisDb43Manifest: DatabaseTeamAnalysisDb43ArtifactManifest = { schemaVersion: 1, contractVersion: "0.42.0", generatedAt: options.generatedAt, fileName: "team-analysis-db43-guard-disable.json.gz", compression: "gzip", sha256: sha256(teamAnalysisDb43Gzip), sizeBytes: teamAnalysisDb43Gzip.byteLength, uncompressedSizeBytes: Buffer.byteLength(firstTeamAnalysisDb43Json, "utf8"), resolutionCount: teamAnalysisDb43Coverage.resolutionCount, affectedStateCount: teamAnalysisDb43Coverage.affectedStateCount, inheritedSemanticPromotionCount: 50, semanticPromotionCount: 1, sourceDatabaseSha256: before.sha256, sourceDb8Sha256: sha256(teamAnalysisDb8Gzip), sourceDb9Sha256: sha256(teamAnalysisDb9Gzip), sourceDb11Sha256: sha256(teamAnalysisDb11Gzip), sourceDb33Sha256: sha256(teamAnalysisDb33Gzip), sourceDb35Sha256: sha256(teamAnalysisDb35Gzip), sourceDb36Sha256: sha256(teamAnalysisDb36Gzip), sourceDb37Sha256: sha256(teamAnalysisDb37Gzip), currentTeamAnalysisSha256: currentTeamAnalysis.sha256, nativeRuntimeSha256: nativeBefore.sha256, nativeEvidenceSha256: guardDisableEvidenceSha256, coverageFile: "team-analysis-db43-coverage.json", reportFile: "team-analysis-db43-report.md", validationFile: "team-analysis-db43-validation.json", goldenValidationFile: "team-analysis-db43-golden-validation.json" };

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
        writeFile(resolve(options.outputDir, teamAnalysisDb20Manifest.fileName), teamAnalysisDb20Gzip),
        writeFile(resolve(options.outputDir, "team-analysis-db20-manifest.json"), `${JSON.stringify(teamAnalysisDb20Manifest, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb20Manifest.coverageFile), `${JSON.stringify(teamAnalysisDb20Coverage, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb20Manifest.reportFile), teamAnalysisDb20Report, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb20Manifest.goldenValidationFile), `${JSON.stringify(teamAnalysisDb20Goldens, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb21Manifest.fileName), teamAnalysisDb21Gzip),
        writeFile(resolve(options.outputDir, "team-analysis-db21-manifest.json"), `${JSON.stringify(teamAnalysisDb21Manifest, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb21Manifest.coverageFile), `${JSON.stringify(teamAnalysisDb21Coverage, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb21Manifest.reportFile), teamAnalysisDb21Report, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb21Manifest.goldenValidationFile), `${JSON.stringify(teamAnalysisDb21Goldens, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb22Manifest.fileName), teamAnalysisDb22Gzip),
        writeFile(resolve(options.outputDir, "team-analysis-db22-manifest.json"), `${JSON.stringify(teamAnalysisDb22Manifest, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb22Manifest.coverageFile), `${JSON.stringify(teamAnalysisDb22Coverage, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb22Manifest.reportFile), teamAnalysisDb22Report, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb22Manifest.goldenValidationFile), `${JSON.stringify(teamAnalysisDb22Goldens, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb23Manifest.fileName), teamAnalysisDb23Gzip),
        writeFile(resolve(options.outputDir, "team-analysis-db23-manifest.json"), `${JSON.stringify(teamAnalysisDb23Manifest, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb23Manifest.coverageFile), `${JSON.stringify(teamAnalysisDb23Coverage, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb23Manifest.reportFile), teamAnalysisDb23Report, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb23Manifest.goldenValidationFile), `${JSON.stringify(teamAnalysisDb23Goldens, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb24Manifest.fileName), teamAnalysisDb24Gzip),
        writeFile(resolve(options.outputDir, "team-analysis-db24-manifest.json"), `${JSON.stringify(teamAnalysisDb24Manifest, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb24Manifest.coverageFile), `${JSON.stringify(teamAnalysisDb24Coverage, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb24Manifest.reportFile), teamAnalysisDb24Report, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb24Manifest.goldenValidationFile), `${JSON.stringify(teamAnalysisDb24Goldens, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb25Manifest.fileName), teamAnalysisDb25Gzip),
        writeFile(resolve(options.outputDir, "team-analysis-db25-manifest.json"), `${JSON.stringify(teamAnalysisDb25Manifest, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb25Manifest.coverageFile), `${JSON.stringify(teamAnalysisDb25Coverage, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb25Manifest.reportFile), teamAnalysisDb25Report, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb25Manifest.goldenValidationFile), `${JSON.stringify(teamAnalysisDb25Goldens, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb26Manifest.fileName), teamAnalysisDb26Gzip),
        writeFile(resolve(options.outputDir, "team-analysis-db26-manifest.json"), `${JSON.stringify(teamAnalysisDb26Manifest, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb26Manifest.coverageFile), `${JSON.stringify(teamAnalysisDb26Coverage, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb26Manifest.reportFile), teamAnalysisDb26Report, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb26Manifest.goldenValidationFile), `${JSON.stringify(teamAnalysisDb26Goldens, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb27Manifest.fileName), teamAnalysisDb27Gzip),
        writeFile(resolve(options.outputDir, "team-analysis-db27-manifest.json"), `${JSON.stringify(teamAnalysisDb27Manifest, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb27Manifest.coverageFile), `${JSON.stringify(teamAnalysisDb27Coverage, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb27Manifest.reportFile), teamAnalysisDb27Report, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb27Manifest.goldenValidationFile), `${JSON.stringify(teamAnalysisDb27Goldens, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb28Manifest.fileName), teamAnalysisDb28Gzip),
        writeFile(resolve(options.outputDir, "team-analysis-db28-manifest.json"), `${JSON.stringify(teamAnalysisDb28Manifest, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb28Manifest.coverageFile), `${JSON.stringify(teamAnalysisDb28Coverage, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb28Manifest.reportFile), teamAnalysisDb28Report, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb28Manifest.goldenValidationFile), `${JSON.stringify(teamAnalysisDb28Goldens, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb29Manifest.fileName), teamAnalysisDb29Gzip),
        writeFile(resolve(options.outputDir, "team-analysis-db29-manifest.json"), `${JSON.stringify(teamAnalysisDb29Manifest, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb29Manifest.coverageFile), `${JSON.stringify(teamAnalysisDb29Coverage, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb29Manifest.reportFile), teamAnalysisDb29Report, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb29Manifest.goldenValidationFile), `${JSON.stringify(teamAnalysisDb29Goldens, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb30Manifest.fileName), teamAnalysisDb30Gzip),
        writeFile(resolve(options.outputDir, "team-analysis-db30-manifest.json"), `${JSON.stringify(teamAnalysisDb30Manifest, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb30Manifest.coverageFile), `${JSON.stringify(teamAnalysisDb30Coverage, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb30Manifest.reportFile), teamAnalysisDb30Report, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb30Manifest.goldenValidationFile), `${JSON.stringify(teamAnalysisDb30Goldens, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb31Manifest.fileName), teamAnalysisDb31Gzip),
        writeFile(resolve(options.outputDir, "team-analysis-db31-manifest.json"), `${JSON.stringify(teamAnalysisDb31Manifest, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb31Manifest.coverageFile), `${JSON.stringify(teamAnalysisDb31Coverage, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb31Manifest.reportFile), teamAnalysisDb31Report, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb31Manifest.validationFile), `${JSON.stringify(teamAnalysisDb31Validation, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb31Manifest.goldenValidationFile), `${JSON.stringify(teamAnalysisDb31Goldens, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb32Manifest.fileName), teamAnalysisDb32Gzip),
        writeFile(resolve(options.outputDir, "team-analysis-db32-manifest.json"), `${JSON.stringify(teamAnalysisDb32Manifest, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb32Manifest.coverageFile), `${JSON.stringify(teamAnalysisDb32Coverage, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb32Manifest.reportFile), teamAnalysisDb32Report, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb32Manifest.validationFile), `${JSON.stringify(teamAnalysisDb32Validation, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb32Manifest.goldenValidationFile), `${JSON.stringify(teamAnalysisDb32Goldens, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb33Manifest.fileName), teamAnalysisDb33Gzip),
        writeFile(resolve(options.outputDir, "team-analysis-db33-manifest.json"), `${JSON.stringify(teamAnalysisDb33Manifest, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb33Manifest.coverageFile), `${JSON.stringify(teamAnalysisDb33Coverage, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb33Manifest.reportFile), teamAnalysisDb33Report, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb33Manifest.validationFile), `${JSON.stringify(teamAnalysisDb33Validation, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb33Manifest.goldenValidationFile), `${JSON.stringify(teamAnalysisDb33Goldens, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb34Manifest.fileName), teamAnalysisDb34Gzip),
        writeFile(resolve(options.outputDir, "team-analysis-db34-manifest.json"), `${JSON.stringify(teamAnalysisDb34Manifest, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb34Manifest.coverageFile), `${JSON.stringify(teamAnalysisDb34Coverage, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb34Manifest.reportFile), teamAnalysisDb34Report, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb34Manifest.validationFile), `${JSON.stringify(teamAnalysisDb34Validation, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb34Manifest.goldenValidationFile), `${JSON.stringify(teamAnalysisDb34Goldens, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb35Manifest.fileName), teamAnalysisDb35Gzip),
        writeFile(resolve(options.outputDir, "team-analysis-db35-manifest.json"), `${JSON.stringify(teamAnalysisDb35Manifest, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb35Manifest.coverageFile), `${JSON.stringify(teamAnalysisDb35Coverage, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb35Manifest.reportFile), teamAnalysisDb35Report, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb35Manifest.validationFile), `${JSON.stringify(teamAnalysisDb35Validation, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb35Manifest.goldenValidationFile), `${JSON.stringify(teamAnalysisDb35Goldens, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb36Manifest.fileName), teamAnalysisDb36Gzip),
        writeFile(resolve(options.outputDir, "team-analysis-db36-manifest.json"), `${JSON.stringify(teamAnalysisDb36Manifest, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb36Manifest.coverageFile), `${JSON.stringify(teamAnalysisDb36Coverage, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb36Manifest.reportFile), teamAnalysisDb36Report, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb36Manifest.validationFile), `${JSON.stringify(teamAnalysisDb36Validation, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb36Manifest.goldenValidationFile), `${JSON.stringify(teamAnalysisDb36Goldens, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb37Manifest.fileName), teamAnalysisDb37Gzip),
        writeFile(resolve(options.outputDir, "team-analysis-db37-manifest.json"), `${JSON.stringify(teamAnalysisDb37Manifest, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb37Manifest.coverageFile), `${JSON.stringify(teamAnalysisDb37Coverage, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb37Manifest.reportFile), teamAnalysisDb37Report, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb37Manifest.validationFile), `${JSON.stringify(teamAnalysisDb37Validation, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb37Manifest.goldenValidationFile), `${JSON.stringify(teamAnalysisDb37Goldens, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb38Manifest.fileName), teamAnalysisDb38Gzip),
        writeFile(resolve(options.outputDir, "team-analysis-db38-manifest.json"), `${JSON.stringify(teamAnalysisDb38Manifest, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb38Manifest.coverageFile), `${JSON.stringify(teamAnalysisDb38Coverage, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb38Manifest.reportFile), teamAnalysisDb38Report, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb38Manifest.validationFile), `${JSON.stringify(teamAnalysisDb38Validation, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb38Manifest.goldenValidationFile), `${JSON.stringify(teamAnalysisDb38Goldens, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb39Manifest.fileName), teamAnalysisDb39Gzip),
        writeFile(resolve(options.outputDir, "team-analysis-db39-manifest.json"), `${JSON.stringify(teamAnalysisDb39Manifest, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb39Manifest.coverageFile), `${JSON.stringify(teamAnalysisDb39Coverage, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb39Manifest.reportFile), teamAnalysisDb39Report, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb39Manifest.validationFile), `${JSON.stringify(teamAnalysisDb39Validation, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb39Manifest.goldenValidationFile), `${JSON.stringify(teamAnalysisDb39Goldens, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb40Manifest.fileName), teamAnalysisDb40Gzip),
        writeFile(resolve(options.outputDir, "team-analysis-db40-manifest.json"), `${JSON.stringify(teamAnalysisDb40Manifest, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb40Manifest.coverageFile), `${JSON.stringify(teamAnalysisDb40Coverage, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb40Manifest.reportFile), teamAnalysisDb40Report, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb40Manifest.validationFile), `${JSON.stringify(teamAnalysisDb40Validation, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb40Manifest.goldenValidationFile), `${JSON.stringify(teamAnalysisDb40Goldens, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb41Manifest.fileName), teamAnalysisDb41Gzip),
        writeFile(resolve(options.outputDir, "team-analysis-db41-manifest.json"), `${JSON.stringify(teamAnalysisDb41Manifest, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb41Manifest.coverageFile), `${JSON.stringify(teamAnalysisDb41Coverage, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb41Manifest.reportFile), teamAnalysisDb41Report, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb41Manifest.validationFile), `${JSON.stringify(teamAnalysisDb41Validation, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb41Manifest.goldenValidationFile), `${JSON.stringify(teamAnalysisDb41Goldens, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb42Manifest.fileName), teamAnalysisDb42Gzip),
        writeFile(resolve(options.outputDir, "team-analysis-db42-manifest.json"), `${JSON.stringify(teamAnalysisDb42Manifest, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb42Manifest.coverageFile), `${JSON.stringify(teamAnalysisDb42Coverage, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb42Manifest.reportFile), teamAnalysisDb42Report, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb42Manifest.validationFile), `${JSON.stringify(teamAnalysisDb42Validation, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb42Manifest.goldenValidationFile), `${JSON.stringify(teamAnalysisDb42Goldens, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb43Manifest.fileName), teamAnalysisDb43Gzip),
        writeFile(resolve(options.outputDir, "team-analysis-db43-manifest.json"), `${JSON.stringify(teamAnalysisDb43Manifest, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb43Manifest.coverageFile), `${JSON.stringify(teamAnalysisDb43Coverage, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb43Manifest.reportFile), teamAnalysisDb43Report, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb43Manifest.validationFile), `${JSON.stringify(teamAnalysisDb43Validation, null, 2)}\n`, "utf8"),
        writeFile(resolve(options.outputDir, teamAnalysisDb43Manifest.goldenValidationFile), `${JSON.stringify(teamAnalysisDb43Goldens, null, 2)}\n`, "utf8"),
    ]);
    return { manifest, sourceManifest, teamAnalysisManifest, teamAnalysisDb3Manifest, teamAnalysisDb4Manifest, teamAnalysisDb5Manifest, teamAnalysisDb6Manifest, teamAnalysisDb7Manifest, teamAnalysisDb8Manifest, teamAnalysisDb9Manifest, teamAnalysisDb10Manifest, teamAnalysisDb11Manifest, teamAnalysisDb12Manifest, teamAnalysisDb13Manifest, teamAnalysisDb14Manifest, teamAnalysisDb15Manifest, teamAnalysisDb16Manifest, teamAnalysisDb17Manifest, teamAnalysisDb18Manifest, teamAnalysisDb19Manifest, teamAnalysisDb20Manifest, teamAnalysisDb21Manifest, teamAnalysisDb22Manifest, teamAnalysisDb23Manifest, teamAnalysisDb24Manifest, teamAnalysisDb25Manifest, teamAnalysisDb26Manifest, teamAnalysisDb27Manifest, teamAnalysisDb28Manifest, teamAnalysisDb29Manifest, teamAnalysisDb30Manifest, teamAnalysisDb31Manifest, teamAnalysisDb32Manifest, teamAnalysisDb33Manifest, teamAnalysisDb34Manifest, teamAnalysisDb35Manifest, teamAnalysisDb36Manifest, teamAnalysisDb37Manifest, teamAnalysisDb38Manifest, teamAnalysisDb39Manifest, teamAnalysisDb40Manifest, teamAnalysisDb41Manifest, teamAnalysisDb42Manifest, teamAnalysisDb43Manifest, outputDir: options.outputDir, deterministicRebuildSha256: sha256(secondGzip) };
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
        teamAnalysisDb20Artifact: result.teamAnalysisDb20Manifest,
        teamAnalysisDb21Artifact: result.teamAnalysisDb21Manifest,
        teamAnalysisDb22Artifact: result.teamAnalysisDb22Manifest,
        teamAnalysisDb23Artifact: result.teamAnalysisDb23Manifest,
        teamAnalysisDb24Artifact: result.teamAnalysisDb24Manifest,
        teamAnalysisDb25Artifact: result.teamAnalysisDb25Manifest,
        teamAnalysisDb26Artifact: result.teamAnalysisDb26Manifest,
        teamAnalysisDb27Artifact: result.teamAnalysisDb27Manifest,
        teamAnalysisDb28Artifact: result.teamAnalysisDb28Manifest,
        teamAnalysisDb29Artifact: result.teamAnalysisDb29Manifest,
        teamAnalysisDb30Artifact: result.teamAnalysisDb30Manifest,
        teamAnalysisDb31Artifact: result.teamAnalysisDb31Manifest,
        teamAnalysisDb32Artifact: result.teamAnalysisDb32Manifest,
        teamAnalysisDb33Artifact: result.teamAnalysisDb33Manifest,
        teamAnalysisDb34Artifact: result.teamAnalysisDb34Manifest,
        teamAnalysisDb35Artifact: result.teamAnalysisDb35Manifest,
        teamAnalysisDb36Artifact: result.teamAnalysisDb36Manifest,
        teamAnalysisDb37Artifact: result.teamAnalysisDb37Manifest,
        teamAnalysisDb38Artifact: result.teamAnalysisDb38Manifest,
        teamAnalysisDb39Artifact: result.teamAnalysisDb39Manifest,
        teamAnalysisDb40Artifact: result.teamAnalysisDb40Manifest,
        teamAnalysisDb41Artifact: result.teamAnalysisDb41Manifest,
        teamAnalysisDb42Artifact: result.teamAnalysisDb42Manifest,
        teamAnalysisDb43Artifact: result.teamAnalysisDb43Manifest,
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
