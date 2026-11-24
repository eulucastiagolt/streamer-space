import { setTimeout as delay } from 'node:timers/promises';
import {
  TikTokLiveConnection,
  WebcastEvent,
  normalizeUsername as tokioNormalize,
  OfflineError,
  RoomNotFoundError,
  InvalidUsernameError,
  RateLimitError,
  isStreakEnd,
} from '@tokioapp/connector';
import type {
  LiveEventSource,
  LiveEventSourceCallbacks,
  RawChatMessage,
  RawGiftEvent,
  RawLikeEvent,
} from '../types/events.js';

interface RoomInfo {
  like_count?: unknown;
  likeCount?: unknown;
  stats?: { like_count?: unknown; likeCount?: unknown };
  owner?: {
    display_id?: unknown;
    displayId?: unknown;
    unique_id?: unknown;
    uniqueId?: unknown;
    follow_info?: { follower_count?: unknown };
    followInfo?: { followerCount?: unknown };
  };
}

export interface TikTokLiveAdapterOptions {
  processInitialData?: boolean;
  requestTimeoutMs?: number;
  connectTimeoutMs?: number;
  signTimeoutMs?: number;
}

/**
 * TikTokLiveAdapter adheres to the LiveEventSource contract
 * and utilizes @tokioapp/connector to capture live events directly from TikTok.
 */
export class TikTokLiveAdapter implements LiveEventSource {
  private _isConnected: boolean = false;
  private _username: string = '';
  private _connection: TikTokLiveConnection | null = null;
  private _callbacks: LiveEventSourceCallbacks | null = null;
  private _options: TikTokLiveAdapterOptions;
  private followerLookup?: AbortController;

  constructor(options?: TikTokLiveAdapterOptions) {
    this._options = {
      processInitialData: true,
      requestTimeoutMs: 8000,
      connectTimeoutMs: 15000,
      signTimeoutMs: 8000,
      ...options,
    };
  }

  get isConnected(): boolean {
    return this._isConnected;
  }

  get username(): string {
    return this._username;
  }

  get connection(): TikTokLiveConnection | null {
    return this._connection;
  }

