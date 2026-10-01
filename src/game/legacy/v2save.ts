/* 이 파일은 Phase 2(저장 버전 2) 코드를 그대로 보존한 것이다. 이전 저장을 검증·마이그레이션할 때만 쓴다. 수정하지 말 것. */
import { LEARNING_TYPES } from "../../data/learningTypes.ts";
import { multiplyStrings, isDecimalString } from "../../lib/decimal.ts";
import { EMPTY_DECK, type DeckState } from "../../lib/deck.ts";
import { createRng } from "../../lib/rng.ts";
import { LEGACY_CUSTOMERS, LEGACY_RECIPES } from "./v2data.ts";
import { legacyCreateDayOrders } from "./v2orders.ts";
import {
  CUSTOMERS_PER_DAY,
  type AttemptRecord,
  type DayState,
  type GameState,
  type Order,
} from "./v2types.ts";

const MAX_HINT_LEVEL = 3;

type Obj = Record<string, unknown>;
const isObject = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const isInt = (v: unknown, min = -Infinity, max = Infinity): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
const isStr = (v: unknown): v is string => typeof v === "string";
const isStrArray = (v: unknown): v is string[] => Array.isArray(v) && v.every(isStr);

const SCENES = ["title", "counter", "workbench", "closing"];
const ORDER_STATUSES = ["queued", "arrived", "brewing", "bottled", "paid"];

function orderNumber(id: string): number | null {
  const m = /^order-(\d+)$/.exec(id);
  return m ? Number(m[1]) : null;
}

/* ------------------------------------------------------------------ */
/* 검증                                                                */
/* ------------------------------------------------------------------ */

/** 주문 하나의 형식과 레시피 일관성. 레시피 기본량이 바뀐 주문(조작)도 걸러 낸다 */
export function validateV2Order(o: unknown, where: string): string[] {
  const e: string[] = [];
  if (!isObject(o)) return [`${where}: 주문 형식이 아닙니다.`];
  if (!isStr(o.id) || orderNumber(o.id) === null) e.push(`${where}: 주문 ID가 올바르지 않습니다.`);
  if (o.kind !== "multiBottle") e.push(`${where}: 지원하지 않는 주문 유형입니다.`);
  if (!ORDER_STATUSES.includes(o.status as string)) e.push(`${where}: 주문 상태가 올바르지 않습니다.`);
  const recipe = isStr(o.recipeId) ? LEGACY_RECIPES[o.recipeId] : undefined;
  if (!recipe) e.push(`${where}: 알 수 없는 레시피(${String(o.recipeId)})입니다.`);
  if (!isStr(o.customerId) || !LEGACY_CUSTOMERS[o.customerId]) e.push(`${where}: 알 수 없는 손님(${String(o.customerId)})입니다.`);
  if (!isInt(o.bottles, 2, 99)) e.push(`${where}: 병 수가 올바르지 않습니다.`);
  if (!isObject(o.lines) || !["greet", "order", "waiting", "thanks"].every((k) => isStr((o.lines as Obj)[k]))) {
    e.push(`${where}: 손님 대사 정보가 없습니다.`);
  }
  if (!Array.isArray(o.autoAdditions)) e.push(`${where}: 자동 투입 정보가 없습니다.`);
  if (!Array.isArray(o.tasks)) return [...e, `${where}: 재료 과제 목록이 없습니다.`];
  if (!recipe || e.length) return e;

  if (o.price !== recipe.pricePerBottle * (o.bottles as number)) e.push(`${where}: 판매가가 레시피 가격과 맞지 않습니다.`);
  if (o.tasks.length !== recipe.additives.length) return [...e, `${where}: 재료 수가 레시피와 다릅니다.`];
  o.tasks.forEach((t, i) => {
    const w = `${where} 재료 ${i + 1}`;
    const ad = recipe.additives[i];
    if (!isObject(t) || !isObject(t.problem)) { e.push(`${w}: 형식이 올바르지 않습니다.`); return; }
    const p = t.problem;
    if (t.ingredientId !== ad.ingredientId) e.push(`${w}: 레시피의 재료와 다릅니다.`);
    if (p.a !== ad.amount) e.push(`${w}: 1병당 양이 레시피(${ad.amount})와 다릅니다.`);
    if (p.b !== String(o.bottles)) e.push(`${w}: 병 수와 문제가 맞지 않습니다.`);
    if (!isStr(p.answer) || !isDecimalString(p.answer) || !isStr(p.a) || !isDecimalString(p.a) || p.answer !== multiplyStrings(p.a, String(o.bottles))) {
      e.push(`${w}: 정답이 계산과 맞지 않습니다.`);
    }
    if (!isStr(p.learningType) || !(p.learningType in LEARNING_TYPES)) e.push(`${w}: 학습 유형이 올바르지 않습니다.`);
    if (t.status !== "pending" && t.status !== "done") e.push(`${w}: 진행 상태가 올바르지 않습니다.`);
    if (!isInt(t.attempts, 0) || !isInt(t.hintLevel, 0, MAX_HINT_LEVEL)) e.push(`${w}: 시도·힌트 기록이 올바르지 않습니다.`);
    if (t.status === "done" && (t.attempts as number) < 1) e.push(`${w}: 완료했는데 시도 기록이 없습니다.`);
    if (t.attempts === 0 && (t.firstAnswer !== null || t.firstCorrect !== null)) e.push(`${w}: 시도 기록이 서로 맞지 않습니다.`);
    if (isInt(t.attempts, 1) && (!isStr(t.firstAnswer) || typeof t.firstCorrect !== "boolean")) e.push(`${w}: 첫 답 기록이 없습니다.`);
  });
  return e;
}

