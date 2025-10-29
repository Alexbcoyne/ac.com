export async function onRequestGet(context) {
  const { env } = context;

  const CLIENT_ID = env.SPOTIFY_CLIENT_ID;
  const CLIENT_SECRET = env.SPOTIFY_CLIENT_SECRET;
  const REFRESH_TOKEN = env.REFRESH_TOKEN;

  try {
    // Step 1: Refresh access token
    const tokenResponse = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        Authorization: "Basic " + btoa(`${CLIENT_ID}:${CLIENT_SECRET}`),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: REFRESH_TOKEN,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Spotify token error:", errorText);
      return new Response(
        JSON.stringify({
          error: "Failed to get access token",
          details: errorText,
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const { access_token } = await tokenResponse.json();

    // Step 2: Fetch currently playing track
    const nowPlaying = await fetch(
      "https://api.spotify.com/v1/me/player/currently-playing",
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      }
    );

    // 204 means nothing is playing
    if (nowPlaying.status === 204) {
      return new Response(
        JSON.stringify({ playing: false }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    if (!nowPlaying.ok) {
      const errorText = await nowPlaying.text();
      console.error("Spotify API error:", errorText);
      return new Response(
        JSON.stringify({
          error: "Spotify API request failed",
          details: errorText,
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const song = await nowPlaying.json();

    // Step 3: Return JSON data
    return new Response(
      JSON.stringify({
        playing: true,
        artist: song.item?.artists?.map(a => a.name).join(", ") || "Unknown Artist",
        title: song.item?.name || "Unknown Track",
        albumArt: song.item?.album?.images?.[0]?.url || "",
      }),
      { headers: { "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("Spotify worker exception:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
