import { describe, expect, it } from 'vitest';
import { isNaturalWrap } from '../../src/utils/wrap.js';

describe('isNaturalWrap', () => {
  it('detects a looped element jumping from the end back to the start', () => {
    expect(isNaturalWrap(29.9, 0.1, 30)).toBe(true);
  });

  it('ignores a manual seek from the middle of the track', () => {
    expect(isNaturalWrap(15, 0.1, 30)).toBe(false);
  });

  it('detects a wrap when the first timeupdate lands after one second', () => {
    expect(isNaturalWrap(29.6, 1.2, 30)).toBe(true);
  });

  it('ignores ordinary forward playback', () => {
    expect(isNaturalWrap(29.9, 29.95, 30)).toBe(false);
  });

  it('ignores an unknown duration', () => {
    expect(isNaturalWrap(29.9, 0.1, Number.NaN)).toBe(false);
  });
});
