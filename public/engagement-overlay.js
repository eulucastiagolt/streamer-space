'use strict';

const [, , token, widget] = window.location.pathname.split('/');
const widgets = {
  'followers-goal': { title: 'Meta de seguidores', key: 'followers', target: 10, unit: 'novos seguidores' },
  'gifts-goal': { title: 'Meta de presentes', key: 'gifts', target: 25, unit: 'presentes' },
  'top-liker': { title: 'Top Liker', key: 'topLikers', unit: 'curtidas' },
  'top-gifters': { title: 'Top Gifters', key: 'topGifters', unit: 'presentes' },
};
const config = widgets[widget];
if (config) {
  const card = document.querySelector('.engagement-card');
  const title = document.getElementById('engagement-title');
  const params = new URLSearchParams(window.location.search);
  const renderGoal = createGoalWidget(params);
  const empty = document.getElementById('engagement-empty');
  const ranking = document.getElementById('engagement-ranking');
  const number = new Intl.NumberFormat('pt-BR');
  const requestedTarget = Number(params.get('target'));
  const target = Number.isSafeInteger(requestedTarget) && requestedTarget > 0
    ? requestedTarget
    : config.target;

  title.textContent = config.title;
  card.hidden = Boolean(config.target);
  if (config.target) document.getElementById('likes-goal-widget').hidden = false;

  const automatic = widget === 'followers-goal' && !['session', 'manual'].includes(params.get('followers'));
  const baselineParam = params.get('initial');
  const initial = Number(baselineParam);
  const hasInitial = baselineParam !== null && baselineParam !== '' && initial >= 0 && Number.isSafeInteger(initial);

  function render(stats, sample = false) {
    const value = stats[config.key];
    if (config.target) {
      const current = automatic && !sample
        ? stats.profileFollowers ?? (hasInitial ? initial + value : undefined)
        : (hasInitial ? initial : 0) + value;
      renderGoal({
        label: config.title,
        current,
        target,
        note: current === undefined ? 'Total do perfil indisponível' :
          automatic && !sample && stats.profileFollowers === undefined ? 'Base manual' : '',
      });
      return;
    }

    empty.textContent = `Aguardando ${config.unit}…`;
    empty.hidden = value.length > 0;
    ranking.hidden = value.length === 0;
    ranking.replaceChildren(...value.map(({ username, count }) => {
      const row = document.createElement('li');
      const author = document.createElement('span');
      const score = document.createElement('strong');
      author.textContent = `@${username}`;
      score.textContent = `${number.format(count)} ${config.unit}`;
      row.append(author, score);
      return row;
    }));
  }

  if (params.get('preview') === 'sample') {
    const sample = config.target
      ? Math.ceil(target * 0.6)
      : [128, 84, 53, 27, 12].map((count, index) => ({
          username: `exemplo_${index + 1}`,
          count,
        }));
    render({ [config.key]: sample }, true);
  } else {
    render({ [config.key]: config.target ? 0 : [] });
    const events = new EventSource(`/overlay/${encodeURIComponent(token)}/events?view=engagement`);
    events.addEventListener('engagement', event => render(JSON.parse(event.data)));
  }
}
