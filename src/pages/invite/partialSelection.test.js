import test from 'node:test';
import assert from 'node:assert/strict';
import { partialSelectionChanged, sameIdSet } from './partialSelection.js';

test('same ids in a different order are equal', () => {
  assert.equal(sameIdSet(['b', 'a'], ['a', 'b']), true);
});

test('an extra or missing id is a change', () => {
  assert.equal(partialSelectionChanged(['a', 'b'], ['a']), true);
  assert.equal(partialSelectionChanged(['a'], ['a', 'b']), true);
});

test('saving ceremonies without reticking is not a change', () => {
  assert.equal(partialSelectionChanged(['fn-1', 'fn-2'], ['fn-2', 'fn-1']), false);
});

test('unsaved or empty ticks are not pushed', () => {
  assert.equal(partialSelectionChanged(['new-abc'], ['fn-1']), false);
  assert.equal(partialSelectionChanged([], ['fn-1']), false);
  assert.equal(partialSelectionChanged(['new-abc', 'fn-1'], ['fn-1']), false);
});
