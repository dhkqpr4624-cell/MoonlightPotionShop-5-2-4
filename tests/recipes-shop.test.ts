// 새 레시피 8종·재료 12종 / 손님 등장 일정·말투 / 3재료 판매금 / 상점(편의품·장식) / 저장 v6
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createInitialState, reducer } from "../src/game/reducer.ts";
import { INGREDIENTS } from "../src/data/ingredients.ts";
import { RECIPES } from "../src/data/recipes.ts";
import { classifyProduct, INTRO_STAGES, MAX_INTRO_STAGE } from "../src/data/learningTypes.ts";
import { CUSTOMERS, CUSTOMER_OPEN_DAY, customersForDay } from "../src/data/customers.ts";
import { DIALOGUES } from "../src/data/dialogues.ts";
import { createOrderFromKey, MAX_TRIPLE_PER_DAY, planDay } from "../src/game/orderFactory.ts";
import { percentFor, qualityOf, rewardForOrder } from "../src/game/outcome.ts";
import { availableRecipes, nextGoal, recipeGoals } from "../src/game/unlocks.ts";
import { DECOR_ITEMS, DECOR_SLOTS, GADGETS, priceOf, SHOP_ITEM_IDS } from "../src/data/shop.ts";
import { defaultShop, tryBuy } from "../src/game/shop.ts";
import { loadGame, SAVE_KEY, validateState } from "../src/game/save.ts";
import { buildSaveExport, parseImportText } from "../src/game/transfer.ts";
import { createRng } from "../src/lib/rng.ts";
import { DECOR_FIRST, report, simulate } from "../scripts/balance30.ts";
import type { GameState, Order } from "../src/game/types.ts";
import { closeAndNext, correctAnswer, memoryStorage, NOW, order, playFullDay, roundTrip, run, serveCurrent, wrongAnswer, answerActive } from "./helpers.ts";

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
const NEW = ["coral", "spring", "giant", "hawk", "iron", "storm", "shadow", "sun"];
const ALL_ING = Object.values(INGREDIENTS).filter((i) => !i.legacy).map((i) => i.id);

test("새 레시피 8종: 재료 구성·1병당 양(g)·판매가", () => {
  const table = NEW.map((id) => {
    const r = RECIPES[id];
    return [r.name, r.additives.map((a) => `${a.ingredientId}:${a.amount}`).join(" "), r.pricePerBottle, r.specialPrice];
  });
  assert.deepEqual(table, [
    ["산호빛 해독제", "featherGrass:0.3 lilyStamen:0.15", 6, 24],
    ["회복의 샘물약", "energyHerb:0.5 featherGrass:0.25 lifeSap:1.2", 7, 28],
    ["거인의 활력수", "energyHerb:0.9 ogreSinew:0.75", 6, 24],
    ["매의 눈", "featherGrass:0.7 energyHerb:0.45 sapphireDust:0.2", 7, 28],
    ["강철의 의지", "energyHerb:0.8 sageWalnut:0.65 sapphireDust:1.5", 7, 28],
    ["폭풍의 숨결", "windShard:0.55 coralPowder:1.6 mermaidScale:0.85", 7, 28],
    ["그림자 은신약", "nightBloom:1.4 chameleonTail:0.95 shadowDust:0.24", 7, 28],
    ["태양의 심장", "energyHerb:1.1 dragonScale:0.32 sulfurStone:1.3", 7, 28],
  ]);
  // 기존 두 레시피 값은 그대로
  assert.deepEqual(RECIPES.wind.additives.map((a) => a.amount), ["0.4", "0.35"]);
  const amounts: string[] = [];
  for (const id of ["energy", "wind", ...NEW]) {
    const r = RECIPES[id];
    const own = r.additives.map((a) => a.amount);
    assert.equal(new Set(own).size, own.length, `${r.name}: 한 레시피 안에서 같은 양 없음`);
    for (const a of r.additives) assert.equal(INGREDIENTS[a.ingredientId].unit, "g", "모두 g");
    amounts.push(...own);
    if (NEW.includes(id)) {
      assert.ok(r.effect && r.effect.length > 1, `${r.name}: 효과 문구`);
      assert.ok(r.supports.multiBottle.length > 0 && r.supports.customMultiplier.length > 0);
    }
  }
  assert.equal(new Set(amounts).size, amounts.length, "전체 레시피에서도 같은 양을 되풀이하지 않음");
  const places = amounts.map((a) => (a.split(".")[1] ?? "").length);
  assert.ok(places.includes(1) && places.includes(2), "소수 한 자리·두 자리 섞임");
  // 판매가: 재료 수가 많을수록 같거나 높게, 한 레시피만 튀지 않게
  for (const id of NEW) {
    const r = RECIPES[id];
    assert.equal(r.pricePerBottle, r.additives.length >= 3 ? 7 : 6);
    assert.equal(r.specialPrice, r.pricePerBottle * 4);
  }
});

