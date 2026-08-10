"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = require("crypto");
const assert_1 = require("assert");
const promises_1 = require("fs/promises");
const os_1 = require("os");
const path_1 = require("path");
const zlib_1 = require("zlib");
const compact_contract_1 = require("./compact-contract");
const compact_validator_1 = require("./compact-validator");
const compactValidator = require("./compact-validator");
const TEST_HOOK = Symbol.for("dokkan.k15.compact-validator.test-hook");
const digest = (bytes) => (0, crypto_1.createHash)("sha256").update(bytes).digest("hex");
const jsonBytes = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
const repositoryRoot = () => {
    const parent = (0, path_1.resolve)(__dirname, "..");
    return (0, path_1.basename)(parent).toLowerCase() === "lib" ? (0, path_1.resolve)(parent, "..") : parent;
};
function projection() {
    return {
        schemaVersion: 1,
        contract: "dokkan-database-character-compact-shadow",
        contractVersion: "1.0.0",
        generatedAt: "2026-08-05T00:00:00.000Z",
        datasetVersion: "global-6.4.0-v338-2026-08-05-k15-v1",
        source: (0, compact_validator_1.pinnedCharacterCompactLineage)(),
        policy: {
            id: "database-character-compact-supported-only", version: "1.0.0",
            approvedBy: { contract: "dokkan-database-character-field-shadow-readiness", contractVersion: "1.0.1" },
            records: "supported_only", fields: ["id", "rarity", "type"], allowedComparisons: ["agreement", "representation_gain"],
            structuralJoinOnly: true, externalFallbackIncluded: false, auditFieldsIncluded: false, productionModified: false,
            consumerImplemented: false, publisherEnabled: false, androidEnabled: false,
        },
        records: Array.from({ length: compact_contract_1.CHARACTER_COMPACT_EXPECTATIONS.recordCount }, (_, index) => ({ cardId: String(index + 1), stateId: `state-${index + 1}`, rarity: "UR", type: "AGL" })),
    };
}
function coverage() {
    const expected = compact_contract_1.CHARACTER_COMPACT_EXPECTATIONS;
    return {
        schemaVersion: 1, contract: "dokkan-database-character-compact-shadow-coverage", contractVersion: "1.0.0",
        databaseCardCount: expected.databaseCardCount, recordCount: expected.recordCount, excludedCardCount: expected.productionUnjoinableCount,
        exclusions: { unjoinable: expected.productionUnjoinableCount, partial: 0, unknown: 0, mismatch: 0, conflict: 0, invalidEnum: 0, ambiguousBinding: 0, incomplete: 0 },
        comparisons: {
            id: { agreements: expected.idAgreements, representationGains: 0 },
            rarity: { agreements: expected.rarityAgreements, representationGains: expected.rarityRepresentationGains },
            type: { agreements: expected.typeAgreements, representationGains: 0 },
        },
        catalogImpact: { charactersCreated: 0, charactersRemoved: 0, productionModified: false },
    };
}
function pinnedManifest() {
    const release = compact_contract_1.CHARACTER_COMPACT_PINNED_RELEASE;
    return {
        schemaVersion: 1,
        contract: "dokkan-database-character-compact-shadow-manifest",
        contractVersion: "1.0.0",
        generatedAt: "2026-08-05T00:00:00.000Z",
        datasetVersion: "global-6.4.0-v338-2026-08-05-k15-v1",
        fileName: release.payloadFile,
        compression: "gzip",
        sha256: release.payloadSha256,
        sizeBytes: release.payloadSizeBytes,
        uncompressedSha256: release.rawSha256,
        uncompressedSizeBytes: release.rawSizeBytes,
        recordCount: release.recordCount,
        lineage: (0, compact_validator_1.pinnedCharacterCompactLineage)(),
        coverageFile: release.coverageFile,
        coverageSha256: release.coverageSha256,
        coverageSizeBytes: release.coverageSizeBytes,
        validationFile: release.validationFile,
        validationSha256: release.validationSha256,
        validationSizeBytes: release.validationSizeBytes,
        readinessFile: release.readinessFile,
        readinessSha256: release.readinessSha256,
        readinessSizeBytes: release.readinessSizeBytes,
    };
}
async function writeRelease(root, payload = projection()) {
    const raw = jsonBytes(payload);
    const gzip = (0, zlib_1.gzipSync)(raw, { level: 9 });
    const sha256 = digest(gzip);
    const coverageBytes = jsonBytes(coverage());
    const validation = (0, compact_validator_1.validateCharacterCompactProjection)(payload, coverage(), { gzipSizeBytes: gzip.length, rawSizeBytes: raw.length }, true);
    const validationBytes = jsonBytes(validation);
    const readinessBytes = jsonBytes((0, compact_validator_1.buildCharacterCompactReadiness)(payload.generatedAt));
    const manifest = {
        schemaVersion: 1, contract: "dokkan-database-character-compact-shadow-manifest", contractVersion: "1.0.0",
        generatedAt: payload.generatedAt, datasetVersion: payload.datasetVersion,
        fileName: `database-characters-k15-compact-supported.${sha256}.json.gz`, compression: "gzip", sha256, sizeBytes: gzip.length,
        uncompressedSha256: digest(raw), uncompressedSizeBytes: raw.length, recordCount: payload.records.length, lineage: payload.source,
        coverageFile: "database-characters-k15-coverage.json", coverageSha256: digest(coverageBytes), coverageSizeBytes: coverageBytes.length,
        validationFile: "database-characters-k15-validation.json", validationSha256: digest(validationBytes), validationSizeBytes: validationBytes.length,
        readinessFile: "database-characters-k15-readiness.json", readinessSha256: digest(readinessBytes), readinessSizeBytes: readinessBytes.length,
    };
    await Promise.all([
        (0, promises_1.writeFile)((0, path_1.join)(root, manifest.fileName), gzip),
        (0, promises_1.writeFile)((0, path_1.join)(root, "database-characters-k15-manifest.json"), jsonBytes(manifest)),
        (0, promises_1.writeFile)((0, path_1.join)(root, manifest.coverageFile), coverageBytes),
        (0, promises_1.writeFile)((0, path_1.join)(root, manifest.validationFile), validationBytes),
        (0, promises_1.writeFile)((0, path_1.join)(root, manifest.readinessFile), readinessBytes),
    ]);
    return manifest;
}
describe("database character K15 compact validation", () => {
    let root;
    beforeEach(async () => { root = await (0, promises_1.mkdtemp)((0, path_1.join)((0, os_1.tmpdir)(), "dokkan-k15-")); });
    afterEach(async () => { await (0, promises_1.rm)(root, { recursive: true, force: true }); });
    it("validates the nominal 4,296-record projection and pinned lineage", () => {
        const result = (0, compact_validator_1.validateCharacterCompactProjection)(projection(), coverage(), undefined, true);
        (0, assert_1.equal)(result.valid, true);
        (0, assert_1.equal)(result.safety.runtimeK11ReadImplemented, false);
        (0, assert_1.equal)(compact_contract_1.CHARACTER_COMPACT_PINNED_RELEASE.recordCount, 4296);
    });
    it("rejects old/future schemas, duplicate IDs, unstable order, enums, extra fields, missing bindings and lineage drift", () => {
        const cases = [];
        cases.push({ ...projection(), schemaVersion: 0 });
        cases.push({ ...projection(), schemaVersion: 2 });
        const duplicate = projection();
        duplicate.records[1] = { ...duplicate.records[1], cardId: duplicate.records[0].cardId };
        cases.push(duplicate);
        const unstable = projection();
        [unstable.records[0], unstable.records[1]] = [unstable.records[1], unstable.records[0]];
        cases.push(unstable);
        const invalidEnum = projection();
        invalidEnum.records[0] = { ...invalidEnum.records[0], rarity: "SDBH" };
        cases.push(invalidEnum);
        const extra = projection();
        extra.records[0].comparison = "unknown";
        cases.push(extra);
        const missing = projection();
        missing.records[0] = { ...missing.records[0], stateId: "" };
        cases.push(missing);
        const lineage = projection();
        lineage.source = { ...lineage.source, k14: { ...lineage.source.k14, sha256: "0".repeat(64) } };
        cases.push(lineage);
        const k11Version = projection();
        k11Version.source = { ...k11Version.source, k11: { ...k11Version.source.k11, contractVersion: "2.0.0" } };
        cases.push(k11Version);
        const k12Hash = projection();
        k12Hash.source = { ...k12Hash.source, k12: { ...k12Hash.source.k12, sha256: "1".repeat(64) } };
        cases.push(k12Hash);
        const k14Version = projection();
        k14Version.source = { ...k14Version.source, k14: { ...k14Version.source.k14, contractVersion: "1.0.0" } };
        cases.push(k14Version);
        for (const value of cases)
            (0, assert_1.equal)((0, compact_validator_1.validateCharacterCompactProjection)(value, coverage(), undefined, true).valid, false);
    });
    it("enforces both documented budgets", () => {
        const payload = projection();
        const rawFailure = (0, compact_validator_1.validateCharacterCompactProjection)(payload, coverage(), { gzipSizeBytes: 1, rawSizeBytes: 4 * 1024 * 1024 + 1 }, true);
        const gzipFailure = (0, compact_validator_1.validateCharacterCompactProjection)(payload, coverage(), { gzipSizeBytes: 1024 * 1024 + 1, rawSizeBytes: 1 }, true);
        (0, assert_1.ok)(rawFailure.failures.includes("raw budget exceeded"));
        (0, assert_1.ok)(gzipFailure.failures.includes("gzip budget exceeded"));
    });
    it("rejects traversal, absolute paths and payload/manifest/hash adulteration", async () => {
        const manifest = await writeRelease(root);
        for (const fileName of ["../payload.json.gz", "C:\\payload.json.gz"]) {
            await (0, promises_1.writeFile)((0, path_1.join)(root, "database-characters-k15-manifest.json"), jsonBytes({ ...manifest, fileName }));
            await (0, assert_1.rejects)((0, compact_validator_1.validateCharacterCompactArtifact)(root), /pinned release manifest identity/);
        }
        await (0, promises_1.writeFile)((0, path_1.join)(root, "database-characters-k15-manifest.json"), jsonBytes(manifest));
        await (0, promises_1.writeFile)((0, path_1.join)(root, manifest.fileName), Buffer.from("mutated"));
        await (0, assert_1.rejects)((0, compact_validator_1.validateCharacterCompactArtifact)(root), /pinned release manifest identity/);
    });
    it("rejects rarity or stateId changes even when every payload and auxiliary hash is recalculated", async () => {
        for (const field of ["rarity", "stateId"]) {
            const payload = projection();
            payload.records[0] = field === "rarity"
                ? { ...payload.records[0], rarity: "SSR" }
                : { ...payload.records[0], stateId: "attacker-rebound-state" };
            const manifest = await writeRelease(root, payload);
            (0, assert_1.equal)(manifest.sha256, digest(await (0, promises_1.readFile)((0, path_1.join)(root, manifest.fileName))));
            await (0, assert_1.rejects)((0, compact_validator_1.validateCharacterCompactArtifact)(root), /pinned release manifest identity/);
        }
    });
    it("rejects recomputed rarity and stateId adulteration of the authorized local release", async function () {
        const release = compact_contract_1.CHARACTER_COMPACT_PINNED_RELEASE;
        const sourceRoot = (0, path_1.join)(repositoryRoot(), "data", "database-characters", "compact");
        let manifest;
        let payloadBytes;
        let coverageBytes;
        let readinessBytes;
        try {
            manifest = JSON.parse((await (0, promises_1.readFile)((0, path_1.join)(sourceRoot, release.manifestFile))).toString("utf8"));
            [payloadBytes, coverageBytes, readinessBytes] = await Promise.all([
                (0, promises_1.readFile)((0, path_1.join)(sourceRoot, manifest.fileName)),
                (0, promises_1.readFile)((0, path_1.join)(sourceRoot, manifest.coverageFile)),
                (0, promises_1.readFile)((0, path_1.join)(sourceRoot, manifest.readinessFile)),
            ]);
        }
        catch {
            this.skip();
            return;
        }
        await (0, compact_validator_1.validateCharacterCompactArtifact)(sourceRoot);
        const original = JSON.parse((0, zlib_1.gunzipSync)(payloadBytes).toString("utf8"));
        const compactCoverage = JSON.parse(coverageBytes.toString("utf8"));
        for (const field of ["rarity", "stateId"]) {
            const altered = JSON.parse(JSON.stringify(original));
            altered.records[0] = field === "rarity"
                ? { ...altered.records[0], rarity: altered.records[0].rarity === "UR" ? "SSR" : "UR" }
                : { ...altered.records[0], stateId: `${altered.records[0].stateId}-altered` };
            const raw = jsonBytes(altered);
            const gzip = (0, zlib_1.gzipSync)(raw, { level: 9 });
            const validationBytes = jsonBytes((0, compact_validator_1.validateCharacterCompactProjection)(altered, compactCoverage, { gzipSizeBytes: gzip.length, rawSizeBytes: raw.length }, true));
            const alteredManifest = {
                ...manifest,
                fileName: `database-characters-k15-compact-supported.${digest(gzip)}.json.gz`,
                sha256: digest(gzip),
                sizeBytes: gzip.length,
                uncompressedSha256: digest(raw),
                uncompressedSizeBytes: raw.length,
                recordCount: altered.records.length,
                coverageSha256: digest(coverageBytes),
                coverageSizeBytes: coverageBytes.length,
                validationSha256: digest(validationBytes),
                validationSizeBytes: validationBytes.length,
                readinessSha256: digest(readinessBytes),
                readinessSizeBytes: readinessBytes.length,
            };
            await Promise.all([
                (0, promises_1.writeFile)((0, path_1.join)(root, release.manifestFile), jsonBytes(alteredManifest)),
                (0, promises_1.writeFile)((0, path_1.join)(root, alteredManifest.fileName), gzip),
                (0, promises_1.writeFile)((0, path_1.join)(root, alteredManifest.coverageFile), coverageBytes),
                (0, promises_1.writeFile)((0, path_1.join)(root, alteredManifest.validationFile), validationBytes),
                (0, promises_1.writeFile)((0, path_1.join)(root, alteredManifest.readinessFile), readinessBytes),
            ]);
            await (0, assert_1.rejects)((0, compact_validator_1.validateCharacterCompactArtifact)(root), /pinned release manifest identity/);
        }
    });
    it("rejects internally consistent but unauthorized releases and auxiliary hash drift", async () => {
        const manifest = await writeRelease(root);
        await (0, assert_1.rejects)((0, compact_validator_1.validateCharacterCompactArtifact)(root), /pinned release manifest identity/);
        await writeRelease(root);
        await (0, promises_1.writeFile)((0, path_1.join)(root, "database-characters-k15-manifest.json"), jsonBytes({ ...manifest, coverageSha256: "0".repeat(64) }));
        await (0, assert_1.rejects)((0, compact_validator_1.validateCharacterCompactArtifact)(root), /pinned release manifest identity/);
    });
    it("rejects final-window identity or byte mutation of the pinned manifest, payload and every auxiliary", async function () {
        const release = compact_contract_1.CHARACTER_COMPACT_PINNED_RELEASE;
        const sourceRoot = (0, path_1.join)(repositoryRoot(), "data", "database-characters", "compact");
        const files = [
            ["manifest", release.manifestFile],
            ["payload", release.payloadFile],
            ["coverage", release.coverageFile],
            ["validation", release.validationFile],
            ["readiness", release.readinessFile],
        ];
        try {
            await Promise.all(files.map(([, fileName]) => (0, promises_1.readFile)((0, path_1.join)(sourceRoot, fileName))));
        }
        catch {
            this.skip();
            return;
        }
        const previousNodeEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = "test";
        try {
            for (const mutationKind of ["identity", "bytes"]) {
                for (const [label, mutatedFile] of files) {
                    const releaseRoot = (0, path_1.join)(root, `${mutationKind}-${label}`);
                    await (0, promises_1.mkdir)(releaseRoot);
                    await Promise.all(files.map(([, fileName]) => (0, promises_1.copyFile)((0, path_1.join)(sourceRoot, fileName), (0, path_1.join)(releaseRoot, fileName))));
                    let mutated = false;
                    global[TEST_HOOK] = async (point) => {
                        if (point !== "before-final-artifact-revalidation" || mutated)
                            return;
                        mutated = true;
                        const path = (0, path_1.join)(releaseRoot, mutatedFile);
                        const bytes = await (0, promises_1.readFile)(path);
                        if (mutationKind === "bytes") {
                            await (0, promises_1.writeFile)(path, Buffer.concat([bytes, Buffer.from([0])]));
                            return;
                        }
                        const replacement = `${path}.replacement`;
                        await (0, promises_1.writeFile)(replacement, bytes);
                        await (0, promises_1.unlink)(path);
                        await (0, promises_1.rename)(replacement, path);
                    };
                    await (0, assert_1.rejects)((0, compact_validator_1.validateCharacterCompactArtifact)(releaseRoot), new RegExp(`K15 ${label} mutated during validation`));
                    (0, assert_1.equal)(mutated, true, `${mutationKind} ${label} mutation hook did not run`);
                }
            }
        }
        finally {
            delete global[TEST_HOOK];
            if (previousNodeEnv === undefined)
                delete process.env.NODE_ENV;
            else
                process.env.NODE_ENV = previousNodeEnv;
        }
    });
    it("rejects a payload symlink or junction when the environment permits it", async function () {
        const manifest = pinnedManifest();
        const manifestBytes = jsonBytes(manifest);
        (0, assert_1.equal)(manifestBytes.length, compact_contract_1.CHARACTER_COMPACT_PINNED_RELEASE.manifestSizeBytes);
        (0, assert_1.equal)(digest(manifestBytes), compact_contract_1.CHARACTER_COMPACT_PINNED_RELEASE.manifestSha256);
        const external = (0, path_1.join)(root, "external.gz");
        await Promise.all([
            (0, promises_1.writeFile)((0, path_1.join)(root, compact_contract_1.CHARACTER_COMPACT_PINNED_RELEASE.manifestFile), manifestBytes),
            (0, promises_1.writeFile)(external, "not the payload"),
            (0, promises_1.writeFile)((0, path_1.join)(root, manifest.coverageFile), "placeholder"),
            (0, promises_1.writeFile)((0, path_1.join)(root, manifest.validationFile), "placeholder"),
            (0, promises_1.writeFile)((0, path_1.join)(root, manifest.readinessFile), "placeholder"),
        ]);
        try {
            await (0, promises_1.symlink)(external, (0, path_1.join)(root, manifest.fileName), "file");
        }
        catch {
            this.skip();
            return;
        }
        await (0, assert_1.rejects)((0, compact_validator_1.validateCharacterCompactArtifact)(root), /symlink or junction/);
    });
    it("rejects a junction artifact root", async () => {
        await writeRelease(root);
        const junction = `${root}-junction`;
        try {
            await (0, promises_1.symlink)(root, junction, "junction");
            await (0, assert_1.rejects)((0, compact_validator_1.validateCharacterCompactArtifact)(junction), /root symlink or junction/);
        }
        finally {
            await (0, promises_1.rm)(junction, { recursive: true, force: true });
        }
    });
    it("has no apply/merge API and no runtime K11 reader", () => {
        (0, assert_1.equal)(compactValidator.applyCharacterCompactInMemory, undefined);
        (0, assert_1.equal)(compactValidator.mergeCharacterCompact, undefined);
        (0, assert_1.equal)(compactValidator.loadK11, undefined);
        (0, assert_1.deepStrictEqual)((0, compact_validator_1.buildCharacterCompactReadiness)("2026-08-05T00:00:00.000Z").gates.inMemoryConsumer, "NO-GO");
    });
});
//# sourceMappingURL=compact-validator.spec.js.map