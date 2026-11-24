/**
 * Streamer Space - Overlay Configuration Contracts
 * Schema Version: 1.0
 */

export type WidgetId = 'chat' | 'likes' | 'viewers' | 'gift-alerts' | 'likes-goal';

export type Orientation = 'horizontal' | 'vertical';

export interface WidgetPosition {
  x: number; // in logical canvas pixels
  y: number; // in logical canvas pixels
  width: number; // in logical canvas pixels
  height: number; // in logical canvas pixels
  zIndex: number;
}

export interface WidgetCommonStyle {
  fontSize?: number; // in px
  textColor?: string; // hex or rgba
  backgroundColor?: string; // hex or rgba
  opacity?: number; // 0.0 to 1.0
  borderRadius?: number; // in px
}

export interface ChatWidgetConfig {
  id: 'chat';
  visible: boolean;
  position: WidgetPosition;
  style: WidgetCommonStyle;
  messageLimit: number;
  showAvatar: boolean;
}

export interface LikesWidgetConfig {
  id: 'likes';
  visible: boolean;
  position: WidgetPosition;
  style: WidgetCommonStyle;
}

export interface ViewersWidgetConfig {
  id: 'viewers';
  visible: boolean;
  position: WidgetPosition;
  style: WidgetCommonStyle;
}

export interface GiftAlertRule {
  id: string;
  name: string;
  giftId?: string | number; // filter by specific gift ID (optional)
  minCount?: number; // filter by minimum quantity (optional)
  durationMs: number; // custom duration in ms
  bannerColor?: string;
  textColor?: string;
}

export interface GiftAlertsWidgetConfig {
  id: 'gift-alerts';
  visible: boolean;
  position: WidgetPosition;
  style: WidgetCommonStyle;
  defaultDurationMs: number;
  rules: GiftAlertRule[];
}

export interface LikesGoalWidgetConfig {
  id: 'likes-goal';
  visible: boolean;
  position: WidgetPosition;
  style: WidgetCommonStyle;
  title: string;
  targetLikes: number;
  initialLikes?: number;
}

export type AnyWidgetConfig =
  | ChatWidgetConfig
  | LikesWidgetConfig
  | ViewersWidgetConfig
  | GiftAlertsWidgetConfig
  | LikesGoalWidgetConfig;

export interface LayoutComposition {
  canvasWidth: number;
  canvasHeight: number;
  widgets: {
    'chat': ChatWidgetConfig;
    'likes': LikesWidgetConfig;
    'viewers': ViewersWidgetConfig;
    'gift-alerts': GiftAlertsWidgetConfig;
    'likes-goal': LikesGoalWidgetConfig;
  };
}

export interface OverlayConfig {
  version: '1.0';
  lastUpdatedAt: string; // ISO 8601
  layouts: {
    horizontal: LayoutComposition; // 1920x1080
    vertical: LayoutComposition;   // 1080x1920
  };
}

/**
 * Default Layouts initialized from the baseline presentation
 */
