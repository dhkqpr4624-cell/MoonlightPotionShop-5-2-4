// Phase 1 핵심 규칙 (Phase 2 상태 구조에 맞게 갱신)
import { test } from "node:test";
import assert from "node:assert/strict";
import { reducer } from "../src/game/reducer.ts";
import { diagnoseWrong, hintFeedback, sizeRange } from "../src/game/feedback.ts";
import { multiBottleKeys, uncoveredTypes, PHASE1_SETTINGS } from "../src/game/orderFactory.ts";
import { drawFromDeck, EMPTY_DECK } from "../src/lib/deck.ts";
import { createRng } from "../src/lib/rng.ts";
import { validateState } from "../src/game/save.ts";
import type { Problem } from "../src/game/types.ts";
import { NOW, order, roundTrip, run, startBrewing, submit, type } from "./helpers.ts";

const P = (a: string, b: string, answer: string, bMeaning: Problem["bMeaning"] = "bottles"): Problem => ({
  a, b, answer, bMeaning, unit: "mL", learningType: "d1xN",
});

test("주문 생성: 별빛 포션 여러 병, 레시피 기본량 고정", () => {
  const s = startBrewing();
  const o = order(s);
  assert.equal(o.recipeId, "starlight");
  assert.equal(o.customerId, "fox");
  assert.ok(o.bottles >= 2 && o.bottles <= 9);
  assert.deepEqual(o.tasks.map((t) => t.problem.a), ["0.6", "0.25"]);
  assert.ok(o.tasks.every((t) => t.problem.b === String(o.bottles)));
  assert.deepEqual(o.tasks.map((t) => t.problem.learningType), ["d1xN", "d2xN"]);
  assert.equal(s.scene, "workbench");
  assert.equal(o.status, "brewing");
});

test("정답(동치 소수 포함)만 재료가 투입된다", () => {
  let s = startBrewing();
  const [dew, dust] = order(s).tasks;
  s = submit(s, dew.problem.answer + "0");
  assert.equal(order(s).tasks[0].status, "done");
  assert.equal(s.feedback?.kind, "correct");
  assert.equal(s.pour?.ingredientId, "moonDew");
  assert.equal(s.selectedTask, 1, "다음 재료로 자동 이동");
  s = submit(s, dust.problem.answer);
  assert.equal(order(s).tasks[1].status, "done");
  assert.equal(s.records.length, 2);
  assert.equal(s.records[0].firstCorrect, true);
  assert.equal(s.records[0].problemId, `${order(s).id}:moonDew`);
  assert.equal(s.records[0].dayNumber, 1);
  assert.equal(s.records[0].customerNumber, 1);
});

test("오답 후 수정: 투입되지 않고, 최초 답·시도 횟수 기록", () => {
  let s = startBrewing();
  const task = order(s).tasks[0];
  s = submit(s, "99");
  assert.equal(order(s).tasks[0].status, "pending");
  assert.equal(s.feedback?.kind, "wrong");
  assert.equal(s.pour, null);
  assert.equal(s.draftAnswer, "99");
  assert.equal(s.money, 0);
  s = run(s, { type: "REQUEST_HINT" }, { type: "REQUEST_HINT" });
  assert.equal(order(s).tasks[0].hintLevel, 2);
  s = submit(s, task.problem.answer);
  const t = order(s).tasks[0];
  assert.deepEqual([t.status, t.attempts, t.firstAnswer, t.firstCorrect], ["done", 2, "99", false]);
  const rec = s.records[0];
  assert.deepEqual(
    [rec.firstAnswer, rec.firstCorrect, rec.attempts, rec.hintLevel, rec.solved, rec.learningType, rec.a, rec.answer],
    ["99", false, 2, 2, true, "d1xN", "0.6", task.problem.answer],
  );
});

test("형식 오류는 시도 횟수에 넣지 않는다", () => {
  let s = startBrewing();
  s = reducer(s, { type: "SUBMIT_ANSWER", now: NOW });
  assert.equal(s.feedback?.kind, "format");
  s = submit(s, "01.8");
  assert.equal(s.feedback?.kind, "format");
  assert.equal(order(s).tasks[0].attempts, 0);
  assert.equal(order(s).tasks[0].firstAnswer, null);
});

