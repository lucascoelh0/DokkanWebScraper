import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { collectSummons } from "./collect-summons.mjs";

const NOW = new Date("2026-09-12T12:00:00.000Z");
const NOW_SECONDS = NOW.getTime() / 1_000;

function png(width = 1_200, height = 500, size = 24) {
  const value = Buffer.alloc(size);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(value);
  value.writeUInt32BE(13, 8);
  value.write("IHDR", 12, "ascii");
  value.writeUInt32BE(width, 16);
  value.writeUInt32BE(height, 20);
  return value;
}

function banner(overrides = {}) {
  return {
    id: 123,
    name: "Worldwide Celebration",
    gasha_category_id: 77,
    open_at: NOW_SECONDS - 60,
    end_at: NOW_SECONDS + 60,
    banner_url:
      "https://cf.ishin-global.aktsk.com/banners/en/gashasocool/banner_123.png?Policy=private-signed-value&Signature=hidden",
    account_field: "must-not-survive",
    ...overrides,
  };
}

function adapters(rows, options = {}) {
  const apiCalls = [];
  const imageCalls = [];
  const image = options.image ?? png();
  return {
    apiCalls,
    imageCalls,
    now: () => new Date(NOW),
    requestApi: async (path) => {
      apiCalls.push(path);
      if (options.apiFailurePath === path) {
        throw new Error("Authorization: Bearer raw-private-token");
      }
      if (path === "/gashas") {
        return { status: options.gashasStatus ?? 200, body: { gashas: rows, private: "hidden" } };
      }
      const id = Number(path.split("/")[2]);
      return {
        status: options.featuredStatus ?? 200,
        body: options.featuredBody ?? {
          gasha_items: [{ card_id: id + 1, account_note: "hidden" }],
          access_token: "hidden",
        },
      };
    },
    fetchImage: async (url) => {
      imageCalls.push(url);
      if (options.imageFailure) {
        throw new Error(`failed URL ${url}`);
      }
      return { status: options.imageStatus ?? 200, body: image };
    },
  };
}

async function rejectsCleanly(run) {
  await assert.rejects(run, (error) => {
    assert.equal(error.message, "summons_collection_failed");
    assert.equal(error.cause, undefined);
    assert.doesNotMatch(String(error), /private|token|Policy|Signature|failed URL/i);
    return true;
  });
}

test("collects active banners, public featured IDs, receipts, and content-addressed PNGs", async () => {
  const activeUnknownCategory = banner({ gasha_category_id: 9_876_543_210 });
  const io = adapters([activeUnknownCategory]);
  const result = await collectSummons(io);
  const bytes = png();
  const sha256 = createHash("sha256").update(bytes).digest("hex");

  assert.deepEqual(io.apiCalls, ["/gashas", "/gashas/123/featured_cards"]);
  assert.equal(io.imageCalls.length, 1);
  assert.match(io.imageCalls[0], /Policy=private-signed-value/);
  assert.deepEqual(result.snapshot, {
    source: "authorized_manual_global_gashas_read",
    observedAt: NOW.toISOString(),
    coverage: "account_observation_not_complete_global_inventory",
    banners: [
      {
        id: 123,
        name: "Worldwide Celebration",
        gasha_category_id: 9_876_543_210,
        open_at: NOW_SECONDS - 60,
        end_at: NOW_SECONDS + 60,
        imageHost: "cf.ishin-global.aktsk.com",
        imagePath: "/banners/en/gashasocool/banner_123.png",
      },
    ],
  });
  assert.deepEqual(result.receipts, [
    {
      bannerId: 123,
      sha256,
      sizeBytes: 24,
      width: 1_200,
      height: 500,
      sourcePath: "/banners/en/gashasocool/banner_123.png",
    },
  ]);
  assert.deepEqual(result.featuredResponses, [
    {
      path: "/gashas/123/featured_cards",
      status: 200,
      error: null,
      observedAt: NOW.toISOString(),
      publicIds: { gasha_items: [{ card_id: 124 }] },
    },
  ]);
  assert.deepEqual([...result.images.keys()], [`${sha256}.png`]);
  assert.deepEqual(result.images.get(`${sha256}.png`), bytes);
});

test("excludes expired and not-yet-open rows without requesting their details or images", async () => {
  const io = adapters([
    banner({ id: 1, end_at: NOW_SECONDS }),
    banner({ id: 2, open_at: NOW_SECONDS + 1, end_at: NOW_SECONDS + 100 }),
  ]);
  const result = await collectSummons(io);

  assert.deepEqual(result.snapshot.banners, []);
  assert.deepEqual(result.featuredResponses, []);
  assert.deepEqual(result.receipts, []);
  assert.equal(result.images.size, 0);
  assert.deepEqual(io.apiCalls, ["/gashas"]);
  assert.deepEqual(io.imageCalls, []);
});

