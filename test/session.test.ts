import { describe, expect, it } from 'bun:test';
import { SessionManager, normalizeUsername } from '../src/server/session.js';
import type {
  LiveEventSource,
  LiveEventSourceCallbacks,
  StreamerSpaceEvent,
} from '../src/types/events.js';

describe('normalizeUsername', () => {
  it('normalizes username with leading @', () => {
    expect(normalizeUsername('@streamer')).toBe('streamer');
    expect(normalizeUsername('@luapertaoplay')).toBe('luapertaoplay');
  });

  it('normalizes username without @', () => {
    expect(normalizeUsername('streamer')).toBe('streamer');
    expect(normalizeUsername('luapertaoplay')).toBe('luapertaoplay');
  });

  it('trims whitespace and handles valid characters (dots, underscores, hyphens)', () => {
    expect(normalizeUsername('  @user.name_123-pro  ')).toBe('user.name_123-pro');
    expect(normalizeUsername(' streamer.live ')).toBe('streamer.live');
  });

  it('throws error for empty or invalid input', () => {
    expect(() => normalizeUsername('')).toThrow('Username do streamer não pode ser vazio');
    expect(() => normalizeUsername('   ')).toThrow('Username do streamer não pode ser vazio');
    expect(() => normalizeUsername('@')).toThrow('Username do streamer não pode ser vazio');
    expect(() => normalizeUsername('user name')).toThrow('Username do streamer contém caracteres inválidos');
    expect(() => normalizeUsername('user@name')).toThrow('Username do streamer contém caracteres inválidos');
    expect(() => normalizeUsername('user!#')).toThrow('Username do streamer contém caracteres inválidos');
  });
});

describe('SessionManager - Like Aggregation', () => {
  it('updates total likes by 3 on like delta of 3', async () => {
    const session = new SessionManager({ overlayToken: 'test-token' });
    const events: StreamerSpaceEvent[] = [];
    session.addListener((e) => events.push(e));

    // Initial state
    expect(session.totalLikes).toBe(0);

    // Send like delta of 3
    session.handleLike({
      id: 'like-1',
      username: 'fa_1',
      count: 3,
    });

    expect(session.totalLikes).toBe(3);
    const snapshot = session.getSnapshot();
    expect(snapshot.totalLikes).toBe(3);
    expect(snapshot.likesLabel).toBe('curtidas observadas desde a conexão');

    // Emitted event check
    const likeEvent = events.find((e) => e.type === 'engagement.like');
    expect(likeEvent).toBeDefined();
    if (likeEvent && likeEvent.type === 'engagement.like') {
      expect(likeEvent.data.count).toBe(3);
      expect(likeEvent.data.totalLikes).toBe(3);
      expect(likeEvent.data.label).toBe('curtidas observadas desde a conexão');
    }

    // Send another like delta of 2
    session.handleLike({
      id: 'like-2',
      username: 'fa_2',
      count: 2,
    });
    expect(session.totalLikes).toBe(5);
  });

  it('uses room total likes if reported by connector', async () => {
    const session = new SessionManager();
    session.handleLike({
      id: 'like-total-1',
      count: 10,
      totalLikes: 1500,
    });

    expect(session.totalLikes).toBe(1500);
    expect(session.getSnapshot().likesLabel).toBe('total de curtidas');
  });

  it('maintains monotonic totalLikes and never rolls back if out-of-order frames arrive', async () => {
    const session = new SessionManager();
    session.handleLike({
      id: 'like-total-1',
      count: 10,
      totalLikes: 2000,
    });
    expect(session.totalLikes).toBe(2000);

    // Stale/out-of-order frame reporting lower total
    session.handleLike({
      id: 'like-total-late',
      count: 5,
      totalLikes: 1850,
    });
    expect(session.totalLikes).toBe(2000); // Does not roll back
  });
});

