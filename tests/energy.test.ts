// 기력 포션(재료 1종)·한 과제 판매금·재료 해금·저장 버전 4→5 (이전 3단계 저장 옮기기)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createInitialState, reducer } from "../src/game/reducer.ts";
import { INGREDIENTS, type Ingredient } from "../src/data/ingredients.ts";
import { RECIPES, type Recipe } from "../src/data/recipes.ts";
import { introducedTypes, LEARNING_TYPE_IDS, type LearningTypeId } from "../src/data/learningTypes.ts";
import { amountCandidates, candidatesFor, createOrderFromKey, ORDER_KINDS, uncoveredTypes } from "../src/game/orderFactory.ts";
import { orderHints, solutionSteps } from "../src/game/explain.ts";
import { summarizeDay } from "../src/game/daySummary.ts";
import { interpretSaveData, loadGame, SAVE_KEY, validateState } from "../src/game/save.ts";
import { buildSaveExport, parseImportText } from "../src/game/transfer.ts";
import {
  availableRecipes, freeIngredients, GAME_CATALOG, isRecipeAvailable, normalizeUnlocked, shopIngredients, tryUnlock, type UnlockCatalog,
} from "../src/game/unlocks.ts";
import { createRng } from "../src/lib/rng.ts";
import type { GameState } from "../src/game/types.ts";
import {
  answerActive, closeAndNext, correctAnswer, memoryStorage, NOW, order, playFullDay, roundTrip, run, serveCurrent, startBrewing, wrongAnswer,
} from "./helpers.ts";

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
const allOrders = (s: GameState) => s.day!.orders;

/* ------------------------------ 기력 포션 ------------------------------ */

test("기력 포션 데이터: 기력초 1종, 1병당 0.6g, 기본 용액 자동", () => {
  const r = RECIPES.energy;
  assert.equal(r.name, "기력 포션");
  assert.deepEqual(r.additives, [{ ingredientId: "energyHerb", amount: "0.6" }]);
  assert.equal(INGREDIENTS.energyHerb.unit, "g");
  assert.equal(INGREDIENTS.energyHerb.unlockCost, 0);
  assert.equal(INGREDIENTS.energyHerb.drawer, 0, "맨 왼쪽 위 서랍");
  for (const id of ["starlight", "courage", "sprout", "mist"]) assert.equal(RECIPES[id].legacy, true, id);
});

test("새 영업: 기력 포션 주문만, 주문마다 재료 과제 1개, 하루 계산 문제 5개 (8일)", () => {
  let s = run(createInitialState(), { type: "START", seed: 31 });
  for (let d = 0; d < 8; d++) {
    for (const o of allOrders(s)) {
      assert.equal(o.recipeId, "energy", `day ${d + 1} ${o.id}`);
      assert.equal(o.tasks.length, 1);
      assert.equal(o.tasks[0].ingredientId, "energyHerb");
      assert.notEqual(o.tasks[0].mode, "specified", "기력 포션에는 지정량 과제가 없다");
    }
    const ended = playFullDay(s, (i) => ({ wrong: i % 2 ? [0] : [] }));
    const sum = summarizeDay(ended.day!, ended.money, NOW);
    assert.equal(sum.totalProblems, 5, `day ${d + 1} 문제 수`);
    assert.equal(sum.firstTryCorrect + (sum.wrong ?? 0), 5);
    s = closeAndNext(ended, 70 + d);
  }
  assert.equal(s.dayHistory.at(-1)!.totalProblems, 5);
});

