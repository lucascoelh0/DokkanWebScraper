import assert = require("assert");
import { validateDatabaseCharacterTaxonomyDataset } from "./taxonomy-validator";
describe("database character taxonomy", () => {
    it("fails closed without the complete ID dictionaries", () => {
        const dataset: any = { localeAudit: { presentationTextAsIdentity: false, otherLocales: "unknown" }, cards: [], categories: [], links: [] };
        const coverage: any = { cardCount: 0, categoryCount: 0, linkCount: 0, linkLevelCount: 0, linkEffectRowCount: 0, missingCardLabelCount: 0, missingCategoryLabelCount: 0, missingLinkLabelCount: 0, duplicateCategoryIdentityCount: 0, duplicateLinkIdentityCount: 0 };
        assert.strictEqual(validateDatabaseCharacterTaxonomyDataset(dataset, coverage).valid, false);
    });
});
