// 서랍 구매·바람 걸음 포션·새 레시피 안내·주문서 힌트·마감 집계·저장 버전 5
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createInitialState, reducer } from "../src/game/reducer.ts";
import { getIngredient, INGREDIENTS } from "../src/data/ingredients.ts";
import { RECIPES } from "../src/data/recipes.ts";
import { classifyProduct, INTRO_STAGES, MAX_INTRO_STAGE } from "../src/data/learningTypes.ts";
import { createOrderFromKey, planDay } from "../src/game/orderFactory.ts";
import { orderHints } from "../src/game/explain.ts";
import { summarizeDay, wrongPotionCount } from "../src/game/daySummary.ts";
import { availableRecipes, shopIngredients } from "../src/game/unlocks.ts";
import { interpretSaveData, loadGame, saveGame, SAVE_KEY, validateState } from "../src/game/save.ts";
import { buildSaveExport, parseImportText } from "../src/game/transfer.ts";
import { createRng } from "../src/lib/rng.ts";
import { multiplyStrings } from "../src/lib/decimal.ts";
import type { GameState, Order } from "../src/game/types.ts";
import {
  answerActive, closeAndNext, correctAnswer, memoryStorage, NOW, order, playFullDay, roundTrip, run, serveCurrent, startBrewing, wrongAnswer,
} from "./helpers.ts";

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
const BOTH = ["energyHerb", "featherGrass", "windShard"];

/** 바람 걸음 포션 주문으로 제조를 시작한 상태 (두 재료 해금) */
function windBrewing(key = "multiBottle:wind:3", seed = 7): GameState {
  let s = run({ ...createInitialState(), unlockedIngredients: BOTH }, { type: "START", seed });
  s = reducer(s, { type: "ACK_INTRO", dayNumber: 1 });
  const first = s.day!.orders[0];
  const o: Order = { ...createOrderFromKey(key, { orderNumber: Number(first.id.slice(6)), customerId: first.customerId, rng: createRng(1) }), status: "arrived" };
  s = { ...s, day: { ...s.day!, orders: [o, ...s.day!.orders.slice(1)] } };
  return reducer(s, { type: "ACCEPT_ORDER", orderId: o.id });
}

/* ------------------------------ 데이터 ------------------------------ */

test("재료·레시피 데이터: 서랍 배치, 해금 가격, 바람 걸음 포션 기본량·판매가", () => {
  assert.deepEqual(shopIngredients().map((i) => [i.id, i.name, i.drawer, i.unlockCost, i.unit]), [
    ["energyHerb", "기력초", 0, 0, "g"],
    ["featherGrass", "깃털풀", 1, 70, "g"],
    ["windShard", "바람 정령의 파편", 2, 110, "g"],
  ]);
  assert.ok(!Object.values(INGREDIENTS).some((i) => i.name === "바람풀"), "'바람풀'이라는 별도 재료 없음");
  // 이전 버전 재료는 새 재료와 겹치지 않는 빈 서랍
  assert.deepEqual([INGREDIENTS.moonDew.drawer, INGREDIENTS.starDust.drawer], [3, 4]);
  const w = RECIPES.wind;
  assert.equal(w.name, "바람 걸음 포션");
  assert.deepEqual(w.additives, [{ ingredientId: "featherGrass", amount: "0.4" }, { ingredientId: "windShard", amount: "0.35" }]);
  assert.equal(classifyProduct("0.4", "3"), "d1xN");
  assert.equal(classifyProduct("0.35", "3"), "d2xN");
  assert.ok(w.pricePerBottle > RECIPES.energy.pricePerBottle && w.specialPrice > RECIPES.energy.specialPrice, "기력 포션보다 약간 높게");
  assert.deepEqual([w.pricePerBottle, w.specialPrice, RECIPES.energy.pricePerBottle, RECIPES.energy.specialPrice], [6, 24, 5, 20]);
});

