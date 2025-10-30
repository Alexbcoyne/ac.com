export async function onRequest(context) {
  const CLIENT_ID = context.env.SPOTIFY_CLIENT_ID;
  const CLIENT_SECRET = context.env.SPOTIFY_CLIENT_SECRET;
  const REFRESH_TOKEN = context.env.SPOTIFY_REFRESH_TOKEN;

  function base64Encode(str) {
    return Buffer.from(str).toString('base64');
  }

  try {
    // 1️⃣ Refresh access token
    const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + base64Encode(`${CLIENT_ID}:${CLIENT_SECRET}`),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: REFRESH_TOKEN
      })
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      return new Response(JSON.stringify({ error: 'Failed to get access token', details: tokenData }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    const accessToken = tokenData.access_token;

    // Parse time_range from query parameter
    const url = new URL(context.request.url);
    const timeRange = url.searchParams.get('time_range') || 'short_term';

    // 2️⃣ Currently Playing
    const nowRes = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
      headers: { 'Authorization': 'Bearer ' + accessToken }
    });

    let nowPlaying = { playing: false };
    if (nowRes.status === 200) {
      const nowData = await nowRes.json();
      if (nowData && nowData.item) {
        nowPlaying = {
          playing: nowData.is_playing,
          artist: nowData.item.artists.map(a => a.name).join(', '),
          title: nowData.item.name,
          albumArt: nowData.item.album.images[0]?.url || ''
        };
      }
    }

    // 3️⃣ Top Tracks
    const topRes = await fetch(`https://api.spotify.com/v1/me/top/tracks?limit=5&time_range=${timeRange}`, {
      headers: { 'Authorization': 'Bearer ' + accessToken }
    });

    const topDataRaw = await topRes.json();
    const topTracks = (topDataRaw.items || []).map(track => ({
      name: track.name,
      artists: track.artists.map(a => a.name).join(', ')
    }));

    // 4️⃣ Return combined JSON
    return new Response(JSON.stringify({
      nowPlaying,
      topTracks
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: 'Server error', details: err.toString() }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
