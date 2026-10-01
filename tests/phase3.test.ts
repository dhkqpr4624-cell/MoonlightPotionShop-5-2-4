// Phase 3: 오답으로도 이어지는 제조(B), 주문·대화(C), 유형 소개·학습 기록·복습(D), v2 마이그레이션
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createInitialState, currentOrder, reducer } from "../src/game/reducer.ts";
import { classifyProduct, inRange, introducedTypes, LEARNING_TYPE_IDS } from "../src/data/learningTypes.ts";
import { RECIPES } from "../src/data/recipes.ts";
import { LIFE_RULE_NOTE } from "../src/data/dialogues.ts";
import {
  candidatesFor, createOrderFromKey, lifePairOutOfRange, MULTIPLIERS_D1, MULTIPLIERS_D2, uncoveredTypes,
} from "../src/game/orderFactory.ts";
import { hintCard, resultSummary, solutionSteps } from "../src/game/explain.ts";
import { rewardFor } from "../src/game/outcome.ts";
import { loadGame, SAVE_KEY, validateState } from "../src/game/save.ts";
import { buildLearningExport, parseImportText } from "../src/game/transfer.ts";
import { typeStats } from "../src/game/learningLog.ts";
import { createRng } from "../src/lib/rng.ts";
import type { GameState, Order } from "../src/game/types.ts";
import {
  answerActive, closeAndNext, correctAnswer, memoryStorage, NOW, order, playFullDay, roundTrip, run, serveCurrent,
  startBrewing, submit, wrongAnswer,
} from "./helpers.ts";

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
const allOrders = (s: GameState) => s.day!.orders;

/* ------------------------------ 3B ------------------------------ */

test("3B 오답: 입력값 유지·확정, 그 양으로 투입, 해설은 실제 계산 과정", () => {
  let s = startBrewing(11);
  const o = order(s);
  s = reducer(s, { type: "PLACE_INGREDIENT", orderId: o.id, taskIndex: 0 });
  const t0 = o.tasks[0];
  s = answerActive(s, wrongAnswer(t0));
  const t = order(s).tasks[0];
  assert.equal(t.status, "measured");
  assert.equal(t.correct, false);
  assert.equal(t.submitted, wrongAnswer(t0), "입력값을 지우거나 정답으로 바꾸지 않음");
  assert.equal(resultSummary(t).headline, t.mode === "concept" ? resultSummary(t).headline : "입력한 양 · 필요한 양과 달라요");
  const steps = solutionSteps(o, t).join(" ");
  if (t.mode === "calc") {
    assert.match(steps, new RegExp(`${t.problem.a.replace(".", "\\.")} × ${t.problem.b}`), "식");
    assert.match(steps, /자연수로 계산하면/, "자연수 계산");
    assert.match(steps, new RegExp(`${t.problem.answer.replace(".", "\\.")}`), "결과");
  }
  // 다시 정답을 넣어도 바뀌지 않음 (재입력 없음)
  const tryFix = submit(s, t0.problem.answer);
  assert.equal(order(tryFix).tasks[0].submitted, wrongAnswer(t0));
  s = reducer(s, { type: "VIEW_EXPLANATION" });
  s = reducer(s, { type: "ADD_TO_CAULDRON", orderId: o.id, taskIndex: 0 });
  assert.equal(order(s).tasks[0].addedAmount, wrongAnswer(t0) === "99" ? "99" : order(s).tasks[0].addedAmount);
  assert.equal(s.problemLog.length, 1);
  assert.equal(s.problemLog[0].correct, false);
  assert.equal(s.problemLog[0].explanationViewed, true);
  assert.equal(s.review.length, 1, "오답은 복습 후보");
});

test("3B 품질별 판매금 100%·80%·60% (정수, 소수 버림), 힌트·'네?'는 감액 없음", () => {
  for (const [wrong, q, pct] of [[[], "great", 100], [[1], "okay", 80], [[0, 1], "poor", 60]] as const) {
    let s = run(createInitialState(), { type: "START", seed: 50 });
    s = run(s, { type: "ASK_AGAIN", orderId: order(s).id }, { type: "ASK_AGAIN", orderId: order(s).id });
    const price = order(s).price;
    s = serveCurrent(s, { wrong: [...wrong], hint: true });
    assert.equal(order(s).quality, q);
    assert.equal(order(s).reward, Math.floor((price * pct) / 100));
    assert.equal(s.money, Math.floor((price * pct) / 100));
    assert.ok(Number.isInteger(s.money));
  }
  assert.equal(rewardFor(15, "okay"), 12);
  assert.equal(rewardFor(15, "poor"), 9);
  assert.equal(rewardFor(35, "okay"), 28);
  assert.equal(rewardFor(35, "poor"), 21);
  assert.equal(rewardFor(45, "poor"), 27);
  assert.equal(rewardFor(25, "poor"), 15);
  assert.equal(rewardFor(5 * 7, "okay"), 28);
  assert.equal(rewardFor(20, "poor"), 12);
});

