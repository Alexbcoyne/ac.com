function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

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

    // Fetch detailed activity to get the polyline
    let polyline = null;
    if (latest.id) {
      try {
        const detailRes = await fetch(`https://www.strava.com/api/v3/activities/${latest.id}`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        if (detailRes.ok) {
          const detailData = await detailRes.json();
          polyline = detailData.map?.summary_polyline || null;
        }
      } catch (e) {
        console.warn("Failed to fetch activity detail for polyline:", e);
      }
    }

    // Calculate run streak and check if run today
    let streak = 0;
    let hasRunToday = false;
    let streakTotalDistance = 0; // in meters
    let streakTotalTime = 0; // in seconds

    if (activities.length > 0) {
      // Derive athlete's local offset using latest activity timestamps
      const latestSummary = activities[0];
      const utcMs = Date.parse(latestSummary.start_date || ""); // e.g. '...Z'
      const localAsUtcMs = Date.parse((latestSummary.start_date_local || "").replace("Z", "")); // treat local time as UTC to compute offset
      const offsetMs = (isNaN(utcMs) || isNaN(localAsUtcMs)) ? 0 : (localAsUtcMs - utcMs);

      // Compute today's date string in the athlete's local timezone (YYYY-MM-DD)
      const nowLocal = new Date(Date.now() + offsetMs);
      const todayLocalStr = nowLocal.toISOString().slice(0, 10);

      // Consider only running activities
      const runActivities = activities.filter(a => a.type === 'Run');

      // Has run today: any run whose local date matches today's local date
      hasRunToday = runActivities.some(a => (a.start_date_local || '').slice(0, 10) === todayLocalStr);

      // Streak calculation: only runs; build consecutive days based on local dates
      if (runActivities.length > 0) {
        const daysBetween = (aStr, bStr) => {
          // Treat date strings as UTC midnights to compute whole-day differences
          return Math.floor((Date.parse(aStr + 'T00:00:00Z') - Date.parse(bStr + 'T00:00:00Z')) / 86400000);
        };

        // Start from the most recent run day
        let currentDay = (runActivities[0].start_date_local || '').slice(0, 10);

        // Proceed only if latest run is today or yesterday
        const daysSinceLastRun = daysBetween(todayLocalStr, currentDay);

        if (daysSinceLastRun <= 1) {
          for (const activity of runActivities) {
            const day = (activity.start_date_local || '').slice(0, 10);
            const dayDiff = daysBetween(currentDay, day);

            if (dayDiff === 0) {
              // Same day as last counted; accumulate totals
              streakTotalDistance += activity.distance || 0;
              streakTotalTime += activity.moving_time || 0;
              continue;
            } else if (dayDiff === 1) {
              // Consecutive day: increment streak, accumulate, and move window
              streak++;
              streakTotalDistance += activity.distance || 0;
              streakTotalTime += activity.moving_time || 0;
              currentDay = day;
            } else {
              // Gap detected; streak ends
              break;
            }
          }
          // Include the most recent run day itself
          streak++;
        }
      }
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
      polyline: polyline,
      streak: streak,
      hasRunToday: hasRunToday,
      streakStats: {
        totalDistance: (streakTotalDistance / 1000).toFixed(2), // Convert to km
        totalTime: formatTime(streakTotalTime)
      }
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
