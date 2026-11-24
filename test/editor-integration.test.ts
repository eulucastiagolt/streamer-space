import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import type { Server } from 'bun';
import { existsSync, unlinkSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHttpServer } from '../src/server/http.js';
import { SessionManager } from '../src/server/session.js';
import { ConfigStore } from '../src/server/config-store.js';
import {
  type OverlayConfig,
  type GiftAlertRule,
  createDefaultOverlayConfig,
} from '../src/types/config.js';

/**
 * Deterministic Gift Alert Rule matching engine
 * First rule where (giftId matches or is unset) AND (minCount <= count or is unset) wins.
 */
export function matchGiftAlertRule(
  rules: GiftAlertRule[],
  gift: { giftId?: string | number; count: number },
  defaultDurationMs: number = 4000
): { durationMs: number; bannerColor?: string; textColor?: string; ruleId?: string } {
  for (const rule of rules) {
    const giftIdMatches = rule.giftId === undefined || String(rule.giftId) === String(gift.giftId);
    const countMatches = rule.minCount === undefined || gift.count >= rule.minCount;
    if (giftIdMatches && countMatches) {
      return {
        durationMs: rule.durationMs,
        bannerColor: rule.bannerColor,
        textColor: rule.textColor,
        ruleId: rule.id,
      };
    }
  }
  return {
    durationMs: defaultDurationMs,
  };
}

