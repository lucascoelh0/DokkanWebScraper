"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateIntegrationC4Compatibility = exports.integrationC4SchemaSha256 = void 0;
const crypto_1 = require("crypto");
function integrationC4SchemaSha256(inspection) {
    const canonical = inspection.tables.map(value => ({ name: value.name, columns: value.columns })).sort((left, right) => left.name.localeCompare(right.name));
    return (0, crypto_1.createHash)("sha256").update(JSON.stringify(canonical)).digest("hex");
}
exports.integrationC4SchemaSha256 = integrationC4SchemaSha256;
function evaluateIntegrationC4Compatibility(baseline, observed) {
    const issues = [], add = (code, subject, expected, actual) => issues.push({ code, subject, expected, actual });
    if (observed.sourceDatabase.sha256 !== baseline.sourceDatabase.sha256)
        add("database_hash_changed", "SQLite SHA-256", baseline.sourceDatabase.sha256, observed.sourceDatabase.sha256);
    if (observed.sourceDatabase.sizeBytes !== baseline.sourceDatabase.sizeBytes)
        add("database_size_changed", "SQLite size", baseline.sourceDatabase.sizeBytes, observed.sourceDatabase.sizeBytes);
    if (observed.sourceDatabase.tableCount !== baseline.sourceDatabase.tableCount || observed.sourceDatabase.schemaSha256 !== baseline.sourceDatabase.schemaSha256)
        add("database_schema_changed", "SQLite schema", { tableCount: baseline.sourceDatabase.tableCount, sha256: baseline.sourceDatabase.schemaSha256 }, { tableCount: observed.sourceDatabase.tableCount, sha256: observed.sourceDatabase.schemaSha256 });
    const tables = new Map(observed.sourceDatabase.inspection.tables.map(value => [value.name, new Set(value.columns)]));
    for (const [table, columns] of Object.entries(baseline.sourceDatabase.requiredTables))
        for (const column of columns)
            if (!tables.get(table)?.has(column))
                add("required_table_or_column_missing", `${table}.${column}`, true, false);
    if (observed.nativeRuntime.sha256 !== baseline.nativeRuntime.sha256)
        add("native_hash_changed", "ELF SHA-256", baseline.nativeRuntime.sha256, observed.nativeRuntime.sha256);
    if (observed.nativeRuntime.sizeBytes !== baseline.nativeRuntime.sizeBytes)
        add("native_size_changed", "ELF size", baseline.nativeRuntime.sizeBytes, observed.nativeRuntime.sizeBytes);
    if (observed.nativeRuntime.elfClass !== baseline.nativeRuntime.elfClass || observed.nativeRuntime.endian !== baseline.nativeRuntime.endian || observed.nativeRuntime.machine !== baseline.nativeRuntime.machine)
        add("native_format_changed", "ELF format", { elfClass: baseline.nativeRuntime.elfClass, endian: baseline.nativeRuntime.endian, machine: baseline.nativeRuntime.machine }, { elfClass: observed.nativeRuntime.elfClass, endian: observed.nativeRuntime.endian, machine: observed.nativeRuntime.machine });
    for (const gate of ["DB48", "DB49", "DB50"]) {
        const expected = baseline.semanticInputs[gate], actual = observed.semanticInputs[gate];
        if (actual.sha256 !== expected.sha256 || actual.contractVersion !== expected.contractVersion)
            add("semantic_artifact_changed", gate, expected, { contractVersion: actual.contractVersion, sha256: actual.sha256 });
        if (actual.sourceDatabaseSha256 !== observed.sourceDatabase.sha256 || actual.nativeRuntimeSha256 !== observed.nativeRuntime.sha256)
            add("semantic_artifact_source_mismatch", gate, { sourceDatabaseSha256: observed.sourceDatabase.sha256, nativeRuntimeSha256: observed.nativeRuntime.sha256 }, { sourceDatabaseSha256: actual.sourceDatabaseSha256, nativeRuntimeSha256: actual.nativeRuntimeSha256 });
    }
    const { inspection: _inspection, ...sourceDatabase } = observed.sourceDatabase;
    return { schemaVersion: 1, contract: "dokkan-database-first-focused-refresh-compatibility", contractVersion: "1.0.0", snapshotVersion: baseline.snapshotVersion, status: issues.length ? "incompatible" : "compatible", reusePolicy: "exact_evidence_identity_only", issues, sourceDatabase, nativeRuntime: observed.nativeRuntime };
}
exports.evaluateIntegrationC4Compatibility = evaluateIntegrationC4Compatibility;
//# sourceMappingURL=integration-c4-builder.js.map