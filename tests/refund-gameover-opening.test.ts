// 피해 보상금 / −50 이하 영업 중단과 전날 복구 / 새 게임 오프닝 / 저장 v9
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createInitialState, OPENING_LINES, reducer, restorePoint, snapshotOf } from "../src/game/reducer.ts";
import { createOrderFromKey } from "../src/game/orderFactory.ts";
import { penaltyFor, qualityOf } from "../src/game/outcome.ts";
import { summarizeDay } from "../src/game/daySummary.ts";
import { loadGame, SAVE_KEY, saveGame, validateState } from "../src/game/save.ts";
import { INGREDIENTS } from "../src/data/ingredients.ts";
import { createRng } from "../src/lib/rng.ts";
import { GAME_OVER_MONEY, type GameState, type Order } from "../src/game/types.ts";
import { answerActive, closeAndNext, correctAnswer, memoryStorage, NOW, order, playFullDay, roundTrip, run, serveCurrent, submit, wrongAnswer } from "./helpers.ts";

const ALL = Object.values(INGREDIENTS).filter((i) => !i.legacy).map((i) => i.id);

/** 현재 손님 자리에 원하는 주문을 넣는다 (주문 번호는 그 자리 것 그대로) */
function withCurrent(s: GameState, key: string): GameState {
  const d = s.day!;
  const cur = d.orders[d.currentIndex];
  const o: Order = { ...createOrderFromKey(key, { orderNumber: Number(cur.id.slice(6)), customerId: cur.customerId, rng: createRng(3) }), status: "arrived" };
  return { ...s, day: { ...d, orders: d.orders.map((x, i) => (i === d.currentIndex ? o : x)) } };
}

/** 1일차를 연 상태 (모든 재료 해금, 소개 확인) */
function day1(money = 0): GameState {
  let s = run({ ...createInitialState(), unlockedIngredients: ALL, money }, { type: "START", seed: 7 });
  return reducer(s, { type: "ACK_INTRO", dayNumber: 1 });
}

/** 지금 손님을 바람 걸음 특별 주문(정상가 24G)으로 바꾸고 제조해 병에 담는다 (전달 전) */
function bottle24(s: GameState, wrong: number[] = []): GameState {
  s = withCurrent(s, "custom:wind:0.2");
  assert.equal(order(s).price, 24);
  s = reducer(s, { type: "ACCEPT_ORDER", orderId: order(s).id });
  const o = order(s);
  for (let i = 0; i < o.tasks.length; i++) {
    s = reducer(s, { type: "PLACE_INGREDIENT", orderId: o.id, taskIndex: i });
    s = answerActive(s, wrong.includes(i) ? wrongAnswer(order(s).tasks[i]) : correctAnswer(order(s).tasks[i]));
    s = reducer(s, { type: "ADD_TO_CAULDRON", orderId: o.id, taskIndex: i });
  }
  for (let k = 0; k < 4; k++) s = reducer(s, { type: "STIR", orderId: o.id, amount: 25 });
  return run(s, { type: "COMPLETE_POTION", orderId: o.id }, { type: "GO_COUNTER" });
}

const deliver = (s: GameState) => reducer(s, { type: "DELIVER", orderId: order(s).id, now: NOW });

/* ------------------------------------------------------------------ */
/* [1] 피해 보상금                                                      */
/* ------------------------------------------------------------------ */

test("보상금 = 정상 판매가 총액 ÷ 3, 일반 반올림 (상한·하한 없음)", () => {
  assert.deepEqual([21, 24, 30, 10, 20, 28, 35, 14, 3, 1, 90].map(penaltyFor), [7, 8, 10, 3, 7, 9, 12, 5, 1, 0, 30]);
});

test("정상 주문은 판매금, 잘못 만든 24G 주문은 판매금 0·보상금 8G만 (전달하는 순간 한 번)", () => {
  // 정상
  let s = bottle24(day1(100));
  assert.equal(order(s).quality, "great");
  assert.equal(s.money, 100, "병에 담을 때는 돈이 바뀌지 않음");
  s = deliver(s);
  assert.equal(s.money, 124);
  assert.equal(s.day!.moneyEarned, 24);
  // 오답 (두 재료 중 하나만 틀려도, 둘 다 틀려도 8G 한 번)
  for (const wrong of [[0], [0, 1]]) {
    let w = bottle24(day1(100), wrong);
    assert.equal(order(w).reward, 0);
    assert.equal(order(w).penalty, 8);
    assert.equal(w.money, 100, "아직 전달하지 않은 주문은 차감 없음");
    w = deliver(w);
    assert.equal(w.money, 92, "100 − 8");
    assert.equal(w.day!.moneyEarned, 0, "오늘 수입에는 판매금만");
    const log = w.orderLog.at(-1)!;
    assert.equal(log.reward, 0);
    assert.equal(log.penalty, 8);
  }
});

