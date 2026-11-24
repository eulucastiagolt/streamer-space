/**
 * Streamer Space - Dashboard Client (Brazilian Portuguese)
 */

(function () {
  'use strict';

  // State
  let overlayToken = 'default-token';
  let currentSessionId = '';
  let currentTargetUsername = '';
  let isConnected = false;
  let eventSource = null;
  let activeFilter = 'all';

  // Metrics
  let metrics = {
    viewers: null,
    likes: 0,
    gifts: 0,
    chats: 0
  };

  // DOM Elements
  const usernameInput = document.getElementById('username-input');
  const inputFeedback = document.getElementById('input-feedback');
  const statusBadge = document.getElementById('status-badge');
  const btnConnect = document.getElementById('btn-connect');
  const btnDisconnect = document.getElementById('btn-disconnect');
  const btnPreview = document.getElementById('btn-preview');
  const btnCopyUrl = document.getElementById('btn-copy-url');
  const btnQuickCopy = document.getElementById('btn-quick-copy');
  const obsUrlDisplay = document.getElementById('obs-url-display');

  // Metrics DOM
  const metricViewers = document.getElementById('metric-viewers');
  const metricLikes = document.getElementById('metric-likes');
  const metricLikesLabel = document.getElementById('metric-likes-label');
  const metricGifts = document.getElementById('metric-gifts');
  const metricChats = document.getElementById('metric-chats');

  // Feed DOM
  const eventFeed = document.getElementById('event-feed');
  const feedEmptyState = document.getElementById('feed-empty-state');
  const btnClearFeed = document.getElementById('btn-clear-feed');
  const filterChips = document.querySelectorAll('.filter-chip');

  // Simulation DOM
  const btnSimChat = document.getElementById('btn-sim-chat');
  const btnSimLike = document.getElementById('btn-sim-like');
  const btnSimGift = document.getElementById('btn-sim-gift');
  const btnSimStreak = document.getElementById('btn-sim-streak');

  // Toast DOM
  const toastContainer = document.getElementById('toast-container');

  // Helper: Normalize username (accepts with or without @)
  function normalizeUsername(raw) {
    if (!raw) return '';
    const trimmed = raw.trim();
    return trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
  }

  // Helper: Validate username
  function validateUsername(username) {
    if (!username || username.trim() === '') {
      return { valid: false, message: 'Por favor, digite o username do streamer.' };
    }
    const clean = normalizeUsername(username);
    // TikTok usernames: 2-24 chars, letters, numbers, underscores, periods
    const regex = /^[a-zA-Z0-9_.-]+$/;
    if (!regex.test(clean)) {
      return { valid: false, message: 'Username inválido. Use apenas letras, números, pontos e sublinhados.' };
    }
    return { valid: true, normalized: clean };
  }

  // Update Status Badge with distinct styles
  // States: invalid input, offline, connecting, connected, reconnecting, error, idle
  function updateStatusBadge(status, customMessage) {
    statusBadge.className = 'badge';
    inputFeedback.textContent = '';
    usernameInput.classList.remove('input-error');

    switch (status) {
      case 'invalid':
      case 'invalid input':
        statusBadge.classList.add('badge-invalid');
        statusBadge.textContent = 'Entrada inválida';
        usernameInput.classList.add('input-error');
        if (customMessage) {
          inputFeedback.textContent = customMessage;
        }
        btnConnect.disabled = false;
        btnDisconnect.disabled = true;
        break;

      case 'offline':
        statusBadge.classList.add('badge-offline');
        statusBadge.textContent = 'Offline';
        if (customMessage) inputFeedback.textContent = customMessage;
        btnConnect.disabled = false;
        btnDisconnect.disabled = true;
        break;

      case 'connecting':
        statusBadge.classList.add('badge-connecting');
        statusBadge.textContent = 'Conectando...';
        btnConnect.disabled = true;
        btnDisconnect.disabled = false;
        break;

      case 'connected':
        statusBadge.classList.add('badge-connected');
        statusBadge.textContent = 'Conectado';
        btnConnect.disabled = true;
        btnDisconnect.disabled = false;
        break;

      case 'reconnecting':
        statusBadge.classList.add('badge-reconnecting');
        statusBadge.textContent = 'Reconectando...';
        btnConnect.disabled = true;
        btnDisconnect.disabled = false;
        break;

      case 'error':
        statusBadge.classList.add('badge-error');
        statusBadge.textContent = 'Erro';
        if (customMessage) inputFeedback.textContent = customMessage;
        btnConnect.disabled = false;
        btnDisconnect.disabled = true;
        break;

      case 'idle':
      default:
        statusBadge.classList.add('badge-idle');
        statusBadge.textContent = 'Desconectado';
        btnConnect.disabled = false;
        btnDisconnect.disabled = true;
        break;
    }
  }

  // Format OBS overlay URL
  function getObsOverlayUrl() {
    return `${window.location.origin}/overlay/${overlayToken}`;
  }

  function updateObsUrlDisplay() {
    const url = getObsOverlayUrl();
    obsUrlDisplay.textContent = url;
  }

  // Toast Notification
  function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const iconSpan = document.createElement('span');
    if (type === 'success') {
      iconSpan.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    } else {
      iconSpan.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
    }
    
    const textSpan = document.createElement('span');
    textSpan.textContent = message;

    toast.appendChild(iconSpan);
    toast.appendChild(textSpan);
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(8px)';
      toast.style.transition = 'all 0.25s ease';
      setTimeout(() => toast.remove(), 250);
    }, 3200);
  }

  // Copy OBS URL to clipboard
  function copyObsUrl() {
    const url = getObsOverlayUrl();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url)
        .then(() => showToast('URL do OBS copiada com sucesso!'))
        .catch(() => fallbackCopy(url));
    } else {
      fallbackCopy(url);
    }
  }

  function fallbackCopy(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      showToast('URL do OBS copiada com sucesso!');
    } catch (err) {
      showToast('Falha ao copiar URL automaticamente.', 'error');
    }
    document.body.removeChild(textArea);
  }

  // Open Preview in new tab
  function openPreview() {
    const url = getObsOverlayUrl();
    window.open(url, '_blank', 'width=1280,height=720,menubar=no,toolbar=no,location=no');
  }

  // Update Metrics UI
  function updateMetricsUI() {
    metricViewers.textContent = metrics.viewers !== null ? metrics.viewers.toLocaleString('pt-BR') : '—';
    metricLikes.textContent = Number(metrics.likes || 0).toLocaleString('pt-BR');
    metricGifts.textContent = Number(metrics.gifts || 0).toLocaleString('pt-BR');
    metricChats.textContent = Number(metrics.chats || 0).toLocaleString('pt-BR');
  }

  // Add Item to Live Feed (Safely sanitize with textContent)
  function addFeedItem(type, meta, author, contentText, avatarUrl) {
    if (feedEmptyState) {
      feedEmptyState.style.display = 'none';
    }

    const item = document.createElement('div');
    item.className = `feed-item feed-item-${type}`;
    item.dataset.type = type;

    // Filter check
    if (activeFilter !== 'all' && activeFilter !== type) {
      item.style.display = 'none';
    }

    // Icon / Avatar
    const iconEl = document.createElement('div');
    iconEl.className = 'feed-item-icon';
    if (avatarUrl && type === 'chat') {
      const img = document.createElement('img');
      img.className = 'feed-avatar';
      img.src = avatarUrl;
      img.alt = '';
      img.referrerPolicy = 'no-referrer';
      img.onerror = function () {
        img.remove();
        iconEl.textContent = '💬';
      };
      iconEl.appendChild(img);
    } else if (type === 'chat') iconEl.textContent = '💬';
    else if (type === 'like') iconEl.textContent = '❤️';
    else if (type === 'gift') iconEl.textContent = '🎁';
    else iconEl.textContent = 'ℹ️';

    // Content container
    const contentContainer = document.createElement('div');
    contentContainer.className = 'feed-item-content';

    // Meta header
    const metaEl = document.createElement('div');
    metaEl.className = 'feed-item-meta';

    if (author) {
      const authorEl = document.createElement('span');
      authorEl.className = 'feed-item-author';
      authorEl.textContent = author;
      metaEl.appendChild(authorEl);
    }

    if (meta) {
      const badgeEl = document.createElement('span');
      badgeEl.className = 'feed-item-badge';
      badgeEl.textContent = meta;
      metaEl.appendChild(badgeEl);
    }

    const timeEl = document.createElement('span');
    timeEl.className = 'feed-item-time';
    const now = new Date();
    timeEl.textContent = now.toLocaleTimeString('pt-BR');
    metaEl.appendChild(timeEl);

    // Text content - ALWAYS set via textContent
    const textEl = document.createElement('div');
    textEl.className = 'feed-item-text';
    textEl.textContent = contentText;

    contentContainer.appendChild(metaEl);
    contentContainer.appendChild(textEl);

    item.appendChild(iconEl);
    item.appendChild(contentContainer);

    // Prepend or append to feed
    eventFeed.insertBefore(item, eventFeed.firstChild);

    // Keep feed to max 150 items
    while (eventFeed.children.length > 151) {
      eventFeed.removeChild(eventFeed.lastChild);
    }
  }

  // Filter feed items
  function setFeedFilter(filter) {
    activeFilter = filter;
    filterChips.forEach(chip => {
      chip.classList.toggle('active', chip.dataset.filter === filter);
    });

    const items = eventFeed.querySelectorAll('.feed-item');
    items.forEach(item => {
      if (filter === 'all' || item.dataset.type === filter) {
        item.style.display = 'flex';
      } else {
        item.style.display = 'none';
      }
    });
  }

  // Clear Feed
  function clearFeed() {
    const items = eventFeed.querySelectorAll('.feed-item');
    items.forEach(item => item.remove());
    if (feedEmptyState) feedEmptyState.style.display = 'flex';
  }

  // Handle Event from SSE or Snapshot
  function handleEvent(eventObj) {
    if (!eventObj || !eventObj.type) return;

    const data = eventObj.data || {};

    switch (eventObj.type) {
      case 'chat.message':
        metrics.chats++;
        updateMetricsUI();
        addFeedItem(
          'chat',
          data.badge || 'Chat',
          data.displayName || data.username || 'Anônimo',
          data.comment || '',
          data.profilePictureUrl
        );
        break;

      case 'engagement.like':
        if (typeof data.totalLikes === 'number') {
          metrics.likes = data.totalLikes;
        } else if (typeof data.count === 'number') {
          metrics.likes += data.count;
        }
        if (data.label) {
          metricLikesLabel.textContent = data.label;
        }
        updateMetricsUI();
        const likeCount = data.count || 1;
        const likeAuthor = data.username ? `@${data.username}` : 'Espectadores';
        addFeedItem(
          'like',
          `+${likeCount} curtidas`,
          likeAuthor,
          `${likeAuthor} enviou ${likeCount} curtida${likeCount > 1 ? 's' : ''}.`
        );
        break;

      case 'gift.update':
        // Progress of streak
        break;

      case 'gift.completed':
        const giftCount = data.count || 1;
        metrics.gifts += giftCount;
        updateMetricsUI();
        const giftSender = data.displayName || data.username || 'Espectador';
        const streakLabel = data.streakId ? `Combo x${giftCount}` : `x${giftCount}`;
        addFeedItem(
          'gift',
          streakLabel,
          giftSender,
          `Enviou ${giftCount}x ${data.giftName || 'Presente'}! 🎁`
        );
        break;

      case 'viewer.count':
        metrics.viewers = data.viewerCount;
        updateMetricsUI();
        break;

      case 'live.status':
        handleStatusChange(data);
        break;

      case 'engagement.follow':
        addFeedItem(
          'status',
          'Novo Seguidor',
          data.displayName || data.username || 'Usuário',
          'Começou a seguir a live!'
        );
        break;

      case 'engagement.share':
        addFeedItem(
          'status',
          'Compartilhamento',
          data.displayName || data.username || 'Usuário',
          'Compartilhou a live!'
        );
        break;

      default:
        break;
    }
  }

  // Handle Status Change
  function handleStatusChange(statusData) {
    if (!statusData) return;
    const status = statusData.status || 'idle';
    const message = statusData.message || '';
    
    if (statusData.targetUsername) {
      currentTargetUsername = statusData.targetUsername;
      if (!usernameInput.value) {
        usernameInput.value = statusData.targetUsername;
      }
    }

    updateStatusBadge(status, message);

    if (status === 'connected') {
      isConnected = true;
      addFeedItem(
        'status',
        'Conexão',
        'Sistema',
        `Conectado à live de @${currentTargetUsername}${statusData.roomTitle ? ` - ${statusData.roomTitle}` : ''}`
      );
    } else if (status === 'offline') {
      isConnected = false;
      addFeedItem(
        'status',
        'Offline',
        'Sistema',
        `A live de @${currentTargetUsername || 'streamer'} está offline no momento.`
      );
    } else if (status === 'error') {
      isConnected = false;
      addFeedItem(
        'status',
        'Erro',
        'Sistema',
        `Erro de conexão: ${message || 'Falha ao conectar à live.'}`
      );
    } else if (status === 'reconnecting') {
      addFeedItem(
        'status',
        'Reconexão',
        'Sistema',
        `Tentando reconectar à live de @${currentTargetUsername}...`
      );
    }
  }

  // Apply Initial Snapshot
  function applySnapshot(snapshot) {
    if (!snapshot) return;

    currentSessionId = snapshot.sessionId || '';
    currentTargetUsername = snapshot.targetUsername || '';
    if (snapshot.overlayToken) {
      overlayToken = snapshot.overlayToken;
      updateObsUrlDisplay();
    }

    if (snapshot.targetUsername && !usernameInput.value) {
      usernameInput.value = snapshot.targetUsername;
    }

    metrics.likes = snapshot.totalLikes || 0;
    if (snapshot.likesLabel) {
      metricLikesLabel.textContent = snapshot.likesLabel;
    }
    if (typeof snapshot.viewerCount === 'number') {
      metrics.viewers = snapshot.viewerCount;
    }

    if (Array.isArray(snapshot.recentChat)) {
      metrics.chats = snapshot.recentChat.length;
    }
    if (Array.isArray(snapshot.recentGifts)) {
      metrics.gifts = snapshot.recentGifts.reduce((acc, g) => acc + (g.data?.count || 1), 0);
    }

    updateMetricsUI();

    // Render recent chats from snapshot
    if (Array.isArray(snapshot.recentChat) && snapshot.recentChat.length > 0) {
      snapshot.recentChat.forEach(chatEvent => handleEvent(chatEvent));
    }

    // Set status badge
    updateStatusBadge(snapshot.status || 'idle', snapshot.errorMessage);
  }

  // Load Status via HTTP GET /api/status
  async function fetchStatus() {
    try {
      const response = await fetch('/api/status');
      if (response.ok) {
        const data = await response.json();
        applySnapshot(data);
      }
    } catch (err) {
      console.warn('Não foi possível obter status inicial via HTTP:', err);
    }
  }

  // Connect to SSE (/api/events)
  function initSSE() {
    if (eventSource) {
      eventSource.close();
    }

    eventSource = new EventSource('/api/events');

    eventSource.onopen = function () {
      console.log('SSE Conectado ao servidor Streamer Space.');
    };

    eventSource.onmessage = function (event) {
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.type === 'snapshot' || (parsed.sessionId && parsed.recentChat !== undefined)) {
          applySnapshot(parsed);
        } else {
          handleEvent(parsed);
        }
      } catch (err) {
        console.error('Erro ao analisar mensagem SSE:', err, event.data);
      }
    };

    // Specific event listeners if server uses custom event names
    const eventNames = ['snapshot', 'chat.message', 'engagement.like', 'gift.update', 'gift.completed', 'live.status', 'viewer.count', 'engagement.follow', 'engagement.share'];
    eventNames.forEach(name => {
      eventSource.addEventListener(name, function (event) {
        try {
          const parsed = JSON.parse(event.data);
          if (name === 'snapshot') {
            applySnapshot(parsed);
          } else {
            handleEvent(parsed.type ? parsed : { type: name, data: parsed });
          }
        } catch (err) {
          console.error(`Erro no evento SSE ${name}:`, err);
        }
      });
    });

    eventSource.onerror = function () {
      console.warn('Erro ou reconexão no SSE.');
    };
  }

  // Action: Connect to Live
  async function connectLive() {
    const rawInput = usernameInput.value;
    const validation = validateUsername(rawInput);

    if (!validation.valid) {
      updateStatusBadge('invalid input', validation.message);
      return;
    }

    const username = validation.normalized;
    updateStatusBadge('connecting');

    try {
      const response = await fetch('/api/live/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errMsg = result.error || result.message || 'Falha ao conectar à live.';
        if (response.status === 400) {
          updateStatusBadge('invalid input', errMsg);
        } else if (response.status === 404 || errMsg.toLowerCase().includes('offline')) {
          updateStatusBadge('offline', errMsg);
        } else {
          updateStatusBadge('error', errMsg);
        }
        showToast(errMsg, 'error');
      } else {
        showToast(`Conectando à live de @${username}...`);
        if (result.status) {
          updateStatusBadge(result.status, result.message);
        }
        if (result.overlayToken) {
          overlayToken = result.overlayToken;
          updateObsUrlDisplay();
        }
      }
    } catch (err) {
      updateStatusBadge('error', 'Erro ao enviar comando de conexão.');
      showToast('Erro ao comunicar com o servidor.', 'error');
    }
  }

  // Action: Disconnect
  async function disconnectLive() {
    try {
      const response = await fetch('/api/live/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (response.ok) {
        updateStatusBadge('idle');
        showToast('Live desconectada com sucesso.');
      } else {
        showToast('Falha ao desconectar live.', 'error');
      }
    } catch (err) {
      showToast('Erro ao enviar comando de desconexão.', 'error');
    }
  }

  // Action: Simulation Event Trigger
  async function sendSimulatedEvent(payload) {
    try {
      const response = await fetch('/api/demo/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        showToast('Erro ao disparar evento simulado no servidor.', 'error');
      }
    } catch (err) {
      showToast('Falha na requisição de simulação.', 'error');
    }
  }

  // Event Listeners
  btnConnect.addEventListener('click', connectLive);
  btnDisconnect.addEventListener('click', disconnectLive);
  btnPreview.addEventListener('click', openPreview);
  btnCopyUrl.addEventListener('click', copyObsUrl);
  btnQuickCopy.addEventListener('click', copyObsUrl);
  btnClearFeed.addEventListener('click', clearFeed);

  // Input Enter key
  usernameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      connectLive();
    }
  });

  // Filter chips
  filterChips.forEach(chip => {
    chip.addEventListener('click', () => {
      setFeedFilter(chip.dataset.filter);
    });
  });

  // Simulation Buttons
  btnSimChat.addEventListener('click', () => {
    const comments = [
      'Top demais essa live! 🔥',
      'Salve streamer! Tamo junto! 🚀',
      'Mandando muito bem no game! 🎮',
      'Boa tarde a todos no chat! ✨',
      'Qual a sensibilidade que você usa?'
    ];
    const users = ['lucas_dev', 'mari_stream', 'pedro_viewer', 'ana_gamer', 'rodrigo_pro'];
    const randomComment = comments[Math.floor(Math.random() * comments.length)];
    const randomUser = users[Math.floor(Math.random() * users.length)];

    sendSimulatedEvent({
      type: 'chat',
      action: 'chat',
      username: randomUser,
      displayName: randomUser.replace('_', ' ').toUpperCase(),
      comment: randomComment
    });
  });

  btnSimLike.addEventListener('click', () => {
    sendSimulatedEvent({
      type: 'like',
      action: 'like',
      count: 15,
      username: 'fa_numero1'
    });
  });

  btnSimGift.addEventListener('click', () => {
    sendSimulatedEvent({
      type: 'gift',
      action: 'gift',
      giftName: 'Rosa',
      count: 1,
      diamondCount: 1,
      username: 'pedro_donator'
    });
  });

  btnSimStreak.addEventListener('click', () => {
    sendSimulatedEvent({
      type: 'streak',
      action: 'streak',
      giftName: 'Coração',
      count: 3,
      diamondCount: 3,
      username: 'super_fan_streak'
    });
  });

  // Initialization
  updateObsUrlDisplay();
  fetchStatus();
  initSSE();

})();
