import * as assert from "assert";
import { resolve } from "path";
import { assertExternalHarPath } from "./wt0-audit";
describe("world tournament WT0 path boundary", () => { it("rejects a HAR inside the worktree", () => { const root = resolve("synthetic-worktree"); assert.throws(() => assertExternalHarPath(root, resolve(root, "capture.har")), /outside the worktree/); }); it("accepts an external sibling path", () => { const root = resolve("synthetic-worktree"); assert.doesNotThrow(() => assertExternalHarPath(root, resolve("external-captures/capture.har"))); }); });
