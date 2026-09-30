import { test } from "node:test";
import assert from "node:assert/strict";
import { createInitialState, reducer, type Action } from "../src/game/reducer.ts";
import { diagnoseWrong, hintFeedback, sizeRange } from "../src/game/feedback.ts";
import { multiBottleKeys, uncoveredTypes, PHASE1_SETTINGS } from "../src/game/orderFactory.ts";
import { drawFromDeck, EMPTY_DECK } from "../src/lib/deck.ts";
import { createRng } from "../src/lib/rng.ts";
import { isValidSave, loadGame, saveGame } from "../src/game/save.ts";
import type { GameState, Problem } from "../src/game/types.ts";
import type { InputKey } from "../src/lib/answerInput.ts";

const NOW = "2026-09-30T00:00:00.000Z";

function run(state: GameState, ...actions: Action[]): GameState {
  return actions.reduce(reducer, state);
}

function type(state: GameState, text: string): GameState {
  let s = run(state, { type: "INPUT_KEY", key: "clear" });
  for (const ch of text) s = reducer(s, { type: "INPUT_KEY", key: ch as InputKey });
  return s;
}

function submit(state: GameState, text: string): GameState {
  return reducer(type(state, text), { type: "SUBMIT_ANSWER", now: NOW });
}

function startBrewing(seed = 42): GameState {
  return run(createInitialState(), { type: "START", seed }, { type: "ACCEPT_ORDER" });
}

const P = (a: string, b: string, answer: string, bMeaning: Problem["bMeaning"] = "bottles"): Problem => ({
  a, b, answer, bMeaning, unit: "mL", learningType: "d1xN",
});

test("주문 생성: 별빛 포션 여러 병, 레시피 기본량 고정", () => {
  const s = startBrewing();
  const order = s.order!;
  assert.equal(order.recipeId, "starlight");
  assert.equal(order.customerId, "fox");
  assert.ok(order.bottles >= 2 && order.bottles <= 9);
  assert.deepEqual(order.tasks.map((t) => t.problem.a), ["0.6", "0.25"]);
  assert.ok(order.tasks.every((t) => t.problem.b === String(order.bottles)));
  assert.deepEqual(order.tasks.map((t) => t.problem.learningType), ["d1xN", "d2xN"]);
  assert.equal(s.scene, "workbench");
  assert.equal(order.status, "brewing");
});

test("정답(동치 소수 포함)만 재료가 투입된다", () => {
  let s = startBrewing();
  const [dew, dust] = s.order!.tasks;
  s = submit(s, dew.problem.answer + "0"); // 1.8 → 1.80 도 정답
  assert.equal(s.order!.tasks[0].status, "done");
  assert.equal(s.feedback?.kind, "correct");
  assert.equal(s.pour?.ingredientId, "moonDew");
  assert.equal(s.selectedTask, 1, "다음 재료로 자동 이동");
  s = submit(s, dust.problem.answer);
  assert.equal(s.order!.tasks[1].status, "done");
  assert.equal(s.records.length, 2);
  assert.equal(s.records[0].firstCorrect, true);
});

test("오답 후 수정: 투입되지 않고, 최초 답·시도 횟수 기록", () => {
  let s = startBrewing();
  const task = s.order!.tasks[0];
  const moneyBefore = s.money;
  s = submit(s, "99");
  assert.equal(s.order!.tasks[0].status, "pending");
  assert.equal(s.feedback?.kind, "wrong");
  assert.equal(s.pour, null, "오답은 투입 연출 없음");
  assert.equal(s.draftAnswer, "99", "입력을 남겨 두어 고칠 수 있다");
  assert.equal(s.money, moneyBefore, "오답으로 돈을 잃지 않는다");
  s = run(s, { type: "REQUEST_HINT" }, { type: "REQUEST_HINT" });
  assert.equal(s.order!.tasks[0].hintLevel, 2);
  s = submit(s, task.problem.answer);
  const t = s.order!.tasks[0];
  assert.equal(t.status, "done");
  assert.equal(t.attempts, 2);
  assert.equal(t.firstAnswer, "99");
  assert.equal(t.firstCorrect, false);
  const rec = s.records[0];
  assert.deepEqual(
    [rec.firstAnswer, rec.firstCorrect, rec.attempts, rec.hintLevel, rec.solved, rec.learningType, rec.a, rec.answer],
    ["99", false, 2, 2, true, "d1xN", "0.6", task.problem.answer],
  );
});

test("형식 오류는 시도 횟수에 넣지 않는다", () => {
  let s = startBrewing();
  s = reducer(s, { type: "SUBMIT_ANSWER", now: NOW }); // 빈 입력
  assert.equal(s.feedback?.kind, "format");
  s = submit(s, "01.8");
  assert.equal(s.feedback?.kind, "format");
  assert.equal(s.order!.tasks[0].attempts, 0);
  assert.equal(s.order!.tasks[0].firstAnswer, null);
});

