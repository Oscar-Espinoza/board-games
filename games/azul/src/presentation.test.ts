import { test, expect } from 'bun:test';
import { RevisionGate } from './presentation.js';
test('only consecutive accepted revisions animate once', () => {
  const gate = new RevisionGate();
  expect(gate.accept(0, 'a/0', true, {})).toBe(false);
  expect(gate.accept(1, 'a/0', true, {})).toBe(true);
  expect(gate.accept(1, 'a/0', true, {})).toBe(false);
  expect(gate.accept(3, 'a/0', true, {})).toBe(false);
  expect(gate.accept(4, 'a/0', true, {})).toBe(true);
  expect(gate.accept(2, 'a/0', true, {})).toBe(false);
  expect(gate.accept(5, 'a/0', true, {})).toBe(true);
});
test('connection waits for the resumed snapshot; match and seat changes settle', () => {
  const gate = new RevisionGate(),
    old = {};
  gate.accept(5, 'a/0', true, old);
  expect(gate.accept(5, 'a/0', false, old)).toBe(false);
  expect(gate.accept(5, 'a/0', true, old)).toBe(false);
  expect(gate.accept(6, 'a/0', true, {})).toBe(false);
  expect(gate.accept(7, 'a/0', true, {})).toBe(true);
  expect(gate.accept(8, 'b/0', true, {})).toBe(false);
  expect(gate.accept(0, 'b/1', true, {})).toBe(false);
  expect(gate.accept(1, 'b/1', true, {})).toBe(true);
  gate.reset();
  expect(gate.accept(2, 'b/1', true, {})).toBe(false);
});
