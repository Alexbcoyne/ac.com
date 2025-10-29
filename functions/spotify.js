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
    let trackResponse = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    let trackData;

    if (trackResponse.status === 204 || !trackResponse.ok) {
      // Nothing currently playing or API error, fallback to last played track
      trackResponse = await fetch('https://api.spotify.com/v1/me/player/recently-played?limit=1', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      if (!trackResponse.ok) {
        return new Response(JSON.stringify({ error: 'Failed to get recently played track' }), {
          headers: { 'Content-Type': 'application/json' },
          status: trackResponse.status
        });
      }

      const recentData = await trackResponse.json();
      if (recentData.items && recentData.items.length > 0) {
        trackData = recentData.items[0].track;
        trackData.playing = false; // mark as not currently playing
      } else {
        // No recent track either
        return new Response(JSON.stringify({ playing: false }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
    } else {
      trackData = await trackResponse.json();
      trackData.playing = true; // mark as currently playing
    }

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
