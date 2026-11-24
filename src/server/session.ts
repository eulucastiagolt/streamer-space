import { randomUUID } from 'node:crypto';
import type {
  ActiveGiftStreak,
  BaseEvent,
  ChatMessageData,
  ConnectionStatus,
  EngagementLikeData,
  EventType,
  FollowData,
  GiftCompletedData,
  GiftUpdateData,
  LiveEventSource,
  LiveEventSourceCallbacks,
  LiveStatusData,
  RawChatMessage,
  RawGiftEvent,
  RawLikeEvent,
  SessionSnapshot,
  ShareData,
  StreamerSpaceEvent,
  ViewerCountData,
} from '../types/events.js';
import type { OverlayConfig } from '../types/config.js';
import { ConfigStore, configStore } from './config-store.js';
import { SimulatedEventSource } from '../ingestion/simulated-source.js';

export function normalizeUsername(input: string): string {
  if (!input || typeof input !== 'string') {
    throw new Error('Username do streamer não pode ser vazio');
  }
  const trimmed = input.trim();
  const cleaned = trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
  if (!cleaned || cleaned.length === 0) {
    throw new Error('Username do streamer não pode ser vazio');
  }
  // TikTok usernames contain alphanumeric characters, underscores, and dots
  if (!/^[a-zA-Z0-9_.-]+$/.test(cleaned)) {
    throw new Error('Username do streamer contém caracteres inválidos');
  }
  return cleaned;
}

export type SourceFactory = (username: string, isSimulated: boolean) => LiveEventSource;

export interface SessionManagerOptions {
  overlayToken?: string;
  streakTimeoutMs?: number;
  sourceFactory?: SourceFactory;
  configStore?: ConfigStore;
}

export class SessionManager {
  private _sessionId: string = randomUUID();
  private _sequence: number = 0;
  private _targetUsername: string = '';
  private _status: ConnectionStatus = 'idle';
  private _errorMessage?: string;
  private _roomId?: string;
  private _roomTitle?: string;
  private _totalLikes: number = 0;
  private _likesLabel: string = 'curtidas observadas desde a conexão';
  private _hasRoomTotalLikes: boolean = false;
  private _viewerCount?: number;
  private _recentChat: BaseEvent<'chat.message', ChatMessageData>[] = [];
  private _recentGifts: BaseEvent<'gift.completed', GiftCompletedData>[] = [];
  private _activeGiftStreak: ActiveGiftStreak | null = null;
  private _activeGiftStreakUnitDiamonds: number | undefined = undefined;
  private _connectedAt?: string;
  private _isSimulated: boolean = false;
  private _overlayToken: string;

  private _connectionEpoch: number = 0;
  private _currentSource: LiveEventSource | null = null;
  private _seenEventIds: Set<string> = new Set();
  private _streakTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
  private _streakTimeoutMs: number = 5000;
  private _listeners: Set<(event: StreamerSpaceEvent) => void> = new Set();
  private _sourceFactory?: SourceFactory;
  private _configStore: ConfigStore;

  constructor(options?: SessionManagerOptions) {
    this._overlayToken = options?.overlayToken || randomUUID().replace(/-/g, '');
    if (options?.streakTimeoutMs !== undefined) {
      this._streakTimeoutMs = options.streakTimeoutMs;
    }
    this._sourceFactory = options?.sourceFactory;
    this._configStore = options?.configStore || configStore;
  }

  get configStore(): ConfigStore {
    return this._configStore;
  }

  getConfig(): OverlayConfig {
    return this._configStore.getConfig();
  }

  saveConfig(input: any) {
    const result = this._configStore.saveConfig(input);
    if (result.success && result.config) {
      this.emitConfigUpdated(result.config);
    }
    return result;
  }

  resetConfig(): OverlayConfig {
    const reset = this._configStore.resetConfig();
    this.emitConfigUpdated(reset);
    return reset;
  }

  emitConfigUpdated(config: OverlayConfig): void {
    const event = this.createEvent('config.updated', config);
    this.emitEvent(event);
  }

  get overlayToken(): string {
    return this._overlayToken;
  }

  get status(): ConnectionStatus {
    return this._status;
  }

  get targetUsername(): string {
    return this._targetUsername;
  }

  get totalLikes(): number {
    return this._totalLikes;
  }

  get sessionId(): string {
    return this._sessionId;
  }

  get currentSource(): LiveEventSource | null {
    return this._currentSource;
  }

  getSnapshot(): SessionSnapshot {
    return {
      sessionId: this._sessionId,
      targetUsername: this._targetUsername,
      status: this._status,
      errorMessage: this._errorMessage,
      roomId: this._roomId,
      roomTitle: this._roomTitle,
      totalLikes: this._totalLikes,
      likesLabel: this._likesLabel,
      viewerCount: this._viewerCount,
      recentChat: [...this._recentChat],
      recentGifts: [...this._recentGifts],
      activeGiftStreak: this._activeGiftStreak ? { ...this._activeGiftStreak } : null,
      connectedAt: this._connectedAt,
      isSimulated: this._isSimulated,
      overlayToken: this._overlayToken,
      config: this._configStore.getConfig(),
    };
  }