test("기본 레시피 주문은 0.6g을 그대로 쓰고, 다른 인수 구조는 '손님 지정량 주문'으로 구분", () => {
  const intro = introducedTypes(3);
  for (const c of candidatesFor("multiBottle", intro)) {
    const o = createOrderFromKey(c.key, { orderNumber: 1, customerId: "fox", rng: createRng(1) });
    assert.equal(o.tasks[0].problem.a, "0.6", c.key);
    assert.equal(o.tasks[0].problem.learningType, "d1xN");
  }
  for (const c of candidatesFor("customMultiplier", intro)) {
    const o = createOrderFromKey(c.key, { orderNumber: 1, customerId: "fox", rng: createRng(1) });
    assert.equal(o.tasks[0].problem.a, "0.6", c.key);
  }
  // 손님 지정량: 원래 대사·쉬운 설명·메모·해설의 조건이 문제와 같다. 정답은 말하지 않는다
  for (const c of amountCandidates(intro)) {
    for (const cust of ["fox", "cat"]) {
      const o = createOrderFromKey(c.key, { orderNumber: 3, customerId: cust, rng: createRng(c.key.length) });
      const t = o.tasks[0];
      assert.equal(o.kind, "customAmount");
      assert.deepEqual([o.given!.amount, o.given!.times], [t.problem.a, t.problem.b], c.key);
      const amt = `${t.problem.a}g`;
      assert.ok(o.script.original.includes(amt), `${c.key} 원래 대사에 지정량`);
      assert.ok(o.script.easy.includes(amt), `${c.key} 쉬운 설명에 지정량`);
      assert.ok(o.script.memo.join(" ").includes(amt), `${c.key} 메모`);
      if (o.given!.form === "perBottle") assert.ok(o.script.original.includes(`${t.problem.b}병`));
      else assert.ok(o.script.original.includes(`${t.problem.b}배`));
      const hidden = t.problem.answer;
      if (hidden.includes(".") && !t.problem.a.includes(hidden) && !t.problem.b.includes(hidden)) {
        assert.ok(!(o.script.original + o.script.easy + o.script.memo.join(" ")).includes(hidden), `${c.key} 정답 노출`);
      }
      assert.match(solutionSteps(o, t)[0], /손님이/);
      assert.match(orderHints(o)[0].text, new RegExp(`^${t.problem.a.replace(".", "\\.")} × ${t.problem.b.replace(".", "\\.")}(을|를) 계산해 보세요\\.$`), c.key);
    }
  }
});

test("한 재료로 지원하는 학습 유형: ①~⑦ 모두 후보가 있음 (유형별 주문 종류)", () => {
  const all = introducedTypes(3);
  assert.deepEqual(uncoveredTypes(all), []);
  const byType: Record<string, Set<string>> = {};
  for (const k of ORDER_KINDS) for (const c of candidatesFor(k, all)) for (const t of c.types) (byType[t] ??= new Set()).add(k);
  const expect: Record<LearningTypeId, string[]> = {
    d1xN: ["multiBottle", "lifeItem"],
    d2xN: ["customAmount", "lifeItem"],
    Nxd1: ["customAmount", "lifeItem"],
    Nxd2: ["customAmount", "lifeItem"],
    d1xD: ["customMultiplier", "lifeItem"],
    d2xD: ["customAmount", "lifeItem"],
    shift: ["pointShift"],
  };
  for (const t of LEARNING_TYPE_IDS) for (const k of expect[t]) assert.ok(byType[t]?.has(k), `${t} ← ${k}`);
  // 각 단계에서도 그날 소개 유형을 낼 수 있다 (무한 재시도·다른 레시피 우회 없음)
  for (let st = 0; st <= 3; st++) assert.deepEqual(uncoveredTypes(introducedTypes(st)), [], `stage ${st}`);
});

test("기력 포션 생활 소재·비교 주문: 기력초 한 과제, 다른 재료 문장 없음", () => {
  const life = createOrderFromKey("life:ribbon:3:0.4", { orderNumber: 1, customerId: "rabbit", rng: createRng(2) });
  assert.equal(life.recipeId, "energy");
  assert.equal(life.tasks.length, 1);
  assert.equal(life.tasks[0].ingredientId, "energyHerb");
  assert.equal(life.tasks[0].problem.unit, "g");
  assert.doesNotMatch(life.script.easy, /기본량으로 넣어/);
  assert.match(life.script.original, /기력초/);
  const shift = createOrderFromKey("shift:2.4:3:aD10", { orderNumber: 2, customerId: "wolf", rng: createRng(2) });
  assert.equal(shift.tasks.length, 1);
  assert.match(shift.script.original, /기력초를 2\.4 × 3 = 7\.2g/);
  assert.match(solutionSteps(shift, shift.tasks[0]).at(-1)!, /0\.72g/);
});

test("한 재료 주문 판매금: 정답 100%, 오답 60% (80% 없음), 힌트·'네?'는 감액 없음", () => {
  for (const [wrong, q, pct] of [[[], "great", 100], [[0], "poor", 60]] as const) {
    let s = run(createInitialState(), { type: "START", seed: 52 });
    s = run(s, { type: "ASK_AGAIN", orderId: order(s).id });
    const price = order(s).price;
    s = serveCurrent(s, { wrong: [...wrong], hint: true });
    assert.equal(order(s).quality, q);
    assert.equal(order(s).reward, Math.floor((price * pct) / 100));
    assert.equal(s.money, order(s).reward);
  }
});

