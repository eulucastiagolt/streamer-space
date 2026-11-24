'use strict';

if (widget === 'gift-jar') {
  const jar = document.getElementById('gift-jar-overlay');
  const pile = jar.querySelector('.gift-jar-pile');
  const falling = jar.querySelector('.gift-jar-falling');
  const alert = jar.querySelector('.gift-jar-alert');
  const ranking = jar.querySelector('.gift-jar-ranking');
  const total = jar.querySelector('.gift-jar-total');
  const params = new URLSearchParams(location.search);
  const options = readEngagementSettings(widget, params);
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const capacity = 84;
  let lastGift = '';
  let lastPile = '';
  let initial = true;
  let alertTimer;
  let rankingTimer;

  jar.hidden = false;
  applyEngagementTypography(jar, options);
  jar.style.setProperty('--jar-x', `${options.offsetX}px`);
  jar.style.setProperty('--jar-y', `${options.offsetY}px`);
  jar.style.setProperty('--jar-scale', options.scale);
  jar.style.setProperty('--gift-scale', options.giftScale);

  function giftIcon({ image, name }) {
    const icon = document.createElement('span');
    icon.className = 'jar-gift';
    const key = (name || '').toLowerCase();
    icon.textContent = key.includes('rosa') || key.includes('rose') ? '🌹' :
      key.includes('coração') || key.includes('heart') ? '💜' : '🎁';
    if (typeof image === 'string' && /^https?:\/\//i.test(image)) {
      const img = document.createElement('img');
      img.alt = '';
      img.addEventListener('load', () => {
        if (icon.firstChild?.nodeType === Node.TEXT_NODE) icon.firstChild.remove();
      }, { once: true });
      img.addEventListener('error', () => img.remove(), { once: true });
      img.src = image;
      icon.append(img);
    }
    return icon;
  }

  function renderPile(gifts, count) {
    const key = JSON.stringify(gifts);
    if (lastPile === key) return;
    lastPile = key;
    const visible = Math.min(capacity, count);
    const icons = [];
    let giftIndex = 0;
    let cumulative = gifts[0]?.count ?? 0;
    for (let i = 0; i < visible; i++) {
      const share = (i + 0.5) * count / visible;
      while (share >= cumulative && giftIndex < gifts.length - 1) {
        cumulative += gifts[++giftIndex].count;
      }
      const icon = giftIcon(gifts[giftIndex]);
      const row = Math.floor(i / 8);
      icon.style.left = `${7 + (i % 8) * 12 + ((i * 17) % 7) - 3}%`;
      icon.style.bottom = `${7 + row * 7 + ((i * 11) % 5)}%`;
      icon.style.rotate = `${(i * 43) % 60 - 30}deg`;
      icons.push(icon);
    }
    pile.replaceChildren(...icons);
  }

  function animateGift(gift) {
    if (reducedMotion.matches) return;
    const count = Math.min(12, gift.count);
    for (let i = 0; i < count; i++) {
      const icon = giftIcon({ image: gift.giftPictureUrl, name: gift.giftName });
      icon.style.left = `${10 + Math.random() * 78}%`;
      icon.style.animationDelay = `${i * 45}ms`;
      icon.addEventListener('animationend', () => icon.remove(), { once: true });
      falling.append(icon);
    }
    while (falling.childElementCount > 36) falling.firstElementChild.remove();
  }

  function showAlert(gift) {
    if (!options.alerts) return;
    const text = document.createElement('span');
    const author = document.createElement('strong');
    author.textContent = gift.displayName || gift.username;
    const coins = gift.diamondCount === undefined ? '' : ` · ${rankNumber.format(gift.diamondCount)} Coins`;
    text.append(author, ` enviou ${rankNumber.format(gift.count)}× ${gift.giftName}${coins}`);
    alert.replaceChildren(viewerAvatar(gift), text);
    alert.hidden = false;
    clearTimeout(alertTimer);
    alertTimer = setTimeout(() => { alert.hidden = true; }, options.alertSeconds * 1000);
  }

  function showRanking(entries) {
    if (!options.ranking || !entries.length) return;
    renderViewerRanking(ranking, entries, {
      limit: options.limit, avatar: options.format === 'avatar', name: true,
      points: options.format !== 'name', position: options.badges, trophies: options.badges,
      crown: options.badges, symbol: true,
    }, { symbol: '🪙', label: 'Coins' });
    ranking.hidden = false;
    clearTimeout(rankingTimer);
    if (options.rankingSeconds > 0) {
      rankingTimer = setTimeout(() => { ranking.hidden = true; }, options.rankingSeconds * 1000);
    }
  }

  function render({ count, coins, gifts, ranking: entries, latest }) {
    renderPile(gifts, count);
    total.textContent = `🪙 ${rankNumber.format(coins)} Coins`;
    total.hidden = !options.total;
    if (!latest) {
      lastGift = '';
      clearTimeout(alertTimer);
      clearTimeout(rankingTimer);
      alert.hidden = true;
      ranking.hidden = true;
      falling.replaceChildren();
      initial = false;
      return;
    }
    const key = `${latest.sessionId}:${latest.sequence}`;
    if (key === lastGift) return;
    if (lastGift && !lastGift.startsWith(`${latest.sessionId}:`)) falling.replaceChildren();
    lastGift = key;
    if (!initial) {
      animateGift(latest.data);
      showAlert(latest.data);
    }
    showRanking(entries);
    initial = false;
  }

  if (params.get('preview') === 'sample') {
    const samples = [
      { id: 5655, name: 'Rosa', count: 18, price: 1, viewer: 'Ana' },
      { id: 7934, name: 'Coração', count: 5, price: 100, viewer: 'Rafa' },
      { id: 5760, name: 'Leão', count: 2, price: 29999, viewer: 'Bia' },
    ];
    const selected = options.giftIds.toLowerCase().split(',').map(value => value.trim());
    const gifts = samples.filter(gift => options.giftFilter === 'selected'
      ? selected.includes(String(gift.id)) || selected.includes(gift.name.toLowerCase())
      : options.giftFilter !== 'minimum' || gift.price >= options.minCoins);
    render({ count: 0, coins: 0, gifts: [], ranking: [] });
    const last = gifts.at(-1);
    if (last) setTimeout(() => {
      const entries = gifts.map(gift => ({
        username: gift.viewer, displayName: gift.viewer, count: gift.count * gift.price,
      })).sort((a, b) => b.count - a.count);
      render({
        count: gifts.reduce((sum, gift) => sum + gift.count, 0),
        coins: entries.reduce((sum, viewer) => sum + viewer.count, 0),
        gifts,
        ranking: entries,
        latest: { sessionId: 'sample', sequence: 1, data: {
          username: last.viewer, count: last.count, giftName: last.name, diamondCount: last.count * last.price,
        } },
      });
    }, 250);
  } else {
    const filters = new URLSearchParams({ view: 'gift-jar' });
    for (const name of ['giftFilter', 'giftIds', 'minCoins']) filters.set(name, options[name]);
    const events = new EventSource(`/overlay/${encodeURIComponent(token)}/events?${filters}`);
    events.addEventListener('gift-jar', event => render(JSON.parse(event.data)));
  }
}
