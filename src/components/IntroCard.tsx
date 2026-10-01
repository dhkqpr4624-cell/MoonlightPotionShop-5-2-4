/** 처음 등장하는 학습 유형 소개 (영업 시작 때 자동으로). 고르거나 설정할 것은 없다 */
import { LEARNING_TYPES, type LearningTypeId } from "../data/learningTypes.ts";

export function IntroCard({ dayNumber, types, onClose }: { dayNumber: number; types: LearningTypeId[]; onClose: () => void }) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="intro-title" data-testid="intro-card">
      <div className="modal intro">
        <p className="intro-kicker">밤 {dayNumber}일차 · 새로운 계산</p>
        <h3 id="intro-title">오늘 손님들이 이런 주문을 할 거예요</h3>
        <ul className="intro-list">
          {types.map((t) => (
            <li key={t}>
              <strong>{LEARNING_TYPES[t].number} {LEARNING_TYPES[t].label}</strong>
              <p>{LEARNING_TYPES[t].intro}</p>
              <p className="intro-example">예) {LEARNING_TYPES[t].example}</p>
            </li>
          ))}
        </ul>
        <p className="small muted">막히면 계량할 때 ‘힌트’를 눌러 보세요. 힌트를 봐도 판매금은 줄지 않아요.</p>
        <div className="modal-actions">
          <button type="button" className="btn btn-primary btn-big" onClick={onClose} data-testid="intro-ok" autoFocus>
            알겠어요
          </button>
        </div>
      </div>
    </div>
  );
}