test("중복 투입·중복 완성·중복 보상 차단, 형식 오류는 확정하지 않음", () => {
  let s = startBrewing(14);
  const o = order(s);
  s = reducer(s, { type: "PLACE_INGREDIENT", orderId: o.id, taskIndex: 0 });
  const bad = run(s, { type: "INPUT_KEY", key: "1" }, { type: "INPUT_KEY", key: "." }, { type: "SUBMIT_ANSWER", now: NOW });
  assert.equal(order(bad).tasks[0].status, "pending", "형식 오류는 재입력");
  assert.equal(bad.feedback?.kind, "format");
  s = answerActive(s, correctAnswer(o.tasks[0]));
  s = reducer(s, { type: "ADD_TO_CAULDRON", orderId: o.id, taskIndex: 0 });
  const again = reducer(s, { type: "ADD_TO_CAULDRON", orderId: o.id, taskIndex: 0 });
  assert.equal(again, s, "두 번 투입 안 됨");
  const replace = reducer(s, { type: "PLACE_INGREDIENT", orderId: o.id, taskIndex: 0 });
  assert.equal(replace.activeTask, null, "완료 재료는 다시 놓을 수 없음");
  for (let k = 0; k < 6; k++) s = reducer(s, { type: "STIR", orderId: o.id, amount: 25 });
  s = reducer(s, { type: "COMPLETE_POTION", orderId: o.id });
  const twice = reducer(s, { type: "COMPLETE_POTION", orderId: o.id });
  assert.deepEqual(twice.day, s.day);
  s = run(s, { type: "GO_COUNTER" }, { type: "DELIVER", orderId: o.id, now: NOW }, { type: "DELIVER", orderId: o.id, now: NOW });
  assert.equal(s.money, order(s).reward);
  assert.equal(s.paidOrderIds.filter((x) => x === o.id).length, 1);
});

/* ------------------------------ 재료 해금 ------------------------------ */

const herb = (id: string, cost: number, extra: Partial<Ingredient> = {}): Ingredient => ({
  id, name: id, unit: "g", kind: "herb", color: "#000000", description: "테스트 전용", drawer: 1, unlockCost: cost, ...extra,
});
const recipe = (id: string, ings: string[], extra: Partial<Recipe> = {}): Recipe => ({
  ...RECIPES.energy, id, name: id, additives: ings.map((i) => ({ ingredientId: i, amount: "0.6" })), ...extra,
});
/** 테스트 전용 카탈로그 (게임 데이터에는 들어가지 않는다) */
const TEST: UnlockCatalog = {
  ingredients: { free: herb("free", 0), moonGrass: herb("moonGrass", 30), sunPetal: herb("sunPetal", 50), old: herb("old", 0, { legacy: true }) },
  recipes: {
    basic: recipe("basic", ["free"]),
    duo: recipe("duo", ["moonGrass", "sunPetal"]),
    half: recipe("half", ["free", "moonGrass"]),
    retired: recipe("retired", ["free"], { legacy: true }),
  },
};

test("해금 기본값: 기력초·기력 포션은 처음부터, 이전 레시피는 새 주문에 없음, 판매 메뉴에 가짜 상품 없음", () => {
  const s = createInitialState();
  assert.deepEqual(s.unlockedIngredients, ["energyHerb"]);
  assert.deepEqual(freeIngredients(), ["energyHerb"]);
  assert.deepEqual(availableRecipes(s.unlockedIngredients).map((r) => r.id), ["energy"]);
  assert.deepEqual(shopIngredients().map((i) => i.id), ["energyHerb", "featherGrass", "windShard"], "서랍에서 파는 실제 재료만");
  assert.equal(GAME_CATALOG.ingredients.moonGrass, undefined, "테스트 상품은 게임에 없음");
  const r = run(s, { type: "START", seed: 1 });
  assert.equal(r.money, 0, "돈 없이 첫 영업 시작");
  assert.equal(r.day!.orders.length, 5);
});