test("병 그림: 새 포션 8종은 모양·문양 조합이 서로 다르고 기존 포션과도 다르다", () => {
  const key = (id: string) => `${RECIPES[id].look.bottle}/${RECIPES[id].look.emblem}`;
  const keys = ["energy", "wind", ...NEW].map(key);
  assert.equal(new Set(keys).size, keys.length);
  assert.equal(new Set(NEW.map((id) => RECIPES[id].look.bottle)).size >= 5, true, "병 모양 5종 이상");
});

test("재료 12종: 서랍 칸 15개(위 6 · 아래 8 · 왼쪽 그릇 1)에 겹치지 않게, 가격은 해금 순서대로 오른다", () => {
  const drawers = ALL_ING.map((id) => INGREDIENTS[id].drawer);
  assert.deepEqual([...drawers].sort((a, b) => a - b), Array.from({ length: 15 }, (_, i) => i));
  assert.ok(ALL_ING.includes("nightBloom"), "칠흑의 밤꽃 새로 추가");
});

test("다음 목표: 부족한 재료가 가장 적은 레시피부터, 처음엔 거인의 활력수(오거의 힘줄)", () => {
  const g = nextGoal(["energyHerb"]);
  assert.deepEqual(g, { recipeId: "giant", ingredientId: "ogreSinew", missing: ["ogreSinew"] });
  assert.deepEqual(recipeGoals(["energyHerb", "ogreSinew", "featherGrass"]).map((x) => x.recipeId).slice(0, 2), ["wind", "coral"]);
  assert.equal(nextGoal(ALL_ING), null);
});

test("주문 생성: 만들 수 없는 레시피 주문은 없고, 3재료 주문은 하루 2건까지", () => {
  for (let seed = 1; seed <= 200; seed++) {
    const unlocked = seed % 2 ? ["energyHerb", "featherGrass", "windShard", "ogreSinew"] : ALL_ING;
    const usable = new Set(availableRecipes(unlocked).map((r) => r.id));
    const day = 8 + (seed % 20);
    const r = planDay({ dayNumber: day, unlocked, introStage: MAX_INTRO_STAGE, newTypes: [], decks: {}, nextOrderNumber: 1, review: [], rng: createRng(seed) });
    assert.equal(r.orders.length, 5);
    for (const o of r.orders) assert.ok(usable.has(o.recipeId), `${o.recipeId} 는 해금된 레시피`);
    const triple = r.orders.filter((o) => RECIPES[o.recipeId].additives.length === 3).length;
    assert.ok(triple <= MAX_TRIPLE_PER_DAY, `3재료 ${triple}건`);
  }
});

