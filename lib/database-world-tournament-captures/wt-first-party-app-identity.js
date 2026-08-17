"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractWtFirstPartyAppIdentity = exports.validateWtFirstPartyAppIdentityProof = exports.WT_FIRST_PARTY_APP_IDENTITY_SHA256 = exports.WT_FIRST_PARTY_APP_IDENTITY_SIZE_BYTES = exports.WT_FIRST_PARTY_AAPT_VERSION = exports.WT_FIRST_PARTY_AAPT_SHA256 = exports.WT_FIRST_PARTY_APK_SHA256 = exports.WT_FIRST_PARTY_APK_SIZE_BYTES = exports.WT_FIRST_PARTY_APP_IDENTITY_RULE = void 0;
const child_process_1 = require("child_process");
const crypto_1 = require("crypto");
const fs_1 = require("fs");
exports.WT_FIRST_PARTY_APP_IDENTITY_RULE = "public_first_party_app_bundle_identity_v1";
exports.WT_FIRST_PARTY_APK_SIZE_BYTES = 98799013;
exports.WT_FIRST_PARTY_APK_SHA256 = "a51ba758e0555e0a756aa4f20278e6bec25ba6b0c7dcdcd0f4372e0fad159bc0";
exports.WT_FIRST_PARTY_AAPT_SHA256 = "3a79b1b3f6e68d83a0eb5fe82bd557f51c6c02f07355ee0ad293c5ea43e32427";
exports.WT_FIRST_PARTY_AAPT_VERSION = "Android Asset Packaging Tool, v0.2-12874835";
exports.WT_FIRST_PARTY_APP_IDENTITY_SIZE_BYTES = 32;
exports.WT_FIRST_PARTY_APP_IDENTITY_SHA256 = "74d2f87b503e9ff38f27298af6942a1a1898d1aef543b6c85720205e92cd0888";
const sha256 = (value) => (0, crypto_1.createHash)("sha256").update(value).digest("hex");
function validateWtFirstPartyAppIdentityProof(value) {
    if (!value || typeof value.packageIdentity !== "string" || value.packageIdentity.length === 0)
        return false;
    const evidence = value.evidence;
    return evidence?.schemaVersion === 1
        && evidence.contract === "dokkan-wt-first-party-app-identity"
        && evidence.rule === exports.WT_FIRST_PARTY_APP_IDENTITY_RULE
        && evidence.apk?.sizeBytes === exports.WT_FIRST_PARTY_APK_SIZE_BYTES
        && evidence.apk?.sha256 === exports.WT_FIRST_PARTY_APK_SHA256
        && evidence.tool?.name === "aapt"
        && evidence.tool.executableSha256 === exports.WT_FIRST_PARTY_AAPT_SHA256
        && evidence.tool.version === exports.WT_FIRST_PARTY_AAPT_VERSION
        && evidence.tool.command === "aapt dump badging <pinned-apk>"
        && evidence.identity?.jsonType === "string"
        && evidence.identity.sizeBytes === exports.WT_FIRST_PARTY_APP_IDENTITY_SIZE_BYTES
        && evidence.identity.sha256 === exports.WT_FIRST_PARTY_APP_IDENTITY_SHA256
        && Buffer.byteLength(value.packageIdentity) === exports.WT_FIRST_PARTY_APP_IDENTITY_SIZE_BYTES
        && sha256(value.packageIdentity) === exports.WT_FIRST_PARTY_APP_IDENTITY_SHA256;
}
exports.validateWtFirstPartyAppIdentityProof = validateWtFirstPartyAppIdentityProof;
function extractWtFirstPartyAppIdentity(apkPath, aaptPath) {
    if (!apkPath || !aaptPath)
        throw new Error("WT first-party identity evidence paths are required");
    const apk = (0, fs_1.realpathSync)(apkPath), aapt = (0, fs_1.realpathSync)(aaptPath), apkInfo = (0, fs_1.statSync)(apk), toolInfo = (0, fs_1.statSync)(aapt);
    if (!apkInfo.isFile() || !toolInfo.isFile())
        throw new Error("WT first-party identity evidence must use regular files");
    const apkBytes = (0, fs_1.readFileSync)(apk), toolBytes = (0, fs_1.readFileSync)(aapt), toolSha256 = sha256(toolBytes);
    if (apkBytes.length !== exports.WT_FIRST_PARTY_APK_SIZE_BYTES || sha256(apkBytes) !== exports.WT_FIRST_PARTY_APK_SHA256 || toolSha256 !== exports.WT_FIRST_PARTY_AAPT_SHA256)
        throw new Error("WT first-party APK/tool pin mismatch");
    let version, badging;
    try {
        version = (0, child_process_1.execFileSync)(aapt, ["version"], { encoding: "utf8", windowsHide: true, timeout: 10000, maxBuffer: 1024 * 1024 }).trim();
        badging = (0, child_process_1.execFileSync)(aapt, ["dump", "badging", apk], { encoding: "utf8", windowsHide: true, timeout: 30000, maxBuffer: 8 * 1024 * 1024 });
    }
    catch {
        throw new Error("WT first-party APK identity extraction failed");
    }
    const finalApkBytes = (0, fs_1.readFileSync)(apk), finalToolBytes = (0, fs_1.readFileSync)(aapt);
    if (finalApkBytes.length !== apkBytes.length || sha256(finalApkBytes) !== exports.WT_FIRST_PARTY_APK_SHA256 || finalToolBytes.length !== toolBytes.length || sha256(finalToolBytes) !== toolSha256)
        throw new Error("WT first-party identity evidence changed during extraction");
    if (version !== exports.WT_FIRST_PARTY_AAPT_VERSION)
        throw new Error("WT first-party identity tool version mismatch");
    const packageRows = badging.split(/\r?\n/).filter(line => line.startsWith("package: "));
    if (packageRows.length !== 1)
        throw new Error("WT first-party APK package identity is ambiguous");
    const match = /^package: name='([^']+)'(?:\s|$)/.exec(packageRows[0]);
    if (!match || !match[1])
        throw new Error("WT first-party APK package identity is malformed");
    const packageIdentity = match[1], evidence = {
        schemaVersion: 1,
        contract: "dokkan-wt-first-party-app-identity",
        rule: exports.WT_FIRST_PARTY_APP_IDENTITY_RULE,
        apk: { sizeBytes: exports.WT_FIRST_PARTY_APK_SIZE_BYTES, sha256: exports.WT_FIRST_PARTY_APK_SHA256 },
        tool: { name: "aapt", executableSha256: exports.WT_FIRST_PARTY_AAPT_SHA256, version: exports.WT_FIRST_PARTY_AAPT_VERSION, command: "aapt dump badging <pinned-apk>" },
        identity: { jsonType: "string", sizeBytes: exports.WT_FIRST_PARTY_APP_IDENTITY_SIZE_BYTES, sha256: exports.WT_FIRST_PARTY_APP_IDENTITY_SHA256 },
    };
    const proof = { packageIdentity, evidence };
    if (!validateWtFirstPartyAppIdentityProof(proof))
        throw new Error("WT first-party APK identity proof is invalid");
    return proof;
}
exports.extractWtFirstPartyAppIdentity = extractWtFirstPartyAppIdentity;
//# sourceMappingURL=wt-first-party-app-identity.js.map