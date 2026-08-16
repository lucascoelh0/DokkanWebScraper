"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseCharacterLeaderSupportedRemotePreflightCli = void 0;
const leader_supported_remote_preflight_contract_1 = require("./leader-supported-remote-preflight-contract");
const leader_supported_remote_preflight_1 = require("./leader-supported-remote-preflight");
const VALUES = [
    "--sidecar-root", "--production-root", "--fyi-root", "--k43-root", "--k46-root", "--k48-root",
    "--k56-root", "--k58-root", "--output-root", "--native-runtime", "--database", "--checked-at",
];
function value(args, name) {
    const indexes = args.flatMap((argument, index) => argument === name ? [index] : []);
    if (indexes.length !== 1)
        throw new Error(indexes.length ? `duplicate ${name}` : `missing ${name}`);
    const result = args[indexes[0] + 1];
    if (!result || result.startsWith("--"))
        throw new Error(`missing value for ${name}`);
    return result;
}
function parseCharacterLeaderSupportedRemotePreflightCli(args) {
    const switches = ["--opt-in-k59", "--remote-read-only"];
    const allowed = new Set([...switches, ...VALUES]);
    for (let index = 0; index < args.length; index++) {
        const argument = args[index];
        if (!allowed.has(argument))
            throw new Error(`K59 unsupported argument ${argument}`);
        if (VALUES.includes(argument)) {
            const next = args[index + 1];
            if (!next || next.startsWith("--"))
                throw new Error(`missing value for ${argument}`);
            index++;
        }
    }
    for (const flag of switches)
        if (args.filter(argument => argument === flag).length !== 1) {
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
exports.parseCharacterLeaderSupportedRemotePreflightCli = parseCharacterLeaderSupportedRemotePreflightCli;
async function main() {
    const result = await (0, leader_supported_remote_preflight_1.runCharacterLeaderSupportedRemotePreflight)(parseCharacterLeaderSupportedRemotePreflightCli(process.argv.slice(2)));
    const stdout = `${JSON.stringify(result, null, 2)}\n`;
    if (Buffer.byteLength(stdout) >= leader_supported_remote_preflight_contract_1.CHARACTER_LEADER_SUPPORTED_REMOTE_PREFLIGHT_REPORT_LIMIT_BYTES) {
        throw new Error("K59 stdout report limit reached");
    }
    process.stdout.write(stdout);
    if (result.report.readiness.remotePreflight !== "GO")
        process.exitCode = 2;
}
if (require.main === module)
    main().catch(error => { console.error(error); process.exitCode = 1; });
//# sourceMappingURL=leader-supported-remote-preflight-run.js.map