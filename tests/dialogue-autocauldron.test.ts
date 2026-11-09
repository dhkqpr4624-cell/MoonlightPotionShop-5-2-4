// 주문 대사 개선(문제은행 개정판·생성 템플릿) / 마녀의 자동 가마솥 = 즉시 완성 / 저장 v8
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createInitialState, reducer } from "../src/game/reducer.ts";
import { INGREDIENTS } from "../src/data/ingredients.ts";
import { getRecipe, RECIPES } from "../src/data/recipes.ts";
import { MAX_INTRO_STAGE } from "../src/data/learningTypes.ts";
import { DIALOGUES, reminderLine } from "../src/data/dialogues.ts";
import { GADGETS } from "../src/data/shop.ts";
import { QUESTION_BANK } from "../src/data/questionBank.ts";
import { bankScriptText, createOrderFromKey, planDay } from "../src/game/orderFactory.ts";
import { qualityOf, rewardForOrder } from "../src/game/outcome.ts";
import { loadGame, normalizeLoaded, SAVE_KEY, saveGame } from "../src/game/save.ts";
import { solutionSteps } from "../src/game/explain.ts";
import { hasFinalConsonant } from "../src/lib/josa.ts";
import { createRng } from "../src/lib/rng.ts";
import type { GameState, Order } from "../src/game/types.ts";
import { answerActive, correctAnswer, memoryStorage, NOW, order, roundTrip, run, wrongAnswer } from "./helpers.ts";

const ALL = Object.values(INGREDIENTS).filter((i) => !i.legacy).map((i) => i.id);
const CALC_QUESTION = /몇\s*g|총량|전체 양|모두 합해|얼마/;
const NAMES = [...Object.values(RECIPES).map((r) => r.name), ...Object.values(INGREDIENTS).map((i) => i.name)].sort((a, b) => b.length - a.length);

/* ------------------------------------------------------------------ */
/* [1] 문제은행 개정판                                                   */
/* ------------------------------------------------------------------ */

test("개정판 적용: 180문항 ID·난이도·유형·포션·재료·인수·정답·병 수가 직전 데이터와 똑같다 (중복 ID 없음)", () => {
  const prev = JSON.parse(readFileSync(new URL("./fixtures/questionbank-values-v0.8.json", import.meta.url), "utf8")) as Record<string, unknown>[];
  assert.equal(QUESTION_BANK.length, 180);
  assert.equal(new Set(QUESTION_BANK.map((q) => q.id)).size, 180);
  assert.deepEqual(
    QUESTION_BANK.map((q) => ({ id: q.id, difficulty: q.difficulty, mulType: q.mulType, recipeId: q.recipeId, ingredientId: q.ingredientId, a: q.a, b: q.b, answer: q.answer, bottles: q.bottles })),
    prev,
  );
});

test("문제은행 주문 대사: 포션·병 수·지정 재료·양·조건(병당/기준의 배수, 이 재료만)이 있고 계산 질문으로 끝나지 않는다", () => {
  for (const q of QUESTION_BANK) {
    const potion = getRecipe(q.recipeId).name;
    const ing = INGREDIENTS[q.ingredientId].name;
    const others = getRecipe(q.recipeId).additives.length > 1;
    const perBottle = q.mulType === "소수×자연수";
    for (const [field, text] of [["question", q.question], ["clarification", q.clarification]] as const) {
      const where = `${q.id} ${field}: ${text}`;
      assert.ok(text.includes(potion), `포션 이름 ${where}`);
      assert.ok(text.includes(ing), `재료 이름 ${where}`);
      assert.ok(text.includes(`${q.a}g`), `지정 양 ${where}`);
      if (perBottle) {
        assert.ok(text.includes(`${q.bottles}병`), `병 수 ${where}`);
        assert.match(text, /씩/, `병마다 ${where}`);
      } else {
        assert.match(text, /한 병|1병/, `한 병 ${where}`);
        assert.ok(text.includes(`${q.b}배`), `배수 ${where}`);
      }
      assert.doesNotMatch(text, CALC_QUESTION, `계산 질문 ${where}`);
      assert.doesNotMatch(text, /\?\s*$/, `물음으로 끝남 ${where}`);
      assert.doesNotMatch(text, /×|=/, `식 ${where}`);
    }
    // 배수 주문은 '이 재료만' 바뀐다는 것이 드러나야 한다 (다른 재료가 있는 레시피)
    if (!perBottle && others) assert.match(q.question, /다른 재료|나머지 재료/, `${q.id} 이 재료만`);
  }
});

