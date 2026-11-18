import test from 'node:test';
import assert from 'node:assert/strict';
import { measureLyricCues } from '../assets/markdown.js';

const cell = (textContent, colSpan = 1) => ({ textContent, colSpan, childElementCount: 0 });

test('dense lyrics retain source order and mark each beat once', () => {
  const chords = Array.from({ length: 4 }, () => cell('', 4));
  const lyrics = Array.from({ length: 16 }, (_, index) => cell(`음절${index}`));
  const cues = measureLyricCues(lyrics, chords, 0, 16);
  assert.deepEqual(cues.map(cue => cue.index), Array.from({ length: 16 }, (_, index) => index));
  assert.deepEqual(cues.filter(cue => cue.beatLabel).map(cue => cue.beatLabel), ['1', '2', '3', '4']);
});

test('lyric starts preserve half, triplet and quarter beat positions', () => {
  for (const [columns, offset, expected] of [[2, 1, '1½'], [3, 1, '1⅓'], [3, 2, '1⅔'], [4, 1, '1¼'], [4, 3, '1¾']]) {
    const lyrics = [cell('', offset), cell('시작', columns - offset)];
    const cues = measureLyricCues(lyrics, [cell('', columns)], 0, columns);
    assert.equal(cues[0].beatLabel, expected);
  }
});

test('lyrics spanning bar lines appear exactly once and beat numbering restarts', () => {
  const chords = Array.from({ length: 8 }, () => cell('', 4));
  const lyrics = [cell('긴 앞 가사', 20), cell('뒷 가사', 12)];
  const first = measureLyricCues(lyrics, chords, 0, 16);
  const second = measureLyricCues(lyrics, chords, 16, 32);
  assert.deepEqual(first.map(cue => cue.index), [0]);
  assert.deepEqual(second.map(cue => cue.index), [1]);
  assert.equal(second[0].beatLabel, '2');
});

test('silent bars remain empty and whitespace does not consume the beat marker', () => {
  const chords = Array.from({ length: 3 }, () => cell('', 3));
  assert.deepEqual(measureLyricCues([cell('', 9)], chords, 0, 9), []);
  const cues = measureLyricCues([cell(' ', 1), cell('가사', 8)], chords, 0, 9);
  assert.equal(cues[0].beatLabel, '');
  assert.equal(cues[1].beatLabel, '1⅓');
});
