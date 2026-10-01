/**
 * 저장·불러오기·검증·마이그레이션 (저장 버전 3).
 *
 * - localStorage 키 하나에 게임 상태 전체(JSON 하나)를 저장한다.
 * - 버전 1(Phase 1) → 2 → 3, 버전 2(Phase 2) → 3 으로 자동으로 옮긴다. 옮기기 전 원본은 백업 키에 보관.
 * - 손상되었거나 규칙·참조가 맞지 않거나 더 새로운 버전인 저장은 덮어쓰지 않고 오류로 돌려준다.
 */
import { CUSTOMERS, fillLine } from "../data/customers.ts";
import { MULTI_EASY } from "../data/dialogues.ts";
import { classifyProduct, LEARNING_TYPE_IDS, LEARNING_TYPES, MAX_INTRO_STAGE } from "../data/learningTypes.ts";
import { LIFE_ITEMS } from "../data/lifeItems.ts";
import { RECIPES, SPECIAL_ORDER_PRICE } from "../data/recipes.ts";
import { equals, isDecimalString, multiplyStrings, parseDecimal, toDecimalString } from "../lib/decimal.ts";
import { type DeckState } from "../lib/deck.ts";
import { migrateV1toV2, validateV2State } from "./legacy/v2save.ts";
import type * as V2 from "./legacy/v2types.ts";
import { shiftConcept, SHIFT_VARIANTS } from "./orderFactory.ts";
import { qualityOf, rewardFor } from "./outcome.ts";
import { MAX_HINT_LEVEL } from "./reducer.ts";
import {
  CUSTOMERS_PER_DAY,
  STIR_TARGET,
  type DayState,
  type GameState,
  type IngredientTask,
  type Order,
  type OrderOutcome,
} from "./types.ts";

export const SAVE_KEY = "moonlight-potion-shop/save";
export const BACKUP_KEY_PREFIX = "moonlight-potion-shop/backup-";
export const SAVE_VERSION = 3;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

type Obj = Record<string, unknown>;
const isObject = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const isInt = (v: unknown, min = -Infinity, max = Infinity): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
const isStr = (v: unknown): v is string => typeof v === "string";
const isBool = (v: unknown): v is boolean => typeof v === "boolean";
const isStrArray = (v: unknown): v is string[] => Array.isArray(v) && v.every(isStr);
const norm = (s: string) => toDecimalString(parseDecimal(s));

const SCENES = ["title", "counter", "workbench", "closing"];
const ORDER_STATUSES = ["queued", "arrived", "brewing", "bottled", "paid"];
const KINDS = ["multiBottle", "customMultiplier", "lifeItem", "pointShift"];
const MODES = ["calc", "specified", "concept"];
const CHOICES = ["x10", "same", "d10"];
const QUALITIES = ["great", "okay", "poor"];

function orderNumber(id: string): number | null {
  const m = /^order-(\d+)$/.exec(id);
  return m ? Number(m[1]) : null;
}

/* ------------------------------------------------------------------ */
/* 검증 (버전 3)                                                        */
/* ------------------------------------------------------------------ */

