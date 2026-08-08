"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateCaptureH4 = exports.buildCaptureH4 = void 0;
const capture_product_core_1 = require("./capture-product-core");
const rule = (kind, endpoints, paths) => ({ kind, endpoints: Array.isArray(endpoints) ? endpoints : [endpoints], paths: Array.isArray(paths) ? paths : [paths] });
const root = "/gashas", featured = "/gashas/:id/featured_cards", rates = "/gashas/:id/rates";
const rules = {
    gasha_category: {
        identity: rule("identity", root, "$.gasha_categories[].id"), priority: rule("nonNegativeInt", root, "$.gasha_categories[].priority"), isDefault: rule("boolean", root, "$.gasha_categories[].is_default"),
    },
    gasha: {
        identity: rule("identity", root, "$.gashas[].id"), categoryId: rule("positiveInt", root, "$.gashas[].gasha_category_id"), openAt: rule("timestamp", root, "$.gashas[].open_at"), endAt: rule("timestamp", root, "$.gashas[].end_at"), informationAnnouncementId: rule("positiveInt", root, "$.gashas[].information_announcement_id"), notificationAnnouncementId: rule("positiveInt", root, "$.gashas[].notification_announcement_id"), isRateVisible: rule("boolean", root, "$.gashas[].is_rate_visible"), treasureItemId: rule("positiveInt", root, "$.gashas[].treasure_item_id"),
        courseNumbers: rule("positiveIntArray", root, "$.gashas[].courses[].no"), courseCurrencyIds: rule("positiveIntArray", root, "$.gashas[].courses[].currency_id"), coursePrices: rule("nonNegativeIntArray", root, "$.gashas[].courses[].price"), courseItemCounts: rule("positiveIntArray", root, "$.gashas[].courses[].items_count"), courseDrawableCounts: rule("positiveIntArray", root, "$.gashas[].courses[].drawable_count"), courseTreasureItemCounts: rule("positiveIntArray", root, "$.gashas[].courses[].treasure_item_count"),
        featuredCardIds: rule("positiveIntArray", featured, "$.gasha_items[].card_id"), stepNumbers: rule("positiveIntArray", rates, "$.steps[].step"), rateIds: rule("positiveIntArray", rates, "$.steps[].gasha_rates.id"), featuredPoolCardIds: rule("positiveIntArray", rates, "$.steps[].gasha_rates.featured_card_ids"), normalPoolCardIds: rule("positiveIntArray", rates, "$.steps[].gasha_rates.normal_card_ids"), specialFeaturedPoolCardIds: rule("positiveIntArray", rates, "$.steps[].special_gashas[].featured_card_ids"), specialNormalPoolCardIds: rule("positiveIntArray", rates, "$.steps[].special_gashas[].normal_card_ids"), rarityCodes: rule("rarityArray", rates, "$.steps[].gasha_rates.rarities[].rarity"), featuredRates: rule("rateArray", rates, "$.steps[].gasha_rates.rarities[].featured_rate"), normalRates: rule("rateArray", rates, "$.steps[].gasha_rates.rarities[].normal_rate"), totalRates: rule("rateArray", rates, "$.steps[].gasha_rates.rarities[].total_rate"), featuredCardCounts: rule("nonNegativeIntArray", rates, "$.steps[].gasha_rates.rarities[].featured_cards_num"), normalCardCounts: rule("nonNegativeIntArray", rates, "$.steps[].gasha_rates.rarities[].normal_cards_num"), totalCardCounts: rule("nonNegativeIntArray", rates, "$.steps[].gasha_rates.rarities[].total_cards_num"), specialGashaIds: rule("positiveIntArray", rates, "$.steps[].special_gashas[].id"),
    },
};
const discardedFields = ["current_step", "description", "drawable_count_description", "is_new", "items_name", "name", "note", "processed_at", "scouter_description", "title"];
function normalize(kind, raw) {
    if ((kind === "identity" || kind === "positiveInt") && Number.isSafeInteger(raw) && raw > 0 && raw <= 10 ** 12)
        return raw;
    if (kind === "nonNegativeInt" && Number.isSafeInteger(raw) && raw >= 0 && raw <= 10 ** 12)
        return raw;
    if (kind === "timestamp" && Number.isSafeInteger(raw) && raw >= 0 && raw <= 10 ** 13)
        return raw;
    if (kind === "boolean" && typeof raw === "boolean")
        return raw;
    if ((kind === "positiveIntArray" || kind === "nonNegativeIntArray") && Array.isArray(raw) && raw.length <= 100000 && raw.every(value => Number.isSafeInteger(value) && (kind === "positiveIntArray" ? value > 0 : value >= 0) && value <= 10 ** 12))
        return [...new Set(raw)].sort((a, b) => a - b);
    if (kind === "rateArray" && Array.isArray(raw) && raw.length <= 1000 && raw.every(value => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100))
        return [...new Set(raw)].sort((a, b) => a - b);
    if (kind === "rarityArray" && Array.isArray(raw) && raw.length <= 16 && raw.every(value => typeof value === "string" && /^(?:N|R|SR|SSR|UR|LR)$/i.test(value)))
        return [...new Set(raw.map(value => value.toUpperCase()))].sort((a, b) => a.localeCompare(b));
    return undefined;
}
function values(items, key) { return items.flatMap(item => item?.[key] === undefined || item?.[key] === null ? [] : [item[key]]); }
function numericPathId(pathname, suffix) { const match = pathname.match(new RegExp(`^/gashas/(\\d+)/${suffix}$`)); const value = match ? Number(match[1]) : NaN; return Number.isSafeInteger(value) && value > 0 ? value : null; }
function objects(value) { return Array.isArray(value) ? value.filter(item => item && typeof item === "object") : []; }
function add(candidates, context, entityType, entityId, field, raw, path) {
    const fieldRule = rules[entityType]?.[field];
    if (!fieldRule)
        return;
    const value = normalize(fieldRule.kind, raw);
    if (value !== undefined)
        candidates.push({ entityType, entityId, fact: (0, capture_product_core_1.makeProductFact)(entityType, entityId, field, value, context, path) });
}
function buildCaptureH4(manifest, roots, h0) {
    const candidates = [];
    (0, capture_product_core_1.forEachCaptureProductResponse)(manifest, roots, h0, context => {
        const body = context.body;
        if (!body || typeof body !== "object")
            return;
        if (context.normalizedEndpoint === root) {
            for (const item of objects(body.gasha_categories)) {
                if (!Number.isSafeInteger(item.id) || item.id <= 0)
                    continue;
                for (const [field, raw, path] of [["identity", item.id, "$.gasha_categories[].id"], ["priority", item.priority, "$.gasha_categories[].priority"], ["isDefault", item.is_default, "$.gasha_categories[].is_default"]])
                    add(candidates, context, "gasha_category", item.id, field, raw, path);
            }
            for (const item of objects(body.gashas)) {
                if (!Number.isSafeInteger(item.id) || item.id <= 0)
                    continue;
                const courses = objects(item.courses);
                const facts = [["identity", item.id, "$.gashas[].id"], ["categoryId", item.gasha_category_id, "$.gashas[].gasha_category_id"], ["openAt", item.open_at, "$.gashas[].open_at"], ["endAt", item.end_at, "$.gashas[].end_at"], ["informationAnnouncementId", item.information_announcement_id, "$.gashas[].information_announcement_id"], ["notificationAnnouncementId", item.notification_announcement_id, "$.gashas[].notification_announcement_id"], ["isRateVisible", item.is_rate_visible, "$.gashas[].is_rate_visible"], ["treasureItemId", item.treasure_item_id, "$.gashas[].treasure_item_id"], ["courseNumbers", values(courses, "no"), "$.gashas[].courses[].no"], ["courseCurrencyIds", values(courses, "currency_id"), "$.gashas[].courses[].currency_id"], ["coursePrices", values(courses, "price"), "$.gashas[].courses[].price"], ["courseItemCounts", values(courses, "items_count"), "$.gashas[].courses[].items_count"], ["courseDrawableCounts", values(courses, "drawable_count"), "$.gashas[].courses[].drawable_count"], ["courseTreasureItemCounts", values(courses, "treasure_item_count"), "$.gashas[].courses[].treasure_item_count"]];
                for (const [field, raw, path] of facts)
                    add(candidates, context, "gasha", item.id, field, raw, path);
            }
        }
        else if (context.normalizedEndpoint === featured) {
            const gashaId = numericPathId(context.pathname, "featured_cards");
            if (gashaId)
                add(candidates, context, "gasha", gashaId, "featuredCardIds", values(objects(body.gasha_items), "card_id"), "$.gasha_items[].card_id");
        }
        else if (context.normalizedEndpoint === rates) {
            const gashaId = numericPathId(context.pathname, "rates");
            if (!gashaId)
                return;
            const steps = objects(body.steps), rateObjects = steps.flatMap(step => step.gasha_rates && typeof step.gasha_rates === "object" ? [step.gasha_rates] : []), rarityObjects = rateObjects.flatMap(rate => objects(rate.rarities)), specials = steps.flatMap(step => objects(step.special_gashas));
            const facts = [["stepNumbers", values(steps, "step"), "$.steps[].step"], ["rateIds", values(rateObjects, "id"), "$.steps[].gasha_rates.id"], ["featuredPoolCardIds", rateObjects.flatMap(rate => Array.isArray(rate.featured_card_ids) ? rate.featured_card_ids : []), "$.steps[].gasha_rates.featured_card_ids"], ["normalPoolCardIds", rateObjects.flatMap(rate => Array.isArray(rate.normal_card_ids) ? rate.normal_card_ids : []), "$.steps[].gasha_rates.normal_card_ids"], ["specialFeaturedPoolCardIds", specials.flatMap(item => Array.isArray(item.featured_card_ids) ? item.featured_card_ids : []), "$.steps[].special_gashas[].featured_card_ids"], ["specialNormalPoolCardIds", specials.flatMap(item => Array.isArray(item.normal_card_ids) ? item.normal_card_ids : []), "$.steps[].special_gashas[].normal_card_ids"], ["rarityCodes", values(rarityObjects, "rarity"), "$.steps[].gasha_rates.rarities[].rarity"], ["featuredRates", values(rarityObjects, "featured_rate"), "$.steps[].gasha_rates.rarities[].featured_rate"], ["normalRates", values(rarityObjects, "normal_rate"), "$.steps[].gasha_rates.rarities[].normal_rate"], ["totalRates", values(rarityObjects, "total_rate"), "$.steps[].gasha_rates.rarities[].total_rate"], ["featuredCardCounts", values(rarityObjects, "featured_cards_num"), "$.steps[].gasha_rates.rarities[].featured_cards_num"], ["normalCardCounts", values(rarityObjects, "normal_cards_num"), "$.steps[].gasha_rates.rarities[].normal_cards_num"], ["totalCardCounts", values(rarityObjects, "total_cards_num"), "$.steps[].gasha_rates.rarities[].total_cards_num"], ["specialGashaIds", values(specials, "id"), "$.steps[].special_gashas[].id"]];
            for (const [field, raw, path] of facts)
                add(candidates, context, "gasha", gashaId, field, raw, path);
        }
    });
    const dataset = { schemaVersion: 1, contract: "dokkan-official-capture-gashas", contractVersion: "0.5.0", generatedAt: h0.generatedAt, generatedAtPolicy: "latest_capture_timestamp_for_deterministic_bytes", collectionMode: "offline_allowlisted_product_values_no_requests", productionMutation: false, defaultEnabled: false, authority: "capture_observation_partial_no_commercial_or_global_summonability_authority", poolRepresentation: "per_gasha_observed_unions_step_association_not_claimed", discardedFields: [...discardedFields], entities: (0, capture_product_core_1.groupProductFacts)(candidates) };
    const validation = validateCaptureH4(dataset, h0);
    if (!validation.valid)
        throw new Error(`H4 validation failed: ${validation.failures.join(", ")}`);
    return dataset;
}
exports.buildCaptureH4 = buildCaptureH4;
function validateCaptureH4(dataset, h0) {
    const failures = [], entityKeys = new Set(), factIds = new Set();
    const publicFingerprints = (0, capture_product_core_1.capturePublicValueFingerprints)(dataset.entities);
    const expectedCaptures = new Map(h0.captures.map(capture => [capture.captureId, capture]));
    let factCount = 0, partialCount = 0, supportedCount = 0, userDerivedAuthorityCount = 0;
    for (const entity of dataset.entities) {
        const key = `${entity.entityType}:${entity.entityId}`;
        if (entityKeys.has(key) || !rules[entity.entityType] || !Number.isSafeInteger(entity.entityId) || entity.entityId <= 0)
            failures.push("entity identity");
        entityKeys.add(key);
        if (!entity.facts.some(fact => fact.field === "identity" && fact.value === entity.entityId))
            failures.push("missing structural identity");
        for (const fact of entity.facts) {
            factCount += 1;
            const fieldRule = rules[entity.entityType]?.[fact.field], p = fact.provenance, { factId: _factId, ...withoutId } = fact;
            if (factIds.has(fact.factId) || !fieldRule || fact.factId !== (0, capture_product_core_1.productFactId)(entity.entityType, entity.entityId, withoutId))
                failures.push("fact identity or field");
            factIds.add(fact.factId);
            if (!fieldRule || JSON.stringify(normalize(fieldRule.kind, fact.value)) !== JSON.stringify(fact.value) || (fact.field === "identity" && fact.value !== entity.entityId))
                failures.push("fact value domain");
            if (!fieldRule?.endpoints.includes(p.normalizedEndpoint) || !fieldRule?.paths.includes(p.jsonPath))
                failures.push("coordinate allowlist");
            const expectedClassification = p.normalizedEndpoint === root ? "mixed_product_and_user_state" : "product_catalog";
            const expectedCapture = expectedCaptures.get(p.captureId);
            if (p.endpointClassification !== expectedClassification || p.method !== "GET" || !Number.isInteger(p.httpStatus) || p.httpStatus < 200 || p.httpStatus > 299 || p.confidence !== "partial" || p.userDerivedAuthority !== false || p.evidenceOrigin !== "official_capture_allowlisted_product_value" || !/^[a-z0-9][a-z0-9_-]{0,47}$/.test(p.captureId) || !expectedCapture || p.captureFingerprint !== expectedCapture.structuralFingerprint || p.captureSchemaFingerprint !== expectedCapture.schemaFingerprint || p.captureSourceIdentityFingerprint !== expectedCapture.sourceIdentityFingerprint || p.captureTimestamp !== expectedCapture.capturedAtStart || p.capturePublicValueFingerprint !== publicFingerprints.get(p.captureId) || p.valueEvidenceSha256 !== (0, capture_product_core_1.productValueEvidenceSha256)(fact.field, fact.value, p.jsonPath) || Number.isNaN(Date.parse(p.captureTimestamp)) || Number.isNaN(Date.parse(p.observedAt)))
                failures.push("provenance boundary");
            if (p.confidence === "partial")
                partialCount += 1;
            else
                supportedCount += 1;
            if (p.userDerivedAuthority !== false)
                userDerivedAuthorityCount += 1;
            if (discardedFields.some(value => fact.field.toLowerCase().includes(value) || p.jsonPath.toLowerCase().includes(value)))
                failures.push("discarded field leakage");
        }
    }
    if (dataset.schemaVersion !== 1 || dataset.contract !== "dokkan-official-capture-gashas" || dataset.contractVersion !== "0.5.0" || dataset.productionMutation !== false || dataset.defaultEnabled !== false || dataset.authority !== "capture_observation_partial_no_commercial_or_global_summonability_authority" || dataset.poolRepresentation !== "per_gasha_observed_unions_step_association_not_claimed")
        failures.push("dataset contract");
    if (dataset.entities.length === 0 || factCount === 0)
        failures.push("empty dataset");
    if (supportedCount !== 0)
        failures.push("unsupported promotion");
    if (userDerivedAuthorityCount !== 0)
        failures.push("user-derived authority");
    return { schemaVersion: 1, valid: failures.length === 0, entityCount: dataset.entities.length, factCount, supportedCount, partialCount, userDerivedAuthorityCount, failures: [...new Set(failures)] };
}
exports.validateCaptureH4 = validateCaptureH4;
//# sourceMappingURL=capture-h4-gashas.js.map