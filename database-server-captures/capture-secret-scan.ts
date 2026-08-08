import { execFileSync } from "child_process";
import { readFileSync } from "fs";
import { CaptureSecretScanResult } from "./capture-h1-contract";
import { readValidatedCaptureForSecretScanner } from "./capture-h0-audit";
import { CaptureInputManifest } from "./capture-h0-contract";

const SENSITIVE_KEY = /(?:^|[_-])(access[_-]?token|api[_-]?(?:token|key)|token|authorization|auth(?:entication|orization|transaction)?|account|cookie|credential|device|password|secret|session|signature|userid|user[_-]?id)(?:$|[_-])/i;

function addScalar(target: Set<string>, value: unknown): void {
    if ((typeof value === "string" || typeof value === "number") && String(value).length > 0) target.add(String(value));
}

function collectSensitiveObjectValues(value: unknown, target: Set<string>): void {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) { for (const child of value) collectSensitiveObjectValues(child, target); return; }
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
        if (SENSITIVE_KEY.test(key) && (typeof child === "string" || typeof child === "number")) addScalar(target, child);
        else if (child && typeof child === "object") collectSensitiveObjectValues(child, target);
    }
}

export function collectCaptureSensitiveValues(manifest: CaptureInputManifest, roots: Record<string, string>): Set<string> {
    const root = roots[manifest.inputRoot];
    if (!root) throw new Error("secret scanner input root is not allowlisted");
    const values = new Set<string>();
    for (const input of manifest.captures) {
        const har = JSON.parse(readValidatedCaptureForSecretScanner(root, input.path, input.captureId));
        if (!Array.isArray(har?.log?.entries)) throw new Error(`secret scanner invalid HAR ${input.captureId}`);
        for (const entry of har.log.entries) {
            for (const side of [entry?.request, entry?.response]) {
                for (const header of side?.headers ?? []) if (SENSITIVE_KEY.test(String(header?.name ?? ""))) addScalar(values, header?.value);
                for (const cookie of side?.cookies ?? []) addScalar(values, cookie?.value);
            }
            try { for (const [key, value] of new URL(entry?.request?.url).searchParams) if (SENSITIVE_KEY.test(key)) addScalar(values, value); } catch { /* invalid URL is not persisted */ }
            for (const text of [entry?.request?.postData?.text, entry?.response?.content?.text]) {
                if (typeof text !== "string" || text.length > 32 * 1024 * 1024) continue;
                try { collectSensitiveObjectValues(JSON.parse(text), values); } catch { /* opaque bodies are never persisted */ }
            }
            for (const parameter of entry?.request?.postData?.params ?? []) if (SENSITIVE_KEY.test(String(parameter?.name ?? ""))) addScalar(values, parameter?.value);
        }
    }
    return values;
}

function hasGenericSecretPattern(text: string): boolean {
    const scrubbed = text
        .replace(/(?:access_token|device_token|auth_transaction_id)=synthetic-[A-Za-z0-9_-]+/gi, "synthetic_assignment")
        .replace(/synthetic-[A-Za-z0-9_-]+/g, "[synthetic]");
    return /Bearer\s+[A-Za-z0-9._~+\/-]{8,}/i.test(scrubbed)
        || /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/.test(scrubbed)
        || /(?:access_token|device_token|auth_transaction_id)=[A-Za-z0-9._~+\/-]{8,}/i.test(scrubbed);
}

export function scanTextsForSecrets(secrets: Set<string>, targets: Array<{ name: string; text: string }>): CaptureSecretScanResult {
    let exactCapturedSecretMatches = 0;
    let genericSecretPatternMatches = 0;
    const failingTargets = new Set<string>();
    for (const target of targets) {
        for (const secret of secrets) {
            const quoted = JSON.stringify(secret);
            const exactMatch = secret.length >= 12 ? target.text.includes(secret) : target.text.includes(`:${quoted}`) || target.text.includes(`: ${quoted}`) || target.text.includes(`=${secret}&`) || target.text.includes(`=${secret}\"`);
            if (exactMatch) { exactCapturedSecretMatches += 1; failingTargets.add(target.name); }
        }
        if (hasGenericSecretPattern(target.text)) { genericSecretPatternMatches += 1; failingTargets.add(target.name); }
    }
    return { schemaVersion: 1, valid: exactCapturedSecretMatches === 0 && genericSecretPatternMatches === 0, captureSecretValueCount: secrets.size, targetCount: targets.length, exactCapturedSecretMatches, genericSecretPatternMatches, failingTargets: [...failingTargets].sort((a, b) => a.localeCompare(b)) };
}

export function stagedTextTargets(): Array<{ name: string; text: string }> {
    const files = execFileSync("git", ["diff", "--cached", "--name-only", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
    return files.map(name => ({ name, text: execFileSync("git", ["show", `:${name}`], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }) }));
}

export function fileTextTarget(name: string, path: string): { name: string; text: string } {
    return { name, text: readFileSync(path, "utf8") };
}
