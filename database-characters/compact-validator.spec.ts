import { createHash } from "crypto";
import { deepStrictEqual, equal, ok, rejects } from "assert";
import { mkdtemp, readFile, rename, rm, symlink, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { gzipSync } from "zlib";
import {
    CHARACTER_COMPACT_EXPECTATIONS,
    CharacterCompactCoverage,
    CharacterCompactManifest,
    CharacterCompactProjection,
} from "./compact-contract";
import {
    buildCharacterCompactReadiness,
    pinnedCharacterCompactLineage,
    validateCharacterCompactArtifact,
    validateCharacterCompactProjection,
} from "./compact-validator";
import * as compactValidator from "./compact-validator";

const digest = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const jsonBytes = (value: unknown) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);

function projection(): CharacterCompactProjection {
    return {
        schemaVersion: 1,
        contract: "dokkan-database-character-compact-shadow",
        contractVersion: "1.0.0",
        generatedAt: "2026-08-05T00:00:00.000Z",
        datasetVersion: "global-6.4.0-v338-2026-08-05-k15-v1",
        source: pinnedCharacterCompactLineage(),
        policy: {
            id: "database-character-compact-supported-only", version: "1.0.0",
            approvedBy: { contract: "dokkan-database-character-field-shadow-readiness", contractVersion: "1.0.1" },
            records: "supported_only", fields: ["id", "rarity", "type"], allowedComparisons: ["agreement", "representation_gain"],
            structuralJoinOnly: true, externalFallbackIncluded: false, auditFieldsIncluded: false, productionModified: false,
            consumerImplemented: false, publisherEnabled: false, androidEnabled: false,
        },
        records: Array.from({ length: CHARACTER_COMPACT_EXPECTATIONS.recordCount }, (_, index) => ({ cardId: String(index + 1), stateId: `state-${index + 1}`, rarity: "UR" as any, type: "AGL" as any })),
    };
}

