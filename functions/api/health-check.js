// Health check endpoint - returns 200 or 503 based on service status
// Toggle status via /health-check-toggle

let isServiceDown = false;

export async function onRequest(context) {
  // Check if service is down
  if (isServiceDown) {
    return new Response(
      JSON.stringify({
        status: 'down',
        message: 'Service temporarily unavailable',
        timestamp: new Date().toISOString()
      }),
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  }

  // Service is up
  return new Response(
    JSON.stringify({
      status: 'up',
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

// Export function for toggling (can be called from another endpoint)
export function setServiceDown(down) {
  isServiceDown = down;
}

export function getServiceStatus() {
  return isServiceDown;
}
