/**
 * 가게 그림 교체 지점. 경로는 public/ 기준이며 화면에서 Vite base 경로가 자동으로 붙는다(lib/assets.ts).
 * 같은 이름의 파일을 바꿔 넣거나, 아래 경로를 PNG·WebP 등으로 바꾸면 된다.
 *
 *  counterRoom  창구 실내 + 창밖 풍경. 1000×560 비율(가운데 창: x150~850, 아치 꼭대기 y≈70)
 *  counterTop   창구 아래 나무 카운터. 가로로 늘어난다(1000×160 기준)
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
