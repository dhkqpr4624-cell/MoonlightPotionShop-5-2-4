/**
 * 제조대 (Phase 4). 가운데 큰 솥, 아래 나무 작업대 위 재료 용기, 한쪽에 접는 주문 메모·레시피북, 다른 쪽에 계량·해설 패널.
 *
 * 재료 옮기기 (같은 게임 행동 PLACE_INGREDIENT)
 *  ① 재료 클릭(집기) → 솥 클릭(놓기)   ② 재료를 끌어서 솥에 놓기   ③ 키보드 Enter·Tab·Enter, Esc 취소
 *  솥이 아닌 곳에 놓으면 재료는 선반으로 돌아간다.
 *
 * 젓기 (버튼 없음): 막대(또는 솥 안 액체)를 잡고 움직인다.
 *  - 이동량은 솥 액체 크기로 정규화해 누적한다(StirTracker). 프레임 수·화면 크기와 무관.
 *  - pointer capture로 한 손가락만 추적. 놓기·취소·포인터 잃음·창 포커스 잃음·화면 숨김에 젓기 종료.
 *  - 막대 위치·소용돌이는 ref로 직접 바꿔 드래그 중 화면 전체가 다시 그려지지 않는다.
 *  - 키보드: 솥에 초점을 두고 ←/→ 로 막대를 좌우로 옮긴다(실제로 움직인 만큼 진행).
 */
