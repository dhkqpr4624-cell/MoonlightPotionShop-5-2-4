/**
 * 주문서 힌트(재료별 식)와 오답 뒤 계산 과정 해설. 모두 실제 문제 데이터에서 만든다.
 *  힌트: 재료별로 필요한 식만 (계산 결과·정답 없음)
 *  해설: 주문 조건 → 필요한 식 → 자연수 계산 → 소수점 처리 → 단위와 결과 (답을 낸 뒤에만)
 */
import { getIngredient } from "../data/ingredients.ts";
import { getLifeItem } from "../data/lifeItems.ts";
import { compare, normalize, parseDecimal } from "../lib/decimal.ts";
import { copula, josa } from "../lib/josa.ts";
import { diagnoseWrong } from "./feedback.ts";
import type { IngredientTask, Order, ShiftChoice } from "./types.ts";

const ONE = parseDecimal("1");

function fraction(scale: number): string {
  return scale === 0 ? "1" : `1/${"1" + "0".repeat(scale)}`;
}

export const CHOICE_LABEL: Record<ShiftChoice, string> = { x10: "10배", same: "같음", d10: "1/10배" };

/** 주문 조건을 한 줄로 (해설 첫 줄) */
function conditionLine(order: Order, task: IngredientTask): string {
  const ing = getIngredient(task.ingredientId);
  const p = task.problem;
  const given = order.kind === "customAmount";
  switch (p.bMeaning) {
    case "bottles":
      return given
        ? `손님이 정한 1병당 ${ing.name} 양은 ${p.a}${p.unit}, 주문은 ${p.b}병이에요.`
        : `1병에는 ${ing.name} ${josa(`${p.a}${p.unit}`, "이/가")} 필요하고, 주문은 ${p.b}병이에요.`;
    case "multiplier":
      return given
        ? `손님이 알려 준 ${ing.name} 기준 양은 ${p.a}${p.unit}, 주문은 그 ${p.b}배예요.`
        : `레시피북의 ${ing.name} 기본량은 ${p.a}${p.unit}, 주문은 기본 레시피의 ${p.b}배예요.`;
    case "itemCount":
    case "itemRatio": {
      const item = getLifeItem(order.life!.itemId);
      return p.bMeaning === "itemCount"
        ? `${item.name} 1${item.counter}의 양은 ${p.a}${item.unit}, ${p.b}${item.counter}의 ${josa(item.measureWord, "을/를")} 구해요.`
        : `${item.name}의 양은 ${p.a}${item.unit}, 그 ${p.b}배를 구해요.`;
    }
    default:
      return "";
  }
}

/** 실제 숫자를 쓴 계산 과정 (정답 포함) */
export function solutionSteps(order: Order, task: IngredientTask): string[] {
  const p = task.problem;
  const ing = getIngredient(task.ingredientId);

  if (task.mode === "specified") {
    return [
      `${ing.name}는 계산하지 않는 재료예요. 주문 메모에 '레시피북의 1병 기본량 그대로'라고 적혀 있어요.`,
      `레시피북에서 ${ing.name}의 1병 기본량을 찾으면 ${copula(`${p.answer}${p.unit}`)}.`,
      `그래서 ${ing.name} ${josa(`${p.answer}${p.unit}`, "을/를")} 넣어요.`,
    ];
  }

  if (task.mode === "concept" && task.concept) {
    const c = task.concept;
    const aChange = compare(parseDecimal(c.newA), parseDecimal(c.refA));
    const bChange = compare(parseDecimal(c.newB), parseDecimal(c.refB));
    const desc = (from: string, to: string, ch: number) =>
      ch === 0 ? `${josa(from, "은/는")} 그대로예요` : `${josa(from, "이/가")} ${to}로 ${ch > 0 ? "10배" : "1/10배"}가 되었어요`;
    const lines = [
      `지난번 식은 ${c.refA} × ${c.refB} = ${c.refProduct}, 이번 식은 ${c.newA} × ${c.newB}예요.`,
      `${desc(c.refA, c.newA, aChange)}. ${desc(c.refB, c.newB, bChange)}.`,
    ];
    if (c.correct === "same") lines.push("하나는 10배, 다른 하나는 1/10배가 되었으니 곱은 지난번과 같아요.");
    else lines.push(`곱하는 수 하나가 ${CHOICE_LABEL[c.correct]}가 되면 곱도 ${CHOICE_LABEL[c.correct]}가 돼요.`);
    lines.push(`그래서 이번 곱은 지난번의 '${CHOICE_LABEL[c.correct]}'이고, ${c.refProduct}의 ${CHOICE_LABEL[c.correct]}인 ${copula(`${p.answer}${p.unit}`)}.`);
    return lines;
  }

  const A = normalize(parseDecimal(p.a));
  const B = normalize(parseDecimal(p.b));
  const AN = A.digits.toString();
  const BN = B.digits.toString();
  const product = (A.digits * B.digits).toString();
  const scale = A.scale + B.scale;
  const lines: string[] = [conditionLine(order, task)];

  if (p.bMeaning === "bottles" || p.bMeaning === "itemCount") {
    const n = Number(p.b);
    const what = p.bMeaning === "bottles" ? `${p.b}병` : `${p.b}개`;
    lines.push(
      n <= 5
        ? `${what}이면 ${Array.from({ length: n }, () => p.a).join(" + ")}이니까 ${p.a} × ${josa(p.b, "을/를")} 계산해요.`
        : `${what}이면 ${josa(p.a, "을/를")} ${p.b}번 더한 것이니까 ${p.a} × ${josa(p.b, "을/를")} 계산해요.`,
    );
  } else {
    lines.push(`${p.b}배는 ${josa(p.b, "을/를")} 곱한다는 뜻이니까 ${p.a} × ${josa(p.b, "을/를")} 계산해요.`);
    const c = compare(B, ONE);
    if (c < 0) lines.push(`${josa(p.b, "은/는")} 1보다 작으니까, 답은 ${p.a}보다 작아져요. 1보다 작은 수를 곱하면 원래보다 적어지거든요.`);
    else if (c > 0) lines.push(`${josa(p.b, "은/는")} 1보다 크니까, 답은 ${p.a}보다 커져요.`);
  }

  lines.push(`소수점을 떼고 자연수로 계산하면 ${AN} × ${BN} = ${product}예요.`);
  const parts: string[] = [];
  if (A.scale > 0) parts.push(`${josa(p.a, "은/는")} ${AN}의 ${fraction(A.scale)}`);
  if (B.scale > 0) parts.push(`${josa(p.b, "은/는")} ${BN}의 ${fraction(B.scale)}`);
  const raw = scale > 0 ? (product.padStart(scale + 1, "0").slice(0, -scale) + "." + product.padStart(scale + 1, "0").slice(-scale)) : product;
  const sameAsRaw = raw === p.answer;
  lines.push(
    `${parts.join("이고, ")}이니까 곱은 ${product}의 ${fraction(scale)}인 ${copula(raw)}.` +
      (sameAsRaw ? "" : ` (${josa(raw, "은/는")} ${josa(p.answer, "과/와")} 같은 수예요.)`),
  );
  if (p.bMeaning === "itemCount" || p.bMeaning === "itemRatio") {
    lines.push(`이 계산 결과의 숫자 ${josa(p.answer, "을/를")} ${ing.name}의 양으로 써요. 그래서 ${ing.name} ${josa(`${p.answer}${p.unit}`, "이/가")} 필요해요. (단위를 바꾼 것이 아니라 숫자만 쓴 거예요.)`);
  } else {
    lines.push(`그래서 ${ing.name} ${josa(`${p.answer}${p.unit}`, "이/가")} 필요해요.`);
  }
  return lines;
}

