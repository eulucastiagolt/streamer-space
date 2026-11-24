/**
 * Streamer Space - OBS Studio Browser Source Overlay Script
 * Transparent, reactive via SSE, untrusted inputs sanitized via textContent
 */

(function () {
  'use strict';

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
  let totalLikes = 0;
  let isSnapshotProcessed = false;
  let eventSource = null;
  const alertQueue = [];
  let isAlertDisplaying = false;

  // DOM Elements
  const giftAlertsContainer = document.getElementById('gift-alerts-container');
  const chatMessages = document.getElementById('chat-messages');
  const overlayLikeCount = document.getElementById('overlay-like-count');
  const overlayLikeLabel = document.getElementById('overlay-like-label');
  const heartIcon = document.getElementById('heart-icon');
  const floatingHeartsContainer = document.getElementById('floating-hearts-container');
  const viewerStatBox = document.getElementById('viewer-stat-box');
  const overlayViewerCount = document.getElementById('overlay-viewer-count');

  // Palette for author colors
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

  /**
   * Render a chat message safely using textContent
   * @param {Object} chatData 
   * @param {boolean} isInitialSnapshot 
   */
  function addChatMessage(chatData, isInitialSnapshot = false) {
    if (!chatData) return;

    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';
    if (isInitialSnapshot) {
      bubble.style.animation = 'none'; // No entrance animation for initial snapshot
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

    // Message text (Strictly textContent - XSS protection)
    const textSpan = document.createElement('span');
    textSpan.className = 'chat-text';
    textSpan.textContent = chatData.comment || '';
    bubble.appendChild(textSpan);

    chatMessages.appendChild(bubble);

    // Limit visible chat messages (keep last 25)
    while (chatMessages.children.length > 25) {
      chatMessages.removeChild(chatMessages.firstChild);
    }

    // Auto-scroll chat to latest message
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  /**
   * Update like counter and trigger heart pulse animation
   */
  function updateLikes(count, label, total) {
    if (typeof total === 'number') {
      totalLikes = total;
    } else if (typeof count === 'number') {
      totalLikes += count;
    }

    overlayLikeCount.textContent = totalLikes.toLocaleString('pt-BR');
    if (label) {
      overlayLikeLabel.textContent = label;
    }

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
   * Display Gift Alert Popup with multiplier & combo animations
   * (Strictly uses textContent for sender and gift names)
   */
  function displayGiftAlert(giftData) {
    if (!giftData) return;

    const count = giftData.count || 1;
    const sender = giftData.displayName || giftData.username || 'Espectador';
    const giftName = giftData.giftName || 'Presente';

    const card = document.createElement('div');
    card.className = 'gift-alert-card';

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

    const actionText = document.createElement('div');
    actionText.className = 'gift-action-text';
    actionText.textContent = 'enviou ';
    
    const giftNameStrong = document.createElement('strong');
    giftNameStrong.textContent = giftName; // textContent sanitization
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

    // Alert timeout: show for 4.2 seconds then exit animation
    setTimeout(() => {
      card.classList.add('alert-exit');
      setTimeout(() => {
        if (card.parentNode) {
          card.parentNode.removeChild(card);
        }
        isAlertDisplaying = false;
        processNextAlert();
      }, 400);
    }, 4200);
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
   * Handle Snapshot on Initial Load
   * REQUIREMENT: "Initial load receives snapshot, subsequent updates arrive via SSE without replaying old alerts."
   */
  function handleSnapshot(snapshot) {
    if (!snapshot) return;

    // 1. Set like count
    if (typeof snapshot.totalLikes === 'number') {
      totalLikes = snapshot.totalLikes;
      overlayLikeCount.textContent = totalLikes.toLocaleString('pt-BR');
    }
    if (snapshot.likesLabel) {
      overlayLikeLabel.textContent = snapshot.likesLabel;
    }

    // 2. Set viewer count
    if (typeof snapshot.viewerCount === 'number') {
      viewerStatBox.style.display = 'flex';
      overlayViewerCount.textContent = snapshot.viewerCount.toLocaleString('pt-BR');
    }

    // 3. Render recent chat messages quietly (no animation)
    if (Array.isArray(snapshot.recentChat)) {
      chatMessages.innerHTML = '';
      snapshot.recentChat.forEach(item => {
        const data = item.data || item;
        addChatMessage(data, true);
      });
    }

    // 4. CRITICAL: Do NOT replay past gifts in snapshot as popups!
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
          viewerStatBox.style.display = 'flex';
          overlayViewerCount.textContent = data.viewerCount.toLocaleString('pt-BR');
        }
        break;

      case 'live.status':
        if (data.status === 'offline' || data.status === 'idle') {
          // Subtle room status handling if needed
        }
        break;

      default:
        break;
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
        } else {
          // If first event is not a snapshot, make sure we mark snapshot processed so we don't drop live alerts
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
    const eventNames = ['snapshot', 'chat.message', 'engagement.like', 'gift.completed', 'viewer.count', 'live.status'];
    eventNames.forEach(name => {
      eventSource.addEventListener(name, function (event) {
        try {
          const parsed = JSON.parse(event.data);
          if (name === 'snapshot') {
            if (!isSnapshotProcessed) {
              handleSnapshot(parsed);
            }
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

  // Initialize
  fetchInitialSnapshot();
  connectSSE();

})();