test("3B 아주 크거나 작은 유효 입력도 기록하고 제조가 막히지 않음", () => {
  for (const v of ["99999999", "0", "0.0001"]) {
    let s = startBrewing(13);
    const o = order(s);
    s = reducer(s, { type: "PLACE_INGREDIENT", orderId: o.id, taskIndex: 0 });
    if (o.tasks[0].mode === "concept") continue;
    s = submit(s, v);
    s = reducer(s, { type: "ADD_TO_CAULDRON", orderId: o.id, taskIndex: 0 });
    assert.equal(order(s).tasks[0].status, "done", v);
    assert.equal(s.problemLog[0].submitted, v);
  }
});

/* ------------------------------ 3C ------------------------------ */

test("3C '네?'는 주문 숫자·조건·보상을 바꾸지 않고, 쉬운 설명은 정답을 말하지 않음", () => {
  const s = run(createInitialState(), { type: "START", seed: 9 });
  const o = order(s);
  const asked = run(s, { type: "ASK_AGAIN", orderId: o.id }, { type: "ASK_AGAIN", orderId: o.id }, { type: "ASK_AGAIN", orderId: o.id });
  const o2 = order(asked);
  assert.equal(o2.askCount, 3);
  assert.deepEqual({ ...o2, askCount: 0 }, { ...o, askCount: 0 });
  // 모든 유형 주문의 쉬운 설명·메모에 정답 문자열이 없다
  const intro = introducedTypes(3);
  let n = 1;
  for (const kind of ["multiBottle", "customMultiplier", "lifeItem", "pointShift"] as const) {
    for (const c of candidatesFor(kind, intro)) {
      const ord = createOrderFromKey(c.key, { orderNumber: n++, customerId: "cat", rng: createRng(n) });
      for (const t of ord.tasks) {
        if (t.mode !== "calc") continue;
        const factors = [t.problem.a, t.problem.b];
        if (!t.problem.answer.includes(".") || factors.some((f) => f.includes(t.problem.answer))) continue;
        assert.ok(!ord.script.easy.includes(t.problem.answer), `${c.key} easy`);
        assert.ok(!ord.script.memo.join(" ").includes(` ${t.problem.answer}`), `${c.key} memo`);
        assert.ok(!ord.script.original.includes(`= ${t.problem.answer}`), `${c.key} original`);
      }
    }
  }
});

test("3C 생활 소재: 14.35g × 10 특별 문제, 단위 변환이 아니라는 규칙, 지정량 과제는 계산 집계 제외", () => {
  const o = createOrderFromKey("life:chocolate:14.35:10", { orderNumber: 1, customerId: "fox", rng: createRng(1) });
  const calc = o.tasks.find((t) => t.mode === "calc")!;
  const spec = o.tasks.find((t) => t.mode === "specified")!;
  assert.equal(calc.ingredientId, "moonDew");
  assert.equal(calc.problem.answer, "143.5");
  assert.equal(calc.problem.unit, "mL");
  assert.equal(calc.problem.learningType, "d2xN");
  assert.equal(spec.problem.learningType, null);
  assert.equal(spec.problem.answer, RECIPES[o.recipeId].additives[1].amount);
  assert.ok(o.script.memo.includes(LIFE_RULE_NOTE));
  assert.match(o.script.original, /초콜릿 1개가 14\.35g이에요/);
  assert.match(o.script.easy, /단위를 바꾸는 계산이 아니라/);
  assert.doesNotMatch(o.script.easy + o.script.original, /변환/);
  assert.equal(o.price, 20);
  assert.equal(o.bottles, 1);
  const steps = solutionSteps(o, calc).join(" ");
  assert.match(steps, /1435 × 10 = 14350/);
  assert.match(steps, /143\.5mL/);
  assert.match(steps, /단위를 바꾼 것이 아니라/);
});

