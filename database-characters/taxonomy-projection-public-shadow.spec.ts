import { deepStrictEqual, ok, rejects, strictEqual, throws } from "assert";
import { readFile } from "fs/promises";
import { createHash } from "crypto";
import { join } from "path";
import { gunzipSync } from "zlib";
import { TAXONOMY_PROJECTION_DELIVERY_NAMESPACE } from "./taxonomy-projection-delivery-contract";
import {
    TAXONOMY_PROJECTION_OBJECT_PLAN_NAMESPACE,
    TAXONOMY_PROJECTION_REMOTE_MANIFEST_CANDIDATE_FILE,
    TaxonomyProjectionRemoteManifestCandidate,
} from "./taxonomy-projection-object-plan-contract";
import {
    TAXONOMY_PROJECTION_PUBLIC_SHADOW_MANIFEST_KEY,
    TaxonomyProjectionPublicShadowReport,
} from "./taxonomy-projection-public-shadow-contract";
import {
    __taxonomyProjectionPublicShadowTestHook,
    createTaxonomyProjectionPublicShadowLookup,
    loadTaxonomyProjectionPublicShadow,
    verifyTaxonomyProjectionPublicShadowBytes,
} from "./taxonomy-projection-public-shadow";
import { parseTaxonomyProjectionPublicShadowCli } from "./taxonomy-projection-public-shadow-run";

const CHECKED_AT = "2026-08-14T21:07:41.393Z";
const PLAN_ID = "7411a1c5b3220e5acf248fb5e670c03c437c699cb2b765fab0aa50fd9001d204";
const RELEASE_ID = "4a6dcfa4b8818abbd070bad2a1318eec5df9a2b1b306286adfec5fadee8ddfe4";

