'use strict';

const engagementTypography = [
  ['font', 'Fonte', 'select', 'system-ui', {
    'system-ui': 'Sistema', Arial: 'Arial', 'Trebuchet MS': 'Trebuchet', Georgia: 'Georgia', monospace: 'Monoespaçada',
  }],
  ['fontSize', 'Tamanho da fonte (px)', 'number', 16, 10, 56],
  ['lineGap', 'Espaçamento entre linhas (px)', 'number', 6, 0, 40],
  ['letterSpacing', 'Espaçamento entre letras (px)', 'number', 0, -2, 12],
];
const engagementRankingLimit = ['limit', 'Quantidade de pessoas', 'select', '5', { 3: 'Top 3', 5: 'Top 5', 10: 'Top 10' }];
const engagementWidgetSettings = {
  ranking: {
    'Tipografia e cores': [
      ...engagementTypography,
      ['nameColor', 'Cor do nome', 'color', '#f5f5ff'],
      ['nameEffect', 'Efeito no nome', 'select', 'none', { none: 'Nenhum', glow: 'Brilho', shadow: 'Sombra', uppercase: 'Maiúsculas' }],
      ['scoreColor', 'Cor dos pontos', 'color', '#6ee7f2'],
      ['rankColor', 'Cor das posições', 'color', '#a9b6ce'],
      ['shadow', 'Mostrar sombra de fundo', 'toggle', true],
      ['shadowColor', 'Cor da sombra de fundo', 'color', '#030610'],
      ['outline', 'Ativar borda da fonte', 'toggle', false],
      ['outlineColor', 'Cor da borda', 'color', '#000000'],
    ],
    'Exibição do ranking': [
      engagementRankingLimit,
      ['avatar', 'Mostrar avatar', 'toggle', true],
      ['name', 'Mostrar nome', 'toggle', true],
      ['position', 'Mostrar posição', 'toggle', true],
      ['points', 'Mostrar quantidade', 'toggle', true],
      ['rtl', 'Alinhar da direita para a esquerda', 'toggle', false],
      ['crown', 'Mostrar coroa do Top 1', 'toggle', true],
      ['trophies', 'Mostrar troféus do Top 3', 'toggle', true],
      ['symbol', 'Mostrar símbolo da moeda ou curtida', 'toggle', true],
    ],
  },
  'gift-jar': {
    'Tipografia e posição': [
      ...engagementTypography,
      ['offsetX', 'Deslocamento X (px)', 'number', 0, -500, 500],
      ['offsetY', 'Deslocamento Y (px)', 'number', 0, -500, 500],
      ['scale', 'Escala da jarra', 'number', 1, 0.35, 2, 0.05],
      ['giftScale', 'Escala do presente', 'number', 1, 0.5, 2, 0.1],
    ],
    'Alertas': [
      ['alerts', 'Mostrar alerta', 'toggle', true],
      ['alertSeconds', 'Duração do alerta (s)', 'number', 5, 1, 60],
    ],
    'Ranking e total': [
      ['ranking', 'Mostrar ranking', 'toggle', true],
      engagementRankingLimit,
      ['format', 'Formato de exibição', 'select', 'avatar', {
        avatar: 'Avatar + nome + Coins', coins: 'Nome + Coins', name: 'Apenas nome',
      }],
      ['rankingSeconds', 'Duração do ranking (s, 0 para manter visível)', 'number', 5, 0, 60],
      ['badges', 'Mostrar selos de ranking', 'toggle', true],
      ['total', 'Mostrar total de Coins', 'toggle', true],
    ],
    'Filtro de presentes': [
      ['giftFilter', 'Tipo de presente', 'select', 'all', { all: 'Todos os presentes', selected: 'Presentes selecionados', minimum: 'Valor mínimo' }],
      ['giftIds', 'IDs ou nomes separados por vírgula', 'text', ''],
      ['minCoins', 'Valor mínimo por presente (Coins)', 'number', 1, 1, 1000000],
    ],
  },
};

function engagementFields(widget) {
  return engagementWidgetSettings[widget === 'gift-jar' ? widget : 'ranking'];
}

function readEngagementSettings(widget, params) {
  const options = {};
  for (const [name, , type, fallback, choices, max] of Object.values(engagementFields(widget)).flat()) {
    const raw = params.get(name);
    let value = fallback;
    if (raw !== null) {
      if (type === 'toggle') value = raw === '1';
      if (type === 'select' && Object.hasOwn(choices, raw)) value = raw;
      if (type === 'color' && /^#[0-9a-f]{6}$/i.test(raw)) value = raw;
      if (type === 'number' && raw.trim() && Number.isFinite(Number(raw))) value = Math.min(max, Math.max(choices, Number(raw)));
      if (type === 'text') value = raw.slice(0, 256);
    }
    options[name] = value;
  }
  return options;
}