describe('SessionManager - Gift Streak Aggregation', () => {
  it('produces a single final alert of 3 and correct diamond/count totals for streak 1->2->3', async () => {
    const session = new SessionManager({ overlayToken: 'test-token' });
    const events: StreamerSpaceEvent[] = [];
    session.addListener((e) => events.push(e));

    const streakId = 'streak_test_1';
    const giftName = 'Rosa';
    const giftId = 'rose_1';
    const username = 'combo_user';

    // Step 1: Streak count 1 (repeatEnd: false)
    session.handleGift({
      id: 'gift-step-1',
      giftId,
      giftName,
      count: 1,
      repeatCount: 1,
      repeatEnd: false,
      diamondCount: 2, // 2 diamonds per unit
      username,
      groupId: streakId,
    });

    // Step 2: Streak count 2 (repeatEnd: false)
    session.handleGift({
      id: 'gift-step-2',
      giftId,
      giftName,
      count: 1,
      repeatCount: 2,
      repeatEnd: false,
      diamondCount: 2,
      username,
      groupId: streakId,
    });

    // In-progress: Should have 2 gift.update events, but 0 gift.completed
    const updates = events.filter((e) => e.type === 'gift.update');
    const completedBeforeEnd = events.filter((e) => e.type === 'gift.completed');
    expect(updates.length).toBe(2);
    expect(completedBeforeEnd.length).toBe(0);

    const midSnapshot = session.getSnapshot();
    expect(midSnapshot.activeGiftStreak).not.toBeNull();
    expect(midSnapshot.activeGiftStreak?.currentCount).toBe(2);
    expect(midSnapshot.recentGifts.length).toBe(0);

    // Step 3: Streak count 3 finished (repeatEnd: true)
    session.handleGift({
      id: 'gift-step-3',
      giftId,
      giftName,
      count: 1,
      repeatCount: 3,
      repeatEnd: true,
      diamondCount: 2,
      username,
      groupId: streakId,
    });

    // After finish: exactly 1 gift.completed event (the single final alert)
    const finalCompleted = events.filter((e) => e.type === 'gift.completed');
    expect(finalCompleted.length).toBe(1);

    const alertEvent = finalCompleted[0];
    if (alertEvent && alertEvent.type === 'gift.completed') {
      expect(alertEvent.data.count).toBe(3);
      expect(alertEvent.data.giftName).toBe('Rosa');
      expect(alertEvent.data.username).toBe(username);
      // Unit diamonds (2) * 3 = 6 diamonds total
      expect(alertEvent.data.diamondCount).toBe(6);
    }

    const postSnapshot = session.getSnapshot();
    expect(postSnapshot.activeGiftStreak).toBeNull();
    expect(postSnapshot.recentGifts.length).toBe(1);
    expect(postSnapshot.recentGifts[0].data.count).toBe(3);
    expect(postSnapshot.recentGifts[0].data.diamondCount).toBe(6);
  });

  it('triggers immediate alert for single gift without streak', async () => {
    const session = new SessionManager();
    const events: StreamerSpaceEvent[] = [];
    session.addListener((e) => events.push(e));

    session.handleGift({
      id: 'single-gift-1',
      giftId: 'ice_cream',
      giftName: 'Sorvete',
      count: 1,
      repeatCount: 1,
      repeatEnd: true,
      diamondCount: 5,
      username: 'single_fan',
    });

    const completed = events.filter((e) => e.type === 'gift.completed');
    expect(completed.length).toBe(1);
    expect(completed[0].type).toBe('gift.completed');
    if (completed[0].type === 'gift.completed') {
      expect(completed[0].data.count).toBe(1);
      expect(completed[0].data.diamondCount).toBe(5);
    }
  });

  it('expires unconfirmed streak on timeout without adding unconfirmed count to recent gifts', async () => {
    const session = new SessionManager({ streakTimeoutMs: 50 });
    session.handleGift({
      id: 'unconfirmed-gift-1',
      giftId: 'rose',
      giftName: 'Rosa',
      count: 1,
      repeatCount: 1,
      repeatEnd: false,
      username: 'abandoned_streak_user',
    });

    expect(session.getSnapshot().activeGiftStreak).not.toBeNull();

    // Wait for timeout to expire
    await new Promise((r) => setTimeout(r, 70));

    const snapshot = session.getSnapshot();
    expect(snapshot.activeGiftStreak).toBeNull();
    expect(snapshot.recentGifts.length).toBe(0);
  });
});

