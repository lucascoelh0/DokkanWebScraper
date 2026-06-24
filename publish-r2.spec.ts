import { deepEqual, equal } from "assert";
import { describe, it } from "mocha";
import { buildPortraitPublishPlan, collectReferencedPortraitKeys, DatasetPublishState, PortraitPublishEntry } from "./publish-r2";

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
  it("uploads only new or changed portraits and deletes removed ones", () => {
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
    deepEqual(plan.toDelete, ["images/portrait_099.png"]);
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
