import { describe, it, expect, beforeEach } from 'vitest';
import { onRequest } from '../functions/api/slack/ping-alex.js';
import { setupWorkerEnv, setupFetchMock } from './test-utils.js';

describe('Slack Webhook Handler', () => {
  beforeEach(() => {
    setupFetchMock();
  });

  it('successfully sends Slack message', async () => {
    global.fetch.mockImplementationOnce(() => ({
      ok: true,
      status: 200
    }));

    const context = { env: setupWorkerEnv() };
    const response = await onRequest(context);
    const data = await response.json();

    expect(response.headers.get('Content-Type')).toBe('application/json');
    expect(data.success).toBe(true);
    
    // Verify the Slack message format
    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.stringContaining('Run Status Check')
      })
    );
  });

  it('handles missing webhook URL', async () => {
    const context = { env: {} };
    const response = await onRequest(context);
    const data = await response.json();

    expect(data.error).toBe('Slack webhook URL not configured');
    expect(response.status).toBe(500);
  });

  it('handles Slack API errors', async () => {
    global.fetch.mockImplementationOnce(() => ({
      ok: false,
      status: 500
    }));

    const context = { env: setupWorkerEnv() };
    const response = await onRequest(context);
    const data = await response.json();

    expect(data.error).toBe('Failed to send Slack message');
    expect(response.status).toBe(500);
  });
});