describe('SessionManager - Deduplication by providerEventId', () => {
  it('ignores duplicate providerEventId for chat, likes, and gifts', () => {
    const session = new SessionManager();
    const events: StreamerSpaceEvent[] = [];
    session.addListener((e) => events.push(e));

    // Chat deduplication
    session.handleChat({
      id: 'chat-dup-1',
      username: 'alice',
      comment: 'Primeira vez',
    });
    session.handleChat({
      id: 'chat-dup-1',
      username: 'alice',
      comment: 'Segunda vez duplicada',
    });

    const chatEvents = events.filter((e) => e.type === 'chat.message');
    expect(chatEvents.length).toBe(1);
    expect(session.getSnapshot().recentChat.length).toBe(1);
    expect(session.getSnapshot().recentChat[0].data.comment).toBe('Primeira vez');

    // Like deduplication
    session.handleLike({
      id: 'like-dup-1',
      count: 5,
    });
    session.handleLike({
      id: 'like-dup-1',
      count: 5,
    });
    expect(session.totalLikes).toBe(5);

    // Gift deduplication
    session.handleGift({
      id: 'gift-dup-1',
      giftId: 'rose',
      giftName: 'Rosa',
      count: 1,
      repeatCount: 1,
      repeatEnd: true,
      username: 'bob',
    });
    session.handleGift({
      id: 'gift-dup-1',
      giftId: 'rose',
      giftName: 'Rosa',
      count: 1,
      repeatCount: 1,
      repeatEnd: true,
      username: 'bob',
    });
    const giftEvents = events.filter((e) => e.type === 'gift.completed');
    expect(giftEvents.length).toBe(1);
    expect(session.getSnapshot().recentGifts.length).toBe(1);
  });

  it('never drops events with protobuf "0", empty string, or undefined msgId', () => {
    const session = new SessionManager();
    expect(session.totalLikes).toBe(0);

    // Like batches from TikTok protobuf often have msgId "0" or unset
    session.handleLike({ id: '0', count: 10 });
    expect(session.totalLikes).toBe(10);

    session.handleLike({ id: '0', count: 15 });
    expect(session.totalLikes).toBe(25);

    session.handleLike({ id: '', count: 5 });
    expect(session.totalLikes).toBe(30);

    session.handleLike({ id: undefined, count: 5 });
    expect(session.totalLikes).toBe(35);
  });
});

