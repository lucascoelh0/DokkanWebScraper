import { createHash } from "crypto";
import { createReadStream, existsSync } from "fs";
import { mkdir, open, readFile, rename, stat, unlink, writeFile } from "fs/promises";
import { dirname, resolve } from "path";
import { ReadOnlySqliteAdapter, SqliteInspection } from "../database-experiment/sqlite-readonly-adapter";
import { integrationC4SchemaSha256 } from "../database-integration/integration-c4-builder";
import { IntegrationC4Baseline } from "../database-integration/integration-c4-contract";

const SQLITE_HEADER = Buffer.from("SQLite format 3\u0000", "utf8");
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

export type GameDbSqliteCompatibilityStatus =
    | "exact_profile_match"
    | "schema_compatible_but_evidence_refresh_required"
    | "incompatible"
    | "unknown";

export interface GameDbSqliteCompatibilityReport {
    schemaVersion: 1,
    contract: "dokkan-game-db-sqlite-compatibility",
    contractVersion: "1.0.0",
    status: GameDbSqliteCompatibilityStatus,
    acquiredArtifactState: "readable_sqlite" | "encrypted_or_packaged",
    c4Profile: {
        snapshotVersion: string,
        sourceDatabase: {
            expectedSha256: string,
            expectedSizeBytes: number,
            expectedTableCount: number,
            expectedSchemaSha256: string,
            actualSha256: string | null,
            actualSizeBytes: number | null,
            actualTableCount: number | null,
            actualSchemaSha256: string | null,
        },
        missingRequiredColumns: string[],
    },
    pinnedNativeEvidence: {
        nativeRuntimeSha256: string,
        nativeRuntimeSizeBytes: number,
        semanticInputs: IntegrationC4Baseline["semanticInputs"],
        evaluatedInThisStep: false,
        automaticReuseAuthorized: false,
    },
    nextPermittedStep:
        | "decrypt_locally_then_repeat_read_only_compatibility"
        | "run_c4_with_exact_pinned_elf_and_semantic_artifacts"
        | "refresh_bounded_native_evidence_then_review_c4_baseline"
        | "stop_incompatible_sqlite",
}

export interface GameDbSqliteCompatibilityOptions {
    sqlitePath: string,
    baselineFile?: string,
    outputFile?: string,
    pythonCommand?: string,
}

function defaultBaselinePath(): string {
    const adjacent = resolve(__dirname, "..", "database-integration", "integration-c4-baseline.json");
    return existsSync(adjacent)
        ? adjacent
        : resolve(process.cwd(), "database-integration", "integration-c4-baseline.json");
}

function assertBaseline(value: unknown): asserts value is IntegrationC4Baseline {
    const baseline = value as Partial<IntegrationC4Baseline> | null;
    if (!baseline || baseline.schemaVersion !== 1 || baseline.contractVersion !== "1.0.0") {
        throw new Error("Invalid C4 baseline contract");
    }
    if (!baseline.sourceDatabase || !SHA256_PATTERN.test(baseline.sourceDatabase.sha256)
        || !SHA256_PATTERN.test(baseline.sourceDatabase.schemaSha256)
        || !Number.isSafeInteger(baseline.sourceDatabase.sizeBytes) || baseline.sourceDatabase.sizeBytes <= 0
        || !Number.isSafeInteger(baseline.sourceDatabase.tableCount) || baseline.sourceDatabase.tableCount <= 0
        || !baseline.sourceDatabase.requiredTables || typeof baseline.sourceDatabase.requiredTables !== "object") {
        throw new Error("Invalid C4 SQLite profile");
    }
    if (!baseline.nativeRuntime || !SHA256_PATTERN.test(baseline.nativeRuntime.sha256)
        || !Number.isSafeInteger(baseline.nativeRuntime.sizeBytes) || baseline.nativeRuntime.sizeBytes <= 0) {
        throw new Error("Invalid C4 native profile");
    }
    for (const gate of ["DB48", "DB49", "DB50"] as const) {
        if (!baseline.semanticInputs?.[gate] || !SHA256_PATTERN.test(baseline.semanticInputs[gate].sha256)) {
            throw new Error(`Invalid C4 ${gate} evidence profile`);
        }
    }
}

