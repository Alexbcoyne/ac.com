export async function onRequest(context) {
  const request = context.request;
  const cookie = request.headers.get('Cookie') || '';
  const isDown = cookie.includes('ac_demo_down=true');
  const nextIsDown = !isDown;

  // Only allow POST requests
  if (request.method !== 'POST' && request.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({
      message: 'Status toggled',
      previousStatus: isDown ? 'down' : 'up',
      currentStatus: nextIsDown ? 'down' : 'up',
      timestamp: new Date().toISOString()
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Set-Cookie': `ac_demo_down=${nextIsDown ? 'true' : 'false'}; Path=/; Max-Age=86400; SameSite=Lax`
      }
    }
  );
}
