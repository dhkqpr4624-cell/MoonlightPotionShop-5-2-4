import { useEffect, useRef, useState, type Dispatch } from "react";
import { getIngredient } from "../data/ingredients.ts";
import { getRecipe } from "../data/recipes.ts";
import { getCustomer } from "../data/customers.ts";
import { keyFromKeyboard, type InputKey } from "../lib/answerInput.ts";
import { josa } from "../lib/josa.ts";
import { hintFeedback } from "../game/feedback.ts";
import { allTasksDone, MAX_HINT_LEVEL, type Action } from "../game/reducer.ts";
import type { Feedback, GameState, HintVisual, IngredientTask, Order, PourEvent } from "../game/types.ts";
import { Keypad } from "./Keypad.tsx";
import { Cauldron, IngredientIcon, MeasureTool, PotionBottle } from "./art/PotionArt.tsx";

export const POUR_MS = 1400;
export const BOTTLE_MS = 1800;

export function WorkbenchScene({ state, order, dispatch }: { state: GameState; order: Order; dispatch: Dispatch<Action> }) {
  const recipe = getRecipe(order.recipeId);
  const customer = getCustomer(order.customerId);
  const task: IngredientTask | undefined = order.tasks[state.selectedTask];
  const allDone = allTasksDone(order);

  // 정답 후 계량·투입 연출 (새로고침 후에는 다시 재생하지 않음)
  const [pourAnim, setPourAnim] = useState<PourEvent | null>(null);
  const seenSeq = useRef(state.pour?.seq ?? 0);
  useEffect(() => {
    if (state.pour && state.pour.seq !== seenSeq.current) {
      seenSeq.current = state.pour.seq;
      setPourAnim(state.pour);
      const t = window.setTimeout(() => setPourAnim(null), POUR_MS);
      return () => window.clearTimeout(t);
    }
  }, [state.pour]);

  // 포션 완성 후 병 담기 연출
  const [bottling, setBottling] = useState(false);
  useEffect(() => {
    if (!bottling) return;
    const t = window.setTimeout(() => setBottling(false), BOTTLE_MS);
    return () => window.clearTimeout(t);
  }, [bottling]);

  const busy = pourAnim !== null || bottling;
  const canInput = order.status === "brewing" && !!task && task.status === "pending" && !busy;

  // PC 키보드 입력
  const latest = useRef({ canInput });
  latest.current = { canInput };
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!latest.current.canInput || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === "Enter") {
        if (e.repeat) return;
        // 키패드 버튼을 누른 뒤 Enter를 치면 그 버튼이 다시 눌리지 않고 '계량하기'가 되게 한다.
        // 다른 버튼(힌트 등)에 초점이 있으면 그 버튼의 동작을 따른다.
        const t = e.target;
        if (t instanceof HTMLElement && t.tagName === "BUTTON" && !t.classList.contains("key")) return;
        e.preventDefault();
        dispatch({ type: "SUBMIT_ANSWER", now: new Date().toISOString() });
        return;
      }
      const key = keyFromKeyboard(e.key);
      if (key) {
        e.preventDefault();
        dispatch({ type: "INPUT_KEY", key });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dispatch]);

  const doneColors = order.tasks
    .filter((t) => t.status === "done")
    .map((t) => getIngredient(t.ingredientId).color);

  const onKey = (key: InputKey) => dispatch({ type: "INPUT_KEY", key });
  const onSubmit = () => dispatch({ type: "SUBMIT_ANSWER", now: new Date().toISOString() });
  const onComplete = () => {
    if (!allDone || busy) return;
    dispatch({ type: "COMPLETE_POTION" });
    setBottling(true);
  };

  return (
    <div className="workbench">
      {/* 상단: 주문 요약 */}
      <header className="order-bar" aria-label="주문서">
        <div className="order-bar-main">
          <PotionBottle look={recipe.look} size={34} />
          <div>
            <div className="order-title" data-testid="order-title">
              {recipe.name} <strong>{order.bottles}병</strong>
            </div>
            <div className="order-sub">
              {customer.species} {customer.name}의 주문 · 맞춤 요청 없음
            </div>
          </div>
        </div>
        <ol className="progress" aria-label="재료 준비 상태">
          {order.tasks.map((t) => {
            const ing = getIngredient(t.ingredientId);
            return (
              <li key={t.ingredientId} className={t.status === "done" ? "is-done" : ""}>
                <span className="progress-mark" aria-hidden="true">{t.status === "done" ? "✓" : "○"}</span>
                {ing.name}
                <span className="sr-only">{t.status === "done" ? " 계량 완료" : " 계량 전"}</span>
              </li>
            );
          })}
        </ol>
        <button type="button" className="btn btn-ghost" onClick={() => dispatch({ type: "GO_COUNTER" })} disabled={busy}>
          창구 보기
        </button>
      </header>

      <div className="workbench-grid">
        {/* 왼쪽: 레시피북과 재료 선택 */}
        <aside className="panel recipe-book" aria-label="레시피북">
          <h2 className="panel-title">📖 레시피북</h2>
          <div className="recipe-card">
            <div className="recipe-name">
              <PotionBottle look={recipe.look} size={30} />
              {recipe.name} <span className="muted">1병당</span>
            </div>
            <table className="recipe-table">
              <tbody>
                <tr className="auto-row">
                  <th>{recipe.baseSolution.name}</th>
                  <td>{recipe.baseSolution.amountMl}mL</td>
                  <td className="muted">자동</td>
                </tr>
                {recipe.additives.map((ad) => {
                  const ing = getIngredient(ad.ingredientId);
                  return (
                    <tr key={ad.ingredientId}>
                      <th>{ing.name}</th>
                      <td data-testid={`recipe-${ad.ingredientId}`}>
                        {ad.amount}
                        {ing.unit}
                      </td>
                      <td className="muted">첨가물</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="recipe-note">첨가물은 기본 용액에 섞는 마법 재료예요. 첨가물을 더한 양이 병 전체의 양은 아니에요.</p>
            <p className="recipe-look">✨ {recipe.lookText}</p>
          </div>

          <h3 className="panel-subtitle">재료 선택</h3>
          <ul className="ingredient-list">
            {order.tasks.map((t, i) => {
              const ing = getIngredient(t.ingredientId);
              const selected = i === state.selectedTask && order.status === "brewing";
              return (
                <li key={t.ingredientId}>
                  <button
                    type="button"
                    className={`ingredient-btn ${selected ? "is-selected" : ""} ${t.status === "done" ? "is-done" : ""}`}
                    aria-pressed={selected}
                    disabled={order.status !== "brewing" || busy}
                    onClick={() => dispatch({ type: "SELECT_TASK", index: i })}
                    data-testid={`select-${t.ingredientId}`}
                  >
                    <IngredientIcon ingredient={ing} size={34} />
                    <span className="ingredient-btn-text">
                      <span className="ingredient-name">{ing.name}</span>
                      <span className="ingredient-state">
                        {t.status === "done" ? `✓ ${t.problem.answer}${ing.unit} 넣음` : "계량 전"}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="auto-note">
            🫙 {josa(order.autoAdditions.map((a) => `${a.name} ${a.amount}${a.unit}`).join(", "), "은/는")} 솥에
            자동으로 들어가 있어요. ({order.autoAdditions.map((a) => a.note).join(", ")})
          </p>
        </aside>

        {/* 가운데: 솥 */}
        <section className="panel cauldron-area" aria-label="솥">
          <div className="cauldron-wrap">
            <Cauldron doneColors={doneColors} finished={allDone} finishColor={recipe.look.liquid} />
            {pourAnim && (
              <div className="pour-overlay" data-testid="pour-anim" aria-hidden="true">
                <div className={`pour-tool ${getIngredient(pourAnim.ingredientId).kind}`}>
                  <MeasureTool ingredient={getIngredient(pourAnim.ingredientId)} />
                  <div className="pour-label">
                    {pourAnim.amount}
                    {pourAnim.unit}
                  </div>
                </div>
                <div className="pour-drops" style={{ color: getIngredient(pourAnim.ingredientId).color }}>
                  <span>●</span><span>●</span><span>●</span>
                </div>
              </div>
            )}
          </div>

          {order.status === "brewing" ? (
            <div className="cauldron-actions">
              <button
                type="button"
                className="btn btn-primary btn-big"
                disabled={!allDone || busy}
                onClick={onComplete}
                data-testid="complete"
              >
                {allDone ? "🧪 포션 완성하기" : `포션 완성하기 (재료 ${order.tasks.filter((t) => t.status === "done").length}/${order.tasks.length})`}
              </button>
              {!allDone && <p className="muted small">모든 재료를 계량해서 넣어야 완성할 수 있어요.</p>}
            </div>
          ) : (
            <div className="bottled-area" data-testid="bottled">
              <div className={`bottle-row ${bottling ? "is-filling" : ""}`}>
                {Array.from({ length: order.bottles }, (_, i) => (
                  <span key={i} className="bottle-slot" style={{ animationDelay: `${i * 0.12}s` }}>
                    <PotionBottle look={recipe.look} size={46} label={`${recipe.name} ${i + 1}번째 병`} />
                  </span>
                ))}
              </div>
              <p className="bottled-text">
                {bottling ? "병에 담는 중…" : `${recipe.name} ${order.bottles}병 완성!`}
              </p>
              <button
                type="button"
                className="btn btn-primary btn-big"
                disabled={bottling}
                onClick={() => dispatch({ type: "GO_COUNTER" })}
                data-testid="to-counter"
              >
                창구로 가져가기 →
              </button>
            </div>
          )}
        </section>

        {/* 오른쪽: 계산과 입력 */}
        <section className="panel calc-panel" aria-label="계량 계산">
          {order.status !== "brewing" ? (
            <div className="calc-done">
              <p>모든 재료를 정확히 계량했어요! 👏</p>
            </div>
          ) : task ? (
            <CalcBody
              task={task}
              bottles={order.bottles}
              draft={state.draftAnswer}
              feedback={state.feedback}
              canInput={canInput}
              busy={busy}
              onKey={onKey}
              onSubmit={onSubmit}
              onHint={() => dispatch({ type: "REQUEST_HINT" })}
            />
          ) : null}
        </section>
      </div>
    </div>
  );
}

function CalcBody({
  task,
  bottles,
  draft,
  feedback,
  canInput,
  busy,
  onKey,
  onSubmit,
  onHint,
}: {
  task: IngredientTask;
  bottles: number;
  draft: string;
  feedback: Feedback | null;
  canInput: boolean;
  busy: boolean;
  onKey: (k: InputKey) => void;
  onSubmit: () => void;
  onHint: () => void;
}) {
  const ing = getIngredient(task.ingredientId);
  const p = task.problem;
  const done = task.status === "done";

  return (
    <div className="calc-body">
      <div className="calc-head">
        <IngredientIcon ingredient={ing} size={40} />
        <div>
          <h2 className="calc-name" data-testid="calc-name">{ing.name}</h2>
          <div className="calc-context">
            1병당 {p.a}
            {p.unit} · 주문 {bottles}병
          </div>
        </div>
      </div>

      <div className="equation" aria-label="계산식">
        <span data-testid="eq-a">{p.a}</span>
        <span className="op">×</span>
        <span data-testid="eq-b">{p.b}</span>
        <span className="op">=</span>
        <output className={`answer-box ${draft ? "" : "is-empty"} ${done ? "is-done" : ""}`} data-testid="answer" aria-live="polite">
          {done ? p.answer : draft || "?"}
        </output>
        <span className="unit">{p.unit}</span>
      </div>

      {feedback && !busy && !done && <FeedbackBox feedback={feedback} />}
      {busy && <p className="pouring-text">계량해서 솥에 넣는 중…</p>}

      {done ? (
        <div className="feedback feedback-correct" role="status">
          <strong>✓ 계량 완료</strong>
          <p>{ing.name} {josa(p.answer + p.unit, "을/를")} 넣었어요.</p>
        </div>
      ) : (
        <>
          <Keypad onKey={onKey} onSubmit={onSubmit} disabled={!canInput} />
          <div className="hint-row">
            <button type="button" className="btn btn-hint" onClick={onHint} disabled={!canInput || task.hintLevel >= MAX_HINT_LEVEL} data-testid="hint">
              💡 힌트 보기 ({task.hintLevel}/{MAX_HINT_LEVEL})
            </button>
            {task.attempts > 0 && <span className="muted small">시도 {task.attempts}번</span>}
          </div>
        </>
      )}


      {!done && task.hintLevel > 0 && (
        <div className="hints" aria-label="힌트">
          {Array.from({ length: task.hintLevel }, (_, i) => {
            const h = hintFeedback(p, i + 1);
            return (
              <div key={i} className="hint-card" data-testid={`hint-${i + 1}`}>
                <strong>{h.title}</strong>
                {h.lines.map((line, j) => (
                  <p key={j}>{line}</p>
                ))}
                {h.visual && <UnitBlocks visual={h.visual} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FeedbackBox({ feedback }: { feedback: Feedback }) {
  return (
    <div className={`feedback feedback-${feedback.kind}`} role={feedback.kind === "wrong" ? "alert" : "status"} data-testid="feedback" data-kind={feedback.kind}>
      <strong>{feedback.kind === "correct" ? "✓ " : feedback.kind === "wrong" ? "🔄 " : ""}{feedback.title}</strong>
      {feedback.lines.map((line, i) => (
        <p key={i}>{line}</p>
      ))}
    </div>
  );
}

function UnitBlocks({ visual }: { visual: HintVisual }) {
  return (
    <div className="unit-blocks" aria-label={`${visual.unitLabel} 블록 ${visual.perGroup}개씩 ${visual.groups}묶음`}>
      {Array.from({ length: visual.groups }, (_, g) => (
        <div key={g} className="unit-group">
          <span className="unit-group-label">{g + 1}병</span>
          <span className="unit-cells">
            {Array.from({ length: visual.perGroup }, (_, c) => (
              <i key={c} />
            ))}
          </span>
        </div>
      ))}
      <div className="muted small">■ 한 칸 = {visual.unitLabel}</div>
    </div>
  );
}
