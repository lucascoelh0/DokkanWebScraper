import { execFileSync } from "child_process";

const FORBIDDEN_PATH = /(^|\/)(?:data|\.codex-remote-attachments)(?:\/|$)|\.(?:har|sqlite|sqlite3|db|cpk|apk|so)$/i;
const FORBIDDEN_CONTENT = [
    /Bearer\s+[A-Za-z0-9._~+\/-]{8,}/i,
    /Authorization\s*[:=]\s*["']?(?!<|redacted|none)[A-Za-z0-9._~+\/-]{8,}/i,
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
    /[?&](?:access_token|auth(?:orization)?|device_id|nonce|signature|token|user_id)=[^\s"'&<>]{4,}/i,
];

export interface GameDbAcquisitionScanTarget { name: string, bytes: Buffer }

export function scanGameDbAcquisitionTargets(targets: GameDbAcquisitionScanTarget[]): {
    valid: boolean,
    targetCount: number,
    failures: Array<{ name: string, reason: string }>,
} {
    if (targets.length === 0) throw new Error("Game DB acquisition scan requires at least one staged target");
    const failures: Array<{ name: string, reason: string }> = [];
    for (const target of targets) {
        const name = target.name.replace(/\\/g, "/");
        if (!name || name.startsWith("/") || name.includes("../") || FORBIDDEN_PATH.test(name)) {
            failures.push({ name, reason: "forbidden_path_or_artifact_type" });
            continue;
        }
        if (target.bytes.byteLength > 4 * 1024 * 1024) {
            failures.push({ name, reason: "unexpected_large_versionable_target" });
            continue;
        }
        if (target.bytes.includes(0)) {
            failures.push({ name, reason: "binary_or_nul_content" });
            continue;
        }
        const text = target.bytes.toString("utf8");
        if (FORBIDDEN_CONTENT.some(pattern => pattern.test(text))) {
            failures.push({ name, reason: "credential_or_sensitive_query_pattern" });
        }
    }
    return { valid: failures.length === 0, targetCount: targets.length, failures };
}

export function stagedGameDbAcquisitionTargets(): GameDbAcquisitionScanTarget[] {
    let names: string[];
    try {
        names = execFileSync("git", ["diff", "--cached", "--name-only", "-z"], { encoding: "utf8" })
            .split("\0")
            .filter(Boolean);
    } catch {
        throw new Error("Game DB acquisition scan could not enumerate staged targets");
    }
    if (names.length === 0) throw new Error("Game DB acquisition scan requires at least one staged target");
    return names.map(name => {
        try {
            return { name, bytes: execFileSync("git", ["show", `:${name}`], { maxBuffer: 8 * 1024 * 1024 }) };
        } catch {
            throw new Error("Game DB acquisition scan could not read a staged target");
        }
    });
}

function main(): void {
    const result = scanGameDbAcquisitionTargets(stagedGameDbAcquisitionTargets());
    console.log(JSON.stringify(result, null, 2));
    if (!result.valid) process.exitCode = 1;
}

if (require.main === module) {
    try { main(); }
    catch (error) { console.error(error); process.exitCode = 1; }
}
