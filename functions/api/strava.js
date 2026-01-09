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

    // 2️⃣ Fetch recent activities (up to 200 for long streaks with multiple daily workouts)
    const actRes = await fetch("https://www.strava.com/api/v3/athlete/activities?per_page=200", {
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
    
    // Find the latest Run or Ride activity (skip gym/other workouts)
    const latest = activities.find(a => a.type === 'Run' || a.type === 'Ride');

    if (!latest) {
      return new Response(JSON.stringify({ error: "No run or ride activities found" }), {
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

    // Calculate workout streaks by type: Run, Gym (WeightTraining), Other, and total consecutive days
    let runStreak = 0;
    let gymStreak = 0;
    let otherStreak = 0;
    let totalStreak = 0;
    let hasWorkedOutToday = false;

    if (activities.length > 0) {
      // Derive athlete's local offset using latest activity timestamps
      const latestSummary = activities[0];
      const utcMs = Date.parse(latestSummary.start_date || ""); // e.g. '...Z'
      const localAsUtcMs = Date.parse((latestSummary.start_date_local || "").replace("Z", "")); // treat local time as UTC to compute offset
      const offsetMs = (isNaN(utcMs) || isNaN(localAsUtcMs)) ? 0 : (localAsUtcMs - utcMs);

      // Compute today's date string in the athlete's local timezone (YYYY-MM-DD)
      const nowLocal = new Date(Date.now() + offsetMs);
      const todayLocalStr = nowLocal.toISOString().slice(0, 10);

      // Has worked out today: any activity whose local date matches today's local date
      hasWorkedOutToday = activities.some(a => (a.start_date_local || '').slice(0, 10) === todayLocalStr);

      const daysBetween = (aStr, bStr) => {
        // Treat date strings as UTC midnights to compute whole-day differences
        return Math.floor((Date.parse(aStr + 'T00:00:00Z') - Date.parse(bStr + 'T00:00:00Z')) / 86400000);
      };

      // Normalize activity types
      const normalizeType = (type) => {
        if (type === 'Run') return 'Run';
        if (type === 'WeightTraining') return 'Gym';
        return 'Other';
      };

      // Group activities by date and track which normalized types occurred on each day
      const dayMap = new Map(); // date -> Set of normalized activity types
      const typesSeen = new Set(); // Debug: track all types we see
      for (const activity of activities) {
        const day = (activity.start_date_local || '').slice(0, 10);
        if (!dayMap.has(day)) {
          dayMap.set(day, new Set());
        }
        const normalized = normalizeType(activity.type);
        dayMap.get(day).add(normalized);
        typesSeen.add(`${activity.type} -> ${normalized}`); // Debug
      }
      console.log('Activity types seen:', Array.from(typesSeen).join(', ')); // Debug
      console.log('Day map:', Array.from(dayMap.entries()).slice(0, 10)); // Debug first 10 days

      // Sort days in descending order
      const sortedDays = Array.from(dayMap.keys()).sort((a, b) => b.localeCompare(a));

      if (sortedDays.length > 0) {
        const mostRecentDay = sortedDays[0];
        const daysSinceLastActivity = daysBetween(todayLocalStr, mostRecentDay);

        // Only calculate streaks if most recent activity is today or yesterday
        if (daysSinceLastActivity <= 1) {
          // Calculate total consecutive workout days and count activity types
          let expectedDay = mostRecentDay;
          const streakDays = [];
          
          for (const day of sortedDays) {
            const dayDiff = daysBetween(expectedDay, day);
            if (dayDiff === 0) {
              totalStreak++;
              streakDays.push(day);
              expectedDay = new Date(Date.parse(day + 'T00:00:00Z') - 86400000).toISOString().slice(0, 10);
            } else {
              break;
            }
          }

          // Count occurrences of each activity type within the streak days
          for (const day of streakDays) {
            const types = dayMap.get(day);
            if (types.has('Run')) runStreak++;
            if (types.has('Gym')) gymStreak++;
            if (types.has('Other')) otherStreak++;
          }
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
      totalStreak: totalStreak,
      runStreak: runStreak,
      gymStreak: gymStreak,
      otherStreak: otherStreak,
      hasWorkedOutToday: hasWorkedOutToday
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
