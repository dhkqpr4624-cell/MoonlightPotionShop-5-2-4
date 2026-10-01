/**
 * 힌트(3단계)와 계산 과정 해설. 모두 실제 문제 데이터에서 만든다.
 *  힌트 1: 답의 크기 어림
 *  힌트 2: 필요한 식과 계산 방법 (정답은 아직 말하지 않음)
 *  힌트 3: 실제 숫자로 계산 과정과 정답
 * 해설: 주문 조건 → 필요한 식 → 자연수 계산 → 소수점 처리 → 단위와 결과
 */
import { getIngredient } from "../data/ingredients.ts";
import { getLifeItem } from "../data/lifeItems.ts";
import { compare, equals, multiply, normalize, parseDecimal, toDecimalString, type Decimal } from "../lib/decimal.ts";
import { copula, josa } from "../lib/josa.ts";
import { diagnoseWrong } from "./feedback.ts";
import type { HintVisual, IngredientTask, Order, ShiftChoice } from "./types.ts";

export interface HintCard {
  title: string;
  lines: string[];
  visual?: HintVisual;
}

const ONE = parseDecimal("1");

function fraction(scale: number): string {
  return scale === 0 ? "1" : `1/${"1" + "0".repeat(scale)}`;
}

function unitText(scale: number): string {
  return scale === 0 ? "1" : `0.${"0".repeat(scale - 1)}1`;
}

function floorDec(d: Decimal): Decimal {
  const n = normalize(d);
  return { digits: n.digits / 10n ** BigInt(n.scale), scale: 0 };
}
function ceilDec(d: Decimal): Decimal {
  const f = floorDec(d);
  return equals(f, d) ? f : { digits: f.digits + 1n, scale: 0 };
}
const s = (d: Decimal) => toDecimalString(d);

export const CHOICE_LABEL: Record<ShiftChoice, string> = { x10: "10배", same: "같음", d10: "1/10배" };

/** 주문 조건을 한 줄로 (해설 첫 줄) */
function conditionLine(order: Order, task: IngredientTask): string {
  const ing = getIngredient(task.ingredientId);
  const p = task.problem;
  switch (p.bMeaning) {
    case "bottles":
      return `1병에는 ${ing.name} ${josa(`${p.a}${p.unit}`, "이/가")} 필요하고, 주문은 ${p.b}병이에요.`;
    case "multiplier":
      return `레시피북의 ${ing.name} 기본량은 ${p.a}${p.unit}, 주문은 기본 레시피의 ${p.b}배예요.`;
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

function expression(task: IngredientTask): string {
  return `${task.problem.a} × ${task.problem.b}`;
}

/** 답의 크기 어림 문장 */
export function estimateLine(task: IngredientTask): string {
  const p = task.problem;
  const a = parseDecimal(p.a);
  const b = parseDecimal(p.b);
  const u = p.bMeaning === "itemCount" || p.bMeaning === "itemRatio" ? "" : p.unit;
  if (normalize(b).scale === 0) {
    // a × 자연수: a보다 크고 (a 올림) × b 보다 작다
    const up = multiply(ceilDec(a), b);
    const exact = equals(ceilDec(a), a);
    const lowFloor = multiply(floorDec(a), b);
    const lower = compare(lowFloor, a) > 0 ? lowFloor : a;
    return exact
      ? `${josa(p.a, "을/를")} ${p.b}번 더한 것이니까 ${p.a}${u}보다 커요.`
      : `${josa(p.a, "을/를")} ${p.b}번 더한 것이니까 ${s(lower)}${u}보다 크고, ${s(ceilDec(a))} × ${p.b} = ${s(up)}${u}보다 작아요.`;
  }
  const c = compare(b, ONE);
  if (c < 0) return `${p.a}의 ${p.b}배이고 ${josa(p.b, "은/는")} 1보다 작으니까, 답은 ${p.a}${u}보다 작아요.`;
  return `${p.a}의 ${p.b}배이고 ${josa(p.b, "은/는")} 1보다 크니까, 답은 ${p.a}${u}보다 커요.`;
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
    lines.push(`그래서 이번 곱은 지난번의 '${CHOICE_LABEL[c.correct]}'이고, ${c.refProduct}의 ${CHOICE_LABEL[c.correct]}인 ${copula(`${p.answer}mL`)}.`);
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

/** 힌트 카드 (level 1~3) */
export function hintCard(order: Order, task: IngredientTask, level: number): HintCard {
  const p = task.problem;
  const ing = getIngredient(task.ingredientId);
  if (task.mode === "specified") {
    if (level <= 1) return { title: "힌트 1 · 무엇을 넣을까?", lines: [`${ing.name}는 계산하지 않아요. 주문 메모를 다시 읽어 보세요.`] };
    if (level === 2) return { title: "힌트 2 · 어디서 찾을까?", lines: [`주문 메모에 '1병 기본량 그대로'라고 적혀 있어요. 레시피북에서 ${ing.name}의 1병당 양을 찾아보세요.`] };
    return { title: "힌트 3 · 정답", lines: solutionSteps(order, task) };
  }
  if (task.mode === "concept" && task.concept) {
    const c = task.concept;
    if (level <= 1) return { title: "힌트 1 · 무엇이 바뀌었을까?", lines: [`${c.refA} → ${c.newA}, ${c.refB} → ${c.newB}. 두 식에서 바뀐 수를 찾아보세요. 소수점이 어느 쪽으로 몇 칸 움직였나요?`] };
    if (level === 2) return { title: "힌트 2 · 곱의 변화 규칙", lines: [
      "곱하는 수 하나가 10배가 되면 곱도 10배가 돼요.",
      "곱하는 수 하나가 1/10배가 되면 곱도 1/10배가 돼요.",
      "하나는 10배, 다른 하나는 1/10배가 되면 곱은 같아요.",
    ] };
    return { title: "힌트 3 · 풀이와 정답", lines: solutionSteps(order, task) };
  }
  if (level <= 1) return { title: "힌트 1 · 답의 크기 어림하기", lines: [estimateLine(task)] };
  if (level === 2) {
    const A = normalize(parseDecimal(p.a));
    const B = normalize(parseDecimal(p.b));
    return {
      title: "힌트 2 · 필요한 식과 계산 방법",
      lines: [
        `필요한 식: ${expression(task)}`,
        "소수점을 떼고 자연수처럼 곱해요.",
        `곱하는 두 수의 소수점 아래 자릿수를 더하면 ${A.scale} + ${B.scale} = ${A.scale + B.scale}자리예요. 곱도 소수점 아래 ${A.scale + B.scale}자리가 되게 소수점을 찍어요.`,
      ],
    };
  }
  const A = normalize(parseDecimal(p.a));
  const B = normalize(parseDecimal(p.b));
  let visual: HintVisual | undefined;
  if ((p.bMeaning === "bottles" || p.bMeaning === "itemCount") && A.scale > 0 && Number(A.digits) <= 30 && Number(p.b) <= 10) {
    visual = { kind: "unitBlocks", perGroup: Number(A.digits), groups: Number(p.b), unitLabel: unitText(A.scale) };
  }
  void B;
  return { title: "힌트 3 · 계산 과정과 정답", lines: solutionSteps(order, task), visual };
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