test("해금 가격 근거: 기력 포션 하루 평균 수입으로 1~2일(정답) · 오답만이어도 몇 날이면 둘 다 살 수 있다", () => {
  const avg = (stage: number) => {
    let sum = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const r = planDay({ dayNumber: 1, introStage: stage, newTypes: INTRO_STAGES[stage], decks: {}, nextOrderNumber: 1, review: [], rng: createRng(seed * 31) });
      sum += r.orders.reduce((a, o) => a + o.price, 0);
    }
    return sum / 300;
  };
  const day1 = avg(0);
  const day2 = avg(1);
  const total = INGREDIENTS.featherGrass.unlockCost + INGREDIENTS.windShard.unlockCost;
  assert.ok(day1 >= INGREDIENTS.featherGrass.unlockCost, `1일차 평균 ${day1}이면 깃털풀`);
  assert.ok(day1 + day2 >= total, `2일 평균 ${day1 + day2} ≥ ${total}`);
  assert.ok(day1 < total, "하루 만에 둘 다 사지는 못함");
  const wrongOnly = (d: number) => Math.floor(d * 0.6);
  assert.ok(wrongOnly(day1) + wrongOnly(day2) * 2 >= total, "모두 오답(60%)이어도 3일이면 둘 다");
});

/* ------------------------------ 구매·해금 ------------------------------ */

test("서랍 구매: 잔액 부족·중복 구매는 아무것도 바꾸지 않고, 사면 돈이 한 번만 빠진다", () => {
  let s = startBrewing(11);
  const before = s;
  assert.equal(reducer(s, { type: "UNLOCK_INGREDIENT", ingredientId: "featherGrass" }), before, "돈 0: 상태 그대로");
  s = { ...s, money: 69 };
  assert.equal(reducer(s, { type: "UNLOCK_INGREDIENT", ingredientId: "featherGrass" }), s, "1 모자람");
  s = { ...s, money: 100 };
  const a = reducer(s, { type: "UNLOCK_INGREDIENT", ingredientId: "featherGrass" });
  assert.equal(a.money, 30);
  assert.deepEqual(a.unlockedIngredients, ["energyHerb", "featherGrass"]);
  assert.deepEqual(a.recipeNotices, [], "재료 하나만으로는 레시피 해금 없음");
  assert.equal(availableRecipes(a.unlockedIngredients).some((r) => r.id === "wind"), false);
  const twice = reducer(a, { type: "UNLOCK_INGREDIENT", ingredientId: "featherGrass" });
  assert.equal(twice, a, "연달아 눌러도 두 번 빠지지 않음");
  assert.equal(reducer(a, { type: "UNLOCK_INGREDIENT", ingredientId: "windShard" }), a, "30으로는 110짜리 못 삼");
  // 계량 패널이 열려 있으면 받지 않는다
  const measuring = reducer({ ...a, money: 500 }, { type: "PLACE_INGREDIENT", orderId: order(a).id, taskIndex: 0 });
  assert.notEqual(measuring.activeTask, null);
  assert.equal(reducer(measuring, { type: "UNLOCK_INGREDIENT", ingredientId: "windShard" }), measuring);
});