test("전달 연속 클릭·새로고침(저장→불러오기) 뒤에도 차감·지급은 한 번", () => {
  let s = bottle24(day1(100), [1]);
  s = run(s, { type: "DELIVER", orderId: order(s).id, now: NOW }, { type: "DELIVER", orderId: order(s).id, now: NOW });
  assert.equal(s.money, 92);
  const store = memoryStorage();
  saveGame(s, store);
  const l = loadGame(1, store);
  assert.ok(l.kind === "ok");
  if (l.kind !== "ok") return;
  const again = deliver(l.state);
  assert.equal(again.money, 92);
  assert.equal(again.orderLog.length, s.orderLog.length);
  // 병에 담은 상태에서 새로고침 → 전달하면 한 번
  let b = bottle24(day1(100), [0]);
  b = roundTrip(b);
  b = run(b, { type: "DELIVER", orderId: order(b).id, now: NOW }, { type: "DELIVER", orderId: order(b).id, now: NOW });
  assert.equal(b.money, 92);
});

test("힌트 사용·숫자 형식 오류는 보상금 대상이 아님, 오답이어도 해설을 보고 제조·전달을 이어 감", () => {
  let s = withCurrent(day1(50), "custom:wind:0.2");
  s = reducer(s, { type: "ACCEPT_ORDER", orderId: order(s).id });
  const o = order(s);
  s = reducer(s, { type: "REVEAL_HINT", orderId: o.id });
  for (let i = 0; i < 2; i++) {
    s = reducer(s, { type: "PLACE_INGREDIENT", orderId: o.id, taskIndex: i });
    const bad = submit(s, ".");
    assert.equal(bad.feedback?.kind, "format");
    assert.equal(order(bad).tasks[i].status, "pending", "형식 오류는 확정 안 됨");
    s = answerActive(s, correctAnswer(order(s).tasks[i]));
    s = reducer(s, { type: "ADD_TO_CAULDRON", orderId: o.id, taskIndex: i });
  }
  for (let k = 0; k < 4; k++) s = reducer(s, { type: "STIR", orderId: o.id, amount: 25 });
  s = run(s, { type: "COMPLETE_POTION", orderId: o.id }, { type: "GO_COUNTER" });
  assert.equal(order(s).quality, "great");
  assert.equal(order(s).penalty, 0);
  s = deliver(s);
  assert.equal(s.money, 74);

  // 오답 → 해설 보기 → 넣기 → 완성 → 전달
  let w = withCurrent(day1(50), "custom:wind:0.2");
  w = reducer(w, { type: "ACCEPT_ORDER", orderId: order(w).id });
  w = reducer(w, { type: "PLACE_INGREDIENT", orderId: order(w).id, taskIndex: 0 });
  w = answerActive(w, wrongAnswer(order(w).tasks[0]));
  assert.equal(w.feedback, null);
  w = reducer(w, { type: "VIEW_EXPLANATION" });
  assert.equal(order(w).tasks[0].explanationViewed, true);
  w = serveCurrent(w);
  assert.equal(order(w).status, "paid");
  assert.equal(w.money, 42);
});

test("마녀의 자동 솥: 결과·보상금이 손으로 만든 것과 같다", () => {
  const manual = deliver(bottle24(day1(500), [1]));
  let s = day1(500);
  s = reducer(s, { type: "BUY_ITEM", itemId: "autoCauldron" });
  const paid = 500 - s.money;
  s = withCurrent(s, "custom:wind:0.2");
  s = reducer(s, { type: "ACCEPT_ORDER", orderId: order(s).id });
  const o = order(s);
  for (let i = 0; i < 2; i++) {
    s = reducer(s, { type: "PLACE_INGREDIENT", orderId: o.id, taskIndex: i });
    s = answerActive(s, i === 1 ? wrongAnswer(order(s).tasks[i]) : correctAnswer(order(s).tasks[i]));
    s = reducer(s, { type: "ADD_TO_CAULDRON", orderId: o.id, taskIndex: i });
  }
  assert.equal(order(s).status, "bottled");
  s = run(s, { type: "GO_COUNTER" }, { type: "DELIVER", orderId: o.id, now: NOW });
  assert.equal(order(s).quality, order(manual).quality);
  assert.equal(order(s).penalty, 8);
  assert.equal(s.money, manual.money - paid);
});

