import { join } from 'node:path';
import { SessionManager } from './server/session.js';
import { createHttpServer } from './server/http.js';
import { getOrCreateOverlayToken } from './server/token.js';

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOSTNAME = process.env.HOST || '127.0.0.1';

const overlayToken = getOrCreateOverlayToken();
const sessionManager = new SessionManager({
  overlayToken,
  profileFile: join(process.cwd(), 'data', 'live-profile.json'),
});
void sessionManager.restoreProfile().catch(err => console.error('Falha ao restaurar o perfil salvo:', err));
const server = createHttpServer({
  port: PORT,
  hostname: HOSTNAME,
  sessionManager,
});

console.log(`=========================================`);
console.log(`🚀 Streamer Space ativo em http://${HOSTNAME}:${PORT}`);
console.log(`📱 Painel de Controle: http://${HOSTNAME}:${PORT}/`);
console.log(`🎥 Overlay para OBS:  http://${HOSTNAME}:${PORT}/overlay/${overlayToken}`);
console.log(`=========================================`);
