/**
 * Streamer Space - Visual Overlay Editor (Brazilian Portuguese)
 * Real-time WYSIWYG canvas, layer management, property inspector, and atomic configuration persistence.
 */

(function () {
  'use strict';

  // --- Default Schema Baseline ---
  function createDefaultOverlayConfig() {
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
                fontSize: 16,
                textColor: '#ffffff',
                backgroundColor: 'rgba(15, 23, 42, 0.85)',
                opacity: 1,
                borderRadius: 16
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
                  textColor: '#ffffff'
                },
                {
                  id: 'rule-mega-combo',
                  name: 'Combo Gigante (10+)',
                  minCount: 10,
                  durationMs: 6000,
                  bannerColor: '#f59e0b',
                  textColor: '#ffffff'
                }
              ]
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
                borderRadius: 999
              }
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
                borderRadius: 999
              }
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
                borderRadius: 12
              },
              messageLimit: 25,
              showAvatar: true
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
                borderRadius: 16
              },
              title: 'Meta de Curtidas',
              targetLikes: 1000,
              initialLikes: 0
            }
          }
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
                borderRadius: 16
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
                  textColor: '#ffffff'
                }
              ]
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
                borderRadius: 999
              }
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
                borderRadius: 999
              }
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
                borderRadius: 12
              },
              messageLimit: 30,
              showAvatar: true
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
                borderRadius: 16
              },
              title: 'Meta de Curtidas',
              targetLikes: 1000,
              initialLikes: 0
            }
          }
        }
      }
    };
  }

  // --- Widget Display Meta ---
  const WIDGET_META = {
    'chat': { name: 'Chat da Live', icon: '💬' },
    'likes': { name: 'Contador de Curtidas', icon: '❤️' },
    'viewers': { name: 'Espectadores', icon: '👁️' },
    'gift-alerts': { name: 'Alertas de Presente', icon: '🎁' },
    'likes-goal': { name: 'Meta de Curtidas', icon: '🎯' }
  };

  // --- Editor State ---
  let savedConfig = createDefaultOverlayConfig();
  let draftConfig = JSON.parse(JSON.stringify(savedConfig));
  let currentOrientation = 'horizontal'; // 'horizontal' | 'vertical'
  let selectedWidgetId = 'chat';
  let zoomScale = 0.5;
  let zoomMode = 'fit'; // 'fit' | 'manual'
  let isSaving = false;

  // Drag & Resize State
  let dragAction = null; // { type: 'move' | 'resize', handle?: string, startX, startY, origX, origY, origW, origH }

  // DOM Elements
  const viewport = document.getElementById('editor-canvas-viewport');
  const canvasWrapper = document.getElementById('canvas-wrapper');
  const canvasStage = document.getElementById('canvas-stage');
  const canvasWatermark = document.getElementById('canvas-watermark');
  const layersList = document.getElementById('layers-list');
  const inspectorPanel = document.getElementById('editor-inspector-panel');
  const statusBadge = document.getElementById('editor-status-badge');

  // Toolbar elements
  const btnOrientHoriz = document.getElementById('btn-orient-horiz');
  const btnOrientVert = document.getElementById('btn-orient-vert');
  const zoomLevelText = document.getElementById('zoom-level-text');
  const btnZoomIn = document.getElementById('btn-zoom-in');
  const btnZoomOut = document.getElementById('btn-zoom-out');
  const btnZoomFit = document.getElementById('btn-zoom-fit');
  const zoomPresetButtons = document.querySelectorAll('.zoom-preset-btn');

  // Action buttons
  const btnSaveConfig = document.getElementById('btn-save-config');
  const btnDiscardConfig = document.getElementById('btn-discard-config');
  const btnResetConfig = document.getElementById('btn-reset-config');
  const btnTestPreview = document.getElementById('btn-test-preview');

  // --- Utility Functions ---
  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function isDraftDirty() {
    return JSON.stringify(draftConfig) !== JSON.stringify(savedConfig);
  }

  function getActiveLayout() {
    return draftConfig.layouts[currentOrientation];
  }

  function getActiveCanvasDimensions() {
    const layout = getActiveLayout();
    return {
      width: layout.canvasWidth || (currentOrientation === 'horizontal' ? 1920 : 1080),
      height: layout.canvasHeight || (currentOrientation === 'horizontal' ? 1080 : 1920)
    };
  }

  function getSelectedWidget() {
    if (!selectedWidgetId) return null;
    return getActiveLayout().widgets[selectedWidgetId] || null;
  }

  // --- Toast Helper ---
  function showEditorToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const textSpan = document.createElement('span');
    textSpan.textContent = message;
    toast.appendChild(textSpan);
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(8px)';
      toast.style.transition = 'all 0.25s ease';
      setTimeout(() => toast.remove(), 250);
    }, 3200);
  }

  // --- Status & Dirty State Management ---
  function updateEditorStatus(forcedStatus) {
    statusBadge.className = 'editor-status-badge';

    if (forcedStatus === 'saving') {
      statusBadge.classList.add('editor-status-saving');
      statusBadge.textContent = 'Salvando...';
      btnSaveConfig.disabled = true;
      btnDiscardConfig.disabled = true;
      return;
    }

    if (forcedStatus === 'error') {
      statusBadge.classList.add('editor-status-error');
      statusBadge.textContent = 'Erro';
      btnSaveConfig.disabled = false;
      btnDiscardConfig.disabled = false;
      return;
    }

    const dirty = isDraftDirty();
    if (dirty) {
      statusBadge.classList.add('editor-status-dirty');
      statusBadge.textContent = 'Modificado';
      btnSaveConfig.disabled = false;
      btnDiscardConfig.disabled = false;
    } else {
      statusBadge.classList.add('editor-status-saved');
      statusBadge.textContent = 'Salvo';
      btnSaveConfig.disabled = true;
      btnDiscardConfig.disabled = true;
    }
  }

  // Unsaved changes warning
  window.addEventListener('beforeunload', (e) => {
    if (isDraftDirty()) {
      e.preventDefault();
      e.returnValue = 'Você tem alterações não salvas no layout do overlay. Deseja sair?';
      return e.returnValue;
    }
  });

  // --- Zoom Management ---
  function applyZoom(scale, isFit = false) {
    zoomScale = Math.max(0.15, Math.min(2.0, scale));
    zoomMode = isFit ? 'fit' : 'manual';
    zoomLevelText.textContent = `${Math.round(zoomScale * 100)}%`;
    canvasWrapper.style.transform = `scale(${zoomScale})`;
  }

  function fitZoomToViewport() {
    if (!viewport) return;
    const { width, height } = getActiveCanvasDimensions();
    const padX = 80;
    const padY = 80;
    const availW = Math.max(200, viewport.clientWidth - padX);
    const availH = Math.max(200, viewport.clientHeight - padY);
    const scale = Math.min(availW / width, availH / height);
    applyZoom(scale, true);
  }

  // --- Render Layers List (Left Panel) ---
  function renderLayersList() {
    if (!layersList) return;
    layersList.innerHTML = '';

    const layout = getActiveLayout();
    const widgetsArray = Object.values(layout.widgets);

    // Sort by zIndex descending (top layers first)
    widgetsArray.sort((a, b) => (b.position.zIndex || 0) - (a.position.zIndex || 0));

    widgetsArray.forEach(widget => {
      const meta = WIDGET_META[widget.id] || { name: widget.id, icon: '📦' };
      const item = document.createElement('div');
      item.className = `layer-item ${widget.id === selectedWidgetId ? 'active' : ''}`;
      item.dataset.widgetId = widget.id;

      // Visibility Toggle
      const visBtn = document.createElement('button');
      visBtn.className = `layer-visibility-btn ${!widget.visible ? 'is-hidden' : ''}`;
      visBtn.title = widget.visible ? 'Ocultar elemento' : 'Mostrar elemento';
      visBtn.innerHTML = widget.visible 
        ? `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`
        : `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;

      visBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        widget.visible = !widget.visible;
        renderCanvas();
        renderLayersList();
        renderInspector();
        updateEditorStatus();
      });

      // Icon & Info
      const iconSpan = document.createElement('span');
      iconSpan.className = 'layer-icon';
      iconSpan.textContent = meta.icon;

      const infoDiv = document.createElement('div');
      infoDiv.className = 'layer-info';

      const nameSpan = document.createElement('span');
      nameSpan.className = 'layer-name';
      nameSpan.textContent = meta.name;

      const metaSpan = document.createElement('span');
      metaSpan.className = 'layer-meta';
      metaSpan.textContent = `z-index: ${widget.position.zIndex} • ${widget.position.width}×${widget.position.height}`;

      infoDiv.appendChild(nameSpan);
      infoDiv.appendChild(metaSpan);

      // Order actions (Up / Down)
      const orderDiv = document.createElement('div');
      orderDiv.className = 'layer-order-actions';

      const btnUp = document.createElement('button');
      btnUp.className = 'layer-order-btn';
      btnUp.title = 'Trazer para cima (aumentar z-index)';
      btnUp.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none"><polyline points="18 15 12 9 6 15"></polyline></svg>`;
      btnUp.addEventListener('click', (e) => {
        e.stopPropagation();
        widget.position.zIndex = Math.min(999, (widget.position.zIndex || 0) + 5);
        renderCanvas();
        renderLayersList();
        renderInspector();
        updateEditorStatus();
      });

      const btnDown = document.createElement('button');
      btnDown.className = 'layer-order-btn';
      btnDown.title = 'Enviar para trás (diminuir z-index)';
      btnDown.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none"><polyline points="6 9 12 15 18 9"></polyline></svg>`;
      btnDown.addEventListener('click', (e) => {
        e.stopPropagation();
        widget.position.zIndex = Math.max(1, (widget.position.zIndex || 0) - 5);
        renderCanvas();
        renderLayersList();
        renderInspector();
        updateEditorStatus();
      });

      orderDiv.appendChild(btnUp);
      orderDiv.appendChild(btnDown);

      item.appendChild(visBtn);
      item.appendChild(iconSpan);
      item.appendChild(infoDiv);
      item.appendChild(orderDiv);

      item.addEventListener('click', () => {
        selectWidget(widget.id);
      });

      layersList.appendChild(item);
    });
  }

  // --- Render Interactive Canvas (Center Area) ---
  function renderCanvas() {
    if (!canvasStage) return;

    const { width, height } = getActiveCanvasDimensions();
    canvasStage.style.width = `${width}px`;
    canvasStage.style.height = `${height}px`;

    canvasWatermark.textContent = `${width} × ${height} (${currentOrientation === 'horizontal' ? '16:9' : '9:16'})`;

    // Remove existing widgets from canvas
    const oldWidgets = canvasStage.querySelectorAll('.canvas-widget');
    oldWidgets.forEach(w => w.remove());

    const layout = getActiveLayout();
    const widgets = layout.widgets;

    Object.keys(widgets).forEach(wId => {
      const widget = widgets[wId];
      const isSelected = wId === selectedWidgetId;

      const widgetEl = document.createElement('div');
      widgetEl.className = `canvas-widget ${isSelected ? 'is-selected' : ''} ${!widget.visible ? 'is-hidden' : ''}`;
      widgetEl.id = `canvas-widget-${wId}`;
      widgetEl.dataset.widgetId = wId;

      const pos = widget.position;
      const style = widget.style || {};

      widgetEl.style.left = `${pos.x}px`;
      widgetEl.style.top = `${pos.y}px`;
      widgetEl.style.width = `${pos.width}px`;
      widgetEl.style.height = `${pos.height}px`;
      widgetEl.style.zIndex = pos.zIndex || 1;

      // Apply appearance styles
      if (style.fontSize) widgetEl.style.fontSize = `${style.fontSize}px`;
      if (style.textColor) widgetEl.style.color = style.textColor;
      if (style.backgroundColor) widgetEl.style.backgroundColor = style.backgroundColor;
      if (style.opacity !== undefined) widgetEl.style.opacity = style.opacity;
      if (style.borderRadius !== undefined) widgetEl.style.borderRadius = `${style.borderRadius}px`;

      // Render Mock Widget Content Preview
      widgetEl.innerHTML = getWidgetMockHTML(widget);

      // Selected Bounding Box & Resize Handles
      if (isSelected) {
        // Bounds Dimension Tag
        const tag = document.createElement('div');
        tag.className = 'widget-bounds-tag';
        tag.textContent = `${WIDGET_META[wId]?.name || wId} • X: ${pos.x}, Y: ${pos.y} | ${pos.width}×${pos.height}`;
        widgetEl.appendChild(tag);

        // 8 Resize Handles
        const handles = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
        handles.forEach(h => {
          const handleEl = document.createElement('div');
          handleEl.className = `resize-handle resize-handle-${h}`;
          handleEl.dataset.handle = h;
          widgetEl.appendChild(handleEl);
        });
      }

      // Drag / Resize Event Listeners
      widgetEl.addEventListener('mousedown', (e) => {
        handleWidgetMouseDown(e, wId);
      });

      canvasStage.appendChild(widgetEl);
    });
  }

  // --- Mock Content Previews for Canvas ---
  function getWidgetMockHTML(widget) {
    switch (widget.id) {
      case 'chat':
        return `
          <div class="widget-preview-chat">
            <div class="preview-chat-bubble">
              <span class="preview-chat-author">Lucas:</span>
              <span class="preview-chat-text">Live começou com tudo! 🔥</span>
            </div>
            <div class="preview-chat-bubble">
              <span class="preview-chat-author" style="color: #f472b6;">Mariana:</span>
              <span class="preview-chat-text">Mandando ver no game hoje! 🎮</span>
            </div>
            <div class="preview-chat-bubble">
              <span class="preview-chat-author" style="color: #34d399;">Pedro:</span>
              <span class="preview-chat-text">Salve streamer! 🚀</span>
            </div>
          </div>
        `;

      case 'likes':
        return `
          <div class="widget-preview-likes">
            <span style="font-size: 1.3em;">❤️</span>
            <span style="font-weight: 800; font-size: 1.1em;">1.250</span>
            <span style="font-size: 0.75em; text-transform: uppercase; opacity: 0.8;">curtidas</span>
          </div>
        `;

      case 'viewers':
        return `
          <div class="widget-preview-viewers">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
            <span style="font-weight: 800; font-size: 1.1em;">420</span>
          </div>
        `;

      case 'gift-alerts':
        return `
          <div class="widget-preview-alert">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 2em;">🎁</span>
              <div>
                <div style="font-weight: 800; font-size: 1em;">Lucas_SuperFan</div>
                <div style="font-size: 0.8em; opacity: 0.9;">enviou <strong style="color: #fbbf24;">Galáxia</strong></div>
              </div>
            </div>
            <div class="preview-alert-combo">x3</div>
          </div>
        `;

      case 'likes-goal':
        const target = widget.targetLikes || 1000;
        return `
          <div class="widget-preview-goal">
            <div class="goal-header-row">
              <span>${widget.title || 'Meta de Curtidas'}</span>
              <span>450 / ${target}</span>
            </div>
            <div class="goal-progress-bar-bg">
              <div class="goal-progress-bar-fill"></div>
            </div>
          </div>
        `;

      default:
        return `<div style="padding: 10px;">${widget.id}</div>`;
    }
  }

  // --- Select Widget ---
  function selectWidget(widgetId) {
    selectedWidgetId = widgetId;
    renderCanvas();
    renderLayersList();
    renderInspector();
  }

  // --- Drag and Resize Pointer Math ---
  function handleWidgetMouseDown(e, widgetId) {
    e.stopPropagation();

    if (selectedWidgetId !== widgetId) {
      selectWidget(widgetId);
    }

    const widget = getSelectedWidget();
    if (!widget) return;

    const target = e.target;
    const isResizeHandle = target.classList.contains('resize-handle');
    const handleType = isResizeHandle ? target.dataset.handle : null;

    dragAction = {
      type: isResizeHandle ? 'resize' : 'move',
      handle: handleType,
      startPointerX: e.clientX,
      startPointerY: e.clientY,
      origX: widget.position.x,
      origY: widget.position.y,
      origW: widget.position.width,
      origH: widget.position.height
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
  }

  function handleWindowMouseMove(e) {
    if (!dragAction) return;

    const widget = getSelectedWidget();
    if (!widget) return;

    const { width: canvasW, height: canvasH } = getActiveCanvasDimensions();

    // Critical: Calculate delta in logical canvas pixels by dividing by zoomScale!
    const deltaX = Math.round((e.clientX - dragAction.startPointerX) / zoomScale);
    const deltaY = Math.round((e.clientY - dragAction.startPointerY) / zoomScale);

    if (dragAction.type === 'move') {
      let newX = dragAction.origX + deltaX;
      let newY = dragAction.origY + deltaY;

      // Bounds clamping: 0 <= x <= canvasWidth - width
      newX = Math.max(0, Math.min(newX, canvasW - widget.position.width));
      newY = Math.max(0, Math.min(newY, canvasH - widget.position.height));

      widget.position.x = newX;
      widget.position.y = newY;
    } else if (dragAction.type === 'resize') {
      const h = dragAction.handle;
      const minW = 60;
      const minH = 30;

      let newX = dragAction.origX;
      let newY = dragAction.origY;
      let newW = dragAction.origW;
      let newH = dragAction.origH;

      // Horizontal resize
      if (h.includes('e')) {
        newW = Math.max(minW, Math.min(dragAction.origW + deltaX, canvasW - dragAction.origX));
      } else if (h.includes('w')) {
        const potentialW = dragAction.origW - deltaX;
        if (potentialW >= minW && dragAction.origX + deltaX >= 0) {
          newX = dragAction.origX + deltaX;
          newW = potentialW;
        }
      }

      // Vertical resize
      if (h.includes('s')) {
        newH = Math.max(minH, Math.min(dragAction.origH + deltaY, canvasH - dragAction.origY));
      } else if (h.includes('n')) {
        const potentialH = dragAction.origH - deltaY;
        if (potentialH >= minH && dragAction.origY + deltaY >= 0) {
          newY = dragAction.origY + deltaY;
          newH = potentialH;
        }
      }

      widget.position.x = newX;
      widget.position.y = newY;
      widget.position.width = newW;
      widget.position.height = newH;
    }

    renderCanvas();
    syncInspectorInputs();
    updateEditorStatus();
  }

  function handleWindowMouseUp() {
    if (dragAction) {
      dragAction = null;
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
      renderLayersList();
    }
  }

  // --- Keyboard Arrow Movement ---
  window.addEventListener('keydown', (e) => {
    // Only process if editor tab is active and not typing in an input
    const editorTab = document.getElementById('view-editor');
    if (!editorTab || !editorTab.classList.contains('active')) return;

    const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
    if (activeTag === 'input' || activeTag === 'textarea') return;

    const widget = getSelectedWidget();
    if (!widget) return;

    const isArrow = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key);
    if (!isArrow) return;

    e.preventDefault();

    const step = e.shiftKey ? 10 : 1;
    const { width: canvasW, height: canvasH } = getActiveCanvasDimensions();

    let newX = widget.position.x;
    let newY = widget.position.y;

    if (e.key === 'ArrowLeft') newX -= step;
    if (e.key === 'ArrowRight') newX += step;
    if (e.key === 'ArrowUp') newY -= step;
    if (e.key === 'ArrowDown') newY += step;

    widget.position.x = Math.max(0, Math.min(newX, canvasW - widget.position.width));
    widget.position.y = Math.max(0, Math.min(newY, canvasH - widget.position.height));

    renderCanvas();
    syncInspectorInputs();
    updateEditorStatus();
  });

  // --- Deselect on Canvas Background Click ---
  if (viewport) {
    viewport.addEventListener('mousedown', (e) => {
      if (e.target === viewport || e.target === canvasStage) {
        selectedWidgetId = null;
        renderCanvas();
        renderLayersList();
        renderInspector();
      }
    });
  }

  // --- Property Inspector (Right Panel) ---
  function renderInspector() {
    if (!inspectorPanel) return;
    inspectorPanel.innerHTML = '';

    const widget = getSelectedWidget();
    if (!widget) {
      inspectorPanel.innerHTML = `
        <div class="inspector-empty">
          <svg viewBox="0 0 24 24" width="48" height="48" stroke="currentColor" stroke-width="1.5" fill="none">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="9" y1="9" x2="15" y2="15"></line>
            <line x1="15" y1="9" x2="9" y2="15"></line>
          </svg>
          <p style="font-weight: 600; font-size: 0.95rem; color: #fff;">Nenhum elemento selecionado</p>
          <span style="font-size: 0.8rem; line-height: 1.4;">Clique em um elemento no canvas ou na lista de camadas para editar suas propriedades.</span>
        </div>
      `;
      return;
    }

    const meta = WIDGET_META[widget.id] || { name: widget.id, icon: '📦' };

    // Header with Title & Visibility Toggle
    const headerSec = document.createElement('div');
    headerSec.className = 'inspector-section';
    headerSec.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; padding-bottom: 0.75rem; border-bottom: 1px solid var(--border-subtle);">
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <span style="font-size: 1.3rem;">${meta.icon}</span>
          <div>
            <h3 style="font-size: 1rem; font-weight: 700; color: #fff;">${meta.name}</h3>
            <span style="font-size: 0.72rem; color: var(--text-dim); font-family: var(--font-mono);">${widget.id}</span>
          </div>
        </div>
        <div class="toggle-switch-wrapper">
          <label class="toggle-switch" title="Visibilidade no Overlay">
            <input type="checkbox" id="insp-visible" ${widget.visible ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>
    `;

    // 1. Position and Dimensions
    const posSec = document.createElement('div');
    posSec.className = 'inspector-section';
    posSec.innerHTML = `
      <div class="section-title">Posição e Dimensões</div>
      <div class="inspector-grid">
        <div class="field-group">
          <label class="field-label">X (px)</label>
          <input type="number" id="insp-x" class="inspector-input" value="${widget.position.x}">
        </div>
        <div class="field-group">
          <label class="field-label">Y (px)</label>
          <input type="number" id="insp-y" class="inspector-input" value="${widget.position.y}">
        </div>
        <div class="field-group">
          <label class="field-label">Largura (px)</label>
          <input type="number" id="insp-w" class="inspector-input" value="${widget.position.width}">
        </div>
        <div class="field-group">
          <label class="field-label">Altura (px)</label>
          <input type="number" id="insp-h" class="inspector-input" value="${widget.position.height}">
        </div>
      </div>
      <div class="field-group" style="margin-top: 0.4rem;">
        <label class="field-label">Camada (Z-Index: 1 a 999)</label>
        <input type="number" id="insp-z" class="inspector-input" value="${widget.position.zIndex || 1}" min="1" max="999">
      </div>
    `;

    // 2. Typography & Appearance
    const style = widget.style || {};
    const appSec = document.createElement('div');
    appSec.className = 'inspector-section';
    appSec.innerHTML = `
      <div class="section-title">Aparência e Estilo</div>
      <div class="field-group">
        <label class="field-label">Tamanho da Fonte (${style.fontSize || 16}px)</label>
        <div class="slider-wrapper">
          <input type="range" id="insp-fontsize" class="range-slider" min="10" max="72" value="${style.fontSize || 16}">
          <span class="slider-val" id="val-fontsize">${style.fontSize || 16}px</span>
        </div>
      </div>
      <div class="inspector-grid">
        <div class="field-group">
          <label class="field-label">Cor do Texto</label>
          <div class="color-input-wrapper">
            <input type="color" id="insp-textcolor-pick" class="color-picker" value="${sanitizeColorHex(style.textColor || '#ffffff')}">
            <input type="text" id="insp-textcolor-hex" class="inspector-input" value="${style.textColor || '#ffffff'}" style="flex: 1;">
          </div>
        </div>
        <div class="field-group">
          <label class="field-label">Cor de Fundo</label>
          <div class="color-input-wrapper">
            <input type="color" id="insp-bgcolor-pick" class="color-picker" value="${sanitizeColorHex(style.backgroundColor || '#0c101a')}">
            <input type="text" id="insp-bgcolor-hex" class="inspector-input" value="${style.backgroundColor || '#0c101a'}" style="flex: 1;">
          </div>
        </div>
      </div>
      <div class="field-group">
        <label class="field-label">Opacidade (${Math.round((style.opacity !== undefined ? style.opacity : 1) * 100)}%)</label>
        <div class="slider-wrapper">
          <input type="range" id="insp-opacity" class="range-slider" min="0" max="100" value="${Math.round((style.opacity !== undefined ? style.opacity : 1) * 100)}">
          <span class="slider-val" id="val-opacity">${Math.round((style.opacity !== undefined ? style.opacity : 1) * 100)}%</span>
        </div>
      </div>
      <div class="field-group">
        <label class="field-label">Arredondamento das Bordas (${style.borderRadius !== undefined ? style.borderRadius : 12}px)</label>
        <div class="slider-wrapper">
          <input type="range" id="insp-radius" class="range-slider" min="0" max="100" value="${style.borderRadius !== undefined ? style.borderRadius : 12}">
          <span class="slider-val" id="val-radius">${style.borderRadius !== undefined ? style.borderRadius : 12}px</span>
        </div>
      </div>
    `;

    // 3. Widget Specific Configuration
    const specSec = document.createElement('div');
    specSec.className = 'inspector-section';

    if (widget.id === 'chat') {
      specSec.innerHTML = `
        <div class="section-title">Opções do Chat</div>
        <div class="field-group">
          <label class="field-label">Limite de Mensagens Visíveis</label>
          <input type="number" id="insp-chat-limit" class="inspector-input" min="5" max="100" value="${widget.messageLimit || 25}">
        </div>
        <div class="toggle-switch-wrapper" style="margin-top: 0.4rem;">
          <span class="toggle-switch-label">Exibir Avatar / Foto de Perfil</span>
          <label class="toggle-switch">
            <input type="checkbox" id="insp-chat-avatar" ${widget.showAvatar ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </div>
      `;
    } else if (widget.id === 'gift-alerts') {
      const durSec = ((widget.defaultDurationMs || 4000) / 1000).toFixed(1);
      specSec.innerHTML = `
        <div class="section-title" style="display: flex; justify-content: space-between; align-items: center;">
          <span>Configuração de Alertas</span>
          <button id="btn-insp-test-alert" class="btn btn-ghost" style="padding: 2px 8px; font-size: 0.72rem; color: var(--gold);">
            ✨ Testar alerta
          </button>
        </div>
        <div class="field-group">
          <label class="field-label">Duração Padrão (segundos)</label>
          <input type="number" id="insp-alert-duration" class="inspector-input" min="1" max="30" step="0.5" value="${durSec}">
        </div>
        <div class="field-group" style="margin-top: 0.6rem;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.4rem;">
            <label class="field-label" style="font-weight: 700; color: #fff;">Regras de Alerta Personalizadas</label>
            <button id="btn-add-alert-rule" class="btn-ghost" style="font-size: 0.72rem; color: var(--primary);">+ Adicionar Regra</button>
          </div>
          <div class="rules-list" id="insp-rules-list"></div>
        </div>
      `;
    } else if (widget.id === 'likes-goal') {
      specSec.innerHTML = `
        <div class="section-title">Meta de Curtidas</div>
        <div class="field-group">
          <label class="field-label">Título da Meta</label>
          <input type="text" id="insp-goal-title" class="inspector-input" value="${widget.title || 'Meta de Curtidas'}">
        </div>
        <div class="field-group">
          <label class="field-label">Meta Alvo (Curtidas)</label>
          <input type="number" id="insp-goal-target" class="inspector-input" min="1" step="100" value="${widget.targetLikes || 1000}">
        </div>
        <div class="field-group">
          <label class="field-label">Curtidas Iniciais (opcional)</label>
          <input type="number" id="insp-goal-initial" class="inspector-input" min="0" step="50" value="${widget.initialLikes || 0}">
        </div>
      `;
    }

    inspectorPanel.appendChild(headerSec);
    inspectorPanel.appendChild(posSec);
    inspectorPanel.appendChild(appSec);
    if (specSec.children.length > 0) {
      inspectorPanel.appendChild(specSec);
    }

    // Attach Inspector Listeners
    attachInspectorEventListeners(widget);
  }

  function sanitizeColorHex(colorStr) {
    if (!colorStr) return '#000000';
    if (colorStr.startsWith('#') && (colorStr.length === 7 || colorStr.length === 4)) {
      return colorStr;
    }
    return '#3b82f6';
  }

  function syncInspectorInputs() {
    const widget = getSelectedWidget();
    if (!widget) return;
    const xInput = document.getElementById('insp-x');
    const yInput = document.getElementById('insp-y');
    const wInput = document.getElementById('insp-w');
    const hInput = document.getElementById('insp-h');
    const zInput = document.getElementById('insp-z');
    if (xInput) xInput.value = widget.position.x;
    if (yInput) yInput.value = widget.position.y;
    if (wInput) wInput.value = widget.position.width;
    if (hInput) hInput.value = widget.position.height;
    if (zInput) zInput.value = widget.position.zIndex || 1;
  }

  function attachInspectorEventListeners(widget) {
    const { width: canvasW, height: canvasH } = getActiveCanvasDimensions();

    // Visibility
    const visCheckbox = document.getElementById('insp-visible');
    if (visCheckbox) {
      visCheckbox.addEventListener('change', () => {
        widget.visible = visCheckbox.checked;
        renderCanvas();
        renderLayersList();
        updateEditorStatus();
      });
    }

    // Position & Dimensions Numeric Inputs
    const xInput = document.getElementById('insp-x');
    const yInput = document.getElementById('insp-y');
    const wInput = document.getElementById('insp-w');
    const hInput = document.getElementById('insp-h');
    const zInput = document.getElementById('insp-z');

    function applyNumericValues(shouldClampInputs) {
      const parsedX = parseInt(xInput.value, 10);
      const parsedY = parseInt(yInput.value, 10);
      const parsedW = parseInt(wInput.value, 10);
      const parsedH = parseInt(hInput.value, 10);
      const parsedZ = parseInt(zInput.value, 10);

      const x = Math.max(0, Math.min(Number.isNaN(parsedX) ? 0 : parsedX, canvasW - 40));
      const y = Math.max(0, Math.min(Number.isNaN(parsedY) ? 0 : parsedY, canvasH - 20));
      const w = Math.max(40, Math.min(Number.isNaN(parsedW) ? 40 : parsedW, canvasW - x));
      const h = Math.max(20, Math.min(Number.isNaN(parsedH) ? 20 : parsedH, canvasH - y));
      const z = Math.max(1, Math.min(Number.isNaN(parsedZ) ? 1 : parsedZ, 999));

      widget.position.x = x;
      widget.position.y = y;
      widget.position.width = w;
      widget.position.height = h;
      widget.position.zIndex = z;

      if (shouldClampInputs) {
        xInput.value = x;
        yInput.value = y;
        wInput.value = w;
        hInput.value = h;
        zInput.value = z;
      }

      renderCanvas();
      renderLayersList();
      updateEditorStatus();
    }

    [xInput, yInput, wInput, hInput, zInput].forEach(inp => {
      if (inp) {
        inp.addEventListener('input', () => applyNumericValues(false));
        inp.addEventListener('change', () => applyNumericValues(true));
      }
    });

    // Font Size
    const fontSlider = document.getElementById('insp-fontsize');
    const fontVal = document.getElementById('val-fontsize');
    if (fontSlider) {
      fontSlider.addEventListener('input', () => {
        const val = parseInt(fontSlider.value);
        widget.style.fontSize = val;
        fontVal.textContent = `${val}px`;
        renderCanvas();
        updateEditorStatus();
      });
    }

    // Text Color
    const textColorPick = document.getElementById('insp-textcolor-pick');
    const textColorHex = document.getElementById('insp-textcolor-hex');
    if (textColorPick && textColorHex) {
      textColorPick.addEventListener('input', () => {
        textColorHex.value = textColorPick.value;
        widget.style.textColor = textColorPick.value;
        renderCanvas();
        updateEditorStatus();
      });
      textColorHex.addEventListener('input', () => {
        widget.style.textColor = textColorHex.value;
        renderCanvas();
        updateEditorStatus();
      });
    }

    // Background Color
    const bgColorPick = document.getElementById('insp-bgcolor-pick');
    const bgColorHex = document.getElementById('insp-bgcolor-hex');
    if (bgColorPick && bgColorHex) {
      bgColorPick.addEventListener('input', () => {
        bgColorHex.value = bgColorPick.value;
        widget.style.backgroundColor = bgColorPick.value;
        renderCanvas();
        updateEditorStatus();
      });
      bgColorHex.addEventListener('input', () => {
        widget.style.backgroundColor = bgColorHex.value;
        renderCanvas();
        updateEditorStatus();
      });
    }

    // Opacity
    const opacSlider = document.getElementById('insp-opacity');
    const opacVal = document.getElementById('val-opacity');
    if (opacSlider) {
      opacSlider.addEventListener('input', () => {
        const pct = parseInt(opacSlider.value);
        widget.style.opacity = pct / 100;
        opacVal.textContent = `${pct}%`;
        renderCanvas();
        updateEditorStatus();
      });
    }

    // Border Radius
    const radSlider = document.getElementById('insp-radius');
    const radVal = document.getElementById('val-radius');
    if (radSlider) {
      radSlider.addEventListener('input', () => {
        const val = parseInt(radSlider.value);
        widget.style.borderRadius = val;
        radVal.textContent = `${val}px`;
        renderCanvas();
        updateEditorStatus();
      });
    }

    // Chat Specific
    if (widget.id === 'chat') {
      const limitInp = document.getElementById('insp-chat-limit');
      const avatarCheck = document.getElementById('insp-chat-avatar');
      if (limitInp) {
        limitInp.addEventListener('input', () => {
          const val = parseInt(limitInp.value, 10);
          if (!Number.isNaN(val)) {
            widget.messageLimit = Math.max(5, Math.min(val, 100));
            updateEditorStatus();
          }
        });
      }
      if (avatarCheck) {
        avatarCheck.addEventListener('change', () => {
          widget.showAvatar = avatarCheck.checked;
          renderCanvas();
          updateEditorStatus();
        });
      }
    }

    // Gift Alerts Specific
    if (widget.id === 'gift-alerts') {
      const durInp = document.getElementById('insp-alert-duration');
      if (durInp) {
        durInp.addEventListener('input', () => {
          const sec = parseFloat(durInp.value);
          if (!Number.isNaN(sec) && sec > 0) {
            widget.defaultDurationMs = Math.round(sec * 1000);
            updateEditorStatus();
          }
        });
      }

      // Test Alert Button (animates mock on canvas)
      const btnTestAlert = document.getElementById('btn-insp-test-alert');
      if (btnTestAlert) {
        btnTestAlert.addEventListener('click', () => {
          const widgetEl = document.getElementById('canvas-widget-gift-alerts');
          if (widgetEl) {
            widgetEl.style.transform = 'scale(1.08)';
            widgetEl.style.transition = 'transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
            setTimeout(() => {
              widgetEl.style.transform = 'scale(1)';
            }, 300);
          }
          showEditorToast('Alerta de presente testado no canvas!');
        });
      }

      renderGiftRulesList(widget);
    }

    // Likes Goal Specific
    if (widget.id === 'likes-goal') {
      const titleInp = document.getElementById('insp-goal-title');
      const targetInp = document.getElementById('insp-goal-target');
      const initInp = document.getElementById('insp-goal-initial');

      if (titleInp) {
        titleInp.addEventListener('input', () => {
          widget.title = titleInp.value;
          renderCanvas();
          updateEditorStatus();
        });
      }
      if (targetInp) {
        targetInp.addEventListener('input', () => {
          const val = parseInt(targetInp.value, 10);
          if (!Number.isNaN(val) && val >= 1) {
            widget.targetLikes = val;
            renderCanvas();
            updateEditorStatus();
          }
        });
      }
      if (initInp) {
        initInp.addEventListener('input', () => {
          const val = parseInt(initInp.value, 10);
          if (!Number.isNaN(val) && val >= 0) {
            widget.initialLikes = val;
            renderCanvas();
            updateEditorStatus();
          }
        });
      }
    }
  }

  // --- Gift Alert Rules Editor ---
  function renderGiftRulesList(widget) {
    const listEl = document.getElementById('insp-rules-list');
    const btnAddRule = document.getElementById('btn-add-alert-rule');
    if (!listEl) return;

    listEl.innerHTML = '';
    const rules = widget.rules || [];

    rules.forEach((rule, idx) => {
      const item = document.createElement('div');
      item.className = 'rule-item-box';
      item.innerHTML = `
        <div class="rule-item-header">
          <input type="text" class="rule-name-input" value="${rule.name || `Regra ${idx + 1}`}">
          <button class="rule-delete-btn" title="Remover regra">Excluir</button>
        </div>
        <div class="inspector-grid" style="margin-top: 4px;">
          <div class="field-group">
            <label class="field-label">ID do Presente (ex: galaxy)</label>
            <input type="text" class="inspector-input rule-giftid" value="${rule.giftId || ''}" placeholder="Qualquer">
          </div>
          <div class="field-group">
            <label class="field-label">Qtd. Mínima</label>
            <input type="number" class="inspector-input rule-mincount" min="1" value="${rule.minCount || 1}">
          </div>
        </div>
        <div class="inspector-grid" style="margin-top: 4px;">
          <div class="field-group">
            <label class="field-label">Duração (ms)</label>
            <input type="number" class="inspector-input rule-dur" min="1000" step="500" value="${rule.durationMs || 4000}">
          </div>
          <div class="field-group">
            <label class="field-label">Cor do Banner</label>
            <input type="color" class="color-picker rule-bannercolor" value="${sanitizeColorHex(rule.bannerColor || '#f59e0b')}">
          </div>
        </div>
      `;

      // Event listeners for rule items
      const nameInp = item.querySelector('.rule-name-input');
      const delBtn = item.querySelector('.rule-delete-btn');
      const giftIdInp = item.querySelector('.rule-giftid');
      const minCountInp = item.querySelector('.rule-mincount');
      const durInp = item.querySelector('.rule-dur');
      const colorPick = item.querySelector('.rule-bannercolor');

      nameInp.addEventListener('change', () => { rule.name = nameInp.value; updateEditorStatus(); });
      giftIdInp.addEventListener('change', () => { rule.giftId = giftIdInp.value.trim() || undefined; updateEditorStatus(); });
      minCountInp.addEventListener('change', () => { rule.minCount = parseInt(minCountInp.value) || 1; updateEditorStatus(); });
      durInp.addEventListener('change', () => { rule.durationMs = parseInt(durInp.value) || 4000; updateEditorStatus(); });
      colorPick.addEventListener('input', () => { rule.bannerColor = colorPick.value; updateEditorStatus(); });

      delBtn.addEventListener('click', () => {
        widget.rules.splice(idx, 1);
        renderGiftRulesList(widget);
        updateEditorStatus();
      });

      listEl.appendChild(item);
    });

    if (btnAddRule) {
      btnAddRule.onclick = () => {
        if (!widget.rules) widget.rules = [];
        widget.rules.push({
          id: `rule-${Date.now()}`,
          name: `Nova Regra (${widget.rules.length + 1})`,
          minCount: 1,
          durationMs: 5000,
          bannerColor: '#f59e0b',
          textColor: '#ffffff'
        });
        renderGiftRulesList(widget);
        updateEditorStatus();
      };
    }
  }

  // --- Switch Orientation ---
  function setOrientation(orientation) {
    if (currentOrientation === orientation) return;
    currentOrientation = orientation;

    btnOrientHoriz.classList.toggle('active', orientation === 'horizontal');
    btnOrientVert.classList.toggle('active', orientation === 'vertical');

    if (zoomMode === 'fit') {
      fitZoomToViewport();
    }

    renderCanvas();
    renderLayersList();
    renderInspector();
  }

  // --- API Actions: Load, Save, Discard, Reset ---
  async function loadConfigFromServer() {
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        const data = await res.json();
        if (data && data.version === '1.0' && data.layouts) {
          savedConfig = deepClone(data);
          draftConfig = deepClone(data);
          updateEditorStatus();
          renderCanvas();
          renderLayersList();
          renderInspector();
          if (zoomMode === 'fit') fitZoomToViewport();
          return;
        }
      }
    } catch (err) {
      console.warn('Configuração ainda não disponível no servidor, usando padrões.', err);
    }

    // Fallback to defaults
    savedConfig = createDefaultOverlayConfig();
    draftConfig = deepClone(savedConfig);
    updateEditorStatus();
    renderCanvas();
    renderLayersList();
    renderInspector();
    if (zoomMode === 'fit') fitZoomToViewport();
  }

  async function saveConfigToServer() {
    if (isSaving) return;
    isSaving = true;
    updateEditorStatus('saving');

    try {
      draftConfig.lastUpdatedAt = new Date().toISOString();

      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draftConfig)
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Erro HTTP ${res.status}`);
      }

      const result = await res.json();
      savedConfig = deepClone(result.config || draftConfig);
      draftConfig = deepClone(savedConfig);
      updateEditorStatus();
      showEditorToast('Layout do overlay salvo e aplicado com sucesso!');
    } catch (err) {
      console.error('Falha ao salvar configuração:', err);
      updateEditorStatus('error');
      showEditorToast(`Falha ao salvar: ${err.message}`, 'error');
    } finally {
      isSaving = false;
    }
  }

  function discardChanges() {
    if (!isDraftDirty()) return;
    draftConfig = deepClone(savedConfig);
    renderCanvas();
    renderLayersList();
    renderInspector();
    updateEditorStatus();
    showEditorToast('Alterações descartadas.');
  }

  async function resetToDefaults() {
    const confirmReset = window.confirm('Deseja restaurar as configurações padrão de todos os layouts? Suas alterações serão substituídas.');
    if (!confirmReset) return;

    try {
      const res = await fetch('/api/config/reset', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.config) {
          savedConfig = deepClone(data.config);
          draftConfig = deepClone(data.config);
          renderCanvas();
          renderLayersList();
          renderInspector();
          updateEditorStatus();
          showEditorToast('Configurações padrão restauradas com sucesso!');
          return;
        }
      }
    } catch (e) {
      // Fallback local reset
    }

    draftConfig = createDefaultOverlayConfig();
    renderCanvas();
    renderLayersList();
    renderInspector();
    updateEditorStatus();
    showEditorToast('Configurações padrão carregadas no rascunho.');
  }

  function testPreview() {
    const urlDisplay = document.getElementById('obs-url-display');
    const url = urlDisplay && urlDisplay.textContent.startsWith('http') 
      ? urlDisplay.textContent 
      : `${window.location.origin}/overlay/default-token`;
    window.open(url, '_blank', 'width=1280,height=720,menubar=no,toolbar=no');
  }

  // --- Initialize Event Listeners ---
  function initEventListeners() {
    // Orientation Buttons
    if (btnOrientHoriz) btnOrientHoriz.addEventListener('click', () => setOrientation('horizontal'));
    if (btnOrientVert) btnOrientVert.addEventListener('click', () => setOrientation('vertical'));

    // Zoom Controls
    if (btnZoomIn) btnZoomIn.addEventListener('click', () => applyZoom(zoomScale + 0.1, false));
    if (btnZoomOut) btnZoomOut.addEventListener('click', () => applyZoom(zoomScale - 0.1, false));
    if (btnZoomFit) btnZoomFit.addEventListener('click', () => fitZoomToViewport());

    zoomPresetButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const pct = parseInt(btn.dataset.zoom) || 50;
        applyZoom(pct / 100, false);
      });
    });

    window.addEventListener('resize', () => {
      if (zoomMode === 'fit') fitZoomToViewport();
    });

    // Action Buttons
    if (btnSaveConfig) btnSaveConfig.addEventListener('click', saveConfigToServer);
    if (btnDiscardConfig) btnDiscardConfig.addEventListener('click', discardChanges);
    if (btnResetConfig) btnResetConfig.addEventListener('click', resetToDefaults);
    if (btnTestPreview) btnTestPreview.addEventListener('click', testPreview);
  }

  // --- Tab Switching Logic (Global Export for Dashboard) ---
  window.initOverlayEditor = function () {
    fitZoomToViewport();
    renderCanvas();
    renderLayersList();
    renderInspector();
    updateEditorStatus();
  };

  // --- Bootstrapping ---
  initEventListeners();
  loadConfigFromServer();

})();