test("마감: 오늘 수입은 판매금만, 소지금은 구매·보상금이 반영된 실제 잔액", () => {
  let s = day1(300);
  s = reducer(s, { type: "BUY_ITEM", itemId: "glasses" }); // 150
  const start = s.money;
  s = deliver(bottle24(s, [0])); // −8
  s = reducer(s, { type: "NEXT_CUSTOMER", fromOrderId: order(s).id });
  s = deliver(bottle24(s)); // +24
  for (let i = 2; i < 5; i++) {
    s = reducer(s, { type: "NEXT_CUSTOMER", fromOrderId: order(s).id });
    s = serveCurrent(s);
  }
  const earned = s.day!.orders.reduce((a, o) => a + (o.reward ?? 0), 0);
  s = reducer(s, { type: "CLOSE_DAY", dayNumber: 1, now: NOW });
  const h = s.dayHistory.at(-1)!;
  assert.equal(h.moneyEarned, earned);
  assert.equal(h.moneyAfter, s.money);
  assert.equal(s.money, start - 8 + earned);
  assert.deepEqual(summarizeDay(s.day!, s.money, NOW).moneyEarned, earned);
});

/* ------------------------------------------------------------------ */
/* [4] −50 이하 영업 중단                                               */
/* ------------------------------------------------------------------ */

test("−49G는 영업 계속, 정확히 −50G와 −47G에서 8G를 잃은 −55G는 영업 중단", () => {
  for (const [startMoney, after, over] of [[-41, -49, false], [-42, -50, true], [-47, -55, true]] as const) {
    let s = bottle24({ ...day1(), money: startMoney }, [0]);
    s = deliver(s);
    assert.equal(s.money, after);
    assert.equal(s.gameOver !== null, over, `${after}`);
    const next = reducer(s, { type: "NEXT_CUSTOMER", fromOrderId: order(s).id });
    if (over) {
      assert.equal(next, s, "다음 손님으로 넘어가지 않음");
      assert.deepEqual(s.gameOver, { dayNumber: 1, money: after, orderId: order(s).id });
    } else assert.equal(next.day!.currentIndex, 1);
  }
});

test("영업 중단 중에는 마감·다음 영업·구매·해금·제조를 받지 않고, 새로고침해도 중단 상태 유지", () => {
  let s = { ...day1(), money: -45 };
  for (let i = 0; i < 4; i++) {
    s = serveCurrent(s);
    s = reducer(s, { type: "NEXT_CUSTOMER", fromOrderId: order(s).id });
  }
  s = deliver(bottle24({ ...s, money: -45 }, [0]));
  assert.ok(s.gameOver);
  for (const a of [
    { type: "CLOSE_DAY", dayNumber: 1, now: NOW },
    { type: "BUY_ITEM", itemId: "glasses" },
    { type: "UNLOCK_INGREDIENT", ingredientId: "featherGrass" },
  ] as const) assert.equal(reducer(s, a), s, a.type);
  const store = memoryStorage();
  saveGame(s, store);
  const l = loadGame(1, store);
  assert.ok(l.kind === "ok" && l.state.gameOver?.money === -53);
});

test("소지금이 음수여도 정상 구매는 기존처럼 잔액 부족이면 막힘", () => {
  const s = { ...day1(), money: -10 };
  assert.equal(reducer(s, { type: "BUY_ITEM", itemId: "glasses" }), s);
  assert.equal(reducer(s, { type: "UNLOCK_INGREDIENT", ingredientId: "featherGrass" }).money, -10);
  const ok = reducer({ ...day1(), money: 150 }, { type: "BUY_ITEM", itemId: "glasses" });
  assert.equal(ok.money, 0);
});

/* ------------------------------------------------------------------ */
/* [4] 복구 지점                                                        */
/* ------------------------------------------------------------------ */