  addListener(listener: (event: StreamerSpaceEvent) => void): () => void {
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  }

  private emitEvent(event: StreamerSpaceEvent): void {
    for (const listener of this._listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('Error in event listener:', err);
      }
    }
  }

  private createEvent<T extends EventType, D>(
    type: T,
    data: D,
    providerEventId?: string,
    occurredAt?: string
  ): BaseEvent<T, D> {
    return {
      schemaVersion: '1.0',
      sessionId: this._sessionId,
      sequence: ++this._sequence,
      receivedAt: new Date().toISOString(),
      occurredAt: occurredAt || new Date().toISOString(),
      providerEventId,
      type,
      data,
    };
  }

  private isDuplicate(id?: string): boolean {
    if (!id) return false;
    if (this._seenEventIds.has(id)) {
      return true;
    }
    this._seenEventIds.add(id);
    if (this._seenEventIds.size > 2000) {
      // Keep bounded set size
      const iterator = this._seenEventIds.values();
      for (let i = 0; i < 500; i++) {
        const next = iterator.next();
        if (next.done) break;
        this._seenEventIds.delete(next.value);
      }
    }
    return false;
  }

  async connect(rawUsername: string, options?: { isSimulated?: boolean }): Promise<void> {
    const normalized = normalizeUsername(rawUsername);

    // Cancel any previous connection and isolate callbacks
    this._connectionEpoch++;
    const currentEpoch = this._connectionEpoch;

    if (this._streakTimeoutTimer) {
      clearTimeout(this._streakTimeoutTimer);
      this._streakTimeoutTimer = null;
    }

    if (this._currentSource) {
      try {
        await this._currentSource.disconnect();
      } catch (err) {
        console.error('Error disconnecting previous source:', err);
      }
      this._currentSource = null;
    }

    // Isolate room state while PRESERVING overlayToken
    this._sessionId = randomUUID();
    this._sequence = 0;
    this._targetUsername = normalized;
    this._status = 'connecting';
    this._errorMessage = undefined;
    this._roomId = undefined;
    this._roomTitle = undefined;
    this._totalLikes = 0;
    this._likesLabel = 'curtidas observadas desde a conexão';
    this._hasRoomTotalLikes = false;
    this._viewerCount = undefined;
    this._recentChat = [];
    this._recentGifts = [];
    this._activeGiftStreak = null;
    this._activeGiftStreakUnitDiamonds = undefined;
    this._connectedAt = undefined;
    this._isSimulated = options?.isSimulated ?? false;
    this._seenEventIds.clear();

    const statusEvent = this.createEvent('live.status', {
      status: 'connecting' as ConnectionStatus,
      targetUsername: normalized,
      message: 'Conectando à live...',
      isSimulated: this._isSimulated,
    });
    this.emitEvent(statusEvent);

    const callbacks: LiveEventSourceCallbacks = {
      onStatusChange: (status, message, details) => {
        if (this._connectionEpoch !== currentEpoch) return;
        this.handleStatusChange(status, message, details);
      },
      onChat: (chat) => {
        if (this._connectionEpoch !== currentEpoch) return;
        this.handleChat(chat);
      },
      onLike: (like) => {
        if (this._connectionEpoch !== currentEpoch) return;
        this.handleLike(like);
      },
      onGift: (gift) => {
        if (this._connectionEpoch !== currentEpoch) return;
        this.handleGift(gift);
      },
      onViewerCount: (count) => {
        if (this._connectionEpoch !== currentEpoch) return;
        this.handleViewerCount(count);
      },
      onFollow: (follow) => {
        if (this._connectionEpoch !== currentEpoch) return;
        this.handleFollow(follow);
      },
      onShare: (share) => {
        if (this._connectionEpoch !== currentEpoch) return;
        this.handleShare(share);
      },
    };

    let source: LiveEventSource;
    if (this._sourceFactory) {
      source = this._sourceFactory(normalized, this._isSimulated);
    } else if (this._isSimulated || normalized === 'demo' || normalized === 'simulador') {
      source = new SimulatedEventSource();
    } else {
      try {
        const mod = await import('../ingestion/tiktok-adapter.js').catch(() =>
          import('../ingestion/tiktok-adapter.ts').catch(() => null)
        );
        if (mod && mod.TikTokLiveAdapter) {
          source = new mod.TikTokLiveAdapter();
        } else {
          source = new SimulatedEventSource();
        }
      } catch {
        source = new SimulatedEventSource();
      }
    }

    this._currentSource = source;
    try {
      await source.connect(normalized, callbacks);
    } catch (err: any) {
      if (this._connectionEpoch !== currentEpoch) return;
      this.handleStatusChange('error', err?.message || 'Falha ao conectar com o streamer');
    }
  }

  async disconnect(): Promise<void> {
    this._connectionEpoch++;
    if (this._streakTimeoutTimer) {
      clearTimeout(this._streakTimeoutTimer);
      this._streakTimeoutTimer = null;
    }
    if (this._currentSource) {
      try {
        await this._currentSource.disconnect();
      } catch (err) {
        console.error('Error disconnecting source:', err);
      }
      this._currentSource = null;
    }
    this._status = 'offline';
    this._errorMessage = undefined;

    const event = this.createEvent('live.status', {
      status: 'offline' as ConnectionStatus,
      targetUsername: this._targetUsername,
      message: 'Desconectado da live',
      isSimulated: this._isSimulated,
    });
    this.emitEvent(event);
  }

  handleStatusChange(
    status: ConnectionStatus,
    message?: string,
    details?: { roomId?: string; roomTitle?: string }
  ): void {
    this._status = status;
    this._errorMessage = status === 'error' ? message : undefined;
    if (details?.roomId) this._roomId = details.roomId;
    if (details?.roomTitle) this._roomTitle = details.roomTitle;
    if (status === 'connected' && !this._connectedAt) {
      this._connectedAt = new Date().toISOString();
    }

    const event = this.createEvent('live.status', {
      status: this._status,
      message,
      targetUsername: this._targetUsername,
      roomId: this._roomId,
      roomTitle: this._roomTitle,
      isSimulated: this._isSimulated,
    });
    this.emitEvent(event);
  }

  handleChat(chat: RawChatMessage): void {
    if (this.isDuplicate(chat.id)) return;

    const event = this.createEvent(
      'chat.message',
      {
        username: chat.username,
        displayName: chat.displayName,
        comment: chat.comment,
        profilePictureUrl: chat.avatarUrl,
        badge: undefined,
      },
      chat.id,
      chat.timestamp ? new Date(chat.timestamp).toISOString() : undefined
    );

    this._recentChat.push(event);
    if (this._recentChat.length > 100) {
      this._recentChat.shift();
    }

    this.emitEvent(event);
  }

  handleLike(like: RawLikeEvent): void {
    if (this.isDuplicate(like.id)) return;

    const delta = like.count !== undefined && like.count > 0 ? like.count : 1;

    if (like.totalLikes !== undefined && like.totalLikes > 0) {
      this._totalLikes = like.totalLikes;
      this._likesLabel = 'total de curtidas';
      this._hasRoomTotalLikes = true;
    } else {
      this._totalLikes += delta;
      if (!this._hasRoomTotalLikes) {
        this._likesLabel = 'curtidas observadas desde a conexão';
      }
    }

    const event = this.createEvent(
      'engagement.like',
      {
        count: delta,
        totalLikes: this._totalLikes,
        username: like.username,
        label: this._likesLabel,
      },
      like.id
    );

    this.emitEvent(event);
  }

  handleGift(gift: RawGiftEvent): void {
    if (this.isDuplicate(gift.id)) return;

    const streakId = gift.groupId || `${gift.username}_${gift.giftId}`;
    const rawRepeatCount = gift.repeatCount !== undefined && gift.repeatCount > 0 ? gift.repeatCount : gift.count || 1;

    // Track unit diamonds if first time seeing diamondCount for this streak
    if (gift.diamondCount !== undefined) {
      if (this._activeGiftStreakUnitDiamonds === undefined || this._activeGiftStreak?.streakId !== streakId) {
        this._activeGiftStreakUnitDiamonds = gift.diamondCount;
      }
    }

    if (!gift.repeatEnd) {
      // In-progress streak
      if (this._streakTimeoutTimer) {
        clearTimeout(this._streakTimeoutTimer);
        this._streakTimeoutTimer = null;
      }

      this._activeGiftStreak = {
        streakId,
        giftId: gift.giftId,
        giftName: gift.giftName,
        username: gift.username,
        displayName: gift.displayName,
        giftPictureUrl: gift.giftPictureUrl,
        currentCount: rawRepeatCount,
        lastUpdatedAt: Date.now(),
      };

      const updateEvent = this.createEvent(
        'gift.update',
        {
          giftId: gift.giftId,
          giftName: gift.giftName,
          count: rawRepeatCount,
          diamondCount: gift.diamondCount,
          username: gift.username,
          displayName: gift.displayName,
          giftPictureUrl: gift.giftPictureUrl,
          isStreak: true,
          streakId,
        },
        gift.id
      );

      this.emitEvent(updateEvent);

      // Start timeout timer for unconfirmed streak expiration
      this._streakTimeoutTimer = setTimeout(() => {
        // Expire unconfirmed streak without summing to confirmed total
        this._activeGiftStreak = null;
        this._activeGiftStreakUnitDiamonds = undefined;
        this._streakTimeoutTimer = null;
      }, this._streakTimeoutMs);
    } else {
      // Confirmed finish of a streak OR single gift
      if (this._streakTimeoutTimer) {
        clearTimeout(this._streakTimeoutTimer);
        this._streakTimeoutTimer = null;
      }

      const finalCount =
        this._activeGiftStreak && this._activeGiftStreak.streakId === streakId
          ? Math.max(rawRepeatCount, this._activeGiftStreak.currentCount)
          : rawRepeatCount;

      let totalDiamonds: number | undefined = undefined;
      if (gift.diamondCount !== undefined) {
        const unit = this._activeGiftStreakUnitDiamonds ?? gift.diamondCount;
        if (gift.diamondCount > unit) {
          totalDiamonds = gift.diamondCount;
        } else {
          totalDiamonds = unit * finalCount;
        }
      }

      this._activeGiftStreak = null;
      this._activeGiftStreakUnitDiamonds = undefined;

      const completedEvent = this.createEvent(
        'gift.completed',
        {
          giftId: gift.giftId,
          giftName: gift.giftName,
          count: finalCount,
          diamondCount: totalDiamonds,
          username: gift.username,
          displayName: gift.displayName,
          giftPictureUrl: gift.giftPictureUrl,
          streakId: gift.groupId,
        },
        gift.id
      );

      this._recentGifts.push(completedEvent);
      if (this._recentGifts.length > 50) {
        this._recentGifts.shift();
      }

      this.emitEvent(completedEvent);
    }
  }

  handleViewerCount(count: number): void {
    this._viewerCount = count;
    const event = this.createEvent('viewer.count', {
      viewerCount: count,
    });
    this.emitEvent(event);
  }

  handleFollow(follow: { username: string; displayName?: string }): void {
    const event = this.createEvent('engagement.follow', {
      username: follow.username,
      displayName: follow.displayName,
    });
    this.emitEvent(event);
  }

  handleShare(share: { username: string; displayName?: string }): void {
    const event = this.createEvent('engagement.share', {
      username: share.username,
      displayName: share.displayName,
    });
    this.emitEvent(event);
  }

  async sendDemoEvent(params: {
    type: string;
    comment?: string;
    username?: string;
    count?: number;
    totalLikes?: number;
    giftId?: string | number;
    giftName?: string;
    diamondCount?: number;
    maxCount?: number;
  }): Promise<void> {
    // If not connected or idle, auto-connect to simulated session
    if (this._status === 'idle' || this._status === 'offline') {
      await this.connect(this._targetUsername || 'simulador', { isSimulated: true });
    }

    const type = params.type;
    if (type === 'chat') {
      this.handleChat({
        username: params.username || 'usuario_demo',
        comment: params.comment || 'Olá do modo simulação! 🔥',
      });
    } else if (type === 'like') {
      this.handleLike({
        count: params.count !== undefined ? params.count : 15,
        totalLikes: params.totalLikes,
        username: params.username || 'usuario_demo',
      });
    } else if (type === 'gift') {
      this.handleGift({
        giftId: params.giftId || 'rose',
        giftName: params.giftName || 'Rosa',
        count: params.count || 1,
        repeatCount: params.count || 1,
        repeatEnd: true,
        diamondCount: params.diamondCount !== undefined ? params.diamondCount : 1,
        username: params.username || 'usuario_demo',
        displayName: 'Pedro Doador',
        giftPictureUrl: 'https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/5b35f795db2f7f98fb7adfbde71b67f1~tplv-obj.png',
      });
    } else if (type === 'streak') {
      const maxCount = params.count || params.maxCount || 3;
      const giftName = params.giftName || 'Rosa';
      const giftId = params.giftId || 'rose';
      const username = params.username || 'usuario_combo';
      const streakId = `sim_streak_${Date.now()}`;
      const unitDiamonds = params.diamondCount !== undefined ? params.diamondCount : 1;

      for (let i = 1; i <= maxCount; i++) {
        const isEnd = i === maxCount;
        this.handleGift({
          id: `sim_gift_${streakId}_${i}`,
          giftId,
          giftName,
          count: 1,
          repeatCount: i,
          repeatEnd: isEnd,
          diamondCount: unitDiamonds,
          username,
          displayName: 'Super Fã (Combo)',
          giftPictureUrl: 'https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/5b35f795db2f7f98fb7adfbde71b67f1~tplv-obj.png',
          groupId: streakId,
        });

        if (!isEnd) {
          await new Promise((r) => setTimeout(r, 200));
        }
      }
    } else if (type === 'viewers') {
      this.handleViewerCount(params.count || 250);
    }
  }
}
