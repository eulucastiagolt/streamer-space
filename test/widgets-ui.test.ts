import { describe, expect, test } from 'bun:test';
import fs from 'fs';

describe('Modular Widgets & URLs Section - Contract & UI Verification', () => {
  const html = fs.readFileSync('public/dashboard.html', 'utf8');
  const js = fs.readFileSync('public/dashboard.js', 'utf8');

  test('dashboard.html contains Widgets e URLs para OBS section with all 5 widgets', () => {
    expect(html).toContain('Widgets e URLs para OBS');
    expect(html).toContain('Chat da Live');
    expect(html).toContain('Contador de Curtidas');
    expect(html).toContain('Espectadores');
    expect(html).toContain('Alertas de Presentes');
    expect(html).toContain('Meta de Curtidas');
  });

  test('each widget card has dedicated OBS URL field, copy button, preview button, and config drawer', () => {
    const widgetKeys = ['chat', 'likes', 'viewers', 'gift-alerts', 'likes-goal'];
    for (const key of widgetKeys) {
      expect(html).toContain(`id="url-widget-${key}"`);
      expect(html).toContain(`data-widget="${key}"`);
      expect(html).toContain(`data-target="config-${key}"`);
      expect(html).toContain(`id="config-${key}"`);
    }
  });

  test('dashboard.html contains styling and widget-specific inputs in config drawers', () => {
    // Chat specific inputs
    expect(html).toContain('data-cfg="chat.messageLimit"');
    expect(html).toContain('data-cfg="chat.showAvatar"');

    // Gift alerts specific inputs
    expect(html).toContain('id="cfg-gift-dur-sec"');
    expect(html).toContain('id="gift-rules-editor-container"');
    expect(html).toContain('id="btn-add-gift-rule"');
    expect(html).toContain('id="btn-trigger-test-alert"');

    // Likes goal specific inputs
    expect(html).toContain('data-cfg="likes-goal.title"');
    expect(html).toContain('data-cfg="likes-goal.targetLikes"');
    expect(html).toContain('data-cfg="likes-goal.initialLikes"');
  });

  test('dashboard.html is a clean single-view layout without obsolete canvas editor elements', () => {
    expect(html).not.toContain('id="view-editor"');
    expect(html).not.toContain('id="editor-canvas-viewport"');
    expect(html).not.toContain('id="canvas-stage"');
    expect(html).not.toContain('editor.js');
    expect(html).not.toContain('editor.css');
  });

  test('dashboard.js handles per-widget dedicated URLs and save triggers', () => {
    expect(js).toContain('/overlay/${overlayToken}/${widget}');
    expect(js).toContain('saveWidgetConfig');
    expect(js).toContain('/api/config');
  });
});
