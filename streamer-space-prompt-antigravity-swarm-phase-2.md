# Antigravity Swarm Prompt — Streamer Space Phase 2

Implement a visual overlay editor and a small set of configurable LIVE interactions in the existing Streamer Space repository. Keep Bun and TypeScript, local Linux operation and Brazilian Portuguese UI. Make real changes, run tests and update the README. Preserve the user's working tree.

## Baseline to verify before edits

- The MVP is present at commit `bcfbbc5`. It includes a username-driven dashboard for public TikTok LIVE, simulation, an event feed, a stable tokenized OBS URL, and an SSE overlay showing chat, likes, gifts and viewer count when available.
- Reuse `src/types/events.ts`, `src/server/session.ts`, `src/server/http.ts`, the current ingestion adapters and `public/overlay.*`. The current overlay has fixed placement and no saved, editable layout. The working tree inspected during planning had uncommitted avatar and referrer-policy edits in the dashboard and overlay files. Inspect and preserve those edits if still present.
- The connector evaluation reports a successful real connection on Bun with `@tokioapp/connector` and documents its Euler Stream signing dependency. It does not provide separate evidence for observing each real event type. Retain this connector and the ability to enter any accessible public LIVE username. Do not hardcode a test account or modify ingestion solely for the editor.
- A restricted review ran `bun test`: 19 passed, and the HTTP/SSE/browser suite setup was blocked by `EPERM: listen`, with secondary teardown errors. Run the complete baseline in an environment with local sockets. The project has no existing `typecheck` script. Browser DOM checks alone do not verify OBS behavior.

## References and scope

Use TikFinity's Actions & Events, gift alerts and goals as functional references. Use Social Stream Ninja's overlay gallery, browser preview and OBS link workflow as references for the editor experience. BattleTalk is a product reference mentioned by the owner. Verify its identity and behavior if an official URL or local artifact becomes available. Keep battle-specific functionality out of this phase. Create original visuals and implementation.

- [TikFinity product and interaction examples](https://tikfinity.com/)
- [Social Stream Ninja overlay gallery](https://socialstream.ninja/docs/overlay-gallery)
- [Social Stream Ninja overlay customization](https://socialstream.ninja/docs/overlay-customization-guide)

## Deliverable 1 — Visual overlay editor

Add **Editor de overlay** to the local dashboard. Use a workspace with widget/layer list, canvas and property inspector. Give it clear selected, dirty, saving, saved and error states. Keep the on-air overlay transparent and free of editor controls.

- Support independent **1920 × 1080** and **1080 × 1920** compositions. Choose the matching saved layout for the OBS viewport through the existing URL. Define and document the selection rule for other aspect ratios. Initialize both layouts from the current presentation.
- Let the operator select, drag, resize, show or hide, and reorder existing chat, likes, viewer count and gift-alert widgets. Treat likes and viewers as independent selectable elements. Provide numeric position and dimensions, keyboard movement, bounds clamping and reset to defaults with confirmation. Calculate pointer coordinates in logical canvas space so dragging works at any preview zoom.
- Provide typed controls for font size, text color, widget background/opacity and corner radius where applicable. Add chat message limit and avatar visibility, plus gift-alert duration. Use a shared registry and render styles consistently across preview and OBS. Supply useful defaults and prevent widgets from extending beyond the logical canvas.
- Preview draft changes immediately with sample chat, likes and a gift. Keep preview-only events isolated from live and published OBS state. The existing live preview/link action must still open the actual published overlay.
- Keep drafts separate from the published configuration. **Salvar e aplicar** persists and publishes a valid layout. **Descartar alterações** reloads the saved layout. Warn before leaving with unsaved changes. A failed save keeps the draft and the last published layout intact.

## Deliverable 2 — Persistence and OBS integration

- Create a versioned configuration for both orientations, validated on the server. Keep local persistence simple and atomic. Preserve default rendering on fresh installs or absent config. If the stored file is invalid, report the issue and recover safely without silently destroying existing data.
- Expose read/write configuration through the existing local admin boundary. Reuse loopback and Host/Origin validation. Validate widget IDs, finite bounds, style values and any alert rules. Keep the OBS token read-only and keep arbitrary HTML/CSS out of user configuration.
- Publish saved configuration to existing OBS clients over SSE without changing the OBS URL, restarting ingestion, or replaying gift alerts. Restore the latest saved configuration on reconnect and process restart. Preserve current chat/gift deduplication, live isolation, snapshot semantics and simulator behavior.
- The OBS URL stays stable across streamer changes, editor saves and process restarts. No migration step should require replacing the existing Browser Source URL.

## Deliverable 3 — Initial event-driven features

Complete the editor and publication flow first, then add these two scoped features using the existing normalized events.

1. **Meta de curtidas** — optional movable widget with a configurable title and target, a progress display and a reached state. Reuse the room total or observed likes semantics already exposed by the session, and label the basis when needed. Reset on a new room and restore the current value after overlay reconnect.
2. **Alertas de presente** — let the operator configure the default appearance and an optional rule for a finalized gift, filtered by gift ID or minimum quantity. Make precedence explicit and deterministic. A streak triggers once on completion. Provide **Testar alerta** with synthetic data in draft preview only.

Keep battle scoring, TTS, audio uploads, automatic OBS scene switching, games and multi-user hosting for later. If a secondary feature is blocked, finish and verify the editor and report the blocker and remaining work.

## Swarm execution

The coordinator reads repo guidance, inspects the current git diff and defines configuration types, widget IDs, publication semantics and file ownership first. Delegate these workstreams in parallel after agreeing on the contract.

1. **Editor UX** — canvas, pointer and keyboard interactions, inspector, layers and draft state.
2. **Configuration and SSE** — validation, atomic storage, admin routes and published updates.
3. **Runtime overlay and widgets** — apply config to the current renderer, retain existing behavior, and implement the goal and filtered alert using normalized events.

Coordinate shared files through one owner. Integrate in small steps and run the full regression suite. If delegation is unavailable, perform the same workstreams sequentially.

## Acceptance and handoff

- Without a saved config, the original dashboard and OBS overlay remain usable. An arbitrary valid username can still be entered, and simulation remains available offline.
- Move and resize a widget at two preview scales, enter numeric values, toggle visibility, reorder layers and save. Reload the editor, restart the server and verify persistence. Check both orientations independently. Invalid or failed saves leave the previous published layout intact.
- Open the same tokenized OBS URL before and after editing. Verify it updates only after save, does not replay gifts during config changes, and receives the saved layout after reconnect. Verify preview data never appears on the on-air overlay.
- Test the likes goal, a matching/nonmatching finalized gift and a combo sequence. Run existing regressions for switching streamers, deduplication and snapshots. Add targeted tests for config validation and persistence, coordinate conversion, publication, and new event rules.
- Verify actual OBS and real LIVE behavior if available. Clearly report which checks ran in automated tests, browser, OBS and public LIVE. Include setup and editor instructions, configuration location and recovery behavior in the README.