test("두 재료를 모두 사면 바람 걸음 포션 자동 해금 → 안내 1회 저장, 오늘 주문·진행은 그대로", () => {
  let s = startBrewing(12);
  s = reducer(s, { type: "PLACE_INGREDIENT", orderId: order(s).id, taskIndex: 0 });
  s = answerActive(s, correctAnswer(order(s).tasks[0]));
  s = reducer(s, { type: "ADD_TO_CAULDRON", orderId: order(s).id, taskIndex: 0 });
  s = reducer(s, { type: "STIR", orderId: order(s).id, amount: 25 });
  s = { ...s, money: 180 };
  const dayBefore = roundTrip(s.day);
  const earnedBefore = s.day!.moneyEarned;
  s = run(s, { type: "UNLOCK_INGREDIENT", ingredientId: "windShard" }, { type: "UNLOCK_INGREDIENT", ingredientId: "featherGrass" });
  assert.equal(s.money, 0);
  assert.deepEqual(s.unlockedIngredients, BOTH);
  assert.deepEqual(s.recipeNotices, ["wind"]);
  assert.deepEqual(s.featuredRecipes, ["wind"]);
  assert.deepEqual(s.day, dayBefore, "오늘 주문 5건·현재 주문·젓기 진행이 구매 전과 같음");
  assert.equal(s.day!.moneyEarned, earnedBefore, "오늘 수입은 구매로 줄지 않음");
  // 확인 전 저장 → 다시 불러오기: 안내는 남고 돈은 다시 빠지지 않음
  const store = memoryStorage();
  saveGame(s, store);
  const l = loadGame(1, store);
  assert.equal(l.kind, "ok");
  if (l.kind !== "ok") return;
  assert.deepEqual(l.state.recipeNotices, ["wind"]);
  assert.equal(l.state.money, 0);
  const acked = reducer(l.state, { type: "ACK_RECIPE_NOTICE", recipeId: "wind" });
  assert.deepEqual(acked.recipeNotices, []);
  assert.equal(reducer(acked, { type: "ACK_RECIPE_NOTICE", recipeId: "wind" }), acked, "확인한 안내는 다시 생기지 않음");
  saveGame(acked, store);
  const l2 = loadGame(1, store);
  assert.ok(l2.kind === "ok" && l2.state.recipeNotices.length === 0);
});

test("다음 영업부터 바람 걸음 포션 주문(최소 1건), 하나만 해금하면 출제하지 않음", () => {
  // 재료 하나만: 여러 날 동안 바람 걸음 포션이 나오지 않음
  for (let seed = 1; seed <= 40; seed++) {
    const r = planDay({ dayNumber: 2, introStage: MAX_INTRO_STAGE, newTypes: [], decks: {}, nextOrderNumber: 1, review: [], rng: createRng(seed), unlocked: ["energyHerb", "featherGrass"] });
    assert.ok(r.orders.every((o) => o.recipeId === "energy"), `seed ${seed}`);
  }
  // 둘 다 해금: 하루를 마치고 다음 영업에 최소 1건, 첫 주문 목록은 비워짐
  for (const seed of [3, 8, 21]) {
    let s = run(createInitialState(), { type: "START", seed });
    s = { ...s, money: 500 };
    s = run(s, { type: "UNLOCK_INGREDIENT", ingredientId: "featherGrass" }, { type: "UNLOCK_INGREDIENT", ingredientId: "windShard" });
    assert.ok(s.day!.orders.every((o) => o.recipeId === "energy"), "오늘 주문은 그대로 기력 포션");
    s = playFullDay(s);
    s = closeAndNext(s, seed + 100);
    const wind = s.day!.orders.filter((o) => o.recipeId === "wind");
    assert.ok(wind.length >= 1, `seed ${seed}: 다음 영업에 바람 걸음 포션`);
    assert.deepEqual(s.featuredRecipes, []);
    for (const o of wind) {
      assert.equal(o.tasks.length, 2);
      assert.deepEqual(o.tasks.map((t) => t.ingredientId), ["featherGrass", "windShard"]);
      for (const t of o.tasks) if (t.mode === "calc") assert.ok(t.problem.learningType && ["d1xN", "d2xN"].includes(t.problem.learningType), "2일차(①~④)에 맞는 유형");
    }
  }
});

