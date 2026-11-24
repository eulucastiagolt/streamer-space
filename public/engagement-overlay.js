'use strict';

const [, , token, widget] = window.location.pathname.split('/');
const widgets = {
  'followers-goal': { title: 'Meta de seguidores', key: 'followers', target: 10, unit: 'novos seguidores' },
  'gifts-goal': { title: 'Meta de presentes', key: 'gifts', target: 25, unit: 'presentes' },
  'top-liker': { title: 'Top Liker', key: 'topLikers', unit: 'curtidas' },
  'top-gifters': { title: 'Top Gifters', key: 'topGifters', unit: 'Coins' },
};
const config = widgets[widget];
if (config) {
  const card = document.querySelector('.engagement-card');
  const title = document.getElementById('engagement-title');
  const params = new URLSearchParams(window.location.search);
  const renderGoal = createGoalWidget(params);
  const empty = document.getElementById('engagement-empty');
  const ranking = document.getElementById('engagement-ranking');
  const options = config.target ? undefined : readEngagementSettings(widget, params);
  const requestedTarget = Number(params.get('target'));
  const target = Number.isSafeInteger(requestedTarget) && requestedTarget > 0
    ? requestedTarget
    : config.target;

  title.textContent = config.title;
  card.hidden = Boolean(config.target);
  if (config.target) document.getElementById('likes-goal-widget').hidden = false;
  if (options) {
    card.classList.add('viewer-ranking');
    applyEngagementTypography(card, options);
    card.dir = options.rtl ? 'rtl' : 'ltr';
    card.dataset.nameEffect = options.nameEffect;
    card.style.setProperty('--viewer-name', options.nameColor);
    card.style.setProperty('--viewer-score', options.scoreColor);
    card.style.setProperty('--viewer-position', options.rankColor);
    if (options.shadow) card.style.setProperty('--viewer-shadow', options.shadowColor);
    if (options.outline) card.style.setProperty('--viewer-outline', options.outlineColor);
  }

  const automatic = widget === 'followers-goal' && !['session', 'manual'].includes(params.get('followers'));
  const baselineParam = params.get('initial');
  const initial = Number(baselineParam);
  const hasInitial = baselineParam !== null && baselineParam !== '' && initial >= 0 && Number.isSafeInteger(initial);

  function render(stats, sample = false) {
    const value = stats[config.key];
    if (config.target) {
      const pending = automatic && !sample && stats.followerCountPending;
      const current = pending ? 0 : automatic && !sample
        ? stats.profileFollowers ?? (hasInitial ? initial + value : undefined)
        : (hasInitial ? initial : 0) + value;
      renderGoal({
        label: config.title,
        current,
        target,
        note: pending ? 'Carregando seguidores…' :
          current === undefined ? 'Total do perfil indisponível' :
          automatic && !sample && stats.profileFollowers === undefined ? 'Base manual' : '',
      });
      return;
    }

    empty.textContent = `Aguardando ${config.unit}…`;
    empty.hidden = value.length > 0;
    ranking.hidden = value.length === 0;
    renderViewerRanking(ranking, value, options, {
      symbol: widget === 'top-liker' ? '♥' : '🪙',
      label: config.unit,
    });
  }

  if (params.get('preview') === 'sample') {
    const sample = config.target
      ? Math.ceil(target * 0.6)
      : [1280, 840, 530, 270, 120, 91, 72, 56, 34, 10].map((count, index) => ({
          username: `exemplo_${index + 1}`,
          displayName: ['Ana', 'Rafa', 'Bia', 'Lu', 'Caio', 'Léo', 'Mari', 'Duda', 'Gui', 'Nina'][index],
          count,
        }));
    render({ [config.key]: sample }, true);
  } else {
    render({ [config.key]: config.target ? 0 : [], followerCountPending: true });
    const events = new EventSource(`/overlay/${encodeURIComponent(token)}/events?view=engagement`);
    events.addEventListener('engagement', event => render(JSON.parse(event.data)));
  }
}
