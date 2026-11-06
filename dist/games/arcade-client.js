(() => {
  const pending = new Map();
  function newId() {
    if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    // getRandomValues is also available on local HTTP and opaque sandbox origins.
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
  }
  window.CWArcade = (game, action, data = {}) => new Promise((resolve, reject) => {
    const key = newId();
    const timer = setTimeout(() => {
      pending.delete(key);
      reject(Error('Connection timed out. Refresh to recover your bet.'));
    }, 15000);
    pending.set(key, { resolve, reject, timer });
    parent.postMessage({ type: 'cw-arcade-request', game, action, data, key }, '*');
  });
  window.CWArcade.newId = newId;
  window.addEventListener('message', event => {
    if (event.source !== parent || event.data?.type !== 'cw-arcade-response') return;
    const request = pending.get(event.data.key);
    if (!request) return;
    pending.delete(event.data.key);
    clearTimeout(request.timer);
    event.data.error ? request.reject(Error(event.data.error)) : request.resolve(event.data.result);
  });
})();
