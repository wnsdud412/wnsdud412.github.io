import test from 'node:test';
import assert from 'node:assert/strict';
import { measureLyricCues } from '../assets/markdown.js';

const cell = (textContent, colSpan = 1) => ({ textContent, colSpan, childElementCount: 0 });

test('dense lyrics retain source order without added annotations', () => {
  const lyrics = Array.from({ length: 16 }, (_, index) => cell(`음절${index}`));
  const cues = measureLyricCues(lyrics, 0, 16);
  assert.deepEqual(cues, Array.from({ length: 16 }, (_, index) => ({ index })));
});

test('half, triplet and quarter beat starts produce only source fragments', () => {
  for (const [columns, offset] of [[2, 1], [3, 1], [3, 2], [4, 1], [4, 3]]) {
    const lyrics = [cell('', offset), cell('시작', columns - offset)];
    assert.deepEqual(measureLyricCues(lyrics, 0, columns), [{ index: 1 }]);
  }
});

test('lyrics spanning bar lines appear exactly once', () => {
  const lyrics = [cell('긴 앞 가사', 20), cell('뒷 가사', 12)];
  const first = measureLyricCues(lyrics, 0, 16);
  const second = measureLyricCues(lyrics, 16, 32);
  assert.deepEqual(first.map(cue => cue.index), [0]);
  assert.deepEqual(second.map(cue => cue.index), [1]);
});

test('silent bars remain empty and original whitespace is preserved', () => {
  assert.deepEqual(measureLyricCues([cell('', 9)], 0, 9), []);
  assert.deepEqual(measureLyricCues([cell(' ', 1), cell('가사', 8)], 0, 9), [{ index: 0 }, { index: 1 }]);
});