describe('Editor & Configuration Integration', () => {
  let server: Server<any>;
  let sessionManager: SessionManager;
  let configStore: ConfigStore;
  let baseUrl: string;
  const overlayToken = 'integration-test-token-777';
  const testConfigFile = join(process.cwd(), 'data', 'test-integration-config.json');

  beforeAll(() => {
    mkdirSync(join(process.cwd(), 'data'), { recursive: true });
    if (existsSync(testConfigFile)) unlinkSync(testConfigFile);

    configStore = new ConfigStore(testConfigFile);
    sessionManager = new SessionManager({
      overlayToken,
      configStore,
    });

    server = createHttpServer({
      port: 0,
      hostname: '127.0.0.1',
      sessionManager,
    });
    baseUrl = `http://127.0.0.1:${server.port}`;
  });

  afterAll(() => {
    server.stop(true);
    try {
      if (existsSync(testConfigFile)) unlinkSync(testConfigFile);
    } catch {}
  });

  it('GET /api/config returns the current overlay configuration', async () => {
    const res = await fetch(`${baseUrl}/api/config`);
    expect(res.status).toBe(200);
    const data = (await res.json()) as OverlayConfig;

    expect(data.version).toBe('1.0');
    expect(data.layouts.horizontal.canvasWidth).toBe(1920);
    expect(data.layouts.vertical.canvasHeight).toBe(1920);
    expect(data.layouts.horizontal.widgets.chat).toBeDefined();
    expect(data.layouts.horizontal.widgets['gift-alerts']).toBeDefined();
    expect(data.layouts.horizontal.widgets['likes-goal']).toBeDefined();
  });

  it('POST /api/config saves and publishes updated layout', async () => {
    const currentConfig = configStore.getConfig();
    const updated = JSON.parse(JSON.stringify(currentConfig));

    // Move chat widget and enable likes-goal
    updated.layouts.horizontal.widgets.chat.position.x = 80;
    updated.layouts.horizontal.widgets.chat.position.y = 420;
    updated.layouts.horizontal.widgets['likes-goal'].visible = true;
    updated.layouts.horizontal.widgets['likes-goal'].targetLikes = 2500;

    const res = await fetch(`${baseUrl}/api/config`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Host: `127.0.0.1:${server.port}`,
      },
      body: JSON.stringify(updated),
    });

    expect(res.status).toBe(200);
    const result = await res.json();
    expect(result.ok).toBe(true);
    expect(result.config.layouts.horizontal.widgets.chat.position.x).toBe(80);
    expect(result.config.layouts.horizontal.widgets.chat.position.y).toBe(420);
    expect(result.config.layouts.horizontal.widgets['likes-goal'].visible).toBe(true);
    expect(result.config.layouts.horizontal.widgets['likes-goal'].targetLikes).toBe(2500);

    // Verify stored config in sessionManager and configStore
    expect(configStore.getConfig().layouts.horizontal.widgets.chat.position.x).toBe(80);
    expect(sessionManager.getConfig().layouts.horizontal.widgets.chat.position.x).toBe(80);
  });

  it('POST /api/config rejects invalid config and enforces Host/Origin security', async () => {
    // 1. Invalid payload
    const badRes = await fetch(`${baseUrl}/api/config`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Host: `127.0.0.1:${server.port}`,
      },
      body: JSON.stringify({ version: 'invalid-version' }),
    });
    expect(badRes.status).toBe(400);

    // 2. Malicious Host header
    const badHostRes = await fetch(`${baseUrl}/api/config`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Host: 'evil-attacker.com',
      },
      body: JSON.stringify(createDefaultOverlayConfig()),
    });
    expect(badHostRes.status).toBe(403);

    // 3. Malicious Origin header
    const badOriginRes = await fetch(`${baseUrl}/api/config`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Host: `127.0.0.1:${server.port}`,
        Origin: 'https://evil-hacker.com',
      },
      body: JSON.stringify(createDefaultOverlayConfig()),
    });
    expect(badOriginRes.status).toBe(403);
  });

  it('POST /api/config/reset restores default configuration', async () => {
    const res = await fetch(`${baseUrl}/api/config/reset`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Host: `127.0.0.1:${server.port}`,
      },
    });

    expect(res.status).toBe(200);
    const result = await res.json();
    expect(result.ok).toBe(true);
    expect(result.config.layouts.horizontal.widgets.chat.position.x).toBe(40);
  });

  it('verifies stable OBS token and URL across config updates and resets', async () => {
    const initialToken = sessionManager.overlayToken;
    expect(initialToken).toBe(overlayToken);

    // Update config
    const conf = configStore.getConfig();
    conf.layouts.horizontal.widgets.chat.visible = false;
    await fetch(`${baseUrl}/api/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Host: `127.0.0.1:${server.port}` },
      body: JSON.stringify(conf),
    });

    expect(sessionManager.overlayToken).toBe(initialToken);
    expect(sessionManager.getSnapshot().overlayToken).toBe(initialToken);

    // Reset config
    await fetch(`${baseUrl}/api/config/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Host: `127.0.0.1:${server.port}` },
    });

    expect(sessionManager.overlayToken).toBe(initialToken);
  });

  it('delivers config in initial SSE snapshot and broadcasts config.updated on save', async () => {
    const controller = new AbortController();
    const sseResponse = await fetch(`${baseUrl}/overlay/${overlayToken}/events`, {
      headers: { Accept: 'text/event-stream' },
      signal: controller.signal,
    });

    expect(sseResponse.status).toBe(200);
    const reader = sseResponse.body?.getReader();
    expect(reader).toBeDefined();
    if (!reader) return;

    const decoder = new TextDecoder();

    // 1. First chunk must deliver snapshot WITH config
    const firstChunk = await reader.read();
    expect(firstChunk.done).toBe(false);
    const firstText = decoder.decode(firstChunk.value);
    expect(firstText).toContain('event: snapshot');
    expect(firstText).toContain('"config":');
    expect(firstText).toContain('"layouts":');

    // 2. Trigger config update via API
    const updatedLayout = configStore.getConfig();
    updatedLayout.layouts.horizontal.widgets['gift-alerts'].defaultDurationMs = 5500;

    fetch(`${baseUrl}/api/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Host: `127.0.0.1:${server.port}` },
      body: JSON.stringify(updatedLayout),
    }).catch(() => {});

    // 3. Verify SSE client receives config.updated event without replay of gifts
    let receivedConfigUpdated = false;
    for (let i = 0; i < 5; i++) {
      const chunk = await reader.read();
      if (chunk.done) break;
      const text = decoder.decode(chunk.value);
      if (text.includes('event: config.updated') && text.includes('5500')) {
        receivedConfigUpdated = true;
        break;
      }
    }

    expect(receivedConfigUpdated).toBe(true);
    controller.abort();
  });
});

describe('Likes-Goal Widget Progress & Reset Logic', () => {
  it('calculates progress percentage and reached state accurately', () => {
    const targetLikes = 1000;
    const initialLikes = 0;

    function calculateLikesGoal(totalLikes: number, target: number) {
      const current = Math.max(0, totalLikes);
      const percentage = Math.min(100, Math.round((current / target) * 100));
      const isReached = current >= target;
      return { current, target, percentage, isReached };
    }

    // 0 likes
    expect(calculateLikesGoal(0, targetLikes)).toEqual({
      current: 0,
      target: 1000,
      percentage: 0,
      isReached: false,
    });

    // 350 likes (35%)
    expect(calculateLikesGoal(350, targetLikes)).toEqual({
      current: 350,
      target: 1000,
      percentage: 35,
      isReached: false,
    });

    // Exactly 1000 likes (100% and isReached: true)
    expect(calculateLikesGoal(1000, targetLikes)).toEqual({
      current: 1000,
      target: 1000,
      percentage: 100,
      isReached: true,
    });

    // 1500 likes (clamped to 100% bar and isReached: true)
    expect(calculateLikesGoal(1500, targetLikes)).toEqual({
      current: 1500,
      target: 1000,
      percentage: 100,
      isReached: true,
    });
  });

  it('resets likes goal count on profile switch', async () => {
    const session = new SessionManager({ overlayToken: 'goal-token' });
    await session.connect('@streamer_one', { isSimulated: true });

    // Simulate likes accumulated
    session.handleLike({ id: 'goal-like-1', count: 400 });
    expect(session.totalLikes).toBe(400);

    // Switch streamer profile
    await session.connect('@streamer_two', { isSimulated: true });

    // Likes reset to 0 for new room
    expect(session.totalLikes).toBe(0);
    expect(session.getSnapshot().totalLikes).toBe(0);
  });
});

describe('Gift Alert Rules Precedence and Matching Engine', () => {
  const rules: GiftAlertRule[] = [
    {
      id: 'rule-galaxy',
      name: 'Galáxia / Presente Épico',
      giftId: 'galaxy',
      minCount: 1,
      durationMs: 7000,
      bannerColor: '#9333ea',
      textColor: '#ffffff',
    },
    {
      id: 'rule-mega-combo',
      name: 'Combo Gigante (10+)',
      minCount: 10,
      durationMs: 6000,
      bannerColor: '#f59e0b',
      textColor: '#ffffff',
    },
    {
      id: 'rule-rose-5',
      name: 'Rosas (5+)',
      giftId: 'rose',
      minCount: 5,
      durationMs: 5000,
      bannerColor: '#ef4444',
      textColor: '#ffffff',
    },
  ];

  it('matches first specific giftId rule regardless of count if minCount met', () => {
    const match = matchGiftAlertRule(rules, { giftId: 'galaxy', count: 1 });
    expect(match.ruleId).toBe('rule-galaxy');
    expect(match.durationMs).toBe(7000);
    expect(match.bannerColor).toBe('#9333ea');
  });

  it('matches count-based rule when giftId does not match first rule', () => {
    // Gift is 'ice_cream' (not galaxy), but count is 15 -> matches rule-mega-combo
    const match = matchGiftAlertRule(rules, { giftId: 'ice_cream', count: 15 });
    expect(match.ruleId).toBe('rule-mega-combo');
    expect(match.durationMs).toBe(6000);
    expect(match.bannerColor).toBe('#f59e0b');
  });

  it('matches third rule for rose with count 6 (not meeting combo rule 10)', () => {
    const match = matchGiftAlertRule(rules, { giftId: 'rose', count: 6 });
    expect(match.ruleId).toBe('rule-rose-5');
    expect(match.durationMs).toBe(5000);
    expect(match.bannerColor).toBe('#ef4444');
  });

  it('falls back to defaultDurationMs and default styling when no rule matches', () => {
    // Single rose does not match galaxy, does not match 10+, does not match rose 5+
    const match = matchGiftAlertRule(rules, { giftId: 'rose', count: 1 }, 4000);
    expect(match.ruleId).toBeUndefined();
    expect(match.durationMs).toBe(4000);
    expect(match.bannerColor).toBeUndefined();
  });
});
