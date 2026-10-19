/**
 * 주문 생성 (Phase 3).
 *
 * 주문 유형
 *  - multiBottle:      고정 기본량 × 병 수            (레시피 주문)
 *  - customMultiplier: 고정 기본량 × 배수 (1병)       (레시피 주문, 기본 용액도 같은 배수)
 *  - lifeItem:         생활 소재 계산 결과 → 한 재료량 (손님 지정 특별 주문, 다른 재료는 기본량)
 *  - pointShift:       ⑦ 곱의 변화 비교 개념 문제      (손님 지정 특별 주문, 다른 재료는 기본량)
 *
 * 문제를 만들려고 레시피 기본량을 바꾸지 않는다. 출제 후보는 '현재 소개된 유형' 안에서
 * 미리 목록으로 만든 뒤 덱에서 뽑으므로 무한 재시도가 없다.
 */
import { pickAppearance } from "../data/appearances.ts";
import { CUSTOMER_IDS, fillLine, getCustomer } from "../data/customers.ts";
import {
  AMOUNT_BASE_EASY, AMOUNT_BASE_ORIGINAL, AMOUNT_PER_EASY, AMOUNT_PER_ORIGINAL,
  CUSTOM_EASY, CUSTOM_LESS_NOTE, CUSTOM_MORE_NOTE, CUSTOM_ORIGINAL_LESS, CUSTOM_ORIGINAL_MORE,
  LIFE_EACH_EASY, LIFE_EACH_ORIGINAL, LIFE_RATIO_EASY, LIFE_RATIO_ORIGINAL, LIFE_RULE_NOTE,
  MULTI_EASY, MULTI_ORIGINAL, OTHER_INGREDIENT_NOTE, SHIFT_EASY, SHIFT_ORIGINAL,
} from "../data/dialogues.ts";
import { getIngredient } from "../data/ingredients.ts";
import {
  classifyProduct, inRange, INTRO_STAGES, introducedTypes, type LearningTypeId,
} from "../data/learningTypes.ts";
import { getLifeItem, LIFE_ITEMS } from "../data/lifeItems.ts";
import { getRecipe, type Recipe } from "../data/recipes.ts";
import { availableRecipes, freeIngredients } from "./unlocks.ts";
import {
  compare, isNaturalNumber, multiplyStrings, parseDecimal, shiftPoint, toDecimalString,
} from "../lib/decimal.ts";
import { drawFromDeck, EMPTY_DECK, type DeckState } from "../lib/deck.ts";
import { copula, josa } from "../lib/josa.ts";
import { randomInt, shuffle, type Rng } from "../lib/rng.ts";
import {
  CUSTOMERS_PER_DAY,
  type ConceptData,
  type IngredientTask,
  type Order,
  type OrderKind,
  type OrderScript,
  type Problem,
  type ReviewCandidate,
  type ShiftChoice,
} from "./types.ts";

/* ------------------------------------------------------------------ */
/* 출제 후보 (키)                                                       */
/* ------------------------------------------------------------------ */

export const BOTTLE_COUNTS = ["2", "3", "4", "5", "6", "7", "8", "9"];
/** 소수 한 자리 배수 (0.2~2.5) */
export const MULTIPLIERS_D1 = ["0.2", "0.3", "0.4", "0.5", "0.6", "0.8", "1.2", "1.5"];
/** 소수 두 자리 배수 (0.12~1.25) — 자연수 기본량(④)에만 */
export const MULTIPLIERS_D2 = ["0.15", "0.25", "0.35", "0.45", "0.75", "1.25"];
/** 손님 지정량 주문: 1병당 양(소수 두 자리) — ② */
export const GIVEN_D2 = ["0.15", "0.25", "0.35", "0.45", "0.75", "1.25"];
/** 손님 지정량 주문: 기준 양(자연수) — ③④ */
export const GIVEN_NATURAL = ["2", "3", "4", "5", "6", "7", "8", "9"];
/** ⑦ 기준 식 a × b */
export const SHIFT_BASE_A = ["0.6", "0.8", "1.2", "1.5", "2.4"];
export const SHIFT_BASE_B = ["3", "4", "6"];
export type ShiftVariant = "aX10" | "aD10" | "bX10" | "bD10" | "swap";
export const SHIFT_VARIANTS: ShiftVariant[] = ["aX10", "aD10", "bX10", "bD10", "swap"];

const norm = (s: string) => toDecimalString(parseDecimal(s));

/** 주문 키 하나가 담는 계산 문제들의 유형 */
/** 처음 해금 상태(무료 재료)로 쓸 수 있는 레시피 — 인자를 주지 않았을 때의 기본값 */
export function defaultRecipes(): Recipe[] {
  return availableRecipes(freeIngredients());
}

