// 문제은행 180문항 · 출제 규칙 · 저장 버전 7 · 첫 주문 튜토리얼
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { convert } from "../scripts/convert-question-bank.ts";
import { QUESTION_BANK } from "../src/data/questionBank.ts";
import { INGREDIENTS } from "../src/data/ingredients.ts";
import { RECIPES } from "../src/data/recipes.ts";
import { INTRO_STAGES, MAX_INTRO_STAGE, introducedTypes } from "../src/data/learningTypes.ts";
import { createInitialState, reducer, TUTORIAL_ORDER } from "../src/game/reducer.ts";
import { BANK_PRICE_BOTTLE_CAP, createOrderFromKey, planDay } from "../src/game/orderFactory.ts";
import { bankLearningType, difficultyWeights, eligibleBank, pickBankQuestion } from "../src/game/questionBank.ts";
import { orderHints, solutionSteps } from "../src/game/explain.ts";
import { availableRecipes } from "../src/game/unlocks.ts";
import { loadGame, SAVE_KEY, validateState } from "../src/game/save.ts";
import { buildSaveExport, parseImportText } from "../src/game/transfer.ts";
import { tutorialStep } from "../src/game/tutorial.ts";
import { decimalPlaces, equals, multiplyStrings, parseDecimal } from "../src/lib/decimal.ts";
import { createRng } from "../src/lib/rng.ts";
import type { GameState, Order } from "../src/game/types.ts";
import { answerActive, closeAndNext, memoryStorage, NOW, order, playFullDay, roundTrip, run, serveCurrent, submit, wrongAnswer } from "./helpers.ts";

const TXT = readFileSync(new URL("../docs/question-bank/Moonlight-Potion-Shop-180-Questions-Revised.txt", import.meta.url), "utf8");
const ALL = Object.values(INGREDIENTS).filter((i) => !i.legacy).map((i) => i.id);

test("문제은행 원본: 180문항, 난이도 3 × 유형 3 × 20, ID·필수 필드, 오류 0", () => {
  const { questions, report } = convert(TXT);
  assert.deepEqual(report.errors, []);
  assert.equal(questions.length, 180);
  assert.equal(new Set(questions.map((q) => q.id)).size, 180);
  for (const d of ["하", "중", "상"]) for (const m of ["소수×자연수", "자연수×소수", "소수×소수"]) {
    assert.equal(questions.filter((q) => q.difficulty === d && q.mulType === m).length, 20, `${d} ${m}`);
  }
  // 게임 데이터 파일은 원본 변환 결과와 같다
  assert.deepEqual(JSON.parse(JSON.stringify(QUESTION_BANK)), JSON.parse(JSON.stringify(questions)));
  // 고친 것은 조사(은/는·이/가·을/를)와 '모두 N병' 병 수 명시뿐 (숫자·식은 그대로)
  const strip = (t: string) => t.replace(/, 모두 \d+병/g, "").replace(/[은는이가을를]/g, "");
  for (const f of report.josaFixes) assert.equal(strip(f.before), strip(f.after), f.id);
});

test("문제은행 정답: 십진 정수 연산으로 다시 계산해 모두 일치, 인수 소수 두 자리 이하, 곱 네 자리 이하", () => {
  for (const q of QUESTION_BANK) {
    assert.ok(decimalPlaces(q.a) <= 2 && decimalPlaces(q.b) <= 2, q.id);
    assert.ok(decimalPlaces(q.answer) <= 4, q.id);
    assert.ok(equals(parseDecimal(multiplyStrings(q.a, q.b)), parseDecimal(q.answer)), `${q.id}: ${q.a} × ${q.b} ≠ ${q.answer}`);
    assert.ok(RECIPES[q.recipeId] && INGREDIENTS[q.ingredientId], q.id);
    assert.ok(RECIPES[q.recipeId].additives.some((ad) => ad.ingredientId === q.ingredientId), q.id);
  }
  // 바람 정령의 파편은 기존 ID 재사용 (새 재료 없음)
  assert.ok(QUESTION_BANK.some((q) => q.ingredientId === "windShard"));
  assert.equal(Object.values(INGREDIENTS).filter((i) => !i.legacy).length, 15);
});

