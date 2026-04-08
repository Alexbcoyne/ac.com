// Toggle endpoint for health-check status
import * as healthCheck from './health-check.js';

export async function onRequest(context) {
  const { req } = context;

  // Only allow POST requests
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Toggle status
  const currentStatus = healthCheck.getServiceStatus();
  healthCheck.setServiceDown(!currentStatus);
  const newStatus = healthCheck.getServiceStatus();

  return new Response(
    JSON.stringify({
      message: 'Status toggled',
      previousStatus: currentStatus ? 'down' : 'up',
      currentStatus: newStatus ? 'down' : 'up',
      timestamp: new Date().toISOString()
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    }
  );
}
