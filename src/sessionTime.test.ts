import test from 'node:test';
import assert from 'node:assert/strict';
import { localMinute, resolveEditedEndpoint } from './sessionTime.ts';

test('minute editor preserves an untouched historical endpoint', () => {
  const original = new Date(2026, 8, 29, 9, 12, 34, 567).getTime();
  const shown = localMinute(original);
  assert.equal(shown, '2026-09-29T09:12');
  assert.equal(resolveEditedEndpoint(shown, original), original);
});

test('changing an endpoint records the selected minute exactly', () => {
  const original = new Date(2026, 8, 29, 9, 12, 34, 567).getTime();
  assert.equal(resolveEditedEndpoint('2026-09-29T10:20', original), new Date(2026, 8, 29, 10, 20).getTime());
  assert.equal(resolveEditedEndpoint('2026-09-29T11:15', null), new Date(2026, 8, 29, 11, 15).getTime());
});
test('an endpoint changed back to its displayed minute is still an edit', () => {
  const original = new Date('2026-09-29T09:12:34.567').getTime();
  assert.equal(resolveEditedEndpoint('2026-09-29T09:12', original, true), new Date('2026-09-29T09:12').getTime());
});
