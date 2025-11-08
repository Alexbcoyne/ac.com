export async function onRequest(context) {
  const { SLACK_WEBHOOK_URL } = context.env;

  if (!SLACK_WEBHOOK_URL) {
    return new Response(JSON.stringify({ error: "Slack webhook URL not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const response = await fetch(SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: "👋 Hey Alex! People are wondering if you're going for a run today! 🏃‍♂️"
      })
    });

    if (!response.ok) {
      throw new Error(`Slack API responded with ${response.status}`);
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