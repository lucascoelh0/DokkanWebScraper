import { createHash } from "crypto";
import { deepEqual, equal, throws } from "assert";
import { describe, it } from "mocha";
import { gzipSync } from "zlib";
import {
  buildPortraitPublishPlan,
  buildCharacterManifestObjectKey,
  buildRemoteDatasetObjectKey,
  assertExpectedRemoteBaselineSha256,
  collectReferencedPortraitKeys,
  DatasetPublishState,
  parsePublishArgs,
  parseWranglerBucketSize,
  PortraitPublishEntry,
  validateLocalCharacterBundle,
} from "./publish-r2";
import { assertDatasetPublicationWriteAuthorized } from "./dataset-publication-channel";

const V1_PROJECTION_REPORT = "projection-report.json";

describe("parseWranglerBucketSize", function () {
  it("uses a conservative upper bound for rounded Wrangler sizes", () => {
    deepEqual(parseWranglerBucketSize("383.9 MB"), {
      reported: "383.9 MB",
      conservativeUpperBoundBytes: 384_000_000,
    });
    deepEqual(parseWranglerBucketSize("10 B"), {
      reported: "10 B",
      conservativeUpperBoundBytes: 11,
    });
    throws(() => parseWranglerBucketSize("unknown"), /Unsupported Wrangler bucket size/);
  });
});

describe("dataset publication channel authorization", function () {
  it("requires an explicit production promotion while allowing dry-runs and staging", () => {
    throws(
      () => assertDatasetPublicationWriteAuthorized({
        channel: "production",
        target: "remote",
        dryRun: false,
        promoteProduction: false,
      }),
      /explicit --promote-production/,
    );
    assertDatasetPublicationWriteAuthorized({
      channel: "production",
      target: "remote",
      dryRun: true,
      promoteProduction: false,
    });
    assertDatasetPublicationWriteAuthorized({
      channel: "staging",
      target: "remote",
      dryRun: false,
      promoteProduction: false,
    });
    throws(
      () => assertDatasetPublicationWriteAuthorized({
        channel: "staging",
        target: "remote",
        dryRun: false,
        promoteProduction: true,
      }),
      /cannot be combined/,
    );
  });
});

describe("buildRemoteDatasetObjectKey", function () {
  it("uses a content-addressed immutable Character payload key", () => {
    equal(buildRemoteDatasetObjectKey({
      datasetVersion: "2026-08-22T21:14:10.019Z",
      fileName: "characters.json.gz",
      sha256: "A".repeat(64),
    } as any), `releases/2026-08-22T21-14-10.019Z/${"a".repeat(64)}/characters.json.gz`);
  });

  it("keeps staging manifests and immutable payloads outside production keys", () => {
    const manifest = {
      datasetVersion: "2026-08-22T21:14:10.019Z",
      fileName: "characters.json.gz",
      sha256: "A".repeat(64),
    } as any;
    equal(buildCharacterManifestObjectKey("staging", "v1"), "staging/v1/characters-manifest.json");
    equal(
      buildRemoteDatasetObjectKey(manifest, "staging", "v1"),
      `staging/v1/releases/2026-08-22T21-14-10.019Z/${"a".repeat(64)}/characters.json.gz`,
    );
    equal(buildCharacterManifestObjectKey("production", "v2"), "v2/characters-manifest.json");
    equal(buildCharacterManifestObjectKey("staging", "v2"), "staging/v2/characters-manifest.json");
  });
});

describe("assertExpectedRemoteBaselineSha256", function () {
  it("fails closed when a release candidate was built over a different public baseline", () => {
    const expected = "a".repeat(64);
    assertExpectedRemoteBaselineSha256(expected, { sha256: expected } as any);
    throws(
      () => assertExpectedRemoteBaselineSha256(expected, { sha256: "b".repeat(64) } as any),
      /Remote Character baseline changed/,
    );
    throws(
      () => assertExpectedRemoteBaselineSha256(expected, undefined),
      /Cannot prove the expected remote baseline/,
    );
  });
});

