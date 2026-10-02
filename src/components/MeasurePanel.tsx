/**
 * 계량 패널. 재료를 솥에 놓으면 열린다.
 *  - 문제: 질문 + 입력칸·단위 + 키패드 (계산식·정답은 보이지 않음, 힌트를 누르면 단계별로)
 *  - 결과: 같은 자리에서 해설로 바뀐다. 오답이면 입력한 양(빨강)과 필요한 양을 글로 구분하고 계산 과정을 보여 준다.
 *  - '이 양으로 투입하기'를 눌러야 투입된다 (자동 투입 없음)
 */
import { useEffect, useRef, useState, type Dispatch } from "react";
import { getIngredient } from "../data/ingredients.ts";
import { LEARNING_TYPES } from "../data/learningTypes.ts";
import { CHOICE_LABEL, hintCard, resultSummary, solutionSteps } from "../game/explain.ts";
import { MAX_HINT_LEVEL, type Action } from "../game/reducer.ts";
import type { Feedback, HintVisual, IngredientTask, Order, ShiftChoice } from "../game/types.ts";
import { josa } from "../lib/josa.ts";
import { Keypad } from "./Keypad.tsx";
import { IngredientArt } from "./art/PotionArt.tsx";
import { Icon } from "./Icon.tsx";
import { playSfx } from "../audio/sfx.ts";

const CHOICES: ShiftChoice[] = ["x10", "same", "d10"];

