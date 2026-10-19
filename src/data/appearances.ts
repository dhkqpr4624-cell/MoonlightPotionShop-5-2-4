/**
 * 손님 외형(PNG 일러스트). 기존 손님 ID(fox·rabbit·cat·wolf)는 대사·말투를 정하고,
 * 외형은 그림·표시 이름만 정한다. 주문 난이도와는 아무 관계가 없다.
 *
 * - 주문을 만들 때 외형을 정해 order.appearanceId로 저장한다 → 새로고침해도 같은 손님.
 * - appearanceId가 없는 이전 저장의 주문은 손님 ID별 기본 외형(목록의 첫 번째)으로 고정한다.
 * - 이름은 그림에 이름이 없어 붙인 임시 표시명이다. 여기서 바꾸면 된다.
 *
 * display (원본 PNG 픽셀 기준. 그림마다 다르게 맞춘다)
 *   scale    캔버스 1px당 창구 캔버스 px (클수록 크게)
 *   cutY     카운터 윗면에 닿는 PNG의 y. 이 아래는 테이블에 가려진다
 *   centerX  몸 중심 x (손님이 서는 기준선에 맞춘다)
 *   headY    얼굴(눈 높이) y. 대사창 위치를 정할 때 쓴다
 *   top      그림이 시작되는 가장 위 y(귀 끝). 화면 위쪽·아치·대사창에 귀가 잘리지 않게 크기를 줄일 때 쓴다
 */
export interface Appearance {
  id: string;
  customerId: string;
  name: string;
  species: string;
  image: string;
  /** 첨부된 원본 파일 이름 (내용은 바꾸지 않고 이름만 영문으로 복사) */
  source: string;
  /** width·height: 원본 PNG 픽셀 크기(비율 유지용) */
  display: { width: number; height: number; top: number; scale: number; cutY: number; centerX: number; headY: number };
}

const a = (
  id: string, customerId: string, name: string, species: string, source: string,
  display: Appearance["display"],
): Appearance => ({ id, customerId, name, species, image: `assets/npc/${id}.png`, source, display });

/** 손님 ID별로 묶은 외형. 각 목록의 첫 번째가 기본 외형(이전 저장용) */
export const APPEARANCES: Appearance[] = [
  a("fox-traveler", "fox", "코코", "여우 수인", "달빛 물약 상점의 여우 손님 (1).png", { width: 1206, height: 1305, top: 30, scale: 0.5, cutY: 1150, centerX: 560, headY: 330 }),
  a("fox-elder", "fox", "단풍 할아버지", "여우 수인", "달빛 약방의 다정한 노년 여우.png", { width: 1205, height: 1305, top: 6, scale: 0.5, cutY: 1150, centerX: 620, headY: 330 }),
  a("fox-silver", "fox", "은방울", "여우 수인", "달빛 포션 가게의 은빛 여우 손님.png", { width: 1205, height: 1305, top: 9, scale: 0.5, cutY: 1150, centerX: 630, headY: 320 }),
  a("fox-herbalist", "fox", "솔잎", "여우 수인", "안경 쓴 약초학자 여우 손님.png", { width: 1205, height: 1306, top: 19, scale: 0.5, cutY: 1150, centerX: 620, headY: 330 }),

  a("rabbit-burgundy", "rabbit", "보리", "토끼 수인", "달빛 물약점의 버건디 토끼 손님.png", { width: 1205, height: 1306, top: 5, scale: 0.54, cutY: 1170, centerX: 610, headY: 420 }),
  a("rabbit-noble", "rabbit", "백설", "토끼 수인", "달빛 물약 상점의 우아한 토끼 손님.png", { width: 1205, height: 1306, top: 2, scale: 0.54, cutY: 1170, centerX: 620, headY: 400 }),
  a("rabbit-gardener", "rabbit", "새싹", "토끼 수인", "문라이트 포션샵의 토끼 정원사.png", { width: 1205, height: 1305, top: 7, scale: 0.54, cutY: 1170, centerX: 620, headY: 420 }),
  a("rabbit-artisan", "rabbit", "조약돌", "토끼 수인", "슬레이트빛 토끼 장인 손님.png", { width: 1205, height: 1306, top: 107, scale: 0.5, cutY: 1170, centerX: 630, headY: 300 }),

  a("leopard-merchant", "cat", "나비", "표범 수인", "달빛 물약 가게의 표범 상인.png", { width: 1205, height: 1305, top: 8, scale: 0.5, cutY: 1150, centerX: 630, headY: 290 }),
  a("panther-lady", "cat", "흑진주", "흑표범 수인", "달빛 물약점의 우아한 흑표범 손님.png", { width: 1205, height: 1306, top: 2, scale: 0.5, cutY: 1150, centerX: 640, headY: 270 }),
  a("panther-gentleman", "cat", "까망", "흑표범 수인", "달빛 물약점의 흑표범 신사.png", { width: 1205, height: 1306, top: 3, scale: 0.5, cutY: 1150, centerX: 630, headY: 280 }),
  a("snow-leopard", "cat", "눈꽃", "눈표범 수인", "은빛 표범 손님의 자주빛 망토.png", { width: 1205, height: 1306, top: 7, scale: 0.5, cutY: 1150, centerX: 620, headY: 290 }),

  a("wolf-gray", "wolf", "달이", "늑대 수인", "달빛 물약점의 회색 늑대 여행자.png", { width: 1205, height: 1305, top: 8, scale: 0.5, cutY: 1150, centerX: 620, headY: 320 }),
  a("wolf-snow", "wolf", "서리", "늑대 수인", "눈을 머금은 늑대 여행자.png", { width: 1205, height: 1306, top: 6, scale: 0.5, cutY: 1150, centerX: 600, headY: 320 }),
  a("wolf-iceblue", "wolf", "청람", "늑대 수인", "우아한 아이스블루 눈의 늑대 손님.png", { width: 1205, height: 1306, top: 4, scale: 0.5, cutY: 1150, centerX: 620, headY: 300 }),
];

const BY_ID = new Map(APPEARANCES.map((x) => [x.id, x]));

export function appearancesOf(customerId: string): Appearance[] {
  return APPEARANCES.filter((x) => x.customerId === customerId);
}

export function getAppearanceById(id: string): Appearance | undefined {
  return BY_ID.get(id);
}

/** 이 손님 ID에 속한 외형인지 (저장·가져오기 검사용) */
export function isAppearanceOf(id: unknown, customerId: string): boolean {
  return typeof id === "string" && BY_ID.get(id)?.customerId === customerId;
}

/** 주문의 외형. 없거나 맞지 않으면 손님 ID별 기본 외형(항상 같은 값) */
export function appearanceOf(order: { customerId: string; appearanceId?: string }): Appearance | null {
  if (order.appearanceId && isAppearanceOf(order.appearanceId, order.customerId)) return BY_ID.get(order.appearanceId)!;
  return appearancesOf(order.customerId)[0] ?? null;
}

/**
 * 새 주문의 외형 고르기. 문제를 고르는 난수와 섞이지 않게 주문 번호로만 정한다
 * (같은 시드면 문제·손님 순서가 이전과 똑같다). 바로 앞 손님과 같은 외형은 피한다.
 */
export function pickAppearance(customerId: string, orderNumber: number, avoid: string | null): string | undefined {
  const list = appearancesOf(customerId);
  if (!list.length) return undefined;
  let i = Math.imul(orderNumber + 1, 2654435761) >>> 0;
  i %= list.length;
  if (list[i].id === avoid && list.length > 1) i = (i + 1) % list.length;
  return list[i].id;
}