test("fails the whole collection once on transport, non-200, and malformed response failures", async () => {
  await rejectsCleanly(() => collectSummons(adapters([banner()], { apiFailurePath: "/gashas/123/featured_cards" })));
  await rejectsCleanly(() => collectSummons(adapters([banner()], { gashasStatus: 503 })));
  await rejectsCleanly(() => collectSummons(adapters([banner()], { featuredBody: { gasha_items: "nope" } })));
  await rejectsCleanly(() => collectSummons(adapters([banner()], { imageStatus: 302 })));
  await rejectsCleanly(() => collectSummons(adapters([banner()], { imageFailure: true })));
});

test("rejects SSRF-capable or non-allowlisted banner URLs before image access", async () => {
  const unsafe = [
    "http://cf.ishin-global.aktsk.com/banners/en/gashasocool/a.png?sig=x",
    "https://example.com/banners/en/gashasocool/a.png?sig=x",
    "https://user:pass@cf.ishin-global.aktsk.com/banners/en/gashasocool/a.png?sig=x",
    "https://@cf.ishin-global.aktsk.com/banners/en/gashasocool/a.png?sig=x",
    "https://cf.ishin-global.aktsk.com/banners/en/gashasocool/a.png?sig=x#fragment",
    "https://cf.ishin-global.aktsk.com/banners/en/gashasocool/a.png?sig=x#",
    "https://cf.ishin-global.aktsk.com/banners/en/gashasocool/%2e%2e/a.png?sig=x",
    "https://cf.ishin-global.aktsk.com/banners/en/gashasocool/nested/a.png?sig=x",
    "https://cf.ishin-global.aktsk.com/other/a.png?sig=x",
    "https://cf.ishin-global.aktsk.com.evil.test/banners/en/gashasocool/a.png?sig=x",
  ];

  for (const bannerUrl of unsafe) {
    const io = adapters([banner({ banner_url: bannerUrl })]);
    await rejectsCleanly(() => collectSummons(io));
    assert.deepEqual(io.imageCalls, []);
  }
});

test("rejects duplicate banner IDs and more than forty active banners", async () => {
  await rejectsCleanly(() => collectSummons(adapters([banner(), banner({ name: "Duplicate" })])));

  const rows = Array.from({ length: 41 }, (_, index) =>
    banner({
      id: index + 1,
      banner_url: `https://cf.ishin-global.aktsk.com/banners/en/gashasocool/${index + 1}.png?sig=x`,
    }),
  );
  const io = adapters(rows);
  await rejectsCleanly(() => collectSummons(io));
  assert.deepEqual(io.apiCalls, ["/gashas"]);
  assert.deepEqual(io.imageCalls, []);
});

test("bounds banner and featured IDs, rejects duplicate cards, and caps featured items at one hundred", async () => {
  for (const id of [0, 1_000_000_000, 1.5]) {
    await rejectsCleanly(() => collectSummons(adapters([banner({ id })])));
  }
  for (const card_id of [0, 1_000_000_000, 1.5]) {
    await rejectsCleanly(() =>
      collectSummons(adapters([banner()], { featuredBody: { gasha_items: [{ card_id }] } })),
    );
  }
  await rejectsCleanly(() =>
    collectSummons(
      adapters([banner()], {
        featuredBody: {
          gasha_items: Array.from({ length: 101 }, (_, index) => ({ card_id: index + 1 })),
        },
      }),
    ),
  );
  await rejectsCleanly(() =>
    collectSummons(
      adapters([banner()], {
        featuredBody: { gasha_items: [{ card_id: 1 }, { card_id: 1 }] },
      }),
    ),
  );
});

test("caps banner names at one hundred characters", async () => {
  const accepted = await collectSummons(adapters([banner({ name: "x".repeat(100) })]));
  assert.equal(accepted.snapshot.banners[0].name.length, 100);
  await rejectsCleanly(() => collectSummons(adapters([banner({ name: "x".repeat(101) })])));
});

test("bounds PNG bytes, framing, dimensions, and pixel count", async () => {
  const invalidImages = [
    Buffer.alloc(23),
    Buffer.alloc(2 * 1024 * 1024 + 1),
    png(0, 100),
    png(8_193, 1),
    png(4_001, 4_000),
    (() => {
      const value = png();
      value.write("NOPE", 12, "ascii");
      return value;
    })(),
  ];
  for (const image of invalidImages) {
    await rejectsCleanly(() => collectSummons(adapters([banner()], { image })));
  }
});

test("does not expose signed queries, account fields, tokens, raw bodies, or adapter exceptions", async () => {
  const result = await collectSummons(adapters([banner()]));
  const publicText = JSON.stringify({
    snapshot: result.snapshot,
    receipts: result.receipts,
    featuredResponses: result.featuredResponses,
    imageKeys: [...result.images.keys()],
  });

  assert.doesNotMatch(publicText, /private-signed-value|Signature|account_field|account_note|access_token|hidden/);
  assert.deepEqual(Object.keys(result), ["snapshot", "receipts", "images", "featuredResponses"]);

  await rejectsCleanly(() =>
    collectSummons({
      requestApi: async () => {
        throw new Error("raw body with Bearer raw-private-token");
      },
      fetchImage: async () => png(),
      now: () => new Date(NOW),
    }),
  );
});