export function MeasurePanel({
  order,
  task,
  index,
  draft,
  feedback,
  dispatch,
  locked,
}: {
  order: Order;
  task: IngredientTask;
  index: number;
  draft: string;
  feedback: Feedback | null;
  dispatch: Dispatch<Action>;
  locked: boolean;
}) {
  const ing = getIngredient(task.ingredientId);
  const pending = task.status === "pending";
  const now = () => new Date().toISOString();
  const concept = task.mode === "concept" && task.concept;

  // 이 패널에서 방금 답을 확정했을 때만 부드러운 결과음 (새로고침해 결과 화면으로 돌아오면 소리 없음)
  const prevStatus = useRef(task.status);
  const prevId = useRef(task.problemId);
  useEffect(() => {
    if (prevId.current === task.problemId && prevStatus.current === "pending" && task.status === "measured") {
      playSfx(task.correct ? "correct" : "wrong");
    }
    prevStatus.current = task.status;
    prevId.current = task.problemId;
  }, [task.status, task.problemId, task.correct]);

  const question = concept
    ? "이번 달빛 이슬 양은 지난번의 몇 배일까요?"
    : `${josa(ing.name, "은/는")} 몇 ${ing.unit} 넣을까요?`;

  return (
    <div className="measure" data-testid="measure-panel" data-mode={task.mode}>
      <div className="measure-head">
        <IngredientArt ingredient={ing} size={46} />
        <div className="measure-title">
          <h2 data-testid="measure-name">{ing.name} <span className="unit-chip">{ing.unit}</span></h2>
          <div className="badges">
            {task.mode === "specified" && <span className="badge badge-plain">손님 지정량</span>}
            {task.mode === "concept" && <span className="badge badge-plain">비교 문제</span>}
            {task.mode !== "specified" && task.problem.learningType && (
              <span className="badge">{LEARNING_TYPES[task.problem.learningType].number}</span>
            )}
            {task.reviewOf && <span className="badge badge-review">복습</span>}
          </div>
        </div>
      </div>

      <p className="measure-question" data-testid="question">{question}</p>
      <p className="measure-memo">
        <Icon name="memo" size={16} /> {order.script.memo[0].replace("포션: ", "")} · {order.script.memo.find((m) => m.startsWith(`${ing.name}(`)) ?? order.script.memo[1]}
      </p>

      {pending ? (
        concept ? (
          <ConceptInput order={order} task={task} locked={locked} onChoose={(c) => dispatch({ type: "SUBMIT_CHOICE", choice: c, now: now() })} />
        ) : (
          <>
            <div className="answer-line">
              <output className={`answer-box ${draft ? "" : "is-empty"}`} data-testid="answer" aria-live="polite" aria-label="입력한 양">
                {draft || "?"}
              </output>
              <span className="unit">{ing.unit}</span>
            </div>
            {feedback && <FeedbackBox feedback={feedback} />}
            <Keypad
              onKey={(key) => dispatch({ type: "INPUT_KEY", key })}
              onSubmit={() => dispatch({ type: "SUBMIT_ANSWER", now: now() })}
              disabled={locked}
              submitLabel="제출하기"
            />
          </>
        )
      ) : (
        <ResultView order={order} task={task} dispatch={dispatch} locked={locked} index={index} />
      )}

      {pending && (
        <>
          <div className="hint-row">
            <button
              type="button"
              className="btn btn-hint"
              onClick={(e: { currentTarget: HTMLButtonElement }) => {
                dispatch({ type: "REQUEST_HINT" });
                e.currentTarget.blur(); // Enter 키가 다시 힌트를 누르지 않고 '제출하기'가 되도록
              }}
              disabled={locked || task.hintLevel >= MAX_HINT_LEVEL}
              data-testid="hint"
            >
              <Icon name="bulb" size={18} /> 힌트 {task.hintLevel < MAX_HINT_LEVEL ? `${task.hintLevel + 1}단계 보기` : "모두 봤어요"}
            </button>
            <button type="button" className="btn btn-quiet" onClick={() => dispatch({ type: "CANCEL_MEASURE", orderId: order.id })} disabled={locked} data-testid="cancel-measure">
              선반으로 되돌리기
            </button>
          </div>
          {task.hintLevel > 0 && (
            <div className="hints" aria-label="힌트">
              {Array.from({ length: task.hintLevel }, (_, i) => {
                const h = hintCard(order, task, i + 1);
                return (
                  <div key={i} className="hint-card" data-testid={`hint-${i + 1}`}>
                    <strong>{h.title}</strong>
                    {h.lines.map((line, j) => <p key={j}>{line}</p>)}
                    {h.visual && <UnitBlocks visual={h.visual} />}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ConceptInput({ order, task, locked, onChoose }: { order: Order; task: IngredientTask; locked: boolean; onChoose: (c: ShiftChoice) => void }) {
  const c = task.concept!;
  void order;
  return (
    <div className="concept">
      <div className="concept-row">
        <span className="concept-label">지난번</span>
        <span className="concept-expr" data-testid="concept-ref">{c.refA} × {c.refB} = {c.refProduct}</span>
      </div>
      <div className="concept-row">
        <span className="concept-label">이번</span>
        <span className="concept-expr" data-testid="concept-new">{c.newA} × {c.newB} = ?</span>
      </div>
      <div className="choice-row" role="group" aria-label="몇 배일까요">
        {CHOICES.map((ch) => (
          <button key={ch} type="button" className="btn btn-choice" disabled={locked} onClick={() => onChoose(ch)} data-testid={`choice-${ch}`}>
            {CHOICE_LABEL[ch]}
          </button>
        ))}
      </div>
    </div>
  );
}

function ResultView({ order, task, dispatch, locked, index }: { order: Order; task: IngredientTask; dispatch: Dispatch<Action>; locked: boolean; index: number }) {
  const ing = getIngredient(task.ingredientId);
  const wrong = task.correct === false;
  const summary = resultSummary(task);
  const [showSteps, setShowSteps] = useState(wrong);
  const concept = task.mode === "concept";
  const unit = concept ? "" : ing.unit;
  const shown = (v: string | null) => (concept ? CHOICE_LABEL[v as ShiftChoice] : `${v}${unit}`);
  const legacy = order.rules === 2;

  // 오답이면 해설이 키패드 자리에 바로 나타난다 → 해설 확인으로 기록
  useEffect(() => {
    if ((wrong || showSteps) && !task.explanationViewed && !legacy) dispatch({ type: "VIEW_EXPLANATION" });
  }, [wrong, showSteps, task.explanationViewed, legacy, dispatch]);

  return (
    <div className={`result ${wrong ? "is-wrong" : "is-right"}`} data-testid="result" data-correct={String(!wrong)}>
      <p className="result-headline" role="status">
        <Icon name={wrong ? "close" : "check"} size={18} /> {summary.headline}
      </p>
      <dl className="result-values">
        <div className="rv rv-mine">
          <dt>{concept ? "고른 답" : "입력한 양"}</dt>
          <dd className={wrong ? "is-wrong" : "is-right"} data-testid="submitted">{shown(task.submitted)}</dd>
        </div>
        <div className="rv rv-need">
          <dt>{concept ? "정답" : "필요한 양"}</dt>
          <dd data-testid="target">{concept ? CHOICE_LABEL[task.concept!.correct] : `${task.problem.answer}${unit}`}</dd>
        </div>
        {concept && (
          <div className="rv rv-auto">
            <dt>자동 계량</dt>
            <dd>{task.problem.answer}mL</dd>
          </div>
        )}
      </dl>
      {summary.note && <p className="result-note">{summary.note}</p>}

      {showSteps ? (
        <div className="explain" data-testid="explanation">
          <strong>계산 과정</strong>
          <ol>
            {solutionSteps(order, task).map((line, i) => <li key={i}>{line}</li>)}
          </ol>
          {wrong && !concept && (
            <p className="explain-foot">이번 포션에는 입력한 양({task.submitted}{unit})이 그대로 들어가요. 비슷한 문제가 다음에 복습으로 찾아와요.</p>
          )}
        </div>
      ) : (
        <button type="button" className="btn btn-quiet" onClick={() => setShowSteps(true)} data-testid="show-steps">
          풀이 보기
        </button>
      )}

      <button
        type="button"
        className="btn btn-primary btn-big btn-wide"
        disabled={locked}
        onClick={() => dispatch({ type: "ADD_TO_CAULDRON", orderId: order.id, taskIndex: index })}
        data-testid="add-to-cauldron"
        data-sfx="none"
      >
        {concept ? "자동 계량해서 투입하기" : wrong ? "이 양으로 투입하기" : "이 양으로 투입하기"}
      </button>
    </div>
  );
}

function FeedbackBox({ feedback }: { feedback: Feedback }) {
  return (
    <div className={`feedback feedback-${feedback.kind}`} role={feedback.kind === "wrong" ? "alert" : "status"} data-testid="feedback" data-kind={feedback.kind}>
      <strong>{feedback.title}</strong>
      {feedback.lines.map((line, i) => <p key={i}>{line}</p>)}
    </div>
  );
}

function UnitBlocks({ visual }: { visual: HintVisual }) {
  return (
    <div className="unit-blocks" aria-label={`${visual.unitLabel} 블록 ${visual.perGroup}개씩 ${visual.groups}묶음`}>
      {Array.from({ length: visual.groups }, (_, g) => (
        <div key={g} className="unit-group">
          <span className="unit-group-label">{g + 1}묶음</span>
          <span className="unit-cells">
            {Array.from({ length: visual.perGroup }, (_, c) => <i key={c} />)}
          </span>
        </div>
      ))}
      <div className="muted small">■ 한 칸 = {visual.unitLabel}</div>
    </div>
  );
}
