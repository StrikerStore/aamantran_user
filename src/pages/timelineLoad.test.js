import test from 'node:test';
import assert from 'node:assert/strict';
import { timelineLoadResult } from './timelineLoad.js';

test('a response that arrives after switching ceremonies is ignored', () => {
  const haldi = [{ id: '1', functionId: 'haldi', title: 'Guests arrive' }];
  assert.equal(timelineLoadResult(false, 'event-a', 'haldi', haldi), null);
});

test('only the ceremony that was requested is shown', () => {
  const next = timelineLoadResult(true, 'event-a', 'wedding', [
    { id: '1', functionId: 'haldi', title: 'Haldi dinner' },
    { id: '2', functionId: 'wedding', title: 'Pheras' },
  ]);
  assert.deepEqual(next.entries.map((e) => e.title), ['Pheras']);
  assert.deepEqual(next.entriesFor, { eventId: 'event-a', functionId: 'wedding' });
});

test('a failed load still settles on that ceremony so the spinner does not stick', () => {
  const next = timelineLoadResult(true, 'event-a', 'wedding', null);
  assert.deepEqual(next, {
    entries: [],
    entriesFor: { eventId: 'event-a', functionId: 'wedding' },
  });
});