test("문제은행 문장: 손님 대사에 식·정답 없음, 힌트는 식만, 해설은 정답까지, 수가 서로 맞음", () => {
  for (const q of QUESTION_BANK) {
    assert.doesNotMatch(q.question, /×|=/, q.id);
    assert.ok(!new RegExp(`(^|[^0-9.])${q.answer.replace(".", "\\.")}g`).test(q.question) || q.answer === q.a || q.answer === q.b, `${q.id} 대사에 정답`);
    assert.ok(q.question.includes(q.a), `${q.id} 대사에 인수 a`);
    assert.ok(q.question.includes(q.b) || q.question.includes(`${q.bottles}`), `${q.id} 대사에 인수 b`);
    assert.ok(q.clarification.includes(q.a) && q.clarification.includes(q.b), `${q.id} 재설명`);
    assert.ok(q.hint.includes(`${q.a} × ${q.b}`) && !q.hint.includes("="), `${q.id} 힌트`);
    assert.ok(q.explanation.includes(`${q.a} × ${q.b}`) && q.explanation.includes(`${q.answer}g`), `${q.id} 해설`);
  }
});

test("동치 소수 인정: 0.4 = 0.40, 0.1125, 10 = 10.0", () => {
  const cases: [string, string][] = [["MP-001", "0.40"], ["MP-170", "0.1125"], ["MP-100", "10.0"]];
  for (const [id, ans] of cases) {
    let s = run({ ...createInitialState(), unlockedIngredients: ALL }, { type: "START", seed: 3 });
    s = reducer(s, { type: "ACK_INTRO", dayNumber: 1 });
    const first = s.day!.orders[0];
    const o: Order = { ...createOrderFromKey(`bank:${id}`, { orderNumber: Number(first.id.slice(6)), customerId: "fox", rng: createRng(1) }), status: "arrived" };
    s = { ...s, day: { ...s.day!, orders: [o, ...s.day!.orders.slice(1)] } };
    s = reducer(s, { type: "ACCEPT_ORDER", orderId: o.id });
    const i = o.tasks.findIndex((t) => t.problem.bankId === id);
    s = reducer(s, { type: "PLACE_INGREDIENT", orderId: o.id, taskIndex: i });
    s = submit(s, ans);
    assert.equal(order(s).tasks[i].correct, true, `${id} ${ans}`);
  }
});

test("문제은행 주문 구성: 지정 재료는 원문 인수 그대로, 다른 재료는 레시피 정상 조건, 모두 넣어야 완성", () => {
  for (const q of QUESTION_BANK) {
    const o = createOrderFromKey(`bank:${q.id}`, { orderNumber: 7, customerId: "fox", rng: createRng(2) });
    const r = RECIPES[q.recipeId];
    assert.equal(o.kind, "bank");
    assert.equal(o.tasks.length, r.additives.length, q.id);
    const per = q.mulType === "소수×자연수";
    o.tasks.forEach((t, i) => {
      assert.equal(t.ingredientId, r.additives[i].ingredientId);
      if (t.ingredientId === q.ingredientId) {
        assert.deepEqual([t.problem.a, t.problem.b, t.problem.bankId, t.problem.learningType], [q.a, q.b, q.id, bankLearningType(q)]);
      } else if (per) {
        assert.deepEqual([t.mode, t.problem.a, t.problem.b], ["calc", r.additives[i].amount, String(q.bottles)], `${q.id} 다른 재료 × 병 수`);
      } else {
        assert.equal(t.mode, "specified", `${q.id} 다른 재료는 계산 없이`);
        assert.ok(equals(parseDecimal(t.problem.answer), parseDecimal(r.additives[i].amount)), `${q.id} 다른 재료 1병 기본량`);
      }
    });
    assert.equal(o.bottles, per ? q.bottles : 1);
    assert.equal(o.price, per ? r.pricePerBottle * Math.min(q.bottles, BANK_PRICE_BOTTLE_CAP) : r.specialPrice);
    // 주문서 메모: 특별 조건과 기본 조건 구분, 식·정답 없음
    assert.ok(o.script.memo.some((m) => m.includes("특별 조건")));
    if (r.additives.length > 1) assert.ok(o.script.memo.some((m) => m.includes("기본 조건")));
    assert.ok(!o.script.memo.join(" ").includes("×") && !o.script.memo.join(" ").includes(`${q.answer}${"g"}`) || q.answer === q.a);
    assert.equal(o.script.original, q.question);
    assert.ok(o.script.easy.startsWith(q.clarification));
    // 힌트(주문서)·해설(계량 패널)은 문항 ID로
    const hint = orderHints(o).find((h) => h.ingredientId === q.ingredientId)!;
    assert.equal(hint.text, q.hint);
    const task = o.tasks.find((t) => t.problem.bankId)!;
    assert.ok(solutionSteps(o, task).join(" ").includes(`${q.answer}g`));
    // 저장 검사 통과
    assert.ok(validateState({ ...createInitialState(), scene: "title", day: null }).ok);
  }
});

