import { strict as assert } from "assert";
import { createHash } from "crypto";
import { buildFrontierF0, sanitizeFrontierF0Entry } from "./frontier-f0-audit";
import { FrontierF0SourceLock } from "./frontier-f0-contract";

function fixture() { return { log: { entries: [{ startedDateTime: "2026-08-10T12:00:00Z", request: { method: "GET", url: "https://ishin-global.aktsk.com//origin_episodes/2001?platform_country=synthetic", headers: [{ name: "Authorization", value: "synthetic-secret" }] }, response: { status: 200, headers: [], content: { mimeType: "application/json", text: "{}" } } }, { startedDateTime: "2026-08-10T12:00:01Z", request: { method: "POST", url: "https://ishin-global.aktsk.com/kobetu_battles/commands/next_turn", headers: [], postData: { mimeType: "application/json", text: "{\"battle_room_id\":1}" } }, response: { status: 200, headers: [], content: { mimeType: "application/x-zstd", encoding: "base64", text: "KLUv/Q==" } } }] } }; }
function lock(text: string): FrontierF0SourceLock { return { schemaVersion: 1, contract: "dokkan-frontier-offline-capture-source-lock", contractVersion: "0.1.0", captureRoot: "dokkan-har-0810", captureId: "frontier-2026-08-10", fileName: "frontier.har", sizeBytes: Buffer.byteLength(text), sha256: createHash("sha256").update(text).digest("hex"), entryCount: 2 }; }

describe("frontier F0 inventory", () => {
    it("normalizes structural paths and records only sensitive header names", () => { const text = JSON.stringify(fixture()), dataset = buildFrontierF0(text, lock(text)); assert.equal(dataset.entries[0].normalizedPath, "/origin_episodes/:id"); assert.equal(dataset.entries[0].scope, "mixed_product_account"); assert.deepEqual(dataset.entries[0].sensitiveRequestHeaderNames, ["authorization"]); assert.equal(JSON.stringify(dataset).includes("synthetic-secret"), false); assert.equal(dataset.entries[1].trafficClass, "mutation_observed"); });
    it("fails closed on source drift", () => { const text = JSON.stringify(fixture()); assert.throws(() => buildFrontierF0(`${text} `, lock(text)), /identity mismatch/); });
    it("collapses unknown hosts and paths", () => { const value = sanitizeFrontierF0Entry({ request: { method: "GET", url: "https://example.invalid/private/123" }, response: { status: 200, content: {} } }, 0); assert.equal(value.hostClass, "unknown"); assert.equal(value.normalizedPath, "/:unknown"); });
});
