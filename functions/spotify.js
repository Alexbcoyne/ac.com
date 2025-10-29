export async function onRequest() {
  const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
  const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
  const REFRESH_TOKEN = process.env.SPOTIFY_REFRESH_TOKEN;

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

  const tokenData = await tokenResponse.json();
  const accessToken = tokenData.access_token;

  // Get currently playing track
  const trackResponse = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (trackResponse.status === 204) {
    return new Response(JSON.stringify({ playing: false }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const trackData = await trackResponse.json();

  return new Response(JSON.stringify(trackData), {
    headers: { 'Content-Type': 'application/json' }
  });
}
