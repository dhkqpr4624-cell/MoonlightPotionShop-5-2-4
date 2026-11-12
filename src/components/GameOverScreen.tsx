/**
 * 영업 중단(게임 오버) 화면. 피해 보상금으로 소지금이 −50 이하가 되면 저장된 gameOver 상태로 보인다(새로고침해도 유지).
 *  - 복구 지점이 있으면 '전날부터 다시 시작'(전날 영업 시작) 또는 그날 영업 시작으로 되돌린다. 버튼과 안내에 실제 복구 일차를 적는다.
 *  - 복구 지점이 없는 이전 저장은 지우지 않고, 처음 화면의 '저장·기록 관리'에서 내보내 둔 저장 파일을 가져오도록 안내한다.
 */
import { useRef } from "react";
import { GAME_OVER_MONEY, type GameState } from "../game/types.ts";
import { restorePoint } from "../game/reducer.ts";
import { fmtMoney } from "../lib/money.ts";
import { Icon } from "./Icon.tsx";

export function GameOverScreen({ state, delayed, onRestore, onTitle }: {
  state: GameState;
  /** 방금 전달하며 중단됐으면 손님 반응·보상금 표시를 먼저 보여 주고 조금 뒤에 나타난다 */
  delayed: boolean;
  onRestore: (dayNumber: number) => void;
  onTitle: () => void;
}) {
  const go = state.gameOver;
  const busy = useRef(false);
  if (!go) return null;
  const cp = restorePoint(state);
  const previous = cp !== null && cp.dayNumber === go.dayNumber - 1;
  const restore = () => {
    if (!cp || busy.current) return;
    busy.current = true;
    onRestore(cp.dayNumber);
  };
  return (
    <div className={`gameover-backdrop ${delayed ? "is-delayed" : ""}`} role="alertdialog" aria-modal="true" aria-labelledby="gameover-title" data-testid="gameover">
      <div className="gameover-card">
        <Icon name="moon" size={48} className="gameover-moon" />
        <h2 id="gameover-title" className="gameover-title">영업 중단</h2>
        <p className="gameover-reason">보상금 지급으로 소지금이 {fmtMoney(GAME_OVER_MONEY)}G 이하가 되었습니다.</p>
        <p className="gameover-money" data-testid="gameover-money">
          <Icon name="coin" size={22} /> 현재 소지금 {fmtMoney(go.money)}G
        </p>
        {cp ? (
          <p className="gameover-note" data-testid="gameover-note">
            {previous
              ? `전날인 ${cp.dayNumber}일차 영업을 시작하던 때로 돌아갑니다.`
              : `${cp.dayNumber}일차 영업을 시작하던 때로 돌아갑니다.${go.dayNumber === 1 ? " (1일차라 전날이 없어요)" : " (전날 기록이 없는 이전 저장이에요)"}`}
            <br />
            그때의 소지금·재료·상품·주문·학습 기록으로 되돌리고, 그 뒤의 판매·구매·보상금·기록은 없던 일이 됩니다.
          </p>
        ) : (
          <p className="gameover-note" data-testid="gameover-note">
            업데이트 전에 만든 저장이라 돌아갈 영업 시작 기록이 없어요. 저장은 지우지 않았어요.
            <br />
            처음 화면의 ‘저장·기록 관리’에서 내보내 둔 저장 파일을 가져오거나, 새로 시작할 수 있어요.
          </p>
        )}
        <div className="gameover-actions">
          {cp && (
            <button type="button" className="btn btn-gold btn-big" onClick={restore} data-testid="gameover-restore" data-restore-day={cp.dayNumber} autoFocus>
              <Icon name="moon" /> {previous ? `전날부터 다시 시작 (${cp.dayNumber}일차)` : `${cp.dayNumber}일차 처음부터 다시 시작`}
            </button>
          )}
          <button type="button" className="btn btn-light" onClick={onTitle} data-testid="gameover-title-btn">
            처음 화면으로
          </button>
        </div>
      </div>
    </div>
  );
}
