import { test } from 'node:test';
import assert from 'node:assert/strict';
import { subsetCopyToRemove } from './pairedCeremony.js';

const subset = [
  { id: 'sub-mehendi', name: 'Mehendi' },
  { id: 'sub-wedding', name: 'Wedding' },
];

test('removes the one second-link copy of a uniquely named ceremony', () => {
  assert.equal(
    subsetCopyToRemove(subset, 'Mehendi', ['Wedding', 'Reception']),
    'sub-mehendi',
  );
});

test('matches the saved name ignoring case and surrounding spaces', () => {
  assert.equal(
    subsetCopyToRemove(subset, '  wedding ', ['Mehendi']),
    'sub-wedding',
  );
});

test('does nothing when that ceremony was never on the second link', () => {
  assert.equal(subsetCopyToRemove(subset, 'Reception', ['Mehendi', 'Wedding']), null);
});

test('does not guess when two second-link ceremonies share the name', () => {
  const dupes = [
    { id: 'a', name: 'Lunch' },
    { id: 'b', name: 'Lunch' },
  ];
  assert.equal(subsetCopyToRemove(dupes, 'Lunch', []), null);
});

test('does not guess when another main ceremony still uses the name', () => {
  assert.equal(
    subsetCopyToRemove([{ id: 'sub-lunch', name: 'Lunch' }], 'Lunch', ['Lunch']),
    null,
  );
});

test('ignores a blank name and a missing second link', () => {
  assert.equal(subsetCopyToRemove(subset, '   ', []), null);
  assert.equal(subsetCopyToRemove(null, 'Mehendi', []), null);
  assert.equal(subsetCopyToRemove([{ name: 'Mehendi' }], 'Mehendi', []), null);
});