export interface Candidate {
  key: string;
  kind: OrderKind;
  /** 계산·비교 문제의 유형 (지정량 과제 제외) */
  types: LearningTypeId[];
  /** 계산·비교 문제의 인수 (복습에서 원래 인수와 다른지 비교) */
  factors: { type: LearningTypeId; a: string; b: string }[];
}

function recipeTypes(recipe: Recipe, b: string) {
  return recipe.additives.map((ad) => ({ type: classifyProduct(ad.amount, b), a: norm(ad.amount), b: norm(b) }));
}

export function multiBottleCandidates(intro: LearningTypeId[], recipes: Recipe[] = defaultRecipes()): Candidate[] {
  const out: Candidate[] = [];
  for (const recipe of recipes) {
    for (const n of BOTTLE_COUNTS) {
      const f = recipeTypes(recipe, n);
      if (f.some((x) => !x.type || !intro.includes(x.type) || !recipe.supports.multiBottle.includes(x.type))) continue;
      out.push({ key: `multiBottle:${recipe.id}:${n}`, kind: "multiBottle", types: f.map((x) => x.type!), factors: f as Candidate["factors"] });
    }
  }
  return out;
}

export function customCandidates(intro: LearningTypeId[], recipes: Recipe[] = defaultRecipes()): Candidate[] {
  const out: Candidate[] = [];
  for (const recipe of recipes) {
    for (const m of [...MULTIPLIERS_D1, ...MULTIPLIERS_D2]) {
      const f = recipeTypes(recipe, m);
      if (f.some((x) => !x.type || !intro.includes(x.type) || !recipe.supports.customMultiplier.includes(x.type))) continue;
      out.push({ key: `custom:${recipe.id}:${m}`, kind: "customMultiplier", types: f.map((x) => x.type!), factors: f as Candidate["factors"] });
    }
  }
  return out;
}

/**
 * 손님 지정량 주문 (재료 1종 레시피만). 레시피 기본량을 바꾸지 않고, 손님이 정한 양으로 다른 인수 구조를 낸다.
 *  perBottle: 1병당 소수 두 자리 × 병 수 → ②
 *  base:      자연수 기준 양 × 소수 한·두 자리 배수 → ③④,  소수 두 자리 기준 양 × 소수 한 자리 배수 → ⑥
 */
export function amountCandidates(intro: LearningTypeId[], recipes: Recipe[] = defaultRecipes()): Candidate[] {
  const out: Candidate[] = [];
  const add = (recipe: Recipe, form: "perBottle" | "base", a: string, b: string) => {
    const t = classifyProduct(a, b);
    if (!t || !intro.includes(t) || !inRange(a) || !inRange(b)) return;
    out.push({ key: `amount:${recipe.id}:${form}:${a}:${b}`, kind: "customAmount", types: [t], factors: [{ type: t, a: norm(a), b: norm(b) }] });
  };
  for (const recipe of recipes) {
    if (recipe.additives.length !== 1) continue;
    for (const a of GIVEN_D2) for (const n of BOTTLE_COUNTS) add(recipe, "perBottle", a, n);
    for (const a of GIVEN_NATURAL) for (const m of [...MULTIPLIERS_D1, ...MULTIPLIERS_D2]) add(recipe, "base", a, m);
    for (const a of GIVEN_D2) for (const m of MULTIPLIERS_D1) add(recipe, "base", a, m);
  }
  return out;
}

export function lifeCandidates(intro: LearningTypeId[], recipes: Recipe[] = defaultRecipes()): Candidate[] {
  const out: Candidate[] = [];
  if (!recipes.length) return out;
  for (const item of Object.values(LIFE_ITEMS)) {
    for (const [a, b] of item.pairs) {
      const t = classifyProduct(a, b);
      if (!t || !intro.includes(t)) continue;
      out.push({ key: `life:${item.id}:${a}:${b}`, kind: "lifeItem", types: [t], factors: [{ type: t, a: norm(a), b: norm(b) }] });
    }
  }
  return out;
}

export function shiftCandidates(intro: LearningTypeId[], recipes: Recipe[] = defaultRecipes()): Candidate[] {
  if (!intro.includes("shift") || !recipes.length) return [];
  const out: Candidate[] = [];
  for (const a of SHIFT_BASE_A) for (const b of SHIFT_BASE_B) for (const v of SHIFT_VARIANTS) {
    const c = shiftConcept(a, b, v);
    out.push({ key: `shift:${a}:${b}:${v}`, kind: "pointShift", types: ["shift"], factors: [{ type: "shift", a: c.newA, b: c.newB }] });
  }
  return out;
}

