# Streamer Space — plano do MVP para TikTok LIVE e OBS

24 de novembro de 2026

## Objetivo

Executar no Linux um aplicativo local e auto-hospedado. Lucas informa o @ de uma live pública, acompanha chat, likes e presentes no painel e copia a URL de um overlay para o OBS. Validar com o username de uma live pública disponível no momento, incluindo de outro streamer quando o @luapertaoplay estiver offline. A interface, a normalização dos eventos e o overlay serão próprios. A capacidade de captar eventos sem pagar por um serviço externo é uma hipótese que a prova de conceito precisa confirmar.

## Investigação das referências

| Alvo | Evidência e limite | Aplicação ao Streamer Space |
| --- | --- | --- |
| TikFinity — documentação | A configuração pública oferece ações por evento e uma URL por tela. | Fluxo simples de conectar, testar e copiar URL. Uma tela no MVP. |
| TikFinity — REA | Análise estática do AppImage instalado, versão 1.7.0. O pacote Electron inclui `@eulerstream/events-sdk-electron`, `tiktok-live-proto` e `ws`. O recorte estático dos arquivos `main.js`, `appurls.js` e `dapi.js` mostrou uso de janela Electron e carregamento de URL no módulo principal, além de um servidor WebSocket em `dapi.js`. Isso não comprova por onde cada evento da live chega, nem se o WebSocket é usado pelo overlay. | Separar captação, distribuição de eventos e apresentação. O MVP pode servir painel e overlay diretamente pelo Bun. |
| TikFinity — Ghidra | O Ghidra 12.2 analisou em modo headless o ELF lançador do AppImage. O resultado confirma o escopo da camada nativa analisada. A lógica JavaScript está no `app.asar`, analisado pelo REA. O provedor Ghidra do REA requer 12.1.x, por isso as ferramentas foram usadas em separado. | Nenhuma dependência do lançador no MVP. |
| Social Stream Ninja | A documentação oficial mostra um painel para conferir a chegada das mensagens e links copiáveis para fontes de navegador, incluindo chat contínuo e mensagem destacada. | Usar como referência funcional para o painel local, a prévia no navegador e a URL do OBS. Manter o overlay combinado do MVP e usar widgets independentes como referência para a evolução. |
| BattleTalk | Nenhum executável local ou endereço oficial com identidade confirmada foi encontrado. A análise estática ficou pendente. | Quando houver artefato ou link, verificar como se conecta uma live, se testa um evento e se exporta uma URL. |
| TikTok for Developers | O catálogo público consultado não apresentou API geral para receber chat, likes e presentes por @. | Validar o acesso real com conector comunitário substituível. A documentação pública não garante disponibilidade contínua. |

## Produto

- Painel local em português com campo para @, conectar, desconectar, estado da live, feed recente e botão **Copiar URL do OBS**. Aceitar o identificador com ou sem @. Mostrar razões distintas quando o perfil está offline, a entrada é inválida ou a captação falha.
- Uma live pública por vez, com **chat, likes e presentes** obrigatórios na prova real. Expor também espectadores, entradas, follows e compartilhamentos no painel quando o conector os entregar. Contar tipos extras conhecidos ou desconhecidos para orientar evolução, sem armazenar payload bruto por padrão.
- Um overlay transparente com chat recente, contador e alerta visual de presentes. Layout original para 1080 × 1920 e 1920 × 1080. URL estável ao alternar salas ou reiniciar o aplicativo.
- Modo simulado com botões para gerar chat, likes e presentes, inclusive combo. Identificar a simulação no painel e manter dados de teste separados da sessão real.
- Batalhas, editor de temas, rankings, áudio, histórico persistente, usuários e hospedagem entram em fases posteriores.

## Arquitetura

**Bun + TypeScript**, `Bun.serve`, `bun:test` e HTML/CSS/JS simples. Usar HTTP para comandos e SSE (`EventSource`) para entregar dados a painel e OBS. SSE atende ao fluxo unidirecional e permite reconexão pelo navegador. Configurar heartbeat, timeout da rota SSE, cancelamento e filas limitadas por cliente. Uma conexão ao provedor atende todos os consumidores locais.

| Componente | Responsabilidade |
| --- | --- |
| `LiveEventSource` | Interface para conectar por handle, emitir eventos/status e encerrar. Adaptadores real e simulado. |
| Sessão e normalização | Converter eventos, deduplicar IDs disponíveis, agregar contadores, guardar snapshot e publicar deltas. |
| Painel | Comandar a sessão, inspecionar estado e copiar URL. |
| Overlay | Consumir snapshot e deltas. Renderizar textos com `textContent`, limitar o feed e enfileirar alertas com limite. |

Rotas propostas: `GET /`, `GET /api/status`, `GET /api/events`, `POST /api/live/connect`, `POST /api/live/disconnect`, `POST /api/demo/event`, `GET /overlay/:token`, `GET /overlay/:token/events`. Usar `http://127.0.0.1:3000/overlay/<token>` na mesma máquina. Vincular o servidor ao loopback por padrão, validar Host e Origin em comandos administrativos e usar token aleatório persistente com acesso de leitura ao overlay. Manter chaves apenas no servidor e fora de logs. Persistir configurações em arquivo local e guardar eventos em memória com limites de tamanho.