test("문제은행 '네?'(쉬운 말): 원래 주문과 같은 수(포션·병 수·양·배수)를 다시 말하고 식·정답은 없다", () => {
  for (const q of QUESTION_BANK) {
    const t = bankScriptText(q.id);
    const nums = (s: string) => new Set((s.match(/\d+(?:\.\d+)?/g) ?? []).filter((n) => n !== "1"));
    for (const n of nums(t.original)) assert.ok(t.easy.includes(n), `${q.id}: 네?에 ${n} 없음`);
    for (const n of nums(t.easy)) assert.ok(t.original.includes(n), `${q.id}: 네?에 원래 주문에 없는 수 ${n}`);
    assert.ok(t.easy.includes(getRecipe(q.recipeId).name), q.id);
    assert.doesNotMatch(t.easy, /×|=/, q.id);
    if (!(q.answer === q.a || q.answer === q.b)) assert.ok(!t.easy.includes(`${q.answer}g`), `${q.id} 네?에 정답`);
    // 다른 재료가 있으면 그 재료 처리도 말한다
    if (getRecipe(q.recipeId).additives.length > 1) assert.match(t.easy, /다른 재료|나머지 재료/, q.id);
  }
});

test("문제은행 힌트·해설: 힌트는 식(a × b)만, 해설은 같은 식과 정답 — 주문 데이터와 일치", () => {
  for (const q of QUESTION_BANK) {
    assert.ok(q.hint.includes(`${q.a} × ${q.b}`), `${q.id} 힌트 식`);
    assert.ok(!q.hint.includes("=") && !q.hint.includes(`${q.answer}g`), `${q.id} 힌트에 정답`);
    assert.ok(q.explanation.includes(`${q.a} × ${q.b}`), `${q.id} 해설 식`);
    assert.ok(q.explanation.includes(q.answer), `${q.id} 해설 정답`);
  }
  // 게임 속 주문의 해설 단계도 같은 수
  const o = createOrderFromKey("bank:MP-002", { orderNumber: 1, customerId: "fox", rng: createRng(1) });
  const t = o.tasks.find((x) => x.problem.bankId === "MP-002")!;
  assert.equal(t.problem.answer, "0.9");
  assert.match(solutionSteps(o, t).join(" "), /0\.9/);
});

test("문제은행 조사: 포션·재료 이름과 숫자 뒤 은/는·이/가·을/를이 받침에 맞다", () => {
  const bad: string[] = [];
  const pair: Record<string, [string, string]> = { 은: ["은", "는"], 는: ["은", "는"], 이: ["이", "가"], 가: ["이", "가"], 을: ["을", "를"], 를: ["을", "를"] };
  for (const q of QUESTION_BANK) {
    for (const text of [q.question, q.clarification, q.hint, q.explanation]) {
      for (const n of NAMES) {
        const re = new RegExp(`${n}(은|는|이|가|을|를)(?=[\\s.,]|$)`, "g");
        for (const m of text.matchAll(re)) {
          const want = hasFinalConsonant(n) ? pair[m[1]][0] : pair[m[1]][1];
          if (m[1] !== want) bad.push(`${q.id}: ${n}${m[1]}`);
        }
      }
      for (const m of text.matchAll(/(\d+(?:\.\d+)?)(을|를)(?=[\s.,)]|$)/g)) {
        const want = hasFinalConsonant(m[1]) ? "을" : "를";
        if (m[2] !== want) bad.push(`${q.id}: ${m[0]}`);
      }
      assert.doesNotMatch(text, /활력수을|해독제은|기력초은/, q.id);
    }
  }
  assert.deepEqual(bad, []);
});

/* ------------------------------------------------------------------ */
/* [1] 생성 주문 템플릿                                                  */
/* ------------------------------------------------------------------ */

