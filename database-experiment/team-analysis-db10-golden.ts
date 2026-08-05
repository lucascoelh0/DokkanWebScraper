import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { resolve } from "path";
import { DatabaseTeamAnalysisDb10Dataset, Db10Comparator, Db10NativeSemanticsLayout, Db10ParameterColumn, Db10SemanticStatus } from "./team-analysis-db10-contract";

interface Fixture {
    name: string, causalityType: number, status: Db10SemanticStatus, comparator: Db10Comparator, occurrenceCount: number,
    parameterReads: Db10ParameterColumn[], ignoredParameters: Db10ParameterColumn[], requiredUnknown?: string, gate?: "appearance_initialized",
}
function sourcePath(fileName: string): string {
    return existsSync(resolve(__dirname, fileName)) ? resolve(__dirname, fileName) : resolve(__dirname, "..", "..", "database-experiment", fileName);
}
export function resolveDb10NativeSemanticsPath(): string { return sourcePath("native-runtime-semantics.json"); }
export function parseDb10NativeSemantics(value: Buffer | string): Db10NativeSemanticsLayout { return JSON.parse(value.toString()) as Db10NativeSemanticsLayout; }
export async function readDb10NativeSemantics(): Promise<Db10NativeSemanticsLayout> { return parseDb10NativeSemantics(await readFile(resolveDb10NativeSemanticsPath())); }
export async function validateDatabaseTeamAnalysisDb10Goldens(dataset: DatabaseTeamAnalysisDb10Dataset): Promise<{ fixtureCount: number, passed: number, failures: Array<{ fixture: string, issue: string }> }> {
    const parsed = JSON.parse(await readFile(sourcePath("team-analysis-db10-golden-fixtures.json"), "utf8")) as { schemaVersion: number, fixtures: Fixture[] };
    if (parsed.schemaVersion !== 1) throw new Error("Unsupported DB10 golden contract");
    const failures: Array<{ fixture: string, issue: string }> = [];
    for (const fixture of parsed.fixtures) {
        const value = dataset.causalityResolutions.find(candidate => candidate.causalityType === fixture.causalityType);
        const fail = (issue: string) => failures.push({ fixture: fixture.name, issue });
        if (!value) { fail("resolution missing"); continue; }
        if (value.status !== fixture.status) fail(`expected status ${fixture.status}, got ${value.status}`);
        if (value.comparator !== fixture.comparator) fail(`expected comparator ${fixture.comparator}, got ${value.comparator}`);
        if (value.occurrenceCount !== fixture.occurrenceCount) fail(`expected ${fixture.occurrenceCount} occurrences, got ${value.occurrenceCount}`);
        if (JSON.stringify(value.parameterReads) !== JSON.stringify(fixture.parameterReads)) fail("parameter reads differ");
        if (JSON.stringify(value.ignoredParameters) !== JSON.stringify(fixture.ignoredParameters)) fail("ignored parameters differ");
        if (fixture.requiredUnknown && !value.unknowns.includes(fixture.requiredUnknown)) fail(`missing unknown ${fixture.requiredUnknown}`);
        if (fixture.gate && value.gate !== fixture.gate) fail(`expected gate ${fixture.gate}, got ${value.gate}`);
        if (value.provenance.runtime.codeSha256.length !== 64) fail("runtime code hash missing");
    }
    if (dataset.semanticPromotionCount !== 3) failures.push({ fixture: "promotion invariant", issue: "semantic promotion count changed" });
    const fixtureCount = parsed.fixtures.length + 1; return { fixtureCount, passed: fixtureCount - failures.length, failures };
}
