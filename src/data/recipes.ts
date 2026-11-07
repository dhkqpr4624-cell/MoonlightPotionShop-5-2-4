/**
 * 고정 레시피. '포션 1병당' 첨가물 양이며 주문마다 바꾸지 않는다.
 * 포션 = 기본 용액(자동 투입) + 마법 첨가물(학생이 계량).
 * 첨가물의 합은 병 전체 용량이 아니다.
 *
 * 레시피 해금: 레시피를 따로 사지 않는다. 필요한 재료(첨가물 재료 ID 전부)를 모두 해금하면 쓸 수 있다
 * (game/unlocks.ts). legacy 레시피는 이전 버전 주문을 마칠 때만 쓰고 새 주문에는 나오지 않는다.
 */
import type { LearningTypeId } from "./learningTypes.ts";

export interface RecipeAdditive {
  ingredientId: string;
  /** 1병당 양. 정확한 십진 문자열 */
  amount: string;
}

export interface PotionLook {
  liquid: string;
  glow: string;
  particle: "star" | "leaf" | "mist" | "spark" | "bubble" | "ember" | "glint" | "shade";
  bottle: "round" | "tall" | "flask" | "drop" | "heart" | "jug" | "vial" | "gourd" | "diamond";
  /** 라벨 문양 */
  emblem: "star" | "flame" | "leaf" | "cloud" | "drop" | "heart" | "fist" | "eye" | "shield" | "wave" | "moon" | "sun";
}

export interface Recipe {
  id: string;
  name: string;
  baseSolution: { name: string; amountMl: string };
  additives: RecipeAdditive[];
  look: PotionLook;
  lookText: string;
  /** 손님 반응에 쓰는 빛깔 이름 (예: "별빛") */
  glowWord: string;
  /** 여러 병 주문 1병 판매 가격(달빛 동전) */
  pricePerBottle: number;
  /** 맞춤 배수·손님 지정량(기준 양)·생활 소재·비교 주문 1건의 정상 판매가 */
  specialPrice: number;
  /** 이 레시피로 낼 수 있는 학습 유형 (데이터 검증 테스트가 실제 기본량과 맞는지 확인한다) */
  supports: { multiBottle: LearningTypeId[]; customMultiplier: LearningTypeId[] };
  /** 짧은 소개 (레시피북에 표시) */
  summary: string;
  /** 이전 버전 레시피(새 주문에 나오지 않음, 저장 호환용) */
  legacy?: boolean;
  /** 효과 (레시피북·손님 대사에 쓰는 짧은 말, 예: "해독과 정화") */
  effect?: string;
}

