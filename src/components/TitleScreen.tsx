import type { Dispatch } from "react";
import { assetUrl } from "../lib/assets.ts";
import { newSeed } from "../lib/rng.ts";
import type { Action } from "../game/reducer.ts";
import type { GameState } from "../game/types.ts";

export function TitleScreen({ state, dispatch, onReset }: { state: GameState; dispatch: Dispatch<Action>; onReset: () => void }) {
  const inProgress = state.order !== null && state.order.status !== "paid";
  const hasProgress = inProgress || state.money > 0 || state.stats.ordersCompleted > 0;
  return (
    <div className="title-screen">
      <img className="title-logo" src={assetUrl("assets/ui/moon-logo.svg")} alt="" width={140} height={140} data-testid="logo" />
      <h1 className="title-name">달빛 포션 상점</h1>
      <p className="title-sub">밤에만 문을 여는 작은 포션 가게. 레시피대로 재료를 계산해 포션을 만들어요.</p>
      <button type="button" className="btn btn-primary btn-big" onClick={() => dispatch({ type: "START", seed: newSeed() })} data-testid="start">
        {inProgress ? "이어서 영업하기" : hasProgress ? "영업 계속하기" : "가게 문 열기"}
      </button>
      {hasProgress && (
        <p className="title-status">
          달빛 동전 {state.money}개 · 판매한 주문 {state.stats.ordersCompleted}건
        </p>
      )}
      {hasProgress && (
        <button
          type="button"
          className="btn btn-ghost small"
          onClick={() => {
            if (window.confirm("저장된 진행 상황을 모두 지우고 처음부터 시작할까요?")) onReset();
          }}
        >
          처음부터 다시 하기
        </button>
      )}
      <p className="title-phase">1단계 시험판 · 여우 손님과 별빛 포션</p>
    </div>
  );
}
