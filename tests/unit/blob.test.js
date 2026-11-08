import { describe, expect, it, vi } from 'vitest';
import { createBlobStore } from '../../src/audio/blob.js';
import { createFakeAudio } from './helpers/fake-audio.js';

function setup() {
  const createObjectURL = vi.fn((file) => `blob:${file.size}-${createObjectURL.mock.calls.length}`);
  const revokeObjectURL = vi.fn();
  const warn = vi.fn();
  const store = createBlobStore({ createObjectURL, revokeObjectURL, warn });
  return { store, createObjectURL, revokeObjectURL, warn };
}

const file = () => new Blob(['tone']);

describe('blob store', () => {
  it('creates and revokes a URL once', () => {
    const { store, createObjectURL, revokeObjectURL } = setup();
    const handle = store.createUrl(file());
    expect(handle.url).toBe(createObjectURL.mock.results[0].value);
    store.revokeUrl(handle);
    store.revokeUrl(handle);
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
  });

  it('revokes the previous handle on reassignment', () => {
    const { store, revokeObjectURL } = setup();
    const element = createFakeAudio();
    const first = store.assignUrl(element, file());
    const second = store.assignUrl(element, file());
    expect(element.src).toBe(second.url);
    expect(store.getElementUrl(element)).toBe(second.url);
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith(first.url);
  });

  it('warns on an unknown handle', () => {
    const { store, revokeObjectURL, warn } = setup();
    store.revokeUrl({ url: 'blob:fake', revoke() {} });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).not.toHaveBeenCalled();
  });

  it('keeps creates and revokes balanced across load/swap cycles', () => {
    const { store, createObjectURL, revokeObjectURL } = setup();
    const a = createFakeAudio();
    const b = createFakeAudio();
    for (let i = 0; i < 20; i += 1) {
      store.assignUrl(a, file());
      store.assignUrl(b, file());
      store.revokeElement(a);
      store.revokeElement(b);
    }
    expect(createObjectURL).toHaveBeenCalledTimes(40);
    expect(revokeObjectURL).toHaveBeenCalledTimes(40);
  });
});
