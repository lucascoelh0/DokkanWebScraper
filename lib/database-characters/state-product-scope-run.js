"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseCharacterStateProductScopeCli = exports.serializeCharacterStateProductScopeReport = exports.runCharacterStateProductScopeAudit = void 0;
const shadow_source_1 = require("./shadow-source");
const state_product_scope_contract_1 = require("./state-product-scope-contract");
const state_product_scope_1 = require("./state-product-scope");
async function runCharacterStateProductScopeAudit(options) {
    if (options?.optIn !== true)
        throw new Error("K42 requires explicit opt-in");
    if (!options.sidecarRoot || !options.productionRoot || !options.fyiRoot)
        throw new Error("K42 requires all explicit roots");
    const loadOptions = {
        sidecarRoot: options.sidecarRoot,
        productionRoot: options.productionRoot,
        fyiRoot: options.fyiRoot,
    };
    const initial = await (0, shadow_source_1.loadCharacterShadowInputs)(loadOptions);
    const scope = (0, state_product_scope_1.evaluateCharacterStateProductScope)(initial);
    const reloaded = await (0, shadow_source_1.loadCharacterShadowInputs)(loadOptions);
    const fingerprintSha256 = (0, state_product_scope_1.assertCharacterStateProductScopeInputsUnchanged)(initial, reloaded);
    (0, state_product_scope_1.assertCharacterStateProductScopePins)(scope);
    return {
        schemaVersion: 1,
        contract: "dokkan-database-character-state-product-scope-audit",
        contractVersion: state_product_scope_contract_1.CHARACTER_STATE_PRODUCT_SCOPE_CONTRACT_VERSION,
        mode: "offline_local_explicit_opt_in_stdout_only",
        sources: {
            fingerprintSha256,
            sidecars: initial.sidecarIdentities,
            production: { sha256: initial.production.sha256, sizeBytes: initial.production.sizeBytes, topLevelCount: initial.production.topLevelCount },
            fyi: { sha256: initial.fyi.sha256, sizeBytes: initial.fyi.sizeBytes, topLevelCount: initial.fyi.topLevelCount },
        },
        policy: {
            structuralIdsOnly: true,
            sourceTextReadForScope: false,
            supportedOnly: true,
            unknownIncluded: false,
            partialIncluded: false,
            k7ProductionAgreementUsedAs: "coverage_only",
            characterArrayReturned: false,
            applyOrOverlayImplemented: false,
            authoritySelected: false,
            productionModified: false,
            writerImplemented: false,
            artifactWritten: false,
            publisherEnabled: false,
            networkEnabled: false,
            androidEnabled: false,
        },
        scope,
        inputIntegrity: {
            loadedByCharacterShadowSource: true,
            everyK1StateMatchedK0IdentityAndEvidence: true,
            sourcesReloadedAfterEvaluation: true,
            sourceIdentitiesMatchedAfterReload: true,
            structuralFingerprintMatchedAfterReload: true,
            reportHasTimestamp: false,
            boundedStructuralIdSamples: true,
        },
        readiness: {
            scopeAudit: "GO",
            nextSupportedOnlyProjection: "GO",
            productProjection: "NOT_EXECUTED",
            characterArray: "NO-GO",
            applyOrOverlay: "NO-GO",
            authority: "NO-GO",
            production: "NO-GO",
            writer: "NO-GO",
            publisher: "NO-GO",
            network: "NO-GO",
            android: "NO-GO",
            r2: "NO-GO",
            fyiRemoval: "NO-GO",
            dokkanInfoRemoval: "NO-GO",
        },
    };
}
exports.runCharacterStateProductScopeAudit = runCharacterStateProductScopeAudit;
function serializeCharacterStateProductScopeReport(report) {
    const serialized = `${JSON.stringify(report, null, 2)}\n`;
    if (Buffer.byteLength(serialized) >= state_product_scope_contract_1.CHARACTER_STATE_PRODUCT_SCOPE_MAX_REPORT_BYTES) {
        throw new Error("K42 report byte limit reached");
    }
    return serialized;
}
exports.serializeCharacterStateProductScopeReport = serializeCharacterStateProductScopeReport;
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
    const result = argumentValue(args, name);
    if (!result)
        throw new Error(`K42 requires ${name}`);
    return result;
}
function parseCharacterStateProductScopeCli(args) {
    const allowed = new Set(["--opt-in-k42", "--sidecar-root", "--production-root", "--fyi-root"]);
    for (let index = 0; index < args.length; index++) {
        const argument = args[index];
        if (!allowed.has(argument))
            throw new Error(`K42 unsupported argument ${argument}`);
        if (argument !== "--opt-in-k42") {
            const value = args[index + 1];
            if (!value || value.startsWith("--"))
                throw new Error(`missing value for ${argument}`);
            index++;
        }
    }
    if (args.filter(value => value === "--opt-in-k42").length !== 1)
        throw new Error("K42 requires exactly one --opt-in-k42");
    return {
        optIn: true,
        sidecarRoot: required(args, "--sidecar-root"),
        productionRoot: required(args, "--production-root"),
        fyiRoot: required(args, "--fyi-root"),
    };
}
exports.parseCharacterStateProductScopeCli = parseCharacterStateProductScopeCli;
async function run() {
    const report = await runCharacterStateProductScopeAudit(parseCharacterStateProductScopeCli(process.argv.slice(2)));
    process.stdout.write(serializeCharacterStateProductScopeReport(report));
}
if (require.main === module)
    run().catch(error => {
        console.error((error instanceof Error ? error.message : String(error)).slice(0, state_product_scope_contract_1.CHARACTER_STATE_PRODUCT_SCOPE_MAX_ERROR_LENGTH));
        process.exitCode = 1;
    });
//# sourceMappingURL=state-product-scope-run.js.map