"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const shadowBuilder = require("./shadow-builder");
const shadow_source_1 = require("./shadow-source");
describe("database character K11 shadow projection", () => {
    it("exports no K11 application path", () => {
        (0, assert_1.equal)(shadowBuilder.applyCharacterShadowInMemory, undefined);
    });
    it("prefers top-level product records and rejects divergent nested duplicate IDs", () => {
        const compact = (0, shadow_source_1.compactCharacters)([{ id: "base", transformations: [{ id: "1", name: "nested" }] }, { id: "1", name: "top" }]);
        (0, assert_1.equal)(compact.get("1")?.name, "top");
        (0, assert_1.equal)(compact.get("1")?.sourceRecordPath, "$[1]");
        assertThrows(() => (0, shadow_source_1.compactCharacters)([
            { id: "a", transformations: [{ id: "2", name: "left" }] },
            { id: "b", transformations: [{ id: "2", name: "right" }] },
        ]));
    });
});
function assertThrows(action) {
    let threw = false;
    try {
        action();
    }
    catch {
        threw = true;
    }
    (0, assert_1.equal)(threw, true);
}
//# sourceMappingURL=shadow-builder.spec.js.map