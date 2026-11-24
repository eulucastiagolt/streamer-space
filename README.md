# Streamer Space 🚀

> Aplicativo local para Linux que captura eventos públicos do TikTok LIVE (chat, curtidas, presentes) e os exibe em tempo real em overlays transparentes e modulares para o OBS Studio (estilo TikFinity).
> 
> *Local Linux application that captures public TikTok LIVE events (chat, likes, gifts) and displays them in real time on transparent, modular OBS Studio overlays (TikFinity-style).*

---

## Sumário / Table of Contents

- [Visão Geral / Overview](#visão-geral--overview)
- [Funcionalidades / Features](#funcionalidades--features)
- [Arquitetura / Architecture](#arquitetura--architecture)
- [Requisitos e Instalação / Requirements & Installation](#requisitos-e-instalação--requirements--installation)
- [Como Executar / How to Run](#como-executar--how-to-run)
- [Widgets e URLs para OBS (TikFinity Style)](#widgets-e-urls-para-obs-tikfinity-style)
- [Guia do OBS Studio / OBS Studio Setup Guide](#guia-do-obs-studio--obs-studio-setup-guide)
- [Recursos Interativos da Live / Interactive LIVE Features](#recursos-interativos-da-live--interactive-live-features)
- [Modo Simulação / Simulation Mode](#modo-simulação--simulation-mode)
- [Persistência e Recuperação / Persistence & Recovery](#persistência-e-recuperação--persistence--recovery)
- [Conector TikTok LIVE / TikTok LIVE Connector](#conector-tiktok-live--tiktok-live-connector)
- [Testes Automatizados / Automated Testing](#testes-automatizados--automated-testing)
- [Segurança / Security](#segurança--security)

---

## Visão Geral / Overview

**PT-BR:** O **Streamer Space** é uma solução auto-hospedada e leve desenvolvida para rodar diretamente no Linux com [Bun](https://bun.sh). O streamer ou operador informa o `@` de qualquer live pública no painel web local, visualiza o feed de eventos em tempo real, personaliza o estilo de cada widget diretamente no painel e copia URLs individuais para cada elemento no OBS Studio (estilo TikFinity), com escala natural **1:1**.

**EN:** **Streamer Space** is a lightweight, self-hosted Linux application built on [Bun](https://bun.sh). Broadcasters enter any public TikTok LIVE username into a local dashboard, monitor real-time events, customize widget styles inline, and copy dedicated URLs for each element into OBS Studio (TikFinity-style) with standard **1:1 scale**.

---

## Funcionalidades / Features

- 🎯 **Captura de Lives Públicas:** Suporta qualquer streamer online sem necessidade de login, senhas ou cookies de conta.
- 💬 **Feed ao Vivo Unificado:** Chat com avatares (`no-referrer`), dicionário de emojis curtos do TikTok (`[laughcry]`, `[rose]`, `[heart]`, etc.), contadores de curtidas, presentes e espectadores.
- 🧩 **URLs Modulares para OBS (TikFinity-Style):**
  - Cada widget possui sua URL independente: Chat, Curtidas, Espectadores, Alertas de Presentes e Meta de Curtidas.
  - Renderização em **escala 1:1 natural** (`transform: none`), permitindo posicionamento e redimensionamento livre diretamente nas cenas do OBS Studio sem artefatos visuais ou encolhimento.
  - Overlay combinado geral também disponível em `/overlay/<token>`.
- ⚙️ **Configuração Direta no Painel (Inline):**
  - Gavetas de configuração colapsáveis para cada widget com ajuste de tipografia, cores, fundo, opacidade e raio de borda.
  - Controles específicos: limite de mensagens e avatar no chat; duração, regras avançadas e teste de alerta nos presentes; título e meta numérica nas curtidas.
  - Botão **Salvar configurações** atualiza via SSE em tempo real todos os navegadores abertos no OBS.
- 🏆 **Meta de Curtidas (Likes Goal):** Widget com título customizável, barra de progresso dinâmica em tempo real e efeito visual ao atingir a meta.
- 🎁 **Alertas de Presente com Regras Determinísticas:** Filtro por tipo de presente (`giftId`) e quantidade mínima (`minCount`), com tempo de exibição e cores específicas por regra.
- 🛡️ **Resiliência e Contadores Confiáveis:**
  - Suporte a `msgId === "0"` do protobuf TikTok (lotes subsequentes de curtidas nunca são descartados como duplicados).
  - Atualização monotônica do total de curtidas (`Math.max`), impedindo que pacotes fora de ordem retrocedam o contador.
- 🔄 **URL Estável no OBS:** Alternar streamers ou salvar novas configurações de layout atualiza o overlay instantaneamente via SSE mantendo a **mesma URL** no OBS Studio.
- ⚡ **Entrega via Server-Sent Events (SSE):** Conexão unidirecional de baixa latência com reconexão automática e envio de snapshot inicial (ao atualizar o OBS, o estado é restaurado sem disparar alertas de presentes antigos).
- 🧪 **Modo Simulação Completo:** Teste chat, curtidas, presentes avulsos e combos diretamente do painel sem precisar de uma live aberta.

---

## Arquitetura / Architecture

```
Streamer Space
├── src/
│   ├── index.ts                     # Ponto de entrada (Bun.serve, token e inicialização)
│   ├── server/
│   │   ├── config-store.ts          # ConfigStore (persistência atômica, validação e recuperação segura)
│   │   ├── session.ts               # SessionManager (agregação monotônica, combos, descarte de msgId '0', isolamento)
│   │   ├── http.ts                  # Rotas HTTP (/overlay/:token/:widget, /api/config), SSE e segurança
│   │   └── token.ts                 # Gerenciamento e persistência do token do overlay
│   ├── ingestion/
│   │   ├── tiktok-adapter.ts        # Adaptador real baseado em @tokioapp/connector
│   │   └── simulated-source.ts      # Adaptador simulado para testes e demonstrações
│   └── types/
│       ├── config.ts                # Contratos TypeScript de Configuração (OverlayConfig v1.0, LayoutComposition)
│       └── events.ts                # Contratos TypeScript de Eventos (Envelope v1.0, LiveEventSource)
├── public/
│   ├── dashboard.html / css / js    # Painel administrativo com seção modular "Widgets & URLs para OBS"
│   └── overlay.html / css / js      # Overlay transparente modular para OBS (escala 1:1, SSE dinâmico)
└── test/
    ├── session.test.ts              # Testes unitários do SessionManager (agregação, msgId '0', monotonismo)
    ├── server.test.ts               # Testes de integração HTTP, rotas individuais de widgets e SSE
    ├── config.test.ts               # Testes do ConfigStore, schema, persistência atômica e recuperação
    ├── editor-integration.test.ts   # Testes de integração da API de config, regras de presentes e likes goal
    ├── widgets-ui.test.ts           # Testes da seção modular de widgets no painel
    ├── e2e-headless.test.ts         # Testes E2E em Chromium Headless (escala 1:1 e rotas modulares)
    └── adapter.test.ts              # Testes do conector TikTokLiveAdapter
```

---

## Requisitos e Instalação / Requirements & Installation

### Requisitos / Requirements
- **Sistema Operacional:** Linux (x86_64 / arm64)
- **Runtime:** [Bun](https://bun.sh) v1.4.0 ou superior (testado no Bun 1.4.4)
- **Navegador / OBS:** OBS Studio 28+ (com suporte a Fonte de Navegador) ou Chromium

### Instalação / Installation
```bash
# Clone o repositório ou acesse o diretório do projeto
cd "Streamer Space"

# Instale as dependências com Bun
bun install
```

---

## Como Executar / How to Run

Para iniciar o servidor local:
```bash
bun start
# ou
bun run src/index.ts
```

O terminal exibirá:
```
=========================================
🚀 Streamer Space ativo em http://127.0.0.1:3000
📱 Painel de Controle: http://127.0.0.1:3000/
🎥 Overlay para OBS:  http://127.0.0.1:3000/overlay/<token>
=========================================
```

Abra o painel em `http://127.0.0.1:3000/` no seu navegador.

---

## Widgets e URLs para OBS (TikFinity Style)

O painel oferece URLs independentes para cada widget. Isso permite adicionar cada elemento separadamente como uma Fonte de Navegador no OBS Studio, organizando o layout com total liberdade:

| Widget | Rota no OBS | Resolução Sugerida no OBS | Descrição |
|---|---|---|---|
| 💬 **Chat da Live** | `http://127.0.0.1:3000/overlay/<token>/chat` | `480 × 620` | Feed de mensagens com avatares e emojis especiais do TikTok |
| ❤️ **Contador de Curtidas** | `http://127.0.0.1:3000/overlay/<token>/likes` | `360 × 100` | Pílula estilizada com coração animado e contagem em tempo real |
| 👁️ **Espectadores** | `http://127.0.0.1:3000/overlay/<token>/viewers` | `240 × 80` | Contador de espectadores ao vivo |
| 🎁 **Alertas de Presentes** | `http://127.0.0.1:3000/overlay/<token>/gift-alerts` | `800 × 240` | Banners de presentes com multiplicador de combo e regras de cor |
| 🏆 **Meta de Curtidas** | `http://127.0.0.1:3000/overlay/<token>/likes-goal` | `520 × 160` | Barra de progresso dinâmica com título e badge de meta atingida |
| 📱 **Overlay Combinado** | `http://127.0.0.1:3000/overlay/<token>` | `1920 × 1080` ou `1080 × 1920` | Todos os widgets na mesma tela com posicionamento responsivo |

---

## Guia do OBS Studio / OBS Studio Setup Guide

### Instruções em Português (PT-BR)
1. No **OBS Studio**, vá até o painel **Fontes** (*Sources*) da sua cena.
2. Clique no botão **`+`** e selecione **Navegador** (*Browser Source*).
3. Dê um nome à fonte (ex: `TikTok Chat`, `TikTok Curtidas` ou `TikTok Presentes`) e clique em **OK**.
4. Configure as propriedades da fonte:
   - **Arquivo local:** Deixe **desmarcado**.
   - **URL:** Cole a URL dedicada do widget (ex: `http://127.0.0.1:3000/overlay/<token>/chat`).
   - **Largura (*Width*) e Altura (*Height*):** Use as dimensões sugeridas na tabela acima.
   - **Taxa de quadros (*FPS*):** `30` ou `60`.
   - **CSS personalizado:** Pode deixar em branco (o fundo já é 100% transparente).
   - **Desativar quando não estiver visível:** Opcional (recomendado).
   - **Atualizar o navegador quando a cena se tornar ativa:** Opcional.
5. Clique em **OK**. O widget transparente e em escala 1:1 estará ativo na tela!

---

## Recursos Interativos da Live / Interactive LIVE Features

### 1. Meta de Curtidas (Likes Goal)
- Widget integrado com título configurável (ex: *"Meta do Streamer"*).
- Progresso visual calculado dinamicamente: `(totalLikes / targetLikes) * 100%`.
- Ao atingir ou ultrapassar 100%, exibe o badge brilhante **"Meta Atingida! 🎉"** com animação pulsante.
- Mantém coerência com o total acumulado da live e reinicia automaticamente quando um novo streamer é conectado.

### 2. Alertas de Presente com Regras Determinísticas
- Defina regras especiais para presentes com prioridade determinística (primeira regra que corresponder é aplicada):
  1. **Filtro por ID de Presente:** Aplica duração especial ou cor diferenciada para presentes raros (ex: `galaxy` com banner roxo e 7 segundos).
  2. **Filtro por Quantidade Mínima (Min Count):** Aplica destaque para combos grandes (ex: `minCount: 10` com banner dourado).
  3. **Fallback Automático:** Presentes normais que não correspondem a nenhuma regra específica utilizam o tempo padrão configurado (`defaultDurationMs`) e estilos base.
- Combos só disparam o alerta principal **uma vez**, no término confirmado do combo.

---

## Modo Simulação / Simulation Mode

O painel inclui uma seção dedicada denominada **Simulação**, permitindo testar visualmente os componentes antes ou durante a transmissão:
- **💬 Chat simulado:** Envia comentários com emojis nativos do TikTok (`[laughcry]`, etc.).
- **❤️ Lote de curtidas:** Envia um lote de 15 curtidas e testa a animação de pulso cardíaco e corações flutuantes.
- **🎁 Presente avulso:** Dispara um presente imediato (ex: Rosa) com banner de notificação.
- **🔥 Combo streak (1→2→3):** Simula a progressão de um combo de presentes. Apenas o evento final confirmado com quantidade `3` gera o alerta completo e a contabilização no total.

---

## Persistência e Recuperação / Persistence & Recovery

- **Arquivo de Configuração:** Armazenado localmente em `data/overlay-config.json`.
- **Persistência Atômica:** Gravações são feitas primeiro em um arquivo temporário com sufixo aleatório e renomeadas via `renameSync`, evitando que quedas de energia ou interrupções corrompam o arquivo.
- **Recuperação Automática sem Perda de Dados:** Se o arquivo `data/overlay-config.json` for editado manualmente com JSON inválido ou schema corrompido:
  - O sistema emite um aviso detalhado no log.
  - Carrega a configuração padrão segura em memória para não interromper a live.
  - **Não apaga o arquivo corrompido**, permitindo que o operador recupere seus dados.

---

## Conector TikTok LIVE / TikTok LIVE Connector

### Avaliação do Conector
- **Biblioteca Utilizada:** `@tokioapp/connector` (v0.2.2).
- **Compatibilidade com Bun:** Executa nativamente no Bun 1.4+ no Linux, sem necessidade de subprocesso Node.js ou ferramentas pagas externas.
- **Sem Custos Upstream:** Captura eventos por meio do protocolo Webcast público do TikTok sem chave de API paga.
- **Tratamento de Erros:**
  - `OfflineError` / `RoomNotFoundError`: Identifica quando o streamer não está ao vivo e atualiza o badge para `Offline`.
  - `InvalidUsernameError`: Alerta de entrada inválida com feedback em tempo real.
  - `RateLimitError`: Trata limitações temporárias de requisição informando o operador.

---

## Testes Automatizados / Automated Testing

A suíte de testes do projeto garante robustez de ponta a ponta:

```bash
# Executa a checagem de tipos TypeScript
bun run typecheck

# Executa todos os testes automatizados
bun test
```

### Relatório da Suíte de Testes (62 Testes / 100% Passando):
1. **`test/session.test.ts` (14 testes):**
   - Normalização de usernames (com ou sem `@`, validação de caracteres).
   - Agregação de likes por delta (delta 3 soma 3) e suporte ao total informado pela sala.
   - Atualização monotônica do total de curtidas (frames atrasados não retrocedem o total).
   - Agregação de combos de presentes (streak 1→2→3 gera alerta único final com quantidade 3 e cálculo correto de diamantes).
   - Expiração de combos incompletos após timeout.
   - Deduplicação de eventos por `providerEventId` e suporte a `msgId === "0"` (lotes subsequentes de curtidas nunca são descartados).
   - Isolamento de sala na troca de perfis e descarte de callbacks tardios (*stale callbacks*).
   - Entrega de snapshot na reconexão sem re-disparo de alertas antigos.
2. **`test/server.test.ts` (10 testes):**
   - Rotas HTTP (`GET /`, `GET /api/status`, `POST /api/live/connect`, `POST /api/live/disconnect`).
   - Validação de segurança dos cabeçalhos `Host` e `Origin` em endpoints administrativos.
   - Rotas de overlay combinadas e rotas individuais por widget (`/overlay/:token/:widget`) com headers `no-cache, must-revalidate`.
   - Endpoint de eventos simulados (`POST /api/demo/event`).
   - Transmissão SSE com snapshot inicial imediato e streaming de eventos.
3. **`test/config.test.ts` (9 testes):**
   - Validação estrita do schema `OverlayConfig` v1.0.
   - Clamping de posições, dimensões, fontes, opacidades e limites de chat.
   - Inicialização e escrita atômica no `ConfigStore`.
   - Recuperação segura de arquivos JSON corrompidos ou com schema inválido sem exclusão do arquivo.
   - Restauração de configurações de fábrica (`resetConfig`).
4. **`test/editor-integration.test.ts` (12 testes):**
   - Endpoints `GET /api/config`, `POST /api/config` e `POST /api/config/reset`.
   - Proteção de segurança contra Host/Origin maliciosos no salvamento de layout.
   - Estabilidade do token e URL do OBS após edições e redefinições de layout.
   - Transmissão de eventos SSE `config.updated` para todos os clientes conectados.
   - Cálculo e lógica de progresso da Meta de Curtidas (`likes-goal`) e reset por sessão.
   - Motor determinístico de correspondência de regras de presentes (*gift alert rules engine*).
5. **`test/widgets-ui.test.ts` (5 testes):**
   - Estrutura HTML do painel com a seção modular "Widgets e URLs para OBS".
   - Verificação de campos de URL dedicada, botões de copiar, abrir prévia e gavetas de configuração para os 5 widgets.
   - Presença de controles de estilização e específicos por widget (limite de chat, regras de presente, meta de curtidas).
   - Ausência de elementos obsoletos de canvas drag-and-drop.
6. **`test/e2e-headless.test.ts` (5 testes):**
   - Renderização E2E em Chromium Headless do Painel de Controle e da seção modular de widgets.
   - Renderização isolada em escala 1:1 dos widgets dedicados (`/chat`, `/likes-goal`, etc.).
   - Renderização do Overlay Transparente nas resoluções 1920×1080 e 1080×1920.
   - Verificação de tipos MIME corretos para arquivos CSS e JavaScript.
7. **`test/adapter.test.ts` e `test/tiktok-adapter.test.ts` (7 testes):**
   - Conformidade com a interface `LiveEventSource`.
   - Normalização e validação de nomes de usuário no conector do TikTok.
   - Mapeamento e ciclo de vida de eventos reais e desconexão limpa.

---

## Segurança / Security

- **Ligação ao Loopback:** O servidor escuta exclusivamente em `127.0.0.1` por padrão.
- **Token de Overlay Seguro:** Token criptográfico persistido em `data/overlay-token.txt`. Acesso sem o token correto retorna `403 Forbidden`.
- **Sanitização Estrita (XSS):** Todo o conteúdo dinâmico do chat (nomes de usuários, mensagens) é renderizado exclusivamente utilizando `textContent`, impedindo injeção de HTML ou scripts maliciosos.
- **Validação de Cabeçalhos:** Endpoints administrativos verificam estritamente os cabeçalhos `Host` e `Origin` contra requisições fraudulentas (proteção contra DNS Rebinding e Cross-Site Request Forgery).
- **Sem Dados Arbitrários:** O schema de configuração não permite injeção de tags HTML ou blocos arbitrários de código executável.

---

## Licença / License

Distribuído sob licença MIT. Consulte `streamer-space-planejamento-mvp.md` para detalhes sobre o planejamento do projeto.
