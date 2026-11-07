/**
 * 재료 데이터. 액체 첨가물은 mL, 가루·약초 첨가물은 g 으로 통일한다.
 *
 * 해금(unlock)
 *  - 재료는 돈으로 '사용 권한'을 한 번 사면 계속 쓸 수 있다(재고·소모품이 아님).
 *  - unlockCost가 0이면 처음부터 해금된 무료 재료다.
 *  - legacy 재료는 이전 버전 레시피(별빛·용기·새싹·안개) 전용이다. 진행 중이던 하루를 마칠 때만 쓰고,
 *    재료 해금 메뉴에 팔지 않는다.
 *
 * drawer: 제작대 재료 칸 번호(data/shopArt.ts WORKBENCH_SCENE.drawers). 0이 맨 왼쪽 위.
 *   위 6칸(0~5) · 아래 8칸(6~13) · 왼쪽 빈 그릇(14) = 15칸. 재료 15종이 한 칸씩 쓴다.
 *   이전 버전 재료(달빛 이슬·별가루)는 진행 중이던 이전 주문을 마치는 동안만 12·13번 칸에 잠시 놓인다(그동안 그 칸의 재료는 숨김).
 *
 * 해금 가격 근거: scripts/balance30.ts 로 실제 출제기·판매가·품질 규칙을 써서 30일 영업을 흉내 낸 결과
 *   (docs/RECIPES_SHOP_REPORT.md '30일 밸런스'). 다음 구매 목표는 '필요한 미보유 재료가 가장 적은 레시피'.
 */
export type Unit = "mL" | "g";
export type IngredientKind = "liquid" | "powder" | "herb" | "crystal" | "flower" | "scale" | "stone" | "extract";

export interface Ingredient {
  id: string;
  name: string;
  unit: Unit;
  kind: IngredientKind;
  /** 액체에 섞일 때의 색 */
  color: string;
  description: string;
  /** 제작대 서랍 번호 */
  drawer: number;
  /** 해금 비용(달빛 동전). 0이면 처음부터 해금 */
  unlockCost: number;
  /** 이전 버전 레시피 전용(구매 메뉴에 없음) */
  legacy?: boolean;
  /** 최종 그림이 생기면 public/ 아래 경로를 넣는다. 없으면 코드 그림 사용. */
  image?: string;
}

export const INGREDIENTS: Record<string, Ingredient> = {
  energyHerb: {
    id: "energyHerb",
    name: "기력초",
    unit: "g",
    kind: "herb",
    color: "#5fd39a",
    description: "달빛을 받으며 자란, 기운을 북돋는 연둣빛 약초",
    drawer: 0,
    unlockCost: 0,
  },
  featherGrass: {
    id: "featherGrass",
    name: "깃털풀",
    unit: "g",
    kind: "herb",
    color: "#b9e88a",
    description: "깃털처럼 가볍고 길게 갈라진 잎을 가진 연녹색 풀",
    drawer: 1,
    unlockCost: 70,
  },
  windShard: {
    id: "windShard",
    name: "바람 정령의 파편",
    unit: "g",
    kind: "crystal",
    color: "#7fe0e6",
    description: "바람 정령이 지나간 자리에 남은, 가볍고 투명한 청록빛 결정",
    drawer: 2,
    unlockCost: 110,
  },
  ogreSinew: { id: "ogreSinew", name: "오거의 힘줄 추출물", unit: "g", kind: "extract", color: "#8a9a3a", description: "오거의 질긴 힘줄을 달여 짜낸 올리브빛 추출물", drawer: 3, unlockCost: 130 },
  lilyStamen: { id: "lilyStamen", name: "은백합 꽃술", unit: "g", kind: "flower", color: "#f4f0d8", description: "은빛 백합 가운데에서 모은 금빛 꽃술", drawer: 4, unlockCost: 150 },
  lifeSap: { id: "lifeSap", name: "생명의 나무 수액", unit: "g", kind: "extract", color: "#e8a640", description: "오래된 생명의 나무에서 흘러나온 호박빛 수액", drawer: 5, unlockCost: 190 },
  sapphireDust: { id: "sapphireDust", name: "푸른 사파이어 가루", unit: "g", kind: "powder", color: "#3d6fe0", description: "푸른 사파이어를 곱게 간 반짝이는 가루", drawer: 6, unlockCost: 240 },
  sageWalnut: { id: "sageWalnut", name: "현자의 호두껍질 가루", unit: "g", kind: "powder", color: "#9a6a3c", description: "현자의 숲 호두나무 껍질을 말려 빻은 가루", drawer: 7, unlockCost: 260 },
  coralPowder: { id: "coralPowder", name: "심해 산호 가루", unit: "g", kind: "powder", color: "#ff8f9e", description: "깊은 바다 산호를 곱게 간 분홍빛 가루", drawer: 8, unlockCost: 290 },
  mermaidScale: { id: "mermaidScale", name: "인어의 비늘", unit: "g", kind: "scale", color: "#5fd6c8", description: "물결빛이 도는 얇고 투명한 인어의 비늘", drawer: 9, unlockCost: 310 },
  dragonScale: { id: "dragonScale", name: "붉은 용의 비늘 가루", unit: "g", kind: "powder", color: "#d8402c", description: "붉은 용이 벗어 둔 비늘을 빻은 뜨거운 가루", drawer: 10, unlockCost: 340 },
  sulfurStone: { id: "sulfurStone", name: "화산 유황석", unit: "g", kind: "stone", color: "#e8c53a", description: "화산 곁에서 캐낸, 노랗게 빛나는 유황 돌", drawer: 11, unlockCost: 360 },
  nightBloom: { id: "nightBloom", name: "칠흑의 밤꽃", unit: "g", kind: "flower", color: "#3a2450", description: "달 없는 밤에만 피는 칠흑빛 꽃잎", drawer: 12, unlockCost: 340 },
  chameleonTail: { id: "chameleonTail", name: "카멜레온 도마뱀의 꼬리 진액", unit: "g", kind: "extract", color: "#7ac47a", description: "보는 쪽에 따라 빛깔이 바뀌는 끈끈한 진액", drawer: 13, unlockCost: 360 },
  shadowDust: { id: "shadowDust", name: "그림자 정령의 가루", unit: "g", kind: "powder", color: "#4a3a66", description: "그림자 정령이 지나간 자리에 남은 보랏빛 검은 가루", drawer: 14, unlockCost: 380 },
  moonDew: {
    id: "moonDew",
    name: "달빛 이슬",
    unit: "mL",
    kind: "liquid",
    color: "#8fd3ff",
    description: "보름달 아래 풀잎에 맺힌 푸른 이슬",
    drawer: 12,
    unlockCost: 0,
    legacy: true,
  },
  starDust: {
    id: "starDust",
    name: "별가루",
    unit: "g",
    kind: "powder",
    color: "#ffe27a",
    description: "떨어진 별똥별에서 모은 반짝이는 가루",
    drawer: 13,
    unlockCost: 0,
    legacy: true,
  },
};

export function getIngredient(id: string): Ingredient {
  const found = INGREDIENTS[id];
  if (!found) throw new Error(`알 수 없는 재료: ${id}`);
  return found;
}