function validateTask(t: unknown, o: Obj, i: number, w: string): string[] {
  const e: string[] = [];
  if (!isObject(t) || !isObject(t.problem)) return [`${w}: 형식이 올바르지 않습니다.`];
  const p = t.problem;
  const recipe = RECIPES[o.recipeId as string];
  const ad = recipe.additives[i];
  if (t.ingredientId !== ad.ingredientId) e.push(`${w}: 레시피의 재료와 다릅니다.`);
  if (t.problemId !== `${o.id}:${ad.ingredientId}`) e.push(`${w}: 문제 ID가 올바르지 않습니다.`);
  if (!MODES.includes(t.mode as string)) e.push(`${w}: 과제 종류가 올바르지 않습니다.`);
  if (![p.a, p.b, p.answer].every((x) => isStr(x) && isDecimalString(x))) return [...e, `${w}: 문제 숫자 형식이 올바르지 않습니다.`];
  if (!isInt(t.hintLevel, 0, MAX_HINT_LEVEL) || !isInt(t.attempts, 0) || !isBool(t.explanationViewed)) e.push(`${w}: 힌트·시도 기록이 올바르지 않습니다.`);
  if (!(t.reviewOf === null || isStr(t.reviewOf))) e.push(`${w}: 복습 정보가 올바르지 않습니다.`);
  if (!["pending", "measured", "done"].includes(t.status as string)) e.push(`${w}: 진행 상태가 올바르지 않습니다.`);
  if (e.length) return e;

  // 문제 내용이 주문 조건과 맞는지 (레시피 기본량·정답 조작 방지)
  const kind = o.kind;
  if (t.mode === "calc") {
    if (p.answer !== multiplyStrings(p.a as string, p.b as string)) e.push(`${w}: 정답이 계산과 맞지 않습니다.`);
    if (p.learningType !== classifyProduct(p.a as string, p.b as string)) e.push(`${w}: 학습 유형이 문제와 맞지 않습니다.`);
    if (kind === "multiBottle" && (p.a !== ad.amount || p.b !== String(o.bottles))) e.push(`${w}: 레시피 기본량·병 수와 문제가 다릅니다.`);
    if (kind === "customMultiplier" && (p.a !== ad.amount || p.b !== o.multiplier)) e.push(`${w}: 레시피 기본량·배수와 문제가 다릅니다.`);
    if (kind === "lifeItem") {
      const life = o.life as Obj;
      if (!isObject(life) || p.a !== life.a || p.b !== life.b) e.push(`${w}: 생활 소재 조건과 문제가 다릅니다.`);
    }
    if (kind === "pointShift") e.push(`${w}: 비교 주문에는 계산 과제가 없습니다.`);
  } else if (t.mode === "specified") {
    if (kind === "multiBottle" || kind === "customMultiplier") e.push(`${w}: 레시피 주문에는 지정량 과제가 없습니다.`);
    if (p.answer !== norm(ad.amount) || p.learningType !== null) e.push(`${w}: 지정량이 레시피 기본량과 다릅니다.`);
  } else {
    const c = t.concept;
    if (kind !== "pointShift" || !isObject(c)) e.push(`${w}: 비교 문제 정보가 없습니다.`);
    else {
      const ok = SHIFT_VARIANTS.some((v) => {
        const x = shiftConcept(c.refA as string, c.refB as string, v);
        return x.newA === c.newA && x.newB === c.newB && x.correct === c.correct && x.refProduct === c.refProduct;
      });
      if (!ok || p.a !== c.newA || p.b !== c.newB || p.answer !== multiplyStrings(c.newA as string, c.newB as string) || p.learningType !== "shift") {
        e.push(`${w}: 비교 문제 내용이 서로 맞지 않습니다.`);
      }
    }
  }
  if (e.length) return e;

  // 진행 상태와 확정한 답의 일관성
  const sub = t.submitted;
  if (t.status === "pending") {
    if (o.rules === 3 && (sub !== null || t.correct !== null || t.addedAmount !== null)) e.push(`${w}: 계량 전인데 확정한 답이 있습니다.`);
  } else {
    if (!isStr(sub)) return [...e, `${w}: 확정한 답이 없습니다.`];
    const expected = t.mode === "concept"
      ? CHOICES.includes(sub) && sub === (t.concept as Obj).correct
      : isDecimalString(sub) && equals(parseDecimal(sub), parseDecimal(p.answer as string));
    if (t.mode === "concept" && !CHOICES.includes(sub)) e.push(`${w}: 비교 답이 올바르지 않습니다.`);
    if (t.mode !== "concept" && !isDecimalString(sub)) e.push(`${w}: 확정한 답의 형식이 올바르지 않습니다.`);
    if (t.correct !== expected) e.push(`${w}: 정오 결과가 답과 맞지 않습니다.`);
    if (o.rules === 2 && t.correct !== true) e.push(`${w}: Phase 2 규칙에서는 정답만 투입됩니다.`);
    if (t.status === "measured" && t.addedAmount !== null) e.push(`${w}: 투입 전인데 투입량이 있습니다.`);
    if (t.status === "done") {
      const amt = t.mode === "concept" ? p.answer : isDecimalString(sub) ? norm(sub) : null;
      if (t.addedAmount !== amt) e.push(`${w}: 투입량이 확정한 답과 다릅니다.`);
    }
  }
  return e;
}

