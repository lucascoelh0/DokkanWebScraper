"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const compact_builder_1 = require("./compact-builder");
const compact_validator_1 = require("./compact-validator");
const compactBuilder = require("./compact-builder");
const field = (cardId, name, changes = {}) => ({
    cardId,
    recordKind: "collectable",
    characterId: `character-${cardId}`,
    stateId: `state-${cardId}`,
    releaseState: "initial",
    growthRowId: null,
    productionJoin: { status: "joined", externalId: cardId, comparisonState: { stateKey: `${cardId}:initial` } },
    fyiJoin: { status: "unjoinable", externalId: null, comparisonState: { stateKey: `${cardId}:initial` } },
    field: name,
    characterField: name,
    databaseValue: name === "id" ? cardId : name === "rarity" ? "UR" : "AGL",
    externalValue: { production: name === "id" ? cardId : name === "rarity" ? "UR" : "AGL", fyi: null },
    effectiveShadowValue: name === "id" ? cardId : name === "rarity" ? "UR" : "AGL",
    evidenceStatus: "supported",
    authority: "database_candidate",
    comparison: "agreement",
    sourceComparisons: { production: "agreement", fyi: "unjoinable" },
    provenance: [],
    fallbackReason: null,
    ...changes,
});
const addCard = (builder, cardId, changes = {}) => {
    for (const name of ["id", "rarity", "type"])
        builder.accept(field(cardId, name, changes[name]));
};
describe("database character K15 compact builder", () => {
    it("allows agreements and a rarity representation gain while retaining only the minimum binding", () => {
        const builder = new compact_builder_1.CharacterCompactProjectionBuilder((0, compact_validator_1.pinnedCharacterCompactLineage)(), "2026-08-05T00:00:00.000Z", "global-6.4.0-v338-2026-08-05-k15-v1");
        addCard(builder, "2");
        addCard(builder, "1", { rarity: {
                databaseValue: "SSR",
                comparison: "representation_gain",
                sourceComparisons: { production: "representation_gain", fyi: "unjoinable" },
                externalValue: { production: "UR", fyi: null },
                provenance: [{ source: "database", artifact: "k2", path: "cards.rarity" }],
            } });
        const retained = builder.cards.get("1");
        (0, assert_1.deepStrictEqual)(retained.fields.rarity, { databaseValue: "SSR", comparison: "representation_gain", exclusion: null });
        (0, assert_1.equal)("externalValue" in retained.fields.rarity, false);
        (0, assert_1.equal)("provenance" in retained.fields.rarity, false);
        const result = builder.finish();
        (0, assert_1.deepStrictEqual)(result.projection.records, [
            { cardId: "1", stateId: "state-1", rarity: "SSR", type: "AGL" },
            { cardId: "2", stateId: "state-2", rarity: "UR", type: "AGL" },
        ]);
        (0, assert_1.equal)(result.coverage.comparisons.rarity.representationGains, 1);
        (0, assert_1.deepStrictEqual)(Object.keys(result.projection.records[0]), ["cardId", "stateId", "rarity", "type"]);
    });
    it("excludes mismatch, conflict, unknown, partial and unjoinable cards instead of carrying audit data", () => {
        const builder = new compact_builder_1.CharacterCompactProjectionBuilder((0, compact_validator_1.pinnedCharacterCompactLineage)(), "2026-08-05T00:00:00.000Z", "global-6.4.0-v338-2026-08-05-k15-v1");
        addCard(builder, "1", { rarity: { comparison: "representation_mismatch", sourceComparisons: { production: "representation_mismatch", fyi: "unjoinable" } } });
        addCard(builder, "2", { rarity: { comparison: "confirmed_conflict", sourceComparisons: { production: "confirmed_conflict", fyi: "unjoinable" } } });
        addCard(builder, "3", { rarity: { evidenceStatus: "unknown", comparison: "unknown", sourceComparisons: { production: "unknown", fyi: "unjoinable" } } });
        addCard(builder, "4", { rarity: { evidenceStatus: "partial", comparison: "unknown", sourceComparisons: { production: "unknown", fyi: "unjoinable" } } });
        addCard(builder, "5", { id: { productionJoin: { status: "unjoinable", externalId: null, comparisonState: { stateKey: "5:initial" } }, comparison: "unjoinable", sourceComparisons: { production: "unjoinable", fyi: "unjoinable" }, authority: "unsupported" } });
        const result = builder.finish();
        (0, assert_1.equal)(result.projection.records.length, 0);
        (0, assert_1.deepStrictEqual)(result.coverage.exclusions, { unjoinable: 1, partial: 1, unknown: 1, mismatch: 1, conflict: 1, invalidEnum: 0, ambiguousBinding: 0, incomplete: 0 });
    });
    it("fails closed on duplicate source fields and pinned-count drift", () => {
        const builder = new compact_builder_1.CharacterCompactProjectionBuilder((0, compact_validator_1.pinnedCharacterCompactLineage)(), "2026-08-05T00:00:00.000Z", "global-6.4.0-v338-2026-08-05-k15-v1");
        builder.accept(field("1", "id"));
        (0, assert_1.throws)(() => builder.accept(field("1", "id")), /duplicate K11 compact source field/);
        (0, assert_1.throws)(() => builder.finish(true), /pinned snapshot expectations changed/);
    });
    it("implements no Character apply, merge or fallback API", () => {
        (0, assert_1.equal)(compactBuilder.applyCharacterCompactInMemory, undefined);
        (0, assert_1.equal)(compactBuilder.mergeCharacters, undefined);
        const source = [{ id: "missing", rarity: "SSR", type: "PHY" }];
        const before = JSON.stringify(source);
        (0, assert_1.ok)(!("fallback" in compactBuilder));
        (0, assert_1.equal)(JSON.stringify(source), before);
    });
});
//# sourceMappingURL=compact-builder.spec.js.map