function validateRecord(r: unknown, i: number): string[] {
  const w = `학습 기록 ${i + 1}`;
  if (!isObject(r)) return [`${w}: 형식이 올바르지 않습니다.`];
  const ok =
    isStr(r.problemId) && isInt(r.dayNumber, 0) && isInt(r.customerNumber, 0, CUSTOMERS_PER_DAY) &&
    isStr(r.orderId) && isStr(r.ingredientId) && isStr(r.learningType) && r.learningType in LEARNING_TYPES &&
    isStr(r.a) && isStr(r.b) && isStr(r.answer) && (r.firstAnswer === null || isStr(r.firstAnswer)) &&
    (r.firstCorrect === null || typeof r.firstCorrect === "boolean") && isInt(r.attempts, 0) &&
    isInt(r.hintLevel, 0, MAX_HINT_LEVEL) && typeof r.solved === "boolean" && isStr(r.solvedAt);
  return ok ? [] : [`${w}: 필수 값이 빠졌거나 형식이 다릅니다.`];
}

const SUMMARY_NUMBERS = [
  "dayNumber", "customersServed", "bottlesSold", "moneyEarned", "moneyAfter",
  "totalProblems", "firstTryCorrect", "correctedAfterWrong", "hintUsed",
] as const;

function validateDay(day: unknown, state: Obj, errors: string[]): void {
  if (!isObject(day)) { errors.push("영업 정보(day) 형식이 올바르지 않습니다."); return; }
  if (!isInt(day.dayNumber, 1)) errors.push("영업 일차가 올바르지 않습니다.");
  if (day.status !== "open" && day.status !== "closed") errors.push("영업 상태가 올바르지 않습니다.");
  if (!isInt(day.moneyEarned, 0)) errors.push("오늘 판매금이 올바르지 않습니다.");
  if (!Array.isArray(day.orders) || day.orders.length !== CUSTOMERS_PER_DAY) {
    errors.push(`오늘의 주문은 ${CUSTOMERS_PER_DAY}건이어야 합니다.`);
    return;
  }
  if (!isInt(day.currentIndex, 0, CUSTOMERS_PER_DAY - 1)) { errors.push("현재 손님 순서가 올바르지 않습니다."); return; }
  const before = errors.length;
  day.orders.forEach((o, i) => errors.push(...validateV2Order(o, `${i + 1}번째 손님 주문`)));
  if (errors.length > before) return;

  const orders = day.orders as Order[];
  const cur = day.currentIndex;
  const ids = new Set(orders.map((o) => o.id));
  if (ids.size !== orders.length) errors.push("주문 ID가 중복됩니다.");
  const paidIds = new Set(state.paidOrderIds as string[]);
  let paidSum = 0;
  orders.forEach((o, i) => {
    const w = `${i + 1}번째 손님 주문`;
    if (i < cur && o.status !== "paid") errors.push(`${w}: 이미 지나간 손님인데 판매가 끝나지 않았습니다.`);
    if (i === cur && o.status === "queued") errors.push(`${w}: 현재 손님이 창구에 없습니다.`);
    if (i > cur && o.status !== "queued") errors.push(`${w}: 아직 오지 않은 손님의 상태가 올바르지 않습니다.`);
    const untouched = o.tasks.every((t) => t.status === "pending" && t.attempts === 0 && t.hintLevel === 0);
    if ((o.status === "queued" || o.status === "arrived") && !untouched) errors.push(`${w}: 주문을 받기 전인데 제조 기록이 있습니다.`);
    if ((o.status === "bottled" || o.status === "paid") && !o.tasks.every((t) => t.status === "done")) {
      errors.push(`${w}: 모든 재료가 준비되지 않았는데 완성 상태입니다.`);
    }
    if (o.status === "paid") {
      paidSum += o.price;
      if (!paidIds.has(o.id)) errors.push(`${w}: 판매금 지급 기록이 없습니다.`);
    } else if (paidIds.has(o.id)) {
      errors.push(`${w}: 판매하지 않은 주문에 지급 기록이 있습니다.`);
    }
    const n = orderNumber(o.id) as number;
    if (!isInt(state.nextOrderNumber) || n >= (state.nextOrderNumber as number)) errors.push(`${w}: 주문 번호가 다음 주문 번호보다 큽니다.`);
  });
  if (paidSum !== day.moneyEarned) errors.push("오늘 판매금이 판매한 주문의 합과 다릅니다.");

  const current = orders[cur];
  if (day.status === "closed") {
    if (cur !== CUSTOMERS_PER_DAY - 1 || !orders.every((o) => o.status === "paid")) errors.push("마감했는데 판매하지 않은 주문이 있습니다.");
    if (state.scene !== "closing" && state.scene !== "title") errors.push("마감한 날의 화면 상태가 올바르지 않습니다.");
    const hist = state.dayHistory as Obj[];
    if (Array.isArray(hist) && !hist.some((h) => isObject(h) && h.dayNumber === day.dayNumber)) {
      errors.push("마감한 날의 영업 결과가 없습니다.");
    }
  } else {
    if (state.scene === "closing") errors.push("영업 중인데 마감 화면 상태입니다.");
    if (state.scene === "workbench" && current.status !== "brewing" && current.status !== "bottled") {
      errors.push("제조대 화면인데 제조 중인 주문이 없습니다.");
    }
  }
  if (!isInt(state.selectedTask, 0, current.tasks.length - 1)) errors.push("선택한 재료 번호가 올바르지 않습니다.");
}

