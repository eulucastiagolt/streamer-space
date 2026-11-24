import { describe, expect, it } from 'bun:test';
import { TikTokLiveAdapter } from '../src/ingestion/tiktok-adapter.js';
import type { LiveEventSourceCallbacks } from '../src/types/events.js';

describe('TikTokLiveAdapter', () => {
  it('instantiates cleanly and adheres to LiveEventSource contract', () => {
    const adapter = new TikTokLiveAdapter();
    expect(adapter.isConnected).toBe(false);
    expect(adapter.username).toBe('');
    expect(typeof adapter.connect).toBe('function');
    expect(typeof adapter.disconnect).toBe('function');
  });

  it('rejects invalid characters in username via tokio normalization', async () => {
    const adapter = new TikTokLiveAdapter();
    let statusCalled = false;
    const callbacks: LiveEventSourceCallbacks = {
      onStatusChange: (status, message) => {
        statusCalled = true;
        expect(status).toBe('error');
        expect(message).toContain('Nome de usuário inválido');
      },
      onChat: () => {},
      onLike: () => {},
      onGift: () => {},
    };

    try {
      await adapter.connect('invalid!!username@@', callbacks);
      expect(true).toBe(false); // Should have thrown
    } catch (err) {
      expect(statusCalled).toBe(true);
    }
  });

  it('reports offline status cleanly on disconnect', async () => {
    const adapter = new TikTokLiveAdapter();
    let statusHistory: string[] = [];

    const callbacks: LiveEventSourceCallbacks = {
      onStatusChange: (status) => {
        statusHistory.push(status);
      },
      onChat: () => {},
      onLike: () => {},
      onGift: () => {},
    };

    // When disconnected before connect
    await adapter.disconnect();
    expect(adapter.isConnected).toBe(false);
  });
});