function missingRequiredColumns(baseline: IntegrationC4Baseline, inspection: SqliteInspection): string[] {
    const actual = new Map(inspection.tables.map(table => [table.name, new Set(table.columns)]));
    const missing: string[] = [];
    for (const table of Object.keys(baseline.sourceDatabase.requiredTables).sort()) {
        for (const column of [...baseline.sourceDatabase.requiredTables[table]].sort()) {
            if (!actual.get(table)?.has(column)) missing.push(`${table}.${column}`);
        }
    }
    return missing;
}

export function evaluateGameDbSqliteCompatibility(input: {
    baseline: IntegrationC4Baseline,
    acquiredArtifactState: "readable_sqlite" | "encrypted_or_packaged",
    sourceDatabase?: { sha256: string, sizeBytes: number, inspection: SqliteInspection },
}): GameDbSqliteCompatibilityReport {
    assertBaseline(input.baseline);
    const source = input.sourceDatabase;
    if (input.acquiredArtifactState === "readable_sqlite" && !source) {
        throw new Error("Readable SQLite compatibility requires a source inspection");
    }
    if (source && (!SHA256_PATTERN.test(source.sha256) || !Number.isSafeInteger(source.sizeBytes) || source.sizeBytes <= 0)) {
        throw new Error("Invalid observed SQLite identity");
    }

    const schemaSha256 = source ? integrationC4SchemaSha256(source.inspection) : null;
    const missing = source ? missingRequiredColumns(input.baseline, source.inspection) : [];
    const exact = Boolean(source
        && source.sha256 === input.baseline.sourceDatabase.sha256
        && source.sizeBytes === input.baseline.sourceDatabase.sizeBytes
        && source.inspection.tableCount === input.baseline.sourceDatabase.tableCount
        && schemaSha256 === input.baseline.sourceDatabase.schemaSha256);
    const status: GameDbSqliteCompatibilityStatus = input.acquiredArtifactState === "encrypted_or_packaged"
        ? "unknown"
        : missing.length > 0
            ? "incompatible"
            : exact
                ? "exact_profile_match"
                : "schema_compatible_but_evidence_refresh_required";
    const nextPermittedStep: GameDbSqliteCompatibilityReport["nextPermittedStep"] = status === "unknown"
        ? "decrypt_locally_then_repeat_read_only_compatibility"
        : status === "exact_profile_match"
            ? "run_c4_with_exact_pinned_elf_and_semantic_artifacts"
            : status === "schema_compatible_but_evidence_refresh_required"
                ? "refresh_bounded_native_evidence_then_review_c4_baseline"
                : "stop_incompatible_sqlite";

    return {
        schemaVersion: 1,
        contract: "dokkan-game-db-sqlite-compatibility",
        contractVersion: "1.0.0",
        status,
        acquiredArtifactState: input.acquiredArtifactState,
        c4Profile: {
            snapshotVersion: input.baseline.snapshotVersion,
            sourceDatabase: {
                expectedSha256: input.baseline.sourceDatabase.sha256,
                expectedSizeBytes: input.baseline.sourceDatabase.sizeBytes,
                expectedTableCount: input.baseline.sourceDatabase.tableCount,
                expectedSchemaSha256: input.baseline.sourceDatabase.schemaSha256,
                actualSha256: source?.sha256 ?? null,
                actualSizeBytes: source?.sizeBytes ?? null,
                actualTableCount: source?.inspection.tableCount ?? null,
                actualSchemaSha256: schemaSha256,
            },
            missingRequiredColumns: missing,
        },
        pinnedNativeEvidence: {
            nativeRuntimeSha256: input.baseline.nativeRuntime.sha256,
            nativeRuntimeSizeBytes: input.baseline.nativeRuntime.sizeBytes,
            semanticInputs: input.baseline.semanticInputs,
            evaluatedInThisStep: false,
            automaticReuseAuthorized: false,
        },
        nextPermittedStep,
    };
}