test("바람 걸음 포션 제조: 두 재료를 모두 넣어야 젓기·완성, 순서는 자유, 품질 100·80·60%", () => {
  for (const [wrong, quality, pct] of [[[], "great", 100], [[1], "okay", 80], [[0], "okay", 80], [[0, 1], "poor", 60]] as const) {
    let s = windBrewing();
    const o = order(s);
    assert.equal(o.price, 18, "3병 × 6");
    // 두 번째 재료부터 (순서 자유)
    s = reducer(s, { type: "PLACE_INGREDIENT", orderId: o.id, taskIndex: 1 });
    s = answerActive(s, (wrong as readonly number[]).includes(1) ? wrongAnswer(order(s).tasks[1]) : correctAnswer(order(s).tasks[1]));
    s = reducer(s, { type: "ADD_TO_CAULDRON", orderId: o.id, taskIndex: 1 });
    const half = s;
    assert.equal(reducer(half, { type: "STIR", orderId: o.id, amount: 25 }), half, "한 재료만 넣고는 젓지 못함");
    assert.equal(order(reducer(half, { type: "COMPLETE_POTION", orderId: o.id })).status, "brewing", "완성도 못 함");
    s = reducer(s, { type: "PLACE_INGREDIENT", orderId: o.id, taskIndex: 0 });
    s = answerActive(s, (wrong as readonly number[]).includes(0) ? wrongAnswer(order(s).tasks[0]) : correctAnswer(order(s).tasks[0]));
    s = reducer(s, { type: "ADD_TO_CAULDRON", orderId: o.id, taskIndex: 0 });
    for (let k = 0; k < 4; k++) s = reducer(s, { type: "STIR", orderId: o.id, amount: 25 });
    s = run(s, { type: "COMPLETE_POTION", orderId: o.id }, { type: "GO_COUNTER" }, { type: "DELIVER", orderId: o.id, now: NOW });
    assert.equal(order(s).quality, quality);
    assert.equal(order(s).reward, Math.floor((18 * pct) / 100));
    assert.equal(s.money, Math.floor((18 * pct) / 100));
    const again = run(s, { type: "DELIVER", orderId: o.id, now: NOW });
    assert.equal(again.money, s.money, "중복 지급 없음");
  }
});

test("바람 걸음 포션 특별 주문 판매가 24, 맞춤 배수는 ⑤⑥", () => {
  const c = createOrderFromKey("custom:wind:0.2", { orderNumber: 1, customerId: "fox", rng: createRng(1) });
  assert.equal(c.price, 24);
  assert.deepEqual(c.tasks.map((t) => [t.problem.a, t.problem.b, t.problem.answer, t.problem.learningType]), [
    ["0.4", "0.2", multiplyStrings("0.4", "0.2"), "d1xD"],
    ["0.35", "0.2", multiplyStrings("0.35", "0.2"), "d2xD"],
  ]);
});

/* ------------------------------ 주문서 힌트 ------------------------------ */

test("주문서 힌트: 재료별 식만(정답·계산 결과 없음), 지정량·비교 문제는 안내만", () => {
  const multi = createOrderFromKey("multiBottle:wind:3", { orderNumber: 1, customerId: "fox", rng: createRng(1) });
  const h = orderHints(multi);
  assert.deepEqual(h.map((x) => [x.name, x.text]), [
    ["깃털풀", "0.4 × 3을 계산해 보세요."],
    ["바람 정령의 파편", "0.35 × 3을 계산해 보세요."],
  ]);
  for (const x of h) assert.doesNotMatch(x.text, /1\.2|1\.05|=/, "계산 결과 없음");
  const energy = createOrderFromKey("multiBottle:energy:3", { orderNumber: 1, customerId: "fox", rng: createRng(1) });
  assert.equal(orderHints(energy)[0].text, "0.6 × 3을 계산해 보세요.");
  const custom = createOrderFromKey("custom:wind:0.5", { orderNumber: 1, customerId: "fox", rng: createRng(1) });
  assert.deepEqual(orderHints(custom).map((x) => x.text), ["0.4 × 0.5를 계산해 보세요.", "0.35 × 0.5를 계산해 보세요."]);
  const amount = createOrderFromKey("amount:energy:base:2:0.35", { orderNumber: 1, customerId: "fox", rng: createRng(1) });
  assert.equal(orderHints(amount)[0].text, "2 × 0.35를 계산해 보세요.", "손님 지정량 주문은 손님이 정한 양으로");
});

