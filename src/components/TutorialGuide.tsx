/**
 * 첫 주문 튜토리얼 안내: 짧은 한두 문장 + 실제 화면 요소 강조(테두리).
 *  - 강조 위치는 실제 요소의 화면 좌표를 무대 좌표로 바꿔 그린다(배율·여백이 달라도 같은 자리).
 *  - 강조·말풍선은 클릭을 막지 않는다(pointer-events: none). 말풍선은 대상과 겹치지 않는 곳에 둔다.
 *  - 학생이 그 행동을 해야(게임 상태가 바뀌어야) 다음 안내로 넘어간다. 시간으로 넘어가지 않는다.
 *  - 정답(1.2g)은 미리 알려 주지 않는다. 오답이어도 해설을 보고 그대로 제조를 이어 간다.
 *  - '건너뛰기': 주문은 그대로 두고 안내만 끝낸다(돈·보상 없음).
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { currentOrder } from "../game/reducer.ts";
import { tutorialStep, type TutorialStep } from "../game/tutorial.ts";
import type { GameState } from "../game/types.ts";
import { clientToLocal, STAGE_H, STAGE_W } from "./Stage.tsx";

interface Guide {
  target: string;
  text: string;
  /** 말풍선이 덮지 않을 요소 (예: 해설이 보이는 계량 패널) */
  avoid?: string;
}

const coarse = () => typeof window !== "undefined" && !!window.matchMedia?.("(pointer: coarse)").matches;

function guideFor(step: TutorialStep, state: GameState, dom: ParentNode): Guide | null {
  const popupOpen = !!dom.querySelector('[data-testid="book-popup"]');
  const touch = coarse();
  switch (step) {
    case "intro":
      return { target: '[data-testid="intro-ok"]', text: "오늘 배울 계산을 읽고 ‘알겠어요’를 눌러요." };
    case "accept":
      return { target: '[data-testid="accept"]', text: "손님 주문을 들었으면 ‘오케이’를 눌러 주문을 받아요. 그러면 제작대로 가요." };
    case "toBench":
      return { target: '[data-testid="back-to-bench"]', text: "제작대로 가서 포션을 만들어요." };
    case "order":
    case "recipe": {
      if (popupOpen) return { target: '[data-testid="popup-close"]', text: "다 봤으면 ‘닫기’를 눌러요." };
      return step === "order"
        ? { target: '[data-testid="open-order"]', text: "오른쪽 아래 ‘주문서’를 눌러 손님 주문을 다시 확인해요." }
        : { target: '[data-testid="open-recipe"]', text: "왼쪽 아래 ‘레시피’ 책을 눌러 1병에 넣는 재료의 양을 확인해요." };
    }
    case "place": {
      if (dom.querySelector(".drawer-item.is-picked")) return { target: '[data-testid="cauldron-drop"]', text: "기력초를 집었어요. 항아리를 눌러 넣어요." };
      return {
        target: '[data-testid="jar-energyHerb"]',
        text: touch ? "기력초를 눌러 선택한 뒤 항아리를 누르거나, 항아리로 끌어 놓으세요." : "기력초를 눌러 집고 항아리를 누르거나, 항아리로 끌어다 놓아요.",
      };
    }
    case "measure":
      return { target: '[data-testid="measure-panel"]', avoid: '[data-testid="measure-panel"]', text: "레시피의 1병당 양과 주문한 병 수로 필요한 양을 계산해 입력하고 ‘제출하기’를 눌러요." };
    case "add": {
      const o = currentOrder(state);
      const t = o && state.activeTask !== null ? o.tasks[state.activeTask] : null;
      return {
        target: '[data-testid="add-to-cauldron"]',
        avoid: '[data-testid="measure-panel"]',
        text: t?.correct === false ? "해설을 읽어 보고 ‘이 양으로 투입하기’를 눌러요. 다음 주문에서 다시 도전해요." : "‘이 양으로 투입하기’를 눌러 항아리에 넣어요.",
      };
    }
    case "stir":
      return { target: '[data-testid="cauldron"]', text: touch ? "막대를 손가락으로 잡고 빙글빙글 움직여 저어요." : "막대를 잡고 빙글빙글 움직여 저어요. (키보드: 항아리를 고르고 ←·→)" };
    case "bottle":
      return { target: '[data-testid="complete"]', text: "다 저었어요! ‘병에 담기’를 눌러요." };
    case "toCounter":
      return { target: '[data-testid="to-counter"]', text: "‘창구로 가져가기’를 눌러 손님에게 가요." };
    case "deliver":
      return { target: '[data-testid="deliver"]', text: "‘포션 전달하기’를 눌러 손님에게 건네요." };
    default:
      return null;
  }
}

interface Box { x: number; y: number; w: number; h: number }

