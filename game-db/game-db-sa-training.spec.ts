import { deepStrictEqual, strictEqual, throws } from "assert";
import { describe, it } from "mocha";
import { readFileSync } from "fs";
import { resolve } from "path";
import { createHash } from "crypto";
import { gunzipSync } from "zlib";
import { buildSaTrainingIndex, createSaTrainingEvaluator, SA_RATE_MATRIX, SaBuildOptions, validateSaTrainingIndex } from "./game-db-sa-training";

function fixture(): SaBuildOptions {
    const card = (id: string, rarity: number, identity = "100") => ({
        id, rarity: String(rarity), name: `Name ${identity}`, card_unique_info_id: identity,
        collectable_type: "1", is_selling_only: "0", cost: "1", exp_type: "1", training_exp: "1",
    });
    const cards = [0, 1, 2, 3, 4, 5].flatMap(r => [card(String(r + 1), r), card(String(r + 11), r)]);
    const ordinary = [0, 1, 2, 3, 4].map(r => ({ id: String(r + 1), type: "CardAwakeningRoute::Dokkan", card_id: String(r + 11), awaked_card_id: String(r + 12) }));
    const source = { sourceSnapshotVersion: "123", sourceDatabaseSha256: "a".repeat(64), datasetVersion: "2026-09-08T18:00:00.000Z" };
    return {
        ...source, generatedAt: source.datasetVersion, firstPartyTableInventorySha256: "b".repeat(64),
        tables: { cards, card_awakening_routes: ordinary, card_unique_infos: [{ id: "100", name: "Goku" }] },
        primaryCharacters: ["1", "2", "3", "4", "5", "6", "16"].map(id => ({ id })),
        primaryManifest: { datasetVersion: source.datasetVersion, sha256: "c".repeat(64), characterCount: 7 },
        stageCatalog: { ...source, contract: "dokkan-stage-delivery", eventMissionsComplete: true, characterDrops: [{ stageId: "20", reward: { itemId: "11", itemType: "Card" } }],
            eventMissions: [{ id: "30", rewards: [{ itemId: "11", itemType: "Card", quantity: 1 }, { itemId: "11", itemType: "Card", quantity: 2 }] }] },
        stageManifest: { ...source, catalog: { sha256: "d".repeat(64) } }, stagePayloadSha256: "d".repeat(64),
        awakeningCatalog: { ...source, contract: "dokkan-awakening-medal-catalog", routeGraph: { cards: [], routes: [] } },
        awakeningManifest: { ...source, payload: { sha256: "e".repeat(64) } }, awakeningPayloadSha256: "e".repeat(64),
    };
}