describe("K41 public taxonomy projection shadow", () => {
afterEach(() => { delete (globalThis as any)[__taxonomyProjectionPublicShadowTestHook]; });

it("accepts only the exact read-only CLI opt-in shape", () => {
    deepStrictEqual(parseTaxonomyProjectionPublicShadowCli([
        "--opt-in-k41", "--remote-read-only", "--checked-at", CHECKED_AT,
    ]), { optInK41: true, remoteReadOnly: true, checkedAt: CHECKED_AT });
    for (const args of [
        ["--remote-read-only", "--checked-at", CHECKED_AT],
        ["--opt-in-k41", "--remote-read-only", "--checked-at", CHECKED_AT, "--publish"],
        ["--opt-in-k41", "--remote-read-only", "--checked-at", CHECKED_AT, "--checked-at", CHECKED_AT],
    ]) throws(() => parseTaxonomyProjectionPublicShadowCli(args), /K41|duplicate|unsupported/);
});

it("always exercises exact byte/hash/size integrity without external fixtures", () => {
    const bytes = Buffer.from("portable-k41-integrity-fixture", "utf8");
    const digest = createHash("sha256").update(bytes).digest("hex");
    verifyTaxonomyProjectionPublicShadowBytes(bytes, bytes.length, digest);
    throws(() => verifyTaxonomyProjectionPublicShadowBytes(Buffer.concat([bytes, Buffer.from("x")]), bytes.length, digest),
        /immutable object hash or size mismatch/);
    throws(() => verifyTaxonomyProjectionPublicShadowBytes(bytes, bytes.length, "0".repeat(64)),
        /immutable object hash or size mismatch/);
});

it("always exercises cloned cardId lookup and preserved omitted dimensions", () => {
    const source = [{ cardId: "1", characterClass: { raw: 0, normalized: "super" } }, {
        cardId: "2", categories: [{ categoryId: "7", relationRowId: "11" }],
    }];
    const lookup = createTaxonomyProjectionPublicShadowLookup(source);
    const first = lookup("1")!;
    strictEqual(first.categories, undefined);
    (first.characterClass as any).normalized = "mutated";
    deepStrictEqual(lookup("1"), source[0]);
    strictEqual(lookup("not-an-id"), undefined);
    throws(() => createTaxonomyProjectionPublicShadowLookup([...source, source[0]]), /lookup cardId uniqueness rejected/);
});

it("always rejects mutable-manifest drift before any immutable read", async () => {
    let calls = 0;
    (globalThis as any)[__taxonomyProjectionPublicShadowTestHook] = {
        async get() { calls++; return { bytes: Buffer.from("{}\n"), contentType: "application/json", cacheControl: "no-store" }; },
    };
    await rejects(loadTaxonomyProjectionPublicShadow({ optInK41: true, remoteReadOnly: true, checkedAt: CHECKED_AT }),
        /mutable manifest pin mismatch/);
    strictEqual(calls, 1);
});

async function localFixture(): Promise<{
    manifest: TaxonomyProjectionRemoteManifestCandidate;
    responses: Map<string, { bytes: Buffer; contentType: string; cacheControl: string }>;
    firstRecord: any;
} | undefined> {
    const k37Root = process.env.K41_TEST_K37_ROOT;
    const k36Root = process.env.K41_TEST_K36_ROOT;
    if (!k37Root || !k36Root) return undefined;
    const manifestBytes = await readFile(join(k37Root, TAXONOMY_PROJECTION_OBJECT_PLAN_NAMESPACE, PLAN_ID,
        TAXONOMY_PROJECTION_REMOTE_MANIFEST_CANDIDATE_FILE));
    const manifest = JSON.parse(manifestBytes.toString("utf8")) as TaxonomyProjectionRemoteManifestCandidate;
    const responses = new Map<string, { bytes: Buffer; contentType: string; cacheControl: string }>();
    responses.set(TAXONOMY_PROJECTION_PUBLIC_SHADOW_MANIFEST_KEY, {
        bytes: manifestBytes, contentType: "application/json", cacheControl: "no-store",
    });
    for (const object of manifest.inventory.objects) {
        responses.set(object.objectKey, {
            bytes: await readFile(join(k36Root, TAXONOMY_PROJECTION_DELIVERY_NAMESPACE, RELEASE_ID, object.sourceFileName)),
            contentType: object.kind === "payload" ? "application/gzip" : "application/json",
            cacheControl: object.cacheControl,
        });
    }
    const payload = responses.get(manifest.inventory.objects[0].objectKey)!.bytes;
    const firstRecord = JSON.parse(gunzipSync(payload).toString("utf8")).records[0];
    return { manifest, responses, firstRecord };
}

it("consumes the exact local K36/K37 fixture and keeps its report bounded and non-authoritative", async function () {
    const fixture = await localFixture();
    if (!fixture) { this.skip(); return; }
    const calls: string[] = [];
    (globalThis as any)[__taxonomyProjectionPublicShadowTestHook] = {
        async get(key: string) { calls.push(key); return fixture.responses.get(key)!; },
    };
    const shadow = await loadTaxonomyProjectionPublicShadow({
        optInK41: true, remoteReadOnly: true, checkedAt: CHECKED_AT,
    });
    const report: TaxonomyProjectionPublicShadowReport = shadow.report;
    strictEqual(calls.length, 5);
    deepStrictEqual(calls.slice(1), fixture.manifest.inventory.objects.map(object => object.objectKey));
    deepStrictEqual(shadow.lookup(fixture.firstRecord.cardId), fixture.firstRecord);
    const first = shadow.lookup(fixture.firstRecord.cardId)! as any;
    first.categories?.splice(0);
    deepStrictEqual(shadow.lookup(fixture.firstRecord.cardId), fixture.firstRecord);
    ok(Buffer.byteLength(JSON.stringify(report)) < 16 * 1024);
    deepStrictEqual(report.readiness, {
        publicDelivery: "GO", remoteShadowLookup: "GO", persistedConsumer: "NO-GO", characterArray: "NO-GO",
        applyOrOverlay: "NO-GO", android: "NO-GO", authority: "NO-GO", production: "NO-GO",
        fyiRemoval: "NO-GO", dokkanInfoRemoval: "NO-GO",
    });
});
});
