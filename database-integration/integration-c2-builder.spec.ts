import { equal } from "assert";
import { countForbiddenConsumerFields, projectIntegrationC2Target, projectSupportedIntegrationDimension } from "./integration-c2-builder";

describe("database-first integration C2 supported projection", () => {
    it("projects only dimensions whose status is exactly supported", () => {
        equal(projectSupportedIntegrationDimension({ status: "supported", value: 42 }), 42);
        equal(projectSupportedIntegrationDimension({ status: "partial", missing: ["reset"] }), undefined);
        equal(projectSupportedIntegrationDimension({ status: "unknown", missing: ["proof"] }), undefined);
    });
    it("detects uncertainty, audit and presentation fields recursively", () => {
        equal(countForbiddenConsumerFields({ rules: [{ supported: { value: 1 } }] }), 0);
        for (const value of [{ status: "supported" }, { missing: ["proof"] }, { audit: {} }, { nested: { raw: 1 } }, { identity: { displayName: "Goku" } }, { sourceText: "text" }, { provenance: {} }]) equal(countForbiddenConsumerFields(value) > 0, true);
    });
    it("strips raw, provenance and localized text from supported target selectors", () => {
        const target = projectIntegrationC2Target({ raw: 2, scope: "team_allies", selfInclusion: "included", subTarget: { rawSetId: 31, composition: "and", emptySetBehavior: "identity", filters: [{ rowId: "33", rawValueType: 1, rawValue: 16, selectorId: "16", provenance: { database: {} }, status: "supported", selector: "card_category_id", inclusion: "include", localizedText: { name: "Movie Bosses", kana: null } }] } } as any);
        equal(JSON.stringify(target), JSON.stringify({ scope: "team_allies", selfInclusion: "included", subTarget: { composition: "and", emptySetBehavior: "identity", filters: [{ selector: "card_category_id", inclusion: "include", selectorId: "16" }] } }));
        equal(countForbiddenConsumerFields(target), 0);
        equal(projectIntegrationC2Target({ raw: 2, scope: "team_allies", selfInclusion: "included", subTarget: { rawSetId: 1, composition: "and", emptySetBehavior: "identity", filters: [{ status: "partial", selector: "metamorphic_type_raw", inclusion: "unknown", selectorId: null }] } } as any), undefined);
    });
});