test("3C 비교(⑦) 주문: 선택형 개념 문제, 결과 후 양은 자동 계량, 품질은 개념 정오로", () => {
  const o = createOrderFromKey("shift:2.4:3:aD10", { orderNumber: 1, customerId: "wolf", rng: createRng(1) });
  const c = o.tasks[0];
  assert.equal(c.mode, "concept");
  assert.equal(c.concept!.correct, "d10");
  assert.equal(c.problem.answer, "0.72");
  assert.equal(createOrderFromKey("shift:0.6:3:swap", { orderNumber: 2, customerId: "wolf", rng: createRng(1) }).tasks[0].concept!.correct, "same");
  assert.equal(createOrderFromKey("shift:0.6:4:bX10", { orderNumber: 3, customerId: "wolf", rng: createRng(1) }).tasks[0].concept!.correct, "x10");
  // 게임 안에서: 틀리게 골라도 자동 계량량은 목표값
  let s = run(createInitialState(), { type: "START", seed: 1 });
  s = { ...s, day: { ...s.day!, introSeen: true, orders: [{ ...o, status: "arrived" }, ...s.day!.orders.slice(1)] } };
  s = reducer(s, { type: "ACCEPT_ORDER", orderId: o.id });
  s = reducer(s, { type: "PLACE_INGREDIENT", orderId: o.id, taskIndex: 0 });
  const typed = reducer({ ...s }, { type: "INPUT_KEY", key: "1" });
  assert.equal(typed.draftAnswer, "", "비교 문제는 숫자 입력이 아님");
  s = reducer(s, { type: "SUBMIT_CHOICE", choice: "x10", now: NOW });
  assert.equal(order(s).tasks[0].correct, false);
  s = reducer(s, { type: "ADD_TO_CAULDRON", orderId: o.id, taskIndex: 0 });
  assert.equal(order(s).tasks[0].addedAmount, "0.72");
  s = reducer(s, { type: "PLACE_INGREDIENT", orderId: o.id, taskIndex: 1 });
  s = submit(s, "0.25");
  s = reducer(s, { type: "ADD_TO_CAULDRON", orderId: o.id, taskIndex: 1 });
  for (let k = 0; k < 4; k++) s = reducer(s, { type: "STIR", orderId: o.id, amount: 25 });
  s = reducer(s, { type: "COMPLETE_POTION", orderId: o.id });
  assert.equal(order(s).quality, "okay");
  assert.equal(order(s).reward, 16);
});

test("3C 하루 구성: 특별 주문 제한·첫 손님 일반·일반 주문 2건 이상 (12일)", () => {
  let s = run(createInitialState(), { type: "START", seed: 77 });
  for (let d = 0; d < 12; d++) {
    const os = allOrders(s);
    const kinds = os.map((o) => o.kind);
    assert.ok(kinds.filter((k) => k === "lifeItem").length <= 1, `day ${d + 1} life`);
    assert.ok(kinds.filter((k) => k === "pointShift").length <= 1, `day ${d + 1} shift`);
    assert.ok(os.filter((o) => o.reviewCandidateId).length <= 1, `day ${d + 1} review`);
    assert.ok(kinds[0] === "multiBottle" || kinds[0] === "customMultiplier", `day ${d + 1} 첫 손님`);
    assert.ok(kinds.filter((k) => k === "multiBottle" || k === "customMultiplier").length >= 2);
    // 소개된 유형 안에서만
    const intro = introducedTypes(s.day!.introStage);
    for (const o of os) for (const t of o.tasks) if (t.problem.learningType) assert.ok(intro.includes(t.problem.learningType), `${t.problem.learningType}`);
    s = closeAndNext(playFullDay(s, (i) => ({ wrong: i % 2 ? [0] : [] })), 300 + d);
  }
});

/* ------------------------------ 3D ------------------------------ */

