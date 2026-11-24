import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import { existsSync, unlinkSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  createDefaultOverlayConfig,
  validateOverlayConfig,
  type OverlayConfig,
} from '../src/types/config.js';
import { ConfigStore } from '../src/server/config-store.js';

describe('Overlay Config Schema Validation', () => {
  it('generates a valid default configuration with both orientations', () => {
    const config = createDefaultOverlayConfig();
    expect(config.version).toBe('1.0');
    expect(config.layouts).toBeDefined();

    // Horizontal 1920x1080
    expect(config.layouts.horizontal.canvasWidth).toBe(1920);
    expect(config.layouts.horizontal.canvasHeight).toBe(1080);
    expect(config.layouts.horizontal.widgets['chat']).toBeDefined();
    expect(config.layouts.horizontal.widgets['likes']).toBeDefined();
    expect(config.layouts.horizontal.widgets['viewers']).toBeDefined();
    expect(config.layouts.horizontal.widgets['gift-alerts']).toBeDefined();
    expect(config.layouts.horizontal.widgets['likes-goal']).toBeDefined();

    // Vertical 1080x1920
    expect(config.layouts.vertical.canvasWidth).toBe(1080);
    expect(config.layouts.vertical.canvasHeight).toBe(1920);
    expect(config.layouts.vertical.widgets['chat']).toBeDefined();
    expect(config.layouts.vertical.widgets['likes']).toBeDefined();
    expect(config.layouts.vertical.widgets['viewers']).toBeDefined();
    expect(config.layouts.vertical.widgets['gift-alerts']).toBeDefined();
    expect(config.layouts.vertical.widgets['likes-goal']).toBeDefined();

    const validation = validateOverlayConfig(config);
    expect(validation.valid).toBe(true);
    expect(validation.config).toBeDefined();
  });

  it('rejects non-object inputs and invalid versions', () => {
    expect(validateOverlayConfig(null).valid).toBe(false);
    expect(validateOverlayConfig('invalid string').valid).toBe(false);
    expect(validateOverlayConfig({ version: '2.0', layouts: {} }).valid).toBe(false);
    expect(validateOverlayConfig({ version: '1.0' }).valid).toBe(false);
  });

  it('clamps out-of-bounds positions, styles and dimensions', () => {
    const raw: any = {
      version: '1.0',
      layouts: {
        horizontal: {
          canvasWidth: 1920,
          canvasHeight: 1080,
          widgets: {
            chat: {
              visible: true,
              position: {
                x: 2500, // beyond width
                y: -100, // negative
                width: 5000, // too wide
                height: 5, // too small
                zIndex: 2000, // beyond max zIndex
              },
              style: {
                fontSize: 200, // too large
                opacity: 5, // > 1
                borderRadius: -10, // negative
              },
              messageLimit: 500, // > 100
              showAvatar: true,
            },
          },
        },
        vertical: {},
      },
    };

    const res = validateOverlayConfig(raw);
    expect(res.valid).toBe(true);
    expect(res.config).toBeDefined();

    const chatWidget = res.config!.layouts.horizontal.widgets.chat;
    // Width clamped to canvas width (1920)
    expect(chatWidget.position.width).toBe(1920);
    // Height clamped to at least 20
    expect(chatWidget.position.height).toBeGreaterThanOrEqual(20);
    // X clamped to canvasWidth - width = 0
    expect(chatWidget.position.x).toBe(0);
    // Y clamped to at least 0
    expect(chatWidget.position.y).toBe(0);
    // zIndex clamped to 999
    expect(chatWidget.position.zIndex).toBe(999);
    // Font size clamped to 72
    expect(chatWidget.style.fontSize).toBe(72);
    // Opacity clamped to 1.0
    expect(chatWidget.style.opacity).toBe(1);
    // Message limit clamped to 100
    expect(chatWidget.messageLimit).toBe(100);
  });

  it('validates gift alert rules and likes goal configuration', () => {
    const raw: any = {
      version: '1.0',
      layouts: {
        horizontal: {
          canvasWidth: 1920,
          canvasHeight: 1080,
          widgets: {
            'gift-alerts': {
              visible: true,
              position: { x: 100, y: 100, width: 400, height: 100, zIndex: 10 },
              style: {},
              defaultDurationMs: 500, // < 1000 ms clamped to 1000
              rules: [
                {
                  id: 'rule-test',
                  name: 'Regra Especial',
                  giftId: 'rose',
                  minCount: 5,
                  durationMs: 45000, // > 30000 clamped to 30000
                  bannerColor: '#ff0000',
                  textColor: '#ffffff',
                },
              ],
            },
            'likes-goal': {
              visible: true,
              position: { x: 50, y: 50, width: 300, height: 80, zIndex: 10 },
              style: {},
              title: 'Minha Meta',
              targetLikes: 5000,
              initialLikes: 100,
            },
          },
        },
        vertical: {},
      },
    };

    const res = validateOverlayConfig(raw);
    expect(res.valid).toBe(true);

    const giftWidget = res.config!.layouts.horizontal.widgets['gift-alerts'];
    expect(giftWidget.defaultDurationMs).toBe(1000); // clamped min
    expect(giftWidget.rules.length).toBe(1);
    expect(giftWidget.rules[0].giftId).toBe('rose');
    expect(giftWidget.rules[0].minCount).toBe(5);
    expect(giftWidget.rules[0].durationMs).toBe(30000); // clamped max

    const goalWidget = res.config!.layouts.horizontal.widgets['likes-goal'];
    expect(goalWidget.title).toBe('Minha Meta');
    expect(goalWidget.targetLikes).toBe(5000);
    expect(goalWidget.initialLikes).toBe(100);
  });
});

