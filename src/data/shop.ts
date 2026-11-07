/**
 * 상점 상품: 편의품 2종 + 꾸미기 3칸(창구 카운터 / 상점 벽 / 제작대) × 테마 6종.
 * 가격은 여기 데이터에서만 읽는다(game/shop.ts). 레시피 해금·주문과는 관계없는 선택 구매다.
 * 창밖 마을 배경(counter/village.png)은 상품이 아니다. 어떤 테마를 골라도 그대로 쓴다.
 *
 * 가격 근거 (scripts/balance30.ts, 하루 수입 중앙값: 모두 정답 약 135~150, 섞임 약 120~130, 오답 많음 약 100)
 *  - 편의품: 하루 남짓 수입 (안경 150, 자동 솥 220)
 *  - 장식: 같은 칸 안에서 표의 뒤쪽일수록 비싸게. 한 개에 하루~사흘 치 수입.
 *          앞 단계를 먼저 사야 하는 조건은 없다.
 *
 * PNG 대응 (첨부 '상점_스킨_png.zip' 원본을 이름만 영문으로 바꿔 public/assets/shop/themes/ 에 복사, 내용 그대로)
 *  기본 테마는 지금까지 쓰던 그림(counter/arch.png·table.png, workbench/table.png)이다.
 */
export type DecorSlot = "counter" | "wall" | "bench";
export type ThemeId = "basic" | "royal" | "tree" | "rune" | "deep" | "steel" | "galaxy";

export const DECOR_SLOTS: DecorSlot[] = ["counter", "wall", "bench"];
export const SLOT_LABEL: Record<DecorSlot, string> = { counter: "창구 카운터", wall: "상점 벽", bench: "제작대" };
export const THEME_IDS: ThemeId[] = ["basic", "royal", "tree", "rune", "deep", "steel", "galaxy"];
export const THEME_LABEL: Record<ThemeId, string> = {
  basic: "일반",
  royal: "화려한",
  tree: "세계수 생명의 나무",
  rune: "고대 룬 마법",
  deep: "심해의 메아리",
  steel: "연금술사의 강철",
  galaxy: "칠흑의 은하수",
};
const SLOT_NOUN: Record<DecorSlot, Record<"basic" | "other", string>> = {
  counter: { basic: "일반 테이블", other: "테이블" },
  wall: { basic: "일반 배경", other: "벽" },
  bench: { basic: "일반 제작대", other: "제작대" },
};

export interface DecorItem {
  id: string;
  slot: DecorSlot;
  theme: ThemeId;
  name: string;
  price: number;
  /** 그림 경로(public/ 기준). 기본 테마는 기존 그림 */
  image: string;
  /** 첨부 원본 파일 이름(기본 테마는 없음) */
  source?: string;
}

const PRICES: Record<DecorSlot, number[]> = {
  counter: [120, 160, 200, 250, 300, 350],
  wall: [140, 180, 230, 280, 330, 380],
  bench: [130, 170, 220, 270, 320, 370],
};

const SOURCES: Record<DecorSlot, Partial<Record<ThemeId, string>>> = {
  counter: {
    royal: "상아빛 대리석 길드 카운터.png",
    tree: "위그드라실 고목 포션 상점 카운터.png",
    rune: "룬이 새겨진 아이보리 대리석 테이블.png",
    deep: "심해 유리 산호 포션 카운터.png",
    steel: "연금술사의 황동과 철제 작업대.png",
    galaxy: "별빛을 품은 흑요석 유리 테이블.png",
  },
  wall: {
    royal: "백색 대리석과 금빛의 연금술 상점.png",
    tree: "고목 뿌리로 빚은 치유 약방.png",
    rune: "룬빛 대리석의 달빛 연금술 상점.png",
    deep: "심해 유리와 산호의 포션 상점.png",
    steel: "달빛 어린 황동과 철의 연금술 상점.png",
    galaxy: "공허와 별빛 유리의 연금술 상점.png",
  },
  bench: {
    royal: "백금빛 왕실 연금술 작업대.png",
    tree: "이그드라실 심목 연금 작업대.png",
    rune: "푸른 룬의 대리석 연금술 작업대.png (같은 내용의 '(1)' 파일은 중복이라 쓰지 않음)",
    deep: "심해 유리와 산호의 연금술 작업대.png",
    steel: "황동과 철의 연금술 작업대.png",
    galaxy: "보이드 별빛 옵시디언 연금술 작업대.png",
  },
};

