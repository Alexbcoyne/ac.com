export async function onRequest(context) {
  const CLIENT_ID = context.env.SPOTIFY_CLIENT_ID;
  const CLIENT_SECRET = context.env.SPOTIFY_CLIENT_SECRET;
  const REFRESH_TOKEN = context.env.SPOTIFY_REFRESH_TOKEN;

  const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
  const SPOTIFY_CURRENTLY_PLAYING_URL = 'https://api.spotify.com/v1/me/player/currently-playing';

  try {
    // 1. Get access token using refresh token
    const tokenRes = await fetch(SPOTIFY_TOKEN_URL, {
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

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      throw new Error('Failed to get access token');
    }

    // 2. Fetch currently playing
    const nowRes = await fetch(SPOTIFY_CURRENTLY_PLAYING_URL, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (nowRes.status === 204) {
      // Nothing playing
      return new Response(JSON.stringify({
        nowPlaying: {
          playing: false,
          artist: '',
          title: '',
          albumArt: ''
        }
      }), { headers: { 'Content-Type': 'application/json' } });
    }

    if (!nowRes.ok) {
      console.error('Spotify API error:', await nowRes.text());
      throw new Error('Failed to fetch currently playing');
    }

    const nowData = await nowRes.json();

    // 3. Map Spotify response to front-end friendly format
    const nowPlaying = {
      playing: true,
      artist: nowData.item?.artists?.map(a => a.name).join(', ') || '',
      title: nowData.item?.name || '',
      albumArt: nowData.item?.album?.images?.[0]?.url || ''
    };

    return new Response(JSON.stringify({ nowPlaying }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('Spotify Worker error:', err);
    return new Response(JSON.stringify({
      nowPlaying: {
        playing: false,
        artist: '',
        title: '',
        albumArt: '',
        error: err.message
      }
    }), { headers: { 'Content-Type': 'application/json' } });
  }
}
