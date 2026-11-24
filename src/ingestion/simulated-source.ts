import type {
  LiveEventSource,
  LiveEventSourceCallbacks,
  RawChatMessage,
  RawGiftEvent,
  RawLikeEvent,
} from '../types/events.js';

export class SimulatedEventSource implements LiveEventSource {
  private _isConnected = false;
  private _username = '';
  private _callbacks: LiveEventSourceCallbacks | null = null;
  private _activeStreakTimer: ReturnType<typeof setTimeout> | null = null;

  get isConnected(): boolean {
    return this._isConnected;
  }

  get username(): string {
    return this._username;
  }

  get callbacks(): LiveEventSourceCallbacks | null {
    return this._callbacks;
  }

  async connect(username: string, callbacks: LiveEventSourceCallbacks): Promise<void> {
    this._isConnected = true;
    this._username = username;
    this._callbacks = callbacks;

    // Report connecting and then connected status
    callbacks.onStatusChange('connecting', 'Iniciando live simulada...', {
      roomId: `sim_${Date.now()}`,
      roomTitle: `Live Simulada de @${username}`,
    });

    // Provide initial room status
    setTimeout(() => {
      if (!this._isConnected || this._callbacks !== callbacks) return;
      callbacks.onStatusChange('connected', 'Conectado à live simulada', {
        roomId: `sim_${Date.now()}`,
        roomTitle: `Live Simulada de @${username}`,
      });
      if (callbacks.onViewerCount) {
        callbacks.onViewerCount(128);
      }
    }, 50);
  }

  async disconnect(): Promise<void> {
    this._isConnected = false;
    if (this._activeStreakTimer) {
      clearTimeout(this._activeStreakTimer);
      this._activeStreakTimer = null;
    }
    const cb = this._callbacks;
    this._callbacks = null;
    if (cb) {
      cb.onStatusChange('offline', 'Live simulada desconectada');
    }
  }

  emitChat(chat?: Partial<RawChatMessage>): void {
    if (!this._callbacks) return;
    const sampleComments = [
      'kkkk não aguento esse streamer [laughcry]',
      'Muito bom mano kkkk [laughwithtears] [fire]',
      'Salve do Brasil! [smile] [clap]',
      'Live perfeita demais [loveface] [heart]',
      'Bora bater a meta de likes hoje! [proud] 🚀',
      'Sensacional essa transmissão! [rose] 🔥',
    ];
    const sampleUsers = ['pedro_gamer', 'mari_stream', 'carlos_silva', 'ana_paula', 'lucas_dev'];
    const sampleAvatars: Record<string, string> = {
      pedro_gamer: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop&crop=faces',
      mari_stream: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=faces',
      carlos_silva: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=100&h=100&fit=crop&crop=faces',
      ana_paula: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=faces',
      lucas_dev: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=faces',
    };
    const randomUser = sampleUsers[Math.floor(Math.random() * sampleUsers.length)];
    const randomComment = sampleComments[Math.floor(Math.random() * sampleComments.length)];

    this._callbacks.onChat({
      id: chat?.id || `sim_chat_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      username: chat?.username || randomUser,
      displayName: chat?.displayName || (chat?.username || randomUser),
      comment: chat?.comment || randomComment,
      avatarUrl: chat?.avatarUrl !== undefined ? chat.avatarUrl : sampleAvatars[randomUser],
      timestamp: chat?.timestamp || Date.now(),
    });
  }

  emitLike(like?: Partial<RawLikeEvent>): void {
    if (!this._callbacks) return;
    this._callbacks.onLike({
      id: like?.id || `sim_like_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      count: like?.count !== undefined ? like.count : 15,
      totalLikes: like?.totalLikes,
      username: like?.username || 'espectador_anonimo',
    });
  }

  emitGift(gift?: Partial<RawGiftEvent>): void {
    if (!this._callbacks) return;
    this._callbacks.onGift({
      id: gift?.id || `sim_gift_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      giftId: gift?.giftId || 'rose',
      giftName: gift?.giftName || 'Rosa',
      count: gift?.count !== undefined ? gift.count : 1,
      diamondCount: gift?.diamondCount !== undefined ? gift.diamondCount : 1,
      username: gift?.username || 'fas_numero_1',
      displayName: gift?.displayName || 'Fã Número 1',
      giftPictureUrl: gift?.giftPictureUrl,
      repeatEnd: gift?.repeatEnd !== undefined ? gift.repeatEnd : true,
      repeatCount: gift?.repeatCount !== undefined ? gift.repeatCount : 1,
      groupId: gift?.groupId,
    });
  }

  async emitGiftStreak(options?: {
    giftId?: string | number;
    giftName?: string;
    count?: number;
    diamondCount?: number;
    username?: string;
    delayMs?: number;
  }): Promise<void> {
    if (!this._callbacks) return;
    const maxCount = options?.count || 3;
    const giftName = options?.giftName || 'Rosa';
    const giftId = options?.giftId || 'rose';
    const username = options?.username || 'combo_master';
    const unitDiamonds = options?.diamondCount !== undefined ? options.diamondCount : 1;
    const delay = options?.delayMs !== undefined ? options.delayMs : 250;
    const streakId = `sim_streak_${Date.now()}`;

    for (let i = 1; i <= maxCount; i++) {
      if (!this._isConnected || !this._callbacks) break;
      const isEnd = i === maxCount;
      this._callbacks.onGift({
        id: `sim_gift_${streakId}_${i}`,
        giftId,
        giftName,
        count: 1,
        repeatCount: i,
        repeatEnd: isEnd,
        diamondCount: unitDiamonds,
        username,
        displayName: 'Combo Master',
        groupId: streakId,
      });

      if (!isEnd && delay > 0) {
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  emitViewerCount(count: number): void {
    if (this._callbacks?.onViewerCount) {
      this._callbacks.onViewerCount(count);
    }
  }

  emitFollow(username?: string): void {
    if (this._callbacks?.onFollow) {
      this._callbacks.onFollow({
        username: username || 'novo_seguidor',
        displayName: username || 'Novo Seguidor',
      });
    }
  }

  emitShare(username?: string): void {
    if (this._callbacks?.onShare) {
      this._callbacks.onShare({
        username: username || 'compartilhador',
        displayName: username || 'Compartilhador',
      });
    }
  }
}
