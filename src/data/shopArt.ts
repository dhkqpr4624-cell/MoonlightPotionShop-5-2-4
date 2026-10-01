/**
 * 가게 배경 그림 교체 지점.
 * 최종 그림이 생기면 public/ 아래에 넣고 경로를 적는다. 비워 두면 코드로 그린 임시 그래픽을 쓴다.
 * 덧문 그림은 창 크기(가로 350 × 세로 500, 배경 좌표 기준)에 맞춰 늘어난다.
 */
export interface ShopArt {
  /** 왼쪽 덧문 한 짝 (예: "assets/shop/shutter-left.png") */
  shutterLeft?: string;
  /** 오른쪽 덧문 한 짝 */
  shutterRight?: string;
  /** '영업 종료' 표지판 */
  closedSign?: string;
}

export const SHOP_ART: ShopArt = {};