test("5일차에 영업 중단 → 4일차 영업 시작 상태로: 소지금·주문·구매·장착·해금·학습 기록·복습이 함께 되돌아감", () => {
  let s = run({ ...createInitialState(), money: 0 }, { type: "START", seed: 31, tutorial: true });
  s = run(s, { type: "OPENING_NEXT", fromLine: 0 }, { type: "OPENING_NEXT", fromLine: 1 }, { type: "OPENING_NEXT", fromLine: 2 });
  for (let d = 1; d <= 3; d++) s = closeAndNext(playFullDay(s), 100 + d);
  assert.equal(s.day!.dayNumber, 4);
  assert.deepEqual(s.checkpoints.map((c) => c.dayNumber), [3, 4], "오늘·전날만");
  const day4Start = s;
  // 4일차: 구매·장착·오답(복습 후보)까지 하고 마감
  s = { ...s, money: s.money + 400 };
  s = run(s, { type: "BUY_ITEM", itemId: "glasses" }, { type: "BUY_ITEM", itemId: "counter:royal" }, { type: "EQUIP_DECOR", slot: "counter", theme: "royal" });
  s = closeAndNext(playFullDay(s, (i) => (i === 0 ? { wrong: [0] } : {})), 105);
  assert.equal(s.day!.dayNumber, 5);
  assert.deepEqual(s.checkpoints.map((c) => c.dayNumber), [4, 5]);
  // 5일차: 판매 몇 건 후 보상금으로 −50 이하
  s = serveCurrent(s);
  s = reducer(s, { type: "NEXT_CUSTOMER", fromOrderId: order(s).id });
  s = { ...s, money: -45 };
  s = deliver(bottle24(s, [0]));
  assert.equal(s.gameOver?.dayNumber, 5);
  const cp = restorePoint(s)!;
  assert.equal(cp.dayNumber, 4, "전날(4일차) 시작");
  assert.equal(reducer(s, { type: "RESTORE_CHECKPOINT", dayNumber: 5 }), s, "다른 일차 요청은 무시");
  let r = reducer(s, { type: "RESTORE_CHECKPOINT", dayNumber: 4 });
  assert.equal(r.gameOver, null);
  assert.equal(r.day!.dayNumber, 4);
  assert.equal(r.scene, "counter");
  const want = snapshotOf(day4Start);
  for (const k of ["money", "day", "shop", "unlockedIngredients", "problemLog", "review", "orderLog", "dayHistory", "paidOrderIds", "stats", "nextOrderNumber", "decks"] as const) {
    assert.deepEqual(r[k], want[k], k);
  }
  assert.ok(!r.shop.owned.includes("glasses"), "4일차 이후 구매 취소");
  assert.equal(r.shop.equipped.counter, "basic");
  assert.deepEqual(r.checkpoints.map((c) => c.dayNumber), [4], "복구한 날 이후의 복구 지점은 버림");
  assert.equal(r.opening?.done, true, "오프닝은 다시 나오지 않음");
  assert.equal(r.tutorial?.status, "done");
  // 같은 복구를 두 번 눌러도 한 번 (이미 중단 아님)
  assert.equal(reducer(r, { type: "RESTORE_CHECKPOINT", dayNumber: 4 }), r);
  // 저장 → 불러오기 후에도 복구된 상태로 이어짐, 다시 4일차를 마치면 5일차 복구 지점이 새로 생김
  r = roundTrip(r);
  assert.ok(validateState(JSON.parse(JSON.stringify(r))).ok);
  r = closeAndNext(playFullDay(r), 205);
  assert.equal(r.day!.dayNumber, 5);
  assert.deepEqual(r.checkpoints.map((c) => c.dayNumber), [4, 5]);
  assert.equal(r.orderLog.filter((o) => o.dayNumber === 4).length, 5, "4일차 기록 중복 없음");
  assert.equal(r.dayHistory.filter((h) => h.dayNumber === 4).length, 1);
});

test("1일차 영업 중단 → 1일차 시작으로 복구(전날 없음), 튜토리얼·오프닝은 다시 시작하지 않음", () => {
  let s = run(createInitialState(), { type: "START", seed: 9, tutorial: true });
  s = run(s, { type: "OPENING_NEXT", fromLine: 0 }, { type: "OPENING_NEXT", fromLine: 1 }, { type: "OPENING_NEXT", fromLine: 2 });
  const start = s;
  s = serveCurrent(s);
  assert.equal(s.tutorial?.status, "done");
  s = reducer(s, { type: "NEXT_CUSTOMER", fromOrderId: order(s).id });
  s = deliver(bottle24({ ...s, unlockedIngredients: ALL, money: -49 }, [0]));
  assert.ok(s.gameOver);
  assert.equal(restorePoint(s)!.dayNumber, 1);
  const r = reducer(s, { type: "RESTORE_CHECKPOINT", dayNumber: 1 });
  assert.equal(r.money, 0);
  assert.deepEqual(r.day, start.day);
  assert.deepEqual(r.problemLog, []);
  assert.equal(r.tutorial?.status, "done", "끝낸 튜토리얼을 다시 시작하지 않음");
  assert.equal(r.opening?.done, true);
});

