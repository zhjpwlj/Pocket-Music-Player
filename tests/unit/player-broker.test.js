import { describe, expect, it, vi } from 'vitest';
import { createPool } from '../../src/audio/pool.js';
import { createPlayerBroker } from '../../src/core/player-broker.js';
import { createFakeAudio } from './helpers/fake-audio.js';

const file = () => new Blob(['tone']);
const ref = (id) => ({ id, title: id });

function setup() {
  const createObjectURL = vi.fn((blob) => `blob:${blob.size}-${createObjectURL.mock.calls.length}`);
  const revokeObjectURL = vi.fn();
  const pool = createPool({ createElement: () => createFakeAudio() });
  const blob = {
    createUrl: (blobFile) => ({ url: createObjectURL(blobFile), revoke() {} }),
    assignUrl: (element, blobFile) => {
      const handle = { url: createObjectURL(blobFile), revoke() {} };
      element.src = handle.url;
      element.load();
      return handle;
    },
    revokeElement: (element) => {
      if (element.src) revokeObjectURL(element.src);
    },
  };
  const broker = createPlayerBroker({ pool, blob });
  return { pool, broker, createObjectURL, revokeObjectURL };
}

describe('player broker', () => {
  it('loads a track into the active element', () => {
    const { pool, broker } = setup();
    broker.loadTrack(ref('a'), file());
    expect(pool.audioA.src).toMatch(/^blob:/);
    expect(pool.audioB.src).toBe('');
    expect(broker.getState().state).toBe('loading');
    expect(broker.getState().track.title).toBe('a');
    expect(broker.getCurrentElement()).toBe(pool.audioA);
  });

  it('autoplays after loadedmetadata', () => {
    const { pool, broker } = setup();
    broker.loadTrack(ref('a'), file());
    pool.audioA.dispatchEvent(new Event('loadedmetadata'));
    expect(pool.audioA.playCalls).toBe(1);
    expect(broker.getState().state).toBe('playing');
  });

  it('does not autoplay when disabled', () => {
    const { pool, broker } = setup();
    broker.loadTrack(ref('a'), file(), { autoplay: false });
    pool.audioA.dispatchEvent(new Event('loadedmetadata'));
    expect(pool.audioA.playCalls).toBe(0);
    expect(broker.getState().state).toBe('paused');
  });

  it('pauses the other element when playing', () => {
    const { pool, broker } = setup();
    broker.loadTrack(ref('a'), file());
    pool.audioA.dispatchEvent(new Event('loadedmetadata'));
    broker.swapElement();
    pool.audioB.dispatchEvent(new Event('loadedmetadata'));
    broker.play();
    expect(pool.audioA.paused).toBe(true);
    expect(pool.audioB.playCalls).toBeGreaterThan(1);
  });

  it('swaps elements at the same position and revokes the outgoing URL', () => {
    const { pool, broker, revokeObjectURL } = setup();
    broker.loadTrack(ref('a'), file());
    pool.audioA.currentTime = 12;
    pool.audioA.dispatchEvent(new Event('loadedmetadata'));
    const outgoingUrl = pool.audioA.src;
    broker.swapElement();
    expect(broker.getCurrentElement()).toBe(pool.audioB);
    expect(pool.audioB.src).toMatch(/^blob:/);
    expect(pool.audioB.src).not.toBe(outgoingUrl);
    expect(pool.audioA.src).toBe('');
    expect(revokeObjectURL).toHaveBeenCalledWith(outgoingUrl);
    pool.audioB.dispatchEvent(new Event('loadedmetadata'));
    expect(pool.audioB.currentTime).toBe(12);
    expect(pool.audioB.playCalls).toBe(1);
  });

  it('stays paused after a swap while paused', () => {
    const { pool, broker } = setup();
    broker.loadTrack(ref('a'), file(), { autoplay: false });
    pool.audioA.dispatchEvent(new Event('loadedmetadata'));
    broker.swapElement();
    pool.audioB.dispatchEvent(new Event('loadedmetadata'));
    expect(broker.getState().state).toBe('paused');
    expect(pool.audioB.playCalls).toBe(0);
  });

  it('clamps seek to the duration', () => {
    const { pool, broker } = setup();
    broker.loadTrack(ref('a'), file());
    pool.audioA.duration = 10;
    broker.seek(-2);
    expect(pool.audioA.currentTime).toBe(0);
    broker.seek(99);
    expect(pool.audioA.currentTime).toBe(10);
  });

  it('throttles time-update to about 1Hz', () => {
    const { pool, broker } = setup();
    const events = [];
    broker.subscribe((event) => events.push(event.type));
    broker.loadTrack(ref('a'), file());
    pool.audioA.dispatchEvent(new Event('timeupdate'));
    pool.audioA.dispatchEvent(new Event('timeupdate'));
    expect(events.filter((type) => type === 'time-update')).toHaveLength(1);
  });

  it('reports media errors', () => {
    const { pool, broker } = setup();
    const events = [];
    broker.subscribe((event) => events.push(event.type));
    broker.loadTrack(ref('a'), file());
    pool.audioA.dispatchEvent(new Event('error'));
    expect(broker.getState().state).toBe('error');
    expect(events).toContain('error');
  });

  it('rejects a missing track or blob', () => {
    const { broker } = setup();
    expect(() => broker.loadTrack({ id: 'x' }, file())).toThrow(TypeError);
    expect(() => broker.loadTrack(ref('x'), null)).toThrow(TypeError);
  });
});