test("손님 등장 일정: 1~2일 여우만, 3일 토끼, 6일 표범, 8일 늑대. 새 손님은 첫날 등장", () => {
  assert.deepEqual(CUSTOMER_OPEN_DAY, { fox: 1, rabbit: 3, cat: 6, wolf: 8 });
  const expect: [number, string[]][] = [[1, ["fox"]], [2, ["fox"]], [3, ["fox", "rabbit"]], [5, ["fox", "rabbit"]], [6, ["fox", "rabbit", "cat"]], [7, ["fox", "rabbit", "cat"]], [8, ["fox", "rabbit", "cat", "wolf"]]];
  for (const [d, ids] of expect) assert.deepEqual(customersForDay(d), ids);
  for (let seed = 1; seed <= 60; seed++) {
    for (const day of [1, 2, 3, 4, 5, 6, 7, 8, 12]) {
      const stage = Math.min(day - 1, MAX_INTRO_STAGE);
      const r = planDay({ dayNumber: day, unlocked: ALL_ING, introStage: stage, newTypes: INTRO_STAGES[stage], decks: {}, nextOrderNumber: 1, review: [], rng: createRng(seed * 7 + day) });
      const ids = r.orders.map((o) => o.customerId);
      for (const id of ids) assert.ok(customersForDay(day).includes(id), `${day}일차에 ${id}`);
      for (const id of Object.keys(CUSTOMER_OPEN_DAY)) if (CUSTOMER_OPEN_DAY[id] === day) assert.ok(ids.includes(id), `${day}일차 첫 등장 ${id}`);
    }
  }
});

const BANNED = /냥|식빵|멍멍|깡총|어흥|크르릉|헐|대박|ㅋ|ㅎㅎ|짱|레알|꿀잼/;

test("말투: 손님 대사·주문 문장에 동물 소리·현대 은어 없음, 손님마다 다른 말투", () => {
  const texts: string[] = [];
  for (const c of Object.values(CUSTOMERS)) {
    texts.push(...c.lines.greet, ...c.lines.waiting, ...c.lines.receive, ...Object.values(c.lines.reaction).flat());
  }
  for (const set of Object.values(DIALOGUES)) for (const v of Object.values(set)) texts.push(...(Array.isArray(v) ? v : [String(v)]));
  for (const t of texts) assert.doesNotMatch(t, BANNED, t);
  assert.equal(new Set(Object.values(CUSTOMERS).map((c) => c.style)).size, 4, "손님 4명 말투가 모두 다름");
  // 실제 주문 문장
  for (let seed = 1; seed <= 150; seed++) {
    const day = 1 + (seed % 14);
    const stage = Math.min(day - 1, MAX_INTRO_STAGE);
    const r = planDay({ dayNumber: day, unlocked: ALL_ING, introStage: stage, newTypes: INTRO_STAGES[stage], decks: {}, nextOrderNumber: 1, review: [], rng: createRng(seed) });
    for (const o of r.orders) for (const t of [o.script.greet, o.script.waiting, o.script.original, o.script.easy]) {
      assert.doesNotMatch(t, BANNED, t);
      assert.doesNotMatch(t, /[{}]|\d가오|\d가입니다|\d가일세/, t);
    }
  }
});

test("'네?' 다시 설명: 처음 주문과 같은 수·조건 (새로 생긴 수는 '1보다'의 1뿐)", () => {
  const nums = (t: string) => new Set(t.match(/\d+(\.\d+)?/g) ?? []);
  let n = 0;
  for (let seed = 1; seed <= 300; seed++) {
    const day = 1 + (seed % 14);
    const stage = Math.min(day - 1, MAX_INTRO_STAGE);
    const r = planDay({ dayNumber: day, unlocked: ALL_ING, introStage: stage, newTypes: INTRO_STAGES[stage], decks: {}, nextOrderNumber: 1, review: [], rng: createRng(seed * 3) });
    for (const o of r.orders) {
      const a = nums(o.script.original), b = nums(o.script.easy);
      for (const x of a) assert.ok(b.has(x), `다시 설명에 ${x} 빠짐: ${o.script.original} / ${o.script.easy}`);
      for (const x of b) assert.ok(a.has(x) || x === "1" || x === "10", `다시 설명에 새 수 ${x}: ${o.script.easy}`);
      n++;
    }
  }
  assert.ok(n >= 1500);
});

test("3재료 판매금: 셋 다 정답 100% · 둘 90% · 하나 75% · 0개 60%, 1~2재료 규칙은 그대로", () => {
  assert.deepEqual(["great", "good", "okay", "poor"].map((q) => percentFor(3, q as never)), [100, 90, 75, 60]);
  assert.deepEqual(["great", "okay", "poor"].map((q) => percentFor(2, q as never)), [100, 80, 60]);
  const o = createOrderFromKey("multiBottle:hawk:4", { orderNumber: 1, customerId: "fox", rng: createRng(1) });
  assert.equal(o.tasks.length, 3);
  assert.equal(o.price, 28);
  const mark = (k: number): Order => ({ ...o, tasks: o.tasks.map((t, i) => ({ ...t, correct: i < k })) });
  assert.deepEqual([3, 2, 1, 0].map((k) => qualityOf(mark(k))), ["great", "good", "okay", "poor"]);
  assert.deepEqual([3, 2, 1, 0].map((k) => rewardForOrder(mark(k), qualityOf(mark(k)))), [28, 25, 21, 16], "기존 규칙대로 소수점 아래는 버림");
});