import { useCallback, useEffect, useRef, useState, type Dispatch, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { getIngredient } from "../data/ingredients.ts";
import { getRecipe } from "../data/recipes.ts";
import { SHOP_ART } from "../data/shopArt.ts";
import { keyFromKeyboard } from "../lib/answerInput.ts";
import { assetUrl } from "../lib/assets.ts";
import { playSfx, startStir, stopStir, updateStir } from "../audio/sfx.ts";
import { allTasksDone, isStirred, type Action } from "../game/reducer.ts";
import { clampTip, KEY_STEP, StirTracker, type Point } from "../game/stirInput.ts";
import { STIR_TARGET, type GameState, type Order, type PourEvent } from "../game/types.ts";
import { Icon } from "./Icon.tsx";
import { MeasurePanel } from "./MeasurePanel.tsx";
import { Cauldron, CAULDRON_VIEWBOX, IngredientArt, LIQUID, PotionBottle } from "./art/PotionArt.tsx";

export const POUR_MS = 1200;
export const BOTTLE_MS = 1600;
const DRAG_THRESHOLD = 8;
/** 손 움직임을 받는 세로 반지름 (액체 타원은 납작하지만 손은 더 크게 위아래로 움직인다) */
const HAND_RY = LIQUID.rx * 0.55;

interface DragInfo {
  index: number;
  pointerId: number;
  startX: number;
  startY: number;
  active: boolean;
}

export function WorkbenchScene({ state, order, dispatch }: { state: GameState; order: Order; dispatch: Dispatch<Action> }) {
  const recipe = getRecipe(order.recipeId);
  const allDone = allTasksDone(order);
  const stirred = isStirred(order);
  const brewing = order.status === "brewing";
  const active = state.activeTask;
  const activeTask = active !== null ? order.tasks[active] : null;

  /* ---------------- 연출 (화면 효과일 뿐, 진행은 저장 상태가 결정) ---------------- */
  const [pourAnim, setPourAnim] = useState<PourEvent | null>(null);
  const seenSeq = useRef(state.pour?.seq ?? 0);
  useEffect(() => {
    if (state.pour && state.pour.seq !== seenSeq.current) {
      seenSeq.current = state.pour.seq;
      setPourAnim(state.pour);
      playSfx(getIngredient(state.pour.ingredientId).kind === "powder" ? "pourPowder" : "pourLiquid");
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

  // 이번 화면에서 젓기를 끝낸 순간만 빛·소리 (새로고침 후엔 재생하지 않음)
  const [burst, setBurst] = useState(false);
  const prevStir = useRef(order.stirProgress);
  useEffect(() => {
    if (prevStir.current < STIR_TARGET && order.stirProgress >= STIR_TARGET) {
      setBurst(true);
      playSfx("complete");
    }
    prevStir.current = order.stirProgress;
  }, [order.stirProgress]);
  useEffect(() => {
    if (!burst) return;
    const t = window.setTimeout(() => setBurst(false), 1000);
    return () => window.clearTimeout(t);
  }, [burst]);

  const busy = bottling;

  /* ---------------- 메모·레시피북 접기 ---------------- */
  const [notesOpen, setNotesOpen] = useState(() => (typeof window !== "undefined" ? window.innerWidth >= 1100 : true));
  const [notesTab, setNotesTab] = useState<"memo" | "recipe">("memo");

  /* ---------------- 재료 집기·끌기 ---------------- */
  const [picked, setPicked] = useState<number | null>(null);
  const [drag, setDrag] = useState<DragInfo | null>(null);
  const dragRef = useRef<DragInfo | null>(null);
  const ghostRef = useRef<HTMLDivElement | null>(null);
  const [bounce, setBounce] = useState<number | null>(null);
  const suppressClick = useRef(false);
  const zoneRef = useRef<HTMLDivElement | null>(null);
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
      playSfx("drop");
      dispatch({ type: "PLACE_INGREDIENT", orderId: order.id, taskIndex: index });
    },
    [dispatch, order.id],
  );

  const overCauldron = (x: number, y: number) => {
    const r = zoneRef.current?.getBoundingClientRect();
    return !!r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  };

  const moveGhost = (x: number, y: number) => {
    if (ghostRef.current) ghostRef.current.style.transform = `translate(${x}px, ${y}px)`;
  };
  const endDrag = () => {
    dragRef.current = null;
    setDrag(null);
  };
  const onJarPointerDown = (e: ReactPointerEvent<HTMLButtonElement>, index: number) => {
    suppressClick.current = false;
    if (!canPlace || order.tasks[index].status !== "pending" || dragRef.current) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragRef.current = { index, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, active: false };
  };
  const onJarPointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    if (!d.active && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > DRAG_THRESHOLD) {
      d.active = true;
      setDrag({ ...d });
      playSfx("pick");
    }
    if (d.active) moveGhost(e.clientX, e.clientY);
  };
  const onJarPointerUp = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    if (d.active) {
      suppressClick.current = true;
      if (overCauldron(e.clientX, e.clientY)) place(d.index);
      else setBounce(d.index); // 잘못된 곳 → 선반으로 돌아감
    }
    endDrag();
  };
  useEffect(() => {
    if (drag?.active && dragRef.current) moveGhost(dragRef.current.startX, dragRef.current.startY);
  }, [drag]);
  const onJarClick = (index: number) => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    if (!canPlace || order.tasks[index].status !== "pending") return;
    setPicked((p) => (p === index ? null : index));
  };

  /* ---------------- 젓기 ---------------- */
  const stirMode = brewing && allDone && !stirred && active === null && !busy;
  const tracker = useRef(new StirTracker());
  const stickRef = useRef<SVGGElement | null>(null);
  const swirlRef = useRef<SVGGElement | null>(null);
  const swirlAngle = useRef(0);
  const [holding, setHolding] = useState(false);
  const orderIdRef = useRef(order.id);
  orderIdRef.current = order.id;

  const drawStick = useCallback((tip: Point) => {
    const x = LIQUID.cx + tip.x * LIQUID.rx;
    const y = LIQUID.cy + tip.y * LIQUID.ry;
    stickRef.current?.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
    stickRef.current?.querySelector(".stir-stick-body")?.setAttribute("transform", `rotate(${(tip.x * 16).toFixed(1)})`);
    swirlRef.current?.setAttribute("transform", `rotate(${swirlAngle.current.toFixed(1)})`);
  }, []);

  useEffect(() => {
    // 막대가 처음 보일 때 기본 위치
    if (stickRef.current) drawStick(tracker.current.tip);
  });

  const sendStir = useCallback(
    (amount: number) => {
      let left = amount;
      while (left > 0) {
        const step = Math.min(25, left);
        dispatch({ type: "STIR", orderId: orderIdRef.current, amount: step });
        left -= step;
      }
    },
    [dispatch],
  );

  const toTip = (clientX: number, clientY: number): Point | null => {
    const svg = zoneRef.current?.querySelector("svg.cauldron");
    const r = svg?.getBoundingClientRect();
    if (!r || r.width === 0) return null;
    const v = CAULDRON_VIEWBOX;
    const sx = v.x + ((clientX - r.left) / r.width) * v.w;
    const sy = v.y + ((clientY - r.top) / r.height) * v.h;
    return { x: (sx - LIQUID.cx) / LIQUID.rx, y: (sy - LIQUID.cy) / HAND_RY };
  };

  const finishStir = useCallback(
    (pointerId?: number) => {
      const t = tracker.current;
      if (!t.active) return;
      const rest = t.end(pointerId);
      if (rest > 0) sendStir(rest);
      stopStir();
      setHolding(false);
    },
    [sendStir],
  );

  const onZonePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!stirMode) return;
    const p = toTip(e.clientX, e.clientY);
    if (!p) return;
    if (!tracker.current.begin(e.pointerId, p)) return; // 다른 손가락이 이미 잡고 있음
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* 무시 */
    }
    setHolding(true);
    startStir();
    drawStick(tracker.current.tip);
  };
  const onZonePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const t = tracker.current;
    if (!t.active || e.pointerId !== t.pointerId) return;
    const p = toTip(e.clientX, e.clientY);
    if (!p) return;
    const before = t.tip;
    const gained = t.move(e.pointerId, p);
    const after = t.tip;
    const cross = before.x * after.y - before.y * after.x;
    swirlAngle.current += Math.sign(cross || after.x - before.x) * Math.hypot(after.x - before.x, after.y - before.y) * 120;
    drawStick(after);
    updateStir(t.speed);
    if (gained > 0) sendStir(gained);
  };
  const onZonePointerEnd = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (tracker.current.pointerId !== e.pointerId) return;
    finishStir(e.pointerId);
  };

  // 창 포커스를 잃거나 화면이 숨겨지면 젓기를 멈춘다
  useEffect(() => {
    const stop = () => finishStir();
    const onVis = () => {
      if (document.visibilityState === "hidden") finishStir();
    };
    window.addEventListener("blur", stop);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("blur", stop);
      document.removeEventListener("visibilitychange", onVis);
      finishStir();
      stopStir();
    };
  }, [finishStir]);
  // 젓기가 끝나면(완료·다른 단계) 잡고 있던 것을 놓는다
  useEffect(() => {
    if (!stirMode) finishStir();
  }, [stirMode, finishStir]);

  const onZoneKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!stirMode || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
    e.preventDefault();
    const t = tracker.current;
    const from = t.tip;
    const dir = e.key === "ArrowLeft" ? -1 : 1;
    const target = clampTip({ x: from.x + dir * KEY_STEP, y: from.y });
    t.begin(-1, from);
    let gained = t.move(-1, { x: (from.x + target.x) / 2, y: from.y }, 1000);
    gained += t.move(-1, target, 1000);
    gained += t.end(-1);
    swirlAngle.current += dir * 40;
    drawStick(t.tip);
    if (gained > 0) {
      playSfx("page");
      sendStir(gained);
    }
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
  const step = !brewing ? "bottled" : active !== null ? "measure" : !allDone ? "place" : !stirred ? "stir" : "bottle";
  const pickedName = picked !== null ? getIngredient(order.tasks[picked].ingredientId).name : "";
  const instruction: Record<string, string> = {
    place: picked !== null ? `${pickedName}를 집었어요. 솥을 눌러 넣어요.` : "재료를 눌러 집고 솥을 누르거나, 재료를 솥으로 끌어다 놓아요.",
    measure: "계량 패널에서 양을 정해요.",
    stir: "막대를 잡고 움직여 포션을 저어 주세요.",
    bottle: "다 저었어요! 병에 담아요.",
    bottled: bottling ? "병에 담는 중…" : "포션 완성! 창구로 가져가요.",
  };
  const pourIng = pourAnim ? getIngredient(pourAnim.ingredientId) : null;
  const showStick = brewing && allDone;

  return (
    <div className={`bench ${notesOpen ? "notes-open" : ""} ${active !== null ? "measuring" : ""}`}>
      <header className="bench-bar" aria-label="주문 요약">
        <button type="button" className="btn btn-quiet notes-toggle" onClick={() => setNotesOpen((v) => !v)} aria-expanded={notesOpen} data-testid="notes-toggle" data-sfx="page">
          <Icon name="memo" size={20} /> {notesOpen ? "메모 접기" : "주문 메모·레시피"}
        </button>
        <div className="bench-order">
          <PotionBottle look={recipe.look} size={28} />
          <span data-testid="order-title">{order.script.memo[0].replace("포션: ", "")}</span>
          {order.rules === 2 && <span className="badge badge-plain">이전 규칙</span>}
        </div>
        <ol className="steps" aria-label="제조 단계">
          {order.tasks.map((t) => (
            <StepChip key={t.problemId} done={t.status === "done"} label={getIngredient(t.ingredientId).name} />
          ))}
          <StepChip done={stirred} label="젓기" />
          <StepChip done={!brewing} label="병에 담기" />
        </ol>
        <button type="button" className="btn btn-quiet" onClick={() => dispatch({ type: "GO_COUNTER" })} disabled={busy || active !== null} data-testid="to-counter-peek">
          창구 보기
        </button>
      </header>

      <div className="bench-body">
        {notesOpen && (
          <aside className="notes" aria-label="주문 메모와 레시피북" data-testid="notes">
            <div className="tabs" role="tablist">
              <button type="button" role="tab" aria-selected={notesTab === "memo"} className={notesTab === "memo" ? "is-on" : ""} onClick={() => setNotesTab("memo")} data-sfx="page">
                <Icon name="memo" size={18} /> 주문 메모
              </button>
              <button type="button" role="tab" aria-selected={notesTab === "recipe"} className={notesTab === "recipe" ? "is-on" : ""} onClick={() => setNotesTab("recipe")} data-testid="tab-recipe" data-sfx="page">
                <Icon name="book" size={18} /> 레시피북
              </button>
            </div>
            {notesTab === "memo" ? (
              <div className="notes-body memo-paper" data-testid="memo">
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
              <div className="notes-body book-paper" data-testid="recipe">
                <div className="recipe-name">
                  <PotionBottle look={recipe.look} size={30} /> {recipe.name} <span className="muted">1병당</span>
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

        <section className="station" aria-label="제조대" style={{ backgroundImage: `url("${assetUrl(SHOP_ART.workbench)}")` }}>
          <p className="station-hint" role="status" data-testid="instruction">
            {step === "stir" && <Icon name="hand" size={20} />} {instruction[step]}
          </p>
          <div
            ref={zoneRef}
            className={`cauldron-zone ${picked !== null || drag?.active ? "is-target" : ""} ${stirMode ? "is-stirring" : ""} ${holding ? "is-holding" : ""}`}
            onPointerDown={onZonePointerDown}
            onPointerMove={onZonePointerMove}
            onPointerUp={onZonePointerEnd}
            onPointerCancel={onZonePointerEnd}
            onLostPointerCapture={onZonePointerEnd}
            onKeyDown={onZoneKeyDown}
            tabIndex={stirMode ? 0 : -1}
            role={stirMode ? "slider" : undefined}
            aria-label={stirMode ? "젓는 막대 (좌우 화살표로도 저을 수 있어요)" : undefined}
            aria-valuemin={stirMode ? 0 : undefined}
            aria-valuemax={stirMode ? 100 : undefined}
            aria-valuenow={stirMode ? order.stirProgress : undefined}
            aria-valuetext={stirMode ? `젓기 ${order.stirProgress}%` : undefined}
            data-testid="cauldron"
          >
            {picked !== null && canPlace ? (
              <button type="button" className="cauldron-button" aria-label="솥에 넣기" onClick={() => place(picked)} data-testid="cauldron-drop" data-sfx="none">
                <Cauldron doneColors={doneColors} stir={stir} finishColor={recipe.look.liquid} showStick={false} />
              </button>
            ) : (
              <div className="cauldron-art">
                <Cauldron
                  doneColors={doneColors}
                  stir={stir}
                  finishColor={recipe.look.liquid}
                  showStick={showStick}
                  stickRef={stickRef}
                  swirlRef={swirlRef}
                  burst={burst}
                />
              </div>
            )}
            {stirMode && !holding && (
              <span className="grab-hint" aria-hidden="true">
                <Icon name="hand" size={30} />
              </span>
            )}
            {pourAnim && pourIng && (
              <div className={`pour-overlay pour-${pourIng.kind}`} data-testid="pour-anim" aria-hidden="true" key={pourAnim.seq}>
                <div className="pour-vessel">
                  <IngredientArt ingredient={pourIng} size={74} />
                </div>
                <div className="pour-stream" style={{ color: pourIng.color }}>
                  {pourIng.kind === "powder" ? (
                    <>
                      <i /><i /><i /><i /><i /><i />
                    </>
                  ) : (
                    <b />
                  )}
                </div>
                <div className="pour-label">
                  {pourIng.name} {pourAnim.amount.length > 8 ? pourAnim.amount.slice(0, 8) + "…" : pourAnim.amount}
                  {pourAnim.unit}
                </div>
              </div>
            )}
          </div>

          {brewing && allDone && !stirred && (
            <div className="stir-status">
              <div className="stir-meter" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={order.stirProgress} aria-label="젓기 진행" data-testid="stir-meter">
                <span style={{ width: `${order.stirProgress}%` }} />
              </div>
              <span className="stir-pct">{order.stirProgress}%</span>
            </div>
          )}

          <div className="table-top">
            {brewing && (
              <div className="shelf" role="group" aria-label="재료 선반">
                {order.tasks.map((t, i) => {
                  const ing = getIngredient(t.ingredientId);
                  const label = t.status === "done" ? "넣음" : t.status === "measured" ? "계량함" : i === active ? "솥 위" : "선반";
                  const isPicked = picked === i;
                  const dragging = drag?.active && drag.index === i;
                  return (
                    <button
                      key={t.problemId}
                      type="button"
                      className={`jar ${isPicked ? "is-picked" : ""} ${t.status !== "pending" || i === active ? "is-used" : ""} ${bounce === i ? "is-bounce" : ""} ${dragging ? "is-dragging" : ""}`}
                      aria-pressed={isPicked}
                      aria-label={`${ing.name} (${ing.unit}) ${label}${isPicked ? ", 집음" : ""}`}
                      disabled={t.status !== "pending" || i === active || !canPlace}
                      onPointerDown={(e: ReactPointerEvent<HTMLButtonElement>) => onJarPointerDown(e, i)}
                      onPointerMove={onJarPointerMove}
                      onPointerUp={onJarPointerUp}
                      onPointerCancel={endDrag}
                      onClick={() => onJarClick(i)}
                      data-testid={`jar-${t.ingredientId}`}
                      data-sfx="pick"
                    >
                      <IngredientArt ingredient={ing} size={64} />
                      <span className="jar-name">{ing.name}</span>
                      <span className="jar-unit">
                        {t.status === "done" && <Icon name="check" size={14} />} {ing.unit} · {label}
                      </span>
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
                  data-sfx="bottle"
                >
                  <Icon name="potion" /> 병에 담기
                </button>
              )}
              {!brewing && (
                <div className="bottled-area" data-testid="bottled">
                  <div className={`bottle-row ${bottling ? "is-filling" : ""}`} style={{ backgroundImage: `url("${assetUrl(SHOP_ART.tray)}")` }}>
                    {Array.from({ length: Math.min(order.bottles, 9) }, (_, i) => (
                      <span key={i} className="bottle-slot" style={{ animationDelay: `${i * 0.1}s` }}>
                        <PotionBottle look={recipe.look} size={40} quality={order.quality} label={`${recipe.name} ${i + 1}번째 병`} />
                      </span>
                    ))}
                  </div>
                  <button type="button" className="btn btn-primary btn-big" disabled={bottling} onClick={() => dispatch({ type: "GO_COUNTER" })} data-testid="to-counter">
                    창구로 가져가기 <Icon name="arrow" />
                  </button>
                </div>
              )}
              {state.feedback && active === null && <p className="station-notice" role="status">{state.feedback.title}</p>}
            </div>
          </div>
        </section>

        <section className={`side-panel ${activeTask ? "is-open" : ""}`} aria-label="계량">
          {activeTask && active !== null ? (
            <MeasurePanel order={order} task={activeTask} index={active} draft={state.draftAnswer} feedback={state.feedback} dispatch={dispatch} locked={busy} />
          ) : (
            <StepGuide order={order} step={step} />
          )}
        </section>
      </div>

      {drag?.active && (
        <div className="drag-ghost" ref={ghostRef} aria-hidden="true">
          <span className="drag-ghost-inner">
            <IngredientArt ingredient={getIngredient(order.tasks[drag.index].ingredientId)} size={70} />
          </span>
        </div>
      )}
    </div>
  );
}

function StepChip({ done, label }: { done: boolean; label: string }) {
  return (
    <li className={done ? "is-done" : ""}>
      {done ? <Icon name="check" size={14} /> : <span className="dot" aria-hidden="true" />} {label}
      <span className="sr-only">{done ? " 완료" : " 아직"}</span>
    </li>
  );
}

function StepGuide({ order, step }: { order: Order; step: string }) {
  const items = [
    { key: "place", label: "재료를 집어 솥에 놓아요", detail: "누르고 솥 누르기, 또는 끌어다 놓기" },
    { key: "measure", label: "몇 mL·g 넣을지 정해요", detail: "주문 메모와 레시피북을 보고 계산해요" },
    { key: "stir", label: "막대로 솥을 저어요", detail: "막대를 잡고 휘휘 움직이기" },
    { key: "bottle", label: "병에 담아 창구로", detail: "손님에게 전달해요" },
  ];
  const seq = ["place", "measure", "stir", "bottle", "bottled"];
  const now = Math.max(0, seq.indexOf(step === "measure" ? "place" : step));
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
