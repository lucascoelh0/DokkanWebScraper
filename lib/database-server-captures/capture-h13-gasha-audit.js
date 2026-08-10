"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateCaptureH13 = exports.buildCaptureH13 = exports.classifyCanonicalGashaFact = void 0;
const crypto_1 = require("crypto");
const capture_h0_audit_1 = require("./capture-h0-audit");
const H4_FIELDS = {
    card_id: ["featuredCardIds"],
    featured_card_ids: ["featuredPoolCardIds", "specialFeaturedPoolCardIds"],
    normal_card_ids: ["normalPoolCardIds", "specialNormalPoolCardIds"],
};
const classificationKeys = ["agreement", "temporal_change", "representation_mismatch", "coverage_gap", "unknown", "confirmed_conflict"];
function emptyCounts() { return { agreement: 0, temporal_change: 0, representation_mismatch: 0, coverage_gap: 0, unknown: 0, confirmed_conflict: 0 }; }
function sha256(value) { return (0, crypto_1.createHash)("sha256").update(value).digest("hex"); }
function positiveInt(value) { return Number.isSafeInteger(value) && value > 0 && value <= 10 ** 12 ? value : null; }
function timestamp(value) { const parsed = typeof value === "string" ? Date.parse(value) : NaN; return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null; }
function numericTimestamp(value) { return Number.isSafeInteger(value) && value >= 0 && value <= 10 ** 13 ? value : null; }
function numbers(value) { return Array.isArray(value) ? value.flatMap(item => positiveInt(item) ?? []).sort((a, b) => a - b) : []; }
function uniqueNumbers(values) { return [...new Set(values)].sort((a, b) => a - b); }
function dimensionValue(value) { return JSON.stringify([value.endpoint, value.jsonCoordinate, value.step, value.rateId, value.rarity, value.rarityApplicability, value.specialGashaId]); }
function sameDimension(left, right) { return dimensionValue(left) === dimensionValue(right); }
function periodComparable(left, right) { return !!left && !!right && left.openAt !== null && left.endAt !== null && left.openAt === right.openAt && left.endAt === right.endAt; }
function classifyCanonicalGashaFact(observedValue, observed, baseline, legacyUnionCollapsed) {
    if (observed.length === 0)
        return { classification: "unknown", reason: "observed_fact_has_no_exact_atomized_provenance", baselineDimensionValues: [], baselineObservations: [] };
    const dimensions = new Map(observed.map(value => [dimensionValue(value), value]));
    if (dimensions.size !== 1) {
        const dimensionalBaseline = baseline.filter(prior => observed.some(current => sameDimension(current, prior)));
        return { classification: "representation_mismatch", reason: "one_h10_fact_collapses_multiple_step_rate_or_special_dimensions", baselineDimensionValues: uniqueNumbers(dimensionalBaseline.map(value => value.value)), baselineObservations: dimensionalBaseline };
    }
    const exemplar = [...dimensions.values()][0];
    const exactBaseline = baseline.filter(value => sameDimension(value, exemplar));
    const baselineValues = uniqueNumbers(exactBaseline.map(value => value.value));
    if (baselineValues.includes(observedValue))
        return { classification: "agreement", reason: "same_semantic_dimension_contains_same_value", baselineDimensionValues: baselineValues, baselineObservations: exactBaseline };
    if (exactBaseline.length > 0) {
        const comparable = observed.some(current => exactBaseline.some(prior => periodComparable(current.period, prior.period) || current.captureId === prior.captureId && current.observedAt === prior.observedAt));
        return comparable
            ? { classification: "confirmed_conflict", reason: "same_dimension_and_proved_comparable_window_have_incompatible_values", baselineDimensionValues: baselineValues, baselineObservations: exactBaseline }
            : { classification: "temporal_change", reason: "same_dimension_differs_across_unproved_or_different_windows", baselineDimensionValues: baselineValues, baselineObservations: exactBaseline };
    }
    if (baseline.length === 0)
        return { classification: "coverage_gap", reason: "fact_dimension_exists_only_in_h10_capture_set", baselineDimensionValues: [], baselineObservations: [] };
    if (legacyUnionCollapsed)
        return { classification: "representation_mismatch", reason: "h4_union_and_h10_element_lack_a_shared_step_rate_special_dimension", baselineDimensionValues: [], baselineObservations: [] };
    return { classification: "unknown", reason: "baseline_exists_but_comparability_is_insufficient", baselineDimensionValues: [], baselineObservations: [] };
}
exports.classifyCanonicalGashaFact = classifyCanonicalGashaFact;
function body(entry) {
    const content = entry?.response?.content;
    if (entry?.request?.method !== "GET" || entry?.response?.status !== 200 || !content || typeof content.text !== "string" || content.encoding === "base64" || content.text.length > 32 * 1024 * 1024)
        return null;
    const mime = typeof content.mimeType === "string" ? content.mimeType.split(";", 1)[0].trim().toLowerCase() : "";
    if (!(mime === "application/json" || mime.endsWith("+json")))
        return null;
    try {
        return JSON.parse(content.text);
    }
    catch {
        return null;
    }
}
function officialPath(entry) { try {
    const url = new URL(entry?.request?.url);
    return url.protocol === "https:" && url.hostname.toLowerCase() === "ishin-global.aktsk.com" ? url.pathname : null;
}
catch {
    return null;
} }
function periodFor(candidates, gashaId, captureId, observedAt) {
    const time = Date.parse(observedAt);
    const available = candidates.filter(value => value.gashaId === gashaId && value.captureId === captureId).sort((a, b) => Math.abs(Date.parse(a.observedAt) - time) - Math.abs(Date.parse(b.observedAt) - time));
    if (available.length === 0)
        return null;
    const { gashaId: _gashaId, ...period } = available[0];
    return period;
}
function observation(side, inventory, entryIndex, observedAt, gashaId, field, value, dimension, period) {
    return { side, captureId: inventory.captureId, entryIndex, observedAt, httpStatus: 200, gashaId, field, value, period, captureStructuralFingerprint: inventory.structuralFingerprint, captureSourceIdentityFingerprint: inventory.sourceIdentityFingerprint, ...dimension };
}
function parseAtoms(manifest, roots, inventories, side) {
    const root = roots[manifest.inputRoot];
    if (!root)
        throw new Error("H13 capture root is not allowlisted");
    const rawByCapture = manifest.captures.map(input => ({ input, entries: JSON.parse((0, capture_h0_audit_1.readValidatedCaptureSnapshot)(root, input.path, input.captureId).text)?.log?.entries }));
    const periods = [];
    for (const { input, entries } of rawByCapture) {
        if (!Array.isArray(entries))
            throw new Error(`H13 invalid HAR ${input.captureId}`);
        entries.forEach((entry, entryIndex) => {
            if (officialPath(entry) !== "/gashas")
                return;
            const parsed = body(entry), observedAt = timestamp(entry?.startedDateTime);
            if (!parsed || !observedAt || !Array.isArray(parsed.gashas))
                return;
            for (const item of parsed.gashas) {
                const gashaId = positiveInt(item?.id);
                if (!gashaId)
                    continue;
                periods.push({ gashaId, openAt: numericTimestamp(item.open_at), endAt: numericTimestamp(item.end_at), captureId: input.captureId, entryIndex, observedAt });
            }
        });
    }
    const atoms = [];
    for (const { input, entries } of rawByCapture) {
        const inventory = inventories.find(value => value.captureId === input.captureId);
        if (!inventory)
            throw new Error(`H13 missing inventory ${input.captureId}`);
        entries.forEach((entry, entryIndex) => {
            const path = officialPath(entry), parsed = body(entry), observedAt = timestamp(entry?.startedDateTime);
            if (!path || !parsed || !observedAt)
                return;
            const featuredMatch = path.match(/^\/gashas\/(\d+)\/featured_cards$/);
            const ratesMatch = path.match(/^\/gashas\/(\d+)\/rates$/);
            const gashaId = positiveInt(Number((featuredMatch ?? ratesMatch)?.[1]));
            if (!gashaId)
                return;
            const period = periodFor(periods, gashaId, input.captureId, observedAt);
            if (featuredMatch)
                for (const item of Array.isArray(parsed.gasha_items) ? parsed.gasha_items : []) {
                    const value = positiveInt(item?.card_id);
                    if (value)
                        atoms.push(observation(side, inventory, entryIndex, observedAt, gashaId, "card_id", value, { endpoint: "/gashas/:id/featured_cards", jsonCoordinate: "$.gasha_items[].card_id", step: null, rateId: null, rarity: null, rarityApplicability: "not_applicable_to_card_id_pool_coordinates", specialGashaId: null }, period));
                }
            if (!ratesMatch)
                return;
            for (const stepObject of Array.isArray(parsed.steps) ? parsed.steps : []) {
                const step = positiveInt(stepObject?.step), rate = stepObject?.gasha_rates && typeof stepObject.gasha_rates === "object" ? stepObject.gasha_rates : null, rateId = positiveInt(rate?.id);
                const addPool = (field, coordinate, values, specialGashaId) => { for (const value of numbers(values))
                    atoms.push(observation(side, inventory, entryIndex, observedAt, gashaId, field, value, { endpoint: "/gashas/:id/rates", jsonCoordinate: coordinate, step, rateId, rarity: null, rarityApplicability: "not_applicable_to_card_id_pool_coordinates", specialGashaId }, period)); };
                if (rate) {
                    addPool("featured_card_ids", "$.steps[].gasha_rates.featured_card_ids[]", rate.featured_card_ids, null);
                    addPool("normal_card_ids", "$.steps[].gasha_rates.normal_card_ids[]", rate.normal_card_ids, null);
                }
                for (const special of Array.isArray(stepObject?.special_gashas) ? stepObject.special_gashas : []) {
                    const specialId = positiveInt(special?.id);
                    addPool("featured_card_ids", "$.steps[].special_gashas[].featured_card_ids[]", special?.featured_card_ids, specialId);
                    addPool("normal_card_ids", "$.steps[].special_gashas[].normal_card_ids[]", special?.normal_card_ids, specialId);
                }
            }
        });
    }
    return atoms.sort((a, b) => JSON.stringify([a.gashaId, a.endpoint, a.field, a.value, dimensionValue(a), a.captureId, a.entryIndex]).localeCompare(JSON.stringify([b.gashaId, b.endpoint, b.field, b.value, dimensionValue(b), b.captureId, b.entryIndex])));
}
function legacyBaseline(h4, gashaId, field) {
    const h4Fields = H4_FIELDS[field], facts = h4.entities.find(value => value.entityType === "gasha" && value.entityId === gashaId)?.facts.filter(value => h4Fields.includes(value.field)) ?? [];
    const unionValues = uniqueNumbers(facts.flatMap(value => numbers(value.value)));
    const key = sha256(JSON.stringify([gashaId, field, h4Fields]));
    return { key, gashaId, h10Field: field, h4Fields, unionValues, provenance: facts.map(value => ({ factId: value.factId, provenance: { ...value.provenance } })).sort((a, b) => a.factId.localeCompare(b.factId)) };
}
function legacyConflicts(h10, h4) {
    return h10.productFacts.filter(fact => {
        if (fact.domain !== "gashas" || !fact.parentId || typeof fact.value !== "number" || !H4_FIELDS[fact.field])
            return false;
        const baseline = legacyBaseline(h4, fact.parentId, fact.field);
        return !baseline.unionValues.includes(fact.value);
    });
}
function buildCaptureH13(sourceLockText, h0Manifest, h8Manifest, roots, h0, h4, h8, h10) {
    const baselineAtoms = parseAtoms(h0Manifest, roots, h0.captures.map(value => ({ captureId: value.captureId, structuralFingerprint: value.structuralFingerprint, sourceIdentityFingerprint: value.sourceIdentityFingerprint })), "h4_baseline");
    const observedAtoms = parseAtoms(h8Manifest, roots, h8.captures.map(value => ({ captureId: value.captureId, structuralFingerprint: value.structuralSha256, sourceIdentityFingerprint: value.sourceIdentityFingerprint })), "h10_observed");
    const conflicts = legacyConflicts(h10, h4);
    if (conflicts.length !== 627)
        throw new Error(`H13 expected 627 unique legacy conflicts, received ${conflicts.length}`);
    const baselines = new Map(), facts = [];
    for (const fact of conflicts) {
        const gashaId = fact.parentId, field = fact.field, observedValue = fact.value, baseline = legacyBaseline(h4, gashaId, field);
        baselines.set(baseline.key, baseline);
        const provenanceKeys = new Set(fact.provenance.map(value => `${value.captureId}:${value.entryIndex}`));
        const observed = observedAtoms.filter(value => value.gashaId === gashaId && value.field === field && value.value === observedValue && provenanceKeys.has(`${value.captureId}:${value.entryIndex}`));
        const endpointBaseline = baselineAtoms.filter(value => value.gashaId === gashaId && value.endpoint === fact.route && value.field === field);
        const classified = classifyCanonicalGashaFact(observedValue, observed, endpointBaseline, true);
        const canonicalDimensions = [...new Map(observed.map(value => [dimensionValue(value), value])).values()].map(value => ({ endpoint: value.endpoint, jsonCoordinate: value.jsonCoordinate, step: value.step, rateId: value.rateId, rarity: value.rarity, rarityApplicability: value.rarityApplicability, specialGashaId: value.specialGashaId, canonicalDimensionId: sha256(JSON.stringify([gashaId, dimensionValue(value)])) })).sort((a, b) => a.canonicalDimensionId.localeCompare(b.canonicalDimensionId));
        const auditKey = sha256(JSON.stringify([gashaId, fact.route, field, observedValue]));
        facts.push({ auditKey, gashaId, endpoint: fact.route, field, observedValue, legacyBaselineKey: baseline.key, legacyUnionContainsObservedValue: false, classification: classified.classification, classificationReason: classified.reason, canonicalDimensions, baselineDimensionValues: classified.baselineDimensionValues, baselineObservations: classified.baselineObservations, observedProvenance: observed });
    }
    facts.sort((a, b) => a.auditKey.localeCompare(b.auditKey));
    const uniqueCounts = emptyCounts();
    for (const fact of facts)
        uniqueCounts[fact.classification] += 1;
    const dataset = { schemaVersion: 1, contract: "dokkan-official-capture-gasha-conflict-audit", contractVersion: "0.14.0", generatedAt: h10.generatedAt, generatedAtPolicy: "inherits_h10_capture_timestamp", collectionMode: "offline_pinned_har_audit_no_requests_no_replay", productionMutation: false, defaultEnabled: false, authority: "corrective_shadow_classification_only", sourceLockSha256: sha256(sourceLockText), legacyUniqueConflictFactCount: 627, legacyNonExclusiveConflictCellCount: 1254, uniqueFactCount: 627, uniqueCounts, legacyBaselines: [...baselines.values()].sort((a, b) => a.key.localeCompare(b.key)), facts };
    const validation = validateCaptureH13(dataset);
    if (!validation.valid)
        throw new Error(`H13 validation failed: ${validation.failures.join(", ")}`);
    return dataset;
}
exports.buildCaptureH13 = buildCaptureH13;
function validateCaptureH13(dataset) {
    const failures = [], counts = emptyCounts(), keys = new Set();
    if (dataset.schemaVersion !== 1 || dataset.contract !== "dokkan-official-capture-gasha-conflict-audit" || dataset.contractVersion !== "0.14.0" || dataset.collectionMode !== "offline_pinned_har_audit_no_requests_no_replay" || dataset.productionMutation !== false || dataset.defaultEnabled !== false || dataset.authority !== "corrective_shadow_classification_only" || !/^[a-f0-9]{64}$/.test(dataset.sourceLockSha256) || dataset.legacyUniqueConflictFactCount !== 627 || dataset.legacyNonExclusiveConflictCellCount !== 1254 || dataset.uniqueFactCount !== 627 || dataset.facts.length !== 627)
        failures.push("dataset contract");
    for (const fact of dataset.facts) {
        counts[fact.classification] += 1;
        const legacy = dataset.legacyBaselines.find(value => value.key === fact.legacyBaselineKey);
        if (keys.has(fact.auditKey) || fact.auditKey !== sha256(JSON.stringify([fact.gashaId, fact.endpoint, fact.field, fact.observedValue])) || !Number.isSafeInteger(fact.gashaId) || fact.gashaId <= 0 || !Number.isSafeInteger(fact.observedValue) || fact.observedValue <= 0 || fact.legacyUnionContainsObservedValue !== false || fact.observedProvenance.length === 0 || fact.canonicalDimensions.length === 0 || !legacy || legacy.unionValues.includes(fact.observedValue))
            failures.push("fact identity, legacy absence or provenance");
        keys.add(fact.auditKey);
        for (const value of [...fact.observedProvenance, ...fact.baselineObservations])
            if (!/^[a-z0-9][a-z0-9_-]{0,47}$/.test(value.captureId) || !Number.isSafeInteger(value.entryIndex) || value.entryIndex < 0 || !Number.isFinite(Date.parse(value.observedAt)) || value.httpStatus !== 200 || value.gashaId !== fact.gashaId || value.field !== fact.field || value.endpoint !== fact.endpoint || value.rarity !== null || value.rarityApplicability !== "not_applicable_to_card_id_pool_coordinates" || !/^[a-f0-9]{64}$/.test(value.captureStructuralFingerprint) || !/^[a-f0-9]{64}$/.test(value.captureSourceIdentityFingerprint))
                failures.push("observation provenance or dimension");
        if (fact.observedProvenance.some(value => value.value !== fact.observedValue))
            failures.push("observed value mismatch");
        for (const dimension of fact.canonicalDimensions)
            if (dimension.rarity !== null || dimension.rarityApplicability !== "not_applicable_to_card_id_pool_coordinates" || dimension.canonicalDimensionId !== sha256(JSON.stringify([fact.gashaId, dimensionValue(dimension)])))
                failures.push("canonical dimension");
        const observedDimensionSet = [...new Set(fact.observedProvenance.map(value => dimensionValue(value)))].sort();
        const declaredDimensionSet = [...new Set(fact.canonicalDimensions.map(value => dimensionValue(value)))].sort();
        if (fact.canonicalDimensions.length !== declaredDimensionSet.length || JSON.stringify(observedDimensionSet) !== JSON.stringify(declaredDimensionSet))
            failures.push("canonical dimensions do not match observed provenance");
        if (fact.classification === "representation_mismatch" && declaredDimensionSet.length <= 1)
            failures.push("unsupported representation mismatch");
        if (fact.classification === "coverage_gap" && (fact.canonicalDimensions.length !== 1 || fact.baselineObservations.length !== 0))
            failures.push("unsupported coverage gap");
        if (fact.classification === "confirmed_conflict" && !fact.observedProvenance.some(current => fact.baselineObservations.some(prior => sameDimension(current, prior) && periodComparable(current.period, prior.period) && current.value === fact.observedValue && prior.value !== current.value)))
            failures.push("unsupported confirmed conflict");
    }
    if (JSON.stringify(counts) !== JSON.stringify(dataset.uniqueCounts))
        failures.push("classification totals");
    const expectedCounts = { agreement: 0, temporal_change: 0, representation_mismatch: 612, coverage_gap: 15, unknown: 0, confirmed_conflict: 0 };
    if (JSON.stringify(counts) !== JSON.stringify(expectedCounts))
        failures.push("corrective classification distribution");
    return { schemaVersion: 1, valid: failures.length === 0, uniqueFactCount: dataset.facts.length, uniqueCounts: counts, confirmedConflictCount: counts.confirmed_conflict, failures: [...new Set(failures)] };
}
exports.validateCaptureH13 = validateCaptureH13;
//# sourceMappingURL=capture-h13-gasha-audit.js.map