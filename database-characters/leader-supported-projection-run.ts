import { createHash } from "crypto";
import {
    CHARACTER_LEADER_SUPPORTED_PROJECTION_METADATA_LIMIT_BYTES,
    CHARACTER_LEADER_SUPPORTED_PROJECTION_RSS_LIMIT_BYTES,
    CharacterLeaderSupportedProjectionCoverage,
    CharacterLeaderSupportedProjectionManifest,
    CharacterLeaderSupportedProjectionValidation,
} from "./leader-supported-projection-contract";
import {
    CharacterLeaderSupportedProjectionSourceOptions,
    buildCharacterLeaderSupportedProjectionFromSources,
    validateCharacterLeaderSupportedProjectionArtifact,
    validateCharacterLeaderSupportedProjectionRootSeparation,
    writeCharacterLeaderSupportedProjectionArtifacts,
} from "./leader-supported-projection-source";
import { runCharacterLeaderLifecycleSemanticsAudit } from "./leader-lifecycle-semantics-run";

export interface CharacterLeaderSupportedProjectionRunOptions extends CharacterLeaderSupportedProjectionSourceOptions {
    optIn: true;
    outputRoot: string;
}

export interface CharacterLeaderSupportedProjectionRunResult {
    outputRoot: string;
    manifest: CharacterLeaderSupportedProjectionManifest;
    coverage: CharacterLeaderSupportedProjectionCoverage;
    validation: CharacterLeaderSupportedProjectionValidation;
    manifestSha256: string;
    manifestSizeBytes: number;
    twoMaterializationsByteIdentical: true;
    sourcesReloadedAfterBuildAndWrite: true;
    k55RealAudit: "GO";
    sourceBoundValidation: "GO";
    localShadowAuditDefaultOff: "GO";
    peakRssBytes: number;
    readiness: {
        offlineSupportedOnlyProjection: "GO";
        conditional17: "NO-GO";
        deckFallback: "NO-GO";
        effectiveCombinedLeaderValue: "NO-GO";
        authority: "NO-GO";
        apply: "NO-GO";
        production: "NO-GO";
        publisher: "NO-GO";
        network: "NO-GO";
        r2: "NO-GO";
        android: "NO-GO";
        ui: "NO-GO";
        fyiRemoval: "NO-GO";
        combatCalculation: "NO-GO";
        dynamicInstrumentation: "NO-GO";
        concurrentOutputAncestorReplacement: "NO-GO";
    };
}

const hash = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");
class RssGuard {
    private peak = Math.max(process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024);
    private exceeded = false;
    private readonly timer = setInterval(() => this.observe(), 10);
    constructor() { this.timer.unref(); }
    private observe(): void {
        this.peak = Math.max(this.peak, process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024);
        this.exceeded ||= this.peak >= CHARACTER_LEADER_SUPPORTED_PROJECTION_RSS_LIMIT_BYTES;
    }
    sample(): void {
        this.observe();
        if (this.exceeded) throw new Error(`K56 RSS limit reached: ${this.peak}`);
    }
    stop(): number { clearInterval(this.timer); this.sample(); return this.peak; }
    dispose(): void { clearInterval(this.timer); }
}

