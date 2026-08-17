"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const wt_source_boundary_1 = require("./wt-source-boundary");
describe("world tournament WT0 path boundary", () => { it("rejects prefix collisions", () => assert.equal((0, wt_source_boundary_1.isRealpathContained)("C:\\capture", "C:\\capture-other\\capture.har"), false)); });
//# sourceMappingURL=wt0-run.spec.js.map