/** 해금된 3재료 레시피 주문으로 제조 시작 */
function tripleBrewing(key = "multiBottle:hawk:3"): GameState {
  let s = run({ ...createInitialState(), unlockedIngredients: ["energyHerb", "featherGrass", "sapphireDust"] }, { type: "START", seed: 5 });
  s = reducer(s, { type: "ACK_INTRO", dayNumber: 1 });
  const first = s.day!.orders[0];
  const o: Order = { ...createOrderFromKey(key, { orderNumber: Number(first.id.slice(6)), customerId: first.customerId, rng: createRng(2) }), status: "arrived" };
  s = { ...s, day: { ...s.day!, orders: [o, ...s.day!.orders.slice(1)] } };
  return reducer(s, { type: "ACCEPT_ORDER", orderId: o.id });
}

test("3재료 제조: 셋 다 넣기 전엔 젓기·병 담기 불가, 다 넣으면 완성·판매금 지급(한 번만)", () => {
  let s = tripleBrewing();
  const o = order(s);
  for (let i = 0; i < 2; i++) {
    s = reducer(s, { type: "PLACE_INGREDIENT", orderId: o.id, taskIndex: i });
    s = answerActive(s, i === 1 ? wrongAnswer(order(s).tasks[i]) : correctAnswer(order(s).tasks[i]));
    s = reducer(s, { type: "ADD_TO_CAULDRON", orderId: o.id, taskIndex: i });
  }
  const before = s;
  s = reducer(s, { type: "STIR", orderId: o.id, amount: 25 });
  assert.equal(order(s).stirProgress, 0, "재료 하나가 남으면 젓기 안 됨");
  s = reducer(s, { type: "COMPLETE_POTION", orderId: o.id });
  assert.equal(order(s).status, order(before).status, "병에 담기 안 됨");
  s = reducer(s, { type: "PLACE_INGREDIENT", orderId: o.id, taskIndex: 2 });
  s = answerActive(s, correctAnswer(order(s).tasks[2]));
  s = reducer(s, { type: "ADD_TO_CAULDRON", orderId: o.id, taskIndex: 2 });
  for (let k = 0; k < 4; k++) s = reducer(s, { type: "STIR", orderId: o.id, amount: 25 });
  s = run(s, { type: "COMPLETE_POTION", orderId: o.id }, { type: "COMPLETE_POTION", orderId: o.id });
  assert.equal(order(s).quality, "good");
  assert.equal(order(s).reward, 0, "하나라도 틀리면 판매금 0");
  assert.equal(order(s).penalty, 7, "정상가 21 ÷ 3 = 7");
  const m0 = s.money;
  s = run(s, { type: "GO_COUNTER" }, { type: "DELIVER", orderId: o.id, now: NOW }, { type: "DELIVER", orderId: o.id, now: NOW });
  assert.equal(s.money, m0 - 7, "보상금은 한 번만");
});

test("재료 구매 → 레시피 해금 안내 → 오늘 주문은 그대로, 다음 날 새 레시피 주문 1건 이상", () => {
  let s = run(createInitialState(), { type: "START", seed: 21 });
  s = playFullDay(s);
  s = { ...s, money: 500 };
  const today = roundTrip(s.day!.orders);
  s = reducer(s, { type: "UNLOCK_INGREDIENT", ingredientId: "ogreSinew" });
  assert.equal(s.money, 370);
  assert.deepEqual(s.recipeNotices, ["giant"]);
  assert.deepEqual(s.day!.orders, today, "오늘 주문 안 바뀜");
  s = reducer(s, { type: "ACK_RECIPE_NOTICE", recipeId: "giant" });
  s = closeAndNext(s, 33);
  assert.ok(s.day!.orders.some((o) => o.recipeId === "giant"), "다음 날 거인의 활력수 주문");
  assert.deepEqual(s.featuredRecipes, []);
});

