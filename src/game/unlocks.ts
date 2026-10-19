/**
 * 재료 해금과 레시피 사용 가능 여부 (순수 함수).
 *
 *  - 재료: 돈으로 사용 권한을 영구 구매한다. 한 번 해금하면 계속 쓴다(재고·소모 없음).
 *  - 레시피: 따로 사지 않는다. 필요한 재료(첨가물 재료 ID 전부)를 모두 해금하면 자동으로 쓸 수 있다.
 *  - 가격은 항상 내부 데이터(카탈로그)에서 읽는다. 호출하는 쪽이 금액을 정할 수 없다.
 *  - 이미 해금한 재료를 다시 고르면 돈을 빼지 않는다. 잔액이 모자라면 아무것도 바꾸지 않는다.
 *  - 학습 유형 소개 단계와는 별개다. 단계가 올라도 재료가 저절로 해금되지 않는다.
 *
 * 카탈로그를 인자로 받는 것은 테스트 전용 상품으로 구매 규칙을 검사하기 위해서다.
 * 게임은 언제나 GAME_CATALOG(실제 데이터)만 쓴다.
 */
import { INGREDIENTS, type Ingredient } from "../data/ingredients.ts";
import { RECIPES, type Recipe } from "../data/recipes.ts";

export interface UnlockCatalog {
  ingredients: Record<string, Ingredient>;
  recipes: Record<string, Recipe>;
}

export const GAME_CATALOG: UnlockCatalog = { ingredients: INGREDIENTS, recipes: RECIPES };

/** 레시피에 필요한 재료 ID (중복 없음) */
export function requiredIngredients(recipe: Recipe): string[] {
  return [...new Set(recipe.additives.map((a) => a.ingredientId))];
}

/** 해금 메뉴에 나오는 재료 (이전 버전 전용 재료 제외) */
export function shopIngredients(catalog: UnlockCatalog = GAME_CATALOG): Ingredient[] {
  return Object.values(catalog.ingredients).filter((i) => !i.legacy);
}

/** 처음부터 해금된 무료 재료 */
export function freeIngredients(catalog: UnlockCatalog = GAME_CATALOG): string[] {
  return shopIngredients(catalog).filter((i) => i.unlockCost === 0).map((i) => i.id);
}

/** 저장할 해금 목록 모양으로 정리: 카탈로그에 있는 판매 재료만, 중복 없이, 무료 재료 포함, 카탈로그 순서 */
export function normalizeUnlocked(list: readonly string[], catalog: UnlockCatalog = GAME_CATALOG): string[] {
  const want = new Set([...list, ...freeIngredients(catalog)]);
  return shopIngredients(catalog).map((i) => i.id).filter((id) => want.has(id));
}

/** 이 레시피를 새 주문에 쓸 수 있는지: 이전 버전 레시피가 아니고, 필요한 재료를 모두 해금했는지 */
export function isRecipeAvailable(recipe: Recipe, unlocked: readonly string[]): boolean {
  if (recipe.legacy) return false;
  const have = new Set(unlocked);
  return requiredIngredients(recipe).every((id) => have.has(id));
}

/** 새 주문 후보로 쓸 수 있는 레시피 */
export function availableRecipes(unlocked: readonly string[], catalog: UnlockCatalog = GAME_CATALOG): Recipe[] {
  return Object.values(catalog.recipes).filter((r) => isRecipeAvailable(r, unlocked));
}

export type UnlockFailure = "unknown" | "notForSale" | "already" | "insufficient";
export type UnlockResult =
  | { ok: true; money: number; unlocked: string[]; cost: number }
  | { ok: false; reason: UnlockFailure; cost: number | null };

/** 재료 해금 시도. 성공하면 새 소지금과 해금 목록을 돌려준다 */
export function tryUnlock(money: number, unlocked: readonly string[], ingredientId: string, catalog: UnlockCatalog = GAME_CATALOG): UnlockResult {
  const ing = catalog.ingredients[ingredientId];
  if (!ing) return { ok: false, reason: "unknown", cost: null };
  if (ing.legacy) return { ok: false, reason: "notForSale", cost: null };
  const cost = ing.unlockCost;
  if (unlocked.includes(ingredientId) || cost === 0) return { ok: false, reason: "already", cost };
  if (!Number.isInteger(money) || money < cost) return { ok: false, reason: "insufficient", cost };
  return { ok: true, money: money - cost, unlocked: normalizeUnlocked([...unlocked, ingredientId], catalog), cost };
}

export const UNLOCK_MESSAGE: Record<UnlockFailure, string> = {
  unknown: "알 수 없는 재료예요.",
  notForSale: "해금할 수 없는 재료예요.",
  already: "이미 쓸 수 있는 재료예요. 돈은 빠지지 않았어요.",
  insufficient: "달빛 동전이 모자라요.",
};
