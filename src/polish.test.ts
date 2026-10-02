import test from 'node:test';
import assert from 'node:assert/strict';
import { countdownMinutes } from './ui.ts';

test('countdown accepts an hour and a minute together', () => {
  assert.equal(countdownMinutes(1, 30), 90);
});

test('countdown keeps the existing twelve-hour limit', () => {
  assert.equal(countdownMinutes(12, 0), 720);
  assert.equal(countdownMinutes(12, 1), null);
});

test('countdown rejects empty and fractional durations', () => {
  assert.equal(countdownMinutes(0, 0), null);
  assert.equal(countdownMinutes(1.5, 0), null);
  assert.equal(countdownMinutes(0, -1), null);
  assert.equal(countdownMinutes(0, 60), null);
});
