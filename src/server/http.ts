import { join } from 'node:path';
import type { Server } from 'bun';
import type { SessionManager } from './session.js';

export function isAllowedHost(hostHeader: string | null): boolean {
  if (!hostHeader) return false;
  const hostname = hostHeader.split(':')[0].toLowerCase();
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '[::1]' ||
    hostname === '0.0.0.0'
  );
}

export function isAllowedOrigin(originHeader: string | null): boolean {
  if (!originHeader) return true; // Direct curl, bun:test, local scripts
  try {
    const url = new URL(originHeader);
    const hostname = url.hostname.toLowerCase();
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname === '0.0.0.0'
    );
  } catch {
    return false;
  }
}

export function validateAdminRequest(req: Request): Response | null {
  const host = req.headers.get('host');
  if (!isAllowedHost(host)) {
    return Response.json(
      { ok: false, error: 'Acesso não autorizado: Host inválido' },
      { status: 403 }
    );
  }

  const origin = req.headers.get('origin');
  if (!isAllowedOrigin(origin)) {
    return Response.json(
      { ok: false, error: 'Acesso não autorizado: Origin inválido' },
      { status: 403 }
    );
  }

  return null;
}

export function createSSEStream(sessionManager: SessionManager, signal: AbortSignal): Response {
  let isClosed = false;
  let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  let unsubscribe: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      const send = (data: string) => {
        if (isClosed) return;
        try {
          controller.enqueue(encoder.encode(data));
        } catch {
          cleanup();
        }
      };

      const cleanup = () => {
        if (isClosed) return;
        isClosed = true;
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
          heartbeatInterval = null;
        }
        if (unsubscribe) {
          unsubscribe();
          unsubscribe = null;
        }
        try {
          controller.close();
        } catch {}
      };

      signal.addEventListener('abort', cleanup);

      // Send current snapshot immediately on connect / reconnect
      const snapshot = sessionManager.getSnapshot();
      send(`event: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`);

      // Stream incremental events
      unsubscribe = sessionManager.addListener((event) => {
        if (isClosed) return;
        send(`event: ${event.type}\nid: ${event.sequence}\ndata: ${JSON.stringify(event)}\n\n`);
      });

      // Heartbeat comment every 15 seconds
      heartbeatInterval = setInterval(() => {
        if (isClosed) {
          cleanup();
          return;
        }
        send(`: heartbeat ${Date.now()}\n\n`);
      }, 15000);
    },
    cancel() {
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      if (unsubscribe) unsubscribe();
      isClosed = true;
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

export interface HttpServerOptions {
  port?: number;
  hostname?: string;
  sessionManager: SessionManager;
  publicDir?: string;
}

export function createHttpServer(options: HttpServerOptions): Server<any> {
  const port = options.port !== undefined ? options.port : 3000;
  const hostname = options.hostname || '127.0.0.1';
  const sessionManager = options.sessionManager;
  const publicDir = options.publicDir || join(process.cwd(), 'public');

  return Bun.serve({
    port,
    hostname,
    async fetch(req) {
      const url = new URL(req.url);
      const { pathname } = url;
      const method = req.method.toUpperCase();

      // CORS Preflight
      if (method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          },
        });
      }

      // GET / -> Serve Dashboard UI
      if (method === 'GET' && (pathname === '/' || pathname === '/index.html')) {
        const file = Bun.file(join(publicDir, 'dashboard.html'));
        if (await file.exists()) {
          return new Response(file, {
            headers: {
              'Content-Type': 'text/html; charset=utf-8',
              'Cache-Control': 'no-cache, must-revalidate',
            },
          });
        }
        return new Response('Streamer Space Dashboard', { status: 200 });
      }

      // GET /api/status -> Return current snapshot
      if (method === 'GET' && pathname === '/api/status') {
        return Response.json(sessionManager.getSnapshot(), {
          headers: {
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      // GET /api/events -> SSE event stream for dashboard
      if (method === 'GET' && pathname === '/api/events') {
        return createSSEStream(sessionManager, req.signal);
      }

      // POST /api/live/connect -> Connect to streamer
      if (method === 'POST' && pathname === '/api/live/connect') {
        const adminCheck = validateAdminRequest(req);
        if (adminCheck) return adminCheck;

        try {
          const body = (await req.json()) as { username?: string; isSimulated?: boolean };
          if (!body || !body.username) {
            return Response.json(
              { ok: false, error: 'O campo "username" é obrigatório' },
              { status: 400 }
            );
          }
          await sessionManager.connect(body.username, { isSimulated: body.isSimulated });
          return Response.json({
            ok: true,
            snapshot: sessionManager.getSnapshot(),
          });
        } catch (err: any) {
          return Response.json(
            { ok: false, error: err?.message || 'Erro ao conectar à live' },
            { status: 400 }
          );
        }
      }

      // POST /api/live/disconnect -> Disconnect
      if (method === 'POST' && pathname === '/api/live/disconnect') {
        const adminCheck = validateAdminRequest(req);
        if (adminCheck) return adminCheck;

        try {
          await sessionManager.disconnect();
          return Response.json({
            ok: true,
            snapshot: sessionManager.getSnapshot(),
          });
        } catch (err: any) {
          return Response.json(
            { ok: false, error: err?.message || 'Erro ao desconectar' },
            { status: 500 }
          );
        }
      }

      // POST /api/demo/event -> Trigger simulated event
      if (method === 'POST' && pathname === '/api/demo/event') {
        const adminCheck = validateAdminRequest(req);
        if (adminCheck) return adminCheck;

        try {
          const body = (await req.json()) as any;
          if (!body || !body.type) {
            return Response.json(
              { ok: false, error: 'O campo "type" do evento simulado é obrigatório' },
              { status: 400 }
            );
          }
          await sessionManager.sendDemoEvent(body);
          return Response.json({ ok: true, message: 'Evento simulado enviado' });
        } catch (err: any) {
          return Response.json(
            { ok: false, error: err?.message || 'Erro ao processar evento simulado' },
            { status: 400 }
          );
        }
      }

      // GET /api/config -> Return current overlay configuration
      if (method === 'GET' && pathname === '/api/config') {
        return Response.json(sessionManager.getConfig(), {
          headers: {
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      // POST /api/config -> Save and publish updated overlay configuration
      if (method === 'POST' && pathname === '/api/config') {
        const adminCheck = validateAdminRequest(req);
        if (adminCheck) return adminCheck;

        try {
          const body = (await req.json()) as any;
          const result = sessionManager.saveConfig(body);
          if (!result.success) {
            return Response.json(
              { ok: false, error: result.error || 'Configuração inválida' },
              { status: 400 }
            );
          }
          return Response.json({
            ok: true,
            config: result.config,
          });
        } catch (err: any) {
          return Response.json(
            { ok: false, error: err?.message || 'Erro ao processar configuração' },
            { status: 400 }
          );
        }
      }

      // POST /api/config/reset -> Reset configuration to defaults
      if (method === 'POST' && pathname === '/api/config/reset') {
        const adminCheck = validateAdminRequest(req);
        if (adminCheck) return adminCheck;

        try {
          const resetConfig = sessionManager.resetConfig();
          return Response.json({
            ok: true,
            config: resetConfig,
          });
        } catch (err: any) {
          return Response.json(
            { ok: false, error: err?.message || 'Erro ao redefinir configurações' },
            { status: 500 }
          );
        }
      }

      // Overlay Routes: GET /overlay/:token and GET /overlay/:token/events
      if (pathname.startsWith('/overlay/')) {
        const parts = pathname.slice('/overlay/'.length).split('/');
        const token = parts[0];
        const subRoute = parts[1];

        if (!token || token !== sessionManager.overlayToken) {
          return Response.json(
            { ok: false, error: 'Token de overlay inválido ou não autorizado' },
            { status: 403 }
          );
        }

        // GET /overlay/:token/events -> SSE for OBS Overlay
        if (subRoute === 'events' && method === 'GET') {
          return createSSEStream(sessionManager, req.signal);
        }

        // GET /overlay/:token -> Serve overlay HTML
        if (!subRoute && method === 'GET') {
          const file = Bun.file(join(publicDir, 'overlay.html'));
          if (await file.exists()) {
            return new Response(file, {
              headers: { 'Content-Type': 'text/html; charset=utf-8' },
            });
          }
          return new Response('OBS Overlay', { status: 200 });
        }
      }

      // Static assets from publicDir (CSS, JS, images, fonts)
      if (method === 'GET') {
        const safePath = pathname.replace(/^\/+/, '');
        const file = Bun.file(join(publicDir, safePath));
        if (await file.exists()) {
          const ext = safePath.split('.').pop()?.toLowerCase();
          let contentType = 'application/octet-stream';
          if (ext === 'html') contentType = 'text/html; charset=utf-8';
          else if (ext === 'css') contentType = 'text/css; charset=utf-8';
          else if (ext === 'js') contentType = 'application/javascript; charset=utf-8';
          else if (ext === 'json') contentType = 'application/json; charset=utf-8';
          else if (ext === 'svg') contentType = 'image/svg+xml';
          else if (ext === 'png') contentType = 'image/png';
          else if (ext === 'ico') contentType = 'image/x-icon';

          return new Response(file, {
            headers: {
              'Content-Type': contentType,
              'Cache-Control': 'no-cache, must-revalidate',
            },
          });
        }
      }

      return Response.json({ ok: false, error: 'Rota não encontrada' }, { status: 404 });
    },
  });
}