test("생성 주문(모든 유형·말투): 원래 주문에 포션 이름과 병 수(또는 한 병)가 있고, 계산 질문으로 끝나지 않으며, '네?'는 같은 수를 말한다", () => {
  const kinds = new Set<string>();
  const styles = new Set<string>();
  for (let seed = 1; seed <= 160; seed++) {
    const r = planDay({ dayNumber: 6 + (seed % 20), unlocked: ALL, introStage: MAX_INTRO_STAGE, newTypes: [], decks: {}, nextOrderNumber: 1, review: [], rng: createRng(seed), useBank: seed % 2 === 0 });
    for (const o of r.orders) {
      const potion = getRecipe(o.recipeId).name;
      const where = `${o.kind} ${o.customerId}: ${o.script.original}`;
      kinds.add(o.kind);
      styles.add(o.customerId);
      assert.ok(o.script.original.includes(potion), `포션 ${where}`);
      if (o.bottles > 1) assert.ok(o.script.original.includes(`${o.bottles}병`), `병 수 ${where}`);
      else assert.match(o.script.original, /한 병|1병/, `한 병 ${where}`);
      assert.doesNotMatch(o.script.original, CALC_QUESTION, `계산 질문 ${where}`);
      assert.doesNotMatch(o.script.original, /×|=/, `식 ${where}`);
      assert.ok(o.script.easy.includes(potion), `네? 포션 ${o.kind}: ${o.script.easy}`);
      // '네?'는 원래 주문의 조건 수를 모두 다시 말한다
      for (const n of o.script.original.match(/\d+(?:\.\d+)?/g) ?? []) {
        if (n === "1") continue;
        assert.ok(o.script.easy.includes(n), `네?에 ${n} 없음 — ${o.kind}: ${o.script.original} / ${o.script.easy}`);
      }
      // 분위기 대사(인사)만 있고 주문이 빠지는 일은 없다
      assert.notEqual(o.script.original.trim(), o.script.greet.trim());
    }
  }
  for (const k of ["multiBottle", "customMultiplier", "customAmount", "lifeItem", "pointShift", "bank"]) assert.ok(kinds.has(k), k);
  assert.ok(styles.size >= 4);
});

test("말투 템플릿: 모든 말투의 '네?' 문장이 포션 이름으로 시작하고, 맞춤 배수는 '모든 재료'를 바꾼다고 말한다", () => {
  for (const [style, T] of Object.entries(DIALOGUES)) {
    for (const key of ["multiEasy", "customEasy", "amountPerEasy", "amountBaseEasy", "shiftEasy"] as const) {
      assert.ok((T as Record<string, string>)[key].startsWith("{potion}"), `${style}.${key}`);
    }
    assert.match(T.shiftOriginal, /\{potion\} 한 병/, style);
    assert.match(T.shiftEasy, /\{p\}\{u\}/, `${style} shiftEasy 지난번 양`);
  }
  const o = createOrderFromKey("custom:wind:0.5", { orderNumber: 1, customerId: "fox", rng: createRng(1) });
  assert.match(o.script.original, /모든 재료/);
});

test("기다리는 동안 창구 말: 분위기 말과 함께 포션·병 수를 다시 말한다", () => {
  assert.equal(reminderLine("hao", "기력 포션", 6), "기력 포션 6병, 잘 부탁하오.");
  assert.equal(reminderLine("hamnida", "거인의 활력수", 1), "거인의 활력수 한 병, 잘 부탁드립니다.");
  assert.equal(reminderLine("hage", "태양의 심장", 3), "태양의 심장 3병, 잘 부탁하네.");
  assert.equal(reminderLine("knight", "폭풍의 숨결", 8), "폭풍의 숨결 8병, 잘 부탁하오.");
});

/* ------------------------------------------------------------------ */
/* [2] 마녀의 자동 가마솥                                                */
/* ------------------------------------------------------------------ */

function brewingWith(key: string, owned: boolean): GameState {
  let s = run({ ...createInitialState(), unlockedIngredients: ALL }, { type: "START", seed: 5 });
  s = reducer(s, { type: "ACK_INTRO", dayNumber: 1 });
  if (owned) {
    s = { ...s, money: s.money + 1000 };
    s = reducer(s, { type: "BUY_ITEM", itemId: "autoCauldron" });
    assert.ok(s.shop.owned.includes("autoCauldron"));
  }
  const first = s.day!.orders[0];
  const o: Order = { ...createOrderFromKey(key, { orderNumber: Number(first.id.slice(6)), customerId: first.customerId, rng: createRng(2) }), status: "arrived" };
  s = { ...s, day: { ...s.day!, orders: [o, ...s.day!.orders.slice(1)] } };
  return reducer(s, { type: "ACCEPT_ORDER", orderId: o.id });
}

