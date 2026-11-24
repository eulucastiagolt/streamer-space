'use strict';

const rankNumber = new Intl.NumberFormat('pt-BR');
const rankTrophies = ['🥇', '🥈', '🥉'];

function viewerAvatar({ username, displayName, avatarUrl }) {
  const avatar = document.createElement('span');
  avatar.className = 'viewer-avatar';
  avatar.textContent = (displayName || username || '?').slice(0, 2).toLocaleUpperCase('pt-BR');
  avatar.setAttribute('aria-hidden', 'true');
  if (typeof avatarUrl === 'string' && /^https?:\/\//i.test(avatarUrl)) {
    const img = document.createElement('img');
    img.alt = '';
    img.addEventListener('error', () => img.remove(), { once: true });
    img.src = avatarUrl;
    avatar.append(img);
  }
  return avatar;
}

function applyEngagementTypography(element, options) {
  element.style.fontFamily = options.font;
  element.style.fontSize = `${options.fontSize}px`;
  element.style.letterSpacing = `${options.letterSpacing}px`;
  element.style.setProperty('--line-gap', `${options.lineGap}px`);
}

function renderViewerRanking(list, entries, options, units) {
  list.replaceChildren(...entries.slice(0, Number(options.limit)).map((entry, index) => {
    const row = document.createElement('li');
    if (options.position || (options.trophies && index < 3)) {
      const position = document.createElement('span');
      position.className = 'viewer-position';
      position.textContent = options.trophies && index < 3 ? rankTrophies[index] : `${index + 1}.`;
      position.setAttribute('aria-label', `Posição ${index + 1}`);
      row.append(position);
    }
    if (options.avatar || (options.crown && index === 0)) {
      const identity = options.avatar ? viewerAvatar(entry) : document.createElement('span');
      if (options.crown && index === 0) {
        const crown = document.createElement('span');
        crown.className = 'viewer-crown';
        crown.textContent = '♛';
        crown.setAttribute('aria-label', 'Primeiro colocado');
        identity.classList.add('viewer-leader');
        identity.append(crown);
      }
      row.append(identity);
    }
    if (options.name) {
      const name = document.createElement('span');
      name.className = 'viewer-name';
      name.textContent = entry.displayName || entry.username;
      row.append(name);
    }
    if (options.points) {
      const score = document.createElement('strong');
      score.className = 'viewer-score';
      score.textContent = `${options.symbol ? `${units.symbol} ` : ''}${rankNumber.format(entry.count)}`;
      score.setAttribute('aria-label', `${rankNumber.format(entry.count)} ${units.label}`);
      row.append(score);
    }
    return row;
  }));
}
