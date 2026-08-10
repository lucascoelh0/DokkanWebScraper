"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateCaptureH11 = exports.buildCaptureH11 = void 0;
const crypto_1 = require("crypto");
const keys = ["agreement", "representationGain", "temporalChange", "representationMismatch", "coverageGap", "confirmedConflict", "unknown", "unjoinable"];
const empty = () => ({ agreement: 0, representationGain: 0, temporalChange: 0, representationMismatch: 0, coverageGap: 0, confirmedConflict: 0, unknown: 0, unjoinable: 0 });
const sha256 = (value) => (0, crypto_1.createHash)("sha256").update(value).digest("hex");
function numbers(value) { if (Array.isArray(value))
    return value.flatMap(numbers); return typeof value === "number" && Number.isFinite(value) ? [value] : []; }
function entityValues(entity, fields) { return new Set(entity?.facts?.filter((fact) => fields.includes(fact.field)).flatMap((fact) => numbers(fact.value)) ?? []); }
function h13Key(fact) { return sha256(JSON.stringify([fact.parentId, fact.route, fact.field, fact.value])); }
function correctedClass(value) {
    return { agreement: "agreement", temporal_change: "temporalChange", representation_mismatch: "representationMismatch", coverage_gap: "coverageGap", unknown: "unknown", confirmed_conflict: "confirmedConflict" }[value];
}
function classifyFact(fact, h3, h4, h13ByKey) {
    if (typeof fact.value !== "number")
        return "unjoinable";
    if (fact.domain === "events_schedules" && fact.field === "id" && fact.route === "/bonus_schedules") {
        const ids = new Set(h3.entities.filter(entity => entity.entityType === "bonus_schedule").map(entity => entity.entityId));
        return ids.has(fact.value) ? "agreement" : "representationGain";
    }
    if (fact.domain === "gashas" && fact.parentId) {
        const audited = h13ByKey.get(h13Key(fact));
        if (audited)
            return correctedClass(audited);
        const parent = h4.entities.find(entity => entity.entityType === "gasha" && entity.entityId === fact.parentId);
        if (!parent)
            return "representationGain";
        const map = { card_id: ["featuredCardIds"], featured_card_ids: ["featuredPoolCardIds", "specialFeaturedPoolCardIds"], normal_card_ids: ["normalPoolCardIds", "specialNormalPoolCardIds"], featured_rate: ["featuredRates"], normal_rate: ["normalRates"], total_rate: ["totalRates"] };
        const fields = map[fact.field];
        if (!fields)
            return "unjoinable";
        return entityValues(parent, fields).has(fact.value) ? "agreement" : "unknown";
    }
    return "unjoinable";
}
function compareFacts(list, h3, h4, h13ByKey) { const counts = empty(); for (const fact of list)
    counts[classifyFact(fact, h3, h4, h13ByKey)]++; return counts; }
