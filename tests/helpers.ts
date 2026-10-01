import { createInitialState, currentOrder, reducer, type Action } from "../src/game/reducer.ts";
import type { GameState, Order } from "../src/game/types.ts";
import type { InputKey } from "../src/lib/answerInput.ts";

export const NOW = "2026-10-01T00:00:00.000Z";

export function run(state: GameState, ...actions: Action[]): GameState {
  return actions.reduce(reducer, state);
}

export function order(state: GameState): Order {
  const o = currentOrder(state);
  if (!o) throw new Error("현재 주문 없음");
  return o;
}

export function type(state: GameState, text: string): GameState {
  let s = reducer(state, { type: "INPUT_KEY", key: "clear" });
  for (const ch of text) s = reducer(s, { type: "INPUT_KEY", key: ch as InputKey });
  return s;
}

export function submit(state: GameState, text: string): GameState {
  return reducer(type(state, text), { type: "SUBMIT_ANSWER", now: NOW });
}

/** 게임 시작 → 첫 손님 주문 받기 */
export function startBrewing(seed = 42): GameState {
  return run(createInitialState(), { type: "START", seed }, { type: "ACCEPT_ORDER" });
}

/** 현재 주문을 받아서(필요하면) 모든 재료를 정답으로 넣고 완성·전달까지 */
export function serveCurrent(state: GameState, opts: { wrongFirst?: boolean; hint?: boolean } = {}): GameState {
  let s = state;
  if (order(s).status === "arrived") s = reducer(s, { type: "ACCEPT_ORDER" });
  for (let i = 0; i < order(s).tasks.length; i++) {
    if (opts.hint) s = reducer(s, { type: "REQUEST_HINT" });
    if (opts.wrongFirst) s = submit(s, "99");
    s = submit(s, order(s).tasks[s.selectedTask].problem.answer);
  }
  s = run(s, { type: "COMPLETE_POTION" }, { type: "GO_COUNTER" }, { type: "DELIVER", orderId: order(s).id });
  return s;
}

export function memoryStorage() {
  const mem = new Map<string, string>();
  return {
    mem,
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
  };
}

/** 저장 → 새로고침(불러오기)과 같은 효과: JSON 왕복 */
export function roundTrip(state: GameState): GameState {
  return JSON.parse(JSON.stringify(state)) as GameState;
}