export async function runCharacterLeaderSupportedProjection(
    options: CharacterLeaderSupportedProjectionRunOptions,
): Promise<CharacterLeaderSupportedProjectionRunResult> {
    if (options?.optIn !== true) throw new Error("K56 requires explicit opt-in");
    if (!options.sidecarRoot || !options.productionRoot || !options.fyiRoot || !options.k43Root || !options.k46Root
        || !options.k48Root || !options.outputRoot || !options.nativeRuntime || !options.database) {
        throw new Error("K56 requires every explicit source/output root, native runtime and database");
    }
    if (typeof (global as any).gc !== "function") throw new Error("K56 requires Node --expose-gc");
    const rss = new RssGuard();
    try {
        await validateCharacterLeaderSupportedProjectionRootSeparation(options);
        rss.sample();
        const upstreamK55 = await runCharacterLeaderLifecycleSemanticsAudit({
            optIn: true,
            sidecarRoot: options.sidecarRoot,
            productionRoot: options.productionRoot,
            fyiRoot: options.fyiRoot,
            k43Root: options.k43Root,
            k46Root: options.k46Root,
            k48Root: options.k48Root,
            nativeRuntime: options.nativeRuntime,
            database: options.database,
        });
        rss.sample();
        let first = await buildCharacterLeaderSupportedProjectionFromSources(options, upstreamK55);
        rss.sample();
        let second = await buildCharacterLeaderSupportedProjectionFromSources(options, upstreamK55);
        rss.sample();
        if (!first.raw.equals(second.raw) || !first.gzip.equals(second.gzip)
            || !first.coverageBytes.equals(second.coverageBytes) || !first.validationBytes.equals(second.validationBytes)
            || !first.manifestBytes.equals(second.manifestBytes)) throw new Error("K56 two materializations are not byte-identical");
        first = undefined as any;
        (global as any).gc();
        rss.sample();
        await writeCharacterLeaderSupportedProjectionArtifacts(options.outputRoot, second);
        second = undefined as any;
        (global as any).gc();
        rss.sample();
        const validated = await validateCharacterLeaderSupportedProjectionArtifact({ artifactRoot: options.outputRoot, ...options });
        rss.sample();
        const peakRssBytes = rss.stop();
        return {
            outputRoot: options.outputRoot,
            manifest: validated.artifacts.manifest,
            coverage: validated.artifacts.coverage,
            validation: validated.artifacts.validation,
            manifestSha256: hash(validated.artifacts.manifestBytes),
            manifestSizeBytes: validated.artifacts.manifestBytes.length,
            twoMaterializationsByteIdentical: true,
            sourcesReloadedAfterBuildAndWrite: true,
            k55RealAudit: "GO",
            sourceBoundValidation: "GO",
            localShadowAuditDefaultOff: "GO",
            peakRssBytes,
            readiness: {
                offlineSupportedOnlyProjection: "GO", conditional17: "NO-GO", deckFallback: "NO-GO",
                effectiveCombinedLeaderValue: "NO-GO", authority: "NO-GO", apply: "NO-GO", production: "NO-GO",
                publisher: "NO-GO", network: "NO-GO", r2: "NO-GO", android: "NO-GO", ui: "NO-GO",
                fyiRemoval: "NO-GO", combatCalculation: "NO-GO", dynamicInstrumentation: "NO-GO",
                concurrentOutputAncestorReplacement: "NO-GO",
            },
        };
    } finally { rss.dispose(); }
}

function value(args: string[], name: string): string | undefined {
    const indexes = args.flatMap((item, index) => item === name ? [index] : []);
    if (indexes.length > 1) throw new Error(`duplicate ${name}`);
    if (!indexes.length) return undefined;
    const result = args[indexes[0] + 1];
    if (!result || result.startsWith("--")) throw new Error(`missing value for ${name}`);
    return result;
}
function required(args: string[], name: string): string {
    const result = value(args, name);
    if (!result) throw new Error(`K56 requires ${name}`);
    return result;
}

export function parseCharacterLeaderSupportedProjectionCli(args: string[]): CharacterLeaderSupportedProjectionRunOptions {
    const values = [
        "--sidecar-root", "--production-root", "--fyi-root", "--k43-root", "--k46-root", "--k48-root", "--output-root",
        "--native-runtime", "--database",
    ];
    const allowed = new Set(["--opt-in-k56", ...values]);
    for (let index = 0; index < args.length; index++) {
        const argument = args[index];
        if (!allowed.has(argument)) throw new Error(`K56 unsupported argument ${argument}`);
        if (argument !== "--opt-in-k56") {
            const next = args[index + 1];
            if (!next || next.startsWith("--")) throw new Error(`missing value for ${argument}`);
            index++;
        }
    }
    if (args.filter(item => item === "--opt-in-k56").length !== 1) throw new Error("K56 requires exactly one --opt-in-k56");
    return {
        optIn: true,
        sidecarRoot: required(args, "--sidecar-root"),
        productionRoot: required(args, "--production-root"),
        fyiRoot: required(args, "--fyi-root"),
        k43Root: required(args, "--k43-root"),
        k46Root: required(args, "--k46-root"),
        k48Root: required(args, "--k48-root"),
        outputRoot: required(args, "--output-root"),
        nativeRuntime: required(args, "--native-runtime"),
        database: required(args, "--database"),
    };
}

async function run(): Promise<void> {
    const result = await runCharacterLeaderSupportedProjection(parseCharacterLeaderSupportedProjectionCli(process.argv.slice(2)));
    const stdout = `${JSON.stringify(result, null, 2)}\n`;
    if (Buffer.byteLength(stdout) >= CHARACTER_LEADER_SUPPORTED_PROJECTION_METADATA_LIMIT_BYTES) throw new Error("K56 stdout metadata limit reached");
    process.stdout.write(stdout);
}
if (require.main === module) run().catch(error => { console.error(error); process.exitCode = 1; });
