/* 이 파일은 Phase 2(저장 버전 2) 코드를 그대로 보존한 것이다. 이전 저장을 검증·마이그레이션할 때만 쓴다. 수정하지 말 것. */
import { getIngredient } from "../../data/ingredients.ts";
import { classifyProduct } from "../../data/learningTypes.ts";
import { isNaturalNumber, multiplyStrings } from "../../lib/decimal.ts";
import { randomInt, type Rng } from "../../lib/rng.ts";
import { drawFromDeck, type DeckState } from "../../lib/deck.ts";
import { LEGACY_CUSTOMERS, LEGACY_RECIPES, legacyFillLine } from "./v2data.ts";
import type { IngredientTask, Order } from "./v2types.ts";

function pick<T>(items: readonly T[], rng: Rng): T {
  return items[randomInt(rng, items.length)];
}

export function legacyCreateOrderFromKey(
  key: string,
  orderNumber: number,
  customerId: string,
  rng: Rng,
): Order {
  const [kind, recipeId, bottlesText] = key.split(":");
  if (kind !== "multiBottle") throw new Error(`아직 지원하지 않는 주문 유형: ${kind}`);
  const recipe = LEGACY_RECIPES[recipeId];
  if (!recipe) throw new Error(`알 수 없는 레시피: ${recipeId}`);
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

  const customer = LEGACY_CUSTOMERS[customerId];
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
      order: legacyFillLine(pick(customer.lines.order, rng), values),
      waiting: pick(customer.lines.waiting, rng),
      thanks: pick(customer.lines.thanks, rng),
    },
  };
}



/**
 * 하루치 주문(손님 5명)을 한꺼번에 만든다.
 * 덱에서 차례로 뽑으므로 같은 병 수가 연속으로 나오지 않는다(전날 마지막 손님과 다음 날 첫 손님 사이 포함).
 * 첫 손님만 창구에 온 상태(arrived), 나머지는 대기(queued).
 */
export function legacyCreateDayOrders(
  deck: DeckState,
  nextOrderNumber: number,
  count: number,
  rng: Rng,
  ): { orders: Order[]; deck: DeckState; nextOrderNumber: number } {
  const keys = Array.from({ length: 8 }, (_, i) => `multiBottle:starlight:${i + 2}`);
  const orders: Order[] = [];
  let d = deck;
  let n = nextOrderNumber;
  for (let i = 0; i < count; i++) {
    const drawn = drawFromDeck(d, keys, rng);
    d = drawn.deck;
    const customerId = ["fox"][randomInt(rng, 1)];
    const order = legacyCreateOrderFromKey(drawn.key, n, customerId, rng);
    orders.push({ ...order, status: i === 0 ? "arrived" : "queued" });
    n++;
  }
  return { orders, deck: d, nextOrderNumber: n };
}