describe('ConfigStore - Persistence, Atomicity & Recovery', () => {
  const testDir = join(process.cwd(), 'data', 'test-config-store');
  const testConfigFile = join(testDir, 'overlay-config.json');

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
    if (existsSync(testConfigFile)) {
      unlinkSync(testConfigFile);
    }
  });

  afterEach(() => {
    try {
      if (existsSync(testConfigFile)) unlinkSync(testConfigFile);
      const tmpFiles = Bun.spawnSync(['sh', '-c', `rm -rf "${testDir}"`]);
    } catch {}
  });

  it('initializes with default config and writes file atomically if not present', () => {
    expect(existsSync(testConfigFile)).toBe(false);

    const store = new ConfigStore(testConfigFile);
    expect(existsSync(testConfigFile)).toBe(true);

    const config = store.getConfig();
    expect(config.version).toBe('1.0');
    expect(config.layouts.horizontal.widgets.chat).toBeDefined();

    const fileContent = JSON.parse(readFileSync(testConfigFile, 'utf-8'));
    expect(fileContent.version).toBe('1.0');
  });

  it('saves valid configuration atomically to disk', () => {
    const store = new ConfigStore(testConfigFile);
    const initialConfig = store.getConfig();

    // Modify chat position
    const modified = JSON.parse(JSON.stringify(initialConfig));
    modified.layouts.horizontal.widgets.chat.position.x = 120;
    modified.layouts.horizontal.widgets.chat.position.y = 340;

    const saveRes = store.saveConfig(modified);
    expect(saveRes.success).toBe(true);
    expect(saveRes.config?.layouts.horizontal.widgets.chat.position.x).toBe(120);
    expect(saveRes.config?.layouts.horizontal.widgets.chat.position.y).toBe(340);

    // Verify on disk
    const onDisk = JSON.parse(readFileSync(testConfigFile, 'utf-8'));
    expect(onDisk.layouts.horizontal.widgets.chat.position.x).toBe(120);
    expect(onDisk.layouts.horizontal.widgets.chat.position.y).toBe(340);
  });

  it('recovers safely with default config when file is corrupt JSON without deleting the corrupt file', () => {
    const corruptContent = '{ "version": "1.0", "layouts": { invalid json syntax...';
    writeFileSync(testConfigFile, corruptContent, 'utf-8');

    const store = new ConfigStore(testConfigFile);
    const loaded = store.getConfig();

    // Recovers with valid default config
    expect(loaded.version).toBe('1.0');
    expect(loaded.layouts.horizontal.widgets.chat).toBeDefined();

    // Verifies corrupted file was NOT deleted
    expect(existsSync(testConfigFile)).toBe(true);
    expect(readFileSync(testConfigFile, 'utf-8')).toBe(corruptContent);
  });

  it('recovers safely with default config when file has invalid schema without deleting corrupt file', () => {
    const invalidSchema = JSON.stringify({ version: '999.0', invalid: true });
    writeFileSync(testConfigFile, invalidSchema, 'utf-8');

    const store = new ConfigStore(testConfigFile);
    const loaded = store.getConfig();

    expect(loaded.version).toBe('1.0');
    expect(loaded.layouts.horizontal.widgets.chat).toBeDefined();

    // File preserved
    expect(existsSync(testConfigFile)).toBe(true);
    expect(readFileSync(testConfigFile, 'utf-8')).toBe(invalidSchema);
  });

  it('resets configuration to defaults on resetConfig()', () => {
    const store = new ConfigStore(testConfigFile);
    const modified = store.getConfig();
    modified.layouts.horizontal.widgets.chat.visible = false;
    store.saveConfig(modified);

    expect(store.getConfig().layouts.horizontal.widgets.chat.visible).toBe(false);

    const reset = store.resetConfig();
    expect(reset.layouts.horizontal.widgets.chat.visible).toBe(true);

    const onDisk = JSON.parse(readFileSync(testConfigFile, 'utf-8'));
    expect(onDisk.layouts.horizontal.widgets.chat.visible).toBe(true);
  });
});
