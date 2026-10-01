// 제조 핵심 규칙 (3A: 직접 조작하는 제조) + 기존 진단·덱 기능
import { test } from "node:test";
import assert from "node:assert/strict";
import { createInitialState, reducer } from "../src/game/reducer.ts";
import { diagnoseWrong } from "../src/game/feedback.ts";
import { drawFromDeck, EMPTY_DECK } from "../src/lib/deck.ts";
import { createRng } from "../src/lib/rng.ts";
import { validateState } from "../src/game/save.ts";
import { STIR_TARGET, type Problem } from "../src/game/types.ts";
import { answerActive, correctAnswer, NOW, order, roundTrip, run, startBrewing, submit, type } from "./helpers.ts";

const P = (a: string, b: string, answer: string, bMeaning: Problem["bMeaning"] = "bottles"): Problem => ({
  a, b, answer, bMeaning, unit: "mL", learningType: "d1xN",
});

test("첫 영업: ①② 유형 소개 → 확인 전에는 주문을 받을 수 없다", () => {
  let s = run(createInitialState(), { type: "START", seed: 3 });
  assert.deepEqual(s.day!.newTypes, ["d1xN", "d2xN"]);
  assert.equal(s.day!.introSeen, false);
  const blocked = reducer(s, { type: "ACCEPT_ORDER", orderId: order(s).id });
  assert.equal(order(blocked).status, "arrived");
  s = run(s, { type: "ACK_INTRO", dayNumber: 1 }, { type: "ACCEPT_ORDER", orderId: order(s).id });
  assert.equal(order(s).status, "brewing");
  assert.equal(s.scene, "workbench");
  assert.equal(s.activeTask, null, "제조대에 가도 계량 패널은 닫혀 있음");
});

test("솥에 놓기 = 계량 문제 열기 (아직 투입 아님), 하나만 열림", () => {
  let s = startBrewing();
  const id = order(s).id;
  s = reducer(s, { type: "PLACE_INGREDIENT", orderId: id, taskIndex: 0 });
  assert.equal(s.activeTask, 0);
  assert.equal(order(s).tasks[0].status, "pending", "놓기만 해서는 투입되지 않음");
  const again = reducer(s, { type: "PLACE_INGREDIENT", orderId: id, taskIndex: 1 });
  assert.equal(again.activeTask, 0, "패널이 열린 동안 다른 재료로 바뀌지 않음");
  s = reducer(s, { type: "CANCEL_MEASURE", orderId: id });
  assert.equal(s.activeTask, null, "답을 내기 전에는 꺼낼 수 있음");
  s = reducer(s, { type: "PLACE_INGREDIENT", orderId: "order-999", taskIndex: 1 });
  assert.equal(s.activeTask, null, "다른 주문 ID는 무시");
});

test("유효한 답 1회로 확정 → 투입, 완료한 재료는 다시 놓을 수 없음", () => {
  let s = startBrewing();
  const o = order(s);
  s = reducer(s, { type: "PLACE_INGREDIENT", orderId: o.id, taskIndex: 0 });
  s = answerActive(s, correctAnswer(o.tasks[0]));
  assert.equal(order(s).tasks[0].status, "measured");
  assert.equal(order(s).tasks[0].correct, true);
  // 확정 후 다시 입력·제출해도 바뀌지 않음
  const resub = submit(s, "1");
  assert.equal(order(resub).tasks[0].submitted, order(s).tasks[0].submitted);
  s = reducer(s, { type: "ADD_TO_CAULDRON", orderId: o.id, taskIndex: 0 });
  assert.equal(order(s).tasks[0].status, "done");
  assert.equal(s.activeTask, null);
  assert.equal(s.pour?.ingredientId, o.tasks[0].ingredientId);
  const dup = run(s, { type: "PLACE_INGREDIENT", orderId: o.id, taskIndex: 0 }, { type: "ADD_TO_CAULDRON", orderId: o.id, taskIndex: 0 });
  assert.equal(dup.activeTask, null, "완료한 재료는 다시 놓을 수 없음");
  assert.equal(dup.pour?.seq, s.pour?.seq, "중복 투입 없음");
});