test("업데이트 전 저장(v8, 영업 도중): 복구 지점을 지어내지 않고, 중단되면 복구 없이 안내만 / 다음 영업부터 복구 지점", () => {
  const raw = readFileSync(new URL("./fixtures/v8-midday-bottled-wrong.json", import.meta.url), "utf8");
  const v8 = JSON.parse(raw);
  const store = memoryStorage();
  store.setItem(SAVE_KEY, raw);
  const l = loadGame(1, store);
  assert.equal(l.kind, "ok", l.kind === "error" ? l.errors.join(",") : "");
  if (l.kind !== "ok") return;
  assert.equal(l.migratedFrom, 8);
  assert.ok(store.mem.has("moonlight-potion-shop/backup-v8"), "원본 백업");
  let s = l.state;
  assert.equal(s.saveVersion, 9);
  assert.deepEqual(s.checkpoints, []);
  assert.equal(s.gameOver, null);
  assert.equal(s.opening, null, "이어하던 게임에 오프닝 없음");
  assert.equal(s.money, v8.money);
  // 이미 전달한 주문(이전 규칙 60%)은 다시 계산하지 않음
  const paid0 = s.day!.orders[0];
  assert.equal(paid0.status, "paid");
  assert.equal(paid0.reward, v8.day.orders[0].reward);
  assert.equal(paid0.penalty, undefined);
  // 병에 담았지만 전달 전인 오답 주문은 새 규칙으로
  const b = order(s);
  assert.equal(b.status, "bottled");
  assert.equal(b.quality, "poor");
  assert.equal(b.reward, 0);
  assert.equal(b.penalty, penaltyFor(b.price));
  // −50 이하로 만들면 복구 지점이 없어 복구 불가 (저장은 지우지 않음)
  s = deliver({ ...s, money: -45 });
  assert.ok(s.gameOver);
  assert.equal(restorePoint(s), null);
  assert.equal(reducer(s, { type: "RESTORE_CHECKPOINT", dayNumber: 2 }), s);
  assert.equal(reducer(s, { type: "RESTORE_CHECKPOINT", dayNumber: 1 }), s);
});

test("업데이트 전 저장(v8, 그날 첫 손님 전): 그 상태가 곧 영업 시작이라 그날 복구 지점이 생김, 그날 중단되면 그날 시작으로", () => {
  const raw = readFileSync(new URL("./fixtures/v8-daystart.json", import.meta.url), "utf8");
  const store = memoryStorage();
  store.setItem(SAVE_KEY, raw);
  const l = loadGame(1, store);
  assert.ok(l.kind === "ok");
  if (l.kind !== "ok") return;
  let s = l.state;
  assert.deepEqual(s.checkpoints.map((c) => c.dayNumber), [2]);
  const startMoney = s.money;
  s = { ...s, unlockedIngredients: ALL };
  s = reducer(s, { type: "ACK_INTRO", dayNumber: 2 });
  s = deliver(bottle24({ ...s, money: -45 }, [0]));
  assert.equal(restorePoint(s)!.dayNumber, 2, "전날 기록이 없으니 그날 시작");
  const r = reducer(s, { type: "RESTORE_CHECKPOINT", dayNumber: 2 });
  assert.equal(r.money, startMoney);
  assert.equal(r.day!.currentIndex, 0);
});

