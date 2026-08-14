"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseTaxonomyProjectionRemotePreflightCli = void 0;
const taxonomy_projection_remote_preflight_contract_1 = require("./taxonomy-projection-remote-preflight-contract");
const taxonomy_projection_remote_preflight_1 = require("./taxonomy-projection-remote-preflight");
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
function parseTaxonomyProjectionRemotePreflightCli(args) {
    const switches = ["--opt-in-k38", "--remote-read-only"];
    const allowed = new Set([...switches, ...VALUE_ARGUMENTS]);
    for (let index = 0; index < args.length; index++) {
        const argument = args[index];
        if (!allowed.has(argument))
            throw new Error(`K38 unsupported argument ${argument.slice(0, 128)}`);
        if (VALUE_ARGUMENTS.includes(argument)) {
            const value = args[index + 1];
            if (!value || value.startsWith("--"))
                throw new Error(`missing value for ${argument}`);
            index++;
        }
    }
    for (const flag of switches) {
        if (args.filter(value => value === flag).length !== 1)
            throw new Error(`K38 requires exactly one ${flag}`);
    }
    return {
        optInK38: true,
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
exports.parseTaxonomyProjectionRemotePreflightCli = parseTaxonomyProjectionRemotePreflightCli;
async function main() {
    const result = await (0, taxonomy_projection_remote_preflight_1.runTaxonomyProjectionRemotePreflight)(parseTaxonomyProjectionRemotePreflightCli(process.argv.slice(2)));
    process.stdout.write(`${JSON.stringify({
        planId: result.report.planId,
        checkedAt: result.report.checkedAt,
        reportDirectory: result.reportDirectory,
        reportSha256: result.reportSha256,
        objectSummary: result.report.objectSummary,
        manifest: result.report.manifest,
        bucketUsage: result.report.bucketUsage,
        budget: result.report.budget,
        readiness: result.report.readiness,
    }, null, 2)}\n`);
    if (result.report.readiness.readOnlyRemotePreflight !== "GO")
        process.exitCode = 2;
}
if (require.main === module)
    main().catch(error => {
        const message = (error instanceof Error ? error.message : String(error))
            .slice(0, taxonomy_projection_remote_preflight_contract_1.TAXONOMY_PROJECTION_REMOTE_PREFLIGHT_MAX_ERROR_LENGTH);
        console.error(`K38 failed: ${message}`);
        process.exitCode = 1;
    });
//# sourceMappingURL=taxonomy-projection-remote-preflight-run.js.map