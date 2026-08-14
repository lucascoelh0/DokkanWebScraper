"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseTaxonomyProjectionPublicShadowCli = void 0;
const taxonomy_projection_public_shadow_contract_1 = require("./taxonomy-projection-public-shadow-contract");
const taxonomy_projection_public_shadow_1 = require("./taxonomy-projection-public-shadow");
function valueOf(args, name) {
    const indexes = args.flatMap((value, index) => value === name ? [index] : []);
    if (indexes.length !== 1)
        throw new Error(indexes.length ? `duplicate ${name}` : `missing ${name}`);
    const value = args[indexes[0] + 1];
    if (!value || value.startsWith("--"))
        throw new Error(`missing value for ${name}`);
    return value;
}
function parseTaxonomyProjectionPublicShadowCli(args) {
    const allowed = new Set(["--opt-in-k41", "--remote-read-only", "--checked-at"]);
    for (let index = 0; index < args.length; index++) {
        if (!allowed.has(args[index]))
            throw new Error(`K41 unsupported argument ${args[index].slice(0, 128)}`);
        if (args[index] === "--checked-at")
            index++;
    }
    for (const flag of ["--opt-in-k41", "--remote-read-only"]) {
        if (args.filter(value => value === flag).length !== 1)
            throw new Error(`K41 requires exactly one ${flag}`);
    }
    return { optInK41: true, remoteReadOnly: true, checkedAt: valueOf(args, "--checked-at") };
}
exports.parseTaxonomyProjectionPublicShadowCli = parseTaxonomyProjectionPublicShadowCli;
async function main() {
    const result = await (0, taxonomy_projection_public_shadow_1.loadTaxonomyProjectionPublicShadow)(parseTaxonomyProjectionPublicShadowCli(process.argv.slice(2)));
    process.stdout.write(`${JSON.stringify(result.report, null, 2)}\n`);
}
if (require.main === module)
    main().catch(error => {
        console.error((error instanceof Error ? error.message : String(error)).slice(0, taxonomy_projection_public_shadow_contract_1.TAXONOMY_PROJECTION_PUBLIC_SHADOW_MAX_ERROR_LENGTH));
        process.exitCode = 1;
    });
//# sourceMappingURL=taxonomy-projection-public-shadow-run.js.map