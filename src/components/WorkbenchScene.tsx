/**
 * 제작대 (탑뷰, PNG 배경 한 장).
 *
 * 화면 구성
 *  - 배경: public/assets/shop/workbench/table.png 를 자르거나 늘리지 않고 장면 상자 안에 통째로 맞춘다(바깥은 단색 여백).
 *  - 모든 물건·클릭 영역은 PNG 픽셀 좌표(data/shopArt.ts WORKBENCH_SCENE)로 정하고, 같은 함수(rect)로 화면 좌표로 바꾼다.
 *    포인터 좌표도 같은 장면 좌표로 거꾸로 바꿔서(toCanvas) 판정하므로, 여백이 생겨도 그림과 클릭 영역이 어긋나지 않는다.
 *  - 맨 왼쪽 위 서랍: 기력초 더미 / 가운데 항아리: 물약(SVG, 항아리 안쪽 타원으로 잘라 냄)과 젓는 막대
 *  - 왼쪽 아래 레시피북, 오른쪽 아래 주문서 → 책 모양 팝업 (BookPopup)
 *  - 계량 패널: 넓은 화면은 항아리와 주문서 사이(병 받침 위)에 겹쳐서, 세로 화면은 제작대 아래에
 *
 * 재료 옮기기 (같은 게임 행동 PLACE_INGREDIENT)
 *  ① 서랍 클릭(집기) → 항아리 클릭   ② 서랍에서 끌어서 항아리에 놓기   ③ 키보드 Enter·Tab·Enter, Esc 취소
 *  항아리 밖에 놓으면 아무 상태도 바뀌지 않는다. 서랍의 재료는 줄어들지 않는다(무제한 공급원).
 *
 * 젓기 (버튼 없음): 막대(또는 항아리 안 액체)를 잡고 움직인다. 이동량은 액체 크기로 정규화해 누적한다(StirTracker).
 *  pointer capture로 한 손가락만, 놓기·취소·포인터 잃음·창 포커스 잃음·화면 숨김·팝업 열림에 젓기 종료.
 *  막대·소용돌이는 ref로 직접 바꿔 드래그 중 화면 전체가 다시 그려지지 않는다. 키보드: 항아리에 초점 → ←/→.
 */
import {
  useCallback, useEffect, useLayoutEffect, useRef, useState,
  type CSSProperties, type Dispatch, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type RefObject,
} from "react";
import { getIngredient, type Ingredient } from "../data/ingredients.ts";
import { getRecipe } from "../data/recipes.ts";
import { WORKBENCH_SCENE as WB } from "../data/shopArt.ts";
import { keyFromKeyboard } from "../lib/answerInput.ts";
import { assetUrl } from "../lib/assets.ts";
import { playSfx, startStir, stopStir, updateStir } from "../audio/sfx.ts";
import { allTasksDone, isStirred, type Action } from "../game/reducer.ts";
import { clampTip, KEY_STEP, StirTracker, type Point } from "../game/stirInput.ts";
import { STIR_TARGET, type GameState, type Order, type PourEvent } from "../game/types.ts";
import { Icon } from "./Icon.tsx";
import { MeasurePanel } from "./MeasurePanel.tsx";
import { BookPopup, type BookKind } from "./BookPopup.tsx";
import { IngredientArt, PotionBottle } from "./art/PotionArt.tsx";
import { EnergyHerbPile } from "./art/HerbArt.tsx";

export const POUR_MS = 1200;
export const BOTTLE_MS = 1600;
const DRAG_THRESHOLD = 8;

/** 액체 수면 (항아리 안쪽 타원보다 조금 작게: 안쪽 벽이 보이게) */
const POT = WB.pot.inner;
const LIQ = { cx: POT.cx, cy: POT.cy + 10, rx: POT.rx - 14, ry: POT.ry - 14 };
const RIM = WB.pot.rim;

interface Box { x: number; y: number; width: number; height: number }

/* ---------------- 장면 배치 ---------------- */
interface BenchLayout {
  s: number;
  left: number;
  top: number;
  width: number;
  height: number;
  /** 세로 화면: 제작대 아래에 패널 자리 */
  stacked: boolean;
  dockTop: number;
}

const DOCK_MIN = 240;