test("주문서 힌트: 생활 소재·비교 주문 (실제 조건), 지정량 과제는 새 식을 만들지 않음", async () => {
  const { LIFE_ITEMS } = await import("../src/data/lifeItems.ts");
  const item = Object.values(LIFE_ITEMS)[0];
  const [a, b] = item.pairs[0];
  const life = createOrderFromKey(`life:${item.id}:${a}:${b}`, { orderNumber: 1, customerId: "fox", rng: createRng(1), recipes: [RECIPES.wind] });
  const h = orderHints(life);
  assert.equal(h.length, 2);
  const calc = h.find((x) => x.mode === "calc")!;
  const spec = h.find((x) => x.mode === "specified")!;
  assert.match(calc.text, new RegExp(`^${a.replace(".", "\\.")} × ${b.replace(".", "\\.")}(을|를) 계산해 보세요\\.$`));
  assert.doesNotMatch(spec.text, /×|\d+(\.\d+)?g/, "지정량 과제는 식·양 없음");
  const shift = createOrderFromKey("shift:0.6:3:aX10", { orderNumber: 1, customerId: "fox", rng: createRng(1), recipes: [RECIPES.energy] });
  const sh = orderHints(shift)[0].text;
  assert.match(sh, /0\.6 × 3과 이번 식 6 × 3을 비교/);
  assert.match(sh, /몇 배/);
  assert.doesNotMatch(sh, /10배|1\.8|18/, "관계의 답(10배)·곱은 말하지 않음");
});

test("힌트 사용 기록: 공개 시 아직 답을 내지 않은 과제만, 여러 번 열어도 한 번, 지난 기록은 소급 변경 없음", () => {
  let s = windBrewing("multiBottle:wind:4", 9);
  const id = order(s).id;
  // 첫 재료는 힌트 없이 답을 낸다
  s = reducer(s, { type: "PLACE_INGREDIENT", orderId: id, taskIndex: 0 });
  s = answerActive(s, correctAnswer(order(s).tasks[0]));
  s = reducer(s, { type: "ADD_TO_CAULDRON", orderId: id, taskIndex: 0 });
  // 두 번째 재료 계량 중(입력 중인 답 있음)에 주문서 힌트 공개
  s = reducer(s, { type: "PLACE_INGREDIENT", orderId: id, taskIndex: 1 });
  s = run(s, { type: "INPUT_KEY", key: "1" }, { type: "INPUT_KEY", key: "." });
  const r1 = reducer(s, { type: "REVEAL_HINT", orderId: id });
  assert.deepEqual(order(r1).tasks.map((t) => t.hintLevel), [0, 1], "이미 답을 낸 과제는 그대로");
  assert.equal(r1.draftAnswer, "1.", "입력 중인 답 유지");
  assert.equal(r1.activeTask, 1, "계량 패널 유지");
  assert.equal(r1.money, s.money);
  const r2 = reducer(r1, { type: "REVEAL_HINT", orderId: id });
  assert.equal(r2, r1, "다시 열어도 중복 집계 없음");
  assert.equal(reducer(r1, { type: "REVEAL_HINT", orderId: "order-999" }), r1, "다른 주문 ID는 무시");
  let done = run(r2, { type: "INPUT_KEY", key: "clear" });
  done = answerActive(done, correctAnswer(order(done).tasks[1]));
  const log = done.problemLog.slice(-2);
  assert.deepEqual(log.map((r) => r.hintLevel), [0, 1]);
  done = reducer(done, { type: "ADD_TO_CAULDRON", orderId: id, taskIndex: 1 });
  for (let k = 0; k < 4; k++) done = reducer(done, { type: "STIR", orderId: id, amount: 25 });
  done = run(done, { type: "COMPLETE_POTION", orderId: id }, { type: "GO_COUNTER" }, { type: "DELIVER", orderId: id, now: NOW });
  assert.equal(order(done).reward, order(done).price, "힌트는 감액 없음");
  // 답을 낸 뒤 공개해도 지난 기록은 그대로
  const after = reducer(done, { type: "REVEAL_HINT", orderId: id });
  assert.equal(after, done);
});

/* ------------------------------ 마감 집계 ------------------------------ */