test("모든 재료 준비 전에는 완성 불가", () => {
  let s = startBrewing();
  s = reducer(s, { type: "COMPLETE_POTION" });
  assert.equal(s.order!.status, "brewing");
  s = submit(s, s.order!.tasks[0].problem.answer);
  s = reducer(s, { type: "COMPLETE_POTION" });
  assert.equal(s.order!.status, "brewing", "재료 1개만으로는 완성 불가");
  // 완성 전에는 전달(판매)도 불가
  s = reducer(s, { type: "DELIVER" });
  assert.equal(s.money, 0);
  s = submit(s, s.order!.tasks[1].problem.answer);
  s = reducer(s, { type: "COMPLETE_POTION" });
  assert.equal(s.order!.status, "bottled");
});

test("판매금은 한 번만 지급 (중복 클릭·새로고침 후 재시도)", () => {
  let s = startBrewing();
  s = submit(s, s.order!.tasks[0].problem.answer);
  s = submit(s, s.order!.tasks[1].problem.answer);
  s = run(s, { type: "COMPLETE_POTION" }, { type: "GO_COUNTER" });
  const price = s.order!.price;
  assert.equal(price, 5 * s.order!.bottles);
  s = run(s, { type: "DELIVER" }, { type: "DELIVER" }, { type: "DELIVER" });
  assert.equal(s.money, price);
  assert.equal(s.stats.ordersCompleted, 1);

  // 저장 → 새로고침(불러오기) → 다시 전달 시도
  const mem = new Map<string, string>();
  const storage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
  };
  assert.ok(saveGame(s, storage));
  let reloaded = loadGame(storage)!;
  reloaded = run(reloaded, { type: "START", seed: 7 }, { type: "DELIVER" });
  assert.equal(reloaded.money, price, "새로고침 후에도 추가 지급 없음");
});

test("새로고침 전 상태(bottled)에서 저장 → 불러오기 → 전달은 1회 지급", () => {
  let s = startBrewing();
  s = submit(s, s.order!.tasks[0].problem.answer);
  s = submit(s, s.order!.tasks[1].problem.answer);
  s = reducer(s, { type: "COMPLETE_POTION" });
  const json = JSON.parse(JSON.stringify(s));
  assert.ok(isValidSave(json));
  let r = run(json as GameState, { type: "START", seed: 1 }, { type: "DELIVER" }, { type: "DELIVER" });
  assert.equal(r.money, s.order!.price);
});

test("주문 중 이어하기: 완료한 재료와 현재 입력 복구", () => {
  let s = startBrewing();
  s = submit(s, s.order!.tasks[0].problem.answer);
  s = type(s, "0.7");
  const restored = run(JSON.parse(JSON.stringify(s)) as GameState, { type: "GO_TITLE" }, { type: "START", seed: 9 });
  assert.equal(restored.scene, "workbench");
  assert.equal(restored.order!.tasks[0].status, "done");
  assert.equal(restored.selectedTask, 1);
  assert.equal(restored.draftAnswer, "0.7");
  assert.equal(restored.order!.id, s.order!.id, "새 주문으로 바뀌지 않음");
});

test("다음 손님: 판매 후에만 가능, 최근 주문과 다른 병 수", () => {
  let s = startBrewing(3);
  const blocked = reducer(s, { type: "NEXT_CUSTOMER", seed: 5 });
  assert.equal(blocked.order!.id, s.order!.id, "판매 전에는 다음 손님 불가");
  const seen: number[] = [];
  for (let i = 0; i < 16; i++) {
    seen.push(s.order!.bottles);
    s = submit(s, s.order!.tasks[0].problem.answer);
    s = submit(s, s.order!.tasks[1].problem.answer);
    s = run(s, { type: "COMPLETE_POTION" }, { type: "DELIVER" }, { type: "NEXT_CUSTOMER", seed: 100 + i }, { type: "ACCEPT_ORDER" });
  }
  for (let i = 1; i < seen.length; i++) assert.notEqual(seen[i], seen[i - 1], "같은 문제가 연속되지 않음");
  // 첫 8개는 2~9병을 한 번씩 모두 사용 (조합 소진 전 반복 없음)
  assert.deepEqual([...seen.slice(0, 8)].sort((a, b) => a - b), [2, 3, 4, 5, 6, 7, 8, 9]);
  assert.deepEqual([...seen.slice(8, 16)].sort((a, b) => a - b), [2, 3, 4, 5, 6, 7, 8, 9]);
  assert.equal(s.stats.ordersCompleted, 16);
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
  assert.doesNotMatch(h2, /1\.8/, "2단계는 답을 알려 주지 않음");
  const h3 = hintFeedback(p, 3);
  assert.match(h3.lines.join(" "), /0\.1이 6 × 3 = 18개/);
  assert.deepEqual(h3.visual, { kind: "unitBlocks", perGroup: 6, groups: 3, unitLabel: "0.1" });
  const q = hintFeedback(P("0.25", "3", "0.75"), 3).lines.join(" ");
  assert.match(q, /0\.01이 25 × 3 = 75개/);
});