function computeBench(w: number, h: number): BenchLayout {
  const s = Math.max(0.05, Math.min(w / WB.width, h / WB.height));
  const cw = WB.width * s;
  const ch = WB.height * s;
  const stacked = h - ch >= DOCK_MIN;
  const top = stacked ? 0 : (h - ch) / 2;
  return { s, left: (w - cw) / 2, top, width: w, height: h, stacked, dockTop: top + ch };
}

function useBenchLayout(ref: RefObject<HTMLDivElement | null>): BenchLayout {
  const [l, setL] = useState<BenchLayout>(() => computeBench(typeof window !== "undefined" ? window.innerWidth : 1180, typeof window !== "undefined" ? window.innerHeight - 130 : 640));
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const next = computeBench(el.clientWidth, el.clientHeight);
      setL((p) => (Math.abs(p.s - next.s) < 0.0005 && Math.abs(p.width - next.width) < 0.5 && Math.abs(p.height - next.height) < 0.5 ? p : next));
    };
    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return l;
}

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

  const stageRef = useRef<HTMLDivElement | null>(null);
  const L = useBenchLayout(stageRef);
  /** 캔버스 좌표 상자 → 화면(장면 상자 기준) 스타일 */
  const rect = (b: Box): CSSProperties => ({ left: L.left + b.x * L.s, top: L.top + b.y * L.s, width: b.width * L.s, height: b.height * L.s });
  /** 화면 좌표(client) → 캔버스 좌표 */
  const toCanvas = (clientX: number, clientY: number): Point | null => {
    const r = stageRef.current?.getBoundingClientRect();
    if (!r || L.s <= 0) return null;
    return { x: (clientX - r.left - L.left) / L.s, y: (clientY - r.top - L.top) / L.s };
  };
  const inRim = (p: Point | null) => !!p && ((p.x - RIM.cx) / RIM.rx) ** 2 + ((p.y - RIM.cy) / RIM.ry) ** 2 <= 1;

  /* ---------------- 팝업 (레시피·주문서) ---------------- */
  const [popup, setPopup] = useState<BookKind | null>(null);
  const bookBtn = useRef<HTMLButtonElement | null>(null);
  const clipBtn = useRef<HTMLButtonElement | null>(null);
  const popupOpen = popup !== null;

  /* ---------------- 연출 (화면 효과일 뿐, 진행은 저장 상태가 결정) ---------------- */
  const [pourAnim, setPourAnim] = useState<PourEvent | null>(null);
  const seenSeq = useRef(state.pour?.seq ?? 0);
  useEffect(() => {
    if (state.pour && state.pour.seq !== seenSeq.current) {
      seenSeq.current = state.pour.seq;
      setPourAnim(state.pour);
      const kind = getIngredient(state.pour.ingredientId).kind;
      playSfx(kind === "liquid" ? "pourLiquid" : "pourPowder");
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

  /* ---------------- 재료 집기·끌기 ---------------- */
  const [picked, setPicked] = useState<number | null>(null);
  const [drag, setDrag] = useState<DragInfo | null>(null);
  const dragRef = useRef<DragInfo | null>(null);
  const ghostRef = useRef<HTMLDivElement | null>(null);
  const [bounce, setBounce] = useState<number | null>(null);
  const suppressClick = useRef(false);
  const canPlace = brewing && active === null && !busy && !popupOpen;

  useEffect(() => {
    if (!brewing || active !== null || busy) setPicked(null);
  }, [brewing, active, busy]);
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

  const moveGhost = (x: number, y: number) => {
    if (ghostRef.current) ghostRef.current.style.transform = `translate(${x}px, ${y}px)`;
  };
  const endDrag = useCallback(() => {
    dragRef.current = null;
    setDrag(null);
  }, []);
  const onJarPointerDown = (e: ReactPointerEvent<HTMLButtonElement>, index: number) => {
    suppressClick.current = false;
    if (!canPlace || order.tasks[index].status !== "pending" || dragRef.current) return; // 두 번째 손가락은 무시
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* 무시 */
    }
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
    if (d.active) {
      moveGhost(e.clientX, e.clientY);
      setOverPot(inRim(toCanvas(e.clientX, e.clientY)));
    }
  };
  const [overPot, setOverPot] = useState(false);
  const onJarPointerUp = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    if (d.active) {
      suppressClick.current = true; // 드래그 뒤에 따라오는 click은 한 번 무시
      if (canPlace && inRim(toCanvas(e.clientX, e.clientY))) place(d.index);
      else setBounce(d.index); // 항아리 밖 → 서랍으로 돌아감(상태 변화 없음)
    }
    setOverPot(false);
    endDrag();
  };
  const onJarPointerCancel = () => {
    setOverPot(false);
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
  const stirMode = brewing && allDone && !stirred && active === null && !busy && !popupOpen;
  const tracker = useRef(new StirTracker());
  const stickRef = useRef<SVGGElement | null>(null);
  const swirlRef = useRef<SVGGElement | null>(null);
  const rippleRef = useRef<SVGGElement | null>(null);
  const swirlAngle = useRef(0);
  const [holding, setHolding] = useState(false);
  const orderIdRef = useRef(order.id);
  orderIdRef.current = order.id;

  const drawStick = useCallback((tip: Point) => {
    const x = LIQ.cx + tip.x * LIQ.rx;
    const y = LIQ.cy + tip.y * LIQ.ry;
    // 막대는 끝이 액체에 잠기고 손잡이는 항아리 오른쪽 위 테두리 너머로 걸친다. 끝이 움직이면 기울기만 조금 바뀐다
    const ang = -32 + tip.x * 10 + tip.y * 6;
    stickRef.current?.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${ang.toFixed(1)})`);
    rippleRef.current?.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
    swirlRef.current?.setAttribute("transform", `rotate(${swirlAngle.current.toFixed(1)} ${LIQ.cx} ${LIQ.cy})`);
  }, []);

  useEffect(() => {
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
    const c = toCanvas(clientX, clientY);
    if (!c) return null;
    return { x: (c.x - LIQ.cx) / LIQ.rx, y: (c.y - LIQ.cy) / LIQ.ry };
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
  // 젓기가 끝나면(완료·다른 단계·팝업 열림) 잡고 있던 것을 놓는다
  useEffect(() => {
    if (!stirMode) finishStir();
  }, [stirMode, finishStir]);

  const openPopup = (kind: BookKind) => {
    // 끌던 재료·잡던 막대를 안전하게 놓는다 (제조 상태는 바뀌지 않음)
    finishStir();
    setOverPot(false);
    endDrag();
    setPopup(kind);
  };
  const closePopup = () => {
    const kind = popup;
    setPopup(null);
    window.setTimeout(() => (kind === "recipe" ? bookBtn.current : clipBtn.current)?.focus(), 0);
  };

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
  const latest = useRef({ activeTask, picked, busy, popupOpen });
  latest.current = { activeTask, picked, busy, popupOpen };
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const { activeTask: t, picked: p, busy: b, popupOpen: po } = latest.current;
      if (po) return; // 팝업이 열려 있으면 팝업이 키를 받는다
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
  const doneIngs = order.tasks.filter((t) => t.status === "done").map((t) => getIngredient(t.ingredientId));
  const stir = order.stirProgress / STIR_TARGET;
  const baseColor = "#7fb6c4";
  // 기본 용액(옅은 청록) → 재료를 넣으면 재료 색이 섞이고 → 저을수록 완성 빛깔로
  const mixed = doneIngs.reduce((c, ing, i) => blend(c, ing.color, i === 0 ? 0.7 : 0.5), baseColor);
  const liquidColor = !brewing || stirred ? recipe.look.liquid : stir > 0 ? blend(mixed, recipe.look.liquid, stir) : mixed;
  const step = !brewing ? "bottled" : active !== null ? "measure" : !allDone ? "place" : !stirred ? "stir" : "bottle";
  const pickedIng = picked !== null ? getIngredient(order.tasks[picked].ingredientId) : null;
  const instruction: Record<string, string> = {
    place: pickedIng ? `${pickedIng.name}를 집었어요. 항아리를 눌러 넣어요.` : "서랍의 재료를 눌러 집고 항아리를 누르거나, 재료를 항아리로 끌어다 놓아요.",
    measure: "계량 패널에서 양을 정해요. 레시피북과 주문서를 다시 볼 수 있어요.",
    stir: "막대를 잡고 움직여 포션을 저어 주세요.",
    bottle: "다 저었어요! 병에 담아요.",
    bottled: bottling ? "병에 담는 중…" : "포션 완성! 창구로 가져가요.",
  };
  const pourIng = pourAnim ? getIngredient(pourAnim.ingredientId) : null;
  const showStick = brewing && allDone;
  const targeting = canPlace && (picked !== null || !!drag?.active);
  const sceneBox: Box = { x: 0, y: 0, width: WB.width, height: WB.height };
  const panelStyle: CSSProperties = L.stacked
    ? { left: 8, right: 8, top: L.dockTop + 8, bottom: 8 }
    : (() => {
        const left0 = L.left + 975 * L.s;
        const width = Math.max(320, 500 * L.s);
        return { left: Math.max(8, Math.min(left0, L.left + 1475 * L.s - width)), width, top: L.top + 14 * L.s, height: Math.max(260, 912 * L.s) };
      })();

  const actions = (
    <>
      {brewing && stirred && (
        <button
          type="button"
          className="btn btn-gold btn-big"
          onClick={() => {
            dispatch({ type: "COMPLETE_POTION", orderId: order.id });
            setBottling(true);
          }}
          disabled={busy || popupOpen}
          data-testid="complete"
          data-sfx="bottle"
        >
          <Icon name="potion" /> 병에 담기
        </button>
      )}
      {!brewing && (
        <button type="button" className="btn btn-primary btn-big" disabled={bottling || popupOpen} onClick={() => dispatch({ type: "GO_COUNTER" })} data-testid="to-counter">
          창구로 가져가기 <Icon name="arrow" />
        </button>
      )}
      {state.feedback && active === null && <p className="station-notice" role="status">{state.feedback.title}</p>}
    </>
  );
  const meter = brewing && allDone && !stirred && (
    <div className="stir-status">
      <div className="stir-meter" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={order.stirProgress} aria-label="젓기 진행" data-testid="stir-meter">
        <span style={{ width: `${order.stirProgress}%` }} />
      </div>
      <span className="stir-pct">{order.stirProgress}%</span>
    </div>
  );

  return (
    <div className={`bench bench--top ${active !== null ? "measuring" : ""}`}>
      <header className="bench-bar" aria-label="주문 요약">
        <div className="bench-order">
          <PotionBottle look={recipe.look} size={28} />
          <span data-testid="order-title">{order.script.memo[0].replace("포션: ", "")}</span>
          {order.rules === 2 && <span className="badge badge-plain">이전 규칙</span>}
          {recipe.legacy && <span className="badge badge-plain">이전 레시피</span>}
        </div>
        <p className="bench-hint" role="status" data-testid="instruction">
          {step === "stir" && <Icon name="hand" size={18} />} {instruction[step]}
        </p>
        <ol className="steps" aria-label="제조 단계">
          {order.tasks.map((t) => (
            <StepChip key={t.problemId} done={t.status === "done"} label={getIngredient(t.ingredientId).name} />
          ))}
          <StepChip done={stirred} label="젓기" />
          <StepChip done={!brewing} label="병에 담기" />
        </ol>
        <button type="button" className="btn btn-quiet" onClick={() => dispatch({ type: "GO_COUNTER" })} disabled={busy || active !== null || popupOpen} data-testid="to-counter-peek">
          창구 보기
        </button>
      </header>

      <div className={`bench-stage ${L.stacked ? "is-stacked" : ""}`} ref={stageRef} data-testid="bench-stage">
        <img className="bench-table" src={assetUrl(WB.table)} alt="" draggable={false} style={rect(sceneBox)} data-testid="bench-table" />

        {/* 항아리 안 물약 (장면 좌표 SVG, 항아리 안쪽 타원으로 잘라 냄) */}
        <svg className="pot-fx" viewBox={`0 0 ${WB.width} ${WB.height}`} style={rect(sceneBox)} aria-hidden="true">
          <defs>
            <clipPath id="pot-inner">
              <ellipse cx={POT.cx} cy={POT.cy} rx={POT.rx} ry={POT.ry} />
            </clipPath>
            <radialGradient id="liq-grad" cx="0.42" cy="0.38" r="0.7">
              <stop offset="0" stopColor="#ffffff" stopOpacity="0.32" />
              <stop offset="0.45" stopColor="#ffffff" stopOpacity="0.06" />
              <stop offset="1" stopColor="#001a14" stopOpacity="0.34" />
            </radialGradient>
            <radialGradient id="liq-burst" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" stopColor={recipe.look.glow} stopOpacity="0.9" />
              <stop offset="1" stopColor={recipe.look.glow} stopOpacity="0" />
            </radialGradient>
          </defs>
          <g clipPath="url(#pot-inner)">
            <ellipse cx={LIQ.cx} cy={LIQ.cy} rx={LIQ.rx} ry={LIQ.ry} fill={liquidColor} opacity={doneIngs.length ? 0.9 : 0.62} className="liq-body" data-testid="pot-liquid" data-color={liquidColor} />
            <ellipse cx={LIQ.cx} cy={LIQ.cy} rx={LIQ.rx} ry={LIQ.ry} fill="url(#liq-grad)" />
            <g ref={swirlRef} className={`liq-swirl ${holding ? "is-holding" : ""}`} opacity={0.25 + stir * 0.45}>
              {[0.86, 0.64, 0.42, 0.22].map((r, i) => (
                <path key={i} d={spiralArc(r, i)} fill="none" stroke={recipe.look.glow} strokeWidth={6 - i} strokeLinecap="round" opacity={0.55 - i * 0.08} />
              ))}
            </g>
            {/* 작은 입자 (개수 고정) */}
            {Array.from({ length: 7 }, (_, i) => (
              <circle key={i} className="liq-mote" style={{ animationDelay: `${i * 0.55}s` }} cx={LIQ.cx + Math.cos(i * 2.1) * LIQ.rx * 0.55} cy={LIQ.cy + Math.sin(i * 2.1) * LIQ.ry * 0.5} r={4 + (i % 3)} fill={recipe.look.glow} opacity={0.15 + stir * 0.5} />
            ))}
            {pourAnim && (
              <g key={pourAnim.seq} className="liq-drop-ripple">
                <ellipse cx={LIQ.cx} cy={LIQ.cy} rx={30} ry={26} fill="none" stroke="#e8fff2" strokeWidth={5} />
                <ellipse cx={LIQ.cx} cy={LIQ.cy} rx={30} ry={26} fill="none" stroke="#e8fff2" strokeWidth={3} style={{ animationDelay: "0.25s" }} />
              </g>
            )}
            {showStick && (
              <g ref={rippleRef}>
                <ellipse className={`stick-ripple ${holding ? "is-on" : ""}`} rx={34} ry={30} fill="none" stroke="#e8fff2" strokeWidth={3} />
              </g>
            )}
            {burst && <ellipse className="liq-burst" cx={LIQ.cx} cy={LIQ.cy} rx={LIQ.rx} ry={LIQ.ry} fill="url(#liq-burst)" />}
          </g>
          {targeting && (
            <ellipse className={`pot-target ${overPot ? "is-over" : ""}`} cx={RIM.cx} cy={RIM.cy} rx={POT.rx + 30} ry={POT.ry + 28} fill="none" />
          )}
          {showStick && (
            <g ref={stickRef} className="stir-stick">
              {/* 탑뷰 젓는 막대: 끝(원점)은 액체 속, 손잡이는 위쪽으로 뻗는다 */}
              <path d="M-9 4 C -9 -60, -11 -200, -8 -300 L 8 -300 C 11 -200, 9 -60, 9 4 Z" fill="#000" opacity="0.25" transform="translate(10 8)" />
              <path d="M-10 6 C -12 -60, -11 -200, -9 -300 C -6 -312, 6 -312, 9 -300 C 11 -200, 12 -60, 10 6 C 6 14, -6 14, -10 6 Z" fill="#9a6a3c" stroke="#3a2416" strokeWidth={4} />
              <path d="M-3 -10 C -4 -90, -3 -200, -2 -290" fill="none" stroke="#c99560" strokeWidth={4} strokeLinecap="round" opacity="0.8" />
              <path d="M-11 -210 L 11 -206 M -11 -196 L 11 -192 M -11 -182 L 11 -178" stroke="#e7d2a6" strokeWidth={4} />
              <ellipse cx={0} cy={0} rx={18} ry={12} fill="#7a5230" stroke="#3a2416" strokeWidth={4} />
            </g>
          )}
        </svg>

        {/* 서랍 (재료 공급원). 이번 주문에 쓰는 재료만 놓인다 */}
        {brewing &&
          order.tasks.map((t, i) => {
            const ing = getIngredient(t.ingredientId);
            const d = WB.drawers[ing.drawer] ?? WB.drawers[0];
            const done = t.status !== "pending";
            const label = t.status === "done" ? "넣음" : t.status === "measured" ? "계량함" : i === active ? "항아리 위" : "서랍";
            const isPicked = picked === i;
            const dragging = drag?.active && drag.index === i;
            return (
              <button
                key={t.problemId}
                type="button"
                className={`drawer-item ${isPicked ? "is-picked" : ""} ${done || i === active ? "is-used" : ""} ${bounce === i ? "is-bounce" : ""} ${dragging ? "is-dragging" : ""}`}
                style={rect(d)}
                aria-pressed={isPicked}
                aria-label={`${ing.name} (${ing.unit}) ${label}${isPicked ? ", 집음" : ""}`}
                disabled={done || i === active || !canPlace}
                onPointerDown={(e: ReactPointerEvent<HTMLButtonElement>) => onJarPointerDown(e, i)}
                onPointerMove={onJarPointerMove}
                onPointerUp={onJarPointerUp}
                onPointerCancel={onJarPointerCancel}
                onLostPointerCapture={onJarPointerCancel}
                onClick={() => onJarClick(i)}
                data-testid={`jar-${t.ingredientId}`}
                data-sfx="pick"
              >
                <DrawerArt ing={ing} width={d.width * L.s} height={d.height * L.s} picked={isPicked} />
                <span className="drawer-tag">
                  {t.status === "done" && <Icon name="check" size={13} />} {ing.name} · {ing.unit}
                </span>
              </button>
            );
          })}
        {picked !== null && (
          <button type="button" className="btn btn-quiet unpick-btn" style={{ left: L.left + WB.drawers[0].x * L.s, top: L.top + (WB.drawers[0].y + WB.drawers[0].height + 8) * L.s }} onClick={() => setPicked(null)} data-testid="unpick">
            집기 취소
          </button>
        )}

        {/* 항아리: 놓기·젓기 영역 (테두리 포함 원형) */}
        <div
          className={`pot-zone ${stirMode ? "is-stirring" : ""} ${holding ? "is-holding" : ""}`}
          style={{ ...rect({ x: RIM.cx - RIM.rx, y: RIM.cy - RIM.ry, width: RIM.rx * 2, height: RIM.ry * 2 }) }}
          onPointerDown={onZonePointerDown}
          onPointerMove={onZonePointerMove}
          onPointerUp={onZonePointerEnd}
          onPointerCancel={onZonePointerEnd}
          onLostPointerCapture={onZonePointerEnd}
          onKeyDown={onZoneKeyDown}
          tabIndex={stirMode ? 0 : -1}
          role={stirMode ? "slider" : undefined}
          aria-label={stirMode ? "젓는 막대 (좌우 화살표로도 저을 수 있어요)" : "항아리"}
          aria-valuemin={stirMode ? 0 : undefined}
          aria-valuemax={stirMode ? 100 : undefined}
          aria-valuenow={stirMode ? order.stirProgress : undefined}
          aria-valuetext={stirMode ? `젓기 ${order.stirProgress}%` : undefined}
          data-testid="cauldron"
        >
          {picked !== null && canPlace && (
            <button type="button" className="pot-drop" aria-label="항아리에 넣기" onClick={() => place(picked)} data-testid="cauldron-drop" data-sfx="none">
              <span className="pot-drop-label">여기에 놓기</span>
            </button>
          )}
          {stirMode && !holding && (
            <span className="grab-hint" aria-hidden="true">
              <Icon name="hand" size={30} />
            </span>
          )}
        </div>

        {/* 떨어지는 재료 연출 */}
        {pourAnim && pourIng && (
          <div className="pour-drop" key={pourAnim.seq} data-testid="pour-anim" aria-hidden="true"
            style={rect({ x: LIQ.cx - 70, y: LIQ.cy - 150, width: 140, height: 150 })}>
            <IngredientArt ingredient={pourIng} size={Math.max(36, 110 * L.s)} />
            <span className="pour-label">
              {pourIng.name} {pourAnim.amount.length > 8 ? pourAnim.amount.slice(0, 8) + "…" : pourAnim.amount}{pourAnim.unit}
            </span>
          </div>
        )}

        {/* 병 받침: 병에 담은 포션 */}
        {!brewing && (
          <div className={`rack-bottles ${bottling ? "is-filling" : ""}`} style={rect(WB.bottleRack)} data-testid="bottled">
            {Array.from({ length: Math.min(order.bottles, 6) }, (_, i) => (
              <span key={i} className="bottle-slot" style={{ animationDelay: `${i * 0.1}s` }}>
                <PotionBottle look={recipe.look} size={Math.max(28, 92 * L.s)} quality={order.quality} label={`${recipe.name} ${i + 1}번째 병`} />
              </span>
            ))}
            {order.bottles > 6 && <span className="rack-more">모두 {order.bottles}병</span>}
          </div>
        )}

        {/* 레시피북·주문서 버튼 (PNG + 위쪽 HTML 글자) */}
        <BookButton
          refEl={bookBtn}
          box={WB.book}
          rect={rect}
          img={WB.recipeBook}
          label="레시피"
          active={popup === "recipe"}
          onClick={() => openPopup("recipe")}
          testId="open-recipe"
        />
        <BookButton
          refEl={clipBtn}
          box={WB.clipboard}
          rect={rect}
          img={WB.clipboardImage}
          label="주문서"
          active={popup === "order"}
          onClick={() => openPopup("order")}
          testId="open-order"
        />

        {!L.stacked && (
          <>
            <div className="bench-meter" style={rect({ x: 470, y: 864, width: 360, height: 44 })}>{meter}</div>
            <div className="bench-actions" style={rect(WB.slab)}>{actions}</div>
          </>
        )}

        {(activeTask || L.stacked) && (
          <section className={`side-panel bench-panel ${activeTask ? "is-open" : ""}`} style={panelStyle} aria-label="계량">
            {L.stacked && (
              <div className="dock-row">
                {meter}
                {actions}
              </div>
            )}
            {activeTask && active !== null ? (
              <MeasurePanel order={order} task={activeTask} index={active} draft={state.draftAnswer} feedback={state.feedback} dispatch={dispatch} locked={busy || popupOpen} />
            ) : (
              L.stacked && <StepGuide order={order} step={step} />
            )}
          </section>
        )}
      </div>

      {drag?.active && (
        <div className="drag-ghost" ref={ghostRef} aria-hidden="true">
          <span className="drag-ghost-inner">
            <IngredientArt ingredient={getIngredient(order.tasks[drag.index].ingredientId)} size={84} />
          </span>
        </div>
      )}

      {popup && <BookPopup kind={popup} state={state} order={order} onClose={closePopup} />}
    </div>
  );
}

/** 0~1 반지름의 소용돌이 호 (장면 좌표) */
function spiralArc(r: number, i: number): string {
  const a0 = i * 1.4;
  const pts: string[] = [];
  for (let k = 0; k <= 12; k++) {
    const a = a0 + (k / 12) * Math.PI * 1.2;
    const rr = r * (1 - k * 0.012);
    pts.push(`${(LIQ.cx + Math.cos(a) * LIQ.rx * rr).toFixed(1)} ${(LIQ.cy + Math.sin(a) * LIQ.ry * rr).toFixed(1)}`);
  }
  return "M" + pts.join(" L");
}

/** 두 색 섞기 (t: 0 → a, 1 → b) */
function blend(a: string, b: string, t: number): string {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  const c = x.map((v, i) => Math.round(v + (y[i] - v) * Math.max(0, Math.min(1, t))));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function DrawerArt({ ing, width, height, picked }: { ing: Ingredient; width: number; height: number; picked: boolean }) {
  if (ing.kind === "herb") return <EnergyHerbPile width={width} height={height * 0.8} picked={picked} />;
  // 이전 버전 재료(달빛 이슬·별가루)는 호환용 그림
  return (
    <span className="drawer-legacy">
      <IngredientArt ingredient={ing} size={Math.min(width, height) * 0.62} />
    </span>
  );
}

function BookButton({
  refEl, box, rect, img, label, active, onClick, testId,
}: {
  refEl: RefObject<HTMLButtonElement | null>;
  box: Box;
  rect: (b: Box) => CSSProperties;
  img: string;
  label: string;
  active: boolean;
  onClick: () => void;
  testId: string;
}) {
  return (
    <button
      ref={refEl}
      type="button"
      className={`book-btn ${active ? "is-active" : ""}`}
      style={rect(box)}
      onClick={onClick}
      aria-haspopup="dialog"
      aria-expanded={active}
      data-testid={testId}
      data-sfx="page"
    >
      <span className="book-btn-label">{label}</span>
      <img src={assetUrl(img)} alt="" draggable={false} />
    </button>
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
    { key: "place", label: "재료를 집어 항아리에 놓아요", detail: "서랍을 누르고 항아리 누르기, 또는 끌어다 놓기" },
    { key: "measure", label: "몇 g 넣을지 정해요", detail: "레시피북과 주문서를 보고 계산해요" },
    { key: "stir", label: "막대로 저어요", detail: "막대를 잡고 휘휘 움직이기" },
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
