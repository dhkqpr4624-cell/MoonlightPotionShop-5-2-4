// Phase 2: 하루 영업, 마감, 저장·이어하기, 마이그레이션, 내보내기·가져오기
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createInitialState, currentOrder, reducer } from "../src/game/reducer.ts";
import { dayProblemCounts, encouragement } from "../src/game/daySummary.ts";
import {
  BACKUP_KEY_PREFIX,
  interpretSaveData,
  loadGame,
  migrateV1,
  SAVE_KEY,
  saveGame,
  validateState,
} from "../src/game/save.ts";
import { buildLearningExport, buildSaveExport, parseImportText } from "../src/game/transfer.ts";
import type { GameState } from "../src/game/types.ts";
import { memoryStorage, NOW, order, roundTrip, run, serveCurrent, startBrewing, submit } from "./helpers.ts";

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

/** 1일차를 끝까지(손님 5명) 판매. i번째 손님에게 줄 옵션 */
function playFullDay(start: GameState, opts: (i: number) => { wrongFirst?: boolean; hint?: boolean } = () => ({})): GameState {
  let s = start;
  for (let i = 0; i < 5; i++) {
    s = serveCurrent(s, opts(i));
    if (i < 4) s = reducer(s, { type: "NEXT_CUSTOMER", fromOrderId: order(s).id });
  }
  return s;
}

test("하루 = 손님 5명, 주문 5건은 시작 때 만들어져 저장된다", () => {
  const s = run(createInitialState(), { type: "START", seed: 5 });
  assert.equal(s.day!.dayNumber, 1);
  assert.equal(s.day!.orders.length, 5);
  assert.deepEqual(s.day!.orders.map((o) => o.status), ["arrived", "queued", "queued", "queued", "queued"]);
  const bottles = s.day!.orders.map((o) => o.bottles);
  for (let i = 1; i < 5; i++) assert.notEqual(bottles[i], bottles[i - 1], "같은 병 수 연속 없음");
  assert.equal(new Set(s.day!.orders.map((o) => o.id)).size, 5, "주문 ID 고유");
  // 새로고침해도 같은 주문
  const again = run(roundTrip(s), { type: "GO_TITLE" }, { type: "START", seed: 999 });
  assert.deepEqual(again.day!.orders.map((o) => o.id + ":" + o.bottles), s.day!.orders.map((o) => o.id + ":" + o.bottles));
});

test("여러 날 동안 병 수가 연속으로 같지 않다 (날 경계 포함)", () => {
  let s = run(createInitialState(), { type: "START", seed: 1 });
  const all: number[] = [];
  for (let d = 0; d < 6; d++) {
    all.push(...s.day!.orders.map((o) => o.bottles));
    s = playFullDay(s);
    s = run(s, { type: "CLOSE_DAY", dayNumber: s.day!.dayNumber, now: NOW }, { type: "NEXT_DAY", fromDay: s.day!.dayNumber, seed: 100 + d });
  }
  for (let i = 1; i < all.length; i++) assert.notEqual(all[i], all[i - 1], `위치 ${i}`);
  assert.ok(all.every((b) => b >= 2 && b <= 9));
});

test("다섯 번째 손님 후에는 다음 손님 대신 마감", () => {
  let s = playFullDay(run(createInitialState(), { type: "START", seed: 3 }));
  assert.equal(s.day!.currentIndex, 4);
  const before = s;
  s = reducer(s, { type: "NEXT_CUSTOMER", fromOrderId: order(s).id });
  assert.equal(s, before, "여섯 번째 손님 없음");
  s = reducer(s, { type: "CLOSE_DAY", dayNumber: 1, now: NOW });
  assert.equal(s.day!.status, "closed");
  assert.equal(s.scene, "closing");
  assert.equal(s.dayHistory.length, 1);
  const h = s.dayHistory[0];
  assert.equal(h.customersServed, 5);
  assert.equal(h.totalProblems, 10);
  assert.equal(h.bottlesSold, s.day!.orders.reduce((a, o) => a + o.bottles, 0));
  assert.equal(h.moneyEarned, h.bottlesSold * 5);
  assert.equal(h.moneyAfter, s.money);
});

test("마감은 마지막 손님 판매 후에만, 한 번만", () => {
  let s = run(createInitialState(), { type: "START", seed: 3 });
  assert.equal(reducer(s, { type: "CLOSE_DAY", dayNumber: 1, now: NOW }).day!.status, "open", "첫 손님 중 마감 불가");
  s = playFullDay(s);
  s = run(s, { type: "CLOSE_DAY", dayNumber: 1, now: NOW }, { type: "CLOSE_DAY", dayNumber: 1, now: NOW });
  assert.equal(s.dayHistory.length, 1, "중복 마감 기록 없음");
});