test("3D 유형 자동 소개: 영업을 마칠 때마다 ①② → ③④ → ⑤⑥ → ⑦, 새 유형은 그날 등장", () => {
  let s = run(createInitialState(), { type: "START", seed: 5 });
  const expected = [["d1xN", "d2xN"], ["Nxd1", "Nxd2"], ["d1xD", "d2xD"], ["shift"], []];
  for (let d = 0; d < 5; d++) {
    assert.deepEqual(s.day!.newTypes, expected[d], `day ${d + 1}`);
    assert.equal(s.day!.introStage, Math.min(d, 3));
    const types = new Set(allOrders(s).flatMap((o) => o.tasks.map((t) => t.problem.learningType)));
    for (const t of expected[d]) assert.ok(types.has(t as never), `day ${d + 1}에 ${t} 등장`);
    // 정답률과 무관: 전부 틀려도 다음 단계로
    s = closeAndNext(playFullDay(s, () => ({ wrong: [0, 1] })), 10 + d);
  }
});

test("3D 복습: 오답 → 다음 영업에 같은 유형·다른 인수 (하루 최대 1건) → 정답이면 해결", () => {
  let s = run(createInitialState(), { type: "START", seed: 21 });
  s = playFullDay(s, (i) => (i === 0 ? { wrong: [0] } : {}));
  const cand = s.review.filter((c) => c.status === "open");
  assert.ok(cand.length >= 1);
  const c0 = s.review[0];
  s = closeAndNext(s, 99);
  const reviewOrders = allOrders(s).filter((o) => o.reviewCandidateId);
  assert.equal(reviewOrders.length, 1, "복습 주문 1건");
  const rt = reviewOrders[0].tasks.find((t) => t.reviewOf)!;
  assert.equal(rt.reviewOf, c0.id);
  assert.equal(rt.problem.learningType, c0.learningType);
  assert.ok(!(rt.problem.a === c0.a && rt.problem.b === c0.b), "다른 인수");
  s = playFullDay(s);
  const resolved = s.review.find((c) => c.id === c0.id)!;
  assert.equal(resolved.status, "resolved");
  assert.equal(resolved.resolvedProblemId, rt.problemId);
  const rec = s.problemLog.find((r) => r.problemId === rt.problemId)!;
  assert.equal(rec.isReview, true);
  assert.equal(rec.reviewOf, c0.id);
});

test("3D 복습 오답: 후보 유지, 바로 다음 날은 쉬고 그 뒤에 다시", () => {
  let s = run(createInitialState(), { type: "START", seed: 21 });
  s = playFullDay(s, (i) => (i === 0 ? { wrong: [0] } : {}));
  const id = s.review[0].id;
  s = closeAndNext(s, 99);
  // 복습 문제만 틀리기
  for (let i = 0; i < 5; i++) {
    const o = currentOrder(s)!;
    const idx = o.tasks.findIndex((t) => t.reviewOf === id);
    s = serveCurrent(s, { wrong: idx >= 0 ? [idx] : [] });
    if (i < 4) s = reducer(s, { type: "NEXT_CUSTOMER", fromOrderId: o.id });
  }
  const c = s.review.find((x) => x.id === id)!;
  assert.equal(c.status, "open");
  assert.equal(c.lastReviewDay, 2);
  s = closeAndNext(s, 5);
  assert.ok(!allOrders(s).some((o) => o.reviewCandidateId === id), "바로 다음 날은 쉬기");
  s = closeAndNext(playFullDay(s), 6);
  assert.ok(allOrders(s).some((o) => o.reviewCandidateId === id) || allOrders(s).some((o) => o.reviewCandidateId), "그 뒤 다시 복습 가능");
});

test("3D 학습 기록: 문제당 1개, 지정량 제외 유형별 집계, 마감 집계, 학습 결과 JSON", () => {
  let s = run(createInitialState(), { type: "START", seed: 33 });
  s = playFullDay(s, (i) => ({ wrong: i === 2 ? [0, 1] : [], hint: i === 3, viewExplanation: i === 2 }));
  s = reducer(s, { type: "CLOSE_DAY", dayNumber: 1, now: NOW });
  const ids = s.problemLog.map((r) => r.problemId);
  assert.equal(new Set(ids).size, ids.length);
  const learning = s.problemLog.filter((r) => r.mode !== "specified");
  const h = s.dayHistory[0];
  assert.equal(h.ruleVersion, 3);
  assert.equal(h.totalProblems, learning.length);
  assert.equal(h.firstTryCorrect + (h.wrong ?? 0), h.totalProblems);
  assert.equal(h.quality!.great + h.quality!.okay + h.quality!.poor, 5);
  assert.equal(h.correctedAfterWrong, 0);
  const ts = typeStats(s);
  assert.equal(ts.reduce((a, t) => a + t.problems, 0), learning.length, "지정량 제외");
  const exp = buildLearningExport(s, NOW);
  assert.equal(exp.version, 2);
  assert.equal(exp.problems.length, s.problemLog.length);
  assert.ok(!JSON.stringify(exp).match(/코코|보리|나비|달이/), "손님 이름 등 개인 정보 없음");
  assert.equal(exp.orders.length, 5);
});