export function createDefaultOverlayConfig(): OverlayConfig {
  return {
    version: '1.0',
    lastUpdatedAt: new Date().toISOString(),
    layouts: {
      horizontal: {
        canvasWidth: 1920,
        canvasHeight: 1080,
        widgets: {
          'gift-alerts': {
            id: 'gift-alerts',
            visible: true,
            position: { x: 480, y: 30, width: 960, height: 180, zIndex: 50 },
            style: {
              fontSize: 22,
              textColor: '#ffffff',
              backgroundColor: 'rgba(15, 23, 42, 0.85)',
              opacity: 1,
              borderRadius: 16,
            },
            defaultDurationMs: 4000,
            rules: [
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
            ],
          },
          'likes': {
            id: 'likes',
            visible: true,
            position: { x: 1500, y: 30, width: 380, height: 74, zIndex: 30 },
            style: {
              fontSize: 22,
              textColor: '#ffffff',
              backgroundColor: 'rgba(12, 16, 26, 0.82)',
              opacity: 1,
              borderRadius: 999,
            },
          },
          'viewers': {
            id: 'viewers',
            visible: true,
            position: { x: 1700, y: 116, width: 180, height: 56, zIndex: 20 },
            style: {
              fontSize: 20,
              textColor: '#38bdf8',
              backgroundColor: 'rgba(12, 16, 26, 0.82)',
              opacity: 1,
              borderRadius: 999,
            },
          },
          'chat': {
            id: 'chat',
            visible: true,
            position: { x: 40, y: 440, width: 540, height: 600, zIndex: 40 },
            style: {
              fontSize: 22,
              textColor: '#f8fafc',
              backgroundColor: 'rgba(12, 16, 26, 0.82)',
              opacity: 1,
              borderRadius: 12,
            },
            messageLimit: 25,
            showAvatar: true,
          },
          'likes-goal': {
            id: 'likes-goal',
            visible: false,
            position: { x: 1380, y: 900, width: 500, height: 140, zIndex: 25 },
            style: {
              fontSize: 20,
              textColor: '#ffffff',
              backgroundColor: 'rgba(12, 16, 26, 0.85)',
              opacity: 1,
              borderRadius: 16,
            },
            title: 'Meta de Curtidas',
            targetLikes: 1000,
            initialLikes: 0,
          },
        },
      },
      vertical: {
        canvasWidth: 1080,
        canvasHeight: 1920,
        widgets: {
          'gift-alerts': {
            id: 'gift-alerts',
            visible: true,
            position: { x: 60, y: 80, width: 960, height: 200, zIndex: 50 },
            style: {
              fontSize: 18,
              textColor: '#ffffff',
              backgroundColor: 'rgba(15, 23, 42, 0.85)',
              opacity: 1,
              borderRadius: 16,
            },
            defaultDurationMs: 4000,
            rules: [
              {
                id: 'rule-galaxy-v',
                name: 'Galáxia / Presente Épico',
                giftId: 'galaxy',
                minCount: 1,
                durationMs: 7000,
                bannerColor: '#9333ea',
                textColor: '#ffffff',
              },
            ],
          },
          'likes': {
            id: 'likes',
            visible: true,
            position: { x: 700, y: 300, width: 340, height: 70, zIndex: 30 },
            style: {
              fontSize: 18,
              textColor: '#ffffff',
              backgroundColor: 'rgba(12, 16, 26, 0.82)',
              opacity: 1,
              borderRadius: 999,
            },
          },
          'viewers': {
            id: 'viewers',
            visible: true,
            position: { x: 840, y: 380, width: 200, height: 50, zIndex: 20 },
            style: {
              fontSize: 16,
              textColor: '#38bdf8',
              backgroundColor: 'rgba(12, 16, 26, 0.82)',
              opacity: 1,
              borderRadius: 999,
            },
          },
          'chat': {
            id: 'chat',
            visible: true,
            position: { x: 40, y: 1100, width: 720, height: 760, zIndex: 40 },
            style: {
              fontSize: 16,
              textColor: '#f8fafc',
              backgroundColor: 'rgba(12, 16, 26, 0.82)',
              opacity: 1,
              borderRadius: 12,
            },
            messageLimit: 30,
            showAvatar: true,
          },
          'likes-goal': {
            id: 'likes-goal',
            visible: false,
            position: { x: 60, y: 940, width: 640, height: 130, zIndex: 25 },
            style: {
              fontSize: 16,
              textColor: '#ffffff',
              backgroundColor: 'rgba(12, 16, 26, 0.85)',
              opacity: 1,
              borderRadius: 16,
            },
            title: 'Meta de Curtidas',
            targetLikes: 1000,
            initialLikes: 0,
          },
        },
      },
    },
  };
}

/**
 * Validates and clamps an arbitrary object into a valid OverlayConfig
 */