test("출제 후보: 레시피의 모든 재료를 해금해야 (TXT required_ingredients만 보지 않음) + 소개된 유형만", () => {
  const intro = introducedTypes(MAX_INTRO_STAGE);
  // 사파이어·기력초만: 매의 눈(깃털풀 필요)·강철의 의지(호두 필요)는 후보 아님
  const few = eligibleBank(intro, availableRecipes(["energyHerb", "sapphireDust"]));
  assert.ok(few.length > 0 && few.every((q) => q.recipeId === "energy"));
  assert.ok(!few.some((q) => q.ingredientId === "sapphireDust"));
  // 첫날(①②만): 소수×자연수만
  const day1 = eligibleBank(INTRO_STAGES[0], availableRecipes(["energyHerb"]));
  assert.ok(day1.length > 0 && day1.every((q) => q.mulType === "소수×자연수" && q.recipeId === "energy"));
  // 하루 주문에서도: 잠긴 레시피·소개 안 된 유형 없음
  for (let seed = 1; seed <= 80; seed++) {
    const unlocked = seed % 3 === 0 ? ALL : seed % 3 === 1 ? ["energyHerb", "featherGrass", "windShard"] : ["energyHerb", "ogreSinew", "sapphireDust"];
    const stage = seed % 4;
    const usable = new Set(availableRecipes(unlocked).map((r) => r.id));
    const r = planDay({ dayNumber: 3 + seed, unlocked, introStage: stage, newTypes: [], decks: {}, nextOrderNumber: 1, review: [], rng: createRng(seed), useBank: true });
    for (const o of r.orders) {
      assert.ok(usable.has(o.recipeId), `${seed}: ${o.recipeId}`);
      for (const t of o.tasks) if (t.problem.learningType) assert.ok(introducedTypes(stage).includes(t.problem.learningType), `${seed}: ${t.problem.learningType}`);
    }
  }
});

test("난이도 비율: 1~5일 하만, 6~10일 상 없음, 11일 이후 상 등장 (허용 범위 밖은 쓰지 않음)", () => {
  assert.deepEqual(difficultyWeights(3), { 하: 1, 중: 0, 상: 0 });
  assert.deepEqual(difficultyWeights(8), { 하: 0.7, 중: 0.3, 상: 0 });
  assert.deepEqual(difficultyWeights(15), { 하: 0.3, 중: 0.6, 상: 0.1 });
  assert.deepEqual(difficultyWeights(25), { 하: 0.2, 중: 0.5, 상: 0.3 });
  const count = (day: number) => {
    const c: Record<string, number> = { 하: 0, 중: 0, 상: 0 };
    for (let seed = 1; seed <= 120; seed++) {
      const r = planDay({ dayNumber: day, unlocked: ALL, introStage: MAX_INTRO_STAGE, newTypes: [], decks: {}, nextOrderNumber: 1, review: [], rng: createRng(seed * 7), useBank: true });
      for (const o of r.orders) if (o.bank) c[o.bank.difficulty]++;
    }
    return c;
  };
  const d3 = count(3), d8 = count(8), d15 = count(15), d25 = count(25);
  assert.equal(d3.중 + d3.상, 0);
  assert.equal(d8.상, 0);
  assert.ok(d8.중 / (d8.하 + d8.중) > 0.2 && d8.중 / (d8.하 + d8.중) < 0.4, JSON.stringify(d8));
  const t15 = d15.하 + d15.중 + d15.상;
  assert.ok(d15.상 > 0 && d15.중 / t15 > 0.5 && d15.중 / t15 < 0.7, JSON.stringify(d15));
  const t25 = d25.하 + d25.중 + d25.상;
  assert.ok(d25.상 / t25 > 0.22 && d25.상 / t25 < 0.38, JSON.stringify(d25));
});