export function validateOrder(o: unknown, where: string): string[] {
  const e: string[] = [];
  if (!isObject(o)) return [`${where}: 주문 형식이 아닙니다.`];
  if (!isStr(o.id) || orderNumber(o.id) === null) e.push(`${where}: 주문 ID가 올바르지 않습니다.`);
  if (!KINDS.includes(o.kind as string)) e.push(`${where}: 지원하지 않는 주문 유형입니다.`);
  if (o.rules !== 2 && o.rules !== 3) e.push(`${where}: 규칙 버전이 올바르지 않습니다.`);
  if (o.rules === 2 && o.kind !== "multiBottle") e.push(`${where}: Phase 2 규칙 주문은 여러 병 주문만 있습니다.`);
  if (!ORDER_STATUSES.includes(o.status as string)) e.push(`${where}: 주문 상태가 올바르지 않습니다.`);
  const recipe = isStr(o.recipeId) ? RECIPES[o.recipeId] : undefined;
  if (!recipe) e.push(`${where}: 알 수 없는 레시피(${String(o.recipeId)})입니다.`);
  if (!isStr(o.customerId) || !CUSTOMERS[o.customerId]) e.push(`${where}: 알 수 없는 손님(${String(o.customerId)})입니다.`);
  if (!isInt(o.stirProgress, 0, STIR_TARGET) || !isInt(o.askCount, 0)) e.push(`${where}: 젓기·대화 기록이 올바르지 않습니다.`);
  const sc = o.script;
  if (!isObject(sc) || !["greet", "original", "easy", "waiting"].every((k) => isStr(sc[k])) || !isStrArray(sc.memo) || !(sc.reaction === null || isStr(sc.reaction))) {
    e.push(`${where}: 손님 대사·주문 메모 정보가 없습니다.`);
  }
  if (!Array.isArray(o.autoAdditions)) e.push(`${where}: 자동 투입 정보가 없습니다.`);
  if (!(o.reviewCandidateId === null || isStr(o.reviewCandidateId))) e.push(`${where}: 복습 정보가 올바르지 않습니다.`);
  if (!Array.isArray(o.tasks)) return [...e, `${where}: 재료 과제 목록이 없습니다.`];
  if (!recipe || e.length) return e;

  // 주문 유형별 조건
  if (o.kind === "multiBottle") {
    if (!isInt(o.bottles, 2, 99)) e.push(`${where}: 병 수가 올바르지 않습니다.`);
    if (o.price !== recipe.pricePerBottle * (o.bottles as number)) e.push(`${where}: 판매가가 레시피 가격과 맞지 않습니다.`);
  } else {
    if (o.bottles !== 1) e.push(`${where}: 맞춤·특별 주문은 1병입니다.`);
    if (o.price !== SPECIAL_ORDER_PRICE) e.push(`${where}: 특별 주문 판매가가 올바르지 않습니다.`);
  }
  if (o.kind === "customMultiplier" && !(isStr(o.multiplier) && isDecimalString(o.multiplier))) e.push(`${where}: 배수가 올바르지 않습니다.`);
  if (o.kind === "lifeItem") {
    const life = o.life;
    const item = isObject(life) && isStr(life.itemId) ? LIFE_ITEMS[life.itemId] : undefined;
    if (!item || !item.pairs.some(([a, b]) => a === (life as Obj).a && b === (life as Obj).b)) e.push(`${where}: 생활 소재 정보가 올바르지 않습니다.`);
  }
  if (o.tasks.length !== recipe.additives.length) return [...e, `${where}: 재료 수가 레시피와 다릅니다.`];
  if (e.length) return e;
  o.tasks.forEach((t, i) => e.push(...validateTask(t, o, i, `${where} 재료 ${i + 1}`)));
  if (e.length) return e;

  // 주문 상태와 제조 진행
  const tasks = o.tasks as IngredientTask[];
  const order = o as unknown as Order;
  const allDone = tasks.every((t) => t.status === "done");
  if (o.status === "queued" || o.status === "arrived") {
    if (!tasks.every((t) => t.status === "pending" && t.attempts === 0 && t.hintLevel === 0) || o.stirProgress !== 0) {
      e.push(`${where}: 주문을 받기 전인데 제조 기록이 있습니다.`);
    }
  }
  if ((o.stirProgress as number) > 0 && !allDone) e.push(`${where}: 재료를 다 넣기 전에 저은 기록이 있습니다.`);
  if (o.status === "bottled" || o.status === "paid") {
    if (!allDone || o.stirProgress !== STIR_TARGET) e.push(`${where}: 재료 투입·젓기가 끝나지 않았는데 완성 상태입니다.`);
    const q = qualityOf(order);
    if (o.quality !== q || o.reward !== rewardFor(order.price, q)) e.push(`${where}: 품질·판매금이 계량 결과와 맞지 않습니다.`);
    if (!isStr((sc as Obj).reaction)) e.push(`${where}: 손님 반응이 없습니다.`);
  } else if (o.quality !== null || o.reward !== null) {
    e.push(`${where}: 완성 전인데 품질·판매금이 있습니다.`);
  }
  if (o.quality !== null && !QUALITIES.includes(o.quality as string)) e.push(`${where}: 품질 값이 올바르지 않습니다.`);
  return e;
}

