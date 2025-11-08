export async function onRequest(context) {
  const { STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, STRAVA_REFRESH_TOKEN } = context.env;

  try {
    // 1️⃣ Refresh access token
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

    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      console.error("Token refresh failed:", text);
      return new Response(JSON.stringify({ error: "Failed to refresh Strava token", details: text }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    // 2️⃣ Fetch recent activities (last 30 days worth)
    const actRes = await fetch("https://www.strava.com/api/v3/athlete/activities?per_page=30", {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!actRes.ok) {
      const text = await actRes.text();
      console.error("Fetch activities failed:", text);
      return new Response(JSON.stringify({ error: "Failed to fetch activities", details: text }), {
        status: actRes.status,
        headers: { "Content-Type": "application/json" }
      });
    }

    const activities = await actRes.json();
    const latest = activities[0];

    if (!latest) {
      return new Response(JSON.stringify({ error: "No activities found" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Calculate run streak
    let streak = 0;
    if (activities.length > 0) {
      // Start with the most recent day
      let currentDate = new Date(activities[0].start_date_local);
      currentDate.setHours(0, 0, 0, 0); // Reset time to start of day

      for (const activity of activities) {
        const activityDate = new Date(activity.start_date_local);
        activityDate.setHours(0, 0, 0, 0);

        // If this activity is from the previous day, increment streak
        const dayDiff = Math.floor((currentDate - activityDate) / (1000 * 60 * 60 * 24));
        
        if (dayDiff === 0) {
          // Same day as last checked, continue to next activity
          continue;
        } else if (dayDiff === 1) {
          // Consecutive day, increment streak and update current date
          streak++;
          currentDate = activityDate;
        } else {
          // Gap in days, streak ends here
          break;
        }
      }
      // Add 1 to include the most recent day
      streak++;
    }

    // 3️⃣ Format response
    const distanceKm = (latest.distance / 1000).toFixed(2);
    const paceMinPerKm = latest.average_speed > 0
      ? (1000 / (latest.average_speed * 60)).toFixed(2)
      : "N/A";

    return new Response(JSON.stringify({
      id: latest.id,
      name: latest.name,
      distance: distanceKm,
      pace: paceMinPerKm,
      heartRate: latest.average_heartrate || "N/A",
      date: latest.start_date_local,
      polyline: latest.map?.summary_polyline || null,
      streak: streak
    }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    console.error("Strava API error:", err);
    return new Response(JSON.stringify({ error: "Server error", details: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
