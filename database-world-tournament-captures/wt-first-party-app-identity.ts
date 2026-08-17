import { execFileSync } from "child_process";
import { createHash } from "crypto";
import { readFileSync, realpathSync, statSync } from "fs";

export const WT_FIRST_PARTY_APP_IDENTITY_RULE = "public_first_party_app_bundle_identity_v1" as const;
export const WT_FIRST_PARTY_APK_SIZE_BYTES = 98799013;
export const WT_FIRST_PARTY_APK_SHA256 = "a51ba758e0555e0a756aa4f20278e6bec25ba6b0c7dcdcd0f4372e0fad159bc0" as const;
export const WT_FIRST_PARTY_AAPT_SHA256 = "3a79b1b3f6e68d83a0eb5fe82bd557f51c6c02f07355ee0ad293c5ea43e32427" as const;
export const WT_FIRST_PARTY_AAPT_VERSION = "Android Asset Packaging Tool, v0.2-12874835" as const;
export const WT_FIRST_PARTY_APP_IDENTITY_SIZE_BYTES = 32;
export const WT_FIRST_PARTY_APP_IDENTITY_SHA256 = "74d2f87b503e9ff38f27298af6942a1a1898d1aef543b6c85720205e92cd0888" as const;

export interface WtFirstPartyAppIdentityEvidence {
    schemaVersion: 1;
    contract: "dokkan-wt-first-party-app-identity";
    rule: typeof WT_FIRST_PARTY_APP_IDENTITY_RULE;
    apk: { sizeBytes: typeof WT_FIRST_PARTY_APK_SIZE_BYTES; sha256: typeof WT_FIRST_PARTY_APK_SHA256 };
    tool: { name: "aapt"; executableSha256: typeof WT_FIRST_PARTY_AAPT_SHA256; version: typeof WT_FIRST_PARTY_AAPT_VERSION; command: "aapt dump badging <pinned-apk>" };
    identity: { jsonType: "string"; sizeBytes: typeof WT_FIRST_PARTY_APP_IDENTITY_SIZE_BYTES; sha256: typeof WT_FIRST_PARTY_APP_IDENTITY_SHA256 };
}

/** The clear identity is intentionally memory-only and must never be serialized. */
export interface WtFirstPartyAppIdentityProof {
    packageIdentity: string;
    evidence: WtFirstPartyAppIdentityEvidence;
}

const sha256 = (value: Buffer | string): string => createHash("sha256").update(value).digest("hex");

export function validateWtFirstPartyAppIdentityProof(value: WtFirstPartyAppIdentityProof | undefined): value is WtFirstPartyAppIdentityProof {
    if (!value || typeof value.packageIdentity !== "string" || value.packageIdentity.length === 0) return false;
    const evidence = value.evidence;
    return evidence?.schemaVersion === 1
        && evidence.contract === "dokkan-wt-first-party-app-identity"
        && evidence.rule === WT_FIRST_PARTY_APP_IDENTITY_RULE
        && evidence.apk?.sizeBytes === WT_FIRST_PARTY_APK_SIZE_BYTES
        && evidence.apk?.sha256 === WT_FIRST_PARTY_APK_SHA256
        && evidence.tool?.name === "aapt"
        && evidence.tool.executableSha256 === WT_FIRST_PARTY_AAPT_SHA256
        && evidence.tool.version === WT_FIRST_PARTY_AAPT_VERSION
        && evidence.tool.command === "aapt dump badging <pinned-apk>"
        && evidence.identity?.jsonType === "string"
        && evidence.identity.sizeBytes === WT_FIRST_PARTY_APP_IDENTITY_SIZE_BYTES
        && evidence.identity.sha256 === WT_FIRST_PARTY_APP_IDENTITY_SHA256
        && Buffer.byteLength(value.packageIdentity) === WT_FIRST_PARTY_APP_IDENTITY_SIZE_BYTES
        && sha256(value.packageIdentity) === WT_FIRST_PARTY_APP_IDENTITY_SHA256;
}

export function extractWtFirstPartyAppIdentity(apkPath: string, aaptPath: string): WtFirstPartyAppIdentityProof {
    if (!apkPath || !aaptPath) throw new Error("WT first-party identity evidence paths are required");
    const apk = realpathSync(apkPath), aapt = realpathSync(aaptPath), apkInfo = statSync(apk), toolInfo = statSync(aapt);
    if (!apkInfo.isFile() || !toolInfo.isFile()) throw new Error("WT first-party identity evidence must use regular files");
    const apkBytes = readFileSync(apk), toolBytes = readFileSync(aapt), toolSha256 = sha256(toolBytes);
    if (apkBytes.length !== WT_FIRST_PARTY_APK_SIZE_BYTES || sha256(apkBytes) !== WT_FIRST_PARTY_APK_SHA256 || toolSha256 !== WT_FIRST_PARTY_AAPT_SHA256) throw new Error("WT first-party APK/tool pin mismatch");
    let version: string, badging: string;
    try {
        version = execFileSync(aapt, ["version"], { encoding: "utf8", windowsHide: true, timeout: 10000, maxBuffer: 1024 * 1024 }).trim();
        badging = execFileSync(aapt, ["dump", "badging", apk], { encoding: "utf8", windowsHide: true, timeout: 30000, maxBuffer: 8 * 1024 * 1024 });
    } catch { throw new Error("WT first-party APK identity extraction failed"); }
    const finalApkBytes = readFileSync(apk), finalToolBytes = readFileSync(aapt);
    if (finalApkBytes.length !== apkBytes.length || sha256(finalApkBytes) !== WT_FIRST_PARTY_APK_SHA256 || finalToolBytes.length !== toolBytes.length || sha256(finalToolBytes) !== toolSha256) throw new Error("WT first-party identity evidence changed during extraction");
    if (version !== WT_FIRST_PARTY_AAPT_VERSION) throw new Error("WT first-party identity tool version mismatch");
    const packageRows = badging.split(/\r?\n/).filter(line => line.startsWith("package: "));
    if (packageRows.length !== 1) throw new Error("WT first-party APK package identity is ambiguous");
    const match = /^package: name='([^']+)'(?:\s|$)/.exec(packageRows[0]);
    if (!match || !match[1]) throw new Error("WT first-party APK package identity is malformed");
    const packageIdentity = match[1], evidence: WtFirstPartyAppIdentityEvidence = {
        schemaVersion: 1,
        contract: "dokkan-wt-first-party-app-identity",
        rule: WT_FIRST_PARTY_APP_IDENTITY_RULE,
        apk: { sizeBytes: WT_FIRST_PARTY_APK_SIZE_BYTES, sha256: WT_FIRST_PARTY_APK_SHA256 },
        tool: { name: "aapt", executableSha256: WT_FIRST_PARTY_AAPT_SHA256, version: WT_FIRST_PARTY_AAPT_VERSION, command: "aapt dump badging <pinned-apk>" },
        identity: { jsonType: "string", sizeBytes: WT_FIRST_PARTY_APP_IDENTITY_SIZE_BYTES, sha256: WT_FIRST_PARTY_APP_IDENTITY_SHA256 },
    };
    const proof = { packageIdentity, evidence };
    if (!validateWtFirstPartyAppIdentityProof(proof)) throw new Error("WT first-party APK identity proof is invalid");
    return proof;
}
