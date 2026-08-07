"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const integration_c2_builder_1 = require("./integration-c2-builder");
describe("database-first integration C2 supported projection", () => {
    it("projects only dimensions whose status is exactly supported", () => {
        (0, assert_1.equal)((0, integration_c2_builder_1.projectSupportedIntegrationDimension)({ status: "supported", value: 42 }), 42);
        (0, assert_1.equal)((0, integration_c2_builder_1.projectSupportedIntegrationDimension)({ status: "partial", missing: ["reset"] }), undefined);
        (0, assert_1.equal)((0, integration_c2_builder_1.projectSupportedIntegrationDimension)({ status: "unknown", missing: ["proof"] }), undefined);
    });
    it("detects uncertainty, audit and presentation fields recursively", () => {
        (0, assert_1.equal)((0, integration_c2_builder_1.countForbiddenConsumerFields)({ rules: [{ supported: { value: 1 } }] }), 0);
        for (const value of [{ status: "supported" }, { missing: ["proof"] }, { audit: {} }, { nested: { raw: 1 } }, { identity: { displayName: "Goku" } }, { sourceText: "text" }, { provenance: {} }])
            (0, assert_1.equal)((0, integration_c2_builder_1.countForbiddenConsumerFields)(value) > 0, true);
    });
    it("strips raw, provenance and localized text from supported target selectors", () => {
        const target = (0, integration_c2_builder_1.projectIntegrationC2Target)({ raw: 2, scope: "team_allies", selfInclusion: "included", subTarget: { rawSetId: 31, composition: "and", emptySetBehavior: "identity", filters: [{ rowId: "33", rawValueType: 1, rawValue: 16, selectorId: "16", provenance: { database: {} }, status: "supported", selector: "card_category_id", inclusion: "include", localizedText: { name: "Movie Bosses", kana: null } }] } });
        (0, assert_1.equal)(JSON.stringify(target), JSON.stringify({ scope: "team_allies", selfInclusion: "included", subTarget: { composition: "and", emptySetBehavior: "identity", filters: [{ selector: "card_category_id", inclusion: "include", selectorId: "16" }] } }));
        (0, assert_1.equal)((0, integration_c2_builder_1.countForbiddenConsumerFields)(target), 0);
        (0, assert_1.equal)((0, integration_c2_builder_1.projectIntegrationC2Target)({ raw: 2, scope: "team_allies", selfInclusion: "included", subTarget: { rawSetId: 1, composition: "and", emptySetBehavior: "identity", filters: [{ status: "partial", selector: "metamorphic_type_raw", inclusion: "unknown", selectorId: null }] } }), undefined);
    });
});
//# sourceMappingURL=integration-c2-builder.spec.js.map