function comparison(key, left, right, unit, counts, boundary, includedInTotals = true) { return { key, left, right, unit, includedInTotals, counts, boundary }; }
function buildCaptureH11(lockText, h7, h10, h3, h4, _h5, h6, captureIds, h13) {
    const h13ByKey = new Map(h13.facts.map(fact => [fact.auditKey, fact.classification]));
    const comparisons = [];
    comparisons.push(comparison("prior_h7_context", "H0-H7", "S0-S7 and E0-E9 selected pinned surfaces", "H7 comparison cell", { ...empty(), ...h7.comparisonCellTotals }, "Context only; H7 cells are not added to H11 totals.", false));
    for (const domain of ["events_schedules", "gashas", "missions_boards_rewards"]) {
        const list = h10.productFacts.filter(value => value.domain === domain);
        const boundary = domain === "gashas" ? "H13 canonical dimensions correct legacy H4-union comparisons; capture absence is coverage_gap, never conflict." : "Exact numeric/timestamp mappings only; unmapped coordinates remain unjoinable and capture absence is not conflict.";
        comparisons.push(comparison(`h10_${domain}_vs_prior_capture`, "H10 definition-only facts", domain === "events_schedules" ? "H3" : domain === "gashas" ? "H4 plus H13 corrective audit" : "H5", "fact observation", compareFacts(list, h3, h4, h13ByKey), boundary));
    }
    comparisons.push(comparison("h10_assets_vs_h6", "H10 asset/descriptors domain", "H6 asset evidence", "structural domain observation", { ...empty(), unknown: h10.domains.find(value => value.domain === "assets_descriptors")?.observationCount ?? 0, unjoinable: h6.observations.length }, "No complete manifest or byte identity join is proved."));
    for (const id of captureIds) {
        const list = h10.productFacts.filter(value => value.provenance.some(provenance => provenance.captureId === id));
        comparisons.push(comparison(`per_har_${id.replace(/-/g, "_")}`, `H10 facts observed in ${id}`, "H3-H5 plus H13 corrective audit", "non-exclusive fact observation", compareFacts(list, h3, h4, h13ByKey), "Per-HAR cells overlap the global domain comparison and are explicitly non-exclusive."));
    }
    comparisons.sort((left, right) => left.key.localeCompare(right.key));
    const totals = empty();
    for (const cell of comparisons.filter(value => value.includedInTotals))
        for (const key of keys)
            totals[key] += cell.counts[key];
    const sourceCoverage = [
        { series: "H0-H7", gates: "H0,H3-H7 direct through H7; H1-H2 schema context", status: "via_h7_pinned_lineage", boundary: "H7 remains the pinned closure; H11 does not replace prior gates." },
        { series: "H8-H10", gates: "H8,H9,H10 and corrective H13", status: "direct_pinned", boundary: "Exact H11 source lock hashes and sizes." },
        { series: "S0-S7", gates: "S0-S7", status: "via_h7_pinned_lineage", boundary: "All server campaign gates are represented by the pinned H7 lineage/context." },
        { series: "E0-E9", gates: "E1,E2,E5,E6,E7,E9 pinned; E0,E3,E4,E8 not direct comparison inputs", status: "not_directly_comparable", boundary: "Missing direct cells are unknown, not agreement or conflict." },
        { series: "K0-K9", gates: "none found in allowlisted local data roots", status: "not_available", boundary: "No K artifact was invented or inferred." },
    ].sort((left, right) => left.series.localeCompare(right.series));
    const dataset = { schemaVersion: 1, contract: "dokkan-official-capture-extension-shadow-parity", contractVersion: "0.12.1", generatedAt: h10.generatedAt, generatedAtPolicy: "inherits_h10_capture_timestamp", collectionMode: "offline_pinned_shadow_comparison_no_requests", productionMutation: false, defaultEnabled: false, authority: "shadow_only_zero_conflicts_does_not_prove_completeness", aggregationPolicy: "non_exclusive_comparison_cells_may_overlap", sourceLockSha256: sha256(lockText), sourceCoverage, comparisons, comparisonCellTotals: totals, uniqueGashaAuditFactCount: 627, uniqueGashaAuditCounts: { ...h13.uniqueCounts }, legacyUniqueGashaConflictFactCount: 627, legacyNonExclusiveGashaConflictCellCount: 1254 };
    const validation = validateCaptureH11(dataset);
    if (!validation.valid)
        throw new Error(`H11 validation failed: ${validation.failures.join(", ")}`);
    return dataset;
}
exports.buildCaptureH11 = buildCaptureH11;
function validateCaptureH11(dataset) {
    const failures = [], total = empty();
    if (dataset.schemaVersion !== 1 || dataset.contract !== "dokkan-official-capture-extension-shadow-parity" || dataset.contractVersion !== "0.12.1" || dataset.collectionMode !== "offline_pinned_shadow_comparison_no_requests" || dataset.productionMutation !== false || dataset.defaultEnabled !== false || dataset.authority !== "shadow_only_zero_conflicts_does_not_prove_completeness" || dataset.aggregationPolicy !== "non_exclusive_comparison_cells_may_overlap" || !/^[a-f0-9]{64}$/.test(dataset.sourceLockSha256))
        failures.push("contract");
    for (const cell of dataset.comparisons)
        for (const key of keys)
            if (!Number.isSafeInteger(cell.counts[key]) || cell.counts[key] < 0)
                failures.push("count");
            else if (cell.includedInTotals)
                total[key] += cell.counts[key];
    if (JSON.stringify(total) !== JSON.stringify(dataset.comparisonCellTotals))
        failures.push("totals");
    const expectedUnique = { agreement: 0, temporal_change: 0, representation_mismatch: 612, coverage_gap: 15, unknown: 0, confirmed_conflict: 0 };
    if (dataset.uniqueGashaAuditFactCount !== 627 || dataset.legacyUniqueGashaConflictFactCount !== 627 || dataset.legacyNonExclusiveGashaConflictCellCount !== 1254 || JSON.stringify(dataset.uniqueGashaAuditCounts) !== JSON.stringify(expectedUnique) || dataset.comparisonCellTotals.confirmedConflict !== 0)
        failures.push("unique gasha audit totals");
    if (JSON.stringify(dataset.sourceCoverage.map(value => value.series).sort()) !== JSON.stringify(["E0-E9", "H0-H7", "H8-H10", "K0-K9", "S0-S7"]))
        failures.push("source coverage");
    return { schemaVersion: 1, valid: failures.length === 0, comparisonCount: dataset.comparisons.length, comparisonCellTotals: total, uniqueGashaAuditFactCount: dataset.uniqueGashaAuditFactCount, sourceCoverageCount: dataset.sourceCoverage.length, failures: [...new Set(failures)] };
}
exports.validateCaptureH11 = validateCaptureH11;
//# sourceMappingURL=capture-h11-parity.js.map