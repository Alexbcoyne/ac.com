import { getHealthState } from './health-state-store.js';

export async function onRequest(context) {
  const request = context.request;
  const url = new URL(request.url);
  const forced = url.searchParams.get('force');

  // Deterministic simulation for external monitors:
  // /api/health-check?force=down -> 503
  // /api/health-check?force=up   -> 200
  if (forced === 'down') {
    return new Response(
      JSON.stringify({
        status: 'down',
        source: 'query',
        message: 'Service temporarily unavailable',
        timestamp: new Date().toISOString()
      }),
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  }

  if (forced === 'up') {
    return new Response(
      JSON.stringify({
        status: 'up',
        source: 'query',
        timestamp: new Date().toISOString()
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  }

  const stored = await getHealthState(context);
  const isServiceDown = stored.state === 'down';

  if (isServiceDown) {
    return new Response(
      JSON.stringify({
        status: 'down',
        source: stored.source,
        message: 'Service temporarily unavailable',
        timestamp: new Date().toISOString()
      }),
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  }

  return new Response(
    JSON.stringify({
      status: 'up',
      source: stored.source,
      timestamp: new Date().toISOString()
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    }
  );
}