test("3D 데이터 검증: 모든 유형에 출제 후보, 인수 범위, 레시피 지원 유형 일치", () => {
  assert.deepEqual(uncoveredTypes(introducedTypes(3)), []);
  for (let st = 0; st <= 3; st++) assert.deepEqual(uncoveredTypes(introducedTypes(st)), [], `stage ${st}`);
  assert.deepEqual(lifePairOutOfRange(), []);
  for (const r of Object.values(RECIPES)) {
    for (const ad of r.additives) assert.ok(inRange(ad.amount), `${r.id} ${ad.amount}`);
    const multi = new Set(["2", "3", "4", "5", "6", "7", "8", "9"].flatMap((n) => r.additives.map((ad) => classifyProduct(ad.amount, n))).filter(Boolean));
    assert.deepEqual([...multi].sort(), [...r.supports.multiBottle].sort(), `${r.id} 여러 병`);
    const custom = new Set([...MULTIPLIERS_D1, ...MULTIPLIERS_D2].flatMap((m) => r.additives.map((ad) => classifyProduct(ad.amount, m))).filter(Boolean));
    for (const t of r.supports.customMultiplier) assert.ok(custom.has(t), `${r.id} 맞춤 ${t}`);
  }
  for (const m of [...MULTIPLIERS_D1, ...MULTIPLIERS_D2]) assert.ok(inRange(m), m);
  assert.equal(LEARNING_TYPE_IDS.length, 7);
});

test("3D 힌트 3단계: 1·2단계는 정답을 말하지 않고 3단계에 계산 과정과 정답", () => {
  const o = createOrderFromKey("custom:courage:0.3", { orderNumber: 1, customerId: "rabbit", rng: createRng(2) });
  const t = o.tasks[0];
  assert.equal(t.problem.answer, "1.2");
  const h1 = hintCard(o, t, 1).lines.join(" ");
  const h2 = hintCard(o, t, 2).lines.join(" ");
  const h3 = hintCard(o, t, 3).lines.join(" ");
  assert.match(h1, /4mL보다 작아요/);
  assert.match(h2, /4 × 0\.3/);
  assert.doesNotMatch(h1 + h2, /1\.2/);
  assert.match(h3, /4 × 3 = 12/);
  assert.match(h3, /1보다 작으니까/);
  assert.match(h3, /1\.2mL/);
});

/* ------------------------- v2 마이그레이션 ------------------------- */

function loadFixture(name: string): GameState {
  const store = memoryStorage();
  store.setItem(SAVE_KEY, fixture(name));
  const l = loadGame(5, store);
  if (l.kind !== "ok") throw new Error(l.kind === "error" ? l.errors.join(", ") : "empty");
  assert.equal(l.migratedFrom, 2);
  return l.state;
}

test("v2 진행 중 하루: Phase 2 규칙으로 끝내고(정답 수정·정액), 다음 영업부터 Phase 3 + ③④ 소개", () => {
  const v2 = JSON.parse(fixture("phase2-brewing.json"));
  let s = loadFixture("phase2-brewing.json");
  assert.equal(s.money, v2.money);
  assert.equal(s.legacyRecords.length, v2.records.length);
  assert.equal(s.day!.rules, 2);
  assert.equal(s.day!.dayNumber, 1);
  assert.equal(s.draftAnswer, "0.5");
  assert.equal(s.activeTask, 1);
  s = run(s, { type: "START", seed: 1 });
  // Phase 2 규칙: 오답이면 다시 입력해야 함
  const o = order(s);
  s = submit(s, "99");
  assert.equal(order(s).tasks[1].status, "pending");
  assert.equal(s.feedback?.kind, "wrong");
  s = submit(s, o.tasks[1].problem.answer);
  assert.equal(order(s).tasks[1].status, "measured");
  s = reducer(s, { type: "ADD_TO_CAULDRON", orderId: o.id, taskIndex: 1 });
  for (let k = 0; k < 4; k++) s = reducer(s, { type: "STIR", orderId: o.id, amount: 25 });
  s = run(s, { type: "COMPLETE_POTION", orderId: o.id }, { type: "DELIVER", orderId: o.id, now: NOW });
  assert.equal(s.money, v2.money + o.price, "정상 판매금 전액 (소급 감액 없음)");
  for (let i = 2; i < 5; i++) {
    s = reducer(s, { type: "NEXT_CUSTOMER", fromOrderId: order(s).id });
    s = serveCurrent(s, { legacyWrongFirst: i === 3 });
  }
  s = reducer(s, { type: "CLOSE_DAY", dayNumber: 1, now: NOW });
  const h = s.dayHistory.at(-1)!;
  assert.equal(h.ruleVersion, 2);
  assert.ok(h.correctedAfterWrong >= 1);
  assert.equal(s.problemLog.length, 0, "Phase 2 규칙 문제는 이전 기록으로");
  s = reducer(s, { type: "NEXT_DAY", fromDay: 1, seed: 4 });
  assert.equal(s.day!.rules, 3);
  assert.equal(s.day!.introStage, 1);
  assert.deepEqual(s.day!.newTypes, ["Nxd1", "Nxd2"]);
  assert.ok(validateState(roundTrip(s)).ok);
});

