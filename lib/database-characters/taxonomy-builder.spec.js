"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const taxonomy_validator_1 = require("./taxonomy-validator");
describe("database character taxonomy", () => {
    it("fails closed without the complete ID dictionaries", () => {
        const dataset = { localeAudit: { presentationTextAsIdentity: false, otherLocales: "unknown" }, cards: [], categories: [], links: [] };
        const coverage = { cardCount: 0, categoryCount: 0, linkCount: 0, linkLevelCount: 0, linkEffectRowCount: 0, missingCardLabelCount: 0, missingCategoryLabelCount: 0, missingLinkLabelCount: 0, duplicateCategoryIdentityCount: 0, duplicateLinkIdentityCount: 0 };
        assert.strictEqual((0, taxonomy_validator_1.validateDatabaseCharacterTaxonomyDataset)(dataset, coverage).valid, false);
    });
});
//# sourceMappingURL=taxonomy-builder.spec.js.map