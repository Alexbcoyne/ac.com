import { getHealthState, setHealthState } from './health-state-store.js';

export async function onRequest(context) {
  const request = context.request;
  const url = new URL(request.url);

  // Only allow POST requests
  if (request.method !== 'POST' && request.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const current = await getHealthState(context);
  const action = (url.searchParams.get('state') || 'toggle').toLowerCase();
  let nextState = current.state;

  if (action === 'down') {
    nextState = 'down';
  } else if (action === 'up') {
    nextState = 'up';
  } else if (action === 'toggle') {
    nextState = current.state === 'down' ? 'up' : 'down';
  } else {
    return new Response(
      JSON.stringify({ error: "Invalid state. Use 'up', 'down', or 'toggle'." }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const writtenTo = await setHealthState(context, nextState);

  return new Response(
    JSON.stringify({
      message: 'Status updated',
      previousStatus: current.state,
      currentStatus: nextState,
      storage: writtenTo,
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
