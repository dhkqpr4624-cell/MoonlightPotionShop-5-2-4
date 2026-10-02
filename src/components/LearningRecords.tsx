/**
 * 학생 자신의 학습 기록 (타이틀 → 학습 기록 보기). 순위·비교 없이 내 기록만 보여 준다.
 */
import { useState } from "react";
import { Icon } from "./Icon.tsx";
import { LEARNING_TYPES } from "../data/learningTypes.ts";
import { KIND_LABEL, MODE_LABEL, orderRows, problemRows, typeStats } from "../game/learningLog.ts";
import type { GameState } from "../game/types.ts";

type Tab = "summary" | "problems" | "review" | "orders" | "legacy";

export function LearningRecords({ state, onBack }: { state: GameState; onBack: () => void }) {
  const [tab, setTab] = useState<Tab>("summary");
  const rows = problemRows(state).slice().reverse();
  const stats = typeStats(state);
  const orders = orderRows(state).slice().reverse();
  const tabs: [Tab, string][] = [
    ["summary", "요약"],
    ["problems", `문제 기록 (${rows.length})`],
    ["review", `복습 (${state.review.filter((c) => c.status === "open").length})`],
    ["orders", "손님 반응"],
    ["legacy", `이전 기록 (${state.legacyRecords.length})`],
  ];

  return (
    <div className="records" data-testid="records">
      <header className="records-head">
        <button type="button" className="btn btn-light" onClick={onBack} data-testid="records-back"><Icon name="back" size={18} /> 처음 화면</button>
        <h1><Icon name="records" size={26} /> 나의 학습 기록</h1>
      </header>
      <div className="tabs records-tabs" role="tablist">
        {tabs.map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? "is-on" : ""} onClick={() => setTab(key)} data-testid={`records-tab-${key}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="records-body">
        {tab === "summary" && (
          <>
            <h2>유형별 기록</h2>
            <p className="muted small">계산 문제와 비교 문제만 세어요. 손님이 지정한 양을 그대로 넣는 계량은 빼고 셉니다.</p>
            <div className="table-wrap">
              <table className="data-table" data-testid="type-stats">
                <thead>
                  <tr><th>유형</th><th>문제</th><th>정확</th><th>힌트</th><th>복습</th></tr>
                </thead>
                <tbody>
                  {stats.map((t) => (
                    <tr key={t.type} className={t.problems === 0 ? "is-empty" : ""}>
                      <th>{t.label}</th>
                      <td>{t.problems}</td>
                      <td>{t.correct}</td>
                      <td>{t.hintUsed}</td>
                      <td>{t.review ? `${t.reviewCorrect}/${t.review}` : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <h2>영업별 결과</h2>
            {state.dayHistory.length === 0 ? (
              <p className="muted">아직 마감한 영업이 없어요.</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr><th>일차</th><th>손님</th><th>문제</th><th>정확</th><th>힌트</th><th>만족·아쉬움·불만족</th><th>판매금</th></tr>
                  </thead>
                  <tbody>
                    {state.dayHistory.slice().reverse().map((h) => (
                      <tr key={h.dayNumber}>
                        <th>밤 {h.dayNumber}일차{h.ruleVersion === 3 ? "" : " (이전 규칙)"}</th>
                        <td>{h.customersServed}</td>
                        <td>{h.totalProblems}</td>
                        <td>{h.firstTryCorrect}</td>
                        <td>{h.hintUsed}</td>
                        <td>{h.quality ? `${h.quality.great}·${h.quality.okay}·${h.quality.poor}` : "-"}</td>
                        <td>{h.moneyEarned}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {tab === "problems" && (
          rows.length === 0 ? <p className="muted">아직 기록이 없어요.</p> : (
            <div className="table-wrap">
              <table className="data-table" data-testid="problem-table">
                <thead>
                  <tr><th>상태</th><th>일차·손님</th><th>유형</th><th>조건</th><th>식</th><th>목표</th><th>내 답</th><th>결과</th><th>힌트</th><th>해설</th><th>복습</th></tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.problemId + r.status}>
                      <td>{r.status}</td>
                      <td>{r.dayNumber}일차 · {r.customerNumber}번</td>
                      <td>{r.typeLabel}<br /><span className="muted small">{KIND_LABEL[r.orderKind]} · {MODE_LABEL[r.mode]}</span></td>
                      <td className="cond">{r.condition}</td>
                      <td>{r.expression}</td>
                      <td>{r.target}</td>
                      <td className={r.correct === false ? "is-wrong" : ""}>{r.submitted ?? "-"}</td>
                      <td>{r.correct === null ? "-" : r.correct ? "✓ 정확" : "✗ 다름"}</td>
                      <td>{r.hintUsed ? `${r.hintLevel}단계` : "-"}</td>
                      <td>{r.explanationViewed ? "확인" : "-"}</td>
                      <td>{r.isReview ? "복습" : "일반"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {tab === "review" && (
          state.review.length === 0 ? <p className="muted">복습할 문제가 없어요. 다르게 계량한 문제는 다음 영업에 다른 숫자로 다시 나와요.</p> : (
            <ul className="review-list">
              {state.review.slice().reverse().map((c) => (
                <li key={c.id} className={c.status === "resolved" ? "is-done" : ""}>
                  <strong>{LEARNING_TYPES[c.learningType].number} {LEARNING_TYPES[c.learningType].label}</strong>
                  <span>처음 문제: {c.a} × {c.b} (밤 {c.createdDay}일차)</span>
                  <span>{c.status === "resolved" ? "✓ 복습 완료" : c.reviewProblemIds.length ? `복습 ${c.reviewProblemIds.length}번 — 다음에 다시 만나요` : "다음 영업에서 다른 숫자로 다시 만나요"}</span>
                </li>
              ))}
            </ul>
          )
        )}

        {tab === "orders" && (
          orders.length === 0 ? <p className="muted">아직 전달한 포션이 없어요.</p> : (
            <div className="table-wrap">
              <table className="data-table" data-testid="order-table">
                <thead>
                  <tr><th>일차·손님</th><th>주문</th><th>손님 반응</th><th>정상 판매금</th><th>받은 돈</th></tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.orderId}>
                      <td>{o.dayNumber}일차 · {o.customerNumber}번</td>
                      <td>{o.kindLabel}{o.kind === "multiBottle" ? ` ${o.bottles}병` : ""}</td>
                      <td>{o.qualityLabel}</td>
                      <td>{o.price}</td>
                      <td>{o.reward}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {tab === "legacy" && (
          state.legacyRecords.length === 0 ? <p className="muted">이전 버전에서 옮겨 온 기록이 없어요.</p> : (
            <>
              <p className="muted small">1·2단계 방식(틀리면 다시 고쳐서 넣기)으로 푼 기록이에요. 일차 0은 하루 영업이 생기기 전 기록이에요.</p>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr><th>일차·손님</th><th>유형</th><th>식</th><th>정답</th><th>첫 답</th><th>시도</th><th>힌트</th></tr>
                  </thead>
                  <tbody>
                    {state.legacyRecords.slice().reverse().map((r) => (
                      <tr key={r.problemId}>
                        <td>{r.dayNumber}일차 · {r.customerNumber}번</td>
                        <td>{LEARNING_TYPES[r.learningType].number} {LEARNING_TYPES[r.learningType].label}</td>
                        <td>{r.a} × {r.b}</td>
                        <td>{r.answer}</td>
                        <td>{r.firstAnswer ?? "-"}{r.firstCorrect ? " ✓" : ""}</td>
                        <td>{r.attempts}</td>
                        <td>{r.hintLevel ? `${r.hintLevel}단계` : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )
        )}
      </div>
    </div>
  );
}
