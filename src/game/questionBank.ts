/**
 * 문제은행 출제 규칙.
 *  - 후보: 레시피의 '모든' 필수 재료를 해금한 포션 + 지금까지 소개된 학습 유형 (TXT의 required_ingredients만 보지 않는다)
 *  - 난이도: 일차별 비율로 고르고, 그 난이도 후보가 없으면 같은 기간에 허용된 다른 난이도로 (허용 밖 난이도는 쓰지 않음)
 *  - 반복: 아직 안 낸 문항을 먼저, 모두 냈으면 가장 오래전에 낸 문항부터 (덱 decks.bank에 낸 순서를 저장)
 *  - 같은 날 이미 나온 식(인수 쌍)·같은 문항은 피한다
 * 후보가 없으면 null → 기존 문제 생성기가 그 자리를 채운다 (orderFactory.planDay).
 */
import { QUESTION_BANK } from "../data/questionBank.ts";
import type { BankDifficulty, BankQuestion } from "../data/questionBankTypes.ts";
import type { LearningTypeId } from "../data/learningTypes.ts";
import type { Recipe } from "../data/recipes.ts";
import { decimalPlaces, normalize, parseDecimal, toDecimalString } from "../lib/decimal.ts";
import type { DeckState } from "../lib/deck.ts";
import type { Rng } from "../lib/rng.ts";

export const BANK_DECK = "bank";
export const BANK_BY_ID: ReadonlyMap<string, BankQuestion> = new Map(QUESTION_BANK.map((q) => [q.id, q]));

export function getBankQuestion(id: string): BankQuestion {
  const q = BANK_BY_ID.get(id);
  if (!q) throw new Error(`알 수 없는 문제은행 ID: ${id}`);
  return q;
}

/** 문항의 학습 유형 (①~⑥). 소수 두 자리 × 소수 두 자리처럼 기존 표에 없는 모양은 ⑥(두 자리 소수가 있는 소수 × 소수)으로 묶는다 */
export function bankLearningType(q: Pick<BankQuestion, "mulType" | "a" | "b">): LearningTypeId {
  if (q.mulType === "소수×자연수") return decimalPlaces(q.a) === 1 ? "d1xN" : "d2xN";
  if (q.mulType === "자연수×소수") return decimalPlaces(q.b) === 1 ? "Nxd1" : "Nxd2";
  return decimalPlaces(q.a) === 1 && decimalPlaces(q.b) === 1 ? "d1xD" : "d2xD";
}

export const DIFFICULTIES: BankDifficulty[] = ["하", "중", "상"];

/** 일차별 난이도 비율 (합 1) */
export function difficultyWeights(dayNumber: number): Record<BankDifficulty, number> {
  if (dayNumber <= 5) return { 하: 1, 중: 0, 상: 0 };
  if (dayNumber <= 10) return { 하: 0.7, 중: 0.3, 상: 0 };
  if (dayNumber <= 20) return { 하: 0.3, 중: 0.6, 상: 0.1 };
  return { 하: 0.2, 중: 0.5, 상: 0.3 };
}

/** 출제할 수 있는 문항 (모든 재료 해금된 레시피 + 소개된 유형) */
export function eligibleBank(intro: readonly LearningTypeId[], recipes: readonly Recipe[]): BankQuestion[] {
  const ok = new Set(recipes.map((r) => r.id));
  return QUESTION_BANK.filter((q) => ok.has(q.recipeId) && intro.includes(bankLearningType(q)));
}

const formula = (a: string, b: string) => `${toDecimalString(normalize(parseDecimal(a)))}×${toDecimalString(normalize(parseDecimal(b)))}`;
export { formula as bankFormula };

export interface BankPickInput {
  dayNumber: number;
  candidates: readonly BankQuestion[];
  deck: DeckState | undefined;
  rng: Rng;
  /** 오늘 이미 낸 문항 ID */
  usedToday: ReadonlySet<string>;
  /** 오늘 이미 나온 식 (생성기·복습 포함) */
  formulasToday: ReadonlySet<string>;
  /** 이 자리에 꼭 필요한 유형·레시피 (새 유형 소개·새 레시피 첫 주문 자리) */
  requireType?: LearningTypeId;
  requireRecipe?: string;
  /** 재료 3종 레시피를 더 낼 수 없으면 false */
  allowTriple: boolean;
  tripleRecipes: ReadonlySet<string>;
}

export interface BankPick {
  question: BankQuestion;
  /** 비율로 고른 난이도와 실제 난이도가 다르면 true (그 난이도 후보가 없어 대체) */
  adjusted: boolean;
  deck: DeckState;
}

/** 비율로 난이도를 고르고, 덱 순서(안 낸 것 → 오래전에 낸 것)로 한 문항을 뽑는다. 후보가 없으면 null */
export function pickBankQuestion(input: BankPickInput): BankPick | null {
  const w = difficultyWeights(input.dayNumber);
  const pool = input.candidates.filter(
    (q) =>
      !input.usedToday.has(q.id) &&
      (!input.requireType || bankLearningType(q) === input.requireType) &&
      (!input.requireRecipe || q.recipeId === input.requireRecipe) &&
      (input.allowTriple || !input.tripleRecipes.has(q.recipeId)),
  );
  if (!pool.length) return null;
  // 난이도: 비율대로 하나 고르고, 그 난이도 후보가 없으면 허용된(비율 > 0) 다른 난이도를 비율 큰 순서로
  let r = input.rng();
  let wanted: BankDifficulty = "하";
  for (const d of DIFFICULTIES) {
    if (w[d] <= 0) continue;
    wanted = d;
    if (r < w[d]) break;
    r -= w[d];
  }
  const order = [wanted, ...DIFFICULTIES.filter((d) => d !== wanted && w[d] > 0).sort((a, b) => w[b] - w[a])];
  for (const d of order) {
    let list = pool.filter((q) => q.difficulty === d);
    if (!list.length) continue;
    const fresh = list.filter((q) => !input.formulasToday.has(formula(q.a, q.b)));
    if (fresh.length) list = fresh;
    const used = input.deck?.remaining ?? [];
    const notYet = list.filter((q) => !used.includes(q.id));
    let chosen: BankQuestion;
    if (notYet.length) chosen = notYet[Math.floor(input.rng() * notYet.length) % notYet.length];
    else chosen = list.reduce((best, q) => (used.indexOf(q.id) < used.indexOf(best.id) ? q : best));
    const deck: DeckState = { remaining: [...used.filter((id) => id !== chosen.id), chosen.id], lastDrawn: `bank:${chosen.id}` };
    return { question: chosen, adjusted: d !== wanted, deck };
  }
  return null;
}
