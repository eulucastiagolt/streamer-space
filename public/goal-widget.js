'use strict';

// Derive the next target from the current total so reloads and reconnects
// produce the same result, including when a batch crosses several targets.
function getGoalProgress(current, target, behavior, increment) {
  const reached = current >= target;
  if (reached && behavior === 'increase') {
    target += (Math.floor((current - target) / increment) + 1) * increment;
  } else if (reached && behavior === 'double') {
    while (target <= current) target *= 2;
  }
  return { target, reached, hide: reached && behavior === 'hide' };
}

function createGoalWidget(params) {
  const widget = document.getElementById('likes-goal-widget');
  const title = document.getElementById('likes-goal-title');
  const badge = document.getElementById('likes-goal-badge');
  const progress = document.getElementById('likes-goal-progress');
  const currentText = document.getElementById('likes-goal-current');
  const targetText = document.getElementById('likes-goal-target');
  const percentage = document.getElementById('likes-goal-percentage');
  const format = new Intl.NumberFormat('pt-BR');
  const behavior = params.get('whenReached');
  const increment = Math.max(1, Math.min(1e12, Math.trunc(Number(params.get('increment'))) || 100));
  const showBadge = params.get('action') !== 'none';

  return ({ label, current, target, note = '' }) => {
    const state = getGoalProgress(current ?? 0, target, behavior, increment);
    const pct = current === undefined ? 0 : Math.min(100, Math.floor(current / state.target * 100));
    widget.toggleAttribute('data-goal-hidden', state.hide);
    title.textContent = params.get('title')?.trim().slice(0, 64) || label;
    currentText.textContent = current === undefined ? '—' : format.format(current);
    targetText.textContent = format.format(state.target);
    percentage.textContent = note || (current === undefined ? '—' : `${pct}%`);
    progress.style.width = `${pct}%`;
    badge.style.display = showBadge && state.reached ? 'inline-flex' : 'none';
    widget.classList.toggle('goal-reached', state.reached && showBadge);
    progress.classList.toggle('progress-reached', pct === 100);
  };
}
