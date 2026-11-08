// The only module allowed to create or revoke blob URLs.
// One live URL per element; a reassignment revokes the previous handle first.
export function createBlobStore({
  createObjectURL = URL.createObjectURL.bind(URL),
  revokeObjectURL = URL.revokeObjectURL.bind(URL),
  warn = console.warn,
} = {}) {
  const handles = new WeakMap();
  const created = new WeakSet();

  function createUrl(file) {
    const url = createObjectURL(file);
    let live = true;
    const handle = {
      url,
      revoke() {
        if (!live) return;
        live = false;
        revokeObjectURL(url);
      },
    };
    created.add(handle);
    return handle;
  }

  function revokeUrl(handle) {
    if (!handle) return;
    if (!created.has(handle)) {
      warn('revokeUrl called on an unknown handle');
      return;
    }
    handle.revoke();
  }

  function getElementUrl(element) {
    return handles.get(element)?.url ?? null;
  }

  function revokeElement(element) {
    const handle = handles.get(element);
    if (!handle) return;
    handles.delete(element);
    revokeUrl(handle);
  }

  function assignUrl(element, file) {
    revokeElement(element);
    const handle = createUrl(file);
    handles.set(element, handle);
    element.src = handle.url;
    element.load();
    return handle;
  }

  return { createUrl, revokeUrl, assignUrl, revokeElement, getElementUrl };
}

export const blob = createBlobStore();
