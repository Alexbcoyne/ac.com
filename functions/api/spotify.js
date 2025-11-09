export async function onRequest(context) {
  const { env } = context;
  const CLIENT_ID = env.SPOTIFY_CLIENT_ID;
  const CLIENT_SECRET = env.SPOTIFY_CLIENT_SECRET;
  const REFRESH_TOKEN = env.REFRESH_TOKEN;

  const TOKEN_URL = 'https://accounts.spotify.com/api/token';
  const NOW_PLAYING_URL = 'https://api.spotify.com/v1/me/player/currently-playing';

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

    // Fetch currently playing
    const nowRes = await fetch(NOW_PLAYING_URL, {
      headers: { 'Authorization': `Bearer ${access_token}` }
    });

    if (nowRes.status === 204) {
      return new Response(JSON.stringify({ nowPlaying: { playing: false } }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const nowData = await nowRes.json();

    const nowPlaying = {
      playing: true,
      artist: nowData.item?.artists?.map(a => a.name).join(', ') || '',
      title: nowData.item?.name || '',
      albumArt: nowData.item?.album?.images?.[0]?.url || '',
      spotifyUrl: nowData.item?.external_urls?.spotify || ''
    };

    return new Response(JSON.stringify({ nowPlaying }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ nowPlaying: { playing: false, error: err.message } }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