/** 버전 2 저장 데이터 전체 검증 */
export function validateV2State(data: unknown): { ok: true; state: GameState } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (!isObject(data)) return { ok: false, errors: ["저장 데이터가 객체 형식이 아닙니다."] };
  if (data.saveVersion !== 2) return { ok: false, errors: ["저장 버전이 2가 아닙니다."] };
  if (!isInt(data.money, 0)) errors.push("소지금이 올바르지 않습니다.");
  if (!isInt(data.nextOrderNumber, 1)) errors.push("다음 주문 번호가 올바르지 않습니다.");
  if (!SCENES.includes(data.scene as string)) errors.push("화면 상태가 올바르지 않습니다.");
  const deck = data.deck;
  if (!isObject(deck) || !isStrArray(deck.remaining) || !(deck.lastDrawn === null || isStr(deck.lastDrawn))) {
    errors.push("문제 덱 정보가 올바르지 않습니다.");
  }
  if (!isStr(data.draftAnswer) || !/^[0-9.]{0,8}$/.test(data.draftAnswer)) errors.push("입력 중인 답이 올바르지 않습니다.");
  if (!(data.feedback === null || (isObject(data.feedback) && isStr(data.feedback.kind) && isStr(data.feedback.title) && isStrArray(data.feedback.lines)))) {
    errors.push("안내 메시지 정보가 올바르지 않습니다.");
  }
  if (!(data.pour === null || (isObject(data.pour) && isInt(data.pour.seq, 0)))) errors.push("계량 연출 정보가 올바르지 않습니다.");
  if (!isObject(data.stats) || !["ordersCompleted", "potionsSold", "problemsSolved"].every((k) => isInt((data.stats as Obj)[k], 0))) {
    errors.push("누적 통계가 올바르지 않습니다.");
  }
  if (!isStrArray(data.paidOrderIds)) errors.push("판매금 지급 기록이 올바르지 않습니다.");
  if (!Array.isArray(data.records)) errors.push("학습 기록이 목록이 아닙니다.");
  else data.records.forEach((r, i) => errors.push(...validateRecord(r, i)));
  if (!Array.isArray(data.dayHistory)) errors.push("지난 영업 결과가 목록이 아닙니다.");
  else {
    data.dayHistory.forEach((h, i) => {
      if (!isObject(h) || !SUMMARY_NUMBERS.every((k) => isInt(h[k], 0)) || !isStr(h.closedAt)) {
        errors.push(`지난 영업 결과 ${i + 1}: 형식이 올바르지 않습니다.`);
      }
    });
    const days = (data.dayHistory as Obj[]).map((h) => (isObject(h) ? h.dayNumber : null));
    if (new Set(days).size !== days.length) errors.push("지난 영업 결과에 같은 일차가 두 번 있습니다.");
  }
  if (errors.length) return { ok: false, errors };

  if (data.day === null) {
    if (data.scene !== "title") errors.push("영업을 시작하지 않았는데 게임 화면 상태입니다.");
  } else {
    validateDay(data.day, data, errors);
  }
  return errors.length ? { ok: false, errors } : { ok: true, state: data as unknown as GameState };
}

