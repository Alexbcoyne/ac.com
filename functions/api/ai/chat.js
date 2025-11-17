export async function onRequest(context) {
  try {
    const { request, env } = context;

    // Expect JSON body: { messages: [ { role: "user", content: "..." }, ... ] }
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    if (!body || !Array.isArray(body.messages) || body.messages.length === 0) {
      return new Response(JSON.stringify({ error: 'messages array required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // Environment variables (set in Cloudflare Pages project settings)
    const host = env.PI_AI_HOST || 'https://pi-ai.alexandercoyne.com'; // tunnel hostname
    const accessId = env.CF_ACCESS_CLIENT_ID; // optional Cloudflare Access service token
    const accessSecret = env.CF_ACCESS_CLIENT_SECRET; // optional Cloudflare Access service token
    const apiKey = env.AC_AI_API_KEY; // optional custom API key (your own gate)

    const headers = {
      'Content-Type': 'application/json'
    };

    if (accessId && accessSecret) {
      headers['CF-Access-Client-Id'] = accessId;
      headers['CF-Access-Client-Secret'] = accessSecret;
    }
    if (apiKey) {
      // Forward custom key to origin if you implement a check there; or just validate here.
      headers['X-AC-AI-Key'] = apiKey;
    }

    // Forward request to Pi FastAPI /v1/chat
    const upstreamRes = await fetch(`${host}/v1/chat`, {
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

    // Pass through JSON reply
    const reply = await upstreamRes.text(); // keep as text to avoid double parse issues
    return new Response(reply, { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Proxy failure', details: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
