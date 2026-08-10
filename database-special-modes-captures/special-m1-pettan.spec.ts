import { strict as assert } from "assert";
import { createHash } from "crypto";
import { buildSpecialM1 } from "./special-m1-pettan";
import { SpecialM0Dataset } from "./special-m0-contract";

describe("special modes M1 Pettan observation", () => {
    it("keeps the inactive pack list and mutation shapes without account values or battle claims", () => { const entries = [{ startedDateTime: "2026-08-10T12:00:00Z", request: { method: "GET", url: "https://ishin-global.aktsk.com/sd/packs" }, response: { status: 200, content: { mimeType: "application/json", text: "{\"sd_packs\":[]}" } } }, { startedDateTime: "2026-08-10T12:00:01Z", request: { method: "POST", url: "https://ishin-global.aktsk.com/sd/packs/open" }, response: { status: 200, content: { mimeType: "application/json", text: "{\"user_items\":{\"secret\":\"synthetic-secret\"},\"items\":[]}" } } }], har = JSON.stringify({ log: { entries } }), hash = createHash("sha256").update(har).digest("hex"), m0 = { generatedAt: "2026-08-10T12:00:01.000Z", sources: [{ captureId: "pettan-not-live-2026-08-10", sha256: hash, sizeBytes: Buffer.byteLength(har) }] } as SpecialM0Dataset, dataset = buildSpecialM1(har, m0, "synthetic-m0"), text = JSON.stringify(dataset); assert.equal(dataset.packIndexObservations[0].packCount, 0); assert.equal(dataset.availability.inference, "unknown"); assert.equal(dataset.battleEvidence.observedRouteCount, 0); assert.deepEqual(dataset.operations[0].responseShape.sort(), ["$.[account-subtree]:object", "$.[account-subtree]:array"].sort()); assert(!text.includes("synthetic-secret")); });
});
