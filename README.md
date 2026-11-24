# Streamer Space 🚀

> Aplicativo local para Linux que captura eventos públicos do TikTok LIVE (chat, curtidas, presentes) e os exibe em tempo real em um overlay transparente para o OBS Studio.
> 
> *Local Linux application that captures public TikTok LIVE events (chat, likes, gifts) and displays them in real time on a transparent OBS Studio overlay.*

---

## Sumário / Table of Contents

- [Visão Geral / Overview](#visão-geral--overview)
- [Funcionalidades / Features](#funcionalidades--features)
- [Arquitetura / Architecture](#arquitetura--architecture)
- [Requisitos e Instalação / Requirements & Installation](#requisitos-e-instalação--requirements--installation)
- [Como Executar / How to Run](#como-executar--how-to-run)
- [Guia do OBS Studio / OBS Studio Setup Guide](#guia-do-obs-studio--obs-studio-setup-guide)
- [Modo Simulação / Simulation Mode](#modo-simulação--simulation-mode)
- [Conector TikTok LIVE / TikTok LIVE Connector](#conector-tiktok-live--tiktok-live-connector)
- [Testes Automatizados / Automated Testing](#testes-automatizados--automated-testing)
- [Segurança / Security](#segurança--security)

---

## Visão Geral / Overview

**PT-BR:** O **Streamer Space** é uma solução auto-hospedada e leve desenvolvida para rodar diretamente no Linux com [Bun](https://bun.sh). O streamer ou operador informa o `@` de qualquer live pública no painel web local, visualiza o feed de eventos e copia a URL do overlay para colar diretamente como **Fonte de Navegador** no OBS Studio.

**EN:** **Streamer Space** is a lightweight, self-hosted Linux application built on [Bun](https://bun.sh). Broadcasters enter any public TikTok LIVE username into a local dashboard, monitor real-time events, and copy the overlay URL directly into OBS Studio as a **Browser Source**.

---

## Funcionalidades / Features

- 🎯 **Captura de Lives Públicas:** Suporta qualquer streamer online sem necessidade de login, senhas ou cookies de conta.
- 💬 **Feed ao Vivo Unificado:** Chat, contadores de curtidas, presentes avulsos, combos (streaks) e contagem de espectadores.
- 🎨 **Overlay Transparente para OBS:**
  - Compatível com cenas horizontais (**1920 × 1080**) e verticais (**1080 × 1920**).
  - Alerta de presentes com multiplicador dinâmico (`x3`, `x5`, etc.).
  - Contador de curtidas com animação de pulso cardíaco e corações flutuantes.
  - Chat estilizado com proteção estrita contra XSS via `textContent`.
- 🔄 **URL Estável no OBS:** Alternar entre streamers cancela a conexão anterior, isola o estado da sala e mantém a **mesma URL** no OBS.
- ⚡ **Entrega via Server-Sent Events (SSE):** Conexão unidirecional de baixa latência com reconexão automática e envio de snapshot inicial (ao atualizar o OBS, o estado é restaurado sem disparar alertas de presentes antigos).
- 🧪 **Modo Simulação Completo:** Teste chat, curtidas, presentes avulsos e combos diretamente do painel sem precisar de uma live aberta.

---

## Arquitetura / Architecture

```
Streamer Space
├── src/
│   ├── index.ts                     # Ponto de entrada (Bun.serve, token e inicialização)
│   ├── server/
│   │   ├── session.ts               # SessionManager (agregação, combos, normalização, isolamento)
│   │   ├── http.ts                  # Rotas HTTP, SSE streaming e validação de Host/Origin
│   │   └── token.ts                 # Gerenciamento e persistência do token do overlay
│   ├── ingestion/
│   │   ├── tiktok-adapter.ts        # Adaptador real baseado em @tokioapp/connector
│   │   └── simulated-source.ts      # Adaptador simulado para testes e demonstrações
│   └── types/
│       └── events.ts                # Contratos TypeScript (Envelope v1.0, LiveEventSource)
├── public/
│   ├── dashboard.html / css / js    # Painel administrativo (Português do Brasil)
│   └── overlay.html / css / js      # Overlay transparente para OBS Studio
└── test/
    ├── session.test.ts              # Testes unitários do SessionManager
    ├── server.test.ts               # Testes de integração HTTP e rotas SSE
    ├── e2e-headless.test.ts         # Testes E2E em Chromium Headless (1920x1080 / 1080x1920)
    └── adapter.test.ts              # Testes do conector TikTokLiveAdapter
```

### Contrato de Eventos (Schema v1.0)
Todos os eventos emitidos pela sessão seguem um envelope padronizado:
```typescript
interface BaseEvent<T, D> {
  schemaVersion: '1.0';
  sessionId: string;
  sequence: number;
  receivedAt: string; // ISO 8601
  occurredAt?: string;
  providerEventId?: string;
  type: T;
  data: D;
}
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

## Guia do OBS Studio / OBS Studio Setup Guide

### Instruções em Português (PT-BR)
1. No **OBS Studio**, vá até o painel **Fontes** (Sources) da sua cena.
2. Clique no botão **`+`** e selecione **Navegador** (Browser Source).
3. Dê um nome à fonte (ex: `TikTok Overlay`) e clique em **OK**.
4. Configure as propriedades da fonte:
   - **Arquivo local:** Deixe **desmarcado**.
   - **URL:** Cole a URL gerada pelo painel (ex: `http://127.0.0.1:3000/overlay/<token>`).
   - **Largura (Width):** `1920` (para live horizontal) ou `1080` (para live vertical/mobile).
   - **Altura (Height):** `1080` (horizontal) ou `1920` (vertical).
   - **Taxa de quadros (FPS):** `30` ou `60`.
   - **CSS personalizado:** Pode deixar em branco (o fundo já é 100% transparente).
   - **Desativar quando não estiver visível:** Opcional (recomendado).
   - **Atualizar o navegador quando a cena se tornar ativa:** Opcional.
5. Clique em **OK**. O overlay transparente estará ativo na tela!

### Instructions in English (EN)
1. In **OBS Studio**, go to the **Sources** dock of your scene.
2. Click the **`+`** button and choose **Browser**.
3. Name your source (e.g., `TikTok Overlay`) and click **OK**.
4. Configure the source settings:
   - **Local file:** Keep **unchecked**.
   - **URL:** Paste the overlay URL from the dashboard (`http://127.0.0.1:3000/overlay/<token>`).
   - **Width:** `1920` (horizontal) or `1080` (vertical layout).
   - **Height:** `1080` (horizontal) or `1920` (vertical layout).
   - **FPS:** `30` or `60`.
   - **Custom CSS:** Leave default/empty (background is natively transparent).
5. Click **OK**. The transparent overlay is now live!

---

## Modo Simulação / Simulation Mode

O painel inclui uma seção dedicada denominada **Simulação**, permitindo testar visualmente os componentes antes ou durante a transmissão:
- **💬 Chat simulado:** Envia comentários aleatórios com nomes e avatares fictícios.
- **❤️ Lote de curtidas:** Envia um lote de 15 curtidas e testa a animação de pulso cardíaco e corações.
- **🎁 Presente avulso:** Dispara um presente imediato (ex: Rosa) com banner de notificação.
- **🔥 Combo streak (1→2→3):** Simula a progressão de um combo de presentes. Apenas o evento final confirmado com quantidade `3` gera o alerta completo e a contabilização no total.

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

Os testes cobrem todos os requisitos do MVP utilizando o executor nativo `bun:test`.

### Executando a Suíte de Testes
```bash
bun test
```

### Casos de Teste Cobertos:
1. **Normalização de Entrada:** Aceita usernames com ou sem `@` (`@streamer` e `streamer`), valida caracteres permitidos e rejeita entradas vazias ou inválidas.
2. **Lote de Curtidas:** Incremento de delta 3 atualiza o total acumulado em 3; suporte ao total absoluto de sala quando informado pelo conector.
3. **Combo Streak (1 → 2 → 3):** Dispara atualizações intermediárias de streak e **um único alerta final** de conclusão confirmada com a quantidade 3 e o cálculo correto de diamantes.
4. **Expiração de Combo Não Confirmado:** Combos abandonados sem término expiram via timeout sem inflar presentes confirmados.
5. **Deduplicação por `providerEventId`:** Mensagens, curtidas e presentes repetidos com o mesmo ID são ignorados.
6. **Alternância de Perfis e Isolamento:**
   - Trocar de `@streamer_a` para `@streamer_b` encerra a conexão anterior.
   - Rejeita callbacks tardios (stale callbacks) da live anterior.
   - Zera os contadores e isola o estado da sala para a nova transmissão.
   - **Mantém a URL do OBS estável** sem exigir alteração no OBS Studio.
7. **Snapshot na Conexão/Reconexão:** Ao atualizar a cena ou conectar novo cliente SSE, o snapshot entrega os contadores atuais sem re-disparar popups de presentes passados.
8. **Segurança de Host e Origin:** Bloqueia requisições administrativas vindas de Hosts ou Origins desconhecidos/maliciosos (proteção contra DNS rebinding e CSRF).
9. **Verificação E2E em Chromium Headless:** Renderização completa da interface do Painel e do Overlay nas resoluções 1920×1080 e 1080×1920.

---

## Segurança / Security

- **Ligação ao Loopback:** O servidor escuta exclusivamente em `127.0.0.1` por padrão.
- **Token de Overlay Seguro:** Token criptográfico persistido em `data/overlay-token.txt`. Acesso sem o token correto retorna `403 Forbidden`.
- **Sanitização Estrita (XSS):** Todo o conteúdo dinâmico do chat (nomes de usuários, mensagens) é renderizado exclusivamente utilizando `textContent`, impedindo injeção de HTML ou scripts maliciosos.
- **Validação de Cabeçalhos:** Endpoints administrativos verificam estritamente os cabeçalhos `Host` e `Origin`.

---

## Licença / License

Distribuído sob licença MIT. Consulte `streamer-space-planejamento-mvp.md` para detalhes sobre o planejamento do projeto.
