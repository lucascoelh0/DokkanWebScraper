import { loadCharacterShadowInputs } from "./shadow-source";
import {
    CHARACTER_STATE_PRODUCT_SCOPE_CONTRACT_VERSION,
    CHARACTER_STATE_PRODUCT_SCOPE_MAX_ERROR_LENGTH,
    CHARACTER_STATE_PRODUCT_SCOPE_MAX_REPORT_BYTES,
    CharacterStateProductScopeReport,
} from "./state-product-scope-contract";
import {
    assertCharacterStateProductScopePins,
    evaluateCharacterStateProductScope,
    fingerprintCharacterStateProductScopeInputs,
} from "./state-product-scope";

export interface CharacterStateProductScopeRunOptions {
    optIn: true;
    sidecarRoot: string;
    productionRoot: string;
    fyiRoot: string;
}

export async function runCharacterStateProductScopeAudit(
    options: CharacterStateProductScopeRunOptions,
): Promise<CharacterStateProductScopeReport> {
    if (options?.optIn !== true) throw new Error("K42 requires explicit opt-in");
    if (!options.sidecarRoot || !options.productionRoot || !options.fyiRoot) throw new Error("K42 requires all explicit roots");
    const loadOptions = {
        sidecarRoot: options.sidecarRoot,
        productionRoot: options.productionRoot,
        fyiRoot: options.fyiRoot,
    };
    let initial: Awaited<ReturnType<typeof loadCharacterShadowInputs>> | undefined = await loadCharacterShadowInputs(loadOptions);
    const scope = evaluateCharacterStateProductScope(initial);
    const fingerprintSha256 = fingerprintCharacterStateProductScopeInputs(initial);
    const sources = {
        fingerprintSha256,
        sidecars: initial.sidecarIdentities,
        production: { sha256: initial.production.sha256, sizeBytes: initial.production.sizeBytes, topLevelCount: initial.production.topLevelCount },
        fyi: { sha256: initial.fyi.sha256, sizeBytes: initial.fyi.sizeBytes, topLevelCount: initial.fyi.topLevelCount },
    };
    initial = undefined;
    if (global.gc) global.gc();
    let reloaded: Awaited<ReturnType<typeof loadCharacterShadowInputs>> | undefined = await loadCharacterShadowInputs(loadOptions);
    const reloadedSources = {
        fingerprintSha256: fingerprintCharacterStateProductScopeInputs(reloaded),
        sidecars: reloaded.sidecarIdentities,
        production: { sha256: reloaded.production.sha256, sizeBytes: reloaded.production.sizeBytes, topLevelCount: reloaded.production.topLevelCount },
        fyi: { sha256: reloaded.fyi.sha256, sizeBytes: reloaded.fyi.sizeBytes, topLevelCount: reloaded.fyi.topLevelCount },
    };
    if (JSON.stringify(sources) !== JSON.stringify(reloadedSources)) throw new Error("K42 sources changed after evaluation");
    reloaded = undefined;
    if (global.gc) global.gc();
    assertCharacterStateProductScopePins(scope);

    return {
        schemaVersion: 1,
        contract: "dokkan-database-character-state-product-scope-audit",
        contractVersion: CHARACTER_STATE_PRODUCT_SCOPE_CONTRACT_VERSION,
        mode: "offline_local_explicit_opt_in_stdout_only",
        sources,
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

export function serializeCharacterStateProductScopeReport(report: CharacterStateProductScopeReport): string {
    const serialized = `${JSON.stringify(report, null, 2)}\n`;
    if (Buffer.byteLength(serialized) >= CHARACTER_STATE_PRODUCT_SCOPE_MAX_REPORT_BYTES) {
        throw new Error("K42 report byte limit reached");
    }
    return serialized;
}

function argumentValue(args: string[], name: string): string | undefined {
    const indexes = args.flatMap((value, index) => value === name ? [index] : []);
    if (indexes.length > 1) throw new Error(`duplicate ${name}`);
    if (!indexes.length) return undefined;
    const value = args[indexes[0] + 1];
    if (!value || value.startsWith("--")) throw new Error(`missing value for ${name}`);
    return value;
}

function required(args: string[], name: string): string {
    const result = argumentValue(args, name);
    if (!result) throw new Error(`K42 requires ${name}`);
    return result;
}

export function parseCharacterStateProductScopeCli(args: string[]): CharacterStateProductScopeRunOptions {
    const allowed = new Set(["--opt-in-k42", "--sidecar-root", "--production-root", "--fyi-root"]);
    for (let index = 0; index < args.length; index++) {
        const argument = args[index];
        if (!allowed.has(argument)) throw new Error(`K42 unsupported argument ${argument}`);
        if (argument !== "--opt-in-k42") {
            const value = args[index + 1];
            if (!value || value.startsWith("--")) throw new Error(`missing value for ${argument}`);
            index++;
        }
    }
    if (args.filter(value => value === "--opt-in-k42").length !== 1) throw new Error("K42 requires exactly one --opt-in-k42");
    return {
        optIn: true,
        sidecarRoot: required(args, "--sidecar-root"),
        productionRoot: required(args, "--production-root"),
        fyiRoot: required(args, "--fyi-root"),
    };
}

async function run(): Promise<void> {
    const report = await runCharacterStateProductScopeAudit(parseCharacterStateProductScopeCli(process.argv.slice(2)));
    process.stdout.write(serializeCharacterStateProductScopeReport(report));
}

if (require.main === module) run().catch(error => {
    console.error((error instanceof Error ? error.message : String(error)).slice(0, CHARACTER_STATE_PRODUCT_SCOPE_MAX_ERROR_LENGTH));
    process.exitCode = 1;
});
