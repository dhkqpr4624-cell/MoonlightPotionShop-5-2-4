/**
 * 영업 마감 화면. 배경은 덧문이 닫힌 가게, 실내 등불은 켜진 채로 둔다.
 * animate=true 이면 (방금 '영업 마감'을 눌렀을 때) 손님 퇴장 → 덧문 닫힘 → 표지판 → 결과 순서로 보여 준다.
 * 새로고침·이어하기로 들어오면 연출 없이 닫힌 모습과 결과를 바로 보여 준다.
 */
import { useEffect } from "react";
import { encouragement, summarizeDay } from "../game/daySummary.ts";
import type { DayState, GameState } from "../game/types.ts";
import { NightBackdrop } from "./art/NightBackdrop.tsx";
import { ClosedSign, Shutters } from "./art/Shutters.tsx";
import { FoxArt } from "./art/FoxArt.tsx";

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
  const day = state.day as DayState;
  const summary =
    state.dayHistory.find((h) => h.dayNumber === day.dayNumber) ?? summarizeDay(day, state.money, new Date().toISOString());

  useEffect(() => {
    if (!animate) return;
    const t = window.setTimeout(onAnimEnd, CLOSE_ANIM_MS);
    return () => window.clearTimeout(t);
  }, [animate, onAnimEnd]);

  const tiles: [string, string, string][] = [
    ["영업 일차", `밤 ${summary.dayNumber}일차`, "day"],
    ["응대한 손님", `${summary.customersServed}명`, "customers"],
    ["판매한 포션", `${summary.bottlesSold}병`, "bottles"],
    ["오늘 얻은 판매금", `🌙 ${summary.moneyEarned}`, "earned"],
    ["현재 소지금", `🌙 ${state.money}`, "money"],
    ["전체 문제", `${summary.totalProblems}개`, "total"],
    ["첫 시도에 맞힘", `${summary.firstTryCorrect}개`, "first"],
    ["다시 계산해서 해결", `${summary.correctedAfterWrong}개`, "corrected"],
    ["힌트를 사용한 문제", `${summary.hintUsed}개`, "hint"],
  ];

  return (
    <div className="closing" data-testid="closing">
      <NightBackdrop />
      {animate && (
        <div className="closing-leaving-customer" aria-hidden="true">
          <FoxArt mood="happy" />
        </div>
      )}
      <Shutters mode={animate ? "closing" : "closed"} />
      <ClosedSign animate={animate} />
      <div className="closing-dim" aria-hidden="true" />

      {!animate && (
        <section className="result-card" aria-labelledby="result-title" data-testid="result-card">
          <h2 id="result-title" className="result-title">
            밤 {summary.dayNumber}일차 영업을 마쳤어요
          </h2>
          <dl className="result-grid">
            {tiles.map(([label, value, key]) => (
              <div key={key} className={`result-tile tile-${key}`}>
                <dt>{label}</dt>
                <dd data-testid={`result-${key}`}>{value}</dd>
              </div>
            ))}
          </dl>
          <div className="result-cheer">
            {encouragement(summary).map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
          <div className="result-actions">
            <button type="button" className="btn btn-ghost-dark btn-big" onClick={onTitle} disabled={busy} data-testid="closing-title">
              타이틀로
            </button>
            <button type="button" className="btn btn-primary btn-big" onClick={onNextDay} disabled={busy} data-testid="next-day">
              🌙 다음 날 영업
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