export const RECIPES: Record<string, Recipe> = {
  energy: {
    id: "energy",
    name: "기력 포션",
    baseSolution: { name: "맑은 기본 용액", amountMl: "30" },
    additives: [{ ingredientId: "energyHerb", amount: "0.6" }],
    look: { liquid: "#3fc79a", glow: "#c9f7da", particle: "leaf", bottle: "round", emblem: "leaf" },
    lookText: "연둣빛 액체 속에서 작은 잎 조각이 반짝여요",
    glowWord: "연둣빛",
    pricePerBottle: 5,
    specialPrice: 20,
    supports: { multiBottle: ["d1xN"], customMultiplier: ["d1xD"] },
    summary: "지친 몸에 기운을 북돋아 주는 포션이에요.",
    effect: "기운 회복",
  },
  /**
   * 바람 걸음 포션: 깃털풀(소수 한 자리) + 바람 정령의 파편(소수 두 자리).
   *  여러 병 주문 → ① 0.4 × n, ② 0.35 × n / 맞춤 배수 → ⑤ 0.4 × 0.○, ⑥ 0.35 × 0.○
   *  판매가: 계량 문제가 2개라 기력 포션보다 20% 높게 (1병 6, 특별 주문 24)
   */
  wind: {
    id: "wind",
    name: "바람 걸음 포션",
    baseSolution: { name: "맑은 기본 용액", amountMl: "30" },
    additives: [
      { ingredientId: "featherGrass", amount: "0.4" },
      { ingredientId: "windShard", amount: "0.35" },
    ],
    look: { liquid: "#5fd0e0", glow: "#d8fbff", particle: "mist", bottle: "tall", emblem: "cloud" },
    lookText: "하늘빛 액체 속에서 작은 바람 소용돌이가 일어요",
    glowWord: "하늘빛",
    pricePerBottle: 6,
    specialPrice: 24,
    supports: { multiBottle: ["d1xN", "d2xN"], customMultiplier: ["d1xD", "d2xD"] },
    summary: "발걸음을 바람처럼 가볍게 해 주는 포션이에요.",
    effect: "가벼운 발걸음",
  },
  coral: {
    id: "coral",
    name: "산호빛 해독제",
    baseSolution: { name: "맑은 기본 용액", amountMl: "30" },
    additives: [
      { ingredientId: "featherGrass", amount: "0.3" },
      { ingredientId: "lilyStamen", amount: "0.15" },
    ],
    look: { liquid: "#ff8fa3", glow: "#ffd3dc", particle: "bubble", bottle: "flask", emblem: "drop" },
    lookText: "산호빛 액체에 작은 물방울이 맑게 떠올라요",
    glowWord: "산호빛",
    pricePerBottle: 6,
    specialPrice: 24,
    supports: { multiBottle: ["d1xN", "d2xN"], customMultiplier: ["d1xD", "d2xD"] },
    summary: "몸에 든 독을 풀고 맑게 정화해 주는 해독제예요.",
    effect: "해독과 정화",
  },
  spring: {
    id: "spring",
    name: "회복의 샘물약",
    baseSolution: { name: "맑은 기본 용액", amountMl: "30" },
    additives: [
      { ingredientId: "energyHerb", amount: "0.5" },
      { ingredientId: "featherGrass", amount: "0.25" },
      { ingredientId: "lifeSap", amount: "1.2" },
    ],
    look: { liquid: "#a8e05f", glow: "#e6ffc2", particle: "leaf", bottle: "heart", emblem: "heart" },
    lookText: "연두빛 샘물 속에서 새잎이 돋듯 반짝여요",
    glowWord: "샘물빛",
    pricePerBottle: 7,
    specialPrice: 28,
    supports: { multiBottle: ["d1xN", "d2xN"], customMultiplier: ["d1xD", "d2xD"] },
    summary: "다친 곳을 빠르게 아물게 하는 응급 재생약이에요.",
    effect: "응급 재생",
  },
  giant: {
    id: "giant",
    name: "거인의 활력수",
    baseSolution: { name: "맑은 기본 용액", amountMl: "30" },
    additives: [
      { ingredientId: "energyHerb", amount: "0.9" },
      { ingredientId: "ogreSinew", amount: "0.75" },
    ],
    look: { liquid: "#c9772f", glow: "#ffd2a0", particle: "spark", bottle: "jug", emblem: "fist" },
    lookText: "구릿빛 액체가 묵직하게 출렁여요",
    glowWord: "구릿빛",
    pricePerBottle: 6,
    specialPrice: 24,
    supports: { multiBottle: ["d1xN", "d2xN"], customMultiplier: ["d1xD", "d2xD"] },
    summary: "무거운 짐도 거뜬히 들게 힘을 북돋는 활력수예요.",
    effect: "근력과 중량 강화",
  },
  hawk: {
    id: "hawk",
    name: "매의 눈",
    baseSolution: { name: "맑은 기본 용액", amountMl: "30" },
    additives: [
      { ingredientId: "featherGrass", amount: "0.7" },
      { ingredientId: "energyHerb", amount: "0.45" },
      { ingredientId: "sapphireDust", amount: "0.2" },
    ],
    look: { liquid: "#f2c94c", glow: "#fff1b8", particle: "glint", bottle: "vial", emblem: "eye" },
    lookText: "금빛 액체 속에서 날카로운 빛이 번뜩여요",
    glowWord: "금빛",
    pricePerBottle: 7,
    specialPrice: 28,
    supports: { multiBottle: ["d1xN", "d2xN"], customMultiplier: ["d1xD", "d2xD"] },
    summary: "먼 곳까지 또렷하게 보이고 겨눈 곳을 놓치지 않게 해 줘요.",
    effect: "시야와 명중률 강화",
  },
  iron: {
    id: "iron",
    name: "강철의 의지",
    baseSolution: { name: "맑은 기본 용액", amountMl: "30" },
    additives: [
      { ingredientId: "energyHerb", amount: "0.8" },
      { ingredientId: "sageWalnut", amount: "0.65" },
      { ingredientId: "sapphireDust", amount: "1.5" },
    ],
    look: { liquid: "#6f86d6", glow: "#cdd8ff", particle: "glint", bottle: "gourd", emblem: "shield" },
    lookText: "강철빛 푸른 액체가 단단하게 빛나요",
    glowWord: "강철빛",
    pricePerBottle: 7,
    specialPrice: 28,
    supports: { multiBottle: ["d1xN", "d2xN"], customMultiplier: ["d1xD", "d2xD"] },
    summary: "흔들리지 않게 마음을 붙잡아 주고 혼란을 막아 줘요.",
    effect: "정신 집중과 혼란 저항",
  },
  storm: {
    id: "storm",
    name: "폭풍의 숨결",
    baseSolution: { name: "맑은 기본 용액", amountMl: "30" },
    additives: [
      { ingredientId: "windShard", amount: "0.55" },
      { ingredientId: "coralPowder", amount: "1.6" },
      { ingredientId: "mermaidScale", amount: "0.85" },
    ],
    look: { liquid: "#2f9fd6", glow: "#bfeaff", particle: "bubble", bottle: "drop", emblem: "wave" },
    lookText: "짙푸른 액체 속에서 거품이 소용돌이쳐요",
    glowWord: "바닷빛",
    pricePerBottle: 7,
    specialPrice: 28,
    supports: { multiBottle: ["d1xN", "d2xN"], customMultiplier: ["d1xD", "d2xD"] },
    summary: "물속에서도 숨을 쉬고 거센 물살을 견디게 해 줘요.",
    effect: "수중 호흡과 저항",
  },
  shadow: {
    id: "shadow",
    name: "그림자 은신약",
    baseSolution: { name: "맑은 기본 용액", amountMl: "30" },
    additives: [
      { ingredientId: "nightBloom", amount: "1.4" },
      { ingredientId: "chameleonTail", amount: "0.95" },
      { ingredientId: "shadowDust", amount: "0.24" },
    ],
    look: { liquid: "#5a3f8f", glow: "#cbb8f0", particle: "shade", bottle: "diamond", emblem: "moon" },
    lookText: "보랏빛 어둠이 병 안에서 일렁여요",
    glowWord: "어스름빛",
    pricePerBottle: 7,
    specialPrice: 28,
    supports: { multiBottle: ["d1xN", "d2xN"], customMultiplier: ["d1xD", "d2xD"] },
    summary: "몸의 윤곽을 흐릿하게 만들어 그림자 속에 숨게 해 줘요.",
    effect: "형체 흐리기",
  },
  sun: {
    id: "sun",
    name: "태양의 심장",
    baseSolution: { name: "맑은 기본 용액", amountMl: "30" },
    additives: [
      { ingredientId: "energyHerb", amount: "1.1" },
      { ingredientId: "dragonScale", amount: "0.32" },
      { ingredientId: "sulfurStone", amount: "1.3" },
    ],
    look: { liquid: "#e8462f", glow: "#ffc59a", particle: "ember", bottle: "round", emblem: "sun" },
    lookText: "붉은 액체 속에서 작은 불씨가 피어올라요",
    glowWord: "불꽃빛",
    pricePerBottle: 7,
    specialPrice: 28,
    supports: { multiBottle: ["d1xN", "d2xN"], customMultiplier: ["d1xD", "d2xD"] },
    summary: "불길과 혹독한 추위를 함께 견디게 해 주는 포션이에요.",
    effect: "화염과 추위 저항",
  },
  starlight: {
    id: "starlight",
    name: "별빛 포션",
    baseSolution: { name: "맑은 기본 용액", amountMl: "30" },
    additives: [
      { ingredientId: "moonDew", amount: "0.6" },
      { ingredientId: "starDust", amount: "0.25" },
    ],
    look: { liquid: "#3d7bff", glow: "#9cc8ff", particle: "star", bottle: "round", emblem: "star" },
    lookText: "푸른 액체 속에 별 입자가 반짝여요",
    glowWord: "별빛",
    pricePerBottle: 5,
    specialPrice: 20,
    legacy: true,
    summary: "이전 버전 레시피예요. 진행 중이던 영업을 마칠 때만 써요.",
    supports: { multiBottle: ["d1xN", "d2xN"], customMultiplier: ["d1xD", "d2xD"] },
  },
  courage: {
    id: "courage",
    name: "용기 포션",
    baseSolution: { name: "맑은 기본 용액", amountMl: "30" },
    additives: [
      { ingredientId: "moonDew", amount: "4" },
      { ingredientId: "starDust", amount: "2" },
    ],
    look: { liquid: "#e2483d", glow: "#ffb07a", particle: "spark", bottle: "tall", emblem: "flame" },
    lookText: "붉은 액체에서 작은 불꽃 방울이 톡톡 튀어요",
    glowWord: "불꽃빛",
    pricePerBottle: 5,
    specialPrice: 20,
    legacy: true,
    summary: "이전 버전 레시피예요. 진행 중이던 영업을 마칠 때만 써요.",
    supports: { multiBottle: [], customMultiplier: ["Nxd1", "Nxd2"] },
  },
  sprout: {
    id: "sprout",
    name: "새싹 포션",
    baseSolution: { name: "맑은 기본 용액", amountMl: "30" },
    additives: [
      { ingredientId: "moonDew", amount: "0.8" },
      { ingredientId: "starDust", amount: "0.4" },
    ],
    look: { liquid: "#3fae5a", glow: "#b8f2a0", particle: "leaf", bottle: "flask", emblem: "leaf" },
    lookText: "초록 액체 속에 작은 잎이 둥둥 떠 있어요",
    glowWord: "초록빛",
    pricePerBottle: 5,
    specialPrice: 20,
    legacy: true,
    summary: "이전 버전 레시피예요. 진행 중이던 영업을 마칠 때만 써요.",
    supports: { multiBottle: ["d1xN"], customMultiplier: ["d1xD"] },
  },
  mist: {
    id: "mist",
    name: "안개 포션",
    baseSolution: { name: "맑은 기본 용액", amountMl: "30" },
    additives: [
      { ingredientId: "moonDew", amount: "0.35" },
      { ingredientId: "starDust", amount: "0.15" },
    ],
    look: { liquid: "#8a5bd6", glow: "#d9c6ff", particle: "mist", bottle: "drop", emblem: "cloud" },
    lookText: "보랏빛 액체 위로 안개가 피어올라요",
    glowWord: "보랏빛",
    pricePerBottle: 5,
    specialPrice: 20,
    legacy: true,
    summary: "이전 버전 레시피예요. 진행 중이던 영업을 마칠 때만 써요.",
    supports: { multiBottle: ["d2xN"], customMultiplier: ["d2xD"] },
  },
};

/** 이전 버전의 특별 주문 정상 판매금 (주문당). 지금은 레시피마다 specialPrice로 정한다 */
export const SPECIAL_ORDER_PRICE = 20;

export function getRecipe(id: string): Recipe {
  const found = RECIPES[id];
  if (!found) throw new Error(`알 수 없는 레시피: ${id}`);
  return found;
}

export function additiveAmount(recipe: Recipe, ingredientId: string): string {
  const ad = recipe.additives.find((x) => x.ingredientId === ingredientId);
  if (!ad) throw new Error(`${recipe.name}에 ${ingredientId}가 없습니다.`);
  return ad.amount;
}
