"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = require("crypto");
const assert_1 = require("assert");
const mocha_1 = require("mocha");
const publish_r2_verified_inventory_1 = require("./publish-r2-verified-inventory");
function sha(bytes) {
    return (0, crypto_1.createHash)("sha256").update(bytes).digest("hex");
}
class MemoryStore {
    supportsInventory = true;
    objects = new Map();
    calls = [];
    listTokens = [];
    pageSize = 1000;
    getHook;
    putHook;
    listHook;
    getCount = 0;
    putCount = 0;
    listCount = 0;
    set(key, bytes, etag = `"etag-${this.objects.size + 1}"`, metadata = {}) {
        const isManifest = key.endsWith("characters-manifest.json");
        const isDataset = key.endsWith("characters.json.gz");
        this.objects.set(key, {
            bytes: Buffer.from(bytes),
            etag,
            lastModified: metadata.lastModified ?? new Date((this.objects.size + 1) * 1000).toISOString(),
            contentType: metadata.contentType ?? (isManifest ? "application/json" : isDataset ? "application/gzip" : "image/png"),
            cacheControl: metadata.cacheControl ?? (isManifest ? "no-store" : "public, max-age=31536000, immutable"),
        });
    }
    async listPage(prefix, continuationToken) {
        this.listCount += 1;
        this.calls.push(`LIST ${prefix}`);
        this.listTokens.push(continuationToken);
        const hooked = await this.listHook?.(prefix, continuationToken, this.listCount);
        if (hooked instanceof Error)
            throw hooked;
        if (hooked)
            return hooked;
        const matching = Array.from(this.objects.entries())
            .filter(([key]) => key.startsWith(prefix))
            .sort(([left], [right]) => left.localeCompare(right));
        const offset = continuationToken ? Number(continuationToken) : 0;
        const page = matching.slice(offset, offset + this.pageSize);
        const next = offset + page.length;
        return {
            objects: page.map(([key, value]) => ({
                key,
                sizeBytes: value.bytes.byteLength,
                etag: value.etag,
                lastModified: value.lastModified,
            })),
            isTruncated: next < matching.length,
            nextContinuationToken: next < matching.length ? String(next) : undefined,
        };
    }
    async get(key) {
        this.getCount += 1;
        this.calls.push(`GET ${key}`);
        const hooked = await this.getHook?.(key, this.getCount);
        if (hooked instanceof Error)
            throw hooked;
        if (hooked !== undefined)
            return hooked;
        const value = this.objects.get(key);
        return value ? {
            bytes: Buffer.from(value.bytes),
            sizeBytes: value.bytes.byteLength,
            etag: value.etag,
            lastModified: value.lastModified,
            contentType: value.contentType,
            cacheControl: value.cacheControl,
        } : undefined;
    }
    async put(key, bytes, contentType, cacheControl, condition) {
        this.putCount += 1;
        this.calls.push(`PUT ${key}`);
        const hooked = await this.putHook?.(key, this.putCount);
        if (hooked instanceof Error)
            throw hooked;
        if (hooked)
            return hooked;
        const current = this.objects.get(key);
        if ("ifNoneMatch" in condition) {
            if (current)
                return "precondition-failed";
        }
        else if (!current || current.etag !== condition.ifMatch) {
            return "precondition-failed";
        }
        this.set(key, bytes, `"written-${this.putCount}"`, {
            lastModified: new Date((10000 + this.putCount) * 1000).toISOString(),
            contentType,
            cacheControl,
        });
        return "written";
    }
}
function laneRoot(channel, lane) {
    if (channel === "staging")
        return `staging/${lane}`;
    return lane === "v1" ? "" : "v2";
}
function portraitKey(index, bytes, channel = "production", lane = "v2") {
    const root = laneRoot(channel, lane);
    if (!root)
        return `images/v3/portrait_${index}.${sha(bytes)}.png`;
    return `${root}/images/v4/portrait_${index}.${sha(bytes)}.png`;
}
function makeFixture(portraitCount = 1, channel = "production", lane = "v2", portraitByteSize) {
    const store = new MemoryStore();
    const datasetBytes = Buffer.from(`dataset-${channel}-${lane}`);
    const root = laneRoot(channel, lane);
    const manifestKey = root ? `${root}/characters-manifest.json` : "characters-manifest.json";
    const datasetKey = root
        ? `${root}/releases/version/${sha(datasetBytes)}/characters.json.gz`
        : `releases/version/${sha(datasetBytes)}/characters.json.gz`;
    const manifest = {
        schemaVersion: 1,
        datasetVersion: "version",
        generatedAt: "2026-09-04T00:00:00.000Z",
        fileName: datasetKey,
        compression: "gzip",
        sha256: sha(datasetBytes),
        sizeBytes: datasetBytes.byteLength,
        uncompressedSizeBytes: 1,
        characterCount: 1,
    };
    const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
    store.set(manifestKey, manifestBytes, '"manifest-etag"');
    store.set(datasetKey, datasetBytes, '"dataset-etag"');
    const localLoads = { count: 0 };
    const portraits = Array.from({ length: portraitCount }, (_, index) => {
        const bytes = portraitByteSize === undefined
            ? Buffer.from(`portrait-${String(index).padStart(4, "0")}`)
            : Buffer.alloc(portraitByteSize, index % 251);
        const objectKey = portraitKey(index + 1, bytes, channel, lane);
        store.set(objectKey, bytes, `"portrait-etag-${index}"`);
        return {
            objectKey,
            filePath: `fixture/${index}.png`,
            sha256: sha(bytes),
            sizeBytes: bytes.byteLength,
            bytes,
            loadBytes: async () => {
                localLoads.count += 1;
                return Buffer.from(bytes);
            },
        };
    });
    const receipts = Object.fromEntries(portraits.map(entry => {
        const stored = store.objects.get(entry.objectKey);
        return [entry.objectKey, {
                key: entry.objectKey,
                sha256: entry.sha256,
                sizeBytes: entry.sizeBytes,
                etag: stored.etag,
                lastModified: stored.lastModified,
                contentType: stored.contentType,
                cacheControl: stored.cacheControl,
                verificationMethod: "full-get-sha256",
            }];
    }));
    const state = {
        schemaVersion: 2,
        bucket: "fixture-bucket",
        target: "remote",
        channel,
        contractLane: lane,
        manifestObjectKey: manifestKey,
        manifestSha256: sha(manifestBytes),
        datasetVersion: manifest.datasetVersion,
        datasetObjectKey: datasetKey,
        datasetSha256: manifest.sha256,
        datasetSizeBytes: datasetBytes.byteLength,
        portraitInventorySha256: (0, publish_r2_verified_inventory_1.portraitInventorySha256)(Object.values(receipts).map(receipt => ({
            key: receipt.key,
            sizeBytes: receipt.sizeBytes,
            etag: receipt.etag,
            lastModified: receipt.lastModified,
        }))),
        verifiedAt: "2026-09-04T00:00:00.000Z",
        portraits: receipts,
    };
    const input = {
        bucket: "fixture-bucket",
        target: "remote",
        channel,
        contractLane: lane,
        manifestObjectKey: manifestKey,
        candidateManifest: manifest,
        candidateManifestBytes: manifestBytes,
        datasetObjectKey: datasetKey,
        datasetBytes,
        portraits,
        previousState: state,
        expectedRemoteBaselineSha256: manifest.sha256,
        expectRemoteManifestAbsent: false,
        skipRemoteManifestCheck: false,
        skipPortraits: false,
        fullAudit: false,
        dryRun: true,
        verificationOnly: false,
        promoteProduction: channel === "production",
        concurrency: 6,
        retryPolicy: { delaysMs: [0, 0], maxBackoffMs: 0, jitter: () => 0, sleep: async () => undefined },
        now: () => "2026-09-04T01:00:00.000Z",
    };
    return { input, store, portraits, localLoads, state, manifestKey, datasetKey, manifestBytes };
}
function changedCandidate(fixture) {
    const datasetBytes = Buffer.from("new-dataset-payload");
    const root = laneRoot(fixture.input.channel, fixture.input.contractLane);
    const datasetKey = root
        ? `${root}/releases/new-version/${sha(datasetBytes)}/characters.json.gz`
        : `releases/new-version/${sha(datasetBytes)}/characters.json.gz`;
    const manifest = {
        ...fixture.input.candidateManifest,
        datasetVersion: "new-version",
        fileName: datasetKey,
        sha256: sha(datasetBytes),
        sizeBytes: datasetBytes.byteLength,
    };
    fixture.datasetKey = datasetKey;
    fixture.manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
    fixture.input = {
        ...fixture.input,
        candidateManifest: manifest,
        candidateManifestBytes: fixture.manifestBytes,
        datasetObjectKey: datasetKey,
        datasetBytes,
    };
}
function enableReceiptBootstrap(fixture) {
    fixture.input.fullAudit = true;
    fixture.input.dryRun = false;
    fixture.input.verificationOnly = true;
    fixture.input.promoteProduction = false;
}
function terminalPlan(error) {
    return error.plan;
}
function containsBuffer(value, seen = new Set()) {
    if (Buffer.isBuffer(value))
        return true;
    if (!value || typeof value !== "object" || seen.has(value))
        return false;
    seen.add(value);
    return Object.values(value).some(entry => containsBuffer(entry, seen));
}
(0, mocha_1.describe)("OPT-R2-01 verified portrait inventory", function () {
    this.timeout(30000);
    (0, mocha_1.it)("excludes LastModified timestamps from the deterministic semantic inventory digest", () => {
        const stable = { key: "v2/images/v4/portrait_1.png", sizeBytes: 123, etag: '"opaque"' };
        const first = (0, publish_r2_verified_inventory_1.portraitInventorySha256)([{ ...stable, lastModified: "2026-09-04T00:00:00.000Z" }]);
        const second = (0, publish_r2_verified_inventory_1.portraitInventorySha256)([{ ...stable, lastModified: "2026-09-04T23:59:59.000Z" }]);
        (0, assert_1.equal)(first, second);
    });
    (0, mocha_1.it)("reuses all 3,303 schema-2 portraits with four LIST pages, no portrait body GET and no PUT", async () => {
        const fixture = makeFixture(3303);
        const result = await (0, publish_r2_verified_inventory_1.executeVerifiedCharacterPublication)(fixture.input, fixture.store);
        (0, assert_1.equal)(result.plan.portraitReuseCount, 3303);
        (0, assert_1.equal)(result.plan.portraitFullGetCount, 0);
        (0, assert_1.equal)(result.plan.portraitUploadCount, 0);
        (0, assert_1.equal)(result.plan.telemetry.list, 4);
        (0, assert_1.equal)(result.plan.telemetry.get, 2);
        (0, assert_1.equal)(result.plan.telemetry.put, 0);
        (0, assert_1.equal)(result.plan.telemetry.head, 0);
        (0, assert_1.equal)(fixture.localLoads.count, 0);
        (0, assert_1.deepEqual)(fixture.store.listTokens, [undefined, "1000", "2000", "3000"]);
    });
    (0, mocha_1.it)("uploads one missing portrait create-only and records a complete post-upload proof", async () => {
        const fixture = makeFixture();
        fixture.store.objects.delete(fixture.portraits[0].objectKey);
        fixture.input.dryRun = false;
        let writtenState;
        fixture.input.writeState = async (state) => { writtenState = state; };
        const result = await (0, publish_r2_verified_inventory_1.executeVerifiedCharacterPublication)(fixture.input, fixture.store);
        (0, assert_1.equal)(result.plan.portraitUploadCount, 1);
        (0, assert_1.equal)(result.plan.telemetry.put, 1);
        (0, assert_1.equal)(writtenState?.portraits[fixture.portraits[0].objectKey].verificationMethod, "post-upload-sha256");
        (0, assert_1.equal)(writtenState?.portraits[fixture.portraits[0].objectKey].contentType, "image/png");
        (0, assert_1.equal)(writtenState?.portraits[fixture.portraits[0].objectKey].cacheControl, "public, max-age=31536000, immutable");
        (0, assert_1.equal)(typeof writtenState?.portraits[fixture.portraits[0].objectKey].lastModified, "string");
        (0, assert_1.equal)(fixture.localLoads.count, 1);
        (0, assert_1.equal)(fixture.store.objects.get(fixture.portraits[0].objectKey)?.bytes.equals(fixture.portraits[0].bytes), true);
    });
    (0, mocha_1.it)("renews a receipt with one full GET when an opaque ETag changes but bytes match", async () => {
        const fixture = makeFixture();
        fixture.store.objects.get(fixture.portraits[0].objectKey).etag = '"replacement-version"';
        fixture.input.dryRun = false;
        let writtenState;
        fixture.input.writeState = async (state) => { writtenState = state; };
        const result = await (0, publish_r2_verified_inventory_1.executeVerifiedCharacterPublication)(fixture.input, fixture.store);
        (0, assert_1.equal)(result.plan.portraitFullGetCount, 1);
        (0, assert_1.equal)(result.plan.portraitReuseCount, 1);
        (0, assert_1.equal)(result.plan.portraitUploadCount, 0);
        (0, assert_1.equal)(result.plan.decisions[0].decision, "reuse-full-get");
        (0, assert_1.equal)(writtenState?.portraits[fixture.portraits[0].objectKey].etag, '"replacement-version"');
        (0, assert_1.equal)(writtenState?.portraits[fixture.portraits[0].objectKey].verificationMethod, "full-get-sha256");
    });
    (0, mocha_1.it)("does not fast-reuse after LastModified drift and renews verified metadata by full GET", async () => {
        const fixture = makeFixture();
        const stored = fixture.store.objects.get(fixture.portraits[0].objectKey);
        stored.lastModified = "2026-09-04T02:00:00.000Z";
        fixture.input.dryRun = false;
        let writtenState;
        fixture.input.writeState = async (state) => { writtenState = state; };
        const result = await (0, publish_r2_verified_inventory_1.executeVerifiedCharacterPublication)(fixture.input, fixture.store);
        (0, assert_1.equal)(result.plan.portraitFullGetCount, 1);
        (0, assert_1.equal)(result.plan.decisions[0].decision, "reuse-full-get");
        (0, assert_1.equal)(writtenState?.portraits[fixture.portraits[0].objectKey].lastModified, stored.lastModified);
        (0, assert_1.equal)(fixture.localLoads.count, 0);
    });
    (0, mocha_1.it)("treats GET and LIST LastModified values within the same second as the same witness", async () => {
        const fixture = makeFixture();
        const key = fixture.portraits[0].objectKey;
        const timestamp = new Date(fixture.state.portraits[key].lastModified);
        timestamp.setUTCMilliseconds(567);
        fixture.store.objects.get(key).lastModified = timestamp.toISOString();
        const result = await (0, publish_r2_verified_inventory_1.executeVerifiedCharacterPublication)(fixture.input, fixture.store);
        (0, assert_1.equal)(result.plan.portraitReuseCount, 1);
        (0, assert_1.equal)(result.plan.portraitFullGetCount, 0);
        (0, assert_1.equal)(result.plan.decisions[0].decision, "reuse-receipt");
    });
    (0, mocha_1.it)("treats Content-Type or Cache-Control drift as a fatal immutable conflict", async () => {
        for (const field of ["contentType", "cacheControl"]) {
            const fixture = makeFixture();
            const stored = fixture.store.objects.get(fixture.portraits[0].objectKey);
            stored.lastModified = "2026-09-04T02:00:00.000Z";
            stored[field] = field === "contentType" ? "application/octet-stream" : "no-store";
            let error;
            try {
                await (0, publish_r2_verified_inventory_1.executeVerifiedCharacterPublication)(fixture.input, fixture.store);
            }
            catch (caught) {
                error = caught;
            }
            (0, assert_1.equal)(terminalPlan(error).portraitConflictCount, 1);
            (0, assert_1.equal)(terminalPlan(error).portraitFullGetCount, 1);
            (0, assert_1.equal)(fixture.store.calls.some(call => call.startsWith("PUT ")), false);
        }
    });
    (0, mocha_1.it)("fails before writes when changed ETag bytes conflict", async () => {
        const fixture = makeFixture();
        fixture.store.set(fixture.portraits[0].objectKey, Buffer.from("different-remote"), '"replacement-version"');
        let error;
        try {
            await (0, publish_r2_verified_inventory_1.executeVerifiedCharacterPublication)(fixture.input, fixture.store);
        }
        catch (caught) {
            error = caught;
        }
        (0, assert_1.equal)(terminalPlan(error).portraitConflictCount, 1);
        (0, assert_1.equal)(terminalPlan(error).telemetry.put, 0);
    });
    (0, mocha_1.it)("does not reuse when size changes even if the opaque ETag is unchanged", async () => {
        const fixture = makeFixture();
        const stored = fixture.store.objects.get(fixture.portraits[0].objectKey);
        fixture.store.set(fixture.portraits[0].objectKey, Buffer.concat([stored.bytes, Buffer.from("x")]), stored.etag);
        let error;
        try {
            await (0, publish_r2_verified_inventory_1.executeVerifiedCharacterPublication)(fixture.input, fixture.store);
        }
        catch (caught) {
            error = caught;
        }
        (0, assert_1.equal)(terminalPlan(error).portraitFullGetCount, 1);
        (0, assert_1.equal)(terminalPlan(error).portraitConflictCount, 1);
        (0, assert_1.equal)(terminalPlan(error).telemetry.put, 0);
    });
    (0, mocha_1.it)("denies fast reuse for missing, malformed, cross-bucket, cross-channel and cross-lane state", async () => {
        const metadataIncomplete = JSON.parse(JSON.stringify(makeFixture().state));
        delete metadataIncomplete.portraits[Object.keys(metadataIncomplete.portraits)[0]].lastModified;
        const variants = [
            undefined,
            { schemaVersion: 2, portraits: "invalid" },
            { ...makeFixture().state, bucket: "other" },
            { ...makeFixture().state, target: "local" },
            { ...makeFixture().state, channel: "staging" },
            { ...makeFixture().state, contractLane: "v1" },
            { ...makeFixture().state, portraitInventorySha256: "0".repeat(64) },
            metadataIncomplete,
        ];
        for (const previousState of variants) {
            const fixture = makeFixture();
            fixture.input.previousState = previousState;
            const result = await (0, publish_r2_verified_inventory_1.executeVerifiedCharacterPublication)(fixture.input, fixture.store);
            (0, assert_1.equal)(result.plan.stateTrust, "untrusted");
            (0, assert_1.equal)(result.plan.portraitFullGetCount, 1);
            (0, assert_1.equal)(result.plan.portraitReuseCount, 1);
        }
    });
    (0, mocha_1.it)("requires explicit full audit to bootstrap readable schema 1 state", async () => {
        const fixture = makeFixture();
        fixture.input.previousState = {
            schemaVersion: 1,
            bucket: fixture.input.bucket,
            target: "remote",
            datasetVersion: "version",
            datasetObjectKey: fixture.datasetKey,
            manifestSha256: fixture.input.candidateManifest.sha256,
            publishedAt: "2026-09-04T00:00:00.000Z",
            portraits: { [fixture.portraits[0].objectKey]: fixture.portraits[0].sha256 },
        };
        await (0, assert_1.rejects)((0, publish_r2_verified_inventory_1.executeVerifiedCharacterPublication)(fixture.input, fixture.store), /schema 1 requires an explicit --full-audit/);
        fixture.input.fullAudit = true;
        const result = await (0, publish_r2_verified_inventory_1.executeVerifiedCharacterPublication)(fixture.input, fixture.store);
        (0, assert_1.equal)(result.plan.stateTrust, "full-audit");
        (0, assert_1.equal)(result.plan.portraitFullGetCount, 1);
    });
    (0, mocha_1.it)("fails a stale initial baseline with zero writes", async () => {
        const fixture = makeFixture();
        fixture.input.expectedRemoteBaselineSha256 = "f".repeat(64);
        await (0, assert_1.rejects)((0, publish_r2_verified_inventory_1.executeVerifiedCharacterPublication)(fixture.input, fixture.store), /baseline changed/);
        (0, assert_1.equal)(fixture.store.calls.some(call => call.startsWith("PUT ")), false);
    });
    (0, mocha_1.it)("detects a baseline race before manifest promotion and leaves the manifest unchanged", async () => {
        const fixture = makeFixture();
        const originalManifest = Buffer.from(fixture.manifestBytes);
        changedCandidate(fixture);
        fixture.store.set(fixture.datasetKey, fixture.input.datasetBytes, '"new-dataset"');
        fixture.input.dryRun = false;
        let manifestReads = 0;
        fixture.store.getHook = key => {
            if (key !== fixture.manifestKey)
                return;
            manifestReads += 1;
            if (manifestReads === 3) {
                const raced = Buffer.from(JSON.stringify({ ...JSON.parse(originalManifest.toString()), generatedAt: "raced" }));
                return {
                    bytes: raced,
                    sizeBytes: raced.byteLength,
                    etag: '"raced"',
                    lastModified: "2026-09-04T00:00:03.000Z",
                    contentType: "application/json",
                    cacheControl: "no-store",
                };
            }
        };
        await (0, assert_1.rejects)((0, publish_r2_verified_inventory_1.executeVerifiedCharacterPublication)(fixture.input, fixture.store), /baseline raced before manifest promotion/);
        (0, assert_1.equal)(fixture.store.calls.includes(`PUT ${fixture.manifestKey}`), false);
        (0, assert_1.equal)(fixture.store.objects.get(fixture.manifestKey)?.bytes.equals(originalManifest), true);
    });
    (0, mocha_1.it)("uses bounded injectable backoff for 429, 5xx and terminal network failures", async () => {
        const telemetry = { list: 0, head: 0, get: 0, put: 0, retries: 0, bytesRead: 0, bytesPutAttempted: 0, reasons: {} };
        const sleeps = [];
        const policy = { delaysMs: [10, 20], maxBackoffMs: 25, jitter: () => 0.5, sleep: async (ms) => { sleeps.push(ms); } };
        let calls = 0;
        (0, assert_1.equal)(await (0, publish_r2_verified_inventory_1.withBoundedR2Retry)(async () => {
            calls += 1;
            if (calls === 1)
                throw Object.assign(new Error("rate"), { $metadata: { httpStatusCode: 429 } });
            if (calls === 2)
                throw Object.assign(new Error("server"), { $metadata: { httpStatusCode: 503 } });
            return "ok";
        }, telemetry, policy), "ok");
        (0, assert_1.deepEqual)(sleeps, [15, 25]);
        (0, assert_1.equal)(telemetry.retries, 2);
        (0, assert_1.equal)(telemetry.reasons["RETRY:http-429"], 1);
        (0, assert_1.equal)(telemetry.reasons["RETRY:http-5xx"], 1);
        for (const failure of [
            Object.assign(new Error("429"), { $metadata: { httpStatusCode: 429 } }),
            Object.assign(new Error("503"), { $metadata: { httpStatusCode: 503 } }),
            Object.assign(new Error("ECONNRESET"), { code: "ECONNRESET" }),
        ]) {
            calls = 0;
            await (0, assert_1.rejects)((0, publish_r2_verified_inventory_1.withBoundedR2Retry)(async () => {
                calls += 1;
                throw failure;
            }, telemetry, policy));
            (0, assert_1.equal)(calls, 3);
        }
        (0, assert_1.equal)(telemetry.reasons["RETRY:network-transient"], 2);
        const advisoryTelemetry = { list: 0, head: 0, get: 0, put: 0, retries: 0, bytesRead: 0, bytesPutAttempted: 0, reasons: {} };
        let advisoryCalls = 0;
        (0, assert_1.equal)(await (0, publish_r2_verified_inventory_1.withBoundedR2Retry)(async () => {
            advisoryCalls += 1;
            if (advisoryCalls === 1) {
                throw new Error("Please look at https://www.cloudflarestatus.com for issues or contact customer support.");
            }
            return "ok";
        }, advisoryTelemetry, policy), "ok");
        (0, assert_1.equal)(advisoryCalls, 2);
        (0, assert_1.equal)(advisoryTelemetry.retries, 1);
        (0, assert_1.equal)(advisoryTelemetry.reasons["RETRY:network-transient"], 1);
    });
    (0, mocha_1.it)("preserves the object key and operation when a GET failure exhausts retries", async () => {
        const fixture = makeFixture();
        fixture.input.fullAudit = true;
        fixture.store.getHook = key => key === fixture.portraits[0].objectKey
            ? new Error("Please look at https://www.cloudflarestatus.com for issues or contact customer support.")
            : undefined;
        await (0, assert_1.rejects)((0, publish_r2_verified_inventory_1.executeVerifiedCharacterPublication)(fixture.input, fixture.store), new RegExp(`R2 GET failed for ${fixture.portraits[0].objectKey.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\(portrait-full-audit\\): Please look`));
    });
    (0, mocha_1.it)("aborts each unresolved attempt with an injected timeout and preserves the retry ceiling", async () => {
        const telemetry = { list: 0, head: 0, get: 0, put: 0, retries: 0, bytesRead: 0, bytesPutAttempted: 0, reasons: {} };
        const signals = [];
        let attempts = 0;
        const policy = {
            delaysMs: [0, 0],
            maxBackoffMs: 0,
            jitter: () => 0,
            sleep: async () => undefined,
            attemptTimeoutMs: 10,
            setTimer: callback => {
                queueMicrotask(callback);
                return attempts;
            },
            clearTimer: () => undefined,
        };
        await (0, assert_1.rejects)((0, publish_r2_verified_inventory_1.withBoundedR2Retry)(async (signal) => {
            attempts += 1;
            signals.push(signal);
            return new Promise(() => undefined);
        }, telemetry, policy), /timed out/);
        (0, assert_1.equal)(attempts, 3);
        (0, assert_1.equal)(telemetry.retries, 2);
        (0, assert_1.equal)(telemetry.reasons["RETRY:timeout"], 2);
        (0, assert_1.equal)(signals.every(signal => signal.aborted), true);
        await (0, assert_1.rejects)((0, publish_r2_verified_inventory_1.withBoundedR2Retry)(async () => "never", telemetry, {
            ...policy,
            delaysMs: [0, 0, 0, 0, 0, 0],
        }), /safety ceiling/);
    });
    (0, mocha_1.it)("rejects oversized, invalid-length and overrun remote streams before buffering beyond limits", async () => {
        async function* chunks(...sizes) {
            for (const size of sizes)
                yield Buffer.alloc(size);
        }
        await (0, assert_1.rejects)((0, publish_r2_verified_inventory_1.readBoundedS3Body)(chunks(5), 5, 4), /ContentLength exceeds/);
        await (0, assert_1.rejects)((0, publish_r2_verified_inventory_1.readBoundedS3Body)(chunks(1), Number.NaN, 4), /ContentLength is missing or invalid/);
        await (0, assert_1.rejects)((0, publish_r2_verified_inventory_1.readBoundedS3Body)(chunks(3, 3), 5, 5), /stream exceeded/);
        await (0, assert_1.rejects)((0, publish_r2_verified_inventory_1.readBoundedS3Body)(chunks(6), 5, 5), /stream exceeded/);
        await (0, assert_1.rejects)((0, publish_r2_verified_inventory_1.readBoundedS3Body)(chunks(5), 5, 8, 4), /ContentLength exceeds/);
    });
    (0, mocha_1.it)("enforces central publication and baseline authorization inside the exported executor before I/O", async () => {
        for (const [mutation, message] of [
            [(input) => { input.skipRemoteManifestCheck = true; }, /baseline manifest check/],
            [(input) => { input.expectedRemoteBaselineSha256 = undefined; }, /exactly one baseline pin/],
            [(input) => { input.expectRemoteManifestAbsent = true; }, /exactly one baseline pin/],
            [(input) => { input.promoteProduction = false; }, /--promote-production/],
        ]) {
            const fixture = makeFixture();
            fixture.input.dryRun = false;
            mutation(fixture.input);
            await (0, assert_1.rejects)((0, publish_r2_verified_inventory_1.executeVerifiedCharacterPublication)(fixture.input, fixture.store), message);
            (0, assert_1.deepEqual)(fixture.store.calls, []);
        }
        const staging = makeFixture(1, "staging", "v2");
        staging.input.dryRun = false;
        staging.input.promoteProduction = true;
        await (0, assert_1.rejects)((0, publish_r2_verified_inventory_1.executeVerifiedCharacterPublication)(staging.input, staging.store), /--promote-production cannot be combined with the staging channel/);
        (0, assert_1.deepEqual)(staging.store.calls, []);
    });
    (0, mocha_1.it)("rejects candidate manifest bytes that diverge from the bound object before I/O", async () => {
        const fixture = makeFixture();
        fixture.input.candidateManifestBytes = Buffer.from(`${JSON.stringify({
            ...fixture.input.candidateManifest,
            datasetVersion: "different",
        })}\n`);
        await (0, assert_1.rejects)((0, publish_r2_verified_inventory_1.executeVerifiedCharacterPublication)(fixture.input, fixture.store), /manifest bytes do not match/);
        (0, assert_1.deepEqual)(fixture.store.calls, []);
    });
    (0, mocha_1.it)("rejects non-canonical manifest and payload keys before I/O", async () => {
        for (const mutation of [
            (input) => { input.manifestObjectKey = "characters-manifest.json"; },
            (input) => { input.datasetObjectKey = "releases/cross-lane/characters.json.gz"; },
            (input) => {
                input.datasetObjectKey = `v2/releases/arbitrary/${input.candidateManifest.sha256}/characters.json.gz`;
                input.candidateManifest = { ...input.candidateManifest, fileName: input.datasetObjectKey };
                input.candidateManifestBytes = Buffer.from(`${JSON.stringify(input.candidateManifest, null, 2)}\n`);
            },
        ]) {
            const fixture = makeFixture();
            mutation(fixture.input);
            await (0, assert_1.rejects)((0, publish_r2_verified_inventory_1.executeVerifiedCharacterPublication)(fixture.input, fixture.store), /not canonical/);
            (0, assert_1.deepEqual)(fixture.store.calls, []);
        }
    });
    (0, mocha_1.it)("bootstraps one local schema-2 receipt after an exact remote full audit with zero PUTs", async () => {
        const fixture = makeFixture(7);
        enableReceiptBootstrap(fixture);
        let writtenState;
        let stateWrites = 0;
        fixture.input.writeState = async (state) => {
            stateWrites += 1;
            writtenState = state;
        };
        const result = await (0, publish_r2_verified_inventory_1.executeVerifiedCharacterPublication)(fixture.input, fixture.store);
        (0, assert_1.equal)(result.plan.portraitFullGetCount, 7);
        (0, assert_1.equal)(result.plan.portraitReuseCount, 7);
        (0, assert_1.equal)(result.plan.datasetUploadCount, 0);
        (0, assert_1.equal)(result.plan.portraitUploadCount, 0);
        (0, assert_1.equal)(result.plan.manifestUploadCount, 0);
        (0, assert_1.equal)(result.plan.telemetry.put, 0);
        (0, assert_1.equal)(fixture.store.calls.some(call => call.startsWith("PUT ")), false);
        (0, assert_1.equal)(fixture.store.calls.filter(call => call === `GET ${fixture.manifestKey}`).length, 2);
        (0, assert_1.equal)(stateWrites, 1);
        (0, assert_1.equal)(writtenState?.schemaVersion, 2);
    });
    (0, mocha_1.it)("refuses receipt bootstrap when a portrait is missing, without PUT or state", async () => {
        const fixture = makeFixture(3);
        enableReceiptBootstrap(fixture);
        fixture.store.objects.delete(fixture.portraits[1].objectKey);
        let stateWrites = 0;
        fixture.input.writeState = async () => { stateWrites += 1; };
        let error;
        try {
            await (0, publish_r2_verified_inventory_1.executeVerifiedCharacterPublication)(fixture.input, fixture.store);
        }
        catch (caught) {
            error = caught;
        }
        (0, assert_1.equal)(terminalPlan(error).portraitUploadCount, 1);
        (0, assert_1.equal)(terminalPlan(error).telemetry.put, 0);
        (0, assert_1.equal)(fixture.store.calls.some(call => call.startsWith("PUT ")), false);
        (0, assert_1.equal)(stateWrites, 0);
    });
    (0, mocha_1.it)("refuses receipt bootstrap for missing or divergent payload/manifest without mutation", async () => {
        const fixtures = [];
        const missingPayload = makeFixture();
        enableReceiptBootstrap(missingPayload);
        missingPayload.store.objects.delete(missingPayload.datasetKey);
        fixtures.push(missingPayload);
        const divergentPayload = makeFixture();
        enableReceiptBootstrap(divergentPayload);
        divergentPayload.store.objects.get(divergentPayload.datasetKey).bytes = Buffer.alloc(divergentPayload.input.datasetBytes.byteLength, 1);
        fixtures.push(divergentPayload);
        const divergentManifest = makeFixture();
        enableReceiptBootstrap(divergentManifest);
        changedCandidate(divergentManifest);
        divergentManifest.store.set(divergentManifest.datasetKey, divergentManifest.input.datasetBytes, '"new-dataset"');
        fixtures.push(divergentManifest);
        const missingManifest = makeFixture();
        enableReceiptBootstrap(missingManifest);
        missingManifest.store.objects.delete(missingManifest.manifestKey);
        missingManifest.input.expectedRemoteBaselineSha256 = undefined;
        missingManifest.input.expectRemoteManifestAbsent = true;
        fixtures.push(missingManifest);
        for (const fixture of fixtures) {
            let stateWrites = 0;
            fixture.input.writeState = async () => { stateWrites += 1; };
            await (0, assert_1.rejects)((0, publish_r2_verified_inventory_1.executeVerifiedCharacterPublication)(fixture.input, fixture.store));
            (0, assert_1.equal)(fixture.store.calls.some(call => call.startsWith("PUT ")), false);
            (0, assert_1.equal)(stateWrites, 0);
        }
    });
    (0, mocha_1.it)("aborts receipt bootstrap when the final baseline observation changes", async () => {
        const fixture = makeFixture(4);
        enableReceiptBootstrap(fixture);
        const original = fixture.store.objects.get(fixture.manifestKey);
        let manifestReads = 0;
        fixture.store.getHook = key => {
            if (key !== fixture.manifestKey)
                return;
            manifestReads += 1;
            if (manifestReads !== 2)
                return;
            const raced = Buffer.from(JSON.stringify({
                ...JSON.parse(original.bytes.toString("utf8")),
                generatedAt: "2026-09-04T02:00:00.000Z",
            }));
            return {
                bytes: raced,
                sizeBytes: raced.byteLength,
                etag: '"raced-bootstrap-baseline"',
                lastModified: "2026-09-04T02:00:00.000Z",
                contentType: "application/json",
                cacheControl: "no-store",
            };
        };
        let stateWrites = 0;
        fixture.input.writeState = async () => { stateWrites += 1; };
        await (0, assert_1.rejects)((0, publish_r2_verified_inventory_1.executeVerifiedCharacterPublication)(fixture.input, fixture.store), /baseline raced before receipt bootstrap/);
        (0, assert_1.equal)(fixture.store.calls.some(call => call.startsWith("PUT ")), false);
        (0, assert_1.equal)(stateWrites, 0);
    });
    (0, mocha_1.it)("rejects invalid receipt-bootstrap combinations before store I/O", async () => {
        const mutations = [
            input => { input.fullAudit = false; },
            input => { input.target = "local"; },
            input => { input.dryRun = true; },
            input => { input.skipRemoteManifestCheck = true; },
            input => { input.promoteProduction = true; },
            input => { input.expectedRemoteBaselineSha256 = undefined; },
            input => { input.expectRemoteManifestAbsent = true; },
        ];
        for (const mutation of mutations) {
            const fixture = makeFixture();
            enableReceiptBootstrap(fixture);
            mutation(fixture.input);
            await (0, assert_1.rejects)((0, publish_r2_verified_inventory_1.executeVerifiedCharacterPublication)(fixture.input, fixture.store));
            (0, assert_1.deepEqual)(fixture.store.calls, []);
        }
    });
    (0, mocha_1.it)("keeps dry-run mutation-free and produces a deterministic plan summary", async () => {
        const first = makeFixture(3);
        first.store.objects.delete(first.portraits[2].objectKey);
        let stateWrites = 0;
        first.input.writeState = async () => { stateWrites += 1; };
        const firstResult = await (0, publish_r2_verified_inventory_1.executeVerifiedCharacterPublication)(first.input, first.store);
        const second = makeFixture(3);
        second.store.objects.delete(second.portraits[2].objectKey);
        const secondResult = await (0, publish_r2_verified_inventory_1.executeVerifiedCharacterPublication)(second.input, second.store);
        (0, assert_1.deepEqual)(firstResult.plan, secondResult.plan);
        (0, assert_1.equal)(first.store.calls.some(call => call.startsWith("PUT ")), false);
        (0, assert_1.equal)(stateWrites, 0);
    });
    (0, mocha_1.it)("does not promote a manifest or write a receipt after portrait readback failure", async () => {
        const fixture = makeFixture();
        changedCandidate(fixture);
        fixture.store.set(fixture.datasetKey, fixture.input.datasetBytes, '"new-dataset"');
        fixture.store.objects.delete(fixture.portraits[0].objectKey);
        fixture.input.dryRun = false;
        let stateWrites = 0;
        fixture.input.writeState = async () => { stateWrites += 1; };
        fixture.store.getHook = key => {
            if (key === fixture.portraits[0].objectKey && fixture.store.calls.includes(`PUT ${key}`)) {
                const corrupt = Buffer.from("corrupt-readback");
                return {
                    bytes: corrupt,
                    sizeBytes: corrupt.byteLength,
                    etag: '"corrupt"',
                    lastModified: "2026-09-04T00:00:03.000Z",
                    contentType: "image/png",
                    cacheControl: "public, max-age=31536000, immutable",
                };
            }
        };
        await (0, assert_1.rejects)((0, publish_r2_verified_inventory_1.executeVerifiedCharacterPublication)(fixture.input, fixture.store), /Uploaded portrait.*readback/);
        (0, assert_1.equal)(fixture.store.calls.includes(`PUT ${fixture.manifestKey}`), false);
        (0, assert_1.equal)(stateWrites, 0);
    });
    (0, mocha_1.it)("rejects post-upload portrait metadata drift before manifest or receipt", async () => {
        const fixture = makeFixture();
        fixture.store.objects.delete(fixture.portraits[0].objectKey);
        fixture.input.dryRun = false;
        let stateWrites = 0;
        fixture.input.writeState = async () => { stateWrites += 1; };
        fixture.store.getHook = key => {
            if (key !== fixture.portraits[0].objectKey || !fixture.store.calls.includes(`PUT ${key}`))
                return;
            const bytes = fixture.portraits[0].bytes;
            return {
                bytes,
                sizeBytes: bytes.byteLength,
                etag: '"metadata-drift"',
                lastModified: "2026-09-04T00:00:03.000Z",
                contentType: "application/octet-stream",
                cacheControl: "public, max-age=31536000, immutable",
            };
        };
        await (0, assert_1.rejects)((0, publish_r2_verified_inventory_1.executeVerifiedCharacterPublication)(fixture.input, fixture.store), /Uploaded portrait.*metadata readback/);
        (0, assert_1.equal)(fixture.store.calls.includes(`PUT ${fixture.manifestKey}`), false);
        (0, assert_1.equal)(stateWrites, 0);
    });
    (0, mocha_1.it)("does not promote the manifest when immutable payload readback fails", async () => {
        const fixture = makeFixture();
        changedCandidate(fixture);
        fixture.input.dryRun = false;
        fixture.store.getHook = key => {
            if (key === fixture.datasetKey && fixture.store.calls.includes(`PUT ${key}`)) {
                const corrupt = Buffer.from("corrupt-payload");
                return {
                    bytes: corrupt,
                    sizeBytes: corrupt.byteLength,
                    etag: '"corrupt"',
                    lastModified: "2026-09-04T00:00:03.000Z",
                    contentType: "application/gzip",
                    cacheControl: "public, max-age=31536000, immutable",
                };
            }
        };
        await (0, assert_1.rejects)((0, publish_r2_verified_inventory_1.executeVerifiedCharacterPublication)(fixture.input, fixture.store), /Uploaded Character payload.*readback/);
        (0, assert_1.equal)(fixture.store.calls.includes(`PUT ${fixture.manifestKey}`), false);
    });
    (0, mocha_1.it)("writes immutable objects create-only, promotes manifest last, then compares exact manifest bytes", async () => {
        const fixture = makeFixture();
        changedCandidate(fixture);
        fixture.store.objects.delete(fixture.portraits[0].objectKey);
        fixture.input.dryRun = false;
        let stateWrites = 0;
        fixture.input.writeState = async () => { stateWrites += 1; };
        const result = await (0, publish_r2_verified_inventory_1.executeVerifiedCharacterPublication)(fixture.input, fixture.store);
        const puts = fixture.store.calls.filter(call => call.startsWith("PUT "));
        (0, assert_1.deepEqual)(puts, [`PUT ${fixture.datasetKey}`, `PUT ${fixture.portraits[0].objectKey}`, `PUT ${fixture.manifestKey}`]);
        (0, assert_1.equal)(fixture.store.calls[fixture.store.calls.length - 1], `GET ${fixture.manifestKey}`);
        (0, assert_1.equal)(fixture.store.objects.get(fixture.manifestKey)?.bytes.equals(fixture.manifestBytes), true);
        (0, assert_1.equal)(result.state?.schemaVersion, 2);
        (0, assert_1.equal)(stateWrites, 1);
    });
    (0, mocha_1.it)("keeps inventory and receipt reuse isolated across all four channel/lane combinations", async () => {
        const combinations = [
            ["production", "v1", "images/v3/"],
            ["production", "v2", "v2/images/"],
            ["staging", "v1", "staging/v1/images/"],
            ["staging", "v2", "staging/v2/images/"],
        ];
        for (const [channel, lane, prefix] of combinations) {
            const fixture = makeFixture(1, channel, lane);
            const result = await (0, publish_r2_verified_inventory_1.executeVerifiedCharacterPublication)(fixture.input, fixture.store);
            (0, assert_1.equal)(result.plan.portraitReuseCount, 1);
            (0, assert_1.equal)(result.plan.portraitFullGetCount, 0);
            (0, assert_1.equal)(fixture.store.calls.includes(`LIST ${prefix}`), true);
        }
    });
    (0, mocha_1.it)("limits concurrent portrait full GETs while preserving deterministic decision order", async () => {
        const fixture = makeFixture(24, "production", "v2", 262144);
        fixture.input.fullAudit = true;
        fixture.input.concurrency = 3;
        let active = 0;
        let maximum = 0;
        fixture.store.getHook = async (key) => {
            if (!key.includes("/images/"))
                return;
            const stored = fixture.store.objects.get(key);
            active += 1;
            maximum = Math.max(maximum, active);
            const index = Number.parseInt(key.match(/portrait_(\d+)/)?.[1] ?? "0", 10);
            await new Promise(resolveDelay => setTimeout(resolveDelay, (index % 3) + 1));
            return {
                bytes: Buffer.from(stored.bytes),
                sizeBytes: stored.bytes.byteLength,
                etag: stored.etag,
                lastModified: stored.lastModified,
                contentType: stored.contentType,
                cacheControl: stored.cacheControl,
                release: () => { active -= 1; },
            };
        };
        const result = await (0, publish_r2_verified_inventory_1.executeVerifiedCharacterPublication)(fixture.input, fixture.store);
        (0, assert_1.equal)(maximum, 3);
        (0, assert_1.equal)(active, 0);
        (0, assert_1.equal)(containsBuffer(result), false);
        (0, assert_1.deepEqual)(result.plan.decisions.map(value => value.key), [...fixture.portraits].map(value => value.objectKey).sort());
        const control = makeFixture(24, "production", "v2", 262144);
        control.input.fullAudit = true;
        control.input.concurrency = 1;
        const controlResult = await (0, publish_r2_verified_inventory_1.executeVerifiedCharacterPublication)(control.input, control.store);
        (0, assert_1.deepEqual)(result.plan.decisions, controlResult.plan.decisions);
        (0, assert_1.deepEqual)(result.plan.telemetry, controlResult.plan.telemetry);
    });
    (0, mocha_1.it)("limits concurrent portrait uploads and revalidates lazy local bytes before each PUT", async () => {
        const fixture = makeFixture(12, "production", "v2", 262144);
        fixture.input.dryRun = false;
        fixture.input.concurrency = 2;
        for (const portrait of fixture.portraits)
            fixture.store.objects.delete(portrait.objectKey);
        let active = 0;
        let maximum = 0;
        let activeReadbacks = 0;
        let maximumReadbacks = 0;
        fixture.store.putHook = async (key) => {
            if (!key.includes("/images/"))
                return;
            active += 1;
            maximum = Math.max(maximum, active);
            await new Promise(resolveDelay => setTimeout(resolveDelay, 2));
            active -= 1;
        };
        fixture.store.getHook = async (key) => {
            if (!key.includes("/images/") || !fixture.store.calls.includes(`PUT ${key}`))
                return;
            const stored = fixture.store.objects.get(key);
            activeReadbacks += 1;
            maximumReadbacks = Math.max(maximumReadbacks, activeReadbacks);
            await new Promise(resolveDelay => setTimeout(resolveDelay, 2));
            return {
                bytes: Buffer.from(stored.bytes),
                sizeBytes: stored.bytes.byteLength,
                etag: stored.etag,
                lastModified: stored.lastModified,
                contentType: stored.contentType,
                cacheControl: stored.cacheControl,
                release: () => { activeReadbacks -= 1; },
            };
        };
        const result = await (0, publish_r2_verified_inventory_1.executeVerifiedCharacterPublication)(fixture.input, fixture.store);
        (0, assert_1.equal)(maximum, 2);
        (0, assert_1.equal)(maximumReadbacks, 2);
        (0, assert_1.equal)(activeReadbacks, 0);
        (0, assert_1.equal)(result.plan.portraitUploadCount, 12);
        (0, assert_1.equal)(fixture.localLoads.count, 12);
        (0, assert_1.equal)(containsBuffer(result), false);
        const changed = makeFixture();
        changed.store.objects.delete(changed.portraits[0].objectKey);
        changed.input.dryRun = false;
        changed.portraits[0].loadBytes = async () => Buffer.from("changed-after-validation");
        await (0, assert_1.rejects)((0, publish_r2_verified_inventory_1.executeVerifiedCharacterPublication)(changed.input, changed.store), /changed after validation/);
        (0, assert_1.equal)(changed.store.calls.includes(`PUT ${changed.portraits[0].objectKey}`), false);
        (0, assert_1.equal)(changed.store.calls.includes(`PUT ${changed.manifestKey}`), false);
    });
    (0, mocha_1.it)("full audit hashes every present portrait body", async () => {
        const fixture = makeFixture(12);
        fixture.input.fullAudit = true;
        const result = await (0, publish_r2_verified_inventory_1.executeVerifiedCharacterPublication)(fixture.input, fixture.store);
        (0, assert_1.equal)(result.plan.portraitFullGetCount, 12);
        (0, assert_1.equal)(result.plan.portraitReuseCount, 12);
        (0, assert_1.equal)(result.plan.telemetry.get, 14);
        (0, assert_1.equal)(fixture.localLoads.count, 0);
    });
    (0, mocha_1.it)("fast and full-audit planners agree on final reuse and upload sets", async () => {
        const fast = makeFixture(4);
        fast.store.objects.delete(fast.portraits[3].objectKey);
        const fastPlan = (await (0, publish_r2_verified_inventory_1.executeVerifiedCharacterPublication)(fast.input, fast.store)).plan;
        const audit = makeFixture(4);
        audit.store.objects.delete(audit.portraits[3].objectKey);
        audit.input.fullAudit = true;
        const auditPlan = (await (0, publish_r2_verified_inventory_1.executeVerifiedCharacterPublication)(audit.input, audit.store)).plan;
        const sets = (decisions) => ({
            reuse: decisions.filter(value => value.decision.startsWith("reuse-")).map(value => value.key),
            upload: decisions.filter(value => value.decision === "upload-create-only").map(value => value.key),
            conflict: decisions.filter(value => value.decision === "conflict").map(value => value.key),
        });
        (0, assert_1.deepEqual)(sets(fastPlan.decisions), sets(auditPlan.decisions));
    });
    (0, mocha_1.it)("rejects duplicate, malformed and out-of-prefix inventory entries", async () => {
        for (const mode of ["duplicate", "malformed", "outside"]) {
            const fixture = makeFixture();
            const valid = fixture.portraits[0];
            const lastModified = fixture.state.portraits[valid.objectKey].lastModified;
            fixture.store.listHook = prefix => ({
                objects: mode === "duplicate"
                    ? [
                        { key: valid.objectKey, sizeBytes: valid.sizeBytes, etag: '"a"', lastModified },
                        { key: valid.objectKey, sizeBytes: valid.sizeBytes, etag: '"b"', lastModified },
                    ]
                    : [{
                            key: mode === "malformed" ? `${prefix}unknown.png` : "other/prefix.png",
                            sizeBytes: valid.sizeBytes,
                            etag: '"a"',
                            lastModified,
                        }],
                isTruncated: false,
            });
            await (0, assert_1.rejects)((0, publish_r2_verified_inventory_1.executeVerifiedCharacterPublication)(fixture.input, fixture.store), mode === "duplicate" ? /duplicate key/ : mode === "malformed" ? /malformed managed portrait key/ : /out-of-prefix/);
        }
    });
    (0, mocha_1.it)("continues pagination solely from the official truncation flag, even after an empty page", async () => {
        const fixture = makeFixture();
        const entry = fixture.portraits[0];
        fixture.store.listHook = (_prefix, token) => token === undefined
            ? { objects: [], isTruncated: true, nextContinuationToken: "next" }
            : {
                objects: [{
                        key: entry.objectKey,
                        sizeBytes: entry.sizeBytes,
                        etag: fixture.state.portraits[entry.objectKey].etag,
                        lastModified: fixture.state.portraits[entry.objectKey].lastModified,
                    }],
                isTruncated: false,
            };
        const result = await (0, publish_r2_verified_inventory_1.executeVerifiedCharacterPublication)(fixture.input, fixture.store);
        (0, assert_1.equal)(result.plan.telemetry.list, 2);
        (0, assert_1.equal)(result.plan.portraitFullGetCount, 0);
    });
});
//# sourceMappingURL=publish-r2-verified-inventory.spec.js.map