"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseStructuralAuthorityCli = exports.runStructuralAuthorityAudit = exports.measureStructuralAuthorityReportIdentity = void 0;
const crypto_1 = require("crypto");
const structural_authority_builder_1 = require("./structural-authority-builder");
const structural_authority_source_1 = require("./structural-authority-source");
const RSS_LIMIT_BYTES = 1073741824;
function measureStructuralAuthorityReportIdentity(report, sampleMemory) {
    const serialized = `${JSON.stringify(report)}\n`;
    sampleMemory();
    return { sha256: (0, crypto_1.createHash)("sha256").update(serialized, "utf8").digest("hex"), sizeBytes: Buffer.byteLength(serialized) };
}
exports.measureStructuralAuthorityReportIdentity = measureStructuralAuthorityReportIdentity;
async function runStructuralAuthorityAudit(options) {
    if (options?.optIn !== true)
        throw new Error("K29-K31 requires explicit opt-in");
    let peakRssBytes = process.memoryUsage().rss;
    const sampleMemory = () => {
        peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss);
        if (peakRssBytes >= RSS_LIMIT_BYTES)
            throw new Error(`K29-K31 RSS budget exceeded: ${peakRssBytes}`);
    };
    const source = await (0, structural_authority_source_1.loadStructuralAuthorityGenerationSource)(options);
    sampleMemory();
    const generate = async () => {
        const builder = new structural_authority_builder_1.StructuralAuthorityAuditBuilder();
        await source.streamFields(field => builder.accept(field));
        sampleMemory();
        const report = builder.finish(source.taxonomy, source.productiveIndex, source.lineage, source.generatedAt);
        sampleMemory();
        await source.revalidate();
        sampleMemory();
        return report;
    };
    let first = await generate();
    const firstIdentity = measureStructuralAuthorityReportIdentity(first, sampleMemory);
    first = undefined;
    if (global.gc)
        global.gc();
    sampleMemory();
    const second = await generate();
    const secondIdentity = measureStructuralAuthorityReportIdentity(second, sampleMemory);
    sampleMemory();
    if (firstIdentity.sizeBytes !== secondIdentity.sizeBytes || firstIdentity.sha256 !== secondIdentity.sha256) {
        throw new Error("K29-K31 audit generation is not byte deterministic");
    }
    return { report: second, reportSha256: secondIdentity.sha256, reportSizeBytes: secondIdentity.sizeBytes, twoGenerationByteIdentical: true, peakRssBytes };
}
exports.runStructuralAuthorityAudit = runStructuralAuthorityAudit;
function argumentValue(args, name) {
    const indexes = args.flatMap((value, index) => value === name ? [index] : []);
    if (indexes.length > 1)
        throw new Error(`duplicate ${name}`);
    if (!indexes.length)
        return undefined;
    const value = args[indexes[0] + 1];
    if (!value || value.startsWith("--"))
        throw new Error(`missing value for ${name}`);
    return value;
}
function requiredArgumentValue(args, name) {
    const value = argumentValue(args, name);
    if (!value)
        throw new Error(`K29-K31 requires ${name}`);
    return value;
}
function parseStructuralAuthorityCli(args) {
    const allowed = new Set(["--opt-in-k29-k31", "--shadow-root", "--k2-root", "--productive-root"]);
    for (let index = 0; index < args.length; index++) {
        const argument = args[index];
        if (!allowed.has(argument))
            throw new Error(`K29-K31 unsupported argument ${argument}`);
        if (argument !== "--opt-in-k29-k31") {
            const value = args[index + 1];
            if (!value || value.startsWith("--"))
                throw new Error(`missing value for ${argument}`);
            index++;
        }
    }
    if (args.filter(value => value === "--opt-in-k29-k31").length !== 1)
        throw new Error("K29-K31 requires one explicit --opt-in-k29-k31");
    return {
        optIn: true,
        shadowRoot: requiredArgumentValue(args, "--shadow-root"),
        k2Root: requiredArgumentValue(args, "--k2-root"),
        productiveRoot: requiredArgumentValue(args, "--productive-root"),
    };
}
exports.parseStructuralAuthorityCli = parseStructuralAuthorityCli;
async function run() {
    const result = await runStructuralAuthorityAudit(parseStructuralAuthorityCli(process.argv.slice(2)));
    const { report } = result;
    console.log(JSON.stringify({
        schemaVersion: report.schemaVersion,
        contract: report.contract,
        contractVersion: report.contractVersion,
        generatedAt: report.generatedAt,
        reportSha256: result.reportSha256,
        reportSizeBytes: result.reportSizeBytes,
        twoGenerationByteIdentical: result.twoGenerationByteIdentical,
        peakRssBytes: result.peakRssBytes,
        source: report.source,
        policy: report.policy,
        inventory: report.inventory,
        fields: report.fields,
        collectionComparisons: report.collectionComparisons,
        readiness: report.readiness,
    }, null, 2));
}
if (require.main === module)
    run().catch(error => { console.error(error); process.exitCode = 1; });
//# sourceMappingURL=structural-authority-run.js.map