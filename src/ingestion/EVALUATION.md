# Avaliação Técnica de Conectores TikTok LIVE: `@tokioapp/connector` vs `tiktok-live-connector`

Data: 24 de novembro de 2026  
Ambiente: Linux x86_64, Bun v1.4.4, Node v22.23.5  
Componente: Ingestão de Eventos em Tempo Real (`src/ingestion/`)

---

## 1. Sumário Executivo

A hipótese central do MVP era validar se é possível capturar eventos públicos de TikTok LIVE (chat, curtidas, presentes, espectadores) no Linux executando nativamente em **Bun**, sem custo e sem necessidade de credenciais ou cookies de conta TikTok.

Confirmamos que **`@tokioapp/connector` (v0.2.2)** é a melhor escolha:
- **Compatibilidade nativa comprovada no Bun 1.4.4 / Linux** sem falhas de runtime e sem necessidade de isolar em processo Node.js separado.
- **Licença MIT** permissiva (em contraste com a licença restritiva **AGPL-3.0** do `tiktok-live-connector`).
- **Arquitetura leve e moderna**: apenas 1 dependência de produção (`ws: ^8.22.0`), tipagem TypeScript estrita e suporte a eventos assíncronos.
- **Assinatura EulerStream pública**: conecta gratuitamente sem API key nas cotas anônimas (até 5 conexões/minuto).

---

## 2. Comparativo Detalhado

| Critério | `@tokioapp/connector` (Escolhido) | `tiktok-live-connector` |
| :--- | :--- | :--- |
| **Versão Testada** | 0.2.2 (npm) | 2.5.0 (npm) |
| **Licença** | **MIT** (permissiva) | **AGPL-3.0-only** (copyleft estrito) |
| **Dependências** | 1 (`ws: ^8.22.0`) | 6 (`@bufbuild/protobuf`, `got`, `tiktok-live-api-sdk`, etc.) |
| **Compatibilidade Bun 1.4.4** | **100% Nativo** (testado e verificado) | Requer adaptação devido a dependências de rede antigas (`got`) |
| **Assinador Upstream** | EulerStream (`tiktok.eulerstream.com`) | EulerStream (`tiktok.eulerstream.com`) |
| **Exigência de Credenciais** | Nenhuma para lives públicas | Nenhuma para lives públicas |
| **Custo / Cota Anônima** | Gratuito (cota de ~5 connects/min) | Gratuito (cota anônima) |
| **Tratamento de Offline** | Emite `OfflineError` / `RoomNotFoundError` limpos | Emite rejeição com mensagens variadas |
| **Reconexão com Jitter** | Suporte nativo com backoff exponencial | Suporte nativo |

---

## 3. Evidências da Prova de Conceito (PoC)

1. **Instalação e Runtime Bun**:
   - `bun add @tokioapp/connector` instalado em <1s.
   - Execução direta com Bun sem transpilação prévia: `bun run src/ingestion/poc-live.ts <username>`.
2. **Resolução de Sala e Conexão**:
   - Testado com `@luapertaoplay`:
     ```text
     [STATUS: CONNECTING] Conectando à live de @luapertaoplay...
     [STATUS: CONNECTED] Conectado à live de @luapertaoplay
            -> Room ID identificado: 7711524351425760008
     ```
   - O conector consultou `api-live/user/room/` do TikTok, assinou via EulerStream e estabeleceu o WebSocket com `webcast-ws.tiktok.com`.
3. **Tratamento de Perfis Offline e Erros**:
   - Streamers offline disparam `OfflineError` ou `RoomNotFoundError`, traduzidos pelo `TikTokLiveAdapter` para o status `offline` com mensagem informativa, exibindo o badge "Offline" no painel.
   - Nomes inválidos disparam validação imediata, exibindo o badge "Entrada inválida" sem sobrecarregar a rede.
4. **Isolamento de Processo Node.js**:
   - **Desnecessário**: O conector rodou com estabilidade total no runtime Bun 1.4.4. Não foi preciso criar processo Node isolado.

---

## 4. Arquivos Entregues

1. **`src/ingestion/tiktok-adapter.ts`**:
   - Implementa a interface `LiveEventSource` (`src/types/events.ts`).
   - Mapeia os eventos brutos (`chat`, `like`, `gift`, `roomUser`, `member`, `follow`, `share`) para os contratos `RawChatMessage`, `RawLikeEvent`, `RawGiftEvent`.
   - Trata estados de conexão (`connecting`, `connected`, `reconnecting`, `offline`, `error`).
2. **`src/ingestion/poc-live.ts`**:
   - CLI executável para demonstrar a captação parametrizada por username:
     ```bash
     bun run src/ingestion/poc-live.ts <username>
     ```
3. **`test/tiktok-adapter.test.ts`**:
   - Testes unitários do adaptador cobrindo ciclo de vida, normalização e tratamento de exceções.
