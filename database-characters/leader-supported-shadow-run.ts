import type { CharacterLeaderSupportedProjectionSourceOptions } from "./leader-supported-projection-source";
import { validateCharacterLeaderSupportedProjectionArtifact } from "./leader-supported-projection-source";
import {
    CHARACTER_LEADER_SUPPORTED_SHADOW_REPORT_LIMIT_BYTES,
    CHARACTER_LEADER_SUPPORTED_SHADOW_RSS_LIMIT_BYTES,
    CharacterLeaderSupportedShadowReport,
} from "./leader-supported-shadow-contract";
import {
    assertCharacterLeaderSupportedShadowReportBound,
    assertExactCharacterLeaderSupportedShadowK56Identity,
    characterLeaderSupportedShadowArtifactFingerprint,
    characterLeaderSupportedShadowLineageFingerprint,
    createCharacterLeaderSupportedShadow,
} from "./leader-supported-shadow";
import type { CharacterLeaderSupportedProjectionArtifactSet } from "./leader-supported-projection-contract";

export interface CharacterLeaderSupportedShadowRunOptions extends CharacterLeaderSupportedProjectionSourceOptions {
    optIn: true;
    k56Root: string;
}

class ParentRssGuard {
    private peak = Math.max(process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024);
    private exceeded = false;
    private readonly timer = setInterval(() => this.observe(), 10);
    constructor() { this.timer.unref(); }
    private observe(): void {
        this.peak = Math.max(this.peak, process.memoryUsage().rss, process.resourceUsage().maxRSS * 1024);
        this.exceeded ||= this.peak >= CHARACTER_LEADER_SUPPORTED_SHADOW_RSS_LIMIT_BYTES;
    }
    sample(): void {
        this.observe();
        if (this.exceeded) throw new Error(`K57 parent per-process RSS limit reached: ${this.peak}`);
    }
    stop(): number { clearInterval(this.timer); this.sample(); return this.peak; }
    dispose(): void { clearInterval(this.timer); }
}

function deepFreeze<T>(value: T): T {
    if (value && typeof value === "object" && !Object.isFrozen(value)) {
        for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
        Object.freeze(value);
    }
    return value;
}

export function maximumIndividualCharacterLeaderSupportedShadowProcessPeakRss(...peaks: number[]): number {
    if (peaks.length !== 3 || peaks.some(peak => !Number.isSafeInteger(peak) || peak <= 0
        || peak >= CHARACTER_LEADER_SUPPORTED_SHADOW_RSS_LIMIT_BYTES)) throw new Error("K57 per-process RSS peak rejected");
    return Math.max(...peaks);
}

export function assertCharacterLeaderSupportedShadowArtifactsStable(
    before: CharacterLeaderSupportedProjectionArtifactSet,
    after: CharacterLeaderSupportedProjectionArtifactSet,
): void {
    if (characterLeaderSupportedShadowArtifactFingerprint(before) !== characterLeaderSupportedShadowArtifactFingerprint(after)) {
        throw new Error("K57 full K56 artifact fingerprint drifted across lookup");
    }
    if (characterLeaderSupportedShadowLineageFingerprint(before) !== characterLeaderSupportedShadowLineageFingerprint(after)) {
        throw new Error("K57 full K56 lineage drifted across lookup");
    }
}

