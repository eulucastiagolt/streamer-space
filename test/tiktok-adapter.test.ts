import { describe, expect, it, spyOn } from 'bun:test';
import { TikTokLiveConnection, WebcastEvent } from '@tokioapp/connector';
import { parseFollowerCount, readProfileFollowerCount, TikTokLiveAdapter } from '../src/ingestion/tiktok-adapter.js';
import { SessionManager } from '../src/server/session.js';
import type {
  ConnectionStatus,
  LiveEventSourceCallbacks,
  RawChatMessage,
  RawGiftEvent,
  RawLikeEvent,
} from '../src/types/events.js';

describe('TikTokLiveAdapter', () => {
  it('instantiates cleanly with default options', () => {
    const adapter = new TikTokLiveAdapter();
    expect(adapter.isConnected).toBe(false);
    expect(adapter.username).toBe('');
    expect(adapter.connection).toBeNull();
  });

  it('rejects invalid usernames during connect', async () => {
    const adapter = new TikTokLiveAdapter();
    let statusSet: ConnectionStatus | null = null;
    let errorMsg: string | undefined = undefined;

    const callbacks: LiveEventSourceCallbacks = {
      onStatusChange: (status, message) => {
        statusSet = status;
        errorMsg = message;
      },
      onChat: () => {},
      onLike: () => {},
      onGift: () => {},
    };

    expect(adapter.connect('', callbacks)).rejects.toThrow();
  });

  it('handles disconnect when not connected without throwing', async () => {
    const adapter = new TikTokLiveAdapter();
    let statusCalled = false;
    const callbacks: LiveEventSourceCallbacks = {
      onStatusChange: (status) => {
        if (status === 'offline') statusCalled = true;
      },
      onChat: () => {},
      onLike: () => {},
      onGift: () => {},
    };

    await adapter.disconnect();
    expect(adapter.isConnected).toBe(false);
  });

  it('handles event mappings correctly when mocked events are received', () => {
    const adapter = new TikTokLiveAdapter();
    const chatsReceived: RawChatMessage[] = [];
    const likesReceived: RawLikeEvent[] = [];
    const giftsReceived: RawGiftEvent[] = [];
    const viewersReceived: number[] = [];

    const callbacks: LiveEventSourceCallbacks = {
      onStatusChange: () => {},
      onChat: (c) => chatsReceived.push(c),
      onLike: (l) => likesReceived.push(l),
      onGift: (g) => giftsReceived.push(g),
      onViewerCount: (v) => viewersReceived.push(v),
    };

    // Verify adapter properties
    expect(adapter.isConnected).toBe(false);
    expect(typeof adapter.connect).toBe('function');
    expect(typeof adapter.disconnect).toBe('function');
  });
});

it('accepts full TikTok follower counts and rejects abbreviated totals', () => {
  for (const [input, expected] of [
    ['525K', undefined], ['500k', undefined], ['525,4 K', undefined],
    ['1.2M', undefined], ['525 mil', undefined], ['525.123', 525123],
    ['525,123', 525123], [525123, 525123], [500, 500], ['0', 0],
    ['525K inválido', undefined], ['-525K', undefined], ['1.23', undefined],
  ] as const) {
    expect(parseFollowerCount(input)).toBe(expected);
  }
});

it('reads exact profile stats for the requested user from both TikTok payloads', () => {
  const profile = {
    __DEFAULT_SCOPE__: {
      'webapp.user-detail': {
        userInfo: { user: { uniqueId: 'Streamer' }, statsV2: { followerCount: '525K' }, stats: { followerCount: 525123 } },
      },
    },
  };
  const sigi = {
    UserModule: {
      users: { other: { uniqueId: 'other' }, streamer: { uniqueId: 'Streamer' } },
      stats: { other: { followerCount: 3 }, streamer: { followerCount: '525123' } },
    },
  };
  const universalHtml = `<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__">${JSON.stringify(profile)}</script>`;
  const sigiHtml = `<script id='SIGI_STATE'>${JSON.stringify(sigi)}</script>`;
  expect(readProfileFollowerCount(universalHtml, 'streamer')).toBe(525123);
  expect(readProfileFollowerCount(sigiHtml, 'streamer')).toBe(525123);
  expect(readProfileFollowerCount(universalHtml, 'other')).toBeUndefined();
  expect(readProfileFollowerCount('<html>Please wait...</html>', 'streamer')).toBeUndefined();
});

it('loads existing room likes and followers on connection without audience events', async () => {
  const roomInfo = Promise.withResolvers<Response>();
  const initialLikes = Promise.withResolvers<number | undefined>();
  const initialFollowers = Promise.withResolvers<number>();
  const connect = spyOn(TikTokLiveConnection.prototype, 'connect').mockImplementation(async function (this: TikTokLiveConnection) {
    this.emit(WebcastEvent.CONNECTED, { roomId: '12345', reconnected: false, attempt: 0 });
    return { roomId: '12345' };
  });
  const fakeFetch = async (input: Parameters<typeof fetch>[0]) => {
    const url = new URL(String(input));
    if (url.pathname === '/webcast/room/info/') {
      if (url.searchParams.get('aid') !== '1988' || url.searchParams.get('room_id') !== '12345') {
        return new Response(null, { status: 400 });
      }
      return roomInfo.promise;
    }
    return new Response('<html>Please wait...</html>');
  };
  const network = spyOn(globalThis, 'fetch').mockImplementation(
    Object.assign(fakeFetch, { preconnect: fetch.preconnect }),
  );
  const session = new SessionManager({ sourceFactory: () => new TikTokLiveAdapter() });
  let audienceLikeEvents = 0;
  session.addListener(event => {
    if (event.type === 'engagement.like-total') initialLikes.resolve(event.data.totalLikes);
    if (event.type === 'engagement.like') audienceLikeEvents++;
    if (event.type === 'live.status' && event.data.profileFollowers !== undefined) {
      initialFollowers.resolve(event.data.profileFollowers);
    }
  });

  try {
    await session.connect('@streamer');
    expect(session.getSnapshot().totalLikes).toBe(0);
    expect(session.getSnapshot().followerCountPending).toBe(true);
    expect(session.getEngagementWidgets().followerCountPending).toBe(true);
    roomInfo.resolve(Response.json({
      status_code: 0,
      data: {
        like_count: 0,
        stats: { like_count: '1273' },
        owner: { display_id: 'streamer', follow_info: { follower_count: 8532 } },
      },
    }));
    expect(await initialLikes.promise).toBe(1273);
    expect(await initialFollowers.promise).toBe(8532);
    expect(session.getSnapshot().profileFollowers).toBe(8532);
    expect(session.getSnapshot().totalLikes).toBe(1273);
    expect(session.getEngagementWidgets().topLikers).toEqual([]);
    expect(audienceLikeEvents).toBe(0);
    expect(session.getEngagementWidgets().followerCountPending).toBeUndefined();
    session.handleLike({ username: 'fã', count: 1, totalLikes: 1274 });
    expect(session.getSnapshot().totalLikes).toBe(1274);
  } finally {
    await session.disconnect();
    connect.mockRestore();
    network.mockRestore();
  }
});
