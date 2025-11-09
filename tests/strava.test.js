import { describe, it, expect, beforeEach, vi } from 'vitest';
import { onRequest } from '../functions/api/strava.js';
import { 
  setupWorkerEnv, 
  createMockResponse, 
  setupFetchMock,
  sampleStravaActivity 
} from './test-utils.js';

describe('Strava API Handler', () => {
  beforeEach(() => {
    setupFetchMock();
    vi.useFakeTimers();
  });

  it('successfully fetches and formats Strava activity', async () => {
    // Mock successful token refresh
    global.fetch.mockImplementationOnce(() => createMockResponse({
      access_token: 'mock-access-token'
    }));

    // Mock successful activity fetch
    global.fetch.mockImplementationOnce(() => createMockResponse([sampleStravaActivity]));

    const context = { env: setupWorkerEnv() };
    const response = await onRequest(context);
    const data = await response.json();

    expect(response.headers.get('Content-Type')).toBe('application/json');
    expect(data).toEqual(expect.objectContaining({
      id: sampleStravaActivity.id,
      name: sampleStravaActivity.name,
      distance: '5.00', // 5000m converted to km
      heartRate: sampleStravaActivity.average_heartrate,
      polyline: sampleStravaActivity.map.summary_polyline
    }));
  });

  it('handles no activities found', async () => {
    // Mock successful token refresh
    global.fetch.mockImplementationOnce(() => createMockResponse({
      access_token: 'mock-access-token'
    }));

    // Mock empty activities response
    global.fetch.mockImplementationOnce(() => createMockResponse([]));

    const context = { env: setupWorkerEnv() };
    const response = await onRequest(context);
    const data = await response.json();

    expect(data.error).toBe('No activities found');
  });

  it('correctly calculates run streak', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    const activities = [
      { ...sampleStravaActivity, start_date_local: new Date().toISOString() },
      { ...sampleStravaActivity, start_date_local: yesterday.toISOString() },
      { ...sampleStravaActivity, start_date_local: twoDaysAgo.toISOString() }
    ];

    // Mock successful token refresh
    global.fetch.mockImplementationOnce(() => createMockResponse({
      access_token: 'mock-access-token'
    }));

    // Mock activities with streak
    global.fetch.mockImplementationOnce(() => createMockResponse(activities));

    const context = { env: setupWorkerEnv() };
    const response = await onRequest(context);
    const data = await response.json();

    expect(data.streak).toBe(3);
    expect(data.hasRunToday).toBe(true);
  });
});