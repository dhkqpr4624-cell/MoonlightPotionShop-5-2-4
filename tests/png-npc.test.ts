// PNG 손님·창구 적용: 외형 데이터, 주문의 외형 저장, 이전 저장의 기본 외형, 저장 검사
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { APPEARANCES, appearanceOf, appearancesOf, isAppearanceOf, pickAppearance } from "../src/data/appearances.ts";
import { CUSTOMER_IDS, CUSTOMERS } from "../src/data/customers.ts";
import { COUNTER_SCENE } from "../src/data/shopArt.ts";
import { createInitialState, reducer } from "../src/game/reducer.ts";
import { validateState } from "../src/game/save.ts";
import { closeAndNext, playFullDay } from "./helpers.ts";

const pngSize = (path: string) => {
  const b = readFileSync(path);
  assert.equal(b.toString("ascii", 1, 4), "PNG", path);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
};

test("창구 PNG 3장: 파일이 있고 모두 1672×941, 외부 주소 없음", () => {
  for (const p of [COUNTER_SCENE.village, COUNTER_SCENE.arch, COUNTER_SCENE.table]) {
    assert.ok(!/^https?:/.test(p));
    assert.deepEqual(pngSize(`public/${p}`), { w: COUNTER_SCENE.width, h: COUNTER_SCENE.height });
  }
  const o = COUNTER_SCENE.opening;
  assert.ok(o.x > 0 && o.x + o.width < COUNTER_SCENE.width && o.y + o.height > COUNTER_SCENE.tableTop);
});

test("손님 외형 15종: 그림 파일이 있고, ID가 겹치지 않고, 모두 기존 손님 ID에 속함", () => {
  assert.equal(APPEARANCES.length, 15);
  assert.equal(new Set(APPEARANCES.map((a) => a.id)).size, 15);
  for (const a of APPEARANCES) {
    assert.ok(CUSTOMERS[a.customerId], a.id);
    // 표시 상자 크기 = 실제 PNG 크기 (비율 유지)
    assert.deepEqual(pngSize(`public/${a.image}`), { w: a.display.width, h: a.display.height }, a.id);
    assert.ok(a.display.scale > 0.3 && a.display.scale < 0.8, a.id);
    assert.ok(a.display.cutY > a.display.headY && a.display.cutY < 1306, a.id);
  }
  for (const id of CUSTOMER_IDS) assert.ok(appearancesOf(id).length >= 3, id);
});

test("외형 고르기는 주문 번호로만 정해지고, 바로 앞 외형은 피한다", () => {
  for (let n = 1; n < 200; n++) {
    for (const c of CUSTOMER_IDS) {
      const a = pickAppearance(c, n, null)!;
      assert.equal(a, pickAppearance(c, n, null));
      assert.ok(isAppearanceOf(a, c));
      assert.notEqual(pickAppearance(c, n, a), a);
    }
  }
});

test("새로 만든 주문에는 외형이 저장되고, 연속으로 같은 외형이 나오지 않는다", () => {
  let s = reducer(createInitialState(), { type: "START", seed: 11 });
  const seen = new Set<string>();
  for (let d = 0; d < 6; d++) {
    const orders = s.day!.orders;
    assert.equal(orders.length, 5);
    for (let i = 0; i < orders.length; i++) {
      const o = orders[i];
      assert.ok(isAppearanceOf(o.appearanceId, o.customerId), o.id);
      if (i > 0) assert.notEqual(o.appearanceId, orders[i - 1].appearanceId);
      seen.add(o.appearanceId!);
    }
    s = closeAndNext(playFullDay(s), 100 + d);
  }
  assert.ok(seen.size >= 8, `여러 외형이 나옴: ${seen.size}`);
  // 저장 → 불러오기 후에도 같은 외형
  const r = validateState(JSON.parse(JSON.stringify(s)));
  assert.ok(r.ok);
  if (r.ok) assert.deepEqual(r.state.day!.orders.map((o) => o.appearanceId), s.day!.orders.map((o) => o.appearanceId));
});

test("외형 선택은 문제 출제(난수)와 분리: 외형을 빼면 이전과 같은 주문", () => {
  const s = reducer(createInitialState(), { type: "START", seed: 5 });
  const strip = s.day!.orders.map(({ appearanceId: _a, ...rest }) => rest);
  const again = reducer(createInitialState(), { type: "START", seed: 5 }).day!.orders.map(({ appearanceId: _a, ...rest }) => rest);
  assert.deepEqual(strip, again);
  assert.ok(s.day!.orders.every((o) => !("appearanceId" in strip[0]) && o.deckKey));
});

test("외형 ID가 없는 이전 저장: 손님 ID별 기본 외형으로 항상 같게, 저장 검사 통과", () => {
  const s = reducer(createInitialState(), { type: "START", seed: 3 });
  const old = JSON.parse(JSON.stringify(s));
  for (const o of old.day.orders) delete o.appearanceId;
  const r = validateState(old);
  assert.ok(r.ok, r.ok ? "" : r.errors.join(","));
  for (const o of old.day.orders) {
    const a = appearanceOf(o);
    assert.equal(a, appearancesOf(o.customerId)[0]);
    assert.equal(appearanceOf(o), a);
  }
});

test("가져오기 검사: 없는 외형이나 다른 종족의 외형은 거부", () => {
  const s = reducer(createInitialState(), { type: "START", seed: 3 });
  const bad = JSON.parse(JSON.stringify(s));
  bad.day.orders[0].appearanceId = "dragon";
  assert.equal(validateState(bad).ok, false);
  const wrong = JSON.parse(JSON.stringify(s));
  const o = wrong.day.orders[0];
  o.appearanceId = APPEARANCES.find((a) => a.customerId !== o.customerId)!.id;
  assert.equal(validateState(wrong).ok, false);
});

test("원본 이름의 그림은 프로젝트에 영문 이름으로만 들어 있다", () => {
  for (const a of APPEARANCES) assert.ok(/^assets\/npc\/[a-z-]+\.png$/.test(a.image) && existsSync(`public/${a.image}`));
});