/**
 * 주문서 팝업의 '힌트': 이 주문에서 계량하는 재료마다 필요한 식 한 줄 (실제 주문 데이터로 만든다).
 *  - 계산 과제: "기력초: 0.6 × 3을 계산해 보세요." — 계산 결과·정답·풀이 단계는 넣지 않는다
 *  - 지정량 과제: 새 식을 만들지 않고, 정해진 양을 확인하도록 안내
 *  - 비교 과제: 비교할 두 식과 살펴볼 관계만
 */
export interface OrderHint {
  ingredientId: string;
  name: string;
  mode: IngredientTask["mode"];
  text: string;
}

export function orderHints(order: Order): OrderHint[] {
  return order.tasks.map((t) => {
    const ing = getIngredient(t.ingredientId);
    const p = t.problem;
    let text: string;
    if (t.mode === "specified") {
      text = "계산하지 않아요. 레시피북에서 1병당 양을 확인하고 그대로 넣어요.";
    } else if (t.mode === "concept" && t.concept) {
      const c = t.concept;
      text = `지난번 식 ${c.refA} × ${josa(c.refB, "과/와")} 이번 식 ${c.newA} × ${josa(c.newB, "을/를")} 비교해 보세요. 곱하는 두 수가 각각 몇 배가 되었는지 살펴보세요.`;
    } else {
      text = `${p.a} × ${josa(p.b, "을/를")} 계산해 보세요.`;
    }
    return { ingredientId: ing.id, name: ing.name, mode: t.mode, text };
  });
}

/** 결과 확인 문구: 입력한 양 / 필요한 양 + (분명할 때만) 오답 원인 */
export function resultSummary(task: IngredientTask): { headline: string; note: string | null } {
  const p = task.problem;
  const ing = getIngredient(task.ingredientId);
  if (task.mode === "concept" && task.concept) {
    return task.correct
      ? { headline: `정답이에요! 이번 양은 지난번의 ${CHOICE_LABEL[task.concept.correct]}예요.`, note: null }
      : { headline: `고른 답 '${CHOICE_LABEL[task.submitted as ShiftChoice]}' · 정답과 달라요`, note: null };
  }
  if (task.correct) {
    const same = task.submitted && task.submitted !== p.answer ? `${josa(task.submitted, "과/와")} ${josa(p.answer, "은/는")} 같은 수예요.` : null;
    return { headline: `정확해요! ${ing.name} ${p.answer}${p.unit}`, note: same };
  }
  let note: string | null = null;
  if (task.mode === "calc" && task.submitted) {
    try {
      const cause = diagnoseWrong(p, task.submitted);
      if (cause === "decimalPoint") note = "숫자는 맞게 곱했어요. 소수점 위치가 달라요.";
      else if (cause === "added") note = "곱하지 않고 더한 것 같아요.";
    } catch {
      note = null;
    }
  }
  return { headline: "입력한 양 · 필요한 양과 달라요", note };
}
