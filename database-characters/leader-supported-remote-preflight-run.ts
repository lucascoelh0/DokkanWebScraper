import { CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_REPORT_LIMIT_BYTES } from "./leader-supported-remote-preflight-contract";
import {
    CharacterLeaderSupportedRemotePreflightOptions,
    runCharacterLeaderSupportedRemotePreflight,
} from "./leader-supported-remote-preflight";

const VALUES = [
    "--sidecar-root", "--production-root", "--fyi-root", "--k43-root", "--k46-root", "--k48-root",
    "--k56-root", "--k58-root", "--output-root", "--native-runtime", "--database", "--checked-at",
] as const;

function value(args: string[], name: typeof VALUES[number]): string {
    const indexes = args.flatMap((argument, index) => argument === name ? [index] : []);
    if (indexes.length !== 1) throw new Error(indexes.length ? `duplicate ${name}` : `missing ${name}`);
    const result = args[indexes[0] + 1];
    if (!result || result.startsWith("--")) throw new Error(`missing value for ${name}`);
    return result;
}

export function parseCharacterLeaderSupportedRemotePreflightCli(args: string[]): CharacterLeaderSupportedRemotePreflightOptions {
    const switches = ["--opt-in-k59", "--remote-read-only"] as const;
    const allowed = new Set<string>([...switches, ...VALUES]);
    for (let index = 0; index < args.length; index++) {
        const argument = args[index];
        if (!allowed.has(argument)) throw new Error(`K59 unsupported argument ${argument}`);
        if ((VALUES as readonly string[]).includes(argument)) {
            const next = args[index + 1];
            if (!next || next.startsWith("--")) throw new Error(`missing value for ${argument}`);
            index++;
        }
    }
    for (const flag of switches) if (args.filter(argument => argument === flag).length !== 1) {
        throw new Error(`K59 requires exactly one ${flag}`);
    }
    return {
        optIn: true, remoteReadOnly: true,
        sidecarRoot: value(args, "--sidecar-root"), productionRoot: value(args, "--production-root"),
        fyiRoot: value(args, "--fyi-root"), k43Root: value(args, "--k43-root"),
        k46Root: value(args, "--k46-root"), k48Root: value(args, "--k48-root"),
        k56Root: value(args, "--k56-root"), k58Root: value(args, "--k58-root"),
        outputRoot: value(args, "--output-root"), nativeRuntime: value(args, "--native-runtime"),
        database: value(args, "--database"), checkedAt: value(args, "--checked-at"),
    };
}

async function main(): Promise<void> {
    const result = await runCharacterLeaderSupportedRemotePreflight(
        parseCharacterLeaderSupportedRemotePreflightCli(process.argv.slice(2)),
    );
    const stdout = `${JSON.stringify(result, null, 2)}\n`;
    if (Buffer.byteLength(stdout) >= CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_REPORT_LIMIT_BYTES) {
        throw new Error("K59 stdout report limit reached");
    }
    process.stdout.write(stdout);
    if (result.report.readiness.remotePreflight !== "GO") process.exitCode = 2;
}

if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