function coverage(): CharacterCompactCoverage {
    const expected = CHARACTER_COMPACT_EXPECTATIONS;
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

async function writeRelease(root: string): Promise<CharacterCompactManifest> {
    const payload = projection();
    const raw = jsonBytes(payload);
    const gzip = gzipSync(raw, { level: 9 });
    const sha256 = digest(gzip);
    const coverageBytes = jsonBytes(coverage());
    const validation = validateCharacterCompactProjection(payload, coverage(), { gzipSizeBytes: gzip.length, rawSizeBytes: raw.length }, true);
    const validationBytes = jsonBytes(validation);
    const readinessBytes = jsonBytes(buildCharacterCompactReadiness(payload.generatedAt));
    const manifest: CharacterCompactManifest = {
        schemaVersion: 1, contract: "dokkan-database-character-compact-shadow-manifest", contractVersion: "1.0.0",
        generatedAt: payload.generatedAt, datasetVersion: payload.datasetVersion,
        fileName: `database-characters-k15-compact-supported.${sha256}.json.gz`, compression: "gzip", sha256, sizeBytes: gzip.length,
        uncompressedSha256: digest(raw), uncompressedSizeBytes: raw.length, recordCount: payload.records.length, lineage: payload.source,
        coverageFile: "database-characters-k15-coverage.json", coverageSha256: digest(coverageBytes), coverageSizeBytes: coverageBytes.length,
        validationFile: "database-characters-k15-validation.json", validationSha256: digest(validationBytes), validationSizeBytes: validationBytes.length,
        readinessFile: "database-characters-k15-readiness.json", readinessSha256: digest(readinessBytes), readinessSizeBytes: readinessBytes.length,
    };
    await Promise.all([
        writeFile(join(root, manifest.fileName), gzip),
        writeFile(join(root, "database-characters-k15-manifest.json"), jsonBytes(manifest)),
        writeFile(join(root, manifest.coverageFile), coverageBytes),
        writeFile(join(root, manifest.validationFile), validationBytes),
        writeFile(join(root, manifest.readinessFile), readinessBytes),
    ]);
    return manifest;
}

describe("database character K15 compact validation", () => {
    let root: string;
    beforeEach(async () => { root = await mkdtemp(join(tmpdir(), "dokkan-k15-")); });
    afterEach(async () => { await rm(root, { recursive: true, force: true }); });

    it("validates the nominal 4,296-record artifact and its own manifest lineage", async () => {
        await writeRelease(root);
        const result = await validateCharacterCompactArtifact(root);
        equal(result.projection.records.length, 4_296);
        equal(result.coverage.exclusions.unjoinable, 1_463);
        equal(result.validation.valid, true);
        equal(result.readiness.nextGate.gate, "K16");
    });

    it("rejects old/future schemas, duplicate IDs, unstable order, enums, extra fields, missing bindings and lineage drift", () => {
        const cases: CharacterCompactProjection[] = [];
        cases.push({ ...projection(), schemaVersion: 0 as any });
        cases.push({ ...projection(), schemaVersion: 2 as any });
        const duplicate = projection(); duplicate.records[1] = { ...duplicate.records[1], cardId: duplicate.records[0].cardId }; cases.push(duplicate);
        const unstable = projection(); [unstable.records[0], unstable.records[1]] = [unstable.records[1], unstable.records[0]]; cases.push(unstable);
        const invalidEnum = projection(); invalidEnum.records[0] = { ...invalidEnum.records[0], rarity: "SDBH" as any }; cases.push(invalidEnum);
        const extra = projection(); (extra.records[0] as any).comparison = "unknown"; cases.push(extra);
        const missing = projection(); missing.records[0] = { ...missing.records[0], stateId: "" }; cases.push(missing);
        const lineage = projection(); lineage.source = { ...lineage.source, k14: { ...lineage.source.k14, sha256: "0".repeat(64) } }; cases.push(lineage);
        const k11Version = projection(); k11Version.source = { ...k11Version.source, k11: { ...k11Version.source.k11, contractVersion: "2.0.0" } }; cases.push(k11Version);
        const k12Hash = projection(); k12Hash.source = { ...k12Hash.source, k12: { ...k12Hash.source.k12, sha256: "1".repeat(64) } }; cases.push(k12Hash);
        const k14Version = projection(); k14Version.source = { ...k14Version.source, k14: { ...k14Version.source.k14, contractVersion: "1.0.0" } }; cases.push(k14Version);
        for (const value of cases) equal(validateCharacterCompactProjection(value, coverage(), undefined, true).valid, false);
    });

    it("enforces both documented budgets", () => {
        const payload = projection();
        const rawFailure = validateCharacterCompactProjection(payload, coverage(), { gzipSizeBytes: 1, rawSizeBytes: 4 * 1024 * 1024 + 1 }, true);
        const gzipFailure = validateCharacterCompactProjection(payload, coverage(), { gzipSizeBytes: 1024 * 1024 + 1, rawSizeBytes: 1 }, true);
        ok(rawFailure.failures.includes("raw budget exceeded"));
        ok(gzipFailure.failures.includes("gzip budget exceeded"));
    });

    it("rejects traversal, absolute paths and payload/manifest/hash adulteration", async () => {
        const manifest = await writeRelease(root);
        for (const fileName of ["../payload.json.gz", "C:\\payload.json.gz"]) {
            await writeFile(join(root, "database-characters-k15-manifest.json"), jsonBytes({ ...manifest, fileName }));
            await rejects(validateCharacterCompactArtifact(root), /content-addressed file name|manifest path/);
        }
        await writeFile(join(root, "database-characters-k15-manifest.json"), jsonBytes(manifest));
        await writeFile(join(root, manifest.fileName), Buffer.from("mutated"));
        await rejects(validateCharacterCompactArtifact(root), /payload identity/);
    });

    it("rejects payload mutation after a previously successful validation and auxiliary hash drift", async () => {
        const manifest = await writeRelease(root);
        await validateCharacterCompactArtifact(root);
        const payload = await readFile(join(root, manifest.fileName));
        payload[payload.length - 1] ^= 1;
        await writeFile(join(root, manifest.fileName), payload);
        await rejects(validateCharacterCompactArtifact(root), /payload identity/);
        await writeRelease(root);
        await writeFile(join(root, "database-characters-k15-manifest.json"), jsonBytes({ ...manifest, coverageSha256: "0".repeat(64) }));
        await rejects(validateCharacterCompactArtifact(root), /coverage identity/);
    });

    it("rejects a payload symlink or junction when the environment permits it", async function () {
        const manifest = await writeRelease(root);
        const external = join(root, "external.gz");
        await rename(join(root, manifest.fileName), external);
        try { await symlink(external, join(root, manifest.fileName), "file"); } catch { this.skip(); return; }
        await rejects(validateCharacterCompactArtifact(root), /symlink or junction/);
    });

    it("rejects a junction artifact root", async () => {
        await writeRelease(root);
        const junction = `${root}-junction`;
        try {
            await symlink(root, junction, "junction");
            await rejects(validateCharacterCompactArtifact(junction), /root symlink or junction/);
        } finally {
            await rm(junction, { recursive: true, force: true });
        }
    });

    it("has no apply/merge API and no runtime K11 reader", () => {
        equal((compactValidator as any).applyCharacterCompactInMemory, undefined);
        equal((compactValidator as any).mergeCharacterCompact, undefined);
        equal((compactValidator as any).loadK11, undefined);
        deepStrictEqual(buildCharacterCompactReadiness("2026-08-05T00:00:00.000Z").gates.inMemoryConsumer, "NO-GO");
    });
});
