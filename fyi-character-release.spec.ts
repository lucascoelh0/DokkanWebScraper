import { deepStrictEqual, equal, throws } from "assert";
import { buildCharacterDatasetArtifact } from "./dataset-artifacts";
import {
    buildFyiCharacterReleaseK21,
    buildFyiCharacterReleaseK22,
    buildFyiCharacterReleaseK23,
    FYI_CHARACTER_BUCKET_MAX_BYTES,
    FYI_CHARACTER_RELEASE_MAX_BYTES,
    parseFyiCharacterReleaseCli,
} from "./fyi-character-release";

function fixture() {
    const generatedAt = "2026-08-11T00:56:35.327Z";
    const characters = [{
        id: "1000001",
        portraitURL: "images/v2/portrait_1000001.png",
        portraitFilename: "portrait_1000001",
        transformations: [{
            id: "4000001",
            portraitURL: "images/v2/portrait_4000001.png",
            portraitFilename: "portrait_4000001",
            transformations: [],
        }],
    }] as any;
    const artifact = buildCharacterDatasetArtifact(characters, {
        generatedAt,
        datasetVersion: generatedAt,
        fileName: "characters.json.gz",
    });
    const k20 = {
        schemaVersion: 1,
        contract: "dokkan-fyi-character-database-candidate-readiness-k20",
        contractVersion: "1.0.0",
        generatedAt,
        sources: {
            candidate: {
                datasetVersion: artifact.manifest.datasetVersion,
                generatedAt: artifact.manifest.generatedAt,
                payloadFile: "characters.json.gz",
                payloadSha256: artifact.manifest.sha256,
                payloadSizeBytes: artifact.manifest.sizeBytes,
                uncompressedSizeBytes: artifact.manifest.uncompressedSizeBytes,
                characterCount: artifact.manifest.characterCount,
            },
        },
        checks: { complete: true },
        failures: { total: 0, examples: [], exampleLimit: 5 },
        readiness: {
            candidateGenerationValidation: "GO",
            promotion: "NO-GO", production: "NO-GO", publisher: "NO-GO", android: "NO-GO", r2: "NO-GO",
        },
    } as any;
    const portraitA = Buffer.from("portrait-a");
    const portraitB = Buffer.from("portrait-b");
    const crypto = require("crypto");
    const hash = (bytes: Buffer) => crypto.createHash("sha256").update(bytes).digest("hex");
    return {
        artifact,
        k20,
        candidateReadyMarker: Buffer.from("ready-marker\n"),
        portraits: [
            { objectKey: "images/v2/portrait_1000001.png", fileName: "portrait_1000001.png", sha256: hash(portraitA), sizeBytes: portraitA.length },
            { objectKey: "images/v2/portrait_4000001.png", fileName: "portrait_4000001.png", sha256: hash(portraitB), sizeBytes: portraitB.length },
        ],
    };
}