  async connect(rawUsername: string, callbacks: LiveEventSourceCallbacks): Promise<void> {
    // Disconnect any existing connection first
    if (this._connection) await this.disconnect();

    let normalized: string;
    try {
      normalized = tokioNormalize(rawUsername);
    } catch (err: any) {
      callbacks.onStatusChange('error', `Nome de usuário inválido: ${rawUsername}`);
      throw err;
    }

    this._username = normalized;
    this._callbacks = callbacks;

    callbacks.onStatusChange('connecting', `Conectando à live de @${normalized}...`);

    const connection = new TikTokLiveConnection(normalized, {
      processInitialData: this._options.processInitialData,
      requestTimeoutMs: this._options.requestTimeoutMs,
      connectTimeoutMs: this._options.connectTimeoutMs,
      signTimeoutMs: this._options.signTimeoutMs,
      reconnect: {
        maxAttempts: 5,
        baseDelayMs: 2000,
        maxDelayMs: 15000,
        minDelayMs: 1000,
        checkLiveBeforeRetry: true,
        resume: true,
      },
    });
    this._connection = connection;

    const lookup = new AbortController();
    this.followerLookup = lookup;
    let initialRoom: { id: string; requestedAt: number; result: ReturnType<typeof fetchRoomInfo> } | undefined;
    const refreshFollowers = async (initialConnection: Promise<void>) => {
      while (!lookup.signal.aborted) {
        let total = await fetchProfileFollowerCount(normalized, lookup.signal);
        if (total === undefined) {
          await initialConnection;
          const roomId = initialRoom?.id ?? connection.roomId;
          if (roomId && !lookup.signal.aborted) {
            const room = initialRoom?.id === roomId && Date.now() - initialRoom.requestedAt < 5000
              ? await initialRoom.result
              : await fetchRoomInfo(roomId, lookup.signal);
            total = readRoomFollowerCount(room, normalized);
          }
        }
        if (lookup.signal.aborted) return;
        callbacks.onFollowerCount?.(total);
        await delay(45_000, undefined, { signal: lookup.signal, ref: false });
      }
    };
    // Attach lifecycle and event listeners
    connection.on(WebcastEvent.CONNECTED, (e) => {
      this._isConnected = true;
      if (this._callbacks === callbacks) {
        callbacks.onStatusChange('connected', `Conectado à live de @${normalized}`, {
          roomId: e.roomId,
        });
        const result = fetchRoomInfo(e.roomId, lookup.signal);
        initialRoom = { id: e.roomId, requestedAt: Date.now(), result };
        void result.then(room => {
          if (lookup.signal.aborted || initialRoom?.result !== result) return;
          const likes = readRoomLikeCount(room);
          if (likes !== undefined) callbacks.onRoomLikeCount?.(likes);
        });
      }
    });

    connection.on(WebcastEvent.CHAT, (e) => {
      if (!this._callbacks) return;
      const user = e.user as any;
      const rawChat: RawChatMessage = {
        id: e.common?.msgId,
        username: user?.displayId || user?.uniqueId || user?.nickname || 'anônimo',
        displayName: user?.nickname || user?.displayId || user?.uniqueId,
        comment: e.content || '',
        avatarUrl: user?.avatarThumb?.urlList?.[0],
        timestamp: e.common?.createTime ? Number(e.common.createTime) : Date.now(),
        emotes: Array.isArray((e as any).emotes)
          ? (e as any).emotes
              .map((em: any) => ({
                placeInContent: em.placeInContent,
                imageUrl: em.emote?.image?.urlList?.[0],
                name: em.emote?.emoteId,
              }))
              .filter((em: any) => Boolean(em.imageUrl))
          : undefined,
      };
      this._callbacks.onChat(rawChat);
    });

    connection.on(WebcastEvent.EMOTE, (e) => {
      if (!this._callbacks) return;
      const user = e.user as any;
      const emoteList = Array.isArray((e as any).emoteList) ? (e as any).emoteList : [];
      const emoteUrls = emoteList
        .map((em: any) => em.image?.urlList?.[0])
        .filter(Boolean);

      const rawChat: RawChatMessage = {
        id: e.common?.msgId,
        username: user?.displayId || user?.uniqueId || user?.nickname || 'anônimo',
        displayName: user?.nickname || user?.displayId || user?.uniqueId,
        comment: '',
        avatarUrl: user?.avatarThumb?.urlList?.[0],
        timestamp: e.common?.createTime ? Number(e.common.createTime) : Date.now(),
        emotes: emoteUrls.map((url: string) => ({ imageUrl: url })),
      };
      this._callbacks.onChat(rawChat);
    });

    connection.on(WebcastEvent.LIKE, (e) => {
      if (!this._callbacks) return;
      const user = e.user as any;
      const rawLike: RawLikeEvent = {
        id: e.common?.msgId,
        username: user?.displayId || user?.uniqueId || user?.nickname,
        displayName: user?.nickname,
        avatarUrl: user?.avatarThumb?.urlList?.[0],
        count: e.count || 1,
        totalLikes: typeof e.total === 'number' && e.total > 0 ? e.total : undefined,
      };
      this._callbacks.onLike(rawLike);
    });

    connection.on(WebcastEvent.GIFT, (e) => {
      if (!this._callbacks) return;
      const user = e.user as any;
      const isFinished = isStreakEnd(e) || Boolean(e.repeatEnd);
      const rawGift: RawGiftEvent = {
        id: e.common?.msgId,
        giftId: e.giftId,
        giftName: e.gift?.name || 'Presente',
        count: 1,
        diamondCount: e.gift?.diamondCount,
        username: user?.displayId || user?.uniqueId || user?.nickname || 'anônimo',
        displayName: user?.nickname || user?.displayId || user?.uniqueId,
        avatarUrl: user?.avatarThumb?.urlList?.[0],
        giftPictureUrl: e.gift?.image?.urlList?.[0],
        repeatEnd: isFinished,
        repeatCount: e.repeatCount || 1,
        groupId: e.groupId || e.common?.msgId,
      };
      this._callbacks.onGift(rawGift);
    });

    connection.on(WebcastEvent.ROOM_USER, (e) => {
      if (!this._callbacks) return;
      const viewerCount = typeof e.total === 'number' ? e.total : (e as any).viewerCount;
      if (typeof viewerCount === 'number') {
        this._callbacks.onViewerCount?.(viewerCount);
      }
    });

    connection.on(WebcastEvent.MEMBER, (e) => {
      if (!this._callbacks) return;
      const count = (e as any).memberCount;
      if (typeof count === 'number' && count > 0) {
        this._callbacks.onViewerCount?.(count);
      }
    });

    connection.on(WebcastEvent.FOLLOW, (e) => {
      if (!this._callbacks) return;
      const user = e.user as any;
      this._callbacks.onFollow?.({
        username: user?.displayId || user?.uniqueId || 'seguidor',
        displayName: user?.nickname || user?.displayId || user?.uniqueId,
      });
    });

    connection.on(WebcastEvent.SHARE, (e) => {
      if (!this._callbacks) return;
      const user = e.user as any;
      this._callbacks.onShare?.({
        username: user?.displayId || user?.uniqueId || 'compartilhador',
        displayName: user?.nickname || user?.displayId || user?.uniqueId,
      });
    });

    connection.on(WebcastEvent.RECONNECTING, (e) => {
      if (this._callbacks === callbacks) {
        callbacks.onStatusChange(
          'reconnecting',
          `Reconectando à live de @${normalized} (tentativa ${e.attempt})...`
        );
      }
    });

    connection.on(WebcastEvent.STREAM_END, () => {
      this._isConnected = false;
      if (this._callbacks === callbacks) {
        callbacks.onStatusChange('offline', 'A transmissão ao vivo foi encerrada pelo streamer');
      }
    });

    connection.on(WebcastEvent.DISCONNECTED, (e) => {
      this._isConnected = false;
      if (this._callbacks === callbacks) {
        callbacks.onStatusChange('offline', `Conexão encerrada (${e.reason})`);
      }
    });

    connection.on(WebcastEvent.ERROR, (err) => {
      if (this._callbacks === callbacks) {
        callbacks.onStatusChange('error', `Erro na conexão: ${err.message}`);
      }
    });

    try {
      const connecting = connection.connect();
      void refreshFollowers(connecting.then(() => {}, () => {})).catch(err => {
        if (!lookup.signal.aborted) console.warn('Falha ao atualizar seguidores:', err);
      });
      await connecting;
    } catch (err: any) {
      this._isConnected = false;
      if (this._callbacks === callbacks) {
        if (err instanceof OfflineError) {
          callbacks.onStatusChange(
            'offline',
            `O streamer @${normalized} não está transmitindo ao vivo no momento.`
          );
          return;
        }
        if (err instanceof RoomNotFoundError) {
          callbacks.onStatusChange(
            'offline',
            `Não foi possível localizar uma sala ativa para @${normalized} (offline ou inexistente).`
          );
          return;
        }
        if (err instanceof InvalidUsernameError) {
          callbacks.onStatusChange('error', `Nome de usuário "${rawUsername}" é inválido.`);
          throw err;
        }
        if (err instanceof RateLimitError) {
          callbacks.onStatusChange(
            'error',
            'Limite de requisições de assinatura atingido. Aguarde alguns instantes antes de tentar novamente.'
          );
          throw err;
        }
        callbacks.onStatusChange(
          'error',
          err?.message || `Falha ao conectar à live de @${normalized}.`
        );
      }
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    this.followerLookup?.abort();
    this.followerLookup = undefined;
    this._isConnected = false;
    const conn = this._connection;
    this._connection = null;
    const cb = this._callbacks;
    this._callbacks = null;

    if (conn) {
      try {
        await conn.disconnect();
      } catch (err) {
        console.warn('Erro ao desconectar TikTokLiveConnection:', err);
      }
    }

    if (cb) {
      cb.onStatusChange('offline', 'Desconectado do streamer');
    }
  }
}

export function parseFollowerCount(raw: unknown): number | undefined {
  if (typeof raw === 'number') {
    return Number.isSafeInteger(raw) && raw >= 0 ? raw : undefined;
  }
  if (typeof raw !== 'string') return;

  const value = raw.trim();
  if (/^\d+$/.test(value)) return parseFollowerCount(Number(value));
  if (/^\d{1,3}([., \u00a0\u202f])\d{3}(?:\1\d{3})*$/.test(value)) {
    return parseFollowerCount(Number(value.replace(/\D/g, '')));
  }
}

export function readProfileFollowerCount(html: string, username: string): number | undefined {
  const matchesUsername = (handle: unknown) =>
    typeof handle === 'string' && handle.toLowerCase() === username.toLowerCase();

  for (const script of html.matchAll(/<script\b[^>]*\sid\s*=\s*["'](__UNIVERSAL_DATA_FOR_REHYDRATION__|SIGI_STATE)["'][^>]*>([\s\S]*?)<\/script\s*>/gi)) {
    try {
      const data = JSON.parse(script[2]);
      const profile = data?.__DEFAULT_SCOPE__?.['webapp.user-detail']?.userInfo;
      if (matchesUsername(profile?.user?.uniqueId)) {
        const count = parseFollowerCount(profile.statsV2?.followerCount) ??
          parseFollowerCount(profile.stats?.followerCount);
        if (count !== undefined) return count;
      }

      const users = data?.UserModule?.users ?? {};
      const key = Object.keys(users).find(key => matchesUsername(users[key]?.uniqueId));
      if (key !== undefined) {
        const count = parseFollowerCount(data.UserModule.stats?.[key]?.followerCount);
        if (count !== undefined) return count;
      }
    } catch {
      // A malformed script does not rule out another supported profile payload.
    }
  }
}

async function fetchProfileFollowerCount(username: string, signal: AbortSignal): Promise<number | undefined> {
  // Prefer the profile's own stats. Room metadata can be missing or stale.
  try {
    const response = await fetch(`https://www.tiktok.com/@${encodeURIComponent(username)}`, {
      signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]),
    });
    if (response.ok) {
      return readProfileFollowerCount(await response.text(), username);
    }
  } catch {
    // LIVE room metadata is the fallback when the public profile is unavailable.
  }
}

async function fetchRoomInfo(roomId: string, signal: AbortSignal): Promise<RoomInfo | undefined> {
  if (signal.aborted) return;
  try {
    const url = new URL('https://webcast.tiktok.com/webcast/room/info/');
    url.searchParams.set('aid', '1988');
    url.searchParams.set('room_id', roomId);
    const response = await fetch(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]) });
    if (!response.ok) return;
    const info = await response.json();
    if (info?.status_code !== undefined && info.status_code !== 0) return;
    return info?.data;
  } catch {
    // The overlay reports unavailable data or uses the configured manual base.
  }
}

function readRoomLikeCount(room: RoomInfo | undefined): number | undefined {
  const totals = [room?.like_count, room?.likeCount, room?.stats?.like_count, room?.stats?.likeCount]
    .map(parseFollowerCount)
    .filter((count): count is number => count !== undefined);
  return totals.length ? Math.max(...totals) : undefined;
}

function readRoomFollowerCount(room: RoomInfo | undefined, username: string): number | undefined {
  const owner = room?.owner;
  const handle = owner?.display_id ?? owner?.displayId ?? owner?.unique_id ?? owner?.uniqueId;
  if (typeof handle === 'string' && handle.toLowerCase() !== username.toLowerCase()) return;
  return parseFollowerCount(owner?.follow_info?.follower_count) ??
    parseFollowerCount(owner?.followInfo?.followerCount);
}
