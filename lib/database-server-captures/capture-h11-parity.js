"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateCaptureH11 = exports.buildCaptureH11 = void 0;
const crypto_1 = require("crypto");
const keys = ["agreement", "representationGain", "confirmedConflict", "unknown", "unjoinable"];
const empty = () => ({ agreement: 0, representationGain: 0, confirmedConflict: 0, unknown: 0, unjoinable: 0 });
const sha256 = (v) => (0, crypto_1.createHash)("sha256").update(v).digest("hex");
function numbers(v) { if (Array.isArray(v))
    return v.flatMap(numbers); return typeof v === "number" && Number.isFinite(v) ? [v] : []; }
function entityValues(entity, fields) { return new Set(entity?.facts?.filter((f) => fields.includes(f.field)).flatMap((f) => numbers(f.value)) ?? []); }
function classifyFact(f, h3, h4) { if (typeof f.value !== "number")
    return "unjoinable"; if (f.domain === "events_schedules" && f.field === "id" && f.route === "/bonus_schedules") {
    const ids = new Set(h3.entities.filter(e => e.entityType === "bonus_schedule").map(e => e.entityId));
    return ids.has(f.value) ? "agreement" : "representationGain";
} if (f.domain === "gashas" && f.parentId) {
    const parent = h4.entities.find(e => e.entityType === "gasha" && e.entityId === f.parentId);
    if (!parent)
        return "representationGain";
    const map = { card_id: ["featuredCardIds"], featured_card_ids: ["featuredPoolCardIds", "specialFeaturedPoolCardIds"], normal_card_ids: ["normalPoolCardIds", "specialNormalPoolCardIds"], featured_rate: ["featuredRates"], normal_rate: ["normalRates"], total_rate: ["totalRates"] };
    const fields = map[f.field];
    if (!fields)
        return "unjoinable";
    return entityValues(parent, fields).has(f.value) ? "agreement" : "confirmedConflict";
} return "unjoinable"; }
function compareFacts(list, h3, h4, _h5) { const c = empty(); for (const fact of list)
    c[classifyFact(fact, h3, h4)]++; return c; }
function comparison(key, left, right, unit, counts, boundary, includedInTotals = true) { return { key, left, right, unit, includedInTotals, counts, boundary }; }
function buildCaptureH11(lockText, h7, h10, h3, h4, h5, h6, captureIds) { const comparisons = []; comparisons.push(comparison("prior_h7_context", "H0-H7", "S0-S7 and E0-E9 selected pinned surfaces", "H7 comparison cell", { ...h7.comparisonCellTotals }, "Context only; H7 cells are not added to H11 totals.", false)); for (const domain of ["events_schedules", "gashas", "missions_boards_rewards"]) {
    const list = h10.productFacts.filter(v => v.domain === domain);
    comparisons.push(comparison(`h10_${domain}_vs_prior_capture`, "H10 definition-only facts", domain === "events_schedules" ? "H3" : domain === "gashas" ? "H4" : "H5", "fact observation", compareFacts(list, h3, h4, h5), "Exact numeric/timestamp mappings only; unmapped coordinates remain unjoinable and capture absence is not conflict."));
} comparisons.push(comparison("h10_assets_vs_h6", "H10 asset/descriptors domain", "H6 asset evidence", "structural domain observation", { ...empty(), unknown: h10.domains.find(v => v.domain === "assets_descriptors")?.observationCount ?? 0, unjoinable: h6.observations.length }, "No complete manifest or byte identity join is proved.")); for (const id of captureIds) {
    const list = h10.productFacts.filter(v => v.provenance.some(p => p.captureId === id));
    comparisons.push(comparison(`per_har_${id.replace(/-/g, "_")}`, `H10 facts observed in ${id}`, "H3-H5 pinned capture sidecars", "non-exclusive fact observation", compareFacts(list, h3, h4, h5), "Per-HAR gains overlap when a fact appears in multiple captures."));
} comparisons.sort((a, b) => a.key.localeCompare(b.key)); const totals = empty(); for (const c of comparisons.filter(v => v.includedInTotals))
    for (const key of keys)
        totals[key] += c.counts[key]; const sourceCoverage = [{ series: "H0-H7", gates: "H0,H3-H7 direct through H7; H1-H2 schema context", status: "via_h7_pinned_lineage", boundary: "H7 remains the pinned closure; H11 does not replace prior gates." }, { series: "H8-H10", gates: "H8,H9,H10", status: "direct_pinned", boundary: "Exact H11 source lock hashes and sizes." }, { series: "S0-S7", gates: "S0-S7", status: "via_h7_pinned_lineage", boundary: "All server campaign gates are represented by the pinned H7 lineage/context." }, { series: "E0-E9", gates: "E1,E2,E5,E6,E7,E9 pinned; E0,E3,E4,E8 not direct comparison inputs", status: "not_directly_comparable", boundary: "Missing direct cells are unknown, not agreement or conflict." }, { series: "K0-K9", gates: "none found in allowlisted local data roots", status: "not_available", boundary: "No K artifact was invented or inferred." }].sort((a, b) => a.series.localeCompare(b.series)); const d = { schemaVersion: 1, contract: "dokkan-official-capture-extension-shadow-parity", contractVersion: "0.12.0", generatedAt: h10.generatedAt, generatedAtPolicy: "inherits_h10_capture_timestamp", collectionMode: "offline_pinned_shadow_comparison_no_requests", productionMutation: false, defaultEnabled: false, authority: "shadow_only_zero_conflicts_does_not_prove_completeness", aggregationPolicy: "non_exclusive_comparison_cells_may_overlap", sourceLockSha256: sha256(lockText), sourceCoverage, comparisons, comparisonCellTotals: totals }; const v = validateCaptureH11(d); if (!v.valid)
    throw new Error(`H11 validation failed: ${v.failures.join(", ")}`); return d; }
exports.buildCaptureH11 = buildCaptureH11;
function validateCaptureH11(d) { const f = [], total = empty(); if (d.schemaVersion !== 1 || d.contract !== "dokkan-official-capture-extension-shadow-parity" || d.contractVersion !== "0.12.0" || d.collectionMode !== "offline_pinned_shadow_comparison_no_requests" || d.productionMutation !== false || d.defaultEnabled !== false || d.authority !== "shadow_only_zero_conflicts_does_not_prove_completeness" || d.aggregationPolicy !== "non_exclusive_comparison_cells_may_overlap" || !/^[a-f0-9]{64}$/.test(d.sourceLockSha256))
    f.push("contract"); for (const c of d.comparisons) {
    for (const k of keys)
        if (!Number.isSafeInteger(c.counts[k]) || c.counts[k] < 0)
            f.push("count");
        else if (c.includedInTotals)
            total[k] += c.counts[k];
} if (JSON.stringify(total) !== JSON.stringify(d.comparisonCellTotals))
    f.push("totals"); if (JSON.stringify(d.sourceCoverage.map(v => v.series).sort()) !== JSON.stringify(["E0-E9", "H0-H7", "H8-H10", "K0-K9", "S0-S7"]))
    f.push("source coverage"); return { schemaVersion: 1, valid: f.length === 0, comparisonCount: d.comparisons.length, comparisonCellTotals: total, sourceCoverageCount: d.sourceCoverage.length, failures: [...new Set(f)] }; }
exports.validateCaptureH11 = validateCaptureH11;
//# sourceMappingURL=capture-h11-parity.js.map