describe("FYI character release K21-K23", () => {
    it("builds a deterministic content-addressed release, local plan, and stopped receipt", () => {
        const input = fixture();
        const build = () => {
            const release = buildFyiCharacterReleaseK21({
                candidateGzip: input.artifact.gzipBuffer,
                candidateManifest: input.artifact.manifest,
                candidateReadyMarker: input.candidateReadyMarker,
                k20: input.k20,
                portraits: input.portraits,
            });
            const plan = buildFyiCharacterReleaseK22(release);
            const receipt = buildFyiCharacterReleaseK23(release, plan);
            return { release, plan, receipt };
        };
        const first = build();
        const second = build();
        deepStrictEqual(first, second);
        equal(first.release.portraits.count, 2);
        equal(first.release.releaseId.length, 129);
        equal(first.plan.objects.length, 4);
        equal(first.plan.stablePortraitKeys.requireRemoteHashProofBeforeUpload, true);
        equal(first.plan.readiness.localPlan, "GO");
        equal(first.plan.readiness.remoteInventory, "NO-GO");
        equal(first.plan.budget.withinBucketLimit, null);
        equal(first.receipt.readiness.localReleaseBundle, "GO");
        equal(first.receipt.readiness.remoteDryRun, "NO-GO");
        equal(first.receipt.readiness.publication, "NO-GO");
        equal(first.receipt.checks.noNetworkCodeInvoked, true);
    });

    it("rejects a release without a clean K20 GO", () => {
        const input = fixture();
        input.k20.readiness.candidateGenerationValidation = "NO-GO";
        throws(() => buildFyiCharacterReleaseK21({
            candidateGzip: input.artifact.gzipBuffer,
            candidateManifest: input.artifact.manifest,
            candidateReadyMarker: input.candidateReadyMarker,
            k20: input.k20,
            portraits: input.portraits,
        }), /clean K20 GO/);
    });

    it("rejects traversal, missing portraits, and unexpected portrait inventory", () => {
        const input = fixture();
        const characters = [{ id: "1", portraitURL: "../secret.png" }] as any;
        const artifact = buildCharacterDatasetArtifact(characters, {
            generatedAt: input.artifact.manifest.generatedAt,
            datasetVersion: input.artifact.manifest.datasetVersion,
            fileName: "characters.json.gz",
        });
        input.k20.sources.candidate = {
            datasetVersion: artifact.manifest.datasetVersion,
            generatedAt: artifact.manifest.generatedAt,
            payloadFile: "characters.json.gz",
            payloadSha256: artifact.manifest.sha256,
            payloadSizeBytes: artifact.manifest.sizeBytes,
            uncompressedSizeBytes: artifact.manifest.uncompressedSizeBytes,
            characterCount: artifact.manifest.characterCount,
        };
        throws(() => buildFyiCharacterReleaseK21({
            candidateGzip: artifact.gzipBuffer,
            candidateManifest: artifact.manifest,
            candidateReadyMarker: input.candidateReadyMarker,
            k20: input.k20,
            portraits: [],
        }), /portrait object key rejected/);

        const missing = fixture();
        throws(() => buildFyiCharacterReleaseK21({
            candidateGzip: missing.artifact.gzipBuffer,
            candidateManifest: missing.artifact.manifest,
            candidateReadyMarker: missing.candidateReadyMarker,
            k20: missing.k20,
            portraits: missing.portraits.slice(0, 1),
        }), /portrait inventory mismatch/);
    });

    it("rejects manifest drift and invalid portrait metadata", () => {
        const input = fixture();
        const driftedManifest = { ...input.artifact.manifest, sha256: "0".repeat(64) };
        input.k20.sources.candidate.payloadSha256 = driftedManifest.sha256;
        throws(() => buildFyiCharacterReleaseK21({
            candidateGzip: input.artifact.gzipBuffer,
            candidateManifest: driftedManifest,
            candidateReadyMarker: input.candidateReadyMarker,
            k20: input.k20,
            portraits: input.portraits,
        }), /payload hash rejected/);

        const invalid = fixture();
        const portraits = invalid.portraits.map(value => ({ ...value }));
        portraits[0].fileName = "different.png";
        throws(() => buildFyiCharacterReleaseK21({
            candidateGzip: invalid.artifact.gzipBuffer,
            candidateManifest: invalid.artifact.manifest,
            candidateReadyMarker: invalid.candidateReadyMarker,
            k20: invalid.k20,
            portraits,
        }), /portrait entry rejected/);
    });

    it("fails closed when local budget limits are exceeded", () => {
        const input = fixture();
        const release = buildFyiCharacterReleaseK21({
            candidateGzip: input.artifact.gzipBuffer,
            candidateManifest: input.artifact.manifest,
            candidateReadyMarker: input.candidateReadyMarker,
            k20: input.k20,
            portraits: input.portraits,
        });
        release.portraits.entries[0].sizeBytes = FYI_CHARACTER_RELEASE_MAX_BYTES;
        release.portraits.totalBytes = FYI_CHARACTER_RELEASE_MAX_BYTES + release.portraits.entries[1].sizeBytes;
        release.portraits.inventorySha256 = require("crypto").createHash("sha256")
            .update(Buffer.from(`${JSON.stringify(release.portraits.entries, null, 2)}\n`))
            .digest("hex");
        throws(() => buildFyiCharacterReleaseK22(release), /budget exceeded/);
        equal(FYI_CHARACTER_BUCKET_MAX_BYTES, 10_000_000_000);
    });

    it("rejects a mutated K22 plan at K23", () => {
        const input = fixture();
        const release = buildFyiCharacterReleaseK21({
            candidateGzip: input.artifact.gzipBuffer,
            candidateManifest: input.artifact.manifest,
            candidateReadyMarker: input.candidateReadyMarker,
            k20: input.k20,
            portraits: input.portraits,
        });
        const plan = buildFyiCharacterReleaseK22(release);
        plan.readiness.publication = "GO" as any;
        throws(() => buildFyiCharacterReleaseK23(release, plan), /plan rejected/);

        const objectPlan = buildFyiCharacterReleaseK22(release);
        objectPlan.objects[0].sizeBytes += 1;
        throws(() => buildFyiCharacterReleaseK23(release, objectPlan), /plan rejected/);
    });

    it("requires the exact explicit opt-in flag", () => {
        throws(() => parseFyiCharacterReleaseCli([]), /exactly one/);
        throws(() => parseFyiCharacterReleaseCli(["--opt-in-k21-k23", "--remote"]), /exactly one/);
        deepStrictEqual(parseFyiCharacterReleaseCli(["--opt-in-k21-k23"]), { optIn: true });
    });
});
