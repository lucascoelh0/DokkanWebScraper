"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findSaTrainingMaterials = exports.evaluateSaTraining = exports.createSaTrainingEvaluator = exports.validateSaTrainingIndex = exports.buildSaTrainingIndex = exports.SA_RATE_MATRIX = exports.SA_MAX_MANIFEST_BYTES = exports.SA_MAX_COMPRESSED_BYTES = exports.SA_MAX_EXPANDED_BYTES = exports.SA_RULES_VERSION = exports.SA_TRAINING_VERSION = exports.SA_TRAINING_CONTRACT = void 0;
const crypto_1 = require("crypto");
const zlib_1 = require("zlib");
exports.SA_TRAINING_CONTRACT = "dokkan-sa-training";
exports.SA_TRAINING_VERSION = "1.0.0";
exports.SA_RULES_VERSION = "reference-5.31-v1";
exports.SA_MAX_EXPANDED_BYTES = 8 * 1024 * 1024;
exports.SA_MAX_COMPRESSED_BYTES = 1024 * 1024;
exports.SA_MAX_MANIFEST_BYTES = 64 * 1024;
// Reference-supported profiles, NOT a recovered first-party game algorithm.
// Row: initial target rarity. Column: actual material rarity, including Z awakening.
exports.SA_RATE_MATRIX = [
    [30, 50, 100, 100, 100, 100],
    [null, 30, 50, 100, 100, 100],
    [null, 5, 30, 50, 100, 100],
    [null, 1, 5, 50, 100, 100],
    [null, 0, 1, 5, 50, 100],
    [null, null, null, 1, 2, null],
];
const digest = (b) => (0, crypto_1.createHash)("sha256").update(b).digest("hex");
const sorted = (values) => [...new Set(values)].sort();
const isId = (v) => typeof v === "string" && /^[1-9]\d*$/.test(v);
const rarity = (v) => Number.isInteger(v) && Number(v) >= 0 && Number(v) <= 5;
function check(ok, message) { if (!ok)
    throw new Error(`SA index: ${message}`); }