test("집계: 10문제, 첫 시도 정답 / 수정 성공 / 힌트 사용 (재시도는 문제 수에 안 들어감)", () => {
  // 손님1: 모두 첫 시도 정답, 손님2: 모두 오답 후 수정, 손님3: 힌트 후 첫 시도 정답, 손님4: 힌트+오답 후 수정, 손님5: 정답
  const plan = [{}, { wrongFirst: true }, { hint: true }, { hint: true, wrongFirst: true }, {}];
  let s = playFullDay(run(createInitialState(), { type: "START", seed: 8 }), (i) => plan[i]);
  s = reducer(s, { type: "CLOSE_DAY", dayNumber: 1, now: NOW });
  const h = s.dayHistory[0];
  assert.equal(h.totalProblems, 10);
  assert.equal(h.firstTryCorrect, 6); // 손님 1,3,5
  assert.equal(h.correctedAfterWrong, 4); // 손님 2,4
  assert.equal(h.hintUsed, 4); // 손님 3,4 (문제별 1회)
  assert.equal(s.records.filter((r) => r.dayNumber === 1).length, 10, "학습 기록도 문제당 1개");
  assert.ok(encouragement(h).every((l) => !/틀렸|느리|못/.test(l)), "꾸중 표현 없음");
});

test("힌트를 여러 번(3단계) 봐도 힌트 사용은 문제당 1회", () => {
  let s = startBrewing();
  s = run(s, { type: "REQUEST_HINT" }, { type: "REQUEST_HINT" }, { type: "REQUEST_HINT" }, { type: "REQUEST_HINT" });
  assert.equal(dayProblemCounts(s.day!).hintUsed, 1);
  assert.equal(order(s).tasks[0].hintLevel, 3);
});

test("판매금: 중복 전달·예전 주문 ID·다음 손님 후 되돌리기 모두 무시", () => {
  let s = serveCurrent(run(createInitialState(), { type: "START", seed: 4 }));
  const first = order(s);
  const paid = s.money;
  assert.equal(paid, first.price);
  s = run(s, { type: "DELIVER", orderId: first.id }, { type: "DELIVER", orderId: first.id });
  assert.equal(s.money, paid, "같은 주문 중복 지급 없음");
  // 판매 직후 새로고침
  let r = run(roundTrip(s), { type: "GO_TITLE" }, { type: "START", seed: 1 }, { type: "DELIVER", orderId: first.id });
  assert.equal(r.money, paid);
  assert.equal(order(r).status, "paid", "감사 반응 상태로 복구");
  // 다음 손님 → 두 번 눌러도 한 명만 넘어감
  r = run(r, { type: "NEXT_CUSTOMER", fromOrderId: first.id }, { type: "NEXT_CUSTOMER", fromOrderId: first.id });
  assert.equal(r.day!.currentIndex, 1);
  assert.equal(order(r).status, "arrived");
  // 이전 주문으로 다시 전달 시도해도 무시
  r = reducer(r, { type: "DELIVER", orderId: first.id });
  assert.equal(r.money, paid);
  assert.equal(r.day!.currentIndex, 1);
});

test("다음 날: 일차는 한 번만 증가 (더블클릭·늦은 클릭)", () => {
  let s = playFullDay(run(createInitialState(), { type: "START", seed: 6 }));
  s = reducer(s, { type: "CLOSE_DAY", dayNumber: 1, now: NOW });
  const money = s.money;
  s = run(s, { type: "NEXT_DAY", fromDay: 1, seed: 7 }, { type: "NEXT_DAY", fromDay: 1, seed: 8 });
  assert.equal(s.day!.dayNumber, 2);
  assert.equal(s.day!.status, "open");
  assert.equal(s.day!.currentIndex, 0);
  assert.equal(s.day!.moneyEarned, 0);
  assert.equal(s.money, money, "소지금 유지");
  assert.equal(s.scene, "counter");
  assert.equal(order(s).status, "arrived");
  // 새로고침 후 다시 NEXT_DAY(1) 이 와도 무시
  s = reducer(roundTrip(s), { type: "NEXT_DAY", fromDay: 1, seed: 9 });
  assert.equal(s.day!.dayNumber, 2);
});

test("마감 화면 복구: 마감 상태 저장 → 불러오기 → 이어하기는 마감 화면(덧문 닫힘)", () => {
  let s = playFullDay(run(createInitialState(), { type: "START", seed: 2 }));
  s = reducer(s, { type: "CLOSE_DAY", dayNumber: 1, now: NOW });
  const store = memoryStorage();
  saveGame(s, store);
  const loaded = loadGame(1, store);
  assert.equal(loaded.kind, "ok");
  if (loaded.kind !== "ok") return;
  assert.equal(loaded.state.scene, "closing");
  assert.equal(loaded.state.day!.status, "closed");
  const resumed = run({ ...loaded.state, scene: "title" }, { type: "START", seed: 3 });
  assert.equal(resumed.scene, "closing");
  assert.equal(resumed.day!.dayNumber, 1, "이어하기로 일차가 바뀌지 않음");
});