test("마감 집계: 잘못 만든 포션 = 틀린 재료가 있는 주문의 병 수 합, 계산 문제 수는 실제 과제 수", () => {
  let s = run({ ...createInitialState(), unlockedIngredients: BOTH }, { type: "START", seed: 33 });
  // 두 번째·네 번째 손님은 첫 재료를 틀리게
  s = playFullDay(s, (i) => (i === 1 || i === 3 ? { wrong: [0] } : {}));
  const paid = s.day!.orders;
  const expected = paid.filter((_, i) => i === 1 || i === 3).reduce((a, o) => a + o.bottles, 0);
  assert.equal(wrongPotionCount(paid), expected);
  const sum = summarizeDay(s.day!, s.money, NOW);
  assert.equal(sum.wrongPotions, expected);
  assert.equal(sum.potionsMade, paid.reduce((a, o) => a + o.bottles, 0));
  assert.equal(sum.totalProblems, paid.flatMap((o) => o.tasks).filter((t) => t.mode !== "specified").length, "기력 1문제·바람 2문제씩");
  assert.equal(sum.moneyEarned, s.day!.moneyEarned);
  // 마감 → 기록에 남음 (화면에서 숨긴 통계도 JSON에 그대로)
  const closed = run(s, { type: "CLOSE_DAY", dayNumber: 1, now: NOW });
  const h = closed.dayHistory[0];
  assert.equal(h.wrongPotions, expected);
  assert.equal(typeof h.hintUsed, "number");
  assert.equal(typeof h.firstTryCorrect, "number");
  assert.ok(h.quality);
});

test("잘못 만든 포션: 여러 병 주문은 병 수 그대로, 1병 주문은 1, 정답 수·문제 수로 세지 않음", () => {
  const mk = (key: string, wrong: boolean[]): Order => {
    const o = createOrderFromKey(key, { orderNumber: 1, customerId: "fox", rng: createRng(1) });
    return { ...o, status: "paid", tasks: o.tasks.map((t, i) => ({ ...t, correct: !wrong[i] })) };
  };
  assert.equal(wrongPotionCount([mk("multiBottle:wind:3", [false, true])]), 3, "한 재료라도 틀리면 3병");
  assert.equal(wrongPotionCount([mk("multiBottle:wind:3", [true, true])]), 3, "두 재료 다 틀려도 3병 (문제 수가 아님)");
  assert.equal(wrongPotionCount([mk("custom:wind:0.2", [true, false])]), 1);
  assert.equal(wrongPotionCount([mk("multiBottle:energy:7", [false])]), 0);
});

/* ------------------------------ 저장 버전 5 ------------------------------ */

test("저장 v5: 새 항목 검사 (안내·첫 주문 목록은 해금된 레시피만)", () => {
  const s = run({ ...createInitialState(), money: 300 }, { type: "START", seed: 5 },
    { type: "UNLOCK_INGREDIENT", ingredientId: "featherGrass" }, { type: "UNLOCK_INGREDIENT", ingredientId: "windShard" });
  assert.equal(s.saveVersion, 5);
  const ok = validateState(roundTrip(s));
  assert.ok(ok.ok);
  if (ok.ok) assert.deepEqual(ok.state, s);
  for (const [k, v] of [["recipeNotices", ["nope"]], ["recipeNotices", ["wind", "wind"]], ["featuredRecipes", ["starlight"]], ["recipeNotices", "wind"]] as const) {
    assert.equal(validateState({ ...roundTrip(s), [k]: v }).ok, false, `${k} ${JSON.stringify(v)}`);
  }
  // 재료 하나만 해금했는데 안내가 있으면 거부
  assert.equal(validateState({ ...roundTrip(s), unlockedIngredients: ["energyHerb", "featherGrass"] }).ok, false);
  const noField = roundTrip(s) as Record<string, unknown>;
  delete noField.featuredRecipes;
  assert.equal(validateState(noField).ok, false);
});