export async function runCharacterLeaderSupportedShadow(
    options: CharacterLeaderSupportedShadowRunOptions,
): Promise<Readonly<CharacterLeaderSupportedShadowReport>> {
    if (options?.optIn !== true) throw new Error("K57 requires explicit opt-in");
    if (!options.sidecarRoot || !options.productionRoot || !options.fyiRoot || !options.k43Root || !options.k46Root
        || !options.k48Root || !options.k56Root || !options.nativeRuntime || !options.database) {
        throw new Error("K57 requires every explicit K56/source root, native runtime and database");
    }
    if (typeof (global as any).gc !== "function") throw new Error("K57 requires Node --expose-gc");
    const rss = new ParentRssGuard();
    try {
        let before = await validateCharacterLeaderSupportedProjectionArtifact({
            artifactRoot: options.k56Root,
            sidecarRoot: options.sidecarRoot, productionRoot: options.productionRoot, fyiRoot: options.fyiRoot,
            k43Root: options.k43Root, k46Root: options.k46Root, k48Root: options.k48Root,
            nativeRuntime: options.nativeRuntime, database: options.database,
        });
        if (before.sourceBoundValidation !== "GO") throw new Error("K57 before source-bound K56 validation did not return GO");
        assertExactCharacterLeaderSupportedShadowK56Identity(before.artifacts);
        const beforeFingerprint = characterLeaderSupportedShadowArtifactFingerprint(before.artifacts);
        const beforeLineageFingerprint = characterLeaderSupportedShadowLineageFingerprint(before.artifacts);
        const beforeChildPeak = before.k55ValidationProcessPeakRssBytes;
        let consumer = createCharacterLeaderSupportedShadow(before.artifacts);
        const inventory = consumer.inventory();
        for (const reference of inventory.samples.references) {
            if (!consumer.lookupReference(reference.stateId, reference.sourceEffectOccurrenceIndex)) {
                throw new Error("K57 sampled exact reference lookup failed");
            }
        }
        const directReport = consumer.report();
        consumer = undefined as any;
        before = undefined as any;
        (global as any).gc();
        rss.sample();

        let after = await validateCharacterLeaderSupportedProjectionArtifact({
            artifactRoot: options.k56Root,
            sidecarRoot: options.sidecarRoot, productionRoot: options.productionRoot, fyiRoot: options.fyiRoot,
            k43Root: options.k43Root, k46Root: options.k46Root, k48Root: options.k48Root,
            nativeRuntime: options.nativeRuntime, database: options.database,
        });
        if (after.sourceBoundValidation !== "GO") throw new Error("K57 after source-bound K56 validation did not return GO");
        assertExactCharacterLeaderSupportedShadowK56Identity(after.artifacts);
        if (beforeFingerprint !== characterLeaderSupportedShadowArtifactFingerprint(after.artifacts)) {
            throw new Error("K57 full K56 artifact fingerprint drifted across lookup");
        }
        if (beforeLineageFingerprint !== characterLeaderSupportedShadowLineageFingerprint(after.artifacts)) {
            throw new Error("K57 full K56 lineage drifted across lookup");
        }
        const afterChildPeak = after.k55ValidationProcessPeakRssBytes;
        after = undefined as any;
        (global as any).gc();
        const parentPeak = rss.stop();
        const maximumIndividualProcessPeakRssBytes = maximumIndividualCharacterLeaderSupportedShadowProcessPeakRss(
            beforeChildPeak, afterChildPeak, parentPeak,
        );
        const report: CharacterLeaderSupportedShadowReport = {
            ...directReport,
            inventory: inventory as CharacterLeaderSupportedShadowReport["inventory"],
            source: {
                ...directReport.source,
                exactRealK56Identity: true,
                sourceBoundValidationBefore: "GO", sourceBoundValidationAfter: "GO",
                fullArtifactStableAcrossLookup: true, fullLineageStableAcrossLookup: true,
            },
            rssAccounting: {
                scope: "per_process_not_process_tree",
                measurements: {
                    k55BeforeProcessPeakRssBytes: beforeChildPeak,
                    k55AfterProcessPeakRssBytes: afterChildPeak,
                    k57ParentProcessPeakRssBytes: parentPeak,
                    maximumIndividualProcessPeakRssBytes,
                },
            },
            readiness: {
                consumerShadow: "GO", sourceBoundValidation: "GO", perProcessRssUnder1GiB: "GO",
                processTreeRssUnder1GiB: "NO-GO", persistedConsumer: "NO-GO", writerOrOutputArtifact: "NO-GO",
                applyOrOverlay: "NO-GO", combinedLeaderFriendOrEffectiveValue: "NO-GO", finalCombatCalculation: "NO-GO",
                conditional17: "NO-GO", deckFallback: "NO-GO", authority: "NO-GO", production: "NO-GO",
                publisher: "NO-GO", network: "NO-GO", r2: "NO-GO", android: "NO-GO", ui: "NO-GO",
                fyiRemoval: "NO-GO", dynamicInstrumentation: "NO-GO",
            },
        };
        assertCharacterLeaderSupportedShadowReportBound(report);
        return deepFreeze(report);
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
    if (!result) throw new Error(`K57 requires ${name}`);
    return result;
}

export function parseCharacterLeaderSupportedShadowCli(args: string[]): CharacterLeaderSupportedShadowRunOptions {
    const values = [
        "--sidecar-root", "--production-root", "--fyi-root", "--k43-root", "--k46-root", "--k48-root", "--k56-root",
        "--native-runtime", "--database",
    ];
    const allowed = new Set(["--opt-in-k57", ...values]);
    for (let index = 0; index < args.length; index++) {
        const argument = args[index];
        if (!allowed.has(argument)) throw new Error(`K57 unsupported argument ${argument}`);
        if (argument !== "--opt-in-k57") {
            const next = args[index + 1];
            if (!next || next.startsWith("--")) throw new Error(`missing value for ${argument}`);
            index++;
        }
    }
    if (args.filter(item => item === "--opt-in-k57").length !== 1) throw new Error("K57 requires exactly one --opt-in-k57");
    return {
        optIn: true,
        sidecarRoot: required(args, "--sidecar-root"), productionRoot: required(args, "--production-root"),
        fyiRoot: required(args, "--fyi-root"), k43Root: required(args, "--k43-root"),
        k46Root: required(args, "--k46-root"), k48Root: required(args, "--k48-root"),
        k56Root: required(args, "--k56-root"), nativeRuntime: required(args, "--native-runtime"),
        database: required(args, "--database"),
    };
}

async function run(): Promise<void> {
    const report = await runCharacterLeaderSupportedShadow(parseCharacterLeaderSupportedShadowCli(process.argv.slice(2)));
    const stdout = `${JSON.stringify(report, null, 2)}\n`;
    if (Buffer.byteLength(stdout) >= CHARACTER_LEADER_SUPPORTED_SHADOW_REPORT_LIMIT_BYTES) throw new Error("K57 stdout report limit reached");
    process.stdout.write(stdout);
}

if (require.main === module) run().catch(error => { console.error(error); process.exitCode = 1; });
