export async function onRequest(context) {
  const { env } = context;
  const CLIENT_ID = env.SPOTIFY_CLIENT_ID;
  const CLIENT_SECRET = env.SPOTIFY_CLIENT_SECRET;
  const REFRESH_TOKEN = env.REFRESH_TOKEN;

  const TOKEN_URL = 'https://accounts.spotify.com/api/token';
  const RECENT_TRACKS_URL = 'https://api.spotify.com/v1/me/player/recently-played';

  try {
    // Get access token
    const tokenRes = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + btoa(`${CLIENT_ID}:${CLIENT_SECRET}`)
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: REFRESH_TOKEN
      })
    });

    const { access_token } = await tokenRes.json();
    if (!access_token) throw new Error('Failed to get access token');

    // Fetch recently played tracks (limit to 5)
    const recentRes = await fetch(`${RECENT_TRACKS_URL}?limit=5`, {
      headers: { 'Authorization': `Bearer ${access_token}` }
    });

    if (!recentRes.ok) {
      const errBody = await recentRes.json().catch(() => ({}));
      throw new Error(`Recent tracks fetch failed (${recentRes.status}): ${JSON.stringify(errBody)}`);
    }

    const recentData = await recentRes.json();

    return new Response(JSON.stringify(recentData), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
