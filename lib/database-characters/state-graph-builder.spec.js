"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const state_graph_builder_1 = require("./state-graph-builder");
const state_graph_validator_1 = require("./state-graph-validator");
describe("database character state graph", () => {
    it("fails closed when a transition family is truncated", () => {
        const dataset = { schemaVersion: 1, contract: "dokkan-database-characters-state-graph", contractVersion: "1.0.0", generatedAt: "x", source: { snapshotVersion: "x", databaseSha256: "x", db1ArtifactSha256: "x", lineage: "validated-db1-stream-no-db0-db50-replay" }, policy: { numericIdProximityInference: false, cardIdentitySeparateFromPlayableState: true, uiGroupingSeparateFromCardIdentity: true, originalRarityOwnedByTaxonomySidecar: true }, states: [], releaseStateTransitions: [], awakeningTransitions: [], formTransitions: [] };
        const coverage = (0, state_graph_builder_1.buildDatabaseCharacterStateGraphCoverage)(dataset);
        assert.strictEqual((0, state_graph_validator_1.validateDatabaseCharacterStateGraphDataset)(dataset, coverage).valid, false);
    });
});
//# sourceMappingURL=state-graph-builder.spec.js.map