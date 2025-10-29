export async function onRequest(context) {
  try {
    const CLIENT_ID = context.env.SPOTIFY_CLIENT_ID.trim();
    const CLIENT_SECRET = context.env.SPOTIFY_CLIENT_SECRET.trim();
    const REFRESH_TOKEN = context.env.SPOTIFY_REFRESH_TOKEN.trim();

    // Step 1: Get a new access token using your refresh token
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
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

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      return new Response(JSON.stringify({ error: "Failed to get access token", details: errText }), {
        headers: { 'Content-Type': 'application/json' },
        status: 500
      });
    }

    const { access_token } = await tokenResponse.json();

    // Step 2: Use that access token to get the currently playing track
    const nowPlayingResponse = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
      headers: { Authorization: `Bearer ${access_token}` }
    });

    if (nowPlayingResponse.status === 204 || nowPlayingResponse.status > 400) {
      // If nothing is playing, get the most recently played track
      const recentResponse = await fetch('https://api.spotify.com/v1/me/player/recently-played?limit=1', {
        headers: { Authorization: `Bearer ${access_token}` }
      });
      const recentData = await recentResponse.json();
      const track = recentData.items?.[0]?.track;

      return new Response(JSON.stringify({
        isPlaying: false,
        title: track?.name || "Unknown Track",
        artist: track?.artists?.map(a => a.name).join(', ') || "Unknown Artist",
        album: track?.album?.name || "Unknown Album",
        albumArt: track?.album?.images?.[0]?.url || null,
        url: track?.external_urls?.spotify || null
      }), { headers: { 'Content-Type': 'application/json' } });
    }

    // Step 3: Parse currently playing data
    const data = await nowPlayingResponse.json();

    return new Response(JSON.stringify({
      isPlaying: true,
      title: data.item?.name,
      artist: data.item?.artists?.map(a => a.name).join(', '),
      album: data.item?.album?.name,
      albumArt: data.item?.album?.images?.[0]?.url,
      url: data.item?.external_urls?.spotify
    }), { headers: { 'Content-Type': 'application/json' } });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500
    });
  }
}