async function sha256File(filePath: string): Promise<string> {
    const hash = createHash("sha256");
    await new Promise<void>((done, reject) => {
        const stream = createReadStream(filePath);
        stream.on("data", chunk => hash.update(chunk));
        stream.on("error", reject);
        stream.on("end", done);
    });
    return hash.digest("hex");
}

async function hasReadableSqliteHeader(filePath: string): Promise<boolean> {
    const handle = await open(filePath, "r");
    try {
        const header = Buffer.alloc(SQLITE_HEADER.length);
        const { bytesRead } = await handle.read(header, 0, header.length, 0);
        return bytesRead === header.length && header.equals(SQLITE_HEADER);
    } finally {
        await handle.close();
    }
}

export async function buildGameDbSqliteCompatibility(options: GameDbSqliteCompatibilityOptions): Promise<GameDbSqliteCompatibilityReport> {
    const sqlitePath = resolve(options.sqlitePath);
    const baseline = JSON.parse(await readFile(resolve(options.baselineFile ?? defaultBaselinePath()), "utf8")) as unknown;
    assertBaseline(baseline);
    if (!await hasReadableSqliteHeader(sqlitePath)) {
        return evaluateGameDbSqliteCompatibility({ baseline, acquiredArtifactState: "encrypted_or_packaged" });
    }
    const [metadata, sha256, inspection] = await Promise.all([
        stat(sqlitePath),
        sha256File(sqlitePath),
        new ReadOnlySqliteAdapter(sqlitePath, options.pythonCommand).inspect(),
    ]);
    if (!metadata.isFile()) throw new Error("SQLite input must be a regular file");
    return evaluateGameDbSqliteCompatibility({
        baseline,
        acquiredArtifactState: "readable_sqlite",
        sourceDatabase: { sha256, sizeBytes: metadata.size, inspection },
    });
}

export function parseGameDbSqliteCompatibilityArgs(argv: string[]): GameDbSqliteCompatibilityOptions {
    let sqlitePath: string | undefined;
    let baselineFile: string | undefined;
    let outputFile: string | undefined;
    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];
        const value = token.includes("=") ? token.slice(token.indexOf("=") + 1) : argv[++index];
        if (!value) throw new Error(`Missing value for ${token}`);
        if (token === "--sqlite-path" || token.startsWith("--sqlite-path=")) sqlitePath = value;
        else if (token === "--baseline-file" || token.startsWith("--baseline-file=")) baselineFile = value;
        else if (token === "--output-file" || token.startsWith("--output-file=")) outputFile = value;
        else throw new Error(`Unexpected argument: ${token}`);
    }
    if (!sqlitePath) throw new Error("Missing --sqlite-path");
    return { sqlitePath, baselineFile, outputFile };
}

async function writeReportAtomic(outputFile: string, report: GameDbSqliteCompatibilityReport): Promise<void> {
    const target = resolve(outputFile);
    const temporary = `${target}.tmp-${process.pid}`;
    await mkdir(dirname(target), { recursive: true });
    try {
        await writeFile(temporary, `${JSON.stringify(report, null, 2)}\n`, { flag: "wx" });
        await rename(temporary, target);
    } catch (error) {
        await unlink(temporary).catch(() => undefined);
        throw error;
    }
}

async function main(): Promise<void> {
    const options = parseGameDbSqliteCompatibilityArgs(process.argv.slice(2));
    const report = await buildGameDbSqliteCompatibility(options);
    if (options.outputFile) await writeReportAtomic(options.outputFile, report);
    console.log(JSON.stringify(report, null, 2));
}

if (require.main === module) {
    main().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}