describe("SA training optional index", () => {
    it("consumes a real candidate and cross-language exact-ID reference cases", function () {
        const root = process.env.SA_TRAINING_CANDIDATE;
        if (!root) this.skip();
        const manifest = JSON.parse(readFileSync(resolve(root!, "sa-training-manifest.json"), "utf8"));
        const bytes = readFileSync(resolve(root!, manifest.catalog.objectKey));
        strictEqual(createHash("sha256").update(bytes).digest("hex"), manifest.catalog.sha256);
        strictEqual(bytes.length, manifest.catalog.sizeBytes);
        const raw = gunzipSync(bytes, { maxOutputLength: manifest.catalog.expandedSizeBytes });
        strictEqual(raw.length, manifest.catalog.expandedSizeBytes);
        const payload = JSON.parse(raw.toString("utf8"));
        validateSaTrainingIndex(payload, manifest);
        const golden = JSON.parse(readFileSync(resolve("game-db/fixtures/sa-training/reference-cases.json"), "utf8"));
        strictEqual(payload.rules.version, golden.rulesVersion);
        strictEqual(payload.sourceSnapshotVersion, golden.sourceSnapshotVersion);
        const evaluator = createSaTrainingEvaluator(payload);
        for (const { target, material, ...expected } of golden.cases) {
            deepStrictEqual(evaluator.evaluate(target, material), expected, `${target} <- ${material}`);
        }
        for (const target of ["1018251", "1032611", "1031821", "2000670", "1012170", "1012171", "1001900", "3001110", "1030611"]) {
            strictEqual(evaluator.findMaterials(target).length > 0, true, target);
        }
        const gokuForms = evaluator.findMaterials("1018251").filter(m => m.sourceCardId === "2000670");
        strictEqual(gokuForms.some(m => m.formCardId === "2000670" && m.rarityRaw === 1), true);
        strictEqual(gokuForms.some(m => m.formCardId === "2000671" && m.rarityRaw === 2), true);
    });
    it("covers every approved matrix cell using actual material rarity", () => {
        const { payload } = buildSaTrainingIndex(fixture());
        const evaluator = createSaTrainingEvaluator(payload);
        for (let target = 0; target < 6; target++) for (let material = 0; material < 6; material++) {
            deepStrictEqual(evaluator.evaluate(String(target + 1), String(material + 11)), {
                kind: "compatible", chancePercent: SA_RATE_MATRIX[target][material], gain: "one-level",
            });
        }
    });

    it("same path overrides the matrix and transfers SA, not just one level", () => {
        const { payload } = buildSaTrainingIndex(fixture());
        deepStrictEqual(createSaTrainingEvaluator(payload).evaluate("16", "11"), { kind: "same-path", chancePercent: 100, gain: "transfer" });
    });

    it("retains initial target profile after Z awakening while material rate changes", () => {
        const o = fixture();
        o.tables.cards.push({ ...o.tables.cards.find(c => c.id === "3")!, id: "103", rarity: "3" });
        o.tables.card_awakening_routes.push({ id: "100", type: "CardAwakeningRoute::Zet", card_id: "3", awaked_card_id: "103" });
        o.primaryCharacters.push({ id: "103" }); o.primaryManifest.characterCount++;
        const e = createSaTrainingEvaluator(buildSaTrainingIndex(o).payload);
        deepStrictEqual(e.evaluate("3", "13"), e.evaluate("103", "13"));
        deepStrictEqual(e.evaluate("103", "13"), { kind: "compatible", chancePercent: 30, gain: "one-level" });
        deepStrictEqual(e.evaluate("103", "14"), { kind: "compatible", chancePercent: 50, gain: "one-level" });
    });

    it("keeps legitimate Dokkan UR-to-SSR transitions as in the farmable R Goku path", () => {
        const o = fixture();
        o.tables.cards.find(c => c.id === "15")!.rarity = "3";
        o.tables.cards.find(c => c.id === "14")!.rarity = "4";
        const b = buildSaTrainingIndex(o);
        strictEqual(b.payload.materials[0].formCardIds.length, 6);
        strictEqual(b.payload.quarantines.length, 0);
        deepStrictEqual(createSaTrainingEvaluator(b.payload).evaluate("16", "11"), { kind: "same-path", chancePercent: 100, gain: "transfer" });
    });

    it("keeps exact source and every forward preparation, never invents a previous drop", () => {
        const o = fixture(); o.stageCatalog.characterDrops[0].reward.itemId = "14"; o.stageCatalog.eventMissions = [];
        const b = buildSaTrainingIndex(o);
        deepStrictEqual(b.payload.materials[0].formCardIds, ["14", "15", "16"]);
        strictEqual(createSaTrainingEvaluator(b.payload).findMaterials("3").length, 3);
        strictEqual(b.payload.materials[0].sourceCardId, "14");
    });

    it("references complete Stage sources without multiplying or losing reward ordinals", () => {
        const o = fixture(), before = JSON.stringify(o);
        const b = buildSaTrainingIndex(o);
        deepStrictEqual(b.payload.materials[0], { sourceCardId: "11", formCardIds: ["11", "12", "13", "14", "15", "16"], stageIds: ["20"], missionIds: ["30"] });
        strictEqual(JSON.stringify(o), before);
        strictEqual(o.stageCatalog.eventMissions[0].rewards.length, 2);
    });

    it("distinguishes zero, unknown chance, incompatible and absent targets", () => {
        const o = fixture(); o.tables.cards.push({ ...o.tables.cards[0], id: "90", card_unique_info_id: "200" });
        o.tables.card_unique_infos.push({ id: "200", name: "Goten" });
        o.primaryCharacters.push({ id: "90" }); o.primaryManifest.characterCount++;
        const e = createSaTrainingEvaluator(buildSaTrainingIndex(o).payload);
        deepStrictEqual(e.evaluate("5", "12"), { kind: "compatible", chancePercent: 0, gain: "one-level" });
        deepStrictEqual(e.evaluate("6", "16"), { kind: "compatible", chancePercent: null, gain: "one-level" });
        deepStrictEqual(e.evaluate("90", "12"), { kind: "incompatible" });
        deepStrictEqual(e.evaluate("999", "12"), { kind: "insufficient-evidence" });
    });

    it("does not interpret unowned raw singleton/battle rows as supported targets", () => {
        const o = fixture(); o.tables.cards.push({ ...o.tables.cards[0], id: "90" });
        const b = buildSaTrainingIndex(o);
        strictEqual(b.payload.cards.some(c => c.id === "90"), false);
        deepStrictEqual(createSaTrainingEvaluator(b.payload).evaluate("90", "11"), { kind: "insufficient-evidence" });
    });

    it("does not split joint display names into exchange-only character names", () => {
        const o = fixture();
        o.tables.cards.find(c => c.id === "16")!.card_unique_info_id = "200";
        o.tables.cards.find(c => c.id === "1")!.card_unique_info_id = "300";
        o.tables.card_unique_infos.push({ id: "200", name: "Trunks + Goten" }, { id: "300", name: "Goten" });
        const e = createSaTrainingEvaluator(buildSaTrainingIndex(o).payload);
        deepStrictEqual(e.evaluate("16", "1"), { kind: "incompatible" });
        deepStrictEqual(e.evaluate("16", "11"), { kind: "same-path", chancePercent: 100, gain: "transfer" });
    });

    for (const defect of ["branch", "cycle", "self", "dangling", "conflict"] as const) {
        it(`quarantines a complete component containing ${defect}`, () => {
            const o = fixture();
            const a = defect === "cycle" ? "16" : "11";
            const b = defect === "self" ? "11" : defect === "dangling" ? "999" : defect === "cycle" ? "11" : "16";
            o.tables.card_awakening_routes.push({ id: defect === "conflict" ? "1" : "99", type: "CardAwakeningRoute::Zet", card_id: a, awaked_card_id: b });
            const result = buildSaTrainingIndex(o);
            strictEqual(result.payload.materials.length, 0);
            strictEqual(result.payload.quarantines.some(q => q.cardIds.includes("11")), true);
        });
    }

    it("ignores Optimal self edges, keeps native LR sources, excludes Kais/statues with audited reasons", () => {
        const o = fixture();
        o.tables.card_awakening_routes.push({ id: "99", type: "CardAwakeningRoute::Optimal", card_id: "16", awaked_card_id: "16" });
        for (const [id, overrides] of [["70", { rarity: "5" }], ["71", { is_selling_only: "1" }], ["72", { cost: "99", exp_type: "5", training_exp: "10" }]] as const) {
            o.tables.cards.push({ ...o.tables.cards[0], id, ...overrides });
            o.stageCatalog.characterDrops.push({ stageId: "20", reward: { itemId: id, itemType: "Card" } });
        }
        const b = buildSaTrainingIndex(o);
        strictEqual(b.payload.materials.some(m => m.sourceCardId === "70"), true);
        deepStrictEqual(b.audit.excludedRewards.map(r => r.reason).sort(), ["selling-only", "training-signature-v1"]);
    });

    it("rejects incoherent source dependencies and tampered consumer contracts", () => {
        const bad = fixture(); bad.stageManifest.sourceSnapshotVersion = "456";
        throws(() => buildSaTrainingIndex(bad));
        const b = buildSaTrainingIndex(fixture());
        for (const corrupt of [
            (p: any) => p.rules.rateMatrix[5][5] = 100,
            (p: any) => p.cards.push(p.cards[0]),
            (p: any) => p.materials[0].formCardIds.reverse(),
            (p: any) => p.paths[0].nameIdentityIds.push("999"),
            (p: any) => p.coverage.materialSourceCount++,
        ]) { const p = JSON.parse(JSON.stringify(b.payload)); corrupt(p); throws(() => validateSaTrainingIndex(p)); }
        throws(() => validateSaTrainingIndex(b.payload, { ...b.manifest, datasetVersion: "wrong" }));
    });

    it("rejects incomplete mission coverage and fake character rewards", () => {
        const incomplete = fixture(); incomplete.stageCatalog.eventMissionsComplete = false;
        throws(() => buildSaTrainingIndex(incomplete));
        const wrongType = fixture(); wrongType.stageCatalog.characterDrops[0].reward.itemType = "AwakeningItem";
        throws(() => buildSaTrainingIndex(wrongType));
    });

    it("withholds endpoints of unsupported transformation or exchange route types", () => {
        const o = fixture();
        o.tables.card_awakening_routes.push({ id: "99", type: "CardAwakeningRoute::Transformation", card_id: "1", awaked_card_id: "2" });
        const b = buildSaTrainingIndex(o);
        deepStrictEqual(createSaTrainingEvaluator(b.payload).evaluate("2", "11"), { kind: "insufficient-evidence" });
        strictEqual(b.payload.quarantines.some(q => q.cardIds.includes("2")), true);
    });

    it("builds deterministic bytes and does not mutate source arrays", () => {
        const o = fixture(), before = JSON.stringify(o);
        const a = buildSaTrainingIndex(o), b = buildSaTrainingIndex(o);
        strictEqual(a.catalogGzip.equals(b.catalogGzip), true);
        strictEqual(JSON.stringify(o), before);
        validateSaTrainingIndex(a.payload, a.manifest);
    });
});