test("v4 저장(실제 직전 버전 코드로 만든 계량 중·젓는 중) → v5: 진행·입력 중인 답·기록 보존, 새 재료는 잠김", () => {
  for (const name of ["v4-midmeasure.json", "v4-midstir.json"]) {
    const raw = fixture(name);
    const v4 = JSON.parse(raw);
    assert.equal(v4.saveVersion, 4);
    const store = memoryStorage();
    store.setItem(SAVE_KEY, raw);
    const l = loadGame(1, store);
    assert.equal(l.kind, "ok", l.kind === "error" ? l.errors.join(",") : "");
    if (l.kind !== "ok") continue;
    const s = l.state;
    assert.equal(l.migratedFrom, 4);
    assert.equal(store.mem.get("moonlight-potion-shop/backup-v4"), raw, "원본 백업");
    assert.equal(s.saveVersion, 5);
    assert.equal(s.scene, v4.scene, "화면 그대로 이어감");
    assert.equal(s.money, v4.money, "돈을 보충하지 않음");
    assert.deepEqual(s.unlockedIngredients, ["energyHerb"], "새 재료는 잠김, 구매 내역 지어내지 않음");
    assert.deepEqual([s.recipeNotices, s.featuredRecipes], [[], []]);
    assert.deepEqual(s.day, v4.day, "오늘의 주문 목록·현재 주문·제조·젓기 진행 그대로");
    assert.equal(s.draftAnswer, v4.draftAnswer);
    assert.equal(s.activeTask, v4.activeTask);
    assert.deepEqual(s.problemLog, v4.problemLog, "학습 기록(이전 단계별 힌트 2단계 포함) 그대로");
    assert.ok(s.problemLog.some((r) => r.hintLevel === 2), "이전 힌트 기록 보존");
    assert.deepEqual(s.review, v4.review);
    assert.deepEqual(s.paidOrderIds, v4.paidOrderIds);
    assert.deepEqual(s.decks, v4.decks);
    // 이어서 끝까지 진행 가능
    let g = s;
    if (g.activeTask !== null) {
      g = run(g, { type: "INPUT_KEY", key: "clear" });
      g = answerActive(g, correctAnswer(order(g).tasks[g.activeTask!]));
    }
    g = serveCurrent(g);
    assert.equal(order(g).status, "paid");
  }
});

test("가져오기: v4 내보내기 파일·v5 파일은 받아들이고, 잘못된 v5 파일은 거부", () => {
  const v4 = JSON.parse(fixture("v4-midstir.json"));
  const file4 = JSON.stringify({ format: "moonlight-potion-shop/save", exportedAt: NOW, saveVersion: 4, game: v4 });
  const r4 = parseImportText(file4, 1);
  assert.ok(r4.ok, r4.ok ? "" : JSON.stringify(r4));
  if (r4.ok) {
    assert.equal(r4.migratedFrom, 4);
    assert.equal(r4.state.money, v4.money);
  }
  const s = run({ ...createInitialState(), money: 300 }, { type: "START", seed: 6 }, { type: "UNLOCK_INGREDIENT", ingredientId: "featherGrass" });
  const text = JSON.stringify(buildSaveExport(s, NOW));
  const imp = parseImportText(text, 1);
  assert.ok(imp.ok);
  if (imp.ok) assert.deepEqual(imp.state.unlockedIngredients, ["energyHerb", "featherGrass"]);
  const bad = JSON.parse(text);
  bad.game.recipeNotices = ["wind"];
  assert.equal(parseImportText(JSON.stringify(bad), 1).ok, false, "해금 안 된 레시피 안내는 거부");
  const bad2 = JSON.parse(text);
  bad2.game.unlockedIngredients = ["energyHerb", "featherGrass", "windShard"];
  bad2.game.money = -1;
  assert.equal(parseImportText(JSON.stringify(bad2), 1).ok, false);
  assert.equal(interpretSaveData({ saveVersion: 6 }, 1).ok, false, "더 새로운 버전 거부");
});

test("한 재료(기력 포션) 주문은 그대로: 정답 100%, 오답 60%, 하루 5문제", () => {
  let s = run(createInitialState(), { type: "START", seed: 44 });
  s = playFullDay(s, (i) => (i % 2 ? { wrong: [0] } : {}));
  const sum = summarizeDay(s.day!, s.money, NOW);
  assert.equal(sum.totalProblems, 5);
  for (const o of s.day!.orders) {
    assert.equal(o.tasks.length, 1);
    assert.equal(o.reward, Math.floor((o.price * (o.tasks[0].correct ? 100 : 60)) / 100));
  }
  assert.equal(getIngredient("energyHerb").unlockCost, 0);
});
