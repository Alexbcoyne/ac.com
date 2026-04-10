const STATE_KEY = 'site-status';

function buildCacheKey() {
  // Use a static URL so the cache key is consistent across all endpoints
  return new Request('http://internal/__health-state');
}

export async function getHealthState(context) {
  const kv = context.env?.HEALTH_TOGGLE_KV;

  if (kv && typeof kv.get === 'function') {
    const value = await kv.get(STATE_KEY);
    if (value === 'down' || value === 'up') {
      return { state: value, source: 'kv' };
    }
    return { state: 'up', source: 'kv-default' };
  }

  if (typeof caches !== 'undefined' && caches.default) {
    const cacheKey = buildCacheKey();
    const cached = await caches.default.match(cacheKey);
    if (cached) {
      const value = await cached.text();
      if (value === 'down' || value === 'up') {
        return { state: value, source: 'cache' };
      }
    }
    return { state: 'up', source: 'cache-default' };
  }

  return { state: 'up', source: 'default' };
}

export async function setHealthState(context, state) {
  if (state !== 'up' && state !== 'down') {
    throw new Error("State must be 'up' or 'down'.");
  }

  const kv = context.env?.HEALTH_TOGGLE_KV;
  if (kv && typeof kv.put === 'function') {
    await kv.put(STATE_KEY, state);
    return 'kv';
  }

  if (typeof caches !== 'undefined' && caches.default) {
    const cacheKey = buildCacheKey();
    const response = new Response(state, {
      headers: {
        'Cache-Control': 'max-age=86400'
      }
    });
    await caches.default.put(cacheKey, response);
    return 'cache';
  }

  return 'default';
}
