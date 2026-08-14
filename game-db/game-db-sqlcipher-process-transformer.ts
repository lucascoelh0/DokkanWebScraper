import { isAbsolute } from "path";
import type { DerivedSqliteTransformer } from "./game-db-derived-sqlite-artifact-runner";

export type SqlcipherMaterialEncoding = "utf8_passphrase" | "raw_bytes";

export interface LocalSqlcipherProcessTransformerOptions {
    runtimeProfile: "approved_sqlcipher_bundle_v1",
    runtimeBundleRoot: string,
    runtimeBundleIdentity: string,
    cipherCompatibility: 3 | 4,
    materialEncoding: SqlcipherMaterialEncoding,
    processTimeoutMs: number,
}

interface ApprovedSqlcipherRuntimeBundle {
    identity: string,
    transformImplementationIdentity: string,
}

// DQ6 deliberately has no executable authority. Adding an entry requires an
// OS-bound launcher design that cannot reopen a validated executable by path.
const APPROVED_SQLCIPHER_RUNTIME_BUNDLES: Readonly<Record<string, ApprovedSqlcipherRuntimeBundle>> = Object.freeze({});
const MAX_PROCESS_TIMEOUT_MS = 120_000;
const NO_APPROVED_RUNTIME = "No approved SQLCipher runtime bundle matches the requested identity";

function isPlainObject(value: unknown): value is Record<string, unknown> {
    if (typeof value !== "object" || value === null || Object.getPrototypeOf(value) !== Object.prototype) return false;
    return Object.values(Object.getOwnPropertyDescriptors(value)).every(descriptor =>
        Object.prototype.hasOwnProperty.call(descriptor, "value") && descriptor.enumerable);
}

function hasExactKeys(value: Record<string, unknown>, expected: string[]): boolean {
    const actual = Object.keys(value).sort();
    return actual.length === expected.length && actual.every((key, index) => key === [...expected].sort()[index]);
}

function validateSelection(value: unknown): LocalSqlcipherProcessTransformerOptions {
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
        || !isAbsolute(value.runtimeBundleRoot)
        || value.runtimeBundleRoot.includes("\0")
        || typeof value.runtimeBundleIdentity !== "string"
        || !/^[a-f0-9]{64}$/.test(value.runtimeBundleIdentity)
        || (value.cipherCompatibility !== 3 && value.cipherCompatibility !== 4)
        || (value.materialEncoding !== "utf8_passphrase" && value.materialEncoding !== "raw_bytes")
        || !Number.isSafeInteger(value.processTimeoutMs)
        || (value.processTimeoutMs as number) < 10
        || (value.processTimeoutMs as number) > MAX_PROCESS_TIMEOUT_MS) {
        throw new Error("SQLCipher runtime bundle selection is invalid");
    }
    return value as unknown as LocalSqlcipherProcessTransformerOptions;
}

/**
 * Fail-closed DQ6 authority boundary.
 *
 * No portable Node API can execute an already-validated executable handle.
 * Until an approved OS-bound launcher exists, this factory cannot return a
 * transformer and no productive process can receive a DQ source or secret.
 */
export async function createLocalSqlcipherProcessTransformer(
    value: LocalSqlcipherProcessTransformerOptions,
): Promise<DerivedSqliteTransformer> {
    const selection = validateSelection(value);
    if (!APPROVED_SQLCIPHER_RUNTIME_BUNDLES[selection.runtimeBundleIdentity]) {
        throw new Error(NO_APPROVED_RUNTIME);
    }

    // The allowlist is intentionally empty. This guard prevents a future entry
    // from silently turning pathname validation into executable authority.
    throw new Error("Approved SQLCipher runtime bundles require an OS-bound launcher");
}
