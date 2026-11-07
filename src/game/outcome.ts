/**
 * 포션 품질과 판매금. 주문의 재료 과제 수와 정확한 과제 수로 정한다.
 *  재료 1·2개 (기존 규칙 그대로)
 *    모든 과제 정확:   만족(great) 100%
 *    일부만 정확:      조금 아쉬움(okay) 80%   ← 과제가 2개일 때만 생긴다
 *    정확한 과제 없음: 불만족(poor) 60%
 *  재료 3개 (새 규칙: 정확한 재료 0·1·2·3개 → 60·75·90·100%)
 *    3개 정확 만족(great) 100% · 2개 대체로 만족(good) 90% · 1개 조금 아쉬움(okay) 75% · 0개 불만족(poor) 60%
 * 소수 동전은 없다. 정수 연산 후 소수 부분은 버린다. 힌트·'네?'는 감액하지 않는다.
 * Phase 2 규칙(rules 2) 주문은 이전처럼 정상 판매금 전액.
 */
import { fillLine, getCustomer } from "../data/customers.ts";
import { getRecipe } from "../data/recipes.ts";
import type { Order, Quality } from "./types.ts";

/** 재료 1·2개 주문의 품질별 비율 (good은 생기지 않는다) */
export const QUALITY_PERCENT: Record<Quality, number> = { great: 100, good: 90, okay: 80, poor: 60 };
/** 재료 3개 이상 주문의 품질별 비율 */
export const QUALITY_PERCENT_3: Record<Quality, number> = { great: 100, good: 90, okay: 75, poor: 60 };
export const QUALITY_LABEL: Record<Quality, string> = { great: "만족", good: "대체로 만족", okay: "조금 아쉬움", poor: "불만족" };

export function qualityOf(order: Order): Quality | null {
  if (order.rules === 2) return null;
  const n = order.tasks.length;
  const correct = order.tasks.filter((t) => t.correct === true).length;
  if (correct === n) return "great";
  if (correct === 0) return "poor";
  if (n >= 3 && correct === n - 1) return "good";
  return "okay";
}

/** 이 주문의 품질별 판매금 비율(%) */
export function percentFor(taskCount: number, quality: Quality | null): number {
  if (quality === null) return 100;
  return (taskCount >= 3 ? QUALITY_PERCENT_3 : QUALITY_PERCENT)[quality];
}

/** 재료 1·2개 주문의 판매금 (이전 규칙과 같은 계산) */
export function rewardFor(price: number, quality: Quality | null, taskCount = 2): number {
  return Math.floor((price * percentFor(taskCount, quality)) / 100);
}

/** 주문의 실제 판매금 (재료 수에 맞는 비율) */
export function rewardForOrder(order: Order, quality: Quality | null): number {
  return rewardFor(order.price, quality, order.tasks.length);
}

/** 손님 반응 대사 (주문 번호로 고르므로 다시 계산해도 같다) */
export function reactionLine(order: Order, quality: Quality | null): string {
  const customer = getCustomer(order.customerId);
  const q = quality ?? "great";
  const list = customer.lines.reaction[q] ?? customer.lines.reaction.great;
  const n = Number(order.id.replace(/\D/g, "")) || 0;
  return fillLine(list[n % list.length], { glow: getRecipe(order.recipeId).glowWord });
}
