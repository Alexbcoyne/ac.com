export async function onRequest(context) {
  const { env, request } = context;
  const CLIENT_ID = env.SPOTIFY_CLIENT_ID;
  const CLIENT_SECRET = env.SPOTIFY_CLIENT_SECRET;
  const REFRESH_TOKEN = env.SPOTIFY_REFRESH_TOKEN;

  const TOKEN_URL = 'https://accounts.spotify.com/api/token';
  const TOP_TRACKS_URL = 'https://api.spotify.com/v1/me/top/tracks';

  const url = new URL(request.url);
  const time_range = url.searchParams.get('time_range') || 'short_term'; // default last month

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

    // Fetch top tracks
    const topRes = await fetch(`${TOP_TRACKS_URL}?limit=5&time_range=${time_range}`, {
      headers: { 'Authorization': `Bearer ${access_token}` }
    });

    const topData = await topRes.json();

    return new Response(JSON.stringify(topData), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