test("재료 구매 규칙 (테스트 전용 데이터): 잔액 부족·중복 구매·없는 재료·이전 재료는 차감 없음", () => {
  const start = normalizeUnlocked([], TEST);
  assert.deepEqual(start, ["free"]);
  assert.deepEqual(tryUnlock(29, start, "moonGrass", TEST), { ok: false, reason: "insufficient", cost: 30 });
  const ok = tryUnlock(100, start, "moonGrass", TEST);
  assert.ok(ok.ok);
  if (!ok.ok) return;
  assert.equal(ok.money, 70);
  assert.deepEqual(ok.unlocked, ["free", "moonGrass"]);
  const again = tryUnlock(ok.money, ok.unlocked, "moonGrass", TEST);
  assert.deepEqual(again, { ok: false, reason: "already", cost: 30 }, "다시 눌러도 돈이 빠지지 않음");
  assert.equal(tryUnlock(100, start, "free", TEST).ok, false, "무료 재료는 사지 않음");
  assert.deepEqual(tryUnlock(100, start, "nope", TEST), { ok: false, reason: "unknown", cost: null });
  assert.deepEqual(tryUnlock(100, start, "old", TEST), { ok: false, reason: "notForSale", cost: null });
  // 레시피: 필요한 재료를 모두 해금해야만
  assert.equal(isRecipeAvailable(TEST.recipes.half, start), false);
  assert.equal(isRecipeAvailable(TEST.recipes.half, ok.unlocked), true);
  assert.equal(isRecipeAvailable(TEST.recipes.duo, ok.unlocked), false, "재료 하나만 있으면 안 됨");
  const both = tryUnlock(ok.money, ok.unlocked, "sunPetal", TEST);
  assert.ok(both.ok && both.money === 20);
  assert.ok(both.ok && isRecipeAvailable(TEST.recipes.duo, both.unlocked));
  assert.ok(both.ok && !isRecipeAvailable(TEST.recipes.retired, both.unlocked), "이전 레시피는 해금과 관계없이 새 주문 없음");
  assert.deepEqual(availableRecipes(both.ok ? both.unlocked : [], TEST).map((r) => r.id), ["basic", "duo", "half"]);
  // 정수가 아닌 소지금 등 이상한 값
  assert.equal(tryUnlock(Number.NaN, start, "moonGrass", TEST).ok, false);
});

test("리듀서 UNLOCK_INGREDIENT: 실제 데이터로만, 이미 해금이면 상태 그대로", () => {
  const s = { ...createInitialState(), money: 500 };
  assert.equal(reducer(s, { type: "UNLOCK_INGREDIENT", ingredientId: "energyHerb" }), s);
  assert.equal(reducer(s, { type: "UNLOCK_INGREDIENT", ingredientId: "moonGrass" }), s, "게임 데이터에 없는 재료");
  assert.equal(reducer(s, { type: "UNLOCK_INGREDIENT", ingredientId: "moonDew" }), s, "이전 버전 재료는 팔지 않음");
  const open = run(s, { type: "START", seed: 2 });
  assert.equal(reducer(open, { type: "UNLOCK_INGREDIENT", ingredientId: "energyHerb" }), open);
});

/* ------------------------------ 저장 (버전 4에서 추가된 해금 목록) ------------------------------ */

test("저장: 해금 목록 검사 (기력초 빠짐·없는 재료·중복은 거부), 저장 → 복구 같음", () => {
  const s = run(createInitialState(), { type: "START", seed: 3 });
  assert.equal(s.saveVersion, 5);
  const r = validateState(roundTrip(s));
  assert.ok(r.ok);
  if (r.ok) assert.deepEqual(r.state, s);
  for (const bad of [[], ["moonGrass", "energyHerb"], ["energyHerb", "energyHerb"], ["moonDew", "energyHerb"]]) {
    assert.equal(validateState({ ...roundTrip(s), unlockedIngredients: bad }).ok, false, JSON.stringify(bad));
  }
  const noField = roundTrip(s) as Record<string, unknown>;
  delete noField.unlockedIngredients;
  assert.equal(validateState(noField).ok, false);
});

test("저장: 손님 지정량 주문의 조건·문제를 조작하면 거부", () => {
  const key = amountCandidates(introducedTypes(1)).find((c) => c.key.includes(":base:"))!.key;
  let s = run(createInitialState(), { type: "START", seed: 4 });
  const o = { ...createOrderFromKey(key, { orderNumber: 1, customerId: "fox", rng: createRng(1) }), status: "arrived" as const };
  s = { ...s, day: { ...s.day!, introSeen: true, orders: [o, ...s.day!.orders.slice(1)] } };
  assert.ok(validateState(roundTrip(s)).ok, "정상");
  const t1 = roundTrip(s) as any;
  t1.day.orders[0].given.amount = "9";
  assert.equal(validateState(t1).ok, false);
  const t2 = roundTrip(s) as any;
  t2.day.orders[0].tasks[0].problem.answer = "1";
  assert.equal(validateState(t2).ok, false);
  const t3 = roundTrip(s) as any;
  t3.day.orders[1].given = { form: "base", amount: "2", times: "0.3" };
  assert.equal(validateState(t3).ok, false, "다른 주문에 지정량 정보");
});

