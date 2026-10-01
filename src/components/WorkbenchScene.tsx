/**
 * 제조대 (Phase 3). 가운데 솥, 아래 재료 선반, 한쪽에 접는 주문 메모·레시피북, 다른 쪽에 계량 패널.
 *
 * 재료 옮기기 (같은 게임 행동 PLACE_INGREDIENT 로 처리)
 *  ① 재료 클릭(집기) → 솥 클릭(놓기)     ② 재료를 끌어서 솥에 놓기
 *  키보드: Tab으로 재료 → Enter(집기) → Tab으로 솥 → Enter(놓기), Esc(취소)
 *  솥이 아닌 곳에 놓으면 재료는 선반으로 돌아간다.
 * 젓기: 솥 안에서 막대를 잡고 움직인 '거리'를 누적한다(프레임 수와 무관). '젓기' 버튼도 같은 양만큼 올린다.
 */
import { useCallback, useEffect, useRef, useState, type Dispatch, type PointerEvent as ReactPointerEvent } from "react";
import { getIngredient } from "../data/ingredients.ts";
import { getRecipe } from "../data/recipes.ts";
import { keyFromKeyboard } from "../lib/answerInput.ts";
import { allTasksDone, isStirred, STIR_BUTTON_STEP, type Action } from "../game/reducer.ts";
import { STIR_TARGET, type GameState, type Order, type PourEvent } from "../game/types.ts";
import { MeasurePanel } from "./MeasurePanel.tsx";
import { Cauldron, IngredientIcon, PotionBottle } from "./art/PotionArt.tsx";

export const POUR_MS = 1100;
export const BOTTLE_MS = 1600;
/** 솥 너비만큼 움직이면 이만큼 젓기가 진행된다 (솥 너비 약 2배 움직이면 완료) */
const STIR_PER_WIDTH = 50;
const DRAG_THRESHOLD = 8;

interface DragState {
  index: number;
  pointerId: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  active: boolean;
}

