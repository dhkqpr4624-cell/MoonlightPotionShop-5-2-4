/**
 * 가게 그림 교체 지점. 경로는 public/ 기준이며 화면에서 Vite base 경로가 자동으로 붙는다(lib/assets.ts).
 * 같은 이름의 파일을 바꿔 넣거나, 아래 경로를 PNG·WebP 등으로 바꾸면 된다.
 *
 *  counterRoom  (SVG) 지금은 타이틀 화면 배경에만 쓴다. 창구·마감 화면은 아래 COUNTER_SCENE(PNG)
 *  counterTop   (SVG) 예전 창구 카운터. PNG 창구로 바뀌어 지금은 쓰지 않는다(호환용으로 남김)
 *  tray         포션을 건네는 받침(240×60)
 *  workbench    제조대 뒤쪽 벽(800×600). 가운데는 솥이 놓이므로 비워 둔다
 *  shutterLeft / shutterRight  덧문 한 짝(배경 좌표 350×500). 비워 두면 코드로 그린 덧문
 *  closedSign   '영업 종료' 표지판. 비워 두면 코드로 그린 표지판
 */
export interface ShopArt {
  counterRoom: string;
  counterTop: string;
  tray: string;
  workbench: string;
  shutterLeft?: string;
  shutterRight?: string;
  closedSign?: string;
}

export const SHOP_ART: ShopArt = {
  counterRoom: "assets/shop/counter-room.svg",
  counterTop: "assets/shop/counter-top.svg",
  tray: "assets/shop/tray.svg",
  workbench: "assets/shop/workbench-room.svg",
};

/**
 * 손님 응대 창구(PNG 3장, 모두 1672×941 같은 캔버스). 뒤 → 앞 순서로 겹친다.
 *   village(창밖 마을길) → 손님 → 덧문 → arch(아치·선반·바닥, 창 개구부만 투명) → table(카운터)
 * 그림은 늘리지 않고 화면을 덮도록 같은 비율로 키운 뒤, 남는 바깥쪽만 잘린다.
 * 숫자는 모두 이 캔버스의 픽셀 좌표다. 그림을 바꾸면 opening·tableTop만 다시 재면 된다.
 */
export const COUNTER_SCENE = {
  width: 1672,
  height: 941,
  village: "assets/shop/counter/village.png",
  arch: "assets/shop/counter/arch.png",
  table: "assets/shop/counter/table.png",
  /** 아치의 투명한 창 개구부 (덧문이 이 상자 안에서 열리고 닫힌다) */
  opening: { x: 390, y: 6, width: 892, height: 652 },
  /** 카운터 윗면 y. 손님 그림의 기준선(cutY)이 여기에 맞춰진다 */
  tableTop: 655,
  /** 손님이 서는 가로 기준(캔버스 가운데에서 얼마나 왼쪽인지). 좁은 화면은 가운데 */
  standX: -150,
} as const;
