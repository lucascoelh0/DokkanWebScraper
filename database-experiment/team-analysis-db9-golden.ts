import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { resolve } from "path";
import { DatabaseTeamAnalysisDb9Dataset, Db9DispatchSlot, Db9NativeLayout } from "./team-analysis-db9-contract";

interface Fixture { enumValue: number, status: "identified" | "null", label?: string }
export function resolveDb9NativeLayoutPath(): string {
    return existsSync(resolve(__dirname, "native-runtime-layout.json")) ? resolve(__dirname, "native-runtime-layout.json") : resolve(__dirname, "..", "..", "database-experiment", "native-runtime-layout.json");
}
export async function readDb9NativeLayout(): Promise<Db9NativeLayout> {
    return JSON.parse(await readFile(resolveDb9NativeLayoutPath(), "utf8")) as Db9NativeLayout;
}
export async function validateDatabaseTeamAnalysisDb9Goldens(dataset: DatabaseTeamAnalysisDb9Dataset): Promise<{ fixtureCount: number, passed: number, failures: Array<{ fixture: string, issue: string }> }> {
    const path = existsSync(resolve(__dirname, "team-analysis-db9-golden-fixtures.json")) ? resolve(__dirname, "team-analysis-db9-golden-fixtures.json") : resolve(__dirname, "..", "..", "database-experiment", "team-analysis-db9-golden-fixtures.json");
    const parsed = JSON.parse(await readFile(path, "utf8")) as { schemaVersion: number, efficacy: Fixture[], causality: Fixture[] }; if (parsed.schemaVersion !== 1) throw new Error("Unsupported DB9 golden contract");
    const failures: Array<{ fixture: string, issue: string }> = []; const check = (kind: string, fixture: Fixture, slots: Db9DispatchSlot[]) => { const slot = slots[fixture.enumValue]; const name = `${kind}:${fixture.enumValue}`;
        if (!slot) failures.push({ fixture: name, issue: "slot missing" }); else { if (slot.status !== fixture.status) failures.push({ fixture: name, issue: `expected ${fixture.status}, got ${slot.status}` }); if (fixture.label && slot.minimumOperationLabel !== fixture.label) failures.push({ fixture: name, issue: `expected label ${fixture.label}, got ${slot.minimumOperationLabel}` }); if (slot.slotVma % 8 !== 0) failures.push({ fixture: name, issue: "slot VMA is not aligned" }); } };
    parsed.efficacy.forEach(value => check("efficacy", value, dataset.efficacyDispatchSlots)); parsed.causality.forEach(value => check("causality", value, dataset.causalityDispatchSlots));
    const fixtureCount = parsed.efficacy.length + parsed.causality.length; return { fixtureCount, passed: fixtureCount - failures.length, failures };
}
