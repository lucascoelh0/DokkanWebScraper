"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseTaxonomyProjectionPublisherDryRunCli = void 0;
const taxonomy_projection_publisher_dry_run_contract_1 = require("./taxonomy-projection-publisher-dry-run-contract");
const taxonomy_projection_publisher_dry_run_1 = require("./taxonomy-projection-publisher-dry-run");
const VALUE_ARGUMENTS = [
    "--k37-output-root",
    "--k37-plan-id",
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
    "--checked-at",
];
function valueOf(args, name) {
    const indexes = args.flatMap((value, index) => value === name ? [index] : []);
    if (indexes.length !== 1)
        throw new Error(indexes.length ? `duplicate ${name}` : `missing ${name}`);
    const value = args[indexes[0] + 1];
    if (!value || value.startsWith("--"))
        throw new Error(`missing value for ${name}`);
    return value;
}
function parseTaxonomyProjectionPublisherDryRunCli(args) {
    const switches = ["--opt-in-k39", "--dry-run-only", "--remote-read-only"];
    const allowed = new Set([...switches, ...VALUE_ARGUMENTS]);
    for (let index = 0; index < args.length; index++) {
        const argument = args[index];
        if (!allowed.has(argument))
            throw new Error(`K39 unsupported argument ${argument.slice(0, 128)}`);
        if (VALUE_ARGUMENTS.includes(argument)) {
            const value = args[index + 1];
            if (!value || value.startsWith("--"))
                throw new Error(`missing value for ${argument}`);
            index++;
        }
    }
    for (const flag of switches) {
        if (args.filter(value => value === flag).length !== 1)
            throw new Error(`K39 requires exactly one ${flag}`);
    }
    return {
        optInK39: true,
        dryRunOnly: true,
        remoteReadOnly: true,
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
}
exports.parseTaxonomyProjectionPublisherDryRunCli = parseTaxonomyProjectionPublisherDryRunCli;
async function main() {
    const result = await (0, taxonomy_projection_publisher_dry_run_1.runTaxonomyProjectionPublisherDryRun)(parseTaxonomyProjectionPublisherDryRunCli(process.argv.slice(2)));
    process.stdout.write(`${JSON.stringify({
        planId: result.report.planId,
        k36ReleaseId: result.report.k36ReleaseId,
        checkedAt: result.report.checkedAt,
        reportDirectory: result.reportDirectory,
        reportSha256: result.reportSha256,
        immutableActions: result.report.remote.immutableActions.map(action => ({
            order: action.order, kind: action.kind, action: action.action, objectKey: action.objectKey,
        })),
        mutableManifest: result.report.remote.mutableManifest,
        k38BucketUsage: result.report.k38BucketUsage,
        k38Budget: result.report.k38Budget,
        readiness: result.report.readiness,
    }, null, 2)}\n`);
}
if (require.main === module)
    main().catch(error => {
        const message = (error instanceof Error ? error.message : String(error))
            .slice(0, taxonomy_projection_publisher_dry_run_contract_1.TAXONOMY_PROJECTION_PUBLISHER_DRY_RUN_MAX_ERROR_LENGTH);
        console.error(`K39 failed: ${message}`);
        process.exitCode = 1;
    });
//# sourceMappingURL=taxonomy-projection-publisher-dry-run-run.js.map