/**
 * 문제 덱: 가능한 주문 조합을 섞어 차례로 낸다.
 * - 남은 조합이 있으면 최근에 낸 것과 같은 문제를 다시 내지 않는다.
 * - 모두 쓰면 다시 섞어서 재사용하되, 방금 낸 문제가 바로 이어지지 않게 한다.
 */
import { shuffle, type Rng } from "./rng.ts";

export interface DeckState {
  remaining: string[];
  lastDrawn: string | null;
}

export const EMPTY_DECK: DeckState = { remaining: [], lastDrawn: null };

export function drawFromDeck(
  deck: DeckState,
  allKeys: readonly string[],
  rng: Rng,
): { key: string; deck: DeckState } {
  if (allKeys.length === 0) throw new Error("출제할 수 있는 문제 조합이 없습니다.");
  const valid = new Set(allKeys);
  // 설정이 바뀌어 더 이상 허용되지 않는 조합은 버린다
  let remaining = deck.remaining.filter((k) => valid.has(k));
  if (remaining.length === 0) {
    remaining = shuffle(allKeys, rng);
    if (remaining.length > 1 && remaining[0] === deck.lastDrawn) {
      remaining.push(remaining.shift() as string);
    }
  }
  const [key, ...rest] = remaining;
  return { key, deck: { remaining: rest, lastDrawn: key } };
}
