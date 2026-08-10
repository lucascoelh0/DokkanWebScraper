import assert = require("assert");
import { CaptureH13Observation } from "./capture-h13-contract";
import { classifyCanonicalGashaFact } from "./capture-h13-gasha-audit";

const fingerprint = "a".repeat(64);
function observation(overrides: Partial<CaptureH13Observation> = {}): CaptureH13Observation {
    return {
        side: "h10_observed", captureId: "synthetic-new", entryIndex: 1, observedAt: "2026-08-10T00:00:00.000Z", httpStatus: 200,
        gashaId: 100, endpoint: "/gashas/:id/rates", field: "featured_card_ids", value: 200,
        jsonCoordinate: "$.steps[].gasha_rates.featured_card_ids[]", step: 1, rateId: 10, rarity: null, rarityApplicability: "not_applicable_to_card_id_pool_coordinates", specialGashaId: null,
        period: { openAt: 1000, endAt: 2000, captureId: "synthetic-new", entryIndex: 0, observedAt: "2026-08-10T00:00:00.000Z" },
        captureStructuralFingerprint: fingerprint, captureSourceIdentityFingerprint: fingerprint, ...overrides,
    };
}

describe("capture H13 conservative gasha classification", () => {
    it("classifies a same-dimension value change across temporal windows as temporal_change", () => {
        const current = observation(), prior = observation({ side: "h4_baseline", captureId: "synthetic-old", observedAt: "2026-08-01T00:00:00.000Z", value: 201, period: { openAt: 500, endAt: 900, captureId: "synthetic-old", entryIndex: 0, observedAt: "2026-08-01T00:00:00.000Z" } });
        assert.equal(classifyCanonicalGashaFact(200, [current], [prior], true).classification, "temporal_change");
    });

    it("classifies a legacy pool union versus a dimensional element as representation_mismatch", () => {
        const current = observation(), prior = observation({ side: "h4_baseline", step: 2, rateId: 20, value: 201 });
        assert.equal(classifyCanonicalGashaFact(200, [current], [prior], true).classification, "representation_mismatch");
    });

    it("does not compare different step and rate dimensions as a conflict", () => {
        const current = observation({ step: 1, rateId: 10 }), prior = observation({ side: "h4_baseline", step: 3, rateId: 30, value: 201 });
        assert.equal(classifyCanonicalGashaFact(200, [current], [prior], true).classification, "representation_mismatch");
    });

    it("confirms only an incompatible value in the same dimension and proven window", () => {
        const current = observation(), prior = observation({ side: "h4_baseline", captureId: "synthetic-old", value: 201 });
        assert.equal(classifyCanonicalGashaFact(200, [current], [prior], true).classification, "confirmed_conflict");
    });

    it("classifies absence of an endpoint baseline as coverage_gap", () => {
        assert.equal(classifyCanonicalGashaFact(200, [observation()], [], true).classification, "coverage_gap");
    });
});