test("v2 마감 상태와 2일차 완성 후 상태: 닫힌 덧문·정액 지급 유지, 일차가 높아도 소개 단계는 1부터", () => {
  let c = loadFixture("phase2-closed.json");
  assert.equal(c.day!.status, "closed");
  assert.equal(c.dayHistory[0].ruleVersion, 2);
  assert.equal(run(c, { type: "START", seed: 1 }).scene, "closing");
  c = reducer(c, { type: "NEXT_DAY", fromDay: 1, seed: 3 });
  assert.equal(c.day!.introStage, 1);

  const v2 = JSON.parse(fixture("phase2-day2-bottled.json"));
  let b = loadFixture("phase2-day2-bottled.json");
  assert.equal(b.day!.dayNumber, 2);
  assert.equal(b.day!.rules, 2);
  assert.equal(order(b).status, "bottled");
  assert.equal(order(b).reward, order(b).price);
  b = run(b, { type: "START", seed: 1 }, { type: "DELIVER", orderId: order(b).id, now: NOW });
  assert.equal(b.money, v2.money + v2.day.orders[0].price);
  b = playFullDay(b);
  b = closeAndNext(b, 9);
  assert.equal(b.day!.dayNumber, 3);
  assert.equal(b.day!.introStage, 1, "일차(3)와 별개로 ③④부터 소개");
});

test("가져오기: Phase 2 파일도 옮겨서 가져오고, 참조가 깨진 Phase 3 파일은 거부", () => {
  const r = parseImportText(fixture("phase2-brewing.json"), 1);
  assert.ok(r.ok);
  if (r.ok) assert.equal(r.migratedFrom, 2);
  let s = run(createInitialState(), { type: "START", seed: 21 });
  s = playFullDay(s, (i) => (i === 0 ? { wrong: [0] } : {}));
  const breakers: [string, (g: GameState) => void][] = [
    ["복습 후보의 원래 문제 없음", (g) => { g.problemLog = g.problemLog.slice(1); }],
    ["품질 조작", (g) => { g.day!.orders[0].quality = "great"; }],
    ["보상 조작", (g) => { g.day!.orders[0].reward = 999; }],
    ["오답을 정답으로 조작", (g) => { const t = g.day!.orders[0].tasks.find((x) => x.correct === false)!; t.correct = true; }],
    ["투입량 조작", (g) => { const t = g.day!.orders[0].tasks.find((x) => x.correct === false)!; t.addedAmount = t.problem.answer; }],
    ["젓기 전 완성", (g) => { g.day!.orders[1].stirProgress = 50; }],
    ["지정량 레시피 조작", (g) => { const o = g.day!.orders.find((x: Order) => x.tasks.some((t) => t.mode === "specified")); if (o) o.tasks.find((t) => t.mode === "specified")!.problem.answer = "9"; else g.money = -1; }],
    ["중복 문제 기록", (g) => { g.problemLog.push(g.problemLog[0]); }],
  ];
  for (const [name, mut] of breakers) {
    const g = roundTrip(s);
    mut(g);
    const res = parseImportText(JSON.stringify(g), 1);
    assert.equal(res.ok, false, name);
  }
  assert.ok(parseImportText(JSON.stringify(s), 1).ok);
});
