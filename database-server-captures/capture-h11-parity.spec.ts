import assert = require("assert");
import { validateCaptureH11 } from "./capture-h11-parity";

describe("capture H11 parity", () => {
    it("rejects totals that hide comparison cells", () => {
        const dataset: any = {
            schemaVersion: 1,
            contract: "dokkan-official-capture-extension-shadow-parity",
            contractVersion: "0.12.0",
            generatedAt: "2026-08-10T00:00:00Z",
            generatedAtPolicy: "inherits_h10_capture_timestamp",
            collectionMode: "offline_pinned_shadow_comparison_no_requests",
            productionMutation: false,
            defaultEnabled: false,
            authority: "shadow_only_zero_conflicts_does_not_prove_completeness",
            aggregationPolicy: "non_exclusive_comparison_cells_may_overlap",
            sourceLockSha256: "a".repeat(64),
            sourceCoverage: ["E0-E9", "H0-H7", "H8-H10", "K0-K9", "S0-S7"].map(series => ({ series })),
            comparisons: [{ key: "synthetic", includedInTotals: true, counts: { agreement: 1, representationGain: 0, confirmedConflict: 0, unknown: 0, unjoinable: 0 } }],
            comparisonCellTotals: { agreement: 0, representationGain: 0, confirmedConflict: 0, unknown: 0, unjoinable: 0 },
        };
        assert.equal(validateCaptureH11(dataset).valid, false);
    });
});
