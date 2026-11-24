/**
 * Streamer Space - TypeScript Contracts
 * Schema Version: 1.0
 */

export type EventType =
  | 'chat.message'
  | 'engagement.like'
  | 'gift.update'
  | 'gift.completed'
  | 'live.status'
  | 'viewer.count'
  | 'engagement.follow'
  | 'engagement.share';

export interface BaseEvent<T extends EventType = EventType, D = unknown> {
  schemaVersion: '1.0';
  sessionId: string;
  sequence: number;
  receivedAt: string; // ISO 8601
  occurredAt?: string;
  providerEventId?: string;
  type: T;
  data: D;
}

export interface ChatMessageData {
  username: string;
  displayName?: string;
  comment: string;
  profilePictureUrl?: string;
  badge?: string;
}

export interface EngagementLikeData {
  count: number; // delta in batch
  totalLikes?: number; // total reported or accumulated
  username?: string;
  label: string; // e.g. "likes observados desde a conexão" or "total de curtidas"
}

export interface GiftUpdateData {
  giftId: string | number;
  giftName: string;
  count: number;
  diamondCount?: number;
  username: string;
  displayName?: string;
  giftPictureUrl?: string;
  isStreak: boolean;
  streakId?: string;
}

export interface GiftCompletedData {
  giftId: string | number;
  giftName: string;
  count: number; // final total count in streak or single gift
  diamondCount?: number;
  username: string;
  displayName?: string;
  giftPictureUrl?: string;
  streakId?: string;
}

export type ConnectionStatus =
  | 'idle'
  | 'offline'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error';

export interface LiveStatusData {
  status: ConnectionStatus;
  message?: string;
  targetUsername: string;
  roomId?: string;
  roomTitle?: string;
  isSimulated: boolean;
}

export interface ViewerCountData {
  viewerCount: number;
}

export interface FollowData {
  username: string;
  displayName?: string;
}

export interface ShareData {
  username: string;
  displayName?: string;
}

export type StreamerSpaceEvent =
  | BaseEvent<'chat.message', ChatMessageData>
  | BaseEvent<'engagement.like', EngagementLikeData>
  | BaseEvent<'gift.update', GiftUpdateData>
  | BaseEvent<'gift.completed', GiftCompletedData>
  | BaseEvent<'live.status', LiveStatusData>
  | BaseEvent<'viewer.count', ViewerCountData>
  | BaseEvent<'engagement.follow', FollowData>
  | BaseEvent<'engagement.share', ShareData>;

export interface ActiveGiftStreak {
  streakId: string;
  giftId: string | number;
  giftName: string;
  username: string;
  displayName?: string;
  giftPictureUrl?: string;
  currentCount: number;
  lastUpdatedAt: number; // epoch ms
}

export interface SessionSnapshot {
  sessionId: string;
  targetUsername: string;
  status: ConnectionStatus;
  errorMessage?: string;
  roomId?: string;
  roomTitle?: string;
  totalLikes: number;
  likesLabel: string;
  viewerCount?: number;
  recentChat: BaseEvent<'chat.message', ChatMessageData>[];
  recentGifts: BaseEvent<'gift.completed', GiftCompletedData>[];
  activeGiftStreak?: ActiveGiftStreak | null;
  connectedAt?: string;
  isSimulated: boolean;
  overlayToken: string;
}

/**
 * Raw events delivered by LiveEventSource adapters
 */
export interface RawChatMessage {
  id?: string;
  username: string;
  displayName?: string;
  comment: string;
  avatarUrl?: string;
  timestamp?: number;
}

export interface RawLikeEvent {
  id?: string;
  username?: string;
  count: number; // delta
  totalLikes?: number; // total room likes if known
}

export interface RawGiftEvent {
  id?: string;
  giftId: string | number;
  giftName: string;
  count: number;
  diamondCount?: number;
  username: string;
  displayName?: string;
  giftPictureUrl?: string;
  repeatEnd: boolean; // true when combo is finished or single gift
  repeatCount: number; // current repeat count
  groupId?: string; // streak identifier
}

export interface LiveEventSourceCallbacks {
  onStatusChange: (status: ConnectionStatus, message?: string, details?: { roomId?: string; roomTitle?: string }) => void;
  onChat: (chat: RawChatMessage) => void;
  onLike: (like: RawLikeEvent) => void;
  onGift: (gift: RawGiftEvent) => void;
  onViewerCount?: (count: number) => void;
  onFollow?: (follow: { username: string; displayName?: string }) => void;
  onShare?: (share: { username: string; displayName?: string }) => void;
}

export interface LiveEventSource {
  readonly isConnected: boolean;
  readonly username: string;
  connect(username: string, callbacks: LiveEventSourceCallbacks): Promise<void>;
  disconnect(): Promise<void>;
}
