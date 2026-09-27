import test from 'node:test';
import assert from 'node:assert/strict';
import { eventIdToRemember } from './activeEvent.js';

test('an event page remembers that invitation for Home', () => {
  assert.equal(eventIdToRemember('event-b', ['event-a', 'event-b']), 'event-b');
});

test('global pages do not clear the invitation already stored', () => {
  assert.equal(eventIdToRemember(null, ['event-a', 'event-b']), null);
});

test('a second-link id is not treated as the invitation to show on Home', () => {
  assert.equal(eventIdToRemember('subset-b', ['event-a', 'event-b']), null);
});

test('nothing is stored before the invitation list has loaded', () => {
  assert.equal(eventIdToRemember('event-b', []), null);
});
