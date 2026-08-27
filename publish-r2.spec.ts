import { createHash } from "crypto";
import { deepEqual, equal, rejects, throws } from "assert";
import { mkdtemp, mkdir, rm, writeFile } from "fs/promises";
import { describe, it } from "mocha";
import { tmpdir } from "os";
import { dirname, resolve } from "path";
import { gzipSync } from "zlib";
import {
  assertPortraitPublicationMode,
  buildPortraitEntries,
  buildPortraitPublishPlan,
  buildCharacterManifestObjectKey,
  buildRemoteDatasetObjectKey,
  assertExpectedRemoteBaselineSha256,
  collectReferencedPortraitReferences,
  collectReferencedPortraitKeys,
  DatasetPublishState,
  parsePublishArgs,
  parseWranglerBucketSize,
  PortraitPublishEntry,
  isMissingR2ObjectError,
  isRetryableR2ReadError,
  verifyReusablePortraitEntries,
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

  it("accepts an already-scoped local candidate payload key only for its exact channel and lane", () => {
    const manifest = {
      datasetVersion: "2026-08-26T20:58:47.619Z",
      sha256: "a".repeat(64),
      fileName: `staging/v2/releases/2026-08-26T20-58-47.619Z/${"a".repeat(64)}/characters.json.gz`,
    } as any;
    equal(buildRemoteDatasetObjectKey(manifest, "staging", "v2"), manifest.fileName);
    throws(
      () => buildRemoteDatasetObjectKey(manifest, "staging", "v1"),
      /filename is invalid/,
    );
    throws(
      () => buildRemoteDatasetObjectKey(manifest, "production", "v2"),
      /filename is invalid/,
    );
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

describe("remote object read classification", function () {
  it("treats only an explicit missing-object result as absent", () => {
    equal(isMissingR2ObjectError(new Error("R2 object not found (404)")), true);
    equal(isMissingR2ObjectError(new Error("The specified key does not exist")), true);
    equal(isMissingR2ObjectError(new Error("authentication failed")), false);
    equal(isMissingR2ObjectError(new Error("Wrangler entrypoint was not found")), false);
    equal(isMissingR2ObjectError(new Error("malformed JSON")), false);
  });

  it("retries only bounded transient R2 read failures", () => {
    equal(isRetryableR2ReadError(new Error("429: Too Many Requests")), true);
    equal(isRetryableR2ReadError(new Error("503 Service Unavailable")), true);
    equal(isRetryableR2ReadError(new Error("ECONNRESET")), true);
    equal(isRetryableR2ReadError(new Error("authentication failed")), false);
    equal(isRetryableR2ReadError(new Error("malformed JSON")), false);
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

  it("uses isolated portrait state for staging without requiring portraits to be skipped", () => {
    const stagedWithPortraits = parsePublishArgs([
      "--bucket", "test",
      "--contract-lane", "v2",
      "--channel", "staging",
    ]);
    equal(stagedWithPortraits.skipPortraits, false);
    equal(stagedWithPortraits.statePath.endsWith("r2-publish-state-staging-v2.json"), true);
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

  it("collects typed layers from base cards, transformations and every awakening direction", () => {
    const references = collectReferencedPortraitReferences([{
      portraitURL: "staging/v2/images/v4/portrait_100." + "1".repeat(64) + ".png",
      portraitLayers: {
        backgroundURL: "staging/v2/images/v5/layers/background." + "2".repeat(64) + ".png",
        thumbURL: "staging/v2/images/v5/layers/thumb." + "3".repeat(64) + ".png",
        overlayURL: "staging/v2/images/v5/layers/overlay." + "4".repeat(64) + ".png",
      },
      transformations: [{
        portraitURL: "images/portrait_transformation.png",
        portraitLayers: {
          backgroundURL: "staging/v2/images/v5/layers/background." + "5".repeat(64) + ".png",
          thumbURL: "staging/v2/images/v5/layers/thumb." + "6".repeat(64) + ".png",
          overlayURL: "staging/v2/images/v5/layers/overlay." + "7".repeat(64) + ".png",
        },
      }],
      awakeningCards: [{
        portraitURL: "images/portrait_awakening.png",
        portraitLayers: {
          backgroundURL: "staging/v2/images/v5/layers/background." + "8".repeat(64) + ".png",
          thumbURL: "staging/v2/images/v5/layers/thumb." + "9".repeat(64) + ".png",
          overlayURL: "staging/v2/images/v5/layers/overlay." + "a".repeat(64) + ".png",
        },
      }],
      previousAwakenings: [{
        portraitURL: "images/portrait_previous.png",
        portraitLayers: {
          backgroundURL: "staging/v2/images/v5/layers/background." + "b".repeat(64) + ".png",
          thumbURL: "staging/v2/images/v5/layers/thumb." + "c".repeat(64) + ".png",
          overlayURL: "staging/v2/images/v5/layers/overlay." + "d".repeat(64) + ".png",
        },
      }],
      nextAwakenings: [{
        portraitURL: "images/portrait_next.png",
        portraitLayers: {
          backgroundURL: "staging/v2/images/v5/layers/background." + "e".repeat(64) + ".png",
          thumbURL: "staging/v2/images/v5/layers/thumb." + "f".repeat(64) + ".png",
          overlayURL: "staging/v2/images/v5/layers/overlay." + "0".repeat(64) + ".png",
        },
      }],
    }] as any);

    equal(references.length, 20);
    equal(references.filter(reference => reference.layerKind).length, 15);
    equal(references.some(reference => reference.layerKind === "background"), true);
    equal(references.some(reference => reference.layerKind === "thumb"), true);
    equal(references.some(reference => reference.layerKind === "overlay"), true);
  });

  it("fails closed when typed layers would be skipped", () => {
    assertPortraitPublicationMode([{ portraitURL: "images/portrait.png" }] as any, true);
    throws(
      () => assertPortraitPublicationMode([{
        portraitURL: "images/portrait.png",
        portraitLayers: {
          backgroundURL: "background.png",
          thumbURL: "thumb.png",
          overlayURL: "overlay.png",
        },
      }] as any, true),
      /cannot be used.*portraitLayers/,
    );
  });

  it("rejects incomplete typed layer contracts and conflicting static/layer reuse", () => {
    throws(
      () => collectReferencedPortraitReferences([{
        portraitURL: "images/portrait.png",
        portraitLayers: { backgroundURL: "background.png", thumbURL: "thumb.png" },
      }] as any),
      /must provide non-empty backgroundURL, thumbURL, and overlayURL/,
    );
    throws(
      () => collectReferencedPortraitReferences([{
        portraitURL: "same.png",
        portraitLayers: {
          backgroundURL: "same.png",
          thumbURL: "thumb.png",
          overlayURL: "overlay.png",
        },
      }] as any),
      /conflicting static\/layer kinds/,
    );
  });
});

describe("buildPortraitEntries", function () {
  async function withTempRoot(task: (root: string) => Promise<void>): Promise<void> {
    const root = await mkdtemp(resolve(tmpdir(), "dokkan-portrait-publish-test-"));
    try {
      await task(root);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }

  it("validates channel-scoped static and typed layer objects against their embedded hashes", async () => {
    await withTempRoot(async root => {
      const staticBytes = Buffer.from("static portrait");
      const layerBytes = Buffer.from("transparent layer");
      const staticHash = createHash("sha256").update(staticBytes).digest("hex");
      const layerHash = createHash("sha256").update(layerBytes).digest("hex");
      const staticKey = `staging/v2/images/v4/portrait_100.${staticHash}.png`;
      const layerKey = `staging/v2/images/v5/layers/thumb.${layerHash}.png`;
      for (const [key, bytes] of [[staticKey, staticBytes], [layerKey, layerBytes]] as const) {
        const path = resolve(root, ...key.split("/"));
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, bytes);
      }

      const entries = await buildPortraitEntries([
        { objectKey: staticKey },
        { objectKey: layerKey, layerKind: "thumb" },
      ], root, { channel: "staging", contractLane: "v2" });
      deepEqual(entries.map(entry => entry.objectKey), [staticKey, layerKey]);
      deepEqual(entries.map(entry => entry.sha256), [staticHash, layerHash]);
    });
  });

  it("rejects cross-channel, cross-lane, malformed, missing, mismatched and traversing objects", async () => {
    await withTempRoot(async root => {
      const bytes = Buffer.from("portrait");
      const hash = createHash("sha256").update(bytes).digest("hex");
      const wrongLane = `staging/v1/images/v5/layers/thumb.${hash}.png`;
      const wrongChannel = `v2/images/v5/layers/thumb.${hash}.png`;
      const wrongKind = `staging/v2/images/v5/layers/background.${hash}.png`;
      const wrongHash = `staging/v2/images/v5/layers/thumb.${"0".repeat(64)}.png`;
      const wrongHashPath = resolve(root, ...wrongHash.split("/"));
      await mkdir(dirname(wrongHashPath), { recursive: true });
      await writeFile(wrongHashPath, bytes);

      for (const objectKey of [wrongLane, wrongChannel]) {
        await rejects(
          buildPortraitEntries([{ objectKey, layerKind: "thumb" }], root, {
            channel: "staging",
            contractLane: "v2",
          }),
          /does not belong/,
        );
      }
      await rejects(
        buildPortraitEntries([{ objectKey: wrongKind, layerKind: "thumb" }], root, {
          channel: "staging",
          contractLane: "v2",
        }),
        /Malformed thumb portrait layer key/,
      );
      await rejects(
        buildPortraitEntries([{ objectKey: wrongHash, layerKind: "thumb" }], root, {
          channel: "staging",
          contractLane: "v2",
        }),
        /SHA-256 mismatch/,
      );
      await rejects(
        buildPortraitEntries([{
          objectKey: `staging/v2/images/v5/layers/thumb.${hash}.png`,
          layerKind: "thumb",
        }], root, { channel: "staging", contractLane: "v2" }),
        /Missing portrait file/,
      );
      await rejects(
        buildPortraitEntries(["images/portrait_legacy.png"], root, {
          channel: "staging",
          contractLane: "v2",
        }),
        /not channel\/lane scoped/,
      );
      await rejects(
        buildPortraitEntries(["../outside.png"], root),
        /Unsafe portrait object key/,
      );
    });
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

  it("reuses state entries only after exact remote size and SHA verification", async () => {
    const root = await mkdtemp(resolve(tmpdir(), "dokkan-portrait-reuse-test-"));
    try {
      const exactBytes = Buffer.from("exact");
      const corruptBytes = Buffer.from("wrong");
      const exactPath = resolve(root, "exact.png");
      const missingPath = resolve(root, "missing.png");
      const corruptPath = resolve(root, "corrupt.png");
      await writeFile(exactPath, exactBytes);
      await writeFile(missingPath, exactBytes);
      await writeFile(corruptPath, exactBytes);
      const exactHash = createHash("sha256").update(exactBytes).digest("hex");
      const entries: PortraitPublishEntry[] = [
        { objectKey: "exact", filePath: exactPath, sha256: exactHash },
        { objectKey: "missing", filePath: missingPath, sha256: exactHash },
        { objectKey: "corrupt", filePath: corruptPath, sha256: exactHash },
      ];
      const state = {
        schemaVersion: 1,
        bucket: "test",
        target: "remote",
        datasetVersion: "test",
        datasetObjectKey: "test",
        manifestSha256: exactHash,
        publishedAt: "2026-08-26T00:00:00.000Z",
        portraits: { exact: exactHash, missing: exactHash, corrupt: exactHash },
      } as DatasetPublishState;
      const reusable = await verifyReusablePortraitEntries(entries, state, async entry => {
        if (entry.objectKey === "missing") return undefined;
        if (entry.objectKey === "corrupt") return corruptBytes;
        return exactBytes;
      }, 2);
      deepEqual(reusable, { exact: exactHash });
      deepEqual(
        buildPortraitPublishPlan(entries, { ...state, portraits: reusable }).toUpload.map(entry => entry.objectKey),
        ["corrupt", "missing"],
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
