export async function onRequest(context) {
  const { STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, STRAVA_REFRESH_TOKEN } = context.env;

  try {
    // 1. Refresh access token
    const tokenRes = await fetch("https://www.strava.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: STRAVA_CLIENT_ID,
        client_secret: STRAVA_CLIENT_SECRET,
        grant_type: "refresh_token",
        refresh_token: STRAVA_REFRESH_TOKEN
      })
    });

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    // 2. Fetch the latest activity
    const actRes = await fetch("https://www.strava.com/api/v3/athlete/activities?per_page=1", {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!actRes.ok) {
      throw new Error(`Failed to fetch activities: ${actRes.status}`);
    }

    const [latest] = await actRes.json();

    if (!latest) {
      return new Response(JSON.stringify({ error: "No activities found" }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // 3. Convert distance (m → km) and speed (m/s → min/km)
    const distanceKm = (latest.distance / 1000).toFixed(2);
    const paceMinPerKm = latest.average_speed > 0
      ? (1000 / (latest.average_speed * 60)).toFixed(2)
      : "N/A";

    // 4. Build response
    return new Response(JSON.stringify({
      name: latest.name,
      distance: distanceKm,
      pace: paceMinPerKm,
      heartRate: latest.average_heartrate || "N/A",
      date: latest.start_date_local
    }), { headers: { "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