export function shiftConcept(refA: string, refB: string, v: ShiftVariant): ConceptData {
  const A = parseDecimal(refA);
  const B = parseDecimal(refB);
  const s = (d: ReturnType<typeof parseDecimal>, k: number) => toDecimalString(shiftPoint(d, k));
  const [newA, newB, correct]: [string, string, ShiftChoice] =
    v === "aX10" ? [s(A, 1), refB, "x10"]
    : v === "aD10" ? [s(A, -1), refB, "d10"]
    : v === "bX10" ? [refA, s(B, 1), "x10"]
    : v === "bD10" ? [refA, s(B, -1), "d10"]
    : [s(A, 1), s(B, -1), "same"];
  return { refA, refB, refProduct: multiplyStrings(refA, refB), newA, newB, correct };
}

export function candidatesFor(kind: OrderKind, intro: LearningTypeId[], recipes: Recipe[] = defaultRecipes()): Candidate[] {
  switch (kind) {
    case "multiBottle": return multiBottleCandidates(intro, recipes);
    case "customMultiplier": return customCandidates(intro, recipes);
    case "customAmount": return amountCandidates(intro, recipes);
    case "lifeItem": return lifeCandidates(intro, recipes);
    case "pointShift": return shiftCandidates(intro, recipes);
  }
}

export const ORDER_KINDS: OrderKind[] = ["multiBottle", "customMultiplier", "customAmount", "lifeItem", "pointShift"];

/** 데이터 검증: 소개된 유형마다 낼 수 있는 주문 후보가 있는지 (없는 유형 목록) */
export function uncoveredTypes(intro: LearningTypeId[], recipes: Recipe[] = defaultRecipes()): LearningTypeId[] {
  const covered = new Set<LearningTypeId>();
  for (const k of ORDER_KINDS) {
    for (const c of candidatesFor(k, intro, recipes)) c.types.forEach((t) => covered.add(t));
  }
  return intro.filter((t) => !covered.has(t));
}

/* ------------------------------------------------------------------ */
/* 주문 만들기                                                          */
/* ------------------------------------------------------------------ */

function pick<T>(items: readonly T[], rng: Rng): T {
  return items[randomInt(rng, items.length)];
}

function blankTask(orderId: string, ingredientId: string, mode: IngredientTask["mode"], problem: Problem): IngredientTask {
  return {
    problemId: `${orderId}:${ingredientId}`,
    ingredientId,
    mode,
    problem,
    concept: null,
    status: "pending",
    submitted: null,
    correct: null,
    addedAmount: null,
    hintLevel: 0,
    explanationViewed: false,
    reviewOf: null,
    attempts: 0,
    firstAnswer: null,
    firstCorrect: null,
    lastWrongAnswer: null,
  };
}

function calcTask(orderId: string, ingredientId: string, a: string, b: string, bMeaning: Problem["bMeaning"]): IngredientTask {
  const ing = getIngredient(ingredientId);
  const learningType = classifyProduct(a, b);
  if (!learningType) throw new Error(`범위 밖 문제: ${a} × ${b}`);
  return blankTask(orderId, ingredientId, "calc", {
    a, b, answer: multiplyStrings(a, b), learningType, unit: ing.unit, bMeaning,
  });
}

function specifiedTask(orderId: string, ingredientId: string, amount: string): IngredientTask {
  const ing = getIngredient(ingredientId);
  return blankTask(orderId, ingredientId, "specified", {
    a: amount, b: "1", answer: norm(amount), learningType: null, unit: ing.unit, bMeaning: "given",
  });
}

/** 계량 단위 안내 (예: "기력초는 g으로 계량", 이전 레시피는 "달빛 이슬은 mL, 별가루는 g으로 계량") */
export function unitMemo(recipe: Recipe): string {
  return recipe.additives.map((ad) => { const i = getIngredient(ad.ingredientId); return `${josa(i.name, "은/는")} ${i.unit}`; }).join(", ") + "으로 계량";
}

function baseSolution(recipe: Recipe, times: string, note: string) {
  return [{ name: recipe.baseSolution.name, amount: multiplyStrings(recipe.baseSolution.amountMl, times), unit: "mL" as const, note }];
}

export interface BuildContext {
  orderNumber: number;
  customerId: string;
  rng: Rng;
  /** 생활 소재·비교 주문에 쓸 레시피 후보 (주지 않으면 처음 해금 상태의 레시피) */
  recipes?: Recipe[];
}