test("상점: 구매·돈 부족·두 번 사기·장착(보유만)·다시 장착 무료·편의품 켜고 끄기", () => {
  assert.equal(SHOP_ITEM_IDS.length, 2 + 18);
  assert.ok(!SHOP_ITEM_IDS.some((id) => /village/.test(id)), "마을 배경은 상품이 아님");
  assert.deepEqual(DECOR_SLOTS.map((slot) => DECOR_ITEMS.filter((d) => d.slot === slot).map((d) => d.price)), [
    [0, 120, 160, 200, 250, 300, 350], [0, 140, 180, 230, 280, 330, 380], [0, 130, 170, 220, 270, 320, 370],
  ]);
  assert.deepEqual(GADGETS.map((g) => [g.id, g.price]), [["glasses", 150], ["autoCauldron", 220]]);
  assert.deepEqual(tryBuy(100, defaultShop(), "counter:royal"), { ok: false, reason: "insufficient" });
  assert.deepEqual(tryBuy(999, defaultShop(), "counter:basic"), { ok: false, reason: "notForSale" });
  assert.deepEqual(tryBuy(999, defaultShop(), "village"), { ok: false, reason: "unknown" });

  let s = { ...run(createInitialState(), { type: "START", seed: 3 }), money: 400 };
  s = reducer(s, { type: "EQUIP_DECOR", slot: "wall", theme: "tree" });
  assert.equal(s.shop.equipped.wall, "basic", "안 산 장식은 장착 안 됨");
  s = run(s, { type: "BUY_ITEM", itemId: "wall:tree" }, { type: "BUY_ITEM", itemId: "wall:tree" });
  assert.equal(s.money, 400 - 180, "두 번 눌러도 한 번만 결제");
  assert.deepEqual(s.shop.owned, ["wall:tree"]);
  s = run(s, { type: "EQUIP_DECOR", slot: "wall", theme: "tree" }, { type: "EQUIP_DECOR", slot: "wall", theme: "basic" }, { type: "EQUIP_DECOR", slot: "wall", theme: "tree" });
  assert.equal(s.shop.equipped.wall, "tree");
  assert.equal(s.money, 220, "다시 장착은 무료");
  s = reducer(s, { type: "SET_GADGET", id: "glasses", on: true });
  assert.equal(s.shop.toggles.glasses, false, "안 산 편의품은 켤 수 없음");
  s = run(s, { type: "BUY_ITEM", itemId: "glasses" });
  assert.equal(s.money, 70);
  assert.equal(s.shop.toggles.glasses, true, "사면 바로 켜짐");
  s = reducer(s, { type: "SET_GADGET", id: "glasses", on: false });
  assert.equal(s.shop.toggles.glasses, false);
  s = reducer(s, { type: "BUY_ITEM", itemId: "autoCauldron" });
  assert.equal(s.money, 70, "돈 부족");
  assert.ok(!s.shop.owned.includes("autoCauldron"));
  // 계량 중에는 살 수 없음
  let b = tripleBrewing();
  b = { ...b, money: 999 };
  b = reducer(b, { type: "PLACE_INGREDIENT", orderId: order(b).id, taskIndex: 0 });
  assert.notEqual(b.activeTask, null);
  assert.equal(reducer(b, { type: "BUY_ITEM", itemId: "glasses" }).money, 999);
  // 상점 상품은 재료 해금과 무관
  assert.deepEqual(s.unlockedIngredients, ["energyHerb"]);
  for (const id of SHOP_ITEM_IDS) assert.ok((priceOf(id) ?? 0) > 0);
});