test("3단계 저장(v3, 실제 3단계 코드로 만든 젓는 중 저장) → v5: 진행·돈·기록 보존, 그 하루는 원래 주문으로", () => {
  const raw = fixture("phase3-midstir.json");
  const v3 = JSON.parse(raw);
  const store = memoryStorage();
  store.setItem(SAVE_KEY, raw);
  const l = loadGame(5, store);
  assert.equal(l.kind, "ok", l.kind === "error" ? l.errors.join(",") : "");
  if (l.kind !== "ok") return;
  const s = l.state;
  assert.equal(l.migratedFrom, 3);
  assert.equal(store.mem.get("moonlight-potion-shop/backup-v3"), raw, "원본 백업");
  assert.equal(s.saveVersion, 5);
  assert.deepEqual(s.unlockedIngredients, ["energyHerb"]);
  assert.equal(s.money, v3.money);
  assert.deepEqual(s.day!.orders, v3.day.orders, "진행 중인 하루의 주문 그대로");
  assert.deepEqual(s.problemLog, v3.problemLog);
  assert.deepEqual(s.paidOrderIds, v3.paidOrderIds);
  assert.equal(order(s).stirProgress, 50);
  // 이전 주문(안개 포션, 2재료)을 그대로 마칠 수 있고 다음 영업부터는 기력 포션만
  let g = s;
  for (let k = 0; k < 2; k++) g = reducer(g, { type: "STIR", orderId: order(g).id, amount: 25 });
  g = run(g, { type: "COMPLETE_POTION", orderId: order(g).id }, { type: "GO_COUNTER" }, { type: "DELIVER", orderId: order(g).id, now: NOW });
  assert.equal(order(g).status, "paid");
  assert.equal(order(g).reward, order(g).price, "두 재료 모두 정확 → 100%");
  g = run(g, { type: "NEXT_CUSTOMER", fromOrderId: order(g).id });
  g = playFullDay(g, () => ({}));
  assert.ok(g.day!.orders.every((o) => o.recipeId !== "energy"), "그 하루는 이전 주문 그대로");
  g = closeAndNext(g, 9);
  assert.ok(g.day!.orders.every((o) => o.recipeId === "energy" && o.tasks.length === 1), "다음 영업부터 기력 포션만");
});

test("3단계 저장(마감 직전·2일차 진행 중) 옮기기와 가져오기: 해금 상태 복구, 잘못된 파일은 거부", () => {
  for (const name of ["phase3-day2.json", "phase3-last-paid.json"]) {
    const raw = fixture(name);
    const r = interpretSaveData(JSON.parse(raw), 1);
    assert.ok(r.ok, name);
    if (!r.ok) continue;
    assert.equal(r.migratedFrom, 3);
    assert.deepEqual(r.state.unlockedIngredients, ["energyHerb"]);
    assert.equal(r.state.dayHistory.length, JSON.parse(raw).dayHistory.length);
    // 내보내기 → 가져오기
    const text = JSON.stringify(buildSaveExport(r.state, NOW));
    const imp = parseImportText(text, 1);
    assert.ok(imp.ok, name);
    if (imp.ok) assert.deepEqual(imp.state, r.state);
  }
  const broken = JSON.parse(JSON.stringify(buildSaveExport(createInitialState(), NOW)));
  broken.game.unlockedIngredients = ["fakeHerb", "energyHerb"];
  assert.equal(parseImportText(JSON.stringify(broken), 1).ok, false);
});

test("한 재료 오답 해설·힌트: 1병당 0.6g 레시피 주문", () => {
  const o = createOrderFromKey("multiBottle:energy:3", { orderNumber: 1, customerId: "fox", rng: createRng(1) });
  const t = o.tasks[0];
  assert.equal(t.problem.answer, "1.8");
  assert.equal(wrongAnswer(t), "99");
  const steps = solutionSteps(o, t).join(" ");
  assert.match(steps, /1병에는 기력초 0\.6g이 필요하고, 주문은 3병/);
  assert.match(steps, /6 × 3 = 18/);
  assert.match(steps, /기력초 1\.8g이 필요해요/);
  assert.doesNotMatch(o.script.original + o.script.easy + o.script.memo.join(" "), /1\.8|0\.6 ×/, "기본 화면에 식·정답 없음");
});
