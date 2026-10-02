/**
 * 직접 젓기 입력 계산 (화면과 분리한 순수 로직 → 단위 테스트 가능).
 *
 * - 좌표는 솥 액체 타원 기준으로 정규화한다: 중심 (0,0), 가장자리 거리 1.
 *   → 화면이 커도 작아도 필요한 손 움직임이 비슷하다.
 * - 막대 끝은 타원 안(반지름 TIP_LIMIT)으로 제한한다. 솥 밖으로 손이 나가도 막대는 가장자리에 머문다.
 * - 진행도는 막대 끝이 '움직인 거리'로만 쌓인다(프레임 수 무관). 가만히 누르기·단순 클릭은 0.
 * - 한 번에 크게 튄 좌표(MAX_STEP 초과)는 잘라 낸다 → 한 번에 완료되지 않음.
 * - 아주 작은 떨림(MIN_STEP 미만)은 무시한다.
 * - 동시에 한 포인터(손가락)만 인정한다. 다른 손가락은 무시.
 */
export const TIP_LIMIT = 0.82;
export const MAX_STEP = 0.35;
export const MIN_STEP = 0.01;
/** 정규화 거리 1당 진행도 (100이 완료). 원 지름 정도를 7번쯤 오가면 완료 */
export const PROGRESS_PER_UNIT = 14;

export interface Point {
  x: number;
  y: number;
}

export function clampTip(p: Point): Point {
  const r = Math.hypot(p.x, p.y);
  if (!Number.isFinite(r)) return { x: 0, y: 0 };
  if (r <= TIP_LIMIT) return p;
  return { x: (p.x / r) * TIP_LIMIT, y: (p.y / r) * TIP_LIMIT };
}

export class StirTracker {
  pointerId: number | null = null;
  tip: Point = { x: 0.35, y: 0.1 };
  private last: Point | null = null;
  private pending = 0;
  /** 최근 움직임 빠르기(소리용) 0~1 */
  speed = 0;

  get active(): boolean {
    return this.pointerId !== null;
  }

  /** 잡기. 이미 다른 포인터가 잡고 있으면 false */
  begin(pointerId: number, p: Point): boolean {
    if (this.pointerId !== null && this.pointerId !== pointerId) return false;
    this.pointerId = pointerId;
    this.tip = clampTip(p);
    this.last = this.tip;
    this.speed = 0;
    return true;
  }

  /**
   * 움직임. 쌓인 진행도 중 정수 부분을 돌려준다(minFlush 이상일 때). 잡은 포인터가 아니면 0.
   */
  move(pointerId: number, p: Point, minFlush = 3): number {
    if (pointerId !== this.pointerId || !this.last) return 0;
    const next = clampTip(p);
    let d = Math.hypot(next.x - this.last.x, next.y - this.last.y);
    this.tip = next;
    this.last = next;
    if (!Number.isFinite(d) || d < MIN_STEP) {
      this.speed *= 0.6;
      return 0;
    }
    if (d > MAX_STEP) d = MAX_STEP;
    this.speed = Math.min(1, this.speed * 0.5 + (d / MAX_STEP) * 0.8);
    this.pending += d * PROGRESS_PER_UNIT;
    return this.take(minFlush);
  }

  /** 놓기·취소. 남은 진행도의 정수 부분을 돌려준다 */
  end(pointerId?: number): number {
    if (pointerId !== undefined && pointerId !== this.pointerId) return 0;
    this.pointerId = null;
    this.last = null;
    this.speed = 0;
    return this.take(1);
  }

  private take(minFlush: number): number {
    if (this.pending < minFlush) return 0;
    const whole = Math.floor(this.pending);
    this.pending -= whole;
    return whole;
  }
}

/** 키보드 젓기: 화살표로 막대를 좌우로 옮긴다. 실제로 움직인 만큼만 진행 (가장자리에서 같은 방향은 0) */
export const KEY_STEP = 0.5;
