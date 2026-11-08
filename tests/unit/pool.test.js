import { describe, expect, it } from 'vitest';
import { createPool } from '../../src/audio/pool.js';
import { createFakeAudio } from './helpers/fake-audio.js';

describe('audio pool', () => {
  it('creates three independent elements', () => {
    const pool = createPool({ createElement: () => createFakeAudio() });
    expect(pool.audioA).not.toBe(pool.audioB);
    expect(pool.audioB).not.toBe(pool.audioLive);
  });

  it('preloads every element and loops for M1 background playback', () => {
    const pool = createPool({ createElement: () => createFakeAudio() });
    for (const element of [pool.audioA, pool.audioB, pool.audioLive]) {
      expect(element.preload).toBe('auto');
      expect(element.loop).toBe(true);
    }
  });

  it('never loads audioLive', () => {
    const pool = createPool({ createElement: () => createFakeAudio() });
    expect(pool.audioLive.src).toBe('');
  });
});
