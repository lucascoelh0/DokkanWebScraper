"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLocalSqlcipherProcessTransformer = void 0;
const path_1 = require("path");
// DQ6 deliberately has no executable authority. Adding an entry requires an
// OS-bound launcher design that cannot reopen a validated executable by path.
const APPROVED_SQLCIPHER_RUNTIME_BUNDLES = Object.freeze({});
const MAX_PROCESS_TIMEOUT_MS = 120000;
const NO_APPROVED_RUNTIME = "No approved SQLCipher runtime bundle matches the requested identity";
function isPlainObject(value) {
    if (typeof value !== "object" || value === null || Object.getPrototypeOf(value) !== Object.prototype)
        return false;
    return Object.values(Object.getOwnPropertyDescriptors(value)).every(descriptor => Object.prototype.hasOwnProperty.call(descriptor, "value") && descriptor.enumerable);
}
function hasExactKeys(value, expected) {
    const actual = Object.keys(value).sort();
    return actual.length === expected.length && actual.every((key, index) => key === [...expected].sort()[index]);
}
function validateSelection(value) {
    const keys = [
        "cipherCompatibility",
        "materialEncoding",
        "processTimeoutMs",
        "runtimeBundleIdentity",
        "runtimeBundleRoot",
        "runtimeProfile",
    ];
    if (!isPlainObject(value) || !hasExactKeys(value, keys)
        || value.runtimeProfile !== "approved_sqlcipher_bundle_v1"
        || typeof value.runtimeBundleRoot !== "string"
        || !(0, path_1.isAbsolute)(value.runtimeBundleRoot)
        || value.runtimeBundleRoot.includes("\0")
        || typeof value.runtimeBundleIdentity !== "string"
        || !/^[a-f0-9]{64}$/.test(value.runtimeBundleIdentity)
        || (value.cipherCompatibility !== 3 && value.cipherCompatibility !== 4)
        || (value.materialEncoding !== "utf8_passphrase" && value.materialEncoding !== "raw_bytes")
        || !Number.isSafeInteger(value.processTimeoutMs)
        || value.processTimeoutMs < 10
        || value.processTimeoutMs > MAX_PROCESS_TIMEOUT_MS) {
        throw new Error("SQLCipher runtime bundle selection is invalid");
    }
    return value;
}
/**
 * Fail-closed DQ6 authority boundary.
 *
 * No portable Node API can execute an already-validated executable handle.
 * Until an approved OS-bound launcher exists, this factory cannot return a
 * transformer and no productive process can receive a DQ source or secret.
 */
async function createLocalSqlcipherProcessTransformer(value) {
    const selection = validateSelection(value);
    if (!APPROVED_SQLCIPHER_RUNTIME_BUNDLES[selection.runtimeBundleIdentity]) {
        throw new Error(NO_APPROVED_RUNTIME);
    }
    // The allowlist is intentionally empty. This guard prevents a future entry
    // from silently turning pathname validation into executable authority.
    throw new Error("Approved SQLCipher runtime bundles require an OS-bound launcher");
}
exports.createLocalSqlcipherProcessTransformer = createLocalSqlcipherProcessTransformer;
//# sourceMappingURL=game-db-sqlcipher-process-transformer.js.map