test("모든 복구 지점에서 저장이 검증을 통과하고 그대로 이어진다", () => {
  const points: [string, GameState][] = [];
  let s = run(createInitialState(), { type: "START", seed: 12 });
  points.push(["손님 주문 화면", s]);
  s = reducer(s, { type: "ACCEPT_ORDER" });
  s = submit(s, "99");
  points.push(["오답 후 재입력", s]);
  s = submit(s, order(s).tasks[0].problem.answer);
  points.push(["첫 재료 완료 후", s]);
  s = run(s, { type: "INPUT_KEY", key: "0" }, { type: "INPUT_KEY", key: "." });
  points.push(["두 번째 재료 입력 중", s]);
  s = submit(s, order(s).tasks[1].problem.answer);
  s = reducer(s, { type: "COMPLETE_POTION" });
  points.push(["완성 후 전달 전", s]);
  s = run(s, { type: "GO_COUNTER" }, { type: "DELIVER", orderId: order(s).id });
  points.push(["판매 후 감사 반응", s]);
  for (const [name, st] of points) {
    const store = memoryStorage();
    saveGame(st, store);
    const l = loadGame(1, store);
    assert.equal(l.kind, "ok", name);
    if (l.kind === "ok") assert.deepEqual(l.state, st, name);
  }
});

test("Phase 1 저장 마이그레이션: 진행 중 주문 이어가기 + 돈·기록 보존 + 원본 백업", () => {
  const raw = fixture("phase1-brewing.json");
  const v1 = JSON.parse(raw);
  const store = memoryStorage();
  store.setItem(SAVE_KEY, raw);
  const l = loadGame(77, store);
  assert.equal(l.kind, "ok");
  if (l.kind !== "ok") return;
  const s = l.state;
  assert.equal(l.migratedFrom, 1);
  assert.equal(store.mem.get(`${BACKUP_KEY_PREFIX}v1`), raw, "원본 백업");
  assert.equal(s.saveVersion, 2);
  assert.equal(s.money, v1.money);
  assert.equal(s.records.length, v1.records.length);
  assert.deepEqual(s.records.map((r) => r.answer), v1.records.map((r: { answer: string }) => r.answer));
  assert.equal(s.records[0].dayNumber, 0, "Phase 1 판매분 기록은 일차 0");
  assert.equal(s.records.at(-1)!.dayNumber, 1, "이어가는 주문의 기록은 1일차 1번째 손님");
  assert.equal(s.day!.dayNumber, 1);
  assert.equal(order(s).id, v1.order.id);
  assert.equal(order(s).tasks[0].status, "done");
  assert.equal(s.draftAnswer, "0.7");
  assert.equal(s.selectedTask, 1);
  assert.equal(s.day!.orders.length, 5);
  // 이어서 하루를 끝낼 수 있다
  let g = run({ ...s }, { type: "START", seed: 1 });
  assert.equal(g.scene, "workbench");
  g = submit(g, order(g).tasks[1].problem.answer);
  g = run(g, { type: "COMPLETE_POTION" }, { type: "DELIVER", orderId: order(g).id });
  assert.equal(g.money, v1.money + v1.order.price);
  for (let i = 1; i < 5; i++) {
    g = reducer(g, { type: "NEXT_CUSTOMER", fromOrderId: order(g).id });
    g = serveCurrent(g);
  }
  g = reducer(g, { type: "CLOSE_DAY", dayNumber: 1, now: NOW });
  assert.equal(g.dayHistory[0].totalProblems, 10);
  assert.ok(validateState(roundTrip(g)).ok);
});

test("Phase 1 저장 마이그레이션: 판매 완료 상태는 돈을 보존하고 1일차 새로 시작", () => {
  const v1 = JSON.parse(fixture("phase1-paid.json"));
  const r = migrateV1(v1, 5);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.state.money, v1.money);
  assert.equal(r.state.day, null);
  assert.deepEqual(r.state.paidOrderIds, v1.paidOrderIds);
  const s = reducer(r.state, { type: "START", seed: 5 });
  assert.equal(s.day!.dayNumber, 1);
  assert.ok(!s.day!.orders.some((o) => v1.paidOrderIds.includes(o.id)), "새 주문 ID는 예전 주문과 겹치지 않음");
});