function addTask(s: GameState, i: number, wrong = false): GameState {
  const id = order(s).id;
  s = reducer(s, { type: "PLACE_INGREDIENT", orderId: id, taskIndex: i });
  s = answerActive(s, wrong ? wrongAnswer(order(s).tasks[i]) : correctAnswer(order(s).tasks[i]));
  return reducer(s, { type: "ADD_TO_CAULDRON", orderId: id, taskIndex: i });
}

test("자동 가마솥 설명: '재료를 모두 넣으면 포션이 바로 완성됩니다.'", () => {
  const g = GADGETS.find((x) => x.id === "autoCauldron")!;
  assert.ok(g.description.startsWith("재료를 모두 넣으면 포션이 바로 완성됩니다."));
});

test("자동 가마솥 없음: 재료를 다 넣어도 젓기·병 담기를 직접 해야 완성", () => {
  let s = brewingWith("multiBottle:wind:3", false);
  s = addTask(addTask(s, 0), 1);
  assert.equal(order(s).status, "brewing");
  assert.equal(order(s).stirProgress, 0);
  s = reducer(s, { type: "COMPLETE_POTION", orderId: order(s).id });
  assert.equal(order(s).status, "brewing", "젓기 전엔 병에 못 담음");
  for (let k = 0; k < 4; k++) s = reducer(s, { type: "STIR", orderId: order(s).id, amount: 25 });
  s = reducer(s, { type: "COMPLETE_POTION", orderId: order(s).id });
  assert.equal(order(s).status, "bottled");
});

for (const [key, n] of [["multiBottle:energy:3", 1], ["multiBottle:wind:3", 2], ["multiBottle:hawk:3", 3]] as const) {
  test(`자동 가마솥: 재료 ${n}종 주문 — 마지막 재료를 넣는 순간 병에 담긴 상태, 그 전엔 완성 안 됨`, () => {
    let s = brewingWith(key, true);
    assert.equal(order(s).tasks.length, n);
    for (let i = 0; i < n; i++) {
      assert.equal(order(s).status, "brewing", `${i}번째 재료 전`);
      s = addTask(s, i);
    }
    assert.equal(order(s).status, "bottled");
    assert.equal(order(s).stirProgress, 100);
    assert.equal(order(s).quality, "great");
    assert.ok(order(s).script.reaction);
    assert.equal(s.money, run(s).money, "완성 때는 돈을 주지 않는다");
  });
}

test("자동 가마솥: 계량 문제·오답 해설·품질 감점은 그대로 (오답을 정답으로 바꾸지 않음)", () => {
  let s = brewingWith("multiBottle:hawk:3", true);
  s = addTask(s, 0);
  s = addTask(s, 1, true);
  assert.equal(order(s).tasks[1].correct, false);
  assert.equal(order(s).status, "brewing");
  s = addTask(s, 2);
  const o = order(s);
  assert.equal(o.status, "bottled");
  assert.equal(o.tasks[1].correct, false);
  assert.equal(o.quality, qualityOf(o));
  assert.equal(o.quality, "good");
  assert.equal(o.reward, rewardForOrder(o, "good"));
  assert.ok(s.review.some((c) => c.sourceProblemId === o.tasks[1].problemId), "오답 복습 후보도 그대로");
});

test("자동 가마솥: 재료를 하나라도 안 넣으면 완성 안 됨 — 자동으로 넣지도 않음", () => {
  let s = brewingWith("multiBottle:hawk:3", true);
  s = addTask(addTask(s, 0), 1);
  const o = order(s);
  assert.equal(o.status, "brewing");
  assert.notEqual(o.tasks[2].status, "done");
  s = reducer(s, { type: "COMPLETE_POTION", orderId: o.id });
  assert.equal(order(s).status, "brewing");
  // 계량 중(넣기 전)인 상태도 완성 안 됨
  s = reducer(s, { type: "PLACE_INGREDIENT", orderId: o.id, taskIndex: 2 });
  s = answerActive(s, correctAnswer(order(s).tasks[2]));
  assert.equal(order(s).status, "brewing");
  assert.notEqual(order(s).tasks[2].status, "done");
});