describe("parsePublishArgs", function () {
  it("requires and validates the expected remote baseline SHA", () => {
    throws(
      () => parsePublishArgs(["--bucket", "test", "--contract-lane", "v2", "--expected-remote-baseline-sha256", "--remote"]),
      /requires a value/,
    );
    throws(
      () => parsePublishArgs(["--bucket", "test", "--contract-lane", "v2", "--expected-remote-baseline-sha256="]),
      /requires a value/,
    );
    throws(
      () => parsePublishArgs(["--bucket", "test", "--contract-lane", "v2", "--expected-remote-baseline-sha256", "not-a-sha"]),
      /Invalid --expected-remote-baseline-sha256/,
    );
    throws(
      () => parsePublishArgs([
        "--bucket", "test",
        "--contract-lane", "v2",
        "--expected-remote-baseline-sha256", "a".repeat(64),
        "--skip-remote-manifest-check",
      ]),
      /cannot be combined/,
    );

    equal(
      parsePublishArgs([
        "--bucket", "test",
        "--contract-lane", "v2",
        "--expected-remote-baseline-sha256", "A".repeat(64),
      ]).expectedRemoteBaselineSha256,
      "a".repeat(64),
    );
  });

  it("requires isolated portrait handling and state for staging", () => {
    throws(
      () => parsePublishArgs(["--bucket", "test", "--contract-lane", "v2", "--channel", "staging"]),
      /requires --skip-portraits/,
    );
    const staging = parsePublishArgs([
      "--bucket", "test",
      "--channel", "staging",
      "--contract-lane", "v1",
      "--v1-projection-report", V1_PROJECTION_REPORT,
      "--skip-portraits",
    ]);
    equal(staging.channel, "staging");
    equal(staging.contractLane, "v1");
    equal(staging.manifestObjectKey, "staging/v1/characters-manifest.json");
    equal(staging.statePath.endsWith("r2-publish-state-staging-v1.json"), true);
    throws(
      () => parsePublishArgs(["--bucket", "test", "--contract-lane", "v2", "--channel", "preview", "--skip-portraits"]),
      /Invalid dataset publication channel/,
    );
  });

  it("requires an explicit lane and v1 projection provenance", () => {
    throws(() => parsePublishArgs(["--bucket", "test"]), /Missing dataset contract lane/);
    throws(
      () => parsePublishArgs(["--bucket", "test", "--contract-lane", "v1"]),
      /requires --v1-projection-report/,
    );
    throws(
      () => parsePublishArgs([
        "--bucket", "test",
        "--contract-lane", "v2",
        "--v1-projection-report", V1_PROJECTION_REPORT,
      ]),
      /only be used with --contract-lane v1/,
    );
  });
});

describe("validateLocalCharacterBundle", function () {
  function fixture() {
    const characters = [{ id: "100" }];
    const raw = Buffer.from(`${JSON.stringify(characters)}\n`, "utf8");
    const gzip = gzipSync(raw);
    const manifest = {
      schemaVersion: 1,
      datasetVersion: "2026-08-22T21:14:10.019Z",
      generatedAt: "2026-08-22T21:14:10.019Z",
      fileName: "characters.json.gz",
      compression: "gzip",
      sha256: createHash("sha256").update(gzip).digest("hex"),
      sizeBytes: gzip.byteLength,
      uncompressedSizeBytes: raw.byteLength,
      characterCount: characters.length,
    } as any;
    return { characters, gzip, manifest };
  }

  it("accepts a bundle only when its manifest matches the exact bytes", () => {
    const { characters, gzip, manifest } = fixture();
    deepEqual(validateLocalCharacterBundle(manifest, gzip), characters);
  });

  it("rejects mismatched bytes, counts and unsafe local filenames", () => {
    const { gzip, manifest } = fixture();
    throws(
      () => validateLocalCharacterBundle({ ...manifest, sha256: "b".repeat(64) }, gzip),
      /SHA-256 mismatch/,
    );
    throws(
      () => validateLocalCharacterBundle({ ...manifest, characterCount: 2 }, gzip),
      /count mismatch/,
    );
    throws(
      () => validateLocalCharacterBundle({ ...manifest, fileName: "..\/characters.json.gz" }, gzip),
      /filename is invalid/,
    );
  });
});