/** 키에서 주문을 만든다. 같은 키 + 같은 난수면 같은 주문 */
export function createOrderFromKey(key: string, ctx: BuildContext): Order {
  const parts = key.split(":");
  const id = `order-${ctx.orderNumber}`;
  const customer = getCustomer(ctx.customerId);
  const greet = pick(customer.lines.greet, ctx.rng);
  const waiting = pick(customer.lines.waiting, ctx.rng);
  const base = { id, rules: 3 as const, customerId: ctx.customerId, status: "arrived" as const, quality: null, reward: null,
    stirProgress: 0, askCount: 0, deckKey: key, reviewCandidateId: null };

  if (parts[0] === "multiBottle") {
    const recipe = getRecipe(parts[1]);
    const n = parts[2];
    if (!isNaturalNumber(n)) throw new Error(`잘못된 병 수: ${n}`);
    const v = { potion: recipe.name, n };
    const script: OrderScript = {
      greet, waiting, reaction: null,
      original: fillLine(pick(MULTI_ORIGINAL, ctx.rng), v),
      easy: fillLine(MULTI_EASY, v),
      memo: [`포션: ${recipe.name} ${n}병`, "재료: 레시피북의 1병당 양으로 " + n + "병만큼", unitMemo(recipe)],
    };
    return {
      ...base, kind: "multiBottle", recipeId: recipe.id, bottles: Number(n), multiplier: null, life: null,
      tasks: recipe.additives.map((ad) => calcTask(id, ad.ingredientId, ad.amount, n, "bottles")),
      autoAdditions: baseSolution(recipe, n, `1병에 ${recipe.baseSolution.amountMl}mL씩 자동으로 담아요`),
      price: recipe.pricePerBottle * Number(n),
      script,
    };
  }

  if (parts[0] === "custom") {
    const recipe = getRecipe(parts[1]);
    const m = parts[2];
    const less = compare(parseDecimal(m), parseDecimal("1")) < 0;
    const v = { potion: recipe.name, m };
    const script: OrderScript = {
      greet, waiting, reaction: null,
      original: fillLine(pick(less ? CUSTOM_ORIGINAL_LESS : CUSTOM_ORIGINAL_MORE, ctx.rng), v),
      easy: fillLine(CUSTOM_EASY, { ...v, compare: fillLine(less ? CUSTOM_LESS_NOTE : CUSTOM_MORE_NOTE, v) }),
      memo: [`포션: ${recipe.name} 1병`, `맞춤: 기본 레시피의 ${m}배로`, `기본 용액도 ${m}배로 자동 조절`],
    };
    return {
      ...base, kind: "customMultiplier", recipeId: recipe.id, bottles: 1, multiplier: m, life: null,
      tasks: recipe.additives.map((ad) => calcTask(id, ad.ingredientId, ad.amount, m, "multiplier")),
      autoAdditions: baseSolution(recipe, m, `기본 용액 ${recipe.baseSolution.amountMl}mL의 ${m}배를 자동으로 담아요`),
      price: recipe.specialPrice,
      script,
    };
  }

  if (parts[0] === "amount") {
    const recipe = getRecipe(parts[1]);
    const form = parts[2] as "perBottle" | "base";
    const [a, b] = [parts[3], parts[4]];
    if (recipe.additives.length !== 1 || (form !== "perBottle" && form !== "base")) throw new Error(`잘못된 손님 지정량 주문: ${key}`);
    const ing = getIngredient(recipe.additives[0].ingredientId);
    const amt = `${a}${ing.unit}`;
    if (form === "perBottle") {
      if (!isNaturalNumber(b)) throw new Error(`잘못된 병 수: ${b}`);
      const v = { potion: recipe.name, n: b, ing: ing.name, amt };
      const script: OrderScript = {
        greet, waiting, reaction: null,
        original: fillLine(pick(AMOUNT_PER_ORIGINAL, ctx.rng), v),
        easy: fillLine(AMOUNT_PER_EASY, v),
        memo: [
          `포션: ${recipe.name} ${b}병 (손님 지정량 주문)`,
          `${ing.name}(${ing.unit}): 손님이 정한 1병당 ${amt}씩 ${b}병만큼 — 손님 지정이 레시피보다 우선`,
          `기본 용액은 1병에 ${recipe.baseSolution.amountMl}mL씩 자동`,
        ],
      };
      return {
        ...base, kind: "customAmount", recipeId: recipe.id, bottles: Number(b), multiplier: null, life: null,
        given: { form, amount: a, times: b },
        tasks: [calcTask(id, ing.id, a, b, "bottles")],
        autoAdditions: baseSolution(recipe, b, `1병에 ${recipe.baseSolution.amountMl}mL씩 자동으로 담아요`),
        price: recipe.pricePerBottle * Number(b),
        script,
      };
    }
    const less = compare(parseDecimal(b), parseDecimal("1")) < 0;
    const v = { potion: recipe.name, m: b, ing: ing.name, amt, amtIs: copula(amt) + "." };
    const script: OrderScript = {
      greet, waiting, reaction: null,
      original: fillLine(pick(AMOUNT_BASE_ORIGINAL, ctx.rng), v),
      easy: fillLine(AMOUNT_BASE_EASY, { ...v, compare: fillLine(less ? CUSTOM_LESS_NOTE : CUSTOM_MORE_NOTE, v) }),
      memo: [
        `포션: ${recipe.name} 1병 (손님 지정량 주문)`,
        `${ing.name}(${ing.unit}): 손님이 알려 준 기준 ${amt}의 ${b}배 — 손님 지정이 레시피보다 우선`,
        `기본 용액은 1병 ${recipe.baseSolution.amountMl}mL 자동`,
      ],
    };
    return {
      ...base, kind: "customAmount", recipeId: recipe.id, bottles: 1, multiplier: null, life: null,
      given: { form, amount: a, times: b },
      tasks: [calcTask(id, ing.id, a, b, "multiplier")],
      autoAdditions: baseSolution(recipe, "1", `1병 기본 용액 ${recipe.baseSolution.amountMl}mL를 자동으로 담아요`),
      price: recipe.specialPrice,
      script,
    };
  }

  if (parts[0] === "life") {
    const item = getLifeItem(parts[1]);
    const [a, b] = [parts[2], parts[3]];
    const recipe = pick(ctx.recipes ?? defaultRecipes(), ctx.rng);
    // 계산한 숫자를 넣을 재료: 레시피에 생활 소재가 정한 재료가 있으면 그것, 없으면 레시피의 첫 재료
    const targetId = recipe.additives.some((ad) => ad.ingredientId === item.targetIngredientId)
      ? item.targetIngredientId
      : recipe.additives[0].ingredientId;
    const target = getIngredient(targetId);
    const others = recipe.additives.filter((ad) => ad.ingredientId !== targetId).map((ad) => getIngredient(ad.ingredientId));
    const otherNote = others.length ? fillLine(OTHER_INGREDIENT_NOTE, { other: others.map((x) => x.name).join(", ") }) : "";
    const v = {
      quirk: item.quirk, item: item.name, counter: item.counter, amount: copula(`${a}${item.unit}`), a, b, lu: item.unit,
      measureWord: item.measureWord, ing: target.name, u: target.unit, potion: recipe.name,
    };
    const each = item.form === "each";
    const condition = each
      ? `${item.name} 1${item.counter} ${a}${item.unit}, ${b}${item.counter}의 ${item.measureWord}와 같은 숫자만큼`
      : `${item.name} ${a}${item.unit}의 ${b}배와 같은 숫자만큼`;
    const tasks = recipe.additives.map((ad) =>
      ad.ingredientId === targetId
        ? calcTask(id, ad.ingredientId, a, b, each ? "itemCount" : "itemRatio")
        : specifiedTask(id, ad.ingredientId, ad.amount),
    );
    const script: OrderScript = {
      greet, waiting, reaction: null,
      original: fillLine(each ? LIFE_EACH_ORIGINAL : LIFE_RATIO_ORIGINAL, v),
      easy: fillLine(each ? LIFE_EACH_EASY : LIFE_RATIO_EASY, v) + otherNote,
      memo: [
        `포션: ${recipe.name} 1병 (손님 지정 특별 주문)`,
        `${target.name}(${target.unit}): ${condition} — 손님 지정이 레시피보다 우선`,
        ...others.map((x) => `${x.name}(${x.unit}): 레시피북의 1병 기본량 그대로`),
        LIFE_RULE_NOTE,
      ],
    };
    return {
      ...base, kind: "lifeItem", recipeId: recipe.id, bottles: 1, multiplier: null, life: { itemId: item.id, a, b },
      tasks, autoAdditions: baseSolution(recipe, "1", `1병 기본 용액 ${recipe.baseSolution.amountMl}mL를 자동으로 담아요`),
      price: recipe.specialPrice, script,
    };
  }

  if (parts[0] === "shift") {
    const concept = shiftConcept(parts[1], parts[2], parts[3] as ShiftVariant);
    const recipe = pick(ctx.recipes ?? defaultRecipes(), ctx.rng);
    // 비교하는 재료는 레시피의 첫 재료, 나머지 재료(있으면)는 1병 기본량 그대로
    const main = getIngredient(recipe.additives[0].ingredientId);
    const rest = recipe.additives.slice(1);
    const task: IngredientTask = {
      ...blankTask(id, main.id, "concept", {
        a: concept.newA, b: concept.newB, answer: multiplyStrings(concept.newA, concept.newB), learningType: "shift",
        unit: main.unit, bMeaning: "shift",
      }),
      concept,
    };
    const v = { refA: concept.refA, refB: concept.refB, p: concept.refProduct, newA: concept.newA, newB: concept.newB, ing: main.name, u: main.unit };
    const otherNote = rest.length ? fillLine(OTHER_INGREDIENT_NOTE, { other: rest.map((ad) => getIngredient(ad.ingredientId).name).join(", ") }) : "";
    const script: OrderScript = {
      greet, waiting, reaction: null,
      original: fillLine(SHIFT_ORIGINAL, v),
      easy: fillLine(SHIFT_EASY, v) + otherNote,
      memo: [
        `포션: ${recipe.name} 1병 (손님 지정 특별 주문)`,
        `지난번 ${main.name}: ${concept.refA} × ${concept.refB} = ${concept.refProduct}${main.unit}`,
        `이번 ${main.name}: ${concept.newA} × ${concept.newB}${main.unit} — 지난번의 몇 배인지 골라요 (양은 자동 계량)`,
        ...rest.map((ad) => { const x = getIngredient(ad.ingredientId); return `${x.name}(${x.unit}): 레시피북의 1병 기본량 그대로`; }),
      ],
    };
    return {
      ...base, kind: "pointShift", recipeId: recipe.id, bottles: 1, multiplier: null, life: null,
      tasks: [task, ...rest.map((ad) => specifiedTask(id, ad.ingredientId, ad.amount))],
      autoAdditions: baseSolution(recipe, "1", `1병 기본 용액 ${recipe.baseSolution.amountMl}mL를 자동으로 담아요`),
      price: recipe.specialPrice, script,
    };
  }

  throw new Error(`알 수 없는 주문 키: ${key}`);
}

