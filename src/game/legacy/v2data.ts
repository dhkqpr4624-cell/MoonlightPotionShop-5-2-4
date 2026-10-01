/* 이 파일은 Phase 2(저장 버전 2) 코드를 그대로 보존한 것이다. 이전 저장을 검증·마이그레이션할 때만 쓴다. 수정하지 말 것. */
/** Phase 1·2 시절의 레시피·손님 데이터 (이전 저장 검증용으로 고정) */
export interface LegacyRecipe {
  id: string;
  name: string;
  baseSolution: { name: string; amountMl: string };
  additives: { ingredientId: string; amount: string }[];
  pricePerBottle: number;
}

export const LEGACY_RECIPES: Record<string, LegacyRecipe> = {
  starlight: {
    id: "starlight",
    name: "별빛 포션",
    baseSolution: { name: "맑은 기본 용액", amountMl: "30" },
    additives: [
      { ingredientId: "moonDew", amount: "0.6" },
      { ingredientId: "starDust", amount: "0.25" },
    ],
    pricePerBottle: 5,
  },
};

export const LEGACY_CUSTOMERS: Record<string, { lines: { greet: string[]; order: string[]; waiting: string[]; thanks: string[] } }> = {
  fox: {
    lines: {
      greet: ["안녕하세요, 사장님!", "달빛이 참 밝은 밤이에요!", "또 왔어요, 사장님!"],
      order: [
        "{potion} {bottles}병 주세요!",
        "오늘은 {potion} {bottles}병이 필요해요.",
        "{potion}, {bottles}병 부탁해요!",
      ],
      waiting: ["천천히 만들어 주세요. 기다릴게요!", "꼬리를 흔들며 기다리는 중이에요~"],
      thanks: ["와, 반짝반짝해요! 고마워요!", "정말 예쁜 포션이에요. 또 올게요!", "딱 제가 원하던 포션이에요!"],
    },
  },
};

export function legacyFillLine(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? `{${key}}`));
}
