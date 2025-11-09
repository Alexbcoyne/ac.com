import { vi } from 'vitest';

// Mock Cloudflare Worker environment
export function setupWorkerEnv() {
  return {
    STRAVA_CLIENT_ID: 'test-client-id',
    STRAVA_CLIENT_SECRET: 'test-client-secret',
    STRAVA_REFRESH_TOKEN: 'test-refresh-token',
    SLACK_WEBHOOK_URL: 'https://hooks.slack.com/services/test'
  };
}

// Helper to create mock Response
export function createMockResponse(data) {
  return {
    ok: true,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data))
  };
}

// Mock fetch implementation
export function setupFetchMock() {
  global.fetch = vi.fn();
}

// Sample Strava activity data
export const sampleStravaActivity = {
  id: '123456789',
  name: 'Morning Run',
  distance: 5000, // 5km in meters
  average_speed: 3.33, // meters per second
  average_heartrate: 150,
  start_date_local: new Date().toISOString(),
  map: {
    summary_polyline: 'test_polyline'
  }
};