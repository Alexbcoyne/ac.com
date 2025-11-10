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

    // Calculate run streak and check if run today
    let streak = 0;
    let hasRunToday = false;
    let streakTotalDistance = 0; // in meters
    let streakTotalTime = 0; // in seconds

    if (activities.length > 0) {
      // Get current UTC date and time
      const now = new Date();
      
      // Parse the most recent activity's local date
      const mostRecentDate = new Date(activities[0].start_date_local);
      
      // Calculate the time difference in hours
      const hoursDiff = (now - mostRecentDate) / (1000 * 60 * 60);
      
      // If the activity was within the last 24 hours, consider it as "today"
      hasRunToday = hoursDiff < 24 && hoursDiff >= 0;
      
      // For streak calculation, normalize to day boundaries in local time
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const activityDay = new Date(
        mostRecentDate.getFullYear(),
        mostRecentDate.getMonth(),
        mostRecentDate.getDate()
      );
      
      // Calculate streak if run today or yesterday
      const daysSinceLastRun = Math.floor((today - activityDay) / (1000 * 60 * 60 * 24));
      
      if (daysSinceLastRun <= 1) {
        // Start counting from the most recent activity
        let currentDate = new Date(activities[0].start_date_local);
        currentDate.setHours(0, 0, 0, 0);

        for (const activity of activities) {
          const activityDate = new Date(activity.start_date_local);
          activityDate.setHours(0, 0, 0, 0);

          // Calculate days between current activity and the last counted one
          const dayDiff = Math.floor((currentDate - activityDate) / (1000 * 60 * 60 * 24));
          
          if (dayDiff === 0) {
            // Same day as last checked, add to totals but continue
            streakTotalDistance += activity.distance || 0;
            streakTotalTime += activity.moving_time || 0;
            continue;
          } else if (dayDiff === 1) {
            // Consecutive day, increment streak, add to totals, and update current date
            streak++;
            streakTotalDistance += activity.distance || 0;
            streakTotalTime += activity.moving_time || 0;
            currentDate = activityDate;
          } else {
            // Gap in days, streak ends here
            break;
          }
        }
        // Add 1 to include the most recent day
        streak++;
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
      polyline: latest.map?.summary_polyline || null,
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
