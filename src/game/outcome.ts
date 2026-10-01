/**
 * 포션 품질과 판매금.
 *  두 재료 모두 정확: 만족(great) 100%
 *  하나만 정확:       조금 아쉬움(okay) 80%
 *  둘 다 다름:        불만족(poor) 60%
 * 소수 동전은 없다. 정수 연산 후 소수 부분은 버린다. 힌트·'네?'는 감액하지 않는다.
 * Phase 2 규칙(rules 2) 주문은 이전처럼 정상 판매금 전액.
 */
import { fillLine, getCustomer } from "../data/customers.ts";
import { getRecipe } from "../data/recipes.ts";
import type { Order, Quality } from "./types.ts";

export const QUALITY_PERCENT: Record<Quality, number> = { great: 100, okay: 80, poor: 60 };
export const QUALITY_LABEL: Record<Quality, string> = { great: "만족", okay: "조금 아쉬움", poor: "불만족" };

export function qualityOf(order: Order): Quality | null {
  if (order.rules === 2) return null;
  const correct = order.tasks.filter((t) => t.correct === true).length;
  if (correct === order.tasks.length) return "great";
  if (correct === 0) return "poor";
  return "okay";
}

export function rewardFor(price: number, quality: Quality | null): number {
  if (quality === null) return price;
  return Math.floor((price * QUALITY_PERCENT[quality]) / 100);
}

/** 손님 반응 대사 (주문 번호로 고르므로 다시 계산해도 같다) */
export function reactionLine(order: Order, quality: Quality | null): string {
  const customer = getCustomer(order.customerId);
  const q = quality ?? "great";
  const list = customer.lines.reaction[q];
  const n = Number(order.id.replace(/\D/g, "")) || 0;
  return fillLine(list[n % list.length], { glow: getRecipe(order.recipeId).glowWord });
}
