import { lstatSync, readFileSync, realpathSync } from "fs";
import { resolve } from "path";
import { getHeapStatistics } from "v8";
import { Dd0SourceLock } from "./data-download-contract";
import { buildDd0, loadDdCaptures, loadDdExternalSources } from "./data-download-core";
import { buildDd1 } from "./data-download-dd1";
import { buildDd2 } from "./data-download-dd2";

export const DD_CAPTURE_ROOT_ENV = "DOKKAN_DD0_DD8_CAPTURE_ROOT";

export function resolveDdCaptureRoot(argv: string[] = process.argv.slice(2), env: NodeJS.ProcessEnv = process.env): string {
    let cliValue: string | undefined;
    for (let index = 0; index < argv.length; index += 1) {
        const argument = argv[index];
        if (argument === "--capture-root") {
            if (cliValue !== undefined || index + 1 >= argv.length) throw new Error("DD capture root CLI configuration is invalid");
            cliValue = argv[index + 1]; index += 1;
        } else if (argument.startsWith("--capture-root=")) {
            if (cliValue !== undefined) throw new Error("DD capture root CLI configuration is invalid");
            cliValue = argument.slice("--capture-root=".length);
        } else {
            throw new Error("DD runner accepts only --capture-root <directory>");
        }
    }
    const envValue = env[DD_CAPTURE_ROOT_ENV];
    if (cliValue !== undefined && envValue !== undefined) throw new Error(`DD capture root must use either --capture-root or ${DD_CAPTURE_ROOT_ENV}, not both`);
    const configured = cliValue ?? envValue;
    if (typeof configured !== "string" || configured.trim().length === 0 || configured.includes("\0")) throw new Error(`DD capture root is required via --capture-root or ${DD_CAPTURE_ROOT_ENV}`);
    try {
        const link = lstatSync(configured);
        if (!link.isDirectory() || link.isSymbolicLink()) throw new Error("rejected");
        const realRoot = realpathSync.native(configured);
        const realLink = lstatSync(realRoot);
        if (!realLink.isDirectory() || realLink.isSymbolicLink()) throw new Error("rejected");
        return realRoot;
    } catch {
        throw new Error("DD capture root must resolve to a regular directory, not a symlink or junction");
    }
}

export function loadDdContext(argv: string[] = process.argv.slice(2), env: NodeJS.ProcessEnv = process.env) {
    if (getHeapStatistics().heap_size_limit >= 1024 * 1024 * 1024) throw new Error("DD campaign requires a Node heap below 1 GiB");
    const root = resolve(process.cwd()), captureRoot = resolveDdCaptureRoot(argv, env);
    let lock: Dd0SourceLock;
    try { lock = JSON.parse(readFileSync(resolve(root, "database-data-download-captures/data-download-source-lock.json"), "utf8")) as Dd0SourceLock; }
    catch { throw new Error("DD source lock could not be read"); }
    const loaded = loadDdCaptures(captureRoot, lock), external = loadDdExternalSources(captureRoot, lock), dd0 = buildDd0(lock, loaded, external), dd1 = buildDd1(loaded, lock, dd0), dd2 = buildDd2(loaded, external, lock, dd0, dd1);
    return { root, lock, loaded, external, dd0, dd1, dd2 };
}