describe("collectReferencedPortraitKeys", function () {
  it("collects unique portrait keys from base cards, transformations and awakening references", () => {
    const portraitKeys = collectReferencedPortraitKeys([
      {
        portraitURL: "images/portrait_100.png",
        transformations: [
          { portraitURL: "images/portrait_101.png" },
          { portraitURL: "images/portrait_101.png" },
        ],
        awakeningCards: [
          { portraitURL: "images/portrait_102.png" },
        ],
        previousAwakenings: [
          { portraitURL: "/images/portrait_103.png" },
        ],
        nextAwakenings: [
          { portraitURL: ".\\images\\portrait_104.png" },
        ],
      },
    ] as any);

    deepEqual(portraitKeys, [
      "images/portrait_100.png",
      "images/portrait_101.png",
      "images/portrait_102.png",
      "images/portrait_103.png",
      "images/portrait_104.png",
    ]);
  });
});

describe("buildPortraitPublishPlan", function () {
  it("uploads only new or changed portraits and retains removed ones for historical releases", () => {
    const currentPortraits: PortraitPublishEntry[] = [
      {
        objectKey: "images/portrait_100.png",
        filePath: "D:/Dokkan/DokkanWebScraper/data/images/portrait_100.png",
        sha256: "same-hash",
      },
      {
        objectKey: "images/portrait_101.png",
        filePath: "D:/Dokkan/DokkanWebScraper/data/images/portrait_101.png",
        sha256: "new-hash",
      },
    ];

    const previousState: DatasetPublishState = {
      schemaVersion: 1,
      bucket: "dokkanpanion-data",
      target: "remote",
      datasetVersion: "2026-06-24T00:00:00.000Z",
      datasetObjectKey: "releases/2026-06-24T00-00-00.000Z/characters.json.gz",
      manifestSha256: "manifest-hash",
      publishedAt: "2026-06-24T00:00:00.000Z",
      portraits: {
        "images/portrait_100.png": "same-hash",
        "images/portrait_101.png": "old-hash",
        "images/portrait_099.png": "removed-hash",
      },
    };

    const plan = buildPortraitPublishPlan(currentPortraits, previousState);

    deepEqual(plan.toUpload.map(entry => entry.objectKey), ["images/portrait_101.png"]);
    deepEqual(plan.toDelete, []);
  });

  it("forces all current portraits when requested", () => {
    const currentPortraits: PortraitPublishEntry[] = [
      {
        objectKey: "images/portrait_100.png",
        filePath: "D:/Dokkan/DokkanWebScraper/data/images/portrait_100.png",
        sha256: "same-hash",
      },
      {
        objectKey: "images/portrait_101.png",
        filePath: "D:/Dokkan/DokkanWebScraper/data/images/portrait_101.png",
        sha256: "new-hash",
      },
    ];

    const previousState: DatasetPublishState = {
      schemaVersion: 1,
      bucket: "dokkanpanion-data",
      target: "remote",
      datasetVersion: "2026-06-24T00:00:00.000Z",
      datasetObjectKey: "releases/2026-06-24T00-00-00.000Z/characters.json.gz",
      manifestSha256: "manifest-hash",
      publishedAt: "2026-06-24T00:00:00.000Z",
      portraits: {
        "images/portrait_100.png": "same-hash",
        "images/portrait_101.png": "new-hash",
      },
    };

    const plan = buildPortraitPublishPlan(currentPortraits, previousState, { forcePortraits: true });

    equal(plan.toUpload.length, 2);
    deepEqual(plan.toDelete, []);
  });
});