test("저장 v6: 상점 상태 검사 (안 산 장식 장착·안 산 편의품 켜짐·모르는 상품 거부)", () => {
  const base = { ...run(createInitialState(), { type: "START", seed: 3 }), money: 500 };
  const s = run(base, { type: "BUY_ITEM", itemId: "bench:deep" }, { type: "EQUIP_DECOR", slot: "bench", theme: "deep" }, { type: "BUY_ITEM", itemId: "autoCauldron" });
  assert.ok(validateState(roundTrip(s)).ok);
  const bad = (shop: unknown) => validateState({ ...roundTrip(s), shop }).ok;
  assert.equal(bad({ ...s.shop, equipped: { ...s.shop.equipped, wall: "galaxy" } }), false);
  assert.equal(bad({ ...s.shop, toggles: { ...s.shop.toggles, glasses: true } }), false);
  assert.equal(bad({ ...s.shop, owned: [...s.shop.owned, "wall:village"] }), false);
  assert.equal(bad({ ...s.shop, owned: [...s.shop.owned, "bench:deep"] }), false, "중복");
  const exp = parseImportText(JSON.stringify(buildSaveExport(s, NOW)), 1);
  assert.ok(exp.ok);
  if (exp.ok) assert.deepEqual(exp.state.shop, s.shop, "내보내기·가져오기에 상점 상태 포함");
});

test("v5 저장(실제 직전 버전 코드로 만든 3일차 계량 중) → v6: 진행·돈·재료·기록 보존, 장식은 기본·구매 내역 없음", () => {
  const raw = fixture("v5-midmeasure.json");
  const v5 = JSON.parse(raw);
  assert.equal(v5.saveVersion, 5);
  const store = memoryStorage();
  store.setItem(SAVE_KEY, raw);
  const l = loadGame(1, store);
  assert.equal(l.kind, "ok", l.kind === "error" ? l.errors.join(",") : "");
  if (l.kind !== "ok") return;
  const s = l.state;
  assert.equal(l.migratedFrom, 5);
  assert.equal(store.mem.get("moonlight-potion-shop/backup-v5"), raw, "원본 백업");
  assert.equal(s.saveVersion, 9);
  for (const k of ["scene", "money", "unlockedIngredients", "day", "draftAnswer", "activeTask", "problemLog", "review", "paidOrderIds", "dayHistory", "decks", "recipeNotices"]) {
    assert.deepEqual((s as unknown as Record<string, unknown>)[k], v5[k], k);
  }
  assert.deepEqual(s.shop, defaultShop());
  assert.deepEqual(s.shop.equipped, { counter: "basic", wall: "basic", bench: "basic" });
  // 이어서 하루를 끝까지
  let t = s;
  for (let i = 0; i < 4; i++) {
    t = serveCurrent(t);
    t = reducer(t, { type: "NEXT_CUSTOMER", fromOrderId: order(t).id });
  }
  t = serveCurrent(t);
  assert.equal(t.paidOrderIds.length, v5.paidOrderIds.length + 5);
});

test("균형(보상금 규칙): 모두 정답이면 약 30일에 새 레시피 모두 해금(이전과 같음), 보통 플레이도 새 레시피가 열림 — 전체 해금은 늦어짐(보고서 참고)", () => {
  const med = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  const runs = (p: number, first: string[] = []) => Array.from({ length: 40 }, (_, i) => simulate(p, i + 1, 45, [...first]));
  const allDay = (rs: ReturnType<typeof runs>) => med(rs.map((r) => Math.max(...NEW.map((id) => r.unlockDay[id] ?? 99))));
  const firstDay = (rs: ReturnType<typeof runs>) => med(rs.map((r) => Math.min(...NEW.map((id) => r.unlockDay[id] ?? 99))));
  const perfect = allDay(runs(1));
  assert.ok(perfect >= 24 && perfect <= 32, `모두 정답 ${perfect}일`);
  const mixed = runs(0.75);
  assert.ok(firstDay(mixed) <= 10, `섞임: 첫 새 레시피 ${firstDay(mixed)}일`);
  const countBy30 = med(mixed.map((r) => NEW.filter((id) => (r.unlockDay[id] ?? 99) <= 30).length));
  assert.ok(countBy30 >= 4, `섞임: 30일까지 새 레시피 ${countBy30}종`);
  assert.ok(firstDay(runs(0.75, DECOR_FIRST)) <= 15, "상점 상품을 먼저 사도 새 레시피가 열림");
  assert.ok(typeof report === "function");
});