const hash = (v) => typeof v === "string" && /^[a-f0-9]{64}$/.test(v);
const unique = (values) => new Set(values).size === values.length;
/** Structural exclusion heuristic, deliberately versioned/audited instead of called an official enum. */
function specialReason(row) {
    if (row.is_selling_only === "1")
        return "selling-only";
    if (row.cost === "99" && row.exp_type === "5" && row.training_exp === "10")
        return "training-signature-v1";
    if (row.collectable_type !== "1" || row.is_selling_only !== "0")
        return "unsupported-collectability";
    return undefined;
}
function buildSaTrainingIndex(o) {
    check(new Date(o.generatedAt).toISOString() === o.generatedAt, "invalid date");
    check(isId(o.sourceSnapshotVersion) && hash(o.sourceDatabaseSha256), "invalid source identity");
    check(o.primaryManifest.characterCount === o.primaryCharacters.length, "primary count");
    for (const [m, p, sha] of [
        [o.stageManifest, o.stageCatalog, o.stagePayloadSha256],
        [o.awakeningManifest, o.awakeningCatalog, o.awakeningPayloadSha256],
    ]) {
        check(m.sourceSnapshotVersion === o.sourceSnapshotVersion && p.sourceSnapshotVersion === o.sourceSnapshotVersion
            && m.sourceDatabaseSha256 === o.sourceDatabaseSha256 && p.sourceDatabaseSha256 === o.sourceDatabaseSha256
            && m.datasetVersion === p.datasetVersion, "dependency snapshot mismatch");
        check(hash(sha), "invalid dependency hash");
    }
    check(o.stageManifest.catalog.sha256 === o.stagePayloadSha256
        && o.awakeningManifest.payload.sha256 === o.awakeningPayloadSha256, "dependency payload mismatch");
    check(o.stageCatalog.contract === "dokkan-stage-delivery"
        && o.awakeningCatalog.contract === "dokkan-awakening-medal-catalog", "dependency contract mismatch");
    check(Array.isArray(o.stageCatalog.characterDrops) && Array.isArray(o.stageCatalog.eventMissions)
        && o.stageCatalog.eventMissionsComplete === true, "missing/incomplete source coverage");
    const raw = new Map();
    for (const r of o.tables.cards ?? []) {
        check(isId(r.id) && !raw.has(r.id), "duplicate/invalid official card");
        raw.set(r.id, r);
    }
    check(raw.size > 0 && Array.isArray(o.tables.card_awakening_routes), "missing official tables");
    const names = new Set((o.tables.card_unique_infos ?? []).map(r => r.id));
    const sources = new Map();
    function source(id) {
        check(isId(id), "invalid reward card ID");
        if (!sources.has(id))
            sources.set(id, { stages: new Set(), missions: new Set() });
        return sources.get(id);
    }
    for (const drop of o.stageCatalog.characterDrops) {
        check(isId(drop.stageId) && drop.reward?.itemType === "Card", "invalid character drop");
        source(drop.reward.itemId).stages.add(drop.stageId);
    }
    for (const mission of o.stageCatalog.eventMissions) {
        check(isId(mission.id) && Array.isArray(mission.rewards), "invalid mission");
        for (const reward of mission.rewards)
            if (reward.itemType === "Card")
                source(reward.itemId).missions.add(mission.id);
    }
    const supported = new Set([
        ...o.primaryCharacters.map(c => String(c.id)),
        ...(o.awakeningCatalog.routeGraph?.cards ?? []).map(c => c.id),
        ...[...sources.keys()].filter(id => raw.has(id) && !specialReason(raw.get(id))),
    ]);
    const incoming = new Map(), outgoing = new Map();
    const adjacency = new Map(), errors = new Map();
    const edge = (map, a, b) => {
        if (!map.has(a))
            map.set(a, new Set());
        map.get(a).add(b);
    };
    const bad = (id, reason) => { if (!errors.has(id))
        errors.set(id, new Set()); errors.get(id).add(reason); };
    const routeIds = new Map();
    for (const r of o.tables.card_awakening_routes) {
        if (r.type === "CardAwakeningRoute::Optimal")
            continue;
        if (r.type !== "CardAwakeningRoute::Zet" && r.type !== "CardAwakeningRoute::Dokkan") {
            if (raw.has(r.card_id))
                bad(r.card_id, "unsupported-route-type");
            if (raw.has(r.awaked_card_id))
                bad(r.awaked_card_id, "unsupported-route-type");
            continue;
        }
        const a = r.card_id, b = r.awaked_card_id;
        if (!isId(a) || !isId(b)) {
            if (raw.has(a))
                bad(a, "invalid-endpoint");
            if (raw.has(b))
                bad(b, "invalid-endpoint");
            continue;
        }
        edge(adjacency, a, b);
        edge(adjacency, b, a);
        edge(outgoing, a, b);
        edge(incoming, b, a);
        const signature = `${a}:${b}:${r.type}`;
        if (routeIds.has(r.id) && routeIds.get(r.id) !== signature) {
            bad(a, "conflicting-route-id");
            bad(b, "conflicting-route-id");
            const previous = routeIds.get(r.id).split(":");
            bad(previous[0], "conflicting-route-id");
            bad(previous[1], "conflicting-route-id");
        }
        routeIds.set(r.id, signature);
        if (a === b)
            bad(a, "ordinary-self-edge");
        if (!raw.has(a) || !raw.has(b)) {
            bad(a, "dangling-endpoint");
            bad(b, "dangling-endpoint");
        }
        // Dokkan can legitimately return a Z-awakened UR to an SSR base form.
        // Follow the official edge; displayed rarity need not increase monotonically.
    }
    const cards = [], paths = [], quarantines = [];
    const visited = new Set();
    for (const start of sorted(raw.keys())) {
        if (visited.has(start))
            continue;
        const pending = [start], component = [], reasons = new Set();
        while (pending.length) {
            const id = pending.pop();
            if (visited.has(id))
                continue;
            visited.add(id);
            component.push(id);
            for (const next of adjacency.get(id) ?? [])
                pending.push(next);
            for (const reason of errors.get(id) ?? [])
                reasons.add(reason);
            if ((incoming.get(id)?.size ?? 0) > 1 || (outgoing.get(id)?.size ?? 0) > 1)
                reasons.add("branch-or-merge");
            const row = raw.get(id);
            if (!row || !rarity(Number(row.rarity)) || !isId(row.card_unique_info_id) || !names.has(row.card_unique_info_id)
                || !row.name || specialReason(row))
                reasons.add("unsupported-card-metadata");
        }
        if (!component.some(id => supported.has(id)))
            continue;
        const roots = component.filter(id => !(incoming.get(id)?.size));
        if (roots.length !== 1)
            reasons.add("cycle-or-invalid-root");
        if (reasons.size) {
            quarantines.push({ cardIds: sorted(component), reasons: sorted(reasons) });
            continue;
        }
        const ordered = [], pathVisited = new Set();
        let current = roots[0];
        while (current && !pathVisited.has(current)) {
            pathVisited.add(current);
            ordered.push(current);
            current = [...(outgoing.get(current) ?? [])][0];
        }
        if (ordered.length !== component.length || current) {
            quarantines.push({ cardIds: sorted(component), reasons: ["cycle-or-disconnected"] });
            continue;
        }
        const id = ordered[0];
        paths.push({ id, cardIds: ordered, nameIdentityIds: sorted(ordered.map(c => raw.get(c).card_unique_info_id)), baseRarityRaw: Number(raw.get(id).rarity) });
        for (const cardId of ordered) {
            const row = raw.get(cardId);
            cards.push({ id: cardId, name: row.name, nameIdentityId: row.card_unique_info_id,
                rarityRaw: Number(row.rarity), pathId: id, supportedTarget: supported.has(cardId) });
        }
    }
    cards.sort((a, b) => a.id.localeCompare(b.id));
    paths.sort((a, b) => a.id.localeCompare(b.id));
    quarantines.sort((a, b) => a.cardIds[0].localeCompare(b.cardIds[0]));
    const cardMap = new Map(cards.map(c => [c.id, c])), pathMap = new Map(paths.map(p => [p.id, p]));
    const materials = [], excludedRewards = [];
    for (const id of sorted(sources.keys())) {
        const row = raw.get(id), card = cardMap.get(id);
        if (!row || !card) {
            excludedRewards.push({ cardId: id, reason: row ? specialReason(row) ?? "quarantined-path" : "missing-official-card" });
            continue;
        }
        const p = pathMap.get(card.pathId);
        materials.push({ sourceCardId: id, formCardIds: p.cardIds.slice(p.cardIds.indexOf(id)),
            stageIds: sorted(sources.get(id).stages), missionIds: sorted(sources.get(id).missions) });
    }
    const coverage = {
        officialCardCount: raw.size, rewardCardCount: sources.size, materialSourceCount: materials.length,
        preparedFormCount: new Set(materials.flatMap(m => m.formCardIds)).size,
        supportedTargetCount: cards.filter(c => c.supportedTarget).length,
        quarantinedCardCount: quarantines.reduce((n, q) => n + q.cardIds.length, 0), excludedRewardCount: excludedRewards.length,
    };
    const sourceBindings = {
        primaryCharacters: { datasetVersion: o.primaryManifest.datasetVersion, payloadSha256: o.primaryManifest.sha256 },
        stages: { datasetVersion: o.stageManifest.datasetVersion, payloadSha256: o.stagePayloadSha256 },
        awakeningGraph: { datasetVersion: o.awakeningManifest.datasetVersion, payloadSha256: o.awakeningPayloadSha256 },
        firstPartyTableInventorySha256: o.firstPartyTableInventorySha256,
    };
    const payload = {
        schemaVersion: 1, contract: exports.SA_TRAINING_CONTRACT, contractVersion: exports.SA_TRAINING_VERSION,
        datasetVersion: "", generatedAt: o.generatedAt, sourceSnapshotVersion: o.sourceSnapshotVersion,
        sourceDatabaseSha256: o.sourceDatabaseSha256, sourceBindings,
        rules: { version: exports.SA_RULES_VERSION, rateMatrix: exports.SA_RATE_MATRIX.map(row => [...row]),
            profileSelection: "ordinary-linear-path-initial-rarity-reference-v1",
            evidence: [
                { type: "announcement", ref: "https://dokkan.fyi/news/106607" },
                { type: "reference-site", ref: "docs/references/super-attack-training-5.31/reference-matrix.md" },
                { type: "gameplay", ref: "docs/references/super-attack-training-5.31/06-nuova-material-rates.png" },
            ] }, cards, paths, materials, quarantines, coverage,
    };
    payload.datasetVersion = `${o.sourceSnapshotVersion}-${digest(Buffer.from(JSON.stringify(payload))).slice(0, 16)}`;
    validateSaTrainingIndex(payload);
    const bytes = Buffer.from(JSON.stringify(payload)), catalogGzip = (0, zlib_1.gzipSync)(bytes, { level: 9 });
    check(bytes.length <= exports.SA_MAX_EXPANDED_BYTES && catalogGzip.length <= exports.SA_MAX_COMPRESSED_BYTES, "payload bounds exceeded");
    const sha256 = digest(catalogGzip);
    const manifest = {
        schemaVersion: 1, contract: payload.contract, contractVersion: payload.contractVersion,
        datasetVersion: payload.datasetVersion, generatedAt: payload.generatedAt,
        sourceSnapshotVersion: payload.sourceSnapshotVersion, sourceDatabaseSha256: payload.sourceDatabaseSha256,
        sourceBindings, rulesVersion: exports.SA_RULES_VERSION, coverage,
        catalog: { objectKey: `sa-training/objects/${sha256}.json.gz`, sha256, sizeBytes: catalogGzip.length,
            expandedSizeBytes: bytes.length, contentType: "application/json", contentEncoding: "gzip" },
    };
    validateSaTrainingIndex(payload, manifest);
    return { payload, manifest, catalogGzip, audit: { coverage, excludedRewards, quarantines,
            compressedBytes: catalogGzip.length, expandedBytes: bytes.length,
            classificationRule: "selling-only flag; cost99/expType5/trainingExp10 structural exclusion heuristic v1",
            probabilityRule: payload.rules.profileSelection, sourceBindings } };
}
exports.buildSaTrainingIndex = buildSaTrainingIndex;
function validateSaTrainingIndex(p, m) {
    check(p?.schemaVersion === 1 && p.contract === exports.SA_TRAINING_CONTRACT && p.contractVersion === exports.SA_TRAINING_VERSION, "unsupported contract");
    check(p.rules?.version === exports.SA_RULES_VERSION && p.rules.profileSelection === "ordinary-linear-path-initial-rarity-reference-v1"
        && JSON.stringify(p.rules.rateMatrix) === JSON.stringify(exports.SA_RATE_MATRIX), "unsupported or modified rules");
    check(hash(p.sourceDatabaseSha256) && isId(p.sourceSnapshotVersion) && p.datasetVersion
        && Number.isFinite(Date.parse(p.generatedAt)), "source/version identity");
    for (const key of ["primaryCharacters", "stages", "awakeningGraph"]) {
        check(typeof p.sourceBindings?.[key]?.datasetVersion === "string" && p.sourceBindings[key].datasetVersion.length > 0
            && hash(p.sourceBindings[key].payloadSha256), "source binding");
    }
    check(hash(p.sourceBindings.firstPartyTableInventorySha256), "inventory binding");
    check(Array.isArray(p.cards) && p.cards.length <= 30000 && Array.isArray(p.paths)
        && Array.isArray(p.materials) && Array.isArray(p.quarantines), "index arrays");
    const cards = new Map(), paths = new Map();
    for (const card of p.cards) {
        check(isId(card.id) && !cards.has(card.id) && isId(card.nameIdentityId) && rarity(card.rarityRaw)
            && typeof card.name === "string" && card.name.length > 0 && typeof card.supportedTarget === "boolean", "invalid/duplicate card");
        cards.set(card.id, card);
    }
    const visited = new Set();
    for (const path of p.paths) {
        check(isId(path.id) && !paths.has(path.id) && Array.isArray(path.cardIds) && path.cardIds.length > 0
            && path.cardIds[0] === path.id && unique(path.cardIds) && rarity(path.baseRarityRaw), "invalid path");
        for (const id of path.cardIds) {
            const card = cards.get(id);
            check(card && card.pathId === path.id && !visited.has(id), "invalid path membership");
            visited.add(id);
        }
        check(cards.get(path.id).rarityRaw === path.baseRarityRaw
            && JSON.stringify(path.nameIdentityIds) === JSON.stringify(sorted(path.cardIds.map(id => cards.get(id).nameIdentityId))), "path name/profile mismatch");
        paths.set(path.id, path);
    }
    check(visited.size === cards.size, "orphan card");
    const sourceIds = new Set();
    for (const material of p.materials) {
        const card = cards.get(material.sourceCardId), path = card && paths.get(card.pathId);
        check(path && !sourceIds.has(material.sourceCardId), "invalid source");
        sourceIds.add(material.sourceCardId);
        check(JSON.stringify(material.formCardIds) === JSON.stringify(path.cardIds.slice(path.cardIds.indexOf(material.sourceCardId))), "non-forward preparation");
        check(Array.isArray(material.stageIds) && Array.isArray(material.missionIds)
            && material.stageIds.length + material.missionIds.length > 0
            && [...material.stageIds, ...material.missionIds].every(isId)
            && unique(material.stageIds) && unique(material.missionIds), "invalid source references");
    }
    const quarantined = new Set();
    for (const q of p.quarantines) {
        check(Array.isArray(q.cardIds) && q.cardIds.length > 0 && q.cardIds.every(isId)
            && Array.isArray(q.reasons) && q.reasons.length > 0 && q.reasons.every(r => typeof r === "string" && r.length > 0), "invalid quarantine");
        for (const id of q.cardIds) {
            check(!cards.has(id) && !quarantined.has(id), "quarantine overlap");
            quarantined.add(id);
        }
    }
    check(p.coverage?.materialSourceCount === p.materials.length
        && p.coverage.preparedFormCount === new Set(p.materials.flatMap(v => v.formCardIds)).size
        && p.coverage.supportedTargetCount === p.cards.filter(c => c.supportedTarget).length
        && p.coverage.quarantinedCardCount === quarantined.size
        && p.coverage.rewardCardCount === p.coverage.materialSourceCount + p.coverage.excludedRewardCount
        && Object.values(p.coverage).every(n => Number.isSafeInteger(n) && n >= 0), "coverage mismatch");
    const bytes = Buffer.from(JSON.stringify(p));
    check(bytes.length <= exports.SA_MAX_EXPANDED_BYTES, "expanded bound");
    if (m) {
        check(Buffer.byteLength(JSON.stringify(m)) <= exports.SA_MAX_MANIFEST_BYTES && m.contract === p.contract
            && m.contractVersion === p.contractVersion && m.schemaVersion === p.schemaVersion
            && m.rulesVersion === p.rules.version && m.datasetVersion === p.datasetVersion && m.generatedAt === p.generatedAt
            && m.sourceSnapshotVersion === p.sourceSnapshotVersion && m.sourceDatabaseSha256 === p.sourceDatabaseSha256
            && JSON.stringify(m.sourceBindings) === JSON.stringify(p.sourceBindings)
            && JSON.stringify(m.coverage) === JSON.stringify(p.coverage), "manifest mismatch");
        check(m.catalog.contentEncoding === "gzip" && m.catalog.contentType === "application/json"
            && m.catalog.expandedSizeBytes === bytes.length && Number.isSafeInteger(m.catalog.sizeBytes)
            && m.catalog.sizeBytes > 0 && m.catalog.sizeBytes <= exports.SA_MAX_COMPRESSED_BYTES && hash(m.catalog.sha256)
            && m.catalog.objectKey === `sa-training/objects/${m.catalog.sha256}.json.gz`, "invalid object descriptor");
    }
}
exports.validateSaTrainingIndex = validateSaTrainingIndex;
/** Construct once per coherent payload, not on every recomposition. */
function createSaTrainingEvaluator(index) {
    validateSaTrainingIndex(index);
    const cards = new Map(index.cards.map(c => [c.id, c]));
    const paths = new Map(index.paths.map(p => [p.id, p]));
    const names = new Map(index.paths.map(p => [p.id, new Set(p.nameIdentityIds)]));
    const evaluate = (targetId, materialId) => {
        const target = cards.get(targetId), material = cards.get(materialId);
        if (!target?.supportedTarget || !material)
            return { kind: "insufficient-evidence" };
        if (target.pathId === material.pathId)
            return { kind: "same-path", chancePercent: 100, gain: "transfer" };
        const a = paths.get(target.pathId), b = paths.get(material.pathId);
        if (!a.nameIdentityIds.some(id => names.get(b.id).has(id)))
            return { kind: "incompatible" };
        return { kind: "compatible", chancePercent: index.rules.rateMatrix[a.baseRarityRaw][material.rarityRaw], gain: "one-level" };
    };
    return {
        evaluate,
        findMaterials(targetId) {
            return index.materials.flatMap(source => source.formCardIds.flatMap(formCardId => {
                const result = evaluate(targetId, formCardId);
                return result.kind === "same-path" || result.kind === "compatible"
                    ? [{ sourceCardId: source.sourceCardId, formCardId, rarityRaw: cards.get(formCardId).rarityRaw,
                            stageIds: source.stageIds, missionIds: source.missionIds, result }] : [];
            }));
        },
    };
}
exports.createSaTrainingEvaluator = createSaTrainingEvaluator;
const evaluateSaTraining = (p, target, material) => createSaTrainingEvaluator(p).evaluate(target, material);
exports.evaluateSaTraining = evaluateSaTraining;
const findSaTrainingMaterials = (p, target) => createSaTrainingEvaluator(p).findMaterials(target);
exports.findSaTrainingMaterials = findSaTrainingMaterials;
//# sourceMappingURL=game-db-sa-training.js.map