function validateDay(day: unknown, state: Obj, errors: string[]): void {
  if (!isObject(day)) { errors.push("영업 정보(day) 형식이 올바르지 않습니다."); return; }
  if (!isInt(day.dayNumber, 1)) errors.push("영업 일차가 올바르지 않습니다.");
  if (day.status !== "open" && day.status !== "closed") errors.push("영업 상태가 올바르지 않습니다.");
  if (day.rules !== 2 && day.rules !== 3) errors.push("영업 규칙 버전이 올바르지 않습니다.");
  if (!isInt(day.introStage, 0, MAX_INTRO_STAGE)) errors.push("유형 소개 단계가 올바르지 않습니다.");
  if (!Array.isArray(day.newTypes) || !day.newTypes.every((t) => LEARNING_TYPE_IDS.includes(t))) errors.push("새로 소개하는 유형 정보가 올바르지 않습니다.");
  if (!isBool(day.introSeen)) errors.push("유형 소개 확인 정보가 올바르지 않습니다.");
  if (!isInt(day.moneyEarned, 0)) errors.push("오늘 판매금이 올바르지 않습니다.");
  if (!Array.isArray(day.orders) || day.orders.length !== CUSTOMERS_PER_DAY) { errors.push(`오늘의 주문은 ${CUSTOMERS_PER_DAY}건이어야 합니다.`); return; }
  if (!isInt(day.currentIndex, 0, CUSTOMERS_PER_DAY - 1)) { errors.push("현재 손님 순서가 올바르지 않습니다."); return; }
  if (errors.length) return;
  const before = errors.length;
  day.orders.forEach((o, i) => errors.push(...validateOrder(o, `${i + 1}번째 손님 주문`)));
  if (errors.length > before) return;

  const orders = day.orders as Order[];
  const cur = day.currentIndex;
  if (new Set(orders.map((o) => o.id)).size !== orders.length) errors.push("주문 ID가 중복됩니다.");
  if (!orders.every((o) => o.rules === day.rules)) errors.push("하루 안의 주문 규칙 버전이 서로 다릅니다.");
  const paidIds = new Set(state.paidOrderIds as string[]);
  let paidSum = 0;
  orders.forEach((o, i) => {
    const w = `${i + 1}번째 손님 주문`;
    if (i < cur && o.status !== "paid") errors.push(`${w}: 이미 지나간 손님인데 판매가 끝나지 않았습니다.`);
    if (i === cur && o.status === "queued") errors.push(`${w}: 현재 손님이 창구에 없습니다.`);
    if (i > cur && o.status !== "queued") errors.push(`${w}: 아직 오지 않은 손님의 상태가 올바르지 않습니다.`);
    if (o.status === "paid") {
      paidSum += o.reward ?? 0;
      if (!paidIds.has(o.id)) errors.push(`${w}: 판매금 지급 기록이 없습니다.`);
    } else if (paidIds.has(o.id)) errors.push(`${w}: 판매하지 않은 주문에 지급 기록이 있습니다.`);
    if (o.reviewCandidateId && !(state.review as Obj[]).some((c) => c.id === o.reviewCandidateId)) errors.push(`${w}: 없는 복습 후보를 가리킵니다.`);
    for (const t of o.tasks) if (t.reviewOf && !(state.review as Obj[]).some((c) => c.id === t.reviewOf)) errors.push(`${w}: 없는 복습 후보를 가리킵니다.`);
    if ((orderNumber(o.id) as number) >= (state.nextOrderNumber as number)) errors.push(`${w}: 주문 번호가 다음 주문 번호보다 큽니다.`);
  });
  if (paidSum !== day.moneyEarned) errors.push("오늘 판매금이 판매한 주문의 지급액 합과 다릅니다.");

  const current = orders[cur];
  if (day.status === "closed") {
    if (cur !== CUSTOMERS_PER_DAY - 1 || !orders.every((o) => o.status === "paid")) errors.push("마감했는데 판매하지 않은 주문이 있습니다.");
    if (state.scene !== "closing" && state.scene !== "title") errors.push("마감한 날의 화면 상태가 올바르지 않습니다.");
    if (!(state.dayHistory as Obj[]).some((h) => isObject(h) && h.dayNumber === day.dayNumber)) errors.push("마감한 날의 영업 결과가 없습니다.");
  } else {
    if (state.scene === "closing") errors.push("영업 중인데 마감 화면 상태입니다.");
    if (state.scene === "workbench" && current.status !== "brewing" && current.status !== "bottled") errors.push("제조대 화면인데 제조 중인 주문이 없습니다.");
  }
  // 계량 패널: 답을 확정한(measured) 재료는 패널이 열려 있어야 하고, 동시에 하나만
  const measured = current.tasks.map((t, i) => (t.status === "measured" ? i : -1)).filter((i) => i >= 0);
  const at = state.activeTask;
  if (measured.length > 1) errors.push("확정했지만 넣지 않은 재료가 둘 이상입니다.");
  if (at !== null) {
    if (!isInt(at, 0, current.tasks.length - 1) || current.status !== "brewing" || current.tasks[at as number].status === "done") {
      errors.push("열려 있는 계량 패널 정보가 올바르지 않습니다.");
    } else if (measured.length === 1 && measured[0] !== at) errors.push("계량 패널과 확정한 재료가 다릅니다.");
  } else if (measured.length) errors.push("확정한 재료의 계량 패널이 닫혀 있습니다.");
}