test("자동 가마솥: 같은 입력을 반복하거나 저장·불러오기를 해도 완성·지급은 한 번", () => {
  let s = brewingWith("multiBottle:wind:3", true);
  s = addTask(addTask(s, 0), 1);
  const id = order(s).id;
  const once = s;
  s = run(s, { type: "ADD_TO_CAULDRON", orderId: id, taskIndex: 1 }, { type: "COMPLETE_POTION", orderId: id }, { type: "STIR", orderId: id, amount: 25 });
  assert.deepEqual(order(s), order(once));
  // 저장 → 불러오기
  const store = memoryStorage();
  saveGame(s, store);
  const l = loadGame(1, store);
  assert.equal(l.kind, "ok");
  if (l.kind !== "ok") return;
  assert.deepEqual(order(l.state as GameState), order(once));
  const m0 = s.money;
  s = run(roundTrip(s), { type: "GO_COUNTER" }, { type: "DELIVER", orderId: id, now: NOW }, { type: "DELIVER", orderId: id, now: NOW });
  assert.equal(order(s).status, "paid");
  assert.equal(s.money, m0 + order(once).reward!, "전달할 때 한 번만 지급");
});

test("자동 가마솥: 끄기 스위치는 없다 — SET_GADGET으로 꺼도 계속 적용", () => {
  let s = brewingWith("multiBottle:wind:3", true);
  s = reducer(s, { type: "SET_GADGET", id: "autoCauldron", on: false });
  s = addTask(addTask(s, 0), 1);
  assert.equal(order(s).status, "bottled");
});

test("자동 가마솥: 재료를 다 넣고 젓는 중에 사면 바로 완성(지급은 전달 때)", () => {
  let s = brewingWith("multiBottle:wind:3", false);
  s = addTask(addTask(s, 0), 1);
  s = reducer(s, { type: "STIR", orderId: order(s).id, amount: 25 });
  s = { ...s, money: s.money + 1000 };
  const m = s.money;
  s = reducer(s, { type: "BUY_ITEM", itemId: "autoCauldron" });
  assert.equal(order(s).status, "bottled");
  assert.ok(s.money < m, "가격만 빠짐");
});

/* ------------------------------------------------------------------ */
/* 저장 v7 → v8                                                         */
/* ------------------------------------------------------------------ */

function loadFixture(name: string) {
  const raw = readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
  const v7 = JSON.parse(raw);
  assert.equal(v7.saveVersion, 7);
  const store = memoryStorage();
  store.setItem(SAVE_KEY, raw);
  const l = loadGame(1, store);
  assert.equal(l.kind, "ok", l.kind === "error" ? l.errors.join(",") : "");
  if (l.kind !== "ok") throw new Error("load");
  assert.equal(l.migratedFrom, 7);
  return { v7, s: l.state as GameState, store };
}

test("v7 저장(직전 버전 코드로 만든 젓는 중, 자동 가마솥 보유·꺼둠) → v8: 바로 병에 담긴 상태, 돈·진행·오답 그대로, 대사는 같은 문항일 때만 새 문구", () => {
  const { v7, s } = loadFixture("v7-autocauldron-midstir.json");
  assert.equal(s.saveVersion, 8);
  assert.equal(v7.shop.toggles.autoCauldron, false);
  assert.equal(s.shop.toggles.autoCauldron, true);
  assert.equal(s.money, v7.money, "불러올 때는 돈을 주지 않는다");
  const before = v7.day.orders[v7.day.currentIndex] as Order;
  const o = order(s);
  assert.equal(o.status, "bottled");
  assert.equal(o.id, before.id);
  assert.equal(o.kind, "bank");
  assert.deepEqual(o.tasks, before.tasks, "계량 결과·오답 그대로");
  assert.equal(o.tasks[0].correct, false);
  assert.equal(o.quality, qualityOf(o));
  assert.equal(o.price, before.price);
  assert.equal(o.bottles, before.bottles);
  assert.equal(o.bank!.questionId, before.bank!.questionId);
  assert.equal(o.script.original, bankScriptText(o.bank!.questionId).original);
  assert.equal(o.script.greet, before.script.greet);
  for (const k of ["problemLog", "review", "paidOrderIds", "decks", "unlockedIngredients"]) {
    assert.deepEqual((s as unknown as Record<string, unknown>)[k], v7[k], k);
  }
  // 불러온 뒤 전달 → 한 번 지급, 다시 불러와도 그대로
  let t = run(s, { type: "GO_COUNTER" }, { type: "DELIVER", orderId: o.id, now: NOW });
  assert.equal(t.money, v7.money + o.reward!);
  const store = memoryStorage();
  saveGame(t, store);
  const again = loadGame(1, store);
  assert.ok(again.kind === "ok" && (again.state as GameState).money === t.money);
});

