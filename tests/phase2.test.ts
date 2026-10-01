// Phase 2 기능 유지: 하루 영업, 마감, 다음 날, 중복 방지, 저장·이어하기, 가져오기
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createInitialState, reducer } from "../src/game/reducer.ts";
import { BACKUP_KEY_PREFIX, loadGame, SAVE_KEY, saveGame, validateState } from "../src/game/save.ts";
import { buildSaveExport, parseImportText } from "../src/game/transfer.ts";
import type { GameState } from "../src/game/types.ts";
import { closeAndNext, memoryStorage, NOW, order, playFullDay, roundTrip, run, serveCurrent } from "./helpers.ts";

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

test("하루 = 손님 5명, 주문은 시작 때 만들어 저장 (새로고침해도 같음)", () => {
  const s = run(createInitialState(), { type: "START", seed: 5 });
  assert.equal(s.day!.orders.length, 5);
  assert.deepEqual(s.day!.orders.map((o) => o.status), ["arrived", "queued", "queued", "queued", "queued"]);
  assert.equal(new Set(s.day!.orders.map((o) => o.id)).size, 5);
  const again = run(roundTrip(s), { type: "GO_TITLE" }, { type: "START", seed: 999 });
  assert.deepEqual(again.day!.orders.map((o) => o.deckKey), s.day!.orders.map((o) => o.deckKey));
});

test("여러 날: 연속한 여러 병 주문의 병 수가 같지 않다 (날 경계 포함)", () => {
  let s = run(createInitialState(), { type: "START", seed: 1 });
  const seq: (number | null)[] = [];
  for (let d = 0; d < 8; d++) {
    seq.push(...s.day!.orders.map((o) => (o.kind === "multiBottle" ? o.bottles : null)));
    s = closeAndNext(playFullDay(s), 100 + d);
  }
  for (let i = 1; i < seq.length; i++) {
    if (seq[i] !== null && seq[i - 1] !== null) assert.notEqual(seq[i], seq[i - 1], `위치 ${i}`);
  }
});

test("다섯 번째 손님 후 마감, 마감·다음 날은 한 번만", () => {
  let s = playFullDay(run(createInitialState(), { type: "START", seed: 3 }));
  assert.equal(reducer(s, { type: "NEXT_CUSTOMER", fromOrderId: order(s).id }), s, "여섯 번째 손님 없음");
  s = run(s, { type: "CLOSE_DAY", dayNumber: 1, now: NOW }, { type: "CLOSE_DAY", dayNumber: 1, now: NOW });
  assert.equal(s.day!.status, "closed");
  assert.equal(s.dayHistory.length, 1);
  const money = s.money;
  s = run(s, { type: "NEXT_DAY", fromDay: 1, seed: 7 }, { type: "NEXT_DAY", fromDay: 1, seed: 8 });
  assert.equal(s.day!.dayNumber, 2);
  assert.equal(s.money, money);
  assert.equal(reducer(roundTrip(s), { type: "NEXT_DAY", fromDay: 1, seed: 9 }).day!.dayNumber, 2, "새로고침 후 늦은 클릭도 무시");
});

test("판매금: 같은 주문 중복 전달·새로고침·되돌리기 모두 1회", () => {
  let s = serveCurrent(run(createInitialState(), { type: "START", seed: 4 }));
  const first = order(s);
  const paid = s.money;
  assert.equal(paid, first.reward);
  s = run(s, { type: "DELIVER", orderId: first.id, now: NOW }, { type: "DELIVER", orderId: first.id, now: NOW });
  assert.equal(s.money, paid);
  let r = run(roundTrip(s), { type: "GO_TITLE" }, { type: "START", seed: 1 }, { type: "DELIVER", orderId: first.id, now: NOW });
  assert.equal(r.money, paid);
  assert.equal(order(r).status, "paid");
  r = run(r, { type: "NEXT_CUSTOMER", fromOrderId: first.id }, { type: "NEXT_CUSTOMER", fromOrderId: first.id });
  assert.equal(r.day!.currentIndex, 1);
  r = reducer(r, { type: "DELIVER", orderId: first.id, now: NOW });
  assert.equal(r.money, paid);
  assert.equal(r.orderLog.length, 1, "주문 결과 기록도 1번");
});