/* ------------------------------------------------------------------ */
/* 하루 주문 계획                                                        */
/* ------------------------------------------------------------------ */

export interface DayPlanInput {
  dayNumber: number;
  /** 해금한 재료 (새 주문에는 필요한 재료를 모두 해금한 레시피만 나온다). 주지 않으면 처음 해금 상태 */
  unlocked?: string[];
  introStage: number;
  /** 이 날 처음 소개하는 유형 */
  newTypes: LearningTypeId[];
  decks: Record<string, DeckState>;
  nextOrderNumber: number;
  review: ReviewCandidate[];
  rng: Rng;
  /**
   * 새로 해금되어 아직 주문에 나오지 않은 레시피 ID. 해금된 레시피라면 이 날 최소 1건 그 레시피 주문을 넣는다
   * (현재 소개된 유형으로 낼 수 있는 여러 병·맞춤 배수 주문 중에서).
   */
  featureRecipes?: string[];
}

export interface DayPlanResult {
  orders: Order[];
  decks: Record<string, DeckState>;
  nextOrderNumber: number;
  reviewCandidateId: string | null;
  /** featureRecipes 중 이 날 실제로 주문에 넣은 레시피 */
  featured: string[];
}

/** 복습 후보 중 오늘 낼 수 있는 것 (현재 소개된 유형, 바로 전날 복습에서 틀린 것은 쉬기) */
export function eligibleReview(review: ReviewCandidate[], intro: LearningTypeId[], dayNumber: number): ReviewCandidate[] {
  return review.filter(
    (c) =>
      c.status === "open" &&
      intro.includes(c.learningType) &&
      c.createdDay < dayNumber &&
      (c.lastReviewDay === null || c.lastReviewDay < dayNumber - 1),
  );
}

