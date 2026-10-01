import { createInitialState, currentOrder, reducer, type Action } from "../src/game/reducer.ts";
import type { GameState, IngredientTask, Order, ShiftChoice } from "../src/game/types.ts";
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

export function correctAnswer(t: IngredientTask): string {
  return t.mode === "concept" && t.concept ? t.concept.correct : t.problem.answer;
}

/** 정답이 아닌 유효한 답 */
export function wrongAnswer(t: IngredientTask): string {
  if (t.mode === "concept" && t.concept) return (["x10", "same", "d10"] as ShiftChoice[]).find((c) => c !== t.concept!.correct)!;
  return t.problem.answer === "99" ? "98" : "99";
}

/** 현재 계량 패널의 과제에 답 내기 (비교 문제면 선택) */
export function answerActive(state: GameState, value: string): GameState {
  const t = order(state).tasks[state.activeTask!];
  if (t.mode === "concept") return reducer(state, { type: "SUBMIT_CHOICE", choice: value as ShiftChoice, now: NOW });
  return submit(state, value);
}

/** 게임 시작 → 새 유형 소개 확인 → 첫 손님 주문 받기 */
export function startBrewing(seed = 42): GameState {
  let s = run(createInitialState(), { type: "START", seed });
  s = reducer(s, { type: "ACK_INTRO", dayNumber: s.day!.dayNumber });
  return reducer(s, { type: "ACCEPT_ORDER", orderId: order(s).id });
}

export interface ServeOptions {
  /** 틀리게 낼 과제 번호 */
  wrong?: number[];
  hint?: boolean;
  viewExplanation?: boolean;
  /** Phase 2 규칙 하루: 먼저 틀렸다가 고치기 */
  legacyWrongFirst?: boolean;
}

/** 현재 손님 주문을 받아서 재료 2종 계량·투입 → 젓기 → 병에 담기 → 전달까지 */
export function serveCurrent(state: GameState, opts: ServeOptions = {}): GameState {
  let s = state;
  if (!s.day!.introSeen) s = reducer(s, { type: "ACK_INTRO", dayNumber: s.day!.dayNumber });
  if (order(s).status === "arrived") s = reducer(s, { type: "ACCEPT_ORDER", orderId: order(s).id });
  const o = order(s);
  for (let i = 0; i < o.tasks.length; i++) {
    if (order(s).tasks[i].status === "done") continue;
    if (s.activeTask === null) s = reducer(s, { type: "PLACE_INGREDIENT", orderId: o.id, taskIndex: i });
    if (opts.hint) s = reducer(s, { type: "REQUEST_HINT" });
    const t = order(s).tasks[i];
    if (o.rules === 2) {
      if (opts.legacyWrongFirst) s = submit(s, "99");
      s = submit(s, t.problem.answer);
    } else {
      s = answerActive(s, opts.wrong?.includes(i) ? wrongAnswer(t) : correctAnswer(t));
      if (opts.viewExplanation) s = reducer(s, { type: "VIEW_EXPLANATION" });
    }
    s = reducer(s, { type: "ADD_TO_CAULDRON", orderId: o.id, taskIndex: i });
  }
  for (let k = 0; k < 4; k++) s = reducer(s, { type: "STIR", orderId: o.id, amount: 25 });
  s = run(s, { type: "COMPLETE_POTION", orderId: o.id }, { type: "GO_COUNTER" }, { type: "DELIVER", orderId: o.id, now: NOW });
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

export function roundTrip<T>(state: T): T {
  return JSON.parse(JSON.stringify(state)) as T;
}

/** 하루를 끝까지 (손님 5명) */
export function playFullDay(start: GameState, opts: (i: number) => ServeOptions = () => ({})): GameState {
  let s = start;
  for (let i = 0; i < 5; i++) {
    s = serveCurrent(s, opts(i));
    if (i < 4) s = reducer(s, { type: "NEXT_CUSTOMER", fromOrderId: order(s).id });
  }
  return s;
}

/** 하루를 마감하고 다음 날을 연다 */
export function closeAndNext(s: GameState, seed: number): GameState {
  const d = s.day!.dayNumber;
  return run(s, { type: "CLOSE_DAY", dayNumber: d, now: NOW }, { type: "NEXT_DAY", fromDay: d, seed });
}