test("마감 화면 복구", () => {
  let s = playFullDay(run(createInitialState(), { type: "START", seed: 2 }));
  s = reducer(s, { type: "CLOSE_DAY", dayNumber: 1, now: NOW });
  const store = memoryStorage();
  saveGame(s, store);
  const l = loadGame(1, store);
  assert.equal(l.kind, "ok");
  if (l.kind !== "ok") return;
  assert.equal(l.state.scene, "closing");
  assert.equal(run({ ...l.state, scene: "title" }, { type: "START", seed: 3 }).scene, "closing");
});

test("Phase 1 저장 → v2 → v3 마이그레이션: 진행 중 주문은 Phase 2 규칙으로 이어서", () => {
  const raw = fixture("phase1-brewing.json");
  const v1 = JSON.parse(raw);
  const store = memoryStorage();
  store.setItem(SAVE_KEY, raw);
  const l = loadGame(77, store);
  assert.equal(l.kind, "ok", l.kind === "error" ? l.errors.join(",") : "");
  if (l.kind !== "ok") return;
  const s = l.state;
  assert.equal(l.migratedFrom, 1);
  assert.equal(store.mem.get(`${BACKUP_KEY_PREFIX}v1`), raw);
  assert.equal(s.saveVersion, 3);
  assert.equal(s.money, v1.money);
  assert.equal(s.legacyRecords.length, v1.records.length);
  assert.equal(s.day!.rules, 2);
  assert.ok(s.day!.orders.every((o) => o.rules === 2));
  assert.equal(order(s).tasks[0].status, "done");
  assert.equal(s.draftAnswer, "0.7");
  assert.equal(s.activeTask, 1);
  let g = run(s, { type: "START", seed: 1 });
  assert.equal(g.scene, "workbench");
  g = serveCurrent(g);
  assert.equal(g.money, v1.money + v1.order.price, "Phase 2 규칙: 정상 판매금 전액");
});

test("손상·미지원 저장은 덮어쓰지 않음", () => {
  const store = memoryStorage();
  store.setItem(SAVE_KEY, "{망가진 데이터");
  const a = loadGame(1, store);
  assert.equal(a.kind, "error");
  assert.equal(store.mem.get(SAVE_KEY), "{망가진 데이터");
  store.setItem(SAVE_KEY, JSON.stringify({ ...createInitialState(), saveVersion: 9 }));
  const b = loadGame(1, store);
  assert.ok(b.kind === "error" && b.reason === "unsupportedVersion");
});

test("내보내기 → 가져오기 왕복, 잘못된 파일 거부", () => {
  let s = playFullDay(run(createInitialState(), { type: "START", seed: 21 }), (i) => (i === 1 ? { wrong: [0], hint: true } : {}));
  s = reducer(s, { type: "CLOSE_DAY", dayNumber: 1, now: NOW });
  const imp = parseImportText(JSON.stringify(buildSaveExport(s, NOW)), 1);
  assert.ok(imp.ok);
  if (imp.ok) assert.deepEqual({ ...imp.state, scene: s.scene }, s);
  const bad: [string, (g: GameState) => void][] = [
    ["음수 소지금", (g) => { g.money = -1; }],
    ["손님 순서", (g) => { g.day!.currentIndex = 7; }],
    ["주문 4건", (g) => { g.day!.orders.pop(); }],
    ["지급 기록 누락", (g) => { g.paidOrderIds = []; }],
  ];
  for (const [name, mut] of bad) {
    const g = roundTrip(s);
    mut(g);
    assert.equal(parseImportText(JSON.stringify(g), 1).ok, false, name);
  }
  assert.equal(parseImportText("not json", 1).ok, false);
  assert.ok(validateState(roundTrip(s)).ok);
});