/** 복습 후보와 같은 유형이면서 원래와 다른 인수를 쓰는 주문 후보 */
export function reviewCandidatesFor(c: ReviewCandidate, intro: LearningTypeId[], recipes: Recipe[] = defaultRecipes()): Candidate[] {
  const kinds: OrderKind[] = c.learningType === "shift" ? ["pointShift"] : ["multiBottle", "customMultiplier", "customAmount", "lifeItem"];
  return kinds
    .flatMap((k) => candidatesFor(k, intro, recipes))
    .filter((cand) => cand.factors.some((f) => f.type === c.learningType && !(f.a === norm(c.a) && f.b === norm(c.b))));
}

function bottlesOfKey(key: string | null): string | null {
  if (!key || !key.startsWith("multiBottle:")) return null;
  return key.split(":")[2] ?? null;
}

/** 덱에서 뽑되, avoid가 참인 키는 가능하면 피한다 (남은 키 수만큼만 시도 → 무한 반복 없음) */
function drawAvoiding(deck: DeckState, keys: string[], rng: Rng, avoid: (k: string) => boolean): { key: string; deck: DeckState } {
  let d = deck;
  let first: { key: string; deck: DeckState } | null = null;
  for (let i = 0; i < keys.length; i++) {
    const r = drawFromDeck(d, keys, rng);
    if (!first) first = r;
    if (!avoid(r.key)) return r;
    // 피해야 하는 키는 덱 뒤로 보낸다
    d = { remaining: [...r.deck.remaining, r.key], lastDrawn: r.deck.lastDrawn };
  }
  return first as { key: string; deck: DeckState };
}

