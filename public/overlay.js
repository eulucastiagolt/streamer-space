/**
 * Streamer Space - OBS Studio Browser Source Overlay Script
 * Transparent, reactive via SSE, untrusted inputs sanitized via textContent
 * Dynamic configuration, multi-orientation layouts, likes goal, and custom gift alert rules
 */

(function () {
  'use strict';

  // Default Overlay Configuration (matches src/types/config.ts createDefaultOverlayConfig)
  const DEFAULT_OVERLAY_CONFIG = {
    version: '1.0',
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
              fontSize: 16,
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
            position: { x: 1540, y: 30, width: 340, height: 70, zIndex: 30 },
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
            position: { x: 1680, y: 110, width: 200, height: 50, zIndex: 20 },
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
            position: { x: 40, y: 500, width: 480, height: 540, zIndex: 40 },
            style: {
              fontSize: 15,
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
            position: { x: 1400, y: 920, width: 480, height: 120, zIndex: 25 },
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

  // Extract overlay token from URL: /overlay/:token
  function getOverlayToken() {
    const segments = window.location.pathname.split('/').filter(Boolean);
    const overlayIdx = segments.indexOf('overlay');
    if (overlayIdx !== -1 && segments[overlayIdx + 1]) {
      return segments[overlayIdx + 1];
    }
    const params = new URLSearchParams(window.location.search);
    return params.get('token') || 'default-token';
  }

  const token = getOverlayToken();

  // State
  let currentConfig = DEFAULT_OVERLAY_CONFIG;
  let currentSessionId = null;
  let totalLikes = 0;
  let currentViewerCount = undefined;
  let currentChatMessageLimit = 25;
  let currentShowAvatar = true;
  let isSnapshotProcessed = false;
  let eventSource = null;
  const alertQueue = [];
  let isAlertDisplaying = false;

  // DOM Elements
  const giftAlertsContainer = document.getElementById('gift-alerts-container');
  const chatWidget = document.getElementById('chat-widget');
  const chatMessages = document.getElementById('chat-messages');
  const likeStatBox = document.getElementById('like-stat-box');
  const overlayLikeCount = document.getElementById('overlay-like-count');
  const overlayLikeLabel = document.getElementById('overlay-like-label');
  const heartIcon = document.getElementById('heart-icon');
  const floatingHeartsContainer = document.getElementById('floating-hearts-container');
  const viewerStatBox = document.getElementById('viewer-stat-box');
  const overlayViewerCount = document.getElementById('overlay-viewer-count');

  // Likes Goal Elements
  const likesGoalWidget = document.getElementById('likes-goal-widget');
  const likesGoalTitle = document.getElementById('likes-goal-title');
  const likesGoalBadge = document.getElementById('likes-goal-badge');
  const likesGoalProgress = document.getElementById('likes-goal-progress');
  const likesGoalCurrent = document.getElementById('likes-goal-current');
  const likesGoalTarget = document.getElementById('likes-goal-target');
  const likesGoalPercentage = document.getElementById('likes-goal-percentage');

  /**
   * Determine orientation: vertical (height > width) or horizontal
   */
  function getOrientation() {
    return window.innerHeight > window.innerWidth ? 'vertical' : 'horizontal';
  }

  /**
   * Helper to safely extract config from different wrapper formats
   */
  function extractConfig(raw) {
    if (!raw) return null;
    if (raw.layouts) return raw;
    if (raw.config && raw.config.layouts) return raw.config;
    if (raw.data) {
      if (raw.data.layouts) return raw.data;
      if (raw.data.config && raw.data.config.layouts) return raw.data.config;
    }
    return null;
  }

  /**
   * Palette for author colors
   */
  const AUTHOR_COLOR_COUNT = 6;
  function getAuthorColorClass(name) {
    if (!name) return 'chat-author-color-0';
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = (hash << 5) - hash + name.charCodeAt(i);
      hash |= 0;
    }
    const idx = Math.abs(hash) % AUTHOR_COLOR_COUNT;
    return `chat-author-color-${idx}`;
  }

  // TikTok shortcode dictionary for platform secret emojis
  const TIKTOK_EMOJI_DICT = {
    laughcry: '😂',
    laughwithtears: '😂',
    laugh: '🤣',
    smile: '😊',
    happy: '😄',
    joyful: '😆',
    hehe: '🤭',
    funnyface: '🤪',
    loveface: '😍',
    lovely: '🥰',
    cute: '🥺',
    blink: '😉',
    cool: '😎',
    proud: '😏',
    pride: '😌',
    thinking: '🤔',
    awkward: '😅',
    flushed: '😳',
    shock: '😱',
    scream: '😱',
    surprised: '😮',
    astonish: '😲',
    stun: '😵',
    speechless: '😶',
    disdain: '😒',
    facewithrollingeyes: '🙄',
    sulk: '😤',
    angry: '😠',
    rage: '😡',
    evil: '😈',
    wicked: '😈',
    cry: '😢',
    weep: '😭',
    tears: '🥲',
    yummy: '😋',
    drool: '🤤',
    nap: '😴',
    slap: '🤦',
    shout: '🗣️',
    angel: '😇',
    greedy: '🤑',
    wow: '🤩',
    wronged: '🥺',
    rose: '🌹',
    heart: '❤️',
    fire: '🔥',
    clap: '👏',
    100: '💯',
    crown: '👑',
    star: '⭐',
    kiss: '😘',
    party: '🎉',
    sunglasses: '😎',
    thumbsup: '👍',
    salute: '🫡',
    skull: '💀',
    sob: '😭',
    rofl: '🤣',
    ok: '👌',
    pray: '🙏',
    flex: '💪',
  };

  function parseTikTokEmojis(rawText) {
    if (!rawText) return '';
    return String(rawText).replace(/\[([a-zA-Z0-9_]+)\]/g, (match, tag) => {
      const lower = tag.toLowerCase();
      return TIKTOK_EMOJI_DICT[lower] !== undefined ? TIKTOK_EMOJI_DICT[lower] : match;
    });
  }

  function renderCommentWithEmotes(container, rawText, emotes) {
    const formatted = parseTikTokEmojis(rawText);
    if (formatted) {
      container.appendChild(document.createTextNode(formatted));
    }
    if (Array.isArray(emotes) && emotes.length > 0) {
      emotes.forEach(em => {
        if (em && em.imageUrl) {
          const img = document.createElement('img');
          img.className = 'chat-custom-emote';
          img.src = em.imageUrl;
          img.alt = em.name || 'emote';
          img.referrerPolicy = 'no-referrer';
          img.onerror = function () {
            img.remove();
          };
          container.appendChild(img);
        }
      });
    }
  }

  /**
   * Render a chat message safely using textContent (XSS protection)
   * @param {Object} chatData 
   * @param {boolean} isInitialSnapshot 
   */
  function addChatMessage(chatData, isInitialSnapshot = false) {
    if (!chatData || !chatMessages) return;

    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';
    if (isInitialSnapshot) {
      bubble.style.animation = 'none'; // No entrance animation for initial snapshot
    }

    // Avatar image if available and avatar rendering is enabled
    if (chatData.profilePictureUrl && currentShowAvatar) {
      const avatarImg = document.createElement('img');
      avatarImg.className = 'chat-avatar';
      avatarImg.src = chatData.profilePictureUrl;
      avatarImg.alt = '';
      avatarImg.referrerPolicy = 'no-referrer';
      avatarImg.onerror = function () {
        avatarImg.remove();
      };
      bubble.appendChild(avatarImg);
    }

    // Badge if provided
    if (chatData.badge) {
      const badgeSpan = document.createElement('span');
      badgeSpan.className = 'chat-badge';
      badgeSpan.textContent = chatData.badge;
      bubble.appendChild(badgeSpan);
    }

    // Author name (Strictly textContent)
    const authorSpan = document.createElement('span');
    const authorName = chatData.displayName || chatData.username || 'Anônimo';
    authorSpan.className = `chat-author ${getAuthorColorClass(authorName)}`;
    authorSpan.textContent = `${authorName}:`;
    bubble.appendChild(authorSpan);

    // Message text with TikTok emoji parsing and custom stickers
    const textSpan = document.createElement('span');
    textSpan.className = 'chat-text';
    renderCommentWithEmotes(textSpan, chatData.comment || '', chatData.emotes);
    bubble.appendChild(textSpan);

    chatMessages.appendChild(bubble);

    // Limit visible chat messages
    const limit = currentChatMessageLimit || 25;
    while (chatMessages.children.length > limit) {
      chatMessages.removeChild(chatMessages.firstChild);
    }

    // Auto-scroll chat to latest message
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  /**
   * Update Meta de Curtidas ('likes-goal') Widget
   */
  function updateLikesGoal(likes) {
    if (typeof likes === 'number') {
      totalLikes = likes;
    }

    const orientation = getOrientation();
    const layout = (currentConfig && currentConfig.layouts && currentConfig.layouts[orientation])
      ? currentConfig.layouts[orientation]
      : null;
    const goalConfig = layout && layout.widgets && layout.widgets['likes-goal']
      ? layout.widgets['likes-goal']
      : null;

    if (!goalConfig || !likesGoalWidget) return;

    // Title
    if (likesGoalTitle) {
      likesGoalTitle.textContent = goalConfig.title || 'Meta de Curtidas';
    }

    const target = Math.max(1, goalConfig.targetLikes || 1000);
    const current = Math.max(0, totalLikes);
    const pct = Math.min(100, Math.floor((current / target) * 100));

    if (likesGoalCurrent) {
      likesGoalCurrent.textContent = current.toLocaleString('pt-BR');
    }
    if (likesGoalTarget) {
      likesGoalTarget.textContent = target.toLocaleString('pt-BR');
    }
    if (likesGoalPercentage) {
      likesGoalPercentage.textContent = `${pct}%`;
    }
    if (likesGoalProgress) {
      likesGoalProgress.style.width = `${pct}%`;
    }

    // Reached state badge
    if (likesGoalBadge) {
      if (current >= target) {
        likesGoalBadge.style.display = 'inline-flex';
        likesGoalWidget.classList.add('goal-reached');
        if (likesGoalProgress) likesGoalProgress.classList.add('progress-reached');
      } else {
        likesGoalBadge.style.display = 'none';
        likesGoalWidget.classList.remove('goal-reached');
        if (likesGoalProgress) likesGoalProgress.classList.remove('progress-reached');
      }
    }
  }

  /**
   * Update like counter, trigger heart pulse animation, and update goal
   */
  function updateLikes(count, label, total) {
    if (typeof total === 'number') {
      totalLikes = total;
    } else if (typeof count === 'number') {
      totalLikes += count;
    }

    if (overlayLikeCount) {
      overlayLikeCount.textContent = totalLikes.toLocaleString('pt-BR');
    }
    if (label && overlayLikeLabel) {
      overlayLikeLabel.textContent = label;
    }

    // Update goal widget
    updateLikesGoal(totalLikes);

    // Heartbeat pulse animation
    if (heartIcon) {
      heartIcon.classList.remove('heart-pulsing');
      void heartIcon.offsetWidth; // Trigger reflow
      heartIcon.classList.add('heart-pulsing');
    }

    // Spawn floating hearts
    const spawnCount = Math.min(count || 1, 6);
    for (let i = 0; i < spawnCount; i++) {
      setTimeout(() => spawnFloatingHeart(), i * 120);
    }
  }

  /**
   * Floating heart visual effect
   */
  function spawnFloatingHeart() {
    if (!floatingHeartsContainer) return;

    const heart = document.createElement('div');
    heart.className = 'floating-heart';
    
    const heartSymbols = ['❤️', '💖', '💕', '💓', '💗'];
    heart.textContent = heartSymbols[Math.floor(Math.random() * heartSymbols.length)];

    // Random horizontal position near like pill
    const randomLeft = 10 + Math.random() * 80;
    heart.style.left = `${randomLeft}px`;
    heart.style.bottom = '10px';

    floatingHeartsContainer.appendChild(heart);

    setTimeout(() => {
      if (heart.parentNode) {
        heart.parentNode.removeChild(heart);
      }
    }, 2000);
  }

  /**
   * Evaluate Rule for Finalized Gift Alerts ('gift-alerts')
   * Each rule has optional giftId and optional minCount.
   * First matching rule determines durationMs, bannerColor, textColor.
   * Fallback to defaultDurationMs and default styles.
   */
  function evaluateGiftAlertRule(giftData) {
    const orientation = getOrientation();
    const layout = (currentConfig && currentConfig.layouts && currentConfig.layouts[orientation])
      ? currentConfig.layouts[orientation]
      : null;
    const widgetConfig = layout && layout.widgets && layout.widgets['gift-alerts']
      ? layout.widgets['gift-alerts']
      : null;

    const defaultDuration = (widgetConfig && typeof widgetConfig.defaultDurationMs === 'number')
      ? widgetConfig.defaultDurationMs
      : 4000;

    const rules = (widgetConfig && Array.isArray(widgetConfig.rules)) ? widgetConfig.rules : [];
    const count = typeof giftData.count === 'number' ? giftData.count : 1;
    const giftIdStr = giftData.giftId !== undefined ? String(giftData.giftId).toLowerCase().trim() : '';
    const giftNameStr = giftData.giftName ? String(giftData.giftName).toLowerCase().trim() : '';

    for (const rule of rules) {
      let matchGiftId = true;
      let matchMinCount = true;

      // 1. Filter by giftId (optional)
      if (rule.giftId !== undefined && rule.giftId !== null && String(rule.giftId).trim() !== '') {
        const targetId = String(rule.giftId).toLowerCase().trim();
        matchGiftId = (targetId === giftIdStr || targetId === giftNameStr);
      }

      // 2. Filter by minimum quantity (optional)
      if (rule.minCount !== undefined && rule.minCount !== null && typeof rule.minCount === 'number') {
        matchMinCount = (count >= rule.minCount);
      }

      if (matchGiftId && matchMinCount) {
        return {
          matched: true,
          ruleId: rule.id,
          durationMs: (typeof rule.durationMs === 'number' && rule.durationMs > 0) ? rule.durationMs : defaultDuration,
          bannerColor: rule.bannerColor || null,
          textColor: rule.textColor || null,
        };
      }
    }

    return {
      matched: false,
      ruleId: null,
      durationMs: defaultDuration,
      bannerColor: null,
      textColor: null,
    };
  }

  /**
   * Display Gift Alert Popup with multiplier & combo animations
   * Evaluates rules for duration, bannerColor and textColor
   * (Strictly uses textContent for sender and gift names)
   */
  function displayGiftAlert(giftData) {
    if (!giftData || !giftAlertsContainer) return;

    const ruleResult = evaluateGiftAlertRule(giftData);
    const count = giftData.count || 1;
    const sender = giftData.displayName || giftData.username || 'Espectador';
    const giftName = giftData.giftName || 'Presente';

    const card = document.createElement('div');
    card.className = 'gift-alert-card';

    // Apply rule custom bannerColor / textColor if specified
    if (ruleResult.bannerColor) {
      card.style.borderColor = ruleResult.bannerColor;
      card.style.background = `linear-gradient(135deg, ${ruleResult.bannerColor}dd 0%, rgba(20, 20, 30, 0.95) 100%)`;
      card.style.boxShadow = `0 8px 32px rgba(0, 0, 0, 0.6), 0 0 24px ${ruleResult.bannerColor}88`;
    }

    if (ruleResult.textColor) {
      card.style.color = ruleResult.textColor;
    }

    // Gift icon box
    const iconBox = document.createElement('div');
    iconBox.className = 'gift-icon-box';
    if (giftData.giftPictureUrl) {
      const img = document.createElement('img');
      img.src = giftData.giftPictureUrl;
      img.alt = giftName;
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'contain';
      iconBox.appendChild(img);
    } else {
      iconBox.textContent = '🎁';
    }

    // Details
    const details = document.createElement('div');
    details.className = 'gift-details';

    const senderEl = document.createElement('div');
    senderEl.className = 'gift-sender-name';
    senderEl.textContent = sender; // textContent sanitization
    if (ruleResult.textColor) senderEl.style.color = ruleResult.textColor;

    const actionText = document.createElement('div');
    actionText.className = 'gift-action-text';
    actionText.textContent = 'enviou ';
    if (ruleResult.textColor) actionText.style.color = ruleResult.textColor;
    
    const giftNameStrong = document.createElement('strong');
    giftNameStrong.textContent = giftName; // textContent sanitization
    if (ruleResult.bannerColor) giftNameStrong.style.color = ruleResult.bannerColor;
    actionText.appendChild(giftNameStrong);

    details.appendChild(senderEl);
    details.appendChild(actionText);

    // Multiplier badge
    const multiplier = document.createElement('div');
    multiplier.className = 'gift-multiplier-badge';
    multiplier.textContent = `x${count}`;

    card.appendChild(iconBox);
    card.appendChild(details);
    card.appendChild(multiplier);

    giftAlertsContainer.appendChild(card);

    // Alert timeout: show for durationMs then exit animation
    const displayDuration = ruleResult.durationMs || 4000;
    setTimeout(() => {
      card.classList.add('alert-exit');
      setTimeout(() => {
        if (card.parentNode) {
          card.parentNode.removeChild(card);
        }
        isAlertDisplaying = false;
        processNextAlert();
      }, 400);
    }, displayDuration);
  }

  function queueGiftAlert(giftData) {
    alertQueue.push(giftData);
    if (!isAlertDisplaying) {
      processNextAlert();
    }
  }

  function processNextAlert() {
    if (alertQueue.length === 0) {
      isAlertDisplaying = false;
      return;
    }
    isAlertDisplaying = true;
    const nextGift = alertQueue.shift();
    displayGiftAlert(nextGift);
  }

  /**
   * Apply Overlay Layout & Styles Dynamically to all widgets
   * Absolute positioning, clamping, styles, visibility, orientation
   */
  function applyOverlayConfig(config) {
    const validConf = extractConfig(config);
    if (!validConf || !validConf.layouts) return;

    currentConfig = validConf;
    const orientation = getOrientation();
    const layout = validConf.layouts[orientation] || validConf.layouts.horizontal;
    if (!layout || !layout.widgets) return;

    const canvasW = layout.canvasWidth || (orientation === 'vertical' ? 1080 : 1920);
    const canvasH = layout.canvasHeight || (orientation === 'vertical' ? 1920 : 1080);
    const winW = window.innerWidth || canvasW;
    const winH = window.innerHeight || canvasH;

    const scaleX = (winW && canvasW) ? winW / canvasW : 1;
    const scaleY = (winH && canvasH) ? winH / canvasH : 1;

    // Elements mapping
    const widgetElements = {
      'chat': chatWidget,
      'likes': likeStatBox,
      'viewers': viewerStatBox,
      'gift-alerts': giftAlertsContainer,
      'likes-goal': likesGoalWidget,
    };

    for (const [id, el] of Object.entries(widgetElements)) {
      if (!el) continue;
      const widgetConf = layout.widgets[id];
      if (!widgetConf) continue;

      // 1. Visibility handling (display: none when visible is false)
      if (widgetConf.visible === false) {
        el.style.display = 'none';
      } else {
        if (id === 'viewers') {
          // Viewers widget only shows if count is known
          if (typeof currentViewerCount === 'number') {
            el.style.display = 'flex';
          } else {
            el.style.display = 'none';
          }
        } else {
          el.style.display = 'flex';
        }
      }

      // 2. Position & Size (Absolute positioning in px)
      const pos = widgetConf.position || {};
      const origW = typeof pos.width === 'number' ? pos.width : 300;
      const origH = typeof pos.height === 'number' ? pos.height : 100;
      const origX = typeof pos.x === 'number' ? pos.x : 0;
      const origY = typeof pos.y === 'number' ? pos.y : 0;
      const zIndex = typeof pos.zIndex === 'number' ? pos.zIndex : 10;

      // Scale to viewport if viewport differs from logical canvas
      const isExactCanvas = Math.abs(winW - canvasW) < 10 && Math.abs(winH - canvasH) < 10;
      const w = isExactCanvas ? origW : Math.round(origW * scaleX);
      const h = isExactCanvas ? origH : Math.round(origH * scaleY);
      const posX = isExactCanvas ? origX : Math.round(origX * scaleX);
      const posY = isExactCanvas ? origY : Math.round(origY * scaleY);

      // Clamp coordinates to canvas bounds
      const maxBoundW = isExactCanvas ? canvasW : winW;
      const maxBoundH = isExactCanvas ? canvasH : winH;
      const clampedW = Math.min(w, maxBoundW);
      const clampedH = Math.min(h, maxBoundH);
      const clampedX = Math.max(0, Math.min(posX, maxBoundW - clampedW));
      const clampedY = Math.max(0, Math.min(posY, maxBoundH - clampedH));

      el.style.position = 'absolute';
      el.style.left = `${clampedX}px`;
      el.style.top = `${clampedY}px`;
      el.style.width = `${clampedW}px`;
      el.style.height = `${clampedH}px`;
      el.style.zIndex = `${zIndex}`;
      el.style.boxSizing = 'border-box';

      // 3. Common Styles
      const st = widgetConf.style || {};
      if (typeof st.opacity === 'number') {
        el.style.opacity = `${st.opacity}`;
      }
      if (typeof st.borderRadius === 'number') {
        el.style.borderRadius = `${st.borderRadius}px`;
      }
      if (st.backgroundColor) {
        el.style.backgroundColor = st.backgroundColor;
      }
      if (st.textColor) {
        el.style.color = st.textColor;
      }
      if (typeof st.fontSize === 'number') {
        el.style.fontSize = `${st.fontSize}px`;
      }

      // Widget-specific styles & options
      if (id === 'chat') {
        currentChatMessageLimit = typeof widgetConf.messageLimit === 'number' ? widgetConf.messageLimit : 25;
        currentShowAvatar = typeof widgetConf.showAvatar === 'boolean' ? widgetConf.showAvatar : true;
        if (currentShowAvatar) {
          el.removeAttribute('data-hide-avatar');
        } else {
          el.setAttribute('data-hide-avatar', 'true');
        }
        if (chatMessages) {
          while (chatMessages.children.length > currentChatMessageLimit) {
            chatMessages.removeChild(chatMessages.firstChild);
          }
        }
      } else if (id === 'likes-goal') {
        updateLikesGoal(totalLikes);
      }
    }
  }

  /**
   * Handle Snapshot on Initial Load
   * REQUIREMENT: "Initial load receives snapshot, subsequent updates arrive via SSE without replaying old alerts."
   */
  function handleSnapshot(snapshot) {
    if (!snapshot) return;

    // Check for session change (resets on new session)
    if (snapshot.sessionId && currentSessionId && snapshot.sessionId !== currentSessionId) {
      console.log('Nova sessão detectada. Redefinindo estado da meta e contadores.');
      totalLikes = 0;
    }
    if (snapshot.sessionId) {
      currentSessionId = snapshot.sessionId;
    }

    // Apply configuration if snapshot includes it
    if (snapshot.config) {
      applyOverlayConfig(snapshot.config);
    } else {
      fetchOverlayConfig();
    }

    // 1. Set like count
    if (typeof snapshot.totalLikes === 'number') {
      totalLikes = snapshot.totalLikes;
      if (overlayLikeCount) {
        overlayLikeCount.textContent = totalLikes.toLocaleString('pt-BR');
      }
    }
    if (snapshot.likesLabel && overlayLikeLabel) {
      overlayLikeLabel.textContent = snapshot.likesLabel;
    }

    // 2. Set viewer count
    if (typeof snapshot.viewerCount === 'number') {
      currentViewerCount = snapshot.viewerCount;
      if (viewerStatBox) {
        const orientation = getOrientation();
        const layout = currentConfig && currentConfig.layouts && currentConfig.layouts[orientation];
        const viewersConf = layout && layout.widgets && layout.widgets['viewers'];
        if (!viewersConf || viewersConf.visible !== false) {
          viewerStatBox.style.display = 'flex';
        }
      }
      if (overlayViewerCount) {
        overlayViewerCount.textContent = snapshot.viewerCount.toLocaleString('pt-BR');
      }
    }

    // 3. Update Likes Goal with snapshot total
    updateLikesGoal(totalLikes);

    // 4. Render recent chat messages quietly (no animation)
    if (Array.isArray(snapshot.recentChat) && chatMessages) {
      chatMessages.innerHTML = '';
      snapshot.recentChat.forEach(item => {
        const data = item.data || item;
        addChatMessage(data, true);
      });
    }

    // 5. CRITICAL: Do NOT replay past gifts in snapshot as popups!
    // Simply mark snapshot as processed.
    isSnapshotProcessed = true;
    console.log('Snapshot inicial aplicado com sucesso ao overlay (alertas antigos ignorados).');
  }

  /**
   * Handle incoming live SSE event
   */
  function handleLiveEvent(eventObj) {
    if (!eventObj || !eventObj.type) return;

    const data = eventObj.data || {};

    switch (eventObj.type) {
      case 'chat.message':
        addChatMessage(data, false);
        break;

      case 'engagement.like':
        updateLikes(data.count, data.label, data.totalLikes);
        break;

      case 'gift.completed':
        // ONLY trigger gift alerts for NEW live events after snapshot is processed!
        if (isSnapshotProcessed) {
          queueGiftAlert(data);
        }
        break;

      case 'viewer.count':
        if (typeof data.viewerCount === 'number') {
          currentViewerCount = data.viewerCount;
          const orientation = getOrientation();
          const layout = currentConfig && currentConfig.layouts && currentConfig.layouts[orientation];
          const viewersConf = layout && layout.widgets && layout.widgets['viewers'];
          if (viewerStatBox && (!viewersConf || viewersConf.visible !== false)) {
            viewerStatBox.style.display = 'flex';
          }
          if (overlayViewerCount) {
            overlayViewerCount.textContent = data.viewerCount.toLocaleString('pt-BR');
          }
        }
        break;

      case 'live.status':
        if (data.status === 'connecting' || data.status === 'offline' || data.status === 'idle') {
          // If streamer changed, reset goal and likes cleanly
          if (data.roomId && snapshotRoomChanged(data.roomId)) {
            totalLikes = 0;
            updateLikesGoal(0);
          }
        }
        break;

      case 'config.updated':
        applyOverlayConfig(data);
        break;

      default:
        break;
    }
  }

  let lastKnownRoomId = null;
  function snapshotRoomChanged(newRoomId) {
    if (lastKnownRoomId && newRoomId && lastKnownRoomId !== newRoomId) {
      lastKnownRoomId = newRoomId;
      return true;
    }
    if (newRoomId) lastKnownRoomId = newRoomId;
    return false;
  }

  /**
   * Fetch current overlay config via HTTP
   */
  async function fetchOverlayConfig() {
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        const data = await res.json();
        const conf = extractConfig(data);
        if (conf) {
          applyOverlayConfig(conf);
        }
      }
    } catch (e) {
      // Fallback already rendered
    }
  }

  /**
   * Fallback initial snapshot fetch via HTTP
   */
  async function fetchInitialSnapshot() {
    try {
      const res = await fetch('/api/status');
      if (res.ok) {
        const snapshot = await res.json();
        if (!isSnapshotProcessed) {
          handleSnapshot(snapshot);
        }
      }
    } catch (e) {
      // Will receive snapshot via SSE if HTTP fetch fails
    }
  }

  /**
   * Connect to SSE endpoint: /overlay/:token/events (with fallback to /api/events)
   */
  function connectSSE() {
    const sseUrl = token ? `/overlay/${token}/events` : '/api/events';
    console.log(`Conectando overlay ao stream SSE: ${sseUrl}`);

    if (eventSource) {
      eventSource.close();
    }

    eventSource = new EventSource(sseUrl);

    eventSource.onopen = function () {
      console.log('Stream SSE do overlay conectado com sucesso.');
    };

    eventSource.onmessage = function (event) {
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.type === 'snapshot' || (parsed.sessionId && parsed.recentChat !== undefined)) {
          if (!isSnapshotProcessed) {
            handleSnapshot(parsed);
          }
        } else if (parsed.type === 'config.updated') {
          applyOverlayConfig(parsed);
        } else {
          if (!isSnapshotProcessed) {
            isSnapshotProcessed = true;
          }
          handleLiveEvent(parsed);
        }
      } catch (err) {
        console.error('Erro ao analisar evento SSE no overlay:', err);
      }
    };

    // Specific event listeners
    const eventNames = [
      'snapshot',
      'chat.message',
      'engagement.like',
      'gift.completed',
      'viewer.count',
      'live.status',
      'config.updated'
    ];

    eventNames.forEach(name => {
      eventSource.addEventListener(name, function (event) {
        try {
          const parsed = JSON.parse(event.data);
          if (name === 'snapshot') {
            if (!isSnapshotProcessed) {
              handleSnapshot(parsed);
            }
          } else if (name === 'config.updated') {
            applyOverlayConfig(parsed);
          } else {
            if (!isSnapshotProcessed) {
              isSnapshotProcessed = true;
            }
            handleLiveEvent(parsed.type ? parsed : { type: name, data: parsed });
          }
        } catch (err) {
          console.error(`Erro no evento ${name} do overlay:`, err);
        }
      });
    });

    eventSource.onerror = function () {
      console.warn('Conexão SSE do overlay instável ou reconectando...');
    };
  }

  // Handle window resize dynamically (switches orientation or adjusts scale)
  window.addEventListener('resize', function () {
    if (currentConfig) {
      applyOverlayConfig(currentConfig);
    }
  });

  // Apply default configuration immediately to prevent any flash of unstyled content
  applyOverlayConfig(DEFAULT_OVERLAY_CONFIG);

  // Initialize data fetching & SSE
  fetchInitialSnapshot();
  fetchOverlayConfig();
  connectSSE();

})();
