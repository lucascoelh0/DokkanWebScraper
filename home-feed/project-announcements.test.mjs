import { test } from "node:test";
import assert from "node:assert/strict";
import { projectAnnouncements, projectAnnouncementBody } from "./project-announcements.mjs";

const row = (overrides = {}) => ({ id: 1, category: 0, title: "News\r\n title", summary: "Summary",
  start_at: 100, banner: "https://cf.ishin-global.aktsk.com/banners/en/news/sample.png?signature=PRIVATE",
  is_new: true, link_to: "private", account: "PRIVATE", ...overrides });
const project = (...rows) => projectAnnouncements({ announcements: rows, account: "PRIVATE" });

test("whitelists public fields and drops signed queries and account state", () => {
  const result = project(row());
  assert.deepEqual(result.announcements[0], { id: 1, category: 0, title: "News title", summary: "Summary",
    startsAt: 100, image: { host: "cf.ishin-global.aktsk.com", path: "/banners/en/news/sample.png" } });
  assert.ok(!JSON.stringify(result).includes("PRIVATE"));
  assert.equal(result.coverage, "account_observation_not_complete_global_inventory");
});
test("sorts newest first with stable ID tie and allows missing art", () => {
  assert.deepEqual(project(row(), row({ id: 2, start_at: 200, banner: null }), row({ id: 3, start_at: 200 }))
    .announcements.map(x => x.id), [3, 2, 1]);
});
test("rejects malformed and duplicate input without echoing private values", () => {
  for (const input of [{}, { announcements: null }, { announcements: [row(), row()] },
    { announcements: [row({ title: "<script>PRIVATE</script>" })] },
    { announcements: [row({ start_at: NaN })] }, { announcements: Array(501).fill(row()) }]) {
    assert.throws(() => projectAnnouncements(input), { message: "Invalid announcements observation" });
  }
});
test("rejects unsafe image origins, credentials, paths and fragments", () => {
  for (const banner of ["http://cf.ishin-global.aktsk.com/banners/en/news/a.png",
    "https://evil.example/banners/en/news/a.png", "https://user@cf.ishin-global.aktsk.com/banners/en/news/a.png",
    "https://cf.ishin-global.aktsk.com/banners/en/news/a.svg",
    "https://cf.ishin-global.aktsk.com/banners/en/news/a.png#PRIVATE"]) {
    assert.throws(() => project(row({ banner })));
  }
});
test("empty observation is not a claim of global completeness", () => {
  assert.deepEqual(project().announcements, []);
  assert.match(project().coverage, /not_complete/);
});

test('article text preserves breaks but rejects markup and mismatched identity', () => {
  assert.deepEqual(projectAnnouncementBody({ announcement: { id: 1, bodies: [{ description: 'First\r\nSecond' }] } }, 1), ['First\nSecond']);
  for (const article of [{ id: 2, bodies: [] }, { id: 1, bodies: [{ description: '<script>private</script>' }] },
    { id: 1, bodies: [{ description: 'a'.repeat(12001) }] }]) {
    assert.throws(() => projectAnnouncementBody({ announcement: article }, 1));
  }
});