test("덱: 후보를 다 쓰기 전에는 같은 문항을 반복하지 않음, 다 쓰면 가장 오래전 문항부터", () => {
  const cands = eligibleBank(introducedTypes(MAX_INTRO_STAGE), availableRecipes(ALL)).filter((q) => q.difficulty === "하");
  let deck = undefined as Parameters<typeof pickBankQuestion>[0]["deck"];
  const seen: string[] = [];
  const rng = createRng(5);
  for (let i = 0; i < cands.length; i++) {
    const p = pickBankQuestion({ dayNumber: 2, candidates: cands, deck, rng, usedToday: new Set(), formulasToday: new Set(), allowTriple: true, tripleRecipes: new Set() })!;
    seen.push(p.question.id);
    deck = p.deck;
  }
  assert.equal(new Set(seen).size, cands.length, "한 바퀴 동안 중복 없음");
  const next = pickBankQuestion({ dayNumber: 2, candidates: cands, deck, rng, usedToday: new Set(), formulasToday: new Set(), allowTriple: true, tripleRecipes: new Set() })!;
  assert.equal(next.question.id, seen[0], "다 쓰면 가장 오래전 문항");
  // 게임 진행: 여러 날 동안 같은 날 같은 문항 없음, 저장 후에도 덱 유지
  let s = run({ ...createInitialState(), unlockedIngredients: ALL }, { type: "START", seed: 4 });
  const used: string[] = [];
  for (let d = 0; d < 6; d++) {
    const ids = s.day!.orders.filter((o) => o.bank).map((o) => o.bank!.questionId);
    assert.equal(new Set(ids).size, ids.length, "같은 날 같은 문항 없음");
    used.push(...ids);
    s = roundTrip(s);
    s = closeAndNext(playFullDay(s), 50 + d);
  }
  assert.equal(new Set(used).size, used.length, "후보가 충분하면 여러 날 동안도 반복 없음");
});

test("하루 주문·문항·대사는 저장되어 새로고침 후에도 같다, 위조하면 거부", () => {
  let s = run({ ...createInitialState(), unlockedIngredients: ALL }, { type: "START", seed: 8 });
  s = closeAndNext(playFullDay(s), 9);
  assert.ok(s.day!.orders.some((o) => o.kind === "bank"));
  const store = memoryStorage();
  store.setItem(SAVE_KEY, JSON.stringify(s));
  const l = loadGame(1, store);
  assert.equal(l.kind, "ok");
  if (l.kind === "ok") assert.deepEqual(l.state.day, s.day);
  const bank = s.day!.orders.findIndex((o) => o.kind === "bank");
  const bad = roundTrip(s);
  const bt = bad.day!.orders[bank].tasks.find((t) => t.problem.bankId)!;
  bt.problem.a = bt.problem.a + "1";
  bt.problem.answer = multiplyStrings(bt.problem.a, bt.problem.b);
  assert.equal(validateState(bad).ok, false, "문항과 다른 인수");
  const exp = parseImportText(JSON.stringify(buildSaveExport(s, NOW)), 1);
  assert.ok(exp.ok);
});

