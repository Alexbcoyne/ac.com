export async function onRequest(context) {
  try {
    const CLIENT_ID = context.env.SPOTIFY_CLIENT_ID;
    const CLIENT_SECRET = context.env.SPOTIFY_CLIENT_SECRET;
    const REFRESH_TOKEN = context.env.SPOTIFY_REFRESH_TOKEN;

    // Refresh access token
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: REFRESH_TOKEN,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET
    });

    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params
    });

    if (!tokenResponse.ok) {
      return new Response(JSON.stringify({ error: 'Failed to get access token' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 500
      });
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Get currently playing track
    const trackResponse = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (trackResponse.status === 204) {
      // Nothing is playing
      return new Response(JSON.stringify({ playing: false }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!trackResponse.ok) {
      return new Response(JSON.stringify({ error: 'Failed to get currently playing track' }), {
        headers: { 'Content-Type': 'application/json' },
        status: trackResponse.status
      });
    }

    const trackData = await trackResponse.json();

    return new Response(JSON.stringify(trackData), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500
    });
  }
}
