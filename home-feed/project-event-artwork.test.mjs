import test from 'node:test';
import assert from 'node:assert/strict';
import { projectEventArtwork } from './project-event-artwork.mjs';

const url = 'https://cf.ishin-global.aktsk.com/banners/en/event/eve_banner/quest_list_banner_403_1.png';
const payload = (banner_image = url) => ({ events: [{ id: 403, banner_image }], z_battle_stages: [] });

test('projects only public identity and strips signed query/account fields', () => {
  const input = payload(url + '?Signature=private-test&Expires=1');
  input.events[0].lock = { secret: 'account' };
  const result = projectEventArtwork(input);
  assert.deepEqual(result, [{ id: 'event:403',
    imageHost: 'cf.ishin-global.aktsk.com', imagePath: '/banners/en/event/eve_banner/quest_list_banner_403_1.png' }]);
  assert.ok(!JSON.stringify(result).includes('private-test'));
});

test('separates event and Z-Battle namespaces even for equal IDs', () => {
  const input = payload();
  input.z_battle_stages = [{ id: 403, banner_image: url }];
  assert.deepEqual(projectEventArtwork(input).map(x => x.id), ['event:403', 'z-battle:403']);
});

test('missing and invalid optional art degrade without URL guessing', () => {
  for (const value of [null, '', 12, 'http://example.test/a.png', url.replace('cf.ishin-global', 'evil'),
    url.replace('/eve_banner/', '/eve_header/'), url + '#fragment', url.replace('https://', 'https://user@'),
    url.replace('/eve_banner/', '/unused/../eve_banner/'), url.replace('.png', '.svg'),
    url.replace('quest_list', '%71uest_list'), url.replace('.com/', '.com:443/')]) {
    assert.deepEqual(projectEventArtwork(payload(value)), []);
  }
});

test('rejects malformed shape, duplicate identity and unbounded lists with generic errors', () => {
  for (const value of [null, [], {}, { events: [], z_battle_stages: null },
    { events: [{ id: 1 }, { id: 1 }], z_battle_stages: [] },
    { events: [{ id: -1 }], z_battle_stages: [] },
    { events: Array.from({ length: 2001 }, (_, i) => ({ id: i + 1 })), z_battle_stages: [] }]) {
    assert.throws(() => projectEventArtwork(value), { message: 'Invalid event artwork' });
  }
});
