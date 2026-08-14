"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseCharacterStructuralShadowCli = exports.runCharacterStructuralShadow = void 0;
const structural_sidecar_contract_1 = require("./structural-sidecar-contract");
const structural_sidecar_validator_1 = require("./structural-sidecar-validator");
const structural_shadow_contract_1 = require("./structural-shadow-contract");
const structural_shadow_source_1 = require("./structural-shadow-source");
class RssGuard {
    peak = process.memoryUsage().rss;
    exceeded = false;
    timer = setInterval(() => this.observe(), 10);
    constructor() { this.timer.unref(); }
    observe() {
        this.peak = Math.max(this.peak, process.memoryUsage().rss);
        this.exceeded ||= this.peak >= structural_shadow_contract_1.CHARACTER_STRUCTURAL_SHADOW_RSS_LIMIT_BYTES;
    }
    sample() {
        this.observe();
        if (this.exceeded)
            throw new Error(`K33 RSS limit reached: ${this.peak}`);
    }
    stop() {
        clearInterval(this.timer);
        this.sample();
    }
    dispose() { clearInterval(this.timer); }
}
function sameValidatedK32(before, after) {
    return JSON.stringify(before.manifest) === JSON.stringify(after.manifest)
        && JSON.stringify(before.sidecar) === JSON.stringify(after.sidecar)
        && JSON.stringify(before.coverage) === JSON.stringify(after.coverage)
        && JSON.stringify(before.validation) === JSON.stringify(after.validation)
        && JSON.stringify(before.sourceBoundValidation) === JSON.stringify(after.sourceBoundValidation);
}
function sources(manifest) {
    const pin = structural_sidecar_contract_1.CHARACTER_STRUCTURAL_SIDECAR_SOURCE_PIN;
    return {
        k32: {
            contract: manifest.contract,
            contractVersion: manifest.contractVersion,
            datasetVersion: manifest.datasetVersion,
            payloadSha256: manifest.sha256,
            payloadSizeBytes: manifest.sizeBytes,
            uncompressedSha256: manifest.uncompressedSha256,
            uncompressedSizeBytes: manifest.uncompressedSizeBytes,
            recordCount: manifest.recordCount,
            k2SnapshotVersion: manifest.source.snapshotVersion,
            k2PayloadSha256: manifest.source.k2.payloadSha256,
        },
        productiveCharacters: {
            contract: "Character[]",
            datasetVersion: pin.productiveCharacters.datasetVersion,
            manifestFile: pin.productiveCharacters.manifestFile,
            manifestSha256: pin.productiveCharacters.manifestSha256,
            manifestSizeBytes: pin.productiveCharacters.manifestSizeBytes,
            payloadFile: pin.productiveCharacters.localPayloadFile,
            payloadSha256: pin.productiveCharacters.payloadSha256,
            payloadSizeBytes: pin.productiveCharacters.payloadSizeBytes,
            uncompressedSizeBytes: pin.productiveCharacters.uncompressedSizeBytes,
            topLevelCount: pin.productiveCharacters.topLevelCount,
        },
    };
}
async function runCharacterStructuralShadow(options) {
    if (options?.optIn !== true)
        throw new Error("K33 requires explicit opt-in");
    if (!options.k32Root || !options.k2Root || !options.productiveRoot) {
        throw new Error("K33 requires explicit k32Root, k2Root and productiveRoot");
    }
    const rss = new RssGuard();
    try {
        const validatedBefore = await (0, structural_sidecar_validator_1.validateCharacterStructuralSidecarArtifact)({
            artifactRoot: options.k32Root,
            k2Root: options.k2Root,
            productiveRoot: options.productiveRoot,
        });
        rss.sample();
        const productive = await (0, structural_shadow_source_1.loadCharacterStructuralShadowProductiveSource)(options.productiveRoot);
        let firstEvaluation;
        try {
            rss.sample();
            firstEvaluation = productive.evaluate(validatedBefore.sidecar);
            const firstBytes = Buffer.from(JSON.stringify(firstEvaluation), "utf8");
            const secondEvaluation = productive.evaluate(validatedBefore.sidecar);
            const secondBytes = Buffer.from(JSON.stringify(secondEvaluation), "utf8");
            if (!firstBytes.equals(secondBytes))
                throw new Error("K33 double evaluation was not byte-identical");
            await productive.revalidate();
        }
        finally {
            productive.dispose();
        }
        if (global.gc)
            global.gc();
        rss.sample();
        const validatedAfter = await (0, structural_sidecar_validator_1.validateCharacterStructuralSidecarArtifact)({
            artifactRoot: options.k32Root,
            k2Root: options.k2Root,
            productiveRoot: options.productiveRoot,
        });
        if (!sameValidatedK32(validatedBefore, validatedAfter))
            throw new Error("K33 K32 input changed during shadow evaluation");
        rss.stop();
        return {
            schemaVersion: 1,
            contract: "dokkan-database-character-structural-shadow-report",
            contractVersion: structural_shadow_contract_1.CHARACTER_STRUCTURAL_SHADOW_CONTRACT_VERSION,
            generatedAt: validatedBefore.manifest.generatedAt,
            mode: "offline_explicit_opt_in_shadow",
            sources: sources(validatedBefore.manifest),
            policy: {
                explicitOptIn: true,
                offlineOnly: true,
                reportOnly: true,
                joinKey: "cardId",
                namesOrLabelsAsJoinKeys: false,
                productiveStateBinding: "unavailable",
                stateInferredFromEzaOrSezaFields: false,
                presentationLabelsUsedOnlyForComparison: true,
                orderPreserved: true,
                assignmentsDeduplicated: false,
                assignmentsCanonicalized: false,
                activeLinksComputed: false,
                sharedLinksComputed: false,
                authoritySelected: false,
                effectiveValuesChanged: false,
                characterArrayReturned: false,
                artifactWritten: false,
                exampleLimitPerDimension: structural_shadow_contract_1.CHARACTER_STRUCTURAL_SHADOW_EXAMPLE_LIMIT,
                rssLimitBytesExclusive: structural_shadow_contract_1.CHARACTER_STRUCTURAL_SHADOW_RSS_LIMIT_BYTES,
            },
            ...firstEvaluation,
            inputIntegrity: {
                k32ValidatedOnlyBySourceBoundApi: true,
                k32SourceBoundStatus: "GO",
                k32SourceRootsRevalidatedBeforeAndAfter: true,
                k32ExactArtifactBytesMatched: true,
                productiveManifestAndPayloadPinned: true,
                productiveContainedPaths: true,
                productiveRegularNonLinkSingleLinkHandleSnapshots: true,
                productiveDecompressionBoundedToPinnedSize: true,
                productiveSnapshotRevalidatedBeforeAndAfter: true,
                inputsNotMutated: true,
                doubleEvaluationByteIdentical: true,
                rssStayedBelowLimit: true,
            },
            readiness: {
                offlineShadowConsumer: "GO",
                stateLineage: "NO-GO",
                authorityPromotion: "NO-GO",
                apply: "NO-GO",
                production: "NO-GO",
                publisher: "NO-GO",
                r2: "NO-GO",
                android: "NO-GO",
                fyiRemoval: "NO-GO",
                dokkanInfoRemoval: "NO-GO",
            },
        };
    }
    finally {
        rss.dispose();
    }
}
exports.runCharacterStructuralShadow = runCharacterStructuralShadow;
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
function required(args, name) {
    const value = argumentValue(args, name);
    if (!value)
        throw new Error(`K33 requires ${name}`);
    return value;
}
function parseCharacterStructuralShadowCli(args) {
    const allowed = new Set(["--opt-in-k33", "--k32-root", "--k2-root", "--productive-root"]);
    for (let index = 0; index < args.length; index++) {
        const argument = args[index];
        if (!allowed.has(argument))
            throw new Error(`K33 unsupported argument ${argument}`);
        if (argument !== "--opt-in-k33") {
            const value = args[index + 1];
            if (!value || value.startsWith("--"))
                throw new Error(`missing value for ${argument}`);
            index++;
        }
    }
    if (args.filter(value => value === "--opt-in-k33").length !== 1) {
        throw new Error("K33 requires exactly one --opt-in-k33");
    }
    return {
        optIn: true,
        k32Root: required(args, "--k32-root"),
        k2Root: required(args, "--k2-root"),
        productiveRoot: required(args, "--productive-root"),
    };
}
exports.parseCharacterStructuralShadowCli = parseCharacterStructuralShadowCli;
async function run() {
    const report = await runCharacterStructuralShadow(parseCharacterStructuralShadowCli(process.argv.slice(2)));
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}
if (require.main === module)
    run().catch(error => { console.error(error); process.exitCode = 1; });
//# sourceMappingURL=structural-shadow-run.js.map