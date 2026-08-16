import { CHARACTER_LEADER_SUPPORTED_PUBLISHER_REPORT_LIMIT_BYTES } from "./leader-supported-publisher-dry-run-contract";
import {
    CharacterLeaderSupportedPublisherDryRunOptions,
    runCharacterLeaderSupportedPublisherDryRun,
} from "./leader-supported-publisher-dry-run";

const VALUES = [
    "--sidecar-root", "--production-root", "--fyi-root", "--k43-root", "--k46-root", "--k48-root", "--k56-root",
    "--output-root", "--native-runtime", "--database",
] as const;

function value(args: string[], name: typeof VALUES[number]): string {
    const indexes = args.flatMap((argument, index) => argument === name ? [index] : []);
    if (indexes.length !== 1) throw new Error(indexes.length ? `duplicate ${name}` : `missing ${name}`);
    const result = args[indexes[0] + 1];
    if (!result || result.startsWith("--")) throw new Error(`missing value for ${name}`);
    return result;
}

export function parseCharacterLeaderSupportedPublisherDryRunCli(
    args: string[],
): CharacterLeaderSupportedPublisherDryRunOptions {
    const allowed = new Set<string>(["--opt-in-k58", ...VALUES]);
    for (let index = 0; index < args.length; index++) {
        const argument = args[index];
        if (!allowed.has(argument)) throw new Error(`K58 unsupported argument ${argument}`);
        if ((VALUES as readonly string[]).includes(argument)) {
            const next = args[index + 1];
            if (!next || next.startsWith("--")) throw new Error(`missing value for ${argument}`);
            index++;
        }
    }
    if (args.filter(argument => argument === "--opt-in-k58").length !== 1) {
        throw new Error("K58 requires exactly one --opt-in-k58");
    }
    return {
        optIn: true,
        sidecarRoot: value(args, "--sidecar-root"), productionRoot: value(args, "--production-root"),
        fyiRoot: value(args, "--fyi-root"), k43Root: value(args, "--k43-root"),
        k46Root: value(args, "--k46-root"), k48Root: value(args, "--k48-root"),
        k56Root: value(args, "--k56-root"), outputRoot: value(args, "--output-root"),
        nativeRuntime: value(args, "--native-runtime"), database: value(args, "--database"),
    };
}

async function main(): Promise<void> {
    const result = await runCharacterLeaderSupportedPublisherDryRun(
        parseCharacterLeaderSupportedPublisherDryRunCli(process.argv.slice(2)),
    );
    const stdout = `${JSON.stringify(result, null, 2)}\n`;
    if (Buffer.byteLength(stdout) >= CHARACTER_LEADER_SUPPORTED_PUBLISHER_REPORT_LIMIT_BYTES) {
        throw new Error("K58 stdout report limit reached");
    }
    process.stdout.write(stdout);
}

if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
