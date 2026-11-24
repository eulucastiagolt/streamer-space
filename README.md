# Streamer Space 🚀

> Aplicativo local para Linux que captura eventos públicos do TikTok LIVE (chat, curtidas, presentes) e os exibe em tempo real em um overlay transparente e customizável para o OBS Studio com Editor Visual Integrado.
> 
> *Local Linux application that captures public TikTok LIVE events (chat, likes, gifts) and displays them in real time on a transparent, customizable OBS Studio overlay with an integrated Visual Editor.*

---

## Sumário / Table of Contents

- [Visão Geral / Overview](#visão-geral--overview)
- [Funcionalidades / Features](#funcionalidades--features)
- [Arquitetura / Architecture](#arquitetura--architecture)
- [Requisitos e Instalação / Requirements & Installation](#requisitos-e-instalação--requirements--installation)
- [Como Executar / How to Run](#como-executar--how-to-run)
- [Editor Visual de Overlay / Visual Overlay Editor](#editor-visual-de-overlay--visual-overlay-editor)
- [Guia do OBS Studio / OBS Studio Setup Guide](#guia-do-obs-studio--obs-studio-setup-guide)
- [Recursos Interativos da Live / Interactive LIVE Features](#recursos-interativos-da-live--interactive-live-features)
- [Modo Simulação / Simulation Mode](#modo-simulação--simulation-mode)
- [Persistência e Recuperação / Persistence & Recovery](#persistência-e-recuperação--persistence--recovery)
- [Conector TikTok LIVE / TikTok LIVE Connector](#conector-tiktok-live--tiktok-live-connector)
- [Testes Automatizados / Automated Testing](#testes-automatizados--automated-testing)
- [Segurança / Security](#segurança--security)

---

## Visão Geral / Overview

**PT-BR:** O **Streamer Space** é uma solução auto-hospedada e leve desenvolvida para rodar diretamente no Linux com [Bun](https://bun.sh). O streamer ou operador informa o `@` de qualquer live pública no painel web local, visualiza o feed de eventos em tempo real, personaliza o posicionamento e estilo de cada widget visualmente pelo **Editor de Overlay**, e copia a URL do overlay para colar diretamente como **Fonte de Navegador** no OBS Studio.

**EN:** **Streamer Space** is a lightweight, self-hosted Linux application built on [Bun](https://bun.sh). Broadcasters enter any public TikTok LIVE username into a local dashboard, monitor real-time events, customize widget positioning and styles visually using the **Visual Overlay Editor**, and copy the overlay URL directly into OBS Studio as a **Browser Source**.

---

## Funcionalidades / Features

- 🎯 **Captura de Lives Públicas:** Suporta qualquer streamer online sem necessidade de login, senhas ou cookies de conta.
- 💬 **Feed ao Vivo Unificado:** Chat, contadores de curtidas, presentes avulsos, combos (streaks) e contagem de espectadores.
- 🎨 **Editor Visual de Overlay (Fase 2):**
  - Espaço de trabalho interativo no painel local com arrastar e soltar (*drag & drop*), redimensionamento (*resize* com 8 alças) e movimentação por teclado.
  - Suporte independente a resoluções **Horizontal (1920 × 1080)** e **Vertical (1080 × 1920)**.
  - Zoom dinâmico da tela de edição (50%, 75%, 100% e Ajustar à tela / *Fit to Viewport*).
  - Inspetor de propriedades: posição, dimensões, z-index, tipografia, cores, opacidade e cantos arredondados.
  - Gerenciamento de rascunhos (*drafts*), indicador de status em tempo real e aviso de alterações não salvas.
- 🏆 **Meta de Curtidas (Likes Goal):** Widget com título customizável, barra de progresso dinâmica em tempo real e efeito visual ao atingir a meta.
- 🎁 **Alertas de Presente com Regras Customizadas:** Filtro por tipo de presente (`giftId`) e quantidade mínima (`minCount`), com tempo de exibição e cores específicas por regra.
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
│   │   ├── session.ts               # SessionManager (agregação, combos, normalização, isolamento)
│   │   ├── http.ts                  # Rotas HTTP (admin /api/config), SSE streaming e validação de Host/Origin
│   │   └── token.ts                 # Gerenciamento e persistência do token do overlay
│   ├── ingestion/
│   │   ├── tiktok-adapter.ts        # Adaptador real baseado em @tokioapp/connector
│   │   └── simulated-source.ts      # Adaptador simulado para testes e demonstrações
│   └── types/
│       ├── config.ts                # Contratos TypeScript de Configuração (OverlayConfig v1.0, LayoutComposition)
│       └── events.ts                # Contratos TypeScript de Eventos (Envelope v1.0, LiveEventSource)
├── public/
│   ├── dashboard.html / css / js    # Painel administrativo com navegação por abas (Painel da Live / Editor)
│   ├── editor.css / js              # Editor visual (canvas interativo, camadas e inspetor de propriedades)
│   └── overlay.html / css / js      # Overlay transparente para OBS Studio (responsivo com SSE dinâmico)
└── test/
    ├── session.test.ts              # Testes unitários do SessionManager
    ├── server.test.ts               # Testes de integração HTTP e rotas SSE
    ├── config.test.ts               # Testes do ConfigStore, schema, persistência atômica e recuperação
    ├── editor-integration.test.ts   # Testes de integração da API de config, regras de presentes e likes goal
    ├── editor-ui.test.ts            # Testes do layout do editor, controles e matemática de canvas
    ├── e2e-headless.test.ts         # Testes E2E em Chromium Headless (1920x1080 / 1080x1920)
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

## Editor Visual de Overlay / Visual Overlay Editor

O painel agora conta com a aba **Editor de overlay**, permitindo controle total do layout visual sem alterar código.

### Funcionalidades do Editor:
1. **Composições Independentes:**
   - **Horizontal (1920 × 1080):** Layout ideal para transmissões padrão e monitores widescreen.
   - **Vertical (1080 × 1920):** Layout otimizado para transmissões no formato TikTok / reels / shorts.
2. **Controle de Zoom do Canvas:**
   - Botões predefinidos para 50%, 75% e 100%.
   - **Ajustar à tela (*Fit to Viewport*):** Calcula automaticamente a melhor proporção de escala para caber na sua tela mantendo a proporção correta.
   - **Matemática no Espaço Lógico:** Toda movimentação considera a escala atual (`delta / zoomScale`), garantindo precisão milimétrica em qualquer nível de zoom.
3. **Painel de Camadas (Layers):**
   - Lista todos os 5 widgets: `chat`, `likes`, `viewers`, `gift-alerts` e `likes-goal`.
   - Botão para alternar visibilidade (olho).
   - Botões para subir/descer na ordem de camadas (`zIndex`).
4. **Canvas Interativo:**
   - Fundo xadrez indicando transparência.
   - Arraste livre com o mouse e redimensionamento por 8 alças.
   - **Clamping de Limites:** Impede que os widgets ultrapassem as bordas lógicas do canvas (`0 <= x + width <= canvasWidth`).
   - **Ajuste Fino por Teclado:** Teclas de seta movem o widget selecionado de 1 em 1 pixel (com `Shift` pressionado: passos de 10 pixels).
5. **Inspetor de Propriedades:**
   - **Posição e Dimensões:** Entradas numéricas para X, Y, Largura, Altura e Z-Index.
   - **Tipografia e Cores:** Tamanho de fonte (10 a 72px), seletor de cor do texto, cor de fundo (com transparência/alfa), opacidade geral e raio dos cantos (border-radius).
   - **Configurações Específicas:**
     - *Chat:* Limite de mensagens recentes no histórico e alternador para exibir ou ocultar fotos de perfil (*avatars*).
     - *Alertas de Presentes:* Duração padrão e editor visual completo de regras de presentes com botão **Testar alerta**.
     - *Meta de Curtidas:* Título customizável e meta numérica de curtidas.
6. **Gerenciamento de Rascunho e Publicação:**
   - O rascunho em edição não interfere na transmissão no ar até que seja salvo.
   - **Salvar e aplicar:** Valida no servidor, persiste em disco atomicamente e publica para os clientes OBS via SSE.
   - **Descartar alterações:** Recarrega o último layout salvo descartando rascunhos.
   - **Restaurar padrões:** Restaura as posições e estilos originais de fábrica.
   - **Testar no preview:** Abre a visualização em tempo real no navegador.

---

## Guia do OBS Studio / OBS Studio Setup Guide

### Instruções em Português (PT-BR)
1. No **OBS Studio**, vá até o painel **Fontes** (*Sources*) da sua cena.
2. Clique no botão **`+`** e selecione **Navegador** (*Browser Source*).
3. Dê um nome à fonte (ex: `TikTok Overlay`) e clique em **OK**.
4. Configure as propriedades da fonte:
   - **Arquivo local:** Deixe **desmarcado**.
   - **URL:** Cole a URL gerada pelo painel (ex: `http://127.0.0.1:3000/overlay/<token>`).
   - **Largura (*Width*):** `1920` (para live horizontal) ou `1080` (para live vertical).
   - **Altura (*Height*):** `1080` (horizontal) ou `1920` (vertical).
   - **Taxa de quadros (*FPS*):** `30` ou `60`.
   - **CSS personalizado:** Pode deixar em branco (o fundo já é 100% transparente).
   - **Desativar quando não estiver visível:** Opcional (recomendado).
   - **Atualizar o navegador quando a cena se tornar ativa:** Opcional.
5. Clique em **OK**. O overlay transparente estará ativo na tela!

### Regra de Detecção de Orientação / Orientation Selection Rule
O overlay identifica dinamicamente se a janela do OBS é horizontal ou vertical:
- Se `window.innerHeight > window.innerWidth`, aplica o layout **Vertical (1080 × 1920)**.
- Caso contrário, aplica o layout **Horizontal (1920 × 1080)**.
- Essa regra garante funcionamento correto para qualquer proporção configurada no OBS.

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
- **💬 Chat simulado:** Envia comentários aleatórios com nomes e avatares fictícios.
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

### Relatório da Suíte de Testes (60 Testes / 100% Passando):
1. **`test/session.test.ts` (12 testes):**
   - Normalização de usernames (com ou sem `@`, validação de caracteres).
   - Agregação de likes por delta (delta 3 soma 3) e suporte ao total informado pela sala.
   - Agregação de combos de presentes (streak 1→2→3 gera alerta único final com quantidade 3 e cálculo correto de diamantes).
   - Expiração de combos incompletos após timeout.
   - Deduplicação de eventos por `providerEventId` (chat, likes e presentes).
   - Isolamento de sala na troca de perfis e descarte de callbacks tardios (*stale callbacks*).
   - Entrega de snapshot na reconexão sem re-disparo de alertas antigos.
2. **`test/server.test.ts` (9 testes):**
   - Rotas HTTP (`GET /`, `GET /api/status`, `POST /api/live/connect`, `POST /api/live/disconnect`).
   - Validação de segurança dos cabeçalhos `Host` e `Origin` em endpoints administrativos.
   - Rotas de overlay com autorização por token (`GET /overlay/:token`).
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
5. **`test/editor-ui.test.ts` (7 testes):**
   - Estrutura HTML do editor (abas de navegação, painéis de camadas, canvas e inspetor).
   - Estilos CSS para estados do editor (Salvo, Modificado, Salvando, Erro).
   - Verificação da matemática de coordenadas do ponteiro no espaço lógico do canvas (`delta / zoomScale`).
   - Clamping de bordas do canvas para impedir posicionamentos fora da tela.
6. **`test/e2e-headless.test.ts` (4 testes):**
   - Renderização E2E em Chromium Headless do Painel de Controle.
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
