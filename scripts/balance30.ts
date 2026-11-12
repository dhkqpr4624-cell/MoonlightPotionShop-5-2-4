/**
 * 30일 밸런스 시뮬레이션 (실제 출제기·판매가·품질 규칙·해금 데이터를 그대로 사용).
 * 실행: node scripts/balance30.ts [반복 횟수=200]
 *
 * 가정
 *  - 하루 손님 5명을 모두 응대하고, 학습 유형 소개는 영업을 마칠 때마다 한 단계씩 진행(게임과 같음)
 *  - 정답 여부: 재료 과제마다 정답 확률 p (모두 정답 1.0 / 섞임 0.75 / 오답 많음 0.35)
 *  - 구매: 영업을 마칠 때마다 '필요한 미보유 재료가 가장 적은 잠긴 레시피'의 가장 싼 미보유 재료부터,
 *    돈이 되는 만큼 산다(게임의 레시피북 '다음 목표'와 같은 순서). 장식·편의품은 사지 않는다.
 *  - 수입은 저장 버전 9 정산(판매금 − 피해 보상금)으로 센다. 하루 수입이 음수일 수 있다.
 *  - 새로 열린 레시피는 다음 영업부터 주문 후보 + 첫 주문 1건(게임과 같음). 복습 주문은 생략.
 */
import { INGREDIENTS } from "../src/data/ingredients.ts";
import { RECIPES } from "../src/data/recipes.ts";
import { INTRO_STAGES, MAX_INTRO_STAGE } from "../src/data/learningTypes.ts";
import { planDay } from "../src/game/orderFactory.ts";
import { qualityOf, settleOrder } from "../src/game/outcome.ts";
import { availableRecipes, newlyAvailableRecipes, nextGoal } from "../src/game/unlocks.ts";
import { createRng } from "../src/lib/rng.ts";
import { priceOf } from "../src/data/shop.ts";
import type { DeckState } from "../src/lib/deck.ts";

const NEW_RECIPES = Object.values(RECIPES).filter((r) => !r.legacy && r.id !== "energy" && r.id !== "wind").map((r) => r.id);

export interface RunResult {
  unlockDay: Record<string, number>; income: number[]; money: number[];
  /** 일차별 문제은행 사용: 문제은행 주문 수 / 생성기로 채운 일반 자리 수 / 난이도 대체 수 / 난이도별 문항 수 */
  bank: { bank: number; fallback: number; adjusted: number; diff: Record<string, number> }[];
}

/** 장식·편의품을 재료보다 먼저 사는 경우 (살 수 있으면 이 순서로 먼저 산다) */
export const DECOR_FIRST = ["glasses", "autoCauldron", "counter:royal", "wall:royal", "bench:royal"];

export function simulate(p: number, seed: number, days = 45, shopFirst: string[] = [], useBank = true): RunResult {
  const rng = createRng(seed);
  let unlocked = ["energyHerb"];
  let money = 0;
  let decks: Record<string, DeckState> = {};
  let next = 1;
  let featured: string[] = [];
  const unlockDay: Record<string, number> = {};
  const income: number[] = [];
  const moneyLog: number[] = [];
  const bankLog: RunResult["bank"] = [];
  for (let day = 1; day <= days; day++) {
    const stage = Math.min(day - 1, MAX_INTRO_STAGE);
    const prev = day === 1 ? null : Math.min(day - 2, MAX_INTRO_STAGE);
    const r = planDay({
      dayNumber: day, unlocked, introStage: stage, newTypes: prev !== null && prev >= stage ? [] : INTRO_STAGES[stage],
      decks, nextOrderNumber: next, review: [], rng: createRng(seed * 1000 + day), featureRecipes: featured, useBank,
    });
    decks = r.decks; next = r.nextOrderNumber;
    const diff: Record<string, number> = { 하: 0, 중: 0, 상: 0 };
    for (const o of r.orders) if (o.bank) diff[o.bank.difficulty]++;
    bankLog.push({ ...r.bankStats, diff });
    featured = featured.filter((f) => !r.featured.includes(f));
    let earned = 0;
    for (const o of r.orders) {
      const done = { ...o, tasks: o.tasks.map((t) => ({ ...t, correct: rng() < p })) };
      // 저장 버전 9 정산: 정확하면 판매금, 하나라도 틀리면 판매금 0 − 보상금(정상가 ÷ 3)
      const st = settleOrder(done, qualityOf(done));
      earned += st.reward - st.penalty;
    }
    money += earned;
    income.push(earned);
    // 영업 마감 후 구매 (상점 상품을 먼저 사는 경우 그것부터)
    while (shopFirst.length > 0 && money >= (priceOf(shopFirst[0]) ?? Infinity)) {
      money -= priceOf(shopFirst[0])!;
      shopFirst = shopFirst.slice(1);
    }
    for (;;) {
      const goal = nextGoal(unlocked);
      if (!goal) break;
      const cost = INGREDIENTS[goal.ingredientId].unlockCost;
      if (money < cost) break;
      money -= cost;
      const after = [...unlocked, goal.ingredientId];
      for (const id of newlyAvailableRecipes(unlocked, after)) { unlockDay[id] = day + 1; featured.push(id); }
      unlocked = after;
    }
    moneyLog.push(money);
  }
  return { unlockDay, income, money: moneyLog, bank: bankLog };
}

function median(xs: number[]): number { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; }
function pct(xs: number[], q: number): number { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(s.length * q))]; }

export function report(runs = 200) {
  const out: Record<string, unknown> = {};
  for (const [label, p, first] of [
    ["모두 정답", 1, []], ["정답·오답 섞임(75%)", 0.75, []], ["오답 많음(35%)", 0.35, []],
    ["섞임(75%) + 상점 상품 5개(760) 먼저 구매", 0.75, DECOR_FIRST],
  ] as const) {
    const res = Array.from({ length: runs }, (_, i) => simulate(p, i + 1, 45, [...first]));
    const dayOf = (r: RunResult, id: string) => r.unlockDay[id] ?? 99;
    const allNew = (r: RunResult) => Math.max(...NEW_RECIPES.map((id) => dayOf(r, id)));
    const firstNew = (r: RunResult) => Math.min(...NEW_RECIPES.map((id) => dayOf(r, id)));
    const wind = (r: RunResult) => dayOf(r, "wind");
    const mid = (r: RunResult) => [...NEW_RECIPES.map((id) => dayOf(r, id))].sort((a, b) => a - b)[3];
    const perRecipe = Object.fromEntries(["wind", ...NEW_RECIPES].map((id) => [RECIPES[id].name, median(res.map((r) => dayOf(r, id)))]));
    out[label] = {
      "바람 걸음(기존)": median(res.map(wind)),
      "첫 새 레시피": median(res.map(firstNew)),
      "중간(새 레시피 4번째)": median(res.map(mid)),
      "전체(새 레시피 8종)": `${median(res.map(allNew))}일 (하위 10% ${pct(res.map(allNew), 0.1)} ~ 상위 10% ${pct(res.map(allNew), 0.9)})`,
      "레시피별 해금 일차(중앙값)": perRecipe,
      "하루 수입 중앙값(1·10·20·30일차)": [0, 9, 19, 29].map((d) => median(res.map((r) => r.income[d]))),
    };
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(JSON.stringify(report(Number(process.argv[2] ?? 200)), null, 2));
}
