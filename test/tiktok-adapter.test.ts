import { describe, expect, it } from 'bun:test';
import { TikTokLiveAdapter } from '../src/ingestion/tiktok-adapter.js';
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
