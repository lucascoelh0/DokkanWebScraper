"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fileTextTarget = exports.stagedTextTargets = exports.scanTextsForSecrets = exports.collectCaptureSensitiveValues = void 0;
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const capture_h0_audit_1 = require("./capture-h0-audit");
const SENSITIVE_KEY = /(?:^|[_-])(access[_-]?token|api[_-]?(?:token|key)|token|authorization|auth(?:entication|orization|transaction)?|account|cookie|credential|device|password|secret|session|signature|userid|user[_-]?id)(?:$|[_-])/i;
function addScalar(target, value) {
    if ((typeof value === "string" || typeof value === "number") && String(value).length > 0)
        target.add(String(value));
}
function collectSensitiveObjectValues(value, target) {
    if (!value || typeof value !== "object")
        return;
    if (Array.isArray(value)) {
        for (const child of value)
            collectSensitiveObjectValues(child, target);
        return;
    }
    for (const [key, child] of Object.entries(value)) {
        if (SENSITIVE_KEY.test(key) && (typeof child === "string" || typeof child === "number"))
            addScalar(target, child);
        else if (child && typeof child === "object")
            collectSensitiveObjectValues(child, target);
    }
}
function collectCaptureSensitiveValues(manifest, roots) {
    const root = roots[manifest.inputRoot];
    if (!root)
        throw new Error("secret scanner input root is not allowlisted");
    const values = new Set();
    for (const input of manifest.captures) {
        const har = JSON.parse((0, capture_h0_audit_1.readValidatedCaptureForSecretScanner)(root, input.path, input.captureId));
        if (!Array.isArray(har?.log?.entries))
            throw new Error(`secret scanner invalid HAR ${input.captureId}`);
        for (const entry of har.log.entries) {
            for (const side of [entry?.request, entry?.response]) {
                for (const header of side?.headers ?? [])
                    if (SENSITIVE_KEY.test(String(header?.name ?? "")))
                        addScalar(values, header?.value);
                for (const cookie of side?.cookies ?? [])
                    addScalar(values, cookie?.value);
            }
            try {
                for (const [key, value] of new URL(entry?.request?.url).searchParams)
                    if (SENSITIVE_KEY.test(key))
                        addScalar(values, value);
            }
            catch { /* invalid URL is not persisted */ }
            for (const text of [entry?.request?.postData?.text, entry?.response?.content?.text]) {
                if (typeof text !== "string" || text.length > 32 * 1024 * 1024)
                    continue;
                try {
                    collectSensitiveObjectValues(JSON.parse(text), values);
                }
                catch { /* opaque bodies are never persisted */ }
            }
            for (const parameter of entry?.request?.postData?.params ?? [])
                if (SENSITIVE_KEY.test(String(parameter?.name ?? "")))
                    addScalar(values, parameter?.value);
        }
    }
    return values;
}
exports.collectCaptureSensitiveValues = collectCaptureSensitiveValues;
function hasGenericSecretPattern(text) {
    const scrubbed = text
        .replace(/(?:access_token|device_token|auth_transaction_id)=synthetic-[A-Za-z0-9_-]+/gi, "synthetic_assignment")
        .replace(/synthetic-[A-Za-z0-9_-]+/g, "[synthetic]");
    return /Bearer\s+[A-Za-z0-9._~+\/-]{8,}/i.test(scrubbed)
        || /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/.test(scrubbed)
        || /(?:access_token|device_token|auth_transaction_id)=[A-Za-z0-9._~+\/-]{8,}/i.test(scrubbed);
}
function scanTextsForSecrets(secrets, targets) {
    let exactCapturedSecretMatches = 0;
    let genericSecretPatternMatches = 0;
    const failingTargets = new Set();
    for (const target of targets) {
        for (const secret of secrets) {
            const quoted = JSON.stringify(secret);
            const exactMatch = secret.length >= 12 ? target.text.includes(secret) : target.text.includes(`:${quoted}`) || target.text.includes(`: ${quoted}`) || target.text.includes(`=${secret}&`) || target.text.includes(`=${secret}\"`);
            if (exactMatch) {
                exactCapturedSecretMatches += 1;
                failingTargets.add(target.name);
            }
        }
        if (hasGenericSecretPattern(target.text)) {
            genericSecretPatternMatches += 1;
            failingTargets.add(target.name);
        }
    }
    return { schemaVersion: 1, valid: exactCapturedSecretMatches === 0 && genericSecretPatternMatches === 0, captureSecretValueCount: secrets.size, targetCount: targets.length, exactCapturedSecretMatches, genericSecretPatternMatches, failingTargets: [...failingTargets].sort((a, b) => a.localeCompare(b)) };
}
exports.scanTextsForSecrets = scanTextsForSecrets;
function stagedTextTargets() {
    const files = (0, child_process_1.execFileSync)("git", ["diff", "--cached", "--name-only", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
    return files.map(name => ({ name, text: (0, child_process_1.execFileSync)("git", ["show", `:${name}`], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }) }));
}
exports.stagedTextTargets = stagedTextTargets;
function fileTextTarget(name, path) {
    return { name, text: (0, fs_1.readFileSync)(path, "utf8") };
}
exports.fileTextTarget = fileTextTarget;
//# sourceMappingURL=capture-secret-scan.js.map