test("저장 검사: 보상금·영업 중단·복구 지점 조작은 거부", () => {
  let s = bottle24(day1(100), [0]);
  const ok = JSON.parse(JSON.stringify(s));
  assert.ok(validateState(ok).ok);
  const a = JSON.parse(JSON.stringify(s));
  a.day.orders[0].penalty = 1;
  assert.equal(validateState(a).ok, false, "보상금 조작");
  const b = JSON.parse(JSON.stringify(s));
  b.gameOver = { dayNumber: 1, money: -60, orderId: b.day.orders[0].id };
  assert.equal(validateState(b).ok, false, "소지금과 다른 중단 정보");
  const c = JSON.parse(JSON.stringify(s));
  c.checkpoints[0].state.money = 99999.5;
  assert.equal(validateState(c).ok, false, "깨진 복구 지점");
  const d = JSON.parse(JSON.stringify(s));
  d.opening = { line: 7, done: false };
  assert.equal(validateState(d).ok, false, "오프닝 대사 번호");
  s = deliver({ ...s, money: -45 });
  assert.ok(validateState(JSON.parse(JSON.stringify(s))).ok, "음수 소지금·중단 상태 저장은 정상");
});

/* ------------------------------------------------------------------ */
/* [3] 오프닝                                                            */
/* ------------------------------------------------------------------ */

test("오프닝: 새 게임(튜토리얼)에서만, 대사 세 개를 문구 그대로 한 번에 하나씩, 같은 대사에서 두 번 넘기지 않음", () => {
  assert.deepEqual(OPENING_LINES, [
    "드디어 열었어! 나만의 포션 상점이야!",
    "포션의 달인이셨던 우리 할머니를 본받아서, 세계 최고의 포션을 만들겠어!",
    "내 포션들로 손님들을 기쁘게 해 줘야지!",
  ]);
  assert.equal(run(createInitialState(), { type: "START", seed: 1 }).opening, null, "튜토리얼 없는 시작은 오프닝 없음");
  let s = run(createInitialState(), { type: "START", seed: 1, tutorial: true });
  assert.deepEqual(s.opening, { line: 0, done: false });
  assert.equal(s.tutorial?.status, "active");
  // 버튼과 화면 클릭이 함께 들어와도(같은 fromLine) 한 대사만
  s = run(s, { type: "OPENING_NEXT", fromLine: 0 }, { type: "OPENING_NEXT", fromLine: 0 });
  assert.deepEqual(s.opening, { line: 1, done: false });
  // 새로고침 후 이어하기: 보던 대사부터
  s = roundTrip(s);
  const l = (() => { const st = memoryStorage(); saveGame(s, st); return loadGame(1, st); })();
  assert.ok(l.kind === "ok" && l.state.opening?.line === 1);
  s = run(s, { type: "OPENING_NEXT", fromLine: 1 }, { type: "OPENING_NEXT", fromLine: 2 }, { type: "OPENING_NEXT", fromLine: 2 });
  assert.deepEqual(s.opening, { line: 2, done: true });
  // 오프닝 동안 주문·손님은 그대로(첫 주문 튜토리얼 주문)
  assert.equal(order(s).status, "arrived");
  assert.equal(order(s).id, s.tutorial!.orderId);
  // 끝난 뒤에는 다시 시작하지 않음
  assert.equal(reducer(s, { type: "OPENING_NEXT", fromLine: 0 }), s);
  assert.equal(reducer(s, { type: "START", seed: 2 }).opening?.done, true, "이어하기(START)로 오프닝 반복 없음");
});

test("자동 솥 즉시 완성·재료 미투입 차단은 그대로 (보상금 규칙과 함께)", () => {
  let s = day1(500);
  s = reducer(s, { type: "BUY_ITEM", itemId: "autoCauldron" });
  s = withCurrent(s, "multiBottle:hawk:3");
  s = reducer(s, { type: "ACCEPT_ORDER", orderId: order(s).id });
  const o = order(s);
  for (let i = 0; i < 2; i++) {
    s = reducer(s, { type: "PLACE_INGREDIENT", orderId: o.id, taskIndex: i });
    s = answerActive(s, correctAnswer(order(s).tasks[i]));
    s = reducer(s, { type: "ADD_TO_CAULDRON", orderId: o.id, taskIndex: i });
  }
  assert.equal(order(s).status, "brewing");
  s = reducer(s, { type: "PLACE_INGREDIENT", orderId: o.id, taskIndex: 2 });
  s = answerActive(s, wrongAnswer(order(s).tasks[2]));
  s = reducer(s, { type: "ADD_TO_CAULDRON", orderId: o.id, taskIndex: 2 });
  assert.equal(order(s).status, "bottled");
  assert.equal(order(s).quality, qualityOf(order(s)));
  assert.equal(order(s).penalty, penaltyFor(order(s).price));
  assert.ok(GAME_OVER_MONEY === -50);
});
