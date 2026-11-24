/**
 * Streamer Space - Live Capture Proof of Concept CLI
 *
 * Usage:
 *   bun run src/ingestion/poc-live.ts <username>
 *
 * Example:
 *   bun run src/ingestion/poc-live.ts @luapertaoplay
 */

import { TikTokLiveAdapter } from './tiktok-adapter.js';
import type {
  ConnectionStatus,
  LiveEventSourceCallbacks,
  RawChatMessage,
  RawGiftEvent,
  RawLikeEvent,
} from '../types/events.js';

const target = process.argv[2] || 'luapertaoplay';
const cleanUser = target.startsWith('@') ? target.slice(1) : target;

console.log('=====================================================');
console.log(`🎬 Streamer Space - Prova de Conceito de Ingestão Real`);
console.log(`Streamer Alvo: @${cleanUser}`);
console.log(`Runtime: Bun ${process.versions.bun} (Linux ${process.platform})`);
console.log('=====================================================\n');

const adapter = new TikTokLiveAdapter({
  processInitialData: true,
  requestTimeoutMs: 10000,
  connectTimeoutMs: 20000,
});

let totalLikesCount = 0;
let chatMessagesCount = 0;
let giftsCount = 0;

const callbacks: LiveEventSourceCallbacks = {
  onStatusChange: (status: ConnectionStatus, message?: string, details?: { roomId?: string }) => {
    const time = new Date().toLocaleTimeString();
    console.log(`[${time}] [STATUS: ${status.toUpperCase()}] ${message || ''}`);
    if (details?.roomId) {
      console.log(`       -> Room ID identificado: ${details.roomId}`);
    }
  },

  onChat: (chat: RawChatMessage) => {
    chatMessagesCount++;
    const time = new Date().toLocaleTimeString();
    console.log(`[${time}] 💬 [CHAT] ${chat.displayName || chat.username}: ${chat.comment}`);
  },

  onLike: (like: RawLikeEvent) => {
    totalLikesCount += like.count;
    const time = new Date().toLocaleTimeString();
    console.log(
      `[${time}] ❤️  [LIKE] +${like.count} curtidas por ${like.username || 'espectador'} (Total na sala: ${like.totalLikes ?? totalLikesCount})`
    );
  },

  onGift: (gift: RawGiftEvent) => {
    giftsCount += gift.count;
    const time = new Date().toLocaleTimeString();
    const streakInfo = gift.repeatEnd
      ? `[FINALIZADO x${gift.repeatCount}]`
      : `[COMBO x${gift.repeatCount}]`;
    console.log(
      `[${time}] 🎁 [GIFT] ${gift.displayName || gift.username} enviou ${gift.giftName} ${streakInfo} (${gift.diamondCount} diamantes)`
    );
  },

  onViewerCount: (count: number) => {
    const time = new Date().toLocaleTimeString();
    console.log(`[${time}] 👥 [ESPECTADORES] ${count} assistindo`);
  },

  onFollow: (follow) => {
    const time = new Date().toLocaleTimeString();
    console.log(`[${time}] ➕ [FOLLOW] ${follow.displayName || follow.username} começou a seguir`);
  },

  onShare: (share) => {
    const time = new Date().toLocaleTimeString();
    console.log(`[${time}] 🔄 [SHARE] ${share.displayName || share.username} compartilhou a live`);
  },
};

process.on('SIGINT', async () => {
  console.log('\nEncerrando captura da live...');
  await adapter.disconnect();
  console.log('\n--- RESUMO DA CAPTURA ---');
  console.log(`Mensagens de Chat: ${chatMessagesCount}`);
  console.log(`Total de Likes: ${totalLikesCount}`);
  console.log(`Presentes Recebidos: ${giftsCount}`);
  console.log('-------------------------\n');
  process.exit(0);
});

try {
  await adapter.connect(cleanUser, callbacks);
  console.log('Captura ao vivo ativa. Pressione Ctrl+C para encerrar.\n');
} catch (err: any) {
  console.error(`Falha ao conectar: ${err?.message || err}`);
}
