"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const frontier_f5_parity_1 = require("./frontier-f5-parity");
describe("Frontier F5 parity classifier", () => { it("keeps absence, gain and representation mismatch distinct", () => { assert_1.strict.equal((0, frontier_f5_parity_1.classifyStructuralPresence)(true, true), "agreement"); assert_1.strict.equal((0, frontier_f5_parity_1.classifyStructuralPresence)(true, true, false), "representation_mismatch"); assert_1.strict.equal((0, frontier_f5_parity_1.classifyStructuralPresence)(true, false), "representation_gain"); assert_1.strict.equal((0, frontier_f5_parity_1.classifyStructuralPresence)(false, true), "coverage_gap"); assert_1.strict.equal((0, frontier_f5_parity_1.classifyStructuralPresence)(false, false), "unknown"); }); });
//# sourceMappingURL=frontier-f5-parity.spec.js.map