describe('SessionManager - Profile Switching & Isolation', () => {
  it('cancels previous connection, rejects stale callbacks, isolates room state, and keeps OBS URL stable', async () => {
    let source1Callbacks: LiveEventSourceCallbacks | null = null;
    let source1Disconnected = false;
    let source2Callbacks: LiveEventSourceCallbacks | null = null;
    let source2Disconnected = false;

    let source1Connected = false;
    const mockSource1: LiveEventSource = {
      get isConnected() { return source1Connected; },
      username: 'streamer_alpha',
      connect: async (_user, cb) => {
        source1Callbacks = cb;
        source1Connected = true;
        cb.onStatusChange('connected', 'Conectado alpha', { roomId: 'room_alpha' });
      },
      disconnect: async () => {
        source1Disconnected = true;
        source1Connected = false;
      },
    };

    let source2Connected = false;
    const mockSource2: LiveEventSource = {
      get isConnected() { return source2Connected; },
      username: 'streamer_beta',
      connect: async (_user, cb) => {
        source2Callbacks = cb;
        source2Connected = true;
        cb.onStatusChange('connected', 'Conectado beta', { roomId: 'room_beta' });
      },
      disconnect: async () => {
        source2Disconnected = true;
        source2Connected = false;
      },
    };

    let callCount = 0;
    const sourceFactory = () => {
      callCount++;
      return callCount === 1 ? mockSource1 : mockSource2;
    };

    const session = new SessionManager({
      overlayToken: 'persistent-token-12345',
      sourceFactory,
    });

    const initialOverlayToken = session.overlayToken;
    expect(initialOverlayToken).toBe('persistent-token-12345');

    // 1. Connect to streamer_alpha
    await session.connect('@streamer_alpha');
    expect(session.targetUsername).toBe('streamer_alpha');
    expect(session.status).toBe('connected');

    session.handleFollow({ username: 'early_fan' });
    (source1Callbacks as LiveEventSourceCallbacks | null)?.onFollowerCount?.(200);
    expect(session.getEngagementWidgets().profileFollowers).toBe(200);
    session.handleFollow({ username: 'later_fan' });
    expect(session.getEngagementWidgets().profileFollowers).toBe(201);

    // Generate room state for alpha
    session.handleLike({ id: 'alpha-like-1', count: 10 });
    session.handleChat({ id: 'alpha-chat-1', username: 'viewer_a', comment: 'Olá Alpha!' });
    session.handleGift({
      id: 'alpha-gift-1',
      giftId: 'rose',
      giftName: 'Rosa',
      count: 1,
      repeatCount: 1,
      repeatEnd: true,
      username: 'fan_a',
    });

    const alphaSnapshot = session.getSnapshot();
    expect(alphaSnapshot.totalLikes).toBe(10);
    expect(alphaSnapshot.recentChat.length).toBe(1);
    expect(alphaSnapshot.recentGifts.length).toBe(1);
    expect(alphaSnapshot.roomId).toBe('room_alpha');

    // 2. Switch to streamer_beta
    await session.connect('streamer_beta');

    // Verification: previous source must be disconnected
    expect(source1Disconnected).toBe(true);

    // Verification: OBS URL / token MUST BE STABLE
    expect(session.overlayToken).toBe(initialOverlayToken);
    expect(session.getSnapshot().overlayToken).toBe(initialOverlayToken);

    // Verification: Room state MUST BE ISOLATED (reset for new room)
    const betaSnapshot = session.getSnapshot();
    expect(betaSnapshot.targetUsername).toBe('streamer_beta');
    expect(betaSnapshot.totalLikes).toBe(0);
    expect(betaSnapshot.recentChat.length).toBe(0);
    expect(betaSnapshot.recentGifts.length).toBe(0);
    expect(betaSnapshot.roomId).toBe('room_beta');
    (source1Callbacks as LiveEventSourceCallbacks | null)?.onFollowerCount?.(999);
    expect(session.getEngagementWidgets().profileFollowers).toBeUndefined();

    // 3. Stale callbacks test: invoke callbacks from old source1
    expect(source1Callbacks).not.toBeNull();
    if (source1Callbacks) {
      // Old source1 sends late like
      (source1Callbacks as LiveEventSourceCallbacks).onLike({ id: 'stale-like', count: 999 });
      // Old source1 sends late chat
      (source1Callbacks as LiveEventSourceCallbacks).onChat({
        id: 'stale-chat',
        username: 'ghost',
        comment: 'Mensagem atrasada fantasma',
      });
      // Old source1 sends late gift
      (source1Callbacks as LiveEventSourceCallbacks).onGift({
        id: 'stale-gift',
        giftId: 'stale',
        giftName: 'Fantasma',
        count: 1,
        repeatCount: 1,
        repeatEnd: true,
        username: 'ghost',
      });
      // Old source1 sends late status
      (source1Callbacks as LiveEventSourceCallbacks).onStatusChange('error', 'Erro do passado');
    }

    // Verify late callbacks were completely rejected
    const isolatedSnapshot = session.getSnapshot();
    expect(isolatedSnapshot.totalLikes).toBe(0); // Like 999 rejected
    expect(isolatedSnapshot.recentChat.length).toBe(0); // Ghost chat rejected
    expect(isolatedSnapshot.recentGifts.length).toBe(0); // Ghost gift rejected
    expect(isolatedSnapshot.status).toBe('connected'); // Old error rejected
    expect(isolatedSnapshot.targetUsername).toBe('streamer_beta');
  });
});