const SUMMARY_NUMBERS = [
  "dayNumber", "customersServed", "bottlesSold", "moneyEarned", "moneyAfter",
  "totalProblems", "firstTryCorrect", "correctedAfterWrong", "hintUsed",
] as const;

function validateProblemRecord(r: unknown, i: number): string[] {
  const w = `문제 기록 ${i + 1}`;
  if (!isObject(r)) return [`${w}: 형식이 올바르지 않습니다.`];
  const ok =
    isStr(r.problemId) && isInt(r.dayNumber, 1) && isInt(r.customerNumber, 1, CUSTOMERS_PER_DAY) && isStr(r.orderId) &&
    KINDS.includes(r.orderKind as string) && MODES.includes(r.mode as string) && isStr(r.ingredientId) &&
    (r.learningType === null || (isStr(r.learningType) && r.learningType in LEARNING_TYPES)) && isStr(r.condition) &&
    isStr(r.a) && isStr(r.b) && isStr(r.target) && isStr(r.submitted) && isBool(r.correct) && isInt(r.hintLevel, 0, MAX_HINT_LEVEL) &&
    isBool(r.explanationViewed) && isBool(r.isReview) && (r.reviewOf === null || isStr(r.reviewOf)) && isStr(r.submittedAt);
  return ok ? [] : [`${w}: 필수 값이 빠졌거나 형식이 다릅니다.`];
}

function validateLegacyRecord(r: unknown, i: number): string[] {
  const w = `이전 학습 기록 ${i + 1}`;
  if (!isObject(r)) return [`${w}: 형식이 올바르지 않습니다.`];
  const ok =
    isStr(r.problemId) && isInt(r.dayNumber, 0) && isInt(r.customerNumber, 0, CUSTOMERS_PER_DAY) && isStr(r.orderId) &&
    isStr(r.ingredientId) && isStr(r.learningType) && r.learningType in LEARNING_TYPES && isStr(r.a) && isStr(r.b) && isStr(r.answer) &&
    (r.firstAnswer === null || isStr(r.firstAnswer)) && (r.firstCorrect === null || isBool(r.firstCorrect)) && isInt(r.attempts, 0) &&
    isInt(r.hintLevel, 0, MAX_HINT_LEVEL) && isBool(r.solved) && isStr(r.solvedAt);
  return ok ? [] : [`${w}: 필수 값이 빠졌거나 형식이 다릅니다.`];
}

