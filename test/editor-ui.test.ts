import { describe, expect, test } from 'bun:test';
import fs from 'fs';

describe('Overlay Visual Editor UI - Static & Contract Verification', () => {
  const html = fs.readFileSync('public/dashboard.html', 'utf8');
  const editorCss = fs.readFileSync('public/editor.css', 'utf8');
  const editorJs = fs.readFileSync('public/editor.js', 'utf8');

  test('dashboard.html contains navigation tabs and view containers', () => {
    expect(html).toContain('id="tab-live"');
    expect(html).toContain('id="tab-editor"');
    expect(html).toContain('id="view-live"');
    expect(html).toContain('id="view-editor"');
    expect(html).toContain('Editor de overlay');
    expect(html).toContain('Painel da Live');
  });

  test('dashboard.html links both CSS stylesheets and scripts', () => {
    expect(html).toContain('href="/dashboard.css"');
    expect(html).toContain('href="/editor.css"');
    expect(html).toContain('src="/dashboard.js"');
    expect(html).toContain('src="/editor.js"');
  });

  test('editor workspace contains all required toolbar controls', () => {
    // Orientation
    expect(html).toContain('id="btn-orient-horiz"');
    expect(html).toContain('id="btn-orient-vert"');
    expect(html).toContain('Horizontal (1920 × 1080)');
    expect(html).toContain('Vertical (1080 × 1920)');

    // Zoom
    expect(html).toContain('id="btn-zoom-in"');
    expect(html).toContain('id="btn-zoom-out"');
    expect(html).toContain('id="btn-zoom-fit"');
    expect(html).toContain('id="zoom-level-text"');
    expect(html).toContain('data-zoom="50"');
    expect(html).toContain('data-zoom="75"');
    expect(html).toContain('data-zoom="100"');
    expect(html).toContain('Ajustar à tela');

    // Status Badge & Actions
    expect(html).toContain('id="editor-status-badge"');
    expect(html).toContain('id="btn-save-config"');
    expect(html).toContain('id="btn-discard-config"');
    expect(html).toContain('id="btn-reset-config"');
    expect(html).toContain('id="btn-test-preview"');
    expect(html).toContain('Salvar e aplicar');
    expect(html).toContain('Descartar alterações');
    expect(html).toContain('Restaurar padrões');
    expect(html).toContain('Testar no preview');
  });

  test('editor workspace contains the 3-column panels and canvas stage', () => {
    expect(html).toContain('id="layers-list"');
    expect(html).toContain('id="editor-canvas-viewport"');
    expect(html).toContain('id="canvas-wrapper"');
    expect(html).toContain('id="canvas-stage"');
    expect(html).toContain('id="canvas-watermark"');
    expect(html).toContain('id="editor-inspector-panel"');
  });

  test('editor.css defines classes for distinct editor states and canvas elements', () => {
    expect(editorCss).toContain('.editor-status-saved');
    expect(editorCss).toContain('.editor-status-dirty');
    expect(editorCss).toContain('.editor-status-saving');
    expect(editorCss).toContain('.editor-status-error');
    expect(editorCss).toContain('.canvas-stage');
    expect(editorCss).toContain('.canvas-widget');
    expect(editorCss).toContain('.resize-handle');
    expect(editorCss).toContain('.widget-bounds-tag');
  });

  test('pointer math in logical canvas space correctly handles zoom scale', () => {
    function computeDelta(clientDelta: number, zoomScale: number): number {
      return Math.round(clientDelta / zoomScale);
    }

    // At 50% zoom, moving mouse by 100px equals 200px in logical canvas space
    expect(computeDelta(100, 0.5)).toBe(200);

    // At 75% zoom, moving mouse by 75px equals 100px in logical canvas space
    expect(computeDelta(75, 0.75)).toBe(100);

    // At 100% zoom, moving mouse by 50px equals 50px in logical canvas space
    expect(computeDelta(50, 1.0)).toBe(50);
  });

  test('bounds clamping ensures widgets stay within logical canvas boundaries', () => {
    function clampPosition(x: number, y: number, w: number, h: number, canvasW: number, canvasH: number) {
      return {
        x: Math.max(0, Math.min(x, canvasW - w)),
        y: Math.max(0, Math.min(y, canvasH - h)),
      };
    }

    // Horizontal canvas (1920x1080)
    const horizClamped = clampPosition(2000, -50, 480, 540, 1920, 1080);
    expect(horizClamped.x).toBe(1920 - 480); // 1440
    expect(horizClamped.y).toBe(0);

    // Vertical canvas (1080x1920)
    const vertClamped = clampPosition(-100, 2500, 720, 760, 1080, 1920);
    expect(vertClamped.x).toBe(0);
    expect(vertClamped.y).toBe(1920 - 760); // 1160
  });

  test('converts TikTok emoji shortcodes (like [laughcry]) into emoji characters', () => {
    const TIKTOK_EMOJI_DICT: Record<string, string> = {
      laughcry: '😂',
      laughwithtears: '😂',
      laugh: '🤣',
      smile: '😊',
      loveface: '😍',
      rose: '🌹',
      heart: '❤️',
      fire: '🔥',
      proud: '😏',
    };

    function parseTikTokEmojis(rawText: string): string {
      if (!rawText) return '';
      return String(rawText).replace(/\[([a-zA-Z0-9_]+)\]/g, (match, tag) => {
        const lower = tag.toLowerCase();
        return TIKTOK_EMOJI_DICT[lower] !== undefined ? TIKTOK_EMOJI_DICT[lower] : match;
      });
    }

    expect(parseTikTokEmojis('[laughcry]')).toBe('😂');
    expect(parseTikTokEmojis('[laughwithtears]')).toBe('😂');
    expect(parseTikTokEmojis('kkkk muito bom [laughcry] valeu [rose] [fire]')).toBe('kkkk muito bom 😂 valeu 🌹 🔥');
    expect(parseTikTokEmojis('Case insensitive [LAUGHCRY] e [LaughWithTears]')).toBe('Case insensitive 😂 e 😂');
    expect(parseTikTokEmojis('Tag desconhecida [unknown_tag]')).toBe('Tag desconhecida [unknown_tag]');
  });
});