test("문제은행이 주 출제원: 6일차 이후 일반 자리 대부분이 문제은행, 후보가 없을 때만 생성기", () => {
  let bank = 0, fallback = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const r = planDay({ dayNumber: 6 + (seed % 20), unlocked: ALL, introStage: MAX_INTRO_STAGE, newTypes: [], decks: {}, nextOrderNumber: 1, review: [], rng: createRng(seed), useBank: true });
    bank += r.bankStats.bank;
    fallback += r.bankStats.fallback;
    assert.equal(r.orders.filter((o) => o.kind === "bank").length, r.bankStats.bank);
  }
  assert.ok(bank / (bank + fallback) > 0.95, `${bank}/${fallback}`);
  // 첫날(기력 포션 하·소수×자연수 후보 2개): 부족분은 생성기로
  const d1 = planDay({ dayNumber: 1, unlocked: ["energyHerb"], introStage: 0, newTypes: INTRO_STAGES[0], decks: {}, nextOrderNumber: 1, review: [], rng: createRng(3), useBank: true });
  assert.ok(d1.bankStats.bank >= 1 && d1.bankStats.fallback >= 1, JSON.stringify(d1.bankStats));
});

test("튜토리얼: 새 게임 첫 주문은 여우의 기력 포션 2병(0.6 × 2), 실제 행동으로만 단계 진행, 오답이어도 완료", () => {
  let s = run(createInitialState(), { type: "START", seed: 12, tutorial: true });
  const o = order(s);
  assert.deepEqual([o.customerId, o.deckKey, o.tasks[0].problem.a, o.tasks[0].problem.b, o.tasks[0].problem.answer], ["fox", TUTORIAL_ORDER.key, "0.6", "2", "1.2"]);
  assert.equal(o.kind, "multiBottle");
  assert.equal(s.tutorial!.status, "active");
  assert.equal(tutorialStep(s), "intro");
  s = reducer(s, { type: "ACK_INTRO", dayNumber: 1 });
  assert.equal(tutorialStep(s), "accept");
  s = reducer(s, { type: "ACCEPT_ORDER", orderId: o.id });
  assert.equal(tutorialStep(s), "order");
  s = reducer(s, { type: "GO_COUNTER" });
  assert.equal(tutorialStep(s), "toBench");
  s = reducer(s, { type: "GO_WORKBENCH" });
  s = reducer(s, { type: "TUTORIAL_MARK", what: "order" });
  assert.equal(tutorialStep(s), "recipe");
  s = reducer(s, { type: "TUTORIAL_MARK", what: "recipe" });
  assert.equal(tutorialStep(s), "place");
  s = reducer(s, { type: "PLACE_INGREDIENT", orderId: o.id, taskIndex: 0 });
  assert.equal(tutorialStep(s), "measure");
  s = answerActive(s, "1.3");
  assert.equal(tutorialStep(s), "add");
  assert.equal(order(s).tasks[0].submitted, "1.3", "정답으로 바꿔치기하지 않음");
  s = reducer(s, { type: "ADD_TO_CAULDRON", orderId: o.id, taskIndex: 0 });
  assert.equal(tutorialStep(s), "stir");
  // 새로고침(저장·복구) 뒤에도 같은 단계
  assert.equal(tutorialStep(roundTrip(s)), "stir");
  for (let k = 0; k < 4; k++) s = reducer(s, { type: "STIR", orderId: o.id, amount: 25 });
  assert.equal(tutorialStep(s), "bottle");
  s = reducer(s, { type: "COMPLETE_POTION", orderId: o.id });
  assert.equal(tutorialStep(s), "toCounter");
  s = reducer(s, { type: "GO_COUNTER" });
  assert.equal(tutorialStep(s), "deliver");
  s = reducer(s, { type: "DELIVER", orderId: o.id, now: NOW });
  assert.equal(s.tutorial!.status, "done");
  assert.equal(s.money, 6, "판매금만 (10의 60%), 튜토리얼 보상 없음");
  assert.equal(tutorialStep(s), null);
  // 다음 손님부터는 일반 주문
  s = reducer(s, { type: "NEXT_CUSTOMER", fromOrderId: o.id });
  assert.equal(tutorialStep(s), null);
});

