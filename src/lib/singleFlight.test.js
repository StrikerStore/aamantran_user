import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createSingleFlight } from './singleFlight.js';

describe('createSingleFlight', () => {
  it('runs the task once when a second call arrives before the first finishes', async () => {
    const gate = createSingleFlight();
    let runs = 0;
    let release;
    const gateOpen = new Promise((resolve) => { release = resolve; });

    const first = gate(async () => {
      runs += 1;
      await gateOpen;
      return 'saved';
    });
    const second = gate(async () => {
      runs += 1;
      return 'again';
    });

    assert.equal(first, second);
    release();
    assert.equal(await first, 'saved');
    assert.equal(await second, 'saved');
    assert.equal(runs, 1);
  });

  it('allows a new run after the previous one settles', async () => {
    const gate = createSingleFlight();
    const results = [];
    results.push(await gate(async () => 'one'));
    results.push(await gate(async () => 'two'));
    assert.deepEqual(results, ['one', 'two']);
  });

  it('clears the gate after a failure so the next save can run', async () => {
    const gate = createSingleFlight();
    await assert.rejects(gate(async () => { throw new Error('nope'); }));
    assert.equal(await gate(async () => 'ok'), 'ok');
  });
});
