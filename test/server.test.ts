import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import type { Server } from 'bun';
import { createHttpServer } from '../src/server/http.js';
import { SessionManager } from '../src/server/session.js';
import type { LiveEventSource, LiveEventSourceCallbacks } from '../src/types/events.js';

describe('HTTP Server and Routes', () => {
  let server: Server<any>;
  let sessionManager: SessionManager;
  let baseUrl: string;
  const testOverlayToken = 'test-token-abcdef1234567890';

  beforeAll(() => {
    sessionManager = new SessionManager({ overlayToken: testOverlayToken });
    server = createHttpServer({
      port: 0, // OS assigns an ephemeral free port
      hostname: '127.0.0.1',
      sessionManager,
    });
    baseUrl = `http://127.0.0.1:${server.port}`;
  });

  afterAll(() => {
    server.stop(true);
  });

  it('GET / serves the dashboard with Brazilian Portuguese UI elements', async () => {
    const res = await fetch(`${baseUrl}/`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');

    const html = await res.text();
    // Verify required primary workflow elements
    expect(html).toContain('Username do streamer no TikTok');
    expect(html).toContain('placeholder="@username"');
    expect(html).toContain('Conectar');
    expect(html).toContain('Desconectar');
    expect(html).toContain('Abrir prévia');
    expect(html).toContain('Copiar URL do OBS');
    // Verify badge states and simulation section
    expect(html).toContain('Simulação');
    expect(html).toContain('badge');
  });

  it('GET /api/status returns current session snapshot', async () => {
    const res = await fetch(`${baseUrl}/api/status`);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.overlayToken).toBe(testOverlayToken);
    expect(data.status).toBe('idle');
    expect(data.totalLikes).toBe(0);
    expect(Array.isArray(data.recentChat)).toBe(true);
    expect(Array.isArray(data.recentGifts)).toBe(true);
  });

  it('POST /api/live/connect normalizes username with and without @', async () => {
    // 1. With leading @
    const resWithAt = await fetch(`${baseUrl}/api/live/connect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Host: `127.0.0.1:${server.port}`,
      },
      body: JSON.stringify({ username: '@streamer_alpha', isSimulated: true }),
    });
    expect(resWithAt.status).toBe(200);
    const dataWithAt = await resWithAt.json();
    expect(dataWithAt.ok).toBe(true);
    expect(dataWithAt.snapshot.targetUsername).toBe('streamer_alpha');

    // 2. Without leading @
    const resWithoutAt = await fetch(`${baseUrl}/api/live/connect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Host: `127.0.0.1:${server.port}`,
      },
      body: JSON.stringify({ username: 'streamer_beta', isSimulated: true }),
    });
    expect(resWithoutAt.status).toBe(200);
    const dataWithoutAt = await resWithoutAt.json();
    expect(dataWithoutAt.ok).toBe(true);
    expect(dataWithoutAt.snapshot.targetUsername).toBe('streamer_beta');

    // 3. Invalid empty username
    const resEmpty = await fetch(`${baseUrl}/api/live/connect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Host: `127.0.0.1:${server.port}`,
      },
      body: JSON.stringify({ username: '   ' }),
    });
    expect(resEmpty.status).toBe(400);
    const dataEmpty = await resEmpty.json();
    expect(dataEmpty.ok).toBe(false);
  });

  it('POST /api/live/disconnect disconnects the live session', async () => {
    const res = await fetch(`${baseUrl}/api/live/disconnect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Host: `127.0.0.1:${server.port}`,
      },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.snapshot.status).toBe('offline');
  });

  it('validates Host and Origin headers on administrative endpoints', async () => {
    // Malicious Host header
    const resBadHost = await fetch(`${baseUrl}/api/live/connect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Host: 'evil-attacker-site.com',
      },
      body: JSON.stringify({ username: 'streamer' }),
    });
    expect(resBadHost.status).toBe(403);

    // Malicious Origin header
    const resBadOrigin = await fetch(`${baseUrl}/api/live/connect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Host: `127.0.0.1:${server.port}`,
        Origin: 'https://malicious-website.com',
      },
      body: JSON.stringify({ username: 'streamer' }),
    });
    expect(resBadOrigin.status).toBe(403);
  });

  it('GET /overlay/:token serves overlay HTML with correct token and rejects invalid token', async () => {
    // Valid overlay token
    const resValid = await fetch(`${baseUrl}/overlay/${testOverlayToken}`);
    expect(resValid.status).toBe(200);
    expect(resValid.headers.get('content-type')).toContain('text/html');
    const html = await resValid.text();
    expect(html).toContain('chat-widget');
    expect(html).toContain('gift-alerts-container');

    // Invalid overlay token
    const resInvalid = await fetch(`${baseUrl}/overlay/wrong-token-9999`);
    expect(resInvalid.status).toBe(403);
    const invalidJson = await resInvalid.json();
    expect(invalidJson.ok).toBe(false);
  });

  it('POST /api/demo/event allows triggering simulated events: like delta 3 and streak 1->2->3', async () => {
    // 1. Reset / connect to clean session
    await fetch(`${baseUrl}/api/live/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Host: `127.0.0.1:${server.port}` },
      body: JSON.stringify({ username: 'test_demo_streamer', isSimulated: true }),
    });

    // 2. Send like delta of 3
    const resLike = await fetch(`${baseUrl}/api/demo/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Host: `127.0.0.1:${server.port}` },
      body: JSON.stringify({ type: 'like', count: 3 }),
    });
    expect(resLike.status).toBe(200);

    const statusAfterLike = await (await fetch(`${baseUrl}/api/status`)).json();
    expect(statusAfterLike.totalLikes).toBe(3);

    // 3. Send streak combo
    const resStreak = await fetch(`${baseUrl}/api/demo/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Host: `127.0.0.1:${server.port}` },
      body: JSON.stringify({
        type: 'streak',
        count: 3,
        giftName: 'Rosa',
        giftId: 'rose',
        diamondCount: 1,
      }),
    });
    expect(resStreak.status).toBe(200);

    // Give streak time to finish (200ms delay between steps in sendDemoEvent)
    await new Promise((r) => setTimeout(r, 600));

    const statusAfterStreak = await (await fetch(`${baseUrl}/api/status`)).json();
    expect(statusAfterStreak.recentGifts.length).toBeGreaterThanOrEqual(1);
    const lastGift = statusAfterStreak.recentGifts[statusAfterStreak.recentGifts.length - 1];
    expect(lastGift.data.count).toBe(3);
  });
});

describe('SSE Streaming and Overlay Reconnect / Refresh Snapshot', () => {
  let server: Server<any>;
  let sessionManager: SessionManager;
  let baseUrl: string;
  const overlayToken = 'obs-sse-token-test-12345';

  beforeAll(() => {
    sessionManager = new SessionManager({ overlayToken });
    server = createHttpServer({
      port: 0,
      hostname: '127.0.0.1',
      sessionManager,
    });
    baseUrl = `http://127.0.0.1:${server.port}`;
  });

  afterAll(() => {
    server.stop(true);
  });

  it('GET /overlay/:token/events delivers initial snapshot immediately and streams subsequent events', async () => {
    // Populate session with existing counts before SSE client connects
    sessionManager.handleLike({ id: 'pre-like-1', count: 17 });
    sessionManager.handleChat({ id: 'pre-chat-1', username: 'streamer_fan', comment: 'Mensagem antiga' });
    sessionManager.handleGift({
      id: 'pre-gift-1',
      giftId: 'rose',
      giftName: 'Rosa',
      count: 5,
      repeatCount: 5,
      repeatEnd: true,
      username: 'generous_donor',
    });

    const controller = new AbortController();
    const sseResponse = await fetch(`${baseUrl}/overlay/${overlayToken}/events`, {
      headers: { Accept: 'text/event-stream' },
      signal: controller.signal,
    });

    expect(sseResponse.status).toBe(200);
    expect(sseResponse.headers.get('content-type')).toContain('text/event-stream');

    const reader = sseResponse.body?.getReader();
    expect(reader).toBeDefined();
    if (!reader) return;

    const decoder = new TextDecoder();
    let receivedChunks = '';

    // Read the first chunk, which must contain the initial snapshot
    const firstRead = await reader.read();
    expect(firstRead.done).toBe(false);
    receivedChunks += decoder.decode(firstRead.value);

    expect(receivedChunks).toContain('event: snapshot');
    expect(receivedChunks).toContain('"totalLikes":17');
    expect(receivedChunks).toContain('Mensagem antiga');
    expect(receivedChunks).toContain('generous_donor');

    // CRITICAL: The initial message is a snapshot event, NOT a "gift.completed" alert event
    // This confirms OBS refresh/reconnect receives current counts without re-triggering old popups!
    expect(receivedChunks).not.toMatch(/^event: gift\.completed/m);

    // Now trigger a NEW live like delta of 3 while stream is open
    sessionManager.handleLike({ id: 'live-like-new', count: 3 });

    // Read subsequent SSE chunk
    let foundLiveEvent = false;
    for (let i = 0; i < 5; i++) {
      const readResult = await reader.read();
      if (readResult.done) break;
      const text = decoder.decode(readResult.value);
      if (text.includes('event: engagement.like') && text.includes('"count":3')) {
        foundLiveEvent = true;
        break;
      }
    }

    expect(foundLiveEvent).toBe(true);
    controller.abort();
  });

  it('rejects SSE connection with invalid overlay token', async () => {
    const res = await fetch(`${baseUrl}/overlay/invalid-token-999/events`);
    expect(res.status).toBe(403);
  });
});