test("모든 재료 준비 전에는 완성·전달 불가", () => {
  let s = startBrewing();
  s = reducer(s, { type: "COMPLETE_POTION" });
  assert.equal(order(s).status, "brewing");
  s = submit(s, order(s).tasks[0].problem.answer);
  s = reducer(s, { type: "COMPLETE_POTION" });
  assert.equal(order(s).status, "brewing");
  s = reducer(s, { type: "DELIVER", orderId: order(s).id });
  assert.equal(s.money, 0);
  s = submit(s, order(s).tasks[1].problem.answer);
  s = reducer(s, { type: "COMPLETE_POTION" });
  assert.equal(order(s).status, "bottled");
});

test("주문 중 이어하기: 완료한 재료와 현재 입력 복구", () => {
  let s = startBrewing();
  s = submit(s, order(s).tasks[0].problem.answer);
  s = type(s, "0.7");
  const saved = roundTrip(s);
  assert.ok(validateState(saved).ok);
  const restored = run(saved, { type: "GO_TITLE" }, { type: "START", seed: 9 });
  assert.equal(restored.scene, "workbench");
  assert.equal(order(restored).tasks[0].status, "done");
  assert.equal(restored.selectedTask, 1);
  assert.equal(restored.draftAnswer, "0.7");
  assert.equal(order(restored).id, order(s).id);
});

test("덱: 소진 후 섞어서 재사용", () => {
  const rng = createRng(1);
  let deck = EMPTY_DECK;
  const keys = ["a", "b", "c"];
  const drawn: string[] = [];
  for (let i = 0; i < 9; i++) {
    const r = drawFromDeck(deck, keys, rng);
    drawn.push(r.key);
    deck = r.deck;
  }
  for (let i = 0; i < 9; i += 3) assert.deepEqual(drawn.slice(i, i + 3).sort(), keys);
  for (let i = 1; i < 9; i++) assert.notEqual(drawn[i], drawn[i - 1]);
});

test("학습 범위 확인: 켜진 유형을 낼 레시피가 없으면 알려 준다", () => {
  assert.equal(multiBottleKeys(PHASE1_SETTINGS).length, 8);
  assert.deepEqual(uncoveredTypes(PHASE1_SETTINGS), []);
  assert.deepEqual(uncoveredTypes({ ...PHASE1_SETTINGS, enabledTypes: ["d1xN"] }), ["d1xN"]);
  assert.deepEqual(uncoveredTypes({ ...PHASE1_SETTINGS, enabledTypes: ["d1xN", "d2xN", "Nxd1"] }), ["Nxd1"]);
});

test("오답 진단: 원인이 분명할 때만 구체적으로", () => {
  const p = P("0.6", "3", "1.8");
  assert.equal(diagnoseWrong(p, "18"), "decimalPoint");
  assert.equal(diagnoseWrong(p, "0.18"), "decimalPoint");
  assert.equal(diagnoseWrong(p, "180"), "decimalPoint");
  assert.equal(diagnoseWrong(p, "3.6"), "added");
  assert.equal(diagnoseWrong(p, "0.5"), "tooSmall");
  assert.equal(diagnoseWrong(p, "5"), "tooBig");
  assert.equal(diagnoseWrong(p, "1.6"), "unknown");
  assert.throws(() => diagnoseWrong(p, "1.80"));
  const q = P("1.2", "0.4", "0.48", "multiplier");
  assert.equal(diagnoseWrong(q, "4.8"), "decimalPoint");
  assert.equal(diagnoseWrong(q, "1.5"), "tooBig");
  assert.equal(sizeRange(q).sentence, "기본량의 0.4배이므로 1.2mL보다 적어야 해요.");
  const r = P("0.25", "4", "1");
  assert.equal(diagnoseWrong(r, "10"), "decimalPoint");
  assert.equal(diagnoseWrong(r, "0.1"), "decimalPoint");
});

test("힌트 3단계", () => {
  const p = P("0.6", "3", "1.8");
  assert.match(hintFeedback(p, 1).lines.join(" "), /0\.6mL보다 많고/);
  const h2 = hintFeedback(p, 2).lines.join(" ");
  assert.match(h2, /6 × 3 = 18/);
  assert.doesNotMatch(h2, /1\.8/);
  const h3 = hintFeedback(p, 3);
  assert.match(h3.lines.join(" "), /0\.1이 6 × 3 = 18개/);
  assert.deepEqual(h3.visual, { kind: "unitBlocks", perGroup: 6, groups: 3, unitLabel: "0.1" });
  assert.match(hintFeedback(P("0.25", "3", "0.75"), 3).lines.join(" "), /0\.01이 25 × 3 = 75개/);
});