/* ------------------------------------------------------------------ */
/* Phase 1 → Phase 2 마이그레이션                                       */
/* ------------------------------------------------------------------ */

/**
 * 버전 1 → 2
 * - 소지금, 누적 통계, 판매금 지급 기록, 다음 주문 번호, 문제 덱: 그대로 보존
 * - 학습 기록: 모두 보존. 문제 ID를 붙이고, 하루 개념이 없던 기록은 일차 0(=Phase 1 기록)으로 표시
 * - 진행 중인 주문(아직 판매 전): 1일차의 첫 번째 손님으로 이어서 진행 (완료한 재료·입력 중인 답 유지)
 *   나머지 손님 4명은 새로 준비
 * - 진행 중인 주문이 없으면(판매 완료 후 등) 영업은 '가게 문 열기'에서 1일차로 시작
 * - 화면은 타이틀에서 시작
 */
export function migrateV1toV2(data: unknown, seed: number): { ok: true; state: GameState } | { ok: false; errors: string[] } {
  if (!isObject(data) || data.saveVersion !== 1) return { ok: false, errors: ["Phase 1 저장 형식이 아닙니다."] };
  const errors: string[] = [];
  if (!isInt(data.money, 0)) errors.push("소지금이 올바르지 않습니다.");
  if (!isInt(data.nextOrderNumber, 1)) errors.push("다음 주문 번호가 올바르지 않습니다.");
  if (!Array.isArray(data.records)) errors.push("학습 기록이 목록이 아닙니다.");
  if (errors.length) return { ok: false, errors };

  const paidOrderIds = isStrArray(data.paidOrderIds) ? data.paidOrderIds : [];
  const stats = isObject(data.stats) && ["ordersCompleted", "potionsSold", "problemsSolved"].every((k) => isInt((data.stats as Obj)[k], 0))
    ? (data.stats as GameState["stats"])
    : { ordersCompleted: 0, potionsSold: 0, problemsSolved: 0 };
  const deck: DeckState = isObject(data.deck) && isStrArray(data.deck.remaining) && (data.deck.lastDrawn === null || isStr(data.deck.lastDrawn))
    ? { remaining: data.deck.remaining, lastDrawn: data.deck.lastDrawn as string | null }
    : EMPTY_DECK;

  // 진행 중인 주문을 이어갈 수 있는가
  const v1Order = data.order;
  const carry =
    isObject(v1Order) && v1Order.status !== "paid" && validateV2Order(v1Order, "진행 중 주문").length === 0 &&
    !paidOrderIds.includes(v1Order.id as string)
      ? (v1Order as unknown as Order)
      : null;

  const records: AttemptRecord[] = (data.records as unknown[])
    .filter(isObject)
    .map((r) => {
      const fromCarried = carry !== null && r.orderId === carry.id;
      return {
        ...(r as unknown as AttemptRecord),
        problemId: `${String(r.orderId)}:${String(r.ingredientId)}`,
        dayNumber: fromCarried ? 1 : 0,
        customerNumber: fromCarried ? 1 : 0,
      };
    });

  let state: GameState = {
    saveVersion: 2,
    scene: "title",
    money: data.money as number,
    nextOrderNumber: data.nextOrderNumber as number,
    day: null,
    deck,
    selectedTask: 0,
    draftAnswer: "",
    feedback: null,
    pour: null,
    records,
    dayHistory: [],
    stats,
    paidOrderIds,
  };

  if (carry) {
    const rng = createRng(seed);
    const rest = legacyCreateDayOrders(deck, state.nextOrderNumber, CUSTOMERS_PER_DAY - 1, rng);
    const orders: Order[] = [carry, ...rest.orders.map((o) => ({ ...o, status: "queued" as const }))];
    const sel = isInt(data.selectedTask, 0, carry.tasks.length - 1) ? data.selectedTask : 0;
    const draft = isStr(data.draftAnswer) && /^[0-9.]{0,8}$/.test(data.draftAnswer) ? data.draftAnswer : "";
    const day: DayState = { dayNumber: 1, status: "open", orders, currentIndex: 0, moneyEarned: 0 };
    state = { ...state, day, deck: rest.deck, nextOrderNumber: rest.nextOrderNumber, selectedTask: sel, draftAnswer: draft };
  }

  const checked = validateV2State(state);
  return checked.ok ? checked : { ok: false, errors: ["Phase 1 저장을 옮기는 중 문제가 생겼습니다.", ...checked.errors] };
}