test("v7 저장: 젓기를 마치고 병에 안 담은 주문도 완성, 재료가 덜 들어간 주문은 그대로, 전달한 주문은 손대지 않음", () => {
  const stirred = loadFixture("v7-autocauldron-stirred.json");
  assert.equal(order(stirred.s).status, "bottled");
  assert.equal(order(stirred.s).quality, "great");
  assert.equal(stirred.s.money, stirred.v7.money);

  const partial = loadFixture("v7-autocauldron-partial.json");
  const p = order(partial.s);
  assert.equal(p.status, "brewing");
  assert.deepEqual(p.tasks, partial.v7.day.orders[partial.v7.day.currentIndex].tasks, "재료를 자동으로 넣지 않는다");

  const paid = loadFixture("v7-autocauldron-paid.json");
  const before = paid.v7.day.orders[paid.v7.day.currentIndex];
  const after = order(paid.s);
  assert.equal(after.status, "paid");
  assert.equal(paid.s.money, paid.v7.money);
  assert.deepEqual({ ...after, script: null }, { ...before, script: null }, "수치·진행·보상 그대로");
  assert.deepEqual(paid.s.paidOrderIds, paid.v7.paidOrderIds);
});

test("저장된 문제은행 주문: 문항 ID와 인수가 같을 때만 새 문구로, 다르면 대사를 바꾸지 않고 다른 문항으로도 바꾸지 않는다", () => {
  const raw = JSON.parse(readFileSync(new URL("./fixtures/v7-autocauldron-partial.json", import.meta.url), "utf8"));
  const { s } = loadFixture("v7-autocauldron-partial.json");
  const o = order(s);
  // 같은 문항 → 새 문구 (인사·기다림 말, 수치·진행은 그대로)
  const before = raw.day.orders[raw.day.currentIndex];
  assert.equal(o.script.original, bankScriptText(o.bank!.questionId).original);
  assert.equal(o.script.waiting, before.script.waiting);
  assert.deepEqual(o.tasks, before.tasks);
  // 인수가 다른 주문(메모리 상태로 직접 만듦) → normalizeLoaded가 대사를 건드리지 않음
  const ti = o.tasks.findIndex((t) => t.problem.bankId);
  const odd: Order = { ...o, script: { ...o.script, original: "예전 대사" }, tasks: o.tasks.map((t, i) => (i === ti ? { ...t, problem: { ...t.problem, a: t.problem.a + "1" } } : t)) };
  const st: GameState = { ...s, day: { ...s.day!, orders: s.day!.orders.map((x) => (x.id === o.id ? odd : x)) } };
  const n = normalizeLoaded(st);
  assert.equal(order(n).script.original, "예전 대사");
  assert.equal(order(n).bank!.questionId, o.bank!.questionId);
  assert.deepEqual(order(n).tasks, odd.tasks);
  // 저장 파일에서 인수를 바꾸면 검사에서 걸러져 불러오지 않는다(다른 문항으로 바꿔 끼우지 않음)
  raw.day.orders[raw.day.currentIndex].tasks[ti].problem.a = "0.01";
  const store = memoryStorage();
  store.setItem(SAVE_KEY, JSON.stringify(raw));
  assert.notEqual(loadGame(1, store).kind, "ok");
  // 한 번 더 정리해도 같다
  assert.deepEqual(normalizeLoaded(s), s);
});
