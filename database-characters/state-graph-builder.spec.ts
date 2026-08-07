import assert = require("assert");
import { buildDatabaseCharacterStateGraphCoverage } from "./state-graph-builder";
import { DatabaseCharacterStateGraphDataset } from "./state-graph-contract";
import { validateDatabaseCharacterStateGraphDataset } from "./state-graph-validator";

describe("database character state graph", () => {
    it("fails closed when a transition family is truncated", () => {
        const dataset = { schemaVersion: 1, contract: "dokkan-database-characters-state-graph", contractVersion: "1.0.0", generatedAt: "x", source: { snapshotVersion: "x", databaseSha256: "x", db1ArtifactSha256: "x", lineage: "validated-db1-stream-no-db0-db50-replay" }, policy: { numericIdProximityInference: false, cardIdentitySeparateFromPlayableState: true, uiGroupingSeparateFromCardIdentity: true, originalRarityOwnedByTaxonomySidecar: true }, states: [], releaseStateTransitions: [], awakeningTransitions: [], formTransitions: [] } as DatabaseCharacterStateGraphDataset;
        const coverage = buildDatabaseCharacterStateGraphCoverage(dataset);
        assert.strictEqual(validateDatabaseCharacterStateGraphDataset(dataset, coverage).valid, false);
    });
});
