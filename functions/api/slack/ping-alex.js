export async function onRequest(context) {
  const { request, env } = context;
  const { SLACK_WEBHOOK_URL, SLACK_HEALTH_WEBHOOK_URL } = env;

  // Optional payload from client to customize the message
  let payload = {};
  if (request.method === 'POST') {
    try {
      payload = await request.json();
    } catch (_) {
      // ignore malformed JSON; fall back to defaults
    }
  }

  const reason = payload.reason || 'run-status';
  const details = payload.details || payload.message || '';

  // Build Slack message based on reason
  let title = '*Run Status Check*';
  let text = "<!channel> Hey Alex! Someone checked your website and noticed you haven't gone for a run today! 🏃‍♂️\nThink you'll head out for one? 🤔";
  let webhookUrl = SLACK_WEBHOOK_URL;

  if (reason === 'strava-error') {
    title = '*Strava Fetch Failed*';
    text = `<!channel> Heads up: Strava API request failed on alexandercoyne.com.\n• Fallback: showing cached data to users.\n• Details: ${details || 'n/a'}`;
    webhookUrl = SLACK_HEALTH_WEBHOOK_URL || SLACK_WEBHOOK_URL; // Use health channel or fallback
  }

  if (!webhookUrl) {
    return new Response(JSON.stringify({ error: "Slack webhook URL not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  // Server-side throttle using Cloudflare cache (1 ping/hour per reason)
  try {
    const cache = caches.default;
    const cacheKey = new Request(`https://internal.cache/ping-throttle/${encodeURIComponent(reason)}`);
    const hit = await cache.match(cacheKey);
    if (hit) {
      return new Response(JSON.stringify({ success: false, throttled: true }), {
        headers: { "Content-Type": "application/json" }
      });
    }
    // proceed to send Slack, then set cache marker below
  } catch (_) {
    // If cache not available, continue without throttling
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        blocks: [
          {
            type: "section",
            text: { type: "mrkdwn", text: title }
          },
          {
            type: "section",
            text: { type: "mrkdwn", text }
          },
          {
            type: "context",
            elements: [
              { type: "mrkdwn", text: `Sent from alexandercoyne.com • ${new Date().toISOString()}` }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`Slack API responded with ${response.status}`);
    }

    // Set throttle marker for 1 hour for this reason
    try {
      const cache = caches.default;
      const cacheKey = new Request(`https://internal.cache/ping-throttle/${encodeURIComponent(reason)}`);
      const marker = new Response('ok', { headers: { 'Cache-Control': 'max-age=3600' } });
      await cache.put(cacheKey, marker);
    } catch (_) {
      // ignore cache put errors
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: "Failed to send Slack message" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}