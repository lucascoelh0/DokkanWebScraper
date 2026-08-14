import { createHash } from "crypto";

export const DERIVED_SQLITE_MAX_BYTES = 112 * 1024 * 1024;
export const DERIVED_SQLITE_HEADER = Buffer.from("SQLite format 3\u0000", "utf8");

export type DerivedJsonValue = null | boolean | number | string | DerivedJsonValue[] | { [key: string]: DerivedJsonValue };
export type DerivedJsonObject = { [key: string]: DerivedJsonValue };

export interface DerivedTransformImplementation {
    identity: string,
    version: string,
    sha256: string,
}

export interface DerivedTransformSpecification {
    kind: "sqlcipher_decrypt",
    implementation: DerivedTransformImplementation,
    nonSecretParameters: DerivedJsonObject,
}

export interface GameDbDerivedSqliteArtifactMetadata {
    schemaVersion: 1,
    contract: "dokkan-game-db-derived-sqlite-artifact",
    contractVersion: "1.0.0",
    parent: {
        contract: "dokkan-game-db-acquired-artifact",
        artifactIdentity: string,
        sourceSha256: string,
        sourceSizeBytes: number,
        sourceState: "readable_sqlite" | "encrypted_or_packaged",
    },
    transform: DerivedTransformSpecification,
    output: {
        sha256: string,
        sizeBytes: number,
        state: "readable_sqlite",
    },
}

export interface GameDbDerivedSqliteCommitMarker {
    schemaVersion: 1,
    contract: "dokkan-game-db-derived-sqlite-artifact-commit",
    contractVersion: "1.0.0",
    identity: string,
    metadataSha256: string,
}

export interface GameDbDerivedSqliteOperationalReceipt {
    schemaVersion: 1,
    contract: "dokkan-game-db-derived-sqlite-operation",
    contractVersion: "1.0.0",
    mode: "derived_sqlite_transform",
    completedAt: string,
    result: "created" | "reused",
    artifactIdentity: string,
    parentArtifactIdentity: string,
    transformKind: "sqlcipher_decrypt",
    transformImplementationIdentity: string,
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, expected: string[]): boolean {
    const actual = Object.keys(value).sort();
    return JSON.stringify(actual) === JSON.stringify([...expected].sort());
}

function cloneCanonicalValue(value: unknown, depth: number, keyPath: string): DerivedJsonValue {
    if (depth > 8) throw new Error("Derived transform parameters exceed the maximum nesting depth");
    if (value === null || typeof value === "boolean") return value;
    if (typeof value === "number") {
        if (!Number.isFinite(value) || Object.is(value, -0)) throw new Error("Derived transform parameters contain a non-canonical number");
        return value;
    }
    if (typeof value === "string") {
        if (value.length > 512 || value.includes("\0") || /[^\x20-\x7e]/.test(value)) throw new Error("Derived transform parameters contain an invalid string");
        if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value) || /^[a-zA-Z]:[\\/]/.test(value) || value.startsWith("/") || value.startsWith("\\\\") || value.split(/[\\/]/).includes("..")) {
            throw new Error("Derived transform parameters must not contain URLs or filesystem paths");
        }
        return value;
    }
    if (Array.isArray(value)) {
        if (value.length > 64) throw new Error("Derived transform parameter array is too large");
        return value.map((item, index) => cloneCanonicalValue(item, depth + 1, `${keyPath}[${index}]`));
    }
    if (!isJsonObject(value) || Object.getPrototypeOf(value) !== Object.prototype) throw new Error("Derived transform parameters must contain only plain JSON values");
    const keys = Object.keys(value).sort();
    if (keys.length > 64) throw new Error("Derived transform parameter object is too large");
    const result: DerivedJsonObject = {};
    for (const key of keys) {
        if (!/^[A-Za-z][A-Za-z0-9]{0,63}$/.test(key)) throw new Error("Derived transform parameter names are invalid");
        if (/(key|secret|password|token|credential|url|uri|header|query|path|account|timestamp|createdAt|completedAt|updatedAt|startedAt|finishedAt)/i.test(key)) {
            throw new Error("Derived transform parameters contain a prohibited field");
        }
        result[key] = cloneCanonicalValue(value[key], depth + 1, keyPath ? `${keyPath}.${key}` : key);
    }
    return result;
}

export function canonicalizeDerivedParameters(value: unknown): DerivedJsonObject {
    if (!isJsonObject(value) || Object.getPrototypeOf(value) !== Object.prototype) throw new Error("Derived transform nonSecretParameters must be a plain JSON object");
    const canonical = cloneCanonicalValue(value, 0, "");
    if (Array.isArray(canonical) || canonical === null || typeof canonical !== "object") throw new Error("Derived transform nonSecretParameters must be an object");
    if (Buffer.byteLength(JSON.stringify(canonical), "utf8") > 16 * 1024) throw new Error("Derived transform parameters exceed the byte limit");
    return canonical as DerivedJsonObject;
}