/**
 * 하루 손님 5명의 주문을 정한다.
 * - 처음 소개되는 유형은 그날 꼭 나오게 한다
 * - 새로 해금한 레시피는 그 다음 영업에 가능하면 1건 넣는다 (featureRecipes)
 * - 생활 소재 특별 주문 최대 1건, 비교 주문 최대 1건, 복습 주문 최대 1건
 * - 나머지는 여러 병·맞춤 배수 주문 (특별 주문은 첫 손님으로 두지 않음)
 */
export function planDay(input: DayPlanInput): DayPlanResult {
  const { rng } = input;
  const intro = introducedTypes(input.introStage);
  const recipes = availableRecipes(input.unlocked ?? freeIngredients());
  if (!recipes.length) throw new Error("해금된 레시피가 없습니다.");
  const decks = { ...input.decks };
  const keysOf = (kind: OrderKind) => candidatesFor(kind, intro, recipes).map((c) => c.key);
  const isNormal = (k: string) => { const kk = keyKind(k); return kk === "multiBottle" || kk === "customMultiplier" || kk === "customAmount"; };

  /** kind만 있으면 그 유형 덱에서, keys가 있으면 그 후보 중에서 뽑는다 */
  type Slot = { kind: OrderKind | null; keys?: string[]; reviewOf?: ReviewCandidate; special: boolean };
  const slots: Slot[] = [];

  // 새 유형 소개
  const newT = input.newTypes;
  if (newT.includes("shift")) slots.push({ kind: "pointShift", special: true });
  for (const t of newT.filter((x) => x !== "shift")) {
    // 레시피 주문으로 낼 수 있으면 그것, 없으면 손님 지정량 주문으로 (한 재료 레시피는 ②③④⑥을 지정량 주문으로 낸다)
    const recipeKeys = [...candidatesFor("multiBottle", intro, recipes), ...candidatesFor("customMultiplier", intro, recipes)]
      .filter((c) => c.types.includes(t)).map((c) => c.key);
    const keys = recipeKeys.length ? recipeKeys
      : candidatesFor("customAmount", intro, recipes).filter((c) => c.types.includes(t)).map((c) => c.key);
    if (keys.length) slots.push({ kind: null, keys, special: false });
  }

  // 새로 해금한 레시피 첫 주문 (가능하면 1건). 그 레시피의 여러 병·맞춤 배수 주문 중 현재 소개된 유형만
  const featured: string[] = [];
  for (const rid of input.featureRecipes ?? []) {
    if (slots.length >= CUSTOMERS_PER_DAY || !recipes.some((r) => r.id === rid)) continue;
    const mine = recipes.filter((r) => r.id === rid);
    const keys = [...candidatesFor("multiBottle", intro, mine), ...candidatesFor("customMultiplier", intro, mine)].map((c) => c.key);
    if (!keys.length) continue;
    slots.push({ kind: null, keys, special: false });
    featured.push(rid);
  }

  // 복습 (하루 최대 1건)
  let reviewCandidateId: string | null = null;
  const reviewPool = eligibleReview(input.review, intro, input.dayNumber);
  if (reviewPool.length) {
    const target = reviewPool.sort((a, b) => a.createdDay - b.createdDay)[0];
    // 복습은 가능하면 일반 주문(여러 병·맞춤)으로, 안 되면 생활 소재·비교 주문으로
    const all = reviewCandidatesFor(target, intro, recipes).map((c) => c.key);
    const normal = all.filter(isNormal);
    const pool = normal.length ? normal : all;
    if (pool.length) {
      const recent = new Set(Object.values(decks).map((d) => d.lastDrawn));
      const fresh = pool.filter((k) => !recent.has(k));
      const key = pick(fresh.length ? fresh : pool, rng);
      const kind = keyKind(key);
      slots.push({ kind, keys: [key], reviewOf: target, special: kind === "lifeItem" || kind === "pointShift" });
      reviewCandidateId = target.id;
    }
  }

  // 특별 주문: 비교(⑦ 소개 후, 이미 없으면 절반 확률), 생활 소재(최대 1건)
  if (!slots.some((s) => s.kind === "pointShift") && intro.includes("shift") && rng() < 0.5) {
    slots.push({ kind: "pointShift", special: true });
  }
  if (!slots.some((x) => x.kind === "lifeItem") && keysOf("lifeItem").length && rng() < 0.7 && slots.length < CUSTOMERS_PER_DAY) {
    slots.push({ kind: "lifeItem", special: true });
  }

  // 나머지: 일반 주문 (여러 병을 중심으로, 맞춤 배수·손님 지정량 주문을 섞는다)
  const extraKinds = (["customMultiplier", "customAmount"] as OrderKind[]).filter((k) => keysOf(k).length > 0);
  while (slots.length < CUSTOMERS_PER_DAY) {
    const kind: OrderKind = extraKinds.length && rng() < 0.45 ? extraKinds[randomInt(rng, extraKinds.length)] : "multiBottle";
    slots.push({ kind, special: false });
  }
  const trimmed = slots.slice(0, CUSTOMERS_PER_DAY);

  // 순서: 특별 주문이 첫 손님이 되지 않게 섞기
  let ordered = shuffle(trimmed, rng);
  if (ordered[0].special) {
    const j = ordered.findIndex((s) => !s.special);
    if (j > 0) [ordered[0], ordered[j]] = [ordered[j], ordered[0]];
  }

  // 키 뽑기 → 주문 만들기
  const orders: Order[] = [];
  let n = input.nextOrderNumber;
  let lastBottles = bottlesOfKey(decks.multiBottle?.lastDrawn ?? null);
  let lastAppearance: string | null = null;
  for (let i = 0; i < ordered.length; i++) {
    const slot = ordered[i];
    let key: string;
    if (slot.keys) {
      // 정해진 후보(새 유형·복습) 중에서: 최근에 낸 키와 직전 병 수는 가능하면 피한다
      const recent = new Set(Object.values(decks).map((d) => d.lastDrawn));
      const good = slot.keys.filter((k) => !recent.has(k) && !(bottlesOfKey(k) !== null && bottlesOfKey(k) === lastBottles));
      key = pick(good.length ? good : slot.keys, rng);
      const kk = keyKind(key);
      const d = decks[kk] ?? EMPTY_DECK;
      decks[kk] = { remaining: d.remaining.filter((x) => x !== key), lastDrawn: key };
    } else {
      const kind = slot.kind as OrderKind;
      const keys = keysOf(kind);
      if (!keys.length) throw new Error(`출제할 수 있는 ${kind} 주문이 없습니다.`);
      const r = drawAvoiding(decks[kind] ?? EMPTY_DECK, keys, rng, (k) => bottlesOfKey(k) !== null && bottlesOfKey(k) === lastBottles);
      key = r.key;
      decks[kind] = r.deck;
    }
    if (bottlesOfKey(key)) lastBottles = bottlesOfKey(key);
    else lastBottles = null;

    const customerId = CUSTOMER_IDS[randomInt(rng, CUSTOMER_IDS.length)];
    let order = createOrderFromKey(key, { orderNumber: n, customerId, rng, recipes });
    // 외형은 문제 난수와 따로, 주문 번호로 정한다. 바로 앞 손님과 같은 외형은 피한다
    const appearanceId = pickAppearance(customerId, n, lastAppearance);
    if (appearanceId) order = { ...order, appearanceId };
    lastAppearance = appearanceId ?? null;
    if (slot.reviewOf) {
      const rc = slot.reviewOf;
      // 같은 유형이면서 원래와 다른 인수인 과제 1개에 복습 표시
      const idx = order.tasks.findIndex(
        (t) => t.mode !== "specified" && t.problem.learningType === rc.learningType &&
          !(norm(t.problem.a) === norm(rc.a) && norm(t.problem.b) === norm(rc.b)),
      );
      if (idx >= 0) {
        order = { ...order, reviewCandidateId: rc.id, tasks: order.tasks.map((t, i) => (i === idx ? { ...t, reviewOf: rc.id } : t)) };
      }
    }
    orders.push({ ...order, status: i === 0 ? "arrived" : "queued" });
    n++;
  }
  return { orders, decks, nextOrderNumber: n, reviewCandidateId, featured };
}

export function keyKind(key: string): OrderKind {
  const p = key.split(":")[0];
  return p === "multiBottle" ? "multiBottle" : p === "custom" ? "customMultiplier" : p === "amount" ? "customAmount" : p === "life" ? "lifeItem" : "pointShift";
}

/** 이 날 처음 소개되는 유형 */
export function newTypesForStage(stage: number, previousStage: number | null): LearningTypeId[] {
  if (previousStage !== null && previousStage >= stage) return [];
  return INTRO_STAGES[stage] ?? [];
}

/** 생활 소재·인수가 범위 안인지 (범위 예외 표시된 문제 제외) — 데이터 검증용 */
export function lifePairOutOfRange(): string[] {
  const bad: string[] = [];
  for (const item of Object.values(LIFE_ITEMS)) {
    if (item.rangeException) continue;
    for (const [a, b] of item.pairs) if (!inRange(a) || !inRange(b)) bad.push(`${item.id}:${a}×${b}`);
  }
  return bad;
}