test("손상·미지원 저장은 덮어쓰지 않고 오류로 알린다", () => {
  const store = memoryStorage();
  store.setItem(SAVE_KEY, "{망가진 데이터");
  const a = loadGame(1, store);
  assert.equal(a.kind, "error");
  if (a.kind === "error") assert.equal(a.reason, "corrupt");
  assert.equal(store.mem.get(SAVE_KEY), "{망가진 데이터", "원본 그대로");

  store.setItem(SAVE_KEY, JSON.stringify({ ...startBrewing(), saveVersion: 9 }));
  const b = loadGame(1, store);
  assert.equal(b.kind, "error");
  if (b.kind === "error") assert.equal(b.reason, "unsupportedVersion");
});

test("검증: 참조 ID·상태 일관성이 깨진 저장을 거부", () => {
  const good = serveCurrent(run(createInitialState(), { type: "START", seed: 4 }));
  assert.ok(validateState(roundTrip(good)).ok);
  const bad = (mut: (s: GameState) => void) => {
    const c = roundTrip(good);
    mut(c);
    return validateState(c);
  };
  assert.equal(bad((s) => { s.day!.orders[0].recipeId = "unknown"; }).ok, false, "없는 레시피");
  assert.equal(bad((s) => { s.day!.orders[0].customerId = "ghost"; }).ok, false, "없는 손님");
  assert.equal(bad((s) => { s.day!.orders[0].tasks[0].problem.a = "0.7"; }).ok, false, "레시피 기본량 조작");
  assert.equal(bad((s) => { s.day!.orders[0].tasks[0].problem.answer = "9"; }).ok, false, "정답 조작");
  assert.equal(bad((s) => { s.paidOrderIds = []; }).ok, false, "지급 기록 누락");
  assert.equal(bad((s) => { s.day!.moneyEarned += 5; }).ok, false, "판매금 합 불일치");
  assert.equal(bad((s) => { s.day!.orders[1].status = "paid"; }).ok, false, "오지 않은 손님이 판매 완료");
  assert.equal(bad((s) => { s.day!.status = "closed"; }).ok, false, "5명 전 마감");
  assert.equal(bad((s) => { s.day!.orders.pop(); }).ok, false, "주문 4건");
  assert.equal(bad((s) => { s.day!.orders[1].id = s.day!.orders[0].id; }).ok, false, "주문 ID 중복");
  assert.equal(bad((s) => { s.money = -1; }).ok, false, "음수 소지금");
  assert.equal(bad((s) => { (s as { records: unknown }).records = [{ a: 1 }]; }).ok, false, "학습 기록 형식");
});

test("내보내기 → 가져오기 왕복, 잘못된 파일은 거부", () => {
  let s = playFullDay(run(createInitialState(), { type: "START", seed: 21 }), (i) => (i === 1 ? { wrongFirst: true, hint: true } : {}));
  s = reducer(s, { type: "CLOSE_DAY", dayNumber: 1, now: NOW });
  const file = JSON.stringify(buildSaveExport(s, NOW));
  const imp = parseImportText(file, 1);
  assert.ok(imp.ok);
  if (imp.ok) {
    assert.equal(imp.state.scene, "title");
    assert.deepEqual({ ...imp.state, scene: s.scene }, s);
    assert.equal(reducer(imp.state, { type: "START", seed: 1 }).scene, "closing");
  }
  // Phase 1 파일도 가져오면 옮겨진다
  const v1 = parseImportText(fixture("phase1-brewing.json"), 1);
  assert.ok(v1.ok);
  if (v1.ok) assert.equal(v1.migratedFrom, 1);

  const learning = buildLearningExport(s, NOW);
  assert.equal(learning.problems.length, 10);
  assert.equal(learning.days.length, 1);
  assert.equal(learning.problems.filter((p) => p.hintUsed).length, 2);
  assert.ok(!JSON.stringify(learning).includes("코코"), "손님 이름 등도 넣지 않음");

  const rejects: [string, string][] = [
    ["not json", "JSON"],
    ["[]", "형식"],
    [JSON.stringify(learning), "학습 결과"],
    [JSON.stringify({ format: "other-app" }), "저장 파일이 아닙니다"],
    [JSON.stringify({ format: "moonlight-potion-shop/save", game: { ...s, saveVersion: 3 } }), "새로운 버전"],
    [JSON.stringify({ ...s, money: "많이" }), "소지금"],
    [JSON.stringify({ ...s, day: { ...s.day, currentIndex: 7 } }), "손님 순서"],
  ];
  for (const [text, expect] of rejects) {
    const r = parseImportText(text, 1);
    assert.equal(r.ok, false, text.slice(0, 30));
    if (!r.ok) assert.match(r.errors.join(" "), new RegExp(expect), text.slice(0, 30));
  }
});

test("interpretSaveData: 버전 없는 데이터 거부", () => {
  const r = interpretSaveData({ money: 3 }, 1);
  assert.equal(r.ok, false);
  assert.equal(currentOrder(createInitialState()), null);
});
