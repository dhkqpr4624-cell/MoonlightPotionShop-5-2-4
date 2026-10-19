/**
 * 영업 마감 화면. 배경은 창구와 같은 PNG 가게에 기존 덧문이 닫힌 모습.
 * animate=true 이면 (방금 '영업 마감'을 눌렀을 때) 손님 퇴장 → 덧문 닫힘 → 표지판 → 결과 순서로 보여 준다.
 * 새로고침·이어하기로 들어오면 연출 없이 닫힌 모습과 결과를 바로 보여 준다.
 *
 * 결과는 네 가지만: 오늘 수입(이번 영업 판매금 합, 재료 구매로 줄지 않음) · 응대한 손님 · 현재 소지금(지금 쓸 수 있는 잔액)
 * · 잘못 만든 포션(틀린 재료가 있는 주문의 병 수 합). 다른 학습 통계는 화면에서 빼고 영업 기록·JSON에는 그대로 남긴다.
 */
import { useEffect, useRef } from "react";
import { summarizeDay, wrongPotionCount } from "../game/daySummary.ts";
import type { DayState, GameState } from "../game/types.ts";
import { ClosedSign } from "./art/Shutters.tsx";
import { SceneNpc, ShopScene, useSceneLayout } from "./art/ShopScene.tsx";
import { Icon } from "./Icon.tsx";
import { getCustomer } from "../data/customers.ts";
import { appearanceOf } from "../data/appearances.ts";

export const CLOSE_ANIM_MS = 1700;

export function ClosingScene({
  state,
  animate,
  onAnimEnd,
  onNextDay,
  onTitle,
  busy,
}: {
  state: GameState;
  animate: boolean;
  onAnimEnd: () => void;
  onNextDay: () => void;
  onTitle: () => void;
  busy: boolean;
}) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const layout = useSceneLayout(boxRef);
  const day = state.day as DayState;
  const summary =
    state.dayHistory.find((h) => h.dayNumber === day.dayNumber) ?? summarizeDay(day, state.money, new Date().toISOString());

  useEffect(() => {
    if (!animate) return;
    const t = window.setTimeout(onAnimEnd, CLOSE_ANIM_MS);
    return () => window.clearTimeout(t);
  }, [animate, onAnimEnd]);

  // 잘못 만든 포션은 이 날의 주문(병 수·정오)에서 바로 센다 (이전 버전 기록에 없던 값도 같은 기준)
  const wrong = summary.wrongPotions ?? wrongPotionCount(day.orders);
  const tiles: [string, string, string][] = [
    ["오늘 수입", `${summary.moneyEarned}`, "earned"],
    ["응대한 손님", `${summary.customersServed}명`, "customers"],
    ["현재 소지금", `${state.money}`, "money"],
    ["잘못 만든 포션", `${wrong}병`, "wrong-potions"],
  ];

  const lastOrder = day.orders[day.orders.length - 1];
  const lastApp = lastOrder ? appearanceOf(lastOrder) : null;
  return (
    <div className="closing closing--scene" data-testid="closing" ref={boxRef}>
      <ShopScene layout={layout} shutterMode={animate ? "closing" : "closed"}>
        {animate && lastOrder && lastApp && (
          <SceneNpc
            app={lastApp}
            species={getCustomer(lastOrder.customerId).artKey}
            layout={layout}
            mood="happy"
            className="npc--closing-leave"
            label={`${lastApp.species} ${lastApp.name}`}
          />
        )}
      </ShopScene>
      <ClosedSign animate={animate} />
      <div className="closing-dim" aria-hidden="true" />

      {!animate && (
        <section className="result-card" aria-labelledby="result-title" data-testid="result-card">
          <h2 id="result-title" className="result-title">
            밤 {summary.dayNumber}일차 영업을 마쳤어요
          </h2>
          <dl className="result-grid result-grid--four">
            {tiles.map(([label, value, key]) => (
              <div key={key} className={`result-tile tile-${key}`}>
                <dt>{label}</dt>
                <dd data-testid={`result-${key}`}>
                  {(key === "earned" || key === "money") && <Icon name="coin" size={20} />}
                  {value}
                </dd>
              </div>
            ))}
          </dl>
          <div className="result-actions">
            <button type="button" className="btn btn-ghost-dark btn-big" onClick={onTitle} disabled={busy} data-testid="closing-title">
              타이틀로
            </button>
            <button type="button" className="btn btn-primary btn-big" onClick={onNextDay} disabled={busy} data-testid="next-day" data-sfx="none">
              <Icon name="moon" /> 다음 날 영업
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