/** 버전 3 저장 데이터 전체 검증 */
export function validateState(data: unknown): { ok: true; state: GameState } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (!isObject(data)) return { ok: false, errors: ["저장 데이터가 객체 형식이 아닙니다."] };
  if (data.saveVersion !== SAVE_VERSION) return { ok: false, errors: [`저장 버전이 ${SAVE_VERSION}이 아닙니다.`] };
  if (!isInt(data.money, 0)) errors.push("소지금이 올바르지 않습니다.");
  if (!isInt(data.nextOrderNumber, 1)) errors.push("다음 주문 번호가 올바르지 않습니다.");
  if (!SCENES.includes(data.scene as string)) errors.push("화면 상태가 올바르지 않습니다.");
  if (!isObject(data.decks) || !Object.values(data.decks).every((d) => isObject(d) && isStrArray(d.remaining) && (d.lastDrawn === null || isStr(d.lastDrawn)))) {
    errors.push("문제 덱 정보가 올바르지 않습니다.");
  }
  if (!(data.activeTask === null || isInt(data.activeTask, 0))) errors.push("계량 패널 정보가 올바르지 않습니다.");
  if (!isStr(data.draftAnswer) || !/^[0-9.]{0,8}$/.test(data.draftAnswer)) errors.push("입력 중인 답이 올바르지 않습니다.");
  if (!(data.feedback === null || (isObject(data.feedback) && isStr(data.feedback.kind) && isStr(data.feedback.title) && isStrArray(data.feedback.lines)))) {
    errors.push("안내 메시지 정보가 올바르지 않습니다.");
  }
  if (!(data.pour === null || (isObject(data.pour) && isInt(data.pour.seq, 0)))) errors.push("계량 연출 정보가 올바르지 않습니다.");
  if (!isObject(data.stats) || !["ordersCompleted", "potionsSold", "problemsSolved"].every((k) => isInt((data.stats as Obj)[k], 0))) {
    errors.push("누적 통계가 올바르지 않습니다.");
  }
  if (!isStrArray(data.paidOrderIds)) errors.push("판매금 지급 기록이 올바르지 않습니다.");
  if (!Array.isArray(data.problemLog)) errors.push("문제 기록이 목록이 아닙니다.");
  else {
    data.problemLog.forEach((r, i) => errors.push(...validateProblemRecord(r, i)));
    const ids = (data.problemLog as Obj[]).map((r) => r.problemId);
    if (new Set(ids).size !== ids.length) errors.push("같은 문제 기록이 두 번 있습니다.");
  }
  if (!Array.isArray(data.legacyRecords)) errors.push("이전 학습 기록이 목록이 아닙니다.");
  else data.legacyRecords.forEach((r, i) => errors.push(...validateLegacyRecord(r, i)));
  if (!Array.isArray(data.review)) errors.push("복습 후보가 목록이 아닙니다.");
  else {
    const logIds = new Set(Array.isArray(data.problemLog) ? (data.problemLog as Obj[]).map((r) => r.problemId) : []);
    data.review.forEach((c, i) => {
      const w = `복습 후보 ${i + 1}`;
      if (
        !isObject(c) || !isStr(c.id) || !isStr(c.sourceProblemId) || !isStr(c.learningType) || !(c.learningType in LEARNING_TYPES) ||
        !isStr(c.a) || !isStr(c.b) || !isInt(c.createdDay, 1) || (c.status !== "open" && c.status !== "resolved") ||
        !(c.lastReviewDay === null || isInt(c.lastReviewDay, 1)) || !isStrArray(c.reviewProblemIds) ||
        !(c.resolvedProblemId === null || isStr(c.resolvedProblemId))
      ) { errors.push(`${w}: 형식이 올바르지 않습니다.`); return; }
      if (!logIds.has(c.sourceProblemId)) errors.push(`${w}: 원래 문제 기록이 없습니다.`);
      if (c.status === "resolved" && !c.resolvedProblemId) errors.push(`${w}: 해결한 문제 정보가 없습니다.`);
    });
    const ids = (data.review as Obj[]).map((c) => (isObject(c) ? c.id : null));
    if (new Set(ids).size !== ids.length) errors.push("복습 후보 ID가 중복됩니다.");
  }
  if (!Array.isArray(data.orderLog)) errors.push("주문 결과 기록이 목록이 아닙니다.");
  else {
    data.orderLog.forEach((x, i) => {
      if (!isObject(x) || !isStr(x.orderId) || !isInt(x.dayNumber, 1) || !isInt(x.customerNumber, 1, CUSTOMERS_PER_DAY) ||
        !KINDS.includes(x.kind as string) || (x.rules !== 2 && x.rules !== 3) || !isStr(x.recipeId) || !isInt(x.bottles, 1) ||
        !(x.quality === null || QUALITIES.includes(x.quality as string)) || !isInt(x.price, 0) || !isInt(x.reward, 0) || !isStr(x.deliveredAt)) {
        errors.push(`주문 결과 기록 ${i + 1}: 형식이 올바르지 않습니다.`);
      }
    });
    const ids = (data.orderLog as Obj[]).map((x) => (isObject(x) ? x.orderId : null));
    if (new Set(ids).size !== ids.length) errors.push("같은 주문 결과가 두 번 있습니다.");
  }
  if (!Array.isArray(data.dayHistory)) errors.push("지난 영업 결과가 목록이 아닙니다.");
  else {
    data.dayHistory.forEach((h, i) => {
      if (!isObject(h) || !SUMMARY_NUMBERS.every((k) => isInt(h[k], 0)) || !isStr(h.closedAt)) errors.push(`지난 영업 결과 ${i + 1}: 형식이 올바르지 않습니다.`);
    });
    const days = (data.dayHistory as Obj[]).map((h) => (isObject(h) ? h.dayNumber : null));
    if (new Set(days).size !== days.length) errors.push("지난 영업 결과에 같은 일차가 두 번 있습니다.");
  }
  if (errors.length) return { ok: false, errors };

  if (data.day === null) {
    if (data.scene !== "title") errors.push("영업을 시작하지 않았는데 게임 화면 상태입니다.");
    if (data.activeTask !== null) errors.push("영업 전인데 계량 패널이 열려 있습니다.");
  } else validateDay(data.day, data, errors);
  return errors.length ? { ok: false, errors } : { ok: true, state: data as unknown as GameState };
}