describe('SessionManager - Reconnect / Refresh Snapshot Delivery', () => {
  it('delivers current counts without re-triggering old gift alerts', () => {
    const session = new SessionManager({ overlayToken: 'obs-token-refresh' });

    // Populate session with established counts
    session.handleLike({ id: 'like-10', count: 42 });
    session.handleChat({ id: 'c-1', username: 'user1', comment: 'msg 1' });
    session.handleChat({ id: 'c-2', username: 'user2', comment: 'msg 2' });
    session.handleGift({
      id: 'g-old-1',
      giftId: 'rose',
      giftName: 'Rosa',
      count: 5,
      repeatCount: 5,
      repeatEnd: true,
      diamondCount: 5,
      username: 'generous_fan',
    });

    // When client refreshes or reconnects, it retrieves snapshot
    const snapshot = session.getSnapshot();
    expect(snapshot.totalLikes).toBe(42);
    expect(snapshot.recentChat.length).toBe(2);
    expect(snapshot.recentGifts.length).toBe(1);
    expect(snapshot.recentGifts[0].data.count).toBe(5);
    expect(snapshot.overlayToken).toBe('obs-token-refresh');

    // Verification of snapshot delivery semantics:
    // Snapshot provides current state to catch up without emitting new live gift.completed events
    const newEvents: StreamerSpaceEvent[] = [];
    session.addListener((e) => newEvents.push(e));

    // Getting snapshot does not emit new events
    session.getSnapshot();
    expect(newEvents.length).toBe(0);

    // Only new incoming gifts emit new alert events
    session.handleGift({
      id: 'g-new-2',
      giftId: 'lion',
      giftName: 'Leão',
      count: 1,
      repeatCount: 1,
      repeatEnd: true,
      diamondCount: 1000,
      username: 'big_whale',
    });

    expect(newEvents.length).toBe(1);
    expect(newEvents[0].type).toBe('gift.completed');
    if (newEvents[0].type === 'gift.completed') {
      expect(newEvents[0].data.giftName).toBe('Leão');
    }
  });
});

describe('Engagement widgets', () => {
  it('tracks unique follows, likes by user and completed gifts across the session', async () => {
    const session = new SessionManager({ overlayToken: 'engagement-test' });
    session.handleFollow({ username: ' Alice ' });
    session.handleFollow({ username: 'alice' });
    session.handleLike({ username: 'alice', count: 2, totalLikes: 500 });
    session.handleLike({ username: 'bob', count: 4, id: 'like-bob' });
    session.handleLike({ username: 'bob', count: 4, id: 'like-bob' });
    const gift = { username: 'alice', giftId: 'rose', giftName: 'Rosa', count: 1, groupId: 'combo' };
    session.handleGift({ ...gift, id: 'gift-1', repeatCount: 1, repeatEnd: false });
    expect(session.getEngagementWidgets().gifts).toBe(0);
    session.handleGift({ ...gift, id: 'gift-end', repeatCount: 3, repeatEnd: true });
    session.handleGift({ ...gift, id: 'gift-end', repeatCount: 3, repeatEnd: true });
    expect(session.getEngagementWidgets()).toEqual({
      followers: 1,
      profileFollowers: undefined,
      gifts: 3,
      topLikers: [{ username: 'bob', count: 4 }, { username: 'alice', count: 2 }],
      topGifters: [{ username: 'alice', count: 3 }],
    });
    await session.connect('simulador', { isSimulated: true });
    expect(session.getEngagementWidgets()).toEqual({ followers: 0, profileFollowers: undefined, gifts: 0, topLikers: [], topGifters: [] });
    await session.disconnect();
  });
});
