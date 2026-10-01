/**
 * 주문 생성. 레시피 기본량은 고정이고, 주문마다 달라지는 것은 병 수(와 3단계의 배수)뿐이다.
 */
import { getCustomer, fillLine } from "../data/customers.ts";
import { getIngredient } from "../data/ingredients.ts";
import { classifyProduct, LEARNING_TYPES, type LearningTypeId } from "../data/learningTypes.ts";
import { getRecipe, RECIPES, type Recipe } from "../data/recipes.ts";
import { isNaturalNumber, multiplyStrings } from "../lib/decimal.ts";
import { randomInt, type Rng } from "../lib/rng.ts";
import { drawFromDeck, type DeckState } from "../lib/deck.ts";
import type { IngredientTask, Order } from "./types.ts";

export interface OrderSettings {
  enabledTypes: LearningTypeId[];
  recipeIds: string[];
  customerIds: string[];
}

/** 레시피가 여러 병 주문에 쓰일 수 있는가: 모든 학습 재료가 소수이고, 그 유형이 켜져 있어야 한다 */
export function multiBottleTypes(recipe: Recipe): (LearningTypeId | null)[] {
  return recipe.additives.map((ad) => classifyProduct(ad.amount, "2"));
}

/** 켜진 학습 유형으로 낼 수 있는 여러 병 주문 조합 키 목록 */
export function multiBottleKeys(settings: OrderSettings): string[] {
  const keys: string[] = [];
  for (const recipeId of settings.recipeIds) {
    const recipe = getRecipe(recipeId);
    const types = multiBottleTypes(recipe);
    // 자연수 기본량 재료가 섞이면 자연수×자연수가 되므로 여러 병 주문에서 제외
    if (types.some((t) => t === null)) continue;
    // 이 주문의 모든 문제 유형이 켜져 있어야 한다
    if (!types.every((t) => t !== null && settings.enabledTypes.includes(t))) continue;
    const ranges = types.map((t) => LEARNING_TYPES[t as LearningTypeId].bottleRange ?? { min: 2, max: 9 });
    const min = Math.max(...ranges.map((r) => r.min));
    const max = Math.min(...ranges.map((r) => r.max));
    for (let n = min; n <= max; n++) keys.push(`multiBottle:${recipeId}:${n}`);
  }
  return keys;
}

/** 켜진 유형마다 출제 가능한 레시피가 있는지 확인 (없는 유형을 알려 준다. 기본량은 바꾸지 않는다) */
export function uncoveredTypes(settings: OrderSettings): LearningTypeId[] {
  const covered = new Set<LearningTypeId>();
  for (const key of multiBottleKeys(settings)) {
    const recipe = getRecipe(key.split(":")[1]);
    for (const t of multiBottleTypes(recipe)) if (t) covered.add(t);
  }
  return settings.enabledTypes.filter((t) => !covered.has(t));
}

function pick<T>(items: readonly T[], rng: Rng): T {
  return items[randomInt(rng, items.length)];
}

export function createOrderFromKey(
  key: string,
  orderNumber: number,
  customerId: string,
  rng: Rng,
): Order {
  const [kind, recipeId, bottlesText] = key.split(":");
  if (kind !== "multiBottle") throw new Error(`아직 지원하지 않는 주문 유형: ${kind}`);
  const recipe = getRecipe(recipeId);
  const bottles = Number(bottlesText);
  if (!isNaturalNumber(bottlesText) || bottles < 2) throw new Error(`잘못된 병 수: ${bottlesText}`);

  const tasks: IngredientTask[] = recipe.additives.map((ad) => {
    const ingredient = getIngredient(ad.ingredientId);
    const learningType = classifyProduct(ad.amount, bottlesText);
    if (!learningType) throw new Error(`${recipe.name}의 ${ingredient.name}은 여러 병 주문 문제로 쓸 수 없습니다.`);
    return {
      ingredientId: ad.ingredientId,
      problem: {
        a: ad.amount,
        b: bottlesText,
        answer: multiplyStrings(ad.amount, bottlesText),
        learningType,
        unit: ingredient.unit,
        bMeaning: "bottles",
      },
      status: "pending",
      attempts: 0,
      firstAnswer: null,
      firstCorrect: null,
      hintLevel: 0,
      lastWrongAnswer: null,
    };
  });

  const customer = getCustomer(customerId);
  const values = { potion: recipe.name, bottles };
  return {
    id: `order-${orderNumber}`,
    kind: "multiBottle",
    customerId,
    recipeId,
    bottles,
    tasks,
    autoAdditions: [
      {
        name: recipe.baseSolution.name,
        amount: multiplyStrings(recipe.baseSolution.amountMl, bottlesText),
        unit: "mL",
        note: `1병에 ${recipe.baseSolution.amountMl}mL씩 자동으로 담아요`,
      },
    ],
    status: "arrived",
    price: recipe.pricePerBottle * bottles,
    deckKey: key,
    lines: {
      greet: pick(customer.lines.greet, rng),
      order: fillLine(pick(customer.lines.order, rng), values),
      waiting: pick(customer.lines.waiting, rng),
      thanks: pick(customer.lines.thanks, rng),
    },
  };
}

export const PHASE1_SETTINGS: OrderSettings = {
  enabledTypes: ["d1xN", "d2xN"],
  recipeIds: Object.keys(RECIPES),
  customerIds: ["fox"],
};

/**
 * 하루치 주문(손님 5명)을 한꺼번에 만든다.
 * 덱에서 차례로 뽑으므로 같은 병 수가 연속으로 나오지 않는다(전날 마지막 손님과 다음 날 첫 손님 사이 포함).
 * 첫 손님만 창구에 온 상태(arrived), 나머지는 대기(queued).
 */
export function createDayOrders(
  deck: DeckState,
  nextOrderNumber: number,
  count: number,
  rng: Rng,
  settings: OrderSettings = PHASE1_SETTINGS,
): { orders: Order[]; deck: DeckState; nextOrderNumber: number } {
  const keys = multiBottleKeys(settings);
  const orders: Order[] = [];
  let d = deck;
  let n = nextOrderNumber;
  for (let i = 0; i < count; i++) {
    const drawn = drawFromDeck(d, keys, rng);
    d = drawn.deck;
    const customerId = settings.customerIds[randomInt(rng, settings.customerIds.length)];
    const order = createOrderFromKey(drawn.key, n, customerId, rng);
    orders.push({ ...order, status: i === 0 ? "arrived" : "queued" });
    n++;
  }
  return { orders, deck: d, nextOrderNumber: n };
}