const BASIC_IMAGE: Record<DecorSlot, string> = {
  counter: "assets/shop/counter/table.png",
  wall: "assets/shop/counter/arch.png",
  bench: "assets/shop/workbench/table.png",
};

export const DECOR_ITEMS: DecorItem[] = DECOR_SLOTS.flatMap((slot) =>
  THEME_IDS.map((theme, i): DecorItem => ({
    id: `${slot}:${theme}`,
    slot,
    theme,
    name: theme === "basic" ? SLOT_NOUN[slot].basic : `${THEME_LABEL[theme]} ${SLOT_NOUN[slot].other}`,
    price: theme === "basic" ? 0 : PRICES[slot][i - 1],
    image: theme === "basic" ? BASIC_IMAGE[slot] : `assets/shop/themes/${slot}-${theme}.png`,
    source: SOURCES[slot][theme],
  })),
);

export type GadgetId = "glasses" | "autoCauldron";

export interface GadgetItem {
  id: GadgetId;
  name: string;
  price: number;
  description: string;
}

export const GADGETS: GadgetItem[] = [
  {
    id: "glasses",
    name: "레시피의 고수 안경",
    price: 150,
    description: "제작대에서 이번 주문에 필요한 재료 칸을 금빛으로 강조하고, 재료 아래에 기본 레시피의 1병당 양을 작게 보여 줘요. 이번 주문의 총량이나 정답은 보여 주지 않아요.",
  },
  {
    id: "autoCauldron",
    name: "마녀의 자동 솥",
    price: 220,
    description: "필요한 재료를 모두 계량해 넣으면 솥이 스스로 저어 줘요. 계량 문제와 넣기는 그대로 직접 해요.",
  },
];

export function getDecor(id: string): DecorItem | undefined {
  return DECOR_ITEMS.find((x) => x.id === id);
}
export function decorOf(slot: DecorSlot, theme: ThemeId): DecorItem {
  return DECOR_ITEMS.find((x) => x.slot === slot && x.theme === theme)!;
}
export function getGadget(id: string): GadgetItem | undefined {
  return GADGETS.find((x) => x.id === id);
}
/** 상품 가격 (모르는 상품은 null) */
export function priceOf(itemId: string): number | null {
  return getGadget(itemId)?.price ?? getDecor(itemId)?.price ?? null;
}
export const SHOP_ITEM_IDS: string[] = [...GADGETS.map((g) => g.id), ...DECOR_ITEMS.filter((d) => d.theme !== "basic").map((d) => d.id)];

/**
 * 제작대 테마별 항아리 안쪽 타원(액체를 그리는 곳). 테마 그림마다 항아리 테두리 두께가 달라 따로 쟀다.
 * 서랍·병 받침·돌판·책·주문서 자리는 모든 테마 그림이 기본 제작대와 같은 배치라 공통 좌표를 쓴다.
 */
export const BENCH_POT_INNER: Record<ThemeId, { cx: number; cy: number; rx: number; ry: number }> = {
  basic: { cx: 650, cy: 594, rx: 200, ry: 176 },
  royal: { cx: 650, cy: 585, rx: 205, ry: 170 },
  tree: { cx: 650, cy: 580, rx: 205, ry: 170 },
  rune: { cx: 650, cy: 585, rx: 205, ry: 170 },
  deep: { cx: 650, cy: 572, rx: 205, ry: 160 },
  steel: { cx: 650, cy: 572, rx: 205, ry: 160 },
  galaxy: { cx: 650, cy: 575, rx: 205, ry: 160 },
};