export function validateOverlayConfig(input: any): { valid: boolean; config?: OverlayConfig; error?: string } {
  if (!input || typeof input !== 'object') {
    return { valid: false, error: 'Configuração deve ser um objeto JSON' };
  }

  if (input.version !== '1.0') {
    return { valid: false, error: 'Versão do schema inválida (esperado "1.0")' };
  }

  if (!input.layouts || typeof input.layouts !== 'object') {
    return { valid: false, error: 'layouts deve ser um objeto' };
  }

  const defaultConf = createDefaultOverlayConfig();

  function validateLayout(layout: any, def: LayoutComposition): LayoutComposition {
    if (!layout || typeof layout !== 'object') return def;
    const canvasWidth = typeof layout.canvasWidth === 'number' && layout.canvasWidth > 0 ? layout.canvasWidth : def.canvasWidth;
    const canvasHeight = typeof layout.canvasHeight === 'number' && layout.canvasHeight > 0 ? layout.canvasHeight : def.canvasHeight;

    const widgetsInput = layout.widgets || {};
    const validatedWidgets: any = {};

    const widgetIds: WidgetId[] = ['chat', 'likes', 'viewers', 'gift-alerts', 'likes-goal'];
    for (const wId of widgetIds) {
      const defW = def.widgets[wId];
      const curW = widgetsInput[wId] || {};

      const pos = curW.position || {};
      const width = typeof pos.width === 'number' && pos.width > 20 ? Math.min(pos.width, canvasWidth) : defW.position.width;
      const height = typeof pos.height === 'number' && pos.height > 20 ? Math.min(pos.height, canvasHeight) : defW.position.height;
      const x = typeof pos.x === 'number' ? Math.max(0, Math.min(pos.x, canvasWidth - width)) : defW.position.x;
      const y = typeof pos.y === 'number' ? Math.max(0, Math.min(pos.y, canvasHeight - height)) : defW.position.y;
      const zIndex = typeof pos.zIndex === 'number' ? Math.max(0, Math.min(pos.zIndex, 999)) : defW.position.zIndex;

      const style = curW.style || {};
      const validatedStyle: WidgetCommonStyle = {
        fontSize: typeof style.fontSize === 'number' ? Math.max(10, Math.min(style.fontSize, 72)) : defW.style.fontSize,
        textColor: typeof style.textColor === 'string' ? style.textColor.slice(0, 32) : defW.style.textColor,
        backgroundColor: typeof style.backgroundColor === 'string' ? style.backgroundColor.slice(0, 64) : defW.style.backgroundColor,
        opacity: typeof style.opacity === 'number' ? Math.max(0, Math.min(style.opacity, 1)) : defW.style.opacity,
        borderRadius: typeof style.borderRadius === 'number' ? Math.max(0, Math.min(style.borderRadius, 999)) : defW.style.borderRadius,
      };

      const baseValidated = {
        id: wId,
        visible: typeof curW.visible === 'boolean' ? curW.visible : defW.visible,
        position: { x, y, width, height, zIndex },
        style: validatedStyle,
      };

      if (wId === 'chat') {
        validatedWidgets[wId] = {
          ...baseValidated,
          messageLimit: typeof curW.messageLimit === 'number' ? Math.max(5, Math.min(curW.messageLimit, 100)) : (defW as ChatWidgetConfig).messageLimit,
          showAvatar: typeof curW.showAvatar === 'boolean' ? curW.showAvatar : (defW as ChatWidgetConfig).showAvatar,
        };
      } else if (wId === 'gift-alerts') {
        const rules = Array.isArray(curW.rules) ? curW.rules.slice(0, 20).map((r: any, idx: number) => ({
          id: typeof r.id === 'string' ? r.id.slice(0, 32) : `rule-${idx}`,
          name: typeof r.name === 'string' ? r.name.slice(0, 64) : `Regra ${idx + 1}`,
          giftId: r.giftId !== undefined ? String(r.giftId).slice(0, 32) : undefined,
          minCount: typeof r.minCount === 'number' ? Math.max(1, r.minCount) : undefined,
          durationMs: typeof r.durationMs === 'number' ? Math.max(1000, Math.min(r.durationMs, 30000)) : 4000,
          bannerColor: typeof r.bannerColor === 'string' ? r.bannerColor.slice(0, 32) : undefined,
          textColor: typeof r.textColor === 'string' ? r.textColor.slice(0, 32) : undefined,
        })) : (defW as GiftAlertsWidgetConfig).rules;

        validatedWidgets[wId] = {
          ...baseValidated,
          defaultDurationMs: typeof curW.defaultDurationMs === 'number' ? Math.max(1000, Math.min(curW.defaultDurationMs, 30000)) : (defW as GiftAlertsWidgetConfig).defaultDurationMs,
          rules,
        };
      } else if (wId === 'likes-goal') {
        validatedWidgets[wId] = {
          ...baseValidated,
          title: typeof curW.title === 'string' ? curW.title.slice(0, 64) : (defW as LikesGoalWidgetConfig).title,
          targetLikes: typeof curW.targetLikes === 'number' ? Math.max(1, curW.targetLikes) : (defW as LikesGoalWidgetConfig).targetLikes,
          initialLikes: typeof curW.initialLikes === 'number' ? Math.max(0, curW.initialLikes) : (defW as LikesGoalWidgetConfig).initialLikes,
        };
      } else {
        validatedWidgets[wId] = baseValidated;
      }
    }

    return {
      canvasWidth,
      canvasHeight,
      widgets: validatedWidgets,
    };
  }

  const validHorizontal = validateLayout(input.layouts.horizontal, defaultConf.layouts.horizontal);
  const validVertical = validateLayout(input.layouts.vertical, defaultConf.layouts.vertical);

  return {
    valid: true,
    config: {
      version: '1.0',
      lastUpdatedAt: new Date().toISOString(),
      layouts: {
        horizontal: validHorizontal,
        vertical: validVertical,
      },
    },
  };
}
