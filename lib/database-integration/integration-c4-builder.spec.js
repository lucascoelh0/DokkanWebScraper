"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const integration_c4_builder_1 = require("./integration-c4-builder");
const integration_c4_validator_1 = require("./integration-c4-validator");
const inspection = { tableCount: 1, tables: [{ name: "passive_skills", columns: ["id", "efficacy_type"], rowCount: 2 }] };
const schemaSha256 = (0, integration_c4_builder_1.integrationC4SchemaSha256)(inspection);
const baseline = { schemaVersion: 1, contractVersion: "1.0.0", snapshotVersion: "snapshot", sourceDatabase: { sha256: "db", sizeBytes: 10, tableCount: 1, schemaSha256, requiredTables: { passive_skills: ["id", "efficacy_type"] } }, nativeRuntime: { sha256: "elf", sizeBytes: 20, elfClass: 64, endian: "little", machine: 183 }, semanticInputs: { DB48: { contractVersion: "1", sha256: "48" }, DB49: { contractVersion: "1", sha256: "49" }, DB50: { contractVersion: "1", sha256: "50" } } };
const observed = () => ({ sourceDatabase: { sha256: "db", sizeBytes: 10, modifiedAtMs: 1, tableCount: 1, schemaSha256, inspection: JSON.parse(JSON.stringify(inspection)) }, nativeRuntime: { sha256: "elf", sizeBytes: 20, modifiedAtMs: 1, elfClass: 64, endian: "little", machine: 183 }, semanticInputs: { DB48: { contractVersion: "1", sha256: "48", sourceDatabaseSha256: "db", nativeRuntimeSha256: "elf" }, DB49: { contractVersion: "1", sha256: "49", sourceDatabaseSha256: "db", nativeRuntimeSha256: "elf" }, DB50: { contractVersion: "1", sha256: "50", sourceDatabaseSha256: "db", nativeRuntimeSha256: "elf" } } });
describe("database-first integration C4 focused refresh compatibility", () => {
    it("accepts only the exact pinned source/evidence chain", () => { const result = (0, integration_c4_builder_1.evaluateIntegrationC4Compatibility)(baseline, observed()); (0, assert_1.equal)(result.status, "compatible"); (0, assert_1.equal)(result.issues.length, 0); });
    it("rejects changed SQLite, ELF and semantic artifacts independently", () => {
        for (const mutate of [(value) => value.sourceDatabase.sha256 = "new-db", (value) => value.sourceDatabase.schemaSha256 = "new-schema", (value) => value.nativeRuntime.sha256 = "new-elf", (value) => value.semanticInputs.DB49.sha256 = "new-49", (value) => value.semanticInputs.DB50.sourceDatabaseSha256 = "old-db"]) {
            const value = observed();
            mutate(value);
            (0, assert_1.equal)((0, integration_c4_builder_1.evaluateIntegrationC4Compatibility)(baseline, value).status, "incompatible");
        }
    });
    it("rejects a missing required column even if the supplied schema hash is forged", () => { const value = observed(); value.sourceDatabase.inspection.tables[0].columns = ["id"]; (0, assert_1.equal)((0, integration_c4_builder_1.evaluateIntegrationC4Compatibility)(baseline, value).issues.some(issue => issue.code === "required_table_or_column_missing"), true); });
    it("keeps row counts outside the schema fingerprint", () => { const changed = JSON.parse(JSON.stringify(inspection)); changed.tables[0].rowCount = 999; (0, assert_1.equal)((0, integration_c4_builder_1.integrationC4SchemaSha256)(changed), schemaSha256); });
    it("forbids a refresh receipt when compatibility is broken", () => { const value = observed(); value.nativeRuntime.sha256 = "changed"; const report = (0, integration_c4_builder_1.evaluateIntegrationC4Compatibility)(baseline, value), receipt = { mode: "focused_c1_c2_c3_no_db0_db50_replay", readOnlySourceGuarantee: true }; (0, assert_1.equal)((0, integration_c4_validator_1.validateIntegrationC4Artifacts)(report, report).valid, true); (0, assert_1.equal)((0, integration_c4_validator_1.validateIntegrationC4Artifacts)(report, report, receipt).valid, false); });
});
//# sourceMappingURL=integration-c4-builder.spec.js.map