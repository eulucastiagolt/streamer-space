# Antigravity Swarm Prompt — Streamer Space MVP

Build the first working version of **Streamer Space**, a local Linux app that captures public TikTok LIVE events and displays them in OBS. Work in the current workspace and read `streamer-space-planejamento-mvp.md` if present. Deliver runnable code, tests, and a README. Keep the user-facing interface in Brazilian Portuguese. Use English for the implementation instructions in this prompt.

## Primary workflow

Create an initially empty field labeled **Username do streamer no TikTok**, with the generic placeholder `@username`. Accept a TikTok username with or without the leading `@`. Validate and normalize it before connecting. The operator must be able to choose any streamer whose public LIVE is accessible to the connector at test time. Never hardcode `@luapertaoplay` or require that account to be live.

Show the selected username and distinguish invalid input, offline, connecting, connected, reconnecting, and connector errors where the provider allows. Provide **Conectar**, **Desconectar**, **Abrir prévia** and **Copiar URL do OBS**. Support one active LIVE at a time. Switching usernames must cancel the previous connection, reject stale callbacks, and clear the previous room's state while keeping the same OBS URL.

## Product references

Use **Social Stream Ninja** as a primary reference for the local OBS workflow. Review how its control dock helps verify that events are arriving, how its links can be previewed in a browser, and how it exposes dedicated Browser Source URLs. Apply those ideas through a local event feed, a browser preview using the actual overlay URL, and a copy button. A single combined widget is sufficient for this MVP. Structure rendering so independent widgets such as featured chat, gift alerts and a likes counter can be added later. Keep presentation and implementation original. Social Stream Ninja is a reference for workflow, not evidence of how our TikTok connector will work.

Use **TikFinity** and **BattleTalk** as secondary functional references for event-driven alerts. Rely on verifiable behavior and public documentation. Streamer Space must run independently of all three products.

- [Social Stream Ninja OBS Quick Start](https://socialstream.ninja/docs/obs-quick-start)
- [Social Stream Ninja standalone app and source links](https://socialstream.ninja/docs/download.html)
- [OBS Browser Source documentation](https://obsproject.com/kb/browser-source)

## Swarm responsibilities

The coordinator inspects the workspace, preserves existing work and establishes the TypeScript event, session and HTTP contracts. Assign file ownership and run these workstreams in parallel where possible.

1. **Live ingestion** — build the username-parameterized proof of concept, evaluate connector dependencies and implement the real `LiveEventSource` adapter.
2. **Local server and simulation** — implement session lifecycle, normalization, aggregation, HTTP routes, SSE and the simulated adapter.
3. **Dashboard and OBS overlay** — implement the Brazilian Portuguese dashboard, event feed and independent transparent overlay page with preview and copyable URL.

The coordinator integrates the workstreams and runs end-to-end checks. If Swarm delegation is unavailable, perform the same workstreams sequentially.

## Implementation

- Use Bun, TypeScript, `Bun.serve`, `bun:test`, and plain HTML/CSS/JS. Use HTTP for commands and SSE for updates. Configure heartbeats, cancellation and bounded per-client buffers. Dashboard and overlay subscribers share a single upstream capture connection.
- Serve on loopback by default. Implement `GET /`, `GET /api/status`, `GET /api/events`, `POST /api/live/connect`, `POST /api/live/disconnect`, `POST /api/demo/event`, `GET /overlay/:token`, and `GET /overlay/:token/events`. Validate Host and Origin for administrative actions. Use a persistent random read-only overlay token and a URL such as `http://127.0.0.1:3000/overlay/<token>`. Keep secrets and tokens out of logs and credentials on the server.
- Normalize chat, likes, gift updates, completed gifts and connection status into a versioned event envelope with session ID, sequence, timestamp and provider event ID when available. Expose viewer counts, follows and shares when supported. Keep bounded in-memory state and avoid persisting raw payloads.
- Handle like batches as deltas or reported room totals according to provider semantics. Label delta-only totals as likes observed since connection. Alert on single gifts immediately. For a streak, alert and count once on confirmed completion using the final quantity. Expire unconfirmed streaks and deduplicate on reliable IDs when available.
- Reconnect with bounded backoff and jitter, respecting provider limits. Preserve counters only when the same room is confirmed. Serve a snapshot followed by new deltas on SSE connection or reconnection so OBS can refresh without replaying old alerts.
- Render recent chat, likes and gift alerts on a transparent page in 1080 × 1920 and 1920 × 1080 layouts. Render untrusted message content as plain text. Keep controls in the dashboard.
- Provide a clearly labeled **Simulação** mode with chat, a like batch, a single gift and a gift streak. Isolate simulated state from real LIVE data.

## Live capture proof of concept

Evaluate `@tokioapp/connector` first and compare `tiktok-live-connector` as needed. Record the tested library and runtime versions, license, Bun compatibility, upstream services, API keys, quota, and costs. The goal is to connect by username without TikTok account credentials or a paid provider. If the selected library only works on Node, consider a separate Node ingestion process while running the dashboard and overlay on Bun. Do not silently switch to a paid service.

Enter a username for a public LIVE that is available while testing. Passively observe chat, likes and gifts and record evidence for each type. Do not send chat or purchase or send gifts on the operator's behalf. Test switching profiles using two public LIVE sessions when available and use a simulated second session for lifecycle checks otherwise. Report which scenario was actually tested.

## Acceptance and handoff

- Different usernames resolve independently and accept input with or without `@`. Changing the username keeps the copied OBS URL stable and prevents events from the old room from appearing in the new one.
- The actual overlay route opens in a normal browser and in **OBS → Sources → Browser**, with **Local file** disabled. Verify transparency and both scene dimensions. If OBS is unavailable, record browser results and the remaining OBS checks.
- Automated tests cover a like delta of three, a gift streak of 1 → 2 → 3 producing a single final alert for three, event deduplication, stale callbacks after switching profiles and reconnect snapshots without old alerts.
- The README includes installation and start commands, simulation steps, how to enter any eligible streamer username, OBS setup instructions, connector dependencies and observed limits. Report separately what was tested in simulation, in a real LIVE and in OBS.
- Mark live capture complete only after observing real chat, likes and gifts. Document blocked or unobserved cases and keep the simulator usable. Leave battles, rankings, sound alerts, visual editors and multi-tenant hosting for later.