### Contrato e comportamento

Envelope versionado: `schemaVersion`, `sessionId`, `sequence`, `providerEventId?`, `receivedAt`, `occurredAt?`, `type`, `data`. Tipos iniciais: `chat.message`, `engagement.like`, `gift.update`, `gift.completed`, `live.status`. Campos extras ficam opcionais.

- **Likes:** aplicar o total de sala se fornecido com semântica conhecida. Se houver só delta, rotular como likes observados desde a conexão. Um evento pode representar vários likes.
- **Presentes:** alertar imediatamente no presente avulso. Para combo, alertar e contabilizar uma vez no fechamento confirmado, com a quantidade final. Expirar combos incompletos sem somá-los ao total confirmado. Usar ID confiável para deduplicação quando disponível.
- **Sessão:** cancelar tentativas obsoletas ao alternar o @. Reconectar com backoff e jitter e respeitar o limite do serviço. Preservar contadores quando a reconexão confirmar a mesma sala. Reiniciar estado quando o identificador de sala mudar. Informar possíveis lacunas de eventos após quedas.
- **OBS:** inicializar com snapshot e seguir com deltas posteriores. Ao reabrir a cena, recuperar o estado atual sem repetir alertas antigos.

## Prova de captação e escolha do conector

1. Avaliar [@tokioapp/connector](https://github.com/tokio-app/connector). A biblioteca publica tipos para chat, likes e presentes e declara Node 24+. Confirmar licença da versão escolhida, compatibilidade com Bun e todos os serviços externos usados antes de fixar a dependência. Node compatível por si só não valida Bun.
2. Comparar com [tiktok-live-connector](https://github.com/zerodytrash/TikTok-Live-Connector/blob/ts-rewrite/docs/src/content/docs/configuration/signing.md). A configuração padrão documentada depende da Euler Stream para assinatura. Medir os limites e registrar se exige credencial ou plano antes de decidir. Não habilitar fallback pago automaticamente.
3. Testar pelo @ numa live pública controlada: chat, lote de likes, presente avulso, combo, perfil offline, queda e encerramento. Registrar versão do runtime, pacote, dependências externas, custos aplicáveis e evidência por teste. Não pedir senha ou cookies do TikTok no MVP.
4. Se o conector funcionar só em Node, considerar um processo Node isolado para ingestão, com painel e overlay ainda no Bun. Se o acesso real estiver bloqueado, manter o simulador acessível e registrar a captação real como pendência.

## Entregas para orientar o Swarm

1. Fixar o contrato de eventos e abrir a prova de captação cedo. O contrato permite desenvolver o painel e o overlay com eventos simulados enquanto o conector é validado.
2. Entregar o fluxo local completo em simulação, incluindo configuração da Fonte de navegador do OBS no Linux.
3. Integrar o adaptador real, testar reconexão, sessões e contadores e validar com a live controlada.
4. Documentar instalação, comandos, variáveis necessárias, instruções no OBS e resultados dos testes reais. Este plano servirá de entrada para o prompt de implementação na próxima etapa.

## Critérios de aceite

- Iniciar o serviço com Bun. O painel local aceita @, mostra o estado da sessão e fornece uma URL copiável.
- Em **OBS → Fontes → Navegador**, colar a URL com **Arquivo local** desativado e ver o overlay transparente receber eventos em tempo real. Conferir os dois formatos de cena.
- Um lote com delta 3 soma três. Um combo 1 → 2 → 3 gera um único alerta final de quantidade três. Um evento duplicado com ID igual não infla totais.
- Atualizar a Fonte de navegador recupera o snapshot sem alertas antigos. Trocar o @ não mistura salas. Encerrar a captura impede eventos tardios de atingirem uma nova sessão.
- O MVP de captação está pronto quando chat, likes e presentes forem demonstrados em live real e as dependências de captação estiverem documentadas. A demonstração em simulação valida a interface e o OBS.

## Hospedagem futura

O OBS na mesma máquina usa loopback. A versão hospedada exigirá HTTPS, autenticação no painel, isolamento por criador, tokens revogáveis por overlay, limites por conta, política de retenção e verificação das condições aplicáveis à integração. Para manter conexões longas de captação e SSE, avaliar primeiro VPS ou container com processo persistente. Adicionar armazenamento compartilhado quando o produto precisar de histórico ou de múltiplas instâncias.

## Fontes

- [Social Stream Ninja — OBS Quick Start](https://socialstream.ninja/docs/obs-quick-start)
- [Social Stream Ninja — aplicativo local e código-fonte](https://socialstream.ninja/docs/download.html)
- [TikFinity — configuração de alertas e overlays](https://blog.tikfinity.com/pt/tikfinity-setup/)
- [OBS Studio — Fonte de navegador](https://obsproject.com/kb/browser-source)
- [Bun — Server-Sent Events](https://bun.com/guides/http/sse)
- [TikTok for Developers — catálogo público](https://developers.tiktok.com/)