export function WorkbenchScene({ state, order, dispatch }: { state: GameState; order: Order; dispatch: Dispatch<Action> }) {
  const recipe = getRecipe(order.recipeId);
  const allDone = allTasksDone(order);
  const stirred = isStirred(order);
  const brewing = order.status === "brewing";
  const active = state.activeTask;
  const activeTask = active !== null ? order.tasks[active] : null;

  /* ---------------- 연출 (화면 효과일 뿐, 진행은 상태가 결정) ---------------- */
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
  const [bottling, setBottling] = useState(false);
  useEffect(() => {
    if (!bottling) return;
    const t = window.setTimeout(() => setBottling(false), BOTTLE_MS);
    return () => window.clearTimeout(t);
  }, [bottling]);
  // 투입 연출은 화면 효과일 뿐이라 다음 재료 조작을 막지 않는다. 병에 담는 동안만 잠근다
  const busy = bottling;

  /* ---------------- 메모·레시피북 접기 ---------------- */
  const [notesOpen, setNotesOpen] = useState(() => (typeof window !== "undefined" ? window.innerWidth >= 1100 : true));
  const [notesTab, setNotesTab] = useState<"memo" | "recipe">("memo");

  /* ---------------- 재료 집기·끌기 ---------------- */
  const [picked, setPicked] = useState<number | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [bounce, setBounce] = useState<number | null>(null);
  const suppressClick = useRef(false);
  const cauldronRef = useRef<HTMLDivElement | null>(null);
  const canPlace = brewing && active === null && !busy;

  useEffect(() => {
    if (!canPlace) setPicked(null);
  }, [canPlace]);
  useEffect(() => {
    if (bounce === null) return;
    const t = window.setTimeout(() => setBounce(null), 450);
    return () => window.clearTimeout(t);
  }, [bounce]);

  const place = useCallback(
    (index: number) => {
      setPicked(null);
      dispatch({ type: "PLACE_INGREDIENT", orderId: order.id, taskIndex: index });
    },
    [dispatch, order.id],
  );

  const overCauldron = (x: number, y: number) => {
    const r = cauldronRef.current?.getBoundingClientRect();
    return !!r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  };

  const onJarPointerDown = (e: ReactPointerEvent<HTMLButtonElement>, index: number) => {
    suppressClick.current = false;
    if (!canPlace || order.tasks[index].status !== "pending" || drag) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDrag({ index, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, x: e.clientX, y: e.clientY, active: false });
  };
  const onJarPointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const moved = Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > DRAG_THRESHOLD;
    setDrag({ ...drag, x: e.clientX, y: e.clientY, active: drag.active || moved });
  };
  const onJarPointerUp = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    if (drag.active) {
      suppressClick.current = true;
      if (overCauldron(e.clientX, e.clientY)) place(drag.index);
      else setBounce(drag.index); // 잘못된 곳 → 선반으로 돌아감
    }
    setDrag(null);
  };
  const onJarClick = (index: number) => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    if (!canPlace || order.tasks[index].status !== "pending") return;
    setPicked((p) => (p === index ? null : index));
  };

  /* ---------------- 젓기 ---------------- */
  const stirMode = brewing && allDone && !stirred && active === null;
  const [stickX, setStickX] = useState(0.5);
  const stirAcc = useRef(0);
  const stirLast = useRef<{ x: number; y: number; id: number } | null>(null);
  const flushStir = (force = false) => {
    const whole = Math.floor(stirAcc.current);
    if (whole >= 5 || (force && whole > 0)) {
      stirAcc.current -= whole;
      let left = whole;
      while (left > 0) {
        const step = Math.min(25, left);
        dispatch({ type: "STIR", orderId: order.id, amount: step });
        left -= step;
      }
    }
  };
  const onCauldronPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!stirMode) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    stirLast.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
  };
  const onCauldronPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const last = stirLast.current;
    const r = cauldronRef.current?.getBoundingClientRect();
    if (r) setStickX((e.clientX - r.left) / r.width);
    if (!stirMode || !last || last.id !== e.pointerId || !r) return;
    const dist = Math.hypot(e.clientX - last.x, e.clientY - last.y);
    stirLast.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    stirAcc.current += (dist / r.width) * STIR_PER_WIDTH;
    flushStir();
  };
  const onCauldronPointerUp = () => {
    flushStir(true);
    stirLast.current = null;
  };

  /* ---------------- 키보드: 숫자 입력, Esc ---------------- */
  const latest = useRef({ activeTask, picked, busy });
  latest.current = { activeTask, picked, busy };
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const { activeTask: t, picked: p, busy: b } = latest.current;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === "Escape" && p !== null) {
        setPicked(null);
        return;
      }
      if (b || !t || t.status !== "pending" || t.mode === "concept") return;
      const target = e.target;
      if (e.key === "Enter") {
        if (e.repeat) return;
        if (target instanceof HTMLElement && target.tagName === "BUTTON" && !target.classList.contains("key")) return;
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

  /* ---------------- 표시 ---------------- */
  const doneColors = order.tasks.filter((t) => t.status === "done").map((t) => getIngredient(t.ingredientId).color);
  const stir = order.stirProgress / STIR_TARGET;
  const step =
    !brewing ? "bottled"
    : active !== null ? "measure"
    : !allDone ? "place"
    : !stirred ? "stir"
    : "bottle";
  const instruction: Record<string, string> = {
    place: picked !== null
      ? `${getIngredient(order.tasks[picked].ingredientId).name}를 집었어요. 솥을 눌러 넣어요.`
      : "재료를 눌러 집고 솥을 누르거나, 재료를 솥으로 끌어다 놓아요.",
    measure: "계량 패널에서 양을 정해요.",
    stir: "막대로 솥을 휘휘 저어요. ‘젓기’ 버튼을 눌러도 돼요.",
    bottle: "다 저었어요! 병에 담아요.",
    bottled: bottling ? "병에 담는 중…" : "포션 완성! 창구로 가져가요.",
  };

  return (
    <div className={`bench ${notesOpen ? "notes-open" : ""} ${active !== null ? "measuring" : ""}`}>
      <header className="bench-bar" aria-label="주문 요약">
        <button type="button" className="btn btn-quiet notes-toggle" onClick={() => setNotesOpen((v) => !v)} aria-expanded={notesOpen} data-testid="notes-toggle">
          📜 {notesOpen ? "메모 접기" : "주문 메모·레시피"}
        </button>
        <div className="bench-order">
          <PotionBottle look={recipe.look} size={30} />
          <span data-testid="order-title">{order.script.memo[0].replace("포션: ", "")}</span>
          {order.rules === 2 && <span className="badge badge-plain">이전 규칙</span>}
        </div>
        <ol className="steps" aria-label="제조 단계">
          {order.tasks.map((t) => {
            const ing = getIngredient(t.ingredientId);
            return (
              <li key={t.problemId} className={t.status === "done" ? "is-done" : ""}>
                {t.status === "done" ? "✓" : "○"} {ing.name}
              </li>
            );
          })}
          <li className={stirred ? "is-done" : ""}>{stirred ? "✓" : "○"} 젓기</li>
          <li className={!brewing ? "is-done" : ""}>{!brewing ? "✓" : "○"} 병에 담기</li>
        </ol>
        <button type="button" className="btn btn-quiet" onClick={() => dispatch({ type: "GO_COUNTER" })} disabled={busy || active !== null} data-testid="to-counter-peek">
          창구 보기
        </button>
      </header>

      <div className="bench-body">
        {notesOpen && (
          <aside className="notes" aria-label="주문 메모와 레시피북" data-testid="notes">
            <div className="tabs" role="tablist">
              <button type="button" role="tab" aria-selected={notesTab === "memo"} className={notesTab === "memo" ? "is-on" : ""} onClick={() => setNotesTab("memo")}>
                주문 메모
              </button>
              <button type="button" role="tab" aria-selected={notesTab === "recipe"} className={notesTab === "recipe" ? "is-on" : ""} onClick={() => setNotesTab("recipe")} data-testid="tab-recipe">
                레시피북
              </button>
            </div>
            {notesTab === "memo" ? (
              <div className="notes-body" data-testid="memo">
                <ul className="memo-list">
                  {order.script.memo.map((m, i) => <li key={i}>{m}</li>)}
                </ul>
                <div className="memo-quote">
                  <span className="memo-label">손님이 한 말</span>
                  <p>“{order.script.original}”</p>
                  {order.askCount > 0 && (
                    <>
                      <span className="memo-label">쉬운 설명</span>
                      <p>{order.script.easy}</p>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="notes-body" data-testid="recipe">
                <div className="recipe-name">
                  <PotionBottle look={recipe.look} size={28} /> {recipe.name} <span className="muted">1병당</span>
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
                          <td data-testid={`recipe-${ad.ingredientId}`}>{ad.amount}{ing.unit}</td>
                          <td className="muted">첨가물</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <p className="recipe-note">첨가물은 기본 용액에 섞는 마법 재료예요. 첨가물을 더한 양이 병 전체의 양은 아니에요.</p>
                <p className="recipe-note">이번 주문의 기본 용액: {order.autoAdditions.map((a) => `${a.amount}${a.unit} (${a.note})`).join(", ")}</p>
              </div>
            )}
          </aside>
        )}

        <section className="station" aria-label="제조대">
          <p className="station-hint" role="status" data-testid="instruction">{instruction[step]}</p>
          <div
            ref={cauldronRef}
            className={`cauldron-zone ${picked !== null || drag?.active ? "is-target" : ""} ${stirMode ? "is-stirring" : ""}`}
            onPointerDown={onCauldronPointerDown}
            onPointerMove={onCauldronPointerMove}
            onPointerUp={onCauldronPointerUp}
            onPointerCancel={onCauldronPointerUp}
            data-testid="cauldron"
          >
            <button
              type="button"
              className="cauldron-button"
              aria-label={picked !== null ? "솥에 넣기" : "솥"}
              onClick={() => picked !== null && canPlace && place(picked)}
              disabled={picked === null || !canPlace}
              data-testid="cauldron-drop"
            >
              <Cauldron doneColors={doneColors} stir={stir} finishColor={recipe.look.liquid} showStick={stirMode || (allDone && stir > 0 && brewing)} stickX={stickX} />
            </button>
            {pourAnim && (
              <div className="pour-overlay" data-testid="pour-anim" aria-hidden="true">
                <div className="pour-label">
                  {getIngredient(pourAnim.ingredientId).name} {pourAnim.amount.length > 8 ? pourAnim.amount.slice(0, 8) + "…" : pourAnim.amount}{pourAnim.unit}
                </div>
                <div className="pour-drops" style={{ color: getIngredient(pourAnim.ingredientId).color }}>
                  <span>●</span><span>●</span><span>●</span>
                </div>
              </div>
            )}
          </div>

          {brewing && (
            <div className="shelf" role="group" aria-label="재료 선반">
              {order.tasks.map((t, i) => {
                const ing = getIngredient(t.ingredientId);
                const state = t.status === "done" ? "넣음" : t.status === "measured" ? "계량함" : i === active ? "솥 위" : "선반";
                const isPicked = picked === i;
                const dragging = drag?.active && drag.index === i;
                return (
                  <button
                    key={t.problemId}
                    type="button"
                    className={`jar ${isPicked ? "is-picked" : ""} ${t.status !== "pending" || i === active ? "is-used" : ""} ${bounce === i ? "is-bounce" : ""} ${dragging ? "is-dragging" : ""}`}
                    aria-pressed={isPicked}
                    aria-label={`${ing.name} (${ing.unit}) ${state}${isPicked ? ", 집음" : ""}`}
                    disabled={t.status !== "pending" || i === active || !canPlace}
                    onPointerDown={(e: ReactPointerEvent<HTMLButtonElement>) => onJarPointerDown(e, i)}
                    onPointerMove={onJarPointerMove}
                    onPointerUp={onJarPointerUp}
                    onPointerCancel={() => setDrag(null)}
                    onClick={() => onJarClick(i)}
                    data-testid={`jar-${t.ingredientId}`}
                  >
                    <IngredientIcon ingredient={ing} size={46} />
                    <span className="jar-name">{ing.name}</span>
                    <span className="jar-unit">{ing.unit} · {state}</span>
                  </button>
                );
              })}
              {picked !== null && (
                <button type="button" className="btn btn-quiet" onClick={() => setPicked(null)} data-testid="unpick">
                  집기 취소
                </button>
              )}
            </div>
          )}

          <div className="station-actions">
            {brewing && allDone && !stirred && (
              <>
                <div className="stir-meter" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={order.stirProgress} aria-label="젓기 진행">
                  <span style={{ width: `${order.stirProgress}%` }} />
                </div>
                <button
                  type="button"
                  className="btn btn-primary btn-big"
                  onClick={() => dispatch({ type: "STIR", orderId: order.id, amount: STIR_BUTTON_STEP })}
                  disabled={busy}
                  data-testid="stir"
                >
                  🌀 젓기
                </button>
              </>
            )}
            {brewing && stirred && (
              <button
                type="button"
                className="btn btn-gold btn-big"
                onClick={() => {
                  dispatch({ type: "COMPLETE_POTION", orderId: order.id });
                  setBottling(true);
                }}
                disabled={busy}
                data-testid="complete"
              >
                🧪 병에 담기
              </button>
            )}
            {!brewing && (
              <div className="bottled-area" data-testid="bottled">
                <div className={`bottle-row ${bottling ? "is-filling" : ""}`}>
                  {Array.from({ length: Math.min(order.bottles, 9) }, (_, i) => (
                    <span key={i} className="bottle-slot" style={{ animationDelay: `${i * 0.1}s` }}>
                      <PotionBottle look={recipe.look} size={42} quality={order.quality} label={`${recipe.name} ${i + 1}번째 병`} />
                    </span>
                  ))}
                </div>
                <button type="button" className="btn btn-primary btn-big" disabled={bottling} onClick={() => dispatch({ type: "GO_COUNTER" })} data-testid="to-counter">
                  창구로 가져가기 →
                </button>
              </div>
            )}
            {state.feedback && active === null && <p className="station-notice" role="status">{state.feedback.title}</p>}
          </div>
        </section>

        <section className={`side-panel ${activeTask ? "is-open" : ""}`} aria-label="계량">
          {activeTask && active !== null ? (
            <MeasurePanel
              order={order}
              task={activeTask}
              index={active}
              draft={state.draftAnswer}
              feedback={state.feedback}
              dispatch={dispatch}
              locked={busy}
            />
          ) : (
            <StepGuide order={order} step={step} />
          )}
        </section>
      </div>

      {drag?.active && (
        <div className="drag-ghost" style={{ left: drag.x, top: drag.y }} aria-hidden="true">
          <IngredientIcon ingredient={getIngredient(order.tasks[drag.index].ingredientId)} size={52} />
        </div>
      )}
    </div>
  );
}

function StepGuide({ order, step }: { order: Order; step: string }) {
  const items = [
    { key: "place", label: "재료를 집어 솥에 놓아요", detail: "누르고 솥 누르기, 또는 끌어다 놓기" },
    { key: "measure", label: "몇 mL·g 넣을지 정해요", detail: "주문 메모와 레시피북을 보고 계산해요" },
    { key: "stir", label: "솥을 저어요", detail: "막대를 움직이거나 ‘젓기’ 버튼" },
    { key: "bottle", label: "병에 담아 창구로", detail: "손님에게 전달해요" },
  ];
  const order_ = ["place", "measure", "stir", "bottle", "bottled"];
  const now = Math.max(0, order_.indexOf(step === "measure" ? "place" : step));
  return (
    <div className="guide" data-testid="guide">
      <h2 className="guide-title">만드는 순서</h2>
      <ol>
        {items.map((it, i) => (
          <li key={it.key} className={i < now || (it.key === "measure" && order.tasks.every((t) => t.status === "done")) ? "is-done" : i === now ? "is-now" : ""}>
            <strong>{it.label}</strong>
            <span>{it.detail}</span>
          </li>
        ))}
      </ol>
      <p className="muted small">계산식은 힌트를 누르면 볼 수 있어요. 힌트를 봐도 판매금은 줄지 않아요.</p>
    </div>
  );
}
