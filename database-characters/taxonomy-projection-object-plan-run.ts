import { createHash } from "crypto";
import { TAXONOMY_PROJECTION_OBJECT_PLAN_MAX_ERROR_LENGTH } from "./taxonomy-projection-object-plan-contract";
import {
    TaxonomyProjectionObjectPlanRunOptions,
    runTaxonomyProjectionObjectPlan,
} from "./taxonomy-projection-object-plan";

const VALUE_ARGUMENTS = [
    "--k36-output-root",
    "--k36-release-id",
    "--k32-root",
    "--k2-root",
    "--productive-root",
    "--sqlite-root",
    "--db1-root",
    "--elf-root",
    "--native-evidence-root",
    "--output-root",
] as const;

function argumentValue(args: string[], name: string): string {
    const indexes = args.flatMap((value, index) => value === name ? [index] : []);
    if (indexes.length !== 1) throw new Error(indexes.length ? `duplicate ${name}` : `missing ${name}`);
    const value = args[indexes[0] + 1];
    if (!value || value.startsWith("--")) throw new Error(`missing value for ${name}`);
    return value;
}

export function parseTaxonomyProjectionObjectPlanCli(args: string[]): TaxonomyProjectionObjectPlanRunOptions {
    const allowed = new Set<string>(["--opt-in-k37", ...VALUE_ARGUMENTS]);
    for (let index = 0; index < args.length; index++) {
        const argument = args[index];
        if (!allowed.has(argument)) throw new Error(`K37 unsupported argument ${argument.slice(0, 128)}`);
        if (argument !== "--opt-in-k37") {
            const value = args[index + 1];
            if (!value || value.startsWith("--")) throw new Error(`missing value for ${argument}`);
            index++;
        }
    }
    if (args.filter(value => value === "--opt-in-k37").length !== 1) {
        throw new Error("K37 requires exactly one --opt-in-k37");
    }
    return {
        optIn: true,
        k36OutputRoot: argumentValue(args, "--k36-output-root"),
        k36ReleaseId: argumentValue(args, "--k36-release-id"),
        k32Root: argumentValue(args, "--k32-root"),
        k2Root: argumentValue(args, "--k2-root"),
        productiveRoot: argumentValue(args, "--productive-root"),
        sqliteRoot: argumentValue(args, "--sqlite-root"),
        db1Root: argumentValue(args, "--db1-root"),
        elfRoot: argumentValue(args, "--elf-root"),
        nativeEvidenceRoot: argumentValue(args, "--native-evidence-root"),
        outputRoot: argumentValue(args, "--output-root"),
    };
}

async function run(): Promise<void> {
    const result = await runTaxonomyProjectionObjectPlan(parseTaxonomyProjectionObjectPlanCli(process.argv.slice(2)));
    const json = (value: unknown): Buffer => Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
    const sha256 = (value: Buffer): string => createHash("sha256").update(value).digest("hex");
    process.stdout.write(`${JSON.stringify({
        planDirectory: result.planDirectory,
        planId: result.planId,
        planSha256: sha256(json(result.plan)),
        manifestCandidateSha256: sha256(json(result.manifestCandidate)),
        receiptSha256: sha256(json(result.receipt)),
        objectCount: result.plan.objects.length,
        worstCaseNewBytes: result.plan.budget.worstCaseNewBytes,
        withinBucketCeiling: result.plan.budget.withinBucketCeiling,
        state: result.receipt.state,
        readiness: result.receipt.readiness,
        peakRssBytes: result.peakRssBytes,
    }, null, 2)}\n`);
}

if (require.main === module) run().catch(error => {
    const message = `K37 failed: ${error instanceof Error ? error.message : String(error)}`
        .slice(0, TAXONOMY_PROJECTION_OBJECT_PLAN_MAX_ERROR_LENGTH);
    console.error(message);
    process.exitCode = 1;
});