/* ------------------------------------------------------------------ */
/* Phase 2 → Phase 3 마이그레이션                                       */
/* ------------------------------------------------------------------ */

function convertV2Order(o: V2.Order): Order {
  const done = (s: string) => s === "done";
  const finished = o.status === "bottled" || o.status === "paid";
  return {
    id: o.id,
    kind: "multiBottle",
    rules: 2,
    customerId: o.customerId,
    recipeId: o.recipeId,
    bottles: o.bottles,
    multiplier: null,
    life: null,
    tasks: o.tasks.map((t) => ({
      problemId: `${o.id}:${t.ingredientId}`,
      ingredientId: t.ingredientId,
      mode: "calc",
      problem: { ...t.problem },
      concept: null,
      status: done(t.status) ? "done" : "pending",
      submitted: done(t.status) ? t.problem.answer : null,
      correct: done(t.status) ? true : null,
      addedAmount: done(t.status) ? t.problem.answer : null,
      hintLevel: t.hintLevel,
      explanationViewed: false,
      reviewOf: null,
      attempts: t.attempts,
      firstAnswer: t.firstAnswer,
      firstCorrect: t.firstCorrect,
      lastWrongAnswer: t.lastWrongAnswer,
    })),
    autoAdditions: o.autoAdditions,
    status: o.status,
    price: o.price,
    quality: null,
    reward: finished ? o.price : null,
    stirProgress: finished ? STIR_TARGET : 0,
    askCount: 0,
    deckKey: o.deckKey,
    reviewCandidateId: null,
    script: {
      greet: o.lines.greet,
      original: o.lines.order,
      easy: fillLine(MULTI_EASY, { potion: RECIPES[o.recipeId].name, n: o.bottles }),
      waiting: o.lines.waiting,
      memo: [`포션: ${RECIPES[o.recipeId].name} ${o.bottles}병`, `재료: 레시피북의 1병당 양으로 ${o.bottles}병만큼`, "달빛 이슬은 mL, 별가루는 g으로 계량"],
      reaction: finished ? o.lines.thanks : null,
    },
  };
}

/**
 * 버전 2 → 3
 * - 돈·일차·통계·지난 영업 결과·지급 기록·덱: 그대로
 * - 진행 중인 하루: 주문마다 rules 2로 표시하여 Phase 2 방식(정답 수정·정액 판매금)으로 끝냄. 이미 받은 판매금은 그대로
 *   완료 재료·입력 중인 답 유지 (입력 중인 답이 있으면 그 재료의 계량 패널을 연 상태로 복구)
 * - Phase 1·2 학습 기록: legacyRecords로 보존 (새 문제 기록과 구분)
 * - 유형 소개 단계: 0(①②)에서 시작 → 다음 영업부터 ③④ … 순서대로 소개 (일차가 높아도 건너뛰지 않음)
 */