export function validateDerivedTransformSpecification(value: unknown): DerivedTransformSpecification {
    if (!isJsonObject(value) || !exactKeys(value, ["kind", "implementation", "nonSecretParameters"]) || value.kind !== "sqlcipher_decrypt") {
        throw new Error("Derived transform specification is invalid");
    }
    if (!isJsonObject(value.implementation) || !exactKeys(value.implementation, ["identity", "version", "sha256"])) throw new Error("Derived transform implementation is invalid");
    const implementation = value.implementation;
    if (typeof implementation.identity !== "string" || !/^[a-z0-9][a-z0-9._-]{0,127}$/.test(implementation.identity)
        || typeof implementation.version !== "string" || !/^[A-Za-z0-9][A-Za-z0-9.+_-]{0,63}$/.test(implementation.version)
        || typeof implementation.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(implementation.sha256)) {
        throw new Error("Derived transform implementation fields are invalid");
    }
    return {
        kind: "sqlcipher_decrypt",
        implementation: { identity: implementation.identity, version: implementation.version, sha256: implementation.sha256 },
        nonSecretParameters: canonicalizeDerivedParameters(value.nonSecretParameters),
    };
}

export function canonicalDerivedJson(value: unknown): string {
    return `${JSON.stringify(value, null, 2)}\n`;
}

export function derivedSqliteArtifactIdentity(metadata: GameDbDerivedSqliteArtifactMetadata): string {
    return createHash("sha256").update(canonicalDerivedJson(metadata)).digest("hex");
}

export function parseDerivedSqliteArtifactMetadata(value: unknown): GameDbDerivedSqliteArtifactMetadata {
    if (!isJsonObject(value) || !exactKeys(value, ["schemaVersion", "contract", "contractVersion", "parent", "transform", "output"])
        || value.schemaVersion !== 1 || value.contract !== "dokkan-game-db-derived-sqlite-artifact" || value.contractVersion !== "1.0.0") {
        throw new Error("Derived SQLite metadata contract is invalid");
    }
    if (!isJsonObject(value.parent) || !exactKeys(value.parent, ["contract", "artifactIdentity", "sourceSha256", "sourceSizeBytes", "sourceState"])
        || value.parent.contract !== "dokkan-game-db-acquired-artifact"
        || typeof value.parent.artifactIdentity !== "string" || !/^[a-f0-9]{64}$/.test(value.parent.artifactIdentity)
        || typeof value.parent.sourceSha256 !== "string" || !/^[a-f0-9]{64}$/.test(value.parent.sourceSha256)
        || !Number.isSafeInteger(value.parent.sourceSizeBytes) || (value.parent.sourceSizeBytes as number) <= 0
        || (value.parent.sourceState !== "readable_sqlite" && value.parent.sourceState !== "encrypted_or_packaged")) {
        throw new Error("Derived SQLite parent lineage is invalid");
    }
    if (!isJsonObject(value.output) || !exactKeys(value.output, ["sha256", "sizeBytes", "state"])
        || typeof value.output.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(value.output.sha256)
        || !Number.isSafeInteger(value.output.sizeBytes) || (value.output.sizeBytes as number) <= 0 || (value.output.sizeBytes as number) > DERIVED_SQLITE_MAX_BYTES
        || value.output.state !== "readable_sqlite") {
        throw new Error("Derived SQLite output identity is invalid");
    }
    const transform = validateDerivedTransformSpecification(value.transform);
    return {
        schemaVersion: 1,
        contract: "dokkan-game-db-derived-sqlite-artifact",
        contractVersion: "1.0.0",
        parent: {
            contract: "dokkan-game-db-acquired-artifact",
            artifactIdentity: value.parent.artifactIdentity,
            sourceSha256: value.parent.sourceSha256,
            sourceSizeBytes: value.parent.sourceSizeBytes as number,
            sourceState: value.parent.sourceState,
        },
        transform,
        output: { sha256: value.output.sha256, sizeBytes: value.output.sizeBytes as number, state: "readable_sqlite" },
    };
}

export function parseDerivedSqliteCommitMarker(value: unknown): GameDbDerivedSqliteCommitMarker {
    if (!isJsonObject(value) || !exactKeys(value, ["schemaVersion", "contract", "contractVersion", "identity", "metadataSha256"])
        || value.schemaVersion !== 1 || value.contract !== "dokkan-game-db-derived-sqlite-artifact-commit" || value.contractVersion !== "1.0.0"
        || typeof value.identity !== "string" || !/^[a-f0-9]{64}$/.test(value.identity)
        || typeof value.metadataSha256 !== "string" || !/^[a-f0-9]{64}$/.test(value.metadataSha256)) {
        throw new Error("Derived SQLite commit marker is invalid");
    }
    return value as unknown as GameDbDerivedSqliteCommitMarker;
}
