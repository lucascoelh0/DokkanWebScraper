import { equal } from "assert";
import * as shadowBuilder from "./shadow-builder";
import { compactCharacters } from "./shadow-source";

describe("database character K11 shadow projection", () => {
    it("exports no K11 application path", () => {
        equal((shadowBuilder as any).applyCharacterShadowInMemory, undefined);
    });

    it("prefers top-level product records and rejects divergent nested duplicate IDs", () => {
        const compact = compactCharacters([{ id: "base", transformations: [{ id: "1", name: "nested" }] }, { id: "1", name: "top" }]);
        equal(compact.get("1")?.name, "top");
        equal(compact.get("1")?.sourceRecordPath, "$[1]");
        assertThrows(() => compactCharacters([
            { id: "a", transformations: [{ id: "2", name: "left" }] },
            { id: "b", transformations: [{ id: "2", name: "right" }] },
        ]));
    });
});

function assertThrows(action: () => unknown): void {
    let threw = false;
    try { action(); } catch { threw = true; }
    equal(threw, true);
}
