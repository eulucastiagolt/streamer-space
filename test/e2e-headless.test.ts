import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import type { Server } from 'bun';
import { spawnSync } from 'node:child_process';
import { createHttpServer } from '../src/server/http.js';
import { SessionManager } from '../src/server/session.js';

describe('Headless and E2E Browser Verification', () => {
  let server: Server<any>;
  let sessionManager: SessionManager;
  let baseUrl: string;
  const overlayToken = 'e2e-headless-token-123456';

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

  it('verifies static assets (CSS, JS) via curl/fetch with correct MIME types', async () => {
    const assets = [
      { path: '/dashboard.css', mime: 'text/css' },
      { path: '/dashboard.js', mime: 'application/javascript' },
      { path: '/overlay.css', mime: 'text/css' },
      { path: '/overlay.js', mime: 'application/javascript' },
    ];

    for (const asset of assets) {
      const res = await fetch(`${baseUrl}${asset.path}`);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain(asset.mime);
      const text = await res.text();
      expect(text.length).toBeGreaterThan(50);
    }
  });

  it('renders Dashboard in Headless Chromium and populates DOM elements', async () => {
    const dashboardUrl = `${baseUrl}/`;
    const proc = Bun.spawn([
      'chromium',
      '--headless',
      '--disable-gpu',
      '--no-sandbox',
      '--dump-dom',
      dashboardUrl,
    ]);

    const exitCode = await proc.exited;
    expect(exitCode).toBe(0);
    const domOutput = await new Response(proc.stdout).text();

    // Verify key elements and Portuguese text
    expect(domOutput).toContain('id="username-input"');
    expect(domOutput).toContain('id="btn-connect"');
    expect(domOutput).toContain('id="btn-disconnect"');
    expect(domOutput).toContain('id="btn-preview"');
    expect(domOutput).toContain('id="btn-copy-url"');
    expect(domOutput).toContain('Username do streamer no TikTok');
    expect(domOutput).toContain('placeholder="@username"');
    expect(domOutput).toContain('Simulação');
    expect(domOutput).toContain('badge');
  });

  it('renders OBS Overlay in Headless Chromium with horizontal 1920x1080 resolution', async () => {
    const overlayUrl = `${baseUrl}/overlay/${overlayToken}`;
    const proc = Bun.spawn([
      'chromium',
      '--headless',
      '--disable-gpu',
      '--no-sandbox',
      '--window-size=1920,1080',
      '--default-background-color=00000000',
      '--dump-dom',
      overlayUrl,
    ]);

    const exitCode = await proc.exited;
    expect(exitCode).toBe(0);
    const domOutput = await new Response(proc.stdout).text();

    expect(domOutput).toContain('id="overlay-app"');
    expect(domOutput).toContain('id="gift-alerts-container"');
    expect(domOutput).toContain('id="stats-widget"');
    expect(domOutput).toContain('id="like-stat-box"');
    expect(domOutput).toContain('id="chat-widget"');
    expect(domOutput).toContain('id="chat-messages"');
  });

  it('renders OBS Overlay in Headless Chromium with vertical 1080x1920 resolution', async () => {
    const overlayUrl = `${baseUrl}/overlay/${overlayToken}`;
    const proc = Bun.spawn([
      'chromium',
      '--headless',
      '--disable-gpu',
      '--no-sandbox',
      '--window-size=1080,1920',
      '--default-background-color=00000000',
      '--dump-dom',
      overlayUrl,
    ]);

    const exitCode = await proc.exited;
    expect(exitCode).toBe(0);
    const domOutput = await new Response(proc.stdout).text();

    expect(domOutput).toContain('id="overlay-app"');
    expect(domOutput).toContain('id="gift-alerts-container"');
    expect(domOutput).toContain('id="stats-widget"');
    expect(domOutput).toContain('id="chat-widget"');
  });
});
