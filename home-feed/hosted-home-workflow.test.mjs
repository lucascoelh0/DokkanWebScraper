import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflow = readFileSync(new URL('../.github/workflows/home-feed-refresh.yml', import.meta.url), 'utf8');
const refresh = workflow.split('      - name: Refresh\n')[1];

test('Home rollout documents do not trigger unrelated package publication', () => {
  const pipeline = readFileSync(new URL('../.github/workflows/pipeline.yml', import.meta.url), 'utf8');
  const ignored = pipeline.split('    paths-ignore:')[1]?.split('  workflow_dispatch:')[0];
  for (const path of ['docs/home-news-login-summon-plan.md', 'docs/home-refresh-rollout.md', 'docs/home-news-presentation-contract.md'])
    assert.ok(ignored?.includes(`- '${path}'`));
});

test('hosted refresh passes optional news/events flags without hardcoded activation', () => {
  assert.ok(refresh);
  for (const name of ['HOME_FEED_NEWS_ENABLED', 'HOME_FEED_EVENTS_ENABLED', 'HOME_FEED_EVENTS_CATALOG_SHA256', 'HOME_FEED_NEWS_LIBRARY_ENABLED', 'NEWS_GATEWAY_URL']) {
    assert.ok(refresh.includes(`${name}: ${'${{'} vars.${name} }}`), name);
    assert.equal(refresh.match(new RegExp(`^\\s+${name}:`, 'gm'))?.length, 1);
  }
});

test('hosted refresh preserves isolated credentials, main gate and single-flight schedule', () => {
  assert.match(workflow, /contents: read/);
  assert.match(workflow, /persist-credentials: false/);
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /group: staging-home-feed-refresh\s+cancel-in-progress: false/);
  assert.match(workflow, /cron: '23 \* \* \* \*'/);
  const tests = workflow.slice(workflow.indexOf('      - name: Test without credentials'), workflow.indexOf('      - name: Check campaign gateway'));
  assert.ok(tests.includes('npm test'));
  assert.equal(tests.includes('secrets.'), false);
  assert.ok(refresh.includes('if: inputs.check_campaigns != true'));
  assert.equal(workflow.includes('actions/upload-artifact'), false);
});
