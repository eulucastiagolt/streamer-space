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
    await this.disconnect();

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

    // Attach lifecycle and event listeners
    connection.on(WebcastEvent.CONNECTED, (e) => {
      this._isConnected = true;
      if (this._callbacks === callbacks) {
        callbacks.onStatusChange('connected', `Conectado à live de @${normalized}`, {
          roomId: e.roomId,
        });
      }
    });

    connection.on(WebcastEvent.CHAT, (e) => {
      if (!this._callbacks) return;
      const rawChat: RawChatMessage = {
        id: e.common?.msgId,
        username: e.user?.uniqueId || e.user?.nickname || 'anônimo',
        displayName: e.user?.nickname || e.user?.uniqueId,
        comment: e.content || '',
        avatarUrl: e.user?.avatarThumb?.urlList?.[0],
        timestamp: e.common?.createTime ? Number(e.common.createTime) : Date.now(),
      };
      this._callbacks.onChat(rawChat);
    });

    connection.on(WebcastEvent.LIKE, (e) => {
      if (!this._callbacks) return;
      const rawLike: RawLikeEvent = {
        id: e.common?.msgId,
        username: e.user?.uniqueId || e.user?.nickname,
        count: e.count || 1,
        totalLikes: typeof e.total === 'number' && e.total > 0 ? e.total : undefined,
      };
      this._callbacks.onLike(rawLike);
    });

    connection.on(WebcastEvent.GIFT, (e) => {
      if (!this._callbacks) return;
      const isFinished = isStreakEnd(e) || Boolean(e.repeatEnd);
      const rawGift: RawGiftEvent = {
        id: e.common?.msgId,
        giftId: e.giftId,
        giftName: e.gift?.name || 'Presente',
        count: 1,
        diamondCount: e.gift?.diamondCount !== undefined ? e.gift.diamondCount : 1,
        username: e.user?.uniqueId || e.user?.nickname || 'anônimo',
        displayName: e.user?.nickname || e.user?.uniqueId,
        giftPictureUrl: e.gift?.image?.urlList?.[0],
        repeatEnd: isFinished,
        repeatCount: e.repeatCount || 1,
        groupId: e.groupId || e.common?.msgId,
      };
      this._callbacks.onGift(rawGift);
    });

    connection.on(WebcastEvent.ROOM_USER, (e) => {
      if (!this._callbacks) return;
      if (typeof e.viewerCount === 'number') {
        this._callbacks.onViewerCount?.(e.viewerCount);
      }
    });

    connection.on(WebcastEvent.MEMBER, (e) => {
      if (!this._callbacks) return;
      if (typeof e.memberCount === 'number' && e.memberCount > 0) {
        this._callbacks.onViewerCount?.(e.memberCount);
      }
    });

    connection.on(WebcastEvent.FOLLOW, (e) => {
      if (!this._callbacks) return;
      this._callbacks.onFollow?.({
        username: e.user?.uniqueId || 'seguidor',
        displayName: e.user?.nickname || e.user?.uniqueId,
      });
    });

    connection.on(WebcastEvent.SHARE, (e) => {
      if (!this._callbacks) return;
      this._callbacks.onShare?.({
        username: e.user?.uniqueId || 'compartilhador',
        displayName: e.user?.nickname || e.user?.uniqueId,
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
      await connection.connect();
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
