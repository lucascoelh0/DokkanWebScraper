"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const promises_1 = require("fs/promises");
const crypto_1 = require("crypto");
const path_1 = require("path");
const zlib_1 = require("zlib");
const taxonomy_projection_delivery_contract_1 = require("./taxonomy-projection-delivery-contract");
const taxonomy_projection_object_plan_contract_1 = require("./taxonomy-projection-object-plan-contract");
const taxonomy_projection_public_shadow_contract_1 = require("./taxonomy-projection-public-shadow-contract");
const taxonomy_projection_public_shadow_1 = require("./taxonomy-projection-public-shadow");
const taxonomy_projection_public_shadow_run_1 = require("./taxonomy-projection-public-shadow-run");
const CHECKED_AT = "2026-08-14T21:07:41.393Z";
const PLAN_ID = "7411a1c5b3220e5acf248fb5e670c03c437c699cb2b765fab0aa50fd9001d204";
const RELEASE_ID = "4a6dcfa4b8818abbd070bad2a1318eec5df9a2b1b306286adfec5fadee8ddfe4";
describe("K41 public taxonomy projection shadow", () => {
    afterEach(() => { delete globalThis[taxonomy_projection_public_shadow_1.__taxonomyProjectionPublicShadowTestHook]; });
    it("accepts only the exact read-only CLI opt-in shape", () => {
        (0, assert_1.deepStrictEqual)((0, taxonomy_projection_public_shadow_run_1.parseTaxonomyProjectionPublicShadowCli)([
            "--opt-in-k41", "--remote-read-only", "--checked-at", CHECKED_AT,
        ]), { optInK41: true, remoteReadOnly: true, checkedAt: CHECKED_AT });
        for (const args of [
            ["--remote-read-only", "--checked-at", CHECKED_AT],
            ["--opt-in-k41", "--remote-read-only", "--checked-at", CHECKED_AT, "--publish"],
            ["--opt-in-k41", "--remote-read-only", "--checked-at", CHECKED_AT, "--checked-at", CHECKED_AT],
        ])
            (0, assert_1.throws)(() => (0, taxonomy_projection_public_shadow_run_1.parseTaxonomyProjectionPublicShadowCli)(args), /K41|duplicate|unsupported/);
    });
    it("always exercises exact byte/hash/size integrity without external fixtures", () => {
        const bytes = Buffer.from("portable-k41-integrity-fixture", "utf8");
        const digest = (0, crypto_1.createHash)("sha256").update(bytes).digest("hex");
        (0, taxonomy_projection_public_shadow_1.verifyTaxonomyProjectionPublicShadowBytes)(bytes, bytes.length, digest);
        (0, assert_1.throws)(() => (0, taxonomy_projection_public_shadow_1.verifyTaxonomyProjectionPublicShadowBytes)(Buffer.concat([bytes, Buffer.from("x")]), bytes.length, digest), /immutable object hash or size mismatch/);
        (0, assert_1.throws)(() => (0, taxonomy_projection_public_shadow_1.verifyTaxonomyProjectionPublicShadowBytes)(bytes, bytes.length, "0".repeat(64)), /immutable object hash or size mismatch/);
    });
    it("always exercises cloned cardId lookup and preserved omitted dimensions", () => {
        const source = [{ cardId: "1", characterClass: { raw: 0, normalized: "super" } }, {
                cardId: "2", categories: [{ categoryId: "7", relationRowId: "11" }],
            }];
        const lookup = (0, taxonomy_projection_public_shadow_1.createTaxonomyProjectionPublicShadowLookup)(source);
        const first = lookup("1");
        (0, assert_1.strictEqual)(first.categories, undefined);
        first.characterClass.normalized = "mutated";
        (0, assert_1.deepStrictEqual)(lookup("1"), source[0]);
        (0, assert_1.strictEqual)(lookup("not-an-id"), undefined);
        (0, assert_1.throws)(() => (0, taxonomy_projection_public_shadow_1.createTaxonomyProjectionPublicShadowLookup)([...source, source[0]]), /lookup cardId uniqueness rejected/);
    });
    it("always rejects mutable-manifest drift before any immutable read", async () => {
        let calls = 0;
        globalThis[taxonomy_projection_public_shadow_1.__taxonomyProjectionPublicShadowTestHook] = {
            async get() { calls++; return { bytes: Buffer.from("{}\n"), contentType: "application/json", cacheControl: "no-store" }; },
        };
        await (0, assert_1.rejects)((0, taxonomy_projection_public_shadow_1.loadTaxonomyProjectionPublicShadow)({ optInK41: true, remoteReadOnly: true, checkedAt: CHECKED_AT }), /mutable manifest pin mismatch/);
        (0, assert_1.strictEqual)(calls, 1);
    });
    async function localFixture() {
        const k37Root = process.env.K41_TEST_K37_ROOT;
        const k36Root = process.env.K41_TEST_K36_ROOT;
        if (!k37Root || !k36Root)
            return undefined;
        const manifestBytes = await (0, promises_1.readFile)((0, path_1.join)(k37Root, taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_OBJECT_PLAN_NAMESPACE, PLAN_ID, taxonomy_projection_object_plan_contract_1.TAXONOMY_PROJECTION_REMOTE_MANIFEST_CANDIDATE_FILE));
        const manifest = JSON.parse(manifestBytes.toString("utf8"));
        const responses = new Map();
        responses.set(taxonomy_projection_public_shadow_contract_1.TAXONOMY_PROJECTION_PUBLIC_SHADOW_MANIFEST_KEY, {
            bytes: manifestBytes, contentType: "application/json", cacheControl: "no-store",
        });
        for (const object of manifest.inventory.objects) {
            responses.set(object.objectKey, {
                bytes: await (0, promises_1.readFile)((0, path_1.join)(k36Root, taxonomy_projection_delivery_contract_1.TAXONOMY_PROJECTION_DELIVERY_NAMESPACE, RELEASE_ID, object.sourceFileName)),
                contentType: object.kind === "payload" ? "application/gzip" : "application/json",
                cacheControl: object.cacheControl,
            });
        }
        const payload = responses.get(manifest.inventory.objects[0].objectKey).bytes;
        const firstRecord = JSON.parse((0, zlib_1.gunzipSync)(payload).toString("utf8")).records[0];
        return { manifest, responses, firstRecord };
    }
    it("consumes the exact local K36/K37 fixture and keeps its report bounded and non-authoritative", async function () {
        const fixture = await localFixture();
        if (!fixture) {
            this.skip();
            return;
        }
        const calls = [];
        globalThis[taxonomy_projection_public_shadow_1.__taxonomyProjectionPublicShadowTestHook] = {
            async get(key) { calls.push(key); return fixture.responses.get(key); },
        };
        const shadow = await (0, taxonomy_projection_public_shadow_1.loadTaxonomyProjectionPublicShadow)({
            optInK41: true, remoteReadOnly: true, checkedAt: CHECKED_AT,
        });
        const report = shadow.report;
        (0, assert_1.strictEqual)(calls.length, 5);
        (0, assert_1.deepStrictEqual)(calls.slice(1), fixture.manifest.inventory.objects.map(object => object.objectKey));
        (0, assert_1.deepStrictEqual)(shadow.lookup(fixture.firstRecord.cardId), fixture.firstRecord);
        const first = shadow.lookup(fixture.firstRecord.cardId);
        first.categories?.splice(0);
        (0, assert_1.deepStrictEqual)(shadow.lookup(fixture.firstRecord.cardId), fixture.firstRecord);
        (0, assert_1.ok)(Buffer.byteLength(JSON.stringify(report)) < 16 * 1024);
        (0, assert_1.deepStrictEqual)(report.readiness, {
            publicDelivery: "GO", remoteShadowLookup: "GO", persistedConsumer: "NO-GO", characterArray: "NO-GO",
            applyOrOverlay: "NO-GO", android: "NO-GO", authority: "NO-GO", production: "NO-GO",
            fyiRemoval: "NO-GO", dokkanInfoRemoval: "NO-GO",
        });
    });
});
//# sourceMappingURL=taxonomy-projection-public-shadow.spec.js.map