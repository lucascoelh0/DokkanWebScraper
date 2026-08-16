"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const path_1 = require("path");
const wt0_audit_1 = require("./wt0-audit");
describe("world tournament WT0 path boundary", () => { it("rejects a HAR inside the worktree", () => { const root = (0, path_1.resolve)("synthetic-worktree"); assert.throws(() => (0, wt0_audit_1.assertExternalHarPath)(root, (0, path_1.resolve)(root, "capture.har")), /outside the worktree/); }); it("accepts an external sibling path", () => { const root = (0, path_1.resolve)("synthetic-worktree"); assert.doesNotThrow(() => (0, wt0_audit_1.assertExternalHarPath)(root, (0, path_1.resolve)("external-captures/capture.har"))); }); });
//# sourceMappingURL=wt0-run.spec.js.map