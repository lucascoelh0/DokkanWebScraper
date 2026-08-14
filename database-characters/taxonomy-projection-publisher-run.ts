import { TAXONOMY_PROJECTION_PUBLISHER_MAX_ERROR_LENGTH } from "./taxonomy-projection-publisher-contract";
import { TaxonomyProjectionPublisherOptions, runTaxonomyProjectionPublisher } from "./taxonomy-projection-publisher";

const COMMON_VALUE_ARGUMENTS = [
    "--k37-output-root", "--k37-plan-id", "--k36-output-root", "--k36-release-id",
    "--k32-root", "--k2-root", "--productive-root", "--sqlite-root", "--db1-root",
    "--elf-root", "--native-evidence-root", "--output-root", "--checked-at",
] as const;
const CONFIRM = "--confirm-publication-id" as const;

function valueOf(args: string[], name: typeof COMMON_VALUE_ARGUMENTS[number] | typeof CONFIRM): string {
    const indexes = args.flatMap((value, index) => value === name ? [index] : []);
    if (indexes.length !== 1) throw new Error(indexes.length ? `duplicate ${name}` : `missing ${name}`);
    const value = args[indexes[0] + 1];
    if (!value || value.startsWith("--")) throw new Error(`missing value for ${name}`);
    return value;
}

export function parseTaxonomyProjectionPublisherCli(args: string[]): TaxonomyProjectionPublisherOptions {
    const switches = ["--opt-in-k40", "--remote", "--dry-run", "--publish"] as const;
    const allowed = new Set<string>([...switches, ...COMMON_VALUE_ARGUMENTS, CONFIRM]);
    for (let index = 0; index < args.length; index++) {
        const argument = args[index];
        if (!allowed.has(argument)) throw new Error(`K40 unsupported argument ${argument.slice(0, 128)}`);
        if ((COMMON_VALUE_ARGUMENTS as readonly string[]).includes(argument) || argument === CONFIRM) {
            const value = args[index + 1];
            if (!value || value.startsWith("--")) throw new Error(`missing value for ${argument}`);
            index++;
        }
    }
    for (const flag of ["--opt-in-k40", "--remote"] as const) {
        if (args.filter(value => value === flag).length !== 1) throw new Error(`K40 requires exactly one ${flag}`);
    }
    const dryRunCount = args.filter(value => value === "--dry-run").length;
    const publishCount = args.filter(value => value === "--publish").length;
    if (dryRunCount + publishCount !== 1) throw new Error("K40 requires exactly one --dry-run or --publish");
    const confirmCount = args.filter(value => value === CONFIRM).length;
    if (dryRunCount === 1 && confirmCount !== 0) throw new Error("K40 dry-run forbids --confirm-publication-id");
    if (publishCount === 1 && confirmCount !== 1) {
        throw new Error("K40 publish requires exactly one --confirm-publication-id");
    }
    const common = {
        k37OutputRoot: valueOf(args, "--k37-output-root"),
        k37PlanId: valueOf(args, "--k37-plan-id"),
        k36OutputRoot: valueOf(args, "--k36-output-root"),
        k36ReleaseId: valueOf(args, "--k36-release-id"),
        k32Root: valueOf(args, "--k32-root"),
        k2Root: valueOf(args, "--k2-root"),
        productiveRoot: valueOf(args, "--productive-root"),
        sqliteRoot: valueOf(args, "--sqlite-root"),
        db1Root: valueOf(args, "--db1-root"),
        elfRoot: valueOf(args, "--elf-root"),
        nativeEvidenceRoot: valueOf(args, "--native-evidence-root"),
        outputRoot: valueOf(args, "--output-root"),
        checkedAt: valueOf(args, "--checked-at"),
    };
    if (publishCount === 1) {
        const confirmPublicationId = valueOf(args, CONFIRM);
        if (!/^[a-f0-9]{64}$/.test(confirmPublicationId)) {
            throw new Error("K40 --confirm-publication-id must be canonical 64-hex");
        }
        return { optInK40: true, remote: true, mode: "publish", confirmPublicationId, ...common };
    }
    return { optInK40: true, remote: true, mode: "dry-run", ...common };
}

async function main(): Promise<void> {
    const result = await runTaxonomyProjectionPublisher(parseTaxonomyProjectionPublisherCli(process.argv.slice(2)));
    process.stdout.write(`${JSON.stringify({
        publicationId: result.publicationId,
        reportDirectory: result.reportDirectory,
        reportSha256: result.reportSha256,
        checkedAt: result.report.checkedAt,
        current: result.report.current,
        readiness: result.report.readiness,
        publication: result.publication,
    }, null, 2)}\n`);
}

if (require.main === module) main().catch(error => {
    const message = (error instanceof Error ? error.message : String(error))
        .slice(0, TAXONOMY_PROJECTION_PUBLISHER_MAX_ERROR_LENGTH);
    console.error(`K40 failed: ${message}`);
    process.exitCode = 1;
});
