import * as assert from "assert";
import { isRealpathContained } from "./wt-source-boundary";
describe("world tournament WT0 path boundary", () => { it("rejects prefix collisions", () => assert.equal(isRealpathContained("C:\\capture", "C:\\capture-other\\capture.har"), false)); });