export function migrateV2toV3(v2: V2.GameState): GameState {
  let day: DayState | null = null;
  let activeTask: number | null = null;
  const orderLog: OrderOutcome[] = [];
  if (v2.day) {
    const orders = v2.day.orders.map(convertV2Order);
    day = { ...v2.day, rules: 2, introStage: 0, newTypes: [], introSeen: true, orders };
    const cur = orders[v2.day.currentIndex];
    if (cur.status === "brewing" && v2.draftAnswer !== "" && cur.tasks[v2.selectedTask]?.status === "pending") {
      activeTask = v2.selectedTask;
    }
    orders.forEach((o, i) => {
      if (o.status === "paid") {
        orderLog.push({
          orderId: o.id, dayNumber: v2.day!.dayNumber, customerNumber: i + 1, kind: "multiBottle", rules: 2, recipeId: o.recipeId,
          bottles: o.bottles, quality: null, price: o.price, reward: o.price, deliveredAt: "",
        });
      }
    });
  }
  const decks: Record<string, DeckState> = { multiBottle: v2.deck };
  return {
    saveVersion: 3,
    scene: v2.scene,
    money: v2.money,
    nextOrderNumber: v2.nextOrderNumber,
    day,
    decks,
    activeTask,
    draftAnswer: activeTask !== null ? v2.draftAnswer : "",
    feedback: activeTask !== null ? v2.feedback : null,
    pour: null,
    problemLog: [],
    legacyRecords: v2.records,
    review: [],
    orderLog,
    dayHistory: v2.dayHistory.map((h) => ({ ...h, ruleVersion: 2 as const })),
    stats: v2.stats,
    paidOrderIds: v2.paidOrderIds,
  };
}

/* ------------------------------------------------------------------ */
/* 해석(버전 판별) · 불러오기 · 저장                                     */
/* ------------------------------------------------------------------ */

export type InterpretResult =
  | { ok: true; state: GameState; migratedFrom: number | null }
  | { ok: false; kind: "invalid" | "unsupportedVersion"; errors: string[] };

export function interpretSaveData(data: unknown, seed: number): InterpretResult {
  if (!isObject(data)) return { ok: false, kind: "invalid", errors: ["저장 데이터가 객체 형식이 아닙니다."] };
  const v = data.saveVersion;
  if (v === SAVE_VERSION) {
    const r = validateState(data);
    return r.ok ? { ok: true, state: r.state, migratedFrom: null } : { ok: false, kind: "invalid", errors: r.errors };
  }
  if (v === 1 || v === 2) {
    let v2: V2.GameState;
    if (v === 1) {
      const r1 = migrateV1toV2(data, seed);
      if (!r1.ok) return { ok: false, kind: "invalid", errors: r1.errors };
      v2 = r1.state;
    } else {
      const r2 = validateV2State(data);
      if (!r2.ok) return { ok: false, kind: "invalid", errors: r2.errors };
      v2 = r2.state;
    }
    const migrated = { ...migrateV2toV3(v2), scene: "title" as const };
    const r3 = validateState(migrated);
    if (!r3.ok) return { ok: false, kind: "invalid", errors: [`Phase ${v} 저장을 옮기는 중 문제가 생겼습니다.`, ...r3.errors] };
    return { ok: true, state: r3.state, migratedFrom: v };
  }
  if (isInt(v) && v > SAVE_VERSION) {
    return { ok: false, kind: "unsupportedVersion", errors: [`이 게임보다 새로운 버전(${v})의 저장입니다. 게임을 최신 버전으로 열어 주세요.`] };
  }
  return { ok: false, kind: "invalid", errors: ["저장 버전 정보가 없거나 알 수 없습니다."] };
}

export type LoadResult =
  | { kind: "empty" }
  | { kind: "ok"; state: GameState; migratedFrom: number | null }
  | { kind: "error"; reason: "corrupt" | "invalid" | "unsupportedVersion"; errors: string[]; raw: string };

export function loadGame(seed: number, storage: StorageLike | null = defaultStorage()): LoadResult {
  if (!storage) return { kind: "empty" };
  let raw: string | null;
  try {
    raw = storage.getItem(SAVE_KEY);
  } catch {
    return { kind: "empty" };
  }
  if (!raw) return { kind: "empty" };
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { kind: "error", reason: "corrupt", errors: ["저장 데이터가 손상되어 읽을 수 없습니다(JSON 오류)."], raw };
  }
  const r = interpretSaveData(data, seed);
  if (!r.ok) return { kind: "error", reason: r.kind, errors: r.errors, raw };
  if (r.migratedFrom !== null) {
    try {
      storage.setItem(`${BACKUP_KEY_PREFIX}v${r.migratedFrom}`, raw);
    } catch {
      /* 공간 부족 등은 무시 */
    }
  }
  return { kind: "ok", state: r.state, migratedFrom: r.migratedFrom };
}

export function saveGame(state: GameState, storage: StorageLike | null = defaultStorage()): boolean {
  if (!storage) return false;
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function clearSave(storage: StorageLike | null = defaultStorage()): void {
  try {
    storage?.removeItem(SAVE_KEY);
  } catch {
    /* 무시 */
  }
}
