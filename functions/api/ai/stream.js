export async function onRequest(context) {
  try {
    const { request, env } = context;

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { 
        status: 405, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { 
        status: 400, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }

    if (!body || !Array.isArray(body.messages) || body.messages.length === 0) {
      return new Response(JSON.stringify({ error: 'messages array required' }), { 
        status: 400, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }

    const host = env.PI_AI_HOST || 'https://pi-ai.alexandercoyne.com';
    const headers = { 'Content-Type': 'application/json' };

    if (env.CF_ACCESS_CLIENT_ID && env.CF_ACCESS_CLIENT_SECRET) {
      headers['CF-Access-Client-Id'] = env.CF_ACCESS_CLIENT_ID;
      headers['CF-Access-Client-Secret'] = env.CF_ACCESS_CLIENT_SECRET;
    }
    if (env.AC_AI_API_KEY) {
      headers['X-AC-AI-Key'] = env.AC_AI_API_KEY;
    }

    // Forward to streaming endpoint
    const upstreamRes = await fetch(`${host}/v1/chat/stream`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    if (!upstreamRes.ok) {
      const text = await upstreamRes.text();
      return new Response(JSON.stringify({ error: 'Upstream error', status: upstreamRes.status, details: text }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Pass through the SSE stream
    return new Response(upstreamRes.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Proxy failure', details: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