/** 말풍선 자리: 대상 아래 → 위 → 왼쪽 → 오른쪽 중 무대 안에 들어가고 대상과 겹치지 않는 첫 자리 */
function placeBubble(t: Box, bw: number, bh: number, avoid: Box | null = null): { x: number; y: number } {
  const gap = 14;
  const hits = (x: number, y: number, o: Box | null) => !!o && x < o.x + o.w && o.x < x + bw && y < o.y + o.h && o.y < y + bh;
  const inside = (x: number, y: number) => x >= 6 && y >= 6 && x + bw <= STAGE_W - 6 && y + bh <= STAGE_H - 6 && !hits(x, y, t) && !hits(x, y, avoid);
  const clampX = (x: number) => Math.max(6, Math.min(STAGE_W - bw - 6, x));
  const clampY = (y: number) => Math.max(6, Math.min(STAGE_H - bh - 6, y));
  const a = avoid ?? t;
  const cands = [
    { x: a.x - bw - gap, y: clampY(t.y + t.h / 2 - bh / 2) },
    { x: clampX(t.x + t.w / 2 - bw / 2), y: t.y + t.h + gap },
    { x: clampX(t.x + t.w / 2 - bw / 2), y: t.y - bh - gap },
    { x: t.x - bw - gap, y: clampY(t.y + t.h / 2 - bh / 2) },
    { x: t.x + t.w + gap, y: clampY(t.y + t.h / 2 - bh / 2) },
  ];
  if (!avoid) cands.shift();
  for (const c of cands) if (inside(c.x, c.y)) return c;
  // 들어갈 자리가 없으면 대상과 먼 쪽 모서리
  return { x: t.x + t.w / 2 > STAGE_W / 2 ? 10 : STAGE_W - bw - 10, y: t.y + t.h / 2 > STAGE_H / 2 ? 10 : STAGE_H - bh - 10 };
}

export function TutorialGuide({ state, onSkip }: { state: GameState; onSkip: () => void }) {
  const layer = useRef<HTMLDivElement | null>(null);
  const bubble = useRef<HTMLDivElement | null>(null);
  const [view, setView] = useState<{ step: TutorialStep; guide: Guide; box: Box | null; pos: { x: number; y: number } } | null>(null);
  const step = tutorialStep(state);
  const stateRef = useRef(state);
  stateRef.current = state;

  // 대상 요소의 실제 위치를 매 프레임 따라간다 (애니메이션·팝업·배율 변화에도 어긋나지 않게)
  useLayoutEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const el = layer.current;
      const canvas = el?.closest(".stage-canvas") as HTMLElement | null;
      const st = tutorialStep(stateRef.current);
      if (!el || !canvas || !st || st === "done") {
        setView((v) => (v ? null : v));
        return;
      }
      const guide = guideFor(st, stateRef.current, canvas);
      if (!guide) return;
      const target = canvas.querySelector(guide.target) as HTMLElement | null;
      const boxOf = (node: Element | null): Box | null => {
        if (!node) return null;
        const r = node.getBoundingClientRect();
        const a = clientToLocal(canvas, r.left, r.top);
        const b = clientToLocal(canvas, r.right, r.bottom);
        return b.x - a.x > 1 && b.y - a.y > 1 ? { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y } : null;
      };
      const box = boxOf(target);
      const avoidBox = guide.avoid ? boxOf(canvas.querySelector(guide.avoid)) : null;
      const bw = bubble.current?.offsetWidth ?? 380;
      const bh = bubble.current?.offsetHeight ?? 90;
      const pos = box ? placeBubble(box, bw, bh, avoidBox) : { x: STAGE_W / 2 - bw / 2, y: 12 };
      setView((v) =>
        v && v.step === st && v.guide.text === guide.text && v.pos.x === pos.x && v.pos.y === pos.y &&
        ((!v.box && !box) || (!!v.box && !!box && Math.abs(v.box.x - box.x) < 0.5 && Math.abs(v.box.y - box.y) < 0.5 && Math.abs(v.box.w - box.w) < 0.5 && Math.abs(v.box.h - box.h) < 0.5))
          ? v
          : { step: st, guide, box, pos },
      );
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // 화면 읽기 프로그램용: 단계가 바뀔 때만 알림
  const [announce, setAnnounce] = useState("");
  useEffect(() => {
    if (view) setAnnounce(view.guide.text);
  }, [view?.step, view?.guide.text]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!step || step === "done") return null;
  return (
    <div className="tutorial-layer" ref={layer} data-testid="tutorial" data-step={view?.step ?? step}>
      {view?.box && (
        <div className="tutorial-ring" data-testid="tutorial-ring"
          style={{ left: view.box.x - 6, top: view.box.y - 6, width: view.box.w + 12, height: view.box.h + 12 }} />
      )}
      <div className="tutorial-bubble" ref={bubble} style={view ? { left: view.pos.x, top: view.pos.y } : { left: -9999, top: 0 }} data-testid="tutorial-bubble">
        <p className="tutorial-kicker">첫 주문 연습</p>
        <p className="tutorial-text" data-testid="tutorial-text">{view?.guide.text ?? ""}</p>
        <button type="button" className="tutorial-skip" onClick={onSkip} data-testid="tutorial-skip">안내 건너뛰기</button>
      </div>
      <p className="sr-only" role="status" aria-live="polite">{announce}</p>
    </div>
  );
}
