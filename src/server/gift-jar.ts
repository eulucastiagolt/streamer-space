import type { BaseEvent, GiftCompletedData } from '../types/events.js';

export interface RankedViewer {
  username: string;
  displayName?: string;
  avatarUrl?: string;
  count: number;
}

export function addViewerScore(
  ranking: Map<string, RankedViewer>,
  viewer: { username?: string; displayName?: string; avatarUrl?: string },
  score: number,
): void {
  const username = viewer.username?.trim().toLowerCase();
  if (!username || score <= 0) return;
  const previous = ranking.get(username);
  const displayName = viewer.displayName ?? previous?.displayName;
  const avatarUrl = viewer.avatarUrl ?? previous?.avatarUrl;
  ranking.set(username, {
    username,
    count: (previous?.count ?? 0) + score,
    ...(displayName ? { displayName } : {}),
    ...(avatarUrl ? { avatarUrl } : {}),
  });
}

export function rankViewers(ranking: Map<string, RankedViewer>): RankedViewer[] {
  return Array.from(ranking.values())
    .sort((a, b) => b.count - a.count || a.username.localeCompare(b.username))
    .slice(0, 10);
}

interface GiftBucket {
  count: number;
  coins: number;
  unitCoins?: number;
  latest: BaseEvent<'gift.completed', GiftCompletedData>;
  ranking: Map<string, RankedViewer>;
}

export class GiftJar {
  private readonly gifts = new Map<string, GiftBucket>();

  clear(): void {
    this.gifts.clear();
  }

  add(event: BaseEvent<'gift.completed', GiftCompletedData>, unitCoins?: number): void {
    const gift = event.data;
    const key = JSON.stringify([gift.giftId, unitCoins]);
    const bucket = this.gifts.get(key) ?? {
      latest: event, unitCoins, count: 0, coins: 0, ranking: new Map<string, RankedViewer>(),
    };
    bucket.latest = event;
    bucket.count += gift.count;
    bucket.coins += gift.diamondCount ?? 0;
    addViewerScore(bucket.ranking, gift, gift.diamondCount ?? 0);
    this.gifts.set(key, bucket);
  }

  snapshot(filters: URLSearchParams) {
    const selected = new Set((filters.get('giftIds') ?? '').toLowerCase()
      .split(',').map(value => value.trim()).filter(Boolean));
    const minCoins = Math.max(1, Number(filters.get('minCoins')) || 1);
    const mode = filters.get('giftFilter');
    let count = 0;
    let coins = 0;
    const gifts = [];
    const ranking = new Map<string, RankedViewer>();
    let latest: BaseEvent<'gift.completed', GiftCompletedData> | undefined;

    for (const bucket of this.gifts.values()) {
      const gift = bucket.latest.data;
      if (mode === 'selected' && !selected.has(String(gift.giftId).toLowerCase()) &&
          !selected.has(gift.giftName.toLowerCase())) continue;
      if (mode === 'minimum' && (bucket.unitCoins ?? 0) < minCoins) continue;
      count += bucket.count;
      coins += bucket.coins;
      gifts.push({ id: gift.giftId, name: gift.giftName, image: gift.giftPictureUrl, count: bucket.count });
      for (const viewer of bucket.ranking.values()) addViewerScore(ranking, viewer, viewer.count);
      if (!latest || bucket.latest.sequence > latest.sequence) latest = bucket.latest;
    }
    return { count, coins, gifts, ranking: rankViewers(ranking), latest };
  }
}