test("튜토리얼 건너뛰기: 주문 그대로, 안내만 끝 / 튜토리얼 없이 시작한 게임·이전 저장은 null", () => {
  let s = run(createInitialState(), { type: "START", seed: 12, tutorial: true });
  const before = roundTrip(s.day);
  s = reducer(s, { type: "TUTORIAL_SKIP" });
  assert.equal(s.tutorial!.status, "skipped");
  assert.deepEqual(s.day, before);
  assert.equal(s.money, 0);
  assert.equal(tutorialStep(s), null);
  assert.equal(run(createInitialState(), { type: "START", seed: 12 }).tutorial, null);
  // 이미 하루가 있으면 tutorial 표시는 무시
  const going = run(createInitialState(), { type: "START", seed: 12 });
  assert.equal(reducer(going, { type: "START", seed: 1, tutorial: true }).tutorial, null);
});

test("v6 저장(실제 직전 버전 코드로 만든 젓는 중) → v7: 진행·돈·구매·기록 그대로, 튜토리얼 강제 없음, 문제은행은 다음 영업부터", () => {
  const raw = readFileSync(new URL("./fixtures/v6-midstir.json", import.meta.url), "utf8");
  const v6 = JSON.parse(raw);
  assert.equal(v6.saveVersion, 6);
  const store = memoryStorage();
  store.setItem(SAVE_KEY, raw);
  const l = loadGame(1, store);
  assert.equal(l.kind, "ok", l.kind === "error" ? l.errors.join(",") : "");
  if (l.kind !== "ok") return;
  const s = l.state as GameState;
  assert.equal(l.migratedFrom, 6);
  assert.equal(store.mem.get("moonlight-potion-shop/backup-v6"), raw);
  assert.equal(s.saveVersion, 8);
  assert.equal(s.tutorial, null);
  for (const k of ["scene", "money", "day", "shop", "unlockedIngredients", "problemLog", "review", "paidOrderIds", "decks", "draftAnswer", "activeTask"]) {
    assert.deepEqual((s as unknown as Record<string, unknown>)[k], v6[k], k);
  }
  assert.ok(!s.day!.orders.some((o) => o.kind === "bank"), "오늘 주문은 그대로 (문제은행 없음)");
  // 오늘을 끝까지 → 다음 영업에 문제은행
  let t = s;
  for (;;) {
    t = serveCurrent(t);
    if (t.day!.currentIndex >= 4) break;
    t = reducer(t, { type: "NEXT_CUSTOMER", fromOrderId: order(t).id });
  }
  t = closeAndNext(t, 77);
  assert.ok(t.day!.orders.some((o) => o.kind === "bank"), "다음 영업부터 문제은행");
});

test("복습: 문제은행 오답도 기존 정책대로 복습 후보가 된다", () => {
  let s = run({ ...createInitialState(), unlockedIngredients: ALL }, { type: "START", seed: 21 });
  s = closeAndNext(playFullDay(s), 22);
  // 문제은행 과제를 틀리기
  let idx = s.day!.orders.findIndex((o) => o.kind === "bank");
  while (s.day!.currentIndex < idx) {
    s = serveCurrent(s);
    s = reducer(s, { type: "NEXT_CUSTOMER", fromOrderId: order(s).id });
  }
  if (!s.day!.introSeen) s = reducer(s, { type: "ACK_INTRO", dayNumber: s.day!.dayNumber });
  s = reducer(s, { type: "ACCEPT_ORDER", orderId: order(s).id });
  const bi = order(s).tasks.findIndex((t) => t.problem.bankId);
  s = reducer(s, { type: "PLACE_INGREDIENT", orderId: order(s).id, taskIndex: bi });
  s = answerActive(s, wrongAnswer(order(s).tasks[bi]));
  assert.ok(s.review.some((c) => c.sourceProblemId === order(s).tasks[bi].problemId));
});