test("형식 오류는 확정하지 않고 오답으로 세지 않음", () => {
  let s = startBrewing();
  s = reducer(s, { type: "PLACE_INGREDIENT", orderId: order(s).id, taskIndex: 0 });
  s = reducer(s, { type: "SUBMIT_ANSWER", now: NOW });
  assert.equal(s.feedback?.kind, "format");
  for (const bad of ["01.8", "1.", ".5"]) {
    s = reducer(type(s, ""), { type: "INPUT_KEY", key: "clear" });
    s = { ...s, draftAnswer: bad };
    s = reducer(s, { type: "SUBMIT_ANSWER", now: NOW });
    assert.equal(s.feedback?.kind, "format", bad);
  }
  assert.equal(order(s).tasks[0].status, "pending");
  assert.equal(order(s).tasks[0].submitted, null);
  assert.equal(s.problemLog.length, 0);
});

test("젓기: 모든 재료 투입 전 차단, 누적 후 완료, 완료 후 더 늘지 않음, 젓기 전 병에 담기 차단", () => {
  let s = startBrewing();
  const o = order(s);
  s = reducer(s, { type: "STIR", orderId: o.id, amount: 25 });
  assert.equal(order(s).stirProgress, 0, "재료 넣기 전 젓기 불가");
  s = reducer(s, { type: "COMPLETE_POTION", orderId: o.id });
  assert.equal(order(s).status, "brewing");
  for (let i = 0; i < 2; i++) {
    s = reducer(s, { type: "PLACE_INGREDIENT", orderId: o.id, taskIndex: i });
    s = answerActive(s, correctAnswer(o.tasks[i]));
    if (i === 0) {
      const early = reducer(s, { type: "STIR", orderId: o.id, amount: 25 });
      assert.equal(order(early).stirProgress, 0, "한 재료만 넣고는 젓기 불가");
    }
    s = reducer(s, { type: "ADD_TO_CAULDRON", orderId: o.id, taskIndex: i });
  }
  s = reducer(s, { type: "COMPLETE_POTION", orderId: o.id });
  assert.equal(order(s).status, "brewing", "젓기 전 완성 불가");
  // 드래그 젓기(작은 양 여러 번)와 버튼 젓기(25씩)가 같은 결과
  let drag = s;
  for (let k = 0; k < 20; k++) drag = reducer(drag, { type: "STIR", orderId: o.id, amount: 5 });
  let btn = s;
  for (let k = 0; k < 4; k++) btn = reducer(btn, { type: "STIR", orderId: o.id, amount: 25 });
  assert.equal(order(drag).stirProgress, STIR_TARGET);
  assert.equal(order(btn).stirProgress, STIR_TARGET);
  const over = reducer(btn, { type: "STIR", orderId: o.id, amount: 25 });
  assert.equal(over, btn, "완료 후 반복 조작은 무시");
  const huge = reducer(s, { type: "STIR", orderId: o.id, amount: 1000 });
  assert.equal(order(huge).stirProgress, 25, "한 번에 너무 많이 올라가지 않음");
  s = reducer(btn, { type: "COMPLETE_POTION", orderId: o.id });
  assert.equal(order(s).status, "bottled");
  assert.equal(order(s).quality, "great");
  assert.equal(order(s).reward, order(s).price);
});

test("모든 제조 단계에서 저장 → 검증 통과 → 같은 상태 복구", () => {
  let s = startBrewing(8);
  const o = order(s);
  const snaps = [s];
  s = reducer(s, { type: "PLACE_INGREDIENT", orderId: o.id, taskIndex: 1 });
  s = type(s, "0.");
  snaps.push(s);
  s = answerActive(s, "77");
  snaps.push(s);
  s = reducer(s, { type: "ADD_TO_CAULDRON", orderId: o.id, taskIndex: 1 });
  snaps.push(s);
  s = reducer(s, { type: "PLACE_INGREDIENT", orderId: o.id, taskIndex: 0 });
  s = answerActive(s, correctAnswer(o.tasks[0]));
  s = reducer(s, { type: "ADD_TO_CAULDRON", orderId: o.id, taskIndex: 0 });
  s = reducer(s, { type: "STIR", orderId: o.id, amount: 20 });
  snaps.push(s);
  for (const st of snaps) {
    const r = validateState(roundTrip(st));
    assert.ok(r.ok, r.ok ? "" : r.errors.join(", "));
    if (r.ok) assert.deepEqual(r.state, st);
  }
});

test("오답 진단: 원인이 분명할 때만", () => {
  const p = P("0.6", "3", "1.8");
  assert.equal(diagnoseWrong(p, "18"), "decimalPoint");
  assert.equal(diagnoseWrong(p, "3.6"), "added");
  assert.equal(diagnoseWrong(p, "1.6"), "unknown");
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
